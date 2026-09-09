// app/api/online/idefix/center-send/route.ts
// CNETMOBIL - IDEFIX ADIM 3
//
// Merkez -> İdefix gerçek gönderim motoru.
// N11 / İkas akışlarına dokunmaz.
//
// Akış:
// 1) Seçili Merkez IMEI'lerini tekrar doğrular.
// 2) Aynı ürün/renk İdefix satıcı havuzunda varsa mevcut barkoda stok+fiyat ekler.
// 3) Aynı renk yoksa, aynı model/hafıza/kalite ürününü referans alır.
// 4) Referanstan brand/category/attribute şablonunu alır.
// 5) İstenen renk attribute değerini category-attribute servisinden bulur.
// 6) Aynı renk görselini N11/İkas yerel listinglerinden bulur.
// 7) Yeni İdefix ürünü create eder.
// 8) batch-result sonucu güvenli eşleşme ise approve-item ile onaylar.
// 9) Satışa hazır olduğunda stok/fiyatı inventory-upload ile doğrular.
// 10) Son olarak PostgreSQL online_listings + online_channel_devices kaydını yazar.
//
// Güvenlik:
// - Aynı IMEI ikinci kez İdefix'e gönderilemez.
// - AVAILABLE olmayan cihaz gönderilemez.
// - Eksik marka/model/hafıza/renk/grade/garanti engellenir.
// - Belirsiz katalog referansında otomatik ürün açılmaz.
// - Renk attribute bulunamazsa ürün açılmaz.
// - Doğru renk görseli bulunamazsa ürün açılmaz.
// - İdefix dış işlem başarılı olup DB yazımı başarısız olursa yeni gönderim durdurulur.

import { NextRequest } from "next/server";
import crypto from "crypto";
import type { PoolClient } from "pg";

import {
  IDEFIX_BASE_URL,
  getIdefixDbPool,
  getIdefixProducts,
  getIdefixVendorId,
  getIdefixVendorToken,
  noStoreJson,
  requireIdefixSuperAdmin,
} from "@/app/lib/idefix/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type SendMode = "preview" | "commit" | "reconcile";

type DeviceRow = {
  id: number;
  imei: string;
  brand: string | null;
  model: string | null;
  memory: string | null;
  color: string | null;
  grade: string | null;
  warranty: string | null;
  current_branch_code: string | null;
  status: string | null;
};

type GroupItem = {
  deviceId: number;
  imei: string;
};

type CenterGroup = {
  key: string;
  brand: string;
  model: string;
  memory: string;
  color: string;
  grade: string;
  warranty: string;
  items: GroupItem[];
};

type IdefixProduct = {
  barcode?: string | null;
  title?: string | null;
  productMainId?: string | null;
  brandId?: number | string | null;
  categoryId?: number | string | null;
  inventoryQuantity?: number | string | null;
  vendorStockCode?: string | null;
  weight?: number | string | null;
  description?: string | null;
  price?: number | string | null;
  comparePrice?: number | string | null;
  vatRate?: number | string | null;
  deliveryDuration?: number | string | null;
  deliveryType?: string | null;
  cargoCompanyId?: number | string | null;
  shipmentAddressId?: number | string | null;
  returnAddressId?: number | string | null;
  images?: Array<{ url?: string | null }> | null;
  attributes?: Array<{
    attributeId?: number | string | null;
    attributeValueId?: number | string | null;
    customAttributeValue?: string | null;
  }> | null;
  status?: string | null;
  state?: string | null;
  reference?: number | string | null;
  matchedProduct?: any;
  failureReasons?: any;
  [key: string]: unknown;
};

type CategoryAttribute = {
  attributeId: number | string;
  attributeTitle?: string | null;
  allowCustom?: boolean | null;
  required?: boolean | null;
  isVariant?: boolean | null;
  isSlicer?: boolean | null;
  attributeValues?: Array<{
    id?: number | string | null;
    name?: string | null;
  }> | null;
};

const idefixCategoryAttributeCache =
  new Map<
    string,
    Promise<CategoryAttribute[]>
  >();

type PreparedGroup = {
  group: CenterGroup;
  action: "EXISTING_PRODUCT" | "FAST_LISTING" | "CREATE_PRODUCT";
  exactProduct: IdefixProduct | null;
  referenceProduct: IdefixProduct | null;
  title: string;
  salePrice: number;
  listPrice: number;
  targetBeforeStock: number;
  targetAfterStock: number;
  barcode: string;
  catalogBarcode: string | null;
  catalogBarcodeSource?: "REQUEST" | "LOCAL_MAPPING" | "POOL" | null;
  vendorStockCode: string;
  productMainId: string;
  brandId: number | string | null;
  categoryId: number | string | null;
  vatRate: number | null;
  imageUrl: string | null;
  attributes: Array<{
    attributeId: number | string;
    attributeValueId: number | string | null;
    customAttributeValue: string | null;
  }>;
  blockers: string[];
};

function text(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeText(value: unknown) {
  return text(value)
    .toLocaleUpperCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeGrade(value: unknown) {
  const v = normalizeText(value);

  // Merkez / N11 / İkas taraflarında kalite farklı biçimlerde gelebiliyor:
  // A, A Kalite, Grade A, A Grade, Mükemmel vb.
  if (
    v === "A" ||
    v === "A KALITE" ||
    v === "A GRADE" ||
    v === "GRADE A" ||
    v.includes("MUKEMMEL")
  ) {
    return "A";
  }

  if (
    v === "B" ||
    v === "B KALITE" ||
    v === "B GRADE" ||
    v === "GRADE B" ||
    v.includes("COK IYI")
  ) {
    return "B";
  }

  if (
    v === "C" ||
    v === "C KALITE" ||
    v === "C GRADE" ||
    v === "GRADE C" ||
    v === "IYI"
  ) {
    return "C";
  }

  return v;
}

function normalizeMemory(value: unknown) {
  return normalizeText(value).replace(
    /(\d+(?:[.,]\d+)?)\s*(GB|TB)\b/g,
    "$1 $2"
  );
}

function containsPhrase(
  haystack: unknown,
  needle: unknown
) {
  const h =
    ` ${normalizeText(haystack)} `;
  const n =
    ` ${normalizeText(needle)} `;

  return normalizeText(needle)
    ? h.includes(n)
    : false;
}

function normalizedTokens(
  value:
    unknown
) {
  return normalizeText(
    value
  )
    .split(" ")
    .filter(Boolean);
}

function compactNormalized(
  value:
    unknown
) {
  return normalizeText(
    value
  ).replace(
    /\s+/g,
    ""
  );
}

function modelMatchesTitle(
  title:
    unknown,
  model:
    unknown
) {
  const titleTokens =
    normalizedTokens(
      title
    );

  const modelTokens =
    normalizedTokens(
      model
    );

  if (
    modelTokens.length === 0
  ) {
    return false;
  }

  let startIndex = -1;

  for (
    let i = 0;
    i <=
      titleTokens.length -
        modelTokens.length;
    i += 1
  ) {
    let same = true;

    for (
      let j = 0;
      j <
        modelTokens.length;
      j += 1
    ) {
      if (
        titleTokens[i + j] !==
        modelTokens[j]
      ) {
        same = false;
        break;
      }
    }

    if (same) {
      startIndex = i;
      break;
    }
  }

  if (
    startIndex < 0
  ) {
    return false;
  }

  // iPhone 11 ile iPhone 11 Pro / Pro Max gibi cihazları
  // yanlış eşleştirmemek için modelin hemen sonundaki varyantı kontrol et.
  const variantTokens =
    new Set([
      "PRO",
      "MAX",
      "MINI",
      "PLUS",
      "ULTRA",
      "FE",
      "LITE",
    ]);

  const nextToken =
    titleTokens[
      startIndex +
      modelTokens.length
    ] || "";

  if (
    variantTokens.has(
      nextToken
    ) &&
    !modelTokens.includes(
      nextToken
    )
  ) {
    return false;
  }

  return true;
}

function memoryMatchesTitle(
  title:
    unknown,
  memory:
    unknown
) {
  const memoryNormalized =
    normalizeMemory(
      memory
    );

  if (
    !memoryNormalized
  ) {
    return false;
  }

  // 64 GB / 64GB gibi farklı yazımları aynı kabul et.
  const titleCompact =
    compactNormalized(
      title
    );

  const memoryCompact =
    compactNormalized(
      memoryNormalized
    );

  if (
    titleCompact.includes(
      memoryCompact
    )
  ) {
    return true;
  }

  // Merkez hafıza alanı yalnızca "64" gibi geldiyse,
  // başlıkta 64GB / 64 GB biçimlerini de yakala.
  const numericOnly =
    memoryNormalized.match(
      /^\d+(?:[.,]\d+)?$/
    );

  if (
    numericOnly
  ) {
    const number =
      numericOnly[0]
        .replace(",", ".");

    return (
      titleCompact.includes(
        `${number}GB`
      ) ||
      titleCompact.includes(
        `${number}TB`
      )
    );
  }

  return false;
}

function baseIdentityMatchesTitle(
  title:
    unknown,
  group:
    CenterGroup
) {
  return (
    containsPhrase(
      title,
      group.brand
    ) &&
    modelMatchesTitle(
      title,
      group.model
    ) &&
    memoryMatchesTitle(
      title,
      group.memory
    )
  );
}

function colorAliases(value: unknown) {
  const color =
    normalizeText(value);

  const map:
    Record<string, string[]> = {
      KIRMIZI: [
        "KIRMIZI",
        "RED",
        "PRODUCT RED",
      ],
      SIYAH: [
        "SIYAH",
        "BLACK",
      ],
      BEYAZ: [
        "BEYAZ",
        "WHITE",
      ],
      MAVI: [
        "MAVI",
        "BLUE",
      ],
      YESIL: [
        "YESIL",
        "GREEN",
      ],
      MOR: [
        "MOR",
        "PURPLE",
      ],
      SARI: [
        "SARI",
        "YELLOW",
      ],
      PEMBE: [
        "PEMBE",
        "PINK",
      ],
      GRI: [
        "GRI",
        "GRAY",
        "GREY",
      ],
      GUMUS: [
        "GUMUS",
        "SILVER",
      ],
      ALTIN: [
        "ALTIN",
        "GOLD",
      ],
      LACIVERT: [
        "LACIVERT",
        "NAVY",
        "NAVY BLUE",
      ],
    };

  return Array.from(
    new Set(
      map[color] || [color]
    )
  ).filter(Boolean);
}

function matchedColorAlias(
  title: unknown,
  color: unknown
) {
  return (
    colorAliases(color).find(
      (alias) =>
        containsPhrase(
          title,
          alias
        )
    ) || null
  );
}

function detectGradeFromTitle(
  title: unknown
) {
  const t =
    normalizeText(title);

  if (
    containsPhrase(t, "B KALITE") ||
    containsPhrase(t, "B GRADE") ||
    containsPhrase(t, "GRADE B") ||
    containsPhrase(t, "COK IYI")
  ) {
    return "B";
  }

  if (
    containsPhrase(t, "A KALITE") ||
    containsPhrase(t, "A GRADE") ||
    containsPhrase(t, "GRADE A") ||
    containsPhrase(t, "MUKEMMEL")
  ) {
    return "A";
  }

  if (
    containsPhrase(t, "C KALITE") ||
    containsPhrase(t, "C GRADE") ||
    containsPhrase(t, "GRADE C") ||
    containsPhrase(t, "IYI")
  ) {
    return "C";
  }

  return null;
}

function numberOrNull(
  value: unknown
) {
  if (
    value === null ||
    value === undefined ||
    text(value) === ""
  ) {
    return null;
  }

  const n =
    Number(value);

  return Number.isFinite(n)
    ? n
    : null;
}

function money(
  value: unknown,
  label: string
) {
  if (
    typeof value === "number" &&
    Number.isFinite(value)
  ) {
    if (value <= 0) {
      throw new Error(
        `${label} 0'dan büyük olmalıdır.`
      );
    }

    return Math.round(
      value * 100
    ) / 100;
  }

  let raw =
    text(value);

  if (!raw) {
    throw new Error(
      `${label} zorunludur.`
    );
  }

  raw =
    raw.replace(
      /[^\d,.-]/g,
      ""
    );

  const comma =
    raw.lastIndexOf(",");
  const dot =
    raw.lastIndexOf(".");

  if (
    comma > dot
  ) {
    raw =
      raw
        .replace(/\./g, "")
        .replace(",", ".");
  } else {
    raw =
      raw.replace(/,/g, "");
  }

  const n =
    Number(raw);

  if (
    !Number.isFinite(n) ||
    n <= 0
  ) {
    throw new Error(
      `${label} geçersiz.`
    );
  }

  return Math.round(
    n * 100
  ) / 100;
}

function groupKey(
  row: DeviceRow
) {
  return [
    normalizeText(row.brand),
    normalizeText(row.model),
    normalizeMemory(row.memory),
    normalizeText(row.color),
    normalizeGrade(row.grade),
    normalizeText(row.warranty),
  ].join("|");
}

function stableHash(
  value: string,
  length = 20
) {
  return crypto
    .createHash("sha256")
    .update(value)
    .digest("hex")
    .toUpperCase()
    .slice(0, length);
}

function makeStableBarcode(
  group: CenterGroup
) {
  // İdefix create endpoint barcode alanını zorunlu tutuyor.
  // CNETMOBIL için ürün grubu bazlı deterministik ve tekrar üretilebilir
  // benzersiz değer kullanılır. Aynı grup ikinci kez yeni barkod üretmez.
  return `CNETIDF${stableHash(
    [
      group.brand,
      group.model,
      group.memory,
      group.color,
      group.grade,
      group.warranty,
    ]
      .map(normalizeText)
      .join("|"),
    18
  )}`;
}

function makeVendorStockCode(
  group: CenterGroup
) {
  return `CNET-IDF-${stableHash(
    [
      group.brand,
      group.model,
      group.memory,
      group.color,
      group.grade,
      group.warranty,
    ]
      .map(normalizeText)
      .join("|"),
    16
  )}`;
}

function makeProductMainId(
  group: CenterGroup
) {
  // Renk hariç aile kodu.
  // Aynı model/hafıza/grade/garanti farklı renkleri aynı ailede tutulabilir.
  return `CNET-IDF-PM-${stableHash(
    [
      group.brand,
      group.model,
      group.memory,
      group.grade,
      group.warranty,
    ]
      .map(normalizeText)
      .join("|"),
    16
  )}`;
}

function productTitle(
  group: CenterGroup
) {
  const gradeLabel =
    normalizeGrade(
      group.grade
    ) === "A"
      ? "A Kalite"
      : normalizeGrade(
          group.grade
        ) === "B"
      ? "B Kalite"
      : normalizeGrade(
          group.grade
        ) === "C"
      ? "C Kalite"
      : group.grade;

  return [
    group.brand,
    "Yenilenmiş",
    group.model,
    group.memory,
    "-",
    group.color,
    "-",
    gradeLabel,
    `(${group.warranty} Garantili)`,
  ]
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function productKey(
  product: IdefixProduct
) {
  return (
    text(product.barcode) ||
    [
      text(
        product.productMainId
      ),
      text(
        product.vendorStockCode
      ),
      normalizeText(
        product.title
      ),
    ].join("|")
  );
}

async function idefixApi(
  path: string,
  options?: {
    method?:
      | "GET"
      | "POST";
    body?: unknown;
    timeoutMs?: number;
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
      options?.timeoutMs ??
        35_000
    );

  try {
    const response =
      await fetch(
        `${IDEFIX_BASE_URL}${path}`,
        {
          method:
            options?.method ||
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
            options?.body ===
            undefined
              ? undefined
              : JSON.stringify(
                  options.body
                ),
          signal:
            controller.signal,
        }
      );

    const raw =
      await response.text();

    let payload:
      any = null;

    if (raw) {
      try {
        payload =
          JSON.parse(raw);
      } catch {
        payload = {
          raw,
        };
      }
    }

    if (!response.ok) {
      const apiMessage =
        text(
          payload?.message
        ) ||
        text(
          payload?.error
        ) ||
        text(
          payload?.errors?.[0]
            ?.message
        );

      let payloadDetail = "";

      if (payload !== null && payload !== undefined) {
        try {
          payloadDetail =
            typeof payload === "string"
              ? payload
              : JSON.stringify(payload);
        } catch {
          payloadDetail =
            String(payload);
        }
      }

      const detail =
        apiMessage ||
        payloadDetail ||
        raw ||
        "Response body boş.";

      throw new Error(
        `İdefix HTTP ${response.status} [${options?.method || "GET"} ${path}]: ${detail}`
      );
    }

    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

function pickIdefixProducts(
  payload:
    any
): IdefixProduct[] {
  const rows =
    payload?.products ??
    payload?.items ??
    payload?.content ??
    payload?.data?.products ??
    payload?.data?.items ??
    payload?.data?.content ??
    [];

  return Array.isArray(rows)
    ? rows
    : [];
}

async function fetchAllProducts() {
  const rows:
    IdefixProduct[] = [];

  const seen =
    new Set<string>();

  const pageSignatures =
    new Set<string>();

  const limit = 50;

  for (
    let page = 1;
    page <= 100;
    page += 1
  ) {
    const payload: any =
      await getIdefixProducts(
        page,
        limit
      );

    const products =
      pickIdefixProducts(
        payload
      );

    if (
      products.length === 0
    ) {
      break;
    }

    const signature =
      products
        .map(
          (product: any) =>
            productKey(product)
        )
        .join("||");

    if (
      pageSignatures.has(
        signature
      )
    ) {
      break;
    }

    pageSignatures.add(
      signature
    );

    for (
      const product of
        products
    ) {
      const key =
        productKey(product);

      if (
        seen.has(key)
      ) {
        continue;
      }

      seen.add(key);
      rows.push(product);
    }

    if (
      products.length <
      limit
    ) {
      break;
    }
  }

  return rows;
}

function idefixProductState(
  product:
    IdefixProduct | null |
    undefined
) {
  return normalizeText(
    product?.status ??
    product?.state
  );
}

function isIdefixReadyForSale(
  product:
    IdefixProduct | null |
    undefined
) {
  return (
    idefixProductState(
      product
    ) ===
    "READY FOR SALE"
  );
}

async function productLooksLikeCenterGroup(
  product:
    IdefixProduct,
  group:
    CenterGroup,
  allowMissingGrade =
    false
) {
  const title =
    product.title;

  // Marka ve model başlıktan güvenle kontrol edilir.
  if (
    !containsPhrase(
      title,
      group.brand
    ) ||
    !modelMatchesTitle(
      title,
      group.model
    )
  ) {
    return false;
  }

  const facts =
    await structuredProductFacts(
      product
    );

  // Hafıza: önce İdefix structured attribute, yoksa başlık.
  const memoryMatches =
    facts.memory
      ? memoryValueMatches(
          facts.memory,
          group.memory
        )
      : memoryMatchesTitle(
          title,
          group.memory
        );

  if (!memoryMatches) {
    return false;
  }

  // RENK: kritik düzeltme.
  // İdefix Merchant Center'da renk başlıkta her zaman yazmıyor.
  // Önce product.attributes içindeki gerçek "Renk" değerini kullan.
  // Sadece attribute çözülemezse başlığa fallback yap.
  const colorMatches =
    facts.color
      ? colorValueMatches(
          facts.color,
          group.color
        )
      : Boolean(
          matchedColorAlias(
            title,
            group.color
          )
        );

  if (!colorMatches) {
    return false;
  }

  // Kozmetik kalite: yine structured attribute önce, başlık sonra.
  const structuredGrade =
    facts.grade
      ? normalizeGrade(
          facts.grade
        )
      : null;

  const titleGrade =
    detectGradeFromTitle(
      title
    );

  const detectedGrade =
    structuredGrade ||
    titleGrade;

  if (detectedGrade) {
    return (
      detectedGrade ===
      normalizeGrade(
        group.grade
      )
    );
  }

  return allowMissingGrade;
}

async function relaxedProductForGroup(
  products:
    IdefixProduct[],
  group:
    CenterGroup
) {
  const candidates:
    IdefixProduct[] = [];

  for (
    const product of
      products
  ) {
    if (
      await productLooksLikeCenterGroup(
        product,
        group,
        true
      )
    ) {
      candidates.push(
        product
      );
    }
  }

  const distinct =
    new Map<
      string,
      IdefixProduct
    >();

  for (
    const product of
      candidates
  ) {
    distinct.set(
      productKey(product),
      product
    );
  }

  if (
    distinct.size === 1
  ) {
    return (
      Array.from(
        distinct.values()
      )[0] ||
      null
    );
  }

  return null;
}

async function exactProductForGroup(
  products:
    IdefixProduct[],
  group:
    CenterGroup
) {
  const matches:
    IdefixProduct[] = [];

  for (
    const product of
      products
  ) {
    if (
      await productLooksLikeCenterGroup(
        product,
        group,
        false
      )
    ) {
      matches.push(
        product
      );
    }
  }

  if (
    matches.length > 1
  ) {
    const distinct =
      new Map<
        string,
        IdefixProduct
      >();

    for (
      const product of
        matches
    ) {
      distinct.set(
        productKey(product),
        product
      );
    }

    if (
      distinct.size > 1
    ) {
      throw new Error(
        `${productTitle(
          group
        )}: İdefix'te aynı model/hafıza/renk/kalite için birden fazla ürün bulundu. Yanlış barkod seçmemek için otomatik gönderim durduruldu.`
      );
    }
  }

  return (
    matches[0] ||
    null
  );
}

function referenceProductForGroup(
  products: IdefixProduct[],
  group: CenterGroup
) {
  const grade =
    normalizeGrade(
      group.grade
    );

  const candidates =
    products
      .map(
        (product) => {
          const title =
            product.title;

          if (
            !baseIdentityMatchesTitle(
              title,
              group
            ) ||
            detectGradeFromTitle(
              title
            ) !== grade
          ) {
            return null;
          }

          let score =
            100;

          if (
            containsPhrase(
              title,
              "YENILENMIS"
            )
          ) {
            score += 10;
          }

          if (
            text(
              product.brandId
            )
          ) {
            score += 10;
          }

          if (
            text(
              product.categoryId
            )
          ) {
            score += 10;
          }

          if (
            Array.isArray(
              product.attributes
            ) &&
            product.attributes
              .length > 0
          ) {
            score += 10;
          }

          if (
            numberOrNull(
              product.vatRate
            ) !== null
          ) {
            score += 5;
          }

          return {
            product,
            score,
          };
        }
      )
      .filter(Boolean)
      .sort(
        (
          a: any,
          b: any
        ) =>
          b.score -
          a.score
      ) as Array<{
        product:
          IdefixProduct;
        score: number;
      }>;

  if (
    candidates.length === 0
  ) {
    return null;
  }

  const first =
    candidates[0];

  const top =
    candidates.filter(
      (candidate) =>
        candidate.score ===
        first.score
    );

  const uniqueTargets =
    new Set(
      top.map(
        (candidate) =>
          [
            text(
              candidate.product
                .brandId
            ),
            text(
              candidate.product
                .categoryId
            ),
          ].join("|")
      )
    );

  if (
    uniqueTargets.size > 1
  ) {
    throw new Error(
      `${productTitle(
        group
      )}: aynı model için farklı İdefix brand/category referansları bulundu. Yeni ürün oluşturma durduruldu.`
    );
  }

  return first.product;
}

async function categoryAttributes(
  categoryId:
    string | number
) {
  const payload =
    await idefixApi(
      `/pim/category-attribute/${encodeURIComponent(
        String(
          categoryId
        )
      )}`
    );

  return Array.isArray(
    payload?.categoryAttributes
  )
    ? payload.categoryAttributes as
        CategoryAttribute[]
    : [];
}

function attributeById(
  product: IdefixProduct,
  attributeId: unknown
) {
  const attributes =
    Array.isArray(
      product.attributes
    )
      ? product.attributes
      : [];

  return (
    attributes.find(
      (attribute) =>
        String(
          attribute
            ?.attributeId ??
            ""
        ) ===
        String(
          attributeId ??
            ""
        )
    ) || null
  );
}

function attributeValueName(
  product:
    IdefixProduct,
  definition:
    CategoryAttribute
) {
  const selected =
    attributeById(
      product,
      definition.attributeId
    );

  if (!selected) {
    return null;
  }

  const custom =
    text(
      selected
        .customAttributeValue
    );

  if (custom) {
    return custom;
  }

  const selectedId =
    text(
      selected
        .attributeValueId
    );

  if (!selectedId) {
    return null;
  }

  const values =
    Array.isArray(
      definition
        .attributeValues
    )
      ? definition
          .attributeValues
      : [];

  const value =
    values.find(
      (item) =>
        text(item?.id) ===
        selectedId
    );

  return (
    text(
      value?.name
    ) || null
  );
}

async function cachedCategoryAttributes(
  categoryId:
    string | number
) {
  const key =
    String(
      categoryId
    );

  let pending =
    idefixCategoryAttributeCache.get(
      key
    );

  if (!pending) {
    pending =
      categoryAttributes(
        categoryId
      );

    idefixCategoryAttributeCache.set(
      key,
      pending
    );
  }

  try {
    return await pending;
  } catch (error) {
    idefixCategoryAttributeCache.delete(
      key
    );
    throw error;
  }
}

async function structuredProductFacts(
  product:
    IdefixProduct
) {
  const categoryId =
    text(
      product.categoryId
    );

  if (
    !categoryId ||
    !Array.isArray(
      product.attributes
    ) ||
    product.attributes.length ===
      0
  ) {
    return {
      color:
        null as string | null,
      memory:
        null as string | null,
      grade:
        null as string | null,
      warranty:
        null as string | null,
    };
  }

  let definitions:
    CategoryAttribute[] = [];

  try {
    definitions =
      await cachedCategoryAttributes(
        categoryId
      );
  } catch {
    return {
      color:
        null as string | null,
      memory:
        null as string | null,
      grade:
        null as string | null,
      warranty:
        null as string | null,
    };
  }

  let color:
    string | null = null;
  let memory:
    string | null = null;
  let grade:
    string | null = null;
  let warranty:
    string | null = null;

  for (
    const definition of
      definitions
  ) {
    const value =
      attributeValueName(
        product,
        definition
      );

    if (!value) {
      continue;
    }

    if (
      !color &&
      isColorAttribute(
        definition
      )
    ) {
      color = value;
      continue;
    }

    if (
      !memory &&
      isMemoryAttribute(
        definition
      )
    ) {
      memory = value;
      continue;
    }

    if (
      !grade &&
      isCosmeticAttribute(
        definition
      )
    ) {
      grade = value;
      continue;
    }

    if (
      !warranty &&
      isWarrantyAttribute(
        definition
      )
    ) {
      warranty = value;
    }
  }

  return {
    color,
    memory,
    grade,
    warranty,
  };
}

function colorValueMatches(
  actual:
    unknown,
  desired:
    unknown
) {
  const actualNormalized =
    normalizeText(
      actual
    );

  if (!actualNormalized) {
    return false;
  }

  return colorAliases(
    desired
  ).some(
    (alias) =>
      actualNormalized ===
        normalizeText(
          alias
        ) ||
      containsPhrase(
        actualNormalized,
        alias
      )
  );
}

function memoryValueMatches(
  actual:
    unknown,
  desired:
    unknown
) {
  const a =
    compactNormalized(
      normalizeMemory(
        actual
      )
    );

  const d =
    compactNormalized(
      normalizeMemory(
        desired
      )
    );

  if (!a || !d) {
    return false;
  }

  return (
    a === d ||
    a.includes(d) ||
    d.includes(a)
  );
}

function isColorAttribute(
  attribute:
    CategoryAttribute
) {
  const title =
    normalizeText(
      attribute
        .attributeTitle
    );

  return (
    title === "RENK" ||
    title.includes("RENK") ||
    title === "COLOR" ||
    title.includes("COLOR")
  );
}

function isCosmeticAttribute(
  attribute:
    CategoryAttribute
) {
  const title =
    normalizeText(
      attribute
        .attributeTitle
    );

  return (
    title.includes(
      "KOZMETIK"
    ) ||
    title ===
      "KALITE" ||
    title.includes(
      "KALITE DURUM"
    ) ||
    title.includes(
      "URUN DURUMU"
    )
  );
}

function isMemoryAttribute(
  attribute:
    CategoryAttribute
) {
  const title =
    normalizeText(
      attribute
        .attributeTitle
    );

  return (
    title.includes(
      "DAHILI HAFIZA"
    ) ||
    title ===
      "HAFIZA" ||
    title.includes(
      "DEPOLAMA"
    ) ||
    title.includes(
      "KAPASITE"
    )
  );
}

function isWarrantyAttribute(
  attribute:
    CategoryAttribute
) {
  const title =
    normalizeText(
      attribute
        .attributeTitle
    );

  return (
    title.includes(
      "GARANTI"
    )
  );
}

function pickAttributeValueByAliases(
  attribute:
    CategoryAttribute,
  aliases:
    string[],
  customFallback?:
    string
) {
  if (
    attribute.allowCustom ===
    true
  ) {
    const custom =
      text(
        customFallback ||
        aliases[0]
      );

    if (!custom) {
      return null;
    }

    return {
      attributeId:
        attribute
          .attributeId,
      attributeValueId:
        null,
      customAttributeValue:
        custom,
    };
  }

  const values =
    Array.isArray(
      attribute
        .attributeValues
    )
      ? attribute
          .attributeValues
      : [];

  const normalizedAliases =
    aliases
      .map(
        normalizeText
      )
      .filter(Boolean);

  // Önce birebir eşleşme.
  let selected =
    values.find(
      (value) =>
        normalizedAliases.includes(
          normalizeText(
            value?.name
          )
        )
    );

  // Sonra güvenli içerme eşleşmesi.
  // Örnek:
  // "A Kalite" <-> "A Kalite / Mükemmel"
  if (!selected) {
    selected =
      values.find(
        (value) => {
          const name =
            normalizeText(
              value?.name
            );

          if (!name) {
            return false;
          }

          return normalizedAliases.some(
            (alias) =>
              alias.length >= 3 &&
              (
                containsPhrase(
                  name,
                  alias
                ) ||
                containsPhrase(
                  alias,
                  name
                )
              )
          );
        }
      );
  }

  if (
    selected?.id ===
      null ||
    selected?.id ===
      undefined ||
    text(
      selected?.id
    ) === ""
  ) {
    return null;
  }

  return {
    attributeId:
      attribute
        .attributeId,
    attributeValueId:
      selected.id,
    customAttributeValue:
      null,
  };
}

function colorAttributeValue(
  attribute:
    CategoryAttribute,
  color: string
) {
  return pickAttributeValueByAliases(
    attribute,
    colorAliases(
      color
    ),
    color
  );
}

function cosmeticAliases(
  grade:
    string
) {
  const normalized =
    normalizeGrade(
      grade
    );

  if (
    normalized ===
    "A"
  ) {
    return [
      "A",
      "A KALITE",
      "MUKEMMEL",
      "MUKEMMEL DURUM",
      "YENI GIBI",
    ];
  }

  if (
    normalized ===
    "B"
  ) {
    return [
      "B",
      "B KALITE",
      "COK IYI",
      "COK IYI DURUM",
    ];
  }

  if (
    normalized ===
    "C"
  ) {
    return [
      "C",
      "C KALITE",
      "IYI",
      "IYI DURUM",
    ];
  }

  return [
    normalized,
  ].filter(Boolean);
}

function memoryAliases(
  memory:
    string
) {
  const normalized =
    normalizeMemory(
      memory
    );

  const compact =
    normalized.replace(
      /\s+/g,
      ""
    );

  return Array.from(
    new Set([
      normalized,
      compact,
      text(memory),
    ])
  ).filter(Boolean);
}

function warrantyAliases(
  warranty:
    string
) {
  const normalized =
    normalizeText(
      warranty
    );

  const aliases =
    new Set<string>([
      normalized,
      text(warranty),
    ]);

  const monthMatch =
    normalized.match(
      /(\d+)\s*AY/
    );

  if (monthMatch) {
    const months =
      Number(
        monthMatch[1]
      );

    aliases.add(
      `${months} AY`
    );
    aliases.add(
      `${months} AY GARANTI`
    );
    aliases.add(
      `${months} AY GARANTILI`
    );

    if (
      months === 12
    ) {
      aliases.add(
        "1 YIL"
      );
      aliases.add(
        "1 YIL GARANTI"
      );
      aliases.add(
        "1 YIL GARANTILI"
      );
    }

    if (
      months === 24
    ) {
      aliases.add(
        "2 YIL"
      );
      aliases.add(
        "2 YIL GARANTI"
      );
      aliases.add(
        "2 YIL GARANTILI"
      );
    }
  }

  return Array.from(
    aliases
  ).filter(Boolean);
}

function derivedRequiredAttributeValue(
  attribute:
    CategoryAttribute,
  group:
    CenterGroup
) {
  if (
    isCosmeticAttribute(
      attribute
    )
  ) {
    return pickAttributeValueByAliases(
      attribute,
      cosmeticAliases(
        group.grade
      ),
      normalizeGrade(
        group.grade
      )
    );
  }

  if (
    isMemoryAttribute(
      attribute
    )
  ) {
    return pickAttributeValueByAliases(
      attribute,
      memoryAliases(
        group.memory
      ),
      group.memory
    );
  }

  if (
    isWarrantyAttribute(
      attribute
    )
  ) {
    return pickAttributeValueByAliases(
      attribute,
      warrantyAliases(
        group.warranty
      ),
      group.warranty
    );
  }

  return null;
}

function attributeAvailableValues(
  attribute:
    CategoryAttribute
) {
  const values =
    Array.isArray(
      attribute
        .attributeValues
    )
      ? attribute
          .attributeValues
      : [];

  return values
    .map(
      (value) =>
        text(
          value?.name
        )
    )
    .filter(Boolean)
    .slice(0, 30);
}

async function buildCreateAttributes(
  reference:
    IdefixProduct,
  group:
    CenterGroup
) {
  const categoryId =
    reference.categoryId;

  if (
    categoryId ===
      null ||
    categoryId ===
      undefined ||
    text(categoryId) ===
      ""
  ) {
    throw new Error(
      `${productTitle(
        group
      )}: referans üründe categoryId yok.`
    );
  }

  const schema =
    await categoryAttributes(
      categoryId
    );

  if (
    schema.length === 0
  ) {
    throw new Error(
      `${productTitle(
        group
      )}: İdefix kategori özellikleri alınamadı.`
    );
  }

  const output:
    Array<{
      attributeId:
        number | string;
      attributeValueId:
        number | string | null;
      customAttributeValue:
        string | null;
    }> = [];

  let colorFound =
    false;

  for (
    const attribute of
      schema
  ) {
    if (
      isColorAttribute(
        attribute
      )
    ) {
      const selected =
        colorAttributeValue(
          attribute,
          group.color
        );

      if (!selected) {
        throw new Error(
          `${productTitle(
            group
          )}: İdefix kategori renklerinde "${group.color}" / ${colorAliases(
            group.color
          ).join(
            ", "
          )} bulunamadı. Kullanılabilir değerler: ${attributeAvailableValues(
            attribute
          ).join(
            ", "
          ) || "-"}.`
        );
      }

      output.push(
        selected
      );

      colorFound =
        true;

      continue;
    }

    const referenceValue =
      attributeById(
        reference,
        attribute
          .attributeId
      );

    if (
      referenceValue
    ) {
      output.push({
        attributeId:
          attribute
            .attributeId,
        attributeValueId:
          referenceValue
            .attributeValueId ??
          null,
        customAttributeValue:
          text(
            referenceValue
              .customAttributeValue
          ) || null,
      });

      continue;
    }

    // Referans üründe zorunlu alan eksikse,
    // Merkez cihaz bilgisinden güvenli şekilde türetmeyi dene.
    if (
      attribute.required ===
      true
    ) {
      const derived =
        derivedRequiredAttributeValue(
          attribute,
          group
        );

      if (derived) {
        output.push(
          derived
        );

        continue;
      }

      throw new Error(
        `${productTitle(
          group
        )}: zorunlu İdefix özelliği referans üründe yok ve Merkez verisinden güvenli türetilemedi: ${text(
          attribute
            .attributeTitle
        ) || String(
          attribute
            .attributeId
        )}. Kullanılabilir değerler: ${attributeAvailableValues(
          attribute
        ).join(
          ", "
        ) || "-"}.`
      );
    }
  }

  if (
    !colorFound
  ) {
    throw new Error(
      `${productTitle(
        group
      )}: kategori özelliklerinde renk attribute'u bulunamadı.`
    );
  }

  return output;
}

function imageUrlsFromJson(
  value: unknown,
  keyHint = "",
  output = new Set<string>(),
  depth = 0
) {
  if (
    depth > 8 ||
    value === null ||
    value === undefined
  ) {
    return output;
  }

  if (
    typeof value ===
    "string"
  ) {
    const raw =
      value.trim();

    const key =
      normalizeText(
        keyHint
      );

    if (
      /^https:\/\//i.test(
        raw
      ) &&
      (
        key.includes(
          "IMAGE"
        ) ||
        key.includes(
          "GORSEL"
        ) ||
        /\.(?:jpe?g|png|webp)(?:\?|$)/i.test(
          raw
        )
      )
    ) {
      output.add(raw);
    }

    return output;
  }

  if (
    Array.isArray(value)
  ) {
    for (
      const item of value
    ) {
      imageUrlsFromJson(
        item,
        keyHint,
        output,
        depth + 1
      );
    }

    return output;
  }

  if (
    typeof value ===
    "object"
  ) {
    for (
      const [
        key,
        child,
      ] of Object.entries(
        value as Record<
          string,
          unknown
        >
      )
    ) {
      imageUrlsFromJson(
        child,
        key,
        output,
        depth + 1
      );
    }
  }

  return output;
}

function findVatInJson(
  value: unknown,
  depth = 0
): number | null {
  if (
    depth > 8 ||
    value === null ||
    value === undefined
  ) {
    return null;
  }

  if (
    Array.isArray(value)
  ) {
    for (
      const item of value
    ) {
      const found =
        findVatInJson(
          item,
          depth + 1
        );

      if (
        found !== null
      ) {
        return found;
      }
    }

    return null;
  }

  if (
    typeof value ===
    "object"
  ) {
    for (
      const [
        key,
        child,
      ] of Object.entries(
        value as Record<
          string,
          unknown
        >
      )
    ) {
      const normalized =
        normalizeText(key);

      if (
        [
          "VATRATE",
          "VAT RATE",
          "VAT",
          "KDV",
          "KDV ORANI",
        ].includes(
          normalized
        )
      ) {
        const n =
          numberOrNull(
            child
          );

        if (
          n !== null &&
          [
            0,
            1,
            8,
            10,
            18,
            20,
          ].includes(n)
        ) {
          return n;
        }
      }

      const nested =
        findVatInJson(
          child,
          depth + 1
        );

      if (
        nested !== null
      ) {
        return nested;
      }
    }
  }

  return null;
}

async function exactColorLocalTemplate(
  client:
    PoolClient,
  group:
    CenterGroup
) {
  const rows =
    await client.query(
      `
        SELECT
          id,
          channel,
          title,
          brand,
          model,
          memory,
          color,
          grade,
          warranty,
          raw_data
        FROM public.online_listings
        WHERE channel IN (
          'N11',
          'IKAS'
        )
          AND (
            model ILIKE $1
            OR title ILIKE $2
          )
        ORDER BY
          updated_at DESC,
          id DESC
        LIMIT 200
      `,
      [
        `%${group.model}%`,
        `%${group.model}%`,
      ]
    );

  const targetBrand =
    normalizeText(
      group.brand
    );

  const targetModel =
    normalizeText(
      group.model
    );

  const targetMemory =
    normalizeMemory(
      group.memory
    );

  const targetGrade =
    normalizeGrade(
      group.grade
    );

  const aliases =
    colorAliases(
      group.color
    );

  const matches =
    rows.rows.filter(
      (row: any) => {
        const haystack =
          [
            row?.title,
            row?.brand,
            row?.model,
            row?.memory,
            row?.color,
            row?.grade,
            JSON.stringify(
              row?.raw_data ||
              {}
            ),
          ].join(" ");

        const normalized =
          normalizeText(
            haystack
          );

        return (
          (
            normalizeText(
              row?.brand
            ) ===
              targetBrand ||
            containsPhrase(
              normalized,
              targetBrand
            )
          ) &&
          (
            normalizeText(
              row?.model
            ) ===
              targetModel ||
            containsPhrase(
              normalized,
              targetModel
            )
          ) &&
          (
            normalizeMemory(
              row?.memory
            ) ===
              targetMemory ||
            containsPhrase(
              normalized,
              targetMemory
            )
          ) &&
          aliases.some(
            (alias) =>
              containsPhrase(
                normalized,
                alias
              )
          ) &&
          (
            !normalizeText(
              row?.grade
            ) ||
            normalizeGrade(
              row?.grade
            ) ===
              targetGrade ||
            detectGradeFromTitle(
              normalized
            ) ===
              targetGrade
          )
        );
      }
    );

  if (
    matches.length === 0
  ) {
    return null;
  }

  for (
    const row of matches
  ) {
    const urls =
      Array.from(
        imageUrlsFromJson(
          row.raw_data
        )
      );

    if (
      urls.length > 0
    ) {
      return {
        row,
        imageUrl:
          urls[0],
        vatRate:
          findVatInJson(
            row.raw_data
          ),
      };
    }
  }

  return {
    row:
      matches[0],
    imageUrl:
      null,
    vatRate:
      findVatInJson(
        matches[0]
          .raw_data
      ),
  };
}

function validateOrigin(
  request:
    NextRequest
) {
  const origin =
    request.headers.get(
      "origin"
    );

  if (!origin) {
    return true;
  }

  const appUrl =
    text(
      process.env.APP_URL
    );

  if (appUrl) {
    try {
      return (
        origin ===
        new URL(
          appUrl
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

  return Boolean(
    host &&
    origin ===
      `${proto}://${host}`
  );
}

async function selectedDevices(
  client:
    PoolClient,
  deviceIds:
    number[]
) {
  const result =
    await client.query(
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
          status
        FROM public.stock_devices
        WHERE id = ANY(
          $1::bigint[]
        )
        ORDER BY id
      `,
      [
        deviceIds,
      ]
    );

  return result.rows as
    DeviceRow[];
}

function buildGroups(
  rows:
    DeviceRow[]
) {
  const groups =
    new Map<
      string,
      CenterGroup
    >();

  for (
    const row of rows
  ) {
    const key =
      groupKey(row);

    if (
      !groups.has(key)
    ) {
      groups.set(
        key,
        {
          key,
          brand:
            text(
              row.brand
            ),
          model:
            text(
              row.model
            ),
          memory:
            text(
              row.memory
            ),
          color:
            text(
              row.color
            ),
          grade:
            normalizeGrade(
              row.grade
            ),
          warranty:
            text(
              row.warranty
            ),
          items: [],
        }
      );
    }

    groups.get(
      key
    )!.items.push({
      deviceId:
        Number(row.id),
      imei:
        text(row.imei),
    });
  }

  return Array.from(
    groups.values()
  );
}

async function validateDevices(
  client:
    PoolClient,
  requestedIds:
    number[],
  rows:
    DeviceRow[]
) {
  const errors:
    string[] = [];

  const byId =
    new Map(
      rows.map(
        (row) => [
          Number(row.id),
          row,
        ]
      )
    );

  for (
    const id of requestedIds
  ) {
    const row =
      byId.get(id);

    if (!row) {
      errors.push(
        `Cihaz ID ${id} Merkez stokta bulunamadı.`
      );

      continue;
    }

    const imei =
      text(row.imei);

    if (
      !/^\d{15}$/.test(
        imei
      )
    ) {
      errors.push(
        `${imei || id}: IMEI 15 hane değil.`
      );
    }

    if (
      normalizeText(
        row.status
      ) !== "AVAILABLE"
    ) {
      errors.push(
        `${imei}: cihaz durumu AVAILABLE değil (${text(
          row.status
        ) || "-"}).`
      );
    }

    for (
      const [
        label,
        value,
      ] of [
        [
          "Marka",
          row.brand,
        ],
        [
          "Model",
          row.model,
        ],
        [
          "Hafıza",
          row.memory,
        ],
        [
          "Renk",
          row.color,
        ],
        [
          "Grade",
          row.grade,
        ],
        [
          "Garanti",
          row.warranty,
        ],
      ] as Array<
        [string, unknown]
      >
    ) {
      if (
        !text(value)
      ) {
        errors.push(
          `${imei}: ${label} eksik.`
        );
      }
    }
  }

  if (
    requestedIds.length >
    100
  ) {
    errors.push(
      "Tek seferde en fazla 100 IMEI İdefix'e gönderilebilir."
    );
  }

  if (
    rows.length > 0
  ) {
    const membership =
      await client.query(
        `
          SELECT
            stock_device_id,
            imei,
            membership_status
          FROM public.online_channel_devices
          WHERE channel = 'IDEFIX'
            AND stock_device_id = ANY(
              $1::bigint[]
            )
        `,
        [
          requestedIds,
        ]
      );

    for (
      const row of
        membership.rows
    ) {
      errors.push(
        `${text(
          row.imei
        )}: İdefix kanalında zaten kayıtlı (${text(
          row.membership_status
        ) || "KAYITLI"}).`
      );
    }
  }

  return errors;
}

function isGlobalCatalogBarcode(
  value: unknown
) {
  return /^\d{8,14}$/.test(
    text(value)
  );
}

async function localCatalogBarcodeForGroup(
  client:
    PoolClient,
  group:
    CenterGroup
) {
  const result =
    await client.query(
      `
        SELECT
          id,
          external_variant_id,
          brand,
          model,
          memory,
          color,
          grade,
          warranty,
          raw_data
        FROM public.online_listings
        WHERE channel = 'IDEFIX'
          AND (
            brand ILIKE $1
            OR title ILIKE $2
          )
          AND (
            model ILIKE $3
            OR title ILIKE $4
          )
        ORDER BY
          updated_at DESC,
          id DESC
        LIMIT 100
      `,
      [
        group.brand,
        `%${group.brand}%`,
        group.model,
        `%${group.model}%`,
      ]
    );

  for (
    const row of
      result.rows
  ) {
    const sameGroup =
      normalizeText(
        row?.brand
      ) ===
        normalizeText(
          group.brand
        ) &&
      normalizeText(
        row?.model
      ) ===
        normalizeText(
          group.model
        ) &&
      normalizeMemory(
        row?.memory
      ) ===
        normalizeMemory(
          group.memory
        ) &&
      normalizeText(
        row?.color
      ) ===
        normalizeText(
          group.color
        ) &&
      normalizeGrade(
        row?.grade
      ) ===
        normalizeGrade(
          group.grade
        ) &&
      normalizeText(
        row?.warranty
      ) ===
        normalizeText(
          group.warranty
        );

    if (!sameGroup) {
      continue;
    }

    const raw =
      row?.raw_data &&
      typeof row.raw_data ===
        "object"
        ? row.raw_data
        : {};

    const candidates = [
      raw?.catalogBarcode,
      raw?.idefixCatalogBarcode,
      row?.external_variant_id,
    ];

    for (
      const candidate of
        candidates
    ) {
      if (
        isGlobalCatalogBarcode(
          candidate
        )
      ) {
        return text(
          candidate
        );
      }
    }
  }

  return null;
}

async function localManagedIdefixCount(
  client:
    PoolClient,
  barcode:
    string,
  vendorStockCode:
    string
) {
  const result =
    await client.query(
      `
        SELECT
          COUNT(*)::int AS count
        FROM public.online_channel_devices ocd
        JOIN public.online_listings ol
          ON ol.id =
             ocd.online_listing_id
        WHERE ocd.channel = 'IDEFIX'
          AND ol.channel = 'IDEFIX'
          AND (
            ol.external_variant_id = $1
            OR ol.external_stock_code = $2
          )
          AND ocd.membership_status IN (
            'LISTED',
            'RESERVED',
            'PENDING_CREATE'
          )
      `,
      [
        barcode,
        vendorStockCode,
      ]
    );

  return Number(
    result.rows?.[0]
      ?.count || 0
  );
}

async function prepareGroup(
  client:
    PoolClient,
  products:
    IdefixProduct[],
  group:
    CenterGroup,
  salePrice:
    number,
  listPrice:
    number,
  requestedCatalogBarcode:
    string | null = null
): Promise<
  PreparedGroup
> {
  const blockers:
    string[] = [];

  let exactProduct:
    IdefixProduct | null =
      null;


  try {
    exactProduct =
      await exactProductForGroup(
        products,
        group
      );

    if (!exactProduct) {
      exactProduct =
        await relaxedProductForGroup(
          products,
          group
        );
    }
  } catch (error: any) {
    blockers.push(
      error instanceof Error
        ? error.message
        : "İdefix mevcut ürün eşleştirme hatası."
    );
  }

  if (exactProduct) {
    const barcode =
      text(
        exactProduct
          .barcode
      );

    if (!barcode) {
      blockers.push(
        "Mevcut İdefix ürününde barkod yok."
      );
    }

    const vendorStockCode =
      text(
        exactProduct
          .vendorStockCode
      ) ||
      makeVendorStockCode(
        group
      );

    const currentStock =
      numberOrNull(
        exactProduct
          .inventoryQuantity
      ) ?? 0;

    const isCnetStableProduct =
      barcode ===
      makeStableBarcode(
        group
      );

    let targetAfterStock =
      currentStock +
      group.items.length;

    // Recovery / idempotency:
    // Önceki create İdefix'te başarılı olup DB kaydı yazılmadan sonraki
    // inventory adımında hata verdiyse aynı stabil CNET barkodu tekrar bulunur.
    // Bu durumda mevcut stok zaten seçili IMEI'yi içeriyor olabilir.
    // Yerel yönetilen cihaz sayısını baz alarak aynı IMEI'yi ikinci kez artırma.
    if (
      isCnetStableProduct
    ) {
      const localManagedCount =
        await localManagedIdefixCount(
          client,
          barcode,
          vendorStockCode
        );

      const desiredManagedStock =
        localManagedCount +
        group.items.length;

      targetAfterStock =
        Math.max(
          currentStock,
          desiredManagedStock
        );
    }

    return {
      group,
      action:
        "EXISTING_PRODUCT",
      exactProduct,
      referenceProduct:
        null,
      title:
        text(
          exactProduct.title
        ) ||
        productTitle(
          group
        ),
      salePrice,
      listPrice,
      targetBeforeStock:
        currentStock,
      targetAfterStock,
      barcode,
      catalogBarcode:
        isGlobalCatalogBarcode(
          barcode
        )
          ? barcode
          : null,
      catalogBarcodeSource:
        isGlobalCatalogBarcode(
          barcode
        )
          ? "POOL"
          : null,
      vendorStockCode,
      productMainId:
        text(
          exactProduct
            .productMainId
        ) ||
        makeProductMainId(
          group
        ),
      brandId:
        exactProduct.brandId ??
        null,
      categoryId:
        exactProduct
          .categoryId ??
        null,
      vatRate:
        numberOrNull(
          exactProduct
            .vatRate
        ),
      imageUrl:
        Array.isArray(
          exactProduct.images
        )
          ? text(
              exactProduct
                .images?.[0]
                ?.url
            ) || null
          : null,
      attributes:
        Array.isArray(
          exactProduct
            .attributes
        )
          ? exactProduct
              .attributes
              .map(
                (
                  attribute: any
                ) => ({
                  attributeId:
                    attribute
                      .attributeId,
                  attributeValueId:
                    attribute
                      .attributeValueId ??
                    null,
                  customAttributeValue:
                    text(
                      attribute
                        .customAttributeValue
                    ) || null,
                })
              )
              .filter(
                (
                  attribute: any
                ) =>
                  attribute
                    .attributeId !==
                    null &&
                  attribute
                    .attributeId !==
                    undefined
              )
          : [],
      blockers,
    };
  }

  const requestedBarcode =
    text(
      requestedCatalogBarcode
    );

  const savedBarcode =
    requestedBarcode
      ? null
      : await localCatalogBarcodeForGroup(
          client,
          group
        );

  const catalogBarcode =
    requestedBarcode ||
    text(
      savedBarcode
    );

  const catalogBarcodeSource:
    "REQUEST" |
    "LOCAL_MAPPING" |
    null =
      requestedBarcode
        ? "REQUEST"
        : savedBarcode
        ? "LOCAL_MAPPING"
        : null;

  if (
    requestedBarcode &&
    !isGlobalCatalogBarcode(
      requestedBarcode
    )
  ) {
    return {
      group,
      action:
        "FAST_LISTING",
      exactProduct:
        null,
      referenceProduct:
        null,
      title:
        productTitle(
          group
        ),
      salePrice,
      listPrice,
      targetBeforeStock:
        0,
      targetAfterStock:
        group.items.length,
      barcode:
        requestedBarcode,
      catalogBarcode:
        requestedBarcode,
      catalogBarcodeSource:
        "REQUEST",
      vendorStockCode:
        makeVendorStockCode(
          group
        ),
      productMainId:
        makeProductMainId(
          group
        ),
      brandId:
        null,
      categoryId:
        null,
      vatRate:
        1,
      imageUrl:
        null,
      attributes: [],
      blockers: [
        "İdefix katalog barkodu 8-14 haneli sayısal global barkod olmalıdır.",
      ],
    };
  }

  if (
    catalogBarcode
  ) {
    return {
      group,
      action:
        "FAST_LISTING",
      exactProduct:
        null,
      referenceProduct:
        null,
      title:
        productTitle(
          group
        ),
      salePrice,
      listPrice,
      targetBeforeStock:
        0,
      targetAfterStock:
        group.items.length,
      barcode:
        catalogBarcode,
      catalogBarcode,
      catalogBarcodeSource,
      vendorStockCode:
        makeVendorStockCode(
          group
        ),
      productMainId:
        makeProductMainId(
          group
        ),
      brandId:
        null,
      categoryId:
        null,
      vatRate:
        1,
      imageUrl:
        null,
      attributes: [],
      blockers: [],
    };
  }

  return {
    group,
    action:
      "CREATE_PRODUCT",
    exactProduct:
      null,
    referenceProduct:
      null,
    title:
      productTitle(
        group
      ),
    salePrice,
    listPrice,
    targetBeforeStock:
      0,
    targetAfterStock:
      group.items.length,
    barcode:
      "",
    catalogBarcode:
      null,
    catalogBarcodeSource:
      null,
    vendorStockCode:
      makeVendorStockCode(
        group
      ),
    productMainId:
      makeProductMainId(
        group
      ),
    brandId:
      null,
    categoryId:
      null,
    vatRate:
      1,
    imageUrl:
      null,
    attributes: [],
    blockers: [
      "CATALOG_BARCODE_REQUIRED: Bu ürün İdefix satıcı havuzunda henüz yok. İlk eşleştirme için İdefix katalog barkodunu bir kez gir; sonraki aynı ürünlerde sistem otomatik kullanacak.",
    ],
  };


}

function previewView(
  prepared:
    PreparedGroup
) {
  return {
    key:
      prepared.group.key,
    action:
      prepared.action,
    brand:
      prepared.group.brand,
    model:
      prepared.group.model,
    memory:
      prepared.group.memory,
    color:
      prepared.group.color,
    grade:
      prepared.group.grade,
    warranty:
      prepared.group.warranty,
    imeis:
      prepared.group.items.map(
        (item) =>
          item.imei
      ),
    deviceIds:
      prepared.group.items.map(
        (item) =>
          item.deviceId
      ),
    salePrice:
      prepared.salePrice,
    listPrice:
      prepared.listPrice,
    beforeStock:
      prepared
        .targetBeforeStock,
    afterStock:
      prepared
        .targetAfterStock,
    barcode:
      prepared.barcode,
    catalogBarcode:
      prepared.catalogBarcode,
    catalogBarcodeSource:
      prepared.catalogBarcodeSource ||
      null,
    needsCatalogBarcode:
      prepared.blockers.some(
        (message) =>
          message.startsWith(
            "CATALOG_BARCODE_REQUIRED:"
          )
      ),
    vendorStockCode:
      prepared
        .vendorStockCode,
    productMainId:
      prepared
        .productMainId,
    brandId:
      prepared.brandId,
    categoryId:
      prepared.categoryId,
    vatRate:
      prepared.vatRate,
    imageReady:
      Boolean(
        prepared.imageUrl
      ),
    imageUrl:
      prepared.imageUrl,
    attributeCount:
      prepared
        .attributes
        .length,
    blockers:
      prepared.blockers,
    canCommit:
      prepared.blockers
        .length === 0,
    matchedProduct:
      prepared.exactProduct
        ? {
            barcode:
              text(
                prepared
                  .exactProduct
                  ?.barcode
              ),
            title:
              text(
                prepared
                  .exactProduct
                  ?.title
              ),
            status:
              text(
                prepared
                  .exactProduct
                  ?.status ??
                prepared
                  .exactProduct
                  ?.state
              ),
          }
        : null,
    referenceProduct:
      prepared.referenceProduct
        ? {
            barcode:
              text(
                prepared
                  .referenceProduct
                  ?.barcode
              ),
            title:
              text(
                prepared
                  .referenceProduct
                  ?.title
              ),
            brandId:
              prepared
                .referenceProduct
                ?.brandId ??
              null,
            categoryId:
              prepared
                .referenceProduct
                ?.categoryId ??
              null,
          }
        : null,
  };
}

async function fastListingUpload(
  prepared:
    PreparedGroup
) {
  const vendorId =
    getIdefixVendorId();

  const response =
    await idefixApi(
      `/pim/catalog/${encodeURIComponent(
        vendorId
      )}/fast-listing`,
      {
        method:
          "POST",
        body: {
          items: [
            {
              title:
                prepared.title,
              barcode:
                prepared.barcode,
              price:
                prepared.salePrice,
              comparePrice:
                prepared.listPrice,
              inventoryQuantity:
                prepared.targetAfterStock,
              vendorStockCode:
                prepared.vendorStockCode,
            },
          ],
        },
        timeoutMs:
          35_000,
      }
    );

  const batchRequestId =
    text(
      response
        ?.batchRequestId
    );

  if (
    !batchRequestId
  ) {
    throw new Error(
      `${prepared.title}: İdefix fast-listing batchRequestId döndürmedi.`
    );
  }

  return {
    response,
    batchRequestId,
  };
}

async function fastListingResult(
  batchId:
    string
) {
  const vendorId =
    getIdefixVendorId();

  // Canlı İdefix prod endpointi POST isteğine 405 + Allow: GET dönüyor.
  // Bu nedenle fast-listing-result canlı ortamda GET ile sorgulanır.
  return idefixApi(
    `/pim/catalog/${encodeURIComponent(
      vendorId
    )}/fast-listing-result/${encodeURIComponent(
      batchId
    )}`,
    {
      method:
        "GET",
      timeoutMs:
        35_000,
    }
  );
}

function fastListingFailureCode(
  item:
    any
) {
  const reason =
    item?.failureReasons;

  if (
    typeof reason ===
    "string"
  ) {
    return normalizeText(
      reason
    );
  }

  if (
    reason &&
    typeof reason ===
      "object"
  ) {
    return normalizeText(
      reason?.message ||
      reason?.code ||
      JSON.stringify(
        reason
      )
    );
  }

  return "";
}

async function waitFastListingResult(
  batchId:
    string,
  barcode:
    string
) {
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
      await fastListingResult(
        batchId
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
      normalizeText(
        item?.status
      );

    const batchStatus =
      normalizeText(
        last?.status
      );

    if (
      itemStatus ===
        "COMPLETED"
    ) {
      return {
        success:
          true,
        payload:
          last,
        item,
      };
    }

    if (
      itemStatus ===
        "DECLINE"
    ) {
      return {
        success:
          false,
        payload:
          last,
        item,
        failureCode:
          fastListingFailureCode(
            item
          ),
      };
    }

    if (
      [
        "FAILED",
        "DECLINE",
      ].includes(
        batchStatus
      )
    ) {
      return {
        success:
          false,
        payload:
          last,
        item,
        failureCode:
          fastListingFailureCode(
            item
          ) ||
          batchStatus,
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
    failureCode:
      "FAST_LISTING_TIMEOUT",
  };
}

function matchedFastListingLooksSafe(
  matched:
    any,
  prepared:
    PreparedGroup
) {
  const matchedBarcode =
    text(
      matched?.barcode
    );

  if (
    !matchedBarcode ||
    matchedBarcode !==
      prepared.barcode
  ) {
    return false;
  }

  const name =
    text(
      matched?.name ||
      matched?.title
    );

  if (!name) {
    return false;
  }

  // Barkod birebir aynı olduğu için ana güvenlik kriteri güçlü.
  // Ek olarak marka + model + hafızayı doğrularız.
  return (
    containsPhrase(
      name,
      prepared.group.brand
    ) &&
    containsPhrase(
      name,
      `${normalizeText(
        prepared.group.model
      )} ${normalizeMemory(
        prepared.group.memory
      )}`
    )
  );
}

async function inventoryUpload(
  prepared:
    PreparedGroup
) {
  const vendorId =
    getIdefixVendorId();

  const payload =
    await idefixApi(
      `/pim/catalog/${encodeURIComponent(
        vendorId
      )}/inventory-upload`,
      {
        method:
          "POST",
        body: {
          items: [
            {
              barcode:
                prepared.barcode,
              price:
                prepared
                  .salePrice,
              comparePrice:
                prepared
                  .listPrice,
              inventoryQuantity:
                prepared
                  .targetAfterStock,
              // İdefix validasyonu: 1-50 arası zorunlu.
              // Yenilenmiş tekil cihaz akışında güvenli değer 1.
              maximumPurchasableQuantity:
                1,
              deliveryDuration:
                numberOrNull(
                  prepared
                    .exactProduct
                    ?.deliveryDuration
                ) ?? 1,
              deliveryType:
                text(
                  prepared
                    .exactProduct
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
      payload
        ?.batchRequestId
    );

  if (
    !batchRequestId
  ) {
    throw new Error(
      `${prepared.title}: İdefix inventory-upload batchRequestId döndürmedi.`
    );
  }

  return {
    payload,
    batchRequestId,
  };
}

async function inventoryResult(
  batchId:
    string
) {
  const vendorId =
    getIdefixVendorId();

  return idefixApi(
    `/pim/catalog/${encodeURIComponent(
      vendorId
    )}/inventory-result/${encodeURIComponent(
      batchId
    )}`
  );
}

function idefixFailureDetail(
  value: unknown
) {
  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  if (
    typeof value ===
    "string"
  ) {
    return value.trim();
  }

  if (
    typeof value ===
    "number" ||
    typeof value ===
    "boolean"
  ) {
    return String(value);
  }

  try {
    return JSON.stringify(
      value
    );
  } catch {
    return String(value);
  }
}

async function waitInventory(
  batchId:
    string,
  barcode:
    string
) {
  let last:
    any = null;

  for (
    let attempt = 0;
    attempt < 6;
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
      await inventoryResult(
        batchId
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
          ) === barcode
      ) ||
      items[0] ||
      null;

    const status =
      normalizeText(
        item?.status ||
        last?.status
      );

    if (
      status ===
        "COMPLETED" ||
      status ===
        "COMPLETED SUCCESS" ||
      normalizeText(
        item?.status
      ) ===
        "COMPLETED"
    ) {
      return {
        success:
          true,
        payload:
          last,
        item,
      };
    }

    if (
      normalizeText(
        item?.status
      ) ===
        "DECLINE"
    ) {
      const failure =
        idefixFailureDetail(
          item
            ?.failureReasons
        );

      throw new Error(
        `İdefix stok/fiyat reddedildi. Barkod: ${text(
          item?.barcode
        ) || barcode}. Sebep: ${
          failure ||
          "DECLINE"
        }. Item: ${idefixFailureDetail(
          item
        )}`
      );
    }

    if (
      normalizeText(
        last?.status
      ) ===
        "FAILED"
    ) {
      throw new Error(
        `İdefix stok/fiyat batch FAILED. Batch: ${batchId}. Cevap: ${idefixFailureDetail(
          last
        )}`
      );
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

async function createProduct(
  prepared:
    PreparedGroup
) {
  if (
    prepared.action !==
    "CREATE_PRODUCT"
  ) {
    throw new Error(
      "İdefix create yanlış aksiyonda çağrıldı."
    );
  }

  if (
    prepared.blockers
      .length > 0
  ) {
    throw new Error(
      prepared.blockers.join(
        " | "
      )
    );
  }

  const vendorId =
    getIdefixVendorId();

  const reference =
    prepared
      .referenceProduct;

  const requestProduct:
    Record<
      string,
      unknown
    > = {
      barcode:
        prepared.barcode,
      title:
        prepared.title,
      productMainId:
        prepared
          .productMainId,
      brandId:
        prepared.brandId,
      categoryId:
        prepared.categoryId,
      inventoryQuantity:
        prepared
          .targetAfterStock,
      vendorStockCode:
        prepared
          .vendorStockCode,
      description:
        prepared.title,
      price:
        prepared.salePrice,
      comparePrice:
        prepared.listPrice,
      vatRate:
        prepared.vatRate,
      deliveryDuration:
        numberOrNull(
          reference
            ?.deliveryDuration
        ) ?? 1,
      deliveryType:
        text(
          reference
            ?.deliveryType
        ) ||
        "regular",
      images: [
        {
          url:
            prepared.imageUrl,
        },
      ],
      attributes:
        prepared.attributes,
    };

  // İdefix dokümanında opsiyonel olan alanları yalnızca gerçekten
  // geçerli bir değer varsa gönder. Bazı API validasyonları null/0
  // opsiyonel değerleri "alan gönderilmiş ama geçersiz" sayabiliyor.
  const desi =
    numberOrNull(
      (reference as any)
        ?.desi
    );

  if (
    desi !== null &&
    desi >= 0
  ) {
    requestProduct.desi =
      desi;
  }

  const weight =
    numberOrNull(
      reference
        ?.weight
    );

  if (
    weight !== null &&
    weight > 0
  ) {
    requestProduct.weight =
      weight;
  }

  const cargoCompanyId =
    numberOrNull(
      reference
        ?.cargoCompanyId
    );

  if (
    cargoCompanyId !==
      null &&
    cargoCompanyId > 0
  ) {
    requestProduct.cargoCompanyId =
      cargoCompanyId;
  }

  const shipmentAddressId =
    numberOrNull(
      reference
        ?.shipmentAddressId
    );

  if (
    shipmentAddressId !==
      null &&
    shipmentAddressId > 0
  ) {
    requestProduct.shipmentAddressId =
      shipmentAddressId;
  }

  const returnAddressId =
    numberOrNull(
      reference
        ?.returnAddressId
    );

  if (
    returnAddressId !==
      null &&
    returnAddressId > 0
  ) {
    requestProduct.returnAddressId =
      returnAddressId;
  }

  const response =
    await idefixApi(
      `/pim/pool/${encodeURIComponent(
        vendorId
      )}/create`,
      {
        method:
          "POST",
        body: {
          products: [
            requestProduct,
          ],
        },
        timeoutMs:
          45_000,
      }
    );

  const batchRequestId =
    text(
      response
        ?.batchRequestId
    );

  if (
    !batchRequestId
  ) {
    throw new Error(
      `${prepared.title}: İdefix create batchRequestId döndürmedi.`
    );
  }

  return {
    requestProduct,
    response,
    batchRequestId,
  };
}

async function batchResult(
  batchId:
    string
) {
  const vendorId =
    getIdefixVendorId();

  return idefixApi(
    `/pim/pool/${encodeURIComponent(
      vendorId
    )}/batch-result/${encodeURIComponent(
      batchId
    )}`,
    {
      timeoutMs:
        35_000,
    }
  );
}

function productState(
  payload:
    any,
  barcode:
    string
) {
  const products =
    Array.isArray(
      payload?.products
    )
      ? payload.products
      : [];

  const product =
    products.find(
      (row: any) =>
        text(
          row?.barcode
        ) === barcode
    ) ||
    products[0] ||
    null;

  return {
    product,
    state:
      normalizeText(
        product?.status ||
        product?.state
      ),
  };
}

async function waitCreateResult(
  batchId:
    string,
  barcode:
    string
) {
  let last:
    any = null;

  for (
    let attempt = 0;
    attempt < 7;
    attempt += 1
  ) {
    if (
      attempt > 0
    ) {
      await new Promise(
        (resolve) =>
          setTimeout(
            resolve,
            850
          )
      );
    }

    last =
      await batchResult(
        batchId
      );

    const state =
      productState(
        last,
        barcode
      );

    if (
      state.product &&
      [
        "WAITING VENDOR APPROVE",
        "READY FOR SALE",
        "NOT MATCHED",
        "WAITING CATALOG ACTION",
        "AUTO MATCHED",
        "MANUAL MATCHED",
        "MISSING INFO",
        "PLATFORM DECLINED",
      ].includes(
        state.state
      )
    ) {
      return {
        payload:
          last,
        ...state,
      };
    }

    const batchStatus =
      normalizeText(
        last?.status
      );

    if (
      [
        "FAILED",
        "CANCELLED",
      ].includes(
        batchStatus
      )
    ) {
      return {
        payload:
          last,
        ...state,
      };
    }
  }

  return {
    payload:
      last,
    ...productState(
      last,
      barcode
    ),
  };
}

function matchedProductLooksSafe(
  matched:
    any,
  group:
    CenterGroup
) {
  const name =
    text(
      matched?.name ||
      matched?.title
    );

  if (!name) {
    return false;
  }

  return (
    containsPhrase(
      name,
      group.brand
    ) &&
    containsPhrase(
      name,
      `${normalizeText(
        group.model
      )} ${normalizeMemory(
        group.memory
      )}`
    ) &&
    Boolean(
      matchedColorAlias(
        name,
        group.color
      )
    )
  );
}

async function approveProduct(
  barcode:
    string
) {
  const vendorId =
    getIdefixVendorId();

  return idefixApi(
    `/pim/pool/${encodeURIComponent(
      vendorId
    )}/approve-item`,
    {
      method:
        "POST",
      body: {
        items: [
          {
            barcode,
          },
        ],
      },
    }
  );
}

async function listByBarcode(
  barcode:
    string
) {
  const vendorId =
    getIdefixVendorId();

  const params =
    new URLSearchParams();

  params.set(
    "page",
    "1"
  );

  params.set(
    "limit",
    "10"
  );

  params.set(
    "barcode",
    barcode
  );

  const payload =
    await idefixApi(
      `/pim/pool/${encodeURIComponent(
        vendorId
      )}/list?${params.toString()}`
    );

  const products =
    Array.isArray(
      payload?.products
    )
      ? payload.products as
          IdefixProduct[]
      : [];

  return {
    payload,
    products,
  };
}

async function persistLocal(
  client:
    PoolClient,
  params: {
    prepared:
      PreparedGroup;
    finalProduct:
      IdefixProduct | null;
    membershipStatus:
      "LISTED" |
      "PENDING_CREATE";
    syncStatus:
      string;
    taskStatus:
      string;
    batchRequestId:
      string | null;
    finalStock:
      number;
    apiResult:
      unknown;
  }
) {
  const {
    prepared,
    finalProduct,
    membershipStatus,
    syncStatus,
    taskStatus,
    batchRequestId,
    finalStock,
    apiResult,
  } = params;

  const externalProductId =
    text(
      finalProduct
        ?.reference
    ) ||
    text(
      finalProduct
        ?.productMainId
    ) ||
    prepared.productMainId;

  const externalVariantId =
    text(
      finalProduct
        ?.barcode
    ) ||
    prepared.barcode;

  const externalStockCode =
    text(
      finalProduct
        ?.vendorStockCode
    ) ||
    prepared.vendorStockCode;

  const existing =
    await client.query(
      `
        SELECT
          id,
          raw_data
        FROM public.online_listings
        WHERE channel = 'IDEFIX'
          AND (
            external_variant_id = $1
            OR external_stock_code = $2
          )
        ORDER BY
          updated_at DESC,
          id DESC
        LIMIT 1
        FOR UPDATE
      `,
      [
        externalVariantId,
        externalStockCode,
      ]
    );

  const imeis =
    prepared.group.items.map(
      (item) =>
        item.imei
    );

  let listingId:
    number;

  if (
    existing.rowCount
  ) {
    const row =
      existing.rows[0];

    const oldRaw =
      row?.raw_data &&
      typeof row.raw_data ===
        "object"
        ? row.raw_data
        : {};

    const oldImeis =
      Array.isArray(
        oldRaw?.centerImeis
      )
        ? oldRaw
            .centerImeis
            .map(
              (value: any) =>
                text(value)
            )
            .filter(Boolean)
        : [];

    const centerImeis =
      Array.from(
        new Set([
          ...oldImeis,
          ...imeis,
        ])
      );

    const updated =
      await client.query(
        `
          UPDATE public.online_listings
          SET
            external_product_id = $2,
            external_variant_id = $3,
            external_stock_code = $4,
            title = $5,
            sale_price = $6,
            list_price = $7,
            quantity = $8,
            sync_status = $9,
            last_task_id = $10,
            last_task_status = $11,
            brand = $12,
            model = $13,
            memory = $14,
            color = $15,
            grade = $16,
            warranty = $17,
            raw_data =
              COALESCE(
                raw_data,
                '{}'::jsonb
              )
              || $18::jsonb,
            updated_at = now()
          WHERE id = $1
          RETURNING id
        `,
        [
          Number(row.id),
          externalProductId,
          externalVariantId,
          externalStockCode,
          text(
            finalProduct?.title
          ) ||
            prepared.title,
          prepared.salePrice,
          prepared.listPrice,
          finalStock,
          syncStatus,
          batchRequestId,
          taskStatus,
          prepared.group.brand,
          prepared.group.model,
          prepared.group.memory,
          prepared.group.color,
          prepared.group.grade,
          prepared.group.warranty,
          JSON.stringify({
            centerManaged:
              true,
            centerImeis,
            idefixBarcode:
              externalVariantId,
            catalogBarcode:
              prepared.catalogBarcode ||
              (
                isGlobalCatalogBarcode(
                  externalVariantId
                )
                  ? externalVariantId
                  : null
              ),
            centerGroupKey:
              prepared.group.key,
            idefixBatchRequestId:
              batchRequestId,
            finalStock,
            apiResult,
            lastCenterSyncAt:
              new Date()
                .toISOString(),
          }),
        ]
      );

    listingId =
      Number(
        updated.rows[0]
          .id
      );
  } else {
    const inserted =
      await client.query(
        `
          INSERT INTO public.online_listings (
            stock_device_id,
            channel,
            external_product_id,
            external_variant_id,
            external_stock_code,
            title,
            sale_price,
            list_price,
            quantity,
            sync_status,
            last_task_id,
            last_task_status,
            brand,
            model,
            memory,
            color,
            grade,
            warranty,
            raw_data,
            created_at,
            updated_at
          )
          VALUES (
            NULL,
            'IDEFIX',
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7,
            $8,
            $9,
            $10,
            $11,
            $12,
            $13,
            $14,
            $15,
            $16,
            $17::jsonb,
            now(),
            now()
          )
          RETURNING id
        `,
        [
          externalProductId,
          externalVariantId,
          externalStockCode,
          text(
            finalProduct?.title
          ) ||
            prepared.title,
          prepared.salePrice,
          prepared.listPrice,
          finalStock,
          syncStatus,
          batchRequestId,
          taskStatus,
          prepared.group.brand,
          prepared.group.model,
          prepared.group.memory,
          prepared.group.color,
          prepared.group.grade,
          prepared.group.warranty,
          JSON.stringify({
            centerManaged:
              true,
            centerImeis:
              imeis,
            idefixBarcode:
              externalVariantId,
            catalogBarcode:
              prepared.catalogBarcode ||
              (
                isGlobalCatalogBarcode(
                  externalVariantId
                )
                  ? externalVariantId
                  : null
              ),
            centerGroupKey:
              prepared.group.key,
            idefixBatchRequestId:
              batchRequestId,
            finalStock,
            createdFrom:
              "CENTER",
            apiResult,
            lastCenterSyncAt:
              new Date()
                .toISOString(),
          }),
        ]
      );

    listingId =
      Number(
        inserted.rows[0]
          .id
      );
  }

  for (
    const item of
      prepared.group.items
  ) {
    const exists =
      await client.query(
        `
          SELECT id
          FROM public.online_channel_devices
          WHERE channel = 'IDEFIX'
            AND stock_device_id = $1
          LIMIT 1
          FOR UPDATE
        `,
        [
          item.deviceId,
        ]
      );

    if (
      exists.rowCount
    ) {
      throw new Error(
        `${item.imei}: İdefix kanal üyeliği işlem sırasında oluşmuş.`
      );
    }

    await client.query(
      `
        INSERT INTO public.online_channel_devices (
          stock_device_id,
          imei,
          channel,
          online_listing_id,
          membership_status,
          channel_sale_price,
          channel_list_price,
          source_channel,
          source_listing_id,
          metadata,
          listed_at,
          created_at,
          updated_at
        )
        VALUES (
          $1,
          $2,
          'IDEFIX',
          $3,
          $4,
          $5,
          $6,
          'CENTER',
          NULL,
          $7::jsonb,
          CASE
            WHEN $4 = 'LISTED'
              THEN now()
            ELSE NULL
          END,
          now(),
          now()
        )
      `,
      [
        item.deviceId,
        item.imei,
        listingId,
        membershipStatus,
        prepared.salePrice,
        prepared.listPrice,
        JSON.stringify({
          source:
            "CENTER_IDEFIX_SEND",
          barcode:
            externalVariantId,
          vendorStockCode:
            externalStockCode,
          productMainId:
            externalProductId,
          batchRequestId,
          state:
            taskStatus,
          createdAt:
            new Date()
              .toISOString(),
        }),
      ]
    );
  }

  return {
    listingId,
    externalProductId,
    externalVariantId,
    externalStockCode,
  };
}

function isProductNotFoundError(
  error: unknown
) {
  const message =
    error instanceof Error
      ? error.message
      : String(error ?? "");

  return normalizeText(
    message
  ).includes(
    "PRODUCT NOT FOUND"
  );
}

async function persistPendingCatalog(
  client:
    PoolClient,
  prepared:
    PreparedGroup,
  reason:
    string
) {
  await client.query(
    "BEGIN"
  );

  try {
    const local =
      await persistLocal(
        client,
        {
          prepared,
          finalProduct:
            prepared
              .exactProduct,
          membershipStatus:
            "PENDING_CREATE",
          syncStatus:
            "CREATING",
          taskStatus:
            "WAITING_CATALOG",
          batchRequestId:
            null,
          finalStock:
            prepared
              .targetAfterStock,
          apiResult: {
            source:
              "IDEFIX_INVENTORY_PRODUCT_NOT_FOUND",
            reason,
            waitingCatalog:
              true,
            savedAt:
              new Date()
                .toISOString(),
          },
        }
      );

    await client.query(
      "COMMIT"
    );

    return local;
  } catch (error: any) {
    try {
      await client.query(
        "ROLLBACK"
      );
    } catch {}

    throw error;
  }
}

async function reconcilePendingIdefix(
  client:
    PoolClient
) {
  const pending =
    await client.query(
      `
        SELECT DISTINCT
          ol.id,
          ol.external_product_id,
          ol.external_variant_id,
          ol.external_stock_code,
          ol.title,
          ol.sale_price,
          ol.list_price,
          ol.quantity,
          ol.brand,
          ol.model,
          ol.memory,
          ol.color,
          ol.grade,
          ol.warranty
        FROM public.online_listings ol
        JOIN public.online_channel_devices ocd
          ON ocd.online_listing_id =
             ol.id
        WHERE ol.channel = 'IDEFIX'
          AND ocd.channel = 'IDEFIX'
          AND ocd.membership_status =
              'PENDING_CREATE'
        ORDER BY ol.id
        LIMIT 100
      `
    );

  if (
    pending.rowCount === 0
  ) {
    return {
      success:
        true,
      pending:
        0,
      completed:
        0,
      stillPending:
        0,
      failed:
        0,
      results: [],
    };
  }

  const results:
    any[] = [];

  for (
    const listing of
      pending.rows
  ) {
    const listingId =
      Number(
        listing.id
      );

    const barcode =
      text(
        listing
          .external_variant_id
      );

    if (!barcode) {
      results.push({
        listingId,
        state:
          "ERROR",
        error:
          "İdefix pending listing barkodu eksik.",
      });

      continue;
    }

    const stockResult =
      await client.query(
        `
          SELECT
            COUNT(*)::int AS count
          FROM public.online_channel_devices ocd
          JOIN public.stock_devices sd
            ON sd.id =
               ocd.stock_device_id
          WHERE ocd.channel = 'IDEFIX'
            AND ocd.online_listing_id = $1
            AND ocd.membership_status IN (
              'PENDING_CREATE',
              'LISTED',
              'RESERVED'
            )
            AND sd.status = 'AVAILABLE'
        `,
        [
          listingId,
        ]
      );

    const desiredStock =
      Math.max(
        0,
        Number(
          stockResult
            .rows?.[0]
            ?.count || 0
        )
      );

    const salePrice =
      numberOrNull(
        listing.sale_price
      );

    const listPrice =
      numberOrNull(
        listing.list_price
      );

    if (
      salePrice === null ||
      listPrice === null ||
      salePrice <= 0 ||
      listPrice <= 0
    ) {
      results.push({
        listingId,
        barcode,
        state:
          "ERROR",
        error:
          "Pending İdefix listing fiyatları geçersiz.",
      });

      continue;
    }

    const productLookup =
      await listByBarcode(
        barcode
      );

    const liveProduct =
      productLookup
        .products?.[0] ||
      null;

    const pseudoPrepared:
      PreparedGroup = {
        group: {
          key:
            [
              normalizeText(
                listing.brand
              ),
              normalizeText(
                listing.model
              ),
              normalizeMemory(
                listing.memory
              ),
              normalizeText(
                listing.color
              ),
              normalizeGrade(
                listing.grade
              ),
              normalizeText(
                listing.warranty
              ),
            ].join("|"),
          brand:
            text(
              listing.brand
            ),
          model:
            text(
              listing.model
            ),
          memory:
            text(
              listing.memory
            ),
          color:
            text(
              listing.color
            ),
          grade:
            normalizeGrade(
              listing.grade
            ),
          warranty:
            text(
              listing.warranty
            ),
          items: [],
        },
        action:
          "EXISTING_PRODUCT",
        exactProduct:
          liveProduct,
        referenceProduct:
          null,
        title:
          text(
            listing.title
          ) ||
          `${text(
            listing.brand
          )} ${text(
            listing.model
          )}`,
        salePrice,
        listPrice,
        targetBeforeStock:
          numberOrNull(
            liveProduct
              ?.inventoryQuantity
          ) ?? 0,
        targetAfterStock:
          desiredStock,
        barcode,
        catalogBarcode:
          null,
        vendorStockCode:
          text(
            listing
              .external_stock_code
          ),
        productMainId:
          text(
            listing
              .external_product_id
          ),
        brandId:
          liveProduct
            ?.brandId ??
          null,
        categoryId:
          liveProduct
            ?.categoryId ??
          null,
        vatRate:
          numberOrNull(
            liveProduct
              ?.vatRate
          ),
        imageUrl:
          Array.isArray(
            liveProduct
              ?.images
          )
            ? text(
                liveProduct
                  ?.images?.[0]
                  ?.url
              ) || null
            : null,
        attributes:
          Array.isArray(
            liveProduct
              ?.attributes
          )
            ? liveProduct!
                .attributes!
                .map(
                  (
                    attribute:
                      any
                  ) => ({
                    attributeId:
                      attribute
                        .attributeId,
                    attributeValueId:
                      attribute
                        .attributeValueId ??
                      null,
                    customAttributeValue:
                      text(
                        attribute
                          .customAttributeValue
                      ) || null,
                  })
                )
                .filter(
                  (
                    attribute:
                      any
                  ) =>
                    attribute
                      .attributeId !==
                      null &&
                    attribute
                      .attributeId !==
                      undefined
                )
            : [],
        blockers: [],
      };

    try {
      const upload =
        await inventoryUpload(
          pseudoPrepared
        );

      const verified =
        await waitInventory(
          upload
            .batchRequestId,
          barcode
        );

      if (
        !verified.success
      ) {
        results.push({
          listingId,
          barcode,
          state:
            "PENDING_CREATE",
          pending:
            true,
          message:
            "İdefix inventory sonucu henüz tamamlanmadı.",
          batchRequestId:
            upload
              .batchRequestId,
        });

        continue;
      }

      await client.query(
        "BEGIN"
      );

      try {
        await client.query(
          `
            UPDATE public.online_listings
            SET
              quantity = $2,
              sync_status = 'SYNCED',
              last_task_id = $3,
              last_task_status = 'SUCCESS',
              raw_data =
                COALESCE(
                  raw_data,
                  '{}'::jsonb
                )
                || $4::jsonb,
              updated_at = now()
            WHERE id = $1
          `,
          [
            listingId,
            desiredStock,
            upload
              .batchRequestId,
            JSON.stringify({
              idefixPendingResolved:
                true,
              finalStock:
                desiredStock,
              inventoryResult:
                verified.payload,
              resolvedAt:
                new Date()
                  .toISOString(),
            }),
          ]
        );

        await client.query(
          `
            UPDATE public.online_channel_devices
            SET
              membership_status = 'LISTED',
              listed_at =
                COALESCE(
                  listed_at,
                  now()
                ),
              metadata =
                COALESCE(
                  metadata,
                  '{}'::jsonb
                )
                || $2::jsonb,
              updated_at = now()
            WHERE channel = 'IDEFIX'
              AND online_listing_id = $1
              AND membership_status =
                  'PENDING_CREATE'
          `,
          [
            listingId,
            JSON.stringify({
              idefixPendingResolved:
                true,
              inventoryBatchRequestId:
                upload
                  .batchRequestId,
              resolvedAt:
                new Date()
                  .toISOString(),
            }),
          ]
        );

        await client.query(
          "COMMIT"
        );
      } catch (
        error: any
      ) {
        try {
          await client.query(
            "ROLLBACK"
          );
        } catch {}

        throw error;
      }

      results.push({
        listingId,
        barcode,
        state:
          "LISTED",
        pending:
          false,
        finalStock:
          desiredStock,
        batchRequestId:
          upload
            .batchRequestId,
      });
    } catch (
      error: any
    ) {
      if (
        isProductNotFoundError(
          error
        )
      ) {
        results.push({
          listingId,
          barcode,
          state:
            "PENDING_CREATE",
          pending:
            true,
          message:
            "İdefix katalog onayı bekleniyor.",
        });

        continue;
      }

      results.push({
        listingId,
        barcode,
        state:
          "ERROR",
        pending:
          false,
        error:
          error instanceof Error
            ? error.message
            : "İdefix pending kontrolü başarısız.",
      });
    }
  }

  return {
    success:
      true,
    pending:
      pending.rowCount,
    completed:
      results.filter(
        (row) =>
          row.state ===
          "LISTED"
      ).length,
    stillPending:
      results.filter(
        (row) =>
          row.state ===
          "PENDING_CREATE"
      ).length,
    failed:
      results.filter(
        (row) =>
          row.state ===
          "ERROR"
      ).length,
    results,
  };
}

async function processPrepared(
  client:
    PoolClient,
  prepared:
    PreparedGroup
) {
  if (
    prepared.blockers
      .length > 0
  ) {
    throw new Error(
      prepared.blockers.join(
        " | "
      )
    );
  }

  if (
    prepared.action ===
    "FAST_LISTING"
  ) {
    const upload =
      await fastListingUpload(
        prepared
      );

    const fastResult =
      await waitFastListingResult(
        upload
          .batchRequestId,
        prepared.barcode
      );

    if (
      !fastResult.success
    ) {
      const code =
        normalizeText(
          fastResult
            .failureCode
        );

      if (
        code.includes(
          "PRODUCT BARCODE NOT EXIST"
        )
      ) {
        throw new Error(
          `${prepared.title}: verdiğin barkod İdefix kataloğunda yok (PRODUCT_BARCODE_NOT_EXIST). Bu ürün fast-listing ile açılamaz; gerçekten yeni ürünse create gerekir.`
        );
      }

      if (
        code.includes(
          "PRODUCT POOL ALREADY EXIST"
        ) ||
        code.includes(
          "URUN LISTENIZDE MEVCUTTUR"
        ) ||
        code.includes(
          "BARKODLU URUN URUN LISTENIZDE MEVCUTTUR"
        ) ||
        (
          code.includes(
            "BARKODLU URUN"
          ) &&
          code.includes(
            "MEVCUTTUR"
          )
        )
      ) {
        const existing =
          await listByBarcode(
            prepared.barcode
          );

        const live =
          existing
            .products?.[0] ||
          null;

        if (!live) {
          throw new Error(
            `${prepared.title}: ürün İdefix havuzunda mevcut görünüyor fakat barkodla tekrar okunamadı.`
          );
        }

        if (
          !(await productLooksLikeCenterGroup(
            live,
            prepared.group,
            true
          ))
        ) {
          throw new Error(
            `${prepared.title}: girilen ${prepared.barcode} barkodu İdefix ürün listende mevcut fakat seçili cihazla eşleşmiyor. Barkodun İdefix'teki ürünü: "${text(
              live.title
            ) || "Başlık yok"}". Hiçbir stok/IMEI gönderilmedi.`
          );
        }

        const existingPrepared:
          PreparedGroup = {
            ...prepared,
            action:
              "EXISTING_PRODUCT",
            exactProduct:
              live,
            title:
              text(
                live.title
              ) ||
              prepared.title,
            targetBeforeStock:
              numberOrNull(
                live
                  .inventoryQuantity
              ) ?? 0,
            targetAfterStock:
              Math.max(
                numberOrNull(
                  live
                    .inventoryQuantity
                ) ?? 0,
                prepared
                  .targetAfterStock
              ),
            vendorStockCode:
              text(
                live
                  .vendorStockCode
              ) ||
              prepared
                .vendorStockCode,
            productMainId:
              text(
                live
                  .productMainId
              ) ||
              prepared
                .productMainId,
            brandId:
              live.brandId ??
              null,
            categoryId:
              live.categoryId ??
              null,
          };

        return processPrepared(
          client,
          existingPrepared
        );
      }

      throw new Error(
        `${prepared.title}: İdefix fast-listing başarısız. ${fastResult.failureCode || "Bilinmeyen hata"}. Cevap: ${idefixFailureDetail(
          fastResult.payload
        )}`
      );
    }

    const item =
      fastResult.item;

    const matched =
      item
        ?.matchedProduct;

    const poolState =
      normalizeText(
        item?.poolState
      );

    if (
      poolState ===
        "WAITING VENDOR APPROVE"
    ) {
      if (
        !matchedFastListingLooksSafe(
          matched,
          prepared
        )
      ) {
        throw new Error(
          `${prepared.title}: İdefix katalog eşleşmesi geldi fakat marka/model/hafıza güvenlik kontrolünden geçmedi. Otomatik onay verilmedi.`
        );
      }

      await approveProduct(
        prepared.barcode
      );
    }

    // Dokümana göre eşleşme 24 saat içinde onaylanırsa fast-listing'de
    // gönderilen ilk stok/fiyat bilgileri ile ürün envantere açılır.
    // Kısa süre sonra satıcı havuzundan tekrar okuyup yerel kaydı tamamla.
    let liveProduct:
      IdefixProduct | null =
        null;

    for (
      let attempt = 0;
      attempt < 6;
      attempt += 1
    ) {
      if (
        attempt > 0
      ) {
        await new Promise(
          (resolve) =>
            setTimeout(
              resolve,
              650
            )
        );
      }

      const lookup =
        await listByBarcode(
          prepared.barcode
        );

      if (
        lookup.products
          .length > 0
      ) {
        const candidate =
          lookup.products[0];

        if (
          isIdefixReadyForSale(
            candidate
          )
        ) {
          liveProduct =
            candidate;
          break;
        }
      }
    }

    // Fast listing tamamlandı + gerekiyorsa merchant approve başarılı.
    // Pool read gecikirse bile PENDING yerine LISTED yazmak yerine
    // doğrulama bekleyen kayıt bırakıyoruz; veri kaybetmiyoruz.
    const membershipStatus:
      "LISTED" |
      "PENDING_CREATE" =
        liveProduct
          ? "LISTED"
          : "PENDING_CREATE";

    await client.query(
      "BEGIN"
    );

    try {
      const local =
        await persistLocal(
          client,
          {
            prepared,
            finalProduct:
              liveProduct ||
              {
                barcode:
                  prepared.barcode,
                title:
                  prepared.title,
                productMainId:
                  prepared
                    .productMainId,
                vendorStockCode:
                  prepared
                    .vendorStockCode,
                inventoryQuantity:
                  prepared
                    .targetAfterStock,
              },
            membershipStatus,
            syncStatus:
              liveProduct
                ? "SYNCED"
                : "CREATING",
            taskStatus:
              liveProduct
                ? "SUCCESS"
                : "WAITING_POOL_READ",
            batchRequestId:
              upload
                .batchRequestId,
            finalStock:
              prepared
                .targetAfterStock,
            apiResult:
              fastResult.payload,
          }
        );

      await client.query(
        "COMMIT"
      );

      return {
        success:
          true,
        action:
          "FAST_LISTING",
        title:
          prepared.title,
        color:
          prepared
            .group.color,
        barcode:
          prepared.barcode,
        beforeStock:
          0,
        afterStock:
          prepared
            .targetAfterStock,
        addedImeis:
          liveProduct
            ? prepared
                .group.items.map(
                  (row) =>
                    row.imei
                )
            : [],
        pendingImeis:
          liveProduct
            ? []
            : prepared
                .group.items.map(
                  (row) =>
                    row.imei
                ),
        batchRequestId:
          upload
            .batchRequestId,
        listingId:
          local.listingId,
        state:
          liveProduct
            ? "LISTED"
            : "PENDING_CREATE",
        pendingApproval:
          !liveProduct,
        approved:
          poolState ===
          "WAITING VENDOR APPROVE",
        message:
          liveProduct
            ? "İdefix katalog ürünü fast-listing ile satışa açıldı."
            : "Fast-listing tamamlandı; İdefix havuzunun görünür olması bekleniyor.",
      };
    } catch (error: any) {
      try {
        await client.query(
          "ROLLBACK"
        );
      } catch {}

      throw error;
    }
  }

  if (
    prepared.action ===
    "EXISTING_PRODUCT"
  ) {
    try {
      let liveBeforeSend =
        prepared.exactProduct;

      let liveState =
        idefixProductState(
          liveBeforeSend
        );

      if (
        liveState ===
        "WAITING VENDOR APPROVE"
      ) {
        await approveProduct(
          prepared.barcode
        );

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

          const lookup =
            await listByBarcode(
              prepared.barcode
            );

          const candidate =
            lookup
              .products?.[0] ||
            null;

          if (candidate) {
            liveBeforeSend =
              candidate;
            liveState =
              idefixProductState(
                candidate
              );

            if (
              isIdefixReadyForSale(
                candidate
              )
            ) {
              break;
            }
          }
        }
      }

      if (
        !isIdefixReadyForSale(
          liveBeforeSend
        )
      ) {
        throw new Error(
          `${prepared.title}: ürün İdefix ürün listende mevcut fakat satışa hazır değil. Gerçek İdefix statüsü: ${liveState || "BILINMIYOR"}. Stok ve IMEI gönderilmedi. Önce İdefix ürün durumunu düzelt/onayla.`
        );
      }

      const upload =
        await inventoryUpload(
          {
            ...prepared,
            exactProduct:
              liveBeforeSend,
          }
        );

      const verification =
        await waitInventory(
          upload
            .batchRequestId,
          prepared.barcode
        );

      if (
        !verification.success
      ) {
        throw new Error(
          `${prepared.title}: İdefix stok/fiyat işlemi başlatıldı fakat süre içinde COMPLETED doğrulanamadı. Batch: ${upload.batchRequestId}`
        );
      }

      await client.query(
        "BEGIN"
      );

      try {
        const local =
          await persistLocal(
            client,
            {
              prepared,
              finalProduct:
                prepared
                  .exactProduct,
              membershipStatus:
                "LISTED",
              syncStatus:
                "SYNCED",
              taskStatus:
                "SUCCESS",
              batchRequestId:
                upload
                  .batchRequestId,
              finalStock:
                prepared
                  .targetAfterStock,
              apiResult:
                verification
                  .payload,
            }
          );

        await client.query(
          "COMMIT"
        );

        return {
          success:
            true,
          action:
            "EXISTING_PRODUCT",
          title:
            prepared.title,
          color:
            prepared
              .group.color,
          barcode:
            prepared.barcode,
          beforeStock:
            prepared
              .targetBeforeStock,
          afterStock:
            prepared
              .targetAfterStock,
          addedImeis:
            prepared
              .group.items.map(
                (item) =>
                  item.imei
              ),
          batchRequestId:
            upload
              .batchRequestId,
          listingId:
            local.listingId,
          state:
            "LISTED",
          pendingApproval:
            false,
        };
      } catch (
        error: any
      ) {
        try {
          await client.query(
            "ROLLBACK"
          );
        } catch {}

        throw new Error(
          `${prepared.title}: İdefix stok/fiyat başarılı oldu ancak PostgreSQL kanal kaydı yazılamadı. ${
            error instanceof Error
              ? error.message
              : ""
          }`
        );
      }
    } catch (
      error: any
    ) {
      if (
        isProductNotFoundError(
          error
        )
      ) {
        // Ürün pool/list içinde görünmüş ama catalog inventory henüz hazır değil.
        // Bu hata artık "başarısız gönderim" sayılmaz.
        // IMEI'yi PENDING_CREATE olarak kaydet, ikinci kez ürün açılmasını engelle.
        const local =
          await persistPendingCatalog(
            client,
            prepared,
            error instanceof Error
              ? error.message
              : "PRODUCT_NOT_FOUND"
          );

        return {
          success:
            true,
          action:
            "EXISTING_PRODUCT",
          title:
            prepared.title,
          color:
            prepared
              .group.color,
          barcode:
            prepared.barcode,
          beforeStock:
            prepared
              .targetBeforeStock,
          afterStock:
            prepared
              .targetAfterStock,
          addedImeis:
            prepared
              .group.items.map(
                (item) =>
                  item.imei
              ),
          batchRequestId:
            null,
          listingId:
            local.listingId,
          state:
            "PENDING_CREATE",
          pendingApproval:
            true,
          message:
            "Ürün İdefix'e gönderildi. Katalog onayı bekleniyor; stok/fiyat onay sonrası senkronlanacak.",
        };
      }

      throw error;
    }
  }

  const create =
    await createProduct(
      prepared
    );

  const createState =
    await waitCreateResult(
      create.batchRequestId,
      prepared.barcode
    );

  let state =
    createState.state;

  let finalBarcode =
    prepared.barcode;

  let approved =
    false;

  const matched =
    createState.product
      ?.matchedProduct;

  if (
    state ===
      "WAITING VENDOR APPROVE"
  ) {
    if (
      !matchedProductLooksSafe(
        matched,
        prepared.group
      )
    ) {
      throw new Error(
        `${prepared.title}: İdefix mevcut katalog ürünü önerdi fakat eşleşme otomatik onay için güvenli değil. Merchant onayı bekleniyor. Batch: ${create.batchRequestId}`
      );
    }

    await approveProduct(
      prepared.barcode
    );

    approved =
      true;

    const matchedBarcode =
      text(
        matched?.barcode
      );

    if (
      matchedBarcode
    ) {
      finalBarcode =
        matchedBarcode;
    }

    // Kısa bekleme sonrası mevcut havuzu tekrar kontrol et.
    await new Promise(
      (resolve) =>
        setTimeout(
          resolve,
          900
        )
    );

    state =
      "APPROVED";
  }

  if (
    [
      "MISSING INFO",
      "PLATFORM DECLINED",
    ].includes(state)
  ) {
    throw new Error(
      `${prepared.title}: İdefix create reddedildi/eksik bilgi. ${JSON.stringify(
        createState.product
          ?.failureReasons ||
        null
      )}`
    );
  }

  // Satıcı havuzunda oluştu mu kontrol et.
  let listedProduct:
    IdefixProduct | null =
      null;

  const lookupCandidates =
    Array.from(
      new Set([
        finalBarcode,
        prepared.barcode,
      ])
    ).filter(Boolean);

  for (
    const barcode of
      lookupCandidates
  ) {
    const listed =
      await listByBarcode(
        barcode
      );

    if (
      listed.products
        .length > 0
    ) {
      listedProduct =
        listed.products[0];

      finalBarcode =
        text(
          listedProduct
            .barcode
        ) ||
        barcode;

      break;
    }
  }

  const pendingStates = [
    "NOT MATCHED",
    "WAITING CATALOG ACTION",
    "AUTO MATCHED",
    "MANUAL MATCHED",
    "",
  ];

  if (
    !listedProduct &&
    pendingStates.includes(
      state
    )
  ) {
    // İdefix operatör incelemesi gereken yeni ürün.
    // API create kabul edildiği için yerelde PENDING_CREATE olarak işaretle.
    await client.query(
      "BEGIN"
    );

    try {
      const local =
        await persistLocal(
          client,
          {
            prepared,
            finalProduct:
              null,
            membershipStatus:
              "PENDING_CREATE",
            syncStatus:
              "CREATING",
            taskStatus:
              state ||
              "PENDING",
            batchRequestId:
              create
                .batchRequestId,
            finalStock:
              prepared
                .targetAfterStock,
            apiResult:
              createState
                .payload,
          }
        );

      await client.query(
        "COMMIT"
      );

      return {
        success:
          true,
        action:
          "CREATE_PRODUCT",
        title:
          prepared.title,
        color:
          prepared
            .group.color,
        barcode:
          prepared.barcode,
        beforeStock:
          0,
        afterStock:
          prepared
            .targetAfterStock,
        addedImeis:
          prepared
            .group.items.map(
              (item) =>
                item.imei
            ),
        batchRequestId:
          create
            .batchRequestId,
        listingId:
          local.listingId,
        state:
          state ||
          "PENDING_CREATE",
        pendingApproval:
          true,
        approved,
      };
    } catch (error: any) {
      try {
        await client.query(
          "ROLLBACK"
        );
      } catch {}

      throw new Error(
        `${prepared.title}: İdefix create kabul edildi ancak PostgreSQL PENDING_CREATE kaydı yazılamadı. ${
          error instanceof Error
            ? error.message
            : ""
        }`
      );
    }
  }

  if (
    !listedProduct
  ) {
    throw new Error(
      `${prepared.title}: İdefix create/approve sonrası ürün satıcı havuzunda doğrulanamadı. Batch: ${create.batchRequestId}`
    );
  }

  // Create/approve sonrası kesin barkoda stok ve fiyatı yaz.
  const finalPrepared:
    PreparedGroup = {
      ...prepared,
      exactProduct:
        listedProduct,
      barcode:
        finalBarcode,
      targetBeforeStock:
        numberOrNull(
          listedProduct
            .inventoryQuantity
        ) ?? 0,
      targetAfterStock:
        Math.max(
          prepared
            .targetAfterStock,
          numberOrNull(
            listedProduct
              .inventoryQuantity
          ) ?? 0
        ),
  };

  let upload:
    {
      payload: any;
      batchRequestId: string;
    };

  let inventoryVerified:
    {
      success: boolean;
      payload: any;
      item: any;
    };

  try {
    upload =
      await inventoryUpload(
        finalPrepared
      );

    inventoryVerified =
      await waitInventory(
        upload.batchRequestId,
        finalBarcode
      );

    if (
      !inventoryVerified.success
    ) {
      throw new Error(
        `${prepared.title}: ürün oluşturuldu fakat stok/fiyat COMPLETED doğrulanamadı. Inventory batch: ${upload.batchRequestId}`
      );
    }
  } catch (error: any) {
    if (
      isProductNotFoundError(
        error
      )
    ) {
      // Yeni ürün pool/list içinde görünmüş olabilir ama katalog inventory
      // tarafında henüz satışa hazır değildir. Bu durumda gönderimi hata
      // sayma; IMEI'yi PENDING_CREATE kaydet ve tekrar ürün create etme.
      await client.query(
        "BEGIN"
      );

      try {
        const local =
          await persistLocal(
            client,
            {
              prepared:
                finalPrepared,
              finalProduct:
                listedProduct,
              membershipStatus:
                "PENDING_CREATE",
              syncStatus:
                "CREATING",
              taskStatus:
                "WAITING_CATALOG",
              batchRequestId:
                create
                  .batchRequestId,
              finalStock:
                finalPrepared
                  .targetAfterStock,
              apiResult: {
                create:
                  createState
                    .payload,
                inventoryError:
                  error instanceof Error
                    ? error.message
                    : "PRODUCT_NOT_FOUND",
                waitingCatalog:
                  true,
                savedAt:
                  new Date()
                    .toISOString(),
              },
            }
          );

        await client.query(
          "COMMIT"
        );

        return {
          success:
            true,
          action:
            "CREATE_PRODUCT",
          title:
            prepared.title,
          color:
            prepared
              .group.color,
          barcode:
            finalBarcode,
          beforeStock:
            finalPrepared
              .targetBeforeStock,
          afterStock:
            finalPrepared
              .targetAfterStock,
          addedImeis:
            prepared
              .group.items.map(
                (item) =>
                  item.imei
              ),
          batchRequestId:
            create
              .batchRequestId,
          listingId:
            local.listingId,
          state:
            "PENDING_CREATE",
          pendingApproval:
            true,
          approved,
          message:
            "Ürün İdefix'e gönderildi. Katalog onayı bekleniyor; stok/fiyat onay sonrası senkronlanacak.",
        };
      } catch (
        persistError
      ) {
        try {
          await client.query(
            "ROLLBACK"
          );
        } catch {}

        throw new Error(
          `${prepared.title}: ürün İdefix'e gönderildi ancak PENDING_CREATE kaydı yazılamadı. ${
            persistError instanceof Error
              ? persistError.message
              : ""
          }`
        );
      }
    }

    throw error;
  }

  await client.query(
    "BEGIN"
  );

  try {
    const local =
      await persistLocal(
        client,
        {
          prepared:
            finalPrepared,
          finalProduct:
            listedProduct,
          membershipStatus:
            "LISTED",
          syncStatus:
            "SYNCED",
          taskStatus:
            "SUCCESS",
          batchRequestId:
            create
              .batchRequestId,
          finalStock:
            finalPrepared
              .targetAfterStock,
          apiResult: {
            create:
              createState
                .payload,
            inventory:
              inventoryVerified
                .payload,
          },
        }
      );

    await client.query(
      "COMMIT"
    );

    return {
      success:
        true,
      action:
        "CREATE_PRODUCT",
      title:
        prepared.title,
      color:
        prepared.group.color,
      barcode:
        finalBarcode,
      beforeStock:
        finalPrepared
          .targetBeforeStock,
      afterStock:
        finalPrepared
          .targetAfterStock,
      addedImeis:
        prepared
          .group.items.map(
            (item) =>
              item.imei
          ),
      batchRequestId:
        create
          .batchRequestId,
      inventoryBatchRequestId:
        upload
          .batchRequestId,
      listingId:
        local.listingId,
      state:
        "LISTED",
      pendingApproval:
        false,
      approved,
    };
  } catch (error: any) {
    try {
      await client.query(
        "ROLLBACK"
      );
    } catch {}

    throw new Error(
      `${prepared.title}: İdefix dış işlemler başarılı oldu ancak PostgreSQL kanal kaydı yazılamadı. ${
        error instanceof Error
          ? error.message
          : ""
      }`
    );
  }
}

export async function POST(
  request:
    NextRequest
) {
  let client:
    PoolClient | null =
      null;

  try {
    const authError =
      await requireIdefixSuperAdmin(
        request
      );

    if (authError) {
      return authError;
    }

    if (
      !validateOrigin(
        request
      )
    ) {
      return noStoreJson(
        {
          success:
            false,
          error:
            "Geçersiz istek kaynağı.",
        },
        403
      );
    }

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
      Array.isArray(body)
    ) {
      return noStoreJson(
        {
          success:
            false,
          error:
            "Geçersiz istek.",
        },
        400
      );
    }

    const data =
      body as Record<
        string,
        unknown
      >;

    const modeRaw =
      text(
        data.mode ||
        "preview"
      ).toLowerCase();

    if (
      modeRaw !==
        "preview" &&
      modeRaw !==
        "commit" &&
      modeRaw !==
        "reconcile"
    ) {
      return noStoreJson(
        {
          success:
            false,
          error:
            "mode yalnızca preview, commit veya reconcile olabilir.",
        },
        400
      );
    }

    const mode =
      modeRaw as
        SendMode;

    // Reconcile modunda cihaz/fiyat bilgisi gerekmez.
    // Önce DB bağlantısını aç ve pending İdefix kayıtlarını kontrol et.
    if (
      mode ===
      "reconcile"
    ) {
      client =
        await getIdefixDbPool()
          .connect();

      const result =
        await reconcilePendingIdefix(
          client
        );

      return noStoreJson({
        channel:
          "IDEFIX",
        mode:
          "reconcile",
        ...result,
      });
    }

    if (
      !Array.isArray(
        data.deviceIds
      )
    ) {
      return noStoreJson(
        {
          success:
            false,
          error:
            "deviceIds bulunamadı.",
        },
        400
      );
    }

    const deviceIds =
      Array.from(
        new Set(
          data.deviceIds
            .map(
              (value) =>
                Number(value)
            )
            .filter(
              (value) =>
                Number.isInteger(
                  value
                ) &&
                value > 0
            )
        )
      );

    if (
      deviceIds.length ===
      0
    ) {
      return noStoreJson(
        {
          success:
            false,
          error:
            "En az 1 cihaz seç.",
        },
        400
      );
    }

    const salePrice =
      money(
        data.salePrice,
        "Satış fiyatı"
      );

    const listPrice =
      money(
        data.listPrice,
        "Liste fiyatı"
      );

    if (
      listPrice <
      salePrice
    ) {
      return noStoreJson(
        {
          success:
            false,
          error:
            "Liste fiyatı satış fiyatından düşük olamaz.",
        },
        400
      );
    }

    const catalogBarcode =
      text(
        data.catalogBarcode
      ) || null;

    client =
      await getIdefixDbPool()
        .connect();

    const rows =
      await selectedDevices(
        client,
        deviceIds
      );

    const deviceErrors =
      await validateDevices(
        client,
        deviceIds,
        rows
      );

    if (
      deviceErrors.length >
      0
    ) {
      return noStoreJson(
        {
          success:
            false,
          mode,
          error:
            "İdefix gönderimi ön kontrolde durduruldu.",
          errors:
            deviceErrors,
        },
        409
      );
    }

    const groups =
      buildGroups(rows);

    if (
      catalogBarcode &&
      groups.length !== 1
    ) {
      return noStoreJson(
        {
          success:
            false,
          mode,
          error:
            "İdefix katalog barkodu ile hızlı gönderimde aynı anda tek ürün grubu seçilebilir. Aynı model/hafıza/renk/kalitedeki IMEI'leri birlikte seçebilirsin.",
        },
        400
      );
    }

    const products =
      await fetchAllProducts();

    const prepared:
      PreparedGroup[] = [];

    for (
      const group of groups
    ) {
      prepared.push(
        await prepareGroup(
          client,
          products,
          group,
          salePrice,
          listPrice,
          catalogBarcode
        )
      );
    }

    const preview =
      prepared.map(
        previewView
      );

    const blockers =
      preview.flatMap(
        (row) =>
          row.blockers
      );

    if (
      mode ===
      "preview"
    ) {
      return noStoreJson({
        success:
          true,
        mode:
          "preview",
        channel:
          "IDEFIX",
        canCommit:
          blockers.length ===
          0,
        totalDevices:
          deviceIds.length,
        totalGroups:
          groups.length,
        existingGroups:
          prepared.filter(
            (row) =>
              row.action ===
              "EXISTING_PRODUCT"
          ).length,
        fastListingGroups:
          prepared.filter(
            (row) =>
              row.action ===
              "FAST_LISTING"
          ).length,
        createGroups:
          prepared.filter(
            (row) =>
              row.action ===
              "CREATE_PRODUCT"
          ).length,
        preview,
        safety: {
          databaseWrite:
            false,
          idefixWrite:
            false,
          n11Write:
            false,
          ikasWrite:
            false,
        },
      });
    }

    if (
      blockers.length >
      0
    ) {
      return noStoreJson(
        {
          success:
            false,
          mode:
            "commit",
          channel:
            "IDEFIX",
          error:
            "İdefix gerçek gönderimi engellendi. Önce aşağıdaki eksikleri çöz.",
          blockers,
          preview,
        },
        409
      );
    }

    // Aynı anda iki Merkez -> İdefix gönderimi olmasın.
    await client.query(
      `
        SELECT
          pg_advisory_lock(
            hashtext(
              'cnet_center_idefix_send'
            )
          )
      `
    );

    let lockHeld =
      true;

    try {
      // Kilit alındıktan sonra IMEI üyeliklerini tekrar kontrol.
      const recheck =
        await validateDevices(
          client,
          deviceIds,
          await selectedDevices(
            client,
            deviceIds
          )
        );

      if (
        recheck.length >
        0
      ) {
        return noStoreJson(
          {
            success:
              false,
            mode:
              "commit",
            channel:
              "IDEFIX",
            error:
              "İdefix gönderimi kilit sonrası durduruldu.",
            errors:
              recheck,
          },
          409
        );
      }

      const results:
        any[] = [];

      for (
        const item of
          prepared
      ) {
        results.push(
          await processPrepared(
            client,
            item
          )
        );
      }

      return noStoreJson({
        success:
          true,
        mode:
          "commit",
        channel:
          "IDEFIX",
        message:
          `${deviceIds.length} cihaz için İdefix işlemi tamamlandı.`,
        sentImeis:
          results.reduce(
            (
              sum,
              result
            ) =>
              sum +
              (
                Array.isArray(
                  result
                    ?.addedImeis
                )
                  ? result
                      .addedImeis
                      .length
                  : 0
              ),
            0
          ),
        results,
      });
    } finally {
      if (lockHeld) {
        try {
          await client.query(
            `
              SELECT
                pg_advisory_unlock(
                  hashtext(
                    'cnet_center_idefix_send'
                  )
                )
            `
          );
        } catch {}

        lockHeld =
          false;
      }
    }
  } catch (error: any) {
    console.error(
      "CENTER IDEFIX SEND ERROR:",
      error
    );

    return noStoreJson(
      {
        success:
          false,
        channel:
          "IDEFIX",
        error:
          error instanceof Error
            ? error.message
            : "İdefix gerçek gönderimi başarısız.",
      },
      500
    );
  } finally {
    client?.release();
  }
}
