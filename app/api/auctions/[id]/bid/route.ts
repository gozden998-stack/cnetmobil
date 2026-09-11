import {
  auctionScopeAllowed,
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
    // ==========================================
    // 1. OTURUM
    // ==========================================
    const session =
      await getAuctionSession(request);

    ensureAuctionAccess(session);

    // Yönetici ihale yönetir ama teklif vermez.
    if (session.isAdmin) {
      return Response.json(
        {
          ok: false,
          error:
            "Yönetici hesabı teklif veremez.",
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

    // ==========================================
    // 2. İHALE ID
    // ==========================================
    const params =
      await Promise.resolve(
        context.params
      );

    const auctionId =
      Number(params?.id);

    if (
      !Number.isInteger(auctionId) ||
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

    // ==========================================
    // 3. TEKLİF TUTARI
    // ==========================================
    const body =
      await request
        .json()
        .catch(() => ({}));

    const amount =
      numberValue(
        body?.amount
      );

    if (
      !Number.isFinite(amount) ||
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

    // ==========================================
    // 4. TRANSACTION
    // ==========================================
    const pool =
      getAuctionPool();

    client =
      await pool.connect();

    await client.query(
      "BEGIN"
    );

    // Aynı anda iki mağaza teklif verirse
    // ihale satırı kilitlenir.
    const auctionResult =
      await client.query(
        `
          SELECT *
          FROM public.auctions
          WHERE id = $1
          FOR UPDATE
        `,
        [auctionId]
      );

    const auction =
      auctionResult.rows[0];

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

    // ==========================================
    // 5. KANAL KONTROLÜ
    // ==========================================
    if (
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

    // ==========================================
    // 6. İHALE DURUMU
    // ==========================================
    if (
      auction.status !== "LIVE"
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

    // ==========================================
    // 7. SÜRE BİTTİ Mİ?
    // ==========================================
    if (
      auction.ends_at &&
      new Date(
        auction.ends_at
      ).getTime() <= Date.now()
    ) {
      // Burada ROLLBACK yapmıyoruz.
      // Süresi dolan ihaleyi gerçekten ENDED yapıp COMMIT ediyoruz.
      await client.query(
        `
          UPDATE public.auctions
          SET
            status = 'ENDED',
            paused_at = NULL,
            updated_at = NOW()
          WHERE id = $1
        `,
        [auctionId]
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
        [auctionId]
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

    // ==========================================
    // 8. MEVCUT EN YÜKSEK TEKLİF
    // ==========================================
    const highestResult =
      await client.query(
        `
          SELECT
            id,
            amount
          FROM public.auction_bids
          WHERE auction_id = $1
          ORDER BY
            amount DESC,
            created_at ASC
          LIMIT 1
        `,
        [auctionId]
      );

    const highestBid =
      highestResult.rows[0];

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

    // İlk teklif başlangıç fiyatından olabilir.
    // Sonraki teklif en yüksek + minimum artış olmak zorunda.
    const minimumAllowed =
      currentHighest === null
        ? startingPrice
        : currentHighest +
          minIncrement;

    // ==========================================
    // 9. MİNİMUM TEKLİF KONTROLÜ
    // ==========================================
    if (
      amount < minimumAllowed
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

    // ==========================================
    // 10. ANONİM KATILIMCI KODU
    // ==========================================
    const anonymousCode =
      await getOrCreateParticipant(
        client,
        auctionId,
        session
      );

    // ==========================================
    // 11. TEKLİFİ KAYDET
    // ==========================================
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
          session.userKey,
          session.userName,
          session.branch,
          anonymousCode,
          amount,
        ]
      );

    const bid =
      inserted.rows[0];

    // ==========================================
    // 12. LOG
    // ==========================================
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
        session.userName,
        session.branch,
        bid.id,
        anonymousCode,
        amount,
      ]
    );

    // ==========================================
    // 13. COMMIT
    // ==========================================
    await client.query(
      "COMMIT"
    );

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
          Number(amount) +
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
      "AUCTION_BID_ERROR",
      error
    );

    if (client) {
      try {
        await client.query(
          "ROLLBACK"
        );
      } catch (_) {}
    }

    return Response.json(
      {
        ok: false,
        error:
          "Teklif verilirken sunucu hatası oluştu.",
      },
      {
        status: 500,
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
