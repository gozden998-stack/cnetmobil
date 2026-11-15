// app/lib/idefix/order-close.ts
//
// CNETMOBIL - İdefix SİPARİŞİ -> N11 STOK KAPATMA
//
// İdefix'in son siparişlerini (sunucu tarafında, oturumsuz) okur. Satış sayılan durumdaki bir sipariş
// kaleminin stok kodundan (merchantSku = "CNET-IDF-<IMEI>") IMEI çıkarılırsa, o IMEI için N11 kapatma
// kaydı kuyruğa atılır. Her sipariş kalemi yalnızca BİR kez işlenir (channel_close_seen_items).
// IMEI'li stok koduyla açılmamış eski ilanların siparişlerinde IMEI çıkmaz; kalem sadece "görüldü"
// diye işaretlenir, hiçbir şey kapatılmaz.
//
// İptal/iade/red durumundaki siparişler SATIŞ sayılmaz. İdefix kendi stoğunu satışta zaten düşürür;
// burada sadece DİĞER kanal (N11) kapatılır. İdefix'e yazma yok.

import type { Pool } from "pg";

import { ensureChannelCloseTables, enqueueChannelClose } from "../channel-close/queue";
import { getIdefixVendorId, idefixFetch } from "./server";
import { imeiFromIdefixSku, markIdefixMembershipPassive } from "./stock";

const text = (value: unknown) => String(value ?? "").trim();

const normalizeState = (value: unknown) => text(value).toLowerCase().replace(/[\s-]+/g, "_");

// Siparişi satış sayan durumlar (İdefix siparişler ekranındaki "yeni/hazırlanan/kargoda/teslim" kovaları).
const SALE_ORDER_STATES = new Set([
  "created",
  "shipment_ready",
  "shipment_picking",
  "shipment_invoiced",
  "shipment_in_cargo",
  "shipment_delivered",
  "shipment_approved",
]);

const DEAD_ITEM_WORDS = ["cancel", "return", "refund", "reject", "undeliver", "iptal", "iade"];

const PAGE_LIMIT = 50;
const MAX_PAGES = 2;

export type IdefixOrderPollSummary = {
  ordersRead: number;
  newItems: number;
  imeiItems: number;
  queued: number;
  withoutImei: number;
};

export async function pollIdefixOrdersForClose(pool: Pool): Promise<IdefixOrderPollSummary> {
  await ensureChannelCloseTables(pool);

  const vendorId = getIdefixVendorId();
  const summary: IdefixOrderPollSummary = { ordersRead: 0, newItems: 0, imeiItems: 0, queued: 0, withoutImei: 0 };

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const query = new URLSearchParams({
      page: String(page),
      limit: String(PAGE_LIMIT),
      sortByField: "updateAt",
      sortDirection: "desc",
      vendor: String(vendorId),
    });

    const payload = await idefixFetch(`/oms/${encodeURIComponent(vendorId)}/list?${query.toString()}`);
    const orders: any[] = Array.isArray(payload?.items) ? payload.items : [];

    for (const order of orders) {
      summary.ordersRead += 1;

      if (!SALE_ORDER_STATES.has(normalizeState(order?.status))) continue;

      const orderKey = text(order?.id) || text(order?.orderNumber);

      if (!orderKey) continue;

      const items: any[] = Array.isArray(order?.items) ? order.items : [];

      for (let index = 0; index < items.length; index += 1) {
        const item = items[index];
        const itemState = normalizeState(item?.itemStatus);

        if (DEAD_ITEM_WORDS.some((word) => itemState.includes(word))) continue;

        const itemKey = text(item?.id) || `${text(item?.barcode)}#${index}`;
        const imei = imeiFromIdefixSku(item?.merchantSku);

        // Daha önce görülen kalem tekrar işlenmez.
        const seen = await pool.query(
          `SELECT 1 FROM public.channel_close_seen_items WHERE source = 'IDEFIX_ORDER' AND order_key = $1 AND item_key = $2`,
          [orderKey, itemKey]
        );

        if (seen.rowCount) continue;

        summary.newItems += 1;

        if (imei) {
          summary.imeiItems += 1;

          // Önce kuyruğa at (hata olursa kalem "görüldü" sayılmaz, sonraki turda tekrar denenir).
          await markIdefixMembershipPassive(pool, imei, "IDEFIX_ORDER");
          summary.queued += await enqueueChannelClose(pool, [imei], ["N11"], "IDEFIX_ORDER", { throwOnError: true });
        } else {
          summary.withoutImei += 1;
        }

        await pool.query(
          `
            INSERT INTO public.channel_close_seen_items (source, order_key, item_key, imei)
            VALUES ('IDEFIX_ORDER', $1, $2, $3)
            ON CONFLICT DO NOTHING
          `,
          [orderKey, itemKey, imei]
        );
      }
    }

    if (orders.length < PAGE_LIMIT) break;
  }

  return summary;
}
