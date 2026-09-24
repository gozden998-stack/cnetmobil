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

// Talep gonderme SADECE Vodafone Kanali oturumlarina acik (CMR
// ekranlari bu ozelligi hic gormuyor - kullanicinin acik istegi).
export function ensureVodafoneChannel(
  session: SupplySession
) {
  if (session.channel !== "VODAFONE" && !session.isManager) {
    throw Object.assign(
      new Error(
        "Mağaza Tedarik sadece Vodafone Kanalı için açıktır."
      ),
      { status: 403 }
    );
  }
}

// Vodafone Kanali tek bir girisi paylastigi icin (Meydan/Saray/Erna/
// Tekira ayni oturum), talep formunda hangi fiziksel subenin talep
// ettigini elle secmemiz gerekiyor.
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

// ======================================================
// TABLOLAR - migration dosyasi bu repoda yok (DB disaridan
// yonetiliyor), mevcut kod tabanindaki "CREATE TABLE IF NOT EXISTS"
// deseniyle ayni (bkz. wingsm_deger_puan_snapshots).
// ======================================================

export async function ensureSupplyTables(
  client: PoolClient
) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.supply_batches (
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
    CREATE TABLE IF NOT EXISTS public.supply_items (
      id SERIAL PRIMARY KEY,
      batch_id INTEGER NOT NULL REFERENCES public.supply_batches(id) ON DELETE CASCADE,
      item_name TEXT NOT NULL,
      item_note TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS public.supply_requests (
      id SERIAL PRIMARY KEY,
      item_id INTEGER NOT NULL REFERENCES public.supply_items(id) ON DELETE CASCADE,
      shop_name TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      requested_by_user_key TEXT,
      requested_by_name TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (item_id, shop_name)
    )
  `);
}

export async function closeExpiredSupplyBatches(
  client: PoolClient
) {
  await client.query(`
    UPDATE public.supply_batches
    SET status = 'ENDED', updated_at = NOW()
    WHERE status = 'LIVE'
      AND ends_at IS NOT NULL
      AND ends_at <= NOW()
  `);
}

