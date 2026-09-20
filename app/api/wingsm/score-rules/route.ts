// app/api/wingsm/score-rules/route.ts
//
// CNETMOBIL - WingSM "Değer Puan" kural tablosu CRUD (liste + oluştur)
//
// AMAÇ:
// "cmr değer puan HAZİRAN2026 (2).xlsm" Excel makrosundaki
// (Mal Sınıfı, Kâr aralığı) -> Puan eşlemesini artık elle Excel'de değil,
// public.wingsm_score_rules tablosunda tutmak ve admin ekranından
// düzenlenebilir hâle getirmek.
//
// KAPSAM DIŞI (BİLEREK DOKUNULMADI):
// - app/api/wingsm/value-report/route.ts (Aşama 1 salt-okunur WingSM testi)
// - app/lib/wingsm/server.ts / portal-server.ts
// - Bu route WingSM'e HİÇBİR istek atmaz, sadece kendi DB tablosunu okur/yazar.
//
// GÜVENLİK:
// - Maaş/prim hesabına giren bir kural tablosu olduğu için sadece admin
//   oturumuna açık. app/api/wingsm/value-report/route.ts'teki AYNI
//   cnet_auth / SESSION_SECRET HMAC doğrulama deseni _shared.ts'te
//   BİREBİR kopyalandı (farklı bir auth şeması icat edilmedi).

import { NextRequest } from "next/server";

import {
  getPool,
  json,
  requireAdminSession,
  validateFullRulePayload,
  type RulePayloadInput,
} from "./_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

// ======================================================
// GET - liste (?active=true|false ile filtrelenebilir)
// ======================================================

export async function GET(request: NextRequest) {
  const auth = requireAdminSession(request);

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const pool = getPool();
    const activeParam = request.nextUrl.searchParams.get("active");

    let result;

    if (activeParam === "true") {
      result = await pool.query(
        `SELECT * FROM public.wingsm_score_rules WHERE active = TRUE ORDER BY class_code, profit_min`
      );
    } else if (activeParam === "false") {
      result = await pool.query(
        `SELECT * FROM public.wingsm_score_rules WHERE active = FALSE ORDER BY class_code, profit_min`
      );
    } else {
      result = await pool.query(
        `SELECT * FROM public.wingsm_score_rules ORDER BY class_code, profit_min`
      );
    }

    return json({ success: true, rules: result.rows });
  } catch (error) {
    console.error("WINGSM_SCORE_RULES_GET_ERROR:", error);

    return json(
      { success: false, error: error instanceof Error ? error.message : "Kurallar okunamadı." },
      500
    );
  }
}

// ======================================================
// POST - yeni kural oluştur
// ======================================================

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

    const validated = validateFullRulePayload(body as RulePayloadInput);

    if (!validated.ok) {
      return json({ success: false, error: validated.error }, 400);
    }

    const { class_code, class_label, profit_min, profit_max, score, active } = validated.value;

    const pool = getPool();

    const result = await pool.query(
      `
        INSERT INTO public.wingsm_score_rules
          (class_code, class_label, profit_min, profit_max, score, active, created_at, updated_at)
        VALUES
          ($1, $2, $3, $4, $5, $6, now(), now())
        RETURNING *
      `,
      [class_code, class_label, profit_min, profit_max, score, active]
    );

    return json({ success: true, rule: result.rows[0] }, 201);
  } catch (error) {
    console.error("WINGSM_SCORE_RULES_POST_ERROR:", error);

    return json(
      { success: false, error: error instanceof Error ? error.message : "Kural oluşturulamadı." },
      500
    );
  }
}
