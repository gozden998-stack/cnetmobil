"use client";
import React, { useState, useEffect, useRef } from 'react';

export default function GlobalMarket() {
  const [tickerItems, setTickerItems] = useState<{ id: number, text: string, type: 'up' | 'down' | 'new' }[]>([]);
  const [toasts, setToasts] = useState<{ id: number, title: string, items: string[], type: 'price' | 'new' }[]>([]);
  const [isOpen, setIsOpen] = useState<boolean>(false); 
  
  const prevPricesMap = useRef<Map<string, number> | null>(null);
  const isFirstLoad = useRef<boolean>(true);

  const playDing = () => {
    try {
      const audio = new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg');
      audio.play().catch(() => {});
    } catch (e) {}
  };

  const parsePrice = (val: any) => {
    if (val === null || val === undefined || val === '') return 0;
    if (typeof val === 'number') return Math.floor(val);
    let strVal = String(val).trim();
    if (strVal.includes(',')) strVal = strVal.split(',')[0];
    const match = strVal.replace(/\D/g, '');
    return match ? parseInt(match, 10) : 0;
  };

  useEffect(() => {
    const fetchMarketData = async () => {
      try {
        // 🚀 KANALLARI BİRBİRİNE KARIŞTIRMAYAN ULTRA-STRIKT GÖZETLEYİCİ
        let detectedChannel = "cmr_merkez";
        if (typeof document !== 'undefined') {
          const bodyText = document.body?.innerText?.toLowerCase() || "";
          
          // Artik düz "zumay" kelimesine bakmiyoruz! Sadece sag üstteki kanal etiketine bakiyoruz.
          if (bodyText.includes("zumay kan")) {
            detectedChannel = "zumay";
          } else if (bodyText.includes("vodafone kan") || bodyText.includes("vodofone kan")) {
            detectedChannel = "vodafone";
          }
        }

        // ZUMAY KORUMASI: Sadece ekranda Zumay etiketi varsa sistemi kilitler
        if (detectedChannel === "zumay") {
          setTickerItems([]);
          setToasts([]);
          setIsOpen(false);
          return; 
        }

        const timestamp = Date.now();
        const res = await fetch(`/api/sheets?_bust=${timestamp}`, { 
          cache: 'no-store', 
          headers: { 'Cache-Control': 'no-cache, no-store', 'Pragma': 'no-cache' } 
        });
        
        if (!res.ok) return;
        const responseData = await res.json();
        if (!responseData || !responseData.payload) return;

        const decodedString = decodeURIComponent(escape(window.atob(responseData.payload)));
        const allData = JSON.parse(decodedString);

        const currentMap = new Map<string, number>();
        let newlyAdded: string[] = [];
        let priceChanged: { name: string, diff: number, price: number }[] = [];
        let newTickers: { id: number, text: string, type: 'up' | 'down' | 'new' }[] = [];

        // ÇALIŞAN ÇİFT SÜTUNLU ORİJİNAL VERİ MOTORU
        // 1. CEP TABLET (APPLE, ANDROID, KAMPANYA)
        if (allData.CepTablet && Array.isArray(allData.CepTablet)) {
          allData.CepTablet.forEach((row: any) => {
            // Apple (row[1] ve row[2])
            const appleName = row[0]?.toString().trim();
            if (appleName) {
              const p1 = parsePrice(row[1]);
              const p2 = parsePrice(row[2]);
              if (p1 > 0) currentMap.set(`APPLE_${appleName}_v1`, p1);
              if (p2 > 0) currentMap.set(`APPLE_${appleName}_v2`, p2);
            }
            // Android (row[6] ve row[7])
            const androidName = row[5]?.toString().trim();
            if (androidName) {
              const p1 = parsePrice(row[6]);
              const p2 = parsePrice(row[7]);
              if (p1 > 0) currentMap.set(`ANDROID_${androidName}_v1`, p1);
              if (p2 > 0) currentMap.set(`ANDROID_${androidName}_v2`, p2);
            }
            // Kampanya Sıfır
            const kampanyaName = row[10]?.toString().trim();
            const kampanyaPrice = parsePrice(row[11]);
            if (kampanyaName && kampanyaPrice > 0) {
              currentMap.set(`KAMPANYA_${kampanyaName}`, kampanyaPrice);
            }
          });
        }

        // 2. İKİNCİ EL (Vodafone kanalında değilse yükler)
        if (allData.IkinciEl && Array.isArray(allData.IkinciEl) && detectedChannel !== "vodafone") {
          allData.IkinciEl.forEach((row: any) => {
            const name = `${row[0] || ''} ${row[1] || ''}`.trim();
            const price = parsePrice(row[2]);
            if (name && price > 0) currentMap.set(`IKINCI_${name}`, price);
          });
        }

        // 3. YNA AKSESUAR
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

        // VERİ KARŞILAŞTIRMA MOTORU
        if (prevPricesMap.current && !isFirstLoad.current) {
          currentMap.forEach((price, key) => {
            const oldPrice = prevPricesMap.current!.get(key);
            
            let cleanName = key
              .replace(/^(APPLE_|ANDROID_|KAMPANYA_|IKINCI_|YNA1_|YNA2_)/, '')
              .replace(/_v[12]$/, '');

            if (oldPrice === undefined) {
              if (!newlyAdded.includes(cleanName)) {
                newlyAdded.push(cleanName);
                newTickers.push({
                  id: Date.now() + Math.random(),
                  text: `🆕 ${cleanName} ${price.toLocaleString('tr-TR')} TL`,
                  type: 'new'
                });
              }
            } else if (oldPrice !== price) {
              const diff = price - oldPrice;
              if (diff !== 0 && !priceChanged.some(p => p.name === cleanName)) {
                priceChanged.push({ name: cleanName, diff, price });
                newTickers.push({
                  id: Date.now() + Math.random(),
                  text: `${diff > 0 ? '↑' : '↓'} ${cleanName} ${price.toLocaleString('tr-TR')} TL`,
                  type: diff > 0 ? 'up' : 'down'
                });
              }
            }
          });

          if ((newlyAdded.length > 0 || priceChanged.length > 0) && priceChanged.length <= 10) {
            playDing();
            
            let generatedToasts = [];
            if (priceChanged.length > 0) {
              generatedToasts.push({
                id: Date.now(),
                title: `🔥 ${priceChanged.length} Üründe Fiyat Değişti`,
                items: priceChanged.map(p => `• ${p.name} -> ${p.price.toLocaleString('tr-TR')} TL`),
                type: 'price' as const
              });
            }
            if (newlyAdded.length > 0) {
              generatedToasts.push({
                id: Date.now() + 1,
                title: `🆕 ${newlyAdded.length} Yeni Cihaz Eklendi`,
                items: newlyAdded.map(n => `• ${n}`),
                type: 'new' as const
              });
            }

            setToasts(prev => [...generatedToasts, ...prev].slice(0, 5));
            setTickerItems(prev => [...newTickers, ...prev].slice(0, 20));
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
    setToasts([]);
    setIsOpen(false);
  };

  return (
    <>
      <style>{`
        @keyframes ticker { 0% { transform: translateX(100vw); } 100% { transform: translateX(-100%); } }
        .animate-ticker { display: inline-block; white-space: nowrap; animation: ticker 30s linear infinite; }
        .animate-ticker:hover { animation-play-state: paused; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        
        @keyframes borsaFlash {
          0%, 100% { background-color: #f97316; box-shadow: 0 0 15px rgba(249, 115, 22, 0.6); }
          50% { background-color: #dc2626; box-shadow: 0 0 0px rgba(220, 38, 38, 0); }
        }
        .animate-borsa-flash { animation: borsaFlash 1.5s infinite ease-in-out; }
        
        .writing-mode-vertical { writing-mode: vertical-rl; transform: rotate(180deg); }
      `}</style>

      {/* ÜST BORSA ŞERİDİ */}
      {tickerItems.length > 0 && (
        <div className="fixed top-0 left-0 w-full h-8 bg-slate-950 text-white z-[9999] flex items-center border-b border-slate-800 shadow-lg print:hidden">
          <div className="bg-blue-600 h-full px-4 flex items-center font-black text-[10px] tracking-widest uppercase z-10 shadow-xl shrink-0">
            CANLI PİYASA
          </div>
          <div className="overflow-hidden flex-1 flex items-center h-full">
            <div className="animate-ticker cursor-default">
              {tickerItems.map((item, idx) => (
                <span key={item.id} className="mx-6 font-bold text-xs tracking-wide">
                  <span className={item.type === 'up' ? 'text-emerald-400' : item.type === 'down' ? 'text-rose-400' : 'text-amber-400'}>
                    {item.text}
                  </span>
                  {idx !== tickerItems.length - 1 && <span className="mx-6 text-slate-600">|</span>}
                </span>
              ))}
            </div>
          </div>
          <button onClick={() => setTickerItems([])} className="bg-slate-800 hover:bg-rose-600 transition-colors h-full px-4 flex items-center font-bold text-[10px] z-10 shrink-0 border-l border-slate-700 cursor-pointer">
            TEMİZLE ✖
          </button>
        </div>
      )}

      {/* SAĞ KENAR YANIP SÖNEN BUTON VE PANELİ */}
      {toasts.length > 0 && (
        <div className="fixed right-0 top-1/3 z-[9999] flex items-start select-none print:hidden pointer-events-auto">
          
          {isOpen && (
            <div className="bg-slate-900/98 backdrop-blur-md border border-slate-700 w-80 rounded-l-2xl shadow-2xl overflow-hidden mr-[-1px] transition-all duration-300 animate-in slide-in-from-right-8">
              <div className="bg-gradient-to-r from-orange-500 to-rose-600 p-3 flex justify-between items-center">
                <span className="text-white font-black text-xs uppercase tracking-wider">🔔 PİYASA HAREKETLERİ</span>
                <button 
                  onClick={clearNotifications}
                  className="bg-black/20 hover:bg-black/50 text-white rounded-md p-1 transition-colors cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <div className="p-4 max-h-80 overflow-y-auto no-scrollbar flex flex-col gap-3 bg-slate-950/40">
                {toasts.map((toast) => (
                  <div key={toast.id} className="border border-slate-800 bg-slate-900/80 rounded-xl p-3">
                    <h5 className="text-orange-400 font-extrabold text-[11px] uppercase tracking-wide mb-2">
                      {toast.title}
                    </h5>
                    <div className="flex flex-col gap-1">
                      {toast.items.map((item, i) => (
                        <p key={i} className="text-slate-200 text-xs font-bold truncate">{item}</p>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SIK DEĞİŞEN - YANIP SÖNEN DİKEY BUTON */}
          <div 
            onClick={() => setIsOpen(!isOpen)}
            className={`writing-mode-vertical px-3 py-6 rounded-l-xl text-white font-black tracking-widest text-xs uppercase cursor-pointer transition-all border-l border-t border-b border-orange-400/30 flex items-center gap-2 ${isOpen ? 'bg-slate-800' : 'animate-borsa-flash'}`}
          >
            <span className="transform rotate-90 text-sm mb-1">🔥</span>
            FİYAT DEĞİŞTİ
            {isOpen ? <span className="mt-2 text-[10px]">▶</span> : <span className="mt-2 text-[10px] animate-ping">◀</span>}
          </div>

        </div>
      )}
    </>
  );
}
