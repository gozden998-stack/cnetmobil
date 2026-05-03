"use client";

import React, { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

interface CBotProps {
  portalData: any[];
  selectedBranch: string;
}

export default function CBot({ portalData, selectedBranch }: CBotProps) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  
  // --- KANAL KONTROLÜ ---
  const isCmrMode = selectedBranch?.toUpperCase().includes('CMR');
  
  // Başlangıç mesajı kanala göre değişir
  const initialMsg = isCmrMode 
    ? "Selam abi! Cnetmobil gidişat verilerini anlık süzüyorum. Kimin barem durumuna bakalım?"
    : "İyi eğitimli sohbet botu C-BOT Asistan, yakında hizmetinize sunulacaktır.";

  const [chatHistory, setChatHistory] = useState<any[]>([
    { sender: 'bot', text: initialMsg }
  ]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // --- SAYFA GİZLEME KURALLARI ---
  // Sadece ana sayfada (/) görünür.
  if (pathname !== '/') return null;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, isTyping]);

  const veriyiSuz = (input: string) => {
    // Eğer CMR modu değilse, strateji üretme
    if (!isCmrMode) {
      return "İyi eğitimli sohbet botu C-BOT Asistan, yakında hizmetinize sunulacaktır.";
    }

    const msg = input.toLowerCase().trim();
    const personel = portalData?.find(p => 
      msg.includes(p.isim.toLowerCase()) || msg.includes(p.isim.split(' ')[0].toLowerCase())
    );

    if (personel) {
      const yuzde = personel.basariYuzdesi;
      const hedef = personel.anaHedef;
      const gerceklesen = personel.anaSatilan;
      const fark = hedef - gerceklesen;

      if (personel.isBasarili) {
        return `🌟 **Tebrikler ${personel.isim}!** \n\n**Durum:** Başarılı \n**Gidişat:** ${gerceklesen} / ${hedef} (%${yuzde}) \n**Analiz:** Baremi doldurmuşsun abi. Cnetmobil hedefleri doğrultusunda primin hayırlı olsun!`;
      } else {
        return `⚠️ **${personel.isim}**, barem gidişatın şu an RİSKLİ görünüyor . \n\n**Gidişat:** ${gerceklesen} / ${hedef} (%${yuzde}) \n**Analiz:** Hedefi yakalamak için ${fark} adet daha işlem yapman lazım. Tempoyu süzdüğüm kadarıyla biraz daha artırman gerekiyor!`;
      }
    }
    return "Bu ismi personel listesinde süzemedim . İsmi tam yazar mısın?";
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;
    const userMsg = inputValue;
    setChatHistory(prev => [...prev, { sender: 'user', text: userMsg }]);
    setInputValue("");
    setIsTyping(true);
    setTimeout(() => {
      setChatHistory(prev => [...prev, { sender: 'bot', text: veriyiSuz(userMsg) }]);
      setIsTyping(false);
    }, 800);
  };

  return (
    <>
      {isOpen && (
        <div className="fixed bottom-24 right-6 w-[350px] md:w-[420px] h-[550px] bg-white rounded-[2.5rem] shadow-[0_20px_80px_rgba(0,0,0,0.3)] flex flex-col z-[100000] overflow-hidden border border-slate-100 animate-in fade-in zoom-in duration-300">
          <div className="bg-[#0052D4] p-6 text-white flex flex-col relative shadow-lg">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-md">
                  <span className="text-[#0052D4] font-black text-2xl">C</span>
                </div>
                <div className="flex flex-col">
                  <span className="font-bold text-lg uppercase tracking-tight leading-none">C-BOT PRO</span>
                  <div className="text-[10px] text-green-100 font-bold mt-2 uppercase bg-white/10 px-2 py-0.5 rounded-full w-fit">
                    {isCmrMode ? "Veriler Süzülüyor" : "Yakında Hizmetinizde"}
                  </div>
                </div>
              </div>
              <button onClick={() => setIsOpen(false)} className="bg-white/10 hover:bg-white/20 p-2 rounded-full text-white font-bold transition-all text-xl">✕</button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-white">
            {chatHistory.map((msg, index) => (
              <div key={index} className={`flex ${msg.sender === 'bot' ? 'justify-start' : 'justify-end'}`}>
                <div className={`px-5 py-3 rounded-[1.6rem] text-[14px] max-w-[85%] leading-relaxed shadow-sm ${msg.sender === 'bot' ? 'bg-slate-50 text-slate-700 rounded-tl-none border border-slate-100' : 'bg-[#0052D4] text-white rounded-tr-none shadow-lg'}`}>{msg.text}</div>
              </div>
            ))}
            {isTyping && <div className="text-[11px] text-blue-500 animate-pulse font-bold ml-2">Sistem taranıyor...</div>}
            <div ref={messagesEndRef} />
          </div>
          <div className="p-6 bg-white border-t border-slate-50">
            <form onSubmit={handleSendMessage} className="flex gap-3">
              <input type="text" value={inputValue} onChange={(e) => setInputValue(e.target.value)} placeholder="Mesajınızı yazın..." className="flex-1 bg-slate-50 border-2 border-blue-50 rounded-2xl px-5 py-3.5 text-sm focus:border-[#0052D4] outline-none transition-all placeholder:text-slate-400" />
              <button type="submit" className="bg-[#0052D4] text-white p-4 rounded-2xl shadow-lg hover:scale-105 active:scale-95 transition-all">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
              </button>
            </form>
          </div>
        </div>
      )}
      <button onClick={() => setIsOpen(!isOpen)} className="fixed bottom-8 right-8 z-[100000] group flex flex-col items-center">
        <div className="bg-[#0052D4] text-white text-[9px] font-black px-3 py-1 rounded-full shadow-lg mb-[-4px] z-10 uppercase tracking-widest border border-white/20 transition-transform group-hover:scale-110">C-BOT</div>
        <div className="w-16 h-16 rounded-full bg-white border-2 border-[#0052D4] shadow-[0_12px_40_rgba(0,82,212,0.4)] flex items-center justify-center group-hover:scale-110 active:scale-90 transition-all duration-300">
          <span className="text-[#0052D4] font-black text-2xl relative z-10">C</span>
        </div>
      </button>
    </>
  );
}
