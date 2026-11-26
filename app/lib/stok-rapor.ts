// app/lib/stok-rapor.ts
//
// CNETMOBIL - Komple stok raporu (SALT OKUNUR): grade dağılımı x yenileme uygunluğu (BTK) x online kanal durumu
//
// Stok = panelde AVAILABLE + WingSM'de IN_STOCK + 15 haneli IMEI (Stok BTK Kontrol ekranıyla aynı).
// Hiçbir yere yazılmaz, Garantili'ye / pazaryerlerine istek atılmaz (BTK sonucu DB'deki son sorgudan, kanal durumu DB'den okunur).

import type { Pool } from "pg";

import { getChannelStatusForImeis, type ImeiKanallari, type KanalKodu } from "./online/channel-status";
import { ensureBtkTable } from "./garantili/btk";

export const GRADE_SIRASI = ["MÜKEMMEL", "ÇOK İYİ", "İYİ", "OUTLET"] as const;
export const KANALLAR: KanalKodu[] = ["N11", "IDEFIX", "IKAS", "GARANTILI"];

export type BtkGrup = "UYGUN" | "UYGUN_DEGIL" | "SORGULANMAMIS";

export type RaporSatir = {
  grade: string;
  depo: string;
  btk: BtkGrup;
  // En az bir kanalda ACIK (satışta)
  onlineAcik: boolean;
  // Açık değil ama en az bir kanalda BEKLIYOR (açılıyor)
  onlineBekliyor: boolean;
  kanal: Record<KanalKodu, boolean>;
};

export type GradeOzet = {
  grade: string;
  toplam: number;
  btk: Record<BtkGrup, number>;
  onlineAcik: number;
  onlineBekliyor: number;
  onlineKapali: number;
  // Yenilemeye uygun ama hiçbir kanalda açık değil (fırsat)
  uygunAmaKapali: number;
  kanal: Record<KanalKodu, number>;
};

export type DepoOzet = { depo: string; toplam: number; uygun: number; uygunDegil: number; sorgulanmamis: number; onlineAcik: number; gradeler: Record<string, number> };

export type StokRapor = {
  toplam: number;
  btk: Record<BtkGrup, number>;
  onlineAcik: number;
  onlineBekliyor: number;
  onlineKapali: number;
  uygunAmaKapali: number;
  kanal: Record<KanalKodu, number>;
  gradeler: GradeOzet[];
  depolar: DepoOzet[];
  olusturuldu: string;
};

// "Mükemmel", "MUKEMMEL", " çok iyi " -> MÜKEMMEL / ÇOK İYİ ; bilinmeyen -> DİĞER, boş -> GRADESİZ
export function normalizeGrade(value: unknown): string {
  const text = String(value ?? "").trim().toLocaleUpperCase("tr-TR").replace(/\s+/g, " ");

  if (!text) return "GRADESİZ";

  const ascii = text.replace(/İ/g, "I").replace(/Ü/g, "U").replace(/Ç/g, "C").replace(/Ö/g, "O").replace(/Ş/g, "S").replace(/Ğ/g, "G");

  if (ascii === "MUKEMMEL") return "MÜKEMMEL";
  if (ascii === "COK IYI") return "ÇOK İYİ";
  if (ascii === "IYI") return "İYİ";
  if (ascii === "OUTLET") return "OUTLET";

  return "DİĞER";
}

const emptyBtk = (): Record<BtkGrup, number> => ({ UYGUN: 0, UYGUN_DEGIL: 0, SORGULANMAMIS: 0 });
const emptyKanal = (): Record<KanalKodu, number> => ({ N11: 0, IDEFIX: 0, IKAS: 0, GARANTILI: 0 });

// Saf hesap (test edilebilsin diye DB'den ayrı)
export function buildRapor(rows: RaporSatir[], olusturuldu = new Date().toISOString()): StokRapor {
  const gradeMap = new Map<string, GradeOzet>();
  const depoMap = new Map<string, DepoOzet>();

  const total: StokRapor = {
    toplam: rows.length,
    btk: emptyBtk(),
    onlineAcik: 0,
    onlineBekliyor: 0,
    onlineKapali: 0,
    uygunAmaKapali: 0,
    kanal: emptyKanal(),
    gradeler: [],
    depolar: [],
    olusturuldu,
  };

  for (const row of rows) {
    let g = gradeMap.get(row.grade);

    if (!g) {
      g = { grade: row.grade, toplam: 0, btk: emptyBtk(), onlineAcik: 0, onlineBekliyor: 0, onlineKapali: 0, uygunAmaKapali: 0, kanal: emptyKanal() };
      gradeMap.set(row.grade, g);
    }

    let d = depoMap.get(row.depo);

    if (!d) {
      d = { depo: row.depo, toplam: 0, uygun: 0, uygunDegil: 0, sorgulanmamis: 0, onlineAcik: 0, gradeler: {} };
      depoMap.set(row.depo, d);
    }

    const kapali = !row.onlineAcik && !row.onlineBekliyor;
    const uygunAmaKapali = row.btk === "UYGUN" && !row.onlineAcik;

    g.toplam += 1;
    g.btk[row.btk] += 1;
    total.btk[row.btk] += 1;

    if (row.onlineAcik) {
      g.onlineAcik += 1;
      total.onlineAcik += 1;
      d.onlineAcik += 1;
    } else if (row.onlineBekliyor) {
      g.onlineBekliyor += 1;
      total.onlineBekliyor += 1;
    } else if (kapali) {
      g.onlineKapali += 1;
      total.onlineKapali += 1;
    }

    if (uygunAmaKapali) {
      g.uygunAmaKapali += 1;
      total.uygunAmaKapali += 1;
    }

    for (const kod of KANALLAR) {
      if (row.kanal[kod]) {
        g.kanal[kod] += 1;
        total.kanal[kod] += 1;
      }
    }

    d.toplam += 1;
    d.gradeler[row.grade] = (d.gradeler[row.grade] ?? 0) + 1;
    if (row.btk === "UYGUN") d.uygun += 1;
    else if (row.btk === "UYGUN_DEGIL") d.uygunDegil += 1;
    else d.sorgulanmamis += 1;
  }

  const gradeRank = (grade: string) => {
    const index = (GRADE_SIRASI as readonly string[]).indexOf(grade);

    return index === -1 ? 50 : index;
  };

  total.gradeler = Array.from(gradeMap.values()).sort((a, b) => gradeRank(a.grade) - gradeRank(b.grade) || a.grade.localeCompare(b.grade, "tr"));
  total.depolar = Array.from(depoMap.values()).sort((a, b) => b.toplam - a.toplam || a.depo.localeCompare(b.depo, "tr"));

  return total;
}

const CHUNK = 2500;

export async function getStokRapor(pool: Pool): Promise<StokRapor> {
  await ensureBtkTable(pool);

  const stock = await pool.query(
    `SELECT d.imei, d.grade, COALESCE(NULLIF(d.current_branch_code, ''), 'BİLİNMİYOR') AS depo, c.durum
     FROM public.stock_devices d
     LEFT JOIN public.garantili_btk_check c ON c.imei = d.imei
     WHERE d.status = 'AVAILABLE' AND d.wing_status = 'IN_STOCK' AND d.imei ~ '^[0-9]{15}$'
     LIMIT 30000`
  );

  const imeis: string[] = stock.rows.map((row: any) => String(row.imei));
  const kanallar: Record<string, ImeiKanallari> = {};

  for (let i = 0; i < imeis.length; i += CHUNK) {
    Object.assign(kanallar, await getChannelStatusForImeis(pool, imeis.slice(i, i + CHUNK)));
  }

  const rows: RaporSatir[] = stock.rows.map((row: any) => {
    const imei = String(row.imei);
    const status = kanallar[imei];
    const durumlar = KANALLAR.map((kod) => status?.[kod]?.durum ?? "YOK");

    return {
      grade: normalizeGrade(row.grade),
      depo: String(row.depo),
      btk: row.durum === "UYGUN" ? "UYGUN" : row.durum === "UYGUN_DEGIL" ? "UYGUN_DEGIL" : "SORGULANMAMIS",
      onlineAcik: durumlar.includes("ACIK"),
      onlineBekliyor: !durumlar.includes("ACIK") && durumlar.includes("BEKLIYOR"),
      kanal: {
        N11: durumlar[0] === "ACIK",
        IDEFIX: durumlar[1] === "ACIK",
        IKAS: durumlar[2] === "ACIK",
        GARANTILI: durumlar[3] === "ACIK",
      },
    };
  });

  return buildRapor(rows);
}
