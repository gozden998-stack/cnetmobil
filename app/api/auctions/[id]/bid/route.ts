import {
  auctionScopeAllowed,
  cleanAuctionText,
  ensureAuctionAccess,
  getAuctionPool,
  getAuctionSession,
  getOrCreateParticipant,
  numberValue,
} from "../../_server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: {
    params:
      | Promise<{ id: string }>
      | { id: string };
  }
) {
  let client: any = null;

  try {
    // ==================================================
    // OTURUM
    // ==================================================

    const session =
      await getAuctionSession(
        request
      );

    ensureAuctionAccess(
      session
    );

    // ==================================================
    // İHALE ID
    // ==================================================

    const params =
      await Promise.resolve(
        context.params
      );

    const auctionId =
      Number(
        params?.id
      );

    if (
      !Number.isInteger(
        auctionId
      ) ||
      auctionId <= 0
    ) {
      return Response.json(
        {
          ok: false,
          error:
            "İhale numarası geçersiz.",
        },
        {
          status: 400,
          headers: {
            "Cache-Control":
              "no-store",
          },
        }
      );
    }

    // ==================================================
    // BODY
    // ==================================================

    const body =
      await request
        .json()
        .catch(
          () => ({})
        );

    const amount =
      numberValue(
        body?.amount
      );

    const bidderName =
      cleanAuctionText(
        body?.bidderName,
        160
      );

    // ==================================================
    // AD SOYAD ZORUNLU
    // ==================================================

    if (
      !bidderName ||
      bidderName.length < 3
    ) {
      return Response.json(
        {
          ok: false,
          error:
            "Teklif vermek için Ad Soyad girilmelidir.",
        },
        {
          status: 400,
          headers: {
            "Cache-Control":
              "no-store",
          },
        }
      );
    }

    // ==================================================
    // TUTAR
    // ==================================================

    if (
      !Number.isFinite(
        amount
      ) ||
      amount <= 0
    ) {
      return Response.json(
        {
          ok: false,
          error:
            "Teklif tutarı geçersiz.",
        },
        {
          status: 400,
          headers: {
            "Cache-Control":
              "no-store",
          },
        }
      );
    }

    // ==================================================
    // DATABASE
    // ==================================================

    const pool =
      getAuctionPool();

    client =
      await pool.connect();

    await client.query(
      "BEGIN"
    );

    // Aynı anda iki teklif gelirse yarışmayı engelle.
    const auctionResult =
      await client.query(
        `
          SELECT *
          FROM public.auctions

          WHERE id = $1

          FOR UPDATE
        `,
        [
          auctionId,
        ]
      );

    const auction =
      auctionResult
        .rows[0];

    if (!auction) {
      await client.query(
        "ROLLBACK"
      );

      return Response.json(
        {
          ok: false,
          error:
            "İhale bulunamadı.",
        },
        {
          status: 404,
          headers: {
            "Cache-Control":
              "no-store",
          },
        }
      );
    }

    // ==================================================
    // KANAL KONTROLÜ
    // ==================================================

    // Super Admin kanal kontrolünden bağımsız teklif verebilir.
    if (
      !session.isSuperAdmin &&
      !auctionScopeAllowed(
        auction.channel_scope,
        session.channel
      )
    ) {
      await client.query(
        "ROLLBACK"
      );

      return Response.json(
        {
          ok: false,
          error:
            "Bu ihale kanalınıza açık değil.",
        },
        {
          status: 403,
          headers: {
            "Cache-Control":
              "no-store",
          },
        }
      );
    }

    // ==================================================
    // İHALE LIVE MI?
    // ==================================================

    if (
      auction.status !==
      "LIVE"
    ) {
      await client.query(
        "ROLLBACK"
      );

      return Response.json(
        {
          ok: false,

          error:
            auction.status ===
            "PAUSED"
              ? "İhale şu anda duraklatılmış."
              : "İhale şu anda teklif almıyor.",
        },
        {
          status: 409,
          headers: {
            "Cache-Control":
              "no-store",
          },
        }
      );
    }

    // ==================================================
    // SÜRE KONTROLÜ
    // ==================================================

    if (
      auction.ends_at &&
      new Date(
        auction.ends_at
      ).getTime() <=
        Date.now()
    ) {
      await client.query(
        `
          UPDATE public.auctions

          SET
            status = 'ENDED',
            paused_at = NULL,
            updated_at = NOW()

          WHERE id = $1
        `,
        [
          auctionId,
        ]
      );

      await client.query(
        `
          INSERT INTO public.auction_events (
            auction_id,
            event_type,
            actor_name,
            new_value
          )

          VALUES (
            $1,
            'ENDED',
            'SYSTEM',

            jsonb_build_object(
              'reason',
              'TIME_EXPIRED'
            )
          )
        `,
        [
          auctionId,
        ]
      );

      await client.query(
        "COMMIT"
      );

      return Response.json(
        {
          ok: false,
          error:
            "İhale süresi doldu.",
        },
        {
          status: 409,
          headers: {
            "Cache-Control":
              "no-store",
          },
        }
      );
    }

    // ==================================================
    // EN YÜKSEK TEKLİF
    // ==================================================

    const highestResult =
      await client.query(
        `
          SELECT
            id,
            amount

          FROM public.auction_bids

          WHERE
            auction_id = $1

          ORDER BY
            amount DESC,
            created_at ASC

          LIMIT 1
        `,
        [
          auctionId,
        ]
      );

    const highestBid =
      highestResult
        .rows[0];

    const currentHighest =
      highestBid
        ? Number(
            highestBid.amount
          )
        : null;

    const startingPrice =
      Number(
        auction.starting_price
      );

    const minIncrement =
      Number(
        auction.min_increment
      );

    const minimumAllowed =
      currentHighest ===
      null
        ? startingPrice
        : currentHighest +
          minIncrement;

    // ==================================================
    // MİNİMUM TEKLİF
    // ==================================================

    if (
      amount <
      minimumAllowed
    ) {
      await client.query(
        "ROLLBACK"
      );

      return Response.json(
        {
          ok: false,

          error:
            `Minimum teklif ${minimumAllowed.toLocaleString(
              "tr-TR"
            )} TL olmalıdır.`,

          minimumAllowed,
        },
        {
          status: 409,
          headers: {
            "Cache-Control":
              "no-store",
          },
        }
      );
    }

    // ==================================================
    // ANONİM KOD
    // ==================================================

    const anonymousCode =
      await getOrCreateParticipant(
        client,
        auctionId,
        session
      );

    // ==================================================
    // TEKLİF KAYDI
    // ==================================================

    const inserted =
      await client.query(
        `
          INSERT INTO public.auction_bids (
            auction_id,
            bidder_user_id,
            bidder_name,
            bidder_branch,
            anonymous_code,
            amount
          )

          VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6
          )

          RETURNING *
        `,
        [
          auctionId,

          // Gerçek oturum
          session.userKey,

          // PERSONELİN FORMDA YAZDIĞI İSİM
          bidderName,

          session.branch,

          anonymousCode,

          amount,
        ]
      );

    const bid =
      inserted.rows[0];

    // ==================================================
    // EVENT LOG
    // ==================================================

    await client.query(
      `
        INSERT INTO public.auction_events (
          auction_id,
          event_type,
          actor_user_id,
          actor_name,
          actor_branch,
          new_value
        )

        VALUES (
          $1,
          'BID_PLACED',
          $2,
          $3,
          $4,

          jsonb_build_object(
            'bid_id',
            $5::bigint,

            'anonymous_code',
            $6::text,

            'amount',
            $7::numeric
          )
        )
      `,
      [
        auctionId,
        session.userKey,

        // Logda gerçek teklif veren adı tutulur.
        bidderName,

        session.branch,
        bid.id,
        anonymousCode,
        amount,
      ]
    );

    // ==================================================
    // COMMIT
    // ==================================================

    await client.query(
      "COMMIT"
    );

    // ==================================================
    // RESPONSE
    // ==================================================
    // DİKKAT:
    // bidderName response içine bilerek konmuyor.
    // Böylece frontend üzerinden diğer kullanıcılara sızmıyor.
    // ==================================================

    return Response.json(
      {
        ok: true,

        message:
          "Teklifiniz başarıyla alındı.",

        bid: {
          id:
            bid.id,

          anonymous_code:
            bid.anonymous_code,

          amount:
            bid.amount,

          created_at:
            bid.created_at,
        },

        nextMinimum:
          Number(
            amount
          ) +
          minIncrement,
      },
      {
        status: 201,
        headers: {
          "Cache-Control":
            "no-store",
        },
      }
    );
  } catch (error: any) {
    console.error(
      "AUCTION_BID_ERROR:",
      {
        message:
          error?.message,

        stack:
          error?.stack,

        code:
          error?.code,

        detail:
          error?.detail,
      }
    );

    if (client) {
      try {
        await client.query(
          "ROLLBACK"
        );
      } catch {}
    }

    return Response.json(
      {
        ok: false,

        error:
          error?.message ||
          "Teklif verilirken sunucu hatası oluştu.",
      },
      {
        status:
          Number(
            error?.status ||
              500
          ),

        headers: {
          "Cache-Control":
            "no-store",
        },
      }
    );
  } finally {
    if (client) {
      client.release();
    }
  }
}
