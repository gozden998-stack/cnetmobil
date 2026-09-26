// app/api/dealer/orders/route.ts
//
// Bayi siparis olusturur (sepeti onaylar) ve kendi siparislerini
// listeler. Odeme dogrulamasi MEVCUT Paratika return/status-sync
// akisindan gecer - burada TEKRAR YAZILMAZ, sadece paratika_payments
// tablosuna bakip dealer_orders.status'u tembel (lazy) senkronize
// eder.

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

import {
  ensureDealerTables,
  getDealerPool,
  requireDealerActor,
} from "@/app/lib/dealer/server";
import {
  buildDealerPaymentUrl,
  createDealerMerchantPaymentId,
  createDealerPayByLink,
  getDealerParatikaConfig,
  getDealerParatikaReturnUrl,
} from "@/app/lib/dealer/paratika";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function normalizeDealerPhone(value: unknown) {
  let digits = String(value ?? "").replace(/\D/g, "");

  if (digits.startsWith("0090")) digits = digits.slice(2);
  if (digits.startsWith("0") && digits.length === 11) {
    digits = `90${digits.slice(1)}`;
  }
  if (digits.length === 10 && digits.startsWith("5")) {
    digits = `90${digits}`;
  }

  return digits;
}

function createDealerCustomerCode(dealerId: number, email: string) {
  const hash = crypto
    .createHash("sha256")
    .update(`DEALER-${dealerId}|${email.trim().toLowerCase()}`, "utf8")
    .digest("hex")
    .slice(0, 24)
    .toUpperCase();

  return `CNETDLR-${hash}`;
}

type CartItemInput = {
  catalogItemId: number;
  salePrice: number;
  quantity: number;
};

export async function POST(request: NextRequest) {
  try {
    const actor = await requireDealerActor(request);

    const body = await request.json().catch(() => null);
    const rawItems = Array.isArray((body as any)?.items)
      ? ((body as any).items as unknown[])
      : [];

    if (!rawItems.length) {
      return json({ ok: false, error: "Sepetiniz boş." }, 400);
    }

    if (rawItems.length > 100) {
      return json({ ok: false, error: "Sepette çok fazla ürün var." }, 400);
    }

    const items: CartItemInput[] = [];

    for (const raw of rawItems) {
      const catalogItemId = Number((raw as any)?.catalogItemId);
      const salePrice = Number((raw as any)?.salePrice);
      const quantity = Number((raw as any)?.quantity);

      if (!Number.isInteger(catalogItemId) || catalogItemId <= 0) {
        return json({ ok: false, error: "Sepette geçersiz ürün var." }, 400);
      }

      if (!Number.isFinite(salePrice) || salePrice <= 0) {
        return json({ ok: false, error: "Sepette geçersiz satış fiyatı var." }, 400);
      }

      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 1000) {
        return json({ ok: false, error: "Sepette geçersiz adet var." }, 400);
      }

      items.push({ catalogItemId, salePrice, quantity });
    }

    const pool = getDealerPool();
    const client = await pool.connect();

    let orderId: number | null = null;
    let totalSaleAmount = 0;

    try {
      await ensureDealerTables(client);

      // Bayinin telefonunu tazeden okuyalim (requireDealerActor'da
      // contactPhone donmuyor).
      const dealerRow = await client.query(
        `SELECT company_name, email, contact_phone FROM public.dealers WHERE id = $1 LIMIT 1`,
        [actor.dealerId]
      );

      const dealer = dealerRow.rows[0];
      const phone = normalizeDealerPhone(dealer?.contact_phone || "");

      if (phone.length !== 12 || !phone.startsWith("905")) {
        return json(
          {
            ok: false,
            error:
              "Ödeme için geçerli bir telefon numarası gerekli. Lütfen firma yetkilinizin telefon bilgisini (05xx xxx xx xx) yönetici ile güncelletin.",
          },
          400
        );
      }

      await client.query("BEGIN");

      try {
        const orderItems: Array<{
          catalogItemId: number;
          itemName: string;
          basePrice: number;
          salePrice: number;
          quantity: number;
        }> = [];

        let totalBaseAmount = 0;

        for (const item of items) {
          const catalogResult = await client.query(
            `
              SELECT id, brand_model, memory, color, grade, base_price, stock_quantity
              FROM public.dealer_catalog_items
              WHERE id = $1 AND is_active = TRUE
              FOR UPDATE
            `,
            [item.catalogItemId]
          );

          const catalogItem = catalogResult.rows[0];

          if (!catalogItem) {
            throw Object.assign(
              new Error("Sepetteki bir ürün artık aktif değil, sepeti yenileyin."),
              { status: 400 }
            );
          }

          const basePrice = Number(catalogItem.base_price);

          if (item.salePrice < basePrice) {
            throw Object.assign(
              new Error(
                `${catalogItem.brand_model}: satış fiyatı temel fiyattan (${basePrice.toFixed(2)} TL) düşük olamaz.`
              ),
              { status: 400 }
            );
          }

          if (item.quantity > Number(catalogItem.stock_quantity)) {
            throw Object.assign(
              new Error(`${catalogItem.brand_model}: yeterli stok yok.`),
              { status: 409 }
            );
          }

          await client.query(
            `UPDATE public.dealer_catalog_items SET stock_quantity = stock_quantity - $2, updated_at = NOW() WHERE id = $1`,
            [catalogItem.id, item.quantity]
          );

          const itemName = [
            catalogItem.brand_model,
            catalogItem.memory,
            catalogItem.color,
          ]
            .filter(Boolean)
            .join(" · ");

          orderItems.push({
            catalogItemId: Number(catalogItem.id),
            itemName,
            basePrice,
            salePrice: item.salePrice,
            quantity: item.quantity,
          });

          totalBaseAmount += basePrice * item.quantity;
          totalSaleAmount += item.salePrice * item.quantity;
        }

        const commissionAmount =
          Math.round((totalSaleAmount - totalBaseAmount) * 100) / 100;

        const orderResult = await client.query(
          `
            INSERT INTO public.dealer_orders
              (dealer_id, status, total_base_amount, total_sale_amount, commission_amount)
            VALUES ($1, 'AWAITING_PAYMENT', $2, $3, $4)
            RETURNING id
          `,
          [
            actor.dealerId,
            Math.round(totalBaseAmount * 100) / 100,
            Math.round(totalSaleAmount * 100) / 100,
            commissionAmount,
          ]
        );

        orderId = Number(orderResult.rows[0].id);

        for (const orderItem of orderItems) {
          await client.query(
            `
              INSERT INTO public.dealer_order_items
                (order_id, catalog_item_id, item_name_snapshot, base_price_snapshot, sale_price, quantity)
              VALUES ($1, $2, $3, $4, $5, $6)
            `,
            [
              orderId,
              orderItem.catalogItemId,
              orderItem.itemName,
              orderItem.basePrice,
              orderItem.salePrice,
              orderItem.quantity,
            ]
          );
        }

        await client.query("COMMIT");
      } catch (transactionError) {
        await client.query("ROLLBACK");
        throw transactionError;
      }

      // ==================================================
      // ODEME LINKI - transaction DISINDA (dis servis cagrisi).
      // Basarisiz olursa siparisi CANCELLED yapip stogu geri veririz.
      // ==================================================
      const config = getDealerParatikaConfig();
      const merchantPaymentId = createDealerMerchantPaymentId();
      const returnUrl = getDealerParatikaReturnUrl(request);
      const customerCode = createDealerCustomerCode(actor.dealerId, dealer.email);

      const payByLink = await createDealerPayByLink(config, {
        merchantPaymentId,
        amount: totalSaleAmount,
        customerCode,
        customerName: String(dealer.company_name || actor.companyName),
        customerEmail: String(dealer.email || actor.email),
        customerPhone: phone,
        returnUrl,
      });

      if (!payByLink.ok) {
        await client.query("BEGIN");
        try {
          for (const item of items) {
            await client.query(
              `UPDATE public.dealer_catalog_items SET stock_quantity = stock_quantity + $2, updated_at = NOW() WHERE id = $1`,
              [item.catalogItemId, item.quantity]
            );
          }
          await client.query(
            `UPDATE public.dealer_orders SET status = 'CANCELLED', cancelled_at = NOW(), updated_at = NOW() WHERE id = $1`,
            [orderId]
          );
          await client.query("COMMIT");
        } catch {
          await client.query("ROLLBACK");
        }

        return json(
          {
            ok: false,
            error:
              payByLink.responseMsg || "Ödeme oturumu oluşturulamadı, lütfen tekrar deneyin.",
          },
          502
        );
      }

      const paymentUrl = buildDealerPaymentUrl(config.baseUrl, payByLink.sessionToken);

      const paymentResult = await client.query(
        `
          INSERT INTO public.paratika_payments (
            merchant_payment_id, session_token, payment_url,
            branch_code, created_by_user_id,
            wingsm_personnel_code, wingsm_personnel_name,
            customer_name, customer_email, customer_phone,
            amount, currency, installment_count,
            status, paratika_status, response_code, response_msg,
            link_created_at, raw_create_response, raw_last_response, last_synced_at
          )
          VALUES (
            $1, $2, $3,
            $4, NULL,
            'BAYI', $5,
            $6, $7, $8,
            $9, 'TRY', 1,
            'LINK_CREATED', 'LINK_CREATED', $10, $11,
            NOW(), $12::jsonb, $12::jsonb, NOW()
          )
          RETURNING id
        `,
        [
          merchantPaymentId,
          payByLink.sessionToken,
          paymentUrl,
          `BAYI:${dealer.company_name}`,
          String(dealer.company_name || actor.companyName),
          String(dealer.company_name || actor.companyName),
          String(dealer.email || actor.email),
          phone,
          Number(totalSaleAmount.toFixed(2)),
          payByLink.responseCode || null,
          payByLink.responseMsg || null,
          JSON.stringify(payByLink.raw ?? null),
        ]
      );

      const paratikaPaymentId = Number(paymentResult.rows[0].id);

      await client.query(
        `UPDATE public.dealer_orders SET paratika_payment_id = $2, updated_at = NOW() WHERE id = $1`,
        [orderId, paratikaPaymentId]
      );

      return json({ ok: true, orderId, paymentUrl });
    } finally {
      client.release();
    }
  } catch (error) {
    const status =
      error && typeof error === "object" && "status" in error
        ? Number((error as any).status) || 500
        : 500;

    return json(
      { ok: false, error: error instanceof Error ? error.message : "Hata" },
      status
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const actor = await requireDealerActor(request);

    const pool = getDealerPool();
    const client = await pool.connect();

    try {
      await ensureDealerTables(client);

      const ordersResult = await client.query(
        `
          SELECT
            o.id, o.status, o.total_base_amount, o.total_sale_amount,
            o.commission_amount, o.tracking_no, o.created_at, o.paid_at,
            o.shipped_at,
            p.status AS paratika_status, p.payment_url
          FROM public.dealer_orders o
          LEFT JOIN public.paratika_payments p ON p.id = o.paratika_payment_id
          WHERE o.dealer_id = $1
          ORDER BY o.created_at DESC
          LIMIT 200
        `,
        [actor.dealerId]
      );

      // Odeme onaylanmis ama siparis hala AWAITING_PAYMENT'ta kaldiysa
      // (return/status-sync kodu paratika_payments'i APPROVED yaptiktan
      // sonra buraya donmuyor - tembel senkron burada yapilir).
      const toSync = ordersResult.rows.filter(
        (row) =>
          row.status === "AWAITING_PAYMENT" && row.paratika_status === "APPROVED"
      );

      for (const row of toSync) {
        await client.query(
          `UPDATE public.dealer_orders SET status = 'PAID', paid_at = NOW(), updated_at = NOW() WHERE id = $1`,
          [row.id]
        );
        row.status = "PAID";
      }

      const orders = ordersResult.rows.map((row) => ({
        id: Number(row.id),
        status: String(row.status),
        totalBaseAmount: Number(row.total_base_amount),
        totalSaleAmount: Number(row.total_sale_amount),
        commissionAmount: Number(row.commission_amount),
        trackingNo: row.tracking_no ? String(row.tracking_no) : "",
        createdAt: row.created_at,
        paidAt: row.paid_at,
        shippedAt: row.shipped_at,
        paymentUrl:
          row.status === "AWAITING_PAYMENT" && row.payment_url
            ? String(row.payment_url)
            : null,
      }));

      return json({ ok: true, orders });
    } finally {
      client.release();
    }
  } catch (error) {
    const status =
      error && typeof error === "object" && "status" in error
        ? Number((error as any).status) || 500
        : 500;

    return json(
      { ok: false, error: error instanceof Error ? error.message : "Hata" },
      status
    );
  }
}
