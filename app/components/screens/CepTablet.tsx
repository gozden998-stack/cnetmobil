"use client";

import React, { useMemo, useRef, useState } from "react";

type CepTabletProps = {
  data: any[][];
  canEdit?: boolean;
  onEdit?: () => void;
};

type PriceType = "all" | "campaign" | "sale" | "official";

type ProductRow = {
  side: "apple" | "android";
  name: string;
  brand: string;
  memory: string;
  campaign: unknown;
  sale: unknown;
  official: unknown;
};

const BRAND_OPTIONS = [
  "Tümü",
  "Apple",
  "Samsung",
  "Xiaomi",
  "Oppo",
  "Vivo",
  "Realme",
  "Tecno",
  "Infinix",
  "Diğer",
] as const;

const MEMORY_OPTIONS = [
  "Tümü",
  "32GB",
  "64GB",
  "128GB",
  "256GB",
  "512GB",
  "1TB",
  "2TB",
] as const;

function normalizeText(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLocaleUpperCase("tr-TR")
    .replace(/\s+/g, " ");
}

function detectBrand(name: string) {
  const value = normalizeText(name);

  if (
    value.includes("APPLE") ||
    value.includes("IPHONE") ||
    value.includes("IPAD") ||
    value.includes("WATCH")
  ) return "Apple";

  if (value.includes("SAMSUNG")) return "Samsung";
  if (value.includes("XIAOMI") || value.includes("REDMI") || value.includes("POCO")) return "Xiaomi";
  if (value.includes("OPPO")) return "Oppo";
  if (value.includes("VIVO")) return "Vivo";
  if (value.includes("REALME")) return "Realme";
  if (value.includes("TECNO")) return "Tecno";
  if (value.includes("INFINIX")) return "Infinix";

  return "Diğer";
}

function detectMemory(name: string) {
  const value = normalizeText(name);

  const tb = value.match(/(?:^|[^0-9])(1|2)\s*TB(?:$|[^0-9])/);
  if (tb) return `${tb[1]}TB`;

  const combo = value.match(
    /(?:^|[^0-9])(32|64|128|256|512)\s*\/\s*\d+\s*GB(?:$|[^0-9])/
  );
  if (combo) return `${combo[1]}GB`;

  const gb = value.match(
    /(?:^|[^0-9])(32|64|128|256|512)\s*GB(?:$|[^0-9])/
  );
  if (gb) return `${gb[1]}GB`;

  return "";
}

function AppleIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 384 512" className={`${className} fill-current`} aria-hidden="true">
      <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-72.6-19.7-30.7.5-58.8 17.8-74.6 44.9-31.7 55.1-8.1 136.5 22.8 181.2 15.5 22.4 34.1 47.5 58.4 46.5 23.3-.9 32.1-15.2 60.1-15.2 28 0 35.9 15.2 60.6 14.7 25-.4 40.8-22.8 56.3-45.3 18-26.3 25.5-51.8 26-53.1-.6-.3-49.8-19-50-75.6zM294 102.7c12.9-15.3 21.5-36.6 19.2-57.7-18.6.8-41.1 12.4-54.2 27.7-11.8 13.6-22.1 35.3-19.3 55.9 20.7 1.6 41.4-10.5 54.3-25.9z" />
    </svg>
  );
}

function AndroidIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M7.7 7.1 6.4 4.9a.65.65 0 0 1 1.12-.66l1.36 2.3A8.9 8.9 0 0 1 12 6c1.12 0 2.18.2 3.15.55l1.35-2.3a.65.65 0 1 1 1.12.66l-1.28 2.18A6.1 6.1 0 0 1 19 12H5a6.1 6.1 0 0 1 2.7-4.9ZM8.25 9.2a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm7.5 0a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM5 13h14v5.8A2.2 2.2 0 0 1 16.8 21H7.2A2.2 2.2 0 0 1 5 18.8V13Zm-2 0h1v6a1 1 0 1 1-2 0v-5a1 1 0 0 1 1-1Zm18 0a1 1 0 0 1 1 1v5a1 1 0 1 1-2 0v-6h1ZM8 21h2v2H8v-2Zm6 0h2v2h-2v-2Z" />
    </svg>
  );
}

function GridIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <rect x="4" y="4" width="6" height="6" rx="1" strokeWidth="2" />
      <rect x="14" y="4" width="6" height="6" rx="1" strokeWidth="2" />
      <rect x="4" y="14" width="6" height="6" rx="1" strokeWidth="2" />
      <rect x="14" y="14" width="6" height="6" rx="1" strokeWidth="2" />
    </svg>
  );
}

function BrandMark({ brand }: { brand: (typeof BRAND_OPTIONS)[number] }) {
  switch (brand) {
    case "Tümü":
    case "Diğer":
      return <GridIcon />;

    case "Apple":
      return <AppleIcon className="h-[17px] w-[17px]" />;

    case "Samsung":
      return (
        <span className="inline-flex h-[17px] min-w-[46px] -skew-x-12 items-center justify-center rounded-[50%] bg-[#1668e8] px-2 text-[6px] font-black italic tracking-tight text-white">
          <span className="skew-x-12">SAMSUNG</span>
        </span>
      );

    case "Xiaomi":
      return (
        <span className="inline-flex h-[19px] w-[19px] items-center justify-center rounded-[5px] bg-[#ff6900] text-[8px] font-black lowercase text-white">
          mi
        </span>
      );

    case "Oppo":
      return <span className="text-[11px] font-black tracking-[-0.06em] text-[#079a52]">OPPO</span>;

    case "Vivo":
      return <span className="text-[11px] font-black tracking-[-0.05em] text-[#2468e8]">vivo</span>;

    case "Realme":
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-black tracking-[-0.05em] text-slate-800">
          <span className="h-2.5 w-1.5 rounded-sm bg-[#ffd400]" />
          realme
        </span>
      );

    case "Tecno":
      return <span className="text-[10px] font-black tracking-[0.04em] text-[#0e5deb]">TECNO</span>;

    case "Infinix":
      return <span className="text-[10px] font-black tracking-[-0.03em] text-slate-900">Infinix</span>;
  }
}

function SearchIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.1} d="M21 21l-5-5m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );
}

function StatCard({
  icon,
  label,
  value,
  footer,
  iconClass,
  rightIcon,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  footer: string;
  iconClass: string;
  rightIcon?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-[74px] items-center gap-3 rounded-[17px] border border-slate-200 bg-white px-4 py-3 shadow-[0_3px_9px_rgba(15,23,42,0.08)]">
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${iconClass}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-[7px] font-black uppercase tracking-[0.08em] text-slate-400">{label}</div>
        <div className="mt-0.5 truncate text-[18px] font-black leading-none tracking-[-0.03em] text-slate-950">{value}</div>
        <div className="mt-1 truncate text-[7px] font-semibold text-slate-400">{footer}</div>
      </div>
      {rightIcon && (
        <div className="ml-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-blue-500">
          {rightIcon}
        </div>
      )}
    </div>
  );
}

function PriceCell({
  value,
  variant,
  active,
}: {
  value: unknown;
  variant: "campaign" | "sale" | "official";
  active: boolean;
}) {
  const color =
    variant === "campaign"
      ? "text-rose-600"
      : variant === "sale"
      ? "text-slate-950"
      : "text-slate-500";

  return (
    <div className={`flex items-center justify-end whitespace-nowrap px-3 py-[9px] text-[9px] font-black ${color} ${active ? "bg-blue-50 ring-1 ring-inset ring-blue-100" : ""}`}>
      {String(value || "-")}
    </div>
  );
}

function ProductPanel({
  title,
  subtitle,
  rows,
  type,
  showAll,
  onToggleShowAll,
  priceType,
}: {
  title: string;
  subtitle: string;
  rows: ProductRow[];
  type: "apple" | "android";
  showAll: boolean;
  onToggleShowAll: () => void;
  priceType: PriceType;
}) {
  const isApple = type === "apple";
  const visibleRows = showAll ? rows : rows.slice(0, 12);

  return (
    <section className="overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
      <div className="flex items-center justify-between gap-3 px-5 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${isApple ? "bg-slate-100 text-slate-950" : "bg-emerald-50 text-emerald-600"}`}>
            {isApple ? <AppleIcon className="h-5 w-5" /> : <AndroidIcon className="h-5 w-5" />}
          </div>

          <div className="min-w-0">
            <h3 className="truncate text-[17px] font-black tracking-[-0.03em] text-slate-950">{title}</h3>
            <p className="truncate text-[9px] font-semibold text-slate-400">{subtitle}</p>
          </div>
        </div>

        <span className={`shrink-0 rounded-full px-3 py-1.5 text-[8px] font-black ${isApple ? "bg-blue-50 text-blue-600" : "bg-emerald-50 text-emerald-600"}`}>
          {rows.length} Ürün
        </span>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[650px]">
          <div className="grid grid-cols-[40px_minmax(250px,1fr)_80px_104px_94px_104px] border-y border-slate-200 bg-slate-50/85 text-[7px] font-black uppercase tracking-[0.05em] text-slate-500">
            <div className="px-2 py-3 text-center">#</div>
            <div className="px-3 py-3">Ürün Adı</div>
            <div className="px-2 py-3 text-center">Hafıza</div>
            <div className="bg-rose-50/80 px-3 py-3 text-right text-rose-500">Kampanya</div>
            <div className="px-3 py-3 text-right">Satış</div>
            <div className="px-3 py-3 text-right">Resmi Fiyat</div>
          </div>

          {visibleRows.length === 0 ? (
            <div className="flex min-h-[180px] items-center justify-center text-center">
              <div>
                <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
                  <SearchIcon className="h-4 w-4" />
                </div>
                <p className="text-[10px] font-black text-slate-700">Ürün bulunamadı</p>
              </div>
            </div>
          ) : (
            visibleRows.map((row, index) => (
              <div
                key={`${row.side}-${row.name}-${index}`}
                className={`grid grid-cols-[40px_minmax(250px,1fr)_80px_104px_94px_104px] border-b border-slate-100 last:border-b-0 ${index % 2 === 0 ? "bg-white" : "bg-slate-50/35"} hover:bg-blue-50/40`}
              >
                <div className="flex items-center justify-center px-2 py-[9px] text-[8px] font-bold text-slate-400">{index + 1}</div>
                <div className="flex min-w-0 items-center px-3 py-[9px]">
                  <span title={row.name} className="truncate text-[9px] font-black text-slate-900">{row.name}</span>
                </div>
                <div className="flex items-center justify-center px-2 py-[9px] text-[8px] font-black text-slate-600">{row.memory || "-"}</div>
                <PriceCell value={row.campaign} variant="campaign" active={priceType === "campaign"} />
                <PriceCell value={row.sale} variant="sale" active={priceType === "sale"} />
                <PriceCell value={row.official} variant="official" active={priceType === "official"} />
              </div>
            ))
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 px-5 py-3">
        <button
          type="button"
          onClick={onToggleShowAll}
          className="inline-flex items-center gap-2 text-[9px] font-black text-blue-600 hover:text-blue-700"
        >
          {showAll ? "Listeyi Kısalt" : `Tüm ${title} Ürünlerini Gör`}
          <span className="text-[14px]">→</span>
        </button>

        <span className={`rounded-full px-3 py-1.5 text-[8px] font-black ${isApple ? "bg-blue-50 text-blue-500" : "bg-emerald-50 text-emerald-500"}`}>
          {rows.length} ürün listeleniyor
        </span>
      </div>
    </section>
  );
}

export default function CepTablet({
  data,
  canEdit = false,
  onEdit,
}: CepTabletProps) {
  const searchRef = useRef<HTMLInputElement | null>(null);

  const [search, setSearch] = useState("");
  const [brand, setBrand] = useState<(typeof BRAND_OPTIONS)[number]>("Tümü");
  const [memory, setMemory] = useState<(typeof MEMORY_OPTIONS)[number]>("Tümü");
  const [priceType, setPriceType] = useState<PriceType>("all");
  const [showAllApple, setShowAllApple] = useState(false);
  const [showAllAndroid, setShowAllAndroid] = useState(false);

  const products = useMemo<ProductRow[]>(() => {
    const rows = Array.isArray(data) ? data.slice(1) : [];

    const apple: ProductRow[] = rows
      .filter((row) => String(row?.[0] ?? "").trim() !== "")
      .map((row) => {
        const name = String(row?.[0] ?? "").trim();
        return {
          side: "apple",
          name,
          brand: "Apple",
          memory: detectMemory(name),
          campaign: row?.[1],
          sale: row?.[2],
          official: row?.[3],
        };
      });

    const android: ProductRow[] = rows
      .filter((row) => String(row?.[5] ?? "").trim() !== "")
      .map((row) => {
        const name = String(row?.[5] ?? "").trim();
        return {
          side: "android",
          name,
          brand: detectBrand(name),
          memory: detectMemory(name),
          campaign: row?.[6],
          sale: row?.[7],
          official: row?.[8],
        };
      });

    return [...apple, ...android];
  }, [data]);

  const filtered = useMemo(() => {
    const query = normalizeText(search);

    return products.filter((row) => {
      const searchable = normalizeText(
        `${row.name} ${row.brand} ${row.memory} ${row.campaign ?? ""} ${row.sale ?? ""} ${row.official ?? ""}`
      );

      return (
        (query === "" || searchable.includes(query)) &&
        (brand === "Tümü" || row.brand === brand) &&
        (memory === "Tümü" || row.memory === memory)
      );
    });
  }, [products, search, brand, memory]);

  const appleAll = products.filter((row) => row.side === "apple");
  const androidAll = products.filter((row) => row.side === "android");
  const appleRows = filtered.filter((row) => row.side === "apple");
  const androidRows = filtered.filter((row) => row.side === "android");

  function clearFilters() {
    setSearch("");
    setBrand("Tümü");
    setMemory("Tümü");
    setPriceType("all");
    setShowAllApple(false);
    setShowAllAndroid(false);
  }

  const todayLabel = useMemo(
    () =>
      new Intl.DateTimeFormat("tr-TR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      }).format(new Date()),
    []
  );

  return (
    <div className="animate-in fade-in duration-300">
      {/* REFERANS GÖRSELDEKİ ÜST KART */}
      <section className="overflow-hidden rounded-[24px] border border-blue-100 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.055)]">
        <div className="grid min-h-[124px] lg:grid-cols-[1.32fr_0.68fr]">
          <div className="flex flex-col justify-center px-7 py-5 sm:px-8">
            <div className="text-[8px] font-black uppercase tracking-[0.20em] text-blue-600">
              CNETMOBİL V2
            </div>

            <h2 className="mt-2 text-[29px] font-black tracking-[-0.048em] text-slate-950 sm:text-[31px]">
              Cep + Tablet Fiyat Listesi
            </h2>

            <p className="mt-2 text-[10px] font-semibold text-slate-400">
              Güncel piyasa fiyatları, kampanyalı fiyatlar ve resmi fiyatlarla tüm cep telefonu ve tablet modelleri.
            </p>
          </div>

          <div className="relative hidden overflow-hidden bg-gradient-to-r from-[#eef6ff] via-[#d9eaff] to-[#b9d7ff] lg:block">
            <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-white to-transparent" />

            <div className="absolute left-[12%] top-1/2 z-10 flex -translate-y-1/2 items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/75 text-blue-600 shadow-sm">
                <svg className="h-4.5 w-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3l8 4-8 4-8-4 8-4zm8 4v10l-8 4-8-4V7m8 4v10" />
                </svg>
              </div>

              <div className="text-[10px] font-black leading-[1.45] text-blue-700">
                Güçlü Stok
                <br />
                Güvenilir Fiyat
                <br />
                Cnetmobil Yanınızda
              </div>
            </div>

            {/* Referanstaki telefon grubu */}
            <div className="absolute bottom-[-25px] right-[3%] h-[105px] w-[62px] rotate-[4deg] rounded-[13px] border-[5px] border-[#162d50] bg-gradient-to-br from-blue-100 via-blue-300 to-violet-400 shadow-xl">
              <div className="mx-auto mt-1 h-1.5 w-6 rounded-full bg-[#162d50]" />
            </div>

            <div className="absolute bottom-[-25px] right-[14%] h-[104px] w-[56px] rotate-[6deg] rounded-[13px] border-[5px] border-[#162d50] bg-gradient-to-br from-blue-500 via-blue-600 to-violet-600 shadow-xl">
              <div className="mx-auto mt-1 h-1.5 w-5 rounded-full bg-[#162d50]" />
            </div>

            <div className="absolute bottom-[-27px] right-[24%] h-[95px] w-[54px] -rotate-[10deg] rounded-[13px] border-[5px] border-[#162d50] bg-gradient-to-br from-slate-200 via-slate-400 to-slate-700 shadow-xl">
              <div className="absolute left-2 top-2 grid grid-cols-2 gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-[#162d50]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#162d50]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#162d50]" />
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-2 border-t border-blue-50 bg-[#f8fbff] p-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={
              <svg className="h-4.5 w-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3l8 4-8 4-8-4 8-4zm8 4v10l-8 4-8-4V7m8 4v10" />
              </svg>
            }
            label="Toplam Ürün"
            value={products.length}
            footer="Cep telefonu ve tablet"
            iconClass="bg-blue-50 text-blue-600"
            rightIcon={
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l4-4 3 3 5-6m0 0h-4m4 0v4" />
              </svg>
            }
          />

          <StatCard
            icon={<AppleIcon className="h-4.5 w-4.5" />}
            label="Apple Ürün"
            value={appleAll.length}
            footer="iPhone & iPad modelleri"
            iconClass="bg-slate-100 text-slate-950"
            rightIcon={
              <svg className="h-4 w-4 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19V9m5 10V5m5 14v-7m4 7V3" />
              </svg>
            }
          />

          <StatCard
            icon={<AndroidIcon className="h-4.5 w-4.5" />}
            label="Android Ürün"
            value={androidAll.length}
            footer="Samsung, Xiaomi, Oppo, vb."
            iconClass="bg-emerald-50 text-emerald-600"
            rightIcon={
              <svg className="h-4 w-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19V9m5 10V5m5 14v-7m4 7V3" />
              </svg>
            }
          />

          <StatCard
            icon={
              <svg className="h-4.5 w-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3M4 11h16M5 5h14a1 1 0 011 1v14H4V6a1 1 0 011-1z" />
              </svg>
            }
            label="Son Güncelleme"
            value={<span className="text-[12px]">{todayLabel}</span>}
            footer="CNETMOBİL • Güncel veri"
            iconClass="bg-blue-50 text-blue-600"
            rightIcon={
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h5M20 20v-5h-5M5.5 18.5A8 8 0 0118 6M18.5 5.5A8 8 0 006 18" />
              </svg>
            }
          />
        </div>
      </section>

      {/* ARAMA / FİLTRE / LOGOLU MARKALAR */}
      <section className="sticky top-[104px] z-30 mt-4 rounded-[22px] border border-slate-200 bg-white/95 p-3 shadow-[0_9px_26px_rgba(15,23,42,0.07)] backdrop-blur">
        <div className="flex flex-col gap-2 xl:flex-row xl:items-center">
          <div className="relative min-w-0 flex-1">
            <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-blue-500">
              <SearchIcon />
            </div>
            <input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Model, marka veya özellik ara..."
              className="h-[49px] w-full rounded-2xl border border-slate-200 bg-slate-50 pl-12 pr-4 text-[11px] font-bold text-slate-800 outline-none placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50"
            />
          </div>

          <select
            value={brand}
            onChange={(e) => setBrand(e.target.value as (typeof BRAND_OPTIONS)[number])}
            className="h-[49px] min-w-[165px] rounded-2xl border border-slate-200 bg-white px-4 text-[10px] font-black text-slate-800 outline-none focus:border-blue-400"
          >
            {BRAND_OPTIONS.map((item) => (
              <option key={item} value={item}>Marka: {item}</option>
            ))}
          </select>

          <select
            value={memory}
            onChange={(e) => setMemory(e.target.value as (typeof MEMORY_OPTIONS)[number])}
            className="h-[49px] min-w-[145px] rounded-2xl border border-slate-200 bg-white px-4 text-[10px] font-black text-slate-800 outline-none focus:border-blue-400"
          >
            {MEMORY_OPTIONS.map((item) => (
              <option key={item} value={item}>Hafıza: {item}</option>
            ))}
          </select>

          <select
            value={priceType}
            onChange={(e) => setPriceType(e.target.value as PriceType)}
            className="h-[49px] min-w-[155px] rounded-2xl border border-slate-200 bg-white px-4 text-[10px] font-black text-slate-800 outline-none focus:border-blue-400"
          >
            <option value="all">Fiyat Tipi: Tümü</option>
            <option value="campaign">Kampanya</option>
            <option value="sale">Satış</option>
            <option value="official">Resmi Fiyat</option>
          </select>

          {canEdit && onEdit && (
            <button
              type="button"
              onClick={onEdit}
              className="inline-flex h-[49px] min-w-[150px] items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 text-[10px] font-black text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7m-1.5-8.5a2.121 2.121 0 013 3L12 17l-4 1 1-4 9.5-9.5z" />
              </svg>
              DÜZENLE
            </button>
          )}

          <button
            type="button"
            onClick={clearFilters}
            className="inline-flex h-[49px] min-w-[120px] items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-[10px] font-black text-slate-500 transition hover:bg-slate-100"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h5M20 20v-5h-5M5.5 18.5A8 8 0 0118 6M18.5 5.5A8 8 0 006 18" />
            </svg>
            Temizle
          </button>
        </div>

        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {BRAND_OPTIONS.map((item) => {
            const active = brand === item;

            return (
              <button
                key={item}
                type="button"
                onClick={() => setBrand(item)}
                className={[
                  "flex h-[38px] shrink-0 items-center justify-center gap-2 rounded-xl border px-4 text-[8px] font-black transition",
                  active
                    ? "border-blue-600 bg-blue-600 text-white shadow-md shadow-blue-600/15"
                    : "border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:text-blue-600",
                ].join(" ")}
              >
                <BrandMark brand={item} />
                <span>{item}</span>
              </button>
            );
          })}
        </div>
      </section>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ProductPanel
          title="Apple"
          subtitle="iPhone, iPad ve Apple ürünleri"
          rows={appleRows}
          type="apple"
          showAll={showAllApple || search.trim() !== ""}
          onToggleShowAll={() => setShowAllApple((v) => !v)}
          priceType={priceType}
        />

        <ProductPanel
          title="Android / Diğer"
          subtitle="Samsung, Xiaomi, Oppo, Realme, Tecno ve daha fazlası"
          rows={androidRows}
          type="android"
          showAll={showAllAndroid || search.trim() !== ""}
          onToggleShowAll={() => setShowAllAndroid((v) => !v)}
          priceType={priceType}
        />
      </div>

      <button
        type="button"
        title="Hızlı Ara"
        onClick={() => {
          searchRef.current?.focus();
          searchRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        }}
        className="fixed bottom-[88px] right-[74px] z-40 flex h-[54px] w-[54px] items-center justify-center rounded-full bg-blue-600 text-white shadow-[0_13px_30px_rgba(37,99,235,0.38)] transition hover:scale-105 hover:bg-blue-700 max-sm:right-5"
      >
        <SearchIcon className="h-6 w-6" />
      </button>
    </div>
  );
}
