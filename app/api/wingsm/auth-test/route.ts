// app/api/wingsm/auth-test/route.ts

import {
  clearWingSMToken,
  getWingSMConfigStatus,
  getWingSMToken,
} from "../../../lib/wingsm/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const config =
      getWingSMConfigStatus();

    if (!config.configured) {
      return Response.json(
        {
          success: false,
          connected: false,
          error:
            "WingSM ENV ayarları eksik.",
        },
        {
          status: 500,
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );
    }

    // Eski cache token varsa kullanmayalım.
    // Gerçek authenticate testi yapıyoruz.
    clearWingSMToken();

    const startedAt =
      Date.now();

    const token =
      await getWingSMToken(true);

    const durationMs =
      Date.now() - startedAt;

    return Response.json(
      {
        success: true,
        connected: true,

        authenticate:
          "SUCCESS",

        tokenReceived:
          Boolean(token),

        tokenLength:
          token.length,

        durationMs,

        message:
          "WingSM authenticate başarılı. Coolify IP erişimi ve kullanıcı bilgileri çalışıyor.",
      },
      {
        headers: {
          "Cache-Control":
            "no-store, max-age=0",
        },
      }
    );
  } catch (error: any) {
    console.error(
      "WINGSM_AUTH_TEST_ERROR:",
      {
        message:
          error?.message,
      }
    );

    return Response.json(
      {
        success: false,
        connected: false,

        authenticate:
          "FAILED",

        error:
          error?.message ||
          "WingSM bağlantısı kurulamadı.",

        message:
          "Bu test herhangi bir stok veya transfer kaydını değiştirmedi.",
      },
      {
        status: 502,
        headers: {
          "Cache-Control":
            "no-store",
        },
      }
    );
  }
}
