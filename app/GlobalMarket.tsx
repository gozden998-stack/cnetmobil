"use client";
import React, { useState, useEffect, useRef } from 'react';

interface PriceItem {
  category: string;
  name: string;
  price: number;
  diff: number;
}

interface ToastGroup {
  id: number;
  title: string;
  items: PriceItem[];
  type: 'price' | 'new';
}

export default function GlobalMarket() {
  const [tickerItems, setTickerItems] = useState<{ id: number, text: string, type: 'up' | 'down' | 'new' }[]>([]);
  const [toasts, setToasts] = useState<ToastGroup[]>([]);
  const [isHovered, setIsHovered] = useState<boolean>(false); 
  
  const prevPricesMap = useRef<Map<string, number> | null>(null);
  const isFirstLoad = useRef<boolean>(true);
  const hoverTimeout = useRef<any>(null);

  // PREMIUM HOVER GECİKMESİ FONKSİYONLARI
  const handleEnter = () => {
    if (hoverTimeout.current) {
      clearTimeout(hoverTimeout.current);
    }
    setIsHovered(true);
  };

  const handleLeave = () => {
    hoverTimeout.current = setTimeout(() => {
      setIsHovered(false);
    }, 180);
  };

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
        let priceChanged: { name: string, diff: number, price: number, categoryLabel: string }[] = []; 
        let newTickers: { id: number, text: string, type: 'up' | 'down' | 'new' }[] = [];

        // 1. CEP TABLET VERİLERİNİ TOPLA
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

        // 2. İKİNCİ EL VERİLERİNİ TOPLA (Artık kısıtlama olmadan herkes için yüklenir)
        if (allData.IkinciEl && Array.isArray(allData.IkinciEl)) {
          allData.IkinciEl.forEach((row: any) => {
            const name = `${row[0] || ''} ${row[1] || ''}`.trim();
            const price = parsePrice(row[2]);
            if (name && price > 0) currentMap.set(`IKINCI_${name}`, price);
          });
        }

        // 3. YNA AKSESUAR VERİLERİNİ TOPLA
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
                
                let categoryLabel = "Cihaz";
                if (key.startsWith("APPLE_")) categoryLabel = "Apple";
                else if (key.startsWith("ANDROID_")) categoryLabel = "Android";
                else if (key.startsWith("KAMPANYA_")) categoryLabel = "Kampanya";
                else if (key.startsWith("IKINCI_")) categoryLabel = "2.El";
                else if (key.startsWith("YNA")) categoryLabel = "Aksesuar";

                priceChanged.push({ name: cleanName, diff, price, categoryLabel });
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
            
            let generatedToasts: ToastGroup[] = [];
            if (priceChanged.length > 0) {
              generatedToasts.push({
                id: Date.now(),
                title: `Fiyatı Değişen Ürünler`,
                type: 'price',
                items: priceChanged.map(p => ({
                  category: p.categoryLabel,
                  name: p.name,
                  price: p.price,
                  diff: p.diff
                }))
              });
            }
            
            if (newlyAdded.length > 0) {
              generatedToasts.push({
                id: Date.now() + 1,
                title: `Yeni Eklenen Ürünler`,
                type: 'new',
                items: newlyAdded.map(n => ({
                  category: "Yeni",
                  name: n,
                  price: 0,
                  diff: 0
                }))
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

    return () => {
      clearInterval(interval);
      if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
    };
  }, []);

  const clearNotifications = (e: React.MouseEvent) => {
    e.stopPropagation();
    setToasts([]);
    setIsHovered(false);
  };

  const totalChangesCount = toasts.reduce((acc, toast) => acc + toast.items.length, 0);

  return (
    <>
      <style>{`
        @keyframes ticker { 0% { transform: translateX(100vw); } 100% { transform: translateX(-100%); } }
        .animate-ticker { display: inline-block; white-space: nowrap; animation: ticker 30s linear infinite; }
        .animate-ticker:hover { animation-play-state: paused; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .writing-mode-vertical { writing-mode: vertical-rl; transform: rotate(180deg); }
      `}</style>

      {/* ÜST BORSA ŞERİDİ */}
      {tickerItems.length > 0 && (
        <div className="fixed top-0 left-0 w-full h-8 bg-slate-900 text-white z-[9999] flex items-center border-b border-slate-800 shadow-md print:hidden">
          <div className="bg-blue-600 h-full px-4 flex items-center font-bold text-[10px] tracking-wider uppercase z-10 shrink-0">
            CANLI AKIŞ
          </div>
          <div className="overflow-hidden flex-1 flex items-center h-full">
            <div className="animate-ticker cursor-default">
              {tickerItems.map((item, idx) => (
                <span key={item.id} className="mx-6 font-semibold text-xs tracking-wide">
                  <span className={item.type === 'up' ? 'text-emerald-400' : item.type === 'down' ? 'text-rose-400' : 'text-amber-400'}>
                    {item.text}
                  </span>
                  {idx !== tickerItems.length - 1 && <span className="mx-6 text-slate-700">|</span>}
                </span>
              ))}
            </div>
          </div>
          <button onClick={() => setTickerItems([])} className="bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white transition-colors h-full px-3.5 flex items-center font-bold text-[10px] z-10 shrink-0 border-l border-slate-700 cursor-pointer">
            ✖
          </button>
        </div>
      )}

      {/* SÜZÜLEN PANEL ALANI */}
      {toasts.length > 0 && (
        <div 
          onMouseEnter={handleEnter}
          onMouseLeave={handleLeave}
          className="fixed right-0 top-1/4 z-[9999] flex items-center print:hidden pointer-events-auto"
        >
          
          {/* ULTRA PREMIUM BLUR GLASS PANEL KARTI */}
          <div className={`bg-white/95 backdrop-blur-xl border border-slate-200/90 w-[430px] rounded-l-2xl shadow-[0_25px_60px_-15px_rgba(15,23,42,0.18)] overflow-hidden transition-all duration-500 transform ${
            isHovered 
              ? 'opacity-100 translate-x-0 scale-100 pointer-events-auto' 
              : 'opacity-0 translate-x-6 scale-98 pointer-events-none absolute right-12'
          } ease-[cubic-bezier(0.16,1,0.3,1)]`}>
            
            {/* Üst Kısım: Başlık ve Kapatma Çarpısı */}
            <div className="p-4.5 px-5 flex justify-between items-center border-b border-slate-100 bg-white/40">
              <div className="flex items-center gap-2">
                <h3 className="text-slate-800 font-bold text-[14px] tracking-tight">Son Fiyat Değişiklikleri</h3>
                <span className="bg-rose-50 text-rose-600 text-[10px] font-black px-2 py-0.5 rounded-full">
                  {totalChangesCount} Bildirim
                </span>
              </div>
              <button 
                onClick={() => setIsHovered(false)} 
                className="text-slate-400 hover:text-slate-600 hover:bg-slate-100/80 p-1.5 rounded-xl transition-all cursor-pointer border border-transparent hover:border-slate-200"
                title="Kapat"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Orta Kısım: Finansal Dashboard Listelemesi */}
            <div className="p-4 px-5 max-h-[340px] overflow-y-auto no-scrollbar flex flex-col gap-4 bg-slate-50/30 border-b border-slate-100">
              {toasts.map((toast) => (
                <div key={toast.id} className="flex flex-col gap-2">
                  {toast.items.map((item, i) => (
                    <div key={i} className="flex items-center justify-between p-3.5 bg-white/90 backdrop-blur-md border border-slate-100 rounded-xl shadow-sm hover:border-slate-300/80 hover:shadow-md transition-all duration-200">
                      
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider shrink-0 ${
                          item.category === 'Apple' ? 'bg-slate-900 text-white' :
                          item.category === 'Android' ? 'bg-emerald-600 text-white' :
                          item.category === '2.El' ? 'bg-amber-500 text-white' :
                          item.category === 'Aksesuar' ? 'bg-indigo-600 text-white' :
                          'bg-blue-600 text-white'
                        }`}>
                          {item.category}
                        </span>
                        <p className="text-slate-700 text-xs font-bold truncate max-w-[210px]">{item.name}</p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-xs font-extrabold ${item.diff > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                          {item.diff > 0 ? '↑' : '↓'}
                        </span>
                        <span className="text-slate-900 font-black text-xs tracking-tight">
                          {item.price > 0 ? `${item.price.toLocaleString('tr-TR')} TL` : 'Yeni Ürün'}
                        </span>
                      </div>

                    </div>
                  ))}
                </div>
              ))}
            </div>
            
            {/* Alt Kısım: "Hepsini Temizle" Butonu */}
            <div className="p-3.5 px-5 flex justify-end bg-white/40">
              <button 
                onClick={clearNotifications} 
                className="bg-[#f1f5f9] hover:bg-[#e2e8f0] text-slate-700 font-bold text-xs px-5 py-2.5 rounded-xl transition-all duration-200 cursor-pointer border border-slate-200/30 active:scale-95 shadow-sm"
              >
                Hepsini Temizle
              </button>
            </div>
            
          </div>

          {/* PULSE GLOW DESTEKLİ STANDART DİKEY SEKMELİ BUTON */}
          {!isHovered && (
            <div 
              onClick={() => setIsHovered(true)}
              className="writing-mode-vertical px-3.5 py-8 bg-white/95 backdrop-blur-xl hover:bg-slate-50 text-slate-800 font-bold tracking-widest text-[10px] uppercase cursor-pointer transition-all duration-300 border-l border-t border-b border-slate-200 shadow-2xl flex items-center gap-3 rounded-l-2xl border-r-0 pointer-events-auto group animate-in fade-in slide-in-from-right-4 animate-[pulse_2s_infinite]"
            >
              {totalChangesCount > 0 && (
                <div className="relative flex h-2 w-2 mb-1.5 transform rotate-90">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                </div>
              )}
              FİYAT DEĞİŞTİ
              <span className="mt-1 text-[8px] text-slate-400 group-hover:text-slate-800 transition-colors">◀</span>
            </div>
          )}

        </div>
      )}
    </>
  );
}
