// app/lib/n11/stock.ts
//
// N11 fiyat/stok güncelleme API çağrısı ve yardımcıları.
//
// NOT: sendN11PriceStockUpdate / saveN11Task / getN11Credentials /
// safeN11Message, app/api/online/listings/route.ts'teki PATCH
// (SET_STOCK_ZERO) akışıyla AYNI mantığın bir kopyasıdır — o dosyaya
// hiç dokunulmadı (canlı, admin butonuyla çalışan mevcut akış risk
// altına girmesin diye). autoZeroN11StockForSoldImei ise YENİ: WingSM
// senkronu bir cihazı "SOLD" tespit ettiğinde, oturum/auth gerektirmeyen
// bir arka plan (cron) çağrısından bu dosya üzerinden n11 stoğunu 0'a
// çekmek için kullanılır.

import type { Pool } from "pg";

const N11_PRICE_STOCK_UPDATE_URL =
  "https://api.n11.com/ms/product/tasks/price-stock-update";

const N11_INTEGRATOR = "CNETMOBIL";

function getN11Credentials() {
  const appKey = String(process.env.N11_APP_KEY || "").trim();
  const appSecret = String(process.env.N11_APP_SECRET || "").trim();

  if (!appKey || !appSecret) {
    return null;
  }

  return { appKey, appSecret };
}

function safeN11Message(payload: any, rawText: string) {
  const message =
    payload?.message ||
    payload?.error ||
    payload?.errorMessage ||
    payload?.title ||
    payload?.reason ||
    null;

  if (message) return String(message);

  if (rawText && rawText.length <= 500) {
    return rawText;
  }

  return null;
}

async function sendN11PriceStockUpdate(sku: Record<string, unknown>) {
  const credentials = getN11Credentials();

  if (!credentials) {
    throw new Error(
      "N11_APP_KEY veya N11_APP_SECRET environment değişkeni eksik."
    );
  }

  const requestPayload = {
    payload: {
      integrator: N11_INTEGRATOR,
      skus: [sku],
    },
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15_000);

  try {
    const response = await fetch(N11_PRICE_STOCK_UPDATE_URL, {
      method: "POST",
      cache: "no-store",
      headers: {
        appkey: credentials.appKey,
        appsecret: credentials.appSecret,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestPayload),
      signal: controller.signal,
    });

    const rawText = await response.text();

    let responsePayload: any = null;

    if (rawText) {
      try {
        responsePayload = JSON.parse(rawText);
      } catch {
        responsePayload = null;
      }
    }

    if (!response.ok) {
      const n11Message = safeN11Message(responsePayload, rawText);

      throw new Error(
        n11Message
          ? `N11 API: ${n11Message}`
          : `N11 fiyat/stok servisi HTTP ${response.status} hatası döndürdü.`
      );
    }

    if (!responsePayload || typeof responsePayload !== "object") {
      throw new Error("N11 fiyat/stok servisi geçersiz cevap döndürdü.");
    }

    const taskId =
      responsePayload.id === null || responsePayload.id === undefined
        ? null
        : String(responsePayload.id);

    const taskStatus = String(responsePayload.status || "")
      .trim()
      .toUpperCase();
    const taskType = String(responsePayload.type || "SKU_UPDATE").trim();
    const reasons = Array.isArray(responsePayload.reasons)
      ? responsePayload.reasons
      : [];

    return {
      requestPayload,
      responsePayload,
      taskId,
      taskStatus,
      taskType,
      reasons,
    };
  } catch (error) {
    if (
      error instanceof Error &&
      (error.name === "AbortError" ||
        error.message.toLowerCase().includes("aborted"))
    ) {
      throw new Error("N11 API 15 saniye içinde yanıt vermedi.");
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function saveN11Task(
  pool: Pool,
  params: {
    listingId: number;
    stockCode: string;
    taskId: string;
    taskType: string;
    taskStatus: string;
    requestPayload: unknown;
    responsePayload: unknown;
    reasons: unknown[];
  }
) {
  await pool.query(
    `
      INSERT INTO public.online_tasks (
        channel,
        task_id,
        task_type,
        task_status,
        stock_code,
        online_listing_id,
        request_payload,
        response_payload,
        reasons,
        created_at
      )
      VALUES (
        'N11',
        $1,
        $2,
        $3,
        $4,
        $5,
        $6::jsonb,
        $7::jsonb,
        $8::jsonb,
        now()
      )
      ON CONFLICT (channel, task_id)
      DO UPDATE SET
        task_type = EXCLUDED.task_type,
        task_status = EXCLUDED.task_status,
        stock_code = EXCLUDED.stock_code,
        online_listing_id = EXCLUDED.online_listing_id,
        request_payload = EXCLUDED.request_payload,
        response_payload = EXCLUDED.response_payload,
        reasons = EXCLUDED.reasons
    `,
    [
      params.taskId,
      params.taskType,
      params.taskStatus,
      params.stockCode,
      params.listingId,
      JSON.stringify(params.requestPayload),
      JSON.stringify(params.responsePayload),
      JSON.stringify(params.reasons),
    ]
  );
}

// ======================================================
// SATIŞ TESPİTİNDEN SONRA OTOMATİK N11 STOK=0
//
// WingSM'de "SATIŞ" hareketi tespit edilip bir cihaz SOLD olarak
// işaretlendiğinde çağrılır. Bu IMEI ile eşleşen ve hâlâ stok > 0
// gösteren n11 ilanlarını bulup stoğu 0'a çeker — aynı
// app/api/online/listings/route.ts PATCH (SET_STOCK_ZERO) akışının
// yaptığı işin otomatik/oturumsuz halidir.
//
// Hiçbir hata dışarı fırlatılmaz: bir ilan başarısız olursa diğerleri
// denenmeye devam eder, WingSM senkronu bu yüzden asla bozulmaz.
// ======================================================

export async function autoZeroN11StockForSoldImei(
  pool: Pool,
  imei: string
): Promise<{ zeroed: number; errors: string[] }> {
  const errors: string[] = [];
  let zeroed = 0;

  const cleanImei = String(imei || "").trim();

  if (!cleanImei) {
    return { zeroed, errors };
  }

  let listings;

  try {
    listings = await pool.query(
      `
        SELECT id, external_stock_code, external_product_id, quantity
        FROM public.online_listings
        WHERE channel = 'N11'
          AND external_stock_code = $1
          AND COALESCE(quantity, 0) > 0
      `,
      [cleanImei]
    );
  } catch (error) {
    errors.push(
      `online_listings sorgusu başarısız: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    return { zeroed, errors };
  }

  for (const listing of listings.rows) {
    const listingId = Number(listing.id);
    const stockCode = String(listing.external_stock_code || "").trim();
    const isN11Product = Boolean(listing.external_product_id);

    try {
      if (!isN11Product) {
        // Henüz n11'de canlı değil, sadece yerel taslak stoğu sıfırla.
        await pool.query(
          `
            UPDATE public.online_listings
            SET
              quantity = 0,
              sync_status = 'DRAFT',
              updated_at = now()
            WHERE id = $1
              AND channel = 'N11'
          `,
          [listingId]
        );

        zeroed += 1;
        continue;
      }

      const n11 = await sendN11PriceStockUpdate({
        stockCode,
        quantity: 0,
      });

      if (n11.taskStatus === "REJECT") {
        await pool.query(
          `
            UPDATE public.online_listings
            SET
              last_task_id = $2,
              last_task_status = 'REJECT',
              last_error = $3,
              sync_status = 'ERROR',
              updated_at = now()
            WHERE id = $1
          `,
          [
            listingId,
            n11.taskId,
            n11.reasons.length
              ? n11.reasons.map(String).join(" | ")
              : "N11 stok güncellemesini reddetti.",
          ]
        );

        if (n11.taskId) {
          await saveN11Task(pool, {
            listingId,
            stockCode,
            taskId: n11.taskId,
            taskType: n11.taskType,
            taskStatus: n11.taskStatus,
            requestPayload: n11.requestPayload,
            responsePayload: n11.responsePayload,
            reasons: n11.reasons,
          });
        }

        errors.push(
          `Listing #${listingId}: N11 stok=0 isteğini reddetti (${
            n11.reasons.length
              ? n11.reasons.map(String).join(" | ")
              : "sebep belirtilmedi"
          }).`
        );
        continue;
      }

      if (n11.taskStatus !== "IN_QUEUE" || !n11.taskId) {
        errors.push(
          `Listing #${listingId}: N11 beklenmeyen task cevabı döndürdü: ${
            n11.taskStatus || "STATUS YOK"
          }`
        );
        continue;
      }

      await saveN11Task(pool, {
        listingId,
        stockCode,
        taskId: n11.taskId,
        taskType: n11.taskType,
        taskStatus: n11.taskStatus,
        requestPayload: n11.requestPayload,
        responsePayload: n11.responsePayload,
        reasons: n11.reasons,
      });

      await pool.query(
        `
          UPDATE public.online_listings
          SET
            quantity = 0,
            sync_status = 'IN_QUEUE',
            last_task_id = $2,
            last_task_status = 'IN_QUEUE',
            last_error = NULL,
            updated_at = now()
          WHERE id = $1
            AND channel = 'N11'
        `,
        [listingId, n11.taskId]
      );

      zeroed += 1;
    } catch (error) {
      errors.push(
        `Listing #${listingId}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  return { zeroed, errors };
}
