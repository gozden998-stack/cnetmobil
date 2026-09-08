// app/api/online/ikas/create-preview/route.ts
// CNETMOBIL - IKAS ADIM 4.0
// READ ONLY / DRY RUN.
// Yenilenmis cihaz icin createProduct payload taslagi hazirlar.
// HICBIR URUN OLUSTURMAZ.
// HICBIR STOK / FIYAT / SIPARIS DEGISTIRMEZ.

import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

declare global {
  // eslint-disable-next-line no-var
  var cnetIkasCreatePreviewPool: Pool | undefined;
}

const COOKIE_NAME = "cnet_auth";

const IKAS_TOKEN_URL =
  "https://api.myikas.com/api/admin/oauth/token";

const IKAS_GRAPHQL_URL =
  "https://api.myikas.com/api/v2/admin/graphql";

type SessionPayload = {
  userId: number | null;
  role: "admin" | "personel";
  branch: string;
  exp: number;
  legacy?: boolean;
};

type TypeRef = {
  kind?: string | null;
  name?: string | null;
  ofType?: TypeRef | null;
};

type InputField = {
  name?: string | null;
  type?: TypeRef | null;
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

  if (!global.cnetIkasCreatePreviewPool) {
    global.cnetIkasCreatePreviewPool =
      new Pool({
        connectionString,
        max: 3,
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: 10_000,
      });
  }

  return global.cnetIkasCreatePreviewPool;
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

    const expected =
      crypto
        .createHmac("sha256", secret)
        .update(encoded)
        .digest("base64url");

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
      a.length !== b.length ||
      !crypto.timingSafeEqual(a, b)
    ) {
      return null;
    }

    const payload =
      JSON.parse(
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

async function getIkasAccessToken() {
  const clientId =
    String(
      process.env.IKAS_CLIENT_ID || ""
    ).trim();

  const clientSecret =
    String(
      process.env.IKAS_CLIENT_SECRET || ""
    ).trim();

  if (!clientId) {
    throw new Error(
      "IKAS_CLIENT_ID bulunamadı."
    );
  }

  if (!clientSecret) {
    throw new Error(
      "IKAS_CLIENT_SECRET bulunamadı."
    );
  }

  const form =
    new URLSearchParams();

  form.set(
    "grant_type",
    "client_credentials"
  );

  form.set(
    "client_id",
    clientId
  );

  form.set(
    "client_secret",
    clientSecret
  );

  const controller =
    new AbortController();

  const timeoutId =
    setTimeout(
      () => controller.abort(),
      15_000
    );

  try {
    const response =
      await fetch(
        IKAS_TOKEN_URL,
        {
          method: "POST",
          cache: "no-store",
          headers: {
            "Content-Type":
              "application/x-www-form-urlencoded",
            Accept:
              "application/json",
          },
          body:
            form.toString(),
          signal:
            controller.signal,
        }
      );

    const rawText =
      await response.text();

    let payload: any = null;

    try {
      payload =
        rawText
          ? JSON.parse(rawText)
          : null;
    } catch {
      payload = null;
    }

    if (!response.ok) {
      throw new Error(
        payload?.error_description ||
          payload?.message ||
          payload?.error ||
          `ikas token HTTP ${response.status}`
      );
    }

    const accessToken =
      String(
        payload?.access_token || ""
      ).trim();

    if (!accessToken) {
      throw new Error(
        "ikas access_token alınamadı."
      );
    }

    return accessToken;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function graphql(
  accessToken: string,
  query: string,
  variables:
    Record<string, unknown> = {}
) {
  const controller =
    new AbortController();

  const timeoutId =
    setTimeout(
      () => controller.abort(),
      25_000
    );

  try {
    const response =
      await fetch(
        IKAS_GRAPHQL_URL,
        {
          method: "POST",
          cache: "no-store",
          headers: {
            "Content-Type":
              "application/json",
            Accept:
              "application/json",
            Authorization:
              `Bearer ${accessToken}`,
          },
          body:
            JSON.stringify({
              query,
              variables,
            }),
          signal:
            controller.signal,
        }
      );

    const rawText =
      await response.text();

    let payload: any = null;

    try {
      payload =
        rawText
          ? JSON.parse(rawText)
          : null;
    } catch {
      payload = null;
    }

    if (!response.ok) {
      throw new Error(
        payload?.errors?.[0]?.message ||
          payload?.message ||
          `ikas GraphQL HTTP ${response.status}`
      );
    }

    if (
      Array.isArray(payload?.errors) &&
      payload.errors.length > 0
    ) {
      throw new Error(
        payload.errors
          .map(
            (item: any) =>
              String(
                item?.message ||
                  "GraphQL hata"
              )
          )
          .join(" | ")
      );
    }

    return payload?.data ?? {};
  } finally {
    clearTimeout(timeoutId);
  }
}

function normalizeText(
  value: unknown
) {
  return String(
    value ?? ""
  )
    .trim()
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .replace(/ı/g, "i");
}

function slug(
  value: unknown
) {
  return normalizeText(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toUpperCase();
}

function gradeLabel(
  grade: string
) {
  const normalized =
    String(grade || "")
      .trim()
      .toUpperCase();

  if (normalized === "A") {
    return "Mükemmel";
  }

  if (normalized === "B") {
    return "Çok İyi";
  }

  if (normalized === "C") {
    return "İyi";
  }

  return grade.trim();
}

function parsePositiveMoney(
  value: unknown,
  fieldName: string
) {
  const number =
    Number(
      String(value ?? "")
        .replace(",", ".")
        .trim()
    );

  if (
    !Number.isFinite(number) ||
    number <= 0
  ) {
    throw new Error(
      `${fieldName} geçerli ve 0'dan büyük olmalı.`
    );
  }

  return Math.round(
    number * 100
  ) / 100;
}

function typeRefToText(
  type: TypeRef | null | undefined
): string {
  if (!type) {
    return "";
  }

  if (type.kind === "NON_NULL") {
    return `${typeRefToText(
      type.ofType
    )}!`;
  }

  if (type.kind === "LIST") {
    return `[${typeRefToText(
      type.ofType
    )}]`;
  }

  return String(
    type.name ||
      type.kind ||
      ""
  );
}

function unwrapType(
  type: TypeRef | null | undefined
) {
  let current =
    type || null;

  while (
    current &&
    (current.kind === "NON_NULL" ||
      current.kind === "LIST")
  ) {
    current =
      current.ofType || null;
  }

  return {
    kind:
      String(
        current?.kind || ""
      ),
    name:
      String(
        current?.name || ""
      ),
  };
}

const INPUT_SCHEMA = `
  query CnetIkasCreateInputSchema(
    $name: String!
  ) {
    __type(name: $name) {
      kind
      name
      inputFields {
        name
        type {
          kind
          name
          ofType {
            kind
            name
            ofType {
              kind
              name
              ofType {
                kind
                name
              }
            }
          }
        }
      }
    }
  }
`;

const PRODUCT_QUERY = `
  query CnetIkasCreatePreviewProducts(
    $pagination: PaginationInput
  ) {
    listProduct(
      pagination: $pagination
    ) {
      hasNext
      page
      data {
        id
        name
        description

        brand {
          id
          name
        }

        categories {
          id
          name
        }

        variants {
          id
          sku
          variantValues {
            variantTypeName
            variantValueName
          }
        }
      }
    }
  }
`;

async function getInputSchema(
  accessToken: string,
  inputName: string
) {
  const data =
    await graphql(
      accessToken,
      INPUT_SCHEMA,
      {
        name: inputName,
      }
    );

  const fields =
    Array.isArray(
      data?.__type
        ?.inputFields
    )
      ? data.__type
          .inputFields
      : [];

  return {
    name:
      data?.__type?.name ||
      inputName,
    kind:
      data?.__type?.kind ||
      null,
    fields:
      fields.map(
        (field: InputField) => ({
          name:
            String(
              field?.name ||
                ""
            ),
          type:
            typeRefToText(
              field?.type
            ),
          namedType:
            unwrapType(
              field?.type
            ).name,
        })
      ),
  };
}

async function getCreateSchemas(
  accessToken: string
) {
  const product =
    await getInputSchema(
      accessToken,
      "CreateProductInput"
    );

  const variantField =
    product.fields.find(
      (field: any) =>
        field.name ===
        "variants"
    );

  const variantTypeName =
    variantField
      ?.namedType ||
    "";

  const variant =
    variantTypeName
      ? await getInputSchema(
          accessToken,
          variantTypeName
        )
      : {
          name: null,
          kind: null,
          fields: [],
        };

  const priceField =
    variant.fields.find(
      (field: any) =>
        field.name ===
        "prices"
    );

  const priceTypeName =
    priceField?.namedType ||
    "";

  const price =
    priceTypeName
      ? await getInputSchema(
          accessToken,
          priceTypeName
        )
      : {
          name: null,
          kind: null,
          fields: [],
        };

  const valueField =
    variant.fields.find(
      (field: any) =>
        field.name ===
        "variantValues"
    );

  const valueTypeName =
    valueField?.namedType ||
    "";

  const variantValue =
    valueTypeName
      ? await getInputSchema(
          accessToken,
          valueTypeName
        )
      : {
          name: null,
          kind: null,
          fields: [],
        };

  return {
    product,
    variant,
    price,
    variantValue,
  };
}

async function fetchAllProducts(
  accessToken: string
) {
  const all:
    any[] = [];

  for (
    let page = 0;
    page < 50;
    page += 1
  ) {
    const data =
      await graphql(
        accessToken,
        PRODUCT_QUERY,
        {
          pagination: {
            page,
            limit: 100,
          },
        }
      );

    const response =
      data?.listProduct;

    const items =
      Array.isArray(
        response?.data
      )
        ? response.data
        : [];

    all.push(
      ...items
    );

    if (
      response?.hasNext !==
      true ||
      items.length === 0
    ) {
      break;
    }
  }

  return all;
}

function scoreReferenceProduct(
  product: any,
  brand: string,
  model: string,
  memory: string
) {
  const name =
    normalizeText(
      product?.name
    );

  const brandName =
    normalizeText(
      product?.brand?.name
    );

  const wantedBrand =
    normalizeText(brand);

  const wantedModel =
    normalizeText(model);

  const wantedMemory =
    normalizeText(memory);

  let score = 0;

  if (
    brandName ===
    wantedBrand
  ) {
    score += 30;
  }

  if (
    name.includes(
      wantedBrand
    )
  ) {
    score += 10;
  }

  if (
    wantedModel &&
    name.includes(
      wantedModel
    )
  ) {
    score += 45;
  }

  if (
    wantedMemory &&
    name.includes(
      wantedMemory
    )
  ) {
    score += 15;
  }

  if (
    name.includes(
      "yenilenmis"
    )
  ) {
    score += 5;
  }

  return score;
}

function findReferenceProduct(
  products: any[],
  brand: string,
  model: string,
  memory: string
) {
  const ranked =
    products
      .map(
        (product: any) => ({
          product,
          score:
            scoreReferenceProduct(
              product,
              brand,
              model,
              memory
            ),
        })
      )
      .filter(
        (item: any) =>
          item.score >= 45
      )
      .sort(
        (
          a: any,
          b: any
        ) =>
          b.score -
          a.score
      );

  return (
    ranked[0] ||
    null
  );
}

function hasField(
  schema: any,
  fieldName: string
) {
  return Boolean(
    schema?.fields?.some(
      (field: any) =>
        field?.name ===
        fieldName
    )
  );
}

function makeSku(
  brand: string,
  model: string,
  memory: string,
  grade: string,
  warranty: string,
  color: string
) {
  const signature = [
    brand,
    model,
    memory,
    grade,
    warranty,
    color,
  ]
    .map(normalizeText)
    .join("|");

  const hash =
    crypto
      .createHash("sha1")
      .update(signature)
      .digest("hex")
      .slice(0, 8)
      .toUpperCase();

  const readable =
    [
      "CNET",
      slug(model),
      slug(memory),
      slug(grade),
      slug(color),
    ]
      .filter(Boolean)
      .join("-")
      .slice(0, 46)
      .replace(/-+$/g, "");

  return `${readable}-${hash}`;
}

function buildCreateInput(
  schemas: any,
  params: {
    title: string;
    sku: string;
    colorTypeName: string;
    color: string;
    salePrice: number;
    listPrice: number;
    referenceProduct: any | null;
  }
) {
  const input:
    Record<string, unknown> = {};

  if (
    hasField(
      schemas.product,
      "name"
    )
  ) {
    input.name =
      params.title;
  }

  if (
    hasField(
      schemas.product,
      "type"
    )
  ) {
    input.type =
      "PHYSICAL";
  }

  if (
    params.referenceProduct
      ?.brand?.id
  ) {
    if (
      hasField(
        schemas.product,
        "brandId"
      )
    ) {
      input.brandId =
        params.referenceProduct
          .brand.id;
    } else if (
      hasField(
        schemas.product,
        "productBrandId"
      )
    ) {
      input.productBrandId =
        params.referenceProduct
          .brand.id;
    }
  }

  const categoryIds =
    Array.isArray(
      params.referenceProduct
        ?.categories
    )
      ? params.referenceProduct
          .categories
          .map(
            (item: any) =>
              item?.id
          )
          .filter(Boolean)
      : [];

  if (
    categoryIds.length >
    0
  ) {
    if (
      hasField(
        schemas.product,
        "categoryIds"
      )
    ) {
      input.categoryIds =
        categoryIds;
    } else if (
      hasField(
        schemas.product,
        "categories"
      )
    ) {
      input.categories =
        categoryIds;
    }
  }

  const variant:
    Record<string, unknown> = {};

  if (
    hasField(
      schemas.variant,
      "sku"
    )
  ) {
    variant.sku =
      params.sku;
  }

  if (
    hasField(
      schemas.variant,
      "isActive"
    )
  ) {
    variant.isActive =
      true;
  }

  if (
    hasField(
      schemas.variant,
      "prices"
    )
  ) {
    const price:
      Record<string, unknown> = {};

    if (
      hasField(
        schemas.price,
        "sellPrice"
      )
    ) {
      price.sellPrice =
        params.salePrice;
    }

    if (
      hasField(
        schemas.price,
        "discountPrice"
      ) &&
      params.listPrice >
        params.salePrice
    ) {
      // Mevcut fiyat alanlari ters anlamli olabilir.
      // Dry-run ekraninda field destegini gosteriyoruz;
      // ilk WRITE adiminda canli ornekteki semantigi birebir uygulayacagiz.
      price.discountPrice =
        params.salePrice;
    }

    variant.prices = [
      price,
    ];
  }

  if (
    hasField(
      schemas.variant,
      "variantValues"
    )
  ) {
    const value:
      Record<string, unknown> = {};

    if (
      hasField(
        schemas.variantValue,
        "variantTypeName"
      )
    ) {
      value.variantTypeName =
        params.colorTypeName;
    }

    if (
      hasField(
        schemas.variantValue,
        "variantValueName"
      )
    ) {
      value.variantValueName =
        params.color;
    }

    variant.variantValues = [
      value,
    ];
  }

  if (
    hasField(
      schemas.product,
      "variants"
    )
  ) {
    input.variants = [
      variant,
    ];
  }

  return input;
}

export async function POST(
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

    const body =
      await request.json();

    const imei =
      String(
        body?.imei || ""
      ).trim();

    const brand =
      String(
        body?.brand || ""
      ).trim();

    const model =
      String(
        body?.model || ""
      ).trim();

    const memory =
      String(
        body?.memory || ""
      ).trim();

    const color =
      String(
        body?.color || ""
      ).trim();

    const grade =
      String(
        body?.grade || ""
      )
        .trim()
        .toUpperCase();

    const warranty =
      String(
        body?.warranty ||
          ""
      ).trim();

    if (
      !/^\d{15}$/.test(
        imei
      )
    ) {
      throw new Error(
        "IMEI 15 haneli rakam olmalı."
      );
    }

    if (
      !brand ||
      !model ||
      !memory ||
      !color ||
      !grade ||
      !warranty
    ) {
      throw new Error(
        "Marka, model, hafıza, renk, grade ve garanti zorunlu."
      );
    }

    if (
      !["A", "B", "C"].includes(
        grade
      )
    ) {
      throw new Error(
        "Grade A, B veya C olmalı."
      );
    }

    const salePrice =
      parsePositiveMoney(
        body?.salePrice,
        "Satış fiyatı"
      );

    const listPrice =
      parsePositiveMoney(
        body?.listPrice ||
          body?.salePrice,
        "Liste fiyatı"
      );

    const accessToken =
      await getIkasAccessToken();

    const [
      schemas,
      products,
    ] =
      await Promise.all([
        getCreateSchemas(
          accessToken
        ),
        fetchAllProducts(
          accessToken
        ),
      ]);

    const reference =
      findReferenceProduct(
        products,
        brand,
        model,
        memory
      );

    const gradeText =
      gradeLabel(grade);

    const title =
      `Yenilenmiş ${brand} ${model} ${memory} ${gradeText}`
        .replace(
          /\s+/g,
          " "
        )
        .trim();

    const colorTypeName =
      `${model} Renkleri`;

    const sku =
      makeSku(
        brand,
        model,
        memory,
        grade,
        warranty,
        color
      );

    const createInput =
      buildCreateInput(
        schemas,
        {
          title,
          sku,
          colorTypeName,
          color,
          salePrice,
          listPrice,
          referenceProduct:
            reference?.product ||
            null,
        }
      );

    const referenceProduct =
      reference
        ? {
            score:
              reference.score,
            id:
              reference.product
                ?.id ||
              null,
            name:
              reference.product
                ?.name ||
              null,
            brand:
              reference.product
                ?.brand ||
              null,
            categories:
              reference.product
                ?.categories ||
              [],
          }
        : null;

    const duplicateCandidates =
      products
        .filter(
          (product: any) => {
            const name =
              normalizeText(
                product?.name
              );

            return (
              name.includes(
                normalizeText(
                  model
                )
              ) &&
              name.includes(
                normalizeText(
                  memory
                )
              ) &&
              name.includes(
                normalizeText(
                  gradeText
                )
              )
            );
          }
        )
        .slice(0, 10)
        .map(
          (product: any) => ({
            id:
              product?.id ||
              null,
            name:
              product?.name ||
              null,
            brand:
              product?.brand ||
              null,
            categories:
              product?.categories ||
              [],
            variants:
              product?.variants ||
              [],
          })
        );

    return json({
      success: true,
      readOnly: true,
      dryRun: true,
      message:
        "İkas createProduct payload önizlemesi hazır. HİÇBİR ürün oluşturulmadı.",

      input: {
        imei,
        brand,
        model,
        memory,
        color,
        grade,
        gradeLabel:
          gradeText,
        warranty,
        salePrice,
        listPrice,
      },

      derived: {
        title,
        sku,
        colorTypeName,
        referenceProduct,
        duplicateCandidateCount:
          duplicateCandidates.length,
      },

      duplicateCandidates,

      schema: {
        createProductInput:
          schemas.product,
        variantInput:
          schemas.variant,
        priceInput:
          schemas.price,
        variantValueInput:
          schemas.variantValue,
      },

      createProductPayloadPreview: {
        query:
          "mutation CreateProduct($input: CreateProductInput!) { createProduct(input: $input) { id name variants { id sku variantValues { variantTypeName variantValueName } } } }",
        variables: {
          input:
            createInput,
        },
      },

      safety: {
        writeExecuted:
          false,
        productCreated:
          false,
        stockChanged:
          false,
        priceChanged:
          false,
        note:
          "Bu endpoint sadece payload hazırlar. createProduct mutation çalıştırılmaz.",
      },

      next:
        "Bu önizleme doğruysa ADIM 4.1'de ilk kontrollü test ürünü oluşturma işlemi eklenecek.",

      checkedAt:
        new Date().toISOString(),
    });
  } catch (error) {
    console.error(
      "IKAS CREATE PREVIEW ERROR:",
      error
    );

    return json(
      {
        success: false,
        readOnly: true,
        dryRun: true,
        error:
          error instanceof Error
            ? error.message
            : "İkas ürün payload önizlemesi hazırlanamadı.",
        checkedAt:
          new Date().toISOString(),
      },
      400
    );
  }
}
