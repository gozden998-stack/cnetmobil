"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";

type OnlineChannel = {
  id: number;
  channel: string;
  enabled: boolean;
  integrator_name: string | null;
  default_currency: string;
  default_vat_rate: number | null;
  default_preparing_day: number | null;
  default_shipment_template: string | null;
  auto_stock_sync: boolean;
  auto_price_sync: boolean;
  last_sync_at: string | null;
  last_sync_status: string | null;
  last_sync_error: string | null;
  created_at: string;
  updated_at: string;
};

type OnlineStats = {
  totalProducts: number;
  totalStock: number;
  averageSalePrice: number;
  onSaleCount: number;
  outOfStockCount: number;
  saleClosedCount: number;
  activeProductCount: number;
  matchedDeviceCount: number;
  unmatchedDeviceCount: number;
};

type OnlineListing = {
  id: number;
  channel: string;
  stock_device_id: number | null;
  external_product_id: string | null;
  external_stock_code: string;
  external_product_main_id: string | null;
  category_id: number | null;
  title: string | null;
  sale_price: string | number | null;
  list_price: string | number | null;
  quantity: number;
  product_status: string | null;
  sale_status: string | null;
  sync_status: string;
  last_task_id: string | null;
  last_task_status: string | null;
  last_error: string | null;
  attributes: unknown;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;

  device_imei: string | null;
  device_brand: string | null;
  device_model: string | null;
  device_memory: string | null;
  device_color: string | null;
  device_battery_percent: number | null;
  device_grade: string | null;
  device_warranty: string | null;
  device_changed_parts: string | null;
  device_box_invoice: string | null;
  device_branch_code: string | null;
  device_status: string | null;
  device_source: string | null;
};

type AvailableDevice = {
  id: number;
  imei: string;
  brand: string | null;
  model: string | null;
  memory: string | null;
  color: string | null;
  battery_percent: number | null;
  grade: string | null;
  warranty: string | null;
  changed_parts: string | null;
  box_invoice: string | null;
  current_branch_code: string | null;
  status: string | null;
  source: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type ListingDraftForm = {
  stockDeviceId: number | null;
  salePrice: string;
  listPrice: string;
};

type OnlineTask = {
  id: number;
  channel: string;
  task_id: string;
  task_type: string | null;
  task_status: string | null;
  stock_code: string | null;
  online_listing_id: number | null;
  reasons: unknown;
  error_message: string | null;
  created_at: string;
  checked_at: string | null;
  completed_at: string | null;
};

type OnlineResponse = {
  success: boolean;
  error?: string;
  apiConnected: boolean;
  apiConfigured: boolean;
  channel: OnlineChannel | null;
  stats: OnlineStats;
  listings: OnlineListing[];
  count: number;
  tasks: OnlineTask[];
  taskCount: number;
};

const EMPTY_STATS: OnlineStats = {
  totalProducts: 0,
  totalStock: 0,
  averageSalePrice: 0,
  onSaleCount: 0,
  outOfStockCount: 0,
  saleClosedCount: 0,
  activeProductCount: 0,
  matchedDeviceCount: 0,
  unmatchedDeviceCount: 0,
};

const EMPTY_DRAFT_FORM: ListingDraftForm = {
  stockDeviceId: null,
  salePrice: "",
  listPrice: "",
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function getStatusBadge(
  productStatus: string | null,
  saleStatus: string | null,
  quantity: number
) {
  if (quantity <= 0 || saleStatus === "Out_Of_Stock") {
    return {
      label: "Stok Yok",
      className: "bg-red-50 text-red-700 ring-red-100",
    };
  }

  if (saleStatus === "On_Sale" && productStatus === "Active") {
    return {
      label: "Yayında",
      className: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    };
  }

  if (saleStatus === "Sale_Closed") {
    return {
      label: "Satış Kapalı",
      className: "bg-amber-50 text-amber-700 ring-amber-100",
    };
  }

  return {
    label: saleStatus || productStatus || "Bekliyor",
    className: "bg-slate-100 text-slate-700 ring-slate-200",
  };
}

export default function Online() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<OnlineResponse | null>(null);
  const [search, setSearch] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [availableDevices, setAvailableDevices] = useState<AvailableDevice[]>([]);
  const [deviceSearch, setDeviceSearch] = useState("");
  const [deviceLoading, setDeviceLoading] = useState(false);
  const [draftSaving, setDraftSaving] = useState(false);
  const [draftError, setDraftError] = useState("");
  const [draftSuccess, setDraftSuccess] = useState("");
  const [draftForm, setDraftForm] = useState<ListingDraftForm>(EMPTY_DRAFT_FORM);

  const loadData = useCallback(async (silent = false) => {
    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError("");

    try {
      const response = await fetch("/api/online", {
        method: "GET",
        cache: "no-store",
        credentials: "same-origin",
      });

      const payload = (await response.json().catch(() => null)) as
        | OnlineResponse
        | null;

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || "ONLINE verileri alınamadı.");
      }

      setData(payload);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "ONLINE verileri alınamadı."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);


  const loadAvailableDevices = useCallback(async (q = "") => {
    setDeviceLoading(true);
    setDraftError("");

    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      params.set("limit", "100");

      const response = await fetch(`/api/online/listings?${params.toString()}`, {
        method: "GET",
        cache: "no-store",
        credentials: "same-origin",
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || "Cihaz listesi alınamadı.");
      }

      setAvailableDevices(
        Array.isArray(payload.availableDevices) ? payload.availableDevices : []
      );
    } catch (err) {
      setDraftError(
        err instanceof Error ? err.message : "Cihaz listesi alınamadı."
      );
    } finally {
      setDeviceLoading(false);
    }
  }, []);

  const openCreateModal = useCallback(() => {
    setShowCreateModal(true);
    setDraftError("");
    setDraftSuccess("");
    setDeviceSearch("");
    setDraftForm(EMPTY_DRAFT_FORM);
    void loadAvailableDevices("");
  }, [loadAvailableDevices]);

  const closeCreateModal = useCallback(() => {
    if (draftSaving) return;
    setShowCreateModal(false);
    setDraftError("");
    setDraftSuccess("");
    setDeviceSearch("");
    setDraftForm(EMPTY_DRAFT_FORM);
  }, [draftSaving]);

  const selectedDevice = useMemo(
    () =>
      availableDevices.find((item) => item.id === draftForm.stockDeviceId) ||
      null,
    [availableDevices, draftForm.stockDeviceId]
  );

  const chooseDevice = useCallback((device: AvailableDevice) => {
    setDraftForm((current) => ({
      ...current,
      stockDeviceId: device.id,
    }));
  }, []);

  const saveDraft = useCallback(async () => {
    setDraftError("");
    setDraftSuccess("");

    if (!draftForm.stockDeviceId) {
      setDraftError("Önce bir cihaz seçin.");
      return;
    }

    const imageUrls = draftForm.imagesText
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter(Boolean);

    setDraftSaving(true);

    try {
      const response = await fetch("/api/online/listings", {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          stockDeviceId: draftForm.stockDeviceId,
          salePrice: draftForm.salePrice,
          listPrice: draftForm.listPrice,
        }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || "Taslak kaydedilemedi.");
      }

      setDraftSuccess(
        payload?.message || "N11 ürün taslağı PostgreSQL'e kaydedildi."
      );

      await loadData(true);
      await loadAvailableDevices(deviceSearch);

      window.setTimeout(() => {
        setShowCreateModal(false);
        setDraftForm(EMPTY_DRAFT_FORM);
        setDraftSuccess("");
      }, 900);
    } catch (err) {
      setDraftError(
        err instanceof Error ? err.message : "Taslak kaydedilemedi."
      );
    } finally {
      setDraftSaving(false);
    }
  }, [draftForm, loadData, loadAvailableDevices, deviceSearch]);

  useEffect(() => {
    void loadData(false);
  }, [loadData]);

  const stats = data?.stats ?? EMPTY_STATS;
  const channel = data?.channel ?? null;
  const listings = data?.listings ?? [];

  const filteredListings = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("tr-TR");

    if (!q) return listings;

    return listings.filter((item) => {
      const haystack = [
        item.title,
        item.external_stock_code,
        item.external_product_id,
        item.device_imei,
        item.device_brand,
        item.device_model,
        item.device_memory,
        item.device_color,
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("tr-TR");

      return haystack.includes(q);
    });
  }, [listings, search]);

  if (loading) {
    return (
      <div className="flex min-h-[420px] w-full items-center justify-center">
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-5 text-sm font-black text-slate-600 shadow-sm">
          ONLINE verileri yükleniyor...
        </div>
      </div>
    );
  }

  return (
    <div className="w-full animate-in fade-in duration-300">
      <div className="space-y-4">
        <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.6fr)_340px]">
          <div className="rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-[0_10px_35px_rgba(15,23,42,0.06)] sm:p-6">
            <div className="grid grid-cols-1 gap-4 2xl:grid-cols-[minmax(0,1.15fr)_minmax(560px,0.85fr)]">
              <div className="flex min-h-[160px] items-center gap-4 rounded-[24px] border border-slate-100 bg-gradient-to-br from-white via-white to-violet-50/40 px-5 py-5 sm:px-6">
                <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-[26px] bg-violet-50 shadow-inner">
                  <div className="text-5xl font-black tracking-tight text-violet-700">
                    n11
                  </div>
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-[28px] font-black tracking-tight text-slate-900">
                      N11 Entegrasyonu
                    </h2>

                    {data?.apiConnected ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-black text-emerald-700 ring-1 ring-emerald-200">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                        Bağlı
                      </span>
                    ) : data?.apiConfigured ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-[11px] font-black text-amber-700 ring-1 ring-amber-200">
                        <span className="h-2 w-2 rounded-full bg-amber-500" />
                        Bağlantı Bekliyor
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black text-slate-600 ring-1 ring-slate-200">
                        <span className="h-2 w-2 rounded-full bg-slate-400" />
                        API Yapılandırılmadı
                      </span>
                    )}
                  </div>

                  <p className="mt-2 max-w-2xl text-[14px] font-semibold leading-6 text-slate-500">
                    ONLINE modülü PostgreSQL verilerini kullanıyor. N11 API bağlantısı
                    henüz aktif değil.
                  </p>

                  <div className="mt-5 flex flex-wrap items-center gap-4 text-[13px] font-bold text-slate-500">
                    <div className="inline-flex items-center gap-2">
                      <span className="text-slate-400">Son senkronizasyon:</span>
                      <span className="font-black text-slate-700">
                        {formatDate(channel?.last_sync_at)}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={openCreateModal}
                      className="inline-flex h-9 items-center justify-center rounded-xl bg-blue-600 px-4 text-[11px] font-black uppercase tracking-wider text-white shadow-sm transition hover:bg-blue-700"
                    >
                      Yeni Ürün Aç
                    </button>

                    <button
                      type="button"
                      onClick={() => void loadData(true)}
                      disabled={refreshing}
                      className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 px-3 text-[11px] font-black uppercase tracking-wider text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {refreshing ? "Yenileniyor..." : "Yenile"}
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 2xl:grid-cols-3">
                <div className="rounded-[22px] border border-blue-100 bg-white p-4 shadow-sm">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-xl font-black text-blue-600">
                    ◫
                  </div>
                  <div className="mt-4 text-[11px] font-black uppercase tracking-wider text-slate-400">
                    Toplam Ürün
                  </div>
                  <div className="mt-1 text-[22px] font-black tracking-tight text-slate-900">
                    {stats.totalProducts}
                  </div>
                  <div className="mt-1 text-[12px] font-semibold text-slate-500">
                    PostgreSQL kayıtları
                  </div>
                </div>

                <div className="rounded-[22px] border border-violet-100 bg-white p-4 shadow-sm">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-xl font-black text-violet-600">
                    ◈
                  </div>
                  <div className="mt-4 text-[11px] font-black uppercase tracking-wider text-slate-400">
                    Toplam Stok
                  </div>
                  <div className="mt-1 text-[22px] font-black tracking-tight text-slate-900">
                    {stats.totalStock}
                  </div>
                  <div className="mt-1 text-[12px] font-semibold text-slate-500">
                    ONLINE toplam adet
                  </div>
                </div>

                <div className="rounded-[22px] border border-amber-100 bg-white p-4 shadow-sm">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-xl font-black text-amber-600">
                    ₺
                  </div>
                  <div className="mt-4 text-[11px] font-black uppercase tracking-wider text-slate-400">
                    Ortalama Fiyat
                  </div>
                  <div className="mt-1 text-[22px] font-black tracking-tight text-slate-900">
                    {formatMoney(stats.averageSalePrice)}
                  </div>
                  <div className="mt-1 text-[12px] font-semibold text-slate-500">
                    Satış fiyatı ortalaması
                  </div>
                </div>
              </div>
            </div>
          </div>

          <aside className="space-y-4">
            <div className="rounded-[26px] border border-slate-200/80 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
              <div className="text-[12px] font-black text-slate-900">
                Bağlantı Durumu
              </div>

              <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[13px] font-black text-slate-900">
                      N11 API
                    </div>
                    <div className="mt-1 text-[11px] font-semibold text-slate-500">
                      {data?.apiConnected
                        ? "Bağlantı aktif"
                        : data?.apiConfigured
                        ? "API bilgileri mevcut, bağlantı bekleniyor"
                        : "Henüz yapılandırılmadı"}
                    </div>
                  </div>

                  <span
                    className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider ${
                      data?.apiConnected
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    {data?.apiConnected ? "Bağlı" : "Kapalı"}
                  </span>
                </div>
              </div>

              <div className="mt-4 space-y-2 text-[12px] font-semibold text-slate-600">
                <div className="flex items-center justify-between">
                  <span>Kanal</span>
                  <span className="font-black text-slate-800">
                    {channel?.channel || "N11"}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span>Kanal Aktif</span>
                  <span className="font-black text-slate-800">
                    {channel?.enabled ? "Evet" : "Hayır"}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span>Entegratör</span>
                  <span className="font-black text-slate-800">
                    {channel?.integrator_name || "—"}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span>Para Birimi</span>
                  <span className="font-black text-slate-800">
                    {channel?.default_currency || "TL"}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span>Oto Stok Sync</span>
                  <span className="font-black text-slate-800">
                    {channel?.auto_stock_sync ? "Açık" : "Kapalı"}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span>Oto Fiyat Sync</span>
                  <span className="font-black text-slate-800">
                    {channel?.auto_price_sync ? "Açık" : "Kapalı"}
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-[26px] border border-blue-100 bg-blue-50/70 p-5 shadow-sm">
              <div className="text-[12px] font-black text-blue-800">
                Gerçek Sistem Durumu
              </div>
              <p className="mt-3 text-[12px] font-semibold leading-6 text-blue-700">
                Bu ekrandaki tüm sayılar PostgreSQL&apos;den gelir. N11 API bağlantısı
                yapılana kadar ürün listesi yalnızca online_listings tablosundaki
                gerçek kayıtları gösterir.
              </p>
            </div>
          </aside>
        </section>

        {error ? (
          <section className="rounded-[22px] border border-red-200 bg-red-50 px-5 py-4 text-sm font-bold text-red-700">
            {error}
          </section>
        ) : null}

        <section className="rounded-[28px] border border-slate-200/80 bg-white p-4 shadow-[0_10px_35px_rgba(15,23,42,0.05)] sm:p-5">
          <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-[15px] font-black text-slate-900">
                ONLINE Ürünler
              </div>
              <div className="mt-1 text-[12px] font-semibold text-slate-500">
                N11 eşleşmeleri ve PostgreSQL kayıtları
              </div>
            </div>

            <div className="relative w-full lg:w-[420px]">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="h-12 w-full rounded-2xl border border-slate-200 bg-white pl-4 pr-11 text-[13px] font-semibold text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-300"
                placeholder="Ürün, IMEI, stok kodu veya N11 ID ara..."
              />
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
                ⌕
              </span>
            </div>
          </div>

          <div className="mt-4 overflow-hidden rounded-[22px] border border-slate-100">
            {filteredListings.length === 0 ? (
              <div className="flex min-h-[260px] flex-col items-center justify-center px-6 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-2xl text-slate-400">
                  ◫
                </div>
                <div className="mt-4 text-[15px] font-black text-slate-800">
                  Ürün bulunamadı
                </div>
                <div className="mt-2 max-w-lg text-[12px] font-semibold leading-5 text-slate-500">
                  PostgreSQL online_listings tablosunda henüz N11 ürünü yok. N11 API
                  bağlantısı geldiğinde gerçek ürünler buraya aktarılacak.
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <div className="min-w-[1240px]">
                  <div className="grid grid-cols-[1.6fr_1.1fr_0.9fr_0.8fr_0.65fr_0.9fr_1fr_0.8fr] items-center bg-slate-50 px-4 py-4 text-[11px] font-black uppercase tracking-wider text-slate-500">
                    <div>Ürün</div>
                    <div>Stok Kodu / IMEI</div>
                    <div>N11 Ürün ID</div>
                    <div>Fiyat</div>
                    <div>Stok</div>
                    <div>Durum</div>
                    <div>Son Güncelleme</div>
                    <div>Eşleşme</div>
                  </div>

                  {filteredListings.map((item) => {
                    const status = getStatusBadge(
                      item.product_status,
                      item.sale_status,
                      Number(item.quantity || 0)
                    );

                    const title =
                      item.title ||
                      [item.device_brand, item.device_model]
                        .filter(Boolean)
                        .join(" ") ||
                      "İsimsiz Ürün";

                    const variant = [
                      item.device_memory,
                      item.device_color,
                      item.device_grade,
                    ]
                      .filter(Boolean)
                      .join(" | ");

                    return (
                      <div
                        key={item.id}
                        className="grid grid-cols-[1.6fr_1.1fr_0.9fr_0.8fr_0.65fr_0.9fr_1fr_0.8fr] items-center border-t border-slate-100 px-4 py-3 text-[13px] font-semibold text-slate-700 hover:bg-slate-50/60"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-[14px] font-black text-slate-900">
                            {title}
                          </div>
                          <div className="truncate text-[12px] font-semibold text-slate-500">
                            {variant || "—"}
                          </div>
                        </div>

                        <div className="font-mono text-[12px] font-bold text-slate-600">
                          {item.external_stock_code || item.device_imei || "—"}
                        </div>

                        <div className="text-[12px] font-bold text-slate-600">
                          {item.external_product_id || "—"}
                        </div>

                        <div className="font-black text-slate-900">
                          {formatMoney(Number(item.sale_price || 0))}
                        </div>

                        <div
                          className={`font-black ${
                            Number(item.quantity || 0) <= 0
                              ? "text-red-500"
                              : "text-slate-900"
                          }`}
                        >
                          {Number(item.quantity || 0)}
                        </div>

                        <div>
                          <span
                            className={`inline-flex items-center rounded-xl px-3 py-1 text-[11px] font-black ring-1 ${status.className}`}
                          >
                            {status.label}
                          </span>
                        </div>

                        <div className="text-[12px] font-semibold text-slate-500">
                          {formatDate(item.last_synced_at || item.updated_at)}
                        </div>

                        <div>
                          {item.stock_device_id ? (
                            <span className="inline-flex rounded-xl bg-emerald-50 px-3 py-1 text-[10px] font-black text-emerald-700 ring-1 ring-emerald-100">
                              Cihaz Eşleşti
                            </span>
                          ) : (
                            <span className="inline-flex rounded-xl bg-amber-50 px-3 py-1 text-[10px] font-black text-amber-700 ring-1 ring-amber-100">
                              Eşleşmedi
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-[12px] font-semibold text-slate-500">
            <div>
              Gösterilen:{" "}
              <span className="font-black text-slate-800">
                {filteredListings.length}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <span>
                Eşleşen:{" "}
                <b className="text-emerald-700">{stats.matchedDeviceCount}</b>
              </span>
              <span>
                Eşleşmeyen:{" "}
                <b className="text-amber-700">{stats.unmatchedDeviceCount}</b>
              </span>
              <span>
                Son Task:{" "}
                <b className="text-slate-800">{data?.taskCount ?? 0}</b>
              </span>
            </div>
          </div>
        </section>

        {showCreateModal ? (
          <div className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm">
            <div className="flex max-h-[94vh] w-full max-w-[1500px] flex-col overflow-hidden rounded-[28px] bg-white shadow-2xl">
              <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-5 py-4 sm:px-6">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-600">
                    ONLINE · N11
                  </div>
                  <h3 className="mt-1 text-2xl font-black text-slate-900">
                    Yeni Ürün Aç
                  </h3>
                  <p className="mt-1 text-[12px] font-semibold text-slate-500">
                    Cihazı seçin ve sadece N11 satış / liste fiyatını girin. Bu işlem henüz N11 API'ye gönderim yapmaz.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closeCreateModal}
                  disabled={draftSaving}
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-xl font-black text-slate-500 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  ×
                </button>
              </div>

              <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden xl:grid-cols-[420px_minmax(0,1fr)]">
                <aside className="min-h-0 border-b border-slate-200 bg-slate-50/70 xl:border-b-0 xl:border-r">
                  <div className="border-b border-slate-200 p-4">
                    <div className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                      1. Cihaz Seç
                    </div>

                    <div className="mt-3 flex gap-2">
                      <input
                        value={deviceSearch}
                        onChange={(event) => setDeviceSearch(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            void loadAvailableDevices(deviceSearch);
                          }
                        }}
                        placeholder="IMEI, marka veya model ara..."
                        className="h-11 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-[12px] font-semibold outline-none focus:border-blue-400"
                      />
                      <button
                        type="button"
                        onClick={() => void loadAvailableDevices(deviceSearch)}
                        disabled={deviceLoading}
                        className="h-11 rounded-xl bg-slate-900 px-4 text-[11px] font-black text-white disabled:opacity-50"
                      >
                        ARA
                      </button>
                    </div>
                  </div>

                  <div className="max-h-[calc(94vh-180px)] overflow-y-auto p-3">
                    {deviceLoading ? (
                      <div className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-center text-[12px] font-black text-slate-500">
                        Cihazlar yükleniyor...
                      </div>
                    ) : availableDevices.length === 0 ? (
                      <div className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-center text-[12px] font-semibold text-slate-500">
                        ONLINE'a uygun cihaz bulunamadı.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {availableDevices.map((device) => {
                          const selected = draftForm.stockDeviceId === device.id;

                          return (
                            <button
                              key={device.id}
                              type="button"
                              onClick={() => chooseDevice(device)}
                              className={`w-full rounded-2xl border p-4 text-left transition ${
                                selected
                                  ? "border-blue-500 bg-blue-50 shadow-sm"
                                  : "border-slate-200 bg-white hover:border-blue-200 hover:bg-blue-50/40"
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="truncate text-[13px] font-black text-slate-900">
                                    {[device.brand, device.model]
                                      .filter(Boolean)
                                      .join(" ") || "Cihaz"}
                                  </div>
                                  <div className="mt-1 truncate text-[11px] font-semibold text-slate-500">
                                    {[device.memory, device.color]
                                      .filter(Boolean)
                                      .join(" | ") || "—"}
                                  </div>
                                </div>

                                <span className="rounded-lg bg-slate-100 px-2 py-1 text-[9px] font-black text-slate-600">
                                  {device.current_branch_code || "—"}
                                </span>
                              </div>

                              <div className="mt-3 font-mono text-[12px] font-black text-slate-700">
                                {device.imei}
                              </div>

                              <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-black">
                                <span className="rounded-lg bg-white px-2 py-1 text-slate-600 ring-1 ring-slate-200">
                                  Grade: {device.grade || "—"}
                                </span>
                                <span className="rounded-lg bg-white px-2 py-1 text-slate-600 ring-1 ring-slate-200">
                                  Garanti: {device.warranty || "—"}
                                </span>
                                <span className="rounded-lg bg-white px-2 py-1 text-slate-600 ring-1 ring-slate-200">
                                  {device.status || "—"}
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </aside>

                <div className="min-h-0 overflow-y-auto p-4 sm:p-6">
                  <div className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                    2. N11 Fiyat Bilgileri
                  </div>

                  {selectedDevice ? (
                    <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
                      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
                        <div>
                          <div className="text-[9px] font-black uppercase text-slate-400">IMEI</div>
                          <div className="mt-1 font-mono text-[12px] font-black text-slate-800">
                            {selectedDevice.imei}
                          </div>
                        </div>
                        <div>
                          <div className="text-[9px] font-black uppercase text-slate-400">Marka / Model</div>
                          <div className="mt-1 text-[12px] font-black text-slate-800">
                            {[selectedDevice.brand, selectedDevice.model].filter(Boolean).join(" ") || "—"}
                          </div>
                        </div>
                        <div>
                          <div className="text-[9px] font-black uppercase text-slate-400">Hafıza</div>
                          <div className="mt-1 text-[12px] font-black text-slate-800">
                            {selectedDevice.memory || "—"}
                          </div>
                        </div>
                        <div>
                          <div className="text-[9px] font-black uppercase text-slate-400">Renk</div>
                          <div className="mt-1 text-[12px] font-black text-slate-800">
                            {selectedDevice.color || "—"}
                          </div>
                        </div>
                        <div>
                          <div className="text-[9px] font-black uppercase text-slate-400">Grade</div>
                          <div className="mt-1 text-[12px] font-black text-slate-800">
                            {selectedDevice.grade || "—"}
                          </div>
                        </div>
                        <div>
                          <div className="text-[9px] font-black uppercase text-slate-400">Garanti</div>
                          <div className="mt-1 text-[12px] font-black text-slate-800">
                            {selectedDevice.warranty || "—"}
                          </div>
                        </div>
                        <div>
                          <div className="text-[9px] font-black uppercase text-slate-400">N11 Stok</div>
                          <div className="mt-1 text-[12px] font-black text-slate-800">
                            1
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-[12px] font-semibold text-slate-500">
                      Sol taraftan cihaz seçin.
                    </div>
                  )}

                  <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <label>
                      <div className="mb-2 text-[10px] font-black uppercase tracking-wider text-slate-500">
                        N11 Satış Fiyatı
                      </div>
                      <input
                        value={draftForm.salePrice}
                        onChange={(event) =>
                          setDraftForm((current) => ({
                            ...current,
                            salePrice: event.target.value,
                          }))
                        }
                        placeholder="42999,00"
                        className="h-12 w-full rounded-xl border border-slate-200 px-4 text-[13px] font-semibold outline-none focus:border-blue-400"
                      />
                    </label>

                    <label>
                      <div className="mb-2 text-[10px] font-black uppercase tracking-wider text-slate-500">
                        N11 Liste Fiyatı
                      </div>
                      <input
                        value={draftForm.listPrice}
                        onChange={(event) =>
                          setDraftForm((current) => ({
                            ...current,
                            listPrice: event.target.value,
                          }))
                        }
                        placeholder="44999,00"
                        className="h-12 w-full rounded-xl border border-slate-200 px-4 text-[13px] font-semibold outline-none focus:border-blue-400"
                      />
                    </label>
                  </div>

                  {draftError ? (
                    <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[12px] font-black text-red-700">
                      {draftError}
                    </div>
                  ) : null}

                  {draftSuccess ? (
                    <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[12px] font-black text-emerald-700">
                      {draftSuccess}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="flex shrink-0 flex-col gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <div className="text-[11px] font-semibold text-slate-500">
                  stockCode otomatik olarak cihazın 15 haneli IMEI bilgisidir. Stok otomatik 1 kaydedilir.
                </div>

                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={closeCreateModal}
                    disabled={draftSaving}
                    className="h-11 rounded-xl border border-slate-200 bg-white px-5 text-[11px] font-black text-slate-600 disabled:opacity-50"
                  >
                    İPTAL
                  </button>

                  <button
                    type="button"
                    onClick={() => void saveDraft()}
                    disabled={draftSaving || !draftForm.stockDeviceId}
                    className="h-11 rounded-xl bg-blue-600 px-5 text-[11px] font-black text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {draftSaving ? "KAYDEDİLİYOR..." : "TASLAĞI KAYDET"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
