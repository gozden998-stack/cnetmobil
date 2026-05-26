// app/api/test-ikas/route.js
import { NextResponse } from 'next/server';
// @/lib yerine klasör ağacında 3 adım geriye gidip lib'i buluyoruz:
import { getIkasToken } from '../../../lib/ikas'; 

export async function GET() {
// ... kodun devamı aynı kalacak
  try {
    const token = await getIkasToken();
    return NextResponse.json({ 
      success: true, 
      message: 'İkas bağlantısı başarılı!', 
      token: token.substring(0, 15) + '...' // Güvenlik için token'ın sadece başını gösteriyoruz
    });
  } catch (error) {
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}
