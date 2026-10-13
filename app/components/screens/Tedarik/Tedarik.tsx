"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";

type TedarikProps = {
  isAdmin: boolean;
  selectedBranch: string;
};

type OrderStatus = "BEKLEMEDE" | "HAZIRLANIYOR" | "GONDERILDI";

type SupplyOrderItem = {
  itemId: number;
  itemName: string;
  itemNote: string;
  quantity: number;
  deliveredQuantity: number | null;
};

type SupplyOrder = {
  id: number;
  shopName: string;
  status: OrderStatus;
  submittedByName: string;
  createdAt: string;
  updatedAt: string;
  items: SupplyOrderItem[];
};

type CatalogItem = {
  id: number;
  itemName: string;
  itemNote: string;
  isActive: boolean;
};

type CartEntry = { itemName: string; quantity: number };

type Tab = "siparis" | "rapor";

const POLL_MS = 4000;

const VODAFONE_SHOPS = ["MEYDAN", "SARAY", "ERNA", "TEKİRA"];

const REPORT_RANGES = [
  { label: "Son 7 gün", days: 7 },
  { label: "Son 30 gün", days: 30 },
  { label: "Son 90 gün", days: 90 },
  { label: "Son 1 yıl", days: 365 },
];

const SENT_PAGE_SIZE = 15;

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

// Yatay çubuk grafik: tek seri (tek renk), değer çubuğun sağında yazar,
// altındaki tablo/ikinci satır aynı veriyi sayı olarak da verir.
function BarList({
  rows,
  emptyText,
}: {
  rows: Array<{ key: string; label: string; value: number; detail: string; onClick?: () => void; active?: boolean }>;
  emptyText: string;
}) {
  const max = Math.max(1, ...rows.map((row) => row.value));

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-[11px] font-bold text-slate-400">
        {emptyText}
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {rows.map((row) => {
        const content = (
          <>
            <div className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate text-xs font-black text-slate-700">{row.label}</span>
              <span className="shrink-0 text-xs font-black text-slate-900">{row.value}</span>
            </div>
            <div className="mt-1 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-blue-500"
                style={{ width: `${Math.max(2, (row.value / max) * 100)}%` }}
              />
            </div>
            <div className="mt-0.5 text-[10px] font-semibold text-slate-400">{row.detail}</div>
          </>
        );

        return row.onClick ? (
          <button
            key={row.key}
            type="button"
            onClick={row.onClick}
            title={`${row.label}: ${row.value} adet - ${row.detail}`}
            className={`block w-full rounded-xl px-2.5 py-1.5 text-left transition hover:bg-blue-50/60 ${
              row.active ? "bg-blue-50 ring-1 ring-blue-200" : ""
            }`}
          >
            {content}
          </button>
        ) : (
          <div key={row.key} title={`${row.label}: ${row.value} adet - ${row.detail}`} className="px-2.5 py-1.5">
            {content}
          </div>
        );
      })}
    </div>
  );
}

function StatCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-sm">
      <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</div>
      <div className="mt-1 text-2xl font-black text-slate-900">{value}</div>
      {hint && <div className="mt-0.5 text-[10px] font-semibold text-slate-400">{hint}</div>}
    </div>
  );
}

export default function Tedarik({ isAdmin, selectedBranch }: TedarikProps) {
  void selectedBranch;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isManager, setIsManager] = useState(isAdmin);
  const [channel, setChannel] = useState<"CMR" | "VODAFONE" | null>(null);
  const [orders, setOrders] = useState<SupplyOrder[]>([]);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);

  const [tab, setTab] = useState<Tab>("siparis");
  const [reportDays, setReportDays] = useState(30);
  const [reportShop, setReportShop] = useState<string | null>(null);
  const [sentVisible, setSentVisible] = useState(SENT_PAGE_SIZE);

  const [catalogOpen, setCatalogOpen] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [newItemNote, setNewItemNote] = useState("");
  const [catalogSaving, setCatalogSaving] = useState(false);
  const [catalogError, setCatalogError] = useState("");

  const [orderBusyId, setOrderBusyId] = useState<number | null>(null);
  const [deletingRequestKey, setDeletingRequestKey] = useState<string | null>(null);

  const [itemQtyDrafts, setItemQtyDrafts] = useState<Record<number, string>>({});
  const [cart, setCart] = useState<Record<number, CartEntry>>({});
  const [cartOpen, setCartOpen] = useState(false);
  const [cartShop, setCartShop] = useState(VODAFONE_SHOPS[0]);
  const [cartSubmitting, setCartSubmitting] = useState(false);
  const [cartError, setCartError] = useState("");

  const [deliveredDrafts, setDeliveredDrafts] = useState<Record<string, string>>({});
  const [savingDeliveredKey, setSavingDeliveredKey] = useState<string | null>(null);

  // Sunucu bekleyen siparişleri her zaman, gönderilenleri son N gün için döner.
  // Rapor aralığı seçilince aynı aralık istenir.
  const load = useCallback(async () => {
    try {
      const [ordersRes, catalogRes] = await Promise.all([
        fetch(`/api/supply?gun=${reportDays}`, { method: "GET", cache: "no-store", credentials: "same-origin" }),
        fetch("/api/supply/catalog", { method: "GET", cache: "no-store", credentials: "same-origin" }),
      ]);

      const ordersResult = await ordersRes.json().catch(() => ({}));
      const catalogResult = await catalogRes.json().catch(() => ({}));

      if (!ordersRes.ok || !ordersResult?.ok) {
        throw new Error(ordersResult?.error || "Tedarik verisi alınamadı.");
      }

      if (!catalogRes.ok || !catalogResult?.ok) {
        throw new Error(catalogResult?.error || "Katalog verisi alınamadı.");
      }

      setIsManager(Boolean(ordersResult.isManager));
      setChannel(ordersResult.channel ?? null);
      setOrders(Array.isArray(ordersResult.orders) ? ordersResult.orders : []);
      setCatalog(Array.isArray(catalogResult.items) ? catalogResult.items : []);
      setError("");
    } catch (err: any) {
      setError(err?.message || "Tedarik verisi alınamadı.");
    } finally {
      setLoading(false);
    }
  }, [reportDays]);

  useEffect(() => {
    void load();
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, POLL_MS);
    return () => window.clearInterval(intervalId);
  }, [load]);

  useEffect(() => {
    if (!notice) return;
    const timeoutId = window.setTimeout(() => setNotice(""), 5000);
    return () => window.clearTimeout(timeoutId);
  }, [notice]);

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

  const deleteRequest = async (orderId: number, itemId: number) => {
    const key = `${orderId}:${itemId}`;
    if (deletingRequestKey) return;
    setDeletingRequestKey(key);

    try {
      const response = await fetch(`/api/supply/orders/${orderId}?itemId=${itemId}`, {
        method: "DELETE",
        credentials: "same-origin",
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result?.ok) {
        throw new Error(result?.error || "Kalem silinemedi.");
      }

      void load();
    } catch (err: any) {
      setError(err?.message || "Kalem silinemedi.");
    } finally {
      setDeletingRequestKey(null);
    }
  };

  const saveDeliveredQuantity = async (orderId: number, itemId: number, value: string) => {
    const key = `${orderId}:${itemId}`;
    const deliveredQuantity = Math.max(0, Number(value) || 0);

    if (savingDeliveredKey) return;
    setSavingDeliveredKey(key);

    try {
      const response = await fetch(`/api/supply/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ itemId, deliveredQuantity }),
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

  const addToCart = (itemId: number, itemName: string, quantity: number) => {
    setCart((prev) => ({
      ...prev,
      [itemId]: { itemName, quantity: (prev[itemId]?.quantity || 0) + quantity },
    }));
  };

  const removeCartEntry = (itemId: number) => {
    setCart((prev) => {
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
  };

  const updateCartQty = (itemId: number, quantity: number) => {
    setCart((prev) => (prev[itemId] ? { ...prev, [itemId]: { ...prev[itemId], quantity } } : prev));
  };

  const cartEntries = useMemo(
    () => Object.entries(cart).map(([itemId, entry]) => ({ itemId: Number(itemId), ...entry })),
    [cart]
  );

  const submitCart = async () => {
    if (cartSubmitting || cartEntries.length === 0) return;

    const items = cartEntries.map(({ itemId, quantity }) => ({ itemId, quantity }));

    if (items.some((i) => !Number.isInteger(i.quantity) || i.quantity < 1)) {
      setCartError("Geçersiz adet.");
      return;
    }

    setCartSubmitting(true);
    setCartError("");

    try {
      const response = await fetch("/api/supply", {
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

      setCart({});
      setCartOpen(false);
      setNotice("Siparişiniz gönderildi.");
      void load();
    } catch (err: any) {
      setCartError(err?.message || "Sipariş gönderilemedi.");
    } finally {
      setCartSubmitting(false);
    }
  };

  const activeCatalog = useMemo(() => catalog.filter((c) => c.isActive), [catalog]);

  const pendingOrders = useMemo(
    () => orders.filter((o) => o.status !== "GONDERILDI").sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [orders]
  );
  const sentOrders = useMemo(
    () => orders.filter((o) => o.status === "GONDERILDI").sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [orders]
  );

  // Yöneticinin "ne hazırlayacağım" görünümü: bekleyen siparişlerin ürün toplamı.
  const pendingTotals = useMemo(() => {
    const totals = new Map<number, { itemName: string; quantity: number }>();

    for (const order of pendingOrders) {
      for (const it of order.items) {
        const entry = totals.get(it.itemId) || { itemName: it.itemName, quantity: 0 };
        entry.quantity += it.quantity;
        totals.set(it.itemId, entry);
      }
    }

    return Array.from(totals.values()).sort((a, b) => b.quantity - a.quantity);
  }, [pendingOrders]);

  // ---- RAPOR ----
  const report = useMemo(() => {
    const cutoff = Date.now() - reportDays * 86_400_000;
    const inRange = orders.filter((o) => new Date(o.createdAt).getTime() >= cutoff);

    const shops = new Map<
      string,
      { shopName: string; orderCount: number; requested: number; delivered: number; pendingOrders: number; sentOrders: number }
    >();

    for (const order of inRange) {
      const shop = shops.get(order.shopName) || {
        shopName: order.shopName,
        orderCount: 0,
        requested: 0,
        delivered: 0,
        pendingOrders: 0,
        sentOrders: 0,
      };

      shop.orderCount += 1;
      if (order.status === "GONDERILDI") shop.sentOrders += 1;
      else shop.pendingOrders += 1;

      for (const it of order.items) {
        shop.requested += it.quantity;
        shop.delivered += it.deliveredQuantity ?? 0;
      }

      shops.set(order.shopName, shop);
    }

    const shopRows = Array.from(shops.values()).sort((a, b) => b.requested - a.requested);

    const scoped = reportShop ? inRange.filter((o) => o.shopName === reportShop) : inRange;
    const items = new Map<
      number,
      { itemName: string; requested: number; delivered: number; orderCount: number; shops: Set<string> }
    >();

    for (const order of scoped) {
      for (const it of order.items) {
        const entry = items.get(it.itemId) || {
          itemName: it.itemName,
          requested: 0,
          delivered: 0,
          orderCount: 0,
          shops: new Set<string>(),
        };
        entry.requested += it.quantity;
        entry.delivered += it.deliveredQuantity ?? 0;
        entry.orderCount += 1;
        entry.shops.add(order.shopName);
        items.set(it.itemId, entry);
      }
    }

    const itemRows = Array.from(items.entries())
      .map(([itemId, entry]) => ({ itemId, ...entry, shopCount: entry.shops.size }))
      .sort((a, b) => b.requested - a.requested);

    return {
      inRange,
      shopRows,
      itemRows,
      scopedOrders: scoped,
      totalOrders: scoped.length,
      totalRequested: itemRows.reduce((sum, row) => sum + row.requested, 0),
      totalDelivered: itemRows.reduce((sum, row) => sum + row.delivered, 0),
      // Karşılanma yüzdesi sadece GÖNDERİLDİ siparişlerin istenenine göre:
      // bekleyen siparişler henüz gönderilmediği için oranı düşürmesin.
      sentRequested: scoped
        .filter((o) => o.status === "GONDERILDI")
        .reduce((sum, o) => sum + o.items.reduce((inner, it) => inner + it.quantity, 0), 0),
      sentDelivered: scoped
        .filter((o) => o.status === "GONDERILDI")
        .reduce((sum, o) => sum + o.items.reduce((inner, it) => inner + (it.deliveredQuantity ?? 0), 0), 0),
      pendingCount: scoped.filter((o) => o.status !== "GONDERILDI").length,
    };
  }, [orders, reportDays, reportShop]);

  const downloadExcel = () => {
    const rows: Record<string, unknown>[] = [];

    for (const order of report.scopedOrders) {
      for (const it of order.items) {
        rows.push({
          SIPARIS_NO: order.id,
          TARIH: formatDate(order.createdAt),
          MAGAZA: order.shopName,
          URUN: it.itemName,
          NOT: it.itemNote,
          ISTENEN: it.quantity,
          GONDERILEN: it.deliveredQuantity ?? "",
          DURUM: ORDER_STATUS_LABEL[order.status] || order.status,
          SIPARIS_VEREN: order.submittedByName,
        });
      }
    }

    const worksheet = XLSX.utils.json_to_sheet(rows, {
      header: ["SIPARIS_NO", "TARIH", "MAGAZA", "URUN", "NOT", "ISTENEN", "GONDERILEN", "DURUM", "SIPARIS_VEREN"],
    });

    worksheet["!cols"] = [{ wch: 11 }, { wch: 18 }, { wch: 14 }, { wch: 34 }, { wch: 24 }, { wch: 10 }, { wch: 12 }, { wch: 14 }, { wch: 22 }];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Tedarik");

    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Istanbul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());

    XLSX.writeFile(workbook, `Tedarik_Siparisleri_${today}.xlsx`);
  };

  const renderOrderCard = (order: SupplyOrder) => {
    const totalQty = order.items.reduce((sum, it) => sum + it.quantity, 0);

    return (
      <div key={order.id} className="rounded-2xl border border-slate-100 bg-white px-3 py-3 shadow-sm sm:px-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-black text-slate-900">{order.shopName}</span>
            <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${ORDER_STATUS_TONE[order.status] || ""}`}>
              {ORDER_STATUS_LABEL[order.status] || order.status}
            </span>
            <span className="text-xs font-bold text-slate-400">
              #{order.id} · {totalQty} adet
            </span>
          </div>

          {isManager && (
            <div className="flex flex-wrap items-center gap-1.5">
              {order.status === "BEKLEMEDE" && (
                <button
                  type="button"
                  disabled={orderBusyId === order.id}
                  onClick={() => updateOrderStatus(order.id, "HAZIRLANIYOR")}
                  className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-[10px] font-black uppercase text-blue-700 transition hover:bg-blue-100 disabled:opacity-50"
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
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[10px] font-black uppercase text-slate-500 transition hover:bg-slate-50 disabled:opacity-50"
                  >
                    Beklemeye Al
                  </button>
                  <button
                    type="button"
                    disabled={orderBusyId === order.id}
                    onClick={() => updateOrderStatus(order.id, "GONDERILDI")}
                    className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[10px] font-black uppercase text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
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
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[10px] font-black uppercase text-slate-500 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  Geri Al
                </button>
              )}
            </div>
          )}
        </div>

        <div className="mt-2 flex flex-col gap-1.5">
          {order.items.map((it) => {
            const key = `${order.id}:${it.itemId}`;
            const deliveredDraft = deliveredDrafts[key];
            const hasDelivered = it.deliveredQuantity !== null;
            const fullyMatched = hasDelivered && it.deliveredQuantity === it.quantity;
            const shortDelivered = hasDelivered && (it.deliveredQuantity as number) < it.quantity;

            return (
              <div key={it.itemId} className="rounded-lg border border-blue-100 bg-blue-50/60 px-3 py-2.5">
                <div className="flex items-start justify-between gap-2">
                  <span className="min-w-0 break-words text-xs font-black text-blue-700">{it.itemName}</span>
                  {isManager && (
                    <button
                      type="button"
                      disabled={deletingRequestKey === key}
                      onClick={() => deleteRequest(order.id, it.itemId)}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-base text-red-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                      title="Bu kalemi sil"
                    >
                      ×
                    </button>
                  )}
                </div>

                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <span className="rounded-md bg-white px-2 py-1 text-xs font-bold text-blue-600">
                    İstenen: {it.quantity}
                  </span>

                  {isManager ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wide text-blue-400">Gönderilen</span>
                      <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        value={deliveredDraft ?? (it.deliveredQuantity ?? "")}
                        onChange={(e) => setDeliveredDrafts((prev) => ({ ...prev, [key]: e.target.value }))}
                        onBlur={(e) => {
                          if (e.target.value === "" || Number(e.target.value) === it.deliveredQuantity) return;
                          void saveDeliveredQuantity(order.id, it.itemId, e.target.value);
                        }}
                        placeholder="-"
                        className="h-9 w-16 rounded-md border border-blue-200 bg-white px-1.5 text-center text-sm font-black text-slate-700 outline-none focus:border-blue-400"
                      />
                      {savingDeliveredKey === key && (
                        <span className="text-[10px] font-bold text-slate-400">kaydediliyor...</span>
                      )}
                    </div>
                  ) : hasDelivered ? (
                    <span
                      className={`rounded-md px-2 py-1 text-xs font-black uppercase tracking-wide ${
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
                    <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-black uppercase tracking-wide text-slate-400">
                      Henüz işaretlenmedi
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <p className="mt-2 text-[11px] font-semibold text-slate-400">
          Veren: {order.submittedByName || "-"} · {formatDate(order.createdAt)}
          {order.status === "GONDERILDI" ? ` · Gönderildi: ${formatDate(order.updatedAt)}` : ""}
        </p>
      </div>
    );
  };

  const renderReport = () => {
    const allShopsRequested = report.shopRows.reduce((sum, shop) => sum + shop.requested, 0);
    const fulfilmentPercent =
      report.sentRequested > 0 ? Math.round((report.sentDelivered / report.sentRequested) * 100) : null;

    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          {REPORT_RANGES.map((range) => (
            <button
              key={range.days}
              type="button"
              onClick={() => setReportDays(range.days)}
              className={`rounded-xl border px-3 py-2 text-[11px] font-black uppercase transition ${
                reportDays === range.days
                  ? "border-blue-500 bg-blue-50 text-blue-700"
                  : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
              }`}
            >
              {range.label}
            </button>
          ))}

          {reportShop && (
            <button
              type="button"
              onClick={() => setReportShop(null)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-black uppercase text-slate-500 transition hover:bg-slate-50"
            >
              {reportShop} ✕ Tüm mağazalar
            </button>
          )}

          <button
            type="button"
            onClick={downloadExcel}
            className="ml-auto rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] font-black uppercase tracking-wide text-emerald-700 transition hover:bg-emerald-100"
          >
            Excel İndir
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Sipariş" value={report.totalOrders} hint={`${report.pendingCount} bekleyen`} />
          <StatCard label="İstenen adet" value={report.totalRequested} />
          <StatCard label="Gönderilen adet" value={report.totalDelivered} hint="Yöneticinin işaretlediği" />
          <StatCard
            label="Karşılanma"
            value={fulfilmentPercent === null ? "-" : `%${fulfilmentPercent}`}
            hint="Gönderilen siparişlerde gönderilen / istenen"
          />
        </div>

        {(
          <section className="rounded-[24px] border border-slate-100 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-black uppercase tracking-wide text-slate-700">Hangi mağaza ne kadar istiyor</h3>
            <p className="mb-3 mt-0.5 text-[10px] font-semibold text-slate-400">
              Bir mağazaya tıklarsan aşağıdaki ürün raporu o mağazaya göre filtrelenir.
            </p>
            <BarList
              emptyText="Bu aralıkta sipariş yok."
              rows={report.shopRows.map((shop) => ({
                key: shop.shopName,
                label: shop.shopName,
                value: shop.requested,
                detail: `${shop.orderCount} sipariş · ${shop.delivered} adet gönderildi · ${shop.pendingOrders} bekleyen`,
                active: reportShop === shop.shopName,
                onClick: () => setReportShop(reportShop === shop.shopName ? null : shop.shopName),
              }))}
            />
          </section>
        )}

        <section className="rounded-[24px] border border-slate-100 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-black uppercase tracking-wide text-slate-700">
            En çok istenen ürünler{reportShop ? ` · ${reportShop}` : ""}
          </h3>
          <div className="mt-3">
            <BarList
              emptyText="Bu aralıkta sipariş yok."
              rows={report.itemRows.slice(0, 10).map((row) => ({
                key: String(row.itemId),
                label: row.itemName,
                value: row.requested,
                detail: `${row.orderCount} siparişte · ${row.shopCount} mağaza · gönderilen ${row.delivered}`,
              }))}
            />
          </div>
        </section>

        <section className="overflow-hidden rounded-[24px] border border-slate-100 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-3 text-sm font-black uppercase tracking-wide text-slate-700">
            Mağaza tablosu
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-xs">
              <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-5 py-2.5">Mağaza</th>
                  <th className="px-3 py-2.5 text-right">Sipariş</th>
                  <th className="px-3 py-2.5 text-right">İstenen</th>
                  <th className="px-3 py-2.5 text-right">Gönderilen</th>
                  <th className="px-3 py-2.5 text-right">Bekleyen sipariş</th>
                  <th className="px-5 py-2.5 text-right">Toplamdaki payı</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 font-semibold text-slate-700">
                {report.shopRows.map((shop) => (
                  <tr key={shop.shopName}>
                    <td className="px-5 py-2.5 font-black text-slate-800">{shop.shopName}</td>
                    <td className="px-3 py-2.5 text-right">{shop.orderCount}</td>
                    <td className="px-3 py-2.5 text-right">{shop.requested}</td>
                    <td className="px-3 py-2.5 text-right">{shop.delivered}</td>
                    <td className="px-3 py-2.5 text-right">{shop.pendingOrders}</td>
                    <td className="px-5 py-2.5 text-right">
                      {allShopsRequested > 0 ? `%${Math.round((shop.requested / allShopsRequested) * 100)}` : "-"}
                    </td>
                  </tr>
                ))}
                {report.shopRows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-6 text-center text-[11px] font-bold text-slate-400">
                      Bu aralıkta sipariş yok.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="overflow-hidden rounded-[24px] border border-slate-100 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-3 text-sm font-black uppercase tracking-wide text-slate-700">
            Ürün tablosu{reportShop ? ` · ${reportShop}` : ""}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-xs">
              <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-5 py-2.5">Ürün</th>
                  <th className="px-3 py-2.5 text-right">İstenen</th>
                  <th className="px-3 py-2.5 text-right">Gönderilen</th>
                  <th className="px-3 py-2.5 text-right">Sipariş</th>
                  <th className="px-5 py-2.5 text-right">Mağaza</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 font-semibold text-slate-700">
                {report.itemRows.map((row) => (
                  <tr key={row.itemId}>
                    <td className="px-5 py-2.5 font-black text-slate-800">{row.itemName}</td>
                    <td className="px-3 py-2.5 text-right">{row.requested}</td>
                    <td className="px-3 py-2.5 text-right">{row.delivered}</td>
                    <td className="px-3 py-2.5 text-right">{row.orderCount}</td>
                    <td className="px-5 py-2.5 text-right">{row.shopCount}</td>
                  </tr>
                ))}
                {report.itemRows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-6 text-center text-[11px] font-bold text-slate-400">
                      Bu aralıkta sipariş yok.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    );
  };

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
                  ? "Ürünleri bir kez kataloğa ekle; mağazalar her gün her saat sipariş verebilir."
                  : "İstediğiniz ürünleri sepete ekleyip istediğiniz zaman sipariş gönderin."}
              </p>
            </div>
          </div>

          {isManager && (
            <button
              type="button"
              onClick={() => setCatalogOpen(true)}
              className="flex h-12 items-center justify-center gap-2 self-start rounded-2xl border border-slate-200 bg-white px-4 text-[11px] font-black uppercase tracking-wide text-slate-600 transition hover:bg-slate-50 sm:self-auto"
            >
              <ListIcon className="h-4 w-4" />
              Ürün Kataloğu ({activeCatalog.length})
            </button>
          )}
        </div>
      </section>

      {isManager && (
      <div className="flex gap-2">
        {(
          [
            { id: "siparis", label: "Siparişler" },
            { id: "rapor", label: "Rapor" },
          ] as Array<{ id: Tab; label: string }>
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`rounded-xl border px-4 py-2.5 text-[11px] font-black uppercase tracking-wide transition ${
              tab === item.id
                ? "border-blue-500 bg-blue-600 text-white"
                : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-bold text-red-600">
          {error}
        </div>
      )}

      {notice && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-700">
          {notice}
        </div>
      )}

      {isManager && tab === "rapor" && renderReport()}

      {tab === "siparis" && !isManager && (
        <section className="space-y-2">
          <h3 className="text-[11px] font-black uppercase tracking-widest text-emerald-600">Ürünler</h3>

          {activeCatalog.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-200 py-8 text-center text-[11px] font-bold text-slate-400">
              Şu an sipariş verilebilecek ürün yok.
            </div>
          )}

          {activeCatalog.map((item) => {
            const inCart = cart[item.id];

            return (
              <div key={item.id} className="rounded-2xl border border-slate-100 bg-white px-3 py-3 shadow-sm sm:px-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 break-words">
                    <div className="font-black text-slate-900">{item.itemName}</div>
                    {item.itemNote && (
                      <div className="mt-0.5 text-xs font-semibold text-slate-400">{item.itemNote}</div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {inCart && (
                      <span className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-black text-emerald-700">
                        Sepette: {inCart.quantity}
                      </span>
                    )}
                    <div className="flex items-center overflow-hidden rounded-lg border border-slate-200 bg-white">
                      <button
                        type="button"
                        onClick={() =>
                          setItemQtyDraft(item.id, String(Math.max(1, (Number(getItemQtyDraft(item.id)) || 1) - 1)))
                        }
                        className="flex h-11 w-11 items-center justify-center text-base font-black text-slate-500 transition active:bg-slate-100"
                      >
                        −
                      </button>
                      <input
                        type="number"
                        inputMode="numeric"
                        min={1}
                        value={getItemQtyDraft(item.id)}
                        onChange={(e) => setItemQtyDraft(item.id, e.target.value)}
                        className="h-11 w-14 border-x border-slate-200 bg-white text-center text-sm font-bold text-slate-700 outline-none"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setItemQtyDraft(item.id, String((Number(getItemQtyDraft(item.id)) || 1) + 1))
                        }
                        className="flex h-11 w-11 items-center justify-center text-base font-black text-slate-500 transition active:bg-slate-100"
                      >
                        +
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const qty = Math.max(1, Number(getItemQtyDraft(item.id)) || 1);
                        addToCart(item.id, item.itemName, qty);
                        setItemQtyDraft(item.id, "1");
                      }}
                      className="h-11 flex-1 rounded-xl bg-blue-600 px-4 text-xs font-black uppercase tracking-wide text-white transition hover:bg-blue-500 active:scale-95 sm:flex-none"
                    >
                      Sepete Ekle
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </section>
      )}

      {tab === "siparis" && isManager && pendingTotals.length > 0 && (
        <section className="rounded-[24px] border border-amber-100 bg-amber-50/40 p-5">
          <h3 className="text-[11px] font-black uppercase tracking-widest text-amber-700">
            Bekleyen siparişlerin ürün toplamı
          </h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {pendingTotals.map((row) => (
              <span
                key={row.itemName}
                className="rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-xs font-black text-slate-700"
              >
                {row.itemName}: <span className="text-amber-700">{row.quantity}</span>
              </span>
            ))}
          </div>
        </section>
      )}

      {tab === "siparis" && (
        <section className="space-y-3">
          <h3 className="text-[11px] font-black uppercase tracking-widest text-blue-600">
            {isManager ? "Bekleyen siparişler" : "Siparişlerim"}
            {pendingOrders.length > 0 ? ` (${pendingOrders.length})` : ""}
          </h3>

          {pendingOrders.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-200 py-8 text-center text-[11px] font-bold text-slate-400">
              {isManager ? "Bekleyen sipariş yok." : "Bekleyen siparişiniz yok."}
            </div>
          )}

          {pendingOrders.map(renderOrderCard)}

          {sentOrders.length > 0 && (
            <>
              <h3 className="pt-3 text-[11px] font-black uppercase tracking-widest text-slate-400">
                Gönderilenler ({sentOrders.length})
              </h3>

              {sentOrders.slice(0, sentVisible).map(renderOrderCard)}

              {sentOrders.length > sentVisible && (
                <button
                  type="button"
                  onClick={() => setSentVisible((count) => count + SENT_PAGE_SIZE)}
                  className="w-full rounded-xl border border-slate-200 bg-white py-3 text-[11px] font-black uppercase tracking-wide text-slate-500 transition hover:bg-slate-50"
                >
                  Daha fazla göster
                </button>
              )}
            </>
          )}
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
                Buraya eklediğin aktif ürünlerin hepsi mağazalara her zaman sipariş için açıktır.
                Bir ürünü artık istemiyorsan pasif yap, geçmiş siparişler silinmez.
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
                      className={`shrink-0 rounded-lg px-3 py-1.5 text-[11px] font-black uppercase tracking-wide transition ${
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

      {!isManager && cartEntries.length > 0 && !cartOpen && (
        <button
          type="button"
          onClick={() => setCartOpen(true)}
          className="fixed bottom-6 right-6 z-[130] flex items-center gap-2 rounded-full bg-blue-600 px-5 py-4 text-xs font-black uppercase tracking-wide text-white shadow-2xl shadow-blue-950/30 transition hover:bg-blue-500"
        >
          <CartIcon className="h-5 w-5" />
          Sepetim ({cartEntries.length})
        </button>
      )}

      {cartOpen && (
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
