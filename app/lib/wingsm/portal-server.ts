// app/lib/wingsm/portal-server.ts
//
// CNETMOBIL - WingSM WEB PORTAL helper
//
// MEVCUT B2B API'YE DOKUNMAZ.
// app/lib/wingsm/server.ts AYNI KALACAK.
//
// Mevcut ENV:
// WINGSM_USER
// WINGSM_PASSWORD
//
// Portal:
// https://ports.wingsmonline.com
//
// Amaç:
// 1. WingSM portal login sayfasını aç
// 2. Login formunu tespit et
// 3. Mevcut WINGSM_USER / WINGSM_PASSWORD ile giriş yap
// 4. Set-Cookie değerlerini server tarafında tut
// 5. /Http/AktifKullanici ile session doğrula
// 6. Portal API isteklerinde aynı cookie/session kullan
//

export const runtime = "nodejs";

const PORTAL_BASE_URL =
  "https://ports.wingsmonline.com";

type PortalRequestOptions = {
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
  cookie: string;
  createdAt: number;
  expiresAt: number;
};

type CookieJar =
  Map<string, string>;

type LoginForm = {
  action: string;
  method: string;
  usernameField: string;
  passwordField: string;
  hiddenFields: Record<
    string,
    string
  >;
};

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

function getUsername() {
  const value =
    String(
      process.env
        .WINGSM_USER ||
        ""
    ).trim();

  if (!value) {
    throw new Error(
      "WINGSM_USER bulunamadı."
    );
  }

  return value;
}

function getPassword() {
  const value =
    String(
      process.env
        .WINGSM_PASSWORD ||
        ""
    );

  if (!value) {
    throw new Error(
      "WINGSM_PASSWORD bulunamadı."
    );
  }

  return value;
}

// ======================================================
// COOKIE
// ======================================================

function splitSetCookie(
  value: string
) {
  if (!value) {
    return [];
  }

  return value
    .split(
      /,(?=\s*[^;,=\s]+=[^;,]*)/
    )
    .map(
      (item) =>
        item.trim()
    )
    .filter(Boolean);
}

function getSetCookies(
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
      Array.isArray(values) &&
      values.length
    ) {
      return values;
    }
  }

  const value =
    response.headers.get(
      "set-cookie"
    );

  if (!value) {
    return [];
  }

  return splitSetCookie(
    value
  );
}

function applyCookies(
  jar: CookieJar,
  response: Response
) {
  const cookies =
    getSetCookies(
      response
    );

  for (
    const raw
    of cookies
  ) {
    const first =
      raw
        .split(";")[0]
        ?.trim();

    if (!first) {
      continue;
    }

    const index =
      first.indexOf("=");

    if (
      index <= 0
    ) {
      continue;
    }

    const name =
      first
        .slice(
          0,
          index
        )
        .trim();

    const value =
      first
        .slice(
          index + 1
        )
        .trim();

    if (!name) {
      continue;
    }

    const lower =
      raw.toLowerCase();

    if (
      !value ||
      lower.includes(
        "max-age=0"
      )
    ) {
      jar.delete(name);
      continue;
    }

    jar.set(
      name,
      value
    );
  }
}

function jarToCookie(
  jar: CookieJar
) {
  return Array
    .from(
      jar.entries()
    )
    .map(
      ([name, value]) =>
        `${name}=${value}`
    )
    .join("; ");
}

function cookieToJar(
  cookie: string
) {
  const jar:
    CookieJar =
    new Map();

  String(
    cookie || ""
  )
    .split(";")
    .map(
      (item) =>
        item.trim()
    )
    .filter(Boolean)
    .forEach(
      (item) => {
        const index =
          item.indexOf("=");

        if (
          index <= 0
        ) {
          return;
        }

        const name =
          item
            .slice(
              0,
              index
            )
            .trim();

        const value =
          item
            .slice(
              index + 1
            )
            .trim();

        if (name) {
          jar.set(
            name,
            value
          );
        }
      }
    );

  return jar;
}

// ======================================================
// HTML HELPERS
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
      "\""
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
  const result:
    Record<
      string,
      string
    > = {};

  const regex =
    /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;

  let match:
    RegExpExecArray |
    null;

  while (
    (
      match =
        regex.exec(source)
    ) !== null
  ) {
    const key =
      String(
        match[1] || ""
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
      decodeHtml(value);
  }

  return result;
}

// ======================================================
// FETCH + COOKIE + REDIRECT
// ======================================================

async function fetchWithJar(
  startUrl: string,
  init: RequestInit,
  jar: CookieJar
) {
  let currentUrl =
    startUrl;

  let method =
    String(
      init.method ||
        "GET"
    ).toUpperCase();

  let body =
    init.body;

  let headers =
    new Headers(
      init.headers
    );

  for (
    let redirectIndex =
      0;
    redirectIndex <
      8;
    redirectIndex++
  ) {
    const requestHeaders =
      new Headers(
        headers
      );

    const cookie =
      jarToCookie(
        jar
      );

    if (cookie) {
      requestHeaders.set(
        "Cookie",
        cookie
      );
    }

    const response =
      await fetch(
        currentUrl,
        {
          ...init,

          method,

          body:
            method === "GET" ||
            method === "HEAD"
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

    applyCookies(
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
        url:
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
        url:
          currentUrl,
      };
    }

    currentUrl =
      new URL(
        location,
        currentUrl
      ).toString();

    if (
      response.status ===
        303 ||
      (
        (
          response.status ===
            301 ||
          response.status ===
            302
        ) &&
        method ===
          "POST"
      )
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
    }
  }

  throw new Error(
    "WingSM portal redirect limiti aşıldı."
  );
}

// ======================================================
// LOGIN FORM BUL
// ======================================================

function findLoginForm(
  html: string,
  currentUrl: string
): LoginForm {
  const formRegex =
    /<form\b([^>]*)>([\s\S]*?)<\/form>/gi;

  let formAttributes =
    "";

  let formBody =
    "";

  let match:
    RegExpExecArray |
    null;

  while (
    (
      match =
        formRegex.exec(html)
    ) !== null
  ) {
    const body =
      match[2] || "";

    if (
      /type\s*=\s*["']?password/i.test(
        body
      )
    ) {
      formAttributes =
        match[1] || "";

      formBody =
        body;

      break;
    }
  }

  if (!formBody) {
    throw new Error(
      "WingSM portal login formu bulunamadı."
    );
  }

  const formAttrs =
    parseAttributes(
      formAttributes
    );

  const action =
    String(
      formAttrs.action ||
        currentUrl
    ).trim();

  const actionUrl =
    new URL(
      action,
      currentUrl
    ).toString();

  const method =
    String(
      formAttrs.method ||
        "POST"
    )
      .trim()
      .toUpperCase();

  const fields: Array<{
    name: string;
    type: string;
    value: string;
  }> = [];

  const inputRegex =
    /<input\b([^>]*)>/gi;

  let inputMatch:
    RegExpExecArray |
    null;

  while (
    (
      inputMatch =
        inputRegex.exec(
          formBody
        )
    ) !== null
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

    fields.push({
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

  const passwordField =
    fields.find(
      (field) =>
        field.type ===
        "password"
    );

  const usernameField =
    fields.find(
      (field) =>
        ![
          "hidden",
          "password",
          "submit",
          "button",
          "checkbox",
          "radio",
        ].includes(
          field.type
        ) &&
        /user|login|kullanici|username|email/i.test(
          field.name
        )
    ) ||
    fields.find(
      (field) =>
        ![
          "hidden",
          "password",
          "submit",
          "button",
          "checkbox",
          "radio",
        ].includes(
          field.type
        )
    );

  if (
    !usernameField
  ) {
    throw new Error(
      "WingSM kullanıcı adı alanı bulunamadı."
    );
  }

  if (
    !passwordField
  ) {
    throw new Error(
      "WingSM şifre alanı bulunamadı."
    );
  }

  const hiddenFields:
    Record<
      string,
      string
    > = {};

  for (
    const field
    of fields
  ) {
    if (
      field.type ===
      "hidden"
    ) {
      hiddenFields[
        field.name
      ] =
        field.value;
    }
  }

  return {
    action:
      actionUrl,

    method,

    usernameField:
      usernameField.name,

    passwordField:
      passwordField.name,

    hiddenFields,
  };
}

// ======================================================
// SESSION TEST
// ======================================================

async function sessionIsValid(
  jar: CookieJar
) {
  try {
    const url =
      `${PORTAL_BASE_URL}/Http/AktifKullanici`;

    const result =
      await fetchWithJar(
        url,
        {
          method:
            "GET",

          headers: {
            Accept:
              "application/json",

            "User-Agent":
              "Mozilla/5.0 CNETMOBIL",
          },
        },
        jar
      );

    if (
      !result.response.ok
    ) {
      return false;
    }

    const contentType =
      String(
        result.response
          .headers
          .get(
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
      await result.response
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

    const obj =
      data as {
        kullanici?: {
          Id?: number;
        };
      };

    return (
      Number(
        obj.kullanici
          ?.Id ||
          0
      ) >
      0
    );
  } catch {
    return false;
  }
}

// ======================================================
// LOGIN
// ======================================================

async function loginPortal():
Promise<PortalSession> {
  const username =
    getUsername();

  const password =
    getPassword();

  const jar:
    CookieJar =
    new Map();

  /*
   * 1) Portal ana login sayfası.
   */
  const page =
    await fetchWithJar(
      `${PORTAL_BASE_URL}/`,
      {
        method:
          "GET",

        headers: {
          Accept:
            "text/html,application/xhtml+xml,*/*",

          "User-Agent":
            "Mozilla/5.0 CNETMOBIL",
        },
      },
      jar
    );

  if (
    !page.response.ok
  ) {
    throw new Error(
      `WingSM portal login sayfası açılamadı. HTTP ${page.response.status}`
    );
  }

  const html =
    await page.response
      .text();

  /*
   * 2) Form action + field isimlerini
   * gerçek login HTML'inden bul.
   */
  const loginForm =
    findLoginForm(
      html,
      page.url
    );

  /*
   * 3) Hidden alanlar.
   * CSRF varsa otomatik taşınır.
   */
  const body =
    new URLSearchParams();

  for (
    const [
      key,
      value,
    ]
    of Object.entries(
      loginForm
        .hiddenFields
    )
  ) {
    body.set(
      key,
      value
    );
  }

  body.set(
    loginForm
      .usernameField,
    username
  );

  body.set(
    loginForm
      .passwordField,
    password
  );

  /*
   * 4) Login POST.
   */
  const login =
    await fetchWithJar(
      loginForm.action,
      {
        method:
          loginForm.method ===
          "GET"
            ? "POST"
            : loginForm.method,

        headers: {
          Accept:
            "text/html,application/xhtml+xml,application/json,*/*",

          "Content-Type":
            "application/x-www-form-urlencoded",

          Origin:
            PORTAL_BASE_URL,

          Referer:
            page.url,

          "User-Agent":
            "Mozilla/5.0 CNETMOBIL",
        },

        body:
          body.toString(),
      },
      jar
    );

  if (
    login.response.status >=
    500
  ) {
    throw new Error(
      `WingSM portal login hatası. HTTP ${login.response.status}`
    );
  }

  /*
   * 5) Gerçek session testi.
   */
  const valid =
    await sessionIsValid(
      jar
    );

  if (!valid) {
    throw new Error(
      "WingSM portal login/session doğrulanamadı."
    );
  }

  const cookie =
    jarToCookie(
      jar
    );

  if (!cookie) {
    throw new Error(
      "WingSM portal session cookie oluşmadı."
    );
  }

  const now =
    Date.now();

  const session:
    PortalSession =
    {
      cookie,

      createdAt:
        now,

      /*
       * 10 dk local cache.
       * Session ölürse ayrıca
       * otomatik login yapılacak.
       */
      expiresAt:
        now +
        10 *
          60 *
          1000,
    };

  global
    .cnetWingSMPortalSession =
    session;

  return session;
}

// ======================================================
// SESSION CACHE
// ======================================================

async function getSession():
Promise<PortalSession> {
  const cached =
    global
      .cnetWingSMPortalSession;

  if (
    cached &&
    cached.cookie &&
    cached.expiresAt >
      Date.now()
  ) {
    return cached;
  }

  if (
    global
      .cnetWingSMPortalLoginPromise
  ) {
    return global
      .cnetWingSMPortalLoginPromise;
  }

  global
    .cnetWingSMPortalLoginPromise =
    loginPortal();

  try {
    return await global
      .cnetWingSMPortalLoginPromise;
  } finally {
    global
      .cnetWingSMPortalLoginPromise =
      undefined;
  }
}

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

function createUrl(
  path: string,
  query?:
    PortalRequestOptions[
      "query"
    ]
) {
  const url =
    new URL(
      path,
      `${PORTAL_BASE_URL}/`
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
        String(value)
      );
    }
  }

  return url.toString();
}

// ======================================================
// AUTHENTICATED PORTAL FETCH
// ======================================================

async function authenticatedFetch(
  path: string,
  options:
    PortalRequestOptions,
  session:
    PortalSession
) {
  const url =
    createUrl(
      path,
      options.query
    );

  const jar =
    cookieToJar(
      session.cookie
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
    "Mozilla/5.0 CNETMOBIL"
  );

  const method =
    options.method ||
    "GET";

  let body:
    string |
    undefined;

  if (
    options.body !==
      undefined &&
    method !==
      "GET"
  ) {
    if (
      typeof options.body ===
      "string"
    ) {
      body =
        options.body;
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

        cache:
          "no-store",
      },
      jar
    );

  /*
   * Cookie rotate olursa cache'i yenile.
   */
  const cookie =
    jarToCookie(
      jar
    );

  if (cookie) {
    global
      .cnetWingSMPortalSession =
      {
        ...session,
        cookie,
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
    PortalRequestOptions =
      {}
): Promise<T> {
  let session =
    await getSession();

  let response =
    await authenticatedFetch(
      path,
      options,
      session
    );

  /*
   * Oturum düşmüşse yeniden login.
   */
  if (
    response.status ===
      401 ||
    response.status ===
      403
  ) {
    clearWingSMPortalSession();

    session =
      await getSession();

    response =
      await authenticatedFetch(
        path,
        options,
        session
      );
  }

  let contentType =
    String(
      response.headers.get(
        "content-type"
      ) ||
        ""
    ).toLowerCase();

  /*
   * Session bittiyse WingSM JSON yerine
   * login HTML'i döndürebilir.
   */
  if (
    !contentType.includes(
      "json"
    )
  ) {
    clearWingSMPortalSession();

    session =
      await getSession();

    response =
      await authenticatedFetch(
        path,
        options,
        session
      );

    contentType =
      String(
        response.headers.get(
          "content-type"
        ) ||
          ""
      ).toLowerCase();
  }

  if (
    !response.ok
  ) {
    throw new Error(
      `WingSM portal isteği başarısız. HTTP ${response.status}`
    );
  }

  if (
    !contentType.includes(
      "json"
    )
  ) {
    throw new Error(
      `WingSM portal JSON dönmedi. HTTP ${response.status}`
    );
  }

  try {
    return (
      await response.json()
    ) as T;
  } catch {
    throw new Error(
      "WingSM portal cevabı JSON parse edilemedi."
    );
  }
}

// ======================================================
// TEST
// ======================================================

export async function testWingSMPortalSession() {
  const session =
    await getSession();

  const jar =
    cookieToJar(
      session.cookie
    );

  const valid =
    await sessionIsValid(
      jar
    );

  if (!valid) {
    clearWingSMPortalSession();

    throw new Error(
      "WingSM portal session geçersiz."
    );
  }

  /*
   * Güvenlik:
   * cookie, user, password dönmüyor.
   */
  return {
    success:
      true,

    connected:
      true,

    sessionValid:
      true,

    portal:
      "WingSM",
  };
}
