// app/api/online/idefix/inventory-probe/route.ts
//
// CNETMOBIL - İdefix envanter listesi SAYFALAMA TEŞHİSİ (geçici, salt okunur)
//
// /pim/catalog/{vendorId}/inventory/list dokümanda sayfalama belgelemiyor ama gerçekte az kayıt
// dönüyor. Bu uç aynı listeyi farklı sayfalama parametreleriyle (sadece GET) dener ve her varyantta kaç
// kayıt döndüğünü, ilk çağrıdan farklı yeni barkod gelip gelmediğini raporlar. Veri yazmaz.
// SADECE SUPER ADMIN. Sorun çözülünce kaldırılır.

import { NextRequest } from "next/server";

import { getIdefixVendorId, idefixFetch, noStoreJson, requireIdefixSuperAdmin } from "@/app/lib/idefix/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const VARIANTS = [
  "",
  "?page=1",
  "?page=2",
  "?page=1&limit=100",
  "?page=2&limit=10",
  "?limit=1000",
  "?size=1000",
  "?pageSize=1000",
  "?page=1&size=100",
  "?offset=10",
  "?offset=10&limit=10",
];

const rowsOf = (payload: any): any[] => {
  const rows = payload?.items ?? payload?.products ?? payload?.data?.items ?? payload?.data?.products ?? [];

  return Array.isArray(rows) ? rows : [];
};

export async function GET(request: NextRequest) {
  const authError = await requireIdefixSuperAdmin(request);

  if (authError) return authError;

  try {
    const vendorId = getIdefixVendorId();
    const base = `/pim/catalog/${encodeURIComponent(vendorId)}/inventory/list`;
    const baseBarcodes = new Set<string>();
    const results: Array<Record<string, unknown>> = [];

    for (const variant of VARIANTS) {
      try {
        const payload = await idefixFetch(`${base}${variant}`);
        const rows = rowsOf(payload);
        const barcodes = rows.map((row: any) => String(row?.barcode ?? "")).filter(Boolean);

        if (variant === "") barcodes.forEach((barcode) => baseBarcodes.add(barcode));

        // Cevap gövdesindeki liste dışı (toplam/sayfa gibi) alanlar.
        const meta: Record<string, unknown> = {};

        if (payload && typeof payload === "object") {
          for (const [key, value] of Object.entries(payload)) {
            if (!Array.isArray(value) && (typeof value !== "object" || value === null)) meta[key] = value;
          }
        }

        results.push({
          variant: variant || "(parametresiz)",
          count: rows.length,
          topLevelKeys: payload && typeof payload === "object" ? Object.keys(payload) : [],
          meta,
          newBarcodesVsBase: variant === "" ? 0 : barcodes.filter((barcode) => !baseBarcodes.has(barcode)).length,
          sampleRowKeys: rows[0] ? Object.keys(rows[0]) : [],
        });
      } catch (error) {
        results.push({ variant: variant || "(parametresiz)", error: error instanceof Error ? error.message : String(error) });
      }
    }

    return noStoreJson({ success: true, results });
  } catch (error) {
    return noStoreJson({ success: false, error: error instanceof Error ? error.message : "Teşhis başarısız." }, 500);
  }
}
