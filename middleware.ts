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
  // 1. PATRON MODU
  if (request.nextUrl.searchParams.get('patron') === 'cnet1905') {
    const url = request.nextUrl.clone()
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

  // --- YENİ EKLENEN: 2.2. ZUMAY MODU ---
  if (request.nextUrl.searchParams.get('zumay') === 'zumay2026') { // Buraya istediğin şifreyi yazabilirsin
    const url = request.nextUrl.clone()
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

  // 3. Kapıdaki Kontrol (Zumay izni eklendi)
  const hasPatronCookie = request.cookies.has('patron_izni')
  const hasVodafoneCookie = request.cookies.has('vodafone_izni')
  const hasZumayCookie = request.cookies.has('zumay_izni') // YENİ

  if (hasPatronCookie || hasVodafoneCookie || hasZumayCookie) { 
    return NextResponse.next() 
  }

  let clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || ''
  if (clientIp.includes(',')) clientIp = clientIp.split(',')[0].trim()

  if (ALLOWED_IPS.includes(clientIp)) {
    return NextResponse.next() 
  }

  return new NextResponse(
    `
    <!DOCTYPE html>
    <html lang="tr">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Erişim Engellendi</title>
        <style>
          body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background-color: #f8fafc; color: #0f172a; text-align: center; }
          .card { background: white; padding: 40px; border-radius: 20px; box-shadow: 0 10px 25px rgba(0,0,0,0.05); max-width: 400px; width: 85%; border: 1px solid #e2e8f0; }
          h1 { color: #dc2626; margin-bottom: 10px; font-weight: 900; }
          p { color: #64748b; font-size: 14px; line-height: 1.5; }
          .ip-box { background: #f1f5f9; padding: 15px; border-radius: 12px; font-family: monospace; font-weight: bold; margin-top: 20px; color: #334155; }
          .admin-btn { font-size: 12px; color: #94a3b8; background: none; border: none; padding: 10px; cursor: pointer; font-weight: bold; text-decoration: underline; transition: all 0.2s; }
          .admin-btn:hover { color: #2563eb; }
          .btn-group { margin-top: 30px; display: flex; flex-direction: column; gap: 5px; }
        </style>
      </head>
      <body>
        <div class="card">
          <svg style="width:64px;height:64px;margin:0 auto 20px;color:#dc2626;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 00-2 2zM9 11V7a3 3 0 016 0v4"></path></svg>
          <h1>GÜVENLİK İHLALİ</h1>
          <p>CNETMOBIL CMR sistemine sadece yetkili şube ağlarından (Wi-Fi) erişim sağlanabilir.</p>
          <div class="ip-box">Sizin IP Adresiniz:<br><span style="color:#2563eb; font-size:16px;">${clientIp || 'Bulunamadı'}</span></div>
          
          <div class="btn-group">
            <button class="admin-btn" onclick="adminLogin()">Sistem Yöneticisi Girişi</button>
            <button class="admin-btn" onclick="vodafoneLogin()">Vodafone Kanalı Girişi</button>
            <button class="admin-btn" style="color:#dc2626; font-weight:900;" onclick="zumayLogin()">Zumay Kanalı Girişi</button>
          </div>
        </div>

        <script>
          function adminLogin() {
            var pass = prompt("Lütfen yönetici şifrenizi giriniz:");
            if (pass === "cnet1905") { window.location.href = "/?patron=cnet1905"; } 
            else if (pass) { alert("Hatalı şifre!"); }
          }

          function vodafoneLogin() {
            var pass = prompt("Lütfen Vodafone kanalı şifrenizi giriniz:");
            if (pass === "vdf123") { window.location.href = "/?vodafone=vdf123"; } 
            else if (pass) { alert("Hatalı şifre!"); }
          }

          // YENİ FONKSİYON
          function zumayLogin() {
            var pass = prompt("Lütfen Zumay kanalı şifrenizi giriniz:");
            if (pass === "zumay2026") { 
              window.location.href = "/?zumay=zumay2026"; 
            } 
            else if (pass) { alert("Hatalı şifre!"); }
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

export const config = {
  matcher: '/',
}
