// app/api/online/garantili/data/route.ts
//
// CNETMOBIL - Garantili salt okunur veri (cihazlar / ilanlar / siparişler)
//
// GET ?kaynak=cihaz|ilan|siparis&ara=&sayfa=1&adet=50&durum=...
//   Garantili'ye yalnız GET atar; satırlardan kişisel veri alanları ayıklanır. SADECE YÖNETİCİ.

import { NextRequest } from "next/server";

import { json, requireAdminSession } from "@/app/api/wingsm/score-rules/_shared";
import { garantiliFetch, pickRows, stripPii } from "@/app/lib/garantili/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const SOURCES: Record<string, { path: string; filters: string[] }> = {
  cihaz: { path: "/cihaz/liste", filters: ["tab", "ara", "marka", "model", "hafiza", "renk", "durum", "ilan_durumu"] },
  ilan: { path: "/ilan/liste", filters: ["sekme", "ara", "marka", "model", "hafiza", "renk", "ilan_durumu"] },
  siparis: { path: "/pazaryeri/siparis-liste", filters: ["statu", "durum", "ara"] },
};

export async function GET(request: NextRequest) {
  const auth = requireAdminSession(request);

  if (!auth.ok) return auth.response;

  const params = request.nextUrl.searchParams;
  const source = SOURCES[String(params.get("kaynak") ?? "")];

  if (!source) return json({ success: false, error: "Geçersiz kaynak." }, 400);

  const sayfa = Math.max(1, Math.trunc(Number(params.get("sayfa")) || 1));
  const adet = Math.min(100, Math.max(1, Math.trunc(Number(params.get("adet")) || 50)));
  const query: Record<string, string | number> = { sayfa, adet };

  for (const name of source.filters) {
    const value = String(params.get(name) ?? "").trim();

    if (value) query[name] = value;
  }

  if (source.path === "/pazaryeri/siparis-liste") query.ozet = 0;

  try {
    const result = await garantiliFetch(source.path, { query });

    if (!result.ok) {
      return json({ success: false, status: result.status, error: result.body?.message || `Garantili HTTP ${result.status}`, detail: result.raw.slice(0, 400) }, 200);
    }

    const { rows, total, listKey } = pickRows(result.body);

    return json({
      success: true,
      sayfa,
      adet,
      total,
      listKey,
      rows: stripPii(rows),
    });
  } catch (error) {
    return json({ success: false, error: error instanceof Error ? error.message : "Garantili verisi alınamadı." }, 200);
  }
}
