"use client";

import { useState } from 'react';

const TAKSIT_ORANLARI = [
  { month: 12, rate: 35.41 },
  { month: 11, rate: 32.07 },
  { month: 10, rate: 28.88 },
  { month: 9, rate: 25.85 },
  { month: 8, rate: 22.96 },
  { month: 7, rate: 20.19 },
  { month: 6, rate: 17.55 },
  { month: 5, rate: 14.76 },
  { month: 4, rate: 12.36 },
  { month: 3, rate: 10.05 },
  { month: 2, rate: 7.83 },
  { month: 1, rate: 4 }
];

export default function ModernTaksitEkrani() {
  const [tutar, setTutar] = useState<string>('100000');
  const asilTutar: number = Number(tutar) || 0;

  const formatPara = (deger: number) => {
    return new Intl.NumberFormat('tr-TR', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    }).format(deger);
  };

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8 font-sans selection:bg-blue-200">
      
      {/* Üst Kısım: Logo ve Açıklama */}
      <div className="max-w-5xl mx-auto text-center mb-12">
        <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight mb-4">
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-800 to-blue-500">
            CNET
          </span>
          <span className="text-blue-400">mobil</span>
        </h1>
        <p className="text-slate-500 text-lg md:text-xl font-medium">
          Akıllı Ödeme ve Taksit Asistanı
        </p>
      </div>

      {/* Tutar Giriş Alanı */}
      <div className="max-w-xl mx-auto bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 p-8 mb-12 transition-all hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)]">
        <label className="block text-center text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">
          Hesaba Geçecek Net Tutar
        </label>
        <div className="relative flex items-center justify-center">
          <span className="absolute left-6 text-3xl font-bold text-orange-500">₺</span>
          <input
            type="number"
            value={tutar}
            onChange={(e) => setTutar(e.target.value)}
            className="w-full bg-slate-50 text-center text-4xl md:text-5xl font-black text-slate-800 py-6 px-12 rounded-2xl border-2 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 outline-none transition-all"
            placeholder="0"
          />
        </div>
      </div>

      {/* Taksit Kartları (Grid Yapısı) */}
      <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {TAKSIT_ORANLARI.map((item) => {
          const vadeFarkiTutari = (asilTutar * item.rate) / 100;
          const toplamOdenecek = asilTutar + vadeFarkiTutari;
          const aylikTaksit = asilTutar > 0 ? (toplamOdenecek / item.month) : 0;

          return (
            <div 
              key={item.month} 
              className="group bg-white rounded-2xl p-6 border border-slate-200 shadow-sm hover:shadow-xl hover:border-blue-400 hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between"
            >
              {/* Kart Üst Bilgi: Ay Sayısı ve Toplam */}
              <div className="flex justify-between items-start mb-6">
                <span className="inline-flex items-center justify-center px-4 py-1.5 bg-blue-50 text-blue-700 font-bold text-sm rounded-full group-hover:bg-blue-600 group-hover:text-white transition-colors">
                  {item.month === 1 ? 'Tek Çekim' : `${item.month} Taksit`}
                </span>
              </div>

              {/* Aylık Ödeme Miktarı (Ana Odak) */}
              <div className="mb-6">
                <p className="text-sm font-semibold text-slate-400 mb-1">Aylık Ödeme</p>
                <div className="flex items-baseline text-slate-800">
                  <span className="text-3xl font-black">₺{formatPara(aylikTaksit)}</span>
                  {item.month !== 1 && <span className="text-sm font-medium text-slate-500 ml-1">/ay</span>}
                </div>
              </div>

              {/* Çizgi */}
              <div className="w-full h-px bg-slate-100 mb-4"></div>

              {/* Kart Alt Bilgi: Karttan Çekilecek Toplam Tutar */}
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-slate-500">Karttan Çekilecek</span>
                <span className="text-lg font-bold text-orange-600">
                  ₺{formatPara(toplamOdenecek)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
}
