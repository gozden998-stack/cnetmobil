// app/api/stock/transfers/test-complete/route.ts
//
// CNETMOBIL V2 - ESKI MANUEL TEST TRANSFER ENDPOINTI
//
// WingSM entegrasyonu aktif oldugu icin bu endpoint KALICI OLARAK DEVRE DISIDIR.
// Bu route hiçbir stok, talep, transfer veya hareket kaydini DEGISTIRMEZ.
// Gercek transfer tamamlama akisi:
//   /api/wingsm/transfers/complete
// endpointi tarafindan WingSM kaniti ile otomatik tamamlanir.

import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

function disabledResponse() {
  return NextResponse.json(
    {
      success: false,
      disabled: true,
      error:
        'Manuel test transfer tamamlama devre dışıdır. Transferler yalnızca WingSM doğrulaması ile otomatik tamamlanır.',
      transferCompleteEndpoint: '/api/wingsm/transfers/complete',
    },
    {
      status: 410,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
        Pragma: 'no-cache',
        'X-Content-Type-Options': 'nosniff',
      },
    }
  );
}

export async function GET() {
  return disabledResponse();
}

export async function POST() {
  return disabledResponse();
}
