import { NextResponse } from 'next/server';

export async function GET() {
  // .env.local dosyasından gizli bilgileri okuyoruz
  const SHEET_ID = process.env.GOOGLE_SHEET_ID;
  const API_KEY = process.env.GOOGLE_API_KEY;

  if (!SHEET_ID || !API_KEY) {
    return NextResponse.json(
      { error: 'Sunucu yapılandırma hatası: API anahtarları eksik.' },
      { status: 500 }
    );
  }

  try {
    // Tarayıcının yaptığı tüm o işlemleri artık bizim güvenli sunucumuz (backend) yapıyor
    const [devRes, confRes, alimRes, brandRes, ctRes, ynaRes, dkRes, servisRes, ieRes, imeiRes] = await Promise.all([
      fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Google Sheets ile Kurumsal Alım Sistemi!A2:F1000?key=${API_KEY}`),
      fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Ayarlar!A1:B25?key=${API_KEY}`),
      fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Alimlar!A2:H500?key=${API_KEY}`),
      fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Markalar!A2:B50?key=${API_KEY}`).catch(() => ({ json: () => ({}) })),
      fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/CEP + TABLET+IOT SAAT LIST!A1:L1000?key=${API_KEY}`).catch(() => ({ json: () => ({}) })),
      fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/YNA LİST!A1:F1000?key=${API_KEY}`).catch(() => ({ json: () => ({}) })),
      fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/DIŞ KANAL SATIN ALMA!A1:C1000?key=${API_KEY}`).catch(() => ({ json: () => ({}) })),
      fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Servis_Fiyatlari!A2:G1000?key=${API_KEY}`).catch(() => ({ json: () => ({}) })),
      fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/2.EL FİYAT LİSTESİ!A1:D1000?key=${API_KEY}`).catch(() => ({ json: () => ({}) })),
      fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/DEPO!A1:B1000?key=${API_KEY}`).catch(() => ({ json: () => ({}) }))
    ]);

    // Sunucu bu verileri alır, toparlar ve tek bir paket haline getirir
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

    // Temizlenmiş paketi tarayıcıya (Front-end'e) gönderir
    return NextResponse.json(data);
  } catch (error) {
    console.error("API Veri Çekme Hatası:", error);
    return NextResponse.json({ error: 'Veri çekilemedi' }, { status: 500 });
  }
}
