import { NextResponse } from 'next/server';

const IP_HARITASI: Record<string, string> = {
  "78.188.91.172": "CMR SARAY",
  "46.197.253.82": "CMR KAPAKLI",
  "31.155.79.145": "CMR MERKEZ",
  "149.0.18.162": "CMR CADDE"
};

const MASTER_IPLER = ["95.70.226.118", "148.0.18.162"];

export async function POST(request: Request) {
  try {
    const body = await request.json();
    let password = String(body.password || '').trim();
    const loginMode = body.mode;

    // --- KRİTİK: ŞİFRE ÇÖZÜCÜ (Base64 Decode) ---
    // Frontend'de btoa() kullanıldığı için burada Buffer ile çözüyoruz.
    try {
      const decoded = Buffer.from(password, 'base64').toString('utf-8');
      // Eğer şifre gerçekten base64 ise decoded değeri anlamlı olacaktır
      if (decoded && decoded.length > 0) {
        password = decoded;
      }
    } catch (e) {
      // Eğer düz metinse hata verir, dokunmadan devam eder
    }
    // --------------------------------------------

    // 1. Yönetici Girişi Kontrolü
    if (loginMode === 'yonetici') {
      const adminPass = (process.env.ADMIN_PASS || '').trim().replace(/^['"]|['"]$/g, '');
      if (password === adminPass) {
        return NextResponse.json({ success: true, branch: 'CMR MERKEZ', isAdmin: true });
      }
      return NextResponse.json({ success: false, message: "Hatalı Yönetici Şifresi!" });
    }

    // 2. Şube Şifreleri Hazırlığı
    let BRANCH_PASSWORDS: Record<string, string> = { "zumay": "ZUMAY KANALI" };
    const rawEnv = process.env.BRANCH_PASSWORDS || '';
    
    if (rawEnv) {
      try {
        // .env dosyasındaki olası tırnak hatalarını temizleyip JSON'a çeviriyoruz
        const cleanJson = rawEnv.trim().replace(/^['"]|['"]$/g, '');
        BRANCH_PASSWORDS = { ...BRANCH_PASSWORDS, ...JSON.parse(cleanJson) };
      } catch (e) {
        console.error("JSON Hatası: Şube listesi okunamadı.");
      }
    }

    // 3. Şube Şifresi Kontrolü
    const matchedBranch = BRANCH_PASSWORDS[password];
    if (!matchedBranch) {
      return NextResponse.json({ success: false, message: "Hatalı Şube Şifresi!" });
    }

    // 4. IP Güvenlik Kontrolü
    const forwardedFor = request.headers.get('x-forwarded-for');
    const currentIp = forwardedFor ? forwardedFor.split(',')[0].trim() : 'unknown';

    const isSpecial = matchedBranch === 'VODAFONE KANALI' || matchedBranch === 'ZUMAY KANALI';
    const isOffice = MASTER_IPLER.includes(currentIp) || IP_HARITASI[currentIp] === matchedBranch;

    if (isSpecial || isOffice) {
      return NextResponse.json({ success: true, branch: matchedBranch, isAdmin: false });
    }

    return NextResponse.json({ 
      success: false, 
      message: `GÜVENLİK UYARISI: Mağaza IP eşleşmedi! (IP: ${currentIp})` 
    });

  } catch (error) {
    return NextResponse.json({ success: false, message: "Sunucu Hatası" }, { status: 500 });
  }
}
