import { NextResponse } from 'next/server';

// DİKKAT: 'force-dynamic' kaldırıldı, veri artık cache'lenecek.
export const revalidate = false; 

export async function GET() {
  const SHEET_ID = process.env.SHEET_ID;
  const API_KEY = process.env.API_KEY;

  if (!SHEET_ID || !API_KEY) {
    return NextResponse.json({ error: "Yapılandırma eksik" }, { status: 500 });
  }

  const tables = [
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
    { id: 'PersonelGidisat', range: "PersonelGidisat!A2:L100" }
  ];

  try {
    const rangesQuery = tables.map(t => `ranges=${encodeURIComponent(t.range)}`).join('&');
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values:batchGet?${rangesQuery}&key=${API_KEY}`;

    // 'next: { tags: [...] }' ekleyerek bu veriyi etiketliyoruz. 
    // Böylece butona basınca sadece bu veriyi temizleyebileceğiz.
    const res = await fetch(url, { 
      next: { tags: ['sheets-data'] } 
    });
    
    const data = await res.json();

    if (!data.valueRanges) throw new Error("Google Veri Hatası");

    const results: Record<string, any[]> = {};
    tables.forEach((table, index) => {
      results[table.id] = data.valueRanges[index]?.values || [];
    });

    const maskedPayload = Buffer.from(JSON.stringify(results)).toString('base64');
    return NextResponse.json({ payload: maskedPayload });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
