"use client";

// app/components/screens/PersonelGidisat.tsx
//
// CNETMOBIL - CMR "Personel Gidişat" (yönetici; eski Sheets PersonelGidisat'ın yerine)
//   Sonuç      - tarih aralığı + HESAPLA; kişi x 9 kategori gerçekleşen/hedef/puan
//   Hedefler   - kişi başı aylık hedefler (Excel'den yapıştırılabilir)
//   Kategoriler- 9 kategorinin puan / max puan / barem / ölçü / kuralı
// Gerçekleşen WingSM satışlarından kendiliğinden gelir (api/wingsm/gidisat/*).

import React, { useCallback, useEffect, useMemo, useState } from "react";

import PersonelGidisatEkrani from "./PersonelGidisatEkrani";
import { formatNumber, formatRangeLong, titleCaseTr } from "./degerPuanOrtak";

type Metric = "adet" | "karlilik" | "tutar" | "deger_puan";

type CategoryRule = {
  siniflar: string[];
  adBaslar: string[];
  adGerekli: string[];
  adIcerir: string[];
  adIcermez: string[];
  minFiyat: number | null;
};

type Category = {
  key: string;
  ad: string;
  metric: Metric;
  puan: number;
  maxPuan: number;
  baremPct: number | null;
  aktif: boolean;
  rule: CategoryRule;
};

type Settings = { iadeNet: boolean; tutarAlani: string; fiyatAlani: string };

type CategoryResult = {
  gerceklesen: number;
  hedef: number | null;
  oran: number | null;
  puan: number;
  tahminGerceklesen: number;
  tahminOran: number | null;
  tahminPuan: number;
  riskli: boolean;
};

type PersonResult = {
  saticiAdi: string;
  branchLabel: string;
  kategoriler: Record<string, CategoryResult>;
  toplamPuan: number;
  tahminiToplamPuan: number;
};

type Report = {
  hasReport?: boolean;
  period: string;
  range: { tarih: string; tarih2: string };
  gunBilgisi: { gecenGun: number; ayToplamGun: number; kalanGun: number };
  kategoriler: Category[];
  kisiler: PersonResult[];
  hedefsizSaticilar: Array<{ saticiAdi: string; branchLabel: string; gerceklesen: Record<string, number> }>;
  alanlar: { adet: string | null; tutar: string | null; fiyat: string | null };
  degerPuanKaynak: { tarih: string; tarih2: string } | null;
  satirSayisi: number;
  uyarilar: string[];
  computedAt?: string;
};

type TargetRow = { key: number; branchLabel: string; saticiAdi: string; hedefler: Record<string, string> };

const BRANCHES = ["CMR MERKEZ", "CMR CADDE", "CMR SARAY", "CMR KAPAKLI"];

const METRIC_LABEL: Record<Metric, string> = {
  adet: "Adet",
  karlilik: "Kârlılık",
  tutar: "Tutar (ciro)",
  deger_puan: "Değer Puan",
};

type SubTab = "sonuc" | "ekran" | "hedefler" | "kategoriler";

async function api<T = Record<string, unknown>>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: "same-origin", cache: "no-store", ...init });
  const payload = await res.json().catch(() => null);

  if (!res.ok || !payload?.success) {
    throw new Error(payload?.error || `HTTP ${res.status}`);
  }

  return payload as T;
}

const pad = (value: number) => String(value).padStart(2, "0");

function defaultRange() {
  const end = new Date();
  end.setDate(end.getDate() - 1);
  const start = new Date(end.getFullYear(), end.getMonth(), 1);
  const fmt = (date: Date) => `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`;
  return { bastar: fmt(start), bittar: fmt(end) };
}

function currentPeriod() {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
}

function previousPeriod(period: string) {
  const [year, month] = period.split("-").map(Number);
  const date = new Date(year, month - 2, 1);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

function parseNumber(value: string): number {
  const cleaned = String(value ?? "").trim().replace(/\./g, "").replace(",", ".");
  if (cleaned === "") return NaN;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : NaN;
}

function listText(list: string[]) {
  return list.join(", ");
}

function parseList(text: string) {
  return text
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

let rowKeySeed = 1;

const MessageBox = ({ message }: { message: { type: "ok" | "err"; text: string } | null }) =>
  message ? (
    <div
      className={`mt-3 rounded-lg border px-4 py-3 text-xs font-bold ${
        message.type === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"
      }`}
    >
      {message.text}
    </div>
  ) : null;

export default function PersonelGidisat() {
  const [tab, setTab] = useState<SubTab>("sonuc");

  // ---------------- AYARLAR (kategoriler) ----------------
  const [categories, setCategories] = useState<Category[]>([]);
  const [settings, setSettings] = useState<Settings>({ iadeNet: true, tutarAlani: "", fiyatAlani: "" });
  const [configMsg, setConfigMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [configBusy, setConfigBusy] = useState(false);
  const [classList, setClassList] = useState<Array<{ sinif: string; adi: string; rowCount: number }> | null>(null);
  const [classBusy, setClassBusy] = useState(false);

  const loadConfig = useCallback(async () => {
    try {
      const data = await api<{ categories: Category[]; settings: Settings }>("/api/wingsm/gidisat/config");
      setCategories(data.categories);
      setSettings(data.settings);
    } catch (err) {
      setConfigMsg({ type: "err", text: err instanceof Error ? err.message : "Ayarlar alınamadı." });
    }
  }, []);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  const updateCategory = (key: string, patch: Partial<Category>) =>
    setCategories((current) => current.map((item) => (item.key === key ? { ...item, ...patch } : item)));

  const updateRule = (key: string, patch: Partial<CategoryRule>) =>
    setCategories((current) => current.map((item) => (item.key === key ? { ...item, rule: { ...item.rule, ...patch } } : item)));

  const saveConfig = async () => {
    setConfigBusy(true);
    setConfigMsg(null);

    try {
      const data = await api<{ categories: Category[]; settings: Settings }>("/api/wingsm/gidisat/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categories, settings }),
      });

      setCategories(data.categories);
      setSettings(data.settings);
      setConfigMsg({ type: "ok", text: "Kategori ayarları kaydedildi. Bir sonraki HESAPLA'dan itibaren geçerli." });
    } catch (err) {
      setConfigMsg({ type: "err", text: err instanceof Error ? err.message : "Kaydedilemedi." });
    } finally {
      setConfigBusy(false);
    }
  };

  const fetchClasses = async () => {
    setClassBusy(true);

    try {
      const range = defaultRange();
      const query = new URLSearchParams({ bastar: range.bastar, bittar: range.bittar, kanal: "cmr", kaynak: "liste" });
      const data = await api<{ siniflar: Array<{ sinif: string; adi: string; rowCount: number }> }>(
        `/api/wingsm/satis-incele?${query.toString()}`
      );

      setClassList(data.siniflar);
    } catch (err) {
      setConfigMsg({ type: "err", text: err instanceof Error ? err.message : "Sınıflar alınamadı." });
    } finally {
      setClassBusy(false);
    }
  };

  // ---------------- HEDEFLER ----------------
  const [period, setPeriod] = useState(currentPeriod);
  const [rows, setRows] = useState<TargetRow[]>([]);
  const [targetsLoaded, setTargetsLoaded] = useState(false);
  const [targetsMsg, setTargetsMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [targetsBusy, setTargetsBusy] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [pasteBranch, setPasteBranch] = useState(BRANCHES[0]);

  const applyTargets = useCallback((people: Array<{ branchLabel: string; saticiAdi: string; hedefler: Record<string, number> }>) => {
    setRows(
      people.map((person) => ({
        key: rowKeySeed++,
        branchLabel: person.branchLabel,
        saticiAdi: person.saticiAdi,
        hedefler: Object.fromEntries(Object.entries(person.hedefler).map(([key, value]) => [key, String(value)])),
      }))
    );
  }, []);

  const loadTargets = useCallback(
    async (targetPeriod: string) => {
      setTargetsMsg(null);
      setTargetsLoaded(false);

      try {
        const data = await api<{
          kisiler: Array<{ branchLabel: string; saticiAdi: string; hedefler: Record<string, number> }>;
        }>(`/api/wingsm/gidisat/targets?period=${encodeURIComponent(targetPeriod)}`);

        applyTargets(data.kisiler);
        setTargetsLoaded(true);
      } catch (err) {
        setTargetsMsg({ type: "err", text: err instanceof Error ? err.message : "Hedefler alınamadı." });
      }
    },
    [applyTargets]
  );

  useEffect(() => {
    if (tab === "hedefler") void loadTargets(period);
  }, [tab, period, loadTargets]);

  const copyPrevious = async () => {
    setTargetsMsg(null);

    try {
      const data = await api<{
        kisiler: Array<{ branchLabel: string; saticiAdi: string; hedefler: Record<string, number> }>;
      }>(`/api/wingsm/gidisat/targets?period=${encodeURIComponent(previousPeriod(period))}`);

      if (data.kisiler.length === 0) {
        setTargetsMsg({ type: "err", text: "Önceki ayda kayıtlı hedef yok." });
        return;
      }

      applyTargets(data.kisiler);
      setTargetsMsg({ type: "ok", text: "Önceki ayın hedefleri forma kopyalandı. KAYDET'e basana kadar kaydedilmez." });
    } catch (err) {
      setTargetsMsg({ type: "err", text: err instanceof Error ? err.message : "Kopyalanamadı." });
    }
  };

  const activeCats = useMemo(() => categories.filter((category) => category.aktif), [categories]);

  const addPasted = () => {
    const parsed: TargetRow[] = [];

    for (const line of pasteText.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      const parts = trimmed.split(/\t|;/).map((part) => part.trim());
      const name = parts[0];

      if (!name) continue;

      const hedefler: Record<string, string> = {};
      activeCats.forEach((category, index) => {
        const value = parts[index + 1];
        if (value !== undefined && value !== "" && value !== "-") hedefler[category.key] = value;
      });

      parsed.push({ key: rowKeySeed++, branchLabel: pasteBranch, saticiAdi: name, hedefler });
    }

    if (parsed.length === 0) {
      setTargetsMsg({
        type: "err",
        text: "Satırlar okunamadı. Her satır: Ad Soyad ve sonra kategori hedefleri (Tab ile ayrılmış, sütun sırası tablo başlığıyla aynı).",
      });
      return;
    }

    setRows((current) => [...current, ...parsed]);
    setPasteText("");
    setTargetsMsg({ type: "ok", text: `${parsed.length} satır eklendi. KAYDET'e basana kadar kaydedilmez.` });
  };

  const saveTargets = async () => {
    const kisiler: Array<{ branchLabel: string; saticiAdi: string; hedefler: Record<string, number> }> = [];

    for (const row of rows) {
      const name = row.saticiAdi.trim();
      if (!name) continue;

      const hedefler: Record<string, number> = {};

      for (const [key, value] of Object.entries(row.hedefler)) {
        if (value.trim() === "" || value.trim() === "-") continue;

        const n = parseNumber(value);

        if (!Number.isFinite(n) || n < 0) {
          setTargetsMsg({ type: "err", text: `${name} için hedef geçersiz: "${value}".` });
          return;
        }

        hedefler[key] = n;
      }

      kisiler.push({ branchLabel: row.branchLabel, saticiAdi: name, hedefler });
    }

    setTargetsBusy(true);
    setTargetsMsg(null);

    try {
      await api("/api/wingsm/gidisat/targets", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period, kisiler }),
      });

      setTargetsMsg({ type: "ok", text: `${period} hedefleri kaydedildi (${kisiler.length} kişi).` });
      await loadTargets(period);
    } catch (err) {
      setTargetsMsg({ type: "err", text: err instanceof Error ? err.message : "Kaydedilemedi." });
    } finally {
      setTargetsBusy(false);
    }
  };

  // ---------------- SONUÇ ----------------
  const initialRange = useMemo(defaultRange, []);
  const [bastar, setBastar] = useState(initialRange.bastar);
  const [bittar, setBittar] = useState(initialRange.bittar);
  const [report, setReport] = useState<Report | null>(null);
  const [reportMsg, setReportMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [reportBusy, setReportBusy] = useState(false);
  const [showForecast, setShowForecast] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);

  const loadLatest = useCallback(async () => {
    try {
      const data = await api<Report & { hasReport: boolean }>("/api/wingsm/gidisat/sonuc");
      setReport(data.hasReport ? data : null);
    } catch (err) {
      setReportMsg({ type: "err", text: err instanceof Error ? err.message : "Sonuç alınamadı." });
    }
  }, []);

  useEffect(() => {
    if (tab === "sonuc") void loadLatest();
  }, [tab, loadLatest]);

  const runReport = async () => {
    setReportBusy(true);
    setReportMsg(null);

    try {
      const data = await api<Report>("/api/wingsm/gidisat/hesapla", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bastar, bittar }),
      });

      setReport(data);
      setReportMsg({ type: "ok", text: "Hesaplandı ve kaydedildi." });
    } catch (err) {
      setReportMsg({ type: "err", text: err instanceof Error ? err.message : "Hesaplanamadı." });
    } finally {
      setReportBusy(false);
    }
  };

  const resetReports = async () => {
    const ok = window.confirm(
      "Kayıtlı TÜM Personel Gidişat raporları silinecek (hedefler ve kategori ayarları silinmez).\n\n" +
        "Bugün için otomatik yayın da yapılmaz; ilk yeni rapor yarın saat 12:00'da yayınlanır.\n\nDevam edilsin mi?"
    );

    if (!ok) return;

    setResetBusy(true);
    setReportMsg(null);

    try {
      const data = await api<{ deletedReports: number }>("/api/wingsm/gidisat/sonuc", {
        method: "DELETE",
      });

      setReport(null);
      setReportMsg({ type: "ok", text: `${data.deletedReports} rapor silindi.` });
    } catch (err) {
      setReportMsg({ type: "err", text: err instanceof Error ? err.message : "Silinemedi." });
    } finally {
      setResetBusy(false);
    }
  };

  const tabButton = (id: SubTab, label: string) => (
    <button
      key={id}
      type="button"
      onClick={() => setTab(id)}
      className={`h-9 rounded-lg px-4 text-xs font-black uppercase tracking-wide transition ${
        tab === id ? "bg-blue-600 text-white" : "bg-white text-slate-500 hover:bg-slate-50"
      }`}
    >
      {label}
    </button>
  );

  const totalMax = activeCats.reduce((sum, category) => sum + category.puan, 0);
  const totalCap = activeCats.reduce((sum, category) => sum + category.maxPuan, 0);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-1.5">
        {tabButton("sonuc", "Sonuç")}
        {tabButton("ekran", "Personel Ekranı")}
        {tabButton("hedefler", "Hedefler")}
        {tabButton("kategoriler", "Kategoriler")}
        <span className="ml-auto pr-2 text-[10px] font-bold text-violet-700">
          Şimdilik sadece yönetici görür · puan toplamı {totalMax}/{totalCap}
        </span>
      </div>

      {/* ================= SONUÇ ================= */}
      {tab === "sonuc" && (
        <div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h1 className="text-2xl font-black">Personel Gidişat</h1>
            <p className="mt-1 text-sm text-slate-500">
              Tarih aralığını seçip HESAPLA&apos;ya basın. Gerçekleşenler WingSM satışlarından, hedefler Hedefler sekmesinden
              gelir. Puan = min(max puan, puan × gerçekleşen ÷ hedef); barem altında 0.
            </p>

            <div className="mt-4 flex flex-wrap items-end gap-3">
              <label>
                <div className="mb-1 text-[10px] font-black uppercase text-slate-500">Başlangıç (GG.AA.YYYY)</div>
                <input
                  value={bastar}
                  onChange={(e) => setBastar(e.target.value)}
                  className="h-10 w-40 rounded-lg border border-slate-200 px-3 text-sm"
                />
              </label>
              <label>
                <div className="mb-1 text-[10px] font-black uppercase text-slate-500">Bitiş (GG.AA.YYYY)</div>
                <input
                  value={bittar}
                  onChange={(e) => setBittar(e.target.value)}
                  className="h-10 w-40 rounded-lg border border-slate-200 px-3 text-sm"
                />
              </label>
              <button
                type="button"
                onClick={() => void runReport()}
                disabled={reportBusy}
                className="h-10 rounded-lg bg-blue-700 px-5 text-sm font-black text-white hover:bg-blue-800 disabled:opacity-50"
              >
                {reportBusy ? "HESAPLANIYOR..." : "HESAPLA"}
              </button>
              <button
                type="button"
                onClick={() => void resetReports()}
                disabled={resetBusy}
                className="h-10 rounded-lg border border-red-200 bg-white px-4 text-xs font-black uppercase text-red-600 hover:bg-red-50 disabled:opacity-50"
                title="Test için hesaplanan tüm Gidişat raporlarını siler (hedefler silinmez)"
              >
                {resetBusy ? "Siliniyor..." : "Tüm raporları sil"}
              </button>
              <label className="flex h-10 items-center gap-2 text-[11px] font-black uppercase text-slate-600">
                <input type="checkbox" checked={showForecast} onChange={(e) => setShowForecast(e.target.checked)} className="h-4 w-4" />
                Ay sonu tahminini göster
              </label>
            </div>

            <MessageBox message={reportMsg} />
          </div>

          {report && (
            <div className="mt-5 space-y-4">
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
                <span className="rounded-full bg-blue-50 px-3 py-1 text-blue-700">
                  {formatRangeLong(report.range.tarih, report.range.tarih2)} arası
                </span>
                <span className="rounded-full bg-sky-100 px-3 py-1 text-sky-800">Gün: {report.gunBilgisi.gecenGun}</span>
                <span className="rounded-full bg-red-100 px-3 py-1 text-red-700">Kalan gün: {report.gunBilgisi.kalanGun}</span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">{report.satirSayisi} satış satırı</span>
                {report.alanlar && (
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">
                    Alanlar: adet {report.alanlar.adet ?? "yok"} · tutar {report.alanlar.tutar ?? "yok"} · fiyat{" "}
                    {report.alanlar.fiyat ?? "yok"}
                  </span>
                )}
              </div>

              {report.uyarilar.length > 0 && (
                <div className="space-y-1 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[11px] font-bold text-amber-800">
                  {report.uyarilar.map((warning) => (
                    <div key={warning}>⚠ {warning}</div>
                  ))}
                </div>
              )}

              <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
                <table className="w-full min-w-[1100px] text-left">
                  <thead>
                    <tr className="bg-yellow-300 text-[10px] font-black uppercase text-slate-900">
                      <th className="px-3 py-2">Personel</th>
                      {report.kategoriler.map((category) => (
                        <th key={category.key} className="px-2 py-2 text-center">
                          {category.ad}
                          <div className="mt-0.5 text-[9px] font-semibold normal-case text-slate-700">
                            {category.puan}/{category.maxPuan} puan
                            {category.baremPct !== null ? ` · barem %${category.baremPct}` : ""}
                          </div>
                        </th>
                      ))}
                      <th className="px-3 py-2 text-center">Toplam Puan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {[...report.kisiler]
                      .sort((a, b) => b.toplamPuan - a.toplamPuan)
                      .map((person) => (
                        <tr key={`${person.branchLabel}-${person.saticiAdi}`}>
                          <td className="px-3 py-2 text-[12px] font-black text-slate-800">
                            {titleCaseTr(person.saticiAdi)}
                            <div className="text-[10px] font-semibold text-slate-400">{person.branchLabel}</div>
                          </td>
                          {report.kategoriler.map((category) => {
                            const cell = person.kategoriler[category.key];

                            if (!cell) return <td key={category.key} />;

                            const gerc = showForecast ? cell.tahminGerceklesen : cell.gerceklesen;
                            const oran = showForecast ? cell.tahminOran : cell.oran;
                            const puan = showForecast ? cell.tahminPuan : cell.puan;

                            return (
                              <td key={category.key} className="px-2 py-2 text-center text-[11px] font-semibold text-slate-600">
                                <div>
                                  <b className="text-slate-800">{formatNumber(gerc)}</b>
                                  <span className="text-slate-400"> / {cell.hedef === null ? "-" : formatNumber(cell.hedef)}</span>
                                </div>
                                <div className="text-[10px]">
                                  {oran === null ? "hedef yok" : `%${formatNumber(oran, 1)}`}
                                  {" · "}
                                  <b className={puan > 0 ? "text-emerald-700" : "text-slate-400"}>{formatNumber(puan, 1)} p</b>
                                </div>
                                {!showForecast && cell.riskli && (
                                  <span className="mt-0.5 inline-block rounded bg-red-100 px-1.5 text-[9px] font-black text-red-700">
                                    BAREM ALTI
                                  </span>
                                )}
                              </td>
                            );
                          })}
                          <td className="px-3 py-2 text-center text-sm font-black text-[#102A56]">
                            {formatNumber(showForecast ? person.tahminiToplamPuan : person.toplamPuan, 1)}
                          </td>
                        </tr>
                      ))}
                    {report.kisiler.length === 0 && (
                      <tr>
                        <td colSpan={report.kategoriler.length + 2} className="px-4 py-8 text-center text-xs font-bold text-slate-400">
                          Bu dönem için hedefte kimse yok. Önce Hedefler sekmesinden kişileri ve hedefleri girin.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {report.hedefsizSaticilar.length > 0 && (
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="text-sm font-black text-slate-700">
                    Hedefi olmayan satıcılar ({report.hedefsizSaticilar.length})
                  </div>
                  <p className="mt-1 text-[11px] font-semibold text-slate-400">
                    WingSM&apos;de satış yapmış ama Hedefler listesinde adı yok (ya da adı farklı yazılmış). Hedefler sekmesine
                    ekleyin.
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {report.hedefsizSaticilar.map((person) => (
                      <span
                        key={person.saticiAdi}
                        className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-bold text-slate-600"
                      >
                        {titleCaseTr(person.saticiAdi)} <span className="font-semibold text-slate-400">· {person.branchLabel}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {!report && (
            <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-white py-12 text-center text-sm font-bold text-slate-400">
              Henüz Personel Gidişat hesaplanmadı. Hedefleri girin ve HESAPLA&apos;ya basın.
            </div>
          )}
        </div>
      )}

      {/* ================= PERSONEL EKRANI (kişi kartları, gün seçicili) ================= */}
      {tab === "ekran" && <PersonelGidisatEkrani yonetici />}

      {/* ================= HEDEFLER ================= */}
      {tab === "hedefler" && (
        <div>
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <div>
              <h1 className="text-2xl font-black">Personel Hedefleri</h1>
              <p className="mt-1 text-sm text-slate-500">
                Kişi başı aylık hedefler. Ad, WingSM&apos;deki satıcı adıyla AYNI yazılmalı (Türkçe karakterler dahil). Hedef
                boşsa o kategori puan vermez.
              </p>
            </div>
            <label className="ml-auto">
              <div className="mb-1 text-[10px] font-black uppercase text-slate-500">Dönem</div>
              <input
                type="month"
                value={period}
                onChange={(e) => e.target.value && setPeriod(e.target.value)}
                className="h-10 rounded-lg border border-slate-200 px-3 text-sm"
              />
            </label>
            <button
              type="button"
              onClick={() => void copyPrevious()}
              className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-xs font-black uppercase text-slate-600 hover:bg-slate-50"
            >
              Önceki aydan kopyala
            </button>
            <button
              type="button"
              onClick={() => void saveTargets()}
              disabled={targetsBusy || !targetsLoaded}
              className="h-10 rounded-lg bg-blue-700 px-5 text-sm font-black text-white hover:bg-blue-800 disabled:opacity-50"
            >
              {targetsBusy ? "KAYDEDİLİYOR..." : "KAYDET"}
            </button>
          </div>

          <MessageBox message={targetsMsg} />

          <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full min-w-[1150px] text-left">
              <thead>
                <tr className="bg-yellow-300 text-[10px] font-black uppercase text-slate-900">
                  <th className="px-2 py-2">Mağaza</th>
                  <th className="px-2 py-2">Ad Soyad</th>
                  {activeCats.map((category) => (
                    <th key={category.key} className="px-1 py-2 text-center">
                      {category.ad}
                      <div className="text-[9px] font-semibold normal-case text-slate-700">{METRIC_LABEL[category.metric]}</div>
                    </th>
                  ))}
                  <th />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => (
                  <tr key={row.key}>
                    <td className="px-2 py-1.5">
                      <select
                        value={row.branchLabel}
                        onChange={(e) =>
                          setRows((current) => current.map((item) => (item.key === row.key ? { ...item, branchLabel: e.target.value } : item)))
                        }
                        className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs font-bold"
                      >
                        {BRANCHES.map((branch) => (
                          <option key={branch} value={branch}>
                            {branch}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        value={row.saticiAdi}
                        onChange={(e) =>
                          setRows((current) => current.map((item) => (item.key === row.key ? { ...item, saticiAdi: e.target.value } : item)))
                        }
                        placeholder="Ad Soyad"
                        className="h-9 w-48 rounded-lg border border-slate-200 px-2 text-sm font-semibold"
                      />
                    </td>
                    {activeCats.map((category) => (
                      <td key={category.key} className="px-1 py-1.5">
                        <input
                          value={row.hedefler[category.key] ?? ""}
                          onChange={(e) =>
                            setRows((current) =>
                              current.map((item) =>
                                item.key === row.key ? { ...item, hedefler: { ...item.hedefler, [category.key]: e.target.value } } : item
                              )
                            )
                          }
                          className="h-9 w-20 rounded-lg border border-slate-200 px-2 text-right text-sm font-bold"
                        />
                      </td>
                    ))}
                    <td className="px-1">
                      <button
                        type="button"
                        onClick={() => setRows((current) => current.filter((item) => item.key !== row.key))}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600"
                        title="Satırı sil"
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={activeCats.length + 3} className="px-4 py-8 text-center text-xs font-bold text-slate-400">
                      Bu dönem için kişi yok. Aşağıdan ekleyin ya da Excel&apos;den yapıştırın.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex flex-wrap items-start gap-3">
            <button
              type="button"
              onClick={() =>
                setRows((current) => [...current, { key: rowKeySeed++, branchLabel: BRANCHES[0], saticiAdi: "", hedefler: {} }])
              }
              className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-xs font-black uppercase text-slate-600 hover:bg-slate-50"
            >
              + Kişi ekle
            </button>

            <div className="flex min-w-[320px] flex-1 flex-wrap items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <select
                value={pasteBranch}
                onChange={(e) => setPasteBranch(e.target.value)}
                className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs font-bold"
              >
                {BRANCHES.map((branch) => (
                  <option key={branch} value={branch}>
                    {branch}
                  </option>
                ))}
              </select>
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                rows={3}
                placeholder={`Excel'den yapıştır (her satır: Ad Soyad, sonra ${activeCats.length} hedef, Tab ile ayrılmış, sütun sırası yukarıdaki başlıklarla aynı)`}
                className="min-w-[240px] flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
              />
              <button
                type="button"
                onClick={addPasted}
                className="h-9 rounded-lg bg-slate-800 px-3 text-[10px] font-black uppercase text-white hover:bg-slate-700"
              >
                Listeye ekle
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= KATEGORİLER ================= */}
      {tab === "kategoriler" && (
        <div>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div>
              <h1 className="text-2xl font-black">Kategori Ayarları</h1>
              <p className="mt-1 text-sm text-slate-500">
                Her kategorinin puanı, max puanı, bareminin ve WingSM&apos;den nasıl sayılacağının kuralı. Sınıf ve ürün adı
                eşleşmesi büyük/küçük harf, nokta ve boşluk farkını görmez (&quot;2.EL&quot; = &quot;2el&quot;). Ürün adı
                kutularında &quot;#&quot; bir rakam, &quot;*&quot; herhangi karakterler demektir (&quot;S#&quot; = S24, S25...;
                &quot;Z FOLD&quot; = Z Fold 5, ZFOLD6).
              </p>
            </div>
            <button
              type="button"
              onClick={() => void saveConfig()}
              disabled={configBusy}
              className="ml-auto h-10 rounded-lg bg-blue-700 px-5 text-sm font-black text-white hover:bg-blue-800 disabled:opacity-50"
            >
              {configBusy ? "KAYDEDİLİYOR..." : "KAYDET"}
            </button>
          </div>

          <MessageBox message={configMsg} />

          <div className="mt-4 space-y-3">
            {categories.map((category) => (
              <section
                key={category.key}
                className={`rounded-2xl border bg-white p-4 shadow-sm ${category.aktif ? "border-slate-200" : "border-slate-100 opacity-60"}`}
              >
                <div className="flex flex-wrap items-end gap-3">
                  <label className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-500">
                    <input
                      type="checkbox"
                      checked={category.aktif}
                      onChange={(e) => updateCategory(category.key, { aktif: e.target.checked })}
                      className="h-4 w-4"
                    />
                    Aktif
                  </label>
                  <label className="min-w-[220px] flex-1">
                    <div className="mb-1 text-[10px] font-black uppercase text-slate-500">Kategori adı</div>
                    <input
                      value={category.ad}
                      onChange={(e) => updateCategory(category.key, { ad: e.target.value })}
                      className="h-9 w-full rounded-lg border border-slate-200 px-2 text-sm font-bold"
                    />
                  </label>
                  <label>
                    <div className="mb-1 text-[10px] font-black uppercase text-slate-500">Ölçü</div>
                    <select
                      value={category.metric}
                      onChange={(e) => updateCategory(category.key, { metric: e.target.value as Metric })}
                      className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm font-semibold"
                    >
                      {(Object.keys(METRIC_LABEL) as Metric[]).map((metric) => (
                        <option key={metric} value={metric}>
                          {METRIC_LABEL[metric]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <div className="mb-1 text-[10px] font-black uppercase text-slate-500">Puan</div>
                    <input
                      type="number"
                      value={category.puan}
                      onChange={(e) => updateCategory(category.key, { puan: Number(e.target.value) })}
                      className="h-9 w-20 rounded-lg border border-slate-200 px-2 text-right text-sm font-bold"
                    />
                  </label>
                  <label>
                    <div className="mb-1 text-[10px] font-black uppercase text-slate-500">Max puan</div>
                    <input
                      type="number"
                      value={category.maxPuan}
                      onChange={(e) => updateCategory(category.key, { maxPuan: Number(e.target.value) })}
                      className="h-9 w-20 rounded-lg border border-slate-200 px-2 text-right text-sm font-bold"
                    />
                  </label>
                  <label>
                    <div className="mb-1 text-[10px] font-black uppercase text-slate-500">Barem % (boş = yok)</div>
                    <input
                      type="number"
                      value={category.baremPct ?? ""}
                      onChange={(e) => updateCategory(category.key, { baremPct: e.target.value === "" ? null : Number(e.target.value) })}
                      className="h-9 w-24 rounded-lg border border-slate-200 px-2 text-right text-sm font-bold"
                    />
                  </label>
                </div>

                {category.metric === "deger_puan" ? (
                  <p className="mt-3 text-[11px] font-semibold text-slate-500">
                    Değer Puan, panelde hesaplanan CMR Değer Puan raporundan (kişinin çarpanlı puanı) kendiliğinden gelir; bu
                    kategori için ayrı kural yoktur.
                  </p>
                ) : (
                  <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
                    <label>
                      <div className="mb-1 text-[10px] font-black uppercase text-slate-500">Sınıflar (virgülle)</div>
                      <input
                        value={listText(category.rule.siniflar)}
                        onChange={(e) => updateRule(category.key, { siniflar: parseList(e.target.value) })}
                        placeholder="2el, 1el, 4el"
                        className="h-9 w-full rounded-lg border border-slate-200 px-2 text-sm"
                      />
                    </label>
                    <label>
                      <div className="mb-1 text-[10px] font-black uppercase text-slate-500">Ürün adı şununla BAŞLASIN</div>
                      <input
                        value={listText(category.rule.adBaslar)}
                        onChange={(e) => updateRule(category.key, { adBaslar: parseList(e.target.value) })}
                        placeholder="2.EL"
                        className="h-9 w-full rounded-lg border border-slate-200 px-2 text-sm"
                      />
                    </label>
                    <label>
                      <div className="mb-1 text-[10px] font-black uppercase text-slate-500">Ürün adında HEPSİ geçsin (ve)</div>
                      <input
                        value={listText(category.rule.adGerekli)}
                        onChange={(e) => updateRule(category.key, { adGerekli: parseList(e.target.value) })}
                        placeholder="SAMSUNG"
                        className="h-9 w-full rounded-lg border border-slate-200 px-2 text-sm"
                      />
                    </label>
                    <label>
                      <div className="mb-1 text-[10px] font-black uppercase text-slate-500">Ürün adında GEÇSİN (biri yeter)</div>
                      <input
                        value={listText(category.rule.adIcerir)}
                        onChange={(e) => updateRule(category.key, { adIcerir: parseList(e.target.value) })}
                        placeholder="NCAM"
                        className="h-9 w-full rounded-lg border border-slate-200 px-2 text-sm"
                      />
                    </label>
                    <label>
                      <div className="mb-1 text-[10px] font-black uppercase text-slate-500">Ürün adında GEÇMESİN</div>
                      <input
                        value={listText(category.rule.adIcermez)}
                        onChange={(e) => updateRule(category.key, { adIcermez: parseList(e.target.value) })}
                        className="h-9 w-full rounded-lg border border-slate-200 px-2 text-sm"
                      />
                    </label>
                    <label>
                      <div className="mb-1 text-[10px] font-black uppercase text-slate-500">En düşük birim fiyat (TL)</div>
                      <input
                        type="number"
                        value={category.rule.minFiyat ?? ""}
                        onChange={(e) => updateRule(category.key, { minFiyat: e.target.value === "" ? null : Number(e.target.value) })}
                        placeholder="400"
                        className="h-9 w-full rounded-lg border border-slate-200 px-2 text-right text-sm"
                      />
                    </label>
                  </div>
                )}
              </section>
            ))}
          </div>

          <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-black text-slate-700">Gelişmiş</h2>
            <div className="mt-3 flex flex-wrap items-end gap-4">
              <label className="flex items-center gap-2 text-xs font-bold text-slate-600">
                <input
                  type="checkbox"
                  checked={settings.iadeNet}
                  onChange={(e) => setSettings({ ...settings, iadeNet: e.target.checked })}
                  className="h-4 w-4"
                />
                İadeleri düş (negatif adetli satırlar sayıdan çıkarılır)
              </label>
              <label>
                <div className="mb-1 text-[10px] font-black uppercase text-slate-500">Tutar alanı adı (boş = otomatik)</div>
                <input
                  value={settings.tutarAlani}
                  onChange={(e) => setSettings({ ...settings, tutarAlani: e.target.value })}
                  className="h-9 w-44 rounded-lg border border-slate-200 px-2 text-sm"
                />
              </label>
              <label>
                <div className="mb-1 text-[10px] font-black uppercase text-slate-500">Birim fiyat alanı adı (boş = otomatik)</div>
                <input
                  value={settings.fiyatAlani}
                  onChange={(e) => setSettings({ ...settings, fiyatAlani: e.target.value })}
                  className="h-9 w-44 rounded-lg border border-slate-200 px-2 text-sm"
                />
              </label>
            </div>
          </section>

          <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-sm font-black text-slate-700">WingSM sınıf listesi (bu ay)</h2>
              <button
                type="button"
                onClick={() => void fetchClasses()}
                disabled={classBusy}
                className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-black uppercase text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                {classBusy ? "Getiriliyor..." : "Sınıfları getir"}
              </button>
              <span className="text-[11px] font-semibold text-slate-400">
                Sınıf kutularına yazacağınız kodları buradan doğrulayın.
              </span>
            </div>

            {classList && (
              <div className="mt-3 max-h-64 overflow-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-black uppercase text-slate-500">
                      <th className="px-3 py-2">Sınıf kodu</th>
                      <th className="px-3 py-2">Sınıf adı</th>
                      <th className="px-3 py-2 text-right">Satır</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {classList.map((item) => (
                      <tr key={item.sinif}>
                        <td className="px-3 py-1.5 font-mono text-[11px] font-bold">{item.sinif}</td>
                        <td className="px-3 py-1.5 text-[11px] font-semibold">{item.adi || "-"}</td>
                        <td className="px-3 py-1.5 text-right text-[11px] font-semibold">{item.rowCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
