"use client";

import React, { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

interface Message { sender: 'bot' | 'user'; text: string; }

interface CBotProps {
  portalData?: any[];     
  selectedBranch?: string; 
}

export default function CBot({ portalData = [], selectedBranch = "" }: CBotProps) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  
  const isCmrMode = selectedBranch?.toUpperCase().includes('CMR');

  // BAŞLANGIÇ MESAJI: Samimiyetten arındırıldı, doğrudan işe odaklanıldı.
  const initialBotMsg = isCmrMode 
    ? "Sistem aktif. Barem durumunu analiz etmek istediğiniz personelin ismini giriniz."
    : "C-BOT Asistan şu an bu kanal için geliştirme aşamasındadır.";

  const [chatHistory, setChatHistory] = useState<Message[]>([
    { sender: 'bot', text: initialBotMsg }
  ]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isHiddenPage = pathname === '/cihaz-sat' || pathname === '/teknik-takip';
  const isHomePage = pathname === '/';

  if (isHiddenPage || !isHomePage) {
    return null;
  }

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory, isTyping, isOpen]);

  // ANALİZ MOTORU: "Abi" kelimesi tamamen silindi, teknik bir dil kuruldu.
  const veriyiSuzVeYorumla = (input: string) => {
    if (!isCmrMode) {
      return "C-BOT Asistan yakında hizmete sunulacaktır.";
    }

    const msg = input.toLowerCase().trim();
    const personel = portalData.find(p => 
      msg.includes(p.isim.toLowerCase()) || msg.includes(p.isim.split(' ')[0].toLowerCase())
    );

    if (personel) {
      const yuzde = personel.basariYuzdesi;
      const hedef = personel.anaHedef;
      const gerceklesen = personel.anaSatilan;
      const fark = hedef - gerceklesen;

      if (personel.isBasarili) {
        return `🌟 **Tebrikler ${personel.isim}!** \n\n**Durum:** Başarılı \n**Gidişat:** ${gerceklesen} / ${hedef} (%${yuzde}) \n**Analiz:** Barem hedefi tamamlanmıştır. Mevcut performansınız Cnetmobil standartları ile uyumludur.`;
      } else {
        return `⚠️ **${personel.isim}**, barem gidişatı şu an RİSKLİ görünmektedir. \n\n**Gidişat:** ${gerceklesen} / ${hedef} (%${yuzde}) \n**Analiz:** Hedefe ulaşmak için ${fark} adet ek 2. El satışı gerekmektedir. Performans artışı tavsiye edilir.`;
      }
    }

    return "İsim personel listesinde süzülemedi. Lütfen ismi kontrol ederek tekrar giriş yapınız.";
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    const userMsg = inputValue;
    setChatHistory(prev => [...prev, { sender: 'user', text: userMsg }]);
    setInputValue("");
    setIsTyping(true);

    setTimeout(() => {
      const response = veriyiSuzVeYorumla(userMsg);
      setChatHistory(prev => [...prev, { sender: 'bot', text: response }]);
      setIsTyping(false);
    }, 800);
  };

  return (
    <>
      {isOpen && (
        <div className="fixed bottom-24 right-6 w-80 md:w-96 h-[550px] bg-white rounded-[2rem] shadow-[0_20px_80px_rgba(0,0,0,0.2)] flex flex-col z-[99999] overflow-hidden border border-slate-100 animate-in fade-in zoom-in duration-300">
          
          <div className="bg-[#0052D4] p-5 text-white flex flex-col shadow-lg">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center font-black text-2xl text-[#0052D4] shadow-sm">C</div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-[15px] tracking-tight uppercase">C-BOT</span>
                    <span className="text-white/80 font-medium text-sm">PRO</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 border border-green-400/30 rounded-full px-2 py-0.5 w-fit bg-green-500/10">
                    <div className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-300 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400"></span>
                    </div>
                    <span className="text-green-400 text-[9px] font-bold tracking-widest uppercase">SİSTEM ÇEVRİMİÇİ</span>
                  </div>
                </div>
              </div>
              <button onClick={() => setIsOpen(false)} className="hover:bg-white/10 p-2 rounded-full transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-5 bg-white space-y-4">
            {chatHistory.map((msg, index) => (
              <div key={index} className={`flex flex-col ${msg.sender === 'bot' ? 'items-start' : 'items-end'}`}>
                <div className={`px-4 py-2.5 rounded-2xl text-[13px] max-w-[85%] leading-relaxed shadow-sm transition-all ${
                  msg.sender === 'bot' ? 'bg-slate-50 text-slate-700 rounded-tl-none border border-slate-100' : 'bg-[#0052D4] text-white rounded-tr-none'
                }`}>
                  {msg.text}
                </div>
              </div>
            ))}
            {isTyping && <div className="text-[10px] text-blue-500 font-bold animate-pulse ml-2">Analiz ediliyor...</div>}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-4 bg-white border-t border-slate-50">
            <form onSubmit={handleSendMessage} className="flex gap-2">
              <input 
                type="text" 
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={isCmrMode ? "Personel ismi giriniz..." : "Servis dışı"}
                disabled={!isCmrMode}
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#0052D4] transition-all disabled:opacity-50"
              />
              <button type="submit" disabled={!isCmrMode} className="bg-[#0052D4] text-white p-2.5 rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-50">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
              </button>
            </form>
          </div>
        </div>
      )}

      <button onClick={() => setIsOpen(!isOpen)} className="fixed bottom-8 right-8 z-[99999] group flex flex-col items-center">
        <div className="bg-[#0052D4] text-white text-[9px] font-black px-3 py-1 rounded-full shadow-lg mb-[-4px] z-10 uppercase tracking-widest border border-white/20 transition-transform group-hover:scale-110">C-BOT</div>
        <div className="w-16 h-16 rounded-full bg-white border-2 border-[#0052D4] shadow-xl flex items-center justify-center transition-all group-hover:scale-110 group-active:scale-90">
          <svg viewBox="0 0 24 24" fill="none" className="w-10 h-10 text-[#0052D4]" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="10" fill="#F0F7FF"/><rect x="7.5" y="10" width="2" height="2" rx="1" fill="#0052D4"/><rect x="14.5" y="10" width="2" height="2" rx="1" fill="#0052D4"/><path d="M9 15.5C9 15.5 10 17 12 17C14 17 15 15.5 15 15.5" stroke="#0052D4" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
        </div>
      </button>
    </>
  );
}
