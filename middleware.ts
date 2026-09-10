import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * CNETMOBIL - ROLE BAZLI GİRİŞ KAPISI
 *
 * Middleware artık IP yüzünden giriş ekranını kapatmaz.
 * Kullanıcı rolü /api/auth ile doğrulandıktan sonra page.tsx:
 * - Yönetici / Super Admin: IP kontrolü YOK
 * - CNETMOBIL Partner: IP kontrolü YOK
 * - Vodafone personeli: Vodafone IP listesine göre kontrol
 * - CMR personeli: kendi mağaza IP'sine göre kontrol
 */
export function middleware(_request: NextRequest) {
  const response = NextResponse.next();

  response.headers.set(
    'Cache-Control',
    'no-store, no-cache, must-revalidate, proxy-revalidate'
  );

  return response;
}

export const config = {
  matcher: '/',
};
