"use client";

import { useState } from 'react';

const TAKSIT_ORANLARI = [
  { month: 12, rate: 35.41, label: 'En Popüler' },
  { month: 11, rate: 32.07 },
  { month: 10, rate: 28.88 },
  { month: 9, rate: 25.85 },
  { month: 8, rate: 22.96 },
  { month: 7, rate: 20.19 },
  { month: 6, rate: 17.55, label: 'Avantajlı' },
  { month: 5, rate: 14.76 },
  { month: 4, rate: 12.36 },
  { month: 3, rate: 10.05 },
  { month: 2, rate: 7.83 },
  { month: 1, rate: 4, label: 'Tek Çekim' }
];

export default function ProPosEkrani() {
  const [tutarGirdisi, setTutarGirdisi] = useState<string>('0');
  const [aktifTaksit, setAktifTaksit] = useState<number>(12);

  const asilTutar: number = Number(tutarGirdisi) || 0;

  const formatPara = (deger: number) => {
    return new Intl.NumberFormat('tr-TR', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    }).format(deger);
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200 font-sans flex items-center justify-center p-4 lg:p-8">
      
      <div className="w-full max-w-7xl bg-[#1e293b] rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col lg:flex-row border border-slate-700/50">
        
        {/* SOL PANEL */}
        <div className="w-full lg:w-[40%] bg-gradient-to-br from-[#1e3a8a] to-[#0f172a] p-8 lg:p-12 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-12">
              <div>
                <h1 className="text-3xl font-black text-white tracking-tight">
                  CNET<span className="text-blue-400 font-medium">mobil</span>
                </h1>
                <span className="text-blue-200/60 text-xs font-semibold tracking-widest uppercase mt-1 block">
                  Akıllı POS Sistemi
                </span>
              </div>
            </div>

            <div className="space-y-4">
              <label className="text-blue-200/80 text-sm font-bold uppercase tracking-wider block">
                Hesaba Geçecek Net Tutar
              </label>
              
              <div className="relative">
                <span className="absolute left-6 top-1/2 -translate-y-1/2 text-4xl font-light text-blue-300">₺</span>
                <input
                  type="number"
                  value={tutarGirdisi}
                  onChange={(e) => setTutarGirdisi(e.target.value)}
                  placeholder="0"
                  className="w-full bg-slate-900/40 border-2 border-slate-600/50 rounded-3xl py-6 pl-16 pr-6 text-5xl font-bold text-white placeholder-slate-600 focus:outline-none focus:border-blue-400 shadow-inner"
                />
              </div>
            </div>

            <div className="mt-6 grid grid-cols-3 gap-3">
              {[1000, 5000, 10000].map((val) => (
                <button
                  key={val}
                  onClick={() => setTutarGirdisi(prev => String((Number(prev) || 0) + val))}
                  className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl py-3 flex items-center justify-center gap-1 text-sm font-medium text-blue-100 transition-all"
                >
                  <span className="text-yellow-400 font-bold">+</span> {val / 1000}k
                </button>
              ))}
            </div>
          </div>

          <div className="mt-12 p-5 bg-blue-950/40 rounded-2xl border border-blue-900/50">
            <p className="text-sm text-blue-200/70 leading-relaxed">
              Tüm komisyon oranları günceldir. Müşteriye yansıtılacak olan <strong className="text-white font-semibold">Toplam Çekim Tutarı</strong> sağ panelde hesaplanmaktadır.
            </p>
          </div>
        </div>

        {/* SAĞ PANEL */}
        <div className="w-full lg:w-[60%] bg-[#f8fafc] p-6 lg:p-10 flex flex-col">
          <div className="flex items-center justify-between mb-6 px-2">
            <h2 className="text-2xl font-bold text-slate-800">Müşteri Ödeme Planı</h2>
            <span className="text-sm font-medium text-slate-500 bg-slate-200/50 px-3 py-1 rounded-full">
              12 Seçenek
            </span>
          </div>

          <div className="space-y-3 overflow-y-auto max-h-[70vh] pr-2">
            {TAKSIT_ORANLARI.map((item) => {
              const vadeFarkiTutari = (asilTutar * item.rate) / 100;
              const toplamOdenecek = asilTutar + vadeFarkiTutari;
              const aylikTaksit = asilTutar > 0 ? (toplamOdenecek / item.month) : 0;
              const isSelected = aktifTaksit === item.month;

              return (
                <div 
                  key={item.month}
                  onClick={() => setAktifTaksit(item.month)}
                  className={`relative flex items-center justify-between p-5 rounded-2xl cursor-pointer border-2 transition-all 
                    ${isSelected ? 'bg-white border-blue-500 shadow-lg' : 'bg-white/60 border-slate-200 hover:border-blue-300'}`}
                >
                  {isSelected && <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-blue-500 rounded-l-2xl"></div>}

                  <div className="flex flex-col w-1/4 pl-2">
                    <span className={`text-xl font-black ${isSelected ? 'text-blue-600' : 'text-slate-700'}`}>
                      {item.month === 1 ? 'Tek Çekim' : `${item.month} Ay`}
                    </span>
                    {item.label && (
                      <span className="text-[10px] font-bold uppercase tracking-wider mt-1 w-max px-2 py-0.5 rounded-md bg-orange-100 text-orange-600">
                        {item.label}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-col items-center justify-center w-2/4">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">Aylık</span>
                    <span className="text-2xl font-bold text-slate-900">
                      {item.month === 1 ? '-' : `₺${formatPara(aylikTaksit)}`}
                    </span>
                  </div>

                  <div className="flex flex-col items-end w-1/4">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">Toplam</span>
                    <span className="text-lg font-bold text-orange-600">
                      ₺{formatPara(toplamOdenecek)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
