"use client";

// app/components/screens/PersonelGidisatEkrani.tsx
//
// CNETMOBIL - "Personel Gidişatı" ekranı (kişi kartları). Mağaza + personel seçilir,
// GÜN SEÇİCİ (Bugün / Dün / Önceki Gün / takvim) ile o günün raporuna bakılır.
// Üstte toplam puan, altında 9 kategori kartı: gerçekleşen / hedef, ilerleme çubuğu
// (barem işaretli), yüzde ve kazanılan puan.
//
// Veri: /api/wingsm/gidisat/sonuc (her gün 10:00'da otomatik yayınlanan rapor).
// Şimdilik sadece yönetici ("Yönetici Önizlemesi"); mağazalara açılınca her mağaza
// sadece kendi personelini görecek (sunucuda süzülecek).

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AY_SONU_MESAJI, formatNumber, formatRangeLong, formatStoreName, titleCaseTr } from "./degerPuanOrtak";
import {
  DayPicker,
  dayPickLabel,
  dayPickToGun,
  formatIsoDate,
  istanbulToday,
  shiftDay,
  slashToIso,
  type DayPick,
} from "./degerPuanGunSecici";

type Metric = "adet" | "karlilik" | "tutar" | "deger_puan";

type Category = { key: string; ad: string; metric: Metric; puan: number; maxPuan: number; baremPct: number | null };

type CategoryResult = {
  gerceklesen: number;
  hedef: number | null;
  oran: number | null;
  puan: number;
  riskli: boolean;
};

type PersonResult = {
  saticiAdi: string;
  branchLabel: string;
  kategoriler: Record<string, CategoryResult>;
  toplamPuan: number;
};

type Report = {
  hasReport: boolean;
  period?: string;
  range?: { tarih: string; tarih2: string };
  gunBilgisi?: { gecenGun: number; ayToplamGun: number; kalanGun: number };
  kategoriler?: Category[];
  kisiler?: PersonResult[];
  history?: Array<{ tarih: string; tarih2: string; computedAt: string }>;
  computedAt?: string;
  durum?: "guncel" | "bekleniyor" | null;
  aySonuPaylasim?: boolean;
  bulunamadi?: boolean;
  istenenGun?: string | null;
  tamEsleme?: boolean;
};

const ICON_PATHS: Record<string, string> = {
  cihaz_adet: "M8 2h8a1 1 0 011 1v18a1 1 0 01-1 1H8a1 1 0 01-1-1V3a1 1 0 011-1zM11 18h2",
  cihaz_kazanc: "M4 12a8 8 0 0113.7-5.6L20 8M20 4v4h-4M20 12a8 8 0 01-13.7 5.6L4 16M4 20v-4h4",
  cam: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z",
  saat_tablet: "M5 4h10a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V5a1 1 0 011-1zM19 8v8M16 17h0",
  samsung: "M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.5 6.6 19.5l1.2-6L3.3 9.3l6.1-.7L12 3z",
  zebleze: "M9 3h6l1 4H8l1-4zM8 17h8l-1 4H9l-1-4zM7 7h10a2 2 0 012 2v6a2 2 0 01-2 2H7a2 2 0 01-2-2V9a2 2 0 012-2z",
  aksesuar_ciro: "M4 15v-3a8 8 0 0116 0v3M4 15a2 2 0 002 2h1v-5H6a2 2 0 00-2 2zM20 15a2 2 0 01-2 2h-1v-5h1a2 2 0 012 2z",
  deger_puan: "M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.5 6.6 19.5l1.2-6L3.3 9.3l6.1-.7L12 3z",
  teknik_servis: "M14.7 6.3a4 4 0 00-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 005.4-5.4l-2.4 2.4-2.6-.6-.6-2.6 2.4-2.4z",
};

function CategoryIcon({ k }: { k: string }) {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d={ICON_PATHS[k] ?? ICON_PATHS.deger_puan} />
    </svg>
  );
}

function unitOf(metric: Metric) {
  if (metric === "adet") return " adet";
  if (metric === "deger_puan") return "";
  return " TL";
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toLocaleUpperCase("tr-TR");
}

// "2026-10-17T07:00:00Z" -> "17 Ekim, 10:00" (Türkiye saati)
function formatUpdated(iso: string | undefined) {
  if (!iso) return "-";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "-";

  const day = new Intl.DateTimeFormat("tr-TR", { timeZone: "Europe/Istanbul", day: "numeric", month: "long" }).format(date);
  const time = new Intl.DateTimeFormat("tr-TR", { timeZone: "Europe/Istanbul", hour: "2-digit", minute: "2-digit" }).format(date);

  return `${day}, ${time}`;
}

function PersonSelect({
  people,
  value,
  onChange,
}: {
  people: PersonResult[];
  value: string;
  onChange: (name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const close = (event: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) setOpen(false);
    };

    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const selected = people.find((person) => person.saticiAdi === value);
  const needle = query.trim().toLocaleLowerCase("tr-TR");
  const filtered = needle ? people.filter((person) => person.saticiAdi.toLocaleLowerCase("tr-TR").includes(needle)) : people;

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex h-11 w-60 items-center gap-2 rounded-xl border border-blue-300 bg-white px-3 text-left text-sm font-semibold text-slate-700 shadow-sm"
      >
        <span className="truncate">{selected ? titleCaseTr(selected.saticiAdi) : "Personel seçin"}</span>
        <span className="ml-auto text-slate-400">▾</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 w-72 rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Personel ara..."
            className="mb-2 h-9 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-400"
            autoFocus
          />
          <div className="max-h-72 overflow-y-auto">
            {filtered.map((person) => (
              <button
                key={`${person.branchLabel}-${person.saticiAdi}`}
                type="button"
                onClick={() => {
                  onChange(person.saticiAdi);
                  setOpen(false);
                  setQuery("");
                }}
                className={`flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-slate-50 ${
                  person.saticiAdi === value ? "bg-blue-50" : ""
                }`}
              >
                <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-blue-50 text-[10px] font-black text-blue-700">
                  {initials(person.saticiAdi)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-[#102A56]">{titleCaseTr(person.saticiAdi)}</span>
                  <span className="block text-[10px] font-semibold text-slate-400">{formatStoreName(person.branchLabel)}</span>
                </span>
                {person.saticiAdi === value && <span className="text-blue-600">✓</span>}
              </button>
            ))}
            {filtered.length === 0 && <div className="px-3 py-4 text-center text-xs font-bold text-slate-400">Personel bulunamadı.</div>}
          </div>
        </div>
      )}
    </div>
  );
}

export default function PersonelGidisatEkrani({ yonetici }: { yonetici: boolean }) {
  const [pick, setPick] = useState<DayPick>({ kind: "bugun" });
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [storeFilter, setStoreFilter] = useState("");
  const [selectedName, setSelectedName] = useState("");

  const load = useCallback(async (gun: string | null) => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/wingsm/gidisat/sonuc${gun ? `?gun=${gun}` : ""}`, {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
      });
      const payload = await res.json().catch(() => null);

      if (!res.ok || !payload?.success) {
        throw new Error(payload?.error || `HTTP ${res.status}`);
      }

      setReport(payload as Report);
    } catch (err) {
      setReport(null);
      setError(err instanceof Error ? err.message : "Gidişat alınamadı.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(dayPickToGun(pick));
  }, [pick, load]);

  const minPickDate = useMemo(() => {
    const earliest = (report?.history ?? [])
      .map((item) => slashToIso(item.tarih2))
      .filter((value): value is string => Boolean(value))
      .sort()[0];

    return earliest ? shiftDay(earliest, 1) : undefined;
  }, [report]);

  const allPeople = useMemo(() => report?.kisiler ?? [], [report]);
  const stores = useMemo(() => Array.from(new Set(allPeople.map((person) => person.branchLabel))).sort(), [allPeople]);

  const people = useMemo(
    () =>
      allPeople
        .filter((person) => !storeFilter || person.branchLabel === storeFilter)
        .sort((a, b) => a.saticiAdi.localeCompare(b.saticiAdi, "tr")),
    [allPeople, storeFilter]
  );

  const person = people.find((item) => item.saticiAdi === selectedName) ?? people[0] ?? null;

  const beklemede = report?.hasReport === true && report.durum === "bekleniyor" && !yonetici;
  const raporYok = report !== null && !report.hasReport && !report.bulunamadi;

  return (
    <div className="rounded-3xl bg-[#f6f8fc] p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-black tracking-tight text-[#0f1b3d]">Personel Gidişatı</h1>
          {yonetici && (
            <span className="rounded-lg border border-blue-400 bg-white px-3 py-1 text-xs font-bold text-blue-600">
              Yönetici Önizlemesi
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <label>
            <div className="mb-1 text-[10px] font-bold text-slate-500">Mağaza</div>
            <select
              value={storeFilter}
              onChange={(e) => setStoreFilter(e.target.value)}
              className="h-11 min-w-[170px] rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none"
            >
              <option value="">Tüm mağazalar</option>
              {stores.map((store) => (
                <option key={store} value={store}>
                  {formatStoreName(store)}
                </option>
              ))}
            </select>
          </label>

          <div>
            <div className="mb-1 text-[10px] font-bold text-slate-500">Personel</div>
            <PersonSelect people={people} value={person?.saticiAdi ?? ""} onChange={setSelectedName} />
          </div>

          <div>
            <div className="mb-1 text-[10px] font-bold text-slate-500">Gün</div>
            <DayPicker
              label={dayPickLabel(pick)}
              disabled={loading}
              minDate={minPickDate}
              maxDate={istanbulToday()}
              onSelect={setPick}
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs font-bold text-red-700">{error}</div>
      )}

      {loading && !report && <div className="mt-6 text-sm font-bold text-slate-400">Yükleniyor...</div>}

      {report?.hasReport && report.range && !beklemede && (
        <div
          className={`mt-4 rounded-xl border px-4 py-2.5 text-sm font-bold ${
            report.durum === null ? "border-amber-300 bg-amber-50 text-amber-900" : "border-blue-200 bg-blue-50 text-blue-900"
          }`}
        >
          {report.istenenGun ? `${formatIsoDate(report.istenenGun)} tarihli rapor: ` : "Güncel rapor: "}
          {formatRangeLong(report.range.tarih, report.range.tarih2)} arası
          {report.istenenGun && report.tamEsleme === false && (
            <span className="ml-1 font-semibold">(o gün için ayrı rapor hazırlanmamıştı, en yakın önceki rapor gösteriliyor)</span>
          )}
          {yonetici && report.durum === "bekleniyor" && (
            <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-black text-amber-800">
              Rapor güncel değil (yeni günün raporu henüz hesaplanmadı)
            </span>
          )}
        </div>
      )}

      {report && !report.hasReport && report.bulunamadi && (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-5 py-8 text-center text-sm font-bold text-slate-500">
          {report.istenenGun ? `${formatIsoDate(report.istenenGun)} tarihi için` : "Bu tarih için"} kayıtlı rapor bulunamadı.
        </div>
      )}

      {/* Rapor yok / yeni gün 10:00 öncesi: eski rakamlar gösterilmez. */}
      {(raporYok || beklemede) && (
        <div className="mt-5 flex min-h-[260px] flex-col items-center justify-center rounded-2xl bg-white px-6 py-12 text-center shadow-sm">
          <div className="text-5xl">{report?.aySonuPaylasim ? "📢" : "⏳"}</div>
          <div className="mt-4 text-2xl font-black text-[#1b2559]">
            {report?.aySonuPaylasim ? "Ay sonu raporu" : "Rapor bekleniyor"}
          </div>
          <p className="mt-2 max-w-md text-sm font-semibold text-slate-500">
            {report?.aySonuPaylasim
              ? AY_SONU_MESAJI
              : "Personel Gidişat raporu her gün saat 10:00'da otomatik yayınlanır; yayınlanınca burada görünecek."}
          </p>
          {beklemede && (
            <p className="mt-3 text-xs font-semibold text-slate-400">
              Önceki günün raporunu görmek için sağ üstteki seçiciden &quot;Dün&quot;ü seçebilirsiniz.
            </p>
          )}
        </div>
      )}

      {report?.hasReport && !beklemede && !person && (
        <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-white py-10 text-center text-sm font-bold text-slate-400">
          Bu raporda personel yok. Önce Hedefler sekmesinden kişileri ve hedefleri girin.
        </div>
      )}

      {report?.hasReport && !beklemede && person && report.kategoriler && (
        <>
          <div className="mt-5 flex flex-wrap items-center gap-4 rounded-2xl bg-white px-5 py-4 shadow-sm">
            <span className="flex h-14 w-14 flex-none items-center justify-center rounded-full bg-blue-50 text-lg font-black text-blue-700">
              {initials(person.saticiAdi)}
            </span>
            <div className="min-w-0">
              <div className="truncate text-xl font-black text-[#0f1b3d]">{titleCaseTr(person.saticiAdi)}</div>
              <div className="text-sm font-semibold text-slate-500">{formatStoreName(person.branchLabel)}</div>
            </div>
            <div className="ml-auto text-xs font-medium text-slate-500">Son güncelleme: {formatUpdated(report.computedAt)}</div>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.6fr)]">
            <div className="flex items-center gap-4 rounded-2xl bg-[#14305f] px-6 py-5 text-white shadow-sm">
              <span className="flex h-12 w-12 flex-none items-center justify-center rounded-xl bg-white/10 text-2xl">🏆</span>
              <div>
                <div className="text-sm font-bold text-blue-100">Toplam Puan</div>
                <div className="text-5xl font-black leading-tight">{formatNumber(person.toplamPuan, 1)}</div>
                <div className="text-[11px] font-medium text-blue-200">Seçilen personelin bu ayki puanı</div>
              </div>
            </div>

            <div className="flex items-center gap-4 rounded-2xl bg-white px-6 py-5 shadow-sm">
              <span className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-blue-50 text-2xl">🎯</span>
              <div>
                <div className="text-xl font-black text-[#0f1b3d]">Hedefleriniz</div>
                <p className="text-sm font-medium text-slate-500">
                  Her kategori için gerçekleşen, hedef ve kazanılan puan
                  {report.gunBilgisi ? ` · ${report.gunBilgisi.gecenGun} gün geçti, ${report.gunBilgisi.kalanGun} gün kaldı` : ""}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {report.kategoriler.map((category) => {
              const cell = person.kategoriler[category.key];

              if (!cell) return null;

              const complete = cell.oran !== null && cell.oran >= 100;
              const width = cell.oran === null ? 0 : Math.min(100, Math.max(cell.oran > 0 ? 2 : 0, cell.oran));

              return (
                <div key={category.key} className="rounded-2xl bg-white p-4 shadow-sm">
                  <div className="flex items-start gap-3">
                    <span className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-blue-50 text-blue-600">
                      <CategoryIcon k={category.key} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-slate-600">{category.ad}</span>
                        {complete && (
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-black text-emerald-700">
                            ✓ Hedef tamamlandı
                          </span>
                        )}
                        {cell.riskli && (
                          <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-black text-red-600">Barem altı</span>
                        )}
                      </div>
                      <div className="mt-0.5 flex items-baseline gap-1.5">
                        <span className="text-3xl font-black leading-tight text-[#0f1b3d]">{formatNumber(cell.gerceklesen)}</span>
                        <span className="text-sm font-semibold text-slate-400">
                          / {cell.hedef === null ? "hedef yok" : `${formatNumber(cell.hedef)}${unitOf(category.metric)}`}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="relative mt-3 h-2.5 w-full rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full ${complete ? "bg-emerald-500" : "bg-blue-500"}`}
                      style={{ width: `${width}%` }}
                    />
                    {category.baremPct !== null && category.baremPct < 100 && (
                      <span
                        className="absolute -top-1 bottom-[-4px] border-l border-dashed border-slate-400"
                        style={{ left: `${category.baremPct}%` }}
                        title={`Barem %${category.baremPct}`}
                      />
                    )}
                  </div>

                  <div className="mt-2 flex items-center justify-between text-sm font-bold">
                    <span className="text-slate-600">{cell.oran === null ? "-" : `%${formatNumber(cell.oran, cell.oran < 10 ? 1 : 0)}`}</span>
                    <span className={complete ? "text-emerald-600" : "text-blue-600"}>{formatNumber(cell.puan, 1)} puan</span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
