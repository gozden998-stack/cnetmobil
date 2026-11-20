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
  // Mağaza Müdürleri yarışması adalet çarpanı (küçük tabanlı mağaza yüzdede avantajlı olmasın):
  //   "karekok": çarpan = √(mağazanın 1-16 satışı ÷ 4 mağazanın ortalaması)  (önerilen, orta yol)
  //   "oransal": çarpan = mağazanın 1-16 satışı ÷ ortalama  (puan = mutlak artışla orantılı, büyük mağaza avantajlı)
  //   "yok": çarpan 1 (ham yüzde)
  mudurCarpan: "karekok" | "oransal" | "yok";
  // Son otomatik yayın günü (dahil). Bu günden sonra rapor yayınlanmaz; nihai sonucu yönetici açıklar.
  publishUntil: string;
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
  mudurCarpan: "karekok",
  publishUntil: "2026-11-28",
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
  // true: yalnız yarışmaya özel hedefler geçerli (Değer Puan hedefine DÖNÜLMEZ; tabloda olmayan kişi sıralamaya girmez)
  strictTargets?: boolean;
  // Hedefi tanımlı olup henüz satışı olmayan kişiler de listede 0 puanla görünsün
  extraPeople?: Array<{ saticiAdi: string; branchLabel: string }>;
}): StandingPerson[] {
  const people = new Map<string, StandingPerson>();

  const make = (saticiAdi: string, saticiKod: string, fallbackBranch: string, puan: number, engineHedef: number | null, engineManager: boolean) => {
    const target = pickTarget(input.targetsByName.get(normalizeName(saticiAdi)), fallbackBranch);
    const branchLabel = target?.branchLabel || fallbackBranch;
    const hedef = target ? target.hedef : input.strictTargets ? null : engineHedef;
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

  // Hedefi tanımlı ama hiç satışı olmayan kişiler de listede görünür (0 puan)
  for (const extra of input.extraPeople ?? []) {
    const key = personnelIdentityKey(extra.saticiAdi, "");

    if (!people.has(key)) people.set(key, make(extra.saticiAdi, "", extra.branchLabel, 0, null, false));
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
    // Mağaza müdürleri de sıralamaya girer (kullanıcı kararı); yalnız hedefi olmayan sıralanamaz.
    person.yuzde = person.hedef && person.hedef > 0 ? (person.toplamPuan / person.hedef) * 100 : null;
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

// Son otomatik yayın günü: ayın 28'i (publishUntil) ya da yarışma bitişinden sonraki gün, hangisi önceyse.
export function lastPublishDay(config: Pick<LeagueConfig, "endDate" | "publishUntil">): string {
  const closing = addDays(config.endDate, 1);

  return config.publishUntil && config.publishUntil < closing ? config.publishUntil : closing;
}

export function isAutoRunDayForLeague(todayIso: string, config: Pick<LeagueConfig, "startDate" | "endDate" | "publishUntil">): boolean {
  return todayIso >= addDays(config.startDate, 1) && todayIso <= lastPublishDay(config);
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
// MAĞAZA MÜDÜRLERİ YARIŞMASI (aynı tarihler, mağaza bazlı)
// ------------------------------------------------------------------
// Kural (kullanıcı): her mağazanın 1-16 Kasım cihaz satışı toplamı (1.el + 2.el + stok cihaz) ile 17-30 Kasım toplamı
// kıyaslanır; oran = 17-30 toplamı ÷ 1-16 toplamı. Yüzdesel olarak en çok artıran mağazanın müdürü kazanır:
// 1. mağaza müdürü 1 gram altın, 2. mağaza müdürü 2000 TL. Önkoşul: şirket toplam cihaz satışı +%15 (aynı oranla).
// Bir satış tek sayılır (hem 2.el sınıfında hem stok cihaz olsa da 1). İade satırı bir düşer.

// Kullanıcının Excel'i: "1.EL & 2.EL & 1 EL TABLET Miktar" (adet toplamı, satır sayısı değil)
export const MANAGER_DEVICE_CLASSES = new Set(["1el", "2el", "1eltablet"]);

export const MANAGER_PRIZES: Array<{ rank: number; label: string }> = [
  { rank: 1, label: "1 gram altın" },
  { rank: 2, label: "2000 TL" },
];

export function countDeviceSalesByBranch(rows: ImeiSaleRow[], stockImeis: Set<string>): Map<string, number> {
  const out = new Map<string, number>();

  for (const row of rows) {
    const isDevice = MANAGER_DEVICE_CLASSES.has(fold(row.malSinif)) || row.imeis.some((imei) => stockImeis.has(imei));

    if (!isDevice) continue;

    // Miktar (adet) toplanır; iade satırı aynı miktarı düşer
    const quantity = Number.isFinite(row.miktar) && row.miktar > 0 ? row.miktar : 1;

    out.set(row.branchLabel, (out.get(row.branchLabel) ?? 0) + (row.isReturn ? -quantity : quantity));
  }

  return out;
}

export type ManagerRow = {
  branchLabel: string;
  managers: string[];
  baseline: number; // 1-16 Kasım toplamı
  current: number; // 17-30 Kasım toplamı (bugüne kadar)
  ratioPct: number | null; // current ÷ baseline × 100
  dailyRatioPct: number | null; // bilgi: günlük ortalamalar oranı
  carpan: number | null; // adalet çarpanı (tabana göre)
  puan: number | null; // (oran - 100) × çarpan: sıralama puanı
  siralama: number | null;
};

export type ManagerCarpanMode = LeagueConfig["mudurCarpan"];

// Adalet çarpanı: küçük tabanlı mağazanın aynı yüzdesi daha az, büyük tabanlı mağazanınki daha çok sayılır.
export function managerMultiplier(baseline: number, avgBaseline: number, mode: ManagerCarpanMode): number {
  if (mode === "yok" || avgBaseline <= 0 || baseline <= 0) return 1;

  const ratio = baseline / avgBaseline;

  return mode === "oransal" ? ratio : Math.sqrt(ratio);
}

export function buildManagerStanding(input: {
  branches: string[];
  baseline: Map<string, number>;
  current: Map<string, number>;
  managersByBranch: Map<string, string[]>;
  baselineDays: number;
  currentDays: number;
  carpanMode?: ManagerCarpanMode;
}): ManagerRow[] {
  const mode: ManagerCarpanMode = input.carpanMode ?? "karekok";
  const baselines = input.branches.map((branchLabel) => Math.max(0, input.baseline.get(branchLabel) ?? 0)).filter((value) => value > 0);
  const avgBaseline = baselines.length ? baselines.reduce((sum, value) => sum + value, 0) / baselines.length : 0;
  const rows: ManagerRow[] = input.branches.map((branchLabel) => {
    const baseline = Math.max(0, input.baseline.get(branchLabel) ?? 0);
    const current = Math.max(0, input.current.get(branchLabel) ?? 0);

    return {
      branchLabel,
      managers: input.managersByBranch.get(normalizeName(branchLabel)) ?? [],
      baseline,
      current,
      ratioPct: baseline > 0 ? (current / baseline) * 100 : null,
      dailyRatioPct: baseline > 0 && input.baselineDays > 0 && input.currentDays > 0 ? (current / input.currentDays / (baseline / input.baselineDays)) * 100 : null,
      carpan: baseline > 0 ? managerMultiplier(baseline, avgBaseline, mode) : null,
      puan: null,
      siralama: null,
    };
  });

  for (const row of rows) {
    row.puan = row.ratioPct !== null && row.carpan !== null ? (row.ratioPct - 100) * row.carpan : null;
  }

  const ranked = rows.filter((row) => row.puan !== null).sort((a, b) => (b.puan ?? 0) - (a.puan ?? 0) || b.current - a.current);

  ranked.forEach((row, index) => {
    row.siralama = index + 1;
  });

  return rows.sort((a, b) => {
    if (a.siralama !== null && b.siralama !== null) return a.siralama - b.siralama;
    if (a.siralama !== null) return -1;
    if (b.siralama !== null) return 1;

    return b.current - a.current;
  });
}

export function assignManagerPrizes(rows: ManagerRow[], prizes = MANAGER_PRIZES) {
  const ranked = rows.filter((row) => row.siralama !== null);

  return prizes.map((prize, index) => ({
    rank: prize.rank,
    label: prize.label,
    branchLabel: ranked[index]?.branchLabel ?? null,
    winner: ranked[index] ? ranked[index].managers.join(", ") || "Müdür tanımlı değil" : null,
  }));
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

  // Yarışmaya özel kişi hedefleri (Değer Puan hedeflerinden bağımsız; yönetici ekranından girilir)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.yarisma_targets (
      league_id TEXT NOT NULL,
      name_key TEXT NOT NULL,
      satici_adi TEXT NOT NULL,
      branch_label TEXT NOT NULL,
      target_value NUMERIC(14,2) NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (league_id, name_key)
    )
  `);

  // Gün gün YAYINLANAN raporlar (mağazalar gün seçiciyle geçmiş günleri görür). Yalnız otomatik 12:30 "yayın" sonuçları yazılır.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.yarisma_history (
      league_id TEXT NOT NULL,
      publish_date DATE NOT NULL,
      payload JSONB NOT NULL,
      computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (league_id, publish_date)
    )
  `);

  // Tek seferlik/idempotent: önceden yayınlanmış son sonuç, yayınlandığı günün raporu olarak arşive alınır.
  await pool.query(`
    INSERT INTO public.yarisma_history (league_id, publish_date, payload, computed_at)
    SELECT league_id, (computed_at AT TIME ZONE 'Europe/Istanbul')::date, payload, computed_at
    FROM public.yarisma_results WHERE kind = 'yayin'
    ON CONFLICT (league_id, publish_date) DO NOTHING
  `);

  tablesReady = true;
}

// Bir YAYIN gününde (Türkiye tarihi) yayınlanan rapor (yoksa null).
export async function getPublishedForDay(pool: Pool, id: string, gun: string) {
  await ensureYarismaTables(pool);

  const row = (await pool.query(`SELECT payload, computed_at FROM public.yarisma_history WHERE league_id = $1 AND publish_date = $2::date`, [id, gun])).rows[0];

  return row ? { ...(row.payload as Record<string, unknown>), computedAt: row.computed_at } : null;
}

async function archivePublished(pool: Pool, id: string, payload: unknown) {
  await pool.query(
    `INSERT INTO public.yarisma_history (league_id, publish_date, payload, computed_at) VALUES ($1, $2::date, $3::jsonb, now())
     ON CONFLICT (league_id, publish_date) DO UPDATE SET payload = EXCLUDED.payload, computed_at = now()`,
    [id, todayInTurkey(), JSON.stringify(payload)]
  );
}

// ------------------------------------------------------------------
// YARIŞMAYA ÖZEL KİŞİ HEDEFLERİ
// ------------------------------------------------------------------

export type YarismaTarget = { saticiAdi: string; branchLabel: string; hedef: number };

export async function getYarismaTargets(pool: Pool, leagueId: string): Promise<YarismaTarget[]> {
  await ensureYarismaTables(pool);

  const result = await pool.query(
    `SELECT satici_adi, branch_label, target_value FROM public.yarisma_targets WHERE league_id = $1 ORDER BY branch_label, satici_adi`,
    [leagueId]
  );

  return result.rows.map((row) => ({ saticiAdi: String(row.satici_adi), branchLabel: String(row.branch_label), hedef: Number(row.target_value) }));
}

// Değer Puan hedefleri (başlangıç listesi olarak önerilir; ad WingSM satıcı adıyla zaten eşleşir)
export async function getDegerPuanTargets(pool: Pool, period: string): Promise<YarismaTarget[]> {
  try {
    const result = await pool.query(
      `SELECT satici_adi, branch_label, target_value FROM public.wingsm_personnel_targets WHERE period = $1 AND active = true ORDER BY branch_label, satici_adi`,
      [period]
    );

    return result.rows.map((row) => ({ saticiAdi: String(row.satici_adi), branchLabel: String(row.branch_label), hedef: Number(row.target_value) }));
  } catch {
    return [];
  }
}

const STORE_LABELS_FOR_TARGETS = ["CMR MERKEZ", "CMR CADDE", "CMR SARAY", "CMR KAPAKLI"];

export function validateTargets(raw: unknown): { ok: true; rows: YarismaTarget[] } | { ok: false; error: string } {
  if (!Array.isArray(raw)) return { ok: false, error: "Hedef listesi geçersiz." };
  if (raw.length > 300) return { ok: false, error: "En fazla 300 kişi girilebilir." };

  const seen = new Set<string>();
  const rows: YarismaTarget[] = [];

  for (const item of raw as any[]) {
    const saticiAdi = String(item?.saticiAdi ?? "").trim().replace(/\s+/g, " ");
    const branch = STORE_LABELS_FOR_TARGETS.find((label) => normalizeName(label) === normalizeName(String(item?.branchLabel ?? "")));
    const hedef = Number(item?.hedef);

    if (!saticiAdi || saticiAdi.length > 100) return { ok: false, error: "Her satırda kişi adı olmalı (en fazla 100 karakter)." };
    if (!branch) return { ok: false, error: `"${saticiAdi}" için mağaza seçilmeli (CMR MERKEZ, CADDE, SARAY, KAPAKLI).` };
    if (!Number.isFinite(hedef) || hedef < 0 || hedef > 1_000_000) return { ok: false, error: `"${saticiAdi}" için hedef 0 ile 1.000.000 arasında bir sayı olmalı.` };

    const key = normalizeName(saticiAdi);

    if (seen.has(key)) return { ok: false, error: `"${saticiAdi}" listede birden fazla kez var.` };

    seen.add(key);
    rows.push({ saticiAdi, branchLabel: branch, hedef });
  }

  return { ok: true, rows };
}

// Listeyi TAMAMEN değiştirir (boş liste = yarışma hedefi yok, Değer Puan hedeflerine dönülür).
export async function saveYarismaTargets(pool: Pool, leagueId: string, rows: YarismaTarget[]) {
  await ensureYarismaTables(pool);

  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query(`DELETE FROM public.yarisma_targets WHERE league_id = $1`, [leagueId]);

    for (const row of rows) {
      await client.query(
        `INSERT INTO public.yarisma_targets (league_id, name_key, satici_adi, branch_label, target_value) VALUES ($1, $2, $3, $4, $5)`,
        [leagueId, normalizeName(row.saticiAdi), row.saticiAdi, row.branchLabel, row.hedef]
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);

    throw error;
  } finally {
    client.release();
  }
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

  // Hedef kaynağı: yarışmaya özel hedefler tanımlıysa YALNIZ onlar; tanımlı değilse Değer Puan hedefleri.
  const customTargets = await getYarismaTargets(pool, config.id);
  const targetSource: "yarisma" | "degerpuan" = customTargets.length > 0 ? "yarisma" : "degerpuan";

  if (targetSource === "yarisma") {
    for (const target of customTargets) {
      targetsByName.set(normalizeName(target.saticiAdi), [{ branchLabel: target.branchLabel, hedef: target.hedef, isManager: false }]);
    }
  } else {
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
    strictTargets: targetSource === "yarisma",
    extraPeople: targetSource === "yarisma" ? customTargets.map((target) => ({ saticiAdi: target.saticiAdi, branchLabel: target.branchLabel })) : [],
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
    targetSource,
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

  // Otomatik yayın: o günün raporu arşive de yazılır (gün seçici için)
  if (kind === "yayin") await archivePublished(pool, config.id, payload);

  return { ...payload, computedAt: new Date().toISOString() };
}

// ------------------------------------------------------------------
// MAĞAZA MÜDÜRLERİ YARIŞMASI HESABI
// ------------------------------------------------------------------

const CMR_STORE_LABELS = ["CMR MERKEZ", "CMR CADDE", "CMR SARAY", "CMR KAPAKLI"];

function daysInclusive(from: string, to: string): number {
  return Math.max(0, Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1);
}

export const mudurLeagueId = (config: Pick<LeagueConfig, "id">) => `${config.id}-mudur`;

// 1-16 Kasım (başlangıç öncesi) ile 17-30 Kasım karşılaştırması. Sonucu `${id}-mudur` altında kaydeder (kind: test | yayin).
export async function computeManagerLeague(pool: Pool, config: LeagueConfig, kind: ResultKind = "test") {
  await ensureYarismaTables(pool);

  const monthStart = `${config.startDate.slice(0, 7)}-01`;
  const baselineTo = addDays(config.startDate, -1);
  const yesterday = addDays(todayInTurkey(), -1);
  const to = yesterday < config.endDate ? yesterday : config.endDate;

  if (to < config.startDate) {
    return { success: true, empty: true, message: "Henüz sayılacak gün yok (rapor dünün verisine kadar hesaplanır).", range: { from: config.startDate, to } };
  }

  const hasBaseline = baselineTo >= monthStart;
  const [baseReport, curReport]: any[] = await Promise.all([
    hasBaseline ? computeAndSaveDegerPuanReport({ bastar: monthStart, bittar: baselineTo, skipSave: true, collectImeis: true }) : Promise.resolve({ imeiRows: [] }),
    computeAndSaveDegerPuanReport({ bastar: config.startDate, bittar: to, skipSave: true, collectImeis: true }),
  ]);

  const baseRows: ImeiSaleRow[] = Array.isArray(baseReport?.imeiRows) ? baseReport.imeiRows : [];
  const curRows: ImeiSaleRow[] = Array.isArray(curReport?.imeiRows) ? curReport.imeiRows : [];
  const allImeis = Array.from(new Set([...baseRows, ...curRows].flatMap((row) => row.imeis)));
  const stockImeis = new Set<string>(
    allImeis.length ? (await pool.query(`SELECT imei FROM public.stock_devices WHERE imei = ANY($1::text[])`, [allImeis])).rows.map((row) => String(row.imei)) : []
  );

  // Mağaza müdürleri: Hedefler tablosunda "müdür" işaretli kişiler (mağazaya göre)
  const managersByBranch = new Map<string, string[]>();

  try {
    const managerRows = await pool.query(`SELECT branch_label, satici_adi FROM public.wingsm_personnel_targets WHERE period = $1 AND active = true AND is_manager = true`, [config.startDate.slice(0, 7)]);

    for (const row of managerRows.rows) {
      const key = normalizeName(String(row.branch_label));
      const list = managersByBranch.get(key) ?? [];

      list.push(String(row.satici_adi));
      managersByBranch.set(key, list);
    }
  } catch {
    // Hedef tablosu yoksa müdür adı boş kalır
  }

  const baselineCounts = countDeviceSalesByBranch(baseRows, stockImeis);
  const currentCounts = countDeviceSalesByBranch(curRows, stockImeis);

  const standing = buildManagerStanding({
    branches: CMR_STORE_LABELS,
    baseline: baselineCounts,
    current: currentCounts,
    managersByBranch,
    baselineDays: hasBaseline ? daysInclusive(monthStart, baselineTo) : 0,
    currentDays: daysInclusive(config.startDate, to),
    carpanMode: config.mudurCarpan,
  });
  const prizes = assignManagerPrizes(standing);

  // Önkoşul: şirket toplamı, aynı 1-16 / 17-30 oranıyla
  const totalBase = standing.reduce((sum, row) => sum + row.baseline, 0);
  const totalCur = standing.reduce((sum, row) => sum + row.current, 0);
  const ratio = totalBase > 0 ? (totalCur / totalBase) * 100 : null;
  const precondition = {
    required: config.preconditionPct,
    available: ratio !== null,
    baseline: totalBase,
    current: totalCur,
    ratioPct: ratio,
    growthPct: ratio === null ? null : ratio - 100,
    met: ratio === null ? null : ratio - 100 >= config.preconditionPct,
  };

  const payload = {
    success: true,
    title: "Şampiyonlar Ligi Mağaza Müdürleri Yarışması",
    carpanMode: config.mudurCarpan ?? "karekok",
    baselineRange: hasBaseline ? { from: monthStart, to: baselineTo } : null,
    range: { from: config.startDate, to },
    rows: standing,
    prizes,
    precondition,
  };

  await pool.query(
    `INSERT INTO public.yarisma_results (league_id, kind, payload, computed_at) VALUES ($1, $2, $3::jsonb, now())
     ON CONFLICT (league_id, kind) DO UPDATE SET payload = EXCLUDED.payload, computed_at = now()`,
    [mudurLeagueId(config), kind, JSON.stringify(payload)]
  );

  if (kind === "yayin") await archivePublished(pool, mudurLeagueId(config), payload);

  return { ...payload, computedAt: new Date().toISOString() };
}
