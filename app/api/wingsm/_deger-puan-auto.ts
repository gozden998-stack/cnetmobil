// app/api/wingsm/_deger-puan-auto.ts
//
// CNETMOBIL - WingSM Değer Puan - GÜNLÜK OTOMATİK HESAPLAMA (tarih kuralları)
//
// Kural (kullanıcı talimatı): panel her gün Türkiye saatiyle 10:00'da kendisi
// hesaplar. Bugün ayın 11'i ise 1 - 10 arası, 12'si ise 1 - 11 arası.
//
// AY SONU: ayın 28'inde otomatik hesaplama DURUR (28, 29, 30, 31 ve ayın 1'i
// hesaplanmaz). Ay sonu raporu ayın 1'inde yönetici tarafından gruptan
// paylaşılır; personel ekranında bu yazar. Otomatik hesap ayın 2'sinde yeni
// ayın ilk gününden (01 - 01) yeniden başlar. Yönetici istediği zaman admin
// ekranındaki HESAPLA ile elle hesaplayabilir.
//
// Bu dosya "_" ile başladığı için Next.js tarafından route sayılmaz; hiçbir dış
// bağımlılığı yoktur (ayrı test edilebilsin diye).

// Otomatik hesaplama bu saatten (Türkiye saati) itibaren çalışır.
export const AUTO_RUN_HOUR = 10;

const ISTANBUL_PARTS = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Istanbul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  hourCycle: "h23",
});

// Verilen anın Türkiye saatine göre tarihi ("YYYY-MM-DD") ve saati (0-23).
export function istanbulDateAndHour(now: Date): { date: string; hour: number } {
  const parts = Object.fromEntries(ISTANBUL_PARTS.formatToParts(now).map((part) => [part.type, part.value]));

  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour),
  };
}

// Bugün otomatik hesaplama yapılan bir gün mü? Ayın 2'si ile 27'si arası evet;
// 28, 29, 30, 31 ve ayın 1'i hayır (ay sonu raporu elle paylaşılır).
export function isAutoRunDay(todayIso: string): boolean {
  const day = Number(todayIso.slice(8, 10));

  return day >= 2 && day <= 27;
}

// Bugünün tarihinden (YYYY-MM-DD) hesaplanacak aralığı çıkarır:
// bitiş = dün, başlangıç = o ayın 1'i. Tarihler WingSM biçiminde (GG/AA/YYYY).
export function autoReportRange(todayIso: string): { tarih: string; tarih2: string } {
  const [y, m, d] = todayIso.split("-").map(Number);

  const end = new Date(Date.UTC(y, m - 1, d - 1));
  const endDay = String(end.getUTCDate()).padStart(2, "0");
  const endMonth = String(end.getUTCMonth() + 1).padStart(2, "0");
  const endYear = end.getUTCFullYear();

  return {
    tarih: `01/${endMonth}/${endYear}`,
    tarih2: `${endDay}/${endMonth}/${endYear}`,
  };
}

// Çalışma saati geldi mi? (Türkiye saatine göre 10:00 ve sonrası.)
export function isAutoRunTime(hour: number): boolean {
  return hour >= AUTO_RUN_HOUR;
}
