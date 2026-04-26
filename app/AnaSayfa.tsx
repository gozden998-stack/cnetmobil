import React, { useState } from 'react';

export default function AnaSayfa({ selectedBranch, setAppMode, config, stats }: any) {
  // Modal State
  const [showPerformanceModal, setShowPerformanceModal] = useState(false);

  // Sadece CMR Şubelerinde Görünmesi İçin Kontrol
  const isCmr = selectedBranch.includes('CMR');

  // SATIŞ VE HEDEF VERİLERİ (Senin verdiğin rakamlar)
  const gun = new Date().getDate(); 
  const hedefAdet = 230;
  const gerceklesenSatis = 130;
  const kalanAdet = hedefAdet - gerceklesenSatis; // 100 adet
  
  // Ay Sonu Tahmini: (Şu ana kadar satılan / Geçen gün) * 30 Gün
  const aySonuTahmini = Math.round((gerceklesenSatis / gun) * 30);

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
                    <div className="bg-[#FFF4E6] rounded-2xl p-6 border border-orange-100/50">
                        <p className="text-slate-700 font-semibold mb-2">Bu Ay Toplam Satış</p>
                        <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-black text-slate-900">{gerceklesenSatis}</span>
                            <span className="text-slate-600 font-medium">Adet</span>
                        </div>
                    </div>

                    <div className="bg-[#EEF2FF] rounded-2xl p-6 border border-blue-100/50">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-lg">⏳</span>
                            <p className="text-slate-700 font-semibold">Ay Sonu Tahmini Satış</p>
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-baseline gap-2">
                                <span className="text-3xl font-black text-slate-900">{aySonuTahmini}</span>
                                <span className="text-slate-600 font-medium">Adet</span>
                            </div>
                            <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
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

        {/* DETAYLI PERFORMANS MODALI */}
        {showPerformanceModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
                <div className="bg-white rounded-[2rem] w-full max-w-lg shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
                    
                    <div className="bg-slate-900 p-6 text-white flex justify-between items-center">
                        <div>
                            <h3 className="text-xl font-black tracking-tight">{selectedBranch} Gidişat</h3>
                            <p className="text-xs text-sky-400 uppercase tracking-widest mt-1">Aylık Satış Raporu</p>
                        </div>
                        <button onClick={() => setShowPerformanceModal(false)} className="bg-white/10 hover:bg-white/20 p-2 rounded-xl transition-colors">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>

                    <div className="p-6 space-y-4 bg-slate-50">
                        
                        {/* HEDEF VE GİDİŞAT BARLARI */}
                        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 space-y-5">
                            <div>
                                <div className="flex justify-between items-end mb-2">
                                    <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Mağaza Satış Hedefi</span>
                                    <div className="text-right">
                                        <span className="text-blue-600 font-black text-sm">{gerceklesenSatis} / {hedefAdet}</span>
                                        <p className="text-[10px] text-rose-500 font-bold uppercase mt-0.5">Kalan: {kalanAdet} Adet</p>
                                    </div>
                                </div>
                                <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-gradient-to-r from-sky-400 to-blue-500" style={{width: `${(gerceklesenSatis / hedefAdet) * 100}%`}}></div>
                                </div>
                            </div>
                            
                            <div className="border-t border-slate-100 pt-4">
                                <div className="flex justify-between text-xs font-bold mb-2 uppercase tracking-widest text-slate-500">
                                    <span>Rakip Mağaza Satış</span>
                                    <span className="text-orange-500">{performansDetaylari.rakipSatis} Adet</span>
                                </div>
                                <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-orange-400" style={{width: `${(performansDetaylari.rakipSatis / hedefAdet) * 100}%`}}></div>
                                </div>
                            </div>
                        </div>

                        {/* Detay Kartları */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">2. El Satış</span>
                                <p className="text-2xl font-black text-slate-800 mt-1">{performansDetaylari.ikinciElSatis}</p>
                            </div>
                            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">1. El Satış</span>
                                <p className="text-2xl font-black text-slate-800 mt-1">{performansDetaylari.birinciElSatis}</p>
                            </div>
                            <div className="bg-emerald-50 p-4 rounded-2xl shadow-sm border border-emerald-100">
                                <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-widest">2. El Kazanç</span>
                                <p className="text-xl font-black text-emerald-700 mt-1">{performansDetaylari.ikinciElKazanc} ₺</p>
                            </div>
                            <div className="bg-indigo-50 p-4 rounded-2xl shadow-sm border border-indigo-100">
                                <span className="text-[10px] text-indigo-600 font-bold uppercase tracking-widest">Servis Kazanç</span>
                                <p className="text-xl font-black text-indigo-700 mt-1">{performansDetaylari.servisKazanc} ₺</p>
                            </div>
                            <div className="col-span-2 bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex justify-between items-center">
                                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Mevcut Stok Cihaz</span>
                                <p className="text-xl font-black text-slate-800">{performansDetaylari.stokCihaz} Adet</p>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        )}
    </div>
  );
}
