import { NextResponse } from 'next/server';

export async function GET() {
  // Bu değişkenleri Vercel panelinden "NEXT_PUBLIC_" olmadan tanımlamalısın
  const SHEET_ID = process.env.SHEET_ID; 
  const API_KEY = process.env.API_KEY;
  const TABLO_ISMI = 'Google Sheets ile Kurumsal Alım Sistemi';

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(TABLO_ISMI)}!A2:F1000?key=${API_KEY}`;
  
  try {
    const res = await fetch(url, { 
      next: { revalidate: 45 } // Veriyi 45 saniyede bir tazeler (performans için)
    });
    const data = await res.json();

    // Sadece tablo verilerini gönderiyoruz
    return NextResponse.json(data.values || []);
  } catch (error) {
    console.error("Sheets API Hatası:", error);
    return NextResponse.json({ error: "Veri çekilemedi" }, { status: 500 });
  }
}
