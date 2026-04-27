"use client";

import React, { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

// --- PROFESYONEL FİYAT VERİ TABANI ---
// Buradaki rakamları istediğin zaman saniyeler içinde güncelleyebilirsin.
const PRICE_DB: Record<string, any> = {
  "iphone 15": { yna: "54.500 TL", ikinciEl: "38.000 - 41.000 TL", ozellik: "Dinamik Ada ve 48MP Kamera" },
  "iphone 14": { yna: "46.200 TL", ikinciEl: "31.500 - 34.000 TL", ozellik: "Trafik Kazası Algılama" },
  "iphone 13": { yna: "38.500 TL", ikinciEl: "24.500 - 26.500 TL", ozellik: "A15 Bionic İşlemci" },
  "iphone 12": { yna: "31.000 TL", ikinciEl: "18.500 - 20.000 TL", ozellik: "OLED Ekran ve MagSafe" },
  "iphone 11": { yna: "24.500 TL", ikinciEl: "12.500 - 14.500 TL", ozellik: "En çok tercih edilen 2. el" },
  "samsung s23": { yna: "34.000 TL", ikinciEl: "22.000 - 24.500 TL", ozellik: "Snapdragon 8 Gen 2" },
  "samsung s22": { yna: "26.500 TL", ikinciEl: "15.000 - 17.000 TL", ozellik: "Kompakt Amiral Gemisi" },
  "ipad air": { yna: "21.000 TL", ikinciEl: "13.000 - 15.000 TL", ozellik: "M1/M2 İşlemci Seçenekleri" }
};

export default function CBot() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [chatHistory, setChatHistory] = useState<any[]>([
    { sender: 'bot', text: "Cnetmobil Uzman Asistan Hattı aktif. YNA, 2. El, Dış Kanal ve Kampanyalı listelerle ilgili tüm sorularınızı sorabilirsiniz. 📱" }
  ]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // --- ZUMAY KANALINDA GİZLENME MANTISI ---
  if (pathname === "/" || pathname === "/zumay" || pathname === "/home") return null;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, isTyping]);

  // --- PROFESYONEL CEVAP MOTORU ---
  const getProResponse = (input: string) => {
    const msg = input.toLowerCase().trim();

    // 1. CİHAZ VE FİYAT ANALİZİ
    for (const model in PRICE_DB) {
      if (msg.includes(model)) {
        const data = PRICE_DB[model];
        if (msg.includes("yna") || msg.includes("sıfır")) {
          return `${model.toUpperCase()} için güncel YNA (Sıfır) fiyatı ${data.yna}. Stok durumunu dış kanaldan kontrol etmeyi unutma.`;
        }
        if (msg.includes("alım") || msg.includes("ikinci el") || msg.includes("2.el") || msg.includes("fiyat")) {
          return `${model.toUpperCase()} (128GB/Kozmetik 10) alım fiyatımız: ${data.ikinciEl}. Cihazda ${data.ozellik} mevcuttur. Ekspertiz formunu doldurmayı unutma.`;
        }
        return `${model.toUpperCase()} hakkında neyi öğrenmek istersin? YNA fiyatı: ${data.yna} | 2. El Alım: ${data.ikinciEl}`;
      }
    }

    // 2. LİSTE KURALLARI
    if (msg.includes("yna") || msg.includes("sıfır liste")) return "YNA Listesi: Distribütör garantili sıfır cihaz fiyatlarıdır. Günlük kura göre güncellenir.";
    if (msg.includes("dış kanal")) return "Dış Kanal: Trendyol, Hepsiburada ve Pazarama gibi pazaryeri satış fiyatlarımızı içerir.";
    if (msg.includes("kampanya")) return "Kampanyalı Liste: Haftalık stok eritme veya özel gün indirimlerini kapsayan fiyatlardır.";
    if (msg.includes("teknik servis") || msg.includes("tablet") || msg.includes("onarım")) return "Teknik Servis: Cep ve Tablet onarımlarında C-Tek yedek parça sistemini kullanıyoruz. Orijinal parça dışına çıkmıyoruz.";

    // 3. GENEL SOHBET (Garantili AI Tarzı)
    if (msg.match(/(selam|merhaba|nasılsın|naber)/)) return "Harikayım! Cnetmobil şubeleri tıkır tıkır çalıştıkça keyfim yerinde. Listelerle ilgili sorun var mı? 😊";
    if (msg.match(/(kimsin|adın ne|yaş)/)) return "Ben C-BOT PRO! Cnetmobil'in 2003'ten beri gelen tecrübesiyle donatılmış akıllı asistanıyım.";

    // 4. ŞAŞIRMAYAN FALLBACK
    return "Bunu anladım ama sistemdeki hangi listeyle (YNA, 2. El, Kampanya) ilgili olduğunu belirtirsen net fiyat verebilirim abi. 😊";
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;
    const userMsg = inputValue;
    setChatHistory(prev => [...prev, { sender: 'user', text: userMsg }]);
    setInputValue("");
    setIsTyping(true);
    setTimeout(() => {
      setChatHistory(prev => [...prev, { sender: 'bot', text: getProResponse(userMsg) }]);
      setIsTyping(false);
    }, 1000);
  };

  return (
    <>
      {isOpen && (
        <div className="fixed bottom-24 right-6 w-[360px] md:w-[450px] h-[650px] bg-white rounded-[2.8rem] shadow-[0_30px_100px_rgba(0,82,212,0.35)] flex flex-col z-[100000] overflow-hidden border border-slate-100 animate-in fade-in zoom-in duration-300">
          {/* HEADER */}
          <div className="bg-gradient-to-br from-[#0052D4] to-[#4364F7] p-7 text-white flex flex-col relative shadow-xl">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-2xl transform rotate-[-2deg]">
                  <span className="text-[#0052D4] font-black text-3xl">C</span>
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xl tracking-tighter">C-BOT PRO</span>
                    <span className="bg-green-400 text-[#0052D4] text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest">Uzman</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1.5 bg-white/15 px-2 py-0.5 rounded-full border border-white/20">
                    <div className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-300 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400"></span>
                    </div>
                    <span className="text-[10px] font-bold text-green-100 uppercase tracking-tighter">Sistem Çevrimiçi</span>
                  </div>
                </div>
              </div>
              <button onClick={() => setIsOpen(false)} className="bg-white/10 hover:bg-white/20 p-2 rounded-full text-white transition-all">✕</button>
            </div>
          </div>
          
          {/* CHAT ALANI */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-white">
            {chatHistory.map((msg, index) => (
              <div key={index} className={`flex ${msg.sender === 'bot' ? 'justify-start' : 'justify-end'}`}>
                <div className={`px-5 py-3 rounded-[1.6rem] text-[14.5px] max-w-[85%] leading-relaxed shadow-sm ${
                  msg.sender === 'bot' ? 'bg-white text-slate-700 rounded-tl-none border border-slate-100' : 'bg-[#0052D4] text-white rounded-tr-none'
                }`}>
                  {msg.text}
                </div>
              </div>
            ))}
            {isTyping && <div className="text-xs text-blue-400 italic animate-pulse ml-2">Veriler taranıyor...</div>}
            <div ref={messagesEndRef} />
          </div>

          {/* INPUT ALANI */}
          <div className="p-6 bg-white border-t border-slate-50">
            <form onSubmit={handleSendMessage} className="flex gap-3">
              <input 
                type="text" 
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Örn: iPhone 13 sıfır fiyatı..."
                className="flex-1 bg-slate-50 border-2 border-blue-50 rounded-2xl px-5 py-3.5 text-sm focus:border-[#0052D4] focus:bg-white outline-none transition-all placeholder:text-slate-400"
              />
              <button type="submit" className="bg-[#0052D4] text-white p-4 rounded-2xl shadow-lg hover:scale-105 active:scale-95 transition-all">
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* FLOATING BUTON */}
      <button onClick={() => setIsOpen(!isOpen)} className="fixed bottom-8 right-8 z-[100000] group flex flex-col items-center">
        <div className="bg-[#0052D4] text-white text-[10px] font-black px-3 py-1 rounded-full shadow-lg mb-[-4px] z-10 uppercase border border-white/20 transition-transform group-hover:scale-110">C-BOT PRO</div>
        <div className="w-16 h-16 rounded-full bg-[#0052D4] shadow-[0_12px_40px_rgba(0,82,212,0.5)] flex items-center justify-center group-hover:scale-110 active:scale-90 transition-all duration-300">
           <span className="text-white font-black text-2xl relative z-10">C</span>
        </div>
      </button>
    </>
  );
}
