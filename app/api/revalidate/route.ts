import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const tag = request.nextUrl.searchParams.get('tag');

  if (!tag) {
    return NextResponse.json({ message: 'Tag parametresi eksik' }, { status: 400 });
  }

  try {
    // NEXT.JS YENİ SÜRÜM GÜNCELLEMESİ: 
    // 2. parametre olarak { expire: 0 } ekledik. 
    // Anlamı: Önbelleği bekleme süresi olmadan hemen ve tamamen sil.
    revalidateTag(tag, { expire: 0 });
    
    return NextResponse.json({ 
      revalidated: true, 
      now: Date.now(), 
      success: true,
      tag: tag 
    });
  } catch (err) {
    return NextResponse.json({ message: 'Revalidate hatası', error: err }, { status: 500 });
  }
}
