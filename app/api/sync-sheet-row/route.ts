import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 3,
});

export async function POST(req: NextRequest) {
  try {
    const expectedSecret = process.env.SYNC_SECRET;

    if (!expectedSecret) {
      return NextResponse.json(
        { ok: false, error: "Sunucuda SYNC_SECRET tanımlı değil." },
        { status: 500 }
      );
    }

    const receivedSecret = req.headers.get("x-sync-secret");

    if (receivedSecret !== expectedSecret) {
      return NextResponse.json(
        { ok: false, error: "Yetkisiz istek." },
        { status: 401 }
      );
    }

    const body = await req.json();

    const sheetName = String(body.sheet_name || "").trim();
    const rowNumber = Number(body.row_number);
    const data = body.data;

    if (!sheetName) {
      return NextResponse.json(
        { ok: false, error: "sheet_name zorunludur." },
        { status: 400 }
      );
    }

    if (!Number.isInteger(rowNumber) || rowNumber < 1) {
      return NextResponse.json(
        { ok: false, error: "Geçersiz row_number." },
        { status: 400 }
      );
    }

    if (!Array.isArray(data)) {
      return NextResponse.json(
        { ok: false, error: "data bir dizi olmalıdır." },
        { status: 400 }
      );
    }

    const result = await pool.query(
      `
        INSERT INTO public.sheet_rows
          (sheet_name, row_number, data, updated_at)
        VALUES
          ($1, $2, $3::jsonb, NOW())

        ON CONFLICT (sheet_name, row_number)
        DO UPDATE SET
          data = EXCLUDED.data,
          updated_at = NOW()

        RETURNING
          id,
          sheet_name,
          row_number,
          data,
          updated_at
      `,
      [sheetName, rowNumber, JSON.stringify(data)]
    );

    return NextResponse.json({
      ok: true,
      message: "Satır PostgreSQL'e senkronlandı.",
      row: result.rows[0],
    });
  } catch (error) {
    console.error("SYNC SHEET ROW ERROR:", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Bilinmeyen sunucu hatası.",
      },
      { status: 500 }
    );
  }
}
