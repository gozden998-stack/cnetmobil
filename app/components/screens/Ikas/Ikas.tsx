"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

type InventoryState = {
  loading: boolean;
  success: boolean;
  error: string;
  data: any;
};

type StockTab =
  | "open"
  | "closed"
  | "all";

function formatTry(
  value: unknown
) {
  const number =
    Number(value);

  if (!Number.isFinite(number)) {
    return "-";
  }

  return new Intl.NumberFormat(
    "tr-TR",
    {
      style: "currency",
      currency: "TRY",
      minimumFractionDigits: 2,
    }
  ).format(number);
}

function formatDateTime(
  value: unknown
) {
  if (!value) {
    return "-";
  }

  const date =
    new Date(
      String(value)
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "-";
  }

  return new Intl.DateTimeFormat(
    "tr-TR",
    {
      dateStyle: "short",
      timeStyle: "medium",
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
    Number.isFinite(direct)
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
    ) => {
      const value =
        Number(
          variant?.stockCount
        );

      return (
        sum +
        (Number.isFinite(
          value
        )
          ? value
          : 0)
      );
    },
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
    prices[0];

  if (!first) {
    return {
      sellPrice: null,
      discountPrice: null,
    };
  }

  return {
    sellPrice:
      first?.sellPrice ??
      null,
    discountPrice:
      first
        ?.discountPrice ??
      null,
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

  if (
    values.length === 0
  ) {
    return "Standart";
  }

  return values
    .map(
      (item: any) =>
        String(
          item?.variantValueName ||
            item?.value ||
            ""
        ).trim()
    )
    .filter(Boolean)
    .join(" / ");
}

function variantTypeLabel(
  variant: any
) {
  const values =
    Array.isArray(
      variant?.variantValues
    )
      ? variant.variantValues
      : [];

  return values
    .map(
      (item: any) =>
        String(
          item?.variantTypeName ||
            ""
        ).trim()
    )
    .filter(Boolean)
    .join(" / ");
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

  const values =
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
          stock
            ?.stockLocationName ||
          stock
            ?.stockLocationId ||
          ""
      )
      .filter(Boolean);

  return Array.from(
    new Set(values)
  ).join(", ");
}

function productColors(
  product: any
): string[] {
  const variants: any[] =
    Array.isArray(
      product?.variants
    )
      ? product.variants
      : [];

  const colors: string[] =
    variants.flatMap(
      (variant: any): string[] =>
        (
          Array.isArray(
            variant?.variantValues
          )
            ? variant.variantValues
            : []
        )
          .map(
            (item: any): string =>
              String(
                item?.variantValueName ||
                  item?.value ||
                  ""
              ).trim()
          )
          .filter(
            (
              value: string
            ): value is string =>
              value.length > 0
          )
    );

  return Array.from(
    new Set<string>(
      colors
    )
  );
}

function qualityLabel(
  name: unknown
) {
  const text =
    String(name || "")
      .toLocaleLowerCase(
        "tr-TR"
      );

  if (
    text.includes(
      "mükemmel"
    )
  ) {
    return "Mükemmel";
  }

  if (
    text.includes(
      "çok iyi"
    )
  ) {
    return "Çok İyi";
  }

  if (
    /\biyi\b/i.test(
      String(name || "")
    )
  ) {
    return "İyi";
  }

  return null;
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
    dbSync,
    setDbSync,
  ] = useState<InventoryState>({
    loading: false,
    success: false,
    error: "",
    data: null,
  });

  const [
    transfer,
    setTransfer,
  ] = useState<InventoryState>({
    loading: false,
    success: false,
    error: "",
    data: null,
  });

  const [
    transferExpanded,
    setTransferExpanded,
  ] = useState(false);

  const [
    transferSelections,
    setTransferSelections,
  ] = useState<
    Record<number, string[]>
  >({});

  const [
    transferPrices,
    setTransferPrices,
  ] = useState<
    Record<
      number,
      {
        salePrice: string;
        listPrice: string;
      }
    >
  >({});

  const [
    transferBusyListingId,
    setTransferBusyListingId,
  ] = useState<number | null>(
    null
  );

  const [
    transferMessage,
    setTransferMessage,
  ] = useState<{
    type:
      | "success"
      | "error";
    text: string;
  } | null>(null);

  const [
    stockBusyId,
    setStockBusyId,
  ] = useState<string | null>(
    null
  );

  const [
    stockDrafts,
    setStockDrafts,
  ] = useState<
    Record<string, string>
  >({});

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
    search,
    setSearch,
  ] = useState("");

  const [
    tab,
    setTab,
  ] = useState<StockTab>(
    "open"
  );

  const [
    expandedProductId,
    setExpandedProductId,
  ] = useState<
    string | null
  >(null);

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
                cache: "no-store",
              }
            );

          const payload =
            await response.json();

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
            data: payload,
          });
        } catch (error) {
          setInventory(
            (current) => ({
              ...current,
              loading: false,
              success:
                current.success,
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

  const loadTransferCandidates =
    useCallback(
      async () => {
        setTransfer(
          (current) => ({
            ...current,
            loading: true,
            error: "",
          })
        );

        setTransferMessage(null);

        try {
          const response =
            await fetch(
              "/api/online/ikas/n11-transfer",
              {
                method: "GET",
                cache: "no-store",
              }
            );

          const raw =
            await response.text();

          let payload: any =
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
              `N11 → İkas API JSON dönmedi. HTTP ${response.status}. Route deploy edilmiş mi kontrol et.`
            );
          }

          if (
            !response.ok ||
            !payload?.success
          ) {
            throw new Error(
              payload?.error ||
                "N11 IMEI listesi okunamadı."
            );
          }

          setTransfer({
            loading: false,
            success: true,
            error: "",
            data: payload,
          });

          setTransferExpanded(
            true
          );

          setTransferPrices(
            (current) => {
              const next = {
                ...current,
              };

              for (
                const group of
                  Array.isArray(
                    payload?.groups
                  )
                    ? payload.groups
                    : []
              ) {
                const listingId =
                  Number(
                    group
                      ?.listingId
                  );

                if (
                  !next[
                    listingId
                  ]
                ) {
                  next[
                    listingId
                  ] = {
                    salePrice:
                      group
                        ?.n11SalePrice
                        ? String(
                            group
                              .n11SalePrice
                          )
                        : "",
                    listPrice:
                      group
                        ?.n11ListPrice
                        ? String(
                            group
                              .n11ListPrice
                          )
                        : "",
                  };
                }
              }

              return next;
            }
          );
        } catch (error) {
          setTransfer({
            loading: false,
            success: false,
            error:
              error instanceof
                Error
                ? error.message
                : "N11 IMEI listesi okunamadı.",
            data: null,
          });
        }
      },
      []
    );

  const toggleTransferImei =
    useCallback(
      (
        listingId: number,
        imei: string
      ) => {
        setTransferSelections(
          (current) => {
            const existing =
              current[
                listingId
              ] || [];

            const next =
              existing.includes(
                imei
              )
                ? existing.filter(
                    (item) =>
                      item !== imei
                  )
                : [
                    ...existing,
                    imei,
                  ];

            return {
              ...current,
              [listingId]:
                next,
            };
          }
        );
      },
      []
    );

  const stageIkasTransfer =
    useCallback(
      async (
        listingId: number
      ) => {
        const imeis =
          transferSelections[
            listingId
          ] || [];

        const prices =
          transferPrices[
            listingId
          ];

        if (
          imeis.length === 0
        ) {
          setTransferMessage({
            type: "error",
            text:
              "En az 1 IMEI seç.",
          });
          return;
        }

        if (
          !prices
            ?.salePrice ||
          !prices
            ?.listPrice
        ) {
          setTransferMessage({
            type: "error",
            text:
              "İkas satış ve liste fiyatını gir.",
          });
          return;
        }

        setTransferBusyListingId(
          listingId
        );

        setTransferMessage(null);

        try {
          const response =
            await fetch(
              "/api/online/ikas/n11-transfer",
              {
                method: "POST",
                cache: "no-store",
                headers: {
                  "Content-Type":
                    "application/json",
                },
                body:
                  JSON.stringify({
                    listingId,
                    imeis,
                    ikasSalePrice:
                      prices
                        .salePrice,
                    ikasListPrice:
                      prices
                        .listPrice,
                  }),
              }
            );

          const raw =
            await response.text();

          let payload: any =
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
              `N11 → İkas API JSON dönmedi. HTTP ${response.status}.`
            );
          }

          if (
            !response.ok ||
            !payload?.success
          ) {
            throw new Error(
              payload?.error ||
                "IMEI'ler İkas için hazırlanamadı."
            );
          }

          setTransferMessage({
            type: "success",
            text:
              payload
                ?.message ||
              "IMEI'ler İkas için hazırlandı.",
          });

          setTransferSelections(
            (current) => ({
              ...current,
              [listingId]: [],
            })
          );

          await loadTransferCandidates();
        } catch (error) {
          setTransferMessage({
            type: "error",
            text:
              error instanceof
                Error
                ? error.message
                : "IMEI'ler İkas için hazırlanamadı.",
          });
        } finally {
          setTransferBusyListingId(
            null
          );
        }
      },
      [
        loadTransferCandidates,
        transferPrices,
        transferSelections,
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
        setStockMessage(null);

        try {
          const body: {
            productId: string;
            variantId: string;
            action:
              | "decrement"
              | "zero"
              | "set";
            quantity?: number;
          } = {
            productId,
            variantId,
            action,
          };

          if (
            action === "set"
          ) {
            const raw =
              stockDrafts[
                key
              ] ??
              String(
                currentQuantity
              );

            const quantity =
              Number(raw);

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
                "Stok artırma bu aşamada kapalı. Yeni adet IMEI girişi ile eklenecek."
              );
            }

            body.quantity =
              quantity;
          }

          const response =
            await fetch(
              "/api/online/ikas/variant-stock",
              {
                method: "POST",
                cache: "no-store",
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

          const payload =
            await response.json();

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
            type: "success",
            text:
              payload?.message ||
              `Stok ${payload?.quantity ?? 0} olarak güncellendi.`,
          });

          setStockDrafts(
            (current) => ({
              ...current,
              [key]:
                String(
                  payload?.quantity ??
                    0
                ),
            })
          );

          await loadInventory(
            true
          );
        } catch (error) {
          setStockMessage({
            type: "error",
            text:
              error instanceof
                Error
                ? error.message
                : "İkas stok işlemi başarısız.",
          });
        } finally {
          setStockBusyId(null);
        }
      },
      [
        loadInventory,
        stockDrafts,
      ]
    );

  const syncPostgres =
    useCallback(
      async () => {
        setDbSync({
          loading: true,
          success: false,
          error: "",
          data: null,
        });

        try {
          const response =
            await fetch(
              "/api/online/ikas/sync-db",
              {
                method: "POST",
                cache: "no-store",
              }
            );

          const payload =
            await response.json();

          if (
            !response.ok ||
            !payload?.success
          ) {
            throw new Error(
              payload?.error ||
                "PostgreSQL eşleştirmesi başarısız."
            );
          }

          setDbSync({
            loading: false,
            success: true,
            error: "",
            data: payload,
          });
        } catch (error) {
          setDbSync({
            loading: false,
            success: false,
            error:
              error instanceof
                Error
                ? error.message
                : "PostgreSQL eşleştirmesi başarısız.",
            data: null,
          });
        }
      },
      []
    );

  useEffect(() => {
    void loadInventory();
  }, [loadInventory]);

  useEffect(() => {
    const id =
      window.setInterval(
        () => {
          void loadInventory(
            true
          );
        },
        60_000
      );

    return () => {
      window.clearInterval(
        id
      );
    };
  }, [loadInventory]);

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

  const variants =
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
              (
                variant: any
              ) => ({
                product,
                variant,
              })
            )
        ),
      [renewedProducts]
    );

  const openVariantCount =
    useMemo(
      () =>
        variants.filter(
          (row: any) =>
            Number(
              row?.variant
                ?.stockCount ||
                0
            ) > 0
        ).length,
      [variants]
    );

  const closedVariantCount =
    variants.length -
    openVariantCount;

  const physicalStock =
    useMemo(
      () =>
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
        ),
      [renewedProducts]
    );

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
                product
                  ?.variants
              )
                ? product.variants
                : [];

            const filteredVariants =
              productVariants.filter(
                (
                  variant: any
                ) => {
                  const stock =
                    Number(
                      variant
                        ?.stockCount ||
                        0
                    );

                  if (
                    tab ===
                      "open" &&
                    stock <= 0
                  ) {
                    return false;
                  }

                  if (
                    tab ===
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
                    variantTypeLabel(
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

            const productText =
              [
                product?.name,
                product?.brand
                  ?.name,
              ]
                .join(" ")
                .toLocaleLowerCase(
                  "tr-TR"
                );

            const productMatch =
              !q ||
              productText.includes(
                q
              );

            if (
              !productMatch &&
              filteredVariants
                .length === 0
            ) {
              return null;
            }

            const finalVariants =
              productMatch
                ? productVariants.filter(
                    (
                      variant: any
                    ) => {
                      const stock =
                        Number(
                          variant
                            ?.stockCount ||
                            0
                        );

                      if (
                        tab ===
                          "open" &&
                        stock <= 0
                      ) {
                        return false;
                      }

                      if (
                        tab ===
                          "closed" &&
                        stock > 0
                      ) {
                        return false;
                      }

                      return true;
                    }
                  )
                : filteredVariants;

            if (
              finalVariants.length ===
              0
            ) {
              return null;
            }

            return {
              ...product,
              variants:
                finalVariants,
            };
          }
        )
        .filter(Boolean);
    }, [
      renewedProducts,
      search,
      tab,
    ]);

  const kpis = [
    {
      label:
        "Yenilenmiş Ürün",
      value:
        renewedProducts.length,
      sub:
        "İkas ürün kartı",
    },
    {
      label:
        "Fiziksel Stok",
      value:
        physicalStock,
      sub:
        "Toplam cihaz",
    },
    {
      label:
        "Stoklu Varyant",
      value:
        openVariantCount,
      sub:
        "Satışta stok var",
    },
    {
      label:
        "Stoksuz Varyant",
      value:
        closedVariantCount,
      sub:
        "Stok 0",
    },
  ];

  return (
    <div className="animate-in fade-in duration-300">
      <div className="overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-gradient-to-r from-violet-950 via-slate-950 to-slate-900 px-6 py-6 text-white sm:px-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-[9px] font-black uppercase tracking-[0.22em] text-violet-200/70">
                Entegrasyonlar / İkas
              </div>

              <div className="mt-1 flex flex-wrap items-center gap-3">
                <h2 className="text-2xl font-black tracking-tight sm:text-3xl">
                  İkas Stok Yönetimi
                </h2>

                <span className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-2.5 py-1 text-[8px] font-black uppercase tracking-wide text-emerald-200">
                  API Aktif
                </span>

                <span className="rounded-full border border-sky-300/20 bg-sky-400/10 px-2.5 py-1 text-[8px] font-black uppercase tracking-wide text-sky-200">
                  Canlı · 60 sn
                </span>
              </div>

              <p className="mt-2 max-w-2xl text-[10px] font-semibold leading-5 text-slate-300">
                Yenilenmiş ürün, renk/varyant, fiyat ve Ana Depo stokları İkas API'den canlı senkronlanıyor.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                <div className="text-[7px] font-black uppercase tracking-wide text-slate-400">
                  Son Senkron
                </div>
                <div className="mt-0.5 text-[9px] font-black text-white">
                  {formatDateTime(
                    inventory.data
                      ?.checkedAt
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  void loadInventory();
                }}
                disabled={
                  inventory.loading
                }
                className="h-10 rounded-xl bg-violet-500 px-4 text-[8px] font-black uppercase tracking-wide text-white transition hover:bg-violet-400 disabled:cursor-wait disabled:opacity-50"
              >
                {inventory.loading
                  ? "Stok Çekiliyor..."
                  : "Stoku Yenile"}
              </button>

              <button
                type="button"
                onClick={() => {
                  if (
                    transfer.success
                  ) {
                    setTransferExpanded(
                      (value) =>
                        !value
                    );
                  } else {
                    void loadTransferCandidates();
                  }
                }}
                disabled={
                  transfer.loading
                }
                className="h-10 rounded-xl border border-cyan-300/20 bg-cyan-400/10 px-4 text-[8px] font-black uppercase tracking-wide text-cyan-100 transition hover:bg-cyan-400/15 disabled:cursor-wait disabled:opacity-50"
              >
                {transfer.loading
                  ? "N11 IMEI..."
                  : "N11 → İkas"}
              </button>

              <button
                type="button"
                onClick={() => {
                  void syncPostgres();
                }}
                disabled={
                  dbSync.loading ||
                  inventory.loading
                }
                className="h-10 rounded-xl border border-white/15 bg-white/10 px-4 text-[8px] font-black uppercase tracking-wide text-white transition hover:bg-white/15 disabled:cursor-wait disabled:opacity-50"
              >
                {dbSync.loading
                  ? "Eşleştiriliyor..."
                  : "PostgreSQL Eşleştir"}
              </button>
            </div>
          </div>
        </div>

        {inventory.error && (
          <div className="border-b border-rose-200 bg-rose-50 px-6 py-3 text-[9px] font-bold text-rose-700">
            {inventory.error}
          </div>
        )}

        {dbSync.error && (
          <div className="border-b border-rose-200 bg-rose-50 px-6 py-3 text-[9px] font-bold text-rose-700">
            PostgreSQL: {dbSync.error}
          </div>
        )}

        {dbSync.success && (
          <div className="border-b border-emerald-200 bg-emerald-50 px-5 py-3 sm:px-6">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[8px] font-black uppercase tracking-wide text-emerald-700">
              <span>
                PostgreSQL Eşleşti
              </span>
              <span>
                İkas Ürün: {dbSync.data?.source?.renewedProductCount ?? 0}
              </span>
              <span>
                Varyant: {dbSync.data?.source?.renewedVariantCount ?? 0}
              </span>
              <span>
                Fiziksel Stok: {dbSync.data?.source?.renewedPhysicalStock ?? 0}
              </span>
              <span>
                Yeni: {dbSync.data?.postgres?.inserted ?? 0}
              </span>
              <span>
                Güncel: {dbSync.data?.postgres?.updated ?? 0}
              </span>
              <span>
                IMEI Bağlı: {dbSync.data?.postgres?.imeiLinkedCount ?? 0}
              </span>
            </div>
          </div>
        )}

        {stockMessage && (
          <div
            className={`border-b px-5 py-3 text-[9px] font-black sm:px-6 ${
              stockMessage.type ===
              "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-rose-200 bg-rose-50 text-rose-700"
            }`}
          >
            {stockMessage.text}
          </div>
        )}

        <div className="border-b border-amber-200 bg-amber-50 px-5 py-2.5 text-[8px] font-bold text-amber-800 sm:px-6">
          Geçiş güvenliği: panelden stok azaltma / 0 yapma açık. Stok artırma kapalıdır; yeni stok fiziksel IMEI girişi ile eklenecek.
        </div>

        {transfer.error && (
          <div className="border-b border-rose-200 bg-rose-50 px-5 py-3 text-[9px] font-black text-rose-700 sm:px-6">
            N11 → İkas: {transfer.error}
          </div>
        )}

        {transferMessage && (
          <div
            className={`border-b px-5 py-3 text-[9px] font-black sm:px-6 ${
              transferMessage.type ===
              "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-rose-200 bg-rose-50 text-rose-700"
            }`}
          >
            {transferMessage.text}
          </div>
        )}

        {transfer.success &&
          transferExpanded && (
            <div className="border-b border-cyan-200 bg-cyan-50/40 p-5 sm:p-6">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="text-[9px] font-black uppercase tracking-[0.18em] text-cyan-700">
                    N11 → İkas / Manuel IMEI Seçimi
                  </div>

                  <div className="mt-1 text-[13px] font-black text-slate-900">
                    İkas'a hangi IMEI'lerin açılacağını sen seç
                  </div>

                  <div className="mt-1 text-[8px] font-semibold text-slate-500">
                    N11 ürünü otomatik İkas'a açılmaz. İkas fiyatı N11 fiyatından tamamen ayrıdır.
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full bg-white px-2.5 py-1 text-[8px] font-black text-cyan-700 ring-1 ring-cyan-200">
                    N11 IMEI: {transfer.data?.totalImeis ?? 0}
                  </span>

                  <span className="rounded-full bg-white px-2.5 py-1 text-[8px] font-black text-emerald-700 ring-1 ring-emerald-200">
                    AVAILABLE: {transfer.data?.availableStockDeviceCount ?? 0}
                  </span>

                  <span className="rounded-full bg-white px-2.5 py-1 text-[8px] font-black text-violet-700 ring-1 ring-violet-200">
                    İkas Hazırlanan: {transfer.data?.ikasPreparedCount ?? 0}
                  </span>

                  <button
                    type="button"
                    onClick={() => {
                      void loadTransferCandidates();
                    }}
                    disabled={
                      transfer.loading
                    }
                    className="rounded-lg bg-slate-950 px-3 py-1.5 text-[8px] font-black text-white disabled:opacity-50"
                  >
                    Yenile
                  </button>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {(Array.isArray(
                  transfer.data
                    ?.groups
                )
                  ? transfer.data
                      .groups
                  : []
                ).map(
                  (
                    group: any
                  ) => {
                    const listingId =
                      Number(
                        group
                          ?.listingId
                      );

                    const selected =
                      transferSelections[
                        listingId
                      ] || [];

                    const prices =
                      transferPrices[
                        listingId
                      ] || {
                        salePrice:
                          "",
                        listPrice:
                          "",
                      };

                    const selectableImeis =
                      (
                        Array.isArray(
                          group
                            ?.imeis
                        )
                          ? group
                              .imeis
                          : []
                      ).filter(
                        (
                          item: any
                        ) =>
                          item
                            ?.foundInStockDevices ===
                            true &&
                          item
                            ?.deviceStatus ===
                            "AVAILABLE" &&
                          ![
                            "LISTED",
                            "RESERVED",
                            "SOLD",
                          ].includes(
                            String(
                              item
                                ?.ikasMembership
                                ?.status ||
                                ""
                            )
                          )
                      );

                    return (
                      <div
                        key={
                          listingId
                        }
                        className="overflow-hidden rounded-2xl border border-cyan-200 bg-white"
                      >
                        <div className="grid gap-4 border-b border-slate-100 p-4 xl:grid-cols-[minmax(0,1fr)_120px_120px_130px_130px] xl:items-center">
                          <div className="min-w-0">
                            <div className="truncate text-[11px] font-black text-slate-900">
                              {group?.title ||
                                "-"}
                            </div>

                            <div className="mt-1 text-[7px] font-bold text-slate-400">
                              N11 SKU: {group?.stockCode || "-"} · IMEI: {group?.imeiCount ?? 0}
                            </div>
                          </div>

                          <div>
                            <div className="text-[7px] font-black uppercase text-slate-400">
                              N11 Satış
                            </div>
                            <div className="mt-1 text-[9px] font-black text-slate-800">
                              {formatTry(
                                group?.n11SalePrice
                              )}
                            </div>
                          </div>

                          <div>
                            <div className="text-[7px] font-black uppercase text-slate-400">
                              N11 Liste
                            </div>
                            <div className="mt-1 text-[9px] font-black text-slate-800">
                              {formatTry(
                                group?.n11ListPrice
                              )}
                            </div>
                          </div>

                          <label>
                            <span className="text-[7px] font-black uppercase text-cyan-700">
                              İkas Satış Fiyatı
                            </span>
                            <input
                              value={
                                prices
                                  .salePrice
                              }
                              onChange={(
                                event
                              ) => {
                                setTransferPrices(
                                  (
                                    current
                                  ) => ({
                                    ...current,
                                    [listingId]:
                                      {
                                        ...prices,
                                        salePrice:
                                          event
                                            .target
                                            .value,
                                      },
                                  })
                                );
                              }}
                              inputMode="decimal"
                              className="mt-1 h-9 w-full rounded-lg border border-cyan-200 bg-cyan-50 px-2.5 text-[9px] font-black text-slate-800 outline-none focus:border-cyan-500"
                            />
                          </label>

                          <label>
                            <span className="text-[7px] font-black uppercase text-cyan-700">
                              İkas Liste Fiyatı
                            </span>
                            <input
                              value={
                                prices
                                  .listPrice
                              }
                              onChange={(
                                event
                              ) => {
                                setTransferPrices(
                                  (
                                    current
                                  ) => ({
                                    ...current,
                                    [listingId]:
                                      {
                                        ...prices,
                                        listPrice:
                                          event
                                            .target
                                            .value,
                                      },
                                  })
                                );
                              }}
                              inputMode="decimal"
                              className="mt-1 h-9 w-full rounded-lg border border-cyan-200 bg-cyan-50 px-2.5 text-[9px] font-black text-slate-800 outline-none focus:border-cyan-500"
                            />
                          </label>
                        </div>

                        <div className="max-h-60 overflow-auto p-4">
                          <div className="mb-3 flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setTransferSelections(
                                  (
                                    current
                                  ) => ({
                                    ...current,
                                    [listingId]:
                                      selectableImeis.map(
                                        (
                                          item: any
                                        ) =>
                                          String(
                                            item
                                              ?.imei ||
                                              ""
                                          )
                                      ),
                                  })
                                );
                              }}
                              className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[7px] font-black text-slate-600"
                            >
                              Uygunların Tümünü Seç
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setTransferSelections(
                                  (
                                    current
                                  ) => ({
                                    ...current,
                                    [listingId]:
                                      [],
                                  })
                                );
                              }}
                              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[7px] font-black text-slate-500"
                            >
                              Seçimi Temizle
                            </button>

                            <span className="text-[8px] font-black text-cyan-700">
                              Seçili: {selected.length}
                            </span>
                          </div>

                          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                            {(Array.isArray(
                              group?.imeis
                            )
                              ? group
                                  .imeis
                              : []
                            ).map(
                              (
                                item: any
                              ) => {
                                const imei =
                                  String(
                                    item
                                      ?.imei ||
                                      ""
                                  );

                                const eligible =
                                  item
                                    ?.foundInStockDevices ===
                                    true &&
                                  item
                                    ?.deviceStatus ===
                                    "AVAILABLE" &&
                                  ![
                                    "LISTED",
                                    "RESERVED",
                                    "SOLD",
                                  ].includes(
                                    String(
                                      item
                                        ?.ikasMembership
                                        ?.status ||
                                        ""
                                    )
                                  );

                                const checked =
                                  selected.includes(
                                    imei
                                  );

                                return (
                                  <label
                                    key={
                                      imei
                                    }
                                    className={`flex gap-2 rounded-xl border p-3 ${
                                      eligible
                                        ? checked
                                          ? "border-cyan-400 bg-cyan-50"
                                          : "border-slate-200 bg-white"
                                        : "border-slate-100 bg-slate-50 opacity-60"
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={
                                        checked
                                      }
                                      disabled={
                                        !eligible
                                      }
                                      onChange={() => {
                                        toggleTransferImei(
                                          listingId,
                                          imei
                                        );
                                      }}
                                      className="mt-0.5"
                                    />

                                    <div className="min-w-0">
                                      <div className="text-[9px] font-black text-slate-800">
                                        {imei}
                                      </div>

                                      <div className="mt-1 text-[7px] font-bold text-slate-400">
                                        {item?.color || "-"} · {item?.grade || "-"} · {item?.warranty || "-"}
                                      </div>

                                      <div className="mt-1 text-[7px] font-black">
                                        {!item?.foundInStockDevices ? (
                                          <span className="text-rose-600">
                                            stock_devices yok
                                          </span>
                                        ) : item?.deviceStatus !==
                                          "AVAILABLE" ? (
                                          <span className="text-amber-600">
                                            {item?.deviceStatus}
                                          </span>
                                        ) : item?.ikasMembership ? (
                                          <span className="text-violet-600">
                                            İkas: {item?.ikasMembership?.status}
                                          </span>
                                        ) : (
                                          <span className="text-emerald-600">
                                            İkas'a uygun
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </label>
                                );
                              }
                            )}
                          </div>
                        </div>

                        <div className="flex flex-col gap-2 border-t border-slate-100 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="text-[8px] font-bold text-slate-500">
                            Bu işlem sadece İkas için hazırlık kaydı oluşturur. N11 fiyatı ve N11 stoğu değişmez.
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              void stageIkasTransfer(
                                listingId
                              );
                            }}
                            disabled={
                              transferBusyListingId ===
                                listingId ||
                              selected.length ===
                                0
                            }
                            className="h-9 rounded-xl bg-cyan-700 px-4 text-[8px] font-black uppercase tracking-wide text-white transition hover:bg-cyan-600 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {transferBusyListingId ===
                            listingId
                              ? "Hazırlanıyor..."
                              : `Seçili ${selected.length} IMEI'yi İkas'a Hazırla`}
                          </button>
                        </div>
                      </div>
                    );
                  }
                )}

                {(!Array.isArray(
                  transfer.data
                    ?.groups
                ) ||
                  transfer.data
                    .groups
                    .length ===
                    0) && (
                  <div className="rounded-2xl border border-dashed border-cyan-200 bg-white px-5 py-10 text-center">
                    <div className="text-[10px] font-black text-slate-700">
                      N11 availableImeis kaydı bulunamadı.
                    </div>
                    <div className="mt-1 text-[8px] font-semibold text-slate-400">
                      N11 IMEI havuzu oluşturulmuş listing'ler burada görünecek.
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

        <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-4 sm:p-6">
          {kpis.map(
            (
              item,
              index
            ) => (
              <div
                key={item.label}
                className={`rounded-2xl border p-5 ${
                  index === 1
                    ? "border-emerald-200 bg-emerald-50/50"
                    : "border-slate-200 bg-white"
                }`}
              >
                <div className="text-[8px] font-black uppercase tracking-[0.17em] text-slate-400">
                  {item.label}
                </div>
                <div className="mt-2 text-2xl font-black text-slate-950">
                  {item.value}
                </div>
                <div className="mt-1 text-[8px] font-semibold text-slate-400">
                  {item.sub}
                </div>
              </div>
            )
          )}
        </div>

        <div className="border-t border-slate-200">
          <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50/70 px-5 py-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1">
              <button
                type="button"
                onClick={() =>
                  setTab("open")
                }
                className={`rounded-lg px-3 py-2 text-[8px] font-black uppercase tracking-wide transition ${
                  tab === "open"
                    ? "bg-slate-950 text-white"
                    : "text-slate-500 hover:bg-slate-50"
                }`}
              >
                Stokta Olan (
                {openVariantCount})
              </button>

              <button
                type="button"
                onClick={() =>
                  setTab(
                    "closed"
                  )
                }
                className={`rounded-lg px-3 py-2 text-[8px] font-black uppercase tracking-wide transition ${
                  tab === "closed"
                    ? "bg-slate-950 text-white"
                    : "text-slate-500 hover:bg-slate-50"
                }`}
              >
                Stoksuz (
                {closedVariantCount})
              </button>

              <button
                type="button"
                onClick={() =>
                  setTab("all")
                }
                className={`rounded-lg px-3 py-2 text-[8px] font-black uppercase tracking-wide transition ${
                  tab === "all"
                    ? "bg-slate-950 text-white"
                    : "text-slate-500 hover:bg-slate-50"
                }`}
              >
                Tüm Yenilenmiş (
                {variants.length})
              </button>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <svg
                  className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="m21 21-4.35-4.35m1.35-5.65a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z"
                  />
                </svg>

                <input
                  value={search}
                  onChange={(
                    event
                  ) =>
                    setSearch(
                      event.target
                        .value
                    )
                  }
                  placeholder="Ürün, renk veya SKU ara..."
                  className="h-9 w-[280px] max-w-[65vw] rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-[9px] font-semibold text-slate-700 outline-none transition focus:border-violet-400"
                />
              </div>
            </div>
          </div>

          {inventory.loading &&
          !inventory.success ? (
            <div className="px-6 py-16 text-center">
              <div className="text-[11px] font-black text-slate-700">
                İkas stoğu çekiliyor...
              </div>
              <div className="mt-2 text-[9px] font-semibold text-slate-400">
                Yenilenmiş ürünler ve varyantlar okunuyor.
              </div>
            </div>
          ) : visibleProducts.length ===
            0 ? (
            <div className="px-6 py-16 text-center">
              <div className="text-[11px] font-black text-slate-700">
                Ürün bulunamadı
              </div>
              <div className="mt-2 text-[9px] font-semibold text-slate-400">
                Seçili stok filtresini veya aramayı değiştir.
              </div>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {visibleProducts.map(
                (
                  product: any
                ) => {
                  const id =
                    String(
                      product?.id ||
                        ""
                    );

                  const isOpen =
                    expandedProductId ===
                    id;

                  const quality =
                    qualityLabel(
                      product?.name
                    );

                  const stock =
                    (
                      Array.isArray(
                        product
                          ?.variants
                      )
                        ? product
                            .variants
                        : []
                    ).reduce(
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
                      key={id}
                      className="px-5 py-4 sm:px-6"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedProductId(
                            isOpen
                              ? null
                              : id
                          )
                        }
                        className="grid w-full gap-4 text-left lg:grid-cols-[minmax(0,1fr)_120px_120px_34px] lg:items-center"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="truncate text-[12px] font-black text-slate-900">
                              {product?.name ||
                                "İsimsiz ürün"}
                            </div>

                            {quality && (
                              <span className="rounded-full bg-violet-100 px-2 py-1 text-[7px] font-black uppercase text-violet-700">
                                {quality}
                              </span>
                            )}
                          </div>

                          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[8px] font-bold text-slate-400">
                            <span>
                              Marka:{" "}
                              {product
                                ?.brand
                                ?.name ||
                                "-"}
                            </span>
                            <span>
                              Varyant:{" "}
                              {Array.isArray(
                                product
                                  ?.variants
                              )
                                ? product
                                    .variants
                                    .length
                                : 0}
                            </span>
                            <span className="truncate">
                              ID:{" "}
                              {product?.id ||
                                "-"}
                            </span>
                          </div>

                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            <span className="text-[7px] font-black uppercase tracking-wide text-slate-400">
                              Renkler:
                            </span>

                            {productColors(product).length > 0 ? (
                              productColors(product)
                                .slice(0, 8)
                                .map((color: string) => (
                                  <span
                                    key={color}
                                    className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[7px] font-black text-slate-600"
                                  >
                                    {color}
                                  </span>
                                ))
                            ) : (
                              <span className="text-[8px] font-bold text-slate-400">
                                Renk bilgisi yok
                              </span>
                            )}

                            {productColors(product).length > 8 && (
                              <span className="rounded-full bg-slate-100 px-2 py-1 text-[7px] font-black text-slate-500">
                                +{productColors(product).length - 8}
                              </span>
                            )}
                          </div>
                        </div>

                        <div>
                          <div className="text-[7px] font-black uppercase tracking-wide text-slate-400">
                            Fiziksel Stok
                          </div>
                          <div className="mt-1 text-[13px] font-black text-slate-900">
                            {stock}
                          </div>
                        </div>

                        <div>
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-[8px] font-black uppercase ${
                              stock > 0
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-rose-100 text-rose-700"
                            }`}
                          >
                            {stock > 0
                              ? "Stokta"
                              : "Stoksuz"}
                          </span>
                        </div>

                        <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-500">
                          <svg
                            className={`h-3.5 w-3.5 transition ${
                              isOpen
                                ? "rotate-180"
                                : ""
                            }`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="m19 9-7 7-7-7"
                            />
                          </svg>
                        </div>
                      </button>

                      {isOpen && (
                        <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
                          <div className="min-w-[980px]">
                          <div className="grid grid-cols-[minmax(180px,1.3fr)_80px_135px_135px_minmax(120px,1fr)_310px] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-[7px] font-black uppercase tracking-wide text-slate-400">
                            <div>Varyant</div>
                            <div>Stok</div>
                            <div>Satış Fiyatı</div>
                            <div>İndirimli Fiyat</div>
                            <div>Lokasyon</div>
                            <div>Stok İşlemi</div>
                          </div>

                          {(Array.isArray(
                            product
                              ?.variants
                          )
                            ? product
                                .variants
                            : []
                          ).map(
                            (
                              variant: any,
                              index: number
                            ) => {
                              const price =
                                variantPrice(
                                  variant
                                );

                              return (
                                <div
                                  key={
                                    variant?.id ||
                                    index
                                  }
                                  className="grid grid-cols-[minmax(180px,1.3fr)_80px_135px_135px_minmax(120px,1fr)_310px] items-center gap-3 border-b border-slate-100 px-4 py-3 text-[9px] last:border-0"
                                >
                                  <div>
                                    <div className="font-black text-slate-800">
                                      {variantLabel(
                                        variant
                                      )}
                                    </div>
                                    <div className="mt-1 text-[7px] font-bold text-slate-400">
                                      {variantTypeLabel(
                                        variant
                                      ) ||
                                        "Varyant"}{" "}
                                      · SKU:{" "}
                                      {variant?.sku ||
                                        "-"}
                                    </div>
                                  </div>

                                  <div>
                                    <span
                                      className={`inline-flex min-w-[42px] justify-center rounded-full px-2 py-1 font-black ${
                                        Number(
                                          variant
                                            ?.stockCount ||
                                            0
                                        ) > 0
                                          ? "bg-emerald-100 text-emerald-700"
                                          : "bg-slate-100 text-slate-500"
                                      }`}
                                    >
                                      {variant?.stockCount ??
                                        0}
                                    </span>
                                  </div>

                                  <div className="font-black text-slate-800">
                                    {formatTry(
                                      price.sellPrice
                                    )}
                                  </div>

                                  <div className="font-black text-slate-800">
                                    {formatTry(
                                      price.discountPrice
                                    )}
                                  </div>

                                  <div className="truncate font-bold text-slate-500">
                                    {locationNames(
                                      variant
                                    ) ||
                                      "Ana Depo"}
                                  </div>

                                  <div className="flex items-center gap-1.5">
                                    <button
                                      type="button"
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
                                          Number(
                                            variant?.stockCount ||
                                              0
                                          )
                                        );
                                      }}
                                      disabled={
                                        stockBusyId ===
                                          `${product?.id}:${variant?.id}` ||
                                        Number(
                                          variant?.stockCount ||
                                            0
                                        ) <= 0
                                      }
                                      className="h-8 rounded-lg border border-amber-200 bg-amber-50 px-2.5 text-[8px] font-black text-amber-700 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                      -1
                                    </button>

                                    <button
                                      type="button"
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
                                          Number(
                                            variant?.stockCount ||
                                              0
                                          )
                                        );
                                      }}
                                      disabled={
                                        stockBusyId ===
                                          `${product?.id}:${variant?.id}` ||
                                        Number(
                                          variant?.stockCount ||
                                            0
                                        ) <= 0
                                      }
                                      className="h-8 rounded-lg border border-rose-200 bg-rose-50 px-2.5 text-[8px] font-black text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                      0 Yap
                                    </button>

                                    <input
                                      type="number"
                                      min={0}
                                      max={Number(
                                        variant?.stockCount ||
                                          0
                                      )}
                                      step={1}
                                      value={
                                        stockDrafts[
                                          `${product?.id}:${variant?.id}`
                                        ] ??
                                        String(
                                          Number(
                                            variant?.stockCount ||
                                              0
                                          )
                                        )
                                      }
                                      onChange={(
                                        event
                                      ) => {
                                        const key =
                                          `${product?.id}:${variant?.id}`;

                                        setStockDrafts(
                                          (current) => ({
                                            ...current,
                                            [key]:
                                              event.target.value,
                                          })
                                        );
                                      }}
                                      className="h-8 w-16 rounded-lg border border-slate-200 bg-white px-2 text-center text-[8px] font-black text-slate-800 outline-none focus:border-violet-400"
                                    />

                                    <button
                                      type="button"
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
                                          Number(
                                            variant?.stockCount ||
                                              0
                                          )
                                        );
                                      }}
                                      disabled={
                                        stockBusyId ===
                                        `${product?.id}:${variant?.id}`
                                      }
                                      className="h-8 rounded-lg bg-slate-950 px-3 text-[8px] font-black text-white transition hover:bg-slate-800 disabled:cursor-wait disabled:opacity-50"
                                    >
                                      {stockBusyId ===
                                      `${product?.id}:${variant?.id}`
                                        ? "..."
                                        : "Kaydet"}
                                    </button>
                                  </div>
                                </div>
                              );
                            }
                          )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                }
              )}
            </div>
          )}
        </div>

        <div className="border-t border-slate-200 bg-slate-50 px-5 py-3 text-[8px] font-bold text-slate-400 sm:px-6">
          Canlı senkron: 60 saniye · Ürün + renk + fiyat + stok · Kaynak: İkas Admin API
        </div>
      </div>
    </div>
  );
}
