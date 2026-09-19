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

type WingSMStockItem = {
  Id?: number | string;

  Sirket?: string;

  MalId?: number | string;
  MalKod?: string;

  MalBarkod1?: string;
  MalBarkod2?: string;
  MalBarkod3?: string;

  SeriNo?: string;

  MalAd?: string;

  MalMinStok?: number;
  MalBirim?: string;

  MalKdvOran?: number;

  MalOrtFiyat?: number;
  MalAlisFiyat?: number;
  MalAlisDvzCns?: string;

  MalAkitfPasif?: number;

  OperatorDestek?: number;

  MalSatisFiyat?: number;
  MalSatisDvzCns?: string;

  Depo?: string;
  DepoAd?: string;
  DepoId?: number | string;

  DepoMiktar?: number | string;
  DepoMaliyet?: number;

  DepoMinMiktar?: number;

  MalSinifKod?: string;
  MalSinifAd?: string;

  MalCinsKod?: string;
  MalCinsAd?: string;

  MalGrupKod?: string;
  MalGrupAd?: string;

  MalGrup2Kod?: string;
  MalGrup2Ad?: string;

  MalSinifId?: number | string;
  MalCinsId?: number | string;
  MalGrupId?: number | string;
  MalGrup2Id?: number | string;

  SayimI?: number;
  BakiyeI?: number;
  GirisMaliyetI?: number;

  isSeriNoluSinifI?: boolean;

  [key: string]: any;
};

type WingSMStockResponse = {
  success?: boolean;
  data?: WingSMStockItem[] | null;
  message?: string;
  error?: string;
  [key: string]: any;
};

// ======================================================
// GLOBAL TOKEN CACHE
// ======================================================

declare global {
  // eslint-disable-next-line no-var
  var cnetWingSMTokenCache:
    | WingSMTokenCache
    | undefined;

  // Aynı anda birden fazla authenticate isteği gitmesin.
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
// PANEL       WINGSM DEPO KODU
// MERKEZ      001
// CNET        051
// CMR         003
// CADDE       009
// SARAY       010
// KAPAKLI     011
//
// WingSM stok endpoint'i depo ADI değil depo KODU istiyor.
//
// ======================================================

export const WINGSM_DEPOT_MAP = {
  MERKEZ: "001",
  CNET: "051",
  CMR: "003",
  CADDE: "009",
  SARAY: "010",
  KAPAKLI: "011",
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
// PANEL MAĞAZASI -> WINGSM DEPO KODU
// ======================================================

export function getWingSMDepotForBranch(
  branch: string
): WingSMDepotCode | null {
  const normalized =
    normalizeBranch(
      branch
    );

  // --------------------------------------
  // MERKEZ
  // --------------------------------------

  if (
    normalized === "MERKEZ" ||
    normalized === "MERKEZ DEPO" ||
    normalized === "001"
  ) {
    return "001";
  }

  // --------------------------------------
  // CNET
  // --------------------------------------

  if (
    normalized === "CNET" ||
    normalized === "CNET DEPO" ||
    normalized === "CNETMOBIL" ||
    normalized === "051"
  ) {
    return "051";
  }

  // --------------------------------------
  // CMR
  // --------------------------------------

  if (
    normalized === "CMR" ||
    normalized ===
      "CMR MERKEZ" ||
    normalized === "003"
  ) {
    return "003";
  }

  // --------------------------------------
  // CADDE
  // --------------------------------------

  if (
    normalized === "CADDE" ||
    normalized ===
      "CMR CADDE" ||
    normalized === "009"
  ) {
    return "009";
  }

  // --------------------------------------
  // SARAY
  // --------------------------------------

  if (
    normalized === "SARAY" ||
    normalized ===
      "CMR SARAY" ||
    normalized ===
      "SARAYCMR" ||
    normalized === "010"
  ) {
    return "010";
  }

  // --------------------------------------
  // KAPAKLI
  // --------------------------------------

  if (
    normalized === "KAPAKLI" ||
    normalized ===
      "CMR KAPAKLI" ||
    normalized ===
      "KAPAKLICMR" ||
    normalized === "011"
  ) {
    return "011";
  }

  return null;
}

// ======================================================
// WINGSM DEPO KODU -> PANEL MAĞAZASI
// ======================================================

export function getPanelBranchForWingSMDepot(
  depot: string
): PanelWingSMBranch | null {
  const normalized =
    normalizeBranch(
      depot
    );

  if (
    normalized === "001" ||
    normalized === "MERKEZ"
  ) {
    return "MERKEZ";
  }

  if (
    normalized === "051" ||
    normalized === "CNET"
  ) {
    return "CNET";
  }

  if (
    normalized === "003" ||
    normalized === "CMR"
  ) {
    return "CMR";
  }

  if (
    normalized === "009" ||
    normalized === "CADDE"
  ) {
    return "CADDE";
  }

  if (
    normalized === "010" ||
    normalized ===
      "SARAYCMR"
  ) {
    return "SARAY";
  }

  if (
    normalized === "011" ||
    normalized ===
      "KAPAKLICMR"
  ) {
    return "KAPAKLI";
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
// PAYLOAD MESAJI
// ======================================================

function getPayloadMessage(
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
// SOURCE / IP BLOCK KONTROLÜ
// ======================================================

function isSourceBlocked(
  payload: any
) {
  const message =
    [
      payload?.message,
      payload?.error,
    ]
      .filter(
        (
          value
        ): value is string =>
          typeof value ===
          "string"
      )
      .join(" ");

  return /no valid source/i.test(
    message
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

  if (!response.ok) {
    throw new Error(
      getPayloadMessage(
        payload,
        `WingSM authenticate başarısız. HTTP ${response.status}`
      )
    );
  }

  // HTTP 200 olup uygulama seviyesinde hata dönebilir.
  if (
    payload?.success ===
    false
  ) {
    const message =
      getPayloadMessage(
        payload,
        "WingSM authenticate başarısız."
      );

    if (
      isSourceBlocked(
        payload
      )
    ) {
      throw new Error(
        `WINGSM_SOURCE_BLOCKED: ${message}`
      );
    }

    throw new Error(
      `WingSM authenticate başarısız: ${message}`
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

  // WingSM token yaklaşık 15 dakika.
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

export async function wingSMRequest<
  T = any
>(
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

  // ==================================================
  // TOKEN SÜRESİ DOLMUŞSA 1 KEZ YENİDEN DENE
  // ==================================================

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

  // ==================================================
  // HTTP HATASI
  // ==================================================

  if (!response.ok) {
    const message =
      getPayloadMessage(
        payload,
        `WingSM API isteği başarısız. HTTP ${response.status}`
      );

    if (
      isSourceBlocked(
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

  // ==================================================
  // HTTP 200 AMA WINGSM success:false
  // ==================================================

  if (
    payload &&
    typeof payload ===
      "object" &&
    payload.success ===
      false
  ) {
    const message =
      getPayloadMessage(
        payload,
        "WingSM API success:false döndü."
      );

    if (
      isSourceBlocked(
        payload
      )
    ) {
      throw new Error(
        `WINGSM_SOURCE_BLOCKED: ${message}`
      );
    }

    throw new Error(
      `WingSM API hatası: ${message}`
    );
  }

  return payload as T;
}

// ======================================================
// WINGSM STOK
// ======================================================
//
// GERÇEK TESTLERLE DOĞRULANAN YAPI:
//
// GET /api/b2b/stok/list
//
// depo:
// MERKEZ  = 001
// CNET    = 051
// CMR     = 003
// CADDE   = 009
// SARAY   = 010
// KAPAKLI = 011
//
// sinif = 2el
//
// ÖNEMLİ:
// stok=1 GÖNDERİLMİYOR.
//
// WingSM stok=1 parametresinde data:null döndürüyor.
// Stoğu olan kayıtları DepoMiktar > 0 ile kendi
// tarafımızda filtreliyoruz.
//
// ======================================================

export async function getWingSMStock(
  depot: string,
  onlyInStock = true
) {
  const normalizedDepot =
    String(
      depot ?? ""
    ).trim();

  if (!normalizedDepot) {
    throw new Error(
      "WingSM depo kodu boş."
    );
  }

  const payload =
    await wingSMRequest<
      WingSMStockResponse
    >(
      "/api/b2b/stok/list",
      {
        method:
          "GET",

        query: {
          depo:
            normalizedDepot,

          sinif:
            "2el",
        },
      }
    );

  // WingSM success:true / data:null dönebilir.
  if (
    !Array.isArray(
      payload?.data
    )
  ) {
    return {
      ...payload,
      data:
        payload?.data ??
        null,
    };
  }

  const rows =
    payload.data;

  const filteredRows =
    onlyInStock
      ? rows.filter(
          (item) =>
            Number(
              item?.DepoMiktar ??
                0
            ) > 0
        )
      : rows;

  return {
    ...payload,

    data:
      filteredRows,
  };
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
// URUN / IMEI HAREKET GECMISI - SADECE OKUMA
// ======================================================
//
// WingSM B2B dokumani:
// GET /b2b/urun/list/hareket/:bastar/:bittar
// QueryParams:
// - malKodu
// - seriNo
// - depo
//
// Bu helper WingSM'e HICBIR veri yazmaz.
// Transfer tamamlamada, cihaz hedef magazaya gecip cok hizli
// satildigi icin anlik stokta yakalanamazsa ikinci kanit olarak
// kullanilir.
// ======================================================

function toWingSMDateNumber(
  value: Date | string | number
) {
  const date =
    value instanceof Date
      ? value
      : new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    throw new Error(
      "WingSM hareket tarihi gecersiz."
    );
  }

  const parts =
    new Intl.DateTimeFormat(
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
    ).formatToParts(
      date
    );

  const year =
    parts.find(
      (part) =>
        part.type ===
        "year"
    )?.value;

  const month =
    parts.find(
      (part) =>
        part.type ===
        "month"
    )?.value;

  const day =
    parts.find(
      (part) =>
        part.type ===
        "day"
    )?.value;

  if (
    !year ||
    !month ||
    !day
  ) {
    throw new Error(
      "WingSM hareket tarihi olusturulamadi."
    );
  }

  return `${year}${month}${day}`;
}

export async function getWingSMProductMovementHistory(
  params: {
    serialNo: string;
    startDate:
      | Date
      | string
      | number;
    endDate?:
      | Date
      | string
      | number;
    depot?:
      | string
      | null;
    productCode?:
      | string
      | null;
  }
) {
  const serialNo =
    String(
      params.serialNo ||
        ""
    )
      .replace(
        /\D/g,
        ""
      )
      .trim();

  if (!serialNo) {
    throw new Error(
      "WingSM hareket sorgusu icin IMEI gerekli."
    );
  }

  const start =
    toWingSMDateNumber(
      params.startDate
    );

  const end =
    toWingSMDateNumber(
      params.endDate ||
        new Date()
    );

  const depot =
    String(
      params.depot ||
        ""
    ).trim();

  const productCode =
    String(
      params.productCode ||
        ""
    ).trim();

  return wingSMRequest(
    `/b2b/urun/list/hareket/${encodeURIComponent(
      start
    )}/${encodeURIComponent(
      end
    )}`,
    {
      method:
        "GET",

      query: {
        seriNo,

        depo:
          depot ||
          undefined,

        malKodu:
          productCode ||
          undefined,
      },
    }
  );
}

// ======================================================
// HEALTH CONFIG
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

    stockClass:
      "2el",

    stockQueryUsesStokParameter:
      false,

    stockFilter:
      "DepoMiktar > 0",

    depots: {
      MERKEZ:
        "001",

      CNET:
        "051",

      CMR:
        "003",

      CADDE:
        "009",

      SARAY:
        "010",

      KAPAKLI:
        "011",
    },
  };
}
