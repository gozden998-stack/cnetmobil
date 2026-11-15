// app/api/online/hepsiburada/orders/route.ts
//
// CNETMOBIL - Hepsiburada açık (ödemesi tamamlanmış) siparişler (SALT OKUNUR)
// GET ?offset=0&limit=50  -> Open statüsündeki sipariş kalemlerini döndürür.
// Müşteri bilgisi (ad, adres, telefon, e-posta, vergi/fatura) bilerek ELENİR; sadece ürün/sipariş alanları gelir.
// Hiçbir şey yazılmaz/paketlenmez. SADECE YÖNETİCİ.

import { NextRequest } from "next/server";

import { json, requireAdminSession } from "@/app/api/wingsm/score-rules/_shared";
import { HEPSIBURADA_ORDERS_BASE, getHepsiburadaConfig, hepsiburadaFetch } from "@/app/lib/hepsiburada/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const PII = /customer|address|phone|mail|tax|invoice|receiver|recipient|buyer|name$|surname|identity|city|district|town|zip|postal|cargo.*address/i;
// "productName" ürün adıdır (kişi adı değil), PII süzgecinden ayrıca izin verilir.
const ALLOW = /^(productName|name)$/i;

function safeItem(item: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(item).filter(([key, value]) => (ALLOW.test(key) || !PII.test(key)) && (value === null || typeof value !== "object"))
  );
}

export async function GET(request: NextRequest) {
  const auth = requireAdminSession(request);

  if (!auth.ok) return auth.response;

  if (!getHepsiburadaConfig()) return json({ success: false, error: "Hepsiburada ortam değişkenleri eksik." }, 200);

  const params = request.nextUrl.searchParams;
  const offset = Math.max(0, Math.trunc(Number(params.get("offset")) || 0));
  const limit = Math.min(100, Math.max(1, Math.trunc(Number(params.get("limit")) || 50)));

  try {
    const result = await hepsiburadaFetch(HEPSIBURADA_ORDERS_BASE, "/orders/merchantid/{merchantId}", { query: { offset, limit } });

    if (!result.ok) {
      return json({ success: false, status: result.status, error: `Hepsiburada HTTP ${result.status}: ${result.raw.slice(0, 300)}` }, 200);
    }

    const items: any[] = Array.isArray(result.body?.items) ? result.body.items : [];

    return json({
      success: true,
      totalCount: Number(result.body?.totalCount ?? items.length),
      offset,
      limit,
      rows: items.map((item) => safeItem(item)),
    });
  } catch (error) {
    return json({ success: false, error: error instanceof Error ? error.message : "Hepsiburada siparişleri alınamadı." }, 200);
  }
}
