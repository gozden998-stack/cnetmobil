
import { NextResponse } from 'next/server';

// 🚀 BÜTÜN SIR BURADA: Bu route'u Vercel'in global hafızasına (CDN) sabitliyoruz!
// Böylece 8 mağaza da nerede olursa olsun AYNI anda AYNI versiyon numarasını görecek.
export const dynamic = 'force-static';

export async function GET() {
  return NextResponse.json({ version: Date.now() });
}
