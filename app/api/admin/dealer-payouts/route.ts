// app/api/admin/dealer-payouts/route.ts
//
// Her bayinin biriken kar payi bakiyesini gosterir (odenen
// siparislerin toplam commission_amount'i - simdiye kadar yapilan
// odemeler) ve yeni bir odeme (banka havalesi) kaydeder.
//
// Paratika parayi otomatik BOLMEZ - tum tutar bize gelir, bayiye
// kar payini biz ayri olarak (manuel) odüyoruz. Bu endpoint sadece
// o odemenin KAYDINI tutar, gercek havaleyi YAPMAZ.

import { NextRequest, NextResponse } from "next/server";

import { getAuctionSession } from "../../auctions/_server";
import { ensureDealerTables, getDealerPool } from "@/app/lib/dealer/server";

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
          SELECT
            d.id AS dealer_id,
            d.company_name,
            d.email,
            COALESCE(SUM(o.commission_amount) FILTER (
              WHERE o.status IN ('PAID', 'PREPARING', 'SHIPPED')
            ), 0) AS earned_commission,
            COALESCE((
              SELECT SUM(p.amount) FROM public.dealer_payouts p WHERE p.dealer_id = d.id
            ), 0) AS paid_out
          FROM public.dealers d
          LEFT JOIN public.dealer_orders o ON o.dealer_id = d.id
          GROUP BY d.id, d.company_name, d.email
          ORDER BY d.company_name ASC
        `
      );

      const balances = result.rows.map((row) => {
        const earned = Number(row.earned_commission);
        const paidOut = Number(row.paid_out);

        return {
          dealerId: Number(row.dealer_id),
          companyName: String(row.company_name),
          email: String(row.email),
          earnedCommission: earned,
          paidOut,
          outstandingBalance: Math.round((earned - paidOut) * 100) / 100,
        };
      });

      return json({ ok: true, balances });
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
    const dealerId = Number((body as any)?.dealerId);
    const amount = Number((body as any)?.amount);
    const note = String((body as any)?.note || "").trim();

    if (!Number.isInteger(dealerId) || dealerId <= 0) {
      return json({ ok: false, error: "Geçersiz bayi." }, 400);
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      return json({ ok: false, error: "Geçerli bir tutar girin." }, 400);
    }

    const pool = getDealerPool();
    const client = await pool.connect();

    try {
      await ensureDealerTables(client);

      const dealerCheck = await client.query(
        `SELECT id FROM public.dealers WHERE id = $1 LIMIT 1`,
        [dealerId]
      );

      if (!dealerCheck.rowCount) {
        return json({ ok: false, error: "Bayi bulunamadı." }, 404);
      }

      await client.query(
        `
          INSERT INTO public.dealer_payouts (dealer_id, amount, note, paid_by_user_key)
          VALUES ($1, $2, $3, $4)
        `,
        [dealerId, Math.round(amount * 100) / 100, note || null, session.userKey]
      );

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
