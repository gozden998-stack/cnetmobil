"use client";
import React, { useState, useEffect, useRef } from 'react';

interface PriceItem {
  category: string;
  name: string;
  type: 'up' | 'down' | 'new';
  time: string; // 🚀 Her bildirim geldiği anın dakikasını kendi içinde kilitler
}

export default function GlobalMarket() {
  const [notifications, setNotifications] = useState<PriceItem[]>([]);
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
        let newItemsDetected: PriceItem[] = [];
        
        // 🚀 Verinin ekrana ulaştığı TAM ANIN saat ve dakikasını yakala
        const currentTime = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

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

        // 2. İKİNCİ EL VERİLERİNİ TOPLA
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

        // ANLIK DOĞRULAMA VE ZAMAN DAMGALI KAYIT MOTORU
        if (prevPricesMap.current && !isFirstLoad.current) {
          currentMap.forEach((price, key) => {
            const oldPrice = prevPricesMap.current!.get(key);
            
            let cleanName = key
              .replace(/^(APPLE_|ANDROID_|KAMPANYA_|IKINCI_|YNA1_|YNA2_)/, '')
              .replace(/_v[12]$/, '');

            let categoryLabel = "Cihaz";
            if (key.startsWith("APPLE_")) categoryLabel = "Apple";
            else if (key.startsWith("ANDROID_")) categoryLabel = "Android";
            else if (key.startsWith("KAMPANYA_")) categoryLabel = "Kampanya Ürünü";
            else if (key.startsWith("IKINCI_")) categoryLabel = "2.El";
            else if (key.startsWith("YNA")) categoryLabel = "Aksesuar";

            if (oldPrice === undefined) {
              newItemsDetected.push({
                category: categoryLabel,
                name: cleanName,
                type: 'new',
                time: currentTime // Olayın gerçekleştiği tam dakika mühürleniyor
              });
            } else if (oldPrice !== price) {
              const diff = price - oldPrice;
              if (diff > 0) {
                newItemsDetected.push({
                  category: categoryLabel,
                  name: cleanName,
                  type: 'up',
                  time: currentTime // Olayın gerçekleştiği tam dakika mühürleniyor
                });
              } else if (diff < 0) {
                newItemsDetected.push({
                  category: categoryLabel,
                  name: cleanName,
                  type: 'down',
                  time: currentTime // Olayın gerçekleştiği tam dakika mühürleniyor
                });
              }
            }
          });

          if (newItemsDetected.length > 0 && newItemsDetected.length <= 10) {
            playDing();
            
            setNotifications(prev => {
              // Mükerrer kayıtları temizle
              const filtered = prev.filter(p => !newItemsDetected.some(n => n.name === p.name));
              // 🚀 YENİ gelenler EN ÜSTE ekleniyor, ESKİ gelenler zaman damgalarıyla aşağıda kalıyor
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
    const baseStyle = "w-5 h-5 text-white/90";
    if (category === "Apple") {
      return (
        <svg className={baseStyle} viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 4.17c.66-.81 1.11-1.93.99-3.06-.96.04-2.13.64-2.82 1.45-.6.7-1.13 1.84-1.01 2.95 1.07.08 2.18-.53 2.84-1.34z"/>
        </svg>
      );
    }
    if (category === "Android") {
      return (
        <svg className={baseStyle} viewBox="0 0 24 24" fill="currentColor">
          <path d="M7 11h2v2H7zm8 0h2v2h-2zm-4-4h2v2h-2zm0 8h2v2h-2zm-6-2.3c0-2 .6-3.8 1.7-5.3l-1.3-1.3 1.4-1.4 1.6 1.6C10 3.1 11.5 2.5 13 2.5s3 .6 4.3 1.8l1.6-1.6 1.4 1.4-1.3 1.3c1.1 1.5 1.7 3.3 1.7 5.3H5zm8-6.2c-4.1 0-7.5 3.4-7.5 7.5h15c0-4.1-3.4-7.5-7.5-7.5z"/>
        </svg>
      );
    }
    if (category === "2.El") {
      return <span className="text-[10px] font-black text-amber-500 tracking-tighter">2.EL</span>;
    }
    if (category === "Aksesuar") {
      return (
        <svg className={baseStyle} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M3 14c0-4.97 4.03-9 9-9s9 4.03 9 9M6 14h3v5H6zm9 0h3v5h-3z" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      );
    }
    return (
      <svg className={baseStyle} viewBox="0 0 24 24" fill="currentColor">
        <path d="M21.41 11.58l-9-9C12.05 2.22 11.55 2 11 2H4c-1.1 0-2 .9-2 2v7c0 .55.22 1.05.59 1.42l9 9c.36.36.86.58 1.41.58.55 0 1.05-.22 1.41-.59l7-7c.37-.36.59-.86.59-1.41 0-.55-.23-1.06-.59-1.42zM5.5 7C4.67 7 4 6.33 4 5.5S4.67 4 5.5 4 7 4.67 7 5.5 6.33 7 5.5 7z"/>
      </svg>
    );
  };

  return (
    <>
      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .writing-mode-vertical { writing-mode: vertical-rl; transform: rotate(180deg); }
        
        @keyframes dynamic-pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.04); opacity: 0.93; }
        }
        .animate-handle-pulse { animation: dynamic-pulse 2s infinite ease-in-out; }
      `}</style>

      {/* ANİMASYONLU PANEL SİSTEMİ */}
      {notifications.length > 0 && (
        <div className="fixed right-0 top-1/4 z-[9999] print:hidden flex items-center select-none font-sans">
          
          {/* A. TAM İSTEDİĞİNİZ KOYU MOD PANEL KARTI */}
          <div className={`bg-[#0b1224] border border-[#16223f] w-[430px] rounded-2xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7)] overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] fixed right-4 top-1/4 ${
            isOpen 
              ? 'opacity-100 translate-x-0 pointer-events-auto' 
              : 'opacity-0 translate-x-full pointer-events-none'
          }`}>
            
            {/* Üst Kısım: Başlık ve Sayaç */}
            <div className="p-5 flex justify-between items-center border-b border-[#16223f] bg-[#0b1224]">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-full bg-blue-600/10 border border-blue-500/20 text-blue-400">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a3 3 0 11-5.714 0" />
                  </svg>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-white font-bold text-[15px] tracking-tight">Bildirimler</h3>
                    <span className="bg-[#13284f] text-[#3b82f6] text-[11px] font-bold px-2.5 py-0.5 rounded-full border border-blue-500/10">
                      {notifications.length} Bildirim
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400/80 font-medium mt-0.5">Son fiyat ve ürün güncellemeleri</p>
                </div>
              </div>
              
              <button 
                onClick={() => setIsOpen(false)} 
                className="text-slate-400 hover:text-white hover:bg-[#1a2647] p-2 rounded-xl transition-all cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Orta Kısım: Satırlar ve Zaman Damgaları */}
            <div className="p-4 max-h-[380px] overflow-y-auto no-scrollbar flex flex-col gap-2.5 bg-[#070c1a]">
              {notifications.map((item, idx) => (
                <div 
                  key={idx} 
                  className="flex items-center justify-between p-3.5 bg-[#0f1932]/90 border border-[#1d2d54]/60 rounded-xl hover:border-blue-500/30 transition-all duration-200 shadow-sm"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 bg-[#172445] rounded-xl flex items-center justify-center border border-[#253766] shrink-0">
                      {renderCategoryIcon(item.category)}
                    </div>
                    
                    <div className="flex flex-col gap-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {item.type === 'up' && (
                          <span className="text-[9px] font-black px-1.5 py-0.5 bg-[#064e3b] text-[#10b981] rounded uppercase tracking-wider">
                            YÜKSELDİ
                          </span>
                        )}
                        {item.type === 'down' && (
                          <span className="text-[9px] font-black px-1.5 py-0.5 bg-[#7f1d1d] text-[#ef4444] rounded uppercase tracking-wider">
                            DÜŞTÜ
                          </span>
                        )}
                        {item.type === 'new' && (
                          <span className="text-[9px] font-black px-1.5 py-0.5 bg-[#1e3a8a] text-[#3b82f6] rounded uppercase tracking-wider">
                            YENİ
                          </span>
                        )}
                        <span className="text-[12px] font-bold text-white/90 truncate max-w-[190px]">{item.category}</span>
                      </div>
                      
                      <p className="text-[11px] text-slate-400 font-semibold truncate max-w-[250px]">
                        {item.type === 'new' ? `Yeni Ürün Eklendi: ${item.name}` : `Fiyatı ${item.type === 'up' ? 'Yükseldi' : 'Düştü'}: ${item.name}`}
                      </p>
                    </div>
                  </div>

                  {/* ⏱️ SAAT BURADA: Her satır kendi geliş saatini milimetrik korur */}
                  <div className="flex flex-col items-end gap-2 shrink-0 pl-1">
                    <span className="text-[10px] text-slate-500 font-bold">{item.time}</span>
                    <span className={`w-2 h-2 rounded-full shadow-sm ${
                      item.type === 'up' ? 'bg-[#10b981]' : item.type === 'down' ? 'bg-[#ef4444]' : 'bg-[#3b82f6]'
                    }`} />
                  </div>

                </div>
              ))}
            </div>
            
            {/* Alt Kısım: Dalga Efektli Canlı Durumu ve Temizle Butonu */}
            <div className="p-4 px-5 flex justify-between items-center border-t border-[#16223f] bg-[#0b1224]">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-[11px] text-slate-400 font-bold">Canlı güncellenir</span>
              </div>
              
              <button 
                onClick={clearNotifications} 
                className="bg-transparent hover:bg-[#16223f] text-slate-300 hover:text-white border border-[#1d2d54] font-bold text-xs px-4 py-2.5 rounded-xl transition-all duration-200 cursor-pointer shadow-sm active:scale-95 flex items-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Hepsini Temizle
              </button>
            </div>
          </div>

          {/* B. GÖRSELDEKİ GEÇİŞLİ MAVİ DİKEY SEKME BUTONU */}
          <div 
            onClick={() => setIsOpen(true)} 
            className={`fixed right-0 top-1/4 bg-gradient-to-b from-[#1e62d0] to-[#0a3a9c] hover:from-[#256ee6] hover:to-[#0c44b5] text-white px-3.5 py-7 rounded-l-2xl shadow-[0_15px_40px_rgba(10,58,156,0.5)] flex flex-col items-center gap-4.5 cursor-pointer select-none border border-blue-500/30 border-r-0 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] transform ${
              isOpen 
                ? 'translate-x-full opacity-0 pointer-events-none' 
                : 'translate-x-0 opacity-100 pointer-events-auto animate-handle-pulse'
            }`}
          >
            {/* Kırmızı Bildirim Sayı Balonu */}
            <div className="relative flex h-5 w-5 rounded-full bg-[#ef4444] text-white text-[10px] font-black items-center justify-center border border-white/20 shadow-md transform rotate-90">
              {notifications.length}
            </div>
            
            <div 
              className="writing-mode-vertical font-black tracking-widest text-[10px] text-white/95 text-center leading-none" 
              style={{ transform: 'rotate(180deg)' }}
            >
              FİYAT DEĞİŞTİ
            </div>
            
            <span className="text-[8px] text-white/70 font-black leading-none">◀</span>
          </div>

        </div>
      )}
    </>
  );
}
