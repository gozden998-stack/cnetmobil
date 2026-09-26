// app/api/dealer-auth/route.ts
//
// "Bayi Portali" giris/oturum. Personel girisinden (app/api/auth)
// TAMAMEN AYRI - ayri cookie (cnet_dealer_auth), ayri tablo (dealers).

import { NextRequest, NextResponse } from "next/server";

import {
  DEALER_AUTH_COOKIE,
  apiError,
  createDealerSessionToken,
  ensureDealerTables,
  getDealerPool,
  requireDealerActor,
  verifyDealerPassword,
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);

    const email = String((body as any)?.email || "")
      .trim()
      .toLowerCase();

    const password = String((body as any)?.password || "");

    if (!email || !password) {
      return json({ ok: false, error: "E-posta ve şifre gerekli." }, 400);
    }

    const pool = getDealerPool();
    const client = await pool.connect();

    try {
      await ensureDealerTables(client);

      const result = await client.query(
        `
          SELECT id, company_name, email, password_hash, is_active
          FROM public.dealers
          WHERE LOWER(email) = $1
          LIMIT 1
        `,
        [email]
      );

      const dealer = result.rows[0];

      if (!dealer || !dealer.is_active) {
        return json(
          { ok: false, error: "E-posta veya şifre hatalı." },
          401
        );
      }

      const passwordOk = await verifyDealerPassword(
        password,
        dealer.password_hash
      );

      if (!passwordOk) {
        return json(
          { ok: false, error: "E-posta veya şifre hatalı." },
          401
        );
      }

      await client.query(
        `UPDATE public.dealers SET last_login_at = NOW() WHERE id = $1`,
        [dealer.id]
      );

      const { token, maxAge } = createDealerSessionToken(Number(dealer.id));

      const response = json({
        ok: true,
        companyName: dealer.company_name,
        email: dealer.email,
      });

      response.cookies.set({
        name: DEALER_AUTH_COOKIE,
        value: token,
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/",
        maxAge,
      });

      return response;
    } finally {
      client.release();
    }
  } catch (error) {
    const { status, message } = apiError(error);
    return json({ ok: false, error: message }, status);
  }
}

export async function GET(request: NextRequest) {
  try {
    const actor = await requireDealerActor(request);

    return json({
      ok: true,
      dealerId: actor.dealerId,
      companyName: actor.companyName,
      email: actor.email,
    });
  } catch (error) {
    const { status, message } = apiError(error);
    return json({ ok: false, error: message }, status);
  }
}

export async function DELETE() {
  const response = json({ ok: true });

  response.cookies.set({
    name: DEALER_AUTH_COOKIE,
    value: "",
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return response;
}
