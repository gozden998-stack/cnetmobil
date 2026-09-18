// app/api/wingsm/sync-stock/route.ts
//
// CNETMOBIL - WingSM -> PostgreSQL stok senkronu
//
// KESIN KURAL:
// - WingSM'e is verisi YAZMAZ.
// - WingSM tarafinda sadece stok / urun GET okunur.
// - POST bu route'u tetiklemek icindir; WingSM'e POST yapmaz.
//
// BU ROUTE:
// 1) 5 WingSM deposunun 2el stoklarini okur.
// 2) MalKod listesini toplar.
// 3) Her MalKod icin urun/kod detail GET yapar.
// 4) listSeri icinden fiziksel IMEI'leri cikarir.
// 5) DepoMiktar <-> IMEI sayisini dogrular.
// 6) stock_devices tablosunu besler.
// 7) wingsm_device_locations tablosuna GERCEK WingSM konum kanitini yazar.
// 8) wingsm_sync_runs tablosuna basarili sync kaydi yazar.
//
// ONEMLI:
// - TRANSFER_WAITING cihazlarin current_branch_code degerini burada
//   hedef magazaya TASIMAZ.
// - Talebi burada COMPLETED YAPMAZ.
// - device_transfers kaydini burada COMPLETED YAPMAZ.
// - Bunlari mevcut:
//     /api/wingsm/transfers/complete
//   endpointi yapar.
//
// Böylece:
// GONDERILDI
// -> TRANSFER_WAITING
// -> WingSM gercek transfer
// -> bu sync WingSM konumunu dogrular
// -> complete route transferi tamamlar.

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

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
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
  "MERKEZ",
  "CNET",
  "CMR",
  "CADDE",
  "SARAY",
  "KAPAKLI",
] as const;

type BranchCode =
  (typeof MANAGED_BRANCHES)[number];

// ======================================================
// TYPES
// ======================================================

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
  current_branch_code: string;

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
      first: string;
      second: string;
    }>;

  productCount:
    number;

  stockRowCount:
    number;

  successfulBranches:
    string[];

  safeForMissing:
    boolean;

  startedAt:
    Date;

  finishedAt:
    Date;
};

type TableColumn = {
  column_name: string;
  is_nullable: string;
  column_default:
    string | null;
  is_identity: string;
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
    process.env
      .DATABASE_URL;

  if (
    !connectionString
  ) {
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

            WHERE
              ur.user_id = u.id

              AND
              r.code =
                'super_admin'

              AND
              r.active =
                TRUE
          ) AS is_super_admin

        FROM public.users u

        WHERE
          u.id = $1

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
      Number(
        row.id
      ),

    username:
      String(
        row.username
      ),

    isSuperAdmin:
      true,
  };
}

// ======================================================
// MANUEL POST ORIGIN
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

  if (
    expectedAppUrl
  ) {
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
    request.nextUrl
      .protocol
      .replace(
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
// CRON SECRET
// ======================================================

function isCronAuthorized(
  request: NextRequest
) {
  const secret =
    String(
      process.env
        .WINGSM_SYNC_SECRET ||
        ""
    ).trim();

  if (!secret) {
    return false;
  }

  const received =
    String(
      request.headers.get(
        "authorization"
      ) || ""
    );

  const expected =
    `Bearer ${secret}`;

  const a =
    Buffer.from(
      received,
      "utf8"
    );

  const b =
    Buffer.from(
      expected,
      "utf8"
    );

  if (
    a.length !==
    b.length
  ) {
    return false;
  }

  return crypto
    .timingSafeEqual(
      a,
      b
    );
}

// ======================================================
// HELPERS
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

function quoteIdent(
  value: string
) {
  return `"${value.replace(
    /"/g,
    '""'
  )}"`;
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
      (
        branch
      ) => [
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
// WINGSM URUN ADI / HAFIZA NORMALIZASYONU
// ======================================================
//
// WingSM ikinci el urun adlari ornek:
//   2.EL APPLE IPHONE 11 64 GB
//   2.EL SAMSUNG GALAXY S24 256/8 GB
//
// PANEL KURALI:
// - marka ve model ayri tutulur; ekranda birlestirilince marka iki kez yazilmaz.
// - 256/8 GB gibi ifadede depolama = 256 GB kabul edilir.
// - renk WingSM'den ALINMAZ; personel DÜZENLE ekranindan girer.
// ======================================================

function normalizeCapacity(
  value: string,
  unit: string
) {
  const numeric =
    Number(
      String(value || "")
        .replace(",", ".")
    );

  if (
    !Number.isFinite(numeric) ||
    numeric <= 0
  ) {
    return "";
  }

  const cleanNumber =
    Number.isInteger(numeric)
      ? String(numeric)
      : String(numeric);

  return `${cleanNumber} ${String(unit || "")
    .toUpperCase()}`;
}

function extractMemory(
  value: unknown
) {
  const raw =
    text(
      value
    ).toLocaleUpperCase(
      "tr-TR"
    );

  // 256/8 GB, 128 / 6GB vb.
  // WingSM'de ilk deger depolama, ikinci deger RAM olabilir.
  // Ek guvenlik icin iki sayidan buyuk olani depolama kabul ediyoruz.
  const pairMatch =
    raw.match(
      /\b(\d+(?:[.,]\d+)?)\s*\/\s*(\d+(?:[.,]\d+)?)\s*(TB|GB)\b/i
    );

  if (pairMatch) {
    const first =
      Number(
        pairMatch[1].replace(
          ",",
          "."
        )
      );

    const second =
      Number(
        pairMatch[2].replace(
          ",",
          "."
        )
      );

    const storage =
      Math.max(
        first,
        second
      );

    return normalizeCapacity(
      String(storage),
      pairMatch[3]
    );
  }

  const singleMatch =
    raw.match(
      /\b(\d+(?:[.,]\d+)?)\s*(TB|GB)\b/i
    );

  if (!singleMatch) {
    return "";
  }

  return normalizeCapacity(
    singleMatch[1],
    singleMatch[2]
  );
}

function stripMemoryTokens(
  value: unknown
) {
  return text(value)
    // Once 256/8 GB gibi depolama/RAM ifadesini komple temizle.
    .replace(
      /\b\d+(?:[.,]\d+)?\s*\/\s*\d+(?:[.,]\d+)?\s*(TB|GB)\b/gi,
      " "
    )
    // Sonra tekli 64 GB / 1TB gibi hafiza ifadelerini temizle.
    .replace(
      /\b\d+(?:[.,]\d+)?\s*(TB|GB)\b/gi,
      " "
    )
    .replace(
      /\s+/g,
      " "
    )
    .trim();
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

function stripSecondHandPrefix(
  value: unknown
) {
  return text(value)
    .replace(
      /^\s*2\s*\.?\s*EL\s+/i,
      ""
    )
    .replace(
      /^\s*2EL\s+/i,
      ""
    )
    .trim();
}

function deriveModel(
  productName: string,
  brand: string,
  fallbackGroup: string
) {
  let value =
    stripSecondHandPrefix(
      productName
    );

  // Ekran zaten brand + model olarak gosteriyor.
  // Bu nedenle model alaninin basinda markayi ikinci kez tutmuyoruz.
  if (brand) {
    value =
      value.replace(
        new RegExp(
          `^${escapeRegex(
            brand
          )}(?:\\s+|$)`,
          "i"
        ),
        ""
      );
  }

  value =
    stripMemoryTokens(
      value
    )
      .replace(
        /^\s*[-–—/]\s*/g,
        ""
      )
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

  let fallback =
    stripSecondHandPrefix(
      fallbackGroup
    );

  if (brand) {
    fallback =
      fallback.replace(
        new RegExp(
          `^${escapeRegex(
            brand
          )}(?:\\s+|$)`,
          "i"
        ),
        ""
      );
  }

  return stripMemoryTokens(
    fallback
  )
    .replace(
      /\s+/g,
      " "
    )
    .trim();
}

// ======================================================
// PRODUCT META
// ======================================================

function productMeta(
  detail: any,
  stockRow?: WingStockRow
) {
  const data =
    detail?.data ||
    {};

  const mamul =
    data?.mamul ||
    {};

  // WingSM stok ekraninda gorulen MalAd'i once kullan.
  // Böylece panel ismi WingSM'deki urun adiyla ayni kaynaktan gelir.
  const productName =
    text(
      stockRow?.MalAd ||
        mamul?.Ad
    );

  const brand =
    text(
      stockRow?.MalCinsAd ||
        data?.cins?.Ad ||
        mamul?.CinsAdI
    );

  const groupName =
    text(
      stockRow?.MalGrupAd ||
        data?.grup?.Ad ||
        mamul?.GrupAdI
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

  // KESIN KURAL:
  // WingSM ikinci el stok kaydindan renk alma.
  // Renk IMEI bazinda personel tarafindan DÜZENLE ile girilecek.
  const color =
    "";

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
  if (
    !items.length
  ) {
    return [];
  }

  const results =
    new Array<R>(
      items.length
    );

  let cursor =
    0;

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

async function buildWingSMSnapshot():
Promise<SnapshotResult> {
  const startedAt =
    new Date();

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

  const sampleStockByCode =
    new Map<
      string,
      WingStockRow
    >();

  const expectedQuantity =
    new Map<
      string,
      number
    >();

  let stockRowCount =
    0;

  // ==================================================
  // 5 DEPO
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
          const response:
            any =
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
                row
                  ?.DepoMiktar
              );

            if (
              quantity <=
              0
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
        } catch (
          error
        ) {
          stockReadErrors.push(
            {
              branch,

              depot,

              error:
                error instanceof
                Error
                  ? error.message
                  : "WingSM stok okuma hatası.",
            }
          );
        }
      }
    )
  );

  const productCodes =
    Array.from(
      sampleStockByCode
        .keys()
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

  const candidateMap =
    new Map<
      string,
      DeviceCandidate
    >();

  const conflictedImeis =
    new Set<string>();

  // ==================================================
  // HER MALKOD 1 KEZ
  // ==================================================

  await mapLimit(
    productCodes,
    DETAIL_CONCURRENCY,
    async (
      productCode
    ) => {
      try {
        const detail:
          any =
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

        const managedSerials =
          serialRows.filter(
            (
              serial: any
            ) => {
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
                ) >
                  0
              );
            }
          );

        // ==============================================
        // ADET <-> IMEI KONTROL
        // ==============================================

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
              (
                serial: any
              ) =>
                text(
                  serial
                    ?.DepoKod
                ) ===
                  depot &&
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

        if (
          !productSafe
        ) {
          return;
        }

        // ==============================================
        // FIZIKSEL IMEI
        // ==============================================

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

          if (
            !existing
          ) {
            candidateMap.set(
              imei,
              candidate
            );

            continue;
          }

          if (
            existing
              .productCode ===
              candidate
                .productCode &&
            existing
              .wingDepotCode ===
              candidate
                .wingDepotCode
          ) {
            continue;
          }

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
      } catch (
        error
      ) {
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

    startedAt,

    finishedAt:
      new Date(),
  };
}

// ======================================================
// BRANCH COUNTS
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
    MERKEZ: 0,
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
// EXISTING DEVICES + ACTIVE REQUEST
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

  if (
    !imeis.length
  ) {
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

          WHERE
            r.device_id =
              sd.id

            AND
            r.status IN (
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

        WHERE
          sd.imei =
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
      String(
        row.imei
      ),
      {
        id:
          Number(
            row.id
          ),

        imei:
          String(
            row.imei
          ),

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
            row
              .current_branch_code ||
              ""
          ),

        request_id:
          row.request_id
            ? Number(
                row
                  .request_id
              )
            : null,

        request_status:
          row.request_status
            ? String(
                row
                  .request_status
              )
            : null,

        requester_branch_code:
          row
            .requester_branch_code
            ? String(
                row
                  .requester_branch_code
              )
            : null,

        owner_branch_code:
          row
            .owner_branch_code
            ? String(
                row
                  .owner_branch_code
              )
            : null,
      }
    );
  }

  return map;
}

// ======================================================
// LOCAL DEVICE STATE
//
// TRANSFER_WAITING ise burada magazayi DEGISTIRMIYORUZ.
//
// WingSM gercek konum:
// wingsm_device_locations
//
// Panel sahipligi:
// stock_devices.current_branch_code
//
// Transferi mevcut complete route tamamlayacak.
// ======================================================

function resolveLocalDeviceState(
  existing:
    ExistingDeviceRow |
    undefined,

  actualWingBranch:
    BranchCode
) {
  if (
    !existing
  ) {
    return {
      currentBranch:
        actualWingBranch,

      status:
        "AVAILABLE",
    };
  }

  const oldStatus =
    text(
      existing.status
    ).toUpperCase();

  const requestStatus =
    text(
      existing
        .request_status
    ).toUpperCase();

  // SATILDI/PASIF kaydi stok sync ile
  // yanlislikla tekrar aktife alma.
  if (
    oldStatus ===
      "SOLD" ||
    oldStatus ===
      "PASSIVE"
  ) {
    return {
      currentBranch:
        existing
          .current_branch_code,

      status:
        oldStatus,
    };
  }

  // Talep daha yeni acildi.
  if (
    requestStatus ===
      "PENDING"
  ) {
    return {
      currentBranch:
        existing
          .current_branch_code,

      status:
        "REQUESTED",
    };
  }

  // GONDERILDI / WINGSM TRANSFER BEKLENIYOR.
  //
  // WingSM cihaz hedef depoya gecmis olsa bile
  // burada local sahipligi degistirmiyoruz.
  //
  // /api/wingsm/transfers/complete
  // gercek WingSM kanitini kontrol edip tasiyacak.
  if (
    requestStatus ===
      "SENT" ||
    requestStatus ===
      "TRANSFER_WAITING"
  ) {
    return {
      currentBranch:
        existing
          .current_branch_code,

      status:
        "TRANSFER_WAITING",
    };
  }

  // Aktif talep yoksa WingSM gercek stok konumu
  // panel stok sahibini belirler.
  return {
    currentBranch:
      actualWingBranch,

    status:
      "AVAILABLE",
  };
}

// ======================================================
// WING SUPPORT TABLE KONTROL
// ======================================================

async function tableExists(
  client: PoolClient,
  tableName: string
) {
  const result =
    await client.query(
      `
        SELECT
          to_regclass(
            $1
          ) AS table_name
      `,
      [
        `public.${tableName}`,
      ]
    );

  return Boolean(
    result.rows[0]
      ?.table_name
  );
}

async function getTableColumns(
  client: PoolClient,
  tableName: string
): Promise<
  TableColumn[]
> {
  const result =
    await client.query(
      `
        SELECT
          column_name,
          is_nullable,
          column_default,
          is_identity

        FROM information_schema.columns

        WHERE
          table_schema =
            'public'

          AND
          table_name = $1

        ORDER BY
          ordinal_position
      `,
      [
        tableName,
      ]
    );

  return result
    .rows as TableColumn[];
}

async function ensureWingSupportTables(
  client: PoolClient
) {
  const [
    hasLocations,
    hasRuns,
  ] =
    await Promise.all([
      tableExists(
        client,
        "wingsm_device_locations"
      ),

      tableExists(
        client,
        "wingsm_sync_runs"
      ),
    ]);

  if (
    !hasLocations
  ) {
    throw new Error(
      "public.wingsm_device_locations tablosu bulunamadı. Mevcut WingSM transfer altyapısı eksik."
    );
  }

  if (
    !hasRuns
  ) {
    throw new Error(
      "public.wingsm_sync_runs tablosu bulunamadı. Mevcut WingSM transfer altyapısı eksik."
    );
  }
}

// ======================================================
// DINAMIK INSERT
//
// Eski WingSM tablolarinda fazladan kolon varsa
// mevcut şemaya uyum sağlar.
// ======================================================

async function insertAdaptive(
  client: PoolClient,
  tableName: string,
  values:
    Record<
      string,
      unknown
    >
) {
  const columns =
    await getTableColumns(
      client,
      tableName
    );

  if (
    !columns.length
  ) {
    throw new Error(
      `${tableName} kolonları okunamadı.`
    );
  }

  const available =
    new Set(
      columns.map(
        (
          column
        ) =>
          column
            .column_name
      )
    );

  const insertEntries =
    Object.entries(
      values
    ).filter(
      ([key]) =>
        available.has(
          key
        )
    );

  const supplied =
    new Set(
      insertEntries.map(
        ([key]) => key
      )
    );

  const missingRequired =
    columns.filter(
      (
        column
      ) =>
        column
          .is_nullable ===
          "NO" &&
        !column
          .column_default &&
        column
          .is_identity !==
          "YES" &&
        !supplied.has(
          column
            .column_name
        )
    );

  if (
    missingRequired.length
  ) {
    throw new Error(
      `${tableName} zorunlu kolon eksik: ${missingRequired
        .map(
          (
            column
          ) =>
            column
              .column_name
        )
        .join(", ")}`
    );
  }

  if (
    !insertEntries.length
  ) {
    throw new Error(
      `${tableName} için yazılabilir kolon bulunamadı.`
    );
  }

  const columnSql =
    insertEntries
      .map(
        ([key]) =>
          quoteIdent(
            key
          )
      )
      .join(", ");

  const placeholderSql =
    insertEntries
      .map(
        (
          _,
          index
        ) =>
          `$${index + 1}`
      )
      .join(", ");

  await client.query(
    `
      INSERT INTO public.${quoteIdent(
        tableName
      )} (
        ${columnSql}
      )
      VALUES (
        ${placeholderSql}
      )
    `,
    insertEntries.map(
      (
        [, value]
      ) => value
    )
  );
}

// ======================================================
// WINGSM DEVICE LOCATION
//
// Aynı IMEI icin tek son bilinen WingSM konumu tutulur.
// ======================================================

async function upsertWingLocation(
  client: PoolClient,
  device:
    DeviceCandidate,
  seenAt:
    Date
) {
  const columns =
    await getTableColumns(
      client,
      "wingsm_device_locations"
    );

  const available =
    new Set(
      columns.map(
        (
          column
        ) =>
          column
            .column_name
      )
    );

  const requiredForTransfer = [
    "serial_no",
    "panel_branch",
    "wingsm_depot",
    "product_code",
    "product_name",
    "updated_at",
  ];

  for (
    const column of
    requiredForTransfer
  ) {
    if (
      !available.has(
        column
      )
    ) {
      throw new Error(
        `wingsm_device_locations.${column} bulunamadı. Transfer doğrulama şeması eksik.`
      );
    }
  }

  const updateResult =
    await client.query(
      `
        UPDATE public.wingsm_device_locations

        SET
          panel_branch = $2,
          wingsm_depot = $3,
          product_code = $4,
          product_name = $5,
          updated_at = $6

        WHERE
          serial_no = $1
      `,
      [
        device.imei,

        device
          .branchCode,

        device
          .wingDepotCode,

        device
          .productCode,

        device
          .productName,

        seenAt,
      ]
    );

  if (
    updateResult.rowCount &&
    updateResult.rowCount >
      0
  ) {
    return;
  }

  // Tablo eski sürümse fazladan NOT NULL kolonlara
  // da mümkün olduğunca uyum sağla.
  await insertAdaptive(
    client,
    "wingsm_device_locations",
    {
      serial_no:
        device.imei,

      imei:
        device.imei,

      panel_branch:
        device
          .branchCode,

      branch_code:
        device
          .branchCode,

      wingsm_depot:
        device
          .wingDepotCode,

      depot_code:
        device
          .wingDepotCode,

      product_code:
        device
          .productCode,

      mal_kod:
        device
          .productCode,

      product_name:
        device
          .productName,

      mal_ad:
        device
          .productName,

      status:
        "IN_STOCK",

      stock_quantity:
        1,

      quantity:
        1,

      last_seen_at:
        seenAt,

      created_at:
        seenAt,

      updated_at:
        seenAt,
    }
  );
}

// ======================================================
// WINGSM SYNC RUN
//
// Mevcut transfer complete route:
// panel_branch + SUCCESS + started_at/finished_at
// alanlarini kontrol ediyor.
// ======================================================

async function insertSuccessfulSyncRun(
  client: PoolClient,
  branch:
    BranchCode,
  depot:
    string,
  count:
    number,
  startedAt:
    Date,
  finishedAt:
    Date
) {
  await insertAdaptive(
    client,
    "wingsm_sync_runs",
    {
      panel_branch:
        branch,

      branch_code:
        branch,

      wingsm_depot:
        depot,

      depot_code:
        depot,

      status:
        "SUCCESS",

      success:
        true,

      row_count:
        count,

      device_count:
        count,

      item_count:
        count,

      record_count:
        count,

      records_count:
        count,

      started_at:
        startedAt,

      finished_at:
        finishedAt,

      created_at:
        startedAt,

      updated_at:
        finishedAt,

      message:
        "WingSM stok ve IMEI senkronizasyonu başarılı.",

      error_message:
        null,
    }
  );
}

// ======================================================
// DATABASE SYNC
// ======================================================

async function syncSnapshotToDatabase(
  snapshot:
    SnapshotResult,
  actor:
    ActiveUser
) {
  if (
    !snapshot
      .candidates
      .length
  ) {
    throw new Error(
      "Senkronlanacak WingSM IMEI kaydı bulunamadı."
    );
  }

  const client =
    await getPool()
      .connect();

  const syncStartedAt =
    snapshot.startedAt;

  const seenAt =
    new Date();

  let inserted =
    0;

  let updated =
    0;

  let branchMoved =
    0;

  let wingLocationsUpdated =
    0;

  let syncRunsWritten =
    0;

  let missingMarked =
    0;

  try {
    await client.query(
      "BEGIN"
    );

    // Ayni anda iki sync calismasin.
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

    await ensureWingSupportTables(
      client
    );

    const imeis =
      snapshot
        .candidates
        .map(
          (
            device
          ) =>
            device.imei
        );

    const existingMap =
      await getExistingDevices(
        client,
        imeis
      );

    // ==================================================
    // CIHAZLAR
    // ==================================================

    for (
      const device of
      snapshot.candidates
    ) {
      const existing =
        existingMap.get(
          device.imei
        );

      const localState =
        resolveLocalDeviceState(
          existing,
          device
            .branchCode
        );

      if (
        existing &&
        existing
          .current_branch_code !==
          localState
            .currentBranch
      ) {
        branchMoved +=
          1;
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

              -- Marka/model/hafiza WingSM urun bilgisidir.
              -- Parser duzeltmeleri mevcut cihazlara da yansisin diye
              -- WingSM'den gelen temiz deger varsa guncellenir.
              -- Bu alanlar personelin IMEI detay duzenleme ekraninda
              -- degistirdigi alanlar degildir.

              brand =
                COALESCE(
                  NULLIF(
                    EXCLUDED.brand,
                    ''
                  ),
                  NULLIF(
                    stock_devices.brand,
                    ''
                  )
                ),

              model =
                COALESCE(
                  NULLIF(
                    EXCLUDED.model,
                    ''
                  ),
                  NULLIF(
                    stock_devices.model,
                    ''
                  )
                ),

              memory =
                COALESCE(
                  NULLIF(
                    EXCLUDED.memory,
                    ''
                  ),
                  NULLIF(
                    stock_devices.memory,
                    ''
                  )
                ),

              -- RENK WingSM'den alinmaz.
              -- Personelin daha once girdigi renk aynen korunur.
              -- Eski senkronlardan kalan DİĞER / DIGER placeholder
              -- degerleri ise temizlenir.

              color =
                CASE
                  WHEN
                    UPPER(
                      TRIM(
                        COALESCE(
                          stock_devices.color,
                          ''
                        )
                      )
                    ) IN (
                      'DİĞER',
                      'DIGER',
                      'OTHER',
                      '-'
                    )
                  THEN
                    NULL

                  ELSE
                    NULLIF(
                      stock_devices.color,
                      ''
                    )
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
                EXCLUDED
                  .wing_product_code,

              -- Burada WingSM depo kodu tutulmaya devam eder.
              wing_branch_code =
                EXCLUDED
                  .wing_branch_code,

              wing_status =
                'IN_STOCK',

              wing_last_seen_at =
                EXCLUDED
                  .wing_last_seen_at

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

            localState
              .currentBranch,

            localState.status,

            device
              .productCode,

            device
              .wingDepotCode,

            seenAt,

            `WINGSM_SYNC:${actor.username}`,
          ]
        );

      if (
        existing
      ) {
        updated +=
          1;
      } else {
        inserted +=
          1;
      }

      if (
        !result
          .rows[0]
      ) {
        throw new Error(
          `stock_devices upsert sonucu alınamadı: ${device.imei}`
        );
      }

      // ==================================================
      // GERCEK WINGSM KONUM KANITI
      // ==================================================
      //
      // Dikkat:
      // stock_devices.current_branch_code TRANSFER_WAITING
      // sırasında kaynak mağazada kalabilir.
      //
      // Ama wingsm_device_locations.panel_branch
      // WingSM'in GERCEKTE gösterdiği mağazadır.
      //
      // Complete route tam olarak bunu kontrol eder.
      // ==================================================

      await upsertWingLocation(
        client,
        device,
        seenAt
      );

      wingLocationsUpdated +=
        1;
    }

    // ==================================================
    // MISSING
    // ==================================================
    //
    // SADECE TAM VE HATASIZ SNAPSHOTTA.
    // ==================================================

    if (
      snapshot
        .safeForMissing
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

                    AND
                    NOT EXISTS (
                      SELECT 1

                      FROM public.device_requests dr

                      WHERE
                        dr.device_id =
                          sd.id

                        AND
                        dr.status IN (
                          'PENDING',
                          'SENT',
                          'TRANSFER_WAITING'
                        )
                    )

                    AND
                    sd.status NOT IN (
                      'SOLD',
                      'PASSIVE'
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
                sd.wing_last_seen_at <
                  $1
              )

              AND
                COALESCE(
                  sd.wing_status,
                  ''
                ) <>
                  'MISSING'
          `,
          [
            seenAt,
          ]
        );

      missingMarked =
        missingResult
          .rowCount ||
        0;
    }

    // ==================================================
    // BASARILI SYNC RUN
    // ==================================================
    //
    // Transfer complete route'un güvenlik şartı:
    //
    // Gönderildi zamanından SONRA
    // hedef mağaza için SUCCESS sync bulunmalı.
    //
    // Partial/hatalı snapshotta SUCCESS YAZMIYORUZ.
    // ==================================================

    if (
      snapshot
        .safeForMissing
    ) {
      const counts =
        branchCounts(
          snapshot.candidates
        );

      const runFinishedAt =
        new Date();

      for (
        const branch of
        MANAGED_BRANCHES
      ) {
        const depot =
          String(
            WINGSM_DEPOT_MAP[
              branch
            ]
          );

        await insertSuccessfulSyncRun(
          client,
          branch,
          depot,
          counts[branch] ||
            0,
          syncStartedAt,
          runFinishedAt
        );

        syncRunsWritten +=
          1;
      }
    }

    await client.query(
      "COMMIT"
    );

    return {
      inserted,

      updated,

      branchMoved,

      wingLocationsUpdated,

      syncRunsWritten,

      missingMarked,

      // Transfer TAMAMLAMA burada yapilmiyor.
      completedTransfers:
        0,

      syncStartedAt:
        syncStartedAt
          .toISOString(),

      syncedAt:
        seenAt
          .toISOString(),
    };
  } catch (
    error
  ) {
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
// GET - PREVIEW
// ======================================================

export async function GET(
  request:
    NextRequest
) {
  try {
    const user =
      await getSuperAdmin(
        request
      );

    if (!user) {
      return json(
        {
          success:
            false,

          error:
            "Super Admin yetkisi gerekli.",
        },
        403
      );
    }

    const snapshot =
      await buildWingSMSnapshot();

    return json({
      success:
        true,

      mode:
        "PREVIEW_ONLY",

      message:
        "WingSM stokları okundu. PostgreSQL'e hiçbir değişiklik yapılmadı.",

      wingSMWrite:
        false,

      postgresWrite:
        false,

      transferCompletion:
        false,

      summary: {
        productCount:
          snapshot
            .productCount,

        stockRowCount:
          snapshot
            .stockRowCount,

        imeiCount:
          snapshot
            .candidates
            .length,

        branchCounts:
          branchCounts(
            snapshot
              .candidates
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
                item
                  .branchCode,

              depot:
                item
                  .wingDepotCode,

              productCode:
                item
                  .productCode,

              brand:
                item
                  .brand,

              model:
                item
                  .model,

              memory:
                item
                  .memory,

              color:
                item
                  .color,

              imei:
                item
                  .imei,
            })
          ),
    });
  } catch (
    error
  ) {
    console.error(
      "WINGSM SYNC PREVIEW ERROR:",
      error
    );

    return json(
      {
        success:
          false,

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
// POST
//
// CRON:
// Authorization: Bearer WINGSM_SYNC_SECRET
//
// MANUEL:
// Super Admin + same-origin
//
// BURADA TRANSFER TAMAMLAMA YOK.
// ======================================================

export async function POST(
  request:
    NextRequest
) {
  try {
    const cronAuthorized =
      isCronAuthorized(
        request
      );

    let actor:
      ActiveUser;

    // ==================================================
    // CRON
    // ==================================================

    if (
      cronAuthorized
    ) {
      actor = {
        id: 0,

        username:
          "WINGSM_CRON",

        isSuperAdmin:
          true,
      };
    }

    // ==================================================
    // MANUEL ADMIN
    // ==================================================

    else {
      if (
        !validateOrigin(
          request
        )
      ) {
        return json(
          {
            success:
              false,

            error:
              "Geçersiz istek kaynağı.",
          },
          403
        );
      }

      const admin =
        await getSuperAdmin(
          request
        );

      if (!admin) {
        return json(
          {
            success:
              false,

            error:
              "Super Admin yetkisi gerekli.",
          },
          403
        );
      }

      actor =
        admin;
    }

    // ==================================================
    // WINGSM SNAPSHOT
    // ==================================================

    const snapshot =
      await buildWingSMSnapshot();

    if (
      !snapshot
        .candidates
        .length
    ) {
      return json(
        {
          success:
            false,

          error:
            "WingSM'den senkronlanabilir IMEI bulunamadı.",

          wingSMWrite:
            false,

          postgresWrite:
            false,

          transferCompletion:
            false,

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

    // ==================================================
    // POSTGRESQL
    // ==================================================

    const sync =
      await syncSnapshotToDatabase(
        snapshot,
        actor
      );

    return json({
      success:
        true,

      mode:
        cronAuthorized
          ? "AUTOMATIC_CRON"
          : "MANUAL_ADMIN",

      message:
        "WingSM stokları, IMEI konumları ve sync doğrulamaları PostgreSQL ile senkronlandı.",

      wingSMWrite:
        false,

      postgresWrite:
        true,

      // Transfer complete AYRI route.
      transferCompletion:
        false,

      transferCompleteEndpoint:
        "/api/wingsm/transfers/complete",

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
            snapshot
              .candidates
          ),

        inserted:
          sync
            .inserted,

        updated:
          sync
            .updated,

        // Aktif transfer yoksa normal WingSM konum
        // değişikliklerinde oluşabilir.
        branchMoved:
          sync
            .branchMoved,

        wingLocationsUpdated:
          sync
            .wingLocationsUpdated,

        syncRunsWritten:
          sync
            .syncRunsWritten,

        // Bu route transfer tamamlamaz.
        completedTransfers:
          0,

        missingMarked:
          sync
            .missingMarked,

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

        syncStartedAt:
          sync
            .syncStartedAt,

        syncedAt:
          sync
            .syncedAt,
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
  } catch (
    error
  ) {
    console.error(
      "WINGSM STOCK SYNC ERROR:",
      error
    );

    return json(
      {
        success:
          false,

        wingSMWrite:
          false,

        postgresWrite:
          false,

        transferCompletion:
          false,

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
