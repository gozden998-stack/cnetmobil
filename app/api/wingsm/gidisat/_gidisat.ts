// app/api/wingsm/gidisat/_gidisat.ts
//
// CNETMOBIL - CMR "PERSONEL GİDİŞAT" (eski Sheets PersonelGidisat'ın yerine)
//
// 9 kategori; her kategorinin kuralı (ölçü + sınıf/ad/fiyat süzgeci), puanı, max
// puanı ve bareminin PANELDEN girilebildiği, kişi başı aylık hedeflerin panelden
// girildiği, gerçekleşenin WingSM satışlarından (CMR 4 depo, normal satış listesi)
// kendiliğinden çıkarıldığı yapı.
//
// Puan kuralı (Sheets'teki ile aynı): puan = min(maxPuan, puan x gerçekleşen / hedef);
// barem varsa ve hedef gerçekleşme yüzdesi baremin altındaysa puan 0.
//
// WingSM'e HİÇBİR veri yazılmaz (sadece satış listesi GET).
// Bu dosya "_" ile başladığı için Next.js tarafından route sayılmaz.

import type { Pool } from "pg";

import { getPool } from "../score-rules/_shared";
import { DegerPuanInputError, parseOptionalDayCount, toWingsmDate } from "../_deger-puan-compute";
import { wingsmDateToIso } from "../_deger-puan-history";
import { normalizeName } from "../_deger-puan-personnel";
import { fetchDepotSales } from "../vodafone/_vodafone";

export const CMR_DEPOTS: Array<{ depotCode: string; branchLabel: string }> = [
  { depotCode: "003", branchLabel: "CMR MERKEZ" },
  { depotCode: "009", branchLabel: "CMR CADDE" },
  { depotCode: "010", branchLabel: "CMR SARAY" },
  { depotCode: "011", branchLabel: "CMR KAPAKLI" },
];

export const CMR_BRANCH_LABELS = CMR_DEPOTS.map((depot) => depot.branchLabel);

// ======================================================
// TİPLER + VARSAYILAN YAPILANDIRMA
// ======================================================

export type Metric = "adet" | "karlilik" | "tutar" | "deger_puan";

export type CategoryRule = {
  siniflar: string[]; // sınıf kodu ya da adı (2el, 1el, 6, cik...) - boşsa sınıf süzgeci yok
  adBaslar: string[]; // ürün adı bunlardan biriyle BAŞLAMALI
  adIcerir: string[]; // ürün adında bunlardan biri GEÇMELİ
  adIcermez: string[]; // ürün adında bunlardan biri GEÇMEMELİ
  minFiyat: number | null; // birim satış fiyatı en az (TL)
};

export type Category = {
  key: string;
  ad: string;
  metric: Metric;
  puan: number;
  maxPuan: number;
  baremPct: number | null;
  aktif: boolean;
  rule: CategoryRule;
};

export type GidisatSettings = {
  iadeNet: boolean; // iade (negatif adet) satırları düşülsün mü
  tutarAlani: string; // boşsa otomatik bulunur
  fiyatAlani: string; // boşsa otomatik bulunur
};

export type GidisatConfig = { categories: Category[]; settings: GidisatSettings };

const emptyRule = (): CategoryRule => ({ siniflar: [], adBaslar: [], adIcerir: [], adIcermez: [], minFiyat: null });

export const DEFAULT_CONFIG: GidisatConfig = {
  settings: { iadeNet: true, tutarAlani: "", fiyatAlani: "" },
  categories: [
    {
      key: "cihaz_adet",
      ad: "Cihaz Adet (1.El & 2.El & 1.El Tablet)",
      metric: "adet",
      puan: 25,
      maxPuan: 30,
      baremPct: 70,
      aktif: true,
      rule: { ...emptyRule(), siniflar: ["2el", "1el", "1eltablet", "4el"] },
    },
    {
      key: "cihaz_kazanc",
      ad: "2. El Cihaz Kazanç",
      metric: "karlilik",
      puan: 25,
      maxPuan: 30,
      baremPct: 70,
      aktif: true,
      rule: { ...emptyRule(), siniflar: ["2el"] },
    },
    {
      key: "cam",
      ad: "Özel Kesim Cam 400 TL+ Adet",
      metric: "adet",
      puan: 5,
      maxPuan: 5,
      baremPct: null,
      aktif: true,
      rule: { ...emptyRule(), siniflar: ["6"], adIcerir: ["NCAM"], minFiyat: 400 },
    },
    {
      key: "saat_tablet",
      ad: "2. El Saat Tablet",
      metric: "adet",
      puan: 2,
      maxPuan: 2,
      baremPct: null,
      aktif: true,
      rule: { ...emptyRule(), siniflar: ["8el"], adBaslar: ["2.EL"] },
    },
    {
      key: "samsung",
      ad: "Samsung Premium",
      metric: "adet",
      puan: 15,
      maxPuan: 15,
      baremPct: null,
      aktif: true,
      // KURAL KULLANICIYLA NETLEŞECEK: premium model listesi ya da en düşük fiyat eklenecek.
      rule: { ...emptyRule(), siniflar: ["1el", "2el"], adIcerir: ["SAMSUNG"] },
    },
    {
      key: "zebleze",
      ad: "Zebleze & Sword & Stobom",
      metric: "adet",
      puan: 5,
      maxPuan: 5,
      baremPct: null,
      aktif: true,
      rule: { ...emptyRule(), siniflar: ["6", "6el"], adIcerir: ["ZEBLEZE", "SWORD", "STOBOM"] },
    },
    {
      key: "aksesuar_ciro",
      ad: "Serili + YNA Aksesuar Ciro",
      metric: "tutar",
      puan: 5,
      maxPuan: 5,
      baremPct: 70,
      aktif: true,
      rule: { ...emptyRule(), siniflar: ["6", "6el"] },
    },
    {
      key: "deger_puan",
      ad: "Değer Puan",
      metric: "deger_puan",
      puan: 8,
      maxPuan: 8,
      baremPct: null,
      aktif: true,
      rule: emptyRule(),
    },
    {
      key: "teknik_servis",
      ad: "Teknik Servis Kazanç",
      metric: "karlilik",
      puan: 10,
      maxPuan: 10,
      baremPct: 70,
      aktif: true,
      rule: { ...emptyRule(), siniflar: ["cik"] },
    },
  ],
};

// ======================================================
// TABLOLAR
// ======================================================

let tablesReady = false;

export async function ensureGidisatTables(pool: Pool) {
  if (tablesReady) return;

  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.gidisat_config (
      id INTEGER PRIMARY KEY,
      payload JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.gidisat_targets (
      id SERIAL PRIMARY KEY,
      period TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      branch_label TEXT NOT NULL,
      person_name TEXT NOT NULL,
      targets JSONB NOT NULL DEFAULT '{}'::jsonb
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.gidisat_history (
      id SERIAL PRIMARY KEY,
      period TEXT NOT NULL,
      range_end DATE,
      tarih TEXT NOT NULL,
      tarih2 TEXT NOT NULL,
      payload JSONB NOT NULL,
      computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT gidisat_history_range_unique UNIQUE (tarih, tarih2)
    )
  `);

  tablesReady = true;
}

// ======================================================
// YAPILANDIRMA DOĞRULAMA
// ======================================================

function cleanList(value: unknown, max = 30): string[] {
  const list = Array.isArray(value) ? value : typeof value === "string" ? value.split(/[,;\n]/) : [];

  return list
    .map((item) => String(item ?? "").trim())
    .filter(Boolean)
    .slice(0, max);
}

function cleanNumber(value: unknown, fallback: number, min = 0, max = 1_000_000): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= min && n <= max ? n : fallback;
}

export function sanitizeConfig(input: unknown): GidisatConfig {
  const data = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const settingsIn = (data.settings && typeof data.settings === "object" ? data.settings : {}) as Record<string, unknown>;
  const incoming = Array.isArray(data.categories) ? (data.categories as Array<Record<string, unknown>>) : [];

  // Kategori ANAHTARLARI sabittir (hedefler bu anahtarlarla tutulur); adlar/kurallar/puanlar düzenlenir.
  const categories: Category[] = DEFAULT_CONFIG.categories.map((def) => {
    const item = incoming.find((entry) => entry?.key === def.key);

    if (!item) return def;

    const ruleIn = (item.rule && typeof item.rule === "object" ? item.rule : {}) as Record<string, unknown>;
    const metric = ["adet", "karlilik", "tutar", "deger_puan"].includes(String(item.metric))
      ? (String(item.metric) as Metric)
      : def.metric;
    const baremRaw = item.baremPct;
    const baremNumber = Number(baremRaw);

    return {
      key: def.key,
      ad: String(item.ad ?? def.ad).trim().slice(0, 80) || def.ad,
      metric,
      puan: cleanNumber(item.puan, def.puan, 0, 1000),
      maxPuan: cleanNumber(item.maxPuan, def.maxPuan, 0, 1000),
      baremPct:
        baremRaw === null || baremRaw === undefined || String(baremRaw).trim() === ""
          ? null
          : Number.isFinite(baremNumber) && baremNumber >= 0 && baremNumber <= 1000
            ? baremNumber
            : def.baremPct,
      aktif: item.aktif === undefined ? true : Boolean(item.aktif),
      rule: {
        siniflar: cleanList(ruleIn.siniflar),
        adBaslar: cleanList(ruleIn.adBaslar),
        adIcerir: cleanList(ruleIn.adIcerir),
        adIcermez: cleanList(ruleIn.adIcermez),
        minFiyat:
          ruleIn.minFiyat === null || ruleIn.minFiyat === undefined || String(ruleIn.minFiyat).trim() === ""
            ? null
            : cleanNumber(ruleIn.minFiyat, 0, 0, 10_000_000),
      },
    };
  });

  return {
    categories,
    settings: {
      iadeNet: settingsIn.iadeNet === undefined ? true : Boolean(settingsIn.iadeNet),
      tutarAlani: String(settingsIn.tutarAlani ?? "").trim().slice(0, 40),
      fiyatAlani: String(settingsIn.fiyatAlani ?? "").trim().slice(0, 40),
    },
  };
}

export async function loadConfig(pool: Pool): Promise<GidisatConfig> {
  await ensureGidisatTables(pool);

  const result = await pool.query(`SELECT payload FROM public.gidisat_config WHERE id = 1`);
  const payload = result.rows[0]?.payload;

  if (!payload) return DEFAULT_CONFIG;

  return sanitizeConfig(typeof payload === "string" ? JSON.parse(payload) : payload);
}

export async function saveConfig(pool: Pool, config: GidisatConfig) {
  await ensureGidisatTables(pool);

  await pool.query(
    `INSERT INTO public.gidisat_config (id, payload, updated_at) VALUES (1, $1, now())
     ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = now()`,
    [JSON.stringify(config)]
  );
}

// ======================================================
// HEDEFLER
// ======================================================

export type PersonTarget = {
  branchLabel: string;
  saticiAdi: string;
  hedefler: Record<string, number>;
};

export async function loadTargets(pool: Pool, period: string): Promise<PersonTarget[]> {
  await ensureGidisatTables(pool);

  const result = await pool.query(
    `SELECT branch_label, person_name, targets FROM public.gidisat_targets WHERE period = $1 ORDER BY sort_order ASC, id ASC`,
    [period]
  );

  return result.rows.map((row) => {
    const raw = typeof row.targets === "string" ? JSON.parse(row.targets) : row.targets;
    const hedefler: Record<string, number> = {};

    for (const [key, value] of Object.entries((raw ?? {}) as Record<string, unknown>)) {
      const n = Number(value);
      if (Number.isFinite(n)) hedefler[key] = n;
    }

    return { branchLabel: String(row.branch_label), saticiAdi: String(row.person_name), hedefler };
  });
}

// ======================================================
// SATIR YARDIMCILARI
// ======================================================

// "2.EL" / "2 el" / "2EL" -> "2el"; "0006" -> "6"; Türkçe karakterler sadeleşir.
export function fold(value: unknown): string {
  return String(value ?? "")
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g")
    .replace(/[^a-z0-9]/g, "")
    .replace(/^0+(?=\d)/, "");
}

function tokens(name: string): string[] {
  return String(name ?? "")
    .split(/[^A-Za-z0-9ÇĞİÖŞÜçğıöşü]+/)
    .map(fold)
    .filter(Boolean);
}

// Boşluksuz terim: ürün adındaki bir KELİMENİN başında olmalı ("NCAM" -> "NCAM ULT", "SUNCAM" değil).
// Boşluklu terim ("GALAXY S24"): adın içinde geçmesi yeter.
function termMatches(nameFolded: string, nameTokens: string[], term: string): boolean {
  const folded = fold(term);
  if (!folded) return false;

  if (/\s/.test(term.trim())) return nameFolded.includes(folded);

  return nameTokens.some((token) => token.startsWith(folded));
}

const QTY_CANDIDATES = ["MalMiktarI", "Miktar", "MalMiktar", "MiktarI", "Adet", "AdetI"];
const AMOUNT_CANDIDATES = ["TutarI", "Tutar", "SatisTutarI", "NetTutarI", "ToplamTutarI", "MalTutarI", "GenelTutarI"];
const PRICE_CANDIDATES = ["BrmFiyatI", "SatisFiyatI", "BirimFiyatI", "FiyatI", "Fiyat", "MalFiyatI"];

function detectField(rows: Array<Record<string, unknown>>, candidates: string[], override: string): string | null {
  const list = override ? [override, ...candidates] : candidates;

  for (const name of list) {
    if (rows.some((row) => row[name] !== undefined && row[name] !== null && String(row[name]).trim() !== "" && Number.isFinite(Number(row[name])))) {
      return name;
    }
  }

  return null;
}

function numberOf(row: Record<string, unknown>, field: string | null): number | null {
  if (!field) return null;
  const n = Number(row[field]);
  return Number.isFinite(n) ? n : null;
}

function rowMatches(
  row: Record<string, unknown>,
  rule: CategoryRule,
  fields: { qty: string | null; amount: string | null; price: string | null }
): boolean {
  if (rule.siniflar.length > 0) {
    const classKeys = [fold(row.MalSinif), fold(row.MalSinifAdI)].filter(Boolean);
    const wanted = rule.siniflar.map(fold);

    if (!classKeys.some((key) => wanted.includes(key))) return false;
  }

  const name = String(row.MalAd ?? "");
  const nameFolded = fold(name);
  const nameTokens = tokens(name);

  if (rule.adBaslar.length > 0 && !rule.adBaslar.some((term) => nameFolded.startsWith(fold(term)))) return false;
  if (rule.adIcerir.length > 0 && !rule.adIcerir.some((term) => termMatches(nameFolded, nameTokens, term))) return false;
  if (rule.adIcermez.length > 0 && rule.adIcermez.some((term) => termMatches(nameFolded, nameTokens, term))) return false;

  if (rule.minFiyat !== null) {
    const qty = Math.abs(numberOf(row, fields.qty) ?? 1) || 1;
    const unit = numberOf(row, fields.price) ?? (numberOf(row, fields.amount) !== null ? Math.abs(numberOf(row, fields.amount) as number) / qty : null);

    if (unit === null || unit < rule.minFiyat) return false;
  }

  return true;
}

// ======================================================
// PUAN HESABI
// ======================================================

export function scoreCategory(
  category: Pick<Category, "puan" | "maxPuan" | "baremPct">,
  gerceklesen: number,
  hedef: number | null
): { oran: number | null; puan: number } {
  if (hedef === null || !Number.isFinite(hedef) || hedef <= 0) return { oran: null, puan: 0 };

  const value = Math.max(0, gerceklesen);
  const oran = (value / hedef) * 100;

  if (category.baremPct !== null && oran < category.baremPct) return { oran, puan: 0 };

  return { oran, puan: Math.round(Math.min(category.maxPuan, (category.puan * oran) / 100) * 100) / 100 };
}

// ======================================================
// RAPOR
// ======================================================

export type CategoryResult = {
  gerceklesen: number;
  hedef: number | null;
  oran: number | null;
  puan: number;
  tahminGerceklesen: number;
  tahminOran: number | null;
  tahminPuan: number;
  riskli: boolean; // barem var ve şu anki oran baremin altında
};

export type PersonResult = {
  saticiAdi: string;
  branchLabel: string;
  kategoriler: Record<string, CategoryResult>;
  toplamPuan: number;
  tahminiToplamPuan: number;
};

export type GidisatReport = {
  success: true;
  period: string;
  range: { tarih: string; tarih2: string };
  gunBilgisi: { gecenGun: number; ayToplamGun: number; kalanGun: number };
  kategoriler: Category[];
  kisiler: PersonResult[];
  hedefsizSaticilar: Array<{ saticiAdi: string; branchLabel: string; gerceklesen: Record<string, number> }>;
  alanlar: { adet: string | null; tutar: string | null; fiyat: string | null };
  degerPuanKaynak: { tarih: string; tarih2: string } | null;
  satirSayisi: number;
  uyarilar: string[];
  computedAt?: string;
};

function parseDate(value: string) {
  const [day, month, year] = value.split("/").map(Number);
  return { day, month, year };
}

function personKey(name: string): string {
  return normalizeName(name);
}

const MAX_RANGE_DAYS = 62;

export async function computeAndSaveGidisat(input: {
  bastar: unknown;
  bittar: unknown;
  gecenGun?: unknown;
  ayToplamGun?: unknown;
}): Promise<GidisatReport> {
  const tarih = toWingsmDate(input.bastar);
  const tarih2 = toWingsmDate(input.bittar);

  const manualElapsed = parseOptionalDayCount(input.gecenGun);
  const manualMonthDays = parseOptionalDayCount(input.ayToplamGun);

  if (manualElapsed === "invalid" || manualMonthDays === "invalid") {
    throw new DegerPuanInputError("Gün ayarı 1 ile 31 arasında bir tam sayı olmalıdır.");
  }

  const start = parseDate(tarih);
  const end = parseDate(tarih2);
  const spanDays = (Date.UTC(end.year, end.month - 1, end.day) - Date.UTC(start.year, start.month - 1, start.day)) / 86_400_000 + 1;

  if (!Number.isFinite(spanDays) || spanDays < 1) {
    throw new DegerPuanInputError("Bitiş tarihi başlangıçtan önce olamaz.");
  }

  if (spanDays > MAX_RANGE_DAYS) {
    throw new DegerPuanInputError(`Tarih aralığı en fazla ${MAX_RANGE_DAYS} gün olabilir.`);
  }

  const pool = getPool();
  const config = await loadConfig(pool);

  const period = `${start.year}-${String(start.month).padStart(2, "0")}`;
  const autoDaysInMonth = new Date(end.year, end.month, 0).getDate();
  const startDayForElapsed = end.month === start.month && end.year === start.year ? start.day : 1;
  const autoDaysElapsed = Math.max(1, end.day - startDayForElapsed + 1);
  const daysInMonth = manualMonthDays !== null ? manualMonthDays : autoDaysInMonth;
  const daysElapsed = manualElapsed !== null ? manualElapsed : autoDaysElapsed;

  if (daysElapsed > daysInMonth) {
    throw new DegerPuanInputError("Geçen gün, ayın toplam gün sayısından büyük olamaz.");
  }

  const projectionFactor = daysInMonth / daysElapsed;

  // ---- WingSM: CMR 4 depo paralel (normal satış listesi) ----
  const perDepot = await Promise.all(
    CMR_DEPOTS.map(async ({ depotCode, branchLabel }) => {
      try {
        const { rows } = await fetchDepotSales(depotCode, tarih, tarih2, "liste");
        return { depotCode, branchLabel, rows };
      } catch (error) {
        throw new Error(
          `${branchLabel} (${depotCode}) satışları alınamadı: ${error instanceof Error ? error.message : "bilinmeyen hata"}`
        );
      }
    })
  );

  const allRows = perDepot.flatMap((depot) => depot.rows.map((row) => ({ row, branchLabel: depot.branchLabel })));
  const plainRows = allRows.map((item) => item.row);

  const fields = {
    qty: detectField(plainRows, QTY_CANDIDATES, ""),
    amount: detectField(plainRows, AMOUNT_CANDIDATES, config.settings.tutarAlani),
    price: detectField(plainRows, PRICE_CANDIDATES, config.settings.fiyatAlani),
  };

  const uyarilar: string[] = [];
  const activeCategories = config.categories.filter((category) => category.aktif);

  if (!fields.qty) uyarilar.push("Adet alanı bulunamadı: her satır 1 adet sayıldı.");
  if (activeCategories.some((c) => c.metric === "tutar") && !fields.amount) {
    uyarilar.push("Tutar alanı bulunamadı: Ciro kategorisi 0 çıkar. Kategoriler > Gelişmiş'ten tutar alanının adını yazın (Satış Verisi > Gelen alanlar'dan bakın).");
  }
  if (activeCategories.some((c) => c.rule.minFiyat !== null) && !fields.price && !fields.amount) {
    uyarilar.push("Fiyat/tutar alanı bulunamadı: en düşük fiyat şartı olan kategori 0 çıkar.");
  }

  // ---- satırları kategorilere dağıt ----
  type Agg = { saticiAdi: string; perCategory: Record<string, number>; branchScore: Map<string, number> };
  const people = new Map<string, Agg>();

  for (const { row, branchLabel } of allRows) {
    const seller = String(row.SaticiAdI ?? "").trim();
    if (!seller) continue;

    const qtyValue = numberOf(row, fields.qty) ?? 1;

    // İade (negatif adet): "iadeNet" kapalıysa sayılmaz, açıksa düşülür.
    if (qtyValue < 0 && !config.settings.iadeNet) continue;

    const key = personKey(seller);
    const agg = people.get(key) ?? { saticiAdi: seller, perCategory: {}, branchScore: new Map<string, number>() };

    for (const category of activeCategories) {
      if (category.metric === "deger_puan") continue;
      if (!rowMatches(row, category.rule, fields)) continue;

      let value = 0;

      if (category.metric === "adet") value = qtyValue;
      else if (category.metric === "karlilik") value = numberOf(row, "KarlilikI") ?? 0;
      else if (category.metric === "tutar") {
        const amount = numberOf(row, fields.amount);
        value = amount === null ? 0 : qtyValue < 0 ? -Math.abs(amount) : amount;
      }

      agg.perCategory[category.key] = (agg.perCategory[category.key] ?? 0) + value;
      agg.branchScore.set(branchLabel, (agg.branchScore.get(branchLabel) ?? 0) + 1);
    }

    people.set(key, agg);
  }

  // ---- Değer Puan: mevcut CMR Değer Puan raporundan (kişi bazında çarpanlı puan) ----
  const degerPuanByPerson = new Map<string, number>();
  let degerPuanKaynak: { tarih: string; tarih2: string } | null = null;

  if (activeCategories.some((category) => category.metric === "deger_puan")) {
    try {
      const result = await pool.query(
        `SELECT payload, tarih, tarih2 FROM public.wingsm_deger_puan_history WHERE period = $1
         ORDER BY range_end DESC NULLS LAST, computed_at DESC LIMIT 1`,
        [period]
      );

      const row = result.rows[0];

      if (row) {
        const payload = typeof row.payload === "string" ? JSON.parse(row.payload) : row.payload;

        for (const person of (payload?.personnel ?? []) as Array<{ saticiAdi?: string; carpanliPuan?: number }>) {
          degerPuanByPerson.set(personKey(String(person.saticiAdi ?? "")), Number(person.carpanliPuan) || 0);
        }

        degerPuanKaynak = { tarih: String(row.tarih), tarih2: String(row.tarih2) };

        if (degerPuanKaynak.tarih2 !== tarih2) {
          uyarilar.push(
            `Değer Puan, ${degerPuanKaynak.tarih} - ${degerPuanKaynak.tarih2} aralıklı kayıtlı rapordan alındı (bu rapor ${tarih} - ${tarih2}).`
          );
        }
      } else {
        uyarilar.push("Bu dönem için Değer Puan raporu bulunamadı: Değer Puan kategorisi 0 çıktı.");
      }
    } catch {
      uyarilar.push("Değer Puan raporları okunamadı: Değer Puan kategorisi 0 çıktı.");
    }
  }

  // ---- hedeflerle birleştir ----
  const targets = await loadTargets(pool, period);

  if (targets.length === 0) {
    uyarilar.push(`${period} için hedef girilmemiş: hedefler girilene kadar puanlar 0 çıkar.`);
  }

  const kisiler: PersonResult[] = targets.map((target) => {
    const key = personKey(target.saticiAdi);
    const agg = people.get(key);
    const kategoriler: Record<string, CategoryResult> = {};
    let toplamPuan = 0;
    let tahminiToplamPuan = 0;

    for (const category of activeCategories) {
      const gerceklesen =
        category.metric === "deger_puan" ? degerPuanByPerson.get(key) ?? 0 : agg?.perCategory[category.key] ?? 0;
      const hedefRaw = target.hedefler[category.key];
      const hedef = hedefRaw !== undefined && hedefRaw > 0 ? hedefRaw : null;
      const current = scoreCategory(category, gerceklesen, hedef);
      const tahminGerceklesen = gerceklesen * projectionFactor;
      const projected = scoreCategory(category, tahminGerceklesen, hedef);

      kategoriler[category.key] = {
        gerceklesen,
        hedef,
        oran: current.oran,
        puan: current.puan,
        tahminGerceklesen,
        tahminOran: projected.oran,
        tahminPuan: projected.puan,
        riskli: category.baremPct !== null && hedef !== null && current.oran !== null && current.oran < category.baremPct,
      };

      toplamPuan += current.puan;
      tahminiToplamPuan += projected.puan;
    }

    return {
      saticiAdi: target.saticiAdi,
      branchLabel: target.branchLabel,
      kategoriler,
      toplamPuan: Math.round(toplamPuan * 100) / 100,
      tahminiToplamPuan: Math.round(tahminiToplamPuan * 100) / 100,
    };
  });

  const targetKeys = new Set(targets.map((target) => personKey(target.saticiAdi)));

  const hedefsizSaticilar = Array.from(people.entries())
    .filter(([key]) => !targetKeys.has(key))
    .map(([, agg]) => {
      let bestBranch = "";
      let best = -1;

      for (const [branch, score] of agg.branchScore) {
        if (score > best) {
          best = score;
          bestBranch = branch;
        }
      }

      return { saticiAdi: agg.saticiAdi, branchLabel: bestBranch, gerceklesen: agg.perCategory };
    })
    .filter((item) => Object.values(item.gerceklesen).some((value) => value !== 0))
    .sort((a, b) => a.saticiAdi.localeCompare(b.saticiAdi, "tr"));

  const report: GidisatReport = {
    success: true,
    period,
    range: { tarih, tarih2 },
    gunBilgisi: { gecenGun: daysElapsed, ayToplamGun: daysInMonth, kalanGun: Math.max(0, daysInMonth - daysElapsed) },
    kategoriler: activeCategories,
    kisiler,
    hedefsizSaticilar,
    alanlar: { adet: fields.qty, tutar: fields.amount, fiyat: fields.price },
    degerPuanKaynak,
    satirSayisi: allRows.length,
    uyarilar,
  };

  await pool.query(
    `INSERT INTO public.gidisat_history (period, range_end, tarih, tarih2, payload, computed_at)
     VALUES ($1, $2, $3, $4, $5, now())
     ON CONFLICT (tarih, tarih2) DO UPDATE SET payload = EXCLUDED.payload, period = EXCLUDED.period, computed_at = now()`,
    [period, wingsmDateToIso(tarih2), tarih, tarih2, JSON.stringify(report)]
  );

  return { ...report, computedAt: new Date().toISOString() };
}
