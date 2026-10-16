// app/api/wingsm/vodafone/_vodafone.ts
//
// CNETMOBIL - WingSM "Değer Puan" - VODAFONE KANALI
//
// CMR Değer Puan'ın (../_deger-puan-compute.ts) kardeşi; CMR koduna DOKUNMAZ,
// kendi tabloları vardır (vdf_deger_puan_*). Farkları:
//   - Mağazalar: 002 MEYDAN, 005 TEKİRA, 007 SARAY VDF, 008 ERNA.
//   - Puan: sadece mal sınıfı (MalSinif) "5AK" olan satırlar sayılır; puan ürün
//     adının SON 3 HANESİdir ("... TARİFE 065" -> 65) ve ADET ile çarpılır.
//     Mal sınıfı/kâr tablosu ve mağaza çarpanı YOKTUR. İade yoktur.
//   - Bonus (sıralama puanı): ayarlardan; varsayılan mağaza 10/3, personel 10/5/1.
//
// WingSM'e HİÇBİR veri yazılmaz (sadece GET /api/b2b/satis/list/:depo).
//
// Bu dosya "_" ile başladığı için Next.js tarafından route sayılmaz.

import type { Pool } from "pg";

import { wingSMRequest } from "@/app/lib/wingsm/server";
import { getPool } from "../score-rules/_shared";
import { DegerPuanInputError, parseOptionalDayCount, toWingsmDate } from "../_deger-puan-compute";
import {
  addBranchSale,
  normalizeName,
  personnelIdentityKey,
  pickPrimaryBranch,
  pickTarget,
  type BranchStat,
  type PersonnelTargetEntry,
} from "../_deger-puan-personnel";
import { wingsmDateToIso } from "../_deger-puan-history";

export const VODAFONE_DEPOTS: Array<{ depotCode: string; branchLabel: string }> = [
  { depotCode: "002", branchLabel: "MEYDAN" },
  { depotCode: "005", branchLabel: "TEKİRA" },
  { depotCode: "007", branchLabel: "SARAY VDF" },
  { depotCode: "008", branchLabel: "ERNA" },
];

export const VODAFONE_BRANCH_LABELS = VODAFONE_DEPOTS.map((depot) => depot.branchLabel);

// ======================================================
// AYARLAR
// ======================================================

// WingSM'in satış listesi iki ayrı kaynaktan okunabilir: normal liste ve
// "aktivasyon=1" (aktivasyon türü satışlar). Aktivasyon satışları normal listede
// GELMİYOR olabilir; bu yüzden "ikisi" varsayılandır: iki liste birleştirilir ve
// iki listede de BİREBİR aynı olan satırlar bir kez sayılır.
export type SalesSource = "liste" | "aktivasyon" | "ikisi";

export const SALES_SOURCES: SalesSource[] = ["liste", "aktivasyon", "ikisi"];

export type VodafoneSettings = {
  sinif: string; // sayılacak mal sınıfı
  storeBonus: number[]; // mağaza sıralama puanları (1., 2., ...)
  personnelBonus: number[]; // personel sıralama puanları
  kaynak: SalesSource; // WingSM satış kaynağı
};

export const DEFAULT_SETTINGS: VodafoneSettings = {
  sinif: "5AK",
  storeBonus: [10, 3],
  personnelBonus: [10, 5, 1],
  kaynak: "ikisi",
};

function cleanBonusList(value: unknown, fallback: number[]): number[] {
  if (!Array.isArray(value)) return fallback;

  const list = value
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item) && item >= 0 && item <= 1000)
    .slice(0, 20);

  return list;
}

export function sanitizeSettings(input: unknown): VodafoneSettings {
  const data = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const sinif = normalizeClass(data.sinif);

  return {
    sinif: sinif || DEFAULT_SETTINGS.sinif,
    storeBonus: cleanBonusList(data.storeBonus, DEFAULT_SETTINGS.storeBonus),
    personnelBonus: cleanBonusList(data.personnelBonus, DEFAULT_SETTINGS.personnelBonus),
    // Eski kayıtlarda "aktivasyonFiltresi: true" vardı -> "aktivasyon".
    kaynak: SALES_SOURCES.includes(data.kaynak as SalesSource)
      ? (data.kaynak as SalesSource)
      : data.aktivasyonFiltresi === true
        ? "aktivasyon"
        : DEFAULT_SETTINGS.kaynak,
  };
}

// ======================================================
// TABLOLAR
// ======================================================

let tablesReady = false;

export async function ensureVodafoneTables(pool: Pool) {
  if (tablesReady) return;

  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.vdf_deger_puan_settings (
      id INTEGER PRIMARY KEY,
      payload JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.vdf_deger_puan_store_targets (
      period TEXT NOT NULL,
      branch_label TEXT NOT NULL,
      target_value NUMERIC NOT NULL,
      PRIMARY KEY (period, branch_label)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.vdf_deger_puan_personnel_targets (
      id SERIAL PRIMARY KEY,
      period TEXT NOT NULL,
      branch_label TEXT NOT NULL,
      satici_adi TEXT NOT NULL,
      target_value NUMERIC NOT NULL,
      is_manager BOOLEAN NOT NULL DEFAULT FALSE,
      sort_order INTEGER NOT NULL DEFAULT 0
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.vdf_deger_puan_history (
      id SERIAL PRIMARY KEY,
      period TEXT NOT NULL,
      range_start DATE,
      range_end DATE,
      tarih TEXT NOT NULL,
      tarih2 TEXT NOT NULL,
      payload JSONB NOT NULL,
      computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT vdf_deger_puan_history_range_unique UNIQUE (tarih, tarih2)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.vdf_deger_puan_auto_runs (
      run_date DATE PRIMARY KEY,
      started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      finished_at TIMESTAMPTZ,
      tarih TEXT,
      tarih2 TEXT
    )
  `);

  tablesReady = true;
}

export async function loadSettings(pool: Pool): Promise<VodafoneSettings> {
  await ensureVodafoneTables(pool);

  const result = await pool.query(`SELECT payload FROM public.vdf_deger_puan_settings WHERE id = 1`);
  const payload = result.rows[0]?.payload;

  return sanitizeSettings(typeof payload === "string" ? JSON.parse(payload) : payload);
}

export async function saveSettings(pool: Pool, settings: VodafoneSettings) {
  await ensureVodafoneTables(pool);

  await pool.query(
    `
      INSERT INTO public.vdf_deger_puan_settings (id, payload, updated_at)
      VALUES (1, $1, now())
      ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = now()
    `,
    [JSON.stringify(settings)]
  );
}

// ======================================================
// SATIR OKUMA YARDIMCILARI (Satış Verisi aracıyla AYNI kurallar)
// ======================================================

export function normalizeClass(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/^0+(?=\d)/, "");
}

// Ürün adının SON 3 HANESİ ("... TARİFE 065" -> 65). Önünde rakam olmayan 3 haneli
// sayı aranır; ad sayıyla bitmiyorsa ya da 4+ haneli sayıyla bitiyorsa null.
export function parsePuan(productName: unknown): number | null {
  const match = String(productName ?? "")
    .trim()
    .match(/(?:^|[^\d])(\d{3})$/);

  return match ? Number(match[1]) : null;
}

const QTY_FIELD_CANDIDATES = ["MalMiktarI", "Miktar", "MalMiktar", "MiktarI", "Adet", "AdetI"];

function detectQtyField(rows: Array<Record<string, unknown>>): string | null {
  for (const name of QTY_FIELD_CANDIDATES) {
    if (rows.some((row) => row[name] !== undefined && row[name] !== null && String(row[name]).trim() !== "")) {
      return name;
    }
  }

  return null;
}

function extractRows(payload: unknown): Array<Record<string, unknown>> {
  const typed = (payload ?? {}) as { data?: { list?: unknown[] } | unknown[]; List?: unknown[] };

  let list: unknown[] = [];

  if (Array.isArray(payload)) list = payload;
  else if (!Array.isArray(typed.data) && Array.isArray(typed.data?.list)) list = typed.data.list;
  else if (Array.isArray(typed.data)) list = typed.data;
  else if (Array.isArray(typed.List)) list = typed.List;

  return list.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object");
}

// ======================================================
// TARİH YARDIMCILARI
// ======================================================

function parseWingsmDate(value: string): { day: number; month: number; year: number } {
  const [day, month, year] = value.split("/").map(Number);
  return { day, month, year };
}

function toUtcDate(value: string): Date {
  const { day, month, year } = parseWingsmDate(value);
  return new Date(Date.UTC(year, month - 1, day));
}

function formatWingsm(date: Date): string {
  return `${String(date.getUTCDate()).padStart(2, "0")}/${String(date.getUTCMonth() + 1).padStart(2, "0")}/${date.getUTCFullYear()}`;
}

// WingSM büyük aralıkta yavaşlıyor: aralık 5'er günlük dilimlere bölünür.
const CHUNK_DAYS = 5;
const REQUEST_TIMEOUT_MS = 60_000;
const MAX_RANGE_DAYS = 62;

function splitRange(tarih: string, tarih2: string): Array<{ tarih: string; tarih2: string }> {
  const chunks: Array<{ tarih: string; tarih2: string }> = [];
  const last = toUtcDate(tarih2).getTime();
  let start = toUtcDate(tarih);

  while (start.getTime() <= last) {
    const end = new Date(start.getTime() + (CHUNK_DAYS - 1) * 86_400_000);
    const chunkEnd = end.getTime() > last ? new Date(last) : end;

    chunks.push({ tarih: formatWingsm(start), tarih2: formatWingsm(chunkEnd) });
    start = new Date(chunkEnd.getTime() + 86_400_000);
  }

  return chunks;
}

export type SourceStats = {
  liste: number; // normal listeden gelen satır
  aktivasyon: number; // aktivasyon listesinden gelen satır
  ortak: number; // iki listede de birebir aynı olan satır
  birlesik: number; // sayıma giren satır
};

// Bir deponun satışlarını seçilen kaynaktan okur (5'er günlük dilimler, uzun bekleme).
// "ikisi": her iki liste okunur, birleşim alınır; iki listede BİREBİR aynı olan satır
// bir kez sayılır (aynı listede tekrar eden aynı satırlar korunur: çoklu küme birleşimi).
export async function fetchDepotSales(
  depotCode: string,
  tarih: string,
  tarih2: string,
  kaynak: SalesSource
): Promise<{ rows: Array<Record<string, unknown>>; stats: SourceStats }> {
  const chunks = splitRange(tarih, tarih2);
  const plain: Array<Record<string, unknown>> = [];
  const akt: Array<Record<string, unknown>> = [];

  for (const chunk of chunks) {
    if (kaynak !== "aktivasyon") {
      const result = await wingSMRequest<unknown>(`/api/b2b/satis/list/${encodeURIComponent(depotCode)}`, {
        method: "GET",
        query: chunk,
        timeoutMs: REQUEST_TIMEOUT_MS,
      });
      plain.push(...extractRows(result));
    }

    if (kaynak !== "liste") {
      const result = await wingSMRequest<unknown>(`/api/b2b/satis/list/${encodeURIComponent(depotCode)}`, {
        method: "GET",
        query: { ...chunk, aktivasyon: "1" },
        timeoutMs: REQUEST_TIMEOUT_MS,
      });
      akt.push(...extractRows(result));
    }
  }

  const countKeys = (rows: Array<Record<string, unknown>>) => {
    const counts = new Map<string, number>();
    for (const row of rows) {
      const key = JSON.stringify(row);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  };

  const plainCounts = countKeys(plain);
  const aktCounts = countKeys(akt);

  let ortak = 0;
  for (const [key, count] of plainCounts) {
    ortak += Math.min(count, aktCounts.get(key) ?? 0);
  }

  let rows: Array<Record<string, unknown>>;

  if (kaynak === "liste") {
    rows = plain;
  } else if (kaynak === "aktivasyon") {
    rows = akt;
  } else {
    // Birleşim: normal listenin hepsi + aktivasyon listesinde olup normalde bulunmayan fazlalık.
    rows = [...plain];
    const remaining = new Map(plainCounts);

    for (const row of akt) {
      const key = JSON.stringify(row);
      const left = remaining.get(key) ?? 0;

      if (left > 0) {
        remaining.set(key, left - 1);
      } else {
        rows.push(row);
      }
    }
  }

  return { rows, stats: { liste: plain.length, aktivasyon: akt.length, ortak, birlesik: rows.length } };
}

export function istanbulTodayIso(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function previousDayIso(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10);
}

// ======================================================
// HEDEFLER
// ======================================================

export type VodafoneTargets = {
  period: string;
  stores: Array<{ branchLabel: string; hedef: number }>;
  personnel: Array<{ branchLabel: string; saticiAdi: string; hedef: number; isManager: boolean }>;
};

export async function loadTargets(pool: Pool, period: string): Promise<VodafoneTargets> {
  await ensureVodafoneTables(pool);

  const stores = await pool.query(
    `SELECT branch_label, target_value FROM public.vdf_deger_puan_store_targets WHERE period = $1`,
    [period]
  );

  const personnel = await pool.query(
    `
      SELECT branch_label, satici_adi, target_value, is_manager
      FROM public.vdf_deger_puan_personnel_targets
      WHERE period = $1
      ORDER BY sort_order ASC, id ASC
    `,
    [period]
  );

  return {
    period,
    stores: stores.rows.map((row) => ({ branchLabel: String(row.branch_label), hedef: Number(row.target_value) })),
    personnel: personnel.rows.map((row) => ({
      branchLabel: String(row.branch_label),
      saticiAdi: String(row.satici_adi),
      hedef: Number(row.target_value),
      isManager: Boolean(row.is_manager),
    })),
  };
}

// ======================================================
// RAPOR TİPLERİ
// ======================================================

export type VodafoneStoreRow = {
  branchLabel: string;
  depotCode: string;
  saleCount: number;
  puan: number; // gerçekleşen
  hedef: number | null;
  projeksiyon: number;
  hedefYuzdesi: number | null; // gerçekleşen / hedef
  puanProjex: number | null; // projeksiyon / hedef
  siralamaPuani: number;
};

export type VodafonePersonnelRow = {
  branchLabel: string;
  magazalar: Array<{ branchLabel: string; puan: number }>;
  saticiKod: string;
  saticiAdi: string;
  saleCount: number;
  puan: number; // gerçekleşen
  hedef: number | null;
  isManager: boolean;
  hedefYuzdesi: number | null;
  projeksiyon: number;
  siralama: number | null;
  siralamaPuani: number;
};

export type VodafoneReport = {
  success: true;
  kanal: "vodafone";
  hedefPeriodu: string;
  gunBilgisi: { gecenGun: number; ayToplamGun: number; kalanGun: number };
  period: { tarih: string; tarih2: string };
  stores: VodafoneStoreRow[];
  personnel: VodafonePersonnelRow[];
  totals: { gerceklesen: number; projeksiyon: number; gerceklesenOrtalama: number; projeksiyonOrtalama: number };
  sinif: string;
  adetAlani: string | null;
  kaynak: SalesSource;
  kaynakOzeti: Array<{ magaza: string } & SourceStats>;
  rowsWithPuan: number;
  rowsWithoutPuan: number;
  withoutPuanExamples: string[];
};

// ======================================================
// HESAPLAMA ÇEKİRDEĞİ (HESAPLA düğmesi ve günlük otomatik hesap AYNISI)
// ======================================================

export async function computeAndSaveVodafoneReport(input: {
  bastar: unknown;
  bittar: unknown;
  gecenGun?: unknown;
  ayToplamGun?: unknown;
}): Promise<VodafoneReport> {
  const tarih = toWingsmDate(input.bastar);
  const tarih2 = toWingsmDate(input.bittar);

  const manualElapsed = parseOptionalDayCount(input.gecenGun);
  const manualMonthDays = parseOptionalDayCount(input.ayToplamGun);

  if (manualElapsed === "invalid" || manualMonthDays === "invalid") {
    throw new DegerPuanInputError("Gün ayarı 1 ile 31 arasında bir tam sayı olmalıdır.");
  }

  const spanDays = (toUtcDate(tarih2).getTime() - toUtcDate(tarih).getTime()) / 86_400_000 + 1;

  if (!Number.isFinite(spanDays) || spanDays < 1) {
    throw new DegerPuanInputError("Bitiş tarihi başlangıçtan önce olamaz.");
  }

  if (spanDays > MAX_RANGE_DAYS) {
    throw new DegerPuanInputError(`Tarih aralığı en fazla ${MAX_RANGE_DAYS} gün olabilir.`);
  }

  const pool = getPool();
  const settings = await loadSettings(pool);

  // ---- gün hesabı (CMR ile AYNI) ----
  const { day: bastarGun, month: bastarAy, year: bastarYil } = parseWingsmDate(tarih);
  const { day: bittarGun, month: bittarAy, year: bittarYil } = parseWingsmDate(tarih2);

  const period = `${bastarYil}-${String(bastarAy).padStart(2, "0")}`;
  const autoDaysInMonth = new Date(bittarYil, bittarAy, 0).getDate();
  const bastarAsBittarAy = bittarAy === bastarAy && bittarYil === bastarYil ? bastarGun : 1;
  const autoDaysElapsed = Math.max(1, bittarGun - bastarAsBittarAy + 1);

  const daysInMonth = manualMonthDays !== null ? manualMonthDays : autoDaysInMonth;
  const daysElapsed = manualElapsed !== null ? manualElapsed : autoDaysElapsed;

  if (daysElapsed > daysInMonth) {
    throw new DegerPuanInputError("Geçen gün, ayın toplam gün sayısından büyük olamaz.");
  }

  const projectionFactor = daysInMonth / daysElapsed;

  // ---- WingSM: 4 depo paralel, her deponun dilimleri sırayla ----
  const perDepot = await Promise.all(
    VODAFONE_DEPOTS.map(async ({ depotCode, branchLabel }) => {
      try {
        const { rows, stats } = await fetchDepotSales(depotCode, tarih, tarih2, settings.kaynak);

        return { depotCode, branchLabel, rows, stats };
      } catch (error) {
        // Eksik veriyle yanlış rapor kaydetmemek için tüm hesap durur.
        throw new Error(
          `${branchLabel} (${depotCode}) satışları alınamadı: ${error instanceof Error ? error.message : "bilinmeyen hata"}`
        );
      }
    })
  );

  const inScope = perDepot.flatMap((depot) =>
    depot.rows
      .filter((row) => normalizeClass(row.MalSinif) === settings.sinif)
      .map((row) => ({ row, depotCode: depot.depotCode, branchLabel: depot.branchLabel }))
  );

  const qtyField = detectQtyField(inScope.map((item) => item.row));

  // ---- toplama ----
  const storeMap = new Map<string, VodafoneStoreRow>(
    VODAFONE_DEPOTS.map((depot) => [
      depot.depotCode,
      {
        branchLabel: depot.branchLabel,
        depotCode: depot.depotCode,
        saleCount: 0,
        puan: 0,
        hedef: null,
        projeksiyon: 0,
        hedefYuzdesi: null,
        puanProjex: null,
        siralamaPuani: 0,
      },
    ])
  );

  type PersonAgg = {
    saticiKod: string;
    saticiAdi: string;
    saleCount: number;
    puan: number;
    stats: Map<string, BranchStat>;
  };

  const personMap = new Map<string, PersonAgg>();
  const examples = new Set<string>();
  let rowsWithPuan = 0;
  let rowsWithoutPuan = 0;

  for (const { row, depotCode, branchLabel } of inScope) {
    const qtyRaw = qtyField ? Number(row[qtyField]) : NaN;
    const qty = Number.isFinite(qtyRaw) ? qtyRaw : 1;
    const perUnit = parsePuan(row.MalAd);

    if (perUnit === null) {
      rowsWithoutPuan += 1;
      if (examples.size < 10) examples.add(String(row.MalAd ?? ""));
    } else {
      rowsWithPuan += 1;
    }

    const puan = (perUnit ?? 0) * qty;

    const store = storeMap.get(depotCode);
    if (store) {
      store.saleCount += 1;
      store.puan += puan;
    }

    const saticiKod = String(row.SaticiKod ?? "").trim();
    const saticiAdi = String(row.SaticiAdI ?? "").trim();
    const key = personnelIdentityKey(saticiAdi, saticiKod);

    const person = personMap.get(key) ?? { saticiKod, saticiAdi, saleCount: 0, puan: 0, stats: new Map<string, BranchStat>() };
    person.saleCount += 1;
    person.puan += puan;
    addBranchSale(person.stats, branchLabel, puan);
    personMap.set(key, person);
  }

  // ---- hedefler ----
  const targets = await loadTargets(pool, period);
  const storeTargetByBranch = new Map(targets.stores.map((item) => [item.branchLabel, item.hedef]));

  const targetsByName = new Map<string, PersonnelTargetEntry[]>();
  for (const item of targets.personnel) {
    const nameKey = normalizeName(item.saticiAdi);
    const list = targetsByName.get(nameKey) ?? [];
    list.push({ branchLabel: item.branchLabel, hedef: item.hedef, isManager: item.isManager });
    targetsByName.set(nameKey, list);
  }

  // Hedef listesinde olup hiç satışı olmayan kişi de tabloda 0 ile görünür (Excel gibi).
  for (const item of targets.personnel) {
    const key = personnelIdentityKey(item.saticiAdi, "");
    if (!personMap.has(key)) {
      personMap.set(key, { saticiKod: "", saticiAdi: item.saticiAdi, saleCount: 0, puan: 0, stats: new Map() });
    }
  }

  const stores = VODAFONE_DEPOTS.map((depot) => storeMap.get(depot.depotCode)!);

  for (const store of stores) {
    const hedef = storeTargetByBranch.get(store.branchLabel);
    store.hedef = hedef !== undefined ? hedef : null;
    store.projeksiyon = store.puan * projectionFactor;
    store.hedefYuzdesi = store.hedef && store.hedef > 0 ? (store.puan / store.hedef) * 100 : null;
    store.puanProjex = store.hedef && store.hedef > 0 ? (store.projeksiyon / store.hedef) * 100 : null;
  }

  // Mağaza sıralama puanı: hedef yüzdesine göre.
  stores
    .filter((store) => store.hedefYuzdesi !== null)
    .sort((a, b) => (b.hedefYuzdesi ?? 0) - (a.hedefYuzdesi ?? 0))
    .forEach((store, index) => {
      store.siralamaPuani = settings.storeBonus[index] ?? 0;
    });

  const personnel: VodafonePersonnelRow[] = Array.from(personMap.values()).map((person) => {
    const primary = pickPrimaryBranch(person.stats);
    const match = pickTarget(targetsByName.get(normalizeName(person.saticiAdi)), primary);
    const branchLabel = primary || match?.branchLabel || "";
    const hedef = match ? match.hedef : null;
    const isManager = match ? match.isManager : false;

    return {
      branchLabel,
      magazalar: Array.from(person.stats.entries())
        .map(([label, stat]) => ({ branchLabel: label, puan: stat.score }))
        .sort((a, b) => b.puan - a.puan),
      saticiKod: person.saticiKod,
      saticiAdi: person.saticiAdi,
      saleCount: person.saleCount,
      puan: person.puan,
      hedef,
      isManager,
      hedefYuzdesi: match && !match.isManager && match.hedef > 0 ? (person.puan / match.hedef) * 100 : null,
      projeksiyon: person.puan * projectionFactor,
      siralama: null,
      siralamaPuani: 0,
    };
  });

  // Personel sıralaması şirket geneli (mağaza fark etmez); müdür ve hedefsiz sıralamaya girmez.
  const ranked = personnel
    .filter((person) => !person.isManager && person.hedefYuzdesi !== null)
    .sort((a, b) => (b.hedefYuzdesi ?? 0) - (a.hedefYuzdesi ?? 0));

  ranked.forEach((person, index) => {
    person.siralama = index + 1;
    person.siralamaPuani = settings.personnelBonus[index] ?? 0;
  });

  personnel.sort((a, b) => {
    const aRanked = a.siralama !== null;
    const bRanked = b.siralama !== null;
    if (aRanked && bRanked) return (a.siralama ?? 0) - (b.siralama ?? 0);
    if (aRanked !== bRanked) return aRanked ? -1 : 1;
    return b.puan - a.puan;
  });

  const totalGerceklesen = stores.reduce((sum, store) => sum + store.puan, 0);
  const totalProjeksiyon = stores.reduce((sum, store) => sum + store.projeksiyon, 0);

  const report: VodafoneReport = {
    success: true,
    kanal: "vodafone",
    hedefPeriodu: period,
    gunBilgisi: { gecenGun: daysElapsed, ayToplamGun: daysInMonth, kalanGun: Math.max(0, daysInMonth - daysElapsed) },
    period: { tarih, tarih2 },
    stores,
    personnel,
    totals: {
      gerceklesen: totalGerceklesen,
      projeksiyon: totalProjeksiyon,
      gerceklesenOrtalama: stores.length ? totalGerceklesen / stores.length : 0,
      projeksiyonOrtalama: stores.length ? totalProjeksiyon / stores.length : 0,
    },
    sinif: settings.sinif,
    adetAlani: qtyField,
    kaynak: settings.kaynak,
    kaynakOzeti: perDepot.map((depot) => ({ magaza: depot.branchLabel, ...depot.stats })),
    rowsWithPuan,
    rowsWithoutPuan,
    withoutPuanExamples: Array.from(examples),
  };

  // Geçmiş günlerin sonucu: aynı aralık güncellenir, farklı aralıklar ayrı kalır.
  await pool.query(
    `
      INSERT INTO public.vdf_deger_puan_history (period, range_start, range_end, tarih, tarih2, payload, computed_at)
      VALUES ($1, $2, $3, $4, $5, $6, now())
      ON CONFLICT (tarih, tarih2) DO UPDATE
        SET payload = EXCLUDED.payload, period = EXCLUDED.period, computed_at = now()
    `,
    [period, wingsmDateToIso(tarih), wingsmDateToIso(tarih2), tarih, tarih2, JSON.stringify(report)]
  );

  return report;
}
