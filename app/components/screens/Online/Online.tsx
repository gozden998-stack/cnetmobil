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
  n11SyncedCount: number;
  localDraftCount: number;
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
  brand: string | null;
  model: string | null;
  memory: string | null;
  color: string | null;
  grade: string | null;
  warranty: string | null;
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

type ListingDraftForm = {
  imei: string;
  brand: string;
  model: string;
  memory: string;
  color: string;
  grade: string;
  warranty: string;
  referenceProductUrl: string;
  salePrice: string;
  listPrice: string;
};

type ListingEditForm = {
  listingId: number;
  imei: string;
  brand: string;
  model: string;
  memory: string;
  color: string;
  grade: string;
  warranty: string;
};

type ListingPriceForm = {
  listingId: number;
  imei: string;
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
  n11SyncedCount: 0,
  localDraftCount: 0,
};

const EMPTY_DRAFT_FORM: ListingDraftForm = {
  imei: "",
  brand: "",
  model: "",
  memory: "",
  color: "",
  grade: "",
  warranty: "",
  referenceProductUrl: "",
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
  quantity: number,
  syncStatus: string | null
) {
  if (quantity <= 0 || saleStatus === "Out_Of_Stock") {
    return {
      label: "Stok 0",
      className: "bg-red-50 text-red-700 ring-red-100",
    };
  }

  if (syncStatus === "DRAFT") {
    return {
      label: "Taslak",
      className: "bg-blue-50 text-blue-700 ring-blue-100",
    };
  }

  if (syncStatus === "READY") {
    return {
      label: "Gönderim Bekliyor",
      className: "bg-amber-50 text-amber-700 ring-amber-100",
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
    label: saleStatus || productStatus || syncStatus || "Bekliyor",
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
  const [draftSaving, setDraftSaving] = useState(false);
  const [draftError, setDraftError] = useState("");
  const [draftSuccess, setDraftSuccess] = useState("");
  const [draftForm, setDraftForm] = useState<ListingDraftForm>(EMPTY_DRAFT_FORM);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [actionSaving, setActionSaving] = useState(false);
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");
  const [editForm, setEditForm] = useState<ListingEditForm | null>(null);
  const [priceForm, setPriceForm] = useState<ListingPriceForm | null>(null);

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


  const openCreateModal = useCallback(() => {
    setShowCreateModal(true);
    setDraftError("");
    setDraftSuccess("");
    setDraftForm(EMPTY_DRAFT_FORM);
  }, []);

  const closeCreateModal = useCallback(() => {
    if (draftSaving) return;
    setShowCreateModal(false);
    setDraftError("");
    setDraftSuccess("");
    setDraftForm(EMPTY_DRAFT_FORM);
  }, [draftSaving]);

  const saveDraft = useCallback(async () => {
    setDraftError("");
    setDraftSuccess("");

    const imei = draftForm.imei.replace(/\s+/g, "").trim();

    if (!/^[0-9]{15}$/.test(imei)) {
      setDraftError("IMEI tam 15 haneli ve yalnızca rakamlardan oluşmalıdır.");
      return;
    }

    if (
      !draftForm.brand.trim() ||
      !draftForm.model.trim() ||
      !draftForm.memory.trim() ||
      !draftForm.color.trim() ||
      !draftForm.grade.trim() ||
      !draftForm.warranty.trim()
    ) {
      setDraftError(
        "Marka, model, hafıza, renk, grade ve garanti alanları zorunludur."
      );
      return;
    }

    if (!draftForm.salePrice.trim() || !draftForm.listPrice.trim()) {
      setDraftError("N11 satış fiyatı ve N11 liste fiyatı zorunludur.");
      return;
    }

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
          imei,
          brand: draftForm.brand,
          model: draftForm.model,
          memory: draftForm.memory,
          color: draftForm.color,
          grade: draftForm.grade,
          warranty: draftForm.warranty,
          referenceProductUrl: draftForm.referenceProductUrl,
          salePrice: draftForm.salePrice,
          listPrice: draftForm.listPrice,
        }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || "N11 ürün oluşturulamadı.");
      }

      setDraftSuccess(
        payload?.message || "N11 ürün oluşturma işlemi tamamlandı."
      );

      await loadData(true);

      window.setTimeout(() => {
        setShowCreateModal(false);
        setDraftForm(EMPTY_DRAFT_FORM);
        setDraftSuccess("");
      }, 900);
    } catch (err) {
      setDraftError(
        err instanceof Error ? err.message : "N11 ürün oluşturulamadı."
      );
    } finally {
      setDraftSaving(false);
    }
  }, [draftForm, loadData]);


  const openEditModal = useCallback((item: OnlineListing) => {
    setActionError("");
    setActionSuccess("");
    setEditForm({
      listingId: item.id,
      imei: item.external_stock_code || "",
      brand: item.brand || item.device_brand || "",
      model: item.model || item.device_model || "",
      memory: item.memory || item.device_memory || "",
      color: item.color || item.device_color || "",
      grade: item.grade || item.device_grade || "",
      warranty: item.warranty || item.device_warranty || "",
    });
    setShowEditModal(true);
  }, []);

  const openPriceModal = useCallback((item: OnlineListing) => {
    setActionError("");
    setActionSuccess("");
    setPriceForm({
      listingId: item.id,
      imei: item.external_stock_code || "",
      salePrice: String(item.sale_price ?? ""),
      listPrice: String(item.list_price ?? ""),
    });
    setShowPriceModal(true);
  }, []);

  const patchListing = useCallback(
    async (body: Record<string, unknown>) => {
      const response = await fetch("/api/online/listings", {
        method: "PATCH",
        cache: "no-store",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || "İşlem tamamlanamadı.");
      }

      return payload;
    },
    []
  );

  const saveEdit = useCallback(async () => {
    if (!editForm) return;

    setActionError("");
    setActionSuccess("");

    if (
      !editForm.brand.trim() ||
      !editForm.model.trim() ||
      !editForm.memory.trim() ||
      !editForm.color.trim() ||
      !editForm.grade.trim() ||
      !editForm.warranty.trim()
    ) {
      setActionError(
        "Marka, model, hafıza, renk, grade ve garanti alanları zorunludur."
      );
      return;
    }

    setActionSaving(true);

    try {
      const payload = await patchListing({
        action: "UPDATE_DETAILS",
        listingId: editForm.listingId,
        brand: editForm.brand,
        model: editForm.model,
        memory: editForm.memory,
        color: editForm.color,
        grade: editForm.grade,
        warranty: editForm.warranty,
      });

      setActionSuccess(payload?.message || "Ürün bilgileri güncellendi.");
      await loadData(true);

      window.setTimeout(() => {
        setShowEditModal(false);
        setEditForm(null);
        setActionSuccess("");
      }, 700);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Ürün güncellenemedi."
      );
    } finally {
      setActionSaving(false);
    }
  }, [editForm, loadData, patchListing]);

  const savePrice = useCallback(async () => {
    if (!priceForm) return;

    setActionError("");
    setActionSuccess("");

    if (!priceForm.salePrice.trim() || !priceForm.listPrice.trim()) {
      setActionError("N11 satış ve liste fiyatı zorunludur.");
      return;
    }

    setActionSaving(true);

    try {
      const payload = await patchListing({
        action: "UPDATE_PRICE",
        listingId: priceForm.listingId,
        salePrice: priceForm.salePrice,
        listPrice: priceForm.listPrice,
      });

      setActionSuccess(payload?.message || "Fiyat güncellendi.");
      await loadData(true);

      window.setTimeout(() => {
        setShowPriceModal(false);
        setPriceForm(null);
        setActionSuccess("");
      }, 700);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Fiyat güncellenemedi."
      );
    } finally {
      setActionSaving(false);
    }
  }, [priceForm, loadData, patchListing]);

  const setStockZero = useCallback(
    async (item: OnlineListing) => {
      const imei = item.external_stock_code || "";
      const productName = [item.brand, item.model].filter(Boolean).join(" ");

      const confirmed = window.confirm(
        `${productName || "Bu ürün"}\nIMEI: ${imei}\n\nStok 0 yapılacak. Devam edilsin mi?`
      );

      if (!confirmed) return;

      setActionSaving(true);
      setActionError("");

      try {
        await patchListing({
          action: "SET_STOCK_ZERO",
          listingId: item.id,
        });

        await loadData(true);
      } catch (err) {
        setActionError(
          err instanceof Error ? err.message : "Stok sıfırlanamadı."
        );
      } finally {
        setActionSaving(false);
      }
    },
    [loadData, patchListing]
  );

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
        item.brand,
        item.model,
        item.memory,
        item.color,
        item.grade,
        item.warranty,
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
                        API Bağlı
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
                    {data?.apiConnected
                      ? "N11 API bağlantısı aktif. Son başarılı N11 senkronizasyon verileri PostgreSQL üzerinden gösteriliyor."
                      : data?.apiConfigured
                      ? "N11 API bilgileri yapılandırıldı. Başarılı bağlantı ve senkronizasyon bekleniyor."
                      : "ONLINE modülü PostgreSQL verilerini kullanıyor. N11 API bilgileri henüz yapılandırılmadı."}
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
                    {stats.n11SyncedCount} N11 · {stats.localDraftCount} yerel/taslak
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
                        ? "N11 REST API doğrulandı ve aktif"
                        : data?.apiConfigured
                        ? "API bilgileri mevcut, başarılı senkronizasyon bekleniyor"
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
                    {data?.apiConnected
                      ? "Aktif"
                      : data?.apiConfigured
                      ? "Bekliyor"
                      : "Kapalı"}
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

            <div
              className={`rounded-[26px] border p-5 shadow-sm ${
                data?.apiConnected
                  ? "border-emerald-100 bg-emerald-50/70"
                  : "border-blue-100 bg-blue-50/70"
              }`}
            >
              <div
                className={`text-[12px] font-black ${
                  data?.apiConnected ? "text-emerald-800" : "text-blue-800"
                }`}
              >
                Gerçek Sistem Durumu
              </div>

              {data?.apiConnected ? (
                <div className="mt-3 space-y-2 text-[12px] font-semibold leading-6 text-emerald-700">
                  <p>
                    N11 API bağlantısı aktif ve son ürün senkronizasyonu başarıyla tamamlandı.
                  </p>
                  <div className="rounded-xl border border-emerald-100 bg-white/70 px-3 py-2">
                    <div className="flex items-center justify-between gap-3">
                      <span>Son N11 senkronizasyonu</span>
                      <span className="font-black text-emerald-900">
                        {formatDate(channel?.last_sync_at)}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-3">
                      <span>N11 senkronize ürün</span>
                      <span className="font-black text-emerald-900">
                        {stats.n11SyncedCount}
                      </span>
                    </div>
                  </div>
                  <p className="text-[11px]">
                    Otomatik stok ve fiyat senkronizasyonu henüz kapalı; sonraki adımda gerçek N11 güncelleme servislerini bağlayacağız.
                  </p>
                </div>
              ) : (
                <p className="mt-3 text-[12px] font-semibold leading-6 text-blue-700">
                  {data?.apiConfigured
                    ? "N11 API bilgileri mevcut. İlk başarılı ürün senkronizasyonundan sonra bağlantı burada aktif görünecek."
                    : "N11 API bilgileri henüz yapılandırılmadı. ONLINE kayıtları PostgreSQL üzerinden gösteriliyor."}
                </p>
              )}
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
                <div className="min-w-[1680px]">
                  <div className="grid grid-cols-[1.35fr_0.75fr_0.7fr_0.65fr_0.75fr_1.05fr_0.7fr_0.7fr_0.5fr_0.75fr_1.3fr] items-center bg-slate-50 px-4 py-4 text-[10px] font-black uppercase tracking-wider text-slate-500">
                    <div>Marka / Model</div>
                    <div>Hafıza</div>
                    <div>Renk</div>
                    <div>Grade</div>
                    <div>Garanti</div>
                    <div>IMEI / Stok Kodu</div>
                    <div>N11 Satış</div>
                    <div>N11 Liste</div>
                    <div>Stok</div>
                    <div>Durum</div>
                    <div>İşlemler</div>
                  </div>

                  {filteredListings.map((item) => {
                    const status = getStatusBadge(
                      item.product_status,
                      item.sale_status,
                      Number(item.quantity || 0),
                      item.sync_status
                    );

                    const brand = item.brand || item.device_brand || "—";
                    const model = item.model || item.device_model || "—";
                    const memory = item.memory || item.device_memory || "—";
                    const color = item.color || item.device_color || "—";
                    const grade = item.grade || item.device_grade || "—";
                    const warranty = item.warranty || item.device_warranty || "—";

                    return (
                      <div
                        key={item.id}
                        className="grid grid-cols-[1.35fr_0.75fr_0.7fr_0.65fr_0.75fr_1.05fr_0.7fr_0.7fr_0.5fr_0.75fr_1.3fr] items-center border-t border-slate-100 px-4 py-3 text-[12px] font-semibold text-slate-700 hover:bg-slate-50/60"
                      >
                        <div className="min-w-0 pr-3">
                          <div className="truncate text-[13px] font-black text-slate-900">
                            {brand}
                          </div>
                          <div className="mt-0.5 truncate text-[12px] font-semibold text-slate-500">
                            {model}
                          </div>
                        </div>

                        <div className="font-bold text-slate-700">{memory}</div>
                        <div className="font-bold text-slate-700">{color}</div>
                        <div className="font-black text-slate-800">{grade}</div>
                        <div className="font-bold text-slate-700">{warranty}</div>

                        <div>
                          <div className="font-mono text-[12px] font-black text-slate-700">
                            {item.external_stock_code || item.device_imei || "—"}
                          </div>
                          <div className="mt-1 text-[9px] font-bold text-slate-400">
                            N11 ID: {item.external_product_id || "Henüz yok"}
                          </div>
                        </div>

                        <div className="font-black text-slate-900">
                          {formatMoney(Number(item.sale_price || 0))}
                        </div>

                        <div className="font-black text-slate-900">
                          {formatMoney(Number(item.list_price || 0))}
                        </div>

                        <div
                          className={`text-[14px] font-black ${
                            Number(item.quantity || 0) <= 0
                              ? "text-red-600"
                              : "text-emerald-700"
                          }`}
                        >
                          {Number(item.quantity || 0)}
                        </div>

                        <div>
                          <span
                            className={`inline-flex items-center rounded-xl px-3 py-1 text-[10px] font-black ring-1 ${status.className}`}
                          >
                            {status.label}
                          </span>
                          <div className="mt-1 text-[9px] font-semibold text-slate-400">
                            {formatDate(item.updated_at)}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openEditModal(item)}
                            disabled={actionSaving}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[10px] font-black text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-50"
                          >
                            DÜZENLE
                          </button>

                          <button
                            type="button"
                            onClick={() => openPriceModal(item)}
                            disabled={actionSaving}
                            className="rounded-xl bg-blue-50 px-3 py-2 text-[10px] font-black text-blue-700 transition hover:bg-blue-100 disabled:opacity-50"
                          >
                            FİYAT
                          </button>

                          <button
                            type="button"
                            onClick={() => void setStockZero(item)}
                            disabled={actionSaving || Number(item.quantity || 0) === 0}
                            className="rounded-xl bg-red-50 px-3 py-2 text-[10px] font-black text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            STOK 0
                          </button>
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
                Toplam Stok:{" "}
                <b className="text-slate-800">{stats.totalStock}</b>
              </span>
              <span>
                Task:{" "}
                <b className="text-slate-800">{data?.taskCount ?? 0}</b>
              </span>
            </div>
          </div>
        </section>

        {showEditModal && editForm ? (
          <div className="fixed inset-0 z-[320] flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm">
            <div className="w-full max-w-[850px] overflow-hidden rounded-[26px] bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-600">
                    ONLINE · ÜRÜN DÜZENLE
                  </div>
                  <h3 className="mt-1 text-xl font-black text-slate-900">
                    Ürün Bilgileri
                  </h3>
                  <div className="mt-1 font-mono text-[11px] font-bold text-slate-500">
                    IMEI: {editForm.imei}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (!actionSaving) {
                      setShowEditModal(false);
                      setEditForm(null);
                      setActionError("");
                    }
                  }}
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-xl font-black text-slate-500"
                >
                  ×
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2">
                {[
                  ["Marka", "brand"],
                  ["Model", "model"],
                  ["Hafıza", "memory"],
                  ["Renk", "color"],
                  ["Grade", "grade"],
                  ["Garanti", "warranty"],
                ].map(([label, key]) => (
                  <label key={key}>
                    <div className="mb-2 text-[10px] font-black uppercase tracking-wider text-slate-500">
                      {label}
                    </div>
                    <input
                      value={String(editForm[key as keyof ListingEditForm] ?? "")}
                      onChange={(event) =>
                        setEditForm((current) =>
                          current
                            ? { ...current, [key]: event.target.value }
                            : current
                        )
                      }
                      className="h-12 w-full rounded-xl border border-slate-200 px-4 text-[13px] font-semibold outline-none focus:border-blue-400"
                    />
                  </label>
                ))}

                {actionError ? (
                  <div className="md:col-span-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[12px] font-black text-red-700">
                    {actionError}
                  </div>
                ) : null}

                {actionSuccess ? (
                  <div className="md:col-span-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[12px] font-black text-emerald-700">
                    {actionSuccess}
                  </div>
                ) : null}
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4">
                <button
                  type="button"
                  onClick={() => {
                    if (!actionSaving) {
                      setShowEditModal(false);
                      setEditForm(null);
                      setActionError("");
                    }
                  }}
                  className="h-11 rounded-xl border border-slate-200 bg-white px-5 text-[11px] font-black text-slate-600"
                >
                  İPTAL
                </button>
                <button
                  type="button"
                  onClick={() => void saveEdit()}
                  disabled={actionSaving}
                  className="h-11 rounded-xl bg-blue-600 px-5 text-[11px] font-black text-white disabled:opacity-50"
                >
                  {actionSaving ? "KAYDEDİLİYOR..." : "KAYDET"}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {showPriceModal && priceForm ? (
          <div className="fixed inset-0 z-[320] flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm">
            <div className="w-full max-w-[620px] overflow-hidden rounded-[26px] bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-600">
                    ONLINE · FİYAT
                  </div>
                  <h3 className="mt-1 text-xl font-black text-slate-900">
                    N11 Fiyat Güncelle
                  </h3>
                  <div className="mt-1 font-mono text-[11px] font-bold text-slate-500">
                    IMEI: {priceForm.imei}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (!actionSaving) {
                      setShowPriceModal(false);
                      setPriceForm(null);
                      setActionError("");
                    }
                  }}
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-xl font-black text-slate-500"
                >
                  ×
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
                <label>
                  <div className="mb-2 text-[10px] font-black uppercase tracking-wider text-slate-500">
                    N11 Satış Fiyatı
                  </div>
                  <input
                    value={priceForm.salePrice}
                    onChange={(event) =>
                      setPriceForm((current) =>
                        current
                          ? { ...current, salePrice: event.target.value }
                          : current
                      )
                    }
                    className="h-12 w-full rounded-xl border border-slate-200 px-4 text-[13px] font-semibold outline-none focus:border-blue-400"
                  />
                </label>

                <label>
                  <div className="mb-2 text-[10px] font-black uppercase tracking-wider text-slate-500">
                    N11 Liste Fiyatı
                  </div>
                  <input
                    value={priceForm.listPrice}
                    onChange={(event) =>
                      setPriceForm((current) =>
                        current
                          ? { ...current, listPrice: event.target.value }
                          : current
                      )
                    }
                    className="h-12 w-full rounded-xl border border-slate-200 px-4 text-[13px] font-semibold outline-none focus:border-blue-400"
                  />
                </label>

                {actionError ? (
                  <div className="sm:col-span-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[12px] font-black text-red-700">
                    {actionError}
                  </div>
                ) : null}

                {actionSuccess ? (
                  <div className="sm:col-span-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[12px] font-black text-emerald-700">
                    {actionSuccess}
                  </div>
                ) : null}
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4">
                <button
                  type="button"
                  onClick={() => {
                    if (!actionSaving) {
                      setShowPriceModal(false);
                      setPriceForm(null);
                      setActionError("");
                    }
                  }}
                  className="h-11 rounded-xl border border-slate-200 bg-white px-5 text-[11px] font-black text-slate-600"
                >
                  İPTAL
                </button>
                <button
                  type="button"
                  onClick={() => void savePrice()}
                  disabled={actionSaving}
                  className="h-11 rounded-xl bg-blue-600 px-5 text-[11px] font-black text-white disabled:opacity-50"
                >
                  {actionSaving ? "GÜNCELLENİYOR..." : "FİYATI KAYDET"}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {showCreateModal ? (
          <div className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm">
            <div className="flex max-h-[94vh] w-full max-w-[1150px] flex-col overflow-hidden rounded-[28px] bg-white shadow-2xl">
              <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-5 py-4 sm:px-6">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-600">
                    ONLINE · N11
                  </div>
                  <h3 className="mt-1 text-2xl font-black text-slate-900">
                    Yeni Ürün Aç
                  </h3>
                  <p className="mt-1 text-[12px] font-semibold text-slate-500">
                    Cihaz bilgilerini ve N11 fiyatlarını girin. N11&apos;e gerçek ürün oluşturulur. stockCode otomatik olarak IMEI olur.
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

              <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <label className="md:col-span-2">
                    <div className="mb-2 text-[10px] font-black uppercase tracking-wider text-slate-500">
                      IMEI
                    </div>
                    <input
                      value={draftForm.imei}
                      onChange={(event) =>
                        setDraftForm((current) => ({
                          ...current,
                          imei: event.target.value.replace(/\D/g, "").slice(0, 15),
                        }))
                      }
                      inputMode="numeric"
                      maxLength={15}
                      placeholder="15 haneli IMEI"
                      className="h-12 w-full rounded-xl border border-slate-200 px-4 font-mono text-[13px] font-black outline-none focus:border-blue-400"
                    />
                  </label>

                  <label>
                    <div className="mb-2 text-[10px] font-black uppercase tracking-wider text-slate-500">
                      Marka
                    </div>
                    <input
                      value={draftForm.brand}
                      onChange={(event) =>
                        setDraftForm((current) => ({
                          ...current,
                          brand: event.target.value,
                        }))
                      }
                      placeholder="Apple"
                      className="h-12 w-full rounded-xl border border-slate-200 px-4 text-[13px] font-semibold outline-none focus:border-blue-400"
                    />
                  </label>

                  <label>
                    <div className="mb-2 text-[10px] font-black uppercase tracking-wider text-slate-500">
                      Model
                    </div>
                    <input
                      value={draftForm.model}
                      onChange={(event) =>
                        setDraftForm((current) => ({
                          ...current,
                          model: event.target.value,
                        }))
                      }
                      placeholder="iPhone 15 Pro"
                      className="h-12 w-full rounded-xl border border-slate-200 px-4 text-[13px] font-semibold outline-none focus:border-blue-400"
                    />
                  </label>

                  <label>
                    <div className="mb-2 text-[10px] font-black uppercase tracking-wider text-slate-500">
                      Hafıza
                    </div>
                    <input
                      value={draftForm.memory}
                      onChange={(event) =>
                        setDraftForm((current) => ({
                          ...current,
                          memory: event.target.value,
                        }))
                      }
                      placeholder="256 GB"
                      className="h-12 w-full rounded-xl border border-slate-200 px-4 text-[13px] font-semibold outline-none focus:border-blue-400"
                    />
                  </label>

                  <label>
                    <div className="mb-2 text-[10px] font-black uppercase tracking-wider text-slate-500">
                      Renk
                    </div>
                    <input
                      value={draftForm.color}
                      onChange={(event) =>
                        setDraftForm((current) => ({
                          ...current,
                          color: event.target.value,
                        }))
                      }
                      placeholder="Siyah"
                      className="h-12 w-full rounded-xl border border-slate-200 px-4 text-[13px] font-semibold outline-none focus:border-blue-400"
                    />
                  </label>

                  <label>
                    <div className="mb-2 text-[10px] font-black uppercase tracking-wider text-slate-500">
                      Grade
                    </div>
                    <input
                      value={draftForm.grade}
                      onChange={(event) =>
                        setDraftForm((current) => ({
                          ...current,
                          grade: event.target.value,
                        }))
                      }
                      placeholder="Mükemmel"
                      className="h-12 w-full rounded-xl border border-slate-200 px-4 text-[13px] font-semibold outline-none focus:border-blue-400"
                    />
                  </label>

                  <label>
                    <div className="mb-2 text-[10px] font-black uppercase tracking-wider text-slate-500">
                      Garanti
                    </div>
                    <input
                      value={draftForm.warranty}
                      onChange={(event) =>
                        setDraftForm((current) => ({
                          ...current,
                          warranty: event.target.value,
                        }))
                      }
                      placeholder="12 Ay"
                      className="h-12 w-full rounded-xl border border-slate-200 px-4 text-[13px] font-semibold outline-none focus:border-blue-400"
                    />
                  </label>

                  <label className="md:col-span-2">
                    <div className="mb-2 text-[10px] font-black uppercase tracking-wider text-slate-500">
                      N11 Örnek Ürün Linki
                    </div>
                    <input
                      value={draftForm.referenceProductUrl}
                      onChange={(event) =>
                        setDraftForm((current) => ({
                          ...current,
                          referenceProductUrl: event.target.value,
                        }))
                      }
                      placeholder="https://www.n11.com/urun/..."
                      className="h-12 w-full rounded-xl border border-slate-200 px-4 text-[13px] font-semibold outline-none focus:border-blue-400"
                    />
                    <div className="mt-1 text-[10px] font-semibold text-slate-400">
                      Aynı ürünün kendi N11 mağazanızdaki ürün sayfası linkini yapıştır. Sistem ürün kodu, kategori, özellik ve görseli bu linkten otomatik alır.
                    </div>
                  </label>

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

                <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50/70 px-4 py-3 text-[11px] font-semibold leading-5 text-blue-700">
                  stockCode otomatik olarak IMEI olacaktır. Stok 1 açılır. Örnek N11 ürün linkinden kategori/özellik/görsel alınır ve yeni IMEI ile N11 ürünü açılır.
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

              <div className="flex shrink-0 items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:px-6">
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
                  disabled={draftSaving}
                  className="h-11 rounded-xl bg-blue-600 px-5 text-[11px] font-black text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {draftSaving ? "N11’E GÖNDERİLİYOR..." : "N11’E ÜRÜN AÇ"}
                </button>
              </div>
            </div>
          </div>
        ) : null}

      </div>
    </div>
  );
}
