// app/lib/notificationPrice.ts
//
// Ana sayfa "Duyurular & Bildirimler" fiyat bildirimleri için fiyat çözücü.
//
// Fiyatlar tam TL tutulur ve Sheets'ten hem Türkçe ("12.500", "12.500,00"),
// hem İngilizce ("12,500", "12,500.00") hem de düz ("12500", "12500 TL",
// "₺12.500") biçimlerde gelebilir. ESKİ kod virgülden sonrasını atıyordu
// ("12,500" -> 12), bu yüzden bildirimde "12 TL -> 11 TL" görünüyordu.
//
// Kural: sondaki ayraçtan sonra 1-2 hane varsa o KURUŞ kısmıdır (atılır);
// 3 hane varsa binlik ayracıdır. Sonra tüm ayraçlar silinir.
//
// Hiçbir dış bağımlılığı yoktur (ayrı test edilebilsin diye).

export function parseNotificationPrice(value: unknown): number {
  if (value === null || value === undefined || value === '') return 0;

  if (typeof value === 'number') {
    return Number.isFinite(value) ? Math.round(value) : 0;
  }

  const cleaned = String(value).replace(/[^\d.,]/g, '');

  if (!cleaned) return 0;

  const lastSeparator = Math.max(cleaned.lastIndexOf('.'), cleaned.lastIndexOf(','));
  let integerPart = cleaned;

  if (lastSeparator !== -1) {
    const afterSeparator = cleaned.slice(lastSeparator + 1);

    if (afterSeparator.length === 1 || afterSeparator.length === 2) {
      integerPart = cleaned.slice(0, lastSeparator);
    }
  }

  const digits = integerPart.replace(/\D/g, '');

  return digits ? parseInt(digits, 10) : 0;
}
