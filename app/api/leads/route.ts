import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

    const mesaj = `🚀 *CNETMOBİL - YENİ MÜŞTERİ*\n\n` +
                  `👤 *İsim:* ${body.name}\n` +
                  `📞 *Telefon:* ${body.phone}\n` +
                  `📱 *Cihaz:* ${body.brand} ${body.model}\n` +
                  `💾 *Hafıza:* ${body.cap}\n` +
                  `💰 *Teklif:* ${body.price.toLocaleString()} TL`;

    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: mesaj,
        parse_mode: 'Markdown'
      })
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Bildirim hatası" }, { status: 500 });
  }
}
