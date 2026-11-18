// app/lib/garantili/catalog.ts
//
// CNETMOBIL - Garantili katalog (marka / model / hafıza / renk) okuma + WingSM cihazını Garantili id'lerine eşleme
//
// Garantili cihaz eklerken ürün adı değil id ister (marka_id, model_id, hafiza_id, renk_id).
// Katalog /katalog/tumu cevabından okunur; alan adları canlıda henüz görülmediği için ayrıştırma toleranslıdır
// ve ne bulunduğunu `diagnostics` içinde döndürür. Katalog bellekte 6 saat saklanır.
// Eşleme KATI: marka + model birebir (normalize edilmiş) tutmazsa otomatik seçim yapılmaz, elle seçilir.

import { garantiliFetch } from "./server";

export type CatItem = { id: number; name: string; brandId: number | null };

export type GarantiliCatalog = {
  brands: CatItem[];
  models: CatItem[];
  memories: CatItem[];
  colors: CatItem[];
  diagnostics: { topKeys: string[]; counts: Record<string, number>; sampleKeys: Record<string, string[]> };
};

declare global {
  // eslint-disable-next-line no-var
  var cnetGarantiliCatalog: { at: number; catalog: GarantiliCatalog } | undefined;
}

const TTL_MS = 6 * 60 * 60 * 1000;
const NAME_KEYS = ["ad", "adi", "isim", "name", "baslik", "title", "marka", "model", "hafiza", "renk", "deger", "value", "label"];

export function norm(value: unknown): string {
  return String(value ?? "")
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .replace(/[^a-z0-9]+/g, "");
}

function itemName(item: any): string {
  if (typeof item === "string") return item.trim();

  for (const key of NAME_KEYS) {
    if (typeof item?.[key] === "string" && item[key].trim()) return item[key].trim();
  }

  for (const [key, value] of Object.entries(item ?? {})) {
    if (typeof value === "string" && value.trim() && !/id$|tarih|durum|resim|gorsel|logo|url|kod|slug/i.test(key)) return value.trim();
  }

  return "";
}

function itemId(item: any): number | null {
  const value = Number(item?.id ?? item?.value ?? item?.deger_id);

  return Number.isFinite(value) && value > 0 ? value : null;
}

function toItems(list: any[]): CatItem[] {
  const out: CatItem[] = [];

  for (const item of list) {
    const id = itemId(item);
    const name = itemName(item);

    if (id === null || !name) continue;

    const brand = Number(item?.marka_id);

    out.push({ id, name, brandId: Number.isFinite(brand) && brand > 0 ? brand : null });
  }

  return out;
}

export function parseCatalog(body: any): GarantiliCatalog {
  const data = body?.data && typeof body.data === "object" ? body.data : {};
  const found: Record<"brands" | "models" | "memories" | "colors", any[]> = { brands: [], models: [], memories: [], colors: [] };

  for (const [key, value] of Object.entries(data)) {
    if (!Array.isArray(value)) continue;

    if (/renk/i.test(key)) found.colors = value;
    else if (/hafiza/i.test(key)) found.memories = value;
    else if (/model/i.test(key)) found.models = value;
    else if (/marka/i.test(key)) found.brands = value;
  }

  const sampleKeys: Record<string, string[]> = {};

  for (const [name, list] of Object.entries(found)) sampleKeys[name] = list[0] && typeof list[0] === "object" ? Object.keys(list[0]).slice(0, 15) : [];

  return {
    brands: toItems(found.brands),
    models: toItems(found.models),
    memories: toItems(found.memories),
    colors: toItems(found.colors),
    diagnostics: {
      topKeys: Object.keys(data).slice(0, 25),
      counts: { brands: found.brands.length, models: found.models.length, memories: found.memories.length, colors: found.colors.length },
      sampleKeys,
    },
  };
}

export async function getGarantiliCatalog(force = false): Promise<GarantiliCatalog> {
  const cached = globalThis.cnetGarantiliCatalog;

  if (!force && cached && Date.now() - cached.at < TTL_MS) return cached.catalog;

  const result = await garantiliFetch("/katalog/tumu", { query: { tur: 1, eslesme: 0 }, timeoutMs: 30_000 });

  if (!result.ok) throw new Error(result.body?.message || `Garantili katalog HTTP ${result.status}`);

  const catalog = parseCatalog(result.body);

  globalThis.cnetGarantiliCatalog = { at: Date.now(), catalog };

  return catalog;
}

// "128 GB" / "128GB" / "1 TB" -> "128gb" / "1tb"
export function normMemory(value: unknown): string {
  const match = String(value ?? "").toLocaleLowerCase("tr-TR").match(/(\d+)\s*(gb|tb)/);

  return match ? `${match[1]}${match[2]}` : norm(value);
}

export type MatchIds = { markaId: number | null; modelId: number | null; hafizaId: number | null; renkId: number | null };

// Marka + model birebir tutmalı; hafıza ve renk birebir tutarsa seçilir, yoksa null (elle seçilir).
export function matchDevice(catalog: GarantiliCatalog, device: { brand: string; model: string; memory: string; color: string }): MatchIds {
  const brandKey = norm(device.brand);
  const brand = catalog.brands.find((item) => norm(item.name) === brandKey) ?? null;
  const strip = (value: string) => (brandKey && norm(value).startsWith(brandKey) ? norm(value).slice(brandKey.length) : norm(value));
  const modelKey = strip(device.model);
  const model = brand ? catalog.models.find((item) => (item.brandId === null || item.brandId === brand.id) && strip(item.name) === modelKey) ?? null : null;
  const memoryKey = normMemory(device.memory);
  const memory = memoryKey ? catalog.memories.find((item) => normMemory(item.name) === memoryKey) ?? null : null;
  const colorKey = norm(device.color);
  const color = colorKey ? catalog.colors.find((item) => norm(item.name) === colorKey) ?? null : null;

  return { markaId: brand?.id ?? null, modelId: model?.id ?? null, hafizaId: memory?.id ?? null, renkId: color?.id ?? null };
}
