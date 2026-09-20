// app/api/wingsm/score-rules/[id]/route.ts
//
// CNETMOBIL - WingSM "Değer Puan" kural tablosu CRUD (tekil güncelle/sil)
//
// PATCH: herhangi bir alt küme alanı güncelleyebilir (class_code/class_label
//        dahil — yeni sınıflar zamanla eklenebilsin diye TÜM alanlar
//        düzenlenebilir olmalı, sadece score/aralık değil).
// DELETE: YARGI KARARI - KALICI SİLME YERİNE active=false (soft delete).
//        Bu tablo maaş/prim'e giren "Değer Puan" hesabını besliyor; bir
//        kural bir dönem için zaten kullanılmış olabilir. Kalıcı silme,
//        geçmişe dönük denetimde "o dönem hangi kural aktifti" sorusunu
//        cevapsız bırakır. active=false ile satır denetim için kalır ama
//        yeni hesaplamalarda (idx_wingsm_score_rules_class_code WHERE
//        active indeksi + API'nin ?active=true filtresi) devre dışı olur.
//        Admin ekranındaki "Aktif/Pasif" anahtarı ile "Sil" butonu bu
//        yüzden aynı alanı değiştirir; "Sil" sonrası satır Aktif anahtarıyla
//        geri açılabilir.

import { NextRequest } from "next/server";

import {
  getPool,
  getRuleId,
  json,
  mergeAndValidateRulePayload,
  requireAdminSession,
  type RulePayloadInput,
  type WingsmScoreRuleRow,
} from "../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteContext = {
  params: Promise<{ id: string }> | { id: string };
};

async function loadRule(id: number): Promise<WingsmScoreRuleRow | null> {
  const pool = getPool();

  const result = await pool.query(`SELECT * FROM public.wingsm_score_rules WHERE id = $1 LIMIT 1`, [id]);

  return (result.rows[0] as WingsmScoreRuleRow) || null;
}

// ======================================================
// PATCH - mevcut kuralın herhangi bir alanını güncelle
// ======================================================

export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = requireAdminSession(request);

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const params = await Promise.resolve(context.params);
    const ruleId = getRuleId(params);

    const body = await request.json().catch(() => null);

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return json({ success: false, error: "Geçersiz istek gövdesi." }, 400);
    }

    const current = await loadRule(ruleId);

    if (!current) {
      return json({ success: false, error: "Kural bulunamadı." }, 404);
    }

    const validated = mergeAndValidateRulePayload(current, body as RulePayloadInput);

    if (!validated.ok) {
      return json({ success: false, error: validated.error }, 400);
    }

    const { class_code, class_label, profit_min, profit_max, score, active } = validated.value;

    const pool = getPool();

    const result = await pool.query(
      `
        UPDATE public.wingsm_score_rules
        SET
          class_code = $2,
          class_label = $3,
          profit_min = $4,
          profit_max = $5,
          score = $6,
          active = $7,
          updated_at = now()
        WHERE id = $1
        RETURNING *
      `,
      [ruleId, class_code, class_label, profit_min, profit_max, score, active]
    );

    return json({ success: true, rule: result.rows[0] });
  } catch (error: any) {
    console.error("WINGSM_SCORE_RULES_PATCH_ERROR:", error);

    return json(
      { success: false, error: error instanceof Error ? error.message : "Kural güncellenemedi." },
      error?.status || 500
    );
  }
}

// ======================================================
// DELETE - soft delete (active=false), bkz. üstteki yargı kararı notu
// ======================================================

export async function DELETE(request: NextRequest, context: RouteContext) {
  const auth = requireAdminSession(request);

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const params = await Promise.resolve(context.params);
    const ruleId = getRuleId(params);

    const pool = getPool();

    const result = await pool.query(
      `
        UPDATE public.wingsm_score_rules
        SET active = FALSE, updated_at = now()
        WHERE id = $1
        RETURNING *
      `,
      [ruleId]
    );

    const rule = result.rows[0];

    if (!rule) {
      return json({ success: false, error: "Kural bulunamadı." }, 404);
    }

    return json({
      success: true,
      message: "Kural pasif hale getirildi (kalıcı olarak silinmedi).",
      rule,
    });
  } catch (error: any) {
    console.error("WINGSM_SCORE_RULES_DELETE_ERROR:", error);

    return json(
      { success: false, error: error instanceof Error ? error.message : "Kural silinemedi." },
      error?.status || 500
    );
  }
}
