// app/lib/hepsiburada/map.ts
//
// CNETMOBIL - Hepsiburada ürünü <-> WingSM sıfır ürün eşleştirmesi
//
// public.hepsiburada_sku_map: elle yapılan eşleşmeler (hb_sku -> WingSM MalKod).
// Elle eşleşme yoksa, Hepsiburada stok kodu (merchantSku) bir WingSM MalKod ile birebir aynıysa otomatik eşleşir.

import type { Pool } from "pg";

import { ensureSifirTables } from "../wingsm/sifir";

let ready = false;

export async function ensureHepsiburadaMapTable(pool: Pool) {
  await ensureSifirTables(pool);

  if (ready) return;

  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.hepsiburada_sku_map (
      hb_sku TEXT PRIMARY KEY,
      mal_kod TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  ready = true;
}

export type WingProduct = { mal_kod: string; mal_ad: string; sinif: string; adet: number; depo_sayisi: number };

// WingSM sıfır ürün özeti (tüm depoların toplamı), MalKod listesi için.
export async function wingProductsByCode(pool: Pool, codes: string[]): Promise<Map<string, WingProduct>> {
  const map = new Map<string, WingProduct>();

  if (codes.length === 0) return map;

  const result = await pool.query(
    `SELECT mal_kod, max(mal_ad) AS mal_ad, max(sinif) AS sinif, sum(miktar)::int AS adet, count(*)::int AS depo_sayisi
     FROM public.sifir_stock WHERE mal_kod = ANY($1::text[]) GROUP BY mal_kod`,
    [codes]
  );

  for (const row of result.rows) map.set(String(row.mal_kod), row as WingProduct);

  return map;
}
