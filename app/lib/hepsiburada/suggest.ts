// app/lib/hepsiburada/suggest.ts
//
// CNETMOBIL - Hepsiburada ürün adından WingSM ürünü ÖNERİSİ
//
// Hepsiburada ürün adı (panelden alınan "Ürün Bilgisi" dışa aktarımı) ile WingSM ürün adı karşılaştırılır:
//   - Ad büyük harfe çevrilir, Türkçe karakterler sadeleştirilir, harf-rakam birleşimleri ayrılır (A27 -> A 27, 128GB -> 128 GB).
//   - "GB, RAM, GARANTILI, TURKIYE" gibi gürültü sözcükleri atılır; renkler tek dile çevrilir (BLUE=MAVI).
//   - SAYILAR (model, hafıza, ekran boyutu) iki tarafta BİREBİR aynı olmalı: 128 GB ile 256 GB asla eşleşmez.
//   - Kalan sözcüklerde Dice benzerliği hesaplanır; en iyi aday ikinciden belirgin biçimde iyiyse önerilir.
// Öneri yalnızca ÖNERİDİR: onaylanınca eşleşme tablosuna yazılır, kendiliğinden yazılmaz.

import type { Pool } from "pg";

export type WingCandidate = { mal_kod: string; mal_ad: string; sinif: string; adet: number };
export type Suggestion = { malKod: string; malAd: string; sinif: string; adet: number; score: number };

const STOP = new Set(["GB", "RAM", "GARANTILI", "GARANTISI", "TURKIYE", "UYUMLU", "VE", "ILE", "TELEFON", "CEP", "AKILLI"]);

const COLORS: Record<string, string> = {
  BLUE: "MAVI", BLACK: "SIYAH", WHITE: "BEYAZ", GRAY: "GRI", GREY: "GRI", SILVER: "GUMUS", GOLD: "ALTIN",
  PINK: "PEMBE", RED: "KIRMIZI", GREEN: "YESIL", PURPLE: "MOR", ORANGE: "TURUNCU", YELLOW: "SARI", BROWN: "KAHVERENGI",
  LACIVERT: "LACIVERT", NAVY: "LACIVERT", CREAM: "KREM", TITANYUM: "TITANYUM", TITANIUM: "TITANYUM", GRAFIT: "GRAFIT", GRAPHITE: "GRAFIT",
};

const fold = (value: string) =>
  value
    .toLocaleUpperCase("tr-TR")
    .replace(/İ/g, "I")
    .replace(/Ş/g, "S")
    .replace(/Ğ/g, "G")
    .replace(/Ü/g, "U")
    .replace(/Ö/g, "O")
    .replace(/Ç/g, "C");

const COLOR_VALUES = new Set(Object.values(COLORS));

// Ad içindeki renk sözcükleri (iki taraf aynı renkte olmalı: SIYAH ile MAVI asla eşleşmez).
const colorsOf = (words: Set<string>) => new Set(Array.from(words).filter((word) => COLOR_VALUES.has(word)));

export function tokens(name: string): { words: Set<string>; numbers: Set<string> } {
  const spaced = fold(String(name ?? ""))
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/(\d)([A-Z])/g, "$1 $2")
    .replace(/([A-Z])(\d)/g, "$1 $2");
  const words = new Set<string>();
  const numbers = new Set<string>();

  for (const raw of spaced.split(" ")) {
    if (!raw || STOP.has(raw)) continue;

    const word = COLORS[raw] ?? raw;

    if (/^\d+$/.test(word)) numbers.add(word);
    else words.add(word);
  }

  return { words, numbers };
}

const sameSet = (a: Set<string>, b: Set<string>) => a.size === b.size && Array.from(a).every((item) => b.has(item));

function dice(a: Set<string>, b: Set<string>) {
  if (a.size === 0 || b.size === 0) return 0;

  let common = 0;

  for (const item of a) if (b.has(item)) common += 1;

  return (2 * common) / (a.size + b.size);
}

export async function loadWingCandidates(pool: Pool): Promise<WingCandidate[]> {
  const result = await pool.query(`SELECT mal_kod, max(mal_ad) AS mal_ad, max(sinif) AS sinif, sum(miktar)::int AS adet FROM public.sifir_stock GROUP BY mal_kod`);

  return result.rows as WingCandidate[];
}

export type CandidateIndex = Array<{ cand: WingCandidate; words: Set<string>; numbers: Set<string>; colors: Set<string> }>;

export const indexCandidates = (candidates: WingCandidate[]): CandidateIndex =>
  candidates.map((cand) => {
    const t = tokens(cand.mal_ad);

    return { cand, ...t, colors: colorsOf(t.words) };
  });

export function suggestFor(hbName: string, index: CandidateIndex): Suggestion | null {
  const target = tokens(hbName);

  if (target.words.size === 0) return null;

  const targetColors = colorsOf(target.words);

  const scored: Array<{ cand: WingCandidate; score: number }> = [];

  for (const item of index) {
    // Sayılar (model/hafıza/boyut) birebir aynı olmalı.
    if (!sameSet(item.numbers, target.numbers)) continue;
    // WingSM'deki renk Hepsiburada adında geçmeli (Hepsiburada adında "Siyah, Titanyum Kasa" gibi fazladan renk sözcüğü olabilir);
    // WingSM adında renk yoksa Hepsiburada adında da renk olmamalı.
    if (item.colors.size === 0 ? targetColors.size > 0 : !Array.from(item.colors).every((color) => targetColors.has(color))) continue;

    const score = dice(target.words, item.words);

    if (score >= 0.6) scored.push({ cand: item.cand, score });
  }

  if (scored.length === 0) return null;

  scored.sort((a, b) => b.score - a.score);

  const [best, second] = scored;

  // İkinci aday neredeyse aynı skordaysa (farklı ürün) belirsizdir: öneri yok.
  if (second && second.cand.mal_kod !== best.cand.mal_kod && best.score - second.score < 0.05) return null;

  return { malKod: best.cand.mal_kod, malAd: best.cand.mal_ad, sinif: best.cand.sinif, adet: best.cand.adet, score: Math.round(best.score * 100) / 100 };
}
