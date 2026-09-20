// app/api/wingsm/value-report/route.ts
//
// CNETMOBIL - WingSM "Değer Puan" raporu - AŞAMA 1: SALT OKUNUR TEST
//
// AMAÇ:
// Şu anda WingSM'den elle rapor alınıp Excel makrosuyla yapılan
// "Değer Puan" hesabını panele taşımanın İLK adımı. Bu adımda SADECE
// doğru satış verisinin gelip gelmediği doğrulanıyor. Puan motoru,
// kural tablosu ve rapor ekranı SONRAKİ aşamalar.
//
// KAYNAK: WingSM'in resmi B2B servis dokümanındaki (wingsmonlineB2BServisi)
//   GET /api/b2b/satis/list/:sirket
//   QueryParams: tarih (başlangıç), tarih2 (bitiş), temlik=1, aktivasyon=1, alis=1
// Bu, RaporSatisList (portal web ekranının kendi servisi, HTML login
// gerektiriyordu ve HTTP 500 ile başarısız oldu) YERİNE kullanılıyor —
// aynı token tabanlı (x-access-token) B2B API'nin belgelenmiş bir ucu.
//
// GÜVENLİK / KAPSAM:
// - WingSM'e HİÇBİR veri yazılmaz.
// - Sadece GET /api/b2b/satis/list/:sirket okunur.
// - Mevcut B2B stok entegrasyonuna (app/lib/wingsm/server.ts) DOKUNULMADI —
//   sadece oradan zaten export edilen wingSMRequest() ve
//   getWingSMDepotForBranch() fonksiyonları OKUNARAK kullanılıyor.
// - Bu endpoint kâr/ciro gibi hassas veri döndürdüğü için sadece admin
//   oturumuna açık.
// - Sınıf filtresi bu B2B ucunda query param olarak belgelenmedi; dönen
//   satırlar varsa MalSinifAdI/MalSinifI alanına göre BURADA (sunucuda)
//   süzülüyor, WingSM'e gönderilmiyor.

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

import { getWingSMDepotForBranch, wingSMRequest } from "@/app/lib/wingsm/server";

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

// "01.06.2026" veya "2026-06-01" -> "01/06/2026" (WingSM'in diğer
// belgelenmiş alanlarında görülen "gg/aa/yil" biçimi). Zaten DD/MM/YYYY
// ise aynen döner.
function toWingsmDate(value: unknown): string {
  const raw = String(value ?? "").trim();

  const slashMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);

  if (slashMatch) {
    const [, gun, ay, yil] = slashMatch;
    return `${gun.padStart(2, "0")}/${ay.padStart(2, "0")}/${yil}`;
  }

  const dotMatch = raw.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);

  if (dotMatch) {
    const [, gun, ay, yil] = dotMatch;
    return `${gun.padStart(2, "0")}/${ay.padStart(2, "0")}/${yil}`;
  }

  const isoMatch = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);

  if (isoMatch) {
    const [, yil, ay, gun] = isoMatch;
    return `${gun.padStart(2, "0")}/${ay.padStart(2, "0")}/${yil}`;
  }

  throw new Error(`Geçersiz tarih formatı: "${raw}". Beklenen: GG.AA.YYYY, YYYY-AA-GG ya da GG/AA/YYYY.`);
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

// Satır içindeki sınıf bilgisini olabildiğince esnek yakala: WingSM'in
// döndüreceği tam alan adı doğrulanana kadar birkaç olası isim denenir.
function rowClassCode(row: any): string {
  return String(row?.MalSinifI ?? row?.MalSinifKodu ?? row?.MalSinifAdI ?? row?.Sinif ?? "").trim();
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

    if (!data.sirket) {
      return json({ success: false, error: "sirket (mağaza) zorunludur." }, 400);
    }

    const tarih = toWingsmDate(data.bastar);
    const tarih2 = toWingsmDate(data.bittar);

    const sirketInput = String(data.sirket ?? "").trim();
    const depotCode = getWingSMDepotForBranch(sirketInput);

    if (!depotCode) {
      return json(
        {
          success: false,
          error: `"${sirketInput}" için bilinen bir WingSM şirket/depo kodu bulunamadı. Bilinenler: MERKEZ, CNET, CMR, CADDE, SARAY, KAPAKLI.`,
        },
        400
      );
    }

    const siniflar = toStringArray(data.siniflar);

    const query: Record<string, string | number | boolean> = { tarih, tarih2 };

    if (data.temlik) query.temlik = 1;
    if (data.aktivasyon) query.aktivasyon = 1;
    if (data.alis) query.alis = 1;

    const startedAt = Date.now();

    const wingsmResult = await wingSMRequest<any>(`/api/b2b/satis/list/${encodeURIComponent(depotCode)}`, {
      method: "GET",
      query,
    });

    const durationMs = Date.now() - startedAt;

    const rawRows: any[] = Array.isArray(wingsmResult)
      ? wingsmResult
      : Array.isArray(wingsmResult?.data)
      ? wingsmResult.data
      : Array.isArray(wingsmResult?.List)
      ? wingsmResult.List
      : [];

    const filteredRows =
      siniflar.length > 0 ? rawRows.filter((row) => siniflar.includes(rowClassCode(row))) : rawRows;

    return json({
      success: true,
      depotCode,
      requestSentToWingsm: { path: `/api/b2b/satis/list/${depotCode}`, query },
      rawRowCount: rawRows.length,
      filteredRowCount: filteredRows.length,
      sampleRows: filteredRows.slice(0, 20),
      wingsmResultShape: Array.isArray(wingsmResult) ? "array" : typeof wingsmResult,
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
