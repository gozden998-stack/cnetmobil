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

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "İO";
}

function CartIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m-10 4a1 1 0 102 0 1 1 0 00-2 0zm10 0a1 1 0 102 0 1 1 0 00-2 0z" />
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

function BoxCheckIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9.5 12.5l1.8 1.8L15 10" />
    </svg>
  );
}

function TruckIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 7h11v8H3zM14 10h4l3 3v2h-7z" />
      <circle cx="7" cy="17" r="1.6" strokeWidth={1.8} />
      <circle cx="17.5" cy="17" r="1.6" strokeWidth={1.8} />
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

const STEPS = [
  { icon: CartIcon, label: "Cihazı Seç, Talep Ol" },
  { icon: CardIcon, label: "Güvenli Ödeme (Paratika)" },
  { icon: BoxCheckIcon, label: "Talep Onay ve Hazırlık" },
  { icon: TruckIcon, label: "Kargo / Sevk Takibi" },
];

export default function BayiPortal() {
  const [checkingSession, setCheckingSession] = useState(true);
  const [companyName, setCompanyName] = useState("");

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

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
      setCompanyName(response.ok && result?.ok ? result.companyName || "" : "");
    } finally {
      setCheckingSession(false);
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

  const submitLogin = async () => {
    if (loggingIn) return;

    if (!loginEmail.trim() || !loginPassword) {
      setLoginError("E-posta ve şifre gerekli.");
      return;
    }

    setLoggingIn(true);
    setLoginError("");

    try {
      const response = await fetch("/api/dealer-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ email: loginEmail.trim(), password: loginPassword }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result?.ok) {
        throw new Error(result?.error || "Giriş başarısız.");
      }

      setCompanyName(result.companyName || "");
      setLoginPassword("");
    } catch (err: any) {
      setLoginError(err?.message || "Giriş başarısız.");
    } finally {
      setLoggingIn(false);
    }
  };

  const logout = async () => {
    try {
      await fetch("/api/dealer-auth", { method: "DELETE", credentials: "same-origin" });
    } finally {
      setCompanyName("");
      setCart({});
      setCatalog([]);
      setOrders([]);
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

  const filteredCatalog = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("tr-TR");
    if (!query) return catalog;

    return catalog.filter((item) =>
      `${item.brandModel} ${item.memory} ${item.color} ${item.grade}`
        .toLocaleLowerCase("tr-TR")
        .includes(query)
    );
  }, [catalog, search]);

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

      if (result.paymentUrl) {
        window.location.href = result.paymentUrl;
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
    if (order.paymentUrl) window.location.href = order.paymentUrl;
  };

  if (checkingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f5f7fb] text-sm font-bold text-slate-400">
        Yükleniyor...
      </div>
    );
  }

  if (!companyName) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#0b1730] via-[#0f2247] to-[#13306b] px-4">
        <div className="w-full max-w-md overflow-hidden rounded-[28px] bg-white shadow-2xl">
          <div className="bg-gradient-to-r from-blue-700 to-indigo-700 px-8 pb-8 pt-9 text-white">
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 font-black">
                CP
              </div>
              <div>
                <div className="text-sm font-black leading-none">CnetMobil</div>
                <div className="text-[10px] font-black uppercase tracking-widest text-blue-200">
                  Partner
                </div>
              </div>
            </div>
            <h1 className="mt-6 text-2xl font-black tracking-tight">İş Ortağı Portalı</h1>
            <p className="mt-1 text-xs font-semibold text-blue-100/80">
              Hesabınızla giriş yapın, cihaz talebinizi oluşturun.
            </p>
          </div>

          <div className="px-8 py-7">
            <div className="space-y-3">
              <div>
                <label className="mb-1.5 block text-[10px] font-black uppercase tracking-wide text-slate-400">
                  E-posta
                </label>
                <input
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="ornek@firma.com"
                  type="email"
                  onKeyDown={(e) => e.key === "Enter" && submitLogin()}
                  className="h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-slate-800 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[10px] font-black uppercase tracking-wide text-slate-400">
                  Şifre
                </label>
                <input
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  type="password"
                  onKeyDown={(e) => e.key === "Enter" && submitLogin()}
                  className="h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-slate-800 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
                />
              </div>
            </div>

            {loginError && (
              <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-600">
                {loginError}
              </div>
            )}

            <button
              type="button"
              disabled={loggingIn}
              onClick={submitLogin}
              className="mt-5 h-12 w-full rounded-2xl bg-blue-600 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-500 disabled:opacity-50"
            >
              {loggingIn ? "Giriş yapılıyor..." : "Giriş Yap"}
            </button>

            <div className="mt-6 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wide text-slate-300">
              <div className="h-px flex-1 bg-slate-100" />
              güvenli bağlantı
              <div className="h-px flex-1 bg-slate-100" />
            </div>
            <p className="mt-3 text-center text-[10px] font-bold uppercase tracking-wide text-slate-300">
              CNETMOBİL İş Ortağı Portalı
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f7fb] pb-16">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-[#0b1730] px-4 py-3.5 sm:px-8">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-xs font-black text-white">
              CP
            </div>
            <div className="leading-none">
              <div className="text-sm font-black text-white">CnetMobil</div>
              <div className="text-[9px] font-black uppercase tracking-widest text-blue-300">
                Partner
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <div className="text-xs font-black text-white">{companyName}</div>
              <div className="text-[9px] font-bold uppercase tracking-wide text-slate-400">
                İş Ortağı
              </div>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-500 text-[11px] font-black text-white ring-2 ring-white/10">
              {initials(companyName)}
            </div>
            <button
              type="button"
              onClick={logout}
              className="flex h-9 items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 text-[10px] font-black uppercase tracking-wide text-slate-200 transition hover:bg-white/10"
            >
              <LogoutIcon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Çıkış</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto mt-6 max-w-[1400px] px-4 sm:px-8">
        {/* HERO */}
        <section className="overflow-hidden rounded-[28px] bg-gradient-to-r from-[#0d1f43] via-[#123072] to-[#1a45a0] p-6 text-white shadow-xl sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-xl">
              <h1 className="text-2xl font-black tracking-tight sm:text-[28px]">
                Cihaz Talep ile Stoklarınızı Güçlendirin
              </h1>
              <p className="mt-2 text-sm font-medium text-blue-100/85">
                Aşağıdaki kataloğumuzdan ihtiyacınız olan cihazları seçin, kendi satış fiyatınızı
                belirleyip talebinizi oluşturun ve ödemeyi güvenle tamamlayın.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:gap-4">
              {STEPS.map((step, index) => {
                const Icon = step.icon;
                return (
                  <div key={step.label} className="flex flex-col items-center gap-2 text-center">
                    <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20">
                      <Icon className="h-5 w-5 text-white" />
                      <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-blue-400 text-[10px] font-black text-blue-950">
                        {index + 1}
                      </span>
                    </div>
                    <span className="max-w-[90px] text-[10px] font-bold leading-tight text-blue-100/90">
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {error && (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-bold text-red-600">
            {error}
          </div>
        )}

        <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_360px]">
          {/* KATALOG */}
          <section className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-sm font-black text-slate-900">Talep Edilebilir Cihazlar</h2>
              <div className="relative w-full sm:w-72">
                <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Marka, model ara..."
                  className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs font-semibold text-slate-700 outline-none focus:border-blue-400 focus:bg-white"
                />
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
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-500 ring-1 ring-blue-100">
                                <CardIcon className="h-4.5 w-4.5" />
                              </div>
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
                            {[item.memory, item.color, item.grade].filter(Boolean).join(" · ") || "-"}
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

          {/* SEPET + ÖDEME */}
          <aside className="space-y-4">
            <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="flex items-center gap-1.5 text-sm font-black text-slate-900">
                  <CartIcon className="h-4 w-4 text-blue-600" />
                  Talep Sepetim ({cartEntries.length})
                </h3>
                {cartEntries.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setCart({})}
                    className="text-[10px] font-black uppercase text-slate-400 hover:text-red-500"
                  >
                    Sepeti Temizle
                  </button>
                )}
              </div>

              <div className="mt-3 space-y-2">
                {cartEntries.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-xs font-bold text-slate-400">
                    Sepetiniz boş.
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
              </button>
            </section>

            <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-500">
                Ödeme Süreci
              </h3>
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
        </div>

        {/* SİPARİŞLERİM */}
        <section className="mt-6 overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-4">
            <h2 className="text-sm font-black text-slate-900">Siparişlerim</h2>
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
                            className="rounded-lg bg-blue-600 px-3 py-1.5 text-[10px] font-black uppercase tracking-wide text-white transition hover:bg-blue-500"
                          >
                            Ödemeyi Tamamla
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
      </main>
    </div>
  );
}
