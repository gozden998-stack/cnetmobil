import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';

// KRİTİK: Build hatasını önlemek için bu rotanın statik olmadığını belirtiyoruz
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const tag = request.nextUrl.searchParams.get('tag');

  if (!tag) {
    return NextResponse.json({ message: 'Tag parametresi eksik' }, { status: 400 });
  }

  try {
    // Hafızadaki (cache) veriyi temizler
    revalidateTag(tag);
    
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
