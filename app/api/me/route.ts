// app/api/me/route.ts
// Merkezi kullanıcı + rol + yetki bilgisi
// Mevcut giriş sistemini bozmaz; sadece oturum açmış kullanıcının
// PostgreSQL'deki rol/yetki bilgisini döndürür.

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import crypto from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

declare global {
  // eslint-disable-next-line no-var
  var cnetMePool: Pool | undefined;
}

const COOKIE_NAME = 'cnet_auth';

type SessionPayload = {
  userId: number | null;
  role: 'admin' | 'personel';
  branch: string;
  exp: number;
  legacy?: boolean;
};

function getPool() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL bulunamadı.');
  }

  if (!global.cnetMePool) {
    global.cnetMePool = new Pool({
      connectionString,
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
  }

  return global.cnetMePool;
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

function noStoreJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store, max-age=0',
      Pragma: 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get(COOKIE_NAME)?.value;

    if (!token) {
      return noStoreJson(
        { success: false, error: 'Oturum gerekli.' },
        401
      );
    }

    const session = verifySession(token);

    if (!session) {
      return noStoreJson(
        { success: false, error: 'Geçersiz veya süresi dolmuş oturum.' },
        401
      );
    }

    // Geçiş sürecindeki eski env tabanlı kullanıcılar.
    // DB kullanıcısına taşındıklarında otomatik olarak yeni sisteme geçerler.
    if (!session.userId) {
      return noStoreJson({
        success: true,
        user: {
          id: null,
          username: null,
          email: null,
          branch: session.branch,
          legacyRole: session.role,
          active: true,
        },
        roles: [],
        permissions: [],
        branches: [session.branch],
        isSuperAdmin: false,
        legacy: true,
      });
    }

    const pool = getPool();

    const userResult = await pool.query(
      `
        SELECT id, username, email, branch, role, active, last_login_at
        FROM public.users
        WHERE id = $1
        LIMIT 1
      `,
      [session.userId]
    );

    const user = userResult.rows[0];

    if (!user || !user.active) {
      return noStoreJson(
        { success: false, error: 'Kullanıcı aktif değil.' },
        401
      );
    }

    const rolesResult = await pool.query(
      `
        SELECT r.code, r.name
        FROM public.user_roles ur
        JOIN public.roles r ON r.id = ur.role_id
        WHERE ur.user_id = $1
          AND r.active = TRUE
        ORDER BY r.id
      `,
      [session.userId]
    );

    const roleCodes = rolesResult.rows.map((r) => String(r.code));
    const isSuperAdmin = roleCodes.includes('super_admin');

    let permissionRows: Array<{ code: string; name: string; module: string }> = [];

    if (isSuperAdmin) {
      // Super Admin her zaman tüm aktif yetkilere sahiptir.
      const result = await pool.query(
        `
          SELECT code, name, module
          FROM public.permissions
          WHERE active = TRUE
          ORDER BY module, code
        `
      );
      permissionRows = result.rows;
    } else {
      // Rol yetkileri
      const rolePerms = await pool.query(
        `
          SELECT DISTINCT p.code, p.name, p.module
          FROM public.user_roles ur
          JOIN public.role_permissions rp ON rp.role_id = ur.role_id
          JOIN public.permissions p ON p.id = rp.permission_id
          JOIN public.roles r ON r.id = ur.role_id
          WHERE ur.user_id = $1
            AND r.active = TRUE
            AND p.active = TRUE
          ORDER BY p.module, p.code
        `,
        [session.userId]
      );

      const permissionMap = new Map<
        string,
        { code: string; name: string; module: string }
      >();

      for (const row of rolePerms.rows) {
        permissionMap.set(String(row.code), {
          code: String(row.code),
          name: String(row.name),
          module: String(row.module),
        });
      }

      // Kullanıcıya özel allow / deny override
      const userPerms = await pool.query(
        `
          SELECT p.code, p.name, p.module, up.allowed
          FROM public.user_permissions up
          JOIN public.permissions p ON p.id = up.permission_id
          WHERE up.user_id = $1
            AND p.active = TRUE
        `,
        [session.userId]
      );

      for (const row of userPerms.rows) {
        const code = String(row.code);

        if (row.allowed) {
          permissionMap.set(code, {
            code,
            name: String(row.name),
            module: String(row.module),
          });
        } else {
          permissionMap.delete(code);
        }
      }

      permissionRows = Array.from(permissionMap.values()).sort((a, b) => {
        const moduleCompare = a.module.localeCompare(b.module, 'tr');
        return moduleCompare !== 0
          ? moduleCompare
          : a.code.localeCompare(b.code, 'tr');
      });
    }

    const branchResult = await pool.query(
      `
        SELECT branch
        FROM public.user_branch_access
        WHERE user_id = $1
        ORDER BY branch
      `,
      [session.userId]
    );

    const branches =
      branchResult.rows.length > 0
        ? branchResult.rows.map((r) => String(r.branch))
        : [String(user.branch)];

    return noStoreJson({
      success: true,
      user: {
        id: Number(user.id),
        username: user.username,
        email: user.email,
        branch: user.branch,
        legacyRole: user.role,
        active: user.active,
        lastLoginAt: user.last_login_at,
      },
      roles: rolesResult.rows,
      permissions: permissionRows.map((p) => p.code),
      permissionDetails: permissionRows,
      branches,
      isSuperAdmin,
      legacy: false,
    });
  } catch (error) {
    console.error('ME API ERROR:', error);

    return noStoreJson(
      {
        success: false,
        error: 'Kullanıcı yetkileri okunamadı.',
      },
      500
    );
  }
}
