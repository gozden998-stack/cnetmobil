"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";

type IdefixProduct = {
  barcode?: string | null;
  title?: string | null;
  productMainId?: string | null;
  vendorStockCode?: string | null;
  inventoryQuantity?: number | null;
  price?: number | null;
  comparePrice?: number | null;
  state?: string | null;
  status?: string | null;
  saleOpen?: boolean;
  saleStatus?: string | null;
  liveInventoryFound?: boolean;
  brandId?: number | null;
  categoryId?: number | null;
  imageUrl?: string | null;
};

type ProductResponse = {
  success?: boolean;
  connected?: boolean;
  vendorId?: string;
  totalCount?: number;
  openCount?: number;
  closedCount?: number;
  pendingCount?: number;
  declinedCount?: number;
  inventoryItemCount?: number;
  poolCount?: number;
  readyForSalePoolCount?: number;
  physicalStock?: number;
  products?: IdefixProduct[];
  checkedAt?: string;
  error?: string;
};

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

function normalizeState(value: unknown) {
  return text(value)
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function isOpenProduct(product: IdefixProduct) {
  if (typeof product.saleOpen === "boolean") {
    return product.saleOpen;
  }

  return (
    normalizeState(product.state ?? product.status) ===
      "ready_for_sale" &&
    Number(product.inventoryQuantity || 0) > 0
  );
}

export default function Idefix() {
  const [data, setData] = useState<ProductResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<TabKey>("open");
  const [sort, setSort] = useState("newest");

  const load = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true);
    }

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
      if (!silent) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void load(false);

    // İdefix ekranı açıkken 60 saniyede bir sessiz canlı yenileme.
    // Böylece paneldeki satış açık/kapalı durumu İdefix ile aynı kalır.
    const intervalId = window.setInterval(() => {
      void load(true);
    }, 60_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [load]);

  const products = useMemo(
    () => (Array.isArray(data?.products) ? data!.products! : []),
    [data]
  );

  const openProducts = useMemo(
    () => products.filter(isOpenProduct),
    [products]
  );

  const closedProducts = useMemo(
    () => products.filter((item) => !isOpenProduct(item)),
    [products]
  );

  const physicalStock = useMemo(() => {
    if (
      typeof data?.physicalStock === "number" &&
      Number.isFinite(data.physicalStock)
    ) {
      return Math.max(0, data.physicalStock);
    }

    return openProducts.reduce(
      (sum, item) =>
        sum +
        Math.max(
          0,
          Number(item.inventoryQuantity || 0)
        ),
      0
    );
  }, [data?.physicalStock, openProducts]);

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
                onClick={() => void load(false)}
                disabled={loading}
                className="h-10 rounded-xl border border-slate-200 bg-white px-5 text-[9px] font-black uppercase text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
              >
                {loading ? "Yenileniyor..." : "Yenile"}
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
              value: "...",
              sub: "Yeni İdefix siparişi",
              icon: "🛒",
              box: "bg-emerald-50 text-emerald-700",
            },
            {
              label: "SATIŞTAKİ İLAN",
              value: openProducts.length,
              sub: "Canlı inventory stoklu ilan",
              icon: "◎",
              box: "bg-cyan-50 text-cyan-700",
            },
            {
              label: "FİZİKSEL STOK",
              value: physicalStock,
              sub: "Inventory API toplam stok",
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
            <span>
              İdefix Ürünlerim: <b className="text-slate-900">{Number(data?.totalCount || 0)}</b>
            </span>
            <span>
              Havuz: <b className="text-slate-900">{Number(data?.poolCount || 0)}</b>
            </span>
            <span>
              Inventory API: <b className="text-slate-900">{Number(data?.inventoryItemCount || 0)}</b>
            </span>
            <span>
              Bekleyen: <b className="text-slate-900">{Number(data?.pendingCount || 0)}</b>
            </span>
            <span>
              Red/Eksik: <b className="text-slate-900">{Number(data?.declinedCount || 0)}</b>
            </span>
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
              Siparişler (...)
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
          <div className="flex min-h-[260px] flex-col items-center justify-center px-6 py-12 text-center">
            <div className="text-4xl">🛒</div>
            <div className="mt-3 text-sm font-black text-slate-800">
              İdefix Siparişleri
            </div>
            <div className="mt-1 max-w-md text-[10px] font-semibold leading-5 text-slate-400">
              Görsel yapı hazır. Sipariş API route'u bağlandığında N11 ile aynı kart / tablo düzeninde gerçek siparişler burada gösterilecek.
            </div>
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
                              : normalizeState(product.state ?? product.status).includes("declined") ||
                                normalizeState(product.state ?? product.status) === "missing_info"
                              ? "bg-rose-100 text-rose-700"
                              : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {product.saleStatus || (open ? "Yayında" : "Kapalı")}
                        </span>
                        <div className="mt-1 text-[7px] font-semibold uppercase text-slate-400">
                          {normalizeState(product.state ?? product.status) || "-"}
                        </div>
                        <div className="mt-0.5 text-[7px] font-semibold text-slate-400">
                          {product.liveInventoryFound
                            ? "Inventory API kaydı var"
                            : "Inventory API kaydı yok · stok 0 kabul edildi"}
                        </div>
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
