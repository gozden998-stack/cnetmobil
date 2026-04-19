import { NextResponse } from 'next/server';

// F12'DE ASLA GÖRÜNMEYECEK GİZLİ VERİLER
const IP_HARITASI: any = {
  "78.188.91.172": "CMR SARAY",
  "46.197.252.143": "CMR KAPAKLI",
  "31.155.79.145": "CMR MERKEZ",
  "149.0.18.162": "CMR CADDE"
};

const MASTER_IPLER = [
  "95.70.226.118",
  "148.0.18.162"
];

export async function POST(request: Request) {
  const body = await request.json();
  const { action, password, mode, branch } = body;
  
  // Kullanıcının IP adresini yakala
  const forwardedFor = request.headers.get('x-forwarded-for');
  const currentIp = forwardedFor ? forwardedFor.split(',')[0].trim() : 'unknown';

  // 1. OTURUM KONTROLÜ (Sayfa yenilendiğinde)
  if (action === 'verify') {
     if (mode === 'yonetici' || branch === 'VODAFONE KANALI' || branch === 'ZUMAY KANALI') {
         return NextResponse.json({ valid: true });
     }
     if (MASTER_IPLER.includes(currentIp) || IP_HARITASI[currentIp] === branch) {
         return NextResponse.json({ valid: true });
     }
     return NextResponse.json({ valid: false });
  }

  // 2. GİRİŞ YAPMA (Şifre Kontrolü)
  const MASTER_ADMIN_PASS = process.env.ADMIN_PASS;
  let BRANCH_PASSWORDS: Record<string, string> = {};
  
  if (process.env.BRANCH_PASSWORDS) {
    try { BRANCH_PASSWORDS = JSON.parse(process.env.BRANCH_PASSWORDS); } catch (e) {}
  }

  if (mode === 'yonetici') {
    if (password === MASTER_ADMIN_PASS) return NextResponse.json({ success: true, branch: 'CMR MERKEZ', isAdmin: true });
    return NextResponse.json({ success: false, message: "Hatalı Yönetici Şifresi!" });
  }

  const matchedBranch = BRANCH_PASSWORDS[password];
  if (!matchedBranch) return NextResponse.json({ success: false, message: "Hatalı Şube Şifresi!" });

  if (matchedBranch === 'VODAFONE KANALI' || matchedBranch === 'ZUMAY KANALI' || MASTER_IPLER.includes(currentIp) || IP_HARITASI[currentIp] === matchedBranch) {
    return NextResponse.json({ success: true, branch: matchedBranch, isAdmin: false });
  }

  return NextResponse.json({ success: false, message: `GÜVENLİK UYARISI: Bu şifreyi bu mağazanın interneti dışında kullanamazsınız! Lütfen şube ağına bağlanın. (Mevcut IP'niz: ${currentIp})` });
}
