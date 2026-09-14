// app/lib/wingsm/server.ts
// CNETMOBIL - WingSM ortak server yardımcıları
//
// KURALLAR:
// - Kullanıcı adı / şifre / token sadece server tarafında kalır.
// - WingSM HTTP 200 dönse bile payload.success === false ise işlem başarısız sayılır.
// - Token yaklaşık 15 dakika geçerli.
// - Biz güvenli tarafta 14 dakika cache tutuyoruz.
// - Stok sorgusunda sadece 2. el ve stoğu olan ürünler alınır.
// - Mevcut Cihaz Talep / stok akışı korunur.

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
    | string
    | number
    | boolean
    | null
    | undefined
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

  // Aynı anda birden fazla authenticate isteğinin
  // gitmesini engeller.
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
    process.env
      .WINGSM_BASE_URL
      ?.trim();

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
    process.env
      .WINGSM_USER
      ?.trim();

  if (!value) {
    throw new Error(
      "WINGSM_USER bulunamadı."
    );
  }

  return value;
}

function getPassword() {
  const value =
    process.env
      .WINGSM_PASSWORD;

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
// CMR MERKEZ / CMR SARAY / CMR KAPAKLI gibi
// eski isimler de desteklenmeye devam eder.
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
    normalized ===
      "CNET" ||
    normalized ===
      "CNET DEPO" ||
    normalized ===
      "CNETMOBIL"
  ) {
    return "CNET";
  }

  // CMR
  if (
    normalized ===
      "CMR" ||
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
    payload?.data
      ?.accessToken,
    payload?.data
      ?.access_token,

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
// WINGSM PAYLOAD MESAJI
// ======================================================

function getWingSMMessage(
  payload: any,
  fallback: string
) {
  if (
    typeof payload?.message ===
      "string" &&
    payload.message.trim()
  ) {
    return payload.message.trim();
  }

  if (
    typeof payload?.error ===
      "string" &&
    payload.error.trim()
  ) {
    return payload.error.trim();
  }

  return fallback;
}

// ======================================================
// WINGSM APPLICATION-LEVEL ERROR
// ======================================================
//
// ÖNEMLİ:
//
// WingSM bazı hatalarda HTTP 200 dönüyor:
//
// {
//   "success": false,
//   "message": "No valid source ..."
// }
//
// Sadece response.ok kontrol edilirse bu cevap yanlışlıkla
// başarılı kabul edilir.
//
// Bu fonksiyon HTTP'den bağımsız olarak WingSM payload'ını
// kontrol eder.
// ======================================================

function isWingSMFailure(
  payload: any
) {
  return (
    payload &&
    typeof payload ===
      "object" &&
    payload.success === false
  );
}

// ======================================================
// SOURCE / IP HATASI
// ======================================================

function isSourceError(
  payload: any
) {
  const message =
    getWingSMMessage(
      payload,
      ""
    );

  return (
    /no valid source/i.test(
      message
    )
  );
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

  // HTTP hata
  if (!response.ok) {
    throw new Error(
      getWingSMMessage(
        payload,
        `WingSM authenticate başarısız. HTTP ${response.status}`
      )
    );
  }

  // HTTP 200 ama WingSM success:false
  if (
    payload?.success ===
    false
  ) {
    throw new Error(
      getWingSMMessage(
        payload,
        "WingSM authenticate başarısız."
      )
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
  // Güvenli tarafta 14 dakika cache.
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
    global
      .cnetWingSMTokenCache;

  if (
    !forceRefresh &&
    cached &&
    cached.token &&
    cached.expiresAt >
      Date.now()
  ) {
    return cached.token;
  }

  // Aynı anda birkaç istek geldiyse tek authenticate
  // isteğini paylaş.
  if (
    !forceRefresh &&
    global
      .cnetWingSMTokenPromise
  ) {
    return global
      .cnetWingSMTokenPromise;
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
        value ===
          undefined ||
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
// RESPONSE PARSE
// ======================================================

async function parseWingSMResponse(
  response: Response
) {
  const raw =
    await response.text();

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(
      `WingSM API JSON dönmedi. HTTP ${response.status}`
    );
  }
}

// ======================================================
// ORTAK WINGSM REQUEST
// ======================================================

export async function wingSMRequest<
  T = any
>(
  path: string,
  options:
    WingSMRequestOptions = {}
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

  // ====================================================
  // İLK İSTEK
  // ====================================================

  let response =
    await makeRequest(
      token
    );

  // HTTP 401 / 403 ise tokenı yenile ve bir kez tekrar dene.
  if (
    response.status ===
      401 ||
    response.status ===
      403
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

  let payload =
    await parseWingSMResponse(
      response
    );

  // ====================================================
  // HTTP 200 AMA TOKEN / AUTH HATASI İHTİMALİ
  // ====================================================
  //
  // Bazı eski API'lerde auth hatası HTTP 200 içinde gelebilir.
  // Source/IP hatasında token yenilemenin anlamı yoktur.
  // ====================================================

  if (
    response.ok &&
    isWingSMFailure(
      payload
    ) &&
    !isSourceError(
      payload
    )
  ) {
    const message =
      getWingSMMessage(
        payload,
        ""
      );

    const possibleTokenError =
      /token/i.test(
        message
      ) &&
      (
        /expire/i.test(
          message
        ) ||
        /invalid/i.test(
          message
        ) ||
        /unauthor/i.test(
          message
        )
      );

    if (
      possibleTokenError
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

      payload =
        await parseWingSMResponse(
          response
        );
    }
  }

  // ====================================================
  // HTTP HATA
  // ====================================================

  if (!response.ok) {
    throw new Error(
      getWingSMMessage(
        payload,
        `WingSM API isteği başarısız. HTTP ${response.status}`
      )
    );
  }

  // ====================================================
  // WINGSM HTTP 200 + success:false
  // ====================================================

  if (
    isWingSMFailure(
      payload
    )
  ) {
    const message =
      getWingSMMessage(
        payload,
        "WingSM işlemi başarısız."
      );

    // Source/IP engeli özellikle belirgin kalsın.
    if (
      isSourceError(
        payload
      )
    ) {
      throw new Error(
        `WINGSM_SOURCE_BLOCKED: ${message}`
      );
    }

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
// CNETMOBIL için sabit:
// - sinif = 2el
// - stok = 1
// - depo = WingSM depo kodu
//
// onlyInStock parametresi eski çağrılar bozulmasın diye
// tutulur. Değeri ne olursa olsun stok=1 gönderilir.
// ======================================================

export async function getWingSMStock(
  depot: string,
  _onlyInStock = true
) {
  const normalizedDepot =
    normalizeBranch(
      depot
    );

  if (!normalizedDepot) {
    throw new Error(
      "WingSM depo kodu boş olamaz."
    );
  }

  return wingSMRequest(
    "/api/b2b/stok/list",
    {
      method:
        "GET",

      query: {
        depo:
          normalizedDepot,

        sinif:
          "2el",

        stok:
          1,
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
  const value =
    String(
      id ?? ""
    ).trim();

  if (!value) {
    throw new Error(
      "WingSM ürün ID gerekli."
    );
  }

  return wingSMRequest(
    `/api/b2b/urun/${encodeURIComponent(
      value
    )}`
  );
}

// ======================================================
// TEK ÜRÜN - KOD / BARKOD
// ======================================================

export async function getWingSMProductByCode(
  code: string
) {
  const value =
    String(
      code ?? ""
    ).trim();

  if (!value) {
    throw new Error(
      "WingSM ürün kodu gerekli."
    );
  }

  return wingSMRequest(
    `/api/b2b/urun/kod/${encodeURIComponent(
      value
    )}`
  );
}

// ======================================================
// HEALTH / CONFIG
// ======================================================

export function getWingSMConfigStatus() {
  return {
    configured:
      Boolean(
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
