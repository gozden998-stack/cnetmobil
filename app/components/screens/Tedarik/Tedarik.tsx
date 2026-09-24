"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";

type TedarikProps = {
  isAdmin: boolean;
  selectedBranch: string;
};

type SupplyRequestRow = {
  shopName: string;
  quantity: number;
  requestedByName: string;
  updatedAt: string;
};

type SupplyItem = {
  id: number;
  itemName: string;
  itemNote: string;
  requests: SupplyRequestRow[];
};

type SupplyBatch = {
  id: number;
  title: string;
  status: "DRAFT" | "LIVE" | "ENDED" | "CANCELLED";
  durationMinutes: number | null;
  startsAt: string | null;
  endsAt: string | null;
  createdByName: string;
  createdAt: string;
  items: SupplyItem[];
};

const POLL_MS = 4000;

const VODAFONE_SHOPS = ["MEYDAN", "SARAY", "ERNA", "TEKİRA"];

const DURATION_PRESETS = [
  { label: "12 Saat", minutes: 12 * 60 },
  { label: "24 Saat", minutes: 24 * 60 },
  { label: "2 Gün", minutes: 2 * 24 * 60 },
  { label: "3 Gün", minutes: 3 * 24 * 60 },
];

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "TASLAK",
  LIVE: "AÇIK",
  ENDED: "KAPANDI",
  CANCELLED: "İPTAL",
};

const STATUS_TONE: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-600 border-slate-200",
  LIVE: "bg-emerald-50 text-emerald-700 border-emerald-200",
  ENDED: "bg-blue-50 text-blue-700 border-blue-200",
  CANCELLED: "bg-red-50 text-red-700 border-red-200",
};

function formatDate(value: string | null) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString("tr-TR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "-";
  }
}

function BoxIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8M12 13v8" />
    </svg>
  );
}

function PlusIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M12 4v16m8-8H4" />
    </svg>
  );
}

function TrashIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 7h12M9 7V4h6v3m-8 0l1 13a2 2 0 002 2h4a2 2 0 002-2l1-13" />
    </svg>
  );
}

export default function Tedarik({ isAdmin, selectedBranch }: TedarikProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isManager, setIsManager] = useState(isAdmin);
  const [batches, setBatches] = useState<SupplyBatch[]>([]);

  const [createOpen, setCreateOpen] = useState(false);
  const [createTitle, setCreateTitle] = useState("");
  const [createDuration, setCreateDuration] = useState(DURATION_PRESETS[2].minutes);
  const [createItems, setCreateItems] = useState<{ itemName: string; itemNote: string }[]>([
    { itemName: "", itemNote: "" },
  ]);
  const [createSaving, setCreateSaving] = useState(false);
  const [createError, setCreateError] = useState("");

  const [pendingRequest, setPendingRequest] = useState<{ batchId: number; itemId: number } | null>(null);
  const [requestShop, setRequestShop] = useState(VODAFONE_SHOPS[0]);
  const [requestQty, setRequestQty] = useState("1");
  const [requestSaving, setRequestSaving] = useState(false);

  const [actionBusyId, setActionBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/supply", {
        method: "GET",
        cache: "no-store",
        credentials: "same-origin",
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result?.ok) {
        throw new Error(result?.error || "Tedarik verisi alınamadı.");
      }

      setIsManager(Boolean(result.isManager));
      setBatches(Array.isArray(result.batches) ? result.batches : []);
      setError("");
    } catch (err: any) {
      setError(err?.message || "Tedarik verisi alınamadı.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, POLL_MS);
    return () => window.clearInterval(intervalId);
  }, [load]);

  const addCreateItemRow = () => {
    setCreateItems((rows) => [...rows, { itemName: "", itemNote: "" }]);
  };

  const removeCreateItemRow = (index: number) => {
    setCreateItems((rows) => rows.filter((_, i) => i !== index));
  };

  const updateCreateItemRow = (index: number, field: "itemName" | "itemNote", value: string) => {
    setCreateItems((rows) =>
      rows.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    );
  };

  const submitCreate = async () => {
    if (createSaving) return;

    const items = createItems
      .map((item) => ({ itemName: item.itemName.trim(), itemNote: item.itemNote.trim() }))
      .filter((item) => item.itemName);

    if (!createTitle.trim()) {
      setCreateError("Başlık zorunludur.");
      return;
    }

    if (!items.length) {
      setCreateError("En az bir ürün eklemelisiniz.");
      return;
    }

    setCreateSaving(true);
    setCreateError("");

    try {
      const response = await fetch("/api/supply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          title: createTitle.trim(),
          durationMinutes: createDuration,
          items,
        }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result?.ok) {
        throw new Error(result?.error || "Tedarik dönemi oluşturulamadı.");
      }

      setCreateOpen(false);
      setCreateTitle("");
      setCreateItems([{ itemName: "", itemNote: "" }]);
      setCreateDuration(DURATION_PRESETS[2].minutes);
      void load();
    } catch (err: any) {
      setCreateError(err?.message || "Tedarik dönemi oluşturulamadı.");
    } finally {
      setCreateSaving(false);
    }
  };

  const runBatchAction = async (batchId: number, action: "START" | "END" | "CANCEL") => {
    if (actionBusyId) return;
    setActionBusyId(batchId);

    try {
      const response = await fetch(`/api/supply/${batchId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ action }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result?.ok) {
        throw new Error(result?.error || "İşlem başarısız.");
      }

      void load();
    } catch (err: any) {
      setError(err?.message || "İşlem başarısız.");
    } finally {
      setActionBusyId(null);
    }
  };

  const deleteBatch = async (batchId: number) => {
    if (actionBusyId) return;
    setActionBusyId(batchId);

    try {
      const response = await fetch(`/api/supply/${batchId}`, {
        method: "DELETE",
        credentials: "same-origin",
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result?.ok) {
        throw new Error(result?.error || "Silinemedi.");
      }

      void load();
    } catch (err: any) {
      setError(err?.message || "Silinemedi.");
    } finally {
      setActionBusyId(null);
    }
  };

  const submitRequest = async () => {
    if (!pendingRequest || requestSaving) return;

    const quantity = Number(requestQty);

    if (!Number.isInteger(quantity) || quantity < 1) {
      return;
    }

    setRequestSaving(true);

    try {
      const response = await fetch(
        `/api/supply/${pendingRequest.batchId}/request`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({
            itemId: pendingRequest.itemId,
            shopName: requestShop,
            quantity,
          }),
        }
      );

      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result?.ok) {
        throw new Error(result?.error || "Talep gönderilemedi.");
      }

      setPendingRequest(null);
      setRequestQty("1");
      void load();
    } catch (err: any) {
      setError(err?.message || "Talep gönderilemedi.");
    } finally {
      setRequestSaving(false);
    }
  };

  const downloadExcel = (batch: SupplyBatch) => {
    const rows: Record<string, unknown>[] = [];

    for (const item of batch.items) {
      if (!item.requests.length) {
        rows.push({
          URUN: item.itemName,
          NOT: item.itemNote,
          MAGAZA: "-",
          ADET: 0,
          TALEP_EDEN: "",
        });
        continue;
      }

      for (const req of item.requests) {
        rows.push({
          URUN: item.itemName,
          NOT: item.itemNote,
          MAGAZA: req.shopName,
          ADET: req.quantity,
          TALEP_EDEN: req.requestedByName,
        });
      }
    }

    const worksheet = XLSX.utils.json_to_sheet(rows, {
      header: ["URUN", "NOT", "MAGAZA", "ADET", "TALEP_EDEN"],
    });

    worksheet["!cols"] = [
      { wch: 34 },
      { wch: 24 },
      { wch: 14 },
      { wch: 10 },
      { wch: 22 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Tedarik");

    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Istanbul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());

    XLSX.writeFile(
      workbook,
      `${batch.title.replace(/[^a-zA-Z0-9ığüşöçİĞÜŞÖÇ]+/g, "_")}_${today}.xlsx`
    );
  };

  const liveBatches = useMemo(
    () => batches.filter((b) => b.status === "LIVE"),
    [batches]
  );

  const otherBatches = useMemo(
    () => batches.filter((b) => b.status !== "LIVE"),
    [batches]
  );

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-sm font-bold text-slate-400">
        Yükleniyor...
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1400px] animate-in fade-in space-y-5 duration-500">
      <section className="overflow-hidden rounded-[28px] border border-blue-100 bg-gradient-to-r from-white via-white to-blue-50/70 p-5 shadow-sm sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 ring-1 ring-blue-100">
              <BoxIcon className="h-7 w-7" />
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600">
                CNETMOBİL V2
              </div>
              <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
                MAĞAZA TEDARİK
              </h2>
              <p className="mt-1 text-xs font-semibold text-slate-500">
                {isManager
                  ? "Sarf malzeme taleplerini açın, süre belirleyin, gelen talepleri toplayın."
                  : "Açık tedarik dönemlerinden mağazanız için ihtiyaç talebi girin."}
              </p>
            </div>
          </div>

          {isManager && (
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 text-[11px] font-black uppercase tracking-wide text-white shadow-lg shadow-blue-950/10 transition hover:bg-blue-500"
            >
              <PlusIcon />
              Yeni Tedarik Dönemi
            </button>
          )}
        </div>
      </section>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-bold text-red-600">
          {error}
        </div>
      )}

      {liveBatches.length > 0 && (
        <section className="space-y-4">
          <h3 className="text-[11px] font-black uppercase tracking-widest text-emerald-600">
            Açık Tedarik Dönemleri
          </h3>

          {liveBatches.map((batch) => (
            <div
              key={batch.id}
              className="rounded-[24px] border border-emerald-100 bg-white p-5 shadow-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-lg font-black text-slate-900">{batch.title}</h4>
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wide ${STATUS_TONE[batch.status]}`}
                    >
                      {STATUS_LABEL[batch.status]}
                    </span>
                  </div>
                  <p className="mt-1 text-[10px] font-bold text-slate-400">
                    Bitiş: {formatDate(batch.endsAt)} · Açan: {batch.createdByName || "-"}
                  </p>
                </div>

                {isManager && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => downloadExcel(batch)}
                      className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[9px] font-black uppercase tracking-wide text-emerald-700 transition hover:bg-emerald-100"
                    >
                      Excel İndir
                    </button>
                    <button
                      type="button"
                      disabled={actionBusyId === batch.id}
                      onClick={() => runBatchAction(batch.id, "END")}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[9px] font-black uppercase tracking-wide text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                    >
                      Şimdi Kapat
                    </button>
                  </div>
                )}
              </div>

              <div className="mt-4 space-y-2">
                {batch.items.map((item) => {
                  const totalQty = item.requests.reduce((sum, r) => sum + r.quantity, 0);
                  const isPending =
                    pendingRequest?.batchId === batch.id && pendingRequest?.itemId === item.id;

                  return (
                    <div
                      key={item.id}
                      className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-black text-slate-900">{item.itemName}</div>
                          {item.itemNote && (
                            <div className="mt-0.5 text-[10px] font-semibold text-slate-400">
                              {item.itemNote}
                            </div>
                          )}
                        </div>

                        {isManager ? (
                          <div className="flex flex-wrap items-center gap-1.5">
                            {item.requests.length === 0 && (
                              <span className="text-[10px] font-bold text-slate-400">
                                Henüz talep yok
                              </span>
                            )}
                            {item.requests.map((req) => (
                              <span
                                key={req.shopName}
                                className="rounded-lg border border-blue-100 bg-white px-2.5 py-1 text-[10px] font-black text-blue-700"
                              >
                                {req.shopName}: {req.quantity}
                              </span>
                            ))}
                            {item.requests.length > 0 && (
                              <span className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-black text-emerald-700">
                                Toplam: {totalQty}
                              </span>
                            )}
                          </div>
                        ) : !isPending ? (
                          <button
                            type="button"
                            onClick={() => {
                              setPendingRequest({ batchId: batch.id, itemId: item.id });
                              setRequestQty("1");
                              setRequestShop(VODAFONE_SHOPS[0]);
                            }}
                            className="rounded-xl bg-blue-600 px-4 py-2 text-[10px] font-black uppercase tracking-wide text-white transition hover:bg-blue-500"
                          >
                            Talep Ol
                          </button>
                        ) : (
                          <div className="flex flex-wrap items-center gap-2">
                            <select
                              value={requestShop}
                              onChange={(e) => setRequestShop(e.target.value)}
                              className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-bold text-slate-700"
                            >
                              {VODAFONE_SHOPS.map((shop) => (
                                <option key={shop} value={shop}>
                                  {shop}
                                </option>
                              ))}
                            </select>
                            <input
                              type="number"
                              min={1}
                              value={requestQty}
                              onChange={(e) => setRequestQty(e.target.value)}
                              className="h-9 w-20 rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-bold text-slate-700"
                            />
                            <button
                              type="button"
                              disabled={requestSaving}
                              onClick={submitRequest}
                              className="rounded-lg bg-emerald-600 px-3 py-2 text-[10px] font-black uppercase text-white transition hover:bg-emerald-500 disabled:opacity-50"
                            >
                              Onayla
                            </button>
                            <button
                              type="button"
                              onClick={() => setPendingRequest(null)}
                              className="rounded-lg bg-slate-200 px-3 py-2 text-[10px] font-black uppercase text-slate-600 transition hover:bg-slate-300"
                            >
                              Vazgeç
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </section>
      )}

      {liveBatches.length === 0 && (
        <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-6 py-14 text-center">
          <div className="text-sm font-black uppercase tracking-widest text-slate-400">
            Şu an açık tedarik dönemi yok
          </div>
        </div>
      )}

      {isManager && otherBatches.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-400">
            Geçmiş / Taslak Dönemler
          </h3>

          {otherBatches.map((batch) => (
            <div
              key={batch.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white px-5 py-4"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-black text-slate-800">{batch.title}</span>
                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wide ${STATUS_TONE[batch.status]}`}
                  >
                    {STATUS_LABEL[batch.status]}
                  </span>
                </div>
                <p className="mt-1 text-[10px] font-bold text-slate-400">
                  {batch.items.length} ürün · Oluşturuldu: {formatDate(batch.createdAt)}
                </p>
              </div>

              <div className="flex items-center gap-2">
                {batch.status === "ENDED" && (
                  <button
                    type="button"
                    onClick={() => downloadExcel(batch)}
                    className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[9px] font-black uppercase tracking-wide text-emerald-700 transition hover:bg-emerald-100"
                  >
                    Excel İndir
                  </button>
                )}

                {batch.status === "DRAFT" && (
                  <button
                    type="button"
                    disabled={actionBusyId === batch.id}
                    onClick={() => runBatchAction(batch.id, "START")}
                    className="rounded-xl bg-emerald-600 px-3 py-2 text-[9px] font-black uppercase tracking-wide text-white transition hover:bg-emerald-500 disabled:opacity-50"
                  >
                    Başlat
                  </button>
                )}

                {(batch.status === "DRAFT" || batch.status === "LIVE") && (
                  <button
                    type="button"
                    disabled={actionBusyId === batch.id}
                    onClick={() => runBatchAction(batch.id, "CANCEL")}
                    className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[9px] font-black uppercase tracking-wide text-red-600 transition hover:bg-red-100 disabled:opacity-50"
                  >
                    İptal Et
                  </button>
                )}

                {["DRAFT", "ENDED", "CANCELLED"].includes(batch.status) && (
                  <button
                    type="button"
                    disabled={actionBusyId === batch.id}
                    onClick={() => deleteBatch(batch.id)}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400 transition hover:border-red-200 hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
                  >
                    <TrashIcon />
                  </button>
                )}
              </div>
            </div>
          ))}
        </section>
      )}

      {createOpen && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-slate-900/80 p-4 backdrop-blur-md">
          <div className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-[32px] border border-slate-100 bg-white shadow-2xl">
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-5">
              <h3 className="text-lg font-black uppercase tracking-tight text-slate-900">
                Yeni Tedarik Dönemi
              </h3>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-400 transition hover:bg-red-50 hover:text-red-500"
              >
                ×
              </button>
            </div>

            <div className="overflow-y-auto px-6 py-5 space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                  Başlık
                </label>
                <input
                  value={createTitle}
                  onChange={(e) => setCreateTitle(e.target.value)}
                  placeholder="Örn: Eylül Temizlik Malzemesi Talebi"
                  className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-800 outline-none focus:border-blue-400"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                  Süre
                </label>
                <div className="mt-1 flex flex-wrap gap-2">
                  {DURATION_PRESETS.map((preset) => (
                    <button
                      key={preset.minutes}
                      type="button"
                      onClick={() => setCreateDuration(preset.minutes)}
                      className={`rounded-xl border px-3 py-2 text-[11px] font-black uppercase transition ${
                        createDuration === preset.minutes
                          ? "border-blue-500 bg-blue-50 text-blue-700"
                          : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                    Ürünler
                  </label>
                  <button
                    type="button"
                    onClick={addCreateItemRow}
                    className="flex items-center gap-1 text-[10px] font-black uppercase text-blue-600 hover:text-blue-500"
                  >
                    <PlusIcon className="h-3.5 w-3.5" /> Ürün Ekle
                  </button>
                </div>

                <div className="mt-2 space-y-2">
                  {createItems.map((item, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <input
                        value={item.itemName}
                        onChange={(e) => updateCreateItemRow(index, "itemName", e.target.value)}
                        placeholder="Ürün adı (örn: Peçete)"
                        className="h-10 flex-1 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-800 outline-none focus:border-blue-400"
                      />
                      <input
                        value={item.itemNote}
                        onChange={(e) => updateCreateItemRow(index, "itemNote", e.target.value)}
                        placeholder="Not (opsiyonel)"
                        className="h-10 w-40 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-800 outline-none focus:border-blue-400"
                      />
                      {createItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeCreateItemRow(index)}
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition hover:border-red-200 hover:bg-red-50 hover:text-red-500"
                        >
                          <TrashIcon className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {createError && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-600">
                  {createError}
                </div>
              )}
            </div>

            <div className="shrink-0 border-t border-slate-100 px-6 py-4">
              <button
                type="button"
                disabled={createSaving}
                onClick={submitCreate}
                className="h-12 w-full rounded-2xl bg-blue-600 text-xs font-black uppercase tracking-widest text-white transition hover:bg-blue-500 disabled:opacity-50"
              >
                {createSaving ? "Oluşturuluyor..." : "Taslak Olarak Oluştur"}
              </button>
              <p className="mt-2 text-center text-[10px] font-semibold text-slate-400">
                Oluşturduktan sonra listeden "Başlat" ile talebe açarsın.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
