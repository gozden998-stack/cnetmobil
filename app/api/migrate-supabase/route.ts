import { NextResponse } from "next/server";
import { Pool } from "pg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGE_SIZE = 1000;

export async function POST() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const databaseUrl = process.env.DATABASE_URL;

  if (!supabaseUrl || !supabaseServiceRoleKey || !databaseUrl) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY veya DATABASE_URL eksik.",
      },
      { status: 500 }
    );
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    max: 2,
  });

  let totalFetched = 0;
  let totalUpserted = 0;
  let from = 0;

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.sheet_rows (
        id BIGSERIAL PRIMARY KEY,
        sheet_name TEXT NOT NULL,
        row_number INTEGER NOT NULL,
        data JSONB NOT NULL DEFAULT '[]'::jsonb,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (sheet_name, row_number)
      );
    `);

    while (true) {
      const to = from + PAGE_SIZE - 1;

      const response = await fetch(
        `${supabaseUrl}/rest/v1/sheet_rows?select=sheet_name,row_number,data,updated_at&order=sheet_name.asc,row_number.asc`,
        {
          method: "GET",
          headers: {
            apikey: supabaseServiceRoleKey,
            Authorization: `Bearer ${supabaseServiceRoleKey}`,
            Range: `${from}-${to}`,
            Prefer: "count=exact",
          },
          cache: "no-store",
        }
      );

      if (!response.ok) {
        const text = await response.text();

        throw new Error(
          `Supabase okuma hatası: ${response.status} ${text}`
        );
      }

      const rows = await response.json();

      if (!Array.isArray(rows) || rows.length === 0) {
        break;
      }

      totalFetched += rows.length;

      const client = await pool.connect();

      try {
        await client.query("BEGIN");

        for (const row of rows) {
          await client.query(
            `
            INSERT INTO public.sheet_rows
              (sheet_name, row_number, data, updated_at)
            VALUES
              ($1, $2, $3::jsonb, $4)
            ON CONFLICT (sheet_name, row_number)
            DO UPDATE SET
              data = EXCLUDED.data,
              updated_at = EXCLUDED.updated_at
            `,
            [
              row.sheet_name,
              row.row_number,
              JSON.stringify(row.data ?? []),
              row.updated_at ?? new Date().toISOString(),
            ]
          );

          totalUpserted++;
        }

        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }

      if (rows.length < PAGE_SIZE) {
        break;
      }

      from += PAGE_SIZE;
    }

    const countResult = await pool.query(`
      SELECT COUNT(*)::int AS count
      FROM public.sheet_rows
    `);

    return NextResponse.json({
      ok: true,
      message: "Supabase verileri PostgreSQL'e kopyalandı.",
      fetched_from_supabase: totalFetched,
      upserted_to_postgresql: totalUpserted,
      postgresql_total_rows: countResult.rows[0]?.count ?? 0,
    });
  } catch (error) {
    console.error("Migration hatası:", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Bilinmeyen migration hatası",
      },
      { status: 500 }
    );
  } finally {
    await pool.end().catch(() => {});
  }
}
