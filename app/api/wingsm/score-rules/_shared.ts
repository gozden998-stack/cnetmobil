// app/api/wingsm/score-rules/_shared.ts
//
// CNETMOBIL - WingSM "Değer Puan" kural tablosu CRUD ortak yardımcıları
//
// route.ts (liste/oluştur) ve [id]/route.ts (güncelle/sil) arasında
// paylaşılan DB pool, oturum doğrulama ve doğrulama fonksiyonları burada.
// (Bu dosya "_" ile başladığı için Next.js App Router tarafından bir route
// olarak değerlendirilmez — app/api/auctions/_server.ts'teki AYNI desen.)

import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import crypto from "crypto";

declare global {
  // eslint-disable-next-line no-var
  var cnetWingsmScoreRulesPool: Pool | undefined;
}

export const COOKIE_NAME = "cnet_auth";

export type SessionPayload = {
  userId: number | null;
  role: "admin" | "personel";
  branch: string;
  exp: number;
  legacy?: boolean;
};

export type WingsmScoreRuleRow = {
  id: number;
  class_code: string;
  class_label: string;
  profit_min: string;
  profit_max: string;
  score: string;
  active: boolean;
  created_at: string;
  updated_at: string;
};

// ======================================================
// DB POOL (diğer route'larla aynı desen — bkz. app/api/sheet-rows/route.ts,
// app/api/online/listings/route.ts)
// ======================================================

export function getPool() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable bulunamadı.");
  }

  if (!global.cnetWingsmScoreRulesPool) {
    global.cnetWingsmScoreRulesPool = new Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
  }

  return global.cnetWingsmScoreRulesPool;
}

// ======================================================
// SESSION (app/api/wingsm/value-report/route.ts ile BİREBİR AYNI desen —
// farklı bir auth şeması İCAT EDİLMEDİ)
// ======================================================

export function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      Pragma: "no-cache",
    },
  });
}

function getSessionSecret() {
  const secret = String(process.env.SESSION_SECRET || "").trim();

  if (!secret) {
    throw new Error("SESSION_SECRET bulunamadı.");
  }

  return secret;
}

function verifySession(token: string): SessionPayload | null {
  try {
    const [encoded, signature] = token.split(".");

    if (!encoded || !signature) {
      return null;
    }

    const expectedSignature = crypto
      .createHmac("sha256", getSessionSecret())
      .update(encoded)
      .digest("base64url");

    const a = Buffer.from(signature, "utf8");
    const b = Buffer.from(expectedSignature, "utf8");

    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return null;
    }

    const payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8")
    ) as SessionPayload;

    if (
      !payload ||
      !payload.exp ||
      payload.exp < Math.floor(Date.now() / 1000) ||
      !["admin", "personel"].includes(payload.role)
    ) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export function requireAdminSession(request: NextRequest) {
  const token = request.cookies.get(COOKIE_NAME)?.value;

  if (!token) {
    return { ok: false as const, response: json({ success: false, error: "Oturum bulunamadı." }, 401) };
  }

  const session = verifySession(token);

  if (!session) {
    return { ok: false as const, response: json({ success: false, error: "Oturum geçersiz." }, 401) };
  }

  if (session.role !== "admin") {
    return {
      ok: false as const,
      response: json({ success: false, error: "Bu işlem için yönetici yetkisi gerekli." }, 403),
    };
  }

  return { ok: true as const, session };
}

// requireAdminSession'ın AYNI HMAC doğrulama/expiry mantığı — sadece
// "role !== admin" reddi YOK. WingSM Değer Puanım (personel-facing) gibi
// hem admin hem personel oturumuna açık olması gereken uçlar için (bkz.
// app/api/wingsm/deger-puanim/route.ts). Katı mağaza sınırı (personel
// SADECE kendi şubesini görebilir) bu fonksiyonda DEĞİL, onu çağıran
// route'un içinde uygulanır.
export function requireValidSession(request: NextRequest) {
  const token = request.cookies.get(COOKIE_NAME)?.value;

  if (!token) {
    return { ok: false as const, response: json({ success: false, error: "Oturum bulunamadı." }, 401) };
  }

  const session = verifySession(token);

  if (!session) {
    return { ok: false as const, response: json({ success: false, error: "Oturum geçersiz." }, 401) };
  }

  return { ok: true as const, session };
}

// ======================================================
// VALIDATION (POST + PATCH ortak — client'a güvenilmez)
// ======================================================

export type RulePayloadInput = {
  class_code?: unknown;
  class_label?: unknown;
  profit_min?: unknown;
  profit_max?: unknown;
  score?: unknown;
  active?: unknown;
};

export type ValidatedRuleFields = {
  class_code: string;
  class_label: string;
  profit_min: number;
  profit_max: number;
  score: number;
  active: boolean;
};

// Tam doğrulama: POST (yeni kayıt) için — tüm alanlar zorunlu.
export function validateFullRulePayload(
  data: RulePayloadInput
): { ok: true; value: ValidatedRuleFields } | { ok: false; error: string } {
  const classCode = String(data.class_code ?? "").trim();
  const classLabel = String(data.class_label ?? "").trim();

  if (!classCode) {
    return { ok: false, error: "class_code zorunludur." };
  }

  if (!classLabel) {
    return { ok: false, error: "class_label zorunludur." };
  }

  const profitMin = Number(data.profit_min);
  const profitMax = Number(data.profit_max);
  const score = Number(data.score);

  if (!Number.isFinite(profitMin)) {
    return { ok: false, error: "profit_min sayısal olmalıdır." };
  }

  if (!Number.isFinite(profitMax)) {
    return { ok: false, error: "profit_max sayısal olmalıdır." };
  }

  if (!Number.isFinite(score)) {
    return { ok: false, error: "score sayısal olmalıdır." };
  }

  if (profitMin >= profitMax) {
    return { ok: false, error: "profit_min, profit_max değerinden küçük olmalıdır." };
  }

  if (score < 0) {
    return { ok: false, error: "score negatif olamaz." };
  }

  const active = data.active === undefined ? true : Boolean(data.active);

  return {
    ok: true,
    value: {
      class_code: classCode,
      class_label: classLabel,
      profit_min: profitMin,
      profit_max: profitMax,
      score,
      active,
    },
  };
}

// Kısmi doğrulama: PATCH (mevcut kaydın üstüne birleştirilmiş hâli) için —
// nihai (merge edilmiş) değerler yine tam kurala göre doğrulanır, ama
// hangi alanların gönderildiği çağırana bırakılır.
export function mergeAndValidateRulePayload(
  current: WingsmScoreRuleRow,
  patch: RulePayloadInput
): { ok: true; value: ValidatedRuleFields } | { ok: false; error: string } {
  const merged: RulePayloadInput = {
    class_code: patch.class_code !== undefined ? patch.class_code : current.class_code,
    class_label: patch.class_label !== undefined ? patch.class_label : current.class_label,
    profit_min: patch.profit_min !== undefined ? patch.profit_min : current.profit_min,
    profit_max: patch.profit_max !== undefined ? patch.profit_max : current.profit_max,
    score: patch.score !== undefined ? patch.score : current.score,
    active: patch.active !== undefined ? patch.active : current.active,
  };

  return validateFullRulePayload(merged);
}

export function getRuleId(params: { id?: string } | null | undefined) {
  const id = Number(params?.id);

  if (!Number.isInteger(id) || id <= 0) {
    throw Object.assign(new Error("Kural numarası geçersiz."), { status: 400 });
  }

  return id;
}
