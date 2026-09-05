// app/api/sheet-rows/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import crypto from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

declare global {
  // eslint-disable-next-line no-var
  var cnetPgPool: Pool | undefined;
}

const COOKIE_NAME = 'cnet_auth';

type SessionPayload = {
  userId: number | null;
  role: 'admin' | 'personel';
  branch: string;
  exp: number;
  legacy?: boolean;
};

// Panelin kullandığı bilinen sheet'ler.
// Böylece giriş yapmış biri bile rastgele sheet adı deneyemez.
const ALLOWED_SHEETS = new Set([
  'Google Sheets ile Kurumsal Alım Sistemi',
  'Ayarlar',
  'Alimlar',
  'Markalar',
  'CEP + TABLET+IOT SAAT LIST',
  'YNA LİST',
  'DIŞ KANAL SATIN ALMA',
  'Servis_Fiyatlari',
  '2.EL FİYAT LİSTESİ',
  'DEPO',
  'HEDEFLER',
  'MagazaGidisat',
  'PersonelGidisat',
  'THH',
  'CihazTalep',
  'CİHAZ SAT',
]);

function getPool() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable bulunamadı.');
  }

  if (!global.cnetPgPool) {
    global.cnetPgPool = new Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
  }

  return global.cnetPgPool;
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

function unauthorized(message = 'Oturum gerekli.') {
  const response = NextResponse.json(
    { error: message },
    { status: 401 }
  );

  // Geçersiz/eskimiş cookie varsa temizle.
  response.cookies.set({
    name: COOKIE_NAME,
    value: '',
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });

  response.headers.set('Cache-Control', 'no-store, max-age=0');

  return response;
}

async function authenticateRequest(
  request: NextRequest,
  pool: Pool
): Promise<SessionPayload | null> {
  const token = request.cookies.get(COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  const session = verifySession(token);

  if (!session) {
    return null;
  }

  // PostgreSQL kullanıcısıysa hâlâ aktif mi tekrar kontrol et.
  // Böylece admin bir kullanıcıyı pasife aldığında mevcut oturumu da veri okuyamaz.
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
      return null;
    }

    if (
      String(user.role) !== session.role ||
      String(user.branch) !== session.branch
    ) {
      return null;
    }
  }

  // legacy=true oturumlar geçiş süreci boyunca imzalı cookie ile çalışmaya devam eder.
  return session;
}

export async function GET(request: NextRequest) {
  try {
    const pool = getPool();

    // 1) Önce güvenli HttpOnly oturumu doğrula.
    const session = await authenticateRequest(request, pool);

    if (!session) {
      return unauthorized();
    }

    // 2) İstenen sheet'leri al.
    const repeated = request.nextUrl.searchParams.getAll('sheet');
    const commaSeparated = request.nextUrl.searchParams.get('sheets');

    const sheetNames = Array.from(
      new Set(
        [
          ...repeated,
          ...(commaSeparated ? commaSeparated.split(',') : []),
        ]
          .map((value) => value.trim())
          .filter(Boolean)
      )
    );

    if (!sheetNames.length) {
      return NextResponse.json(
        { error: 'En az bir sheet parametresi gerekli.' },
        {
          status: 400,
          headers: {
            'Cache-Control': 'no-store, max-age=0',
          },
        }
      );
    }

    if (sheetNames.length > 10) {
      return NextResponse.json(
        { error: 'Tek istekte en fazla 10 sheet istenebilir.' },
        {
          status: 400,
          headers: {
            'Cache-Control': 'no-store, max-age=0',
          },
        }
      );
    }

    // 3) Panelde tanımlı olmayan sheet isimlerini reddet.
    const invalidSheets = sheetNames.filter(
      (sheetName) => !ALLOWED_SHEETS.has(sheetName)
    );

    if (invalidSheets.length > 0) {
      return NextResponse.json(
        { error: 'Bu veri kaynağına erişim izni yok.' },
        {
          status: 403,
          headers: {
            'Cache-Control': 'no-store, max-age=0',
          },
        }
      );
    }

    // 4) PostgreSQL verisini getir.
    const { rows } = await pool.query(
      `
        SELECT id, sheet_name, row_number, data, updated_at
        FROM public.sheet_rows
        WHERE sheet_name = ANY($1::text[])
        ORDER BY sheet_name ASC, row_number ASC
      `,
      [sheetNames]
    );

    return NextResponse.json(
      {
        rows,
        count: rows.length,
      },
      {
        headers: {
          'Cache-Control': 'no-store, max-age=0',
          'Pragma': 'no-cache',
          'X-Content-Type-Options': 'nosniff',
        },
      }
    );
  } catch (error) {
    console.error('PostgreSQL sheet-rows API hatası:', error);

    return NextResponse.json(
      {
        error: 'PostgreSQL verisi okunamadı.',
      },
      {
        status: 500,
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      }
    );
  }
}
