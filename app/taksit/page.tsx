"use client";

import { useState, useEffect } from 'react';
import { 
  Calculator, 
  CreditCard, 
  Store, 
  Zap, 
  CheckCircle2, 
  RotateCcw,
  BadgePercent,
  ChevronRight
} from 'lucide-react';

// Oranlar (Sabit)
const TAKSIT_ORANLARI = [
  { month: 12, rate: 35.41, highlight: true, label: 'En Popüler' },
  { month: 11, rate: 32.07 },
  { month: 10, rate: 28.88 },
  { month: 9, rate: 25.85 },
  { month: 8, rate: 22.96 },
  { month: 7, rate: 20.19 },
  { month: 6, rate: 17.55, highlight: true, label: 'Avantajlı' },
  { month: 5, rate: 14.76 },
  { month: 4, rate: 12.36 },
  { month: 3, rate: 10.05 },
  { month: 2, rate: 7.83 },
  { month: 1, rate: 4, highlight: true, label: 'Tek Çekim' }
];

export default function ProPosEkrani() {
  const [tutarGirdisi, setTutarGirdisi] = useState<string>('');
  const [aktifTaksit, setAktifTaksit] = useState<number | null>(12);

  // Kasiyer Hızlı İşlem Butonları
  const hizliEkle = (miktar: number) => {
    setTutarGirdisi((prev) => String((Number(prev) || 0) + miktar));
  };

  const temizle = () => {
    setTutarGirdisi('');
    setAktifTaksit(12);
  };

  const asilTutar: number = Number(tutarGirdisi) || 0;

  const formatPara = (deger: number) => {
    return new Intl.NumberFormat('tr-TR', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    }).format(deger);
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200 font-sans selection:bg-blue-500/30 flex items-center justify-center p-4 lg:p-8">
      
      {/* Ana Konteyner (Dual Panel) */}
      <div className="w-full max-w-7xl bg-[#1e293b] rounded-[2.5rem] shadow-2xl shadow-blue-900/20 overflow-hidden flex flex-col lg:flex-row border border-slate-700/50 relative">
        
        {/* SOL PANEL - KONTROL / KASA ALANI */}
        <div className="w-full lg:w-[45%] xl:w-[40%] bg-gradient-to-br from-[#1e3a8a] to-[#0f172a] p-8 lg:p-12 flex flex-col justify-between relative overflow-hidden">
          {/* Arka plan efekti */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none"></div>

          <div>
            {/* Header / Marka */}
            <div className="flex items-center justify-between mb-12">
              <div className="flex flex-col">
                <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-2">
                  CNET<span className="text-blue-400 font-medium">mobil</span>
                </h1>
                <span className="text-blue-200/60 text-xs font-semibold tracking-widest uppercase mt-1 flex items-center gap-1">
                  <Store className="w-3 h-3" /> Akıllı POS Sistemi
                </span>
              </div>
            </div>

            {/* Tutar Girişi (Büyük Ekran) */}
            <div className="space-y-4 relative z-10">
              <label className="text-blue-200/80 text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                <Calculator className="w-4 h-4 text-blue-400" />
                Hesaba Geçecek Net Tutar
              </label>
              
              <div className="relative group">
                <span className="absolute left-6 top-1/2 -translate-y-1/2 text-4xl font-light text-blue-300">₺</span>
                <input
                  type="number"
                  value={tutarGirdisi}
                  onChange={(e) => setTutarGirdisi(e.target.value)}
                  placeholder="0"
                  className="w-full bg-slate-900/40 border-2 border-slate-600/50 rounded-3xl py-6 pl-16 pr-6 text-5xl font-bold text-white placeholder-slate-600 focus:outline-none focus:border-blue-400 focus:bg-slate-900/60 transition-all shadow-inner"
                />
                {tutarGirdisi && (
                  <button 
                    onClick={temizle}
                    className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors bg-slate-800 p-2 rounded-full"
                  >
                    <RotateCcw className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>

            {/* Hızlı Ekle Butonları (Kasiyer için hızlandırıcı) */}
            <div className="mt-6 grid grid-cols-3 gap-3">
              {[1000, 5000, 10000].map((val) => (
                <button
                  key={val}
                  onClick={() => hizliEkle(val)}
                  className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl py-3 flex items-center justify-center gap-1 text-sm font-medium text-blue-100 transition-all active:scale-95"
                >
                  <Zap className="w-3 h-3 text-yellow-400" /> +{val / 1000}k
                </button>
              ))}
            </div>
          </div>

          {/* Alt Bilgi */}
          <div className="mt-12 p-5 bg-blue-950/40 rounded-2xl border border-blue-900/50 backdrop-blur-sm">
            <div className="flex items-start gap-3">
              <BadgePercent className="w-6 h-6 text-blue-400 flex-shrink-0" />
              <p className="text-sm text-blue-200/70 leading-relaxed">
                Tüm komisyon oranları günceldir. Müşteriye yansıtılacak olan <strong className="text-white font-semibold">Toplam Çekim Tutarı</strong> sağ panelde hesaplanmaktadır.
              </p>
            </div>
          </div>
        </div>


        {/* SAĞ PANEL - TAKSİT SONUÇLARI */}
        <div className="w-full lg:w-[55%] xl:w-[60%] bg-[#f8fafc] p-6 lg:p-10 flex flex-col h-full max-h-[85vh] lg:max-h-[90vh]">
          
          <div className="flex items-center justify-between mb-6 px-2">
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <CreditCard className="w-6 h-6 text-orange-500" />
              Müşteri Ödeme Planı
            </h2>
            <span className="text-sm font-medium text-slate-500 bg-slate-200/50 px-3 py-1 rounded-full">
              12 Seçenek
            </span>
          </div>

          {/* Liste Alanı (Scrollable) */}
          <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar pb-10">
            {TAKSIT_ORANLARI.map((item) => {
              const vadeFarkiTutari = (asilTutar * item.rate) / 100;
              const toplamOdenecek = asilTutar + vadeFarkiTutari;
              const aylikTaksit = asilTutar > 0 ? (toplamOdenecek / item.month) : 0;
              
              const isSelected = aktifTaksit === item.month;
              
              // Animasyonlu, seçilebilir kart yapısı
              return (
                <div 
                  key={item.month}
                  onClick={() => setAktifTaksit(item.month)}
                  className={`group relative flex items-center justify-between p-5 rounded-2xl cursor-pointer border-2 transition-all duration-300 overflow-hidden
                    ${isSelected 
                      ? 'bg-white border-blue-500 shadow-lg shadow-blue-500/10' 
                      : 'bg-white/60 border-slate-200 hover:border-blue-300 hover:bg-white'}
                  `}
                >
                  {/* Seçili ise sol kenar çubuğu */}
                  {isSelected && (
                    <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-blue-500"></div>
                  )}

                  {/* Sol Kısım: Ay Bilgisi */}
                  <div className="flex flex-col w-1/4 pl-2">
                    <span className={`text-xl font-black ${isSelected ? 'text-blue-600' : 'text-slate-700'}`}>
                      {item.month === 1 ? 'Tek Çekim' : `${item.month} Ay`}
                    </span>
                    {item.highlight && (
                      <span className={`text-[10px] font-bold uppercase tracking-wider mt-1 w-max px-2 py-0.5 rounded-md ${isSelected ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-slate-500'}`}>
                        {item.label}
                      </span>
                    )}
                  </div>

                  {/* Orta Kısım: Aylık Taksit (Vurgulu) */}
                  <div className="flex flex-col items-center justify-center w-2/4">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">Aylık</span>
                    <div className={`text-2xl font-bold flex items-baseline gap-1 ${isSelected ? 'text-slate-900' : 'text-slate-600'}`}>
                      {item.month === 1 ? '-' : `₺${formatPara(aylikTaksit)}`}
                    </div>
                  </div>

                  {/* Sağ Kısım: Toplam Çekim */}
                  <div className="flex flex-col items-end w-1/4">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">Toplam</span>
                    <span className={`text-lg font-bold ${isSelected ? 'text-orange-600' : 'text-slate-700'}`}>
                      ₺{formatPara(toplamOdenecek)}
                    </span>
                  </div>

                  {/* Hover/Select İkonu */}
                  <div className="absolute right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    {isSelected ? (
                      <CheckCircle2 className="w-6 h-6 text-blue-500 bg-white rounded-full" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-slate-300" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      </div>

      {/* Tailwind Scrollbar için gerekli CSS (global.css içine ekleyebilirsiniz veya burada bırakabilirsiniz) */}
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: #cbd5e1;
          border-radius: 20px;
        }
      `}} />
    </div>
  );
}
