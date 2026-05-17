"use client";
import React, { useState, useEffect, useRef } from 'react';

export default function GlobalMarket() {
  const [tickerItems, setTickerItems] = useState<{ id: number, text: string, type: 'up' | 'down' | 'new' }[]>([]);
  const [toasts, setToasts] = useState<{ id: number, title: string, items: string[], type: 'price' | 'new' }[]>([]);
  
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
        let priceChanged: { name: string, diff: number }[] = [];
        let newTickers: { id: number, text: string, type: 'up' | 'down' | 'new' }[] = [];

        const checkCategory = (data: any[][], nameIdx: number, priceIdx: number, prefix: string) => {
          if (!data || !Array.isArray(data)) return;
          data.forEach(row => {
            const name = row[nameIdx]?.toString().trim();
            const price = parsePrice(row[priceIdx]);
            
            if (!name || price === 0) return;

            const key = `${prefix}_${name}`;
            currentMap.set(key, price);

            if (prevPricesMap.current && !isFirstLoad.current) {
              const oldPrice = prevPricesMap.current.get(key);
              
              if (oldPrice === undefined) {
                newlyAdded.push(name);
                newTickers.push({ 
                  id: Date.now() + Math.random(), 
                  text: `🆕 ${name} ${price.toLocaleString('tr-TR')} TL`, 
                  type: 'new' 
                });
              } else if (oldPrice !== price) {
                const diff = price - oldPrice;
                if (diff !== 0) {
                  priceChanged.push({ name, diff });
                  newTickers.push({ 
                    id: Date.now() + Math.random(), 
                    text: `${diff > 0 ? '↑' : '↓'} ${name} ${price.toLocaleString('tr-TR')} TL`, 
                    type: diff > 0 ? 'up' : 'down' 
                  });
                }
              }
            }
          });
        };

        if (allData.CepTablet) {
          checkCategory(allData.CepTablet, 0, 2, 'APPLE');
          checkCategory(allData.CepTablet, 5, 7, 'ANDROID');
          checkCategory(allData.CepTablet, 10, 11, 'KAMPANYA');
        }
        if (allData.IkinciEl) checkCategory(allData.IkinciEl, 0, 2, 'IKINCI_EL');
        if (allData.YNA) {
          checkCategory(allData.YNA, 0, 1, 'YNA1');
          checkCategory(allData.YNA, 3, 4, 'YNA2');
        }

        if (currentMap.size < 10) return; 

        if (!isFirstLoad.current && (newlyAdded.length > 0 || priceChanged.length > 0)) {
          if (priceChanged.length > 10) {
            console.warn("Toplu Excel formül güncellemesi engellendi.");
          } else {
            playDing();
            
            let generatedToasts = [];
            if (priceChanged.length > 0) {
              generatedToasts.push({
                id: Date.now(),
                title: `🔥 ${priceChanged.length} Üründe Fiyat Değişti`,
                items: priceChanged.map(p => `• ${p.name}`),
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

            setToasts(prev => {
              const updatedToasts = [...generatedToasts, ...prev].slice(0, 3);
              updatedToasts.forEach(toast => {
                setTimeout(() => {
                  setToasts(current => current.filter(t => t.id !== toast.id));
                }, 12000);
              });
              return updatedToasts;
            });
            
            // Yeni gelenleri her zaman en başa ekle (Sonsuz döngüyü tazele)
            setTickerItems(prev => [...newTickers, ...prev].slice(0, 20));
          }
        }

        prevPricesMap.current = currentMap;
        isFirstLoad.current = false;

      } catch (error) {}
    };

    fetchMarketData(); 
    const interval = setInterval(fetchMarketData, 60000); 

    return () => clearInterval(interval);
  }, []);

  const removeToast = (id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // Kayan yazıyı manuel temizleme fonksiyonu
  const clearTicker = () => {
    setTickerItems([]);
  };

  return (
    <>
      <style>{`
        @keyframes ticker {
          0% { transform: translateX(100vw); }
          100% { transform: translateX(-100%); }
        }
        .animate-ticker {
          display: inline-block;
          white-space: nowrap;
          animation: ticker 30s linear infinite;
        }
        .animate-ticker:hover { animation-play-state: paused; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>

      {/* TİCKER ALANI */}
      {tickerItems.length > 0 && (
        <div className="fixed top-0 left-0 w-full h-8 bg-slate-950 text-white z-[9999] flex items-center border-b border-slate-800 shadow-lg print:hidden">
          {/* Sol Başlık */}
          <div className="bg-blue-600 h-full px-4 flex items-center font-black text-[10px] tracking-widest uppercase z-10 shadow-xl shrink-0">
            CANLI PİYASA
          </div>
          
          {/* Kayan Yazı */}
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

          {/* 🚀 YENİ: TEMİZLE BUTONU */}
          <button 
            onClick={clearTicker} 
            className="bg-slate-800 hover:bg-rose-600 transition-colors h-full px-4 flex items-center font-bold text-[10px] z-10 shrink-0 border-l border-slate-700 cursor-pointer"
            title="Geçmiş bildirimleri temizle"
          >
            TEMİZLE ✖
          </button>
        </div>
      )}

      {/* TOAST (BİLDİRİM KUTULARI) */}
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col-reverse gap-4 pointer-events-none print:hidden">
        {toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto animate-in slide-in-from-right-8 fade-in duration-500 bg-slate-900/95 backdrop-blur-md border border-slate-700 w-80 rounded-2xl shadow-2xl overflow-hidden group">
            <div className={`h-1.5 w-full ${toast.type === 'price' ? 'bg-gradient-to-r from-orange-500 to-rose-500' : 'bg-gradient-to-r from-blue-500 to-emerald-500'}`}></div>
            <div className="p-5">
              <div className="flex justify-between items-start mb-3">
                <h4 className="text-white font-black italic tracking-tight text-sm">{toast.title}</h4>
                <button onClick={() => removeToast(toast.id)} className="text-slate-400 hover:text-white transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <div className="bg-slate-800/50 rounded-xl p-3 max-h-32 overflow-y-auto no-scrollbar border border-slate-700/50">
                {toast.items.map((item, i) => (
                  <p key={i} className="text-slate-300 text-xs font-bold mb-1 last:mb-0 truncate">{item}</p>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
