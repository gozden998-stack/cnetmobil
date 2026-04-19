import { NextResponse } from 'next/server';

export async function GET() {
  // Gizli API anahtarlarımız (F12'den görünmez)
  const SHEET_ID = process.env.NEXT_PUBLIC_SHEET_ID || process.env.GOOGLE_SHEET_ID;
  const API_KEY = process.env.NEXT_PUBLIC_API_KEY || process.env.GOOGLE_API_KEY;

  if (!SHEET_ID || !API_KEY) {
    return NextResponse.json({ error: 'Sunucu yapılandırma hatası' }, { status: 500 });
  }

  const getSheetUrl = (sheetName: string, range: string) => {
    const safeRange = encodeURIComponent(`'${sheetName}'!${range}`);
    return `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${safeRange}?key=${API_KEY}`;
  };

  try {
    // SADECE Zumay'ın görmesine izin verdiğimiz 4 tabloyu çekiyoruz
    const [devRes, confRes, brandRes, dkRes] = await Promise.all([
      fetch(getSheetUrl('Google Sheets ile Kurumsal Alım Sistemi', 'A2:F1000'), { cache: 'no-store' }),
      fetch(getSheetUrl('Ayarlar', 'A1:B25'), { cache: 'no-store' }),
      fetch(getSheetUrl('Markalar', 'A2:B50'), { cache: 'no-store' }).catch(() => ({ json: () => ({}) })),
      fetch(getSheetUrl('DIŞ KANAL SATIN ALMA', 'A1:C1000'), { cache: 'no-store' }).catch(() => ({ json: () => ({}) }))
    ]);

    const data = {
      devices: await devRes.json(),
      config: await confRes.json(),
      brands: await brandRes.json(),
      disKanal: await dkRes.json(),
    };

    return NextResponse.json(data);
  } catch (error) {
    console.error("Zumay API Hatası:", error);
    return NextResponse.json({ error: 'Veri çekilemedi' }, { status: 500 });
  }
}

// Zumay'ın alım verilerini kaydetmesi için Güvenli POST metodu
export async function POST(req: Request) {
  const SCRIPT_URL = process.env.NEXT_PUBLIC_SCRIPT_URL || process.env.GOOGLE_SCRIPT_URL;
  try {
    const body = await req.json();
    
    // Tarayıcı değil, sunucu bizim yerimize Google Apps Script'e veriyi yollar
    await fetch(SCRIPT_URL as string, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body)
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Kaydedilemedi' }, { status: 500 });
  }
}
