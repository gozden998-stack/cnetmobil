import { NextResponse } from 'next/server';

// F12'DE ASLA GÖRÜNMEYECEK GİZLİ VERİLER
const IP_HARITASI: Record<string, string> = {
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
  
  const forwardedFor = request.headers.get('x-forwarded-for');
  const currentIp = forwardedFor ? forwardedFor.split(',')[0].trim() : 'unknown';

  // 1. OTURUM KONTROLÜ
  if (action === 'verify') {
     if (mode === 'yonetici' || branch === 'VODAFONE KANALI' || branch === 'ZUMAY KANALI') {
         return NextResponse.json({ valid: true });
     }
     if (MASTER_IPLER.includes(currentIp) || IP_HARITASI[currentIp] === branch) {
         return NextResponse.json({ valid: true });
     }
     return NextResponse.json({ valid: false });
  }

  // 2. ŞİFRE LİSTESİNİ TEMİZLEYEREK ÇEK
  const MASTER_ADMIN_PASS = process.env.ADMIN_PASS;
  let BRANCH_PASSWORDS: Record<string, string> = {};
  
  if (process.env.BRANCH_PASSWORDS) {
    try { 
      // Baştaki/sondaki olası tek-çift tırnakları ve boşlukları siler
      const cleanJson = process.env.BRANCH_PASSWORDS.trim().replace(/^['"]|['"]$/g, '');
      BRANCH_PASSWORDS = JSON.parse(cleanJson); 
    } catch (e) {
      console.error("Vercel'deki BRANCH_PASSWORDS okunamadı, JSON formatı hatalı!");
    }
  }

  // Gelen şifreyi metne (string) çevir ve boşlukları sil (Önemli!)
  const inputPass = String(password).trim();

  // 3. YÖNETİCİ GİRİŞİ
  if (mode === 'yonetici') {
    if (inputPass === MASTER_ADMIN_PASS) {
      return NextResponse.json({ success: true, branch: 'CMR MERKEZ', isAdmin: true });
    }
    return NextResponse.json({ success: false, message: "Hatalı Yönetici Şifresi!" });
  }

  // 4. ŞUBE GİRİŞİ
  const matchedBranch = BRANCH_PASSWORDS[inputPass];

  if (!matchedBranch) {
    // Debug için: Hata anında sistemde ne var görelim (Sadece Vercel Logs'da çıkar)
    console.log("Girilen Şifre:", inputPass);
    console.log("Sistemdeki Anahtarlar:", Object.keys(BRANCH_PASSWORDS));
    return NextResponse.json({ success: false, message: "Hatalı Şube Şifresi!" });
  }

  // 5. IP VE KANAL KONTROLÜ
  const isSpecialChannel = matchedBranch === 'VODAFONE KANALI' || matchedBranch === 'ZUMAY KANALI';
  const isAuthorizedIp = MASTER_IPLER.includes(currentIp) || IP_HARITASI[currentIp] === matchedBranch;

  if (isSpecialChannel || isAuthorizedIp) {
    return NextResponse.json({ success: true, branch: matchedBranch, isAdmin: false });
  }

  return NextResponse.json({ 
    success: false, 
    message: `GÜVENLİK UYARISI: Şube şifresi doğru ancak IP eşleşmiyor! Lütfen şube internetine bağlanın. (IP: ${currentIp})` 
  });
}
