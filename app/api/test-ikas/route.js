import { NextResponse } from 'next/server';

// Fonksiyonu doğrudan buraya aldık (klasör yolu hatasını atlatmak için)
async function getIkasToken() {
  const response = await fetch('https://api.ikas.com/api/v1/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: process.env.IKAS_CLIENT_ID,
      client_secret: process.env.IKAS_CLIENT_SECRET,
      grant_type: 'client_credentials'
    })
  });

  if (!response.ok) {
    throw new Error('Ikas token alınamadı! Bilgileri kontrol edin.');
  }

  const data = await response.json();
  return data.access_token;
}

export async function GET() {
  try {
    const token = await getIkasToken();
    return NextResponse.json({ 
      success: true, 
      message: 'İkas bağlantısı başarılı!', 
      token: token.substring(0, 15) + '...'
    });
  } catch (error) {
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}
