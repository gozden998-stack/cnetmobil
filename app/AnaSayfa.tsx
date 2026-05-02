import React, { useEffect, useState } from 'react';

export default function AnaSayfa({ selectedBranch, setAppMode, config, gidisatData = [] }: any) {
    // --- MODAL (POP-UP) KONTROLLERİ ---
    const [activeModal, setActiveModal] = useState<'tahmin' | 'departman' | null>(null);

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
    
    const anaSatis = metrics?.ikinciElAdet?.satilan || 0;
    const anaHedef = metrics?.ikinciElAdet?.hedef || 0;
    const anaProjeksiyon = Math.round((anaSatis / currentDay) * daysInMonth);
    const anaBasarili = anaProjeksiyon >= anaHedef;

    // Şube Puanı Hesaplama (10 üzerinden, görseldeki 8.5 gibi)
    const subePuani = anaHedef > 0 ? Math.min(10, ((anaSatis / currentDay) * daysInMonth / anaHedef) * 10).toFixed(1) : "0.0";

    // --- MODAL İÇİ BİLEŞENLER (GÜNCELLENDİ) ---
    const DepartmanProgressBar = ({ title, data, colorClass }: any) => {
        if (!data) return null;
        const kalan = Math.max(0, data.hedef - data.satilan);
        const yuzde = data.hedef > 0 ? Math.min(100, Math.round((data.satilan / data.hedef) * 100)) : 0;
        
        // HEDEFE ÖZEL AY SONU PROJEKSİYON HESABI
        const projeksiyon = Math.round((data.satilan / currentDay) * daysInMonth);
        const isBasarili = projeksiyon >= data.hedef;
        
        const formatVal = (v: number) => data.isCurrency ? `${v.toLocaleString('tr-TR')} ₺` : `${v}`;

        return (
            <div className="bg-[#1E293B] border border-slate-700/50 rounded-2xl p-4 flex flex-col justify-between relative overflow-hidden">
                {/* RİSK / BAŞARI ETİKETİ */}
                <div className={`absolute top-0 right-4 text-white text-[8px] font-black px-2 py-0.5 rounded-b-md tracking-widest shadow-sm ${isBasarili ? 'bg-emerald-500' : 'bg-rose-500'}`}>
                    {isBasarili ? 'BAŞARILI GİDİŞAT' : 'RİSKLİ GİDİŞAT'}
                </div>
                
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3 mt-1">{title}</h4>
                
                <div className="flex justify-between items-end mb-2">
                    <p className="text-xl font-black text-white">{formatVal(data.satilan)} <span className="text-xs font-medium text-slate-500">/ {formatVal(data.hedef)}</span></p>
                    <div className="text-right">
                        <p className={`text-[9px] font-black uppercase tracking-wider ${kalan > 0 ? 'text-[#E11D48]' : 'text-emerald-500'}`}>
                            {kalan > 0 ? `Kalan: ${formatVal(kalan)}` : 'TAMAMLANDI'}
                        </p>
                    </div>
                </div>
                
                <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden mb-3">
                    <div className={`h-full ${colorClass} rounded-full transition-all duration-1000`} style={{ width: `${yuzde}%` }}></div>
                </div>
                
                {/* AY SONU TAHMİNİ */}
                <div className="flex justify-between items-center text-[9px] font-bold border-t border-slate-700/50 pt-2.5">
                    <span className="text-slate-500 uppercase">AY SONU TAHMİN:</span>
                    <span className={isBasarili ? 'text-emerald-400' : 'text-rose-400'}>
                        {formatVal(projeksiyon)}
                    </span>
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6 w-full animate-in fade-in duration-500 relative">
            
            {/* Karşılama Ekranı */}
            <div className="relative overflow-hidden bg-gradient-to-br from-sky-500 to-blue-700 rounded-[2rem] p-8 md:p-10 shadow-lg shadow-sky-900/10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-white/20 rounded-full blur-3xl pointer-events-none"></div>
                
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

            {/* --- MAĞAZA GİDİŞAT ALANI --- */}
            {isCmr && (
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                    <div className="xl:col-span-2">
                        
                        <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-6 sm:p-8 border border-slate-100 dark:border-slate-800 shadow-sm">
                            
                            {/* Üst Başlık ve Yeşil Buton */}
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl md:text-2xl font-extrabold text-slate-800 dark:text-white flex items-center gap-2 tracking-tight">
                                    CnetMobil <span className="font-medium text-slate-500 dark:text-slate-400">- {selectedBranch}</span>
                                </h3>
                                <button 
                                    onClick={() => setActiveModal('departman')}
                                    className="bg-[#4CAF50] hover:bg-[#43A047] text-white px-4 py-2 rounded-xl font-black text-lg flex items-center gap-1 transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                                >
                                    {subePuani} <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
                                </button>
                            </div>

                            {/* Ana İki Kart */}
                            {metrics ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 cursor-pointer">
                                    
                                    {/* Sol Kart: Bu Ay Toplam 2. El Satış */}
                                    <div className="bg-[#FDF8F3] border border-[#F2E5D5] rounded-3xl p-5 relative overflow-hidden transition-all hover:shadow-md">
                                        <p className="text-slate-700 font-bold text-sm mb-3">Bu Ay Toplam 2. El Satış</p>
                                        <div className="flex items-baseline gap-1.5">
                                            <span className="text-4xl font-black text-slate-900">{anaSatis}</span>
                                            <span className="text-sm font-bold text-slate-500">Adet</span>
                                        </div>
                                    </div>

                                    {/* Sağ Kart: Ay Sonu Tahmini */}
                                    <div 
                                        onClick={() => setActiveModal('tahmin')}
                                        className="bg-[#FEF2F2] border border-[#FEE2E2] rounded-3xl p-5 relative overflow-hidden transition-all hover:shadow-md hover:border-rose-300 group"
                                    >
                                        {!anaBasarili && (
                                            <div className="absolute top-4 right-4 bg-[#FB7185] text-white text-[9px] px-2.5 py-1 rounded-md font-black tracking-widest uppercase shadow-sm z-10 flex items-center gap-1">
                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                                RİSKLİ GİDİŞAT
                                            </div>
                                        )}
                                        <p className="text-rose-600 font-bold text-sm mb-3 flex items-center gap-2">
                                            <span className="text-lg">⏳</span> Ay Sonu 2. El Tahmini
                                        </p>
                                        <div className="flex justify-between items-end">
                                            <div className="flex items-baseline gap-1.5">
                                                <span className={`text-4xl font-black ${anaBasarili ? 'text-emerald-600' : 'text-[#E11D48]'}`}>{anaProjeksiyon}</span>
                                                <span className={`text-sm font-bold ${anaBasarili ? 'text-emerald-500' : 'text-rose-500'}`}>Adet</span>
                                            </div>
                                            <div className="text-rose-400 group-hover:text-rose-600 transition-colors group-hover:translate-x-1 transform duration-300">
                                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
                                            </div>
                                        </div>
                                    </div>
                                    
                                </div>
                            ) : (
                                <div className="h-24 flex flex-col items-center justify-center text-center opacity-50 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">VERİ BEKLENİYOR</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Personel Gidişat Kartı */}
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

            {/* ========================================================================= */}
            {/* ======================= MODAL EKRANLARI (POP-UPS) ======================= */}
            {/* ========================================================================= */}
            
            {activeModal && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center px-4">
                    {/* Arka Plan Karartması */}
                    <div 
                        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" 
                        onClick={() => setActiveModal(null)}
                    ></div>

                    {/* MODAL 1: TAHMİN DETAYI (Grafiksiz Temiz Versiyon) */}
                    {activeModal === 'tahmin' && (
                        <div className="relative bg-white rounded-3xl w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden flex flex-col">
                            {/* Üst Başlık */}
                            <div className="flex justify-between items-center p-5 border-b border-slate-100">
                                <h3 className="text-lg font-bold text-slate-800">2. El Ay Sonu Tahmini</h3>
                                <button onClick={() => setActiveModal(null)} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>
                            
                            <div className="p-6 space-y-5">
                                {/* Uyarı Kutusu */}
                                {!anaBasarili ? (
                                    <div className="bg-[#FEF2F2] border border-[#FECDD3] rounded-xl p-4 flex gap-3">
                                        <div className="text-[#E11D48] mt-0.5">
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                        </div>
                                        <div>
                                            <h4 className="text-[#E11D48] font-bold text-sm mb-1">Hedefin Gerisindesiniz!</h4>
                                            <p className="text-rose-900/70 text-[11px] leading-relaxed">Mevcut satış hızınıza göre ay sonu tahmini {anaProjeksiyon} adet, hedefinizin ({anaHedef}) altında kalıyor. Satışları artırmanız gerekiyor.</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex gap-3">
                                        <div className="text-emerald-500 mt-0.5">
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                        </div>
                                        <div>
                                            <h4 className="text-emerald-700 font-bold text-sm mb-1">Harika Gidiyorsunuz!</h4>
                                            <p className="text-emerald-600/80 text-[11px] leading-relaxed">Mevcut hızınızla hedefi aşarak ay sonunu {anaProjeksiyon} adetle kapatmanız öngörülüyor.</p>
                                        </div>
                                    </div>
                                )}

                                <div className="flex justify-between items-center bg-slate-50 border border-slate-100 rounded-xl p-5">
                                    <div>
                                        <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-1">Gidişata Göre Ay Sonu</p>
                                        <p className="text-slate-400 text-[11px]">Sistem tarafından hesaplanan net adet</p>
                                    </div>
                                    <div className="flex items-baseline gap-1">
                                        <span className={`text-3xl font-black ${anaBasarili ? 'text-emerald-600' : 'text-[#E11D48]'}`}>{anaProjeksiyon}</span>
                                        <span className="text-slate-500 text-sm font-medium">Adet</span>
                                    </div>
                                </div>
                            </div>

                            <div className="p-4 bg-slate-50 border-t border-slate-100">
                                <button onClick={() => setActiveModal(null)} className="w-full py-3 bg-[#1E293B] hover:bg-slate-800 text-white font-bold rounded-xl transition-colors text-sm">
                                    Kapat
                                </button>
                            </div>
                        </div>
                    )}

                    {/* MODAL 2: DEPARTMAN HEDEFLERİ (Siyah Temalı, Stoksuz, Bütün Baremlerde Hesaplama) */}
                    {activeModal === 'departman' && metrics && (
                        <div className="relative bg-[#0F172A] rounded-[2rem] w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden border border-slate-700/50">
                            {/* Üst Başlık */}
                            <div className="flex justify-between items-start p-6 border-b border-slate-800">
                                <div>
                                    <h3 className="text-xl font-black text-white">{selectedBranch} Departman Hedefleri</h3>
                                    <p className="text-[10px] text-sky-400 font-black tracking-widest uppercase mt-1">GÜNCEL HIZ VE AY SONU PROJEKSİYONLARI</p>
                                </div>
                                <button onClick={() => setActiveModal(null)} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-800 text-slate-400 hover:bg-slate-700 transition-colors">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>

                            <div className="p-6 space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <DepartmanProgressBar title="2. EL CİHAZ SATIŞ" data={metrics.ikinciElAdet} colorClass="bg-sky-500" />
                                    <DepartmanProgressBar title="1. EL CİHAZ SATIŞ" data={metrics.birinciElTablet} colorClass="bg-purple-500" />
                                    <DepartmanProgressBar title="2. EL KAZANÇ" data={metrics.ikinciElKazanc} colorClass="bg-emerald-500" />
                                    <DepartmanProgressBar title="SERVİS KAZANÇ" data={metrics.teknikServis} colorClass="bg-fuchsia-500" />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

        </div>
    );
}
