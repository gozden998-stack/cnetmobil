// app/lib/wingsm/server.ts
// CNETMOBIL - WingSM ortak server yardımcıları
// Kullanıcı adı / şifre / token sadece server tarafında kalır.

export const runtime = "nodejs";

// ======================================================
// TYPES
// ======================================================

type WingSMAuthResponse = {
  success?: boolean;
  token?: string;
  accessToken?: string;
  access_token?: string;
  data?: any;
  message?: string;
  error?: string;
};

type WingSMRequestOptions = {
  method?: "GET" | "POST";
  query?: Record<
    string,
    string | number | boolean | null | undefined
  >;
  body?: unknown;
};

type WingSMTokenCache = {
  token: string;
  expiresAt: number;
};

// ======================================================
// GLOBAL TOKEN CACHE
// ======================================================

declare global {
  // eslint-disable-next-line no-var
  var cnetWingSMTokenCache:
    | WingSMTokenCache
    | undefined;

  // Aynı anda birden fazla token isteği gitmesini engeller.
  // eslint-disable-next-line no-var
  var cnetWingSMTokenPromise:
    | Promise<string>
    | undefined;
}

// ======================================================
// ENV
// ======================================================

function getBaseUrl() {
  const value =
    process.env.WINGSM_BASE_URL?.trim();

  if (!value) {
    throw new Error(
      "WINGSM_BASE_URL bulunamadı."
    );
  }

  return value.replace(
    /\/+$/,
    ""
  );
}

function getUsername() {
  const value =
    process.env.WINGSM_USER?.trim();

  if (!value) {
    throw new Error(
      "WINGSM_USER bulunamadı."
    );
  }

  return value;
}

function getPassword() {
  const value =
    process.env.WINGSM_PASSWORD;

  if (!value) {
    throw new Error(
      "WINGSM_PASSWORD bulunamadı."
    );
  }

  return value;
}

// ======================================================
// MAĞAZA / DEPO EŞLEŞMESİ
// ======================================================
//
// PANEL          WINGSM
// CNET           CNET
// CMR            CMR
// SARAY          SARAYCMR
// KAPAKLI        KAPAKLICMR
// CADDE          CADDE
//
// Mevcut panelde CMR MERKEZ / CMR SARAY gibi isimler
// gelirse de otomatik çevrilir.
// ======================================================

export const WINGSM_DEPOT_MAP = {
  CNET: "CNET",
  CMR: "CMR",
  SARAY: "SARAYCMR",
  KAPAKLI: "KAPAKLICMR",
  CADDE: "CADDE",
} as const;

export type PanelWingSMBranch =
  keyof typeof WINGSM_DEPOT_MAP;

export type WingSMDepotCode =
  (typeof WINGSM_DEPOT_MAP)[PanelWingSMBranch];

// ======================================================
// STRING NORMALIZE
// ======================================================

function normalizeBranch(
  value: unknown
) {
  return String(
    value ?? ""
  )
    .trim()
    .toLocaleUpperCase(
      "tr-TR"
    );
}

// ======================================================
// PANEL MAĞAZASI -> WINGSM DEPO
// ======================================================

export function getWingSMDepotForBranch(
  branch: string
): WingSMDepotCode | null {
  const normalized =
    normalizeBranch(
      branch
    );

  // CNET
  if (
    normalized === "CNET" ||
    normalized === "CNET DEPO" ||
    normalized === "CNETMOBIL"
  ) {
    return "CNET";
  }

  // CMR
  if (
    normalized === "CMR" ||
    normalized ===
      "CMR MERKEZ"
  ) {
    return "CMR";
  }

  // CADDE
  if (
    normalized ===
      "CADDE" ||
    normalized ===
      "CMR CADDE"
  ) {
    return "CADDE";
  }

  // SARAY
  if (
    normalized ===
      "SARAY" ||
    normalized ===
      "CMR SARAY" ||
    normalized ===
      "SARAYCMR"
  ) {
    return "SARAYCMR";
  }

  // KAPAKLI
  if (
    normalized ===
      "KAPAKLI" ||
    normalized ===
      "CMR KAPAKLI" ||
    normalized ===
      "KAPAKLICMR"
  ) {
    return "KAPAKLICMR";
  }

  return null;
}

// ======================================================
// WINGSM DEPO -> PANEL MAĞAZASI
// ======================================================

export function getPanelBranchForWingSMDepot(
  depot: string
): PanelWingSMBranch | null {
  const normalized =
    normalizeBranch(
      depot
    );

  if (
    normalized === "CNET"
  ) {
    return "CNET";
  }

  if (
    normalized === "CMR"
  ) {
    return "CMR";
  }

  if (
    normalized ===
    "SARAYCMR"
  ) {
    return "SARAY";
  }

  if (
    normalized ===
    "KAPAKLICMR"
  ) {
    return "KAPAKLI";
  }

  if (
    normalized ===
    "CADDE"
  ) {
    return "CADDE";
  }

  return null;
}

// ======================================================
// TOKEN RESPONSE'DAN TOKEN BUL
// ======================================================

function extractToken(
  payload: WingSMAuthResponse
) {
  const candidates = [
    payload?.token,
    payload?.accessToken,
    payload?.access_token,

    payload?.data?.token,
    payload?.data?.accessToken,
    payload?.data?.access_token,

    typeof payload?.data ===
    "string"
      ? payload.data
      : null,
  ];

  for (
    const candidate of
    candidates
  ) {
    if (
      typeof candidate ===
        "string" &&
      candidate.trim()
    ) {
      return candidate.trim();
    }
  }

  return null;
}

// ======================================================
// AUTH TOKEN
// ======================================================

async function requestNewToken() {
  const response =
    await fetch(
      `${getBaseUrl()}/api/authenticate`,
      {
        method: "POST",

        cache:
          "no-store",

        headers: {
          "Content-Type":
            "application/json",
          Accept:
            "application/json",
        },

        body:
          JSON.stringify({
            user:
              getUsername(),

            password:
              getPassword(),
          }),

        signal:
          AbortSignal.timeout(
            15000
          ),
      }
    );

  const raw =
    await response.text();

  let payload:
    WingSMAuthResponse =
    {};

  try {
    payload =
      raw
        ? JSON.parse(raw)
        : {};
  } catch {
    throw new Error(
      `WingSM authenticate JSON dönmedi. HTTP ${response.status}`
    );
  }

  if (!response.ok) {
    throw new Error(
      payload?.message ||
        payload?.error ||
        `WingSM authenticate başarısız. HTTP ${response.status}`
    );
  }

  const token =
    extractToken(
      payload
    );

  if (!token) {
    throw new Error(
      "WingSM authenticate başarılı görünüyor ancak token bulunamadı."
    );
  }

  // WingSM dokümanında token yaklaşık 15 dakika.
  // Biz güvenli tarafta kalıp 14 dakika cache tutuyoruz.
  const expiresAt =
    Date.now() +
    14 * 60 * 1000;

  global.cnetWingSMTokenCache =
    {
      token,
      expiresAt,
    };

  return token;
}

// ======================================================
// GET TOKEN
// ======================================================

export async function getWingSMToken(
  forceRefresh = false
) {
  const cached =
    global.cnetWingSMTokenCache;

  if (
    !forceRefresh &&
    cached &&
    cached.token &&
    cached.expiresAt >
      Date.now()
  ) {
    return cached.token;
  }

  if (
    !forceRefresh &&
    global.cnetWingSMTokenPromise
  ) {
    return global.cnetWingSMTokenPromise;
  }

  global.cnetWingSMTokenPromise =
    requestNewToken();

  try {
    return await global
      .cnetWingSMTokenPromise;
  } finally {
    global.cnetWingSMTokenPromise =
      undefined;
  }
}

// ======================================================
// TOKEN TEMİZLE
// ======================================================

export function clearWingSMToken() {
  global.cnetWingSMTokenCache =
    undefined;

  global.cnetWingSMTokenPromise =
    undefined;
}

// ======================================================
// QUERY URL
// ======================================================

function buildUrl(
  path: string,
  query?: WingSMRequestOptions["query"]
) {
  const cleanPath =
    path.startsWith("/")
      ? path
      : `/${path}`;

  const url =
    new URL(
      `${getBaseUrl()}${cleanPath}`
    );

  if (query) {
    for (
      const [
        key,
        value,
      ] of Object.entries(
        query
      )
    ) {
      if (
        value === null ||
        value === undefined ||
        value === ""
      ) {
        continue;
      }

      url.searchParams.set(
        key,
        String(value)
      );
    }
  }

  return url.toString();
}

// ======================================================
// ORTAK WINGSM REQUEST
// ======================================================

export async function wingSMRequest<T = any>(
  path: string,
  options: WingSMRequestOptions = {}
): Promise<T> {
  const method =
    options.method ||
    "GET";

  let token =
    await getWingSMToken();

  const makeRequest =
    async (
      currentToken: string
    ) => {
      return fetch(
        buildUrl(
          path,
          options.query
        ),
        {
          method,

          cache:
            "no-store",

          headers: {
            Accept:
              "application/json",

            "Content-Type":
              "application/json",

            "x-access-token":
              currentToken,
          },

          body:
            method === "POST"
              ? JSON.stringify(
                  options.body ??
                    {}
                )
              : undefined,

          signal:
            AbortSignal.timeout(
              20000
            ),
        }
      );
    };

  let response =
    await makeRequest(
      token
    );

  // Token süresi dolmuşsa bir defa yeniden token al.
  if (
    response.status === 401 ||
    response.status === 403
  ) {
    clearWingSMToken();

    token =
      await getWingSMToken(
        true
      );

    response =
      await makeRequest(
        token
      );
  }

  const raw =
    await response.text();

  let payload: any =
    null;

  try {
    payload =
      raw
        ? JSON.parse(raw)
        : null;
  } catch {
    throw new Error(
      `WingSM API JSON dönmedi. HTTP ${response.status}`
    );
  }

  if (!response.ok) {
    const message =
      payload?.message ||
      payload?.error ||
      `WingSM API isteği başarısız. HTTP ${response.status}`;

    throw new Error(
      message
    );
  }

  return payload as T;
}

// ======================================================
// WINGSM STOK
// ======================================================
//
// Dokümandaki:
// GET /api/b2b/stok/list
//
// depo = WingSM depo kodu
// stok = 1 -> sadece stoğu olanlar
// stok = 0 -> tüm stoklar
// ======================================================

export async function getWingSMStock(
  depot: string,
  onlyInStock = true
) {
  return wingSMRequest(
    "/api/b2b/stok/list",
    {
      method:
        "GET",

      query: {
        depo:
          depot,

        stok:
          onlyInStock
            ? 1
            : 0,
      },
    }
  );
}

// ======================================================
// PANEL MAĞAZASINA GÖRE STOK
// ======================================================

export async function getWingSMStockByBranch(
  branch: string,
  onlyInStock = true
) {
  const depot =
    getWingSMDepotForBranch(
      branch
    );

  if (!depot) {
    throw new Error(
      `WingSM depo eşleşmesi bulunamadı: ${branch}`
    );
  }

  const data =
    await getWingSMStock(
      depot,
      onlyInStock
    );

  return {
    branch:
      normalizeBranch(
        branch
      ),

    depot,

    data,
  };
}

// ======================================================
// TEK ÜRÜN - ID
// ======================================================

export async function getWingSMProductById(
  id: string | number
) {
  return wingSMRequest(
    `/api/b2b/urun/${encodeURIComponent(
      String(id)
    )}`
  );
}

// ======================================================
// TEK ÜRÜN - KOD / BARKOD
// ======================================================

export async function getWingSMProductByCode(
  code: string
) {
  return wingSMRequest(
    `/api/b2b/urun/kod/${encodeURIComponent(
      code
    )}`
  );
}

// ======================================================
// HEALTH CONFIG
// ======================================================

export function getWingSMConfigStatus() {
  return {
    configured: Boolean(
      process.env
        .WINGSM_BASE_URL &&
        process.env
          .WINGSM_USER &&
        process.env
          .WINGSM_PASSWORD
    ),

    hasBaseUrl:
      Boolean(
        process.env
          .WINGSM_BASE_URL
      ),

    hasUser:
      Boolean(
        process.env
          .WINGSM_USER
      ),

    hasPassword:
      Boolean(
        process.env
          .WINGSM_PASSWORD
      ),

    depots: {
      CNET:
        "CNET",

      CMR:
        "CMR",

      SARAY:
        "SARAYCMR",

      KAPAKLI:
        "KAPAKLICMR",

      CADDE:
        "CADDE",
    },
  };
}
