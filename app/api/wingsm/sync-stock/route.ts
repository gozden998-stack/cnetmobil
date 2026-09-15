// app/api/wingsm/sync-stock/route.ts
//
// CNETMOBIL - WingSM -> PostgreSQL stok senkronu
//
// KESIN KURAL:
// - WingSM'e HICBIR ZAMAN yazmaz.
// - WingSM tarafinda sadece GET kullanir.
// - POST burada sadece BIZIM PostgreSQL'e yazar.
//
// Akis:
// 1) 5 WingSM deposunun 2el stoklarini oku.
// 2) Pozitif stoktaki benzersiz MalKod'lari bul.
// 3) Her MalKod icin /api/b2b/urun/kod/:kod oku.
// 4) listSeri icinden DepoKod + SeriNo al.
// 5) WingSM DepoMiktar ile IMEI sayisini karsilastir.
// 6) Guvenli cihazlari public.stock_devices tablosuna upsert et.
// 7) WingSM'de gercekten hedef magazaya gecmis TRANSFER_WAITING
//    talebi varsa yerelde COMPLETED yap.
//
// GET:
// - SADECE ONIZLEME.
// - PostgreSQL'e yazmaz.
//
// POST:
// - WingSM'i yine SADECE OKUR.
// - PostgreSQL stock_devices senkronunu yapar.
//
// Sadece super_admin kullanabilir.

import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  Pool,
  type PoolClient,
} from "pg";

import crypto from "crypto";

import {
  getWingSMProductByCode,
  getWingSMStock,
  WINGSM_DEPOT_MAP,
} from "@/app/lib/wingsm/server";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

export const revalidate = 0;

// ======================================================
// GLOBAL DB POOL
// ======================================================

declare global {
  // eslint-disable-next-line no-var
  var cnetWingSMSyncPool:
    | Pool
    | undefined;
}

// ======================================================
// SABITLER
// ======================================================

const COOKIE_NAME =
  "cnet_auth";

const DETAIL_CONCURRENCY =
  6;

const MANAGED_BRANCHES = [
  "CNET",
  "CMR",
  "CADDE",
  "SARAY",
  "KAPAKLI",
] as const;

type BranchCode =
  (typeof MANAGED_BRANCHES)[number];

type SessionPayload = {
  userId: number | null;

  role:
    | "admin"
    | "personel";

  branch: string;

  exp: number;

  legacy?: boolean;
};

type ActiveUser = {
  id: number;
  username: string;
  isSuperAdmin: boolean;
};

type WingStockRow = {
  Id?: number | string;

  MalId?: number | string;

  MalKod?: string;

  MalAd?: string;

  MalCinsAd?: string;

  MalGrupAd?: string;

  MalGrup2Ad?: string;

  Depo?: string;

  DepoMiktar?:
    | number
    | string;

  MalSinifKod?: string;

  [key: string]: any;
};

type DeviceCandidate = {
  imei: string;

  branchCode:
    BranchCode;

  wingDepotCode:
    string;

  productCode:
    string;

  brand: string;

  model: string;

  memory: string;

  color: string;

  productName: string;
};

type ExistingDeviceRow = {
  id: number;

  imei: string;

  source: string;

  status: string;

  current_branch_code:
    string;

  request_id:
    number | null;

  request_status:
    string | null;

  requester_branch_code:
    string | null;

  owner_branch_code:
    string | null;
};

type SnapshotResult = {
  candidates:
    DeviceCandidate[];

  stockReadErrors:
    Array<{
      branch: string;
      depot: string;
      error: string;
    }>;

  detailErrors:
    Array<{
      productCode: string;
      error: string;
    }>;

  mismatches:
    Array<{
      productCode: string;
      productName: string;
      branch: string;
      depot: string;
      stockQuantity: number;
      imeiCount: number;
    }>;

  serialConflicts:
    Array<{
      imei: string;
      first:
        string;
      second:
        string;
    }>;

  productCount:
    number;

  stockRowCount:
    number;

  successfulBranches:
    string[];

  safeForMissing:
    boolean;
};

// ======================================================
// JSON
// ======================================================

function json(
  body: Record<
    string,
    unknown
  >,
  status = 200
) {
  return NextResponse.json(
    body,
    {
      status,

      headers: {
        "Cache-Control":
          "no-store, max-age=0",

        Pragma:
          "no-cache",

        "X-Content-Type-Options":
          "nosniff",
      },
    }
  );
}

// ======================================================
// DB
// ======================================================

function getPool() {
  const connectionString =
    process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL bulunamadı."
    );
  }

  if (
    !global
      .cnetWingSMSyncPool
  ) {
    global
      .cnetWingSMSyncPool =
      new Pool({
        connectionString,

        max: 4,

        idleTimeoutMillis:
          30_000,

        connectionTimeoutMillis:
          10_000,
      });
  }

  return global
    .cnetWingSMSyncPool;
}

// ======================================================
// SESSION
// ======================================================

function getSessionSecret() {
  const secret =
    process.env
      .SESSION_SECRET;

  if (!secret) {
    throw new Error(
      "SESSION_SECRET bulunamadı."
    );
  }

  return secret;
}

function verifySession(
  token: string
): SessionPayload | null {
  try {
    const [
      encoded,
      signature,
    ] = token.split(".");

    if (
      !encoded ||
      !signature
    ) {
      return null;
    }

    const expected =
      crypto
        .createHmac(
          "sha256",
          getSessionSecret()
        )
        .update(encoded)
        .digest(
          "base64url"
        );

    const a =
      Buffer.from(
        signature,
        "utf8"
      );

    const b =
      Buffer.from(
        expected,
        "utf8"
      );

    if (
      a.length !==
        b.length ||
      !crypto.timingSafeEqual(
        a,
        b
      )
    ) {
      return null;
    }

    const payload =
      JSON.parse(
        Buffer.from(
          encoded,
          "base64url"
        ).toString(
          "utf8"
        )
      ) as SessionPayload;

    if (
      !payload?.userId ||
      !payload?.exp ||
      payload.exp <
        Math.floor(
          Date.now() /
            1000
        )
    ) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

async function getSuperAdmin(
  request: NextRequest
): Promise<
  ActiveUser | null
> {
  const token =
    request.cookies.get(
      COOKIE_NAME
    )?.value;

  if (!token) {
    return null;
  }

  const session =
    verifySession(
      token
    );

  if (
    !session?.userId
  ) {
    return null;
  }

  const result =
    await getPool().query(
      `
        SELECT
          u.id,
          u.username,
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
      [
        session.userId,
      ]
    );

  const row =
    result.rows[0];

  if (
    !row ||
    row.active !== true ||
    row.is_super_admin !==
      true
  ) {
    return null;
  }

  return {
    id:
      Number(row.id),

    username:
      String(
        row.username
      ),

    isSuperAdmin:
      true,
  };
}

// ======================================================
// POST ORIGIN KONTROL
// ======================================================

function validateOrigin(
  request: NextRequest
) {
  const origin =
    request.headers.get(
      "origin"
    );

  if (!origin) {
    return false;
  }

  const expectedAppUrl =
    process.env.APP_URL;

  if (expectedAppUrl) {
    try {
      return (
        origin ===
        new URL(
          expectedAppUrl
        ).origin
      );
    } catch {
      return false;
    }
  }

  const host =
    request.headers.get(
      "host"
    );

  const proto =
    request.headers.get(
      "x-forwarded-proto"
    ) ||
    request.nextUrl.protocol.replace(
      ":",
      ""
    );

  if (!host) {
    return false;
  }

  return (
    origin ===
    `${proto}://${host}`
  );
}

// ======================================================
// STRING
// ======================================================

function text(
  value: unknown
) {
  return String(
    value ?? ""
  )
    .trim()
    .replace(
      /\s+/g,
      " "
    );
}

function numberOrZero(
  value: unknown
) {
  const number =
    Number(value);

  if (
    !Number.isFinite(
      number
    )
  ) {
    return 0;
  }

  return number;
}

function validImei(
  value: unknown
) {
  return /^[0-9]{14,16}$/.test(
    text(value)
  );
}

// ======================================================
// DEPO -> PANEL MAGAZA
// ======================================================

const DEPOT_TO_BRANCH =
  new Map<
    string,
    BranchCode
  >(
    MANAGED_BRANCHES.map(
      (branch) => [
        String(
          WINGSM_DEPOT_MAP[
            branch
          ]
        ),
        branch,
      ]
    )
  );

// ======================================================
// MEMORY
// ======================================================

function extractMemory(
  value: unknown
) {
  const raw =
    text(value)
      .toLocaleUpperCase(
        "tr-TR"
      );

  const match =
    raw.match(
      /\b(\d+(?:[.,]\d+)?)\s*(TB|GB)\b/i
    );

  if (!match) {
    return "";
  }

  return `${match[1].replace(
    ",",
    "."
  )} ${match[2].toUpperCase()}`;
}

// ======================================================
// MODEL
// ======================================================

function escapeRegex(
  value: string
) {
  return value.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );
}

function deriveModel(
  productName: string,
  brand: string,
  fallbackGroup: string
) {
  let value =
    text(productName);

  value =
    value.replace(
      /^\s*2\s*\.?\s*EL\s+/i,
      ""
    );

  if (brand) {
    value =
      value.replace(
        new RegExp(
          `^${escapeRegex(
            brand
          )}\\s+`,
          "i"
        ),
        ""
      );
  }

  // Hafizayi modelden ayir.
  value =
    value.replace(
      /\b\d+(?:[.,]\d+)?\s*(TB|GB)\b/gi,
      ""
    );

  value =
    value
      .replace(
        /\s*[-–—/]\s*$/g,
        ""
      )
      .replace(
        /\s+/g,
        " "
      )
      .trim();

  if (value) {
    return value;
  }

  const fallback =
    text(
      fallbackGroup
    )
      .replace(
        /\b\d+(?:[.,]\d+)?\s*(TB|GB)\b/gi,
        ""
      )
      .replace(
        /\s+/g,
        " "
      )
      .trim();

  return fallback;
}

// ======================================================
// PRODUCT META
// ======================================================

function productMeta(
  detail: any,
  stockRow?: WingStockRow
) {
  const data =
    detail?.data || {};

  const mamul =
    data?.mamul || {};

  const brand =
    text(
      data?.cins?.Ad ||
        mamul?.CinsAdI ||
        stockRow?.MalCinsAd
    );

  const productName =
    text(
      mamul?.Ad ||
        stockRow?.MalAd
    );

  const groupName =
    text(
      data?.grup?.Ad ||
        mamul?.GrupAdI ||
        stockRow?.MalGrupAd
    );

  const memory =
    extractMemory(
      productName
    ) ||
    extractMemory(
      groupName
    );

  const model =
    deriveModel(
      productName,
      brand,
      groupName
    );

  const color =
    text(
      data?.grup2?.Ad ||
        mamul?.Grup2AdI ||
        stockRow?.MalGrup2Ad
    );

  return {
    brand,
    model,
    memory,
    color,
    productName,
  };
}

// ======================================================
// CONCURRENCY
// ======================================================

async function mapLimit<
  T,
  R
>(
  items: T[],
  limit: number,
  worker: (
    item: T,
    index: number
  ) => Promise<R>
): Promise<R[]> {
  if (!items.length) {
    return [];
  }

  const results =
    new Array<R>(
      items.length
    );

  let cursor = 0;

  async function run() {
    while (true) {
      const index =
        cursor++;

      if (
        index >=
        items.length
      ) {
        return;
      }

      results[index] =
        await worker(
          items[index],
          index
        );
    }
  }

  const workerCount =
    Math.min(
      Math.max(
        1,
        limit
      ),
      items.length
    );

  await Promise.all(
    Array.from(
      {
        length:
          workerCount,
      },
      () => run()
    )
  );

  return results;
}

// ======================================================
// WINGSM SNAPSHOT
// ======================================================

async function buildWingSMSnapshot(): Promise<SnapshotResult> {
  const stockReadErrors:
    SnapshotResult["stockReadErrors"] =
    [];

  const detailErrors:
    SnapshotResult["detailErrors"] =
    [];

  const mismatches:
    SnapshotResult["mismatches"] =
    [];

  const serialConflicts:
    SnapshotResult["serialConflicts"] =
    [];

  const successfulBranches:
    string[] = [];

  // MalKod -> örnek stok satırı
  const sampleStockByCode =
    new Map<
      string,
      WingStockRow
    >();

  // MalKod|Depo -> WingSM DepoMiktar
  const expectedQuantity =
    new Map<
      string,
      number
    >();

  let stockRowCount = 0;

  // ==================================================
  // 5 DEPO STOK OKUMA
  // ==================================================

  await Promise.all(
    MANAGED_BRANCHES.map(
      async (
        branch
      ) => {
        const depot =
          String(
            WINGSM_DEPOT_MAP[
              branch
            ]
          );

        try {
          const response: any =
            await getWingSMStock(
              depot,
              true
            );

          const rows:
            WingStockRow[] =
            Array.isArray(
              response?.data
            )
              ? response.data
              : [];

          successfulBranches.push(
            branch
          );

          for (
            const row of
            rows
          ) {
            const quantity =
              numberOrZero(
                row?.DepoMiktar
              );

            if (
              quantity <= 0
            ) {
              continue;
            }

            const productCode =
              text(
                row?.MalKod
              );

            if (
              !productCode
            ) {
              continue;
            }

            stockRowCount +=
              1;

            if (
              !sampleStockByCode.has(
                productCode
              )
            ) {
              sampleStockByCode.set(
                productCode,
                row
              );
            }

            const key =
              `${productCode}|${depot}`;

            expectedQuantity.set(
              key,
              (
                expectedQuantity.get(
                  key
                ) || 0
              ) +
                quantity
            );
          }
        } catch (error) {
          stockReadErrors.push({
            branch,

            depot,

            error:
              error instanceof
              Error
                ? error.message
                : "WingSM stok okuma hatası.",
          });
        }
      }
    )
  );

  const productCodes =
    Array.from(
      sampleStockByCode.keys()
    );

  const successfulDepots =
    new Set(
      successfulBranches.map(
        (
          branch
        ) =>
          String(
            WINGSM_DEPOT_MAP[
              branch as BranchCode
            ]
          )
      )
    );

  // IMEI -> aday cihaz
  const candidateMap =
    new Map<
      string,
      DeviceCandidate
    >();

  // Conflict IMEI'leri sonra çıkaracağız.
  const conflictedImeis =
    new Set<string>();

  // ==================================================
  // HER MALKOD ICIN SADECE 1 DETAY CAGRI
  // ==================================================

  await mapLimit(
    productCodes,
    DETAIL_CONCURRENCY,
    async (
      productCode
    ) => {
      try {
        const detail: any =
          await getWingSMProductByCode(
            productCode
          );

        if (
          !detail?.success ||
          !detail?.data
        ) {
          detailErrors.push({
            productCode,

            error:
              "WingSM ürün detayı boş döndü.",
          });

          return;
        }

        const stockRow =
          sampleStockByCode.get(
            productCode
          );

        const meta =
          productMeta(
            detail,
            stockRow
          );

        const serialRows =
          Array.isArray(
            detail?.data
              ?.listSeri
          )
            ? detail.data
                .listSeri
            : [];

        // Sadece bizim takip ettiğimiz
        // ve stok okuması başarılı olan depolar.
        const managedSerials =
          serialRows.filter(
            (serial: any) => {
              const depot =
                text(
                  serial
                    ?.DepoKod
                );

              return (
                successfulDepots.has(
                  depot
                ) &&
                numberOrZero(
                  serial
                    ?.StokMiktar
                ) > 0
              );
            }
          );

        // ==================================================
        // DEPO BAZINDA ADET / IMEI KONTROLU
        // ==================================================

        let productSafe =
          true;

        for (
          const branch of
          MANAGED_BRANCHES
        ) {
          if (
            !successfulBranches.includes(
              branch
            )
          ) {
            continue;
          }

          const depot =
            String(
              WINGSM_DEPOT_MAP[
                branch
              ]
            );

          const stockQuantity =
            expectedQuantity.get(
              `${productCode}|${depot}`
            ) || 0;

          const depotSerials =
            managedSerials.filter(
              (serial: any) =>
                text(
                  serial
                    ?.DepoKod
                ) === depot &&
                validImei(
                  serial
                    ?.SeriNo
                )
            );

          const imeiCount =
            depotSerials.length;

          if (
            stockQuantity !==
            imeiCount
          ) {
            productSafe =
              false;

            mismatches.push({
              productCode,

              productName:
                meta.productName,

              branch,

              depot,

              stockQuantity,

              imeiCount,
            });
          }
        }

        // Bu MalKod'da adet / IMEI farkı varsa
        // o ürünü hiç senkronlamıyoruz.
        if (!productSafe) {
          return;
        }

        // ==================================================
        // FIZIKSEL CIHAZLARI OLUSTUR
        // ==================================================

        for (
          const serial of
          managedSerials
        ) {
          const imei =
            text(
              serial?.SeriNo
            );

          if (
            !validImei(
              imei
            )
          ) {
            continue;
          }

          const depot =
            text(
              serial?.DepoKod
            );

          const branchCode =
            DEPOT_TO_BRANCH.get(
              depot
            );

          if (
            !branchCode
          ) {
            continue;
          }

          const candidate:
            DeviceCandidate =
            {
              imei,

              branchCode,

              wingDepotCode:
                depot,

              productCode,

              brand:
                meta.brand,

              model:
                meta.model,

              memory:
                meta.memory,

              color:
                meta.color,

              productName:
                meta.productName,
            };

          const existing =
            candidateMap.get(
              imei
            );

          if (!existing) {
            candidateMap.set(
              imei,
              candidate
            );

            continue;
          }

          // Aynı IMEI aynı cihaz/depo ise duplicate
          // response olabilir, sorun değil.
          if (
            existing.productCode ===
              candidate.productCode &&
            existing.wingDepotCode ===
              candidate.wingDepotCode
          ) {
            continue;
          }

          // Aynı IMEI farklı ürün/depo altında görünüyorsa
          // veri bütünlüğü açısından senkronlamıyoruz.
          conflictedImeis.add(
            imei
          );

          serialConflicts.push({
            imei,

            first:
              `${existing.productCode}/${existing.wingDepotCode}`,

            second:
              `${candidate.productCode}/${candidate.wingDepotCode}`,
          });
        }
      } catch (error) {
        detailErrors.push({
          productCode,

          error:
            error instanceof
            Error
              ? error.message
              : "WingSM ürün detay okuma hatası.",
        });
      }
    }
  );

  for (
    const imei of
    conflictedImeis
  ) {
    candidateMap.delete(
      imei
    );
  }

  const candidates =
    Array.from(
      candidateMap.values()
    );

  const safeForMissing =
    stockReadErrors.length ===
      0 &&
    detailErrors.length ===
      0 &&
    mismatches.length ===
      0 &&
    serialConflicts.length ===
      0 &&
    successfulBranches.length ===
      MANAGED_BRANCHES.length;

  return {
    candidates,

    stockReadErrors,

    detailErrors,

    mismatches,

    serialConflicts,

    productCount:
      productCodes.length,

    stockRowCount,

    successfulBranches,

    safeForMissing,
  };
}

// ======================================================
// BRANCH SAYIM
// ======================================================

function branchCounts(
  candidates:
    DeviceCandidate[]
) {
  const result:
    Record<
      string,
      number
    > = {
    CNET: 0,
    CMR: 0,
    CADDE: 0,
    SARAY: 0,
    KAPAKLI: 0,
  };

  for (
    const device of
    candidates
  ) {
    result[
      device.branchCode
    ] =
      (
        result[
          device.branchCode
        ] || 0
      ) + 1;
  }

  return result;
}

// ======================================================
// EXISTING DEVICES
// ======================================================

async function getExistingDevices(
  client: PoolClient,
  imeis: string[]
) {
  const map =
    new Map<
      string,
      ExistingDeviceRow
    >();

  if (!imeis.length) {
    return map;
  }

  const result =
    await client.query(
      `
        SELECT
          sd.id,
          sd.imei,
          sd.source,
          sd.status,
          sd.current_branch_code,

          dr.id
            AS request_id,

          dr.status
            AS request_status,

          dr.requester_branch_code,

          dr.owner_branch_code

        FROM public.stock_devices sd

        LEFT JOIN LATERAL (
          SELECT
            r.id,
            r.status,
            r.requester_branch_code,
            r.owner_branch_code

          FROM public.device_requests r

          WHERE r.device_id =
            sd.id

            AND r.status IN (
              'PENDING',
              'SENT',
              'TRANSFER_WAITING'
            )

          ORDER BY
            r.requested_at DESC,
            r.id DESC

          LIMIT 1
        ) dr
          ON TRUE

        WHERE sd.imei =
          ANY($1::text[])
      `,
      [
        imeis,
      ]
    );

  for (
    const row of
    result.rows
  ) {
    map.set(
      String(row.imei),
      {
        id:
          Number(row.id),

        imei:
          String(row.imei),

        source:
          String(
            row.source ||
              ""
          ),

        status:
          String(
            row.status ||
              ""
          ),

        current_branch_code:
          String(
            row.current_branch_code ||
              ""
          ),

        request_id:
          row.request_id
            ? Number(
                row.request_id
              )
            : null,

        request_status:
          row.request_status
            ? String(
                row.request_status
              )
            : null,

        requester_branch_code:
          row.requester_branch_code
            ? String(
                row.requester_branch_code
              )
            : null,

        owner_branch_code:
          row.owner_branch_code
            ? String(
                row.owner_branch_code
              )
            : null,
      }
    );
  }

  return map;
}

// ======================================================
// DEVICE STATUS
// ======================================================

function desiredDeviceStatus(
  existing:
    ExistingDeviceRow | undefined,
  actualBranch:
    BranchCode
) {
  if (
    !existing?.request_id ||
    !existing
      ?.request_status
  ) {
    return "AVAILABLE";
  }

  const requestStatus =
    String(
      existing.request_status
    ).toUpperCase();

  const requesterBranch =
    String(
      existing.requester_branch_code ||
        ""
    ).toUpperCase();

  if (
    requestStatus ===
      "PENDING"
  ) {
    return "REQUESTED";
  }

  if (
    requestStatus ===
      "SENT" ||
    requestStatus ===
      "TRANSFER_WAITING"
  ) {
    // WingSM okumasinda cihaz gercekten
    // talep eden magazaya gecmisse transfer bitmistir.
    if (
      requesterBranch ===
      actualBranch
    ) {
      return "AVAILABLE";
    }

    return "TRANSFER_WAITING";
  }

  return "AVAILABLE";
}

// ======================================================
// TRANSFER TAMAMLANDI MI?
// ======================================================

function shouldCompleteTransfer(
  existing:
    ExistingDeviceRow | undefined,
  actualBranch:
    BranchCode
) {
  if (
    !existing?.request_id
  ) {
    return false;
  }

  const requestStatus =
    String(
      existing.request_status ||
        ""
    ).toUpperCase();

  if (
    requestStatus !==
      "SENT" &&
    requestStatus !==
      "TRANSFER_WAITING"
  ) {
    return false;
  }

  return (
    String(
      existing.requester_branch_code ||
        ""
    ).toUpperCase() ===
    actualBranch
  );
}

// ======================================================
// POSTGRES SYNC
// ======================================================

async function syncSnapshotToDatabase(
  snapshot:
    SnapshotResult,
  actor:
    ActiveUser
) {
  if (
    !snapshot
      .candidates.length
  ) {
    throw new Error(
      "Senkronlanacak WingSM IMEI kaydı bulunamadı."
    );
  }

  const client =
    await getPool().connect();

  const syncStartedAt =
    new Date();

  let inserted = 0;
  let updated = 0;
  let branchMoved = 0;
  let completedTransfers =
    0;
  let missingMarked = 0;

  try {
    await client.query(
      "BEGIN"
    );

    // Aynı anda iki stok sync çalışmasın.
    await client.query(
      `
        SELECT
          pg_advisory_xact_lock(
            hashtext(
              'cnet_wingsm_stock_sync'
            )
          )
      `
    );

    const imeis =
      snapshot.candidates.map(
        (
          item
        ) => item.imei
      );

    const existingMap =
      await getExistingDevices(
        client,
        imeis
      );

    for (
      const device of
      snapshot.candidates
    ) {
      const existing =
        existingMap.get(
          device.imei
        );

      const status =
        desiredDeviceStatus(
          existing,
          device.branchCode
        );

      const isTransferCompleted =
        shouldCompleteTransfer(
          existing,
          device.branchCode
        );

      if (
        existing &&
        existing.current_branch_code !==
          device.branchCode
      ) {
        branchMoved += 1;
      }

      const result =
        await client.query(
          `
            INSERT INTO public.stock_devices (
              imei,
              brand,
              model,
              memory,
              color,

              battery_percent,
              grade,
              warranty,
              changed_parts,
              box_invoice,

              current_branch_code,
              status,
              source,

              wing_product_code,
              wing_branch_code,
              wing_status,
              wing_last_seen_at,

              details_completed_at,
              details_completed_by,

              created_by
            )
            VALUES (
              $1,
              NULLIF($2, ''),
              NULLIF($3, ''),
              NULLIF($4, ''),
              NULLIF($5, ''),

              NULL,
              NULL,
              NULL,
              NULL,
              NULL,

              $6,
              $7,
              'WINGSM',

              $8,
              $9,
              'IN_STOCK',
              $10,

              NULL,
              NULL,

              $11
            )

            ON CONFLICT (imei)
            DO UPDATE SET

              brand =
                COALESCE(
                  NULLIF(
                    EXCLUDED.brand,
                    ''
                  ),
                  stock_devices.brand
                ),

              model =
                COALESCE(
                  NULLIF(
                    EXCLUDED.model,
                    ''
                  ),
                  stock_devices.model
                ),

              memory =
                COALESCE(
                  NULLIF(
                    EXCLUDED.memory,
                    ''
                  ),
                  stock_devices.memory
                ),

              color =
                CASE
                  WHEN
                    EXCLUDED.color IS NULL
                    OR EXCLUDED.color = ''
                    OR EXCLUDED.color IN (
                      'DİĞER',
                      'DIGER'
                    )
                  THEN
                    COALESCE(
                      stock_devices.color,
                      EXCLUDED.color
                    )

                  ELSE
                    EXCLUDED.color
                END,

              current_branch_code =
                EXCLUDED.current_branch_code,

              status =
                EXCLUDED.status,

              source =
                CASE
                  WHEN
                    stock_devices.source =
                      'MANUAL'
                  THEN
                    'MIXED'

                  WHEN
                    stock_devices.source =
                      'MIXED'
                  THEN
                    'MIXED'

                  ELSE
                    'WINGSM'
                END,

              wing_product_code =
                EXCLUDED.wing_product_code,

              wing_branch_code =
                EXCLUDED.wing_branch_code,

              wing_status =
                'IN_STOCK',

              wing_last_seen_at =
                EXCLUDED.wing_last_seen_at

            RETURNING
              id,
              imei,
              current_branch_code,
              status,
              source
          `,
          [
            device.imei,

            device.brand,

            device.model,

            device.memory,

            device.color,

            device.branchCode,

            status,

            device.productCode,

            device.wingDepotCode,

            syncStartedAt,

            `WINGSM_SYNC:${actor.username}`,
          ]
        );

      const deviceId =
        Number(
          result.rows[0]
            ?.id
        );

      if (existing) {
        updated += 1;
      } else {
        inserted += 1;
      }

      // ==================================================
      // DISARIDA WINGSM TRANSFERI GERCEKTEN YAPILDIYSA
      // ==================================================

      if (
        isTransferCompleted &&
        existing?.request_id &&
        deviceId
      ) {
        const requestResult =
          await client.query(
            `
              UPDATE public.device_requests

              SET
                status =
                  'COMPLETED',

                completed_at =
                  COALESCE(
                    completed_at,
                    $2
                  ),

                updated_at =
                  $2

              WHERE id = $1

                AND status IN (
                  'SENT',
                  'TRANSFER_WAITING'
                )

              RETURNING id
            `,
            [
              existing.request_id,
              syncStartedAt,
            ]
          );

        if (
          requestResult
            .rowCount
        ) {
          completedTransfers +=
            1;

          // Varsa yerel transfer takip kaydını da bitir.
          await client.query(
            `
              UPDATE public.device_transfers

              SET
                status =
                  'COMPLETED',

                wing_transfer_at =
                  COALESCE(
                    wing_transfer_at,
                    $2
                  ),

                wing_reference =
                  COALESCE(
                    wing_reference,
                    'WINGSM_READ_SYNC'
                  ),

                completed_at =
                  COALESCE(
                    completed_at,
                    $2
                  ),

                updated_at =
                  $2

              WHERE request_id =
                $1

                AND status =
                  'WAITING_WING'
            `,
            [
              existing.request_id,
              syncStartedAt,
            ]
          );
        }
      }
    }

    // ==================================================
    // WINGSM'DE ARTIK GORUNMEYEN CIHAZLAR
    // ==================================================
    //
    // Bunu SADECE bütün snapshot tamamen temizse yapıyoruz.
    //
    // Tek bir WingSM API hatası / adet farkı varsa cihazları
    // yanlışlıkla MISSING yapmıyoruz.
    //
    // MIXED kayıtta manuel bilgiler korunur; sadece wing_status
    // MISSING olur.
    //
    // Saf WINGSM kaydında aktif talep yoksa status=MISSING olur.
    // ==================================================

    if (
      snapshot.safeForMissing
    ) {
      const missingResult =
        await client.query(
          `
            UPDATE public.stock_devices sd

            SET
              wing_status =
                'MISSING',

              status =
                CASE

                  WHEN
                    sd.source =
                      'WINGSM'

                    AND NOT EXISTS (
                      SELECT 1

                      FROM public.device_requests dr

                      WHERE dr.device_id =
                        sd.id

                        AND dr.status IN (
                          'PENDING',
                          'SENT',
                          'TRANSFER_WAITING'
                        )
                    )

                  THEN
                    'MISSING'

                  ELSE
                    sd.status
                END

            WHERE
              sd.source IN (
                'WINGSM',
                'MIXED'
              )

              AND (
                sd.wing_last_seen_at
                  IS NULL

                OR
                sd.wing_last_seen_at
                  < $1
              )

              AND
                COALESCE(
                  sd.wing_status,
                  ''
                ) <> 'MISSING'
          `,
          [
            syncStartedAt,
          ]
        );

      missingMarked =
        missingResult.rowCount ||
        0;
    }

    await client.query(
      "COMMIT"
    );

    return {
      inserted,
      updated,
      branchMoved,
      completedTransfers,
      missingMarked,

      syncStartedAt:
        syncStartedAt.toISOString(),
    };
  } catch (error) {
    try {
      await client.query(
        "ROLLBACK"
      );
    } catch {}

    throw error;
  } finally {
    client.release();
  }
}

// ======================================================
// GET - SADECE ONIZLEME
// ======================================================

export async function GET(
  request: NextRequest
) {
  try {
    const user =
      await getSuperAdmin(
        request
      );

    if (!user) {
      return json(
        {
          success: false,
          error:
            "Super Admin yetkisi gerekli.",
        },
        403
      );
    }

    const snapshot =
      await buildWingSMSnapshot();

    return json({
      success: true,

      mode:
        "PREVIEW_ONLY",

      message:
        "WingSM stokları okundu. PostgreSQL'e hiçbir değişiklik yapılmadı.",

      wingSMWrite:
        false,

      postgresWrite:
        false,

      summary: {
        productCount:
          snapshot.productCount,

        stockRowCount:
          snapshot.stockRowCount,

        imeiCount:
          snapshot
            .candidates.length,

        branchCounts:
          branchCounts(
            snapshot.candidates
          ),

        successfulBranches:
          snapshot
            .successfulBranches,

        safeForMissing:
          snapshot
            .safeForMissing,

        stockReadErrorCount:
          snapshot
            .stockReadErrors
            .length,

        detailErrorCount:
          snapshot
            .detailErrors
            .length,

        mismatchCount:
          snapshot
            .mismatches
            .length,

        conflictCount:
          snapshot
            .serialConflicts
            .length,
      },

      errors: {
        stockRead:
          snapshot
            .stockReadErrors,

        productDetail:
          snapshot
            .detailErrors
            .slice(
              0,
              30
            ),

        mismatches:
          snapshot
            .mismatches
            .slice(
              0,
              50
            ),

        serialConflicts:
          snapshot
            .serialConflicts
            .slice(
              0,
              50
            ),
      },

      sampleDevices:
        snapshot
          .candidates
          .slice(
            0,
            20
          )
          .map(
            (
              item
            ) => ({
              branch:
                item.branchCode,

              depot:
                item.wingDepotCode,

              productCode:
                item.productCode,

              brand:
                item.brand,

              model:
                item.model,

              memory:
                item.memory,

              color:
                item.color,

              imei:
                item.imei,
            })
          ),
    });
  } catch (error) {
    console.error(
      "WINGSM SYNC PREVIEW ERROR:",
      error
    );

    return json(
      {
        success: false,

        error:
          error instanceof
          Error
            ? error.message
            : "WingSM stok önizlemesi alınamadı.",
      },
      500
    );
  }
}

// ======================================================
// POST - POSTGRESQL SENKRON
// ======================================================

export async function POST(
  request: NextRequest
) {
  try {
    if (
      !validateOrigin(
        request
      )
    ) {
      return json(
        {
          success: false,
          error:
            "Geçersiz istek kaynağı.",
        },
        403
      );
    }

    const user =
      await getSuperAdmin(
        request
      );

    if (!user) {
      return json(
        {
          success: false,
          error:
            "Super Admin yetkisi gerekli.",
        },
        403
      );
    }

    const snapshot =
      await buildWingSMSnapshot();

    if (
      !snapshot
        .candidates.length
    ) {
      return json(
        {
          success: false,

          error:
            "WingSM'den senkronlanabilir IMEI bulunamadı.",

          diagnostics: {
            stockReadErrors:
              snapshot
                .stockReadErrors,

            detailErrors:
              snapshot
                .detailErrors,

            mismatches:
              snapshot
                .mismatches,

            serialConflicts:
              snapshot
                .serialConflicts,
          },
        },
        409
      );
    }

    const sync =
      await syncSnapshotToDatabase(
        snapshot,
        user
      );

    return json({
      success: true,

      message:
        "WingSM stokları PostgreSQL ile senkronlandı.",

      wingSMWrite:
        false,

      postgresWrite:
        true,

      summary: {
        products:
          snapshot
            .productCount,

        stockRows:
          snapshot
            .stockRowCount,

        imeis:
          snapshot
            .candidates
            .length,

        branches:
          branchCounts(
            snapshot.candidates
          ),

        inserted:
          sync.inserted,

        updated:
          sync.updated,

        branchMoved:
          sync.branchMoved,

        completedTransfers:
          sync.completedTransfers,

        missingMarked:
          sync.missingMarked,

        safeForMissing:
          snapshot
            .safeForMissing,

        stockReadErrorCount:
          snapshot
            .stockReadErrors
            .length,

        detailErrorCount:
          snapshot
            .detailErrors
            .length,

        mismatchCount:
          snapshot
            .mismatches
            .length,

        conflictCount:
          snapshot
            .serialConflicts
            .length,

        syncedAt:
          sync.syncStartedAt,
      },

      warnings: {
        stockReadErrors:
          snapshot
            .stockReadErrors,

        detailErrors:
          snapshot
            .detailErrors
            .slice(
              0,
              30
            ),

        mismatches:
          snapshot
            .mismatches
            .slice(
              0,
              50
            ),

        serialConflicts:
          snapshot
            .serialConflicts
            .slice(
              0,
              50
            ),
      },
    });
  } catch (error) {
    console.error(
      "WINGSM STOCK SYNC ERROR:",
      error
    );

    return json(
      {
        success: false,

        error:
          error instanceof
          Error
            ? error.message
            : "WingSM stok senkronu başarısız.",
      },
      500
    );
  }
}
