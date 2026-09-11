// app/api/online/n11/imei-diagnostic/route.ts
// CNETMOBIL - 4 sorunlu IMEI icin READ ONLY teshis endpointi.
// PostgreSQL veya N11 tarafinda HICBIR seyi guncellemez / silmez.
// Sadece:
// 1) stock_devices
// 2) online_channel_devices
// 3) online_listings + raw_data IMEI havuzu
// 4) online_tasks
// 5) N11 canli product-query
// verilerini karsilastirir.

import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

declare global {
  // eslint-disable-next-line no-var
  var cnetN11FourImeiDiagnosticPool: Pool | undefined;
}

const COOKIE_NAME = "cnet_auth";
const N11_PRODUCT_QUERY_URL = "https://api.n11.com/ms/product-query";
const PAGE_SIZE = 50;
const MAX_PAGES = 100;

// Kullanici tarafindan bildirilen 4 sorunlu IMEI.
const TARGET_IMEIS: string[] = [
  "352455560211898", // Samsung A53 128 GB Siyah
  "355617935174351", // Samsung S23 Ultra 256 GB Siyah
  "353056117944509", // Apple iPhone 12 64 GB Kirmizi
  "356323456537295", // Apple iPhone 13 128 GB Siyah
];

type SessionPayload = {
  userId: number | null;
  role: "admin" | "personel";
  branch: string;
  exp: number;
  legacy?: boolean;
};

type N11Product = {
  n11ProductId?: unknown;
  stockCode?: unknown;
  title?: unknown;
  status?: unknown;
  saleStatus?: unknown;
  quantity?: unknown;
  salePrice?: unknown;
  listPrice?: unknown;
  [key: string]: unknown;
};

function json(
  body: Record<string, unknown>,
  status = 200
) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      Pragma: "no-cache",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function getPool() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL bulunamadi.");
  }

  if (!global.cnetN11FourImeiDiagnosticPool) {
    global.cnetN11FourImeiDiagnosticPool = new Pool({
      connectionString,
      max: 4,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
  }

  return global.cnetN11FourImeiDiagnosticPool;
}

function verifySession(
  token: string
): SessionPayload | null {
  try {
    const [encoded, signature] = token.split(".");

    if (!encoded || !signature) {
      return null;
    }

    const secret = process.env.SESSION_SECRET;

    if (!secret) {
      return null;
    }

    const expected = crypto
      .createHmac("sha256", secret)
      .update(encoded)
      .digest("base64url");

    const a = Buffer.from(signature, "utf8");
    const b = Buffer.from(expected, "utf8");

    if (
      a.length !== b.length ||
      !crypto.timingSafeEqual(a, b)
    ) {
      return null;
    }

    const payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8")
    ) as SessionPayload;

    if (
      !payload?.userId ||
      !payload?.exp ||
      payload.exp < Math.floor(Date.now() / 1000)
    ) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

async function requireSuperAdmin(
  request: NextRequest
) {
  const token = request.cookies.get(COOKIE_NAME)?.value;

  if (!token) {
    return json(
      {
        success: false,
        error: "Oturum gerekli.",
      },
      401
    );
  }

  const session = verifySession(token);

  if (!session?.userId) {
    return json(
      {
        success: false,
        error: "Gecersiz oturum.",
      },
      401
    );
  }

  const result = await getPool().query(
    `
      SELECT
        u.active,
        EXISTS (
          SELECT 1
          FROM public.user_roles ur
          JOIN public.roles r
            ON r.id = ur.role_id
          WHERE ur.user_id = u.id
            AND r.code = 'super_admin'
            AND r.active = TRUE
        ) AS is_super_admin
      FROM public.users u
      WHERE u.id = $1
      LIMIT 1
    `,
    [session.userId]
  );

  const row = result.rows[0];

  if (
    !row ||
    row.active !== true ||
    row.is_super_admin !== true
  ) {
    return json(
      {
        success: false,
        error: "Bu ekran yalnizca Super Admin icindir.",
      },
      403
    );
  }

  return null;
}

function text(value: unknown) {
  return String(value ?? "").trim();
}

function qty(value: unknown) {
  const number = Number(value);

  if (
    !Number.isFinite(number) ||
    number < 0
  ) {
    return 0;
  }

  return Math.floor(number);
}

function safeObject(value: unknown): Record<string, any> {
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    return value as Record<string, any>;
  }

  return {};
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .map((item) => text(item))
        .filter(Boolean)
    )
  );
}

function listingContainsImei(
  row: any,
  imei: string
) {
  if (
    text(row?.external_stock_code) === imei
  ) {
    return true;
  }

  const raw = safeObject(row?.raw_data);

  return [
    ...stringArray(raw.pooledImeis),
    ...stringArray(raw.availableImeis),
    ...stringArray(raw.soldImeis),
  ].includes(imei);
}

async function fetchAllN11Products() {
  const appKey = text(process.env.N11_APP_KEY);
  const appSecret = text(process.env.N11_APP_SECRET);

  if (!appKey || !appSecret) {
    throw new Error(
      "N11_APP_KEY / N11_APP_SECRET eksik."
    );
  }

  const byStockCode = new Map<string, N11Product>();
  const byProductId = new Map<string, N11Product>();

  let reportedTotal = 0;
  let fetchedPages = 0;

  for (
    let page = 0;
    page < MAX_PAGES;
    page += 1
  ) {
    const url = new URL(N11_PRODUCT_QUERY_URL);

    url.searchParams.set("page", String(page));
    url.searchParams.set("size", String(PAGE_SIZE));

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      15_000
    );

    try {
      const response = await fetch(url.toString(), {
        method: "GET",
        cache: "no-store",
        headers: {
          appkey: appKey,
          appsecret: appSecret,
          Accept: "application/json",
        },
        signal: controller.signal,
      });

      const raw = await response.text();

      let payload: any = null;

      try {
        payload = raw ? JSON.parse(raw) : null;
      } catch {
        payload = null;
      }

      if (!response.ok) {
        throw new Error(
          payload?.message ||
            payload?.error ||
            `N11 HTTP ${response.status}`
        );
      }

      const content = Array.isArray(payload?.content)
        ? payload.content
        : [];

      if (page === 0) {
        reportedTotal =
          Number(
            payload?.totalElements ||
              content.length
          ) || 0;
      }

      fetchedPages += 1;

      for (const item of content) {
        const stockCode = text(item?.stockCode);
        const productId = text(item?.n11ProductId);

        if (stockCode) {
          byStockCode.set(stockCode, item);
        }

        if (productId) {
          byProductId.set(productId, item);
        }
      }

      const totalPages =
        Number(payload?.totalPages || 1) || 1;

      if (
        content.length === 0 ||
        page + 1 >= totalPages ||
        content.length < PAGE_SIZE
      ) {
        break;
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  return {
    products: Array.from(byStockCode.values()),
    byStockCode,
    byProductId,
    reportedTotal,
    fetchedPages,
  };
}

function compactN11Product(
  product: N11Product | null | undefined
) {
  if (!product) {
    return null;
  }

  return {
    n11ProductId: text(product.n11ProductId) || null,
    stockCode: text(product.stockCode) || null,
    title: text(product.title) || null,
    status: text(product.status) || null,
    saleStatus: text(product.saleStatus) || null,
    quantity: qty(product.quantity),
    salePrice:
      Number.isFinite(Number(product.salePrice))
        ? Number(product.salePrice)
        : null,
    listPrice:
      Number.isFinite(Number(product.listPrice))
        ? Number(product.listPrice)
        : null,
  };
}

export async function GET(
  request: NextRequest
) {
  try {
    const authError =
      await requireSuperAdmin(request);

    if (authError) {
      return authError;
    }

    const pool = getPool();

    // Tamamen READ ONLY sorgular.
    const [
      n11,
      stockDevicesResult,
      channelDevicesResult,
      listingsResult,
    ] = await Promise.all([
      fetchAllN11Products(),

      pool.query(
        `
          SELECT
            id,
            imei,
            brand,
            model,
            memory,
            color,
            grade,
            warranty,
            current_branch_code,
            status,
            source,
            created_at,
            updated_at
          FROM public.stock_devices
          WHERE imei = ANY($1::text[])
          ORDER BY imei
        `,
        [TARGET_IMEIS]
      ),

      pool.query(
        `
          SELECT
            stock_device_id,
            imei,
            channel,
            online_listing_id,
            membership_status,
            channel_sale_price,
            channel_list_price,
            source_channel,
            updated_at
          FROM public.online_channel_devices
          WHERE channel = 'N11'
            AND imei = ANY($1::text[])
          ORDER BY imei, id
        `,
        [TARGET_IMEIS]
      ),

      pool.query(
        `
          SELECT
            id,
            stock_device_id,
            channel,
            external_product_id,
            external_stock_code,
            title,
            brand,
            model,
            memory,
            color,
            grade,
            warranty,
            sale_price,
            list_price,
            quantity,
            sync_status,
            product_status,
            sale_status,
            last_task_id,
            last_task_status,
            last_error,
            raw_data,
            created_at,
            updated_at
          FROM public.online_listings
          WHERE channel = 'N11'
          ORDER BY id
        `
      ),
    ]);

    const stockByImei = new Map<string, any>();

    for (const row of stockDevicesResult.rows) {
      stockByImei.set(text(row.imei), row);
    }

    const channelByImei = new Map<string, any[]>();

    for (const row of channelDevicesResult.rows) {
      const imei = text(row.imei);

      if (!channelByImei.has(imei)) {
        channelByImei.set(imei, []);
      }

      channelByImei.get(imei)!.push(row);
    }

    const relatedListingIds = new Set<number>();
    const relatedListingsByImei =
      new Map<string, any[]>();

    for (const imei of TARGET_IMEIS) {
      const stockDevice =
        stockByImei.get(imei) || null;

      const stockDeviceId =
        stockDevice
          ? Number(stockDevice.id)
          : null;

      const membershipListingIds =
        new Set(
          (channelByImei.get(imei) || [])
            .map((row: any) =>
              Number(row.online_listing_id)
            )
            .filter(
              (value: number) =>
                Number.isFinite(value) &&
                value > 0
            )
        );

      const related =
        listingsResult.rows.filter(
          (row: any) => {
            if (
              listingContainsImei(
                row,
                imei
              )
            ) {
              return true;
            }

            if (
              stockDeviceId &&
              Number(
                row.stock_device_id
              ) ===
                stockDeviceId
            ) {
              return true;
            }

            if (
              membershipListingIds.has(
                Number(row.id)
              )
            ) {
              return true;
            }

            return false;
          }
        );

      relatedListingsByImei.set(
        imei,
        related
      );

      for (const row of related) {
        const id = Number(row.id);

        if (Number.isFinite(id) && id > 0) {
          relatedListingIds.add(id);
        }
      }
    }

    const listingIds =
      Array.from(relatedListingIds);

    const tasksResult =
      listingIds.length > 0
        ? await pool.query(
            `
              SELECT
                id,
                channel,
                task_id,
                task_type,
                task_status,
                stock_code,
                online_listing_id,
                request_payload,
                response_payload,
                reasons,
                created_at
              FROM public.online_tasks
              WHERE channel = 'N11'
                AND online_listing_id = ANY($1::bigint[])
              ORDER BY created_at DESC, id DESC
            `,
            [listingIds]
          )
        : { rows: [] as any[] };

    const tasksByListingId =
      new Map<number, any[]>();

    for (const task of tasksResult.rows) {
      const listingId =
        Number(task.online_listing_id);

      if (!tasksByListingId.has(listingId)) {
        tasksByListingId.set(
          listingId,
          []
        );
      }

      tasksByListingId
        .get(listingId)!
        .push(task);
    }

    const diagnostics =
      TARGET_IMEIS.map((imei) => {
        const stockDevice =
          stockByImei.get(imei) || null;

        const channelRows =
          channelByImei.get(imei) || [];

        const localListings =
          relatedListingsByImei.get(imei) || [];

        const listingViews =
          localListings.map(
            (row: any) => {
              const raw =
                safeObject(row.raw_data);

              const pooledImeis =
                stringArray(
                  raw.pooledImeis
                );

              const availableImeis =
                stringArray(
                  raw.availableImeis
                );

              const soldImeis =
                stringArray(
                  raw.soldImeis
                );

              const stockCode =
                text(
                  row.external_stock_code
                );

              const productId =
                text(
                  row.external_product_id
                );

              const n11ByStock =
                stockCode
                  ? n11.byStockCode.get(
                      stockCode
                    ) || null
                  : null;

              const n11ById =
                productId
                  ? n11.byProductId.get(
                      productId
                    ) || null
                  : null;

              const liveProduct =
                n11ByStock ||
                n11ById ||
                null;

              const tasks =
                tasksByListingId.get(
                  Number(row.id)
                ) || [];

              return {
                id: row.id,
                stockDeviceId:
                  row.stock_device_id,
                externalProductId:
                  row.external_product_id,
                externalStockCode:
                  row.external_stock_code,
                title: row.title,
                localQuantity:
                  qty(row.quantity),
                syncStatus:
                  row.sync_status,
                productStatus:
                  row.product_status,
                saleStatus:
                  row.sale_status,
                lastTaskId:
                  row.last_task_id,
                lastTaskStatus:
                  row.last_task_status,
                lastError:
                  row.last_error,
                updatedAt:
                  row.updated_at,

                imeiPool: {
                  inMasterStockCode:
                    stockCode === imei,
                  inPooledImeis:
                    pooledImeis.includes(
                      imei
                    ),
                  inAvailableImeis:
                    availableImeis.includes(
                      imei
                    ),
                  inSoldImeis:
                    soldImeis.includes(
                      imei
                    ),
                  poolEnabled:
                    raw.poolEnabled === true,
                  poolMasterStockCode:
                    text(
                      raw.poolMasterStockCode
                    ) || null,
                  poolTargetQuantity:
                    qty(
                      raw.poolTargetQuantity
                    ),
                  poolStockIncreasePending:
                    raw.poolStockIncreasePending ===
                    true,
                  poolStockPendingUntil:
                    text(
                      raw.poolStockPendingUntil
                    ) || null,
                  poolStockTaskId:
                    text(
                      raw.poolStockTaskId
                    ) || null,
                },

                liveN11: {
                  matchedBy:
                    n11ByStock
                      ? "STOCK_CODE"
                      : n11ById
                        ? "PRODUCT_ID"
                        : null,
                  product:
                    compactN11Product(
                      liveProduct
                    ),
                  quantityDifference:
                    liveProduct
                      ? qty(row.quantity) -
                        qty(
                          liveProduct.quantity
                        )
                      : qty(
                          row.quantity
                        ),
                },

                tasks: tasks.map(
                  (task: any) => ({
                    taskId:
                      task.task_id,
                    taskType:
                      task.task_type,
                    taskStatus:
                      task.task_status,
                    stockCode:
                      task.stock_code,
                    reasons:
                      task.reasons,
                    createdAt:
                      task.created_at,
                  })
                ),
              };
            }
          );

        const flags: string[] = [];

        if (!stockDevice) {
          flags.push(
            "STOCK_DEVICES_ICINDE_IMEI_YOK"
          );
        }

        if (channelRows.length === 0) {
          flags.push(
            "ONLINE_CHANNEL_DEVICES_N11_BAGLANTISI_YOK"
          );
        }

        if (localListings.length === 0) {
          flags.push(
            "ONLINE_LISTINGS_ICINDE_IMEI_YOK"
          );
        }

        const poolAvailable =
          listingViews.some(
            (listing: any) =>
              listing.imeiPool
                .inAvailableImeis
          );

        const poolSold =
          listingViews.some(
            (listing: any) =>
              listing.imeiPool
                .inSoldImeis
          );

        const livePositive =
          listingViews.some(
            (listing: any) =>
              Number(
                listing.liveN11
                  ?.product?.quantity ||
                  0
              ) > 0
          );

        const localPositive =
          listingViews.some(
            (listing: any) =>
              Number(
                listing.localQuantity ||
                  0
              ) > 0
          );

        const taskInQueue =
          listingViews.some(
            (listing: any) =>
              String(
                listing.lastTaskStatus ||
                  ""
              ).toUpperCase() ===
                "IN_QUEUE" ||
              listing.tasks.some(
                (task: any) =>
                  String(
                    task.taskStatus ||
                      ""
                  ).toUpperCase() ===
                  "IN_QUEUE"
              )
          );

        if (
          poolAvailable &&
          !stockDevice
        ) {
          flags.push(
            "IMEI_N11_LOCAL_HAVUZDA_VAR_AMA_MERKEZ_STOKTA_YOK"
          );
        }

        if (
          localPositive &&
          !livePositive
        ) {
          flags.push(
            "PANEL_POZITIF_N11_CANLI_STOK_0_VEYA_URUN_YOK"
          );
        }

        if (poolSold) {
          flags.push(
            "IMEI_SOLD_IMEIS_LISTESINDE"
          );
        }

        if (taskInQueue) {
          flags.push(
            "N11_TASK_HALEN_IN_QUEUE_GORUNUYOR"
          );
        }

        if (
          stockDevice &&
          String(
            stockDevice.status ||
              ""
          ).toUpperCase() !==
            "AVAILABLE"
        ) {
          flags.push(
            `MERKEZ_STOK_DURUMU_${String(
              stockDevice.status ||
                "BILINMIYOR"
            ).toUpperCase()}`
          );
        }

        return {
          imei,

          stockDevice: stockDevice
            ? {
                id:
                  stockDevice.id,
                brand:
                  stockDevice.brand,
                model:
                  stockDevice.model,
                memory:
                  stockDevice.memory,
                color:
                  stockDevice.color,
                grade:
                  stockDevice.grade,
                warranty:
                  stockDevice.warranty,
                branch:
                  stockDevice.current_branch_code,
                status:
                  stockDevice.status,
                source:
                  stockDevice.source,
                createdAt:
                  stockDevice.created_at,
                updatedAt:
                  stockDevice.updated_at,
              }
            : null,

          n11ChannelMemberships:
            channelRows.map(
              (row: any) => ({
                stockDeviceId:
                  row.stock_device_id,
                onlineListingId:
                  row.online_listing_id,
                membershipStatus:
                  row.membership_status,
                salePrice:
                  row.channel_sale_price,
                listPrice:
                  row.channel_list_price,
                sourceChannel:
                  row.source_channel,
                updatedAt:
                  row.updated_at,
              })
            ),

          relatedListings:
            listingViews,

          summary: {
            existsInStockDevices:
              Boolean(stockDevice),
            n11MembershipCount:
              channelRows.length,
            relatedListingCount:
              localListings.length,
            presentInLocalAvailablePool:
              poolAvailable,
            presentInLocalSoldPool:
              poolSold,
            localPositiveStock:
              localPositive,
            liveN11PositiveStock:
              livePositive,
            flags,
          },
        };
      });

    const problemCount =
      diagnostics.filter(
        (item) =>
          item.summary.flags.length > 0
      ).length;

    return json({
      success: true,
      readOnly: true,
      message:
        "4 IMEI kontrol edildi. Bu endpoint hicbir kaydi degistirmez.",
      targetImeis:
        TARGET_IMEIS,
      n11: {
        reportedTotalProducts:
          n11.reportedTotal,
        fetchedUniqueProducts:
          n11.products.length,
        fetchedPages:
          n11.fetchedPages,
      },
      diagnostics,
      summary: {
        checked:
          diagnostics.length,
        withFlags:
          problemCount,
        withoutFlags:
          diagnostics.length -
          problemCount,
      },
      checkedAt:
        new Date().toISOString(),
    });
  } catch (error) {
    console.error(
      "N11 4 IMEI DIAGNOSTIC ERROR:",
      error
    );

    return json(
      {
        success: false,
        readOnly: true,
        error:
          error instanceof Error
            ? error.message
            : "4 IMEI teshisi yapilamadi.",
      },
      500
    );
  }
}
