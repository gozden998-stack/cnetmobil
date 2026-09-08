"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
  raw_data?: Record<string, unknown> | null;
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

type N11OrderLine = {
  quantity: number;
  productId: string | null;
  productName: string | null;
  stockCode: string | null;
  price: number | null;
  dueAmount: number | null;
  sellerInvoiceAmount: number | null;
  orderLineId: string | null;
  status: string | null;
  variantAttributes: unknown[];
};

type N11Order = {
  packageId: string | null;
  orderNumber: string | null;
  customerFullName: string | null;
  customerEmail: string | null;
  customerId: string | null;
  city: string | null;
  district: string | null;
  cargoTrackingNumber: string | null;
  cargoTrackingLink: string | null;
  cargoProviderName: string | null;
  shipmentPackageStatus: string | null;
  lastModifiedDate: string | null;
  agreedDeliveryDate: string | null;
  totalAmount: number | null;
  totalDiscountAmount: number | null;
  totalQuantity: number;
  productSummary: string;
  lines: N11OrderLine[];
};

type N11OrderGroup = {
  status: string;
  count: number;
  totalQuantity: number;
  totalAmount: number;
  orders: N11Order[];
};

type N11OrdersResponse = {
  success: boolean;
  error?: string;
  channel: string;
  period: {
    startDate: string;
    endDate: string;
    days: number;
  };
  groups: {
    Created: N11OrderGroup;
    Picking: N11OrderGroup;
    Shipped: N11OrderGroup;
    Delivered: N11OrderGroup;
  };
  counts: {
    newOrders: number;
    preparing: number;
    shipped: number;
    delivered: number;
    total: number;
  };
  count: number;
  orders: N11Order[];
  checkedAt: string;
};

type BulkPreviewRow = {
  rowNumber: number;
  imei: string;
  brand: string;
  model: string;
  memory: string;
  color: string;
  grade: string;
  warranty: string;
  salePrice: number | null;
  listPrice: number | null;
  valid: boolean;
  errors: string[];
};

type BulkPreviewResponse = {
  success: boolean;
  error?: string;
  previewOnly: boolean;
  fileName: string;
  sheetName: string;
  totalRows: number;
  validCount: number;
  invalidCount: number;
  canContinue: boolean;
  rows: BulkPreviewRow[];
  checkedAt: string;
};


type BulkUploadResult = {
  rowNumber: number;
  imei: string;
  status: "success" | "error";
  message: string;
  pooled: boolean;
  n11ProductId: string | null;
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
  _productStatus: string | null,
  _saleStatus: string | null,
  quantity: number,
  syncStatus: string | null
) {
  if (syncStatus === "DRAFT") {
    return {
      label: "Taslak",
      className: "bg-blue-50 text-blue-700 ring-blue-100",
    };
  }

  if (
    syncStatus === "READY" ||
    syncStatus === "CREATING" ||
    syncStatus === "IN_QUEUE" ||
    syncStatus === "SYNCED_PENDING_QUERY"
  ) {
    return {
      label: "N11 Bekleniyor",
      className: "bg-amber-50 text-amber-700 ring-amber-100",
    };
  }

  if (syncStatus === "ERROR") {
    return {
      label: "N11 Hata",
      className: "bg-red-50 text-red-700 ring-red-100",
    };
  }

  if (quantity > 0) {
    return {
      label: "Yayında",
      className: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    };
  }

  return {
    label: "Satışa Kapalı",
    className: "bg-red-50 text-red-700 ring-red-100",
  };
}

export default function Online() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<OnlineResponse | null>(null);
  const [ordersData, setOrdersData] = useState<N11OrdersResponse | null>(null);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState("");
  const [orderActionId, setOrderActionId] = useState("");
  const [orderActionMessage, setOrderActionMessage] = useState("");
  const [search, setSearch] = useState("");
  const [activeSection, setActiveSection] = useState<
    "orders" | "open" | "closed"
  >("open");
  const [orderSection, setOrderSection] = useState<
    "new" | "preparing" | "shipped" | "delivered"
  >("new");
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [filterBrand, setFilterBrand] = useState("");
  const [filterMemory, setFilterMemory] = useState("");
  const [sortMode, setSortMode] = useState<
    | "updated_desc"
    | "updated_asc"
    | "name_asc"
    | "name_desc"
    | "price_asc"
    | "price_desc"
    | "stock_asc"
    | "stock_desc"
  >("updated_desc");
  const [stockExporting, setStockExporting] = useState(false);
  const bulkFileInputRef = useRef<HTMLInputElement | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkError, setBulkError] = useState("");
  const [bulkPreview, setBulkPreview] = useState<BulkPreviewResponse | null>(null);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkCompleted, setBulkCompleted] = useState(0);
  const [bulkUploadResults, setBulkUploadResults] = useState<BulkUploadResult[]>([]);
  const [showBulkModal, setShowBulkModal] = useState(false);
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

  const loadData = useCallback(
    async (
      silent = false,
      background = false
    ) => {
      if (!background) {
        if (silent) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setError("");
      }

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
        if (!background) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    []
  );

  const syncN11Products = useCallback(
    async () => {
      const response = await fetch(
        "/api/online/n11/import",
        {
          method: "POST",
          cache: "no-store",
          credentials: "same-origin",
        }
      );

      const payload = await response
        .json()
        .catch(() => null);

      if (!response.ok || !payload?.success) {
        throw new Error(
          payload?.error ||
            "N11 stok/fiyat senkronu başarısız."
        );
      }

      return payload;
    },
    []
  );

  const syncN11OrderStock = useCallback(
    async () => {
      const response = await fetch(
        "/api/online/n11/orders?status=Created&stockOnly=1",
        {
          method: "GET",
          cache: "no-store",
          credentials: "same-origin",
        }
      );

      const payload = await response
        .json()
        .catch(() => null);

      if (!response.ok || !payload?.success) {
        throw new Error(
          payload?.error ||
            "N11 sipariş stok kontrolü başarısız."
        );
      }

      return payload;
    },
    []
  );

  const loadOrders = useCallback(async (silent = false) => {
    if (!silent) {
      setOrdersLoading(true);
    }

    setOrdersError("");

    const controller = new AbortController();
    const timeoutId = window.setTimeout(
      () => controller.abort(),
      30_000
    );

    try {
      const ordersResponse = await fetch(
        "/api/online/n11/orders",
        {
          method: "GET",
          cache: "no-store",
          credentials: "same-origin",
          signal: controller.signal,
        }
      );

      const ordersPayload = (await ordersResponse
        .json()
        .catch(() => null)) as N11OrdersResponse | null;

      if (!ordersResponse.ok || !ordersPayload?.success) {
        throw new Error(
          ordersPayload?.error || "N11 siparişleri alınamadı."
        );
      }

      setOrdersData(ordersPayload);

      // Orders endpoint yeni siparişleri stok 0'a kilitlemiş olabilir.
      // Satışa Açık / Kapalı listelerini hemen yerelden yenile.
      await loadData(false, true);
    } catch (ordersErr) {
      if (
        ordersErr instanceof Error &&
        ordersErr.name === "AbortError"
      ) {
        setOrdersError(
          "N11 sipariş servisi 30 saniye içinde yanıt vermedi."
        );
      } else {
        setOrdersError(
          ordersErr instanceof Error
            ? ordersErr.message
            : "N11 siparişleri alınamadı."
        );
      }
    } finally {
      window.clearTimeout(timeoutId);
      setOrdersLoading(false);
    }
  }, [loadData]);


  const refreshN11Now = useCallback(
    async () => {
      setRefreshing(true);
      setError("");

      try {
        // Sıra önemli:
        // 1) N11 canlı ürün/stok/fiyat bilgisini al.
        // 2) Yeni siparişleri kontrol edip sipariş gelen stokları 0'a kilitle.
        // 3) PostgreSQL'deki son durumu ekrana getir.
        const productSync =
          await syncN11Products();

        const orderSync =
          await syncN11OrderStock();

        await loadData(false, true);
        await loadOrders(true);

        return {
          productSync,
          orderSync,
        };
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "N11 canlı yenileme tamamlanamadı."
        );

        return null;
      } finally {
        setRefreshing(false);
      }
    },
    [
      loadData,
      loadOrders,
      syncN11OrderStock,
      syncN11Products,
    ]
  );


  const approveOrder = useCallback(
    async (order: N11Order) => {
      const lineIds = (order.lines || [])
        .map((line) => Number(line.orderLineId))
        .filter(
          (lineId) =>
            Number.isInteger(lineId) &&
            lineId > 0
        );

      if (lineIds.length === 0) {
        setOrdersError(
          "Bu siparişte onaylanabilir orderLineId bulunamadı."
        );
        return;
      }

      const orderKey =
        order.packageId ||
        order.orderNumber ||
        lineIds.join("-");

      const confirmed = window.confirm(
        `${order.orderNumber || "Bu sipariş"} N11 üzerinde onaylansın mı?\n\nDurum Created → Picking (Hazırlanıyor) olacak.`
      );

      if (!confirmed) return;

      setOrderActionId(orderKey);
      setOrderActionMessage("");
      setOrdersError("");

      try {
        const response = await fetch(
          "/api/online/n11/orders",
          {
            method: "PUT",
            cache: "no-store",
            credentials: "same-origin",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              action: "APPROVE",
              lineIds,
            }),
          }
        );

        const payload = await response
          .json()
          .catch(() => null);

        if (!response.ok || !payload?.success) {
          throw new Error(
            payload?.error ||
              "N11 siparişi onaylanamadı."
          );
        }

        setOrderActionMessage(
          `${order.orderNumber || "Sipariş"} onaylandı. Hazırlanıyor durumuna geçti.`
        );

        await loadOrders(true);
      } catch (err) {
        setOrdersError(
          err instanceof Error
            ? err.message
            : "N11 siparişi onaylanamadı."
        );
      } finally {
        setOrderActionId("");
      }
    },
    [loadOrders]
  );




  const openBulkModal = useCallback(() => {
    setBulkError("");
    setBulkPreview(null);
    setBulkUploading(false);
    setBulkCompleted(0);
    setBulkUploadResults([]);
    setShowBulkModal(true);
  }, []);

  const downloadBulkTemplate = useCallback(() => {
    const link = document.createElement("a");
    link.href = "/templates/CNETMOBIL_N11_TOPLU_URUN_SABLONU.xlsx";
    link.download = "CNETMOBIL_N11_TOPLU_URUN_SABLONU.xlsx";
    document.body.appendChild(link);
    link.click();
    link.remove();
  }, []);

  const chooseBulkExcel = useCallback(() => {
    setBulkError("");
    setBulkPreview(null);
    setBulkCompleted(0);
    setBulkUploadResults([]);
    setShowBulkModal(true);

    if (bulkFileInputRef.current) {
      bulkFileInputRef.current.value = "";
      bulkFileInputRef.current.click();
    }
  }, []);

  const handleBulkExcelFile = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];

      if (!file) return;

      setBulkLoading(true);
      setBulkError("");
      setBulkPreview(null);
      setBulkCompleted(0);
      setBulkUploadResults([]);
      setShowBulkModal(true);

      try {
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch(
          "/api/online/n11/bulk-preview",
          {
            method: "POST",
            cache: "no-store",
            credentials: "same-origin",
            body: formData,
          }
        );

        const payload = (await response
          .json()
          .catch(() => null)) as BulkPreviewResponse | null;

        if (!response.ok || !payload?.success) {
          throw new Error(
            payload?.error ||
              "Excel dosyası önizlenemedi."
          );
        }

        setBulkPreview(payload);
      } catch (err) {
        setBulkError(
          err instanceof Error
            ? err.message
            : "Excel dosyası önizlenemedi."
        );
      } finally {
        setBulkLoading(false);
      }
    },
    []
  );

  const startBulkUpload = useCallback(async () => {
    if (
      bulkUploading ||
      !bulkPreview?.canContinue
    ) {
      return;
    }

    const rows = bulkPreview.rows.filter(
      (row) => row.valid
    );

    if (rows.length === 0) {
      setBulkError("Yüklenecek geçerli cihaz bulunamadı.");
      return;
    }

    const confirmed = window.confirm(
      `${rows.length} cihaz tekli ürün ekleme ile AYNI N11 akışından gönderilecek.\n\nAynı varyantın farklı IMEI'leri sırayla işlenecek ve N11 stok adedi tek tek artırılacak.\n\nDevam edilsin mi?`
    );

    if (!confirmed) return;

    setBulkUploading(true);
    setBulkError("");
    setBulkCompleted(0);
    setBulkUploadResults([]);

    const results: BulkUploadResult[] = new Array(rows.length);
    let completed = 0;

    // KRİTİK:
    // Aynı varyantın farklı IMEI'lerini PARALEL göndermiyoruz.
    //
    // Örnek:
    // iPhone 13 / 128GB / Siyah / A / 12AY
    // IMEI-1
    // IMEI-2
    //
    // Eski yapıda 3 worker aynı anda çalıştığı için iki satır da
    // mevcut stoğu "1" görüp ikisi de "2" gönderebiliyordu.
    // Sonuç: 2 yeni IMEI olmasına rağmen N11 stok sadece +1 artıyordu.
    //
    // Yeni yapı:
    // - Aynı varyant kendi grubunda SIRALI işlenir.
    // - Farklı varyant grupları yine paralel çalışabilir.
    const normalizeBulkVariantPart = (
      value: unknown
    ) =>
      String(value ?? "")
        .trim()
        .toLocaleLowerCase("tr-TR")
        .replace(/\s+/g, "");

    const groupedRows = new Map<
      string,
      Array<{
        row: (typeof rows)[number];
        index: number;
      }>
    >();

    rows.forEach((row, index) => {
      const variantKey = [
        row.brand,
        row.model,
        row.memory,
        row.color,
        row.grade,
        row.warranty,
      ]
        .map(normalizeBulkVariantPart)
        .join("|");

      const group =
        groupedRows.get(variantKey) || [];

      group.push({
        row,
        index,
      });

      groupedRows.set(
        variantKey,
        group
      );
    });

    const groups =
      Array.from(
        groupedRows.values()
      );

    let nextGroupIndex = 0;

    const processRow = async (
      row: (typeof rows)[number],
      index: number
    ) => {
      try {
        const response = await fetch(
          "/api/online/listings",
          {
            method: "POST",
            cache: "no-store",
            credentials: "same-origin",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              imei: row.imei,
              brand: row.brand,
              model: row.model,
              memory: row.memory,
              color: row.color,
              grade: row.grade,
              warranty: row.warranty,
              salePrice: row.salePrice,
              listPrice: row.listPrice,
            }),
          }
        );

        const payload = await response
          .json()
          .catch(() => null);

        if (!response.ok || !payload?.success) {
          throw new Error(
            payload?.error ||
              "N11 ürün işlemi başarısız."
          );
        }

        results[index] = {
          rowNumber: row.rowNumber,
          imei: row.imei,
          status: "success",
          message:
            payload?.message ||
            "N11'e gönderildi.",
          pooled: Boolean(payload?.pooled),
          n11ProductId:
            payload?.listing?.external_product_id
              ? String(
                  payload.listing.external_product_id
                )
              : null,
        };
      } catch (err) {
        results[index] = {
          rowNumber: row.rowNumber,
          imei: row.imei,
          status: "error",
          message:
            err instanceof Error
              ? err.message
              : "N11 ürün işlemi başarısız.",
          pooled: false,
          n11ProductId: null,
        };
      } finally {
        completed += 1;

        setBulkCompleted(
          completed
        );

        setBulkUploadResults(
          results.filter(Boolean)
        );
      }
    };

    const groupWorker = async () => {
      while (true) {
        const groupIndex =
          nextGroupIndex;

        nextGroupIndex += 1;

        if (
          groupIndex >=
          groups.length
        ) {
          return;
        }

        const group =
          groups[groupIndex];

        // Aynı varyant içindeki IMEI'ler MUTLAKA sırayla.
        for (const item of group) {
          await processRow(
            item.row,
            item.index
          );
        }
      }
    };

    try {
      // Farklı ürün/varyant grupları performans için paralel kalabilir.
      // Aynı varyant grubu ise tek worker içinde sırayla gider.
      const workerCount =
        Math.min(
          3,
          groups.length
        );

      await Promise.all(
        Array.from(
          {
            length:
              Math.max(
                1,
                workerCount
              ),
          },
          () => groupWorker()
        )
      );

      await loadData(false, true);
    } catch (err) {
      setBulkError(
        err instanceof Error
          ? err.message
          : "Toplu yükleme tamamlanamadı."
      );
    } finally {
      setBulkUploading(false);
    }
  }, [
    bulkPreview,
    bulkUploading,
    loadData,
  ]);

  const closeBulkModal = useCallback(() => {
    if (bulkLoading || bulkUploading) return;

    setShowBulkModal(false);
    setBulkError("");
    setBulkPreview(null);
    setBulkCompleted(0);
    setBulkUploadResults([]);

    if (bulkFileInputRef.current) {
      bulkFileInputRef.current.value = "";
    }
  }, [bulkLoading, bulkUploading]);


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
          salePrice: draftForm.salePrice,
          listPrice: draftForm.listPrice,
        }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.success) {
        throw new Error(
          payload?.error ||
            "N11 ürün oluşturulamadı."
        );
      }

      if (
        payload?.created === true &&
        payload?.listing
          ?.external_product_id
      ) {
        setDraftSuccess(
          payload?.message ||
            `N11 ürünü açıldı. N11 ID: ${payload.listing.external_product_id}`
        );
      } else {
        setDraftSuccess(
          payload?.message ||
            "N11'e gönderildi. İşlem arka planda tamamlanıyor."
        );
      }

      // Kullanıcı N11 kuyruğunu beklemez.
      // Kayıt panele hemen düşer; N11 ID oluşana kadar
      // "N11 Bekleniyor" olarak kalır ve arka planda doğrulanır.
      await loadData(true);

      window.setTimeout(() => {
        setShowCreateModal(false);
        setDraftForm(EMPTY_DRAFT_FORM);
        setDraftSuccess("");
      }, 500);
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

  useEffect(() => {
    void loadOrders(false);
  }, [loadOrders]);

  useEffect(() => {
    if (activeSection !== "orders") {
      return;
    }

    const intervalId = window.setInterval(() => {
      void loadOrders(true);
    }, 60_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [activeSection, loadOrders]);


  // N11 ÜRÜN / STOK / FİYAT CANLI SENKRON
  // Coolify/server-migration tarafında çalışır.
  // İlk arka plan kontrolü 1 sn sonra, sonra 20 sn'de bir.
  useEffect(() => {
    let cancelled = false;
    let running = false;

    const run = async () => {
      if (cancelled || running) {
        return;
      }

      running = true;

      try {
        await syncN11Products();

        if (!cancelled) {
          await loadData(false, true);
        }
      } catch {
        // Arka plan senkron hatası panel kullanımını durdurmaz.
        // Manuel YENİLE hata detayını kullanıcıya gösterir.
      } finally {
        running = false;
      }
    };

    const firstId = window.setTimeout(() => {
      void run();
    }, 1_000);

    const intervalId =
      window.setInterval(() => {
        void run();
      }, 20_000);

    return () => {
      cancelled = true;
      window.clearTimeout(firstId);
      window.clearInterval(intervalId);
    };
  }, [loadData, syncN11Products]);

  // YENİ SİPARİŞ => STOK 0
  // Created siparişleri daha sık kontrol edilir.
  // Sipariş geldiğinde matching stockCode panelde hemen stok 0'a kilitlenir.
  useEffect(() => {
    let cancelled = false;
    let running = false;

    const run = async () => {
      if (cancelled || running) {
        return;
      }

      running = true;

      try {
        const result =
          await syncN11OrderStock();

        if (
          !cancelled &&
          Number(
            result?.updatedListingCount ||
              0
          ) > 0
        ) {
          await loadData(false, true);
        }
      } catch {
        // Arka plan kontrolü paneli bozmaz.
      } finally {
        running = false;
      }
    };

    const firstId = window.setTimeout(() => {
      void run();
    }, 1_500);

    const intervalId =
      window.setInterval(() => {
        void run();
      }, 10_000);

    return () => {
      cancelled = true;
      window.clearTimeout(firstId);
      window.clearInterval(intervalId);
    };
  }, [
    loadData,
    syncN11OrderStock,
  ]);

  const stats = data?.stats ?? EMPTY_STATS;
  const channel = data?.channel ?? null;
  const listings = data?.listings ?? [];

  const pendingN11Listings = useMemo(
    () =>
      listings.filter((item) => {
        const syncStatus = String(
          item.sync_status || ""
        ).toUpperCase();

        return (
          !item.external_product_id &&
          [
            "CREATING",
            "IN_QUEUE",
            "SYNCED_PENDING_QUERY",
          ].includes(syncStatus) &&
          Boolean(item.external_stock_code)
        );
      }),
    [listings]
  );

  useEffect(() => {
    if (pendingN11Listings.length === 0) {
      return;
    }

    let cancelled = false;
    let running = false;

    const reconcilePending = async () => {
      if (cancelled || running) return;

      running = true;
      let shouldReload = false;

      try {
        // Aynı anda çok fazla N11 isteği atmayalım.
        // En eski/yeni bekleyenlerden en fazla 5 tanesini kontrol ediyoruz.
        const batch = pendingN11Listings.slice(0, 5);

        for (const item of batch) {
          const stockCode = String(
            item.external_stock_code || ""
          ).trim();

          if (!stockCode) continue;

          try {
            const response = await fetch(
              `/api/online/listings?stockCode=${encodeURIComponent(
                stockCode
              )}&refreshN11=1`,
              {
                method: "GET",
                cache: "no-store",
                credentials: "same-origin",
              }
            );

            const payload = await response
              .json()
              .catch(() => null);

            if (
              payload?.created === true ||
              payload?.state === "CREATED" ||
              payload?.state === "ERROR" ||
              response.status === 422
            ) {
              shouldReload = true;
            }
          } catch {
            // Arka plan kontrolü kullanıcı akışını bozmaz.
          }
        }

        if (shouldReload && !cancelled) {
          await loadData(true);
        }
      } finally {
        running = false;
      }
    };

    // İlk kontrol kısa süre sonra; sonrası 10 saniyede bir.
    const firstCheckId = window.setTimeout(() => {
      void reconcilePending();
    }, 3500);

    const intervalId = window.setInterval(() => {
      void reconcilePending();
    }, 10_000);

    return () => {
      cancelled = true;
      window.clearTimeout(firstCheckId);
      window.clearInterval(intervalId);
    };
  }, [pendingN11Listings, loadData]);

  const openListings = useMemo(
    () =>
      listings.filter(
        (item) =>
          Boolean(item.external_product_id) &&
          item.sync_status === "SYNCED" &&
          Number(item.quantity || 0) > 0
      ),
    [listings]
  );

  const closedListings = useMemo(
    () =>
      listings.filter(
        (item) =>
          !item.external_product_id ||
          item.sync_status !== "SYNCED" ||
          Number(item.quantity || 0) <= 0
      ),
    [listings]
  );

  const openDeviceCount = useMemo(
    () =>
      openListings.reduce(
        (total, item) =>
          total +
          Math.max(
            0,
            Number(item.quantity || 0)
          ),
        0
      ),
    [openListings]
  );

  const totalActiveDeviceCount = useMemo(
    () =>
      listings.reduce(
        (total, item) =>
          total +
          Math.max(
            0,
            Number(item.quantity || 0)
          ),
        0
      ),
    [listings]
  );

  const newOrders =
    ordersData?.groups?.Created?.orders ?? [];
  const preparingOrders =
    ordersData?.groups?.Picking?.orders ?? [];
  const shippedOrders =
    ordersData?.groups?.Shipped?.orders ?? [];
  const deliveredOrders =
    ordersData?.groups?.Delivered?.orders ?? [];

  const orderCount =
    ordersData?.counts?.newOrders ?? 0;

  const selectedOrders =
    orderSection === "new"
      ? newOrders
      : orderSection === "preparing"
      ? preparingOrders
      : orderSection === "shipped"
      ? shippedOrders
      : deliveredOrders;

  const selectedOrderGroup =
    orderSection === "new"
      ? ordersData?.groups?.Created
      : orderSection === "preparing"
      ? ordersData?.groups?.Picking
      : orderSection === "shipped"
      ? ordersData?.groups?.Shipped
      : ordersData?.groups?.Delivered;

  const filteredListings = useMemo(() => {
    const source =
      activeSection === "open"
        ? openListings
        : activeSection === "closed"
        ? closedListings
        : [];

    const q = search.trim().toLocaleLowerCase("tr-TR");
    const wantedBrand = filterBrand.trim().toLocaleLowerCase("tr-TR");
    const wantedMemory = filterMemory.trim().toLocaleLowerCase("tr-TR");

    return source.filter((item) => {
      const brandValue = String(
        item.brand || item.device_brand || ""
      ).toLocaleLowerCase("tr-TR");

      const memoryValue = String(
        item.memory || item.device_memory || ""
      ).toLocaleLowerCase("tr-TR");

      if (wantedBrand && !brandValue.includes(wantedBrand)) return false;
      if (wantedMemory && !memoryValue.includes(wantedMemory)) return false;

      if (!q) return true;

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
  }, [
    activeSection,
    closedListings,
    filterBrand,
    filterMemory,
    openListings,
    search,
  ]);

  const sortedListings = useMemo(() => {
    const items = [...filteredListings];

    const nameValue = (item: OnlineListing) =>
      [
        item.brand || item.device_brand || "",
        item.model || item.device_model || "",
        item.memory || item.device_memory || "",
        item.color || item.device_color || "",
      ]
        .join(" ")
        .toLocaleLowerCase("tr-TR");

    items.sort((a, b) => {
      if (sortMode === "name_asc") {
        return nameValue(a).localeCompare(
          nameValue(b),
          "tr"
        );
      }

      if (sortMode === "name_desc") {
        return nameValue(b).localeCompare(
          nameValue(a),
          "tr"
        );
      }

      if (sortMode === "price_asc") {
        return (
          Number(a.sale_price || 0) -
          Number(b.sale_price || 0)
        );
      }

      if (sortMode === "price_desc") {
        return (
          Number(b.sale_price || 0) -
          Number(a.sale_price || 0)
        );
      }

      if (sortMode === "stock_asc") {
        return (
          Number(a.quantity || 0) -
          Number(b.quantity || 0)
        );
      }

      if (sortMode === "stock_desc") {
        return (
          Number(b.quantity || 0) -
          Number(a.quantity || 0)
        );
      }

      const aTime =
        new Date(
          a.updated_at || a.created_at
        ).getTime() || 0;

      const bTime =
        new Date(
          b.updated_at || b.created_at
        ).getTime() || 0;

      return sortMode === "updated_asc"
        ? aTime - bTime
        : bTime - aTime;
    });

    return items;
  }, [filteredListings, sortMode]);

  const exportStockExcel = useCallback(async () => {
    if (
      activeSection === "orders" ||
      sortedListings.length === 0
    ) {
      window.alert(
        "Excel'e aktarılacak ürün bulunamadı."
      );
      return;
    }

    setStockExporting(true);

    try {
      const detailResponse = await fetch(
        "/api/online/listings",
        {
          method: "GET",
          cache: "no-store",
          credentials: "same-origin",
        }
      );

      const detailPayload =
        await detailResponse
          .json()
          .catch(() => null);

      if (
        !detailResponse.ok ||
        !detailPayload?.success
      ) {
        throw new Error(
          detailPayload?.error ||
            "IMEI havuzu alınamadı."
        );
      }

      const detailMap = new Map<number, any>(
        (
          Array.isArray(
            detailPayload?.listings
          )
            ? detailPayload.listings
            : []
        ).map((item: any) => [
          Number(item.id),
          item,
        ])
      );

      const isImei = (
        value: unknown
      ) =>
        /^[0-9]{15}$/.test(
          String(value ?? "").trim()
        );

      const uniqueStrings = (
        value: unknown
      ) => {
        if (!Array.isArray(value)) {
          return [] as string[];
        }

        return Array.from(
          new Set(
            value
              .map((item) =>
                String(
                  item ?? ""
                ).trim()
              )
              .filter(Boolean)
          )
        );
      };

      const exportRows: Array<
        Record<string, string | number>
      > = [];

      for (
        const item of sortedListings
      ) {
        const detail =
          detailMap.get(
            Number(item.id)
          ) || item;

        const raw =
          detail?.raw_data &&
          typeof detail.raw_data ===
            "object" &&
          !Array.isArray(
            detail.raw_data
          )
            ? detail.raw_data
            : {};

        const quantity =
          Math.max(
            0,
            Number(
              detail?.quantity ??
                item.quantity ??
                0
            )
          );

        let imeis: string[] = [];

        if (
          activeSection === "open"
        ) {
          imeis = uniqueStrings(
            raw?.availableImeis
          ).filter(isImei);
        } else {
          imeis = uniqueStrings(
            raw?.soldImeis
          ).filter(isImei);
        }

        if (imeis.length === 0) {
          const stockCode =
            String(
              detail?.external_stock_code ||
                item.external_stock_code ||
                ""
            ).trim();

          const deviceImei =
            String(
              detail?.device_imei ||
                item.device_imei ||
                ""
            ).trim();

          if (isImei(stockCode)) {
            imeis = [stockCode];
          } else if (
            isImei(deviceImei)
          ) {
            imeis = [deviceImei];
          }
        }

        const expectedRowCount =
          activeSection === "open"
            ? Math.max(
                quantity,
                imeis.length
              )
            : Math.max(
                1,
                imeis.length
              );

        for (
          let imeiIndex = 0;
          imeiIndex <
          expectedRowCount;
          imeiIndex += 1
        ) {
          const imei =
            imeis[imeiIndex] || "";

          exportRows.push({
            SIRA:
              exportRows.length + 1,
            IMEI:
              imei ||
              "IMEI_BILINMIYOR",
            N11_DURUM:
              activeSection ===
              "open"
                ? "SATIŞA AÇIK"
                : "SATIŞA KAPALI",
            MARKA:
              item.brand ||
              item.device_brand ||
              "",
            MODEL:
              item.model ||
              item.device_model ||
              "",
            HAFIZA:
              item.memory ||
              item.device_memory ||
              "",
            RENK:
              item.color ||
              item.device_color ||
              "",
            GRADE:
              item.grade ||
              item.device_grade ||
              "",
            GARANTI:
              item.warranty ||
              item.device_warranty ||
              "",
            N11_STOK_KODU:
              item.external_stock_code ||
              "",
            N11_URUN_ID:
              item.external_product_id ||
              "",
            STOK: 1,
            N11_SATIS_FIYATI:
              Number(
                item.sale_price || 0
              ),
            N11_LISTE_FIYATI:
              Number(
                item.list_price || 0
              ),
            SENKRON_DURUMU:
              item.sync_status || "",
            SON_GUNCELLEME:
              item.updated_at
                ? new Date(
                    item.updated_at
                  ).toLocaleString(
                    "tr-TR"
                  )
                : "",
          });
        }
      }

      const XLSX =
        await import("xlsx");

      const worksheet =
        XLSX.utils.json_to_sheet(
          exportRows
        );

      worksheet["!cols"] = [
        { wch: 7 },
        { wch: 20 },
        { wch: 16 },
        { wch: 16 },
        { wch: 24 },
        { wch: 12 },
        { wch: 16 },
        { wch: 12 },
        { wch: 16 },
        { wch: 22 },
        { wch: 16 },
        { wch: 9 },
        { wch: 18 },
        { wch: 18 },
        { wch: 18 },
        { wch: 22 },
      ];

      const workbook =
        XLSX.utils.book_new();

      XLSX.utils.book_append_sheet(
        workbook,
        worksheet,
        activeSection === "open"
          ? "SATISA_ACIK"
          : "SATISA_KAPALI"
      );

      const now = new Date();

      const stamp = [
        now.getFullYear(),
        String(
          now.getMonth() + 1
        ).padStart(2, "0"),
        String(
          now.getDate()
        ).padStart(2, "0"),
        "_",
        String(
          now.getHours()
        ).padStart(2, "0"),
        String(
          now.getMinutes()
        ).padStart(2, "0"),
      ].join("");

      const sectionName =
        activeSection === "open"
          ? "SATISA_ACIK"
          : "SATISA_KAPALI";

      XLSX.writeFile(
        workbook,
        `CNETMOBIL_N11_STOK_${sectionName}_${stamp}.xlsx`
      );
    } catch (err) {
      console.error(
        "N11 STOCK EXCEL EXPORT ERROR:",
        err
      );

      window.alert(
        err instanceof Error
          ? `Excel indirilemedi: ${err.message}`
          : "Excel indirilemedi."
      );
    } finally {
      setStockExporting(false);
    }
  }, [
    activeSection,
    sortedListings,
  ]);

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
        <section className="rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-[0_10px_35px_rgba(15,23,42,0.06)] sm:p-6">
          <div className="grid grid-cols-1 gap-4 2xl:grid-cols-[minmax(440px,1.35fr)_repeat(4,minmax(180px,0.72fr))]">
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

                <p className="mt-2 max-w-2xl text-[13px] font-semibold leading-6 text-slate-500">
                  N11 ürünlerini, stok durumlarını ve sipariş akışını tek ekrandan yönetin.
                </p>

                <div className="mt-5 flex flex-wrap items-center gap-3 text-[12px] font-bold text-slate-500">
                  <div className="inline-flex items-center gap-2">
                    <span className="text-slate-400">Son senkronizasyon:</span>
                    <span className="font-black text-slate-700">
                      {formatDate(channel?.last_sync_at)}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      void refreshN11Now();
                    }}
                    disabled={refreshing}
                    className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 px-3 text-[11px] font-black uppercase tracking-wider text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {refreshing ? "Yenileniyor..." : "Yenile"}
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-[22px] border border-blue-100 bg-white p-4 text-left shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-xl">
                  🛒
                </div>
              </div>
              <div className="mt-4 text-[11px] font-black uppercase tracking-wider text-slate-400">
                Siparişler
              </div>
              <div className="mt-1 text-[24px] font-black tracking-tight text-slate-900">
                {ordersLoading && !ordersData ? "…" : orderCount}
              </div>
              <div className="mt-1 text-[11px] font-semibold text-slate-500">
                Yeni N11 siparişleri
              </div>
            </div>

            <div className="rounded-[22px] border border-emerald-100 bg-white p-4 text-left shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-xl">
                  ▶
                </div>
              </div>
              <div className="mt-4 text-[11px] font-black uppercase tracking-wider text-slate-400">
                Satışa Açık
              </div>
              <div className="mt-1 text-[24px] font-black tracking-tight text-slate-900">
                {openDeviceCount}
              </div>
              <div className="mt-1 text-[11px] font-semibold text-slate-500">
                Stokta ve yayında
              </div>
            </div>

            <div className="rounded-[22px] border border-red-100 bg-white p-4 text-left shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-xl text-red-600">
                  Ⅱ
                </div>
              </div>
              <div className="mt-4 text-[11px] font-black uppercase tracking-wider text-slate-400">
                Satışa Kapalı
              </div>
              <div className="mt-1 text-[24px] font-black tracking-tight text-red-600">
                {closedListings.length}
              </div>
              <div className="mt-1 text-[11px] font-semibold text-slate-500">
                Stok 0 / kapalı
              </div>
            </div>

            <div className="rounded-[22px] border border-amber-100 bg-white p-4 shadow-sm">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-xl font-black text-amber-600">
                ₺
              </div>
              <div className="mt-4 text-[11px] font-black uppercase tracking-wider text-slate-400">
                Ortalama Fiyat
              </div>
              <div className="mt-1 text-[24px] font-black tracking-tight text-slate-900">
                {formatMoney(stats.averageSalePrice)}
              </div>
              <div className="mt-1 text-[11px] font-semibold text-slate-500">
                Satış fiyatı ortalaması
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[20px] border border-slate-100 bg-slate-50/70 px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                N11 Bağlantı
              </span>
              <span
                className={`rounded-full px-3 py-1 text-[10px] font-black ${
                  data?.apiConnected
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-slate-200 text-slate-600"
                }`}
              >
                {data?.apiConnected ? "AKTİF" : "BEKLİYOR"}
              </span>
              <span className="text-[11px] font-semibold text-slate-500">
                Kanal: {channel?.channel || "N11"} · Entegratör: {channel?.integrator_name || "CNETMOBIL"} · Stok/Fiyat: 20 sn · Yeni Sipariş: 10 sn
              </span>
            </div>

            <div className="text-[11px] font-semibold text-slate-500">
              Toplam aktif cihaz: <b className="text-slate-800">{totalActiveDeviceCount}</b> · N11 ilan: <b className="text-slate-800">{listings.length}</b>
            </div>
          </div>
        </section>

        {error ? (
          <section className="rounded-[22px] border border-red-200 bg-red-50 px-5 py-4 text-sm font-bold text-red-700">
            {error}
          </section>
        ) : null}

        <section className="rounded-[28px] border border-slate-200/80 bg-white p-4 shadow-[0_10px_35px_rgba(15,23,42,0.05)] sm:p-5">
          <div className="flex flex-col gap-4 border-b border-slate-100 pb-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveSection("orders")}
                  className={`rounded-2xl px-5 py-3 text-[12px] font-black transition ${
                    activeSection === "orders"
                      ? "bg-blue-600 text-white shadow-sm"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  🛒 Siparişler ({ordersLoading && !ordersData ? "…" : orderCount})
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSection("open")}
                  className={`rounded-2xl px-5 py-3 text-[12px] font-black transition ${
                    activeSection === "open"
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  ▶ Satışa Açık ({openDeviceCount})
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSection("closed")}
                  className={`rounded-2xl px-5 py-3 text-[12px] font-black transition ${
                    activeSection === "closed"
                      ? "bg-red-600 text-white shadow-sm"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  Ⅱ Satışa Kapalı ({closedListings.length})
                </button>
              </div>

              <div className="flex w-full flex-wrap gap-2 xl:w-auto xl:flex-row xl:items-center xl:justify-end">
                <input
                  ref={bulkFileInputRef}
                  type="file"
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  className="hidden"
                  onChange={handleBulkExcelFile}
                />

                <button
                  type="button"
                  onClick={openCreateModal}
                  className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 px-3.5 text-[10px] font-black uppercase tracking-wide text-white shadow-sm transition hover:bg-blue-700"
                >
                  + Yeni Ürün Aç
                </button>

                <button
                  type="button"
                  onClick={openBulkModal}
                  disabled={bulkLoading || bulkUploading}
                  className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl border border-violet-200 bg-violet-50 px-3.5 text-[10px] font-black uppercase tracking-wide text-violet-700 transition hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Excel Toplu Ekle
                </button>

                <button
                  type="button"
                  onClick={() => {
                    void exportStockExcel();
                  }}
                  disabled={
                    activeSection === "orders" ||
                    stockExporting ||
                    sortedListings.length === 0
                  }
                  className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 px-3 text-[10px] font-black text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {stockExporting
                    ? "EXCEL HAZIRLANIYOR..."
                    : `⬇ EXCEL İNDİR (${activeSection === "open" ? sortedListings.reduce((t, item) => t + Math.max(0, Number(item.quantity || 0)), 0) : sortedListings.length})`}
                </button>

                <div className="relative w-full xl:w-[230px]">
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    disabled={activeSection === "orders"}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-3 pr-9 text-[11px] font-semibold text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-300 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
                    placeholder="Ürün, IMEI veya N11 ID ara..."
                  />
                  <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
                    ⌕
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setShowFilterPanel((current) => !current)}
                  disabled={activeSection === "orders"}
                  className={`inline-flex h-10 shrink-0 items-center justify-center rounded-xl border px-3 text-[10px] font-black transition disabled:cursor-not-allowed disabled:opacity-50 ${
                    showFilterPanel
                      ? "border-slate-300 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  ⏷ FİLTRELE
                </button>

                <div className="relative">
                  <select
                    value={sortMode}
                    onChange={(event) =>
                      setSortMode(
                        event.target
                          .value as typeof sortMode
                      )
                    }
                    disabled={activeSection === "orders"}
                    className="h-10 w-[122px] cursor-pointer appearance-none rounded-xl border border-slate-200 bg-white pl-3 pr-7 text-[10px] font-black text-slate-700 outline-none transition hover:border-blue-200 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label="Ürünleri sırala"
                  >
                    <option value="updated_desc">
                      ↕ En Yeni
                    </option>
                    <option value="updated_asc">
                      En Eski
                    </option>
                    <option value="name_asc">
                      Ürün A → Z
                    </option>
                    <option value="name_desc">
                      Ürün Z → A
                    </option>
                    <option value="price_asc">
                      Fiyat Düşük → Yüksek
                    </option>
                    <option value="price_desc">
                      Fiyat Yüksek → Düşük
                    </option>
                    <option value="stock_desc">
                      Stok Çok → Az
                    </option>
                    <option value="stock_asc">
                      Stok Az → Çok
                    </option>
                  </select>

                  <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">
                    ▼
                  </span>
                </div>
              </div>
            </div>

            {showFilterPanel && activeSection !== "orders" ? (
              <div className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-[1fr_1fr_auto]">
                <label>
                  <div className="mb-1 text-[10px] font-black uppercase tracking-wider text-slate-400">
                    Marka
                  </div>
                  <input
                    value={filterBrand}
                    onChange={(event) => setFilterBrand(event.target.value)}
                    placeholder="Örn. Apple"
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-[12px] font-semibold outline-none focus:border-blue-300"
                  />
                </label>

                <label>
                  <div className="mb-1 text-[10px] font-black uppercase tracking-wider text-slate-400">
                    Hafıza
                  </div>
                  <input
                    value={filterMemory}
                    onChange={(event) => setFilterMemory(event.target.value)}
                    placeholder="Örn. 128 GB"
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-[12px] font-semibold outline-none focus:border-blue-300"
                  />
                </label>

                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => {
                      setFilterBrand("");
                      setFilterMemory("");
                      setSearch("");
                    }}
                    className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-[11px] font-black text-slate-600 hover:bg-slate-100"
                  >
                    TEMİZLE
                  </button>
                </div>
              </div>
            ) : null}

            <div>
              <div className="text-[15px] font-black text-slate-900">
                {activeSection === "orders"
                  ? "Siparişler"
                  : activeSection === "open"
                  ? "Satışa Açık Ürünler"
                  : "Satışa Kapalı Ürünler"}
              </div>
              <div className="mt-1 text-[12px] font-semibold text-slate-500">
                {activeSection === "orders"
                  ? "Yeni sipariş, hazırlanan, kargodaki ve teslim edilen N11 siparişlerini takip edin."
                  : activeSection === "open"
                  ? `${openListings.length} N11 ilanında toplam ${openDeviceCount} fiziksel cihaz stokta.`
                  : "Stok adedi 0 olan, satışa kapalı N11 ürünleri."}
              </div>
            </div>
          </div>

          {activeSection === "orders" ? (
            <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2">
              <button
                type="button"
                onClick={() => setOrderSection("new")}
                className={`rounded-xl px-4 py-2.5 text-[11px] font-black transition ${
                  orderSection === "new"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "bg-white text-slate-600 hover:bg-slate-100"
                }`}
              >
                YENİ SİPARİŞLER ({ordersData?.counts?.newOrders ?? 0})
              </button>

              <button
                type="button"
                onClick={() => setOrderSection("preparing")}
                className={`rounded-xl px-4 py-2.5 text-[11px] font-black transition ${
                  orderSection === "preparing"
                    ? "bg-amber-500 text-white shadow-sm"
                    : "bg-white text-slate-600 hover:bg-slate-100"
                }`}
              >
                KARGOYA HAZIRLANIYOR ({ordersData?.counts?.preparing ?? 0})
              </button>

              <button
                type="button"
                onClick={() => setOrderSection("shipped")}
                className={`rounded-xl px-4 py-2.5 text-[11px] font-black transition ${
                  orderSection === "shipped"
                    ? "bg-violet-600 text-white shadow-sm"
                    : "bg-white text-slate-600 hover:bg-slate-100"
                }`}
              >
                KARGODA ({ordersData?.counts?.shipped ?? 0})
              </button>

              <button
                type="button"
                onClick={() => setOrderSection("delivered")}
                className={`rounded-xl px-4 py-2.5 text-[11px] font-black transition ${
                  orderSection === "delivered"
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "bg-white text-slate-600 hover:bg-slate-100"
                }`}
              >
                TESLİM EDİLDİ ({ordersData?.counts?.delivered ?? 0})
              </button>

              <div className="ml-auto px-2 text-[10px] font-bold text-slate-400">
                N11 durumu 60 sn&apos;de bir yenilenir
              </div>
            </div>
          ) : null}

          {orderActionMessage && activeSection === "orders" ? (
            <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[12px] font-black text-emerald-700">
              {orderActionMessage}
            </div>
          ) : null}

          <div className="mt-4 overflow-hidden rounded-[22px] border border-slate-100">
            {activeSection === "orders" ? (
              ordersLoading && !ordersData ? (
                <div className="flex min-h-[240px] flex-col items-center justify-center px-6 text-center">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-100 border-t-blue-600" />
                  <div className="mt-4 text-[14px] font-black text-slate-700">
                    N11 siparişleri yükleniyor...
                  </div>
                  <div className="mt-2 text-[11px] font-semibold text-slate-400">
                    ONLINE ürün ekranı bu işlemden etkilenmez.
                  </div>
                </div>
              ) : ordersError ? (
                <div className="flex min-h-[240px] flex-col items-center justify-center px-6 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-2xl">
                    !
                  </div>
                  <div className="mt-4 text-[15px] font-black text-red-700">
                    N11 siparişleri alınamadı
                  </div>
                  <div className="mt-2 max-w-xl text-[12px] font-semibold leading-5 text-slate-500">
                    {ordersError}
                  </div>
                  <button
                    type="button"
                    onClick={() => void loadOrders(false)}
                    className="mt-4 rounded-xl bg-blue-600 px-4 py-2 text-[11px] font-black text-white"
                  >
                    TEKRAR DENE
                  </button>
                </div>
              ) : selectedOrders.length === 0 ? (
                <div className="flex min-h-[240px] flex-col items-center justify-center px-6 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-3xl">
                    🛒
                  </div>
                  <div className="mt-4 text-[16px] font-black text-slate-800">
                    Yeni sipariş yok
                  </div>
                  <div className="mt-2 max-w-xl text-[12px] font-semibold leading-5 text-slate-500">
                    {orderSection === "new"
                      ? "Yeni onay bekleyen N11 siparişi bulunamadı."
                      : orderSection === "preparing"
                      ? "Kargoya hazırlanan sipariş bulunamadı."
                      : orderSection === "shipped"
                      ? "Kargoda olan sipariş bulunamadı."
                      : "Teslim edilmiş sipariş bulunamadı."}
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <div className="min-w-[1500px]">
                    <div className="grid grid-cols-[0.85fr_1.1fr_1.8fr_0.5fr_0.8fr_0.85fr_0.8fr_0.95fr_1fr] items-center bg-slate-50 px-4 py-4 text-[10px] font-black uppercase tracking-wider text-slate-500">
                      <div>Sipariş No</div>
                      <div>Müşteri</div>
                      <div>Ürün</div>
                      <div>Adet</div>
                      <div>Tutar</div>
                      <div>Şehir</div>
                      <div>Durum</div>
                      <div>Tarih</div>
                      <div>İşlem</div>
                    </div>

                    {selectedOrders.map((order, index) => (
                      <div
                        key={`${order.packageId || order.orderNumber || "order"}-${index}`}
                        className="grid grid-cols-[0.85fr_1.1fr_1.8fr_0.5fr_0.8fr_0.85fr_0.8fr_0.95fr_1fr] items-center border-t border-slate-100 px-4 py-4 text-[12px] font-semibold text-slate-700 hover:bg-blue-50/30"
                      >
                        <div>
                          <div className="font-mono text-[12px] font-black text-slate-900">
                            {order.orderNumber || "—"}
                          </div>
                          <div className="mt-1 text-[9px] font-bold text-slate-400">
                            Paket: {order.packageId || "—"}
                          </div>
                        </div>

                        <div className="min-w-0 pr-3">
                          <div className="truncate text-[13px] font-black text-slate-900">
                            {order.customerFullName || "—"}
                          </div>
                          <div className="mt-1 truncate text-[10px] font-semibold text-slate-400">
                            {order.customerEmail || "—"}
                          </div>
                        </div>

                        <div className="min-w-0 pr-4">
                          <div className="line-clamp-2 text-[12px] font-bold leading-5 text-slate-800">
                            {order.productSummary || "—"}
                          </div>
                          {order.lines?.[0]?.stockCode ? (
                            <div className="mt-1 font-mono text-[10px] font-bold text-slate-400">
                              Stok: {order.lines[0].stockCode}
                            </div>
                          ) : null}
                        </div>

                        <div className="text-[14px] font-black text-slate-900">
                          {order.totalQuantity}
                        </div>

                        <div className="font-black text-slate-900">
                          {formatMoney(Number(order.totalAmount || 0))}
                        </div>

                        <div>
                          <div className="font-bold text-slate-800">
                            {order.city || "—"}
                          </div>
                          <div className="mt-1 text-[10px] font-semibold text-slate-400">
                            {order.district || "—"}
                          </div>
                        </div>

                        <div>
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-[10px] font-black ring-1 ${
                              orderSection === "new"
                                ? "bg-blue-50 text-blue-700 ring-blue-100"
                                : orderSection === "preparing"
                                ? "bg-amber-50 text-amber-700 ring-amber-100"
                                : orderSection === "shipped"
                                ? "bg-violet-50 text-violet-700 ring-violet-100"
                                : "bg-emerald-50 text-emerald-700 ring-emerald-100"
                            }`}
                          >
                            {orderSection === "new"
                              ? "Yeni Sipariş"
                              : orderSection === "preparing"
                              ? "Kargoya Hazırlanıyor"
                              : orderSection === "shipped"
                              ? "Kargoda"
                              : "Teslim Edildi"}
                          </span>
                        </div>

                        <div className="text-[11px] font-bold text-slate-600">
                          {formatDate(
                            order.agreedDeliveryDate ||
                              order.lastModifiedDate
                          )}
                        </div>

                        <div>
                          {orderSection === "new" ? (
                            <button
                              type="button"
                              onClick={() => void approveOrder(order)}
                              disabled={
                                orderActionId ===
                                (order.packageId ||
                                  order.orderNumber ||
                                  "")
                              }
                              className="h-9 rounded-xl bg-blue-600 px-4 text-[10px] font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {orderActionId ===
                              (order.packageId ||
                                order.orderNumber ||
                                "")
                                ? "ONAYLANIYOR..."
                                : "ONAYLA"}
                            </button>
                          ) : (
                            <span className="text-[10px] font-bold text-slate-400">
                              —
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            ) : sortedListings.length === 0 ? (
              <div className="flex min-h-[260px] flex-col items-center justify-center px-6 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-2xl text-slate-400">
                  ◫
                </div>
                <div className="mt-4 text-[15px] font-black text-slate-800">
                  Ürün bulunamadı
                </div>
                <div className="mt-2 max-w-lg text-[12px] font-semibold leading-5 text-slate-500">
                  {activeSection === "open"
                    ? "Satışa açık, stoklu ürün bulunamadı."
                    : "Satışa kapalı, stok 0 ürün bulunamadı."}
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

                  {sortedListings.map((item) => {
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

                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {activeSection === "orders" ? (
            !ordersError && selectedOrders.length > 0 ? (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-[12px] font-semibold text-slate-500">
                <div>
                  Gösterilen Sipariş:{" "}
                  <span className="font-black text-blue-700">
                    {selectedOrderGroup?.count ?? 0}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <span>
                    Toplam Adet:{" "}
                    <b className="text-slate-800">
                      {selectedOrderGroup?.totalQuantity ?? 0}
                    </b>
                  </span>
                  <span>
                    Toplam Tutar:{" "}
                    <b className="text-slate-800">
                      {formatMoney(
                        Number(selectedOrderGroup?.totalAmount || 0)
                      )}
                    </b>
                  </span>
                </div>
              </div>
            ) : null
          ) : (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-[12px] font-semibold text-slate-500">
              <div>
                Gösterilen:{" "}
                <span className="font-black text-slate-800">
                  {sortedListings.length}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <span>
                  Satışa Açık:{" "}
                  <b className="text-emerald-700">{openListings.length}</b>
                </span>
                <span>
                  Satışa Kapalı:{" "}
                  <b className="text-red-700">{closedListings.length}</b>
                </span>
              </div>
            </div>
          )}
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

        {showBulkModal ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/50 p-4">
          <div className="flex max-h-[90vh] w-full max-w-[1500px] flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
              <div>
                <div className="text-[18px] font-black text-slate-900">
                  Excel ile Toplu Cihaz Ekleme
                </div>
                <div className="mt-1 text-[12px] font-semibold text-slate-500">
                  Şablonu indir → doldur → geri yükle → kontrol et → N11&apos;e toplu gönder.
                </div>
              </div>

              <button
                type="button"
                onClick={closeBulkModal}
                disabled={bulkLoading}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-lg font-black text-slate-500 hover:bg-slate-50 disabled:opacity-50"
              >
                ×
              </button>
            </div>

            <div className="flex-1 overflow-auto p-6">
              {bulkLoading ? (
                <div className="flex min-h-[320px] flex-col items-center justify-center">
                  <div className="h-9 w-9 animate-spin rounded-full border-4 border-slate-200 border-t-slate-800" />
                  <div className="mt-4 text-[14px] font-black text-slate-700">
                    Excel kontrol ediliyor...
                  </div>
                </div>
              ) : bulkError ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-[13px] font-bold text-red-700">
                  {bulkError}
                </div>
              ) : bulkPreview ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    <div className="rounded-2xl border border-slate-200 p-4">
                      <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                        Toplam Satır
                      </div>
                      <div className="mt-1 text-[22px] font-black text-slate-900">
                        {bulkPreview.totalRows}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 p-4">
                      <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                        Geçerli
                      </div>
                      <div className="mt-1 text-[22px] font-black text-emerald-700">
                        {bulkPreview.validCount}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 p-4">
                      <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                        Hatalı
                      </div>
                      <div className="mt-1 text-[22px] font-black text-red-600">
                        {bulkPreview.invalidCount}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 p-4">
                      <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                        Dosya
                      </div>
                      <div className="mt-2 truncate text-[12px] font-black text-slate-800">
                        {bulkPreview.fileName}
                      </div>
                    </div>
                  </div>

                  {bulkPreview.canContinue ? (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[12px] font-black text-emerald-700">
                      Excel temiz. Tüm satırlar N11 toplu yükleme için hazır.
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-[12px] font-black text-red-700">
                      Hatalı satırlar var. Önce Excel&apos;i düzeltip tekrar yükleyin.
                    </div>
                  )}

                  {bulkUploading || bulkUploadResults.length > 0 ? (
                    <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="text-[11px] font-black uppercase tracking-wider text-blue-600">
                            N11 Toplu Gönderim
                          </div>
                          <div className="mt-1 text-[13px] font-black text-slate-900">
                            {bulkCompleted} / {bulkPreview.validCount} cihaz işlendi
                          </div>
                        </div>

                        <div className="text-[11px] font-black text-slate-600">
                          Başarılı: {bulkUploadResults.filter((item) => item.status === "success").length}
                          {" · "}
                          Hatalı: {bulkUploadResults.filter((item) => item.status === "error").length}
                        </div>
                      </div>

                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-blue-100">
                        <div
                          className="h-full rounded-full bg-blue-600 transition-all"
                          style={{
                            width: `${bulkPreview.validCount > 0 ? Math.min(100, (bulkCompleted / bulkPreview.validCount) * 100) : 0}%`,
                          }}
                        />
                      </div>

                      {!bulkUploading && bulkCompleted === bulkPreview.validCount ? (
                        <div className="mt-3 text-[12px] font-black text-emerald-700">
                          Toplu gönderim tamamlandı. N11 ID bekleyen ürünler arka planda otomatik doğrulanacaktır.
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="overflow-x-auto rounded-2xl border border-slate-200">
                    <div className="min-w-[1450px]">
                      <div className="grid grid-cols-[0.45fr_1.15fr_0.75fr_1.2fr_0.7fr_0.75fr_0.55fr_0.75fr_0.8fr_0.8fr_1.5fr] bg-slate-50 px-4 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500">
                        <div>Satır</div>
                        <div>IMEI</div>
                        <div>Marka</div>
                        <div>Model</div>
                        <div>Hafıza</div>
                        <div>Renk</div>
                        <div>Grade</div>
                        <div>Garanti</div>
                        <div>Satış</div>
                        <div>Liste</div>
                        <div>Kontrol</div>
                      </div>

                      {bulkPreview.rows.map((row) => (
                        <div
                          key={`${row.rowNumber}-${row.imei}`}
                          className="grid grid-cols-[0.45fr_1.15fr_0.75fr_1.2fr_0.7fr_0.75fr_0.55fr_0.75fr_0.8fr_0.8fr_1.5fr] items-center border-t border-slate-100 px-4 py-3 text-[11px] font-semibold text-slate-700"
                        >
                          <div className="font-black text-slate-500">
                            {row.rowNumber}
                          </div>
                          <div className="font-mono font-black text-slate-800">
                            {row.imei || "—"}
                          </div>
                          <div>{row.brand || "—"}</div>
                          <div>{row.model || "—"}</div>
                          <div>{row.memory || "—"}</div>
                          <div>{row.color || "—"}</div>
                          <div>{row.grade || "—"}</div>
                          <div>{row.warranty || "—"}</div>
                          <div className="font-black">
                            {row.salePrice === null
                              ? "—"
                              : formatMoney(row.salePrice)}
                          </div>
                          <div className="font-black">
                            {row.listPrice === null
                              ? "—"
                              : formatMoney(row.listPrice)}
                          </div>
                          <div>
                            {row.valid ? (
                              <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-black text-emerald-700 ring-1 ring-emerald-100">
                                HAZIR
                              </span>
                            ) : (
                              <div className="text-[10px] font-bold leading-5 text-red-600">
                                {row.errors.join(" · ")}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {bulkUploadResults.length > 0 ? (
                    <div className="overflow-hidden rounded-2xl border border-slate-200">
                      <div className="grid grid-cols-[0.45fr_1.25fr_0.75fr_2.5fr] bg-slate-50 px-4 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500">
                        <div>Satır</div>
                        <div>IMEI</div>
                        <div>Durum</div>
                        <div>N11 Sonucu</div>
                      </div>

                      {bulkUploadResults.map((item) => (
                        <div
                          key={`bulk-result-${item.rowNumber}-${item.imei}`}
                          className="grid grid-cols-[0.45fr_1.25fr_0.75fr_2.5fr] items-start border-t border-slate-100 px-4 py-3 text-[11px] font-semibold text-slate-700"
                        >
                          <div className="font-black text-slate-500">
                            {item.rowNumber}
                          </div>
                          <div className="font-mono font-black text-slate-800">
                            {item.imei}
                          </div>
                          <div>
                            {item.status === "success" ? (
                              <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-black text-emerald-700 ring-1 ring-emerald-100">
                                {item.pooled ? "STOK EKLENDİ" : "GÖNDERİLDİ"}
                              </span>
                            ) : (
                              <span className="inline-flex rounded-full bg-red-50 px-3 py-1 text-[10px] font-black text-red-700 ring-1 ring-red-100">
                                HATA
                              </span>
                            )}
                          </div>
                          <div className={item.status === "success" ? "text-slate-700" : "text-red-600"}>
                            {item.message}
                            {item.n11ProductId ? ` · N11 ID: ${item.n11ProductId}` : ""}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="mx-auto max-w-3xl space-y-4 py-4">
                  <div className="rounded-3xl border border-blue-200 bg-blue-50 p-6">
                    <div className="text-[11px] font-black uppercase tracking-[0.16em] text-blue-600">
                      1. ADIM
                    </div>
                    <div className="mt-2 text-[18px] font-black text-slate-900">
                      CNETMOBİL N11 Excel şablonunu indir
                    </div>
                    <div className="mt-2 text-[12px] font-semibold leading-6 text-slate-600">
                      Başlıkları değiştirmeden cihazları doldurun. Her satır 1 fiziksel cihaz / 1 IMEI&apos;dir.
                    </div>
                    <button
                      type="button"
                      onClick={downloadBulkTemplate}
                      className="mt-4 h-11 rounded-xl bg-blue-600 px-5 text-[11px] font-black text-white hover:bg-blue-700"
                    >
                      ↓ ŞABLONU İNDİR
                    </button>
                  </div>

                  <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6">
                    <div className="text-[11px] font-black uppercase tracking-[0.16em] text-emerald-700">
                      2. ADIM
                    </div>
                    <div className="mt-2 text-[18px] font-black text-slate-900">
                      Doldurduğun Excel&apos;i geri yükle
                    </div>
                    <div className="mt-2 text-[12px] font-semibold leading-6 text-slate-600">
                      Önce tüm satırlar kontrol edilir. Hata yoksa aynı tekli ürün ekleme motoruyla N11&apos;e gönderilir.
                    </div>
                    <button
                      type="button"
                      onClick={chooseBulkExcel}
                      className="mt-4 h-11 rounded-xl bg-emerald-600 px-5 text-[11px] font-black text-white hover:bg-emerald-700"
                    >
                      ↑ DOLDURULMUŞ EXCEL&apos;İ YÜKLE
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
              <div className="text-[11px] font-semibold text-slate-500">
                Toplu yükleme, tekli ürün ekleme ile aynı /api/online/listings motorunu kullanır.
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={downloadBulkTemplate}
                  disabled={bulkLoading || bulkUploading}
                  className="h-10 rounded-xl border border-blue-200 bg-white px-4 text-[11px] font-black text-blue-700 hover:bg-blue-50 disabled:opacity-50"
                >
                  ŞABLON İNDİR
                </button>

                <button
                  type="button"
                  onClick={chooseBulkExcel}
                  disabled={bulkLoading || bulkUploading}
                  className="h-10 rounded-xl border border-slate-300 bg-white px-4 text-[11px] font-black text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                >
                  EXCEL YÜKLE
                </button>

                <button
                  type="button"
                  onClick={() => void startBulkUpload()}
                  disabled={
                    bulkLoading ||
                    bulkUploading ||
                    !bulkPreview?.canContinue ||
                    (bulkPreview?.validCount || 0) > 0 && bulkCompleted === bulkPreview?.validCount
                  }
                  className="h-10 rounded-xl bg-slate-900 px-5 text-[11px] font-black text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {bulkUploading
                    ? `N11'E GÖNDERİLİYOR ${bulkCompleted}/${bulkPreview?.validCount || 0}`
                    : bulkPreview?.canContinue
                    ? "N11'E TOPLU GÖNDER"
                    : "ÖNCE EXCEL YÜKLE"}
                </button>
              </div>
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
                    Cihaz bilgilerini ve N11 fiyatlarını girin. Ürün otomatik olarak YENİLENMİŞ statüsünde aranır ve yeni IMEI ile açılır.
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
                  <div className="md:col-span-2">
                    <div className="mb-2 text-[10px] font-black uppercase tracking-wider text-slate-500">
                      Ürün Durumu
                    </div>
                    <div className="flex h-12 w-full items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4">
                      <span className="text-[13px] font-black text-emerald-700">
                        YENİLENMİŞ
                      </span>
                      <span className="rounded-lg bg-white px-2.5 py-1 text-[10px] font-black text-slate-500 ring-1 ring-emerald-100">
                        SABİT
                      </span>
                    </div>
                  </div>

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
                      placeholder="A"
                      className="h-12 w-full rounded-xl border border-slate-200 px-4 text-[13px] font-semibold outline-none focus:border-blue-400"
                    />
                    <div className="mt-1 text-[9px] font-bold text-slate-400">
                      A → A Kalite · B → B Kalite · C → C Kalite otomatik çevrilir.
                    </div>
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
                    <div className="mt-1 text-[9px] font-bold text-slate-400">
                      12AY / 12 Ay → 12 Ay Garantili olarak otomatik kullanılır.
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
                  Ürün durumu daima YENİLENMİŞ'tir. stockCode = IMEI'dir. N11'e gönderildikten sonra bu ekran sizi bekletmeden kapanır; ürün N11 ID oluşana kadar "N11 Bekleniyor" görünür ve arka planda otomatik doğrulanır. Sıfır ürün kataloğuna bağlanmaz.
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
