import { NextResponse } from 'next/server';

// IP ve Şifre Listesi
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
    let incomingPass = String(body.password || '').trim();
    const loginMode = body.mode;

    // 1. ŞİFRE ÇÖZME (F12 GİZLEMESİ İÇİN)
    let password = incomingPass;
    try {
      // Base64 kodlu gelmişse çöz
      const decoded = Buffer.from(incomingPass, 'base64').toString('utf-8');
      if (decoded && decoded.length > 0) password = decoded;
    } catch (e) {
      // Base64 değilse hata almaz, düz metin devam eder
    }

    // 2. YÖNETİCİ KONTROLÜ
    const ADMIN_PASS = (process.env.ADMIN_PASS || 'cnet1905.*').trim().replace(/^['"]|['"]$/g, '');
    if (loginMode === 'yonetici') {
      if (password === ADMIN_PASS) {
        return NextResponse.json({ success: true, branch: 'CMR MERKEZ', isAdmin: true });
      }
      return NextResponse.json({ success: false, message: "Hatalı Yönetici Şifresi!" });
    }

    // 3. ŞUBE ŞİFRE LİSTESİNİ YÜKLE
    let BRANCH_PASSWORDS: Record<string, string> = { "zumay": "ZUMAY KANALI" };
    const rawEnv = process.env.BRANCH_PASSWORDS || '';
    if (rawEnv) {
      try {
        const cleanJson = rawEnv.trim().replace(/^['"]|['"]$/g, '');
        BRANCH_PASSWORDS = { ...BRANCH_PASSWORDS, ...JSON.parse(cleanJson) };
      } catch (e) {
        console.error("JSON PARSE HATASI");
      }
    }

    // 4. ŞİFRE EŞLEŞTİRME
    const matchedBranch = BRANCH_PASSWORDS[password];
    if (!matchedBranch) {
      return NextResponse.json({ success: false, message: `Şifre Yanlış! (Denetlenen: ${password})` });
    }

    // 5. IP GÜVENLİK KONTROLÜ
    const forwardedFor = request.headers.get('x-forwarded-for');
    const currentIp = forwardedFor ? forwardedFor.split(',')[0].trim() : 'unknown';

    const isSpecial = matchedBranch === 'VODAFONE KANALI' || matchedBranch === 'ZUMAY KANALI';
    const isOffice = MASTER_IPLER.includes(currentIp) || IP_HARITASI[currentIp] === matchedBranch;

    if (isSpecial || isOffice) {
      return NextResponse.json({ success: true, branch: matchedBranch, isAdmin: false });
    }

    return NextResponse.json({ 
      success: false, 
      message: `IP UYUMSUZ: Şube ${matchedBranch} için bu internetten giremezsiniz. (IP: ${currentIp})` 
    });

  } catch (error) {
    return NextResponse.json({ success: false, message: "Sunucu Hatası" }, { status: 500 });
  }
}
