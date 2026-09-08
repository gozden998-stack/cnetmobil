"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

type ApiState = {
  loading: boolean;
  success: boolean | null;
  error: string;
  data: any;
};

const emptyState = (): ApiState => ({
  loading: false,
  success: null,
  error: "",
  data: null,
});

function formatDate(
  value: unknown
) {
  if (!value) {
    return "-";
  }

  const date =
    new Date(
      String(value)
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return String(value);
  }

  return new Intl.DateTimeFormat(
    "tr-TR",
    {
      dateStyle: "short",
      timeStyle: "medium",
    }
  ).format(date);
}

function countArray(
  value: unknown
) {
  return Array.isArray(value)
    ? value.length
    : 0;
}


function objectTitle(
  value: any
) {
  if (
    !value ||
    typeof value !== "object"
  ) {
    return String(
      value ?? "-"
    );
  }

  const candidates = [
    value.name,
    value.title,
    value.label,
    value.displayName,
    value.code,
    value.value,
    value.id,
  ];

  for (
    const candidate of candidates
  ) {
    const text =
      String(
        candidate ?? ""
      ).trim();

    if (text) {
      return text;
    }
  }

  return "Kayıt";
}

function scalarEntries(
  value: any
) {
  if (
    !value ||
    typeof value !== "object"
  ) {
    return [];
  }

  return Object.entries(
    value
  )
    .filter(
      ([, item]) =>
        item === null ||
        [
          "string",
          "number",
          "boolean",
        ].includes(
          typeof item
        )
    )
    .slice(0, 8);
}

export default function Ikas() {
  const [
    connection,
    setConnection,
  ] = useState<ApiState>(
    emptyState
  );

  const [
    discovery,
    setDiscovery,
  ] = useState<ApiState>(
    emptyState
  );

  const [
    products,
    setProducts,
  ] = useState<ApiState>(
    emptyState
  );

  const [
    inventory,
    setInventory,
  ] = useState<ApiState>(
    emptyState
  );

  const [
    inventoryView,
    setInventoryView,
  ] = useState<
    "renewed" | "all"
  >("renewed");

  const [
    inventorySearch,
    setInventorySearch,
  ] = useState("");

  const [
    structure,
    setStructure,
  ] = useState<ApiState>(
    emptyState
  );

  const [
    productStructure,
    setProductStructure,
  ] = useState<ApiState>(
    emptyState
  );

  const [
    createPreview,
    setCreatePreview,
  ] = useState<ApiState>(
    emptyState
  );

  const [
    createForm,
    setCreateForm,
  ] = useState({
    imei: "",
    brand: "Apple",
    model: "",
    memory: "",
    color: "",
    grade: "A",
    warranty: "12 Ay",
    salePrice: "",
    listPrice: "",
  });

  const testConnection =
    useCallback(async () => {
      setConnection({
        loading: true,
        success: null,
        error: "",
        data: null,
      });

      try {
        const response =
          await fetch(
            "/api/online/ikas/test",
            {
              method: "GET",
              cache: "no-store",
            }
          );

        const payload =
          await response.json();

        if (
          !response.ok ||
          !payload?.success
        ) {
          throw new Error(
            payload?.error ||
              "İkas bağlantı testi başarısız."
          );
        }

        setConnection({
          loading: false,
          success: true,
          error: "",
          data: payload,
        });
      } catch (error) {
        setConnection({
          loading: false,
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "İkas bağlantı testi başarısız.",
          data: null,
        });
      }
    }, []);

  const runDiscovery =
    useCallback(async () => {
      setDiscovery({
        loading: true,
        success: null,
        error: "",
        data: null,
      });

      try {
        const response =
          await fetch(
            "/api/online/ikas/discover",
            {
              method: "GET",
              cache: "no-store",
            }
          );

        const payload =
          await response.json();

        if (
          !response.ok ||
          !payload?.success
        ) {
          throw new Error(
            payload?.error ||
              "İkas read-only keşif başarısız."
          );
        }

        setDiscovery({
          loading: false,
          success: true,
          error: "",
          data: payload,
        });
      } catch (error) {
        setDiscovery({
          loading: false,
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "İkas read-only keşif başarısız.",
          data: null,
        });
      }
    }, []);

  const loadProducts =
    useCallback(async () => {
      setProducts({
        loading: true,
        success: null,
        error: "",
        data: null,
      });

      try {
        const response =
          await fetch(
            "/api/online/ikas/products-preview",
            {
              method: "GET",
              cache: "no-store",
            }
          );

        const payload =
          await response.json();

        if (
          !response.ok ||
          !payload?.success
        ) {
          throw new Error(
            payload?.error ||
              "İkas ürünleri okunamadı."
          );
        }

        setProducts({
          loading: false,
          success: true,
          error: "",
          data: payload,
        });
      } catch (error) {
        setProducts({
          loading: false,
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "İkas ürünleri okunamadı.",
          data: null,
        });
      }
    }, []);

  const loadInventory =
    useCallback(async () => {
      setInventory({
        loading: true,
        success: null,
        error: "",
        data: null,
      });

      try {
        const response =
          await fetch(
            "/api/online/ikas/inventory",
            {
              method: "GET",
              cache: "no-store",
            }
          );

        const payload =
          await response.json();

        if (
          !response.ok ||
          !payload?.success
        ) {
          throw new Error(
            payload?.error ||
              "İkas tüm stok okunamadı."
          );
        }

        setInventory({
          loading: false,
          success: true,
          error: "",
          data: payload,
        });
      } catch (error) {
        setInventory({
          loading: false,
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "İkas tüm stok okunamadı.",
          data: null,
        });
      }
    }, []);

  const loadStructure =
    useCallback(async () => {
      setStructure({
        loading: true,
        success: null,
        error: "",
        data: null,
      });

      try {
        const response =
          await fetch(
            "/api/online/ikas/structure",
            {
              method: "GET",
              cache: "no-store",
            }
          );

        const payload =
          await response.json();

        if (
          !response.ok ||
          !payload?.success
        ) {
          throw new Error(
            payload?.error ||
              "İkas yapı bilgileri okunamadı."
          );
        }

        setStructure({
          loading: false,
          success: true,
          error: "",
          data: payload,
        });
      } catch (error) {
        setStructure({
          loading: false,
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "İkas yapı bilgileri okunamadı.",
          data: null,
        });
      }
    }, []);

  const loadProductStructure =
    useCallback(async () => {
      setProductStructure({
        loading: true,
        success: null,
        error: "",
        data: null,
      });

      try {
        const response =
          await fetch(
            "/api/online/ikas/product-structure",
            {
              method: "GET",
              cache: "no-store",
            }
          );

        const payload =
          await response.json();

        if (
          !response.ok ||
          !payload?.success
        ) {
          throw new Error(
            payload?.error ||
              "İkas ürün yapısı doğrulanamadı."
          );
        }

        setProductStructure({
          loading: false,
          success: true,
          error: "",
          data: payload,
        });
      } catch (error) {
        setProductStructure({
          loading: false,
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "İkas ürün yapısı doğrulanamadı.",
          data: null,
        });
      }
    }, []);

  const previewCreateProduct =
    useCallback(async () => {
      setCreatePreview({
        loading: true,
        success: null,
        error: "",
        data: null,
      });

      try {
        const response =
          await fetch(
            "/api/online/ikas/create-preview",
            {
              method: "POST",
              cache: "no-store",
              headers: {
                "Content-Type":
                  "application/json",
              },
              body:
                JSON.stringify(
                  createForm
                ),
            }
          );

        const payload =
          await response.json();

        if (
          !response.ok ||
          !payload?.success
        ) {
          throw new Error(
            payload?.error ||
              "İkas ürün önizlemesi hazırlanamadı."
          );
        }

        setCreatePreview({
          loading: false,
          success: true,
          error: "",
          data: payload,
        });
      } catch (error) {
        setCreatePreview({
          loading: false,
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "İkas ürün önizlemesi hazırlanamadı.",
          data: null,
        });
      }
    }, [createForm]);

  useEffect(() => {
    void testConnection();
  }, [testConnection]);

  const merchant =
    discovery.data?.merchant
      ?.data ||
    null;

  const schema =
    discovery.data?.schema ||
    null;

  const queryFields =
    Array.isArray(
      schema?.queryFields
    )
      ? schema.queryFields
      : [];

  const typeNames =
    Array.isArray(
      schema?.relevantTypeNames
    )
      ? schema.relevantTypeNames
      : [];

  const productQueryCount =
    useMemo(
      () =>
        queryFields.filter(
          (item: any) =>
            String(
              item?.name || ""
            )
              .toLowerCase()
              .includes(
                "product"
              )
        ).length,
      [queryFields]
    );

  const stockQueryCount =
    useMemo(
      () =>
        queryFields.filter(
          (item: any) => {
            const name =
              String(
                item?.name || ""
              ).toLowerCase();

            return (
              name.includes(
                "stock"
              ) ||
              name.includes(
                "inventory"
              ) ||
              name.includes(
                "warehouse"
              )
            );
          }
        ).length,
      [queryFields]
    );

  const orderQueryCount =
    useMemo(
      () =>
        queryFields.filter(
          (item: any) =>
            String(
              item?.name || ""
            )
              .toLowerCase()
              .includes(
                "order"
              )
        ).length,
      [queryFields]
    );

  const connectionOk =
    connection.success ===
    true;

  const inventoryProducts =
    useMemo(() => {
      const source =
        inventoryView ===
        "renewed"
          ? inventory.data
              ?.renewedProducts
          : inventory.data
              ?.allProducts;

      const list =
        Array.isArray(source)
          ? source
          : [];

      const search =
        inventorySearch
          .trim()
          .toLocaleLowerCase(
            "tr-TR"
          );

      if (!search) {
        return list;
      }

      return list.filter(
        (product: any) => {
          const text = [
            product?.name,
            product?.brand
              ?.name,
            ...(Array.isArray(
              product?.variants
            )
              ? product.variants.map(
                  (variant: any) =>
                    variant?.sku
                )
              : []),
          ]
            .join(" ")
            .toLocaleLowerCase(
              "tr-TR"
            );

          return text.includes(
            search
          );
        }
      );
    }, [
      inventory.data,
      inventoryView,
      inventorySearch,
    ]);

  return (
    <div className="animate-in fade-in duration-300">
      <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-gradient-to-r from-violet-950 via-slate-950 to-slate-900 px-6 py-7 text-white sm:px-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-[9px] font-black uppercase tracking-[0.22em] text-violet-200/75">
                Entegrasyonlar / İkas
              </div>

              <h2 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">
                İkas Entegrasyonu
              </h2>

              <p className="mt-2 max-w-2xl text-[11px] font-semibold leading-5 text-slate-300">
                Yenilenmiş cihazlarda ürün, varyant, stok, IMEI havuzu ve sipariş yönetimi için İkas bağlantısı.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full border px-3 py-1.5 text-[9px] font-black uppercase tracking-wide ${
                  connection.loading
                    ? "border-sky-300/20 bg-sky-400/10 text-sky-200"
                    : connectionOk
                    ? "border-emerald-300/20 bg-emerald-400/10 text-emerald-200"
                    : "border-rose-300/20 bg-rose-400/10 text-rose-200"
                }`}
              >
                {connection.loading
                  ? "Bağlantı Kontrol Ediliyor"
                  : connectionOk
                  ? "API Bağlı"
                  : "API Bağlantısı Yok"}
              </span>

              <button
                type="button"
                onClick={() => {
                  void testConnection();
                }}
                disabled={
                  connection.loading
                }
                className="rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-[9px] font-black uppercase tracking-wide text-white transition hover:bg-white/15 disabled:cursor-wait disabled:opacity-60"
              >
                {connection.loading
                  ? "Kontrol..."
                  : "Bağlantıyı Test Et"}
              </button>

              <button
                type="button"
                onClick={() => {
                  void runDiscovery();
                }}
                disabled={
                  discovery.loading ||
                  !connectionOk
                }
                className="rounded-xl bg-violet-500 px-4 py-2 text-[9px] font-black uppercase tracking-wide text-white transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {discovery.loading
                  ? "Keşif Yapılıyor..."
                  : "Read Only Keşif"}
              </button>
            </div>
          </div>
        </div>

        <div className="p-5 sm:p-6">
          {connection.error && (
            <div className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-[10px] font-bold text-rose-700">
              {connection.error}
            </div>
          )}

          {discovery.error && (
            <div className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-[10px] font-bold text-rose-700">
              {discovery.error}
            </div>
          )}

          {products.error && (
            <div className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-[10px] font-bold text-rose-700">
              {products.error}
            </div>
          )}

          {inventory.error && (
            <div className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-[10px] font-bold text-rose-700">
              {inventory.error}
            </div>
          )}

          {structure.error && (
            <div className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-[10px] font-bold text-rose-700">
              {structure.error}
            </div>
          )}

          {productStructure.error && (
            <div className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-[10px] font-bold text-rose-700">
              {productStructure.error}
            </div>
          )}

          {createPreview.error && (
            <div className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-[10px] font-bold text-rose-700">
              {createPreview.error}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
              <div className="text-[8px] font-black uppercase tracking-[0.18em] text-slate-400">
                API Durumu
              </div>
              <div
                className={`mt-2 text-lg font-black ${
                  connectionOk
                    ? "text-emerald-600"
                    : "text-slate-800"
                }`}
              >
                {connection.loading
                  ? "Kontrol..."
                  : connectionOk
                  ? "Bağlı"
                  : "Bekliyor"}
              </div>
              <div className="mt-1 text-[9px] font-semibold text-slate-400">
                Admin API v2
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="text-[8px] font-black uppercase tracking-[0.18em] text-slate-400">
                Merchant
              </div>
              <div className="mt-2 truncate text-lg font-black text-slate-900">
                {merchant?.merchantName ||
                  connection.data?.ikas
                    ?.merchantId ||
                  "-"}
              </div>
              <div className="mt-1 text-[9px] font-semibold text-slate-400">
                {merchant?.currencyCode ||
                  "İkas mağazası"}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="text-[8px] font-black uppercase tracking-[0.18em] text-slate-400">
                Keşfedilen Query
              </div>
              <div className="mt-2 text-lg font-black text-slate-900">
                {queryFields.length}
              </div>
              <div className="mt-1 text-[9px] font-semibold text-slate-400">
                Ürün / stok / sipariş alanları
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="text-[8px] font-black uppercase tracking-[0.18em] text-slate-400">
                Son Kontrol
              </div>
              <div className="mt-2 text-sm font-black text-slate-900">
                {formatDate(
                  discovery.data
                    ?.checkedAt ||
                    connection.data
                      ?.checkedAt
                )}
              </div>
              <div className="mt-1 text-[9px] font-semibold text-slate-400">
                Canlı API
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            <div
              className={`rounded-2xl border p-5 ${
                connectionOk
                  ? "border-emerald-200 bg-emerald-50/60"
                  : "border-slate-200 bg-slate-50"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[9px] font-black uppercase tracking-[0.18em] text-emerald-600">
                    ADIM 1
                  </div>
                  <div className="mt-2 text-base font-black text-slate-900">
                    API Bağlantısı
                  </div>
                </div>

                <span className="rounded-full bg-white px-2.5 py-1 text-[8px] font-black uppercase text-emerald-700 shadow-sm">
                  {connectionOk
                    ? "Tamam"
                    : "Bekliyor"}
                </span>
              </div>

              <p className="mt-3 text-[10px] font-semibold leading-5 text-slate-500">
                Client ID ve Client Secret yalnızca Coolify ENV üzerinde tutulur.
              </p>
            </div>

            <div
              className={`rounded-2xl border p-5 ${
                discovery.success
                  ? "border-blue-200 bg-blue-50/60"
                  : "border-slate-200 bg-white"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[9px] font-black uppercase tracking-[0.18em] text-blue-600">
                    ADIM 2
                  </div>
                  <div className="mt-2 text-base font-black text-slate-900">
                    Read Only Keşif
                  </div>
                </div>

                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[8px] font-black uppercase text-slate-600">
                  {discovery.loading
                    ? "Çalışıyor"
                    : discovery.success
                    ? "Tamam"
                    : "Hazır"}
                </span>
              </div>

              <p className="mt-3 text-[10px] font-semibold leading-5 text-slate-500">
                İkas GraphQL şemasındaki ürün, varyant, stok, kategori ve sipariş alanlarını okur.
              </p>
            </div>

            <div
              className={`rounded-2xl border p-5 ${
                inventory.success
                  ? "border-violet-200 bg-violet-50/60"
                  : "border-slate-200 bg-white"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[9px] font-black uppercase tracking-[0.18em] text-violet-600">
                    ADIM 3
                  </div>
                  <div className="mt-2 text-base font-black text-slate-900">
                    Tüm Stok + Yenilenmiş
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    void loadInventory();
                  }}
                  disabled={
                    inventory.loading ||
                    !discovery.success
                  }
                  className="rounded-xl bg-violet-600 px-3 py-2 text-[8px] font-black uppercase tracking-wide text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {inventory.loading
                    ? "Tüm Stok Çekiliyor..."
                    : inventory.success
                    ? "Stoku Yenile"
                    : "Tüm Stoku Çek"}
                </button>
              </div>

              <p className="mt-3 text-[10px] font-semibold leading-5 text-slate-500">
                İkas'taki bütün ürünleri sayfa sayfa çeker; yenilenmiş cihazları ayrıca ayırır. SKU, varyant, fiyat ve lokasyon bazlı stokları read-only okur.
              </p>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-cyan-200 bg-cyan-50/50 p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="text-[9px] font-black uppercase tracking-[0.18em] text-cyan-700">
                  ADIM 3.2
                </div>

                <div className="mt-2 text-base font-black text-slate-900">
                  Lokasyon + Fiyat + Grade / Garanti Yapısı
                </div>

                <p className="mt-2 max-w-3xl text-[10px] font-semibold leading-5 text-slate-500">
                  Stok lokasyonlarının gerçek isimlerini, fiyat listelerini ve İkas Product Attribute alanlarını read-only okuyacağız.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  void loadStructure();
                }}
                disabled={
                  structure.loading ||
                  !inventory.success
                }
                className="w-fit rounded-xl bg-cyan-700 px-4 py-2.5 text-[8px] font-black uppercase tracking-wide text-white transition hover:bg-cyan-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {structure.loading
                  ? "Yapı Okunuyor..."
                  : structure.success
                  ? "Yapıyı Yenile"
                  : "Yapıyı Oku"}
              </button>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-fuchsia-200 bg-fuchsia-50/50 p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="text-[9px] font-black uppercase tracking-[0.18em] text-fuchsia-700">
                  ADIM 3.3
                </div>

                <div className="mt-2 text-base font-black text-slate-900">
                  Yenilenmiş Ürün Yapısını Doğrula
                </div>

                <p className="mt-2 max-w-3xl text-[10px] font-semibold leading-5 text-slate-500">
                  Canlı İkas hesabından stoklu bir yenilenmiş ürün seçip marka, kategori, varyant, fiyat, stok lokasyonu ve satış kanalı yapısını kesinleştirir.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  void loadProductStructure();
                }}
                disabled={
                  productStructure.loading ||
                  !structure.success
                }
                className="w-fit rounded-xl bg-fuchsia-700 px-4 py-2.5 text-[8px] font-black uppercase tracking-wide text-white transition hover:bg-fuchsia-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {productStructure.loading
                  ? "Doğrulanıyor..."
                  : productStructure.success
                  ? "Tekrar Doğrula"
                  : "Ürün Yapısını Doğrula"}
              </button>
            </div>
          </div>

          <div className="mt-4 overflow-hidden rounded-2xl border border-indigo-200 bg-white">
            <div className="border-b border-indigo-100 bg-indigo-50/60 px-5 py-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="text-[9px] font-black uppercase tracking-[0.18em] text-indigo-700">
                    ADIM 4.0 — DRY RUN
                  </div>

                  <div className="mt-1 text-base font-black text-slate-900">
                    Yenilenmiş Ürün Ekleme Önizlemesi
                  </div>

                  <div className="mt-1 text-[9px] font-semibold text-slate-500">
                    Form gerçek createProduct payload'ını hazırlar ama İkas'a HİÇBİR ürün göndermez.
                  </div>
                </div>

                <span className="w-fit rounded-full bg-white px-3 py-1.5 text-[8px] font-black uppercase text-indigo-700 ring-1 ring-indigo-200">
                  Dry Run — Ürün Göndermez
                </span>
              </div>
            </div>

            <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-5">
              <label className="block">
                <span className="text-[8px] font-black uppercase tracking-wide text-slate-500">
                  IMEI
                </span>
                <input
                  value={createForm.imei}
                  onChange={(event) =>
                    setCreateForm(
                      (current) => ({
                        ...current,
                        imei:
                          event.target.value
                            .replace(/\D/g, "")
                            .slice(0, 15),
                      })
                    )
                  }
                  placeholder="15 haneli IMEI"
                  inputMode="numeric"
                  className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-[10px] font-bold text-slate-800 outline-none transition focus:border-indigo-400"
                />
              </label>

              <label className="block">
                <span className="text-[8px] font-black uppercase tracking-wide text-slate-500">
                  Marka
                </span>
                <input
                  value={createForm.brand}
                  onChange={(event) =>
                    setCreateForm(
                      (current) => ({
                        ...current,
                        brand:
                          event.target.value,
                      })
                    )
                  }
                  placeholder="Apple"
                  className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-[10px] font-bold text-slate-800 outline-none transition focus:border-indigo-400"
                />
              </label>

              <label className="block">
                <span className="text-[8px] font-black uppercase tracking-wide text-slate-500">
                  Model
                </span>
                <input
                  value={createForm.model}
                  onChange={(event) =>
                    setCreateForm(
                      (current) => ({
                        ...current,
                        model:
                          event.target.value,
                      })
                    )
                  }
                  placeholder="iPhone 13"
                  className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-[10px] font-bold text-slate-800 outline-none transition focus:border-indigo-400"
                />
              </label>

              <label className="block">
                <span className="text-[8px] font-black uppercase tracking-wide text-slate-500">
                  Hafıza
                </span>
                <input
                  value={createForm.memory}
                  onChange={(event) =>
                    setCreateForm(
                      (current) => ({
                        ...current,
                        memory:
                          event.target.value,
                      })
                    )
                  }
                  placeholder="128GB"
                  className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-[10px] font-bold text-slate-800 outline-none transition focus:border-indigo-400"
                />
              </label>

              <label className="block">
                <span className="text-[8px] font-black uppercase tracking-wide text-slate-500">
                  Renk
                </span>
                <input
                  value={createForm.color}
                  onChange={(event) =>
                    setCreateForm(
                      (current) => ({
                        ...current,
                        color:
                          event.target.value,
                      })
                    )
                  }
                  placeholder="Siyah"
                  className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-[10px] font-bold text-slate-800 outline-none transition focus:border-indigo-400"
                />
              </label>

              <label className="block">
                <span className="text-[8px] font-black uppercase tracking-wide text-slate-500">
                  Grade
                </span>
                <select
                  value={createForm.grade}
                  onChange={(event) =>
                    setCreateForm(
                      (current) => ({
                        ...current,
                        grade:
                          event.target.value,
                      })
                    )
                  }
                  className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-[10px] font-bold text-slate-800 outline-none transition focus:border-indigo-400"
                >
                  <option value="A">
                    A — Mükemmel
                  </option>
                  <option value="B">
                    B — Çok İyi
                  </option>
                  <option value="C">
                    C — İyi
                  </option>
                </select>
              </label>

              <label className="block">
                <span className="text-[8px] font-black uppercase tracking-wide text-slate-500">
                  Garanti
                </span>
                <select
                  value={createForm.warranty}
                  onChange={(event) =>
                    setCreateForm(
                      (current) => ({
                        ...current,
                        warranty:
                          event.target.value,
                      })
                    )
                  }
                  className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-[10px] font-bold text-slate-800 outline-none transition focus:border-indigo-400"
                >
                  <option value="3 Ay">3 Ay</option>
                  <option value="6 Ay">6 Ay</option>
                  <option value="12 Ay">12 Ay</option>
                  <option value="18 Ay">18 Ay</option>
                  <option value="24 Ay">24 Ay</option>
                </select>
              </label>

              <label className="block">
                <span className="text-[8px] font-black uppercase tracking-wide text-slate-500">
                  Satış Fiyatı
                </span>
                <input
                  value={createForm.salePrice}
                  onChange={(event) =>
                    setCreateForm(
                      (current) => ({
                        ...current,
                        salePrice:
                          event.target.value,
                      })
                    )
                  }
                  placeholder="34999"
                  inputMode="decimal"
                  className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-[10px] font-bold text-slate-800 outline-none transition focus:border-indigo-400"
                />
              </label>

              <label className="block">
                <span className="text-[8px] font-black uppercase tracking-wide text-slate-500">
                  Liste Fiyatı
                </span>
                <input
                  value={createForm.listPrice}
                  onChange={(event) =>
                    setCreateForm(
                      (current) => ({
                        ...current,
                        listPrice:
                          event.target.value,
                      })
                    )
                  }
                  placeholder="36999"
                  inputMode="decimal"
                  className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-[10px] font-bold text-slate-800 outline-none transition focus:border-indigo-400"
                />
              </label>

              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => {
                    void previewCreateProduct();
                  }}
                  disabled={
                    createPreview.loading
                  }
                  className="h-10 w-full rounded-xl bg-indigo-700 px-4 text-[8px] font-black uppercase tracking-wide text-white transition hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {createPreview.loading
                    ? "Taslak Hazırlanıyor..."
                    : "Payload Önizle"}
                </button>
              </div>
            </div>

            {createPreview.success && (
              <div className="border-t border-indigo-100 bg-indigo-50/30 p-5">
                <div className="grid gap-3 lg:grid-cols-3">
                  <div className="rounded-xl border border-indigo-100 bg-white p-4">
                    <div className="text-[8px] font-black uppercase tracking-wide text-slate-400">
                      Oluşacak Başlık
                    </div>
                    <div className="mt-2 text-[11px] font-black text-slate-900">
                      {createPreview.data?.derived?.title || "-"}
                    </div>
                  </div>

                  <div className="rounded-xl border border-indigo-100 bg-white p-4">
                    <div className="text-[8px] font-black uppercase tracking-wide text-slate-400">
                      Master SKU
                    </div>
                    <div className="mt-2 break-all text-[11px] font-black text-indigo-700">
                      {createPreview.data?.derived?.sku || "-"}
                    </div>
                  </div>

                  <div className="rounded-xl border border-indigo-100 bg-white p-4">
                    <div className="text-[8px] font-black uppercase tracking-wide text-slate-400">
                      Referans İkas Ürünü
                    </div>
                    <div className="mt-2 text-[11px] font-black text-slate-900">
                      {createPreview.data?.derived?.referenceProduct?.name || "Eşleşme yok"}
                    </div>
                    <div className="mt-1 text-[8px] font-bold text-slate-400">
                      Skor: {createPreview.data?.derived?.referenceProduct?.score ?? "-"}
                    </div>
                  </div>
                </div>

                <div className="mt-3 grid gap-3 lg:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 bg-slate-950 p-4">
                    <div className="text-[8px] font-black uppercase tracking-wide text-indigo-300">
                      CreateProduct Payload
                    </div>
                    <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap text-[8px] font-semibold leading-4 text-slate-200">
                      {JSON.stringify(
                        createPreview.data?.createProductPayloadPreview?.variables?.input ?? {},
                        null,
                        2
                      )}
                    </pre>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-[8px] font-black uppercase tracking-wide text-slate-500">
                        Mevcut Benzer Ürünler
                      </div>

                      <span className="rounded-full bg-slate-100 px-2 py-1 text-[7px] font-black uppercase text-slate-600">
                        {createPreview.data?.derived?.duplicateCandidateCount ?? 0} aday
                      </span>
                    </div>

                    <div className="mt-3 max-h-72 space-y-2 overflow-auto">
                      {(Array.isArray(
                        createPreview.data?.duplicateCandidates
                      )
                        ? createPreview.data.duplicateCandidates
                        : []
                      ).map(
                        (item: any, index: number) => (
                          <div
                            key={item?.id || index}
                            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                          >
                            <div className="text-[9px] font-black text-slate-800">
                              {item?.name || "-"}
                            </div>

                            <div className="mt-1 break-all text-[7px] font-bold text-slate-400">
                              {item?.id || "-"}
                            </div>
                          </div>
                        )
                      )}

                      {(!Array.isArray(
                        createPreview.data?.duplicateCandidates
                      ) ||
                        createPreview.data.duplicateCandidates.length === 0) && (
                        <div className="rounded-lg border border-dashed border-slate-200 px-3 py-6 text-center text-[8px] font-bold text-slate-400">
                          Aynı modele yakın mevcut ürün bulunamadı.
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[9px] font-black text-emerald-700">
                  GÜVENLİ MOD: Ürün oluşturulmadı. Stok ve fiyat değiştirilmedi.
                </div>
              </div>
            )}
          </div>

          {discovery.success && (
            <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
              <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">
                    Read Only Keşif Sonucu
                  </div>
                  <div className="mt-1 text-[10px] font-semibold text-slate-400">
                    Hiçbir ürün veya stok değiştirilmedi.
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full bg-blue-100 px-2.5 py-1 text-[8px] font-black uppercase text-blue-700">
                    Ürün Query: {productQueryCount}
                  </span>
                  <span className="rounded-full bg-violet-100 px-2.5 py-1 text-[8px] font-black uppercase text-violet-700">
                    Stok Query: {stockQueryCount}
                  </span>
                  <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[8px] font-black uppercase text-amber-700">
                    Sipariş Query: {orderQueryCount}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[8px] font-black uppercase text-slate-600">
                    Tip: {countArray(typeNames)}
                  </span>
                </div>
              </div>

              <div className="grid gap-px bg-slate-200 sm:grid-cols-2 xl:grid-cols-3">
                {queryFields
                  .slice(0, 18)
                  .map(
                    (
                      field: any,
                      index: number
                    ) => (
                      <div
                        key={`${field?.name || "field"}-${index}`}
                        className="bg-white px-5 py-4"
                      >
                        <div className="truncate text-[10px] font-black text-slate-800">
                          {field?.name || "-"}
                        </div>
                        <div className="mt-1 truncate text-[8px] font-semibold text-slate-400">
                          {field?.returnType || "-"}
                        </div>
                      </div>
                    )
                  )}
              </div>
            </div>
          )}


          {structure.success && (
            <div className="mt-5 overflow-hidden rounded-2xl border border-cyan-200 bg-white">
              <div className="border-b border-cyan-100 bg-cyan-50/60 px-5 py-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="text-[9px] font-black uppercase tracking-[0.18em] text-cyan-700">
                      İkas Yapı Analizi
                    </div>

                    <div className="mt-1 text-[10px] font-semibold text-slate-500">
                      Sadece okunmuştur. Ürün, stok, fiyat veya attribute değiştirilmedi.
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-white px-2.5 py-1 text-[8px] font-black uppercase text-cyan-700 ring-1 ring-cyan-200">
                      Lokasyon: {structure.data?.analysis?.stockLocationCount ?? 0}
                    </span>

                    <span className="rounded-full bg-white px-2.5 py-1 text-[8px] font-black uppercase text-blue-700 ring-1 ring-blue-200">
                      Fiyat Listesi: {structure.data?.analysis?.priceListCount ?? 0}
                    </span>

                    <span className="rounded-full bg-white px-2.5 py-1 text-[8px] font-black uppercase text-violet-700 ring-1 ring-violet-200">
                      Attribute: {structure.data?.analysis?.productAttributeCount ?? 0}
                    </span>

                    <span className="rounded-full bg-white px-2.5 py-1 text-[8px] font-black uppercase text-emerald-700 ring-1 ring-emerald-200">
                      Grade Adayı: {structure.data?.analysis?.gradeCandidateCount ?? 0}
                    </span>

                    <span className="rounded-full bg-white px-2.5 py-1 text-[8px] font-black uppercase text-amber-700 ring-1 ring-amber-200">
                      Garanti Adayı: {structure.data?.analysis?.warrantyCandidateCount ?? 0}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid gap-px bg-slate-200 xl:grid-cols-3">
                <div className="bg-white p-5">
                  <div className="mb-3 text-[9px] font-black uppercase tracking-[0.16em] text-slate-500">
                    Stok Lokasyonları
                  </div>

                  <div className="space-y-2">
                    {(Array.isArray(
                      structure.data?.stockLocations?.data
                    )
                      ? structure.data.stockLocations.data
                      : []
                    ).map(
                      (item: any, index: number) => (
                        <div
                          key={item?.id || index}
                          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3"
                        >
                          <div className="text-[10px] font-black text-slate-800">
                            {objectTitle(item)}
                          </div>

                          <div className="mt-1 space-y-0.5">
                            {scalarEntries(item).map(
                              ([key, value]) => (
                                <div
                                  key={key}
                                  className="flex items-start justify-between gap-3 text-[7px] font-bold text-slate-400"
                                >
                                  <span>{key}</span>
                                  <span className="max-w-[65%] break-all text-right text-slate-600">
                                    {String(value ?? "-")}
                                  </span>
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      )
                    )}

                    {(!Array.isArray(
                      structure.data?.stockLocations?.data
                    ) ||
                      structure.data.stockLocations.data.length === 0) && (
                      <div className="rounded-xl border border-dashed border-slate-200 px-3 py-6 text-center text-[9px] font-bold text-slate-400">
                        Lokasyon verisi bulunamadı.
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-white p-5">
                  <div className="mb-3 text-[9px] font-black uppercase tracking-[0.16em] text-slate-500">
                    Fiyat Listeleri
                  </div>

                  <div className="space-y-2">
                    {(Array.isArray(
                      structure.data?.priceLists?.data
                    )
                      ? structure.data.priceLists.data
                      : []
                    ).map(
                      (item: any, index: number) => (
                        <div
                          key={item?.id || index}
                          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3"
                        >
                          <div className="text-[10px] font-black text-slate-800">
                            {objectTitle(item)}
                          </div>

                          <div className="mt-1 space-y-0.5">
                            {scalarEntries(item).map(
                              ([key, value]) => (
                                <div
                                  key={key}
                                  className="flex items-start justify-between gap-3 text-[7px] font-bold text-slate-400"
                                >
                                  <span>{key}</span>
                                  <span className="max-w-[65%] break-all text-right text-slate-600">
                                    {String(value ?? "-")}
                                  </span>
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      )
                    )}

                    {(!Array.isArray(
                      structure.data?.priceLists?.data
                    ) ||
                      structure.data.priceLists.data.length === 0) && (
                      <div className="rounded-xl border border-dashed border-slate-200 px-3 py-6 text-center text-[9px] font-bold text-slate-400">
                        Fiyat listesi verisi bulunamadı.
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-white p-5">
                  <div className="mb-3 text-[9px] font-black uppercase tracking-[0.16em] text-slate-500">
                    Product Attribute
                  </div>

                  <div className="max-h-[520px] space-y-2 overflow-y-auto pr-1">
                    {(Array.isArray(
                      structure.data?.productAttributes?.data
                    )
                      ? structure.data.productAttributes.data
                      : []
                    ).map(
                      (item: any, index: number) => (
                        <div
                          key={item?.id || index}
                          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3"
                        >
                          <div className="text-[10px] font-black text-slate-800">
                            {objectTitle(item)}
                          </div>

                          <div className="mt-1 space-y-0.5">
                            {scalarEntries(item).map(
                              ([key, value]) => (
                                <div
                                  key={key}
                                  className="flex items-start justify-between gap-3 text-[7px] font-bold text-slate-400"
                                >
                                  <span>{key}</span>
                                  <span className="max-w-[65%] break-all text-right text-slate-600">
                                    {String(value ?? "-")}
                                  </span>
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      )
                    )}

                    {(!Array.isArray(
                      structure.data?.productAttributes?.data
                    ) ||
                      structure.data.productAttributes.data.length === 0) && (
                      <div className="rounded-xl border border-dashed border-slate-200 px-3 py-6 text-center text-[9px] font-bold text-slate-400">
                        Product Attribute verisi bulunamadı.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid gap-px border-t border-slate-200 bg-slate-200 lg:grid-cols-2">
                <div className="bg-emerald-50/60 p-5">
                  <div className="text-[9px] font-black uppercase tracking-[0.16em] text-emerald-700">
                    Grade / Kalite Adayları
                  </div>

                  <pre className="mt-3 max-h-52 overflow-auto whitespace-pre-wrap rounded-xl border border-emerald-100 bg-white p-3 text-[8px] font-semibold leading-4 text-slate-600">
                    {JSON.stringify(
                      structure.data?.analysis?.gradeCandidates ?? [],
                      null,
                      2
                    )}
                  </pre>
                </div>

                <div className="bg-amber-50/60 p-5">
                  <div className="text-[9px] font-black uppercase tracking-[0.16em] text-amber-700">
                    Garanti Adayları
                  </div>

                  <pre className="mt-3 max-h-52 overflow-auto whitespace-pre-wrap rounded-xl border border-amber-100 bg-white p-3 text-[8px] font-semibold leading-4 text-slate-600">
                    {JSON.stringify(
                      structure.data?.analysis?.warrantyCandidates ?? [],
                      null,
                      2
                    )}
                  </pre>
                </div>
              </div>
            </div>
          )}

          {productStructure.success && (
            <div className="mt-5 overflow-hidden rounded-2xl border border-fuchsia-200 bg-white">
              <div className="border-b border-fuchsia-100 bg-fuchsia-50/60 px-5 py-4">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                  <div>
                    <div className="text-[9px] font-black uppercase tracking-[0.18em] text-fuchsia-700">
                      Doğrulanan Yenilenmiş Ürün
                    </div>

                    <div className="mt-1 text-[14px] font-black text-slate-900">
                      {productStructure.data?.sampleProduct?.name || "Ürün bulunamadı"}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-white px-2.5 py-1 text-[8px] font-black uppercase text-fuchsia-700 ring-1 ring-fuchsia-200">
                      Varyant: {productStructure.data?.analysis?.variantCount ?? 0}
                    </span>

                    <span className="rounded-full bg-white px-2.5 py-1 text-[8px] font-black uppercase text-blue-700 ring-1 ring-blue-200">
                      Fiyat Satırı: {productStructure.data?.analysis?.priceRowCount ?? 0}
                    </span>

                    <span className="rounded-full bg-white px-2.5 py-1 text-[8px] font-black uppercase text-emerald-700 ring-1 ring-emerald-200">
                      Stok Satırı: {productStructure.data?.analysis?.stockRowCount ?? 0}
                    </span>

                    <span className="rounded-full bg-white px-2.5 py-1 text-[8px] font-black uppercase text-cyan-700 ring-1 ring-cyan-200">
                      Satış Kanalı: {productStructure.data?.analysis?.salesChannelCount ?? 0}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid gap-px bg-slate-200 xl:grid-cols-4">
                <div className="bg-white p-5">
                  <div className="text-[8px] font-black uppercase tracking-[0.16em] text-slate-400">
                    Marka
                  </div>

                  <div className="mt-2 text-[12px] font-black text-slate-900">
                    {productStructure.data?.analysis?.brandName || "-"}
                  </div>

                  <div className="mt-1 break-all text-[7px] font-bold text-slate-400">
                    {productStructure.data?.analysis?.brandId || "-"}
                  </div>
                </div>

                <div className="bg-white p-5">
                  <div className="text-[8px] font-black uppercase tracking-[0.16em] text-slate-400">
                    Kategori
                  </div>

                  <div className="mt-2 space-y-1">
                    {(Array.isArray(
                      productStructure.data?.analysis?.categories
                    )
                      ? productStructure.data.analysis.categories
                      : []
                    ).map(
                      (category: any, index: number) => (
                        <div
                          key={category?.id || index}
                          className="rounded-lg bg-slate-50 px-2.5 py-2"
                        >
                          <div className="text-[9px] font-black text-slate-800">
                            {category?.name || "-"}
                          </div>

                          <div className="mt-0.5 break-all text-[7px] font-bold text-slate-400">
                            {category?.id || "-"}
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </div>

                <div className="bg-white p-5">
                  <div className="text-[8px] font-black uppercase tracking-[0.16em] text-slate-400">
                    Stok Lokasyonu
                  </div>

                  <div className="mt-2 space-y-1">
                    {(Array.isArray(
                      productStructure.data?.stockLocations?.data
                    )
                      ? productStructure.data.stockLocations.data
                      : []
                    ).map(
                      (item: any, index: number) => (
                        <div
                          key={item?.id || index}
                          className="rounded-lg bg-slate-50 px-2.5 py-2"
                        >
                          <div className="text-[9px] font-black text-slate-800">
                            {item?.name || item?.title || item?.id || "-"}
                          </div>

                          <div className="mt-0.5 break-all text-[7px] font-bold text-slate-400">
                            {item?.id || "-"}
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </div>

                <div className="bg-white p-5">
                  <div className="text-[8px] font-black uppercase tracking-[0.16em] text-slate-400">
                    Satış Kanalları
                  </div>

                  <div className="mt-2 space-y-1">
                    {(Array.isArray(
                      productStructure.data?.salesChannels?.data
                    )
                      ? productStructure.data.salesChannels.data
                      : []
                    ).map(
                      (channel: any, index: number) => (
                        <div
                          key={channel?.id || index}
                          className="rounded-lg bg-slate-50 px-2.5 py-2"
                        >
                          <div className="text-[9px] font-black text-slate-800">
                            {channel?.name || channel?.title || channel?.id || "-"}
                          </div>

                          <div className="mt-0.5 break-all text-[7px] font-bold text-slate-400">
                            {channel?.id || "-"}
                          </div>
                        </div>
                      )
                    )}

                    {(!Array.isArray(
                      productStructure.data?.salesChannels?.data
                    ) ||
                      productStructure.data.salesChannels.data.length === 0) && (
                      <div className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-center text-[8px] font-bold text-slate-400">
                        Satış kanalı verisi gelmedi.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-200">
                <div className="border-b border-slate-100 bg-slate-50 px-5 py-3">
                  <div className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-500">
                    Varyant / Fiyat / Stok
                  </div>
                </div>

                <div className="divide-y divide-slate-100">
                  {(Array.isArray(
                    productStructure.data?.sampleProduct?.variants
                  )
                    ? productStructure.data.sampleProduct.variants
                    : []
                  ).map(
                    (variant: any, index: number) => (
                      <div
                        key={variant?.id || index}
                        className="grid gap-4 px-5 py-4 lg:grid-cols-[1.2fr_1fr_1fr]"
                      >
                        <div>
                          <div className="text-[9px] font-black text-slate-900">
                            SKU: {variant?.sku || "-"}
                          </div>

                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {(Array.isArray(
                              variant?.variantValues
                            )
                              ? variant.variantValues
                              : []
                            ).map(
                              (value: any, valueIndex: number) => (
                                <span
                                  key={`${value?.variantTypeName || "tip"}-${valueIndex}`}
                                  className="rounded-full bg-slate-100 px-2 py-1 text-[8px] font-bold text-slate-600"
                                >
                                  {value?.variantTypeName || "Özellik"}:{" "}
                                  {value?.variantValueName || "-"}
                                </span>
                              )
                            )}
                          </div>
                        </div>

                        <div>
                          <div className="text-[8px] font-black uppercase tracking-wide text-blue-600">
                            Fiyat
                          </div>

                          <div className="mt-2 space-y-1">
                            {(Array.isArray(
                              variant?.prices
                            )
                              ? variant.prices
                              : []
                            ).map(
                              (price: any, priceIndex: number) => (
                                <div
                                  key={`${price?.priceListId || "default"}-${priceIndex}`}
                                  className="rounded-lg border border-blue-100 bg-blue-50/50 px-2.5 py-2 text-[8px] font-bold text-slate-600"
                                >
                                  <div>
                                    Satış: {String(price?.sellPrice ?? "-")}
                                  </div>
                                  <div>
                                    İndirim: {String(price?.discountPrice ?? "-")}
                                  </div>
                                  <div className="mt-1 break-all text-[7px] text-slate-400">
                                    PriceList: {String(price?.priceListId ?? "-")}
                                  </div>
                                </div>
                              )
                            )}

                            {(!Array.isArray(
                              variant?.prices
                            ) ||
                              variant.prices.length === 0) && (
                              <div className="text-[8px] font-bold text-slate-400">
                                Fiyat satırı yok
                              </div>
                            )}
                          </div>
                        </div>

                        <div>
                          <div className="text-[8px] font-black uppercase tracking-wide text-emerald-600">
                            Stok
                          </div>

                          <div className="mt-2 space-y-1">
                            {(Array.isArray(
                              variant?.stocks
                            )
                              ? variant.stocks
                              : []
                            ).map(
                              (stock: any, stockIndex: number) => (
                                <div
                                  key={stock?.id || stockIndex}
                                  className="rounded-lg border border-emerald-100 bg-emerald-50/50 px-2.5 py-2"
                                >
                                  <div className="text-[8px] font-black text-slate-700">
                                    {stock?.stockLocationName || "Lokasyon"}
                                  </div>

                                  <div className="mt-1 text-[11px] font-black text-emerald-700">
                                    {stock?.stockCount ?? 0} adet
                                  </div>

                                  <div className="mt-1 break-all text-[7px] font-bold text-slate-400">
                                    {stock?.stockLocationId || "-"}
                                  </div>
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  )}
                </div>
              </div>
            </div>
          )}

          {inventory.success && (
            <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
              <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                  <div>
                    <div className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">
                      İkas Canlı Stok
                    </div>
                    <div className="mt-1 text-[10px] font-semibold text-slate-400">
                      Tüm katalog çekildi. Yenilenmiş ürün görünümü varsayılan olarak seçili.
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setInventoryView(
                          "renewed"
                        )
                      }
                      className={`rounded-xl px-3 py-2 text-[8px] font-black uppercase tracking-wide transition ${
                        inventoryView ===
                        "renewed"
                          ? "bg-violet-600 text-white"
                          : "border border-slate-200 bg-white text-slate-600"
                      }`}
                    >
                      Yenilenmiş (
                      {inventory.data
                        ?.summary
                        ?.renewedProductCount ??
                        0}
                      )
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setInventoryView(
                          "all"
                        )
                      }
                      className={`rounded-xl px-3 py-2 text-[8px] font-black uppercase tracking-wide transition ${
                        inventoryView ===
                        "all"
                          ? "bg-slate-900 text-white"
                          : "border border-slate-200 bg-white text-slate-600"
                      }`}
                    >
                      Tüm Ürünler (
                      {inventory.data
                        ?.summary
                        ?.allProductCount ??
                        0}
                      )
                    </button>

                    <input
                      value={
                        inventorySearch
                      }
                      onChange={(event) =>
                        setInventorySearch(
                          event.target
                            .value
                        )
                      }
                      placeholder="Ürün / SKU ara..."
                      className="h-8 w-48 rounded-xl border border-slate-200 bg-white px-3 text-[9px] font-semibold text-slate-700 outline-none transition focus:border-violet-400"
                    />
                  </div>
                </div>
              </div>

              <div className="grid gap-px bg-slate-200 sm:grid-cols-2 xl:grid-cols-4">
                <div className="bg-white px-5 py-4">
                  <div className="text-[8px] font-black uppercase tracking-[0.16em] text-slate-400">
                    Tüm Ürün
                  </div>
                  <div className="mt-1 text-lg font-black text-slate-900">
                    {inventory.data
                      ?.summary
                      ?.allProductCount ??
                      0}
                  </div>
                </div>

                <div className="bg-white px-5 py-4">
                  <div className="text-[8px] font-black uppercase tracking-[0.16em] text-slate-400">
                    Tüm Fiziksel Stok
                  </div>
                  <div className="mt-1 text-lg font-black text-slate-900">
                    {inventory.data
                      ?.summary
                      ?.allPhysicalStock ??
                      0}
                  </div>
                </div>

                <div className="bg-violet-50 px-5 py-4">
                  <div className="text-[8px] font-black uppercase tracking-[0.16em] text-violet-500">
                    Yenilenmiş Ürün
                  </div>
                  <div className="mt-1 text-lg font-black text-violet-700">
                    {inventory.data
                      ?.summary
                      ?.renewedProductCount ??
                      0}
                  </div>
                </div>

                <div className="bg-violet-50 px-5 py-4">
                  <div className="text-[8px] font-black uppercase tracking-[0.16em] text-violet-500">
                    Yenilenmiş Fiziksel Stok
                  </div>
                  <div className="mt-1 text-lg font-black text-violet-700">
                    {inventory.data
                      ?.summary
                      ?.renewedPhysicalStock ??
                      0}
                  </div>
                </div>
              </div>

              <div className="divide-y divide-slate-100">
                {inventoryProducts.map(
                  (
                    product: any,
                    productIndex: number
                  ) => (
                    <div
                      key={
                        product?.id ||
                        productIndex
                      }
                      className="px-5 py-4"
                    >
                      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="text-[12px] font-black text-slate-900">
                              {product?.name ||
                                "İsimsiz ürün"}
                            </div>

                            {product?.isRenewed && (
                              <span className="rounded-full bg-violet-100 px-2 py-1 text-[7px] font-black uppercase text-violet-700">
                                Yenilenmiş
                              </span>
                            )}
                          </div>

                          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[8px] font-bold text-slate-400">
                            <span>
                              Marka:{" "}
                              {product?.brand
                                ?.name ||
                                "-"}
                            </span>

                            <span>
                              Ürün ID:{" "}
                              {product?.id ||
                                "-"}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[8px] font-black uppercase text-slate-600">
                            {Array.isArray(
                              product?.variants
                            )
                              ? product
                                  .variants
                                  .length
                              : 0}{" "}
                            Varyant
                          </span>

                          <span
                            className={`rounded-full px-2.5 py-1 text-[8px] font-black uppercase ${
                              Number(
                                product
                                  ?.totalStock ||
                                  0
                              ) > 0
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-rose-100 text-rose-700"
                            }`}
                          >
                            Stok:{" "}
                            {product?.totalStock ??
                              0}
                          </span>
                        </div>
                      </div>

                      <div className="mt-3 grid gap-2 lg:grid-cols-2 xl:grid-cols-3">
                        {(Array.isArray(
                          product?.variants
                        )
                          ? product.variants
                          : []
                        ).map(
                          (
                            variant: any,
                            variantIndex: number
                          ) => (
                            <div
                              key={
                                variant?.id ||
                                variantIndex
                              }
                              className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-3"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="truncate text-[9px] font-black text-slate-800">
                                    SKU:{" "}
                                    {variant?.sku ||
                                      "-"}
                                  </div>

                                  <div className="mt-1 text-[8px] font-bold text-slate-400">
                                    Varyant stok:{" "}
                                    {variant?.stockCount ??
                                      0}
                                  </div>
                                </div>

                                <span
                                  className={`shrink-0 rounded-full px-2 py-1 text-[7px] font-black ${
                                    Number(
                                      variant?.stockCount ||
                                        0
                                    ) > 0
                                      ? "bg-emerald-100 text-emerald-700"
                                      : "bg-slate-200 text-slate-500"
                                  }`}
                                >
                                  {variant?.stockCount ??
                                    0}{" "}
                                  ADET
                                </span>
                              </div>

                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {(Array.isArray(
                                  variant
                                    ?.variantValues
                                )
                                  ? variant.variantValues
                                  : []
                                ).map(
                                  (
                                    value: any,
                                    valueIndex: number
                                  ) => (
                                    <span
                                      key={`${value?.variantTypeName || "tip"}-${valueIndex}`}
                                      className="rounded-full bg-white px-2 py-1 text-[8px] font-bold text-slate-600 ring-1 ring-slate-200"
                                    >
                                      {value?.variantTypeName ||
                                        "Özellik"}
                                      :{" "}
                                      {value?.variantValueName ||
                                        "-"}
                                    </span>
                                  )
                                )}
                              </div>

                              {Array.isArray(
                                variant?.stocks
                              ) &&
                                variant.stocks
                                  .length >
                                  0 && (
                                  <div className="mt-2 space-y-1 border-t border-slate-200 pt-2">
                                    {variant.stocks.map(
                                      (
                                        stock: any,
                                        stockIndex: number
                                      ) => (
                                        <div
                                          key={
                                            stock?.id ||
                                            stockIndex
                                          }
                                          className="flex items-center justify-between gap-2 text-[7px] font-bold text-slate-400"
                                        >
                                          <span className="truncate">
                                            Lokasyon:{" "}
                                            {stock?.stockLocationId ||
                                              "-"}
                                          </span>
                                          <span className="shrink-0 text-slate-700">
                                            {stock?.stockCount ??
                                              0}
                                          </span>
                                        </div>
                                      )
                                    )}
                                  </div>
                                )}
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  )
                )}

                {inventoryProducts.length ===
                  0 && (
                  <div className="px-5 py-10 text-center text-[10px] font-bold text-slate-400">
                    Bu filtrede ürün bulunamadı.
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
