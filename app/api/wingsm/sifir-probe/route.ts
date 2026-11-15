// app/api/wingsm/sifir-probe/route.ts
//
// CNETMOBIL - WingSM SIFIR (1. el) cihaz stoğu İNCELEME aracı (geçici, salt okunur)
//
// Stok senkronu bugün yalnız sinif=2el okuyor. Sıfır cihazların WingSM'de hangi sınıf kodunda ve hangi
// depolarda durduğunu, satırlarda hangi alanların geldiğini görmek için /api/b2b/stok/list'i farklı
// sınıflarla okur. WingSM'e HİÇBİR veri yazılmaz (sadece GET).
//
// GET ?sinif=1el,1eltablet[&depo=003,051]   (sinif=* : sınıfsız, depodaki bütün sınıflar)
//   Her (depo, sınıf) için: satır sayısı, stoğu olan (DepoMiktar > 0) satır sayısı, toplam adet, ilk 6 satırın
//   özeti ve ilk satırdaki tüm alan adları.
//
// GÜVENLİK: sadece yönetici oturumu. Sorun çözülünce kaldırılır.

import { NextRequest } from "next/server";

import { wingSMRequest } from "@/app/lib/wingsm/server";

import { json, requireAdminSession } from "../score-rules/_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const ALL_DEPOTS = ["001", "051", "003", "009", "010", "011"];

const list = (value: string | null, fallback: string[]) => {
  const items = String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return items.length ? items.slice(0, 12) : fallback;
};

export async function GET(request: NextRequest) {
  const auth = requireAdminSession(request);

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const params = request.nextUrl.searchParams;
    const classes = list(params.get("sinif"), ["1el"]);
    const depots = list(params.get("depo"), ALL_DEPOTS);
    const results: Array<Record<string, unknown>> = [];

    for (const depo of depots) {
      for (const sinif of classes) {
        try {
          // sinif="*": sınıf süzgeci olmadan (depodaki bütün sınıflar) okunur.
          const payload: any = await wingSMRequest("/api/b2b/stok/list", { method: "GET", query: sinif === "*" ? { depo } : { depo, sinif } });
          const rows: any[] = Array.isArray(payload?.data) ? payload.data : [];
          const inStock = rows.filter((row) => Number(row?.DepoMiktar ?? 0) > 0);

          results.push({
            depo,
            sinif,
            success: payload?.success ?? null,
            rows: rows.length,
            inStockRows: inStock.length,
            totalQty: inStock.reduce((sum, row) => sum + Number(row?.DepoMiktar ?? 0), 0),
            // Sınıf kodlarının dağılımı (özellikle sinif="*" ile hangi sınıflar var görmek için).
            classes: inStock.reduce((acc: Record<string, number>, row) => {
              const key = String(row?.MalSinifKod ?? "-");

              acc[key] = (acc[key] ?? 0) + Number(row?.DepoMiktar ?? 0);

              return acc;
            }, {}),
            sample: inStock.slice(0, 6).map((row) => ({
              MalKod: row?.MalKod,
              MalAd: row?.MalAd,
              MalCinsAd: row?.MalCinsAd,
              MalGrupAd: row?.MalGrupAd,
              MalSinifKod: row?.MalSinifKod,
              DepoMiktar: row?.DepoMiktar,
            })),
            fields: rows[0] ? Object.keys(rows[0]) : [],
          });
        } catch (error) {
          results.push({ depo, sinif, error: error instanceof Error ? error.message : String(error) });
        }
      }
    }

    return json({ success: true, results });
  } catch (error) {
    return json({ success: false, error: error instanceof Error ? error.message : "İnceleme başarısız." }, 500);
  }
}
