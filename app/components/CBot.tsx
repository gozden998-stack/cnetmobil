"use client";

import React, { useState, useEffect, useRef } from 'react';

// Tip Tanımlamaları ve Bot Verisi (Dokunulmadı)
interface Option { label: string; next: string; }
interface BotStep { message: string; options: Option[]; }
interface Message { sender: 'bot' | 'user'; text: string; options?: Option[]; }

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

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory, isOpen]);

  return (
    <>
      {/* C-BOT Penceresi */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 w-80 md:w-96 h-[500px] bg-white rounded-2xl shadow-2xl flex flex-col z-[9999] overflow-hidden border border-slate-200 transition-all">
          
          {/* HEADER: GETMOBIL TARZI + CNET MAVİSİ + YANIP SÖNEN YEŞİL IŞIK */}
          <div className="bg-[#0052D4] p-4 text-white flex flex-col z-[9999] shadow-lg">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-3">
                {/* Logo Kutusu */}
                <div className="w-9 h-9 bg-white rounded flex items-center justify-center font-bold text-xl text-[#0052D4] shadow-sm">
                  C
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-sm tracking-tight text-white">Cnetmobil</span>
                    <span className="text-white/90 font-medium text-sm">Asistan</span>
                  </div>
                  
                  {/* YANIP SÖNEN DURUM GÖSTERGESİ */}
                  <div className="flex items-center gap-2 mt-1 border border-green-400/30 rounded-full px-2 py-0.5 w-fit bg-green-500/10">
                    <div className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                    </div>
                    <span className="text-green-400 text-[10px] font-bold tracking-widest uppercase animate-pulse">
                      ÇEVRİMİÇİ
                    </span>
                  </div>
                </div>
              </div>

              {/* Sağ Üst İkonlar */}
              <div className="flex items-center gap-1">
                <button className="hover:bg-white/10 p-1.5 rounded-full transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                </button>
                <button onClick={() => setIsOpen(false)} className="hover:bg-white/10 p-1.5 rounded-full transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              </div>
            </div>
            {/* Alt Slogan Metni */}
            <span className="text-white/90 text-[13px] mt-3 pl-12 font-medium">
              Sana nasıl yardımcı olabilirim?
            </span>
          </div>
          
          {/* Mesaj Alanı */}
          <div className="flex-1 overflow-y-auto p-4 bg-slate-50 space-y-3">
            {chatHistory.map((msg, index) => (
              <div key={index} className={`flex flex-col ${msg.sender === 'bot' ? 'items-start' : 'items-end'}`}>
                <div className={`px-4 py-2 rounded-2xl text-[13px] max-w-[90%] shadow-sm ${
                  msg.sender === 'bot' 
                  ? 'bg-white text-slate-800 rounded-tl-none border border-slate-100' 
                  : 'bg-[#0052D4] text-white rounded-tr-none'
                }`}>
                  {msg.text}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>
      )}

      {/* --- KİBAR ROBOT BUTON --- */}
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
        </div>
      </button>
    </>
  );
}
