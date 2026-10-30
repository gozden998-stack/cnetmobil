// Bayi (partner) kanalları: bu etiketlerle açılan kullanıcılar CNETMOBIL PARTNER
// ekranını görür (Dış Kanal, Cihaz Alım, Ödeme Talepleri; IP kısıtı yok; mağaza
// bildirimi/hedef/izin yok). Yeni bayi eklemek için etiketi buraya yazmak yeterli;
// onay SMS numarası ayrıca PAYMENT_APPROVAL_PHONES_BY_BRANCH ile tanımlanır.
export const PARTNER_CHANNEL_BRANCHES = ["ZUMAY KANALI", "GÜNAY KANALI"] as const;

export function isPartnerChannelBranch(branch: unknown) {
  const wanted = String(branch ?? "").trim().toLocaleUpperCase("tr-TR");

  return PARTNER_CHANNEL_BRANCHES.some((item) => item === wanted);
}
