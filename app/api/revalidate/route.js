import { revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';

// Dikkat: Bu değişken sunucu her yeniden başladığında sıfırlanır (Vercel'de kalıcı olmaz)
let lastUpdate = Date.now(); 

export async function GET(request) { // ": Request" kısmını sildik
  const { searchParams } = new URL(request.url);
  const tag = searchParams.get('tag');
  const check = searchParams.get('check');

  // Personel ekranı "Güncelleme var mı?" diye soruyorsa:
  if (check) {
    return NextResponse.json({ version: lastUpdate });
  }

  // Sen butona bastığında:
  if (tag === 'sheets-data') {
    lastUpdate = Date.now(); // Sinyali güncelle
    revalidateTag(tag); // Vercel önbelleğini temizle
    return NextResponse.json({ success: true, version: lastUpdate });
  }

  return NextResponse.json({ success: false });
}
