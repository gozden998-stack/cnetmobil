import { NextResponse } from "next/server";
import { Pool } from "pg";

// Artık Supabase kullanılmıyor.
// Veri doğrudan kendi PostgreSQL sunucumuzdan okunuyor.
export const dynamic = "force-dynamic";
export const revalidate = 0;

type SheetRow = {
  sheet_name: string;
  row_number: number;
  data: any[];
};

// ======================================================
// POSTGRESQL BAĞLANTISI
// ======================================================

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// ======================================================
// SATIR / SÜTUN KESME
// Google Sheets range mantığını taklit eder.
// ======================================================

function getRange(
  rows: SheetRow[],
  sheetName: string,
  startRow: number,
  endRow: number,
  startColumn: number,
  endColumn: number
) {
  return rows
    .filter(
      (row) =>
        row.sheet_name === sheetName &&
        row.row_number >= startRow &&
        row.row_number <= endRow
    )
    .sort((a, b) => a.row_number - b.row_number)
    .map((row) => {
      const values = Array.isArray(row.data) ? row.data : [];

      return values.slice(
        startColumn - 1,
        endColumn
      );
    });
}

// ======================================================
// POSTGRESQL'DEN TÜM SHEET SATIRLARINI ÇEK
// ======================================================

async function getAllSheetRows(): Promise<SheetRow[]> {
  // Bu endpoint kimlik doğrulaması olmayan herkese açık cihaz-sat
  // sayfası tarafından çağrılıyor; sadece "CİHAZ SAT" verisi kullanılıyor.
  // Diğer iç sheet'leri (Alimlar, Hedefler, PersonelGidisat vb.) burada
  // sorgulamıyoruz ki dışarı hiç sızmasın.
  const result = await pool.query<SheetRow>(
    `
    SELECT
      sheet_name,
      row_number,
      data
    FROM public.sheet_rows
    WHERE sheet_name = $1
    ORDER BY
      row_number ASC
  `,
    ['CİHAZ SAT']
  );

  return result.rows;
}

// ======================================================
// API
// ======================================================

export async function GET() {
  try {
    if (!process.env.DATABASE_URL) {
      throw new Error(
        "DATABASE_URL environment variable bulunamadı."
      );
    }

    // ------------------------------------------
    // KENDİ POSTGRESQL SUNUCUMUZDAN VERİLERİ AL
    // ------------------------------------------

    const rows = await getAllSheetRows();

    // ------------------------------------------
    // ESKİ GOOGLE SHEETS API FORMATINI OLUŞTUR
    // FRONTEND YAPISI DEĞİŞMİYOR
    // ------------------------------------------

    const results: Record<string, any[][]> = {

      // CİHAZ SAT!A2:F1000
      CustomerDevices: getRange(
        rows,
        "CİHAZ SAT",
        2,
        1000,
        1,
        6
      ),

      // CİHAZ SAT!N2:O50
      CustomerConfig: getRange(
        rows,
        "CİHAZ SAT",
        2,
        50,
        14,
        15
      ),
    };

    // ------------------------------------------
    // FRONTEND'İ BOZMAMAK İÇİN
    // ESKİ BASE64 PAYLOAD FORMATINI KORUYORUZ
    // ------------------------------------------

    const rawString = JSON.stringify(results);

    const maskedPayload =
      Buffer.from(rawString).toString("base64");

    return NextResponse.json({
      payload: maskedPayload,
    });

  } catch (error) {
    console.error(
      "PostgreSQL verisi çekilirken hata:",
      error
    );

    return NextResponse.json(
      {
        error: "Veri çekilemedi",
      },
      {
        status: 500,
      }
    );
  }
}
