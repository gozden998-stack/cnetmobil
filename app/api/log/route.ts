import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// ⚠️ Server-side client (service role)
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    console.log("🚀 LOG API HIT");

    // 1. API KEY CHECK
    const apiKey = req.headers.get("x-api-key");

    console.log("🔑 API KEY RECEIVED:", apiKey);
    console.log("🔑 EXPECTED KEY:", process.env.SUPABASE_SECRET_KEY);

    if (!apiKey || apiKey !== process.env.SUPABASE_SECRET_KEY) {
      return NextResponse.json(
        { error: "Unauthorized (API KEY WRONG)" },
        { status: 401 }
      );
    }

    // 2. BODY
    const body = await req.json();
    console.log("📦 REQUEST BODY:", body);

    // 3. SUPABASE INSERT
    const { data, error } = await supabase
      .from('logs')
      .insert([
        {
          sayfa_adi: body.sayfa,
          hucre_konumu: body.hucre,
          action_type: body.action,
          eski_deger: body.eski,
          yeni_deger: body.yeni,
          user_email: body.user
        }
      ]);

    // 4. SUPABASE RESULT LOG
    console.log("🟢 SUPABASE DATA:", data);
    console.log("🔴 SUPABASE ERROR:", error);

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });

  } catch (err: any) {
    console.log("💥 SERVER ERROR:", err);

    return NextResponse.json(
      { error: err.message || "Unknown error" },
      { status: 500 }
    );
  }
}
