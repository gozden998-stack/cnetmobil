import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Opsiyonel: Veriyi 30 saniyede bir tazelemek istersen:
// export const revalidate = 30; 

export async function GET() {
  const SHEET_ID = process.env.SHEET_ID;
  const API_KEY = process.env.API_KEY;

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
    { id: 'PersonelGidisat', range: "PersonelGidisat!A2:L100" },
    { id: 'CustomerDevices', range: "'Cihaz Sat'!A2:F1000" },
    { id: 'CustomerConfig', range: "'Cihaz Sat'!N2:O50" }
  ];

  try {
    const rangesQuery = tables.map(t => `ranges=${encodeURIComponent(t.range)}`).join('&');
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values:batchGet?${rangesQuery}&key=${API_KEY}`;

    // 'no-store' yerine kısa süreli cache veya default davranış tercih edilebilir
    const res = await fetch(url, { 
      next: { revalidate: 10 } // Veriyi 10 saniyede bir günceller, trafiği azaltır.
    });
    
    const data = await res.json();

    if (!data.valueRanges) throw new Error("Google API Hatası");

    const results: Record<string, any[]> = {};
    tables.forEach((table, index) => {
      results[table.id] = data.valueRanges[index]?.values || [];
    });

    // Maskeleme (Base64) kaldırıldı, doğrudan JSON dönüyoruz.
    // Bu, veri boyutunu %30-40 oranında küçültecektir.
    return NextResponse.json(results);

  } catch (error: any) {
    return NextResponse.json({ error: "Veri çekilemedi" }, { status: 500 });
  }
}
