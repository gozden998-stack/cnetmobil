import { NextResponse } from "next/server";
import { Pool } from "pg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 3,
});

export async function POST(request: Request) {
  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json(
        { ok: false, error: "DATABASE_URL bulunamadı." },
        { status: 500 }
      );
    }

    const body = await request.json().catch(() => ({}));

    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.test_write_log (
        id BIGSERIAL PRIMARY KEY,
        message TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const message =
      String(body?.message || "CNETMOBIL PostgreSQL yazma testi").trim();

    const result = await pool.query(
      `
      INSERT INTO public.test_write_log (message)
      VALUES ($1)
      RETURNING id, message, created_at
      `,
      [message]
    );

    return NextResponse.json({
      ok: true,
      message: "PostgreSQL yazma işlemi başarılı.",
      row: result.rows[0],
    });
  } catch (error) {
    console.error("PostgreSQL test write hatası:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "PostgreSQL yazma işlemi başarısız.",
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const result = await pool.query(`
      SELECT id, message, created_at
      FROM public.test_write_log
      ORDER BY id DESC
      LIMIT 10
    `);

    return NextResponse.json({
      ok: true,
      rows: result.rows,
    });
  } catch {
    return NextResponse.json({
      ok: true,
      rows: [],
    });
  }
}
