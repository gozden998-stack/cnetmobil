"use client";

import { useState, useEffect } from 'react';
import { 
  Calculator, Calendar, CreditCard, Landmark, Star, 
  ChevronRight, Printer, Share2, ShieldCheck, Scale, 
  TrendingUp, Clock, Info, Search, X 
} from 'lucide-react';

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

export default function DashboardTaksitEkrani() {
  const [tutarGirdisi, setTutarGirdisi] = useState<string>('100000');
  const [seciliTaksit, setSeciliTaksit] = useState<number>(12);
  const [tarih, setTarih] = useState<string>('');

  useEffect(() => {
    const today = new Date();
    const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' };
    setTarih(today.toLocaleDateString('tr-TR', options));
  }, []);

  const asilTutar: number = Number(tutarGirdisi) || 0;

  const formatPara = (deger: number) => {
    return new Intl.NumberFormat('tr-TR', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    }).format(deger);
  };

  const formatTamSayi = (deger: number) => {
    return new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }).format(deger);
  };

  // Hesaplama fonksiyonu
  const hesapla = (month: number, rate: number) => {
    const vadeFarkiTutari = (asilTutar * rate) / 100;
    const toplamOdenecek = asilTutar + vadeFarkiTutari;
    const aylikTaksit = asilTutar > 0 ? (toplamOdenecek / month) : 0;
    return { toplamOdenecek, aylikTaksit };
  };

  // Özet Bilgiler için veriler
  const onIkiAy = hesapla(12, 35.41);
  const tekCekim = hesapla(1, 4);
  const seciliVeri = TAKSIT_ORANLARI.find(t => t.month === seciliTaksit);
  const seciliHesap = seciliVeri ? hesapla(seciliVeri.month, seciliVeri.rate) : { toplamOdenecek: 0, aylikTaksit: 0 };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Üst Bilgi (Header) */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight text-[#1e3a8a]">
              CNET<span className="text-[#3b82f6]">mobil</span>
            </h1>
            <h2 className="text-xl font-bold text-slate-700 mt-1">
              Taksit & Komisyon Hesaplama
            </h2>
            <p className="text-slate-500 text-sm mt-1">Hesaba geçecek tutarı girin, tüm taksit seçeneklerini anında görün.</p>
          </div>
          <div className="mt-4 md:mt-0 flex items-center bg-blue-50 px-4 py-2 rounded-xl text-blue-700 border border-blue-100">
            <Calendar className="w-5 h-5 mr-3" />
            <div className="flex flex-col">
              <span className="text-xs font-medium opacity-80">Son Güncelleme</span>
              <span className="text-sm font-bold">{tarih}</span>
            </div>
          </div>
        </div>

        {/* Kahraman (Hero) Alanı - Tutar Girişi ve Banner */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Tutar Giriş Kartı */}
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-between relative overflow-hidden">
            <div>
              <label className="text-slate-600 font-semibold mb-2 block">Hesaba Geçecek Tutar</label>
              <div className="flex items-center border border-slate-200 rounded-2xl overflow-hidden focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-100 transition-all bg-slate-50">
                <div className="bg-[#2563eb] text-white p-6 flex items-center justify-center">
                  <span className="text-4xl font-bold">₺</span>
                </div>
                <input
                  type="number"
                  value={tutarGirdisi}
                  onChange={(e) => setTutarGirdisi(e.target.value)}
                  className="w-full bg-transparent text-4xl font-bold text-slate-800 py-4 px-6 outline-none"
                />
                {tutarGirdisi && (
                  <button onClick={() => setTutarGirdisi('')} className="p-4 text-slate-400 hover:text-slate-600">
                    <X className="w-6 h-6" />
                  </button>
                )}
                <span className="pr-6 text-slate-400 font-bold">TL</span>
              </div>
            </div>
            <div className="mt-6 flex items-center text-blue-600 text-sm font-medium">
              <ShieldCheck className="w-5 h-5 mr-2" />
              Güvenli İşlem
            </div>
          </div>

          {/* Banner Kartı */}
          <div className="bg-gradient-to-br from-blue-50 to-[#eff6ff] p-6 rounded-3xl shadow-sm border border-blue-100 flex items-center justify-between overflow-hidden relative">
            <div className="z-10 w-2/3">
              <h3 className="text-xl font-bold text-slate-800 mb-4">
                Taksit seçenekleriyle <br/> <span className="text-blue-600">kazancınızı planlayın</span>
              </h3>
              <ul className="space-y-3">
                <li className="flex items-center text-sm font-medium text-slate-700">
                  <Scale className="w-4 h-4 mr-2 text-blue-500" /> Nakit akışınızı dengeler
                </li>
                <li className="flex items-center text-sm font-medium text-slate-700">
                  <TrendingUp className="w-4 h-4 mr-2 text-blue-500" /> Satış gücünüzü artırır
                </li>
                <li className="flex items-center text-sm font-medium text-slate-700">
                  <Clock className="w-4 h-4 mr-2 text-blue-500" /> Vade seçenekleriyle esneklik sağlar
                </li>
              </ul>
            </div>
            {/* Dekoratif POS İllüstrasyonu (CSS ile temsili) */}
            <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-blue-200/50 rounded-full blur-3xl"></div>
            <div className="absolute right-4 bottom-4 w-32 h-32 bg-[#1e3a8a] rounded-2xl shadow-2xl transform rotate-12 flex items-center justify-center border-4 border-blue-400">
              <CreditCard className="w-16 h-16 text-white" />
            </div>
          </div>
        </div>

        {/* Özet Bilgiler */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-bold text-slate-800 mb-4">Özet Bilgiler</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            
            <div className="p-4 border border-slate-100 rounded-2xl flex items-center bg-slate-50">
              <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center mr-4 text-blue-600">
                <Landmark className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">Tek Çekim</p>
                <p className="text-lg font-bold text-[#1e3a8a]">₺{formatTamSayi(tekCekim.toplamOdenecek)}</p>
                <p className="text-xs text-slate-400">Karttan çekilecek</p>
              </div>
            </div>

            <div className="p-4 border border-orange-100 rounded-2xl flex items-center bg-orange-50/30">
              <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center mr-4 text-orange-500">
                <Calendar className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">En Avantajlı Taksit</p>
                <p className="text-lg font-bold text-orange-600">12 Ay</p>
                <p className="text-xs text-slate-400">Aylık ₺{formatTamSayi(onIkiAy.aylikTaksit)}</p>
              </div>
            </div>

            <div className="p-4 border border-slate-100 rounded-2xl flex items-center bg-slate-50">
              <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center mr-4 text-blue-600">
                <CreditCard className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">Karttan Çekilecek</p>
                <p className="text-lg font-bold text-slate-800">₺{formatTamSayi(seciliHesap.toplamOdenecek)}</p>
                <p className="text-xs text-slate-400">{seciliTaksit} Ay için toplam</p>
              </div>
            </div>

            <div className="p-4 border border-slate-100 rounded-2xl flex items-center bg-slate-50">
              <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center mr-4 text-green-600">
                <Calculator className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">Aylık Ödeme</p>
                <p className="text-lg font-bold text-green-700">₺{formatTamSayi(seciliHesap.aylikTaksit)}</p>
                <p className="text-xs text-slate-400">{seciliTaksit} Ay taksit için</p>
              </div>
            </div>

          </div>
        </div>

        {/* Ana İçerik: Tablo ve Sağ Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Sol Kısım: Taksit Tablosu */}
          <div className="lg:col-span-2 bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
            {/* Tablo Başlığı */}
            <div className="flex bg-[#1e3a8a] text-white font-semibold text-sm">
              <div className="flex-1 py-4 px-6 flex items-center">
                <Calendar className="w-4 h-4 mr-2 opacity-70" /> TAKSİT
              </div>
              <div className="flex-1 py-4 px-6 flex items-center justify-center">
                <Calculator className="w-4 h-4 mr-2 opacity-70" /> AYLIK ÖDEME
              </div>
              <div className="flex-1 py-4 px-6 bg-[#ea580c] flex items-center justify-end">
                <CreditCard className="w-4 h-4 mr-2 opacity-70" /> KARTTAN ÇEKİLECEK
              </div>
            </div>
            
            {/* Tablo Satırları */}
            <div className="flex-1 overflow-y-auto">
              {TAKSIT_ORANLARI.map((item) => {
                const isEnAvantajli = item.month === 12;
                const isSelected = seciliTaksit === item.month;
                const hesap = hesapla(item.month, item.rate);

                return (
                  <div 
                    key={item.month}
                    onClick={() => setSeciliTaksit(item.month)}
                    className={`flex border-b border-slate-100 cursor-pointer transition-all duration-200 
                      ${isSelected ? 'bg-blue-50/50 scale-[1.01] shadow-sm z-10 relative' : 'hover:bg-slate-50'}`}
                  >
                    <div className="flex-1 py-4 px-6 flex items-center">
                      {isEnAvantajli ? (
                        <div className="flex items-center">
                          <div className="w-10 h-10 bg-yellow-400 text-white rounded-full flex items-center justify-center mr-4 shadow-sm">
                            <Star className="w-5 h-5 fill-current" />
                          </div>
                          <div>
                            <p className="font-bold text-[#1e3a8a] text-lg">{item.month} Ay</p>
                            <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full mt-1 inline-block">EN AVANTAJLI</span>
                          </div>
                        </div>
                      ) : (
                        <span className="font-bold text-[#1e3a8a] pl-14 text-lg">
                          {item.month === 1 ? 'Tek Çekim' : `${item.month} Ay`}
                        </span>
                      )}
                    </div>
                    
                    <div className="flex-1 py-4 px-6 flex items-center justify-center font-medium text-slate-700 text-lg">
                      {item.month === 1 ? '-' : `₺${formatPara(hesap.aylikTaksit)}`}
                    </div>
                    
                    <div className="flex-1 py-4 px-6 flex items-center justify-end">
                      <span className="font-bold text-[#ea580c] text-lg mr-4">₺{formatPara(hesap.toplamOdenecek)}</span>
                      <ChevronRight className={`w-5 h-5 ${isSelected ? 'text-blue-500' : 'text-slate-300'}`} />
                    </div>
                  </div>
                );
              })}
            </div>
            
            <div className="bg-slate-50 p-4 border-t border-slate-100 text-xs text-slate-500 flex items-center">
              <Info className="w-4 h-4 mr-2 text-blue-400" /> Tüm tutarlar bilgilendirme amaçlıdır. Kartınıza ve bankanıza göre farklılık gösterebilir.
            </div>
          </div>

          {/* Sağ Kısım: Grafikler ve Bilgiler */}
          <div className="space-y-6">
            
            {/* Taksit Grafiği */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
              <h3 className="text-sm font-bold text-slate-800 mb-6">Taksit Grafiği</h3>
              <div className="h-48 w-full relative flex items-end justify-between bg-slate-50/50 rounded-xl pt-10 px-2 pb-6 border-b-2 border-l-2 border-slate-100">
                {TAKSIT_ORANLARI.slice().reverse().filter(t => t.month > 1).map((item, idx) => {
                  // Basit grafik mantığı
                  const min = hesapla(2, TAKSIT_ORANLARI.find(t=>t.month===2)?.rate || 0).toplamOdenecek;
                  const max = hesapla(12, TAKSIT_ORANLARI.find(t=>t.month===12)?.rate || 0).toplamOdenecek;
                  const val = hesapla(item.month, item.rate).toplamOdenecek;
                  const percent = ((val - min) / (max - min)) * 100;
                  
                  return (
                    <div key={item.month} className="flex flex-col items-center justify-end h-full w-full relative group">
                      {/* Çizgi Noktası */}
                      <div 
                        className={`w-3 h-3 rounded-full absolute -ml-1.5 z-10 transition-all ${item.month === seciliTaksit ? 'bg-blue-600 scale-150 ring-4 ring-blue-200' : 'bg-blue-400 group-hover:scale-125'}`}
                        style={{ bottom: `${percent}%` }}
                      ></div>
                      {/* Ara Çizgi (SVG kullanmadan basit CSS yaklaşımı) */}
                      {idx > 0 && <div className="absolute bg-blue-200 h-0.5 w-[200%] -left-full origin-bottom-left -z-0" style={{ bottom: `${percent}%` }}></div>}
                      
                      <span className="text-[10px] text-slate-400 absolute -bottom-5">{item.month} Ay</span>
                      
                      {/* Tooltip (Sadece seçili olanda veya hoverda görünür) */}
                      {item.month === seciliTaksit && (
                        <div className="absolute -top-10 bg-white border border-blue-200 text-blue-700 text-xs font-bold px-2 py-1 rounded shadow-sm z-20 whitespace-nowrap" style={{ bottom: `calc(${percent}% + 15px)` }}>
                          ₺{formatTamSayi(val)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Seçim Detayı */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 text-center flex flex-col items-center justify-center min-h-[200px]">
              {seciliTaksit ? (
                <>
                  <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mb-4">
                    <Search className="w-8 h-8" />
                  </div>
                  <h3 className="font-bold text-slate-800 text-lg mb-1">{seciliTaksit === 1 ? 'Tek Çekim' : `${seciliTaksit} Ay Taksit`} Seçildi</h3>
                  <p className="text-slate-500 text-sm">Aylık ₺{formatPara(seciliHesap.aylikTaksit)} ödeme ile toplam ₺{formatPara(seciliHesap.toplamOdenecek)} tahsil edilecektir.</p>
                </>
              ) : (
                <>
                  <Search className="w-12 h-12 text-slate-200 mb-4" />
                  <p className="text-slate-500 font-medium">Bir taksit seçin</p>
                  <p className="text-slate-400 text-sm mt-1">Detaylar burada görünecek.</p>
                </>
              )}
            </div>

            {/* Neden Taksit? */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
              <h3 className="text-sm font-bold text-slate-800 mb-4">Neden Taksit?</h3>
              <ul className="space-y-4">
                <li className="flex items-start">
                  <Scale className="w-5 h-5 text-blue-500 mr-3 mt-0.5" />
                  <span className="text-sm text-slate-600 font-medium">Nakit akışınızı dengeler</span>
                </li>
                <li className="flex items-start">
                  <TrendingUp className="w-5 h-5 text-blue-500 mr-3 mt-0.5" />
                  <span className="text-sm text-slate-600 font-medium">Satış gücünüzü artırır</span>
                </li>
                <li className="flex items-start">
                  <Clock className="w-5 h-5 text-blue-500 mr-3 mt-0.5" />
                  <span className="text-sm text-slate-600 font-medium">Vade seçenekleriyle esneklik sağlar</span>
                </li>
                <li className="flex items-start">
                  <ShieldCheck className="w-5 h-5 text-blue-500 mr-3 mt-0.5" />
                  <span className="text-sm text-slate-600 font-medium">Komisyonlar şeffaf ve nettir</span>
                </li>
              </ul>
            </div>

          </div>
        </div>

        {/* Alt Aksiyon Butonları */}
        <div className="bg-[#1e3a8a] rounded-2xl flex overflow-hidden shadow-lg mt-8">
          <button onClick={() => window.print()} className="flex-1 py-4 flex items-center justify-center text-white hover:bg-[#1e40af] transition-colors group">
            <Printer className="w-5 h-5 mr-2 opacity-80 group-hover:opacity-100" />
            <span className="font-semibold">Sonucu Yazdır</span>
          </button>
          <div className="w-px bg-blue-800/50"></div>
          <button className="flex-1 py-4 flex items-center justify-center text-white hover:bg-[#1e40af] transition-colors group">
            <Share2 className="w-5 h-5 mr-2 opacity-80 group-hover:opacity-100" />
            <span className="font-semibold">Sonucu Paylaş</span>
          </button>
        </div>

      </div>
    </div>
  );
}
