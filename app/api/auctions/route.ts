import {
  apiError,
  cleanAuctionText,
  closeExpiredAuctions,
  ensureAdmin,
  ensureAuctionAccess,
  getAuctionPool,
  getAuctionSession,
  numberValue,
} from "./_server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ======================================================
// GET - İHALELERİ LİSTELE
// ======================================================

export async function GET(
  request: Request
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

    const pool =
      getAuctionPool();

    const values: any[] =
      [];

    let whereSql = "";

    // ==================================================
    // SUPER ADMIN
    // ==================================================
    // Bütün ihaleleri görür:
    // DRAFT
    // LIVE
    // PAUSED
    // ENDED
    // CANCELLED
    //
    // NORMAL YÖNETİCİ / PERSONEL
    // Sadece kendi kanalındaki açık/geçmiş ihaleleri görür.
    // ==================================================

    if (
      !session.isSuperAdmin
    ) {
      values.push(
        session.channel
      );

      whereSql = `
        WHERE
          a.channel_scope IN (
            $1,
            'BOTH'
          )

          AND a.status IN (
            'LIVE',
            'PAUSED',
            'ENDED'
          )
      `;
    }

    const result =
      await pool.query(
        `
          SELECT
            a.*,

            COALESCE(
              (
                SELECT
                  MAX(b.amount)

                FROM
                  public.auction_bids b

                WHERE
                  b.auction_id = a.id
              ),

              a.starting_price
            ) AS current_price,

            (
              SELECT
                COUNT(*)::int

              FROM
                public.auction_bids b

              WHERE
                b.auction_id = a.id
            ) AS bid_count

          FROM
            public.auctions a

          ${whereSql}

          ORDER BY

            CASE a.status

              WHEN 'LIVE'
                THEN 1

              WHEN 'PAUSED'
                THEN 2

              WHEN 'DRAFT'
                THEN 3

              WHEN 'ENDED'
                THEN 4

              WHEN 'CANCELLED'
                THEN 5

              ELSE 6

            END,

            a.created_at DESC

          LIMIT 200
        `,
        values
      );

    // ==================================================
    // NORMAL KULLANICIYA GEREKSİZ KİMLİK ALANLARI YOK
    // ==================================================

    const auctions =
      session.isSuperAdmin
        ? result.rows
        : result.rows.map(
            (auction) => ({
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

              current_price:
                auction.current_price,

              bid_count:
                auction.bid_count,

              winner_bid_id:
                auction.winner_bid_id,

              winning_amount:
                auction.winning_amount,

              created_at:
                auction.created_at,

              updated_at:
                auction.updated_at,
            })
          );

    return Response.json(
      {
        ok: true,

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

        auctions,
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
// POST - YENİ İHALE
// ======================================================
//
// SADECE SUPER ADMIN
//
// durationMinutes:
// minimum 1 dakika
// maximum 4320 dakika = 72 saat
// ======================================================

export async function POST(
  request: Request
) {
  try {
    const session =
      await getAuctionSession(
        request
      );

    ensureAdmin(
      session
    );

    const body =
      await request
        .json()
        .catch(
          () => ({})
        );

    // ==================================================
    // FORM
    // ==================================================

    const title =
      cleanAuctionText(
        body?.title,
        180
      );

    const itemName =
      cleanAuctionText(
        body?.itemName,
        180
      );

    const itemDescription =
      cleanAuctionText(
        body?.itemDescription,
        2000
      );

    const itemImageUrl =
      cleanAuctionText(
        body?.itemImageUrl,
        1000
      );

    const channelScope =
      cleanAuctionText(
        body?.channelScope,
        20
      ).toUpperCase();

    const startingPrice =
      numberValue(
        body?.startingPrice
      );

    const minIncrement =
      numberValue(
        body?.minIncrement
      );

    const durationMinutes =
      Math.floor(
        numberValue(
          body?.durationMinutes
        )
      );

    // ==================================================
    // VALIDATION
    // ==================================================

    if (
      !title ||
      !itemName
    ) {
      throw Object.assign(
        new Error(
          "İhale başlığı ve ürün adı zorunludur."
        ),
        {
          status: 400,
        }
      );
    }

    if (
      ![
        "CMR",
        "VODAFONE",
        "BOTH",
      ].includes(
        channelScope
      )
    ) {
      throw Object.assign(
        new Error(
          "Kanal kapsamı geçersiz."
        ),
        {
          status: 400,
        }
      );
    }

    if (
      !Number.isFinite(
        startingPrice
      ) ||
      startingPrice < 0
    ) {
      throw Object.assign(
        new Error(
          "Başlangıç fiyatı geçersiz."
        ),
        {
          status: 400,
        }
      );
    }

    if (
      !Number.isFinite(
        minIncrement
      ) ||
      minIncrement <= 0
    ) {
      throw Object.assign(
        new Error(
          "Minimum artış geçersiz."
        ),
        {
          status: 400,
        }
      );
    }

    // 72 SAAT
    if (
      !Number.isFinite(
        durationMinutes
      ) ||
      durationMinutes < 1 ||
      durationMinutes > 4320
    ) {
      throw Object.assign(
        new Error(
          "İhale süresi 1 dakika ile 72 saat arasında olmalıdır."
        ),
        {
          status: 400,
        }
      );
    }

    // ==================================================
    // DATABASE
    // ==================================================

    const pool =
      getAuctionPool();

    const client =
      await pool.connect();

    try {
      await client.query(
        "BEGIN"
      );

      const created =
        await client.query(
          `
            INSERT INTO public.auctions (
              title,
              item_name,
              item_description,
              item_image_url,

              channel_scope,

              starting_price,
              min_increment,
              duration_minutes,

              status,

              created_by_user_id,
              created_by_name
            )

            VALUES (
              $1,
              $2,
              $3,
              $4,
              $5,
              $6,
              $7,
              $8,
              'DRAFT',
              $9,
              $10
            )

            RETURNING *
          `,
          [
            title,

            itemName,

            itemDescription ||
              null,

            itemImageUrl ||
              null,

            channelScope,

            startingPrice,

            minIncrement,

            durationMinutes,

            session.userKey,

            session.userName,
          ]
        );

      const auction =
        created.rows[0];

      // ==================================================
      // EVENT
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
            'CREATED',

            $2,
            $3,
            $4,

            jsonb_build_object(

              'title',
              $5::text,

              'item_name',
              $6::text,

              'channel_scope',
              $7::text,

              'starting_price',
              $8::numeric,

              'min_increment',
              $9::numeric,

              'duration_minutes',
              $10::int

            )
          )
        `,
        [
          auction.id,

          session.userKey,

          session.userName,

          session.branch,

          title,

          itemName,

          channelScope,

          startingPrice,

          minIncrement,

          durationMinutes,
        ]
      );

      await client.query(
        "COMMIT"
      );

      return Response.json(
        {
          ok: true,

          auction,
        },
        {
          status: 201,

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
