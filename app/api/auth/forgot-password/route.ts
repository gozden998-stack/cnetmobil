// app/api/auth/forgot-password/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import crypto from 'crypto';
import nodemailer from 'nodemailer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

declare global {
  // eslint-disable-next-line no-var
  var cnetForgotPasswordPool: Pool | undefined;
}

const pool =
  global.cnetForgotPasswordPool ||
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 3,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });

if (process.env.NODE_ENV !== 'production') {
  global.cnetForgotPasswordPool = pool;
}

const GENERIC_MESSAGE =
  'E-posta adresi sistemde kayıtlıysa şifre sıfırlama bağlantısı gönderildi.';

function sha256(value: string) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function getMailer() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 465);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error('SMTP ayarları eksik.');
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export async function POST(request: NextRequest) {
  let insertedTokenId: number | null = null;

  try {
    const body = await request.json().catch(() => ({}));
    const email =
      typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';

    // Hesap var/yok bilgisini dışarı sızdırmamak için her durumda aynı cevap.
    if (!email || email.length > 255 || !email.includes('@')) {
      return NextResponse.json({ success: true, message: GENERIC_MESSAGE });
    }

    const userResult = await pool.query(
      `
        SELECT id, email, username
        FROM public.users
        WHERE active = TRUE
          AND email IS NOT NULL
          AND LOWER(email) = LOWER($1)
        LIMIT 1
      `,
      [email]
    );

    const user = userResult.rows[0];

    if (!user) {
      return NextResponse.json({ success: true, message: GENERIC_MESSAGE });
    }

    // Aynı kullanıcıya 60 saniye içinde tekrar tekrar mail gönderilmesini engelle.
    const recentResult = await pool.query(
      `
        SELECT id
        FROM public.password_reset_tokens
        WHERE user_id = $1
          AND created_at > NOW() - INTERVAL '60 seconds'
        ORDER BY created_at DESC
        LIMIT 1
      `,
      [user.id]
    );

    if (recentResult.rowCount && recentResult.rowCount > 0) {
      return NextResponse.json({ success: true, message: GENERIC_MESSAGE });
    }

    await pool.query(
      `
        DELETE FROM public.password_reset_tokens
        WHERE user_id = $1
          AND (used_at IS NOT NULL OR expires_at <= NOW())
      `,
      [user.id]
    );

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = sha256(rawToken);

    const insertResult = await pool.query(
      `
        INSERT INTO public.password_reset_tokens
          (user_id, token_hash, expires_at)
        VALUES
          ($1, $2, NOW() + INTERVAL '30 minutes')
        RETURNING id
      `,
      [user.id, tokenHash]
    );

    insertedTokenId = Number(insertResult.rows[0].id);

    const appUrl = (process.env.APP_URL || 'https://portal.cnetmobil.com.tr').replace(/\/$/, '');
    const resetUrl = `${appUrl}/?reset_token=${encodeURIComponent(rawToken)}`;
    const from = process.env.MAIL_FROM || 'CNETMOBİL Destek <destek@cnetmobil.com.tr>';
    const safeEmail = escapeHtml(String(user.email || email));

    const transporter = getMailer();

    await transporter.sendMail({
      from,
      to: String(user.email || email),
      subject: 'CNETMOBİL - Şifre Sıfırlama Talebi',
      text: [
        'CNETMOBİL Partner Yönetim Sistemi',
        '',
        'Hesabınız için şifre sıfırlama talebi aldık.',
        'Aşağıdaki bağlantıyı kullanarak yeni şifrenizi belirleyebilirsiniz:',
        '',
        resetUrl,
        '',
        'Bu bağlantı 30 dakika geçerlidir.',
        'Bu talebi siz yapmadıysanız bu e-postayı dikkate almayın.',
      ].join('\n'),
      html: `
        <div style="margin:0;padding:32px 16px;background:#f4f7fb;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
          <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:18px;overflow:hidden;box-shadow:0 12px 34px rgba(15,23,42,.08);">
            <div style="padding:30px 32px 22px;text-align:center;border-bottom:1px solid #eef2f7;">
              <div style="font-size:27px;font-weight:800;letter-spacing:-1px;">CNETMOBİL</div>
              <div style="margin-top:4px;font-size:12px;color:#64748b;">Partner Yönetim Sistemi</div>
            </div>
            <div style="padding:32px;">
              <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;">Şifre Sıfırlama Talebi</h1>
              <p style="margin:0 0 14px;font-size:14px;line-height:1.7;color:#475569;">${safeEmail} hesabınız için şifre sıfırlama talebi aldık.</p>
              <p style="margin:0 0 24px;font-size:14px;line-height:1.7;color:#475569;">Aşağıdaki butona tıklayarak yeni şifrenizi oluşturabilirsiniz.</p>
              <a href="${resetUrl}" style="display:block;text-align:center;background:#2563eb;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;padding:15px 18px;border-radius:10px;">ŞİFREMİ YENİLE</a>
              <p style="margin:22px 0 0;font-size:12px;line-height:1.7;color:#64748b;">Bu bağlantı <strong>30 dakika</strong> geçerlidir. Bu talebi siz yapmadıysanız bu e-postayı dikkate almayın.</p>
            </div>
            <div style="padding:18px 32px;text-align:center;background:#f8fafc;font-size:11px;color:#94a3b8;">Daha Güçlü, Daha Kârlı, Birlikte Büyüyoruz.</div>
          </div>
        </div>
      `,
    });

    return NextResponse.json({ success: true, message: GENERIC_MESSAGE });
  } catch (error) {
    console.error('FORGOT PASSWORD ERROR:', error);

    // Mail gönderimi başarısızsa kullanılmayacak tokenı temizle.
    if (insertedTokenId) {
      try {
        await pool.query(
          'DELETE FROM public.password_reset_tokens WHERE id = $1',
          [insertedTokenId]
        );
      } catch (cleanupError) {
        console.error('RESET TOKEN CLEANUP ERROR:', cleanupError);
      }
    }

    // Hesap var/yok bilgisini dışarı sızdırmamak için yine genel cevap dön.
    return NextResponse.json({ success: true, message: GENERIC_MESSAGE });
  }
}
