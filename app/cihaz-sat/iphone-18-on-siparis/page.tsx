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
  const [modalOpen, setModalOpen] =
    useState(false);

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

  function openModal(
    selectedModel?: Model
  ) {
    if (selectedModel) {
      setModel(selectedModel);

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
    if (loading) return;

    setModalOpen(false);
    setError("");
  }

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
            className="rounded-xl border border-blue-400/30 bg-blue-500/10 px-5 py-3 text-[11px] font-black text-blue-100 transition hover:bg-blue-500/20"
          >
            Ön Sipariş Ver
          </button>
        </div>
      </header>

      {/* HERO */}

      <section className="relative min-h-[760px] overflow-hidden">

        <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_25%,rgba(36,116,255,.38),transparent_31%),radial-gradient(circle_at_22%_85%,rgba(78,47,180,.20),transparent_30%),linear-gradient(115deg,#02060d_0%,#08152b_55%,#02060d_100%)]" />

        {/* GEZEGEN */}

        <div className="absolute -right-[290px] -top-[580px] h-[1180px] w-[1180px] rounded-full border-[2px] border-blue-300/25 shadow-[0_0_95px_rgba(69,134,255,.40)]" />

        <div className="absolute right-[8%] top-[16%] h-[380px] w-[720px] bg-blue-500/15 blur-[130px]" />

        {/* DAĞLAR */}

        <div
          className="absolute bottom-0 left-0 h-[240px] w-[48%] bg-[#07101c]/90"
          style={{
            clipPath:
              "polygon(0 72%, 13% 55%, 24% 69%, 36% 36%, 48% 65%, 61% 43%, 75% 70%, 88% 48%, 100% 72%, 100% 100%, 0 100%)",
          }}
        />

        <div
          className="absolute bottom-0 right-0 h-[250px] w-[45%] bg-[#06101d]/90"
          style={{
            clipPath:
              "polygon(0 71%, 15% 45%, 29% 66%, 43% 35%, 58% 65%, 72% 48%, 88% 70%, 100% 58%, 100% 100%, 0 100%)",
          }}
        />

        <div className="absolute bottom-0 left-0 right-0 h-[190px] bg-gradient-to-t from-[#02060d] via-[#02060d]/75 to-transparent" />

        <div className="relative mx-auto grid max-w-[1500px] items-center gap-8 px-5 py-16 lg:grid-cols-[0.92fr_1.08fr] lg:px-8">

          {/* SOL */}

          <div className="relative z-20">

            <div className="text-[11px] font-black uppercase tracking-[0.42em] text-blue-200/75">
              DAHA FAZLASI SENİN ELİNDE
            </div>

            <h1 className="mt-5 max-w-[670px] text-[55px] font-black leading-[0.95] tracking-[-3px] sm:text-[70px] xl:text-[80px]">

              Yeni Seri

              <span className="block bg-gradient-to-r from-[#71c1ff] via-[#84a0ff] to-[#b87cff] bg-clip-text text-transparent">
                Ön Siparişe Açıldı
              </span>
            </h1>

            <h2 className="mt-7 text-[27px] font-black tracking-[-0.8px]">
              iPhone 18 Pro & Pro Max
            </h2>

            <p className="mt-3 max-w-[570px] text-[15px] font-medium leading-7 text-slate-400">
              Yeni renkler, güçlü
              performans ve
              CNETMOBİL ön sipariş
              deneyimi.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">

              <button
                type="button"
                onClick={() =>
                  openModal()
                }
                className="flex h-[56px] items-center gap-5 rounded-full bg-white px-8 text-[13px] font-black text-[#07101c] shadow-xl transition hover:-translate-y-1"
              >
                Ön Sipariş Ver

                <span className="text-xl">
                  →
                </span>
              </button>

              <a
                href="#modeller"
                className="flex h-[56px] items-center gap-4 rounded-full border border-white/20 bg-white/[0.04] px-8 text-[13px] font-black transition hover:bg-white/10"
              >
                Modelleri İncele
              </a>
            </div>
          </div>

          {/* TELEFON GÖRSELİ */}

          <div className="relative hidden h-[570px] items-center justify-center lg:flex">

            <div className="absolute bottom-[70px] h-[70px] w-[80%] rounded-full bg-blue-400/20 blur-[40px]" />

            <img
              src="/iphone18-hero.webp"
              alt="iPhone 18 Pro"
              className="relative z-10 max-h-[530px] w-full max-w-[780px] object-contain drop-shadow-[0_45px_65px_rgba(0,0,0,.75)]"
            />
          </div>
        </div>
      </section>

      {/* MODELLER */}

      <section
        id="modeller"
        className="relative z-20 mx-auto max-w-[1450px] px-5 pb-20 pt-5"
      >

        <div className="mb-8">

          <div className="text-[10px] font-black uppercase tracking-[0.25em] text-blue-400">
            iPHONE 18 SERİSİ
          </div>

          <h2 className="mt-2 text-[32px] font-black tracking-[-1px]">
            Modelini Seç
          </h2>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">

          {MODELS.map(
            (item) => {

              const itemColors =
                COLORS[item];

              return (
                <button
                  key={item}
                  type="button"
                  onClick={() =>
                    openModal(
                      item
                    )
                  }
                  className="group relative overflow-hidden rounded-[28px] border border-white/[0.10] bg-gradient-to-br from-white/[0.06] to-white/[0.02] p-6 text-left transition-all hover:-translate-y-1 hover:border-blue-400/40 hover:shadow-[0_20px_60px_rgba(0,0,0,.35)]"
                >

                  <div className="absolute -right-14 -top-14 h-40 w-40 rounded-full bg-blue-500/10 blur-3xl transition group-hover:bg-blue-500/20" />

                  <div className="relative">

                    <div className="text-[11px] font-bold text-slate-500">
                      Başlangıç
                    </div>

                    <div className="mt-1 text-[18px] font-black">
                      {money(
                        PRICES[
                          item
                        ][
                          "256 GB"
                        ]
                      )}
                    </div>

                    <h3 className="mt-8 text-[25px] font-black">
                      {item}
                    </h3>

                    <p className="mt-2 text-[11px] font-semibold text-slate-500">

                      {item ===
                      "iPhone 18 Pro"
                        ? "Profesyoneller için."
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
                            className="h-6 w-6 rounded-full border border-white/20"
                            style={{
                              backgroundColor:
                                itemColor.value,
                            }}
                          />
                        )
                      )}
                    </div>

                    <div className="mt-8 flex items-center justify-between">

                      <span className="text-[11px] font-black text-blue-300">
                        {item ===
                        "iPhone Duo"
                          ? "Talep Ver"
                          : "Ön Sipariş Ver"}
                      </span>

                      <span className="text-xl text-blue-400 transition-transform group-hover:translate-x-1">
                        →
                      </span>
                    </div>
                  </div>
                </button>
              );
            }
          )}
        </div>
      </section>

      {/* MODAL */}

      {modalOpen && (

        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-3 backdrop-blur-md md:p-6"
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
            className="relative max-h-[94vh] w-full max-w-[1180px] overflow-y-auto rounded-[30px] border border-white/[0.12] bg-[#07101e] shadow-[0_40px_150px_rgba(0,0,0,.8)]"
          >

            {/* MODAL HEADER */}

            <div className="sticky top-0 z-20 flex items-center justify-between border-b border-white/[0.08] bg-[#07101e]/95 px-6 py-5 backdrop-blur-xl md:px-8">

              <div>

                <div className="text-[10px] font-black uppercase tracking-[0.25em] text-blue-400">

                  {isDuo
                    ? "iPHONE DUO"
                    : "iPHONE 18"}

                </div>

                <h2 className="mt-1 text-[22px] font-black">

                  {isDuo
                    ? "Talebini Oluştur"
                    : "Ön Siparişini Oluştur"}

                </h2>
              </div>

              <button
                type="button"
                onClick={
                  closeModal
                }
                className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-lg text-slate-400 transition hover:bg-white/10 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="grid lg:grid-cols-[1fr_380px]">

              {/* SOL */}

              <div className="p-6 md:p-8">

                {/* MODEL */}

                <div>

                  <label className="mb-3 block text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
                    Model
                  </label>

                  <div className="grid gap-3 md:grid-cols-3">

                    {MODELS.map(
                      (item) => {

                        const active =
                          model ===
                          item;

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
                            className={`rounded-[16px] border p-4 text-left transition ${
                              active
                                ? "border-[#2ca7ff] bg-blue-500/10"
                                : "border-white/[0.10] bg-white/[0.025] hover:border-white/20"
                            }`}
                          >

                            <div className="text-[12px] font-black">
                              {item}
                            </div>

                            <div className="mt-1 text-[9px] font-medium text-slate-500">

                              {item ===
                              "iPhone 18 Pro"
                                ? "Profesyoneller için."
                                : item ===
                                  "iPhone 18 Pro Max"
                                ? "Daha büyük. Daha güçlü."
                                : "Yeni bir dönem."}

                            </div>
                          </button>
                        );
                      }
                    )}
                  </div>
                </div>

                {/* STORAGE */}

                <div className="mt-7">

                  <label className="mb-3 block text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
                    Depolama
                  </label>

                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">

                    {STORAGES.map(
                      (item) => {

                        const active =
                          storage ===
                          item;

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
                            className={`rounded-[15px] border p-4 text-left transition ${
                              active
                                ? "border-[#2ca7ff] bg-blue-500/10"
                                : "border-white/[0.10] bg-white/[0.025]"
                            }`}
                          >

                            <div className="text-[13px] font-black">
                              {item}
                            </div>

                            <div className="mt-2 text-[10px] font-semibold text-slate-500">
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

                {/* COLOR */}

                <div className="mt-7">

                  <label className="mb-4 block text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
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
                            onClick={() =>
                              setColor(
                                item.name
                              )
                            }
                            className={`flex min-w-[105px] items-center gap-3 rounded-xl border px-3 py-3 transition ${
                              active
                                ? "border-[#2ca7ff] bg-blue-500/10"
                                : "border-white/[0.10] bg-white/[0.025]"
                            }`}
                          >

                            <span
                              className="h-7 w-7 shrink-0 rounded-full border border-white/20"
                              style={{
                                backgroundColor:
                                  item.value,
                              }}
                            />

                            <span className="text-left text-[9px] font-black">
                              {item.name}
                            </span>
                          </button>
                        );
                      }
                    )}
                  </div>
                </div>

                {/* STORE */}

                <div className="mt-7">

                  <label className="mb-3 block text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
                    Teslim Mağazası
                  </label>

                  <select
                    value={store}
                    onChange={(
                      event
                    ) =>
                      setStore(
                        event
                          .target
                          .value
                      )
                    }
                    className="h-[54px] w-full rounded-xl border border-white/[0.10] bg-[#0d1727] px-4 text-[11px] font-bold text-white outline-none focus:border-[#2ca7ff]"
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

                {/* CUSTOMER */}

                <div className="mt-7 grid gap-3 md:grid-cols-2">

                  <div>

                    <label className="mb-2 block text-[10px] font-bold text-slate-500">
                      Ad Soyad
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
                      className="h-[52px] w-full rounded-xl border border-white/[0.10] bg-white/[0.03] px-4 text-[11px] font-semibold outline-none placeholder:text-slate-600 focus:border-[#2ca7ff]"
                    />
                  </div>

                  <div>

                    <label className="mb-2 block text-[10px] font-bold text-slate-500">
                      Telefon
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
                      className="h-[52px] w-full rounded-xl border border-white/[0.10] bg-white/[0.03] px-4 text-[11px] font-semibold outline-none placeholder:text-slate-600 focus:border-[#2ca7ff]"
                    />
                  </div>

                  <div className="md:col-span-2">

                    <label className="mb-2 block text-[10px] font-bold text-slate-500">
                      Not
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
                      rows={
                        3
                      }
                      placeholder="Varsa eklemek istediğiniz not..."
                      className="w-full resize-none rounded-xl border border-white/[0.10] bg-white/[0.03] p-4 text-[11px] font-semibold outline-none placeholder:text-slate-600 focus:border-[#2ca7ff]"
                    />
                  </div>
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
              </div>

              {/* RIGHT SUMMARY */}

              <aside className="border-t border-white/[0.08] bg-[#040b15]/70 p-6 lg:border-l lg:border-t-0 md:p-8">

                <div className="text-[10px] font-black uppercase tracking-[0.25em] text-blue-400">
                  SEÇİMİNİZ
                </div>

                <div className="mt-7">

                  <div className="flex items-center gap-4">

                    <div
                      className="h-[76px] w-[54px] rounded-[15px] border border-white/10 shadow-lg"
                      style={{
                        background:
                          `linear-gradient(145deg, ${selectedColor.value}, #04070c)`,
                      }}
                    />

                    <div>

                      <h3 className="text-[20px] font-black">
                        {model}
                      </h3>

                      <div className="mt-1 text-[10px] font-semibold text-slate-500">
                        {description}
                      </div>

                      <div className="mt-2 text-[10px] font-bold text-slate-300">
                        {storage}
                        {" · "}
                        {color}
                      </div>
                    </div>
                  </div>

                  <div className="mt-8 border-t border-white/[0.08] pt-6">

                    <div className="text-[10px] font-semibold text-slate-500">
                      Fiyat
                    </div>

                    <div className="mt-1 text-[34px] font-black tracking-[-1px]">
                      {money(
                        price
                      )}
                    </div>
                  </div>

                  <div className="mt-5">

                    <div className="text-[10px] font-semibold text-slate-500">
                      Teslim Mağazası
                    </div>

                    <div className="mt-1 text-[12px] font-black">
                      {store ||
                        "Henüz seçilmedi"}
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={
                      loading
                    }
                    className="mt-8 flex h-[56px] w-full items-center justify-center gap-3 rounded-xl bg-gradient-to-r from-[#5fc2ff] via-[#7f9cff] to-[#a966ff] text-[13px] font-black text-[#06101d] shadow-[0_15px_40px_rgba(73,132,255,.20)] transition hover:-translate-y-0.5 disabled:opacity-50"
                  >

                    {loading
                      ? "Gönderiliyor..."
                      : isDuo
                      ? "Talep Ver"
                      : "Ön Sipariş Ver"}

                    {!loading && (
                      <span className="text-xl">
                        →
                      </span>
                    )}
                  </button>

                  <div className="mt-4 text-center text-[9px] font-semibold text-slate-600">

                    {isDuo
                      ? "iPhone Duo talebinizi oluşturun."
                      : "Ön sipariş talebinizi oluşturun."}

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
