// app/api/online/garantili/health/route.ts
//
// CNETMOBIL - Garantili bağlantı KONTROLÜ (salt okunur)
//
// Anahtarın tanımlı olup olmadığını (değeri göstermeden) ve Garantili'ye bağlanılıp bağlanılamadığını gösterir.
// Sadece GET atar: hesabım, ilk 3 cihaz, ilk 3 ilan, ilk 3 sipariş. Hiçbir şey yazılmaz/gönderilmez.
// Kişisel veri alanları ayıklanır. SADECE YÖNETİCİ.

import { NextRequest } from "next/server";

import { json, requireAdminSession } from "@/app/api/wingsm/score-rules/_shared";
import { GARANTILI_BASE, garantiliEnvStatus, garantiliFetch, getGarantiliKey, pickRows, stripPii } from "@/app/lib/garantili/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

async function probe(path: string, query?: Record<string, string | number>) {
  try {
    const result = await garantiliFetch(path, { query });
    const { rows, total, listKey } = pickRows(result.body);

    return {
      status: result.status,
      ok: result.ok,
      message: result.body?.message ?? null,
      detail: result.ok ? null : result.raw.slice(0, 400),
      dataKeys: result.body?.data && typeof result.body.data === "object" && !Array.isArray(result.body.data) ? Object.keys(result.body.data).slice(0, 25) : null,
      listKey,
      total,
      rowKeys: rows[0] && typeof rows[0] === "object" ? Object.keys(rows[0]).slice(0, 40) : [],
      firstRow: rows[0] ? JSON.stringify(stripPii(rows[0])).slice(0, 900) : null,
      // Liste değilse (ör. hesabım) tüm data'nın kişisel veri ayıklanmış kısaltılmış hali
      data: rows.length === 0 && result.body?.data ? JSON.stringify(stripPii(result.body.data)).slice(0, 900) : null,
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

export async function GET(request: NextRequest) {
  const auth = requireAdminSession(request);

  if (!auth.ok) return auth.response;

  const env = garantiliEnvStatus();

  if (!getGarantiliKey()) {
    return json({ success: false, env, error: "Ortam değişkeni eksik. Coolify'da GARANTILI_API_KEY tanımlayıp uygulamayı yeniden dağıtın." }, 200);
  }

  const [ben, cihaz, ilan, siparis] = await Promise.all([
    probe("/auth/ben"),
    probe("/cihaz/liste", { adet: 3 }),
    probe("/ilan/liste", { adet: 3 }),
    probe("/pazaryeri/siparis-liste", { adet: 3, ozet: 0 }),
  ]);

  return json({ success: true, env, base: GARANTILI_BASE, ben, cihaz, ilan, siparis });
}
