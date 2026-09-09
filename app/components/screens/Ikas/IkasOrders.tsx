"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

type OrderSection =
  | "new"
  | "ready"
  | "shipped"
  | "delivered";

type IkasOrder = {
  id: string;
  orderNumber: string;
  orderedAt:
    | string
    | null;
  updatedAt:
    | string
    | null;
  rawStatus: string;
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
      minimumFractionDigits:
        2,
    }
  ).format(number);
}

function dateTime(
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
      timeStyle: "short",
    }
  ).format(date);
}

function statusMeta(
  section: OrderSection
) {
  if (
    section === "new"
  ) {
    return {
      label:
        "Yeni Sipariş",
      badge:
        "bg-blue-100 text-blue-700",
      button:
        "Kargoya Hazır",
      next:
        "READY",
    };
  }

  if (
    section === "ready"
  ) {
    return {
      label:
        "Kargoya Hazır",
      badge:
        "bg-amber-100 text-amber-700",
      button:
        "Kargoya Ver",
      next:
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
      badge:
        "bg-violet-100 text-violet-700",
      button:
        "Teslim Edildi",
      next:
        "DELIVERED",
    };
  }

  return {
    label:
      "Teslim Edildi",
    badge:
      "bg-emerald-100 text-emerald-700",
    button: "",
    next: "",
  };
}

export default function IkasOrders() {
  const [
    section,
    setSection,
  ] = useState<OrderSection>(
    "new"
  );

  const [
    data,
    setData,
  ] = useState<
    OrdersResponse | null
  >(null);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  const [
    actionId,
    setActionId,
  ] = useState("");

  const [
    actionMessage,
    setActionMessage,
  ] = useState("");

  const loadOrders =
    useCallback(
      async (
        silent = false
      ) => {
        if (!silent) {
          setLoading(true);
        }

        setError("");

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

          setData(
            payload
          );
        } catch (err) {
          setError(
            err instanceof
              Error
              ? err.message
              : "İkas siparişleri alınamadı."
          );
        } finally {
          setLoading(false);
        }
      },
      []
    );

  useEffect(() => {
    void loadOrders();

    const timer =
      window.setInterval(
        () => {
          void loadOrders(
            true
          );
        },
        30_000
      );

    return () =>
      window.clearInterval(
        timer
      );
  }, [loadOrders]);

  const orders =
    useMemo(() => {
      const groups =
        data?.groups;

      if (!groups) {
        return [];
      }

      return (
        groups[section] ||
        []
      );
    }, [
      data,
      section,
    ]);

  const runAction =
    useCallback(
      async (
        order: IkasOrder
      ) => {
        const meta =
          statusMeta(
            section
          );

        if (!meta.next) {
          return;
        }

        const confirmed =
          window.confirm(
            `${order.orderNumber} siparişi "${meta.button}" durumuna geçirilsin mi?`
          );

        if (!confirmed) {
          return;
        }

        setActionId(
          order.id
        );
        setActionMessage(
          ""
        );
        setError("");

        try {
          const response =
            await fetch(
              "/api/online/ikas/orders",
              {
                method: "POST",
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
                      meta.next,
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
              `İkas sipariş işlem API JSON dönmedi. HTTP ${response.status}.`
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

          setActionMessage(
            payload?.message ||
              "Sipariş durumu güncellendi."
          );

          await loadOrders(
            true
          );
        } catch (err) {
          setError(
            err instanceof
              Error
              ? err.message
              : "Sipariş durumu değiştirilemedi."
          );
        } finally {
          setActionId("");
        }
      },
      [
        loadOrders,
        section,
      ]
    );

  const tabs:
    Array<{
      id: OrderSection;
      label: string;
      count: number;
    }> = [
    {
      id: "new",
      label:
        "Yeni Siparişler",
      count:
        data?.counts?.new ||
        0,
    },
    {
      id: "ready",
      label:
        "Kargoya Hazır",
      count:
        data?.counts
          ?.ready || 0,
    },
    {
      id: "shipped",
      label: "Kargoda",
      count:
        data?.counts
          ?.shipped || 0,
    },
    {
      id: "delivered",
      label:
        "Teslim Edildi",
      count:
        data?.counts
          ?.delivered || 0,
    },
  ];

  const meta =
    statusMeta(
      section
    );

  return (
    <div className="overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-slate-200 bg-gradient-to-r from-slate-950 via-violet-950 to-indigo-950 px-6 py-6 text-white xl:flex-row xl:items-center xl:justify-between">
        <div>
          <div className="text-[8px] font-black uppercase tracking-[0.2em] text-violet-200/70">
            Online · İkas
          </div>
          <h3 className="mt-1 text-2xl font-black">
            Sipariş Yönetimi
          </h3>
          <p className="mt-1 text-[9px] font-semibold text-slate-300">
            Yeni sipariş → Kargoya Hazır → Kargoda → Teslim Edildi
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            void loadOrders();
          }}
          disabled={loading}
          className="h-10 rounded-xl bg-violet-500 px-4 text-[8px] font-black uppercase text-white transition hover:bg-violet-400 disabled:opacity-50"
        >
          {loading
            ? "Yenileniyor..."
            : "Siparişleri Yenile"}
        </button>
      </div>

      <div className="border-b border-slate-200 bg-slate-50/70 p-4">
        <div className="flex flex-wrap gap-2">
          {tabs.map(
            (tab) => (
              <button
                key={
                  tab.id
                }
                type="button"
                onClick={() =>
                  setSection(
                    tab.id
                  )
                }
                className={`rounded-xl px-4 py-2.5 text-[9px] font-black uppercase transition ${
                  section ===
                  tab.id
                    ? tab.id ===
                      "new"
                      ? "bg-blue-600 text-white"
                      : tab.id ===
                        "ready"
                      ? "bg-amber-500 text-white"
                      : tab.id ===
                        "shipped"
                      ? "bg-violet-600 text-white"
                      : "bg-emerald-600 text-white"
                    : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                }`}
              >
                {tab.label} (
                {tab.count})
              </button>
            )
          )}

          <div className="ml-auto self-center text-[8px] font-bold text-slate-400">
            Canlı kontrol: 30 sn
          </div>
        </div>
      </div>

      {error && (
        <div className="border-b border-rose-200 bg-rose-50 px-5 py-3 text-[9px] font-black text-rose-700">
          {error}
        </div>
      )}

      {actionMessage && (
        <div className="border-b border-emerald-200 bg-emerald-50 px-5 py-3 text-[9px] font-black text-emerald-700">
          ✓ {actionMessage}
        </div>
      )}

      {loading &&
      !data ? (
        <div className="px-6 py-20 text-center">
          <div className="text-[11px] font-black text-slate-700">
            İkas siparişleri yükleniyor...
          </div>
        </div>
      ) : orders.length ===
        0 ? (
        <div className="px-6 py-20 text-center">
          <div className="text-[12px] font-black text-slate-700">
            {meta.label} siparişi yok
          </div>
          <div className="mt-2 text-[9px] font-semibold text-slate-400">
            İkas&apos;tan yeni sipariş geldiğinde bu ekrana düşecek.
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[1120px]">
            <div className="grid grid-cols-[130px_150px_minmax(260px,1fr)_70px_120px_100px_130px_125px] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 text-[7px] font-black uppercase tracking-wide text-slate-400">
              <div>Sipariş No</div>
              <div>Müşteri</div>
              <div>Ürün</div>
              <div>Adet</div>
              <div>Tutar</div>
              <div>Şehir</div>
              <div>Durum</div>
              <div>İşlem</div>
            </div>

            {orders.map(
              (order) => (
                <div
                  key={
                    order.id
                  }
                  className="grid min-h-[74px] grid-cols-[130px_150px_minmax(260px,1fr)_70px_120px_100px_130px_125px] items-center gap-3 border-b border-slate-100 px-4 py-3 text-[8px] last:border-0 hover:bg-slate-50/70"
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
                    <div className="truncate font-black text-slate-800">
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
                      ) && (
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
                    )}
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
                      className={`inline-flex rounded-full px-2.5 py-1 text-[7px] font-black uppercase ${meta.badge}`}
                    >
                      {
                        meta.label
                      }
                    </span>
                    {order.rawStatus && (
                      <div className="mt-1 max-w-[125px] truncate text-[6px] font-bold text-slate-400">
                        {
                          order.rawStatus
                        }
                      </div>
                    )}
                  </div>

                  <div>
                    {meta.next ? (
                      <button
                        type="button"
                        onClick={() => {
                          void runAction(
                            order
                          );
                        }}
                        disabled={
                          actionId ===
                          order.id
                        }
                        className={`h-9 rounded-xl px-3 text-[7px] font-black uppercase text-white transition disabled:cursor-wait disabled:opacity-50 ${
                          section ===
                          "new"
                            ? "bg-blue-600 hover:bg-blue-700"
                            : section ===
                              "ready"
                            ? "bg-violet-600 hover:bg-violet-700"
                            : "bg-emerald-600 hover:bg-emerald-700"
                        }`}
                      >
                        {actionId ===
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

      <div className="border-t border-slate-200 bg-slate-50 px-5 py-3 text-[8px] font-bold text-slate-400">
        Kaynak: İkas Admin API · Siparişler 30 saniyede bir yenilenir
      </div>
    </div>
  );
}
