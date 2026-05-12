import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const SHEET_ID = process.env.SHEET_ID;
  const API_KEY = process.env.API_KEY;

  const tables = [
    // --- MEVCUT B2B TABLOLARI ---
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

    // --- YENİ EKLENEN MAĞAZA GİDİŞAT TABLOSU (SORUN BURADAYDI) ---
    { id: 'MagazaGidisat', range: 'MagazaGidisat!A1:E100' },
    { id: 'PersonelGidisat', range: 'PersonelGidisat!A2:L100' },
    // --- YENİ EKLENEN MÜŞTERİ (TRADE-IN) TABLOLARI ---
    { id: 'CustomerDevices', range: 'Cihaz Sat!A2:F1000' },
    { id: 'CustomerConfig', range: 'Cihaz Sat!N2:O50' }
  ];

  try {
    const rangesQuery = tables.map(t => `ranges=${encodeURIComponent(t.range)}`).join('&');
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values:batchGet?${rangesQuery}&key=${API_KEY}`;

    const res = await fetch(url, { cache: 'no-store' });
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

    return NextResponse.json({ payload: maskedPayload });

  } catch (error) {
    console.error("Sheets verisi çekilirken hata:", error);
    return NextResponse.json({ error: "Veri çekilemedi" }, { status: 500 });
  }
}
