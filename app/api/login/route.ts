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
    let incomingPassword = String(body.password || '').trim();
    const loginMode = body.mode;

    // --- DÜZELTME 1: ŞİFRE ÇÖZME ---
    // Eğer frontend'de btoa() kullanarak gönderdiysen burada çözmeliyiz.
    let password = incomingPassword;
    try {
      // Eğer şifre base64 ise çöz, değilse (hata verirse) olduğu gibi bırak.
      const decoded = Buffer.from(incomingPassword, 'base64').toString('utf-8');
      // Sadece gerçekten base64 gibi görünüyorsa decoded değerini kullan
      if (incomingPassword !== decoded) {
          password = decoded;
      }
    } catch (e) {
      password = incomingPassword; 
    }
    // ------------------------------

    const forwardedFor = request.headers.get('x-forwarded-for');
    const currentIp = forwardedFor ? forwardedFor.split(',')[0].trim() : 'unknown';

    let BRANCH_PASSWORDS: Record<string, string> = { "zumay": "ZUMAY KANALI" };

    const rawEnv = process.env.BRANCH_PASSWORDS || '';
    if (rawEnv) {
      try {
        const cleanJson = rawEnv.trim().replace(/^['"]|['"]$/g, '');
        BRANCH_PASSWORDS = { ...BRANCH_PASSWORDS, ...JSON.parse(cleanJson) };
      } catch (e) { 
        console.error("JSON Hatası: .env dosyasındaki şifre listesi bozuk."); 
      }
    }

    if (loginMode === 'yonetici') {
      if (password === process.env.ADMIN_PASS) {
        return NextResponse.json({ success: true, branch: 'CMR MERKEZ', isAdmin: true });
      }
      return NextResponse.json({ success: false, message: "Hatalı Yönetici Şifresi!" });
    }

    const matchedBranch = BRANCH_PASSWORDS[password];
    
    // --- DÜZELTME 2: ŞİFRE KONTROLÜ ---
    if (!matchedBranch) {
       return NextResponse.json({ success: false, message: "Hatalı Şube Şifresi!" });
    }

    const isSpecial = matchedBranch === 'VODAFONE KANALI' || matchedBranch === 'ZUMAY KANALI';
    // Mevcut IP listede mi veya o şubeye mi kayıtlı?
    const isOffice = MASTER_IPLER.includes(currentIp) || IP_HARITASI[currentIp] === matchedBranch;

    if (isSpecial || isOffice) {
      return NextResponse.json({ success: true, branch: matchedBranch, isAdmin: false });
    }

    // IP Eşleşmezse hata ver
    return NextResponse.json({ 
      success: false, 
      message: `GÜVENLİK UYARISI: IP adresi eşleşmiyor! Şube: ${matchedBranch}, Sizin IP: ${currentIp}` 
    });

  } catch (error) {
    return NextResponse.json({ success: false, message: "Sunucu Hatası" }, { status: 500 });
  }
}
