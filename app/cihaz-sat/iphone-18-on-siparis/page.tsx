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

type ColorOption = {
  name: string;
  swatch: string;
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
  ColorOption[]
> = {
  "iPhone 18 Pro": [
    {
      name: "Siyah",
      swatch: "#191b20",
    },
    {
      name: "Buzul Rengi",
      swatch: "#8db9f2",
    },
    {
      name: "Burgonya",
      swatch: "#6d2c51",
    },
    {
      name: "Gümüş Rengi",
      swatch: "#d5d7dc",
    },
  ],

  "iPhone 18 Pro Max": [
    {
      name: "Siyah",
      swatch: "#191b20",
    },
    {
      name: "Buzul Rengi",
      swatch: "#8db9f2",
    },
    {
      name: "Burgonya",
      swatch: "#6d2c51",
    },
    {
      name: "Gümüş Rengi",
      swatch: "#d5d7dc",
    },
  ],

  "iPhone Duo": [
    {
      name: "Gece Rengi",
      swatch: "#121821",
    },
    {
      name: "Yıldız Rengi",
      swatch: "#e2dacb",
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

const DUO_PREORDER_START =
  Date.UTC(
    2026,
    9,
    16,
    12,
    0,
    0
  );

function money(value: number) {
  return new Intl.NumberFormat(
    "tr-TR",
    {
      style: "currency",
      currency: "TRY",
      maximumFractionDigits: 0,
    }
  ).format(value);
}

function Icon({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-blue-400/20 bg-blue-500/10 text-blue-300">
      {children}
    </div>
  );
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
    duoPreorderOpen,
    setDuoPreorderOpen,
  ] = useState(false);

  useEffect(() => {
    setDuoPreorderOpen(
      Date.now() >=
        DUO_PREORDER_START
    );
  }, []);

  const colors =
    COLORS[model];

  const price =
    PRICES[model][storage];

  const isDuo =
    model === "iPhone Duo";

  const isPreRequest =
    isDuo &&
    !duoPreorderOpen;

  const modelText =
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

    setLoading(true);

    try {
      const res =
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
        await res
          .json()
          .catch(
            () => ({})
          );

      if (
        !res.ok ||
        !data?.success
      ) {
        throw new Error(
          data?.error ||
            "Talep gönderilemedi."
        );
      }

      setSuccess(
        data?.message ||
          "Talebiniz alındı."
      );
    } catch (e: any) {
      setError(
        e?.message ||
          "Bir hata oluştu."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#030711] text-white">

      {/* ================= HEADER ================= */}

      <header className="sticky top-0 z-50 border-b border-white/[0.07] bg-[#030711]/95 backdrop-blur-xl">

        <div className="mx-auto flex h-[72px] max-w-[1440px] items-center justify-between px-5 lg:px-8">

          <a
            href="/cihaz-sat"
            className="text-[25px] font-black tracking-[-1.5px]"
          >
            CNET
            <span className="font-medium text-[#50a5ff]">
              MOBİL
            </span>
          </a>

          <nav className="hidden items-center gap-9 text-[12px] font-bold text-slate-300 lg:flex">

            <a
              href="/cihaz-sat"
              className="hover:text-white"
            >
              Cihaz Sat
            </a>

            <a
              href="#modeller"
              className="hover:text-white"
            >
              Modeller
            </a>

            <a
              href="#on-siparis"
              className="hover:text-white"
            >
              Ön Sipariş
            </a>

            <a
              href="#avantajlar"
              className="hover:text-white"
            >
              Avantajlar
            </a>

          </nav>

          <a
            href="#on-siparis"
            className="rounded-xl border border-blue-400/30 bg-blue-500/10 px-5 py-3 text-[11px] font-black text-blue-100 transition hover:bg-blue-600"
          >
            Ön Sipariş Ver
          </a>
        </div>
      </header>

      {/* ================= HERO ================= */}

      <section className="relative overflow-hidden">

        <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_30%,rgba(25,105,255,.34),transparent_29%),radial-gradient(circle_at_22%_80%,rgba(102,69,255,.17),transparent_32%),linear-gradient(120deg,#030711_0%,#081328_52%,#030711_100%)]" />

        {/* PLANET */}
        <div className="pointer-events-none absolute right-[-380px] top-[-580px] h-[1150px] w-[1150px] rounded-full border border-blue-300/25 shadow-[0_0_85px_rgba(70,130,255,.32)]" />

        <div className="pointer-events-none absolute right-[8%] top-[20%] h-[350px] w-[650px] bg-blue-500/15 blur-[130px]" />

        <div className="relative mx-auto grid min-h-[650px] max-w-[1440px] items-center gap-10 px-5 py-14 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">

          {/* LEFT */}

          <div className="relative z-10 max-w-[680px]">

            <div className="text-[11px] font-black uppercase tracking-[0.42em] text-blue-200/70">
              DAHA FAZLASI SENİN ELİNDE
            </div>

            <h1 className="mt-6 text-[53px] font-black leading-[0.95] tracking-[-3px] sm:text-[70px] xl:text-[80px]">

              Yeni Seri

              <span className="block bg-gradient-to-r from-[#6bbcff] via-[#8ca4ff] to-[#b782ff] bg-clip-text text-transparent">
                Ön Siparişe Açıldı
              </span>
            </h1>

            <h2 className="mt-7 text-[27px] font-black tracking-[-0.8px]">
              iPhone 18 Pro & Pro Max
            </h2>

            <p className="mt-3 max-w-[560px] text-[15px] font-medium leading-7 text-slate-400">
              Yeni renkler, güçlü
              performans ve CNETMOBİL
              ön sipariş avantajları.
              İlk sahiplerinden biri ol.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">

              <a
                href="#on-siparis"
                className="flex h-14 items-center gap-5 rounded-full bg-white px-8 text-[13px] font-black text-slate-950 transition hover:-translate-y-1"
              >
                Ön Sipariş Ver

                <span className="text-xl">
                  →
                </span>
              </a>

              <a
                href="#renkler"
                className="flex h-14 items-center gap-4 rounded-full border border-white/20 bg-white/[0.04] px-8 text-[13px] font-black backdrop-blur-xl transition hover:bg-white/10"
              >
                Renkleri İncele

                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-500 text-[10px]">
                  ▶
                </span>
              </a>
            </div>

            {/* BENEFITS */}

            <div
              id="avantajlar"
              className="mt-10 flex flex-wrap gap-6"
            >

              <div className="flex items-center gap-3 text-[11px] font-bold text-slate-300">

                <Icon>
                  🎁
                </Icon>

                <span>
                  Sınırlı Ön Sipariş
                  <br />
                  Avantajları
                </span>
              </div>

              <div className="flex items-center gap-3 text-[11px] font-bold text-slate-300">

                <Icon>
                  🚚
                </Icon>

                <span>
                  Hızlı
                  <br />
                  Bilgilendirme
                </span>
              </div>

              <div className="flex items-center gap-3 text-[11px] font-bold text-slate-300">

                <Icon>
                  🛡
                </Icon>

                <span>
                  CNETMOBİL
                  <br />
                  Güvencesi
                </span>
              </div>

              <div className="flex items-center gap-3 text-[11px] font-bold text-slate-300">

                <Icon>
                  🏪
                </Icon>

                <span>
                  Mağazadan
                  <br />
                  Teslim
                </span>
              </div>
            </div>
          </div>

          {/* RIGHT REAL IMAGE */}

          <div
            id="modeller"
            className="relative hidden min-h-[530px] items-center justify-center lg:flex"
          >

            <div className="absolute bottom-[45px] h-[70px] w-[80%] rounded-[50%] bg-blue-400/15 blur-[38px]" />

            <img
              src="/iphone18-hero.png"
              alt="iPhone 18 Pro ve Pro Max"
              className="relative z-10 max-h-[580px] w-full max-w-[780px] object-contain drop-shadow-[0_40px_50px_rgba(0,0,0,.55)]"
            />
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-[110px] bg-gradient-to-t from-[#030711] to-transparent" />
      </section>

      {/* ================= ORDER ================= */}

      <section
        id="on-siparis"
        className="relative z-10 pb-12 pt-3"
      >

        <form
          onSubmit={submit}
          className="mx-auto max-w-[1380px] px-5"
        >

          <div className="overflow-hidden rounded-[30px] border border-white/[0.10] bg-[#081020]/95 shadow-[0_30px_100px_rgba(0,0,0,.5)] backdrop-blur-2xl">

            <div className="grid lg:grid-cols-[1fr_385px]">

              {/* LEFT FORM */}

              <div className="p-6 sm:p-8">

                <div className="flex items-center justify-between">

                  <div className="flex items-center gap-3">

                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/15 text-violet-300">
                      ◉
                    </div>

                    <div>

                      <h3 className="text-[18px] font-black">
                        ÖN SİPARİŞ
                      </h3>

                      <p className="mt-1 text-[10px] font-semibold text-slate-500">
                        Modelini özelleştir
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400">

                    <span className="h-2 w-2 rounded-full bg-violet-500 shadow-[0_0_12px_rgba(139,92,246,.8)]" />

                    Sınırlı Kontenjan
                  </div>
                </div>

                {/* MODEL */}

                <div className="mt-8">

                  <label className="mb-3 block text-[11px] font-bold text-slate-400">
                    Model
                  </label>

                  <div className="grid gap-3 md:grid-cols-3">

                    {MODELS.map(
                      (item) => (
                        <button
                          key={item}
                          type="button"
                          onClick={() =>
                            selectModel(
                              item
                            )
                          }
                          className={`relative rounded-[16px] border p-4 text-left transition ${
                            model === item
                              ? "border-blue-400 bg-blue-500/15 shadow-[0_0_25px_rgba(59,130,246,.08)]"
                              : "border-white/[0.09] bg-white/[0.025] hover:border-white/20"
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
                            !duoPreorderOpen && (

                              <span className="mt-2 inline-flex rounded-full bg-amber-400/15 px-2 py-1 text-[8px] font-black text-amber-300">
                                ÖN TALEP
                              </span>
                            )}
                        </button>
                      )
                    )}
                  </div>
                </div>

                {/* STORAGE */}

                <div className="mt-7">

                  <label className="mb-3 block text-[11px] font-bold text-slate-400">
                    Kapasite
                  </label>

                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">

                    {STORAGES.map(
                      (item) => (
                        <button
                          key={item}
                          type="button"
                          onClick={() =>
                            setStorage(
                              item
                            )
                          }
                          className={`rounded-[15px] border px-4 py-4 text-left transition ${
                            storage === item
                              ? "border-blue-400 bg-blue-500/15"
                              : "border-white/[0.09] bg-white/[0.025]"
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
                      )
                    )}
                  </div>
                </div>

                {/* COLOR / STORE */}

                <div
                  id="renkler"
                  className="mt-7 grid gap-6 sm:grid-cols-2"
                >

                  <div>

                    <label className="mb-3 block text-[11px] font-bold text-slate-400">
                      Renk
                    </label>

                    <div className="flex flex-wrap gap-4">

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
                              title={
                                item.name
                              }
                              onClick={() =>
                                setColor(
                                  item.name
                                )
                              }
                              className="text-center"
                            >

                              <span
                                className={`relative flex h-11 w-11 items-center justify-center rounded-full border transition ${
                                  active
                                    ? "border-blue-400 ring-4 ring-blue-500/10"
                                    : "border-white/10"
                                }`}
                              >

                                <span
                                  className="h-7 w-7 rounded-full border border-white/20 shadow"
                                  style={{
                                    backgroundColor:
                                      item.swatch,
                                  }}
                                />

                                {active && (

                                  <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-[8px]">
                                    ✓
                                  </span>
                                )}
                              </span>

                              <span className="mt-2 block max-w-[70px] text-[8px] font-bold text-slate-400">
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
                      className="h-12 w-full rounded-xl border border-white/10 bg-[#10182a] px-4 text-[11px] font-bold text-white outline-none focus:border-blue-400"
                    >

                      <option value="">
                        Mağaza Seçiniz
                      </option>

                      {STORES.map(
                        (item) => (
                          <option
                            key={
                              item
                            }
                            value={
                              item
                            }
                          >
                            {item}
                          </option>
                        )
                      )}
                    </select>
                  </div>
                </div>

                {/* CUSTOMER */}

                <div className="mt-7 grid gap-3 sm:grid-cols-3">

                  <input
                    value={name}
                    onChange={(e) =>
                      setName(
                        e.target
                          .value
                      )
                    }
                    placeholder="Ad Soyad"
                    className="h-12 rounded-xl border border-white/[0.09] bg-white/[0.03] px-4 text-[11px] font-semibold outline-none placeholder:text-slate-600 focus:border-blue-400"
                  />

                  <input
                    value={phone}
                    onChange={(e) =>
                      setPhone(
                        e.target
                          .value
                      )
                    }
                    placeholder="Telefon Numaranız"
                    className="h-12 rounded-xl border border-white/[0.09] bg-white/[0.03] px-4 text-[11px] font-semibold outline-none placeholder:text-slate-600 focus:border-blue-400"
                  />

                  <input
                    value={note}
                    onChange={(e) =>
                      setNote(
                        e.target
                          .value
                      )
                    }
                    placeholder="Notunuz (opsiyonel)"
                    className="h-12 rounded-xl border border-white/[0.09] bg-white/[0.03] px-4 text-[11px] font-semibold outline-none placeholder:text-slate-600 focus:border-blue-400"
                  />
                </div>

                {error && (

                  <div className="mt-5 rounded-xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-[11px] font-bold text-rose-300">
                    {error}
                  </div>
                )}

                {success && (

                  <div className="mt-5 rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-[11px] font-bold text-emerald-300">
                    ✓ {success}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="mt-6 flex h-14 w-full items-center justify-center gap-4 rounded-xl bg-gradient-to-r from-[#66baff] via-[#8198ff] to-[#af78ff] text-[13px] font-black text-[#05101f] shadow-[0_15px_40px_rgba(88,130,255,.22)] transition hover:-translate-y-0.5 disabled:opacity-50"
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

              {/* RIGHT SUMMARY */}

              <aside className="border-t border-white/[0.08] bg-black/15 p-7 lg:border-l lg:border-t-0">

                <div className="text-[9px] font-black uppercase tracking-[0.25em] text-blue-300">
                  SEÇİMİNİZ
                </div>

                <div className="mt-6">

                  <h3 className="text-[21px] font-black">
                    {model}
                  </h3>

                  <p className="mt-1 text-[10px] font-semibold text-slate-500">
                    {modelText}
                  </p>

                  <div className="mt-4 flex items-center gap-3">

                    <span
                      className="h-8 w-8 rounded-full border border-white/20"
                      style={{
                        background:
                          COLORS[
                            model
                          ].find(
                            (x) =>
                              x.name ===
                              color
                          )?.swatch,
                      }}
                    />

                    <span className="text-[11px] font-bold text-slate-300">
                      {storage}
                      {" · "}
                      {color}
                    </span>
                  </div>
                </div>

                <div className="mt-7 border-t border-white/[0.08] pt-6">

                  <div className="text-[9px] font-bold uppercase text-slate-500">
                    Apple Başlangıç Fiyatı
                  </div>

                  <div className="mt-1 text-[34px] font-black tracking-[-1px]">
                    {money(
                      price
                    )}
                  </div>
                </div>

                {!isPreRequest && (

                  <div className="mt-5">

                    <div className="text-[9px] font-bold uppercase text-slate-500">
                      Ön Sipariş Kaporası
                    </div>

                    <div className="mt-1 text-[25px] font-black">
                      {money(
                        DEPOSIT
                      )}
                    </div>
                  </div>
                )}

                <div className="mt-6 rounded-2xl border border-blue-400/20 bg-blue-500/[0.08] p-4">

                  <div className="flex gap-3">

                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-500 text-[11px] font-black">
                      i
                    </div>

                    <p className="text-[10px] font-semibold leading-5 text-blue-100/75">

                      {isPreRequest
                        ? "iPhone Duo için şu an ön talep alınmaktadır. Ön sipariş açıldığında sizinle iletişime geçilecektir."
                        : "Talebiniz Telegram üzerinden CNETMOBİL ekibine iletilir. Ödeme bu sayfa üzerinden alınmaz."}
                    </p>
                  </div>
                </div>

                <div className="mt-7 grid grid-cols-2 gap-3">

                  {[
                    [
                      "🛡",
                      "CNETMOBİL",
                      "Güvencesi",
                    ],

                    [
                      "🚚",
                      "Hızlı",
                      "Bilgilendirme",
                    ],

                    [
                      "🏪",
                      "Mağazadan",
                      "Teslim",
                    ],

                    [
                      "🎁",
                      "Sınırlı",
                      "Kontenjan",
                    ],
                  ].map(
                    (
                      item,
                      index
                    ) => (

                      <div
                        key={
                          index
                        }
                        className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3"
                      >

                        <div className="text-lg">
                          {
                            item[0]
                          }
                        </div>

                        <div className="mt-2 text-[9px] font-black">
                          {
                            item[1]
                          }
                        </div>

                        <div className="mt-0.5 text-[8px] font-semibold text-slate-500">
                          {
                            item[2]
                          }
                        </div>
                      </div>
                    )
                  )}
                </div>
              </aside>
            </div>
          </div>
        </form>
      </section>

      {/* ================= DUO INFO ================= */}

      <section className="mx-auto max-w-[1380px] px-5 pb-12">

        <div className="flex items-center justify-between gap-5 rounded-2xl border border-blue-400/15 bg-blue-500/[0.07] px-5 py-4">

          <div className="flex items-center gap-3">

            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500 text-[12px] font-black">
              i
            </div>

            <p className="text-[11px] font-semibold text-blue-100/75">

              iPhone Duo ön siparişleri

              <strong className="mx-1 text-white">
                16 Ekim 2026 saat 15:00
              </strong>

              itibarıyla başlayacaktır.
            </p>
          </div>

          <span className="hidden text-xl text-blue-300 sm:block">
            →
          </span>
        </div>
      </section>

      <footer className="border-t border-white/[0.07] bg-[#02050b]">

        <div className="mx-auto flex max-w-[1380px] items-center justify-between px-5 py-8 text-[10px] font-medium text-slate-600">

          <div>
            © 2026 CNETMOBİL
          </div>

          <div>
            iPhone 18 Ön Sipariş
          </div>
        </div>
      </footer>
    </main>
  );
}
