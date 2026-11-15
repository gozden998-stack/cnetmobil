// app/lib/hepsiburada/stock-sync.ts
//
// CNETMOBIL - Hepsiburada STOK SENKRONU (WingSM sıfır stok -> Hepsiburada)
//
// Eşleşmiş her Hepsiburada listing'i için hedef stok = WingSM'deki TÜM depoların toplamı - güvenlik payı (ayardan).
// Fiyata dokunulmaz. Hepsiburada'ya POST /listings/merchantid/{id}/stock-uploads  [{ hepsiburadaSku, availableStock }]
//
// KORUMALAR
//   - WingSM sıfır stok verisi 15 dakikadan eskiyse hiçbir şey gönderilmez (eski veriyle üzerine yazma yok).
//   - Açık (paketlenmemiş) Hepsiburada siparişi olan üründe stok ARTIRILMAZ (Hepsiburada kendi stoğunu düşürmüştür,
//     WingSM'e satış henüz girilmemiş olabilir; çift satış olmasın). Azaltma serbesttir.
//   - Çok sayıda ürün aynı anda 0'a düşecekse (>=5 ürün ve %40+) gönderim durur ve uyarı verir.
//   - Otomatik gönderim ayardan açılmadıkça (hepsiburada_settings.sync_enabled) çalışmaz; önizleme her zaman yapılabilir.

import type { Pool } from "pg";

import { HEPSIBURADA_LISTING_BASE, HEPSIBURADA_ORDERS_BASE, hepsiburadaFetch } from "./server";
import { ensureHepsiburadaMapTable, wingProductsByCode, wingProductsByHbSku, type WingProduct } from "./map";

const MAX_BATCH = 1000;
const STALE_MS = 15 * 60 * 1000;

let ready = false;

export async function ensureStockSyncTables(pool: Pool) {
  await ensureHepsiburadaMapTable(pool);

  if (ready) return;

  await pool.query(`CREATE TABLE IF NOT EXISTS public.hepsiburada_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.hepsiburada_stock_log (
      id BIGSERIAL PRIMARY KEY,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      mode TEXT NOT NULL,
      changes INTEGER NOT NULL DEFAULT 0,
      sent INTEGER NOT NULL DEFAULT 0,
      upload_ids TEXT,
      blocked TEXT,
      error TEXT
    )
  `);

  ready = true;
}

export type HepsiburadaSettings = { buffer: number; syncEnabled: boolean };

export async function getSettings(pool: Pool): Promise<HepsiburadaSettings> {
  await ensureStockSyncTables(pool);

  const result = await pool.query(`SELECT key, value FROM public.hepsiburada_settings WHERE key IN ('buffer', 'sync_enabled')`);
  const map = new Map<string, string>(result.rows.map((row) => [String(row.key), String(row.value)]));
  const buffer = Math.trunc(Number(map.get("buffer") ?? 0));

  return { buffer: Number.isFinite(buffer) && buffer >= 0 ? buffer : 0, syncEnabled: map.get("sync_enabled") === "1" };
}

export async function saveSettings(pool: Pool, input: { buffer?: unknown; syncEnabled?: unknown }) {
  await ensureStockSyncTables(pool);

  if (input.buffer !== undefined) {
    const buffer = Math.trunc(Number(input.buffer));

    if (!Number.isFinite(buffer) || buffer < 0 || buffer > 100) throw new Error("Güvenlik payı 0 ile 100 arasında bir tam sayı olmalı.");

    await pool.query(
      `INSERT INTO public.hepsiburada_settings (key, value) VALUES ('buffer', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
      [String(buffer)]
    );
  }

  if (input.syncEnabled !== undefined) {
    await pool.query(
      `INSERT INTO public.hepsiburada_settings (key, value) VALUES ('sync_enabled', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
      [input.syncEnabled === true ? "1" : "0"]
    );
  }
}

async function fetchAllListings() {
  const rows: any[] = [];

  for (let offset = 0; offset < 5000; offset += 100) {
    const result = await hepsiburadaFetch(HEPSIBURADA_LISTING_BASE, "/listings/merchantid/{merchantId}", { query: { offset, limit: 100 } });

    if (!result.ok) throw new Error(`Hepsiburada listing HTTP ${result.status}`);

    const page: any[] = Array.isArray(result.body?.listings) ? result.body.listings : [];

    rows.push(...page);

    if (page.length < 100) break;
  }

  return rows;
}

// Açık (Open) siparişlerdeki ürünlerin adedi: Hepsiburada SKU -> adet.
async function fetchOpenOrderQty() {
  const qty = new Map<string, number>();

  for (let offset = 0; offset < 5000; offset += 100) {
    const result = await hepsiburadaFetch(HEPSIBURADA_ORDERS_BASE, "/orders/merchantid/{merchantId}", { query: { offset, limit: 100 } });

    if (!result.ok) throw new Error(`Hepsiburada sipariş HTTP ${result.status}`);

    const items: any[] = Array.isArray(result.body?.items) ? result.body.items : [];

    for (const item of items) {
      const sku = String(item?.sku ?? "").trim().toUpperCase();

      if (sku) qty.set(sku, (qty.get(sku) ?? 0) + (Number(item?.quantity) || 1));
    }

    if (items.length < 100) break;
  }

  return qty;
}

export type PlanItem = {
  hepsiburadaSku: string;
  malKod: string;
  productName: string;
  current: number;
  wing: number;
  target: number;
  action: "CHANGE" | "SKIP_OPEN_ORDER";
  reason: string | null;
};

export type StockPlan = {
  settings: HepsiburadaSettings;
  matched: number;
  unmatched: number;
  unchanged: number;
  items: PlanItem[];
  blocked: string | null;
  wingDataAgeMinutes: number | null;
};

export async function computeStockPlan(pool: Pool): Promise<StockPlan> {
  await ensureStockSyncTables(pool);

  const settings = await getSettings(pool);
  const listings = await fetchAllListings();
  const skus = listings.map((row) => String(row?.hepsiburadaSku ?? "").trim()).filter(Boolean);

  const saved = await pool.query(`SELECT hb_sku, mal_kod FROM public.hepsiburada_sku_map WHERE hb_sku = ANY($1::text[])`, [skus]);
  const manual = new Map<string, string>(saved.rows.map((row) => [String(row.hb_sku), String(row.mal_kod)]));
  const codes = new Set<string>(manual.values());

  for (const row of listings) {
    const merchantSku = String(row?.merchantSku ?? "").trim();

    if (merchantSku) codes.add(merchantSku);
  }

  const byCode = await wingProductsByCode(pool, Array.from(codes));
  const bySku = await wingProductsByHbSku(pool, skus);
  const openOrders = await fetchOpenOrderQty();

  const items: PlanItem[] = [];
  let unmatched = 0;
  let unchanged = 0;
  // Otomatik eşleşenler (SKU ya da stok kodu = MalKod) kalıcı kaydedilir: ürün WingSM stoğunda bitip listeden düşse bile
  // eşleşme kaybolmaz ve Hepsiburada stoğu 0'a çekilebilir (aksi halde eski stokta kalıp çift satışa yol açardı).
  const autoMaps = new Map<string, string>();

  for (const row of listings) {
    const hbSku = String(row?.hepsiburadaSku ?? "").trim();
    const merchantSku = String(row?.merchantSku ?? "").trim();
    const manualCode = manual.get(hbSku) ?? null;
    const skuMatch = !manualCode ? bySku.get(hbSku) ?? null : null;
    const product: WingProduct | null = skuMatch ?? (manualCode ? byCode.get(manualCode) ?? null : byCode.get(merchantSku) ?? null);
    const matchedByManualOnly = Boolean(manualCode) && !product;

    // Eşleşmiş ama WingSM sıfır stokta artık görünmeyen ürün: WingSM stoğu 0 kabul edilir (stok sıfırlanır).
    if (!product && !matchedByManualOnly) {
      unmatched += 1;
      continue;
    }

    if (!manualCode && product) autoMaps.set(hbSku, String(product.mal_kod));

    const wing = product?.adet ?? 0;
    const target = Math.max(0, wing - settings.buffer);
    const current = Number(row?.availableStock ?? 0);

    if (target === current) {
      unchanged += 1;
      continue;
    }

    const open = openOrders.get(hbSku.toUpperCase()) ?? 0;
    const skip = target > current && open > 0;

    items.push({
      hepsiburadaSku: hbSku,
      malKod: product?.mal_kod ?? manualCode ?? "",
      productName: product?.mal_ad ?? "",
      current,
      wing,
      target,
      action: skip ? "SKIP_OPEN_ORDER" : "CHANGE",
      reason: skip ? `${open} adet açık sipariş var, stok artırılmadı` : null,
    });
  }

  if (autoMaps.size > 0) {
    const entries = Array.from(autoMaps.entries());

    await pool.query(
      `INSERT INTO public.hepsiburada_sku_map (hb_sku, mal_kod, source) SELECT t.sku, t.kod, 'AUTO' FROM unnest($1::text[], $2::text[]) AS t(sku, kod) ON CONFLICT (hb_sku) DO NOTHING`,
      [entries.map(([sku]) => sku), entries.map(([, kod]) => kod)]
    );
  }

  // Güvenlik koruması 1: WingSM verisi taze mi?
  const run = await pool.query(`SELECT finished_at FROM public.sifir_sync_runs WHERE finished_at IS NOT NULL AND depots_failed = 0 ORDER BY id DESC LIMIT 1`);
  const finished = run.rows[0]?.finished_at ? new Date(run.rows[0].finished_at).getTime() : 0;
  const ageMs = finished ? Date.now() - finished : null;
  let blocked: string | null = null;

  if (!finished || (ageMs as number) > STALE_MS) blocked = "WingSM sıfır stok verisi 15 dakikadan eski ya da yok; stok gönderilmez.";

  // Güvenlik koruması 2: toplu sıfırlanma
  const changes = items.filter((item) => item.action === "CHANGE");
  const toZero = changes.filter((item) => item.target === 0 && item.current > 0).length;
  const withStock = listings.filter((row) => Number(row?.availableStock ?? 0) > 0).length;

  if (!blocked && toZero >= 5 && withStock > 0 && toZero / withStock >= 0.4) {
    blocked = `Çok sayıda ürün (${toZero}) aynı anda 0'a düşecek; olağan dışı, gönderim durduruldu. WingSM verisini kontrol edin.`;
  }

  return {
    settings,
    matched: items.length + unchanged,
    unmatched,
    unchanged,
    items,
    blocked,
    wingDataAgeMinutes: ageMs === null ? null : Math.round(ageMs / 60000),
  };
}

export type ApplyResult = { sent: number; uploadIds: string[]; blocked: string | null; plan: StockPlan };

// Planı Hepsiburada'ya gönderir (yalnızca CHANGE kalemleri). blocked ise hiçbir şey göndermez.
export async function applyStockPlan(pool: Pool, mode: "MANUAL" | "AUTO"): Promise<ApplyResult> {
  const plan = await computeStockPlan(pool);
  const changes = plan.items.filter((item) => item.action === "CHANGE");
  const uploadIds: string[] = [];
  let sent = 0;

  if (plan.blocked || changes.length === 0) {
    await pool.query(`INSERT INTO public.hepsiburada_stock_log (mode, changes, sent, blocked) VALUES ($1, $2, 0, $3)`, [mode, changes.length, plan.blocked]);

    return { sent: 0, uploadIds, blocked: plan.blocked, plan };
  }

  try {
    for (let i = 0; i < changes.length; i += MAX_BATCH) {
      const batch = changes.slice(i, i + MAX_BATCH).map((item) => ({ hepsiburadaSku: item.hepsiburadaSku, availableStock: item.target }));
      const result = await hepsiburadaFetch(HEPSIBURADA_LISTING_BASE, "/listings/merchantid/{merchantId}/stock-uploads", { method: "POST", body: batch });

      if (!result.ok) throw new Error(`Hepsiburada stok yükleme HTTP ${result.status}: ${result.raw.slice(0, 300)}`);

      const id = String(result.body?.id ?? result.body?.uploadId ?? "").trim();

      if (id) uploadIds.push(id);

      sent += batch.length;
    }

    await pool.query(`INSERT INTO public.hepsiburada_stock_log (mode, changes, sent, upload_ids) VALUES ($1, $2, $3, $4)`, [mode, changes.length, sent, uploadIds.join(",")]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    await pool.query(`INSERT INTO public.hepsiburada_stock_log (mode, changes, sent, upload_ids, error) VALUES ($1, $2, $3, $4, $5)`, [mode, changes.length, sent, uploadIds.join(","), message.slice(0, 500)]);

    throw error;
  }

  return { sent, uploadIds, blocked: null, plan };
}

// Otomatik çalışma (cron): ayardan açıksa ve son otomatik çalışmadan en az 4 dakika geçtiyse planı uygular.
export async function runAutoStockSync(pool: Pool): Promise<{ skipped?: string; result?: ApplyResult }> {
  await ensureStockSyncTables(pool);

  const settings = await getSettings(pool);

  if (!settings.syncEnabled) return { skipped: "Otomatik stok gönderimi kapalı." };

  const last = await pool.query(`SELECT created_at FROM public.hepsiburada_stock_log WHERE mode = 'AUTO' ORDER BY id DESC LIMIT 1`);
  const lastAt = last.rows[0]?.created_at ? new Date(last.rows[0].created_at).getTime() : 0;

  if (lastAt && Date.now() - lastAt < 4 * 60 * 1000) return { skipped: "Son otomatik çalışmadan 4 dakika geçmedi." };

  return { result: await applyStockPlan(pool, "AUTO") };
}
