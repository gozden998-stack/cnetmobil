"use client";

import React, { useEffect, useRef, useState } from "react";

// ======================================================
// Bu ekran, Dis Kanal (Zumay) ve Cihaz Alim ekranlarindan
// olusturulan tum musteri odeme taleplerini TEK bir yerden
// takip etmek icin ayri bir sayfa olarak cikarildi. Veri
// kaynagi ayni: /api/external-purchase (external_purchase_
// requests tablosu). Is mantigina hicbir dokunus yok, sadece
// Dis Kanal icindeki modal buradan bagimsiz bir ekrana tasindi.
// ======================================================

type ExternalPurchaseRequest = {
  id: number;
  requestNo: string;
  branch: string;
  sourceUserEmail?: string;
  deviceName: string;
  imei: string;
  amount: number;
  customer: {
    firstName: string;
    lastName: string;
    tc: string;
    phone: string;
    iban: string;
    ibanHolder: string;
  };
  status: "PAYMENT_PENDING" | "PAID" | "CANCELLED";
  hasReceipt: boolean;
  createdAt: string;
  updatedAt: string;
  paidAt?: string | null;
  cancelledAt?: string | null;
};

type RequestSummary = {
  total: number;
  pending: number;
  paid: number;
  pendingAmount: number;
  paidAmount: number;
};

function formatTry(value: unknown) {
  const number = Number(value || 0);

  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 2,
  }).format(Number.isFinite(number) ? number : 0);
}

function formatDateTime(value: unknown) {
  const text = String(value ?? "").trim();
  if (!text) return "-";

  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return text;

  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function prettyIban(value: string) {
  return String(value || "").replace(/(.{4})/g, "$1 ").trim();
}

function maskTc(value: string) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length !== 11) return value || "-";
  return `${digits.slice(0, 3)}*****${digits.slice(-3)}`;
}

function statusInfo(status: ExternalPurchaseRequest["status"]) {
  if (status === "PAID") {
    return {
      label: "ÖDEME YAPILDI",
      dot: "bg-emerald-500",
      badge: "border-emerald-200 bg-emerald-50 text-emerald-700",
      panel: "border-emerald-200 bg-emerald-50/60",
    };
  }

  if (status === "CANCELLED") {
    return {
      label: "İPTAL EDİLDİ",
      dot: "bg-rose-500",
      badge: "border-rose-200 bg-rose-50 text-rose-700",
      panel: "border-rose-200 bg-rose-50/60",
    };
  }

  return {
    label: "ÖDEME SIRAYA ALINDI",
    dot: "bg-amber-500",
    badge: "border-amber-200 bg-amber-50 text-amber-700",
    panel: "border-amber-200 bg-amber-50/60",
  };
}

function ReceiptIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12h6m-6 4h6M8 3h8a2 2 0 012 2v16l-3-2-3 2-3-2-3 2V5a2 2 0 012-2z"
      />
    </svg>
  );
}

function UploadIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M12 4v12m0-12l-4 4m4-4l4 4"
      />
    </svg>
  );
}

export default function OdemeTalepleri({
  isZumay = false,
}: {
  isZumay?: boolean;
}) {
  const receiptInputRef = useRef<HTMLInputElement | null>(null);

  const [requestsLoading, setRequestsLoading] = useState(false);
  const [requestsMessage, setRequestsMessage] = useState("");
  const [requests, setRequests] = useState<ExternalPurchaseRequest[]>([]);
  const [requestSummary, setRequestSummary] = useState<RequestSummary>({
    total: 0,
    pending: 0,
    paid: 0,
    pendingAmount: 0,
    paidAmount: 0,
  });
  const [canManagePayments, setCanManagePayments] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<ExternalPurchaseRequest | null>(null);
  const [requestActionLoading, setRequestActionLoading] = useState<number | null>(null);
  const [receiptUploadTarget, setReceiptUploadTarget] = useState<number | null>(null);

  const accentBg = isZumay ? "bg-red-600" : "bg-blue-600";

  async function loadRequests(selectId?: number) {
    setRequestsLoading(true);
    setRequestsMessage("");

    try {
      const response = await fetch("/api/external-purchase", {
        method: "GET",
        cache: "no-store",
        headers: {
          Accept: "application/json",
        },
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result?.success) {
        throw new Error(result?.message || "Ödeme talepleri alınamadı.");
      }

      const nextRequests = Array.isArray(result?.requests)
        ? (result.requests as ExternalPurchaseRequest[])
        : [];

      setRequests(nextRequests);
      setCanManagePayments(Boolean(result?.canManagePayments));
      setRequestSummary({
        total: Number(result?.summary?.total || 0),
        pending: Number(result?.summary?.pending || 0),
        paid: Number(result?.summary?.paid || 0),
        pendingAmount: Number(result?.summary?.pendingAmount || 0),
        paidAmount: Number(result?.summary?.paidAmount || 0),
      });

      setSelectedRequest((current) => {
        const targetId = selectId ?? current?.id;
        if (!targetId) return current;
        return nextRequests.find((item) => Number(item.id) === Number(targetId)) || null;
      });
    } catch (error: any) {
      setRequestsMessage(error?.message || "Ödeme talepleri alınamadı.");
    } finally {
      setRequestsLoading(false);
    }
  }

  useEffect(() => {
    void loadRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function changeRequestStatus(
    item: ExternalPurchaseRequest,
    action: "PAID" | "CANCELLED"
  ) {
    if (requestActionLoading !== null) return;

    if (action === "PAID" && !item.hasReceipt) {
      alert("Ödeme tamamlanmadan önce dekont yüklenmelidir.");
      return;
    }

    const confirmed = window.confirm(
      action === "PAID"
        ? `${item.requestNo}\n${formatTry(item.amount)} ödeme gönderildi olarak işaretlensin mi?`
        : `${item.requestNo} ödeme talebi iptal edilsin mi?`
    );

    if (!confirmed) return;

    setRequestActionLoading(item.id);
    setRequestsMessage("");

    try {
      const response = await fetch(`/api/external-purchase/${item.id}/status`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ action }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result?.success) {
        throw new Error(result?.message || "İşlem güncellenemedi.");
      }

      await loadRequests(item.id);
    } catch (error: any) {
      setRequestsMessage(error?.message || "İşlem güncellenemedi.");
    } finally {
      setRequestActionLoading(null);
    }
  }

  async function deleteRequest(item: ExternalPurchaseRequest) {
    if (requestActionLoading !== null) return;

    const confirmed = window.confirm(
      `${item.requestNo}\n${item.deviceName}\n\nBu ödeme talebi kalıcı olarak silinecek. Emin misiniz?`
    );

    if (!confirmed) return;

    setRequestActionLoading(item.id);
    setRequestsMessage("");

    try {
      const response = await fetch(`/api/external-purchase/${item.id}`, {
        method: "DELETE",
        headers: {
          Accept: "application/json",
        },
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result?.success) {
        throw new Error(result?.message || "Ödeme talebi silinemedi.");
      }

      setSelectedRequest(null);
      await loadRequests();
    } catch (error: any) {
      setRequestsMessage(error?.message || "Ödeme talebi silinemedi.");
    } finally {
      setRequestActionLoading(null);
    }
  }

  function startReceiptUpload(item: ExternalPurchaseRequest) {
    setReceiptUploadTarget(item.id);
    window.setTimeout(() => receiptInputRef.current?.click(), 0);
  }

  async function handleReceiptSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] || null;
    const targetId = receiptUploadTarget;

    event.target.value = "";

    if (!file || !targetId) {
      setReceiptUploadTarget(null);
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert("Dekont en fazla 5 MB olabilir.");
      setReceiptUploadTarget(null);
      return;
    }

    setRequestActionLoading(targetId);
    setRequestsMessage("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(
        `/api/external-purchase/${targetId}/receipt`,
        {
          method: "POST",
          body: formData,
        }
      );

      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result?.success) {
        throw new Error(result?.message || "Dekont yüklenemedi.");
      }

      await loadRequests(targetId);
    } catch (error: any) {
      setRequestsMessage(error?.message || "Dekont yüklenemedi.");
    } finally {
      setReceiptUploadTarget(null);
      setRequestActionLoading(null);
    }
  }

  function viewReceipt(item: ExternalPurchaseRequest) {
    window.open(`/api/external-purchase/${item.id}/receipt`, "_blank", "noopener,noreferrer");
  }

  function downloadReceipt(item: ExternalPurchaseRequest) {
    window.open(
      `/api/external-purchase/${item.id}/receipt?download=1`,
      "_blank",
      "noopener,noreferrer"
    );
  }

  return (
    <div className="animate-in fade-in duration-300">
      <input
        ref={receiptInputRef}
        type="file"
        accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png"
        onChange={handleReceiptSelected}
        className="hidden"
      />

      <section className="overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.055)]">
        <div className={`px-5 py-5 text-white sm:px-7 ${accentBg}`}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/70">
                {canManagePayments ? "YÖNETİCİ / ADMIN" : "PARTNER"}
              </div>
              <h2 className="mt-1 truncate text-[24px] font-black tracking-[-0.03em]">
                {canManagePayments ? "Ödeme Yönetimi" : "Ödeme Taleplerim"}
              </h2>
              <p className="mt-1 text-[11px] font-semibold text-white/70">
                {canManagePayments
                  ? "Bekleyen ödemeleri kontrol edin, dekont yükleyin ve işlemi tamamlayın."
                  : "Gönderdiğiniz cihaz alımlarının ödeme durumunu takip edin."}
              </p>
            </div>

            <button
              type="button"
              onClick={() => loadRequests(selectedRequest?.id)}
              disabled={requestsLoading}
              className="h-10 shrink-0 rounded-xl bg-white/10 px-4 text-[11px] font-black text-white transition hover:bg-white/20 disabled:opacity-40"
            >
              YENİLE
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 border-b border-slate-200 bg-white p-3 sm:grid-cols-4 sm:p-4">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
            <div className="text-[10px] font-black uppercase tracking-wider text-amber-600">Bekleyen</div>
            <div className="mt-1 text-[20px] font-black text-amber-800">{requestSummary.pending}</div>
          </div>

          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
            <div className="text-[10px] font-black uppercase tracking-wider text-emerald-600">Ödenen</div>
            <div className="mt-1 text-[20px] font-black text-emerald-800">{requestSummary.paid}</div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-500">Bekleyen Tutar</div>
            <div className="mt-1 truncate text-[15px] font-black text-slate-900">
              {formatTry(requestSummary.pendingAmount)}
            </div>
          </div>

          <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3">
            <div className="text-[10px] font-black uppercase tracking-wider text-blue-600">Ödenen Tutar</div>
            <div className="mt-1 truncate text-[15px] font-black text-blue-900">
              {formatTry(requestSummary.paidAmount)}
            </div>
          </div>
        </div>

        {requestsMessage && (
          <div className="mx-3 mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-[10px] font-black text-rose-700 sm:mx-4">
            {requestsMessage}
          </div>
        )}

        <div className="p-3 sm:p-4">
          {requestsLoading && requests.length === 0 ? (
            <div className="flex min-h-[300px] items-center justify-center">
              <div className="text-center">
                <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />
                <div className="mt-3 text-[10px] font-black text-slate-500">Talepler yükleniyor...</div>
              </div>
            </div>
          ) : requests.length === 0 ? (
            <div className="flex min-h-[300px] items-center justify-center text-center">
              <div>
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                  <ReceiptIcon className="h-7 w-7" />
                </div>
                <div className="mt-3 text-[12px] font-black text-slate-700">Henüz ödeme talebi yok</div>
              </div>
            </div>
          ) : (
            <div className="grid gap-3 lg:grid-cols-[minmax(420px,0.9fr)_minmax(460px,1.1fr)]">
              <div className="max-h-[70vh] overflow-y-auto rounded-[22px] border border-slate-200 bg-white p-2 shadow-sm">
                <div className="space-y-2">
                  {requests.map((item) => {
                    const info = statusInfo(item.status);
                    const selected = selectedRequest?.id === item.id;

                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setSelectedRequest(item)}
                        className={`w-full rounded-[18px] border p-4 text-left transition ${
                          selected
                            ? "border-blue-300 bg-blue-50 shadow-sm"
                            : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-[10px] font-black text-slate-950">
                              {item.requestNo}
                            </div>
                            <div className="mt-1 truncate text-[10px] font-bold text-slate-600">
                              {item.deviceName}
                            </div>
                            {item.imei && (
                              <div className="mt-0.5 truncate font-mono text-[10px] font-semibold text-slate-400">
                                IMEI: {item.imei}
                              </div>
                            )}
                          </div>

                          <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-black ${info.badge}`}>
                            {info.label}
                          </span>
                        </div>

                        <div className="mt-3 flex items-end justify-between gap-3">
                          <div>
                            <div className="text-[10px] font-semibold text-slate-400">
                              {item.customer.firstName} {item.customer.lastName}
                            </div>
                            <div className="mt-0.5 text-[10px] font-semibold text-slate-400">
                              {formatDateTime(item.createdAt)}
                            </div>
                          </div>

                          <div className="shrink-0 text-[13px] font-black text-slate-950">
                            {formatTry(item.amount)}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="max-h-[70vh] overflow-y-auto rounded-[22px] border border-slate-200 bg-white shadow-sm">
                {!selectedRequest ? (
                  <div className="flex min-h-[330px] items-center justify-center p-6 text-center">
                    <div>
                      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[22px] bg-slate-100 text-slate-400">
                        <ReceiptIcon className="h-8 w-8" />
                      </div>
                      <div className="mt-4 text-[13px] font-black text-slate-800">İşlem seçin</div>
                      <p className="mt-1 text-[11px] font-semibold text-slate-400">
                        Detay, ödeme durumu ve dekont işlemleri burada açılır.
                      </p>
                    </div>
                  </div>
                ) : (
                  <RequestDetail
                    item={selectedRequest}
                    canManagePayments={canManagePayments}
                    actionLoading={requestActionLoading === selectedRequest.id}
                    onUpload={() => startReceiptUpload(selectedRequest)}
                    onView={() => viewReceipt(selectedRequest)}
                    onDownload={() => downloadReceipt(selectedRequest)}
                    onPaid={() => changeRequestStatus(selectedRequest, "PAID")}
                    onCancel={() => changeRequestStatus(selectedRequest, "CANCELLED")}
                    onDelete={() => deleteRequest(selectedRequest)}
                  />
                )}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function RequestDetail({
  item,
  canManagePayments,
  actionLoading,
  onUpload,
  onView,
  onDownload,
  onPaid,
  onCancel,
  onDelete,
}: {
  item: ExternalPurchaseRequest;
  canManagePayments: boolean;
  actionLoading: boolean;
  onUpload: () => void;
  onView: () => void;
  onDownload: () => void;
  onPaid: () => void;
  onCancel: () => void;
  onDelete: () => void;
}) {
  const info = statusInfo(item.status);

  return (
    <div className="p-4 sm:p-6">
      <div className={`rounded-[22px] border p-4 ${info.panel}`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
              TALEP NUMARASI
            </div>
            <div className="mt-1 text-[18px] font-black tracking-[-0.025em] text-slate-950">
              {item.requestNo}
            </div>
          </div>

          <span className={`inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-black ${info.badge}`}>
            <span className={`h-2 w-2 rounded-full ${info.dot}`} />
            {info.label}
          </span>
        </div>

        <div className="mt-4 border-t border-black/5 pt-4">
          <div className="text-[12px] font-black text-slate-950">{item.deviceName}</div>
          {item.imei && (
            <div className="mt-1 font-mono text-[10px] font-bold text-slate-500">IMEI: {item.imei}</div>
          )}
          <div className="mt-1 text-[20px] font-black text-slate-950">{formatTry(item.amount)}</div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <DetailBox label="Müşteri" value={`${item.customer.firstName} ${item.customer.lastName}`} />
        <DetailBox label="Telefon" value={item.customer.phone || "-"} />
        <DetailBox
          label="T.C. Kimlik No"
          value={canManagePayments ? item.customer.tc : maskTc(item.customer.tc)}
          mono
        />
        <DetailBox label="Kanal / Şube" value={item.branch || "-"} />
      </div>

      <div className="mt-3 rounded-[20px] border border-blue-200 bg-blue-50 p-4">
        <div className="text-[10px] font-black uppercase tracking-[0.15em] text-blue-600">ÖDEME HESABI</div>
        <div className="mt-3 grid gap-3">
          <div>
            <div className="text-[10px] font-black text-blue-500">IBAN SAHİBİ</div>
            <div className="mt-1 break-words text-[11px] font-black text-slate-900">
              {item.customer.ibanHolder || "-"}
            </div>
          </div>

          <div>
            <div className="text-[10px] font-black text-blue-500">IBAN</div>
            <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="break-all font-mono text-[11px] font-black text-slate-900">
                {prettyIban(item.customer.iban)}
              </div>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(item.customer.iban);
                  } catch {}
                }}
                className="h-9 shrink-0 rounded-xl border border-blue-200 bg-white px-3 text-[10px] font-black text-blue-700 transition hover:bg-blue-100"
              >
                IBAN KOPYALA
              </button>
            </div>
          </div>
        </div>
      </div>

      {item.sourceUserEmail && (
        <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">OLUŞTURAN KULLANICI</div>
          <div className="mt-1 break-all text-[10px] font-black text-slate-700">{item.sourceUserEmail}</div>
        </div>
      )}

      <div className="mt-4 rounded-[20px] border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[11px] font-black text-slate-800">Dekont</div>
            <div className="mt-1 text-[10px] font-semibold text-slate-400">
              {item.hasReceipt ? "Bu işlem için dekont yüklendi." : "Henüz dekont yüklenmedi."}
            </div>
          </div>

          <span
            className={`rounded-full px-2.5 py-1 text-[10px] font-black ${
              item.hasReceipt
                ? "bg-emerald-50 text-emerald-700"
                : "bg-slate-100 text-slate-500"
            }`}
          >
            {item.hasReceipt ? "VAR" : "YOK"}
          </span>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {canManagePayments && item.status !== "CANCELLED" && (
            <button
              type="button"
              onClick={onUpload}
              disabled={actionLoading}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-blue-600 px-3 text-[10px] font-black text-white transition hover:bg-blue-700 disabled:opacity-40"
            >
              <UploadIcon />
              {item.hasReceipt ? "DEKONT DEĞİŞTİR" : "DEKONT YÜKLE"}
            </button>
          )}

          {item.hasReceipt && (
            <button
              type="button"
              onClick={onView}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-[10px] font-black text-slate-700 transition hover:bg-slate-50"
            >
              DEKONT GÖR
            </button>
          )}

          {item.hasReceipt && (
            <button
              type="button"
              onClick={onDownload}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-[10px] font-black text-slate-700 transition hover:bg-slate-50"
            >
              DEKONT İNDİR
            </button>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-2 text-[10px] font-semibold text-slate-400 sm:grid-cols-2">
        <div>Oluşturma: {formatDateTime(item.createdAt)}</div>
        <div className="sm:text-right">
          {item.status === "PAID" && item.paidAt
            ? `Ödeme: ${formatDateTime(item.paidAt)}`
            : item.status === "CANCELLED" && item.cancelledAt
            ? `İptal: ${formatDateTime(item.cancelledAt)}`
            : "Ödeme bekleniyor"}
        </div>
      </div>

      {canManagePayments && item.status === "PAYMENT_PENDING" && (
        <div className="mt-5 grid gap-2 sm:grid-cols-[1fr_1.5fr]">
          <button
            type="button"
            onClick={onCancel}
            disabled={actionLoading}
            className="h-12 rounded-2xl border border-rose-200 bg-rose-50 px-4 text-[11px] font-black text-rose-700 transition hover:bg-rose-100 disabled:opacity-40"
          >
            İPTAL ET
          </button>

          <button
            type="button"
            onClick={onPaid}
            disabled={actionLoading || !item.hasReceipt}
            className="h-12 rounded-2xl bg-emerald-600 px-5 text-[11px] font-black text-white shadow-lg transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
          >
            {actionLoading
              ? "İŞLENİYOR..."
              : item.hasReceipt
              ? "✓ ÖDEME GÖNDERİLDİ"
              : "ÖNCE DEKONT YÜKLEYİN"}
          </button>
        </div>
      )}

      {canManagePayments && (
        <div className="mt-4 border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={onDelete}
            disabled={actionLoading}
            className="h-11 w-full rounded-2xl border border-rose-200 bg-white text-[11px] font-black text-rose-600 transition hover:bg-rose-50 disabled:opacity-40"
          >
            ÖDEME TALEBİNİ SİL
          </button>
        </div>
      )}
    </div>
  );
}

function DetailBox({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">{label}</div>
      <div
        className={`mt-1 break-words text-[10px] font-black text-slate-800 ${
          mono ? "font-mono" : ""
        }`}
      >
        {value || "-"}
      </div>
    </div>
  );
}
