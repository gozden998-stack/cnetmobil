"use client";

// app/components/screens/WingsmDegerPuanim.tsx
//
// CNETMOBIL - WingSM "Değer Puan Performansı" (personel ekranı)
//
// Ekran: başlık + rapor/mağaza seçicileri + "N gün kaldı", üstte 4 mağaza
// kartı (sıra, hedef %, çubuk, gerçekleşen, ay sonu tahmini), altında tam
// genişlikte Personel Performansı tablosu (sıra, puan, hedef, gerçekleşme
// çubuğu, ödül).
//
// Veri app/api/wingsm/deger-puanim/route.ts'ten gelir. O uç canlı WingSM
// hesabı YAPMAZ — adminin en son "HESAPLA" ile kaydettiği sonucu okur. Yani
// admin raporu yeniden hesaplamadıkça rakamlar değişmez; ekranda "Son
// güncelleme" ve "Rapor güncellendi / bekleniyor" bilgisi bu yüzden var.
//
// Renkler SIRAYA göre (bkz. degerPuanRenkleri.ts): personelde 1 koyu yeşil,
// 2-3 açık yeşil, 4-6 beyaz, 7 turuncu, diğerleri kırmızı; mağazada 1 koyu
// yeşil, 2 açık yeşil, 3 beyaz, 4 kırmızı. Sıralamaya girmeyenler (müdür,
// hedefsiz) kırmızı.

import React, { useEffect, useMemo, useRef, useState } from "react";

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
  bulunamadi?: boolean;
  istenenGun?: string | null;
  tamEsleme?: boolean;
  aySonuPaylasim?: boolean;
  durum?: "guncel" | "bekleniyor" | null;
  gunBilgisi: { gecenGun: number; ayToplamGun: number; kalanGun: number } | null;
  stores: StoreRow[];
  personnel: PersonnelRow[];
};

// Ay sonu duyurusu (otomatik hesap ayın 28'inde durur). Metni buradan değiştirin.
const AY_SONU_MESAJI = "Ay sonu raporu, ayın 1'inde yönetici tarafından gruptan paylaşılacaktır.";

type SortKey = "siralama" | "ad" | "puan" | "hedef" | "yuzde";

function formatNumber(value: number, digits = 0) {
  if (!Number.isFinite(value)) return "-";
  return value.toLocaleString("tr-TR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

// Tasarımdaki gibi önde yüzde işaretiyle: "%35,10"
function formatPercent(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "%0,00";
  return `%${formatNumber(value, 2)}`;
}

// Türkiye saatine göre bugünün tarihi ("YYYY-MM-DD").
function istanbulToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

// "YYYY-MM-DD" tarihine gün ekler/çıkarır.
function shiftDay(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

// "2026-10-09" -> "09.10.2026"
function formatIsoDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

// "09/10/2026" -> "2026-10-09" (biçim bozuksa null)
function slashToIso(value: string): string | null {
  const match = String(value || "").match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : null;
}

// Gün seçicideki seçim: Bugün / Dün / Önceki Gün ya da takvimden bir tarih.
type DayPick = { kind: "bugun" | "dun" | "onceki" | "tarih"; date?: string };

function dayPickLabel(pick: DayPick): string {
  if (pick.kind === "bugun") return "Bugün";
  if (pick.kind === "dun") return "Dün";
  if (pick.kind === "onceki") return "Önceki Gün";
  return pick.date ? formatIsoDate(pick.date) : "Tarih";
}

// API'ye gidecek "yayın günü" (Bugün için null = en güncel rapor).
function dayPickToGun(pick: DayPick): string | null {
  const today = istanbulToday();
  if (pick.kind === "dun") return shiftDay(today, -1);
  if (pick.kind === "onceki") return shiftDay(today, -2);
  if (pick.kind === "tarih" && pick.date && pick.date < today) return pick.date;
  return null;
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
      <div className={`h-full rounded-full box-border ${barClass}`} style={{ width: `${width}%` }} />
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

// Bugün / Dün / Önceki Gün seçici + takvim düğmesi (bölünmüş düğme).
function DayPicker({
  label,
  disabled,
  minDate,
  maxDate,
  onSelect,
}: {
  label: string;
  disabled: boolean;
  minDate?: string;
  maxDate: string;
  onSelect: (pick: DayPick) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;

    const close = (event: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const choose = (pick: DayPick) => {
    setOpen(false);
    onSelect(pick);
  };

  const openCalendar = () => {
    const input = dateInputRef.current;
    if (!input) return;

    if (typeof input.showPicker === "function") {
      input.showPicker();
    } else {
      input.focus();
      input.click();
    }
  };

  const items: Array<{ label: string; pick: DayPick }> = [
    { label: "Bugün", pick: { kind: "bugun" } },
    { label: "Dün", pick: { kind: "dun" } },
    { label: "Önceki Gün", pick: { kind: "onceki" } },
  ];

  return (
    <div ref={wrapRef} className="relative inline-flex">
      <div className="inline-flex h-11 overflow-hidden rounded-lg border border-blue-600 bg-white shadow-sm">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen((value) => !value)}
          className="bg-blue-600 px-4 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {label}
        </button>
        <button
          type="button"
          disabled={disabled}
          aria-label="Gün seç"
          onClick={() => setOpen((value) => !value)}
          className="flex w-9 items-center justify-center border-l border-blue-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          <ChevronDownIcon className="h-4 w-4" />
        </button>
        <button
          type="button"
          disabled={disabled}
          aria-label="Takvimden tarih seç"
          onClick={openCalendar}
          className="flex w-11 items-center justify-center border-l border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          <CalendarIcon className="h-5 w-5" />
        </button>
        <input
          ref={dateInputRef}
          type="date"
          min={minDate}
          max={maxDate}
          tabIndex={-1}
          aria-hidden="true"
          onChange={(event) => {
            if (event.target.value) {
              onSelect({ kind: "tarih", date: event.target.value });
              event.target.value = "";
            }
          }}
          className="pointer-events-none absolute left-0 top-full h-0 w-0 opacity-0"
        />
      </div>

      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 min-w-[160px] overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => choose(item.pick)}
              className={`block w-full px-4 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-100 ${
                item.label === label ? "bg-slate-100" : ""
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const SELECT_WRAP =
  "relative flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white pl-3 pr-9 text-sm font-semibold text-slate-700 shadow-sm";

export default function WingsmDegerPuanim() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [report, setReport] = useState<DegerPuanimReport | null>(null);

  const [pick, setPick] = useState<DayPick>({ kind: "bugun" });
  const [storeFilter, setStoreFilter] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortState>(null);

  const fetchReport = async (gun?: string | null) => {
    setLoading(true);
    setError("");

    try {
      const query = gun ? `?gun=${gun}` : "";
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

  const selectDay = (next: DayPick) => {
    setPick(next);
    void fetchReport(dayPickToGun(next));
  };

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

  if (!report.hasSnapshot && !report.bulunamadi) {
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

  // Ay sonu (28'i - ayın 1'i): otomatik hesap durur. Rapor güncel değilse
  // "bekleniyor" yerine ay sonu duyurusu gösterilir; yönetici elle güncellerse
  // normal "güncellendi" görünür.
  const aySonuDuyurusu = Boolean(report.aySonuPaylasim) && report.durum === "bekleniyor";

  // Takvimde seçilebilecek en erken gün: kayıtlı en eski raporun yayın günü
  // (bitiş + 1). Kayıt yoksa sınır konmaz.
  const earliestEnd = history
    .map((item) => slashToIso(item.tarih2))
    .filter((value): value is string => Boolean(value))
    .sort()[0];
  const minPickDate = earliestEnd ? shiftDay(earliestEnd, 1) : undefined;

  const allStores = magazalariSirala(report.stores);
  const visibleStores = storeFilter ? allStores.filter((s) => s.branchLabel === storeFilter) : allStores;

  return (
    <div className="animate-in fade-in duration-500 rounded-3xl bg-[#f3f8ff] p-3 sm:p-6">
      {/* Başlık + seçiciler */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-black text-[#1b2559] sm:text-3xl">Değer Puan Performansı</h1>
          <p className="mt-1 text-xs font-semibold text-slate-400">Son güncelleme: {formatComputedAt(report.computedAt)}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
            {report.durum === "guncel" && (
              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 font-bold text-emerald-700">
                ✓ Rapor güncellendi
              </span>
            )}
            {report.durum === "bekleniyor" && !aySonuDuyurusu && (
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 font-bold text-amber-700">
                ⏳ Rapor bekleniyor
              </span>
            )}
            {report.selectedHistoryId ? (
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 font-bold text-amber-700">
                Eski rapor görüntüleniyor
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <DayPicker
            label={dayPickLabel(pick)}
            disabled={loading}
            minDate={minPickDate}
            maxDate={istanbulToday()}
            onSelect={selectDay}
          />

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

          <span className="flex h-11 items-center gap-2 rounded-xl border border-blue-300 bg-white px-3 text-sm font-bold text-blue-700 shadow-sm">
            <CalendarIcon className="h-4 w-4 flex-none" />
            {gun ? `${gun.kalanGun} gün kaldı` : "-"}
          </span>
        </div>
      </div>

      {report.hasSnapshot && report.period && (
        <div
          className={`mt-4 rounded-xl border px-4 py-2.5 text-sm font-bold ${
            report.selectedHistoryId
              ? "border-amber-300 bg-amber-50 text-amber-900"
              : "border-blue-200 bg-blue-50 text-blue-900"
          }`}
        >
          {report.selectedHistoryId && report.istenenGun
            ? `${formatIsoDate(report.istenenGun)} tarihli rapor: `
            : "Güncel rapor: "}
          {formatRangeLong(report.period.tarih, report.period.tarih2)} arası
          {report.selectedHistoryId && report.tamEsleme === false && (
            <span className="ml-1 font-semibold">
              (o gün için ayrı rapor hazırlanmamıştı, en yakın önceki rapor gösteriliyor)
            </span>
          )}
        </div>
      )}

      {report.bulunamadi && (
        <div className="mt-4 rounded-xl border border-slate-200 bg-white px-5 py-8 text-center text-sm font-bold text-slate-500">
          {report.istenenGun ? `${formatIsoDate(report.istenenGun)} tarihi için` : "Bu tarih için"} kayıtlı rapor
          bulunamadı.
        </div>
      )}

      {aySonuDuyurusu && (
        <div className="mt-4 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm font-bold text-violet-900">
          📢 {AY_SONU_MESAJI}
          <div className="mt-0.5 text-xs font-semibold text-violet-700">Aşağıda ayın son güncel raporu görünüyor.</div>
        </div>
      )}

      {report.durum === "bekleniyor" && !aySonuDuyurusu && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-semibold text-amber-800">
          Yeni günün raporu henüz güncellenmedi, aşağıda son rapor görünüyor.
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs font-bold text-red-700">
          {error}
        </div>
      )}

      {!report.bulunamadi && (
        <>
      {/* MAĞAZA KARTLARI */}
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {visibleStores.map((store) => {
          const index = allStores.findIndex((s) => s.depotCode === store.depotCode);
          const colors = magazaGostergeRengi(index, store.hedefYuzdesi !== null);

          return (
            <div key={store.depotCode} className="relative rounded-2xl bg-white p-3 shadow-sm sm:p-4">
              {/* Mağaza sıralama puanı: 1. mağaza 10 puan, 2. mağaza 5 puan */}
              {store.siralamaPuani > 0 && (
                <span
                  className={`absolute -top-2.5 right-3 rounded-full px-2.5 py-0.5 text-[11px] font-black shadow-sm ${
                    index === 0 ? "bg-green-700 text-white" : "bg-lime-400 text-green-900"
                  }`}
                >
                  {store.siralamaPuani} PUAN
                </span>
              )}
              <div className="flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
                <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
                  <span className="inline-flex h-6 w-6 flex-none items-center justify-center rounded-full bg-blue-50 text-[10px] font-black text-blue-700 sm:h-7 sm:w-7 sm:text-[11px]">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="truncate text-sm font-black text-[#1b2559]">
                    {formatStoreName(store.branchLabel)}
                  </span>
                </div>
                <span className={`flex-none text-base font-black sm:text-xl ${colors.text}`}>
                  {formatPercent(store.hedefYuzdesi)}
                </span>
              </div>

              <div className="mt-3">
                <ProgressBar percent={store.hedefYuzdesi} barClass={colors.bar} />
              </div>

              <div className="mt-3 grid grid-cols-2 divide-x divide-slate-100">
                <div className="pr-2">
                  <div className="text-[11px] font-semibold text-slate-400">Gerçekleşen</div>
                  <div className="text-sm font-black text-[#1b2559] sm:text-lg">{formatNumber(store.carpanliPuan)}</div>
                </div>
                <div className="pl-3">
                  <div className="text-[11px] font-semibold text-slate-400">Ay sonu tahmini</div>
                  <div className="text-sm font-black text-[#1b2559] sm:text-lg">{formatNumber(store.projeksiyon)}</div>
                </div>
              </div>
            </div>
          );
        })}
        {visibleStores.length === 0 && (
          <div className="col-span-full rounded-2xl bg-white py-6 text-center text-xs font-bold text-slate-400">
            Mağaza bulunamadı.
          </div>
        )}
      </div>

      {/* PERSONEL PERFORMANSI */}
      <section className="mt-5 rounded-2xl bg-white p-3 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-black text-[#1b2559] sm:text-xl">Personel Performansı</h2>
            <p className="text-xs font-semibold text-slate-400">{personnelRows.length} personel</p>
          </div>
          <label className="relative block sm:w-72">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-blue-500" />
            <span className="sr-only">Personel ara</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Personel ara..."
              className="h-10 w-full rounded-lg border border-blue-200 bg-white pl-9 pr-3 text-sm text-slate-700 outline-none focus:border-blue-500"
            />
          </label>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70">
                <SortableTh label="Sıra" sortKey="siralama" sort={sort} onToggle={toggleSort} className="rounded-l-lg" />
                <SortableTh label="Personel" sortKey="ad" sort={sort} onToggle={toggleSort} />
                <SortableTh label="Toplam Puan" sortKey="puan" sort={sort} onToggle={toggleSort} className="hidden text-right sm:table-cell" />
                <SortableTh label="Hedef" sortKey="hedef" sort={sort} onToggle={toggleSort} className="hidden text-right sm:table-cell" />
                <SortableTh label="Gerçekleşme" sortKey="yuzde" sort={sort} onToggle={toggleSort} />
                <th className="rounded-r-lg px-1.5 py-3 text-center text-[11px] font-bold text-slate-500 sm:px-2">Ödül</th>
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
                    <td className="px-1.5 py-2.5 text-sm font-semibold text-[#1b2559] sm:px-2">
                      {titleCaseTr(person.saticiAdi || person.saticiKod)}
                      <div className="text-[11px] font-semibold text-slate-400 sm:hidden">
                        {formatNumber(person.carpanliPuan)} puan
                      </div>
                    </td>
                    <td className="hidden px-1.5 py-2.5 text-right text-sm font-semibold text-slate-700 sm:table-cell sm:px-2">
                      {formatNumber(person.carpanliPuan)}
                    </td>
                    <td className="hidden px-1.5 py-2.5 text-right text-sm font-semibold text-slate-700 sm:table-cell sm:px-2">
                      {formatNumber(person.hedef ?? 0)}
                    </td>
                    <td className="px-1.5 py-2.5 sm:w-[42%] sm:px-2">
                      <div className="flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:gap-3">
                        <span className={`flex-none text-xs font-bold sm:w-20 sm:text-sm ${colors.text}`}>
                          {formatPercent(percent)}
                        </span>
                        <div className="w-16 sm:w-auto sm:flex-1">
                          <ProgressBar percent={percent} barClass={colors.bar} />
                        </div>
                      </div>
                    </td>
                    <td className="px-1.5 py-2.5 text-center text-sm font-semibold text-slate-600 sm:px-2">
                      {person.siralamaPuani > 0 ? person.siralamaPuani : "-"}
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
        </>
      )}
    </div>
  );
}
