import {
  apiError,
  auctionScopeAllowed,
  closeExpiredAuctions,
  ensureAdmin,
  ensureAuctionAccess,
  getAuctionPool,
  getAuctionSession,
  numberValue,
} from "../_server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ======================================================
// ID
// ======================================================

function getId(params: any) {
  const id = Number(params?.id);

  if (
    !Number.isInteger(id) ||
    id <= 0
  ) {
    throw Object.assign(
      new Error(
        "İhale numarası geçersiz."
      ),
      {
        status: 400,
      }
    );
  }

  return id;
}

// ======================================================
// GET
// ======================================================

export async function GET(
  request: Request,
  context: {
    params:
      | Promise<{ id: string }>
      | { id: string };
  }
) {
  try {
    const session =
      await getAuctionSession(
        request
      );

    ensureAuctionAccess(
      session
    );

    await closeExpiredAuctions();

    const params =
      await Promise.resolve(
        context.params
      );

    const auctionId =
      getId(params);

    const pool =
      getAuctionPool();

    // ==================================================
    // İHALE
    // ==================================================

    const auctionResult =
      await pool.query(
        `
          SELECT
            a.*,

            COALESCE(
              (
                SELECT MAX(b.amount)

                FROM public.auction_bids b

                WHERE
                  b.auction_id = a.id
              ),

              a.starting_price
            ) AS current_price,

            (
              SELECT COUNT(*)::int

              FROM public.auction_bids b

              WHERE
                b.auction_id = a.id
            ) AS bid_count

          FROM public.auctions a

          WHERE
            a.id = $1

          LIMIT 1
        `,
        [
          auctionId,
        ]
      );

    const auction =
      auctionResult.rows[0];

    if (!auction) {
      throw Object.assign(
        new Error(
          "İhale bulunamadı."
        ),
        {
          status: 404,
        }
      );
    }

    // ==================================================
    // ERİŞİM
    // ==================================================

    if (
      !session.isSuperAdmin
    ) {
      if (
        !auctionScopeAllowed(
          auction.channel_scope,
          session.channel
        )
      ) {
        throw Object.assign(
          new Error(
            "Bu ihaleye erişim yetkiniz yok."
          ),
          {
            status: 403,
          }
        );
      }

      if (
        ![
          "LIVE",
          "PAUSED",
          "ENDED",
        ].includes(
          auction.status
        )
      ) {
        throw Object.assign(
          new Error(
            "Bu ihale şu anda görüntülenemez."
          ),
          {
            status: 403,
          }
        );
      }
    }

    // ==================================================
    // TEKLİFLER
    // ==================================================
    // SUPER ADMIN:
    // isim + mağaza + gerçek kullanıcı bilgisi
    //
    // NORMAL YÖNETİCİ / PERSONEL:
    // SADECE Teklif #01 + fiyat
    // ==================================================

    let bids: any[] = [];

    if (
      session.isSuperAdmin
    ) {
      const bidsResult =
        await pool.query(
          `
            SELECT
              id,
              auction_id,
              anonymous_code,
              amount,

              bidder_user_id,
              bidder_name,
              bidder_branch,

              created_at

            FROM public.auction_bids

            WHERE
              auction_id = $1

            ORDER BY
              amount DESC,
              created_at ASC

            LIMIT 500
          `,
          [
            auctionId,
          ]
        );

      bids =
        bidsResult.rows;
    } else {
      const bidsResult =
        await pool.query(
          `
            SELECT
              id,
              auction_id,
              anonymous_code,
              amount,
              created_at,

              (
                bidder_user_id = $2
              ) AS is_mine

            FROM public.auction_bids

            WHERE
              auction_id = $1

            ORDER BY
              amount DESC,
              created_at ASC

            LIMIT 500
          `,
          [
            auctionId,
            session.userKey,
          ]
        );

      bids =
        bidsResult.rows;
    }

    // ==================================================
    // AUCTION RESPONSE
    // ==================================================
    // Normal kullanıcıya winner_user_id,
    // winner_branch,
    // created_by_user_id gibi kimlik alanlarını
    // göndermiyoruz.
    // ==================================================

    const publicAuction =
      session.isSuperAdmin
        ? auction
        : {
            id:
              auction.id,

            title:
              auction.title,

            item_name:
              auction.item_name,

            item_description:
              auction.item_description,

            item_image_url:
              auction.item_image_url,

            channel_scope:
              auction.channel_scope,

            starting_price:
              auction.starting_price,

            min_increment:
              auction.min_increment,

            duration_minutes:
              auction.duration_minutes,

            status:
              auction.status,

            starts_at:
              auction.starts_at,

            ends_at:
              auction.ends_at,

            paused_at:
              auction.paused_at,

            winning_amount:
              auction.winning_amount,

            winner_bid_id:
              auction.winner_bid_id,

            current_price:
              auction.current_price,

            bid_count:
              auction.bid_count,

            created_at:
              auction.created_at,

            updated_at:
              auction.updated_at,
          };

    return Response.json(
      {
        ok: true,

        auction:
          publicAuction,

        bids,

        session: {
          isAdmin:
            session.isSuperAdmin,

          isSuperAdmin:
            session.isSuperAdmin,

          isManager:
            session.isManager,

          roleCode:
            session.roleCode,

          branch:
            session.branch,

          channel:
            session.channel,
        },
      },
      {
        headers: {
          "Cache-Control":
            "no-store",
        },
      }
    );
  } catch (error) {
    return apiError(
      error
    );
  }
}

// ======================================================
// PATCH
// ======================================================
// START
// PAUSE
// RESUME
// EXTEND
// END
// CANCEL
// SELECT_WINNER
//
// SADECE SUPER ADMIN
// ======================================================

export async function PATCH(
  request: Request,
  context: {
    params:
      | Promise<{ id: string }>
      | { id: string };
  }
) {
  try {
    const session =
      await getAuctionSession(
        request
      );

    ensureAdmin(
      session
    );

    const params =
      await Promise.resolve(
        context.params
      );

    const auctionId =
      getId(params);

    const body =
      await request
        .json()
        .catch(
          () => ({})
        );

    const action =
      String(
        body?.action ||
          ""
      )
        .trim()
        .toUpperCase();

    const pool =
      getAuctionPool();

    const client =
      await pool.connect();

    try {
      await client.query(
        "BEGIN"
      );

      const locked =
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
        locked.rows[0];

      if (!auction) {
        throw Object.assign(
          new Error(
            "İhale bulunamadı."
          ),
          {
            status: 404,
          }
        );
      }

      let eventType =
        "";

      let newValue: any =
        {};

      let updateSql =
        "";

      let updateParams:
        any[] = [
        auctionId,
      ];

      // ==================================================
      // START
      // ==================================================

      if (
        action ===
        "START"
      ) {
        if (
          auction.status !==
          "DRAFT"
        ) {
          throw Object.assign(
            new Error(
              "Sadece taslak ihale başlatılabilir."
            ),
            {
              status: 409,
            }
          );
        }

        eventType =
          "STARTED";

        newValue = {
          duration_minutes:
            auction.duration_minutes,
        };

        updateSql = `
          UPDATE public.auctions

          SET
            status = 'LIVE',

            starts_at = NOW(),

            ends_at =
              NOW() +
              (
                $2::int *
                INTERVAL '1 minute'
              ),

            paused_at = NULL,

            updated_at = NOW()

          WHERE id = $1

          RETURNING *
        `;

        updateParams.push(
          Number(
            auction.duration_minutes ||
              10
          )
        );
      }

      // ==================================================
      // PAUSE
      // ==================================================

      else if (
        action ===
        "PAUSE"
      ) {
        if (
          auction.status !==
          "LIVE"
        ) {
          throw Object.assign(
            new Error(
              "Sadece devam eden ihale duraklatılabilir."
            ),
            {
              status: 409,
            }
          );
        }

        eventType =
          "PAUSED";

        newValue = {
          paused: true,
        };

        updateSql = `
          UPDATE public.auctions

          SET
            status = 'PAUSED',
            paused_at = NOW(),
            updated_at = NOW()

          WHERE id = $1

          RETURNING *
        `;
      }

      // ==================================================
      // RESUME
      // ==================================================

      else if (
        action ===
        "RESUME"
      ) {
        if (
          auction.status !==
          "PAUSED"
        ) {
          throw Object.assign(
            new Error(
              "Sadece duraklatılmış ihale devam ettirilebilir."
            ),
            {
              status: 409,
            }
          );
        }

        eventType =
          "RESUMED";

        newValue = {
          resumed: true,
        };

        updateSql = `
          UPDATE public.auctions

          SET
            status = 'LIVE',

            ends_at =
              CASE

                WHEN ends_at IS NULL
                  THEN
                    NOW() +
                    (
                      duration_minutes *
                      INTERVAL '1 minute'
                    )

                WHEN paused_at IS NULL
                  THEN ends_at

                ELSE
                  ends_at +
                  (
                    NOW() -
                    paused_at
                  )

              END,

            paused_at = NULL,

            updated_at = NOW()

          WHERE id = $1

          RETURNING *
        `;
      }

      // ==================================================
      // EXTEND
      // ==================================================

      else if (
        action ===
        "EXTEND"
      ) {
        if (
          ![
            "LIVE",
            "PAUSED",
          ].includes(
            auction.status
          )
        ) {
          throw Object.assign(
            new Error(
              "Bu ihale uzatılamaz."
            ),
            {
              status: 409,
            }
          );
        }

        const minutes =
          Math.floor(
            numberValue(
              body?.minutes
            )
          );

        if (
          !Number.isFinite(
            minutes
          ) ||
          minutes < 1 ||
          minutes > 4320
        ) {
          throw Object.assign(
            new Error(
              "Uzatma süresi 1 dakika ile 72 saat arasında olmalıdır."
            ),
            {
              status: 400,
            }
          );
        }

        eventType =
          "EXTENDED";

        newValue = {
          minutes,
        };

        updateSql = `
          UPDATE public.auctions

          SET
            ends_at =
              COALESCE(
                ends_at,
                NOW()
              ) +
              (
                $2::int *
                INTERVAL '1 minute'
              ),

            updated_at = NOW()

          WHERE id = $1

          RETURNING *
        `;

        updateParams.push(
          minutes
        );
      }

      // ==================================================
      // END
      // ==================================================

      else if (
        action ===
        "END"
      ) {
        if (
          ![
            "LIVE",
            "PAUSED",
          ].includes(
            auction.status
          )
        ) {
          throw Object.assign(
            new Error(
              "Bu ihale bitirilemez."
            ),
            {
              status: 409,
            }
          );
        }

        eventType =
          "ENDED";

        newValue = {
          ended_manually:
            true,
        };

        updateSql = `
          UPDATE public.auctions

          SET
            status = 'ENDED',

            paused_at = NULL,

            ends_at =
              LEAST(
                COALESCE(
                  ends_at,
                  NOW()
                ),

                NOW()
              ),

            updated_at = NOW()

          WHERE id = $1

          RETURNING *
        `;
      }

      // ==================================================
      // CANCEL
      // ==================================================

      else if (
        action ===
        "CANCEL"
      ) {
        if (
          auction.status ===
          "CANCELLED"
        ) {
          throw Object.assign(
            new Error(
              "İhale zaten iptal edilmiş."
            ),
            {
              status: 409,
            }
          );
        }

        if (
          auction.status ===
          "ENDED"
        ) {
          throw Object.assign(
            new Error(
              "Bitmiş ihale iptal edilemez."
            ),
            {
              status: 409,
            }
          );
        }

        eventType =
          "CANCELLED";

        newValue = {
          cancelled:
            true,
        };

        updateSql = `
          UPDATE public.auctions

          SET
            status = 'CANCELLED',
            paused_at = NULL,
            updated_at = NOW()

          WHERE id = $1

          RETURNING *
        `;
      }

      // ==================================================
      // SELECT WINNER
      // ==================================================

      else if (
        action ===
        "SELECT_WINNER"
      ) {
        if (
          auction.status !==
          "ENDED"
        ) {
          throw Object.assign(
            new Error(
              "Kazanan sadece bitmiş ihalede seçilebilir."
            ),
            {
              status: 409,
            }
          );
        }

        const bidId =
          Number(
            body?.bidId
          );

        if (
          !Number.isInteger(
            bidId
          ) ||
          bidId <= 0
        ) {
          throw Object.assign(
            new Error(
              "Teklif seçimi geçersiz."
            ),
            {
              status: 400,
            }
          );
        }

        const bidResult =
          await client.query(
            `
              SELECT *

              FROM public.auction_bids

              WHERE
                id = $1
                AND auction_id = $2

              LIMIT 1
            `,
            [
              bidId,
              auctionId,
            ]
          );

        const bid =
          bidResult.rows[0];

        if (!bid) {
          throw Object.assign(
            new Error(
              "Teklif bulunamadı."
            ),
            {
              status: 404,
            }
          );
        }

        eventType =
          "WINNER_SELECTED";

        newValue = {
          bid_id:
            bid.id,

          anonymous_code:
            bid.anonymous_code,

          amount:
            bid.amount,
        };

        updateSql = `
          UPDATE public.auctions

          SET
            winner_bid_id = $2,

            winner_user_id = $3,

            winner_branch = $4,

            winning_amount = $5,

            updated_at = NOW()

          WHERE id = $1

          RETURNING *
        `;

        updateParams.push(
          bid.id,
          bid.bidder_user_id,
          bid.bidder_branch,
          bid.amount
        );
      }

      // ==================================================
      // INVALID ACTION
      // ==================================================

      else {
        throw Object.assign(
          new Error(
            "Geçersiz ihale işlemi."
          ),
          {
            status: 400,
          }
        );
      }

      const updated =
        await client.query(
          updateSql,
          updateParams
        );

      const updatedAuction =
        updated.rows[0];

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
            old_value,
            new_value
          )

          VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6::jsonb,
            $7::jsonb
          )
        `,
        [
          auctionId,

          eventType,

          session.userKey,

          session.userName,

          session.branch,

          JSON.stringify({
            status:
              auction.status,

            ends_at:
              auction.ends_at,

            winner_bid_id:
              auction.winner_bid_id,
          }),

          JSON.stringify(
            newValue
          ),
        ]
      );

      await client.query(
        "COMMIT"
      );

      return Response.json(
        {
          ok: true,

          auction:
            updatedAuction,
        },
        {
          headers: {
            "Cache-Control":
              "no-store",
          },
        }
      );
    } catch (error) {
      await client.query(
        "ROLLBACK"
      );

      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    return apiError(
      error
    );
  }
}

// ======================================================
// DELETE
// ======================================================
// SADECE SUPER ADMIN
//
// Sadece:
// ENDED
// CANCELLED
//
// LIVE ihale yanlışlıkla silinemez.
// ======================================================

export async function DELETE(
  request: Request,
  context: {
    params:
      | Promise<{ id: string }>
      | { id: string };
  }
) {
  try {
    const session =
      await getAuctionSession(
        request
      );

    ensureAdmin(
      session
    );

    const params =
      await Promise.resolve(
        context.params
      );

    const auctionId =
      getId(params);

    const pool =
      getAuctionPool();

    const client =
      await pool.connect();

    try {
      await client.query(
        "BEGIN"
      );

      const result =
        await client.query(
          `
            SELECT
              id,
              title,
              status

            FROM public.auctions

            WHERE id = $1

            FOR UPDATE
          `,
          [
            auctionId,
          ]
        );

      const auction =
        result.rows[0];

      if (!auction) {
        throw Object.assign(
          new Error(
            "İhale bulunamadı."
          ),
          {
            status: 404,
          }
        );
      }

      if (
        ![
          "ENDED",
          "CANCELLED",
        ].includes(
          auction.status
        )
      ) {
        throw Object.assign(
          new Error(
            "Sadece bitmiş veya iptal edilmiş ihale silinebilir."
          ),
          {
            status: 409,
          }
        );
      }

      await client.query(
        `
          DELETE FROM public.auctions

          WHERE id = $1
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
          ok: true,

          message:
            "İhale kalıcı olarak silindi.",

          deletedAuction: {
            id:
              auction.id,

            title:
              auction.title,
          },
        },
        {
          headers: {
            "Cache-Control":
              "no-store",
          },
        }
      );
    } catch (error) {
      await client.query(
        "ROLLBACK"
      );

      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    return apiError(
      error
    );
  }
}
