import { revalidatePath, revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';

// 🚀 İŞTE SİHİR BURADA: Vercel'in tüm dünyadaki sunucularının ortak hafızası!
// Sen "Yenile" butonuna basana kadar (sheets-data etiketi silinene kadar) 
// bu fonksiyon hep aynı saati döndürür. Kotanı ASLA yemez.
const getGlobalVersion = unstable_cache(
  async () => Date.now(),
  ['version-cache-key'], // Cache ismi
  { tags: ['sheets-data'] } // Bu etiketle cache'i kontrol ediyoruz
);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const check = searchParams.get('check');
  const tag = searchParams.get('tag');

  // 1. DURUM: Şube ekranları "Yeni fiyat var mı?" diye sorduğunda
  if (check === '1') {
    // Vercel'in global ortak hafızasından o anki versiyonu (saati) çeker
    const version = await getGlobalVersion();
    return NextResponse.json({ version });
  }

  // 2. DURUM: Yönetici "FİYATLARI YENİLE" butonuna bastığında
  if (tag) {
    try {
      // TÜM site hafızasını temizle
      revalidatePath('/', 'layout');
      
      // Şubelerin takip ettiği "sheets-data" hafızasını da çöpe at!
      // Bu sayede şubeler bir sonraki soruşunda "getGlobalVersion" mecburen yeniden çalışacak,
      // yepyeni bir saat damgası üretecek ve şubeler anında sayfayı yenileyecek!
      revalidateTag('sheets-data');
      
      return NextResponse.json({ 
        revalidated: true, 
        success: true,
        message: 'Fiyatlar başarıyla güncellendi, tüm şubeler 30 saniye içinde yenilenecek.'
      });
    } catch (err) {
      return NextResponse.json({ message: 'Yenileme hatası', success: false }, { status: 500 });
    }
  }

  return NextResponse.json({ message: 'Geçersiz istek' }, { status: 400 });
}
