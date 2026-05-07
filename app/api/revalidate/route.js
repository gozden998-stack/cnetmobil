import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';

export async function GET(request) {
  const tag = request.nextUrl.searchParams.get('tag');
  if (tag) {
    revalidateTag(tag); // Hafızayı temizle emri
    return NextResponse.json({ revalidated: true, now: Date.now() });
  }
  return NextResponse.json({ message: 'Tag belirtilmedi' });
}

