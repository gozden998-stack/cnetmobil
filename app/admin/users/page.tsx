// app/api/admin/users/route.ts
// CNETMOBIL - Super Admin Kullanıcı / Rol / Yetki Yönetimi V2
//
// GET   -> kullanıcılar + roller + yetki kataloğu
// POST  -> yeni kullanıcı oluşturur
// PATCH -> kullanıcıyı, rolünü, şubelerini ve yetkilerini günceller
//
// Güvenlik:
// - Yalnızca PostgreSQL'de aktif super_admin rolü olan kullanıcı erişebilir.
// - HttpOnly cnet_auth oturumu doğrulanır.
// - Şifreler bcrypt ile saklanır.
// - En fazla 2 aktif Super Admin olabilir.
// - En az 1 aktif Super Admin her zaman korunur.
// - Yetki değişiklikleri user_permissions üzerinden DB'den yönetilir.
// - Tüm değişiklikler audit_logs'a yazılır.

import { NextRequest, NextResponse } from 'next/server';
import { Pool, PoolClient } from 'pg';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

declare global {
  // eslint-disable-next-line no-var
  var cnetAdminUsersPoolV2: Pool | undefined;
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

  if (!global.cnetAdminUsersPoolV2) {
    global.cnetAdminUsersPoolV2 = new Pool({
      connectionString,
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
  }

  return global.cnetAdminUsersPoolV2;
}

function getSessionSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error('SESSION_SECRET bulunamadı.');
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

    if (
      signatureBuffer.length !== expectedBuffer.length ||
      !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
    ) {
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

function validateOrigin(request: NextRequest) {
  const appUrl = process.env.APP_URL;

  try {
    const expectedOrigin = appUrl
      ? new URL(appUrl).origin
      : `${request.headers.get('x-forwarded-proto') || 'https'}://${request.headers.get('host')}`;

    return request.headers.get('origin') === expectedOrigin;
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
      response: json({ success: false, error: 'Oturum gerekli.' }, 401),
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

  const result = await getPool().query(
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

  return { ok: true, userId: session.userId };
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

async function countActiveSuperAdmins(client: PoolClient) {
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

async function getUserCurrentRole(
  client: PoolClient,
  userId: number
): Promise<string | null> {
  const result = await client.query(
    `
      SELECT r.code
      FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = $1
        AND r.active = TRUE
      ORDER BY
        CASE r.code
          WHEN 'super_admin' THEN 1
          WHEN 'yonetici' THEN 2
          WHEN 'personel' THEN 3
          ELSE 9
        END
      LIMIT 1
    `,
    [userId]
  );

  return result.rowCount ? String(result.rows[0].code) : null;
}

async function getRoleDefaultPermissions(
  client: PoolClient,
  roleCode: string
): Promise<Set<string>> {
  const result = await client.query(
    `
      SELECT p.code
      FROM public.roles r
      JOIN public.role_permissions rp ON rp.role_id = r.id
      JOIN public.permissions p ON p.id = rp.permission_id
      WHERE r.code = $1
        AND r.active = TRUE
        AND p.active = TRUE
    `,
    [roleCode]
  );

  return new Set(result.rows.map((row) => String(row.code)));
}

async function getAllActivePermissions(client: PoolClient) {
  const result = await client.query(
    `
      SELECT id, code, name, module, description
      FROM public.permissions
      WHERE active = TRUE
      ORDER BY module, name, code
    `
  );

  return result.rows;
}

async function writeAuditLog(params: {
  client: PoolClient;
  actorUserId: number;
  action: string;
  targetUserId: number;
  oldData?: Record<string, unknown> | null;
  newData?: Record<string, unknown> | null;
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
          old_data,
          new_data,
          ip_address
        )
      VALUES
        ($1, $2, 'users', 'user', $3, $4::jsonb, $5::jsonb, $6)
    `,
    [
      params.actorUserId,
      params.action,
      String(params.targetUserId),
      params.oldData ? JSON.stringify(params.oldData) : null,
      params.newData ? JSON.stringify(params.newData) : null,
      params.ip,
    ]
  );
}

function getRequestIp(request: NextRequest) {
  const forwardedFor = request.headers.get('x-forwarded-for');
  return (
    forwardedFor?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    null
  );
}

// ======================================================
// GET /api/admin/users
// ======================================================
export async function GET(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin(request);
    if (!auth.ok) return auth.response;

    const pool = getPool();

    const [
      usersResult,
      rolesResult,
      userRolesResult,
      branchResult,
      permissionsResult,
      rolePermissionsResult,
      userPermissionsResult,
    ] = await Promise.all([
      pool.query(
        `
          SELECT
            id,
            username,
            email,
            branch,
            active,
            created_at,
            updated_at,
            last_login_at
          FROM public.users
          ORDER BY
            CASE WHEN active THEN 0 ELSE 1 END,
            created_at DESC,
            id DESC
        `
      ),
      pool.query(
        `
          SELECT id, code, name, description, is_system
          FROM public.roles
          WHERE active = TRUE
          ORDER BY
            CASE code
              WHEN 'super_admin' THEN 1
              WHEN 'yonetici' THEN 2
              WHEN 'personel' THEN 3
              ELSE 9
            END,
            name
        `
      ),
      pool.query(
        `
          SELECT ur.user_id, r.code, r.name
          FROM public.user_roles ur
          JOIN public.roles r ON r.id = ur.role_id
          WHERE r.active = TRUE
          ORDER BY ur.user_id, r.id
        `
      ),
      pool.query(
        `
          SELECT user_id, branch
          FROM public.user_branch_access
          ORDER BY user_id, branch
        `
      ),
      pool.query(
        `
          SELECT id, code, name, module, description
          FROM public.permissions
          WHERE active = TRUE
          ORDER BY module, name, code
        `
      ),
      pool.query(
        `
          SELECT r.code AS role_code, p.code AS permission_code
          FROM public.roles r
          JOIN public.role_permissions rp ON rp.role_id = r.id
          JOIN public.permissions p ON p.id = rp.permission_id
          WHERE r.active = TRUE
            AND p.active = TRUE
        `
      ),
      pool.query(
        `
          SELECT up.user_id, p.code AS permission_code, up.allowed
          FROM public.user_permissions up
          JOIN public.permissions p ON p.id = up.permission_id
          WHERE p.active = TRUE
        `
      ),
    ]);

    const rolesByUser = new Map<number, Array<{ code: string; name: string }>>();
    for (const row of userRolesResult.rows) {
      const userId = Number(row.user_id);
      if (!rolesByUser.has(userId)) rolesByUser.set(userId, []);
      rolesByUser.get(userId)!.push({
        code: String(row.code),
        name: String(row.name),
      });
    }

    const branchesByUser = new Map<number, string[]>();
    for (const row of branchResult.rows) {
      const userId = Number(row.user_id);
      if (!branchesByUser.has(userId)) branchesByUser.set(userId, []);
      branchesByUser.get(userId)!.push(String(row.branch));
    }

    const defaultsByRole = new Map<string, Set<string>>();
    for (const row of rolePermissionsResult.rows) {
      const roleCode = String(row.role_code);
      if (!defaultsByRole.has(roleCode)) defaultsByRole.set(roleCode, new Set());
      defaultsByRole.get(roleCode)!.add(String(row.permission_code));
    }

    const overridesByUser = new Map<number, Map<string, boolean>>();
    for (const row of userPermissionsResult.rows) {
      const userId = Number(row.user_id);
      if (!overridesByUser.has(userId)) {
        overridesByUser.set(userId, new Map());
      }
      overridesByUser
        .get(userId)!
        .set(String(row.permission_code), row.allowed === true);
    }

    const allPermissionCodes = permissionsResult.rows.map((p) => String(p.code));

    const users = usersResult.rows.map((user) => {
      const userId = Number(user.id);
      const roles = rolesByUser.get(userId) || [];
      const roleCode =
        roles.find((r) => r.code === 'super_admin')?.code ||
        roles.find((r) => r.code === 'yonetici')?.code ||
        roles.find((r) => r.code === 'personel')?.code ||
        null;

      let effectivePermissions = new Set<string>();

      if (roleCode === 'super_admin') {
        effectivePermissions = new Set(allPermissionCodes);
      } else if (roleCode) {
        effectivePermissions = new Set(defaultsByRole.get(roleCode) || []);

        const overrides = overridesByUser.get(userId);
        if (overrides) {
          for (const [code, allowed] of overrides.entries()) {
            if (allowed) effectivePermissions.add(code);
            else effectivePermissions.delete(code);
          }
        }
      }

      return {
        id: userId,
        username: user.username,
        email: user.email,
        branch: user.branch,
        active: user.active,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
        lastLoginAt: user.last_login_at,
        roles,
        roleCode,
        branches:
          branchesByUser.get(userId)?.length
            ? branchesByUser.get(userId)
            : [String(user.branch)],
        effectivePermissions: Array.from(effectivePermissions).sort(),
      };
    });

    const activeSuperAdmins = users.filter(
      (user) => user.active && user.roleCode === 'super_admin'
    ).length;

    return json({
      success: true,
      users,
      roles: rolesResult.rows.map((r) => ({
        code: r.code,
        name: r.name,
        description: r.description,
        isSystem: r.is_system,
      })),
      permissions: permissionsResult.rows.map((p) => ({
        code: p.code,
        name: p.name,
        module: p.module,
        description: p.description,
      })),
      limits: {
        maxActiveSuperAdmins: MAX_ACTIVE_SUPER_ADMINS,
        activeSuperAdmins,
      },
    });
  } catch (error) {
    console.error('ADMIN USERS GET V2 ERROR:', error);
    return json(
      { success: false, error: 'Kullanıcı listesi alınamadı.' },
      500
    );
  }
}

// ======================================================
// POST /api/admin/users
// ======================================================
export async function POST(request: NextRequest) {
  let client: PoolClient | null = null;

  try {
    if (!validateOrigin(request)) {
      return json({ success: false, error: 'Geçersiz istek kaynağı.' }, 403);
    }

    const auth = await requireSuperAdmin(request);
    if (!auth.ok) return auth.response;

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return json({ success: false, error: 'Geçersiz istek.' }, 400);
    }

    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const branch = String(body.branch || '').trim();
    const roleCode = String(body.roleCode || '').trim();

    const requestedBranches: string[] = Array.isArray(body.branches)
      ? Array.from(
          new Set<string>(
            (body.branches as unknown[])
              .map((item: unknown) => String(item || '').trim())
              .filter((item: string) => item.length > 0)
          )
        )
      : [];

    if (!isValidEmail(email)) {
      return json(
        { success: false, error: 'Geçerli bir e-posta adresi girin.' },
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
      return json({ success: false, error: 'Ana mağaza/şube gerekli.' }, 400);
    }

    if (!ALLOWED_ROLE_CODES.has(roleCode)) {
      return json({ success: false, error: 'Geçersiz rol.' }, 400);
    }

    client = await getPool().connect();
    await client.query('BEGIN');

    const emailExists = await client.query(
      `SELECT id FROM public.users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
      [email]
    );

    if (emailExists.rowCount) {
      await client.query('ROLLBACK');
      return json(
        { success: false, error: 'Bu e-posta adresi zaten kayıtlı.' },
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
        { success: false, error: 'Seçilen rol bulunamadı.' },
        400
      );
    }

    if (roleCode === 'super_admin') {
      const count = await countActiveSuperAdmins(client);
      if (count >= MAX_ACTIVE_SUPER_ADMINS) {
        await client.query('ROLLBACK');
        return json(
          {
            success: false,
            error: `En fazla ${MAX_ACTIVE_SUPER_ADMINS} aktif Super Admin hesabı olabilir.`,
          },
          400
        );
      }
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const internalUsername =
      `usr_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`;
    const legacyRole = roleCode === 'personel' ? 'personel' : 'admin';

    const insertUser = await client.query(
      `
        INSERT INTO public.users
          (username, email, password_hash, branch, role, active, created_at, updated_at)
        VALUES
          ($1, $2, $3, $4, $5, TRUE, NOW(), NOW())
        RETURNING id, email, branch, active, created_at
      `,
      [internalUsername, email, passwordHash, branch, legacyRole]
    );

    const user = insertUser.rows[0];
    const userId = Number(user.id);
    const role = roleResult.rows[0];

    await client.query(
      `
        INSERT INTO public.user_roles (user_id, role_id)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING
      `,
      [userId, role.id]
    );

    const finalBranches =
      requestedBranches.length > 0
        ? Array.from(new Set([...requestedBranches, branch]))
        : [branch];

    for (const allowedBranch of finalBranches) {
      await client.query(
        `
          INSERT INTO public.user_branch_access (user_id, branch)
          VALUES ($1, $2)
          ON CONFLICT DO NOTHING
        `,
        [userId, allowedBranch]
      );
    }

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
      ip: getRequestIp(request),
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
          roleCode,
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

    console.error('ADMIN USERS POST V2 ERROR:', error);

    if (error?.code === '23505') {
      return json(
        { success: false, error: 'Bu kullanıcı zaten mevcut.' },
        409
      );
    }

    return json(
      { success: false, error: 'Kullanıcı oluşturulamadı.' },
      500
    );
  } finally {
    client?.release();
  }
}

// ======================================================
// PATCH /api/admin/users
//
// body:
// {
//   userId: number,
//   email: string,
//   branch: string,
//   branches: string[],
//   roleCode: "super_admin" | "yonetici" | "personel",
//   active: boolean,
//   permissions: string[]   // kullanıcının istediğimiz efektif yetkileri
// }
// ======================================================
export async function PATCH(request: NextRequest) {
  let client: PoolClient | null = null;

  try {
    if (!validateOrigin(request)) {
      return json({ success: false, error: 'Geçersiz istek kaynağı.' }, 403);
    }

    const auth = await requireSuperAdmin(request);
    if (!auth.ok) return auth.response;

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return json({ success: false, error: 'Geçersiz istek.' }, 400);
    }

    const userId = Number(body.userId);
    const email = String(body.email || '').trim().toLowerCase();
    const branch = String(body.branch || '').trim();
    const roleCode = String(body.roleCode || '').trim();
    const active = body.active === true;

    const desiredPermissions: Set<string> = new Set<string>(
      Array.isArray(body.permissions)
        ? (body.permissions as unknown[])
            .map((x: unknown) => String(x || '').trim())
            .filter((x: string) => x.length > 0)
        : []
    );

    const desiredBranches: string[] = Array.from(
      new Set<string>(
        Array.isArray(body.branches)
          ? (body.branches as unknown[])
              .map((x: unknown) => String(x || '').trim())
              .filter((x: string) => x.length > 0)
          : []
      )
    );

    if (!Number.isInteger(userId) || userId <= 0) {
      return json({ success: false, error: 'Geçersiz kullanıcı.' }, 400);
    }

    if (!isValidEmail(email)) {
      return json(
        { success: false, error: 'Geçerli bir e-posta adresi girin.' },
        400
      );
    }

    if (!branch) {
      return json({ success: false, error: 'Ana mağaza/şube gerekli.' }, 400);
    }

    if (!ALLOWED_ROLE_CODES.has(roleCode)) {
      return json({ success: false, error: 'Geçersiz rol.' }, 400);
    }

    client = await getPool().connect();
    await client.query('BEGIN');

    const targetResult = await client.query(
      `
        SELECT id, email, branch, active, role
        FROM public.users
        WHERE id = $1
        FOR UPDATE
      `,
      [userId]
    );

    if (targetResult.rowCount !== 1) {
      await client.query('ROLLBACK');
      return json({ success: false, error: 'Kullanıcı bulunamadı.' }, 404);
    }

    const oldUser = targetResult.rows[0];
    const oldRoleCode = await getUserCurrentRole(client, userId);
    const oldWasActiveSuperAdmin =
      oldUser.active === true && oldRoleCode === 'super_admin';
    const newWillBeActiveSuperAdmin =
      active && roleCode === 'super_admin';

    const currentSuperAdminCount =
      await countActiveSuperAdmins(client);

    if (
      !oldWasActiveSuperAdmin &&
      newWillBeActiveSuperAdmin &&
      currentSuperAdminCount >= MAX_ACTIVE_SUPER_ADMINS
    ) {
      await client.query('ROLLBACK');
      return json(
        {
          success: false,
          error: `En fazla ${MAX_ACTIVE_SUPER_ADMINS} aktif Super Admin hesabı olabilir.`,
        },
        400
      );
    }

    if (
      oldWasActiveSuperAdmin &&
      !newWillBeActiveSuperAdmin &&
      currentSuperAdminCount <= 1
    ) {
      await client.query('ROLLBACK');
      return json(
        {
          success: false,
          error: 'Sistemde en az 1 aktif Super Admin kalmalıdır.',
        },
        400
      );
    }

    const duplicateEmail = await client.query(
      `
        SELECT id
        FROM public.users
        WHERE LOWER(email) = LOWER($1)
          AND id <> $2
        LIMIT 1
      `,
      [email, userId]
    );

    if (duplicateEmail.rowCount) {
      await client.query('ROLLBACK');
      return json(
        { success: false, error: 'Bu e-posta başka bir kullanıcıda kayıtlı.' },
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
      return json({ success: false, error: 'Seçilen rol bulunamadı.' }, 400);
    }

    const allPermissions = await getAllActivePermissions(client);
    const allowedPermissionCodes = new Set(
      allPermissions.map((p) => String(p.code))
    );

    for (const code of desiredPermissions) {
      if (!allowedPermissionCodes.has(code)) {
        await client.query('ROLLBACK');
        return json(
          { success: false, error: `Geçersiz yetki: ${code}` },
          400
        );
      }
    }

    const finalBranches = Array.from(
      new Set([branch, ...desiredBranches])
    );

    const legacyRole = roleCode === 'personel' ? 'personel' : 'admin';

    await client.query(
      `
        UPDATE public.users
        SET
          email = $1,
          branch = $2,
          role = $3,
          active = $4,
          updated_at = NOW()
        WHERE id = $5
      `,
      [email, branch, legacyRole, active, userId]
    );

    await client.query(
      `DELETE FROM public.user_roles WHERE user_id = $1`,
      [userId]
    );

    await client.query(
      `
        INSERT INTO public.user_roles (user_id, role_id)
        VALUES ($1, $2)
      `,
      [userId, roleResult.rows[0].id]
    );

    await client.query(
      `DELETE FROM public.user_branch_access WHERE user_id = $1`,
      [userId]
    );

    for (const allowedBranch of finalBranches) {
      await client.query(
        `
          INSERT INTO public.user_branch_access (user_id, branch)
          VALUES ($1, $2)
          ON CONFLICT DO NOTHING
        `,
        [userId, allowedBranch]
      );
    }

    // Super Admin tüm yetkilere otomatik sahiptir; override tutmayız.
    await client.query(
      `DELETE FROM public.user_permissions WHERE user_id = $1`,
      [userId]
    );

    if (roleCode !== 'super_admin') {
      const roleDefaults = await getRoleDefaultPermissions(
        client,
        roleCode
      );

      for (const permission of allPermissions) {
        const code = String(permission.code);
        const defaultAllowed = roleDefaults.has(code);
        const desiredAllowed = desiredPermissions.has(code);

        // Sadece rol varsayılanından farklıysa override yaz.
        if (defaultAllowed !== desiredAllowed) {
          await client.query(
            `
              INSERT INTO public.user_permissions
                (user_id, permission_id, allowed)
              VALUES
                ($1, $2, $3)
              ON CONFLICT (user_id, permission_id)
              DO UPDATE SET allowed = EXCLUDED.allowed
            `,
            [userId, permission.id, desiredAllowed]
          );
        }
      }
    }

    await writeAuditLog({
      client,
      actorUserId: auth.userId,
      action: 'USER_UPDATED',
      targetUserId: userId,
      oldData: {
        email: oldUser.email,
        branch: oldUser.branch,
        roleCode: oldRoleCode,
        active: oldUser.active,
      },
      newData: {
        email,
        branch,
        roleCode,
        active,
        branches: finalBranches,
        permissions:
          roleCode === 'super_admin'
            ? Array.from(allowedPermissionCodes)
            : Array.from(desiredPermissions).sort(),
      },
      ip: getRequestIp(request),
    });

    await client.query('COMMIT');

    return json({
      success: true,
      message: 'Kullanıcı ayarları güncellendi.',
      userId,
    });
  } catch (error: any) {
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch {}
    }

    console.error('ADMIN USERS PATCH V2 ERROR:', error);

    if (error?.code === '23505') {
      return json(
        { success: false, error: 'Bu e-posta başka bir kullanıcıda kayıtlı.' },
        409
      );
    }

    return json(
      { success: false, error: 'Kullanıcı güncellenemedi.' },
      500
    );
  } finally {
    client?.release();
  }
}
