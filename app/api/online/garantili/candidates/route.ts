// app/api/online/garantili/candidates/route.ts
//
// CNETMOBIL - Garantili'ye AÇILABİLECEK Merkez (CNET) IMEI'li cihazlar (SALT OKUNUR ÖNİZLEME)
//
// GET ?q=iphone&durum=any|opened|openable&offset=0&limit=50
//   Kaynak: public.stock_devices (status AVAILABLE, merkez CNET). Her cihaz için Garantili katalog id'leri
//   önce hatırlanan eşlemeden (garantili_model_map), yoksa katalogla birebir eşleştirmeden önerilir.
//   Fiyat önerisi: aynı IMEI'nin diğer kanallardaki en düşük satış fiyatı (varsa).
// Garantili'ye yalnız katalog GET'i atılır; hiçbir şey yazılmaz/gönderilmez. SADECE YÖNETİCİ.

import { NextRequest } from "next/server";

import { getPool, json, requireAdminSession } from "@/app/api/wingsm/score-rules/_shared";
import { getGarantiliCatalog, matchDevice, norm } from "@/app/lib/garantili/catalog";
import { ensureGarantiliTables, mapKey } from "@/app/lib/garantili/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const auth = requireAdminSession(request);

  if (!auth.ok) return auth.response;

  const params = request.nextUrl.searchParams;
  const q = String(params.get("q") ?? "").trim();
  const durum = String(params.get("durum") ?? "any");
  const offset = Math.max(0, Math.trunc(Number(params.get("offset")) || 0));
  const limit = Math.min(100, Math.max(1, Math.trunc(Number(params.get("limit")) || 50)));

  try {
    const pool = getPool();

    await ensureGarantiliTables(pool);

    const hasChannel = (await pool.query(`SELECT to_regclass('public.online_channel_devices') IS NOT NULL AS ok`)).rows[0]?.ok === true;

    const [devices, opened, maps, prices] = await Promise.all([
      pool.query(
        `SELECT imei, brand, model, memory, color, battery_percent, grade
         FROM public.stock_devices
         WHERE status = 'AVAILABLE' AND current_branch_code = 'CNET'
         ORDER BY brand, model, memory, imei`
      ),
      pool.query(`SELECT imei, status, min_fiyat, error FROM public.garantili_devices`),
      pool.query(`SELECT map_key, marka_id, model_id, hafiza_id, renk_id FROM public.garantili_model_map`),
      hasChannel
        ? pool.query(`SELECT imei, MIN(channel_sale_price) AS fiyat FROM public.online_channel_devices WHERE channel_sale_price > 0 GROUP BY imei`)
        : Promise.resolve({ rows: [] as any[] }),
    ]);

    let catalogError: string | null = null;
    let catalog = null as Awaited<ReturnType<typeof getGarantiliCatalog>> | null;

    try {
      catalog = await getGarantiliCatalog();
    } catch (error) {
      catalogError = error instanceof Error ? error.message : String(error);
    }

    const openedMap = new Map<string, any>(opened.rows.map((row) => [String(row.imei), row]));
    const mapMap = new Map<string, any>(maps.rows.map((row) => [String(row.map_key), row]));
    const priceMap = new Map<string, number>(prices.rows.map((row) => [String(row.imei), Number(row.fiyat)]));

    const words = q.split(/\s+/).map(norm).filter(Boolean).slice(0, 6);

    let items = devices.rows.map((row) => {
      const device = { brand: String(row.brand ?? ""), model: String(row.model ?? ""), memory: String(row.memory ?? ""), color: String(row.color ?? "") };
      const remembered = mapMap.get(mapKey(device));
      const auto = catalog ? matchDevice(catalog, device) : { markaId: null, modelId: null, hafizaId: null, renkId: null };
      const state = openedMap.get(String(row.imei));

      return {
        imei: String(row.imei),
        ...device,
        battery: row.battery_percent === null ? null : Number(row.battery_percent),
        grade: row.grade ?? null,
        // Hatırlanan eşleme varsa o, yoksa birebir otomatik eşleme
        markaId: remembered?.marka_id ?? auto.markaId,
        modelId: remembered?.model_id ?? auto.modelId,
        hafizaId: remembered?.hafiza_id ?? auto.hafizaId,
        renkId: remembered?.renk_id ?? auto.renkId,
        suggestedFrom: remembered ? "saved" : auto.modelId ? "auto" : null,
        suggestedPrice: priceMap.get(String(row.imei)) ?? null,
        garantiliStatus: state?.status ?? null,
        garantiliError: state?.error ?? null,
        isOpen: Boolean(state) && !["FAILED", "CLOSED"].includes(String(state.status)),
      };
    });

    if (words.length) items = items.filter((item) => words.every((word) => norm(`${item.brand} ${item.model} ${item.memory} ${item.color} ${item.imei}`).includes(word)));

    const counts = {
      all: items.length,
      opened: items.filter((item) => item.isOpen).length,
      openable: items.filter((item) => !item.isOpen).length,
    };

    const filtered = items.filter((item) => (durum === "opened" ? item.isOpen : durum === "openable" ? !item.isOpen : true));

    return json({
      success: true,
      catalogError,
      catalogDiagnostics: catalog?.diagnostics ?? null,
      totalCount: filtered.length,
      counts,
      offset,
      limit,
      rows: filtered.slice(offset, offset + limit),
    });
  } catch (error) {
    return json({ success: false, error: error instanceof Error ? error.message : "Aday listesi alınamadı." }, 200);
  }
}
