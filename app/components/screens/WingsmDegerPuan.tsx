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

type NewBracketDraft = {
  profit_min: string;
  profit_max: string;
  score: string;
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

  const [newBracketDrafts, setNewBracketDrafts] = useState<Record<string, NewBracketDraft>>({});
  const [newBracketState, setNewBracketState] = useState<Record<string, RowState>>({});

  const [newClassDraft, setNewClassDraft] = useState<NewClassDraft>(EMPTY_NEW_CLASS);
  const [newClassState, setNewClassState] = useState<RowState>({ loading: false, error: "", success: "" });

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
  // GRUPLAMA (sınıf bazlı)
  // ==================================================

  const groups = useMemo(() => {
    const visible = showInactive ? rules : rules.filter((r) => r.active);

    const map = new Map<string, { label: string; rows: ScoreRule[] }>();

    for (const rule of visible) {
      const existing = map.get(rule.class_code);
      if (existing) {
        existing.rows.push(rule);
      } else {
        map.set(rule.class_code, { label: rule.class_label, rows: [rule] });
      }
    }

    for (const group of map.values()) {
      group.rows.sort((a, b) => Number(a.profit_min) - Number(b.profit_min));
    }

    return Array.from(map.entries())
      .map(([classCode, group]) => ({ classCode, ...group }))
      .sort((a, b) => a.classCode.localeCompare(b.classCode, "tr"));
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
  // MEVCUT SINIFA YENİ ARALIK EKLE
  // ==================================================

  const getNewBracketDraft = (classCode: string): NewBracketDraft =>
    newBracketDrafts[classCode] || { profit_min: "", profit_max: "", score: "" };

  const updateNewBracketDraft = (classCode: string, field: keyof NewBracketDraft, value: string) => {
    setNewBracketDrafts((current) => ({
      ...current,
      [classCode]: { ...getNewBracketDraft(classCode), [field]: value },
    }));
  };

  const addBracket = async (classCode: string, classLabel: string) => {
    const draft = getNewBracketDraft(classCode);

    setNewBracketState((current) => ({
      ...current,
      [classCode]: { loading: true, error: "", success: "" },
    }));

    try {
      const res = await fetch("/api/wingsm/score-rules", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          class_code: classCode,
          class_label: classLabel,
          profit_min: draft.profit_min,
          profit_max: draft.profit_max,
          score: draft.score,
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
      setNewBracketDrafts((current) => ({ ...current, [classCode]: { profit_min: "", profit_max: "", score: "" } }));
      setNewBracketState((current) => ({
        ...current,
        [classCode]: { loading: false, error: "", success: "Aralık eklendi." },
      }));

      window.setTimeout(
        () =>
          setNewBracketState((current) => ({
            ...current,
            [classCode]: { ...current[classCode], success: "" },
          })),
        2500
      );
    } catch (err) {
      setNewBracketState((current) => ({
        ...current,
        [classCode]: {
          loading: false,
          error: err instanceof Error ? err.message : "Aralık eklenemedi.",
          success: "",
        },
      }));
    }
  };

  // ==================================================
  // YENİ SINIF EKLE
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
      <div className="mb-6 flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black">Değer Puan Kuralları</h1>
          <p className="mt-1 text-sm text-slate-500">
            Sınıf (Mal Sınıfı) ve kâr aralığına göre Değer Puan kuralları. Bu tablo, PersonelGidisat /
            MagazaGidisat&apos;taki &quot;DEĞER PUAN&quot; toplamlarını besleyen kaynak veridir — burada
            yaptığın değişiklik canlıdır.
          </p>
        </div>

        <label className="flex items-center gap-2 text-xs font-bold text-slate-500">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
          />
          Pasif kuralları da göster
        </label>
      </div>

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
          {groups.map((group) => {
            const draft = getNewBracketDraft(group.classCode);
            const state = newBracketState[group.classCode] || { loading: false, error: "", success: "" };

            return (
              <section key={group.classCode} className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                      Sınıf Kodu: {group.classCode}
                    </div>
                    <div className="text-lg font-black">{group.label}</div>
                  </div>
                  <div className="text-xs font-bold text-slate-400">{group.rows.length} aralık</div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-left">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-[8px] font-black uppercase tracking-wide text-slate-500">
                        <th className="px-4 py-3">Kâr Alt Sınır</th>
                        <th className="px-4 py-3">Kâr Üst Sınır</th>
                        <th className="px-4 py-3">Puan</th>
                        <th className="px-4 py-3">Durum</th>
                        <th className="px-4 py-3">İşlemler</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {group.rows.map((rule) => {
                        const rowDraft = drafts[rule.id] || ruleToDraft(rule);
                        const rs = rowState[rule.id] || { loading: false, error: "", success: "" };

                        return (
                          <tr key={rule.id} className={rule.active ? "" : "opacity-60"}>
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

                <div className="border-t border-slate-100 bg-slate-50/60 px-5 py-4">
                  <div className="mb-2 text-[9px] font-black uppercase tracking-wide text-slate-400">
                    {group.label} için yeni aralık ekle
                  </div>
                  <div className="flex flex-wrap items-end gap-2">
                    <label>
                      <div className="mb-1 text-[9px] font-bold text-slate-400">Alt Sınır</div>
                      <input
                        value={draft.profit_min}
                        onChange={(e) => updateNewBracketDraft(group.classCode, "profit_min", e.target.value)}
                        placeholder="ör. 12000.01"
                        className="h-9 w-32 rounded-lg border border-slate-200 px-2.5 text-[11px] font-semibold outline-none focus:border-blue-400"
                      />
                    </label>
                    <label>
                      <div className="mb-1 text-[9px] font-bold text-slate-400">Üst Sınır</div>
                      <input
                        value={draft.profit_max}
                        onChange={(e) => updateNewBracketDraft(group.classCode, "profit_max", e.target.value)}
                        placeholder="ör. 999999999"
                        className="h-9 w-32 rounded-lg border border-slate-200 px-2.5 text-[11px] font-semibold outline-none focus:border-blue-400"
                      />
                    </label>
                    <label>
                      <div className="mb-1 text-[9px] font-bold text-slate-400">Puan</div>
                      <input
                        value={draft.score}
                        onChange={(e) => updateNewBracketDraft(group.classCode, "score", e.target.value)}
                        placeholder="ör. 40"
                        className="h-9 w-24 rounded-lg border border-slate-200 px-2.5 text-[11px] font-semibold outline-none focus:border-blue-400"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => addBracket(group.classCode, group.label)}
                      disabled={state.loading}
                      className="h-9 whitespace-nowrap rounded-lg bg-slate-800 px-4 text-[9px] font-black uppercase text-white shadow-sm transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {state.loading ? "EKLENİYOR..." : "ARALIK EKLE"}
                    </button>
                  </div>
                  {state.error && (
                    <div className="mt-2 text-[9px] font-bold text-rose-600">{state.error}</div>
                  )}
                  {state.success && (
                    <div className="mt-2 text-[9px] font-bold text-emerald-600">{state.success}</div>
                  )}
                </div>
              </section>
            );
          })}

          {groups.length === 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm font-bold text-slate-400">
              Henüz kural yok.
            </div>
          )}

          <section className="rounded-2xl border border-dashed border-blue-300 bg-blue-50/40 p-5">
            <h2 className="text-sm font-black text-blue-800">Yeni Sınıf Ekle</h2>
            <p className="mt-1 text-xs font-semibold text-blue-600">
              Yeni bir Mal Sınıfı için ilk aralığı burada oluştur. Ek aralıkları, sınıf oluştuktan sonra
              yukarıdaki kart içinden ekleyebilirsin.
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
    </div>
  );
}
