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
