// app/api/admin/users/route.ts
// SUPER ADMIN - Kullanıcı Yönetimi API
//
// GET  -> kullanıcıları listeler
// POST -> yeni kullanıcı oluşturur ve rol atar
//
// Güvenlik:
// - Sadece PostgreSQL'de super_admin rolü olan kullanıcı erişebilir.
// - HttpOnly cnet_auth oturumu doğrulanır.
// - Yeni kullanıcı şifresi bcrypt ile hashlenir.
// - En fazla 2 aktif Super Admin hesabına izin verilir.
// - Gerçek rol user_roles tablosundan yönetilir.
// - users.role alanı geçiş sürecinde sadece legacy uyumluluk için tutulur.

import { NextRequest, NextResponse } from 'next/server';
import { Pool, PoolClient } from 'pg';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

declare global {
  // eslint-disable-next-line no-var
  var cnetAdminUsersPool: Pool | undefined;
}

const COOKIE_NAME = 'cnet_auth';
const MAX_ACTIVE_SUPER_ADMINS = 2;

type SessionPayload = {
  userId: number | null;
  role: 'admin' | 'personel';
  branch: string;
  exp: number;
  legacy?: boolean;
};

const ALLOWED_ROLE_CODES = new Set([
  'super_admin',
  'yonetici',
  'personel',
]);

function getPool() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL bulunamadı.');
  }

  if (!global.cnetAdminUsersPool) {
    global.cnetAdminUsersPool = new Pool({
      connectionString,
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
  }

  return global.cnetAdminUsersPool;
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
      typeof payload.userId !== 'number'
    ) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

function json(
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
  const appUrl = process.env.APP_URL;

  if (!appUrl) {
    const host = request.headers.get('host');
    const proto =
      request.headers.get('x-forwarded-proto') ||
      request.nextUrl.protocol.replace(':', '');

    if (!host) return false;

    return request.headers.get('origin') === `${proto}://${host}`;
  }

  try {
    return request.headers.get('origin') === new URL(appUrl).origin;
  } catch {
    return false;
  }
}

async function requireSuperAdmin(
  request: NextRequest
): Promise<
  | { ok: true; userId: number }
  | { ok: false; response: NextResponse }
> {
  const token = request.cookies.get(COOKIE_NAME)?.value;

  if (!token) {
    return {
      ok: false,
      response: json(
        { success: false, error: 'Oturum gerekli.' },
        401
      ),
    };
  }

  const session = verifySession(token);

  if (!session?.userId) {
    return {
      ok: false,
      response: json(
        { success: false, error: 'Geçerli kullanıcı oturumu gerekli.' },
        401
      ),
    };
  }

  const pool = getPool();

  const result = await pool.query(
    `
      SELECT 1
      FROM public.users u
      JOIN public.user_roles ur ON ur.user_id = u.id
      JOIN public.roles r ON r.id = ur.role_id
      WHERE u.id = $1
        AND u.active = TRUE
        AND r.code = 'super_admin'
        AND r.active = TRUE
      LIMIT 1
    `,
    [session.userId]
  );

  if (result.rowCount !== 1) {
    return {
      ok: false,
      response: json(
        { success: false, error: 'Super Admin yetkisi gerekli.' },
        403
      ),
    };
  }

  return {
    ok: true,
    userId: session.userId,
  };
}

async function countActiveSuperAdmins(
  client: PoolClient
) {
  const result = await client.query(
    `
      SELECT COUNT(DISTINCT u.id)::int AS count
      FROM public.users u
      JOIN public.user_roles ur ON ur.user_id = u.id
      JOIN public.roles r ON r.id = ur.role_id
      WHERE u.active = TRUE
        AND r.code = 'super_admin'
        AND r.active = TRUE
    `
  );

  return Number(result.rows[0]?.count || 0);
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPassword(password: string) {
  return (
    password.length >= 8 &&
    /[A-ZÇĞİÖŞÜ]/.test(password) &&
    /[a-zçğıöşü]/.test(password) &&
    /\d/.test(password)
  );
}

async function writeAuditLog(params: {
  client: PoolClient;
  actorUserId: number;
  action: string;
  targetUserId: number;
  newData: Record<string, unknown>;
  ip: string | null;
}) {
  await params.client.query(
    `
      INSERT INTO public.audit_logs
        (
          user_id,
          action,
          module,
          target_type,
          target_id,
          new_data,
          ip_address
        )
      VALUES
        ($1, $2, 'users', 'user', $3, $4::jsonb, $5)
    `,
    [
      params.actorUserId,
      params.action,
      String(params.targetUserId),
      JSON.stringify(params.newData),
      params.ip,
    ]
  );
}

// ======================================================
// GET /api/admin/users
// ======================================================
export async function GET(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin(request);

    if (!auth.ok) {
      return auth.response;
    }

    const pool = getPool();

    const usersResult = await pool.query(
      `
        SELECT
          u.id,
          u.username,
          u.email,
          u.branch,
          u.active,
          u.created_at,
          u.updated_at,
          u.last_login_at
        FROM public.users u
        ORDER BY
          CASE WHEN u.active THEN 0 ELSE 1 END,
          u.created_at DESC,
          u.id DESC
      `
    );

    const roleResult = await pool.query(
      `
        SELECT
          ur.user_id,
          r.code,
          r.name
        FROM public.user_roles ur
        JOIN public.roles r ON r.id = ur.role_id
        WHERE r.active = TRUE
        ORDER BY ur.user_id, r.id
      `
    );

    const branchResult = await pool.query(
      `
        SELECT user_id, branch
        FROM public.user_branch_access
        ORDER BY user_id, branch
      `
    );

    const rolesByUser = new Map<number, Array<{
      code: string;
      name: string;
    }>>();

    for (const row of roleResult.rows) {
      const userId = Number(row.user_id);

      if (!rolesByUser.has(userId)) {
        rolesByUser.set(userId, []);
      }

      rolesByUser.get(userId)!.push({
        code: String(row.code),
        name: String(row.name),
      });
    }

    const branchesByUser = new Map<number, string[]>();

    for (const row of branchResult.rows) {
      const userId = Number(row.user_id);

      if (!branchesByUser.has(userId)) {
        branchesByUser.set(userId, []);
      }

      branchesByUser.get(userId)!.push(String(row.branch));
    }

    const users = usersResult.rows.map((user) => {
      const userId = Number(user.id);

      return {
        id: userId,
        username: user.username,
        email: user.email,
        branch: user.branch,
        active: user.active,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
        lastLoginAt: user.last_login_at,
        roles: rolesByUser.get(userId) || [],
        branches:
          branchesByUser.get(userId)?.length
            ? branchesByUser.get(userId)
            : [String(user.branch)],
      };
    });

    const activeSuperAdminCount = users.filter(
      (user) =>
        user.active &&
        user.roles.some((role) => role.code === 'super_admin')
    ).length;

    return json({
      success: true,
      users,
      limits: {
        maxActiveSuperAdmins: MAX_ACTIVE_SUPER_ADMINS,
        activeSuperAdmins: activeSuperAdminCount,
      },
    });
  } catch (error) {
    console.error('ADMIN USERS GET ERROR:', error);

    return json(
      {
        success: false,
        error: 'Kullanıcı listesi alınamadı.',
      },
      500
    );
  }
}

// ======================================================
// POST /api/admin/users
// body:
// {
//   email: string,
//   password: string,
//   branch: string,
//   roleCode: "super_admin" | "yonetici" | "personel",
//   branches?: string[]
// }
// ======================================================
export async function POST(request: NextRequest) {
  let client: PoolClient | null = null;

  try {
    if (!validateOrigin(request)) {
      return json(
        {
          success: false,
          error: 'Geçersiz istek kaynağı.',
        },
        403
      );
    }

    const auth = await requireSuperAdmin(request);

    if (!auth.ok) {
      return auth.response;
    }

    const body = await request.json().catch(() => null);

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return json(
        {
          success: false,
          error: 'Geçersiz istek.',
        },
        400
      );
    }

    const email = String(body.email || '')
      .trim()
      .toLowerCase();

    const password = String(body.password || '');
    const branch = String(body.branch || '').trim();
    const roleCode = String(body.roleCode || '').trim();

    const requestedBranches = Array.isArray(body.branches)
      ? Array.from(
          new Set(
            body.branches
              .map((item: unknown) => String(item || '').trim())
              .filter(Boolean)
          )
        )
      : [];

    if (!isValidEmail(email)) {
      return json(
        {
          success: false,
          error: 'Geçerli bir e-posta adresi girin.',
        },
        400
      );
    }

    if (!isValidPassword(password)) {
      return json(
        {
          success: false,
          error:
            'Şifre en az 8 karakter, 1 büyük harf, 1 küçük harf ve 1 rakam içermelidir.',
        },
        400
      );
    }

    if (!branch) {
      return json(
        {
          success: false,
          error: 'Ana mağaza/şube gerekli.',
        },
        400
      );
    }

    if (!ALLOWED_ROLE_CODES.has(roleCode)) {
      return json(
        {
          success: false,
          error: 'Geçersiz rol.',
        },
        400
      );
    }

    const pool = getPool();
    client = await pool.connect();

    await client.query('BEGIN');

    const emailExists = await client.query(
      `
        SELECT id
        FROM public.users
        WHERE LOWER(email) = LOWER($1)
        LIMIT 1
      `,
      [email]
    );

    if (emailExists.rowCount) {
      await client.query('ROLLBACK');

      return json(
        {
          success: false,
          error: 'Bu e-posta adresi zaten kayıtlı.',
        },
        409
      );
    }

    const roleResult = await client.query(
      `
        SELECT id, code, name
        FROM public.roles
        WHERE code = $1
          AND active = TRUE
        LIMIT 1
      `,
      [roleCode]
    );

    if (roleResult.rowCount !== 1) {
      await client.query('ROLLBACK');

      return json(
        {
          success: false,
          error: 'Seçilen rol bulunamadı.',
        },
        400
      );
    }

    if (roleCode === 'super_admin') {
      const currentCount =
        await countActiveSuperAdmins(client);

      if (currentCount >= MAX_ACTIVE_SUPER_ADMINS) {
        await client.query('ROLLBACK');

        return json(
          {
            success: false,
            error:
              'En fazla 2 aktif Super Admin hesabı olabilir.',
          },
          400
        );
      }
    }

    const passwordHash = await bcrypt.hash(password, 12);

    // users.username şu an NOT NULL/UNIQUE olduğu için
    // kullanıcıya görünmeyen güvenli bir internal username üretiyoruz.
    const internalUsername =
      `usr_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`;

    // Eski auth yapısıyla uyumluluk:
    // super_admin / yonetici => users.role = admin
    // personel              => users.role = personel
    const legacyRole =
      roleCode === 'personel'
        ? 'personel'
        : 'admin';

    const insertUser = await client.query(
      `
        INSERT INTO public.users
          (
            username,
            email,
            password_hash,
            branch,
            role,
            active,
            created_at,
            updated_at
          )
        VALUES
          ($1, $2, $3, $4, $5, TRUE, NOW(), NOW())
        RETURNING
          id,
          username,
          email,
          branch,
          active,
          created_at
      `,
      [
        internalUsername,
        email,
        passwordHash,
        branch,
        legacyRole,
      ]
    );

    const user = insertUser.rows[0];
    const userId = Number(user.id);
    const role = roleResult.rows[0];

    await client.query(
      `
        INSERT INTO public.user_roles
          (user_id, role_id)
        VALUES
          ($1, $2)
        ON CONFLICT DO NOTHING
      `,
      [userId, role.id]
    );

    const finalBranches =
      requestedBranches.length > 0
        ? requestedBranches
        : [branch];

    for (const allowedBranch of finalBranches) {
      await client.query(
        `
          INSERT INTO public.user_branch_access
            (user_id, branch)
          VALUES
            ($1, $2)
          ON CONFLICT DO NOTHING
        `,
        [userId, allowedBranch]
      );
    }

    const forwardedFor =
      request.headers.get('x-forwarded-for');

    const ip =
      forwardedFor?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      null;

    await writeAuditLog({
      client,
      actorUserId: auth.userId,
      action: 'USER_CREATED',
      targetUserId: userId,
      newData: {
        email,
        branch,
        roleCode,
        branches: finalBranches,
        active: true,
      },
      ip,
    });

    await client.query('COMMIT');

    return json(
      {
        success: true,
        message: 'Kullanıcı oluşturuldu.',
        user: {
          id: userId,
          email: user.email,
          branch: user.branch,
          active: user.active,
          createdAt: user.created_at,
          role: {
            code: role.code,
            name: role.name,
          },
          branches: finalBranches,
        },
      },
      201
    );
  } catch (error: any) {
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch {}
    }

    console.error('ADMIN USERS POST ERROR:', error);

    if (error?.code === '23505') {
      return json(
        {
          success: false,
          error: 'Bu kullanıcı zaten mevcut.',
        },
        409
      );
    }

    return json(
      {
        success: false,
        error: 'Kullanıcı oluşturulamadı.',
      },
      500
    );
  } finally {
    client?.release();
  }
}
