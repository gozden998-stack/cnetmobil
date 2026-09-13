// app/api/wingsm/ip/route.ts

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const response = await fetch(
      "https://api.ipify.org?format=json",
      {
        cache: "no-store",
        signal: AbortSignal.timeout(10000),
      }
    );

    if (!response.ok) {
      throw new Error(
        `IP servisi hata verdi. HTTP ${response.status}`
      );
    }

    const data = await response.json();

    const ip =
      typeof data?.ip === "string"
        ? data.ip.trim()
        : "";

    if (!ip) {
      throw new Error(
        "Coolify çıkış IP'si alınamadı."
      );
    }

    return Response.json(
      {
        success: true,
        outboundIp: ip,
        message:
          "Bu IP WingSM erişim iznine eklenmelidir.",
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch (error: any) {
    return Response.json(
      {
        success: false,
        error:
          error?.message ||
          "Sunucu çıkış IP'si alınamadı.",
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }
}
