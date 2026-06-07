import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

export async function POST(req: Request) {
  // GÜVENLİK KONTROLÜ
  const apiKey = req.headers.get("x-api-key");
  if (!apiKey || apiKey !== process.env.LOG_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const sql = neon(process.env.DATABASE_URL!);

  try {
    await sql`
      INSERT INTO logs (sayfa_adi, hucre_konumu, action_type, eski_deger, yeni_deger, user_email)
      VALUES (${body.sayfa}, ${body.hucre}, ${body.action}, ${body.eski}, ${body.yeni}, ${body.user})
    `;
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}
