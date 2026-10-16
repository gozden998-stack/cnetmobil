// app/components/screens/vodafoneDegerPuanTipleri.ts
//
// Vodafone Değer Puan ekranlarının ortak tipleri (sunucu kodundan bağımsız;
// bkz. app/api/wingsm/vodafone/_vodafone.ts içindeki rapor şekli).

export type VodafoneStoreRow = {
  branchLabel: string;
  depotCode: string;
  saleCount: number;
  puan: number;
  hedef: number | null;
  projeksiyon: number;
  hedefYuzdesi: number | null;
  puanProjex: number | null;
  siralamaPuani: number;
};

export type VodafonePersonnelRow = {
  branchLabel: string;
  magazalar: Array<{ branchLabel: string; puan: number }>;
  saticiKod: string;
  saticiAdi: string;
  saleCount: number;
  puan: number;
  hedef: number | null;
  isManager: boolean;
  hedefYuzdesi: number | null;
  projeksiyon: number;
  siralama: number | null;
  siralamaPuani: number;
};

export type VodafoneReportView = {
  hasSnapshot: boolean;
  computedAt?: string | null;
  hedefPeriodu?: string;
  gunBilgisi?: { gecenGun: number; ayToplamGun: number; kalanGun: number };
  period?: { tarih: string; tarih2: string };
  stores?: VodafoneStoreRow[];
  personnel?: VodafonePersonnelRow[];
  totals?: { gerceklesen: number; projeksiyon: number; gerceklesenOrtalama: number; projeksiyonOrtalama: number };
  sinif?: string;
  adetAlani?: string | null;
  kaynak?: SalesSource;
  kaynakOzeti?: Array<{ magaza: string; liste: number; aktivasyon: number; temlik: number; birlesik: number }>;
  rowsWithPuan?: number;
  rowsWithoutPuan?: number;
  withoutPuanExamples?: string[];
  history?: Array<{ id: number; tarih: string; tarih2: string; computedAt: string }>;
  selectedHistoryId?: number | null;
  durum?: "guncel" | "bekleniyor" | null;
  aySonuPaylasim?: boolean;
  bulunamadi?: boolean;
  istenenGun?: string | null;
  tamEsleme?: boolean;
};

export type SalesSource = "liste" | "aktivasyon" | "temlik" | "ikisi" | "hepsi";

export type VodafoneSettings = {
  sinif: string;
  storeBonus: number[];
  personnelBonus: number[];
  kaynak: SalesSource;
  adetCarp: boolean;
};
