// app/api/wingsm/vodafone/yarisma/_vyarisma.ts
//
// CNETMOBIL - Vodafone kanalı "Şampiyonlar Ligi" yarışması (Kasım 2026)
//
// Kurallar (kullanıcının duyurusu + açıklamaları):
//  - Puan kalemleri (kişi bazlı):
//      GROSS  = Vodafone mağazalarında, sınıfı 5AK olan satırlardan ürün adında FATURALI / RED / KONTÖRLÜ geçenler   -> 1 puan
//      BAZ    = sınıfı 5AK olan satırlardan ürün adında MCCM geçenler                                                -> 0,5 puan
//      TEKİL  = WingSM TEMLİKLİ satış listesindeki TÜM 1el (sıfır cihaz) satırları                                  -> 2,5 puan
//      SAMSUNG TEKİL          = o satırlardan ürünü Samsung olanlar, tekil puanına EK                               -> +1,5 puan
//      SAMSUNG PREMIUM TEKİL  = Samsung S serisi / Fold / Flip olanlar (Samsung sayılır), ayrıca EK                  -> +1 puan
//    (Kalemler İÇ İÇE — kullanıcı kararı: Samsung premium cihaz = 2,5 + 1,5 + 1 = 5; diğer Samsung 4; Samsung olmayan 2,5.)
//  - ÇARPAN: mağaza bazlı, yönetici elle girer (son 3 aylık Değer Puan oranı vb. hesabı yöneticinin; sistem hesaplamaz).
//    Kişinin puanı = Σ (mağazadaki ham puanı × o mağazanın çarpanı). Girilmeyen mağazanın çarpanı 1 sayılır (uyarı gösterilir).
//  - Sıralama: çarpanlı toplam puan. HEDEF YOK (kullanıcı kararı): kişi hedefi ya da Değer Puan hedefi hiçbir yerden okunmaz.
//  - Ödüller: 1. 1 gr altın +5 bireysel puan, 2. 1/2 gr altın +3, 3. 1/4 gr altın +1, 4. 500 TL, 5. 250 TL.
//  - Önkoşullar: 1. ve 2. FARKLI mağazadan olmalı; ilk 5 ödül en az 3 FARKLI mağazaya gitmeli. Kural bozuluyorsa ödül kayar
//    (2. ödül, 1.'den sonra gelen ilk farklı mağazadaki kişiye; 3 mağaza dolmadıysa 5. ödül, sıralamada kalan en iyi
//    farklı-mağaza kişisine geçer). Genel sıralama değişmez; kayma notu görünür.
//
// Hesap resmi Vodafone Değer Puan kayıtlarına DOKUNMAZ; WingSM'e hiçbir şey yazılmaz.
// Sonuçlar CMR yarışmasının tablolarında ayrı lig kimliğiyle (vdf-2026-11) tutulur.
// Bu dosya "_" ile başladığı için Next.js tarafından route sayılmaz.

import type { Pool } from "pg";

import { toWingsmDate } from "../../_deger-puan-compute";
import { normalizeName, personnelIdentityKey } from "../../_deger-puan-personnel";
import { addDays, archivePublished, assignManagerPrizes, buildManagerStanding, ensureYarismaTables, todayInTurkey, type ManagerRow } from "../../yarisma/_yarisma";
import { VODAFONE_DEPOTS, fetchDepotLists, loadTargets, normalizeClass } from "../_vodafone";

export type VdfPoints = { gross: number; baz: number; tekil: number; samsung: number; premium: number };

export type VdfLeagueConfig = {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  countFrom: string;
  publishUntil: string; // son otomatik yayın günü (dahil)
  points: VdfPoints;
  prizes: Array<{ rank: number; label: string }>;
  carpan: Record<string, number>; // mağaza etiketi -> çarpan (yönetici girer)
};

export const VDF_DEFAULT_LEAGUE: VdfLeagueConfig = {
  id: "vdf-2026-11",
  title: "Vodafone Kasım 2026 Şampiyonlar Ligi",
  startDate: "2026-11-17",
  endDate: "2026-11-30",
  countFrom: "2026-11-17",
  publishUntil: "2026-11-28",
  points: { gross: 1, baz: 0.5, tekil: 2.5, samsung: 1.5, premium: 1 },
  prizes: [
    { rank: 1, label: "1 gram altın + 5 bireysel puan" },
    { rank: 2, label: "1/2 gram altın + 3 bireysel puan" },
    { rank: 3, label: "1/4 gram altın + 1 bireysel puan" },
    { rank: 4, label: "500 TL" },
    { rank: 5, label: "250 TL" },
  ],
  carpan: {},
};

// ------------------------------------------------------------------
// SAF FONKSİYONLAR (test edilebilir)
// ------------------------------------------------------------------

// Türkçe karakterleri sadeleştirip küçük harfe çevirir ("KONTÖRLÜ" -> "kontorlu").
export function foldTr(value: unknown): string {
  return String(value ?? "")
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g")
    .replace(/\s+/g, " ")
    .trim();
}

export type Kalem = "gross" | "baz" | "tekil" | "samsung" | "premium";

// 5AK satırı: MCCM -> baz; FATURALI / RED / KONTÖRLÜ -> gross; ikisi de değilse null (tanı listesine düşer).
export function classify5ak(malAd: unknown): "gross" | "baz" | null {
  const name = foldTr(malAd);

  if (/mccm/.test(name)) return "baz";
  if (/faturali|kontorlu/.test(name) || /(^|[^a-z0-9])red([^a-z0-9]|$)/.test(name)) return "gross";

  return null;
}

// Temlikli 1el satırı: premium (Samsung S / Fold / Flip) > Samsung > diğer.
export function classifyTekil(malAd: unknown): "premium" | "samsung" | "tekil" {
  const name = foldTr(malAd);
  const samsung = /samsung|galaxy/.test(name);

  if (!samsung) return "tekil";

  const premium = /(^|[^a-z0-9])s ?\d{2}(?![0-9])/.test(name) || /fold|flip/.test(name);

  return premium ? "premium" : "samsung";
}

export type VdfSaleList = { depotCode: string; branchLabel: string; liste: Array<Record<string, unknown>>; temlik: Array<Record<string, unknown>> };

export type VdfPerson = {
  saticiAdi: string;
  saticiKod: string;
  branchLabel: string; // en çok ham puan yaptığı mağaza
  gross: number;
  baz: number;
  tekil: number;
  samsung: number;
  premium: number;
  ham: number; // çarpansız toplam
  puan: number; // çarpanlı toplam (sıralama ölçütü)
  carpan: number; // etkin çarpan (puan ÷ ham)
  magazalar: Array<{ branchLabel: string; ham: number; carpan: number }>;
  siralama: number | null;
};

export type VdfDiagnostics = {
  gross5akRows: number;
  baz5akRows: number;
  unmatched5akRows: number;
  unmatched5akExamples: string[];
  temlikRows: number;
  temlik1elRows: number;
  temlikOtherClassRows: number;
  temlikOtherClassExamples: string[];
};

function qtyOf(row: Record<string, unknown>): number {
  const q = Number(row.MalMiktarI);

  return Number.isFinite(q) && q !== 0 ? q : 1;
}

const round2 = (value: number) => Math.round(value * 100) / 100;

export function buildVdfStanding(input: { sales: VdfSaleList[]; points: VdfPoints; carpan: Record<string, number> }): { standing: VdfPerson[]; diagnostics: VdfDiagnostics; carpanEksik: string[] } {
  type Agg = { saticiAdi: string; saticiKod: string; perBranch: Map<string, Record<Kalem, number>> };

  const people = new Map<string, Agg>();
  const diagnostics: VdfDiagnostics = {
    gross5akRows: 0,
    baz5akRows: 0,
    unmatched5akRows: 0,
    unmatched5akExamples: [],
    temlikRows: 0,
    temlik1elRows: 0,
    temlikOtherClassRows: 0,
    temlikOtherClassExamples: [],
  };

  const add = (row: Record<string, unknown>, branchLabel: string, kalem: Kalem, amount: number) => {
    const saticiKod = String(row.SaticiKod ?? "").trim();
    const saticiAdi = String(row.SaticiAdI ?? "").trim();
    const key = personnelIdentityKey(saticiAdi, saticiKod);
    const agg = people.get(key) ?? { saticiAdi, saticiKod, perBranch: new Map() };
    const counts = agg.perBranch.get(branchLabel) ?? { gross: 0, baz: 0, tekil: 0, samsung: 0, premium: 0 };

    counts[kalem] += amount;
    agg.perBranch.set(branchLabel, counts);
    people.set(key, agg);
  };

  for (const depot of input.sales) {
    for (const row of depot.liste) {
      if (normalizeClass(row.MalSinif) !== "5AK") continue;

      const kalem = classify5ak(row.MalAd);
      const sign = qtyOf(row) < 0 ? -1 : 1; // 5AK satırı: satır başına 1 (iade -1)

      if (!kalem) {
        diagnostics.unmatched5akRows += 1;
        if (diagnostics.unmatched5akExamples.length < 10) diagnostics.unmatched5akExamples.push(String(row.MalAd ?? ""));
        continue;
      }

      if (kalem === "gross") diagnostics.gross5akRows += 1;
      else diagnostics.baz5akRows += 1;

      add(row, depot.branchLabel, kalem, sign);
    }

    for (const row of depot.temlik) {
      diagnostics.temlikRows += 1;

      if (foldTr(normalizeClass(row.MalSinif)) !== "1el") {
        diagnostics.temlikOtherClassRows += 1;
        if (diagnostics.temlikOtherClassExamples.length < 10) diagnostics.temlikOtherClassExamples.push(`${String(row.MalSinif ?? "")}: ${String(row.MalAd ?? "")}`);
        continue;
      }

      diagnostics.temlik1elRows += 1;
      // İç içe sayım: her temlikli 1el cihaz "tekil"dir; Samsung ise ayrıca "samsung" (ek puan); premium ise ayrıca "premium" (ek puan).
      const kind = classifyTekil(row.MalAd);
      const qty = qtyOf(row);

      add(row, depot.branchLabel, "tekil", qty);
      if (kind !== "tekil") add(row, depot.branchLabel, "samsung", qty);
      if (kind === "premium") add(row, depot.branchLabel, "premium", qty);
    }
  }

  const carpanOf = (branchLabel: string) => {
    const value = Number(input.carpan[branchLabel]);

    return Number.isFinite(value) && value > 0 ? value : 1;
  };

  const standing: VdfPerson[] = Array.from(people.values()).map((agg) => {
    const totals: Record<Kalem, number> = { gross: 0, baz: 0, tekil: 0, samsung: 0, premium: 0 };
    const magazalar: VdfPerson["magazalar"] = [];

    for (const [branchLabel, counts] of agg.perBranch) {
      const ham = counts.gross * input.points.gross + counts.baz * input.points.baz + counts.tekil * input.points.tekil + counts.samsung * input.points.samsung + counts.premium * input.points.premium;

      for (const kalem of Object.keys(totals) as Kalem[]) totals[kalem] += counts[kalem];
      magazalar.push({ branchLabel, ham: round2(ham), carpan: carpanOf(branchLabel) });
    }

    magazalar.sort((a, b) => b.ham - a.ham);

    const ham = magazalar.reduce((sum, item) => sum + item.ham, 0);
    const puan = magazalar.reduce((sum, item) => sum + item.ham * item.carpan, 0);

    return {
      saticiAdi: agg.saticiAdi,
      saticiKod: agg.saticiKod,
      branchLabel: magazalar[0]?.branchLabel ?? "",
      ...totals,
      ham: round2(ham),
      puan: round2(puan),
      carpan: ham > 0 ? round2(puan / ham) : 1,
      magazalar,
      siralama: null,
    };
  });

  const ranked = standing.filter((person) => person.puan > 0).sort((a, b) => b.puan - a.puan || b.ham - a.ham || a.saticiAdi.localeCompare(b.saticiAdi, "tr-TR"));

  ranked.forEach((person, index) => {
    person.siralama = index + 1;
  });

  standing.sort((a, b) => {
    if (a.siralama !== null && b.siralama !== null) return a.siralama - b.siralama;
    if (a.siralama !== null) return -1;
    if (b.siralama !== null) return 1;

    return b.puan - a.puan;
  });

  const carpanEksik = input.sales.map((depot) => depot.branchLabel).filter((label) => !(Number(input.carpan[label]) > 0));

  return { standing, diagnostics, carpanEksik };
}

export type VdfPrizeResult = { rank: number; label: string; winner: string | null; siralama: number | null; branchLabel: string | null; note: string | null };

// Ödül dağılımı: 1. ve 2. farklı mağaza; ödül alan ilk 5 kişide en az 3 farklı mağaza (kural açıklaması dosya başında).
export function assignVdfPrizes(standing: VdfPerson[], prizes: VdfLeagueConfig["prizes"]): VdfPrizeResult[] {
  const ranked = standing.filter((person) => person.siralama !== null);
  const used = new Set<VdfPerson>();
  const slots: Array<VdfPerson | null> = prizes.map(() => null);
  const notes: Array<string | null> = prizes.map(() => null);
  const store = (person: VdfPerson) => String(person.branchLabel ?? "").trim().toLocaleUpperCase("tr-TR");

  const first = ranked[0] ?? null;

  if (first) {
    slots[0] = first;
    used.add(first);
  }

  if (first && prizes.length > 1) {
    const other = ranked.find((person) => !used.has(person) && store(person) !== store(first)) ?? null;

    if (other) {
      slots[1] = other;
      used.add(other);

      if (other.siralama !== 2) notes[1] = `Mağaza kuralı: 1. ile aynı mağazadan (${first.branchLabel}) olmayan ilk kişi, genel sıralamada ${other.siralama}.`;
    } else {
      const next = ranked.find((person) => !used.has(person)) ?? null;

      if (next) {
        slots[1] = next;
        used.add(next);
        notes[1] = "Farklı mağazadan kişi bulunamadı; genel sıraya göre verildi (kontrol edin).";
      }
    }
  }

  // Kalan ödüller: genel sırayla, atlananlar dahil
  for (let index = 2; index < prizes.length; index += 1) {
    const next = ranked.find((person) => !used.has(person)) ?? null;

    if (next) {
      slots[index] = next;
      used.add(next);

      if (next.siralama !== index + 1) notes[index] = `Genel sıralamada ${next.siralama}. (ödül kaydırması nedeniyle)`;
    }
  }

  // En az 3 farklı mağaza: 1. ve 2. farklı olduğundan en çok bir değişiklik gerekir; 5. (en alttaki) ödül,
  // henüz ödülü olmayan, ödüllü mağazalardan farklı ilk kişiye geçer; ödüller genel sıralama sırasına göre yeniden dizilir.
  const MIN_STORES = 3;
  const filled = slots.filter((person): person is VdfPerson => person !== null);
  const distinct = new Set(filled.map(store));

  if (slots.length >= MIN_STORES && filled.length === slots.length && distinct.size < MIN_STORES && slots.length > 2) {
    const newcomer = ranked.find((person) => !used.has(person) && !distinct.has(store(person))) ?? null;

    if (newcomer) {
      const lastIndex = slots.length - 1;
      const dropped = slots[lastIndex]!;

      slots[lastIndex] = newcomer;
      used.add(newcomer);

      // 3. ödülden sonrasını genel sıralamaya göre yeniden diz (ödüller sıralı gitsin)
      const tail = slots.slice(2).filter((person): person is VdfPerson => person !== null).sort((a, b) => (a.siralama ?? 0) - (b.siralama ?? 0));

      tail.forEach((person, offset) => {
        slots[2 + offset] = person;
        notes[2 + offset] = person.siralama !== 3 + offset ? `Genel sıralamada ${person.siralama}. (ödül kaydırması nedeniyle)` : null;
      });

      const newcomerIndex = slots.indexOf(newcomer);

      notes[newcomerIndex] = `${notes[newcomerIndex] ? `${notes[newcomerIndex]} ` : ""}3 farklı mağaza kuralı: ${dropped.saticiAdi} (${dropped.siralama}.) yerine, ödüllü olmayan farklı mağaza kişisi.`.trim();
    }
  }

  return prizes.map((prize, index) => ({
    rank: prize.rank,
    label: prize.label,
    winner: slots[index]?.saticiAdi ?? null,
    siralama: slots[index]?.siralama ?? null,
    branchLabel: slots[index]?.branchLabel ?? null,
    note: notes[index],
  }));
}

// Mağaza girişlerine giden SADELEŞTİRİLMİŞ görünüm: yalnız sıralamaya girenler; satıcı kodu ve tanı verisi yok.
export function toVdfStoreView(result: Record<string, any>) {
  const standing: any[] = Array.isArray(result.standing) ? result.standing : [];

  return {
    success: true,
    hasResult: true,
    config: { title: result.config?.title, startDate: result.config?.startDate, endDate: result.config?.endDate, points: result.config?.points },
    range: result.range,
    computedAt: result.computedAt,
    prizes: result.prizes,
    carpan: result.carpanListesi ?? {},
    standing: standing
      .filter((person) => person.siralama !== null && person.siralama !== undefined)
      .map((person) => ({
        siralama: person.siralama,
        saticiAdi: person.saticiAdi,
        branchLabel: person.branchLabel,
        gross: person.gross,
        baz: person.baz,
        tekil: person.tekil,
        samsung: person.samsung,
        premium: person.premium,
        ham: person.ham,
        carpan: person.carpan,
        puan: person.puan,
      })),
  };
}

// ------------------------------------------------------------------
// YAYIN GÜNLERİ
// ------------------------------------------------------------------

export function vdfLastPublishDay(config: Pick<VdfLeagueConfig, "endDate" | "publishUntil">): string {
  const closing = addDays(config.endDate, 1);

  return config.publishUntil && config.publishUntil < closing ? config.publishUntil : closing;
}

export function vdfIsAutoRunDay(todayIso: string, config: Pick<VdfLeagueConfig, "startDate" | "endDate" | "publishUntil">): boolean {
  return todayIso >= addDays(config.startDate, 1) && todayIso <= vdfLastPublishDay(config);
}

// ------------------------------------------------------------------
// AYAR + HESAP
// ------------------------------------------------------------------

export function sanitizeCarpan(raw: unknown): { ok: true; value: Record<string, number> } | { ok: false; error: string } {
  const data = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const value: Record<string, number> = {};

  for (const depot of VODAFONE_DEPOTS) {
    const entry = data[depot.branchLabel];

    if (entry === undefined || entry === null || String(entry).trim() === "") continue;

    const number = Number(String(entry).replace(",", "."));

    if (!Number.isFinite(number) || number <= 0 || number > 100) return { ok: false, error: `${depot.branchLabel} çarpanı 0'dan büyük, en çok 100 olan bir sayı olmalı.` };

    value[depot.branchLabel] = Math.round(number * 10000) / 10000;
  }

  return { ok: true, value };
}

export async function getVdfConfig(pool: Pool): Promise<VdfLeagueConfig> {
  await ensureYarismaTables(pool);

  const row = (await pool.query(`SELECT config FROM public.yarisma_leagues WHERE id = $1`, [VDF_DEFAULT_LEAGUE.id])).rows[0];

  if (!row) {
    await pool.query(`INSERT INTO public.yarisma_leagues (id, config) VALUES ($1, $2::jsonb) ON CONFLICT (id) DO NOTHING`, [VDF_DEFAULT_LEAGUE.id, JSON.stringify(VDF_DEFAULT_LEAGUE)]);

    return VDF_DEFAULT_LEAGUE;
  }

  const stored = row.config as Partial<VdfLeagueConfig>;

  return { ...VDF_DEFAULT_LEAGUE, ...stored, points: { ...VDF_DEFAULT_LEAGUE.points, ...(stored.points ?? {}) }, carpan: stored.carpan ?? {} };
}

export async function saveVdfConfig(pool: Pool, config: VdfLeagueConfig) {
  await ensureYarismaTables(pool);
  await pool.query(
    `INSERT INTO public.yarisma_leagues (id, config, updated_at) VALUES ($1, $2::jsonb, now())
     ON CONFLICT (id) DO UPDATE SET config = EXCLUDED.config, updated_at = now()`,
    [config.id, JSON.stringify(config)]
  );
}

export type VdfResultKind = "yayin" | "test";

// Aralığı (countFrom .. dün) WingSM'den okuyup yarışmayı hesaplar ve kaydeder. kind 'test' mağazalara görünmez.
export async function computeVdfLeague(pool: Pool, config: VdfLeagueConfig, kind: VdfResultKind = "test", fetcher: typeof fetchDepotLists = fetchDepotLists) {
  await ensureYarismaTables(pool);

  const yesterday = addDays(todayInTurkey(), -1);
  const to = yesterday < config.endDate ? yesterday : config.endDate;

  if (to < config.countFrom) {
    return { success: true, empty: true, message: "Henüz sayılacak gün yok (rapor dünün verisine kadar hesaplanır).", config, range: { from: config.countFrom, to } };
  }

  const tarih = toWingsmDate(config.countFrom);
  const tarih2 = toWingsmDate(to);

  // Eksik veriyle yanlış sıralama yayınlamamak için bir depo bile okunamazsa tüm hesap durur.
  const sales: VdfSaleList[] = await Promise.all(
    VODAFONE_DEPOTS.map(async ({ depotCode, branchLabel }) => {
      try {
        const lists = await fetcher(depotCode, tarih, tarih2, ["liste", "temlik"]);

        return { depotCode, branchLabel, liste: lists.liste, temlik: lists.temlik };
      } catch (error) {
        throw new Error(`${branchLabel} (${depotCode}) satışları alınamadı: ${error instanceof Error ? error.message : "bilinmeyen hata"}`);
      }
    })
  );

  const { standing, diagnostics, carpanEksik } = buildVdfStanding({ sales, points: config.points, carpan: config.carpan });
  const prizes = assignVdfPrizes(standing, config.prizes);

  const payload = {
    success: true,
    config,
    range: { from: config.countFrom, to },
    standing,
    prizes,
    carpanListesi: Object.fromEntries(VODAFONE_DEPOTS.map((depot) => [depot.branchLabel, Number(config.carpan[depot.branchLabel]) > 0 ? Number(config.carpan[depot.branchLabel]) : 1])),
    carpanEksik,
    diagnostics,
  };

  await pool.query(
    `INSERT INTO public.yarisma_results (league_id, kind, payload, computed_at) VALUES ($1, $2, $3::jsonb, now())
     ON CONFLICT (league_id, kind) DO UPDATE SET payload = EXCLUDED.payload, computed_at = now()`,
    [config.id, kind, JSON.stringify(payload)]
  );

  if (kind === "yayin") await archivePublished(pool, config.id, payload);

  return { ...payload, computedAt: new Date().toISOString() };
}


// ------------------------------------------------------------------
// MAĞAZA MÜDÜRLERİ YARIŞMASI (Vodafone, aynı tarihler, mağaza bazlı)
// ------------------------------------------------------------------
// Kural (kullanıcı duyurusu): 1-16 Kasım TEKİL cihaz satışı (temlikli 1el) ağırlıklı toplamı:
//   Samsung (premium olmayan) x1,25  +  Samsung premium (S / Fold / Flip) x1,5  +  diğer marka x1.
// Aynı kombinasyon 17-30 Kasım'da bu tabanın ÜSTÜNE çıkarılacak. Oran = 17-30 ağırlıklı toplam ÷ 1-16 ağırlıklı toplam;
// oranı en yüksek mağazanın müdürü: 1. 1 gram altın, 2. 2000 TL. Önkoşul yok. Çarpan yok. Müdürler: Vodafone hedef listesinde
// "müdür" işaretli kişiler (yoksa "Müdür tanımlı değil"). Sonuç `${id}-mudur` altında kaydedilir; şifreli sekmeden gösterilir.
// Not: ağırlıklar kalemleri DIŞLAR (premium cihaz 1,5; premium olmayan Samsung 1,25; diğer 1).

export const VDF_MUDUR_WEIGHTS = { samsung: 1.25, premium: 1.5, diger: 1 };

export const vdfMudurLeagueId = (config: Pick<VdfLeagueConfig, "id">) => `${config.id}-mudur`;

const round3 = (value: number) => Math.round(value * 1000) / 1000;

export type VdfMudurBreakdown = { tekil: number; samsung: number; premium: number; diger: number; agirlikli: number };

// Bir deponun temlikli satırlarından 1el cihaz sayıları + ağırlıklı toplam (iade satırı düşer).
export function weightedTekilByBranch(sales: Array<{ branchLabel: string; temlik: Array<Record<string, unknown>> }>): Map<string, VdfMudurBreakdown> {
  const out = new Map<string, VdfMudurBreakdown>();

  for (const depot of sales) {
    const item: VdfMudurBreakdown = { tekil: 0, samsung: 0, premium: 0, diger: 0, agirlikli: 0 };

    for (const row of depot.temlik) {
      if (foldTr(normalizeClass(row.MalSinif)) !== "1el") continue;

      const qty = qtyOf(row);
      const kind = classifyTekil(row.MalAd);

      item.tekil += qty;

      if (kind === "premium") {
        item.premium += qty;
        item.agirlikli += qty * VDF_MUDUR_WEIGHTS.premium;
      } else if (kind === "samsung") {
        item.samsung += qty;
        item.agirlikli += qty * VDF_MUDUR_WEIGHTS.samsung;
      } else {
        item.diger += qty;
        item.agirlikli += qty * VDF_MUDUR_WEIGHTS.diger;
      }
    }

    item.agirlikli = round3(item.agirlikli);
    out.set(depot.branchLabel, item);
  }

  return out;
}

export const VDF_MUDUR_PRIZES = [
  { rank: 1, label: "1 gram altın" },
  { rank: 2, label: "2000 TL" },
];

export type VdfMudurRow = ManagerRow & { baseDetay: VdfMudurBreakdown; curDetay: VdfMudurBreakdown };

export async function computeVdfManagerLeague(pool: Pool, config: VdfLeagueConfig, kind: VdfResultKind = "test", fetcher: typeof fetchDepotLists = fetchDepotLists) {
  await ensureYarismaTables(pool);

  const monthStart = `${config.startDate.slice(0, 7)}-01`;
  const baselineTo = addDays(config.startDate, -1);
  const yesterday = addDays(todayInTurkey(), -1);
  const to = yesterday < config.endDate ? yesterday : config.endDate;

  if (to < config.startDate) {
    return { success: true, empty: true, message: "Henüz sayılacak gün yok (rapor dünün verisine kadar hesaplanır).", range: { from: config.startDate, to } };
  }

  const hasBaseline = baselineTo >= monthStart;

  const fetchRange = (from: string, until: string) =>
    Promise.all(
      VODAFONE_DEPOTS.map(async ({ depotCode, branchLabel }) => {
        try {
          const lists = await fetcher(depotCode, toWingsmDate(from), toWingsmDate(until), ["temlik"]);

          return { branchLabel, temlik: lists.temlik };
        } catch (error) {
          throw new Error(`${branchLabel} (${depotCode}) satışları alınamadı: ${error instanceof Error ? error.message : "bilinmeyen hata"}`);
        }
      })
    );

  const [baseSales, curSales] = await Promise.all([hasBaseline ? fetchRange(monthStart, baselineTo) : Promise.resolve([]), fetchRange(config.startDate, to)]);
  const baseDetail = weightedTekilByBranch(baseSales);
  const curDetail = weightedTekilByBranch(curSales);
  const empty: VdfMudurBreakdown = { tekil: 0, samsung: 0, premium: 0, diger: 0, agirlikli: 0 };

  // Müdürler: Vodafone hedef listesinde "müdür" işaretli kişiler (mağazaya göre)
  const managersByBranch = new Map<string, string[]>();

  try {
    const targets = await loadTargets(pool, config.startDate.slice(0, 7));

    for (const person of targets.personnel.filter((item) => item.isManager)) {
      const key = normalizeName(person.branchLabel);
      const list = managersByBranch.get(key) ?? [];

      list.push(person.saticiAdi);
      managersByBranch.set(key, list);
    }
  } catch {
    // Hedef tablosu yoksa müdür adı boş kalır
  }

  const branches = VODAFONE_DEPOTS.map((depot) => depot.branchLabel);
  const standing = buildManagerStanding({
    branches,
    baseline: new Map(branches.map((label) => [label, (baseDetail.get(label) ?? empty).agirlikli])),
    current: new Map(branches.map((label) => [label, (curDetail.get(label) ?? empty).agirlikli])),
    managersByBranch,
    baselineDays: hasBaseline ? Math.round((Date.parse(`${baselineTo}T00:00:00Z`) - Date.parse(`${monthStart}T00:00:00Z`)) / 86_400_000) + 1 : 0,
    currentDays: Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${config.startDate}T00:00:00Z`)) / 86_400_000) + 1,
    carpanMode: "yok",
  });

  const rows: VdfMudurRow[] = standing.map((row) => ({ ...row, baseDetay: baseDetail.get(row.branchLabel) ?? empty, curDetay: curDetail.get(row.branchLabel) ?? empty }));
  const prizes = assignManagerPrizes(standing, VDF_MUDUR_PRIZES);

  const payload = {
    success: true,
    title: "Vodafone Şampiyonlar Ligi Mağaza Müdürleri Yarışması",
    agirlik: VDF_MUDUR_WEIGHTS,
    baselineRange: hasBaseline ? { from: monthStart, to: baselineTo } : null,
    range: { from: config.startDate, to },
    rows,
    prizes,
  };

  await pool.query(
    `INSERT INTO public.yarisma_results (league_id, kind, payload, computed_at) VALUES ($1, $2, $3::jsonb, now())
     ON CONFLICT (league_id, kind) DO UPDATE SET payload = EXCLUDED.payload, computed_at = now()`,
    [vdfMudurLeagueId(config), kind, JSON.stringify(payload)]
  );

  if (kind === "yayin") await archivePublished(pool, vdfMudurLeagueId(config), payload);

  return { ...payload, computedAt: new Date().toISOString() };
}
