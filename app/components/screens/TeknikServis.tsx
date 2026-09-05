"use client";

import React, { useMemo, useRef, useState } from "react";

type ServicePrice = {
  ekran?: string;
  ekranOrj?: string;
  ekranOled?: string;
  ekranCipli?: string;
  batarya?: string;
  arkaCam?: string;
  kasa?: string;
};

type TeknikServisProps = {
  brands: string[];
  brandDb: any[];
  brandAssets: Record<string, any>;
  devices: any[];
  prices: Record<string, ServicePrice>;
  branches: Array<{ name: string; phone?: string }>;
  selectedBranch: string;
};

function normalizeText(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLocaleUpperCase("tr-TR")
    .replace(/\s+/g, " ");
}

function money(value: unknown) {
  const text = String(value ?? "").trim();
  if (!text) return "-";

  const number = Number(text.replace(/[^\d.,-]/g, "").replace(/\./g, "").replace(",", "."));
  if (Number.isFinite(number) && number > 0) {
    return `${number.toLocaleString("tr-TR", { maximumFractionDigits: 0 })} TL`;
  }

  return text.toLocaleUpperCase("tr-TR").includes("TL") ? text : `${text} TL`;
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

function WrenchIcon({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M14.7 6.3a4 4 0 01-5 5L4 17l3 3 5.7-5.7a4 4 0 005-5l-2.2 2.2-3-3 2.2-2.2z"
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

function ServiceCard({
  icon,
  title,
  children,
  accent = "orange",
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  accent?: "orange" | "amber" | "blue" | "slate";
}) {
  const tone =
    accent === "amber"
      ? "bg-amber-50 text-amber-600 border-amber-100"
      : accent === "blue"
      ? "bg-blue-50 text-blue-600 border-blue-100"
      : accent === "slate"
      ? "bg-slate-100 text-slate-600 border-slate-200"
      : "bg-orange-50 text-orange-600 border-orange-100";

  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_7px_22px_rgba(15,23,42,0.05)] transition hover:-translate-y-0.5 hover:shadow-lg">
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-2xl border ${tone}`}>
          {icon}
        </div>
        <div className="text-[10px] font-black uppercase tracking-[0.08em] text-slate-500">
          {title}
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </div>
  );
}

export default function TeknikServis({
  brands,
  brandDb,
  brandAssets,
  devices,
  prices,
  branches,
  selectedBranch,
}: TeknikServisProps) {
  const searchRef = useRef<HTMLInputElement | null>(null);

  const [screenStep, setScreenStep] = useState<1 | 2 | 3>(1);
  const [selectedBrand, setSelectedBrand] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [search, setSearch] = useState("");

  const serviceBrands = useMemo(
    () =>
      Array.from(
        new Set(
          (Array.isArray(brands) ? brands : [])
            .map((brand) => String(brand || "").trim())
            .filter(Boolean)
        )
      ),
    [brands]
  );

  const models = useMemo(() => {
    const query = normalizeText(search);

    return Array.from(
      new Set(
        (Array.isArray(devices) ? devices : [])
          .filter((item) => String(item?.brand || "") === selectedBrand)
          .map((item) => String(item?.name || "").trim())
          .filter(Boolean)
      )
    )
      .filter((name) => !query || normalizeText(name).includes(query))
      .sort((a, b) => a.localeCompare(b, "tr"));
  }, [devices, selectedBrand, search]);

  const currentPrice = prices?.[selectedModel] || {};
  const selectedDevice = (Array.isArray(devices) ? devices : []).find(
    (item) => String(item?.name || "") === selectedModel
  );

  const branch =
    (Array.isArray(branches) ? branches : []).find(
      (item) => item.name === selectedBranch
    ) || branches?.[0];

  function getBrandLogo(brand: string) {
    const dynamicLogo = brandDb?.find((item) => item?.name === brand)?.logo;
    return dynamicLogo || brandAssets?.[brand]?.logo || "";
  }

  function goBrands() {
    setScreenStep(1);
    setSelectedBrand("");
    setSelectedModel("");
    setSearch("");
  }

  function goModels() {
    setScreenStep(2);
    setSelectedModel("");
    setSearch("");
  }

  function chooseBrand(brand: string) {
    setSelectedBrand(brand);
    setSelectedModel("");
    setSearch("");
    setScreenStep(2);
  }

  function chooseModel(model: string) {
    setSelectedModel(model);
    setSearch("");
    setScreenStep(3);
  }

  function sendWhatsapp() {
    if (!selectedModel) return;

    const sFiyat = prices?.[selectedModel];
    if (!sFiyat) {
      alert("Bu cihaz için fiyat girilmemiş.");
      return;
    }

    const originalScreen = sFiyat.ekranOrj || sFiyat.ekran || "-";

    let screenText =
      `📱 Ekran (Orijinal): ${
        originalScreen !== "-" ? `${originalScreen} TL` : "-"
      }%0A` +
      `📱 Ekran (OLED): ${
        sFiyat.ekranOled ? `${sFiyat.ekranOled} TL` : "-"
      }`;

    if (selectedBrand.toLocaleLowerCase("tr-TR") === "apple") {
      screenText += `%0A📱 Ekran (Çipli): ${
        sFiyat.ekranCipli ? `${sFiyat.ekranCipli} TL` : "-"
      }`;
    }

    const message =
      `🔧 *CMR TEKNİK SERVİS TEKLİFİ*%0A` +
      `📱 *Cihaz:* ${selectedModel}%0A%0A` +
      `*Onarım Fiyatları:*%0A` +
      `${screenText}%0A` +
      `🔋 Batarya Değişimi: ${sFiyat.batarya || "-"} TL%0A` +
      `💠 Arka Cam Değişimi: ${sFiyat.arkaCam || "-"} TL%0A` +
      `🛠 Kasa Değişimi: ${sFiyat.kasa || "-"} TL%0A%0A` +
      `🕒 _Fiyatlarımız anlık olup değişkenlik gösterebilir._`;

    window.open(`https://wa.me/${branch?.phone || ""}?text=${message}`, "_blank");
  }

  return (
    <div className="animate-in fade-in duration-300">
      {/* HERO */}
      <section className="overflow-hidden rounded-[26px] border border-orange-100 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.055)]">
        <div className="grid min-h-[122px] lg:grid-cols-[1.25fr_0.75fr]">
          <div className="flex flex-col justify-center px-7 py-5 sm:px-8">
            <div className="text-[8px] font-black uppercase tracking-[0.2em] text-orange-600">
              CNETMOBİL V2
            </div>

            <h2 className="mt-2 text-[28px] font-black tracking-[-0.045em] text-slate-950 sm:text-[31px]">
              Teknik Servis Merkezi
            </h2>

            <p className="mt-2 text-[10px] font-semibold text-slate-400">
              Marka ve modeli seçin, güncel ekran, batarya, arka cam ve kasa değişim fiyatlarını görüntüleyin.
            </p>
          </div>

          <div className="relative hidden overflow-hidden bg-gradient-to-r from-[#fff7ed] via-[#ffedd5] to-[#fed7aa] lg:block">
            <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-white to-transparent" />

            <div className="absolute left-[13%] top-1/2 z-10 flex -translate-y-1/2 items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/80 text-orange-600 shadow-sm">
                <WrenchIcon />
              </div>
              <div className="text-[10px] font-black leading-[1.5] text-orange-700">
                Hızlı Servis
                <br />
                Güncel Fiyat
                <br />
                Tek Ekranda
              </div>
            </div>

            <div className="absolute bottom-[-20px] right-[9%] h-[108px] w-[68px] rotate-[7deg] rounded-[15px] border-[6px] border-slate-800 bg-gradient-to-br from-slate-100 via-orange-200 to-orange-500 shadow-2xl">
              <div className="mx-auto mt-1 h-1.5 w-6 rounded-full bg-slate-800" />
            </div>

            <div className="absolute bottom-[16px] right-[28%] flex h-[58px] w-[58px] -rotate-[9deg] items-center justify-center rounded-2xl bg-white/85 text-orange-600 shadow-xl">
              <WrenchIcon className="h-7 w-7" />
            </div>
          </div>
        </div>

        <div className="grid gap-2 border-t border-orange-50 bg-[#fffaf5] p-3 sm:grid-cols-3">
          <div className="flex min-h-[72px] items-center gap-3 rounded-[18px] border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-orange-50 text-orange-600">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h10" />
              </svg>
            </div>
            <div>
              <p className="text-[7px] font-black uppercase tracking-[0.1em] text-slate-400">
                Marka
              </p>
              <p className="text-[18px] font-black text-slate-950">
                {serviceBrands.length}
              </p>
              <p className="text-[8px] font-semibold text-slate-400">
                Servis markası
              </p>
            </div>
          </div>

          <div className="flex min-h-[72px] items-center gap-3 rounded-[18px] border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
              <PhoneIcon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[7px] font-black uppercase tracking-[0.1em] text-slate-400">
                Cihaz Modeli
              </p>
              <p className="text-[18px] font-black text-slate-950">
                {Array.from(new Set((devices || []).map((item) => item?.name).filter(Boolean))).length}
              </p>
              <p className="text-[8px] font-semibold text-slate-400">
                Tanımlı cihaz
              </p>
            </div>
          </div>

          <div className="flex min-h-[72px] items-center gap-3 rounded-[18px] border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="text-[7px] font-black uppercase tracking-[0.1em] text-slate-400">
                Fiyat Listesi
              </p>
              <p className="text-[15px] font-black text-slate-950">Güncel</p>
              <p className="text-[8px] font-semibold text-slate-400">
                Servis_Fiyatlari
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ADIM GÖSTERGESİ */}
      <div className="mt-4 flex items-center gap-2 overflow-x-auto rounded-[20px] border border-slate-200 bg-white px-4 py-3 shadow-sm">
        {[
          [1, "Marka Seçimi"],
          [2, "Model Seçimi"],
          [3, "Servis Fiyatları"],
        ].map(([number, label], index) => {
          const current = screenStep === number;
          const done = screenStep > Number(number);

          return (
            <React.Fragment key={number}>
              <button
                type="button"
                onClick={() => {
                  if (Number(number) === 1) goBrands();
                  if (Number(number) === 2 && selectedBrand) goModels();
                }}
                disabled={Number(number) === 3 || (Number(number) === 2 && !selectedBrand)}
                className="flex shrink-0 items-center gap-2 disabled:cursor-default"
              >
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-xl text-[9px] font-black ${
                    current
                      ? "bg-orange-600 text-white"
                      : done
                      ? "bg-emerald-50 text-emerald-600"
                      : "bg-slate-100 text-slate-400"
                  }`}
                >
                  {done ? "✓" : number}
                </span>
                <span
                  className={`text-[9px] font-black ${
                    current ? "text-slate-900" : "text-slate-400"
                  }`}
                >
                  {label}
                </span>
              </button>

              {index < 2 && <div className="h-px min-w-8 flex-1 bg-slate-200" />}
            </React.Fragment>
          );
        })}
      </div>

      {/* ADIM 1 */}
      {screenStep === 1 && (
        <section className="mt-4">
          <div className="mb-4">
            <h3 className="text-[20px] font-black tracking-[-0.03em] text-slate-950">
              Servis Markasını Seçin
            </h3>
            <p className="mt-1 text-[10px] font-semibold text-slate-400">
              İşlem yapılacak cihazın markasını seçin.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {serviceBrands.map((brand) => {
              const logo = getBrandLogo(brand);

              return (
                <button
                  type="button"
                  key={brand}
                  onClick={() => chooseBrand(brand)}
                  className="group flex min-h-[150px] flex-col items-center justify-center rounded-[24px] border border-slate-200 bg-white p-5 text-center shadow-[0_6px_20px_rgba(15,23,42,0.04)] transition hover:-translate-y-1 hover:border-orange-200 hover:shadow-lg"
                >
                  <div className="flex h-16 w-full items-center justify-center">
                    {logo ? (
                      <img
                        src={logo}
                        alt={brand}
                        className="max-h-11 max-w-[100px] object-contain transition group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-50 text-sm font-black text-orange-600">
                        {brand.slice(0, 2).toLocaleUpperCase("tr-TR")}
                      </div>
                    )}
                  </div>

                  <div className="mt-3 text-[12px] font-black uppercase tracking-[-0.02em] text-slate-900">
                    {brand}
                  </div>
                  <div className="mt-1 text-[8px] font-black uppercase tracking-[0.08em] text-orange-500">
                    Servis İşlemleri
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* ADIM 2 */}
      {screenStep === 2 && (
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
              <div className="text-[8px] font-black uppercase tracking-[0.12em] text-orange-600">
                {selectedBrand}
              </div>
              <div className="text-[18px] font-black tracking-[-0.03em] text-slate-950">
                Model Seçimi
              </div>
            </div>
          </div>

          <div className="sticky top-[104px] z-30 mt-4 rounded-[20px] border border-slate-200 bg-white/95 p-3 shadow-[0_8px_24px_rgba(15,23,42,0.07)] backdrop-blur">
            <div className="relative">
              <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-orange-500">
                <SearchIcon />
              </div>
              <input
                ref={searchRef}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Modellerde ara..."
                className="h-[48px] w-full rounded-2xl border border-slate-200 bg-slate-50 pl-12 pr-4 text-[11px] font-bold text-slate-800 outline-none placeholder:text-slate-400 focus:border-orange-400 focus:bg-white focus:ring-4 focus:ring-orange-50"
              />
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {models.length === 0 ? (
              <div className="col-span-full flex min-h-[220px] items-center justify-center rounded-[24px] border border-slate-200 bg-white text-center">
                <div>
                  <SearchIcon className="mx-auto h-6 w-6 text-slate-300" />
                  <p className="mt-2 text-[10px] font-black text-slate-600">
                    Model bulunamadı
                  </p>
                </div>
              </div>
            ) : (
              models.map((model) => {
                const device = devices.find((item) => item?.name === model);

                return (
                  <button
                    type="button"
                    key={model}
                    onClick={() => chooseModel(model)}
                    className="group flex min-h-[190px] flex-col items-center justify-between rounded-[24px] border border-slate-200 bg-white p-4 text-center shadow-[0_6px_20px_rgba(15,23,42,0.04)] transition hover:-translate-y-1 hover:border-orange-200 hover:shadow-lg"
                  >
                    <div className="flex h-[110px] w-full items-center justify-center">
                      {device?.img ? (
                        <img
                          src={device.img}
                          alt={model}
                          className="max-h-full max-w-full object-contain drop-shadow-md transition group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-50 text-orange-500">
                          <PhoneIcon />
                        </div>
                      )}
                    </div>

                    <div className="w-full">
                      <div className="line-clamp-2 text-[10px] font-black uppercase leading-4 text-slate-900">
                        {model}
                      </div>
                      <div className="mt-1 text-[8px] font-black uppercase tracking-[0.08em] text-orange-500">
                        Servis Seçenekleri
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </section>
      )}

      {/* ADIM 3 */}
      {screenStep === 3 && (
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
              <div className="text-[8px] font-black uppercase tracking-[0.12em] text-orange-600">
                {selectedBrand}
              </div>
              <div className="text-[18px] font-black tracking-[-0.03em] text-slate-950">
                Servis Fiyatları
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_310px]">
            <div className="space-y-4">
              <div className="flex flex-col gap-5 rounded-[26px] border border-orange-100 bg-gradient-to-r from-white to-orange-50/60 p-5 shadow-sm sm:flex-row sm:items-center">
                <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-[22px] border border-orange-100 bg-white p-3">
                  {selectedDevice?.img ? (
                    <img
                      src={selectedDevice.img}
                      alt={selectedModel}
                      className="max-h-full max-w-full object-contain drop-shadow-md"
                    />
                  ) : (
                    <PhoneIcon className="h-10 w-10 text-orange-400" />
                  )}
                </div>

                <div>
                  <span className="rounded-lg bg-orange-100 px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.1em] text-orange-700">
                    {selectedBrand}
                  </span>
                  <h3 className="mt-3 text-[25px] font-black uppercase tracking-[-0.04em] text-slate-950">
                    {selectedModel}
                  </h3>
                  <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.1em] text-orange-500">
                    Teknik Servis Onarım Fiyatları
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <ServiceCard
                  icon={<PhoneIcon className="h-5 w-5" />}
                  title="Ekran Değişimi"
                  accent="orange"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-2">
                      <span className="text-[8px] font-black uppercase text-slate-400">
                        Orijinal
                      </span>
                      <span className="text-[11px] font-black text-slate-950">
                        {money(currentPrice.ekranOrj || currentPrice.ekran)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-2">
                      <span className="text-[8px] font-black uppercase text-slate-400">
                        OLED
                      </span>
                      <span className="text-[11px] font-black text-slate-950">
                        {money(currentPrice.ekranOled)}
                      </span>
                    </div>

                    {selectedBrand.toLocaleLowerCase("tr-TR") === "apple" && (
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[8px] font-black uppercase text-slate-400">
                          Çipli
                        </span>
                        <span className="text-[11px] font-black text-slate-950">
                          {money(currentPrice.ekranCipli)}
                        </span>
                      </div>
                    )}
                  </div>
                </ServiceCard>

                <ServiceCard
                  icon={<span className="text-xl">🔋</span>}
                  title="Batarya Değişimi"
                  accent="amber"
                >
                  <div className="text-[22px] font-black tracking-[-0.04em] text-slate-950">
                    {money(currentPrice.batarya)}
                  </div>
                </ServiceCard>

                <ServiceCard
                  icon={<span className="text-xl">💠</span>}
                  title="Arka Cam"
                  accent="blue"
                >
                  <div className="text-[22px] font-black tracking-[-0.04em] text-slate-950">
                    {money(currentPrice.arkaCam)}
                  </div>
                </ServiceCard>

                <ServiceCard
                  icon={<WrenchIcon className="h-5 w-5" />}
                  title="Kasa Değişimi"
                  accent="slate"
                >
                  <div className="text-[22px] font-black tracking-[-0.04em] text-slate-950">
                    {money(currentPrice.kasa)}
                  </div>
                </ServiceCard>
              </div>
            </div>

            <aside className="h-fit rounded-[26px] border border-slate-200 bg-white p-5 shadow-[0_8px_26px_rgba(15,23,42,0.06)] xl:sticky xl:top-[116px]">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.5 3.5A11.8 11.8 0 0012.1 0C5.5 0 .2 5.3.2 11.9c0 2.1.6 4.2 1.6 6L0 24l6.3-1.7a12 12 0 005.8 1.5h.1c6.6 0 11.9-5.3 11.9-11.9 0-3.2-1.3-6.2-3.6-8.4z" />
                </svg>
              </div>

              <h4 className="mt-4 text-[18px] font-black tracking-[-0.03em] text-slate-950">
                Müşteriye İlet
              </h4>

              <p className="mt-2 text-[9px] font-semibold leading-4 text-slate-400">
                Seçili cihazın güncel servis fiyatlarını WhatsApp üzerinden paylaşın.
              </p>

              <div className="mt-4 rounded-2xl bg-slate-50 p-3">
                <div className="text-[7px] font-black uppercase tracking-[0.1em] text-slate-400">
                  Aktif Mağaza
                </div>
                <div className="mt-1 text-[10px] font-black text-slate-800">
                  {selectedBranch}
                </div>
              </div>

              <button
                type="button"
                onClick={sendWhatsapp}
                className="mt-4 flex h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-[#25D366] px-4 text-[9px] font-black uppercase tracking-[0.08em] text-white shadow-lg shadow-emerald-900/10 transition hover:bg-[#128C7E]"
              >
                WhatsApp'tan Gönder
              </button>
            </aside>
          </div>
        </section>
      )}

      {screenStep !== 1 && (
        <button
          type="button"
          title="Hızlı Ara"
          onClick={() => {
            if (screenStep === 3) {
              goModels();
              window.setTimeout(() => searchRef.current?.focus(), 0);
              return;
            }

            searchRef.current?.focus();
            searchRef.current?.scrollIntoView({
              behavior: "smooth",
              block: "center",
            });
          }}
          className="fixed bottom-[88px] right-[74px] z-40 flex h-[54px] w-[54px] items-center justify-center rounded-full bg-orange-600 text-white shadow-[0_13px_30px_rgba(234,88,12,0.35)] transition hover:scale-105 hover:bg-orange-700 max-sm:right-5"
        >
          <SearchIcon className="h-6 w-6" />
        </button>
      )}
    </div>
  );
}
