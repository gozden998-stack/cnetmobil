// app/api/wingsm/value-report/route.ts
//
// CNETMOBIL - WingSM "Değer Puan" raporu - AŞAMA 1: SALT OKUNUR TEST
//
// AMAÇ:
// Şu anda WingSM'den elle rapor alınıp Excel makrosuyla yapılan
// "Değer Puan" hesabını panele taşımanın İLK adımı. Bu adımda SADECE
// WingSM web portalının RaporSatisList servisinden doğru satış
// verisinin gelip gelmediği doğrulanıyor. Puan motoru, kural tablosu
// ve rapor ekranı SONRAKİ aşamalar.
//
// GÜVENLİK / KAPSAM:
// - WingSM'e HİÇBİR veri yazılmaz (skorapply / UpdateSkor KULLANILMAZ).
// - Sadece POST /HttpApiRapor/RaporSatisList okunur.
// - Mevcut B2B stok entegrasyonuna (app/lib/wingsm/server.ts) DOKUNULMADI.
// - Portal session/cookie mekanizması app/lib/wingsm/portal-server.ts
//   üzerinden (mevcut, değiştirilmeyen) wingSMPortalRequest ile kullanılır.
// - Bu endpoint kâr/ciro gibi hassas veri döndürdüğü için sadece admin
//   oturumuna açık.

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

import { wingSMPortalRequest } from "@/app/lib/wingsm/portal-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const COOKIE_NAME = "cnet_auth";

type SessionPayload = {
  userId: number | null;
  role: "admin" | "personel";
  branch: string;
  exp: number;
  legacy?: boolean;
};

function json(body: Record<string, unknown>, status = 200) {
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

function requireAdminSession(request: NextRequest) {
  const token = request.cookies.get(COOKIE_NAME)?.value;

  if (!token) {
    return { ok: false as const, response: json({ success: false, error: "Oturum bulunamadı." }, 401) };
  }

  const session = verifySession(token);

  if (!session) {
    return { ok: false as const, response: json({ success: false, error: "Oturum geçersiz." }, 401) };
  }

  if (session.role !== "admin") {
    return { ok: false as const, response: json({ success: false, error: "Bu rapor için yönetici yetkisi gerekli." }, 403) };
  }

  return { ok: true as const, session };
}

// "01.06.2026" veya "2026-06-01" -> "20260601". Zaten "20260601" ise aynen döner.
function toWingsmDate(value: unknown): string {
  const raw = String(value ?? "").trim();

  if (/^\d{8}$/.test(raw)) {
    return raw;
  }

  const dotMatch = raw.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);

  if (dotMatch) {
    const [, gun, ay, yil] = dotMatch;
    return `${yil}${ay.padStart(2, "0")}${gun.padStart(2, "0")}`;
  }

  const isoMatch = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);

  if (isoMatch) {
    const [, yil, ay, gun] = isoMatch;
    return `${yil}${ay.padStart(2, "0")}${gun.padStart(2, "0")}`;
  }

  throw new Error(`Geçersiz tarih formatı: "${raw}". Beklenen: GG.AA.YYYY, YYYY-AA-GG ya da YYYYAAGG.`);
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item ?? "").trim()).filter(Boolean);
  }

  if (typeof value === "string" && value.trim()) {
    return [value.trim()];
  }

  return [];
}

export async function POST(request: NextRequest) {
  const auth = requireAdminSession(request);

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const body = await request.json().catch(() => null);

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return json({ success: false, error: "Geçersiz istek gövdesi." }, 400);
    }

    const data = body as Record<string, unknown>;

    if (!data.bastar || !data.bittar) {
      return json({ success: false, error: "bastar (başlangıç tarihi) ve bittar (bitiş tarihi) zorunludur." }, 400);
    }

    const bastar = toWingsmDate(data.bastar);
    const bittar = toWingsmDate(data.bittar);

    const sirket = String(data.sirket ?? "").trim();
    const siniflar = toStringArray(data.siniflar);
    const saticilar = toStringArray(data.saticilar);
    const cinsler = toStringArray(data.cinsler);
    const gruplar = toStringArray(data.gruplar);
    const odemeler = toStringArray(data.odemeler);
    const tarifeler = toStringArray(data.tarifeler);
    const dagiticilar = toStringArray(data.dagiticilar);

    // Bu alanların WingSM tarafındaki kesin beklenen değerleri
    // dokümante değil; aşama 1'in amacı tam da bunu canlı denemek.
    // Test sonucuna göre bu varsayılanlar bir sonraki iterasyonda
    // netleştirilecek.
    const wingsmPayload = {
      sirket: sirket || null,
      bastar,
      bittar,
      hesapTur: data.hesapTur ?? "",
      satisTuru: data.satisTuru ?? "",
      isToplam: data.isToplam ?? false,
      kirilim: data.kirilim ?? "",
      withNot: data.withNot ?? false,
      withKaynak: data.withKaynak ?? false,
      saticilar,
      siniflar,
      cinsler,
      gruplar,
      odemeler,
      tarifeler,
      dagiticilar,
      filter: data.filter ?? "",
    };

    const startedAt = Date.now();

    const wingsmResult = await wingSMPortalRequest<unknown>("/HttpApiRapor/RaporSatisList", {
      method: "POST",
      body: wingsmPayload,
    });

    const durationMs = Date.now() - startedAt;

    return json({
      success: true,
      requestSentToWingsm: wingsmPayload,
      wingsmResult,
      durationMs,
      note: "AŞAMA 1 test yanıtı — henüz puan hesaplanmadı, hiçbir yere yazılmadı.",
    });
  } catch (error) {
    console.error("WINGSM_VALUE_REPORT_TEST_ERROR:", error);

    return json(
      {
        success: false,
        error: error instanceof Error ? error.message : "WingSM değer puan raporu alınamadı.",
      },
      500
    );
  }
}
