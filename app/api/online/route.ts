// app/api/online/route.ts
// CNETMOBIL ONLINE - PostgreSQL okuma endpointi
// N11 API BAGLI DEGIL.
// Bu endpoint yalnizca mevcut PostgreSQL online tablolarini okur.
// Sadece Super Admin erisebilir.

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import crypto from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

declare global {
  // eslint-disable-next-line no-var
  var cnetOnlinePool: Pool | undefined;
}

const COOKIE_NAME = 'cnet_auth';

type SessionPayload = {
  userId: number | null;
  role: 'admin' | 'personel';
  branch: string;
  exp: number;
  legacy?: boolean;
};

type ActiveUser = {
  id: number;
  username: string;
  branch: string;
  role: string;
  stockBranchCode: string | null;
  isSuperAdmin: boolean;
};

function getPool() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL bulunamadı.');
  }

  if (!global.cnetOnlinePool) {
    global.cnetOnlinePool = new Pool({
      connectionString,
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
  }

  return global.cnetOnlinePool;
}

function getSessionSecret() {
  const secret = process.env.SESSION_SECRET;

  if (!secret) {
    throw new Error('SESSION_SECRET bulunamadı.');
  }

  return secret;
}

function verifySession(token: string): SessionPayload | null {
  try {
    const [encoded, signature] = token.split('.');

    if (!encoded || !signature) return null;

    const expectedSignature = crypto
      .createHmac('sha256', getSessionSecret())
      .update(encoded)
      .digest('base64url');

    const signatureBuffer = Buffer.from(signature, 'utf8');
    const expectedBuffer = Buffer.from(expectedSignature, 'utf8');

    if (signatureBuffer.length !== expectedBuffer.length) return null;

    if (!crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
      return null;
    }

    const payload = JSON.parse(
      Buffer.from(encoded, 'base64url').toString('utf8')
    ) as SessionPayload;

    if (
      !payload ||
      !payload.userId ||
      !payload.exp ||
      payload.exp < Math.floor(Date.now() / 1000) ||
      !['admin', 'personel'].includes(payload.role) ||
      typeof payload.branch !== 'string'
    ) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store, max-age=0',
      Pragma: 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

async function getAuthenticatedUser(
  request: NextRequest
): Promise<ActiveUser | null> {
  const token = request.cookies.get(COOKIE_NAME)?.value;

  if (!token) return null;

  const session = verifySession(token);

  if (!session?.userId) return null;

  const result = await getPool().query(
    `
      SELECT
        u.id,
        u.username,
        u.branch,
        u.role,
        u.active,
        u.stock_branch_code,
        EXISTS (
          SELECT 1
          FROM public.user_roles ur
          JOIN public.roles r
            ON r.id = ur.role_id
          WHERE ur.user_id = u.id
            AND r.code = 'super_admin'
            AND r.active = TRUE
        ) AS is_super_admin
      FROM public.users u
      WHERE u.id = $1
      LIMIT 1
    `,
    [session.userId]
  );

  const row = result.rows[0];

  if (!row || row.active !== true) {
    return null;
  }

  return {
    id: Number(row.id),
    username: String(row.username),
    branch: String(row.branch),
    role: String(row.role),
    stockBranchCode: row.stock_branch_code
      ? String(row.stock_branch_code)
      : null,
    isSuperAdmin: row.is_super_admin === true,
  };
}

// ============================================================
// GET /api/online
//
// SADECE PostgreSQL okur.
// N11'e istek ATMAZ.
//
// Dondurulenler:
// - channel: online_channels/N11
// - stats: toplam urun, toplam stok, ortalama fiyat
// - listings: online_listings + varsa stock_devices detaylari
// - tasks: son 50 online task
//
// ONLINE modulu su an sadece Super Admin.
// ============================================================
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);

    if (!user) {
      return json(
        {
          success: false,
          error: 'Oturum gerekli.',
        },
        401
      );
    }

    if (!user.isSuperAdmin) {
      return json(
        {
          success: false,
          error: 'ONLINE modülü yalnızca Super Admin tarafından görüntülenebilir.',
        },
        403
      );
    }

    const pool = getPool();

    const [channelResult, statsResult, listingsResult, tasksResult] =
      await Promise.all([
        pool.query(
          `
            SELECT
              id,
              channel,
              enabled,
              integrator_name,
              default_currency,
              default_vat_rate,
              default_preparing_day,
              default_shipment_template,
              auto_stock_sync,
              auto_price_sync,
              last_sync_at,
              last_sync_status,
              last_sync_error,
              created_at,
              updated_at
            FROM public.online_channels
            WHERE channel = 'N11'
            LIMIT 1
          `
        ),

        pool.query(
          `
            SELECT
              COUNT(*)::integer AS total_products,
              COALESCE(SUM(quantity), 0)::integer AS total_stock,
              COALESCE(AVG(sale_price), 0)::numeric(12,2) AS average_sale_price,

              COUNT(*) FILTER (
                WHERE sale_status = 'On_Sale'
              )::integer AS on_sale_count,

              COUNT(*) FILTER (
                WHERE sale_status = 'Out_Of_Stock'
              )::integer AS out_of_stock_count,

              COUNT(*) FILTER (
                WHERE sale_status = 'Sale_Closed'
              )::integer AS sale_closed_count,

              COUNT(*) FILTER (
                WHERE product_status = 'Active'
              )::integer AS active_product_count,

              COUNT(*) FILTER (
                WHERE stock_device_id IS NOT NULL
              )::integer AS matched_device_count,

              COUNT(*) FILTER (
                WHERE stock_device_id IS NULL
              )::integer AS unmatched_device_count
            FROM public.online_listings
            WHERE channel = 'N11'
          `
        ),

        pool.query(
          `
            SELECT
              ol.id,
              ol.channel,
              ol.stock_device_id,
              ol.external_product_id,
              ol.external_stock_code,
              ol.external_product_main_id,
              ol.category_id,
              ol.title,
              ol.sale_price,
              ol.list_price,
              ol.quantity,
              ol.product_status,
              ol.sale_status,
              ol.sync_status,
              ol.last_task_id,
              ol.last_task_status,
              ol.last_error,
              ol.attributes,
              ol.last_synced_at,
              ol.created_at,
              ol.updated_at,

              sd.imei AS device_imei,
              sd.brand AS device_brand,
              sd.model AS device_model,
              sd.memory AS device_memory,
              sd.color AS device_color,
              sd.battery_percent AS device_battery_percent,
              sd.grade AS device_grade,
              sd.warranty AS device_warranty,
              sd.changed_parts AS device_changed_parts,
              sd.box_invoice AS device_box_invoice,
              sd.current_branch_code AS device_branch_code,
              sd.status AS device_status,
              sd.source AS device_source

            FROM public.online_listings ol
            LEFT JOIN public.stock_devices sd
              ON sd.id = ol.stock_device_id
            WHERE ol.channel = 'N11'
            ORDER BY
              ol.updated_at DESC,
              ol.id DESC
            LIMIT 1000
          `
        ),

        pool.query(
          `
            SELECT
              id,
              channel,
              task_id,
              task_type,
              task_status,
              stock_code,
              online_listing_id,
              reasons,
              error_message,
              created_at,
              checked_at,
              completed_at
            FROM public.online_tasks
            WHERE channel = 'N11'
            ORDER BY created_at DESC, id DESC
            LIMIT 50
          `
        ),
      ]);

    const statsRow = statsResult.rows[0] ?? {};

    return json({
      success: true,

      currentUser: {
        id: user.id,
        username: user.username,
        isSuperAdmin: user.isSuperAdmin,
      },

      apiConnected: false,
      apiConfigured: false,

      channel: channelResult.rows[0] ?? null,

      stats: {
        totalProducts: Number(statsRow.total_products || 0),
        totalStock: Number(statsRow.total_stock || 0),
        averageSalePrice: Number(statsRow.average_sale_price || 0),
        onSaleCount: Number(statsRow.on_sale_count || 0),
        outOfStockCount: Number(statsRow.out_of_stock_count || 0),
        saleClosedCount: Number(statsRow.sale_closed_count || 0),
        activeProductCount: Number(statsRow.active_product_count || 0),
        matchedDeviceCount: Number(statsRow.matched_device_count || 0),
        unmatchedDeviceCount: Number(statsRow.unmatched_device_count || 0),
      },

      listings: listingsResult.rows,
      count: listingsResult.rows.length,

      tasks: tasksResult.rows,
      taskCount: tasksResult.rows.length,
    });
  } catch (error) {
    console.error('ONLINE GET ERROR:', error);

    return json(
      {
        success: false,
        error: 'ONLINE verileri alınamadı.',
      },
      500
    );
  }
}
