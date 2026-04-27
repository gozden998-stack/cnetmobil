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

// C-BOT Menü Ağacı (Dokunulmadı)
const botData: Record<string, BotStep> = {
  start: {
    message: "Merhaba! Cnetmobil asistanı C-BOT'a hoş geldiniz. Size nasıl yardımcı olabilirim?",
    options: [
      { label: "📱 Cihaz Alım Fiyatları", next: "cihazAlim" },
      { label: "📋 Şube Kuralları & İhtarlar", next: "kurallar" },
      { label: "📦 C-Tek Sipariş", next: "ctek" }
    ]
  },
  cihazAlim: {
    message: "Hangi fiyat listesini incelemek istersiniz?",
    options: [
      { label: "YNA Listesi", next: "ynaListe" },
      { label: "2. El Listesi", next: "ikinciElListe" },
      { label: "⬅️ Ana Menü", next: "start" }
    ]
  },
  kurallar: {
    message: "Lütfen incelemek istediğiniz prosedürü seçiniz:",
    options: [
      { label: "Yaş Sınırı ve Kimlik", next: "yasSiniri" },
      { label: "Personel İhtar Kuralları", next: "ihtar" },
      { label: "⬅️ Ana Menü", next: "start" }
    ]
  },
  yasSiniri: {
    message: "⚠️ ÖNEMLİ: Cihaz alımlarında 18 yaş altı işlemler kesinlikle yasaktır. Mutlaka kimlik fotokopisi ve alım formu doldurulmalıdır.",
    options: [
      { label: "⬅️ Ana Menü", next: "start" }
    ]
  },
  ihtar: {
    message: "Şube operasyon kurallarına uyulmaması durumunda merkez tarafından resmi ihtarname düzenlenmektedir.",
    options: [
      { label: "⬅️ Ana Menü", next: "start" }
    ]
  },
  ctek: {
    message: "C-Tek yedek parça sipariş ekranına sol menüden ulaşabilirsiniz. Stokta olmayan parçalar için talep oluşturun.",
    options: [
      { label: "⬅️ Ana Menü", next: "start" }
    ]
  },
  ynaListe: {
    message: "YNA güncel listesi sisteme yüklenmiştir. Lütfen ana ekrandaki ilgili tablodan kontrol ediniz.",
    options: [
      { label: "⬅️ Ana Menü", next: "start" }
    ]
  },
  ikinciElListe: {
    message: "2. El alım fiyatlarında kasa kondisyonu ve pil sağlığına göre otomatik kesintiler uygulanmaktadır.",
    options: [
      { label: "⬅️ Ana Menü", next: "start" }
    ]
  }
};

export default function CBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [chatHistory, setChatHistory] = useState<Message[]>([
    { sender: 'bot', text: botData.start.message, options: botData.start.options }
  ]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Otomatik aşağı kaydırma (Dokunulmadı)
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
      {/* C-BOT Penceresi - Görsel iyileştirmeler yapıldı */}
      {isOpen && (
        <div className="fixed bottom-28 right-8 w-80 md:w-96 h-[500px] bg-white rounded-2xl shadow-2xl flex flex-col z-[9999] overflow-hidden border border-slate-200">
          {/* Header */}
          <div className="bg-[#0052D4] p-4 text-white flex justify-between items-center shadow-md">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center text-[#0052D4] font-bold">C</div>
              <span className="font-semibold text-lg tracking-tight">C-BOT Asistan</span>
            </div>
            <button onClick={() => setIsOpen(false)} className="hover:bg-white/20 p-1 rounded-full transition-colors text-white">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>
          
          {/* Mesaj Alanı */}
          <div className="flex-1 overflow-y-auto p-4 bg-slate-50 space-y-4">
            {chatHistory.map((msg, index) => (
              <div key={index} className={`flex flex-col ${msg.sender === 'bot' ? 'items-start' : 'items-end'}`}>
                <div className={`px-4 py-2 rounded-2xl text-sm max-w-[85%] shadow-sm ${
                  msg.sender === 'bot' 
                  ? 'bg-white text-slate-800 rounded-tl-none border border-slate-100' 
                  : 'bg-[#0052D4] text-white rounded-tr-none'
                }`}>
                  {msg.text}
                </div>
                
                {/* Seçenek Butonları */}
                {msg.sender === 'bot' && msg.options && (
                  <div className="mt-2 flex flex-col gap-2 w-full max-w-[80%]">
                    {msg.options.map((opt, i) => (
                      <button 
                        key={i} 
                        onClick={() => handleOptionClick(opt)} 
                        className="bg-white border border-[#0052D4] text-[#0052D4] px-3 py-2 rounded-lg text-xs text-left hover:bg-blue-50 transition-all font-medium shadow-sm active:scale-95"
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

      {/* --- YENİ ROBOT GÖRÜNÜMLÜ BUTON --- */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="cbot-floating-btn fixed bottom-8 right-8 flex flex-col items-center z-[9999] group"
      >
        {/* Üstteki Mavi Etiket */}
        <div className="bg-[#0052D4] text-white text-[10px] font-bold px-3 py-1 rounded-t-lg shadow-lg mb-[-2px] z-10 uppercase tracking-widest border-x border-t border-white/20 transition-transform group-hover:scale-105">
          C-BOT
        </div>

        {/* Robot Kafası Gövdesi */}
        <div className="w-16 h-16 rounded-full bg-white border-[3px] border-[#4364F7] shadow-xl flex items-center justify-center overflow-hidden relative transition-all group-hover:scale-105 group-active:scale-95">
          {/* Robot Yüzü SVG */}
          <svg viewBox="0 0 24 24" fill="none" className="w-10 h-10 text-[#0052D4]" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="10" fill="#F0F7FF"/>
            <rect x="7" y="10" width="2.5" height="2.5" rx="1" fill="#0052D4"/>
            <rect x="14.5" y="10" width="2.5" height="2.5" rx="1" fill="#0052D4"/>
            <path d="M8 15.5C8 15.5 9.5 17.5 12 17.5C14.5 17.5 16 15.5 16 15.5" stroke="#0052D4" strokeWidth="1.5" strokeLinecap="round"/>
            <rect x="3" y="11" width="1" height="3" rx="0.5" fill="#4364F7"/>
            <rect x="20" y="11" width="1" height="3" rx="0.5" fill="#4364F7"/>
          </svg>
          
          {/* Alt Gölgelendirme Efekti */}
          <div className="absolute bottom-0 w-full h-3 bg-gradient-to-t from-[#0052D4]/10 to-transparent"></div>
        </div>
      </button>
    </>
  );
}
