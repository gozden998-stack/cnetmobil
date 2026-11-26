// app/lib/online/channel-status.ts
//
// CNETMOBIL - Bir mağazanın stoğundaki IMEI'lerin ONLINE kanallarda (N11, İdefix, İKAS, Garantili) açık olup olmadığı (SALT OKUNUR)
//
// Kaynaklar (hiçbirine yazılmaz, hiçbir pazaryerine istek atılmaz):
//   N11      : online_listings (tekli ilan: stok kodu = IMEI, quantity>0 = satışta; havuz ilanı: raw_data.availableImeis) + online_channel_devices
//   İDEFİX   : online_listings (stok kodu IMEI ya da CNET-IDF-IMEI, raw_data.sourceImei) + online_channel_devices
//   İKAS     : online_channel_devices
//   GARANTİLİ: garantili_devices
// Durumlar: ACIK (satışta) · BEKLIYOR (açılıyor/doğrulanıyor) · KAPALI (ilan var ama stok 0/pasif/kapandı) · YOK (hiç açılmamış)
// N11 stoğu saat başı N11'den import edilir (DB quantity = N11'deki değer); yani durum en fazla ~1 saat eski olabilir.

import type { Pool } from "pg";

import { ensureGarantiliTables } from "../garantili/store";

export type KanalKodu = "N11" | "IDEFIX" | "IKAS" | "GARANTILI";
export type KanalDurum = "ACIK" | "BEKLIYOR" | "KAPALI" | "YOK";
export type KanalBilgi = { durum: KanalDurum; not: string | null };
export type ImeiKanallari = Record<KanalKodu, KanalBilgi>;

const KANALLAR: KanalKodu[] = ["N11", "IDEFIX", "IKAS", "GARANTILI"];
const ORDER: Record<KanalDurum, number> = { YOK: 0, KAPALI: 1, BEKLIYOR: 2, ACIK: 3 };
const PENDING_SYNC = new Set(["IN_QUEUE", "DRAFT", "SYNCED_PENDING_QUERY", "PENDING", "PENDING_CREATE"]);

const empty = (): ImeiKanallari => ({
  N11: { durum: "YOK", not: null },
  IDEFIX: { durum: "YOK", not: null },
  IKAS: { durum: "YOK", not: null },
  GARANTILI: { durum: "YOK", not: null },
});

function raise(target: ImeiKanallari, channel: KanalKodu, durum: KanalDurum, not: string | null) {
  const current = target[channel];

  // Daha "açık" olan kazanır; eşitse ilk not kalır
  if (ORDER[durum] > ORDER[current.durum]) target[channel] = { durum, not };
}

const membershipDurum = (status: unknown): KanalDurum => {
  const value = String(status ?? "").trim().toUpperCase();

  if (value === "LISTED" || value === "RESERVED") return "ACIK";
  if (value === "PENDING_CREATE") return "BEKLIYOR";

  return "KAPALI";
};

export async function getChannelStatusForImeis(pool: Pool, imeis: string[]): Promise<Record<string, ImeiKanallari>> {
  const list = Array.from(new Set(imeis.map((value) => String(value ?? "").trim()).filter((value) => /^\d{15}$/.test(value))));
  const out: Record<string, ImeiKanallari> = Object.fromEntries(list.map((imei) => [imei, empty()]));

  if (!list.length) return out;

  const idefixCodes = list.flatMap((imei) => [imei, `CNET-IDF-${imei}`]);

  const hasMembership = (await pool.query(`SELECT to_regclass('public.online_channel_devices') IS NOT NULL AS ok`)).rows[0]?.ok === true;

  const [n11Single, n11Pool, idefix, membership, garantili] = await Promise.all([
    pool.query(
      `SELECT external_stock_code AS imei, COALESCE(quantity, 0) AS quantity, sync_status
       FROM public.online_listings
       WHERE channel = 'N11' AND external_stock_code = ANY($1::text[])`,
      [list]
    ),
    pool.query(
      `SELECT x.imei, COALESCE(l.quantity, 0) AS quantity
       FROM public.online_listings l, jsonb_array_elements_text(l.raw_data -> 'availableImeis') AS x(imei)
       WHERE l.channel = 'N11' AND jsonb_typeof(l.raw_data -> 'availableImeis') = 'array' AND x.imei = ANY($1::text[])`,
      [list]
    ),
    pool.query(
      `SELECT COALESCE(NULLIF(raw_data ->> 'sourceImei', ''), regexp_replace(external_stock_code, '^CNET-IDF-', '')) AS imei,
              COALESCE(quantity, 0) AS quantity
       FROM public.online_listings
       WHERE channel = 'IDEFIX'
         AND (external_stock_code = ANY($1::text[]) OR raw_data ->> 'sourceImei' = ANY($2::text[]))`,
      [idefixCodes, list]
    ),
    hasMembership
      ? pool.query(
          `SELECT imei, channel, membership_status
           FROM public.online_channel_devices
           WHERE imei = ANY($1::text[]) AND channel IN ('N11', 'IDEFIX', 'IKAS')`,
          [list]
        )
      : Promise.resolve({ rows: [] as any[] }),
    (async () => {
      await ensureGarantiliTables(pool);

      return pool.query(`SELECT imei, status FROM public.garantili_devices WHERE imei = ANY($1::text[])`, [list]);
    })(),
  ]);

  for (const row of n11Single.rows) {
    const target = out[String(row.imei)];

    if (!target) continue;

    const quantity = Number(row.quantity) || 0;
    const sync = String(row.sync_status ?? "").toUpperCase();

    if (quantity > 0) raise(target, "N11", "ACIK", `stok ${quantity}`);
    else if (PENDING_SYNC.has(sync)) raise(target, "N11", "BEKLIYOR", `N11'e gönderildi (${sync})`);
    else raise(target, "N11", "KAPALI", sync === "ERROR" ? "hata" : "stok 0");
  }

  for (const row of n11Pool.rows) {
    const target = out[String(row.imei)];

    if (!target) continue;

    if ((Number(row.quantity) || 0) > 0) raise(target, "N11", "ACIK", "havuz ilanı");
    else raise(target, "N11", "KAPALI", "havuz ilanı, stok 0");
  }

  for (const row of idefix.rows) {
    const target = out[String(row.imei)];

    if (!target) continue;

    if ((Number(row.quantity) || 0) > 0) raise(target, "IDEFIX", "ACIK", `stok ${Number(row.quantity)}`);
    else raise(target, "IDEFIX", "KAPALI", "stok 0");
  }

  for (const row of membership.rows) {
    const target = out[String(row.imei)];
    const channel = String(row.channel).toUpperCase() as KanalKodu;

    if (!target || !KANALLAR.includes(channel)) continue;

    const durum = membershipDurum(row.membership_status);

    // N11/İdefix'te canlı ilan miktarı daha güvenilir; üyelik yalnız ilan kaydı yoksa durum belirler
    if (channel !== "IKAS" && target[channel].durum !== "YOK") continue;

    raise(target, channel, durum, `üyelik ${String(row.membership_status ?? "").toLowerCase()}`);
  }

  for (const row of garantili.rows) {
    const target = out[String(row.imei)];

    if (!target) continue;

    const status = String(row.status ?? "").toUpperCase();

    if (status === "OPEN") raise(target, "GARANTILI", "ACIK", "ilanda");
    else if (status === "OPENING") raise(target, "GARANTILI", "BEKLIYOR", "açılıyor");
    else if (status === "REMOVE_REQUESTED") raise(target, "GARANTILI", "ACIK", "kaldırma talebi var");
    else raise(target, "GARANTILI", "KAPALI", status.toLowerCase());
  }

  return out;
}

// Mağazanın (stock_devices.current_branch_code) stoğundaki IMEI'ler. Cihaz Talep tablosundaki "stok" ile aynı sayılan durumlar.
export async function getChannelStatusForDepo(pool: Pool, depo: string): Promise<Record<string, ImeiKanallari>> {
  const result = await pool.query(
    `SELECT imei FROM public.stock_devices
     WHERE current_branch_code = $1 AND status IN ('AVAILABLE', 'REQUESTED', 'TRANSFER_WAITING') AND imei ~ '^[0-9]{15}$'
     LIMIT 3000`,
    [depo]
  );

  return getChannelStatusForImeis(pool, result.rows.map((row: any) => String(row.imei)));
}
