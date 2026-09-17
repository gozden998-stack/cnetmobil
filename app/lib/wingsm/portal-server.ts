// app/lib/wingsm/portal-server.ts
//
// CNETMOBIL - WingSM WEB PORTAL server helper
//
// ÖNEMLİ:
// - Bu dosya mevcut B2B app/lib/wingsm/server.ts dosyasından AYRIDIR.
// - B2B x-access-token sistemine dokunmaz.
// - WingSM WEB PORTAL session/cookie sistemi için kullanılır.
// - Kullanıcı adı / şifre / cookie / session hiçbir zaman response'a yazılmaz.
// - Login formunu portal HTML'inden bulmaya çalışır.
// - Session geçersiz olursa otomatik yeniden login olur.
//
// Kullanım:
//
// const result = await wingSMPortalRequest<MyType>(
//   "/HttpApiHizliSatis/HizliSatisInitilas",
//   {
//     method: "GET",
//     query: {
//       TarihN: "20260917",
//       Sirket: null,
//     },
//   }
// );
//

export const runtime = "nodejs";

// ======================================================
// TYPES
// ======================================================

export type WingSMPortalRequestOptions = {
  method?:
    | "GET"
    | "POST"
    | "PUT"
    | "PATCH"
    | "DELETE";

  query?: Record<
    string,
    | string
    | number
    | boolean
    | null
    | undefined
  >;

  body?: unknown;

  headers?: Record<
    string,
    string
  >;
};

type PortalSession = {
  cookieHeader: string;

  createdAt: number;

  expiresAt: number;
};

type LoginFormInfo = {
  actionUrl: string;

  method: string;

  usernameField: string;

  passwordField: string;

  hiddenFields: Record<
    string,
    string
  >;
};

type CookieJar =
  Map<
    string,
    string
  >;

declare global {
  // eslint-disable-next-line no-var
  var cnetWingSMPortalSession:
    | PortalSession
    | undefined;

  // eslint-disable-next-line no-var
  var cnetWingSMPortalLoginPromise:
    | Promise<PortalSession>
    | undefined;
}

// ======================================================
// ENV
// ======================================================

function getPortalBaseUrl() {
  const value =
    String(
      process.env
        .WINGSM_PORTAL_BASE_URL ||
        "https://ports.wingsmonline.com"
    ).trim();

  if (!value) {
    throw new Error(
      "WINGSM_PORTAL_BASE_URL bulunamadı."
    );
  }

  return value.replace(
    /\/+$/,
    ""
  );
}

function getPortalUsername() {
  const value =
    String(
      process.env
        .WINGSM_PORTAL_USER ||
        process.env
          .WINGSM_USER ||
        ""
    ).trim();

  if (!value) {
    throw new Error(
      "WINGSM_PORTAL_USER veya WINGSM_USER bulunamadı."
    );
  }

  return value;
}

function getPortalPassword() {
  const value =
    String(
      process.env
        .WINGSM_PORTAL_PASSWORD ||
        process.env
          .WINGSM_PASSWORD ||
        ""
    );

  if (!value) {
    throw new Error(
      "WINGSM_PORTAL_PASSWORD veya WINGSM_PASSWORD bulunamadı."
    );
  }

  return value;
}

function getPortalLoginStartUrl() {
  const baseUrl =
    getPortalBaseUrl();

  const configured =
    String(
      process.env
        .WINGSM_PORTAL_LOGIN_PATH ||
        ""
    ).trim();

  if (!configured) {
    return `${baseUrl}/`;
  }

  return new URL(
    configured,
    `${baseUrl}/`
  ).toString();
}

// ======================================================
// HTML
// ======================================================

function decodeHtml(
  value: string
) {
  return value
    .replace(
      /&amp;/gi,
      "&"
    )
    .replace(
      /&quot;/gi,
      '"'
    )
    .replace(
      /&#39;/gi,
      "'"
    )
    .replace(
      /&lt;/gi,
      "<"
    )
    .replace(
      /&gt;/gi,
      ">"
    );
}

function parseAttributes(
  source: string
) {
  const result: Record<
    string,
    string
  > = {};

  const regex =
    /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;

  let match:
    | RegExpExecArray
    | null;

  while (
    (match =
      regex.exec(
        source
      )) !== null
  ) {
    const key =
      String(
        match[1] ||
          ""
      )
        .trim()
        .toLowerCase();

    if (!key) {
      continue;
    }

    const value =
      match[2] ??
      match[3] ??
      match[4] ??
      "";

    result[key] =
      decodeHtml(
        value
      );
  }

  return result;
}

// ======================================================
// COOKIE
// ======================================================

function splitSetCookieHeader(
  header: string
) {
  if (!header) {
    return [];
  }

  /*
   * Expires=Wed, 17 Sep...
   * içindeki virgülü cookie ayıracı sanmamak için
   * sadece yeni cookie başlangıcındaki virgülü böler.
   */
  return header
    .split(
      /,(?=\s*[^;,=\s]+=[^;,]*)/
    )
    .map(
      (
        value
      ) =>
        value.trim()
    )
    .filter(
      Boolean
    );
}

function getSetCookieValues(
  response: Response
) {
  const headers =
    response.headers as Headers & {
      getSetCookie?:
        () => string[];
    };

  if (
    typeof headers
      .getSetCookie ===
    "function"
  ) {
    const values =
      headers.getSetCookie();

    if (
      Array.isArray(
        values
      ) &&
      values.length >
        0
    ) {
      return values;
    }
  }

  const combined =
    response.headers.get(
      "set-cookie"
    );

  if (!combined) {
    return [];
  }

  return splitSetCookieHeader(
    combined
  );
}

function applySetCookies(
  jar: CookieJar,
  response: Response
) {
  const setCookies =
    getSetCookieValues(
      response
    );

  for (
    const cookieString
    of setCookies
  ) {
    const parts =
      cookieString
        .split(";");

    const first =
      parts[0]?.trim();

    if (!first) {
      continue;
    }

    const separator =
      first.indexOf(
        "="
      );

    if (
      separator <=
      0
    ) {
      continue;
    }

    const name =
      first
        .slice(
          0,
          separator
        )
        .trim();

    const value =
      first
        .slice(
          separator + 1
        )
        .trim();

    if (!name) {
      continue;
    }

    const lower =
      cookieString
        .toLowerCase();

    const deleteCookie =
      value === "" ||
      lower.includes(
        "max-age=0"
      );

    if (
      deleteCookie
    ) {
      jar.delete(
        name
      );

      continue;
    }

    jar.set(
      name,
      value
    );
  }
}

function jarToHeader(
  jar: CookieJar
) {
  return Array.from(
    jar.entries()
  )
    .map(
      ([
        name,
        value,
      ]) =>
        `${name}=${value}`
    )
    .join("; ");
}

function headerToJar(
  header: string
) {
  const jar:
    CookieJar =
    new Map();

  const parts =
    String(
      header ||
        ""
    )
      .split(";")
      .map(
        (
          value
        ) =>
          value.trim()
      )
      .filter(
        Boolean
      );

  for (
    const part
    of parts
  ) {
    const separator =
      part.indexOf(
        "="
      );

    if (
      separator <=
      0
    ) {
      continue;
    }

    const name =
      part
        .slice(
          0,
          separator
        )
        .trim();

    const value =
      part
        .slice(
          separator + 1
        )
        .trim();

    if (name) {
      jar.set(
        name,
        value
      );
    }
  }

  return jar;
}

// ======================================================
// FETCH + COOKIE JAR + REDIRECT
// ======================================================

async function fetchWithJar(
  inputUrl: string,
  inputInit:
    RequestInit,
  jar: CookieJar
) {
  let currentUrl =
    inputUrl;

  let method =
    String(
      inputInit.method ||
        "GET"
    ).toUpperCase();

  let body =
    inputInit.body;

  let headers =
    new Headers(
      inputInit.headers
    );

  const maxRedirects =
    8;

  for (
    let redirectCount =
      0;
    redirectCount <=
    maxRedirects;
    redirectCount++
  ) {
    const requestHeaders =
      new Headers(
        headers
      );

    const cookieHeader =
      jarToHeader(
        jar
      );

    if (cookieHeader) {
      requestHeaders.set(
        "Cookie",
        cookieHeader
      );
    }

    const response =
      await fetch(
        currentUrl,
        {
          ...inputInit,

          method,

          body:
            method ===
              "GET" ||
            method ===
              "HEAD"
              ? undefined
              : body,

          headers:
            requestHeaders,

          redirect:
            "manual",

          cache:
            "no-store",
        }
      );

    applySetCookies(
      jar,
      response
    );

    if (
      ![
        301,
        302,
        303,
        307,
        308,
      ].includes(
        response.status
      )
    ) {
      return {
        response,
        finalUrl:
          currentUrl,
      };
    }

    const location =
      response.headers.get(
        "location"
      );

    if (!location) {
      return {
        response,
        finalUrl:
          currentUrl,
      };
    }

    if (
      redirectCount >=
      maxRedirects
    ) {
      throw new Error(
        "WingSM portal çok fazla redirect döndürdü."
      );
    }

    currentUrl =
      new URL(
        location,
        currentUrl
      ).toString();

    /*
     * Browser davranışı:
     * POST -> 302/303 -> GET
     */
    if (
      response.status ===
        303 ||
      ((response.status ===
          301 ||
        response.status ===
          302) &&
        method ===
          "POST")
    ) {
      method =
        "GET";

      body =
        undefined;

      headers =
        new Headers(
          headers
        );

      headers.delete(
        "content-type"
      );

      headers.delete(
        "content-length"
      );
    }
  }

  throw new Error(
    "WingSM portal redirect işlemi tamamlanamadı."
  );
}

// ======================================================
// LOGIN FORM DISCOVERY
// ======================================================

function discoverLoginForm(
  html: string,
  pageUrl: string
): LoginFormInfo {
  const formRegex =
    /<form\b([^>]*)>([\s\S]*?)<\/form>/gi;

  let selectedFormAttributes =
    "";

  let selectedFormBody =
    "";

  let formMatch:
    | RegExpExecArray
    | null;

  while (
    (formMatch =
      formRegex.exec(
        html
      )) !== null
  ) {
    const attributes =
      formMatch[1] ||
      "";

    const body =
      formMatch[2] ||
      "";

    if (
      /type\s*=\s*["']?password/i.test(
        body
      )
    ) {
      selectedFormAttributes =
        attributes;

      selectedFormBody =
        body;

      break;
    }
  }

  if (
    !selectedFormBody
  ) {
    throw new Error(
      "WingSM login formu bulunamadı."
    );
  }

  const formAttrs =
    parseAttributes(
      selectedFormAttributes
    );

  const action =
    String(
      process.env
        .WINGSM_PORTAL_LOGIN_PATH ||
        formAttrs.action ||
        pageUrl
    ).trim();

  const actionUrl =
    new URL(
      action,
      pageUrl
    ).toString();

  const method =
    String(
      formAttrs.method ||
        "POST"
    )
      .trim()
      .toUpperCase();

  const inputs: Array<{
    name: string;
    type: string;
    value: string;
  }> = [];

  const inputRegex =
    /<input\b([^>]*)>/gi;

  let inputMatch:
    | RegExpExecArray
    | null;

  while (
    (inputMatch =
      inputRegex.exec(
        selectedFormBody
      )) !== null
  ) {
    const attrs =
      parseAttributes(
        inputMatch[1] ||
          ""
      );

    const name =
      String(
        attrs.name ||
          ""
      ).trim();

    if (!name) {
      continue;
    }

    inputs.push({
      name,

      type:
        String(
          attrs.type ||
            "text"
        )
          .trim()
          .toLowerCase(),

      value:
        String(
          attrs.value ||
            ""
        ),
    });
  }

  const configuredUserField =
    String(
      process.env
        .WINGSM_PORTAL_USER_FIELD ||
        ""
    ).trim();

  const configuredPasswordField =
    String(
      process.env
        .WINGSM_PORTAL_PASSWORD_FIELD ||
        ""
    ).trim();

  const passwordInput =
    inputs.find(
      (
        input
      ) =>
        input.type ===
        "password"
    );

  const usernameCandidates =
    inputs.filter(
      (
        input
      ) =>
        ![
          "hidden",
          "password",
          "submit",
          "button",
          "checkbox",
          "radio",
        ].includes(
          input.type
        )
    );

  const usernameInput =
    usernameCandidates.find(
      (
        input
      ) =>
        /user|login|kullanici|username|email/i.test(
          input.name
        )
    ) ||
    usernameCandidates[0];

  const usernameField =
    configuredUserField ||
    usernameInput?.name;

  const passwordField =
    configuredPasswordField ||
    passwordInput?.name;

  if (
    !usernameField
  ) {
    throw new Error(
      "WingSM login kullanıcı alanı bulunamadı."
    );
  }

  if (
    !passwordField
  ) {
    throw new Error(
      "WingSM login şifre alanı bulunamadı."
    );
  }

  const hiddenFields:
    Record<
      string,
      string
    > = {};

  for (
    const input
    of inputs
  ) {
    if (
      input.type ===
      "hidden"
    ) {
      hiddenFields[
        input.name
      ] =
        input.value;
    }
  }

  return {
    actionUrl,

    method,

    usernameField,

    passwordField,

    hiddenFields,
  };
}

// ======================================================
// SESSION VALIDATION
// ======================================================

async function validatePortalSession(
  jar: CookieJar
) {
  try {
    const url =
      new URL(
        "/Http/AktifKullanici",
        `${getPortalBaseUrl()}/`
      ).toString();

    const {
      response,
    } =
      await fetchWithJar(
        url,
        {
          method:
            "GET",

          headers: {
            Accept:
              "application/json",

            "User-Agent":
              "Mozilla/5.0 CNETMOBIL-WingSM-Sync",
          },
        },
        jar
      );

    if (
      !response.ok
    ) {
      return false;
    }

    const contentType =
      String(
        response.headers.get(
          "content-type"
        ) ||
          ""
      ).toLowerCase();

    if (
      !contentType.includes(
        "json"
      )
    ) {
      return false;
    }

    const data =
      await response
        .json()
        .catch(
          () =>
            null
        );

    if (
      !data ||
      typeof data !==
        "object"
    ) {
      return false;
    }

    const record =
      data as Record<
        string,
        unknown
      >;

    const kullanici =
      record.kullanici;

    if (
      !kullanici ||
      typeof kullanici !==
        "object"
    ) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

// ======================================================
// PORTAL LOGIN
// ======================================================

async function createPortalSession(): Promise<PortalSession> {
  const username =
    getPortalUsername();

  const password =
    getPortalPassword();

  const jar:
    CookieJar =
    new Map();

  /*
   * 1) Login sayfasını aç.
   *
   * Burada ASP.NET session / antiforgery cookie gelirse
   * CookieJar içine alınır.
   */
  const loginStartUrl =
    getPortalLoginStartUrl();

  const loginPageResult =
    await fetchWithJar(
      loginStartUrl,
      {
        method:
          "GET",

        headers: {
          Accept:
            "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",

          "User-Agent":
            "Mozilla/5.0 CNETMOBIL-WingSM-Sync",
        },
      },
      jar
    );

  if (
    !loginPageResult
      .response.ok
  ) {
    throw new Error(
      `WingSM portal login sayfası açılamadı. HTTP ${loginPageResult.response.status}`
    );
  }

  const loginHtml =
    await loginPageResult
      .response.text();

  /*
   * 2) Form action + field isimleri + hidden CSRF alanlarını bul.
   */
  const loginForm =
    discoverLoginForm(
      loginHtml,
      loginPageResult
        .finalUrl
    );

  /*
   * 3) Login POST body.
   */
  const form =
    new URLSearchParams();

  for (
    const [
      name,
      value,
    ]
    of Object.entries(
      loginForm.hiddenFields
    )
  ) {
    form.set(
      name,
      value
    );
  }

  form.set(
    loginForm
      .usernameField,
    username
  );

  form.set(
    loginForm
      .passwordField,
    password
  );

  /*
   * 4) Login.
   *
   * credentials hiçbir yerde loglanmaz.
   */
  const loginResult =
    await fetchWithJar(
      loginForm.actionUrl,
      {
        method:
          loginForm.method ===
          "GET"
            ? "POST"
            : loginForm.method,

        headers: {
          Accept:
            "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",

          "Content-Type":
            "application/x-www-form-urlencoded; charset=UTF-8",

          Origin:
            new URL(
              getPortalBaseUrl()
            ).origin,

          Referer:
            loginPageResult
              .finalUrl,

          "User-Agent":
            "Mozilla/5.0 CNETMOBIL-WingSM-Sync",
        },

        body:
          form.toString(),
      },
      jar
    );

  if (
    loginResult.response
      .status >=
    500
  ) {
    throw new Error(
      `WingSM portal login sunucu hatası. HTTP ${loginResult.response.status}`
    );
  }

  /*
   * 5) Login başarılı mı kesin doğrula.
   *
   * Cookie ismine güvenmiyoruz.
   * /Http/AktifKullanici gerçekten çalışıyorsa session geçerli.
   */
  const valid =
    await validatePortalSession(
      jar
    );

  if (!valid) {
    throw new Error(
      "WingSM portal login/session doğrulanamadı."
    );
  }

  const cookieHeader =
    jarToHeader(
      jar
    );

  if (!cookieHeader) {
    throw new Error(
      "WingSM portal session cookie oluşturulamadı."
    );
  }

  const now =
    Date.now();

  /*
   * 10 dakika local cache.
   *
   * Gerçek cookie daha uzun yaşayabilir.
   * 10 dakika sonra yeniden AktifKullanici kontrolü/login yapılır.
   */
  const session: PortalSession =
    {
      cookieHeader,

      createdAt:
        now,

      expiresAt:
        now +
        10 * 60 * 1000,
    };

  global
    .cnetWingSMPortalSession =
    session;

  return session;
}

// ======================================================
// GET / CREATE SESSION
// ======================================================

async function getPortalSession() {
  const cached =
    global
      .cnetWingSMPortalSession;

  if (
    cached &&
    cached.cookieHeader &&
    cached.expiresAt >
      Date.now()
  ) {
    return cached;
  }

  /*
   * Aynı anda 5 request gelirse 5 login yapma.
   */
  if (
    global
      .cnetWingSMPortalLoginPromise
  ) {
    return global
      .cnetWingSMPortalLoginPromise;
  }

  global
    .cnetWingSMPortalLoginPromise =
    createPortalSession();

  try {
    const session =
      await global
        .cnetWingSMPortalLoginPromise;

    return session;
  } finally {
    global
      .cnetWingSMPortalLoginPromise =
      undefined;
  }
}

// ======================================================
// CLEAR SESSION
// ======================================================

export function clearWingSMPortalSession() {
  global
    .cnetWingSMPortalSession =
    undefined;

  global
    .cnetWingSMPortalLoginPromise =
    undefined;
}

// ======================================================
// URL
// ======================================================

function createRequestUrl(
  path: string,
  query?: WingSMPortalRequestOptions["query"]
) {
  const baseUrl =
    getPortalBaseUrl();

  const url =
    new URL(
      path,
      `${baseUrl}/`
    );

  if (query) {
    for (
      const [
        key,
        value,
      ]
      of Object.entries(
        query
      )
    ) {
      if (
        value ===
          null ||
        value ===
          undefined
      ) {
        continue;
      }

      url.searchParams.set(
        key,
        String(
          value
        )
      );
    }
  }

  return url.toString();
}

// ======================================================
// SINGLE AUTHENTICATED REQUEST
// ======================================================

async function portalFetch(
  path: string,
  options:
    WingSMPortalRequestOptions,
  session:
    PortalSession
) {
  const url =
    createRequestUrl(
      path,
      options.query
    );

  const method =
    options.method ||
    "GET";

  const jar =
    headerToJar(
      session.cookieHeader
    );

  const headers =
    new Headers(
      options.headers
    );

  headers.set(
    "Accept",
    headers.get(
      "Accept"
    ) ||
      "application/json"
  );

  headers.set(
    "User-Agent",
    "Mozilla/5.0 CNETMOBIL-WingSM-Sync"
  );

  let body:
    BodyInit
    | undefined;

  if (
    options.body !==
      undefined &&
    method !==
      "GET"
  ) {
    if (
      typeof options.body ===
      "string" ||
      options.body instanceof
        URLSearchParams
    ) {
      body =
        options.body as BodyInit;
    } else {
      headers.set(
        "Content-Type",
        headers.get(
          "Content-Type"
        ) ||
          "application/json"
      );

      body =
        JSON.stringify(
          options.body
        );
    }
  }

  const result =
    await fetchWithJar(
      url,
      {
        method,

        headers,

        body,
      },
      jar
    );

  /*
   * WingSM session cookie rotate ederse cache'i güncelle.
   */
  const newCookieHeader =
    jarToHeader(
      jar
    );

  if (
    newCookieHeader
  ) {
    global
      .cnetWingSMPortalSession =
      {
        ...session,

        cookieHeader:
          newCookieHeader,
      };
  }

  return result.response;
}

// ======================================================
// PUBLIC REQUEST
// ======================================================

export async function wingSMPortalRequest<
  T = unknown
>(
  path: string,
  options:
    WingSMPortalRequestOptions =
      {}
): Promise<T> {
  let session =
    await getPortalSession();

  let response =
    await portalFetch(
      path,
      options,
      session
    );

  /*
   * Session öldüyse bir kez yeniden login yap.
   */
  if (
    response.status ===
      401 ||
    response.status ===
      403
  ) {
    clearWingSMPortalSession();

    session =
      await getPortalSession();

    response =
      await portalFetch(
        path,
        options,
        session
      );
  }

  const contentType =
    String(
      response.headers.get(
        "content-type"
      ) ||
        ""
    ).toLowerCase();

  /*
   * Portal login ekranına redirect olup
   * sonunda HTML dönmüş olabilir.
   */
  if (
    !contentType.includes(
      "json"
    )
  ) {
    /*
     * Bir kere daha yeni session ile deneyelim.
     */
    clearWingSMPortalSession();

    session =
      await getPortalSession();

    response =
      await portalFetch(
        path,
        options,
        session
      );

    const retryContentType =
      String(
        response.headers.get(
          "content-type"
        ) ||
          ""
      ).toLowerCase();

    if (
      !retryContentType.includes(
        "json"
      )
    ) {
      throw new Error(
        `WingSM portal JSON dönmedi. HTTP ${response.status}`
      );
    }
  }

  if (!response.ok) {
    throw new Error(
      `WingSM portal isteği başarısız. HTTP ${response.status}`
    );
  }

  try {
    return (
      await response.json()
    ) as T;
  } catch {
    throw new Error(
      `WingSM portal JSON parse edilemedi. HTTP ${response.status}`
    );
  }
}

// ======================================================
// SESSION TEST
// ======================================================

export async function testWingSMPortalSession() {
  const session =
    await getPortalSession();

  const jar =
    headerToJar(
      session.cookieHeader
    );

  const valid =
    await validatePortalSession(
      jar
    );

  if (!valid) {
    clearWingSMPortalSession();

    throw new Error(
      "WingSM portal session testi başarısız."
    );
  }

  return {
    success:
      true,

    connected:
      true,

    portal:
      "WingSM",

    /*
     * Cookie / kullanıcı / şifre kesinlikle dönmüyor.
     */
    sessionValid:
      true,
  };
}
