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

    // --- KRİTİK DÜZELTME: GİZLENMİŞ ŞİFREYİ ÇÖZME ---
    // Frontend'de btoa() ile gönderdiğin şifreyi burada geri açıyoruz.
    try {
      const decoded = Buffer.from(password, 'base64').toString('utf-8');
      // Eğer şifre base64 ise decoded farklı çıkacaktır, onu kullanalım.
      if (decoded && decoded.length > 0) {
        password = decoded;
      }
    } catch (e) {
      // Eğer base64 değilse (düz metinse) hata verir, eski haliyle devam eder.
    }
    // ----------------------------------------------

    const forwardedFor = request.headers.get('x-forwarded-for');
    const currentIp = forwardedFor ? forwardedFor.split(',')[0].trim() : 'unknown';

    let BRANCH_PASSWORDS: Record<string, string> = { "zumay": "ZUMAY KANALI" };

    const rawEnv = process.env.BRANCH_PASSWORDS || '';
    if (rawEnv) {
      try {
        const cleanJson = rawEnv.trim().replace(/^['"]|['"]$/g, '');
        BRANCH_PASSWORDS = { ...BRANCH_PASSWORDS, ...JSON.parse(cleanJson) };
      } catch (e) { 
        console.error("JSON Hatası: Şifre listesi yüklenemedi."); 
      }
    }

    // 1. Yönetici Girişi Kontrolü
    if (loginMode === 'yonetici') {
      if (password === process.env.ADMIN_PASS) {
        return NextResponse.json({ success: true, branch: 'CMR MERKEZ', isAdmin: true });
      }
      return NextResponse.json({ success: false, message: "Hatalı Yönetici Şifresi!" });
    }

    // 2. Şube Şifresi Kontrolü
    const matchedBranch = BRANCH_PASSWORDS[password];
    
    if (!matchedBranch) {
      // Buraya düşüyorsa şifre çözüldükten sonra bile listede yok demektir.
      return NextResponse.json({ success: false, message: "Hatalı Şube Şifresi!" });
    }

    // 3. Güvenlik ve IP Kontrolü
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
