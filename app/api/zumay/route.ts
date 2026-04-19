import { NextResponse } from 'next/server'; // "İmport" hatası düzeltildi

export async function GET() {
  // Tam güvenlik için öncelikle NEXT_PUBLIC_ olmayan temiz değişkenleri ararız
  const SHEET_ID = process.env.GOOGLE_SHEET_ID || process.env.NEXT_PUBLIC_SHEET_ID;
  const API_KEY = process.env.GOOGLE_API_KEY || process.env.NEXT_PUBLIC_API_KEY;

  if (!SHEET_ID || !API_KEY) {
    console.error("❌ HATA: API Anahtarları .env.local dosyasından okunamadı!");
    return NextResponse.json({ error: 'Sunucu yapılandırma hatası' }, { status: 500 });
  }

  // URL Encode ile boşluk ve Türkçe karakter sorununu çözen fonksiyon
  const getSheetUrl = (sheetName: string, range: string) => {
    const safeRange = encodeURIComponent(`'${sheetName}'!${range}`);
    return `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${safeRange}?key=${API_KEY}`;
  };

  // Hangi sayfanın hata verdiğini bulmamızı sağlayan güvenli çekim fonksiyonu
  const safeFetch = async (sheetName: string, range: string) => {
    try {
      const res = await fetch(getSheetUrl(sheetName, range), { cache: 'no-store' });
      const json = await res.json();
      
      if (!res.ok) {
        console.error(`❌ HATA: '${sheetName}' sayfası çekilemedi! Detay:`, json.error?.message);
        return {}; 
      }
      return json;
    } catch (error) {
      console.error(`❌ SİSTEM HATASI: '${sheetName}' sayfasında bağlantı koptu:`, error);
      return {};
    }
  };

  try {
    // SADECE Zumay'ın görmesine izin verdiğimiz 4 tablo
    const [devices, config, brands, disKanal] = await Promise.all([
      safeFetch('Google Sheets ile Kurumsal Alım Sistemi', 'A1:F1000'),
      safeFetch('Ayarlar', 'A1:B25'),
      safeFetch('Markalar', 'A2:B50'),
      safeFetch('DIŞ KANAL SATIN ALMA', 'A1:C1000')
    ]);

    // Veriler temizlenmiş halde arayüze (Frontend'e) gönderiliyor
    return NextResponse.json({
      devices,
      config,
      brands,
      disKanal
    });
  } catch (error) {
    console.error("Zumay API Genel Hatası:", error);
    return NextResponse.json({ error: 'Veri çekilemedi' }, { status: 500 });
  }
}

// Zumay'ın alım verilerini kaydetmesi için Güvenli POST metodu
export async function POST(req: Request) {
  const SCRIPT_URL = process.env.GOOGLE_SCRIPT_URL || process.env.NEXT_PUBLIC_SCRIPT_URL;
  
  if (!SCRIPT_URL) {
    console.error("❌ HATA: SCRIPT_URL bulunamadı!");
    return NextResponse.json({ error: 'Script URL eksik' }, { status: 500 });
  }

  try {
    const body = await req.json();
    
    // Tarayıcı değil, sunucu (backend) bizim yerimize Google Apps Script'e veriyi yollar
    await fetch(SCRIPT_URL as string, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body)
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Zumay POST Hatası:", error);
    return NextResponse.json({ error: 'Kaydedilemedi' }, { status: 500 });
  }
}
