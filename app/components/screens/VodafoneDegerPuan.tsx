"use client";

// app/components/screens/VodafoneDegerPuan.tsx
//
// CNETMOBIL - WingSM Değer Puan - VODAFONE KANALI yönetici ekranı.
// CMR ekranı (WingsmDegerPuan) ile aynı sayfada, üstteki "CMR Kanalı | Vodafone
// Kanalı" düğmesiyle seçilir. Şimdilik SADECE yönetici görür (API'ler de
// yönetici oturumu ister). Sekmeler:
//   Ayarlar - sayılacak mal sınıfı (5AK), sıralama puanları
//   Hedefler - mağaza ve personel hedefleri (aylık, Excel'deki gibi)
//   Rapor - tarih aralığı seçip HESAPLA
//   Rapor Sonucu - kayıtlı son rapor + geçmiş günler (günlük 10:00 hesabı buraya yazar)
//   Satış Verisi - WingSM satırlarını inceleme aracı (Vodafone seçili açılır)

import React, { useCallback, useEffect, useMemo, useState } from "react";

import SatisIncele from "./SatisIncele";
import VodafoneSonuc from "./VodafoneSonuc";
import { AY_SONU_MESAJI, formatRangeLong } from "./degerPuanOrtak";
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
import type { VodafoneReportView, VodafoneSettings } from "./vodafoneDegerPuanTipleri";

export type Kanal = "cmr" | "vodafone";

export const KANAL_STORAGE_KEY = "cnet_deger_puan_kanal";

const VODAFONE_SHOPS = ["MEYDAN", "TEKİRA", "SARAY VDF", "ERNA"];

export function KanalSecici({ kanal, onChange }: { kanal: Kanal; onChange: (next: Kanal) => void }) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      {(
        [
          { id: "cmr", label: "CMR Kanalı" },
          { id: "vodafone", label: "Vodafone Kanalı" },
        ] as Array<{ id: Kanal; label: string }>
      ).map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onChange(item.id)}
          className={`rounded-xl border px-5 py-2.5 text-xs font-black uppercase tracking-wide transition ${
            kanal === item.id
              ? "border-blue-600 bg-blue-600 text-white shadow"
              : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

async function api<T = Record<string, unknown>>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: "same-origin", cache: "no-store", ...init });
  const payload = await res.json().catch(() => null);

  if (!res.ok || !payload?.success) {
    throw new Error(payload?.error || `HTTP ${res.status}`);
  }

  return payload as T;
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

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

type TabId = "ayarlar" | "hedefler" | "rapor" | "sonuc" | "satis";

type PersonRow = { key: number; branchLabel: string; saticiAdi: string; hedef: string; isManager: boolean };

type TargetsPayload = {
  stores: Array<{ branchLabel: string; hedef: number }>;
  personnel: Array<{ branchLabel: string; saticiAdi: string; hedef: number; isManager: boolean }>;
};

let personKeySeed = 1;

function parseTarget(value: string): number {
  const cleaned = value.trim().replace(/\./g, "").replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : NaN;
}

// "AD SOYAD <tab/;/boşluk> 15000" satırlarını okur.
function parsePasted(text: string): Array<{ saticiAdi: string; hedef: string }> {
  const rows: Array<{ saticiAdi: string; hedef: string }> = [];

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const parts = trimmed.split(/\t|;/).map((part) => part.trim()).filter(Boolean);

    if (parts.length >= 2) {
      rows.push({ saticiAdi: parts[0], hedef: parts[parts.length - 1] });
      continue;
    }

    const match = trimmed.match(/^(.*?)\s+([\d.,]+)$/);
    if (match) rows.push({ saticiAdi: match[1].trim(), hedef: match[2] });
  }

  return rows;
}

export default function VodafoneDegerPuan({ kanalSecici }: { kanalSecici: React.ReactNode }) {
  const [tab, setTab] = useState<TabId>("sonuc");

  // ---------------- AYARLAR ----------------
  const [settings, setSettings] = useState<VodafoneSettings | null>(null);
  const [storeBonusText, setStoreBonusText] = useState("");
  const [personnelBonusText, setPersonnelBonusText] = useState("");
  const [settingsMsg, setSettingsMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [settingsBusy, setSettingsBusy] = useState(false);

  const loadSettings = useCallback(async () => {
    try {
      const payload = await api<{ settings: VodafoneSettings }>("/api/wingsm/vodafone/settings");
      setSettings(payload.settings);
      setStoreBonusText(payload.settings.storeBonus.join(", "));
      setPersonnelBonusText(payload.settings.personnelBonus.join(", "));
    } catch (err) {
      setSettingsMsg({ type: "err", text: err instanceof Error ? err.message : "Ayarlar alınamadı." });
    }
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const saveSettings = async () => {
    if (!settings) return;

    const parseList = (text: string) =>
      text
        .split(/[,\s;]+/)
        .filter(Boolean)
        .map((item) => Number(item));

    const storeBonus = parseList(storeBonusText);
    const personnelBonus = parseList(personnelBonusText);

    if ([...storeBonus, ...personnelBonus].some((item) => !Number.isFinite(item) || item < 0)) {
      setSettingsMsg({ type: "err", text: "Sıralama puanları sayı olmalı (örn: 10, 5, 1)." });
      return;
    }

    setSettingsBusy(true);
    setSettingsMsg(null);

    try {
      const payload = await api<{ settings: VodafoneSettings }>("/api/wingsm/vodafone/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...settings, storeBonus, personnelBonus }),
      });

      setSettings(payload.settings);
      setStoreBonusText(payload.settings.storeBonus.join(", "));
      setPersonnelBonusText(payload.settings.personnelBonus.join(", "));
      setSettingsMsg({ type: "ok", text: "Ayarlar kaydedildi. Bir sonraki hesaplamadan itibaren geçerli." });
    } catch (err) {
      setSettingsMsg({ type: "err", text: err instanceof Error ? err.message : "Kaydedilemedi." });
    } finally {
      setSettingsBusy(false);
    }
  };

  // ---------------- HEDEFLER ----------------
  const [period, setPeriod] = useState(currentPeriod);
  const [storeTargets, setStoreTargets] = useState<Record<string, string>>({});
  const [people, setPeople] = useState<PersonRow[]>([]);
  const [pasteText, setPasteText] = useState<Record<string, string>>({});
  const [targetsMsg, setTargetsMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [targetsBusy, setTargetsBusy] = useState(false);
  const [targetsLoaded, setTargetsLoaded] = useState(false);

  const applyTargets = useCallback((data: TargetsPayload) => {
    setStoreTargets(Object.fromEntries(data.stores.map((item) => [item.branchLabel, String(item.hedef)])));
    setPeople(
      data.personnel.map((item) => ({
        key: personKeySeed++,
        branchLabel: item.branchLabel,
        saticiAdi: item.saticiAdi,
        hedef: String(item.hedef),
        isManager: item.isManager,
      }))
    );
  }, []);

  const loadTargets = useCallback(
    async (targetPeriod: string) => {
      setTargetsMsg(null);
      setTargetsLoaded(false);

      try {
        const data = await api<TargetsPayload>(`/api/wingsm/vodafone/targets?period=${encodeURIComponent(targetPeriod)}`);
        applyTargets(data);
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

  const copyFromPrevious = async () => {
    setTargetsMsg(null);

    try {
      const data = await api<TargetsPayload>(
        `/api/wingsm/vodafone/targets?period=${encodeURIComponent(previousPeriod(period))}`
      );

      if (data.stores.length === 0 && data.personnel.length === 0) {
        setTargetsMsg({ type: "err", text: "Önceki ayda kayıtlı hedef yok." });
        return;
      }

      applyTargets(data);
      setTargetsMsg({ type: "ok", text: "Önceki ayın hedefleri forma kopyalandı. KAYDET'e basana kadar kaydedilmez." });
    } catch (err) {
      setTargetsMsg({ type: "err", text: err instanceof Error ? err.message : "Kopyalanamadı." });
    }
  };

  const personnelTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const person of people) {
      const value = parseTarget(person.hedef);
      if (Number.isFinite(value)) totals[person.branchLabel] = (totals[person.branchLabel] ?? 0) + value;
    }
    return totals;
  }, [people]);

  const saveTargets = async () => {
    const stores: Array<{ branchLabel: string; hedef: number }> = [];

    for (const shop of VODAFONE_SHOPS) {
      const text = (storeTargets[shop] ?? "").trim();
      if (!text) continue;

      const value = parseTarget(text);
      if (!Number.isFinite(value) || value < 0) {
        setTargetsMsg({ type: "err", text: `${shop} mağaza hedefi geçersiz.` });
        return;
      }

      stores.push({ branchLabel: shop, hedef: value });
    }

    const personnel: Array<{ branchLabel: string; saticiAdi: string; hedef: number; isManager: boolean }> = [];

    for (const person of people) {
      const name = person.saticiAdi.trim();
      if (!name) continue;

      const value = parseTarget(person.hedef);
      if (!Number.isFinite(value) || value < 0) {
        setTargetsMsg({ type: "err", text: `${name} için hedef geçersiz.` });
        return;
      }

      personnel.push({ branchLabel: person.branchLabel, saticiAdi: name, hedef: value, isManager: person.isManager });
    }

    setTargetsBusy(true);
    setTargetsMsg(null);

    try {
      await api("/api/wingsm/vodafone/targets", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period, stores, personnel }),
      });

      setTargetsMsg({ type: "ok", text: `${period} hedefleri kaydedildi (${personnel.length} personel).` });
      await loadTargets(period);
    } catch (err) {
      setTargetsMsg({ type: "err", text: err instanceof Error ? err.message : "Kaydedilemedi." });
    } finally {
      setTargetsBusy(false);
    }
  };

  const addPasted = (shop: string) => {
    const parsed = parsePasted(pasteText[shop] ?? "");

    if (parsed.length === 0) {
      setTargetsMsg({ type: "err", text: "Yapıştırılan satırlar okunamadı. Her satır: AD SOYAD [boşluk veya Tab] HEDEF." });
      return;
    }

    setPeople((current) => [
      ...current,
      ...parsed.map((item) => ({
        key: personKeySeed++,
        branchLabel: shop,
        saticiAdi: item.saticiAdi,
        hedef: item.hedef,
        isManager: false,
      })),
    ]);
    setPasteText((current) => ({ ...current, [shop]: "" }));
    setTargetsMsg(null);
  };

  // ---------------- RAPOR (HESAPLA) ----------------
  const initialRange = useMemo(defaultRange, []);
  const [bastar, setBastar] = useState(initialRange.bastar);
  const [bittar, setBittar] = useState(initialRange.bittar);
  const [gecenGun, setGecenGun] = useState("");
  const [ayToplamGun, setAyToplamGun] = useState("");
  const [reportBusy, setReportBusy] = useState(false);
  const [reportMsg, setReportMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [report, setReport] = useState<VodafoneReportView | null>(null);

  const runReport = async () => {
    setReportBusy(true);
    setReportMsg(null);

    try {
      const payload = await api<VodafoneReportView>("/api/wingsm/vodafone/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bastar, bittar, gecenGun: gecenGun.trim(), ayToplamGun: ayToplamGun.trim() }),
      });

      setReport({ ...payload, hasSnapshot: true });
      setReportMsg({ type: "ok", text: "Hesaplandı ve kaydedildi." });
    } catch (err) {
      setReport(null);
      setReportMsg({ type: "err", text: err instanceof Error ? err.message : "Hesaplanamadı." });
    } finally {
      setReportBusy(false);
    }
  };

  // ---------------- RAPOR SONUCU ----------------
  const [result, setResult] = useState<VodafoneReportView | null>(null);
  const [resultError, setResultError] = useState("");
  const [resultLoading, setResultLoading] = useState(false);
  // CMR'daki gibi: Bugün (en güncel rapor) / Dün / Önceki Gün / takvimden tarih.
  const [pick, setPick] = useState<DayPick>({ kind: "bugun" });
  const [resultPeriod, setResultPeriod] = useState<string | null>(null);

  const loadResult = useCallback(async (gun: string | null, periodPick: string | null) => {
    setResultLoading(true);
    setResultError("");

    try {
      const query = gun ? `?gun=${gun}` : periodPick ? `?period=${encodeURIComponent(periodPick)}` : "";
      const payload = await api<VodafoneReportView>(`/api/wingsm/vodafone/result${query}`);
      setResult(payload);
    } catch (err) {
      setResult(null);
      setResultError(err instanceof Error ? err.message : "Sonuç alınamadı.");
    } finally {
      setResultLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === "sonuc") void loadResult(dayPickToGun(pick), resultPeriod);
  }, [tab, pick, resultPeriod, loadResult]);

  // Takvimde seçilebilecek en erken gün: kayıtlı en eski raporun yayın günü (bitiş + 1).
  const minPickDate = useMemo(() => {
    const earliest = (result?.history ?? [])
      .map((item) => slashToIso(item.tarih2))
      .filter((value): value is string => Boolean(value))
      .sort()[0];

    return earliest ? shiftDay(earliest, 1) : undefined;
  }, [result]);

  // Dönem listesi: kayıtlı raporların ayları (en yeni üstte).
  const resultPeriods = useMemo(() => {
    const months = new Set<string>();

    for (const item of result?.history ?? []) {
      const parts = item.tarih2.split("/");
      if (parts.length === 3) months.add(`${parts[2]}-${parts[1]}`);
    }

    if (result?.hedefPeriodu) months.add(result.hedefPeriodu);

    return Array.from(months).sort().reverse();
  }, [result]);

  const tabButton = (id: TabId, label: string) => (
    <button
      key={id}
      type="button"
      onClick={() => setTab(id)}
      className={`h-10 flex-none whitespace-nowrap rounded-t-lg px-4 text-xs font-black uppercase tracking-wide transition ${
        tab === id ? "border-b-2 border-blue-600 text-blue-700" : "text-slate-400 hover:text-slate-600"
      }`}
    >
      {label}
    </button>
  );

  const messageBox = (message: { type: "ok" | "err"; text: string } | null) =>
    message && (
      <div
        className={`mt-3 rounded-lg border px-4 py-3 text-xs font-bold ${
          message.type === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"
        }`}
      >
        {message.text}
      </div>
    );

  return (
    <div className="animate-in fade-in duration-500">
      {kanalSecici}

      <div className="mb-6 flex items-center gap-2 overflow-x-auto border-b border-slate-200">
        {tabButton("ayarlar", "Ayarlar")}
        {tabButton("hedefler", "Hedefler")}
        {tabButton("rapor", "Rapor")}
        {tabButton("sonuc", "Rapor Sonucu")}
        {tabButton("satis", "Satış Verisi")}
      </div>

      <div className="mb-4 rounded-lg border border-violet-200 bg-violet-50 px-4 py-2 text-[11px] font-bold text-violet-800">
        Vodafone Değer Puan şimdilik sadece yönetici girişinde görünür; mağazalara açık değildir.
      </div>

      {tab === "satis" && <SatisIncele varsayilanKanal="vodafone" />}

      {tab === "ayarlar" && (
        <div className="max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h1 className="text-2xl font-black">Vodafone Değer Puan Ayarları</h1>
          <p className="mt-1 text-sm text-slate-500">
            Puan, WingSM satış satırında ürün adının son 3 hanesidir (ör. &quot;... TARİFE 065&quot; = 65) ve adet ile
            çarpılır. Sadece aşağıdaki mal sınıfındaki satırlar sayılır.
          </p>

          {!settings ? (
            <div className="mt-6 text-sm font-bold text-slate-400">Yükleniyor...</div>
          ) : (
            <div className="mt-5 space-y-4">
              <label className="block">
                <div className="mb-1 text-[10px] font-black uppercase text-slate-500">Sayılacak mal sınıfı (MalSinif)</div>
                <input
                  value={settings.sinif}
                  onChange={(e) => setSettings({ ...settings, sinif: e.target.value.toUpperCase() })}
                  className="h-10 w-40 rounded-lg border border-slate-200 px-3 text-sm uppercase"
                />
              </label>

              <label className="block">
                <div className="mb-1 text-[10px] font-black uppercase text-slate-500">
                  Mağaza sıralama puanları (1., 2., ... virgülle)
                </div>
                <input
                  value={storeBonusText}
                  onChange={(e) => setStoreBonusText(e.target.value)}
                  className="h-10 w-60 rounded-lg border border-slate-200 px-3 text-sm"
                />
              </label>

              <label className="block">
                <div className="mb-1 text-[10px] font-black uppercase text-slate-500">
                  Personel sıralama puanları (1., 2., ... virgülle)
                </div>
                <input
                  value={personnelBonusText}
                  onChange={(e) => setPersonnelBonusText(e.target.value)}
                  className="h-10 w-60 rounded-lg border border-slate-200 px-3 text-sm"
                />
              </label>

              <label className="flex items-start gap-2 text-xs font-bold text-slate-600">
                <input
                  type="checkbox"
                  checked={settings.adetCarp}
                  onChange={(e) => setSettings({ ...settings, adetCarp: e.target.checked })}
                  className="mt-0.5 h-4 w-4"
                />
                <span>
                  Puanı satırın adediyle çarp (WingSM&apos;de adedi 2 ve üstü olan satırlarda puan adet kadar sayılır).
                  Kapalıyken her satır, adedi kaç olursa olsun ürün adının son 3 hanesi kadar puan verir.
                </span>
              </label>

              <button
                type="button"
                onClick={() => void saveSettings()}
                disabled={settingsBusy}
                className="h-10 rounded-lg bg-blue-700 px-5 text-sm font-black text-white hover:bg-blue-800 disabled:opacity-50"
              >
                {settingsBusy ? "KAYDEDİLİYOR..." : "KAYDET"}
              </button>
            </div>
          )}

          {messageBox(settingsMsg)}
        </div>
      )}

      {tab === "hedefler" && (
        <div>
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <div>
              <h1 className="text-2xl font-black">Vodafone Hedefleri</h1>
              <p className="mt-1 text-sm text-slate-500">
                Hedefler aylıktır. Mağaza hedefini elle yazın ya da &quot;personel toplamı&quot; düğmesiyle doldurun.
                Müdürler sıralamaya girmez.
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
              onClick={() => void copyFromPrevious()}
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

          {messageBox(targetsMsg)}

          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            {VODAFONE_SHOPS.map((shop) => {
              const shopPeople = people.filter((person) => person.branchLabel === shop);

              return (
                <section key={shop} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-lg font-black">{shop}</h2>
                    <label className="ml-auto flex items-center gap-2 text-[10px] font-black uppercase text-slate-500">
                      Mağaza hedefi
                      <input
                        value={storeTargets[shop] ?? ""}
                        onChange={(e) => setStoreTargets((current) => ({ ...current, [shop]: e.target.value }))}
                        placeholder="0"
                        className="h-9 w-28 rounded-lg border border-slate-200 px-2 text-right text-sm font-bold"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setStoreTargets((current) => ({ ...current, [shop]: String(personnelTotals[shop] ?? 0) }))
                      }
                      className="h-9 rounded-lg border border-slate-200 px-3 text-[10px] font-black uppercase text-slate-600 hover:bg-slate-50"
                      title="Mağaza hedefini bu mağazadaki personel hedeflerinin toplamına eşitler"
                    >
                      Personel toplamı: {personnelTotals[shop] ?? 0}
                    </button>
                  </div>

                  <div className="mt-3 space-y-1.5">
                    {shopPeople.map((person) => (
                      <div key={person.key} className="flex items-center gap-2">
                        <input
                          value={person.saticiAdi}
                          onChange={(e) =>
                            setPeople((current) =>
                              current.map((item) => (item.key === person.key ? { ...item, saticiAdi: e.target.value } : item))
                            )
                          }
                          placeholder="Ad Soyad"
                          className="h-9 min-w-0 flex-1 rounded-lg border border-slate-200 px-2 text-sm font-semibold"
                        />
                        <input
                          value={person.hedef}
                          onChange={(e) =>
                            setPeople((current) =>
                              current.map((item) => (item.key === person.key ? { ...item, hedef: e.target.value } : item))
                            )
                          }
                          placeholder="Hedef"
                          className="h-9 w-24 rounded-lg border border-slate-200 px-2 text-right text-sm font-bold"
                        />
                        <label className="flex items-center gap-1 text-[10px] font-black uppercase text-slate-500">
                          <input
                            type="checkbox"
                            checked={person.isManager}
                            onChange={(e) =>
                              setPeople((current) =>
                                current.map((item) => (item.key === person.key ? { ...item, isManager: e.target.checked } : item))
                              )
                            }
                            className="h-4 w-4"
                          />
                          Müdür
                        </label>
                        <button
                          type="button"
                          onClick={() => setPeople((current) => current.filter((item) => item.key !== person.key))}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600"
                          title="Satırı sil"
                        >
                          ×
                        </button>
                      </div>
                    ))}

                    {shopPeople.length === 0 && (
                      <div className="rounded-lg border border-dashed border-slate-200 py-4 text-center text-[11px] font-bold text-slate-400">
                        Bu mağazada personel yok.
                      </div>
                    )}
                  </div>

                  <div className="mt-3 flex flex-wrap items-start gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setPeople((current) => [
                          ...current,
                          { key: personKeySeed++, branchLabel: shop, saticiAdi: "", hedef: "", isManager: false },
                        ])
                      }
                      className="h-9 rounded-lg border border-slate-200 px-3 text-[10px] font-black uppercase text-slate-600 hover:bg-slate-50"
                    >
                      + Personel ekle
                    </button>
                    <textarea
                      value={pasteText[shop] ?? ""}
                      onChange={(e) => setPasteText((current) => ({ ...current, [shop]: e.target.value }))}
                      placeholder={"Excel'den yapıştır:\nAD SOYAD   15000"}
                      rows={2}
                      className="min-w-[180px] flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => addPasted(shop)}
                      className="h-9 rounded-lg bg-slate-800 px-3 text-[10px] font-black uppercase text-white hover:bg-slate-700"
                    >
                      Listeye ekle
                    </button>
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      )}

      {tab === "rapor" && (
        <div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h1 className="text-2xl font-black">Vodafone Değer Puan Raporu</h1>
            <p className="mt-1 text-sm text-slate-500">
              Tarih aralığını seçip HESAPLA&apos;ya basın; sonuç kaydedilir ve Rapor Sonucu sekmesinde görünür. Günlük
              otomatik hesap (10:00) da buraya aynı şekilde yazar. WingSM&apos;e sadece okuma yapılır.
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
              <label>
                <div className="mb-1 text-[10px] font-black uppercase text-slate-500">Geçen gün (boş = otomatik)</div>
                <input
                  value={gecenGun}
                  onChange={(e) => setGecenGun(e.target.value)}
                  className="h-10 w-28 rounded-lg border border-slate-200 px-3 text-sm"
                />
              </label>
              <label>
                <div className="mb-1 text-[10px] font-black uppercase text-slate-500">Ayın günü (boş = otomatik)</div>
                <input
                  value={ayToplamGun}
                  onChange={(e) => setAyToplamGun(e.target.value)}
                  className="h-10 w-28 rounded-lg border border-slate-200 px-3 text-sm"
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
            </div>

            {messageBox(reportMsg)}
          </div>

          {report && report.hasSnapshot && (
            <div className="mt-5">
              <VodafoneSonuc report={report} />
            </div>
          )}
        </div>
      )}

      {tab === "sonuc" && (
        <div>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            {result?.durum === "guncel" && (
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-black text-emerald-700">
                ✓ Rapor güncel
              </span>
            )}
            {result?.durum === "bekleniyor" && (
              <span className="rounded-full bg-amber-100 px-3 py-1 text-[11px] font-black text-amber-800">
                {result.aySonuPaylasim ? "Ay sonu: otomatik hesap durdu" : "⏳ Rapor bekleniyor"}
              </span>
            )}
            {result?.hasSnapshot && result.durum === null && (
              <span className="rounded-full bg-amber-100 px-3 py-1 text-[11px] font-black text-amber-800">
                Eski rapor görüntüleniyor
              </span>
            )}

            <div className="ml-auto">
              <DayPicker
                label={dayPickLabel(pick)}
                disabled={resultLoading}
                minDate={minPickDate}
                maxDate={istanbulToday()}
                onSelect={(next) => {
                  setResultPeriod(null);
                  setPick(next);
                }}
              />
            </div>
          </div>

          {result?.hasSnapshot && result.period && result.durum !== "bekleniyor" && (
            <div
              className={`mb-4 rounded-xl border px-4 py-2.5 text-sm font-bold ${
                result.durum === null
                  ? "border-amber-300 bg-amber-50 text-amber-900"
                  : "border-blue-200 bg-blue-50 text-blue-900"
              }`}
            >
              {result.istenenGun ? `${formatIsoDate(result.istenenGun)} tarihli rapor: ` : "Güncel rapor: "}
              {formatRangeLong(result.period.tarih, result.period.tarih2)} arası
              {result.istenenGun && result.tamEsleme === false && (
                <span className="ml-1 font-semibold">
                  (o gün için ayrı rapor hazırlanmamıştı, en yakın önceki rapor gösteriliyor)
                </span>
              )}
            </div>
          )}

          {resultLoading && <div className="text-sm font-bold text-slate-400">Yükleniyor...</div>}

          {resultError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs font-bold text-red-700">
              {resultError}
            </div>
          )}

          {!resultLoading && result && !result.hasSnapshot && result.bulunamadi && (
            <div className="rounded-2xl border border-slate-200 bg-white px-5 py-8 text-center text-sm font-bold text-slate-500">
              {result.istenenGun ? `${formatIsoDate(result.istenenGun)} tarihi için` : "Bu tarih için"} kayıtlı rapor bulunamadı.
            </div>
          )}

          {!resultLoading && result && !result.hasSnapshot && !result.bulunamadi && (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white py-12 text-center text-sm font-bold text-slate-400">
              Henüz Vodafone raporu hesaplanmadı. Önce Hedefler sekmesinden hedefleri girip Rapor sekmesinden HESAPLA&apos;ya
              basın; ya da günlük 10:00 hesabını bekleyin.
            </div>
          )}

          {/* Yeni güne geçildi ve o günün raporu hazır değil: eski günün rakamları GÖSTERİLMEZ (CMR ile aynı). */}
          {!resultLoading && result && result.hasSnapshot && result.durum === "bekleniyor" && (
            <div className="flex min-h-[260px] flex-col items-center justify-center rounded-2xl bg-white px-6 py-12 text-center shadow-sm">
              <div className="text-5xl">{result.aySonuPaylasim ? "📢" : "⏳"}</div>
              <div className="mt-4 text-2xl font-black text-[#1b2559]">
                {result.aySonuPaylasim ? "Ay sonu raporu" : "Rapor bekleniyor"}
              </div>
              <p className="mt-2 max-w-md text-sm font-semibold text-slate-500">
                {result.aySonuPaylasim ? AY_SONU_MESAJI : "Yeni günün raporu hazırlandığında burada otomatik görünecek."}
              </p>
              <p className="mt-3 text-xs font-semibold text-slate-400">
                Önceki günün raporunu görmek için sağ üstteki seçiciden &quot;Dün&quot;ü seçebilirsiniz.
              </p>
            </div>
          )}

          {!resultLoading && result && result.hasSnapshot && result.durum !== "bekleniyor" && (
            <VodafoneSonuc
              report={result}
              periods={resultPeriods}
              period={result.hedefPeriodu}
              onPeriodChange={(next) => {
                setPick({ kind: "bugun" });
                setResultPeriod(next === resultPeriods[0] ? null : next);
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}
