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

            if (n1 && p1 > 0) currentMap.set(`YNA1_${n1}`, p1);

            const n2 = row[3]?.toString().trim();
            const p2 = parsePrice(row[4]);

            if (n2 && p2 > 0) currentMap.set(`YNA2_${n2}`, p2);
          });
        }

        // ANALİZ MOTORU
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
              categoryLabel = "Kampanya";
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
              } else {
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
          <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83" />
        </svg>
      );
    }

    if (category === "Android") {
      return (
        <svg className={iconStyle} viewBox="0 0 24 24" fill="currentColor">
          <path d="M7 11h2v2H7zm8 0h2v2h-2z" />
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

    return (
      <svg className={iconStyle} viewBox="0 0 24 24" fill="currentColor">
        <path d="M21.41 11.58l-9-9C12.05 2.22 11.55 2 11 2H4" />
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
          0%, 100% {
            transform: scale(1);
            opacity: 1;
          }

          50% {
            transform: scale(1.03);
            opacity: 0.95;
          }
        }

        .animate-handle-pulse {
          animation: dynamic-pulse 2s infinite ease-in-out;
        }
      `}</style>

      {notifications.length > 0 && (
        <div className="fixed right-0 top-[18%] z-[9999] print:hidden flex items-center select-none font-sans">

          {/* PANEL */}
          <div
            className={`
              bg-[#0b1224]
              border border-[#16223f]
              w-[520px]
              rounded-3xl
              shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7)]
              overflow-hidden
              transition-all
              duration-500
              ease-[cubic-bezier(0.16,1,0.3,1)]
              fixed right-4 top-[18%]

              ${
                isOpen
                  ? "opacity-100 translate-x-0 pointer-events-auto"
                  : "opacity-0 translate-x-full pointer-events-none"
              }
            `}
          >

            {/* HEADER */}
            <div className="p-5 flex justify-between items-center border-b border-[#16223f] bg-[#0b1224]">

              <div className="flex items-center gap-3">

                <div className="p-2.5 rounded-full bg-blue-600/10 border border-blue-500/20 text-blue-400">
                  🔔
                </div>

                <div>

                  <div className="flex items-center gap-2">

                    <h3 className="text-white font-bold text-[16px] tracking-tight">
                      Bildirimler
                    </h3>

                    <span className="bg-[#13284f] text-[#3b82f6] text-[11px] font-black px-2.5 py-0.5 rounded-full border border-blue-500/10">
                      {notifications.length} Bildirim
                    </span>

                  </div>

                  <p className="text-[11px] text-slate-400/80 font-medium mt-0.5">
                    Son liste güncellemeleri
                  </p>

                </div>

              </div>

              <button
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-white hover:bg-[#1a2647] p-2 rounded-xl transition-all cursor-pointer"
              >
                ✕
              </button>

            </div>

            {/* CONTENT */}
            <div className="p-4 max-h-[420px] overflow-y-auto no-scrollbar flex flex-col gap-3 bg-[#070c1a]">

              {notifications.map((item) => (
                <div
                  key={item.id}
                  className="
                    flex
                    items-center
                    justify-between
                    p-4
                    bg-[#0f1932]/90
                    border border-[#1d2d54]/60
                    rounded-2xl
                    hover:border-blue-500/30
                    transition-all
                    duration-200
                  "
                >

                  <div className="flex items-center gap-3 min-w-0">

                    <div className="w-11 h-11 bg-[#172445] rounded-2xl flex items-center justify-center border border-[#253766] shrink-0">
                      {renderCategoryIcon(item.category)}
                    </div>

                    <div className="flex flex-col gap-1 min-w-0">

                      <div className="flex items-center gap-2">

                        {item.type === "up" && (
                          <span className="text-[9px] font-black px-2 py-1 bg-[#064e3b] text-[#10b981] rounded-md uppercase tracking-wider">
                            YÜKSELDİ
                          </span>
                        )}

                        {item.type === "down" && (
                          <span className="text-[9px] font-black px-2 py-1 bg-[#7f1d1d] text-[#ef4444] rounded-md uppercase tracking-wider">
                            DÜŞTÜ
                          </span>
                        )}

                        {item.type === "new" && (
                          <span className="text-[9px] font-black px-2 py-1 bg-[#1e3a8a] text-[#3b82f6] rounded-md uppercase tracking-wider">
                            YENİ
                          </span>
                        )}

                      </div>

                      <p className="text-[13px] text-white font-bold truncate">
                        {item.type === "new"
                          ? `Yeni Ürün Eklendi: ${item.name}`
                          : `${item.name} liste güncellendi`}
                      </p>

                    </div>

                  </div>

                  <div className="flex flex-col items-end gap-2 shrink-0 pl-2">

                    <span className="text-[11px] text-slate-500 font-black">
                      {item.time}
                    </span>

                    <span
                      className={`
                        w-2.5
                        h-2.5
                        rounded-full

                        ${
                          item.type === "up"
                            ? "bg-[#10b981]"
                            : item.type === "down"
                            ? "bg-[#ef4444]"
                            : "bg-[#3b82f6]"
                        }
                      `}
                    />

                  </div>

                </div>
              ))}

            </div>

            {/* FOOTER */}
            <div className="p-4 px-5 flex justify-between items-center border-t border-[#16223f] bg-[#0b1224]">

              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>

                <span className="text-[11px] text-slate-400 font-bold">
                  Canlı güncellenir
                </span>
              </div>

              <button
                onClick={clearNotifications}
                className="
                  bg-transparent
                  hover:bg-[#16223f]
                  text-slate-300
                  hover:text-white
                  border border-[#1d2d54]
                  font-bold
                  text-xs
                  px-4
                  py-2.5
                  rounded-xl
                  transition-all
                  duration-200
                  cursor-pointer
                "
              >
                Hepsini Temizle
              </button>

            </div>

          </div>

          {/* DİKEY SEKME */}
          <div
            onClick={() => setIsOpen(true)}
            className={`
              fixed
              right-0
              top-[18%]

              w-[72px]
              py-9

              rounded-l-[30px]

              border border-blue-400/30 border-r-0

              bg-gradient-to-b
              from-[#2f80ff]
              via-[#1456d9]
              to-[#0a2f87]

              shadow-[0_0_55px_rgba(37,99,235,0.55)]

              flex
              flex-col
              items-center
              justify-start

              pt-5
              gap-5

              cursor-pointer
              select-none

              transition-all
              duration-500

              ${
                isOpen
                  ? "translate-x-[35px] opacity-40"
                  : "translate-x-0 opacity-100 animate-handle-pulse"
              }
            `}
          >

            {/* BADGE */}
            <div className="relative flex items-center justify-center">

              <span className="absolute inline-flex h-6 w-6 rounded-full bg-red-400 opacity-50 animate-ping"></span>

              <div className="relative h-6 w-6 rounded-full bg-[#ef4444] border border-white/20 shadow-lg flex items-center justify-center text-[11px] font-black text-white">
                {notifications.length}
              </div>

            </div>

            {/* ICON */}
            <div className="w-11 h-11 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center backdrop-blur-xl">
              🔔
            </div>

            {/* TEXT */}
            <div
              className="
                writing-mode-vertical
                text-white
                text-[11px]
                font-extrabold
                tracking-[0.42em]
                uppercase
                leading-none
                mt-1
              "
              style={{ transform: "rotate(180deg)" }}
            >
              LİSTE GÜNCELLENDİ
            </div>

            {/* ARROW */}
            <div className="text-white/80 text-[12px] font-black">
              ‹
            </div>

          </div>

        </div>
      )}
    </>
  );
}
