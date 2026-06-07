import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  // 1. GÜVENLİK: API Key kontrolü
  const apiKey = req.headers.get("x-api-key");
  if (!apiKey || apiKey !== process.env.SUPABASE_SECRET_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();

  // 2. SUPABASE'E YAZ
  const { error } = await supabase
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

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
