// app/lib/garantili/btk.ts
//
// CNETMOBIL - Garantili "BTK yenileme uygunluğu" sonuçlarının stok bazlı takibi
//
// Kaynak: Garantili POST /cihaz/imei-sorgu (okuma anahtarı, Garantili'de kayıt açmaz). Sonuç tablosu: garantili_btk_check.
// Kural (kullanıcı teyidi 2026-11-26): "yenilenmiş" ile "yenilemeye uygun" AYNI cevabı döner (uygun: true) -> ikisi de UYGUN (yeşil).
//   UYGUN_DEGIL (kırmızı): Garantili/BTK uygun demedi. Uygun olmayan cihaz da "sorgu_tamam: false, btk_kod 0, BTK oturumu alınamadı"
//   biçiminde döner (Garantili ekranında da böyle) -> kırmızı sayılır, mesaj yanında gösterilir; tekrar sorgulanabilir.
//   Sorgulanmamış: tabloda satırı yok. Ağ/HTTP hatası sonuç olarak KAYDEDİLMEZ (durum değişmez).
// WingSM'e hiçbir şey yazılmaz.

import type { Pool } from "pg";

import { garantiliFetch } from "./server";

export type BtkDurum = "UYGUN" | "UYGUN_DEGIL";

export type BtkRow = {
  imei: string;
  brand: string | null;
  model: string | null;
  memory: string | null;
  color: string | null;
  grade: string | null;
  depo: string | null;
  durum: BtkDurum | null;
  sorguTamam: boolean | null;
  btkKod: string | null;
  mesaj: string | null;
  checkedAt: string | null;
  kontrolSayisi: number;
};

let ready = false;

export async function ensureBtkTable(pool: Pool) {
  if (ready) return;

  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.garantili_btk_check (
      imei TEXT PRIMARY KEY,
      durum TEXT NOT NULL,
      sorgu_tamam BOOLEAN,
      uygun BOOLEAN,
      btk_kod TEXT,
      mesaj TEXT,
      kontrol_sayisi INTEGER NOT NULL DEFAULT 1,
      checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT garantili_btk_check_durum_chk CHECK (durum IN ('UYGUN', 'UYGUN_DEGIL'))
    )
  `);

  ready = true;
}

// Garantili cevabının "data" kısmından karar verir. Alanlar beklenen biçimde değilse null (kaydedilmez).
export function classifyBtk(data: any): { durum: BtkDurum; sorguTamam: boolean; uygun: boolean; btkKod: string | null; mesaj: string | null } | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  if (typeof data.uygun !== "boolean") return null;

  const sorguTamam = data.sorgu_tamam === true;
  const uygun = data.uygun === true;

  return {
    durum: uygun && sorguTamam ? "UYGUN" : "UYGUN_DEGIL",
    sorguTamam,
    uygun,
    btkKod: data.btk_kod === undefined || data.btk_kod === null ? null : String(data.btk_kod),
    mesaj: data.mesaj === undefined || data.mesaj === null ? null : String(data.mesaj).slice(0, 500),
  };
}

const STOCK_WHERE = `d.status = 'AVAILABLE' AND d.wing_status = 'IN_STOCK' AND d.imei ~ '^[0-9]{15}$'`;

// depo verilirse yalnız o mağazanın (stock_devices.current_branch_code) stoğu
export async function listStockBtk(pool: Pool, depo?: string | null): Promise<{ rows: BtkRow[]; ozet: { toplam: number; uygun: number; uygunDegil: number; sorgulanmamis: number } }> {
  await ensureBtkTable(pool);

  const depoCode = depo ? String(depo).trim() : null;

  const result = await pool.query(
    `SELECT d.imei, d.brand, d.model, d.memory, d.color, d.grade, d.current_branch_code AS depo,
            c.durum, c.sorgu_tamam, c.btk_kod, c.mesaj, c.checked_at, COALESCE(c.kontrol_sayisi, 0) AS kontrol_sayisi
     FROM public.stock_devices d
     LEFT JOIN public.garantili_btk_check c ON c.imei = d.imei
     WHERE ${STOCK_WHERE} AND ($1::text IS NULL OR d.current_branch_code = $1)
     ORDER BY d.current_branch_code, d.brand, d.model, d.memory, d.imei
     LIMIT 5000`,
    [depoCode]
  );

  const rows: BtkRow[] = result.rows.map((row: any) => ({
    imei: String(row.imei),
    brand: row.brand ?? null,
    model: row.model ?? null,
    memory: row.memory ?? null,
    color: row.color ?? null,
    grade: row.grade ?? null,
    depo: row.depo ?? null,
    durum: row.durum ?? null,
    sorguTamam: row.sorgu_tamam ?? null,
    btkKod: row.btk_kod ?? null,
    mesaj: row.mesaj ?? null,
    checkedAt: row.checked_at ? new Date(row.checked_at).toISOString() : null,
    kontrolSayisi: Number(row.kontrol_sayisi) || 0,
  }));

  return {
    rows,
    ozet: {
      toplam: rows.length,
      uygun: rows.filter((row) => row.durum === "UYGUN").length,
      uygunDegil: rows.filter((row) => row.durum === "UYGUN_DEGIL").length,
      sorgulanmamis: rows.filter((row) => row.durum === null).length,
    },
  };
}

export type BtkQueryFn = (imei: string) => Promise<{ ok: boolean; data: any; message: string | null }>;

const defaultQuery: BtkQueryFn = async (imei) => {
  const result = await garantiliFetch("/cihaz/imei-sorgu", { method: "POST", body: { imei } });

  return { ok: result.ok, data: result.body?.data ?? null, message: result.body?.message ?? null };
};

export type BtkRunInput = { imeis?: string[]; mod?: "bekleyen" | "kirmizi"; limit?: number; depo?: string | null };
export type BtkRunResult = {
  results: Array<{ imei: string; durum: BtkDurum; mesaj: string | null }>;
  errors: string[];
  kalanBekleyen: number;
  // Garantili dakika sınırına (kendi koyduğumuz 45/dk) yaklaşıldı: hata değil, çağıran biraz bekleyip devam eder
  rateLimited: boolean;
};

const isRateLimitMessage = (message: string) => /istek sınırı/i.test(message);

// Seçilen (ya da modla belirlenen) STOKTAKİ IMEI'leri sırayla sorgular, sonucu kaydeder. Stok dışı IMEI sorgulanmaz.
export async function runBtkChecks(pool: Pool, input: BtkRunInput, query: BtkQueryFn = defaultQuery): Promise<BtkRunResult> {
  await ensureBtkTable(pool);

  const limit = Math.min(10, Math.max(1, Math.trunc(Number(input.limit)) || 5));
  const depo = input.depo ? String(input.depo).trim() : null;
  let targets: string[] = [];

  if (Array.isArray(input.imeis) && input.imeis.length) {
    const wanted = Array.from(new Set(input.imeis.map((value) => String(value ?? "").replace(/\s+/g, "")).filter((value) => /^\d{15}$/.test(value)))).slice(0, limit);
    const inStock = await pool.query(`SELECT d.imei FROM public.stock_devices d WHERE ${STOCK_WHERE} AND d.imei = ANY($1::text[])`, [wanted]);

    targets = inStock.rows.map((row: any) => String(row.imei));
  } else if (input.mod === "kirmizi") {
    const rows = await pool.query(
      `SELECT d.imei FROM public.stock_devices d JOIN public.garantili_btk_check c ON c.imei = d.imei
       WHERE ${STOCK_WHERE} AND c.durum = 'UYGUN_DEGIL' AND ($2::text IS NULL OR d.current_branch_code = $2) ORDER BY c.checked_at ASC LIMIT $1`,
      [limit, depo]
    );

    targets = rows.rows.map((row: any) => String(row.imei));
  } else {
    const rows = await pool.query(
      `SELECT d.imei FROM public.stock_devices d LEFT JOIN public.garantili_btk_check c ON c.imei = d.imei
       WHERE ${STOCK_WHERE} AND c.imei IS NULL AND ($2::text IS NULL OR d.current_branch_code = $2) ORDER BY d.current_branch_code, d.imei LIMIT $1`,
      [limit, depo]
    );

    targets = rows.rows.map((row: any) => String(row.imei));
  }

  const results: BtkRunResult["results"] = [];
  const errors: string[] = [];
  let consecutiveErrors = 0;
  let rateLimited = false;

  for (const imei of targets) {
    try {
      const answer = await query(imei);
      const verdict = answer.ok ? classifyBtk(answer.data) : null;

      if (!verdict) {
        errors.push(`${imei}: Garantili beklenen cevabı vermedi${answer.message ? ` (${answer.message})` : ""}.`);
        consecutiveErrors += 1;
      } else {
        await pool.query(
          `INSERT INTO public.garantili_btk_check (imei, durum, sorgu_tamam, uygun, btk_kod, mesaj, kontrol_sayisi, checked_at)
           VALUES ($1, $2, $3, $4, $5, $6, 1, now())
           ON CONFLICT (imei) DO UPDATE SET durum = EXCLUDED.durum, sorgu_tamam = EXCLUDED.sorgu_tamam, uygun = EXCLUDED.uygun,
             btk_kod = EXCLUDED.btk_kod, mesaj = EXCLUDED.mesaj,
             kontrol_sayisi = public.garantili_btk_check.kontrol_sayisi + 1, checked_at = now()`,
          [imei, verdict.durum, verdict.sorguTamam, verdict.uygun, verdict.btkKod, verdict.mesaj]
        );
        results.push({ imei, durum: verdict.durum, mesaj: verdict.mesaj });
        consecutiveErrors = 0;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      // Hız sınırı gerçek bir hata değil: bu IMEI sorgulanmadı, kaydedilmedi; döngü durur, çağıran bekleyip devam eder
      if (isRateLimitMessage(message)) {
        rateLimited = true;
        break;
      }

      errors.push(`${imei}: ${message}`);
      consecutiveErrors += 1;
    }

    // Garantili erişilemiyor / limit dolu: boşuna zorlamayalım
    if (consecutiveErrors >= 2) break;
  }

  const pending = await pool.query(
    `SELECT count(*)::int AS n FROM public.stock_devices d LEFT JOIN public.garantili_btk_check c ON c.imei = d.imei
     WHERE ${STOCK_WHERE} AND c.imei IS NULL AND ($1::text IS NULL OR d.current_branch_code = $1)`,
    [depo]
  );

  return { results, errors, kalanBekleyen: Number(pending.rows[0]?.n) || 0, rateLimited };
}
