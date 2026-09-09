// app/api/online/idefix/health/route.ts
// CNETMOBIL - IDEFIX ADIM 1
//
// READ ONLY BAGLANTI TESTI
//
// Bu route:
// - Idefix API baglantisini test eder
// - urun olusturmaz
// - fiyat degistirmez
// - stok degistirmez
// - siparis degistirmez
// - N11'e dokunmaz
// - IKAS'a dokunmaz
// - Merkez stoklarina dokunmaz

import {
  NextRequest,
} from "next/server";

import {
  getIdefixProducts,
  getIdefixVendorId,
  noStoreJson,
  requireIdefixSuperAdmin,
} from "@/app/lib/idefix/server";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

export const revalidate =
  0;

export async function GET(
  request: NextRequest
) {
  const authError =
    await requireIdefixSuperAdmin(
      request
    );

  if (authError) {
    return authError;
  }

  const startedAt =
    Date.now();

  try {
    const vendorId =
      getIdefixVendorId();

    const payload =
      await getIdefixProducts(
        1,
        1
      );

    const products =
      Array.isArray(
        payload?.products
      )
        ? payload.products
        : [];

    const firstProduct =
      products[0] ??
      null;

    return noStoreJson({
      success: true,

      connected: true,

      channel:
        "IDEFIX",

      message:
        "İdefix API bağlantısı başarılı.",

      vendorId,

      responseTimeMs:
        Date.now() -
        startedAt,

      productCountInResponse:
        products.length,

      firstProduct:
        firstProduct
          ? {
              barcode:
                firstProduct
                  ?.barcode ??
                null,

              title:
                firstProduct
                  ?.title ??
                null,

              productMainId:
                firstProduct
                  ?.productMainId ??
                null,

              brandId:
                firstProduct
                  ?.brandId ??
                null,

              categoryId:
                firstProduct
                  ?.categoryId ??
                null,

              inventoryQuantity:
                firstProduct
                  ?.inventoryQuantity ??
                null,

              state:
                firstProduct
                  ?.state ??
                null,
            }
          : null,

      checkedAt:
        new Date()
          .toISOString(),
    });
  } catch (error) {
    console.error(
      "[IDEFIX HEALTH]",
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : "İdefix API bağlantısı kurulamadı.";

    return noStoreJson(
      {
        success: false,

        connected: false,

        channel:
          "IDEFIX",

        error:
          message,

        responseTimeMs:
          Date.now() -
          startedAt,

        checkedAt:
          new Date()
            .toISOString(),
      },
      500
    );
  }
}
