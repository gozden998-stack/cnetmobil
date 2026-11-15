// app/api/online/hepsiburada/names/route.ts
//
// Hepsiburada ürün adları (panelden alınan "Ürün Bilgisi" Excel dışa aktarımı).
// POST { rows: [{ sku, name, brand }] }  -> hepsiburada_names tablosuna yazar (aynı SKU varsa günceller). En çok 500 satır/istek.
// GET                                    -> { count } kayıtlı ad sayısı
// Hepsiburada ve WingSM'e HİÇBİR şey yazılmaz. SADECE YÖNETİCİ.

import { NextRequest } from "next/server";

import { getPool, json, requireAdminSession } from "@/app/api/wingsm/score-rules/_shared";
import { ensureHepsiburadaMapTable } from "@/app/lib/hepsiburada/map";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const MAX_ROWS = 500;

export async function GET(request: NextRequest) {
  const auth = requireAdminSession(request);

  if (!auth.ok) return auth.response;

  try {
    const pool = getPool();

    await ensureHepsiburadaMapTable(pool);

    const result = await pool.query(`SELECT count(*)::int AS n FROM public.hepsiburada_names`);

    return json({ success: true, count: Number(result.rows[0]?.n ?? 0) });
  } catch (error) {
    return json({ success: false, error: error instanceof Error ? error.message : "Sayı alınamadı." }, 200);
  }
}

export async function POST(request: NextRequest) {
  const auth = requireAdminSession(request);

  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const rawRows = Array.isArray(body?.rows) ? (body?.rows as Array<Record<string, unknown>>) : [];

  if (rawRows.length === 0 || rawRows.length > MAX_ROWS) return json({ success: false, error: `1 ile ${MAX_ROWS} arası satır gönderin.` }, 400);

  const skus: string[] = [];
  const names: string[] = [];
  const brands: string[] = [];
  let skipped = 0;

  for (const row of rawRows) {
    const sku = String(row?.sku ?? "").trim().toUpperCase();
    const name = String(row?.name ?? "").trim().slice(0, 300);

    if (!/^HB[A-Z0-9]{6,}$/.test(sku) || !name) {
      skipped += 1;
      continue;
    }

    skus.push(sku);
    names.push(name);
    brands.push(String(row?.brand ?? "").trim().slice(0, 100));
  }

  if (skus.length === 0) return json({ success: false, error: "Geçerli satır yok (SKU HBCV... ve Ürün Adı dolu olmalı)." }, 400);

  try {
    const pool = getPool();

    await ensureHepsiburadaMapTable(pool);
    await pool.query(
      `INSERT INTO public.hepsiburada_names (hb_sku, name, brand)
       SELECT t.sku, t.name, t.brand FROM unnest($1::text[], $2::text[], $3::text[]) AS t(sku, name, brand)
       ON CONFLICT (hb_sku) DO UPDATE SET name = EXCLUDED.name, brand = EXCLUDED.brand, updated_at = now()`,
      [skus, names, brands]
    );

    return json({ success: true, saved: skus.length, skipped });
  } catch (error) {
    return json({ success: false, error: error instanceof Error ? error.message : "Adlar kaydedilemedi." }, 200);
  }
}
