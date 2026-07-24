"use client";

import { useState } from 'react';

// Oranlar listesi (1'den 12 aya kadar)
const TAKSIT_ORANLARI = [
  { month: 1, rate: 4 },
  { month: 2, rate: 7.83 },
  { month: 3, rate: 10.05 },
  { month: 4, rate: 12.36 },
  { month: 5, rate: 14.76 },
  { month: 6, rate: 17.55 },
  { month: 7, rate: 20.19 },
  { month: 8, rate: 22.96 },
  { month: 9, rate: 25.85 },
  { month: 10, rate: 28.88 },
  { month: 11, rate: 32.07 },
  { month: 12, rate: 35.41 }
];

export default function CnetmobilTaksit() {
  const [tutar, setTutar] = useState<string>('100000');
  const [seciliAy, setSeciliAy] = useState<number>(12);

  const asilTutar = Number(tutar) || 0;

  const formatPara = (deger: number) => {
    return new Intl.NumberFormat('tr-TR', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    }).format(deger);
  };

  // Seçilen ayın hesaplaması
  const aktifOran = TAKSIT_ORANLARI.find(item => item.month === seciliAy)?.rate || 0;
  const toplamOdenecek = asilTutar + (asilTutar * aktifOran) / 100;
  const aylikTaksit = seciliAy > 0 ? toplamOdenecek / seciliAy : 0;

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0f172a] font-sans selection:bg-blue-100 flex flex-col justify-between py-16 px-6 lg:px-12">
      
      <div className="max-w-[1200px] w-full mx-auto">
        
        {/* ÜST KISIM: Logo ve Başlık */}
        <div className="text-center mb-12">
          <h2 className="text-xl font-extrabold tracking-tight text-[#1E40AF] mb-3">
            CNETmobil
          </h2>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900 mb-3">
            Taksit Hesaplama
          </h1>
          <p className="text-slate-500 text-lg font-medium">
            Hesaba geçecek tutarı girin.
          </p>
        </div>

        {/* ORTADA: Dev Para Giriş Alanı */}
        <div className="max-w-[700px] mx-auto mb-16">
          <div className="relative flex items-center bg-[#FFFFFF] rounded-[22px] border border-[#E5E7EB] shadow-[0_15px_40px_rgba(0,0,0,.06)] transition-all duration-300 focus-within:border-[#FF6200] focus-within:ring-4 focus-within:ring-[#FF6200]/10">
            <span className="absolute left-8 text-4xl font-semibold text-slate-400">
              ₺
            </span>
            <input
              type="number"
              value={tutar}
              onChange={(e) => setTutar(e.target.value)}
              placeholder="100.000"
              className="w-full bg-transparent text-center text-[54px] font-bold text-slate-900 py-4 px-16 outline-none placeholder:text-slate-300"
            />
          </div>
        </div>

        {/* INPUTUN ALTINDA: Netflix / Apple Tarzı Yatay Kayan Büyük Kartlar */}
        <div className="mb-16">
          <div className="flex gap-6 overflow-x-auto pb-6 pt-2 px-2 snap-x scrollbar-none">
            {TAKSIT_ORANLARI.slice().reverse().map((item) => {
              const vadeFarki = (asilTutar * item.rate) / 100;
              const toplam = asilTutar + vadeFarki;
              const aylik = toplam / item.month;
              const isSelected = seciliAy === item.month;

              return (
                <div
                  key={item.month}
                  onClick={() => setSeciliAy(item.month)}
                  style={{ height: '170px', minWidth: '220px' }}
                  className={`snap-start flex-1 rounded-[22px] bg-[#FFFFFF] p-6 cursor-pointer transition-all duration-300 flex flex-col justify-between relative overflow-hidden group hover:scale-[1.03] ${
                    isSelected 
                      ? 'border-2 border-[#1E40AF] shadow-[0_20px_50px_rgba(30,64,175,0.12)]' 
                      : 'border border-[#E5E7EB] shadow-[0_15px_40px_rgba(0,0,0,.04)] hover:border-slate-300'
                  }`}
                >
                  {/* Seçilince Turuncu Üst Çizgi */}
                  {isSelected && (
                    <div className="absolute top-0 left-0 right-0 h-1.5 bg-[#FF6200]" />
                  )}

                  <div className="flex justify-between items-center">
                    <span className="text-lg font-bold text-slate-900">
                      {item.month === 1 ? 'Tek Çekim' : `${item.month} AY`}
                    </span>
                    {isSelected && (
                      <span className="w-2 h-2 rounded-full bg-[#FF6200]" />
                    )}
                  </div>

                  <div>
                    <div className="text-2xl font-black text-[#1E40AF] tracking-tight">
                      ₺{formatPara(aylik)}
                    </div>
                    <div className="text-xs font-medium text-slate-400 mt-1 flex justify-between">
                      <span>Karttan:</span>
                      <span className="font-semibold text-slate-600">₺{formatPara(toplam)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ALTTA: Seçilen Taksit İçin Büyük Özet Alanı */}
        <div className="max-w-[700px] mx-auto bg-[#FFFFFF] rounded-[22px] border border-[#E5E7EB] shadow-[0_15px_40px_rgba(0,0,0,.06)] p-8 mb-12">
          <div className="text-center">
            <span className="text-xs font-bold uppercase tracking-widest text-[#FF6200] bg-orange-50 px-3 py-1 rounded-full">
              {seciliAy === 1 ? 'Tek Çekim Detayı' : `${seciliAy} Ay Taksit Seçimi`}
            </span>
            
            <div className="my-6 border-t border-slate-100" />

            <div className="grid grid-cols-2 gap-6 items-center">
              <div className="text-left pl-4">
                <span className="block text-sm font-medium text-slate-400 mb-1">Aylık Ödeme</span>
                <span className="text-3xl font-black text-slate-900">
                  ₺{formatPara(aylikTaksit)}
                </span>
              </div>
              <div className="text-right pr-4 border-l border-slate-100">
                <span className="block text-sm font-medium text-slate-400 mb-1">Karttan Çekilecek</span>
                <span className="text-3xl font-black text-[#1E40AF]">
                  ₺{formatPara(toplamOdenecek)}
                </span>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* EN ALTTA: Bilgilendirme Notu */}
      <div className="text-center text-xs font-medium text-slate-400 mt-8">
        Bilgilendirme amaçlıdır. Bankanıza ve kart özelliklerinize göre değişiklik gösterebilir.
      </div>

    </div>
  );
}
