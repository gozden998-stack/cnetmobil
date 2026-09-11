"use client";

import { useEffect, useRef } from "react";

type PriceDirection = "up" | "down";

export interface PriceNotificationItem {
  id: string;
  key: string;
  category: string;
  name: string;
  direction: PriceDirection;
  oldPrice: number;
  newPrice: number;
  diff: number;
  changedAt: number;
  expiresAt: number;
}

const PRICE_NOTIFICATION_STORAGE_KEY =
  "cnetmobil_price_notifications_v2";

const PRICE_SNAPSHOT_STORAGE_KEY =
  "cnetmobil_price_snapshot_v2";

const PRICE_NOTIFICATION_EVENT =
  "cnetmobil:price-notifications";

const TEN_MINUTES = 10 * 60 * 1000;
const MAX_NOTIFICATIONS = 50;

function parsePrice(val: any) {
  if (
    val === null ||
    val === undefined ||
    val === ""
  ) {
    return 0;
  }

  if (typeof val === "number") {
    return Math.floor(val);
  }

  let strVal = String(val).trim();

  if (strVal.includes(",")) {
    strVal = strVal.split(",")[0];
  }

  const match =
    strVal.replace(/\D/g, "");

  return match
    ? parseInt(match, 10)
    : 0;
}

function readStoredNotifications(): PriceNotificationItem[] {
  try {
    const raw =
      window.localStorage.getItem(
        PRICE_NOTIFICATION_STORAGE_KEY
      );

    if (!raw) return [];

    const parsed = JSON.parse(raw);

    return Array.isArray(parsed)
      ? parsed
          .filter(
            (item) =>
              item &&
              typeof item.id === "string" &&
              typeof item.changedAt === "number"
          )
          .slice(0, MAX_NOTIFICATIONS)
      : [];
  } catch {
    return [];
  }
}

function writeStoredNotifications(
  items: PriceNotificationItem[]
) {
  try {
    window.localStorage.setItem(
      PRICE_NOTIFICATION_STORAGE_KEY,
      JSON.stringify(
        items.slice(
          0,
          MAX_NOTIFICATIONS
        )
      )
    );
  } catch {}

  window.dispatchEvent(
    new CustomEvent(
      PRICE_NOTIFICATION_EVENT,
      {
        detail: items.slice(
          0,
          MAX_NOTIFICATIONS
        ),
      }
    )
  );
}

function readStoredSnapshot() {
  try {
    const raw =
      window.localStorage.getItem(
        PRICE_SNAPSHOT_STORAGE_KEY
      );

    if (!raw) {
      return null;
    }

    const parsed =
      JSON.parse(raw);

    if (
      !parsed ||
      typeof parsed !== "object"
    ) {
      return null;
    }

    const map =
      new Map<string, number>();

    Object.entries(parsed).forEach(
      ([key, value]) => {
        const n = Number(value);

        if (
          key &&
          Number.isFinite(n) &&
          n > 0
        ) {
          map.set(key, n);
        }
      }
    );

    return map.size > 0
      ? map
      : null;
  } catch {
    return null;
  }
}

function writeStoredSnapshot(
  map: Map<string, number>
) {
  try {
    window.localStorage.setItem(
      PRICE_SNAPSHOT_STORAGE_KEY,
      JSON.stringify(
        Object.fromEntries(map)
      )
    );
  } catch {}
}

export default function GlobalMarket() {
  const prevPricesMap =
    useRef<Map<string, number> | null>(
      null
    );

  useEffect(() => {
    let cancelled = false;

    const fetchMarketData =
      async () => {
        try {
          const timestamp =
            Date.now();

          const res =
            await fetch(
              `/api/sheets?_bust=${timestamp}`,
              {
                cache: "no-store",
                headers: {
                  "Cache-Control":
                    "no-cache, no-store",
                  Pragma:
                    "no-cache",
                },
              }
            );

          if (
            cancelled ||
            !res.ok
          ) {
            return;
          }

          const responseData =
            await res.json();

          if (
            !responseData ||
            !responseData.payload
          ) {
            return;
          }

          const decodedString =
            decodeURIComponent(
              escape(
                window.atob(
                  responseData.payload
                )
              )
            );

          const allData =
            JSON.parse(
              decodedString
            );

          const currentMap =
            new Map<
              string,
              {
                price: number;
                category: string;
                name: string;
              }
            >();

          // CEP + TABLET
          if (
            allData.CepTablet &&
            Array.isArray(
              allData.CepTablet
            )
          ) {
            allData.CepTablet.forEach(
              (row: any) => {
                const appleName =
                  row[0]
                    ?.toString()
                    .trim();

                if (appleName) {
                  const p1 =
                    parsePrice(
                      row[1]
                    );
                  const p2 =
                    parsePrice(
                      row[2]
                    );

                  if (p1 > 0) {
                    currentMap.set(
                      `APPLE_${appleName}_v1`,
                      {
                        price: p1,
                        category:
                          "Apple",
                        name:
                          appleName,
                      }
                    );
                  }

                  if (p2 > 0) {
                    currentMap.set(
                      `APPLE_${appleName}_v2`,
                      {
                        price: p2,
                        category:
                          "Apple",
                        name:
                          appleName,
                      }
                    );
                  }
                }

                const androidName =
                  row[5]
                    ?.toString()
                    .trim();

                if (
                  androidName
                ) {
                  const p1 =
                    parsePrice(
                      row[6]
                    );
                  const p2 =
                    parsePrice(
                      row[7]
                    );

                  if (p1 > 0) {
                    currentMap.set(
                      `ANDROID_${androidName}_v1`,
                      {
                        price: p1,
                        category:
                          "Android",
                        name:
                          androidName,
                      }
                    );
                  }

                  if (p2 > 0) {
                    currentMap.set(
                      `ANDROID_${androidName}_v2`,
                      {
                        price: p2,
                        category:
                          "Android",
                        name:
                          androidName,
                      }
                    );
                  }
                }

                const kampanyaName =
                  row[10]
                    ?.toString()
                    .trim();

                const kampanyaPrice =
                  parsePrice(
                    row[11]
                  );

                if (
                  kampanyaName &&
                  kampanyaPrice > 0
                ) {
                  currentMap.set(
                    `KAMPANYA_${kampanyaName}`,
                    {
                      price:
                        kampanyaPrice,
                      category:
                        "Kampanya",
                      name:
                        kampanyaName,
                    }
                  );
                }
              }
            );
          }

          // 2. EL
          if (
            allData.IkinciEl &&
            Array.isArray(
              allData.IkinciEl
            )
          ) {
            allData.IkinciEl.forEach(
              (row: any) => {
                const name =
                  `${row[0] || ""} ${
                    row[1] || ""
                  }`.trim();

                const price =
                  parsePrice(
                    row[2]
                  );

                if (
                  name &&
                  price > 0
                ) {
                  currentMap.set(
                    `IKINCI_${name}`,
                    {
                      price,
                      category:
                        "2. El",
                      name,
                    }
                  );
                }
              }
            );
          }

          // YNA
          if (
            allData.YNA &&
            Array.isArray(
              allData.YNA
            )
          ) {
            allData.YNA.forEach(
              (row: any) => {
                const n1 =
                  row[0]
                    ?.toString()
                    .trim();

                const p1 =
                  parsePrice(
                    row[1]
                  );

                if (
                  n1 &&
                  p1 > 0
                ) {
                  currentMap.set(
                    `YNA1_${n1}`,
                    {
                      price: p1,
                      category:
                        "Aksesuar",
                      name: n1,
                    }
                  );
                }

                const n2 =
                  row[3]
                    ?.toString()
                    .trim();

                const p2 =
                  parsePrice(
                    row[4]
                  );

                if (
                  n2 &&
                  p2 > 0
                ) {
                  currentMap.set(
                    `YNA2_${n2}`,
                    {
                      price: p2,
                      category:
                        "Aksesuar",
                      name: n2,
                    }
                  );
                }
              }
            );
          }

          const currentPriceMap =
            new Map<
              string,
              number
            >();

          currentMap.forEach(
            (value, key) => {
              currentPriceMap.set(
                key,
                value.price
              );
            }
          );

          if (
            prevPricesMap.current ===
            null
          ) {
            prevPricesMap.current =
              readStoredSnapshot();
          }

          const previous =
            prevPricesMap.current;

          if (
            previous &&
            previous.size > 0
          ) {
            const detected:
              PriceNotificationItem[] =
                [];

            currentMap.forEach(
              (
                current,
                key
              ) => {
                const oldPrice =
                  previous.get(
                    key
                  );

                if (
                  oldPrice ===
                    undefined ||
                  oldPrice ===
                    current.price
                ) {
                  return;
                }

                const changedAt =
                  Date.now();

                const diff =
                  current.price -
                  oldPrice;

                detected.push({
                  id: `${key}-${oldPrice}-${current.price}-${changedAt}`,
                  key,
                  category:
                    current.category,
                  name:
                    current.name,
                  direction:
                    diff > 0
                      ? "up"
                      : "down",
                  oldPrice,
                  newPrice:
                    current.price,
                  diff,
                  changedAt,
                  expiresAt:
                    changedAt +
                    TEN_MINUTES,
                });
              }
            );

            if (
              detected.length >
              0
            ) {
              const existing =
                readStoredNotifications();

              const merged = [
                ...detected,
                ...existing,
              ]
                .filter(
                  (
                    item,
                    index,
                    array
                  ) =>
                    array.findIndex(
                      (other) =>
                        other.id ===
                        item.id
                    ) === index
                )
                .sort(
                  (a, b) =>
                    b.changedAt -
                    a.changedAt
                )
                .slice(
                  0,
                  MAX_NOTIFICATIONS
                );

              // SES YOK.
              // SAGDAN ACILAN ESKI PANEL YOK.
              // Sadece ana sayfadaki sabit Bildirimler kutusuna veri yollar.
              writeStoredNotifications(
                merged
              );
            }
          }

          prevPricesMap.current =
            currentPriceMap;

          writeStoredSnapshot(
            currentPriceMap
          );
        } catch {
          // Bildirim motoru ana paneli asla bozmasin.
        }
      };

    void fetchMarketData();

    // Mevcut 30 saniyelik kontrol temposu korunuyor.
    const interval =
      window.setInterval(
        () => {
          void fetchMarketData();
        },
        30_000
      );

    return () => {
      cancelled = true;
      window.clearInterval(
        interval
      );
    };
  }, []);

  return null;
}
