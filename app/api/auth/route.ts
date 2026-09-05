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
// LOGIN
// -----------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const mode = body.mode === 'yonetici' ? 'yonetici' : 'personel';

    if (!password || password.length > 200) {
      return NextResponse.json(
        { success: false, message: 'Şifre gerekli.' },
        { status: 400 }
      );
    }

    if (mode === 'yonetici' && !email) {
      return NextResponse.json(
        { success: false, message: 'E-posta adresi gerekli.' },
        { status: 400 }
      );
    }

    const requestedRole = mode === 'yonetici' ? 'admin' : 'personel';

    // Yeni PostgreSQL kullanıcı sistemi.
    // Yönetici girişinde e-posta + şifre birlikte doğrulanır.
    const result =
      requestedRole === 'admin'
        ? await pool.query(
            `
              SELECT id, username, email, password_hash, branch, role
              FROM public.users
              WHERE active = TRUE
                AND role = 'admin'
                AND LOWER(email) = LOWER($1)
              LIMIT 1
            `,
            [email]
          )
        : await pool.query(
            `
              SELECT id, username, email, password_hash, branch, role
              FROM public.users
              WHERE active = TRUE
                AND role = 'personel'
              ORDER BY id ASC
            `
          );

    for (const user of result.rows) {
      const passwordCorrect = await bcrypt.compare(password, user.password_hash);

      if (passwordCorrect) {
        await pool.query(
          `
            UPDATE public.users
            SET last_login_at = NOW(), updated_at = NOW()
            WHERE id = $1
          `,
          [user.id]
        );

        return createLoginResponse(user.role, user.branch, Number(user.id));
      }
    }

    // Geçiş süreci yedeği: mağazalar PostgreSQL'e taşınana kadar eski env şifreleri çalışır.
    if (
      mode === 'yonetici' &&
      process.env.ADMIN_PASS &&
      password === process.env.ADMIN_PASS
    ) {
      return createLoginResponse('admin', 'CMR MERKEZ', null, true);
    }

    if (mode === 'personel') {
      try {
        const branchData = JSON.parse(process.env.BRANCH_PASSWORDS || '{}');
        const matchedBranch = branchData[password];

        if (matchedBranch) {
          return createLoginResponse('personel', matchedBranch, null, true);
        }
      } catch (error) {
        console.error('BRANCH_PASSWORDS okunamadı:', error);
      }
    }

    return NextResponse.json(
      { success: false, message: 'Giriş bilgileri hatalı.' },
      { status: 401 }
    );
  } catch (error) {
    console.error('AUTH LOGIN ERROR:', error);
    return NextResponse.json(
      { success: false, message: 'Giriş işlemi sırasında hata oluştu.' },
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
