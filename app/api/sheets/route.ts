import { NextResponse } from 'next/server';

const IP_HARITASI: Record<string, string> = {
  "78.188.91.172": "CMR SARAY",
  "46.197.252.143": "CMR KAPAKLI",
  "31.155.79.145": "CMR MERKEZ",
  "149.0.18.162": "CMR CADDE"
};

const MASTER_IPLER = ["95.70.226.118", "148.0.18.162"];

export async function POST(request: Request) {
  const body = await request.json();
  // Şifreyi alırken doğrudan metne çeviriyoruz ve boşlukları siliyoruz
  const { action, mode, branch } = body;
  const password = String(body.password || '').trim();
  
  const forwardedFor = request.headers.get('x-forwarded-for');
  const currentIp = forwardedFor ? forwardedFor.split(',')[0].trim() : 'unknown';

  // 1. OTURUM KONTROLÜ
  if (action === 'verify') {
     if (mode === 'yonetici' || branch === 'VODAFONE KANALI' || branch === 'ZUMAY KANALI' || MASTER_IPLER.includes(currentIp) || IP_HARITASI[currentIp] === branch) {
         return NextResponse.json({ valid: true });
     }
     return NextResponse.json({ valid: false });
  }

  // 2. ŞİFRE LİSTESİNİ ÇEK VE TEMİZLE
  let BRANCH_PASSWORDS: Record<string, string> = {};
  const rawEnv = process.env.BRANCH_PASSWORDS || '';
  
  if (rawEnv) {
    try { 
      // Vercel'den gelen veride gizli tırnaklar veya hatalı karakterler varsa temizle
      const cleanJson = rawEnv.trim().replace(/^['"]|['"]$/g, '');
      BRANCH_PASSWORDS = JSON.parse(cleanJson); 
    } catch (e) {
      console.error("KRİTİK HATA: Vercel BRANCH_PASSWORDS formatı bozuk!");
    }
  }

  // 3. YÖNETİCİ GİRİŞİ
  if (mode === 'yonetici') {
    if (password === process.env.ADMIN_PASS) {
      return NextResponse.json({ success: true, branch: 'CMR MERKEZ', isAdmin: true });
    }
    return NextResponse.json({ success: false, message: "Hatalı Yönetici Şifresi!" });
  }

  // 4. ŞUBE GİRİŞİ (Burada şifreyi hem metin hem sayı olarak kontrol ediyoruz)
  const matchedBranch = BRANCH_PASSWORDS[password];

  if (!matchedBranch) {
    // BURASI ÇOK ÖNEMLİ: Hata alıyorsan Vercel Logs'a bak, orada neyi eşleştiremediğini yazdırdık
    console.log("Denenen Şifre:", password);
    console.log("Mevcut Şube Şifreleri:", Object.keys(BRANCH_PASSWORDS));
    return NextResponse.json({ success: false, message: "Hatalı Şube Şifresi!" });
  }

  // 5. GÜVENLİK KONTROLÜ (IP & KANAL)
  const isSpecial = matchedBranch === 'VODAFONE KANALI' || matchedBranch === 'ZUMAY KANALI';
  const isOffice = MASTER_IPLER.includes(currentIp) || IP_HARITASI[currentIp] === matchedBranch;

  if (isSpecial || isOffice) {
    return NextResponse.json({ success: true, branch: matchedBranch, isAdmin: false });
  }

  return NextResponse.json({ 
    success: false, 
    message: `GÜVENLİK UYARISI: Bu şifreyi bu mağazanın interneti dışında kullanamazsınız! (IP: ${currentIp})` 
  });
}
