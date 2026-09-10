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


type DirectCreateForm = {
  imei: string;
  brand: string;
  model: string;
  memory: string;
  color: string;
  grade: string;
  warranty: string;
  salePrice: string;
  listPrice: string;
};

type DirectPreview = {
  title?: string;
  barcode?: string;
  vendorStockCode?: string;
  productMainId?: string;
  brandId?: string | number | null;
  categoryId?: string | number | null;
  imageReady?: boolean;
  imageUrl?: string | null;
  attributeCount?: number;
  blockers?: string[];
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

function isOpenProduct(product: IdefixProduct) {
  return Number(product.inventoryQuantity || 0) > 0;
}

export default function Idefix() {
  const [data, setData] = useState<ProductResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<TabKey>("open");
  const [sort, setSort] = useState("newest");
  const [addOpen, setAddOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [sendMessage, setSendMessage] = useState("");
  const [directPreview, setDirectPreview] = useState<DirectPreview | null>(null);
  const [form, setForm] = useState<DirectCreateForm>({
    imei: "",
    brand: "Apple",
    model: "",
    memory: "128 GB",
    color: "",
    grade: "A",
    warranty: "12 Ay",
    salePrice: "",
    listPrice: "",
  });

  const updateForm = (key: keyof DirectCreateForm, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const resetDirectCreate = () => {
    setSendError("");
    setSendMessage("");
    setDirectPreview(null);
    setForm({
      imei: "",
      brand: "Apple",
      model: "",
      memory: "128 GB",
      color: "",
      grade: "A",
      warranty: "12 Ay",
      salePrice: "",
      listPrice: "",
    });
  };

  const submitDirectCreate = async () => {
    setSending(true);
    setSendError("");
    setSendMessage("");
    setDirectPreview(null);

    try {
      const salePrice = Number(String(form.salePrice).replace(",", "."));
      const listPrice = Number(String(form.listPrice).replace(",", "."));

      if (!/^\d{15}$/.test(form.imei.trim())) {
        throw new Error("IMEI tam 15 hane olmalıdır.");
      }

      if (!form.brand.trim() || !form.model.trim() || !form.memory.trim() || !form.color.trim()) {
        throw new Error("Marka, model, hafıza ve renk zorunludur.");
      }

      if (!Number.isFinite(salePrice) || salePrice <= 0) {
        throw new Error("Geçerli satış fiyatı gir.");
      }

      if (!Number.isFinite(listPrice) || listPrice < salePrice) {
        throw new Error("Liste fiyatı satış fiyatından düşük olamaz.");
      }

      const centerResponse = await fetch("/api/online/center/devices", {
        method: "POST",
        cache: "no-store",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          imei: form.imei.trim(),
          brand: form.brand.trim(),
          model: form.model.trim(),
          memory: form.memory.trim(),
          color: form.color.trim(),
          grade: form.grade,
          warranty: form.warranty,
        }),
      });

      const centerPayload = await centerResponse.json().catch(() => ({}));
      let deviceId = Number(centerPayload?.device?.id || 0);

      if (!centerResponse.ok || !centerPayload?.success) {
        const duplicateId = Number(centerPayload?.duplicate?.id || 0);
        const duplicateStatus = text(centerPayload?.duplicate?.status).toUpperCase();

        if (centerResponse.status === 409 && duplicateId > 0 && duplicateStatus === "AVAILABLE") {
          deviceId = duplicateId;
        } else {
          throw new Error(centerPayload?.error || "Cihaz merkezi stoğa bağlanamadı.");
        }
      }

      if (!deviceId) {
        throw new Error("Cihaz kayıt ID'si alınamadı.");
      }

      const commonBody = { deviceIds: [deviceId], salePrice, listPrice };

      const previewResponse = await fetch("/api/online/idefix/direct-create", {
        method: "POST",
        cache: "no-store",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "preview", ...commonBody }),
      });

      const previewPayload = await previewResponse.json().catch(() => ({}));
      const previewRow: DirectPreview | null = Array.isArray(previewPayload?.preview)
        ? previewPayload.preview[0] || null
        : null;
      setDirectPreview(previewRow);

      if (!previewResponse.ok || !previewPayload?.success) {
        throw new Error(previewPayload?.error || "İdefix ön kontrol başarısız.");
      }

      if (!previewPayload?.canCommit) {
        const blockers = Array.isArray(previewRow?.blockers) ? previewRow!.blockers! : [];
        throw new Error(blockers.join(" | ") || "İdefix create için eksik bilgi var.");
      }

      const commitResponse = await fetch("/api/online/idefix/direct-create", {
        method: "POST",
        cache: "no-store",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "commit", ...commonBody }),
      });

      const commitPayload = await commitResponse.json().catch(() => ({}));

      if (!commitResponse.ok || !commitPayload?.success) {
        throw new Error(commitPayload?.error || "İdefix create başarısız.");
      }

      const result = Array.isArray(commitPayload?.results) ? commitPayload.results[0] : null;

      if (result?.saleOpen === true) {
        setSendMessage(`SATIŞTA ✅ ${result?.message || "İdefix ürünü satışa açıldı."}`);
        await load();
      } else {
        setSendMessage(`İDEFİX İŞLİYOR ⏳ ${result?.message || "Ürün create edildi; katalog/yayın işlemi devam ediyor."}`);
      }
    } catch (e: any) {
      setSendError(e?.message || "İdefix cihaz ekleme başarısız.");
    } finally {
      setSending(false);
    }
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
  }, []);

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
                  resetDirectCreate();
                  setAddOpen(true);
                }}
                className="h-10 rounded-xl bg-violet-700 px-5 text-[9px] font-black uppercase text-white shadow-sm transition hover:bg-violet-800"
              >
                + Cihaz Ekle
              </button>

              <button
                type="button"
                onClick={load}
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

      {addOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[2px]">
          <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-[28px] border border-slate-200 bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur sm:px-6">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-100 font-black text-violet-700">id</div>
                <div>
                  <h2 className="text-base font-black text-slate-950">İdefix'e Direkt Cihaz Ekle</h2>
                  <p className="mt-0.5 text-[9px] font-semibold text-slate-500">CNET kodu, kategori, özellikler ve görsel arka planda otomatik hazırlanır.</p>
                </div>
              </div>
              <button type="button" onClick={() => setAddOpen(false)} disabled={sending} className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-lg font-bold text-slate-500 hover:bg-slate-50 disabled:opacity-40">×</button>
            </div>

            <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[1.35fr_.65fr]">
              <div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="sm:col-span-2">
                    <span className="mb-1.5 block text-[8px] font-black uppercase text-slate-500">IMEI</span>
                    <input value={form.imei} onChange={(e) => updateForm("imei", e.target.value.replace(/\D/g, "").slice(0, 15))} inputMode="numeric" placeholder="15 haneli IMEI" className="h-11 w-full rounded-xl border border-slate-200 px-3 text-[11px] font-bold outline-none focus:border-violet-400" />
                  </label>
                  <label>
                    <span className="mb-1.5 block text-[8px] font-black uppercase text-slate-500">Marka</span>
                    <input value={form.brand} onChange={(e) => updateForm("brand", e.target.value)} placeholder="Apple" className="h-11 w-full rounded-xl border border-slate-200 px-3 text-[11px] font-bold outline-none focus:border-violet-400" />
                  </label>
                  <label>
                    <span className="mb-1.5 block text-[8px] font-black uppercase text-slate-500">Model</span>
                    <input value={form.model} onChange={(e) => updateForm("model", e.target.value)} placeholder="iPhone 12" className="h-11 w-full rounded-xl border border-slate-200 px-3 text-[11px] font-bold outline-none focus:border-violet-400" />
                  </label>
                  <label>
                    <span className="mb-1.5 block text-[8px] font-black uppercase text-slate-500">Hafıza</span>
                    <input value={form.memory} onChange={(e) => updateForm("memory", e.target.value)} placeholder="128 GB" className="h-11 w-full rounded-xl border border-slate-200 px-3 text-[11px] font-bold outline-none focus:border-violet-400" />
                  </label>
                  <label>
                    <span className="mb-1.5 block text-[8px] font-black uppercase text-slate-500">Renk</span>
                    <input value={form.color} onChange={(e) => updateForm("color", e.target.value)} placeholder="Beyaz" className="h-11 w-full rounded-xl border border-slate-200 px-3 text-[11px] font-bold outline-none focus:border-violet-400" />
                  </label>
                  <label>
                    <span className="mb-1.5 block text-[8px] font-black uppercase text-slate-500">Kalite</span>
                    <select value={form.grade} onChange={(e) => updateForm("grade", e.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-[11px] font-bold outline-none focus:border-violet-400">
                      <option value="A">A Kalite</option><option value="B">B Kalite</option><option value="C">C Kalite</option>
                    </select>
                  </label>
                  <label>
                    <span className="mb-1.5 block text-[8px] font-black uppercase text-slate-500">Garanti</span>
                    <select value={form.warranty} onChange={(e) => updateForm("warranty", e.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-[11px] font-bold outline-none focus:border-violet-400">
                      <option value="12 Ay">12 Ay</option><option value="6 Ay">6 Ay</option>
                    </select>
                  </label>
                  <label>
                    <span className="mb-1.5 block text-[8px] font-black uppercase text-slate-500">Satış Fiyatı</span>
                    <input value={form.salePrice} onChange={(e) => updateForm("salePrice", e.target.value)} inputMode="decimal" placeholder="22499" className="h-11 w-full rounded-xl border border-slate-200 px-3 text-[11px] font-black outline-none focus:border-violet-400" />
                  </label>
                  <label>
                    <span className="mb-1.5 block text-[8px] font-black uppercase text-slate-500">Liste Fiyatı</span>
                    <input value={form.listPrice} onChange={(e) => updateForm("listPrice", e.target.value)} inputMode="decimal" placeholder="23499" className="h-11 w-full rounded-xl border border-slate-200 px-3 text-[11px] font-black outline-none focus:border-violet-400" />
                  </label>
                </div>

                {sendError && <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[10px] font-bold leading-5 text-rose-700">{sendError}</div>}
                {sendMessage && <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[10px] font-bold leading-5 text-emerald-700">{sendMessage}</div>}

                <button type="button" onClick={submitDirectCreate} disabled={sending} className="mt-5 h-12 w-full rounded-2xl bg-violet-700 px-5 text-[10px] font-black uppercase tracking-wide text-white shadow-sm transition hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-50">
                  {sending ? "İdefix hazırlanıyor / gönderiliyor..." : "İdefix'e Gönder"}
                </button>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-[9px] font-black uppercase tracking-wide text-slate-500">Otomatik Motor</div>
                <div className="mt-3 space-y-2 text-[9px] font-semibold leading-5 text-slate-600">
                  <div className="rounded-xl bg-white px-3 py-2">✓ CNET barkod / SKU / productMainId otomatik</div>
                  <div className="rounded-xl bg-white px-3 py-2">✓ İdefix brand + kategori referansı otomatik</div>
                  <div className="rounded-xl bg-white px-3 py-2">✓ Renk / zorunlu attribute otomatik</div>
                  <div className="rounded-xl bg-white px-3 py-2">✓ Aynı renk görsel N11 / İkas / İdefix'ten otomatik</div>
                  <div className="rounded-xl bg-white px-3 py-2">✓ Güvenli matchedProduct ise otomatik approve</div>
                  <div className="rounded-xl bg-white px-3 py-2">✓ Canlı envanter görünmeden SATIŞTA yazmaz</div>
                </div>

                {directPreview && (
                  <div className="mt-4 overflow-hidden rounded-2xl border border-violet-100 bg-white">
                    {directPreview.imageUrl ? (
                      <div className="flex h-40 items-center justify-center bg-white p-3"><img src={directPreview.imageUrl} alt={directPreview.title || "İdefix ürün görseli"} className="max-h-full max-w-full object-contain" /></div>
                    ) : (
                      <div className="flex h-24 items-center justify-center text-3xl">📱</div>
                    )}
                    <div className="border-t border-slate-100 p-3">
                      <div className="text-[9px] font-black text-slate-900">{directPreview.title || "Ürün önizleme"}</div>
                      <div className="mt-2 space-y-1 text-[8px] font-semibold text-slate-500">
                        <div>Görsel: {directPreview.imageReady ? "Hazır ✓" : "Bulunamadı"}</div>
                        <div>Attribute: {Number(directPreview.attributeCount || 0)}</div>
                        <div>Brand ID: {text(directPreview.brandId) || "-"}</div>
                        <div>Kategori ID: {text(directPreview.categoryId) || "-"}</div>
                        <div className="break-all">CNET Barkod: {directPreview.barcode || "-"}</div>
                        <div className="break-all">CNET SKU: {directPreview.vendorStockCode || "-"}</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
