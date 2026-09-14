import { NextRequest, NextResponse } from "next/server";

import {
  externalPurchasePool,
  formatTry,
  requireExternalPurchaseActor,
  sendExternalPurchaseTelegram,
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
// DURUM GÜNCELLE
//
// POST
// /api/external-purchase/:id/status
//
// Body:
// {
//   "action": "PAID"
// }
//
// veya:
//
// {
//   "action": "CANCELLED"
// }
//
// SADECE:
// yonetici / super_admin
// ======================================================

export async function POST(
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
    // ==================================================
    // OTURUM / YETKİ
    // ==================================================

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

    // ==================================================
    // ID
    // ==================================================

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

    // ==================================================
    // ACTION
    // ==================================================

    const body =
      await request.json();

    const action =
      String(
        body?.action || ""
      )
        .trim()
        .toUpperCase();

    if (
      action !== "PAID" &&
      action !== "CANCELLED"
    ) {
      return json(
        {
          success: false,
          message:
            "Geçersiz işlem durumu.",
        },
        400
      );
    }

    // ==================================================
    // TRANSACTION
    // ==================================================

    await client.query(
      "BEGIN"
    );

    transactionStarted =
      true;

    // ==================================================
    // KAYDI KİLİTLE
    // ==================================================

    const rowResult =
      await client.query(
        `
          SELECT
            r.id,
            r.request_no,

            r.device_name,
            r.amount,

            r.customer_first_name,
            r.customer_last_name,

            r.source_branch,

            r.status,

            EXISTS (
              SELECT 1
              FROM public.external_purchase_receipts rec
              WHERE rec.request_id = r.id
            ) AS has_receipt

          FROM public.external_purchase_requests r

          WHERE r.id = $1

          FOR UPDATE
        `,
        [
          requestId,
        ]
      );

    const row =
      rowResult.rows[0];

    if (
      !row
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

    // ==================================================
    // ZATEN AYNI DURUMDA
    // ==================================================

    if (
      row.status === action
    ) {
      await client.query(
        "ROLLBACK"
      );

      transactionStarted =
        false;

      return json({
        success: true,

        status:
          row.status,

        message:
          action === "PAID"
            ? "Bu ödeme zaten tamamlanmış."
            : "Bu işlem zaten iptal edilmiş.",
      });
    }

    // ==================================================
    // ÖDENMİŞ İŞLEM İPTAL EDİLEMEZ
    // ==================================================

    if (
      row.status ===
        "PAID" &&
      action ===
        "CANCELLED"
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
            "Ödemesi yapılmış işlem iptal edilemez.",
        },
        409
      );
    }

    // ==================================================
    // İPTAL EDİLMİŞ İŞLEM ÖDENEMEZ
    // ==================================================

    if (
      row.status ===
        "CANCELLED" &&
      action ===
        "PAID"
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
            "İptal edilmiş işlem ödeme yapılmış olarak işaretlenemez.",
        },
        409
      );
    }

    // ==================================================
    // PAID İÇİN DEKONT ZORUNLU
    // ==================================================

    if (
      action ===
        "PAID" &&
      !row.has_receipt
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
            "Ödeme tamamlanmadan önce dekont yüklenmelidir.",
        },
        409
      );
    }

    // ==================================================
    // ÖDEME TAMAMLANDI
    // ==================================================

    if (
      action ===
      "PAID"
    ) {
      await client.query(
        `
          UPDATE public.external_purchase_requests

          SET
            status =
              'PAID',

            paid_at =
              NOW(),

            paid_by_user_id =
              $2,

            updated_at =
              NOW()

          WHERE id = $1
        `,
        [
          requestId,
          actor.userId,
        ]
      );

      await client.query(
        `
          INSERT INTO public.external_purchase_events (
            request_id,

            event_type,

            actor_user_id,
            actor_role,
            actor_branch,

            note,

            created_at
          )

          VALUES (
            $1,

            'PAYMENT_COMPLETED',

            $2,
            $3,
            $4,

            'Ödeme yapıldı ve işlem tamamlandı.',

            NOW()
          )
        `,
        [
          requestId,

          actor.userId,

          actor.accessRole,

          actor.branch,
        ]
      );
    }

    // ==================================================
    // İPTAL
    // ==================================================

    if (
      action ===
      "CANCELLED"
    ) {
      await client.query(
        `
          UPDATE public.external_purchase_requests

          SET
            status =
              'CANCELLED',

            cancelled_at =
              NOW(),

            cancelled_by_user_id =
              $2,

            updated_at =
              NOW()

          WHERE id = $1
        `,
        [
          requestId,
          actor.userId,
        ]
      );

      await client.query(
        `
          INSERT INTO public.external_purchase_events (
            request_id,

            event_type,

            actor_user_id,
            actor_role,
            actor_branch,

            note,

            created_at
          )

          VALUES (
            $1,

            'REQUEST_CANCELLED',

            $2,
            $3,
            $4,

            'Ödeme talebi iptal edildi.',

            NOW()
          )
        `,
        [
          requestId,

          actor.userId,

          actor.accessRole,

          actor.branch,
        ]
      );
    }

    // ==================================================
    // COMMIT
    // ==================================================

    await client.query(
      "COMMIT"
    );

    transactionStarted =
      false;

    // ==================================================
    // TELEGRAM
    // ==================================================

    try {
      if (
        action ===
        "PAID"
      ) {
        await sendExternalPurchaseTelegram(
          [
            "✅ CNETMOBİL - DIŞ KANAL ÖDEMESİ TAMAMLANDI",
            "",
            `🧾 Talep No: ${row.request_no}`,
            "",
            `📱 Cihaz: ${row.device_name}`,
            `💰 Tutar: ${formatTry(
              row.amount
            )}`,
            "",
            `👤 Müşteri: ${row.customer_first_name} ${row.customer_last_name}`,
            `🏪 Kanal / Şube: ${row.source_branch}`,
            "",
            "🟢 DURUM: ÖDEME YAPILDI",
            "",
            "📎 Dekont sisteme yüklenmiştir.",
          ].join("\n")
        );
      }

      if (
        action ===
        "CANCELLED"
      ) {
        await sendExternalPurchaseTelegram(
          [
            "❌ CNETMOBİL - DIŞ KANAL ÖDEME TALEBİ İPTAL",
            "",
            `🧾 Talep No: ${row.request_no}`,
            "",
            `📱 Cihaz: ${row.device_name}`,
            `💰 Tutar: ${formatTry(
              row.amount
            )}`,
            "",
            `👤 Müşteri: ${row.customer_first_name} ${row.customer_last_name}`,
            `🏪 Kanal / Şube: ${row.source_branch}`,
            "",
            "🔴 DURUM: İPTAL EDİLDİ",
          ].join("\n")
        );
      }
    } catch (
      telegramError
    ) {
      console.error(
        "EXTERNAL PURCHASE STATUS TELEGRAM ERROR:",
        telegramError
      );
    }

    // ==================================================
    // RESPONSE
    // ==================================================

    return json({
      success: true,

      id:
        requestId,

      requestNo:
        row.request_no,

      status:
        action,

      message:
        action ===
        "PAID"
          ? "Ödeme başarıyla tamamlandı."
          : "Ödeme talebi iptal edildi.",
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
      "EXTERNAL PURCHASE STATUS ERROR:",
      error
    );

    return json(
      {
        success: false,

        message:
          error?.message ||
          "İşlem durumu güncellenemedi.",
      },
      Number(
        error?.status
      ) || 500
    );
  } finally {
    client.release();
  }
}
