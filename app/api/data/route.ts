import { NextResponse } from 'next/server';

export async function GET() {
  const SHEET_ID = process.env.GOOGLE_SHEET_ID;
  const API_KEY = process.env.GOOGLE_API_KEY;

  if (!SHEET_ID || !API_KEY) {
    return NextResponse.json({ error: 'API anahtarları eksik.' }, { status: 500 });
  }

  const getSheetUrl = (sheetName: string, range: string) => {
    const safeRange = encodeURIComponent(`'${sheetName}'!${range}`);
    return `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${safeRange}?key=${API_KEY}`;
  };

  // Özel fetch fonksiyonu: Hangi sayfanın patladığını bize söyleyecek
  const safeFetch = async (sheetName: string, range: string) => {
    try {
      const res = await fetch(getSheetUrl(sheetName, range), { cache: 'no-store' });
      const json = await res.json();
      
      // Eğer Google API bir hata döndürdüyse (örn: 400 Bad Request)
      if (!res.ok) {
        console.error(`❌ HATA: '${sheetName}' sayfası çekilemedi! Detay:`, json.error?.message);
        return {}; 
      }
      return json;
    } catch (error) {
      console.error(`❌ SİSTEM HATASI: '${sheetName}' sayfasında bir şeyler ters gitti:`, error);
      return {};
    }
  };

  try {
    // Artık sayfaları güvenli fonksiyonumuzla çekiyoruz
    const [devices, config, alimlar, brands, cepTablet, yna, disKanal, servis, ikinciEl, imei] = await Promise.all([
      safeFetch('Google Sheets ile Kurumsal Alım Sistemi', 'A2:F1000'),
      safeFetch('Ayarlar', 'A1:B25'),
      safeFetch('Alimlar', 'A2:H500'),
      safeFetch('Markalar', 'A2:B50'),
      safeFetch('CEP + TABLET+IOT SAAT LIST', 'A1:L1000'),
      safeFetch('YNA LİST', 'A1:F1000'),
      safeFetch('DIŞ KANAL SATIN ALMA', 'A1:C1000'),
      safeFetch('Servis_Fiyatlari', 'A2:G1000'),
      safeFetch('2.EL FİYAT LİSTESİ', 'A1:D1000'),
      safeFetch('DEPO', 'A1:B1000')
    ]);

    return NextResponse.json({
      devices, config, alimlar, brands, cepTablet, yna, disKanal, servis, ikinciEl, imei
    });

  } catch (error) {
    console.error("Genel API Hatası:", error);
    return NextResponse.json({ error: 'Sunucu hatası oluştu' }, { status: 500 });
  }
}
