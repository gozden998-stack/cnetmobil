"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";

type CatalogItem = {
  id: number;
  brandModel: string;
  memory: string;
  color: string;
  grade: string;
  basePrice: number;
  stockQuantity: number;
  imageUrl: string;
};

type Order = {
  id: number;
  status: "AWAITING_PAYMENT" | "PAID" | "PREPARING" | "SHIPPED" | "CANCELLED";
  totalBaseAmount: number;
  totalSaleAmount: number;
  commissionAmount: number;
  trackingNo: string;
  createdAt: string;
  paidAt: string | null;
  shippedAt: string | null;
  paymentUrl: string | null;
};

type CartEntry = { item: CatalogItem; salePrice: number; quantity: number };
type Tab = "ana_sayfa" | "cihaz_al" | "ihale";

const STATUS_LABEL: Record<string, string> = {
  AWAITING_PAYMENT: "Ödeme Bekleniyor",
  PAID: "Ödendi",
  PREPARING: "Hazırlanıyor",
  SHIPPED: "Kargoya Verildi",
  CANCELLED: "İptal",
};

const STATUS_TONE: Record<string, string> = {
  AWAITING_PAYMENT: "bg-amber-50 text-amber-700 ring-amber-200",
  PAID: "bg-blue-50 text-blue-700 ring-blue-200",
  PREPARING: "bg-violet-50 text-violet-700 ring-violet-200",
  SHIPPED: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  CANCELLED: "bg-red-50 text-red-700 ring-red-200",
};

function formatTry(value: number) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: string | null) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString("tr-TR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "-";
  }
}

function gradeTone(grade: string) {
  const normalized = grade.trim().toLocaleUpperCase("tr-TR");

  if (normalized.includes("MÜKEMMEL")) return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (normalized.includes("ÇOK İYİ") || normalized.includes("COK IYI"))
    return "bg-blue-50 text-blue-700 ring-blue-200";
  if (normalized.includes("İYİ") || normalized.includes("IYI"))
    return "bg-amber-50 text-amber-700 ring-amber-200";

  return "bg-slate-100 text-slate-600 ring-slate-200";
}

function initials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || "")
      .join("") || "İO"
  );
}

function HomeIcon({ className = "h-4.5 w-4.5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.9} d="M3 11.5L12 4l9 7.5M5 10v9a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1v-9" />
    </svg>
  );
}

function CartIcon({ className = "h-4.5 w-4.5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m-10 4a1 1 0 102 0 1 1 0 00-2 0zm10 0a1 1 0 102 0 1 1 0 00-2 0z" />
    </svg>
  );
}

function GavelIcon({ className = "h-4.5 w-4.5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M14 4l6 6M3 21l7-7M9 13l-4.5-4.5a1 1 0 010-1.4l2-2a1 1 0 011.4 0L12.5 9.5M11 11l6-6M13 9l4.5 4.5a1 1 0 010 1.4l-2 2a1 1 0 01-1.4 0L9.5 12.5" />
    </svg>
  );
}

function CardIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 8h18M5 5h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2zM6 16h4" />
    </svg>
  );
}

function ShieldCheckIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.5 12.2l1.8 1.8 3.2-3.6" />
    </svg>
  );
}

function SearchIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-5-5m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );
}

function LogoutIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 8H6a2 2 0 01-2-2V6a2 2 0 012-2h7" />
    </svg>
  );
}

function BoxIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8M12 13v8" />
    </svg>
  );
}

function ChevronRightIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.3} d="M9 5l7 7-7 7" />
    </svg>
  );
}

function DocumentIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M7 3h7l5 5v13a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1zM14 3v5h5M9 13h6M9 17h6" />
    </svg>
  );
}

function MoreIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <circle cx="5" cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="19" cy="12" r="1.6" />
    </svg>
  );
}

function EmptyCartIcon({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m-10 4a1 1 0 102 0 1 1 0 00-2 0zm10 0a1 1 0 102 0 1 1 0 00-2 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M18 3l.6 1.6L20 5l-1.4.6L18 7l-.6-1.4L16 5l1.4-.4z" />
    </svg>
  );
}

const TABS: Array<{ key: Tab; label: string; icon: (p: { className?: string }) => React.JSX.Element }> = [
  { key: "ana_sayfa", label: "Ana Sayfa", icon: HomeIcon },
  { key: "cihaz_al", label: "Cihaz Al", icon: CartIcon },
  { key: "ihale", label: "İhale", icon: GavelIcon },
];

export default function BayiPortal() {
  const [checkingSession, setCheckingSession] = useState(true);
  const [companyName, setCompanyName] = useState("");
  const [tab, setTab] = useState<Tab>("ana_sayfa");

  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [brandFilter, setBrandFilter] = useState("TÜMÜ");

  const [priceDrafts, setPriceDrafts] = useState<Record<number, string>>({});
  const [qtyDrafts, setQtyDrafts] = useState<Record<number, string>>({});
  const [cart, setCart] = useState<Record<number, CartEntry>>({});
  const [checkingOut, setCheckingOut] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");

  const checkSession = useCallback(async () => {
    try {
      const response = await fetch("/api/dealer-auth", {
        method: "GET",
        cache: "no-store",
        credentials: "same-origin",
      });

      const result = await response.json().catch(() => ({}));

      if (response.ok && result?.ok) {
        setCompanyName(result.companyName || "");
        setCheckingSession(false);
      } else {
        // Bayi girişi artık tek noktadan (ana giriş ekranı) yapılıyor -
        // burada ayrı bir giriş formu YOK, oturum yoksa direkt oraya
        // döneriz.
        window.location.href = "/";
      }
    } catch {
      window.location.href = "/";
    }
  }, []);

  const loadData = useCallback(async () => {
    try {
      const [catalogRes, ordersRes] = await Promise.all([
        fetch("/api/dealer/catalog", { cache: "no-store", credentials: "same-origin" }),
        fetch("/api/dealer/orders", { cache: "no-store", credentials: "same-origin" }),
      ]);

      const catalogResult = await catalogRes.json().catch(() => ({}));
      const ordersResult = await ordersRes.json().catch(() => ({}));

      if (!catalogRes.ok || !catalogResult?.ok) {
        throw new Error(catalogResult?.error || "Katalog alınamadı.");
      }

      if (!ordersRes.ok || !ordersResult?.ok) {
        throw new Error(ordersResult?.error || "Siparişler alınamadı.");
      }

      setCatalog(Array.isArray(catalogResult.items) ? catalogResult.items : []);
      setOrders(Array.isArray(ordersResult.orders) ? ordersResult.orders : []);
      setError("");
    } catch (err: any) {
      setError(err?.message || "Veriler alınamadı.");
    }
  }, []);

  useEffect(() => {
    void checkSession();
  }, [checkSession]);

  useEffect(() => {
    if (!companyName) return;
    void loadData();

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") void loadData();
    }, 8000);

    return () => window.clearInterval(intervalId);
  }, [companyName, loadData]);

  const logout = async () => {
    try {
      await fetch("/api/dealer-auth", { method: "DELETE", credentials: "same-origin" });
    } finally {
      window.location.href = "/";
    }
  };

  const getPriceDraft = (item: CatalogItem) =>
    priceDrafts[item.id] ?? String(item.basePrice.toFixed(2));

  const getQtyDraft = (itemId: number) => qtyDrafts[itemId] ?? "1";

  const addToCart = (item: CatalogItem) => {
    const salePrice = Number(getPriceDraft(item));
    const quantity = Math.max(1, Number(getQtyDraft(item.id)) || 1);

    if (!Number.isFinite(salePrice) || salePrice < item.basePrice) {
      setCheckoutError(
        `${item.brandModel}: satış fiyatı en az ${formatTry(item.basePrice)} olmalı.`
      );
      return;
    }

    setCheckoutError("");
    setCart((prev) => ({ ...prev, [item.id]: { item, salePrice, quantity } }));
  };

  const removeFromCart = (itemId: number) => {
    setCart((prev) => {
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
  };

  const cartEntries = useMemo(() => Object.values(cart), [cart]);

  const cartTotals = useMemo(() => {
    let totalSale = 0;
    let totalBase = 0;

    for (const entry of cartEntries) {
      totalSale += entry.salePrice * entry.quantity;
      totalBase += entry.item.basePrice * entry.quantity;
    }

    return { totalSale, totalBase, commission: Math.round((totalSale - totalBase) * 100) / 100 };
  }, [cartEntries]);

  const brandOptions = useMemo(() => {
    const brands = new Set(
      catalog.map((item) => item.brandModel.trim().split(/\s+/)[0]).filter(Boolean)
    );
    return ["TÜMÜ", ...Array.from(brands).sort((a, b) => a.localeCompare(b, "tr"))];
  }, [catalog]);

  const filteredCatalog = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("tr-TR");

    return catalog.filter((item) => {
      const matchesBrand =
        brandFilter === "TÜMÜ" || item.brandModel.trim().startsWith(brandFilter);

      const matchesQuery =
        !query ||
        `${item.brandModel} ${item.memory} ${item.color} ${item.grade}`
          .toLocaleLowerCase("tr-TR")
          .includes(query);

      return matchesBrand && matchesQuery;
    });
  }, [catalog, search, brandFilter]);

  const homeStats = useMemo(() => {
    const completed = orders.filter((o) => o.status !== "CANCELLED" && o.status !== "AWAITING_PAYMENT");
    const totalDevices = completed.length;
    const totalSpent = completed.reduce((sum, o) => sum + o.totalSaleAmount, 0);
    const totalCommission = completed.reduce((sum, o) => sum + o.commissionAmount, 0);
    const pending = orders.filter((o) => o.status === "AWAITING_PAYMENT").length;
    const inProgress = orders.filter((o) => o.status === "PAID" || o.status === "PREPARING").length;

    return { totalDevices, totalSpent, totalCommission, pending, inProgress };
  }, [orders]);

  const submitCheckout = async () => {
    if (checkingOut || cartEntries.length === 0) return;

    setCheckingOut(true);
    setCheckoutError("");

    try {
      const response = await fetch("/api/dealer/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          items: cartEntries.map((entry) => ({
            catalogItemId: entry.item.id,
            salePrice: entry.salePrice,
            quantity: entry.quantity,
          })),
        }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result?.ok) {
        throw new Error(result?.error || "Sipariş oluşturulamadı.");
      }

      if (result.orderId) {
        window.location.href = `/bayi/odeme/${result.orderId}`;
        return;
      }

      setCart({});
      void loadData();
    } catch (err: any) {
      setCheckoutError(err?.message || "Sipariş oluşturulamadı.");
    } finally {
      setCheckingOut(false);
    }
  };

  const continuePayment = (order: Order) => {
    window.location.href = `/bayi/odeme/${order.id}`;
  };

  if (checkingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f5f7fb] text-sm font-bold text-slate-400">
        Yükleniyor...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f7fb] pb-16">
      {/* TOPBAR */}
      <header className="sticky top-0 z-20 w-full bg-gradient-to-r from-[#10233f] via-[#15345d] to-[#10233f] shadow-[0_10px_30px_rgba(15,23,42,0.22)]">
        <div className="border-b border-white/10">
          <div className="mx-auto flex min-h-[64px] max-w-[1600px] items-center justify-between gap-3 px-4 lg:px-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/10">
                <span className="text-sm font-black text-white">CP</span>
              </div>
              <div className="hidden sm:block">
                <div className="text-[22px] font-black leading-none tracking-tight text-white">
                  Cnet<span className="text-blue-300">mobil</span>
                  <span className="ml-2 text-[10px] font-black uppercase tracking-[0.18em] text-blue-200">
                    Partner
                  </span>
                </div>
                <div className="mt-1 text-[7px] font-black uppercase tracking-[0.38em] text-blue-200/70">
                  Türkiye&apos;nin Yenilenmiş Cep Telefonu Markası
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <div className="hidden h-8 w-px bg-white/10 sm:block" />

              <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-1.5 pr-2 sm:gap-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-[10px] font-black text-white shadow-lg shadow-blue-950/20">
                  {initials(companyName)}
                </div>
                <div className="hidden min-w-[110px] md:block">
                  <div className="truncate text-[10px] font-black text-white">{companyName}</div>
                  <div className="mt-0.5 text-[8px] font-bold uppercase tracking-wider text-blue-200/60">
                    İş Ortağı
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={logout}
                title="Çıkış Yap"
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/75 transition hover:bg-white/10 hover:text-white"
              >
                <LogoutIcon />
              </button>
            </div>
          </div>
        </div>

        {/* SEKME SATIRI */}
        <div className="mx-auto max-w-[1600px] px-2 lg:px-4">
          <div className="flex items-center gap-1 overflow-x-auto">
            {TABS.map((item) => {
              const Icon = item.icon;
              const active = tab === item.key;

              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setTab(item.key)}
                  className={`flex min-w-[92px] shrink-0 flex-col items-center gap-1 border-b-2 px-4 py-2.5 text-[10px] font-black uppercase tracking-wide transition ${
                    active
                      ? "border-blue-400 text-white"
                      : "border-transparent text-blue-100/50 hover:text-blue-100/80"
                  }`}
                >
                  <Icon className={`h-4.5 w-4.5 ${active ? "text-blue-400" : ""}`} />
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <main className="mx-auto mt-6 max-w-[1600px] px-4 sm:px-8">
        {error && (
          <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-bold text-red-600">
            {error}
          </div>
        )}

        {tab === "ana_sayfa" && (
          <div className="space-y-6">
            <section className="overflow-hidden rounded-[28px] bg-gradient-to-r from-[#0d1f43] via-[#123072] to-[#1a45a0] p-6 text-white shadow-xl sm:p-8">
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-300">
                Hoş Geldiniz
              </div>
              <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-[28px]">{companyName}</h1>
              <p className="mt-2 max-w-xl text-sm font-medium text-blue-100/85">
                CnetMobil'den yaptığınız alımların özeti aşağıda. Yeni cihaz talep etmek için
                üstteki "Cihaz Al" sekmesine geçebilirsiniz.
              </p>
            </section>

            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: "Alınan Cihaz", value: String(homeStats.totalDevices), tone: "text-slate-900" },
                { label: "Toplam Alım Tutarı", value: formatTry(homeStats.totalSpent), tone: "text-slate-900" },
                { label: "Toplam Kârınız", value: formatTry(homeStats.totalCommission), tone: "text-emerald-600" },
                { label: "Bekleyen / Süreçte", value: `${homeStats.pending} / ${homeStats.inProgress}`, tone: "text-amber-600" },
              ].map((stat) => (
                <div key={stat.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                    {stat.label}
                  </div>
                  <div className={`mt-2 text-2xl font-black ${stat.tone}`}>{stat.value}</div>
                </div>
              ))}
            </section>

            <p className="text-[10px] font-semibold text-slate-400">
              * Bu rakamlar CnetMobil üzerinden yaptığınız alımlara aittir; kendi müşterilerinize
              yaptığınız satışları içermez.
            </p>

            <section className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 p-4">
                <h2 className="text-sm font-black text-slate-900">Son Siparişleriniz</h2>
              </div>

              {orders.length === 0 ? (
                <div className="py-14 text-center text-sm font-bold text-slate-400">
                  Henüz siparişiniz yok.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {orders.slice(0, 5).map((order) => (
                    <div key={order.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                      <div>
                        <div className="text-xs font-black text-slate-900">#{order.id}</div>
                        <div className="text-[10px] font-semibold text-slate-400">
                          {formatDate(order.createdAt)}
                        </div>
                      </div>
                      <span
                        className={`rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-wide ring-1 ${STATUS_TONE[order.status]}`}
                      >
                        {STATUS_LABEL[order.status]}
                      </span>
                      <div className="text-sm font-black text-slate-900">
                        {formatTry(order.totalSaleAmount)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {tab === "cihaz_al" && (
          <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
            <section className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-500 ring-1 ring-blue-100">
                    <CartIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-black text-slate-900">Talep Edilebilir Cihazlar</h2>
                    <p className="mt-0.5 text-xs font-semibold text-slate-400">
                      İhtiyacınız olan cihazları arayın, filtreleyin ve talep sepetinize ekleyin.
                    </p>
                  </div>
                </div>
                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                  <select
                    value={brandFilter}
                    onChange={(e) => setBrandFilter(e.target.value)}
                    className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-700 outline-none focus:border-blue-400 focus:bg-white"
                  >
                    {brandOptions.map((brand) => (
                      <option key={brand} value={brand}>
                        {brand}
                      </option>
                    ))}
                  </select>
                  <div className="relative w-full sm:w-64">
                    <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Marka, model ara..."
                      className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs font-semibold text-slate-700 outline-none focus:border-blue-400 focus:bg-white"
                    />
                  </div>
                </div>
              </div>

              {filteredCatalog.length === 0 ? (
                <div className="py-16 text-center text-sm font-bold text-slate-400">
                  {catalog.length === 0 ? "Şu an talep edilebilir cihaz yok." : "Sonuç bulunamadı."}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] border-collapse text-left">
                    <thead>
                      <tr className="bg-slate-50 text-[10px] font-black uppercase tracking-wide text-slate-500">
                        <th className="px-4 py-3">Marka / Model</th>
                        <th className="px-3 py-3">Özellikler</th>
                        <th className="px-3 py-3">Temel Fiyat</th>
                        <th className="px-3 py-3">Stok</th>
                        <th className="px-4 py-3">İşlem</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCatalog.map((item, index) => {
                        const inCart = cart[item.id];

                        return (
                          <tr
                            key={item.id}
                            className={`border-t border-slate-100 align-top text-sm ${
                              index % 2 === 1 ? "bg-slate-50/40" : "bg-white"
                            }`}
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                {item.imageUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={item.imageUrl}
                                    alt=""
                                    className="h-11 w-11 shrink-0 rounded-xl border border-slate-200 object-cover"
                                  />
                                ) : (
                                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-500 ring-1 ring-blue-100">
                                    <BoxIcon className="h-4.5 w-4.5" />
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <div className="font-black text-slate-900">{item.brandModel}</div>
                                  {inCart && (
                                    <span className="mt-0.5 inline-block rounded-md bg-emerald-50 px-1.5 py-0.5 text-[9px] font-black uppercase text-emerald-700">
                                      Sepette
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-3 text-xs font-semibold text-slate-500">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span>{[item.memory, item.color].filter(Boolean).join(" · ") || "-"}</span>
                                {item.grade && (
                                  <span
                                    className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase ring-1 ${gradeTone(item.grade)}`}
                                  >
                                    {item.grade}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-3 whitespace-nowrap font-black text-slate-800">
                              {formatTry(item.basePrice)}
                            </td>
                            <td className="px-3 py-3">
                              <span className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-black text-slate-600">
                                {item.stockQuantity} adet
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap items-end gap-1.5">
                                <div>
                                  <label className="block text-[8px] font-black uppercase text-slate-400">
                                    Satış Fiyatı
                                  </label>
                                  <input
                                    type="number"
                                    min={item.basePrice}
                                    step="0.01"
                                    value={getPriceDraft(item)}
                                    onChange={(e) =>
                                      setPriceDrafts((prev) => ({ ...prev, [item.id]: e.target.value }))
                                    }
                                    className="h-9 w-24 rounded-lg border border-slate-200 px-2 text-xs font-bold text-slate-700 outline-none focus:border-blue-400"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[8px] font-black uppercase text-slate-400">
                                    Adet
                                  </label>
                                  <input
                                    type="number"
                                    min={1}
                                    max={item.stockQuantity}
                                    value={getQtyDraft(item.id)}
                                    onChange={(e) =>
                                      setQtyDrafts((prev) => ({ ...prev, [item.id]: e.target.value }))
                                    }
                                    className="h-9 w-14 rounded-lg border border-slate-200 px-2 text-center text-xs font-bold text-slate-700 outline-none focus:border-blue-400"
                                  />
                                </div>
                                <button
                                  type="button"
                                  onClick={() => addToCart(item)}
                                  className="flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-[10px] font-black uppercase tracking-wide text-white transition hover:bg-blue-500"
                                >
                                  <CartIcon className="h-3.5 w-3.5" />
                                  Talep Ol
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <aside className="space-y-4">
              <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-500 ring-1 ring-blue-100">
                      <CartIcon className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-slate-900">
                        Talep Sepetim ({cartEntries.length})
                      </h3>
                      <p className="mt-0.5 text-xs font-semibold text-slate-400">
                        Seçtiğiniz cihazlar burada listelenir.
                      </p>
                    </div>
                  </div>
                  {cartEntries.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setCart({})}
                      className="shrink-0 text-[10px] font-black uppercase text-slate-400 hover:text-red-500"
                    >
                      Sepeti Temizle
                    </button>
                  )}
                </div>

                <div className="mt-3 space-y-2">
                  {cartEntries.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-200 py-8 text-center">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-300 ring-1 ring-blue-100">
                        <EmptyCartIcon className="h-7 w-7" />
                      </div>
                      <div className="text-xs font-black text-slate-600">Sepetiniz boş.</div>
                      <p className="max-w-[220px] text-[10px] font-semibold text-slate-400">
                        Talep edilebilir cihazlar arasından seçim yaparak sepetinize
                        ekleyebilirsiniz.
                      </p>
                    </div>
                  ) : (
                    cartEntries.map((entry) => (
                      <div
                        key={entry.item.id}
                        className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-xs font-black text-slate-800">
                            {entry.item.brandModel}
                          </div>
                          <div className="text-[10px] font-semibold text-slate-400">
                            {entry.quantity} adet
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <span className="text-sm font-black text-slate-900">
                            {formatTry(entry.salePrice * entry.quantity)}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeFromCart(entry.item.id)}
                            className="text-red-400 hover:text-red-600"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {cartEntries.length > 0 && (
                  <div className="mt-3 space-y-1.5 border-t border-slate-100 pt-3">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                      <span>Toplam Tutar</span>
                      <span className="text-lg font-black text-slate-950">
                        {formatTry(cartTotals.totalSale)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs font-bold text-emerald-600">
                      <span>Tahmini Kârınız</span>
                      <span className="font-black">{formatTry(cartTotals.commission)}</span>
                    </div>
                  </div>
                )}

                {checkoutError && (
                  <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-600">
                    {checkoutError}
                  </div>
                )}

                <button
                  type="button"
                  disabled={checkingOut || cartEntries.length === 0}
                  onClick={submitCheckout}
                  className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-500 disabled:opacity-50 disabled:shadow-none"
                >
                  <CardIcon className="h-4 w-4" />
                  {checkingOut ? "Yönlendiriliyor..." : "Ödemeye Geç (Paratika)"}
                  {!checkingOut && <ChevronRightIcon className="h-4 w-4" />}
                </button>
              </section>

              <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-500 ring-1 ring-blue-100">
                    <ShieldCheckIcon className="h-5 w-5" />
                  </div>
                  <h3 className="pt-2 text-sm font-black text-slate-900">Ödeme Süreci</h3>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <div className="rounded-lg bg-blue-600 px-2 py-1 text-[10px] font-black text-white">
                    PARATİKA
                  </div>
                  <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-600">
                    <ShieldCheckIcon className="h-3.5 w-3.5" /> 3D Secure
                  </div>
                </div>
                <p className="mt-2 text-[11px] font-semibold leading-relaxed text-slate-500">
                  Ödeme sayfasına yönlendirilirsiniz, kart bilgilerinizi girip 3D Secure ile
                  onaylarsınız. İşlem tamamlandığında talebiniz sistemimize düşer ve
                  hazırlanmaya başlanır.
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {["3D Secure", "SSL Güvenlik", "PCI DSS"].map((badge) => (
                    <span
                      key={badge}
                      className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[9px] font-black uppercase text-slate-500"
                    >
                      <ShieldCheckIcon className="h-3 w-3 text-emerald-500" />
                      {badge}
                    </span>
                  ))}
                </div>
              </section>
            </aside>

            <section className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm lg:col-span-2">
              <div className="flex items-start justify-between gap-2 border-b border-slate-100 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-500 ring-1 ring-blue-100">
                    <DocumentIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-black text-slate-900">Siparişlerim</h2>
                    <p className="mt-0.5 text-xs font-semibold text-slate-400">
                      Geçmiş ve devam eden siparişlerinizi görüntüleyebilirsiniz.
                    </p>
                  </div>
                </div>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-300">
                  <MoreIcon />
                </span>
              </div>

              {orders.length === 0 ? (
                <div className="py-14 text-center text-sm font-bold text-slate-400">
                  Henüz siparişiniz yok.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] border-collapse text-left">
                    <thead>
                      <tr className="bg-slate-50 text-[10px] font-black uppercase tracking-wide text-slate-500">
                        <th className="px-4 py-3">Sipariş</th>
                        <th className="px-3 py-3">Durum</th>
                        <th className="px-3 py-3">Tutar</th>
                        <th className="px-3 py-3">Kâr</th>
                        <th className="px-3 py-3">Kargo</th>
                        <th className="px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody>
                      {orders.map((order, index) => (
                        <tr
                          key={order.id}
                          className={`border-t border-slate-100 text-sm ${
                            index % 2 === 1 ? "bg-slate-50/40" : "bg-white"
                          }`}
                        >
                          <td className="px-4 py-3">
                            <div className="font-black text-slate-900">#{order.id}</div>
                            <div className="text-[10px] font-semibold text-slate-400">
                              {formatDate(order.createdAt)}
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <span
                              className={`rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-wide ring-1 ${STATUS_TONE[order.status]}`}
                            >
                              {STATUS_LABEL[order.status]}
                            </span>
                          </td>
                          <td className="px-3 py-3 font-black text-slate-900">
                            {formatTry(order.totalSaleAmount)}
                          </td>
                          <td className="px-3 py-3 font-bold text-emerald-600">
                            {formatTry(order.commissionAmount)}
                          </td>
                          <td className="px-3 py-3 text-xs font-semibold text-slate-500">
                            {order.trackingNo || "-"}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {order.status === "AWAITING_PAYMENT" && order.paymentUrl && (
                              <button
                                type="button"
                                onClick={() => continuePayment(order)}
                                className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-[10px] font-black uppercase tracking-wide text-white transition hover:bg-blue-500"
                              >
                                Ödemeyi Tamamla
                                <ChevronRightIcon className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        )}

        {tab === "ihale" && (
          <div className="flex min-h-[50vh] flex-col items-center justify-center rounded-[24px] border border-dashed border-slate-200 bg-white p-10 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-500 ring-1 ring-blue-100">
              <GavelIcon className="h-7 w-7" />
            </div>
            <h2 className="mt-4 text-lg font-black text-slate-900">İhale — Yakında</h2>
            <p className="mt-1.5 max-w-sm text-xs font-semibold text-slate-500">
              Bayiler arası cihaz ihalesi özelliği üzerinde çalışıyoruz. Hazır olduğunda bu
              sekmeden teklif verebileceksiniz.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
