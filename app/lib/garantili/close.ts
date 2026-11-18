// app/lib/garantili/close.ts
//
// CNETMOBIL - WingSM'de SATILAN cihazın Garantili ilanını kaldırma talebi (dakikalık tarama)
//
// Garantili'de "stok = 0" yok: ilan kaldırma `/ilan/kaldir-talep` ile TALEP açılır (personel onaylar), yeni
// açılan ilanda iş saati dolmadan açılmaz. Bu yüzden olay kuyruğu yerine DURUM TARAMASI yapılır:
//   1) Garantili'deki "ilanda" ilanlar okunur (GET /ilan/liste?ilan_durumu=ilanda),
//   2) IMEI'si yerel stock_devices'te SOLD olanlar (WingSM satışı) bulunur,
//   3) bunlar için kaldırma talebi açılır; kilitliyse (iş saati) bir sonraki taramada yeniden denenir.
// Elle (Garantili panelinden) açılmış ilanlar da yakalanır. Her IMEI için tek talep (garantili_close_requests).
// Talep açıldıktan sonra ilan listeden kalkınca "DONE" olur. WingSM'e hiçbir şey yazılmaz.
//
// Koruma: tek taramada 15'ten fazla ilan kapatılacak görünüyorsa (SOLD durumu toplu bozulmuş olabilir) hiçbiri
// gönderilmez, "blocked" döner.

import type { Pool } from "pg";

import { garantiliFetch, getGarantiliKey, pickRows } from "./server";
import { ensureGarantiliTables } from "./store";

const MAX_PER_SWEEP = 15;
const MAX_ATTEMPTS = 8;
const PAGE_SIZE = 100;
const MAX_PAGES = 10;

let closeTableReady = false;

export async function ensureGarantiliCloseTable(pool: Pool) {
  await ensureGarantiliTables(pool);

  if (closeTableReady) return;

  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.garantili_close_requests (
      imei TEXT PRIMARY KEY,
      ilan_id BIGINT,
      status TEXT NOT NULL DEFAULT 'LOCKED',
      attempts INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      response JSONB,
      requested_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT garantili_close_requests_status_chk CHECK (status IN ('LOCKED', 'REQUESTED', 'FAILED', 'DONE'))
    )
  `);

  closeTableReady = true;
}

export type CloseSweepSummary = {
  skipped: string | null;
  blocked: string | null;
  listed: number;
  sold: number;
  requested: number;
  locked: number;
  failed: number;
  done: number;
  errors: string[];
};

const text = (value: unknown) => String(value ?? "").trim();
const isTrue = (value: unknown) => value === true || value === 1 || value === "1" || String(value).toLowerCase() === "true";

// Garantili'de ilandaki tüm ilanlar. Eksik/yarım okunursa complete=false (DONE işaretlenmez).
async function fetchListedAds(): Promise<{ ads: { imei: string; ilanId: number; locked: boolean }[]; complete: boolean }> {
  const ads: { imei: string; ilanId: number; locked: boolean }[] = [];
  let complete = false;

  for (let sayfa = 1; sayfa <= MAX_PAGES; sayfa += 1) {
    const result = await garantiliFetch("/ilan/liste", { query: { ilan_durumu: "ilanda", sayfa, adet: PAGE_SIZE }, timeoutMs: 30_000 });

    if (!result.ok) throw new Error(result.body?.message || `Garantili ilan listesi HTTP ${result.status}`);

    const items = Array.isArray(result.body?.data?.items) ? result.body.data.items : pickRows(result.body).rows;

    for (const item of items) {
      const imei = text(item?.imei);
      const ilanId = Number(item?.ilan_id);

      if (/^\d{15}$/.test(imei) && Number.isFinite(ilanId) && ilanId > 0) ads.push({ imei, ilanId, locked: isTrue(item?.kaldirma_kilitli) });
    }

    if (items.length < PAGE_SIZE) {
      complete = true;
      break;
    }
  }

  return { ads, complete };
}

export async function runGarantiliCloseSweep(pool: Pool): Promise<CloseSweepSummary> {
  const summary: CloseSweepSummary = { skipped: null, blocked: null, listed: 0, sold: 0, requested: 0, locked: 0, failed: 0, done: 0, errors: [] };

  if (!getGarantiliKey()) return { ...summary, skipped: "Garantili anahtarı tanımlı değil." };

  await ensureGarantiliCloseTable(pool);

  const { ads, complete } = await fetchListedAds();

  summary.listed = ads.length;

  // İlanı kalkmış (onaylanmış) talepler -> DONE. Yalnız liste eksiksiz okunduysa.
  if (complete) {
    const listedImeis = ads.map((ad) => ad.imei);
    const doneRows = await pool.query(
      `UPDATE public.garantili_close_requests
       SET status = 'DONE', last_error = NULL, updated_at = now()
       WHERE status IN ('REQUESTED', 'LOCKED', 'FAILED') AND NOT (imei = ANY($1::text[]))
       RETURNING imei`,
      [listedImeis]
    );

    summary.done = doneRows.rowCount || 0;

    if (doneRows.rows.length) {
      await pool.query(`UPDATE public.garantili_devices SET status = 'CLOSED', updated_at = now() WHERE imei = ANY($1::text[]) AND status IN ('OPEN', 'REMOVE_REQUESTED')`, [
        doneRows.rows.map((row) => row.imei),
      ]);
    }
  }

  if (ads.length === 0) return summary;

  // WingSM'de satılmış (stock_devices SOLD) olanlar
  const soldRows = await pool.query(`SELECT imei FROM public.stock_devices WHERE imei = ANY($1::text[]) AND status = 'SOLD'`, [ads.map((ad) => ad.imei)]);
  const soldSet = new Set<string>(soldRows.rows.map((row) => String(row.imei)));
  const candidates = ads.filter((ad) => soldSet.has(ad.imei));

  summary.sold = candidates.length;

  if (candidates.length === 0) return summary;

  if (candidates.length > MAX_PER_SWEEP) {
    return { ...summary, blocked: `${candidates.length} ilan birden kapatılacak görünüyor (sınır ${MAX_PER_SWEEP}); olağan dışı olduğu için hiçbiri gönderilmedi. Elle kontrol edin.` };
  }

  const existingRows = await pool.query(`SELECT imei, status, attempts FROM public.garantili_close_requests WHERE imei = ANY($1::text[])`, [candidates.map((ad) => ad.imei)]);
  const existing = new Map<string, { status: string; attempts: number }>(existingRows.rows.map((row) => [String(row.imei), { status: String(row.status), attempts: Number(row.attempts) }]));

  for (const ad of candidates) {
    const state = existing.get(ad.imei);

    if (state?.status === "REQUESTED") continue; // onay bekleniyor
    if (state?.status === "FAILED" && state.attempts >= MAX_ATTEMPTS) continue;

    if (ad.locked) {
      await pool.query(
        `INSERT INTO public.garantili_close_requests (imei, ilan_id, status, last_error)
         VALUES ($1, $2, 'LOCKED', 'Yeni ilan: kaldırma iş saati dolunca denenecek')
         ON CONFLICT (imei) DO UPDATE SET ilan_id = EXCLUDED.ilan_id, status = 'LOCKED', last_error = EXCLUDED.last_error, updated_at = now()`,
        [ad.imei, ad.ilanId]
      );

      summary.locked += 1;
      continue;
    }

    try {
      const result = await garantiliFetch("/ilan/kaldir-talep", { method: "POST", body: { ids: [ad.ilanId] }, timeoutMs: 30_000 });

      if (result.ok) {
        await pool.query(
          `INSERT INTO public.garantili_close_requests (imei, ilan_id, status, attempts, last_error, response, requested_at)
           VALUES ($1, $2, 'REQUESTED', 1, NULL, $3::jsonb, now())
           ON CONFLICT (imei) DO UPDATE
             SET ilan_id = EXCLUDED.ilan_id, status = 'REQUESTED', attempts = public.garantili_close_requests.attempts + 1, last_error = NULL,
                 response = EXCLUDED.response, requested_at = now(), updated_at = now()`,
          [ad.imei, ad.ilanId, JSON.stringify(result.body ?? {}).slice(0, 5000)]
        );
        await pool.query(`UPDATE public.garantili_devices SET status = 'REMOVE_REQUESTED', updated_at = now() WHERE imei = $1 AND status = 'OPEN'`, [ad.imei]);

        summary.requested += 1;
        continue;
      }

      const message = `${result.body?.message || `Garantili HTTP ${result.status}`}${result.body?.errors ? ` ${JSON.stringify(result.body.errors).slice(0, 300)}` : ""}`.slice(0, 600);
      const lockLike = /iş saati|is saati|kilit/i.test(message);

      await pool.query(
        `INSERT INTO public.garantili_close_requests (imei, ilan_id, status, attempts, last_error)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (imei) DO UPDATE
           SET ilan_id = EXCLUDED.ilan_id, status = EXCLUDED.status, last_error = EXCLUDED.last_error, updated_at = now(),
               attempts = CASE WHEN EXCLUDED.status = 'FAILED' THEN public.garantili_close_requests.attempts + 1 ELSE public.garantili_close_requests.attempts END`,
        [ad.imei, ad.ilanId, lockLike ? "LOCKED" : "FAILED", lockLike ? 0 : 1, message]
      );

      if (lockLike) summary.locked += 1;
      else {
        summary.failed += 1;
        summary.errors.push(`${ad.imei}: ${message}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      summary.failed += 1;
      summary.errors.push(`${ad.imei}: ${message}`);
    }
  }

  return summary;
}

export async function recentCloseRequests(pool: Pool, limit = 50) {
  await ensureGarantiliCloseTable(pool);

  const result = await pool.query(
    `SELECT r.imei, r.ilan_id, r.status, r.attempts, r.last_error, r.requested_at, r.updated_at,
            d.brand, d.model, d.memory, d.color
     FROM public.garantili_close_requests r
     LEFT JOIN public.stock_devices d ON d.imei = r.imei
     ORDER BY r.updated_at DESC
     LIMIT $1`,
    [limit]
  );

  return result.rows;
}
