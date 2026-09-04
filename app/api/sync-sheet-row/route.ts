import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 3,
});

type SheetRowInput = {
  sheet_name: string;
  row_number: number;
  data: unknown[];
};

function validRow(row: any): row is SheetRowInput {
  return (
    row &&
    typeof row.sheet_name === "string" &&
    row.sheet_name.trim().length > 0 &&
    Number.isInteger(Number(row.row_number)) &&
    Number(row.row_number) >= 1 &&
    Array.isArray(row.data)
  );
}

export async function POST(req: NextRequest) {
  const client = await pool.connect();

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
    const action = String(body.action || "upsert_row").trim();

    if (action === "upsert_row") {
      const row = {
        sheet_name: String(body.sheet_name || "").trim(),
        row_number: Number(body.row_number),
        data: body.data,
      };

      if (!validRow(row)) {
        return NextResponse.json(
          { ok: false, error: "Geçersiz satır verisi." },
          { status: 400 }
        );
      }

      const result = await client.query(
        `
          INSERT INTO public.sheet_rows
            (sheet_name, row_number, data, updated_at)
          VALUES
            ($1, $2, $3::jsonb, NOW())
          ON CONFLICT (sheet_name, row_number)
          DO UPDATE SET
            data = EXCLUDED.data,
            updated_at = NOW()
          RETURNING id, sheet_name, row_number, data, updated_at
        `,
        [row.sheet_name, row.row_number, JSON.stringify(row.data)]
      );

      return NextResponse.json({
        ok: true,
        action,
        row: result.rows[0],
      });
    }

    if (action === "upsert_rows") {
      const rows = Array.isArray(body.rows) ? body.rows : [];
      if (rows.length < 1 || rows.length > 1000 || rows.some((r: any) => !validRow(r))) {
        return NextResponse.json(
          { ok: false, error: "Geçersiz rows verisi." },
          { status: 400 }
        );
      }

      await client.query("BEGIN");
      for (const row of rows) {
        await client.query(
          `
            INSERT INTO public.sheet_rows
              (sheet_name, row_number, data, updated_at)
            VALUES
              ($1, $2, $3::jsonb, NOW())
            ON CONFLICT (sheet_name, row_number)
            DO UPDATE SET
              data = EXCLUDED.data,
              updated_at = NOW()
          `,
          [String(row.sheet_name).trim(), Number(row.row_number), JSON.stringify(row.data)]
        );
      }
      await client.query("COMMIT");

      return NextResponse.json({ ok: true, action, count: rows.length });
    }

    if (action === "delete_row") {
      const sheetName = String(body.sheet_name || "").trim();
      const rowNumber = Number(body.row_number);
      if (!sheetName || !Number.isInteger(rowNumber) || rowNumber < 1) {
        return NextResponse.json(
          { ok: false, error: "Geçersiz silme parametresi." },
          { status: 400 }
        );
      }

      const result = await client.query(
        `DELETE FROM public.sheet_rows WHERE sheet_name = $1 AND row_number = $2`,
        [sheetName, rowNumber]
      );

      return NextResponse.json({ ok: true, action, deleted: result.rowCount || 0 });
    }

    if (action === "delete_rows_gt") {
      const sheetName = String(body.sheet_name || "").trim();
      const rowNumber = Number(body.row_number);
      if (!sheetName || !Number.isInteger(rowNumber) || rowNumber < 0) {
        return NextResponse.json(
          { ok: false, error: "Geçersiz temizleme parametresi." },
          { status: 400 }
        );
      }

      const result = await client.query(
        `DELETE FROM public.sheet_rows WHERE sheet_name = $1 AND row_number > $2`,
        [sheetName, rowNumber]
      );

      return NextResponse.json({ ok: true, action, deleted: result.rowCount || 0 });
    }

    if (action === "replace_sheet") {
      const sheetName = String(body.sheet_name || "").trim();
      const rows = Array.isArray(body.rows) ? body.rows : null;

      if (!sheetName || rows === null || rows.length > 5000 || rows.some((r: any) => !Array.isArray(r))) {
        return NextResponse.json(
          { ok: false, error: "Geçersiz replace_sheet verisi." },
          { status: 400 }
        );
      }

      await client.query("BEGIN");
      await client.query(`DELETE FROM public.sheet_rows WHERE sheet_name = $1`, [sheetName]);

      for (let i = 0; i < rows.length; i++) {
        await client.query(
          `
            INSERT INTO public.sheet_rows
              (sheet_name, row_number, data, updated_at)
            VALUES
              ($1, $2, $3::jsonb, NOW())
          `,
          [sheetName, i + 1, JSON.stringify(rows[i])]
        );
      }

      await client.query("COMMIT");
      return NextResponse.json({ ok: true, action, count: rows.length });
    }

    return NextResponse.json(
      { ok: false, error: "Bilinmeyen action." },
      { status: 400 }
    );
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {}

    console.error("SYNC SHEET ROW ERROR:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Bilinmeyen sunucu hatası.",
      },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
