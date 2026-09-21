"use client";

// app/components/screens/WingsmDegerPuan.tsx
//
// CNETMOBIL - WingSM "Değer Puan" kuralları yönetimi
//
// Bu ekran, daha önce "cmr değer puan HAZİRAN2026 (2).xlsm" Excel
// makrosunda elle tutulan (Mal Sınıfı, Kâr aralığı) -> Puan tablosunu
// public.wingsm_score_rules üzerinden CRUD ile yönetir.
//
// BİLEREK YAPILMAYAN: Bu ekran WingSM'e HİÇBİR canlı istek atmaz —
// sadece /api/wingsm/score-rules (CRUD) ile konuşur.
// /api/wingsm/value-report (Aşama 1 testi) ile tamamen bağımsızdır.
//
// NOT: Bu bileşen, daha önce app/admin/wingsm-score-rules/page.tsx'te
// standalone bir ekran olarak yaşıyordu (ayrı bir isSuperAdmin kontrolüyle
// korunuyordu). Ana panel (app/page.tsx) zaten kendi isAdmin oturum
// kontrolünü yaptığı için, buraya taşınırken auth-boot (/api/me) adımı
// bilerek kaldırıldı — bu bileşen render edildiğinde kullanıcı zaten
// admin olarak doğrulanmış olur.

import React, { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";

type ScoreRule = {
  id: number;
  class_code: string;
  class_label: string;
  profit_min: string;
  profit_max: string;
  score: string;
  active: boolean;
  created_at: string;
  updated_at: string;
};

type Draft = {
  profit_min: string;
  profit_max: string;
  score: string;
};

type RowState = {
  loading: boolean;
  error: string;
  success: string;
};

type NewClassDraft = {
  class_code: string;
  class_label: string;
  profit_min: string;
  profit_max: string;
  score: string;
};

const EMPTY_NEW_CLASS: NewClassDraft = {
  class_code: "",
  class_label: "",
  profit_min: "",
  profit_max: "",
  score: "",
};

// ==================================================
// RAPOR SEKMESİ (Aşama 3+4) — /api/wingsm/deger-puan-report
// ==================================================

type StoreReportRow = {
  branchLabel: string;
  depotCode: string;
  saleCount: number;
  totalScore: number;
  multiplier: number;
  carpanliPuan: number;
};

type PersonnelReportRow = {
  branchLabel: string;
  saticiKod: string;
  saticiAdi: string;
  saleCount: number;
  totalScore: number;
  carpanliPuan: number;
};

type DetailReportRow = {
  branchLabel: string;
  saticiKod: string;
  saticiAdi: string;
  malAd: string;
  malSinif: string;
  malSinifAdi: string;
  karlilik: number;
  score: number;
  tarih: string;
  faturaNo: string;
};

type UnmatchedReportRow = {
  branchLabel: string;
  saticiAdi: string;
  malSinif: string;
  malSinifAdi: string;
  karlilik: number;
};

type DegerPuanReport = {
  period: { tarih: string; tarih2: string };
  stores: StoreReportRow[];
  personnel: PersonnelReportRow[];
  detailRows: DetailReportRow[];
  unmatchedCount: number;
  unmatchedSample: UnmatchedReportRow[];
  excludedOutOfScopeCount: number;
  totalSaleCount: number;
  totalScore: number;
  totalCarpanliPuan: number;
};

// Bugünün ayının 1'i -> bugün, "GG.AA.YYYY" biçiminde (admin/page.tsx'teki
// GEÇİCİ TEST widget'ıyla aynı, WingSM'in kabul ettiği biçimlerden biri).
function formatDateInput(date: Date) {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
}

function defaultBastar() {
  const now = new Date();
  return formatDateInput(new Date(now.getFullYear(), now.getMonth(), 1));
}

function defaultBittar() {
  return formatDateInput(new Date());
}

function ruleToDraft(rule: ScoreRule): Draft {
  return {
    profit_min: rule.profit_min,
    profit_max: rule.profit_max,
    score: rule.score,
  };
}

function formatNumber(value: string) {
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  return n.toLocaleString("tr-TR", { maximumFractionDigits: 2 });
}

export default function WingsmDegerPuan() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [rules, setRules] = useState<ScoreRule[]>([]);
  const [showInactive, setShowInactive] = useState(true);

  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [rowState, setRowState] = useState<Record<number, RowState>>({});

  const [newClassDraft, setNewClassDraft] = useState<NewClassDraft>(EMPTY_NEW_CLASS);
  const [newClassState, setNewClassState] = useState<RowState>({ loading: false, error: "", success: "" });

  // ==================================================
  // SEKMELER: "kurallar" (yukarıdaki mevcut ekran, VARSAYILAN — davranış
  // değişmiyor) / "rapor" (yeni, Aşama 3+4)
  // ==================================================

  const [activeTab, setActiveTab] = useState<"kurallar" | "rapor">("kurallar");

  const [reportBastar, setReportBastar] = useState(defaultBastar);
  const [reportBittar, setReportBittar] = useState(defaultBittar);
  const [reportState, setReportState] = useState<RowState>({ loading: false, error: "", success: "" });
  const [report, setReport] = useState<DegerPuanReport | null>(null);

  const runReport = async () => {
    setReportState({ loading: true, error: "", success: "" });

    try {
      const res = await fetch("/api/wingsm/deger-puan-report", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bastar: reportBastar, bittar: reportBittar }),
      });

      const payload = await res.json().catch(() => null);

      if (!res.ok || !payload?.success) {
        throw new Error(payload?.error || `HTTP ${res.status}`);
      }

      setReport(payload as DegerPuanReport);
      setReportState({ loading: false, error: "", success: "Hesaplandı." });

      window.setTimeout(() => setReportState((current) => ({ ...current, success: "" })), 2500);
    } catch (err) {
      setReport(null);
      setReportState({
        loading: false,
        error: err instanceof Error ? err.message : "Rapor hesaplanamadı.",
        success: "",
      });
    }
  };

  const exportReportToExcel = () => {
    if (!report) return;

    const storeSheet = XLSX.utils.json_to_sheet(
      report.stores.map((s) => ({
        Mağaza: s.branchLabel,
        "Satış Adedi": s.saleCount,
        "Toplam Puan": s.totalScore,
        Çarpan: s.multiplier,
        "Çarpanlı Puan": s.carpanliPuan,
      }))
    );

    const personnelSheet = XLSX.utils.json_to_sheet(
      report.personnel.map((p) => ({
        Mağaza: p.branchLabel,
        "Satıcı Kodu": p.saticiKod,
        Satıcı: p.saticiAdi,
        "Satış Adedi": p.saleCount,
        "Toplam Puan": p.totalScore,
        "Çarpanlı Puan": p.carpanliPuan,
      }))
    );

    const detailSheet = XLSX.utils.json_to_sheet(
      report.detailRows.map((d) => ({
        Mağaza: d.branchLabel,
        "Satıcı Kodu": d.saticiKod,
        Satıcı: d.saticiAdi,
        Ürün: d.malAd,
        Sınıf: d.malSinif,
        "Sınıf Adı": d.malSinifAdi,
        Kârlılık: d.karlilik,
        Puan: d.score,
        Tarih: d.tarih,
        "Fatura No": d.faturaNo,
      }))
    );

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, storeSheet, "Mağaza Özet");
    XLSX.utils.book_append_sheet(workbook, personnelSheet, "Personel Özet");
    XLSX.utils.book_append_sheet(workbook, detailSheet, "Detay");

    const today = formatDateInput(new Date()).replace(/\./g, "-");
    XLSX.writeFile(workbook, `WINGSM_DEGER_PUAN_${today}.xlsx`);
  };

  // TEK SEFERLİK KURULUM: tablo henüz yoksa/boşsa admin tek tıkla
  // oluşturup Excel'deki seed verisini yükleyebilsin.
  const [migrating, setMigrating] = useState(false);
  const [migrateMessage, setMigrateMessage] = useState("");

  const runMigration = async () => {
    setMigrating(true);
    setMigrateMessage("");

    try {
      const res = await fetch("/api/wingsm/score-rules/migrate", {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
      });

      const payload = await res.json().catch(() => null);

      if (!res.ok || !payload?.success) {
        throw new Error(payload?.error || `HTTP ${res.status}`);
      }

      setMigrateMessage(payload.message || "Kurulum tamamlandı.");
      await loadRules();
    } catch (err) {
      setMigrateMessage(
        `Kurulum başarısız: ${err instanceof Error ? err.message : "Bilinmeyen hata."}`
      );
    } finally {
      setMigrating(false);
    }
  };

  // ==================================================
  // EXCEL İLE EŞİTLE (bkz. app/api/wingsm/score-rules/resync/route.ts —
  // migrate idempotent olduğu için, kurulum düzeltmeden önce bir kez
  // çalıştıysa DB'de eski/yanlış değerler kalmış olabilir; bu buton
  // bilinen 5 sınıf x 12 aralığı Excel kaynağıyla yeniden eşitler)
  // ==================================================

  const [resyncing, setResyncing] = useState(false);
  const [resyncMessage, setResyncMessage] = useState("");

  const runResync = async () => {
    setResyncing(true);
    setResyncMessage("");

    try {
      const res = await fetch("/api/wingsm/score-rules/resync", {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
      });

      const payload = await res.json().catch(() => null);

      if (!res.ok || !payload?.success) {
        throw new Error(payload?.error || `HTTP ${res.status}`);
      }

      setResyncMessage(payload.message || "Eşitlendi.");
      await loadRules();
    } catch (err) {
      setResyncMessage(`Eşitleme başarısız: ${err instanceof Error ? err.message : "Bilinmeyen hata."}`);
    } finally {
      setResyncing(false);
    }
  };

  // ==================================================
  // MAĞAZA ÇARPANI (Excel'deki "MAĞAZA ÇARPANI" tablosu)
  // ==================================================

  type StoreMultiplier = { branch_label: string; multiplier: string };

  const [multipliers, setMultipliers] = useState<StoreMultiplier[]>([]);
  const [multiplierDrafts, setMultiplierDrafts] = useState<Record<string, string>>({});
  const [multiplierState, setMultiplierState] = useState<Record<string, RowState>>({});

  const loadMultipliers = async () => {
    try {
      const res = await fetch("/api/wingsm/store-multipliers", {
        method: "GET",
        cache: "no-store",
        credentials: "same-origin",
      });

      const payload = await res.json().catch(() => null);

      if (!res.ok || !payload?.success) {
        throw new Error(payload?.error || `HTTP ${res.status}`);
      }

      const loaded: StoreMultiplier[] = payload.multipliers || [];
      setMultipliers(loaded);

      const nextDrafts: Record<string, string> = {};
      for (const m of loaded) {
        nextDrafts[m.branch_label] = m.multiplier;
      }
      setMultiplierDrafts(nextDrafts);
    } catch {
      // Sessiz geç — mağaza çarpanı henüz kurulmamışsa (tablo yok) rapor
      // motoru zaten hepsini 1 kabul ediyor, bu ekranda ayrıca hata
      // banner'ı göstermeye gerek yok.
    }
  };

  const saveMultiplier = async (branchLabel: string) => {
    const value = multiplierDrafts[branchLabel];

    setMultiplierState((current) => ({
      ...current,
      [branchLabel]: { loading: true, error: "", success: "" },
    }));

    try {
      const res = await fetch("/api/wingsm/store-multipliers", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branchLabel, multiplier: value }),
      });

      const payload = await res.json().catch(() => null);

      if (!res.ok || !payload?.success) {
        throw new Error(payload?.error || `HTTP ${res.status}`);
      }

      await loadMultipliers();
      setMultiplierState((current) => ({
        ...current,
        [branchLabel]: { loading: false, error: "", success: "Kaydedildi." },
      }));

      window.setTimeout(
        () =>
          setMultiplierState((current) => ({
            ...current,
            [branchLabel]: { ...current[branchLabel], success: "" },
          })),
        2500
      );
    } catch (err) {
      setMultiplierState((current) => ({
        ...current,
        [branchLabel]: {
          loading: false,
          error: err instanceof Error ? err.message : "Kaydedilemedi.",
          success: "",
        },
      }));
    }
  };

  useEffect(() => {
    loadMultipliers();
  }, []);

  // ==================================================
  // VERİ YÜKLE
  // ==================================================

  const loadRules = async () => {
    setLoading(true);
    setLoadError("");

    try {
      const res = await fetch("/api/wingsm/score-rules", {
        method: "GET",
        cache: "no-store",
        credentials: "same-origin",
      });

      const payload = await res.json().catch(() => null);

      if (!res.ok || !payload?.success) {
        throw new Error(payload?.error || `HTTP ${res.status}`);
      }

      const loaded: ScoreRule[] = payload.rules || [];
      setRules(loaded);

      const nextDrafts: Record<number, Draft> = {};
      for (const rule of loaded) {
        nextDrafts[rule.id] = ruleToDraft(rule);
      }
      setDrafts(nextDrafts);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Kurallar yüklenemedi.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRules();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ==================================================
  // TEK DÜZ LİSTE (Excel'deki gibi — sınıf, sonra kâr aralığına göre sıralı)
  // ==================================================

  const visibleRules = useMemo(() => {
    const visible = showInactive ? rules : rules.filter((r) => r.active);

    return [...visible].sort((a, b) => {
      const classCompare = a.class_code.localeCompare(b.class_code, "tr");
      if (classCompare !== 0) return classCompare;
      return Number(a.profit_min) - Number(b.profit_min);
    });
  }, [rules, showInactive]);

  const setRowFeedback = (id: number, patch: Partial<RowState>) => {
    setRowState((current) => {
      const base: RowState = current[id] || { loading: false, error: "", success: "" };
      return { ...current, [id]: { ...base, ...patch } };
    });
  };

  const updateDraft = (id: number, field: keyof Draft, value: string) => {
    setDrafts((current) => ({
      ...current,
      [id]: { ...current[id], [field]: value },
    }));
  };

  // ==================================================
  // SATIR KAYDET (profit_min / profit_max / score)
  // ==================================================

  const saveRow = async (rule: ScoreRule) => {
    const draft = drafts[rule.id];
    if (!draft) return;

    setRowFeedback(rule.id, { loading: true, error: "", success: "" });

    try {
      const res = await fetch(`/api/wingsm/score-rules/${rule.id}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profit_min: draft.profit_min,
          profit_max: draft.profit_max,
          score: draft.score,
        }),
      });

      const payload = await res.json().catch(() => null);

      if (!res.ok || !payload?.success) {
        throw new Error(payload?.error || `HTTP ${res.status}`);
      }

      const updated: ScoreRule = payload.rule;

      setRules((current) => current.map((r) => (r.id === updated.id ? updated : r)));
      setDrafts((current) => ({ ...current, [updated.id]: ruleToDraft(updated) }));
      setRowFeedback(rule.id, { loading: false, success: "Kaydedildi." });

      window.setTimeout(() => setRowFeedback(rule.id, { success: "" }), 2500);
    } catch (err) {
      setRowFeedback(rule.id, {
        loading: false,
        error: err instanceof Error ? err.message : "Kaydedilemedi.",
      });
    }
  };

  // ==================================================
  // AKTİF / PASİF ANAHTARI
  // ==================================================

  const toggleActive = async (rule: ScoreRule) => {
    setRowFeedback(rule.id, { loading: true, error: "", success: "" });

    try {
      const res = await fetch(`/api/wingsm/score-rules/${rule.id}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !rule.active }),
      });

      const payload = await res.json().catch(() => null);

      if (!res.ok || !payload?.success) {
        throw new Error(payload?.error || `HTTP ${res.status}`);
      }

      const updated: ScoreRule = payload.rule;
      setRules((current) => current.map((r) => (r.id === updated.id ? updated : r)));
      setRowFeedback(rule.id, {
        loading: false,
        success: updated.active ? "Aktif edildi." : "Pasif edildi.",
      });

      window.setTimeout(() => setRowFeedback(rule.id, { success: "" }), 2500);
    } catch (err) {
      setRowFeedback(rule.id, {
        loading: false,
        error: err instanceof Error ? err.message : "Durum güncellenemedi.",
      });
    }
  };

  // ==================================================
  // SATIR SİL (soft delete — bkz. API route yorumu)
  // ==================================================

  const deleteRow = async (rule: ScoreRule) => {
    const confirmed = window.confirm(
      `${rule.class_label} sınıfının ${formatNumber(rule.profit_min)} - ${formatNumber(
        rule.profit_max
      )} aralığını pasif hale getirmek istediğine emin misin? (Kalıcı olarak silinmez, denetim için saklanır ve Aktif anahtarıyla geri açılabilir.)`
    );

    if (!confirmed) return;

    setRowFeedback(rule.id, { loading: true, error: "", success: "" });

    try {
      const res = await fetch(`/api/wingsm/score-rules/${rule.id}`, {
        method: "DELETE",
        credentials: "same-origin",
      });

      const payload = await res.json().catch(() => null);

      if (!res.ok || !payload?.success) {
        throw new Error(payload?.error || `HTTP ${res.status}`);
      }

      const updated: ScoreRule = payload.rule;
      setRules((current) => current.map((r) => (r.id === updated.id ? updated : r)));
      setRowFeedback(rule.id, { loading: false, success: "Pasif hale getirildi." });

      window.setTimeout(() => setRowFeedback(rule.id, { success: "" }), 2500);
    } catch (err) {
      setRowFeedback(rule.id, {
        loading: false,
        error: err instanceof Error ? err.message : "Silinemedi.",
      });
    }
  };

  // ==================================================
  // YENİ KURAL EKLE (yeni sınıf ya da mevcut sınıfa yeni aralık — TEK form,
  // Excel'deki gibi düz bir satır ekleme mantığı. class_code zaten var olan
  // bir sınıfla aynıysa bu, o sınıfa yeni bir aralık eklemiş olur; DB'de
  // class_code üzerinde bir benzersizlik kısıtı yok.)
  // ==================================================

  const addClass = async () => {
    setNewClassState({ loading: true, error: "", success: "" });

    try {
      const res = await fetch("/api/wingsm/score-rules", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          class_code: newClassDraft.class_code,
          class_label: newClassDraft.class_label,
          profit_min: newClassDraft.profit_min,
          profit_max: newClassDraft.profit_max,
          score: newClassDraft.score,
          active: true,
        }),
      });

      const payload = await res.json().catch(() => null);

      if (!res.ok || !payload?.success) {
        throw new Error(payload?.error || `HTTP ${res.status}`);
      }

      const created: ScoreRule = payload.rule;
      setRules((current) => [...current, created]);
      setDrafts((current) => ({ ...current, [created.id]: ruleToDraft(created) }));
      setNewClassDraft(EMPTY_NEW_CLASS);
      setNewClassState({ loading: false, error: "", success: "Yeni sınıf eklendi." });

      window.setTimeout(() => setNewClassState((current) => ({ ...current, success: "" })), 3000);
    } catch (err) {
      setNewClassState({
        loading: false,
        error: err instanceof Error ? err.message : "Sınıf eklenemedi.",
        success: "",
      });
    }
  };

  return (
    <div className="animate-in fade-in duration-500">
      <div className="mb-6 flex items-center gap-2 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab("kurallar")}
          className={`h-10 rounded-t-lg px-4 text-xs font-black uppercase tracking-wide transition ${
            activeTab === "kurallar"
              ? "border-b-2 border-blue-600 text-blue-700"
              : "text-slate-400 hover:text-slate-600"
          }`}
        >
          Kurallar
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("rapor")}
          className={`h-10 rounded-t-lg px-4 text-xs font-black uppercase tracking-wide transition ${
            activeTab === "rapor"
              ? "border-b-2 border-blue-600 text-blue-700"
              : "text-slate-400 hover:text-slate-600"
          }`}
        >
          Rapor
        </button>
      </div>

      {activeTab === "kurallar" && (
      <>
      <div className="mb-6 flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black">Değer Puan Kuralları</h1>
          <p className="mt-1 text-sm text-slate-500">
            Sınıf (Mal Sınıfı) ve kâr aralığına göre Değer Puan kuralları. Bu tablo, PersonelGidisat /
            MagazaGidisat&apos;taki &quot;DEĞER PUAN&quot; toplamlarını besleyen kaynak veridir — burada
            yaptığın değişiklik canlıdır.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs font-bold text-slate-500">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
            />
            Pasif kuralları da göster
          </label>

          <button
            type="button"
            onClick={runResync}
            disabled={resyncing}
            title="Bilinen 5 sınıf x 12 aralığın puanını Excel kaynağıyla yeniden eşitler. Sonradan eklediğin başka sınıf/aralıklara dokunmaz."
            className="h-9 whitespace-nowrap rounded-lg bg-amber-600 px-4 text-xs font-black text-white shadow-sm transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {resyncing ? "EŞİTLENİYOR..." : "EXCEL İLE EŞİTLE"}
          </button>
        </div>
      </div>

      {resyncMessage && (
        <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
          {resyncMessage}
        </div>
      )}

      {loadError && (
        <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          <div>{loadError}</div>
          <div className="mt-2 text-xs font-semibold text-red-600">
            Tablo henüz oluşturulmamış olabilir. Aşağıdaki butonla bir kerelik kurulumu çalıştırabilirsiniz.
          </div>
          <button
            type="button"
            onClick={runMigration}
            disabled={migrating}
            className="mt-3 h-9 rounded-lg bg-red-700 px-4 text-xs font-black text-white hover:bg-red-800 disabled:opacity-50"
          >
            {migrating ? "Kuruluyor..." : "Kurulumu Çalıştır (tablo oluştur + seed verisi)"}
          </button>
        </div>
      )}

      {migrateMessage && (
        <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
          {migrateMessage}
        </div>
      )}

      {loading ? (
        <div className="flex min-h-[200px] items-center justify-center text-sm font-bold text-slate-400">
          Kurallar yükleniyor...
        </div>
      ) : (
        <div className="space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[8px] font-black uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-3">Sınıf Kodu</th>
                    <th className="px-4 py-3">Sınıf Adı</th>
                    <th className="px-4 py-3">Kâr Alt Sınır</th>
                    <th className="px-4 py-3">Kâr Üst Sınır</th>
                    <th className="px-4 py-3">Puan</th>
                    <th className="px-4 py-3">Durum</th>
                    <th className="px-4 py-3">İşlemler</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visibleRules.map((rule) => {
                    const rowDraft = drafts[rule.id] || ruleToDraft(rule);
                    const rs = rowState[rule.id] || { loading: false, error: "", success: "" };

                    return (
                      <tr key={rule.id} className={rule.active ? "" : "opacity-60"}>
                        <td className="px-4 py-3 text-[11px] font-black text-slate-500">{rule.class_code}</td>
                        <td className="px-4 py-3 text-[11px] font-bold">{rule.class_label}</td>
                        <td className="px-4 py-3">
                          <input
                            value={rowDraft.profit_min}
                            onChange={(e) => updateDraft(rule.id, "profit_min", e.target.value)}
                            disabled={rs.loading}
                            className="h-9 w-28 rounded-lg border border-slate-200 px-2.5 text-[11px] font-semibold outline-none focus:border-blue-400 disabled:bg-slate-50"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            value={rowDraft.profit_max}
                            onChange={(e) => updateDraft(rule.id, "profit_max", e.target.value)}
                            disabled={rs.loading}
                            className="h-9 w-28 rounded-lg border border-slate-200 px-2.5 text-[11px] font-semibold outline-none focus:border-blue-400 disabled:bg-slate-50"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            value={rowDraft.score}
                            onChange={(e) => updateDraft(rule.id, "score", e.target.value)}
                            disabled={rs.loading}
                            className="h-9 w-20 rounded-lg border border-slate-200 px-2.5 text-[11px] font-semibold outline-none focus:border-blue-400 disabled:bg-slate-50"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => toggleActive(rule)}
                            disabled={rs.loading}
                            className={`inline-flex rounded-full px-2.5 py-1 text-[8px] font-black transition disabled:opacity-50 ${
                              rule.active
                                ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                                : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                            }`}
                          >
                            {rule.active ? "AKTİF" : "PASİF"}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => saveRow(rule)}
                              disabled={rs.loading}
                              className="h-8 whitespace-nowrap rounded-lg bg-blue-600 px-3 text-[8px] font-black uppercase text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {rs.loading ? "KAYDEDİLİYOR..." : "KAYDET"}
                            </button>

                            <button
                              type="button"
                              onClick={() => deleteRow(rule)}
                              disabled={rs.loading || !rule.active}
                              className="h-8 whitespace-nowrap rounded-lg bg-rose-50 px-3 text-[8px] font-black uppercase text-rose-600 shadow-sm transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              SİL
                            </button>
                          </div>

                          {rs.error && (
                            <div className="mt-2 max-w-[220px] text-[8px] font-bold leading-4 text-rose-600">
                              {rs.error}
                            </div>
                          )}
                          {rs.success && (
                            <div className="mt-2 max-w-[220px] text-[8px] font-bold leading-4 text-emerald-600">
                              {rs.success}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {visibleRules.length === 0 && (
              <div className="p-8 text-center text-sm font-bold text-slate-400">Henüz kural yok.</div>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-4">
              <div className="text-lg font-black">Mağaza Çarpanı</div>
              <p className="mt-1 text-xs font-semibold text-slate-500">
                Her mağazanın Toplam Puanını Çarpanlı Puana çeviren katsayı (Excel&apos;deki &quot;MAĞAZA
                ÇARPANI&quot; tablosu — varsayılan 1).
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-4">
              {multipliers.map((m) => {
                const ms = multiplierState[m.branch_label] || { loading: false, error: "", success: "" };
                return (
                  <div key={m.branch_label} className="rounded-xl border border-slate-200 p-3">
                    <div className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                      {m.branch_label}
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <input
                        value={multiplierDrafts[m.branch_label] ?? m.multiplier}
                        onChange={(e) =>
                          setMultiplierDrafts((current) => ({ ...current, [m.branch_label]: e.target.value }))
                        }
                        disabled={ms.loading}
                        className="h-9 w-20 rounded-lg border border-slate-200 px-2.5 text-[11px] font-semibold outline-none focus:border-blue-400 disabled:bg-slate-50"
                      />
                      <button
                        type="button"
                        onClick={() => saveMultiplier(m.branch_label)}
                        disabled={ms.loading}
                        className="h-9 whitespace-nowrap rounded-lg bg-blue-600 px-3 text-[8px] font-black uppercase text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {ms.loading ? "..." : "KAYDET"}
                      </button>
                    </div>
                    {ms.error && <div className="mt-2 text-[8px] font-bold text-rose-600">{ms.error}</div>}
                    {ms.success && <div className="mt-2 text-[8px] font-bold text-emerald-600">{ms.success}</div>}
                  </div>
                );
              })}

              {multipliers.length === 0 && (
                <div className="col-span-full text-xs font-bold text-slate-400">
                  Mağaza çarpanı tablosu henüz kurulmadı — yukarıdaki bir kaydet işlemiyle otomatik oluşturulacak,
                  şimdilik hepsi 1 kabul ediliyor.
                </div>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-dashed border-blue-300 bg-blue-50/40 p-5">
            <h2 className="text-sm font-black text-blue-800">Yeni Kural Ekle</h2>
            <p className="mt-1 text-xs font-semibold text-blue-600">
              Yeni bir sınıf ya da var olan bir sınıfa yeni bir kâr aralığı eklemek için aynı sınıf kodunu
              kullan — Excel'deki gibi tek bir satır ekleme.
            </p>

            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
              <label>
                <div className="mb-1 text-[10px] font-black uppercase text-slate-500">Sınıf Kodu</div>
                <input
                  value={newClassDraft.class_code}
                  onChange={(e) => setNewClassDraft((c) => ({ ...c, class_code: e.target.value }))}
                  placeholder="ör. 9el"
                  className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                />
              </label>
              <label>
                <div className="mb-1 text-[10px] font-black uppercase text-slate-500">Sınıf Adı</div>
                <input
                  value={newClassDraft.class_label}
                  onChange={(e) => setNewClassDraft((c) => ({ ...c, class_label: e.target.value }))}
                  placeholder="ör. YENİ SINIF"
                  className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                />
              </label>
              <label>
                <div className="mb-1 text-[10px] font-black uppercase text-slate-500">Alt Sınır</div>
                <input
                  value={newClassDraft.profit_min}
                  onChange={(e) => setNewClassDraft((c) => ({ ...c, profit_min: e.target.value }))}
                  placeholder="-999999999"
                  className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                />
              </label>
              <label>
                <div className="mb-1 text-[10px] font-black uppercase text-slate-500">Üst Sınır</div>
                <input
                  value={newClassDraft.profit_max}
                  onChange={(e) => setNewClassDraft((c) => ({ ...c, profit_max: e.target.value }))}
                  placeholder="999999999"
                  className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                />
              </label>
              <label>
                <div className="mb-1 text-[10px] font-black uppercase text-slate-500">Puan</div>
                <input
                  value={newClassDraft.score}
                  onChange={(e) => setNewClassDraft((c) => ({ ...c, score: e.target.value }))}
                  placeholder="0"
                  className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                />
              </label>
            </div>

            <button
              type="button"
              onClick={addClass}
              disabled={newClassState.loading}
              className="mt-4 h-10 rounded-lg bg-blue-700 px-5 text-sm font-black text-white hover:bg-blue-800 disabled:opacity-50"
            >
              {newClassState.loading ? "EKLENİYOR..." : "KURAL EKLE"}
            </button>

            {newClassState.error && (
              <div className="mt-3 text-xs font-bold text-rose-600">{newClassState.error}</div>
            )}
            {newClassState.success && (
              <div className="mt-3 text-xs font-bold text-emerald-600">{newClassState.success}</div>
            )}
          </section>
        </div>
      )}
      </>
      )}

      {activeTab === "rapor" && (
        <div>
          <div className="mb-6">
            <h1 className="text-2xl font-black">Değer Puan Raporu</h1>
            <p className="mt-1 text-sm text-slate-500">
              Seçilen tarih aralığında CMR&apos;nin 4 mağazası (Merkez, Cadde, Saray, Kapaklı) için WingSM
              satışları yukarıdaki kurallara göre puanlanır. Hesaplama anlıktır — hiçbir yere kaydedilmez,
              her seferinde yeniden hesaplanır.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-end gap-3">
              <label>
                <div className="mb-1 text-[10px] font-black uppercase text-slate-500">Başlangıç (GG.AA.YYYY)</div>
                <input
                  value={reportBastar}
                  onChange={(e) => setReportBastar(e.target.value)}
                  disabled={reportState.loading}
                  className="h-10 w-40 rounded-lg border border-slate-200 px-3 text-sm disabled:bg-slate-50"
                />
              </label>
              <label>
                <div className="mb-1 text-[10px] font-black uppercase text-slate-500">Bitiş (GG.AA.YYYY)</div>
                <input
                  value={reportBittar}
                  onChange={(e) => setReportBittar(e.target.value)}
                  disabled={reportState.loading}
                  className="h-10 w-40 rounded-lg border border-slate-200 px-3 text-sm disabled:bg-slate-50"
                />
              </label>
              <button
                type="button"
                onClick={runReport}
                disabled={reportState.loading}
                className="h-10 rounded-lg bg-blue-700 px-5 text-sm font-black text-white hover:bg-blue-800 disabled:opacity-50"
              >
                {reportState.loading ? "HESAPLANIYOR..." : "HESAPLA"}
              </button>

              {report && (
                <button
                  type="button"
                  onClick={exportReportToExcel}
                  className="h-10 rounded-lg bg-emerald-700 px-5 text-sm font-black text-white hover:bg-emerald-800"
                >
                  EXCEL&apos;E AKTAR
                </button>
              )}
            </div>

            {reportState.error && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs font-bold text-red-700">
                {reportState.error}
              </div>
            )}
            {reportState.success && (
              <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-700">
                {reportState.success}
              </div>
            )}
          </div>

          {report && (
            <div className="mt-6 space-y-6">
              {report.unmatchedCount > 0 && (
                <div className="rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4">
                  <div className="text-sm font-black text-amber-800">
                    {report.unmatchedCount} satışta eşleşen puan kuralı bulunamadı (puanı 0 sayıldı)
                  </div>
                  <p className="mt-1 text-xs font-semibold text-amber-700">
                    Aşağıdakiler ilk 20 örnek — eksik kural varsa &quot;Kurallar&quot; sekmesinden ekleyebilirsin.
                  </p>
                  <div className="mt-3 max-h-[240px] overflow-auto rounded-lg border border-amber-200 bg-white">
                    <table className="w-full min-w-[560px] text-left">
                      <thead>
                        <tr className="border-b border-amber-100 bg-amber-50 text-[8px] font-black uppercase tracking-wide text-amber-700">
                          <th className="px-3 py-2">Mağaza</th>
                          <th className="px-3 py-2">Satıcı</th>
                          <th className="px-3 py-2">Sınıf</th>
                          <th className="px-3 py-2">Sınıf Adı</th>
                          <th className="px-3 py-2">Kârlılık</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-amber-50">
                        {report.unmatchedSample.map((u, i) => (
                          <tr key={i}>
                            <td className="px-3 py-2 text-[11px] font-semibold">{u.branchLabel}</td>
                            <td className="px-3 py-2 text-[11px] font-semibold">{u.saticiAdi}</td>
                            <td className="px-3 py-2 text-[11px] font-semibold">{u.malSinif}</td>
                            <td className="px-3 py-2 text-[11px] font-semibold">{u.malSinifAdi}</td>
                            <td className="px-3 py-2 text-[11px] font-semibold">{formatNumber(String(u.karlilik))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
                  <div className="text-lg font-black">Mağaza Bazlı</div>
                  <div className="text-xs font-bold text-slate-400">
                    Toplam {report.totalSaleCount} satış / {formatNumber(String(report.totalScore))} puan /{" "}
                    {formatNumber(String(report.totalCarpanliPuan))} çarpanlı puan
                    {report.excludedOutOfScopeCount > 0 && (
                      <> · {report.excludedOutOfScopeCount} satış Değer Puan kapsamı dışında (kayıtlı sınıf değil) hariç tutuldu</>
                    )}
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-left">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-[8px] font-black uppercase tracking-wide text-slate-500">
                        <th className="px-4 py-3">Mağaza</th>
                        <th className="px-4 py-3">Satış Adedi</th>
                        <th className="px-4 py-3">Toplam Puan</th>
                        <th className="px-4 py-3">Çarpan</th>
                        <th className="px-4 py-3">Çarpanlı Puan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {report.stores.map((s) => (
                        <tr key={s.depotCode}>
                          <td className="px-4 py-3 text-[11px] font-bold">{s.branchLabel}</td>
                          <td className="px-4 py-3 text-[11px] font-semibold">{s.saleCount}</td>
                          <td className="px-4 py-3 text-[11px] font-semibold">{formatNumber(String(s.totalScore))}</td>
                          <td className="px-4 py-3 text-[11px] font-semibold">{formatNumber(String(s.multiplier))}</td>
                          <td className="px-4 py-3 text-[11px] font-black">{formatNumber(String(s.carpanliPuan))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 px-5 py-4 text-lg font-black">Personel Bazlı</div>
                <div className="max-h-[420px] overflow-auto">
                  <table className="w-full min-w-[640px] text-left">
                    <thead>
                      <tr className="sticky top-0 border-b border-slate-200 bg-slate-50 text-[8px] font-black uppercase tracking-wide text-slate-500">
                        <th className="px-4 py-3">Mağaza</th>
                        <th className="px-4 py-3">Satıcı</th>
                        <th className="px-4 py-3">Satış Adedi</th>
                        <th className="px-4 py-3">Toplam Puan</th>
                        <th className="px-4 py-3">Çarpanlı Puan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {report.personnel.map((p, i) => (
                        <tr key={`${p.branchLabel}-${p.saticiKod || p.saticiAdi}-${i}`}>
                          <td className="px-4 py-3 text-[11px] font-bold">{p.branchLabel}</td>
                          <td className="px-4 py-3 text-[11px] font-semibold">{p.saticiAdi || p.saticiKod}</td>
                          <td className="px-4 py-3 text-[11px] font-semibold">{p.saleCount}</td>
                          <td className="px-4 py-3 text-[11px] font-semibold">{formatNumber(String(p.totalScore))}</td>
                          <td className="px-4 py-3 text-[11px] font-black">{formatNumber(String(p.carpanliPuan))}</td>
                        </tr>
                      ))}
                      {report.personnel.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-4 py-6 text-center text-xs font-bold text-slate-400">
                            Bu aralıkta satış bulunamadı.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 px-5 py-4 text-lg font-black">Detay</div>
                <div className="max-h-[480px] overflow-auto">
                  <table className="w-full min-w-[920px] text-left">
                    <thead>
                      <tr className="sticky top-0 border-b border-slate-200 bg-slate-50 text-[8px] font-black uppercase tracking-wide text-slate-500">
                        <th className="px-4 py-3">Mağaza</th>
                        <th className="px-4 py-3">Satıcı</th>
                        <th className="px-4 py-3">Ürün</th>
                        <th className="px-4 py-3">Sınıf</th>
                        <th className="px-4 py-3">Kârlılık</th>
                        <th className="px-4 py-3">Puan</th>
                        <th className="px-4 py-3">Tarih</th>
                        <th className="px-4 py-3">Fatura No</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {report.detailRows.map((d, i) => (
                        <tr key={i}>
                          <td className="px-4 py-3 text-[11px] font-bold">{d.branchLabel}</td>
                          <td className="px-4 py-3 text-[11px] font-semibold">{d.saticiAdi || d.saticiKod}</td>
                          <td className="px-4 py-3 text-[11px] font-semibold">{d.malAd}</td>
                          <td className="px-4 py-3 text-[11px] font-semibold">
                            {d.malSinif} — {d.malSinifAdi}
                          </td>
                          <td className="px-4 py-3 text-[11px] font-semibold">{formatNumber(String(d.karlilik))}</td>
                          <td className="px-4 py-3 text-[11px] font-semibold">{formatNumber(String(d.score))}</td>
                          <td className="px-4 py-3 text-[11px] font-semibold">{d.tarih}</td>
                          <td className="px-4 py-3 text-[11px] font-semibold">{d.faturaNo}</td>
                        </tr>
                      ))}
                      {report.detailRows.length === 0 && (
                        <tr>
                          <td colSpan={8} className="px-4 py-6 text-center text-xs font-bold text-slate-400">
                            Bu aralıkta satış bulunamadı.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
