"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type SheetRow = {
  id?: number;
  sheet_name: string;
  row_number: number;
  data: unknown[];
  updated_at?: string;
};

type DepoRow = {
  rowNumber: number;
  cihaz: string;
  imei: string;
  durum: string;
  updatedAt?: string;
};

const POLL_MS = 2000;

// Yerel (optimistik) "kullanıldı" önbelleğinin ne kadar süre backend'in
// "kullanılmadı" cevabına baskın çıkacağı — Sheet -> PostgreSQL senkron
// gecikmesini karşılamak için. Bu sürenin sonunda, backend hâlâ
// "kullanılmadı" diyorsa (ör. Sheet'ten satır silinip/durum sıfırlanıp
// sıfırlanmışsa) artık BACKEND'e güvenilir — yerel kayıt sonsuza kadar
// "kullanıldı" göstermeye devam ETMEZ.
const INSTANT_OVERRIDE_TTL_MS = 10 * 60 * 1000; // 10 dakika

type InstantUsedEntry = { durum: string; setAt: number };

function overrideGecerliMi(entry: InstantUsedEntry | undefined): entry is InstantUsedEntry {
  return Boolean(entry) && Date.now() - (entry as InstantUsedEntry).setAt < INSTANT_OVERRIDE_TTL_MS;
}

function temiz(value: unknown) {
  return String(value ?? "").trim();
}

function kullanildiMi(value: unknown) {
  return temiz(value)
    .toLocaleUpperCase("tr-TR")
    .includes("KULLANILDI");
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

function BoxIcon({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8M12 13v8"
      />
    </svg>
  );
}

function CheckIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2.3}
        d="M5 13l4 4L19 7"
      />
    </svg>
  );
}

function SignalIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5 12.55a11 11 0 0114.08 0M1.42 9a16 16 0 0121.16 0M8.53 16.11a6 6 0 016.95 0M12 20h.01"
      />
    </svg>
  );
}

function StatCard({
  label,
  value,
  footer,
  tone = "orange",
  icon,
}: {
  label: string;
  value: React.ReactNode;
  footer: string;
  tone?: "orange" | "red" | "emerald" | "slate";
  icon: React.ReactNode;
}) {
  const toneMap = {
    orange: "bg-orange-50 text-orange-600",
    red: "bg-red-50 text-red-600",
    emerald: "bg-emerald-50 text-emerald-600",
    slate: "bg-slate-100 text-slate-500",
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

export default function Depo() {
  const searchRef = useRef<HTMLInputElement | null>(null);

  const [rows, setRows] = useState<DepoRow[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [usingImei, setUsingImei] = useState<string | null>(null);

  // KULLAN'a basınca window.prompt() yerine satırın kendi içinde açılan
  // küçük "Ad Soyad" kutusu — hangi satırda açık olduğunu ve o anki
  // yazılan ismi tutar.
  const [pendingImei, setPendingImei] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState("");

  // Bir IMEI KULLANILDI olarak işaretlendiğinde, backend (Sheet -> Postgres
  // senkronu) yetişene kadar ekranda GEÇİCİ olarak (bkz. INSTANT_OVERRIDE_TTL_MS)
  // kalıcı tutulur. Süresi dolunca backend'in o an döndürdüğü gerçek duruma
  // (tekrar "kullanılmadı" olsa bile) güvenilir. Aynı tarayıcıda sayfa
  // yenilense bile localStorage kaydı (süresi dolana kadar) korunur.
  const [instantUsed, setInstantUsed] = useState<
    Record<string, InstantUsedEntry>
  >({});

  const instantUsedRef = useRef<Record<string, InstantUsedEntry>>({});

  const busyRef = useRef(false);
  const mountedRef = useRef(true);

  const loadRows = useCallback(async () => {
    if (busyRef.current) return;

    busyRef.current = true;

    try {
      const params = new URLSearchParams();
      params.append("sheet", "DEPO");

      const response = await fetch(
        `/api/sheet-rows?${params.toString()}`,
        {
          method: "GET",
          cache: "no-store",
          headers: {
            Accept: "application/json",
          },
        }
      );

      const result = await response
        .json()
        .catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          result?.error ||
            `Depo verisi alınamadı (${response.status})`
        );
      }

      const source = Array.isArray(result?.rows)
        ? (result.rows as SheetRow[])
        : [];

      const confirmedUsed: Record<string, string> = {};

      const nextRows = source
        .filter(
          (row) =>
            row.sheet_name === "DEPO" &&
            Number(row.row_number) > 1
        )
        .sort(
          (a, b) =>
            Number(a.row_number) -
            Number(b.row_number)
        )
        .map((row) => {
          const data = Array.isArray(row.data)
            ? row.data
            : [];

          const cihaz = temiz(data[0]);
          const imei = temiz(data[1]);
          let durum = temiz(data[2]);

          // Server/Sheet "KULLANILDI" diyorsa doğrudan çiz.
          if (kullanildiMi(durum)) {
            confirmedUsed[imei] = durum;
          } else {
            // Backend "kullanılmadı" diyor — ama az önce (TTL içinde) bu
            // tarayıcıdan kullanıldı işaretlendiyse, senkron gecikmesi
            // olabilir diye ona güveniriz. TTL geçtiyse backend'in
            // "kullanılmadı" cevabını OLDUĞU GİBİ kabul ederiz (ör. Sheet'ten
            // satır silinip sıfırlanmış olabilir) — sonsuza kadar eski
            // "kullanıldı" göstermeye devam ETMEYİZ.
            const override = instantUsedRef.current[imei];
            if (overrideGecerliMi(override)) {
              durum = override.durum;
            }
          }

          return {
            rowNumber: Number(row.row_number),
            cihaz,
            imei,
            durum,
            updatedAt: row.updated_at,
          };
        })
        .filter(
          (row) =>
            row.cihaz || row.imei
        );

      // instantUsedRef'i bu turun sonucuna göre yeniden kur: override SADECE
      // kullanıcının kendi optimistik tıklaması ile backend'in onayı
      // arasındaki KISA gecikmeyi köprülemeli. Backend zaten bağımsız olarak
      // "kullanıldı" diyorsa (confirmedUsed) override'a hiç gerek yok — bu
      // yüzden burada TAMAMEN düşürülüyor. ESKİDEN burada setAt: now ile
      // her pollingde yenileniyordu; bu da Sheet'ten "KULLANILDI" silindikten
      // SONRA bile override'ın her zaman "az önce" set edilmiş görünüp 10
      // dakika daha eski durumu dayatmasına yol açan asıl bug'dı.
      const nextInstantUsed: Record<string, InstantUsedEntry> = {};
      const expiredImeis: string[] = [];

      for (const [imei, entry] of Object.entries(instantUsedRef.current)) {
        if (confirmedUsed[imei]) {
          expiredImeis.push(imei);
          continue;
        }
        if (overrideGecerliMi(entry)) {
          nextInstantUsed[imei] = entry;
        } else {
          expiredImeis.push(imei);
        }
      }

      if (expiredImeis.length) {
        instantUsedRef.current = nextInstantUsed;

        if (mountedRef.current) {
          setInstantUsed(nextInstantUsed);
        }

        if (typeof window !== "undefined") {
          expiredImeis.forEach((imei) => {
            window.localStorage.removeItem("kullanilan_imei_" + imei);
          });
        }
      }

      if (mountedRef.current) {
        setRows(nextRows);
      }
    } catch (error) {
      console.error(
        "Depo verisi alınamadı:",
        error
      );
    } finally {
      busyRef.current = false;

      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const now = Date.now();
    const restored: Record<string, InstantUsedEntry> = {};

    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);

      if (!key || !key.startsWith("kullanilan_imei_")) {
        continue;
      }

      try {
        const raw = window.localStorage.getItem(key);
        if (!raw) continue;

        const parsed = JSON.parse(raw);
        const durum = temiz(parsed?.durum);
        // Eski format (bu düzeltmeden önce) setAt taşımıyordu — o kayıtları
        // "şimdi" set edilmiş kabul ediyoruz, ilk loadRows() çağrısı zaten
        // backend'e göre doğrulayıp gerekirse hemen düzeltecek.
        const setAt = Number(parsed?.setAt) || now;

        if (!kullanildiMi(durum)) continue;

        if (now - setAt < INSTANT_OVERRIDE_TTL_MS) {
          const imei = key.replace("kullanilan_imei_", "");
          restored[imei] = { durum, setAt };
        } else {
          // TTL'i çoktan geçmiş, tarayıcıda gereksiz yere taşınmasın.
          window.localStorage.removeItem(key);
        }
      } catch {
        // Bozuk localStorage kaydı görünümü bozmasın.
      }
    }

    instantUsedRef.current = restored;
    setInstantUsed(restored);
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    void loadRows();

    const intervalId = window.setInterval(
      () => {
        if (
          document.visibilityState ===
          "visible"
        ) {
          void loadRows();
        }
      },
      POLL_MS
    );

    const onVisibility = () => {
      if (
        document.visibilityState ===
        "visible"
      ) {
        void loadRows();
      }
    };

    document.addEventListener(
      "visibilitychange",
      onVisibility
    );

    return () => {
      mountedRef.current = false;

      window.clearInterval(intervalId);

      document.removeEventListener(
        "visibilitychange",
        onVisibility
      );
    };
  }, [loadRows]);

  // KULLAN butonuna basınca artık window.prompt() açmıyor — satırda inline
  // bir "Ad Soyad" kutusu açılıyor (bkz. render kısmı), oradaki Onayla
  // butonu bu fonksiyonu ismi doğrudan parametre olarak vererek çağırıyor.
  const handleImeiKullan = async (
    imei: string,
    personelName: string
  ) => {
    if (
      !imei ||
      usingImei
    ) {
      return;
    }

    if (
      !personelName ||
      !personelName.trim()
    ) {
      return;
    }

    const personel =
      personelName
        .trim()
        .toLocaleUpperCase(
          "tr-TR"
        );

    setPendingImei(null);
    setNameInput("");

    const durumText =
      `KULLANILDI - ${personel}`;

    // Butona basıldığı anda GEÇİCİ olarak (bkz. INSTANT_OVERRIDE_TTL_MS)
    // kullanıldı kabul et — sonsuza kadar değil.
    const setAt = Date.now();
    const nextUsed = {
      ...instantUsedRef.current,
      [imei]: { durum: durumText, setAt },
    };

    instantUsedRef.current = nextUsed;
    setInstantUsed(nextUsed);

    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        "kullanilan_imei_" + imei,
        JSON.stringify({
          durum: durumText,
          setAt,
        })
      );
    }

    setRows((current) =>
      current.map((row) =>
        row.imei === imei
          ? {
              ...row,
              durum: durumText,
              updatedAt:
                new Date().toISOString(),
            }
          : row
      )
    );

    setUsingImei(imei);

    try {
      const response = await fetch(
        "/api/panel-action",
        {
          method: "POST",
          cache: "no-store",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            type: "USE_IMEI",
            imei,
            personel,
          }),
        }
      );

      const result = await response
        .json()
        .catch(() => ({}));

      if (
        !response.ok ||
        result?.result === "error"
      ) {
        throw new Error(
          result?.message ||
            "IMEI kaydedilemedi."
        );
      }

      // Arkada güncel veriyi tekrar çek.
      void loadRows();
    } catch (error) {
      const next = {
        ...instantUsedRef.current,
      };
      delete next[imei];

      instantUsedRef.current = next;
      setInstantUsed(next);

      if (typeof window !== "undefined") {
        window.localStorage.removeItem(
          "kullanilan_imei_" + imei
        );
      }

      await loadRows();

      alert(
        error instanceof Error
          ? error.message
          : "Bağlantı hatası! Lütfen internetinizi kontrol edin."
      );
    } finally {
      if (mountedRef.current) {
        setUsingImei(null);
      }
    }
  };

  const filteredRows = useMemo(() => {
    const q =
      searchQuery
        .trim()
        .toLocaleLowerCase(
          "tr-TR"
        );

    if (!q) {
      return rows;
    }

    return rows.filter(
      (row) =>
        row.cihaz
          .toLocaleLowerCase(
            "tr-TR"
          )
          .includes(q) ||
        row.imei
          .toLocaleLowerCase(
            "tr-TR"
          )
          .includes(q)
    );
  }, [rows, searchQuery]);

  const usedCount = useMemo(
    () =>
      rows.filter((row) =>
        kullanildiMi(instantUsed[row.imei]?.durum || row.durum)
      ).length,
    [rows, instantUsed]
  );

  const availableCount = rows.length - usedCount;

  function clearSearch() {
    setSearchQuery("");
    window.setTimeout(() => searchRef.current?.focus(), 0);
  }

  return (
    <div className="animate-in fade-in duration-300">
      {/* ÜST HERO */}
      <section className="overflow-hidden rounded-[26px] border border-orange-100 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.055)]">
        <div className="flex min-h-[122px] flex-col justify-center px-7 py-5 sm:px-8">
          <div className="text-[8px] font-black uppercase tracking-[0.2em] text-orange-600">
            CNETMOBİL V2
          </div>

          <h2 className="mt-2 text-[28px] font-black tracking-[-0.045em] text-slate-950 sm:text-[31px]">
            DEPO LİSTESİ
          </h2>

          <p className="mt-2 text-[10px] font-semibold text-slate-400">
            Vodafone Kanalı İmei Kayıtları
          </p>
        </div>

        <div className="grid gap-2 border-t border-orange-100 bg-slate-50/60 p-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Toplam İmei"
            value={rows.length}
            footer="Depo listesindeki kayıt"
            tone="orange"
            icon={<BoxIcon className="h-5 w-5" />}
          />

          <StatCard
            label="Kullanılan"
            value={usedCount}
            footer="KULLANILDI işaretli"
            tone="red"
            icon={<CheckIcon className="h-5 w-5" />}
          />

          <StatCard
            label="Kullanılabilir"
            value={availableCount}
            footer="Stokta bekleyen"
            tone="emerald"
            icon={<BoxIcon className="h-5 w-5" />}
          />

          <StatCard
            label="Canlı Takip"
            value="CANLI"
            footer="2 sn'de bir otomatik güncelleme"
            tone="slate"
            icon={<SignalIcon className="h-5 w-5" />}
          />
        </div>
      </section>

      {/* ARAMA */}
      <section className="sticky top-[104px] z-30 mt-4 rounded-[22px] border border-slate-200 bg-white/95 p-3 shadow-[0_9px_26px_rgba(15,23,42,0.07)] backdrop-blur">
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <div className="relative min-w-0 flex-1">
            <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-orange-600">
              <SearchIcon />
            </div>

            <input
              ref={searchRef}
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="İmei veya cihaz ara..."
              className="h-[49px] w-full rounded-2xl border border-slate-200 bg-slate-50 pl-12 pr-4 text-[11px] font-bold text-slate-800 outline-none placeholder:text-slate-400 focus:border-orange-400 focus:bg-white focus:ring-4 focus:ring-orange-50"
            />
          </div>

          <button
            type="button"
            onClick={clearSearch}
            className="inline-flex h-[49px] min-w-[110px] items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-[10px] font-black text-slate-500 transition hover:bg-slate-100"
          >
            Temizle
          </button>
        </div>
      </section>

      {/* LİSTE */}
      <section className="mt-4 overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_8px_26px_rgba(15,23,42,0.05)]">
        <div className="flex items-center justify-between gap-3 px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-orange-600">
              <BoxIcon />
            </div>

            <div className="min-w-0">
              <h3 className="truncate text-[17px] font-black tracking-[-0.03em] text-slate-950">
                Depo Ürün Listesi
              </h3>
              <p className="truncate text-[9px] font-semibold text-slate-400">
                IMEI stoklarını görüntüleyin ve kullanılan cihazları işaretleyin.
              </p>
            </div>
          </div>

          <span className="shrink-0 rounded-full bg-orange-50 px-3 py-1.5 text-[8px] font-black text-orange-600">
            {filteredRows.length} Ürün
          </span>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[560px]">
            <div className="flex border-y border-slate-200 bg-slate-50/90 px-4 py-3 text-[8px] font-black uppercase tracking-[0.05em] text-slate-500">
              <div className="flex-[3]">CİHAZ BİLGİSİ</div>
              <div className="flex-[2] border-l border-slate-200 pl-4 text-center">
                İMEİ BİLGİSİ
              </div>
              <div className="flex-[1] border-l border-slate-200 pl-4 text-right">
                DURUM
              </div>
            </div>

            {loading ? (
              <div className="flex min-h-[220px] items-center justify-center px-6 text-center">
                <div>
                  <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-50 text-orange-500">
                    <BoxIcon className="h-5 w-5" />
                  </div>
                  <p className="text-[11px] font-black text-slate-700">
                    DEPO YÜKLENİYOR...
                  </p>
                  <p className="mt-1 text-[9px] font-semibold text-slate-400">
                    Kayıtlar sunucudan getiriliyor.
                  </p>
                </div>
              </div>
            ) : filteredRows.length === 0 ? (
              <div className="flex min-h-[220px] items-center justify-center px-6 text-center">
                <div>
                  <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                    <SearchIcon />
                  </div>
                  <p className="text-[11px] font-black text-slate-700">
                    KAYIT BULUNAMADI
                  </p>
                  <p className="mt-1 text-[9px] font-semibold text-slate-400">
                    Arama kelimesini değiştirerek tekrar deneyin.
                  </p>
                </div>
              </div>
            ) : (
              filteredRows.map(
                (row, i) => {
                  const guncelDurum =
                    instantUsed[row.imei]?.durum ||
                    row.durum;

                  const isUsed =
                    kullanildiMi(
                      guncelDurum
                    );

                  const isSaving =
                    usingImei ===
                    row.imei;

                  return (
                    <div
                      key={`${row.rowNumber}-${row.imei}`}
                      className={`flex items-center border-b border-slate-100 px-4 py-3 text-[11px] font-bold transition last:border-b-0 ${
                        isUsed
                          ? "bg-red-50/70"
                          : i % 2 === 0
                          ? "bg-white"
                          : "bg-slate-50/40"
                      } hover:bg-slate-50`}
                    >
                      <div
                        style={{
                          textDecoration: isUsed
                            ? "line-through"
                            : "none",
                        }}
                        className={`flex-[3] truncate pr-4 text-[10px] font-black ${
                          isUsed
                            ? "text-red-700 opacity-70"
                            : "text-slate-900"
                        }`}
                      >
                        {row.cihaz ||
                          "-"}
                      </div>

                      <div
                        style={{
                          textDecoration: isUsed
                            ? "line-through"
                            : "none",
                        }}
                        className={`flex-[2] whitespace-nowrap border-l border-slate-100 pl-4 text-center text-[11px] font-black ${
                          isUsed
                            ? "text-red-500 opacity-70"
                            : "text-emerald-600"
                        }`}
                      >
                        {row.imei ||
                          "-"}
                      </div>

                      <div className="flex flex-[1] justify-end border-l border-slate-100 pl-4">
                        {isUsed ? (
                          <span className="rounded-lg bg-red-100 px-2.5 py-1 text-[9px] font-black tracking-widest text-red-600">
                            {guncelDurum}
                          </span>
                        ) : pendingImei === row.imei ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              autoFocus
                              value={nameInput}
                              onChange={(event) =>
                                setNameInput(event.target.value)
                              }
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  void handleImeiKullan(row.imei, nameInput);
                                } else if (event.key === "Escape") {
                                  setPendingImei(null);
                                  setNameInput("");
                                }
                              }}
                              placeholder="Ad Soyad"
                              className="h-8 w-24 rounded-lg border border-orange-300 bg-white px-2 text-[10px] font-bold text-slate-800 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100 sm:w-28"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                void handleImeiKullan(row.imei, nameInput)
                              }
                              disabled={!nameInput.trim() || Boolean(usingImei)}
                              title="Onayla"
                              className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500 text-white transition hover:bg-emerald-600 disabled:opacity-50"
                            >
                              <CheckIcon className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setPendingImei(null);
                                setNameInput("");
                              }}
                              title="Vazgeç"
                              className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500 transition hover:bg-slate-200"
                            >
                              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setPendingImei(row.imei);
                              setNameInput("");
                            }}
                            disabled={
                              Boolean(
                                usingImei
                              )
                            }
                            className="rounded-xl bg-orange-500 px-4 py-2 text-[9px] font-black uppercase tracking-widest text-white shadow-sm transition hover:bg-orange-600 disabled:opacity-50"
                          >
                            {isSaving
                              ? "KAYDEDİLİYOR..."
                              : "KULLAN"}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                }
              )
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-5 py-3">
          <span className="rounded-full bg-slate-100 px-3 py-1.5 text-[8px] font-black text-slate-500">
            {filteredRows.length} kayıt listeleniyor
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
        className="fixed bottom-[88px] right-[74px] z-40 flex h-[54px] w-[54px] items-center justify-center rounded-full bg-orange-500 text-white shadow-[0_13px_30px_rgba(234,88,12,0.35)] transition hover:scale-105 hover:bg-orange-600 max-sm:right-5"
      >
        <SearchIcon className="h-6 w-6" />
      </button>
    </div>
  );
}
