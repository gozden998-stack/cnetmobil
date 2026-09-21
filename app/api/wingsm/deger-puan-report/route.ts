// app/api/wingsm/deger-puan-report/route.ts
//
// CNETMOBIL - WingSM "Değer Puan" raporu - AŞAMA 3+4: PUAN HESABI + RAPOR
//
// AMAÇ:
// Aşama 1 (app/api/wingsm/value-report/route.ts) WingSM satış verisinin
// okunabildiğini, Aşama 2 (public.wingsm_score_rules + CRUD) admin'in
// puan kurallarını yönetebildiğini kanıtladı. Bu uç, ikisini birleştirip
// CMR'nin 4 deposu için tarih aralığına göre satış -> puan hesabını
// canlı olarak yapar ve mağaza/personel/detay kırılımlarını döner.
//
// GÜVENLİK / KAPSAM:
// - WingSM'e HİÇBİR veri yazılmaz (sadece GET /api/b2b/satis/list/:depo,
//   4 kez, sabit CMR depo kodlarıyla).
// - public.wingsm_score_rules SADECE okunur, hiçbir satır yazılmaz/silinmez.
// - Hiçbir yerde kalıcı saklama (snapshot) yapılmaz — admin her seferinde
//   tarih aralığı seçip yeniden hesaplatır, bu BİLEREK böyle (bkz. görev
//   açıklaması: geçmiş anlık görüntüleme kapsam dışı).
// - Sadece admin oturumuna açık (requireAdminSession).
// - Depo listesi sabit (CMR'nin 4 deposu) — client'tan depo/şirket
//   parametresi ALINMAZ, sadece bastar/bittar.

import { NextRequest } from "next/server";

import { wingSMRequest } from "@/app/lib/wingsm/server";
import { getPool, json, requireAdminSession } from "../score-rules/_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

// ======================================================
// SABİT: Bu özellik SADECE CMR için. MERKEZ (001) / CNET (051) WingSM'de
// farklı bir şirket/marka — bilerek dışarıda bırakıldı.
// ======================================================

const CMR_DEPOTS: Array<{ depotCode: string; branchLabel: string }> = [
  { depotCode: "003", branchLabel: "CMR MERKEZ" },
  { depotCode: "009", branchLabel: "CMR CADDE" },
  { depotCode: "010", branchLabel: "CMR SARAY" },
  { depotCode: "011", branchLabel: "CMR KAPAKLI" },
];

// ======================================================
// value-report/route.ts'TEN BİREBİR KOPYALANDI (export edilmediği için
// import edilemiyor — dosya başındaki yorumda bu açıkça belirtilmiş).
// ======================================================

// "01.06.2026" veya "2026-06-01" -> "01/06/2026" (WingSM'in diğer
// belgelenmiş alanlarında görülen "gg/aa/yil" biçimi). Zaten DD/MM/YYYY
// ise aynen döner.
function toWingsmDate(value: unknown): string {
  const raw = String(value ?? "").trim();

  const slashMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);

  if (slashMatch) {
    const [, gun, ay, yil] = slashMatch;
    return `${gun.padStart(2, "0")}/${ay.padStart(2, "0")}/${yil}`;
  }

  const dotMatch = raw.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);

  if (dotMatch) {
    const [, gun, ay, yil] = dotMatch;
    return `${gun.padStart(2, "0")}/${ay.padStart(2, "0")}/${yil}`;
  }

  const isoMatch = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);

  if (isoMatch) {
    const [, yil, ay, gun] = isoMatch;
    return `${gun.padStart(2, "0")}/${ay.padStart(2, "0")}/${yil}`;
  }

  throw new Error(`Geçersiz tarih formatı: "${raw}". Beklenen: GG.AA.YYYY, YYYY-AA-GG ya da GG/AA/YYYY.`);
}

// Gerçek WingSM cevabında sınıf kodu "MalSinif" alanında ("0006" gibi
// sıfırla dolgulu). Excel'deki kısa kodlarla ("6", "1el"...) eşleşsin
// diye baştaki sıfırlar (yalnızca sayısal ise) atılır.
function rowClassCode(row: any): string {
  const raw = String(row?.MalSinif ?? "").trim();
  return /^\d+$/.test(raw) ? String(Number(raw)) : raw;
}

// "DD/MM/YYYY" (toWingsmDate'in çıktısı) -> { day, month (1-12), year }.
function parseWingsmDate(value: string): { day: number; month: number; year: number } {
  const [gun, ay, yil] = value.split("/").map(Number);
  return { day: gun, month: ay, year: yil };
}

// Kişi/mağaza adlarını hedef tablosuyla eşleştirirken büyük/küçük harf ve
// baştaki/sondaki boşluk farkları yüzünden kaçırmamak için normalize eder.
function normalizeName(value: string): string {
  return value.trim().toLocaleUpperCase("tr-TR").replace(/\s+/g, " ");
}

// ======================================================
// TİPLER
// ======================================================

type ScoreRuleForLookup = {
  class_code: string;
  profit_min: number;
  profit_max: number;
  score: number;
};

type TaggedRow = {
  row: any;
  branchLabel: string;
  depotCode: string;
};

type StoreAgg = {
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

type PersonnelAgg = {
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

// Bir satış satırı için (normalize edilmiş sınıf kodu, kârlılık) ikilisine
// göre kuralı bulur. ARALIK YARI-AÇIK [profit_min, profit_max) — Excel'deki
// her sütun başlığı o aralığın ALT sınırıdır: kârlılık TAM profit_max'a
// ulaşınca bir sonraki (üst) kurala geçilir, altındaki her değer hâlâ bu
// kuralda kalır (bkz. score-rules/resync/route.ts'teki ayrıntılı açıklama
// ve kullanıcıdan gelen somut örnek: kârlılık 645, "750" kuralının değil
// "300" kuralının puanını alır). Kurallar zaten aktif=true filtresiyle
// çekildi ve aralıklar çakışmıyor — ilk eşleşen kural kullanılır.
function findScore(rules: ScoreRuleForLookup[], classCode: string, karlilik: number): number | null {
  for (const rule of rules) {
    if (rule.class_code === classCode && karlilik >= rule.profit_min && karlilik < rule.profit_max) {
      return rule.score;
    }
  }
  return null;
}

export async function POST(request: NextRequest) {
  const auth = requireAdminSession(request);

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const body = await request.json().catch(() => null);

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return json({ success: false, error: "Geçersiz istek gövdesi." }, 400);
    }

    const data = body as Record<string, unknown>;

    if (!data.bastar || !data.bittar) {
      return json({ success: false, error: "bastar (başlangıç tarihi) ve bittar (bitiş tarihi) zorunludur." }, 400);
    }

    const tarih = toWingsmDate(data.bastar);
    const tarih2 = toWingsmDate(data.bittar);

    // --------------------------------------------------
    // 1) AKTİF PUAN KURALLARINI OKU (tek sorgu, sabit WHERE — parametre yok)
    // --------------------------------------------------

    const pool = getPool();

    const rulesResult = await pool.query(
      `SELECT class_code, profit_min, profit_max, score FROM public.wingsm_score_rules WHERE active = true`
    );

    const rules: ScoreRuleForLookup[] = rulesResult.rows.map((r: any) => ({
      class_code: String(r.class_code),
      profit_min: Number(r.profit_min),
      profit_max: Number(r.profit_max),
      score: Number(r.score),
    }));

    // Mağaza çarpanı (Excel'deki "MAĞAZA ÇARPANI" tablosu — bkz.
    // app/api/wingsm/store-multipliers/route.ts). Tablo henüz
    // oluşturulmamışsa (admin hiç "Mağaza Çarpanı" ekranını açmadıysa)
    // raporu ÇÖKERTMEDEN hepsi 1 kabul edilir.
    const multiplierByBranch = new Map<string, number>(
      CMR_DEPOTS.map((depot) => [depot.branchLabel, 1])
    );

    try {
      const multiplierResult = await pool.query(
        `SELECT branch_label, multiplier FROM public.wingsm_store_multipliers`
      );
      for (const row of multiplierResult.rows) {
        multiplierByBranch.set(String(row.branch_label), Number(row.multiplier));
      }
    } catch {
      // Tablo yok — varsayılan (hepsi 1) ile devam.
    }

    // --------------------------------------------------
    // 2) 4 CMR DEPOSUNU PARALEL SORGULA (sıralı await YOK — server.ts'teki
    // 20sn'lik istek timeout'unu 4 katına çıkarmamak için)
    // --------------------------------------------------

    const depotResults = await Promise.all(
      CMR_DEPOTS.map(async ({ depotCode, branchLabel }) => {
        const wingsmResult = await wingSMRequest<any>(`/api/b2b/satis/list/${encodeURIComponent(depotCode)}`, {
          method: "GET",
          query: { tarih, tarih2 },
        });

        const rawRows: any[] = Array.isArray(wingsmResult)
          ? wingsmResult
          : Array.isArray(wingsmResult?.data?.list)
          ? wingsmResult.data.list
          : Array.isArray(wingsmResult?.data)
          ? wingsmResult.data
          : Array.isArray(wingsmResult?.List)
          ? wingsmResult.List
          : [];

        return { depotCode, branchLabel, rows: rawRows };
      })
    );

    // Puan şemasında hiç yer almayan bir sınıf ("MalSinif") kapsam dışıdır
    // (SIM kart, hizmet bedeli vb. — Excel makrosundaki "siniflar" filtresiyle
    // AYNI mantık, bkz. value-report/route.ts'in GEÇİCİ TEST widget'ının
    // varsayılan "6,1el,2el,8el,6el" filtresi). Bilinen bir sınıfta olup
    // hiçbir aralığa denk gelmeyen satış ise GERÇEK bir kural boşluğudur ve
    // "unmatched" olarak raporlanmalıdır — ikisi FARKLI durumlardır.
    const knownClassCodes = new Set(rules.map((r) => r.class_code));

    const taggedRows: TaggedRow[] = [];
    let excludedOutOfScopeCount = 0;
    let excludedReturnCount = 0;

    for (const depotResult of depotResults) {
      for (const row of depotResult.rows) {
        // İADE: WingSM'in kendi satış ekranında bu satırlar miktarı (-1 gibi)
        // negatif olarak gösteriyor (kullanıcının paylaştığı örnekte diğer
        // tüm alanlar dolu ama Miktar/Tutar eksi). Daha önce bu satırlar
        // Excel'e elle silinerek hariç tutuluyordu — burada aynı işi
        // MalMiktarI < 0 kontrolüyle yapıyoruz. Not: kârlılığı negatif ama
        // miktarı pozitif olan normal (zararına) satışlar İADE DEĞİLDİR ve
        // dışlanmaz — sadece miktar negatifliği iade işaretidir.
        if (Number(row?.MalMiktarI ?? 0) < 0) {
          excludedReturnCount += 1;
          continue;
        }

        if (!knownClassCodes.has(rowClassCode(row))) {
          excludedOutOfScopeCount += 1;
          continue;
        }
        taggedRows.push({ row, branchLabel: depotResult.branchLabel, depotCode: depotResult.depotCode });
      }
    }

    // --------------------------------------------------
    // 3) HER SATIŞ SATIRI İÇİN PUAN HESAPLA + KIRILIMLARI OLUŞTUR
    // --------------------------------------------------

    const storeMap = new Map<string, StoreAgg>();
    for (const depot of CMR_DEPOTS) {
      storeMap.set(depot.depotCode, {
        branchLabel: depot.branchLabel,
        depotCode: depot.depotCode,
        saleCount: 0,
        totalScore: 0,
        multiplier: multiplierByBranch.get(depot.branchLabel) ?? 1,
        carpanliPuan: 0,
        hedef: null,
        projeksiyon: 0,
        hedefYuzdesi: null,
        siralamaPuani: 0,
      });
    }

    const personnelMap = new Map<string, PersonnelAgg>();
    const detailRows: Array<Record<string, unknown>> = [];
    const unmatched: Array<Record<string, unknown>> = [];

    for (const { row, branchLabel, depotCode } of taggedRows) {
      const classCode = rowClassCode(row);
      const karlilik = Number(row.KarlilikI ?? 0);
      const matchedScore = findScore(rules, classCode, karlilik);
      const score = matchedScore ?? 0;

      const saticiKod = String(row.SaticiKod ?? "").trim();
      const saticiAdi = String(row.SaticiAdI ?? "").trim();

      // Mağaza bazlı
      const storeAgg = storeMap.get(depotCode);
      if (storeAgg) {
        storeAgg.saleCount += 1;
        storeAgg.totalScore += score;
      }

      // Personel bazlı ((branchLabel, saticiKod || saticiAdi) anahtarıyla)
      const personnelKey = `${branchLabel}::${saticiKod || saticiAdi}`;
      const existingPersonnel = personnelMap.get(personnelKey);
      if (existingPersonnel) {
        existingPersonnel.saleCount += 1;
        existingPersonnel.totalScore += score;
      } else {
        personnelMap.set(personnelKey, {
          branchLabel,
          saticiKod,
          saticiAdi,
          saleCount: 1,
          totalScore: score,
          carpanliPuan: 0,
          hedef: null,
          isManager: false,
          hedefYuzdesi: null,
          projeksiyon: 0,
          siralama: null,
          siralamaPuani: 0,
        });
      }

      // Detay
      detailRows.push({
        branchLabel,
        saticiKod,
        saticiAdi,
        malAd: row.MalAd,
        malSinif: classCode,
        malSinifAdi: row.MalSinifAdI,
        karlilik,
        score,
        tarih: row.Tarih,
        faturaNo: row.FaturaNo,
      });

      // Eşleşmeyenler (puan 0 ama görünür kalması gerekiyor — bordroya
      // giden bir sayı sessizce eksik kalmasın diye)
      if (matchedScore === null) {
        unmatched.push({
          branchLabel,
          saticiAdi,
          malSinif: classCode,
          malSinifAdi: row.MalSinifAdI,
          karlilik,
        });
      }
    }

    for (const store of storeMap.values()) {
      store.carpanliPuan = store.totalScore * store.multiplier;
    }

    for (const person of personnelMap.values()) {
      const multiplier = multiplierByBranch.get(person.branchLabel) ?? 1;
      person.carpanliPuan = person.totalScore * multiplier;
    }

    // --------------------------------------------------
    // 4) HEDEF / PROJEKSİYON / SIRALAMA — Excel'deki HEDEF sütunlarının
    // karşılığı. HEDEF DEĞER PUAN'a (Çarpanlı Puan) göredir (kullanıcı
    // onayı). Dönem, rapor aralığının başlangıç ayından (tarih) türetilir
    // — admin ay başından bugüne kadar bir aralık seçtiğinde bu, Hedefler
    // sekmesinde girilen dönemle örtüşür.
    // --------------------------------------------------

    const { day: bastarGun, month: bastarAy, year: bastarYil } = parseWingsmDate(tarih);
    const { day: bittarGun, month: bittarAy, year: bittarYil } = parseWingsmDate(tarih2);

    const period = `${bastarYil}-${String(bastarAy).padStart(2, "0")}`;

    // Ay içi ilerleme: rapor aralığı genelde "ayın 1'i -> bugün" seçilir.
    // bittar farklı bir aydaysa (nadir, ör. ay sonu-başı geçişi) yine de
    // makul bir sonuç için bittar'ın ayını esas alıp o ayın gün sayısını
    // kullanıyoruz.
    const daysInMonth = new Date(bittarYil, bittarAy, 0).getDate();
    const bastarAsBittarAy = bittarAy === bastarAy && bittarYil === bastarYil ? bastarGun : 1;
    const daysElapsed = Math.max(1, bittarGun - bastarAsBittarAy + 1);
    const projectionFactor = daysInMonth / daysElapsed;

    let storeTargetByBranch = new Map<string, number>();
    let personnelTargetByKey = new Map<string, { hedef: number; isManager: boolean }>();

    try {
      const storeTargetsResult = await pool.query(
        `SELECT branch_label, target_value FROM public.wingsm_store_targets WHERE period = $1`,
        [period]
      );
      storeTargetByBranch = new Map(
        storeTargetsResult.rows.map((r: any) => [String(r.branch_label), Number(r.target_value)])
      );
    } catch {
      // Tablo yok — hedefsiz kabul edilir, rapor yine de döner.
    }

    try {
      const personnelTargetsResult = await pool.query(
        `
          SELECT branch_label, satici_adi, target_value, is_manager
          FROM public.wingsm_personnel_targets
          WHERE period = $1 AND active = true
        `,
        [period]
      );
      personnelTargetByKey = new Map(
        personnelTargetsResult.rows.map((r: any) => [
          `${String(r.branch_label)}::${normalizeName(String(r.satici_adi))}`,
          { hedef: Number(r.target_value), isManager: Boolean(r.is_manager) },
        ])
      );
    } catch {
      // Tablo yok — hedefsiz kabul edilir, rapor yine de döner.
    }

    for (const store of storeMap.values()) {
      const hedef = storeTargetByBranch.get(store.branchLabel);
      store.hedef = hedef !== undefined ? hedef : null;
      store.projeksiyon = store.carpanliPuan * projectionFactor;
      // Hedef % ve mağaza sıralaması GERÇEKLEŞENE göredir (projeksiyona göre
      // DEĞİL) — kullanıcının açık talimatı: "hedef gerçekleşen yüzdesine
      // göre sıralama olsun". Personel tarafında da AYNI mantık (carpanliPuan
      // / hedef) kullanılıyor, tutarlılık için. Projeksiyon ayrı, sadece
      // bilgi amaçlı "ay sonu tahmini" olarak gösteriliyor.
      store.hedefYuzdesi = hedef && hedef > 0 ? (store.carpanliPuan / hedef) * 100 : null;
    }

    // Mağaza bonus puanı: sadece hedefi olan mağazalar arasında, hedef
    // yüzdesine göre ilk 2'ye 10/5 (bkz. kullanıcının paylaştığı ekran
    // görüntüsü — sadece ilk 2 mağazada PUAN sütunu doluydu).
    const storesWithTarget = Array.from(storeMap.values())
      .filter((s) => s.hedefYuzdesi !== null)
      .sort((a, b) => (b.hedefYuzdesi ?? 0) - (a.hedefYuzdesi ?? 0));
    const STORE_BONUS = [10, 5];
    storesWithTarget.forEach((s, i) => {
      s.siralamaPuani = STORE_BONUS[i] ?? 0;
    });

    for (const person of personnelMap.values()) {
      const key = `${person.branchLabel}::${normalizeName(person.saticiAdi)}`;
      const match = personnelTargetByKey.get(key);

      person.hedef = match ? match.hedef : null;
      person.isManager = match ? match.isManager : false;
      person.hedefYuzdesi =
        match && !match.isManager && match.hedef > 0 ? (person.carpanliPuan / match.hedef) * 100 : null;
      person.projeksiyon = person.carpanliPuan * projectionFactor;
    }

    // Personel sıralaması/bonus puanı ŞİRKET GENELİNDEDİR — mağaza fark
    // etmez, hedef gerçekleşme yüzdesine göre CMR'nin 4 mağazasındaki TÜM
    // personel birlikte sıralanır (kullanıcının açık talimatı: "hedef
    // gerçekleşene göre sıralama olucak mağaza fark etmez"). Mağaza
    // karşılaştırması (stores[]) bundan AYRI, kendi başına bir şeydir.
    // Mağaza müdürleri sıralamaya HİÇ girmez; hedefi olmayan/0 olan personel
    // 0 puan alır ve sıralamanın altında kalır (kullanıcının açık talimatı).
    // İlk 3'e 10/5/3.
    const PERSONNEL_BONUS = [10, 5, 3];

    const rankablePersonnel = Array.from(personnelMap.values())
      .filter((p) => !p.isManager && p.hedefYuzdesi !== null)
      .sort((a, b) => (b.hedefYuzdesi ?? 0) - (a.hedefYuzdesi ?? 0));

    rankablePersonnel.forEach((p, i) => {
      p.siralama = i + 1;
      p.siralamaPuani = PERSONNEL_BONUS[i] ?? 0;
    });

    const stores = CMR_DEPOTS.map((depot) => storeMap.get(depot.depotCode)!);

    // Sıralama: önce hedefi olanlar (yüzdeye göre azalan, siralama alanıyla
    // birebir — mağaza fark etmez, şirket geneli), sonra hedefsizler/
    // müdürler (Çarpanlı Puan'a göre azalan, sadece görünürlük için) —
    // "hedefsiz en altta" kuralı budur.
    const personnel = Array.from(personnelMap.values()).sort((a, b) => {
      const aRanked = !a.isManager && a.hedefYuzdesi !== null;
      const bRanked = !b.isManager && b.hedefYuzdesi !== null;
      if (aRanked && bRanked) return (b.hedefYuzdesi ?? 0) - (a.hedefYuzdesi ?? 0);
      if (aRanked !== bRanked) return aRanked ? -1 : 1;
      return b.carpanliPuan - a.carpanliPuan;
    });

    const totalSaleCount = stores.reduce((sum, s) => sum + s.saleCount, 0);
    const totalScore = stores.reduce((sum, s) => sum + s.totalScore, 0);
    const totalCarpanliPuan = stores.reduce((sum, s) => sum + s.carpanliPuan, 0);

    const responsePayload = {
      success: true,
      hedefPeriodu: period,
      gunBilgisi: { gecenGun: daysElapsed, ayToplamGun: daysInMonth, kalanGun: Math.max(0, daysInMonth - daysElapsed) },
      period: { tarih, tarih2 },
      stores,
      personnel,
      detailRows,
      unmatchedCount: unmatched.length,
      unmatchedSample: unmatched.slice(0, 20),
      excludedOutOfScopeCount,
      excludedReturnCount,
      totalSaleCount,
      totalScore,
      totalCarpanliPuan,
    };

    // --------------------------------------------------
    // SNAPSHOT KAYDI: personel-facing deger-puanim uç noktası artık canlı
    // hesaplama yapmıyor, admin'in EN SON hesapladığı bu raporu okuyor (bkz.
    // app/api/wingsm/deger-puanim/route.ts). TAM cevap (detailRows dahil)
    // saklanır — personel'e özel filtreleme OKUMA anında yapılır, burada
    // değil. Bu kayıt admin'in kendi cevabını ASLA bozmamalı, bu yüzden
    // ayrı try/catch'te ve sadece console.error ile başarısız olur.
    // --------------------------------------------------
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS public.wingsm_deger_puan_snapshots (
          period TEXT PRIMARY KEY,
          payload JSONB NOT NULL,
          computed_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `);

      await pool.query(
        `
          INSERT INTO public.wingsm_deger_puan_snapshots (period, payload, computed_at)
          VALUES ($1, $2, now())
          ON CONFLICT (period) DO UPDATE SET payload = EXCLUDED.payload, computed_at = now()
        `,
        [period, JSON.stringify(responsePayload)]
      );
    } catch (snapshotError) {
      console.error("WINGSM_DEGER_PUAN_SNAPSHOT_SAVE_ERROR:", snapshotError);
    }

    return json(responsePayload);
  } catch (error) {
    console.error("WINGSM_DEGER_PUAN_REPORT_ERROR:", error);

    return json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Değer Puan raporu alınamadı.",
      },
      500
    );
  }
}
