import { NextRequest, NextResponse } from "next/server";

import {
  externalPurchasePool,
  requireExternalPurchaseActor,
} from "@/app/lib/external-purchase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function json(
  body: Record<string, unknown>,
  status = 200
) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control":
        "no-store, max-age=0",
    },
  });
}

// ======================================================
// ÖDEME TALEBİNİ SİL
//
// DELETE
// /api/external-purchase/:id
//
// SADECE:
// yonetici / super_admin
//
// Kalıcı silme - dekont ve olay kayıtları da birlikte gider.
// ======================================================

export async function DELETE(
  request: NextRequest,
  context: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  const client =
    await externalPurchasePool.connect();

  let transactionStarted =
    false;

  try {
    const actor =
      await requireExternalPurchaseActor(
        request,
        client
      );

    if (
      !actor.canManagePayments
    ) {
      return json(
        {
          success: false,
          message:
            "Bu işlem için yönetici yetkisi gerekli.",
        },
        403
      );
    }

    const params =
      await context.params;

    const requestId =
      Number(
        params.id
      );

    if (
      !Number.isInteger(
        requestId
      ) ||
      requestId <= 0
    ) {
      return json(
        {
          success: false,
          message:
            "Geçersiz işlem numarası.",
        },
        400
      );
    }

    await client.query(
      "BEGIN"
    );

    transactionStarted =
      true;

    const existingResult =
      await client.query(
        `
          SELECT id, request_no
          FROM public.external_purchase_requests
          WHERE id = $1
          FOR UPDATE
        `,
        [
          requestId,
        ]
      );

    const existing =
      existingResult.rows[0];

    if (
      !existing
    ) {
      await client.query(
        "ROLLBACK"
      );

      transactionStarted =
        false;

      return json(
        {
          success: false,
          message:
            "Ödeme talebi bulunamadı.",
        },
        404
      );
    }

    await client.query(
      `
        DELETE FROM public.external_purchase_receipts
        WHERE request_id = $1
      `,
      [
        requestId,
      ]
    );

    await client.query(
      `
        DELETE FROM public.external_purchase_events
        WHERE request_id = $1
      `,
      [
        requestId,
      ]
    );

    await client.query(
      `
        DELETE FROM public.external_purchase_requests
        WHERE id = $1
      `,
      [
        requestId,
      ]
    );

    await client.query(
      "COMMIT"
    );

    transactionStarted =
      false;

    return json({
      success: true,

      message:
        "Ödeme talebi silindi.",

      id:
        requestId,

      requestNo:
        existing.request_no,
    });
  } catch (
    error: any
  ) {
    if (
      transactionStarted
    ) {
      try {
        await client.query(
          "ROLLBACK"
        );
      } catch {}
    }

    console.error(
      "EXTERNAL PURCHASE DELETE ERROR:",
      error
    );

    return json(
      {
        success: false,

        message:
          error?.message ||
          "Ödeme talebi silinemedi.",
      },
      Number(
        error?.status
      ) || 500
    );
  } finally {
    client.release();
  }
}
