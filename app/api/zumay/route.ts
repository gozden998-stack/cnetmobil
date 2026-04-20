import { NextResponse } from 'next/server';

export async function GET() {
  const SHEET_ID = process.env.GOOGLE_SHEET_ID || process.env.NEXT_PUBLIC_SHEET_ID;
  const API_KEY = process.env.GOOGLE_API_KEY || process.env.NEXT_PUBLIC_API_KEY;

  if (!SHEET_ID || !API_KEY) {
    return NextResponse.json({ error: 'API anahtarları eksik' }, { status: 500 });
  }

  const getSheetUrl = (sheetName: string, range: string) => {
    // Sayfa ismini tırnak içine alarak boşluk ve özel karakter sorunlarını önlüyoruz
    const safeRange = encodeURIComponent(`'${sheetName}'!${range}`);
    return `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${safeRange}?key=${API_KEY}`;
  };

  const safeFetch = async (sheetName: string, range: string) => {
    try {
      const res = await fetch(getSheetUrl(sheetName, range), { 
        cache: 'no-store',
        next: { revalidate: 0 } // Next.js önbelleğini devre dışı bırakıyoruz
      });
      const json = await res.json();
      
      if (!res.ok) {
        console.error(`❌ ${sheetName} hatası:`, json.error?.message);
        return { values: [] }; // Hata durumunda boş dizi dönüyoruz ki frontend çökmesin
      }
      return json;
    } catch (error) {
      console.error(`❌ ${sheetName} sistem hatası:`, error);
      return { values: [] };
    }
  };

  try {
    // Verileri paralel olarak çekiyoruz
    const [devices, config, brands, disKanal] = await Promise.all([
      // Cihaz Alım (Buyback) verilerini A2'den başlatarak başlık satırını atlıyoruz
      safeFetch('Google Sheets ile Kurumsal Alım Sistemi', 'A2:F1000'),
      // Ayarlar tablosu (oranlar için)
      safeFetch('Ayarlar', 'A1:B25'),
      // Marka logoları
      safeFetch('Markalar', 'A2:B50'),
      // Dış kanal fiyatları
      safeFetch('DIŞ KANAL SATIN ALMA', 'A1:C1000')
    ]);

    // Frontend'in (ZumayPortal) beklediği temizlenmiş veri yapısını döndürüyoruz
    return NextResponse.json({
      devices,   // values: [[Brand, Name, Cap, Base, Img, MinPrice], ...]
      config,    // values: [[Key, Value], ...]
      brands,    // values: [[Name, Logo], ...]
      disKanal   // values: [[Item, Price, Status], ...]
    });
  } catch (error) {
    return NextResponse.json({ error: 'Veri işleme hatası' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const SCRIPT_URL = process.env.GOOGLE_SCRIPT_URL || process.env.NEXT_PUBLIC_SCRIPT_URL;
  
  if (!SCRIPT_URL) {
    return NextResponse.json({ error: 'Script URL eksik' }, { status: 500 });
  }

  try {
    const body = await req.json();
    
    // Veriyi Google Apps Script'e güvenli bir şekilde backend üzerinden iletiyoruz
    const response = await fetch(SCRIPT_URL as string, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body)
    });

    if (!response.ok) throw new Error("Google Script hatası");
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST Hatası:", error);
    return NextResponse.json({ error: 'İşlem kaydedilemedi' }, { status: 500 });
  }
}
