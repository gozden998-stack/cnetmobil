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
const OPTIMISTIC_MS = 30000;

function temiz(value: unknown) {
  return String(value ?? "").trim();
}

function kullanildiMi(value: unknown) {
  return temiz(value)
    .toLocaleUpperCase("tr-TR")
    .includes("KULLANILDI");
}

export default function Depo() {
  const [rows, setRows] = useState<DepoRow[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [usingImei, setUsingImei] = useState<string | null>(null);

  // KULLAN butonuna basıldığı anda görünümü server cevabından bağımsız
  // anlık değiştirmek için ayrı UI override tutulur.
  const [instantUsed, setInstantUsed] = useState<
    Record<string, string>
  >({});

  const busyRef = useRef(false);
  const mountedRef = useRef(true);

  const optimisticRef = useRef<
    Map<
      string,
      {
        durum: string;
        expiresAt: number;
      }
    >
  >(new Map());

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

      const now = Date.now();

      for (const [
        imei,
        optimistic,
      ] of optimisticRef.current.entries()) {
        if (optimistic.expiresAt <= now) {
          optimisticRef.current.delete(imei);
        }
      }

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

          const optimistic =
            optimisticRef.current.get(imei);

          if (
            optimistic &&
            !kullanildiMi(durum) &&
            optimistic.expiresAt > now
          ) {
            durum = optimistic.durum;
          }

          if (
            optimistic &&
            kullanildiMi(durum)
          ) {
            optimisticRef.current.delete(imei);
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

    const restored: Record<string, string> = {};
    const now = Date.now();

    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);

      if (!key || !key.startsWith("kullanilan_imei_")) {
        continue;
      }

      try {
        const raw = window.localStorage.getItem(key);
        if (!raw) continue;

        const parsed = JSON.parse(raw);
        const timestamp = Number(parsed?.timestamp || 0);
        const durum = temiz(parsed?.durum);

        // Eski davranıştaki gibi 10 dakika boyunca görünümü koru.
        if (
          durum &&
          timestamp &&
          now - timestamp < 10 * 60 * 1000
        ) {
          const imei = key.replace("kullanilan_imei_", "");
          restored[imei] = durum;
        } else {
          window.localStorage.removeItem(key);
        }
      } catch {
        window.localStorage.removeItem(key);
      }
    }

    if (Object.keys(restored).length) {
      setInstantUsed(restored);
    }
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

  const handleImeiKullan = async (
    imei: string
  ) => {
    if (
      !imei ||
      usingImei
    ) {
      return;
    }

    const personelName =
      window.prompt(
        "Lütfen isminizi giriniz:"
      );

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

    const durumText =
      `KULLANILDI - ${personel}`;

    // Butona basıldığı anda ayrı UI state üzerinden anında çiz.
    setInstantUsed((current) => ({
      ...current,
      [imei]: durumText,
    }));

    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        "kullanilan_imei_" + imei,
        JSON.stringify({
          durum: durumText,
          timestamp: Date.now(),
        })
      );
    }

    // PostgreSQL senkronu gecikirse polling görünümü geri çevirmesin.
    optimisticRef.current.set(
      imei,
      {
        durum: durumText,
        expiresAt:
          Date.now() +
          OPTIMISTIC_MS,
      }
    );

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
      optimisticRef.current.delete(
        imei
      );

      setInstantUsed((current) => {
        const next = { ...current };
        delete next[imei];
        return next;
      });

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

  return (
    <div className="bg-white p-6 sm:p-10 rounded-[48px] shadow-sm border border-slate-200 text-slate-900 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 border-b border-slate-100 pb-6 gap-4">
        <div>
          <h2 className="text-3xl font-black italic tracking-tighter text-orange-600">
            DEPO LİSTESİ
          </h2>

          <p className="text-[10px] text-slate-500 font-bold tracking-widest mt-1 uppercase">
            Vodafone Kanalı İmei Kayıtları
          </p>
        </div>

        <div className="bg-slate-50 border border-slate-200 p-3 rounded-2xl flex items-center w-full md:w-80 focus-within:border-orange-400 focus-within:bg-white transition-all shadow-sm">
          <svg
            className="w-5 h-5 text-slate-400 mr-2 shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>

          <input
            type="text"
            placeholder="İmei veya Cihaz Arama..."
            className="bg-transparent border-none outline-none text-sm text-slate-900 w-full placeholder-slate-400"
            value={searchQuery}
            onChange={(event) =>
              setSearchQuery(
                event.target.value
              )
            }
          />
        </div>
      </div>

      <div className="max-w-5xl mx-auto overflow-x-auto custom-scrollbar pb-2">
        <div className="min-w-[500px]">
          <div className="bg-orange-500 px-4 py-3 rounded-t-2xl flex font-black text-[10px] tracking-widest text-white items-center shadow-md">
            <div className="flex-[3]">
              CİHAZ BİLGİSİ
            </div>

            <div className="flex-[2] text-center border-l border-orange-400 pl-2">
              İMEİ BİLGİSİ
            </div>

            <div className="flex-[1] text-right border-l border-orange-400 pl-2">
              DURUM
            </div>
          </div>

          <div className="bg-white rounded-b-2xl overflow-hidden border-x border-b border-slate-200">
            {loading ? (
              <div className="py-16 text-center text-xs font-black tracking-widest text-slate-400">
                DEPO YÜKLENİYOR...
              </div>
            ) : filteredRows.length === 0 ? (
              <div className="py-16 text-center text-xs font-black tracking-widest text-slate-400">
                KAYIT BULUNAMADI
              </div>
            ) : (
              filteredRows.map(
                (row, i) => {
                  const guncelDurum =
                    instantUsed[row.imei] ||
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
                      className={`flex px-4 py-3 border-b border-slate-200 transition-colors text-[11px] sm:text-xs font-bold items-center group ${
                        isUsed
                          ? "bg-red-50"
                          : i % 2 === 0
                          ? "bg-slate-50"
                          : "bg-white hover:bg-slate-100"
                      }`}
                    >
                      <div
                        style={{
                          textDecoration: isUsed
                            ? "line-through"
                            : "none",
                        }}
                        className={`flex-[3] flex items-center ${
                          isUsed
                            ? "text-red-700 opacity-70"
                            : "text-slate-700 group-hover:text-slate-900"
                        } transition-colors pr-4`}
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
                        className={`flex-[2] text-center font-black text-sm whitespace-nowrap border-l border-slate-200 pl-4 ${
                          isUsed
                            ? "text-red-500 opacity-70"
                            : "text-green-600"
                        }`}
                      >
                        {row.imei ||
                          "-"}
                      </div>

                      <div className="flex-[1] flex justify-end border-l border-slate-200 pl-4">
                        {isUsed ? (
                          <div className="flex flex-col items-end">
                            <span className="text-[9px] text-red-600 font-black tracking-widest bg-red-100 px-2 py-1 rounded-md">
                              {guncelDurum}
                            </span>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              void handleImeiKullan(
                                row.imei
                              )
                            }
                            disabled={
                              Boolean(
                                usingImei
                              )
                            }
                            className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-1.5 rounded-lg text-[10px] font-black tracking-widest uppercase transition-all btn-click shadow-sm disabled:opacity-50"
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
      </div>
    </div>
  );
}
