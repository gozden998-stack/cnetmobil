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
        let priceChanged: { name: string, diff: number, price: number }[] = [];
        let newTickers: { id: number, text: string, type: 'up' | 'down' | 'new' }[] = [];

        // 🚀 TÜM SÜTUNLARI EKSİKSİZ TARAYAN YENİ MOTOR
        // 1. CEP TABLET (APPLE, ANDROID, KAMPANYA)
        if (allData.CepTablet && Array.isArray(allData.CepTablet)) {
          allData.CepTablet.forEach(row => {
            // Apple Tarama (İki fiyat sütununu da denetle: row[1] ve row[2])
            const appleName = row[0]?.toString().trim();
            if (appleName) {
              const p1 = parsePrice(row[1]);
              const p2 = parsePrice(row[2]);
              if (p1 > 0) currentMap.set(`APPLE_${appleName}_v1`, p1);
              if (p2 > 0) currentMap.set(`APPLE_${appleName}_v2`, p2);
            }
            // Android Tarama (İki fiyat sütununu da denetle: row[6] and row[7])
            const androidName = row[5]?.toString().trim();
            if (androidName) {
              const p1 = parsePrice(row[6]);
              const p2 = parsePrice(row[7]);
              if (p1 > 0) currentMap.set(`ANDROID_${androidName}_v1`, p1);
              if (p2 > 0) currentMap.set(`ANDROID_${androidName}_v2`, p2);
            }
            // Kampanya Sıfır Tarama
            const kampanyaName = row[10]?.toString().trim();
            const kampanyaPrice = parsePrice(row[11]);
            if (kampanyaName && kampanyaPrice > 0) {
              currentMap.set(`KAMPANYA_${kampanyaName}`, kampanyaPrice);
            }
          });
        }

        // 2. İKİNCİ EL LİSTESİ
        if (allData.IkinciEl && Array.isArray(allData.IkinciEl)) {
          allData.IkinciEl.forEach(row => {
            const name = `${row[0] || ''} ${row[1] || ''}`.trim();
            const price = parsePrice(row[2]);
            if (name && price > 0) currentMap.set(`IKINCI_${name}`, price);
          });
        }

        // 3. YNA AKSESUAR LİSTESİ
        if (allData.YNA && Array.isArray(allData.YNA)) {
          allData.YNA.forEach(row => {
            const n1 = row[0]?.toString().trim();
            const p1 = parsePrice(row[1]);
            if (n1 && p1 > 0) currentMap.set(`YNA1_${n1}`, p1);

            const n2 = row[3]?.toString().trim();
            const p2 = parsePrice(row[4]);
            if (n2 && p2 > 0) currentMap.set(`YNA2_${n2}`, p2);
          });
        }

        // Veri tabanında ürün yüklüyse kıyaslamaya başla
        if (prevPricesMap.current && !isFirstLoad.current) {
          
          // DEĞİŞEN FİYATLARI BUL
          prevPricesMap.current.forEach((oldPrice, key) => {
            const currentPrice = currentMap.get(key);
            if (currentPrice !== undefined && oldPrice !== currentPrice) {
              
              // Temiz model adını ayıkla
              let cleanName = key
                .replace('APPLE_', '').replace('ANDROID_', '').replace('KAMPANYA_', '')
                .replace('IKINCI_', '').replace('YNA1_', '').replace('YNA2_', '')
                .replace('_v1', '').replace('_v2', '');

              if (!priceChanged.some(p => p.name === cleanName)) {
                const diff = currentPrice - oldPrice;
                priceChanged.push({ name: cleanName, diff, price: currentPrice });
                newTickers.push({
                  id: Date.now() + Math.random(),
                  text: `${diff > 0 ? '↑' : '↓'} ${cleanName} ${currentPrice.toLocaleString('tr-TR')} TL`,
                  type: diff > 0 ? 'up' : 'down'
                });
              }
            }
          });

          // YENİ EKLENENLERİ BUL
          currentMap.forEach((currentPrice, key) => {
            if (!prevPricesMap.current!.has(key)) {
              let cleanName = key
                .replace('APPLE_', '').replace('ANDROID_', '').replace('KAMPANYA_', '')
                .replace('IKINCI_', '').replace('YNA1_', '').replace('YNA2_', '')
                .replace('_v1', '').replace('_v2', '');

              if (!newlyAdded.includes(cleanName)) {
                newlyAdded.push(cleanName);
                newTickers.push({
                  id: Date.now() + Math.random(),
                  text: `🆕 ${cleanName} ${currentPrice.toLocaleString('tr-TR')} TL`,
                  type: 'new'
                });
              }
            }
          });

          // BİLDİRİMLERİ TETİKLE (Spam Koruması: Aynı anda 10'dan fazla değilse)
          if ((newlyAdded.length > 0 || priceChanged.length > 0) && priceChanged.length <= 10) {
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
            
            setTickerItems(prev => [...newTickers, ...prev].slice(0, 20));
          }
        }

        // 🚀 KİLİT DÜZELTMESİ: Liste boş değilse ilk yükleme kilidini her halükarda kaldır
        prevPricesMap.current = currentMap;
        if (currentMap.size > 0) {
          isFirstLoad.current = false;
        }

      } catch (error) {}
    };

    fetchMarketData(); 
    const interval = setInterval(fetchMarketData, 30000); // Hızlı test için 30 saniyeye düşürüldü

    return () => clearInterval(interval);
  }, []);

  const removeToast = (id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
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
