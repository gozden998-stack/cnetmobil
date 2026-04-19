import { NextResponse } from 'next/server';

export async function GET() {
  const SHEET_ID = process.env.SHEET_ID;
  const API_KEY = process.env.API_KEY;

  // Çekilecek tüm tabloların listesi
  const tablolar = [
    'Google Sheets ile Kurumsal Alım Sistemi',
    'CEP + TABLET+IOT SAAT LIST',
    'YNA LİST',
    'DIŞ KANAL SATIN ALMA',
    '2.EL FİYAT LİSTESİ',
    'DEPO',
    'Ayarlar',
    'Markalar',
    'Alimlar',
    'Servis_Fiyatlari'
  ];

  try {
    // Tüm tabloları aynı anda, güvenli şekilde çekiyoruz
    const responses = await Promise.all(
      tablolar.map(tablo => 
        fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(tablo)}?key=${API_KEY}`)
        .then(res => res.json())
      )
    );

    // Verileri isimlerine göre paketleyip frontend'e yolluyoruz
    const data: any = {};
    tablolar.forEach((isim, index) => {
      data[isim] = responses[index].values || [];
    });

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: "Veri çekilemedi" }, { status: 500 });
  }
}
