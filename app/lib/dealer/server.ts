// app/lib/dealer/server.ts
//
// "Bayi Portali" - dis bayilerin (partner) giris/oturum yonetimi.
// Personel/magaza oturumundan (cnet_auth) TAMAMEN AYRI - farkli
// cookie, farkli tablo, farkli yetki alani. Bir bayi asla personel
// ekranlarina, bir personel asla bayi ekranina bu oturumla giremez.

import { NextRequest } from "next/server";
import { Pool, PoolClient } from "pg";
import bcrypt from "bcryptjs";
import crypto from "crypto";

declare global {
  // eslint-disable-next-line no-var
  var cnetDealerPool: Pool | undefined;
}

export function getDealerPool() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL bulunamadı.");
  }

  if (!global.cnetDealerPool) {
    global.cnetDealerPool = new Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
  }

  return global.cnetDealerPool;
}

const DEALER_COOKIE_NAME = "cnet_dealer_auth";
const DEALER_SESSION_DURATION = 60 * 60 * 12; // 12 saat

type DealerSessionPayload = {
  dealerId: number;
  exp: number;
};

export type DealerActor = {
  dealerId: number;
  companyName: string;
  email: string;
};

function getSessionSecret() {
  const secret = String(process.env.SESSION_SECRET || "").trim();

  if (!secret) {
    throw new Error("SESSION_SECRET bulunamadı.");
  }

  return secret;
}

function signDealerSession(payload: DealerSessionPayload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString(
    "base64url"
  );

  const signature = crypto
    .createHmac("sha256", getSessionSecret())
    .update(encoded)
    .digest("base64url");

  return `${encoded}.${signature}`;
}

function verifyDealerSession(token: string): DealerSessionPayload | null {
  try {
    const [encoded, signature] = token.split(".");

    if (!encoded || !signature) return null;

    const expectedSignature = crypto
      .createHmac("sha256", getSessionSecret())
      .update(encoded)
      .digest("base64url");

    const sigBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);

    if (sigBuffer.length !== expectedBuffer.length) return null;
    if (!crypto.timingSafeEqual(sigBuffer, expectedBuffer)) return null;

    const payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8")
    ) as DealerSessionPayload;

    if (!payload?.dealerId || !payload.exp) return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;

    return payload;
  } catch {
    return null;
  }
}

export function createDealerSessionToken(dealerId: number) {
  const expiresAt =
    Math.floor(Date.now() / 1000) + DEALER_SESSION_DURATION;

  return {
    token: signDealerSession({ dealerId, exp: expiresAt }),
    maxAge: DEALER_SESSION_DURATION,
  };
}

export const DEALER_AUTH_COOKIE = DEALER_COOKIE_NAME;

export async function requireDealerActor(
  request: NextRequest,
  client?: PoolClient
): Promise<DealerActor> {
  const token = request.cookies.get(DEALER_COOKIE_NAME)?.value || "";
  const session = token ? verifyDealerSession(token) : null;

  if (!session) {
    throw Object.assign(new Error("Oturum bulunamadı."), { status: 401 });
  }

  const db = client || getDealerPool();

  const result = await db.query(
    `
      SELECT id, company_name, email, is_active
      FROM public.dealers
      WHERE id = $1
      LIMIT 1
    `,
    [session.dealerId]
  );

  const dealer = result.rows[0];

  if (!dealer || !dealer.is_active) {
    throw Object.assign(new Error("Bayi hesabı aktif değil."), {
      status: 401,
    });
  }

  return {
    dealerId: Number(dealer.id),
    companyName: String(dealer.company_name),
    email: String(dealer.email),
  };
}

export async function hashDealerPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyDealerPassword(
  password: string,
  hash: string
) {
  return bcrypt.compare(password, hash);
}

// ======================================================
// TABLOLAR - CREATE TABLE IF NOT EXISTS deseni (bkz. Tedarik).
// ======================================================

export async function ensureDealerTables(client: PoolClient) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.dealers (
      id SERIAL PRIMARY KEY,
      company_name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      contact_phone TEXT,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      last_login_at TIMESTAMPTZ
    )
  `);

  // Yonetici bir cihazi buraya BIR KEZ ekler: marka/model, hafiza,
  // renk, grade, TEMEL fiyat (bize gelecek tutar) ve stok adedi.
  // Bayi bu kataloga bakip talep olusturur.
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.dealer_catalog_items (
      id SERIAL PRIMARY KEY,
      brand_model TEXT NOT NULL,
      memory TEXT,
      color TEXT,
      grade TEXT,
      base_price NUMERIC(12,2) NOT NULL,
      stock_quantity INTEGER NOT NULL DEFAULT 0,
      image_url TEXT,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  // Bir bayinin sepeti onaylamasiyla olusan siparis. total_base_amount
  // (bize gelecek), total_sale_amount (musteriden/bayiden tahsil
  // edilen) ve commission_amount (fark = bayi kari) ayri tutulur.
  // paratika_payment_id, mevcut paratika_payments tablosuna isaret
  // eder - odeme doğrulama/senkronizasyon MEVCUT Paratika return/
  // status-sync koduyla ayni sekilde isler, bu dosyada TEKRAR
  // yazilmaz (bugunku kritik Paratika hatasindan sonra o kodlara
  // gereksiz dokunulmuyor).
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.dealer_orders (
      id SERIAL PRIMARY KEY,
      dealer_id INTEGER NOT NULL REFERENCES public.dealers(id) ON DELETE RESTRICT,
      status TEXT NOT NULL DEFAULT 'AWAITING_PAYMENT',
      total_base_amount NUMERIC(12,2) NOT NULL,
      total_sale_amount NUMERIC(12,2) NOT NULL,
      commission_amount NUMERIC(12,2) NOT NULL,
      paratika_payment_id INTEGER,
      tracking_no TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      paid_at TIMESTAMPTZ,
      prepared_at TIMESTAMPTZ,
      shipped_at TIMESTAMPTZ,
      cancelled_at TIMESTAMPTZ
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS public.dealer_order_items (
      id SERIAL PRIMARY KEY,
      order_id INTEGER NOT NULL REFERENCES public.dealer_orders(id) ON DELETE CASCADE,
      catalog_item_id INTEGER REFERENCES public.dealer_catalog_items(id) ON DELETE SET NULL,
      item_name_snapshot TEXT NOT NULL,
      base_price_snapshot NUMERIC(12,2) NOT NULL,
      sale_price NUMERIC(12,2) NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  // Bayiye biriken kar payinin ne zaman/ne kadar odendigini (banka
  // havalesiyle, manuel) kaydeder. Bakiye = odenen siparislerin
  // toplam commission_amount'i - bu tablodaki toplam.
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.dealer_payouts (
      id SERIAL PRIMARY KEY,
      dealer_id INTEGER NOT NULL REFERENCES public.dealers(id) ON DELETE RESTRICT,
      amount NUMERIC(12,2) NOT NULL,
      note TEXT,
      paid_by_user_key TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

export function apiError(error: unknown) {
  const status =
    error && typeof error === "object" && "status" in error
      ? Number((error as { status?: unknown }).status) || 500
      : 500;

  const message =
    error instanceof Error ? error.message : "Beklenmeyen bir hata oluştu.";

  return { status, message };
}
