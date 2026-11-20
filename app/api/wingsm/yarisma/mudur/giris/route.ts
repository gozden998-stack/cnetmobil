// app/api/wingsm/yarisma/mudur/giris/route.ts
//
// CNETMOBIL - Mağaza Müdürleri yarışması: ŞİFRE GİRİŞİ
//   POST { sifre } -> doğruysa 12 saatlik imzalı anahtar (token) döner; ekran bunu başlıkta (x-mudur-token) gönderir.
//   CMR mağaza girişleri ve yönetici çağırabilir (Vodafone vb. 403). Deneme sınırı: 10 dakikada 10 deneme.
//   Şifreyi yönetici Şampiyonlar Ligi ekranından belirler.

import { NextRequest } from "next/server";

import { getClientIp, isRateLimited } from "@/app/lib/rate-limit";

import { getPool, json, requireValidSession } from "../../../score-rules/_shared";
import { CMR_BRANCH_LABELS } from "../../../gidisat/_gidisat";
import { getLeagueConfig, mudurLeagueId } from "../../_yarisma";
import { hasMudurPassword, signMudurToken, verifyMudurPassword } from "../../_mudur-erisim";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function sameBranch(a: unknown, b: unknown) {
  return String(a ?? "").trim().toLocaleUpperCase("tr-TR") === String(b ?? "").trim().toLocaleUpperCase("tr-TR");
}

export async function POST(request: NextRequest) {
  const auth = requireValidSession(request);

  if (!auth.ok) return auth.response;

  const isAdmin = auth.session.role === "admin";
  const myBranch = String(auth.session.branch ?? "").trim();

  if (!isAdmin && !CMR_BRANCH_LABELS.some((label) => sameBranch(label, myBranch))) {
    return json({ success: false, error: "Bu ekran sadece CMR mağazalarına açıktır." }, 403);
  }

  if (isRateLimited(`mudur-giris:${getClientIp(request)}:${myBranch}`, 10, 10 * 60 * 1000)) {
    return json({ success: false, error: "Çok fazla deneme yapıldı. Lütfen birkaç dakika sonra tekrar deneyin." }, 429);
  }

  let body: any = null;

  try {
    body = await request.json();
  } catch {
    return json({ success: false, error: "Geçersiz istek." }, 400);
  }

  try {
    const pool = getPool();
    const leagueId = mudurLeagueId(await getLeagueConfig(pool));

    if (!(await hasMudurPassword(pool, leagueId))) {
      return json({ success: false, error: "Şifre henüz belirlenmedi. Lütfen yöneticiyle görüşün." }, 400);
    }

    if (!(await verifyMudurPassword(pool, leagueId, String(body?.sifre ?? "")))) {
      return json({ success: false, error: "Şifre yanlış." }, 401);
    }

    return json({ success: true, ...signMudurToken(leagueId) });
  } catch (error) {
    console.error("YARISMA_MUDUR_GIRIS_ERROR:", error);

    return json({ success: false, error: "Giriş yapılamadı." }, 500);
  }
}
