"use client";

import React, { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

// --- TİP TANIMLAMALARI ---
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
      text: "Selam! Ben C-BOT. Cnetmobil'in 20 yıllık tecrübesiyle buradayım. Şube işlemleri veya cihaz fiyatları hakkında sana nasıl yardımcı olabilirim? 😊" 
    }
  ]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // --- ZUMAY (ANA SAYFA) KONTROLÜ ---
  // Ana sayfada (/) botun gözükmesini engeller. 
  // Eğer ana sayfanın linki farklıysa "/" yerine onu yazabilirsin.
  if (pathname === "/" || pathname === "/home") {
    return null;
  }

  // Otomatik aşağı kaydırma
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, isTyping]);

  // --- AKILLI CEVAP MOTORU (AI Logic) ---
  const getAIResponse = (input: string) => {
    const msg = input.toLowerCase().trim();
    
    if (msg.match(/(merhaba|selam|nasılsın|naber)/)) {
      return "Harikayım! Cnetmobil şubeleri yoğunlaştıkça benim de enerjim artıyor. Sen nasılsın? 😊";
    }
    if (msg.match(/(kimsin|adın ne|yaş)/)) {
      return "Ben C-BOT! 2003'ten beri Cnetmobil ruhuyla çalışan bir yapay zekayım. Şubedeki en iyi çalışma arkadaşınım! 📱";
    }
    if (msg.match(/(fiyat|kaç para|liste)/)) {
      return "Cihaz fiyatları her sabah 10:00'da güncellenir. Paneldeki 'Fiyat Listeleri' kısmından anlık kontrol edebilirsin.";
    }
    if (msg.match(/(hava|yağmur)/)) {
      return "Dışarıya bakamadım ama Cnetmobil'de hava her zaman teknoloji dolu! Başka bir sorun var mı? 😊";
    }
    if (msg.match(/(teşekkür|iyi|tamam|ok)/)) {
      return "Rica ederim! Her zaman buradayım. Başka bir konuda yardıma ihtiyacın olursa yazman yeterli.";
    }

    return "Bunu hemen teknik veri tabanımda inceliyorum... Biraz daha detay verir misin yoksa başka bir konuya mı geçelim? 😊";
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    const userMsg = inputValue;
    setChatHistory(prev => [...prev, { sender: 'user', text: userMsg }]);
    setInputValue("");
    setIsTyping(true);

    setTimeout(() => {
      const response = getAIResponse(userMsg);
      setChatHistory(prev => [...prev, { sender: 'bot', text: response }]);
      setIsTyping(false);
    }, 1200);
  };

  return (
    <>
      {/* SOHBET PENCERESİ */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 w-[350px] md:w-[400px] h-[600px] bg-white rounded-[2.5rem] shadow-[0_20px_60px_rgba(0,82,212,0.25)] flex flex-col z-[9999] overflow-hidden border border-slate-100 animate-in fade-in zoom-in duration-300">
          
          {/* HEADER (Cnetmobil Mavi - Getmobil Style) */}
          <div className="bg-gradient-to-br from-[#0052D4] to-[#4364F7] p-6 text-white flex flex-col relative shadow-lg">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-md transform rotate-[-2deg]">
                  <span className="text-[#0052D4] font-black text-2xl">C</span>
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-lg tracking-tight">C-BOT</span>
                    <span className="text-blue-100 font-light text-sm italic">Asistan</span>
                  </div>
                  {/* YANIP SÖNEN YEŞİL IŞIK */}
                  <div className="flex items-center gap-2 mt-1 bg-white/10 px-2 py-0.5 rounded-full w-fit border border-white/20">
                    <div className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-300 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400"></span>
                    </div>
                    <span className="text-[10px] font-bold text-green-100 uppercase tracking-tighter">ÇEVRİMİÇİ</span>
                  </div>
                </div>
              </div>
              <button onClick={() => setIsOpen(false)} className="bg-white/10 hover:bg-white/20 p-2 rounded-full text-white transition-all">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
            <p className="text-blue-50 text-[13px] mt-4 font-medium opacity-90 leading-tight">"Sana nasıl yardımcı olabilirim? 📱"</p>
          </div>
          
          {/* MESAJ ALANI */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#FDFEFE]">
            {chatHistory.map((msg, index) => (
              <div key={index} className={`flex ${msg.sender === 'bot' ? 'justify-start' : 'justify-end'}`}>
                <div className={`px-5 py-3 rounded-[1.6rem] text-[14px] max-w-[85%] leading-relaxed shadow-sm transition-all ${
                  msg.sender === 'bot' 
                  ? 'bg-white text-slate-700 rounded-tl-none border border-slate-100' 
                  : 'bg-[#0052D4] text-white rounded-tr-none'
                }`}>
                  {msg.text}
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-white px-5 py-3 rounded-full border border-slate-100 flex gap-1.5 shadow-sm">
                  <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce"></div>
                  <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                  <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-delay:0.4s]"></div>
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
                placeholder="Örn: Fiyatlar ne kadar?"
                className="flex-1 bg-slate-50 border-2 border-blue-50 rounded-2xl px-5 py-3.5 text-sm focus:border-[#0052D4] focus:bg-white outline-none transition-all placeholder:text-slate-400"
              />
              <button type="submit" className="bg-[#0052D4] text-white p-4 rounded-2xl shadow-lg shadow-blue-100 hover:scale-105 active:scale-95 transition-all">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* FLOATING BUTON */}
      <button 
        onClick={() => setIsOpen(!isOpen)} 
        className="fixed bottom-8 right-8 z-[9999] group flex flex-col items-center"
      >
        <div className="bg-[#0052D4] text-white text-[10px] font-black px-3 py-1 rounded-full shadow-lg mb-[-4px] z-10 uppercase border border-white/20">
          C-BOT
        </div>
        <div className="w-16 h-16 rounded-full bg-[#0052D4] shadow-[0_12px_40px_rgba(0,82,212,0.4)] flex items-center justify-center group-hover:scale-110 active:scale-90 transition-all duration-300 relative">
           <span className="text-white font-black text-2xl">C</span>
        </div>
      </button>
    </>
  );
}
