import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';

// Global hafıza: sheets-data etiketiyle önbelleğe alıyoruz
const getGlobalVersion = unstable_cache(
  async () => Date.now(),
  ['version-cache-key'],
  { tags: ['sheets-data'] } 
);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const check = searchParams.get('check');
  const tag = searchParams.get('tag');

  // 1. DURUM: Şubeler güncelleme var mı diye soruyor
  if (check === '1') {
    const version = await getGlobalVersion();
    return NextResponse.json({ version });
  }

  // 2. DURUM: Yönetici Fiyatları Yenile dediğinde
  if (tag === 'sheets-data') {
    try {
      // HATA VEREN revalidateTag YERİNE revalidatePath KULLANIYORUZ
      // '/' dizinini 'layout' tipiyle yenilemek, tüm etiketli (unstable_cache) hafızayı da temizler.
      revalidatePath('/', 'layout');
      
      return NextResponse.json({ 
        revalidated: true, 
        success: true,
        now: Date.now(),
        message: 'Tüm şubeler 30 saniye içinde güncellenecek.'
      });
    } catch (err) {
      return NextResponse.json({ message: 'Yenileme hatası', success: false }, { status: 500 });
    }
  }

  return NextResponse.json({ message: 'Geçersiz istek' }, { status: 400 });
}
