"use client";

import React, { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

// --- NOT: Burası senin verilerini çekeceğin kısım ---
// Eğer veriler dışarıdan geliyorsa Props olarak alabilirsin.
export default function CBot({ systemData }: { systemData?: any }) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [chatHistory, setChatHistory] = useState<any[]>([
    { 
      sender: 'bot', 
      text: "Cnetmobil Sistem Asistanı hazır. Portal üzerindeki tüm listeleri (YNA, 2. El, Kampanya) anlık süzebilirim. Ne sormak istersin? 😊" 
    }
  ]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Zumay kanalında gizleme
  if (pathname === "/" || pathname === "/zumay") return null;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, isTyping]);

  // --- SİTEYİ SÜZEN ANA MOTOR ---
  const findInSystem = async (query: string) => {
    const q = query.toLowerCase();

    // 1. ADIM: Senin Mevcut API'nden Veri Çekme (Simülasyon)
    // Gerçekte burada: fetch('/api/get-price?q=' + q) gibi bir yapı olacak.
    setIsTyping(true);

    try {
      // ÖRNEK: Senin veritabanında arama yaptığımızı varsayalım
      // Eğer systemData dışarıdan geliyorsa onu süzüyoruz:
      /* const result = systemData.find(item => item.name.toLowerCase().includes(q));
      */

      // Temsili Arama Mantığı (Burayı kendi veri yapına göre bağlamalısın):
      if (q.includes("iphone 13")) {
        return "Sistem Kaydı Bulundu: iPhone 13 128GB\nYNA Fiyatı: Liste üzerinden kontrol ediliyor...\n2. El Alım: Veritabanına göre 24.000 TL - 26.500 TL arası. (C-Tek Modülü Onaylı)";
      }

      if (q.includes("yna") || q.includes("sıfır")) {
        return "YNA Listesi süzüldü: Bugün YNA kanalında %2'lik bir kur güncellemesi var. Tüm sıfır cihazlar günceldir.";
      }

      if (q.includes("servis") || q.includes("ekran")) {
        return "Teknik Servis Modülü süzüldü: Stokta 12 adet iPhone ekranı, 5 adet Tablet paneli mevcut. C-Tek üzerinden sipariş geçebilirsiniz.";
      }

      return "Bu aramanızla ilgili sistemde tam bir eşleşme bulamadım. Lütfen model adını (örn: 'iPhone 11') veya liste adını (örn: 'YNA') tam yazın abi.";

    } catch (error) {
      return "Sistem verilerine şu an ulaşamıyorum, lütfen portaldaki listeleri manuel kontrol et.";
    } finally {
      setIsTyping(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    const userMsg = inputValue;
    setChatHistory(prev => [...prev, { sender: 'user', text: userMsg }]);
    setInputValue("");
    
    const aiMsg = await findInSystem(userMsg);
    setChatHistory(prev => [...prev, { sender: 'bot', text: aiMsg }]);
  };

  return (
    <>
      {isOpen && (
        <div className="fixed bottom-24 right-6 w-[360px] md:w-[450px] h-[650px] bg-white rounded-[2.8rem] shadow-[0_30px_90px_rgba(0,82,212,0.3)] flex flex-col z-[100000] overflow-hidden border border-slate-100 animate-in fade-in zoom-in duration-300">
          
          {/* HEADER - Cnetmobil Premium */}
          <div className="bg-gradient-to-br from-[#0052D4] to-[#4364F7] p-7 text-white flex flex-col relative shadow-lg">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-2xl transform rotate-[-2deg]">
                  <span className="text-[#0052D4] font-black text-3xl">C</span>
                </div>
                <div className="flex flex-col">
                  <span className="font-bold text-xl tracking-tight leading-none">C-BOT PRO</span>
                  <div className="flex items-center gap-2 mt-2 bg-white/10 px-2 py-0.5 rounded-full border border-white/20 w-fit">
                    <div className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-300 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400"></span>
                    </div>
                    <span className="text-[10px] font-bold text-green-100 uppercase tracking-tighter">Sistem Bağlı</span>
                  </div>
                </div>
              </div>
              <button onClick={() => setIsOpen(false)} className="bg-white/10 hover:bg-white/20 p-2 rounded-full text-white">✕</button>
            </div>
          </div>
          
          {/* MESAJ ALANI */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-white">
            {chatHistory.map((msg, index) => (
              <div key={index} className={`flex ${msg.sender === 'bot' ? 'justify-start' : 'justify-end'}`}>
                <div className={`px-5 py-3 rounded-[1.6rem] text-[14.5px] max-w-[85%] leading-relaxed shadow-sm transition-all ${
                  msg.sender === 'bot' 
                  ? 'bg-white text-slate-700 rounded-tl-none border border-slate-100' 
                  : 'bg-[#0052D4] text-white rounded-tr-none'
                }`}>
                  {msg.text}
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="text-xs text-blue-500 animate-pulse ml-2 font-bold italic">
                Portal verileri süzülüyor...
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* INPUT ALANI */}
          <div className="p-6 bg-white border-t border-slate-50">
            <form onSubmit={handleSendMessage} className="flex gap-3">
              <input 
                type="text" 
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Sistemde ara (Model, Liste, Teknik)..."
                className="flex-1 bg-slate-50 border-2 border-blue-50 rounded-2xl px-5 py-3.5 text-sm focus:border-[#0052D4] focus:bg-white outline-none transition-all placeholder:text-slate-400 shadow-inner"
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
        <div className="bg-[#0052D4] text-white text-[10px] font-black px-3 py-1 rounded-full shadow-lg mb-[-4px] z-10 uppercase border border-white/20">C-BOT PRO</div>
        <div className="w-16 h-16 rounded-full bg-[#0052D4] shadow-[0_12px_40px_rgba(0,82,212,0.5)] flex items-center justify-center group-hover:scale-110 active:scale-90 transition-all duration-300">
           <span className="text-white font-black text-2xl relative z-10 font-sans">C</span>
        </div>
      </button>
    </>
  );
}
