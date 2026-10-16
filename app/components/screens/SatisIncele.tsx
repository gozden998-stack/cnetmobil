"use client";

// app/components/screens/SatisIncele.tsx
//
// CNETMOBIL - WingSM satış satırı İNCELEME aracı (yönetici, Değer Puan > Satış Verisi)
//
// Amaç: kategori hedeflerinin (Cihaz Adet, Özel Kesim Cam, Samsung Premium...)
// gerçekleşenini WingSM'den otomatik çıkarabilmek için, satış satırlarında hangi
// alanların geldiğini ve bir kategorinin satışlarının satırlarda nasıl göründüğünü
// görmek. Sadece okur; /api/wingsm/satis-incele.

import React, { useState } from "react";

type FieldInfo = {
  name: string;
  filledCount: number;
  filledPercent: number;
  example: unknown;
  types: string[];
};

type ClassStat = { sinif: string; adi: string; rowCount: number; qty: number };

type PuanOzeti = {
  total: number;
  rowsWithPuan: number;
  rowsWithoutPuan: number;
  withoutPuanExamples: string[];
  adetAlani: string | null;
  byStore: Array<{ magaza: string; puan: number; rowCount: number }>;
  bySeller: Array<{
    magaza: string;
    magazalar: Array<{ magaza: string; puan: number }>;
    saticiKod: string;
    saticiAdi: string;
    rowCount: number;
    qty: number;
    puan: number;
  }>;
};

type InceleResult = {
  period: { tarih: string; tarih2: string };
  depots: string[];
  terms: string[];
  kanal: "cmr" | "vodafone";
  sinif: string | null;
  scopeRows: number;
  depotStatus: Array<{ depo: string; magaza: string; rowCount: number; seconds: number; error: string | null }>;
  siniflar: ClassStat[];
  puanOzeti: PuanOzeti | null;
  totalRows: number;
  matchedRows: number;
  returnedRows: number;
  fields: FieldInfo[];
  rows: Array<Record<string, unknown>>;
};

const DEPOTS_BY_CHANNEL = {
  cmr: [
    { code: "", label: "Tüm CMR mağazaları" },
    { code: "003", label: "CMR MERKEZ (003)" },
    { code: "009", label: "CMR CADDE (009)" },
    { code: "010", label: "CMR SARAY (010)" },
    { code: "011", label: "CMR KAPAKLI (011)" },
  ],
  vodafone: [
    { code: "", label: "Tüm Vodafone mağazaları" },
    { code: "002", label: "MEYDAN (002)" },
    { code: "005", label: "TEKİRA (005)" },
    { code: "007", label: "SARAY VDF (007)" },
    { code: "008", label: "ERNA (008)" },
  ],
};

type Channel = keyof typeof DEPOTS_BY_CHANNEL;

// Kategori tespiti için en işe yarayacak alanlar önce gelsin.
const PRIORITY_FIELDS = [
  "__magaza",
  "MalAd",
  "MalSinifAdI",
  "MalSinif",
  "MalGrupAd",
  "MalGrup2Ad",
  "SaticiAdI",
  "MalMiktarI",
  "KarlilikI",
  "Tarih",
];

function formatDateInput(date: Date) {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}.${month}.${date.getFullYear()}`;
}

function defaultRange() {
  const end = new Date();
  end.setDate(end.getDate() - 1);
  const start = new Date(end.getFullYear(), end.getMonth(), 1);
  return { bastar: formatDateInput(start), bittar: formatDateInput(end) };
}

function cellText(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export default function SatisIncele({ varsayilanKanal = "cmr" }: { varsayilanKanal?: "cmr" | "vodafone" }) {
  const initial = defaultRange();

  const [bastar, setBastar] = useState(initial.bastar);
  const [bittar, setBittar] = useState(initial.bittar);
  const [kanal, setKanal] = useState<Channel>(varsayilanKanal);
  const [depo, setDepo] = useState("");
  const [sinif, setSinif] = useState(varsayilanKanal === "vodafone" ? "5AK" : "");
  const [aktivasyon, setAktivasyon] = useState(false);
  const [ara, setAra] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<InceleResult | null>(null);
  const [showFields, setShowFields] = useState(true);

  const run = async () => {
    setLoading(true);
    setError("");

    try {
      const query = new URLSearchParams({ bastar, bittar });
      query.set("kanal", kanal);
      if (depo) query.set("depo", depo);
      if (sinif.trim()) query.set("sinif", sinif.trim());
      if (aktivasyon) query.set("aktivasyon", "1");
      if (ara.trim()) query.set("ara", ara.trim());

      const res = await fetch(`/api/wingsm/satis-incele?${query.toString()}`, {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
      });

      const payload = await res.json().catch(() => null);

      if (!res.ok || !payload?.success) {
        throw new Error(payload?.error || `HTTP ${res.status}`);
      }

      setResult(payload as InceleResult);
    } catch (err) {
      setResult(null);
      setError(err instanceof Error ? err.message : "Satış verisi alınamadı.");
    } finally {
      setLoading(false);
    }
  };

  const columns = result
    ? [
        ...PRIORITY_FIELDS.filter((name) => result.fields.some((field) => field.name === name)),
        ...result.fields.map((field) => field.name).filter((name) => !PRIORITY_FIELDS.includes(name) && name !== "__depo"),
      ]
    : [];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-black">Satış Verisi (WingSM)</h1>
        <p className="mt-1 text-sm text-slate-500">
          WingSM satış listesinin ham satırlarını görürsünüz. Bir kategoriyi (ör. özel kesim cam, Samsung premium)
          bulmak için ürün adında geçen kelimeyi aratın. Amaç, kategorilerin gerçekleşenini WingSM&apos;den otomatik
          çıkarabilmek için hangi alanların geldiğini görmek. Sadece okur, hiçbir şey kaydetmez.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <label>
            <div className="mb-1 text-[10px] font-black uppercase text-slate-500">Başlangıç (GG.AA.YYYY)</div>
            <input
              value={bastar}
              onChange={(e) => setBastar(e.target.value)}
              disabled={loading}
              className="h-10 w-40 rounded-lg border border-slate-200 px-3 text-sm disabled:bg-slate-50"
            />
          </label>
          <label>
            <div className="mb-1 text-[10px] font-black uppercase text-slate-500">Bitiş (GG.AA.YYYY)</div>
            <input
              value={bittar}
              onChange={(e) => setBittar(e.target.value)}
              disabled={loading}
              className="h-10 w-40 rounded-lg border border-slate-200 px-3 text-sm disabled:bg-slate-50"
            />
          </label>
          <label>
            <div className="mb-1 text-[10px] font-black uppercase text-slate-500">Kanal</div>
            <select
              value={kanal}
              onChange={(e) => {
                const next = e.target.value as Channel;
                setKanal(next);
                setDepo("");
                // Vodafone puanı 5AK sınıfından okunur; CMR'a geçince süzgeci temizle.
                setSinif(next === "vodafone" ? "5AK" : "");
              }}
              disabled={loading}
              className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm disabled:bg-slate-50"
            >
              <option value="cmr">CMR</option>
              <option value="vodafone">Vodafone</option>
            </select>
          </label>
          <label>
            <div className="mb-1 text-[10px] font-black uppercase text-slate-500">Mağaza</div>
            <select
              value={depo}
              onChange={(e) => setDepo(e.target.value)}
              disabled={loading}
              className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm disabled:bg-slate-50"
            >
              {DEPOTS_BY_CHANNEL[kanal].map((item) => (
                <option key={item.code} value={item.code}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <div className="mb-1 text-[10px] font-black uppercase text-slate-500">Mal sınıfı (MalSinif)</div>
            <input
              value={sinif}
              onChange={(e) => setSinif(e.target.value)}
              disabled={loading}
              placeholder="örn: 5AK (boş = hepsi)"
              className="h-10 w-40 rounded-lg border border-slate-200 px-3 text-sm uppercase disabled:bg-slate-50"
            />
          </label>
          <label className="flex h-10 items-center gap-2 text-[11px] font-black uppercase text-slate-600">
            <input
              type="checkbox"
              checked={aktivasyon}
              onChange={(e) => setAktivasyon(e.target.checked)}
              disabled={loading}
              className="h-4 w-4"
            />
            Sadece aktivasyon satışları
          </label>
          <label className="min-w-[220px] flex-1">
            <div className="mb-1 text-[10px] font-black uppercase text-slate-500">Ara (ürün adı, sınıf, satıcı...)</div>
            <input
              value={ara}
              onChange={(e) => setAra(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !loading) void run();
              }}
              disabled={loading}
              placeholder="örn: cam, samsung, zebleze"
              className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm disabled:bg-slate-50"
            />
          </label>
          <button
            type="button"
            onClick={() => void run()}
            disabled={loading}
            className="h-10 rounded-lg bg-blue-700 px-5 text-sm font-black text-white hover:bg-blue-800 disabled:opacity-50"
          >
            {loading ? "GETİRİLİYOR..." : "GETİR"}
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs font-bold text-red-700">
            {error}
          </div>
        )}
      </div>

      {result && (
        <div className="mt-6 space-y-6">
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
              {result.period.tarih} - {result.period.tarih2}
            </span>
            <span className="rounded-full bg-blue-50 px-3 py-1 text-blue-700">Toplam satır: {result.totalRows}</span>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">
              Aramaya uyan: {result.matchedRows}
              {result.matchedRows > result.returnedRows ? ` (ilk ${result.returnedRows} gösteriliyor)` : ""}
            </span>
          </div>

          <div className="flex flex-wrap gap-2 text-[11px] font-bold">
            {result.depotStatus.map((item) => (
              <span
                key={item.depo}
                title={item.error ?? undefined}
                className={`rounded-full px-3 py-1 ${
                  item.error ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-600"
                }`}
              >
                {item.magaza} ({item.depo}):{" "}
                {item.error ? `HATA - ${item.error}` : `${item.rowCount} satır · ${item.seconds} sn`}
              </span>
            ))}
          </div>

          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-4 text-lg font-black">
              Sınıflara göre satır sayısı{result.sinif ? ` (süzgeç: ${result.sinif})` : ""}
            </div>
            <div className="max-h-[260px] overflow-auto">
              <table className="w-full min-w-[420px] text-left">
                <thead>
                  <tr className="sticky top-0 border-b border-slate-200 bg-slate-50 text-[10px] font-black uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-2">Sınıf</th>
                    <th className="px-4 py-2">Sınıf adı</th>
                    <th className="px-4 py-2 text-right">Satır</th>
                    <th className="px-4 py-2 text-right">Adet</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {result.siniflar.map((item) => (
                    <tr key={item.sinif} className={result.sinif && item.sinif === result.sinif ? "bg-emerald-50" : ""}>
                      <td className="px-4 py-2 font-mono text-[11px] font-bold">{item.sinif}</td>
                      <td className="px-4 py-2 text-[11px] font-semibold">{item.adi || "-"}</td>
                      <td className="px-4 py-2 text-right text-[11px] font-semibold">{item.rowCount}</td>
                      <td className="px-4 py-2 text-right text-[11px] font-semibold">{item.qty}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {result.puanOzeti && (
            <section className="rounded-2xl border border-emerald-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-5 py-4">
                <div className="text-lg font-black">Puan özeti (ürün adının son 3 hanesi × adet)</div>
                <div className="mt-1 text-xs font-semibold text-slate-500">
                  Toplam puan: <b>{result.puanOzeti.total}</b> · puanı okunan satır: {result.puanOzeti.rowsWithPuan} · puanı
                  okunamayan (0 sayılan) satır: {result.puanOzeti.rowsWithoutPuan}
                </div>
                <div
                  className={`mt-1 text-[11px] font-bold ${result.puanOzeti.adetAlani ? "text-slate-500" : "text-red-600"}`}
                >
                  {result.puanOzeti.adetAlani
                    ? `Adet alanı: ${result.puanOzeti.adetAlani}`
                    : "Adet alanı bulunamadı: her satır 1 adet sayıldı. \"Gelen alanlar\" tablosuna bakın."}
                </div>
                {result.puanOzeti.withoutPuanExamples.length > 0 && (
                  <div className="mt-1 text-[11px] font-semibold text-amber-700">
                    Okunamayan örnekler: {result.puanOzeti.withoutPuanExamples.join(" | ")}
                  </div>
                )}
              </div>

              <div className="grid gap-0 lg:grid-cols-[260px_1fr]">
                <div className="border-b border-slate-100 lg:border-b-0 lg:border-r">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-black uppercase tracking-wide text-slate-500">
                        <th className="px-4 py-2">Mağaza</th>
                        <th className="px-4 py-2 text-right">Puan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {result.puanOzeti.byStore.map((store) => (
                        <tr key={store.magaza}>
                          <td className="px-4 py-2 text-[11px] font-bold">{store.magaza}</td>
                          <td className="px-4 py-2 text-right text-[11px] font-black">{store.puan}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="max-h-[420px] overflow-auto">
                  <table className="w-full min-w-[480px] text-left">
                    <thead>
                      <tr className="sticky top-0 border-b border-slate-200 bg-slate-50 text-[10px] font-black uppercase tracking-wide text-slate-500">
                        <th className="px-4 py-2">Satıcı</th>
                        <th className="px-4 py-2">Mağaza (puan)</th>
                        <th className="px-4 py-2 text-right">Satır</th>
                        <th className="px-4 py-2 text-right">Adet</th>
                        <th className="px-4 py-2 text-right">Puan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {result.puanOzeti.bySeller.map((seller) => (
                        <tr key={seller.saticiAdi || seller.saticiKod}>
                          <td className="px-4 py-2 text-[11px] font-bold">{seller.saticiAdi || seller.saticiKod}</td>
                          <td className="px-4 py-2 text-[11px] font-semibold">
                            {seller.magazalar.map((item) => `${item.magaza} (${item.puan})`).join(" + ")}
                          </td>
                          <td className="px-4 py-2 text-right text-[11px] font-semibold">{seller.rowCount}</td>
                          <td className="px-4 py-2 text-right text-[11px] font-semibold">{seller.qty}</td>
                          <td className="px-4 py-2 text-right text-[11px] font-black">{seller.puan}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}

          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <button
              type="button"
              onClick={() => setShowFields((value) => !value)}
              className="flex w-full items-center justify-between px-5 py-4 text-left"
            >
              <span className="text-lg font-black">Gelen alanlar ({result.fields.length})</span>
              <span className="text-xs font-black text-blue-600">{showFields ? "GİZLE" : "GÖSTER"}</span>
            </button>
            {showFields && (
              <div className="max-h-[360px] overflow-auto border-t border-slate-100">
                <table className="w-full min-w-[560px] text-left">
                  <thead>
                    <tr className="sticky top-0 border-b border-slate-200 bg-slate-50 text-[10px] font-black uppercase tracking-wide text-slate-500">
                      <th className="px-4 py-2">Alan</th>
                      <th className="px-4 py-2">Dolu %</th>
                      <th className="px-4 py-2">Tür</th>
                      <th className="px-4 py-2">Örnek değer</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {result.fields.map((field) => (
                      <tr key={field.name}>
                        <td className="px-4 py-2 font-mono text-[11px] font-bold">{field.name}</td>
                        <td className="px-4 py-2 text-[11px] font-semibold">%{field.filledPercent}</td>
                        <td className="px-4 py-2 text-[11px] font-semibold">{field.types.join(", ") || "-"}</td>
                        <td className="max-w-[360px] truncate px-4 py-2 text-[11px] font-semibold">
                          {cellText(field.example)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-4 text-lg font-black">Satış satırları</div>
            <div className="max-h-[520px] overflow-auto">
              <table className="w-full min-w-[900px] text-left">
                <thead>
                  <tr className="sticky top-0 border-b border-slate-200 bg-slate-50 text-[10px] font-black uppercase tracking-wide text-slate-500">
                    {columns.map((name) => (
                      <th key={name} className="whitespace-nowrap px-3 py-2">
                        {name === "__magaza" ? "Mağaza" : name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {result.rows.map((row, index) => (
                    <tr key={index}>
                      {columns.map((name) => (
                        <td key={name} className="max-w-[260px] truncate whitespace-nowrap px-3 py-2 text-[11px] font-semibold">
                          {cellText(row[name])}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {result.rows.length === 0 && (
                    <tr>
                      <td colSpan={Math.max(1, columns.length)} className="px-4 py-8 text-center text-xs font-bold text-slate-400">
                        Bu aramaya uyan satış satırı yok.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
