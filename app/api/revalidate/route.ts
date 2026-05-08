import { revalidateTag } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';

// Sunucu bazlı değişken (Vercel'de geçici hafızada durur)
let lastUpdate: number = Date.now(); 

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tag = searchParams.get('tag');
  const check = searchParams.get('check');

  // Personel ekranı "Güncelleme var mı?" diye soruyorsa:
  if (check) {
    return NextResponse.json({ version: lastUpdate });
  }

  // Sen butona bastığında veya Sheets güncellendiğinde:
  if (tag === 'sheets-data') {
    lastUpdate = Date.now(); 
    
    // YENİ: Next.js 16+ sürümlerinde ikinci parametre (profile) zorunludur.
    // 'max' profili, veriyi arka planda en güncel haliyle yenilemek için idealdir.
    revalidateTag('sheets-data', 'max'); 
    
    return NextResponse.json({ 
      success: true, 
      version: lastUpdate 
    });
  }

  return NextResponse.json({ success: false });
}
