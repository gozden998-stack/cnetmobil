"use client";

import React, { useState, useEffect, useRef } from "react";

interface NotificationItem {
  id: string;
  category: string;
  name: string;
  type: "up" | "down" | "new";
  time: string;
}

export default function GlobalMarket() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isOpen, setIsOpen] = useState<boolean>(false);

  const prevPricesMap = useRef<Map<string, number> | null>(null);
  const isFirstLoad = useRef<boolean>(true);

  const playDing = () => {
    try {
      const audio = new Audio(
        "https://actions.google.com/sounds/v1/alarms/beep_short.ogg"
      );
      audio.play().catch(() => {});
    } catch (e) {}
  };

  const parsePrice = (val: any) => {
    if (val === null || val === undefined || val === "") return 0;

    if (typeof val === "number") return Math.floor(val);

    let strVal = String(val).trim();

    if (strVal.includes(",")) {
      strVal = strVal.split(",")[0];
    }

    const match = strVal.replace(/\D/g, "");

    return match ? parseInt(match, 10) : 0;
  };

  useEffect(() => {
    const fetchMarketData = async () => {
      try {
        const timestamp = Date.now();

        const res = await fetch(`/api/sheets?_bust=${timestamp}`, {
          cache: "no-store",
          headers: {
            "Cache-Control": "no-cache, no-store",
            Pragma: "no-cache",
          },
        });

        if (!res.ok) return;

        const responseData = await res.json();

        if (!responseData || !responseData.payload) return;

        const decodedString = decodeURIComponent(
          escape(window.atob(responseData.payload))
        );

        const allData = JSON.parse(decodedString);

        const currentMap = new Map<string, number>();

        let newItemsDetected: NotificationItem[] = [];

        const freezeTime = new Date().toLocaleTimeString("tr-TR", {
          hour: "2-digit",
          minute: "2-digit",
        });

        // CEP TABLET
        if (allData.CepTablet && Array.isArray(allData.CepTablet)) {
          allData.CepTablet.forEach((row: any) => {
            const appleName = row[0]?.toString().trim();

            if (appleName) {
              const p1 = parsePrice(row[1]);
              const p2 = parsePrice(row[2]);

              if (p1 > 0) currentMap.set(`APPLE_${appleName}_v1`, p1);
              if (p2 > 0) currentMap.set(`APPLE_${appleName}_v2`, p2);
            }

            const androidName = row[5]?.toString().trim();

            if (androidName) {
              const p1 = parsePrice(row[6]);
              const p2 = parsePrice(row[7]);

              if (p1 > 0) currentMap.set(`ANDROID_${androidName}_v1`, p1);
              if (p2 > 0) currentMap.set(`ANDROID_${androidName}_v2`, p2);
            }

            const kampanyaName = row[10]?.toString().trim();
            const kampanyaPrice = parsePrice(row[11]);

            if (kampanyaName && kampanyaPrice > 0) {
              currentMap.set(`KAMPANYA_${kampanyaName}`, kampanyaPrice);
            }
          });
        }

        // İKİNCİ EL
        if (allData.IkinciEl && Array.isArray(allData.IkinciEl)) {
          allData.IkinciEl.forEach((row: any) => {
            const name = `${row[0] || ""} ${row[1] || ""}`.trim();

            const price = parsePrice(row[2]);

            if (name && price > 0) {
              currentMap.set(`IKINCI_${name}`, price);
            }
          });
        }

        // YNA
        if (allData.YNA && Array.isArray(allData.YNA)) {
          allData.YNA.forEach((row: any) => {
            const n1 = row[0]?.toString().trim();
            const p1 = parsePrice(row[1]);

            if (n1 && p1 > 0) {
              currentMap.set(`YNA1_${n1}`, p1);
            }

            const n2 = row[3]?.toString().trim();
            const p2 = parsePrice(row[4]);

            if (n2 && p2 > 0) {
              currentMap.set(`YNA2_${n2}`, p2);
            }
          });
        }

        // ANALİZ
        if (prevPricesMap.current && !isFirstLoad.current) {
          currentMap.forEach((price, key) => {
            const oldPrice = prevPricesMap.current!.get(key);

            let cleanName = key
              .replace(/^(APPLE_|ANDROID_|KAMPANYA_|IKINCI_|YNA1_|YNA2_)/, "")
              .replace(/_v[12]$/, "");

            let categoryLabel = "Cihaz";

            if (key.startsWith("APPLE_")) categoryLabel = "Apple";
            else if (key.startsWith("ANDROID_")) categoryLabel = "Android";
            else if (key.startsWith("KAMPANYA_"))
              categoryLabel = "Kampanya Ürünü";
            else if (key.startsWith("IKINCI_")) categoryLabel = "2.El";
            else if (key.startsWith("YNA")) categoryLabel = "Aksesuar";

            if (oldPrice === undefined) {
              newItemsDetected.push({
                id: `${key}-${Date.now()}`,
                category: categoryLabel,
                name: cleanName,
                type: "new",
                time: freezeTime,
              });
            } else if (oldPrice !== price) {
              const diff = price - oldPrice;

              if (diff > 0) {
                newItemsDetected.push({
                  id: `${key}-${Date.now()}`,
                  category: categoryLabel,
                  name: cleanName,
                  type: "up",
                  time: freezeTime,
                });
              } else if (diff < 0) {
                newItemsDetected.push({
                  id: `${key}-${Date.now()}`,
                  category: categoryLabel,
                  name: cleanName,
                  type: "down",
                  time: freezeTime,
                });
              }
            }
          });

          if (newItemsDetected.length > 0 && newItemsDetected.length <= 10) {
            playDing();

            setNotifications((prev) => {
              const filtered = prev.filter(
                (p) => !newItemsDetected.some((n) => n.name === p.name)
              );

              return [...newItemsDetected, ...filtered].slice(0, 15);
            });
          }
        }

        prevPricesMap.current = currentMap;

        if (currentMap.size > 0) {
          isFirstLoad.current = false;
        }
      } catch (error) {}
    };

    fetchMarketData();

    const interval = setInterval(fetchMarketData, 30000);

    return () => clearInterval(interval);
  }, []);

  const clearNotifications = (e: React.MouseEvent) => {
    e.stopPropagation();

    setNotifications([]);
    setIsOpen(false);
  };

  const renderCategoryIcon = (category: string) => {
    const iconStyle = "w-[18px] h-[18px] text-white/90";

    if (category === "Apple") {
      return (
        <svg className={iconStyle} viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 4.17c.66-.81 1.11-1.93.99-3.06-.96.04-2.13.64-2.82 1.45-.6.7-1.13 1.84-1.01 2.95 1.07.08 2.18-.53 2.84-1.34z" />
        </svg>
      );
    }

    if (category === "Android") {
      return (
        <svg className={iconStyle} viewBox="0 0 24 24" fill="currentColor">
          <path d="M7 11h2v2H7zm8 0h2v2h-2zm-4-4h2v2h-2zm0 8h2v2h-2zm-6-2.3c0-2 .6-3.8 1.7-5.3l-1.3-1.3 1.4-1.4 1.6 1.6C10 3.1 11.5 2.5 13 2.5s3 .6 4.3 1.8l1.6-1.6 1.4 1.4-1.3 1.3c1.1 1.5 1.7 3.3 1.7 5.3H5zm8-6.2c-4.1 0-7.5 3.4-7.5 7.5h15c0-4.1-3.4-7.5-7.5-7.5z" />
        </svg>
      );
    }

    if (category === "2.El") {
      return (
        <span className="text-[9px] font-black tracking-tighter text-[#f59e0b]">
          2.EL
        </span>
      );
    }

    if (category === "Aksesuar") {
      return (
        <svg
          className={iconStyle}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 14c0-4.97 4.03-9 9-9s9 4.03 9 9M6 14h3v5H6zm9 0h3v5h-3z" />
        </svg>
      );
    }

    return (
      <svg className={iconStyle} viewBox="0 0 24 24" fill="currentColor">
        <path d="M21.41 11.58l-9-9C12.05 2.22 11.55 2 11 2H4c-1.1 0-2 .9-2 2v7c0 .55.22 1.05.59 1.42l9 9c.36.36.86.58 1.41.58.55 0 1.05-.22 1.41-.59l7-7c.37-.36.59-.86.59-1.41 0-.55-.23-1.06-.59-1.42zM5.5 7C4.67 7 4 6.33 4 5.5S4.67 4 5.5 4 7 4.67 7 5.5 6.33 7 5.5 7z" />
      </svg>
    );
  };

  return (
    <>
      <style>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }

        .writing-mode-vertical {
          writing-mode: vertical-rl;
          transform: rotate(180deg);
        }

        @keyframes dynamic-pulse {
          0%,100% {
            transform: scale(1);
            opacity: 1;
          }

          50% {
            transform: scale(1.03);
            opacity: 0.96;
          }
        }

        .animate-handle-pulse {
          animation: dynamic-pulse 2.2s infinite ease-in-out;
        }
      `}</style>

      {notifications.length > 0 && (
        <div className="fixed right-0 top-0 z-[9999] print:hidden select-none font-sans">
          {/* PANEL */}
          <div
            className={`
              fixed
              right-4
              top-1/2
              -translate-y-1/2

              bg-[#071120]/95
              backdrop-blur-2xl

              border
              border-[#16345c]

              w-[540px]
              rounded-[30px]

              shadow-[0_0_70px_rgba(0,119,255,0.18)]

              overflow-hidden

              transition-all
              duration-500

              ${
                isOpen
                  ? "opacity-100 translate-x-0 pointer-events-auto"
                  : "opacity-0 translate-x-full pointer-events-none"
              }
            `}
          >
            {/* HEADER */}
            <div className="relative px-6 py-5 border-b border-[#132848] bg-[#07162b]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-[52px] h-[52px] rounded-full bg-[#091d3a] border border-[#174b8a] flex items-center justify-center shadow-[0_0_25px_rgba(0,119,255,0.18)]">
                    <svg
                      className="w-6 h-6 text-[#4da3ff]"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.3"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15 17h5l-1.405-1.405C18.214 15.214 18 14.702 18 14.172V11a6.002 6.002 0 00-4-5.659V4a2 2 0 10-4 0v1.341C7.67 6.165 6 8.388 6 11v3.172c0 .53-.214 1.042-.595 1.423L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                      />
                    </svg>
                  </div>

                  <div>
                    <div className="flex items-center gap-3">
                      <h3 className="text-white text-[31px] font-black tracking-tight">
                        Bildirimler
                      </h3>

                      <div className="bg-[#0c2f63] text-[#58a6ff] border border-[#1e4f93] text-[13px] font-black px-4 py-1 rounded-full">
                        {notifications.length} Bildirim
                      </div>
                    </div>

                    <p className="text-[#8ea9cf] text-[14px] mt-1">
                      Son fiyat ve ürün güncellemeleri
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setIsOpen(false)}
                  className="text-[#7ca7dd] hover:text-white transition-all p-2"
                >
                  <svg
                    className="w-7 h-7"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            </div>

            {/* CONTENT */}
            <div className="bg-[#040d1b] px-5 py-5 max-h-[620px] overflow-y-auto no-scrollbar flex flex-col gap-4">
              {notifications.map((item) => (
                <div
                  key={item.id}
                  className="
                    group
                    relative
                    bg-[#08172c]
                    border
                    border-[#14345d]
                    rounded-[22px]
                    px-5
                    py-4

                    hover:border-[#2677e8]
                    hover:shadow-[0_0_25px_rgba(0,119,255,0.15)]

                    transition-all
                    duration-300

                    flex
                    items-center
                    justify-between
                  "
                >
                  <div className="flex items-center gap-4 min-w-0">
                    {/* ICON */}
                    <div className="w-[56px] h-[56px] rounded-[18px] bg-[#0c1e37] border border-[#1b467e] flex items-center justify-center shrink-0 shadow-inner">
                      {renderCategoryIcon(item.category)}
                    </div>

                    {/* TEXT */}
                    <div className="flex flex-col gap-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {item.type === "up" && (
                          <span className="bg-[#0b5d42] text-[#5cffba] text-[10px] px-2 py-[3px] rounded-md font-black tracking-wide border border-[#1c8d69]">
                            YÜKSELDİ
                          </span>
                        )}

                        {item.type === "down" && (
                          <span className="bg-[#63212b] text-[#ff7d90] text-[10px] px-2 py-[3px] rounded-md font-black tracking-wide border border-[#9d3242]">
                            DÜŞTÜ
                          </span>
                        )}

                        {item.type === "new" && (
                          <span className="bg-[#163c84] text-[#6db0ff] text-[10px] px-2 py-[3px] rounded-md font-black tracking-wide border border-[#2e61c2]">
                            YENİ
                          </span>
                        )}

                        <span className="text-white text-[15px] font-black">
                          {item.category}
                        </span>
                      </div>

                      <p className="text-[#d6e2f5] text-[24px] font-semibold truncate max-w-[340px]">
                        {item.type === "new"
                          ? `Yeni Ürün Eklendi: ${item.name}`
                          : `${item.category} Fiyatı ${
                              item.type === "up" ? "Yükseldi" : "Düştü"
                            }: ${item.name}`}
                      </p>
                    </div>
                  </div>

                  {/* RIGHT */}
                  <div className="flex flex-col items-end gap-3 ml-4 shrink-0">
                    <span className="text-[#88a8d5] text-[13px] font-bold">
                      {item.time}
                    </span>

                    <span
                      className={`
                        w-3
                        h-3
                        rounded-full

                        ${
                          item.type === "up"
                            ? "bg-[#00e39a] shadow-[0_0_15px_rgba(0,227,154,0.95)]"
                            : item.type === "down"
                            ? "bg-[#ff5066] shadow-[0_0_15px_rgba(255,80,102,0.95)]"
                            : "bg-[#3b82ff] shadow-[0_0_15px_rgba(59,130,255,0.95)]"
                        }
                      `}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* FOOTER */}
            <div className="bg-[#07162b] border-t border-[#16345c] px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3 text-[#8ba9d4] text-sm font-semibold">
                <div className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>

                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-400"></span>
                </div>

                Canlı güncellenir
              </div>

              <button
                onClick={clearNotifications}
                className="
                  flex
                  items-center
                  gap-2

                  bg-[#081d3d]
                  hover:bg-[#0d2d5d]

                  border
                  border-[#1d4b8b]

                  text-[#7cb5ff]
                  hover:text-white

                  px-5
                  py-3

                  rounded-2xl

                  font-bold
                  text-sm

                  transition-all
                  duration-300
                "
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>

                Hepsini Temizle
              </button>
            </div>
          </div>

          {/* MAVİ SEKME */}
          <div
            onClick={() => setIsOpen(true)}
            className={`
              fixed
              right-0
              top-1/2
              -translate-y-1/2
              z-[10000]

              w-[74px]
              h-[470px]

              rounded-l-[28px]

              border
              border-[#4da3ff55]
              border-r-0

              bg-gradient-to-b
              from-[#1f8cff]
              via-[#0057d8]
              to-[#003a97]

              shadow-[0_0_45px_rgba(0,119,255,0.55)]

              flex
              flex-col
              items-center
              justify-between

              py-6

              cursor-pointer
              select-none

              transition-all
              duration-500

              ${
                isOpen
                  ? "translate-x-full opacity-0 pointer-events-none"
                  : "translate-x-0 opacity-100 pointer-events-auto animate-handle-pulse"
              }
            `}
          >
            {/* ÜST */}
            <div className="relative mt-1">
              <div className="w-11 h-11 rounded-full bg-[#0d47c7] border border-[#6fb6ff55] flex items-center justify-center shadow-[0_0_20px_rgba(0,119,255,0.45)]">
                <svg
                  className="w-5 h-5 text-white"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 17h5l-1.405-1.405C18.214 15.214 18 14.702 18 14.172V11a6.002 6.002 0 00-4-5.659V4a2 2 0 10-4 0v1.341C7.67 6.165 6 8.388 6 11v3.172c0 .53-.214 1.042-.595 1.423L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                  />
                </svg>
              </div>

              <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[#ff4b5c] text-white text-[10px] font-black flex items-center justify-center border border-white/20">
                {notifications.length}
              </div>
            </div>

            {/* TEXT */}
            <div
              className="
                writing-mode-vertical
                text-white
                font-black
                tracking-[0.45em]
                text-[16px]
                leading-none
                uppercase
                drop-shadow-[0_0_10px_rgba(255,255,255,0.35)]
              "
              style={{ transform: "rotate(180deg)" }}
            >
              LİSTE GÜNCELLENDİ
            </div>

            {/* ALT */}
            <div className="mb-2 text-white text-[34px] font-thin opacity-90">
              ‹
            </div>
          </div>
        </div>
      )}
    </>
  );
}
