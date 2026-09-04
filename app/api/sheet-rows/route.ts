import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

declare global {
  // eslint-disable-next-line no-var
  var cnetPgPool: Pool | undefined;
}

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

export async function GET(request: NextRequest) {
  try {
    const repeated = request.nextUrl.searchParams.getAll('sheet');
    const commaSeparated = request.nextUrl.searchParams.get('sheets');

    const sheetNames = Array.from(
      new Set(
        [
          ...repeated,
          ...(commaSeparated ? commaSeparated.split(',') : []),
        ]
          .map((v) => v.trim())
          .filter(Boolean)
      )
    );

    if (!sheetNames.length) {
      return NextResponse.json(
        { error: 'En az bir sheet parametresi gerekli.' },
        { status: 400 }
      );
    }

    if (sheetNames.length > 10) {
      return NextResponse.json(
        { error: 'Tek istekte en fazla 10 sheet istenebilir.' },
        { status: 400 }
      );
    }

    const pool = getPool();

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
      { rows, count: rows.length },
      {
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      }
    );
  } catch (error) {
    console.error('PostgreSQL sheet-rows API hatası:', error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'PostgreSQL verisi okunamadı.',
      },
      { status: 500 }
    );
  }
}
