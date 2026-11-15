// app/lib/wingsm/sifir.ts
//
// CNETMOBIL - WingSM SIFIR stok okuma (1. el telefonlar + aksesuar), SALT OKUNUR
//
// Stok senkronu (sync-stock) yalnız sinif=2el okur. Burada, online kanallara (Hepsiburada, N11, İdefix) satılacak
// sıfır ürünlerin stoğu WingSM'den AYRI olarak okunur ve public.sifir_stock tablosuna yazılır:
//   her depo için /api/b2b/stok/list (sınıfsız) tek çağrı, istenen sınıflar süzülür.
// WingSM'e HİÇBİR veri yazılmaz. Yenilenmiş cihaz (stock_devices) akışına dokunulmaz.
//
// Ayar (ortam değişkeni, isteğe bağlı):
//   SIFIR_DEPOTS   virgülle depo kodları      (varsayılan: stoklu 9 depo)
//   SIFIR_CLASSES  virgülle sınıf kodları     (varsayılan: 1el,6el,aks)
// Bir depo okunamazsa o deponun eski kayıtları KORUNUR (stok sıfırlanmış gibi görünmez).

import type { Pool } from "pg";

import { isValidGtin } from "../gtin";
import { wingSMRequest } from "./server";

export const DEFAULT_SIFIR_DEPOTS = ["001", "002", "003", "005", "007", "008", "009", "010", "011"];
export const DEFAULT_SIFIR_CLASSES = ["1el", "6el", "aks"];

const list = (value: string | undefined, fallback: string[]) => {
  const items = String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return items.length ? items : fallback;
};

export const sifirDepots = () => list(process.env.SIFIR_DEPOTS, DEFAULT_SIFIR_DEPOTS);
export const sifirClasses = () => list(process.env.SIFIR_CLASSES, DEFAULT_SIFIR_CLASSES).map((item) => item.toLocaleLowerCase("tr-TR"));

let tableReady = false;

export async function ensureSifirTables(pool: Pool) {
  if (tableReady) return;

  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.sifir_stock (
      depo TEXT NOT NULL,
      mal_kod TEXT NOT NULL,
      mal_ad TEXT NOT NULL DEFAULT '',
      sinif TEXT NOT NULL DEFAULT '',
      miktar NUMERIC NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (depo, mal_kod)
    )
  `);

  // Hepsiburada'ya ürün açmak için barkod (EAN), WingSM satış fiyatı ve KDV de tutulur.
  await pool.query(`ALTER TABLE public.sifir_stock ADD COLUMN IF NOT EXISTS barkod TEXT NOT NULL DEFAULT ''`);
  await pool.query(`ALTER TABLE public.sifir_stock ADD COLUMN IF NOT EXISTS satis_fiyat NUMERIC`);
  await pool.query(`ALTER TABLE public.sifir_stock ADD COLUMN IF NOT EXISTS kdv NUMERIC`);

  await pool.query(`CREATE INDEX IF NOT EXISTS sifir_stock_kod_idx ON public.sifir_stock (mal_kod)`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.sifir_sync_runs (
      id BIGSERIAL PRIMARY KEY,
      started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      finished_at TIMESTAMPTZ,
      depots_ok INTEGER NOT NULL DEFAULT 0,
      depots_failed INTEGER NOT NULL DEFAULT 0,
      rows_written INTEGER NOT NULL DEFAULT 0,
      errors TEXT
    )
  `);

  tableReady = true;
}

export type SifirSyncSummary = {
  skipped?: boolean;
  depotsOk: number;
  depotsFailed: number;
  rowsWritten: number;
  errors: string[];
};

// Son başarılı çalışmadan bu yana minIntervalMs geçmediyse çalışmaz (dakikalık cron çağrısı hafif kalsın).
export async function syncSifirStock(pool: Pool, options: { minIntervalMs?: number } = {}): Promise<SifirSyncSummary> {
  await ensureSifirTables(pool);

  const minIntervalMs = options.minIntervalMs ?? 0;

  if (minIntervalMs > 0) {
    const last = await pool.query(`SELECT finished_at FROM public.sifir_sync_runs WHERE finished_at IS NOT NULL AND depots_failed = 0 ORDER BY id DESC LIMIT 1`);
    const finished = last.rows[0]?.finished_at ? new Date(last.rows[0].finished_at).getTime() : 0;

    if (finished && Date.now() - finished < minIntervalMs) return { skipped: true, depotsOk: 0, depotsFailed: 0, rowsWritten: 0, errors: [] };
  }

  const run = await pool.query(`INSERT INTO public.sifir_sync_runs DEFAULT VALUES RETURNING id`);
  const runId = run.rows[0].id;
  const classes = sifirClasses();
  const errors: string[] = [];
  let depotsOk = 0;
  let rowsWritten = 0;

  for (const depo of sifirDepots()) {
    try {
      const payload: any = await wingSMRequest("/api/b2b/stok/list", { method: "GET", query: { depo } });

      // WingSM success:true / data:null dönebilir (depoda hiç kayıt yok): boş kabul edilir.
      const rows: any[] = Array.isArray(payload?.data) ? payload.data : [];
      const picked = new Map<string, { mal_ad: string; sinif: string; miktar: number; barkod: string; fiyat: number | null; kdv: number | null }>();

      for (const row of rows) {
        const sinif = String(row?.MalSinifKod ?? "").trim().toLocaleLowerCase("tr-TR");
        const miktar = Number(row?.DepoMiktar ?? 0);
        const malKod = String(row?.MalKod ?? "").trim();

        if (!classes.includes(sinif) || !malKod || !(miktar > 0)) continue;

        const current = picked.get(malKod);

        // Barkod: MalBarkod1/2/3 içinden ÖNCE sağlama basamağı geçerli (gerçek EAN/GTIN) olan; hiçbiri geçerli değilse
        // ilk 8-14 haneli kod (ekranda "gerçek EAN değil" diye işaretlenir). İç kodlar gerçek barkodu gölgelemesin.
        const candidates = [row?.MalBarkod1, row?.MalBarkod2, row?.MalBarkod3].map((value) => String(value ?? "").trim());
        const barkod =
          candidates.find((value) => isValidGtin(value)) ||
          candidates.find((value) => /^\d{8,14}$/.test(value)) ||
          current?.barkod ||
          "";
        const fiyat = Number(row?.MalSatisFiyat);
        const kdv = Number(row?.MalKdvOran);

        picked.set(malKod, {
          mal_ad: String(row?.MalAd ?? "").trim() || current?.mal_ad || "",
          sinif,
          miktar: (current?.miktar ?? 0) + miktar,
          barkod,
          fiyat: Number.isFinite(fiyat) && fiyat > 0 ? fiyat : current?.fiyat ?? null,
          kdv: Number.isFinite(kdv) && kdv >= 0 ? kdv : current?.kdv ?? null,
        });
      }

      const client = await pool.connect();

      try {
        await client.query("BEGIN");
        await client.query(`DELETE FROM public.sifir_stock WHERE depo = $1`, [depo]);

        if (picked.size > 0) {
          const entries = Array.from(picked.entries());

          await client.query(
            `INSERT INTO public.sifir_stock (depo, mal_kod, mal_ad, sinif, miktar, barkod, satis_fiyat, kdv)
             SELECT $1, * FROM unnest($2::text[], $3::text[], $4::text[], $5::numeric[], $6::text[], $7::numeric[], $8::numeric[])`,
            [
              depo,
              entries.map(([kod]) => kod),
              entries.map(([, v]) => v.mal_ad),
              entries.map(([, v]) => v.sinif),
              entries.map(([, v]) => v.miktar),
              entries.map(([, v]) => v.barkod),
              entries.map(([, v]) => v.fiyat),
              entries.map(([, v]) => v.kdv),
            ]
          );
        }

        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }

      rowsWritten += picked.size;
      depotsOk += 1;
    } catch (error) {
      // Bu deponun eski kayıtları korunur.
      errors.push(`Depo ${depo}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  await pool.query(
    `UPDATE public.sifir_sync_runs SET finished_at = now(), depots_ok = $2, depots_failed = $3, rows_written = $4, errors = $5 WHERE id = $1`,
    [runId, depotsOk, errors.length, rowsWritten, errors.length ? errors.join(" | ").slice(0, 2000) : null]
  );

  return { depotsOk, depotsFailed: errors.length, rowsWritten, errors };
}
