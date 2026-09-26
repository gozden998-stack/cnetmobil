// app/api/admin/dealers/route.ts
//
// "Bayi Portali" - yonetici bayi hesabi acar/listeler. Bayiler
// KENDI KENDINE KAYIT OLAMAZ - guvenlik/dogrulama nedeniyle sadece
// yonetici elle hesap acar.

import { NextRequest, NextResponse } from "next/server";

import { getAuctionSession } from "../../auctions/_server";
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

export async function GET(request: NextRequest) {
  try {
    const session = await getAuctionSession(request);
    ensureManager(session);

    const pool = getDealerPool();
    const client = await pool.connect();

    try {
      await ensureDealerTables(client);

      const result = await client.query(
        `
          SELECT id, company_name, email, contact_phone, is_active,
                 created_at, last_login_at
          FROM public.dealers
          ORDER BY company_name ASC
        `
      );

      const dealers = result.rows.map((row) => ({
        id: Number(row.id),
        companyName: String(row.company_name),
        email: String(row.email),
        contactPhone: row.contact_phone ? String(row.contact_phone) : "",
        isActive: Boolean(row.is_active),
        createdAt: row.created_at,
        lastLoginAt: row.last_login_at,
      }));

      return json({ ok: true, dealers });
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

export async function POST(request: NextRequest) {
  try {
    const session = await getAuctionSession(request);
    ensureManager(session);

    const body = await request.json().catch(() => null);

    const companyName = String((body as any)?.companyName || "").trim();
    const email = String((body as any)?.email || "")
      .trim()
      .toLowerCase();
    const password = String((body as any)?.password || "");
    const contactPhone = String((body as any)?.contactPhone || "").trim();

    if (!companyName || companyName.length > 200) {
      return json({ ok: false, error: "Firma adı geçersiz." }, 400);
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ ok: false, error: "Geçerli bir e-posta girin." }, 400);
    }

    if (!password || password.length < 8) {
      return json(
        { ok: false, error: "Şifre en az 8 karakter olmalıdır." },
        400
      );
    }

    const pool = getDealerPool();
    const client = await pool.connect();

    try {
      await ensureDealerTables(client);

      const existing = await client.query(
        `SELECT id FROM public.dealers WHERE LOWER(email) = $1 LIMIT 1`,
        [email]
      );

      if (existing.rowCount) {
        return json(
          { ok: false, error: "Bu e-posta ile zaten bir bayi kayıtlı." },
          409
        );
      }

      const passwordHash = await hashDealerPassword(password);

      const result = await client.query(
        `
          INSERT INTO public.dealers (company_name, email, password_hash, contact_phone)
          VALUES ($1, $2, $3, $4)
          RETURNING id
        `,
        [companyName, email, passwordHash, contactPhone || null]
      );

      return json({ ok: true, id: Number(result.rows[0].id) });
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
