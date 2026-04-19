import { NextResponse } from 'next/server';

export async function GET() {
  const SHEET_ID = process.env.GOOGLE_SHEET_ID;
  const API_KEY = process.env.GOOGLE_API_KEY;

  if (!SHEET_ID || !API_KEY) {
    return NextResponse.json(
      { error: 'Sunucu yapılandırma hatası: API anahtarları eksik.' },
      { status: 500 }
    );
  }

  // TypeScript için parametre türleri eklendi
  const getSheetUrl = (sheetName: string, range: string) => {
    const safeRange = encodeURIComponent(`'${sheetName}'!${range}`);
    return `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${safeRange}?key=${API_KEY}`;
  };

  try {
   const [devRes, confRes, alimRes, brandRes, ctRes, ynaRes, dkRes, servisRes, ieRes, imeiRes] = await Promise.all([
      fetch(getSheetUrl('Google Sheets ile Kurumsal Alım Sistemi', 'A2:F1000'), { cache: 'no-store' }),
      fetch(getSheetUrl('Ayarlar', 'A1:B25'), { cache: 'no-store' }),
      fetch(getSheetUrl('Alimlar', 'A2:H500'), { cache: 'no-store' }),
      fetch(getSheetUrl('Markalar', 'A2:B50'), { cache: 'no-store' }).catch(() => ({ json: () => ({}) })),
      fetch(getSheetUrl('CEP + TABLET+IOT SAAT LIST', 'A1:L1000'), { cache: 'no-store' }).catch(() => ({ json: () => ({}) })),
      fetch(getSheetUrl('YNA LİST', 'A1:F1000'), { cache: 'no-store' }).catch(() => ({ json: () => ({}) })),
      fetch(getSheetUrl('DIŞ KANAL SATIN ALMA', 'A1:C1000'), { cache: 'no-store' }).catch(() => ({ json: () => ({}) })),
      fetch(getSheetUrl('Servis_Fiyatlari', 'A2:G1000'), { cache: 'no-store' }).catch(() => ({ json: () => ({}) })),
      fetch(getSheetUrl('2.EL FİYAT LİSTESİ', 'A1:D1000'), { cache: 'no-store' }).catch(() => ({ json: () => ({}) })),
      fetch(getSheetUrl('DEPO', 'A1:B1000'), { cache: 'no-store' }).catch(() => ({ json: () => ({}) }))
    ]);

    const data = {
      devices: await devRes.json(),
      config: await confRes.json(),
      alimlar: await alimRes.json(),
      brands: await brandRes.json(),
      cepTablet: await ctRes.json(),
      yna: await ynaRes.json(),
      disKanal: await dkRes.json(),
      servis: await servisRes.json(),
      ikinciEl: await ieRes.json(),
      imei: await imeiRes.json(),
    };

    return NextResponse.json(data);
  } catch (error) {
   // data objesini oluşturduktan hemen sonra:
if (!data.devices.values) {
  console.error("DİKKAT: Cihaz listesi boş geldi! Google Yanıtı:", data.devices);
} else {
  console.log(`${data.devices.values.length} adet cihaz verisi başarıyla çekildi.`);
}
  }
}
