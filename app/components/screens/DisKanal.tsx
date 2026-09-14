"use client";

import React, { useMemo, useRef, useState } from "react";

type DisKanalProps = {
  data: any[][];
  selectedBranch: string;
  isZumay?: boolean;
  canEdit?: boolean;
  onEdit?: () => void;
};

type DisKanalRow = {
  name: string;
  price: unknown;
  vodafonePrice: unknown;
  highlighted: boolean;
};

type PurchaseForm = {
  firstName: string;
  lastName: string;
  tc: string;
  phone: string;
  iban: string;
  ibanHolder: string;
};

type ExternalPurchaseRequest = {
  id: number;
  requestNo: string;
  branch: string;
  sourceUserEmail?: string;
  deviceName: string;
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

const EMPTY_FORM: PurchaseForm = {
  firstName: "",
  lastName: "",
  tc: "",
  phone: "",
  iban: "",
  ibanHolder: "",
};

function normalizeText(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLocaleUpperCase("tr-TR")
    .replace(/\s+/g, " ");
}

function parsePanelMoney(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  let text = String(value ?? "")
    .trim()
    .replace(/\s+/g, "")
    .replace(/₺|TL/gi, "");

  if (!text) return 0;

  if (text.includes(",") && text.includes(".")) {
    text = text.replace(/\./g, "").replace(",", ".");
  } else if (text.includes(",")) {
    text = text.replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(text)) {
    text = text.replace(/\./g, "");
  }

  const number = Number(text);
  return Number.isFinite(number) ? number : 0;
}

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

function normalizeTcInput(value: string) {
  return value.replace(/\D/g, "").slice(0, 11);
}

function normalizePhoneInput(value: string) {
  return value.replace(/\D/g, "").slice(0, 15);
}

function normalizeIbanInput(value: string) {
  return value
    .replace(/\s+/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 26);
}

function prettyIban(value: string) {
  return value.replace(/(.{4})/g, "$1 ").trim();
}

function maskTc(value: string) {
  const digits = value.replace(/\D/g, "");
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

function SearchIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2.1}
        d="M21 21l-5-5m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
      />
    </svg>
  );
}

function ChannelIcon({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5 5h14v14H5V5zm3 3h8M8 12h5M8 16h8"
      />
    </svg>
  );
}

function CloseIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M6 18L18 6M6 6l12 12"
      />
    </svg>
  );
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

function StatCard({
  label,
  value,
  footer,
  tone = "teal",
  icon,
}: {
  label: string;
  value: React.ReactNode;
  footer: string;
  tone?: "teal" | "blue" | "amber" | "purple" | "red";
  icon: React.ReactNode;
}) {
  const toneMap = {
    teal: "bg-teal-50 text-teal-600",
    blue: "bg-blue-50 text-blue-600",
    amber: "bg-amber-50 text-amber-600",
    purple: "bg-purple-50 text-purple-600",
    red: "bg-red-50 text-red-600",
  };

  return (
    <div className="flex min-h-[74px] items-center gap-3 rounded-[18px] border border-slate-200 bg-white px-4 py-3 shadow-[0_3px_10px_rgba(15,23,42,0.07)]">
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${toneMap[tone]}`}
      >
        {icon}
      </div>

      <div className="min-w-0">
        <p className="text-[7px] font-black uppercase tracking-[0.1em] text-slate-400">
          {label}
        </p>
        <p className="mt-0.5 truncate text-[18px] font-black leading-none tracking-[-0.03em] text-slate-950">
          {value}
        </p>
        <p className="mt-1 truncate text-[8px] font-semibold text-slate-400">
          {footer}
        </p>
      </div>
    </div>
  );
}

export default function DisKanal({
  data,
  selectedBranch,
  isZumay = false,
  canEdit = false,
  onEdit,
}: DisKanalProps) {
  const searchRef = useRef<HTMLInputElement | null>(null);
  const receiptInputRef = useRef<HTMLInputElement | null>(null);

  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(false);

  const [purchaseModalOpen, setPurchaseModalOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState<DisKanalRow | null>(null);
  const [purchaseForm, setPurchaseForm] = useState<PurchaseForm>(EMPTY_FORM);
  const [purchaseSubmitting, setPurchaseSubmitting] = useState(false);
  const [purchaseMessage, setPurchaseMessage] = useState("");
  const [createdRequestNo, setCreatedRequestNo] = useState("");

  const [requestsOpen, setRequestsOpen] = useState(false);
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

  const isVodafone = selectedBranch === "VODAFONE KANALI";
  const accent = isZumay ? "red" : "teal";

  const rows = useMemo<DisKanalRow[]>(() => {
    const source = Array.isArray(data) ? data.slice(1) : [];

    return source
      .filter((row) => String(row?.[0] ?? "").trim() !== "")
      .map((row) => {
        const name = String(row?.[0] ?? "").trim();
        const normalized = normalizeText(name);

        return {
          name,
          price: row?.[1],
          vodafonePrice: row?.[2],
          highlighted:
            normalized.includes("BOMBA") ||
            normalized.includes("KAMPANYA") ||
            normalized.includes("FIRSAT") ||
            normalized.includes("ÖZEL"),
        };
      });
  }, [data]);

  const filteredRows = useMemo(() => {
    const query = normalizeText(search);

    if (!query) return rows;

    return rows.filter((row) =>
      normalizeText(
        `${row.name} ${row.price ?? ""} ${row.vodafonePrice ?? ""}`
      ).includes(query)
    );
  }, [rows, search]);

  const highlightedCount = rows.filter((row) => row.highlighted).length;
  const visibleRows =
    showAll || search.trim() !== "" ? filteredRows : filteredRows.slice(0, 22);

  const heroGradient = isZumay
    ? "from-[#fff1f2] via-[#ffe4e6] to-[#fecdd3]"
    : "from-[#ecfeff] via-[#ccfbf1] to-[#99f6e4]";

  const accentText = isZumay ? "text-red-600" : "text-teal-600";
  const accentBg = isZumay ? "bg-red-600" : "bg-teal-600";
  const accentHover = isZumay ? "hover:bg-red-700" : "hover:bg-teal-700";
  const accentLight = isZumay ? "bg-red-50" : "bg-teal-50";
  const accentBorder = isZumay ? "border-red-100" : "border-teal-100";

  const selectedAmount = useMemo(() => {
    if (!selectedRow) return 0;

    return parsePanelMoney(
      isVodafone && String(selectedRow.vodafonePrice ?? "").trim()
        ? selectedRow.vodafonePrice
        : selectedRow.price
    );
  }, [selectedRow, isVodafone]);

  const purchaseFormValid = useMemo(() => {
    return Boolean(
      selectedRow &&
        selectedAmount > 0 &&
        purchaseForm.firstName.trim() &&
        purchaseForm.lastName.trim() &&
        /^\d{11}$/.test(purchaseForm.tc) &&
        purchaseForm.phone.replace(/\D/g, "").length >= 10 &&
        /^TR\d{24}$/.test(purchaseForm.iban) &&
        purchaseForm.ibanHolder.trim()
    );
  }, [selectedRow, selectedAmount, purchaseForm]);

  function clearSearch() {
    setSearch("");
    setShowAll(false);
    window.setTimeout(() => searchRef.current?.focus(), 0);
  }

  function openPurchase(row: DisKanalRow) {
    setSelectedRow(row);
    setPurchaseForm(EMPTY_FORM);
    setPurchaseMessage("");
    setCreatedRequestNo("");
    setPurchaseModalOpen(true);
  }

  function closePurchase() {
    if (purchaseSubmitting) return;
    setPurchaseModalOpen(false);
    setSelectedRow(null);
    setPurchaseForm(EMPTY_FORM);
    setPurchaseMessage("");
    setCreatedRequestNo("");
  }

  function updatePurchaseForm<K extends keyof PurchaseForm>(
    key: K,
    value: PurchaseForm[K]
  ) {
    setPurchaseForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function submitPurchase() {
    if (!selectedRow || !purchaseFormValid || purchaseSubmitting) return;

    setPurchaseSubmitting(true);
    setPurchaseMessage("");
    setCreatedRequestNo("");

    try {
      const response = await fetch("/api/external-purchase", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          deviceName: selectedRow.name,
          amount: selectedAmount,
          firstName: purchaseForm.firstName.trim(),
          lastName: purchaseForm.lastName.trim(),
          tc: purchaseForm.tc,
          phone: purchaseForm.phone,
          iban: purchaseForm.iban,
          ibanHolder: purchaseForm.ibanHolder.trim(),
        }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result?.success) {
        throw new Error(result?.message || "Ödeme talebi oluşturulamadı.");
      }

      setCreatedRequestNo(String(result?.request?.requestNo || ""));
      setPurchaseMessage("Ödeme talebi başarıyla sıraya alındı.");
    } catch (error: any) {
      setPurchaseMessage(error?.message || "Ödeme talebi oluşturulamadı.");
    } finally {
      setPurchaseSubmitting(false);
    }
  }

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

      if (selectId) {
        setSelectedRequest(
          nextRequests.find((item) => Number(item.id) === Number(selectId)) || null
        );
      } else if (selectedRequest) {
        setSelectedRequest(
          nextRequests.find((item) => item.id === selectedRequest.id) || null
        );
      }
    } catch (error: any) {
      setRequestsMessage(error?.message || "Ödeme talepleri alınamadı.");
    } finally {
      setRequestsLoading(false);
    }
  }

  async function openRequests() {
    setRequestsOpen(true);
    setSelectedRequest(null);
    await loadRequests();
  }

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

      {/* ÜST HERO */}
      <section
        className={`overflow-hidden rounded-[26px] border ${accentBorder} bg-white shadow-[0_8px_30px_rgba(15,23,42,0.055)]`}
      >
        <div className="grid min-h-[122px] lg:grid-cols-[1.25fr_0.75fr]">
          <div className="flex flex-col justify-center px-7 py-5 sm:px-8">
            <div className={`text-[8px] font-black uppercase tracking-[0.2em] ${accentText}`}>
              CNETMOBİL V2
            </div>

            <h2 className="mt-2 text-[28px] font-black tracking-[-0.045em] text-slate-950 sm:text-[31px]">
              Dış Kanal Satın Alma
            </h2>

            <p className="mt-2 text-[10px] font-semibold text-slate-400">
              Dış kanal ürünlerini görüntüleyin, cihaz alımını oluşturun ve ödeme sürecini takip edin.
            </p>
          </div>

          <div className={`relative hidden overflow-hidden bg-gradient-to-r ${heroGradient} lg:block`}>
            <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-white to-transparent" />

            <div className="absolute left-[13%] top-1/2 z-10 flex -translate-y-1/2 items-center gap-3">
              <div className={`flex h-11 w-11 items-center justify-center rounded-2xl bg-white/80 shadow-sm ${accentText}`}>
                <ChannelIcon />
              </div>

              <div className={`text-[10px] font-black leading-[1.5] ${accentText}`}>
                Güçlü Kanal
                <br />
                Güncel Fiyat
                <br />
                Hızlı Satın Alma
              </div>
            </div>

            <div className="absolute bottom-[-18px] right-[8%] h-[96px] w-[125px] rounded-[24px] border-[6px] border-slate-800 bg-white/70 shadow-2xl">
              <div className={`mx-auto mt-6 h-3 w-[70px] rounded-full ${isZumay ? "bg-red-400" : "bg-teal-400"}`} />
              <div className="mx-auto mt-3 h-3 w-[88px] rounded-full bg-slate-300" />
              <div className="mx-auto mt-3 h-3 w-[60px] rounded-full bg-slate-300" />
            </div>

            <div className="absolute bottom-[16px] right-[27%] flex h-[58px] w-[58px] rotate-[-10deg] items-center justify-center rounded-2xl bg-slate-900 text-white shadow-xl">
              <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 7h18M5 7l1 12h12l1-12M9 11v4m6-4v4M8 7l1-3h6l1 3"
                />
              </svg>
            </div>
          </div>
        </div>

        <div className={`grid gap-2 border-t ${accentBorder} bg-slate-50/60 p-3 sm:grid-cols-2 xl:grid-cols-4`}>
          <StatCard
            label="Toplam Ürün"
            value={rows.length}
            footer="Dış kanal ürünleri"
            tone={accent}
            icon={<ChannelIcon className="h-5 w-5" />}
          />

          <StatCard
            label="Öne Çıkan"
            value={highlightedCount}
            footer="Bomba / kampanyalı ürün"
            tone="amber"
            icon={
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 3l2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 15.4 7.2 18l.9-5.4-3.9-3.8 5.4-.8L12 3z"
                />
              </svg>
            }
          />

          <StatCard
            label="Aktif Kanal"
            value={isVodafone ? "Vodafone" : "Genel"}
            footer={selectedBranch || "Tüm mağazalar"}
            tone={isVodafone ? "purple" : "blue"}
            icon={
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h10"
                />
              </svg>
            }
          />

          <StatCard
            label="İşlem Merkezi"
            value="Aktif"
            footer="Cihaz Al + Ödeme Takibi"
            tone={accent}
            icon={<ReceiptIcon className="h-5 w-5" />}
          />
        </div>
      </section>

      {/* ARAMA + İŞLEM BUTONLARI */}
      <section className="sticky top-[104px] z-30 mt-4 rounded-[22px] border border-slate-200 bg-white/95 p-3 shadow-[0_9px_26px_rgba(15,23,42,0.07)] backdrop-blur">
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <div className="relative min-w-0 flex-1">
            <div className={`pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 ${accentText}`}>
              <SearchIcon />
            </div>

            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Ürün / cihaz veya fiyat ara..."
              className={`h-[49px] w-full rounded-2xl border border-slate-200 bg-slate-50 pl-12 pr-4 text-[11px] font-bold text-slate-800 outline-none placeholder:text-slate-400 ${
                isZumay
                  ? "focus:border-red-400 focus:ring-red-50"
                  : "focus:border-teal-400 focus:ring-teal-50"
              } focus:bg-white focus:ring-4`}
            />
          </div>

          <button
            type="button"
            onClick={openRequests}
            className="inline-flex h-[49px] min-w-[175px] items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 text-[10px] font-black text-white shadow-lg transition hover:bg-slate-800"
          >
            <ReceiptIcon className="h-4 w-4" />
            ÖDEME TALEPLERİ
          </button>

          {canEdit && onEdit && (
            <button
              type="button"
              onClick={onEdit}
              className={`inline-flex h-[49px] min-w-[135px] items-center justify-center gap-2 rounded-2xl px-5 text-[10px] font-black text-white shadow-lg transition ${accentBg} ${accentHover}`}
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7m-1.5-8.5a2.121 2.121 0 013 3L12 17l-4 1 1-4 9.5-9.5z"
                />
              </svg>
              DÜZENLE
            </button>
          )}

          <button
            type="button"
            onClick={clearSearch}
            className="inline-flex h-[49px] min-w-[110px] items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-[10px] font-black text-slate-500 transition hover:bg-slate-100"
          >
            Temizle
          </button>
        </div>
      </section>

      {/* TABLO */}
      <section className="mt-4 overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_8px_26px_rgba(15,23,42,0.05)]">
        <div className="flex items-center justify-between gap-3 px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${accentLight} ${accentText}`}>
              <ChannelIcon />
            </div>

            <div className="min-w-0">
              <h3 className="truncate text-[17px] font-black tracking-[-0.03em] text-slate-950">
                Dış Kanal Ürün Listesi
              </h3>
              <p className="truncate text-[9px] font-semibold text-slate-400">
                Cihaz listeden kaybolmaz. Aynı ürüne sınırsız yeni işlem açılabilir.
              </p>
            </div>
          </div>

          <span className={`shrink-0 rounded-full px-3 py-1.5 text-[8px] font-black ${accentLight} ${accentText}`}>
            {filteredRows.length} Ürün
          </span>
        </div>

        <div className="overflow-x-auto">
          <div className={isVodafone ? "min-w-[930px]" : "min-w-[760px]"}>
            <div
              className={`grid ${
                isVodafone
                  ? "grid-cols-[48px_minmax(330px,1fr)_150px_170px_150px]"
                  : "grid-cols-[48px_minmax(360px,1fr)_170px_150px]"
              } border-y border-slate-200 bg-slate-50/90 text-[8px] font-black uppercase tracking-[0.05em] text-slate-500`}
            >
              <div className="px-2 py-3 text-center">#</div>
              <div className="px-3 py-3">Ürün / Cihaz Adı</div>
              <div className={`px-3 py-3 text-right ${accentLight} ${accentText}`}>
                Fiyatı (TL)
              </div>

              {isVodafone && (
                <div className="bg-purple-50 px-3 py-3 text-right text-purple-600">
                  Vodafone Satın Alma
                </div>
              )}

              <div className="px-3 py-3 text-center">İşlem</div>
            </div>

            {visibleRows.length === 0 ? (
              <div className="flex min-h-[220px] items-center justify-center px-6 text-center">
                <div>
                  <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                    <SearchIcon />
                  </div>
                  <p className="text-[11px] font-black text-slate-700">Ürün bulunamadı</p>
                  <p className="mt-1 text-[9px] font-semibold text-slate-400">
                    Arama kelimesini değiştirerek tekrar deneyin.
                  </p>
                </div>
              </div>
            ) : (
              visibleRows.map((row, index) => {
                const operationPrice = parsePanelMoney(
                  isVodafone && String(row.vodafonePrice ?? "").trim()
                    ? row.vodafonePrice
                    : row.price
                );

                return (
                  <div
                    key={`${row.name}-${index}`}
                    className={`grid ${
                      isVodafone
                        ? "grid-cols-[48px_minmax(330px,1fr)_150px_170px_150px]"
                        : "grid-cols-[48px_minmax(360px,1fr)_170px_150px]"
                    } border-b border-slate-100 last:border-b-0 transition ${
                      row.highlighted
                        ? isZumay
                          ? "bg-red-50/80"
                          : "bg-teal-50/80"
                        : index % 2 === 0
                        ? "bg-white"
                        : "bg-slate-50/35"
                    } hover:bg-slate-50`}
                  >
                    <div className="flex items-center justify-center px-2 py-[10px] text-[9px] font-bold text-slate-400">
                      {index + 1}
                    </div>

                    <div className="flex min-w-0 items-center gap-2 px-3 py-[10px]">
                      {row.highlighted && (
                        <span
                          className={`h-2 w-2 shrink-0 rounded-full ${
                            isZumay ? "bg-red-500" : "bg-teal-500"
                          } shadow-[0_0_0_4px_rgba(20,184,166,0.12)]`}
                        />
                      )}
                      <span
                        title={row.name}
                        className={`truncate text-[10px] font-black ${
                          row.highlighted ? accentText : "text-slate-900"
                        }`}
                      >
                        {row.name}
                      </span>
                    </div>

                    <div
                      className={`flex items-center justify-end whitespace-nowrap border-l border-slate-100 px-3 py-[10px] text-[11px] font-black ${
                        row.highlighted ? accentText : "text-slate-950"
                      }`}
                    >
                      {String(row.price || "-")}
                    </div>

                    {isVodafone && (
                      <div className="flex items-center justify-end whitespace-nowrap border-l border-purple-100 bg-purple-50/50 px-3 py-[10px] text-[11px] font-black text-purple-600">
                        {String(row.vodafonePrice || "-")}
                      </div>
                    )}

                    <div className="flex items-center justify-center border-l border-slate-100 px-3 py-[8px]">
                      <button
                        type="button"
                        onClick={() => openPurchase(row)}
                        disabled={operationPrice <= 0}
                        className={`inline-flex h-9 w-full items-center justify-center gap-2 rounded-xl px-3 text-[9px] font-black text-white shadow-sm transition disabled:cursor-not-allowed disabled:bg-slate-300 ${accentBg} ${accentHover}`}
                      >
                        CİHAZ AL
                        <span className="text-[13px]">→</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 px-5 py-3">
          <button
            type="button"
            onClick={() => setShowAll((value) => !value)}
            className={`inline-flex items-center gap-2 text-[9px] font-black ${accentText}`}
          >
            {showAll ? "Listeyi Kısalt" : "Tüm Ürünleri Gör"}
            <span className="text-[14px]">→</span>
          </button>

          <span className="rounded-full bg-slate-100 px-3 py-1.5 text-[8px] font-black text-slate-500">
            {filteredRows.length} ürün listeleniyor
          </span>
        </div>
      </section>

      {/* HIZLI ARA */}
      <button
        type="button"
        title="Hızlı Ara"
        onClick={() => {
          searchRef.current?.focus();
          searchRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
        }}
        className={`fixed bottom-[88px] right-[74px] z-40 flex h-[54px] w-[54px] items-center justify-center rounded-full text-white shadow-[0_13px_30px_rgba(15,118,110,0.35)] transition hover:scale-105 max-sm:right-5 ${accentBg} ${accentHover}`}
      >
        <SearchIcon className="h-6 w-6" />
      </button>

      {/* ==================================================== */}
      {/* CİHAZ AL MODAL */}
      {/* ==================================================== */}
      {purchaseModalOpen && selectedRow && (
        <div className="fixed inset-0 z-[260] flex items-center justify-center bg-slate-950/65 p-3 backdrop-blur-sm sm:p-5">
          <div className="max-h-[94vh] w-full max-w-[760px] overflow-hidden rounded-[28px] border border-white/10 bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-950 px-5 py-5 text-white sm:px-7">
              <div className="min-w-0">
                <div className="text-[8px] font-black uppercase tracking-[0.2em] text-blue-300">
                  DIŞ KANAL CİHAZ ALIMI
                </div>
                <h3 className="mt-1 truncate text-[22px] font-black tracking-[-0.03em]">
                  Yeni Ödeme Talebi
                </h3>
                <p className="mt-1 text-[9px] font-semibold text-slate-400">
                  Her gönderim yeni ve bağımsız bir DK işlem numarası oluşturur.
                </p>
              </div>

              <button
                type="button"
                onClick={closePurchase}
                disabled={purchaseSubmitting}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white transition hover:bg-white/20 disabled:opacity-40"
              >
                <CloseIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[calc(94vh-92px)] overflow-y-auto p-4 sm:p-6">
              {createdRequestNo ? (
                <div className="py-5">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                    <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2.3}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>

                  <div className="mt-4 text-center">
                    <div className="text-[22px] font-black tracking-[-0.03em] text-slate-950">
                      Ödeme Sıraya Alındı
                    </div>
                    <p className="mt-2 text-[10px] font-semibold text-slate-500">
                      İşlem PostgreSQL'e kaydedildi ve bildirim oluşturuldu.
                    </p>
                  </div>

                  <div className="mx-auto mt-5 max-w-[480px] rounded-[22px] border border-emerald-200 bg-emerald-50 p-5 text-center">
                    <div className="text-[8px] font-black uppercase tracking-[0.18em] text-emerald-600">
                      TALEP NUMARASI
                    </div>
                    <div className="mt-1 text-[20px] font-black text-emerald-800">
                      {createdRequestNo}
                    </div>
                    <div className="mt-4 border-t border-emerald-200 pt-4 text-left">
                      <div className="text-[10px] font-black text-slate-950">{selectedRow.name}</div>
                      <div className="mt-1 text-[17px] font-black text-emerald-700">
                        {formatTry(selectedAmount)}
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 grid gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => {
                        setPurchaseForm(EMPTY_FORM);
                        setCreatedRequestNo("");
                        setPurchaseMessage("");
                      }}
                      className={`h-12 rounded-2xl text-[10px] font-black text-white shadow-lg ${accentBg} ${accentHover}`}
                    >
                      AYNI CİHAZA YENİ İŞLEM
                    </button>

                    <button
                      type="button"
                      onClick={async () => {
                        closePurchase();
                        await openRequests();
                      }}
                      className="h-12 rounded-2xl bg-slate-950 text-[10px] font-black text-white transition hover:bg-slate-800"
                    >
                      ÖDEME TALEPLERİNE GİT
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid gap-3 rounded-[22px] border border-slate-200 bg-slate-50 p-4 sm:grid-cols-[1fr_180px]">
                    <div className="min-w-0">
                      <div className="text-[8px] font-black uppercase tracking-[0.16em] text-slate-400">
                        SEÇİLEN CİHAZ
                      </div>
                      <div className="mt-1 break-words text-[13px] font-black text-slate-950">
                        {selectedRow.name}
                      </div>
                    </div>

                    <div className="rounded-2xl bg-white px-4 py-3 text-right shadow-sm">
                      <div className="text-[8px] font-black uppercase tracking-[0.14em] text-slate-400">
                        ÖDENECEK TUTAR
                      </div>
                      <div className={`mt-1 text-[18px] font-black ${accentText}`}>
                        {formatTry(selectedAmount)}
                      </div>
                    </div>
                  </div>

                  <div className="mt-5">
                    <div className="mb-3 flex items-center gap-2">
                      <div className={`h-2 w-2 rounded-full ${isZumay ? "bg-red-500" : "bg-teal-500"}`} />
                      <h4 className="text-[11px] font-black uppercase tracking-[0.08em] text-slate-700">
                        Müşteri Bilgileri
                      </h4>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block">
                        <span className="mb-1.5 block text-[9px] font-black text-slate-500">Ad</span>
                        <input
                          value={purchaseForm.firstName}
                          onChange={(e) => updatePurchaseForm("firstName", e.target.value)}
                          maxLength={100}
                          placeholder="Müşteri adı"
                          className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-[11px] font-bold text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
                        />
                      </label>

                      <label className="block">
                        <span className="mb-1.5 block text-[9px] font-black text-slate-500">Soyad</span>
                        <input
                          value={purchaseForm.lastName}
                          onChange={(e) => updatePurchaseForm("lastName", e.target.value)}
                          maxLength={100}
                          placeholder="Müşteri soyadı"
                          className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-[11px] font-bold text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
                        />
                      </label>

                      <label className="block">
                        <span className="mb-1.5 block text-[9px] font-black text-slate-500">T.C. Kimlik No</span>
                        <input
                          inputMode="numeric"
                          value={purchaseForm.tc}
                          onChange={(e) => updatePurchaseForm("tc", normalizeTcInput(e.target.value))}
                          maxLength={11}
                          placeholder="11 hane"
                          className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-[11px] font-bold text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
                        />
                      </label>

                      <label className="block">
                        <span className="mb-1.5 block text-[9px] font-black text-slate-500">Telefon</span>
                        <input
                          inputMode="tel"
                          value={purchaseForm.phone}
                          onChange={(e) => updatePurchaseForm("phone", normalizePhoneInput(e.target.value))}
                          placeholder="05XXXXXXXXX"
                          className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-[11px] font-bold text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
                        />
                      </label>
                    </div>
                  </div>

                  <div className="mt-5">
                    <div className="mb-3 flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-blue-500" />
                      <h4 className="text-[11px] font-black uppercase tracking-[0.08em] text-slate-700">
                        Ödeme Bilgileri
                      </h4>
                    </div>

                    <div className="grid gap-3">
                      <label className="block">
                        <span className="mb-1.5 block text-[9px] font-black text-slate-500">IBAN</span>
                        <input
                          value={prettyIban(purchaseForm.iban)}
                          onChange={(e) => updatePurchaseForm("iban", normalizeIbanInput(e.target.value))}
                          placeholder="TR00 0000 0000 0000 0000 0000 00"
                          className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 font-mono text-[11px] font-bold uppercase tracking-wide text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
                        />
                      </label>

                      <label className="block">
                        <span className="mb-1.5 block text-[9px] font-black text-slate-500">IBAN Sahibi Ad Soyad</span>
                        <input
                          value={purchaseForm.ibanHolder}
                          onChange={(e) => updatePurchaseForm("ibanHolder", e.target.value)}
                          maxLength={200}
                          placeholder="Hesap sahibinin adı soyadı"
                          className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-[11px] font-bold text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
                        />
                      </label>
                    </div>
                  </div>

                  {purchaseMessage && (
                    <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-[10px] font-black text-rose-700">
                      {purchaseMessage}
                    </div>
                  )}

                  <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <button
                      type="button"
                      onClick={closePurchase}
                      disabled={purchaseSubmitting}
                      className="h-12 rounded-2xl border border-slate-200 bg-white px-5 text-[10px] font-black text-slate-500 transition hover:bg-slate-50 disabled:opacity-50"
                    >
                      VAZGEÇ
                    </button>

                    <button
                      type="button"
                      onClick={submitPurchase}
                      disabled={!purchaseFormValid || purchaseSubmitting}
                      className={`h-12 min-w-[220px] rounded-2xl px-6 text-[10px] font-black text-white shadow-lg transition disabled:cursor-not-allowed disabled:bg-slate-300 ${accentBg} ${accentHover}`}
                    >
                      {purchaseSubmitting ? "GÖNDERİLİYOR..." : "ÖDEME TALEBİ GÖNDER"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* ÖDEME TALEPLERİ / YÖNETİM MODAL */}
      {/* ==================================================== */}
      {requestsOpen && (
        <div className="fixed inset-0 z-[270] bg-slate-950/70 p-0 backdrop-blur-sm sm:p-4">
          <div className="mx-auto flex h-full w-full max-w-[1500px] flex-col overflow-hidden bg-slate-50 shadow-2xl sm:rounded-[28px]">
            <div className="shrink-0 border-b border-slate-800 bg-slate-950 px-4 py-4 text-white sm:px-6">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-[8px] font-black uppercase tracking-[0.2em] text-blue-300">
                    {canManagePayments ? "YÖNETİCİ / ADMIN" : "PARTNER"}
                  </div>
                  <h3 className="mt-1 truncate text-[22px] font-black tracking-[-0.035em]">
                    {canManagePayments ? "Dış Kanal Ödeme Yönetimi" : "Ödeme Taleplerim"}
                  </h3>
                  <p className="mt-1 text-[9px] font-semibold text-slate-400">
                    {canManagePayments
                      ? "Bekleyen ödemeleri kontrol edin, dekont yükleyin ve işlemi tamamlayın."
                      : "Gönderdiğiniz dış kanal cihaz alımlarının ödeme durumunu takip edin."}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => loadRequests(selectedRequest?.id)}
                    disabled={requestsLoading}
                    className="hidden h-10 rounded-xl bg-white/10 px-4 text-[9px] font-black text-white transition hover:bg-white/20 disabled:opacity-40 sm:block"
                  >
                    YENİLE
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setRequestsOpen(false);
                      setSelectedRequest(null);
                    }}
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-white transition hover:bg-white/20"
                  >
                    <CloseIcon className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>

            <div className="shrink-0 grid grid-cols-2 gap-2 border-b border-slate-200 bg-white p-3 sm:grid-cols-4 sm:p-4">
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                <div className="text-[7px] font-black uppercase tracking-wider text-amber-600">Bekleyen</div>
                <div className="mt-1 text-[20px] font-black text-amber-800">{requestSummary.pending}</div>
              </div>

              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                <div className="text-[7px] font-black uppercase tracking-wider text-emerald-600">Ödenen</div>
                <div className="mt-1 text-[20px] font-black text-emerald-800">{requestSummary.paid}</div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="text-[7px] font-black uppercase tracking-wider text-slate-500">Bekleyen Tutar</div>
                <div className="mt-1 truncate text-[15px] font-black text-slate-900">
                  {formatTry(requestSummary.pendingAmount)}
                </div>
              </div>

              <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3">
                <div className="text-[7px] font-black uppercase tracking-wider text-blue-600">Ödenen Tutar</div>
                <div className="mt-1 truncate text-[15px] font-black text-blue-900">
                  {formatTry(requestSummary.paidAmount)}
                </div>
              </div>
            </div>

            {requestsMessage && (
              <div className="mx-3 mt-3 shrink-0 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-[10px] font-black text-rose-700 sm:mx-4">
                {requestsMessage}
              </div>
            )}

            <div className="min-h-0 flex-1 overflow-hidden p-3 sm:p-4">
              {requestsLoading && requests.length === 0 ? (
                <div className="flex h-full min-h-[300px] items-center justify-center">
                  <div className="text-center">
                    <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />
                    <div className="mt-3 text-[10px] font-black text-slate-500">Talepler yükleniyor...</div>
                  </div>
                </div>
              ) : requests.length === 0 ? (
                <div className="flex h-full min-h-[300px] items-center justify-center text-center">
                  <div>
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                      <ReceiptIcon className="h-7 w-7" />
                    </div>
                    <div className="mt-3 text-[12px] font-black text-slate-700">Henüz ödeme talebi yok</div>
                  </div>
                </div>
              ) : (
                <div className="grid h-full min-h-0 gap-3 lg:grid-cols-[minmax(420px,0.9fr)_minmax(460px,1.1fr)]">
                  <div className="min-h-0 overflow-y-auto rounded-[22px] border border-slate-200 bg-white p-2 shadow-sm">
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
                              </div>

                              <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[7px] font-black ${info.badge}`}>
                                {info.label}
                              </span>
                            </div>

                            <div className="mt-3 flex items-end justify-between gap-3">
                              <div>
                                <div className="text-[8px] font-semibold text-slate-400">
                                  {item.customer.firstName} {item.customer.lastName}
                                </div>
                                <div className="mt-0.5 text-[8px] font-semibold text-slate-400">
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

                  <div className="min-h-0 overflow-y-auto rounded-[22px] border border-slate-200 bg-white shadow-sm">
                    {!selectedRequest ? (
                      <div className="flex h-full min-h-[330px] items-center justify-center p-6 text-center">
                        <div>
                          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[22px] bg-slate-100 text-slate-400">
                            <ReceiptIcon className="h-8 w-8" />
                          </div>
                          <div className="mt-4 text-[13px] font-black text-slate-800">İşlem seçin</div>
                          <p className="mt-1 text-[9px] font-semibold text-slate-400">
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
                      />
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
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
}: {
  item: ExternalPurchaseRequest;
  canManagePayments: boolean;
  actionLoading: boolean;
  onUpload: () => void;
  onView: () => void;
  onDownload: () => void;
  onPaid: () => void;
  onCancel: () => void;
}) {
  const info = statusInfo(item.status);

  return (
    <div className="p-4 sm:p-6">
      <div className={`rounded-[22px] border p-4 ${info.panel}`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-[8px] font-black uppercase tracking-[0.18em] text-slate-400">
              TALEP NUMARASI
            </div>
            <div className="mt-1 text-[18px] font-black tracking-[-0.025em] text-slate-950">
              {item.requestNo}
            </div>
          </div>

          <span className={`inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-[8px] font-black ${info.badge}`}>
            <span className={`h-2 w-2 rounded-full ${info.dot}`} />
            {info.label}
          </span>
        </div>

        <div className="mt-4 border-t border-black/5 pt-4">
          <div className="text-[12px] font-black text-slate-950">{item.deviceName}</div>
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
        <div className="text-[8px] font-black uppercase tracking-[0.15em] text-blue-600">ÖDEME HESABI</div>
        <div className="mt-3 grid gap-3">
          <div>
            <div className="text-[8px] font-black text-blue-500">IBAN SAHİBİ</div>
            <div className="mt-1 break-words text-[11px] font-black text-slate-900">
              {item.customer.ibanHolder || "-"}
            </div>
          </div>

          <div>
            <div className="text-[8px] font-black text-blue-500">IBAN</div>
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
                className="h-9 shrink-0 rounded-xl border border-blue-200 bg-white px-3 text-[8px] font-black text-blue-700 transition hover:bg-blue-100"
              >
                IBAN KOPYALA
              </button>
            </div>
          </div>
        </div>
      </div>

      {item.sourceUserEmail && (
        <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="text-[8px] font-black uppercase tracking-[0.14em] text-slate-400">OLUŞTURAN KULLANICI</div>
          <div className="mt-1 break-all text-[10px] font-black text-slate-700">{item.sourceUserEmail}</div>
        </div>
      )}

      <div className="mt-4 rounded-[20px] border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[9px] font-black text-slate-800">Dekont</div>
            <div className="mt-1 text-[8px] font-semibold text-slate-400">
              {item.hasReceipt ? "Bu işlem için dekont yüklendi." : "Henüz dekont yüklenmedi."}
            </div>
          </div>

          <span
            className={`rounded-full px-2.5 py-1 text-[7px] font-black ${
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
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-blue-600 px-3 text-[8px] font-black text-white transition hover:bg-blue-700 disabled:opacity-40"
            >
              <UploadIcon />
              {item.hasReceipt ? "DEKONT DEĞİŞTİR" : "DEKONT YÜKLE"}
            </button>
          )}

          {item.hasReceipt && (
            <button
              type="button"
              onClick={onView}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-[8px] font-black text-slate-700 transition hover:bg-slate-50"
            >
              DEKONT GÖR
            </button>
          )}

          {item.hasReceipt && (
            <button
              type="button"
              onClick={onDownload}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-[8px] font-black text-slate-700 transition hover:bg-slate-50"
            >
              DEKONT İNDİR
            </button>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-2 text-[8px] font-semibold text-slate-400 sm:grid-cols-2">
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
            className="h-12 rounded-2xl border border-rose-200 bg-rose-50 px-4 text-[9px] font-black text-rose-700 transition hover:bg-rose-100 disabled:opacity-40"
          >
            İPTAL ET
          </button>

          <button
            type="button"
            onClick={onPaid}
            disabled={actionLoading || !item.hasReceipt}
            className="h-12 rounded-2xl bg-emerald-600 px-5 text-[9px] font-black text-white shadow-lg transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
          >
            {actionLoading
              ? "İŞLENİYOR..."
              : item.hasReceipt
              ? "✓ ÖDEME GÖNDERİLDİ"
              : "ÖNCE DEKONT YÜKLEYİN"}
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
      <div className="text-[7px] font-black uppercase tracking-[0.14em] text-slate-400">{label}</div>
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
