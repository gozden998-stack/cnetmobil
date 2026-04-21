// app/api/auth/route.ts
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    const { password } = await request.json();

    // 1. Yönetici Şifresi Kontrolü (.env dosyasından okur)
    if (password === process.env.ADMIN_PASS) {
        return NextResponse.json({ success: true, role: 'yonetici', branch: 'CMR MERKEZ' });
    }

    // 2. Şube Şifreleri Kontrolü (.env dosyasından okur)
    const branchData = JSON.parse(process.env.BRANCH_PASSWORDS || '{}');
    const matchedBranch = branchData[password];

    if (matchedBranch) {
        return NextResponse.json({ success: true, role: 'personel', branch: matchedBranch });
    }

    // Şifre yanlışsa
    return NextResponse.json({ success: false }, { status: 401 });
}
