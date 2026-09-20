// app/api/online/idefix/create-device/route.ts
// CNETMOBIL - IDEFIX "Yeni Ürün Aç" (tek cihaz, Merkez bağımsız)
//
// N11'in "Yeni Ürün Aç" akışının İdefix karşılığı.
// Girdi doğrudan formdan gelir (IMEI, marka, model, hafıza, renk, grade,
// garanti, satış/liste fiyatı). public.stock_devices / public.online_channel_devices
// tablolarına HİÇ dokunmaz — N11 create akışıyla aynı felsefe:
// "stock_devices / WingSM bagimliligi YOK".
//
// İdefix katalog modeli serbest ürün açmaya izin vermez:
// - Aynı marka/model/hafıza/renk/grade için İdefix'te zaten ürün varsa,
//   yeni katalog kaydı açılmaz; mevcut ürüne stok eklenir (+1).
// - Aynı renk yoksa, aynı model/hafıza/grade'in FARKLI renkteki kardeş
//   ürünü referans alınır (brand/category/attribute şablonu ondan miras
//   alınır) ve yeni bir katalog kaydı (yeni renk varyantı) açılır.
// - Referans ürün yoksa: otomatik ürün açılmaz (belirsiz katalog referansı).
//
// Eşleştirme / oluşturma mantığı `center-send/route.ts` dosyasındaki
// battle-tested saf fonksiyonlardan KOPYALANMIŞTIR (taşınmamıştır).
// center-send/route.ts bu dosyadan etkilenmez ve değiştirilmemiştir.
//
// Güvenlik:
// - IMEI 15 hane olmalı, aynı IMEI ile ikinci kez İdefix ürünü açılamaz.
// - Eksik marka/model/hafıza/renk/grade/garanti engellenir.
// - Belirsiz katalog referansında (kardeş ürün yok) otomatik ürün açılmaz.
// - Renk attribute'u kategori şemasında bulunamazsa ürün açılmaz.
// - Hedef renk için N11/İkas ilanlarından doğrulanmış görsel bulunamazsa
//   ürün açılmaz.
// - İdefix dış işlem başarılı olup DB yazımı başarısız olursa net hata
//   döner (yerel kayıt sessizce kaybolmaz).

import { NextRequest } from "next/server";
import crypto from "crypto";
import type { PoolClient } from "pg";

import {
  getIdefixDbPool,
  getIdefixProducts,
  getIdefixVendorId,
  getIdefixVendorToken,
  IDEFIX_BASE_URL,
  noStoreJson,
  requireIdefixSuperAdmin,
} from "@/app/lib/idefix/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

// ============================================================
// Tipler
// ============================================================

type IdefixProduct = {
  barcode?: string | null;
  title?: string | null;
  productMainId?: string | null;
  brandId?: number | string | null;
  categoryId?: number | string | null;
  inventoryQuantity?: number | string | null;
  vendorStockCode?: string | null;
  weight?: number | string | null;
  description?: string | null;
  price?: number | string | null;
  comparePrice?: number | string | null;
  vatRate?: number | string | null;
  deliveryDuration?: number | string | null;
  deliveryType?: string | null;
  cargoCompanyId?: number | string | null;
  shipmentAddressId?: number | string | null;
  returnAddressId?: number | string | null;
  images?: Array<{ url?: string | null }> | null;
  attributes?: Array<{
    attributeId?: number | string | null;
    attributeValueId?: number | string | null;
    customAttributeValue?: string | null;
  }> | null;
  status?: string | null;
  state?: string | null;
  reference?: number | string | null;
  matchedProduct?: any;
  failureReasons?: any;
  [key: string]: unknown;
};

type CategoryAttribute = {
  attributeId: number | string;
  attributeTitle?: string | null;
  allowCustom?: boolean | null;
  required?: boolean | null;
  isVariant?: boolean | null;
  isSlicer?: boolean | null;
  attributeValues?: Array<{ id?: number | string | null; name?: string | null }> | null;
};

// Merkez'deki CenterGroup'un tek-cihaz karşılığı.
// Not: buildGroups/selectedDevices/validateDevices/groupKey KASITLI OLARAK
// kopyalanmadı; bu akışta public.stock_devices hiç okunmuyor.
type DeviceGroup = {
  brand: string;
  model: string;
  memory: string;
  color: string;
  grade: string;
  warranty: string;
};

type PreparedDevice = {
  group: DeviceGroup;
  imei: string;
  action: "EXISTING_PRODUCT" | "CREATE_PRODUCT";
  exactProduct: IdefixProduct | null;
  referenceProduct: IdefixProduct | null;
  title: string;
  salePrice: number;
  listPrice: number;
  targetBeforeStock: number;
  targetAfterStock: number;
  barcode: string;
  vendorStockCode: string;
  productMainId: string;
  brandId: number | string | null;
  categoryId: number | string | null;
  vatRate: number | null;
  imageUrl: string | null;
  attributes: Array<{
    attributeId: number | string;
    attributeValueId: number | string | null;
    customAttributeValue: string | null;
  }>;
};

const idefixCategoryAttributeCache = new Map<string, Promise<CategoryAttribute[]>>();

// ============================================================
// Saf metin / normalizasyon yardımcıları
// (center-send/route.ts'den KOPYALANDI)
// ============================================================

function text(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeText(value: unknown) {
  return text(value)
    .toLocaleUpperCase("tr-TR")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeGrade(value: unknown) {
  const v = normalizeText(value);

  if (v === "A" || v === "A KALITE" || v === "A GRADE" || v === "GRADE A" || v.includes("MUKEMMEL")) {
    return "A";
  }

  if (v === "B" || v === "B KALITE" || v === "B GRADE" || v === "GRADE B" || v.includes("COK IYI")) {
    return "B";
  }

  if (v === "C" || v === "C KALITE" || v === "C GRADE" || v === "GRADE C" || v === "IYI") {
    return "C";
  }

  return v;
}

function normalizeMemory(value: unknown) {
  return normalizeText(value).replace(/(\d+(?:[.,]\d+)?)\s*(GB|TB)\b/g, "$1 $2");
}

function containsPhrase(haystack: unknown, needle: unknown) {
  const h = ` ${normalizeText(haystack)} `;
  const n = ` ${normalizeText(needle)} `;

  return normalizeText(needle) ? h.includes(n) : false;
}

function colorAliases(value: unknown) {
  const color = normalizeText(value);

  const map: Record<string, string[]> = {
    KIRMIZI: ["KIRMIZI", "RED", "PRODUCT RED"],
    SIYAH: ["SIYAH", "BLACK"],
    BEYAZ: ["BEYAZ", "WHITE"],
    MAVI: ["MAVI", "BLUE"],
    YESIL: ["YESIL", "GREEN"],
    MOR: ["MOR", "PURPLE"],
    SARI: ["SARI", "YELLOW"],
    PEMBE: ["PEMBE", "PINK"],
    GRI: ["GRI", "GRAY", "GREY"],
    GUMUS: ["GUMUS", "SILVER"],
    ALTIN: ["ALTIN", "GOLD"],
    LACIVERT: ["LACIVERT", "NAVY", "NAVY BLUE"],
  };

  return Array.from(new Set(map[color] || [color])).filter(Boolean);
}

function matchedColorAlias(title: unknown, color: unknown) {
  return colorAliases(color).find((alias) => containsPhrase(title, alias)) || null;
}

function detectGradeFromTitle(title: unknown) {
  const t = normalizeText(title);

  if (
    containsPhrase(t, "B KALITE") ||
    containsPhrase(t, "B GRADE") ||
    containsPhrase(t, "GRADE B") ||
    containsPhrase(t, "COK IYI")
  ) {
    return "B";
  }

  if (
    containsPhrase(t, "A KALITE") ||
    containsPhrase(t, "A GRADE") ||
    containsPhrase(t, "GRADE A") ||
    containsPhrase(t, "MUKEMMEL")
  ) {
    return "A";
  }

  if (
    containsPhrase(t, "C KALITE") ||
    containsPhrase(t, "C GRADE") ||
    containsPhrase(t, "GRADE C") ||
    containsPhrase(t, "IYI")
  ) {
    return "C";
  }

  return null;
}

function numberOrNull(value: unknown) {
  if (value === null || value === undefined || text(value) === "") {
    return null;
  }

  const n = Number(value);

  return Number.isFinite(n) ? n : null;
}

function money(value: unknown, label: string) {
  if (typeof value === "number" && Number.isFinite(value)) {
    if (value <= 0) {
      throw new Error(`${label} 0'dan büyük olmalıdır.`);
    }

    return Math.round(value * 100) / 100;
  }

  let raw = text(value);

  if (!raw) {
    throw new Error(`${label} zorunludur.`);
  }

  raw = raw.replace(/[^\d,.-]/g, "");

  const comma = raw.lastIndexOf(",");
  const dot = raw.lastIndexOf(".");

  if (comma > dot) {
    raw = raw.replace(/\./g, "").replace(",", ".");
  } else {
    raw = raw.replace(/,/g, "");
  }

  const n = Number(raw);

  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`${label} geçersiz.`);
  }

  return Math.round(n * 100) / 100;
}

function stableHash(value: string, length = 20) {
  return crypto.createHash("sha256").update(value).digest("hex").toUpperCase().slice(0, length);
}

// NOT: center-send'in makeStableBarcode'u GRUP bazlıdır (aynı grup =
// aynı barkod, çoklu Merkez cihazı aynı İdefix ürününe stok ekler).
// Bu akışta stock_devices yok ve her istek "yeni bir mantıksal birim"
// (N11'in stockCode = IMEI kuralına paralel). Bu yüzden barkod/stok kodu
// bilerek IMEI'yi de içerir: aynı IMEI ile retry idempotent kalır, farklı
// IMEI'li aynı marka/model/hafıza/renk/grade/garanti cihazları ise
// birbirine çarpmaz.
function makeCreateBarcode(imei: string, group: DeviceGroup) {
  return `CNETIDF${stableHash(
    [imei, group.brand, group.model, group.memory, group.color, group.grade, group.warranty]
      .map(normalizeText)
      .join("|"),
    18
  )}`;
}

function makeVendorStockCode(imei: string) {
  return `CNET-IDF-${imei}`;
}

function makeProductMainId(group: DeviceGroup) {
  // Renk hariç aile kodu (center-send ile aynı kural):
  // Aynı model/hafıza/grade/garanti farklı renkleri aynı ailede tutulabilir.
  return `CNET-IDF-PM-${stableHash(
    [group.brand, group.model, group.memory, group.grade, group.warranty].map(normalizeText).join("|"),
    16
  )}`;
}

function productTitle(group: DeviceGroup) {
  const gradeLabel =
    normalizeGrade(group.grade) === "A"
      ? "A Kalite"
      : normalizeGrade(group.grade) === "B"
      ? "B Kalite"
      : normalizeGrade(group.grade) === "C"
      ? "C Kalite"
      : group.grade;

  return [group.brand, "Yenilenmiş", group.model, group.memory, "-", group.color, "-", gradeLabel, `(${group.warranty} Garantili)`]
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function productKey(product: IdefixProduct) {
  return (
    text(product.barcode) ||
    [text(product.productMainId), text(product.vendorStockCode), normalizeText(product.title)].join("|")
  );
}

// ============================================================
// İdefix HTTP yardımcıları (center-send/route.ts'den KOPYALANDI)
// ============================================================

async function idefixApi(
  path: string,
  options?: { method?: "GET" | "POST"; body?: unknown; timeoutMs?: number }
) {
  const token = getIdefixVendorToken();

  const controller = new AbortController();

  const timeout = setTimeout(() => controller.abort(), options?.timeoutMs ?? 35_000);

  try {
    const response = await fetch(`${IDEFIX_BASE_URL}${path}`, {
      method: options?.method || "GET",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-API-KEY": token,
      },
      body: options?.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
    });

    const raw = await response.text();

    let payload: any = null;

    if (raw) {
      try {
        payload = JSON.parse(raw);
      } catch {
        payload = { raw };
      }
    }

    if (!response.ok) {
      const apiMessage =
        text(payload?.message) || text(payload?.error) || text(payload?.errors?.[0]?.message);

      let payloadDetail = "";

      if (payload !== null && payload !== undefined) {
        try {
          payloadDetail = typeof payload === "string" ? payload : JSON.stringify(payload);
        } catch {
          payloadDetail = String(payload);
        }
      }

      const detail = apiMessage || payloadDetail || raw || "Response body boş.";

      throw new Error(`İdefix HTTP ${response.status} [${options?.method || "GET"} ${path}]: ${detail}`);
    }

    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

function pickIdefixProducts(payload: any): IdefixProduct[] {
  const rows =
    payload?.products ??
    payload?.items ??
    payload?.content ??
    payload?.data?.products ??
    payload?.data?.items ??
    payload?.data?.content ??
    [];

  return Array.isArray(rows) ? rows : [];
}

async function fetchAllProducts() {
  const rows: IdefixProduct[] = [];
  const seen = new Set<string>();
  const pageSignatures = new Set<string>();
  const limit = 50;

  for (let page = 1; page <= 100; page += 1) {
    const payload: any = await getIdefixProducts(page, limit);
    const products = pickIdefixProducts(payload);

    if (products.length === 0) {
      break;
    }

    const signature = products.map((product: any) => productKey(product)).join("||");

    if (pageSignatures.has(signature)) {
      break;
    }

    pageSignatures.add(signature);

    for (const product of products) {
      const key = productKey(product);

      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      rows.push(product);
    }

    if (products.length < limit) {
      break;
    }
  }

  return rows;
}

// ============================================================
// Başlık / renk / hafıza eşleştirme yardımcıları
// (center-send/route.ts'den KOPYALANDI)
// ============================================================

function automaticIdefixBarcode(product: IdefixProduct | null | undefined) {
  const candidates = [product?.barcode, product?.matchedProduct?.barcode]
    .map((value) => text(value))
    .filter(Boolean);

  return Array.from(new Set(candidates))[0] || "";
}

function productIdentityText(product: IdefixProduct) {
  return [
    product?.title,
    product?.productMainId,
    product?.matchedProduct?.name,
    product?.matchedProduct?.slug,
    product?.matchedProduct?.productMainId,
  ]
    .map((value) => text(value))
    .filter(Boolean)
    .join(" ");
}

function normalizedTokens(value: unknown) {
  return normalizeText(value).split(" ").filter(Boolean);
}

function compactNormalized(value: unknown) {
  return normalizeText(value).replace(/\s+/g, "");
}

function modelMatchesTitle(title: unknown, model: unknown) {
  const titleTokens = normalizedTokens(title);
  const modelTokens = normalizedTokens(model);

  if (modelTokens.length === 0) {
    return false;
  }

  let startIndex = -1;

  for (let i = 0; i <= titleTokens.length - modelTokens.length; i += 1) {
    let same = true;

    for (let j = 0; j < modelTokens.length; j += 1) {
      if (titleTokens[i + j] !== modelTokens[j]) {
        same = false;
        break;
      }
    }

    if (same) {
      startIndex = i;
      break;
    }
  }

  if (startIndex < 0) {
    return false;
  }

  const variantTokens = new Set(["PRO", "MAX", "MINI", "PLUS", "ULTRA", "FE", "LITE"]);
  const nextToken = titleTokens[startIndex + modelTokens.length] || "";

  if (variantTokens.has(nextToken) && !modelTokens.includes(nextToken)) {
    return false;
  }

  return true;
}

function memoryMatchesTitle(title: unknown, memory: unknown) {
  const memoryNormalized = normalizeMemory(memory);

  if (!memoryNormalized) {
    return false;
  }

  const titleCompact = compactNormalized(title);
  const memoryCompact = compactNormalized(memoryNormalized);

  if (titleCompact.includes(memoryCompact)) {
    return true;
  }

  const numericOnly = memoryNormalized.match(/^\d+(?:[.,]\d+)?$/);

  if (numericOnly) {
    const number = numericOnly[0].replace(",", ".");

    return titleCompact.includes(`${number}GB`) || titleCompact.includes(`${number}TB`);
  }

  return false;
}

function baseIdentityMatchesTitle(title: unknown, group: DeviceGroup) {
  return (
    containsPhrase(title, group.brand) &&
    modelMatchesTitle(title, group.model) &&
    memoryMatchesTitle(title, group.memory)
  );
}

function idefixProductState(product: IdefixProduct | null | undefined) {
  return normalizeText(product?.status ?? product?.state);
}

function isIdefixReadyForSale(product: IdefixProduct | null | undefined) {
  return idefixProductState(product) === "READY FOR SALE";
}

async function productLooksLikeGroup(product: IdefixProduct, group: DeviceGroup, allowMissingGrade = false) {
  const identity = productIdentityText(product);

  if (!containsPhrase(identity, group.brand) || !modelMatchesTitle(identity, group.model)) {
    return false;
  }

  const facts = await structuredProductFacts(product);

  const memoryMatches = facts.memory
    ? memoryValueMatches(facts.memory, group.memory)
    : memoryMatchesTitle(identity, group.memory);

  if (!memoryMatches) {
    return false;
  }

  const colorMatches = facts.color
    ? colorValueMatches(facts.color, group.color)
    : Boolean(matchedColorAlias(identity, group.color));

  if (!colorMatches) {
    return false;
  }

  const structuredGrade = facts.grade ? normalizeGrade(facts.grade) : null;
  const titleGrade = detectGradeFromTitle(identity);
  const detectedGrade = structuredGrade || titleGrade;

  if (detectedGrade) {
    return detectedGrade === normalizeGrade(group.grade);
  }

  return allowMissingGrade;
}

async function relaxedProductForGroup(products: IdefixProduct[], group: DeviceGroup) {
  const candidates: IdefixProduct[] = [];

  for (const product of products) {
    if (await productLooksLikeGroup(product, group, true)) {
      candidates.push(product);
    }
  }

  const distinct = new Map<string, IdefixProduct>();

  for (const product of candidates) {
    distinct.set(productKey(product), product);
  }

  if (distinct.size === 1) {
    return Array.from(distinct.values())[0] || null;
  }

  return null;
}

async function exactProductForGroup(products: IdefixProduct[], group: DeviceGroup) {
  const matches: IdefixProduct[] = [];

  for (const product of products) {
    if (await productLooksLikeGroup(product, group, false)) {
      matches.push(product);
    }
  }

  if (matches.length > 1) {
    const distinct = new Map<string, IdefixProduct>();

    for (const product of matches) {
      distinct.set(productKey(product), product);
    }

    if (distinct.size > 1) {
      throw new Error(
        `${productTitle(group)}: İdefix'te aynı model/hafıza/renk/kalite için birden fazla ürün bulundu. Yanlış barkod seçmemek için otomatik gönderim durduruldu.`
      );
    }
  }

  return matches[0] || null;
}

function referenceProductForGroup(products: IdefixProduct[], group: DeviceGroup) {
  const grade = normalizeGrade(group.grade);

  const candidates = products
    .map((product) => {
      const title = product.title;

      if (!baseIdentityMatchesTitle(title, group) || detectGradeFromTitle(title) !== grade) {
        return null;
      }

      let score = 100;

      if (containsPhrase(title, "YENILENMIS")) {
        score += 10;
      }

      if (text(product.brandId)) {
        score += 10;
      }

      if (text(product.categoryId)) {
        score += 10;
      }

      if (Array.isArray(product.attributes) && product.attributes.length > 0) {
        score += 10;
      }

      if (numberOrNull(product.vatRate) !== null) {
        score += 5;
      }

      return { product, score };
    })
    .filter(Boolean)
    .sort((a: any, b: any) => b.score - a.score) as Array<{ product: IdefixProduct; score: number }>;

  if (candidates.length === 0) {
    return null;
  }

  const first = candidates[0];
  const top = candidates.filter((candidate) => candidate.score === first.score);

  const uniqueTargets = new Set(
    top.map((candidate) => [text(candidate.product.brandId), text(candidate.product.categoryId)].join("|"))
  );

  if (uniqueTargets.size > 1) {
    throw new Error(
      `${productTitle(group)}: aynı model için farklı İdefix brand/category referansları bulundu. Yeni ürün oluşturma durduruldu.`
    );
  }

  return first.product;
}

// ============================================================
// Kategori attribute yardımcıları (center-send/route.ts'den KOPYALANDI)
// ============================================================

async function categoryAttributes(categoryId: string | number) {
  const payload = await idefixApi(`/pim/category-attribute/${encodeURIComponent(String(categoryId))}`);

  return Array.isArray(payload?.categoryAttributes)
    ? (payload.categoryAttributes as CategoryAttribute[])
    : [];
}

function attributeById(product: IdefixProduct, attributeId: unknown) {
  const attributes = Array.isArray(product.attributes) ? product.attributes : [];

  return (
    attributes.find((attribute) => String(attribute?.attributeId ?? "") === String(attributeId ?? "")) || null
  );
}

function attributeValueName(product: IdefixProduct, definition: CategoryAttribute) {
  const selected = attributeById(product, definition.attributeId);

  if (!selected) {
    return null;
  }

  const custom = text(selected.customAttributeValue);

  if (custom) {
    return custom;
  }

  const selectedId = text(selected.attributeValueId);

  if (!selectedId) {
    return null;
  }

  const values = Array.isArray(definition.attributeValues) ? definition.attributeValues : [];
  const value = values.find((item) => text(item?.id) === selectedId);

  return text(value?.name) || null;
}

async function cachedCategoryAttributes(categoryId: string | number) {
  const key = String(categoryId);

  let pending = idefixCategoryAttributeCache.get(key);

  if (!pending) {
    pending = categoryAttributes(categoryId);
    idefixCategoryAttributeCache.set(key, pending);
  }

  try {
    return await pending;
  } catch (error) {
    idefixCategoryAttributeCache.delete(key);
    throw error;
  }
}

async function structuredProductFacts(product: IdefixProduct) {
  const categoryId = text(product.categoryId);

  if (!categoryId || !Array.isArray(product.attributes) || product.attributes.length === 0) {
    return { color: null as string | null, memory: null as string | null, grade: null as string | null, warranty: null as string | null };
  }

  let definitions: CategoryAttribute[] = [];

  try {
    definitions = await cachedCategoryAttributes(categoryId);
  } catch {
    return { color: null as string | null, memory: null as string | null, grade: null as string | null, warranty: null as string | null };
  }

  let color: string | null = null;
  let memory: string | null = null;
  let grade: string | null = null;
  let warranty: string | null = null;

  for (const definition of definitions) {
    const value = attributeValueName(product, definition);

    if (!value) {
      continue;
    }

    if (!color && isColorAttribute(definition)) {
      color = value;
      continue;
    }

    if (!memory && isMemoryAttribute(definition)) {
      memory = value;
      continue;
    }

    if (!grade && isCosmeticAttribute(definition)) {
      grade = value;
      continue;
    }

    if (!warranty && isWarrantyAttribute(definition)) {
      warranty = value;
    }
  }

  return { color, memory, grade, warranty };
}

function colorValueMatches(actual: unknown, desired: unknown) {
  const actualNormalized = normalizeText(actual);

  if (!actualNormalized) {
    return false;
  }

  return colorAliases(desired).some(
    (alias) => actualNormalized === normalizeText(alias) || containsPhrase(actualNormalized, alias)
  );
}

function memoryValueMatches(actual: unknown, desired: unknown) {
  const a = compactNormalized(normalizeMemory(actual));
  const d = compactNormalized(normalizeMemory(desired));

  if (!a || !d) {
    return false;
  }

  return a === d || a.includes(d) || d.includes(a);
}

function isColorAttribute(attribute: CategoryAttribute) {
  const title = normalizeText(attribute.attributeTitle);
  return title === "RENK" || title.includes("RENK") || title === "COLOR" || title.includes("COLOR");
}

function isCosmeticAttribute(attribute: CategoryAttribute) {
  const title = normalizeText(attribute.attributeTitle);
  return (
    title.includes("KOZMETIK") ||
    title === "KALITE" ||
    title.includes("KALITE DURUM") ||
    title.includes("URUN DURUMU")
  );
}

function isMemoryAttribute(attribute: CategoryAttribute) {
  const title = normalizeText(attribute.attributeTitle);
  return title.includes("DAHILI HAFIZA") || title === "HAFIZA" || title.includes("DEPOLAMA") || title.includes("KAPASITE");
}

function isWarrantyAttribute(attribute: CategoryAttribute) {
  const title = normalizeText(attribute.attributeTitle);
  return title.includes("GARANTI");
}

function pickAttributeValueByAliases(attribute: CategoryAttribute, aliases: string[], customFallback?: string) {
  if (attribute.allowCustom === true) {
    const custom = text(customFallback || aliases[0]);

    if (!custom) {
      return null;
    }

    return { attributeId: attribute.attributeId, attributeValueId: null, customAttributeValue: custom };
  }

  const values = Array.isArray(attribute.attributeValues) ? attribute.attributeValues : [];
  const normalizedAliases = aliases.map(normalizeText).filter(Boolean);

  let selected = values.find((value) => normalizedAliases.includes(normalizeText(value?.name)));

  if (!selected) {
    selected = values.find((value) => {
      const name = normalizeText(value?.name);

      if (!name) {
        return false;
      }

      return normalizedAliases.some(
        (alias) => alias.length >= 3 && (containsPhrase(name, alias) || containsPhrase(alias, name))
      );
    });
  }

  if (selected?.id === null || selected?.id === undefined || text(selected?.id) === "") {
    return null;
  }

  return { attributeId: attribute.attributeId, attributeValueId: selected.id, customAttributeValue: null };
}

function colorAttributeValue(attribute: CategoryAttribute, color: string) {
  return pickAttributeValueByAliases(attribute, colorAliases(color), color);
}

function cosmeticAliases(grade: string) {
  const normalized = normalizeGrade(grade);

  if (normalized === "A") {
    return ["A", "A KALITE", "MUKEMMEL", "MUKEMMEL DURUM", "YENI GIBI"];
  }

  if (normalized === "B") {
    return ["B", "B KALITE", "COK IYI", "COK IYI DURUM"];
  }

  if (normalized === "C") {
    return ["C", "C KALITE", "IYI", "IYI DURUM"];
  }

  return [normalized].filter(Boolean);
}

function memoryAliases(memory: string) {
  const normalized = normalizeMemory(memory);
  const compact = normalized.replace(/\s+/g, "");

  return Array.from(new Set([normalized, compact, text(memory)])).filter(Boolean);
}

function warrantyAliases(warranty: string) {
  const normalized = normalizeText(warranty);
  const aliases = new Set<string>([normalized, text(warranty)]);

  const monthMatch = normalized.match(/(\d+)\s*AY/);

  if (monthMatch) {
    const months = Number(monthMatch[1]);

    aliases.add(`${months} AY`);
    aliases.add(`${months} AY GARANTI`);
    aliases.add(`${months} AY GARANTILI`);

    if (months === 12) {
      aliases.add("1 YIL");
      aliases.add("1 YIL GARANTI");
      aliases.add("1 YIL GARANTILI");
    }

    if (months === 24) {
      aliases.add("2 YIL");
      aliases.add("2 YIL GARANTI");
      aliases.add("2 YIL GARANTILI");
    }
  }

  return Array.from(aliases).filter(Boolean);
}

function derivedRequiredAttributeValue(attribute: CategoryAttribute, group: DeviceGroup) {
  if (isCosmeticAttribute(attribute)) {
    return pickAttributeValueByAliases(attribute, cosmeticAliases(group.grade), normalizeGrade(group.grade));
  }

  if (isMemoryAttribute(attribute)) {
    return pickAttributeValueByAliases(attribute, memoryAliases(group.memory), group.memory);
  }

  if (isWarrantyAttribute(attribute)) {
    return pickAttributeValueByAliases(attribute, warrantyAliases(group.warranty), group.warranty);
  }

  return null;
}

function attributeAvailableValues(attribute: CategoryAttribute) {
  const values = Array.isArray(attribute.attributeValues) ? attribute.attributeValues : [];

  return values
    .map((value) => text(value?.name))
    .filter(Boolean)
    .slice(0, 30);
}

async function buildCreateAttributes(reference: IdefixProduct, group: DeviceGroup) {
  const categoryId = reference.categoryId;

  if (categoryId === null || categoryId === undefined || text(categoryId) === "") {
    throw new Error(`${productTitle(group)}: referans üründe categoryId yok.`);
  }

  const schema = await categoryAttributes(categoryId);

  if (schema.length === 0) {
    throw new Error(`${productTitle(group)}: İdefix kategori özellikleri alınamadı.`);
  }

  const output: Array<{
    attributeId: number | string;
    attributeValueId: number | string | null;
    customAttributeValue: string | null;
  }> = [];

  let colorFound = false;

  for (const attribute of schema) {
    if (isColorAttribute(attribute)) {
      const selected = colorAttributeValue(attribute, group.color);

      if (!selected) {
        throw new Error(
          `${productTitle(group)}: İdefix kategori renklerinde "${group.color}" / ${colorAliases(group.color).join(", ")} bulunamadı. Kullanılabilir değerler: ${
            attributeAvailableValues(attribute).join(", ") || "-"
          }.`
        );
      }

      output.push(selected);
      colorFound = true;
      continue;
    }

    const referenceValue = attributeById(reference, attribute.attributeId);

    if (referenceValue) {
      output.push({
        attributeId: attribute.attributeId,
        attributeValueId: referenceValue.attributeValueId ?? null,
        customAttributeValue: text(referenceValue.customAttributeValue) || null,
      });

      continue;
    }

    if (attribute.required === true) {
      const derived = derivedRequiredAttributeValue(attribute, group);

      if (derived) {
        output.push(derived);
        continue;
      }

      throw new Error(
        `${productTitle(group)}: zorunlu İdefix özelliği referans üründe yok ve girilen bilgiden güvenli türetilemedi: ${
          text(attribute.attributeTitle) || String(attribute.attributeId)
        }. Kullanılabilir değerler: ${attributeAvailableValues(attribute).join(", ") || "-"}.`
      );
    }
  }

  if (!colorFound) {
    throw new Error(`${productTitle(group)}: kategori özelliklerinde renk attribute'u bulunamadı.`);
  }

  return output;
}

// ============================================================
// Görsel / KDV keşfi (center-send/route.ts'den KOPYALANDI)
// ============================================================

function imageUrlsFromJson(value: unknown, keyHint = "", output = new Set<string>(), depth = 0) {
  if (depth > 8 || value === null || value === undefined) {
    return output;
  }

  if (typeof value === "string") {
    const raw = value.trim();
    const key = normalizeText(keyHint);

    if (
      /^https:\/\//i.test(raw) &&
      (key.includes("IMAGE") || key.includes("GORSEL") || /\.(?:jpe?g|png|webp)(?:\?|$)/i.test(raw))
    ) {
      output.add(raw);
    }

    return output;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      imageUrlsFromJson(item, keyHint, output, depth + 1);
    }

    return output;
  }

  if (typeof value === "object") {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      imageUrlsFromJson(child, key, output, depth + 1);
    }
  }

  return output;
}

function findVatInJson(value: unknown, depth = 0): number | null {
  if (depth > 8 || value === null || value === undefined) {
    return null;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findVatInJson(item, depth + 1);

      if (found !== null) {
        return found;
      }
    }

    return null;
  }

  if (typeof value === "object") {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      const normalized = normalizeText(key);

      if (["VATRATE", "VAT RATE", "VAT", "KDV", "KDV ORANI"].includes(normalized)) {
        const n = numberOrNull(child);

        if (n !== null && [0, 1, 8, 10, 18, 20].includes(n)) {
          return n;
        }
      }

      const nested = findVatInJson(child, depth + 1);

      if (nested !== null) {
        return nested;
      }
    }
  }

  return null;
}

async function exactColorLocalTemplate(client: PoolClient, group: DeviceGroup) {
  const rows = await client.query(
    `
      SELECT
        id, channel, title, brand, model, memory, color, grade, warranty, raw_data
      FROM public.online_listings
      WHERE channel IN ('N11', 'IKAS')
        AND (
          model ILIKE $1
          OR title ILIKE $2
        )
      ORDER BY updated_at DESC, id DESC
      LIMIT 200
    `,
    [`%${group.model}%`, `%${group.model}%`]
  );

  const targetBrand = normalizeText(group.brand);
  const targetModel = normalizeText(group.model);
  const targetMemory = normalizeMemory(group.memory);
  const targetGrade = normalizeGrade(group.grade);
  const aliases = colorAliases(group.color);

  const matches = rows.rows.filter((row: any) => {
    const haystack = [row?.title, row?.brand, row?.model, row?.memory, row?.color, row?.grade, JSON.stringify(row?.raw_data || {})].join(
      " "
    );

    const normalized = normalizeText(haystack);

    return (
      (normalizeText(row?.brand) === targetBrand || containsPhrase(normalized, targetBrand)) &&
      (normalizeText(row?.model) === targetModel || containsPhrase(normalized, targetModel)) &&
      (normalizeMemory(row?.memory) === targetMemory || containsPhrase(normalized, targetMemory)) &&
      aliases.some((alias) => containsPhrase(normalized, alias)) &&
      (!normalizeText(row?.grade) ||
        normalizeGrade(row?.grade) === targetGrade ||
        detectGradeFromTitle(normalized) === targetGrade)
    );
  });

  if (matches.length === 0) {
    return null;
  }

  for (const row of matches) {
    const urls = Array.from(imageUrlsFromJson(row.raw_data));

    if (urls.length > 0) {
      return { row, imageUrl: urls[0], vatRate: findVatInJson(row.raw_data) };
    }
  }

  return { row: matches[0], imageUrl: null as string | null, vatRate: findVatInJson(matches[0].raw_data) };
}

// ============================================================
// İstek kaynağı doğrulama (center-send/route.ts'den KOPYALANDI)
// ============================================================

function validateOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");

  if (!origin) {
    return true;
  }

  const appUrl = text(process.env.APP_URL);

  if (appUrl) {
    try {
      return origin === new URL(appUrl).origin;
    } catch {
      return false;
    }
  }

  const host = request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") || request.nextUrl.protocol.replace(":", "");

  return Boolean(host && origin === `${proto}://${host}`);
}

// ============================================================
// Canlı İdefix envanter yardımcıları (center-send/route.ts'den KOPYALANDI)
// ============================================================

async function liveInventoryItems() {
  const vendorId = getIdefixVendorId();
  const payload = await idefixApi(`/pim/catalog/${encodeURIComponent(vendorId)}/inventory/list`);

  const rows = payload?.items ?? payload?.products ?? payload?.data?.items ?? payload?.data?.products ?? [];

  return Array.isArray(rows) ? rows : [];
}

function inventoryRowMatches(row: any, barcode: string, vendorStockCode: string) {
  // İdefix'in inventory-list dokümantasyonundaki örnek cevapta "barcode"
  // ile birlikte ayrı bir "stockCode" alanı da var (developer.idefix.com,
  // "Stok ve Fiyat Güncel Durum Sorgulama"). Bazı ürünlerde bu listede
  // barcode boş/farklı dönüp yalnızca stockCode güvenilir olabiliyor; bu
  // yüzden ikisine de, ayrıca kendi vendorStockCode'umuza karşı da bakılır.
  const candidates = [text(row?.barcode), text(row?.stockCode), text(row?.vendorStockCode)];
  return candidates.includes(barcode) || (Boolean(vendorStockCode) && candidates.includes(vendorStockCode));
}

async function liveInventoryByBarcode(barcode: string, vendorStockCode = "") {
  const rows = await liveInventoryItems();
  return rows.find((row: any) => inventoryRowMatches(row, barcode, vendorStockCode)) || null;
}

async function waitLiveInventory(
  barcode: string,
  expectedStock: number,
  expectedPrice: number,
  vendorStockCode = ""
) {
  let lastItem: any = null;

  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (attempt > 0) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }

    lastItem = await liveInventoryByBarcode(barcode, vendorStockCode);

    if (!lastItem) {
      continue;
    }

    const stock = numberOrNull(lastItem?.inventoryQuantity) ?? 0;
    const price = numberOrNull(lastItem?.price) ?? 0;

    const stockOk = stock >= expectedStock;
    const priceOk = expectedPrice <= 0 || Math.abs(price - expectedPrice) < 0.01;

    if (stockOk && priceOk) {
      return { success: true, item: lastItem };
    }
  }

  return { success: false, item: lastItem };
}

// ============================================================
// Ürün oluşturma / onaylama (center-send/route.ts'den KOPYALANDI)
// ============================================================

async function createProduct(prepared: PreparedDevice) {
  if (prepared.action !== "CREATE_PRODUCT") {
    throw new Error("İdefix create yanlış aksiyonda çağrıldı.");
  }

  const vendorId = getIdefixVendorId();
  const reference = prepared.referenceProduct;

  const requestProduct: Record<string, unknown> = {
    barcode: prepared.barcode,
    title: prepared.title,
    productMainId: prepared.productMainId,
    brandId: prepared.brandId,
    categoryId: prepared.categoryId,
    inventoryQuantity: prepared.targetAfterStock,
    vendorStockCode: prepared.vendorStockCode,
    description: prepared.title,
    price: prepared.salePrice,
    comparePrice: prepared.listPrice,
    vatRate: prepared.vatRate,
    deliveryDuration: numberOrNull(reference?.deliveryDuration) ?? 1,
    deliveryType: text(reference?.deliveryType) || "regular",
    images: [{ url: prepared.imageUrl }],
    attributes: prepared.attributes,
  };

  const desi = numberOrNull((reference as any)?.desi);

  if (desi !== null && desi >= 0) {
    requestProduct.desi = desi;
  }

  const weight = numberOrNull(reference?.weight);

  if (weight !== null && weight > 0) {
    requestProduct.weight = weight;
  }

  const cargoCompanyId = numberOrNull(reference?.cargoCompanyId);

  if (cargoCompanyId !== null && cargoCompanyId > 0) {
    requestProduct.cargoCompanyId = cargoCompanyId;
  }

  const shipmentAddressId = numberOrNull(reference?.shipmentAddressId);

  if (shipmentAddressId !== null && shipmentAddressId > 0) {
    requestProduct.shipmentAddressId = shipmentAddressId;
  }

  const returnAddressId = numberOrNull(reference?.returnAddressId);

  if (returnAddressId !== null && returnAddressId > 0) {
    requestProduct.returnAddressId = returnAddressId;
  }

  const response = await idefixApi(`/pim/pool/${encodeURIComponent(vendorId)}/create`, {
    method: "POST",
    body: { products: [requestProduct] },
    timeoutMs: 45_000,
  });

  const batchRequestId = text(response?.batchRequestId);

  if (!batchRequestId) {
    throw new Error(`${prepared.title}: İdefix create batchRequestId döndürmedi.`);
  }

  return { requestProduct, response, batchRequestId };
}

async function batchResult(batchId: string) {
  const vendorId = getIdefixVendorId();

  return idefixApi(`/pim/pool/${encodeURIComponent(vendorId)}/batch-result/${encodeURIComponent(batchId)}`, {
    timeoutMs: 35_000,
  });
}

function productState(payload: any, barcode: string) {
  const products = Array.isArray(payload?.products) ? payload.products : [];
  const product = products.find((row: any) => text(row?.barcode) === barcode) || products[0] || null;

  return { product, state: normalizeText(product?.status || product?.state) };
}

async function waitCreateResult(batchId: string, barcode: string) {
  let last: any = null;

  for (let attempt = 0; attempt < 7; attempt += 1) {
    if (attempt > 0) {
      await new Promise((resolve) => setTimeout(resolve, 850));
    }

    last = await batchResult(batchId);

    const state = productState(last, barcode);

    if (
      state.product &&
      [
        "WAITING VENDOR APPROVE",
        "READY FOR SALE",
        "NOT MATCHED",
        "WAITING CATALOG ACTION",
        "AUTO MATCHED",
        "MANUAL MATCHED",
        "MISSING INFO",
        "PLATFORM DECLINED",
      ].includes(state.state)
    ) {
      return { payload: last, ...state };
    }

    const batchStatus = normalizeText(last?.status);

    if (["FAILED", "CANCELLED"].includes(batchStatus)) {
      return { payload: last, ...state };
    }
  }

  return { payload: last, ...productState(last, barcode) };
}

function matchedProductLooksSafe(matched: any, group: DeviceGroup) {
  const name = text(matched?.name || matched?.title);

  if (!name) {
    return false;
  }

  return (
    containsPhrase(name, group.brand) &&
    containsPhrase(name, `${normalizeText(group.model)} ${normalizeMemory(group.memory)}`) &&
    Boolean(matchedColorAlias(name, group.color))
  );
}

async function approveProduct(barcode: string) {
  const vendorId = getIdefixVendorId();

  return idefixApi(`/pim/pool/${encodeURIComponent(vendorId)}/approve-item`, {
    method: "POST",
    body: { items: [{ barcode }] },
  });
}

async function listByBarcode(barcode: string) {
  const vendorId = getIdefixVendorId();

  const params = new URLSearchParams();
  params.set("page", "1");
  params.set("limit", "10");
  params.set("barcode", barcode);

  const payload = await idefixApi(`/pim/pool/${encodeURIComponent(vendorId)}/list?${params.toString()}`);

  const products = Array.isArray(payload?.products) ? (payload.products as IdefixProduct[]) : [];

  return { payload, products };
}

// ============================================================
// Stok / fiyat yükleme (center-send/route.ts'den KOPYALANDI)
// ============================================================

async function inventoryUpload(prepared: PreparedDevice) {
  const vendorId = getIdefixVendorId();

  const payload = await idefixApi(`/pim/catalog/${encodeURIComponent(vendorId)}/inventory-upload`, {
    method: "POST",
    body: {
      items: [
        {
          barcode: prepared.barcode,
          price: prepared.salePrice,
          comparePrice: prepared.listPrice,
          inventoryQuantity: prepared.targetAfterStock,
          // İdefix validasyonu: 1-50 arası zorunlu. Tekil cihaz akışında güvenli değer 1.
          maximumPurchasableQuantity: 1,
          deliveryDuration: numberOrNull(prepared.exactProduct?.deliveryDuration) ?? 1,
          deliveryType: text(prepared.exactProduct?.deliveryType) || "regular",
          isZoneSale: null,
        },
      ],
    },
  });

  const batchRequestId = text(payload?.batchRequestId);

  if (!batchRequestId) {
    throw new Error(`${prepared.title}: İdefix inventory-upload batchRequestId döndürmedi.`);
  }

  return { payload, batchRequestId };
}

async function inventoryResult(batchId: string) {
  const vendorId = getIdefixVendorId();

  return idefixApi(`/pim/catalog/${encodeURIComponent(vendorId)}/inventory-result/${encodeURIComponent(batchId)}`);
}

function idefixFailureDetail(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

async function waitInventory(batchId: string, barcode: string) {
  let last: any = null;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    if (attempt > 0) {
      await new Promise((resolve) => setTimeout(resolve, 900));
    }

    last = await inventoryResult(batchId);

    const items = Array.isArray(last?.items) ? last.items : [];
    const item = items.find((row: any) => text(row?.barcode) === barcode) || items[0] || null;

    const itemStatus = normalizeText(item?.status);
    const batchStatus = normalizeText(last?.status);

    if (["DECLINE", "FAILED"].includes(itemStatus)) {
      const failure = idefixFailureDetail(item?.failureReasons);

      throw new Error(
        `İdefix stok/fiyat item reddedildi. Barkod: ${text(item?.barcode) || barcode}. Item status: ${
          itemStatus || "-"
        }. Batch status: ${batchStatus || "-"}. Sebep: ${failure || "BILINMIYOR"}. Item: ${idefixFailureDetail(item)}`
      );
    }

    if (["COMPLETED", "COMPLETED SUCCESS"].includes(itemStatus)) {
      return { success: true, payload: last, item };
    }

    if (["FAILED", "CANCELLED"].includes(batchStatus)) {
      throw new Error(
        `İdefix stok/fiyat batch başarısız. Batch: ${batchId}. Batch status: ${batchStatus || "-"}. Cevap: ${idefixFailureDetail(last)}`
      );
    }

    if (batchStatus === "COMPLETED" && attempt >= 2) {
      throw new Error(
        `İdefix batch COMPLETED döndü fakat item başarıya geçmedi. Barkod: ${barcode}. Item status: ${
          itemStatus || "BOS"
        }. Batch: ${batchId}. Item: ${idefixFailureDetail(item)}. Batch cevabı: ${idefixFailureDetail(last)}`
      );
    }
  }

  return { success: false, payload: last, item: null as any };
}

function isProductNotFoundError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return normalizeText(message).includes("PRODUCT NOT FOUND");
}

// ============================================================
// PostgreSQL yazımı — YALNIZCA public.online_listings.
// public.online_channel_devices'a hiç yazılmaz (stock_device_id yok).
// ============================================================

async function persistListing(
  client: PoolClient,
  params: {
    prepared: PreparedDevice;
    finalProduct: IdefixProduct | null;
    syncStatus: string;
    taskStatus: string;
    batchRequestId: string | null;
    finalStock: number;
    apiResult: unknown;
  }
) {
  const { prepared, finalProduct, syncStatus, taskStatus, batchRequestId, finalStock, apiResult } = params;

  const externalProductId =
    text(finalProduct?.reference) || text(finalProduct?.productMainId) || prepared.productMainId;

  const externalVariantId =
    prepared.barcode || text(finalProduct?.matchedProduct?.barcode) || text(finalProduct?.barcode);

  const externalStockCode = text(finalProduct?.vendorStockCode) || prepared.vendorStockCode;

  const existing = await client.query(
    `
      SELECT id, raw_data
      FROM public.online_listings
      WHERE channel = 'IDEFIX'
        AND (
          external_variant_id = $1
          OR external_stock_code = $2
        )
      ORDER BY updated_at DESC, id DESC
      LIMIT 1
      FOR UPDATE
    `,
    [externalVariantId, externalStockCode]
  );

  const rawPayload = JSON.stringify({
    centerManaged: false,
    createdFrom: "IDEFIX_CREATE_DEVICE",
    sourceImei: prepared.imei,
    idefixBarcode: externalVariantId,
    idefixBatchRequestId: batchRequestId,
    finalStock,
    apiResult,
    lastSyncAt: new Date().toISOString(),
  });

  let listingId: number;

  if (existing.rowCount) {
    const row = existing.rows[0];

    const updated = await client.query(
      `
        UPDATE public.online_listings
        SET
          external_product_id = $2,
          external_variant_id = $3,
          external_stock_code = $4,
          title = $5,
          sale_price = $6,
          list_price = $7,
          quantity = $8,
          sync_status = $9,
          last_task_id = $10,
          last_task_status = $11,
          brand = $12,
          model = $13,
          memory = $14,
          color = $15,
          grade = $16,
          warranty = $17,
          raw_data = COALESCE(raw_data, '{}'::jsonb) || $18::jsonb,
          updated_at = now()
        WHERE id = $1
        RETURNING id
      `,
      [
        Number(row.id),
        externalProductId,
        externalVariantId,
        externalStockCode,
        text(finalProduct?.title) || prepared.title,
        prepared.salePrice,
        prepared.listPrice,
        finalStock,
        syncStatus,
        batchRequestId,
        taskStatus,
        prepared.group.brand,
        prepared.group.model,
        prepared.group.memory,
        prepared.group.color,
        prepared.group.grade,
        prepared.group.warranty,
        rawPayload,
      ]
    );

    listingId = Number(updated.rows[0].id);
  } else {
    const inserted = await client.query(
      `
        INSERT INTO public.online_listings (
          stock_device_id,
          channel,
          external_product_id,
          external_variant_id,
          external_stock_code,
          title,
          sale_price,
          list_price,
          quantity,
          sync_status,
          last_task_id,
          last_task_status,
          brand,
          model,
          memory,
          color,
          grade,
          warranty,
          raw_data,
          created_at,
          updated_at
        )
        VALUES (
          NULL,
          'IDEFIX',
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9,
          $10,
          $11,
          $12,
          $13,
          $14,
          $15,
          $16,
          $17::jsonb,
          now(),
          now()
        )
        RETURNING id
      `,
      [
        externalProductId,
        externalVariantId,
        externalStockCode,
        text(finalProduct?.title) || prepared.title,
        prepared.salePrice,
        prepared.listPrice,
        finalStock,
        syncStatus,
        batchRequestId,
        taskStatus,
        prepared.group.brand,
        prepared.group.model,
        prepared.group.memory,
        prepared.group.color,
        prepared.group.grade,
        prepared.group.warranty,
        rawPayload,
      ]
    );

    listingId = Number(inserted.rows[0].id);
  }

  return { listingId, externalProductId, externalVariantId, externalStockCode };
}

// ============================================================
// Eşleştirme / hazırlama
// ============================================================

async function prepareDevice(
  client: PoolClient,
  products: IdefixProduct[],
  group: DeviceGroup,
  imei: string,
  salePrice: number,
  listPrice: number
): Promise<PreparedDevice> {
  let exactProduct: IdefixProduct | null = null;

  try {
    exactProduct = await exactProductForGroup(products, group);

    if (!exactProduct) {
      exactProduct = await relaxedProductForGroup(products, group);
    }
  } catch (error) {
    throw error instanceof Error ? error : new Error("İdefix mevcut ürün eşleştirme hatası.");
  }

  if (exactProduct) {
    const barcode = automaticIdefixBarcode(exactProduct);

    if (!barcode) {
      throw new Error(`${productTitle(group)}: mevcut İdefix ürününde barkod yok. Otomatik stok eklenemedi.`);
    }

    // İdefix'te "fastlist" (hızlı listeleme) ile eklenmiş ve henüz kendi
    // otomatik eşleştirmesini tamamlamamış (needAutoMatch: true) ürünler
    // "ready_for_sale" görünse bile inventory-upload'ı sessizce yok
    // sayabiliyor: batch COMPLETED döner ama gerçek stok hiç değişmez.
    // 45 saniyelik boşuna doğrulama beklemesi yerine bunu en baştan
    // yakalayıp net bir mesajla durduruyoruz.
    if (exactProduct.needAutoMatch === true) {
      throw new Error(
        `${productTitle(group)}: bu İdefix ürünü (barkod: ${barcode}) hâlâ İdefix'in kendi otomatik eşleştirme sürecini bekliyor ("fastlist" kaydı, needAutoMatch=true). Bu durumdaki ürünlere API üzerinden stok/fiyat gönderilemiyor; İdefix satıcı panelinizden bu ürünü elle güncelleyin ya da İdefix destek ekibine barkodu bildirip eşleştirmeyi tamamlatın.`
      );
    }

    const vendorStockCode = text(exactProduct.vendorStockCode) || makeVendorStockCode(imei);

    const liveInventory = await liveInventoryByBarcode(barcode);
    const currentStock = numberOrNull(liveInventory?.inventoryQuantity) ?? numberOrNull(exactProduct.inventoryQuantity) ?? 0;

    // İdempotency: eğer eşleşen ürün bu isteğin KENDİ deterministik
    // barkoduysa (önceki yarım kalmış bir denemeden kalmış olabilir),
    // aynı fiziksel IMEI'yi ikinci kez stoğa ekleyip stoğu şişirme.
    const isOwnPreviousAttempt = barcode === makeCreateBarcode(imei, group);
    const targetAfterStock = isOwnPreviousAttempt ? Math.max(currentStock, 1) : currentStock + 1;

    return {
      group,
      imei,
      action: "EXISTING_PRODUCT",
      exactProduct,
      referenceProduct: null,
      title: text(exactProduct.title) || productTitle(group),
      salePrice,
      listPrice,
      targetBeforeStock: currentStock,
      targetAfterStock,
      barcode,
      vendorStockCode,
      productMainId: text(exactProduct.productMainId) || makeProductMainId(group),
      brandId: exactProduct.brandId ?? null,
      categoryId: exactProduct.categoryId ?? null,
      vatRate: numberOrNull(exactProduct.vatRate),
      imageUrl: Array.isArray(exactProduct.images) ? text(exactProduct.images?.[0]?.url) || null : null,
      attributes: Array.isArray(exactProduct.attributes)
        ? exactProduct.attributes
            .map((attribute: any) => ({
              attributeId: attribute.attributeId,
              attributeValueId: attribute.attributeValueId ?? null,
              customAttributeValue: text(attribute.customAttributeValue) || null,
            }))
            .filter((attribute: any) => attribute.attributeId !== null && attribute.attributeId !== undefined)
        : [],
    };
  }

  // Aynı grup için birebir/relaxed eşleşme yok: yeni katalog kaydı
  // ancak GÜVENLİ bir referans (aynı model/hafıza/grade, farklı renk)
  // varsa açılabilir. Yoksa "belirsiz katalog referansı" kuralı gereği
  // otomatik ürün açılmaz.
  const referenceProduct = referenceProductForGroup(products, group);

  if (!referenceProduct) {
    throw new Error(
      `${productTitle(
        group
      )}: İdefix kataloğunda bu model/hafıza/kalitede referans alınabilecek bir ürün (farklı renk) bulunamadı. Belirsiz katalog referansında otomatik ürün açılmaz.`
    );
  }

  if (referenceProduct.categoryId === null || referenceProduct.categoryId === undefined || text(referenceProduct.categoryId) === "") {
    throw new Error(`${productTitle(group)}: referans üründe categoryId yok. Otomatik ürün açılmaz.`);
  }

  const attributes = await buildCreateAttributes(referenceProduct, group);

  const colorTemplate = await exactColorLocalTemplate(client, group);

  if (!colorTemplate || !colorTemplate.imageUrl) {
    throw new Error(
      `${productTitle(
        group
      )}: bu renk için N11/İkas ilanlarında eşleşen doğrulanmış bir ürün görseli bulunamadı. Görsel bulunamadan otomatik İdefix ürünü açılmaz.`
    );
  }

  const vatRate = numberOrNull(colorTemplate.vatRate) ?? numberOrNull(referenceProduct.vatRate) ?? 1;

  return {
    group,
    imei,
    action: "CREATE_PRODUCT",
    exactProduct: null,
    referenceProduct,
    title: productTitle(group),
    salePrice,
    listPrice,
    targetBeforeStock: 0,
    targetAfterStock: 1,
    barcode: makeCreateBarcode(imei, group),
    vendorStockCode: makeVendorStockCode(imei),
    // Yeni renk varyantını AYNI İdefix ürün ailesine bağlamak için,
    // varsa referans ürünün kendi productMainId'si tercih edilir.
    productMainId: text(referenceProduct.productMainId) || makeProductMainId(group),
    brandId: referenceProduct.brandId ?? null,
    categoryId: referenceProduct.categoryId ?? null,
    vatRate,
    imageUrl: colorTemplate.imageUrl,
    attributes,
  };
}

// ============================================================
// Uygulama (create + approve + inventory + persist)
// (processPrepared'ın center-send/route.ts'deki mantığından adapte edildi)
// ============================================================

async function processDevice(client: PoolClient, prepared: PreparedDevice) {
  if (prepared.action === "EXISTING_PRODUCT") {
    let liveBeforeSend = prepared.exactProduct;
    let liveState = idefixProductState(liveBeforeSend);

    if (liveState === "WAITING VENDOR APPROVE") {
      await approveProduct(prepared.barcode);

      for (let attempt = 0; attempt < 8; attempt += 1) {
        if (attempt > 0) {
          await new Promise((resolve) => setTimeout(resolve, 700));
        }

        const lookup = await listByBarcode(prepared.barcode);
        const candidate = lookup.products?.[0] || null;

        if (candidate) {
          liveBeforeSend = candidate;
          liveState = idefixProductState(candidate);

          if (isIdefixReadyForSale(candidate)) {
            break;
          }
        }
      }
    }

    if (!isIdefixReadyForSale(liveBeforeSend)) {
      throw new Error(
        `${prepared.title}: ürün İdefix ürün listende mevcut fakat satışa hazır değil. Gerçek İdefix statüsü: ${
          liveState || "BILINMIYOR"
        }. Stok gönderilmedi. Önce İdefix ürün durumunu düzelt/onayla.`
      );
    }

    try {
      const upload = await inventoryUpload({ ...prepared, exactProduct: liveBeforeSend });
      const verification = await waitInventory(upload.batchRequestId, prepared.barcode);

      if (!verification.success) {
        throw new Error(
          `${prepared.title}: İdefix stok/fiyat işlemi başlatıldı fakat süre içinde COMPLETED doğrulanamadı. Batch: ${upload.batchRequestId}`
        );
      }

      const liveVerification = await waitLiveInventory(
        prepared.barcode,
        prepared.targetAfterStock,
        prepared.salePrice,
        prepared.vendorStockCode
      );

      if (!liveVerification.success) {
        // Teşhis amaçlı: yükleme öncesi İdefix'in bize verdiği ürünün TAM
        // halini de mesaja ekle. "READY FOR SALE" durumu geçse bile
        // stok/fiyat gönderiminin sessizce reddedildiği görüldü — hangi
        // alanın (ör. kalite puanı, ayrı bir onay bayrağı) buna sebep
        // olduğunu canlı veri olmadan tahmin edemiyoruz.
        let liveProductSnapshot = "-";

        try {
          liveProductSnapshot = JSON.stringify(liveBeforeSend).slice(0, 2000);
        } catch {}

        throw new Error(
          `${prepared.title}: inventory item COMPLETED oldu fakat İdefix inventory-list üzerinde gerçek stok/fiyat görünmedi. Yerel kayıt yazılmadı. Barkod: ${prepared.barcode}. Batch: ${upload.batchRequestId}. Canlı inventory: ${idefixFailureDetail(liveVerification.item)}. Yükleme öncesi ürün verisi: ${liveProductSnapshot}`
        );
      }

      await client.query("BEGIN");

      try {
        const local = await persistListing(client, {
          prepared,
          finalProduct: prepared.exactProduct,
          syncStatus: "SYNCED",
          taskStatus: "SUCCESS",
          batchRequestId: upload.batchRequestId,
          finalStock: numberOrNull(liveVerification.item?.inventoryQuantity) ?? prepared.targetAfterStock,
          apiResult: { inventoryResult: verification.payload, liveInventory: liveVerification.item },
        });

        await client.query("COMMIT");

        return {
          action: "EXISTING_PRODUCT" as const,
          created: true,
          pending: false,
          barcode: prepared.barcode,
          beforeStock: prepared.targetBeforeStock,
          afterStock: prepared.targetAfterStock,
          listingId: local.listingId,
          imei: prepared.imei,
          title: prepared.title,
          message: `İdefix ürünü mevcut kataloğa eklendi. Barkod: ${prepared.barcode}`,
        };
      } catch (error) {
        try {
          await client.query("ROLLBACK");
        } catch {}

        throw new Error(
          `${prepared.title}: İdefix stok/fiyat başarılı oldu ancak PostgreSQL kaydı yazılamadı. ${
            error instanceof Error ? error.message : ""
          }`
        );
      }
    } catch (error) {
      if (isProductNotFoundError(error)) {
        throw new Error(
          `${prepared.title}: İdefix inventory PRODUCT_NOT_FOUND döndürdü. Hiçbir yerel kayıt yazılmadı. Barkod: ${prepared.barcode}. Detay: ${
            error instanceof Error ? error.message : String(error ?? "")
          }`
        );
      }

      throw error;
    }
  }

  // CREATE_PRODUCT
  const create = await createProduct(prepared);
  const createState = await waitCreateResult(create.batchRequestId, prepared.barcode);

  let state = createState.state;
  let finalBarcode = prepared.barcode;
  let approved = false;

  const matched = createState.product?.matchedProduct;

  if (state === "WAITING VENDOR APPROVE") {
    if (!matchedProductLooksSafe(matched, prepared.group)) {
      throw new Error(
        `${prepared.title}: İdefix mevcut katalog ürünü önerdi fakat eşleşme otomatik onay için güvenli değil. Merchant onayı bekleniyor. Batch: ${create.batchRequestId}`
      );
    }

    await approveProduct(prepared.barcode);
    approved = true;

    const matchedBarcode = text(matched?.barcode);

    if (matchedBarcode) {
      finalBarcode = matchedBarcode;
    }

    await new Promise((resolve) => setTimeout(resolve, 900));
    state = "APPROVED";
  }

  if (["MISSING INFO", "PLATFORM DECLINED"].includes(state)) {
    throw new Error(
      `${prepared.title}: İdefix create reddedildi/eksik bilgi. ${JSON.stringify(createState.product?.failureReasons || null)}`
    );
  }

  let listedProduct: IdefixProduct | null = null;

  const lookupCandidates = Array.from(new Set([finalBarcode, prepared.barcode])).filter(Boolean);

  for (const barcode of lookupCandidates) {
    const listed = await listByBarcode(barcode);

    if (listed.products.length > 0) {
      listedProduct = listed.products[0];
      finalBarcode = text(listedProduct.barcode) || barcode;
      break;
    }
  }

  const pendingStates = ["NOT MATCHED", "WAITING CATALOG ACTION", "AUTO MATCHED", "MANUAL MATCHED", ""];

  if (!listedProduct && pendingStates.includes(state)) {
    await client.query("BEGIN");

    try {
      const local = await persistListing(client, {
        prepared,
        finalProduct: null,
        syncStatus: "CREATING",
        taskStatus: state || "PENDING",
        batchRequestId: create.batchRequestId,
        finalStock: prepared.targetAfterStock,
        apiResult: createState.payload,
      });

      await client.query("COMMIT");

      return {
        action: "CREATE_PRODUCT" as const,
        created: false,
        pending: true,
        approved,
        barcode: prepared.barcode,
        listingId: local.listingId,
        imei: prepared.imei,
        title: prepared.title,
        state: state || "PENDING_CREATE",
        message: "Ürün İdefix'e gönderildi. Katalog onayı bekleniyor; ürün onaylanınca stok/fiyat otomatik senkronlanacak.",
      };
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch {}

      throw new Error(
        `${prepared.title}: İdefix create kabul edildi ancak PostgreSQL PENDING_CREATE kaydı yazılamadı. ${
          error instanceof Error ? error.message : ""
        }`
      );
    }
  }

  if (!listedProduct) {
    throw new Error(`${prepared.title}: İdefix create/approve sonrası ürün satıcı havuzunda doğrulanamadı. Batch: ${create.batchRequestId}`);
  }

  const finalPrepared: PreparedDevice = {
    ...prepared,
    exactProduct: listedProduct,
    barcode: finalBarcode,
    targetBeforeStock: numberOrNull(listedProduct.inventoryQuantity) ?? 0,
    targetAfterStock: Math.max(prepared.targetAfterStock, numberOrNull(listedProduct.inventoryQuantity) ?? 0),
  };

  let upload: { payload: any; batchRequestId: string };
  let inventoryVerified: { success: boolean; payload: any; item: any };

  try {
    upload = await inventoryUpload(finalPrepared);
    inventoryVerified = await waitInventory(upload.batchRequestId, finalBarcode);

    if (!inventoryVerified.success) {
      throw new Error(`${prepared.title}: ürün oluşturuldu fakat stok/fiyat COMPLETED doğrulanamadı. Inventory batch: ${upload.batchRequestId}`);
    }
  } catch (error) {
    if (isProductNotFoundError(error)) {
      await client.query("BEGIN");

      try {
        const local = await persistListing(client, {
          prepared: finalPrepared,
          finalProduct: listedProduct,
          syncStatus: "CREATING",
          taskStatus: "WAITING_CATALOG",
          batchRequestId: create.batchRequestId,
          finalStock: finalPrepared.targetAfterStock,
          apiResult: {
            create: createState.payload,
            inventoryError: error instanceof Error ? error.message : "PRODUCT_NOT_FOUND",
            waitingCatalog: true,
            savedAt: new Date().toISOString(),
          },
        });

        await client.query("COMMIT");

        return {
          action: "CREATE_PRODUCT" as const,
          created: false,
          pending: true,
          approved,
          barcode: finalBarcode,
          listingId: local.listingId,
          imei: prepared.imei,
          title: prepared.title,
          state: "PENDING_CREATE",
          message: "Ürün İdefix'e gönderildi. Katalog onayı bekleniyor; stok/fiyat onay sonrası senkronlanacak.",
        };
      } catch (persistError) {
        try {
          await client.query("ROLLBACK");
        } catch {}

        throw new Error(
          `${prepared.title}: ürün İdefix'e gönderildi ancak PENDING_CREATE kaydı yazılamadı. ${
            persistError instanceof Error ? persistError.message : ""
          }`
        );
      }
    }

    throw error;
  }

  await client.query("BEGIN");

  try {
    const local = await persistListing(client, {
      prepared: finalPrepared,
      finalProduct: listedProduct,
      syncStatus: "SYNCED",
      taskStatus: "SUCCESS",
      batchRequestId: create.batchRequestId,
      finalStock: finalPrepared.targetAfterStock,
      apiResult: { create: createState.payload, inventory: inventoryVerified.payload },
    });

    await client.query("COMMIT");

    return {
      action: "CREATE_PRODUCT" as const,
      created: true,
      pending: false,
      approved,
      barcode: finalBarcode,
      beforeStock: finalPrepared.targetBeforeStock,
      afterStock: finalPrepared.targetAfterStock,
      listingId: local.listingId,
      imei: prepared.imei,
      title: prepared.title,
      message: `İdefix ürünü oluşturuldu ve satışa açıldı. Barkod: ${finalBarcode}`,
    };
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {}

    throw new Error(
      `${prepared.title}: İdefix dış işlemler başarılı oldu ancak PostgreSQL kanal kaydı yazılamadı. ${
        error instanceof Error ? error.message : ""
      }`
    );
  }
}

// ============================================================
// POST /api/online/idefix/create-device
// ============================================================

export async function POST(request: NextRequest) {
  let client: PoolClient | null = null;
  let lockHeld = false;

  try {
    const authError = await requireIdefixSuperAdmin(request);

    if (authError) {
      return authError;
    }

    if (!validateOrigin(request)) {
      return noStoreJson({ success: false, error: "Geçersiz istek kaynağı." }, 403);
    }

    const body = await request.json().catch(() => null);

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return noStoreJson({ success: false, error: "Geçersiz istek." }, 400);
    }

    const data = body as Record<string, unknown>;

    const imei = String(data.imei ?? "").replace(/\s+/g, "").trim();

    if (!/^[0-9]{15}$/.test(imei)) {
      return noStoreJson({ success: false, error: "IMEI tam 15 haneli ve yalnızca rakamlardan oluşmalıdır." }, 400);
    }

    const brand = text(data.brand);
    const model = text(data.model);
    const memory = text(data.memory);
    const color = text(data.color);
    const grade = text(data.grade);
    const warranty = text(data.warranty);

    const missing: string[] = [];

    if (!brand) missing.push("Marka");
    if (!model) missing.push("Model");
    if (!memory) missing.push("Hafıza");
    if (!color) missing.push("Renk");
    if (!grade) missing.push("Grade");
    if (!warranty) missing.push("Garanti");

    if (missing.length > 0) {
      return noStoreJson({ success: false, error: `${missing.join(", ")} alanı zorunludur.` }, 400);
    }

    let salePrice: number;
    let listPrice: number;

    try {
      salePrice = money(data.salePrice, "İdefix satış fiyatı");
      listPrice = money(data.listPrice, "İdefix liste fiyatı");
    } catch (error) {
      return noStoreJson(
        { success: false, error: error instanceof Error ? error.message : "Fiyat bilgileri geçersiz." },
        400
      );
    }

    if (listPrice < salePrice) {
      return noStoreJson({ success: false, error: "İdefix liste fiyatı satış fiyatından düşük olamaz." }, 400);
    }

    const group: DeviceGroup = {
      brand,
      model,
      memory,
      color,
      grade: normalizeGrade(grade),
      warranty,
    };

    client = await getIdefixDbPool().connect();

    // Aynı fiziksel IMEI ile ikinci kez İdefix ürünü açılmasın.
    const duplicate = await client.query(
      `
        SELECT id, sync_status
        FROM public.online_listings
        WHERE channel = 'IDEFIX'
          AND raw_data->>'sourceImei' = $1
        LIMIT 1
      `,
      [imei]
    );

    if (duplicate.rowCount) {
      const row = duplicate.rows[0];

      return noStoreJson(
        {
          success: false,
          error: `Bu IMEI için İdefix ürünü zaten oluşturulmuş (kayıt #${row.id}, durum: ${row.sync_status || "-"}).`,
        },
        409
      );
    }

    // center-send/route.ts ile AYNI kilit anahtarı: iki farklı İdefix
    // yazma akışı (Merkez gönderimi + tekil ürün açma) aynı anda
    // İdefix kataloğuna yazmasın.
    await client.query(`SELECT pg_advisory_lock(hashtext('cnet_center_idefix_send'))`);
    lockHeld = true;

    const products = await fetchAllProducts();
    const prepared = await prepareDevice(client, products, group, imei, salePrice, listPrice);
    const result = await processDevice(client, prepared);

    return noStoreJson({
      success: true,
      channel: "IDEFIX",
      ...result,
    });
  } catch (error) {
    console.error("IDEFIX CREATE DEVICE ERROR:", error);

    return noStoreJson(
      {
        success: false,
        channel: "IDEFIX",
        error: error instanceof Error ? error.message : "İdefix ürünü oluşturulamadı.",
      },
      500
    );
  } finally {
    if (lockHeld && client) {
      try {
        await client.query(`SELECT pg_advisory_unlock(hashtext('cnet_center_idefix_send'))`);
      } catch {}
    }

    client?.release();
  }
}
