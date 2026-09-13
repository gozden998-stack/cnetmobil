// app/api/wingsm/status/route.ts

import {
  getWingSMConfigStatus,
} from "../../../lib/wingsm/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const status =
      getWingSMConfigStatus();

    return Response.json(
      {
        success: true,

        integration: "WingSM",

        configured:
          status.configured,

        environment: {
          baseUrl:
            status.hasBaseUrl,

          user:
            status.hasUser,

          password:
            status.hasPassword,
        },

        depots:
          status.depots,

        liveConnectionTested:
          false,

        message:
          status.configured
            ? "WingSM ayarları hazır. Canlı bağlantı testi henüz yapılmadı."
            : "WingSM ENV ayarları henüz tamamlanmadı.",
      },
      {
        status: 200,

        headers: {
          "Cache-Control":
            "no-store, max-age=0",

          Pragma:
            "no-cache",
        },
      }
    );
  } catch (error: any) {
    console.error(
      "WINGSM_STATUS_ERROR:",
      {
        message:
          error?.message,

        stack:
          error?.stack,
      }
    );

    return Response.json(
      {
        success: false,

        error:
          error?.message ||
          "WingSM durum bilgisi alınamadı.",
      },
      {
        status: 500,

        headers: {
          "Cache-Control":
            "no-store, max-age=0",
        },
      }
    );
  }
}
