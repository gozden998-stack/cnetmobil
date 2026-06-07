import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { google } from 'googleapis';

export async function GET() {
  const tablolar = [
    { id: 'ceptablet', range: 'CEP + TABLET+IOT SAAT LIST!A1:L1000' },
    { id: 'yna', range: 'YNA LİST!A1:F1000' },
    { id: 'diskanal', range: 'DIŞ KANAL SATIN ALMA!A1:C1000' },
    { id: 'servis', range: 'Servis_Fiyatlari!A2:G1000' },
    { id: 'ikinciel', range: '2.EL FİYAT LİSTESİ!A1:D1000' },
    { id: 'depo', range: 'DEPO!A1:C1000' },
    { id: 'hedefler', range: 'Hedefler!A3:M100' },
    { id: 'magazagidisat', range: 'MagazaGidisat!A1:E100' },
    { id: 'personelgidisat', range: 'PersonelGidisat!A2:L100' }
  ];

  try {
    // Google Sheets bağlantısı (Kendi kimlik bilgilerini buraya tanımlayacağız)
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON as string),
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    const sheets = google.sheets({ version: 'v4', auth });

    for (const tablo of tablolar) {
      const response = await sheets.spreadsheets.values.get({ 
        spreadsheetId: process.env.SHEET_ID, 
        range: tablo.range 
      });

      // Veritabanına o anki tüm veriyi JSON formatında kaydet
      await sql`INSERT INTO ${sql.identifier(['arsiv_' + tablo.id])} (veri) VALUES (${JSON.stringify(response.data.values)})`;
    }

    return NextResponse.json({ message: "Arşivleme başarıyla tamamlandı!" });
  } catch (error) {
    console.error("Arşivleme hatası:", error);
    return NextResponse.json({ error: "Arşivleme başarısız." }, { status: 500 });
  }
}
