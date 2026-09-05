// app/api/auth/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

declare global {
  // eslint-disable-next-line no-var
  var cnetAuthPool: Pool | undefined;
}

const pool =
  global.cnetAuthPool ||
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });

if (process.env.NODE_ENV !== 'production') {
  global.cnetAuthPool = pool;
}

const COOKIE_NAME = 'cnet_auth';
const SESSION_DURATION = 60 * 60 * 12; // 12 saat

type SessionPayload = {
  userId: number | null;
  role: 'admin' | 'personel';
  branch: string;
  exp: number;
  legacy?: boolean;
};

function getSessionSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error('SESSION_SECRET bulunamadı.');
  return secret;
}

function signSession(payload: SessionPayload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', getSessionSecret())
    .update(encoded)
    .digest('base64url');

  return `${encoded}.${signature}`;
}

function verifySession(token: string): SessionPayload | null {
  try {
    const [encoded, signature] = token.split('.');
    if (!encoded || !signature) return null;

    const expectedSignature = crypto
      .createHmac('sha256', getSessionSecret())
      .update(encoded)
      .digest('base64url');

    const sigBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);

    if (sigBuffer.length !== expectedBuffer.length) return null;
    if (!crypto.timingSafeEqual(sigBuffer, expectedBuffer)) return null;

    const payload = JSON.parse(
      Buffer.from(encoded, 'base64url').toString('utf8')
    ) as SessionPayload;

    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

function clearSessionCookie(response: NextResponse) {
  response.cookies.set({
    name: COOKIE_NAME,
    value: '',
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}

function createLoginResponse(
  role: 'admin' | 'personel',
  branch: string,
  userId: number | null,
  legacy = false
) {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_DURATION;
  const token = signSession({ userId, role, branch, exp: expiresAt, legacy });

  const response = NextResponse.json({
    success: true,
    role: role === 'admin' ? 'yonetici' : 'personel',
    branch,
  });

  response.cookies.set({
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_DURATION,
  });

  return response;
}

// -----------------------------------------------------------------------------
// LOGIN - TEK GİRİŞ: E-POSTA + ŞİFRE
// -----------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const email =
      typeof body.email === 'string'
        ? body.email.trim().toLowerCase()
        : '';

    const password =
      typeof body.password === 'string'
        ? body.password
        : '';

    if (!email) {
      return NextResponse.json(
        { success: false, message: 'E-posta adresi gerekli.' },
        { status: 400 }
      );
    }

    if (!password || password.length > 200) {
      return NextResponse.json(
        { success: false, message: 'Şifre gerekli.' },
        { status: 400 }
      );
    }

    const result = await pool.query(
      `
        SELECT
          u.id,
          u.username,
          u.email,
          u.password_hash,
          u.branch,
          u.role,
          u.active
        FROM public.users u
        WHERE u.active = TRUE
          AND LOWER(u.email) = LOWER($1)
        LIMIT 1
      `,
      [email]
    );

    const user = result.rows[0];

    if (!user) {
      return NextResponse.json(
        { success: false, message: 'E-posta veya şifre hatalı.' },
        { status: 401 }
      );
    }

    const passwordCorrect = await bcrypt.compare(
      password,
      user.password_hash
    );

    if (!passwordCorrect) {
      return NextResponse.json(
        { success: false, message: 'E-posta veya şifre hatalı.' },
        { status: 401 }
      );
    }

    const roleResult = await pool.query(
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
      [user.id]
    );

    const roleCode =
      roleResult.rows[0]?.code
        ? String(roleResult.rows[0].code)
        : null;

    const sessionRole: 'admin' | 'personel' =
      roleCode === 'super_admin' || roleCode === 'yonetici'
        ? 'admin'
        : roleCode === 'personel'
        ? 'personel'
        : user.role === 'admin'
        ? 'admin'
        : 'personel';

    const branch = String(user.branch || 'CMR MERKEZ');

    await pool.query(
      `
        UPDATE public.users
        SET last_login_at = NOW(), updated_at = NOW()
        WHERE id = $1
      `,
      [user.id]
    );

    const expiresAt =
      Math.floor(Date.now() / 1000) + SESSION_DURATION;

    const token = signSession({
      userId: Number(user.id),
      role: sessionRole,
      branch,
      exp: expiresAt,
      legacy: false,
    });

    const response = NextResponse.json({
      success: true,
      role: sessionRole === 'admin' ? 'yonetici' : 'personel',
      accessRole:
        roleCode ||
        (sessionRole === 'admin' ? 'yonetici' : 'personel'),
      branch,
    });

    response.cookies.set({
      name: COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_DURATION,
    });

    return response;
  } catch (error) {
    console.error('AUTH LOGIN ERROR:', error);

    return NextResponse.json(
      {
        success: false,
        message: 'Giriş işlemi sırasında hata oluştu.',
      },
      { status: 500 }
    );
  }
}

// -----------------------------------------------------------------------------
// SESSION CHECK
// -----------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get(COOKIE_NAME)?.value || null;

    if (!token) {
      return NextResponse.json({ success: false }, { status: 401 });
    }

    const session = verifySession(token);

    if (!session) {
      const response = NextResponse.json({ success: false }, { status: 401 });
      clearSessionCookie(response);
      return response;
    }

    if (session.userId) {
      const result = await pool.query(
        `
          SELECT id, branch, role, active
          FROM public.users
          WHERE id = $1
          LIMIT 1
        `,
        [session.userId]
      );

      const user = result.rows[0];

      if (!user || !user.active) {
        const response = NextResponse.json({ success: false }, { status: 401 });
        clearSessionCookie(response);
        return response;
      }

      return NextResponse.json({
        success: true,
        role: user.role === 'admin' ? 'yonetici' : 'personel',
        branch: user.branch,
      });
    }

    // Legacy env kullanıcısı: geçiş bitene kadar desteklenir.
    return NextResponse.json({
      success: true,
      role: session.role === 'admin' ? 'yonetici' : 'personel',
      branch: session.branch,
    });
  } catch (error) {
    console.error('AUTH SESSION ERROR:', error);
    return NextResponse.json({ success: false }, { status: 401 });
  }
}

// -----------------------------------------------------------------------------
// LOGOUT
// -----------------------------------------------------------------------------
export async function DELETE() {
  const response = NextResponse.json({ success: true });
  clearSessionCookie(response);
  return response;
}
