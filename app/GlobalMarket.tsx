"use client";

/**
 * CNETMOBIL - GlobalMarket
 *
 * Fiyat değişikliği / bildirim sistemi artık AnaSayfa.tsx içinde çalışıyor.
 * Bu dosya bilerek boş bırakılmıştır.
 *
 * Böylece:
 * - /api/sheets üzerinden ikinci bir fiyat sorgusu yapılmaz.
 * - "bildirim.mp3" sesi çalmaz.
 * - Sağdan açılan eski "FİYAT DEĞİŞTİ" paneli oluşmaz.
 * - Aynı fiyat değişikliği iki farklı sistem tarafından işlenmez.
 *
 * Layout.tsx hâlâ <GlobalMarket /> çağırıyorsa build bozulmasın diye
 * component korunur ve sadece null döner.
 */
export default function GlobalMarket() {
  return null;
}
