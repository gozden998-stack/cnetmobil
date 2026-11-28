// app/lib/stok-imei-karti.ts
//
// CNETMOBIL - IMEI kartı (SALT OKUNUR, yalnız yönetici): bir cihazın tüm hareketleri + satış özeti.
// Satış özeti, WingSM satışı yakalandığında stock_events'e yazılan kanıt satırından (metadata.evidence) çıkarılır.
// KİŞİSEL VERİ: kanıt satırında TC kimlik no, doğum tarihi, maliyet/kâr da vardır; bunlar BİLEREK alınmaz.

export type SatisOzeti = {
  tarih: string | null;
  saat: string | null;
  magaza: string | null;
  personel: string | null;
  musteri: string | null;
  telefon: string | null;
  tutar: number | null;
  faturaNo: string | null;
  urun: string | null;
};

const text = (value: unknown): string | null => {
  const result = String(value ?? "").trim();

  return result ? result : null;
};

const money = (value: unknown): number | null => {
  const number = Number(value);

  return Number.isFinite(number) && number > 0 ? number : null;
};

// WingSM satış satırı -> güvenli özet. Satır nesne değilse null.
export function extractSale(evidence: unknown): SatisOzeti | null {
  if (!evidence || typeof evidence !== "object" || Array.isArray(evidence)) return null;

  const row = evidence as Record<string, unknown>;

  return {
    tarih: text(row.Tarih),
    saat: text(row.FaturaSaat) ?? (text(row.IslemTarihi)?.split(" ")[1] ?? null),
    magaza: text(row.SirketAdI),
    personel: text(row.SaticiAdI),
    musteri: text(row.CariAd),
    telefon: text(row.MusCepTel),
    tutar: money(row.SatisTutari) ?? money(row.NetTutarI) ?? money(row.TutarI) ?? money(row.MalBirimFiyatI),
    faturaNo: text(row.FaturaNo),
    urun: text(row.MalAd),
  };
}

export type KartOlay = {
  id: number;
  event_type: string;
  from_branch_code: string | null;
  to_branch_code: string | null;
  old_status: string | null;
  new_status: string | null;
  performed_by: string | null;
  created_at: string;
  evidence?: unknown;
};

// En yeni satış durumu: SATILDI (WINGSM_SALE_DETECTED), IADE (daha yeni WINGSM_SALE_REVERSED) ya da YOK.
export function saleState(eventsNewestFirst: KartOlay[]): { durum: "SATILDI" | "IADE" | "YOK"; satis: SatisOzeti | null } {
  const sale = eventsNewestFirst.find((event) => event.event_type === "WINGSM_SALE_DETECTED");
  const reversed = eventsNewestFirst.find((event) => event.event_type === "WINGSM_SALE_REVERSED");

  if (!sale) return { durum: "YOK", satis: null };

  const summary = extractSale(sale.evidence);

  if (reversed && (new Date(reversed.created_at).getTime() >= new Date(sale.created_at).getTime())) return { durum: "IADE", satis: summary };

  return { durum: "SATILDI", satis: summary };
}
