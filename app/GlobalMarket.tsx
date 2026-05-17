"use client";
import React, { useState, useEffect, useRef } from 'react';

interface ToastGroup {
  id: number;
  title: string;
  items: string[];
}

export default function GlobalMarket() {
  const [toasts, setToasts] = useState<ToastGroup[]>([]);
  const [isOpen, setIsOpen] = useState<boolean>(false); // Açık/Kapalı Kontrolü
  
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

        // MODEL BAZLI ANALİZ MOTORU
        if (prevPricesMap.current && !isFirstLoad.current) {
          let notificationItems: string[] = [];

          currentMap.forEach((price, key) => {
            const oldPrice = prevPricesMap.current!.get(key);
            
            let cleanName = key
              .replace(/^(APPLE_|ANDROID_|KAMPANYA_|IKINCI_|YNA1_|YNA2_)/, '')
              .replace(/_v[12]$/, '');

            let categoryLabel = "Cihaz";
            if (key.startsWith("APPLE_")) categoryLabel = "Apple";
            else if (key.startsWith("ANDROID_")) categoryLabel = "Android";
            else if (key.startsWith("KAMPANYA_")) categoryLabel = "Kampanya";
            else if (key.startsWith("IKINCI_")) categoryLabel = "2.El";
            else if (key.startsWith("YNA")) categoryLabel = "Aksesuar";

            if (oldPrice === undefined) {
              const msg = `Yeni Ürün Eklendi: ${cleanName}`;
              if (!notificationItems.includes(msg)) {
                notificationItems.push(msg);
              }
            } else if (oldPrice !== price) {
              const diff = price - oldPrice;
              if (diff > 0) {
                const msg = `${categoryLabel} Fiyatı Yükseldi: ${cleanName}`;
                if (!notificationItems.includes(msg)) notificationItems.push(msg);
              } else if (diff < 0) {
                const msg = `${categoryLabel} Fiyatı Düştü: ${cleanName}`;
                if (!notificationItems.includes(msg)) notificationItems.push(msg);
              }
            }
          });

          if (notificationItems.length > 0 && notificationItems.length <= 10) {
            playDing();
            
            setToasts(prev => [{
              id: Date.now(),
              title: `Fiyat & Ürün Güncellemesi`,
              items: notificationItems
            }, ...prev].slice(0, 5));
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

  const totalChangesCount = toasts.reduce((acc, toast) => acc + toast.items.length, 0);

  return (
    <>
      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .writing-mode-vertical { writing-mode: vertical-rl; transform: rotate(180deg); }
      `}</style>

      {/* SIRALI VE AKICI ANİMASYONLU BİLDİRİM SİSTEMİ */}
      {toasts.length > 0 && (
        <div className="fixed right-0 top-1/4 z-[9999] print:hidden">
          
          {/* A. PREMIUM BEYAZ POPUP PANEL KARTI */}
          <div className={`bg-white/95 backdrop-blur-xl border border-slate-200/90 w-[420px] rounded-2xl shadow-[0_25px_60px_-15px_rgba(15,23,42,0.15)] overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] fixed right-4 top-1/4 ${
            isOpen 
              ? 'opacity-100 translate-x-0 pointer-events-auto' 
              : 'opacity-0 translate-x-full pointer-events-none'
          }`}>
            
            {/* Üst Kısım: Başlık ve Kapatma Çarpısı */}
            <div className="p-4.5 px-5 flex justify-between items-center border-b border-slate-100">
              <div className="flex items-center gap-2">
                <h3 className="text-slate-900 font-bold text-[14px] tracking-tight">Bildirimler</h3>
                <span className="bg-blue-50 text-blue-600 text-[10px] font-black px-2 py-0.5 rounded-full">
                  {totalChangesCount} Bildirim
                </span>
              </div>
              <button 
                onClick={() => setIsOpen(false)} 
                className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1.5 rounded-xl transition-all cursor-pointer"
                title="Kapat"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Orta Kısım: Sadece Model İsmi ve Yön Belirten Temiz Satırlar */}
            <div className="p-4 px-5 max-h-[320px] overflow-y-auto no-scrollbar flex flex-col gap-2.5 bg-slate-50/40">
              {toasts.map((toast) => (
                <div key={toast.id} className="flex flex-col gap-2">
                  {toast.items.map((message, i) => (
                    <div key={i} className="p-3.5 bg-white border border-slate-100 rounded-xl shadow-sm text-slate-800 text-xs font-bold leading-relaxed flex items-center justify-between">
                      <span>{message}</span>
                      {message.includes("Yükseldi") && <span className="text-emerald-500 font-black text-sm shrink-0 ml-2">↑</span>}
                      {message.includes("Düştü") && <span className="text-rose-500 font-black text-sm shrink-0 ml-2">↓</span>}
                      {message.includes("Eklendi") && <span className="text-blue-500 font-black text-xs shrink-0 ml-2">🆕</span>}
                    </div>
                  ))}
                </div>
              ))}
            </div>
            
            {/* Alt Kısım: Soft Gri "Temizle" Tuşu */}
            <div className="p-3.5 px-5 flex justify-end border-t border-slate-100 bg-white">
              <button 
                onClick={clearNotifications} 
                className="bg-[#f1f5f9] hover:bg-[#e2e8f0] text-slate-700 font-bold text-xs px-5 py-2.5 rounded-xl transition-all duration-200 cursor-pointer shadow-sm active:scale-95"
              >
                Hepsini Temizle
              </button>
            </div>
          </div>

          {/* B. SİZİN İSTEDİĞİNİZ ULTRA MİNİMAL AÇIK MAVİ DİKEY SEKME */}
          <div 
            onClick={() => setIsOpen(true)} 
            className={`fixed right-0 top-1/4 bg-[#4da3ff] hover:bg-[#3ca0ff] text-white px-2 py-7 rounded-l-xl shadow-2xl flex flex-col items-center gap-3 cursor-pointer select-none border border-[#4da3ff] border-r-0 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] transform ${
              isOpen 
                ? 'translate-x-full opacity-0 pointer-events-none' 
                : 'translate-x-0 opacity-100 pointer-events-auto'
            }`}
          >
            {/* Mavi Yanıp Sönen Canlı Yayın Pulse Efekti */}
            {totalChangesCount > 0 && (
              <div className="relative flex h-2 w-2 mb-0.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-300 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-700"></span>
              </div>
            )}
            
            <div 
              className="writing-mode-vertical font-black tracking-widest text-[9px] text-white/95" 
              style={{ transform: 'rotate(180deg)' }}
            >
              FİYAT DEĞİŞTİ
            </div>
            
            <span className="text-[7px] text-white/80 font-bold">◀</span>
          </div>

        </div>
      )}
    </>
  );
}
