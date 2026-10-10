// app/components/screens/degerPuanRenkleri.ts
//
// WingSM Değer Puan satır renkleri — hem admin raporu (WingsmDegerPuan) hem
// personel ekranı (WingsmDegerPuanim) AYNI kuralı kullansın diye tek yerde.
//
// Renk, yüzdeye değil SIRAYA göre verilir (Excel'deki elle boyama kuralı):
//
//   MAĞAZA (hedef gerçekleşme % sırasına göre)
//     1. koyu yeşil · 2. açık yeşil · 3. beyaz · 4. kırmızı
//
//   PERSONEL (sıralamaya giren kişiler, hedef gerçekleşme % sırasına göre)
//     1. koyu yeşil · 2-3. açık yeşil · 4-6. beyaz · 7. turuncu
//     Diğerleri (8. ve sonrası) kırmızı. Sıralamaya girmeyenler (müdür,
//     hedefi olmayan) da kırmızı.

export const SATIR_KOYU_YESIL = "bg-[#70ad47] text-slate-900";
export const SATIR_ACIK_YESIL = "bg-[#e2efda] text-slate-900";
export const SATIR_BEYAZ = "bg-white text-slate-900";
export const SATIR_TURUNCU = "bg-[#f8cbad] text-slate-900";
export const SATIR_KIRMIZI = "bg-[#ff0000] text-slate-900";

// index: mağazanın hedef yüzdesine göre sıralı listedeki yeri (0'dan başlar).
// hedefVar: hedefi girilmemiş mağaza sıralamaya giremez, kırmızı olur.
export function magazaSatirRengi(index: number, hedefVar: boolean): string {
  if (!hedefVar) return SATIR_KIRMIZI;
  if (index === 0) return SATIR_KOYU_YESIL;
  if (index === 1) return SATIR_ACIK_YESIL;
  if (index === 2) return SATIR_BEYAZ;
  return SATIR_KIRMIZI;
}

// siralama: API'nin verdiği sıra numarası (1'den başlar). Sıralamaya girmeyen
// kişide null gelir.
export function personelSatirRengi(siralama: number | null): string {
  if (siralama === null || siralama < 1) return SATIR_KIRMIZI;
  if (siralama === 1) return SATIR_KOYU_YESIL;
  if (siralama <= 3) return SATIR_ACIK_YESIL;
  if (siralama <= 6) return SATIR_BEYAZ;
  if (siralama === 7) return SATIR_TURUNCU;
  return SATIR_KIRMIZI;
}

// Hedef gerçekleşme yüzdesine göre mağazaları büyükten küçüğe sıralar,
// hedefi olmayanlar en sona gider.
export function magazalariSirala<T extends { hedefYuzdesi: number | null }>(stores: T[]): T[] {
  return [...stores].sort((a, b) => {
    if (a.hedefYuzdesi === null && b.hedefYuzdesi === null) return 0;
    if (a.hedefYuzdesi === null) return 1;
    if (b.hedefYuzdesi === null) return -1;
    return b.hedefYuzdesi - a.hedefYuzdesi;
  });
}

// ---------------------------------------------------------------------------
// Kart/çubuk görünümü (personel ekranındaki "Performans" tasarımı) için aynı
// sıra kuralının metin ve çubuk renkleri. Satır renkleriyle AYNI kural.
// ---------------------------------------------------------------------------

export type GostergeRengi = { text: string; bar: string };

const GOSTERGE_KOYU_YESIL: GostergeRengi = { text: "text-green-600", bar: "bg-green-600" };
const GOSTERGE_ACIK_YESIL: GostergeRengi = { text: "text-green-600", bar: "bg-lime-400" };
const GOSTERGE_GRI: GostergeRengi = { text: "text-slate-700", bar: "bg-slate-400" };
const GOSTERGE_TURUNCU: GostergeRengi = { text: "text-orange-500", bar: "bg-orange-500" };
const GOSTERGE_KIRMIZI: GostergeRengi = { text: "text-red-600", bar: "bg-red-500" };

// Personel: 1-3 yeşil, 4-6 gri, 7 turuncu, diğerleri ve sıralamaya girmeyenler kırmızı.
export function personelGostergeRengi(siralama: number | null): GostergeRengi {
  if (siralama === null || siralama < 1) return GOSTERGE_KIRMIZI;
  if (siralama <= 3) return GOSTERGE_KOYU_YESIL;
  if (siralama <= 6) return GOSTERGE_GRI;
  if (siralama === 7) return GOSTERGE_TURUNCU;
  return GOSTERGE_KIRMIZI;
}

// Mağaza: 1 koyu yeşil, 2 açık yeşil, 3 gri, 4 kırmızı.
export function magazaGostergeRengi(index: number, hedefVar: boolean): GostergeRengi {
  if (!hedefVar) return GOSTERGE_KIRMIZI;
  if (index === 0) return GOSTERGE_KOYU_YESIL;
  if (index === 1) return GOSTERGE_ACIK_YESIL;
  if (index === 2) return GOSTERGE_GRI;
  return GOSTERGE_KIRMIZI;
}
