import React from 'react';

export default function AnaSayfa({ selectedBranch, setAppMode, config, gidisatData = [] }: any) {
    // Sadece CMR şubelerinde görünmesi için kontrol
    const isCmr = selectedBranch.includes('CMR');

    // --- GOOGLE SHEETS VERİ AYIKLAMA (PARSING) ---
    // Tablodaki noktalı sayıları (Örn: 500.000) gerçek sayılara dönüştüren yardımcı fonksiyon
    const parseNum = (val: any) => {
        if (!val) return 0;
        const cleanVal = String(val).replace(/\./g, '').replace(/,/g, '');
        return parseInt(cleanVal, 10) || 0;
    };

    let metrics = null;
    
    // gidisatData'dan seçili şubeyi bulup altındaki "HEDEF" ve "SATILAN ADETLER" satırlarını çekiyoruz
    const branchIndex = gidisatData.findIndex((row: any) => row[0] === selectedBranch);
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

    // --- PROJEKSİYON HESAPLAMALARI İÇİN TARİH ---
    const today = new Date();
    const currentDay = today.getDate() || 1; // Ayın kaçıncı günü (bölme hatasını önlemek için || 1)
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate(); // Bu ay kaç çekiyor

    // 4 Kategori için özel kart oluşturan Alt Bileşen (Component)
    const MetricCard = ({ title, data }: { title: string, data: any }) => {
        if (!data) return null;
        
        const { hedef, satilan, isCurrency } = data;
        const kalan = Math.max(0, hedef - satilan);
        const yuzde = hedef > 0 ? Math.min(100, Math.round((satilan / hedef) * 100)) : 0;
        
        // (Satılan / Güncel Gün) * Ayın Toplam Günü = Ay Sonu Projeksiyonu
        const projeksiyon = Math.round((satilan / currentDay) * daysInMonth);
        const isBasarili = projeksiyon >= hedef;

        const formatVal = (v: number) => isCurrency ? `${v.toLocaleString('tr-TR')} ₺` : `${v} Adet`;

        return (
            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-3xl border border-slate-100 dark:border-slate-700 transition-all hover:shadow-md">
                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">{title}</h4>
                
                {/* İlerleme Çubuğu */}
                <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-700 rounded-full mb-4 overflow-hidden">
                    <div className={`h-full transition-all duration-1000 ${isBasarili ? 'bg-emerald-500' : 'bg-blue-500'}`} style={{ width: `${yuzde}%` }}></div>
                </div>

                {/* Satılan / Hedef / Kalan */}
                <div className="grid grid-cols-3 gap-2 mb-4 text-center">
                    <div>
                        <p className="text-[9px] text-slate-400 font-bold uppercase">Satılan</p>
                        <p className={`font-black text-xs sm:text-sm ${isBasarili ? 'text-emerald-600' : 'text-blue-600'}`}>{formatVal(satilan)}</p>
                    </div>
                    <div className="border-x border-slate-200 dark:border-slate-600">
                        <p className="text-[9px] text-slate-400 font-bold uppercase">Hedef</p>
                        <p className="font-black text-xs sm:text-sm text-slate-800 dark:text-slate-200">{formatVal(hedef)}</p>
                    </div>
                    <div>
                        <p className="text-[9px] text-slate-400 font-bold uppercase">Kalan</p>
                        <p className="font-black text-xs sm:text-sm text-slate-800 dark:text-slate-200">{kalan > 0 ? formatVal(kalan) : 'Tamamlandı'}</p>
                    </div>
                </div>

                {/* Ay Sonu Projeksiyonu & Durum */}
                <div className={`p-3 rounded-2xl border flex justify-between items-center ${isBasarili ? 'bg-emerald-50/80 border-emerald-100' : 'bg-rose-50/80 border-rose-100'}`}>
                    <div>
                        <p className={`text-[8px] font-black uppercase tracking-widest mb-0.5 ${isBasarili ? 'text-emerald-600' : 'text-rose-600'}`}>Ay Sonu Tahmini</p>
                        <p className={`text-[11px] font-black italic ${isBasarili ? 'text-emerald-700' : 'text-rose-700'}`}>{formatVal(projeksiyon)}</p>
                    </div>
                    <span className={`px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest shadow-sm ${isBasarili ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}>
                        {isBasarili ? 'BAŞARILI' : 'RİSKLİ'}
                    </span>
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6 w-full animate-in fade-in duration-500">
            
            {/* Karşılama Ekranı - Premium Hero Banner */}
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

            {/* --- SADECE CMR ŞUBELERİ İÇİN GÜZELLEŞTİRİLMİŞ GİDİŞAT ALTYAPISI --- */}
            {isCmr && (
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                    
                    {/* MAĞAZA GİDİŞAT KARTI (Veri alan geniş olduğu için daha fazla yer kaplıyor) */}
                    <div className="xl:col-span-2 relative group overflow-hidden bg-white dark:bg-slate-900 rounded-[2.5rem] p-6 sm:p-8 border border-slate-100 dark:border-slate-800 shadow-sm transition-all duration-500 hover:shadow-md hover:border-blue-100">
                        <div className="relative z-10">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-500 flex items-center justify-center">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-tighter">Mağaza Gidişat Analizi</h3>
                                    <p className="text-[10px] text-slate-500 font-bold tracking-widest uppercase">{selectedBranch} - Hedef/Gerçekleşen</p>
                                </div>
                            </div>
                            
                            {metrics ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <MetricCard title="2. El Cihaz Hedefi" data={metrics.ikinciElAdet} />
                                    <MetricCard title="2. El Cihaz Kazanç (TL)" data={metrics.ikinciElKazanc} />
                                    <MetricCard title="1. El + Tablet Hedefi" data={metrics.birinciElTablet} />
                                    <MetricCard title="Teknik Servis Kazanç (TL)" data={metrics.teknikServis} />
                                </div>
                            ) : (
                                <div className="h-40 flex flex-col items-center justify-center text-center opacity-50 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-dashed border-slate-200">
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">VERİ BEKLENİYOR</p>
                                    <p className="text-[9px] font-bold text-slate-400 uppercase">Google Sheets'ten veri çekilemedi veya şube bulunamadı.</p>
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
