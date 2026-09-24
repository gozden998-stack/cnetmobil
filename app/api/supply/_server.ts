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
// VERI MODELI (kullanicinin acik istegiyle basitlestirildi):
// - supply_catalog_items: KALICI urun kataloğu. Yonetici bir urunu
//   BIR KEZ ekler, sonraki tum donemlerde tekrar tekrar eklemeye
//   gerek kalmaz.
// - supply_periods: sadece "su an talebe acik mi" anahtari (baslik +
//   sure + durum). Baslatilinca KATALOGTAKI TUM aktif urunler otomatik
//   talebe acilir - donem bazinda ayrica urun secmeye gerek yok.
// - supply_requests: bir donem + bir katalog urunu + bir magaza icin
//   talep edilen adet.
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

export async function ensureSupplyTables(
  client: PoolClient
) {
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
}

export async function closeExpiredSupplyPeriods(
  client: PoolClient
) {
  await client.query(`
    UPDATE public.supply_periods
    SET status = 'ENDED', updated_at = NOW()
    WHERE status = 'LIVE'
      AND ends_at IS NOT NULL
      AND ends_at <= NOW()
  `);
}

