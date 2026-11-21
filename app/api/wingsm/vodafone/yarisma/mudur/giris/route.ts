// app/api/wingsm/vodafone/yarisma/mudur/giris/route.ts
//
// CNETMOBIL - Vodafone Şampiyonlar Ligi Mağaza Müdürleri yarışması: ŞİFRE GİRİŞİ
//   POST { sifre } -> doğruysa 20 saniyelik imzalı anahtar (token) döner; ekran bunu başlıkta (x-mudur-token) gönderir.
//   Vodafone mağaza girişleri ve yönetici çağırabilir (CMR vb. 403). Deneme sınırı: 10 dakikada 10 deneme.
//   Şifreyi yönetici Vodafone Şampiyonlar Ligi > Yönetim ekranından belirler (CMR müdür şifresinden AYRIDIR).

import { NextRequest } from "next/server";

import { getClientIp, isRateLimited } from "@/app/lib/rate-limit";

import { getPool, json, requireValidSession } from "../../../../score-rules/_shared";
import { hasMudurPassword, signMudurToken, verifyMudurPassword } from "../../../../yarisma/_mudur-erisim";
import { getVdfConfig, vdfMudurLeagueId } from "../../_vyarisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function isVodafoneBranch(branch: string) {
  return String(branch ?? "").trim().toLocaleUpperCase("tr-TR") === "VODAFONE KANALI";
}

export async function POST(request: NextRequest) {
  const auth = requireValidSession(request);

  if (!auth.ok) return auth.response;

  const isAdmin = auth.session.role === "admin";
  const myBranch = String(auth.session.branch ?? "").trim();

  if (!isAdmin && !isVodafoneBranch(myBranch)) {
    return json({ success: false, error: "Bu ekran sadece Vodafone kanalına açıktır." }, 403);
  }

  if (isRateLimited(`vdf-mudur-giris:${getClientIp(request)}:${myBranch}`, 10, 10 * 60 * 1000)) {
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
    const leagueId = vdfMudurLeagueId(await getVdfConfig(pool));

    if (!(await hasMudurPassword(pool, leagueId))) {
      return json({ success: false, error: "Şifre henüz belirlenmedi. Lütfen yöneticiyle görüşün." }, 400);
    }

    if (!(await verifyMudurPassword(pool, leagueId, String(body?.sifre ?? "")))) {
      return json({ success: false, error: "Şifre yanlış." }, 401);
    }

    return json({ success: true, ...signMudurToken(leagueId) });
  } catch (error) {
    console.error("VDF_YARISMA_MUDUR_GIRIS_ERROR:", error);

    return json({ success: false, error: "Giriş yapılamadı." }, 500);
  }
}
