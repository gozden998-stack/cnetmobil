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
  HEPSIBURADA_CATALOG_BASE,
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
        // Alan adlarını görmek için ilk satırın tüm anahtarları ve (kısaltılmış) ham hali.
        rowKeys: rows[0] ? Object.keys(rows[0]) : [],
        firstRowRaw: rows[0] ? JSON.stringify(rows[0]).slice(0, 700) : null,
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
        rowKeys: rows[0] ? Object.keys(rows[0]) : [],
        // Kişisel veri (ad, adres, telefon) sızmasın diye ham satırdan yalnızca ürün ile ilgili alanlar alınır.
        firstRowProduct: rows[0]
          ? Object.fromEntries(
              Object.entries(rows[0]).filter(([key]) => /sku|barcode|product|name|quantity|status|price|listing|id$/i.test(key) && !/customer|address|phone|mail|tax|invoice/i.test(key))
            )
          : null,
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

  // ?catalog=1: ürün (katalog) servisinden ürün adının gelip gelmediğini dener (ilk 3 ürün, salt okunur).
  if (request.nextUrl.searchParams.get("catalog") === "1") {
    try {
      // ?hbsku=HB... verilirse katalogda yalnız o ürün sorgulanır (listing'de olup toplu katalog listesinde görünmeyenler için).
      const hbSku = String(request.nextUrl.searchParams.get("hbsku") ?? "").trim();
      const catalog = await hepsiburadaFetch(HEPSIBURADA_CATALOG_BASE, "/api/products/all-products-of-merchant/{merchantId}", {
        query: hbSku ? { page: 0, size: 3, hbSku } : { page: 0, size: 3 },
      });
      const rows: any[] = Array.isArray(catalog.body?.data) ? catalog.body.data : Array.isArray(catalog.body?.content) ? catalog.body.content : Array.isArray(catalog.body) ? catalog.body : [];

      result.catalog = {
        host: HEPSIBURADA_CATALOG_BASE,
        status: catalog.status,
        ok: catalog.ok,
        totalElements: catalog.body?.totalElements ?? null,
        queriedHbSku: hbSku || null,
        firstProductName: rows[0]?.productName ?? null,
        topLevelKeys: catalog.body && typeof catalog.body === "object" && !Array.isArray(catalog.body) ? Object.keys(catalog.body).slice(0, 15) : null,
        rowKeys: rows[0] ? Object.keys(rows[0]).slice(0, 40) : [],
        firstRowRaw: rows[0] ? JSON.stringify(rows[0]).slice(0, 900) : catalog.raw.slice(0, 400),
      };
    } catch (error) {
      result.catalog = { error: error instanceof Error ? error.message : String(error) };
    }
  }

  return json(result);
}
