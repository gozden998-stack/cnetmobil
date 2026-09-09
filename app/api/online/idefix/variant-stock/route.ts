// app/api/online/idefix/variant-stock/route.ts
// CNETMOBIL - IDEFIX EXACT STOK GUNCELLEME
//
// Merkez "Stoktan Çıkar" işlemi için kullanılır.
// - Stok sadece azaltılabilir / aynı bırakılabilir.
// - inventory-upload ile yazar.
// - inventory-result ile batch'i doğrular.
// - inventory-list ile GERÇEK canlı adedi birebir doğrular.
// - Hedef 0 ise ürün inventory-list'ten düşerse 0 kabul edilir.

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

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

export const revalidate = 0;

function text(
  value: unknown
) {
  return String(
    value ?? ""
  ).trim();
}

function parseQuantity(
  value: unknown
) {
  const n =
    Number(value);

  if (
    !Number.isInteger(n) ||
    n < 0
  ) {
    throw new Error(
      "İdefix stok adedi 0 veya daha büyük tam sayı olmalıdır."
    );
  }

  return n;
}

async function idefixRequest(
  path: string,
  init?: {
    method?:
      string;
    body?:
      unknown;
  }
) {
  const token =
    getIdefixVendorToken();

  const controller =
    new AbortController();

  const timeout =
    setTimeout(
      () =>
        controller.abort(),
      30_000
    );

  try {
    const response =
      await fetch(
        `${IDEFIX_BASE_URL}${path}`,
        {
          method:
            init?.method ||
            "GET",
          cache:
            "no-store",
          headers: {
            Accept:
              "application/json",
            "Content-Type":
              "application/json",
            "X-API-KEY":
              token,
          },
          body:
            init?.body ===
            undefined
              ? undefined
              : JSON.stringify(
                  init.body
                ),
          signal:
            controller.signal,
        }
      );

    const raw =
      await response.text();

    let payload:
      any = null;

    try {
      payload =
        raw
          ? JSON.parse(
              raw
            )
          : null;
    } catch {
      payload = {
        raw,
      };
    }

    if (
      !response.ok
    ) {
      throw new Error(
        `İdefix HTTP ${response.status}: ${
          text(
            payload?.message
          ) ||
          text(
            payload?.error
          ) ||
          raw ||
          "Cevap boş"
        }`
      );
    }

    return payload;
  } finally {
    clearTimeout(
      timeout
    );
  }
}

async function inventoryItems() {
  const vendorId =
    getIdefixVendorId();

  const payload =
    await idefixRequest(
      `/pim/catalog/${encodeURIComponent(
        vendorId
      )}/inventory/list`
    );

  const rows =
    payload?.items ??
    payload?.products ??
    payload?.data?.items ??
    payload?.data?.products ??
    [];

  return Array.isArray(
    rows
  )
    ? rows
    : [];
}

async function inventoryByBarcode(
  barcode: string
) {
  const rows =
    await inventoryItems();

  return (
    rows.find(
      (row: any) =>
        text(
          row?.barcode
        ) ===
        barcode
    ) ||
    null
  );
}

async function waitInventoryResult(
  batchId: string,
  barcode: string
) {
  const vendorId =
    getIdefixVendorId();

  let last:
    any = null;

  for (
    let attempt = 0;
    attempt < 8;
    attempt += 1
  ) {
    if (
      attempt > 0
    ) {
      await new Promise(
        (resolve) =>
          setTimeout(
            resolve,
            700
          )
      );
    }

    last =
      await idefixRequest(
        `/pim/catalog/${encodeURIComponent(
          vendorId
        )}/inventory-result/${encodeURIComponent(
          batchId
        )}`
      );

    const items =
      Array.isArray(
        last?.items
      )
        ? last.items
        : [];

    const item =
      items.find(
        (row: any) =>
          text(
            row?.barcode
          ) ===
          barcode
      ) ||
      items[0] ||
      null;

    const itemStatus =
      text(
        item?.status
      ).toUpperCase();

    const batchStatus =
      text(
        last?.status
      )
        .toUpperCase()
        .replace(
          /[\s-]+/g,
          "_"
        );

    if (
      itemStatus ===
        "DECLINE" ||
      batchStatus ===
        "FAILED"
    ) {
      throw new Error(
        `İdefix stok güncellemesi reddedildi: ${JSON.stringify(
          item?.failureReasons ||
            item ||
            last
        )}`
      );
    }

    if (
      itemStatus ===
        "COMPLETED" ||
      batchStatus ===
        "COMPLETED" ||
      batchStatus ===
        "COMPLETED_SUCCESS"
    ) {
      return {
        success:
          true,
        payload:
          last,
        item,
      };
    }
  }

  return {
    success:
      false,
    payload:
      last,
    item:
      null,
  };
}

async function waitExactLiveStock(
  barcode: string,
  expected: number
) {
  let last:
    any = null;

  for (
    let attempt = 0;
    attempt < 12;
    attempt += 1
  ) {
    if (
      attempt > 0
    ) {
      await new Promise(
        (resolve) =>
          setTimeout(
            resolve,
            750
          )
      );
    }

    last =
      await inventoryByBarcode(
        barcode
      );

    // Stok 0 olduğunda bazı İdefix cevaplarında ürün
    // inventory-list'ten tamamen düşebilir.
    if (
      !last &&
      expected ===
        0 &&
      attempt >=
        2
    ) {
      return {
        success:
          true,
        item:
          null,
      };
    }

    const live =
      Number(
        last
          ?.inventoryQuantity ??
          0
      );

    if (
      Number.isFinite(
        live
      ) &&
      live ===
        expected
    ) {
      return {
        success:
          true,
        item:
          last,
      };
    }
  }

  return {
    success:
      false,
    item:
      last,
  };
}

export async function POST(
  request: NextRequest
) {
  const authError =
    await requireIdefixSuperAdmin(
      request
    );

  if (authError) {
    return authError;
  }

  try {
    const body =
      await request
        .json()
        .catch(
          () => null
        );

    if (
      !body ||
      typeof body !==
        "object" ||
      Array.isArray(
        body
      )
    ) {
      return noStoreJson(
        {
          success: false,
          error:
            "Geçersiz istek.",
        },
        400
      );
    }

    const barcode =
      text(
        (body as any)
          .barcode
      );

    const targetQuantity =
      parseQuantity(
        (body as any)
          .quantity
      );

    if (!barcode) {
      return noStoreJson(
        {
          success: false,
          error:
            "İdefix barkodu gerekli.",
        },
        400
      );
    }

    const pool =
      getIdefixDbPool();

    const local =
      await pool.query(
        `
          SELECT
            id,
            external_variant_id,
            external_stock_code,
            quantity,
            sale_price,
            list_price,
            title
          FROM public.online_listings
          WHERE channel =
                'IDEFIX'
            AND external_variant_id =
                $1
          ORDER BY
            updated_at DESC,
            id DESC
          LIMIT 1
        `,
        [
          barcode,
        ]
      );

    const listing =
      local.rows[0] ||
      null;

    if (!listing) {
      return noStoreJson(
        {
          success: false,
          error:
            `İdefix yerel listing bulunamadı. Barkod: ${barcode}`,
        },
        404
      );
    }

    const liveBefore =
      await inventoryByBarcode(
        barcode
      );

    const beforeQuantityRaw =
      Number(
        liveBefore
          ?.inventoryQuantity ??
        listing.quantity ??
        0
      );

    const beforeQuantity =
      Number.isFinite(
        beforeQuantityRaw
      )
        ? Math.max(
            0,
            Math.trunc(
              beforeQuantityRaw
            )
          )
        : 0;

    if (
      targetQuantity >
      beforeQuantity
    ) {
      return noStoreJson(
        {
          success: false,
          error:
            `Bu route stok artırmaz. Canlı stok ${beforeQuantity}, hedef ${targetQuantity}.`,
        },
        409
      );
    }

    // Zaten hedefteyse dış API'ye gereksiz yazma.
    if (
      beforeQuantity ===
      targetQuantity
    ) {
      await pool.query(
        `
          UPDATE public.online_listings
          SET
            quantity =
              $2,
            sync_status =
              'SYNCED',
            last_task_status =
              'SUCCESS',
            last_error =
              NULL,
            updated_at =
              now()
          WHERE id = $1
        `,
        [
          Number(
            listing.id
          ),
          targetQuantity,
        ]
      );

      return noStoreJson({
        success: true,
        barcode,
        listingId:
          Number(
            listing.id
          ),
        beforeQuantity,
        quantity:
          targetQuantity,
        alreadyAtTarget:
          true,
        message:
          `İdefix stok zaten ${targetQuantity}.`,
      });
    }

    const price =
      Number(
        liveBefore
          ?.price ??
        listing.sale_price ??
        0
      );

    const comparePrice =
      Number(
        liveBefore
          ?.comparePrice ??
        listing.list_price ??
        price ??
        0
      );

    if (
      !Number.isFinite(
        price
      ) ||
      price <= 0
    ) {
      return noStoreJson(
        {
          success: false,
          error:
            "İdefix canlı satış fiyatı bulunamadı.",
        },
        409
      );
    }

    const vendorId =
      getIdefixVendorId();

    const upload =
      await idefixRequest(
        `/pim/catalog/${encodeURIComponent(
          vendorId
        )}/inventory-upload`,
        {
          method:
            "POST",
          body: {
            items: [
              {
                barcode,
                price,
                comparePrice:
                  Number.isFinite(
                    comparePrice
                  ) &&
                  comparePrice >
                    0
                    ? comparePrice
                    : price,
                inventoryQuantity:
                  targetQuantity,
                maximumPurchasableQuantity:
                  1,
                deliveryDuration:
                  Number(
                    liveBefore
                      ?.deliveryDuration ??
                    1
                  ) ||
                  1,
                deliveryType:
                  text(
                    liveBefore
                      ?.deliveryType
                  ) ||
                  "regular",
                isZoneSale:
                  null,
              },
            ],
          },
        }
      );

    const batchRequestId =
      text(
        upload
          ?.batchRequestId
      );

    if (
      !batchRequestId
    ) {
      throw new Error(
        "İdefix inventory-upload batchRequestId döndürmedi."
      );
    }

    const result =
      await waitInventoryResult(
        batchRequestId,
        barcode
      );

    if (
      !result.success
    ) {
      throw new Error(
        `İdefix inventory-result tamamlanmadı. Batch: ${batchRequestId}`
      );
    }

    const liveAfter =
      await waitExactLiveStock(
        barcode,
        targetQuantity
      );

    if (
      !liveAfter.success
    ) {
      throw new Error(
        `İdefix canlı stok hedefe geçmedi. Beklenen ${targetQuantity}, görülen ${Number(
          liveAfter.item
            ?.inventoryQuantity ??
            0
        )}.`
      );
    }

    await pool.query(
      `
        UPDATE public.online_listings
        SET
          quantity =
            $2,
          sync_status =
            'SYNCED',
          last_task_id =
            $3,
          last_task_status =
            'SUCCESS',
          last_error =
            NULL,
          raw_data =
            COALESCE(
              raw_data,
              '{}'::jsonb
            )
            || $4::jsonb,
          updated_at =
            now()
        WHERE id = $1
      `,
      [
        Number(
          listing.id
        ),
        targetQuantity,
        batchRequestId,
        JSON.stringify({
          idefixStockSetAt:
            new Date()
              .toISOString(),
          liveStock:
            targetQuantity,
          source:
            "CENTER_STOCK_EXIT",
        }),
      ]
    );

    return noStoreJson({
      success: true,
      barcode,
      listingId:
        Number(
          listing.id
        ),
      beforeQuantity,
      quantity:
        targetQuantity,
      batchRequestId,
      message:
        `İdefix stok ${beforeQuantity} → ${targetQuantity} olarak yazıldı ve doğrulandı.`,
    });
  } catch (error) {
    console.error(
      "[IDEFIX VARIANT STOCK]",
      error
    );

    return noStoreJson(
      {
        success: false,
        error:
          error instanceof
          Error
            ? error.message
            : "İdefix stok güncellemesi başarısız.",
      },
      500
    );
  }
}
