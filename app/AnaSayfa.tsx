import React, { useEffect, useState } from 'react';

export default function AnaSayfa({ selectedBranch, setAppMode, config, gidisatData = [] }: any) {
    // Detay panelinin açılıp kapanması için durum kontrolü
    const [hedefleriGoster, setHedefleriGoster] = useState(false);

    useEffect(() => {
        console.log("=== SİSTEME SEÇİLİ OLAN ŞUBE ===", selectedBranch);
        console.log("=== GOOGLE SHEETS'TEN GELEN GİDİŞAT VERİSİ ===", gidisatData);
    }, [gidisatData, selectedBranch]);

    const isCmr = selectedBranch.includes('CMR');

    const parseNum = (val: any) => {
        if (!val) return 0;
        const cleanVal = String(val).replace(/\./g, '').replace(/,/g, '');
        return parseInt(cleanVal, 10) || 0;
    };

    let metrics = null;
    
    const branchIndex = gidisatData.findIndex((row: any) => 
        row[0] && typeof row[0] === 'string' && 
        row[0].trim().toUpperCase() === selectedBranch.trim().toUpperCase()
    );

    if (branchIndex !== -1 && gidisatData[branchIndex + 1] && gidisatData[branchIndex + 2]) {
        const hedefRow = gidisatData[branchIndex + 1];
        const satilanRow = gidisatData[branchIndex + 2];
        
        metrics = {
            ikinciElAdet: { hedef: parseNum(hedefRow[1]), satilan: parseNum(satilanRow[1]), isCurrency: false },
            ikinciElKazanc: { hedef: parseNum(hedefRow[2]), satilan: parseNum(satilanRow[2]), isCurrency: true },
            birinciElTablet: { hedef: parseNum(hedefRow[3]), satilan: parseNum(satilanRow[3]), isCurrency: false },
            teknikServis: { hedef: parseNum(hedefRow[4]), satilan: parseNum(satilanRow[4]), isCurrency: true }
        };
    }

    // --- TARİH VE PROJEKSİYON HESAPLAMALARI ---
    const today = new Date();
    const currentDay = today.getDate() || 1; 
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate(); 
    
    const formatliTarih = today.toLocaleDateString('tr-TR', { 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric', 
        weekday: 'long' 
    });

    const anaSatis = metrics?.ikinciElAdet?.satilan || 0;
    const anaHedef = metrics?.ikinciElAdet?.hedef || 0;
    const anaProjeksiyon = Math.round((anaSatis / currentDay) * daysInMonth);
    const anaBasarili = anaProjeksiyon >= anaHedef;

    // Alt detaylar için sadeleştirilmiş metrik kartı bileşeni
    const MiniMetricCard = ({ title, data, icon }: { title: string, data: any, icon: any }) => {
        if (!data) return null;
        const { hedef, satilan, isCurrency } = data;
        const kalan = Math.max(0, hedef - satilan);
        const yuzde = hedef > 0 ? Math.min(100, Math.round((satilan / hedef) * 100)) : 0;
        const formatVal = (v: number) => isCurrency ? `${v.toLocaleString('tr-TR')} ₺` : `${v}`;

        return (
            <div className="bg-slate-50 dark:bg-slate-800/80 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 flex flex-col justify-between hover:border-sky-200 transition-colors group">
                <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-white dark:bg-slate-700 flex items-center justify-center text-sky-500 shadow-sm group-hover:bg-sky-50 transition-colors">
                        {icon}
                    </div>
                    <h4 className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{title}</h4>
                </div>
                
                <div className="flex justify-between items-end mb-2">
                    <div>
                        <p className="text-[10px] text-slate-400 font-semibold uppercase mb-0.5">Satılan</p>
                        <p className="text-xl font-black text-slate-800 dark:text-white">{formatVal(satilan)}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] text-slate-400 font-semibold uppercase mb-0.5">Hedef</p>
                        <p className="text-sm font-bold text-slate-600 dark:text-slate-300">{formatVal(hedef)}</p>
                    </div>
                </div>

                <div className="relative h-1.5 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden mt-1">
                    <div className="absolute top-0 left-0 h-full bg-sky-500 transition-all duration-1000 rounded-full" style={{ width: `${yuzde}%` }}></div>
                </div>
                <div className="text-right mt-1.5">
                    <span className="text-[9px] font-bold text-slate-400">Kalan: <span className={kalan > 0 ? "text-rose-500" : "text-emerald-500"}>{kalan > 0 ? formatVal(kalan) : 'Tamamlandı'}</span></span>
                </div>
            </div>
        );
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
                    className="relative z-10 group bg-white text-sky-600 px-7 py-4 rounded-2xl font-bold text-sm tracking-wide shadow-xl hover:shadow-2xl hover:bg-slate-50 transition-all duration-300 flex items-center gap-3 transform hover:-translate-y-1"
                >
                    <div className="bg-sky-50 p-2 rounded-xl group-hover:bg-sky-100 transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                    </div>
                    Cihaz Alımını Başlat
                </button>
            </div>

            {/* --- GÜNCELLENEN İÇİNDEN GENİŞLEYEN MAĞAZA GİDİŞAT KARTI --- */}
            {isCmr && (
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                    <div className="xl:col-span-2">
                        
                        {/* Kendi İçinde Büyüyen Ana Kart */}
                        <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-6 sm:p-8 border border-slate-100 dark:border-slate-800 shadow-sm transition-all duration-500 hover:shadow-md">
                            
                            {/* Başlık ve Buton Alanı */}
                            <div className="flex justify-between items-start sm:items-center mb-6 flex-col sm:flex-row gap-4">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-900/30 text-blue-500 flex items-center justify-center shrink-0">
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                                    </div>
                                    <div>
                                        <h3 className="text-xl md:text-2xl font-black text-slate-800 dark:text-white flex items-center gap-2">
                                            Mağaza Gidişat <span className="font-normal text-slate-400 text-lg hidden sm:inline">- {selectedBranch}</span>
                                        </h3>
                                        <p className="text-xs font-semibold text-slate-500 mt-0.5 uppercase tracking-wider flex items-center gap-1.5">
                                            <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                            {formatliTarih}
                                        </p>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => setHedefleriGoster(!hedefleriGoster)}
                                    className={`px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 transition-all border ${
                                        hedefleriGoster 
                                        ? 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300' 
                                        : 'bg-emerald-500 text-white border-emerald-500 hover:bg-emerald-600 shadow-md hover:shadow-lg'
                                    }`}
                                >
                                    {hedefleriGoster ? 'Özete Dön' : 'Tüm Hedefleri Gör'}
                                    <svg className={`w-4 h-4 transition-transform duration-300 ${hedefleriGoster ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" /></svg>
                                </button>
                            </div>

                            {metrics ? (
                                <div className="space-y-6">
                                    {/* HER ZAMAN GÖRÜNEN SABİT ALAN: ÖZET KARTLAR */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="bg-orange-50/50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-900/30 rounded-[1.5rem] p-5 relative overflow-hidden group hover:border-orange-200 transition-colors">
                                            <div className="flex justify-between items-start mb-2 relative z-10">
                                                <p className="text-orange-800/70 dark:text-orange-200/70 font-bold text-xs uppercase tracking-wider">Bu Ay 2. El Satış</p>
                                                <span className="text-orange-500 bg-orange-100 dark:bg-orange-900/50 px-2 py-0.5 rounded text-[10px] font-bold">GERÇEKLEŞEN</span>
                                            </div>
                                            <div className="flex items-baseline gap-1.5 relative z-10">
                                                <span className="text-4xl font-black text-orange-600 dark:text-orange-400">{anaSatis}</span>
                                                <span className="text-sm font-bold text-orange-400">Adet</span>
                                            </div>
                                            <div className="mt-3 relative z-10 flex items-center gap-2">
                                                <div className="h-1.5 flex-1 bg-orange-100 dark:bg-orange-900/30 rounded-full overflow-hidden">
                                                    <div className="h-full bg-orange-500 rounded-full" style={{ width: `${Math.min(100, (anaSatis/anaHedef)*100)}%` }}></div>
                                                </div>
                                                <span className="text-[10px] font-bold text-orange-500">{Math.round((anaSatis/anaHedef)*100)}%</span>
                                            </div>
                                            <svg className="absolute -bottom-4 -right-4 w-24 h-24 text-orange-500 opacity-5 group-hover:scale-110 transition-transform" fill="currentColor" viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                                        </div>

                                        <div className={`${anaBasarili ? 'bg-emerald-50/50 border-emerald-100' : 'bg-rose-50/50 border-rose-100'} rounded-[1.5rem] p-5 relative overflow-hidden group transition-colors`}>
                                            <div className="flex justify-between items-start mb-2 relative z-10">
                                                <p className={`font-bold text-xs uppercase tracking-wider ${anaBasarili ? 'text-emerald-800/70' : 'text-rose-800/70'}`}>Ay Sonu 2. El Tahmini</p>
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${anaBasarili ? 'text-emerald-600 bg-emerald-100' : 'text-rose-600 bg-rose-100 animate-pulse'}`}>
                                                    {anaBasarili ? 'RİSK YOK' : 'RİSKLİ GİDİŞAT'}
                                                </span>
                                            </div>
                                            <div className="flex items-baseline gap-1.5 relative z-10">
                                                <span className={`text-4xl font-black ${anaBasarili ? 'text-emerald-600' : 'text-rose-600'}`}>{anaProjeksiyon}</span>
                                                <span className={`text-sm font-bold ${anaBasarili ? 'text-emerald-400' : 'text-rose-400'}`}>Adet Tahmin</span>
                                            </div>
                                            <p className={`text-[10px] mt-3 font-semibold ${anaBasarili ? 'text-emerald-600/70' : 'text-rose-600/70'}`}>
                                                Güncel hıza göre hedeften {Math.abs(anaProjeksiyon - anaHedef)} adet {anaBasarili ? 'fazla satılacak' : 'eksik kalınacak'}
                                            </p>
                                        </div>
                                    </div>

                                    {/* AÇILIR KAPANIR DETAY PANELİ (Kartın İçinden Genişler) */}
                                    <div className={`transition-all duration-500 ease-in-out overflow-hidden origin-top ${hedefleriGoster ? 'max-h-[1000px] opacity-100 mt-6' : 'max-h-0 opacity-0 mt-0'}`}>
                                        <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
                                            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                                <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                                                Tüm Mağaza Hedef Detayları
                                            </h4>
                                            
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                <MiniMetricCard 
                                                    title="2. El Cihaz Satışı" 
                                                    data={metrics.ikinciElAdet} 
                                                    icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>}
                                                />
                                                <MiniMetricCard 
                                                    title="2. El Cihaz Kazancı" 
                                                    data={metrics.ikinciElKazanc} 
                                                    icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                                                />
                                                <MiniMetricCard 
                                                    title="1. El + Tablet Satışı" 
                                                    data={metrics.birinciElTablet} 
                                                    icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>}
                                                />
                                                <MiniMetricCard 
                                                    title="Teknik Servis Kazancı" 
                                                    data={metrics.teknikServis} 
                                                    icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="h-32 flex flex-col items-center justify-center text-center opacity-50 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-dashed border-slate-200">
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">VERİ BEKLENİYOR</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Personel Gidişat Kartı (Dokunulmadı) */}
                    <div className="relative group overflow-hidden bg-white dark:bg-slate-900 rounded-[2.5rem] p-6 sm:p-8 border border-slate-100 dark:border-slate-800 shadow-sm transition-all duration-500">
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
