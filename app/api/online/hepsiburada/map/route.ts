// app/api/online/hepsiburada/map/route.ts
//
// Hepsiburada ürünü <-> WingSM ürünü eşleştirmesi kaydı.
// POST   { hbSku, malKod }  -> eşleştirir (aynı hbSku varsa günceller). malKod WingSM sıfır stokta olmalı.
// DELETE { hbSku }          -> eşleşmeyi kaldırır.
// Hepsiburada'ya ve WingSM'e HİÇBİR şey yazılmaz, yalnız bizim tablo. SADECE YÖNETİCİ.

import { NextRequest } from "next/server";

import { getPool, json, requireAdminSession } from "@/app/api/wingsm/score-rules/_shared";
import { ensureHepsiburadaMapTable } from "@/app/lib/hepsiburada/map";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const clean = (value: unknown) => String(value ?? "").trim();

export async function POST(request: NextRequest) {
  const auth = requireAdminSession(request);

  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const hbSku = clean(body?.hbSku);
  const malKod = clean(body?.malKod);

  if (!hbSku || !malKod) return json({ success: false, error: "hbSku ve malKod zorunludur." }, 400);

  try {
    const pool = getPool();

    await ensureHepsiburadaMapTable(pool);

    const exists = await pool.query(`SELECT 1 FROM public.sifir_stock WHERE mal_kod = $1 LIMIT 1`, [malKod]);

    if (!exists.rowCount) return json({ success: false, error: "Bu ürün kodu WingSM sıfır stokta bulunamadı." }, 400);

    await pool.query(
      `INSERT INTO public.hepsiburada_sku_map (hb_sku, mal_kod, source) VALUES ($1, $2, 'MANUAL')
       ON CONFLICT (hb_sku) DO UPDATE SET mal_kod = EXCLUDED.mal_kod, source = 'MANUAL', updated_at = now()`,
      [hbSku, malKod]
    );

    return json({ success: true });
  } catch (error) {
    return json({ success: false, error: error instanceof Error ? error.message : "Eşleştirme kaydedilemedi." }, 500);
  }
}

export async function DELETE(request: NextRequest) {
  const auth = requireAdminSession(request);

  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const hbSku = clean(body?.hbSku);

  if (!hbSku) return json({ success: false, error: "hbSku zorunludur." }, 400);

  try {
    const pool = getPool();

    await ensureHepsiburadaMapTable(pool);
    await pool.query(`DELETE FROM public.hepsiburada_sku_map WHERE hb_sku = $1`, [hbSku]);

    return json({ success: true });
  } catch (error) {
    return json({ success: false, error: error instanceof Error ? error.message : "Eşleşme kaldırılamadı." }, 500);
  }
}
