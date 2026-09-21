// app/api/wingsm/score-rules/resync/route.ts
//
// CNETMOBIL - WingSM Değer Puan kural tablosu - EXCEL İLE EŞİTLE
//
// AMAÇ:
// migrate/route.ts idempotent'tir — tablo bir kez doluysa bir daha seed
// etmez. Eğer kurulum, bir önceki (hatalı) seed verisiyle daha önce
// çalıştırılmışsa, production'daki değerler kod içindeki (Excel'le
// birebir doğrulanmış) SEED_CLASSES/BRACKETS ile artık uyuşmuyor olabilir
// ve migrate/route.ts'i tekrar çalıştırmak bunu DÜZELTMEZ.
//
// Bu uç, "tabloyu sıfırdan kur" değil, "bilinen 5 sınıf x 12 aralığın
// puanını Excel kaynağıyla eşitle" yapar: her (class_code, profit_min,
// profit_max) üçlüsü için satır varsa VE puanı farklıysa günceller, satır
// hiç yoksa ekler. Admin'in SONRADAN kendi eklediği başka sınıf/aralıklara
// DOKUNMAZ (onlar bu 60 satırın dışında kalır).
//
// GÜVENLİK: migrate/route.ts ile AYNI admin-gate (requireAdminSession).

import { NextRequest } from "next/server";

import { getPool, json, requireAdminSession } from "../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

// migrate/route.ts'teki SEED_CLASSES/BRACKETS ile BİREBİR AYNI —
// "cmr değer puan HAZİRAN2026 (2).xlsm" Excel kaynağıyla satır satır
// doğrulanmış değerler (bkz. o dosyanın başlığı).
const BRACKETS: Array<{ min: number; max: number }> = [
  { min: -999999999, max: -3000 },
  { min: -2999.99, max: -100 },
  { min: -99.99, max: 0 },
  { min: 0.01, max: 100 },
  { min: 100.01, max: 300 },
  { min: 300.01, max: 750 },
  { min: 750.01, max: 1500 },
  { min: 1500.01, max: 3000 },
  { min: 3000.01, max: 5000 },
  { min: 5000.01, max: 8000 },
  { min: 8000.01, max: 12000 },
  { min: 12000.01, max: 999999999 },
];

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
    let updated = 0;
    let inserted = 0;
    let unchanged = 0;
    const changes: Array<{ class_code: string; profit_min: number; profit_max: number; from: string; to: number }> = [];

    for (const cls of SEED_CLASSES) {
      for (let i = 0; i < BRACKETS.length; i += 1) {
        const bracket = BRACKETS[i];
        const expectedScore = cls.scores[i];

        const existing = await pool.query(
          `
            SELECT id, score FROM public.wingsm_score_rules
            WHERE class_code = $1 AND profit_min = $2 AND profit_max = $3
          `,
          [cls.code, bracket.min, bracket.max]
        );

        if (existing.rows.length === 0) {
          await pool.query(
            `
              INSERT INTO public.wingsm_score_rules
                (class_code, class_label, profit_min, profit_max, score, active, created_at, updated_at)
              VALUES ($1, $2, $3, $4, $5, true, now(), now())
            `,
            [cls.code, cls.label, bracket.min, bracket.max, expectedScore]
          );
          inserted += 1;
          continue;
        }

        const row = existing.rows[0];
        const currentScore = Number(row.score);

        if (currentScore !== expectedScore) {
          await pool.query(
            `UPDATE public.wingsm_score_rules SET score = $2, updated_at = now() WHERE id = $1`,
            [row.id, expectedScore]
          );
          changes.push({
            class_code: cls.code,
            profit_min: bracket.min,
            profit_max: bracket.max,
            from: row.score,
            to: expectedScore,
          });
          updated += 1;
        } else {
          unchanged += 1;
        }
      }
    }

    return json({
      success: true,
      updated,
      inserted,
      unchanged,
      changes,
      message:
        updated + inserted === 0
          ? "Zaten Excel ile birebir aynıydı, değişiklik yapılmadı."
          : `${updated} satır düzeltildi, ${inserted} satır eklendi.`,
    });
  } catch (error) {
    console.error("WINGSM_SCORE_RULES_RESYNC_ERROR:", error);

    return json(
      { success: false, error: error instanceof Error ? error.message : "Eşitleme başarısız." },
      500
    );
  }
}
