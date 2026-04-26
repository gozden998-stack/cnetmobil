import React, { useState } from 'react';

export default function AnaSayfa({ selectedBranch, setAppMode, config, stats }: any) {
  // Modal State'leri
  const [showPerformanceModal, setShowPerformanceModal] = useState(false);
  const [showTrendModal, setShowTrendModal] = useState(false); // Yeni Grafik Modalı

  // Sadece CMR Şubelerinde Görünmesi İçin Kontrol
  const isCmr = selectedBranch.includes('CMR');

  // SATIŞ VE HEDEF VERİLERİ (Örnek rakamlar)
  const today = new Date();
  const gun = today.getDate(); 
  const hedefAdet = 230;
  const gerceklesenSatis = 130;
  const kalanAdet = hedefAdet - gerceklesenSatis;
  
  // Ay Sonu Tahmini: (Şu ana kadar satılan / Geçen gün) * 30 Gün
  const aySonuTahmini = Math.round((gerceklesenSatis / gun) * 30);

  // Tarih Formatı (Örn: 26 Nisan 2026)
  const aylar = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
  const formatliTarih = `${gun} ${aylar[today.getMonth()]} ${today.getFullYear()}`;

  // Detaylı Performans Verileri
  const performansDetaylari = {
      puan: 8.5,
      ikinciElSatis: gerceklesenSatis,
      birinciElSatis: 45,
      ikinciElKazanc: "124.500",
      servisKazanc: "38.250",
      rakipSatis: 85,
      stokCihaz: 112
  };

  return (
    <div className="space-y-6 w-full animate-in fade-in duration-500">
        
        {/* Karşılama Ekranı */}
        <div className="relative overflow-hidden bg-gradient-to-br from-sky-500 to-blue-700 rounded-[2rem] p-8 md:p-10 shadow-lg shadow-sky-900/10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-white/20 rounded-full blur-3xl pointer-events-none"></div>
            <div className="absolute bottom-0 right-32 w-32 h-32 bg-sky-300/30 rounded-full blur-2xl pointer-events-none"></div>
            
            <div className="relative z-10 flex flex-col gap-3">
                <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-white/10 border border-white/20 text-white text-xs font-semibold tracking-wider uppercase w-max backdrop-blur-sm shadow-inner">
                    <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500 shadow-[0_0_8px_rgba(34,197,94,1)]"></span>
                    </span>
                    {selectedBranch} Şubesi Aktif
                </div>
                <div>
                    <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-white mb-1">
                        İyi Çalışmalar, <span className="font-light opacity-90">Hayırlı İşler</span>
                    </h2>
                    <p className="text-sky-100 font-medium text-sm md:text-base opacity-90">
                        Cnetmobil Terminal Sistemi V2.0
                    </p>
                </div>
            </div>

            <button 
                onClick={() => setAppMode('alim')} 
                className="relative z-10 group bg-white text-sky-600 px-7 py-4 rounded-2xl font-bold text-sm tracking-wide shadow-xl hover:shadow-2xl hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-sky-300/50 transition-all duration-300 flex items-center gap-3 transform hover:-translate-y-1"
            >
                <div className="bg-sky-50 p-2 rounded-xl group-hover:bg-sky-100 transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                </div>
                Cihaz Alımını Başlat
            </button>
        </div>

        {/* CMR MAĞAZA PERFORMANS WIDGET'I */}
        {isCmr && (
            <div className="bg-white rounded-[2rem] p-6 md:p-8 shadow-sm border border-slate-100 animate-in slide-in-from-bottom-4">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl md:text-3xl font-bold text-slate-800 tracking-tight">
                        CnetMobil - <span className="font-medium text-slate-600">{selectedBranch}</span>
                    </h2>
                    <button 
                        onClick={() => setShowPerformanceModal(true)}
                        className="bg-[#53a653] hover:bg-[#448c44] text-white px-5 py-2 rounded-xl text-2xl font-bold flex items-center gap-2 transition-all active:scale-95 shadow-md shadow-green-900/20"
                    >
                        {performansDetaylari.puan}
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Sabit Sol Kart */}
                    <div className="bg-[#FFF4E6] rounded-2xl p-6 border border-orange-100/50">
                        <p className="text-slate-700 font-semibold mb-2">Bu Ay Toplam 2.El Satış</p>
                        <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-black text-slate-900">{gerceklesenSatis}</span>
                            <span className="text-slate-600 font-medium">Adet</span>
                        </div>
                    </div>

                    {/* TIKLANABİLİR Sağ Kart (Grafiği Açar) */}
                    <div 
                        onClick={() => setShowTrendModal(true)}
                        className="bg-[#EEF2FF] hover:bg-indigo-50 cursor-pointer rounded-2xl p-6 border border-blue-100/50 transition-colors group"
                    >
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <span className="text-lg">⏳</span>
                                <p className="text-slate-700 font-semibold group-hover:text-blue-700 transition-colors">Ay Sonu Tahmini Satış</p>
                            </div>
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-baseline gap-2">
                                <span className="text-3xl font-black text-slate-900 group-hover:text-blue-800 transition-colors">{aySonuTahmini}</span>
                                <span className="text-slate-600 font-medium">Adet</span>
                            </div>
                            {/* Tıklanabilir olduğunu belli eden ikon */}
                            <svg className="w-6 h-6 text-blue-500 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* ... (Duyurular ve Kampanyalar Kodları Aynı Kalacak) ... */}

        {/* YENİ: TREND / GİDİŞAT GRAFİĞİ MODALI */}
        {showTrendModal && (
            <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
                <div className="bg-white rounded-[2rem] w-full max-w-md shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
                    
                    {/* Üst Bilgi Alanı */}
                    <div className="p-6 border-b border-slate-100">
                        <div className="flex justify-between items-start mb-4">
                            <h3 className="text-xl font-bold text-slate-800 tracking-tight">Ay Sonu Tahmini Satış</h3>
                            <button onClick={() => setShowTrendModal(false)} className="text-slate-400 hover:text-slate-600 bg-slate-100 p-2 rounded-full">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <div className="flex items-center gap-2 text-sky-600 font-bold mb-2">
                            <span>🚀</span> Hedefinizi Şimdiden Görün
                        </div>
                        <p className="text-sm text-slate-500 leading-relaxed mb-4">
                            Son 30 gün baz alınarak hesaplanan ay sonu 2. El satış tahmininizi anlık olarak takip edin ve hedeflerinizi erkenden şekillendirin.
                        </p>
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-slate-600">Ay Sonu Tahmini Adet:</span>
                            <span className="text-xl font-black text-slate-900 flex items-center gap-1">⏳ {aySonuTahmini} <span className="text-sm font-medium text-slate-500">Adet</span></span>
                        </div>
                    </div>

                    {/* Grafik Alanı */}
                    <div className="p-6 bg-slate-50">
                        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                            {/* Grafik Başlığı ve Tarih Seçici */}
                            <div className="flex justify-between items-center mb-6">
                                <div className="flex items-center gap-3">
                                    <button className="text-slate-400 hover:text-slate-800"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg></button>
                                    <span className="font-semibold text-slate-700">{formatliTarih}</span>
                                    <button className="text-slate-400 hover:text-slate-800"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg></button>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Gerçek: {gerceklesenSatis}</p>
                                    <p className="text-[10px] font-bold text-sky-500 uppercase tracking-widest">Tahmini: {aySonuTahmini}</p>
                                </div>
                            </div>

                            {/* SVG Grafik */}
                            <div className="relative h-48 w-full">
                                {/* Y Ekseni Değerleri */}
                                <div className="absolute left-0 top-0 bottom-0 w-8 flex flex-col justify-between text-[10px] text-slate-400 font-medium font-mono z-10">
                                    <span>250</span>
                                    <span>200</span>
                                    <span>150</span>
                                    <span>100</span>
                                    <span>50</span>
                                    <span>0</span>
                                </div>
                                
                                {/* Çizim Alanı */}
                                <div className="ml-8 h-full relative">
                                    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full border-b border-l border-slate-200">
                                        {/* Arka Plan Izgaraları */}
                                        <line x1="0" y1="20" x2="100" y2="20" stroke="#f1f5f9" strokeWidth="0.5" />
                                        <line x1="0" y1="40" x2="100" y2="40" stroke="#f1f5f9" strokeWidth="0.5" />
                                        <line x1="0" y1="60" x2="100" y2="60" stroke="#f1f5f9" strokeWidth="0.5" />
                                        <line x1="0" y1="80" x2="100" y2="80" stroke="#f1f5f9" strokeWidth="0.5" />

                                        {/* Gerçekleşen Satış Alanı (Açık Mavi Gradient - Cnetmobil) */}
                                        <polygon points="0,100 0,90 20,85 40,70 60,55 75,45 75,100" fill="url(#blueGradient)" />
                                        <polyline points="0,90 20,85 40,70 60,55 75,45" fill="none" stroke="#0ea5e9" strokeWidth="1.5" />

                                        {/* Gelecek Tahmini Alanı (Koyu Gri Temsili) */}
                                        <polygon points="75,100 75,45 85,45 100,10 100,100" fill="#334155" />

                                        <defs>
                                            <linearGradient id="blueGradient" x1="0" x2="0" y1="0" y2="1">
                                                <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.8"/>
                                                <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.1"/>
                                            </linearGradient>
                                        </defs>
                                    </svg>
                                </div>
                            </div>
                        </div>

                        {/* Alt Buton */}
                        <button 
                            onClick={() => setShowTrendModal(false)}
                            className="w-full mt-6 bg-sky-500 hover:bg-sky-400 text-white font-bold text-lg py-4 rounded-xl transition-all shadow-lg shadow-sky-500/30"
                        >
                            Kapat
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* ... (Mevcut Yeşil Buton Performans Modalı Kodu Burada Kalacak) ... */}

    </div>
  );
}
