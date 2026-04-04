import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// 1. Sadece test edilecek mağazanın IP adresi
const ALLOWED_IPS = [
  '95.70.226.118'
]

export function middleware(request: NextRequest) {
  // 2. PATRON MODU: Gizli Link ile Giriş
  if (request.nextUrl.searchParams.get('patron') === 'cnet1905') {
    const response = NextResponse.redirect(new URL('/', request.url))
    response.cookies.set('patron_izni', 'aktif', { 
      httpOnly: true, 
      secure: true, 
      maxAge: 60 * 60 * 24 * 365 // 1 Yıl geçerli kalır
    })
    return response
  }

  // 3. Kapıdaki Kontrol: Bu cihazda Patron izni var mı?
  const isPatron = request.cookies.get('patron_izni')
  if (isPatron) {
    return NextResponse.next() 
  }

  // 4. IP Kontrolü (Hata veren kısım düzeltildi, IP'yi Vercel sunucusundan alıyoruz)
  let clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || ''
  
  // Bazen IP'ler virgülle ayrılarak birden fazla gelebilir, ilkini alıyoruz
  if (clientIp.includes(',')) {
    clientIp = clientIp.split(',')[0].trim()
  }

  // Gelen IP listede mi?
  if (ALLOWED_IPS.includes(clientIp)) {
    return NextResponse.next() 
  }

  // 5. YASAK BÖLGE: IP listede yoksa ve patron değilse reddet!
  return new NextResponse(
    `
    <!DOCTYPE html>
    <html lang="tr">
      <head>
        <meta charset="UTF-8">
        <title>Erişim Engellendi</title>
        <style>
          body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background-color: #f8fafc; color: #0f172a; text-align: center; }
          .card { background: white; padding: 40px; border-radius: 20px; box-shadow: 0 10px 25px rgba(0,0,0,0.05); max-width: 400px; border: 1px solid #e2e8f0; }
          h1 { color: #dc2626; margin-bottom: 10px; font-weight: 900; }
          p { color: #64748b; font-size: 14px; line-height: 1.5; }
          .ip-box { background: #f1f5f9; padding: 10px; border-radius: 8px; font-family: monospace; font-weight: bold; margin-top: 20px; color: #334155; }
        </style>
      </head>
      <body>
        <div class="card">
          <svg style="width:64px;height:64px;margin:0 auto 20px;color:#dc2626;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 00-2 2zM9 11V7a3 3 0 016 0v4"></path></svg>
          <h1>GÜVENLİK İHLALİ</h1>
          <p>CNETMOBIL CMR sistemine sadece yetkili şube ağlarından (Wi-Fi) erişim sağlanabilir.</p>
          <div class="ip-box">Sizin IP Adresiniz:<br>${clientIp || 'Bulunamadı'}</div>
        </div>
      </body>
    </html>
    `,
    { 
      status: 403, 
      headers: { 'content-type': 'text/html; charset=utf-8' } 
    }
  )
}

export const config = {
  matcher: '/',
}
