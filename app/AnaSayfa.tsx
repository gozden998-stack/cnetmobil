import React from 'react';

export default function AnaSayfa({ selectedBranch, setAppMode, config, gidisatData = [] }: any) {
  // Sadece CMR şubelerinde görünmesi için kontrol (Vodafone ve Zumay'da false döner)
  const isCmr = selectedBranch.includes('CMR');

  // --- MAĞAZA GİDİŞAT HESAPLAMALARI ---
  // gidisatData içinden o anki şubenin verisini buluyoruz (Beklenen format: [ŞubeAdı, Hedef, Satılan])
  const currentBranchData = gidisatData.find((row: any) => row[0] === selectedBranch);
  
  const hedef = currentBranchData ? Number(currentBranchData[1]) || 0 : 0;
  const satilan = currentBranchData ? Number(currentBranchData[2]) || 0 : 0;
  const kalan = Math.max(0, hedef - satilan);

  // Tarih ve Projeksiyon Hesaplamaları
  const today = new Date();
  const currentDay = today.getDate(); // Ayın kaçıncı günündeyiz (örn: 15)
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate(); // Bu ay toplam kaç gün çekiyor (örn: 30)

  // (Satılan / Geçen Gün) * Toplam Gün = Ay Sonu Tahmini
  const projeksiyon = currentDay > 0 ? Math.round((satilan / currentDay) * daysInMonth) : 0;
  
  // Projeksiyon hedefe eşit veya büyükse Başarılı, değilse Riskli
  const isBasarili = projeksiyon >= hedef;
  const yuzde = hedef > 0 ? Math.min(100, Math.round((satilan / hedef) * 100)) : 0;

  return (
    <div className="space-y-6 w-full animate-in fade-in duration-500">
        
        {/* Karşılama Ekranı - Premium Hero Banner */}
        <div className="relative overflow-hidden bg-gradient-to-br from-sky-500 to-blue-700 rounded-[2rem] p-8 md:p-10 shadow-lg shadow-sky-900/10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            {/* Arka Plan Dekoratif Işıklandırmalar */}
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
                className="relative z-10 group bg-white text-sky-600 px-7 py-4 rounded-2xl font-bold text-sm tracking-wide shadow-xl hover:shadow-2xl hover:bg-slate-50 transition-all duration-300 flex items-center gap-3 transform hover:-translate-y-1"
            >
                <div className="bg-sky-50 p-2 rounded-xl group-hover:bg-sky-100 transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                </div>
                Cihaz Alımını Başlat
            </button>
        </div>

        {/* --- SADECE CMR ŞUBELERİ İÇİN GÜZELLEŞTİRİLMİŞ GİDİŞAT ALTYAPISI --- */}
        {isCmr && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* DİNAMİK: Mağaza Gidişat Kartı */}
                <div className="relative group overflow-hidden bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 border border-slate-100 dark:border-slate-800 shadow-sm transition-all duration-500 hover:shadow-md hover:border-blue-100">
                    <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
                        <svg className="w-32 h-32 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                    </div>
                    <div className="relative z-10">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-500 flex items-center justify-center">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-tighter">Mağaza Gidişat</h3>
                                    <p className="text-[10px] text-slate-500 font-bold tracking-widest uppercase">{selectedBranch} Performansı</p>
                                </div>
                            </div>
                            
                            {/* Başarılı / Riskli Rozeti */}
                            {hedef > 0 && (
                                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black tracking-widest uppercase shadow-sm ${isBasarili ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-rose-50 text-rose-600 border border-rose-200'}`}>
                                    <span className={`w-2 h-2 rounded-full ${isBasarili ? 'bg-emerald-500' : 'bg-rose-500'} animate-pulse`}></span>
                                    {isBasarili ? 'BAŞARILI' : 'RİSKLİ'}
                                </span>
                            )}
                        </div>

                        {hedef > 0 ? (
                            <div className="space-y-6">
                                {/* İlerleme Çubuğu */}
                                <div>
                                    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest mb-2">
                                        <span className="text-slate-400">Aylık İlerleme</span>
                                        <span className="text-blue-600">%{yuzde}</span>
                                    </div>
                                    <div className="h-3 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                        <div className="h-full bg-blue-500 transition-all duration-1000" style={{ width: `${yuzde}%` }}></div>
                                    </div>
                                </div>

                                {/* İstatistik Rakamları */}
                                <div className="grid grid-cols-3 gap-2 border-y border-slate-100 dark:border-slate-800 py-4">
                                    <div className="text-center">
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Hedef</p>
                                        <p className="text-2xl font-black text-slate-800 dark:text-white italic">{hedef}</p>
                                    </div>
                                    <div className="text-center border-x border-slate-100 dark:border-slate-800">
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Satılan</p>
                                        <p className="text-2xl font-black text-blue-600 italic">{satilan}</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Kalan</p>
                                        <p className="text-2xl font-black text-slate-800 dark:text-white italic">{kalan}</p>
                                    </div>
                                </div>

                                {/* Projeksiyon Uyarı Kutusu */}
                                <div className={`p-4 rounded-2xl border ${isBasarili ? 'bg-emerald-50/50 border-emerald-100' : 'bg-rose-50/50 border-rose-100'} flex justify-between items-center group-hover:shadow-md transition-all`}>
                                    <div>
                                        <p className={`text-[10px] font-black uppercase tracking-widest mb-0.5 ${isBasarili ? 'text-emerald-600' : 'text-rose-600'}`}>Ay Sonu Projeksiyon</p>
                                        <p className={`text-[9px] font-bold uppercase ${isBasarili ? 'text-emerald-500/70' : 'text-rose-500/70'}`}>Mevcut Hıza Göre Tahmin</p>
                                    </div>
                                    <div className="text-right">
                                        <span className={`text-2xl font-black italic tracking-tighter ${isBasarili ? 'text-emerald-600' : 'text-rose-600'}`}>{projeksiyon}</span>
                                        <span className={`text-[10px] font-black uppercase tracking-widest ml-1 ${isBasarili ? 'text-emerald-500' : 'text-rose-500'}`}>Adet</span>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="h-40 flex flex-col items-center justify-center text-center opacity-50 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-200">
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">VERİ BEKLENİYOR</p>
                                <p className="text-[9px] font-bold text-slate-400 uppercase">Google Sheets üzerinden hedef girilmedi</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* STATİK: Personel Gidişat Kartı (Dokunulmadı) */}
                <div className="relative group overflow-hidden bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 border border-slate-100 dark:border-slate-800 shadow-sm transition-all duration-500">
                    <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                        <svg className="w-24 h-24 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                    </div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-500 flex items-center justify-center">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                            </div>
                            <h3 className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-tighter">Personel Gidişat</h3>
                        </div>
                        <div className="flex gap-2">
                            <div className="w-8 h-8 rounded-full bg-slate-50 animate-pulse"></div>
                            <div className="w-8 h-8 rounded-full bg-slate-50 animate-pulse delay-75"></div>
                            <div className="w-8 h-8 rounded-full bg-slate-50 animate-pulse delay-150"></div>
                        </div>
                        <div className="mt-8 flex items-center justify-between">
                            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500 text-white text-[10px] font-black tracking-widest uppercase shadow-lg shadow-emerald-500/30">
                                <span className="w-1.5 h-1.5 bg-white rounded-full animate-ping"></span>
                                Çok Yakında
                            </span>
                        </div>
                    </div>
                </div>

            </div>
        )}

        {/* Alt Bilgi Panelleri */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Duyurular Kartı */}
            <div className="bg-white dark:bg-[#1e293b] rounded-[2rem] p-8 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col">
                <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 rounded-2xl bg-sky-50 dark:bg-sky-900/30 text-sky-500 flex items-center justify-center shrink-0">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Merkez Duyuruları</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Yönetimden gelen son bildirimler</p>
                    </div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-6 flex-1 border border-slate-100 dark:border-slate-800/50">
                    <p className="text-slate-700 dark:text-slate-300 font-medium leading-relaxed whitespace-pre-wrap text-sm md:text-base">
                        {config.Duyuru_Metni || "Şu an için aktif bir mağaza duyurusu bulunmamaktadır."}
                    </p>
                </div>
            </div>

            {/* Kampanyalar Kartı */}
            <div className="bg-white dark:bg-[#1e293b] rounded-[2rem] p-8 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col overflow-hidden relative">
                <div className="flex items-center gap-4 mb-6 relative z-10">
                    <div className="w-12 h-12 rounded-2xl bg-orange-50 dark:bg-orange-900/20 text-orange-500 flex items-center justify-center shrink-0">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" /></svg>
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Aktif Kampanyalar</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Müşteriye sunulacak fırsatlar</p>
                    </div>
                </div>
                <div className="flex-1 flex items-center justify-center bg-gradient-to-r from-orange-500/10 via-orange-500/5 to-transparent rounded-2xl border border-orange-500/20 py-8 relative z-10 overflow-hidden">
                    <div className="whitespace-nowrap animate-marquee font-bold text-xl md:text-2xl tracking-wide text-orange-600 dark:text-orange-400">
                         {config.Kampanya_Metni || "GÜNCEL KAMPANYA BULUNMAMAKTADIR"}
                    </div>
                </div>
            </div>
            
        </div>
    </div>
  );
}
