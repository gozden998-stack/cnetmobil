// app/api/auth/reset-password/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

declare global {
  // eslint-disable-next-line no-var
  var cnetResetPasswordPool: Pool | undefined;
}

const pool =
  global.cnetResetPasswordPool ||
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 3,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });

if (process.env.NODE_ENV !== 'production') {
  global.cnetResetPasswordPool = pool;
}

function sha256(value: string) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function validPassword(password: string) {
  return (
    password.length >= 8 &&
    password.length <= 128 &&
    /[A-ZÇĞİÖŞÜ]/.test(password) &&
    /[a-zçğıöşü]/.test(password) &&
    /[0-9]/.test(password)
  );
}

export async function POST(request: NextRequest) {
  const client = await pool.connect();

  try {
    const body = await request.json().catch(() => ({}));
    const token = typeof body.token === 'string' ? body.token.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';

    if (!/^[a-f0-9]{64}$/i.test(token)) {
      return NextResponse.json(
        { success: false, message: 'Şifre sıfırlama bağlantısı geçersiz veya süresi dolmuş.' },
        { status: 400 }
      );
    }

    if (!validPassword(password)) {
      return NextResponse.json(
        {
          success: false,
          message: 'Şifre en az 8 karakter olmalı; büyük harf, küçük harf ve rakam içermelidir.',
        },
        { status: 400 }
      );
    }

    const tokenHash = sha256(token);

    await client.query('BEGIN');

    const tokenResult = await client.query(
      `
        SELECT prt.id, prt.user_id
        FROM public.password_reset_tokens prt
        INNER JOIN public.users u ON u.id = prt.user_id
        WHERE prt.token_hash = $1
          AND prt.used_at IS NULL
          AND prt.expires_at > NOW()
          AND u.active = TRUE
        LIMIT 1
        FOR UPDATE OF prt
      `,
      [tokenHash]
    );

    const resetToken = tokenResult.rows[0];

    if (!resetToken) {
      await client.query('ROLLBACK');
      return NextResponse.json(
        { success: false, message: 'Şifre sıfırlama bağlantısı geçersiz veya süresi dolmuş.' },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await client.query(
      `
        UPDATE public.users
        SET password_hash = $1,
            updated_at = NOW()
        WHERE id = $2
      `,
      [passwordHash, resetToken.user_id]
    );

    await client.query(
      `
        UPDATE public.password_reset_tokens
        SET used_at = NOW()
        WHERE id = $1
      `,
      [resetToken.id]
    );

    // Aynı kullanıcıya ait diğer açık sıfırlama linklerini de geçersiz kıl.
    await client.query(
      `
        UPDATE public.password_reset_tokens
        SET used_at = NOW()
        WHERE user_id = $1
          AND used_at IS NULL
      `,
      [resetToken.user_id]
    );

    await client.query('COMMIT');

    const response = NextResponse.json({
      success: true,
      message: 'Şifreniz başarıyla değiştirildi. Yeni şifrenizle giriş yapabilirsiniz.',
    });

    // Bu tarayıcıda eski oturum varsa kapat.
    response.cookies.set({
      name: 'cnet_auth',
      value: '',
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });

    return response;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {}

    console.error('RESET PASSWORD ERROR:', error);
    return NextResponse.json(
      { success: false, message: 'Şifre değiştirilirken bir hata oluştu.' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
