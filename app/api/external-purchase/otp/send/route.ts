import { NextRequest, NextResponse } from "next/server";

import {
  ensureExternalPurchaseOtpTable,
  externalPurchasePool,
  generateOtpCode,
  hashOtpCode,
  normalizePhone,
  requireExternalPurchaseActor,
  sendExternalPurchaseOtpSms,
} from "@/app/lib/external-purchase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function noStore(
  body: Record<string, unknown>,
  status = 200
) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}

// ======================================================
// "ÖDEME TALEBİ GÖNDER" ÖNCESİ DOĞRULAMA KODU GÖNDERİMİ
// POST /api/external-purchase/otp/send
// ======================================================

export async function POST(
  request: NextRequest
) {
  const client =
    await externalPurchasePool.connect();

  try {
    const actor =
      await requireExternalPurchaseActor(
        request,
        client
      );

    const body = await request.json();

    const phone = normalizePhone(body?.phone);

    if (phone.length < 10) {
      return noStore(
        {
          success: false,
          message: "Telefon numarası geçersiz.",
        },
        400
      );
    }

    await ensureExternalPurchaseOtpTable(client);

    // --------------------------------------------------
    // HIZ SINIRLAMASI
    // Aynı numaraya 10 dakikada en fazla 3 kod.
    // --------------------------------------------------

    const recentResult = await client.query(
      `
        SELECT COUNT(*)::int AS count
        FROM public.external_purchase_otp_codes
        WHERE phone = $1
          AND created_at > NOW() - INTERVAL '10 minutes'
      `,
      [phone]
    );

    if ((recentResult.rows[0]?.count || 0) >= 3) {
      return noStore(
        {
          success: false,
          message:
            "Çok fazla doğrulama kodu istendi. Lütfen birkaç dakika sonra tekrar deneyin.",
        },
        429
      );
    }

    // Kod sabit onay numarasına gidebildiği için, müşteri numarasını
    // değiştirerek limit aşılamasın: kullanıcı başına da sınır.
    const recentByActor = await client.query(
      `
        SELECT COUNT(*)::int AS count
        FROM public.external_purchase_otp_codes
        WHERE actor_user_id = $1
          AND created_at > NOW() - INTERVAL '10 minutes'
      `,
      [actor.userId]
    );

    if ((recentByActor.rows[0]?.count || 0) >= 5) {
      return noStore(
        {
          success: false,
          message:
            "Çok fazla doğrulama kodu istendi. Lütfen birkaç dakika sonra tekrar deneyin.",
        },
        429
      );
    }

    const code = generateOtpCode();
    const codeHash = hashOtpCode(phone, code);

    const smsResult = await sendExternalPurchaseOtpSms(
      phone,
      code
    );

    if (!smsResult.ok) {
      return noStore(
        {
          success: false,
          message: smsResult.skipped
            ? "SMS servisi yapılandırılmamış."
            : "Doğrulama kodu gönderilemedi, lütfen tekrar deneyin.",
        },
        502
      );
    }

    await client.query(
      `
        INSERT INTO public.external_purchase_otp_codes (
          phone,
          code_hash,
          actor_user_id,
          expires_at
        )
        VALUES ($1, $2, $3, NOW() + INTERVAL '5 minutes')
      `,
      [phone, codeHash, actor.userId]
    );

    return noStore({
      success: true,
      toApprover: Boolean(smsResult.toApprover),
    });
  } catch (error: any) {
    const status = Number(error?.status) || 500;

    return noStore(
      {
        success: false,
        message:
          status === 401
            ? "Oturum bulunamadı."
            : "Doğrulama kodu gönderilemedi.",
      },
      status
    );
  } finally {
    client.release();
  }
}
