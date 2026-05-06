import { NextResponse } from 'next/server';

// 1. Edge Runtime: API'yi hızlandırır ve Serverless kotasını (GB-Saat) harcamaz.
export const runtime = 'edge';

// 2. Revalidate: Vercel'e bu API yanıtını 180 saniye (3 dk) boyunca önbellekte tutmasını söyler.
// 'force-dynamic' satırı kaldırıldı çünkü o her F5'te Sheets'e gitmeye zorluyordu.
export const revalidate = 180;

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

    // Google Sheets'e giderken Vercel'in bu ara isteği de 3 dk saklamasını sağlıyoruz.
    const res = await fetch(url, { 
      next: { revalidate: 180 } 
    });
    
    const data = await res.json();

    if (!data.valueRanges) {
      throw new Error("Google'dan veri alınamadı.");
    }

    const results: any = {};
    tables.forEach((table, index) => {
      results[table.id] = data.valueRanges[index].values || [];
    });

    const rawString = JSON.stringify(results);
    const maskedPayload = Buffer.from(rawString).toString('base64');

    // 3. Yanıtı Cache-Control başlıklarıyla döndürüyoruz.
    // Bu sayede F5 yapılsa bile 180 saniye dolmadan Sheets'e asla gidilmez.
    return NextResponse.json(
      { payload: maskedPayload },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=180, stale-while-revalidate=60',
        },
      }
    );

  } catch (error) {
    console.error("Sheets verisi çekilirken hata:", error);
    return NextResponse.json({ error: "Veri çekilemedi" }, { status: 500 });
  }
}
