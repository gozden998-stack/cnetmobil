"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

type MainSection =
  | "orders"
  | "open"
  | "closed";

type OrderSection =
  | "new"
  | "ready"
  | "shipped"
  | "delivered"
  | "other";

type InventoryState = {
  loading: boolean;
  success: boolean;
  error: string;
  data: any;
};

type IkasOrder = {
  id: string;
  orderNumber: string;
  orderedAt: string | null;
  updatedAt: string | null;
  rawStatus: string;
  operationalStatus?: string;
  bucket: string;
  totalFinalPrice: number;
  currencyCode: string;
  customer: {
    name: string;
    email: string;
    phone: string;
  };
  city: string;
  quantity: number;
  productSummary: string;
  lines: any[];
  packages: any[];
  statuses: string[];
};

type OrdersResponse = {
  success: boolean;
  error?: string;
  counts?: {
    all: number;
    new: number;
    ready: number;
    shipped: number;
    delivered: number;
    other: number;
  };
  groups?: {
    new: IkasOrder[];
    ready: IkasOrder[];
    shipped: IkasOrder[];
    delivered: IkasOrder[];
    other: IkasOrder[];
  };
  checkedAt?: string;
};

type PriceEditTarget = {
  productId: string;
  productName: string;
  variantId: string;
  variantName: string;
  salePrice: string;
  listPrice: string;
};

function money(
  value: unknown
) {
  const number =
    Number(value);

  if (
    !Number.isFinite(
      number
    )
  ) {
    return "-";
  }

  return new Intl.NumberFormat(
    "tr-TR",
    {
      style: "currency",
      currency: "TRY",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  ).format(number);
}

function dateTime(
  value: unknown
) {
  if (!value) {
    return "—";
  }

  const raw =
    String(
      value
    ).trim();

  const numeric =
    /^\d+$/.test(
      raw
    )
      ? Number(raw)
      : NaN;

  const date =
    Number.isFinite(
      numeric
    )
      ? new Date(
          numeric <
            10_000_000_000
            ? numeric * 1000
            : numeric
        )
      : new Date(raw);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "tr-TR",
    {
      dateStyle: "short",
      timeStyle: "short",
    }
  ).format(date);
}

function productStock(
  product: any
) {
  const direct =
    Number(
      product?.totalStock
    );

  if (
    Number.isFinite(
      direct
    )
  ) {
    return direct;
  }

  const variants =
    Array.isArray(
      product?.variants
    )
      ? product.variants
      : [];

  return variants.reduce(
    (
      sum: number,
      variant: any
    ) =>
      sum +
      Number(
        variant?.stockCount ||
          0
      ),
    0
  );
}

function variantPrice(
  variant: any
) {
  const prices =
    Array.isArray(
      variant?.prices
    )
      ? variant.prices
      : [];

  const first =
    prices.find(
      (price: any) =>
        price?.priceListId ===
          null ||
        price?.priceListId ===
          undefined
    ) ||
    prices[0] ||
    null;

  const list =
    Number(
      first?.sellPrice ||
        0
    );

  const discount =
    Number(
      first?.discountPrice ||
        0
    );

  return {
    listPrice:
      Number.isFinite(
        list
      )
        ? list
        : 0,
    salePrice:
      Number.isFinite(
        discount
      ) &&
      discount > 0
        ? discount
        : Number.isFinite(
            list
          )
        ? list
        : 0,
  };
}

function variantLabel(
  variant: any
) {
  const values =
    Array.isArray(
      variant?.variantValues
    )
      ? variant.variantValues
      : [];

  const names =
    values
      .map(
        (item: any) =>
          String(
            item?.variantValueName ||
              item?.value ||
              ""
          ).trim()
      )
      .filter(Boolean);

  return (
    names.join(" / ") ||
    "Standart"
  );
}

function locationNames(
  variant: any
) {
  const stocks =
    Array.isArray(
      variant?.stocks
    )
      ? variant.stocks
      : [];

  const names =
    stocks
      .filter(
        (stock: any) =>
          Number(
            stock?.stockCount ||
              0
          ) > 0
      )
      .map(
        (stock: any) =>
          String(
            stock
              ?.stockLocationName ||
              stock
                ?.stockLocationId ||
              ""
          )
      )
      .filter(Boolean);

  return (
    Array.from(
      new Set(names)
    ).join(", ") ||
    "Ana Depo"
  );
}

function orderMeta(
  section: OrderSection
) {
  if (
    section === "new"
  ) {
    return {
      label:
        "Yeni Sipariş",
      className:
        "bg-blue-50 text-blue-700 ring-blue-100",
      button:
        "Kargoya Hazır",
      action:
        "READY",
    };
  }

  if (
    section === "ready"
  ) {
    return {
      label:
        "Kargoya Hazır",
      className:
        "bg-amber-50 text-amber-700 ring-amber-100",
      button:
        "Kargoya Ver",
      action:
        "SHIPPED",
    };
  }

  if (
    section ===
    "shipped"
  ) {
    return {
      label:
        "Kargoda",
      className:
        "bg-violet-50 text-violet-700 ring-violet-100",
      button:
        "Teslim Edildi",
      action:
        "DELIVERED",
    };
  }

  if (
    section ===
    "delivered"
  ) {
    return {
      label:
        "Teslim Edildi",
      className:
        "bg-emerald-50 text-emerald-700 ring-emerald-100",
      button: "",
      action: "",
    };
  }

  return {
    label:
      "İade / İptal",
    className:
      "bg-rose-50 text-rose-700 ring-rose-100",
    button: "",
    action: "",
  };
}

export default function Ikas() {
  const [
    inventory,
    setInventory,
  ] = useState<InventoryState>({
    loading: true,
    success: false,
    error: "",
    data: null,
  });

  const [
    orders,
    setOrders,
  ] = useState<OrdersResponse | null>(
    null
  );

  const [
    ordersLoading,
    setOrdersLoading,
  ] = useState(true);

  const [
    ordersError,
    setOrdersError,
  ] = useState("");

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const [
    mainSection,
    setMainSection,
  ] = useState<MainSection>(
    "open"
  );

  const [
    orderSection,
    setOrderSection,
  ] = useState<OrderSection>(
    "new"
  );

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    expandedProductId,
    setExpandedProductId,
  ] = useState<
    string | null
  >(null);

  const [
    stockDrafts,
    setStockDrafts,
  ] = useState<
    Record<string, string>
  >({});

  const [
    stockBusyId,
    setStockBusyId,
  ] = useState<
    string | null
  >(null);

  const [
    stockMessage,
    setStockMessage,
  ] = useState<{
    type:
      | "success"
      | "error";
    text: string;
  } | null>(null);

  const [
    priceTarget,
    setPriceTarget,
  ] = useState<
    PriceEditTarget | null
  >(null);

  const [
    priceSaving,
    setPriceSaving,
  ] = useState(false);

  const [
    priceError,
    setPriceError,
  ] = useState("");

  const [
    priceSuccess,
    setPriceSuccess,
  ] = useState("");

  const [
    orderActionId,
    setOrderActionId,
  ] = useState("");

  const [
    orderMessage,
    setOrderMessage,
  ] = useState("");

  const loadInventory =
    useCallback(
      async (
        silent = false
      ) => {
        if (!silent) {
          setInventory(
            (current) => ({
              ...current,
              loading: true,
              error: "",
            })
          );
        }

        try {
          const response =
            await fetch(
              "/api/online/ikas/inventory",
              {
                method: "GET",
                cache:
                  "no-store",
              }
            );

          const raw =
            await response.text();

          let payload:
            any = null;

          try {
            payload =
              raw
                ? JSON.parse(
                    raw
                  )
                : null;
          } catch {
            throw new Error(
              `İkas stok API JSON dönmedi. HTTP ${response.status}.`
            );
          }

          if (
            !response.ok ||
            !payload?.success
          ) {
            throw new Error(
              payload?.error ||
                "İkas stoğu okunamadı."
            );
          }

          setInventory({
            loading: false,
            success: true,
            error: "",
            data:
              payload,
          });
        } catch (error) {
          setInventory(
            (current) => ({
              ...current,
              loading: false,
              error:
                error instanceof
                  Error
                  ? error.message
                  : "İkas stoğu okunamadı.",
            })
          );
        }
      },
      []
    );

  const loadOrders =
    useCallback(
      async (
        silent = false
      ) => {
        if (!silent) {
          setOrdersLoading(
            true
          );
        }

        setOrdersError("");

        try {
          const response =
            await fetch(
              "/api/online/ikas/orders",
              {
                method: "GET",
                cache:
                  "no-store",
                credentials:
                  "same-origin",
              }
            );

          const raw =
            await response.text();

          let payload:
            OrdersResponse | null =
              null;

          try {
            payload =
              raw
                ? JSON.parse(
                    raw
                  )
                : null;
          } catch {
            throw new Error(
              `İkas sipariş API JSON dönmedi. HTTP ${response.status}.`
            );
          }

          if (
            !response.ok ||
            !payload?.success
          ) {
            throw new Error(
              payload?.error ||
                "İkas siparişleri alınamadı."
            );
          }

          setOrders(
            payload
          );
        } catch (error) {
          setOrdersError(
            error instanceof
              Error
              ? error.message
              : "İkas siparişleri alınamadı."
          );
        } finally {
          setOrdersLoading(
            false
          );
        }
      },
      []
    );

  const refreshAll =
    useCallback(
      async () => {
        if (refreshing) {
          return;
        }

        setRefreshing(true);

        try {
          await Promise.all([
            loadInventory(
              true
            ),
            loadOrders(
              true
            ),
          ]);
        } finally {
          setRefreshing(
            false
          );
        }
      },
      [
        refreshing,
        loadInventory,
        loadOrders,
      ]
    );

  useEffect(() => {
    void Promise.all([
      loadInventory(),
      loadOrders(),
    ]);
  }, [
    loadInventory,
    loadOrders,
  ]);

  useEffect(() => {
    const inventoryTimer =
      window.setInterval(
        () => {
          void loadInventory(
            true
          );
        },
        60_000
      );

    const orderTimer =
      window.setInterval(
        () => {
          void loadOrders(
            true
          );
        },
        30_000
      );

    return () => {
      window.clearInterval(
        inventoryTimer
      );
      window.clearInterval(
        orderTimer
      );
    };
  }, [
    loadInventory,
    loadOrders,
  ]);

  const renewedProducts =
    useMemo(
      () =>
        Array.isArray(
          inventory.data
            ?.renewedProducts
        )
          ? inventory.data
              .renewedProducts
          : [],
      [inventory.data]
    );

  const variantRows =
    useMemo(
      () =>
        renewedProducts.flatMap(
          (product: any) =>
            (
              Array.isArray(
                product?.variants
              )
                ? product.variants
                : []
            ).map(
              (variant: any) => ({
                product,
                variant,
              })
            )
        ),
      [renewedProducts]
    );

  const openVariantCount =
    variantRows.filter(
      (row: any) =>
        Number(
          row?.variant
            ?.stockCount ||
            0
        ) > 0
    ).length;

  const closedVariantCount =
    variantRows.length -
    openVariantCount;

  const physicalStock =
    renewedProducts.reduce(
      (
        sum: number,
        product: any
      ) =>
        sum +
        productStock(
          product
        ),
      0
    );

  const averageSalePrice =
    useMemo(() => {
      const values =
        variantRows
          .filter(
            (row: any) =>
              Number(
                row?.variant
                  ?.stockCount ||
                  0
              ) > 0
          )
          .map(
            (row: any) =>
              variantPrice(
                row.variant
              ).salePrice
          )
          .filter(
            (
              value: number
            ) =>
              Number.isFinite(
                value
              ) &&
              value > 0
          );

      if (
        values.length === 0
      ) {
        return 0;
      }

      return (
        values.reduce(
          (
            sum: number,
            value: number
          ) =>
            sum +
            value,
          0
        ) /
        values.length
      );
    }, [
      variantRows,
    ]);

  const visibleProducts =
    useMemo(() => {
      const q =
        search
          .trim()
          .toLocaleLowerCase(
            "tr-TR"
          );

      return renewedProducts
        .map(
          (product: any) => {
            const productVariants =
              Array.isArray(
                product?.variants
              )
                ? product.variants
                : [];

            const matchingVariants =
              productVariants.filter(
                (variant: any) => {
                  const stock =
                    Number(
                      variant
                        ?.stockCount ||
                        0
                    );

                  if (
                    mainSection ===
                      "open" &&
                    stock <= 0
                  ) {
                    return false;
                  }

                  if (
                    mainSection ===
                      "closed" &&
                    stock > 0
                  ) {
                    return false;
                  }

                  if (!q) {
                    return true;
                  }

                  const text = [
                    product?.name,
                    product?.brand
                      ?.name,
                    variant?.sku,
                    variantLabel(
                      variant
                    ),
                  ]
                    .join(" ")
                    .toLocaleLowerCase(
                      "tr-TR"
                    );

                  return text.includes(
                    q
                  );
                }
              );

            if (
              matchingVariants
                .length === 0
            ) {
              return null;
            }

            return {
              ...product,
              variants:
                matchingVariants,
            };
          }
        )
        .filter(Boolean);
    }, [
      renewedProducts,
      search,
      mainSection,
    ]);

  const currentOrders =
    useMemo(
      () =>
        orders?.groups?.[
          orderSection
        ] || [],
      [
        orders,
        orderSection,
      ]
    );

  const newOrderCount =
    orders?.counts?.new ||
    0;

  const openPriceEditor =
    useCallback(
      (
        product: any,
        variant: any
      ) => {
        const price =
          variantPrice(
            variant
          );

        setPriceError("");
        setPriceSuccess("");
        setPriceTarget({
          productId:
            String(
              product?.id ||
                ""
            ),
          productName:
            String(
              product?.name ||
                "İkas Ürünü"
            ),
          variantId:
            String(
              variant?.id ||
                ""
            ),
          variantName:
            variantLabel(
              variant
            ),
          salePrice:
            price.salePrice >
            0
              ? String(
                  price.salePrice
                )
              : "",
          listPrice:
            price.listPrice >
            0
              ? String(
                  price.listPrice
                )
              : "",
        });
      },
      []
    );

  const savePrice =
    useCallback(
      async () => {
        if (
          !priceTarget ||
          priceSaving
        ) {
          return;
        }

        setPriceSaving(true);
        setPriceError("");
        setPriceSuccess("");

        try {
          const response =
            await fetch(
              "/api/online/ikas/variant-price",
              {
                method:
                  "POST",
                cache:
                  "no-store",
                credentials:
                  "same-origin",
                headers: {
                  "Content-Type":
                    "application/json",
                },
                body:
                  JSON.stringify({
                    productId:
                      priceTarget.productId,
                    variantId:
                      priceTarget.variantId,
                    salePrice:
                      priceTarget.salePrice,
                    listPrice:
                      priceTarget.listPrice,
                  }),
              }
            );

          const raw =
            await response.text();

          let payload:
            any = null;

          try {
            payload =
              raw
                ? JSON.parse(
                    raw
                  )
                : null;
          } catch {
            throw new Error(
              `İkas fiyat API JSON dönmedi. HTTP ${response.status}.`
            );
          }

          if (
            !response.ok ||
            !payload?.success
          ) {
            throw new Error(
              payload?.error ||
                "İkas fiyatı güncellenemedi."
            );
          }

          setPriceSuccess(
            "Fiyat İkas'a yazıldı ve doğrulandı."
          );

          await loadInventory(
            true
          );
        } catch (error) {
          setPriceError(
            error instanceof
              Error
              ? error.message
              : "İkas fiyatı güncellenemedi."
          );
        } finally {
          setPriceSaving(
            false
          );
        }
      },
      [
        priceTarget,
        priceSaving,
        loadInventory,
      ]
    );

  const runStockAction =
    useCallback(
      async (
        productId: string,
        variantId: string,
        action:
          | "decrement"
          | "zero"
          | "set",
        currentQuantity: number
      ) => {
        const key =
          `${productId}:${variantId}`;

        setStockBusyId(key);
        setStockMessage(
          null
        );

        try {
          const body: any = {
            productId,
            variantId,
            action,
          };

          if (
            action === "set"
          ) {
            const quantity =
              Number(
                stockDrafts[
                  key
                ] ??
                  currentQuantity
              );

            if (
              !Number.isInteger(
                quantity
              ) ||
              quantity < 0
            ) {
              throw new Error(
                "Stok 0 veya daha büyük tam sayı olmalı."
              );
            }

            if (
              quantity >
              currentQuantity
            ) {
              throw new Error(
                "Stok artırma IMEI girişi üzerinden yapılır."
              );
            }

            body.quantity =
              quantity;
          }

          const response =
            await fetch(
              "/api/online/ikas/variant-stock",
              {
                method:
                  "POST",
                cache:
                  "no-store",
                headers: {
                  "Content-Type":
                    "application/json",
                },
                body:
                  JSON.stringify(
                    body
                  ),
              }
            );

          const raw =
            await response.text();

          let payload:
            any = null;

          try {
            payload =
              raw
                ? JSON.parse(
                    raw
                  )
                : null;
          } catch {
            throw new Error(
              `İkas stok API JSON dönmedi. HTTP ${response.status}.`
            );
          }

          if (
            !response.ok ||
            !payload?.success
          ) {
            throw new Error(
              payload?.error ||
                "İkas stok işlemi başarısız."
            );
          }

          setStockMessage({
            type:
              "success",
            text:
              payload?.message ||
              `Stok ${payload?.quantity ?? 0} olarak güncellendi.`,
          });

          await loadInventory(
            true
          );
        } catch (error) {
          setStockMessage({
            type:
              "error",
            text:
              error instanceof
                Error
                ? error.message
                : "İkas stok işlemi başarısız.",
          });
        } finally {
          setStockBusyId(
            null
          );
        }
      },
      [
        stockDrafts,
        loadInventory,
      ]
    );

  const runOrderAction =
    useCallback(
      async (
        order: IkasOrder
      ) => {
        const meta =
          orderMeta(
            orderSection
          );

        if (
          !meta.action
        ) {
          return;
        }

        if (
          !window.confirm(
            `${order.orderNumber} siparişi "${meta.button}" durumuna geçirilsin mi?`
          )
        ) {
          return;
        }

        setOrderActionId(
          order.id
        );
        setOrdersError("");
        setOrderMessage("");

        try {
          const response =
            await fetch(
              "/api/online/ikas/orders",
              {
                method:
                  "POST",
                cache:
                  "no-store",
                credentials:
                  "same-origin",
                headers: {
                  "Content-Type":
                    "application/json",
                },
                body:
                  JSON.stringify({
                    orderId:
                      order.id,
                    action:
                      meta.action,
                  }),
              }
            );

          const raw =
            await response.text();

          let payload:
            any = null;

          try {
            payload =
              raw
                ? JSON.parse(
                    raw
                  )
                : null;
          } catch {
            throw new Error(
              `İkas sipariş API JSON dönmedi. HTTP ${response.status}.`
            );
          }

          if (
            !response.ok ||
            !payload?.success
          ) {
            throw new Error(
              payload?.error ||
                "Sipariş durumu değiştirilemedi."
            );
          }

          setOrderMessage(
            payload?.message ||
              "Sipariş durumu güncellendi."
          );

          await loadOrders(
            true
          );
        } catch (error) {
          setOrdersError(
            error instanceof
              Error
              ? error.message
              : "Sipariş durumu değiştirilemedi."
          );
        } finally {
          setOrderActionId(
            ""
          );
        }
      },
      [
        orderSection,
        loadOrders,
      ]
    );

  if (
    inventory.loading &&
    !inventory.success &&
    ordersLoading &&
    !orders
  ) {
    return (
      <div className="flex min-h-[420px] items-center justify-center">
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-5 text-sm font-black text-slate-600 shadow-sm">
          İkas verileri yükleniyor...
        </div>
      </div>
    );
  }

  const lastSync =
    orders?.checkedAt ||
    inventory.data
      ?.checkedAt ||
    inventory.data
      ?.updatedAt ||
    null;

  const meta =
    orderMeta(
      orderSection
    );

  return (
    <div className="w-full animate-in fade-in duration-300">
      <div className="space-y-4">
        <section className="rounded-[26px] border border-slate-200/80 bg-white p-4 shadow-[0_12px_36px_rgba(15,23,42,0.06)]">
          <div className="overflow-hidden rounded-[22px] border border-violet-100 bg-gradient-to-r from-white via-violet-50/25 to-indigo-100/60">
            <div className="flex flex-col gap-5 px-5 py-5 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex min-w-0 items-center gap-4">
                <div className="flex h-[86px] w-[86px] shrink-0 items-center justify-center rounded-[22px] border border-violet-100 bg-white/90 shadow-sm">
                  <span className="text-[34px] font-black tracking-[-0.08em] text-violet-700">
                    ikas
                  </span>
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-[25px] font-black tracking-[-0.03em] text-slate-950">
                      İkas Entegrasyonu
                    </h2>

                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-black text-emerald-700 ring-1 ring-emerald-200">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      API Bağlı
                    </span>
                  </div>

                  <p className="mt-1.5 max-w-2xl text-[12px] font-semibold leading-5 text-slate-500">
                    İkas mağazanızdaki ürün, fiyat, stok ve sipariş süreçlerini tek panelden yönetin.
                  </p>

                  <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] font-bold text-slate-500">
                    <span>
                      Kanal:{" "}
                      <b className="text-slate-800">
                        İkas
                      </b>
                    </span>

                    <span className="text-slate-300">
                      •
                    </span>

                    <span>
                      Son Senkronizasyon:{" "}
                      <b className="text-slate-800">
                        {dateTime(
                          lastSync
                        )}
                      </b>
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    void refreshAll();
                  }}
                  disabled={
                    refreshing
                  }
                  className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-[10px] font-black uppercase tracking-wide text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
                >
                  {refreshing
                    ? "Yenileniyor..."
                    : "Yenile"}
                </button>
              </div>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
            <div className="rounded-[18px] border border-blue-100 bg-white px-4 py-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-lg text-blue-700">
                  ◇
                </div>
                <div>
                  <div className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                    Toplam İkas Ürünü
                  </div>
                  <div className="mt-1 text-[22px] font-black tracking-tight text-slate-950">
                    {
                      renewedProducts.length
                    }
                  </div>
                  <div className="text-[10px] font-semibold text-slate-400">
                    Yenilenmiş ürün kartı
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[18px] border border-emerald-100 bg-white px-4 py-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-lg">
                  🛒
                </div>
                <div>
                  <div className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                    Siparişler
                  </div>
                  <div className="mt-1 text-[22px] font-black tracking-tight text-slate-950">
                    {ordersLoading &&
                    !orders
                      ? "…"
                      : newOrderCount}
                  </div>
                  <div className="text-[10px] font-semibold text-slate-400">
                    Yeni İkas siparişi
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[18px] border border-cyan-100 bg-white px-4 py-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-50 text-lg text-cyan-700">
                  ◎
                </div>
                <div>
                  <div className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                    Satıştaki Varyant
                  </div>
                  <div className="mt-1 text-[22px] font-black tracking-tight text-slate-950">
                    {
                      openVariantCount
                    }
                  </div>
                  <div className="text-[10px] font-semibold text-slate-400">
                    Stoğu bulunan varyant
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[18px] border border-emerald-100 bg-white px-4 py-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-lg text-emerald-700">
                  ◉
                </div>
                <div>
                  <div className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                    Fiziksel Stok
                  </div>
                  <div className="mt-1 text-[22px] font-black tracking-tight text-slate-950">
                    {
                      physicalStock
                    }
                  </div>
                  <div className="text-[10px] font-semibold text-slate-400">
                    İkas toplam cihaz stoğu
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[18px] border border-violet-100 bg-white px-4 py-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-50 text-lg text-violet-700">
                  ₺
                </div>
                <div>
                  <div className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                    Ortalama Fiyat
                  </div>
                  <div className="mt-1 text-[22px] font-black tracking-tight text-slate-950">
                    {money(
                      averageSalePrice
                    )}
                  </div>
                  <div className="text-[10px] font-semibold text-slate-400">
                    Stoklu İkas varyantları
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-[16px] border border-slate-100 bg-slate-50/70 px-4 py-2.5">
            <div className="flex flex-wrap items-center gap-3 text-[10px] font-semibold text-slate-500">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 font-black text-emerald-700">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                AKTİF
              </span>
              <span>
                Kanal: İKAS
              </span>
              <span>
                Entegratör: CNETMOBİL
              </span>
              <span>
                Stok/Fiyat: 60 sn
              </span>
              <span>
                Yeni Sipariş: 30 sn
              </span>
            </div>

            <div className="text-[10px] font-bold text-slate-500">
              Fiziksel aktif stok:{" "}
              <b className="text-slate-800">
                {
                  physicalStock
                }
              </b>
            </div>
          </div>
        </section>

        {inventory.error ? (
          <section className="rounded-[20px] border border-red-200 bg-red-50 px-5 py-4 text-[11px] font-bold text-red-700">
            {inventory.error}
          </section>
        ) : null}

        {ordersError ? (
          <section className="rounded-[20px] border border-red-200 bg-red-50 px-5 py-4 text-[11px] font-bold text-red-700">
            {ordersError}
          </section>
        ) : null}

        {stockMessage ? (
          <section
            className={`rounded-[20px] border px-5 py-4 text-[11px] font-bold ${
              stockMessage.type ===
              "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            {stockMessage.text}
          </section>
        ) : null}

        {orderMessage ? (
          <section className="rounded-[20px] border border-emerald-200 bg-emerald-50 px-5 py-4 text-[11px] font-bold text-emerald-700">
            ✓ {orderMessage}
          </section>
        ) : null}

        <section className="overflow-hidden rounded-[24px] border border-slate-200/80 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
          <div className="border-b border-slate-100 px-4 py-3">
            <div className="flex flex-col gap-3 2xl:flex-row 2xl:items-center 2xl:justify-between">
              <div className="flex flex-wrap items-center gap-1">
                <button
                  type="button"
                  onClick={() =>
                    setMainSection(
                      "orders"
                    )
                  }
                  className={`rounded-xl px-4 py-2.5 text-[11px] font-black transition ${
                    mainSection ===
                    "orders"
                      ? "bg-violet-50 text-violet-700 ring-1 ring-violet-200"
                      : "text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  Siparişler (
                  {
                    newOrderCount
                  })
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setMainSection(
                      "open"
                    )
                  }
                  className={`rounded-xl px-4 py-2.5 text-[11px] font-black transition ${
                    mainSection ===
                    "open"
                      ? "bg-blue-50 text-blue-700 ring-1 ring-blue-200"
                      : "text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  Satışa Açık (
                  {
                    openVariantCount
                  } varyant ·{" "}
                  {
                    physicalStock
                  } cihaz)
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setMainSection(
                      "closed"
                    )
                  }
                  className={`rounded-xl px-4 py-2.5 text-[11px] font-black transition ${
                    mainSection ===
                    "closed"
                      ? "bg-red-50 text-red-700 ring-1 ring-red-200"
                      : "text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  Satışa Kapalı (
                  {
                    closedVariantCount
                  })
                </button>
              </div>

              {mainSection !==
              "orders" ? (
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    value={
                      search
                    }
                    onChange={(event) =>
                      setSearch(
                        event.target.value
                      )
                    }
                    placeholder="Ürün, renk veya SKU ara..."
                    className="h-10 w-[280px] max-w-full rounded-xl border border-slate-200 bg-white px-4 text-[10px] font-bold text-slate-700 outline-none focus:border-violet-300"
                  />
                </div>
              ) : null}
            </div>
          </div>

          {mainSection ===
          "orders" ? (
            <div>
              <div className="border-b border-slate-100 bg-slate-50/70 px-4 py-3">
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      [
                        "new",
                        "Yeni Siparişler",
                        orders
                          ?.counts
                          ?.new || 0,
                      ],
                      [
                        "ready",
                        "Kargoya Hazır",
                        orders
                          ?.counts
                          ?.ready || 0,
                      ],
                      [
                        "shipped",
                        "Kargoda",
                        orders
                          ?.counts
                          ?.shipped || 0,
                      ],
                      [
                        "delivered",
                        "Teslim Edildi",
                        orders
                          ?.counts
                          ?.delivered || 0,
                      ],
                      [
                        "other",
                        "İade / İptal",
                        orders
                          ?.counts
                          ?.other || 0,
                      ],
                    ] as Array<
                      [
                        OrderSection,
                        string,
                        number
                      ]
                    >
                  ).map(
                    ([
                      id,
                      label,
                      count,
                    ]) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() =>
                          setOrderSection(
                            id
                          )
                        }
                        className={`rounded-xl px-3.5 py-2 text-[9px] font-black uppercase transition ${
                          orderSection ===
                          id
                            ? id ===
                              "new"
                              ? "bg-blue-600 text-white"
                              : id ===
                                "ready"
                              ? "bg-amber-500 text-white"
                              : id ===
                                "shipped"
                              ? "bg-violet-600 text-white"
                              : id ===
                                "delivered"
                              ? "bg-emerald-600 text-white"
                              : "bg-rose-600 text-white"
                            : "border border-slate-200 bg-white text-slate-600"
                        }`}
                      >
                        {label} (
                        {count})
                      </button>
                    )
                  )}

                  <div className="ml-auto self-center text-[8px] font-bold text-slate-400">
                    Canlı kontrol:
                    30 sn
                  </div>
                </div>
              </div>

              {ordersLoading &&
              !orders ? (
                <div className="px-6 py-16 text-center text-[11px] font-black text-slate-500">
                  İkas siparişleri yükleniyor...
                </div>
              ) : currentOrders
                  .length === 0 ? (
                <div className="px-6 py-16 text-center">
                  <div className="text-[12px] font-black text-slate-700">
                    {
                      meta.label
                    } siparişi yok
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <div className="min-w-[1120px]">
                    <div className="grid grid-cols-[130px_150px_minmax(280px,1fr)_70px_120px_100px_140px_130px] gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3 text-[7px] font-black uppercase tracking-wide text-slate-400">
                      <div>
                        Sipariş No
                      </div>
                      <div>
                        Müşteri
                      </div>
                      <div>
                        Ürün
                      </div>
                      <div>
                        Adet
                      </div>
                      <div>
                        Tutar
                      </div>
                      <div>
                        Şehir
                      </div>
                      <div>
                        Durum
                      </div>
                      <div>
                        İşlem
                      </div>
                    </div>

                    {currentOrders.map(
                      (
                        order
                      ) => (
                        <div
                          key={
                            order.id
                          }
                          className="grid min-h-[72px] grid-cols-[130px_150px_minmax(280px,1fr)_70px_120px_100px_140px_130px] items-center gap-3 border-b border-slate-100 px-4 py-3 text-[8px] last:border-0 hover:bg-slate-50/60"
                        >
                          <div>
                            <div className="font-black text-slate-900">
                              {
                                order.orderNumber
                              }
                            </div>
                            <div className="mt-1 text-[7px] font-bold text-slate-400">
                              {dateTime(
                                order.orderedAt
                              )}
                            </div>
                          </div>

                          <div>
                            <div className="truncate font-black text-slate-800">
                              {order
                                .customer
                                ?.name ||
                                "-"}
                            </div>
                            <div className="mt-1 truncate text-[7px] font-bold text-slate-400">
                              {order
                                .customer
                                ?.phone ||
                                order
                                  .customer
                                  ?.email ||
                                "-"}
                            </div>
                          </div>

                          <div>
                            <div className="font-black text-slate-800">
                              {
                                order.productSummary
                              }
                            </div>

                            {order
                              .packages
                              ?.some(
                                (
                                  pkg: any
                                ) =>
                                  pkg
                                    ?.trackingNumber
                              ) ? (
                              <div className="mt-1 text-[7px] font-bold text-violet-600">
                                Takip:{" "}
                                {order.packages
                                  .map(
                                    (
                                      pkg: any
                                    ) =>
                                      pkg
                                        ?.trackingNumber
                                  )
                                  .filter(
                                    Boolean
                                  )
                                  .join(
                                    ", "
                                  )}
                              </div>
                            ) : null}
                          </div>

                          <div className="font-black text-slate-900">
                            {order.quantity ||
                              1}
                          </div>

                          <div className="font-black text-slate-900">
                            {money(
                              order.totalFinalPrice
                            )}
                          </div>

                          <div className="truncate font-bold text-slate-500">
                            {order.city ||
                              "-"}
                          </div>

                          <div>
                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-[7px] font-black uppercase ring-1 ${meta.className}`}
                            >
                              {
                                meta.label
                              }
                            </span>

                            {(order.operationalStatus ||
                              order.rawStatus) ? (
                              <div className="mt-1 max-w-[130px] truncate text-[6px] font-bold text-slate-400">
                                {order.operationalStatus ||
                                  order.rawStatus}
                              </div>
                            ) : null}
                          </div>

                          <div>
                            {meta.action ? (
                              <button
                                type="button"
                                onClick={() => {
                                  void runOrderAction(
                                    order
                                  );
                                }}
                                disabled={
                                  orderActionId ===
                                  order.id
                                }
                                className="h-9 rounded-xl bg-violet-600 px-3 text-[7px] font-black uppercase text-white transition hover:bg-violet-700 disabled:opacity-50"
                              >
                                {orderActionId ===
                                order.id
                                  ? "İşleniyor..."
                                  : meta.button}
                              </button>
                            ) : (
                              <span className="text-[8px] font-bold text-slate-400">
                                Tamamlandı
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div>
              {visibleProducts.length ===
              0 ? (
                <div className="px-6 py-16 text-center">
                  <div className="text-[12px] font-black text-slate-700">
                    Bu bölümde ürün bulunamadı
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {visibleProducts.map(
                    (
                      product: any
                    ) => {
                      const expanded =
                        expandedProductId ===
                        String(
                          product?.id
                        );

                      const productVariants =
                        Array.isArray(
                          product?.variants
                        )
                          ? product.variants
                          : [];

                      const stock =
                        productVariants.reduce(
                          (
                            sum: number,
                            variant: any
                          ) =>
                            sum +
                            Number(
                              variant
                                ?.stockCount ||
                                0
                            ),
                          0
                        );

                      return (
                        <div
                          key={
                            product?.id
                          }
                          className="px-4 py-3"
                        >
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedProductId(
                                expanded
                                  ? null
                                  : String(
                                      product?.id
                                    )
                              )
                            }
                            className="grid w-full grid-cols-[minmax(320px,1fr)_120px_130px_130px_80px] items-center gap-3 rounded-[16px] px-3 py-3 text-left transition hover:bg-slate-50"
                          >
                            <div>
                              <div className="font-black text-slate-900">
                                {String(
                                  product
                                    ?.name ||
                                    "-"
                                )}
                              </div>
                              <div className="mt-1 text-[8px] font-bold text-slate-400">
                                {String(
                                  product
                                    ?.brand
                                    ?.name ||
                                    ""
                                )}{" "}
                                ·{" "}
                                {
                                  productVariants.length
                                }{" "}
                                varyant
                              </div>
                            </div>

                            <div>
                              <div className="text-[7px] font-black uppercase text-slate-400">
                                Stok
                              </div>
                              <div className="mt-1 text-[11px] font-black text-slate-900">
                                {stock} adet
                              </div>
                            </div>

                            <div>
                              <div className="text-[7px] font-black uppercase text-slate-400">
                                Satış
                              </div>
                              <div className="mt-1 text-[9px] font-black text-slate-800">
                                {money(
                                  productVariants
                                    .length >
                                    0
                                    ? variantPrice(
                                        productVariants[0]
                                      )
                                        .salePrice
                                    : 0
                                )}
                              </div>
                            </div>

                            <div>
                              <div className="text-[7px] font-black uppercase text-slate-400">
                                Liste
                              </div>
                              <div className="mt-1 text-[9px] font-black text-slate-800">
                                {money(
                                  productVariants
                                    .length >
                                    0
                                    ? variantPrice(
                                        productVariants[0]
                                      )
                                        .listPrice
                                    : 0
                                )}
                              </div>
                            </div>

                            <div className="text-right text-[16px] font-black text-slate-400">
                              {expanded
                                ? "−"
                                : "+"}
                            </div>
                          </button>

                          {expanded ? (
                            <div className="mt-3 overflow-x-auto rounded-[16px] border border-slate-200">
                              <div className="min-w-[1080px]">
                                <div className="grid grid-cols-[200px_110px_130px_130px_minmax(120px,1fr)_390px] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 text-[7px] font-black uppercase tracking-wide text-slate-400">
                                  <div>
                                    Varyant
                                  </div>
                                  <div>
                                    Stok
                                  </div>
                                  <div>
                                    Satış
                                  </div>
                                  <div>
                                    Liste
                                  </div>
                                  <div>
                                    Lokasyon
                                  </div>
                                  <div>
                                    İşlem
                                  </div>
                                </div>

                                {productVariants.map(
                                  (
                                    variant: any
                                  ) => {
                                    const key =
                                      `${product?.id}:${variant?.id}`;

                                    const quantity =
                                      Number(
                                        variant
                                          ?.stockCount ||
                                          0
                                      );

                                    const price =
                                      variantPrice(
                                        variant
                                      );

                                    return (
                                      <div
                                        key={
                                          variant?.id
                                        }
                                        className="grid grid-cols-[200px_110px_130px_130px_minmax(120px,1fr)_390px] items-center gap-3 border-b border-slate-100 px-4 py-3 text-[8px] last:border-0"
                                      >
                                        <div>
                                          <div className="font-black text-slate-900">
                                            {variantLabel(
                                              variant
                                            )}
                                          </div>
                                          <div className="mt-1 truncate font-mono text-[7px] font-bold text-slate-400">
                                            {String(
                                              variant?.sku ||
                                                "-"
                                            )}
                                          </div>
                                        </div>

                                        <div>
                                          <span
                                            className={`inline-flex rounded-full px-2.5 py-1 text-[8px] font-black ${
                                              quantity >
                                              0
                                                ? "bg-emerald-50 text-emerald-700"
                                                : "bg-red-50 text-red-700"
                                            }`}
                                          >
                                            {
                                              quantity
                                            }
                                          </span>
                                        </div>

                                        <div className="font-black text-slate-800">
                                          {money(
                                            price.salePrice
                                          )}
                                        </div>

                                        <div className="font-black text-slate-800">
                                          {money(
                                            price.listPrice
                                          )}
                                        </div>

                                        <div className="truncate font-bold text-slate-500">
                                          {locationNames(
                                            variant
                                          )}
                                        </div>

                                        <div className="flex items-center gap-2">
                                          <button
                                            type="button"
                                            disabled={
                                              quantity <=
                                                0 ||
                                              stockBusyId ===
                                                key
                                            }
                                            onClick={() => {
                                              void runStockAction(
                                                String(
                                                  product?.id ||
                                                    ""
                                                ),
                                                String(
                                                  variant?.id ||
                                                    ""
                                                ),
                                                "decrement",
                                                quantity
                                              );
                                            }}
                                            className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-[8px] font-black text-slate-700 disabled:opacity-40"
                                          >
                                            -1
                                          </button>

                                          <button
                                            type="button"
                                            disabled={
                                              quantity <=
                                                0 ||
                                              stockBusyId ===
                                                key
                                            }
                                            onClick={() => {
                                              void runStockAction(
                                                String(
                                                  product?.id ||
                                                    ""
                                                ),
                                                String(
                                                  variant?.id ||
                                                    ""
                                                ),
                                                "zero",
                                                quantity
                                              );
                                            }}
                                            className="h-8 rounded-lg border border-rose-200 bg-rose-50 px-3 text-[8px] font-black text-rose-700 disabled:opacity-40"
                                          >
                                            0 Yap
                                          </button>

                                          <input
                                            value={
                                              stockDrafts[
                                                key
                                              ] ??
                                              String(
                                                quantity
                                              )
                                            }
                                            onChange={(event) =>
                                              setStockDrafts(
                                                (
                                                  current
                                                ) => ({
                                                  ...current,
                                                  [key]:
                                                    event
                                                      .target
                                                      .value,
                                                })
                                              )
                                            }
                                            inputMode="numeric"
                                            className="h-8 w-[58px] rounded-lg border border-slate-200 px-2 text-center text-[8px] font-black"
                                          />

                                          <button
                                            type="button"
                                            disabled={
                                              stockBusyId ===
                                              key
                                            }
                                            onClick={() => {
                                              void runStockAction(
                                                String(
                                                  product?.id ||
                                                    ""
                                                ),
                                                String(
                                                  variant?.id ||
                                                    ""
                                                ),
                                                "set",
                                                quantity
                                              );
                                            }}
                                            className="h-8 rounded-lg bg-slate-950 px-3 text-[8px] font-black text-white disabled:opacity-40"
                                          >
                                            {stockBusyId ===
                                            key
                                              ? "..."
                                              : "Kaydet"}
                                          </button>

                                          <button
                                            type="button"
                                            onClick={() =>
                                              openPriceEditor(
                                                product,
                                                variant
                                              )
                                            }
                                            className="h-8 rounded-lg bg-violet-600 px-3 text-[8px] font-black text-white hover:bg-violet-700"
                                          >
                                            Fiyat
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  }
                                )}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      );
                    }
                  )}
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      {priceTarget ? (
        <div
          className="fixed inset-0 z-[180] flex items-start justify-center overflow-y-auto bg-slate-950/50 p-4 backdrop-blur-[2px]"
          onMouseDown={(event) => {
            if (
              event.target ===
                event.currentTarget &&
              !priceSaving
            ) {
              setPriceTarget(
                null
              );
            }
          }}
        >
          <div className="my-10 w-full max-w-[620px] overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
              <div>
                <div className="text-[8px] font-black uppercase tracking-[0.18em] text-violet-600">
                  İkas · Fiyat Yönetimi
                </div>

                <h3 className="mt-1 text-xl font-black text-slate-950">
                  Fiyat Değiştir
                </h3>

                <div className="mt-1 text-[8px] font-bold text-slate-500">
                  {
                    priceTarget.productName
                  }{" "}
                  ·{" "}
                  {
                    priceTarget.variantName
                  }
                </div>
              </div>

              <button
                type="button"
                disabled={
                  priceSaving
                }
                onClick={() =>
                  setPriceTarget(
                    null
                  )
                }
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-lg font-black text-slate-500"
              >
                ×
              </button>
            </div>

            <div className="space-y-4 px-6 py-6">
              {priceError ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[9px] font-black text-rose-700">
                  {
                    priceError
                  }
                </div>
              ) : null}

              {priceSuccess ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[9px] font-black text-emerald-700">
                  ✓{" "}
                  {
                    priceSuccess
                  }
                </div>
              ) : null}

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-[8px] font-black uppercase text-slate-500">
                    İkas Satış Fiyatı
                  </label>

                  <input
                    inputMode="decimal"
                    value={
                      priceTarget.salePrice
                    }
                    onChange={(event) =>
                      setPriceTarget(
                        (
                          current
                        ) =>
                          current
                            ? {
                                ...current,
                                salePrice:
                                  event
                                    .target
                                    .value,
                              }
                            : current
                      )
                    }
                    className="h-12 w-full rounded-xl border border-slate-200 px-4 text-[11px] font-black outline-none focus:border-violet-400"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-[8px] font-black uppercase text-slate-500">
                    İkas Liste Fiyatı
                  </label>

                  <input
                    inputMode="decimal"
                    value={
                      priceTarget.listPrice
                    }
                    onChange={(event) =>
                      setPriceTarget(
                        (
                          current
                        ) =>
                          current
                            ? {
                                ...current,
                                listPrice:
                                  event
                                    .target
                                    .value,
                              }
                            : current
                      )
                    }
                    className="h-12 w-full rounded-xl border border-slate-200 px-4 text-[11px] font-black outline-none focus:border-violet-400"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-6 py-4">
              <button
                type="button"
                disabled={
                  priceSaving
                }
                onClick={() =>
                  setPriceTarget(
                    null
                  )
                }
                className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-[8px] font-black uppercase text-slate-600"
              >
                Kapat
              </button>

              <button
                type="button"
                disabled={
                  priceSaving
                }
                onClick={() => {
                  void savePrice();
                }}
                className="h-10 rounded-xl bg-violet-600 px-5 text-[8px] font-black uppercase text-white disabled:opacity-50"
              >
                {priceSaving
                  ? "Kaydediliyor..."
                  : "Fiyatı Kaydet"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
