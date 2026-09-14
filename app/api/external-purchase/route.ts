import { NextRequest, NextResponse } from "next/server";

import {
  decryptSensitive,
  encryptSensitive,
  externalPurchasePool,
  formatTry,
  maskPhone,
  normalizeIban,
  normalizePhone,
  normalizeTc,
  parseMoney,
  requireExternalPurchaseActor,
  sendExternalPurchaseTelegram,
} from "@/app/lib/external-purchase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

// ======================================================
// RESPONSE
// ======================================================

function noStore(
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
// YENİ ÖDEME TALEBİ
// POST /api/external-purchase
// ======================================================

export async function POST(
  request: NextRequest
) {
  const client =
    await externalPurchasePool.connect();

  try {
    // --------------------------------------------------
    // OTURUM / KULLANICI
    // --------------------------------------------------

    const actor =
      await requireExternalPurchaseActor(
        request,
        client
      );

    const body =
      await request.json();

    // --------------------------------------------------
    // CİHAZ
    // --------------------------------------------------

    const deviceName =
      String(
        body?.deviceName || ""
      ).trim();

    const amount =
      parseMoney(
        body?.amount
      );

    // --------------------------------------------------
    // MÜŞTERİ
    // --------------------------------------------------

    const firstName =
      String(
        body?.firstName || ""
      ).trim();

    const lastName =
      String(
        body?.lastName || ""
      ).trim();

    const tc =
      normalizeTc(
        body?.tc
      );

    const phone =
      normalizePhone(
        body?.phone
      );

    const iban =
      normalizeIban(
        body?.iban
      );

    const ibanHolder =
      String(
        body?.ibanHolder || ""
      ).trim();

    // ==================================================
    // VALIDATION
    // ==================================================

    if (
      !deviceName ||
      deviceName.length > 300
    ) {
      return noStore(
        {
          success: false,
          message:
            "Cihaz bilgisi geçersiz.",
        },
        400
      );
    }

    if (
      !amount ||
      amount <= 0 ||
      amount >
        50_000_000
    ) {
      return noStore(
        {
          success: false,
          message:
            "Cihaz tutarı geçersiz.",
        },
        400
      );
    }

    if (
      !firstName ||
      !lastName
    ) {
      return noStore(
        {
          success: false,
          message:
            "Müşteri ad ve soyadı gereklidir.",
        },
        400
      );
    }

    if (
      firstName.length > 100 ||
      lastName.length > 100
    ) {
      return noStore(
        {
          success: false,
          message:
            "Müşteri adı veya soyadı çok uzun.",
        },
        400
      );
    }

    if (
      tc.length !== 11
    ) {
      return noStore(
        {
          success: false,
          message:
            "T.C. Kimlik No 11 haneli olmalıdır.",
        },
        400
      );
    }

    if (
      phone.length < 10
    ) {
      return noStore(
        {
          success: false,
          message:
            "Telefon numarası geçersiz.",
        },
        400
      );
    }

    // Türkiye IBAN:
    // TR + 24 rakam = toplam 26 karakter
    if (
      !/^TR\d{24}$/.test(
        iban
      )
    ) {
      return noStore(
        {
          success: false,
          message:
            "Geçerli bir TR IBAN giriniz.",
        },
        400
      );
    }

    if (
      !ibanHolder ||
      ibanHolder.length > 200
    ) {
      return noStore(
        {
          success: false,
          message:
            "IBAN sahibi adı gereklidir.",
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

    // --------------------------------------------------
    // YENİ İŞLEM
    //
    // DİKKAT:
    // device_name UNIQUE DEĞİL.
    // AYNI CİHAZA SINIRSIZ İŞLEM AÇILABİLİR.
    // --------------------------------------------------

    const insertResult =
      await client.query(
        `
          INSERT INTO public.external_purchase_requests (
            source_user_id,
            source_user_email,
            source_branch,

            device_name,
            amount,

            customer_first_name,
            customer_last_name,

            customer_tc_enc,
            customer_phone,

            customer_iban_enc,
            iban_holder_enc,

            status,

            created_at,
            updated_at
          )
          VALUES (
            $1,
            $2,
            $3,

            $4,
            $5,

            $6,
            $7,

            $8,
            $9,

            $10,
            $11,

            'PAYMENT_PENDING',

            NOW(),
            NOW()
          )
          RETURNING
            id,
            created_at
        `,
        [
          actor.userId,
          actor.email,
          actor.branch,

          deviceName,
          amount,

          firstName,
          lastName,

          encryptSensitive(
            tc
          ),

          phone,

          encryptSensitive(
            iban
          ),

          encryptSensitive(
            ibanHolder
          ),
        ]
      );

    const inserted =
      insertResult.rows[0];

    const id =
      Number(
        inserted.id
      );

    // ==================================================
    // DK NUMARASI
    // ÖRN:
    // DK-20260914-000125
    // ==================================================

    const datePart =
      new Date(
        inserted.created_at
      )
        .toISOString()
        .slice(
          0,
          10
        )
        .replace(
          /-/g,
          ""
        );

    const requestNo =
      `DK-${datePart}-${String(
        id
      ).padStart(
        6,
        "0"
      )}`;

    await client.query(
      `
        UPDATE public.external_purchase_requests

        SET
          request_no = $1,
          updated_at = NOW()

        WHERE id = $2
      `,
      [
        requestNo,
        id,
      ]
    );

    // ==================================================
    // EVENT / LOG
    // ==================================================

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
          'REQUEST_CREATED',

          $2,
          $3,
          $4,

          $5,

          NOW()
        )
      `,
      [
        id,

        actor.userId,
        actor.accessRole,
        actor.branch,

        "Dış kanal ödeme talebi oluşturuldu.",
      ]
    );

    await client.query(
      "COMMIT"
    );

    // ==================================================
    // TELEGRAM
    //
    // DB kaydı başarılı olduktan sonra gönderilir.
    // Telegram hata verirse müşteri işlemi kaybolmaz.
    //
    // TC VE IBAN TELEGRAM'A GİTMEZ.
    // ==================================================

    try {
      const telegramMessage =
        [
          "💳 CNETMOBİL - YENİ DIŞ KANAL ÖDEME TALEBİ",
          "",
          `🧾 Talep No: ${requestNo}`,
          "",
          `📱 Cihaz: ${deviceName}`,
          `💰 Tutar: ${formatTry(
            amount
          )}`,
          "",
          `👤 Müşteri: ${firstName} ${lastName}`,
          `📞 Telefon: ${maskPhone(
            phone
          )}`,
          "",
          `🏪 Kanal / Şube: ${actor.branch}`,
          actor.email
            ? `👨‍💼 Oluşturan: ${actor.email}`
            : "",
          "",
          "🟠 DURUM: ÖDEME SIRAYA ALINDI",
          "",
          "⚠️ TC ve IBAN bilgileri güvenlik nedeniyle Telegram mesajına eklenmemiştir.",
        ]
          .filter(
            Boolean
          )
          .join(
            "\n"
          );

      await sendExternalPurchaseTelegram(
        telegramMessage
      );
    } catch (
      telegramError
    ) {
      console.error(
        "EXTERNAL PURCHASE TELEGRAM ERROR:",
        telegramError
      );
    }

    // ==================================================
    // RESPONSE
    // ==================================================

    return noStore(
      {
        success: true,

        message:
          "Ödeme talebi sıraya alındı.",

        request: {
          id,

          requestNo,

          deviceName,

          amount,

          status:
            "PAYMENT_PENDING",

          branch:
            actor.branch,

          createdAt:
            inserted.created_at,
        },
      },
      201
    );
  } catch (
    error: any
  ) {
    // Transaction açılmışsa rollback.
    try {
      await client.query(
        "ROLLBACK"
      );
    } catch {}

    console.error(
      "EXTERNAL PURCHASE CREATE ERROR:",
      error
    );

    return noStore(
      {
        success: false,

        message:
          error?.message ||
          "Ödeme talebi oluşturulamadı.",
      },
      Number(
        error?.status
      ) || 500
    );
  } finally {
    client.release();
  }
}

// ======================================================
// ÖDEME TALEPLERİNİ LİSTELE
//
// GET /api/external-purchase
//
// PERSONEL:
// sadece kendi oluşturduğu kayıtlar
//
// YÖNETİCİ / SUPER ADMIN:
// tüm kayıtlar
//
// Filtre örneği:
// /api/external-purchase?status=PAYMENT_PENDING
// ======================================================

export async function GET(
  request: NextRequest
) {
  try {
    const actor =
      await requireExternalPurchaseActor(
        request
      );

    const requestedStatus =
      String(
        request.nextUrl.searchParams.get(
          "status"
        ) || ""
      )
        .trim()
        .toUpperCase();

    const allowedStatuses =
      new Set([
        "PAYMENT_PENDING",
        "PAID",
        "CANCELLED",
      ]);

    const values:
      any[] = [];

    const conditions:
      string[] = [];

    // ==================================================
    // NORMAL KULLANICI SADECE KENDİ İŞLEMLERİ
    // ==================================================

    if (
      !actor.canManagePayments
    ) {
      if (
        !actor.userId
      ) {
        return noStore(
          {
            success: false,
            message:
              "Bu kullanıcı için işlem geçmişi görüntülenemiyor.",
          },
          403
        );
      }

      values.push(
        actor.userId
      );

      conditions.push(
        `r.source_user_id = $${values.length}`
      );
    }

    // ==================================================
    // DURUM FİLTRESİ
    // ==================================================

    if (
      requestedStatus &&
      allowedStatuses.has(
        requestedStatus
      )
    ) {
      values.push(
        requestedStatus
      );

      conditions.push(
        `r.status = $${values.length}`
      );
    }

    const whereSql =
      conditions.length
        ? `WHERE ${conditions.join(
            " AND "
          )}`
        : "";

    const result =
      await externalPurchasePool.query(
        `
          SELECT
            r.id,
            r.request_no,

            r.source_user_id,
            r.source_user_email,
            r.source_branch,

            r.device_name,
            r.amount,

            r.customer_first_name,
            r.customer_last_name,

            r.customer_tc_enc,
            r.customer_phone,

            r.customer_iban_enc,
            r.iban_holder_enc,

            r.status,

            r.created_at,
            r.updated_at,

            r.paid_at,
            r.paid_by_user_id,

            r.cancelled_at,
            r.cancelled_by_user_id,

            EXISTS (
              SELECT 1

              FROM public.external_purchase_receipts rec

              WHERE rec.request_id = r.id
            ) AS has_receipt

          FROM public.external_purchase_requests r

          ${whereSql}

          ORDER BY
            CASE
              WHEN r.status = 'PAYMENT_PENDING'
                THEN 1

              WHEN r.status = 'PAID'
                THEN 2

              ELSE 3
            END,

            r.created_at DESC

          LIMIT 500
        `,
        values
      );

    // ==================================================
    // HASSAS VERİLER SADECE YETKİLİ OTURUMA AÇILIR.
    // Normal kullanıcı da kendi işlemi olduğu için kendi
    // müşteri bilgisini görebilir.
    // ==================================================

    const requests =
      result.rows.map(
        (
          row
        ) => ({
          id:
            Number(
              row.id
            ),

          requestNo:
            row.request_no,

          branch:
            row.source_branch,

          sourceUserEmail:
            actor.canManagePayments
              ? row.source_user_email
              : undefined,

          deviceName:
            row.device_name,

          amount:
            Number(
              row.amount
            ),

          customer: {
            firstName:
              row.customer_first_name,

            lastName:
              row.customer_last_name,

            tc:
              decryptSensitive(
                row.customer_tc_enc
              ),

            phone:
              row.customer_phone,

            iban:
              decryptSensitive(
                row.customer_iban_enc
              ),

            ibanHolder:
              decryptSensitive(
                row.iban_holder_enc
              ),
          },

          status:
            row.status,

          hasReceipt:
            Boolean(
              row.has_receipt
            ),

          createdAt:
            row.created_at,

          updatedAt:
            row.updated_at,

          paidAt:
            row.paid_at,

          cancelledAt:
            row.cancelled_at,
        })
      );

    // ==================================================
    // ÖZET
    // ==================================================

    const pendingRequests =
      requests.filter(
        (
          item
        ) =>
          item.status ===
          "PAYMENT_PENDING"
      );

    const paidRequests =
      requests.filter(
        (
          item
        ) =>
          item.status ===
          "PAID"
      );

    const pendingAmount =
      pendingRequests.reduce(
        (
          total,
          item
        ) =>
          total +
          Number(
            item.amount ||
              0
          ),
        0
      );

    const paidAmount =
      paidRequests.reduce(
        (
          total,
          item
        ) =>
          total +
          Number(
            item.amount ||
              0
          ),
        0
      );

    return noStore({
      success: true,

      canManagePayments:
        actor.canManagePayments,

      accessRole:
        actor.accessRole,

      branch:
        actor.branch,

      summary: {
        total:
          requests.length,

        pending:
          pendingRequests.length,

        paid:
          paidRequests.length,

        pendingAmount,

        paidAmount,
      },

      requests,
    });
  } catch (
    error: any
  ) {
    console.error(
      "EXTERNAL PURCHASE LIST ERROR:",
      error
    );

    return noStore(
      {
        success: false,

        message:
          error?.message ||
          "Ödeme talepleri alınamadı.",
      },
      Number(
        error?.status
      ) || 500
    );
  }
}
