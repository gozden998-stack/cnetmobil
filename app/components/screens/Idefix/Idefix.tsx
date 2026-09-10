"use client";

import React, { useEffect, useMemo, useState } from "react";

type IdefixProduct = {
  barcode?: string | null;
  title?: string | null;
  productMainId?: string | null;
  vendorStockCode?: string | null;
  inventoryQuantity?: number | null;
  price?: number | null;
  comparePrice?: number | null;
  state?: string | null;
  brandId?: number | null;
  categoryId?: number | null;
  imageUrl?: string | null;
};

type ProductResponse = {
  success?: boolean;
  connected?: boolean;
  vendorId?: string;
  totalCount?: number;
  products?: IdefixProduct[];
  checkedAt?: string;
  error?: string;
};


type IdefixOrderItem = {
  id?: number | null;
  productName?: string;
  barcode?: string;
  merchantSku?: string;
  image?: string;
  price?: number;
  discountedTotalPrice?: number;
  itemStatus?: string;
  brandName?: string;
};

type IdefixOrder = {
  id: number;
  orderNumber?: string;
  status?: string;
  statusDescription?: string;
  discountedTotalPrice?: number;
  customerContactName?: string;
  customerContactMail?: string;
  shippingAddress?: {
    fullName?: string;
    fullAddress?: string;
    city?: string;
    county?: string;
    phone?: string;
  };
  cargoTrackingNumber?: string;
  cargoTrackingUrl?: string;
  cargoCompany?: string;
  cargoProfileName?: string;
  cargoKey?: string;
  invoiceNumber?: string;
  orderDate?: string;
  updatedAt?: string;
  estimatedDeliveryDate?: string;
  items?: IdefixOrderItem[];
};

type OrdersResponse = {
  success?: boolean;
  vendorId?: string;
  totalCount?: number;
  counts?: {
    new?: number;
    preparing?: number;
    cargo?: number;
    delivered?: number;
    other?: number;
  };
  orders?: IdefixOrder[];
  checkedAt?: string;
  error?: string;
};

type OrderFilter = "all" | "new" | "preparing" | "cargo" | "delivered";

type TabKey = "orders" | "open" | "closed";

function money(value: unknown) {
  const n = Number(value || 0);
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("tr-TR");
}

function text(value: unknown) {
  return String(value ?? "").trim();
}

function isOpenProduct(product: IdefixProduct) {
  return Number(product.inventoryQuantity || 0) > 0;
}


function orderBucket(status?: string | null): OrderFilter | "other" {
  const value = text(status).toLowerCase();
  if (["created", "shipment_ready"].includes(value)) return "new";
  if (["shipment_picking", "shipment_invoiced"].includes(value)) return "preparing";
  if (value === "shipment_in_cargo") return "cargo";
  if (["shipment_delivered", "shipment_approved"].includes(value)) return "delivered";
  return "other";
}

function orderStatusLabel(status?: string | null, description?: string | null) {
  if (text(description)) return text(description);
  const labels: Record<string, string> = {
    created: "Oluşturuldu",
    shipment_ready: "Yeni Sipariş",
    shipment_picking: "Hazırlanıyor",
    shipment_invoiced: "Faturalandı",
    shipment_in_cargo: "Kargoda",
    shipment_delivered: "Teslim Edildi",
    shipment_approved: "Tamamlandı",
    shipment_cancelled: "İptal Edildi",
    shipment_unsupplied: "Tedarik Edilemedi",
    shipment_undeliver: "Teslim Edilemedi",
    shipment_split: "Bölündü",
  };
  return labels[text(status).toLowerCase()] || text(status) || "-";
}

function orderStatusClass(status?: string | null) {
  const bucket = orderBucket(status);
  if (bucket === "new") return "bg-blue-100 text-blue-700";
  if (bucket === "preparing") return "bg-amber-100 text-amber-700";
  if (bucket === "cargo") return "bg-violet-100 text-violet-700";
  if (bucket === "delivered") return "bg-emerald-100 text-emerald-700";
  return "bg-slate-100 text-slate-600";
}

export default function Idefix() {
  const [data, setData] = useState<ProductResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<TabKey>("open");
  const [sort, setSort] = useState("newest");
  const [ordersData, setOrdersData] = useState<OrdersResponse | null>(null);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState("");
  const [orderMessage, setOrderMessage] = useState("");
  const [orderFilter, setOrderFilter] = useState<OrderFilter>("all");
  const [orderSearch, setOrderSearch] = useState("");
  const [orderActionId, setOrderActionId] = useState<number | null>(null);

  const loadOrders = async () => {
    setOrdersLoading(true);
    setOrdersError("");

    try {
      const response = await fetch("/api/online/idefix/orders", {
        method: "GET",
        cache: "no-store",
        headers: { Accept: "application/json" },
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || "İdefix siparişleri alınamadı.");
      }

      setOrdersData(payload);
    } catch (e: any) {
      setOrdersError(e?.message || "İdefix siparişleri alınamadı.");
    } finally {
      setOrdersLoading(false);
    }
  };

  const runOrderAction = async (
    order: IdefixOrder,
    action: "PICKING" | "INVOICED" | "TRACKING"
  ) => {
    let body: Record<string, unknown> = {
      action,
      shipmentId: order.id,
    };

    if (action === "INVOICED") {
      const invoiceNumber = window.prompt(
        `${order.orderNumber || "Sipariş"} için fatura numarası:` ,
        order.invoiceNumber || ""
      );
      if (invoiceNumber === null) return;
      if (!invoiceNumber.trim()) {
        setOrdersError("Fatura numarası boş bırakılamaz.");
        return;
      }
      body.invoiceNumber = invoiceNumber.trim();
    }

    if (action === "TRACKING") {
      const trackingNumber = window.prompt(
        `${order.orderNumber || "Sipariş"} için kargo takip numarası:`,
        order.cargoTrackingNumber || ""
      );
      if (trackingNumber === null) return;
      if (!trackingNumber.trim()) {
        setOrdersError("Kargo takip numarası boş bırakılamaz.");
        return;
      }

      const trackingUrl = window.prompt(
        "Kargo takip linkini gir:",
        order.cargoTrackingUrl || "https://"
      );
      if (trackingUrl === null) return;
      if (!trackingUrl.trim() || trackingUrl.trim() === "https://") {
        setOrdersError("Kargo takip linki boş bırakılamaz.");
        return;
      }

      body.trackingNumber = trackingNumber.trim();
      body.trackingUrl = trackingUrl.trim();
    }

    setOrderActionId(order.id);
    setOrdersError("");
    setOrderMessage("");

    try {
      const response = await fetch("/api/online/idefix/orders", {
        method: "PUT",
        cache: "no-store",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || "İdefix sipariş işlemi başarısız.");
      }

      setOrderMessage(payload?.message || "İdefix sipariş işlemi tamamlandı.");
      await loadOrders();
    } catch (e: any) {
      setOrdersError(e?.message || "İdefix sipariş işlemi başarısız.");
    } finally {
      setOrderActionId(null);
    }
  };

  const openTracking = async (order: IdefixOrder) => {
    if (order.cargoTrackingUrl) {
      window.open(order.cargoTrackingUrl, "_blank", "noopener,noreferrer");
      return;
    }

    if (order.cargoTrackingNumber) {
      try {
        await navigator.clipboard.writeText(order.cargoTrackingNumber);
        setOrderMessage(`Kargo takip numarası kopyalandı: ${order.cargoTrackingNumber}`);
      } catch {
        setOrderMessage(`Kargo takip numarası: ${order.cargoTrackingNumber}`);
      }
      return;
    }

    setOrderMessage("Bu sipariş için henüz kargo takip bilgisi yok.");
  };

  const load = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/online/idefix/products", {
        method: "GET",
        cache: "no-store",
        headers: { Accept: "application/json" },
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || "İdefix ürünleri alınamadı.");
      }

      setData(payload);
    } catch (e: any) {
      setError(e?.message || "İdefix verileri alınamadı.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    loadOrders();
  }, []);

  const products = useMemo(
    () => (Array.isArray(data?.products) ? data!.products! : []),
    [data]
  );

  const openProducts = useMemo(
    () => products.filter(isOpenProduct),
    [products]
  );

  const orders = useMemo(
    () => (Array.isArray(ordersData?.orders) ? ordersData!.orders! : []),
    [ordersData]
  );

  const filteredOrders = useMemo(() => {
    const q = orderSearch.trim().toLocaleLowerCase("tr-TR");

    return orders.filter((order) => {
      if (orderFilter !== "all" && orderBucket(order.status) !== orderFilter) {
        return false;
      }

      if (!q) return true;

      return [
        order.orderNumber,
        order.customerContactName,
        order.cargoTrackingNumber,
        order.cargoCompany,
        ...(Array.isArray(order.items) ? order.items.map((item) => item.productName) : []),
      ]
        .map((value) => text(value).toLocaleLowerCase("tr-TR"))
        .some((value) => value.includes(q));
    });
  }, [orders, orderFilter, orderSearch]);


  const closedProducts = useMemo(
    () => products.filter((item) => !isOpenProduct(item)),
    [products]
  );

  const physicalStock = useMemo(
    () =>
      products.reduce(
        (sum, item) => sum + Math.max(0, Number(item.inventoryQuantity || 0)),
        0
      ),
    [products]
  );

  const averagePrice = useMemo(() => {
    const priced = openProducts
      .map((item) => Number(item.price || 0))
      .filter((value) => Number.isFinite(value) && value > 0);

    if (!priced.length) return 0;
    return priced.reduce((sum, value) => sum + value, 0) / priced.length;
  }, [openProducts]);

  const filteredProducts = useMemo(() => {
    const base = tab === "closed" ? closedProducts : openProducts;
    const q = search.trim().toLocaleLowerCase("tr-TR");

    const result = base.filter((item) => {
      if (!q) return true;

      return [
        item.title,
        item.barcode,
        item.productMainId,
        item.vendorStockCode,
      ]
        .map((value) => text(value).toLocaleLowerCase("tr-TR"))
        .some((value) => value.includes(q));
    });

    return [...result].sort((a, b) => {
      if (sort === "priceAsc") return Number(a.price || 0) - Number(b.price || 0);
      if (sort === "priceDesc") return Number(b.price || 0) - Number(a.price || 0);
      if (sort === "stockDesc") {
        return Number(b.inventoryQuantity || 0) - Number(a.inventoryQuantity || 0);
      }
      return text(b.productMainId).localeCompare(text(a.productMainId), "tr");
    });
  }, [tab, openProducts, closedProducts, search, sort]);

  const totalListing = Number(data?.totalCount ?? products.length);

  return (
    <div className="animate-in fade-in duration-300 space-y-4">
      <section className="overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-blue-100 bg-gradient-to-r from-white via-slate-50 to-blue-50 px-5 py-5 sm:px-7">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex min-w-0 items-start gap-4">
              <div className="flex h-[74px] w-[74px] shrink-0 items-center justify-center rounded-[22px] border border-violet-100 bg-white text-3xl font-black text-violet-700 shadow-sm">
                id
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-xl font-black tracking-tight text-slate-950 sm:text-2xl">
                    İdefix Entegrasyonu
                  </h1>

                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[8px] font-black uppercase tracking-wide text-emerald-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    API Bağlı
                  </span>
                </div>

                <p className="mt-2 text-[10px] font-semibold text-slate-500 sm:text-[11px]">
                  İdefix mağazanız ile ürünlerinizi senkronize edin, fiyat ve stoklarınızı tek panelden yönetin.
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px] font-bold text-slate-500">
                  <span>
                    Mağaza: <b className="text-slate-900">Cnetmobil</b>
                  </span>
                  <span className="text-slate-300">•</span>
                  <span>
                    Satıcı ID: <b className="text-slate-900">{data?.vendorId || "-"}</b>
                  </span>
                  <span className="text-slate-300">•</span>
                  <span>
                    Son Senkronizasyon:{" "}
                    <b className="text-slate-900">{formatDateTime(data?.checkedAt)}</b>
                  </span>
                </div>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  load();
                  loadOrders();
                }}
                disabled={loading || ordersLoading}
                className="h-10 rounded-xl border border-slate-200 bg-white px-5 text-[9px] font-black uppercase text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
              >
                {loading || ordersLoading ? "Yenileniyor..." : "Yenile"}
              </button>
            </div>
          </div>
        </div>

        <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
          {[
            {
              label: "TOPLAM İDEFİX İLANI",
              value: totalListing,
              sub: "İdefix ürün kaydı",
              icon: "◇",
              box: "bg-blue-50 text-blue-700",
            },
            {
              label: "SİPARİŞLER",
              value: Number(ordersData?.counts?.new || 0),
              sub: `${Number(ordersData?.totalCount || 0)} toplam sipariş`,
              icon: "🛒",
              box: "bg-emerald-50 text-emerald-700",
            },
            {
              label: "SATIŞTAKİ İLAN",
              value: openProducts.length,
              sub: "Stoklu İdefix ilanı",
              icon: "◎",
              box: "bg-cyan-50 text-cyan-700",
            },
            {
              label: "FİZİKSEL STOK",
              value: physicalStock,
              sub: "Satıştaki toplam cihaz",
              icon: "◉",
              box: "bg-emerald-50 text-emerald-700",
            },
            {
              label: "ORTALAMA FİYAT",
              value: money(averagePrice),
              sub: "Satıştaki İdefix ilanları",
              icon: "₺",
              box: "bg-violet-50 text-violet-700",
            },
          ].map((card) => (
            <div
              key={card.label}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-base font-black ${card.box}`}
                >
                  {card.icon}
                </div>
                <div className="min-w-0">
                  <div className="text-[8px] font-black uppercase tracking-wide text-slate-400">
                    {card.label}
                  </div>
                  <div className="mt-1 truncate text-lg font-black text-slate-950">
                    {card.value}
                  </div>
                  <div className="mt-0.5 truncate text-[8px] font-semibold text-slate-400">
                    {card.sub}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mx-4 mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-2.5 text-[8px] font-bold text-slate-500">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 font-black uppercase text-emerald-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Aktif
            </span>
            <span>Kanal: İdefix</span>
            <span>Entegratör: CNETMOBİL</span>
            <span>Ürün/Stok: Canlı API</span>
          </div>

          <div>
            Fiziksel aktif stok:{" "}
            <b className="text-slate-900">{physicalStock}</b>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setTab("orders")}
              className={`rounded-xl px-4 py-2 text-[9px] font-black transition ${
                tab === "orders"
                  ? "border border-blue-200 bg-blue-50 text-blue-700"
                  : "text-slate-700 hover:bg-slate-50"
              }`}
            >
              Siparişler ({Number(ordersData?.totalCount || 0)})
            </button>

            <button
              type="button"
              onClick={() => setTab("open")}
              className={`rounded-xl px-4 py-2 text-[9px] font-black transition ${
                tab === "open"
                  ? "border border-blue-200 bg-blue-50 text-blue-700"
                  : "text-slate-700 hover:bg-slate-50"
              }`}
            >
              Satışa Açık ({openProducts.length} ilan · {physicalStock} cihaz)
            </button>

            <button
              type="button"
              onClick={() => setTab("closed")}
              className={`rounded-xl px-4 py-2 text-[9px] font-black transition ${
                tab === "closed"
                  ? "border border-blue-200 bg-blue-50 text-blue-700"
                  : "text-slate-700 hover:bg-slate-50"
              }`}
            >
              Satışa Kapalı ({closedProducts.length})
            </button>
          </div>

          {tab !== "orders" && (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Marka, model, barkod veya SKU ara..."
                  className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 pr-9 text-[9px] font-semibold outline-none focus:border-blue-400 sm:w-[280px]"
                />
                <span className="absolute right-3 top-2.5 text-slate-400">⌕</span>
              </div>

              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-[9px] font-black text-slate-700 outline-none"
              >
                <option value="newest">En Yeni</option>
                <option value="priceAsc">Fiyat Artan</option>
                <option value="priceDesc">Fiyat Azalan</option>
                <option value="stockDesc">Stok Çoktan Aza</option>
              </select>
            </div>
          )}
        </div>

        {error && (
          <div className="m-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[10px] font-black text-rose-700">
            {error}
          </div>
        )}

        {tab === "orders" ? (
          <div>
            <div className="border-b border-slate-100 bg-slate-50/70 px-4 py-3">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex flex-wrap gap-2">
                  {[
                    ["all", "Tümü", orders.length],
                    ["new", "Yeni", Number(ordersData?.counts?.new || 0)],
                    ["preparing", "Hazırlanıyor", Number(ordersData?.counts?.preparing || 0)],
                    ["cargo", "Kargoda", Number(ordersData?.counts?.cargo || 0)],
                    ["delivered", "Teslim", Number(ordersData?.counts?.delivered || 0)],
                  ].map(([key, label, count]) => (
                    <button
                      key={String(key)}
                      type="button"
                      onClick={() => setOrderFilter(key as OrderFilter)}
                      className={`rounded-xl px-3 py-2 text-[8px] font-black transition ${
                        orderFilter === key
                          ? "bg-slate-900 text-white"
                          : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {String(label)} ({Number(count)})
                    </button>
                  ))}
                </div>

                <div className="flex gap-2">
                  <input
                    value={orderSearch}
                    onChange={(e) => setOrderSearch(e.target.value)}
                    placeholder="Sipariş, müşteri, ürün, kargo ara..."
                    className="h-9 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-[9px] font-semibold outline-none focus:border-blue-400 sm:w-[300px]"
                  />
                  <button
                    type="button"
                    onClick={loadOrders}
                    disabled={ordersLoading}
                    className="h-9 rounded-xl border border-blue-200 bg-blue-50 px-3 text-[8px] font-black text-blue-700 disabled:opacity-50"
                  >
                    {ordersLoading ? "..." : "Sipariş Yenile"}
                  </button>
                </div>
              </div>
            </div>

            {ordersError && (
              <div className="m-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[9px] font-bold leading-5 text-rose-700">
                {ordersError}
              </div>
            )}

            {orderMessage && (
              <div className="m-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[9px] font-bold leading-5 text-emerald-700">
                {orderMessage}
              </div>
            )}

            {ordersLoading && orders.length === 0 ? (
              <div className="flex min-h-[280px] items-center justify-center text-[10px] font-black text-slate-400">
                İdefix siparişleri yükleniyor...
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1250px] text-left">
                  <thead>
                    <tr className="border-b border-slate-200 bg-white text-[8px] font-black uppercase tracking-wide text-slate-500">
                      <th className="px-4 py-3">Sipariş</th>
                      <th className="px-4 py-3">Müşteri</th>
                      <th className="px-4 py-3">Ürün</th>
                      <th className="px-4 py-3">Tutar</th>
                      <th className="px-4 py-3">Kargo / Takip</th>
                      <th className="px-4 py-3">Durum</th>
                      <th className="px-4 py-3">İşlem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredOrders.map((order) => {
                      const status = text(order.status).toLowerCase();
                      const firstItem = Array.isArray(order.items) ? order.items[0] : null;
                      const busy = orderActionId === order.id;

                      return (
                        <tr key={order.id} className="align-top hover:bg-slate-50/60">
                          <td className="px-4 py-4">
                            <div className="text-[10px] font-black text-slate-950">{order.orderNumber || `#${order.id}`}</div>
                            <div className="mt-1 text-[7px] font-semibold text-slate-400">Shipment: {order.id}</div>
                            <div className="mt-1 text-[7px] font-semibold text-slate-400">{formatDateTime(order.orderDate)}</div>
                          </td>

                          <td className="px-4 py-4">
                            <div className="max-w-[190px] truncate text-[9px] font-black text-slate-800">{order.customerContactName || order.shippingAddress?.fullName || "-"}</div>
                            <div className="mt-1 text-[7px] font-semibold text-slate-500">{[order.shippingAddress?.county, order.shippingAddress?.city].filter(Boolean).join(" / ") || "-"}</div>
                            <div className="mt-1 max-w-[220px] text-[7px] font-medium leading-4 text-slate-400">{order.shippingAddress?.fullAddress || ""}</div>
                          </td>

                          <td className="px-4 py-4">
                            <div className="flex min-w-[270px] items-start gap-2.5">
                              <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white">
                                {firstItem?.image ? (
                                  <img src={firstItem.image} alt={firstItem.productName || "Ürün"} className="h-full w-full object-contain" />
                                ) : (
                                  <span className="text-lg">📱</span>
                                )}
                              </div>
                              <div className="min-w-0">
                                <div className="max-w-[320px] text-[9px] font-black leading-4 text-slate-900">{firstItem?.productName || "İdefix Ürünü"}</div>
                                <div className="mt-1 text-[7px] font-semibold text-slate-400">{order.items?.length || 0} kalem</div>
                                {firstItem?.merchantSku && <div className="mt-0.5 text-[7px] font-semibold text-slate-400">SKU: {firstItem.merchantSku}</div>}
                              </div>
                            </div>
                          </td>

                          <td className="px-4 py-4">
                            <div className="text-[11px] font-black text-slate-950">{money(order.discountedTotalPrice)}</div>
                          </td>

                          <td className="px-4 py-4">
                            <div className="text-[8px] font-black text-slate-700">{order.cargoCompany || order.cargoProfileName || "Kargo bekleniyor"}</div>
                            {order.cargoKey && <div className="mt-1 text-[7px] font-semibold text-slate-500">Kargo kodu: {order.cargoKey}</div>}
                            {order.cargoTrackingNumber && <div className="mt-1 text-[7px] font-semibold text-violet-600">Takip: {order.cargoTrackingNumber}</div>}
                            {order.estimatedDeliveryDate && <div className="mt-1 text-[7px] font-semibold text-slate-400">Tahmini: {formatDateTime(order.estimatedDeliveryDate)}</div>}
                          </td>

                          <td className="px-4 py-4">
                            <span className={`inline-flex rounded-full px-2.5 py-1 text-[8px] font-black ${orderStatusClass(order.status)}`}>
                              {orderStatusLabel(order.status, order.statusDescription)}
                            </span>
                          </td>

                          <td className="px-4 py-4">
                            <div className="flex min-w-[200px] flex-wrap gap-1.5">
                              {["created", "shipment_ready"].includes(status) && (
                                <button type="button" onClick={() => runOrderAction(order, "PICKING")} disabled={busy} className="h-8 rounded-lg border border-amber-200 bg-amber-50 px-3 text-[7px] font-black text-amber-700 disabled:opacity-50">
                                  {busy ? "..." : "Hazırlamaya Başla"}
                                </button>
                              )}

                              {status === "shipment_picking" && (
                                <button type="button" onClick={() => runOrderAction(order, "INVOICED")} disabled={busy} className="h-8 rounded-lg border border-blue-200 bg-blue-50 px-3 text-[7px] font-black text-blue-700 disabled:opacity-50">
                                  {busy ? "..." : "Faturalandı"}
                                </button>
                              )}

                              {status === "shipment_invoiced" && !order.cargoTrackingNumber && (
                                <button type="button" onClick={() => runOrderAction(order, "TRACKING")} disabled={busy} className="h-8 rounded-lg bg-violet-700 px-3 text-[7px] font-black text-white disabled:opacity-50">
                                  {busy ? "..." : "Kargoya Ver"}
                                </button>
                              )}

                              {(order.cargoTrackingNumber || order.cargoTrackingUrl) && (
                                <button type="button" onClick={() => openTracking(order)} className="h-8 rounded-lg border border-violet-200 bg-violet-50 px-3 text-[7px] font-black text-violet-700">
                                  Kargo Takip
                                </button>
                              )}

                              {status === "shipment_in_cargo" && !order.cargoTrackingNumber && (
                                <span className="inline-flex h-8 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-[7px] font-black text-slate-500">
                                  Takip kodu bekleniyor
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}

                    {filteredOrders.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-5 py-16 text-center text-[10px] font-bold text-slate-400">
                          Bu filtrede İdefix siparişi bulunamadı.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : loading ? (
          <div className="flex min-h-[300px] items-center justify-center text-[11px] font-black text-slate-400">
            İdefix verileri yükleniyor...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[8px] font-black uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-3">Ürün</th>
                  <th className="px-5 py-3">Stok</th>
                  <th className="px-5 py-3">Durum</th>
                  <th className="px-5 py-3">İdefix Satış Fiyatı</th>
                  <th className="px-5 py-3">İdefix Liste Fiyatı</th>
                  <th className="px-5 py-3">İşlemler</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {filteredProducts.map((product, index) => {
                  const open = isOpenProduct(product);

                  return (
                    <tr key={`${product.barcode || product.productMainId || index}`} className="hover:bg-slate-50/60">
                      <td className="px-5 py-4">
                        <div className="flex items-start gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-lg">
                            📱
                          </div>

                          <div className="min-w-0">
                            <div className="max-w-[420px] truncate text-[10px] font-black text-slate-950">
                              {product.title || "İdefix Ürünü"}
                            </div>

                            <div className="mt-1 flex flex-wrap gap-1">
                              {product.brandId && (
                                <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[7px] font-bold text-slate-500">
                                  Marka: {product.brandId}
                                </span>
                              )}
                              {product.categoryId && (
                                <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[7px] font-bold text-slate-500">
                                  Kategori: {product.categoryId}
                                </span>
                              )}
                            </div>

                            <div className="mt-1 text-[7px] font-semibold text-slate-400">
                              SKU: {product.vendorStockCode || "-"}
                              <span className="mx-2 text-slate-200">|</span>
                              Barkod: {product.barcode || "-"}
                              <span className="mx-2 text-slate-200">|</span>
                              ID: {product.productMainId || "-"}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <div className="text-base font-black text-slate-950">
                          {Number(product.inventoryQuantity || 0)}
                        </div>
                        <div className="text-[7px] font-semibold text-slate-400">Adet</div>
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-[8px] font-black ${
                            open
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {open ? "Yayında" : "Kapalı"}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <div className="text-[11px] font-black text-slate-950">
                          {money(product.price)}
                        </div>
                        <div className="mt-0.5 text-[7px] font-semibold text-slate-400">
                          İdefix Satış Fiyatı
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <div className="text-[11px] font-black text-slate-950">
                          {money(product.comparePrice || product.price)}
                        </div>
                        <div className="mt-0.5 text-[7px] font-semibold text-slate-400">
                          İdefix Liste Fiyatı
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-[8px] font-black text-slate-700"
                          >
                            Düzenle
                          </button>
                          <button
                            type="button"
                            className="h-8 rounded-lg border border-blue-200 bg-blue-50 px-3 text-[8px] font-black text-blue-700"
                          >
                            Fiyat
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {filteredProducts.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-14 text-center text-[10px] font-bold text-slate-400">
                      Bu sekmede gösterilecek İdefix ürünü bulunamadı.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
