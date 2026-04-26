import React from 'react';

export default function AnaSayfa({ selectedBranch, setAppMode, config, stats }: any) {
  // Gelen canlı verileri kullanıyoruz
  const bugunkuInceleme = stats?.total || 0;
  const bugunkuAlim = stats?.alindi || 0;
  const bugunkuPas = stats?.alinmadi || 0;
  const basariOrani = bugunkuInceleme > 0 ? Math.round((bugunkuAlim / bugunkuInceleme) * 100) : 0;

  return (
    <div className="space-y-6 w-full animate-in fade-in duration-500">
        
        {/* Karşılama Ekranı - Premium Hero Banner */}
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
                        Cnetmobil Terminal Sistemi V6.0
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

        {/* Canlı Mağaza Performans Özeti */}
        <div className="bg-white dark:bg-[#1e293b] rounded-[2rem] p-8 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center gap-3 mb-6 border-b border-slate-50 dark:border-slate-800 pb-4">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-500 flex items-center justify-center">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                </div>
                <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white uppercase tracking-tight">Bugünkü Şube Performansı</h3>
                    <p className="text-xs text-slate-500">Şu anki giriş yapılan şubenin canlı verileridir</p>
                </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-slate-50 dark:bg-slate-900/50 p-5 rounded-2xl border border-slate-100 dark:border-slate-800/50">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">İncelenen Cihaz</span>
                    <div className="flex items-baseline gap-1 mt-1">
                        <span className="text-3xl font-black text-slate-700 dark:text-slate-200">{bugunkuInceleme}</span>
                        <span className="text-xs font-bold text-slate-400 italic">Adet</span>
                    </div>
                </div>

                <div className="bg-emerald-50/50 dark:bg-emerald-900/10 p-5 rounded-2xl border border-emerald-100/50">
                    <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Satın Alınan</span>
                    <div className="flex items-baseline gap-1 mt-1">
                        <span className="text-3xl font-black text-emerald-600">{bugunkuAlim}</span>
                        <span className="text-xs font-bold text-emerald-400 italic">Adet</span>
                    </div>
                </div>

                <div className="bg-rose-50/50 dark:bg-rose-900/10 p-5 rounded-2xl border border-rose-100/50">
                    <span className="text-[10px] font-bold text-rose-600 uppercase tracking-widest">Alınmayan</span>
                    <div className="flex items-baseline gap-1 mt-1">
                        <span className="text-3xl font-black text-rose-600">{bugunkuPas}</span>
                        <span className="text-xs font-bold text-rose-400 italic">Adet</span>
                    </div>
                </div>

                <div className="flex flex-col justify-center px-2 bg-slate-900 dark:bg-slate-800 p-5 rounded-3xl shadow-xl">
                    <div className="flex justify-between items-end mb-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Başarı Oranı</span>
                        <span className="text-xl font-black text-sky-400">%{basariOrani}</span>
                    </div>
                    <div className="h-2 w-full bg-slate-700 rounded-full overflow-hidden">
                        <div 
                            className="h-full bg-gradient-to-r from-sky-400 to-emerald-400 transition-all duration-1000"
                            style={{ width: `${basariOrani}%` }}
                        ></div>
                    </div>
                </div>
            </div>
        </div>

        {/* Duyurular & Kampanyalar */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="group bg-white dark:bg-[#1e293b] rounded-[2rem] p-8 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col">
                <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 rounded-2xl bg-sky-50 dark:bg-sky-900/30 text-sky-500 flex items-center justify-center shrink-0">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white uppercase tracking-tight">Merkez Duyuruları</h3>
                </div>
                <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-6 flex-1 border border-slate-100 dark:border-slate-800/50">
                    <p className="text-slate-700 dark:text-slate-300 font-medium leading-relaxed whitespace-pre-wrap">
                        {config.Duyuru_Metni || "Aktif duyuru bulunmuyor."}
                    </p>
                </div>
            </div>

            <div className="group bg-white dark:bg-[#1e293b] rounded-[2rem] p-8 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col overflow-hidden relative">
                <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 rounded-2xl bg-orange-50 dark:bg-orange-900/20 text-orange-500 flex items-center justify-center shrink-0">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" /></svg>
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white uppercase tracking-tight">Fırsatlar</h3>
                </div>
                <div className="flex-1 flex items-center justify-center bg-gradient-to-r from-orange-500/10 via-orange-500/5 to-transparent rounded-2xl border border-orange-500/20 py-8 relative overflow-hidden">
                    <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-white dark:from-[#1e293b] to-transparent z-10"></div>
                    <div className="whitespace-nowrap animate-marquee font-bold text-xl md:text-2xl tracking-wide text-orange-600 dark:text-orange-400">
                         {config.Kampanya_Metni || "GÜNCEL KAMPANYA BULUNMAMAKTADIR"}
                    </div>
                    <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white dark:from-[#1e293b] to-transparent z-10"></div>
                </div>
            </div>
        </div>
    </div>
  );
}
