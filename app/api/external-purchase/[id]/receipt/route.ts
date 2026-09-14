import { NextRequest, NextResponse } from "next/server";

import {
  externalPurchasePool,
  isOwnerOrManager,
  requireExternalPurchaseActor,
} from "@/app/lib/external-purchase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const MAX_FILE_SIZE =
  5 * 1024 * 1024;

const ALLOWED_TYPES =
  new Set([
    "application/pdf",
    "image/jpeg",
    "image/png",
  ]);

function json(
  body: Record<string, unknown>,
  status = 200
) {
  return NextResponse.json(
    body,
    {
      status,
      headers: {
        "Cache-Control":
          "no-store, max-age=0",
      },
    }
  );
}

// ======================================================
// DEKONT YÜKLE
//
// POST
// /api/external-purchase/:id/receipt
//
// FormData:
// file
//
// SADECE:
// yonetici / super_admin
// ======================================================

export async function POST(
  request: NextRequest,
  context: {
    params:
      Promise<{
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

    const formData =
      await request.formData();

    const file =
      formData.get(
        "file"
      );

    if (
      !(file instanceof File)
    ) {
      return json(
        {
          success: false,
          message:
            "Dekont dosyası seçilmedi.",
        },
        400
      );
    }

    // ==================================================
    // DOSYA TÜRÜ
    // ==================================================

    if (
      !ALLOWED_TYPES.has(
        file.type
      )
    ) {
      return json(
        {
          success: false,
          message:
            "Dekont sadece PDF, JPG veya PNG olabilir.",
        },
        400
      );
    }

    // ==================================================
    // DOSYA BOYUTU
    // ==================================================

    if (
      file.size <= 0 ||
      file.size >
        MAX_FILE_SIZE
    ) {
      return json(
        {
          success: false,
          message:
            "Dekont en fazla 5 MB olabilir.",
        },
        400
      );
    }

    // ==================================================
    // İŞLEM VAR MI?
    // ==================================================

    const purchaseResult =
      await client.query(
        `
          SELECT
            id,
            status

          FROM public.external_purchase_requests

          WHERE id = $1

          LIMIT 1
        `,
        [
          requestId,
        ]
      );

    const purchase =
      purchaseResult.rows[0];

    if (
      !purchase
    ) {
      return json(
        {
          success: false,
          message:
            "Ödeme talebi bulunamadı.",
        },
        404
      );
    }

    if (
      purchase.status ===
      "CANCELLED"
    ) {
      return json(
        {
          success: false,
          message:
            "İptal edilmiş işleme dekont yüklenemez.",
        },
        409
      );
    }

    // ==================================================
    // BUFFER
    // ==================================================

    const arrayBuffer =
      await file.arrayBuffer();

    const buffer =
      Buffer.from(
        arrayBuffer
      );

    // ==================================================
    // TRANSACTION
    // ==================================================

    await client.query(
      "BEGIN"
    );

    transactionStarted =
      true;

    // ==================================================
    // DEKONT
    //
    // request_id UNIQUE olduğu için
    // aynı işleme yeni dekont yüklenirse
    // eskisinin üzerine yazar.
    // ==================================================

    await client.query(
      `
        INSERT INTO public.external_purchase_receipts (
          request_id,

          original_name,
          mime_type,
          file_size,
          file_data,

          uploaded_by_user_id,
          uploaded_at
        )

        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          NOW()
        )

        ON CONFLICT (request_id)

        DO UPDATE SET
          original_name =
            EXCLUDED.original_name,

          mime_type =
            EXCLUDED.mime_type,

          file_size =
            EXCLUDED.file_size,

          file_data =
            EXCLUDED.file_data,

          uploaded_by_user_id =
            EXCLUDED.uploaded_by_user_id,

          uploaded_at =
            NOW()
      `,
      [
        requestId,

        file.name ||
          "dekont",

        file.type,

        file.size,

        buffer,

        actor.userId,
      ]
    );

    // ==================================================
    // EVENT
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

          'RECEIPT_UPLOADED',

          $2,
          $3,
          $4,

          $5,

          NOW()
        )
      `,
      [
        requestId,

        actor.userId,

        actor.accessRole,

        actor.branch,

        `Dekont yüklendi: ${
          file.name ||
          "dekont"
        }`,
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
        "Dekont başarıyla yüklendi.",

      receipt: {
        requestId,

        fileName:
          file.name,

        mimeType:
          file.type,

        fileSize:
          file.size,
      },
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
      "EXTERNAL PURCHASE RECEIPT UPLOAD ERROR:",
      error
    );

    return json(
      {
        success: false,

        message:
          error?.message ||
          "Dekont yüklenemedi.",
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
// DEKONT GÖR / İNDİR
//
// GET
// /api/external-purchase/:id/receipt
//
// Gör:
// /receipt
//
// İndir:
// /receipt?download=1
//
// Yönetici:
// tüm dekontlar
//
// Normal kullanıcı:
// sadece kendi işleminin dekontu
// ======================================================

export async function GET(
  request: NextRequest,
  context: {
    params:
      Promise<{
        id: string;
      }>;
  }
) {
  try {
    const actor =
      await requireExternalPurchaseActor(
        request
      );

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
    // ÖNCE İŞLEMİ BUL
    // ==================================================

    const purchaseResult =
      await externalPurchasePool.query(
        `
          SELECT
            id,
            source_user_id

          FROM public.external_purchase_requests

          WHERE id = $1

          LIMIT 1
        `,
        [
          requestId,
        ]
      );

    const purchase =
      purchaseResult.rows[0];

    if (
      !purchase
    ) {
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
    // YETKİ
    // ==================================================

    if (
      !isOwnerOrManager(
        actor,
        purchase
      )
    ) {
      return json(
        {
          success: false,
          message:
            "Bu dekonta erişim yetkiniz yok.",
        },
        403
      );
    }

    // ==================================================
    // DEKONT
    // ==================================================

    const receiptResult =
      await externalPurchasePool.query(
        `
          SELECT
            original_name,
            mime_type,
            file_size,
            file_data,
            uploaded_at

          FROM public.external_purchase_receipts

          WHERE request_id = $1

          LIMIT 1
        `,
        [
          requestId,
        ]
      );

    const receipt =
      receiptResult.rows[0];

    if (
      !receipt
    ) {
      return json(
        {
          success: false,
          message:
            "Bu işleme ait dekont bulunamadı.",
        },
        404
      );
    }

    // ==================================================
    // DOWNLOAD?
    // ==================================================

    const download =
      request.nextUrl.searchParams.get(
        "download"
      ) === "1";

    const safeName =
      String(
        receipt.original_name ||
        "dekont"
      )
        .replace(
          /[\r\n"]/g,
          "_"
        )
        .slice(
          0,
          180
        );

    return new NextResponse(
      receipt.file_data,
      {
        status: 200,

        headers: {
          "Content-Type":
            receipt.mime_type ||
            "application/octet-stream",

          "Content-Length":
            String(
              receipt.file_size
            ),

          "Content-Disposition":
            `${
              download
                ? "attachment"
                : "inline"
            }; filename="${safeName}"`,

          "Cache-Control":
            "private, no-store, max-age=0",

          "X-Content-Type-Options":
            "nosniff",
        },
      }
    );
  } catch (
    error: any
  ) {
    console.error(
      "EXTERNAL PURCHASE RECEIPT GET ERROR:",
      error
    );

    return json(
      {
        success: false,

        message:
          error?.message ||
          "Dekont alınamadı.",
      },
      Number(
        error?.status
      ) || 500
    );
  }
}
