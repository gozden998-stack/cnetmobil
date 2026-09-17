// app/api/wingsm/personnel/route.ts
// CNETMOBIL - WingSM personel listesi
//
// KURAL:
// - WingSM'e sadece READ yapılır.
// - Şube filtresi YOK: WingSM'deki tüm personeller döner.
// - Token / kullanıcı / şifre frontend'e verilmez.
// - Personel endpoint'i env ile tanımlanır:
//     WINGSM_PERSONNEL_PATH=/api/.../...
//
// Mevcut WingSM auth yapısı:
// POST /api/authenticate
// header: x-access-token

import {
  NextRequest,
  NextResponse,
} from "next/server";

import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const COOKIE_NAME = "cnet_auth";

type SessionPayload = {
  userId: number | null;
  role: "admin" | "personel";
  branch: string;
  exp: number;
  legacy?: boolean;
};

type AuthPayload = {
  token?: string;
  accessToken?: string;
  access_token?: string;
  data?: any;
  message?: string;
  error?: string;
  success?: boolean;
};

type NormalizedPersonnel = {
  id: string;
  name: string;
  code: string | null;
  active: boolean | null;
};

function json(
  body: Record<string, unknown>,
  status = 200
) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control":
        "no-store, max-age=0",
      Pragma: "no-cache",
      "X-Content-Type-Options":
        "nosniff",
    },
  });
}

function getSessionSecret() {
  const secret = String(
    process.env.SESSION_SECRET || ""
  ).trim();

  if (!secret) {
    throw new Error(
      "SESSION_SECRET bulunamadı."
    );
  }

  return secret;
}

function verifySession(
  token: string
): SessionPayload | null {
  try {
    const [encoded, signature] =
      token.split(".");

    if (!encoded || !signature) {
      return null;
    }

    const expected = crypto
      .createHmac(
        "sha256",
        getSessionSecret()
      )
      .update(encoded)
      .digest("base64url");

    const a = Buffer.from(
      signature,
      "utf8"
    );

    const b = Buffer.from(
      expected,
      "utf8"
    );

    if (
      a.length !== b.length ||
      !crypto.timingSafeEqual(a, b)
    ) {
      return null;
    }

    const payload = JSON.parse(
      Buffer.from(
        encoded,
        "base64url"
      ).toString("utf8")
    ) as SessionPayload;

    if (
      !payload?.exp ||
      payload.exp <
        Math.floor(Date.now() / 1000)
    ) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

function requireSession(
  request: NextRequest
) {
  const token =
    request.cookies.get(COOKIE_NAME)
      ?.value || "";

  const session = verifySession(token);

  if (!session) {
    return {
      ok: false as const,
      response: json(
        {
          success: false,
          error: "Oturum gerekli.",
        },
        401
      ),
    };
  }

  return {
    ok: true as const,
    session,
  };
}

function pickToken(
  payload: AuthPayload | null
) {
  if (!payload) {
    return null;
  }

  const candidates = [
    payload.token,
    payload.accessToken,
    payload.access_token,
    payload.data?.token,
    payload.data?.accessToken,
    payload.data?.access_token,
    typeof payload.data === "string"
      ? payload.data
      : null,
  ];

  for (const candidate of candidates) {
    if (
      typeof candidate === "string" &&
      candidate.trim()
    ) {
      return candidate.trim();
    }
  }

  return null;
}

function firstValue(
  row: Record<string, any>,
  keys: string[]
) {
  for (const key of keys) {
    const value = row?.[key];

    if (
      value !== undefined &&
      value !== null &&
      String(value).trim() !== ""
    ) {
      return value;
    }
  }

  return null;
}

function asName(
  row: Record<string, any>
) {
  const direct = firstValue(
    row,
    [
      "AdSoyad",
      "adSoyad",
      "ADSOYAD",
      "PersonelAdSoyad",
      "personelAdSoyad",
      "PersonelAdi",
      "personelAdi",
      "FullName",
      "fullName",
      "Name",
      "name",
      "KullaniciAd",
      "kullaniciAd",
      "UserName",
      "userName",
    ]
  );

  if (direct) {
    return String(direct).trim();
  }

  const firstName = firstValue(
    row,
    [
      "Ad",
      "ad",
      "Adi",
      "adi",
      "FirstName",
      "firstName",
    ]
  );

  const lastName = firstValue(
    row,
    [
      "Soyad",
      "soyad",
      "Soyadi",
      "soyadi",
      "LastName",
      "lastName",
    ]
  );

  const combined = [
    firstName,
    lastName,
  ]
    .filter(Boolean)
    .map((value) =>
      String(value).trim()
    )
    .join(" ")
    .trim();

  return combined;
}

function asId(
  row: Record<string, any>
) {
  const value = firstValue(
    row,
    [
      "Id",
      "id",
      "ID",
      "PersonelId",
      "personelId",
      "PersonelID",
      "personelID",
      "KullaniciId",
      "kullaniciId",
      "UserId",
      "userId",
      "SicilNo",
      "sicilNo",
      "Kod",
      "kod",
    ]
  );

  return value === null
    ? ""
    : String(value).trim();
}

function asCode(
  row: Record<string, any>
) {
  const value = firstValue(
    row,
    [
      "PersonelKod",
      "personelKod",
      "Kod",
      "kod",
      "Code",
      "code",
      "SicilNo",
      "sicilNo",
    ]
  );

  return value === null
    ? null
    : String(value).trim();
}

function asActive(
  row: Record<string, any>
): boolean | null {
  const value = firstValue(
    row,
    [
      "Aktif",
      "aktif",
      "Active",
      "active",
      "IsActive",
      "isActive",
    ]
  );

  if (value === null) {
    return null;
  }

  if (typeof value === "boolean") {
    return value;
  }

  const text = String(value)
    .trim()
    .toLowerCase();

  if (
    [
      "1",
      "true",
      "yes",
      "evet",
      "aktif",
    ].includes(text)
  ) {
    return true;
  }

  if (
    [
      "0",
      "false",
      "no",
      "hayır",
      "hayir",
      "pasif",
    ].includes(text)
  ) {
    return false;
  }

  return null;
}

function findBestArray(
  payload: any
): any[] {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (
    !payload ||
    typeof payload !== "object"
  ) {
    return [];
  }

  const preferredKeys = [
    "personel",
    "personeller",
    "personnel",
    "employees",
    "employeeList",
    "users",
    "userList",
    "list",
    "rows",
    "items",
    "data",
    "result",
    "results",
  ];

  for (const key of preferredKeys) {
    const value = payload?.[key];

    if (Array.isArray(value)) {
      return value;
    }
  }

  for (const value of Object.values(
    payload
  )) {
    if (Array.isArray(value)) {
      return value;
    }

    if (
      value &&
      typeof value === "object"
    ) {
      const nested =
        findBestArray(value);

      if (nested.length) {
        return nested;
      }
    }
  }

  return [];
}

function normalizePersonnel(
  payload: any
): NormalizedPersonnel[] {
  const rows =
    findBestArray(payload);

  const normalized =
    rows
      .filter(
        (row) =>
          row &&
          typeof row === "object"
      )
      .map(
        (
          row: Record<
            string,
            any
          >,
          index
        ) => {
          const name = asName(row);
          const rawId = asId(row);
          const code = asCode(row);
          const active =
            asActive(row);

          return {
            id:
              rawId ||
              code ||
              `ROW-${index + 1}`,
            name,
            code,
            active,
          };
        }
      )
      .filter(
        (item) =>
          item.name.length >= 2
      );

  const unique =
    new Map<
      string,
      NormalizedPersonnel
    >();

  for (const item of normalized) {
    const key = `${item.id}|${item.name}`
      .toLocaleLowerCase("tr-TR");

    if (!unique.has(key)) {
      unique.set(key, item);
    }
  }

  return Array.from(
    unique.values()
  ).sort((a, b) =>
    a.name.localeCompare(
      b.name,
      "tr-TR"
    )
  );
}

async function authenticateWingSM(
  baseUrl: string,
  user: string,
  password: string
) {
  const response = await fetch(
    `${baseUrl}/api/authenticate`,
    {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type":
          "application/json",
        Accept:
          "application/json",
      },
      body: JSON.stringify({
        user,
        password,
      }),
      signal:
        AbortSignal.timeout(
          15_000
        ),
    }
  );

  const raw = await response.text();

  let data: AuthPayload | null =
    null;

  try {
    data = raw
      ? JSON.parse(raw)
      : null;
  } catch {
    throw new Error(
      "WingSM authenticate cevabı JSON değil."
    );
  }

  const token =
    pickToken(data);

  if (
    !response.ok ||
    !token
  ) {
    throw new Error(
      data?.message ||
        data?.error ||
        "WingSM authenticate başarısız."
    );
  }

  return token;
}

export async function GET(
  request: NextRequest
) {
  const startedAt = Date.now();

  try {
    const auth =
      requireSession(request);

    if (!auth.ok) {
      return auth.response;
    }

    const baseUrl = String(
      process.env.WINGSM_BASE_URL ||
        ""
    )
      .trim()
      .replace(/\/+$/, "");

    const user = String(
      process.env.WINGSM_USER ||
        ""
    ).trim();

    const password = String(
      process.env
        .WINGSM_PASSWORD || ""
    );

    const personnelPath = String(
      process.env
        .WINGSM_PERSONNEL_PATH ||
        ""
    ).trim();

    if (
      !baseUrl ||
      !user ||
      !password
    ) {
      return json(
        {
          success: false,
          error:
            "WingSM environment ayarları eksik.",
        },
        500
      );
    }

    if (!personnelPath) {
      return json(
        {
          success: false,
          error:
            "WINGSM_PERSONNEL_PATH tanımlı değil.",
          message:
            "WingSM personel endpoint path'i Coolify environment'a eklenmeli.",
        },
        500
      );
    }

    if (
      !personnelPath.startsWith(
        "/"
      )
    ) {
      return json(
        {
          success: false,
          error:
            "WINGSM_PERSONNEL_PATH / ile başlamalı.",
        },
        500
      );
    }

    const token =
      await authenticateWingSM(
        baseUrl,
        user,
        password
      );

    const response = await fetch(
      `${baseUrl}${personnelPath}`,
      {
        method: "GET",
        cache: "no-store",
        headers: {
          Accept:
            "application/json",
          "Content-Type":
            "application/json",
          "x-access-token":
            token,
        },
        signal:
          AbortSignal.timeout(
            20_000
          ),
      }
    );

    const raw =
      await response.text();

    let data: any = null;

    try {
      data = raw
        ? JSON.parse(raw)
        : null;
    } catch {
      return json(
        {
          success: false,
          error:
            "WingSM personel cevabı JSON değil.",
          httpStatus:
            response.status,
        },
        502
      );
    }

    if (!response.ok) {
      return json(
        {
          success: false,
          error:
            data?.message ||
            data?.error ||
            `WingSM personel isteği HTTP ${response.status}`,
          httpStatus:
            response.status,
        },
        502
      );
    }

    const personnel =
      normalizePersonnel(data);

    return json({
      success: true,
      source: "WINGSM",
      personnel,
      count: personnel.length,
      responseTimeMs:
        Date.now() - startedAt,
      checkedAt:
        new Date().toISOString(),
    });
  } catch (error) {
    console.error(
      "WINGSM PERSONNEL ERROR:",
      error
    );

    return json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "WingSM personel listesi alınamadı.",
      },
      500
    );
  }
}
