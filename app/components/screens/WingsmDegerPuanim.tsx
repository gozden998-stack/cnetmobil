"use client";

// app/components/screens/WingsmDegerPuanim.tsx
//
// CNETMOBIL - WingSM "Değer Puan Performansı" (personel ekranı)
//
// Ekran: başlık + rapor/mağaza seçicileri, "Lider Mağaza" ve "Kalan Gün"
// kartları, sol tarafta Personel Performansı tablosu (sıra, puan, hedef,
// gerçekleşme çubuğu, ödül), sağ tarafta Mağaza Performansı.
//
// Veri app/api/wingsm/deger-puanim/route.ts'ten gelir. O uç canlı WingSM
// hesabı YAPMAZ — adminin en son "HESAPLA" ile kaydettiği sonucu okur. Yani
// admin raporu yeniden hesaplamadıkça rakamlar değişmez; ekranda "Son
// güncelleme" ve "Rapor güncellendi / bekleniyor" bilgisi bu yüzden var.
//
// Renkler SIRAYA göre (bkz. degerPuanRenkleri.ts): personelde 1-3 yeşil, 4-6
// gri, 7 turuncu, diğerleri kırmızı; mağazada 1 koyu yeşil, 2 açık yeşil,
// 3 gri, 4 kırmızı. Sıralamaya girmeyenler (müdür, hedefsiz) kırmızı.

import React, { useEffect, useMemo, useState } from "react";

import { magazaGostergeRengi, magazalariSirala, personelGostergeRengi } from "./degerPuanRenkleri";

type StoreRow = {
  branchLabel: string;
  depotCode: string;
  saleCount: number;
  totalScore: number;
  multiplier: number;
  carpanliPuan: number;
  hedef: number | null;
  projeksiyon: number;
  hedefYuzdesi: number | null;
  siralamaPuani: number;
};

type PersonnelRow = {
  branchLabel: string;
  saticiKod: string;
  saticiAdi: string;
  saleCount: number;
  totalScore: number;
  carpanliPuan: number;
  hedef: number | null;
  isManager: boolean;
  hedefYuzdesi: number | null;
  projeksiyon: number;
  siralama: number | null;
  siralamaPuani: number;
};

type DegerPuanimReport = {
  hasSnapshot: boolean;
  computedAt: string | null;
  hedefPeriodu: string | null;
  period: { tarih: string; tarih2: string } | null;
  history?: Array<{ id: number; tarih: string; tarih2: string; computedAt: string }>;
  selectedHistoryId?: number | null;
  durum?: "guncel" | "bekleniyor" | null;
  gunBilgisi: { gecenGun: number; ayToplamGun: number; kalanGun: number } | null;
  stores: StoreRow[];
  personnel: PersonnelRow[];
};

type SortKey = "siralama" | "ad" | "puan" | "hedef" | "yuzde";

const MONTHS_LONG_TR = [
  "Ocak",
  "Şubat",
  "Mart",
  "Nisan",
  "Mayıs",
  "Haziran",
  "Temmuz",
  "Ağustos",
  "Eylül",
  "Ekim",
  "Kasım",
  "Aralık",
];

function formatNumber(value: number, digits = 0) {
  if (!Number.isFinite(value)) return "-";
  return value.toLocaleString("tr-TR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

// Tasarımdaki gibi önde yüzde işaretiyle: "%35,10"
function formatPercent(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "%0,00";
  return `%${formatNumber(value, 2)}`;
}

// "2026-10" -> "Ekim 2026"
function formatMonthLabel(period: string | null) {
  const match = String(period || "").match(/^(\d{4})-(\d{2})$/);
  if (!match) return "Rapor";
  return `${MONTHS_LONG_TR[Number(match[2]) - 1] || match[2]} ${match[1]}`;
}

// { tarih: "01/10/2026", tarih2: "09/10/2026" } -> "01.10 - 09.10.2026"
function formatRangeLong(tarih: string, tarih2: string) {
  const a = String(tarih || "").split("/");
  const b = String(tarih2 || "").split("/");
  if (a.length !== 3 || b.length !== 3) return `${tarih} - ${tarih2}`;
  return `${a[0]}.${a[1]} - ${b[0]}.${b[1]}.${b[2]}`;
}

// "2026-09-21T10:15:00.000Z" -> "21.09.2026 10:15" (Türkçe, yerel saat).
function formatComputedAt(iso: string | null): string {
  if (!iso) return "-";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "-";
  const datePart = date.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });
  const timePart = date.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  return `${datePart} ${timePart}`;
}

// "GİRAY ÇAKICI" -> "Giray Çakıcı"
function titleCaseTr(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toLocaleUpperCase("tr-TR") + word.slice(1))
    .join(" ");
}

// "CMR SARAY" -> "CMR Saray" (CMR hep büyük harf)
function formatStoreName(label: string) {
  return label
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => (word.toUpperCase() === "CMR" ? "CMR" : titleCaseTr(word)))
    .join(" ");
}

function normalizeSearch(value: string) {
  return value.toLocaleLowerCase("tr-TR").trim();
}

// --------------------------------------------------
// İkonlar (bu kod tabanında ikon kütüphanesi yok — inline svg)
// --------------------------------------------------

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 3v3M16 3v3M4 9h16M5 5h14a1 1 0 011 1v13a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1z"
      />
    </svg>
  );
}

function StoreIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 9l1-5h14l1 5M4 9a2 2 0 004 0 2 2 0 004 0 2 2 0 004 0 2 2 0 004 0M5 9v10h14V9M9 19v-5h6v5"
      />
    </svg>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.3-4.3M10.5 18a7.5 7.5 0 100-15 7.5 7.5 0 000 15z" />
    </svg>
  );
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 9l6 6 6-6" />
    </svg>
  );
}

function SortIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4M8 15l4 4 4-4" />
    </svg>
  );
}

// Sıra hücresi: ilk 3 madalya renkli, sonrası halkalı numara, sıralamaya girmeyen "-".
function RankBadge({ rank }: { rank: number | null }) {
  if (rank === null) {
    return (
      <span className="inline-flex h-7 w-7 items-center justify-center text-sm font-bold text-slate-400">-</span>
    );
  }

  const medal =
    rank === 1
      ? "bg-amber-400 text-white"
      : rank === 2
        ? "bg-slate-300 text-slate-700"
        : rank === 3
          ? "bg-orange-400 text-white"
          : "border border-slate-300 bg-white text-slate-600";

  return (
    <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-black ${medal}`}>
      {rank}
    </span>
  );
}

function ProgressBar({ percent, barClass }: { percent: number | null; barClass: string }) {
  const width = percent === null ? 0 : Math.min(100, Math.max(3, percent));

  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
      <div className={`h-full rounded-full ${barClass}`} style={{ width: `${width}%` }} />
    </div>
  );
}

type SortState = { key: SortKey; dir: "asc" | "desc" } | null;

// Tıklanabilir tablo başlığı. Bileşenin dışında tanımlı: render'da yeniden
// oluşmasın (buton odağı ve tıklama kaybolmasın).
function SortableTh({
  label,
  sortKey,
  sort,
  onToggle,
  className = "",
}: {
  label: string;
  sortKey: SortKey;
  sort: SortState;
  onToggle: (key: SortKey) => void;
  className?: string;
}) {
  return (
    <th className={`px-1.5 py-3 sm:px-2 ${className}`}>
      <button
        type="button"
        onClick={() => onToggle(sortKey)}
        className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-slate-800"
      >
        {label}
        <SortIcon className={`h-3 w-3 ${sort?.key === sortKey ? "text-blue-600" : "text-slate-300"}`} />
      </button>
    </th>
  );
}

const SELECT_WRAP =
  "relative flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white pl-3 pr-9 text-sm font-semibold text-slate-700 shadow-sm";

export default function WingsmDegerPuanim() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [report, setReport] = useState<DegerPuanimReport | null>(null);

  const [storeFilter, setStoreFilter] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortState>(null);

  const fetchReport = async (historyId?: number | null) => {
    setLoading(true);
    setError("");

    try {
      const query = historyId ? `?historyId=${historyId}` : "";
      const res = await fetch(`/api/wingsm/deger-puanim${query}`, {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
      });

      const payload = await res.json().catch(() => null);

      if (!res.ok || !payload?.success) {
        throw new Error(payload?.error || `HTTP ${res.status}`);
      }

      setReport(payload as DegerPuanimReport);
    } catch (err) {
      setReport(null);
      setError(err instanceof Error ? err.message : "Değer Puan raporu alınamadı.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchReport();
  }, []);

  // "Rapor bekleniyor" iken ekran açık kalırsa, admin raporu güncelleyince
  // personelin sayfayı yenilemesine gerek kalmasın: 2 dakikada bir sessizce
  // tekrar sorulur (sadece en güncel rapor görüntülenirken).
  const waiting = report?.durum === "bekleniyor" && !report?.selectedHistoryId;

  useEffect(() => {
    if (!waiting) return;

    const id = window.setInterval(() => {
      fetch("/api/wingsm/deger-puanim", { method: "GET", credentials: "same-origin", cache: "no-store" })
        .then((res) => res.json().catch(() => null))
        .then((payload) => {
          if (payload?.success && payload.durum === "guncel") {
            setReport(payload as DegerPuanimReport);
          }
        })
        .catch(() => {
          // Arka plan kontrolü ekranı bozmaz.
        });
    }, 120_000);

    return () => window.clearInterval(id);
  }, [waiting]);

  const personnelRows = useMemo(() => {
    if (!report) return [];

    const query = normalizeSearch(search);

    const filtered = report.personnel.filter((person) => {
      if (storeFilter && person.branchLabel !== storeFilter) return false;
      if (query && !normalizeSearch(person.saticiAdi || person.saticiKod).includes(query)) return false;
      return true;
    });

    if (!sort) return filtered;

    const direction = sort.dir === "asc" ? 1 : -1;

    return [...filtered].sort((a, b) => {
      switch (sort.key) {
        case "ad":
          return direction * (a.saticiAdi || "").localeCompare(b.saticiAdi || "", "tr-TR");
        case "puan":
          return direction * (a.carpanliPuan - b.carpanliPuan);
        case "hedef":
          return direction * ((a.hedef ?? 0) - (b.hedef ?? 0));
        case "yuzde":
          return direction * ((a.hedefYuzdesi ?? -1) - (b.hedefYuzdesi ?? -1));
        default:
          return direction * ((a.siralama ?? 9999) - (b.siralama ?? 9999));
      }
    });
  }, [report, search, storeFilter, sort]);

  const toggleSort = (key: SortKey) => {
    setSort((current) => {
      const firstDir: "asc" | "desc" = key === "ad" || key === "siralama" ? "asc" : "desc";

      if (!current || current.key !== key) {
        return { key, dir: firstDir };
      }

      // Aynı başlığa 2. tıklama ters yön, 3. tıklama sıralamayı kaldırır.
      return current.dir === firstDir ? { key, dir: firstDir === "asc" ? "desc" : "asc" } : null;
    });
  };

  if (loading && !report) {
    return (
      <div className="flex min-h-[300px] items-center justify-center text-sm font-bold text-slate-400">
        Değer Puan yükleniyor...
      </div>
    );
  }

  if (error && !report) {
    return (
      <div className="animate-in fade-in duration-500">
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-bold text-red-700">
          {error}
        </div>
        <button
          type="button"
          onClick={() => void fetchReport()}
          className="mt-4 h-10 rounded-lg bg-blue-700 px-5 text-sm font-black text-white hover:bg-blue-800"
        >
          TEKRAR DENE
        </button>
      </div>
    );
  }

  if (!report) {
    return null;
  }

  if (!report.hasSnapshot) {
    return (
      <div className="animate-in fade-in duration-500 space-y-4">
        <h1 className="text-2xl font-black text-slate-800">Değer Puan Performansı</h1>
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-8 text-center text-sm font-bold text-slate-500">
          Bu ay için henüz bir hesaplama yapılmadı. Yöneticiniz hesapladığında burada görünecek.
        </div>
      </div>
    );
  }

  const history = report.history ?? [];
  const gun = report.gunBilgisi;

  const allStores = magazalariSirala(report.stores);
  const visibleStores = storeFilter ? allStores.filter((s) => s.branchLabel === storeFilter) : allStores;
  const leader = allStores.find((s) => s.hedefYuzdesi !== null) ?? null;

  return (
    <div className="animate-in fade-in duration-500 rounded-3xl bg-[#f3f8ff] p-3 sm:p-6">
      {/* Başlık + seçiciler */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-black text-[#1b2559] sm:text-3xl">Değer Puan Performansı</h1>
          <p className="mt-1 text-sm text-slate-500">Personel ve mağaza hedeflerini tek ekrandan takip edin.</p>
        </div>

        <div className="flex flex-col gap-2 lg:items-end">
          <div className="flex flex-wrap gap-2">
            <label className={SELECT_WRAP}>
              <CalendarIcon className="h-4 w-4 flex-none text-slate-500" />
              <span className="sr-only">Rapor</span>
              <select
                value={report.selectedHistoryId ?? ""}
                disabled={loading}
                onChange={(e) => void fetchReport(e.target.value ? Number(e.target.value) : null)}
                className="absolute inset-0 h-full w-full cursor-pointer appearance-none rounded-xl bg-transparent pl-9 pr-9 text-sm font-semibold text-slate-700 outline-none disabled:opacity-60"
              >
                <option value="">{formatMonthLabel(report.hedefPeriodu)} (en güncel)</option>
                {history.map((item) => (
                  <option key={item.id} value={item.id}>
                    {formatRangeLong(item.tarih, item.tarih2)}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none whitespace-nowrap">
                {report.selectedHistoryId && report.period
                  ? formatRangeLong(report.period.tarih, report.period.tarih2)
                  : formatMonthLabel(report.hedefPeriodu)}
              </span>
              <ChevronDownIcon className="pointer-events-none absolute right-3 h-4 w-4 text-slate-500" />
            </label>

            <label className={SELECT_WRAP}>
              <StoreIcon className="h-4 w-4 flex-none text-slate-500" />
              <span className="sr-only">Mağaza</span>
              <select
                value={storeFilter}
                onChange={(e) => setStoreFilter(e.target.value)}
                className="absolute inset-0 h-full w-full cursor-pointer appearance-none rounded-xl bg-transparent pl-9 pr-9 text-sm font-semibold text-slate-700 outline-none"
              >
                <option value="">Tüm Mağazalar</option>
                {allStores.map((store) => (
                  <option key={store.depotCode} value={store.branchLabel}>
                    {formatStoreName(store.branchLabel)}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none whitespace-nowrap">
                {storeFilter ? formatStoreName(storeFilter) : "Tüm Mağazalar"}
              </span>
              <ChevronDownIcon className="pointer-events-none absolute right-3 h-4 w-4 text-slate-500" />
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-slate-400">
            {report.durum === "guncel" && (
              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 font-bold text-emerald-700">
                ✓ Rapor güncellendi
              </span>
            )}
            {report.durum === "bekleniyor" && (
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 font-bold text-amber-700">
                ⏳ Rapor bekleniyor
              </span>
            )}
            {report.selectedHistoryId ? (
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 font-bold text-amber-700">
                Eski rapor görüntüleniyor
              </span>
            ) : null}
            <span>Son güncelleme: {formatComputedAt(report.computedAt)}</span>
          </div>
        </div>
      </div>

      {report.durum === "bekleniyor" && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-semibold text-amber-800">
          Yeni günün raporu henüz güncellenmedi, aşağıda son rapor görünüyor.
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs font-bold text-red-700">
          {error}
        </div>
      )}

      {/* Özet kartları */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:gap-4 lg:ml-auto lg:max-w-[560px]">
        <div className="flex items-center gap-2 rounded-2xl bg-white p-3 shadow-sm sm:gap-4 sm:p-4">
          <div className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-violet-100 text-violet-600 sm:h-14 sm:w-14">
            <StoreIcon className="h-4 w-4 sm:h-7 sm:w-7" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-semibold text-slate-400">Lider Mağaza</div>
            <div className="text-sm font-black leading-tight text-[#1b2559] sm:text-2xl">
              {leader ? formatStoreName(leader.branchLabel) : "-"}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-2xl bg-white p-3 shadow-sm sm:gap-4 sm:p-4">
          <div className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-orange-100 text-orange-500 sm:h-14 sm:w-14">
            <CalendarIcon className="h-4 w-4 sm:h-7 sm:w-7" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-semibold text-slate-400">Kalan Gün</div>
            <div className="text-base font-black text-[#1b2559] sm:text-2xl">{gun ? gun.kalanGun : "-"}</div>
          </div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        {/* PERSONEL PERFORMANSI */}
        <section className="rounded-2xl bg-white p-3 shadow-sm sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-black text-[#1b2559] sm:text-xl">Personel Performansı</h2>
              <p className="text-xs font-semibold text-slate-400">{personnelRows.length} personel</p>
            </div>
            <label className="relative block sm:w-64">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <span className="sr-only">Personel ara</span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Personel ara..."
                className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 outline-none focus:border-blue-400"
              />
            </label>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-slate-50">
                  <SortableTh label="Sıra" sortKey="siralama" sort={sort} onToggle={toggleSort} className="rounded-l-lg" />
                  <SortableTh label="Personel" sortKey="ad" sort={sort} onToggle={toggleSort} />
                  <SortableTh label="Toplam Puan" sortKey="puan" sort={sort} onToggle={toggleSort} className="hidden text-center sm:table-cell" />
                  <SortableTh label="Hedef" sortKey="hedef" sort={sort} onToggle={toggleSort} className="hidden text-center sm:table-cell" />
                  <SortableTh label="Gerçekleşme" sortKey="yuzde" sort={sort} onToggle={toggleSort} />
                  <th className="rounded-r-lg px-1.5 py-3 text-center sm:px-2 text-[11px] font-bold text-slate-500">Ödül</th>
                </tr>
              </thead>
              <tbody>
                {personnelRows.map((person, index) => {
                  const ranked = !person.isManager && person.hedefYuzdesi !== null;
                  const rank = ranked ? person.siralama : null;
                  const colors = personelGostergeRengi(rank);
                  const percent = ranked ? person.hedefYuzdesi : null;

                  return (
                    <tr
                      key={`${person.branchLabel}-${person.saticiKod || person.saticiAdi}-${index}`}
                      className="border-b border-slate-100 last:border-0"
                    >
                      <td className="px-1.5 py-2.5 sm:px-2">
                        <RankBadge rank={rank} />
                      </td>
                      <td className="px-1.5 py-2.5 sm:px-2 text-sm font-semibold text-[#1b2559]">
                        {titleCaseTr(person.saticiAdi || person.saticiKod)}
                        <div className="text-[11px] font-semibold text-slate-400 sm:hidden">
                          {formatNumber(person.carpanliPuan)} puan
                        </div>
                      </td>
                      <td className="hidden px-1.5 py-2.5 sm:px-2 text-center text-sm font-semibold text-slate-700 sm:table-cell">
                        {formatNumber(person.carpanliPuan)}
                      </td>
                      <td className="hidden px-1.5 py-2.5 sm:px-2 text-center text-sm font-semibold text-slate-700 sm:table-cell">
                        {formatNumber(person.hedef ?? 0)}
                      </td>
                      <td className="px-1.5 py-2.5 sm:px-2">
                        <div className="flex flex-col items-start gap-1 sm:min-w-[150px] sm:flex-row sm:items-center sm:gap-2">
                          <span className={`flex-none text-xs font-bold sm:w-16 sm:text-sm ${colors.text}`}>
                            {formatPercent(percent)}
                          </span>
                          <div className="w-16 sm:w-auto sm:flex-1">
                            <ProgressBar percent={percent} barClass={colors.bar} />
                          </div>
                        </div>
                      </td>
                      <td className="px-1.5 py-2.5 sm:px-2 text-center">
                        <span className="inline-flex min-w-7 items-center sm:min-w-9 justify-center rounded-lg bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">
                          {person.siralamaPuani > 0 ? person.siralamaPuani : "-"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {personnelRows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-xs font-bold text-slate-400">
                      {search || storeFilter ? "Aramanıza uyan personel bulunamadı." : "Bu dönemde satış bulunamadı."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* MAĞAZA PERFORMANSI */}
        <section className="rounded-2xl bg-white p-3 shadow-sm sm:p-5">
          <h2 className="text-lg font-black text-[#1b2559] sm:text-xl">Mağaza Performansı</h2>

          <div className="mt-4 rounded-xl bg-slate-50 px-3 py-2 text-[11px] font-bold text-slate-500">
            <div className="grid grid-cols-[1fr_auto_auto] gap-3 sm:grid-cols-[1.2fr_1fr_1fr]">
              <span>Mağaza</span>
              <span>Gerçekleşen</span>
              <span className="text-right sm:text-left">Ay Sonu Tahmini</span>
            </div>
          </div>

          <div className="mt-3 space-y-2.5">
            {visibleStores.map((store) => {
              const index = allStores.findIndex((s) => s.depotCode === store.depotCode);
              const colors = magazaGostergeRengi(index, store.hedefYuzdesi !== null);

              return (
                <div key={store.depotCode} className="rounded-xl border border-slate-100 px-3 py-2.5 shadow-sm">
                  <div className="grid grid-cols-[1fr_auto_auto] items-center gap-3 sm:grid-cols-[1.2fr_1fr_1fr]">
                    <span className="text-sm font-black text-[#1b2559]">{formatStoreName(store.branchLabel)}</span>
                    <span className="text-sm font-semibold text-slate-700">{formatNumber(store.carpanliPuan)}</span>
                    <span className="text-right text-sm font-semibold text-slate-700 sm:text-left">
                      {formatNumber(store.projeksiyon)}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    <ProgressBar percent={store.hedefYuzdesi} barClass={colors.bar} />
                    <span className={`w-16 flex-none text-right text-xs font-bold sm:text-sm ${colors.text}`}>
                      {formatPercent(store.hedefYuzdesi)}
                    </span>
                  </div>
                </div>
              );
            })}
            {visibleStores.length === 0 && (
              <div className="py-6 text-center text-xs font-bold text-slate-400">Mağaza bulunamadı.</div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
