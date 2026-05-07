import { NextResponse } from 'next/server';

// 🚀 KOTA KORUMA KİLİDİ 1: 
// Bu satırlar Vercel'e "Ben sana yenile demeden bu sayfayı asla değiştirme" der.
export const dynamic = 'force-static';
export const revalidate = false;

export async function GET() {
  const SHEET_ID = process.env.SHEET_ID;
  const API_KEY = process.env.API_KEY;

  const tables = [
    { id: 'Devices', range: 'Google Sheets ile Kurumsal Alım Sistemi!A2:F1000' },
    { id: 'Ayarlar', range: 'Ayarlar!A1:B25' },
    { id: 'Alimlar', range: 'Alimlar!A2:H500' },
    { id: 'Markalar', range: 'Markalar!A2:B50' },
    { id: 'CepTablet', range: 'CEP + TABLET+IOT SAAT LIST!A1:L1000' },
    { id: 'YNA', range: 'YNA LİST!A1:F1000' },
    { id: 'DisKanal', range: 'DIŞ KANAL SATIN ALMA!A1:C1000' },
    { id: 'Servis', range: 'Servis_Fiyatlari!A2:G1000' },
    { id: 'IkinciEl', range: '2.EL FİYAT LİSTESİ!A1:D1000' },
    { id: 'Depo', range: 'DEPO!A1:B1000' },
    { id: 'MagazaGidisat', range: 'MagazaGidisat!A1:E100' },
    { id: 'PersonelGidisat', range: 'PersonelGidisat!A2:L100' },
    { id: 'CustomerDevices', range: 'Cihaz Sat!A2:F1000' },
    { id: 'CustomerConfig', range: 'Cihaz Sat!N2:O50' }
  ];

  try {
    const rangesQuery = tables.map(t => `ranges=${encodeURIComponent(t.range)}`).join('&');
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values:batchGet?${rangesQuery}&key=${API_KEY}`;

    // 🚀 KOTA KORUMA KİLİDİ 2: 
    // tags: ['sheets-data'] -> Butonla eşleşen anahtar.
    // cache: 'force-cache' -> Veriyi hafızaya çiviler.
    const res = await fetch(url, { 
      next: { tags: ['sheets-data'] },
      cache: 'force-cache' 
    });
    
    const data = await res.json();

    if (!data.valueRanges) throw new Error("Google'dan veri alınamadı.");

    const results: Record<string, any> = {}; 
    
    tables.forEach((table, index) => {
      results[table.id] = data.valueRanges[index].values || [];
    });

    const rawString = JSON.stringify(results);
    const maskedPayload = Buffer.from(rawString).toString('base64');

    // 🚀 KOTA KORUMA KİLİDİ 3: 
    // Cache-Control başlığı ekleyerek tarayıcının ve Vercel CDN'in veriyi dondurmasını sağlıyoruz.
    return NextResponse.json(
      { payload: maskedPayload },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=31536000, stale-while-revalidate=59',
        },
      }
    );

  } catch (error) {
    console.error("Hata:", error);
    return NextResponse.json({ error: "Veri çekilemedi" }, { status: 500 });
  }
}
