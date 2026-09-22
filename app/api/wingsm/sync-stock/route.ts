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
  getWingSMProductMovementHistory,
  getWingSMSalesList,
  getWingSMStock,
  WINGSM_DEPOT_MAP,
} from "@/app/lib/wingsm/server";

import { autoZeroN11StockForSoldImei } from "@/app/lib/n11/stock";

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

  invalidImeiSamples:
    Array<{
      productCode: string;
      rawSeriNo: string;
      depot: string;
    }>;

  productCount:
    number;

  stockRowCount:
    number;

  successfulBranches:
    string[];

  safeForMissing:
    boolean;

  // MISSING/SOLD isaretlemesinin GUVENLE yapilabilecegi magazalar.
  // Bir magazada (ornegin sadece MERKEZ'de) tek bir urun mismatch'i
  // olsa bile diger tum magazalar bundan etkilenmesin diye
  // safeForMissing artik GLOBAL degil, magaza bazli hesaplaniyor.
  safeBranches:
    BranchCode[];

  // Bu urun kodlari HICBIR magazada MISSING/SOLD isaretlemesine dahil
  // edilmez (detailErrors/serialConflicts - hangi magazayi etkiledigi
  // guvenilir bilinmiyor).
  unsafeProductCodes:
    string[];

  // "${productCode}|${branch}" formatinda - SADECE bu urun+magaza
  // kombinasyonu MISSING/SOLD isaretlemesinden muaf (mismatches).
  unsafeProductBranchPairs:
    string[];

  // Teshis: magaza basina WingSM'den HAM gelen satir/adet (bizim
  // filtrelememizden once).
  rawDepotDiagnostics:
    Record<
      string,
      {
        rawRowCount: number;
        rawQuantitySum: number;
      }
    >;

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

  // TESHIS: validImei() formatina uymadigi icin sessizce elenen
  // seriler - eskiden hicbir iz birakmiyordu. Ilk 50 ornegi (ham
  // SeriNo degeriyle) burada tutuluyor.
  const invalidImeiSamples:
    SnapshotResult["invalidImeiSamples"] =
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

  // TESHIS AMACLI: WingSM'den mağaza başına ham olarak kaç satır ve
  // toplam adet geldiğini, bizim hiçbir filtreleme/eşleştirme
  // mantığımız uygulanmadan ÖNCE kaydediyoruz. Böylece bir mağazanın
  // WingSM sayısıyla tutmaması durumunda "WingSM'den zaten eksik
  // geliyor" mu yoksa "bizim tarafta sonradan eleniyor" mu net ayrılır.
  const rawDepotDiagnostics: Record<
    string,
    { rawRowCount: number; rawQuantitySum: number }
  > = {};

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

          rawDepotDiagnostics[
            branch
          ] = {
            rawRowCount:
              rows.length,

            rawQuantitySum:
              rows.reduce(
                (
                  sum,
                  row
                ) =>
                  sum +
                  numberOrZero(
                    row?.DepoMiktar
                  ),
                0
              ),
          };

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
            if (
              invalidImeiSamples.length <
              50
            ) {
              invalidImeiSamples.push(
                {
                  productCode,

                  rawSeriNo:
                    text(
                      serial?.SeriNo
                    ),

                  depot:
                    text(
                      serial?.DepoKod
                    ),
                }
              );
            }

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

  // MISSING/SOLD isaretlemesi artik GLOBAL degil, hatta magaza bazli
  // bile degil - URUN+MAGAZA bazli guvenlik kontrolu kullaniyor.
  //
  // ONCEKI davranista (magaza bazli) TEK bir uruncukte mismatch olan
  // bir magaza TAMAMEN guvensiz sayiliyordu - ornegin MERKEZ'de 1
  // urunde (14/15 IMEI) tutarsizlik varsa, MERKEZ'deki DIGER 573
  // saglikli cihaz da yanlislikla korumaya giriyor, gercekte satilmis
  // cihazlar MISSING/SOLD'a hic donemiyordu. Artik SADECE o mismatch'e
  // konu olan urun+magaza kombinasyonu MISSING isaretlemesinden muaf,
  // ayni magazadaki diger urunler normal calismaya devam ediyor.
  const unsafeBranches =
    new Set<string>();

  for (
    const branch of
    MANAGED_BRANCHES
  ) {
    if (
      !successfulBranches.includes(
        branch
      )
    ) {
      unsafeBranches.add(
        branch
      );
    }
  }

  for (
    const err of
    stockReadErrors
  ) {
    unsafeBranches.add(
      err.branch
    );
  }

  // detailErrors urun bazlidir (o urunun detayi/seri listesi hic
  // okunamadi) - SADECE o urun kodu tum magazalarda guvensiz sayilir,
  // diger urunler etkilenmez.
  const unsafeProductCodes =
    new Set<string>();

  for (
    const err of
    detailErrors
  ) {
    if (
      err.productCode
    ) {
      unsafeProductCodes.add(
        err.productCode
      );
    }
  }

  // serialConflicts'in kendi urun kodu yok ama first/second alanlari
  // "productCode/depot" seklinde - oradan urun kodunu cikarip ayni
  // sekilde SADECE o urunleri guvensiz sayiyoruz.
  for (
    const conflict of
    serialConflicts
  ) {
    for (
      const ref of
      [
        conflict.first,
        conflict.second,
      ]
    ) {
      const code =
        String(ref || "")
          .split("/")[0]
          .trim();

      if (code) {
        unsafeProductCodes.add(
          code
        );
      }
    }
  }

  // mismatches HEM urun kodunu HEM magazayi biliyor - en dar kapsamli
  // muafiyet burada: sadece bu urun+magaza kombinasyonu korunur.
  const unsafeProductBranchPairs =
    new Set<string>();

  for (
    const mismatch of
    mismatches
  ) {
    unsafeProductBranchPairs.add(
      `${mismatch.productCode}|${mismatch.branch}`
    );
  }

  const safeBranches =
    MANAGED_BRANCHES.filter(
      (branch) =>
        !unsafeBranches.has(
          branch
        )
    );

  return {
    candidates,

    stockReadErrors,

    detailErrors,

    mismatches,

    serialConflicts,

    invalidImeiSamples,

    productCount:
      productCodes.length,

    stockRowCount,

    successfulBranches,

    safeForMissing,

    safeBranches,

    unsafeProductCodes:
      Array.from(
        unsafeProductCodes
      ),

    unsafeProductBranchPairs:
      Array.from(
        unsafeProductBranchPairs
      ),

    rawDepotDiagnostics,

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
// WINGSM HAREKET GECMISI - SATIS TESPITI
//
// WingSM'in "Mal/Urun Hareketleri" ekraninda bir satis, Tur-Aciklama
// alaninda ORNEGIN "C : 00685208 / SATIS" seklinde gorunuyor (transferler
// "T :.../TRANSFER CIKIS" - "V :.../TRANSFER GIRIS", alis "A :.../ALIS
// FATURASI"). API cevabinin tam alan adlarini bilmiyoruz (WingSM
// dokumantasyonunda net degil) - bu yuzden satiri oldugu gibi JSON'a
// cevirip icinde "SATIS" gecip gecmedigine bakiyoruz. Bu, alan adi
// degisse/farkli gelse bile calismaya devam eder.
// ======================================================

function extractWingSMMovementRows(
  payload: any
): any[] {
  const visit = (
    value: any,
    depth: number
  ): any[] | null => {
    if (
      depth > 5 ||
      value === null ||
      value === undefined
    ) {
      return null;
    }

    if (Array.isArray(value)) {
      return value;
    }

    if (typeof value !== "object") {
      return null;
    }

    const preferredKeys = [
      "data",
      "Data",
      "list",
      "List",
      "rows",
      "Rows",
      "items",
      "Items",
      "result",
      "Result",
    ];

    for (const key of preferredKeys) {
      if (
        Object.prototype.hasOwnProperty.call(value, key)
      ) {
        const found = visit(value[key], depth + 1);
        if (found) return found;
      }
    }

    return null;
  };

  return visit(payload, 0) || [];
}

function normalizeWingText(value: unknown): string {
  return String(value ?? "")
    .toLocaleUpperCase("tr-TR")
    .replace(/İ/g, "I")
    .replace(/Ş/g, "S")
    .replace(/Ğ/g, "G")
    .replace(/Ü/g, "U")
    .replace(/Ö/g, "O")
    .replace(/Ç/g, "C");
}

function findSaleMovementRow(
  movementRows: any[]
): any | null {
  for (const row of movementRows) {
    try {
      const flatText = JSON.stringify(row);
      if (normalizeWingText(flatText).includes("SATIS")) {
        return row;
      }
    } catch {
      // JSON.stringify basarisiz olursa (dongusel referans vb.) bu satiri atla.
    }
  }
  return null;
}

// WingSM'in resmi satis listesi (get('/api/b2b/satis/list/:sirket'))
// icin: bir satirin herhangi bir alaninda aranan IMEI'nin gecip
// gecmedigine bakar. Bu uc nokta zaten sadece satislari dondurdugu
// icin (alis=1 gonderilmedigi surece) metin/tur aramaya gerek yok -
// IMEI gecmesi tek basina yeterli kanit.
function findImeiInRows(
  rows: any[],
  imei: string
): any | null {
  const cleanImei = String(imei || "").replace(/\D/g, "");
  if (!cleanImei) return null;

  for (const row of rows) {
    try {
      const flatText = JSON.stringify(row);
      if (flatText.includes(cleanImei)) {
        return row;
      }
    } catch {
      // JSON.stringify basarisiz olursa bu satiri atla.
    }
  }
  return null;
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
  //
  // ISTISNA: GONDERILDI hic tiklanmamis olsa bile, WingSM'in guncel stok
  // anlik goruntusu cihazi zaten TALEP EDEN magazada gosteriyorsa (personel
  // paneli hic kullanmadan elden/WingSM uzerinden transfer etmis demektir),
  // bu PENDING talebi sonsuza kadar "REQUESTED" gostermeye devam etmek
  // yaniltici olur. Cagiran taraf autoCompletedPendingRequest=true gorunce
  // device_requests'i COMPLETED yapip transfer/olay kaydini olusturuyor.
  if (
    requestStatus ===
      "PENDING"
  ) {
    const requesterBranch =
      text(
        existing
          .requester_branch_code
      ).toUpperCase();

    const wingBranch =
      text(
        actualWingBranch
      ).toUpperCase();

    if (
      requesterBranch &&
      wingBranch ===
        requesterBranch
    ) {
      return {
        currentBranch:
          actualWingBranch,

        status:
          "AVAILABLE",

        autoCompletedPendingRequest:
          true,
      };
    }

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

  let soldViaSaleDetection =
    0;

  const soldImeisForN11: string[] =
    [];

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

      // GONDERILDI hic tiklanmadan WingSM'de dogrudan hedef magazaya
      // tasindigi tespit edilen PENDING talebi burada kapatiyoruz: talep
      // COMPLETED olur, gecmis icin bir device_transfers + stock_events
      // kaydi acilir (panel_sent_by/performed_by = WINGSM_AUTO).
      if (
        localState.autoCompletedPendingRequest &&
        existing?.request_id
      ) {
        const completedRequest =
          await client.query(
            `
              UPDATE public.device_requests
              SET
                status = 'COMPLETED',
                completed_at = NOW(),
                updated_at = NOW()
              WHERE id = $1
                AND status = 'PENDING'
              RETURNING id
            `,
            [existing.request_id]
          );

        if (completedRequest.rowCount === 1) {
          const wingReference =
            `WINGSM:DIRECT_PENDING_BYPASS:${device.branchCode}:${seenAt.toISOString()}`;

          await client.query(
            `
              INSERT INTO public.device_transfers (
                device_id, request_id, imei,
                from_branch_code, to_branch_code,
                status, panel_sent_by, panel_sent_at,
                wing_transfer_at, wing_reference,
                completed_at
              )
              VALUES (
                $1, $2, $3,
                $4, $5,
                'COMPLETED', 'WINGSM_AUTO', $6,
                $6, $7,
                NOW()
              )
            `,
            [
              existing.id,
              existing.request_id,
              device.imei,
              existing.owner_branch_code,
              device.branchCode,
              seenAt,
              wingReference,
            ]
          );

          await client.query(
            `
              INSERT INTO public.stock_events (
                device_id, imei, event_type,
                from_branch_code, to_branch_code,
                old_status, new_status,
                performed_by, metadata
              )
              VALUES (
                $1, $2, 'TRANSFER_COMPLETED_WINGSM_DIRECT',
                $3, $4,
                'REQUESTED', 'AVAILABLE',
                'WINGSM_AUTO', $5::jsonb
              )
            `,
            [
              existing.id,
              device.imei,
              existing.owner_branch_code,
              device.branchCode,
              JSON.stringify({
                requestId: existing.request_id,
                note: 'GÖNDERİLDİ hiç tıklanmadan WingSM üzerinde direkt transfer tespit edildi.',
              }),
            ]
          );
        }
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

    let freshlyMissingRows:
      Array<{
        id: number;
        imei: string;
        current_branch_code: string;
        wing_last_seen_at: string | null;
      }> = [];

    if (
      snapshot
        .safeBranches
        .length > 0
    ) {
      // NOT: Satis tespiti (WingSM hareket gecmisi sorgusu) BURADA
      // YAPILMIYOR - bilerek. Bu sorgu WingSM'e canli, IMEI basina HTTP
      // istegi atiyor; COMMIT'ten once, ana senkron transaction'i
      // icinde calistirilirsa yavas/coklu adayda tum senkronu
      // geciktirip zaman asimina ugratabilir, bu da HICBIR magazanin
      // stogunun guncellenmemesine (transaction rollback) yol acar.
      // Bu yuzden MISSING isaretleme ESKISI GIBI hizli ve tek sorguda
      // kaliyor; hangi cihazlarin bu turda YENI MISSING oldugunu
      // RETURNING ile yakalayip satis kontrolunu COMMIT'ten SONRA,
      // ayri ve izole bir adimda yapiyoruz (asagida).
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

              AND
                sd.current_branch_code =
                  ANY($2::text[])

              AND
                NOT (
                  COALESCE(
                    sd.wing_product_code,
                    ''
                  ) =
                    ANY($3::text[])
                )

              AND
                NOT (
                  (
                    COALESCE(
                      sd.wing_product_code,
                      ''
                    ) ||
                    '|' ||
                    sd.current_branch_code
                  ) =
                    ANY($4::text[])
                )

            RETURNING
              id,
              imei,
              current_branch_code,
              wing_last_seen_at,
              status
          `,
          [
            seenAt,
            snapshot
              .safeBranches,
            snapshot
              .unsafeProductCodes,
            snapshot
              .unsafeProductBranchPairs,
          ]
        );

      missingMarked =
        missingResult
          .rowCount ||
        0;

      // Satis kontrolu SADECE bu turda gercekten MISSING'e donenler
      // icin yapilir - aktif talebi olan (REQUESTED/TRANSFER_WAITING)
      // veya zaten SOLD/PASSIVE kalanlar (ELSE dali) disarida kalir,
      // eski davranisla birebir ayni kapsam.
      freshlyMissingRows =
        missingResult.rows.filter(
          (row) =>
            row.status === "MISSING" &&
            String(row.imei || "").trim().length > 0
        );
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
        .safeBranches
        .length > 0
    ) {
      const counts =
        branchCounts(
          snapshot.candidates
        );

      const runFinishedAt =
        new Date();

      // SADECE guvenli (mismatch/hata olmayan) magazalar icin SUCCESS
      // sync kaydi yazilir - transfers/complete route'un "hedef magaza
      // icin SUCCESS sync bulunmali" sarti artik yanlislikla TUM
      // magazalari degil, sadece gercekten guvensiz olani bloklar.
      for (
        const branch of
        snapshot.safeBranches
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

    // ==================================================
    // SATIS TESPITI (WINGSM HAREKET GECMISI) - COMMIT SONRASI
    //
    // Ana transaction COMMIT olduktan SONRA, bu turda YENI MISSING
    // olan cihazlari (freshlyMissingRows) tek tek WingSM hareket
    // gecmisinden kontrol ediyoruz. Bir "SATIS" hareketi bulunursa
    // MISSING -> SOLD'a ceviriyoruz. Bu adim ana senkrona hicbir
    // sekilde bagli degil: burada olabilecek herhangi bir yavaslik/
    // hata sadece BU ek kontrolu etkiler, stok senkronunun kendisi
    // COMMIT ile zaten guvenlik altina alinmis durumda.
    // ==================================================

    if (freshlyMissingRows.length) {
      const pool =
        getPool();

      for (const candidate of freshlyMissingRows) {
        try {
          const lastSeen =
            candidate.wing_last_seen_at
              ? new Date(candidate.wing_last_seen_at)
              : new Date(
                  Date.now() - 30 * 24 * 60 * 60 * 1000
                );

          const candidateBranch =
            String(
              candidate.current_branch_code || ""
            ) as BranchCode;

          const depot =
            WINGSM_DEPOT_MAP[candidateBranch] || null;

          // 1) ONCELIKLI KONTROL: WingSM'in resmi satis listesi
          // (get('/api/b2b/satis/list/:sirket')). Bu uc nokta zaten
          // SADECE satislari donduruyor (alis=1 gondermedigimiz
          // surece) - IMEI cevapta geciyorsa bu dogrudan "satildi"
          // demektir, ayrica metin aramaya gerek yok.
          let saleRow: any = null;

          if (depot) {
            try {
              const salesPayload =
                await getWingSMSalesList({
                  sirket: depot,
                  startDate: lastSeen,
                  endDate: new Date(),
                });

              const salesRows =
                extractWingSMMovementRows(salesPayload);

              saleRow =
                findImeiInRows(
                  salesRows,
                  String(candidate.imei || "")
                );
            } catch (salesListError) {
              console.error(
                "WINGSM_SALES_LIST_ERROR:",
                candidate.imei,
                salesListError
              );
            }
          }

          // 2) YEDEK KONTROL: satis listesi bulamadiysa/hata verdiyse,
          // urun hareket gecmisinde "SATIS" metni ara (eski yontem).
          if (!saleRow) {
            const movementPayload =
              await getWingSMProductMovementHistory({
                serialNo: String(candidate.imei || ""),
                startDate: lastSeen,
                endDate: new Date(),
                depot,
              });

            const movementRows =
              extractWingSMMovementRows(movementPayload);

            saleRow =
              findSaleMovementRow(movementRows);
          }

          if (!saleRow) {
            continue;
          }

          const flipped =
            await pool.query(
              `
                UPDATE public.stock_devices
                SET
                  status = 'SOLD',
                  wing_status = 'SOLD',
                  updated_at = NOW()
                WHERE id = $1
                  AND status = 'MISSING'
              `,
              [candidate.id]
            );

          if (!flipped.rowCount) {
            // Bu aradaki bir baska islem (ör. yeni bir talep) durumu
            // degistirmis olabilir - guvenli tarafta kal, dokunma.
            continue;
          }

          await pool.query(
            `
              INSERT INTO public.stock_events (
                device_id, imei, event_type,
                from_branch_code, to_branch_code,
                old_status, new_status,
                performed_by, metadata
              )
              VALUES (
                $1, $2, 'WINGSM_SALE_DETECTED',
                $3, $3,
                'MISSING', 'SOLD',
                'WINGSM_AUTO', $4::jsonb
              )
            `,
            [
              candidate.id,
              candidate.imei,
              candidate.current_branch_code,
              JSON.stringify({ evidence: saleRow }),
            ]
          );

          soldImeisForN11.push(
            String(candidate.imei || "")
          );

          soldViaSaleDetection += 1;
        } catch (saleCheckError) {
          console.error(
            "WINGSM_SALE_DETECTION_ERROR:",
            candidate.imei,
            saleCheckError
          );
        }
      }
    }

    // ==================================================
    // SOLD OLARAK ISARETLENEN CIHAZLAR ICIN N11 STOK=0
    //
    // Ana stok senkron transaction'i COMMIT olduktan SONRA, ayri bir
    // adim olarak calisir - n11 API cagrisi/gecikmesi stok senkronunun
    // kendisini asla bloklamaz veya bozmaz. autoZeroN11StockForSoldImei
    // kendi icinde tum hatalari yutar, buraya asla throw etmez.
    // ==================================================

    let n11AutoZeroed =
      0;

    const n11AutoZeroErrors: string[] =
      [];

    if (soldImeisForN11.length) {
      const pool =
        getPool();

      for (const imei of soldImeisForN11) {
        try {
          const result =
            await autoZeroN11StockForSoldImei(
              pool,
              imei
            );

          n11AutoZeroed +=
            result.zeroed;

          if (result.errors.length) {
            n11AutoZeroErrors.push(
              ...result.errors.map(
                (message) =>
                  `${imei}: ${message}`
              )
            );
          }
        } catch (n11Error) {
          n11AutoZeroErrors.push(
            `${imei}: ${
              n11Error instanceof Error
                ? n11Error.message
                : String(n11Error)
            }`
          );
        }
      }

      if (n11AutoZeroErrors.length) {
        console.error(
          "WINGSM_SALE_N11_AUTO_ZERO_ERRORS:",
          n11AutoZeroErrors
        );
      }
    }

    return {
      inserted,

      updated,

      branchMoved,

      wingLocationsUpdated,

      syncRunsWritten,

      missingMarked,

      soldViaSaleDetection,

      n11AutoZeroed,

      n11AutoZeroErrors,

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

        safeBranches:
          snapshot
            .safeBranches,

        unsafeProductCodes:
          snapshot
            .unsafeProductCodes,

        unsafeProductBranchPairs:
          snapshot
            .unsafeProductBranchPairs,

        rawDepotDiagnostics:
          snapshot
            .rawDepotDiagnostics,

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

        invalidImeiCount:
          snapshot
            .invalidImeiSamples
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

        invalidImeiSamples:
          snapshot
            .invalidImeiSamples,
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

        soldViaSaleDetection:
          sync
            .soldViaSaleDetection,

        n11AutoZeroed:
          sync
            .n11AutoZeroed,

        n11AutoZeroErrors:
          sync
            .n11AutoZeroErrors,

        safeForMissing:
          snapshot
            .safeForMissing,

        safeBranches:
          snapshot
            .safeBranches,

        unsafeProductCodes:
          snapshot
            .unsafeProductCodes,

        unsafeProductBranchPairs:
          snapshot
            .unsafeProductBranchPairs,

        rawDepotDiagnostics:
          snapshot
            .rawDepotDiagnostics,

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

        invalidImeiCount:
          snapshot
            .invalidImeiSamples
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

        invalidImeiSamples:
          snapshot
            .invalidImeiSamples,
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
