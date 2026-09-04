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
  const result = await pool.query<SheetRow>(`
    SELECT
      sheet_name,
      row_number,
      data
    FROM public.sheet_rows
    ORDER BY
      sheet_name ASC,
      row_number ASC
  `);

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

      // Google Sheets ile Kurumsal Alım Sistemi!A2:F1000
      Devices: getRange(
        rows,
        "Google Sheets ile Kurumsal Alım Sistemi",
        2,
        1000,
        1,
        6
      ),

      // Ayarlar!A1:B25
      Ayarlar: getRange(
        rows,
        "Ayarlar",
        1,
        25,
        1,
        2
      ),

      // Alimlar!A2:H500
      Alimlar: getRange(
        rows,
        "Alimlar",
        2,
        500,
        1,
        8
      ),

      // Markalar!A2:B50
      Markalar: getRange(
        rows,
        "Markalar",
        2,
        50,
        1,
        2
      ),

      // CEP + TABLET+IOT SAAT LIST!A1:L1000
      CepTablet: getRange(
        rows,
        "CEP + TABLET+IOT SAAT LIST",
        1,
        1000,
        1,
        12
      ),

      // YNA LİST!A1:F1000
      YNA: getRange(
        rows,
        "YNA LİST",
        1,
        1000,
        1,
        6
      ),

      // DIŞ KANAL SATIN ALMA!A1:C1000
      DisKanal: getRange(
        rows,
        "DIŞ KANAL SATIN ALMA",
        1,
        1000,
        1,
        3
      ),

      // Servis_Fiyatlari!A2:G1000
      Servis: getRange(
        rows,
        "Servis_Fiyatlari",
        2,
        1000,
        1,
        7
      ),

      // 2.EL FİYAT LİSTESİ!A1:J1000
      IkinciEl: getRange(
        rows,
        "2.EL FİYAT LİSTESİ",
        1,
        1000,
        1,
        10
      ),

      // DEPO!A1:C1000
      Depo: getRange(
        rows,
        "DEPO",
        1,
        1000,
        1,
        3
      ),

      // HEDEFLER!A3:M100
      Hedefler: getRange(
        rows,
        "HEDEFLER",
        3,
        100,
        1,
        13
      ),

      // MagazaGidisat!A1:E100
      MagazaGidisat: getRange(
        rows,
        "MagazaGidisat",
        1,
        100,
        1,
        5
      ),

      // PersonelGidisat!A2:L100
      PersonelGidisat: getRange(
        rows,
        "PersonelGidisat",
        2,
        100,
        1,
        12
      ),

      // THH!A1:R1000
      THH: getRange(
        rows,
        "THH",
        1,
        1000,
        1,
        18
      ),

      // CihazTalep!A1:I1000
      CihazTalep: getRange(
        rows,
        "CihazTalep",
        1,
        1000,
        1,
        9
      ),

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
