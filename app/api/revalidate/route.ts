import { revalidatePath, revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tag = searchParams.get('tag');

  // Yalnızca Yönetici "FİYATLARI YENİLE" butonuna bastığında bu blok çalışır
  if (tag) {
    try {
      // 1. Google Sheets verisini önbellekten (cache) temizle
      revalidateTag('sheets-data');
      
      // 2. Ana sayfayı temizle
      revalidatePath('/', 'layout');
      
      // 3. 🚀 BÜTÜN MAĞAZALARI AYNI ANDA TETİKLEYEN SİNYAL:
      // Global versiyon hafızasını temizliyoruz. Vercel tüm ekranlara anında yeni saati fırlatıyor!
      revalidatePath('/api/version');
      
      return NextResponse.json({ 
        success: true,
        now: Date.now(),
        message: 'Önbellek başarıyla temizlendi ve tüm mağazalara sinyal gönderildi.'
      });
    } catch (err) {
      return NextResponse.json({ message: 'Yenileme hatası', success: false }, { status: 500 });
    }
  }

  return NextResponse.json({ message: 'Geçersiz istek (Tag bulunamadı)' }, { status: 400 });
}
