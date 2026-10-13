// app/api/supply/_server.ts
//
// "Mağaza Tedarik" (temizlik malzemesi vb. sarf ürün talep) özelliği
// için paylaşılan yardımcılar. Oturum/rol dogrulamasi mevcut, test
// edilmis Ihale altyapisindan (app/api/auctions/_server.ts) aynen
// yeniden kullaniliyor - ayri bir auth katmani yazip risk almiyoruz.

import type { PoolClient } from "pg";

import {
  apiError,
  cleanAuctionText,
  getAuctionPool,
  getAuctionSession,
  numberValue,
  type AuctionSession,
} from "../auctions/_server";

export {
  apiError,
  cleanAuctionText,
  getAuctionPool as getSupplyPool,
  getAuctionSession as getSupplySession,
  numberValue,
};

export type SupplySession = AuctionSession;

// Tedarik'i olusturma/yonetme yetkisi Ihale'den farkli: Super Admin
// SARTI YOK, herhangi bir yonetici/admin oturumu yeterli (kullanicinin
// acik istegi: "yonetici admin mail ile giren kisi urunleri acacak").
export function ensureSupplyManager(
  session: SupplySession
) {
  if (!session.isManager) {
    throw Object.assign(
      new Error(
        "Bu işlem sadece yönetici/admin oturumu ile yapılabilir."
      ),
      { status: 403 }
    );
  }
}

// Talep gonderme Vodafone Kanali VE CMR oturumlarina acik.
export function ensureRequestChannel(
  session: SupplySession
) {
  if (
    session.channel !== "VODAFONE" &&
    session.channel !== "CMR" &&
    !session.isManager
  ) {
    throw Object.assign(
      new Error(
        "Mağaza Tedarik sadece Vodafone Kanalı ve CMR mağazalarına açıktır."
      ),
      { status: 403 }
    );
  }
}

// Vodafone Kanali tek bir girisi paylastigi icin (Meydan/Saray/Erna/
// Tekira ayni oturum), talep formunda hangi fiziksel subenin talep
// ettigini elle secmemiz gerekiyor. CMR'de ise her magazanin (CMR
// MERKEZ/CADDE/SARAY/KAPAKLI) KENDI oturumu oldugu icin sube adi
// dogrudan session.branch'ten alinir, elle secim GEREKMEZ.
export const VODAFONE_SHOPS = [
  "MEYDAN",
  "SARAY",
  "ERNA",
  "TEKİRA",
] as const;

export type VodafoneShop = (typeof VODAFONE_SHOPS)[number];

export function isValidVodafoneShop(
  value: unknown
): value is VodafoneShop {
  const normalized = String(value ?? "")
    .trim()
    .toLocaleUpperCase("tr-TR");

  return (VODAFONE_SHOPS as readonly string[]).includes(normalized);
}

// Bir magazanin sepetini gonderdiginde olusan/guncellenen siparisin
// durumu - online alisveris sepeti gibi: BEKLEMEDE -> HAZIRLANIYOR ->
// GONDERILDI. Sadece yonetici ilerletebilir/geri alabilir.
export const SUPPLY_ORDER_STATUSES = [
  "BEKLEMEDE",
  "HAZIRLANIYOR",
  "GONDERILDI",
] as const;

export type SupplyOrderStatus = (typeof SUPPLY_ORDER_STATUSES)[number];

export function isValidSupplyOrderStatus(
  value: unknown
): value is SupplyOrderStatus {
  return (SUPPLY_ORDER_STATUSES as readonly string[]).includes(
    String(value ?? "")
  );
}

// Bir talebi kaydederken kullanilacak GERCEK magaza adini belirler:
// - VODAFONE: kullanicinin formda sectigi deger (Meydan/Saray/Erna/Tekira).
// - CMR (ve diger her sey): oturumun kendi magazasi - client'in
//   gonderdigi deger GUVENILMEZ/YOK SAYILIR, boylece bir CMR magazasi
//   baska bir CMR magazasi adina talep giremez.
export function resolveRequestShopName(
  session: SupplySession,
  requestedShopName: unknown
): { ok: true; shopName: string } | { ok: false; error: string } {
  if (session.channel === "VODAFONE") {
    const normalized = String(requestedShopName ?? "")
      .trim()
      .toLocaleUpperCase("tr-TR");

    if (!isValidVodafoneShop(normalized)) {
      return { ok: false, error: "Geçersiz mağaza seçimi." };
    }

    return { ok: true, shopName: normalized };
  }

  const branch = session.branch.trim();

  if (!branch) {
    return { ok: false, error: "Mağaza bilgisi bulunamadı." };
  }

  return { ok: true, shopName: branch.toLocaleUpperCase("tr-TR") };
}

// ======================================================
// TABLOLAR - migration dosyasi bu repoda yok (DB disaridan
// yonetiliyor), mevcut kod tabanindaki "CREATE TABLE IF NOT EXISTS"
// deseniyle ayni (bkz. wingsm_deger_puan_snapshots).
//
// VERI MODELI (kullanicinin acik istegiyle: "donem yok, her gun her saat
// siparis gecilebilsin"):
// - supply_catalog_items: KALICI urun kataloğu. Yonetici bir urunu
//   BIR KEZ ekler; aktif urunlerin hepsi her zaman siparise aciktir.
// - supply_shop_orders / supply_shop_order_items: her sepet gonderimi
//   bagimsiz bir siparis (durum BEKLEMEDE -> HAZIRLANIYOR -> GONDERILDI,
//   kalem basina istenen / gonderilen adet).
// - supply_periods / supply_requests / supply_orders: ESKI donem
//   modeli; artik kullanilmiyor, sadece tek seferlik goc icin duruyor.
// ======================================================

// Ilk surumde (commit 10bb2b6) "supply_requests" tablosu farkli bir
// semayla (period_id YOK, UNIQUE(item_id, shop_name)) zaten production'da
// olusturulmustu. "CREATE TABLE IF NOT EXISTS" mevcut tabloyu DEGISTIRMEZ,
// bu yuzden yeni koda gore period_id sutunu eksik kalip "column period_id
// does not exist" hatasi veriyordu. Eski tabloyu SILMIYORUZ - olasi test
// verisini korumak icin kenara (supply_requests_legacy) tasiyip, asagidaki
// CREATE TABLE'in yeni semayla sifirdan olusturmasina birakiyoruz.
async function migrateLegacySupplyRequestsTable(client: PoolClient) {
  const tableCheck = await client.query(`
    SELECT
      EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'supply_requests'
      ) AS table_exists,
      EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'supply_requests'
          AND column_name = 'period_id'
      ) AS has_period_id
  `);

  const { table_exists: tableExists, has_period_id: hasPeriodId } =
    tableCheck.rows[0] || {};

  if (tableExists && !hasPeriodId) {
    await client.query(`
      ALTER TABLE public.supply_requests
      RENAME TO supply_requests_legacy
    `);
  }
}

// Tedarik artik "donem" tutmuyor: her gun her saat siparis gecilebilir.
// Her sepet gonderimi BAGIMSIZ bir siparis (supply_shop_orders) olusturur,
// kalemleri supply_shop_order_items'ta durur. Eski donem tablolari
// (supply_periods / supply_requests / supply_orders) silinmedi; icindeki
// siparisler asagidaki tek seferlik gocle yeni tablolara kopyalandi.
let supplyTablesReady = false;

async function ensureShopOrderTables(client: PoolClient) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.supply_shop_orders (
      id SERIAL PRIMARY KEY,
      shop_name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'BEKLEMEDE',
      submitted_by_user_key TEXT,
      submitted_by_name TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      legacy_order_id INTEGER
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS public.supply_shop_order_items (
      id SERIAL PRIMARY KEY,
      order_id INTEGER NOT NULL REFERENCES public.supply_shop_orders(id) ON DELETE CASCADE,
      item_id INTEGER NOT NULL REFERENCES public.supply_catalog_items(id),
      quantity INTEGER NOT NULL,
      delivered_quantity INTEGER,
      UNIQUE (order_id, item_id)
    )
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS supply_shop_orders_created_idx
    ON public.supply_shop_orders (created_at DESC)
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS public.supply_migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  // Eski donem siparislerini BIR KEZ kopyala. Isaret satiri ayni islemde
  // yazildigi icin yarisan iki istek ikinci kez kopyalayamaz, ve yonetici
  // sonradan bir siparisi silse bile geri gelmez.
  await client.query("BEGIN");

  try {
    const marker = await client.query(`
      INSERT INTO public.supply_migrations (name)
      VALUES ('shop_orders_from_periods')
      ON CONFLICT (name) DO NOTHING
      RETURNING name
    `);

    if (marker.rowCount) {
      await client.query(`
        INSERT INTO public.supply_shop_orders (
          shop_name, status, submitted_by_user_key, submitted_by_name,
          created_at, updated_at, legacy_order_id
        )
        SELECT o.shop_name, o.status, o.submitted_by_user_key, o.submitted_by_name,
               o.created_at, o.updated_at, o.id
        FROM public.supply_orders o
        JOIN public.supply_periods p ON p.id = o.period_id
        JOIN (
          SELECT DISTINCT period_id, shop_name FROM public.supply_requests
        ) r ON r.period_id = o.period_id AND r.shop_name = o.shop_name
        WHERE p.status IN ('LIVE', 'ENDED')
        ORDER BY o.id
      `);

      await client.query(`
        INSERT INTO public.supply_shop_order_items (order_id, item_id, quantity, delivered_quantity)
        SELECT n.id, r.item_id, r.quantity, r.delivered_quantity
        FROM public.supply_shop_orders n
        JOIN public.supply_orders o ON o.id = n.legacy_order_id
        JOIN public.supply_requests r
          ON r.period_id = o.period_id AND r.shop_name = o.shop_name
        ON CONFLICT (order_id, item_id) DO NOTHING
      `);
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

export async function ensureSupplyTables(
  client: PoolClient
) {
  if (supplyTablesReady) return;

  await migrateLegacySupplyRequestsTable(client);

  await client.query(`
    CREATE TABLE IF NOT EXISTS public.supply_catalog_items (
      id SERIAL PRIMARY KEY,
      item_name TEXT NOT NULL,
      item_note TEXT,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS public.supply_periods (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'DRAFT',
      duration_minutes INTEGER,
      starts_at TIMESTAMPTZ,
      ends_at TIMESTAMPTZ,
      created_by_user_id TEXT,
      created_by_name TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS public.supply_requests (
      id SERIAL PRIMARY KEY,
      period_id INTEGER NOT NULL REFERENCES public.supply_periods(id) ON DELETE CASCADE,
      item_id INTEGER NOT NULL REFERENCES public.supply_catalog_items(id) ON DELETE CASCADE,
      shop_name TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      requested_by_user_key TEXT,
      requested_by_name TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (period_id, item_id, shop_name)
    )
  `);

  // Yonetici bir kalemi gonderirken GERCEKTE kac adet gonderdigini
  // buraya isaretler (istenenden az/hic gonderilmemis olabilir).
  // NULL = henuz isaretlenmedi. Personel bunu talebiyle karsilastirip
  // gorur.
  await client.query(`
    ALTER TABLE public.supply_requests
    ADD COLUMN IF NOT EXISTS delivered_quantity INTEGER
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS public.supply_orders (
      id SERIAL PRIMARY KEY,
      period_id INTEGER NOT NULL REFERENCES public.supply_periods(id) ON DELETE CASCADE,
      shop_name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'BEKLEMEDE',
      submitted_by_user_key TEXT,
      submitted_by_name TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (period_id, shop_name)
    )
  `);

  await ensureShopOrderTables(client);

  supplyTablesReady = true;
}

