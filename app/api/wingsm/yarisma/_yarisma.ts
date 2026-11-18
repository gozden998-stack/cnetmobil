// app/api/wingsm/yarisma/_yarisma.ts
//
// CNETMOBIL - "Şampiyonlar Ligi" yarışması (CMR kanalı, Kasım 2026)
//
// Kurallar (kullanıcının duyurusu + açıklamaları):
//  - Puan = Değer Puan motorunun kişi puanı (çarpanlı puan), hedef = Değer Puan Hedefler sekmesindeki kişi hedefi.
//  - Stok cihaz (stock_devices'te kayıtlı IMEI'li cihaz) satan kişinin puanına cihaz başına +bonus (varsayılan 125) eklenir.
//  - Sıralama: hedef yüzdesi (toplam puan ÷ hedef). Mağaza müdürleri ve hedefi olmayanlar sıralamaya girmez.
//  - Ödül: 1. 1 gr altın, 2. 1/2 gr altın, 3. 2000 TL, 4. 1000 TL.
//  - Ekip kuralı: ilk 2 kişi AYNI ekipten olmalı ((Cadde+Saray) veya (Kapaklı+Meydan)). Olmazsa 2. ödül, 1.'nin
//    ekibindeki bir sonraki kişiye gider; atlanan kişi sıradaki ödülü alır (örnek: 1 Fatih, 2 Emirhan, 3 Alper ->
//    2. ödül Alper, 3. ödül Emirhan). 3. ve 4. ödül kalan kişilere sırayla.
//  - Önkoşul: şirket toplam cihaz satışı bir önceki ayın AYNI günlerine göre %15 artmalı (bilgi olarak gösterilir).
//
// Hesap Değer Puan motorunu `skipSave` ile çağırır: resmi aylık rapor/arşiv kayıtlarına DOKUNULMAZ.
// WingSM'e hiçbir şey yazılmaz. Bu dosya "_" ile başladığı için Next.js tarafından route sayılmaz.

import type { Pool } from "pg";

import { computeAndSaveDegerPuanReport, type ImeiSaleRow } from "../_deger-puan-compute";
import { normalizeName, personnelIdentityKey, pickTarget, type PersonnelTargetEntry } from "../_deger-puan-personnel";

export type LeagueConfig = {
  id: string;
  title: string;
  startDate: string; // YYYY-MM-DD (yarışma başlangıcı)
  endDate: string; // YYYY-MM-DD (yarışma bitişi)
  countFrom: string; // puanların sayılmaya başladığı gün (varsayılan = startDate)
  bonusPoints: number; // stok cihaz başına ek puan
  preconditionPct: number; // şirket cihaz satışı artış önkoşulu (%)
  prizes: Array<{ rank: number; label: string }>;
  groups: Record<string, string[]>; // ekip adı -> mağaza etiketleri
};

export const DEFAULT_LEAGUE: LeagueConfig = {
  id: "cmr-2026-11",
  title: "CMR Kasım 2026 Şampiyonlar Ligi",
  startDate: "2026-11-17",
  endDate: "2026-11-30",
  countFrom: "2026-11-17",
  bonusPoints: 125,
  preconditionPct: 15,
  prizes: [
    { rank: 1, label: "1 gr altın" },
    { rank: 2, label: "1/2 gram altın" },
    { rank: 3, label: "2000 TL" },
    { rank: 4, label: "1000 TL" },
  ],
  // Meydan = WingSM'de CMR MERKEZ (003) kabul edildi.
  groups: {
    "Cadde-Saray": ["CMR CADDE", "CMR SARAY"],
    "Kapaklı-Meydan": ["CMR KAPAKLI", "CMR MERKEZ"],
  },
};

// Cihaz sınıfları (Personel Gidişat "Cihaz Adet" ile aynı): 2el, 1el, 1el tablet, 4el
const DEVICE_CLASSES = new Set(["2el", "1el", "1eltablet", "4el"]);

const fold = (value: unknown) =>
  String(value ?? "")
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .replace(/\s+/g, "");

// ------------------------------------------------------------------
// SAF FONKSİYONLAR (test edilebilir)
// ------------------------------------------------------------------

// Stok cihaz bonusu: kişi başına net IMEI sayısı (satış sayısı - iade sayısı > 0 olan her IMEI için 1).
export function stockSalesByPerson(imeiRows: ImeiSaleRow[], stockImeis: Set<string>) {
  const perImei = new Map<string, { net: number; row: ImeiSaleRow }>();

  for (const row of imeiRows) {
    for (const imei of row.imeis) {
      if (!stockImeis.has(imei)) continue;

      // Aynı IMEI farklı kişilere yazılmışsa (iade başka kişiden) kişi+IMEI ayrı sayılır
      const key = `${personnelIdentityKey(row.saticiAdi, row.saticiKod)}|${imei}`;
      const entry = perImei.get(key) ?? { net: 0, row };

      entry.net += row.isReturn ? -1 : 1;
      if (!row.isReturn) entry.row = row;
      perImei.set(key, entry);
    }
  }

  const byPerson = new Map<string, Array<{ imei: string; malAd: string; tarih: string; branchLabel: string }>>();

  for (const [key, entry] of perImei) {
    if (entry.net <= 0) continue;

    const [personKey, imei] = [key.slice(0, key.lastIndexOf("|")), key.slice(key.lastIndexOf("|") + 1)];
    const list = byPerson.get(personKey) ?? [];

    list.push({ imei, malAd: entry.row.malAd, tarih: entry.row.tarih, branchLabel: entry.row.branchLabel });
    byPerson.set(personKey, list);
  }

  return byPerson;
}

export type StandingPerson = {
  saticiAdi: string;
  saticiKod: string;
  branchLabel: string; // Hedefler tablosundaki mağaza (yoksa en çok satış yaptığı mağaza)
  group: string | null;
  puan: number; // Değer Puan (çarpanlı)
  stokAdet: number;
  bonus: number;
  toplamPuan: number;
  hedef: number | null;
  yuzde: number | null;
  isManager: boolean;
  siralama: number | null;
  stokSatislar: Array<{ imei: string; malAd: string; tarih: string; branchLabel: string }>;
};

export function groupOf(branchLabel: string, groups: LeagueConfig["groups"]): string | null {
  const key = normalizeName(branchLabel);

  for (const [name, branches] of Object.entries(groups)) {
    if (branches.some((branch) => normalizeName(branch) === key)) return name;
  }

  return null;
}

// Değer Puan kişileri + stok cihaz bonusu -> yarışma sıralaması
export function buildStanding(input: {
  personnel: Array<{ saticiAdi: string; saticiKod: string; branchLabel: string; carpanliPuan: number; hedef: number | null; isManager: boolean }>;
  stockByPerson: Map<string, Array<{ imei: string; malAd: string; tarih: string; branchLabel: string }>>;
  targetsByName: Map<string, PersonnelTargetEntry[]>;
  bonusPoints: number;
  groups: LeagueConfig["groups"];
}): StandingPerson[] {
  const people = new Map<string, StandingPerson>();

  const make = (saticiAdi: string, saticiKod: string, fallbackBranch: string, puan: number, engineHedef: number | null, engineManager: boolean) => {
    const target = pickTarget(input.targetsByName.get(normalizeName(saticiAdi)), fallbackBranch);
    const branchLabel = target?.branchLabel || fallbackBranch;
    const hedef = target ? target.hedef : engineHedef;
    const isManager = target ? target.isManager : engineManager;

    return {
      saticiAdi,
      saticiKod,
      branchLabel,
      group: groupOf(branchLabel, input.groups),
      puan,
      stokAdet: 0,
      bonus: 0,
      toplamPuan: puan,
      hedef,
      yuzde: null,
      isManager,
      siralama: null,
      stokSatislar: [],
    } as StandingPerson;
  };

  for (const person of input.personnel) {
    people.set(personnelIdentityKey(person.saticiAdi, person.saticiKod), make(person.saticiAdi, person.saticiKod, person.branchLabel, person.carpanliPuan, person.hedef, person.isManager));
  }

  // Yalnız stok cihaz satan (normal puanı olmayan) kişiler de listeye girer
  for (const [personKey, sales] of input.stockByPerson) {
    let person = people.get(personKey);

    if (!person) {
      const first = sales[0];

      person = make(personKey.startsWith("KOD:") ? "" : personKey, personKey.startsWith("KOD:") ? personKey.slice(4) : "", first.branchLabel, 0, null, false);
      people.set(personKey, person);
    }

    person.stokSatislar = sales;
    person.stokAdet = sales.length;
    person.bonus = sales.length * input.bonusPoints;
    person.toplamPuan = person.puan + person.bonus;
  }

  const list = Array.from(people.values());

  for (const person of list) {
    person.yuzde = !person.isManager && person.hedef && person.hedef > 0 ? (person.toplamPuan / person.hedef) * 100 : null;
  }

  const ranked = list.filter((person) => person.yuzde !== null).sort((a, b) => (b.yuzde ?? 0) - (a.yuzde ?? 0) || b.toplamPuan - a.toplamPuan);

  ranked.forEach((person, index) => {
    person.siralama = index + 1;
  });

  return list.sort((a, b) => {
    if (a.siralama !== null && b.siralama !== null) return a.siralama - b.siralama;
    if (a.siralama !== null) return -1;
    if (b.siralama !== null) return 1;

    return b.toplamPuan - a.toplamPuan;
  });
}

export type PrizeResult = { rank: number; label: string; winner: string | null; siralama: number | null; group: string | null; note: string | null };

// Ödül dağılımı + ekip kuralı (bkz. dosya başı).
export function assignPrizes(standing: StandingPerson[], prizes: LeagueConfig["prizes"]): PrizeResult[] {
  const ranked = standing.filter((person) => person.siralama !== null);
  const used = new Set<StandingPerson>();
  const slots: Array<StandingPerson | null> = prizes.map(() => null);
  const notes: Array<string | null> = prizes.map(() => null);

  const first = ranked[0] ?? null;

  if (first) {
    slots[0] = first;
    used.add(first);
  }

  // 2. ödül: 1.'nin ekibinden sıradaki kişi
  if (first && prizes.length > 1) {
    const partner = ranked.find((person) => !used.has(person) && first.group !== null && person.group === first.group) ?? null;

    if (partner) {
      slots[1] = partner;
      used.add(partner);

      if (partner.siralama !== 2) notes[1] = `Ekip kuralı: genel sıralamada ${partner.siralama}. (1. ile aynı ekip: ${first.group})`;
    } else {
      // Aynı ekipten kimse yoksa kural uygulanamaz: sıradaki kişi alır, not düşülür
      const next = ranked.find((person) => !used.has(person)) ?? null;

      if (next) {
        slots[1] = next;
        used.add(next);
        notes[1] = "1. ile aynı ekipten kişi bulunamadı; genel sıraya göre verildi (kontrol edin).";
      }
    }
  }

  // Kalan ödüller: genel sırayla, atlananlar dahil
  for (let index = 2; index < prizes.length; index += 1) {
    const next = ranked.find((person) => !used.has(person)) ?? null;

    if (next) {
      slots[index] = next;
      used.add(next);

      if (next.siralama !== index + 1) notes[index] = `Genel sıralamada ${next.siralama}. (2. ödül kaydırması nedeniyle)`;
    }
  }

  return prizes.map((prize, index) => ({
    rank: prize.rank,
    label: prize.label,
    winner: slots[index]?.saticiAdi ?? null,
    siralama: slots[index]?.siralama ?? null,
    group: slots[index]?.group ?? null,
    note: notes[index],
  }));
}

// ------------------------------------------------------------------
// TARİH YARDIMCILARI
// ------------------------------------------------------------------

const isoDate = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && isoDate.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

export function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);

  date.setUTCDate(date.getUTCDate() + days);

  return date.toISOString().slice(0, 10);
}

// Bir önceki ayın aynı günü (ayda o gün yoksa ayın son günü)
export function shiftMonthBack(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  const prevMonthLast = new Date(Date.UTC(year, month - 1, 0)).getUTCDate();
  const prevYear = month === 1 ? year - 1 : year;
  const prevMonth = month === 1 ? 12 : month - 1;

  return `${prevYear}-${String(prevMonth).padStart(2, "0")}-${String(Math.min(day, prevMonthLast)).padStart(2, "0")}`;
}

export function todayInTurkey(now = new Date()): string {
  return now.toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" });
}

// Otomatik günlük hesap: yarışmanın ikinci gününden bitişten sonraki güne kadar (son gün bitiş verisiyle kapanış hesabı).
// Her gün Türkiye saatiyle 12:30'dan itibaren (zamanlayıcı 10 dakikada bir çağırır, günde bir kez hesaplanır).
export const YARISMA_AUTO_RUN_MINUTES = 12 * 60 + 30;

// Verilen anın Türkiye saatine göre tarihi ("YYYY-MM-DD") ve günün kaçıncı dakikası olduğu (0-1439).
export function istanbulDateAndMinutes(now: Date): { date: string; minutes: number } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(now)
      .map((part) => [part.type, part.value])
  );

  return { date: `${parts.year}-${parts.month}-${parts.day}`, minutes: Number(parts.hour) * 60 + Number(parts.minute) };
}

export function isAutoRunDayForLeague(todayIso: string, config: Pick<LeagueConfig, "startDate" | "endDate">): boolean {
  return todayIso >= addDays(config.startDate, 1) && todayIso <= addDays(config.endDate, 1);
}

// Mağaza girişlerine giden SADELEŞTİRİLMİŞ görünüm: yalnız sıralamaya girenler; hedef rakamı, satıcı kodu, IMEI yok.
export function toStoreView(result: Record<string, any>) {
  const standing: any[] = Array.isArray(result.standing) ? result.standing : [];
  const pre = result.precondition ?? {};

  return {
    success: true,
    hasResult: true,
    config: {
      title: result.config?.title,
      startDate: result.config?.startDate,
      endDate: result.config?.endDate,
      countFrom: result.config?.countFrom,
      bonusPoints: result.config?.bonusPoints,
      preconditionPct: result.config?.preconditionPct,
    },
    range: result.range,
    computedAt: result.computedAt,
    prizes: result.prizes,
    precondition: pre.available
      ? { available: true, required: pre.required, current: pre.current, previous: pre.previous, growthPct: pre.growthPct, met: pre.met }
      : { available: false, required: pre.required },
    standing: standing
      .filter((person) => person.siralama !== null && person.siralama !== undefined)
      .map((person) => ({
        siralama: person.siralama,
        saticiAdi: person.saticiAdi,
        branchLabel: person.branchLabel,
        group: person.group,
        puan: person.puan,
        stokAdet: person.stokAdet,
        bonus: person.bonus,
        toplamPuan: person.toplamPuan,
        yuzde: person.yuzde,
      })),
  };
}

// ------------------------------------------------------------------
// VERİTABANI + HESAP
// ------------------------------------------------------------------

let tablesReady = false;

export async function ensureYarismaTables(pool: Pool) {
  if (tablesReady) return;

  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.yarisma_leagues (
      id TEXT PRIMARY KEY,
      config JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  // kind: 'yayin' = her gün 12:30'daki OTOMATİK sonuç (mağazaların gördüğü); 'test' = yöneticinin "Hesapla" sonucu (mağazalara görünmez)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.yarisma_results (
      league_id TEXT NOT NULL,
      kind TEXT NOT NULL DEFAULT 'yayin',
      payload JSONB NOT NULL,
      computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (league_id, kind),
      CONSTRAINT yarisma_results_kind_chk CHECK (kind IN ('yayin', 'test'))
    )
  `);

  tablesReady = true;
}

export async function getLeagueConfig(pool: Pool, id = DEFAULT_LEAGUE.id): Promise<LeagueConfig> {
  await ensureYarismaTables(pool);

  const row = (await pool.query(`SELECT config FROM public.yarisma_leagues WHERE id = $1`, [id])).rows[0];

  if (!row) {
    await pool.query(`INSERT INTO public.yarisma_leagues (id, config) VALUES ($1, $2::jsonb) ON CONFLICT (id) DO NOTHING`, [DEFAULT_LEAGUE.id, JSON.stringify(DEFAULT_LEAGUE)]);

    return DEFAULT_LEAGUE;
  }

  return { ...DEFAULT_LEAGUE, ...(row.config as Partial<LeagueConfig>) };
}

export async function saveLeagueConfig(pool: Pool, config: LeagueConfig) {
  await ensureYarismaTables(pool);
  await pool.query(
    `INSERT INTO public.yarisma_leagues (id, config, updated_at) VALUES ($1, $2::jsonb, now())
     ON CONFLICT (id) DO UPDATE SET config = EXCLUDED.config, updated_at = now()`,
    [config.id, JSON.stringify(config)]
  );
}

export type ResultKind = "yayin" | "test";

export async function getLatestResult(pool: Pool, id = DEFAULT_LEAGUE.id, kind: ResultKind = "yayin") {
  await ensureYarismaTables(pool);

  const row = (await pool.query(`SELECT payload, computed_at FROM public.yarisma_results WHERE league_id = $1 AND kind = $2`, [id, kind])).rows[0];

  return row ? { ...(row.payload as Record<string, unknown>), computedAt: row.computed_at } : null;
}

function countDeviceSales(report: any): number {
  const rows: any[] = Array.isArray(report?.detailRows) ? report.detailRows : [];

  return rows.filter((row) => DEVICE_CLASSES.has(fold(row?.malSinif))).length;
}

// 17-30 gibi bir aralık için yarışma sonucunu hesaplar ve kaydeder (resmi Değer Puan kayıtlarına DOKUNMAZ).
// kind 'test' (varsayılan, yönetici Hesapla): mağazalara GÖRÜNMEZ. kind 'yayin': yalnız otomatik 12:30 hesabı kullanır.
export async function computeLeague(pool: Pool, config: LeagueConfig, kind: ResultKind = "test") {
  await ensureYarismaTables(pool);

  const yesterday = addDays(todayInTurkey(), -1);
  const to = yesterday < config.endDate ? yesterday : config.endDate;

  if (to < config.countFrom) {
    const empty = { success: true, empty: true, message: "Henüz sayılacak gün yok (rapor dünün verisine kadar hesaplanır).", config, range: { from: config.countFrom, to } };

    return empty;
  }

  const report: any = await computeAndSaveDegerPuanReport({ bastar: config.countFrom, bittar: to, skipSave: true, collectImeis: true });
  const imeiRows: ImeiSaleRow[] = Array.isArray(report.imeiRows) ? report.imeiRows : [];

  // Stok cihaz: yalnız bu satışlardaki IMEI'ler için stock_devices'e bakılır (tek sorgu)
  const allImeis = Array.from(new Set(imeiRows.flatMap((row) => row.imeis)));
  const stockImeis = new Set<string>(
    allImeis.length ? (await pool.query(`SELECT imei FROM public.stock_devices WHERE imei = ANY($1::text[])`, [allImeis])).rows.map((row) => String(row.imei)) : []
  );

  const period = config.countFrom.slice(0, 7);
  const targetsByName = new Map<string, PersonnelTargetEntry[]>();

  try {
    const targetRows = await pool.query(`SELECT branch_label, satici_adi, target_value, is_manager FROM public.wingsm_personnel_targets WHERE period = $1 AND active = true`, [period]);

    for (const row of targetRows.rows) {
      const key = normalizeName(String(row.satici_adi));
      const list = targetsByName.get(key) ?? [];

      list.push({ branchLabel: String(row.branch_label), hedef: Number(row.target_value), isManager: Boolean(row.is_manager) });
      targetsByName.set(key, list);
    }
  } catch {
    // Hedef tablosu yoksa hedefsiz kabul edilir
  }

  const standing = buildStanding({
    personnel: (report.personnel ?? []).map((person: any) => ({
      saticiAdi: String(person.saticiAdi ?? ""),
      saticiKod: String(person.saticiKod ?? ""),
      branchLabel: String(person.branchLabel ?? ""),
      carpanliPuan: Number(person.carpanliPuan ?? 0),
      hedef: person.hedef === null || person.hedef === undefined ? null : Number(person.hedef),
      isManager: Boolean(person.isManager),
    })),
    stockByPerson: stockSalesByPerson(imeiRows, stockImeis),
    targetsByName,
    bonusPoints: config.bonusPoints,
    groups: config.groups,
  });

  const prizes = assignPrizes(standing, config.prizes);

  // Önkoşul: şirket toplam cihaz satışı, bir önceki ayın aynı günlerine göre
  let precondition: Record<string, unknown> = { required: config.preconditionPct, available: false };

  try {
    const prevFrom = shiftMonthBack(config.countFrom);
    const prevTo = shiftMonthBack(to);
    const previous: any = await computeAndSaveDegerPuanReport({ bastar: prevFrom, bittar: prevTo, skipSave: true });
    const current = countDeviceSales(report);
    const before = countDeviceSales(previous);
    const growth = before > 0 ? ((current - before) / before) * 100 : null;

    precondition = {
      required: config.preconditionPct,
      available: true,
      current,
      previous: before,
      previousRange: { from: prevFrom, to: prevTo },
      growthPct: growth,
      met: growth !== null ? growth >= config.preconditionPct : null,
    };
  } catch (error) {
    precondition = { required: config.preconditionPct, available: false, error: error instanceof Error ? error.message : String(error) };
  }

  const payload = {
    success: true,
    config,
    range: { from: config.countFrom, to },
    standing: standing.map((person) => ({ ...person })),
    prizes,
    precondition,
    stockDeviceCount: standing.reduce((sum, person) => sum + person.stokAdet, 0),
    unmatchedStockNote: null,
  };

  await pool.query(
    `INSERT INTO public.yarisma_results (league_id, kind, payload, computed_at) VALUES ($1, $2, $3::jsonb, now())
     ON CONFLICT (league_id, kind) DO UPDATE SET payload = EXCLUDED.payload, computed_at = now()`,
    [config.id, kind, JSON.stringify(payload)]
  );

  return { ...payload, computedAt: new Date().toISOString() };
}
