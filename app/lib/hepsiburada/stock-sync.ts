// app/lib/hepsiburada/stock-sync.ts
//
// CNETMOBIL - Hepsiburada STOK DÜŞÜRME (WingSM satışı -> Hepsiburada stok -1)
//
// Mantık: Hepsiburada'daki stok SENİN elinle belirlediğin adettir (örn. WingSM'de 45 var, sen 8 açarsın).
// WingSM'de bir eşleşmiş ürünün toplam stoğu (tüm depolar) azalınca, Hepsiburada stoğu aynı adet kadar DÜŞER (1 satış = -1).
// Stok ARTIRMA hiçbir zaman otomatik yapılmaz; artırmak istersen ürün satırından elle yazarsın.
//
// KURALLAR VE KORUMALAR
//   - Hepsiburada stoğu hiçbir zaman WingSM toplam stoğunu aşamaz (aşıyorsa WingSM toplamına çekilir; WingSM 0 ise 0).
//   - Hepsiburada'dan gelen sipariş zaten Hepsiburada stoğunu kendisi düşürür. O siparişin WingSM'deki satışı (sevk) sonradan
//     girilince ikinci kez düşürmemek için, açık Hepsiburada sipariş satırları "kredi" olarak izlenir ve WingSM düşüşü önce
//     bu kredilerden karşılanır (son 3 gün içinde görülen siparişler).
//   - WingSM sıfır stok verisi 15 dakikadan eskiyse hiçbir şey gönderilmez.
//   - Çok sayıda ürün aynı anda 0'a düşecekse (>=5 ürün ve %40+) gönderim durur ve uyarı verir.
//   - Otomatik çalışma ayardan açılmadıkça (hepsiburada_settings.sync_enabled) hiçbir şey yapmaz.
//   - İlk çalışmada yalnızca başlangıç değerleri (WingSM stok fotoğrafı, açık siparişler) kaydedilir.
//   - Gönderim başarısız olursa hiçbir kayıt ilerletilmez; sonraki dakikada aynı düşüş yeniden denenir.
// Hepsiburada'ya POST /listings/merchantid/{id}/stock-uploads  [{ hepsiburadaSku, availableStock }]. Fiyata dokunulmaz.

import type { Pool } from "pg";

import { HEPSIBURADA_LISTING_BASE, HEPSIBURADA_ORDERS_BASE, hepsiburadaFetch } from "./server";
import { ensureHepsiburadaMapTable, wingProductsByCode, wingProductsByHbSku, type WingProduct } from "./map";

const MAX_BATCH = 1000;
const STALE_MS = 15 * 60 * 1000;
const CREDIT_DAYS = 3;

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
      error TEXT,
      detail TEXT
    )
  `);
  await pool.query(`ALTER TABLE public.hepsiburada_stock_log ADD COLUMN IF NOT EXISTS detail TEXT`);
  // WingSM toplam stok fotoğrafı (satış = bir önceki fotoğraf - şimdiki toplam)
  await pool.query(`CREATE TABLE IF NOT EXISTS public.hepsiburada_wing_snapshot (mal_kod TEXT PRIMARY KEY, adet INTEGER NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
  // Hepsiburada açık sipariş satırları ve henüz WingSM düşüşüyle karşılanmamış adetleri
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.hepsiburada_order_lines (
      line_key TEXT PRIMARY KEY,
      hb_sku TEXT NOT NULL,
      qty INTEGER NOT NULL,
      consumed INTEGER NOT NULL DEFAULT 0,
      first_seen TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  ready = true;
}

export type HepsiburadaSettings = { syncEnabled: boolean };

export async function getSettings(pool: Pool): Promise<HepsiburadaSettings> {
  await ensureStockSyncTables(pool);

  const result = await pool.query(`SELECT value FROM public.hepsiburada_settings WHERE key = 'sync_enabled'`);

  return { syncEnabled: result.rows[0]?.value === "1" };
}

export async function saveSettings(pool: Pool, input: { syncEnabled?: unknown }) {
  await ensureStockSyncTables(pool);

  if (input.syncEnabled !== undefined) {
    const enabled = input.syncEnabled === true;

    await pool.query(
      `INSERT INTO public.hepsiburada_settings (key, value) VALUES ('sync_enabled', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
      [enabled ? "1" : "0"]
    );

    // Kapatılıp yeniden açılınca eski fotoğraf/sipariş kayıtları geçersiz: baştan başlangıç değeri alınır (kapalıyken olan satışlar sayılmaz).
    if (enabled) {
      await pool.query(`DELETE FROM public.hepsiburada_wing_snapshot`);
      await pool.query(`DELETE FROM public.hepsiburada_order_lines`);
      await pool.query(`DELETE FROM public.hepsiburada_settings WHERE key = 'orders_baseline'`);
    }
  }
}

export async function fetchAllListings() {
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

type OrderLine = { key: string; hbSku: string; qty: number };

// Açık (Open) sipariş satırları.
async function fetchOpenOrderLines(): Promise<OrderLine[]> {
  const lines: OrderLine[] = [];

  for (let offset = 0; offset < 5000; offset += 100) {
    const result = await hepsiburadaFetch(HEPSIBURADA_ORDERS_BASE, "/orders/merchantid/{merchantId}", { query: { offset, limit: 100 } });

    if (!result.ok) throw new Error(`Hepsiburada sipariş HTTP ${result.status}`);

    const items: any[] = Array.isArray(result.body?.items) ? result.body.items : [];

    items.forEach((item, index) => {
      const hbSku = String(item?.sku ?? "").trim().toUpperCase();

      if (!hbSku) return;

      const id = String(item?.id ?? item?.lineItemId ?? item?.orderLineId ?? "").trim();
      const key = id || `${String(item?.orderNumber ?? "")}:${hbSku}:${offset + index}`;

      lines.push({ key, hbSku, qty: Math.max(1, Number(item?.quantity) || 1) });
    });

    if (items.length < 100) break;
  }

  return lines;
}

export type PlanItem = {
  hepsiburadaSku: string;
  malKod: string;
  productName: string;
  current: number;
  wing: number;
  sold: number;
  target: number;
  reason: string;
};

type Persist = {
  snapshots: Array<[string, number]>;
  consumeLines: Array<[string, number]>; // line_key -> bu çalışmada karşılanan adet
  newLines: OrderLine[];
  newLinesConsumed: boolean; // true: ilk çalışma, kredi verme
  keepLineKeys: string[];
  markBaseline: boolean;
};

export type StockPlan = {
  settings: HepsiburadaSettings;
  matched: number;
  unmatched: number;
  items: PlanItem[];
  blocked: string | null;
  baseline: boolean;
  wingDataAgeMinutes: number | null;
  persist: Persist;
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
  const orderLines = await fetchOpenOrderLines();

  const snapRows = await pool.query(`SELECT mal_kod, adet FROM public.hepsiburada_wing_snapshot`);
  const snapshots = new Map<string, number>(snapRows.rows.map((row) => [String(row.mal_kod), Number(row.adet)]));
  const baselineRow = await pool.query(`SELECT value FROM public.hepsiburada_settings WHERE key = 'orders_baseline'`);
  const ordersBaselineDone = baselineRow.rows[0]?.value === "1";
  const lineRows = await pool.query(`SELECT line_key, hb_sku, qty, consumed, first_seen FROM public.hepsiburada_order_lines ORDER BY first_seen ASC, line_key ASC`);
  const knownLines = new Map<string, { hbSku: string; qty: number; consumed: number; fresh: boolean }>();
  const creditSince = Date.now() - CREDIT_DAYS * 24 * 60 * 60 * 1000;

  for (const row of lineRows.rows) {
    knownLines.set(String(row.line_key), {
      hbSku: String(row.hb_sku).toUpperCase(),
      qty: Number(row.qty),
      consumed: Number(row.consumed),
      fresh: new Date(row.first_seen).getTime() > creditSince,
    });
  }

  const openKeys = new Set(orderLines.map((line) => line.key));
  const newLines = orderLines.filter((line) => !knownLines.has(line.key));
  // Her ürün için karşılanmamış sipariş kredisi (sıra: eskiden yeniye); 3 günden eski satırlar kredi vermez.
  const creditByLine = new Map<string, number>();

  for (const [key, line] of knownLines) if (openKeys.has(key) && line.fresh) creditByLine.set(key, Math.max(0, line.qty - line.consumed));
  // Yeni satırlar (ilk çalışma değilse) kredi sayılır
  if (ordersBaselineDone) for (const line of newLines) creditByLine.set(line.key, line.qty);

  const lineSku = new Map<string, string>();

  for (const [key, line] of knownLines) lineSku.set(key, line.hbSku);
  for (const line of newLines) lineSku.set(line.key, line.hbSku);

  const consumeLines = new Map<string, number>();
  const items: PlanItem[] = [];
  const snapshotWrites = new Map<string, number>();
  let unmatched = 0;
  let matched = 0;
  let baseline = false;
  // Otomatik eşleşenler kalıcı kaydedilir: ürün WingSM listesinden düşse bile eşleşme kaybolmaz ve stok 0'a çekilebilir.
  const autoMaps = new Map<string, string>();

  for (const row of listings) {
    const hbSku = String(row?.hepsiburadaSku ?? "").trim();
    const merchantSku = String(row?.merchantSku ?? "").trim();
    const manualCode = manual.get(hbSku) ?? null;
    const skuMatch = !manualCode ? bySku.get(hbSku) ?? null : null;
    const product: WingProduct | null = skuMatch ?? (manualCode ? byCode.get(manualCode) ?? null : byCode.get(merchantSku) ?? null);
    const matchedByManualOnly = Boolean(manualCode) && !product;

    if (!product && !matchedByManualOnly) {
      unmatched += 1;
      continue;
    }

    matched += 1;

    const malKod = String(product?.mal_kod ?? manualCode ?? "");

    if (!manualCode && product) autoMaps.set(hbSku, malKod);

    const wing = product?.adet ?? 0;
    const current = Number(row?.availableStock ?? 0);
    const prev = snapshots.get(malKod);

    // Başlangıç: fotoğraf yoksa yalnız kaydedilir (satış sayılmaz).
    if (prev === undefined) baseline = true;

    const drop = prev === undefined ? 0 : Math.max(0, prev - wing);
    let eff = drop;

    // WingSM düşüşünü önce bu ürünün Hepsiburada siparişlerinden karşıla (Hepsiburada stoğu zaten düşmüş).
    if (drop > 0) {
      for (const [key, credit] of creditByLine) {
        if (eff <= 0) break;
        if (lineSku.get(key) !== hbSku.toUpperCase() || credit <= 0) continue;

        const take = Math.min(eff, credit);

        creditByLine.set(key, credit - take);
        consumeLines.set(key, (consumeLines.get(key) ?? 0) + take);
        eff -= take;
      }
    }

    // Hedef: satış kadar düşür, WingSM toplamını aşma. Asla artırma.
    const target = Math.max(0, Math.min(current - eff, wing));

    snapshotWrites.set(malKod, wing);

    if (target < current) {
      items.push({
        hepsiburadaSku: hbSku,
        malKod,
        productName: product?.mal_ad ?? "",
        current,
        wing,
        sold: eff,
        target,
        reason: eff > 0 ? `WingSM'de ${drop} satış, Hepsiburada stoğu ${eff} düşürüldü` : `Stok WingSM toplamını (${wing}) aşıyordu`,
      });
    }
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
  const toZero = items.filter((item) => item.target === 0 && item.current > 0).length;
  const withStock = listings.filter((row) => Number(row?.availableStock ?? 0) > 0).length;

  if (!blocked && toZero >= 5 && withStock > 0 && toZero / withStock >= 0.4) {
    blocked = `Çok sayıda ürün (${toZero}) aynı anda 0'a düşecek; olağan dışı, gönderim durduruldu. WingSM verisini kontrol edin.`;
  }

  return {
    settings,
    matched,
    unmatched,
    items,
    blocked,
    baseline,
    wingDataAgeMinutes: ageMs === null ? null : Math.round(ageMs / 60000),
    persist: {
      snapshots: Array.from(snapshotWrites.entries()),
      consumeLines: Array.from(consumeLines.entries()),
      newLines,
      newLinesConsumed: !ordersBaselineDone,
      keepLineKeys: Array.from(openKeys),
      markBaseline: !ordersBaselineDone,
    },
  };
}

// Fotoğraf ve sipariş kayıtlarını ilerletir (yalnız başarılı/gereksiz-gönderim durumunda çağrılır).
async function persistPlan(pool: Pool, persist: Persist) {
  if (persist.snapshots.length > 0) {
    await pool.query(
      `INSERT INTO public.hepsiburada_wing_snapshot (mal_kod, adet) SELECT t.kod, t.adet FROM unnest($1::text[], $2::int[]) AS t(kod, adet)
       ON CONFLICT (mal_kod) DO UPDATE SET adet = EXCLUDED.adet, updated_at = now()`,
      [persist.snapshots.map(([kod]) => kod), persist.snapshots.map(([, adet]) => adet)]
    );
  }

  for (const line of persist.newLines) {
    await pool.query(`INSERT INTO public.hepsiburada_order_lines (line_key, hb_sku, qty, consumed) VALUES ($1, $2, $3, $4) ON CONFLICT (line_key) DO NOTHING`, [
      line.key,
      line.hbSku,
      line.qty,
      persist.newLinesConsumed ? line.qty : 0,
    ]);
  }

  for (const [key, take] of persist.consumeLines) {
    await pool.query(`UPDATE public.hepsiburada_order_lines SET consumed = LEAST(qty, consumed + $2) WHERE line_key = $1`, [key, take]);
  }

  // Açık listeden çıkan (sevk edilen/iptal) satırlar silinir.
  await pool.query(`DELETE FROM public.hepsiburada_order_lines WHERE NOT (line_key = ANY($1::text[]))`, [persist.keepLineKeys]);

  if (persist.markBaseline) {
    await pool.query(
      `INSERT INTO public.hepsiburada_settings (key, value) VALUES ('orders_baseline', '1') ON CONFLICT (key) DO UPDATE SET value = '1', updated_at = now()`
    );
  }
}

export type ApplyResult = { sent: number; uploadIds: string[]; blocked: string | null; baseline: boolean; plan: StockPlan };

// Planı uygular: düşürülecek ürünlerin stoğunu Hepsiburada'ya gönderir, sonra kayıtları ilerletir.
export async function applyStockPlan(pool: Pool, mode: "MANUAL" | "AUTO"): Promise<ApplyResult> {
  const plan = await computeStockPlan(pool);
  const changes = plan.items;
  const uploadIds: string[] = [];
  let sent = 0;

  if (plan.blocked) {
    await pool.query(`INSERT INTO public.hepsiburada_stock_log (mode, changes, sent, blocked) VALUES ($1, $2, 0, $3)`, [mode, changes.length, plan.blocked]);

    return { sent: 0, uploadIds, blocked: plan.blocked, baseline: plan.baseline, plan };
  }

  if (changes.length === 0) {
    await persistPlan(pool, plan.persist);

    return { sent: 0, uploadIds, blocked: null, baseline: plan.baseline, plan };
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

    await persistPlan(pool, plan.persist);
    await pool.query(`INSERT INTO public.hepsiburada_stock_log (mode, changes, sent, upload_ids, detail) VALUES ($1, $2, $3, $4, $5)`, [
      mode,
      changes.length,
      sent,
      uploadIds.join(","),
      changes.map((item) => `${item.hepsiburadaSku}: ${item.current}->${item.target}`).join("; ").slice(0, 1500),
    ]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    await pool.query(`INSERT INTO public.hepsiburada_stock_log (mode, changes, sent, upload_ids, error) VALUES ($1, $2, $3, $4, $5)`, [mode, changes.length, sent, uploadIds.join(","), message.slice(0, 500)]);

    throw error;
  }

  return { sent, uploadIds, blocked: null, baseline: plan.baseline, plan };
}

// Otomatik çalışma (dakikalık cron): ayardan açıksa planı uygular.
export async function runAutoStockSync(pool: Pool): Promise<{ skipped?: string; result?: ApplyResult }> {
  await ensureStockSyncTables(pool);

  const settings = await getSettings(pool);

  if (!settings.syncEnabled) return { skipped: "Otomatik stok düşürme kapalı." };

  return { result: await applyStockPlan(pool, "AUTO") };
}

export async function recentLog(pool: Pool, limit = 8) {
  await ensureStockSyncTables(pool);

  const result = await pool.query(`SELECT created_at, mode, changes, sent, blocked, error, detail FROM public.hepsiburada_stock_log ORDER BY id DESC LIMIT $1`, [limit]);

  return result.rows;
}
