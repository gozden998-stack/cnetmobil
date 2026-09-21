// app/api/wingsm/store-targets/route.ts
//
// CNETMOBIL - WingSM Değer Puan - MAĞAZA HEDEFİ
//
// Excel kaynağındaki "HEDEF" sütununun mağaza tarafı — her ay, her CMR
// mağazası için admin'in girdiği bir hedef sayısı. Bu sayı henüz
// projeksiyon/sıralama motoruna BAĞLANMADI (o motorun hangi metriği
// hedeflediği — Değer Puan mı, kârlılık/ciro mu — netleşince eklenecek);
// bu uç şimdilik SADECE hedef verisini girip saklamak için.
//
// GÜVENLİK: score-rules ile AYNI admin-gate (requireAdminSession).

import { NextRequest } from "next/server";

import { getPool, json, requireAdminSession } from "../score-rules/_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const BRANCH_LABELS = ["CMR MERKEZ", "CMR CADDE", "CMR SARAY", "CMR KAPAKLI"];

function currentPeriod() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

async function ensureTable() {
  const pool = getPool();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.wingsm_store_targets (
      id SERIAL PRIMARY KEY,
      branch_label TEXT NOT NULL,
      period TEXT NOT NULL,
      target_value NUMERIC NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT wingsm_store_targets_unique UNIQUE (branch_label, period),
      CONSTRAINT wingsm_store_targets_nonneg_chk CHECK (target_value >= 0)
    )
  `);

  return pool;
}

export async function GET(request: NextRequest) {
  const auth = requireAdminSession(request);

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const pool = await ensureTable();
    const period = request.nextUrl.searchParams.get("period") || currentPeriod();

    for (const branchLabel of BRANCH_LABELS) {
      await pool.query(
        `
          INSERT INTO public.wingsm_store_targets (branch_label, period, target_value)
          VALUES ($1, $2, 0)
          ON CONFLICT (branch_label, period) DO NOTHING
        `,
        [branchLabel, period]
      );
    }

    const result = await pool.query(
      `SELECT id, branch_label, period, target_value, updated_at FROM public.wingsm_store_targets WHERE period = $1 ORDER BY branch_label`,
      [period]
    );

    return json({ success: true, period, targets: result.rows });
  } catch (error) {
    console.error("WINGSM_STORE_TARGETS_GET_ERROR:", error);

    return json(
      { success: false, error: error instanceof Error ? error.message : "Mağaza hedefleri okunamadı." },
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

    const data = body as Record<string, unknown>;
    const branchLabel = String(data.branchLabel ?? "").trim();
    const period = String(data.period ?? "").trim();
    const targetValue = Number(data.targetValue);

    if (!BRANCH_LABELS.includes(branchLabel)) {
      return json({ success: false, error: `Geçersiz mağaza: "${branchLabel}".` }, 400);
    }

    if (!/^\d{4}-\d{2}$/.test(period)) {
      return json({ success: false, error: 'period "YYYY-AA" biçiminde olmalıdır.' }, 400);
    }

    if (!Number.isFinite(targetValue) || targetValue < 0) {
      return json({ success: false, error: "targetValue sıfır ya da pozitif bir sayı olmalıdır." }, 400);
    }

    const pool = await ensureTable();

    const result = await pool.query(
      `
        INSERT INTO public.wingsm_store_targets (branch_label, period, target_value, updated_at)
        VALUES ($1, $2, $3, now())
        ON CONFLICT (branch_label, period)
        DO UPDATE SET target_value = EXCLUDED.target_value, updated_at = now()
        RETURNING id, branch_label, period, target_value, updated_at
      `,
      [branchLabel, period, targetValue]
    );

    return json({ success: true, target: result.rows[0] });
  } catch (error) {
    console.error("WINGSM_STORE_TARGETS_PATCH_ERROR:", error);

    return json(
      { success: false, error: error instanceof Error ? error.message : "Mağaza hedefi güncellenemedi." },
      500
    );
  }
}
