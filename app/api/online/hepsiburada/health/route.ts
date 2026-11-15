// app/api/online/hepsiburada/health/route.ts
//
// CNETMOBIL - Hepsiburada bağlantı KONTROLÜ (salt okunur)
//
// Ortam değişkenlerinin tanımlı olup olmadığını (değerleri göstermeden) ve servis anahtarıyla Hepsiburada'ya
// bağlanılıp bağlanılamadığını gösterir. Sadece GET isteği atar: ilk 5 listing ve ilk 5 açık sipariş.
// Hiçbir şey yazılmaz/güncellenmez. Anahtar/şifre hiçbir cevaba yazılmaz.
// SADECE YÖNETİCİ.

import { NextRequest } from "next/server";

import { json, requireAdminSession } from "@/app/api/wingsm/score-rules/_shared";
import {
  HEPSIBURADA_LISTING_BASE,
  HEPSIBURADA_ORDERS_BASE,
  getHepsiburadaConfig,
  hepsiburadaEnvStatus,
  hepsiburadaFetch,
} from "@/app/lib/hepsiburada/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function brief(result: { status: number; ok: boolean; body: any; raw: string }, pick: (body: any) => unknown) {
  return {
    status: result.status,
    ok: result.ok,
    sample: result.ok ? pick(result.body) : null,
    // Hata cevabının ilk kısmı (anahtar içermez); yetki/adres sorunlarını teşhis için.
    detail: result.ok ? null : result.raw.slice(0, 400),
    topLevelKeys: result.body && typeof result.body === "object" && !Array.isArray(result.body) ? Object.keys(result.body).slice(0, 15) : null,
  };
}

export async function GET(request: NextRequest) {
  const auth = requireAdminSession(request);

  if (!auth.ok) return auth.response;

  const env = hepsiburadaEnvStatus();

  if (!getHepsiburadaConfig()) {
    return json({ success: false, env, error: "Ortam değişkenleri eksik. Coolify'da üç değişkeni de tanımlayıp uygulamayı yeniden başlatın." }, 200);
  }

  const result: Record<string, unknown> = { success: true, env, hosts: { listing: HEPSIBURADA_LISTING_BASE, orders: HEPSIBURADA_ORDERS_BASE } };

  try {
    const listings = await hepsiburadaFetch(HEPSIBURADA_LISTING_BASE, "/listings/merchantid/{merchantId}", { query: { offset: 0, limit: 5 } });

    result.listings = brief(listings, (body) => {
      const rows: any[] = Array.isArray(body?.listings) ? body.listings : Array.isArray(body) ? body : [];

      return {
        totalCount: body?.totalCount ?? body?.total ?? null,
        rows: rows.slice(0, 5).map((row) => ({
          hepsiburadaSku: row?.hepsiburadaSku ?? row?.HepsiburadaSku ?? null,
          merchantSku: row?.merchantSku ?? row?.MerchantSku ?? null,
          availableStock: row?.availableStock ?? row?.AvailableStock ?? null,
          price: row?.price ?? row?.Price ?? null,
          isSalable: row?.isSalable ?? row?.IsSalable ?? null,
        })),
      };
    });
  } catch (error) {
    result.listings = { error: error instanceof Error ? error.message : String(error) };
  }

  try {
    const orders = await hepsiburadaFetch(HEPSIBURADA_ORDERS_BASE, "/orders/merchantid/{merchantId}", { query: { offset: 0, limit: 5 } });

    result.orders = brief(orders, (body) => {
      const rows: any[] = Array.isArray(body?.items) ? body.items : Array.isArray(body) ? body : [];

      return {
        totalCount: body?.totalCount ?? body?.total ?? null,
        rows: rows.slice(0, 5).map((row) => ({
          orderNumber: row?.orderNumber ?? null,
          status: row?.status ?? null,
          quantity: row?.quantity ?? null,
          merchantSku: row?.merchantSku ?? null,
          productName: row?.productName ?? row?.name ?? null,
        })),
      };
    });
  } catch (error) {
    result.orders = { error: error instanceof Error ? error.message : String(error) };
  }

  return json(result);
}
