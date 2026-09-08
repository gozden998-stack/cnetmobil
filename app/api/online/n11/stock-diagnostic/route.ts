// app/api/online/n11/stock-diagnostic/route.ts
// READ ONLY - N11 vs PostgreSQL stock/listing comparison.
// Nothing is updated or deleted.

import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

declare global {
  // eslint-disable-next-line no-var
  var cnetN11StockDiagnosticPool: Pool | undefined;
}

const COOKIE_NAME = "cnet_auth";
const N11_PRODUCT_QUERY_URL =
  "https://api.n11.com/ms/product-query";
const PAGE_SIZE = 50;
const MAX_PAGES = 100;

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
  const connectionString =
    process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL bulunamadı."
    );
  }

  if (
    !global.cnetN11StockDiagnosticPool
  ) {
    global.cnetN11StockDiagnosticPool =
      new Pool({
        connectionString,
        max: 4,
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis:
          10_000,
      });
  }

  return global
    .cnetN11StockDiagnosticPool;
}

function verifySession(
  token: string
): SessionPayload | null {
  try {
    const [encoded, signature] =
      token.split(".");

    if (!encoded || !signature) {
      return null;
    }

    const secret =
      process.env.SESSION_SECRET;

    if (!secret) {
      return null;
    }

    const expected = crypto
      .createHmac("sha256", secret)
      .update(encoded)
      .digest("base64url");

    const a = Buffer.from(
      signature,
      "utf8"
    );
    const b = Buffer.from(
      expected,
      "utf8"
    );

    if (
      a.length !== b.length ||
      !crypto.timingSafeEqual(a, b)
    ) {
      return null;
    }

    const payload = JSON.parse(
      Buffer.from(
        encoded,
        "base64url"
      ).toString("utf8")
    ) as SessionPayload;

    if (
      !payload?.userId ||
      !payload?.exp ||
      payload.exp <
        Math.floor(Date.now() / 1000)
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
  const token =
    request.cookies.get(
      COOKIE_NAME
    )?.value;

  if (!token) {
    return json(
      {
        success: false,
        error: "Oturum gerekli.",
      },
      401
    );
  }

  const session =
    verifySession(token);

  if (!session?.userId) {
    return json(
      {
        success: false,
        error: "Geçersiz oturum.",
      },
      401
    );
  }

  const result =
    await getPool().query(
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

  const row =
    result.rows[0];

  if (
    !row ||
    row.active !== true ||
    row.is_super_admin !== true
  ) {
    return json(
      {
        success: false,
        error:
          "Bu ekran yalnızca Super Admin içindir.",
      },
      403
    );
  }

  return null;
}

function text(
  value: unknown
) {
  return String(
    value ?? ""
  ).trim();
}

function qty(
  value: unknown
) {
  const number =
    Number(value);

  if (
    !Number.isFinite(number) ||
    number < 0
  ) {
    return 0;
  }

  return Math.floor(number);
}

async function fetchAllN11Products() {
  const appKey = text(
    process.env.N11_APP_KEY
  );
  const appSecret = text(
    process.env.N11_APP_SECRET
  );

  if (!appKey || !appSecret) {
    throw new Error(
      "N11_APP_KEY / N11_APP_SECRET eksik."
    );
  }

  const byStockCode =
    new Map<
      string,
      N11Product
    >();

  let reportedTotal = 0;
  let fetchedPages = 0;

  for (
    let page = 0;
    page < MAX_PAGES;
    page += 1
  ) {
    const url = new URL(
      N11_PRODUCT_QUERY_URL
    );

    url.searchParams.set(
      "page",
      String(page)
    );

    url.searchParams.set(
      "size",
      String(PAGE_SIZE)
    );

    const controller =
      new AbortController();

    const timeout =
      setTimeout(
        () =>
          controller.abort(),
        15_000
      );

    try {
      const response =
        await fetch(
          url.toString(),
          {
            method: "GET",
            cache: "no-store",
            headers: {
              appkey: appKey,
              appsecret:
                appSecret,
              Accept:
                "application/json",
            },
            signal:
              controller.signal,
          }
        );

      const raw =
        await response.text();

      let payload: any =
        null;

      try {
        payload =
          raw
            ? JSON.parse(raw)
            : null;
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

      const content =
        Array.isArray(
          payload?.content
        )
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

      for (
        const item of content
      ) {
        const stockCode =
          text(
            item?.stockCode
          );

        if (stockCode) {
          byStockCode.set(
            stockCode,
            item
          );
        }
      }

      const totalPages =
        Number(
          payload?.totalPages ||
            1
        ) || 1;

      if (
        content.length === 0 ||
        page + 1 >=
          totalPages ||
        content.length <
          PAGE_SIZE
      ) {
        break;
      }
    } finally {
      clearTimeout(
        timeout
      );
    }
  }

  return {
    products:
      Array.from(
        byStockCode.values()
      ),
    reportedTotal,
    fetchedPages,
  };
}

function distribution(
  products: N11Product[],
  key:
    | "status"
    | "saleStatus"
) {
  const result:
    Record<string, number> =
    {};

  for (
    const product of products
  ) {
    const value =
      text(
        product[key]
      ) || "(EMPTY)";

    result[value] =
      (result[value] || 0) +
      1;
  }

  return result;
}

export async function GET(
  request: NextRequest
) {
  try {
    const authError =
      await requireSuperAdmin(
        request
      );

    if (authError) {
      return authError;
    }

    const [
      n11,
      localResult,
    ] = await Promise.all([
      fetchAllN11Products(),
      getPool().query(
        `
          SELECT
            id,
            external_product_id,
            external_stock_code,
            title,
            quantity,
            sync_status,
            product_status,
            sale_status,
            last_task_status,
            last_error,
            raw_data,
            updated_at
          FROM public.online_listings
          WHERE channel = 'N11'
          ORDER BY id
        `
      ),
    ]);

    const localRows =
      localResult.rows;

    const n11Map =
      new Map<
        string,
        N11Product
      >();

    for (
      const product of
        n11.products
    ) {
      const stockCode =
        text(
          product.stockCode
        );

      if (stockCode) {
        n11Map.set(
          stockCode,
          product
        );
      }
    }

    const localOpen =
      localRows.filter(
        (row: any) =>
          Boolean(
            row.external_product_id
          ) &&
          String(
            row.sync_status ||
              ""
          ).toUpperCase() ===
            "SYNCED" &&
          qty(row.quantity) > 0
      );

    const localOpenListingCount =
      localOpen.length;

    const localOpenDeviceCount =
      localOpen.reduce(
        (
          sum: number,
          row: any
        ) =>
          sum +
          qty(
            row.quantity
          ),
        0
      );

    const n11Positive =
      n11.products.filter(
        (product) =>
          qty(
            product.quantity
          ) > 0
      );

    const n11PositiveListingCount =
      n11Positive.length;

    const n11PositiveDeviceCount =
      n11Positive.reduce(
        (
          sum,
          product
        ) =>
          sum +
          qty(
            product.quantity
          ),
        0
      );

    const quantityMismatches:
      any[] = [];

    const localOnlyOpen:
      any[] = [];

    for (
      const row of localOpen
    ) {
      const stockCode =
        text(
          row.external_stock_code
        );

      const n11Product =
        n11Map.get(
          stockCode
        );

      if (!n11Product) {
        localOnlyOpen.push({
          id: row.id,
          stockCode,
          n11ProductId:
            row.external_product_id,
          title: row.title,
          localQuantity:
            qty(
              row.quantity
            ),
          syncStatus:
            row.sync_status,
          updatedAt:
            row.updated_at,
        });

        continue;
      }

      const localQuantity =
        qty(
          row.quantity
        );

      const n11Quantity =
        qty(
          n11Product.quantity
        );

      if (
        localQuantity !==
        n11Quantity
      ) {
        quantityMismatches.push({
          stockCode,
          title:
            row.title ||
            n11Product.title,
          localQuantity,
          n11Quantity,
          difference:
            localQuantity -
            n11Quantity,
          localUpdatedAt:
            row.updated_at,
        });
      }
    }

    const localStockCodes =
      new Set(
        localRows
          .map((row: any) =>
            text(
              row.external_stock_code
            )
          )
          .filter(Boolean)
      );

    const n11OnlyPositive =
      n11Positive
        .filter(
          (product) =>
            !localStockCodes.has(
              text(
                product.stockCode
              )
            )
        )
        .map(
          (product) => ({
            stockCode:
              text(
                product.stockCode
              ),
            n11ProductId:
              text(
                product.n11ProductId
              ),
            title:
              text(
                product.title
              ),
            quantity:
              qty(
                product.quantity
              ),
            status:
              text(
                product.status
              ),
            saleStatus:
              text(
                product.saleStatus
              ),
          })
        );

    const pendingLocal =
      localRows.filter(
        (row: any) =>
          [
            "CREATING",
            "IN_QUEUE",
            "SYNCED_PENDING_QUERY",
            "RETRY_READY",
          ].includes(
            String(
              row.sync_status ||
                ""
            ).toUpperCase()
          )
      );

    const errorLocal =
      localRows.filter(
        (row: any) =>
          String(
            row.sync_status ||
              ""
          ).toUpperCase() ===
            "ERROR"
      );

    const mergedLocal =
      localRows.filter(
        (row: any) =>
          String(
            row.sync_status ||
              ""
          ).toUpperCase() ===
            "MERGED_TO_POOL"
      );

    let conclusion =
      "";

    if (
      localOpenListingCount ===
        n11PositiveListingCount &&
      localOpenDeviceCount ===
        n11PositiveDeviceCount
    ) {
      conclusion =
        "FARK YOK. Panel ve N11 aynı: ilan sayısı ve toplam stok eşleşiyor.";
    } else if (
      localOpenListingCount ===
        n11PositiveListingCount &&
      localOpenDeviceCount !==
        n11PositiveListingCount
    ) {
      conclusion =
        "İlan sayısı aynı. Paneldeki büyük sayı fiziksel cihaz/quantity toplamı; N11'de gördüğünüz sayı ilan sayısı olabilir.";
    } else {
      conclusion =
        "Gerçek veri farkı var. localOnlyOpen / n11OnlyPositive / quantityMismatches alanlarına bakın.";
    }

    return json({
      success: true,
      readOnly: true,
      conclusion,

      n11: {
        reportedTotalProducts:
          n11.reportedTotal,
        fetchedUniqueProducts:
          n11.products.length,
        positiveStockListingCount:
          n11PositiveListingCount,
        positiveStockDeviceCount:
          n11PositiveDeviceCount,
        statusDistribution:
          distribution(
            n11.products,
            "status"
          ),
        saleStatusDistribution:
          distribution(
            n11.products,
            "saleStatus"
          ),
        fetchedPages:
          n11.fetchedPages,
      },

      panel: {
        totalLocalRows:
          localRows.length,
        openListingCount:
          localOpenListingCount,
        openDeviceCount:
          localOpenDeviceCount,
        pendingCount:
          pendingLocal.length,
        errorCount:
          errorLocal.length,
        mergedToPoolCount:
          mergedLocal.length,
      },

      difference: {
        openListingCount:
          localOpenListingCount -
          n11PositiveListingCount,
        openDeviceCount:
          localOpenDeviceCount -
          n11PositiveDeviceCount,
      },

      quantityMismatches,
      localOnlyOpen,
      n11OnlyPositive,

      checkedAt:
        new Date().toISOString(),
    });
  } catch (error) {
    console.error(
      "N11 STOCK DIAGNOSTIC ERROR:",
      error
    );

    return json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "N11 stok karşılaştırması yapılamadı.",
      },
      500
    );
  }
}
