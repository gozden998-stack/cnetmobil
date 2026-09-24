"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";

type TedarikProps = {
  isAdmin: boolean;
  selectedBranch: string;
};

type SupplyRequestRow = {
  shopName: string;
  quantity: number;
  requestedByName: string;
  updatedAt: string;
};

type PeriodItem = {
  id: number;
  itemName: string;
  itemNote: string;
  requests: SupplyRequestRow[];
};

type OrderStatus = "BEKLEMEDE" | "HAZIRLANIYOR" | "GONDERILDI";

type SupplyOrderItem = {
  itemId: number;
  itemName: string;
  quantity: number;
  deliveredQuantity: number | null;
};

type SupplyOrder = {
  id: number;
  shopName: string;
  status: OrderStatus;
  submittedByName: string;
  updatedAt: string;
  items: SupplyOrderItem[];
};

type SupplyPeriod = {
  id: number;
  title: string;
  status: "DRAFT" | "LIVE" | "ENDED" | "CANCELLED";
  durationMinutes: number | null;
  startsAt: string | null;
  endsAt: string | null;
  createdByName: string;
  createdAt: string;
  items: PeriodItem[];
  orders: SupplyOrder[];
};

type CatalogItem = {
  id: number;
  itemName: string;
  itemNote: string;
  isActive: boolean;
};

type CartEntry = { itemName: string; quantity: number };

const POLL_MS = 4000;

const VODAFONE_SHOPS = ["MEYDAN", "SARAY", "ERNA", "TEKİRA"];

const DURATION_PRESETS = [
  { label: "12 Saat", minutes: 12 * 60 },
  { label: "24 Saat", minutes: 24 * 60 },
  { label: "2 Gün", minutes: 2 * 24 * 60 },
  { label: "3 Gün", minutes: 3 * 24 * 60 },
];

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "TASLAK",
  LIVE: "AÇIK",
  ENDED: "KAPANDI",
  CANCELLED: "İPTAL",
};

const STATUS_TONE: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-600 border-slate-200",
  LIVE: "bg-emerald-50 text-emerald-700 border-emerald-200",
  ENDED: "bg-blue-50 text-blue-700 border-blue-200",
  CANCELLED: "bg-red-50 text-red-700 border-red-200",
};

const ORDER_STATUS_LABEL: Record<string, string> = {
  BEKLEMEDE: "BEKLEMEDE",
  HAZIRLANIYOR: "HAZIRLANIYOR",
  GONDERILDI: "GÖNDERİLDİ",
};

const ORDER_STATUS_TONE: Record<string, string> = {
  BEKLEMEDE: "bg-amber-50 text-amber-700 border-amber-200",
  HAZIRLANIYOR: "bg-blue-50 text-blue-700 border-blue-200",
  GONDERILDI: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

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

function BoxIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8M12 13v8" />
    </svg>
  );
}

function PlusIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M12 4v16m8-8H4" />
    </svg>
  );
}

function ListIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
    </svg>
  );
}

function CartIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m-10 4a1 1 0 102 0 1 1 0 00-2 0zm10 0a1 1 0 102 0 1 1 0 00-2 0z" />
    </svg>
  );
}

export default function Tedarik({ isAdmin, selectedBranch }: TedarikProps) {
  void selectedBranch;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isManager, setIsManager] = useState(isAdmin);
  const [channel, setChannel] = useState<"CMR" | "VODAFONE" | null>(null);
  const [periods, setPeriods] = useState<SupplyPeriod[]>([]);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);

  const [catalogOpen, setCatalogOpen] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [newItemNote, setNewItemNote] = useState("");
  const [catalogSaving, setCatalogSaving] = useState(false);
  const [catalogError, setCatalogError] = useState("");

  const [createOpen, setCreateOpen] = useState(false);
  const [createTitle, setCreateTitle] = useState("");
  const [createDuration, setCreateDuration] = useState(DURATION_PRESETS[2].minutes);
  const [createSaving, setCreateSaving] = useState(false);
  const [createError, setCreateError] = useState("");

  const [actionBusyId, setActionBusyId] = useState<number | null>(null);
  const [expandedPeriodId, setExpandedPeriodId] = useState<number | null>(null);
  const [orderBusyId, setOrderBusyId] = useState<number | null>(null);
  const [deletingRequestKey, setDeletingRequestKey] = useState<string | null>(null);

  const [itemQtyDrafts, setItemQtyDrafts] = useState<Record<number, string>>({});
  const [cart, setCart] = useState<{ periodId: number; entries: Record<number, CartEntry> } | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [cartShop, setCartShop] = useState(VODAFONE_SHOPS[0]);
  const [cartSubmitting, setCartSubmitting] = useState(false);
  const [cartError, setCartError] = useState("");

  const load = useCallback(async () => {
    try {
      const [periodsRes, catalogRes] = await Promise.all([
        fetch("/api/supply", { method: "GET", cache: "no-store", credentials: "same-origin" }),
        fetch("/api/supply/catalog", { method: "GET", cache: "no-store", credentials: "same-origin" }),
      ]);

      const periodsResult = await periodsRes.json().catch(() => ({}));
      const catalogResult = await catalogRes.json().catch(() => ({}));

      if (!periodsRes.ok || !periodsResult?.ok) {
        throw new Error(periodsResult?.error || "Tedarik verisi alınamadı.");
      }

      if (!catalogRes.ok || !catalogResult?.ok) {
        throw new Error(catalogResult?.error || "Katalog verisi alınamadı.");
      }

      setIsManager(Boolean(periodsResult.isManager));
      setChannel(periodsResult.channel ?? null);
      setPeriods(Array.isArray(periodsResult.periods) ? periodsResult.periods : []);
      setCatalog(Array.isArray(catalogResult.items) ? catalogResult.items : []);
      setError("");
    } catch (err: any) {
      setError(err?.message || "Tedarik verisi alınamadı.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, POLL_MS);
    return () => window.clearInterval(intervalId);
  }, [load]);

  const submitNewCatalogItem = async () => {
    if (catalogSaving || !newItemName.trim()) return;

    setCatalogSaving(true);
    setCatalogError("");

    try {
      const response = await fetch("/api/supply/catalog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ itemName: newItemName.trim(), itemNote: newItemNote.trim() }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result?.ok) {
        throw new Error(result?.error || "Ürün eklenemedi.");
      }

      setNewItemName("");
      setNewItemNote("");
      void load();
    } catch (err: any) {
      setCatalogError(err?.message || "Ürün eklenemedi.");
    } finally {
      setCatalogSaving(false);
    }
  };

  const toggleCatalogItem = async (item: CatalogItem) => {
    try {
      const response = await fetch(`/api/supply/catalog/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ isActive: !item.isActive }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result?.ok) {
        throw new Error(result?.error || "Güncellenemedi.");
      }

      void load();
    } catch (err: any) {
      setError(err?.message || "Güncellenemedi.");
    }
  };

  const submitCreatePeriod = async () => {
    if (createSaving) return;

    if (!createTitle.trim()) {
      setCreateError("Başlık zorunludur.");
      return;
    }

    setCreateSaving(true);
    setCreateError("");

    try {
      const response = await fetch("/api/supply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ title: createTitle.trim(), durationMinutes: createDuration }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result?.ok) {
        throw new Error(result?.error || "Dönem oluşturulamadı.");
      }

      setCreateOpen(false);
      setCreateTitle("");
      setCreateDuration(DURATION_PRESETS[2].minutes);
      void load();
    } catch (err: any) {
      setCreateError(err?.message || "Dönem oluşturulamadı.");
    } finally {
      setCreateSaving(false);
    }
  };

  const runPeriodAction = async (periodId: number, action: "START" | "END" | "CANCEL") => {
    if (actionBusyId) return;
    setActionBusyId(periodId);

    try {
      const response = await fetch(`/api/supply/${periodId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ action }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result?.ok) {
        throw new Error(result?.error || "İşlem başarısız.");
      }

      void load();
    } catch (err: any) {
      setError(err?.message || "İşlem başarısız.");
    } finally {
      setActionBusyId(null);
    }
  };

  const deletePeriod = async (periodId: number) => {
    if (actionBusyId) return;
    setActionBusyId(periodId);

    try {
      const response = await fetch(`/api/supply/${periodId}`, {
        method: "DELETE",
        credentials: "same-origin",
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result?.ok) {
        throw new Error(result?.error || "Silinemedi.");
      }

      void load();
    } catch (err: any) {
      setError(err?.message || "Silinemedi.");
    } finally {
      setActionBusyId(null);
    }
  };

  const deleteRequest = async (periodId: number, itemId: number, shopName: string) => {
    const key = `${periodId}:${itemId}:${shopName}`;
    if (deletingRequestKey) return;
    setDeletingRequestKey(key);

    try {
      const response = await fetch(
        `/api/supply/${periodId}/request?itemId=${itemId}&shopName=${encodeURIComponent(shopName)}`,
        { method: "DELETE", credentials: "same-origin" }
      );

      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result?.ok) {
        throw new Error(result?.error || "Talep silinemedi.");
      }

      void load();
    } catch (err: any) {
      setError(err?.message || "Talep silinemedi.");
    } finally {
      setDeletingRequestKey(null);
    }
  };

  const [deliveredDrafts, setDeliveredDrafts] = useState<Record<string, string>>({});
  const [savingDeliveredKey, setSavingDeliveredKey] = useState<string | null>(null);

  const saveDeliveredQuantity = async (periodId: number, itemId: number, shopName: string, value: string) => {
    const key = `${periodId}:${itemId}:${shopName}`;
    const deliveredQuantity = Math.max(0, Number(value) || 0);

    if (savingDeliveredKey) return;
    setSavingDeliveredKey(key);

    try {
      const response = await fetch(`/api/supply/${periodId}/request`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ itemId, shopName, deliveredQuantity }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result?.ok) {
        throw new Error(result?.error || "Kaydedilemedi.");
      }

      setDeliveredDrafts((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      void load();
    } catch (err: any) {
      setError(err?.message || "Kaydedilemedi.");
    } finally {
      setSavingDeliveredKey(null);
    }
  };

  const updateOrderStatus = async (orderId: number, status: OrderStatus) => {
    if (orderBusyId) return;
    setOrderBusyId(orderId);

    try {
      const response = await fetch(`/api/supply/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ status }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result?.ok) {
        throw new Error(result?.error || "Durum güncellenemedi.");
      }

      void load();
    } catch (err: any) {
      setError(err?.message || "Durum güncellenemedi.");
    } finally {
      setOrderBusyId(null);
    }
  };

  const getItemQtyDraft = (itemId: number) => itemQtyDrafts[itemId] ?? "1";
  const setItemQtyDraft = (itemId: number, value: string) =>
    setItemQtyDrafts((prev) => ({ ...prev, [itemId]: value }));

  const addToCart = (periodId: number, itemId: number, itemName: string, quantity: number) => {
    setCart((prev) => {
      const samePeriod = prev && prev.periodId === periodId;
      const baseEntries = samePeriod ? prev!.entries : {};
      const existing = baseEntries[itemId];

      return {
        periodId,
        entries: {
          ...baseEntries,
          [itemId]: { itemName, quantity: (existing?.quantity || 0) + quantity },
        },
      };
    });
  };

  const removeCartEntry = (itemId: number) => {
    setCart((prev) => {
      if (!prev) return prev;
      const next = { ...prev.entries };
      delete next[itemId];
      return Object.keys(next).length ? { periodId: prev.periodId, entries: next } : null;
    });
  };

  const updateCartQty = (itemId: number, quantity: number) => {
    setCart((prev) => {
      if (!prev || !prev.entries[itemId]) return prev;
      return { periodId: prev.periodId, entries: { ...prev.entries, [itemId]: { ...prev.entries[itemId], quantity } } };
    });
  };

  const cartEntries = useMemo(
    () => (cart ? Object.entries(cart.entries).map(([itemId, entry]) => ({ itemId: Number(itemId), ...entry })) : []),
    [cart]
  );

  const submitCart = async () => {
    if (!cart || cartSubmitting || cartEntries.length === 0) return;

    const items = cartEntries.map(({ itemId, quantity }) => ({ itemId, quantity }));

    if (items.some((i) => !Number.isInteger(i.quantity) || i.quantity < 1)) {
      setCartError("Geçersiz adet.");
      return;
    }

    setCartSubmitting(true);
    setCartError("");

    try {
      const response = await fetch(`/api/supply/${cart.periodId}/cart`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          shopName: channel === "VODAFONE" ? cartShop : undefined,
          items,
        }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result?.ok) {
        throw new Error(result?.error || "Sipariş gönderilemedi.");
      }

      setCart(null);
      setCartOpen(false);
      void load();
    } catch (err: any) {
      setCartError(err?.message || "Sipariş gönderilemedi.");
    } finally {
      setCartSubmitting(false);
    }
  };

  const downloadExcel = (period: SupplyPeriod) => {
    const statusByShop = new Map(period.orders.map((o) => [o.shopName, o.status]));
    const rows: Record<string, unknown>[] = [];

    for (const item of period.items) {
      if (!item.requests.length) {
        rows.push({ URUN: item.itemName, NOT: item.itemNote, MAGAZA: "-", ADET: 0, DURUM: "-", TALEP_EDEN: "" });
        continue;
      }

      for (const req of item.requests) {
        rows.push({
          URUN: item.itemName,
          NOT: item.itemNote,
          MAGAZA: req.shopName,
          ADET: req.quantity,
          DURUM: ORDER_STATUS_LABEL[statusByShop.get(req.shopName) || ""] || "-",
          TALEP_EDEN: req.requestedByName,
        });
      }
    }

    const worksheet = XLSX.utils.json_to_sheet(rows, {
      header: ["URUN", "NOT", "MAGAZA", "ADET", "DURUM", "TALEP_EDEN"],
    });

    worksheet["!cols"] = [{ wch: 34 }, { wch: 24 }, { wch: 14 }, { wch: 10 }, { wch: 14 }, { wch: 22 }];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Tedarik");

    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Istanbul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());

    XLSX.writeFile(workbook, `${period.title.replace(/[^a-zA-Z0-9ığüşöçİĞÜŞÖÇ]+/g, "_")}_${today}.xlsx`);
  };

  const livePeriods = useMemo(() => periods.filter((p) => p.status === "LIVE"), [periods]);
  const otherPeriods = useMemo(() => periods.filter((p) => p.status !== "LIVE"), [periods]);
  const activeCatalogCount = useMemo(() => catalog.filter((c) => c.isActive).length, [catalog]);

  const renderOrdersSection = (period: SupplyPeriod) => (
    <div className="mt-5 space-y-2 border-t border-slate-100 pt-4">
      <h5 className="text-[10px] font-black uppercase tracking-widest text-slate-400">
        Mağaza Siparişleri{period.orders.length > 0 ? ` (${period.orders.length})` : ""}
      </h5>

      {period.orders.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-200 py-4 text-center text-[11px] font-bold text-slate-400">
          Henüz sepet gönderilmedi.
        </div>
      )}

      {period.orders.map((order) => {
        const totalQty = order.items.reduce((sum, it) => sum + it.quantity, 0);

        return (
          <div key={order.id} className="rounded-2xl border border-slate-100 bg-white px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-black text-slate-900">{order.shopName}</span>
                <span className={`rounded-full border px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wide ${ORDER_STATUS_TONE[order.status] || ""}`}>
                  {ORDER_STATUS_LABEL[order.status] || order.status}
                </span>
                <span className="text-[10px] font-bold text-slate-400">{totalQty} adet</span>
              </div>

              {isManager && (
                <div className="flex items-center gap-1.5">
                  {order.status === "BEKLEMEDE" && (
                    <button
                      type="button"
                      disabled={orderBusyId === order.id}
                      onClick={() => updateOrderStatus(order.id, "HAZIRLANIYOR")}
                      className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-[9px] font-black uppercase text-blue-700 transition hover:bg-blue-100 disabled:opacity-50"
                    >
                      Hazırlanıyor Yap
                    </button>
                  )}
                  {order.status === "HAZIRLANIYOR" && (
                    <>
                      <button
                        type="button"
                        disabled={orderBusyId === order.id}
                        onClick={() => updateOrderStatus(order.id, "BEKLEMEDE")}
                        className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[9px] font-black uppercase text-slate-500 transition hover:bg-slate-50 disabled:opacity-50"
                      >
                        Beklemeye Al
                      </button>
                      <button
                        type="button"
                        disabled={orderBusyId === order.id}
                        onClick={() => updateOrderStatus(order.id, "GONDERILDI")}
                        className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[9px] font-black uppercase text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
                      >
                        Gönderildi Yap
                      </button>
                    </>
                  )}
                  {order.status === "GONDERILDI" && (
                    <button
                      type="button"
                      disabled={orderBusyId === order.id}
                      onClick={() => updateOrderStatus(order.id, "HAZIRLANIYOR")}
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[9px] font-black uppercase text-slate-500 transition hover:bg-slate-50 disabled:opacity-50"
                    >
                      Geri Al
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="mt-2 flex flex-col gap-1.5">
              {order.items.map((it) => {
                const key = `${period.id}:${it.itemId}:${order.shopName}`;
                const deliveredDraft = deliveredDrafts[key];
                const hasDelivered = it.deliveredQuantity !== null;
                const fullyMatched = hasDelivered && it.deliveredQuantity === it.quantity;
                const shortDelivered = hasDelivered && (it.deliveredQuantity as number) < it.quantity;

                return (
                  <div
                    key={it.itemId}
                    className="flex flex-wrap items-center gap-2 rounded-lg border border-blue-100 bg-blue-50/60 px-2.5 py-1.5 text-[10px] font-black text-blue-700"
                  >
                    <span>{it.itemName}: İstenen {it.quantity}</span>

                    {isManager ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] font-bold uppercase tracking-wide text-blue-400">Gönderilen</span>
                        <input
                          type="number"
                          min={0}
                          value={deliveredDraft ?? (it.deliveredQuantity ?? "")}
                          onChange={(e) =>
                            setDeliveredDrafts((prev) => ({ ...prev, [key]: e.target.value }))
                          }
                          onBlur={(e) => {
                            if (e.target.value === "" || Number(e.target.value) === it.deliveredQuantity) return;
                            void saveDeliveredQuantity(period.id, it.itemId, order.shopName, e.target.value);
                          }}
                          placeholder="-"
                          className="h-7 w-14 rounded-md border border-blue-200 bg-white px-1.5 text-center text-[10px] font-black text-slate-700 outline-none focus:border-blue-400"
                        />
                        {savingDeliveredKey === key && (
                          <span className="text-[9px] font-bold text-slate-400">kaydediliyor...</span>
                        )}
                      </div>
                    ) : hasDelivered ? (
                      <span
                        className={`rounded-md px-2 py-0.5 text-[9px] font-black uppercase tracking-wide ${
                          fullyMatched
                            ? "bg-emerald-100 text-emerald-700"
                            : shortDelivered
                            ? "bg-amber-100 text-amber-700"
                            : "bg-blue-100 text-blue-700"
                        }`}
                      >
                        Gönderilen: {it.deliveredQuantity}
                      </span>
                    ) : (
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-slate-400">
                        Henüz işaretlenmedi
                      </span>
                    )}

                    {isManager && (
                      <button
                        type="button"
                        disabled={deletingRequestKey === key}
                        onClick={() => deleteRequest(period.id, it.itemId, order.shopName)}
                        className="ml-auto flex h-5 w-5 items-center justify-center rounded-full text-red-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                        title="Bu kalemi sil"
                      >
                        ×
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <p className="mt-2 text-[9px] font-semibold text-slate-400">
              Gönderen: {order.submittedByName || "-"} · {formatDate(order.updatedAt)}
            </p>
          </div>
        );
      })}
    </div>
  );

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-sm font-bold text-slate-400">
        Yükleniyor...
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1400px] animate-in fade-in space-y-5 duration-500 pb-24">
      <section className="overflow-hidden rounded-[28px] border border-blue-100 bg-gradient-to-r from-white via-white to-blue-50/70 p-5 shadow-sm sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 ring-1 ring-blue-100">
              <BoxIcon className="h-7 w-7" />
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600">
                CNETMOBİL V2
              </div>
              <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
                MAĞAZA TEDARİK
              </h2>
              <p className="mt-1 text-xs font-semibold text-slate-500">
                {isManager
                  ? "Ürünleri bir kez ekle, dönem açtığında hepsi otomatik talebe açılır."
                  : "İstediğiniz ürünleri sepete ekleyip tek seferde sipariş gönderin."}
              </p>
            </div>
          </div>

          {isManager && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCatalogOpen(true)}
                className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-[11px] font-black uppercase tracking-wide text-slate-600 transition hover:bg-slate-50"
              >
                <ListIcon className="h-4 w-4" />
                Ürün Kataloğu ({activeCatalogCount})
              </button>
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 text-[11px] font-black uppercase tracking-wide text-white shadow-lg shadow-blue-950/10 transition hover:bg-blue-500"
              >
                <PlusIcon />
                Yeni Dönem Aç
              </button>
            </div>
          )}
        </div>
      </section>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-bold text-red-600">
          {error}
        </div>
      )}

      {livePeriods.length > 0 && (
        <section className="space-y-4">
          <h3 className="text-[11px] font-black uppercase tracking-widest text-emerald-600">
            Açık Tedarik Dönemleri
          </h3>

          {livePeriods.map((period) => (
            <div key={period.id} className="rounded-[24px] border border-emerald-100 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-lg font-black text-slate-900">{period.title}</h4>
                    <span className={`rounded-full border px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wide ${STATUS_TONE[period.status]}`}>
                      {STATUS_LABEL[period.status]}
                    </span>
                  </div>
                  <p className="mt-1 text-[10px] font-bold text-slate-400">
                    Bitiş: {formatDate(period.endsAt)} · Açan: {period.createdByName || "-"}
                  </p>
                </div>

                {isManager && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => downloadExcel(period)}
                      className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[9px] font-black uppercase tracking-wide text-emerald-700 transition hover:bg-emerald-100"
                    >
                      Excel İndir
                    </button>
                    <button
                      type="button"
                      disabled={actionBusyId === period.id}
                      onClick={() => runPeriodAction(period.id, "END")}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[9px] font-black uppercase tracking-wide text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                    >
                      Şimdi Kapat
                    </button>
                  </div>
                )}
              </div>

              <div className="mt-4 space-y-2">
                {period.items.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-slate-200 py-6 text-center text-[11px] font-bold text-slate-400">
                    Katalogda aktif ürün yok.
                  </div>
                )}

                {period.items.map((item) => {
                  const totalQty = item.requests.reduce((sum, r) => sum + r.quantity, 0);
                  const inCart = cart?.periodId === period.id ? cart.entries[item.id] : undefined;

                  return (
                    <div key={item.id} className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-black text-slate-900">{item.itemName}</div>
                          {item.itemNote && (
                            <div className="mt-0.5 text-[10px] font-semibold text-slate-400">{item.itemNote}</div>
                          )}
                        </div>

                        {isManager ? (
                          totalQty > 0 ? (
                            <span className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-black text-emerald-700">
                              Toplam Talep: {totalQty}
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-slate-400">Henüz talep yok</span>
                          )
                        ) : (
                          <div className="flex flex-wrap items-center gap-2">
                            {inCart && (
                              <span className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-black text-emerald-700">
                                Sepette: {inCart.quantity}
                              </span>
                            )}
                            <div className="flex items-center overflow-hidden rounded-lg border border-slate-200 bg-white">
                              <button
                                type="button"
                                onClick={() =>
                                  setItemQtyDraft(item.id, String(Math.max(1, (Number(getItemQtyDraft(item.id)) || 1) - 1)))
                                }
                                className="flex h-9 w-8 items-center justify-center text-sm font-black text-slate-500 transition hover:bg-slate-50"
                              >
                                −
                              </button>
                              <input
                                type="number"
                                min={1}
                                value={getItemQtyDraft(item.id)}
                                onChange={(e) => setItemQtyDraft(item.id, e.target.value)}
                                className="h-9 w-12 border-x border-slate-200 bg-white text-center text-[11px] font-bold text-slate-700 outline-none"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  setItemQtyDraft(item.id, String((Number(getItemQtyDraft(item.id)) || 1) + 1))
                                }
                                className="flex h-9 w-8 items-center justify-center text-sm font-black text-slate-500 transition hover:bg-slate-50"
                              >
                                +
                              </button>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                const qty = Math.max(1, Number(getItemQtyDraft(item.id)) || 1);
                                addToCart(period.id, item.id, item.itemName, qty);
                                setItemQtyDraft(item.id, "1");
                              }}
                              className="rounded-xl bg-blue-600 px-3 py-2 text-[10px] font-black uppercase tracking-wide text-white transition hover:bg-blue-500 active:scale-95"
                            >
                              Sepete Ekle
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {renderOrdersSection(period)}
            </div>
          ))}
        </section>
      )}

      {livePeriods.length === 0 && (
        <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-6 py-14 text-center">
          <div className="text-sm font-black uppercase tracking-widest text-slate-400">
            Şu an açık tedarik dönemi yok
          </div>
        </div>
      )}

      {isManager && otherPeriods.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-400">
            Geçmiş / Taslak Dönemler
          </h3>

          {otherPeriods.map((period) => {
            const isExpanded = expandedPeriodId === period.id;

            return (
              <div key={period.id} className="rounded-2xl border border-slate-100 bg-white px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-black text-slate-800">{period.title}</span>
                      <span className={`rounded-full border px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wide ${STATUS_TONE[period.status]}`}>
                        {STATUS_LABEL[period.status]}
                      </span>
                    </div>
                    <p className="mt-1 text-[10px] font-bold text-slate-400">
                      Oluşturuldu: {formatDate(period.createdAt)}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {period.status === "ENDED" && (
                      <button
                        type="button"
                        onClick={() => setExpandedPeriodId(isExpanded ? null : period.id)}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[9px] font-black uppercase tracking-wide text-slate-600 transition hover:bg-slate-50"
                      >
                        {isExpanded ? "Gizle" : "Detay"}
                      </button>
                    )}

                    {period.status === "ENDED" && (
                      <button
                        type="button"
                        onClick={() => downloadExcel(period)}
                        className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[9px] font-black uppercase tracking-wide text-emerald-700 transition hover:bg-emerald-100"
                      >
                        Excel İndir
                      </button>
                    )}

                    {period.status === "DRAFT" && (
                      <button
                        type="button"
                        disabled={actionBusyId === period.id}
                        onClick={() => runPeriodAction(period.id, "START")}
                        className="rounded-xl bg-emerald-600 px-3 py-2 text-[9px] font-black uppercase tracking-wide text-white transition hover:bg-emerald-500 disabled:opacity-50"
                      >
                        Başlat
                      </button>
                    )}

                    {(period.status === "DRAFT" || period.status === "LIVE") && (
                      <button
                        type="button"
                        disabled={actionBusyId === period.id}
                        onClick={() => runPeriodAction(period.id, "CANCEL")}
                        className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[9px] font-black uppercase tracking-wide text-red-600 transition hover:bg-red-100 disabled:opacity-50"
                      >
                        İptal Et
                      </button>
                    )}

                    {["DRAFT", "ENDED", "CANCELLED"].includes(period.status) && (
                      <button
                        type="button"
                        disabled={actionBusyId === period.id}
                        onClick={() => deletePeriod(period.id)}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[9px] font-black uppercase text-slate-400 transition hover:border-red-200 hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
                      >
                        Sil
                      </button>
                    )}
                  </div>
                </div>

                {isExpanded && renderOrdersSection(period)}
              </div>
            );
          })}
        </section>
      )}

      {catalogOpen && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-slate-900/80 p-4 backdrop-blur-md">
          <div className="flex max-h-[88vh] w-full max-w-xl flex-col overflow-hidden rounded-[32px] border border-slate-100 bg-white shadow-2xl">
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-5">
              <h3 className="text-lg font-black uppercase tracking-tight text-slate-900">Ürün Kataloğu</h3>
              <button
                type="button"
                onClick={() => setCatalogOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-400 transition hover:bg-red-50 hover:text-red-500"
              >
                ×
              </button>
            </div>

            <div className="overflow-y-auto px-6 py-5 space-y-4">
              <p className="text-[11px] font-semibold text-slate-400">
                Buraya eklediğin ürünler kalıcı olarak kalır — her yeni dönemde tekrar eklemene gerek yok.
                Bir ürünü artık istemiyorsan pasif yap, geçmiş talepler silinmez.
              </p>

              <div className="flex items-center gap-2">
                <input
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  placeholder="Ürün adı (örn: Peçete)"
                  className="h-11 flex-1 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-800 outline-none focus:border-blue-400"
                />
                <input
                  value={newItemNote}
                  onChange={(e) => setNewItemNote(e.target.value)}
                  placeholder="Not (opsiyonel)"
                  className="h-11 w-40 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-800 outline-none focus:border-blue-400"
                />
                <button
                  type="button"
                  disabled={catalogSaving || !newItemName.trim()}
                  onClick={submitNewCatalogItem}
                  className="flex h-11 shrink-0 items-center justify-center gap-1 rounded-xl bg-blue-600 px-4 text-[10px] font-black uppercase text-white transition hover:bg-blue-500 disabled:opacity-50"
                >
                  <PlusIcon className="h-3.5 w-3.5" /> Ekle
                </button>
              </div>

              {catalogError && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-600">
                  {catalogError}
                </div>
              )}

              <div className="space-y-1.5">
                {catalog.length === 0 && (
                  <div className="rounded-xl border border-dashed border-slate-200 py-6 text-center text-[11px] font-bold text-slate-400">
                    Henüz ürün eklenmedi.
                  </div>
                )}

                {catalog.map((item) => (
                  <div
                    key={item.id}
                    className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2 ${
                      item.isActive ? "border-slate-100 bg-slate-50" : "border-slate-100 bg-white opacity-60"
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-black text-slate-800">{item.itemName}</div>
                      {item.itemNote && (
                        <div className="text-[10px] font-semibold text-slate-400">{item.itemNote}</div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleCatalogItem(item)}
                      className={`shrink-0 rounded-lg px-3 py-1.5 text-[9px] font-black uppercase tracking-wide transition ${
                        item.isActive
                          ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                          : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                      }`}
                    >
                      {item.isActive ? "Aktif" : "Pasif"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {createOpen && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-slate-900/80 p-4 backdrop-blur-md">
          <div className="w-full max-w-md rounded-[32px] border border-slate-100 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
              <h3 className="text-lg font-black uppercase tracking-tight text-slate-900">Yeni Dönem Aç</h3>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-400 transition hover:bg-red-50 hover:text-red-500"
              >
                ×
              </button>
            </div>

            <div className="space-y-4 px-6 py-5">
              <div>
                <label className="text-[10px] font-black uppercase tracking-wide text-slate-400">Başlık</label>
                <input
                  value={createTitle}
                  onChange={(e) => setCreateTitle(e.target.value)}
                  placeholder="Örn: Eylül Tedarik Talebi"
                  className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-800 outline-none focus:border-blue-400"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wide text-slate-400">Süre</label>
                <div className="mt-1 flex flex-wrap gap-2">
                  {DURATION_PRESETS.map((preset) => (
                    <button
                      key={preset.minutes}
                      type="button"
                      onClick={() => setCreateDuration(preset.minutes)}
                      className={`rounded-xl border px-3 py-2 text-[11px] font-black uppercase transition ${
                        createDuration === preset.minutes
                          ? "border-blue-500 bg-blue-50 text-blue-700"
                          : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <p className="text-[10px] font-semibold text-slate-400">
                Başlattığında katalogdaki ({activeCatalogCount}) aktif ürünün tamamı otomatik talebe açılır.
              </p>

              {createError && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-600">
                  {createError}
                </div>
              )}
            </div>

            <div className="border-t border-slate-100 px-6 py-4">
              <button
                type="button"
                disabled={createSaving}
                onClick={submitCreatePeriod}
                className="h-12 w-full rounded-2xl bg-blue-600 text-xs font-black uppercase tracking-widest text-white transition hover:bg-blue-500 disabled:opacity-50"
              >
                {createSaving ? "Oluşturuluyor..." : "Taslak Olarak Oluştur"}
              </button>
              <p className="mt-2 text-center text-[10px] font-semibold text-slate-400">
                Oluşturduktan sonra listeden "Başlat" ile talebe açarsın.
              </p>
            </div>
          </div>
        </div>
      )}

      {!isManager && cart && cartEntries.length > 0 && !cartOpen && (
        <button
          type="button"
          onClick={() => setCartOpen(true)}
          className="fixed bottom-6 right-6 z-[130] flex items-center gap-2 rounded-full bg-blue-600 px-5 py-4 text-xs font-black uppercase tracking-wide text-white shadow-2xl shadow-blue-950/30 transition hover:bg-blue-500"
        >
          <CartIcon className="h-5 w-5" />
          Sepetim ({cartEntries.length})
        </button>
      )}

      {cartOpen && cart && (
        <div className="fixed inset-0 z-[150] flex items-end justify-center bg-slate-900/80 p-4 backdrop-blur-md sm:items-center">
          <div className="w-full max-w-lg rounded-[32px] border border-slate-100 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
              <h3 className="text-lg font-black uppercase tracking-tight text-slate-900">Sepetim</h3>
              <button
                type="button"
                onClick={() => setCartOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-400 transition hover:bg-red-50 hover:text-red-500"
              >
                ×
              </button>
            </div>

            <div className="max-h-[45vh] overflow-y-auto px-6 py-5 space-y-2">
              {cartEntries.length === 0 && (
                <div className="rounded-xl border border-dashed border-slate-200 py-6 text-center text-[11px] font-bold text-slate-400">
                  Sepetiniz boş.
                </div>
              )}

              {cartEntries.map((entry) => (
                <div key={entry.itemId} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                  <div className="min-w-0 text-sm font-black text-slate-800">{entry.itemName}</div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      value={entry.quantity}
                      onChange={(e) => updateCartQty(entry.itemId, Math.max(1, Number(e.target.value) || 1))}
                      className="h-9 w-16 rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-bold text-slate-700"
                    />
                    <button
                      type="button"
                      onClick={() => removeCartEntry(entry.itemId)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-red-400 transition hover:bg-red-50 hover:text-red-600"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {channel === "VODAFONE" && cartEntries.length > 0 && (
              <div className="px-6 pb-2">
                <label className="text-[10px] font-black uppercase tracking-wide text-slate-400">Mağaza</label>
                <select
                  value={cartShop}
                  onChange={(e) => setCartShop(e.target.value)}
                  className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700"
                >
                  {VODAFONE_SHOPS.map((shop) => (
                    <option key={shop} value={shop}>
                      {shop}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {cartError && (
              <div className="mx-6 mb-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-600">
                {cartError}
              </div>
            )}

            <div className="border-t border-slate-100 px-6 py-4">
              <button
                type="button"
                disabled={cartSubmitting || cartEntries.length === 0}
                onClick={submitCart}
                className="h-12 w-full rounded-2xl bg-emerald-600 text-xs font-black uppercase tracking-widest text-white transition hover:bg-emerald-500 disabled:opacity-50"
              >
                {cartSubmitting ? "Gönderiliyor..." : "Siparişi Gönder"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
