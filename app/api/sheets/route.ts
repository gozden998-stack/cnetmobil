import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const SHEET_ID = process.env.SHEET_ID;
  const API_KEY = process.env.API_KEY;

  // Çevresel değişken kontrolü (Hata almamak için önemli)
  if (!SHEET_ID || !API_KEY) {
    return NextResponse.json({ error: "Eksik yapılandırma: API_KEY veya SHEET_ID bulunamadı." }, { status: 500 });
  }

  const tables = [
    // Sayfa isimlerinde boşluk veya özel karakter varsa 'Sayfa İsmi'!Range formatı en güvenlisidir.
    { id: 'Devices', range: "'Google Sheets ile Kurumsal Alım Sistemi'!A2:F1000" },
    { id: 'Ayarlar', range: "Ayarlar!A1:B25" },
    { id: 'Alimlar', range: "Alimlar!A2:H500" },
    { id: 'Markalar', range: "Markalar!A2:B50" },
    { id: 'CepTablet', range: "'CEP + TABLET+IOT SAAT LIST'!A1:L1000" },
    { id: 'YNA', range: "'YNA LİST'!A1:F1000" },
    { id: 'DisKanal', range: "'DIŞ KANAL SATIN ALMA'!A1:C1000" },
    { id: 'Servis', range: "Servis_Fiyatlari!A2:G1000" },
    { id: 'IkinciEl', range: "'2.EL FİYAT LİSTESİ'!A1:D1000" },
    { id: 'Depo', range: "DEPO!A1:B1000" },
    { id: 'MagazaGidisat', range: "MagazaGidisat!A1:E100" },
    { id: 'PersonelGidisat', range: "PersonelGidisat!A2:L100" },
    { id: 'CustomerDevices', range: "'Cihaz Sat'!A2:F1000" },
    { id: 'CustomerConfig', range: "'Cihaz Sat'!N2:O50" }
  ];

  try {
    const rangesQuery = tables.map(t => `ranges=${encodeURIComponent(t.range)}`).join('&');
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values:batchGet?${rangesQuery}&key=${API_KEY}`;

    const res = await fetch(url, { cache: 'no-store' });
    const data = await res.json();

    if (!data.valueRanges) {
      console.error("Google API Hatası:", data);
      throw new Error("Google'dan veri alınamadı.");
    }

    const results: Record<string, any[]> = {};
    
    tables.forEach((table, index) => {
      // Değer yoksa boş dizi ata
      results[table.id] = data.valueRanges[index]?.values || [];
    });

    // Maskeleme işlemi
    const rawString = JSON.stringify(results);
    const maskedPayload = Buffer.from(rawString).toString('base64');

    return NextResponse.json({ payload: maskedPayload });

  } catch (error: any) {
    console.error("Sheets verisi çekilirken hata:", error.message);
    return NextResponse.json({ error: "Veri çekilemedi", detail: error.message }, { status: 500 });
  }
}
