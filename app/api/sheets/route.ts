import { NextResponse } from 'next/server';

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
    { id: 'Depo', range: 'DEPO!A1:B1000' }
  ];

  try {
    const results: any = {};

    await Promise.all(tables.map(async (table) => {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(table.range)}?key=${API_KEY}`;
      const res = await fetch(url);
      const data = await res.json();
      results[table.id] = data.values || [];
    }));

    // --- MASKELEME İŞLEMİ BURADA BAŞLIYOR ---
    // Verileri metne çevirip Base64 formatında paketliyoruz
    const rawString = JSON.stringify(results);
    const maskedPayload = Buffer.from(rawString).toString('base64');

    // Dışarıya sadece 'payload' isminde anlamsız bir metin gönderiyoruz
    return NextResponse.json({ payload: maskedPayload });

  } catch (error) {
    console.error("Sheets verisi çekilirken hata:", error);
    return NextResponse.json({ error: "Veri çekilemedi" }, { status: 500 });
  }
}
