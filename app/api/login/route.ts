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
    const password = String(body.password || '').trim();
    const loginMode = body.mode;

    const forwardedFor = request.headers.get('x-forwarded-for');
    const currentIp = forwardedFor ? forwardedFor.split(',')[0].trim() : 'unknown';

    let BRANCH_PASSWORDS: Record<string, string> = { "zumay": "ZUMAY KANALI" };

    const rawEnv = process.env.BRANCH_PASSWORDS || '';
    if (rawEnv) {
      try {
        const cleanJson = rawEnv.trim().replace(/^['"]|['"]$/g, '');
        BRANCH_PASSWORDS = { ...BRANCH_PASSWORDS, ...JSON.parse(cleanJson) };
      } catch (e) { console.error("JSON Hatası"); }
    }

    if (loginMode === 'yonetici') {
      if (password === process.env.ADMIN_PASS) {
        return NextResponse.json({ success: true, branch: 'CMR MERKEZ', isAdmin: true });
      }
      return NextResponse.json({ success: false, message: "Hatalı Yönetici Şifresi!" });
    }

    const matchedBranch = BRANCH_PASSWORDS[password];
    if (!matchedBranch) return NextResponse.json({ success: false, message: "Hatalı Şube Şifresi!" });

    const isSpecial = matchedBranch === 'VODAFONE KANALI' || matchedBranch === 'ZUMAY KANALI';
    const isOffice = MASTER_IPLER.includes(currentIp) || IP_HARITASI[currentIp] === matchedBranch;

    if (isSpecial || isOffice) {
      return NextResponse.json({ success: true, branch: matchedBranch, isAdmin: false });
    }

    return NextResponse.json({ 
      success: false, 
      message: `GÜVENLİK UYARISI: Bu şifreyi bu mağazanın interneti dışında kullanamazsınız! (IP: ${currentIp})` 
    });
  } catch (error) {
    return NextResponse.json({ success: false, message: "Sunucu Hatası" }, { status: 500 });
  }
}
