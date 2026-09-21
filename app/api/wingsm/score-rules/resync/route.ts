// app/api/wingsm/score-rules/resync/route.ts
//
// CNETMOBIL - WingSM Değer Puan kural tablosu - EXCEL İLE EŞİTLE (v2)
//
// AMAÇ:
// migrate/route.ts idempotent'tir — tablo bir kez doluysa bir daha seed
// etmez. Eğer kurulum, bir önceki (hatalı) seed/aralık tanımıyla daha önce
// çalıştırılmışsa, production'daki değerler kod içindeki güncel
// SEED_CLASSES/BRACKETS ile artık uyuşmuyor olabilir.
//
// v2 NOTU (aralık yönü düzeltmesi): Kullanıcının verdiği somut örnekle
// netleşti — Excel'deki her sütun başlığı (100, 300, 750, ...) o aralığın
// ÜST SINIRI değil ALT SINIRIdır. Yani kârlılık 180/190/200/250 gibi
// 100-300 arasındaki bir değer "100" sütununun puanını alır (bir üst
// sütünü almaz); kârlılık TAM 300 olunca "300" sütununa geçer; 645 gibi
// 300-750 arasındaki bir değer HÂLÂ "300" sütununun puanını alır, "750"ye
// SADECE kârlılık tam 750'ye ulaşınca geçilir. Yani her sütun [kendi
// başlığı, bir sonraki başlık) yarı-açık aralığını kapsar — ilk sütun
// (en büyük zarar ucu) alt sınırsız, son sütun (en yüksek kâr ucu) üst
// sınırsızdır. Bu, ESKİ (v1) aralık tanımından (her başlık kendi aralığının
// ÜST sınırıydı) TAMAMEN FARKLI ve v1 ile ÇAKIŞMAYAN aralıklar üretir —
// bu yüzden bu uç artık "bul, farklıysa güncelle" değil, bilinen 5 sınıf
// için TÜM eski satırları silip doğru aralıklarla YENİDEN oluşturur.
// Sadece bu 5 sınıf için, hard delete + reinsert
// (kalıcı silme burada bilinçli tercih — bu bir admin kararı değil, aralık
// tanımındaki bir hatanın düzeltilmesi; audit-trail amaçlı soft-delete
// normal CRUD [id]/route.ts'teki DELETE'te olduğu gibi kalmaya devam eder).
//
// Bu uç, admin'in SONRADAN kendi eklediği başka sınıf/aralıklara DOKUNMAZ
// (onlar bu 5 sınıfın dışında kalır, class_code'a göre ayrıştırılır).
//
// GÜVENLİK: migrate/route.ts ile AYNI admin-gate (requireAdminSession).

import { NextRequest } from "next/server";

import { getPool, json, requireAdminSession } from "../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

// migrate/route.ts'teki BRACKETS ile BİREBİR AYNI — bkz. o dosyanın
// başlığındaki aynı açıklama. Her bracket [min, max) yarı-açık aralığı
// (max HARİÇ) — sadece son bracket'in max'ı pratikte sonsuz sayılır.
const BRACKETS: Array<{ min: number; max: number; label: string }> = [
  { min: -999999999, max: -100, label: "-3000" },
  { min: -100, max: 0, label: "-100" },
  { min: 0, max: 100, label: "0" },
  { min: 100, max: 300, label: "100" },
  { min: 300, max: 750, label: "300" },
  { min: 750, max: 1500, label: "750" },
  { min: 1500, max: 3000, label: "1500" },
  { min: 3000, max: 5000, label: "3000" },
  { min: 5000, max: 8000, label: "5000" },
  { min: 8000, max: 12000, label: "8000" },
  { min: 12000, max: 12001, label: "12000" },
  { min: 12001, max: 999999999, label: "12001" },
];

// "cmr değer puan HAZİRAN2026 (2).xlsm" Excel kaynağıyla satır satır
// doğrulanmış puanlar — HERHANGİ bir sütunun PUANI değişmedi, sadece o
// puanın hangi kârlılık aralığına denk geldiği (yukarıdaki BRACKETS)
// düzeltildi.
const SEED_CLASSES: Array<{ code: string; label: string; scores: number[] }> = [
  { code: "6", label: "AKSESUAR", scores: [0, 0, 3, 8, 12, 18, 20, 25, 30, 35, 40, 40] },
  { code: "1el", label: "SIFIR CİHAZ", scores: [20, 20, 20, 20, 20, 22, 25, 30, 30, 35, 40, 50] },
  { code: "2el", label: "2. EL CİHAZ", scores: [10, 10, 10, 12, 14, 16, 20, 30, 60, 75, 90, 110] },
  { code: "8el", label: "SABİT TELEFONLAR", scores: [5, 3, 5, 7, 10, 15, 20, 20, 20, 20, 20, 20] },
  { code: "6el", label: "TEMLİK AKSESUAR", scores: [5, 5, 10, 12, 14, 18, 20, 20, 25, 30, 35, 40] },
];

export async function POST(request: NextRequest) {
  const auth = requireAdminSession(request);

  if (!auth.ok) {
    return auth.response;
  }

  const pool = getPool();

  try {
    let deleted = 0;
    let inserted = 0;

    for (const cls of SEED_CLASSES) {
      // Bu sınıfın (eski v1 aralıklı ya da her ne haldeyse) TÜM satırlarını
      // kaldır — sadece bu 5 bilinen class_code, başka hiçbir sınıfa
      // dokunulmaz.
      const del = await pool.query(`DELETE FROM public.wingsm_score_rules WHERE class_code = $1`, [cls.code]);
      deleted += del.rowCount ?? 0;

      for (let i = 0; i < BRACKETS.length; i += 1) {
        const bracket = BRACKETS[i];
        const score = cls.scores[i];

        await pool.query(
          `
            INSERT INTO public.wingsm_score_rules
              (class_code, class_label, profit_min, profit_max, score, active, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, true, now(), now())
          `,
          [cls.code, cls.label, bracket.min, bracket.max, score]
        );
        inserted += 1;
      }
    }

    return json({
      success: true,
      deleted,
      inserted,
      message: `${deleted} eski satır kaldırıldı, ${inserted} satır doğru aralıklarla yeniden oluşturuldu.`,
    });
  } catch (error) {
    console.error("WINGSM_SCORE_RULES_RESYNC_ERROR:", error);

    return json(
      { success: false, error: error instanceof Error ? error.message : "Eşitleme başarısız." },
      500
    );
  }
}
