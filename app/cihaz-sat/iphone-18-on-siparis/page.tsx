"use client";

import React, {
  FormEvent,
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

const COLOR_MAP: Record<
  Model,
  ColorOption[]
> = {
  "iPhone 18 Pro": [
    {
      name: "Siyah",
      swatch: "#202225",
    },
    {
      name: "Buzul Rengi",
      swatch: "#9fc4ec",
    },
    {
      name: "Burgonya",
      swatch: "#743248",
    },
    {
      name: "Gümüş Rengi",
      swatch: "#d9dde2",
    },
  ],

  "iPhone 18 Pro Max": [
    {
      name: "Siyah",
      swatch: "#202225",
    },
    {
      name: "Buzul Rengi",
      swatch: "#9fc4ec",
    },
    {
      name: "Burgonya",
      swatch: "#743248",
    },
    {
      name: "Gümüş Rengi",
      swatch: "#d9dde2",
    },
  ],

  "iPhone Duo": [
    {
      name: "Gece Rengi",
      swatch: "#111820",
    },
    {
      name: "Yıldız Rengi",
      swatch: "#e4ddd0",
    },
  ],
};

const STORES = [
  "CMR / Çerkezköy",
  "Cadde / Çerkezköy",
  "Saray",
  "Kapaklı",
];

const DEPOSIT_AMOUNT = 5000;

// 16 Ekim 2026 15:00 Türkiye saati
// UTC karşılığı: 12:00
const DUO_PREORDER_START =
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

  const [
    customerName,
    setCustomerName,
  ] = useState("");

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

  const price =
    PRICE_MAP[model][storage];

  const availableColors =
    COLOR_MAP[model];

  const selectedColor =
    availableColors.find(
      (item) =>
        item.name === color
    ) ||
    availableColors[0];

  const duoPreorderOpen =
    Date.now() >=
    DUO_PREORDER_START;

  const isDuo =
    model === "iPhone Duo";

  const isPreRequest =
    isDuo &&
    !duoPreorderOpen;

  const modelDescription =
    useMemo(() => {
      if (
        model ===
        "iPhone 18 Pro Max"
      ) {
        return "Daha büyük ekran. Daha güçlü Pro deneyimi.";
      }

      if (
        model ===
        "iPhone Duo"
      ) {
        return "Yeni nesil katlanabilir iPhone deneyimi.";
      }

      return "Profesyoneller için yeni nesil iPhone.";
    }, [model]);

  function selectModel(
    nextModel: Model
  ) {
    setModel(nextModel);

    setColor(
      COLOR_MAP[nextModel][0]
        .name
    );

    setError("");
    setSuccess("");
  }

  async function submit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!store) {
      setError(
        "Teslim alacağınız mağazayı seçin."
      );
      return;
    }

    if (
      customerName.trim()
        .length < 3
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

    setLoading(true);

    try {
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
                customerName,
                phone,
                note,
              }),
          }
        );

      const payload =
        await response
          .json()
          .catch(
            () => ({})
          );

      if (
        !response.ok ||
        !payload?.success
      ) {
        throw new Error(
          payload?.error ||
            "Talep gönderilemedi."
        );
      }

      setSuccess(
        payload?.message ||
          "Talebiniz başarıyla alındı."
      );
    } catch (e: any) {
      setError(
        e?.message ||
          "Talep gönderilemedi."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f9fc] text-slate-900">

      {/* HEADER */}
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-20 max-w-[1200px] items-center justify-between px-4">

          <a
            href="/cihaz-sat"
            className="flex items-center"
          >
            <img
              src="/logo.png"
              alt="Cnetmobil"
              className="h-12 w-auto object-contain"
            />
          </a>

          <a
            href="/cihaz-sat"
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-600 transition hover:border-indigo-200 hover:text-indigo-600"
          >
            ← Cihaz Sat
          </a>
        </div>
      </header>

      {/* HERO */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#090b16] via-[#171934] to-[#21144c] text-white">

        <div className="absolute -right-40 -top-40 h-[500px] w-[500px] rounded-full border-[80px] border-indigo-400/5" />

        <div className="absolute right-[20%] top-[20%] h-[300px] w-[300px] rounded-full bg-blue-500/10 blur-3xl" />

        <div className="relative mx-auto grid max-w-[1200px] gap-10 px-4 py-14 lg:grid-cols-[1fr_420px] lg:items-center">

          <div>
            <div className="inline-flex rounded-full border border-blue-300/20 bg-blue-300/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.22em] text-blue-200">
              CNETMOBİL ÖN SİPARİŞ
            </div>

            <h1 className="mt-5 text-5xl font-black leading-[0.95] tracking-[-2px] md:text-7xl">
              iPhone 18
              <span className="mt-2 block bg-gradient-to-r from-sky-300 via-blue-400 to-violet-400 bg-clip-text text-transparent">
                Serisi
              </span>
            </h1>

            <p className="mt-6 max-w-xl text-base font-medium leading-7 text-slate-300">
              iPhone 18 Pro,
              iPhone 18 Pro Max
              ve iPhone Duo.
              Modelini, kapasiteni,
              rengini ve teslim
              mağazanı seç.
            </p>

            <div className="mt-7 flex flex-wrap gap-2">

              <span className="rounded-full bg-white/10 px-4 py-2 text-xs font-bold">
                ✓ 256 GB - 2 TB
              </span>

              <span className="rounded-full bg-white/10 px-4 py-2 text-xs font-bold">
                ✓ Mağazadan Teslim
              </span>

              <span className="rounded-full bg-white/10 px-4 py-2 text-xs font-bold">
                ✓ Öncelikli Bilgilendirme
              </span>

            </div>
          </div>

          {/* HERO PRICE */}
          <div className="rounded-[32px] border border-white/10 bg-white/5 p-7 shadow-2xl backdrop-blur-xl">

            <div className="text-xs font-bold text-blue-200">
              Başlangıç Fiyatı
            </div>

            <div className="mt-2 text-4xl font-black">
              137.999 TL
            </div>

            <div className="mt-2 text-sm font-semibold text-slate-400">
              iPhone 18 Pro
              256 GB
            </div>

            <div className="mt-6 h-px bg-white/10" />

            <div className="mt-5 text-xs font-semibold leading-5 text-slate-400">
              Ön sipariş
              işlemleri CNETMOBİL
              tarafından
              telefonla teyit edilir.
            </div>
          </div>
        </div>
      </section>

      {/* CONTENT */}
      <form
        onSubmit={submit}
        className="mx-auto max-w-[1200px] px-4 py-10"
      >
        <div className="grid gap-7 lg:grid-cols-[1fr_370px]">

          {/* LEFT */}
          <div className="space-y-6">

            {/* MODEL */}
            <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm md:p-8">

              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600">
                  MODEL
                </div>

                <h2 className="mt-2 text-2xl font-black">
                  Modelinizi Seçin
                </h2>
              </div>

              <div className="mt-6 grid gap-3 md:grid-cols-3">

                {MODELS.map(
                  (item) => {
                    const active =
                      model === item;

                    const startPrice =
                      PRICE_MAP[
                        item
                      ][
                        "256 GB"
                      ];

                    return (
                      <button
                        key={item}
                        type="button"
                        onClick={() =>
                          selectModel(
                            item
                          )
                        }
                        className={`relative rounded-[22px] border p-5 text-left transition-all ${
                          active
                            ? "border-indigo-500 bg-indigo-50 shadow-md ring-4 ring-indigo-50"
                            : "border-slate-200 bg-white hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md"
                        }`}
                      >

                        {item ===
                          "iPhone Duo" &&
                          !duoPreorderOpen && (
                            <span className="absolute right-3 top-3 rounded-full bg-amber-100 px-2 py-1 text-[9px] font-black text-amber-700">
                              ÖN TALEP
                            </span>
                          )}

                        <div className="text-base font-black">
                          {item}
                        </div>

                        <div className="mt-2 text-[11px] font-medium leading-5 text-slate-400">
                          {item ===
                          "iPhone 18 Pro"
                            ? "Yeni Pro deneyimi."
                            : item ===
                              "iPhone 18 Pro Max"
                            ? "Daha büyük. Daha güçlü."
                            : "Katlanabilir yeni nesil iPhone."}
                        </div>

                        <div className="mt-5 text-[10px] font-semibold text-slate-400">
                          Başlangıç
                        </div>

                        <div className="mt-1 text-lg font-black">
                          {money(
                            startPrice
                          )}
                        </div>
                      </button>
                    );
                  }
                )}
              </div>
            </section>

            {/* STORAGE */}
            <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm md:p-8">

              <div className="flex items-center gap-3">

                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-sm font-black text-indigo-600">
                  1
                </div>

                <h2 className="text-xl font-black">
                  Kapasite Seçin
                </h2>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">

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
                        className={`flex min-h-[95px] items-center justify-between rounded-[20px] border px-5 text-left transition-all ${
                          active
                            ? "border-indigo-500 bg-indigo-50 ring-4 ring-indigo-50"
                            : "border-slate-200 hover:border-indigo-200"
                        }`}
                      >

                        <div className="text-lg font-black">
                          {item}
                        </div>

                        <div className="text-right">

                          <div className="text-[9px] font-bold uppercase text-slate-400">
                            Fiyat
                          </div>

                          <div className="mt-1 text-sm font-black">
                            {money(
                              PRICE_MAP[
                                model
                              ][
                                item
                              ]
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  }
                )}
              </div>
            </section>

            {/* COLOR */}
            <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm md:p-8">

              <div className="flex items-center gap-3">

                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-sm font-black text-indigo-600">
                  2
                </div>

                <h2 className="text-xl font-black">
                  Renk Seçin
                </h2>
              </div>

              <div className="mt-6 flex flex-wrap gap-4">

                {availableColors.map(
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
                        className={`min-w-[120px] rounded-[20px] border px-4 py-5 transition ${
                          active
                            ? "border-indigo-500 bg-indigo-50 ring-4 ring-indigo-50"
                            : "border-slate-200 hover:border-indigo-200"
                        }`}
                      >

                        <span
                          className="mx-auto block h-12 w-12 rounded-full border-4 border-white shadow-md ring-1 ring-slate-200"
                          style={{
                            backgroundColor:
                              item.swatch,
                          }}
                        />

                        <span className="mt-3 block text-xs font-black">
                          {
                            item.name
                          }
                        </span>
                      </button>
                    );
                  }
                )}
              </div>
            </section>

            {/* STORE */}
            <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm md:p-8">

              <div className="flex items-center gap-3">

                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-sm font-black text-indigo-600">
                  3
                </div>

                <h2 className="text-xl font-black">
                  Teslim Mağazası
                </h2>
              </div>

              <select
                value={store}
                onChange={(e) =>
                  setStore(
                    e.target
                      .value
                  )
                }
                className="mt-6 h-14 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50"
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
            </section>

            {/* CUSTOMER */}
            <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm md:p-8">

              <div className="flex items-center gap-3">

                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-sm font-black text-indigo-600">
                  4
                </div>

                <h2 className="text-xl font-black">
                  İletişim Bilgileriniz
                </h2>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">

                <div>
                  <label className="mb-2 block text-xs font-bold text-slate-500">
                    Ad Soyad
                  </label>

                  <input
                    value={
                      customerName
                    }
                    onChange={(
                      e
                    ) =>
                      setCustomerName(
                        e.target
                          .value
                      )
                    }
                    placeholder="Adınız Soyadınız"
                    className="h-14 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-xs font-bold text-slate-500">
                    Telefon
                  </label>

                  <input
                    type="tel"
                    inputMode="tel"
                    value={
                      phone
                    }
                    onChange={(
                      e
                    ) =>
                      setPhone(
                        e.target
                          .value
                      )
                    }
                    placeholder="05xx xxx xx xx"
                    className="h-14 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50"
                  />
                </div>

                <div className="sm:col-span-2">

                  <label className="mb-2 block text-xs font-bold text-slate-500">
                    Not
                  </label>

                  <textarea
                    value={
                      note
                    }
                    onChange={(
                      e
                    ) =>
                      setNote(
                        e.target
                          .value
                      )
                    }
                    rows={
                      3
                    }
                    placeholder="Varsa eklemek istediğiniz not..."
                    className="w-full resize-none rounded-2xl border border-slate-200 bg-white p-4 text-sm font-semibold outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50"
                  />
                </div>
              </div>
            </section>
          </div>

          {/* RIGHT SUMMARY */}
          <aside className="lg:sticky lg:top-24 lg:self-start">

            <div className="overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-xl">

              <div className="bg-slate-950 p-6 text-white">

                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-300">
                  SEÇİMİNİZ
                </div>

                <div className="mt-4 flex items-center gap-4">

                  <div
                    className="h-16 w-12 rounded-xl border border-white/20 shadow-lg"
                    style={{
                      background:
                        `linear-gradient(145deg, ${selectedColor.swatch}, #111827)`,
                    }}
                  />

                  <div>
                    <div className="text-lg font-black">
                      {
                        model
                      }
                    </div>

                    <div className="mt-1 text-xs font-semibold text-slate-400">
                      {
                        storage
                      }{" "}
                      ·{" "}
                      {
                        color
                      }
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6">

                <div className="flex items-center justify-between border-b border-slate-100 pb-5">

                  <div>
                    <div className="text-[10px] font-bold uppercase text-slate-400">
                      Apple Türkiye Fiyatı
                    </div>

                    <div className="mt-1 text-3xl font-black">
                      {money(
                        price
                      )}
                    </div>
                  </div>
                </div>

                {!isPreRequest && (
                  <div className="flex items-center justify-between border-b border-slate-100 py-5">

                    <div className="text-xs font-bold text-slate-500">
                      Ön Sipariş Kaporası
                    </div>

                    <div className="text-lg font-black">
                      {money(
                        DEPOSIT_AMOUNT
                      )}
                    </div>
                  </div>
                )}

                <div className="py-5">

                  <div className="text-[10px] font-bold uppercase text-slate-400">
                    Teslim Mağazası
                  </div>

                  <div className="mt-1 text-sm font-black">
                    {store ||
                      "Henüz seçilmedi"}
                  </div>
                </div>

                {isPreRequest && (
                  <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">

                    <div className="text-xs font-black text-amber-800">
                      iPhone Duo Ön Talep
                    </div>

                    <div className="mt-1 text-[11px] font-semibold leading-5 text-amber-700">
                      Ön sipariş
                      16 Ekim
                      2026 saat
                      15:00'te
                      açılacak.
                      Şimdilik
                      sadece ön
                      talebiniz
                      alınır.
                    </div>
                  </div>
                )}

                {error && (
                  <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-bold leading-5 text-rose-700">
                    {
                      error
                    }
                  </div>
                )}

                {success && (
                  <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-bold leading-5 text-emerald-700">
                    ✓{" "}
                    {
                      success
                    }
                  </div>
                )}

                <button
                  type="submit"
                  disabled={
                    loading
                  }
                  className="h-14 w-full rounded-2xl bg-indigo-600 text-sm font-black text-white shadow-lg shadow-indigo-200 transition-all hover:bg-indigo-700 active:scale-[0.98] disabled:cursor-wait disabled:opacity-60"
                >
                  {loading
                    ? "Gönderiliyor..."
                    : isPreRequest
                    ? "Ön Talep Oluştur"
                    : "Ön Sipariş Ver"}
                </button>

                <p className="mt-4 text-center text-[10px] font-medium leading-5 text-slate-400">
                  Talebiniz
                  CNETMOBİL
                  ekibine
                  iletilir.
                  Bu ekrandan
                  ödeme alınmaz.
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-[24px] border border-slate-200 bg-white p-5">

              <div className="text-sm font-black">
                {model}
              </div>

              <div className="mt-2 text-xs font-medium leading-5 text-slate-500">
                {
                  modelDescription
                }
              </div>

              <div className="mt-4 flex items-center gap-2 text-[10px] font-bold text-emerald-600">

                <span>
                  ✓
                </span>

                <span>
                  CNETMOBİL mağazadan teslim
                </span>
              </div>
            </div>
          </aside>
        </div>
      </form>

      <footer className="mt-8 border-t border-slate-200 bg-white">

        <div className="mx-auto flex max-w-[1200px] flex-col gap-2 px-4 py-8 text-center text-xs font-medium text-slate-400 md:flex-row md:items-center md:justify-between md:text-left">

          <div>
            © 2026
            CNETMOBİL
          </div>

          <div>
            iPhone 18
            Ön Sipariş
            ve Ön Talep
          </div>
        </div>
      </footer>
    </main>
  );
}
