// app/lib/idefix/stock.ts
//
// CNETMOBIL - İdefix stok KAPATMA (oturumsuz, cron/arka plan çağrısı için)
//
// Bir cihaz başka kanalda (WingSM mağaza satışı ya da N11) satıldığında, aynı IMEI'nin
// İdefix'teki TEKLİ ilanını stok=0'a çeker. Tekli ilan = create-device ile açılan, stok kodu
// "CNET-IDF-<IMEI>" olan ilan (raw_data.sourceImei = IMEI). Aynı barkodda birden çok IMEI
// tutan grup ilanlarına DOKUNULMAZ (İdefix stoğu ürün bazlıdır, hangi IMEI'nin satıldığı
// bilinemez).
//
// Yazma akışı variant-stock route'uyla aynıdır: inventory-upload -> inventory-result -> canlı
// inventory/list ile stoğun gerçekten 0 olduğunu doğrulama. Doğrulanamazsa hata atılır
// (kuyruk tekrar dener).

import type { Pool } from "pg";

import { getIdefixVendorId, idefixFetch } from "./server";

const text = (value: unknown) => String(value ?? "").trim();

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const idefixStockCodeForImei = (imei: string) => `CNET-IDF-${imei}`;

// Sipariş kaleminden (merchantSku) IMEI çıkarır: "CNET-IDF-<15 hane>" ya da içinde 15 haneli sayı.
export function imeiFromIdefixSku(sku: unknown): string | null {
  const match = text(sku).match(/(?:^|[^0-9])(\d{15})(?![0-9])/);

  return match ? match[1] : null;
}

async function inventoryRow(barcode: string) {
  const vendorId = getIdefixVendorId();
  const payload = await idefixFetch(`/pim/catalog/${encodeURIComponent(vendorId)}/inventory/list`);
  const rows =
    payload?.items ?? payload?.products ?? payload?.data?.items ?? payload?.data?.products ?? [];

  return (Array.isArray(rows) ? rows : []).find((row: any) => text(row?.barcode) === barcode) ?? null;
}

async function waitBatch(batchId: string, barcode: string) {
  const vendorId = getIdefixVendorId();

  for (let attempt = 0; attempt < 8; attempt += 1) {
    if (attempt > 0) await sleep(700);

    const result = await idefixFetch(
      `/pim/catalog/${encodeURIComponent(vendorId)}/inventory-result/${encodeURIComponent(batchId)}`
    );
    const items = Array.isArray(result?.items) ? result.items : [];
    const item = items.find((row: any) => text(row?.barcode) === barcode) || items[0] || null;
    const itemStatus = text(item?.status).toUpperCase();
    const batchStatus = text(result?.status).toUpperCase().replace(/[\s-]+/g, "_");

    if (itemStatus === "DECLINE" || batchStatus === "FAILED") {
      const failure = JSON.stringify(item?.failureReasons || item || result);

      // Ürün İdefix'te hiç yoksa satışta da değildir; doğrulama adımı bunu kontrol eder.
      if (failure.toUpperCase().includes("PRODUCT_NOT_FOUND")) return { productNotFound: true };

      throw new Error(`İdefix stok güncellemesi reddedildi: ${failure}`);
    }

    if (itemStatus === "COMPLETED" || batchStatus === "COMPLETED" || batchStatus === "COMPLETED_SUCCESS") {
      return { productNotFound: false };
    }
  }

  throw new Error(`İdefix inventory-result tamamlanmadı. Batch: ${batchId}`);
}

export type IdefixZeroResult = {
  status: "ZEROED" | "ALREADY_ZERO" | "ALREADY_ABSENT";
  batchRequestId?: string;
};

// Barkodlu ürünün İdefix stoğunu 0 yapar ve canlıdan doğrular. Hata atar (sessiz geçmez).
export async function zeroIdefixInventory(barcode: string): Promise<IdefixZeroResult> {
  const code = text(barcode);

  if (!code) throw new Error("İdefix barkodu boş.");

  const before = await inventoryRow(code);

  if (!before) return { status: "ALREADY_ABSENT" };
  if (Number(before.inventoryQuantity ?? 0) === 0) return { status: "ALREADY_ZERO" };

  const price = Number(before.price);

  if (!Number.isFinite(price) || price <= 0) throw new Error("İdefix canlı satış fiyatı bulunamadı.");

  const comparePrice = Number(before.comparePrice);
  const vendorId = getIdefixVendorId();

  const upload = await idefixFetch(`/pim/catalog/${encodeURIComponent(vendorId)}/inventory-upload`, {
    method: "POST",
    body: {
      items: [
        {
          barcode: code,
          price,
          comparePrice: Number.isFinite(comparePrice) && comparePrice > 0 ? comparePrice : price,
          inventoryQuantity: 0,
          maximumPurchasableQuantity: 1,
          deliveryDuration: Number(before.deliveryDuration ?? 1) || 1,
          deliveryType: text(before.deliveryType) || "regular",
          isZoneSale: null,
        },
      ],
    },
  });

  const batchRequestId = text(upload?.batchRequestId);

  if (!batchRequestId) throw new Error("İdefix inventory-upload batchRequestId döndürmedi.");

  await waitBatch(batchRequestId, code);

  for (let attempt = 0; attempt < 8; attempt += 1) {
    if (attempt > 0) await sleep(750);

    const live = await inventoryRow(code);

    if (!live || Number(live.inventoryQuantity ?? 0) === 0) {
      return { status: "ZEROED", batchRequestId };
    }
  }

  throw new Error(`İdefix stoğu 0 olarak doğrulanamadı (barkod ${code}).`);
}

export type IdefixCloseResult = {
  status: "ZEROED" | "ALREADY_ZERO" | "ALREADY_ABSENT" | "NO_LISTING";
  listingIds: number[];
};

// IMEI'nin İdefix TEKLİ ilanını kapatır. Tekli ilan yoksa NO_LISTING döner (hata değil).
export async function closeIdefixForImei(pool: Pool, imei: string): Promise<IdefixCloseResult> {
  const clean = text(imei);

  const listings = await pool.query(
    `
      SELECT id, external_variant_id
      FROM public.online_listings
      WHERE channel = 'IDEFIX'
        AND (external_stock_code = $1 OR raw_data ->> 'sourceImei' = $2)
    `,
    [idefixStockCodeForImei(clean), clean]
  );

  if (listings.rows.length === 0) return { status: "NO_LISTING", listingIds: [] };

  let status: IdefixCloseResult["status"] = "ALREADY_ABSENT";
  const listingIds: number[] = [];

  for (const listing of listings.rows) {
    const result = await zeroIdefixInventory(text(listing.external_variant_id));

    if (result.status === "ZEROED") status = "ZEROED";
    else if (status !== "ZEROED") status = result.status;

    await pool.query(
      `
        UPDATE public.online_listings
        SET quantity = 0,
            raw_data = COALESCE(raw_data, '{}'::jsonb) || $2::jsonb,
            updated_at = now()
        WHERE id = $1
      `,
      [Number(listing.id), JSON.stringify({ autoClosedAt: new Date().toISOString(), autoClosedResult: result.status })]
    );

    listingIds.push(Number(listing.id));
  }

  await markIdefixMembershipPassive(pool, clean, "AUTO_CLOSE");

  return { status, listingIds };
}

// Merkezi IMEI stok ekranındaki İdefix rozeti için üyeliği pasife alır (tablo/satır yoksa sessiz geçer).
export async function markIdefixMembershipPassive(pool: Pool, imei: string, source: string) {
  try {
    await pool.query(
      `
        UPDATE public.online_channel_devices
        SET membership_status = 'PASSIVE',
            metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb,
            updated_at = now()
        WHERE imei = $1
          AND channel = 'IDEFIX'
          AND UPPER(COALESCE(membership_status, '')) IN ('LISTED', 'RESERVED', 'PENDING_CREATE')
      `,
      [imei, JSON.stringify({ soldAt: new Date().toISOString(), source })]
    );
  } catch (error) {
    console.error("IDEFIX_MEMBERSHIP_PASSIVE_ERROR:", imei, error instanceof Error ? error.message : error);
  }
}
