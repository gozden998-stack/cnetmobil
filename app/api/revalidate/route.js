import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';

export async function GET(request) {
  const tag = request.nextUrl.searchParams.get('tag');

  if (tag) {
    // Vercel hafızasını temizle
    revalidateTag(tag); 
    
    // 🚀 Ön yüzdeki "if (data.success)" kontrolü için 'success: true' ekledik.
    // Bu sayede artık "Bir hata oluştu" uyarısı yerine "Başarılı" uyarısı alacaksın.
    return NextResponse.json({ 
      success: true, 
      revalidated: true, 
      now: Date.now() 
    });
  }

  return NextResponse.json({ 
    success: false, 
    message: 'Tag belirtilmedi' 
  }, { status: 400 });
}
