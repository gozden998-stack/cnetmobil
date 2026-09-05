// app/api/panel-action/route.ts
// CNETMOBIL merkezi yetki motoru
//
// Tarayıcı -> bu route -> HttpOnly session -> PostgreSQL rol/yetki kontrolü
// -> izin varsa Apps Script
//
// Geçiş sürecinde legacy personel hesapları çalışmaya devam eder.
// DB'ye taşınmış kullanıcılar için yetki tamamen roles / permissions tablolarından gelir.

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import crypto from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

declare global {
  // eslint-disable-next-line no-var
  var cnetPanelPermissionPool: Pool | undefined;
}

const COOKIE_NAME = 'cnet_auth';

type SessionPayload = {
  userId: number | null;
  role: 'admin' | 'personel';
  branch: string;
  exp: number;
  legacy?: boolean;
};

type ActionRule = {
  permission: string;
  branchBound?: boolean;
};

// Her panel işlemi artık bir PostgreSQL permission koduna bağlı.
const ACTION_RULES: Record<string, ActionRule> = {
  SAVE_ALIM: {
    permission: 'purchases.create',
    branchBound: true,
  },

  ADD_CIHAZ_TALEP_DEVICE: {
    permission: 'devices.create',
  },

  SAVE_TALEP: {
    permission: 'requests.create',
    branchBound: true,
  },

  GONDER_TALEP: {
    permission: 'requests.approve',
  },

  RED_TALEP: {
    permission: 'requests.reject',
  },

  DELETE_CIHAZ_ROW_FULL_V5: {
    permission: 'requests.delete',
  },

  SAVE_THH: {
    permission: 'thh.create',
  },

  UPDATE_THH: {
    permission: 'thh.edit',
  },

  DELETE_THH: {
    permission: 'thh.delete',
  },

  DELETE_ALIM: {
    permission: 'purchases.delete',
  },

  DELETE_ALL_ALIM: {
    permission: 'purchases.delete',
  },

  UPDATE_CONFIG: {
    permission: 'settings.edit',
  },

  ADD_DEVICE: {
    permission: 'devices.create',
  },

  USE_IMEI: {
    permission: 'stock.edit',
  },
};

// DB'ye henüz taşınmamış personel hesapları için geçiş izinleri.
// Personeller PostgreSQL users tablosuna taşınınca bu fallback kaldırılacak.
const LEGACY_PERSONEL_ACTIONS = new Set([
  'SAVE_ALIM',
  'SAVE_TALEP',
  'USE_IMEI',
]);

function getPool() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL bulunamadı.');
  }

  if (!global.cnetPanelPermissionPool) {
    global.cnetPanelPermissionPool = new Pool({
      connectionString,
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
  }

  return global.cnetPanelPermissionPool;
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

    if (!encoded || !signature) {
      return null;
    }

    const expectedSignature = crypto
      .createHmac('sha256', getSessionSecret())
      .update(encoded)
      .digest('base64url');

    const signatureBuffer = Buffer.from(signature, 'utf8');
    const expectedBuffer = Buffer.from(expectedSignature, 'utf8');

    if (signatureBuffer.length !== expectedBuffer.length) {
      return null;
    }

    if (!crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
      return null;
    }

    const payload = JSON.parse(
      Buffer.from(encoded, 'base64url').toString('utf8')
    ) as SessionPayload;

    if (
      !payload ||
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

function jsonResponse(
  body: Record<string, unknown>,
  status = 200
) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store, max-age=0',
      Pragma: 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function validateOrigin(request: NextRequest) {
  const expectedAppUrl = process.env.APP_URL;

  if (!expectedAppUrl) {
    const host = request.headers.get('host');
    const proto =
      request.headers.get('x-forwarded-proto') ||
      request.nextUrl.protocol.replace(':', '');

    if (!host) return false;

    return request.headers.get('origin') === `${proto}://${host}`;
  }

  try {
    return (
      request.headers.get('origin') ===
      new URL(expectedAppUrl).origin
    );
  } catch {
    return false;
  }
}

async function getActiveDbUser(
  userId: number
): Promise<{
  id: number;
  username: string;
  branch: string;
  legacyRole: string;
} | null> {
  const pool = getPool();

  const result = await pool.query(
    `
      SELECT id, username, branch, role, active
      FROM public.users
      WHERE id = $1
      LIMIT 1
    `,
    [userId]
  );

  const user = result.rows[0];

  if (!user || !user.active) {
    return null;
  }

  return {
    id: Number(user.id),
    username: String(user.username),
    branch: String(user.branch),
    legacyRole: String(user.role),
  };
}

async function hasRole(
  userId: number,
  roleCode: string
): Promise<boolean> {
  const pool = getPool();

  const result = await pool.query(
    `
      SELECT 1
      FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = $1
        AND r.code = $2
        AND r.active = TRUE
      LIMIT 1
    `,
    [userId, roleCode]
  );

  return result.rowCount === 1;
}

async function hasPermission(
  userId: number,
  permissionCode: string
): Promise<boolean> {
  const pool = getPool();

  // 1) Super Admin bütün aktif yetkilere otomatik sahiptir.
  if (await hasRole(userId, 'super_admin')) {
    const permissionExists = await pool.query(
      `
        SELECT 1
        FROM public.permissions
        WHERE code = $1
          AND active = TRUE
        LIMIT 1
      `,
      [permissionCode]
    );

    return permissionExists.rowCount === 1;
  }

  // 2) Kullanıcıya özel izin/red, rol yetkisinin üstündedir.
  const userOverride = await pool.query(
    `
      SELECT up.allowed
      FROM public.user_permissions up
      JOIN public.permissions p
        ON p.id = up.permission_id
      WHERE up.user_id = $1
        AND p.code = $2
        AND p.active = TRUE
      LIMIT 1
    `,
    [userId, permissionCode]
  );

  if (userOverride.rowCount === 1) {
    return userOverride.rows[0].allowed === true;
  }

  // 3) Kullanıcının rollerinden herhangi biri yetkiyi veriyorsa izin vardır.
  const rolePermission = await pool.query(
    `
      SELECT 1
      FROM public.user_roles ur
      JOIN public.roles r
        ON r.id = ur.role_id
      JOIN public.role_permissions rp
        ON rp.role_id = r.id
      JOIN public.permissions p
        ON p.id = rp.permission_id
      WHERE ur.user_id = $1
        AND p.code = $2
        AND r.active = TRUE
        AND p.active = TRUE
      LIMIT 1
    `,
    [userId, permissionCode]
  );

  return rolePermission.rowCount === 1;
}

async function getAllowedBranches(
  userId: number,
  fallbackBranch: string
): Promise<string[]> {
  const pool = getPool();

  if (await hasRole(userId, 'super_admin')) {
    // Super Admin için branch sınırı uygulanmaz.
    return [];
  }

  const result = await pool.query(
    `
      SELECT branch
      FROM public.user_branch_access
      WHERE user_id = $1
      ORDER BY branch
    `,
    [userId]
  );

  if (result.rows.length === 0) {
    return [fallbackBranch];
  }

  return result.rows.map((row) => String(row.branch));
}

async function writeAuditLog(params: {
  userId: number | null;
  action: string;
  module: string;
  payload: Record<string, unknown>;
  ip: string | null;
}) {
  try {
    if (!params.userId) return;

    const pool = getPool();

    await pool.query(
      `
        INSERT INTO public.audit_logs
          (user_id, action, module, target_type, target_id, new_data, ip_address)
        VALUES
          ($1, $2, $3, $4, $5, $6::jsonb, $7)
      `,
      [
        params.userId,
        params.action,
        params.module,
        'panel_action',
        typeof params.payload.rowIndex !== 'undefined'
          ? String(params.payload.rowIndex)
          : null,
        JSON.stringify(params.payload),
        params.ip,
      ]
    );
  } catch (error) {
    // Log hatası gerçek işlemi bozmasın.
    console.error('AUDIT LOG ERROR:', error);
  }
}

function permissionModule(permission: string) {
  return permission.split('.')[0] || 'system';
}

export async function POST(request: NextRequest) {
  try {
    // 1) CSRF / origin koruması
    if (!validateOrigin(request)) {
      return jsonResponse(
        {
          result: 'error',
          message: 'Geçersiz istek kaynağı.',
        },
        403
      );
    }

    // 2) HttpOnly session kontrolü
    const token = request.cookies.get(COOKIE_NAME)?.value;

    if (!token) {
      return jsonResponse(
        {
          result: 'error',
          message: 'Oturum gerekli.',
        },
        401
      );
    }

    const session = verifySession(token);

    if (!session) {
      return jsonResponse(
        {
          result: 'error',
          message: 'Geçersiz veya süresi dolmuş oturum.',
        },
        401
      );
    }

    const contentLength = Number(
      request.headers.get('content-length') || 0
    );

    if (contentLength > 100_000) {
      return jsonResponse(
        {
          result: 'error',
          message: 'İstek çok büyük.',
        },
        413
      );
    }

    const rawBody = await request.json().catch(() => null);

    if (
      !rawBody ||
      typeof rawBody !== 'object' ||
      Array.isArray(rawBody)
    ) {
      return jsonResponse(
        {
          result: 'error',
          message: 'Geçersiz istek.',
        },
        400
      );
    }

    const payload = {
      ...(rawBody as Record<string, unknown>),
    };

    const actionType =
      typeof payload.type === 'string'
        ? payload.type.trim()
        : '';

    const rule = ACTION_RULES[actionType];

    // Tanımlanmamış bir Apps Script işlemi çalıştırılamaz.
    if (!rule) {
      return jsonResponse(
        {
          result: 'error',
          message: 'Bu işlem desteklenmiyor.',
        },
        400
      );
    }

    // =====================================================
    // LEGACY HESAPLAR - GEÇİŞ SÜRECİ
    // =====================================================
    if (!session.userId) {
      // Eski admin fallback şimdilik çalışmaya devam eder.
      if (session.role === 'admin') {
        // izin
      } else if (
        session.role === 'personel' &&
        LEGACY_PERSONEL_ACTIONS.has(actionType)
      ) {
        // Personel branch'i tarayıcıdan değiştirilemez.
        if (rule.branchBound) {
          payload.branch = session.branch;
        }
      } else {
        return jsonResponse(
          {
            result: 'error',
            message: 'Bu işlem için yetkiniz yok.',
          },
          403
        );
      }
    }

    // =====================================================
    // POSTGRESQL KULLANICILARI - MERKEZİ YETKİ MOTORU
    // =====================================================
    if (session.userId) {
      const user = await getActiveDbUser(session.userId);

      if (!user) {
        return jsonResponse(
          {
            result: 'error',
            message: 'Kullanıcı aktif değil.',
          },
          401
        );
      }

      const allowed = await hasPermission(
        user.id,
        rule.permission
      );

      if (!allowed) {
        return jsonResponse(
          {
            result: 'error',
            message: `Bu işlem için "${rule.permission}" yetkisi gerekli.`,
          },
          403
        );
      }

      // Branch'e bağlı işlemlerde istemci istediği mağazayı yazamaz.
      if (rule.branchBound) {
        const isSuperAdmin = await hasRole(
          user.id,
          'super_admin'
        );

        if (!isSuperAdmin) {
          const allowedBranches = await getAllowedBranches(
            user.id,
            user.branch
          );

          const requestedBranch = String(
            payload.branch || user.branch
          );

          if (!allowedBranches.includes(requestedBranch)) {
            // Yetkisiz branch yerine kullanıcının ana şubesini zorla.
            payload.branch = user.branch;
          }
        }
      }
    }

    // 3) Apps Script yalnızca sunucu tarafından çağrılır.
    const scriptUrl =
      process.env.APPS_SCRIPT_URL ||
      process.env.NEXT_PUBLIC_SCRIPT_URL;

    if (!scriptUrl) {
      console.error('APPS_SCRIPT_URL bulunamadı.');

      return jsonResponse(
        {
          result: 'error',
          message: 'İşlem servisi yapılandırılmamış.',
        },
        500
      );
    }

    const upstream = await fetch(scriptUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
        'User-Agent': 'CNETMOBIL-Portal/2.0',
      },
      body: JSON.stringify(payload),
      cache: 'no-store',
      redirect: 'follow',
    });

    const upstreamText = await upstream.text();

    let upstreamData: Record<string, unknown>;

    try {
      upstreamData = JSON.parse(upstreamText);
    } catch {
      console.error(
        'Apps Script JSON olmayan cevap döndürdü:',
        upstreamText.slice(0, 300)
      );

      return jsonResponse(
        {
          result: 'error',
          message: 'İşlem servisinden geçersiz cevap alındı.',
        },
        502
      );
    }

    if (!upstream.ok) {
      return jsonResponse(
        {
          result: 'error',
          message:
            typeof upstreamData.message === 'string'
              ? upstreamData.message
              : 'İşlem servisi hata döndürdü.',
        },
        502
      );
    }

    // 4) Başarılı işlemi audit_logs tablosuna yaz.
    const forwardedFor =
      request.headers.get('x-forwarded-for');

    const ip =
      forwardedFor?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      null;

    await writeAuditLog({
      userId: session.userId,
      action: actionType,
      module: permissionModule(rule.permission),
      payload,
      ip,
    });

    // Apps Script'in mevcut response formatını koru.
    return jsonResponse(upstreamData, 200);
  } catch (error) {
    console.error('PANEL ACTION PERMISSION ERROR:', error);

    return jsonResponse(
      {
        result: 'error',
        message: 'İşlem sırasında sunucu hatası oluştu.',
      },
      500
    );
  }
}
