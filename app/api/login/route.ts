import { NextResponse } from 'next/server';

const IP_HARITASI: Record<string, string> = {
  "78.188.91.172": "CMR SARAY",
  "46.197.253.82": "CMR KAPAKLI",
  "31.155.79.145": "CMR MERKEZ",
  "149.0.18.162": "CMR CADDE"
};

const MASTER_IPLER = ["95.70.226.118", "148.0.18.162"];

// login/route.ts - HATA AYIKLAMA VERSİYONU
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const incomingPassword = String(body.password || '').trim();
    
    console.log("Gelen Ham Şifre:", incomingPassword); // Terminale ne geldiğini yazdırır

    let BRANCH_PASSWORDS: Record<string, string> = { "zumay": "ZUMAY KANALI" };
    const rawEnv = process.env.BRANCH_PASSWORDS || '';
    
    if (rawEnv) {
      try {
        const cleanJson = rawEnv.trim().replace(/^['"]|['"]$/g, '');
        const parsed = JSON.parse(cleanJson);
        BRANCH_PASSWORDS = { ...BRANCH_PASSWORDS, ...parsed };
        console.log("Yüklenen Şubeler:", Object.keys(BRANCH_PASSWORDS)); // Hangi şifreler yüklendi?
      } catch (e) { 
        console.error("JSON PARSE HATASI! .env dosyanız hatalı."); 
      }
    }

    // Şifreyi burada kontrol ediyoruz
    const matchedBranch = BRANCH_PASSWORDS[incomingPassword];

    if (!matchedBranch) {
      // Eğer burada hata alıyorsan, yukarıdaki console.log'daki değer ile 
      // .env içindeki değer birbirini tutmuyor demektir.
      return NextResponse.json({ 
        success: false, 
        message: `Hatalı Şube Şifresi! (Gelen: ${incomingPassword})` 
      });
    }

    // ... geri kalan kodlar aynı ...

  } catch (error) {
    return NextResponse.json({ success: false, message: "Sunucu Hatası" }, { status: 500 });
  }
}
