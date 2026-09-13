"use client";

import React, {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

type Model =
  | "iPhone 18 Pro"
  | "iPhone 18 Pro Max"
  | "iPhone Duo";

type Storage =
  | "256 GB"
  | "512 GB"
  | "1 TB"
  | "2 TB";

type ColorItem = {
  name: string;
  value: string;
};

const MODELS: Model[] = [
  "iPhone 18 Pro",
  "iPhone 18 Pro Max",
  "iPhone Duo",
];

const STORAGES: Storage[] = [
  "256 GB",
  "512 GB",
  "1 TB",
  "2 TB",
];

const PRICES: Record<
  Model,
  Record<Storage, number>
> = {
  "iPhone 18 Pro": {
    "256 GB": 137999,
    "512 GB": 154999,
    "1 TB": 188999,
    "2 TB": 243999,
  },

  "iPhone 18 Pro Max": {
    "256 GB": 149999,
    "512 GB": 166999,
    "1 TB": 200999,
    "2 TB": 255999,
  },

  "iPhone Duo": {
    "256 GB": 229999,
    "512 GB": 246999,
    "1 TB": 280999,
    "2 TB": 335999,
  },
};

const COLORS: Record<
  Model,
  ColorItem[]
> = {
  "iPhone 18 Pro": [
    {
      name: "Siyah",
      value: "#15171b",
    },
    {
      name: "Buzul Rengi",
      value: "#94bdf0",
    },
    {
      name: "Burgonya",
      value: "#722c50",
    },
    {
      name: "Gümüş Rengi",
      value: "#d8d9dc",
    },
  ],

  "iPhone 18 Pro Max": [
    {
      name: "Siyah",
      value: "#15171b",
    },
    {
      name: "Buzul Rengi",
      value: "#94bdf0",
    },
    {
      name: "Burgonya",
      value: "#722c50",
    },
    {
      name: "Gümüş Rengi",
      value: "#d8d9dc",
    },
  ],

  "iPhone Duo": [
    {
      name: "Gece Rengi",
      value: "#10151d",
    },
    {
      name: "Yıldız Rengi",
      value: "#e0d9cc",
    },
  ],
};

const STORES = [
  "CMR / Çerkezköy",
  "Cadde / Çerkezköy",
  "Saray",
  "Kapaklı",
];

const DEPOSIT = 5000;

const DUO_START =
  Date.UTC(
    2026,
    9,
    16,
    12,
    0,
    0
  );

function money(
  value: number
) {
  return new Intl.NumberFormat(
    "tr-TR",
    {
      style: "currency",
      currency: "TRY",
      maximumFractionDigits: 0,
    }
  ).format(value);
}

export default function Iphone18PreorderPage() {
  const [model, setModel] =
    useState<Model>(
      "iPhone 18 Pro"
    );

  const [storage, setStorage] =
    useState<Storage>(
      "256 GB"
    );

  const [color, setColor] =
    useState("Siyah");

  const [store, setStore] =
    useState("");

  const [name, setName] =
    useState("");

  const [phone, setPhone] =
    useState("");

  const [note, setNote] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  const [
    duoOpen,
    setDuoOpen,
  ] = useState(false);

  useEffect(() => {
    setDuoOpen(
      Date.now() >=
        DUO_START
    );
  }, []);

  const colors =
    COLORS[model];

  const price =
    PRICES[model][storage];

  const isDuo =
    model === "iPhone Duo";

  const isPreRequest =
    isDuo && !duoOpen;

  const selectedColor =
    colors.find(
      (item) =>
        item.name === color
    ) || colors[0];

  const description =
    useMemo(() => {
      if (
        model ===
        "iPhone 18 Pro Max"
      ) {
        return "Daha büyük. Daha güçlü.";
      }

      if (
        model ===
        "iPhone Duo"
      ) {
        return "Yeni bir dönemin başlangıcı.";
      }

      return "Profesyoneller için.";
    }, [model]);

  function selectModel(
    value: Model
  ) {
    setModel(value);

    setColor(
      COLORS[value][0].name
    );

    setError("");
    setSuccess("");
  }

  async function submit(
    event: FormEvent
  ) {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!store) {
      setError(
        "Teslim mağazasını seçin."
      );
      return;
    }

    if (
      name.trim().length < 3
    ) {
      setError(
        "Ad soyad bilginizi girin."
      );
      return;
    }

    if (
      phone.replace(
        /\D/g,
        ""
      ).length < 10
    ) {
      setError(
        "Geçerli telefon numarası girin."
      );
      return;
    }

    try {
      setLoading(true);

      const response =
        await fetch(
          "/api/iphone18-preorder",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                model,
                storage,
                color,
                store,
                customerName:
                  name,
                phone,
                note,
              }),
          }
        );

      const data =
        await response
          .json()
          .catch(
            () => ({})
          );

      if (
        !response.ok ||
        !data?.success
      ) {
        throw new Error(
          data?.error ||
            "Talep gönderilemedi."
        );
      }

      setSuccess(
        data.message ||
          "Talebiniz alındı."
      );
    } catch (err: any) {
      setError(
        err?.message ||
          "Bir hata oluştu."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#02060d] text-white">

      {/* NAVBAR */}

      <header className="relative z-50 border-b border-white/[0.08] bg-[#02060d]/95 backdrop-blur-xl">
        <div className="mx-auto flex h-[70px] max-w-[1500px] items-center justify-between px-5 lg:px-8">

          <a
            href="/cihaz-sat"
            className="text-[26px] font-black tracking-[-1.6px]"
          >
            CNET
            <span className="font-medium text-[#4ea7ff]">
              MOBİL
            </span>
          </a>

          <nav className="hidden items-center gap-9 text-[12px] font-bold text-slate-300 lg:flex">

            <a
              href="/cihaz-sat"
              className="transition hover:text-white"
            >
              Cihaz Sat
            </a>

            <a
              href="#modeller"
              className="transition hover:text-white"
            >
              Modeller
            </a>

            <a
              href="#siparis"
              className="transition hover:text-white"
            >
              Ön Sipariş
            </a>

            <a
              href="#avantajlar"
              className="transition hover:text-white"
            >
              Avantajlar
            </a>
          </nav>

          <a
            href="#siparis"
            className="rounded-xl border border-blue-400/30 bg-blue-500/10 px-5 py-3 text-[11px] font-black text-blue-100 transition hover:bg-blue-500/20"
          >
            Ön Sipariş Ver
          </a>
        </div>
      </header>

      {/* HERO */}

      <section className="relative min-h-[800px] overflow-hidden">

        {/* ARKA PLAN */}

        <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_25%,rgba(36,116,255,.38),transparent_31%),radial-gradient(circle_at_22%_85%,rgba(78,47,180,.20),transparent_30%),linear-gradient(115deg,#02060d_0%,#08152b_55%,#02060d_100%)]" />

        {/* GEZEGEN */}

        <div className="absolute -right-[290px] -top-[580px] h-[1180px] w-[1180px] rounded-full border-[2px] border-blue-300/25 shadow-[0_0_95px_rgba(69,134,255,.40)]" />

        <div className="absolute right-[8%] top-[16%] h-[380px] w-[720px] bg-blue-500/15 blur-[130px]" />

        {/* DAĞ EFEKTİ */}

        <div
          className="absolute bottom-0 left-0 h-[230px] w-[48%] bg-[#07101c]/90"
          style={{
            clipPath:
              "polygon(0 72%, 13% 55%, 24% 69%, 36% 36%, 48% 65%, 61% 43%, 75% 70%, 88% 48%, 100% 72%, 100% 100%, 0 100%)",
          }}
        />

        <div
          className="absolute bottom-0 right-0 h-[245px] w-[45%] bg-[#06101d]/90"
          style={{
            clipPath:
              "polygon(0 71%, 15% 45%, 29% 66%, 43% 35%, 58% 65%, 72% 48%, 88% 70%, 100% 58%, 100% 100%, 0 100%)",
          }}
        />

        <div className="absolute bottom-0 left-0 right-0 h-[180px] bg-gradient-to-t from-[#02060d] via-[#02060d]/80 to-transparent" />

        <div className="relative mx-auto grid max-w-[1500px] gap-8 px-5 pt-14 lg:grid-cols-[0.92fr_1.08fr] lg:px-8">

          {/* HERO TEXT */}

          <div className="relative z-20 pt-4">

            <div className="text-[11px] font-black uppercase tracking-[0.42em] text-blue-200/75">
              DAHA FAZLASI SENİN ELİNDE
            </div>

            <h1 className="mt-5 max-w-[650px] text-[55px] font-black leading-[0.95] tracking-[-3px] sm:text-[70px] xl:text-[78px]">

              Yeni Seri

              <span className="block bg-gradient-to-r from-[#71c1ff] via-[#84a0ff] to-[#b87cff] bg-clip-text text-transparent">
                Ön Siparişe Açıldı
              </span>
            </h1>

            <h2 className="mt-6 text-[27px] font-black tracking-[-0.8px]">
              iPhone 18 Pro & Pro Max
            </h2>

            <p className="mt-3 max-w-[560px] text-[15px] font-medium leading-7 text-slate-400">
              Yeni renkler, güçlü
              performans, sınırlı
              ön sipariş avantajları.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">

              <a
                href="#siparis"
                className="flex h-[54px] items-center gap-5 rounded-full bg-white px-8 text-[13px] font-black text-[#07101c] shadow-xl transition hover:-translate-y-1"
              >
                Ön Sipariş Ver

                <span className="text-xl">
                  →
                </span>
              </a>

              <a
                href="#renkler"
                className="flex h-[54px] items-center gap-4 rounded-full border border-white/20 bg-white/[0.04] px-8 text-[13px] font-black transition hover:bg-white/10"
              >
                Renkleri İncele

                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-500 text-[10px]">
                  ▶
                </span>
              </a>
            </div>

            {/* AVANTAJ */}

            <div
              id="avantajlar"
              className="mt-9 grid max-w-[620px] grid-cols-2 gap-4 md:grid-cols-4"
            >

              {[
                [
                  "🎁",
                  "Sınırlı Ön Sipariş",
                  "Avantajları",
                ],

                [
                  "🚚",
                  "Hızlı",
                  "Bilgilendirme",
                ],

                [
                  "🛡",
                  "CNETMOBİL",
                  "Güvencesi",
                ],

                [
                  "🏪",
                  "Mağazadan",
                  "Teslim",
                ],
              ].map(
                (
                  item,
                  index
                ) => (
                  <div
                    key={index}
                    className="flex items-center gap-3"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-blue-400/20 bg-blue-500/10 text-base">
                      {item[0]}
                    </div>

                    <div>
                      <div className="text-[10px] font-black text-slate-200">
                        {item[1]}
                      </div>

                      <div className="text-[9px] font-medium text-slate-500">
                        {item[2]}
                      </div>
                    </div>
                  </div>
                )
              )}
            </div>
          </div>

          {/* HERO PHONE */}

          <div
            id="modeller"
            className="relative hidden h-[570px] items-center justify-center lg:flex"
          >

            <div className="absolute bottom-[60px] h-[80px] w-[85%] rounded-full bg-blue-400/20 blur-[40px]" />

            <img
              src="/iphone18-hero.webp"
              alt="iPhone 18 Pro"
              className="relative z-10 max-h-[520px] w-full max-w-[760px] object-contain drop-shadow-[0_45px_65px_rgba(0,0,0,.75)]"
            />
          </div>
        </div>
      </section>

      {/* ÖN SİPARİŞ PANEL */}

      <section
        id="siparis"
        className="relative z-30 -mt-[210px] pb-16"
      >

        <form
          onSubmit={submit}
          className="mx-auto max-w-[1450px] px-5"
        >

          <div className="grid overflow-hidden rounded-[30px] border border-white/[0.12] bg-[#07101e]/95 shadow-[0_35px_120px_rgba(0,0,0,.65)] backdrop-blur-2xl lg:grid-cols-[1fr_440px]">

            {/* SOL */}

            <div className="p-6 md:p-8">

              <div className="flex items-center justify-between">

                <div className="flex items-center gap-3">

                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/15 text-violet-300">
                    ◉
                  </div>

                  <div>
                    <div className="text-[18px] font-black">
                      ÖN SİPARİŞ
                    </div>

                    <div className="mt-1 text-[10px] font-semibold text-slate-500">
                      Modelini özelleştir
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500">

                  <span className="h-2 w-2 rounded-full bg-violet-500 shadow-[0_0_12px_rgba(139,92,246,.8)]" />

                  Sınırlı Kontenjan
                </div>
              </div>

              {/* MODEL */}

              <div className="mt-7">

                <label className="mb-3 block text-[11px] font-bold text-slate-400">
                  Model
                </label>

                <div className="grid gap-3 md:grid-cols-3">

                  {MODELS.map(
                    (item) => {

                      const active =
                        model === item;

                      return (
                        <button
                          key={item}
                          type="button"
                          onClick={() =>
                            selectModel(
                              item
                            )
                          }
                          className={`relative min-h-[76px] rounded-[15px] border p-4 text-left transition ${
                            active
                              ? "border-[#229dff] bg-[#0b3762]/50 shadow-[0_0_25px_rgba(34,157,255,.10)]"
                              : "border-white/[0.10] bg-white/[0.025] hover:border-white/20"
                          }`}
                        >

                          <div className="text-[12px] font-black">
                            {item}
                          </div>

                          <div className="mt-1 text-[9px] font-semibold text-slate-500">

                            {item ===
                            "iPhone 18 Pro"
                              ? "Profesyoneller için."
                              : item ===
                                "iPhone 18 Pro Max"
                              ? "Daha büyük. Daha güçlü."
                              : "Yeni bir dönemin başlangıcı."}
                          </div>

                          {item ===
                            "iPhone Duo" &&
                            !duoOpen && (

                              <span className="mt-2 inline-flex rounded-md bg-amber-500/20 px-2 py-1 text-[8px] font-black text-amber-300">
                                ÖN TALEP
                              </span>
                            )}
                        </button>
                      );
                    }
                  )}
                </div>
              </div>

              {/* KAPASİTE */}

              <div className="mt-6">

                <label className="mb-3 block text-[11px] font-bold text-slate-400">
                  Kapasite
                </label>

                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">

                  {STORAGES.map(
                    (item) => {

                      const active =
                        storage ===
                        item;

                      return (
                        <button
                          key={item}
                          type="button"
                          onClick={() =>
                            setStorage(
                              item
                            )
                          }
                          className={`rounded-[14px] border px-4 py-3 text-left transition ${
                            active
                              ? "border-[#229dff] bg-[#0b3762]/50"
                              : "border-white/[0.10] bg-white/[0.025]"
                          }`}
                        >

                          <div className="text-[12px] font-black">
                            {item}
                          </div>

                          <div className="mt-1 text-[9px] font-semibold text-slate-500">
                            {money(
                              PRICES[
                                model
                              ][
                                item
                              ]
                            )}
                          </div>
                        </button>
                      );
                    }
                  )}
                </div>
              </div>

              {/* RENK + TESLİMAT */}

              <div
                id="renkler"
                className="mt-6 grid gap-6 md:grid-cols-2"
              >

                <div>

                  <label className="mb-3 block text-[11px] font-bold text-slate-400">
                    Renk
                  </label>

                  <div className="flex flex-wrap gap-5">

                    {colors.map(
                      (item) => {

                        const active =
                          color ===
                          item.name;

                        return (
                          <button
                            key={
                              item.name
                            }
                            type="button"
                            onClick={() =>
                              setColor(
                                item.name
                              )
                            }
                            className="text-center"
                          >

                            <span
                              className={`relative mx-auto flex h-11 w-11 items-center justify-center rounded-full border ${
                                active
                                  ? "border-[#29a7ff] ring-4 ring-blue-500/10"
                                  : "border-white/10"
                              }`}
                            >

                              <span
                                className="block h-7 w-7 rounded-full border border-white/20 shadow-lg"
                                style={{
                                  background:
                                    item.value,
                                }}
                              />

                              {active && (

                                <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#229dff] text-[8px]">
                                  ✓
                                </span>
                              )}
                            </span>

                            <span className="mt-2 block text-[8px] font-bold text-slate-400">
                              {item.name}
                            </span>
                          </button>
                        );
                      }
                    )}
                  </div>
                </div>

                <div>

                  <label className="mb-3 block text-[11px] font-bold text-slate-400">
                    Teslimat Tercihi
                  </label>

                  <select
                    value={store}
                    onChange={(e) =>
                      setStore(
                        e.target
                          .value
                      )
                    }
                    className="h-[52px] w-full rounded-xl border border-white/10 bg-[#0d1727] px-4 text-[11px] font-bold text-white outline-none transition focus:border-[#229dff]"
                  >

                    <option value="">
                      Mağaza Seçiniz
                    </option>

                    {STORES.map(
                      (item) => (
                        <option
                          key={item}
                          value={item}
                        >
                          {item}
                        </option>
                      )
                    )}
                  </select>
                </div>
              </div>

              {/* MÜŞTERİ */}

              <div className="mt-6 grid gap-3 md:grid-cols-3">

                <input
                  value={name}
                  onChange={(e) =>
                    setName(
                      e.target.value
                    )
                  }
                  placeholder="Ad Soyad"
                  className="h-[50px] rounded-xl border border-white/[0.10] bg-white/[0.025] px-4 text-[11px] font-semibold text-white outline-none placeholder:text-slate-600 focus:border-[#229dff]"
                />

                <input
                  value={phone}
                  onChange={(e) =>
                    setPhone(
                      e.target.value
                    )
                  }
                  placeholder="Telefon Numaranız"
                  className="h-[50px] rounded-xl border border-white/[0.10] bg-white/[0.025] px-4 text-[11px] font-semibold text-white outline-none placeholder:text-slate-600 focus:border-[#229dff]"
                />

                <input
                  value={note}
                  onChange={(e) =>
                    setNote(
                      e.target.value
                    )
                  }
                  placeholder="Notunuz (opsiyonel)"
                  className="h-[50px] rounded-xl border border-white/[0.10] bg-white/[0.025] px-4 text-[11px] font-semibold text-white outline-none placeholder:text-slate-600 focus:border-[#229dff]"
                />
              </div>

              {error && (

                <div className="mt-4 rounded-xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-[11px] font-bold text-rose-300">
                  {error}
                </div>
              )}

              {success && (

                <div className="mt-4 rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-[11px] font-bold text-emerald-300">
                  ✓ {success}
                </div>
              )}

              <button
                disabled={loading}
                type="submit"
                className="mt-5 flex h-[54px] w-full items-center justify-center gap-4 rounded-xl bg-gradient-to-r from-[#5fc2ff] via-[#7f9cff] to-[#a966ff] text-[13px] font-black text-[#06101d] shadow-[0_15px_40px_rgba(73,132,255,.20)] transition hover:-translate-y-0.5 disabled:opacity-50"
              >

                {loading
                  ? "Gönderiliyor..."
                  : isPreRequest
                  ? "Ön Talebi Tamamla"
                  : "Ön Siparişi Tamamla"}

                {!loading && (
                  <span className="text-xl">
                    →
                  </span>
                )}
              </button>
            </div>

            {/* SAĞ ÖZET */}

            <aside className="border-t border-white/[0.08] bg-[#040b15]/65 p-7 lg:border-l lg:border-t-0">

              <div className="flex items-center justify-between">

                <div className="text-[10px] font-black uppercase tracking-[0.22em] text-[#61b9ff]">
                  SEÇİMİNİZ
                </div>

                <button
                  type="button"
                  className="text-[10px] font-bold text-[#36a9ff]"
                >
                  Değiştir
                </button>
              </div>

              <div className="mt-6 flex items-center gap-4">

                <div
                  className="h-[82px] w-[58px] rounded-[14px] border border-white/10 shadow-lg"
                  style={{
                    background:
                      `linear-gradient(145deg, ${selectedColor.value}, #06080c)`,
                  }}
                />

                <div>

                  <div className="text-[20px] font-black">
                    {model}
                  </div>

                  <div className="mt-1 text-[11px] font-semibold text-slate-400">
                    {storage}
                    {" · "}
                    {color}
                  </div>

                  <div className="mt-1 text-[10px] font-semibold text-slate-500">
                    {description}
                  </div>
                </div>
              </div>

              <div className="mt-7 border-t border-white/[0.08] pt-6">

                <div className="text-[10px] font-semibold text-slate-400">
                  Apple Başlangıç Fiyatı
                </div>

                <div className="mt-1 text-[35px] font-black tracking-[-1px]">
                  {money(
                    price
                  )}
                </div>
              </div>

              {!isPreRequest && (

                <div className="mt-4">

                  <div className="text-[10px] font-semibold text-slate-400">
                    Ön Sipariş Kaporası
                  </div>

                  <div className="mt-1 text-[26px] font-black">
                    {money(
                      DEPOSIT
                    )}
                  </div>
                </div>
              )}

              <div className="mt-6 rounded-xl border border-[#238eff]/60 bg-[#0b3155]/25 p-4">

                <div className="flex items-start gap-3">

                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#279eff] text-[11px] font-black">
                    i
                  </span>

                  <p className="text-[10px] font-semibold leading-5 text-slate-300">

                    {isPreRequest
                      ? "iPhone Duo için şu an ön talep alınmaktadır. Ön sipariş açıldığında sizinle iletişime geçilecektir."
                      : "Talebiniz Telegram üzerinden CNETMOBİL ekibine iletilir. Ödeme bu sayfa üzerinden alınmaz."}
                  </p>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3">

                {[
                  [
                    "🛡",
                    "CNETMOBİL Güvencesi",
                    "%100 güvenli süreç",
                  ],

                  [
                    "🚚",
                    "Hızlı Bilgilendirme",
                    "Size özel dönüş",
                  ],

                  [
                    "🏪",
                    "Mağazadan Teslim",
                    "İstediğiniz mağaza",
                  ],

                  [
                    "🎁",
                    "Sınırlı Kontenjan",
                    "İlk sahiplerinden olun",
                  ],
                ].map(
                  (
                    item,
                    index
                  ) => (
                    <div
                      key={index}
                      className="border-t border-white/[0.08] pt-3"
                    >

                      <div className="text-lg">
                        {item[0]}
                      </div>

                      <div className="mt-1 text-[9px] font-black">
                        {item[1]}
                      </div>

                      <div className="mt-1 text-[8px] font-medium text-slate-500">
                        {item[2]}
                      </div>
                    </div>
                  )
                )}
              </div>
            </aside>
          </div>
        </form>
      </section>

      {/* DUO INFO */}

      <section className="mx-auto max-w-[1450px] px-5 pb-12">

        <div className="flex items-center gap-3 rounded-xl border border-blue-400/15 bg-blue-500/[0.06] px-5 py-4">

          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-500 text-[11px] font-black">
            i
          </span>

          <div className="text-[11px] font-semibold text-blue-100/75">

            iPhone Duo için ön siparişler

            <strong className="mx-1 text-white">
              16 Ekim 2026 saat 15:00
            </strong>

            itibarıyla başlayacaktır.
          </div>
        </div>
      </section>
    </main>
  );
}
