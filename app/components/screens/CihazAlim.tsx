"use client";

import React from "react";

type CihazAlimProps = {
  step: number;
  setStep: (step: number) => void;
  appMode?: string;
  isZumay?: boolean;
  displayBrands: string[];
  brandDb: any[];
  brandAssets: Record<string, any>;
  db: any[];
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  selectedBrand: string;
  setSelectedBrand: (value: string) => void;
  selectedModelName: string;
  setSelectedModelName: (value: string) => void;
  selectedCapacity: any;
  setSelectedCapacity: (value: any) => void;
  selectedColor: string;
  setSelectedColor: (value: string) => void;
  customer: { name: string; phone: string; imei: string };
  setCustomer: (value: any) => void;
  status: Record<string, any>;
  setStatus: (value: any) => void;
  prices: { cash: number; trade: number };
  purchaseType: "NAKİT" | "TAKAS" | "ALINMADI" | null;
  setPurchaseType: (value: "NAKİT" | "TAKAS" | "ALINMADI" | null) => void;
  isCustomOfferActive: boolean;
  setIsCustomOfferActive: (value: boolean) => void;
  customOffer: string;
  setCustomOffer: (value: string) => void;
  isCustomTradeOfferActive: boolean;
  setIsCustomTradeOfferActive: (value: boolean) => void;
  customTradeOffer: string;
  setCustomTradeOffer: (value: string) => void;
  resetSelection: () => void;
  allSelected: boolean;
  calculatedTradePrice: number;
  finalCashPrice: number;
  finalTradePrice: number;
  canProceed: boolean;
  showDocs: boolean;
  isYd: boolean;
  handleFinalProcess: (action: string) => void;
  servisFiyatlari?: any;
  handleServisWhatsApp?: () => void;
};

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

function PhoneIcon({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 3h8a2 2 0 012 2v14a2 2 0 01-2 2H8a2 2 0 01-2-2V5a2 2 0 012-2zm3 15h2"
      />
    </svg>
  );
}

function UserIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M20 21a8 8 0 00-16 0m8-9a4 4 0 100-8 4 4 0 000 8z"
      />
    </svg>
  );
}

function CheckIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function Money({ value }: { value: number | null | undefined }) {
  if (!Number.isFinite(Number(value))) return <>---</>;
  return <>{Number(value).toLocaleString("tr-TR")} TL</>;
}

function StepPill({
  number,
  label,
  active,
  done,
}: {
  number: number;
  label: string;
  active: boolean;
  done: boolean;
}) {
  return (
    <div className="flex shrink-0 items-center gap-2">
      <span
        className={[
          "flex h-8 w-8 items-center justify-center rounded-xl text-[9px] font-black",
          active
            ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
            : done
            ? "bg-emerald-50 text-emerald-600"
            : "bg-slate-100 text-slate-400",
        ].join(" ")}
      >
        {done ? <CheckIcon /> : number}
      </span>
      <span className={`text-[9px] font-black ${active ? "text-slate-900" : "text-slate-400"}`}>
        {label}
      </span>
    </div>
  );
}

function QuestionCard({
  label,
  field,
  options,
  status,
  setStatus,
}: {
  label: string;
  field: string;
  options: string[];
  status: Record<string, any>;
  setStatus: (value: any) => void;
}) {
  return (
    <div className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-[0_5px_18px_rgba(15,23,42,0.04)]">
      <p className="mb-3 text-[9px] font-black uppercase tracking-[0.08em] text-slate-400">
        {label}
      </p>

      <div className="flex flex-wrap gap-2">
        {options.map((option: string) => {
          const selected = status[field] === option;

          return (
            <button
              type="button"
              key={option}
              onClick={() => setStatus({ ...status, [field]: option })}
              className={[
                "rounded-xl border px-3.5 py-2.5 text-[9px] font-black transition",
                selected
                  ? "border-slate-900 bg-slate-900 text-white shadow-md"
                  : "border-slate-200 bg-slate-50 text-slate-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700",
              ].join(" ")}
            >
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function CihazAlim({
  step,
  setStep,
  isZumay = false,
  displayBrands,
  brandDb,
  brandAssets,
  db,
  searchQuery,
  setSearchQuery,
  selectedBrand,
  setSelectedBrand,
  selectedModelName,
  setSelectedModelName,
  selectedCapacity,
  setSelectedCapacity,
  selectedColor,
  setSelectedColor,
  customer,
  setCustomer,
  status,
  setStatus,
  prices,
  purchaseType,
  setPurchaseType,
  isCustomOfferActive,
  setIsCustomOfferActive,
  customOffer,
  setCustomOffer,
  isCustomTradeOfferActive,
  setIsCustomTradeOfferActive,
  customTradeOffer,
  setCustomTradeOffer,
  resetSelection,
  allSelected,
  calculatedTradePrice,
  finalCashPrice,
  finalTradePrice,
  canProceed,
  showDocs,
  isYd,
  handleFinalProcess,
}: CihazAlimProps) {
  const accentBg = isZumay ? "bg-red-600" : "bg-blue-600";
  const accentHover = isZumay ? "hover:bg-red-700" : "hover:bg-blue-700";
  const accentText = isZumay ? "text-red-600" : "text-blue-600";
  const accentLight = isZumay ? "bg-red-50" : "bg-blue-50";
  const accentBorder = isZumay ? "border-red-100" : "border-blue-100";
  const accentFocus = isZumay
    ? "focus:border-red-400 focus:ring-red-50"
    : "focus:border-blue-400 focus:ring-blue-50";

  const brandLogo = (brand: string) => {
    const brandInfo = brandDb.find((item: any) => item?.name === brand);
    return brandInfo?.logo || brandAssets?.[brand]?.logo || "";
  };

  const models = Array.from(
    new Set<string>(
      db
        .filter((item: any) => item?.brand === selectedBrand)
        .map((item: any) => String(item?.name || "").trim())
        .filter(Boolean)
    )
  )
    .filter((name: string) =>
      name.toLocaleLowerCase("tr-TR").includes(searchQuery.toLocaleLowerCase("tr-TR"))
    )
    .sort((a: string, b: string) => a.localeCompare(b, "tr"));

  const selectedDevice = db.find((item: any) => item?.name === selectedModelName);
  const selectedModelVariants = db.filter((item: any) => item?.name === selectedModelName);

  const expertQuestions: Array<{ label: string; field: string; options: string[] }> = [
    { label: "Cihaz Açılıyor mu?", field: "power", options: ["Evet", "Hayır"] },
    {
      label: "Ekran Durumu",
      field: "screen",
      options:
        selectedBrand?.toLocaleLowerCase("tr-TR") === "apple"
          ? ["Sağlam", "Çizikler var", "Kırık", "Bilinmeyen Parça"]
          : ["Sağlam", "Çizikler var", "Kırık"],
    },
    { label: "Kozmetik Durum", field: "cosmetic", options: ["Mükemmel", "İyi", "Kötü"] },
    { label: "Face ID / Touch ID", field: "faceId", options: ["Evet", "Hayır"] },
    {
      label: "Batarya Sağlığı",
      field: "battery",
      options: ["95-100", "85-95", "0-85", "Bilinmeyen Parça"],
    },
    { label: "Ahize / Buzzer", field: "speaker", options: ["Sağlam", "Cızırtı var", "Arızalı"] },
    {
      label: "Kayıt Durumu",
      field: "sim",
      options: ["Fiziksel SIM (TR)", "Fiziksel + eSIM (YD)"],
    },
    {
      label: "Garanti ve Durum",
      field: "warranty",
      options: ["Üretici Garantili", "Yenilenmiş Cihaz", "Garanti Yok"],
    },
  ];

  const selectedQuestionCount = expertQuestions.filter((q) => Boolean(status?.[q.field])).length;

  function goBrands() {
    setStep(1);
    setSearchQuery("");
    resetSelection();
  }

  function goModels() {
    setStep(2);
    setSearchQuery("");
    resetSelection();
  }

  function chooseBrand(brand: string) {
    setSelectedBrand(brand);
    setSearchQuery("");
    setStep(2);
    resetSelection();
  }

  function chooseModel(name: string) {
    setSelectedModelName(name);
    setSearchQuery("");
    setStep(3);
    resetSelection();
  }

  return (
    <div className="animate-in fade-in duration-300">
      {/* V2 HERO */}
      <section className={`overflow-hidden rounded-[26px] border ${accentBorder} bg-white shadow-[0_8px_30px_rgba(15,23,42,0.055)]`}>
        <div className="grid min-h-[122px] lg:grid-cols-[1.25fr_0.75fr]">
          <div className="flex flex-col justify-center px-7 py-5 sm:px-8">
            <div className={`text-[8px] font-black uppercase tracking-[0.2em] ${accentText}`}>
              CNETMOBİL V2
            </div>

            <h2 className="mt-2 text-[28px] font-black tracking-[-0.045em] text-slate-950 sm:text-[31px]">
              Cihaz Alım Merkezi
            </h2>

            <p className="mt-2 text-[10px] font-semibold text-slate-400">
              Marka ve modeli seçin, ekspertizi tamamlayın ve müşteriye anlık nakit / takas teklifini oluşturun.
            </p>
          </div>

          <div className={`relative hidden overflow-hidden bg-gradient-to-r ${isZumay ? "from-red-50 via-rose-100 to-red-200" : "from-blue-50 via-blue-100 to-cyan-100"} lg:block`}>
            <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-white to-transparent" />

            <div className="absolute left-[13%] top-1/2 z-10 flex -translate-y-1/2 items-center gap-3">
              <div className={`flex h-11 w-11 items-center justify-center rounded-2xl bg-white/80 shadow-sm ${accentText}`}>
                <PhoneIcon />
              </div>

              <div className={`text-[10px] font-black leading-[1.5] ${accentText}`}>
                Hızlı Ekspertiz
                <br />
                Anlık Teklif
                <br />
                Güvenli Alım
              </div>
            </div>

            <div className="absolute bottom-[-20px] right-[8%] h-[108px] w-[68px] rotate-[6deg] rounded-[15px] border-[6px] border-slate-800 bg-gradient-to-br from-slate-100 via-blue-300 to-violet-500 shadow-2xl">
              <div className="mx-auto mt-1 h-1.5 w-6 rounded-full bg-slate-800" />
            </div>

            <div className={`absolute bottom-[17px] right-[28%] flex h-[58px] w-[58px] -rotate-[9deg] items-center justify-center rounded-2xl bg-white/85 shadow-xl ${accentText}`}>
              <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-2.2 0-4 1.1-4 2.5S9.8 13 12 13s4 1.1 4 2.5S14.2 18 12 18m0-10V6m0 12v2M5 7h14" />
              </svg>
            </div>
          </div>
        </div>

        <div className="grid gap-2 border-t border-slate-100 bg-slate-50/60 p-3 sm:grid-cols-3">
          <div className="flex min-h-[70px] items-center gap-3 rounded-[18px] border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${accentLight} ${accentText}`}>
              <PhoneIcon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[7px] font-black uppercase tracking-[0.1em] text-slate-400">Marka</p>
              <p className="text-[18px] font-black text-slate-950">{displayBrands.length}</p>
              <p className="text-[8px] font-semibold text-slate-400">Aktif marka</p>
            </div>
          </div>

          <div className="flex min-h-[70px] items-center gap-3 rounded-[18px] border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
              <CheckIcon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[7px] font-black uppercase tracking-[0.1em] text-slate-400">Ekspertiz</p>
              <p className="text-[18px] font-black text-slate-950">{selectedQuestionCount}/8</p>
              <p className="text-[8px] font-semibold text-slate-400">Kontrol adımı</p>
            </div>
          </div>

          <div className="flex min-h-[70px] items-center gap-3 rounded-[18px] border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v18m5-14H9.5a3.5 3.5 0 000 7H14a3.5 3.5 0 010 7H6" />
              </svg>
            </div>
            <div>
              <p className="text-[7px] font-black uppercase tracking-[0.1em] text-slate-400">Teklif Sistemi</p>
              <p className="text-[15px] font-black text-slate-950">Aktif</p>
              <p className="text-[8px] font-semibold text-slate-400">Nakit + Takas</p>
            </div>
          </div>
        </div>
      </section>

      {/* ADIMLAR */}
      <div className="mt-4 flex items-center gap-2 overflow-x-auto rounded-[20px] border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <StepPill number={1} label="Marka Seçimi" active={step === 1} done={step > 1} />
        <div className="h-px min-w-8 flex-1 bg-slate-200" />
        <StepPill number={2} label="Model Seçimi" active={step === 2} done={step > 2} />
        <div className="h-px min-w-8 flex-1 bg-slate-200" />
        <StepPill number={3} label="Ekspertiz & Teklif" active={step >= 3} done={false} />
      </div>

      {/* STEP 1: MARKA */}
      {step === 1 && (
        <section className="mt-4">
          <div className="mb-4">
            <h3 className="text-[20px] font-black tracking-[-0.03em] text-slate-950">
              Marka Seçimi
            </h3>
            <p className="mt-1 text-[10px] font-semibold text-slate-400">
              Müşterinin satmak istediği cihazın markasını seçin.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {displayBrands.map((brand: string) => {
              const logo = brandLogo(brand);

              return (
                <button
                  type="button"
                  key={brand}
                  onClick={() => chooseBrand(brand)}
                  className={`group flex min-h-[160px] flex-col items-center justify-center rounded-[24px] border border-slate-200 bg-white p-5 text-center shadow-[0_6px_20px_rgba(15,23,42,0.04)] transition hover:-translate-y-1 hover:shadow-lg ${isZumay ? "hover:border-red-200" : "hover:border-blue-200"}`}
                >
                  <div className="flex h-16 w-full items-center justify-center">
                    {logo ? (
                      <img
                        src={logo}
                        alt={brand}
                        className="max-h-11 max-w-[110px] object-contain transition duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${accentLight} text-sm font-black ${accentText}`}>
                        {brand.slice(0, 2).toLocaleUpperCase("tr-TR")}
                      </div>
                    )}
                  </div>

                  <div className="mt-3 text-[12px] font-black uppercase tracking-[-0.02em] text-slate-900">
                    {brand}
                  </div>
                  <div className={`mt-1 text-[8px] font-black uppercase tracking-[0.08em] ${accentText}`}>
                    Cihazını Sat
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* STEP 2: MODEL */}
      {step === 2 && (
        <section className="mt-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={goBrands}
              className="inline-flex h-10 w-max items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-[9px] font-black text-slate-500 hover:bg-slate-50"
            >
              ← Markalara Dön
            </button>

            <div className="text-right">
              <div className={`text-[8px] font-black uppercase tracking-[0.12em] ${accentText}`}>
                {selectedBrand}
              </div>
              <div className="text-[18px] font-black tracking-[-0.03em] text-slate-950">
                Model Seçimi
              </div>
            </div>
          </div>

          <div className="sticky top-[104px] z-30 mt-4 rounded-[20px] border border-slate-200 bg-white/95 p-3 shadow-[0_8px_24px_rgba(15,23,42,0.07)] backdrop-blur">
            <div className="relative">
              <div className={`pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 ${accentText}`}>
                <SearchIcon />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(event.target.value)}
                placeholder="Model ara..."
                className={`h-[48px] w-full rounded-2xl border border-slate-200 bg-slate-50 pl-12 pr-4 text-[11px] font-bold text-slate-800 outline-none placeholder:text-slate-400 focus:bg-white focus:ring-4 ${accentFocus}`}
              />
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {models.map((name: string) => {
              const device = db.find((item: any) => item?.name === name);

              return (
                <button
                  type="button"
                  key={name}
                  onClick={() => chooseModel(name)}
                  className={`group flex min-h-[195px] flex-col items-center justify-between rounded-[24px] border border-slate-200 bg-white p-4 text-center shadow-[0_6px_20px_rgba(15,23,42,0.04)] transition hover:-translate-y-1 hover:shadow-lg ${isZumay ? "hover:border-red-200" : "hover:border-blue-200"}`}
                >
                  <div className="flex h-[112px] w-full items-center justify-center">
                    {device?.img ? (
                      <img
                        src={device.img}
                        alt={name}
                        className="max-h-full max-w-full object-contain drop-shadow-md transition duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className={`flex h-16 w-16 items-center justify-center rounded-2xl ${accentLight} ${accentText}`}>
                        <PhoneIcon />
                      </div>
                    )}
                  </div>

                  <div className="w-full">
                    <div className="line-clamp-2 text-[10px] font-black uppercase leading-4 text-slate-900">
                      {name}
                    </div>
                    <div className={`mt-1 text-[8px] font-black uppercase tracking-[0.08em] ${accentText}`}>
                      Telefonunu Sat
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {models.length === 0 && (
            <div className="mt-4 flex min-h-[220px] items-center justify-center rounded-[24px] border border-slate-200 bg-white text-center">
              <div>
                <SearchIcon className="mx-auto h-6 w-6 text-slate-300" />
                <p className="mt-2 text-[10px] font-black text-slate-600">Model bulunamadı</p>
              </div>
            </div>
          )}
        </section>
      )}

      {/* STEP 3: EKSPERTİZ + TEKLİF */}
      {step >= 3 && (
        <section className="mt-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={goModels}
              className="inline-flex h-10 w-max items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-[9px] font-black text-slate-500 hover:bg-slate-50"
            >
              ← Modellere Dön
            </button>

            <div className="text-right">
              <div className={`text-[8px] font-black uppercase tracking-[0.12em] ${accentText}`}>
                {selectedBrand}
              </div>
              <div className="text-[18px] font-black tracking-[-0.03em] text-slate-950">
                Ekspertiz & Teklif
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_340px]">
            <div className="space-y-4">
              {/* SEÇİLİ CİHAZ */}
              <div className={`flex flex-col gap-5 rounded-[26px] border ${accentBorder} bg-gradient-to-r from-white to-slate-50 p-5 shadow-sm sm:flex-row sm:items-center`}>
                <div className={`flex h-28 w-28 shrink-0 items-center justify-center rounded-[22px] border ${accentBorder} bg-white p-3`}>
                  {selectedDevice?.img ? (
                    <img
                      src={selectedDevice.img}
                      alt={selectedModelName}
                      className="max-h-full max-w-full object-contain drop-shadow-md"
                    />
                  ) : (
                    <PhoneIcon className={`h-10 w-10 ${accentText}`} />
                  )}
                </div>

                <div className="min-w-0">
                  <span className={`rounded-lg px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.1em] ${accentLight} ${accentText}`}>
                    {selectedBrand}
                  </span>
                  <h3 className="mt-3 text-[24px] font-black uppercase tracking-[-0.04em] text-slate-950">
                    {selectedModelName}
                  </h3>
                  <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.1em] text-slate-400">
                    Cihaz alım ekspertizi
                  </p>
                </div>
              </div>

              {/* MÜŞTERİ */}
              <div className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${accentLight} ${accentText}`}>
                      <UserIcon />
                    </div>
                    <div>
                      <h4 className="text-[15px] font-black text-slate-950">Müşteri & Güvenlik</h4>
                      <p className="text-[8px] font-semibold text-slate-400">
                        Bilgileri eksiksiz doldurun ve cihaz güvenlik kontrollerini tamamlayın.
                      </p>
                    </div>
                  </div>

                  {customer.imei.length === 15 && (
                    <button
                      type="button"
                      onClick={() => window.open("https://www.turkiye.gov.tr/imei-sorgulama", "_blank")}
                      className={`inline-flex h-10 items-center justify-center rounded-xl px-4 text-[9px] font-black text-white ${accentBg} ${accentHover}`}
                    >
                      BTK IMEI SORGULA
                    </button>
                  )}
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_0.9fr]">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                    <label>
                      <span className="mb-1.5 block text-[8px] font-black uppercase tracking-[0.08em] text-slate-400">
                        Müşteri Adı Soyadı
                      </span>
                      <input
                        value={customer.name}
                        onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                          setCustomer({ ...customer, name: event.target.value })
                        }
                        placeholder="Ad Soyad"
                        className={`h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-[10px] font-black uppercase text-slate-800 outline-none focus:bg-white focus:ring-4 ${accentFocus}`}
                      />
                    </label>

                    <label>
                      <span className="mb-1.5 block text-[8px] font-black uppercase tracking-[0.08em] text-slate-400">
                        İletişim Numarası
                      </span>
                      <input
                        value={customer.phone}
                        onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                          setCustomer({ ...customer, phone: event.target.value })
                        }
                        placeholder="05XX XXX XX XX"
                        className={`h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-[10px] font-black text-slate-800 outline-none focus:bg-white focus:ring-4 ${accentFocus}`}
                      />
                    </label>

                    <label>
                      <span className="mb-1.5 block text-[8px] font-black uppercase tracking-[0.08em] text-slate-400">
                        IMEI Numarası (15 Hane)
                      </span>
                      <input
                        value={customer.imei}
                        maxLength={15}
                        onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                          setCustomer({
                            ...customer,
                            imei: event.target.value.replace(/\D/g, ""),
                          })
                        }
                        placeholder="IMEI Giriniz"
                        className={`h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-[10px] font-black text-slate-800 outline-none focus:bg-white focus:ring-4 ${accentFocus}`}
                      />
                    </label>
                  </div>

                  <div className="rounded-[22px] border border-red-100 bg-red-50/70 p-4">
                    <div className="mb-3 flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.08em] text-red-700">
                      <span className="h-2 w-2 rounded-full bg-red-500" />
                      Personel Onay Listesi
                    </div>

                    <div className="space-y-2.5">
                      {[
                        "Hesaplardan çıkış yapıldı",
                        "Bul (Find My) kapatıldı",
                        "Kayıt durumu kontrol edildi",
                        "Şifreler tamamen silindi",
                      ].map((item: string) => (
                        <label key={item} className="flex cursor-pointer items-center gap-2.5">
                          <input type="checkbox" className="h-4 w-4 accent-red-600" />
                          <span className="text-[9px] font-black text-slate-600">{item}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* HAFIZA + RENK */}
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
                  <p className="text-[9px] font-black uppercase tracking-[0.08em] text-slate-400">
                    Hafıza Kapasitesi
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedModelVariants.map((variant: any) => (
                      <button
                        type="button"
                        key={variant.cap}
                        onClick={() => setSelectedCapacity(variant)}
                        className={[
                          "rounded-xl border px-5 py-3 text-[10px] font-black transition",
                          selectedCapacity?.cap === variant.cap
                            ? `${accentBg} border-transparent text-white shadow-md`
                            : "border-slate-200 bg-slate-50 text-slate-600 hover:border-blue-200 hover:bg-blue-50",
                        ].join(" ")}
                      >
                        {variant.cap}
                      </button>
                    ))}
                  </div>
                </div>

                <div className={`rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm ${selectedModelName === "iPhone 13" ? "" : "opacity-60"}`}>
                  <p className="text-[9px] font-black uppercase tracking-[0.08em] text-slate-400">
                    Renk Seçimi
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedModelName === "iPhone 13" ? (
                      ["Diğer", "Beyaz"].map((color: string) => (
                        <button
                          type="button"
                          key={color}
                          onClick={() => setSelectedColor(color)}
                          className={[
                            "rounded-xl border px-5 py-3 text-[10px] font-black transition",
                            selectedColor === color
                              ? "border-slate-900 bg-slate-900 text-white shadow-md"
                              : "border-slate-200 bg-slate-50 text-slate-600",
                          ].join(" ")}
                        >
                          {color}
                        </button>
                      ))
                    ) : (
                      <span className="text-[9px] font-semibold text-slate-400">
                        Bu model için özel renk çarpanı bulunmuyor.
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* EKSPERTİZ */}
              <div>
                <div className="mb-3 flex items-end justify-between">
                  <div>
                    <h4 className="text-[16px] font-black text-slate-950">Ekspertiz Soruları</h4>
                    <p className="text-[8px] font-semibold text-slate-400">
                      Tüm kontroller tamamlandığında teklif aktif olur.
                    </p>
                  </div>
                  <span className={`rounded-full px-3 py-1.5 text-[8px] font-black ${selectedQuestionCount === 8 ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"}`}>
                    {selectedQuestionCount}/8
                  </span>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  {expertQuestions.map((question) => (
                    <QuestionCard
                      key={question.field}
                      label={question.label}
                      field={question.field}
                      options={question.options}
                      status={status}
                      setStatus={setStatus}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* STICKY SAĞ PANEL */}
            <aside className="h-fit space-y-3 xl:sticky xl:top-[116px]">
              <div className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-[0_8px_26px_rgba(15,23,42,0.06)]">
                <div className="flex items-center gap-3">
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-slate-50 p-2">
                    {selectedDevice?.img ? (
                      <img
                        src={selectedDevice.img}
                        alt={selectedModelName}
                        className="max-h-full max-w-full object-contain"
                      />
                    ) : (
                      <PhoneIcon className={`h-8 w-8 ${accentText}`} />
                    )}
                  </div>

                  <div className="min-w-0">
                    <span className={`text-[8px] font-black uppercase ${accentText}`}>
                      {selectedBrand}
                    </span>
                    <h4 className="mt-1 line-clamp-2 text-[14px] font-black uppercase leading-4 text-slate-950">
                      {selectedModelName}
                    </h4>
                    <p className="mt-1 text-[9px] font-bold text-slate-400">
                      {selectedCapacity?.cap || "Hafıza seçilmedi"}
                      {selectedModelName === "iPhone 13" && selectedColor !== "Diğer"
                        ? ` • ${selectedColor}`
                        : ""}
                    </p>
                  </div>
                </div>
              </div>

              {isYd ? (
                <div className="rounded-[26px] border-2 border-red-400 bg-red-50 p-6 text-center shadow-sm">
                  <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-red-100 text-xl">
                    ⚠️
                  </div>
                  <p className="mt-3 text-[17px] font-black uppercase text-red-700">
                    Yurt Dışı Cihaz
                  </p>
                  <p className="mt-2 text-[8px] font-black uppercase tracking-[0.1em] text-red-500">
                    Yönetici onayı gereklidir
                  </p>
                </div>
              ) : (
                <>
                  <div className="rounded-[26px] border border-slate-200 bg-white p-5 text-center shadow-sm">
                    <p className="text-[8px] font-black uppercase tracking-[0.1em] text-slate-400">
                      Nakit Alış Teklifi
                    </p>

                    <div className="mt-3 text-[31px] font-black tracking-[-0.05em] text-slate-950">
                      {selectedCapacity && allSelected ? <Money value={finalCashPrice} /> : "---"}
                    </div>

                    {selectedCapacity && allSelected && !purchaseType && (
                      <div className="mt-4">
                        {!isCustomOfferActive ? (
                          <button
                            type="button"
                            onClick={() => setIsCustomOfferActive(true)}
                            className={`rounded-xl border px-4 py-2 text-[8px] font-black uppercase ${accentText} ${accentBorder} ${accentLight}`}
                          >
                            Teklifi Revize Et
                          </button>
                        ) : (
                          <div className="flex items-center justify-center gap-2">
                            <input
                              type="number"
                              value={customOffer}
                              onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                                const value = event.target.value;
                                if (value === "") {
                                  setCustomOffer("");
                                  return;
                                }

                                const numeric = parseInt(value, 10) || 0;
                                if (numeric > prices.cash) {
                                  alert(`Sistem teklifinden (${prices.cash} TL) yüksek bir fiyat giremezsiniz!`);
                                  setCustomOffer(prices.cash.toString());
                                } else {
                                  setCustomOffer(value);
                                }
                              }}
                              placeholder="Yeni Tutar"
                              className={`h-10 w-28 rounded-xl border border-slate-200 bg-slate-50 px-2 text-center text-[10px] font-black outline-none focus:ring-4 ${accentFocus}`}
                            />
                            <button
                              type="button"
                              onClick={() => {
                                setIsCustomOfferActive(false);
                                setCustomOffer("");
                              }}
                              className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-600 hover:bg-red-100"
                            >
                              ×
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className={`rounded-[26px] p-5 text-center text-white shadow-xl ${accentBg}`}>
                    <p className="text-[8px] font-black uppercase tracking-[0.1em] text-white/65">
                      Takas Desteği İle
                    </p>

                    <div className="mt-3 text-[31px] font-black tracking-[-0.05em]">
                      {selectedCapacity && allSelected ? <Money value={finalTradePrice} /> : "---"}
                    </div>

                    {selectedCapacity && allSelected && !purchaseType && (
                      <div className="mt-4">
                        {!isCustomTradeOfferActive ? (
                          <button
                            type="button"
                            onClick={() => setIsCustomTradeOfferActive(true)}
                            className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-[8px] font-black uppercase text-white hover:bg-white/15"
                          >
                            Teklifi Revize Et
                          </button>
                        ) : (
                          <div className="flex items-center justify-center gap-2">
                            <input
                              type="number"
                              value={customTradeOffer}
                              onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                                const value = event.target.value;
                                if (value === "") {
                                  setCustomTradeOffer("");
                                  return;
                                }

                                const numeric = parseInt(value, 10) || 0;
                                if (numeric > calculatedTradePrice) {
                                  alert(`Sistem teklifinden (${calculatedTradePrice} TL) yüksek bir fiyat giremezsiniz!`);
                                  setCustomTradeOffer(calculatedTradePrice.toString());
                                } else {
                                  setCustomTradeOffer(value);
                                }
                              }}
                              placeholder="Yeni Tutar"
                              className="h-10 w-28 rounded-xl border border-white/20 bg-black/10 px-2 text-center text-[10px] font-black text-white outline-none placeholder:text-white/50"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                setIsCustomTradeOfferActive(false);
                                setCustomTradeOffer("");
                              }}
                              className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900/50 text-white"
                            >
                              ×
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}

              <div className="rounded-[26px] bg-slate-950 p-5 shadow-xl">
                <p className="text-center text-[8px] font-black uppercase tracking-[0.1em] text-slate-400">
                  1. İşlem Türünü Seçin
                </p>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={!canProceed || purchaseType !== null}
                    onClick={() => {
                      setPurchaseType("NAKİT");
                      handleFinalProcess("NAKİT ALINDI");
                    }}
                    className={[
                      "h-11 rounded-xl text-[9px] font-black uppercase transition",
                      purchaseType === "NAKİT"
                        ? "bg-emerald-500 text-white"
                        : canProceed && !purchaseType
                        ? "bg-slate-800 text-slate-200 hover:bg-emerald-500 hover:text-white"
                        : "cursor-not-allowed bg-slate-800 text-slate-600 opacity-40",
                    ].join(" ")}
                  >
                    Nakit
                  </button>

                  <button
                    type="button"
                    disabled={!canProceed || purchaseType !== null}
                    onClick={() => {
                      setPurchaseType("TAKAS");
                      handleFinalProcess("TAKAS ALINDI");
                    }}
                    className={[
                      "h-11 rounded-xl text-[9px] font-black uppercase transition",
                      purchaseType === "TAKAS"
                        ? `${accentBg} text-white`
                        : canProceed && !purchaseType
                        ? `bg-slate-800 text-slate-200 ${accentHover} hover:text-white`
                        : "cursor-not-allowed bg-slate-800 text-slate-600 opacity-40",
                    ].join(" ")}
                  >
                    Takas
                  </button>
                </div>

                <button
                  type="button"
                  disabled={!canProceed || purchaseType !== null}
                  onClick={() => {
                    setPurchaseType("ALINMADI");
                    handleFinalProcess("ALINMADI");
                  }}
                  className={[
                    "mt-2 h-10 w-full rounded-xl text-[9px] font-black uppercase transition",
                    purchaseType === "ALINMADI"
                      ? "bg-red-500 text-white"
                      : canProceed && !purchaseType
                      ? "bg-slate-800 text-red-400 hover:bg-red-500 hover:text-white"
                      : "cursor-not-allowed bg-slate-800 text-slate-600 opacity-40",
                  ].join(" ")}
                >
                  Alınmadı
                </button>

                <div className={`mt-5 border-t border-slate-800 pt-4 transition ${showDocs ? "opacity-100" : "pointer-events-none opacity-25"}`}>
                  <p className="text-center text-[8px] font-black uppercase tracking-[0.1em] text-slate-400">
                    2. Belge ve Bildirim
                  </p>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={!showDocs}
                      onClick={() => handleFinalProcess("print")}
                      className="h-11 rounded-xl bg-white text-[9px] font-black uppercase text-slate-950 hover:bg-slate-200 disabled:bg-slate-800 disabled:text-slate-600"
                    >
                      Yazdır
                    </button>

                    <button
                      type="button"
                      disabled={!showDocs}
                      onClick={() => handleFinalProcess("whatsapp")}
                      className="h-11 rounded-xl bg-[#25D366] text-[9px] font-black uppercase text-white hover:bg-[#128C7E] disabled:bg-slate-800 disabled:text-slate-600"
                    >
                      WhatsApp
                    </button>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </section>
      )}
    </div>
  );
}
