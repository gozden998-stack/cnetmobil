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

    const products = poolProducts.map((product) => {
      const barcode = text(product?.barcode);
      const inventory = barcode
        ? inventoryByBarcode.get(barcode) || null
        : null;

      const state = normalizeState(
        product?.status ?? product?.state
      );

      // inventory-list satışa alınmış ürünlerin güncel stok/fiyat kaynağıdır.
      // Orada kayıt varsa onu esas al; yoksa pool bilgisini teşhis amaçlı koru.
      const stock = Number(
        inventory?.inventoryQuantity ??
          product?.inventoryQuantity ??
          0
      );

      const price = Number(
        inventory?.price ??
          product?.price ??
          0
      );

      const comparePrice = Number(
        inventory?.comparePrice ??
          product?.comparePrice ??
          price
      );

      const saleOpen =
        state === "ready_for_sale" &&
        Number.isFinite(stock) &&
        stock > 0;

      return {
        ...product,
        state,
        status: state,
        inventoryQuantity:
          Number.isFinite(stock) ? stock : 0,
        price:
          Number.isFinite(price) ? price : 0,
        comparePrice:
          Number.isFinite(comparePrice) ? comparePrice : 0,
        saleOpen,
        saleStatus: stateLabel(
          state,
          saleOpen,
          Number.isFinite(stock) ? stock : 0
        ),
        liveInventoryFound: Boolean(inventory),
      };
    });

    const openCount = products.filter(
      (product) => product.saleOpen === true
    ).length;

    const closedCount = products.length - openCount;

    const pendingCount = products.filter((product) =>
      [
        "waiting_catalog_action",
        "waiting_vendor_approve",
        "not_matched",
        "auto_matched",
        "manual_matched",
      ].includes(product.state)
    ).length;

    const declinedCount = products.filter((product) =>
      [
        "vendor_declined",
        "platform_declined",
        "missing_info",
      ].includes(product.state)
    ).length;

    return noStoreJson({
      success: true,
      connected: true,
      readOnly: true,
      channel: "IDEFIX",
      vendorId,
      totalCount: products.length,
      openCount,
      closedCount,
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
