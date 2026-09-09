// app/api/online/idefix/reconcile-memberships/route.ts
// CNETMOBIL - IDEFIX ESKI "GONDERILDI" MUTABAKATI
//
// AMAÇ:
// Eski center-send sürümlerinin PostgreSQL'e yanlışlıkla LISTED / PENDING_CREATE
// yazdığı IMEI kayıtlarını İdefix'in CANLI inventory-list verisiyle karşılaştırır.
//
// GET  -> SADECE ÖNİZLEME, DB YAZMAZ.
// POST -> CANLI MUTABAKAT, yalnızca fazla/yanlış İdefix üyeliklerini temizler.
//
// KURAL:
// - İdefix canlı stok 0  -> o barkoda bağlı yerel İdefix IMEI üyeliklerinin tamamı kaldırılır.
// - İdefix canlı stok N  -> en fazla N adet yerel IMEI üyeliği tutulur.
// - Yerel adet > canlı stok -> fazlalık kaldırılır.
// - Yerel adet <= canlı stok -> mevcut yerel üyeliklere dokunulmaz.
// - Tutulan PENDING_CREATE kayıtları canlı stok varsa LISTED'e çevrilir.
// - stock_devices tablosuna DOKUNMAZ.
// - N11 / IKAS tablolarına DOKUNMAZ.
// - İdefix API'ye stok/fiyat YAZMAZ. Sadece READ + local reconciliation.
//
// NOT:
// İdefix inventory API ürün bazlı adet döndürür, IMEI döndürmez.
// Bu nedenle canlı stok 1 ama yerelde 2 IMEI varsa hangi IMEI'nin "gerçek" olduğunu
// dışarıdan bilemeyiz. Deterministik olarak önce LISTED, sonra en eski listed_at / created_at
// kaydı tutulur; fazlalıklar kaldırılır.

import { NextRequest } from "next/server";
import type { PoolClient } from "pg";

import {
  IDEFIX_BASE_URL,
  getIdefixDbPool,
  getIdefixVendorId,
  getIdefixVendorToken,
  noStoreJson,
  requireIdefixSuperAdmin,
} from "@/app/lib/idefix/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type MembershipRow = {
  membership_id: number;
  stock_device_id: number;
  imei: string;
  membership_status: string | null;
  listed_at: string | null;
  membership_created_at: string | null;
  online_listing_id: number;
  external_variant_id: string | null;
  external_stock_code: string | null;
  title: string | null;
  listing_quantity: number | null;
  listing_sync_status: string | null;
};

type LiveInventoryItem = {
  barcode?: string | null;
  inventoryQuantity?: number | string | null;
  price?: number | string | null;
  comparePrice?: number | string | null;
  vendorStockCode?: string | null;
};

function text(value: unknown) {
  return String(value ?? "").trim();
}

function numberOrZero(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function asArray(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

function uniqueStrings(values: unknown[]) {
  return Array.from(
    new Set(
      values
        .map((value) => text(value))
        .filter(Boolean)
    )
  );
}

async function fetchLiveInventory(): Promise<LiveInventoryItem[]> {
  const vendorId = getIdefixVendorId();
  const token = getIdefixVendorToken();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 35_000);

  try {
    const response = await fetch(
      `${IDEFIX_BASE_URL}/pim/catalog/${encodeURIComponent(
        vendorId
      )}/inventory/list`,
      {
        method: "GET",
        cache: "no-store",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-API-KEY": token,
        },
        signal: controller.signal,
      }
    );

    const raw = await response.text();

    let payload: any = null;

    if (raw) {
      try {
        payload = JSON.parse(raw);
      } catch {
        payload = { raw };
      }
    }

    if (!response.ok) {
      throw new Error(
        `İdefix inventory-list HTTP ${response.status}: ${
          text(payload?.message) ||
          text(payload?.error) ||
          raw ||
          "Cevap boş."
        }`
      );
    }

    return asArray(
      payload?.items ??
        payload?.products ??
        payload?.content ??
        payload?.data?.items ??
        payload?.data?.products ??
        payload?.data?.content
    );
  } finally {
    clearTimeout(timeout);
  }
}

async function loadLocalMemberships(
  client: PoolClient
): Promise<MembershipRow[]> {
  const result = await client.query(
    `
      SELECT
        ocd.id::bigint AS membership_id,
        ocd.stock_device_id::bigint AS stock_device_id,
        ocd.imei,
        ocd.membership_status,
        ocd.listed_at,
        ocd.created_at AS membership_created_at,

        ol.id::bigint AS online_listing_id,
        ol.external_variant_id,
        ol.external_stock_code,
        ol.title,
        ol.quantity AS listing_quantity,
        ol.sync_status AS listing_sync_status
      FROM public.online_channel_devices ocd
      JOIN public.online_listings ol
        ON ol.id = ocd.online_listing_id
      WHERE ocd.channel = 'IDEFIX'
        AND ol.channel = 'IDEFIX'
        AND ocd.membership_status IN (
          'LISTED',
          'RESERVED',
          'PENDING_CREATE'
        )
      ORDER BY
        ol.id ASC,
        CASE
          WHEN ocd.membership_status = 'LISTED' THEN 0
          WHEN ocd.membership_status = 'RESERVED' THEN 1
          ELSE 2
        END ASC,
        ocd.listed_at ASC NULLS LAST,
        ocd.created_at ASC,
        ocd.id ASC
    `
  );

  return result.rows as MembershipRow[];
}

function buildPlan(
  memberships: MembershipRow[],
  liveInventory: LiveInventoryItem[]
) {
  const inventoryByBarcode = new Map<string, LiveInventoryItem>();

  for (const item of liveInventory) {
    const barcode = text(item?.barcode);
    if (!barcode) continue;
    inventoryByBarcode.set(barcode, item);
  }

  const byListing = new Map<number, MembershipRow[]>();

  for (const row of memberships) {
    const listingId = Number(row.online_listing_id);
    const list = byListing.get(listingId) ?? [];
    list.push(row);
    byListing.set(listingId, list);
  }

  const plans: any[] = [];

  for (const [listingId, rows] of byListing.entries()) {
    if (rows.length === 0) continue;

    const first = rows[0];
    const barcode = text(first.external_variant_id);
    const inventory = barcode
      ? inventoryByBarcode.get(barcode) ?? null
      : null;

    const liveStock = numberOrZero(inventory?.inventoryQuantity);
    const localCount = rows.length;

    // Yalnızca elimizdeki yerel IMEI kadar tutabiliriz.
    // Canlı stok daha yüksekse eksik IMEI'yi uydurmayız.
    const keepCount = Math.min(localCount, liveStock);

    const keepRows = rows.slice(0, keepCount);
    const removeRows = rows.slice(keepCount);

    plans.push({
      listingId,
      title: text(first.title) || "İdefix Ürünü",
      barcode: barcode || null,
      vendorStockCode: text(first.external_stock_code) || null,

      liveInventoryFound: Boolean(inventory),
      liveStock,
      livePrice: numberOrZero(inventory?.price),
      liveComparePrice: numberOrZero(
        inventory?.comparePrice ?? inventory?.price
      ),

      localCount,
      keepCount,
      removeCount: removeRows.length,

      keepMembershipIds: keepRows.map((row) => Number(row.membership_id)),
      removeMembershipIds: removeRows.map((row) => Number(row.membership_id)),

      keptImeis: uniqueStrings(keepRows.map((row) => row.imei)),
      removedImeis: uniqueStrings(removeRows.map((row) => row.imei)),

      action:
        removeRows.length > 0
          ? liveStock <= 0
            ? "REMOVE_ALL_FALSE_SENT"
            : "REMOVE_EXCESS_LOCAL_IMEIS"
          : keepRows.some(
              (row) => text(row.membership_status).toUpperCase() !== "LISTED"
            )
          ? "MARK_LIVE_MEMBERSHIPS_LISTED"
          : "NO_CHANGE",
    });
  }

  return plans;
}

function summarize(plans: any[]) {
  const localMemberships = plans.reduce(
    (sum, row) => sum + Number(row.localCount || 0),
    0
  );

  const keepMemberships = plans.reduce(
    (sum, row) => sum + Number(row.keepCount || 0),
    0
  );

  const removeMemberships = plans.reduce(
    (sum, row) => sum + Number(row.removeCount || 0),
    0
  );

  return {
    listingsChecked: plans.length,
    localMemberships,
    keepMemberships,
    removeMemberships,
    zeroStockListings: plans.filter(
      (row) => Number(row.liveStock || 0) <= 0
    ).length,
    changedListings: plans.filter(
      (row) => row.action !== "NO_CHANGE"
    ).length,
  };
}

async function applyPlan(
  client: PoolClient,
  plans: any[]
) {
  const changed: any[] = [];

  for (const plan of plans) {
    const removeIds = (plan.removeMembershipIds || [])
      .map((value: unknown) => Number(value))
      .filter((value: number) => Number.isInteger(value) && value > 0);

    const keepIds = (plan.keepMembershipIds || [])
      .map((value: unknown) => Number(value))
      .filter((value: number) => Number.isInteger(value) && value > 0);

    if (removeIds.length > 0) {
      await client.query(
        `
          DELETE FROM public.online_channel_devices
          WHERE channel = 'IDEFIX'
            AND id = ANY($1::bigint[])
        `,
        [removeIds]
      );
    }

    if (keepIds.length > 0) {
      await client.query(
        `
          UPDATE public.online_channel_devices
          SET
            membership_status = 'LISTED',
            listed_at = COALESCE(listed_at, now()),
            metadata =
              COALESCE(metadata, '{}'::jsonb)
              || $2::jsonb,
            updated_at = now()
          WHERE channel = 'IDEFIX'
            AND id = ANY($1::bigint[])
        `,
        [
          keepIds,
          JSON.stringify({
            idefixLiveReconciled: true,
            reconciledAt: new Date().toISOString(),
            source: "IDEFIX_LIVE_INVENTORY_RECONCILIATION",
          }),
        ]
      );
    }

    // Listing miktarı artık pool snapshot değil, canlı inventory miktarıdır.
    // Ancak local IMEI sayısından daha yüksek canlı stok varsa burada canlı stoğu
    // koruyoruz; listing ekranı gerçek İdefix adedini göstermeye devam eder.
    const liveStock = Number(plan.liveStock || 0);

    await client.query(
      `
        UPDATE public.online_listings
        SET
          quantity = $2,
          sync_status = CASE
            WHEN $2 > 0 THEN 'SYNCED'
            ELSE 'STALE'
          END,
          last_task_status = CASE
            WHEN $2 > 0 THEN 'LIVE_RECONCILED'
            ELSE 'LIVE_INVENTORY_ZERO'
          END,
          raw_data =
            jsonb_set(
              (
                COALESCE(raw_data, '{}'::jsonb)
                || $3::jsonb
              ),
              '{centerImeis}',
              to_jsonb($4::text[]),
              true
            ),
          updated_at = now()
        WHERE id = $1
          AND channel = 'IDEFIX'
      `,
      [
        Number(plan.listingId),
        liveStock,
        JSON.stringify({
          idefixLiveReconciliation: {
            reconciledAt: new Date().toISOString(),
            liveStock,
            localBefore: Number(plan.localCount || 0),
            localAfter: Number(plan.keepCount || 0),
            removedImeis: plan.removedImeis || [],
            liveInventoryFound: Boolean(plan.liveInventoryFound),
          },
        }),
        plan.keptImeis || [],
      ]
    );

    if (
      Number(plan.removeCount || 0) > 0 ||
      plan.action === "MARK_LIVE_MEMBERSHIPS_LISTED"
    ) {
      changed.push({
        listingId: plan.listingId,
        title: plan.title,
        barcode: plan.barcode,
        liveStock: plan.liveStock,
        keptImeis: plan.keptImeis,
        removedImeis: plan.removedImeis,
        action: plan.action,
      });
    }
  }

  return changed;
}

async function runSnapshot(
  client: PoolClient
) {
  const [memberships, liveInventory] = await Promise.all([
    loadLocalMemberships(client),
    fetchLiveInventory(),
  ]);

  const plans = buildPlan(memberships, liveInventory);

  return {
    memberships,
    liveInventory,
    plans,
    summary: summarize(plans),
  };
}

export async function GET(request: NextRequest) {
  const authError = await requireIdefixSuperAdmin(request);
  if (authError) return authError;

  const pool = getIdefixDbPool();
  const client = await pool.connect();

  try {
    const snapshot = await runSnapshot(client);

    return noStoreJson({
      success: true,
      mode: "preview",
      channel: "IDEFIX",
      writesDatabase: false,
      writesIdefix: false,
      message:
        "Önizleme tamamlandı. POST yapılmadan hiçbir yerel kayıt değişmez.",
      inventoryItemCount: snapshot.liveInventory.length,
      summary: snapshot.summary,
      plans: snapshot.plans,
      checkedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("[IDEFIX RECONCILE PREVIEW]", error);

    return noStoreJson(
      {
        success: false,
        mode: "preview",
        channel: "IDEFIX",
        error:
          error instanceof Error
            ? error.message
            : "İdefix mutabakat önizlemesi başarısız.",
      },
      500
    );
  } finally {
    client.release();
  }
}

export async function POST(request: NextRequest) {
  const authError = await requireIdefixSuperAdmin(request);
  if (authError) return authError;

  const pool = getIdefixDbPool();
  const client = await pool.connect();

  let lockHeld = false;

  try {
    // Aynı anda center-send ve mutabakatın local üyelik yazmasını engelle.
    await client.query(
      `
        SELECT pg_advisory_lock(
          hashtext('cnet_center_idefix_send')
        )
      `
    );

    lockHeld = true;

    // Kilit alındıktan sonra canlı inventory + DB tekrar okunur.
    const snapshot = await runSnapshot(client);

    await client.query("BEGIN");

    try {
      const changed = await applyPlan(client, snapshot.plans);

      await client.query("COMMIT");

      return noStoreJson({
        success: true,
        mode: "commit",
        channel: "IDEFIX",
        writesDatabase: true,
        writesIdefix: false,
        message:
          `${snapshot.summary.removeMemberships} eski/fazla İdefix IMEI üyeliği temizlendi. ` +
          `${snapshot.summary.keepMemberships} yerel IMEI üyeliği canlı stok sınırında tutuldu.`,
        inventoryItemCount: snapshot.liveInventory.length,
        summary: snapshot.summary,
        changed,
        completedAt: new Date().toISOString(),
      });
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch {}

      throw error;
    }
  } catch (error: any) {
    console.error("[IDEFIX RECONCILE COMMIT]", error);

    return noStoreJson(
      {
        success: false,
        mode: "commit",
        channel: "IDEFIX",
        error:
          error instanceof Error
            ? error.message
            : "İdefix mutabakatı başarısız.",
      },
      500
    );
  } finally {
    if (lockHeld) {
      try {
        await client.query(
          `
            SELECT pg_advisory_unlock(
              hashtext('cnet_center_idefix_send')
            )
          `
        );
      } catch {}
    }

    client.release();
  }
}
