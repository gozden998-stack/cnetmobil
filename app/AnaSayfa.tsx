import React from 'react';

export default function AnaSayfa({ selectedBranch, setAppMode, config }: any) {
  // Sadece CMR şubelerinde görünmesi için kontrol
  const isCmr = selectedBranch.includes('CMR');

  return (
    <div className="space-y-6 w-full animate-in fade-in duration-500">
        
        {/* Karşılama Ekranı - Marka Renkleri (Görsel 1'deki Orijinal Mavi) */}
        <div className="relative overflow-hidden bg-gradient-to-br from-sky-500 to-blue-700 rounded-[2rem] p-8 md:p-10 shadow-lg shadow-sky-900/10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            {/* Arka Plan Dekoratif Parıltı (Original) */}
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

        {/* --- YENİ: CNETMOBİL AI ASİSTAN BANNER (Mavi Tonlarında) --- */}
        <div className="relative overflow-hidden bg-gradient-to-r from-sky-500 via-blue-700 to-indigo-950 rounded-[2rem] p-8 md:p-10 shadow-2xl flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8 border border-blue-500/20">
            
            {/* Arka Plan Dekoratif Parıltı (Updated to blue) */}
            <div className="absolute top-0 left-1/4 w-64 h-64 bg-sky-400/10 rounded-full blur-[100px] pointer-events-none"></div>
            
            <div className="relative z-10 flex flex-col gap-4 max-w-2xl">
                {/* Şube Bilgisi - Şık Rozet */}
                <div className="inline-flex items-center gap-3 px-4 py-1.5 rounded-full bg-black/20 border border-white/10 text-white text-[10px] font-bold tracking-widest uppercase w-max backdrop-blur-md">
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                    </span>
                    {selectedBranch} AKTİF SİSTEM
                </div>

                <div className="flex items-start gap-4">
                    {/* Sparkle / Yıldız İkonu (White) */}
                    <div className="mt-1 text-white shrink-0">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-7.714 2.143L11 21l-2.286-6.857L1 12l7.714-2.143L11 3z" />
                        </svg>
                    </div>
                    <div>
                        <h2 className="text-2xl md:text-3xl font-black tracking-tight text-white mb-2 uppercase italic">
                            Cnetmobil AI ile Akıllı İşlemler
                        </h2>
                        <p className="text-sky-100/80 font-medium text-sm md:text-base leading-relaxed">
                            Sorduğunuz sorulara göre ihtiyaç analizi yaparak size en uygun çözümü sunacak yapay zeka destekli asistanımızla 
                            cihaz alımı, fiyatlandırma ve teknik servis süreçlerini anında yönetin. Cnetmobil AI her an yanınızda.
                        </p>
                    </div>
                </div>
            </div>

            {/* AI BUTONU */}
            <button 
                onClick={() => setAppMode('bot')} 
                className="relative z-10 group bg-white text-blue-700 px-8 py-5 rounded-2xl font-black text-sm tracking-tighter shadow-2xl hover:shadow-blue-500/20 hover:scale-105 active:scale-95 transition-all duration-300 flex items-center gap-4 shrink-0"
            >
                <div className="text-sky-500 group-hover:rotate-12 transition-transform">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    </svg>
                </div>
                CNETMOBİL AI'A SORU SOR
            </button>
        </div>

        {/* Duyurular & Kampanyalar Kartları (Original and preserved) */}
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
