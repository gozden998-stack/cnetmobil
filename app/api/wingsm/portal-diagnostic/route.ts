// app/api/wingsm/portal-diagnostic/route.ts
//
// CNETMOBIL - WingSM WEB PORTAL bağlantı testi
//
// AMAÇ:
// - Login YAPMAZ.
// - Kullanıcı adı / şifre göndermez.
// - Cookie / token döndürmez.
// - Coolify sunucusundan WingSM portalına erişimi test eder.
// - www / non-www farkını kontrol eder.
// - Portal endpointlerinin HTTP durumunu gösterir.
//
// Test:
// /api/wingsm/portal-diagnostic
//
// Sadece panel ADMIN oturumu ile çalışır.
//

import {
  NextRequest,
  NextResponse,
} from "next/server";

import crypto from "crypto";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

export const revalidate =
  0;

const COOKIE_NAME =
  "cnet_auth";

type SessionPayload = {
  userId:
    | number
    | null;

  role:
    | "admin"
    | "personel";

  branch:
    string;

  exp:
    number;

  legacy?:
    boolean;
};

function json(
  body: Record<
    string,
    unknown
  >,
  status = 200
) {
  return NextResponse.json(
    body,
    {
      status,

      headers: {
        "Cache-Control":
          "no-store, max-age=0",

        Pragma:
          "no-cache",
      },
    }
  );
}

function getSessionSecret() {
  const value =
    String(
      process.env
        .SESSION_SECRET ||
        ""
    ).trim();

  if (!value) {
    throw new Error(
      "SESSION_SECRET bulunamadı."
    );
  }

  return value;
}

function verifySession(
  token: string
): SessionPayload | null {
  try {
    const [
      encoded,
      signature,
    ] =
      token.split(".");

    if (
      !encoded ||
      !signature
    ) {
      return null;
    }

    const expected =
      crypto
        .createHmac(
          "sha256",
          getSessionSecret()
        )
        .update(
          encoded
        )
        .digest(
          "base64url"
        );

    const a =
      Buffer.from(
        signature,
        "utf8"
      );

    const b =
      Buffer.from(
        expected,
        "utf8"
      );

    if (
      a.length !==
      b.length
    ) {
      return null;
    }

    if (
      !crypto.timingSafeEqual(
        a,
        b
      )
    ) {
      return null;
    }

    const payload =
      JSON.parse(
        Buffer.from(
          encoded,
          "base64url"
        ).toString(
          "utf8"
        )
      ) as SessionPayload;

    if (
      !payload ||
      !payload.exp
    ) {
      return null;
    }

    if (
      payload.exp <
      Math.floor(
        Date.now() /
          1000
      )
    ) {
      return null;
    }

    if (
      payload.role !==
      "admin" &&
      payload.role !==
      "personel"
    ) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

function requireAdmin(
  request: NextRequest
) {
  const token =
    request.cookies.get(
      COOKIE_NAME
    )?.value;

  if (!token) {
    return {
      ok:
        false as const,

      response:
        json(
          {
            success:
              false,

            message:
              "Oturum bulunamadı.",
          },
          401
        ),
    };
  }

  const session =
    verifySession(
      token
    );

  if (!session) {
    return {
      ok:
        false as const,

      response:
        json(
          {
            success:
              false,

            message:
              "Oturum geçersiz.",
          },
          401
        ),
    };
  }

  if (
    session.role !==
    "admin"
  ) {
    return {
      ok:
        false as const,

      response:
        json(
          {
            success:
              false,

            message:
              "Admin yetkisi gerekli.",
          },
          403
        ),
    };
  }

  return {
    ok:
      true as const,

    session,
  };
}

function cleanPreview(
  value: string
) {
  return String(
    value ||
      ""
  )
    .replace(
      /<script[\s\S]*?<\/script>/gi,
      " "
    )
    .replace(
      /<style[\s\S]*?<\/style>/gi,
      " "
    )
    .replace(
      /<[^>]+>/g,
      " "
    )
    .replace(
      /&nbsp;/gi,
      " "
    )
    .replace(
      /&amp;/gi,
      "&"
    )
    .replace(
      /\s+/g,
      " "
    )
    .trim()
    .slice(
      0,
      500
    );
}

async function probe(
  name: string,
  url: string
) {
  const startedAt =
    Date.now();

  const controller =
    new AbortController();

  const timeout =
    setTimeout(
      () => {
        controller.abort();
      },
      12_000
    );

  try {
    const response =
      await fetch(
        url,
        {
          method:
            "GET",

          redirect:
            "manual",

          cache:
            "no-store",

          signal:
            controller.signal,

          headers: {
            Accept:
              "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",

            "Accept-Language":
              "tr-TR,tr;q=0.9,en;q=0.8",

            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/152 Safari/537.36",
          },
        }
      );

    const text =
      await response
        .text()
        .catch(
          () =>
            ""
        );

    return {
      name,

      url,

      reachable:
        true,

      status:
        response.status,

      statusText:
        response.statusText,

      contentType:
        response.headers.get(
          "content-type"
        ),

      location:
        response.headers.get(
          "location"
        ),

      server:
        response.headers.get(
          "server"
        ),

      /*
       * Set-Cookie özellikle DÖNDÜRMÜYORUZ.
       */

      bodyPreview:
        cleanPreview(
          text
        ),

      responseTimeMs:
        Date.now() -
        startedAt,
    };
  } catch (
    error
  ) {
    return {
      name,

      url,

      reachable:
        false,

      error:
        error instanceof
        Error
          ? error.message
          : String(
              error
            ),

      responseTimeMs:
        Date.now() -
        startedAt,
    };
  } finally {
    clearTimeout(
      timeout
    );
  }
}

function wingDateNumber() {
  const parts =
    new Intl
      .DateTimeFormat(
        "en-CA",
        {
          timeZone:
            "Europe/Istanbul",

          year:
            "numeric",

          month:
            "2-digit",

          day:
            "2-digit",
        }
      )
      .formatToParts(
        new Date()
      );

  const year =
    parts.find(
      (x) =>
        x.type ===
        "year"
    )?.value;

  const month =
    parts.find(
      (x) =>
        x.type ===
        "month"
    )?.value;

  const day =
    parts.find(
      (x) =>
        x.type ===
        "day"
    )?.value;

  return `${year}${month}${day}`;
}

export async function GET(
  request: NextRequest
) {
  const auth =
    requireAdmin(
      request
    );

  if (!auth.ok) {
    return auth.response;
  }

  const startedAt =
    Date.now();

  const tarihN =
    wingDateNumber();

  const tests =
    await Promise.all([
      probe(
        "PORTAL_ROOT",
        "https://ports.wingsmonline.com/"
      ),

      probe(
        "PORTAL_ROOT_WWW",
        "https://www.ports.wingsmonline.com/"
      ),

      probe(
        "AKTIF_KULLANICI_NO_SESSION",
        "https://ports.wingsmonline.com/Http/AktifKullanici"
      ),

      probe(
        "PERSONNEL_NO_SESSION",
        `https://ports.wingsmonline.com/HttpApiHizliSatis/HizliSatisInitilas?TarihN=${tarihN}`
      ),
    ]);

  return json({
    success:
      true,

    diagnostic:
      "WINGSM_PORTAL",

    note:
      "Bu test login yapmaz ve hiçbir credential/cookie döndürmez.",

    tests,

    responseTimeMs:
      Date.now() -
      startedAt,
  });
}
