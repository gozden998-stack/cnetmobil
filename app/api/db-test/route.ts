import { NextResponse } from "next/server";
import { Pool } from "pg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  let pool: Pool | null = null;

  try {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      return NextResponse.json(
        { ok: false, error: "DATABASE_URL tanımlı değil" },
        { status: 500 }
      );
    }

    pool = new Pool({
      connectionString,
      max: 1,
    });

    const result = await pool.query(`
      SELECT
        NOW() AS server_time,
        current_database() AS database_name,
        current_user AS database_user
    `);

    return NextResponse.json({
      ok: true,
      message: "PostgreSQL bağlantısı başarılı",
      database: result.rows[0],
    });
  } catch (error) {
    console.error("PostgreSQL bağlantı testi başarısız:", error);

    return NextResponse.json(
      { ok: false, error: "PostgreSQL bağlantısı başarısız" },
      { status: 500 }
    );
  } finally {
    if (pool) await pool.end().catch(() => {});
  }
}
