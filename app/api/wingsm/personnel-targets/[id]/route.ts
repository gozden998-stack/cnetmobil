// app/api/wingsm/personnel-targets/[id]/route.ts
//
// CNETMOBIL - WingSM Değer Puan - PERSONEL HEDEFİ (tekil güncelle/sil)
//
// PATCH: targetValue / isManager / active güncellenebilir.
// DELETE: soft delete (active=false) — score-rules/[id]/route.ts'teki
//         AYNI gerekçeyle (bkz. o dosyanın yorumu): bordroya giren bir
//         veri, geçmişe dönük denetim için kalıcı silinmez.

import { NextRequest } from "next/server";

import { getPool, json, requireAdminSession } from "../../score-rules/_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteContext = {
  params: Promise<{ id: string }> | { id: string };
};

function getTargetId(params: { id?: string } | null | undefined) {
  const id = Number(params?.id);

  if (!Number.isInteger(id) || id <= 0) {
    throw Object.assign(new Error("Hedef numarası geçersiz."), { status: 400 });
  }

  return id;
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = requireAdminSession(request);

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const params = await Promise.resolve(context.params);
    const id = getTargetId(params);

    const body = await request.json().catch(() => null);

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return json({ success: false, error: "Geçersiz istek gövdesi." }, 400);
    }

    const pool = getPool();

    const current = await pool.query(`SELECT * FROM public.wingsm_personnel_targets WHERE id = $1`, [id]);

    if (current.rows.length === 0) {
      return json({ success: false, error: "Hedef bulunamadı." }, 404);
    }

    const row = current.rows[0];
    const data = body as Record<string, unknown>;

    const targetValue = data.targetValue !== undefined ? Number(data.targetValue) : Number(row.target_value);
    const isManager = data.isManager !== undefined ? Boolean(data.isManager) : row.is_manager;
    const active = data.active !== undefined ? Boolean(data.active) : row.active;

    if (!Number.isFinite(targetValue) || targetValue < 0) {
      return json({ success: false, error: "targetValue sıfır ya da pozitif bir sayı olmalıdır." }, 400);
    }

    const result = await pool.query(
      `
        UPDATE public.wingsm_personnel_targets
        SET target_value = $2, is_manager = $3, active = $4, updated_at = now()
        WHERE id = $1
        RETURNING id, branch_label, satici_adi, period, target_value, is_manager, active, updated_at
      `,
      [id, targetValue, isManager, active]
    );

    return json({ success: true, target: result.rows[0] });
  } catch (error: any) {
    console.error("WINGSM_PERSONNEL_TARGETS_PATCH_ERROR:", error);

    return json(
      { success: false, error: error instanceof Error ? error.message : "Hedef güncellenemedi." },
      error?.status || 500
    );
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const auth = requireAdminSession(request);

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const params = await Promise.resolve(context.params);
    const id = getTargetId(params);

    const pool = getPool();

    const result = await pool.query(
      `
        UPDATE public.wingsm_personnel_targets
        SET active = FALSE, updated_at = now()
        WHERE id = $1
        RETURNING id, branch_label, satici_adi, period, target_value, is_manager, active, updated_at
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return json({ success: false, error: "Hedef bulunamadı." }, 404);
    }

    return json({ success: true, message: "Hedef pasif hale getirildi.", target: result.rows[0] });
  } catch (error: any) {
    console.error("WINGSM_PERSONNEL_TARGETS_DELETE_ERROR:", error);

    return json(
      { success: false, error: error instanceof Error ? error.message : "Hedef silinemedi." },
      error?.status || 500
    );
  }
}
