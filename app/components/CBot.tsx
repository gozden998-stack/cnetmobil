"use client";

import React, { useState, useEffect, useRef } from 'react';

interface Message {
  sender: 'bot' | 'user';
  text: string;
}

export default function CBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [chatHistory, setChatHistory] = useState<Message[]>([
    { sender: 'bot', text: "Merhaba! Ben C-BOT. Cnetmobil'in 20 yılı aşkın tecrübesiyle buradayım. Şube işlemleri, teknik servis veya cihaz fiyatları hakkında sana nasıl yardımcı olabilirim? 😊" }
  ]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, isTyping]);

  // AKILLI CEVAP MOTORU (Cnetmobil Kişiliği)
  const getAIResponse = (input: string) => {
    const msg = input.toLowerCase();
    
    if (msg.includes("nasılsın")) {
      return "Cnetmobil şubeleri tıkır tıkır çalıştıkça ben çok daha iyi oluyorum! Sen nasılsın, şubede her şey yolunda mı? 😊";
    }
    if (msg.includes("kimsin") || msg.includes("adın ne")) {
      return "Ben C-BOT! Cnetmobil ailesinin dijital asistanıyım. 2003'ten beri gelen tecrübemizle sana teknik destek vermek için buradayım.";
    }
    if (msg.includes("yaş") || msg.includes("kaç yaşındasın")) {
      return "Fiziksel bir yaşım yok ama Cnetmobil ruhuyla 20 yılı aşkın bir tecrübeye sahibim! 📱";
    }
    if (msg.includes("hava")) {
      return "Şu an terminale odaklandığım için dışarı bakamadım maalesef! 😊 Ama mobil dünya her zaman güneşli, teknik konularda yardıma ihtiyacın var mı?";
    }
    if (msg.includes("fiyat")) {
      return "Güncel cihaz alım fiyatları her sabah sistemimize yansıyor. 'Fiyat Listeleri' menüsünden anlık kontrol sağlayabilirsin.";
    }
    if (msg.includes("teşekkür") || msg.includes("çok iyi")) {
      return "Rica ederim! Cnetmobil ailesine hizmet etmek benim işim. Başka bir sorun olursa buradayım. 😊";
    }

    return "Anladım. Cnetmobil sistem kayıtlarını inceliyorum... Bu konuda detaylı bilgi için teknik modülü kontrol edebiliriz veya bana başka bir soru sorabilirsin! 😊";
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
      {isOpen && (
        <div className="fixed bottom-24 right-6 w-85 md:w-[400px] h-[600px] bg-white rounded-[2.5rem] shadow-2xl flex flex-col z-[9999] overflow-hidden border border-slate-100 anim-popup">
          
          {/* HEADER (Cnetmobil Mavi Tonları) */}
          <div className="bg-gradient-to-r from-[#0052D4] to-[#4364F7] p-6 flex flex-col relative">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-4 text-white">
                {/* Marka Logosu */}
                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-lg transform rotate-[-2deg]">
                  <span className="text-[#0052D4] font-black text-2xl">C</span>
                </div>
                <div className="flex flex-col">
                  <span className="font-bold text-lg tracking-tight">C-BOT Asistan</span>
                  <div className="flex items-center gap-1.5">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-300 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400"></span>
                    </span>
                    <span className="text-[10px] font-bold text-green-100 uppercase tracking-widest">Çevrimiçi</span>
                  </div>
                </div>
              </div>
              <button onClick={() => setIsOpen(false)} className="bg-white/10 hover:bg-white/20 p-2 rounded-full text-white transition-all">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
            <p className="text-blue-50 text-xs mt-4 font-medium opacity-90 italic">"Geleceğin mobil teknolojileri, Cnetmobil güvencesiyle."</p>
          </div>
          
          {/* MESAJ ALANI */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/30">
            {chatHistory.map((msg, index) => (
              <div key={index} className={`flex ${msg.sender === 'bot' ? 'justify-start' : 'justify-end'}`}>
                <div className={`px-5 py-3 rounded-[1.5rem] text-[14px] max-w-[85%] leading-relaxed shadow-sm transition-all ${
                  msg.sender === 'bot' 
                  ? 'bg-white text-slate-700 rounded-tl-none border border-blue-50' 
                  : 'bg-[#0052D4] text-white rounded-tr-none'
                }`}>
                  {msg.text}
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-white px-4 py-3 rounded-full border border-blue-50 flex gap-1">
                  <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce"></div>
                  <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                  <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-delay:0.4s]"></div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* INPUT ALANI (Marka Mavi Çerçeveli) */}
          <div className="p-6 bg-white border-t border-slate-100">
            <form onSubmit={handleSendMessage} className="flex gap-2">
              <input 
                type="text" 
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Cnetmobil hakkında bir şey sor..."
                className="flex-1 bg-slate-50 border-2 border-blue-100 rounded-2xl px-5 py-3 text-sm focus:border-[#0052D4] outline-none transition-all placeholder:text-slate-400"
              />
              <button type="submit" className="bg-[#0052D4] text-white p-3.5 rounded-2xl shadow-lg shadow-blue-100 hover:scale-105 active:scale-95 transition-all">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* FLOATING BUTON (Marka Mavi) */}
      <button onClick={() => setIsOpen(!isOpen)} className="fixed bottom-8 right-8 z-[9999] group">
        <div className="w-16 h-16 rounded-full bg-[#0052D4] shadow-[0_10px_30px_rgba(0,82,212,0.4)] flex items-center justify-center group-hover:scale-110 active:scale-90 transition-all duration-300">
           <span className="text-white font-black text-2xl">C</span>
        </div>
      </button>
    </>
  );
}
