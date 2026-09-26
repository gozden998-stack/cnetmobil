// app/api/admin/dealers/[id]/route.ts
//
// "Bayi Portali" - yonetici bir bayiyi aktif/pasif yapar veya
// sifresini sifirlar.

import { NextRequest, NextResponse } from "next/server";

import { getAuctionSession } from "../../../auctions/_server";
import {
  ensureDealerTables,
  getDealerPool,
  hashDealerPassword,
} from "@/app/lib/dealer/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function ensureManager(session: { isManager: boolean }) {
  if (!session.isManager) {
    throw Object.assign(
      new Error("Bu işlem sadece yönetici/admin oturumu ile yapılabilir."),
      { status: 403 }
    );
  }
}

function parseId(value: string) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuctionSession(request);
    ensureManager(session);

    const { id: idParam } = await context.params;
    const id = parseId(idParam);

    if (!id) {
      return json({ ok: false, error: "Geçersiz bayi." }, 400);
    }

    const body = await request.json().catch(() => null);

    const pool = getDealerPool();
    const client = await pool.connect();

    try {
      await ensureDealerTables(client);

      if (typeof (body as any)?.isActive === "boolean") {
        const result = await client.query(
          `UPDATE public.dealers SET is_active = $2, updated_at = NOW() WHERE id = $1`,
          [id, (body as any).isActive]
        );

        if (!result.rowCount) {
          return json({ ok: false, error: "Bayi bulunamadı." }, 404);
        }
      }

      if (typeof (body as any)?.newPassword === "string") {
        const newPassword = String((body as any).newPassword);

        if (newPassword.length < 8) {
          return json(
            { ok: false, error: "Şifre en az 8 karakter olmalıdır." },
            400
          );
        }

        const passwordHash = await hashDealerPassword(newPassword);

        const result = await client.query(
          `UPDATE public.dealers SET password_hash = $2, updated_at = NOW() WHERE id = $1`,
          [id, passwordHash]
        );

        if (!result.rowCount) {
          return json({ ok: false, error: "Bayi bulunamadı." }, 404);
        }
      }

      return json({ ok: true });
    } finally {
      client.release();
    }
  } catch (error) {
    const status =
      error && typeof error === "object" && "status" in error
        ? Number((error as any).status) || 500
        : 500;

    return json(
      { ok: false, error: error instanceof Error ? error.message : "Hata" },
      status
    );
  }
}
