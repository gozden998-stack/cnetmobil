"use client";

import React, { useState, useEffect, useRef } from 'react';

// Tip Tanımlamaları
interface Option {
  label: string;
  next: string;
}

interface BotStep {
  message: string;
  options: Option[];
}

interface Message {
  sender: 'bot' | 'user';
  text: string;
  options?: Option[];
}

// C-BOT Menü Ağacı - Sadece senin istediğin mesaj kalacak şekilde korundu
const botData: Record<string, BotStep> = {
  start: {
    message: "İyi eğitimli sohbet botu C-BOT Asistan, yakında hizmetinize sunulacaktır.",
    options: [] 
  }
};

export default function CBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [chatHistory, setChatHistory] = useState<Message[]>([
    { sender: 'bot', text: botData.start.message, options: botData.start.options }
  ]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Otomatik aşağı kaydırma
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory, isOpen]);

  const handleOptionClick = (option: Option) => {
    const userMessage: Message = { sender: 'user', text: option.label };
    const nextStep = botData[option.next];
    
    const botMessage: Message = { 
      sender: 'bot', 
      text: nextStep.message, 
      options: nextStep.options 
    };

    setChatHistory((prev) => [...prev, userMessage, botMessage]);
  };

  return (
    <>
      {/* C-BOT Penceresi */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 w-80 h-[500px] bg-white rounded-2xl shadow-2xl flex flex-col z-[9999] overflow-hidden border border-slate-200 transition-all">
          {/* Header - Getmobil header replikası */}
          <div className="bg-[#121C2B] p-4 text-white flex flex-col z-[9999] shadow-lg rounded-t-2xl">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-3">
                {/* Logo replikası */}
                <div className="w-8 h-8 bg-white rounded flex items-center justify-center font-bold text-lg text-[#121C2B]">
                  C
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm tracking-tight text-white">Cnetmobil</span>
                    <span className="text-white font-normal text-sm">Asistan</span>
                  </div>
                  {/* Çevrimiçi etiketi - Getmobil replikası */}
                  <div className="flex items-center gap-1.5 border border-green-500 rounded-full px-2 py-0.5 mt-1">
                    <div className="w-2.5 h-2.5 bg-green-500 rounded-full"></div>
                    <span className="text-green-500 text-xs font-semibold">Çevrimiçi</span>
                  </div>
                </div>
              </div>
              {/* İkonlar */}
              <div className="flex items-center gap-2">
                {/* Aşağı ok simgesi */}
                <button className="hover:bg-white/10 p-1.5 rounded-full transition-colors text-white/80 hover:text-white">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                </button>
                {/* Kapatma simgesi (X) */}
                <button onClick={() => setIsOpen(false)} className="hover:bg-white/10 p-1.5 rounded-full transition-colors text-white/80 hover:text-white">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              </div>
            </div>
            {/* Alttaki metin */}
            <span className="text-white text-sm mt-3 pl-11">Sana nasıl yardımcı olabilirim?</span>
          </div>
          
          {/* Mesaj Alanı */}
          <div className="flex-1 overflow-y-auto p-3 bg-slate-50 space-y-3">
            {chatHistory.map((msg, index) => (
              <div key={index} className={`flex flex-col ${msg.sender === 'bot' ? 'items-start' : 'items-end'}`}>
                <div className={`px-3 py-2 rounded-xl text-[13px] max-w-[90%] shadow-sm ${
                  msg.sender === 'bot' 
                  ? 'bg-white text-slate-800 rounded-tl-none border border-slate-100' 
                  : 'bg-[#0052D4] text-white rounded-tr-none'
                }`}>
                  {msg.text}
                </div>
                
                {/* Seçenek Butonları (Kullanıcının start mesajı nedeniyle yok ama mantığı koru) */}
                {msg.sender === 'bot' && msg.options && (
                  <div className="mt-2 flex flex-col gap-1.5 w-full max-w-[85%]">
                    {msg.options.map((opt, i) => (
                      <button 
                        key={i} 
                        onClick={() => handleOptionClick(opt)} 
                        className="bg-white border border-[#0052D4]/30 text-[#0052D4] px-3 py-1.5 rounded-lg text-[11px] text-left hover:bg-blue-50 transition-all font-medium shadow-sm active:scale-95"
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>
      )}

      {/* --- KİBAR ROBOT BUTON - Mevcut minimalist tasarım --- */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="cbot-floating-btn fixed bottom-6 right-6 flex flex-col items-center z-[9999] group"
      >
        <div className="bg-[#0052D4] text-white text-[9px] font-bold px-2 py-0.5 rounded-t-md shadow-md mb-[-1px] z-10 uppercase tracking-widest border-x border-t border-white/20 transition-transform group-hover:scale-105">
          C-BOT
        </div>

        <div className="w-12 h-12 rounded-full bg-white border-2 border-[#4364F7] shadow-lg flex items-center justify-center overflow-hidden relative transition-all group-hover:scale-110 group-active:scale-90">
          <svg viewBox="0 0 24 24" fill="none" className="w-8 h-8 text-[#0052D4]" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="10" fill="#F0F7FF"/>
            <rect x="7.5" y="10" width="2" height="2" rx="1" fill="#0052D4"/>
            <rect x="14.5" y="10" width="2" height="2" rx="1" fill="#0052D4"/>
            <path d="M9 15.5C9 15.5 10 17 12 17C14 17 15 15.5 15 15.5" stroke="#0052D4" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
          <div className="absolute bottom-0 w-full h-2 bg-gradient-to-t from-[#0052D4]/5 to-transparent"></div>
        </div>
      </button>
    </>
  );
}
