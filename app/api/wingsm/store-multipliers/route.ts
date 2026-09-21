// app/api/wingsm/store-multipliers/route.ts
//
// CNETMOBIL - WingSM "Değer Puan" MAĞAZA ÇARPANI
//
// Excel kaynağında ("cmr değer puan HAZİRAN2026 (2).xlsm") her mağazanın
// "Toplam Puan"ını "Çarpanlı Puan"a çeviren sabit bir katsayı var
// (MAĞAZA ÇARPANI tablosu — şu an hepsi 1). Bu uç, o katsayıyı
// public.wingsm_store_multipliers tablosunda tutar ve admin ekranından
// düzenlenebilir hâle getirir.
//
// GÜVENLİK: Maaş/prim hesabına giren bir katsayı olduğu için sadece admin
// oturumuna açık (score-rules ile AYNI requireAdminSession).

import { NextRequest } from "next/server";

import { getPool, json, requireAdminSession } from "../score-rules/_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

// CMR'nin 4 mağazası — deger-puan-report/route.ts'teki CMR_DEPOTS ile
// AYNI branchLabel'lar (Excel'deki "CMR/CADDE/SARAYCMR/KAPAKLICMR"
// kısa adlarının panel içindeki karşılığı).
const BRANCH_LABELS = ["CMR MERKEZ", "CMR CADDE", "CMR SARAY", "CMR KAPAKLI"];

async function ensureTable() {
  const pool = getPool();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.wingsm_store_multipliers (
      branch_label TEXT PRIMARY KEY,
      multiplier NUMERIC NOT NULL DEFAULT 1,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT wingsm_store_multipliers_positive_chk CHECK (multiplier >= 0)
    )
  `);

  for (const branchLabel of BRANCH_LABELS) {
    await pool.query(
      `
        INSERT INTO public.wingsm_store_multipliers (branch_label, multiplier)
        VALUES ($1, 1)
        ON CONFLICT (branch_label) DO NOTHING
      `,
      [branchLabel]
    );
  }

  return pool;
}

export async function GET(request: NextRequest) {
  const auth = requireAdminSession(request);

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const pool = await ensureTable();

    const result = await pool.query(
      `SELECT branch_label, multiplier, updated_at FROM public.wingsm_store_multipliers ORDER BY branch_label`
    );

    return json({ success: true, multipliers: result.rows });
  } catch (error) {
    console.error("WINGSM_STORE_MULTIPLIERS_GET_ERROR:", error);

    return json(
      { success: false, error: error instanceof Error ? error.message : "Mağaza çarpanları okunamadı." },
      500
    );
  }
}

export async function PATCH(request: NextRequest) {
  const auth = requireAdminSession(request);

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const body = await request.json().catch(() => null);

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return json({ success: false, error: "Geçersiz istek gövdesi." }, 400);
    }

    const branchLabel = String((body as Record<string, unknown>).branchLabel ?? "").trim();
    const multiplier = Number((body as Record<string, unknown>).multiplier);

    if (!BRANCH_LABELS.includes(branchLabel)) {
      return json({ success: false, error: `Geçersiz mağaza: "${branchLabel}".` }, 400);
    }

    if (!Number.isFinite(multiplier) || multiplier < 0) {
      return json({ success: false, error: "multiplier sıfır ya da pozitif bir sayı olmalıdır." }, 400);
    }

    const pool = await ensureTable();

    const result = await pool.query(
      `
        UPDATE public.wingsm_store_multipliers
        SET multiplier = $2, updated_at = now()
        WHERE branch_label = $1
        RETURNING branch_label, multiplier, updated_at
      `,
      [branchLabel, multiplier]
    );

    return json({ success: true, multiplier: result.rows[0] });
  } catch (error) {
    console.error("WINGSM_STORE_MULTIPLIERS_PATCH_ERROR:", error);

    return json(
      { success: false, error: error instanceof Error ? error.message : "Mağaza çarpanı güncellenemedi." },
      500
    );
  }
}
