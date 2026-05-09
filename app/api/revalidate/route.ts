import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';

// 🚀 DÜZELTME BURADA: Başlangıç değeri artık Date.now() değil, 0.
// Vercel uyku moduna geçip uyandığında bu değer 0 olacak. 
// Ekrandaki versiyon 0'dan büyük olacağı için sahte alarm ASLA tetiklenmeyecek!
let globalVersion = 0;

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
      // revalidateTag yerine revalidatePath kullanıyoruz. 
      // '/' ve 'layout' diyerek tüm sitenin ana hafızasını temizlediğimizi garantiye alıyoruz.
      revalidatePath('/', 'layout');
      
      // Yeni bir versiyon numarası belirle (Ekranlara güncelleme uyarısı gitmesi için)
      globalVersion = Date.now(); 
      
      return NextResponse.json({ 
        revalidated: true, 
        now: Date.now(), 
        success: true,
        version: globalVersion, // Yenilenen versiyonu da bilgi olarak dönüyoruz
        message: 'Önbellek başarıyla temizlendi ve yeni versiyon yayınlandı.'
      });
    } catch (err) {
      return NextResponse.json({ message: 'Yenileme hatası', success: false }, { status: 500 });
    }
  }

  return NextResponse.json({ message: 'Geçersiz istek' }, { status: 400 });
}
