// app/api/online/idefix/products/route.ts
// CNETMOBIL - IDEFIX CANLI URUN / DURUM / STOK
// READ ONLY
//
// Kaynaklar:
// 1) /pim/pool/{vendorId}/list            -> gerçek ürün statüsü
// 2) /pim/catalog/{vendorId}/inventory/list -> güncel stok/fiyat
//
// Panelde "Satışa Açık" kararı sadece stok > 0'a göre verilmez.
// İdefix ürün statüsü READY_FOR_SALE + satılabilir stok > 0 olmalıdır.

import { NextRequest } from "next/server";
import {
  IDEFIX_BASE_URL,
  getIdefixProducts,
  getIdefixVendorId,
  getIdefixVendorToken,
  noStoreJson,
  requireIdefixSuperAdmin,
} from "@/app/lib/idefix/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function asArray(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

function text(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeState(value: unknown) {
  return text(value)
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
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

function productKey(product: any) {
  return [
    text(product?.barcode),
    text(product?.vendorStockCode),
    text(product?.productMainId),
  ].join("|");
}

function stateLabel(state: string, saleOpen: boolean, stock: number) {
  if (saleOpen) return "Yayında";

  if (state === "ready_for_sale" && stock <= 0) {
    return "Stok Yok";
  }

  const labels: Record<string, string> = {
    waiting_catalog_action: "Katalog İncelemesinde",
    waiting_vendor_approve: "Satıcı Onayı Bekliyor",
    vendor_declined: "Satıcı Tarafından Reddedildi",
    missing_info: "Eksik Bilgi",
    platform_declined: "İdefix Tarafından Reddedildi",
    not_matched: "Eşleşme Bekliyor",
    auto_matched: "Otomatik Eşleşti",
    manual_matched: "Manuel Eşleşti",
  };

  return labels[state] || (state ? state : "Kapalı");
}

async function fetchAllPoolProducts() {
  const all: any[] = [];
  const seen = new Set<string>();
  const limit = 50;

  for (let page = 1; page <= 100; page += 1) {
    const payload: any = await getIdefixProducts(page, limit);
    const products = pickProducts(payload);

    if (products.length === 0) break;

    for (const product of products) {
      const key = productKey(product);
      if (seen.has(key)) continue;
      seen.add(key);
      all.push(product);
    }

    if (products.length < limit) break;
  }

  return all;
}

async function fetchInventoryList(vendorId: string) {
  const token = getIdefixVendorToken();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 35_000);

  try {
    const response = await fetch(
      `${IDEFIX_BASE_URL}/pim/catalog/${encodeURIComponent(
        vendorId
      )}/inventory/list`,
      {
        method: "GET",
        cache: "no-store",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-API-KEY": token,
        },
        signal: controller.signal,
      }
    );

    const raw = await response.text();

    let payload: any = null;

    if (raw) {
      try {
        payload = JSON.parse(raw);
      } catch {
        payload = { raw };
      }
    }

    if (!response.ok) {
      throw new Error(
        `İdefix inventory-list HTTP ${response.status}: ${
          text(payload?.message) ||
          text(payload?.error) ||
          raw ||
          "Cevap boş."
        }`
      );
    }

    return asArray(
      payload?.items ??
        payload?.products ??
        payload?.data?.items ??
        payload?.data?.products
    );
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET(request: NextRequest) {
  const authError = await requireIdefixSuperAdmin(request);
  if (authError) return authError;

  try {
    const vendorId = getIdefixVendorId();

    // Önce ürün statülerini, sonra gerçek inventory bilgisini çekiyoruz.
    // Biri hata verirse diğerini yanlış "yayında" göstermek yerine hata döndürürüz.
    const poolProducts = await fetchAllPoolProducts();
    const inventoryItems = await fetchInventoryList(vendorId);

    const inventoryByBarcode = new Map<string, any>();

    for (const item of inventoryItems) {
      const barcode = text(item?.barcode);
      if (!barcode) continue;
      inventoryByBarcode.set(barcode, item);
    }

    // KRİTİK:
    // /pim/pool list içerisindeki inventoryQuantity ve price,
    // ürün ilk gönderildiği sıradaki değerler olabilir. Bunları CANLI stok/fiyat
    // kabul etmiyoruz.
    //
    // Merchant Center "Ürünlerim" tarafına karşılık gelen ana ürün listesi:
    // pool status = ready_for_sale olan ürünler.
    //
    // Gerçek CANLI stok/fiyat:
    // yalnızca inventory-list cevabından gelir.
    //
    // inventory-list'te barkod yoksa stok = 0 kabul edilir.
    // Böylece pool'daki eski "2 adet" değeri yanlışlıkla satışta gösterilmez.
    const readyPoolProducts = poolProducts.filter(
      (product) =>
        normalizeState(product?.status ?? product?.state) ===
        "ready_for_sale"
    );

    const pendingPoolProducts = poolProducts.filter((product) =>
      [
        "waiting_catalog_action",
        "waiting_vendor_approve",
        "not_matched",
        "auto_matched",
        "manual_matched",
      ].includes(
        normalizeState(product?.status ?? product?.state)
      )
    );

    const declinedPoolProducts = poolProducts.filter((product) =>
      [
        "vendor_declined",
        "platform_declined",
        "missing_info",
      ].includes(
        normalizeState(product?.status ?? product?.state)
      )
    );

    const products = readyPoolProducts.map((product) => {
      const barcode = text(product?.barcode);

      const inventory = barcode
        ? inventoryByBarcode.get(barcode) || null
        : null;

      // CANLI değerlerde pool fallback YOK.
      const stock = Number(
        inventory?.inventoryQuantity ?? 0
      );

      const price = Number(
        inventory?.price ?? 0
      );

      const comparePrice = Number(
        inventory?.comparePrice ??
          inventory?.price ??
          0
      );

      const liveStock =
        Number.isFinite(stock) && stock > 0
          ? stock
          : 0;

      const livePrice =
        Number.isFinite(price) && price > 0
          ? price
          : 0;

      const liveComparePrice =
        Number.isFinite(comparePrice) && comparePrice > 0
          ? comparePrice
          : livePrice;

      const saleOpen =
        Boolean(inventory) &&
        liveStock > 0;

      return {
        ...product,

        // Pool statüsü katalog/satışa hazır olma statüsüdür.
        state: "ready_for_sale",
        status: "ready_for_sale",

        // Aşağıdaki üç alan sadece inventory-list'ten gelir.
        inventoryQuantity: liveStock,
        price: livePrice,
        comparePrice: liveComparePrice,

        saleOpen,
        saleStatus: saleOpen
          ? "Yayında"
          : "Satışa Kapalı",
        liveInventoryFound: Boolean(inventory),

        // Teşhis için pool'un eski değerlerini ayrıca tutuyoruz;
        // panel bunları stok/fiyat olarak kullanmaz.
        poolInventoryQuantity:
          Number(product?.inventoryQuantity ?? 0) || 0,
        poolPrice:
          Number(product?.price ?? 0) || 0,
        poolComparePrice:
          Number(product?.comparePrice ?? 0) || 0,
      };
    });

    const openCount = products.filter(
      (product) => product.saleOpen === true
    ).length;

    const closedCount =
      products.length - openCount;

    const pendingCount =
      pendingPoolProducts.length;

    const declinedCount =
      declinedPoolProducts.length;

    const physicalStock = products.reduce(
      (sum, product) =>
        sum +
        Math.max(
          0,
          Number(product.inventoryQuantity || 0)
        ),
      0
    );

    return noStoreJson({
      success: true,
      connected: true,
      readOnly: true,
      channel: "IDEFIX",
      vendorId,

      // Merchant Center ana sayaçlarına karşılık gelen değerler.
      totalCount: products.length,
      openCount,
      closedCount,
      physicalStock,

      // Havuz teşhisi.
      poolCount: poolProducts.length,
      readyForSalePoolCount: readyPoolProducts.length,
      pendingCount,
      declinedCount,
      inventoryItemCount: inventoryItems.length,

      products,
      checkedAt: new Date().toISOString(),
    });
  } catch (error: any) {
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
