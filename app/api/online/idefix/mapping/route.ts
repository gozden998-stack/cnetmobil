// app/api/online/idefix/mapping/route.ts
// CNETMOBIL - IDEFIX ADIM 2C
//
// READ ONLY.
// Merkez fiziksel IMEI gruplarını mevcut İdefix ürünleriyle güvenli şekilde eşleştirir.
// Renk alias desteği ile Türkçe/İngilizce renk adlarını güvenli şekilde eşleştirir.
// Örn: Kırmızı = Red / Product Red. Eşleşmeyenlerde yakın adayları göstermeye devam eder.
//
// BU ROUTE:
// - İdefix'e ürün göndermez.
// - İdefix stok/fiyat değiştirmez.
// - PostgreSQL'e yazmaz.
// - N11 / İkas kodlarına dokunmaz.
// - Belirsiz eşleşmede otomatik karar vermez.
//
// Eşleştirme anahtarı:
// Marka + Model + Hafıza + Renk + Grade
//
// Garanti, mevcut İdefix başlıklarında her zaman görünmeyebileceği için
// tek başına eşleştirme şartı değildir; fakat aynı İdefix barkoduna
// birden fazla farklı Merkez grubu düşerse COLLISION olarak durdurulur.

import { NextRequest } from "next/server";

import {
  getIdefixDbPool,
  getIdefixProducts,
  noStoreJson,
  requireIdefixSuperAdmin,
} from "../../../../lib/idefix/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type CenterDeviceRow = {
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

type CenterGroup = {
  key: string;
  brand: string;
  model: string;
  memory: string;
  color: string;
  grade: string;
  warranty: string;
  colorAliases: string[];
  physicalStock: number;
  deviceIds: number[];
  imeis: string[];
};

type IdefixProduct = {
  barcode?: string | null;
  title?: string | null;
  productMainId?: string | null;
  brandId?: number | string | null;
  categoryId?: number | string | null;
  inventoryQuantity?: number | string | null;
  vendorStockCode?: string | null;
  price?: number | string | null;
  comparePrice?: number | string | null;
  status?: string | null;
  state?: string | null;
  reference?: number | string | null;
  failureReasons?: unknown;
  [key: string]: unknown;
};

type MatchCandidate = {
  product: IdefixProduct;
  score: number;
  normalizedTitle: string;
};

type MappingRow = {
  centerKey: string;
  brand: string;
  model: string;
  memory: string;
  color: string;
  grade: string;
  warranty: string;
  physicalStock: number;
  deviceIds: number[];
  imeis: string[];
  matchStatus:
    | "MATCHED"
    | "UNMATCHED"
    | "AMBIGUOUS"
    | "COLLISION";
  reason: string;
  idefix: null | {
    barcode: string;
    title: string;
    productMainId: string;
    vendorStockCode: string;
    brandId: number | string | null;
    categoryId: number | string | null;
    currentStock: number;
    price: number | null;
    comparePrice: number | null;
    status: string | null;
    state: string | null;
    reference: number | string | null;
  };
  stockDifference: number | null;
  candidates: Array<{
    barcode: string;
    title: string;
    productMainId: string;
    vendorStockCode: string;
    currentStock: number;
    score: number;
    checks?: {
      brand: boolean;
      model: boolean;
      memory: boolean;
      modelMemory: boolean;
      color: boolean;
      matchedColorAlias: string | null;
      grade: boolean;
      detectedGrade: string | null;
      renewed: boolean;
    };
  }>;
};

function text(value: unknown) {
  return String(value ?? "").trim();
}

function numberOrNull(value: unknown) {
  if (
    value === null ||
    value === undefined ||
    text(value) === ""
  ) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed)
    ? parsed
    : null;
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

function normalizeMemory(value: unknown) {
  return normalizeText(value).replace(
    /(\d+(?:[.,]\d+)?)\s*(GB|TB)\b/g,
    "$1 $2"
  );
}

function normalizeGrade(value: unknown) {
  const normalized = normalizeText(value);

  if (
    normalized === "A" ||
    normalized === "A KALITE" ||
    normalized.includes("MUKEMMEL")
  ) {
    return "A";
  }

  if (
    normalized === "B" ||
    normalized === "B KALITE" ||
    normalized.includes("COK IYI")
  ) {
    return "B";
  }

  if (
    normalized === "C" ||
    normalized === "C KALITE" ||
    normalized === "IYI"
  ) {
    return "C";
  }

  return normalized;
}

function getColorAliases(
  value: unknown
) {
  const color =
    normalizeText(value);

  const aliases =
    new Set<string>();

  const add = (
    ...values: string[]
  ) => {
    for (
      const item of values
    ) {
      const normalized =
        normalizeText(item);

      if (normalized) {
        aliases.add(
          normalized
        );
      }
    }
  };

  add(color);

  const aliasGroups: string[][] = [
    [
      "KIRMIZI",
      "RED",
      "PRODUCT RED",
    ],
    [
      "SIYAH",
      "BLACK",
    ],
    [
      "BEYAZ",
      "WHITE",
    ],
    [
      "MAVI",
      "BLUE",
    ],
    [
      "YESIL",
      "GREEN",
    ],
    [
      "SARI",
      "YELLOW",
    ],
    [
      "MOR",
      "PURPLE",
    ],
    [
      "PEMBE",
      "PINK",
    ],
    [
      "GUMUS",
      "SILVER",
    ],
    [
      "GRAFIT",
      "GRAPHITE",
    ],
    [
      "ALTIN",
      "GOLD",
    ],
    [
      "TITANYUM",
      "TITANIUM",
    ],
    [
      "DOGAL TITANYUM",
      "NATURAL TITANIUM",
    ],
    [
      "MAVI TITANYUM",
      "BLUE TITANIUM",
    ],
    [
      "BEYAZ TITANYUM",
      "WHITE TITANIUM",
    ],
    [
      "SIYAH TITANYUM",
      "BLACK TITANIUM",
    ],
  ];

  for (
    const group of
      aliasGroups
  ) {
    const normalizedGroup =
      group.map(
        normalizeText
      );

    if (
      normalizedGroup.includes(
        color
      )
    ) {
      add(...group);
    }
  }

  return Array.from(
    aliases
  );
}

function findMatchedColorAlias(
  normalizedTitle: string,
  color: unknown
) {
  const aliases =
    getColorAliases(
      color
    );

  return (
    aliases.find(
      (alias) =>
        containsPhrase(
          normalizedTitle,
          alias
        )
    ) || null
  );
}

function detectGradeFromTitle(
  normalizedTitle: string
): string | null {
  // Önce B kontrol edilir; "Çok İyi" içinde "İyi" de geçtiği için
  // yanlışlıkla C kaliteye düşmemeli.
  if (
    containsPhrase(
      normalizedTitle,
      "B KALITE"
    ) ||
    containsPhrase(
      normalizedTitle,
      "COK IYI"
    )
  ) {
    return "B";
  }

  if (
    containsPhrase(
      normalizedTitle,
      "A KALITE"
    ) ||
    containsPhrase(
      normalizedTitle,
      "MUKEMMEL"
    )
  ) {
    return "A";
  }

  if (
    containsPhrase(
      normalizedTitle,
      "C KALITE"
    ) ||
    containsPhrase(
      normalizedTitle,
      "IYI"
    )
  ) {
    return "C";
  }

  return null;
}

function containsPhrase(
  haystack: string,
  needle: string
) {
  const cleanHaystack =
    ` ${normalizeText(haystack)} `;
  const cleanNeedle =
    ` ${normalizeText(needle)} `;

  if (
    !normalizeText(needle)
  ) {
    return false;
  }

  return cleanHaystack.includes(
    cleanNeedle
  );
}

function makeCenterGroupKey(
  row: CenterDeviceRow
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

function buildCenterGroups(
  rows: CenterDeviceRow[]
): CenterGroup[] {
  const groups =
    new Map<string, CenterGroup>();

  for (
    const row of rows
  ) {
    const key =
      makeCenterGroupKey(row);

    if (
      !groups.has(key)
    ) {
      groups.set(
        key,
        {
          key,
          brand:
            text(row.brand) || "-",
          model:
            text(row.model) || "-",
          memory:
            text(row.memory) || "-",
          color:
            text(row.color) || "-",
          grade:
            normalizeGrade(
              row.grade
            ) || "-",
          warranty:
            text(row.warranty) || "-",
          physicalStock: 0,
          deviceIds: [],
          imeis: [],
        }
      );
    }

    const group =
      groups.get(key)!;

    group.physicalStock += 1;
    group.deviceIds.push(
      Number(row.id)
    );

    const imei =
      text(row.imei);

    if (imei) {
      group.imeis.push(
        imei
      );
    }
  }

  return Array.from(
    groups.values()
  ).sort(
    (a, b) =>
      b.physicalStock -
        a.physicalStock ||
      `${a.brand} ${a.model} ${a.memory} ${a.color}`
        .localeCompare(
          `${b.brand} ${b.model} ${b.memory} ${b.color}`,
          "tr"
        )
  );
}

function idefixProductKey(
  product: IdefixProduct
) {
  const barcode =
    text(product.barcode);

  if (barcode) {
    return `BARCODE:${barcode}`;
  }

  return [
    "FALLBACK",
    text(product.productMainId),
    text(product.vendorStockCode),
    normalizeText(
      product.title
    ),
  ].join("|");
}

async function fetchAllIdefixProducts() {
  const all:
    IdefixProduct[] = [];

  const seenProducts =
    new Set<string>();

  const seenPages =
    new Set<string>();

  const limit = 50;

  for (
    let page = 1;
    page <= 100;
    page += 1
  ) {
    const payload =
      await getIdefixProducts(
        page,
        limit
      );

    const rows =
      Array.isArray(
        (payload as any)
          ?.products
      )
        ? (
            payload as any
          ).products as
            IdefixProduct[]
        : [];

    if (
      rows.length === 0
    ) {
      break;
    }

    const pageSignature =
      rows
        .map(
          idefixProductKey
        )
        .join("||");

    // API sayfayı tekrar etmeye başlarsa sonsuz döngüye girme.
    if (
      seenPages.has(
        pageSignature
      )
    ) {
      break;
    }

    seenPages.add(
      pageSignature
    );

    for (
      const product of rows
    ) {
      const key =
        idefixProductKey(
          product
        );

      if (
        seenProducts.has(key)
      ) {
        continue;
      }

      seenProducts.add(key);
      all.push(product);
    }

    if (
      rows.length < limit
    ) {
      break;
    }
  }

  return all;
}

function getDiagnosticChecks(
  group: CenterGroup,
  product: IdefixProduct
) {
  const title =
    normalizeText(
      product.title
    );

  const brand =
    normalizeText(
      group.brand
    );

  const model =
    normalizeText(
      group.model
    );

  const memory =
    normalizeMemory(
      group.memory
    );

  const color =
    normalizeText(
      group.color
    );

  const matchedColorAlias =
    findMatchedColorAlias(
      title,
      group.color
    );

  const grade =
    normalizeGrade(
      group.grade
    );

  const detectedGrade =
    detectGradeFromTitle(
      title
    );

  return {
    title,
    checks: {
      brand:
        Boolean(brand) &&
        containsPhrase(
          title,
          brand
        ),

      model:
        Boolean(model) &&
        containsPhrase(
          title,
          model
        ),

      memory:
        Boolean(memory) &&
        containsPhrase(
          title,
          memory
        ),

      modelMemory:
        Boolean(
          model &&
          memory
        ) &&
        containsPhrase(
          title,
          `${model} ${memory}`
        ),

      color:
        Boolean(color) &&
        Boolean(
          matchedColorAlias
        ),

      matchedColorAlias,

      grade:
        Boolean(
          grade &&
          detectedGrade
        ) &&
        detectedGrade ===
          grade,

      detectedGrade,

      renewed:
        containsPhrase(
          title,
          "YENILENMIS"
        ),
    },
  };
}

function rankNearCandidates(
  group: CenterGroup,
  products:
    IdefixProduct[]
) {
  return products
    .map(
      (product) => {
        const {
          title,
          checks,
        } =
          getDiagnosticChecks(
            group,
            product
          );

        if (!title) {
          return null;
        }

        let score = 0;

        if (checks.brand) {
          score += 35;
        }

        if (checks.model) {
          score += 35;
        }

        if (checks.memory) {
          score += 20;
        }

        if (
          checks.modelMemory
        ) {
          score += 20;
        }

        if (checks.color) {
          score += 20;
        }

        if (checks.grade) {
          score += 20;
        } else if (
          checks.detectedGrade
        ) {
          score -= 10;
        }

        if (
          checks.renewed
        ) {
          score += 5;
        }

        // En az marka veya model benzerliği yoksa
        // alakasız ürünü "yakın aday" olarak göstermeyelim.
        if (
          !checks.brand &&
          !checks.model
        ) {
          return null;
        }

        return {
          product,
          score,
          normalizedTitle:
            title,
          checks,
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
          a.score ||
        String(
          a.product?.title ||
            ""
        ).localeCompare(
          String(
            b.product?.title ||
              ""
          ),
          "tr"
        )
    )
    .slice(0, 5);
}

function candidateForGroup(
  group: CenterGroup,
  product: IdefixProduct
): MatchCandidate | null {
  const title =
    normalizeText(
      product.title
    );

  if (!title) {
    return null;
  }

  const brand =
    normalizeText(
      group.brand
    );

  const model =
    normalizeText(
      group.model
    );

  const memory =
    normalizeMemory(
      group.memory
    );

  const color =
    normalizeText(
      group.color
    );

  const matchedColorAlias =
    findMatchedColorAlias(
      title,
      group.color
    );

  const grade =
    normalizeGrade(
      group.grade
    );

  if (
    !brand ||
    !model ||
    !memory ||
    !color ||
    !grade
  ) {
    return null;
  }

  // Marka yanlışsa kesinlikle bağlama.
  if (
    !containsPhrase(
      title,
      brand
    )
  ) {
    return null;
  }

  // Model + hafıza ardışık olmalı.
  // Örnek:
  // iPhone 13 128 GB, yanlışlıkla iPhone 13 Pro 128 GB'ye bağlanmasın.
  const modelMemory =
    `${model} ${memory}`;

  if (
    !containsPhrase(
      title,
      modelMemory
    )
  ) {
    return null;
  }

  // İdefix'te renk varyantı ayrı barkod/ürün satırı olduğu için
  // renk doğrulanmadan otomatik eşleştirme yapılmaz.
  if (
    !matchedColorAlias
  ) {
    return null;
  }

  // Yenilenmiş cihazda kalite kritik.
  // Başlıkta kalite doğrulanamıyorsa güvenli tarafta kal ve eşleştirme yapma.
  const titleGrade =
    detectGradeFromTitle(
      title
    );

  if (
    !titleGrade ||
    titleGrade !== grade
  ) {
    return null;
  }

  let score = 100;

  if (
    containsPhrase(
      title,
      "YENILENMIS"
    )
  ) {
    score += 10;
  }

  const warranty =
    normalizeText(
      group.warranty
    );

  if (
    warranty &&
    containsPhrase(
      title,
      warranty
    )
  ) {
    score += 5;
  }

  const status =
    normalizeText(
      product.status ||
        product.state
    );

  if (
    status &&
    ![
      "REJECTED",
      "REJECT",
      "FAILED",
      "ERROR",
    ].includes(status)
  ) {
    score += 2;
  }

  return {
    product,
    score,
    normalizedTitle:
      title,
  };
}

function toCandidateView(
  candidate: any
) {
  const diagnostic =
    candidate?.checks ||
    null;

  return {
    barcode:
      text(
        candidate.product
          .barcode
      ),
    title:
      text(
        candidate.product
          .title
      ),
    productMainId:
      text(
        candidate.product
          .productMainId
      ),
    vendorStockCode:
      text(
        candidate.product
          .vendorStockCode
      ),
    currentStock:
      numberOrNull(
        candidate.product
          .inventoryQuantity
      ) ?? 0,
    score:
      candidate.score,
    ...(diagnostic
      ? {
          checks: {
            brand:
              Boolean(
                diagnostic.brand
              ),
            model:
              Boolean(
                diagnostic.model
              ),
            memory:
              Boolean(
                diagnostic.memory
              ),
            modelMemory:
              Boolean(
                diagnostic
                  .modelMemory
              ),
            color:
              Boolean(
                diagnostic.color
              ),
            matchedColorAlias:
              diagnostic
                .matchedColorAlias ||
              null,
            grade:
              Boolean(
                diagnostic.grade
              ),
            detectedGrade:
              diagnostic
                .detectedGrade ||
              null,
            renewed:
              Boolean(
                diagnostic.renewed
              ),
          },
        }
      : {}),
  };
}

function toMatchedIdefix(
  product: IdefixProduct
) {
  return {
    barcode:
      text(product.barcode),
    title:
      text(product.title),
    productMainId:
      text(
        product.productMainId
      ),
    vendorStockCode:
      text(
        product.vendorStockCode
      ),
    brandId:
      product.brandId ??
      null,
    categoryId:
      product.categoryId ??
      null,
    currentStock:
      numberOrNull(
        product
          .inventoryQuantity
      ) ?? 0,
    price:
      numberOrNull(
        product.price
      ),
    comparePrice:
      numberOrNull(
        product.comparePrice
      ),
    status:
      text(
        product.status
      ) || null,
    state:
      text(
        product.state
      ) || null,
    reference:
      product.reference ??
      null,
  };
}

function mapCenterGroup(
  group: CenterGroup,
  products:
    IdefixProduct[]
): MappingRow {
  const candidates =
    products
      .map(
        (product) =>
          candidateForGroup(
            group,
            product
          )
      )
      .filter(
        (
          item
        ): item is
          MatchCandidate =>
          item !== null
      )
      .sort(
        (a, b) =>
          b.score -
          a.score
      );

  if (
    candidates.length === 0
  ) {
    return {
      centerKey:
        group.key,
      brand:
        group.brand,
      model:
        group.model,
      memory:
        group.memory,
      color:
        group.color,
      grade:
        group.grade,
      warranty:
        group.warranty,
      colorAliases:
        getColorAliases(
          group.color
        ),
      physicalStock:
        group.physicalStock,
      deviceIds:
        group.deviceIds,
      imeis:
        group.imeis,
      matchStatus:
        "UNMATCHED",
      reason:
        "Marka + model + hafıza + renk + kalite ile güvenli İdefix eşleşmesi bulunamadı.",
      idefix:
        null,
      stockDifference:
        null,
      candidates:
        rankNearCandidates(
          group,
          products
        ).map(
          toCandidateView
        ),
    };
  }

  const first =
    candidates[0];

  const second =
    candidates[1];

  if (
    second &&
    first.score ===
      second.score
  ) {
    return {
      centerKey:
        group.key,
      brand:
        group.brand,
      model:
        group.model,
      memory:
        group.memory,
      color:
        group.color,
      grade:
        group.grade,
      warranty:
        group.warranty,
      colorAliases:
        getColorAliases(
          group.color
        ),
      physicalStock:
        group.physicalStock,
      deviceIds:
        group.deviceIds,
      imeis:
        group.imeis,
      matchStatus:
        "AMBIGUOUS",
      reason:
        "Aynı güven puanında birden fazla İdefix ürünü bulundu. Yanlış ürüne stok yazmamak için otomatik eşleştirme durduruldu.",
      idefix:
        null,
      stockDifference:
        null,
      candidates:
        candidates
          .slice(0, 5)
          .map(
            toCandidateView
          ),
    };
  }

  const matched =
    toMatchedIdefix(
      first.product
    );

  if (
    !matched.barcode
  ) {
    return {
      centerKey:
        group.key,
      brand:
        group.brand,
      model:
        group.model,
      memory:
        group.memory,
      color:
        group.color,
      grade:
        group.grade,
      warranty:
        group.warranty,
      colorAliases:
        getColorAliases(
          group.color
        ),
      physicalStock:
        group.physicalStock,
      deviceIds:
        group.deviceIds,
      imeis:
        group.imeis,
      matchStatus:
        "UNMATCHED",
      reason:
        "Eşleşen İdefix ürününde barkod yok. Stok senkronu için barkod zorunlu.",
      idefix:
        null,
      stockDifference:
        null,
      candidates: [
        toCandidateView(
          first
        ),
      ],
    };
  }

  return {
    centerKey:
      group.key,
    brand:
      group.brand,
    model:
      group.model,
    memory:
      group.memory,
    color:
      group.color,
    grade:
      group.grade,
    warranty:
      group.warranty,
    colorAliases:
      getColorAliases(
        group.color
      ),
    physicalStock:
      group.physicalStock,
    deviceIds:
      group.deviceIds,
    imeis:
      group.imeis,
    matchStatus:
      "MATCHED",
    reason:
      `Güvenli eşleşme bulundu. Renk eşleşmesi: ${
        findMatchedColorAlias(
          normalizeText(
            first.product.title
          ),
          group.color
        ) || group.color
      }.`,
    idefix:
      matched,
    stockDifference:
      group.physicalStock -
      matched.currentStock,
    candidates: [
      toCandidateView(
        first
      ),
    ],
  };
}

function markBarcodeCollisions(
  rows: MappingRow[]
) {
  const barcodeToRows =
    new Map<
      string,
      MappingRow[]
    >();

  for (
    const row of rows
  ) {
    if (
      row.matchStatus !==
        "MATCHED" ||
      !row.idefix?.barcode
    ) {
      continue;
    }

    const barcode =
      row.idefix.barcode;

    if (
      !barcodeToRows.has(
        barcode
      )
    ) {
      barcodeToRows.set(
        barcode,
        []
      );
    }

    barcodeToRows
      .get(barcode)!
      .push(row);
  }

  for (
    const [
      barcode,
      matchedRows,
    ] of barcodeToRows
  ) {
    if (
      matchedRows.length <= 1
    ) {
      continue;
    }

    for (
      const row of
        matchedRows
    ) {
      row.matchStatus =
        "COLLISION";
      row.reason =
        `İdefix barkodu ${barcode} birden fazla farklı Merkez grubuna eşleşti. ` +
        "Garanti/ürün ayrımı kesinleşmeden stok yazımı yapılmayacak.";
      row.stockDifference =
        null;
    }
  }

  return rows;
}

export async function GET(
  request: NextRequest
) {
  const startedAt =
    Date.now();

  try {
    const authError =
      await requireIdefixSuperAdmin(
        request
      );

    if (authError) {
      return authError;
    }

    const pool =
      getIdefixDbPool();

    const [
      deviceResult,
      idefixProducts,
    ] =
      await Promise.all([
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
              status
            FROM public.stock_devices
            WHERE status = 'AVAILABLE'
            ORDER BY id
          `
        ),
        fetchAllIdefixProducts(),
      ]);

    const centerGroups =
      buildCenterGroups(
        deviceResult.rows as
          CenterDeviceRow[]
      );

    const mappings =
      markBarcodeCollisions(
        centerGroups.map(
          (group) =>
            mapCenterGroup(
              group,
              idefixProducts
            )
        )
      );

    const matched =
      mappings.filter(
        (row) =>
          row.matchStatus ===
          "MATCHED"
      );

    const unmatched =
      mappings.filter(
        (row) =>
          row.matchStatus ===
          "UNMATCHED"
      );

    const ambiguous =
      mappings.filter(
        (row) =>
          row.matchStatus ===
          "AMBIGUOUS"
      );

    const collisions =
      mappings.filter(
        (row) =>
          row.matchStatus ===
          "COLLISION"
      );

    const physicalStock =
      mappings.reduce(
        (
          sum,
          row
        ) =>
          sum +
          row.physicalStock,
        0
      );

    const matchedPhysicalStock =
      matched.reduce(
        (
          sum,
          row
        ) =>
          sum +
          row.physicalStock,
        0
      );

    const idefixInventoryTotal =
      idefixProducts.reduce(
        (
          sum,
          product
        ) =>
          sum +
          (
            numberOrNull(
              product
                .inventoryQuantity
            ) ?? 0
          ),
        0
      );

    const activeIdefixListings =
      idefixProducts.filter(
        (product) =>
          (
            numberOrNull(
              product
                .inventoryQuantity
            ) ?? 0
          ) > 0
      ).length;

    const zeroStockIdefixListings =
      idefixProducts.filter(
        (product) =>
          (
            numberOrNull(
              product
                .inventoryQuantity
            ) ?? 0
          ) <= 0
      ).length;

    return noStoreJson({
      success: true,
      readOnly: true,
      channel: "IDEFIX",
      matchingMode:
        "COLOR_ALIAS_SAFE_V1",

      summary: {
        idefixProductCount:
          idefixProducts.length,

        activeIdefixListings,

        zeroStockIdefixListings,

        currentIdefixInventory:
          idefixInventoryTotal,

        physicalStock,

        centerGroupCount:
          centerGroups.length,

        matchedGroups:
          matched.length,

        unmatchedGroups:
          unmatched.length,

        ambiguousGroups:
          ambiguous.length,

        collisionGroups:
          collisions.length,

        matchedPhysicalStock,

        unmappedPhysicalStock:
          physicalStock -
          matchedPhysicalStock,

        canStartStockSync:
          unmatched.length ===
            0 &&
          ambiguous.length ===
            0 &&
          collisions.length ===
            0 &&
          matched.length > 0,
      },

      mappings,

      safety: {
        databaseWrite: false,
        idefixWrite: false,
        stockWrite: false,
        priceWrite: false,
        productCreate: false,
        n11Write: false,
        ikasWrite: false,
      },

      responseTimeMs:
        Date.now() -
        startedAt,

      checkedAt:
        new Date()
          .toISOString(),
    });
  } catch (error) {
    console.error(
      "IDEFIX MAPPING ERROR:",
      error
    );

    return noStoreJson(
      {
        success: false,
        readOnly: true,
        channel: "IDEFIX",
        error:
          error instanceof Error
            ? error.message
            : "İdefix eşleştirme kontrolü yapılamadı.",
        responseTimeMs:
          Date.now() -
          startedAt,
        checkedAt:
          new Date()
            .toISOString(),
      },
      500
    );
  }
}
