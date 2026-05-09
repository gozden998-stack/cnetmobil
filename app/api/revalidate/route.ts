import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';

export async function GET(request: NextRequest) {
  const tag = request.nextUrl.searchParams.get('tag');

  if (tag === 'sheets-data') {
    // Hafızadaki veriyi siliyoruz
    revalidateTag('sheets-data');
    return NextResponse.json({ revalidated: true, now: Date.now(), success: true });
  }

  return NextResponse.json({ revalidated: false, message: 'Etiket bulunamadı' });
}
