// app/api/wingsm/personnel-targets/route.ts
//
// CNETMOBIL - WingSM Değer Puan - PERSONEL HEDEFİ
//
// Excel kaynağındaki personel bazlı "HEDEF" listesinin karşılığı — her ay,
// her personel için admin'in girdiği bir hedef sayısı, artı "mağaza müdürü
// mü" işareti (Excel'de müdürler sıralamaya hiç girmiyor). Bu veri henüz
// projeksiyon/sıralama motoruna BAĞLANMADI (hangi metriğin hedeflendiği
// netleşince eklenecek); bu uç şimdilik SADECE hedef + müdür bilgisini
// girip saklamak için.
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
    CREATE TABLE IF NOT EXISTS public.wingsm_personnel_targets (
      id SERIAL PRIMARY KEY,
      branch_label TEXT NOT NULL,
      satici_adi TEXT NOT NULL,
      period TEXT NOT NULL,
      target_value NUMERIC NOT NULL DEFAULT 0,
      is_manager BOOLEAN NOT NULL DEFAULT false,
      active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT wingsm_personnel_targets_unique UNIQUE (branch_label, satici_adi, period),
      CONSTRAINT wingsm_personnel_targets_nonneg_chk CHECK (target_value >= 0)
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

    const result = await pool.query(
      `
        SELECT id, branch_label, satici_adi, period, target_value, is_manager, active, updated_at
        FROM public.wingsm_personnel_targets
        WHERE period = $1
        ORDER BY branch_label, satici_adi
      `,
      [period]
    );

    return json({ success: true, period, targets: result.rows });
  } catch (error) {
    console.error("WINGSM_PERSONNEL_TARGETS_GET_ERROR:", error);

    return json(
      { success: false, error: error instanceof Error ? error.message : "Personel hedefleri okunamadı." },
      500
    );
  }
}

export async function POST(request: NextRequest) {
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
    const saticiAdi = String(data.saticiAdi ?? "").trim();
    const period = String(data.period ?? "").trim();
    const targetValue = Number(data.targetValue ?? 0);
    const isManager = Boolean(data.isManager);

    if (!BRANCH_LABELS.includes(branchLabel)) {
      return json({ success: false, error: `Geçersiz mağaza: "${branchLabel}".` }, 400);
    }

    if (!saticiAdi) {
      return json({ success: false, error: "saticiAdi zorunludur." }, 400);
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
        INSERT INTO public.wingsm_personnel_targets
          (branch_label, satici_adi, period, target_value, is_manager, active, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, true, now(), now())
        RETURNING id, branch_label, satici_adi, period, target_value, is_manager, active, updated_at
      `,
      [branchLabel, saticiAdi, period, targetValue, isManager]
    );

    return json({ success: true, target: result.rows[0] }, 201);
  } catch (error: any) {
    if (error?.code === "23505") {
      return json({ success: false, error: "Bu personel için bu dönemde zaten bir hedef var." }, 409);
    }

    console.error("WINGSM_PERSONNEL_TARGETS_POST_ERROR:", error);

    return json(
      { success: false, error: error instanceof Error ? error.message : "Personel hedefi oluşturulamadı." },
      500
    );
  }
}
