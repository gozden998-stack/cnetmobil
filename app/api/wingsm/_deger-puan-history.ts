// app/api/wingsm/_deger-puan-history.ts
//
// CNETMOBIL - WingSM Değer Puan - GEÇMİŞ GÜNLERİN SONUCU
//
// Admin her "HESAPLA" dediğinde sonuç iki yere yazılır:
//   1) wingsm_deger_puan_snapshots : ay başına SON hesap (personel ekranının
//      varsayılan gösterimi — eskiden beri böyle).
//   2) wingsm_deger_puan_history   : her TARİH ARALIĞI için bir satır. Aynı
//      aralık tekrar hesaplanırsa o satır güncellenir; farklı aralıklar
//      (ör. 01-08, 01-09) ayrı ayrı KALIR. Personel "dünkü rapor" gibi eski
//      sonuçlara buradan bakar.
//
// Sadece puanlama özeti saklanır (mağaza + personel + gün bilgisi +
// toplamlar). Satış başına detay (detailRows) ve eşleşmeyen örnekler
// SAKLANMAZ — ne personele ne arşive gider.
//
// Bu dosya "_" ile başladığı için Next.js tarafından route sayılmaz.

import type { Pool } from "pg";

// "DD/MM/YYYY" -> "YYYY-MM-DD" (DATE sütunu için). Biçim bozuksa null.
export function wingsmDateToIso(value: unknown): string | null {
  const match = String(value ?? "").match(/^(\d{2})\/(\d{2})\/(\d{4})$/);

  if (!match) return null;

  return `${match[3]}-${match[2]}-${match[1]}`;
}

export async function ensureHistoryTable(pool: Pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.wingsm_deger_puan_history (
      id SERIAL PRIMARY KEY,
      period TEXT NOT NULL,
      range_start DATE,
      range_end DATE,
      tarih TEXT NOT NULL,
      tarih2 TEXT NOT NULL,
      payload JSONB NOT NULL,
      computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT wingsm_deger_puan_history_range_unique UNIQUE (tarih, tarih2)
    )
  `);
}

// Arşive yazılacak hafif kopya: detay ve eşleşmeyen örnekler çıkarılır.
export function slimPayloadForHistory(payload: Record<string, unknown>) {
  const { detailRows: _detailRows, unmatchedSample: _unmatchedSample, ...rest } = payload;

  void _detailRows;
  void _unmatchedSample;

  return rest;
}

// Hesap sonucunu ekler / aynı aralık varsa günceller. Hata fırlatabilir;
// çağıran try/catch ile sarmalı ki admin'in kendi cevabı asla bozulmasın.
export async function saveHistoryRow(
  pool: Pool,
  payload: Record<string, unknown> & { hedefPeriodu: string; period: { tarih: string; tarih2: string } }
) {
  await ensureHistoryTable(pool);

  await pool.query(
    `
      INSERT INTO public.wingsm_deger_puan_history
        (period, range_start, range_end, tarih, tarih2, payload, computed_at)
      VALUES ($1, $2, $3, $4, $5, $6, now())
      ON CONFLICT (tarih, tarih2) DO UPDATE
        SET payload = EXCLUDED.payload,
            period = EXCLUDED.period,
            computed_at = now()
    `,
    [
      payload.hedefPeriodu,
      wingsmDateToIso(payload.period.tarih),
      wingsmDateToIso(payload.period.tarih2),
      payload.period.tarih,
      payload.period.tarih2,
      JSON.stringify(slimPayloadForHistory(payload)),
    ]
  );
}
