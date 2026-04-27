"use client";

import React, { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

// Tip Tanımlamaları
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
      text: "Merhaba! Cnetmobil akıllı asistanı C-BOT göreve hazır. Sana nasıl yardımcı olabilirim? 😊" 
    }
  ]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // --- ZUMAY (ANA SAYFA) KONTROLÜ ---
  // Botun sadece iç sayfalarda görünmesini sağlar.
  if (pathname === "/" || pathname === "/home" || pathname === "/zumay") {
    return null;
  }

  // Otomatik aşağı kaydırma
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory, isTyping]);

  // --- GELİŞMİŞ CEVAP MOTORU (Tıkanmayı Önleyen AI Mantığı) ---
  const getAIResponse = (input: string) => {
    const msg = input.toLowerCase().trim();
    
    // Selamlaşma
    if (msg.match(/(merhaba|selam|sa|slm|nasılsın|naber|hey)/)) {
      const responses = [
        "Harikayım! Cnetmobil şubeleri tıkır tıkır çalıştıkça ben enerji doluyorum. Sen nasılsın? 😊",
        "Süperim! Bugün şubede işler nasıl gidiyor? Yardımcı olabileceğim bir şey var mı?",
        "Çok iyiyim, teşekkür ederim. Bugün senin için ne yapabilirim?"
      ];
      return responses[Math.floor(Math.random() * responses.length)];
    }

    // Kimlik/Yaş
    if (msg.match(/(kimsin|adın ne|yaş|ne zaman)/)) {
      return "Ben C-BOT! Cnetmobil'in 2003'ten beri gelen tecrübesiyle şubelere destek olan yapay zeka asistanıyım. 😊";
    }

    // Fiyat ve Teknik
    if (msg.match(/(fiyat|liste|kaç para|alım)/)) {
      return "Cihaz alım fiyatları her sabah 10:00'da güncellenir. Güncel listeye 'Fiyat Listeleri' menüsünden ulaşabilirsin.";
    }
    if (msg.match(/(ihtar|kural|yasak)/)) {
      return "Cnetmobil'de güven her şeydir! 18 yaş altı işlem veya kimliksiz alım yapmak ihtar sebebidir. Aman dikkat! ⚠️";
    }

    // Hava Durumu
    if (msg.includes("hava")) {
      return "Şu an terminale odaklandığım için dışarı bakamadım 😊 Ama mobil dünya her zaman hareketli!";
    }

    // Tıkanma Engelleyici (Anlamadığında rastgele cevaplar)
    const fallbacks = [
      "Bunu tam anlayamadım ama Cnetmobil sistemlerinde araştırabilirim. Başka bir detay var mı? 😊",
      "Hımm, ilginç bir nokta! İstersen şube kuralları veya cihaz fiyatları hakkında konuşalım?",
      "Şu an öğrenme aşamasındayım, bu konuyu not alıyorum. Başka nasıl yardımcı olabilirim?",
      "Anladım, üzerinde çalışıyorum! Şimdilik cihaz alım prosedürlerine göz atabiliriz. 😊"
    ];
    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
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
        <div className="fixed bottom-24 right-6 w-[350px] md:w-[420px] h-[600px] bg-white rounded-[2.8rem] shadow-[0_25px_70px_rgba(0,82,212,0.3)] flex flex-col z-[10000] overflow-hidden border border-slate-100 animate-in fade-in zoom-in duration-300">
          
          {/* HEADER (Cnetmobil Mavi & Getmobil Style) */}
          <div className="bg-gradient-to-br from-[#0052D4] to-[#4364F7] p-7 text-white flex flex-col relative shadow-lg">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-md transform rotate-[-2deg]">
                  <span className="text-[#0052D4] font-black text-2xl uppercase">C</span>
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-lg tracking-tight">C-BOT</span>
                    <span className="text-blue-100 font-light text-sm italic">Asistan</span>
                  </div>
                  {/* YANIP SÖNEN YEŞİL IŞIK */}
                  <div className="flex items-center gap-2 mt-1 bg-white/10 px-2 py-0.5 rounded-full w-fit">
                    <div className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-300 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400"></span>
                    </div>
                    <span className="text-[10px] font-bold text-green-100 uppercase tracking-tighter">ÇEVRİMİÇİ</span>
                  </div>
                </div>
              </div>
              <button onClick={() => setIsOpen(false)} className="bg-white/10 hover:bg-white/20 p-2 rounded-full transition-all">
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
            <p className="text-blue-50 text-[13px] mt-4 font-medium italic opacity-90 leading-tight">"Sana nasıl yardımcı olabilirim? 📱"</p>
          </div>
          
          {/* MESAJ ALANI */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-white">
            {chatHistory.map((msg, index) => (
              <div key={index} className={`flex ${msg.sender === 'bot' ? 'justify-start' : 'justify-end'}`}>
                <div className={`px-5 py-3 rounded-[1.6rem] text-[14.5px] max-w-[85%] leading-relaxed shadow-sm ${
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
                <div className="bg-slate-50 px-5 py-3 rounded-full border border-slate-100 flex gap-1.5 shadow-sm">
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
                placeholder="Bir soru sor..."
                className="flex-1 bg-slate-50 border-2 border-blue-50 rounded-2xl px-5 py-3.5 text-sm focus:border-[#0052D4] focus:bg-white outline-none transition-all placeholder:text-slate-400"
              />
              <button type="submit" className="bg-[#0052D4] text-white p-4 rounded-2xl shadow-lg hover:scale-105 active:scale-95 transition-all">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* FLOATING BUTON */}
      <button 
        onClick={() => setIsOpen(!isOpen)} 
        className="fixed bottom-8 right-8 z-[10000] group flex flex-col items-center"
      >
        <div className="bg-[#0052D4] text-white text-[10px] font-black px-3 py-1 rounded-full shadow-lg mb-[-4px] z-10 uppercase border border-white/20">
          C-BOT
        </div>
        <div className="w-16 h-16 rounded-full bg-[#0052D4] shadow-[0_12px_40px_rgba(0,82,212,0.4)] flex items-center justify-center group-hover:scale-110 active:scale-90 transition-all duration-300 relative overflow-hidden">
           <span className="text-white font-black text-2xl relative z-10">C</span>
        </div>
      </button>
    </>
  );
}
