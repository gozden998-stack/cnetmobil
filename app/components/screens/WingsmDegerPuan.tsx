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
};

const EMPTY_NEW_CLASS: NewClassDraft = {
  class_code: "",
  class_label: "",
};

// Excel kaynağındaki ("cmr değer puan HAZİRAN2026 (2).xlsm") 12 sabit kâr
// aralığı ve sütun başlıkları — SINIF satırları x bu 12 sütun, Excel'deki
// GÖRSEL DÜZENLE BİREBİR AYNI (dikey liste değil, yatay ızgara).
// migrate/route.ts ve score-rules/resync/route.ts'teki BRACKETS ile AYNI.
const CANON_BRACKETS: Array<{ min: number; max: number; label: string }> = [
  { min: -999999999, max: -3000, label: "-3000" },
  { min: -2999.99, max: -100, label: "-100" },
  { min: -99.99, max: 0, label: "0" },
  { min: 0.01, max: 100, label: "100" },
  { min: 100.01, max: 300, label: "300" },
  { min: 300.01, max: 750, label: "750" },
  { min: 750.01, max: 1500, label: "1500" },
  { min: 1500.01, max: 3000, label: "3000" },
  { min: 3000.01, max: 5000, label: "5000" },
  { min: 5000.01, max: 8000, label: "8000" },
  { min: 8000.01, max: 12000, label: "12000" },
  { min: 12000.01, max: 999999999, label: "12001" },
];

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

  // Izgarada henüz karşılığı olmayan (o sınıfta o aralık için satır hiç
  // oluşturulmamış) hücrelere yazılan değer — "sınıfı kaydet" tıklanınca
  // bunlar için yeni kural OLUŞTURULUR, var olanlar için PATCH yapılır.
  const [newCellDrafts, setNewCellDrafts] = useState<Record<string, string>>({});
  const [classRowState, setClassRowState] = useState<Record<string, RowState>>({});

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
  // IZGARA (Excel'deki gibi — SINIF satırları x 12 sabit kâr aralığı sütunu)
  // ==================================================

  type ClassGroup = {
    classCode: string;
    label: string;
    active: boolean;
    cellByBracketIndex: Map<number, ScoreRule>;
  };

  const classGroups = useMemo<ClassGroup[]>(() => {
    const map = new Map<string, ClassGroup>();

    for (const rule of rules) {
      let group = map.get(rule.class_code);
      if (!group) {
        group = { classCode: rule.class_code, label: rule.class_label, active: true, cellByBracketIndex: new Map() };
        map.set(rule.class_code, group);
      }

      const bracketIndex = CANON_BRACKETS.findIndex(
        (b) => b.min === Number(rule.profit_min) && b.max === Number(rule.profit_max)
      );

      if (bracketIndex >= 0) {
        group.cellByBracketIndex.set(bracketIndex, rule);
      }
    }

    for (const group of map.values()) {
      const cells = Array.from(group.cellByBracketIndex.values());
      group.active = cells.length === 0 || cells.some((r) => r.active);
    }

    let groups = Array.from(map.values()).sort((a, b) => a.classCode.localeCompare(b.classCode, "tr"));

    if (!showInactive) {
      groups = groups.filter((g) => g.active);
    }

    return groups;
  }, [rules, showInactive]);

  const updateDraft = (id: number, field: keyof Draft, value: string) => {
    setDrafts((current) => ({
      ...current,
      [id]: { ...current[id], [field]: value },
    }));
  };

  // ==================================================
  // SINIF SATIRI KAYDET — ızgaradaki bir sınıf satırının 12 hücresini
  // TEK "KAYDET" ile toplu işler: var olan hücre -> PATCH (saveRow ile
  // AYNI), henüz kural satırı olmayan (yeni doldurulmuş) hücre -> POST.
  // ==================================================

  const saveClassRow = async (group: ClassGroup) => {
    setClassRowState((current) => ({ ...current, [group.classCode]: { loading: true, error: "", success: "" } }));

    try {
      const results = await Promise.all(
        CANON_BRACKETS.map(async (bracket, index) => {
          const existingRule = group.cellByBracketIndex.get(index);

          if (existingRule) {
            const draft = drafts[existingRule.id];
            if (!draft || Number(draft.score) === Number(existingRule.score)) {
              return null;
            }

            const res = await fetch(`/api/wingsm/score-rules/${existingRule.id}`, {
              method: "PATCH",
              credentials: "same-origin",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ score: draft.score }),
            });
            const payload = await res.json().catch(() => null);
            if (!res.ok || !payload?.success) {
              throw new Error(payload?.error || `HTTP ${res.status}`);
            }
            return payload.rule as ScoreRule;
          }

          const cellKey = `${group.classCode}::${index}`;
          const newValue = newCellDrafts[cellKey];
          if (newValue === undefined || newValue.trim() === "") {
            return null;
          }

          const res = await fetch("/api/wingsm/score-rules", {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              class_code: group.classCode,
              class_label: group.label,
              profit_min: bracket.min,
              profit_max: bracket.max,
              score: newValue,
              active: true,
            }),
          });
          const payload = await res.json().catch(() => null);
          if (!res.ok || !payload?.success) {
            throw new Error(payload?.error || `HTTP ${res.status}`);
          }
          return payload.rule as ScoreRule;
        })
      );

      const changed = results.filter((r): r is ScoreRule => r !== null);

      if (changed.length > 0) {
        setRules((current) => {
          const byId = new Map(current.map((r) => [r.id, r]));
          for (const rule of changed) byId.set(rule.id, rule);
          return Array.from(byId.values());
        });
        setDrafts((current) => {
          const next = { ...current };
          for (const rule of changed) next[rule.id] = ruleToDraft(rule);
          return next;
        });
        setNewCellDrafts((current) => {
          const next = { ...current };
          for (let i = 0; i < CANON_BRACKETS.length; i += 1) delete next[`${group.classCode}::${i}`];
          return next;
        });
      }

      setClassRowState((current) => ({
        ...current,
        [group.classCode]: { loading: false, error: "", success: changed.length > 0 ? "Kaydedildi." : "Değişiklik yok." },
      }));

      window.setTimeout(
        () =>
          setClassRowState((current) => ({ ...current, [group.classCode]: { ...current[group.classCode], success: "" } })),
        2500
      );
    } catch (err) {
      setClassRowState((current) => ({
        ...current,
        [group.classCode]: { loading: false, error: err instanceof Error ? err.message : "Kaydedilemedi.", success: "" },
      }));
    }
  };

  // ==================================================
  // SINIFI AKTİF/PASİF YAP (o sınıfın TÜM aralıklarını birlikte)
  // ==================================================

  const toggleClassActive = async (group: ClassGroup) => {
    const nextActive = !group.active;

    setClassRowState((current) => ({ ...current, [group.classCode]: { loading: true, error: "", success: "" } }));

    try {
      const rows = Array.from(group.cellByBracketIndex.values());

      const updated = await Promise.all(
        rows.map(async (rule) => {
          const res = await fetch(`/api/wingsm/score-rules/${rule.id}`, {
            method: "PATCH",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ active: nextActive }),
          });
          const payload = await res.json().catch(() => null);
          if (!res.ok || !payload?.success) {
            throw new Error(payload?.error || `HTTP ${res.status}`);
          }
          return payload.rule as ScoreRule;
        })
      );

      setRules((current) => {
        const byId = new Map(current.map((r) => [r.id, r]));
        for (const rule of updated) byId.set(rule.id, rule);
        return Array.from(byId.values());
      });

      setClassRowState((current) => ({
        ...current,
        [group.classCode]: { loading: false, error: "", success: nextActive ? "Aktif edildi." : "Pasif edildi." },
      }));

      window.setTimeout(
        () =>
          setClassRowState((current) => ({ ...current, [group.classCode]: { ...current[group.classCode], success: "" } })),
        2500
      );
    } catch (err) {
      setClassRowState((current) => ({
        ...current,
        [group.classCode]: { loading: false, error: err instanceof Error ? err.message : "Durum güncellenemedi.", success: "" },
      }));
    }
  };

  // ==================================================
  // SINIFI SİL (soft delete — o sınıfın TÜM aralıkları)
  // ==================================================

  const deleteClassRows = async (group: ClassGroup) => {
    const confirmed = window.confirm(
      `${group.label} sınıfının tüm kâr aralıklarını pasif hale getirmek istediğine emin misin? (Kalıcı olarak silinmez, Aktif anahtarıyla geri açılabilir.)`
    );
    if (!confirmed) return;

    setClassRowState((current) => ({ ...current, [group.classCode]: { loading: true, error: "", success: "" } }));

    try {
      const rows = Array.from(group.cellByBracketIndex.values());

      const updated = await Promise.all(
        rows.map(async (rule) => {
          const res = await fetch(`/api/wingsm/score-rules/${rule.id}`, {
            method: "DELETE",
            credentials: "same-origin",
          });
          const payload = await res.json().catch(() => null);
          if (!res.ok || !payload?.success) {
            throw new Error(payload?.error || `HTTP ${res.status}`);
          }
          return payload.rule as ScoreRule;
        })
      );

      setRules((current) => {
        const byId = new Map(current.map((r) => [r.id, r]));
        for (const rule of updated) byId.set(rule.id, rule);
        return Array.from(byId.values());
      });

      setClassRowState((current) => ({
        ...current,
        [group.classCode]: { loading: false, error: "", success: "Pasif hale getirildi." },
      }));
    } catch (err) {
      setClassRowState((current) => ({
        ...current,
        [group.classCode]: { loading: false, error: err instanceof Error ? err.message : "Silinemedi.", success: "" },
      }));
    }
  };

  // ==================================================
  // YENİ SINIF EKLE — 12 sabit aralığın tamamını (skor 0) tek seferde
  // oluşturur, ızgarada hemen dolu bir satır olarak belirir.
  // ==================================================

  const addNewClassRow = async () => {
    const classCode = newClassDraft.class_code.trim();
    const classLabel = newClassDraft.class_label.trim();

    if (!classCode || !classLabel) {
      setNewClassState({ loading: false, error: "Sınıf Kodu ve Sınıf Adı zorunludur.", success: "" });
      return;
    }

    if (rules.some((r) => r.class_code === classCode)) {
      setNewClassState({ loading: false, error: `"${classCode}" sınıfı zaten var — mevcut satırdan düzenle.`, success: "" });
      return;
    }

    setNewClassState({ loading: true, error: "", success: "" });

    try {
      const created = await Promise.all(
        CANON_BRACKETS.map(async (bracket) => {
          const res = await fetch("/api/wingsm/score-rules", {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              class_code: classCode,
              class_label: classLabel,
              profit_min: bracket.min,
              profit_max: bracket.max,
              score: 0,
              active: true,
            }),
          });
          const payload = await res.json().catch(() => null);
          if (!res.ok || !payload?.success) {
            throw new Error(payload?.error || `HTTP ${res.status}`);
          }
          return payload.rule as ScoreRule;
        })
      );

      setRules((current) => [...current, ...created]);
      setDrafts((current) => {
        const next = { ...current };
        for (const rule of created) next[rule.id] = ruleToDraft(rule);
        return next;
      });
      setNewClassDraft(EMPTY_NEW_CLASS);
      setNewClassState({ loading: false, error: "", success: "Yeni sınıf eklendi (12 aralık, puan 0 ile)." });

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
              <table className="w-full min-w-[1400px] text-left">
                <thead>
                  <tr className="border-b border-slate-200 bg-yellow-100 text-[8px] font-black uppercase tracking-wide text-slate-600">
                    <th className="px-3 py-3">Sınıf</th>
                    <th className="px-3 py-3">Sınıf Kodu</th>
                    {CANON_BRACKETS.map((b) => (
                      <th key={b.label} className="px-2 py-3 text-center">
                        {b.label}
                      </th>
                    ))}
                    <th className="px-3 py-3">İşlemler</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {classGroups.map((group) => {
                    const crs = classRowState[group.classCode] || { loading: false, error: "", success: "" };

                    return (
                      <tr key={group.classCode} className={group.active ? "" : "opacity-50"}>
                        <td className="px-3 py-2 text-[11px] font-bold whitespace-nowrap">{group.label}</td>
                        <td className="px-3 py-2 text-[11px] font-black text-slate-500 whitespace-nowrap">
                          {group.classCode}
                        </td>

                        {CANON_BRACKETS.map((bracket, index) => {
                          const rule = group.cellByBracketIndex.get(index);

                          if (rule) {
                            const rowDraft = drafts[rule.id] || ruleToDraft(rule);
                            return (
                              <td key={bracket.label} className="px-1 py-2">
                                <input
                                  value={rowDraft.score}
                                  onChange={(e) => updateDraft(rule.id, "score", e.target.value)}
                                  disabled={crs.loading}
                                  className={`h-9 w-16 rounded-lg border px-1.5 text-center text-[11px] font-semibold outline-none focus:border-blue-400 disabled:bg-slate-50 ${
                                    rule.active ? "border-slate-200" : "border-rose-200 bg-rose-50/40"
                                  }`}
                                />
                              </td>
                            );
                          }

                          const cellKey = `${group.classCode}::${index}`;
                          return (
                            <td key={bracket.label} className="px-1 py-2">
                              <input
                                value={newCellDrafts[cellKey] ?? ""}
                                onChange={(e) =>
                                  setNewCellDrafts((current) => ({ ...current, [cellKey]: e.target.value }))
                                }
                                disabled={crs.loading}
                                placeholder="-"
                                className="h-9 w-16 rounded-lg border border-dashed border-slate-300 px-1.5 text-center text-[11px] font-semibold text-slate-400 outline-none focus:border-blue-400 disabled:bg-slate-50"
                              />
                            </td>
                          );
                        })}

                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => saveClassRow(group)}
                              disabled={crs.loading}
                              className="h-8 whitespace-nowrap rounded-lg bg-blue-600 px-2.5 text-[8px] font-black uppercase text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {crs.loading ? "..." : "KAYDET"}
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleClassActive(group)}
                              disabled={crs.loading}
                              className={`h-8 whitespace-nowrap rounded-full px-2.5 text-[8px] font-black transition disabled:opacity-50 ${
                                group.active
                                  ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                                  : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                              }`}
                            >
                              {group.active ? "AKTİF" : "PASİF"}
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteClassRows(group)}
                              disabled={crs.loading || !group.active}
                              className="h-8 whitespace-nowrap rounded-lg bg-rose-50 px-2.5 text-[8px] font-black uppercase text-rose-600 shadow-sm transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              SİL
                            </button>
                          </div>
                          {crs.error && (
                            <div className="mt-1 max-w-[180px] text-[8px] font-bold leading-4 text-rose-600">
                              {crs.error}
                            </div>
                          )}
                          {crs.success && (
                            <div className="mt-1 max-w-[180px] text-[8px] font-bold leading-4 text-emerald-600">
                              {crs.success}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {classGroups.length === 0 && (
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
            <h2 className="text-sm font-black text-blue-800">Yeni Sınıf Ekle</h2>
            <p className="mt-1 text-xs font-semibold text-blue-600">
              Yukarıdaki ızgaraya, 12 kâr aralığının tamamı puan 0 ile hazır olan yeni bir satır ekler —
              sonrasında hücrelere yazıp o satırın KAYDET&apos;ine basarsın.
            </p>

            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
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
            </div>

            <button
              type="button"
              onClick={addNewClassRow}
              disabled={newClassState.loading}
              className="mt-4 h-10 rounded-lg bg-blue-700 px-5 text-sm font-black text-white hover:bg-blue-800 disabled:opacity-50"
            >
              {newClassState.loading ? "EKLENİYOR..." : "SINIF EKLE"}
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
