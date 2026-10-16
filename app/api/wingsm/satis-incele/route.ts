// app/api/wingsm/satis-incele/route.ts
//
// CNETMOBIL - WingSM satış satırı İNCELEME aracı (yönetici)
//
// AMAÇ: Değer Puan kategori hedeflerinin (Cihaz Adet, Özel Kesim Cam, Samsung
// Premium...) gerçekleşenini WingSM'den otomatik çıkarabilmek için, satış
// satırlarında HANGİ ALANLARIN geldiğini ve bir kategorinin satışlarının
// satırlarda nasıl göründüğünü (ürün adı, sınıf, fiyat...) görmek.
//
// GET ?bastar=GG.AA.YYYY&bittar=GG.AA.YYYY[&depo=003|009|010|011][&ara=cam 400]
//   - Seçilen CMR depolarının satış listesini okur (SADECE GET, WingSM'e hiçbir
//     şey yazılmaz).
//   - "ara": boşlukla ayrılmış kelimeler; satırın TÜM alanlarında hepsi geçmeli
//     (büyük/küçük harf duyarsız).
//   - Cevap: alan listesi (örnek değer + dolu oranı), eşleşen satır sayısı ve
//     ilk 200 satır.
//
// GÜVENLİK: sadece yönetici oturumu. Tarih aralığı en fazla 62 gün.

import { NextRequest } from "next/server";

import { wingSMRequest } from "@/app/lib/wingsm/server";
import { json, requireAdminSession } from "../score-rules/_shared";
import { DegerPuanInputError, toWingsmDate } from "../_deger-puan-compute";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const CMR_DEPOTS: Array<{ depotCode: string; branchLabel: string }> = [
  { depotCode: "003", branchLabel: "CMR MERKEZ" },
  { depotCode: "009", branchLabel: "CMR CADDE" },
  { depotCode: "010", branchLabel: "CMR SARAY" },
  { depotCode: "011", branchLabel: "CMR KAPAKLI" },
];

// Vodafone kanalı mağazaları (WingSM depo kodları).
const VODAFONE_DEPOTS: Array<{ depotCode: string; branchLabel: string }> = [
  { depotCode: "002", branchLabel: "MEYDAN" },
  { depotCode: "005", branchLabel: "TEKİRA" },
  { depotCode: "007", branchLabel: "SARAY VDF" },
  { depotCode: "008", branchLabel: "ERNA" },
];

const MAX_DAYS = 62;

// WingSM büyük tarih aralığında yavaşlayabiliyor ("operation was aborted due to
// timeout"). Aralık kısa dilimlere bölünür, her dilim için daha uzun beklenir ve
// bir deponun hatası diğer depoların sonucunu engellemez.
const CHUNK_DAYS = 5;
const REQUEST_TIMEOUT_MS = 60_000;

function addDaysWingsm(value: string, days: number): string {
  const date = wingsmToDate(value);
  date.setUTCDate(date.getUTCDate() + days);

  return `${String(date.getUTCDate()).padStart(2, "0")}/${String(date.getUTCMonth() + 1).padStart(2, "0")}/${date.getUTCFullYear()}`;
}

function splitRange(tarih: string, tarih2: string): Array<{ tarih: string; tarih2: string }> {
  const chunks: Array<{ tarih: string; tarih2: string }> = [];
  const last = wingsmToDate(tarih2).getTime();
  let start = tarih;

  while (wingsmToDate(start).getTime() <= last) {
    const end = addDaysWingsm(start, CHUNK_DAYS - 1);
    const chunkEnd = wingsmToDate(end).getTime() > last ? tarih2 : end;
    chunks.push({ tarih: start, tarih2: chunkEnd });
    start = addDaysWingsm(chunkEnd, 1);
  }

  return chunks;
}
const MAX_ROWS_RETURNED = 200;

function wingsmToDate(value: string): Date {
  const [day, month, year] = value.split("/").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

type WingSMPayload = {
  data?: { list?: unknown[] } | unknown[];
  List?: unknown[];
};

function extractRows(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;

  const typed = (payload ?? {}) as WingSMPayload;

  if (!Array.isArray(typed.data) && Array.isArray(typed.data?.list)) return typed.data.list;
  if (Array.isArray(typed.data)) return typed.data;
  if (Array.isArray(typed.List)) return typed.List;

  return [];
}

// Arama için Türkçe karakterleri sadeleştirir: "ÖZEL" ile "OZEL", "ŞİŞE" ile
// "SISE" aynı sayılır (WingSM'deki ürün adları bazen İngilizce harflerle yazılı).
function foldText(value: string): string {
  return value
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g");
}

// "05AK" -> "5AK", " 5ak " -> "5AK" (baştaki sıfırlar ve harf boyutu önemsiz).
function normalizeClass(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/^0+(?=\d)/, "");
}

// Vodafone: ürün adının SON 3 HANESİ puandır ("... TARİFE 065" -> 65,
// "... PUAN 200" -> 200). Önünde rakam olmayan 3 haneli sayı aranır; ad sayıyla
// bitmiyorsa (ya da 4+ haneli sayıyla bitiyorsa) null döner.
function parsePuan(productName: unknown): number | null {
  const match = String(productName ?? "")
    .trim()
    .match(/(?:^|[^\d])(\d{3})$/);

  return match ? Number(match[1]) : null;
}

// Adet alanı satış satırında farklı adlarla gelebilir; ilk dolu olanı kullan.
const QTY_FIELD_CANDIDATES = ["MalMiktarI", "Miktar", "MalMiktar", "MiktarI", "Adet", "AdetI"];

function detectQtyField(rows: Array<Record<string, unknown>>): string | null {
  for (const name of QTY_FIELD_CANDIDATES) {
    if (rows.some((row) => row[name] !== undefined && row[name] !== null && String(row[name]).trim() !== "")) {
      return name;
    }
  }

  return null;
}

// Kişi adı büyük/küçük harf ve boşluk farkına duyarsız (CMR Değer Puan ile aynı mantık).
function personKey(name: string, code: string): string {
  const normalized = name.trim().toLocaleUpperCase("tr-TR").replace(/\s+/g, " ");
  return normalized ? normalized : `KOD:${code.trim()}`;
}

function rowText(row: Record<string, unknown>): string {
  return foldText(
    Object.values(row)
      .map((value) => (value === null || value === undefined ? "" : String(value)))
      .join(" ")
  );
}

export async function GET(request: NextRequest) {
  const auth = requireAdminSession(request);

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const params = request.nextUrl.searchParams;

    const bastarRaw = params.get("bastar");
    const bittarRaw = params.get("bittar");

    if (!bastarRaw || !bittarRaw) {
      return json({ success: false, error: "bastar ve bittar tarihleri zorunludur." }, 400);
    }

    const tarih = toWingsmDate(bastarRaw);
    const tarih2 = toWingsmDate(bittarRaw);

    const days = (wingsmToDate(tarih2).getTime() - wingsmToDate(tarih).getTime()) / 86_400_000 + 1;

    if (!Number.isFinite(days) || days < 1) {
      return json({ success: false, error: "Bitiş tarihi başlangıçtan önce olamaz." }, 400);
    }

    if (days > MAX_DAYS) {
      return json({ success: false, error: `Tarih aralığı en fazla ${MAX_DAYS} gün olabilir.` }, 400);
    }

    const kanal = String(params.get("kanal") || "cmr").trim().toLowerCase() === "vodafone" ? "vodafone" : "cmr";
    const channelDepots = kanal === "vodafone" ? VODAFONE_DEPOTS : CMR_DEPOTS;

    const depotParam = String(params.get("depo") || "").trim();
    const depots = depotParam ? channelDepots.filter((depot) => depot.depotCode === depotParam) : channelDepots;

    // İsteğe bağlı: sadece bu mal sınıfındaki satırları incele / puanla (Vodafone: 5AK).
    const sinifFilter = normalizeClass(params.get("sinif"));
    const aktivasyon = params.get("aktivasyon") === "1";

    if (depots.length === 0) {
      return json({ success: false, error: "Geçersiz depo kodu." }, 400);
    }

    const terms = foldText(String(params.get("ara") || ""))
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 6);

    // Depolar paralel, her deponun tarih dilimleri sırayla okunur. Bir depo hata
    // verirse diğerlerinin sonucu yine döner; hata depo durumunda gösterilir.
    const chunks = splitRange(tarih, tarih2);

    const perDepot = await Promise.all(
      depots.map(async ({ depotCode, branchLabel }) => {
        const startedAt = Date.now();
        const rows: Array<Record<string, unknown>> = [];
        let error: string | null = null;

        try {
          for (const chunk of chunks) {
            const result = await wingSMRequest<unknown>(`/api/b2b/satis/list/${encodeURIComponent(depotCode)}`, {
              method: "GET",
              query: aktivasyon ? { ...chunk, aktivasyon: "1" } : chunk,
              timeoutMs: REQUEST_TIMEOUT_MS,
            });

            for (const row of extractRows(result)) {
              rows.push({
                ...(row && typeof row === "object" ? (row as Record<string, unknown>) : { value: row }),
                __depo: depotCode,
                __magaza: branchLabel,
              });
            }
          }
        } catch (err) {
          error = err instanceof Error ? err.message : "Bilinmeyen hata";
        }

        return {
          status: {
            depo: depotCode,
            magaza: branchLabel,
            rowCount: rows.length,
            seconds: Math.round((Date.now() - startedAt) / 100) / 10,
            error,
          },
          rows,
        };
      })
    );

    const depotStatus = perDepot.map((item) => item.status);

    if (depotStatus.every((item) => item.error)) {
      return json({ success: false, error: `WingSM'den veri alınamadı: ${depotStatus[0].error}`, depotStatus }, 502);
    }

    const allRows: Array<Record<string, unknown>> = perDepot.flatMap((item) => item.rows);

    // Alan istatistiği (tüm satırlar üzerinden, arama filtresinden ÖNCE).
    const fieldStats = new Map<string, { filled: number; example: unknown; types: Set<string> }>();

    for (const row of allRows) {
      for (const [key, value] of Object.entries(row)) {
        const stat = fieldStats.get(key) ?? { filled: 0, example: undefined, types: new Set<string>() };
        const filled = value !== null && value !== undefined && String(value).trim() !== "";

        if (filled) {
          stat.filled += 1;
          if (stat.example === undefined) stat.example = value;
          stat.types.add(typeof value);
        }

        fieldStats.set(key, stat);
      }
    }

    const fields = Array.from(fieldStats.entries())
      .map(([name, stat]) => ({
        name,
        filledCount: stat.filled,
        filledPercent: allRows.length > 0 ? Math.round((stat.filled / allRows.length) * 100) : 0,
        example: stat.example ?? null,
        types: Array.from(stat.types),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    // Sınıf özeti (süzmeden ÖNCE): hangi sınıftan kaç satır geldiğini gösterir.
    const classStats = new Map<string, { sinif: string; adi: string; rowCount: number; qty: number }>();

    for (const row of allRows) {
      const sinif = normalizeClass(row.MalSinif) || "(boş)";
      const stat = classStats.get(sinif) ?? { sinif, adi: "", rowCount: 0, qty: 0 };
      stat.rowCount += 1;
      stat.qty += Number(row.MalMiktarI) || 0;
      if (!stat.adi && row.MalSinifAdI) stat.adi = String(row.MalSinifAdI);
      classStats.set(sinif, stat);
    }

    const siniflar = Array.from(classStats.values()).sort((a, b) => b.rowCount - a.rowCount);

    const scopeRows = sinifFilter ? allRows.filter((row) => normalizeClass(row.MalSinif) === sinifFilter) : allRows;

    // Puan özeti (sadece sınıf seçiliyse): satıcı başına SUM(ürün adı son 3 hane x adet).
    // İade yok, adet kadar çarpılır (kullanıcı kuralı). Rakamla bitmeyen satır 0 sayılır.
    let puanOzeti: {
      total: number;
      rowsWithPuan: number;
      rowsWithoutPuan: number;
      withoutPuanExamples: string[];
      adetAlani: string | null;
      byStore: Array<{ magaza: string; puan: number; rowCount: number }>;
      bySeller: Array<{
        magaza: string;
        magazalar: Array<{ magaza: string; puan: number }>;
        saticiKod: string;
        saticiAdi: string;
        rowCount: number;
        qty: number;
        puan: number;
      }>;
    } | null = null;

    if (sinifFilter) {
      const qtyField = detectQtyField(scopeRows);
      const sellers = new Map<
        string,
        { saticiKod: string; saticiAdi: string; rowCount: number; qty: number; puan: number; perStore: Map<string, number> }
      >();
      const stores = new Map<string, { magaza: string; puan: number; rowCount: number }>();
      const examples = new Set<string>();
      let rowsWithPuan = 0;
      let rowsWithoutPuan = 0;
      let total = 0;

      for (const row of scopeRows) {
        const magaza = String(row.__magaza ?? "");
        const saticiKod = String(row.SaticiKod ?? "");
        const saticiAdi = String(row.SaticiAdI ?? "");
        const qtyRaw = qtyField ? Number(row[qtyField]) : NaN;
        const qty = Number.isFinite(qtyRaw) ? qtyRaw : 1;
        const perUnit = parsePuan(row.MalAd);

        if (perUnit === null) {
          rowsWithoutPuan += 1;
          if (examples.size < 10) examples.add(String(row.MalAd ?? ""));
        } else {
          rowsWithPuan += 1;
        }

        const puan = (perUnit ?? 0) * qty;
        total += puan;

        // Kişi İSİMLE tek satırdır: başka mağazada satış yapsa da puanı kendi adına yazılır.
        const sellerKey = personKey(saticiAdi, saticiKod);
        const seller =
          sellers.get(sellerKey) ??
          { saticiKod, saticiAdi, rowCount: 0, qty: 0, puan: 0, perStore: new Map<string, number>() };
        seller.rowCount += 1;
        seller.qty += qty;
        seller.puan += puan;
        seller.perStore.set(magaza, (seller.perStore.get(magaza) ?? 0) + puan);
        sellers.set(sellerKey, seller);

        const store = stores.get(magaza) ?? { magaza, puan: 0, rowCount: 0 };
        store.rowCount += 1;
        store.puan += puan;
        stores.set(magaza, store);
      }

      puanOzeti = {
        total,
        rowsWithPuan,
        rowsWithoutPuan,
        withoutPuanExamples: Array.from(examples),
        adetAlani: qtyField,
        byStore: Array.from(stores.values()).sort((a, b) => b.puan - a.puan),
        bySeller: Array.from(sellers.values())
          .map((seller) => {
            const magazalar = Array.from(seller.perStore.entries())
              .map(([magaza, puan]) => ({ magaza, puan }))
              .sort((a, b) => b.puan - a.puan);

            return {
              magaza: magazalar[0]?.magaza ?? "",
              magazalar,
              saticiKod: seller.saticiKod,
              saticiAdi: seller.saticiAdi,
              rowCount: seller.rowCount,
              qty: seller.qty,
              puan: seller.puan,
            };
          })
          .sort((a, b) => b.puan - a.puan),
      };
    }

    const matched = terms.length === 0 ? scopeRows : scopeRows.filter((row) => terms.every((term) => rowText(row).includes(term)));

    return json({
      success: true,
      period: { tarih, tarih2 },
      depots: depots.map((depot) => depot.depotCode),
      terms,
      kanal,
      sinif: sinifFilter || null,
      aktivasyon,
      depotStatus,
      totalRows: allRows.length,
      scopeRows: scopeRows.length,
      siniflar,
      puanOzeti,
      matchedRows: matched.length,
      returnedRows: Math.min(matched.length, MAX_ROWS_RETURNED),
      fields,
      rows: matched.slice(0, MAX_ROWS_RETURNED),
    });
  } catch (error) {
    if (error instanceof DegerPuanInputError) {
      return json({ success: false, error: error.message }, 400);
    }

    console.error("WINGSM_SATIS_INCELE_ERROR:", error);

    return json(
      { success: false, error: error instanceof Error ? error.message : "Satış verisi alınamadı." },
      500
    );
  }
}
