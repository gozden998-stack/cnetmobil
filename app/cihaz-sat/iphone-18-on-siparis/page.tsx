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

export default function Iphone18PreorderPage() {
  const [
    modalOpen,
    setModalOpen,
  ] = useState(false);

  const [
    model,
    setModel,
  ] = useState<Model>(
    "iPhone 18 Pro"
  );

  const [
    storage,
    setStorage,
  ] = useState<Storage>(
    "256 GB"
  );

  const [
    color,
    setColor,
  ] = useState("Siyah");

  const [
    store,
    setStore,
  ] = useState("");

  const [
    name,
    setName,
  ] = useState("");

  const [
    phone,
    setPhone,
  ] = useState("");

  const [
    note,
    setNote,
  ] = useState("");

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const [
    success,
    setSuccess,
  ] = useState("");

  const colors =
    COLORS[model];

  const price =
    PRICES[model][storage];

  const isDuo =
    model === "iPhone Duo";

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

  useEffect(() => {
    if (modalOpen) {
      document.body.style.overflow =
        "hidden";
    } else {
      document.body.style.overflow =
        "";
    }

    return () => {
      document.body.style.overflow =
        "";
    };
  }, [modalOpen]);

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

  function openModal(
    selectedModel?: Model
  ) {
    if (selectedModel) {
      setModel(
        selectedModel
      );

      setColor(
        COLORS[
          selectedModel
        ][0].name
      );
    }

    setError("");
    setSuccess("");
    setModalOpen(true);
  }

  function closeModal() {
    if (loading) {
      return;
    }

    setModalOpen(false);
    setError("");
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
        "Geçerli bir telefon numarası girin."
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
        isDuo
          ? "Talebiniz başarıyla alındı."
          : "Ön sipariş talebiniz başarıyla alındı."
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

      {/* ===================================== */}
      {/* NAVBAR */}
      {/* ===================================== */}

      <header className="relative z-50 border-b border-white/[0.07] bg-[#02060d]/95 backdrop-blur-xl">

        <div className="mx-auto flex h-[72px] max-w-[1500px] items-center justify-between px-5 lg:px-8">

          <a
            href="/cihaz-sat"
            className="text-[26px] font-black tracking-[-1.6px]"
          >
            CNET

            <span className="font-medium text-[#4ea7ff]">
              MOBİL
            </span>
          </a>

          <nav className="hidden items-center gap-10 text-[12px] font-bold text-slate-400 lg:flex">

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

            <button
              type="button"
              onClick={() =>
                openModal()
              }
              className="transition hover:text-white"
            >
              Ön Sipariş
            </button>
          </nav>

          <button
            type="button"
            onClick={() =>
              openModal()
            }
            className="rounded-[13px] border border-blue-400/25 bg-blue-500/[0.08] px-5 py-3 text-[11px] font-black text-blue-100 transition hover:border-blue-400/50 hover:bg-blue-500/15"
          >
            Ön Sipariş Ver
          </button>
        </div>
      </header>

      {/* ===================================== */}
      {/* HERO */}
      {/* ===================================== */}

      <section className="relative min-h-[760px] overflow-hidden">

        {/* BACKGROUND */}

        <div className="absolute inset-0 bg-[radial-gradient(circle_at_73%_28%,rgba(31,105,255,.38),transparent_30%),radial-gradient(circle_at_24%_88%,rgba(89,50,190,.18),transparent_32%),linear-gradient(115deg,#02060d_0%,#071328_54%,#02060d_100%)]" />

        {/* PLANET */}

        <div className="absolute -right-[290px] -top-[590px] h-[1190px] w-[1190px] rounded-full border-[2px] border-blue-300/25 shadow-[0_0_100px_rgba(58,128,255,.42)]" />

        <div className="absolute right-[8%] top-[15%] h-[400px] w-[740px] bg-blue-500/15 blur-[135px]" />

        {/* MOUNTAINS */}

        <div
          className="absolute bottom-0 left-0 h-[240px] w-[48%] bg-[#07101c]/90"
          style={{
            clipPath:
              "polygon(0 74%, 12% 57%, 25% 70%, 37% 36%, 48% 64%, 61% 44%, 75% 71%, 88% 49%, 100% 73%, 100% 100%, 0 100%)",
          }}
        />

        <div
          className="absolute bottom-0 right-0 h-[245px] w-[45%] bg-[#06101d]/90"
          style={{
            clipPath:
              "polygon(0 70%, 15% 45%, 29% 66%, 43% 35%, 58% 65%, 72% 48%, 88% 70%, 100% 58%, 100% 100%, 0 100%)",
          }}
        />

        <div className="absolute bottom-0 left-0 right-0 h-[200px] bg-gradient-to-t from-[#02060d] via-[#02060d]/75 to-transparent" />

        <div className="relative mx-auto grid min-h-[690px] max-w-[1500px] items-center gap-8 px-5 py-16 lg:grid-cols-[0.90fr_1.10fr] lg:px-8">

          {/* LEFT HERO */}

          <div className="relative z-20">

            <div className="text-[11px] font-black uppercase tracking-[0.42em] text-blue-200/75">
              DAHA FAZLASI SENİN ELİNDE
            </div>

            <h1 className="mt-5 max-w-[700px] text-[55px] font-black leading-[0.94] tracking-[-3px] sm:text-[70px] xl:text-[80px]">

              Yeni Seri

              <span className="block bg-gradient-to-r from-[#6bbcff] via-[#8b9fff] to-[#ba7aff] bg-clip-text text-transparent">
                Ön Siparişe Açıldı
              </span>
            </h1>

            <h2 className="mt-7 text-[27px] font-black tracking-[-0.8px]">
              iPhone 18 Pro & Pro Max
            </h2>

            <p className="mt-3 max-w-[570px] text-[15px] font-medium leading-7 text-slate-400">
              Yeni renkler, güçlü performans
              ve CNETMOBİL ön sipariş deneyimi.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">

              <button
                type="button"
                onClick={() =>
                  openModal()
                }
                className="group flex h-[56px] items-center gap-5 rounded-full bg-white px-8 text-[13px] font-black text-[#07101c] shadow-[0_15px_45px_rgba(255,255,255,.08)] transition hover:-translate-y-1"
              >
                Ön Sipariş Ver

                <span className="text-xl transition-transform group-hover:translate-x-1">
                  →
                </span>
              </button>

              <a
                href="#modeller"
                className="flex h-[56px] items-center gap-4 rounded-full border border-white/20 bg-white/[0.035] px-8 text-[13px] font-black transition hover:bg-white/[0.08]"
              >
                Modelleri İncele
              </a>
            </div>
          </div>

          {/* HERO IMAGE */}

          <div className="relative hidden h-[570px] items-center justify-center lg:flex">

            <div className="absolute bottom-[70px] h-[75px] w-[80%] rounded-full bg-blue-400/20 blur-[45px]" />

            <img
              src="/iphone18-hero.webp"
              alt="iPhone 18 Pro"
              className="relative z-10 max-h-[535px] w-full max-w-[800px] object-contain drop-shadow-[0_45px_70px_rgba(0,0,0,.78)]"
            />
          </div>
        </div>
      </section>

      {/* ===================================== */}
      {/* MODELS */}
      {/* ===================================== */}

      <section
        id="modeller"
        className="relative z-20 mx-auto max-w-[1450px] px-5 pb-24 pt-10"
      >

        <div className="mb-9">

          <div className="text-[10px] font-black uppercase tracking-[0.28em] text-blue-400">
            iPHONE 18 SERİSİ
          </div>

          <div className="mt-2 flex items-end justify-between gap-5">

            <h2 className="text-[33px] font-black tracking-[-1px]">
              Modelini Seç
            </h2>

            <span className="hidden text-[11px] font-semibold text-slate-600 md:block">
              Modeli seçerek devam edin
            </span>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">

          {MODELS.map(
            (item) => {

              const itemColors =
                COLORS[item];

              const duo =
                item === "iPhone Duo";

              return (
                <button
                  key={item}
                  type="button"
                  onClick={() =>
                    openModal(item)
                  }
                  className="group relative min-h-[280px] overflow-hidden rounded-[30px] border border-white/[0.09] bg-gradient-to-br from-white/[0.055] to-white/[0.015] p-7 text-left transition-all duration-300 hover:-translate-y-1.5 hover:border-blue-400/35 hover:shadow-[0_25px_70px_rgba(0,0,0,.40)]"
                >

                  <div className="absolute -right-20 -top-20 h-52 w-52 rounded-full bg-blue-500/[0.08] blur-3xl transition group-hover:bg-blue-500/[0.14]" />

                  <div className="relative">

                    <div className="flex items-start justify-between">

                      <div>

                        <div className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-600">
                          Başlangıç
                        </div>

                        <div className="mt-1 text-[20px] font-black">
                          {money(
                            PRICES[
                              item
                            ][
                              "256 GB"
                            ]
                          )}
                        </div>
                      </div>

                      <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.03] text-blue-300 transition group-hover:border-blue-400/30 group-hover:bg-blue-500/10">
                        →
                      </div>
                    </div>

                    <h3 className="mt-10 text-[27px] font-black tracking-[-0.6px]">
                      {item}
                    </h3>

                    <p className="mt-2 text-[11px] font-semibold text-slate-500">

                      {item ===
                      "iPhone 18 Pro"
                        ? "Profesyoneller için tasarlandı."
                        : item ===
                          "iPhone 18 Pro Max"
                        ? "Daha büyük. Daha güçlü."
                        : "Yeni bir dönemin başlangıcı."}
                    </p>

                    <div className="mt-6 flex items-center gap-2">

                      {itemColors.map(
                        (
                          itemColor
                        ) => (

                          <span
                            key={
                              itemColor.name
                            }
                            title={
                              itemColor.name
                            }
                            className="h-7 w-7 rounded-full border-2 border-white/[0.12] shadow-lg"
                            style={{
                              backgroundColor:
                                itemColor.value,
                            }}
                          />
                        )
                      )}
                    </div>

                    <div className="mt-8 text-[11px] font-black text-blue-300">

                      {duo
                        ? "Talep Ver"
                        : "Ön Sipariş Ver"}

                    </div>
                  </div>
                </button>
              );
            }
          )}
        </div>
      </section>

      {/* ===================================== */}
      {/* PREMIUM MODAL */}
      {/* ===================================== */}

      {modalOpen && (

        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-[#01040a]/90 p-3 backdrop-blur-xl md:p-6"
          onMouseDown={(
            event
          ) => {

            if (
              event.target ===
              event.currentTarget
            ) {
              closeModal();
            }
          }}
        >

          <form
            onSubmit={submit}
            className="relative max-h-[95vh] w-full max-w-[1220px] overflow-y-auto rounded-[34px] border border-white/[0.10] bg-[#07101e] shadow-[0_50px_180px_rgba(0,0,0,.85)]"
          >

            <div className="pointer-events-none absolute left-[15%] top-[-160px] h-[320px] w-[520px] rounded-full bg-blue-500/10 blur-[110px]" />

            <div className="pointer-events-none absolute right-[5%] top-[-120px] h-[300px] w-[380px] rounded-full bg-violet-500/10 blur-[100px]" />

            {/* MODAL HEADER */}

            <div className="sticky top-0 z-30 flex items-center justify-between border-b border-white/[0.08] bg-[#07101e]/95 px-6 py-5 backdrop-blur-xl md:px-8">

              <div className="flex items-center gap-4">

                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-blue-400/20 bg-gradient-to-br from-blue-500/20 to-violet-500/10 shadow-lg">

                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    className="text-blue-300"
                  >
                    <path d="M4 7h16v13H4z" />

                    <path d="M8 7V5a4 4 0 018 0v2" />

                    <path d="M9 12h6" />
                  </svg>
                </div>

                <div>

                  <div className="text-[9px] font-black uppercase tracking-[0.32em] text-blue-400">

                    {isDuo
                      ? "iPHONE DUO"
                      : "iPHONE 18"}

                  </div>

                  <h2 className="mt-1 text-[23px] font-black tracking-[-0.5px] text-white">

                    {isDuo
                      ? "Talebini Oluştur"
                      : "Ön Siparişini Oluştur"}

                  </h2>
                </div>
              </div>

              <button
                type="button"
                onClick={
                  closeModal
                }
                className="group flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/[0.035] text-slate-500 transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
              >

                <svg
                  width="19"
                  height="19"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  className="transition-transform group-hover:rotate-90"
                >
                  <path
                    strokeLinecap="round"
                    d="M6 6l12 12M18 6 6 18"
                  />
                </svg>
              </button>
            </div>

            <div className="relative grid lg:grid-cols-[1fr_390px]">

              {/* ===================================== */}
              {/* LEFT FORM */}
              {/* ===================================== */}

              <div className="p-6 md:p-8 lg:p-9">

                {/* MODEL */}

                <section>

                  <div className="mb-4 flex items-center gap-3">

                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/10 text-[10px] font-black text-blue-400">
                      01
                    </span>

                    <div>

                      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                        Model
                      </div>

                      <div className="mt-0.5 text-[12px] font-semibold text-slate-300">
                        Hangi modeli istiyorsunuz?
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-3">

                    {MODELS.map(
                      (item) => {

                        const active =
                          model === item;

                        return (
                          <button
                            key={
                              item
                            }
                            type="button"
                            onClick={() =>
                              selectModel(
                                item
                              )
                            }
                            className={`relative min-h-[92px] overflow-hidden rounded-[19px] border p-4 text-left transition-all ${
                              active
                                ? "border-[#2ca7ff] bg-gradient-to-br from-blue-500/15 to-violet-500/[0.04] shadow-[0_0_0_1px_rgba(44,167,255,.1),0_15px_40px_rgba(0,0,0,.18)]"
                                : "border-white/[0.08] bg-white/[0.025] hover:border-white/[0.18] hover:bg-white/[0.045]"
                            }`}
                          >

                            {active && (
                              <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-[#2ca7ff] text-[9px] font-black text-white shadow-lg">
                                ✓
                              </span>
                            )}

                            <div className="pr-6 text-[13px] font-black text-white">
                              {item}
                            </div>

                            <div className="mt-2 text-[9px] font-semibold text-slate-500">

                              {item ===
                              "iPhone 18 Pro"
                                ? "Profesyoneller için."
                                : item ===
                                  "iPhone 18 Pro Max"
                                ? "Daha büyük. Daha güçlü."
                                : "Yeni bir dönem."}

                            </div>

                            <div className="mt-3 text-[10px] font-black text-blue-300">

                              {money(
                                PRICES[
                                  item
                                ][
                                  "256 GB"
                                ]
                              )}

                              <span className="ml-1 font-medium text-slate-600">
                                başlangıç
                              </span>
                            </div>
                          </button>
                        );
                      }
                    )}
                  </div>
                </section>

                {/* STORAGE */}

                <section className="mt-8">

                  <div className="mb-4 flex items-center gap-3">

                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/10 text-[10px] font-black text-blue-400">
                      02
                    </span>

                    <div>

                      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                        Depolama
                      </div>

                      <div className="mt-0.5 text-[12px] font-semibold text-slate-300">
                        Size uygun kapasiteyi seçin
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">

                    {STORAGES.map(
                      (item) => {

                        const active =
                          storage === item;

                        return (
                          <button
                            key={
                              item
                            }
                            type="button"
                            onClick={() =>
                              setStorage(
                                item
                              )
                            }
                            className={`relative rounded-[17px] border px-4 py-4 text-left transition-all ${
                              active
                                ? "border-[#2ca7ff] bg-blue-500/10 shadow-[0_8px_25px_rgba(0,0,0,.15)]"
                                : "border-white/[0.08] bg-white/[0.025] hover:border-white/[0.18]"
                            }`}
                          >

                            <div className="text-[15px] font-black text-white">
                              {item}
                            </div>

                            <div
                              className={`mt-2 text-[10px] font-bold ${
                                active
                                  ? "text-blue-300"
                                  : "text-slate-500"
                              }`}
                            >
                              {money(
                                PRICES[
                                  model
                                ][
                                  item
                                ]
                              )}
                            </div>

                            {active && (
                              <div className="absolute bottom-0 left-4 right-4 h-[2px] rounded-full bg-gradient-to-r from-blue-400 to-violet-400" />
                            )}
                          </button>
                        );
                      }
                    )}
                  </div>
                </section>

                {/* COLOR */}

                <section className="mt-8">

                  <div className="mb-4 flex items-center gap-3">

                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/10 text-[10px] font-black text-blue-400">
                      03
                    </span>

                    <div>

                      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                        Renk
                      </div>

                      <div className="mt-0.5 text-[12px] font-semibold text-slate-300">
                        Lansman renginizi seçin
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3">

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
                            className={`flex min-w-[125px] items-center gap-3 rounded-[15px] border px-3.5 py-3 transition ${
                              active
                                ? "border-[#2ca7ff] bg-blue-500/10"
                                : "border-white/[0.08] bg-white/[0.025] hover:border-white/[0.18]"
                            }`}
                          >

                            <span
                              className={`relative h-9 w-9 shrink-0 rounded-full border-2 ${
                                active
                                  ? "border-[#2ca7ff]"
                                  : "border-white/10"
                              }`}
                              style={{
                                backgroundColor:
                                  item.value,
                              }}
                            >

                              {active && (
                                <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#2ca7ff] text-[8px] text-white">
                                  ✓
                                </span>
                              )}
                            </span>

                            <span className="text-left text-[10px] font-black text-slate-200">
                              {item.name}
                            </span>
                          </button>
                        );
                      }
                    )}
                  </div>
                </section>

                {/* STORE */}

                <section className="mt-8">

                  <div className="mb-4 flex items-center gap-3">

                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/10 text-[10px] font-black text-blue-400">
                      04
                    </span>

                    <div>

                      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                        Teslimat
                      </div>

                      <div className="mt-0.5 text-[12px] font-semibold text-slate-300">
                        Cihazınızı alacağınız mağazayı seçin
                      </div>
                    </div>
                  </div>

                  <div className="relative">

                    <svg
                      width="19"
                      height="19"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-blue-400"
                    >
                      <path d="M4 10v10h16V10" />

                      <path d="M3 10 5 4h14l2 6" />

                      <path d="M8 20v-6h8v6" />
                    </svg>

                    <select
                      value={
                        store
                      }
                      onChange={(
                        event
                      ) =>
                        setStore(
                          event
                            .target
                            .value
                        )
                      }
                      className="h-[58px] w-full appearance-none rounded-[16px] border border-white/[0.09] bg-[#0c1626] pl-12 pr-12 text-[11px] font-bold text-white outline-none transition focus:border-[#2ca7ff] focus:ring-4 focus:ring-blue-500/[0.05]"
                    >

                      <option value="">
                        Teslim mağazasını seçin
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

                    <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-500">
                      ▾
                    </span>
                  </div>
                </section>

                {/* CUSTOMER */}

                <section className="mt-8">

                  <div className="mb-4 flex items-center gap-3">

                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/10 text-[10px] font-black text-blue-400">
                      05
                    </span>

                    <div>

                      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                        İletişim
                      </div>

                      <div className="mt-0.5 text-[12px] font-semibold text-slate-300">
                        Size ulaşabilmemiz için bilgilerinizi girin
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">

                    <div>

                      <label className="mb-2 block text-[9px] font-bold text-slate-500">
                        AD SOYAD
                      </label>

                      <input
                        value={
                          name
                        }
                        onChange={(
                          event
                        ) =>
                          setName(
                            event
                              .target
                              .value
                          )
                        }
                        placeholder="Adınız Soyadınız"
                        className="h-[54px] w-full rounded-[15px] border border-white/[0.08] bg-white/[0.025] px-4 text-[11px] font-semibold text-white outline-none transition placeholder:text-slate-600 focus:border-[#2ca7ff] focus:bg-blue-500/[0.03]"
                      />
                    </div>

                    <div>

                      <label className="mb-2 block text-[9px] font-bold text-slate-500">
                        TELEFON
                      </label>

                      <input
                        type="tel"
                        value={
                          phone
                        }
                        onChange={(
                          event
                        ) =>
                          setPhone(
                            event
                              .target
                              .value
                          )
                        }
                        placeholder="05xx xxx xx xx"
                        className="h-[54px] w-full rounded-[15px] border border-white/[0.08] bg-white/[0.025] px-4 text-[11px] font-semibold text-white outline-none transition placeholder:text-slate-600 focus:border-[#2ca7ff] focus:bg-blue-500/[0.03]"
                      />
                    </div>

                    <div className="md:col-span-2">

                      <label className="mb-2 block text-[9px] font-bold text-slate-500">
                        NOT
                      </label>

                      <textarea
                        value={
                          note
                        }
                        onChange={(
                          event
                        ) =>
                          setNote(
                            event
                              .target
                              .value
                          )
                        }
                        rows={3}
                        placeholder="Varsa eklemek istediğiniz not..."
                        className="w-full resize-none rounded-[15px] border border-white/[0.08] bg-white/[0.025] p-4 text-[11px] font-semibold text-white outline-none transition placeholder:text-slate-600 focus:border-[#2ca7ff] focus:bg-blue-500/[0.03]"
                      />
                    </div>
                  </div>
                </section>

                {/* ERROR */}

                {error && (

                  <div className="mt-5 flex items-center gap-3 rounded-[15px] border border-rose-400/20 bg-rose-500/[0.08] px-4 py-3 text-[11px] font-bold text-rose-300">

                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-rose-500/15">
                      !
                    </span>

                    {error}
                  </div>
                )}

                {/* SUCCESS */}

                {success && (

                  <div className="mt-5 flex items-center gap-3 rounded-[15px] border border-emerald-400/20 bg-emerald-500/[0.08] px-4 py-3 text-[11px] font-bold text-emerald-300">

                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/15">
                      ✓
                    </span>

                    {success}
                  </div>
                )}
              </div>

              {/* ===================================== */}
              {/* RIGHT SUMMARY */}
              {/* ===================================== */}

              <aside className="border-t border-white/[0.08] bg-[#040b15]/75 p-6 lg:border-l lg:border-t-0 md:p-8">

                <div className="lg:sticky lg:top-[100px]">

                  <div className="flex items-center justify-between">

                    <div className="text-[9px] font-black uppercase tracking-[0.30em] text-blue-400">
                      SEÇİMİNİZ
                    </div>

                    <span className="rounded-full border border-emerald-400/15 bg-emerald-500/[0.07] px-3 py-1.5 text-[8px] font-black text-emerald-300">
                      SEÇİLİ
                    </span>
                  </div>

                  {/* PRODUCT IMAGE */}

                  <div className="relative mt-6 overflow-hidden rounded-[24px] border border-white/[0.08] bg-[radial-gradient(circle_at_50%_20%,rgba(55,130,255,.15),transparent_50%),linear-gradient(180deg,#0b1525,#050b13)] p-5">

                    <div className="absolute right-[-40px] top-[-40px] h-32 w-32 rounded-full bg-violet-500/10 blur-3xl" />

                    <img
                      src="/iphone18-hero.webp"
                      alt={model}
                      className="relative mx-auto h-[155px] w-full object-contain drop-shadow-[0_25px_35px_rgba(0,0,0,.55)]"
                    />

                    <div className="relative mt-3 text-center">

                      <div className="text-[21px] font-black tracking-[-0.5px]">
                        {model}
                      </div>

                      <div className="mt-1 text-[10px] font-semibold text-slate-500">
                        {description}
                      </div>
                    </div>
                  </div>

                  {/* CONFIG */}

                  <div className="mt-5 grid grid-cols-2 gap-3">

                    <div className="rounded-[16px] border border-white/[0.07] bg-white/[0.025] p-4">

                      <div className="text-[8px] font-black uppercase tracking-wider text-slate-600">
                        Depolama
                      </div>

                      <div className="mt-1 text-[13px] font-black">
                        {storage}
                      </div>
                    </div>

                    <div className="rounded-[16px] border border-white/[0.07] bg-white/[0.025] p-4">

                      <div className="text-[8px] font-black uppercase tracking-wider text-slate-600">
                        Renk
                      </div>

                      <div className="mt-2 flex items-center gap-2">

                        <span
                          className="h-4 w-4 rounded-full border border-white/20"
                          style={{
                            backgroundColor:
                              selectedColor.value,
                          }}
                        />

                        <span className="text-[10px] font-black">
                          {color}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* PRICE */}

                  <div className="mt-6 border-t border-white/[0.08] pt-6">

                    <div className="flex items-end justify-between gap-4">

                      <div>

                        <div className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-600">
                          Cihaz Fiyatı
                        </div>

                        <div className="mt-1 text-[38px] font-black tracking-[-1.5px] text-white">
                          {money(
                            price
                          )}
                        </div>
                      </div>

                      <div className="mb-1 rounded-lg bg-blue-500/10 px-2.5 py-1.5 text-[8px] font-black text-blue-300">
                        {storage}
                      </div>
                    </div>
                  </div>

                  {/* STORE SUMMARY */}

                  <div className="mt-5 rounded-[16px] border border-white/[0.07] bg-white/[0.025] p-4">

                    <div className="text-[8px] font-black uppercase tracking-wider text-slate-600">
                      Teslim Mağazası
                    </div>

                    <div className="mt-1.5 flex items-center gap-2 text-[11px] font-black text-slate-200">

                      <span className="text-blue-400">
                        ◉
                      </span>

                      {store ||
                        "Henüz seçilmedi"}
                    </div>
                  </div>

                  {/* CTA */}

                  <button
                    type="submit"
                    disabled={
                      loading
                    }
                    className="group mt-6 flex h-[60px] w-full items-center justify-center gap-4 rounded-[16px] bg-gradient-to-r from-[#5abfff] via-[#8295ff] to-[#ad64ff] text-[13px] font-black text-[#04101d] shadow-[0_15px_45px_rgba(83,129,255,.22)] transition-all hover:-translate-y-0.5 hover:shadow-[0_20px_55px_rgba(83,129,255,.32)] disabled:cursor-wait disabled:opacity-50"
                  >

                    {loading
                      ? "Gönderiliyor..."
                      : isDuo
                      ? "Talep Ver"
                      : "Ön Sipariş Ver"}

                    {!loading && (
                      <span className="text-[20px] transition-transform group-hover:translate-x-1">
                        →
                      </span>
                    )}
                  </button>

                  <div className="mt-4 text-center text-[9px] font-semibold text-slate-600">

                    {isDuo
                      ? "iPhone Duo talebinizi oluşturun."
                      : "Seçiminizi tamamlayarak ön sipariş talebinizi oluşturun."}

                  </div>
                </div>
              </aside>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
