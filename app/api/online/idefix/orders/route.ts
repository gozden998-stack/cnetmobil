// app/api/online/idefix/orders/route.ts
// CNETMOBIL - IDEFIX SIPARIS / KARGO / TAKIP
// N11 / IKAS / MERKEZ akışlarına dokunmaz.

import { NextRequest } from "next/server";

import {
  IDEFIX_BASE_URL,
  getIdefixVendorId,
  getIdefixVendorToken,
  noStoreJson,
  requireIdefixSuperAdmin,
} from "@/app/lib/idefix/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function text(value: unknown) {
  return String(value ?? "").trim();
}

function asArray(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

function numberOrZero(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function normalizeState(value: unknown) {
  return text(value)
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

async function idefixOmsRequest(
  path: string,
  init?: {
    method?: "GET" | "POST";
    body?: unknown;
  }
) {
  const token = getIdefixVendorToken();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 35_000);

  try {
    const response = await fetch(`${IDEFIX_BASE_URL}${path}`, {
      method: init?.method || "GET",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-API-KEY": token,
      },
      body:
        init?.body === undefined
          ? undefined
          : JSON.stringify(init.body),
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
      const detail =
        text(payload?.message) ||
        text(payload?.error) ||
        text(payload?.errors?.[0]?.message) ||
        raw ||
        "Cevap boş.";

      throw new Error(
        `İdefix HTTP ${response.status} [${init?.method || "GET"} ${path}]: ${detail}`
      );
    }

    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeOrder(order: any) {
  const shipping = order?.shippingAddress || {};
  const items = asArray(order?.items).map((item: any) => ({
    id: item?.id ?? null,
    productName: text(item?.productName) || "Ürün",
    barcode: text(item?.barcode),
    merchantSku: text(item?.merchantSku),
    image: text(item?.image),
    price: numberOrZero(item?.price),
    discountedTotalPrice: numberOrZero(item?.discountedTotalPrice),
    currency: text(item?.currency) || "TL",
    itemStatus: text(item?.itemStatus),
    brandName: text(item?.brandName),
    earningAmount: numberOrZero(item?.earningAmount),
    lastShipmentDate: text(item?.lastShipmentDate),
    productAttributes: asArray(item?.productAttributes).map((a: any) => ({
      attributeName: text(a?.attributeName),
      attributeValueName: text(a?.attributeValueName),
    })),
  }));

  return {
    id: Number(order?.id || 0),
    orderNumber: text(order?.orderNumber),
    status: normalizeState(order?.status),
    statusDescription: text(order?.statusDescription),
    totalPrice: numberOrZero(order?.totalPrice),
    totalDiscount: numberOrZero(order?.totalDiscount),
    discountedTotalPrice: numberOrZero(order?.discountedTotalPrice),
    customerContactName:
      text(order?.customerContactName) ||
      text(shipping?.fullName) ||
      [text(shipping?.firstName), text(shipping?.lastName)]
        .filter(Boolean)
        .join(" "),
    customerContactMail: text(order?.customerContactMail),
    shippingAddress: {
      fullName:
        text(shipping?.fullName) ||
        [text(shipping?.firstName), text(shipping?.lastName)]
          .filter(Boolean)
          .join(" "),
      fullAddress: text(shipping?.fullAddress) || text(shipping?.address1),
      city: text(shipping?.city),
      county: text(shipping?.county),
      phone: text(shipping?.phone),
    },
    cargoTrackingNumber: text(order?.cargoTrackingNumber),
    cargoTrackingUrl: text(order?.cargoTrackingUrl),
    cargoCompany: text(order?.cargoCompany),
    cargoTypeName: text(order?.cargoTypeName),
    cargoProfileId: order?.cargoProfileId ?? null,
    cargoProfileName: text(order?.cargoProfileName),
    cargoKey: text(order?.cargoKey),
    invoiceNumber: text(order?.invoiceNumber),
    createdAt: text(order?.createdAt),
    updatedAt: text(order?.updatedAt),
    orderDate: text(order?.orderDate),
    statusUpdatedAt: text(order?.statusUpdatedAt),
    estimatedDeliveryDate: text(order?.estimatedDeliveryDate),
    histories: asArray(order?.histories).map((history: any) => ({
      state: normalizeState(history?.state),
      createdAt: text(history?.createdAt),
    })),
    items,
  };
}

function bucket(status: string) {
  if (["created", "shipment_ready"].includes(status)) return "new";
  if (["shipment_picking", "shipment_invoiced"].includes(status)) return "preparing";
  if (status === "shipment_in_cargo") return "cargo";
  if (["shipment_delivered", "shipment_approved"].includes(status)) return "delivered";
  return "other";
}

async function fetchAllOrders() {
  const vendorId = getIdefixVendorId();
  const all: any[] = [];
  const seen = new Set<string>();
  const limit = 50;
  let pageCount = 1;

  for (let page = 1; page <= Math.min(pageCount, 20); page += 1) {
    const query = new URLSearchParams({
      page: String(page),
      limit: String(limit),
      sortByField: "updateAt",
      sortDirection: "desc",
      vendor: String(vendorId),
    });

    const payload = await idefixOmsRequest(
      `/oms/${encodeURIComponent(vendorId)}/list?${query.toString()}`
    );

    pageCount = Math.max(1, Number(payload?.pageCount || 1));
    const rows = asArray(payload?.items);

    for (const row of rows) {
      const key = text(row?.id) || `${text(row?.orderNumber)}|${text(row?.updatedAt)}`;
      if (!key || seen.has(key)) continue;
      seen.add(key);
      all.push(normalizeOrder(row));
    }

    if (rows.length < limit) break;
  }

  all.sort((a, b) => {
    const ad = new Date(a.updatedAt || a.orderDate || 0).getTime();
    const bd = new Date(b.updatedAt || b.orderDate || 0).getTime();
    return bd - ad;
  });

  return all;
}

export async function GET(request: NextRequest) {
  const authError = await requireIdefixSuperAdmin(request);
  if (authError) return authError;

  try {
    const vendorId = getIdefixVendorId();
    const orders = await fetchAllOrders();

    const counts = orders.reduce(
      (acc, order) => {
        const key = bucket(order.status);
        acc[key] += 1;
        return acc;
      },
      { new: 0, preparing: 0, cargo: 0, delivered: 0, other: 0 }
    );

    return noStoreJson({
      success: true,
      channel: "IDEFIX",
      vendorId,
      totalCount: orders.length,
      counts,
      orders,
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[IDEFIX ORDERS GET]", error);

    return noStoreJson(
      {
        success: false,
        channel: "IDEFIX",
        error:
          error instanceof Error
            ? error.message
            : "İdefix siparişleri alınamadı.",
        checkedAt: new Date().toISOString(),
      },
      500
    );
  }
}

export async function PUT(request: NextRequest) {
  const authError = await requireIdefixSuperAdmin(request);
  if (authError) return authError;

  try {
    const vendorId = getIdefixVendorId();
    const data = await request.json().catch(() => ({}));
    const action = text(data?.action).toUpperCase();
    const shipmentId = Number(data?.shipmentId || 0);

    if (!Number.isInteger(shipmentId) || shipmentId <= 0) {
      return noStoreJson(
        { success: false, error: "Geçerli İdefix shipment ID gerekli." },
        400
      );
    }

    if (action === "PICKING") {
      const payload = await idefixOmsRequest(
        `/oms/${encodeURIComponent(vendorId)}/${encodeURIComponent(
          String(shipmentId)
        )}/update-shipment-status`,
        {
          method: "POST",
          body: {
            status: "picking",
            ...(text(data?.invoiceNumber)
              ? { invoiceNumber: text(data.invoiceNumber) }
              : {}),
          },
        }
      );

      return noStoreJson({
        success: true,
        action,
        shipmentId,
        message: "Sipariş hazırlanıyor durumuna geçirildi.",
        payload,
      });
    }

    if (action === "INVOICED") {
      const invoiceNumber = text(data?.invoiceNumber);
      if (!invoiceNumber) {
        return noStoreJson(
          { success: false, error: "Fatura numarası gerekli." },
          400
        );
      }

      const payload = await idefixOmsRequest(
        `/oms/${encodeURIComponent(vendorId)}/${encodeURIComponent(
          String(shipmentId)
        )}/update-shipment-status`,
        {
          method: "POST",
          body: {
            status: "invoiced",
            invoiceNumber,
          },
        }
      );

      return noStoreJson({
        success: true,
        action,
        shipmentId,
        message: "Sipariş faturalandı olarak bildirildi.",
        payload,
      });
    }

    if (action === "TRACKING") {
      const trackingNumber = text(data?.trackingNumber);
      const trackingUrl = text(data?.trackingUrl);

      if (!trackingNumber || !trackingUrl) {
        return noStoreJson(
          {
            success: false,
            error: "Kargo takip numarası ve takip URL'si birlikte gerekli.",
          },
          400
        );
      }

      const payload = await idefixOmsRequest(
        `/oms/${encodeURIComponent(vendorId)}/${encodeURIComponent(
          String(shipmentId)
        )}/update-tracking-number`,
        {
          method: "POST",
          body: {
            trackingUrl,
            trackingNumber,
          },
        }
      );

      return noStoreJson({
        success: true,
        action,
        shipmentId,
        message:
          "Kargo takip bilgisi İdefix'e gönderildi. Shipment kargoda durumuna geçmelidir.",
        payload,
      });
    }

    return noStoreJson(
      {
        success: false,
        error: "Desteklenmeyen sipariş işlemi.",
      },
      400
    );
  } catch (error) {
    console.error("[IDEFIX ORDERS PUT]", error);

    return noStoreJson(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "İdefix sipariş işlemi başarısız.",
      },
      500
    );
  }
}
