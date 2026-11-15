// app/lib/channel-close/queue.ts
//
// CNETMOBIL - KANALLAR ARASI STOK KAPATMA KUYRUĞU
//
// Bir IMEI'li cihaz bir kanalda satılınca (WingSM mağaza satışı, N11 siparişi, İdefix siparişi)
// diğer kanallardaki ilanı stok=0 yapılmalı. Olay tarafı sadece kuyruğa kayıt atar
// (enqueueChannelClose, hızlı ve hata atmaz); asıl kapatma processChannelCloseQueue ile cron
// tarafından yapılır: hata olursa tekrar dener, sonucu ve hatayı veritabanına yazar.
//
// Kural özeti:
//   WingSM satışı  -> İdefix kapat (N11'i sync-stock zaten doğrudan sıfırlıyor; ayrıca N11 de eklenebilir)
//   N11 siparişi   -> İdefix kapat
//   İdefix siparişi -> N11 kapat
// Kapatma tek yönlü ve idempotent: zaten 0 olan ilana tekrar dokunulmaz. İptal/iade olursa stok
// OTOMATİK AÇILMAZ (çift satış riski), elle açılır.
// WingSM'e hiçbir veri yazılmaz.

import type { Pool } from "pg";

import { closeIdefixForImei } from "../idefix/stock";
import { autoZeroN11StockForSoldImei } from "../n11/stock";

export type CloseTarget = "IDEFIX" | "N11";

const MAX_ATTEMPTS = 5;
const RETRY_AFTER_MINUTES = 2;
const STUCK_AFTER_MINUTES = 10;

let tablesReady = false;

export async function ensureChannelCloseTables(pool: Pool) {
  if (tablesReady) return;

  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.channel_close_queue (
      id BIGSERIAL PRIMARY KEY,
      imei TEXT NOT NULL,
      target_channel TEXT NOT NULL,
      source TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING',
      attempts INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      result JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      processed_at TIMESTAMPTZ,
      CONSTRAINT channel_close_queue_unique UNIQUE (imei, target_channel),
      CONSTRAINT channel_close_queue_status_chk
        CHECK (status IN ('PENDING', 'RUNNING', 'DONE', 'SKIPPED', 'FAILED'))
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.channel_close_seen_items (
      source TEXT NOT NULL,
      order_key TEXT NOT NULL,
      item_key TEXT NOT NULL,
      imei TEXT,
      seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (source, order_key, item_key)
    )
  `);

  tablesReady = true;
}

// Kuyruğa ekler. Aynı IMEI + kanal için kayıt varsa ve bitmişse (DONE/SKIPPED/FAILED) yeniden
// PENDING yapılır (cihaz yeniden listelenip tekrar satılmış olabilir); bekleyen/çalışan kayda dokunulmaz.
// Varsayılan olarak hiçbir hata dışarı atılmaz: olay tarafı (WingSM senkronu, sipariş motoru) bu yüzden
// bozulmaz. İşlem kaybı kabul edilemeyen çağıran throwOnError ile hatayı kendisi yönetir.
export async function enqueueChannelClose(
  pool: Pool,
  imeis: string[],
  targets: CloseTarget[],
  source: string,
  options: { throwOnError?: boolean } = {}
): Promise<number> {
  const clean = Array.from(new Set(imeis.map((imei) => String(imei ?? "").trim()).filter((imei) => /^\d{15}$/.test(imei))));

  if (clean.length === 0 || targets.length === 0) return 0;

  try {
    await ensureChannelCloseTables(pool);

    let queued = 0;

    for (const imei of clean) {
      for (const target of targets) {
        const result = await pool.query(
          `
            INSERT INTO public.channel_close_queue (imei, target_channel, source)
            VALUES ($1, $2, $3)
            ON CONFLICT (imei, target_channel) DO UPDATE
              SET status = 'PENDING',
                  source = EXCLUDED.source,
                  attempts = 0,
                  last_error = NULL,
                  result = NULL,
                  processed_at = NULL,
                  updated_at = now()
              WHERE public.channel_close_queue.status IN ('DONE', 'SKIPPED', 'FAILED')
            RETURNING id
          `,
          [imei, target, source]
        );

        queued += result.rowCount || 0;
      }
    }

    return queued;
  } catch (error) {
    if (options.throwOnError) throw error;

    console.error("CHANNEL_CLOSE_ENQUEUE_ERROR:", error instanceof Error ? error.message : error);
    return 0;
  }
}

type QueueRow = { id: string; imei: string; target_channel: CloseTarget; attempts: number };

export type QueueRunSummary = {
  picked: number;
  done: number;
  skipped: number;
  failed: number;
  errors: string[];
};

async function runOne(pool: Pool, row: QueueRow): Promise<{ status: "DONE" | "SKIPPED"; result: unknown }> {
  if (row.target_channel === "IDEFIX") {
    const result = await closeIdefixForImei(pool, row.imei);

    return { status: result.status === "NO_LISTING" ? "SKIPPED" : "DONE", result };
  }

  const result = await autoZeroN11StockForSoldImei(pool, row.imei);

  // autoZeroN11StockForSoldImei hata fırlatmaz, hataları listeler; hata varsa tekrar denensin.
  if (result.errors.length > 0) throw new Error(result.errors.join(" | "));

  return { status: "DONE", result };
}

export async function processChannelCloseQueue(pool: Pool, limit = 10): Promise<QueueRunSummary> {
  await ensureChannelCloseTables(pool);

  const claimed = await pool.query<QueueRow>(
    `
      UPDATE public.channel_close_queue q
      SET status = 'RUNNING', attempts = q.attempts + 1, updated_at = now()
      WHERE q.id IN (
        SELECT id FROM public.channel_close_queue
        WHERE (status = 'PENDING')
           OR (status = 'FAILED' AND attempts < $2 AND updated_at < now() - make_interval(mins => $3))
           OR (status = 'RUNNING' AND updated_at < now() - make_interval(mins => $4))
        ORDER BY id
        LIMIT $1
        FOR UPDATE SKIP LOCKED
      )
      RETURNING q.id, q.imei, q.target_channel, q.attempts
    `,
    [limit, MAX_ATTEMPTS, RETRY_AFTER_MINUTES, STUCK_AFTER_MINUTES]
  );

  const summary: QueueRunSummary = { picked: claimed.rows.length, done: 0, skipped: 0, failed: 0, errors: [] };

  for (const row of claimed.rows) {
    try {
      const outcome = await runOne(pool, row);

      await pool.query(
        `UPDATE public.channel_close_queue
         SET status = $2, last_error = NULL, result = $3::jsonb, processed_at = now(), updated_at = now()
         WHERE id = $1`,
        [row.id, outcome.status, JSON.stringify(outcome.result)]
      );

      if (outcome.status === "DONE") summary.done += 1;
      else summary.skipped += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      await pool.query(
        `UPDATE public.channel_close_queue
         SET status = 'FAILED', last_error = $2, updated_at = now()
         WHERE id = $1`,
        [row.id, message.slice(0, 1000)]
      );

      summary.failed += 1;
      summary.errors.push(`${row.imei} (${row.target_channel}, deneme ${row.attempts}): ${message}`);
    }
  }

  return summary;
}

declare global {
  // eslint-disable-next-line no-var
  var cnetChannelCloseKickRunning: boolean | undefined;
}

// Kuyruğa kayıt atan olay tarafı (WingSM senkronu, N11 sipariş motoru) işçiyi hemen tetikler; böylece
// kapatma dakikalık cron'u beklemeden birkaç saniyede yapılır. BEKLENMEZ (olay tarafı yavaşlamaz) ve
// hata atmaz; hata/yarım kalan iş kuyrukta kalır, cron tekrar dener. Aynı süreçte aynı anda tek tetikleme
// çalışır (kuyruk zaten FOR UPDATE SKIP LOCKED ile çift işlemeye karşı korunur).
export function kickChannelCloseQueue(pool: Pool, limit = 10): void {
  if (globalThis.cnetChannelCloseKickRunning) return;

  globalThis.cnetChannelCloseKickRunning = true;

  void processChannelCloseQueue(pool, limit)
    .then((summary) => {
      if (summary.errors.length) console.error("CHANNEL_CLOSE_KICK_ERRORS:", summary.errors);
    })
    .catch((error) => console.error("CHANNEL_CLOSE_KICK_ERROR:", error instanceof Error ? error.message : error))
    .finally(() => {
      globalThis.cnetChannelCloseKickRunning = false;
    });
}
