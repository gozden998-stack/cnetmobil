"use client";

// app/components/screens/WingsmDegerPuanim.tsx
//
// CNETMOBIL - WingSM "Değer Puanım" (personel-facing kişisel Değer Puan
// panosu)
//
// Bu ekran app/api/wingsm/deger-puanim/route.ts'i GET ile çağırır. O uç
// ARTIK canlı WingSM hesaplaması YAPMAZ — admin'in en son "HESAPLA" ile
// ürettiği ve kaydettiği anlık görüntüyü (snapshot) okuyup kendi mağazasına
// indirger. Bu yüzden bu ekranda tarih aralığı ya da "HESAPLA" YOKTUR —
// personel sadece admin'in en son hesapladığı sonucu görür ("son güncelleme"
// notuyla birlikte).
//
// KİMLİK NOTU: Personel girişleri mağaza bazlı PAYLAŞILAN girişlerdir
// (app/api/auth/route.ts'teki oturum sadece { role, branch } taşır, kişi adı
// yok). Bu yüzden ekran, kim olduğunu küçük/rahatsız etmeyen bir açılır
// menüyle sorar ve seçilen adı bu tarayıcıda (mağazaya özel bir localStorage
// anahtarıyla) hatırlar. Bu YUMUŞAK/GÜVENSİZ bir kimlik mekanizmasıdır (aynı
// mağaza terminalinde başka biri farklı bir isim seçebilir) — bilerek kabul
// edilen bir ödünleşim, üzerine ekstra güvenlik inşa EDİLMEMELİ. Gerçek
// güvenlik sınırı (mağazalar arası veri sızıntısı) tamamen API tarafında
// uygulanıyor.

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
  hasSnapshot: boolean;
  computedAt: string | null;
  myBranch: string;
  hedefPeriodu: string | null;
  gunBilgisi: { gecenGun: number; ayToplamGun: number; kalanGun: number } | null;
  stores: StoreRow[];
  personnel: PersonnelRow[];
  genelLider: GenelLider;
  totalSaleCount: number;
  totalScore: number;
  totalCarpanliPuan: number;
};

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

// "2026-09-21T10:15:00.000Z" -> "21.09.2026 10:15" (Türkçe, yerel saat).
function formatComputedAt(iso: string | null): string {
  if (!iso) return "-";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "-";
  const datePart = date.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });
  const timePart = date.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  return `${datePart} ${timePart}`;
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

// --------------------------------------------------
// İkonlar — bu kod tabanında ikon kütüphanesi (Tabler/Heroicons vb.) YOK.
// app/page.tsx'teki navIcon() ile aynı basit convention: inline <svg>,
// fill="none" stroke="currentColor", tek path, strokeWidth={2}.
// --------------------------------------------------

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

function ChartBarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 20V10m6 10V4m6 16v-7m4 7H2" />
    </svg>
  );
}

function TargetIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 21a9 9 0 100-18 9 9 0 000 18zM12 16a4 4 0 100-8 4 4 0 000 8zM12 12h.01"
      />
    </svg>
  );
}

function StarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 3l2.6 5.6 6.1.6-4.6 4.1 1.3 6-5.4-3.2-5.4 3.2 1.3-6-4.6-4.1 6.1-.6z"
      />
    </svg>
  );
}

function ShoppingBasketIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 10h16l-1.5 9a2 2 0 01-2 1.7H7.5a2 2 0 01-2-1.7L4 10zM8 10l1-6M16 10l-1-6M9 14v3M15 14v3"
      />
    </svg>
  );
}

function TrendingUpIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 17l6-6 4 4 8-8M15 7h6v6" />
    </svg>
  );
}

function LightbulbIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 18h6M10 21h4M12 3a6 6 0 00-3.5 10.9c.5.4.8 1 .8 1.6v.5h5.4v-.5c0-.6.3-1.2.8-1.6A6 6 0 0012 3z"
      />
    </svg>
  );
}

function MedalIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 3l3 6-3 3-3-3 3-6zM16 3l-3 6 3 3 3-3-3-6zM12 21a4 4 0 100-8 4 4 0 000 8z"
      />
    </svg>
  );
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}

function MapPinIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 21s7-6.5 7-11.5A7 7 0 105 9.5C5 14.5 12 21 12 21zM12 12a2.5 2.5 0 100-5 2.5 2.5 0 000 5z"
      />
    </svg>
  );
}

function UserIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0"
      />
    </svg>
  );
}

function StorefrontIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 9l1-5h14l1 5M4 9a2 2 0 004 0 2 2 0 004 0 2 2 0 004 0 2 2 0 004 0M5 9v10h14V9M9 19v-5h6v5"
      />
    </svg>
  );
}

function UsersGroupIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12a3 3 0 100-6 3 3 0 000 6zM3 20a6 6 0 0112 0M17 8a2.5 2.5 0 110 5M19.5 20a5.5 5.5 0 00-4-5.3"
      />
    </svg>
  );
}

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12l2 2 4-4M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function LayersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5M3 17.5l9 5 9-5"
      />
    </svg>
  );
}

function SparkleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M18 6l-2.5 2.5M8.5 15.5L6 18"
      />
    </svg>
  );
}

// Sıralama rozeti — top-3 için renkli dairesel rozet, geri kalanı düz gri.
function RankBadge({ rank }: { rank: number | null }) {
  if (rank === null) {
    return (
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-[11px] font-black text-slate-400">
        -
      </span>
    );
  }
  const classes =
    rank === 1
      ? "bg-amber-400 text-white"
      : rank === 2
        ? "bg-slate-300 text-slate-700"
        : rank === 3
          ? "bg-orange-400 text-white"
          : "bg-slate-100 text-slate-500";
  return (
    <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-black ${classes}`}>
      {rank}
    </span>
  );
}

// Kimlik seçilmediğinde "kişisel" bölümlerin yerini alan hafif, engelleyici
// olmayan yer tutucu (görev talebi: tam ekran kart YOK, sadece küçük bir not).
function PersonalPlaceholder({ label, className = "" }: { label: string; className?: string }) {
  return (
    <div
      className={`flex min-h-[96px] items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-6 text-center text-xs font-bold text-slate-400 ${className}`}
    >
      {label}
    </div>
  );
}

export default function WingsmDegerPuanim({ selectedBranch }: { selectedBranch: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [report, setReport] = useState<DegerPuanimReport | null>(null);

  const [pickedName, setPickedName] = useState("");

  const storageKey = `wingsm_degerpuanim_kimlik_${selectedBranch}`;

  const fetchReport = async () => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/wingsm/deger-puanim", {
        method: "GET",
        credentials: "same-origin",
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
      const loaded = await fetchReport();
      if (!loaded || !loaded.hasSnapshot) return;

      try {
        const saved = window.localStorage.getItem(storageKey) || "";
        setPickedName(saved);
      } catch {
        // Private tarama / depolama engelli — sessizce isimsiz devam edilir,
        // ekran çökmesin.
        setPickedName("");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBranch]);

  const handlePickName = (name: string) => {
    setPickedName(name);
    try {
      if (name) {
        window.localStorage.setItem(storageKey, name);
      } else {
        window.localStorage.removeItem(storageKey);
      }
    } catch {
      // Depolama engelliyse (private tarama vb.) sadece bu oturumda
      // hatırlanır, çökmeye gerek yok.
    }
  };

  const handleChangeName = () => {
    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      // yok say
    }
    setPickedName("");
  };

  const uniqueNames = report
    ? Array.from(new Set(report.personnel.map((p) => p.saticiAdi).filter((n) => n.trim())))
    : [];

  const me =
    report && pickedName
      ? report.personnel.find((p) => normalizeName(p.saticiAdi) === normalizeName(pickedName))
      : undefined;

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
          onClick={() => fetchReport()}
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

  // --------------------------------------------------
  // HENÜZ HİÇ HESAPLANMAMIŞ (admin hiç HESAPLA demedi / snapshot tablosu boş)
  // --------------------------------------------------

  if (!report.hasSnapshot) {
    return (
      <div className="animate-in fade-in duration-500 space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <ChartBarIcon className="h-6 w-6" />
          </div>
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-black text-slate-800">Değer Puanım</h1>
            <p className="text-sm text-slate-500">
              Kendi hedef ve puan performansınızı buradan takip edebilirsiniz.
            </p>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-8 text-center text-sm font-bold text-slate-500">
          Bu ay için henüz bir hesaplama yapılmadı. Yöneticin Rapor ekranından hesapladığında burada görünecek.
        </div>
      </div>
    );
  }

  const durum = hedefDurumu(me?.hedefYuzdesi ?? null);
  const clampedYuzde = me?.hedefYuzdesi !== undefined && me?.hedefYuzdesi !== null ? Math.min(100, Math.max(0, me.hedefYuzdesi)) : 0;
  const hedefeKalan = me?.hedef !== undefined && me?.hedef !== null ? Math.max(0, me.hedef - (me.carpanliPuan ?? 0)) : null;
  const hedefiAsti = me?.hedef !== undefined && me?.hedef !== null && me?.hedef !== null && (me?.carpanliPuan ?? 0) >= (me?.hedef ?? 0) && me.hedef > 0;

  const gunlukOrtalama = me && report.gunBilgisi && report.gunBilgisi.gecenGun > 0 ? me.saleCount / report.gunBilgisi.gecenGun : 0;

  const projeksiyonYuzde = me && me.hedef && me.hedef > 0 ? (me.projeksiyon / me.hedef) * 100 : null;

  const sortedStores = [...report.stores].sort((a, b) => {
    if (a.hedefYuzdesi === null && b.hedefYuzdesi === null) return 0;
    if (a.hedefYuzdesi === null) return 1;
    if (b.hedefYuzdesi === null) return -1;
    return b.hedefYuzdesi - a.hedefYuzdesi;
  });

  return (
    <div className="animate-in fade-in duration-500 space-y-6">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-blue-50 text-blue-600">
          <ChartBarIcon className="h-6 w-6" />
        </div>
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-black text-slate-800">Değer Puanım</h1>
          <p className="text-sm text-slate-500">
            Kendi hedef ve puan performansınızı buradan takip edebilirsiniz.
          </p>
          <p className="text-[11px] font-semibold text-slate-400">Son güncelleme: {formatComputedAt(report.computedAt)}</p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs font-bold text-red-700">
          {error}
        </div>
      )}

      {/* GENEL LİDER banner — şirket genelinde bu dönemin en yüksek hedef
          yüzdesine sahip kişisi. Herkes görebilir (mağaza-özel/kimlik-özel
          bilgi değil, isim seçilmese de gösterilir). Referans: düz mavi
          (gradyansız) kart, sağda tebrik alt-kartı. */}
      {report.genelLider && (
        <div className="flex flex-col gap-4 overflow-hidden rounded-2xl bg-blue-600 p-5 text-white lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex h-14 w-14 flex-none items-center justify-center rounded-xl bg-white/15 text-white">
              <TrophyIcon className="h-7 w-7" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-black uppercase tracking-wide text-blue-100">Genel Lider</span>
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-[10px] font-black text-white">
                  1
                </span>
                <MedalIcon className="h-4 w-4 text-amber-300" />
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-800/60 text-white">
                  <UserIcon className="h-3.5 w-3.5" />
                </span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <span className="text-base font-black">{report.genelLider.saticiAdi}</span>
                <span className="flex items-center gap-1 text-xs font-semibold text-blue-100">
                  <MapPinIcon className="h-3.5 w-3.5" />
                  {report.genelLider.branchLabel}
                </span>
              </div>
              <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-blue-100">
                <SparkleIcon className="h-3.5 w-3.5 text-amber-300" />
                Tüm mağazalar arasında bu ayın en yüksek puanını alarak Genel Lider oldu!
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-2">
              <TrophyIcon className="h-5 w-5 text-blue-100" />
              <div>
                <div className="text-[9px] font-black uppercase tracking-wide text-blue-100">Toplam Puan</div>
                <div className="text-lg font-black text-white">{formatNumber(report.genelLider.carpanliPuan)}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <TargetIcon className="h-5 w-5 text-blue-100" />
              <div>
                <div className="text-[9px] font-black uppercase tracking-wide text-blue-100">Hedef Gerçekleşme</div>
                <div className="text-lg font-black text-emerald-300">{formatPercent(report.genelLider.hedefYuzdesi)}</div>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl bg-amber-50 px-4 py-3 text-slate-800">
              <TrophyIcon className="h-6 w-6 flex-none text-amber-500" />
              <div>
                <div className="text-sm font-black">Tebrikler {report.genelLider.saticiAdi.split(" ")[0]}!</div>
                <p className="mt-0.5 max-w-[220px] text-[10px] font-semibold text-slate-500">
                  Disiplini, azmi ve başarılı performansı için tüm ekibe örnek oluyor.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Profil kartı — artık tam ekranı bloklayan ayrı bir "Sen kimsin?"
          adımı YOK. İsim seçilmediyse burada küçük, satır içi bir <select>
          gösterilir; seçilince aynı kart profil görünümüne döner. */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 flex-none items-center justify-center rounded-full bg-blue-600 text-lg font-black text-white">
            {pickedName ? getInitials(pickedName) : "?"}
          </div>
          <div>
            {pickedName ? (
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
            ) : uniqueNames.length === 0 ? (
              <div className="text-xs font-bold text-amber-600">
                Bu dönem için mağazanda henüz kayıtlı satış/hedef bulunamadı.
              </div>
            ) : (
              <select
                value=""
                onChange={(e) => handlePickName(e.target.value)}
                className="h-9 w-48 rounded-lg border border-slate-200 px-2 text-sm font-semibold text-slate-700"
              >
                <option value="">Adını seç</option>
                {uniqueNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            )}
            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs font-bold text-slate-400">
              <span className="flex items-center gap-1">
                <MapPinIcon className="h-3.5 w-3.5" />
                {selectedBranch}
              </span>
              <span className="flex items-center gap-1">
                <UserIcon className="h-3.5 w-3.5" />
                Satış Danışmanı
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-4 py-2 text-[11px] font-bold text-emerald-700">
          <TrophyIcon className="h-3.5 w-3.5" />
          Başarı senin elinde! Her satış, daha büyük bir hedefe.
        </div>
      </div>

      {pickedName && !me && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-xs font-bold text-amber-700">
          Bu dönem için &quot;{pickedName}&quot; adına ait bir kayıt bulunamadı — &quot;Değiştir&quot; ile adını
          tekrar kontrol edebilirsin.
        </div>
      )}

      {/* Metrik satırı — kimlik seçilmeden gösterilecek kişisel bir şey yok */}
      {pickedName ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wide text-slate-400">
              <UserIcon className="h-3.5 w-3.5" />
              Toplam Puan
            </div>
            <div className="mt-1 text-xl font-black text-slate-800">{me ? formatNumber(me.totalScore) : "-"}</div>
          </div>
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 shadow-sm">
            <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wide text-blue-500">
              <LayersIcon className="h-3.5 w-3.5" />
              Çarpanlı Puan
            </div>
            <div className="mt-1 text-xl font-black text-blue-800">{me ? formatNumber(me.carpanliPuan) : "-"}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wide text-slate-400">
              <TargetIcon className="h-3.5 w-3.5" />
              Hedef
            </div>
            <div className="mt-1 text-xl font-black text-slate-800">
              {me && me.hedef !== null ? formatNumber(me.hedef) : "-"}
            </div>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
            <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wide text-emerald-600">
              <CheckCircleIcon className="h-3.5 w-3.5" />
              Gerçekleşme
            </div>
            <div className="mt-1 text-xl font-black text-emerald-700">
              {me ? formatPercent(me.hedefYuzdesi) : "-"}
            </div>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
            <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wide text-amber-600">
              <StarIcon className="h-3.5 w-3.5" />
              Puan
            </div>
            <div className="mt-1 text-xl font-black text-amber-700">
              {me && me.siralamaPuani > 0 ? me.siralamaPuani : "-"}
            </div>
          </div>
          <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4 shadow-sm">
            <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wide text-violet-600">
              <ChartBarIcon className="h-3.5 w-3.5" />
              Sıralamam
            </div>
            <div className="mt-1 text-xl font-black text-violet-700">{me ? me.siralama ?? "-" : "-"}</div>
          </div>
        </div>
      ) : (
        <PersonalPlaceholder label="Adını seçince kişisel puan/hedef/sıralama kartların burada görünecek." />
      )}

      {/* Hedef gerçekleşme çubuğu */}
      {pickedName ? (
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
      ) : (
        <PersonalPlaceholder label="Adını seçince hedef gerçekleşme çubuğun burada görünecek." />
      )}

      {/* İkincil metrik satırı */}
      {pickedName ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div>
              <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wide text-slate-400">
                <ShoppingBasketIcon className="h-3.5 w-3.5" />
                Bu Ay Satış Adedi
              </div>
              <div className="mt-1 text-xl font-black text-slate-800">{me ? me.saleCount : "-"}</div>
            </div>
            <ChevronRightIcon className="h-4 w-4 flex-none text-slate-300" />
          </div>
          <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div>
              <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wide text-slate-400">
                <ChartBarIcon className="h-3.5 w-3.5" />
                Günlük Ortalama
              </div>
              <div className="mt-1 text-xl font-black text-slate-800">{me ? gunlukOrtalama.toFixed(1) : "-"}</div>
              <div className="mt-0.5 text-[9px] font-bold text-slate-400">
                Toplam {report.gunBilgisi ? report.gunBilgisi.gecenGun : "-"} gün
              </div>
            </div>
            <ChevronRightIcon className="h-4 w-4 flex-none text-slate-300" />
          </div>
          <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div>
              <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wide text-slate-400">
                <TrendingUpIcon className="h-3.5 w-3.5" />
                Ay Sonu Tahmini
              </div>
              <div className="mt-1 text-xl font-black text-slate-800">{me ? formatNumber(Math.round(me.projeksiyon)) : "-"}</div>
            </div>
            <ChevronRightIcon className="h-4 w-4 flex-none text-slate-300" />
          </div>
          <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div>
              <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wide text-slate-400">
                <TargetIcon className="h-3.5 w-3.5" />
                Hedef Durumu
              </div>
              <div className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-[11px] font-black ${durum.badgeClasses}`}>
                {durum.label}
              </div>
              {hedefeKalan !== null && !hedefiAsti && (
                <div className="mt-1 text-[9px] font-bold text-slate-400">{formatNumber(hedefeKalan)} puan kaldı</div>
              )}
            </div>
            <ChevronRightIcon className="h-4 w-4 flex-none text-slate-300" />
          </div>
        </div>
      ) : (
        <PersonalPlaceholder label="Adını seçince aylık satış/tahmin/hedef durumu kartların burada görünecek." />
      )}

      {/* Tablolar */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <div className="flex items-center gap-2">
              <UsersGroupIcon className="h-4 w-4 text-blue-500" />
              <div className="text-sm font-black text-slate-800">Mağazamdaki Ekip</div>
            </div>
            <p className="mt-0.5 text-[10px] font-semibold text-slate-400">
              Sıra, tüm CMR mağazaları arasındaki genel sıralamandır — sadece bu listede senin mağazandaki
              isimler gösteriliyor, bu yüzden sıra numaraları art arda gelmeyebilir.
            </p>
          </div>
          {pickedName ? (
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
                        <td className="px-3 py-2">
                          <RankBadge rank={p.siralama} />
                        </td>
                        <td className={`px-3 py-2 text-[11px] ${isMe ? "font-black text-blue-700" : "font-semibold"}`}>
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
                        Bu dönemde mağazanda kayıt bulunamadı.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <PersonalPlaceholder label="Adını seçince mağazandaki ekip sıralaması burada görünecek." className="rounded-none border-0 border-t border-dashed border-slate-200" />
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
            <StorefrontIcon className="h-4 w-4 text-blue-500" />
            <div className="text-sm font-black text-slate-800">Mağaza Sıralaması</div>
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
                {sortedStores.map((s, i) => {
                  const isMyStore = s.branchLabel === report.myBranch;
                  return (
                    <tr key={s.depotCode} className={isMyStore ? "bg-blue-50" : ""}>
                      <td className="px-3 py-2">
                        <RankBadge rank={i + 1} />
                      </td>
                      <td className={`px-3 py-2 text-[11px] ${isMyStore ? "font-black text-blue-700" : "font-semibold"}`}>
                        {s.branchLabel}
                        {isMyStore && (
                          <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-[8px] font-black text-blue-700">
                            BENİM MAĞAZAM
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-[11px] font-black">{formatNumber(s.carpanliPuan)}</td>
                      <td className="px-3 py-2 text-[11px] font-semibold">{s.hedef !== null ? formatNumber(s.hedef) : "-"}</td>
                      <td className="px-3 py-2 text-[11px] font-semibold">{formatPercent(s.hedefYuzdesi)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* Performans Özeti + Ay Sonu Tahmini */}
      {pickedName ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <LightbulbIcon className="h-5 w-5 text-amber-500" />
              <div className="text-sm font-black text-slate-800">Performans Özeti</div>
            </div>
            <ul className="mt-3 space-y-3">
              <li className="flex items-start gap-3">
                <span className="mt-0.5 flex h-7 w-7 flex-none items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                  <CheckCircleIcon className="h-4 w-4" />
                </span>
                <div className="text-xs font-semibold text-slate-600">
                  {me && me.hedef !== null ? (
                    hedefiAsti ? (
                      <>
                        <div className="font-black text-slate-800">Hedefini aştın!</div>
                        <div className="mt-0.5 text-slate-500">Bu ay için ek bir hedef baskısı yok, harika gidiyorsun.</div>
                      </>
                    ) : (
                      <>
                        <div className="font-black text-slate-800">{formatNumber(hedefeKalan ?? 0)} puan kaldı</div>
                        <div className="mt-0.5 text-slate-500">Hedefine ulaşmak için bu kadar puana daha ihtiyacın var.</div>
                      </>
                    )
                  ) : (
                    <>
                      <div className="font-black text-slate-800">Hedef girilmemiş</div>
                      <div className="mt-0.5 text-slate-500">Bu ay için henüz bir hedefin girilmemiş.</div>
                    </>
                  )}
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-0.5 flex h-7 w-7 flex-none items-center justify-center rounded-full bg-violet-50 text-violet-600">
                  <TrophyIcon className="h-4 w-4" />
                </span>
                <div className="text-xs font-semibold text-slate-600">
                  {me && me.siralama !== null ? (
                    <>
                      <div className="font-black text-slate-800">{me.siralama}. sıradasın</div>
                      <div className="mt-0.5 text-slate-500">Tüm CMR mağazaları arasında genel sıralaman.</div>
                    </>
                  ) : (
                    <>
                      <div className="font-black text-slate-800">Sıralamada değilsin</div>
                      <div className="mt-0.5 text-slate-500">Bu ay sıralamaya girmedin (hedef girilmemiş).</div>
                    </>
                  )}
                </div>
              </li>
            </ul>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <TrendingUpIcon className="h-5 w-5 text-blue-500" />
              <div className="text-sm font-black text-slate-800">Ay Sonu Tahmini</div>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <div>
                <div className="text-2xl font-black text-slate-800">{me ? formatNumber(Math.round(me.projeksiyon)) : "-"}</div>
                <div className="text-[9px] font-black uppercase tracking-wide text-slate-400">Tahmini Puan</div>
              </div>
              <div className="rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-black text-emerald-700">
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
            <div className="mt-1 flex items-center justify-between text-[9px] font-bold text-slate-400">
              <span>Mevcut: {me ? formatNumber(me.carpanliPuan) : "-"}</span>
              <span>Hedef: {me && me.hedef !== null ? formatNumber(me.hedef) : "-"}</span>
            </div>
          </section>
        </div>
      ) : (
        <PersonalPlaceholder label="Adını seçince performans özetin ve ay sonu tahminin burada görünecek." />
      )}

      {/* Alt teşvik bannerı */}
      <div className={`flex items-center justify-center gap-2 rounded-2xl px-5 py-4 text-center text-sm font-bold ${durum.badgeClasses}`}>
        <StarIcon className="h-4 w-4 flex-none" />
        {durum.banner}
      </div>
    </div>
  );
}
