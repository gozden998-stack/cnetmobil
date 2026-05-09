import { revalidateTag, revalidatePath } from 'next/cache'; // DOĞRU İMPORT BURASI
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tag = searchParams.get('tag');

    // 1. Tag belirtilmişse onu, yoksa varsayılanı temizle
    if (tag) {
      revalidateTag(tag);
    } else {
      revalidateTag('sheets-data');
    }
    
    // 2. Ana sayfayı temizle (Sadece '/' yeterlidir, 'layout' parametresi bazen tip hatası verebilir)
    revalidatePath('/');

    return NextResponse.json({ revalidated: true, now: Date.now() });
  } catch (error) {
    return NextResponse.json(
      { revalidated: false, message: 'Önbellek temizlenirken hata oluştu' },
      { status: 500 }
    );
  }
}
