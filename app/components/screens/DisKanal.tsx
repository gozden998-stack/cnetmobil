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
  imei: string;
  firstName: string;
  lastName: string;
  tc: string;
  phone: string;
  iban: string;
  ibanHolder: string;
};

const EMPTY_FORM: PurchaseForm = {
  imei: "",
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

function normalizeTcInput(value: string) {
  return value.replace(/\D/g, "").slice(0, 11);
}

function normalizeImeiInput(value: string) {
  return value.replace(/\D/g, "").slice(0, 15);
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
        <p className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-400">
          {label}
        </p>
        <p className="mt-0.5 truncate text-[18px] font-black leading-none tracking-[-0.03em] text-slate-950">
          {value}
        </p>
        <p className="mt-1 truncate text-[10px] font-semibold text-slate-400">
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

  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(false);

  const [purchaseModalOpen, setPurchaseModalOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState<DisKanalRow | null>(null);
  const [purchaseForm, setPurchaseForm] = useState<PurchaseForm>(EMPTY_FORM);
  const [purchaseSubmitting, setPurchaseSubmitting] = useState(false);
  const [purchaseMessage, setPurchaseMessage] = useState("");
  const [createdRequestNo, setCreatedRequestNo] = useState("");

  const isVodafone = selectedBranch === "VODAFONE KANALI";
  const canUsePurchaseFlow = Boolean(isZumay);
  const accent = isZumay ? "red" : "teal";

  const tableMinWidthClass = isVodafone
    ? canUsePurchaseFlow
      ? "min-w-[930px]"
      : "min-w-[780px]"
    : canUsePurchaseFlow
    ? "min-w-[760px]"
    : "min-w-[610px]";

  const tableGridClass = isVodafone
    ? canUsePurchaseFlow
      ? "grid-cols-[48px_minmax(330px,1fr)_150px_170px_150px]"
      : "grid-cols-[48px_minmax(330px,1fr)_150px_170px]"
    : canUsePurchaseFlow
    ? "grid-cols-[48px_minmax(360px,1fr)_170px_150px]"
    : "grid-cols-[48px_minmax(360px,1fr)_170px]";

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
    if (!canUsePurchaseFlow || !selectedRow) return 0;
    return parsePanelMoney(selectedRow.price);
  }, [canUsePurchaseFlow, selectedRow]);

  const purchaseFormValid = useMemo(() => {
    return Boolean(
      canUsePurchaseFlow &&
        selectedRow &&
        selectedAmount > 0 &&
        /^\d{15}$/.test(purchaseForm.imei) &&
        purchaseForm.firstName.trim() &&
        purchaseForm.lastName.trim() &&
        /^\d{11}$/.test(purchaseForm.tc) &&
        purchaseForm.phone.replace(/\D/g, "").length >= 10 &&
        /^TR\d{24}$/.test(purchaseForm.iban) &&
        purchaseForm.ibanHolder.trim()
    );
  }, [canUsePurchaseFlow, selectedRow, selectedAmount, purchaseForm]);

  function clearSearch() {
    setSearch("");
    setShowAll(false);
    window.setTimeout(() => searchRef.current?.focus(), 0);
  }

  function openPurchase(row: DisKanalRow) {
    if (!canUsePurchaseFlow) return;

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
    if (!canUsePurchaseFlow) return;
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
          imei: purchaseForm.imei,
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

  return (
    <div className="animate-in fade-in duration-300">

      {/* ÜST HERO */}
      <section
        className={`overflow-hidden rounded-[26px] border ${accentBorder} bg-white shadow-[0_8px_30px_rgba(15,23,42,0.055)]`}
      >
        <div className="grid min-h-[122px] lg:grid-cols-[1.25fr_0.75fr]">
          <div className="flex flex-col justify-center px-7 py-5 sm:px-8">
            <div className={`text-[10px] font-black uppercase tracking-[0.2em] ${accentText}`}>
              CNETMOBİL V2
            </div>

            <h2 className="mt-2 text-[28px] font-black tracking-[-0.045em] text-slate-950 sm:text-[31px]">
              {canUsePurchaseFlow ? "Dış Kanal Satın Alma" : "Dış Kanal Ürün Listesi"}
            </h2>

            <p className="mt-2 text-[10px] font-semibold text-slate-400">
              {canUsePurchaseFlow
                ? "Dış kanal ürünlerini görüntüleyin, cihaz alımını oluşturun ve ödeme sürecini takip edin."
                : "Dış kanal ürünlerini ve güncel fiyatları görüntüleyin."}
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
                {canUsePurchaseFlow ? "Hızlı Satın Alma" : "Ürün Listesi"}
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

        <div
          className={`grid gap-2 border-t ${accentBorder} bg-slate-50/60 p-3 sm:grid-cols-2 ${
            canUsePurchaseFlow ? "xl:grid-cols-4" : "xl:grid-cols-3"
          }`}
        >
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

          {canUsePurchaseFlow && (
            <StatCard
              label="İşlem Merkezi"
              value="Aktif"
              footer="Cihaz Al + Ödeme Takibi"
              tone={accent}
              icon={<ReceiptIcon className="h-5 w-5" />}
            />
          )}
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
              <p className="truncate text-[11px] font-semibold text-slate-400">
                Cihaz listeden kaybolmaz. Aynı ürüne sınırsız yeni işlem açılabilir.
              </p>
            </div>
          </div>

          <span className={`shrink-0 rounded-full px-3 py-1.5 text-[10px] font-black ${accentLight} ${accentText}`}>
            {filteredRows.length} Ürün
          </span>
        </div>

        {visibleRows.length === 0 ? (
          <div className="flex min-h-[220px] items-center justify-center px-6 text-center">
            <div>
              <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                <SearchIcon />
              </div>
              <p className="text-[11px] font-black text-slate-700">Ürün bulunamadı</p>
              <p className="mt-1 text-[11px] font-semibold text-slate-400">
                Arama kelimesini değiştirerek tekrar deneyin.
              </p>
            </div>
          </div>
        ) : (
          <>
        <div className="hidden overflow-x-auto md:block">
          <div className={tableMinWidthClass}>
            <div
              className={`grid ${tableGridClass} border-y border-slate-200 bg-slate-50/90 text-[10px] font-black uppercase tracking-[0.05em] text-slate-500`}
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

              {canUsePurchaseFlow && (
                <div className="px-3 py-3 text-center">İşlem</div>
              )}
            </div>

              {visibleRows.map((row, index) => {
                const operationPrice = canUsePurchaseFlow
                  ? parsePanelMoney(row.price)
                  : 0;

                return (
                  <div
                    key={`${row.name}-${index}`}
                    className={`grid ${tableGridClass} border-b border-slate-100 last:border-b-0 transition ${
                      row.highlighted
                        ? isZumay
                          ? "bg-red-50/80"
                          : "bg-teal-50/80"
                        : index % 2 === 0
                        ? "bg-white"
                        : "bg-slate-50/35"
                    } hover:bg-slate-50`}
                  >
                    <div className="flex items-center justify-center px-2 py-[10px] text-[11px] font-bold text-slate-400">
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

                    {canUsePurchaseFlow && (
                      <div className="flex items-center justify-center border-l border-slate-100 px-3 py-[8px]">
                        <button
                          type="button"
                          onClick={() => openPurchase(row)}
                          disabled={operationPrice <= 0}
                          className={`inline-flex h-9 w-full items-center justify-center gap-2 rounded-xl px-3 text-[11px] font-black text-white shadow-sm transition disabled:cursor-not-allowed disabled:bg-slate-300 ${accentBg} ${accentHover}`}
                        >
                          CİHAZ AL
                          <span className="text-[13px]">→</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </div>

        <div className="divide-y divide-slate-100 md:hidden">
          {visibleRows.map((row, index) => {
            const operationPrice = canUsePurchaseFlow
              ? parsePanelMoney(row.price)
              : 0;

            return (
              <div
                key={`m-${row.name}-${index}`}
                className={`px-4 py-3 ${
                  row.highlighted
                    ? isZumay
                      ? "bg-red-50/80"
                      : "bg-teal-50/80"
                    : index % 2 === 0
                    ? "bg-white"
                    : "bg-slate-50/35"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-400">
                    #{index + 1}
                  </span>
                  {row.highlighted && (
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${
                        isZumay ? "bg-red-500" : "bg-teal-500"
                      }`}
                    />
                  )}
                  <span
                    className={`flex-1 text-[12px] font-black ${
                      row.highlighted ? accentText : "text-slate-900"
                    }`}
                  >
                    {row.name}
                  </span>
                </div>

                <div className="mt-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                        Fiyat
                      </div>
                      <div
                        className={`text-[13px] font-black ${
                          row.highlighted ? accentText : "text-slate-950"
                        }`}
                      >
                        {String(row.price || "-")}
                      </div>
                    </div>

                    {isVodafone && (
                      <div>
                        <div className="text-[10px] font-black uppercase tracking-wide text-purple-500">
                          Vodafone
                        </div>
                        <div className="text-[13px] font-black text-purple-600">
                          {String(row.vodafonePrice || "-")}
                        </div>
                      </div>
                    )}
                  </div>

                  {canUsePurchaseFlow && (
                    <button
                      type="button"
                      onClick={() => openPurchase(row)}
                      disabled={operationPrice <= 0}
                      className={`inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-xl px-4 text-[11px] font-black text-white shadow-sm transition disabled:cursor-not-allowed disabled:bg-slate-300 ${accentBg} ${accentHover}`}
                    >
                      CİHAZ AL
                      <span className="text-[13px]">→</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
          </>
        )}

        <div className="flex items-center justify-between gap-3 px-5 py-3">
          <button
            type="button"
            onClick={() => setShowAll((value) => !value)}
            className={`inline-flex items-center gap-2 text-[11px] font-black ${accentText}`}
          >
            {showAll ? "Listeyi Kısalt" : "Tüm Ürünleri Gör"}
            <span className="text-[14px]">→</span>
          </button>

          <span className="rounded-full bg-slate-100 px-3 py-1.5 text-[10px] font-black text-slate-500">
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
      {canUsePurchaseFlow && purchaseModalOpen && selectedRow && (
        <div className="fixed inset-0 z-[260] flex items-center justify-center bg-slate-950/65 p-3 backdrop-blur-sm sm:p-5">
          <div className="max-h-[94vh] w-full max-w-[760px] overflow-hidden rounded-[28px] border border-white/10 bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-950 px-5 py-5 text-white sm:px-7">
              <div className="min-w-0">
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-300">
                  DIŞ KANAL CİHAZ ALIMI
                </div>
                <h3 className="mt-1 truncate text-[22px] font-black tracking-[-0.03em]">
                  Yeni Ödeme Talebi
                </h3>
                <p className="mt-1 text-[11px] font-semibold text-slate-400">
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
                    <div className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-600">
                      TALEP NUMARASI
                    </div>
                    <div className="mt-1 text-[20px] font-black text-emerald-800">
                      {createdRequestNo}
                    </div>
                    <div className="mt-4 border-t border-emerald-200 pt-4 text-left">
                      <div className="text-[10px] font-black text-slate-950">{selectedRow.name}</div>
                      <div className="mt-1 font-mono text-[10px] font-bold text-slate-500">
                        IMEI: {purchaseForm.imei}
                      </div>
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
                      onClick={closePurchase}
                      className="h-12 rounded-2xl bg-slate-950 text-[10px] font-black text-white transition hover:bg-slate-800"
                    >
                      KAPAT
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid gap-3 rounded-[22px] border border-slate-200 bg-slate-50 p-4 sm:grid-cols-[1fr_180px]">
                    <div className="min-w-0">
                      <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                        SEÇİLEN CİHAZ
                      </div>
                      <div className="mt-1 break-words text-[13px] font-black text-slate-950">
                        {selectedRow.name}
                      </div>
                    </div>

                    <div className="rounded-2xl bg-white px-4 py-3 text-right shadow-sm">
                      <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
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
                        Cihaz IMEI Numarası
                      </h4>
                    </div>

                    <label className="block">
                      <span className="mb-1.5 block text-[11px] font-black text-slate-500">IMEI</span>
                      <input
                        inputMode="numeric"
                        value={purchaseForm.imei}
                        onChange={(e) => updatePurchaseForm("imei", normalizeImeiInput(e.target.value))}
                        maxLength={15}
                        placeholder="15 haneli IMEI numarası"
                        className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 font-mono text-[13px] font-bold tracking-wide text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
                      />
                    </label>
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
                        <span className="mb-1.5 block text-[11px] font-black text-slate-500">Ad</span>
                        <input
                          value={purchaseForm.firstName}
                          onChange={(e) => updatePurchaseForm("firstName", e.target.value)}
                          maxLength={100}
                          placeholder="Müşteri adı"
                          className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-[11px] font-bold text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
                        />
                      </label>

                      <label className="block">
                        <span className="mb-1.5 block text-[11px] font-black text-slate-500">Soyad</span>
                        <input
                          value={purchaseForm.lastName}
                          onChange={(e) => updatePurchaseForm("lastName", e.target.value)}
                          maxLength={100}
                          placeholder="Müşteri soyadı"
                          className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-[11px] font-bold text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
                        />
                      </label>

                      <label className="block">
                        <span className="mb-1.5 block text-[11px] font-black text-slate-500">T.C. Kimlik No</span>
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
                        <span className="mb-1.5 block text-[11px] font-black text-slate-500">Telefon</span>
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
                        <span className="mb-1.5 block text-[11px] font-black text-slate-500">IBAN</span>
                        <input
                          value={prettyIban(purchaseForm.iban)}
                          onChange={(e) => updatePurchaseForm("iban", normalizeIbanInput(e.target.value))}
                          placeholder="TR00 0000 0000 0000 0000 0000 00"
                          className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 font-mono text-[11px] font-bold uppercase tracking-wide text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
                        />
                      </label>

                      <label className="block">
                        <span className="mb-1.5 block text-[11px] font-black text-slate-500">IBAN Sahibi Ad Soyad</span>
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
    </div>
  );
}
