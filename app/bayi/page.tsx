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
  AWAITING_PAYMENT: "ÖDEME BEKLENİYOR",
  PAID: "ÖDENDİ",
  PREPARING: "HAZIRLANIYOR",
  SHIPPED: "KARGOYA VERİLDİ",
  CANCELLED: "İPTAL",
};

const STATUS_TONE: Record<string, string> = {
  AWAITING_PAYMENT: "bg-amber-50 text-amber-700 border-amber-200",
  PAID: "bg-blue-50 text-blue-700 border-blue-200",
  PREPARING: "bg-violet-50 text-violet-700 border-violet-200",
  SHIPPED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  CANCELLED: "bg-red-50 text-red-700 border-red-200",
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
      } else {
        setCompanyName("");
      }
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

    return {
      totalSale,
      totalBase,
      commission: Math.round((totalSale - totalBase) * 100) / 100,
    };
  }, [cartEntries]);

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
    if (order.paymentUrl) {
      window.location.href = order.paymentUrl;
    }
  };

  if (checkingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm font-bold text-slate-400">
        Yükleniyor...
      </div>
    );
  }

  if (!companyName) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 px-4">
        <div className="w-full max-w-md rounded-[28px] border border-slate-100 bg-white p-8 shadow-xl">
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600">
            CNETMOBİL
          </div>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950">
            İş Ortağı Portalı
          </h1>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            Hesap bilgilerinizle giriş yapın.
          </p>

          <div className="mt-6 space-y-3">
            <input
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              placeholder="E-posta"
              type="email"
              onKeyDown={(e) => e.key === "Enter" && submitLogin()}
              className="h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-slate-800 outline-none focus:border-blue-400"
            />
            <input
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              placeholder="Şifre"
              type="password"
              onKeyDown={(e) => e.key === "Enter" && submitLogin()}
              className="h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-slate-800 outline-none focus:border-blue-400"
            />
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
            className="mt-4 h-12 w-full rounded-2xl bg-blue-600 text-xs font-black uppercase tracking-widest text-white transition hover:bg-blue-500 disabled:opacity-50"
          >
            {loggingIn ? "Giriş yapılıyor..." : "Giriş Yap"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      <header className="border-b border-slate-100 bg-white px-4 py-4 sm:px-8">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600">
              CNETMOBİL İŞ ORTAĞI PORTALI
            </div>
            <div className="mt-0.5 text-lg font-black text-slate-950">{companyName}</div>
          </div>
          <button
            type="button"
            onClick={logout}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-[10px] font-black uppercase tracking-wide text-slate-600 transition hover:bg-slate-50"
          >
            Çıkış Yap
          </button>
        </div>
      </header>

      <main className="mx-auto mt-6 max-w-[1400px] px-4 sm:px-8">
        {error && (
          <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-bold text-red-600">
            {error}
          </div>
        )}

        <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
          <section className="space-y-3">
            <h2 className="text-[11px] font-black uppercase tracking-widest text-slate-500">
              Talep Edilebilir Cihazlar
            </h2>

            {catalog.length === 0 && (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white py-14 text-center text-sm font-bold text-slate-400">
                Şu an talep edilebilir cihaz yok.
              </div>
            )}

            {catalog.map((item) => {
              const inCart = cart[item.id];

              return (
                <div key={item.id} className="rounded-2xl border border-slate-100 bg-white p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="font-black text-slate-900">{item.brandModel}</div>
                      <div className="mt-0.5 text-xs font-semibold text-slate-500">
                        {[item.memory, item.color, item.grade].filter(Boolean).join(" · ")}
                      </div>
                      <div className="mt-1 text-xs font-bold text-slate-400">
                        Temel fiyat: {formatTry(item.basePrice)} · Stok: {item.stockQuantity}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {inCart && (
                        <span className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-black text-emerald-700">
                          Sepette: {inCart.quantity} · {formatTry(inCart.salePrice)}
                        </span>
                      )}
                      <div className="flex items-center gap-1.5">
                        <div>
                          <label className="block text-[9px] font-black uppercase text-slate-400">
                            Satış Fiyatınız
                          </label>
                          <input
                            type="number"
                            min={item.basePrice}
                            step="0.01"
                            value={getPriceDraft(item)}
                            onChange={(e) =>
                              setPriceDrafts((prev) => ({ ...prev, [item.id]: e.target.value }))
                            }
                            className="h-10 w-28 rounded-lg border border-slate-200 px-2 text-sm font-bold text-slate-700 outline-none focus:border-blue-400"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-black uppercase text-slate-400">
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
                            className="h-10 w-16 rounded-lg border border-slate-200 px-2 text-center text-sm font-bold text-slate-700 outline-none focus:border-blue-400"
                          />
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => addToCart(item)}
                        className="h-10 self-end rounded-xl bg-blue-600 px-4 text-[10px] font-black uppercase tracking-wide text-white transition hover:bg-blue-500"
                      >
                        Talep Ol
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </section>

          <aside className="space-y-4">
            <section className="rounded-2xl border border-slate-100 bg-white p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-500">
                  Talep Sepetim ({cartEntries.length})
                </h3>
                {cartEntries.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setCart({})}
                    className="text-[10px] font-black uppercase text-slate-400 hover:text-red-500"
                  >
                    Temizle
                  </button>
                )}
              </div>

              <div className="mt-3 space-y-2">
                {cartEntries.length === 0 && (
                  <div className="rounded-xl border border-dashed border-slate-200 py-6 text-center text-xs font-bold text-slate-400">
                    Sepetiniz boş.
                  </div>
                )}

                {cartEntries.map((entry) => (
                  <div
                    key={entry.item.id}
                    className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-xs font-black text-slate-800">
                        {entry.item.brandModel}
                      </div>
                      <div className="text-[10px] font-semibold text-slate-400">
                        {entry.quantity} adet × {formatTry(entry.salePrice)}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFromCart(entry.item.id)}
                      className="shrink-0 text-red-400 hover:text-red-600"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>

              {cartEntries.length > 0 && (
                <div className="mt-3 space-y-1 border-t border-slate-100 pt-3 text-xs font-bold text-slate-600">
                  <div className="flex items-center justify-between">
                    <span>Toplam Tutar</span>
                    <span className="text-base font-black text-slate-950">
                      {formatTry(cartTotals.totalSale)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-emerald-600">
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
                className="mt-3 h-12 w-full rounded-2xl bg-emerald-600 text-xs font-black uppercase tracking-widest text-white transition hover:bg-emerald-500 disabled:opacity-50"
              >
                {checkingOut ? "Yönlendiriliyor..." : "Ödemeye Geç (Paratika)"}
              </button>
              <p className="mt-2 text-center text-[10px] font-semibold text-slate-400">
                3D Secure ödeme sayfasına yönlendirilirsiniz. İşlem sonrası bu sayfaya dönüp
                "Siparişlerim" kısmından takip edebilirsiniz.
              </p>
            </section>
          </aside>
        </div>

        <section className="mt-6 space-y-3">
          <h2 className="text-[11px] font-black uppercase tracking-widest text-slate-500">
            Siparişlerim
          </h2>

          {orders.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white py-10 text-center text-sm font-bold text-slate-400">
              Henüz siparişiniz yok.
            </div>
          )}

          {orders.map((order) => (
            <div key={order.id} className="rounded-2xl border border-slate-100 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-black text-slate-900">Sipariş #{order.id}</span>
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wide ${STATUS_TONE[order.status]}`}
                    >
                      {STATUS_LABEL[order.status]}
                    </span>
                  </div>
                  <div className="mt-1 text-xs font-semibold text-slate-400">
                    {formatDate(order.createdAt)}
                    {order.trackingNo ? ` · Kargo Takip: ${order.trackingNo}` : ""}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-base font-black text-slate-950">
                      {formatTry(order.totalSaleAmount)}
                    </div>
                    <div className="text-[10px] font-bold text-emerald-600">
                      Kâr: {formatTry(order.commissionAmount)}
                    </div>
                  </div>

                  {order.status === "AWAITING_PAYMENT" && order.paymentUrl && (
                    <button
                      type="button"
                      onClick={() => continuePayment(order)}
                      className="rounded-xl bg-blue-600 px-4 py-2 text-[10px] font-black uppercase tracking-wide text-white transition hover:bg-blue-500"
                    >
                      Ödemeyi Tamamla
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
