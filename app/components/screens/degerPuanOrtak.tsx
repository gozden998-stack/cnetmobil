// app/components/screens/degerPuanOrtak.tsx
//
// WingSM Değer Puan - personel ekranı (WingsmDegerPuanim) ile ana sayfadaki
// "Şirket Değer Puan" özetinin (SirketDegerPuanOzeti) ORTAK parçaları: tipler,
// biçimlendirme yardımcıları, ilerleme çubuğu ve ay sonu duyuru metni. İki yer
// aynı görünümü/metni paylaşsın diye tek yerde.

import React from "react";

export type StoreRow = {
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

export type PersonnelRow = {
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

export type DegerPuanimReport = {
  hasSnapshot: boolean;
  computedAt: string | null;
  hedefPeriodu: string | null;
  period: { tarih: string; tarih2: string } | null;
  history?: Array<{ id: number; tarih: string; tarih2: string; computedAt: string }>;
  selectedHistoryId?: number | null;
  bulunamadi?: boolean;
  istenenGun?: string | null;
  tamEsleme?: boolean;
  aySonuPaylasim?: boolean;
  durum?: "guncel" | "bekleniyor" | null;
  gunBilgisi: { gecenGun: number; ayToplamGun: number; kalanGun: number } | null;
  stores: StoreRow[];
  personnel: PersonnelRow[];
};

// Ay sonu duyurusu (otomatik hesap ayın 28'inde durur). Metni buradan değiştirin.
export const AY_SONU_MESAJI = "Ay sonu raporu, ayın 1'inde yönetici tarafından gruptan paylaşılacaktır.";

export function formatNumber(value: number, digits = 0) {
  if (!Number.isFinite(value)) return "-";
  return value.toLocaleString("tr-TR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

// Tasarımdaki gibi önde yüzde işaretiyle: "%35,10"
export function formatPercent(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "%0,00";
  return `%${formatNumber(value, 2)}`;
}

// { tarih: "01/10/2026", tarih2: "09/10/2026" } -> "01.10 - 09.10.2026"
export function formatRangeLong(tarih: string, tarih2: string) {
  const a = String(tarih || "").split("/");
  const b = String(tarih2 || "").split("/");
  if (a.length !== 3 || b.length !== 3) return `${tarih} - ${tarih2}`;
  return `${a[0]}.${a[1]} - ${b[0]}.${b[1]}.${b[2]}`;
}

// "2026-09-21T10:15:00.000Z" -> "21.09.2026 10:15" (Türkçe, yerel saat).
export function formatComputedAt(iso: string | null): string {
  if (!iso) return "-";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "-";
  const datePart = date.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });
  const timePart = date.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  return `${datePart} ${timePart}`;
}

// "GİRAY ÇAKICI" -> "Giray Çakıcı"
export function titleCaseTr(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toLocaleUpperCase("tr-TR") + word.slice(1))
    .join(" ");
}

// "CMR SARAY" -> "CMR Saray" (CMR hep büyük harf)
export function formatStoreName(label: string) {
  return label
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => (word.toUpperCase() === "CMR" ? "CMR" : titleCaseTr(word)))
    .join(" ");
}

export function ProgressBar({ percent, barClass }: { percent: number | null; barClass: string }) {
  const width = percent === null ? 0 : Math.min(100, Math.max(3, percent));

  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
      <div className={`h-full rounded-full box-border ${barClass}`} style={{ width: `${width}%` }} />
    </div>
  );
}
