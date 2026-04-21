import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const ALLOWED_IPS = [
  '95.70.226.118',
  '78.188.91.172',
  '31.155.79.145',
  '46.197.253.90',
  '149.0.18.162'
]

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. PATRON MODU (Giriş yapınca Admin Panel'e atar)
  if (request.nextUrl.searchParams.get('patron') === 'cnet1905') {
    const url = request.nextUrl.clone()
    url.pathname = '/admin-panel' // Girişten sonra admin paneline yönlendir
    url.search = '' 
    const response = NextResponse.redirect(url)
    response.cookies.set({
      name: 'patron_izni',
      value: 'aktif',
      path: '/',
      httpOnly: true,
      secure: true, 
      maxAge: 60 * 60 * 24 * 365
    })
    return response
  }

  // 2. VODAFONE MODU
  if (request.nextUrl.searchParams.get('vodafone') === 'vdf123') {
    const url = request.nextUrl.clone()
    url.search = '' 
    const response = NextResponse.redirect(url)
    response.cookies.set({
      name: 'vodafone_izni',
      value: 'aktif',
      path: '/',
      httpOnly: true,
      secure: true, 
      maxAge: 60 * 60 * 24 * 365
    })
    return response
  }

  // 2.2. ZUMAY MODU (Giriş yapınca Teknik Takip'e atar)
  if (request.nextUrl.searchParams.get('zumay') === 'zumay') {
    const url = request.nextUrl.clone()
    url.pathname = '/teknik-takip' // Zumay girişi sonrası teknik takibe atar
    url.search = '' 
    const response = NextResponse.redirect(url)
    response.cookies.set({
      name: 'zumay_izni',
      value: 'aktif',
      path: '/',
      httpOnly: true,
      secure: true, 
      maxAge: 60 * 60 * 24 * 365
    })
    return response
  }

  // 3. Kapıdaki Kontrol
  const hasPatronCookie = request.cookies.has('patron_izni')
  const hasVodafoneCookie = request.cookies.has('vodafone_izni')
  const hasZumayCookie = request.cookies.has('zumay_izni')

  // Eğer izni varsa her yere girebilir
  if (hasPatronCookie || hasVodafoneCookie || hasZumayCookie) { 
    return NextResponse.next() 
  }

  // IP Kontrolü
  let clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || ''
  if (clientIp.includes(',')) clientIp = clientIp.split(',')[0].trim()

  if (ALLOWED_IPS.includes(clientIp)) {
    return NextResponse.next() 
  }

  // --- ENGEL EKRANI ---
  return new NextResponse(
    `
    <!DOCTYPE html>
    <html lang="tr">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Erişim Engellendi</title>
        <style>
          body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background-color: #020617; color: #f8fafc; text-align: center; }
          .card { background: #0f172a; padding: 40px; border-radius: 30px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); max-width: 400px; width: 85%; border: 1px solid #1e293b; }
          h1 { color: #ef4444; margin-bottom: 10px; font-weight: 900; letter-spacing: -1px; }
          p { color: #94a3b8; font-size: 14px; line-height: 1.5; }
          .ip-box { background: #1e293b; padding: 15px; border-radius: 12px; font-family: monospace; font-weight: bold; margin-top: 20px; color: #38bdf8; }
          .btn-group { margin-top: 30px; display: flex; flex-direction: column; gap: 10px; }
          .admin-btn { padding: 12px; border-radius: 12px; border: 1px solid #334155; background: transparent; color: #94a3b8; font-weight: bold; cursor: pointer; transition: all 0.2s; }
          .admin-btn:hover { background: #1e293b; color: white; border-color: #475569; }
          .zumay-btn { border-color: #ef4444; color: #ef4444; }
          .zumay-btn:hover { background: #ef4444; color: white; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1 style="font-size: 40px;">⚠️</h1>
          <h1>ERİŞİM KISITLI</h1>
          <p>Cnetmobil CMR sistemine sadece yetkili IP veya şifre ile giriş yapılabilir.</p>
          <div class="ip-box">IP: ${clientIp || 'Gizli Ağ'}</div>
          
          <div class="btn-group">
            <button class="admin-btn" onclick="login('patron')">PATRON GİRİŞİ</button>
            <button class="admin-btn" onclick="login('vodafone')">VODAFONE GİRİŞİ</button>
            <button class="admin-btn zumay-btn" onclick="login('zumay')">ZUMAY GİRİŞİ</button>
          </div>
        </div>

        <script>
          function login(type) {
            const pass = prompt("Lütfen " + type + " şifrenizi giriniz:");
            if (type === 'patron' && pass === 'cnet1905') window.location.href = "/?patron=cnet1905";
            if (type === 'vodafone' && pass === 'vdf123') window.location.href = "/?vodafone=vdf123";
            if (type === 'zumay' && pass === 'zumay') window.location.href = "/?zumay=zumay";
          }
        </script>
      </body>
    </html>
    `,
    { 
      status: 403, 
      headers: { 'content-type': 'text/html; charset=utf-8' } 
    }
  )
}

// TÜM SİTEYİ KORUMAYA ALAN YENİ MATCHER
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
