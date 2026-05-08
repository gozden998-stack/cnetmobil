import { revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';

// Sunucu çalıştığı sürece son güncelleme zamanını tutar
let lastUpdate = Date.now(); 

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const tag = searchParams.get('tag');
  const check = searchParams.get('check');

  // Personel ekranı "Güncelleme var mı?" diye soruyorsa:
  if (check) {
    return NextResponse.json({ version: lastUpdate });
  }

  // Google Sheets verisi güncellendiğinde veya butona basıldığında:
  if (tag === 'sheets-data') {
    lastUpdate = Date.now(); // Zaman damgasını güncelle
    revalidateTag('sheets-data'); // Vercel önbelleğini temizle
    
    return NextResponse.json({ 
      success: true, 
      version: lastUpdate,
      message: "Veriler başarıyla yenilendi" 
    });
  }

  return NextResponse.json({ 
    success: false, 
    message: "Hatalı parametre veya eksik tag" 
  });
}
