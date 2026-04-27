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
      text: "Selam! Ben Cnetmobil'in akıllı asistanı C-BOT. Şubelerimizdeki işleyişi hızlandırmak için buradayım. Bana her şeyi sorabilirsin! 😊" 
    }
  ]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // --- KRİTİK NOT: ŞU AN GİZLEME KAPALI ---
  // Bot her sayfada görünecek. Eğer Zumay'da gizlemek istersen 
  // alttaki satırın başındaki // işaretini kaldırabilirsin.
  // if (pathname === "/" || pathname === "/home") return null;

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory, isTyping]);

  // AKILLI CEVAP MOTORU
  const getAIResponse = (input: string) => {
    const msg = input.toLowerCase().trim();
    
    if (msg.match(/(merhaba|selam|sa|slm|hey|naber|nasılsın)/)) {
      const answers = [
        "Harikayım! Cnetmobil şubeleri tıkır tıkır çalıştıkça ben daha çok enerji doluyorum. Sen nasılsın? 😊",
        "Süperim! Bugün terminalde işler yoğun mu? Yardımcı olabileceğim bir şey var mı?",
        "Çok iyiyim, şubelerimize destek vermek beni mutlu ediyor. Senin günün nasıl geçiyor?"
      ];
      return answers[Math.floor(Math.random() * answers.length)];
    }

    if (msg.match(/(kimsin|adın ne|necisin|kim yaptı)/)) {
      return "Ben C-BOT! Cnetmobil ailesinin dijital üyesiyim. 2003'ten beri gelen tecrübeyle şubelere teknik destek sağlıyorum. 📱";
    }

    if (msg.match(/(fiyat|liste|kaç para|alım)/)) {
      return "Cihaz alım fiyatları her sabah merkezden güncellenir. En doğru rakamlar için paneldeki 'Fiyat Listeleri'ne bakmalısın.";
    }

    const randomFallbacks = [
      "Bunu tam olarak anlayamadım ama Cnetmobil prosedürlerimizde bu konuyu araştırabilirim. Başka bir detay var mı? 😊",
      "Hımm, ilginç bir nokta! İstersen cihaz fiyatları veya şube kuralları hakkında konuşalım?",
      "C-BOT olarak her gün yeni şeyler öğreniyorum. Bu sorunu teknik servis modülünde incelememi ister misin?",
      "Anladım, üzerinde çalışıyorum! Ama şimdilik istersen güncel cihaz alım prosedürlerine göz atabiliriz. 😊"
    ];
    
    return randomFallbacks[Math.floor(Math.random() * randomFallbacks.length)];
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
        <div className="fixed bottom-24 right-6 w-[350px] md:w-[420px] h-[620px] bg-white rounded-[2.8rem] shadow-[0_20px_80px_rgba(0,0,0,0.3)] flex flex-col z-[99999] overflow-hidden border border-slate-100 animate-in fade-in zoom-in duration-300">
          
          {/* HEADER (Cnetmobil Mavi) */}
          <div className="bg-gradient-to-br from-[#0052D4] to-[#4364F7] p-7 text-white flex flex-col relative shadow-lg">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-md transform rotate-[-2deg]">
                  <span className="text-[#0052D4] font-black text-2xl uppercase leading-none">C</span>
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-lg tracking-tight">C-BOT</span>
                    <span className="text-blue-100 font-light text-sm italic">AI Asistan</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 bg-white/10 w-fit px-2 py-0.5 rounded-full">
                    <div className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-300 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400"></span>
                    </div>
                    <span className="text-[10px] font-bold text-green-100 uppercase tracking-tighter">ÇEVRİMİÇİ</span>
                  </div>
                </div>
              </div>
              <button onClick={() => setIsOpen(false)} className="bg-white/10 hover:bg-white/20 p-2 rounded-full transition-all text-white font-bold">✕</button>
            </div>
            <p className="text-blue-50 text-[13px] mt-4 font-medium opacity-90 leading-tight italic">"Sana nasıl yardımcı olabilirim? 📱"</p>
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
        className="fixed bottom-8 right-8 z-[99999] group flex flex-col items-center"
      >
        <div className="bg-[#0052D4] text-white text-[10px] font-black px-3 py-1 rounded-full shadow-lg mb-[-4px] z-10 uppercase border border-white/20 transition-transform group-hover:scale-110">
          C-BOT
        </div>
        <div className="w-16 h-16 rounded-full bg-[#0052D4] shadow-[0_12px_40px_rgba(0,82,212,0.5)] flex items-center justify-center group-hover:scale-110 active:scale-90 transition-all duration-300 relative overflow-hidden">
           <span className="text-white font-black text-2xl relative z-10">C</span>
        </div>
      </button>
    </>
  );
}
