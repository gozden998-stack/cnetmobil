import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Vercel'deki yeşil yanan isimlerle birebir aynı olmalı
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatid = process.env.TELEGRAM_CHAT_ID;

    if (!token || !chatid) {
      return NextResponse.json({ error: "Değişkenler eksik" }, { status: 500 });
    }

    const mesaj = `🚀 *CNETMOBİL - YENİ MÜŞTERİ*\n\n` +
                  `👤 *İsim:* ${body.name}\n` +
                  `📞 *Telefon:* ${body.phone}\n` +
                  `📱 *Cihaz:* ${body.brand} ${body.model}\n` +
                  `💾 *Hafıza:* ${body.cap}\n` +
                  `💰 *Teklif:* ${body.price.toLocaleString()} TL`;

    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatid,
        text: mesaj,
        parse_mode: 'Markdown'
      })
    });

    const data = await res.json();

    if (!data.ok) {
      console.error("Telegram Hatası:", data);
      return NextResponse.json({ success: false, detail: data.description }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Sistem Hatası" }, { status: 500 });
  }
}
