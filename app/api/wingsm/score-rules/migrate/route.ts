// app/api/wingsm/score-rules/migrate/route.ts
//
// CNETMOBIL - WingSM Değer Puan kural tablosu - TEK SEFERLİK KURULUM
//
// scripts/wingsm_score_rules.sql'in production'da elle çalıştırılması
// yerine, admin panelinden tek tıkla tetiklenebilecek idempotent bir
// migration. Tekrar çağrılırsa (tablo zaten doluysa) sadece "zaten
// kurulu" der, seed verisini ikinci kez EKLEMEZ.
//
// Bu dosya, işi bittikten sonra silinebilir — kalıcı bir API değil.

import { NextRequest } from "next/server";

import { getPool, json, requireAdminSession } from "../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

// Excel kaynağıyla (cmr değer puan HAZİRAN2026 (2).xlsm) birebir
// doğrulanmış 5 sınıf x 12 kâr aralığı.
//
// ARALIK YÖNÜ (v2 düzeltmesi): Excel'deki her sütun başlığı (100, 300,
// 750, ...) o aralığın ÜST değil ALT sınırıdır — kârlılık 180/190/250
// gibi 100-300 arası bir değer "100" sütununun puanını alır, TAM 300
// olunca "300" sütununa geçer, 645 gibi 300-750 arası bir değer HÂLÂ
// "300"ün puanını alır (750'ye SADECE tam 750'de geçilir). Yani her
// bracket [min, max) yarı-açık — ilk bracket alt sınırsız, son bracket
// üst sınırsız. score-rules/resync/route.ts'teki BRACKETS ile BİREBİR
// AYNI olmalı (o dosyada bu düzeltmenin nedeni daha ayrıntılı anlatılıyor).
const BRACKETS: Array<{ min: number; max: number }> = [
  { min: -999999999, max: -100 },
  { min: -100, max: 0 },
  { min: 0, max: 100 },
  { min: 100, max: 300 },
  { min: 300, max: 750 },
  { min: 750, max: 1500 },
  { min: 1500, max: 3000 },
  { min: 3000, max: 5000 },
  { min: 5000, max: 8000 },
  { min: 8000, max: 12000 },
  { min: 12000, max: 12001 },
  { min: 12001, max: 999999999 },
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
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.wingsm_score_rules (
        id SERIAL PRIMARY KEY,
        class_code TEXT NOT NULL,
        class_label TEXT NOT NULL,
        profit_min NUMERIC NOT NULL,
        profit_max NUMERIC NOT NULL,
        score NUMERIC NOT NULL,
        active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT wingsm_score_rules_range_chk CHECK (profit_min < profit_max),
        CONSTRAINT wingsm_score_rules_score_chk CHECK (score >= 0)
      )
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_wingsm_score_rules_class_code
        ON public.wingsm_score_rules (class_code)
        WHERE active
    `);

    const existing = await pool.query(`SELECT COUNT(*)::int AS count FROM public.wingsm_score_rules`);
    const alreadySeeded = (existing.rows[0]?.count ?? 0) > 0;

    if (alreadySeeded) {
      return json({
        success: true,
        tableCreated: true,
        seeded: false,
        message: `Tablo zaten var ve dolu (${existing.rows[0].count} satır) — seed verisi tekrar eklenmedi.`,
      });
    }

    let inserted = 0;

    for (const cls of SEED_CLASSES) {
      for (let i = 0; i < BRACKETS.length; i += 1) {
        const bracket = BRACKETS[i];
        const score = cls.scores[i];

        await pool.query(
          `
            INSERT INTO public.wingsm_score_rules
              (class_code, class_label, profit_min, profit_max, score)
            VALUES ($1, $2, $3, $4, $5)
          `,
          [cls.code, cls.label, bracket.min, bracket.max, score]
        );

        inserted += 1;
      }
    }

    return json({
      success: true,
      tableCreated: true,
      seeded: true,
      insertedRows: inserted,
      message: `Tablo oluşturuldu ve ${inserted} satır seed verisi eklendi.`,
    });
  } catch (error) {
    console.error("WINGSM_SCORE_RULES_MIGRATE_ERROR:", error);

    return json(
      { success: false, error: error instanceof Error ? error.message : "Migration başarısız." },
      500
    );
  }
}
