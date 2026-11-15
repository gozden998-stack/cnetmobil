// app/lib/hepsiburada/open.ts
//
// CNETMOBIL - WingSM sıfır ürünü Hepsiburada'ya AÇMA (hızlı ürün ekleme)
//
// POST {catalog}/api/products/fastlisting  gövde: [{ merchant, merchantSku, productName, barcode, stock, price, itemOrderID }]
//   merchantSku = WingSM ürün kodu (MalKod): sonradan listing'de stok kodu olarak görünür, eşleşme kendiliğinden olur.
//   barcode     = ürünün GERÇEK barkodu (EAN/GTIN). Hepsiburada ürünü kataloğunda bu barkodla bulur; yanlış barkod yanlış ürünle
//                 eşleşmeye yol açar, bu yüzden sağlama basamağı doğrulanmadan GÖNDERİLMEZ.
// Sonuç GET {catalog}/api/products/status/{trackingId} ile sorgulanır.
// Her gönderim public.hepsiburada_open_log'a yazılır; aynı ürün için kısa sürede ikinci gönderim engellenir.

import type { Pool } from "pg";

import { HEPSIBURADA_CATALOG_BASE, getHepsiburadaConfig, hepsiburadaFetch } from "./server";

let logReady = false;

export async function ensureOpenLog(pool: Pool) {
  if (logReady) return;

  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.hepsiburada_open_log (
      id BIGSERIAL PRIMARY KEY,
      mal_kod TEXT NOT NULL,
      barkod TEXT NOT NULL,
      price NUMERIC,
      stock INTEGER,
      http_status INTEGER,
      tracking_id TEXT,
      response TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  logReady = true;
}

// GTIN-8/12/13/14 sağlama basamağı (son hane): ağırlıklar sağdan 3,1,3,1...
export function isValidGtin(value: string): boolean {
  if (!/^\d+$/.test(value) || ![8, 12, 13, 14].includes(value.length)) return false;

  const digits = value.split("").map(Number);
  const check = digits.pop() as number;
  let sum = 0;

  digits.reverse().forEach((digit, index) => {
    sum += digit * (index % 2 === 0 ? 3 : 1);
  });

  return (10 - (sum % 10)) % 10 === check;
}

// Cevapta (iç içe olabilir) trackingId ara.
export function findTrackingId(body: any, depth = 0): string | null {
  if (!body || typeof body !== "object" || depth > 4) return null;

  for (const [key, value] of Object.entries(body)) {
    if (/tracking/i.test(key) && (typeof value === "string" || typeof value === "number") && String(value).trim()) return String(value).trim();
  }

  for (const value of Object.values(body)) {
    const found = findTrackingId(value, depth + 1);

    if (found) return found;
  }

  return null;
}

export type OpenInput = { malKod: string; productName: string; barcode: string; stock: number; price: number };

export async function openOnHepsiburada(pool: Pool, input: OpenInput) {
  const config = getHepsiburadaConfig();

  if (!config) throw new Error("Hepsiburada ortam değişkenleri eksik.");
  if (!isValidGtin(input.barcode)) throw new Error(`Barkod geçersiz (sağlama basamağı tutmuyor): ${input.barcode}. WingSM'deki barkodu kontrol edin.`);
  if (!/^[A-Za-z0-9._-]+$/.test(input.malKod)) throw new Error("Ürün kodu boşluk ya da özel karakter içeriyor, stok kodu olarak kullanılamaz.");
  if (!Number.isInteger(input.stock) || input.stock < 0) throw new Error("Stok 0 veya daha büyük tam sayı olmalı.");
  if (!Number.isFinite(input.price) || input.price <= 0) throw new Error("Fiyat 0'dan büyük olmalı.");

  await ensureOpenLog(pool);

  const recent = await pool.query(
    `SELECT id FROM public.hepsiburada_open_log WHERE mal_kod = $1 AND http_status BETWEEN 200 AND 299 AND created_at > now() - interval '1 day' LIMIT 1`,
    [input.malKod]
  );

  if (recent.rowCount) throw new Error("Bu ürün son 24 saatte zaten gönderilmiş. Sonucu durum sorgusuyla kontrol edin.");

  // Hepsiburada merchantSku'yu büyük harfe çevirir; baştan büyük gönderiyoruz.
  const body = [
    {
      merchant: config.merchantId,
      merchantSku: input.malKod.toUpperCase(),
      productName: input.productName,
      barcode: input.barcode,
      stock: String(input.stock),
      price: input.price.toFixed(2),
      itemOrderID: 1,
    },
  ];

  const result = await hepsiburadaFetch(HEPSIBURADA_CATALOG_BASE, "/api/products/fastlisting", { method: "POST", body });
  const trackingId = findTrackingId(result.body);

  await pool.query(
    `INSERT INTO public.hepsiburada_open_log (mal_kod, barkod, price, stock, http_status, tracking_id, response) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [input.malKod, input.barcode, input.price, input.stock, result.status, trackingId, result.raw.slice(0, 2000)]
  );

  return { ok: result.ok, status: result.status, trackingId, response: result.body ?? result.raw.slice(0, 500) };
}

export async function fastListingStatus(trackingId: string) {
  const result = await hepsiburadaFetch(HEPSIBURADA_CATALOG_BASE, `/api/products/status/${encodeURIComponent(trackingId)}`, { query: { version: 1, page: 0, size: 10 } });
  const rows: any[] = Array.isArray(result.body?.data) ? result.body.data : [];

  return {
    ok: result.ok,
    status: result.status,
    message: result.body?.message ?? null,
    items: rows.map((row) => ({
      merchantSku: row?.merchantSku ?? null,
      hbSku: row?.hbSku ?? null,
      barcode: row?.barcode ?? null,
      productStatus: row?.productStatus ?? null,
      importStatus: row?.importStatus ?? null,
      importMessages: Array.isArray(row?.importMessages) ? row.importMessages.slice(0, 5) : [],
      rejectReasons: Array.isArray(row?.rejectReasonsMessages) ? row.rejectReasonsMessages.slice(0, 5) : [],
      validation: Array.isArray(row?.validationResults) ? row.validationResults.slice(0, 5) : [],
    })),
    raw: result.ok ? null : result.raw.slice(0, 400),
  };
}
