// app/api/online/ikas/variant-price/route.ts
// CNETMOBIL - IKAS FIYAT YONETIMI
//
// UI semantiği:
// - Liste Fiyatı -> İkas sellPrice
// - Satış Fiyatı -> İkas discountPrice
// Eğer iki fiyat eşitse sadece sellPrice kullanılır.
//
// N11'e dokunmaz.
// Merkezi IMEI stoğuna dokunmaz.

import {
  NextRequest,
} from "next/server";
import {
  getIkasAccessToken,
  getIkasDbPool,
  ikasGraphql,
  noStoreJson,
  numberOrNull,
  requireIkasSuperAdmin,
} from "../../../../lib/ikas/server";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

export const revalidate = 0;

function money(
  value: unknown,
  label: string
) {
  let raw =
    String(
      value ?? ""
    )
      .trim()
      .replace(
        /₺|TL/gi,
        ""
      )
      .replace(
        /\s+/g,
        ""
      );

  if (
    raw.includes(",") &&
    raw.includes(".")
  ) {
    raw =
      raw
        .replace(/\./g, "")
        .replace(",", ".");
  } else if (
    raw.includes(",")
  ) {
    raw =
      raw.replace(",", ".");
  }

  const number =
    Number(raw);

  if (
    !Number.isFinite(
      number
    ) ||
    number <= 0
  ) {
    throw new Error(
      `${label} geçerli olmalıdır.`
    );
  }

  return Math.round(
    number * 100
  ) / 100;
}

async function findVariant(
  token: string,
  productId: string,
  variantId: string
) {
  for (
    let page = 0;
    page < 20;
    page += 1
  ) {
    const data =
      await ikasGraphql(
        token,
        `
          query CnetPriceVerify(
            $pagination: PaginationInput
          ) {
            listProduct(
              pagination: $pagination
            ) {
              hasNext
              data {
                id
                name
                variants {
                  id
                  sku
                  prices {
                    priceListId
                    sellPrice
                    discountPrice
                  }
                }
              }
            }
          }
        `,
        {
          pagination: {
            page,
            limit: 100,
          },
        }
      );

    const items =
      Array.isArray(
        data?.listProduct
          ?.data
      )
        ? data.listProduct
            .data
        : [];

    const product =
      items.find(
        (item: any) =>
          String(
            item?.id || ""
          ) ===
          productId
      );

    if (product) {
      const variant =
        (
          Array.isArray(
            product?.variants
          )
            ? product.variants
            : []
        ).find(
          (item: any) =>
            String(
              item?.id || ""
            ) ===
            variantId
        );

      return {
        product,
        variant:
          variant || null,
      };
    }

    if (
      data?.listProduct
        ?.hasNext !== true
    ) {
      break;
    }
  }

  return {
    product: null,
    variant: null,
  };
}

export async function POST(
  request: NextRequest
) {
  try {
    const authError =
      await requireIkasSuperAdmin(
        request
      );

    if (authError) {
      return authError;
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
          success: false,
          error:
            "Geçersiz istek.",
        },
        400
      );
    }

    const productId =
      String(
        body.productId ||
          ""
      ).trim();

    const variantId =
      String(
        body.variantId ||
          ""
      ).trim();

    if (
      !productId ||
      !variantId
    ) {
      return noStoreJson(
        {
          success: false,
          error:
            "Ürün ve varyant ID zorunlu.",
        },
        400
      );
    }

    const salePrice =
      money(
        body.salePrice,
        "Satış fiyatı"
      );

    const listPrice =
      money(
        body.listPrice,
        "Liste fiyatı"
      );

    if (
      listPrice <
      salePrice
    ) {
      return noStoreJson(
        {
          success: false,
          error:
            "Liste fiyatı satış fiyatından düşük olamaz.",
        },
        400
      );
    }

    const token =
      await getIkasAccessToken();

    const price:
      Record<
        string,
        unknown
      > = {
      sellPrice:
        listPrice,
      currency:
        "TRY",
    };

    if (
      salePrice <
      listPrice
    ) {
      price.discountPrice =
        salePrice;
    }

    await ikasGraphql(
      token,
      `
        mutation CnetUpdateVariantPrices(
          $input: UpdateVariantPricesInput!
        ) {
          updateVariantPrices(
            input: $input
          ) {
            __typename
          }
        }
      `,
      {
        input: {
          priceListId: null,
          variantPriceInputs: [
            {
              deleted: false,
              price,
              productId,
              variantId,
            },
          ],
        },
      }
    );

    const verified =
      await findVariant(
        token,
        productId,
        variantId
      );

    if (
      !verified.product ||
      !verified.variant
    ) {
      throw new Error(
        "İkas fiyat güncellemesi sonrası varyant tekrar okunamadı."
      );
    }

    const prices =
      Array.isArray(
        verified.variant
          ?.prices
      )
        ? verified.variant
            .prices
        : [];

    const defaultPrice =
      prices.find(
        (item: any) =>
          item?.priceListId ===
            null ||
          item?.priceListId ===
            undefined
      ) ||
      prices[0] ||
      null;

    const verifiedList =
      numberOrNull(
        defaultPrice
          ?.sellPrice
      );

    const verifiedDiscount =
      numberOrNull(
        defaultPrice
          ?.discountPrice
      );

    const verifiedSale =
      verifiedDiscount &&
      verifiedDiscount > 0
        ? verifiedDiscount
        : verifiedList;

    if (
      verifiedList ===
        null ||
      verifiedSale ===
        null
    ) {
      throw new Error(
        "İkas fiyat doğrulaması yapılamadı."
      );
    }

    const epsilon = 0.01;

    if (
      Math.abs(
        verifiedList -
          listPrice
      ) > epsilon ||
      Math.abs(
        verifiedSale -
          salePrice
      ) > epsilon
    ) {
      throw new Error(
        `İkas fiyat doğrulaması başarısız. Beklenen satış ${salePrice}, liste ${listPrice}; okunan satış ${verifiedSale}, liste ${verifiedList}.`
      );
    }

    // PostgreSQL IKAS aynası varsa best-effort güncelle.
    try {
      await getIkasDbPool().query(
        `
          UPDATE public.online_listings
          SET
            sale_price = $1,
            list_price = $2,
            updated_at = now()
          WHERE channel = 'IKAS'
            AND external_variant_id = $3
        `,
        [
          salePrice,
          listPrice,
          variantId,
        ]
      );

      await getIkasDbPool().query(
        `
          UPDATE public.online_channel_devices
          SET
            channel_sale_price = $1,
            channel_list_price = $2,
            updated_at = now()
          WHERE channel = 'IKAS'
            AND online_listing_id IN (
              SELECT id
              FROM public.online_listings
              WHERE channel = 'IKAS'
                AND external_variant_id = $3
            )
        `,
        [
          salePrice,
          listPrice,
          variantId,
        ]
      );
    } catch (error) {
      console.error(
        "IKAS PRICE LOCAL MIRROR WARNING:",
        error
      );
    }

    return noStoreJson({
      success: true,
      message:
        "İkas fiyatı güncellendi.",
      productId,
      variantId,
      productName:
        String(
          verified.product
            ?.name ||
            ""
        ),
      salePrice:
        verifiedSale,
      listPrice:
        verifiedList,
      verified: true,
    });
  } catch (error) {
    console.error(
      "IKAS PRICE ERROR:",
      error
    );

    return noStoreJson(
      {
        success: false,
        error:
          error instanceof
            Error
            ? error.message
            : "İkas fiyatı güncellenemedi.",
      },
      500
    );
  }
}
