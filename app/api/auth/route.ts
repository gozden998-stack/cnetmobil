export const runtime = 'edge';

export async function POST(request: Request) {
    try {
        const { password } = await request.json();

        // 1. Yönetici Şifresi Kontrolü
        const adminPass = process.env.ADMIN_PASS;
        if (password && password === adminPass) {
            return new Response(
                JSON.stringify({ success: true, role: 'yonetici', branch: 'CMR MERKEZ' }),
                { status: 200, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // 2. Şube Şifreleri Kontrolü
        const branchPasswordsRaw = process.env.BRANCH_PASSWORDS || '{}';
        let branchData = {};
        
        try {
            branchData = JSON.parse(branchPasswordsRaw);
        } catch (e) {
            console.error("JSON Parse Hatası: BRANCH_PASSWORDS formatı hatalı.");
        }

        const matchedBranch = branchData[password];

        if (matchedBranch) {
            return new Response(
                JSON.stringify({ success: true, role: 'personel', branch: matchedBranch }),
                { status: 200, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // Şifre yanlışsa
        return new Response(
            JSON.stringify({ success: false }),
            { status: 401, headers: { 'Content-Type': 'application/json' } }
        );

    } catch (error) {
        // Herhangi bir teknik hatada çökmemesi için
        return new Response(
            JSON.stringify({ success: false, error: 'Sunucu Hatası' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
}
