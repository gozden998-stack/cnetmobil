import React, { useState } from 'react';

export default function AnaSayfa({ selectedBranch, setAppMode, config, stats }: any) {
  // Modal State'leri
  const [showPerformanceModal, setShowPerformanceModal] = useState(false);
  const [showTrendModal, setShowTrendModal] = useState(false);

  // Sadece CMR Şubelerinde Görünmesi İçin Kontrol
  const isCmr = selectedBranch.includes('CMR');

  // GÜNCEL SATIŞ VE HEDEF VERİLERİ (Senin verdiğin rakamlar)
  const performans = {
      puan: 8.5,
      ikinciEl: { hedef: 100, gercek: 50 },
      birinciEl: { hedef: 70, gercek: 30 },
      ikinciElKazanc: { hedef: 500000, gercek: 200000 },
      servisKazanc: { hedef: 100000, gercek: 40000 },
      stok: { hedef: 100, gercek: 40 }
  };

  const today = new Date();
  const gun = today.getDate(); 
  
  // Ay Sonu Tahmini SADECE 2. EL İÇİN: (Şu ana kadar satılan / Geçen gün) * 30 Gün
  const aySonuTahmini = Math.round((performans.ikinciEl.gercek / gun) * 30);

  // Tarih Formatı (Trend Grafiği İçin)
  const aylar = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
  const formatliTarih = `${gun} ${aylar[today.getMonth()]} ${today.getFullYear()}`;

  // Para formatlamak için yardımcı fonksiyon (Örn: 500.000 ₺)
  const formatMoney = (amount: number) => {
      return new Intl.NumberFormat('tr-TR').format(amount);
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
                        {performans.puan}
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Sabit Sol Kart (Sadece 2. El) */}
                    <div className="bg-[#FFF4E6] rounded-2xl p-6 border border-orange-100/50">
                        <p className="text-slate-700 font-semibold mb-2">Bu Ay Toplam 2. El Satış</p>
                        <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-black text-slate-900">{performans.ikinciEl.gercek}</span>
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
                                <p className="text-slate-700 font-semibold group-hover:text-blue-700 transition-colors">Ay Sonu 2. El Tahmini</p>
                            </div>
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-baseline gap-2">
                                <span className="text-3xl font-black text-slate-900 group-hover:text-blue-800 transition-colors">{aySonuTahmini}</span>
                                <span className="text-slate-600 font-medium">Adet</span>
                            </div>
                            <svg className="w-6 h-6 text-blue-500 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* Duyurular & Kampanyalar */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="group bg-white dark:bg-[#1e293b] rounded-[2rem] p-8 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-sky-200 transition-all duration-300 flex flex-col">
                <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 rounded-2xl bg-sky-50 text-sky-500 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Merkez Duyuruları</h3>
                        <p className="text-sm text-slate-500">Yönetimden gelen son bildirimler</p>
                    </div>
                </div>
                <div className="bg-slate-50 rounded-2xl p-6 flex-1 border border-slate-100 group-hover:bg-sky-50/50 transition-colors duration-300">
                    <p className="text-slate-700 font-medium leading-relaxed whitespace-pre-wrap text-sm md:text-base">
                        {config.Duyuru_Metni || "Şu an için aktif bir mağaza duyurusu bulunmamaktadır."}
                    </p>
                </div>
            </div>

            <div className="group bg-white dark:bg-[#1e293b] rounded-[2rem] p-8 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-orange-200 transition-all duration-300 flex flex-col overflow-hidden relative">
                <div className="flex items-center gap-4 mb-6 relative z-10">
                    <div className="w-12 h-12 rounded-2xl bg-orange-50 text-orange-500 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" /></svg>
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Aktif Kampanyalar</h3>
                        <p className="text-sm text-slate-500">Müşteriye sunulacak fırsatlar</p>
                    </div>
                </div>
                
                <div className="flex-1 flex items-center justify-center bg-gradient-to-r from-orange-500/10 via-orange-500/5 to-transparent rounded-2xl border border-orange-500/20 py-8 relative z-10 overflow-hidden">
                    <div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-orange-50/90 to-transparent z-20 pointer-events-none"></div>
                    <div className="whitespace-nowrap animate-marquee font-bold text-xl md:text-2xl tracking-wide text-orange-600 px-4">
                         {config.Kampanya_Metni || "GÜNCEL KAMPANYA BULUNMAMAKTADIR"}
                    </div>
                    <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-orange-50/0 to-transparent z-20 pointer-events-none"></div>
                </div>
            </div>
        </div>

        {/* TREND / GİDİŞAT GRAFİĞİ MODALI (Sadece 2. El İçin) */}
        {showTrendModal && (
            <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
                <div className="bg-white rounded-[2rem] w-full max-w-md shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
                    
                    <div className="p-6 border-b border-slate-100">
                        <div className="flex justify-between items-start mb-4">
                            <h3 className="text-xl font-bold text-slate-800 tracking-tight">2. El Ay Sonu Tahmini</h3>
                            <button onClick={() => setShowTrendModal(false)} className="text-slate-400 hover:text-slate-600 bg-slate-100 p-2 rounded-full transition-colors">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <div className="flex items-center gap-2 text-sky-600 font-bold mb-2">
                            <span>🚀</span> Hedefinizi Şimdiden Görün
                        </div>
                        <p className="text-sm text-slate-500 leading-relaxed mb-4">
                            Son 30 gün baz alınarak hesaplanan ay sonu 2. El satış tahmininizi anlık olarak takip edin.
                        </p>
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-slate-600">Tahmini Adet:</span>
                            <span className="text-xl font-black text-slate-900 flex items-center gap-1">⏳ {aySonuTahmini} <span className="text-sm font-medium text-slate-500">Adet</span></span>
                        </div>
                    </div>

                    <div className="p-6 bg-slate-50">
                        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                            <div className="flex justify-between items-center mb-6">
                                <div className="flex items-center gap-3">
                                    <button className="text-slate-400 hover:text-slate-800"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg></button>
                                    <span className="font-semibold text-slate-700 text-sm">{formatliTarih}</span>
                                    <button className="text-slate-400 hover:text-slate-800"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg></button>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Gerçek: {performans.ikinciEl.gercek}</p>
                                    <p className="text-[10px] font-bold text-sky-500 uppercase tracking-widest">Tahmini: {aySonuTahmini}</p>
                                </div>
                            </div>

                            <div className="relative h-48 w-full">
                                <div className="absolute left-0 top-0 bottom-0 w-8 flex flex-col justify-between text-[10px] text-slate-400 font-medium font-mono z-10">
                                    <span>{performans.ikinciEl.hedef}</span>
                                    <span>{Math.round(performans.ikinciEl.hedef * 0.75)}</span>
                                    <span>{Math.round(performans.ikinciEl.hedef * 0.5)}</span>
                                    <span>{Math.round(performans.ikinciEl.hedef * 0.25)}</span>
                                    <span>0</span>
                                </div>
                                
                                <div className="ml-8 h-full relative">
                                    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full border-b border-l border-slate-200">
                                        <line x1="0" y1="25" x2="100" y2="25" stroke="#f1f5f9" strokeWidth="0.5" />
                                        <line x1="0" y1="50" x2="100" y2="50" stroke="#f1f5f9" strokeWidth="0.5" />
                                        <line x1="0" y1="75" x2="100" y2="75" stroke="#f1f5f9" strokeWidth="0.5" />

                                        <polygon points="0,100 0,90 20,85 40,70 60,55 75,45 75,100" fill="url(#blueGradient)" />
                                        <polyline points="0,90 20,85 40,70 60,55 75,45" fill="none" stroke="#0ea5e9" strokeWidth="1.5" />
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

        {/* DETAYLI PERFORMANS MODALI (Yeşil Buton) - YENİ TASARIM */}
        {showPerformanceModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
                <div className="bg-white rounded-[2rem] w-full max-w-xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
                    
                    <div className="bg-slate-900 p-6 text-white flex justify-between items-center">
                        <div>
                            <h3 className="text-xl font-black tracking-tight">{selectedBranch} Departman Hedefleri</h3>
                            <p className="text-xs text-sky-400 uppercase tracking-widest mt-1">Aylık Detaylı Rapor</p>
                        </div>
                        <button onClick={() => setShowPerformanceModal(false)} className="bg-white/10 hover:bg-white/20 p-2 rounded-xl transition-colors">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>

                    <div className="p-6 bg-slate-50 grid grid-cols-1 md:grid-cols-2 gap-4">
                        
                        {/* 1. KART: 2. EL SATIŞ */}
                        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-center">
                            <div className="flex justify-between items-end mb-3">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">2. El Cihaz Satış</span>
                                <div className="text-right">
                                    <span className="text-blue-600 font-black text-sm">{performans.ikinciEl.gercek} <span className="text-slate-400">/ {performans.ikinciEl.hedef}</span></span>
                                    <p className="text-[9px] text-slate-400 font-bold uppercase mt-0.5">Kalan: {performans.ikinciEl.hedef - performans.ikinciEl.gercek} Adet</p>
                                </div>
                            </div>
                            <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full bg-blue-500" style={{width: `${(performans.ikinciEl.gercek / performans.ikinciEl.hedef) * 100}%`}}></div>
                            </div>
                        </div>

                        {/* 2. KART: 1. EL SATIŞ */}
                        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-center">
                            <div className="flex justify-between items-end mb-3">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">1. El Cihaz Satış</span>
                                <div className="text-right">
                                    <span className="text-indigo-600 font-black text-sm">{performans.birinciEl.gercek} <span className="text-slate-400">/ {performans.birinciEl.hedef}</span></span>
                                    <p className="text-[9px] text-slate-400 font-bold uppercase mt-0.5">Kalan: {performans.birinciEl.hedef - performans.birinciEl.gercek} Adet</p>
                                </div>
                            </div>
                            <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full bg-indigo-500" style={{width: `${(performans.birinciEl.gercek / performans.birinciEl.hedef) * 100}%`}}></div>
                            </div>
                        </div>

                        {/* 3. KART: 2. EL KAZANÇ */}
                        <div className="bg-emerald-50/50 p-5 rounded-2xl shadow-sm border border-emerald-100 flex flex-col justify-center">
                            <div className="flex justify-between items-end mb-3">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-700">2. El Kazanç</span>
                                <div className="text-right">
                                    <span className="text-emerald-600 font-black text-sm">{formatMoney(performans.ikinciElKazanc.gercek)} ₺</span>
                                    <p className="text-[9px] text-emerald-500/80 font-bold uppercase mt-0.5">Kalan: {formatMoney(performans.ikinciElKazanc.hedef - performans.ikinciElKazanc.gercek)} ₺</p>
                                </div>
                            </div>
                            <div className="h-2.5 w-full bg-white rounded-full overflow-hidden border border-emerald-100">
                                <div className="h-full bg-emerald-500" style={{width: `${(performans.ikinciElKazanc.gercek / performans.ikinciElKazanc.hedef) * 100}%`}}></div>
                            </div>
                        </div>

                        {/* 4. KART: SERVİS KAZANÇ */}
                        <div className="bg-violet-50/50 p-5 rounded-2xl shadow-sm border border-violet-100 flex flex-col justify-center">
                            <div className="flex justify-between items-end mb-3">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-violet-700">Servis Kazanç</span>
                                <div className="text-right">
                                    <span className="text-violet-600 font-black text-sm">{formatMoney(performans.servisKazanc.gercek)} ₺</span>
                                    <p className="text-[9px] text-violet-500/80 font-bold uppercase mt-0.5">Kalan: {formatMoney(performans.servisKazanc.hedef - performans.servisKazanc.gercek)} ₺</p>
                                </div>
                            </div>
                            <div className="h-2.5 w-full bg-white rounded-full overflow-hidden border border-violet-100">
                                <div className="h-full bg-violet-500" style={{width: `${(performans.servisKazanc.gercek / performans.servisKazanc.hedef) * 100}%`}}></div>
                            </div>
                        </div>

                        {/* 5. KART: MEVCUT STOK (Tam Genişlik) */}
                        <div className="col-span-1 md:col-span-2 bg-slate-800 p-5 rounded-2xl shadow-md border border-slate-700 flex flex-col justify-center">
                            <div className="flex justify-between items-end mb-3">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-300">Stoktaki Cihaz Sayısı</span>
                                <div className="text-right">
                                    <span className="text-white font-black text-sm">{performans.stok.gercek} <span className="text-slate-500">/ {performans.stok.hedef}</span></span>
                                    <p className="text-[9px] text-slate-400 font-bold uppercase mt-0.5">Hedefe Kalan: {performans.stok.hedef - performans.stok.gercek} Adet</p>
                                </div>
                            </div>
                            <div className="h-2.5 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-700">
                                <div className="h-full bg-gradient-to-r from-slate-500 to-white" style={{width: `${(performans.stok.gercek / performans.stok.hedef) * 100}%`}}></div>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        )}
    </div>
  );
}
