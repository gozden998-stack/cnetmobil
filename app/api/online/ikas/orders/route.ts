// app/api/online/ikas/orders/route.ts
// CNETMOBIL - IKAS SIPARIS YONETIMI
//
// GET:
// - listOrder ile canlı siparişleri çeker.
// - Canlı GraphQL şemasını introspection ile okuyup mümkün olan
//   müşteri, satır ve paket bilgilerini güvenli şekilde ekler.
// - Yeni / Kargoya Hazır / Kargoda / Teslim Edildi gruplar.
//
// POST:
// - action: READY | SHIPPED | DELIVERED
// - Canlı mutation/input şemasını introspection ile okur.
// - updateOrderPackageStatus kullanır.
// - READY aşamasında paket henüz yoksa fulfillOrder ile paket
//   oluşturmayı dener ve sonra statüyü günceller.
// - Zorunlu ama güvenli şekilde üretilemeyen alan varsa mutation
//   tahmin etmez; açık hata döndürür.
//
// Bu route şu anda merkezi IMEI / N11 stok düşümü YAPMAZ.
// Çapraz stok motoru ayrı adımda bağlanacak.

import {
  NextRequest,
} from "next/server";
import {
  getIkasAccessToken,
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

type TypeRef = {
  kind?: string | null;
  name?: string | null;
  ofType?: TypeRef | null;
};

type SchemaField = {
  name: string;
  type: TypeRef;
};

type OrderAction =
  | "READY"
  | "SHIPPED"
  | "DELIVERED";

function typeText(
  type:
    | TypeRef
    | null
    | undefined
): string {
  if (!type) {
    return "";
  }

  if (
    type.kind ===
    "NON_NULL"
  ) {
    return `${typeText(
      type.ofType
    )}!`;
  }

  if (
    type.kind === "LIST"
  ) {
    return `[${typeText(
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
  type:
    | TypeRef
    | null
    | undefined
) {
  let current =
    type || null;

  let isList =
    false;

  let required =
    false;

  if (
    current?.kind ===
    "NON_NULL"
  ) {
    required =
      true;
    current =
      current.ofType ||
      null;
  }

  if (
    current?.kind ===
    "LIST"
  ) {
    isList =
      true;
    current =
      current.ofType ||
      null;

    if (
      current?.kind ===
      "NON_NULL"
    ) {
      current =
        current.ofType ||
        null;
    }
  }

  while (
    current &&
    (
      current.kind ===
        "NON_NULL" ||
      current.kind ===
        "LIST"
    )
  ) {
    current =
      current.ofType ||
      null;
  }

  return {
    name:
      String(
        current?.name ||
          ""
      ),
    kind:
      String(
        current?.kind ||
          ""
      ),
    isList,
    required,
  };
}

async function getType(
  token: string,
  name: string
) {
  const data =
    await ikasGraphql(
      token,
      `
        query CnetSchemaType(
          $name: String!
        ) {
          __type(
            name: $name
          ) {
            kind
            name
            fields(
              includeDeprecated: true
            ) {
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
            enumValues {
              name
            }
          }
        }
      `,
      { name }
    );

  return (
    data?.__type ||
    null
  );
}

async function getMutationField(
  token: string,
  name: string
) {
  const data =
    await ikasGraphql(
      token,
      `
        query CnetMutationSchema {
          __type(
            name: "Mutation"
          ) {
            fields(
              includeDeprecated: true
            ) {
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
                  }
                }
              }
              args {
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
        }
      `
    );

  const fields =
    Array.isArray(
      data?.__type
        ?.fields
    )
      ? data.__type
          .fields
      : [];

  return (
    fields.find(
      (field: any) =>
        field?.name ===
        name
    ) ||
    null
  );
}

function isScalarKind(
  kind: string
) {
  return [
    "SCALAR",
    "ENUM",
  ].includes(kind);
}

function pickScalarFields(
  typeInfo: any,
  preferred: string[]
) {
  const fields =
    Array.isArray(
      typeInfo?.fields
    )
      ? typeInfo.fields
      : [];

  const byName =
    new Map(
      fields.map(
        (field: any) => [
          String(
            field?.name ||
              ""
          ),
          field,
        ]
      )
    );

  return preferred.filter(
    (name) => {
      const field =
        byName.get(name);

      if (!field) {
        return false;
      }

      const unwrapped =
        unwrapType(
          (field as any)
            ?.type
        );

      return isScalarKind(
        unwrapped.kind
      );
    }
  );
}

async function nestedSelection(
  token: string,
  parentType: any,
  fieldName: string,
  scalarCandidates: string[],
  nestedCandidates:
    Array<{
      name: string;
      scalars: string[];
    }> = []
) {
  const fields =
    Array.isArray(
      parentType?.fields
    )
      ? parentType.fields
      : [];

  const field =
    fields.find(
      (item: any) =>
        item?.name ===
        fieldName
    );

  if (!field) {
    return "";
  }

  const unwrapped =
    unwrapType(
      field.type
    );

  if (
    unwrapped.kind !==
      "OBJECT" ||
    !unwrapped.name
  ) {
    return "";
  }

  const child =
    await getType(
      token,
      unwrapped.name
    );

  if (!child) {
    return "";
  }

  const selections =
    pickScalarFields(
      child,
      scalarCandidates
    );

  for (
    const nested of
      nestedCandidates
  ) {
    const nestedPart =
      await nestedSelection(
        token,
        child,
        nested.name,
        nested.scalars
      );

    if (nestedPart) {
      selections.push(
        nestedPart
      );
    }
  }

  if (
    selections.length ===
    0
  ) {
    return "";
  }

  return `${fieldName} { ${selections.join(
    " "
  )} }`;
}

async function buildOrderSelection(
  token: string
) {
  const queryType =
    await getType(
      token,
      "Query"
    );

  const listOrderField =
    (
      Array.isArray(
        queryType?.fields
      )
        ? queryType.fields
        : []
    ).find(
      (field: any) =>
        field?.name ===
        "listOrder"
    );

  if (!listOrderField) {
    throw new Error(
      "İkas GraphQL şemasında listOrder bulunamadı."
    );
  }

  const listType =
    unwrapType(
      listOrderField.type
    );

  const listResponse =
    await getType(
      token,
      listType.name
    );

  const dataField =
    (
      Array.isArray(
        listResponse?.fields
      )
        ? listResponse.fields
        : []
    ).find(
      (field: any) =>
        field?.name ===
        "data"
    );

  const orderTypeName =
    unwrapType(
      dataField?.type
    ).name ||
    "Order";

  const orderType =
    await getType(
      token,
      orderTypeName
    );

  if (!orderType) {
    throw new Error(
      "İkas Order tipi okunamadı."
    );
  }

  const selections =
    pickScalarFields(
      orderType,
      [
        "id",
        "orderNumber",
        "orderedAt",
        "status",
        "totalFinalPrice",
        "currencyCode",
        "updatedAt",
        "lastModifiedDate",
        "customerNote",
        "paymentStatus",
        "fulfillmentStatus",
      ]
    );

  // Müşteri
  for (
    const name of [
      "customer",
      "customerInfo",
    ]
  ) {
    const part =
      await nestedSelection(
        token,
        orderType,
        name,
        [
          "id",
          "firstName",
          "lastName",
          "fullName",
          "email",
          "phone",
          "phoneNumber",
        ]
      );

    if (part) {
      selections.push(part);
      break;
    }
  }

  // Teslimat adresi
  for (
    const name of [
      "shippingAddress",
      "deliveryAddress",
      "shippingAddressSnapshot",
      "billingAddress",
    ]
  ) {
    const part =
      await nestedSelection(
        token,
        orderType,
        name,
        [
          "id",
          "firstName",
          "lastName",
          "fullName",
          "city",
          "district",
          "state",
          "country",
          "phone",
          "phoneNumber",
          "addressLine",
          "addressLine1",
          "address",
        ]
      );

    if (part) {
      selections.push(part);
      break;
    }
  }

  // Sipariş satırları
  for (
    const name of [
      "orderLines",
      "orderLineItems",
      "lineItems",
      "lines",
    ]
  ) {
    const part =
      await nestedSelection(
        token,
        orderType,
        name,
        [
          "id",
          "orderLineId",
          "quantity",
          "price",
          "finalPrice",
          "totalPrice",
          "name",
          "title",
          "sku",
          "variantId",
          "productId",
        ],
        [
          {
            name:
              "product",
            scalars: [
              "id",
              "name",
              "title",
            ],
          },
          {
            name:
              "variant",
            scalars: [
              "id",
              "name",
              "sku",
            ],
          },
        ]
      );

    if (part) {
      selections.push(part);
      break;
    }
  }

  // Paketler
  for (
    const name of [
      "orderPackages",
      "packages",
      "fulfillments",
    ]
  ) {
    const part =
      await nestedSelection(
        token,
        orderType,
        name,
        [
          "id",
          "status",
          "trackingNumber",
          "trackingCode",
          "trackingUrl",
          "cargoTrackingNumber",
          "cargoCompany",
          "shippingCompany",
          "createdAt",
          "updatedAt",
        ]
      );

    if (part) {
      selections.push(part);
      break;
    }
  }

  // Resmi minimum alanlar her durumda olmalı.
  for (
    const required of [
      "id",
      "orderNumber",
      "orderedAt",
      "status",
      "totalFinalPrice",
    ]
  ) {
    if (
      !selections.includes(
        required
      )
    ) {
      selections.unshift(
        required
      );
    }
  }

  return selections.join(
    "\n"
  );
}

function firstObject(
  value: unknown
) {
  if (
    value &&
    typeof value ===
      "object" &&
    !Array.isArray(value)
  ) {
    return value as
      Record<
        string,
        any
      >;
  }

  return null;
}

function firstArray(
  order: any,
  names: string[]
) {
  for (
    const name of
      names
  ) {
    if (
      Array.isArray(
        order?.[name]
      )
    ) {
      return order[name];
    }
  }

  return [];
}

function findObject(
  order: any,
  names: string[]
) {
  for (
    const name of
      names
  ) {
    const object =
      firstObject(
        order?.[name]
      );

    if (object) {
      return object;
    }
  }

  return null;
}

function collectStatuses(
  value: any,
  output:
    string[] = []
) {
  if (
    !value ||
    typeof value !==
      "object"
  ) {
    return output;
  }

  if (
    Array.isArray(value)
  ) {
    for (
      const item of
        value
    ) {
      collectStatuses(
        item,
        output
      );
    }

    return output;
  }

  for (
    const [
      key,
      item,
    ] of
      Object.entries(
        value
      )
  ) {
    if (
      key
        .toLowerCase()
        .includes(
          "status"
        ) &&
      (
        typeof item ===
          "string" ||
        typeof item ===
          "number"
      )
    ) {
      output.push(
        String(item)
          .trim()
          .toUpperCase()
      );
    }

    if (
      item &&
      typeof item ===
        "object"
    ) {
      collectStatuses(
        item,
        output
      );
    }
  }

  return output;
}

function bucketOrder(
  order: any
) {
  const statuses =
    Array.from(
      new Set(
        collectStatuses(
          order
        )
      )
    );

  const joined =
    statuses.join("|");

  if (
    /DELIVERED|TESLIM|COMPLETED/.test(
      joined
    )
  ) {
    return "delivered";
  }

  if (
    /SHIPPED|IN_TRANSIT|SENT|KARGODA/.test(
      joined
    )
  ) {
    return "shipped";
  }

  if (
    /READY_FOR_SHIPMENT|READY|PREPARED|KARGOYA_HAZIR/.test(
      joined
    )
  ) {
    return "ready";
  }

  if (
    /CANCEL|REFUND|RETURN/.test(
      joined
    )
  ) {
    return "other";
  }

  return "new";
}

function lineName(
  line: any
) {
  const product =
    firstObject(
      line?.product
    );

  const variant =
    firstObject(
      line?.variant
    );

  return (
    String(
      line?.name ||
        line?.title ||
        product?.name ||
        product?.title ||
        variant?.name ||
        line?.sku ||
        variant?.sku ||
        "Ürün"
    ).trim() ||
    "Ürün"
  );
}

function normalizeOrder(
  order: any
) {
  const customer =
    findObject(
      order,
      [
        "customer",
        "customerInfo",
      ]
    );

  const address =
    findObject(
      order,
      [
        "shippingAddress",
        "deliveryAddress",
        "shippingAddressSnapshot",
        "billingAddress",
      ]
    );

  const lines =
    firstArray(
      order,
      [
        "orderLines",
        "orderLineItems",
        "lineItems",
        "lines",
      ]
    );

  const packages =
    firstArray(
      order,
      [
        "orderPackages",
        "packages",
        "fulfillments",
      ]
    );

  const customerName =
    String(
      customer?.fullName ||
        [
          customer?.firstName,
          customer?.lastName,
        ]
          .filter(Boolean)
          .join(" ") ||
        address?.fullName ||
        [
          address?.firstName,
          address?.lastName,
        ]
          .filter(Boolean)
          .join(" ") ||
        "-"
    ).trim();

  const normalizedLines =
    lines.map(
      (line: any) => ({
        id:
          String(
            line?.id ||
              line?.orderLineId ||
              ""
          ),
        name:
          lineName(line),
        quantity:
          numberOrNull(
            line?.quantity
          ) || 1,
        sku:
          String(
            line?.sku ||
              line?.variant
                ?.sku ||
              ""
          ),
        variantId:
          String(
            line?.variantId ||
              line?.variant
                ?.id ||
              ""
          ),
        productId:
          String(
            line?.productId ||
              line?.product
                ?.id ||
              ""
          ),
      })
    );

  const normalizedPackages =
    packages.map(
      (
        pkg: any
      ) => ({
        id:
          String(
            pkg?.id ||
              ""
          ),
        status:
          String(
            pkg?.status ||
              ""
          ),
        trackingNumber:
          String(
            pkg
              ?.trackingNumber ||
              pkg
                ?.trackingCode ||
              pkg
                ?.cargoTrackingNumber ||
              ""
          ),
        trackingUrl:
          String(
            pkg?.trackingUrl ||
              ""
          ),
        cargoCompany:
          String(
            pkg
              ?.cargoCompany ||
              pkg
                ?.shippingCompany ||
              ""
          ),
      })
    );

  const productSummary =
    normalizedLines
      .slice(0, 2)
      .map(
        (line: any) =>
          `${line.name}${
            line.quantity > 1
              ? ` ×${line.quantity}`
              : ""
          }`
      )
      .join(", ") ||
    "Ürün detayı";

  return {
    id:
      String(
        order?.id ||
          ""
      ),
    orderNumber:
      String(
        order?.orderNumber ||
          order?.id ||
          "-"
      ),
    orderedAt:
      order?.orderedAt ||
      null,
    updatedAt:
      order?.updatedAt ||
      order
        ?.lastModifiedDate ||
      null,
    rawStatus:
      String(
        order?.status ||
          ""
      ),
    bucket:
      bucketOrder(
        order
      ),
    totalFinalPrice:
      numberOrNull(
        order
          ?.totalFinalPrice
      ) || 0,
    currencyCode:
      String(
        order?.currencyCode ||
          "TRY"
      ),
    customer: {
      name:
        customerName,
      email:
        String(
          customer?.email ||
            ""
        ),
      phone:
        String(
          customer?.phone ||
            customer
              ?.phoneNumber ||
            address?.phone ||
            address
              ?.phoneNumber ||
            ""
        ),
    },
    city:
      String(
        address?.city ||
          address?.district ||
          "-"
      ),
    lines:
      normalizedLines,
    packages:
      normalizedPackages,
    quantity:
      normalizedLines.reduce(
        (
          sum: number,
          line: any
        ) =>
          sum +
          Number(
            line.quantity ||
              0
          ),
        0
      ),
    productSummary,
    statuses:
      Array.from(
        new Set(
          collectStatuses(
            order
          )
        )
      ),
    raw:
      order,
  };
}

async function fetchOrders(
  token: string
) {
  const selection =
    await buildOrderSelection(
      token
    );

  const orders:
    any[] = [];

  for (
    let page = 0;
    page < 20;
    page += 1
  ) {
    const data =
      await ikasGraphql(
        token,
        `
          query CnetListOrders(
            $pagination: PaginationInput,
            $sort: String
          ) {
            listOrder(
              pagination: $pagination,
              sort: $sort
            ) {
              count
              hasNext
              limit
              page
              data {
                ${selection}
              }
            }
          }
        `,
        {
          pagination: {
            limit: 100,
            page,
          },
          sort:
            "-orderedAt",
        },
        45_000
      );

    const result =
      data?.listOrder;

    const rows =
      Array.isArray(
        result?.data
      )
        ? result.data
        : [];

    orders.push(
      ...rows
    );

    if (
      result?.hasNext !==
        true ||
      rows.length === 0
    ) {
      break;
    }
  }

  const normalized =
    orders.map(
      normalizeOrder
    );

  const groups = {
    new:
      normalized.filter(
        (order: any) =>
          order.bucket ===
          "new"
      ),
    ready:
      normalized.filter(
        (order: any) =>
          order.bucket ===
          "ready"
      ),
    shipped:
      normalized.filter(
        (order: any) =>
          order.bucket ===
          "shipped"
      ),
    delivered:
      normalized.filter(
        (order: any) =>
          order.bucket ===
          "delivered"
      ),
    other:
      normalized.filter(
        (order: any) =>
          order.bucket ===
          "other"
      ),
  };

  return {
    orders:
      normalized,
    groups,
    counts: {
      all:
        normalized.length,
      new:
        groups.new.length,
      ready:
        groups.ready.length,
      shipped:
        groups.shipped
          .length,
      delivered:
        groups.delivered
          .length,
      other:
        groups.other.length,
    },
  };
}

function normalizeEnum(
  value: string
) {
  return value
    .toUpperCase()
    .replace(
      /[^A-Z0-9]+/g,
      "_"
    );
}

async function enumValueForAction(
  token: string,
  enumTypeName: string,
  action: OrderAction
) {
  const type =
    await getType(
      token,
      enumTypeName
    );

  const values =
    (
      Array.isArray(
        type?.enumValues
      )
        ? type.enumValues
        : []
    )
      .map(
        (item: any) =>
          String(
            item?.name ||
              ""
          )
      )
      .filter(Boolean);

  const candidateMap:
    Record<
      OrderAction,
      string[]
    > = {
    READY: [
      "READY_FOR_SHIPMENT",
      "READY",
      "PREPARED",
      "PREPARING",
    ],
    SHIPPED: [
      "SHIPPED",
      "SENT",
      "IN_TRANSIT",
    ],
    DELIVERED: [
      "DELIVERED",
      "COMPLETED",
    ],
  };

  const candidates =
    candidateMap[action];

  for (
    const candidate of
      candidates
  ) {
    const exact =
      values.find(
        (value) =>
          normalizeEnum(
            value
          ) ===
          candidate
      );

    if (exact) {
      return exact;
    }
  }

  for (
    const candidate of
      candidates
  ) {
    const contains =
      values.find(
        (value) =>
          normalizeEnum(
            value
          ).includes(
            candidate
          )
      );

    if (contains) {
      return contains;
    }
  }

  throw new Error(
    `${enumTypeName} içinde ${action} için uygun statü bulunamadı. Mevcut: ${values.join(
      ", "
    )}`
  );
}

type BuildContext = {
  order: any;
  package: any | null;
  line: any | null;
  action: OrderAction;
  token: string;
};

async function buildInputValue(
  fieldName: string,
  fieldType: TypeRef,
  context: BuildContext,
  depth = 0
): Promise<any> {
  const unwrapped =
    unwrapType(
      fieldType
    );

  const key =
    fieldName
      .toLowerCase()
      .replace(
        /[^a-z0-9]/g,
        ""
      );

  const orderId =
    String(
      context.order?.id ||
        ""
    );

  const packageId =
    String(
      context.package
        ?.id ||
        ""
    );

  const lineId =
    String(
      context.line?.id ||
        context.line
          ?.orderLineId ||
        ""
    );

  if (
    unwrapped.kind ===
    "ENUM"
  ) {
    if (
      key.includes(
        "status"
      )
    ) {
      return enumValueForAction(
        context.token,
        unwrapped.name,
        context.action
      );
    }

    return undefined;
  }

  if (
    unwrapped.kind ===
      "SCALAR"
  ) {
    if (
      key ===
        "orderid" ||
      key ===
        "order"
    ) {
      return orderId ||
        undefined;
    }

    if (
      key.includes(
        "packageid"
      ) ||
      key.includes(
        "orderpackageid"
      )
    ) {
      return packageId ||
        undefined;
    }

    if (
      (
        key.includes(
          "orderline"
        ) ||
        key.includes(
          "lineitem"
        ) ||
        key === "lineid"
      ) &&
      key.includes("id")
    ) {
      return lineId ||
        undefined;
    }

    if (
      key === "id"
    ) {
      if (
        context.line
      ) {
        return lineId ||
          undefined;
      }

      if (
        context.package
      ) {
        return packageId ||
          undefined;
      }

      return orderId ||
        undefined;
    }

    if (
      key.includes(
        "quantity"
      )
    ) {
      return Number(
        context.line
          ?.quantity ||
          1
      );
    }

    if (
      key.includes(
        "notify"
      ) ||
      key.includes(
        "notification"
      )
    ) {
      return false;
    }

    return undefined;
  }

  if (
    unwrapped.kind ===
      "INPUT_OBJECT" &&
    depth < 4
  ) {
    const type =
      await getType(
        context.token,
        unwrapped.name
      );

    const fields =
      Array.isArray(
        type?.inputFields
      )
        ? type.inputFields
        : [];

    if (
      unwrapped.isList
    ) {
      // Satır/list item input'u ise tüm sipariş satırlarından üret.
      if (
        key.includes(
          "line"
        ) ||
        key.includes(
          "item"
        ) ||
        key.includes(
          "fulfill"
        )
      ) {
        const lines =
          Array.isArray(
            context.order
              ?.lines
          )
            ? context.order
                .lines
            : [];

        const list: any[] =
          [];

        for (
          const line of
            lines
        ) {
          const object:
            Record<
              string,
              unknown
            > = {};

          for (
            const child of
              fields
          ) {
            const value =
              await buildInputValue(
                String(
                  child.name
                ),
                child.type,
                {
                  ...context,
                  line,
                },
                depth + 1
              );

            if (
              value !==
              undefined
            ) {
              object[
                child.name
              ] = value;
            } else if (
              unwrapType(
                child.type
              ).required
            ) {
              throw new Error(
                `${unwrapped.name}.${child.name} zorunlu fakat güvenli değer üretilemedi.`
              );
            }
          }

          list.push(object);
        }

        return list;
      }

      return undefined;
    }

    const object:
      Record<
        string,
        unknown
      > = {};

    for (
      const child of
        fields
    ) {
      const value =
        await buildInputValue(
          String(
            child.name
          ),
          child.type,
          context,
          depth + 1
        );

      if (
        value !==
        undefined
      ) {
        object[
          child.name
        ] = value;
      } else if (
        unwrapType(
          child.type
        ).required
      ) {
        throw new Error(
          `${unwrapped.name}.${child.name} zorunlu fakat güvenli değer üretilemedi.`
        );
      }
    }

    return object;
  }

  return undefined;
}

async function callMutationDynamic(
  token: string,
  mutationName: string,
  order: any,
  action: OrderAction,
  pkg:
    | any
    | null
) {
  const mutation =
    await getMutationField(
      token,
      mutationName
    );

  if (!mutation) {
    throw new Error(
      `İkas şemasında ${mutationName} mutation'ı bulunamadı.`
    );
  }

  const args =
    Array.isArray(
      mutation?.args
    )
      ? mutation.args
      : [];

  const variables:
    Record<
      string,
      unknown
    > = {};

  const variableDefs:
    string[] = [];

  const callArgs:
    string[] = [];

  for (
    const arg of
      args
  ) {
    const argName =
      String(
        arg?.name ||
          ""
      );

    if (!argName) {
      continue;
    }

    const value =
      await buildInputValue(
        argName,
        arg.type,
        {
          order,
          package: pkg,
          line: null,
          action,
          token,
        }
      );

    const required =
      unwrapType(
        arg.type
      ).required;

    if (
      value ===
      undefined
    ) {
      if (required) {
        throw new Error(
          `${mutationName}.${argName} (${typeText(
            arg.type
          )}) zorunlu fakat siparişten güvenli değer üretilemedi.`
        );
      }

      continue;
    }

    variables[
      argName
    ] = value;

    variableDefs.push(
      `$${argName}: ${typeText(
        arg.type
      )}`
    );

    callArgs.push(
      `${argName}: $${argName}`
    );
  }

  const returnType =
    unwrapType(
      mutation.type
    );

  const selection =
    [
      "OBJECT",
      "INTERFACE",
      "UNION",
    ].includes(
      returnType.kind
    )
      ? "{ __typename }"
      : "";

  const query = `
    mutation CnetOrderAction(
      ${variableDefs.join(
        ", "
      )}
    ) {
      ${mutationName}(
        ${callArgs.join(
          ", "
        )}
      )
      ${selection}
    }
  `;

  await ikasGraphql(
    token,
    query,
    variables
  );
}

async function findOrderById(
  token: string,
  orderId: string
) {
  const result =
    await fetchOrders(
      token
    );

  return (
    result.orders.find(
      (order: any) =>
        String(
          order.id
        ) ===
        orderId
    ) ||
    null
  );
}

async function performAction(
  token: string,
  order: any,
  action: OrderAction
) {
  let current =
    order;

  if (
    action ===
      "READY" &&
    (
      !Array.isArray(
        current?.packages
      ) ||
      current.packages
        .length === 0
    )
  ) {
    // Yeni siparişte henüz paket yoksa fulfillment oluşturmayı dene.
    await callMutationDynamic(
      token,
      "fulfillOrder",
      current,
      action,
      null
    );

    const reread =
      await findOrderById(
        token,
        String(
          current.id
        )
      );

    if (reread) {
      current =
        reread;
    }
  }

  const packages =
    Array.isArray(
      current?.packages
    )
      ? current.packages
      : [];

  if (
    packages.length ===
    0
  ) {
    // fulfillOrder statüyü doğrudan ilerletmiş olabilir.
    const bucket =
      String(
        current?.bucket ||
          ""
      );

    if (
      (
        action ===
          "READY" &&
        [
          "ready",
          "shipped",
          "delivered",
        ].includes(
          bucket
        )
      ) ||
      (
        action ===
          "SHIPPED" &&
        [
          "shipped",
          "delivered",
        ].includes(
          bucket
        )
      ) ||
      (
        action ===
          "DELIVERED" &&
        bucket ===
          "delivered"
      )
    ) {
      return current;
    }

    throw new Error(
      "İkas sipariş paket ID'si bulunamadı. Statü güvenli şekilde değiştirilemedi."
    );
  }

  // Bir siparişte birden fazla paket varsa hepsini aynı hedefe geçir.
  for (
    const pkg of
      packages
  ) {
    await callMutationDynamic(
      token,
      "updateOrderPackageStatus",
      current,
      action,
      pkg
    );
  }

  const verified =
    await findOrderById(
      token,
      String(
        current.id
      )
    );

  if (!verified) {
    throw new Error(
      "Statü değişimi sonrası sipariş tekrar okunamadı."
    );
  }

  const bucket =
    String(
      verified.bucket ||
        ""
    );

  const accepted =
    action === "READY"
      ? [
          "ready",
          "shipped",
          "delivered",
        ].includes(
          bucket
        )
      : action ===
        "SHIPPED"
      ? [
          "shipped",
          "delivered",
        ].includes(
          bucket
        )
      : bucket ===
        "delivered";

  if (!accepted) {
    throw new Error(
      `İkas statü doğrulaması başarısız. Hedef ${action}, okunan grup ${bucket}, raw status ${verified.rawStatus || "-"}.`
    );
  }

  return verified;
}

export async function GET(
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

    const token =
      await getIkasAccessToken();

    const result =
      await fetchOrders(
        token
      );

    return noStoreJson({
      success: true,
      ...result,
      checkedAt:
        new Date().toISOString(),
      refreshSeconds: 30,
    });
  } catch (error) {
    console.error(
      "IKAS ORDERS GET ERROR:",
      error
    );

    return noStoreJson(
      {
        success: false,
        error:
          error instanceof
            Error
            ? error.message
            : "İkas siparişleri alınamadı.",
      },
      500
    );
  }
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

    const orderId =
      String(
        body.orderId ||
          ""
      ).trim();

    const action =
      String(
        body.action ||
          ""
      )
        .trim()
        .toUpperCase() as
        OrderAction;

    if (!orderId) {
      return noStoreJson(
        {
          success: false,
          error:
            "Sipariş ID zorunlu.",
        },
        400
      );
    }

    if (
      ![
        "READY",
        "SHIPPED",
        "DELIVERED",
      ].includes(action)
    ) {
      return noStoreJson(
        {
          success: false,
          error:
            "Geçersiz sipariş işlemi.",
        },
        400
      );
    }

    const token =
      await getIkasAccessToken();

    const order =
      await findOrderById(
        token,
        orderId
      );

    if (!order) {
      return noStoreJson(
        {
          success: false,
          error:
            "Sipariş İkas'ta bulunamadı.",
        },
        404
      );
    }

    const updated =
      await performAction(
        token,
        order,
        action
      );

    return noStoreJson({
      success: true,
      message:
        action === "READY"
          ? "Sipariş Kargoya Hazır durumuna geçirildi."
          : action ===
            "SHIPPED"
          ? "Sipariş Kargoda durumuna geçirildi."
          : "Sipariş Teslim Edildi durumuna geçirildi.",
      order:
        updated,
    });
  } catch (error) {
    console.error(
      "IKAS ORDER ACTION ERROR:",
      error
    );

    return noStoreJson(
      {
        success: false,
        error:
          error instanceof
            Error
            ? error.message
            : "İkas sipariş işlemi yapılamadı.",
      },
      409
    );
  }
}
