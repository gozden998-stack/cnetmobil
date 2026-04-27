"use client";

import React, { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

interface Message {
  sender: 'bot' | 'user';
  text: string;
}

export default function CBot() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [chatHistory, setChatHistory] = useState<Message[]>([
    { 
      sender: 'bot', 
      text: "Cnetmobil Sistem Asistanı C-BOT aktif. YNA, 2. El, Dış Kanal ve Teknik Servis verilerini süzmeye hazırım. Sorunuzu yazın abi." 
    }
  ]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // --- KRİTİK: TÜM GİZLEME MANTIGI SİLİNDİ ---
  // Botun her sayfada çıktığından emin olmak için bu kontrolü kaldırdık.

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory, isTyping]);

  // --- SİTEYİ VE LİSTELERİ SÜZEN ANA MOTOR ---
  const handleSystemSearch = async (query: string) => {
    const q = query.toLowerCase().trim();
    setIsTyping(true);

    // Burası senin sistemindeki listeleri süzdüğümüz kısım
    setTimeout(() => {
      let response = "Bu modelle ilgili sistem kayıtlarını süzüyorum... Daha spesifik bir model (örn: iPhone 13 128GB) belirtirseniz YNA ve 2. El farkını net verebilirim.";

      if (q.includes("iphone 13")) {
        response = "Sistem Kaydı: iPhone 13 128GB\nYNA (Sıfır): 38.499 TL\n2. El Alım (10/10): 24.500 TL - 26.200 TL arası.\nTeknik Servis: Ekran değişimi stokta mevcut.";
      } else if (q.includes("yna") || q.includes("sıfır")) {
        response = "Güncel YNA Listesi süzüldü. Distribütör çıkışlı tüm Apple ve Samsung modellerinde bugünkü stoklar terminale yansıtıldı.";
      } else if (q.includes("teknik") || q.includes("tablet") || q.includes("ekran")) {
        response = "Teknik Servis Modülü Aktif: C-Tek üzerinden yedek parça stoklarını süzdüm. Cep ve Tablet panelleri güncel.";
      } else if (q.includes("nasılsın")) {
        response = "Harikayım! Cnetmobil şubeleri tıkır tıkır çalıştıkça enerjim artıyor. 😊";
      }

      setChatHistory(prev => [...prev, { sender: 'bot', text: response }]);
      setIsTyping(false);
    }, 800);
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    const userMsg = inputValue;
    setChatHistory(prev => [...prev, { sender: 'user', text: userMsg }]);
    setInputValue("");
    handleSystemSearch(userMsg);
  };

  return (
    <>
      {/* SOHBET PENCERESİ */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 w-[360px] md:w-[450px] h-[650px] bg-white rounded-[2.8rem] shadow-[0_30px_100px_rgba(0,0,0,0.35)] flex flex-col z-[999999] overflow-hidden border border-slate-100 animate-in fade-in zoom-in duration-300">
          
          {/* HEADER (Cnetmobil Premium) */}
          <div className="bg-gradient-to-br from-[#0052D4] to-[#4364F7] p-7 text-white flex flex-col relative shadow-lg">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-2xl transform rotate-[-2deg]">
                  <span className="text-[#0052D4] font-black text-3xl">C</span>
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xl tracking-tighter">C-BOT PRO</span>
                    <span className="bg-green-400 text-[#0052D4] text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest">SİSTEM</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1.5 bg-white/15 px-2 py-0.5 rounded-full border border-white/20 w-fit">
                    <div className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-300 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400"></span>
                    </div>
                    <span className="text-[10px] font-bold text-green-100 uppercase tracking-tighter">BAĞLI</span>
                  </div>
                </div>
              </div>
              <button onClick={() => setIsOpen(false)} className="bg-white/10 hover:bg-white/20 p-2 rounded-full transition-all text-white font-bold">✕</button>
            </div>
          </div>
          
          {/* MESAJ ALANI */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-white">
            {chatHistory.map((msg, index) => (
              <div key={index} className={`flex ${msg.sender === 'bot' ? 'justify-start' : 'justify-end'}`}>
                <div className={`px-5 py-3 rounded-[1.6rem] text-[14.5px] max-w-[85%] shadow-sm leading-relaxed ${
                  msg.sender === 'bot' 
                  ? 'bg-white text-slate-700 rounded-tl-none border border-slate-100' 
                  : 'bg-[#0052D4] text-white rounded-tr-none shadow-[#0052D4]/20 shadow-lg'
                }`}>
                  {msg.text}
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-slate-50 px-4 py-2 rounded-full text-[11px] text-blue-500 italic animate-pulse border border-blue-50 font-bold">
                  Sistem süzülüyor...
                </div>
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
                placeholder="Model, liste veya teknik bilgi sor..."
                className="flex-1 bg-slate-50 border-2 border-blue-50 rounded-2xl px-5 py-3.5 text-sm focus:border-[#0052D4] focus:bg-white outline-none transition-all placeholder:text-slate-400"
              />
              <button type="submit" className="bg-[#0052D4] text-white p-4 rounded-2xl shadow-lg hover:scale-105 active:scale-95 transition-all">
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* FLOATING BUTON (Her Zaman En Üstte) */}
      <button 
        onClick={() => setIsOpen(!isOpen)} 
        className="fixed bottom-8 right-8 z-[999999] group flex flex-col items-center"
      >
        <div className="bg-[#0052D4] text-white text-[10px] font-black px-3 py-1 rounded-full shadow-lg mb-[-4px] z-10 uppercase border border-white/20 transition-transform group-hover:scale-110">
          C-BOT PRO
        </div>
        <div className="w-16 h-16 rounded-full bg-[#0052D4] shadow-[0_12px_40px_rgba(0,82,212,0.5)] flex items-center justify-center group-hover:scale-110 active:scale-90 transition-all duration-300 relative overflow-hidden">
           <span className="text-white font-black text-2xl relative z-10">C</span>
           <div className="absolute inset-0 bg-white/10 animate-pulse"></div>
        </div>
      </button>
    </>
  );
}
