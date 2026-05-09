import { revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';

// Sistem her çalıştığında bir versiyon numarası oluşturur. 
// Yönetici fiyatları yenilediğinde bu numara değişecek ve tüm ekranlar bunu fark edecek.
let globalVersion = Date.now();

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const check = searchParams.get('check');
  const tag = searchParams.get('tag');

  // 1. DURUM: Personel ekranları "Güncelleme var mı?" diye sorduğunda çalışır
  if (check === '1') {
    return NextResponse.json({ version: globalVersion });
  }

  // 2. DURUM: Yönetici "FİYATLARI YENİLE" butonuna bastığında çalışır
  if (tag) {
    try {
      // Vercel'in önbelleğini (cache) temizle
      revalidateTag(tag);
      
      // Yeni bir versiyon numarası belirle (Ekranlara güncelleme uyarısı gitmesi için)
      globalVersion = Date.now(); 
      
      return NextResponse.json({ 
        revalidated: true, 
        now: Date.now(), 
        success: true,
        message: 'Önbellek temizlendi ve yeni versiyon yayınlandı.'
      });
    } catch (err) {
      return NextResponse.json({ message: 'Yenileme hatası', success: false }, { status: 500 });
    }
  }

  return NextResponse.json({ message: 'Geçersiz istek' }, { status: 400 });
}
