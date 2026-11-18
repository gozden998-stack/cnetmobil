"use client";

// CNETMOBIL - Garantili: Merkez (CNET) IMEI'li cihazı Garantili'ye aç (cihaz ekle + ilana aç)
// Marka/model/hafıza/renk Garantili id'leriyle eşleşir (otomatik öneri, elle düzeltilebilir). Kutu ve minimum fiyat
// cihaz başına seçilir. Her açma tek cihaz, onay kutusuyla.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Row = Record<string, any>;
type Item = { id: number; name: string; brandId: number | null };
type Draft = { markaId: number | null; modelId: number | null; hafizaId: number | null; renkId: number | null; kutu: 1 | 2 | 0; fiyat: string };

const PAGE = 50;

const STATUS_LABEL: Record<string, { text: string; cls: string }> = {
  OPEN: { text: "Garantili'de açık", cls: "bg-emerald-50 text-emerald-700" },
  OPENING: { text: "Açılıyor...", cls: "bg-amber-50 text-amber-700" },
  FAILED: { text: "Başarısız", cls: "bg-rose-50 text-rose-700" },
  REMOVE_REQUESTED: { text: "Kaldırma istendi", cls: "bg-amber-50 text-amber-700" },
  CLOSED: { text: "Kapalı", cls: "bg-slate-100 text-slate-600" },
  SOLD: { text: "Satıldı", cls: "bg-slate-100 text-slate-600" },
};

function Select({ value, onChange, items, placeholder, disabled }: { value: number | null; onChange: (id: number | null) => void; items: Item[]; placeholder: string; disabled?: boolean }) {
  return (
    <select
      value={value ?? ""}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value ? Number(event.target.value) : null)}
      className={`h-10 w-full rounded-lg border px-2 text-[13px] font-semibold outline-none focus:border-violet-400 ${value ? "border-slate-200 text-slate-800" : "border-amber-300 bg-amber-50 text-amber-800"}`}
    >
      <option value="">{placeholder}</option>
      {items.map((item) => (
        <option key={item.id} value={item.id}>
          {item.name}
        </option>
      ))}
    </select>
  );
}

export default function GarantiliOpen() {
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<Row>({});
  const [catalog, setCatalog] = useState<{ brands: Item[]; models: Item[]; memories: Item[]; colors: Item[] } | null>(null);
  const [catalogNote, setCatalogNote] = useState("");
  const [durum, setDurum] = useState("openable");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [openImei, setOpenImei] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const requestId = useRef(0);
  const lastSearch = useRef("");

  const load = useCallback(async (pageNumber: number, q: string, status: string) => {
    const id = ++requestId.current;

    setBusy(true);
    setError("");

    try {
      const query = new URLSearchParams({ q: q.trim(), durum: status, offset: String((pageNumber - 1) * PAGE), limit: String(PAGE) });
      const response = await fetch(`/api/online/garantili/candidates?${query.toString()}`, { cache: "no-store", credentials: "same-origin" });
      const payload = await response.json().catch(() => null);

      if (id !== requestId.current) return;

      if (!payload?.success) throw new Error(payload?.error || `HTTP ${response.status}`);

      setRows(Array.isArray(payload.rows) ? payload.rows : []);
      setTotal(Number(payload.totalCount ?? 0));
      setCounts(payload.counts ?? {});

      if (payload.catalogError) setCatalogNote(`Garantili kataloğu okunamadı: ${payload.catalogError}`);
      else if (payload.catalogDiagnostics && payload.catalogDiagnostics.counts?.models === 0) {
        setCatalogNote(`Katalogda model bulunamadı (alanlar: ${(payload.catalogDiagnostics.topKeys || []).join(", ")}). Bağlantı sekmesindeki Katalog kartına bakın.`);
      } else setCatalogNote("");
    } catch (e: any) {
      if (id !== requestId.current) return;

      setRows([]);
      setError(e?.message || "Liste alınamadı.");
    } finally {
      if (id === requestId.current) setBusy(false);
    }
  }, []);

  useEffect(() => {
    const searchChanged = lastSearch.current !== search;

    lastSearch.current = search;

    const timer = setTimeout(() => void load(page, search, durum), searchChanged ? 400 : 0);

    return () => clearTimeout(timer);
  }, [page, search, durum, load]);

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/online/garantili/catalog", { cache: "no-store", credentials: "same-origin" });
        const payload = await response.json().catch(() => null);

        if (payload?.success) setCatalog({ brands: payload.brands, models: payload.models, memories: payload.memories, colors: payload.colors });
      } catch {
        // katalog alınamazsa seçim kutuları boş kalır; liste yine görünür
      }
    })();
  }, []);

  const draftOf = (row: Row): Draft =>
    drafts[row.imei] ?? {
      markaId: row.markaId ?? null,
      modelId: row.modelId ?? null,
      hafizaId: row.hafizaId ?? null,
      renkId: row.renkId ?? null,
      kutu: 0,
      fiyat: row.suggestedPrice ? String(Math.round(row.suggestedPrice)) : "",
    };

  const patchDraft = (row: Row, patch: Partial<Draft>) => setDrafts((current) => ({ ...current, [row.imei]: { ...draftOf(row), ...patch } }));

  const modelsFor = (markaId: number | null) => (catalog?.models ?? []).filter((item) => markaId === null || item.brandId === null || item.brandId === markaId);
  const nameOf = (list: Item[] | undefined, id: number | null) => list?.find((item) => item.id === id)?.name ?? "-";

  const submit = async (row: Row) => {
    const draft = draftOf(row);
    const price = Number(draft.fiyat.replace(/\./g, "").replace(",", "."));

    if (!draft.markaId || !draft.modelId || !draft.hafizaId || !draft.renkId) return setMessage("Marka, model, hafıza ve renk seçilmeli.");
    if (!draft.kutu) return setMessage("Kutu seçilmeli (turuncu veya gri).");
    if (!Number.isFinite(price) || price <= 0) return setMessage("Minimum satış fiyatı girilmeli.");

    const summary = `${nameOf(catalog?.brands, draft.markaId)} ${nameOf(catalog?.models, draft.modelId)} ${nameOf(catalog?.memories, draft.hafizaId)} ${nameOf(catalog?.colors, draft.renkId)}`;

    if (
      !window.confirm(
        `IMEI ${row.imei}\n${summary}\nKutu: ${draft.kutu === 1 ? "Turuncu" : "Gri"}\nMinimum satış fiyatı: ${price.toLocaleString("tr-TR")} ₺\n\nGarantili'ye EKLENİP İLANA AÇILACAK. Onaylıyor musun?`
      )
    ) {
      return;
    }

    setSending(true);
    setMessage("");

    try {
      const response = await fetch("/api/online/garantili/open", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imei: row.imei, markaId: draft.markaId, modelId: draft.modelId, hafizaId: draft.hafizaId, renkId: draft.renkId, onKutulama: draft.kutu, minFiyat: price }),
      });
      const payload = await response.json().catch(() => null);

      if (!payload?.success) throw new Error(payload?.error || `HTTP ${response.status}`);

      setMessage(`${row.imei}: ${payload.message || "Garantili'ye eklendi ve ilana açıldı."}`);
      setOpenImei(null);
      await load(page, search, durum);
    } catch (e: any) {
      setMessage(`${row.imei}: ${e?.message || "Açılamadı."}`);
    } finally {
      setSending(false);
    }
  };

  const lastPage = Math.max(1, Math.ceil(total / PAGE));
  const filterButtons = useMemo(
    () => [
      { value: "openable", label: `Açılabilir (${counts.openable ?? 0})` },
      { value: "opened", label: `Garantili'de (${counts.opened ?? 0})` },
      { value: "any", label: `Tümü (${counts.all ?? 0})` },
    ],
    [counts]
  );

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 rounded-xl border border-violet-100 bg-violet-50 p-3 text-[13px] font-semibold text-violet-900">
        Merkez (CNET) stoğundaki IMEI'li cihazlar. Her cihaz tek tek, onayınla Garantili'ye eklenir ve ilana açılır. WingSM'e hiçbir şey yazılmaz.
      </div>

      {catalogNote && <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[13px] font-bold text-amber-800">{catalogNote}</div>}
      {message && <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-[13px] font-bold text-slate-700">{message}</div>}

      <div className="mb-3 flex flex-wrap gap-2">
        {filterButtons.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => {
              setDurum(option.value);
              setPage(1);
            }}
            className={`rounded-full px-4 py-1.5 text-[13px] font-black transition ${durum === option.value ? "bg-violet-600 text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-3">
        <input
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          placeholder="Model, renk, IMEI ara"
          className="h-11 w-full max-w-sm rounded-xl border border-slate-200 px-4 text-[14px] font-semibold text-slate-800 outline-none focus:border-violet-400"
        />
        <div className="text-[13px] font-bold text-slate-500">{busy ? "Yükleniyor..." : `${total} cihaz`}</div>
      </div>

      {error && <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-[13px] font-bold text-rose-700">{error}</div>}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-left">
          <thead>
            <tr className="border-b border-slate-200 text-[12px] font-black uppercase text-slate-500">
              <th className="px-3 py-2">IMEI</th>
              <th className="px-3 py-2">Cihaz</th>
              <th className="px-3 py-2">Grade</th>
              <th className="px-3 py-2">Batarya</th>
              <th className="px-3 py-2">Eşleşme</th>
              <th className="px-3 py-2">Durum</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 && !busy && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-[13px] font-semibold text-slate-400">
                  Cihaz yok.
                </td>
              </tr>
            )}
            {rows.map((row) => {
              const draft = draftOf(row);
              const matched = Boolean(row.markaId && row.modelId && row.hafizaId && row.renkId);
              const status = row.garantiliStatus ? STATUS_LABEL[row.garantiliStatus] : null;
              const expanded = openImei === row.imei;

              return (
                <React.Fragment key={row.imei}>
                  <tr className="text-[13px] text-slate-800">
                    <td className="whitespace-nowrap px-3 py-2 font-bold">{row.imei}</td>
                    <td className="px-3 py-2 font-semibold">
                      {row.brand} {row.model} {row.memory} {row.color}
                    </td>
                    <td className="px-3 py-2 font-semibold">{row.grade || "-"}</td>
                    <td className="px-3 py-2 font-semibold">{row.battery !== null && row.battery !== undefined ? `%${row.battery}` : "-"}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded-full px-3 py-1 text-[12px] font-black ${matched ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                        {matched ? (row.suggestedFrom === "saved" ? "Kayıtlı" : "Otomatik") : "Elle seçilmeli"}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {status ? (
                        <span className={`rounded-full px-3 py-1 text-[12px] font-black ${status.cls}`} title={row.garantiliError || undefined}>
                          {status.text}
                        </span>
                      ) : (
                        <span className="text-[12px] font-semibold text-slate-400">Açılmadı</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {!row.isOpen && (
                        <button
                          type="button"
                          onClick={() => setOpenImei(expanded ? null : row.imei)}
                          className="rounded-lg bg-violet-600 px-4 py-1.5 text-[12px] font-black text-white hover:bg-violet-700"
                        >
                          {expanded ? "Kapat" : "Garantili'ye aç"}
                        </button>
                      )}
                    </td>
                  </tr>
                  {expanded && (
                    <tr>
                      <td colSpan={7} className="bg-slate-50 px-3 py-3">
                        <div className="grid gap-3 md:grid-cols-4">
                          <Select
                            value={draft.markaId}
                            onChange={(id) => patchDraft(row, { markaId: id, modelId: null })}
                            items={catalog?.brands ?? []}
                            placeholder="Marka seç"
                          />
                          <Select value={draft.modelId} onChange={(id) => patchDraft(row, { modelId: id })} items={modelsFor(draft.markaId)} placeholder="Model seç" />
                          <Select value={draft.hafizaId} onChange={(id) => patchDraft(row, { hafizaId: id })} items={catalog?.memories ?? []} placeholder="Hafıza seç" />
                          <Select value={draft.renkId} onChange={(id) => patchDraft(row, { renkId: id })} items={catalog?.colors ?? []} placeholder="Renk seç" />
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-4">
                          <div className="flex items-center gap-2 text-[13px] font-bold text-slate-700">
                            Kutu:
                            {([1, 2] as const).map((value) => (
                              <button
                                key={value}
                                type="button"
                                onClick={() => patchDraft(row, { kutu: value })}
                                className={`rounded-full px-4 py-1.5 text-[13px] font-black ${draft.kutu === value ? (value === 1 ? "bg-orange-500 text-white" : "bg-slate-600 text-white") : "border border-slate-200 bg-white text-slate-600"}`}
                              >
                                {value === 1 ? "Turuncu" : "Gri"}
                              </button>
                            ))}
                          </div>
                          <label className="flex items-center gap-2 text-[13px] font-bold text-slate-700">
                            Minimum satış fiyatı (₺):
                            <input
                              value={draft.fiyat}
                              onChange={(event) => patchDraft(row, { fiyat: event.target.value.replace(/[^\d.,]/g, "") })}
                              inputMode="numeric"
                              placeholder={row.suggestedPrice ? String(Math.round(row.suggestedPrice)) : "örn. 56500"}
                              className="h-10 w-36 rounded-lg border border-slate-200 px-3 text-[13px] font-semibold outline-none focus:border-violet-400"
                            />
                          </label>
                          {row.suggestedPrice ? <span className="text-[12px] font-semibold text-slate-500">Öneri: diğer kanaldaki fiyat {Math.round(row.suggestedPrice).toLocaleString("tr-TR")} ₺</span> : null}
                          <button
                            type="button"
                            disabled={sending}
                            onClick={() => void submit(row)}
                            className="ml-auto rounded-xl bg-emerald-600 px-6 py-2 text-[13px] font-black text-white hover:bg-emerald-700 disabled:opacity-50"
                          >
                            {sending ? "Gönderiliyor..." : "Ekle ve ilana aç"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <button
          type="button"
          disabled={page <= 1 || busy}
          onClick={() => setPage((value) => Math.max(1, value - 1))}
          className="rounded-xl border border-slate-200 px-4 py-2 text-[13px] font-black text-slate-700 hover:bg-slate-50 disabled:opacity-40"
        >
          Önceki
        </button>
        <div className="text-[13px] font-bold text-slate-500">
          Sayfa {page} / {lastPage}
        </div>
        <button
          type="button"
          disabled={busy || page >= lastPage}
          onClick={() => setPage((value) => value + 1)}
          className="rounded-xl border border-slate-200 px-4 py-2 text-[13px] font-black text-slate-700 hover:bg-slate-50 disabled:opacity-40"
        >
          Sonraki
        </button>
      </div>
    </div>
  );
}
