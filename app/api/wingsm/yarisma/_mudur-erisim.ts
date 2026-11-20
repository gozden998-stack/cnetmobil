// app/api/wingsm/yarisma/_mudur-erisim.ts
//
// CNETMOBIL - "Şampiyonlar Ligi Mağaza Müdürleri Yarışması" sekmesi için ŞİFRELİ ERİŞİM
//
// Sekme tüm CMR girişlerinde görünür ama sıralamayı görmek için yöneticinin belirlediği şifre girilmelidir.
//  - Şifre yalnız HASH olarak (scrypt + tuz) ayrı tabloda tutulur; config'e ya da herhangi bir cevaba girmez.
//  - Doğru şifre girilince çok kısa ömürlü (20 saniye) imzalı bir anahtar (token) verilir; veri uçları bunu ister.
//    Yanlış/eksik anahtarla sıralama sunucudan HİÇ çıkmaz.
// Yönetici şifresiz görür. Bu dosya "_" ile başladığı için Next.js tarafından route sayılmaz.

import crypto from "crypto";
import type { Pool } from "pg";

// Şifre girildikten sonra sıralama YALNIZ 20 saniye görünür (kullanıcı kararı); sonra anahtar geçersiz olur, yeniden şifre gerekir.
const TOKEN_TTL_SECONDS = 20;

let ready = false;

export async function ensureAccessTable(pool: Pool) {
  if (ready) return;

  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.yarisma_access (
      league_id TEXT PRIMARY KEY,
      salt TEXT NOT NULL,
      hash TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  ready = true;
}

function hashPassword(password: string, salt: string) {
  return crypto.scryptSync(password, salt, 32).toString("hex");
}

export function validatePassword(raw: unknown): { ok: true; value: string } | { ok: false; error: string } {
  const value = String(raw ?? "");

  if (value.length < 4) return { ok: false, error: "Şifre en az 4 karakter olmalı." };
  if (value.length > 64) return { ok: false, error: "Şifre en fazla 64 karakter olabilir." };

  return { ok: true, value };
}

export async function setMudurPassword(pool: Pool, leagueId: string, password: string) {
  await ensureAccessTable(pool);

  const salt = crypto.randomBytes(16).toString("hex");

  await pool.query(
    `INSERT INTO public.yarisma_access (league_id, salt, hash, updated_at) VALUES ($1, $2, $3, now())
     ON CONFLICT (league_id) DO UPDATE SET salt = EXCLUDED.salt, hash = EXCLUDED.hash, updated_at = now()`,
    [leagueId, salt, hashPassword(password, salt)]
  );
}

export async function hasMudurPassword(pool: Pool, leagueId: string): Promise<boolean> {
  await ensureAccessTable(pool);

  return ((await pool.query(`SELECT 1 FROM public.yarisma_access WHERE league_id = $1`, [leagueId])).rowCount ?? 0) > 0;
}

export async function verifyMudurPassword(pool: Pool, leagueId: string, password: string): Promise<boolean> {
  await ensureAccessTable(pool);

  const row = (await pool.query(`SELECT salt, hash FROM public.yarisma_access WHERE league_id = $1`, [leagueId])).rows[0];

  if (!row) return false;

  const expected = Buffer.from(String(row.hash), "hex");
  const actual = Buffer.from(hashPassword(password, String(row.salt)), "hex");

  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

function tokenSecret() {
  const secret = String(process.env.SESSION_SECRET || "").trim();

  if (!secret) throw new Error("SESSION_SECRET bulunamadı.");

  return secret;
}

// Şifre doğru girilince verilen imzalı, süreli anahtar
export function signMudurToken(leagueId: string, nowMs = Date.now()): { token: string; expiresAt: number } {
  const expiresAt = Math.floor(nowMs / 1000) + TOKEN_TTL_SECONDS;
  const encoded = Buffer.from(JSON.stringify({ t: "mudur", l: leagueId, exp: expiresAt })).toString("base64url");
  const signature = crypto.createHmac("sha256", tokenSecret()).update(encoded).digest("base64url");

  return { token: `${encoded}.${signature}`, expiresAt };
}

export function verifyMudurToken(token: string | null | undefined, leagueId: string, nowMs = Date.now()): boolean {
  try {
    const [encoded, signature] = String(token ?? "").split(".");

    if (!encoded || !signature) return false;

    const expected = crypto.createHmac("sha256", tokenSecret()).update(encoded).digest("base64url");
    const a = Buffer.from(signature, "utf8");
    const b = Buffer.from(expected, "utf8");

    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;

    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));

    return payload?.t === "mudur" && payload?.l === leagueId && Number(payload?.exp) > Math.floor(nowMs / 1000);
  } catch {
    return false;
  }
}
