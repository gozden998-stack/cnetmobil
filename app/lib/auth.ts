// app/lib/auth.ts
//
// Bu dosya, projede 44 ayrı route dosyasına TEK TEK kopyalanmış olan
// oturum imza doğrulama (HMAC) mantığını tek bir yerde toplar.
//
// BİLİNÇLİ TASARIM KARARI:
// getVerifiedPayload() SADECE şunu doğrular:
//   1) token imzası (HMAC-SHA256) geçerli mi
//   2) token süresi (exp) dolmuş mu
// Bunun ötesindeki kontroller (userId var mı, role hangi değerleri
// alabilir, branch string mi vb.) route dosyaları arasında GERÇEKTEN
// FARKLI — bazı route'lar "legacy" (userId'siz) oturuma izin veriyor,
// admin route'ları sayısal userId şartı koşuyor, bazıları role/branch
// hiç kontrol etmiyor. Bu farklar kanıtlanmadan tek bir "doğru" kural
// dayatmak davranışı değiştirebilir (bazı yerde erişimi kapatabilir,
// bazı yerde gevşetebilir). O yüzden o kısım kasıtlı olarak BURADA
// DEĞİL, her route'un kendi dosyasında, açıkça görünür şekilde kalıyor.
//
// Detaylar için rapor: "Silmeden önce mutlaka kontrol edin" bölümü.

import crypto from "crypto";

export const COOKIE_NAME = "cnet_auth";

export type SessionPayload = {
  userId: number | null;
  role: "admin" | "personel";
  branch: string;
  exp: number;
  legacy?: boolean;
};

export function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;

  if (!secret) {
    throw new Error("SESSION_SECRET bulunamadı.");
  }

  return secret;
}

/**
 * Sadece imza + süre kontrolü yapar. userId / role / branch üzerine
 * EK kural uygulamaz — bunu çağıran route kendi ihtiyacına göre yapar.
 */
export function getVerifiedPayload(token: string): SessionPayload | null {
  try {
    const [encoded, signature] = token.split(".");

    if (!encoded || !signature) {
      return null;
    }

    const expectedSignature = crypto
      .createHmac("sha256", getSessionSecret())
      .update(encoded)
      .digest("base64url");

    const signatureBuffer = Buffer.from(signature, "utf8");
    const expectedBuffer = Buffer.from(expectedSignature, "utf8");

    if (signatureBuffer.length !== expectedBuffer.length) {
      return null;
    }

    if (!crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
      return null;
    }

    const payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8")
    ) as SessionPayload;

    if (
      !payload ||
      !payload.exp ||
      payload.exp < Math.floor(Date.now() / 1000)
    ) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}
