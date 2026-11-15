// app/api/online/hepsiburada/wing-search/route.ts
//
// Hepsiburada eşleştirme ekranı için WingSM sıfır ürün araması (SALT OKUNUR).
// GET ?q=iphone 16   -> ad ya da MalKod içinde geçen ürünler (tüm depoların toplam stoğuyla), en çok 25.
// SADECE YÖNETİCİ.

import { NextRequest } from "next/server";

import { getPool, json, requireAdminSession } from "@/app/api/wingsm/score-rules/_shared";
import { ensureHepsiburadaMapTable } from "@/app/lib/hepsiburada/map";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const auth = requireAdminSession(request);

  if (!auth.ok) return auth.response;

  const q = String(request.nextUrl.searchParams.get("q") ?? "").trim().split(/\s+/).join(" ");

  if (q.length < 2) return json({ success: true, rows: [] });

  try {
    const pool = getPool();

    await ensureHepsiburadaMapTable(pool);

    // Her kelime ad ya da kodda geçmeli.
    const words = q.split(" ").slice(0, 6);
    const conditions = words.map((_, i) => `(mal_ad ILIKE $${i + 1} OR mal_kod ILIKE $${i + 1})`).join(" AND ");
    const result = await pool.query(
      `SELECT mal_kod, max(mal_ad) AS mal_ad, max(sinif) AS sinif, sum(miktar)::int AS adet, count(*)::int AS depo_sayisi
       FROM public.sifir_stock WHERE ${conditions}
       GROUP BY mal_kod ORDER BY (max(sinif) = '1el') DESC, sum(miktar) DESC LIMIT 25`,
      words.map((word) => `%${word.split("%").join("").split("_").join("")}%`)
    );

    return json({ success: true, rows: result.rows });
  } catch (error) {
    return json({ success: false, error: error instanceof Error ? error.message : "Arama başarısız." }, 200);
  }
}
