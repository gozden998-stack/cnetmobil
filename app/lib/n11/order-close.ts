// app/lib/n11/order-close.ts
//
// CNETMOBIL - N11 SİPARİŞİ -> İDEFİX STOK KAPATMA (sunucu tarafı, oturumsuz)
//
// N11'in son siparişlerini (sunucuda, tarayıcı/sipariş ekranı açık olmadan) okur. Sipariş kaleminin stok
// kodu IMEI ise (tekli ilan: stockCode = 15 haneli IMEI) o IMEI için İdefix kapatma kaydı kuyruğa atılır.
// Her sipariş kalemi yalnızca BİR kez işlenir (channel_close_seen_items, source = N11_ORDER).
//
// N11 stoğunu kendisi satışta düşürür; burada yalnızca DİĞER kanal (İdefix) kapatılır. N11'e yazma yok.
// İptal edilmiş siparişler (iptal statüsünde çekilmez) ve iptal/iade kalemleri satış sayılmaz.
//
// İLK ÇALIŞMA GÜVENLİĞİ: tablo bu kaynak için boşsa (ilk tur) son 10 dakikadan eski siparişler yalnızca
// "görüldü" işaretlenir, geçmiş siparişler için toplu kapatma yapılmaz.

import type { Pool } from "pg";

import { ensureChannelCloseTables, enqueueChannelClose } from "../channel-close/queue";

const N11_ORDERS_URL = "https://api.n11.com/rest/delivery/v1/shipmentPackages";

const STATUSES = ["Created", "Picking", "Shipped"] as const;
const LOOKBACK_MS = 3 * 24 * 60 * 60 * 1000;
const FIRST_RUN_FRESH_MS = 10 * 60 * 1000;
const MAX_PAGES = 3;
const DEAD_WORDS = ["cancel", "return", "refund", "reject", "iptal", "iade"];

const text = (value: unknown) => String(value ?? "").trim();

export type N11OrderPollSummary = {
  ordersRead: number;
  newItems: number;
  imeiItems: number;
  queued: number;
  skippedOld: number;
};

async function fetchStatus(appKey: string, appSecret: string, status: string, startDate: number, endDate: number) {
  const packages: any[] = [];

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const url = new URL(N11_ORDERS_URL);

    url.searchParams.set("startDate", String(startDate));
    url.searchParams.set("endDate", String(endDate));
    url.searchParams.set("status", status);
    url.searchParams.set("orderbyField", "true");
    url.searchParams.set("orderByDirection", "DESC");
    url.searchParams.set("page", String(page));
    url.searchParams.set("size", "100");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);

    try {
      const response = await fetch(url.toString(), {
        method: "GET",
        cache: "no-store",
        headers: { appkey: appKey, appsecret: appSecret, Accept: "application/json" },
        signal: controller.signal,
      });
      const raw = await response.text();
      let payload: any = null;

      try {
        payload = raw ? JSON.parse(raw) : null;
      } catch {
        payload = null;
      }

      if (!response.ok) {
        throw new Error(`N11 sipariş API hatası (${status}): ${text(payload?.message) || raw.slice(0, 300) || response.status}`);
      }

      const content: any[] = Array.isArray(payload?.content) ? payload.content : [];

      packages.push(...content);

      if (content.length < 100) break;
    } finally {
      clearTimeout(timeout);
    }
  }

  return packages;
}

export async function pollN11OrdersForClose(pool: Pool): Promise<N11OrderPollSummary> {
  const appKey = text(process.env.N11_APP_KEY);
  const appSecret = text(process.env.N11_APP_SECRET);

  if (!appKey || !appSecret) throw new Error("N11_APP_KEY veya N11_APP_SECRET eksik.");

  await ensureChannelCloseTables(pool);

  const summary: N11OrderPollSummary = { ordersRead: 0, newItems: 0, imeiItems: 0, queued: 0, skippedOld: 0 };
  const firstRun =
    Number(
      (await pool.query(`SELECT count(*)::int AS n FROM public.channel_close_seen_items WHERE source = 'N11_ORDER'`)).rows[0]?.n
    ) === 0;

  const now = Date.now();
  const seenPackages = new Set<string>();

  for (const status of STATUSES) {
    const packages = await fetchStatus(appKey, appSecret, status, now - LOOKBACK_MS, now);

    for (const pkg of packages) {
      const orderKey = text(pkg?.id) || text(pkg?.orderNumber);

      if (!orderKey || seenPackages.has(`${status}|${orderKey}`)) continue;

      seenPackages.add(`${status}|${orderKey}`);
      summary.ordersRead += 1;

      const modified = Number(pkg?.lastModifiedDate);
      const isFresh = Number.isFinite(modified) && now - modified <= FIRST_RUN_FRESH_MS;
      const lines: any[] = Array.isArray(pkg?.lines) ? pkg.lines : [];

      for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index];
        const lineState = text(line?.orderItemLineItemStatusName).toLowerCase();

        if (DEAD_WORDS.some((word) => lineState.includes(word))) continue;

        const itemKey = text(line?.orderLineId) || `${text(line?.stockCode)}#${index}`;
        const seen = await pool.query(
          `SELECT 1 FROM public.channel_close_seen_items WHERE source = 'N11_ORDER' AND order_key = $1 AND item_key = $2`,
          [orderKey, itemKey]
        );

        if (seen.rowCount) continue;

        const stockCode = text(line?.stockCode);
        const imei = /^\d{15}$/.test(stockCode) ? stockCode : null;

        summary.newItems += 1;

        if (imei && firstRun && !isFresh) {
          // İlk tur: eski siparişlere dokunma, sadece işaretle.
          summary.skippedOld += 1;
        } else if (imei) {
          summary.imeiItems += 1;
          // Önce kuyruğa at; hata olursa kalem "görüldü" sayılmaz, sonraki turda tekrar denenir.
          summary.queued += await enqueueChannelClose(pool, [imei], ["IDEFIX"], "N11_ORDER", { throwOnError: true });
        }

        await pool.query(
          `
            INSERT INTO public.channel_close_seen_items (source, order_key, item_key, imei)
            VALUES ('N11_ORDER', $1, $2, $3)
            ON CONFLICT DO NOTHING
          `,
          [orderKey, itemKey, imei]
        );
      }
    }
  }

  return summary;
}
