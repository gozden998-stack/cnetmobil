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
            </div>
          </div>
        </div>

        {inventory.error && (
          <div className="border-b border-rose-200 bg-rose-50 px-6 py-3 text-[9px] font-bold text-rose-700">
            {inventory.error}
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
                        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
                          <div className="grid grid-cols-[minmax(180px,1.3fr)_100px_150px_150px_minmax(130px,1fr)] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-[7px] font-black uppercase tracking-wide text-slate-400">
                            <div>Varyant</div>
                            <div>Stok</div>
                            <div>Satış Fiyatı</div>
                            <div>İndirimli Fiyat</div>
                            <div>Lokasyon</div>
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
                                  className="grid grid-cols-[minmax(180px,1.3fr)_100px_150px_150px_minmax(130px,1fr)] gap-3 border-b border-slate-100 px-4 py-3 text-[9px] last:border-0"
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
                                </div>
                              );
                            }
                          )}
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
