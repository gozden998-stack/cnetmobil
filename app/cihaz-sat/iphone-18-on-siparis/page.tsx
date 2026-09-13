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
  highlight: string;
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

const PRICE_MAP: Record<
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
      swatch: "#17191d",
      highlight: "#454a52",
    },
    {
      name: "Buzul Rengi",
      swatch: "#8eb9f4",
      highlight: "#dbeafe",
    },
    {
      name: "Burgonya",
      swatch: "#682a52",
      highlight: "#b56a91",
    },
    {
      name: "Gümüş Rengi",
      swatch: "#cacdd2",
      highlight: "#ffffff",
    },
  ],

  "iPhone 18 Pro Max": [
    {
      name: "Siyah",
      swatch: "#17191d",
      highlight: "#454a52",
    },
    {
      name: "Buzul Rengi",
      swatch: "#8eb9f4",
      highlight: "#dbeafe",
    },
    {
      name: "Burgonya",
      swatch: "#682a52",
      highlight: "#b56a91",
    },
    {
      name: "Gümüş Rengi",
      swatch: "#cacdd2",
      highlight: "#ffffff",
    },
  ],

  "iPhone Duo": [
    {
      name: "Gece Rengi",
      swatch: "#111820",
      highlight: "#566372",
    },
    {
      name: "Yıldız Rengi",
      swatch: "#dcd4c5",
      highlight: "#fff8e7",
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

// 16 Ekim 2026 15:00 Türkiye saati
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

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m5 12 4 4L19 6"
      />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 3 5 6v5c0 5 3.2 8 7 10 3.8-2 7-5 7-10V6l-7-3Z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m9 12 2 2 4-4"
      />
    </svg>
  );
}

function TruckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M3 6h11v10H3z" />
      <path d="M14 10h4l3 3v3h-7z" />
      <circle cx="7" cy="18" r="2" />
      <circle cx="18" cy="18" r="2" />
    </svg>
  );
}

function StoreIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M4 10v10h16V10" />
      <path d="M3 10 5 4h14l2 6" />
      <path d="M8 20v-6h8v6" />
    </svg>
  );
}

function CameraModule() {
  return (
    <div className="absolute left-[10%] top-[6%] h-[27%] w-[62%] rounded-[22%] border border-white/10 bg-black/25 shadow-xl backdrop-blur-sm">
      <div className="absolute left-[9%] top-[10%] h-[34%] w-[34%] rounded-full border-[5px] border-black/70 bg-[radial-gradient(circle_at_40%_35%,#7792ad,#15202f_42%,#020407_68%)] shadow-[inset_0_0_5px_rgba(255,255,255,.25)]" />

      <div className="absolute right-[9%] top-[10%] h-[34%] w-[34%] rounded-full border-[5px] border-black/70 bg-[radial-gradient(circle_at_40%_35%,#7792ad,#15202f_42%,#020407_68%)]" />

      <div className="absolute bottom-[8%] left-[32%] h-[34%] w-[34%] rounded-full border-[5px] border-black/70 bg-[radial-gradient(circle_at_40%_35%,#7792ad,#15202f_42%,#020407_68%)]" />

      <div className="absolute bottom-[14%] right-[8%] h-[10%] w-[10%] rounded-full bg-white/70 shadow-[0_0_12px_rgba(255,255,255,.8)]" />
    </div>
  );
}

function PhoneMockup({
  color,
  highlight,
  className = "",
}: {
  color: string;
  highlight: string;
  className?: string;
}) {
  return (
    <div
      className={`relative h-[410px] w-[198px] rounded-[44px] border border-white/20 shadow-[0_35px_90px_rgba(0,0,0,.75)] ${className}`}
      style={{
        background: `
          linear-gradient(
            145deg,
            ${highlight} 0%,
            ${color} 20%,
            ${color} 72%,
            #06080d 135%
          )
        `,
      }}
    >
      <div className="absolute inset-[5px] rounded-[39px] border border-black/20" />

      <CameraModule />

      <div className="absolute left-1/2 top-[58%] -translate-x-1/2 text-[45px] font-black text-black/20">
        ●
      </div>

      <div className="absolute -left-[3px] top-[115px] h-[52px] w-[4px] rounded-l bg-white/20" />

      <div className="absolute -right-[3px] top-[140px] h-[66px] w-[4px] rounded-r bg-white/20" />
    </div>
  );
}

function DuoMockup({
  color,
}: {
  color: string;
}) {
  return (
    <div className="relative h-[410px] w-[340px]">

      <div
        className="absolute left-[22px] top-[15px] h-[380px] w-[164px] -rotate-[5deg] rounded-[35px] border border-white/20 shadow-[0_30px_70px_rgba(0,0,0,.6)]"
        style={{
          background: `linear-gradient(145deg,#ffffff55,${color} 30%,#111827 130%)`,
        }}
      >
        <div className="absolute inset-[8px] rounded-[28px] bg-[radial-gradient(circle_at_50%_20%,#3155a7,#091122_70%)]" />
      </div>

      <div
        className="absolute right-[28px] top-[15px] h-[380px] w-[164px] rotate-[5deg] rounded-[35px] border border-white/20 shadow-[0_30px_70px_rgba(0,0,0,.6)]"
        style={{
          background: `linear-gradient(145deg,#ffffff55,${color} 30%,#111827 130%)`,
        }}
      >
        <CameraModule />
      </div>
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

  const currentPrice =
    PRICE_MAP[model][storage];

  const availableColors =
    COLORS[model];

  const selectedColor =
    availableColors.find(
      (x) => x.name === color
    ) ||
    availableColors[0];

  const isDuo =
    model === "iPhone Duo";

  const isPreRequest =
    isDuo &&
    !duoPreorderOpen;

  const modelLabel =
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

  function chooseModel(
    next: Model
  ) {
    setModel(next);

    setColor(
      COLORS[next][0].name
    );

    setError("");
    setSuccess("");
  }

  async function submit(
    e: FormEvent
  ) {
    e.preventDefault();

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
          "Talebiniz başarıyla alındı."
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
    <main className="min-h-screen overflow-x-hidden bg-[#050914] text-white">

      {/* NAVBAR */}
      <nav className="relative z-50 border-b border-white/10 bg-[#050914]/95 backdrop-blur-xl">

        <div className="mx-auto flex h-[76px] max-w-[1450px] items-center justify-between px-5 lg:px-8">

          <a
            href="/cihaz-sat"
            className="text-[25px] font-black tracking-[-1.4px]"
          >
            CNET
            <span className="font-medium text-blue-400">
              MOBİL
            </span>
          </a>

          <div className="hidden items-center gap-8 text-[12px] font-bold text-slate-300 lg:flex">

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
              href="#on-siparis"
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
          </div>

          <a
            href="#on-siparis"
            className="rounded-xl border border-blue-400/30 bg-blue-500/10 px-4 py-2.5 text-[11px] font-black text-blue-200 transition hover:bg-blue-500 hover:text-white"
          >
            Ön Sipariş Ver
          </a>
        </div>
      </nav>

      {/* HERO */}
      <section className="relative min-h-[760px] overflow-hidden">

        {/* BACKGROUND */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_35%,rgba(42,117,255,.38),transparent_26%),radial-gradient(circle_at_20%_90%,rgba(91,52,197,.24),transparent_35%),linear-gradient(125deg,#030711,#091224_45%,#03060e)]" />

        <div className="absolute -right-[120px] -top-[220px] h-[900px] w-[900px] rounded-full border-[3px] border-blue-300/25 shadow-[0_0_85px_rgba(71,142,255,.45)]" />

        <div className="absolute right-[8%] top-[25%] h-[240px] w-[600px] bg-blue-500/20 blur-[120px]" />

        <div className="absolute bottom-0 left-0 right-0 h-[230px] bg-gradient-to-t from-[#050914] to-transparent" />

        <div className="relative mx-auto grid max-w-[1450px] gap-8 px-5 pb-20 pt-16 lg:grid-cols-[0.88fr_1.12fr] lg:px-8">

          {/* HERO LEFT */}
          <div className="relative z-10">

            <div className="text-[11px] font-black uppercase tracking-[0.4em] text-slate-400">
              DAHA FAZLASI SENİN ELİNDE
            </div>

            <h1 className="mt-6 max-w-[700px] text-[50px] font-black leading-[0.98] tracking-[-3px] sm:text-[70px] xl:text-[82px]">

              Yeni Seri

              <span className="block bg-gradient-to-r from-[#74b8ff] via-[#88a5ff] to-[#bb85ff] bg-clip-text text-transparent">
                Ön Siparişe Açıldı
              </span>
            </h1>

            <div className="mt-7 text-[28px] font-semibold tracking-[-1px] text-white">
              iPhone 18 Pro & Pro Max
            </div>

            <p className="mt-3 max-w-xl text-[15px] font-medium leading-7 text-slate-400">
              Yeni renkler, güçlü performans
              ve CNETMOBİL ön sipariş avantajları.
              İlk sahiplerinden biri ol.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">

              <a
                href="#on-siparis"
                className="inline-flex h-14 items-center gap-5 rounded-full bg-white px-8 text-[13px] font-black text-slate-950 shadow-[0_10px_35px_rgba(255,255,255,.15)] transition hover:-translate-y-1"
              >
                Ön Sipariş Ver
                <span className="text-lg">
                  →
                </span>
              </a>

              <a
                href="#renkler"
                className="inline-flex h-14 items-center gap-4 rounded-full border border-white/20 bg-white/5 px-8 text-[13px] font-black text-white backdrop-blur-xl transition hover:bg-white/10"
              >
                Renkleri İncele

                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500">
                  ▶
                </span>
              </a>
            </div>

            {/* TRUST */}
            <div
              id="avantajlar"
              className="mt-10 flex flex-wrap gap-x-7 gap-y-5 text-[11px] font-semibold text-slate-300"
            >

              <div className="flex items-center gap-3">
                <ShieldIcon />
                <span>
                  CNETMOBİL
                  <br />
                  Güvencesi
                </span>
              </div>

              <div className="h-9 w-px bg-white/10" />

              <div className="flex items-center gap-3">
                <TruckIcon />
                <span>
                  Hızlı
                  <br />
                  Bilgilendirme
                </span>
              </div>

              <div className="h-9 w-px bg-white/10" />

              <div className="flex items-center gap-3">
                <StoreIcon />
                <span>
                  Mağazadan
                  <br />
                  Teslim
                </span>
              </div>

            </div>
          </div>

          {/* PHONE VISUALS */}
          <div
            id="modeller"
            className="relative hidden min-h-[560px] items-end justify-center lg:flex"
          >

            <div className="absolute bottom-[55px] h-[80px] w-[760px] rounded-[50%] bg-blue-500/20 blur-[45px]" />

            <div className="relative flex items-end">

              <PhoneMockup
                color="#17191d"
                highlight="#777d89"
                className="z-10 translate-x-[80px] scale-[0.92] rotate-[-2deg]"
              />

              <PhoneMockup
                color="#8eb9f4"
                highlight="#dbeafe"
                className="z-30 -translate-y-5 scale-[1.03]"
              />

              <PhoneMockup
                color="#682a52"
                highlight="#b56a91"
                className="z-20 -translate-x-[70px] scale-[0.96]"
              />

              <PhoneMockup
                color="#cacdd2"
                highlight="#ffffff"
                className="z-10 -translate-x-[145px] translate-y-3 scale-[0.88] rotate-[2deg]"
              />

            </div>
          </div>
        </div>
      </section>

      {/* PREORDER GLASS PANEL */}
      <section
        id="on-siparis"
        className="relative z-20 -mt-[140px] pb-10"
      >
        <form
          onSubmit={submit}
          className="mx-auto max-w-[1450px] px-5 lg:px-8"
        >

          <div className="grid overflow-hidden rounded-[32px] border border-white/10 bg-[#0a1020]/90 shadow-[0_40px_120px_rgba(0,0,0,.55)] backdrop-blur-2xl lg:grid-cols-[1fr_390px]">

            {/* FORM LEFT */}
            <div className="p-6 sm:p-8">

              <div className="flex flex-wrap items-center justify-between gap-4">

                <div className="flex items-center gap-3">

                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-300">
                    ◉
                  </div>

                  <div>
                    <div className="text-[17px] font-black">
                      ÖN SİPARİŞ
                    </div>

                    <div className="text-[10px] font-semibold text-slate-500">
                      Modelini özelleştir
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400">

                  <span className="h-2 w-2 rounded-full bg-violet-500 shadow-[0_0_10px_rgba(139,92,246,.8)]" />

                  Sınırlı Kontenjan
                </div>
              </div>

              {/* MODEL */}
              <div className="mt-7">

                <label className="mb-2 block text-[11px] font-bold text-slate-400">
                  Model
                </label>

                <div className="grid gap-2 sm:grid-cols-3">

                  {MODELS.map(
                    (item) => (
                      <button
                        key={item}
                        type="button"
                        onClick={() =>
                          chooseModel(
                            item
                          )
                        }
                        className={`relative min-h-[62px] rounded-xl border px-4 text-left text-[12px] font-black transition ${
                          model === item
                            ? "border-blue-400 bg-blue-500/15 text-white"
                            : "border-white/10 bg-white/[0.03] text-slate-400 hover:bg-white/[0.06]"
                        }`}
                      >

                        {item}

                        {item ===
                          "iPhone Duo" &&
                          !duoPreorderOpen && (
                            <span className="mt-1 block text-[8px] font-black text-amber-400">
                              ÖN TALEP
                            </span>
                          )}
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* STORAGE */}
              <div className="mt-6">

                <label className="mb-2 block text-[11px] font-bold text-slate-400">
                  Kapasite
                </label>

                <div className="grid grid-cols-2 gap-2 md:grid-cols-4">

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
                        className={`rounded-xl border px-3 py-3 text-left transition ${
                          storage === item
                            ? "border-blue-400 bg-blue-500/15"
                            : "border-white/10 bg-white/[0.03]"
                        }`}
                      >

                        <div className="text-[12px] font-black">
                          {item}
                        </div>

                        <div className="mt-1 text-[9px] font-semibold text-slate-500">
                          {money(
                            PRICE_MAP[
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

              {/* COLOR + STORE */}
              <div
                id="renkler"
                className="mt-6 grid gap-5 sm:grid-cols-2"
              >

                <div>

                  <label className="mb-3 block text-[11px] font-bold text-slate-400">
                    Renk
                  </label>

                  <div className="flex flex-wrap gap-3">

                    {availableColors.map(
                      (item) => (
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
                          className={`group relative flex h-11 w-11 items-center justify-center rounded-full border transition ${
                            color ===
                            item.name
                              ? "border-blue-400 bg-blue-500/15"
                              : "border-white/10 bg-white/[0.02]"
                          }`}
                        >

                          <span
                            className="h-7 w-7 rounded-full border border-white/20 shadow-lg"
                            style={{
                              background:
                                item.swatch,
                            }}
                          />

                          {color ===
                            item.name && (
                            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-[8px]">
                              ✓
                            </span>
                          )}
                        </button>
                      )
                    )}
                  </div>

                  <div className="mt-3 text-[10px] font-bold text-slate-300">
                    {color}
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
                    className="h-12 w-full rounded-xl border border-white/10 bg-[#111827] px-4 text-[11px] font-bold text-white outline-none transition focus:border-blue-400"
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
                          {
                            item
                          }
                        </option>
                      )
                    )}
                  </select>
                </div>
              </div>

              {/* CUSTOMER */}
              <div className="mt-7 grid gap-3 sm:grid-cols-2">

                <input
                  value={name}
                  onChange={(e) =>
                    setName(
                      e.target
                        .value
                    )
                  }
                  placeholder="Ad Soyad"
                  className="h-12 rounded-xl border border-white/10 bg-white/[0.04] px-4 text-[11px] font-semibold text-white outline-none placeholder:text-slate-600 focus:border-blue-400"
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
                  className="h-12 rounded-xl border border-white/10 bg-white/[0.04] px-4 text-[11px] font-semibold text-white outline-none placeholder:text-slate-600 focus:border-blue-400"
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
                  className="h-12 rounded-xl border border-white/10 bg-white/[0.04] px-4 text-[11px] font-semibold text-white outline-none placeholder:text-slate-600 focus:border-blue-400 sm:col-span-2"
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
                className="mt-6 flex h-14 w-full items-center justify-center gap-4 rounded-xl bg-gradient-to-r from-[#6bb9ff] via-[#7f98ff] to-[#a879ff] text-[13px] font-black text-[#07101f] shadow-[0_12px_35px_rgba(92,129,255,.25)] transition hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-50"
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

            {/* SUMMARY */}
            <aside className="border-t border-white/10 bg-black/20 p-6 lg:border-l lg:border-t-0 lg:p-8">

              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-300">
                SEÇİMİNİZ
              </div>

              <div className="mt-5 flex items-center gap-5">

                {isDuo ? (
                  <div className="origin-left scale-[0.38]">
                    <DuoMockup
                      color={
                        selectedColor.swatch
                      }
                    />
                  </div>
                ) : (
                  <div className="h-[105px] w-[54px] overflow-hidden">
                    <div className="origin-top-left scale-[0.255]">
                      <PhoneMockup
                        color={
                          selectedColor.swatch
                        }
                        highlight={
                          selectedColor.highlight
                        }
                      />
                    </div>
                  </div>
                )}

                <div className="-ml-1">

                  <div className="text-[19px] font-black">
                    {model}
                  </div>

                  <div className="mt-1 text-[11px] font-semibold text-slate-500">
                    {modelLabel}
                  </div>

                  <div className="mt-3 text-[11px] font-bold text-slate-300">
                    {storage}
                    {" · "}
                    {color}
                  </div>
                </div>
              </div>

              <div className="mt-7 border-t border-white/10 pt-6">

                <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500">
                  Apple Başlangıç Fiyatı
                </div>

                <div className="mt-1 text-[32px] font-black tracking-[-1px]">
                  {money(
                    currentPrice
                  )}
                </div>
              </div>

              {!isPreRequest && (
                <div className="mt-5">

                  <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500">
                    Ön Sipariş Kaporası
                  </div>

                  <div className="mt-1 text-[24px] font-black">
                    {money(
                      DEPOSIT
                    )}
                  </div>
                </div>
              )}

              <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.04] p-4">

                <div className="flex items-start gap-3">

                  <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-blue-300">
                    i
                  </div>

                  <p className="text-[10px] font-medium leading-5 text-slate-400">

                    {isPreRequest
                      ? "iPhone Duo için şu an ön talep alınmaktadır. Ön sipariş açıldığında sizinle iletişime geçilecektir."
                      : "Talebiniz Telegram üzerinden CNETMOBİL ekibine iletilir. Ödeme bu sayfa üzerinden alınmaz."}
                  </p>
                </div>
              </div>
            </aside>
          </div>
        </form>
      </section>

      {/* FEATURE CARDS */}
      <section className="mx-auto max-w-[1450px] px-5 pb-12 lg:px-8">

        <div className="grid gap-3 md:grid-cols-4">

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">

            <div className="text-blue-400">
              <CheckIcon />
            </div>

            <div className="mt-3 text-[13px] font-black">
              iPhone 18 Pro
            </div>

            <div className="mt-1 text-[10px] font-medium text-slate-500">
              Ön sipariş aktif.
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">

            <div className="text-blue-400">
              <CheckIcon />
            </div>

            <div className="mt-3 text-[13px] font-black">
              iPhone 18 Pro Max
            </div>

            <div className="mt-1 text-[10px] font-medium text-slate-500">
              Ön sipariş aktif.
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">

            <div className="text-blue-400">
              <ShieldIcon />
            </div>

            <div className="mt-3 text-[13px] font-black">
              CNETMOBİL Güvencesi
            </div>

            <div className="mt-1 text-[10px] font-medium text-slate-500">
              Talebiniz ekip tarafından teyit edilir.
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">

            <div className="text-blue-400">
              <StoreIcon />
            </div>

            <div className="mt-3 text-[13px] font-black">
              Mağazadan Teslim
            </div>

            <div className="mt-1 text-[10px] font-medium text-slate-500">
              İstediğiniz mağazayı seçin.
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between gap-4 rounded-2xl border border-blue-400/20 bg-blue-500/10 px-5 py-4">

          <div className="flex items-center gap-3">

            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500 text-sm font-black">
              i
            </div>

            <div className="text-[11px] font-semibold text-blue-100">
              iPhone Duo için ön siparişler
              {" "}
              <strong>
                16 Ekim 2026 saat 15:00
              </strong>
              'te başlayacak.
            </div>
          </div>

          <span className="hidden text-lg text-blue-300 sm:block">
            →
          </span>
        </div>
      </section>

      <footer className="border-t border-white/10 bg-[#03060d]">

        <div className="mx-auto flex max-w-[1450px] flex-col gap-3 px-5 py-8 text-[10px] font-medium text-slate-600 sm:flex-row sm:items-center sm:justify-between lg:px-8">

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
