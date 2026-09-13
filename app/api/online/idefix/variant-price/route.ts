// app/api/online/idefix/variant-price/route.ts
// CNETMOBIL - IDEFIX CANLI FIYAT GUNCELLEME
//
// Panelden tek bir Idefix barkodunun satis/liste fiyatini gunceller.
// - inventory-upload ile yazar.
// - Mevcut canli stok adedini aynen korur.
// - inventory-result ile batch sonucunu dogrular.
// - inventory-list ile GERCEK canli fiyati tekrar okuyup dogrular.
// - Yerel online_listings kaydi varsa sale_price/list_price alanlarini gunceller.

import {
  NextRequest,
} from "next/server";

import {
  IDEFIX_BASE_URL,
  getIdefixDbPool,
  getIdefixVendorId,
  getIdefixVendorToken,
  noStoreJson,
  requireIdefixSuperAdmin,
} from "@/app/lib/idefix/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function text(value: unknown) {
  return String(value ?? "").trim();
}

function parseMoney(value: unknown) {
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error("Fiyat 0'dan buyuk olmalidir.");
    }

    return Math.round(value * 100) / 100;
  }

  let raw = text(value)
    .replace(/₺/g, "")
    .replace(/\s+/g, "");

  if (!raw) {
    throw new Error("Fiyat zorunludur.");
  }

  const lastComma = raw.lastIndexOf(",");
  const lastDot = raw.lastIndexOf(".");

  if (lastComma > -1 && lastDot > -1) {
    if (lastComma > lastDot) {
      raw = raw.replace(/\./g, "").replace(",", ".");
    } else {
      raw = raw.replace(/,/g, "");
    }
  } else if (lastComma > -1) {
    const decimalLength = raw.length - lastComma - 1;

    if (decimalLength === 1 || decimalLength === 2) {
      raw = raw.replace(/\./g, "").replace(",", ".");
    } else {
      raw = raw.replace(/,/g, "");
    }
  } else if (lastDot > -1) {
    const decimalLength = raw.length - lastDot - 1;

    if (decimalLength !== 1 && decimalLength !== 2) {
      raw = raw.replace(/\./g, "");
    }
  }

  const number = Number(raw);

  if (!Number.isFinite(number) || number <= 0) {
    throw new Error("Gecerli bir fiyat girin.");
  }

  return Math.round(number * 100) / 100;
}

async function idefixRequest(
  path: string,
  init?: {
    method?: string;
    body?: unknown;
  }
) {
  const token = getIdefixVendorToken();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const response = await fetch(`${IDEFIX_BASE_URL}${path}`, {
      method: init?.method || "GET",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-API-KEY": token,
      },
      body:
        init?.body === undefined
          ? undefined
          : JSON.stringify(init.body),
      signal: controller.signal,
    });

    const raw = await response.text();
    let payload: any = null;

    try {
      payload = raw ? JSON.parse(raw) : null;
    } catch {
      payload = { raw };
    }

    if (!response.ok) {
      throw new Error(
        `Idefix HTTP ${response.status}: ${
          text(payload?.message) ||
          text(payload?.error) ||
          raw ||
          "Cevap bos"
        }`
      );
    }

    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

async function inventoryItems() {
  const vendorId = getIdefixVendorId();

  const payload = await idefixRequest(
    `/pim/catalog/${encodeURIComponent(vendorId)}/inventory/list`
  );

  const rows =
    payload?.items ??
    payload?.products ??
    payload?.data?.items ??
    payload?.data?.products ??
    [];

  return Array.isArray(rows) ? rows : [];
}

async function inventoryByBarcode(barcode: string) {
  const rows = await inventoryItems();

  return (
    rows.find(
      (row: any) => text(row?.barcode) === barcode
    ) || null
  );
}

async function waitInventoryResult(
  batchId: string,
  barcode: string
) {
  const vendorId = getIdefixVendorId();
  let last: any = null;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    if (attempt > 0) {
      await new Promise((resolve) => setTimeout(resolve, 700));
    }

    last = await idefixRequest(
      `/pim/catalog/${encodeURIComponent(
        vendorId
      )}/inventory-result/${encodeURIComponent(batchId)}`
    );

    const items = Array.isArray(last?.items) ? last.items : [];

    const item =
      items.find(
        (row: any) => text(row?.barcode) === barcode
      ) ||
      items[0] ||
      null;

    const itemStatus = text(item?.status).toUpperCase();
    const batchStatus = text(last?.status)
      .toUpperCase()
      .replace(/[\s-]+/g, "_");

    if (
      itemStatus === "DECLINE" ||
      batchStatus === "FAILED"
    ) {
      throw new Error(
        `Idefix fiyat guncellemesi reddedildi: ${JSON.stringify(
          item?.failureReasons || item || last
        )}`
      );
    }

    if (
      itemStatus === "COMPLETED" ||
      batchStatus === "COMPLETED" ||
      batchStatus === "COMPLETED_SUCCESS"
    ) {
      return {
        success: true,
        payload: last,
        item,
      };
    }
  }

  return {
    success: false,
    payload: last,
    item: null,
  };
}

async function waitExactLivePrice(
  barcode: string,
  expectedPrice: number,
  expectedComparePrice: number
) {
  let last: any = null;

  for (let attempt = 0; attempt < 12; attempt += 1) {
    if (attempt > 0) {
      await new Promise((resolve) => setTimeout(resolve, 750));
    }

    last = await inventoryByBarcode(barcode);

    if (!last) {
      continue;
    }

    const livePrice = Number(last?.price ?? 0);
    const liveComparePrice = Number(
      last?.comparePrice ?? last?.price ?? 0
    );

    const priceOk =
      Number.isFinite(livePrice) &&
      Math.abs(livePrice - expectedPrice) < 0.011;

    const comparePriceOk =
      Number.isFinite(liveComparePrice) &&
      Math.abs(liveComparePrice - expectedComparePrice) < 0.011;

    if (priceOk && comparePriceOk) {
      return {
        success: true,
        item: last,
      };
    }
  }

  return {
    success: false,
    item: last,
  };
}

export async function POST(request: NextRequest) {
  const authError = await requireIdefixSuperAdmin(request);

  if (authError) {
    return authError;
  }

  try {
    const body = await request.json().catch(() => null);

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return noStoreJson(
        {
          success: false,
          error: "Gecersiz istek.",
        },
        400
      );
    }

    const barcode = text((body as any).barcode);

    if (!barcode) {
      return noStoreJson(
        {
          success: false,
          error: "Idefix barkodu gerekli.",
        },
        400
      );
    }

    let price: number;
    let comparePrice: number;

    try {
      price = parseMoney((body as any).price);

      const rawComparePrice = (body as any).comparePrice;

      comparePrice =
        rawComparePrice === undefined ||
        rawComparePrice === null ||
        text(rawComparePrice) === ""
          ? price
          : parseMoney(rawComparePrice);
    } catch (error) {
      return noStoreJson(
        {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Fiyat gecersiz.",
        },
        400
      );
    }

    if (comparePrice < price) {
      return noStoreJson(
        {
          success: false,
          error:
            "Liste fiyati satis fiyatindan dusuk olamaz.",
        },
        400
      );
    }

    const liveBefore = await inventoryByBarcode(barcode);

    if (!liveBefore) {
      return noStoreJson(
        {
          success: false,
          error:
            `Idefix canli inventory kaydi bulunamadi. Barkod: ${barcode}`,
        },
        404
      );
    }

    const quantityRaw = Number(
      liveBefore?.inventoryQuantity ?? 0
    );

    const quantity =
      Number.isFinite(quantityRaw) && quantityRaw >= 0
        ? Math.max(0, Math.trunc(quantityRaw))
        : 0;

    const beforePrice = Number(liveBefore?.price ?? 0) || 0;
    const beforeComparePrice =
      Number(
        liveBefore?.comparePrice ??
          liveBefore?.price ??
          0
      ) || 0;

    // Zaten ayni fiyattaysa Idefix'e gereksiz batch gonderme.
    if (
      Math.abs(beforePrice - price) < 0.011 &&
      Math.abs(beforeComparePrice - comparePrice) < 0.011
    ) {
      return noStoreJson({
        success: true,
        barcode,
        alreadyAtTarget: true,
        price,
        comparePrice,
        quantity,
        message: "Idefix fiyatlari zaten hedef degerde.",
      });
    }

    const vendorId = getIdefixVendorId();

    const upload = await idefixRequest(
      `/pim/catalog/${encodeURIComponent(
        vendorId
      )}/inventory-upload`,
      {
        method: "POST",
        body: {
          items: [
            {
              barcode,
              price,
              comparePrice,
              inventoryQuantity: quantity,
              maximumPurchasableQuantity:
                Number(
                  liveBefore?.maximumPurchasableQuantity ?? 1
                ) || 1,
              deliveryDuration:
                Number(liveBefore?.deliveryDuration ?? 1) || 1,
              deliveryType:
                text(liveBefore?.deliveryType) || "regular",
              isZoneSale:
                liveBefore?.isZoneSale === undefined
                  ? null
                  : liveBefore.isZoneSale,
            },
          ],
        },
      }
    );

    const batchRequestId = text(upload?.batchRequestId);

    if (!batchRequestId) {
      throw new Error(
        "Idefix inventory-upload batchRequestId dondurmedi."
      );
    }

    const result = await waitInventoryResult(
      batchRequestId,
      barcode
    );

    if (!result.success) {
      throw new Error(
        `Idefix inventory-result tamamlanmadi. Batch: ${batchRequestId}`
      );
    }

    const liveAfter = await waitExactLivePrice(
      barcode,
      price,
      comparePrice
    );

    if (!liveAfter.success) {
      throw new Error(
        `Idefix canli fiyat hedefe gecmedi. Beklenen satis ${price}, gorulen ${Number(
          liveAfter.item?.price ?? 0
        )}; beklenen liste ${comparePrice}, gorulen ${Number(
          liveAfter.item?.comparePrice ?? liveAfter.item?.price ?? 0
        )}.`
      );
    }

    const pool = getIdefixDbPool();

    const localResult = await pool.query(
      `
        SELECT id
        FROM public.online_listings
        WHERE channel = 'IDEFIX'
          AND external_variant_id = $1
        ORDER BY updated_at DESC, id DESC
        LIMIT 1
      `,
      [barcode]
    );

    const listing = localResult.rows[0] || null;

    if (listing) {
      await pool.query(
        `
          UPDATE public.online_listings
          SET
            sale_price = $2,
            list_price = $3,
            quantity = $4,
            sync_status = 'SYNCED',
            last_task_id = $5,
            last_task_status = 'SUCCESS',
            last_error = NULL,
            raw_data =
              COALESCE(raw_data, '{}'::jsonb)
              || $6::jsonb,
            updated_at = now()
          WHERE id = $1
        `,
        [
          Number(listing.id),
          price,
          comparePrice,
          quantity,
          batchRequestId,
          JSON.stringify({
            idefixPriceSetAt: new Date().toISOString(),
            beforePrice,
            beforeComparePrice,
            livePrice: price,
            liveComparePrice: comparePrice,
            liveStock: quantity,
            source: "IDEFIX_PANEL_PRICE_UPDATE",
          }),
        ]
      );
    }

    return noStoreJson({
      success: true,
      barcode,
      listingId: listing ? Number(listing.id) : null,
      beforePrice,
      beforeComparePrice,
      price,
      comparePrice,
      quantity,
      batchRequestId,
      verified: true,
      message:
        `Idefix fiyatlari guncellendi ve canli olarak dogrulandi. Satis: ${beforePrice} -> ${price}, Liste: ${beforeComparePrice} -> ${comparePrice}.`,
    });
  } catch (error) {
    console.error("[IDEFIX VARIANT PRICE]", error);

    return noStoreJson(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Idefix fiyat guncellemesi basarisiz.",
      },
      500
    );
  }
}
