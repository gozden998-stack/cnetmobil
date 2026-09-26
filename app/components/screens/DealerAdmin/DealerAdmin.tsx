"use client";

import React, { useCallback, useEffect, useState } from "react";

type Dealer = {
  id: number;
  companyName: string;
  email: string;
  contactPhone: string;
  isActive: boolean;
  createdAt: string;
  lastLoginAt: string | null;
};

type CatalogItem = {
  id: number;
  brandModel: string;
  memory: string;
  color: string;
  grade: string;
  basePrice: number;
  stockQuantity: number;
  imageUrl: string;
  isActive: boolean;
};

type AdminOrderItem = {
  itemName: string;
  basePrice: number;
  salePrice: number;
  quantity: number;
};

type AdminOrder = {
  id: number;
  dealerId: number;
  companyName: string;
  dealerEmail: string;
  status: "AWAITING_PAYMENT" | "PAID" | "PREPARING" | "SHIPPED" | "CANCELLED";
  totalBaseAmount: number;
  totalSaleAmount: number;
  commissionAmount: number;
  trackingNo: string;
  createdAt: string;
  paidAt: string | null;
  shippedAt: string | null;
  items: AdminOrderItem[];
};

type DealerBalance = {
  dealerId: number;
  companyName: string;
  email: string;
  earnedCommission: number;
  paidOut: number;
  outstandingBalance: number;
};

type Tab = "dealers" | "catalog" | "orders" | "payouts";

const TABS: Array<{ key: Tab; label: string }> = [
  { key: "dealers", label: "Bayi Hesapları" },
  { key: "catalog", label: "Ürün Kataloğu" },
  { key: "orders", label: "Siparişler" },
  { key: "payouts", label: "Kâr Payı / Ödemeler" },
];

const ORDER_STATUS_LABEL: Record<string, string> = {
  AWAITING_PAYMENT: "ÖDEME BEKLENİYOR",
  PAID: "ÖDENDİ",
  PREPARING: "HAZIRLANIYOR",
  SHIPPED: "KARGOYA VERİLDİ",
  CANCELLED: "İPTAL",
};

const ORDER_STATUS_TONE: Record<string, string> = {
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

export default function DealerAdmin() {
  const [tab, setTab] = useState<Tab>("dealers");

  // ==================== BAYİ HESAPLARI ====================
  const [dealersLoading, setDealersLoading] = useState(true);
  const [dealersError, setDealersError] = useState("");
  const [dealers, setDealers] = useState<Dealer[]>([]);

  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  const [resetTargetId, setResetTargetId] = useState<number | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resetSaving, setResetSaving] = useState(false);
  const [resetError, setResetError] = useState("");

  const loadDealers = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/dealers", {
        method: "GET",
        cache: "no-store",
        credentials: "same-origin",
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result?.ok) {
        throw new Error(result?.error || "Bayi listesi alınamadı.");
      }

      setDealers(Array.isArray(result.dealers) ? result.dealers : []);
      setDealersError("");
    } catch (err: any) {
      setDealersError(err?.message || "Bayi listesi alınamadı.");
    } finally {
      setDealersLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDealers();
  }, [loadDealers]);

  const submitCreate = async () => {
    if (creating) return;

    if (!companyName.trim() || !email.trim() || password.length < 8) {
      setCreateError("Firma adı, e-posta ve en az 8 karakterlik şifre gerekli.");
      return;
    }

    setCreating(true);
    setCreateError("");

    try {
      const response = await fetch("/api/admin/dealers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          companyName: companyName.trim(),
          email: email.trim(),
          password,
          contactPhone: contactPhone.trim(),
        }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result?.ok) {
        throw new Error(result?.error || "Bayi eklenemedi.");
      }

      setCompanyName("");
      setEmail("");
      setPassword("");
      setContactPhone("");
      void loadDealers();
    } catch (err: any) {
      setCreateError(err?.message || "Bayi eklenemedi.");
    } finally {
      setCreating(false);
    }
  };

  const toggleDealerActive = async (dealer: Dealer) => {
    try {
      const response = await fetch(`/api/admin/dealers/${dealer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ isActive: !dealer.isActive }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result?.ok) {
        throw new Error(result?.error || "Güncellenemedi.");
      }

      void loadDealers();
    } catch (err: any) {
      setDealersError(err?.message || "Güncellenemedi.");
    }
  };

  const submitReset = async () => {
    if (!resetTargetId || resetSaving) return;

    if (resetPassword.length < 8) {
      setResetError("Şifre en az 8 karakter olmalıdır.");
      return;
    }

    setResetSaving(true);
    setResetError("");

    try {
      const response = await fetch(`/api/admin/dealers/${resetTargetId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ newPassword: resetPassword }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result?.ok) {
        throw new Error(result?.error || "Şifre güncellenemedi.");
      }

      setResetTargetId(null);
      setResetPassword("");
    } catch (err: any) {
      setResetError(err?.message || "Şifre güncellenemedi.");
    } finally {
      setResetSaving(false);
    }
  };

  // ==================== ÜRÜN KATALOĞU ====================
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState("");
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);

  const [newBrandModel, setNewBrandModel] = useState("");
  const [newMemory, setNewMemory] = useState("");
  const [newColor, setNewColor] = useState("");
  const [newGrade, setNewGrade] = useState("");
  const [newBasePrice, setNewBasePrice] = useState("");
  const [newStock, setNewStock] = useState("");
  const [catalogSaving, setCatalogSaving] = useState(false);

  const [editDrafts, setEditDrafts] = useState<Record<number, { basePrice: string; stockQuantity: string }>>({});
  const [savingItemId, setSavingItemId] = useState<number | null>(null);

  const loadCatalog = useCallback(async () => {
    setCatalogLoading(true);

    try {
      const response = await fetch("/api/admin/dealer-catalog", {
        method: "GET",
        cache: "no-store",
        credentials: "same-origin",
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result?.ok) {
        throw new Error(result?.error || "Katalog alınamadı.");
      }

      setCatalog(Array.isArray(result.items) ? result.items : []);
      setCatalogError("");
    } catch (err: any) {
      setCatalogError(err?.message || "Katalog alınamadı.");
    } finally {
      setCatalogLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === "catalog") void loadCatalog();
  }, [tab, loadCatalog]);

  const submitNewCatalogItem = async () => {
    if (catalogSaving) return;

    const basePrice = Number(newBasePrice);
    const stockQuantity = Number(newStock);

    if (!newBrandModel.trim()) {
      setCatalogError("Marka/model gerekli.");
      return;
    }

    if (!Number.isFinite(basePrice) || basePrice <= 0) {
      setCatalogError("Geçerli bir temel fiyat girin.");
      return;
    }

    if (!Number.isInteger(stockQuantity) || stockQuantity < 0) {
      setCatalogError("Geçerli bir stok adedi girin.");
      return;
    }

    setCatalogSaving(true);
    setCatalogError("");

    try {
      const response = await fetch("/api/admin/dealer-catalog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          brandModel: newBrandModel.trim(),
          memory: newMemory.trim(),
          color: newColor.trim(),
          grade: newGrade.trim(),
          basePrice,
          stockQuantity,
        }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result?.ok) {
        throw new Error(result?.error || "Ürün eklenemedi.");
      }

      setNewBrandModel("");
      setNewMemory("");
      setNewColor("");
      setNewGrade("");
      setNewBasePrice("");
      setNewStock("");
      void loadCatalog();
    } catch (err: any) {
      setCatalogError(err?.message || "Ürün eklenemedi.");
    } finally {
      setCatalogSaving(false);
    }
  };

  const toggleCatalogActive = async (item: CatalogItem) => {
    try {
      const response = await fetch(`/api/admin/dealer-catalog/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ isActive: !item.isActive }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result?.ok) {
        throw new Error(result?.error || "Güncellenemedi.");
      }

      void loadCatalog();
    } catch (err: any) {
      setCatalogError(err?.message || "Güncellenemedi.");
    }
  };

  const getEditDraft = (item: CatalogItem) =>
    editDrafts[item.id] ?? {
      basePrice: String(item.basePrice),
      stockQuantity: String(item.stockQuantity),
    };

  const saveCatalogEdits = async (item: CatalogItem) => {
    const draft = getEditDraft(item);
    const basePrice = Number(draft.basePrice);
    const stockQuantity = Number(draft.stockQuantity);

    if (!Number.isFinite(basePrice) || basePrice <= 0) {
      setCatalogError("Geçerli bir temel fiyat girin.");
      return;
    }

    if (!Number.isInteger(stockQuantity) || stockQuantity < 0) {
      setCatalogError("Geçerli bir stok adedi girin.");
      return;
    }

    setSavingItemId(item.id);

    try {
      const response = await fetch(`/api/admin/dealer-catalog/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ basePrice, stockQuantity }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result?.ok) {
        throw new Error(result?.error || "Güncellenemedi.");
      }

      setEditDrafts((prev) => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
      void loadCatalog();
    } catch (err: any) {
      setCatalogError(err?.message || "Güncellenemedi.");
    } finally {
      setSavingItemId(null);
    }
  };

  // ==================== SİPARİŞLER ====================
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersError, setOrdersError] = useState("");
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [orderBusyId, setOrderBusyId] = useState<number | null>(null);
  const [trackingDrafts, setTrackingDrafts] = useState<Record<number, string>>({});

  const loadOrders = useCallback(async () => {
    setOrdersLoading(true);

    try {
      const response = await fetch("/api/admin/dealer-orders", {
        method: "GET",
        cache: "no-store",
        credentials: "same-origin",
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result?.ok) {
        throw new Error(result?.error || "Siparişler alınamadı.");
      }

      setOrders(Array.isArray(result.orders) ? result.orders : []);
      setOrdersError("");
    } catch (err: any) {
      setOrdersError(err?.message || "Siparişler alınamadı.");
    } finally {
      setOrdersLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === "orders") void loadOrders();
  }, [tab, loadOrders]);

  const runOrderAction = async (
    order: AdminOrder,
    action: "PREPARING" | "SHIPPED" | "CANCEL"
  ) => {
    if (orderBusyId) return;

    const trackingNo = trackingDrafts[order.id] || "";

    if (action === "SHIPPED" && !trackingNo.trim()) {
      setOrdersError("Kargo takip numarası girin.");
      return;
    }

    setOrderBusyId(order.id);
    setOrdersError("");

    try {
      const response = await fetch(`/api/admin/dealer-orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ action, trackingNo: trackingNo.trim() }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result?.ok) {
        throw new Error(result?.error || "İşlem başarısız.");
      }

      void loadOrders();
    } catch (err: any) {
      setOrdersError(err?.message || "İşlem başarısız.");
    } finally {
      setOrderBusyId(null);
    }
  };

  // ==================== KÂR PAYI / ÖDEMELER ====================
  const [balancesLoading, setBalancesLoading] = useState(true);
  const [balancesError, setBalancesError] = useState("");
  const [balances, setBalances] = useState<DealerBalance[]>([]);

  const [payoutTargetId, setPayoutTargetId] = useState<number | null>(null);
  const [payoutAmount, setPayoutAmount] = useState("");
  const [payoutNote, setPayoutNote] = useState("");
  const [payoutSaving, setPayoutSaving] = useState(false);

  const loadBalances = useCallback(async () => {
    setBalancesLoading(true);

    try {
      const response = await fetch("/api/admin/dealer-payouts", {
        method: "GET",
        cache: "no-store",
        credentials: "same-origin",
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result?.ok) {
        throw new Error(result?.error || "Bakiyeler alınamadı.");
      }

      setBalances(Array.isArray(result.balances) ? result.balances : []);
      setBalancesError("");
    } catch (err: any) {
      setBalancesError(err?.message || "Bakiyeler alınamadı.");
    } finally {
      setBalancesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === "payouts") void loadBalances();
  }, [tab, loadBalances]);

  const submitPayout = async () => {
    if (!payoutTargetId || payoutSaving) return;

    const amount = Number(payoutAmount);

    if (!Number.isFinite(amount) || amount <= 0) {
      setBalancesError("Geçerli bir tutar girin.");
      return;
    }

    setPayoutSaving(true);
    setBalancesError("");

    try {
      const response = await fetch("/api/admin/dealer-payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ dealerId: payoutTargetId, amount, note: payoutNote.trim() }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result?.ok) {
        throw new Error(result?.error || "Ödeme kaydedilemedi.");
      }

      setPayoutTargetId(null);
      setPayoutAmount("");
      setPayoutNote("");
      void loadBalances();
    } catch (err: any) {
      setBalancesError(err?.message || "Ödeme kaydedilemedi.");
    } finally {
      setPayoutSaving(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1200px] animate-in fade-in space-y-5 duration-500">
      <section className="rounded-[28px] border border-blue-100 bg-white p-6 shadow-sm">
        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600">
          CNETMOBİL V2
        </div>
        <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950">
          Bayi / İş Ortağı Yönetimi
        </h2>
        <p className="mt-1 text-xs font-semibold text-slate-500">
          Hesaplar, katalog, siparişler ve kâr payı ödemeleri tek yerden.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {TABS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              className={`rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-wide transition ${
                tab === item.key
                  ? "bg-blue-600 text-white shadow-md"
                  : "bg-slate-100 text-slate-500 hover:bg-slate-200"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </section>

      {tab === "dealers" && (
        <>
          <section className="rounded-[24px] border border-slate-100 bg-white p-5 shadow-sm">
            <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-500">
              Yeni Bayi Ekle
            </h3>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <input
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Firma adı"
                className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-800 outline-none focus:border-blue-400"
              />
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="E-posta"
                type="email"
                className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-800 outline-none focus:border-blue-400"
              />
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Şifre (en az 8 karakter)"
                type="text"
                className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-800 outline-none focus:border-blue-400"
              />
              <input
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="Telefon (05xx xxx xx xx)"
                className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-800 outline-none focus:border-blue-400"
              />
            </div>

            <p className="mt-2 text-[10px] font-semibold text-slate-400">
              Telefon, bayinin ödeme yapabilmesi için gereklidir (Paratika 3D Secure).
            </p>

            {createError && (
              <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-600">
                {createError}
              </div>
            )}

            <button
              type="button"
              disabled={creating}
              onClick={submitCreate}
              className="mt-3 h-11 rounded-xl bg-blue-600 px-5 text-[11px] font-black uppercase tracking-wide text-white transition hover:bg-blue-500 disabled:opacity-50"
            >
              {creating ? "Ekleniyor..." : "Bayi Ekle"}
            </button>
          </section>

          {dealersError && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-bold text-red-600">
              {dealersError}
            </div>
          )}

          {dealersLoading ? (
            <div className="py-10 text-center text-sm font-bold text-slate-400">Yükleniyor...</div>
          ) : (
            <section className="space-y-2">
              {dealers.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-200 py-10 text-center text-sm font-bold text-slate-400">
                  Henüz bayi eklenmedi.
                </div>
              )}

              {dealers.map((dealer) => (
                <div key={dealer.id} className="rounded-2xl border border-slate-100 bg-white px-5 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-slate-900">{dealer.companyName}</span>
                        <span
                          className={`rounded-full border px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wide ${
                            dealer.isActive
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : "border-slate-200 bg-slate-100 text-slate-500"
                          }`}
                        >
                          {dealer.isActive ? "Aktif" : "Pasif"}
                        </span>
                      </div>
                      <div className="mt-1 text-xs font-semibold text-slate-500">
                        {dealer.email} {dealer.contactPhone ? `· ${dealer.contactPhone}` : ""}
                      </div>
                      <div className="mt-0.5 text-[10px] font-semibold text-slate-400">
                        Son giriş: {formatDate(dealer.lastLoginAt)}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setResetTargetId(dealer.id);
                          setResetPassword("");
                          setResetError("");
                        }}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[9px] font-black uppercase tracking-wide text-slate-600 transition hover:bg-slate-50"
                      >
                        Şifre Sıfırla
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleDealerActive(dealer)}
                        className={`rounded-xl px-3 py-2 text-[9px] font-black uppercase tracking-wide transition ${
                          dealer.isActive
                            ? "bg-red-50 text-red-600 hover:bg-red-100"
                            : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                        }`}
                      >
                        {dealer.isActive ? "Pasif Yap" : "Aktif Yap"}
                      </button>
                    </div>
                  </div>

                  {resetTargetId === dealer.id && (
                    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                      <input
                        value={resetPassword}
                        onChange={(e) => setResetPassword(e.target.value)}
                        placeholder="Yeni şifre (en az 8 karakter)"
                        className="h-10 flex-1 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-800 outline-none focus:border-blue-400"
                      />
                      <button
                        type="button"
                        disabled={resetSaving}
                        onClick={submitReset}
                        className="h-10 rounded-lg bg-blue-600 px-4 text-[10px] font-black uppercase text-white transition hover:bg-blue-500 disabled:opacity-50"
                      >
                        Kaydet
                      </button>
                      <button
                        type="button"
                        onClick={() => setResetTargetId(null)}
                        className="h-10 rounded-lg bg-slate-200 px-4 text-[10px] font-black uppercase text-slate-600 transition hover:bg-slate-300"
                      >
                        Vazgeç
                      </button>
                      {resetError && (
                        <div className="w-full text-xs font-bold text-red-600">{resetError}</div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </section>
          )}
        </>
      )}

      {tab === "catalog" && (
        <>
          <section className="rounded-[24px] border border-slate-100 bg-white p-5 shadow-sm">
            <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-500">
              Yeni Ürün Ekle
            </h3>

            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <input
                value={newBrandModel}
                onChange={(e) => setNewBrandModel(e.target.value)}
                placeholder="Marka / Model"
                className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-800 outline-none focus:border-blue-400 sm:col-span-3"
              />
              <input
                value={newMemory}
                onChange={(e) => setNewMemory(e.target.value)}
                placeholder="Hafıza (örn: 128 GB)"
                className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-800 outline-none focus:border-blue-400"
              />
              <input
                value={newColor}
                onChange={(e) => setNewColor(e.target.value)}
                placeholder="Renk"
                className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-800 outline-none focus:border-blue-400"
              />
              <input
                value={newGrade}
                onChange={(e) => setNewGrade(e.target.value)}
                placeholder="Grade (örn: Mükemmel)"
                className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-800 outline-none focus:border-blue-400"
              />
              <input
                value={newBasePrice}
                onChange={(e) => setNewBasePrice(e.target.value)}
                placeholder="Temel Fiyat (TL)"
                type="number"
                className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-800 outline-none focus:border-blue-400"
              />
              <input
                value={newStock}
                onChange={(e) => setNewStock(e.target.value)}
                placeholder="Stok Adedi"
                type="number"
                className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-800 outline-none focus:border-blue-400"
              />
            </div>

            {catalogError && (
              <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-600">
                {catalogError}
              </div>
            )}

            <button
              type="button"
              disabled={catalogSaving}
              onClick={submitNewCatalogItem}
              className="mt-3 h-11 rounded-xl bg-blue-600 px-5 text-[11px] font-black uppercase tracking-wide text-white transition hover:bg-blue-500 disabled:opacity-50"
            >
              {catalogSaving ? "Ekleniyor..." : "Ürün Ekle"}
            </button>
          </section>

          {catalogLoading ? (
            <div className="py-10 text-center text-sm font-bold text-slate-400">Yükleniyor...</div>
          ) : (
            <section className="space-y-2">
              {catalog.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-200 py-10 text-center text-sm font-bold text-slate-400">
                  Henüz ürün eklenmedi.
                </div>
              )}

              {catalog.map((item) => {
                const draft = getEditDraft(item);

                return (
                  <div
                    key={item.id}
                    className={`rounded-2xl border px-5 py-4 ${
                      item.isActive ? "border-slate-100 bg-white" : "border-slate-100 bg-slate-50 opacity-70"
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-slate-900">{item.brandModel}</span>
                          <span
                            className={`rounded-full border px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wide ${
                              item.isActive
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                : "border-slate-200 bg-slate-100 text-slate-500"
                            }`}
                          >
                            {item.isActive ? "Aktif" : "Pasif"}
                          </span>
                        </div>
                        <div className="mt-0.5 text-xs font-semibold text-slate-500">
                          {[item.memory, item.color, item.grade].filter(Boolean).join(" · ") || "-"}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => toggleCatalogActive(item)}
                        className={`rounded-xl px-3 py-2 text-[9px] font-black uppercase tracking-wide transition ${
                          item.isActive
                            ? "bg-red-50 text-red-600 hover:bg-red-100"
                            : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                        }`}
                      >
                        {item.isActive ? "Pasif Yap" : "Aktif Yap"}
                      </button>
                    </div>

                    <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-slate-100 pt-3">
                      <div>
                        <label className="block text-[9px] font-black uppercase text-slate-400">
                          Temel Fiyat
                        </label>
                        <input
                          type="number"
                          value={draft.basePrice}
                          onChange={(e) =>
                            setEditDrafts((prev) => ({
                              ...prev,
                              [item.id]: { ...draft, basePrice: e.target.value },
                            }))
                          }
                          className="h-10 w-32 rounded-lg border border-slate-200 px-2 text-sm font-bold text-slate-700 outline-none focus:border-blue-400"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-black uppercase text-slate-400">
                          Stok
                        </label>
                        <input
                          type="number"
                          value={draft.stockQuantity}
                          onChange={(e) =>
                            setEditDrafts((prev) => ({
                              ...prev,
                              [item.id]: { ...draft, stockQuantity: e.target.value },
                            }))
                          }
                          className="h-10 w-24 rounded-lg border border-slate-200 px-2 text-sm font-bold text-slate-700 outline-none focus:border-blue-400"
                        />
                      </div>
                      <button
                        type="button"
                        disabled={savingItemId === item.id}
                        onClick={() => saveCatalogEdits(item)}
                        className="h-10 rounded-lg bg-blue-600 px-4 text-[10px] font-black uppercase text-white transition hover:bg-blue-500 disabled:opacity-50"
                      >
                        Kaydet
                      </button>
                    </div>
                  </div>
                );
              })}
            </section>
          )}
        </>
      )}

      {tab === "orders" && (
        <>
          {ordersError && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-bold text-red-600">
              {ordersError}
            </div>
          )}

          {ordersLoading ? (
            <div className="py-10 text-center text-sm font-bold text-slate-400">Yükleniyor...</div>
          ) : orders.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 py-10 text-center text-sm font-bold text-slate-400">
              Henüz sipariş yok.
            </div>
          ) : (
            <section className="space-y-2">
              {orders.map((order) => (
                <div key={order.id} className="rounded-2xl border border-slate-100 bg-white p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-black text-slate-900">
                          #{order.id} · {order.companyName}
                        </span>
                        <span
                          className={`rounded-full border px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wide ${ORDER_STATUS_TONE[order.status]}`}
                        >
                          {ORDER_STATUS_LABEL[order.status]}
                        </span>
                      </div>
                      <div className="mt-1 text-xs font-semibold text-slate-400">
                        {order.dealerEmail} · {formatDate(order.createdAt)}
                        {order.trackingNo ? ` · Takip: ${order.trackingNo}` : ""}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-base font-black text-slate-950">
                        {formatTry(order.totalSaleAmount)}
                      </div>
                      <div className="text-[10px] font-bold text-slate-400">
                        Bize: {formatTry(order.totalBaseAmount)} · Bayi kârı:{" "}
                        {formatTry(order.commissionAmount)}
                      </div>
                    </div>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {order.items.map((item, idx) => (
                      <span
                        key={idx}
                        className="rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-1 text-[10px] font-bold text-slate-600"
                      >
                        {item.itemName} × {item.quantity}
                      </span>
                    ))}
                  </div>

                  {(order.status === "PAID" || order.status === "PREPARING") && (
                    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                      {order.status === "PAID" && (
                        <button
                          type="button"
                          disabled={orderBusyId === order.id}
                          onClick={() => runOrderAction(order, "PREPARING")}
                          className="rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-[9px] font-black uppercase text-violet-700 transition hover:bg-violet-100 disabled:opacity-50"
                        >
                          Hazırlanıyor Yap
                        </button>
                      )}

                      <input
                        value={trackingDrafts[order.id] ?? ""}
                        onChange={(e) =>
                          setTrackingDrafts((prev) => ({ ...prev, [order.id]: e.target.value }))
                        }
                        placeholder="Kargo takip no"
                        className="h-9 flex-1 min-w-[160px] rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 outline-none focus:border-blue-400"
                      />
                      <button
                        type="button"
                        disabled={orderBusyId === order.id}
                        onClick={() => runOrderAction(order, "SHIPPED")}
                        className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[9px] font-black uppercase text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
                      >
                        Kargoya Ver
                      </button>
                    </div>
                  )}

                  {order.status === "AWAITING_PAYMENT" && (
                    <div className="mt-3 border-t border-slate-100 pt-3">
                      <button
                        type="button"
                        disabled={orderBusyId === order.id}
                        onClick={() => runOrderAction(order, "CANCEL")}
                        className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[9px] font-black uppercase text-red-600 transition hover:bg-red-100 disabled:opacity-50"
                      >
                        İptal Et
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </section>
          )}
        </>
      )}

      {tab === "payouts" && (
        <>
          {balancesError && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-bold text-red-600">
              {balancesError}
            </div>
          )}

          <div className="rounded-2xl border border-blue-100 bg-blue-50/60 px-4 py-3 text-xs font-semibold text-blue-800">
            Paratika ödemenin tamamını bize gönderir. Bayinin kâr payını buradan takip edip
            kendiniz (banka havalesiyle) ödersiniz — bu ekran sadece kaydı tutar, otomatik
            havale yapmaz.
          </div>

          {balancesLoading ? (
            <div className="py-10 text-center text-sm font-bold text-slate-400">Yükleniyor...</div>
          ) : balances.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 py-10 text-center text-sm font-bold text-slate-400">
              Henüz bayi yok.
            </div>
          ) : (
            <section className="space-y-2">
              {balances.map((balance) => (
                <div key={balance.dealerId} className="rounded-2xl border border-slate-100 bg-white px-5 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="font-black text-slate-900">{balance.companyName}</div>
                      <div className="text-xs font-semibold text-slate-400">{balance.email}</div>
                    </div>

                    <div className="flex items-center gap-4 text-right">
                      <div>
                        <div className="text-[9px] font-black uppercase text-slate-400">Kazandı</div>
                        <div className="text-sm font-black text-slate-700">
                          {formatTry(balance.earnedCommission)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[9px] font-black uppercase text-slate-400">Ödendi</div>
                        <div className="text-sm font-black text-slate-700">
                          {formatTry(balance.paidOut)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[9px] font-black uppercase text-emerald-500">Bakiye</div>
                        <div className="text-base font-black text-emerald-700">
                          {formatTry(balance.outstandingBalance)}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setPayoutTargetId(balance.dealerId);
                          setPayoutAmount(
                            balance.outstandingBalance > 0
                              ? String(balance.outstandingBalance)
                              : ""
                          );
                          setPayoutNote("");
                        }}
                        className="rounded-xl bg-blue-600 px-4 py-2 text-[10px] font-black uppercase tracking-wide text-white transition hover:bg-blue-500"
                      >
                        Ödeme Kaydet
                      </button>
                    </div>
                  </div>

                  {payoutTargetId === balance.dealerId && (
                    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                      <input
                        value={payoutAmount}
                        onChange={(e) => setPayoutAmount(e.target.value)}
                        type="number"
                        placeholder="Tutar (TL)"
                        className="h-10 w-32 rounded-lg border border-slate-200 px-3 text-sm font-bold text-slate-700 outline-none focus:border-blue-400"
                      />
                      <input
                        value={payoutNote}
                        onChange={(e) => setPayoutNote(e.target.value)}
                        placeholder="Not (opsiyonel, örn. havale referansı)"
                        className="h-10 flex-1 min-w-[180px] rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-400"
                      />
                      <button
                        type="button"
                        disabled={payoutSaving}
                        onClick={submitPayout}
                        className="h-10 rounded-lg bg-emerald-600 px-4 text-[10px] font-black uppercase text-white transition hover:bg-emerald-500 disabled:opacity-50"
                      >
                        Kaydet
                      </button>
                      <button
                        type="button"
                        onClick={() => setPayoutTargetId(null)}
                        className="h-10 rounded-lg bg-slate-200 px-4 text-[10px] font-black uppercase text-slate-600 transition hover:bg-slate-300"
                      >
                        Vazgeç
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}
