"use client";

// app/components/screens/WingsmDegerPuanim.tsx
//
// CNETMOBIL - WingSM "Değer Puanım" (personel-facing kişisel Değer Puan
// panosu)
//
// Bu ekran app/api/wingsm/deger-puanim/route.ts'i çağırır — admin-only
// deger-puan-report uç noktasının aksine, bu uç personel oturumuna da
// açıktır ve cevabı SADECE kullanıcının kendi mağazasına indirger (bkz. o
// route'un başındaki güvenlik yorumu).
//
// KİMLİK NOTU: Personel girişleri mağaza bazlı PAYLAŞILAN girişlerdir
// (app/api/auth/route.ts'teki oturum sadece { role, branch } taşır, kişi adı
// yok). Bu yüzden ekran, "sen kimsin?" diye sorup seçilen adı bu tarayıcıda
// (mağazaya özel bir localStorage anahtarıyla) hatırlar. Bu YUMUŞAK/GÜVENSİZ
// bir kimlik mekanizmasıdır (aynı mağaza terminalinde başka biri farklı bir
// isim seçebilir) — bilerek kabul edilen bir ödünleşim, üzerine ekstra
// güvenlik inşa EDİLMEMELİ. Gerçek güvenlik sınırı (mağazalar arası veri
// sızıntısı) tamamen API tarafında uygulanıyor.

import React, { useEffect, useState } from "react";

type StoreRow = {
  branchLabel: string;
  depotCode: string;
  saleCount: number;
  totalScore: number;
  multiplier: number;
  carpanliPuan: number;
  hedef: number | null;
  projeksiyon: number;
  hedefYuzdesi: number | null;
  siralamaPuani: number;
};

type PersonnelRow = {
  branchLabel: string;
  saticiKod: string;
  saticiAdi: string;
  saleCount: number;
  totalScore: number;
  carpanliPuan: number;
  hedef: number | null;
  isManager: boolean;
  hedefYuzdesi: number | null;
  projeksiyon: number;
  siralama: number | null;
  siralamaPuani: number;
};

type GenelLider = {
  saticiAdi: string;
  branchLabel: string;
  carpanliPuan: number;
  hedefYuzdesi: number;
} | null;

type DegerPuanimReport = {
  myBranch: string;
  hedefPeriodu: string;
  gunBilgisi: { gecenGun: number; ayToplamGun: number; kalanGun: number };
  period: { tarih: string; tarih2: string };
  stores: StoreRow[];
  personnel: PersonnelRow[];
  genelLider: GenelLider;
  totalSaleCount: number;
  totalScore: number;
  totalCarpanliPuan: number;
};

// admin/page.tsx ve WingsmDegerPuan.tsx'teki AYNI desen: bugünün ayının
// 1'i -> bugün, "GG.AA.YYYY" biçiminde.
function formatDateInput(date: Date) {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
}

function defaultBastar() {
  const now = new Date();
  return formatDateInput(new Date(now.getFullYear(), now.getMonth(), 1));
}

function defaultBittar() {
  return formatDateInput(new Date());
}

function formatNumber(value: number) {
  if (!Number.isFinite(value)) return "-";
  return value.toLocaleString("tr-TR", { maximumFractionDigits: 2 });
}

function formatPercent(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "-";
  return `${value.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

// deger-puan-report/route.ts'teki normalizeName ile AYNI mantık — kişi
// isimlerini büyük/küçük harf ve boşluk farkına duyarsız karşılaştırmak
// için.
function normalizeName(value: string): string {
  return value.trim().toLocaleUpperCase("tr-TR").replace(/\s+/g, " ");
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

// Hedef gerçekleşme yüzdesine göre nitel durum — hem "Hedef Durumu" rozetinde
// hem alt teşvik bannerında kullanılıyor (aynı eşikler, tek yerden yönetim).
function hedefDurumu(hedefYuzdesi: number | null): {
  label: string;
  badgeClasses: string;
  banner: string;
} {
  if (hedefYuzdesi === null) {
    return {
      label: "Hedef Girilmemiş",
      badgeClasses: "bg-slate-100 text-slate-500",
      banner: "Bu ay için henüz bir hedefin girilmemiş. Mağaza yöneticinle konuşup hedefini belirletebilirsin.",
    };
  }
  if (hedefYuzdesi >= 100) {
    return {
      label: "Hedef Aşıldı",
      badgeClasses: "bg-emerald-100 text-emerald-700",
      banner: "Hedefini yakaladın, hatta aştın! Bu ay için harika bir performans — tebrikler.",
    };
  }
  if (hedefYuzdesi >= 80) {
    return {
      label: "Hedefe Yakın",
      badgeClasses: "bg-blue-100 text-blue-700",
      banner: "Hedefe çok yaklaştın, son düzlükte biraz daha gaz — başarabilirsin!",
    };
  }
  if (hedefYuzdesi >= 50) {
    return {
      label: "Yolun Yarısında",
      badgeClasses: "bg-amber-100 text-amber-700",
      banner: "Yolun yarısındasın. Bu tempoyla devam edersen hedefe ulaşman an meselesi.",
    };
  }
  return {
    label: "Hedeften Uzak",
    badgeClasses: "bg-rose-100 text-rose-700",
    banner: "Henüz yolun başındasın ama her satış seni hedefe biraz daha yaklaştırıyor — devam et!",
  };
}

function TrophyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 21h8M12 17v4M7 4h10v4a5 5 0 01-10 0V4zM7 5H4a3 3 0 003 3M17 5h3a3 3 0 01-3 3"
      />
    </svg>
  );
}

export default function WingsmDegerPuanim({ selectedBranch }: { selectedBranch: string }) {
  const [bastar, setBastar] = useState(defaultBastar);
  const [bittar, setBittar] = useState(defaultBittar);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [report, setReport] = useState<DegerPuanimReport | null>(null);

  const [pickedName, setPickedName] = useState("");
  const [showPicker, setShowPicker] = useState(false);
  const [pickerSelection, setPickerSelection] = useState("");

  const storageKey = `wingsm_degerpuanim_kimlik_${selectedBranch}`;

  const fetchReport = async (bastarVal: string, bittarVal: string) => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/wingsm/deger-puanim", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bastar: bastarVal, bittar: bittarVal }),
      });

      const payload = await res.json().catch(() => null);

      if (!res.ok || !payload?.success) {
        throw new Error(payload?.error || `HTTP ${res.status}`);
      }

      setReport(payload as DegerPuanimReport);
      return payload as DegerPuanimReport;
    } catch (err) {
      setReport(null);
      setError(err instanceof Error ? err.message : "Değer Puanım raporu alınamadı.");
      return null;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      const loaded = await fetchReport(bastar, bittar);
      if (!loaded) return;

      let saved = "";
      try {
        saved = window.localStorage.getItem(storageKey) || "";
      } catch {
        // Private tarama / depolama engelli — sessizce isim seçtirmeye
        // devam edilir, ekran çökmesin.
        saved = "";
      }

      if (saved) {
        setPickedName(saved);
        setShowPicker(false);
      } else {
        setShowPicker(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBranch]);

  const handleHesapla = () => {
    fetchReport(bastar, bittar);
  };

  const handleContinue = () => {
    if (!pickerSelection) return;

    try {
      window.localStorage.setItem(storageKey, pickerSelection);
    } catch {
      // Depolama engelliyse (private tarama vb.) sadece bu oturumda
      // hatırlanır, çökmeye gerek yok.
    }

    setPickedName(pickerSelection);
    setShowPicker(false);
  };

  const handleChangeName = () => {
    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      // yok say
    }
    setPickedName("");
    setPickerSelection("");
    setShowPicker(true);
  };

  const uniqueNames = report
    ? Array.from(new Set(report.personnel.map((p) => p.saticiAdi).filter((n) => n.trim())))
    : [];

  const me = report ? report.personnel.find((p) => normalizeName(p.saticiAdi) === normalizeName(pickedName)) : undefined;

  // --------------------------------------------------
  // YÜKLENİYOR / HATA
  // --------------------------------------------------

  if (loading && !report) {
    return (
      <div className="flex min-h-[300px] items-center justify-center text-sm font-bold text-slate-400">
        Değer Puanım yükleniyor...
      </div>
    );
  }

  if (error && !report) {
    return (
      <div className="animate-in fade-in duration-500">
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-bold text-red-700">
          {error}
        </div>
        <button
          type="button"
          onClick={() => fetchReport(bastar, bittar)}
          className="mt-4 h-10 rounded-lg bg-blue-700 px-5 text-sm font-black text-white hover:bg-blue-800"
        >
          TEKRAR DENE
        </button>
      </div>
    );
  }

  if (!report) {
    return null;
  }

  const durum = hedefDurumu(me?.hedefYuzdesi ?? null);
  const clampedYuzde = me?.hedefYuzdesi !== undefined && me?.hedefYuzdesi !== null ? Math.min(100, Math.max(0, me.hedefYuzdesi)) : 0;
  const hedefeKalan = me?.hedef !== undefined && me?.hedef !== null ? Math.max(0, me.hedef - (me.carpanliPuan ?? 0)) : null;
  const hedefiAsti = me?.hedef !== undefined && me?.hedef !== null && me?.hedef !== null && (me?.carpanliPuan ?? 0) >= (me?.hedef ?? 0) && me.hedef > 0;

  const gunlukOrtalama = me && report.gunBilgisi.gecenGun > 0 ? me.saleCount / report.gunBilgisi.gecenGun : 0;

  const projeksiyonYuzde = me && me.hedef && me.hedef > 0 ? (me.projeksiyon / me.hedef) * 100 : null;

  const sortedStores = [...report.stores].sort((a, b) => {
    if (a.hedefYuzdesi === null && b.hedefYuzdesi === null) return 0;
    if (a.hedefYuzdesi === null) return 1;
    if (b.hedefYuzdesi === null) return -1;
    return b.hedefYuzdesi - a.hedefYuzdesi;
  });

  return (
    <div className="animate-in fade-in duration-500 space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-black">Değer Puanım</h1>
        <p className="text-sm text-slate-500">
          {selectedBranch} mağazandaki performansın — Değer Puan sistemine göre kişisel özet.
        </p>
      </div>

      {/* Dönem filtresi */}
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
          <button
            type="button"
            onClick={handleHesapla}
            disabled={loading}
            className="h-10 rounded-lg bg-blue-700 px-5 text-sm font-black text-white hover:bg-blue-800 disabled:opacity-50"
          >
            {loading ? "HESAPLANIYOR..." : "HESAPLA"}
          </button>
        </div>
        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs font-bold text-red-700">
            {error}
          </div>
        )}
      </div>

      {/* GENEL LİDER banner — şirket genelinde bu dönemin en yüksek hedef
          yüzdesine sahip kişisi. Herkes görebilir (mağaza-özel bilgi değil). */}
      {report.genelLider && (
        <div className="flex flex-col gap-3 rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-50 to-blue-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 flex-none items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-sm">
              <TrophyIcon className="h-7 w-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-[10px] font-black text-white">
                  1.
                </span>
                <span className="text-[10px] font-black uppercase tracking-wide text-indigo-500">Genel Lider</span>
              </div>
              <div className="mt-0.5 text-base font-black text-slate-800">
                {report.genelLider.saticiAdi}{" "}
                <span className="font-bold text-slate-400">· {report.genelLider.branchLabel}</span>
              </div>
              <p className="mt-1 text-xs font-semibold text-indigo-700">
                Tüm mağazalar arasında bu ayın en yüksek hedef gerçekleşmesini yakalayarak Genel Lider oldu!
              </p>
            </div>
          </div>
          <div className="flex gap-4 sm:text-right">
            <div>
              <div className="text-[9px] font-black uppercase tracking-wide text-indigo-400">Toplam Puan</div>
              <div className="text-lg font-black text-slate-800">{formatNumber(report.genelLider.carpanliPuan)}</div>
            </div>
            <div>
              <div className="text-[9px] font-black uppercase tracking-wide text-indigo-400">Gerçekleşme</div>
              <div className="text-lg font-black text-emerald-600">{formatPercent(report.genelLider.hedefYuzdesi)}</div>
            </div>
          </div>
        </div>
      )}

      {showPicker ? (
        <div className="flex min-h-[240px] items-center justify-center">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
            <div className="text-lg font-black text-slate-800">Sen kimsin?</div>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              {selectedBranch} mağazasındaki personel listesinden adını seç — bir dahaki sefere sormayız.
            </p>

            {uniqueNames.length === 0 ? (
              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-xs font-bold text-amber-700">
                Bu dönem için mağazanda henüz kayıtlı satış/hedef bulunamadı. Yönetici Hedefler ekranından seni
                eklediğinde burada görünecek.
              </div>
            ) : (
              <>
                <select
                  value={pickerSelection}
                  onChange={(e) => setPickerSelection(e.target.value)}
                  className="mt-4 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-semibold"
                >
                  <option value="">Adını seç...</option>
                  {uniqueNames.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleContinue}
                  disabled={!pickerSelection}
                  className="mt-4 h-10 w-full rounded-lg bg-blue-700 text-sm font-black text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Devam Et
                </button>
              </>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Profil kartı */}
          <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 flex-none items-center justify-center rounded-full bg-blue-600 text-lg font-black text-white">
                {getInitials(pickedName)}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <div className="text-base font-black text-slate-800">{pickedName}</div>
                  <button
                    type="button"
                    onClick={handleChangeName}
                    className="text-[10px] font-black uppercase tracking-wide text-blue-500 hover:text-blue-700"
                  >
                    Değiştir
                  </button>
                </div>
                <div className="text-xs font-bold text-slate-400">
                  {selectedBranch} · Satış Danışmanı
                </div>
              </div>
            </div>
            <div className="rounded-full bg-emerald-50 px-4 py-2 text-[11px] font-bold text-emerald-700">
              Başarı senin elinde! Her satış, daha büyük bir hedefe.
            </div>
          </div>

          {!me && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-xs font-bold text-amber-700">
              Bu dönem için &quot;{pickedName}&quot; adına ait bir kayıt bulunamadı — farklı bir tarih aralığı
              seçmeyi veya &quot;Değiştir&quot; ile adını tekrar kontrol etmeyi deneyebilirsin.
            </div>
          )}

          {/* Metrik satırı */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-[9px] font-black uppercase tracking-wide text-slate-400">Toplam Puan</div>
              <div className="mt-1 text-xl font-black text-slate-800">{me ? formatNumber(me.totalScore) : "-"}</div>
            </div>
            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 shadow-sm">
              <div className="text-[9px] font-black uppercase tracking-wide text-blue-500">Çarpanlı Puan</div>
              <div className="mt-1 text-xl font-black text-blue-800">{me ? formatNumber(me.carpanliPuan) : "-"}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-[9px] font-black uppercase tracking-wide text-slate-400">Hedef</div>
              <div className="mt-1 text-xl font-black text-slate-800">
                {me && me.hedef !== null ? formatNumber(me.hedef) : "-"}
              </div>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
              <div className="text-[9px] font-black uppercase tracking-wide text-emerald-600">Gerçekleşme</div>
              <div className="mt-1 text-xl font-black text-emerald-700">
                {me ? formatPercent(me.hedefYuzdesi) : "-"}
              </div>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
              <div className="text-[9px] font-black uppercase tracking-wide text-amber-600">Bonus Puan</div>
              <div className="mt-1 text-xl font-black text-amber-700">
                {me && me.siralamaPuani > 0 ? me.siralamaPuani : "-"}
              </div>
            </div>
            <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4 shadow-sm">
              <div className="text-[9px] font-black uppercase tracking-wide text-violet-600">Sıralamam</div>
              <div className="mt-1 text-xl font-black text-violet-700">{me ? me.siralama ?? "-" : "-"}</div>
            </div>
          </div>

          {/* Hedef gerçekleşme çubuğu */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-black text-slate-800">Hedef Gerçekleşme Oranı</div>
              {me && me.hedef !== null ? (
                hedefiAsti ? (
                  <div className="text-xs font-black text-emerald-600">Hedefini aştın!</div>
                ) : (
                  <div className="text-xs font-bold text-slate-500">
                    Hedefe kalan: <span className="font-black text-slate-800">{formatNumber(hedefeKalan ?? 0)} puan</span>
                  </div>
                )
              ) : (
                <div className="text-xs font-bold text-slate-400">Hedef girilmemiş</div>
              )}
            </div>
            <div className="mt-3 h-4 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full transition-all ${
                  clampedYuzde >= 100 ? "bg-emerald-500" : clampedYuzde >= 50 ? "bg-blue-500" : "bg-amber-500"
                }`}
                style={{ width: `${clampedYuzde}%` }}
              />
            </div>
            <div className="mt-1 text-right text-xs font-black text-slate-500">
              {me && me.hedef !== null ? formatPercent(me.hedefYuzdesi) : "-"}
            </div>
          </div>

          {/* İkincil metrik satırı */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-[9px] font-black uppercase tracking-wide text-slate-400">Bu Ay Satış Adedi</div>
              <div className="mt-1 text-xl font-black text-slate-800">{me ? me.saleCount : "-"}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-[9px] font-black uppercase tracking-wide text-slate-400">Günlük Ortalama</div>
              <div className="mt-1 text-xl font-black text-slate-800">{me ? gunlukOrtalama.toFixed(1) : "-"}</div>
              <div className="mt-0.5 text-[9px] font-bold text-slate-400">Toplam {report.gunBilgisi.gecenGun} gün</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-[9px] font-black uppercase tracking-wide text-slate-400">Ay Sonu Tahmini</div>
              <div className="mt-1 text-xl font-black text-slate-800">{me ? formatNumber(Math.round(me.projeksiyon)) : "-"}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-[9px] font-black uppercase tracking-wide text-slate-400">Hedef Durumu</div>
              <div className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-[11px] font-black ${durum.badgeClasses}`}>
                {durum.label}
              </div>
            </div>
          </div>

          {/* Tablolar */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-5 py-4">
                <div className="text-sm font-black text-slate-800">Mağazamdaki Ekip</div>
                <p className="mt-0.5 text-[10px] font-semibold text-slate-400">
                  Sıra, tüm CMR mağazaları arasındaki genel sıralamandır — sadece bu listede senin mağazandaki
                  isimler gösteriliyor, bu yüzden sıra numaraları art arda gelmeyebilir.
                </p>
              </div>
              <div className="max-h-[360px] overflow-auto">
                <table className="w-full min-w-[520px] text-left">
                  <thead>
                    <tr className="sticky top-0 border-b border-slate-200 bg-slate-50 text-[8px] font-black uppercase tracking-wide text-slate-500">
                      <th className="px-3 py-2">Sıra</th>
                      <th className="px-3 py-2">Çalışan</th>
                      <th className="px-3 py-2">Toplam Puan</th>
                      <th className="px-3 py-2">Hedef</th>
                      <th className="px-3 py-2">Gerçekleşme</th>
                      <th className="px-3 py-2">Puan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {report.personnel.map((p, i) => {
                      const isMe = normalizeName(p.saticiAdi) === normalizeName(pickedName);
                      return (
                        <tr key={`${p.saticiKod || p.saticiAdi}-${i}`} className={isMe ? "bg-blue-50" : ""}>
                          <td className="px-3 py-2 text-[11px] font-semibold">{p.siralama ?? "-"}</td>
                          <td className="px-3 py-2 text-[11px] font-semibold">
                            {p.saticiAdi || p.saticiKod}
                            {isMe && (
                              <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-[8px] font-black text-blue-700">
                                SEN
                              </span>
                            )}
                            {p.isManager && (
                              <span className="ml-2 rounded-full bg-violet-100 px-2 py-0.5 text-[8px] font-black text-violet-700">
                                MÜDÜR
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-[11px] font-semibold">{formatNumber(p.totalScore)}</td>
                          <td className="px-3 py-2 text-[11px] font-semibold">{p.hedef !== null ? formatNumber(p.hedef) : "-"}</td>
                          <td className="px-3 py-2 text-[11px] font-semibold">{formatPercent(p.hedefYuzdesi)}</td>
                          <td className="px-3 py-2 text-[11px] font-black text-emerald-600">
                            {p.siralamaPuani > 0 ? p.siralamaPuani : ""}
                          </td>
                        </tr>
                      );
                    })}
                    {report.personnel.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-3 py-6 text-center text-xs font-bold text-slate-400">
                          Bu aralıkta mağazanda kayıt bulunamadı.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-5 py-4 text-sm font-black text-slate-800">
                Mağaza Sıralaması
              </div>
              <div className="overflow-auto">
                <table className="w-full min-w-[480px] text-left">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-[8px] font-black uppercase tracking-wide text-slate-500">
                      <th className="px-3 py-2">Sıra</th>
                      <th className="px-3 py-2">Mağaza</th>
                      <th className="px-3 py-2">Toplam Puan</th>
                      <th className="px-3 py-2">Hedef</th>
                      <th className="px-3 py-2">Gerçekleşme</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {sortedStores.map((s, i) => (
                      <tr key={s.depotCode} className={s.branchLabel === report.myBranch ? "bg-blue-50" : ""}>
                        <td className="px-3 py-2 text-[11px] font-semibold">{i + 1}</td>
                        <td className="px-3 py-2 text-[11px] font-semibold">
                          {s.branchLabel}
                          {s.branchLabel === report.myBranch && (
                            <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-[8px] font-black text-blue-700">
                              BENİM MAĞAZAM
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-[11px] font-black">{formatNumber(s.carpanliPuan)}</td>
                        <td className="px-3 py-2 text-[11px] font-semibold">{s.hedef !== null ? formatNumber(s.hedef) : "-"}</td>
                        <td className="px-3 py-2 text-[11px] font-semibold">{formatPercent(s.hedefYuzdesi)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          {/* Performans Özeti + Ay Sonu Tahmini */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <svg className="h-5 w-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l7 6.5L9 19z" />
                </svg>
                <div className="text-sm font-black text-slate-800">Performans Özeti</div>
              </div>
              <ul className="mt-3 space-y-2 text-xs font-semibold text-slate-600">
                <li>
                  {me && me.hedef !== null ? (
                    hedefiAsti ? (
                      <>Hedefini aştın — bu ay için ek bir hedef baskısı yok, harika gidiyorsun.</>
                    ) : (
                      <>
                        Hedefe kalan: <span className="font-black text-slate-800">{formatNumber(hedefeKalan ?? 0)} puan</span>
                      </>
                    )
                  ) : (
                    <>Bu ay için henüz bir hedefin girilmemiş.</>
                  )}
                </li>
                <li>
                  {me && me.siralama !== null ? (
                    <>
                      Tüm CMR mağazaları arasında genel sıralaman:{" "}
                      <span className="font-black text-slate-800">{me.siralama}.</span>
                    </>
                  ) : (
                    <>Bu ay sıralamaya girmedin (hedef girilmemiş).</>
                  )}
                </li>
              </ul>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <svg className="h-5 w-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3v18h18M7 15l4-4 4 4 4-8" />
                </svg>
                <div className="text-sm font-black text-slate-800">Ay Sonu Tahmini</div>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <div className="text-2xl font-black text-slate-800">{me ? formatNumber(Math.round(me.projeksiyon)) : "-"}</div>
                <div className="rounded-full bg-blue-100 px-3 py-1 text-[11px] font-black text-blue-700">
                  {projeksiyonYuzde !== null ? `${formatPercent(projeksiyonYuzde)} Tahmini Gerçekleşme` : "-"}
                </div>
              </div>
              <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-blue-500 transition-all"
                  style={{
                    width: `${
                      me && me.hedef && me.hedef > 0 ? Math.min(100, Math.max(0, (me.carpanliPuan / me.hedef) * 100)) : 0
                    }%`,
                  }}
                />
              </div>
            </section>
          </div>

          {/* Alt teşvik bannerı */}
          <div className={`rounded-2xl px-5 py-4 text-center text-sm font-bold ${durum.badgeClasses}`}>
            {durum.banner}
          </div>
        </>
      )}
    </div>
  );
}
