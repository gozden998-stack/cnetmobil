// app/api/online/idefix/products/route.ts
// CNETMOBIL - IDEFIX URUN LISTESI
// READ ONLY

import { NextRequest } from "next/server";
import {
  getIdefixProducts,
  getIdefixVendorId,
  noStoreJson,
  requireIdefixSuperAdmin,
} from "@/app/lib/idefix/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function asArray(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

function pickProducts(payload: any): any[] {
  return asArray(
    payload?.products ??
      payload?.items ??
      payload?.content ??
      payload?.data?.products ??
      payload?.data?.items ??
      payload?.data?.content
  );
}

function pickTotal(payload: any, fallback: number) {
  const candidates = [
    payload?.totalCount,
    payload?.total,
    payload?.itemCount,
    payload?.data?.totalCount,
    payload?.data?.total,
    payload?.data?.itemCount,
  ];

  for (const value of candidates) {
    const number = Number(value);
    if (Number.isFinite(number) && number >= 0) return number;
  }

  return fallback;
}

export async function GET(request: NextRequest) {
  const authError = await requireIdefixSuperAdmin(request);
  if (authError) return authError;

  try {
    const vendorId = getIdefixVendorId();

    // İlk aşamada read-only tek çağrı.
    // İdefix hesabındaki ürünleri panelde göstermek için kullanılır.
    const payload: any = await getIdefixProducts(1, 100);
    const products = pickProducts(payload);

    return noStoreJson({
      success: true,
      connected: true,
      readOnly: true,
      channel: "IDEFIX",
      vendorId,
      totalCount: pickTotal(payload, products.length),
      products,
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[IDEFIX PRODUCTS]", error);

    return noStoreJson(
      {
        success: false,
        connected: false,
        readOnly: true,
        channel: "IDEFIX",
        error:
          error instanceof Error
            ? error.message
            : "İdefix ürün listesi alınamadı.",
        checkedAt: new Date().toISOString(),
      },
      500
    );
  }
}
