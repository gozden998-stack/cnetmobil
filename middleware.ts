import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// 1. Sadece test edilecek mağazanın IP adresi
const ALLOWED_IPS = [
  '95.70.226.118'
]

export function middleware(request: NextRequest) {
  // 2. PATRON MODU: Gizli Link veya Şifre ile Giriş
  if (request.nextUrl.searchParams.get('patron') === 'cnet1905') {
    // Şifre doğruysa, URL'deki parametreyi temizle ve ana sayfaya yönlendir
    const url = request.nextUrl.clone()
    url.search = '' 
    const response = NextResponse.redirect(url)
    
    // Tarayıcıya VIP çerezini sağlam bir şekilde bırak
    response.cookies.set({
      name: 'patron_izni',
      value: 'aktif',
      path: '/',
      httpOnly: true,
      secure: true, // Vercel üzerinde çalıştığı için güvenli (HTTPS)
      maxAge: 60 * 60 * 24 * 365 // 1 Yıl geçerli
    })
    return response
  }

  // 3. Kapıdaki Kontrol: Bu cihazda Patron izni var mı?
  const hasPatronCookie = request.cookies.has('patron_izni')
  if (hasPatronCookie) {
    return NextResponse.next() 
  }

  // 4. IP Kontrolü (Mağazalar için)
  let clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || ''
  
  if (clientIp.includes(',')) {
    clientIp = clientIp.split(',')[0].trim()
  }

  if (ALLOWED_IPS.includes(clientIp)) {
    return NextResponse.next() 
  }

  // 5. YASAK BÖLGE: IP listede yoksa REDDET ve Ekrana Giriş Formu Çıkar
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
          .admin-btn { margin-top: 30px; font-size: 12px; color: #94a3b8; background: none; border: none; padding: 10px; cursor: pointer; font-weight: bold; text-decoration: underline; transition: all 0.2s; }
          .admin-btn:hover { color: #2563eb; }
        </style>
      </head>
      <body>
        <div class="card">
          <svg style="width:64px;height:64px;margin:0 auto 20px;color:#dc2626;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 00-2 2zM9 11V7a3 3 0 016 0v4"></path></svg>
          <h1>GÜVENLİK İHLALİ</h1>
          <p>CNETMOBIL CMR sistemine sadece yetkili şube ağlarından (Wi-Fi) erişim sağlanabilir.</p>
          <div class="ip-box">Sizin IP Adresiniz:<br><span style="color:#2563eb; font-size:16px;">${clientIp || 'Bulunamadı'}</span></div>
          
          <button class="admin-btn" onclick="adminLogin()">Sistem Yöneticisi Girişi</button>
        </div>

        <script>
          function adminLogin() {
            var pass = prompt("Lütfen yönetici şifrenizi giriniz:");
            if (pass === "cnet1905") {
              // Şifre doğruysa sistemi otomatik olarak bypass linkine yönlendir
              window.location.href = "/?patron=cnet1905";
            } else if (pass) {
              alert("Hatalı şifre girişi!");
            }
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
