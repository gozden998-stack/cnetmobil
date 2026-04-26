import React from 'react';

// Ana sayfanın çalışması için dışarıdan alması gereken bilgileri (props) tanımlıyoruz
export default function AnaSayfa({ selectedBranch, setAppMode, config }: any) {
  return (
    <div className="space-y-6 animate-in fade-in zoom-in duration-500 w-full">
        {/* Karşılama Ekranı */}
        <div className="bg-slate-900/80 backdrop-blur-md p-8 rounded-3xl shadow-lg border border-sky-500/20 relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            {/* Arka Plan Deseni */}
            <div className="absolute -right-6 -top-6 opacity-5 pointer-events-none">
                <svg className="w-48 h-48 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </div>

            <div className="relative z-10">
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-3">
                    Hoş Geldiniz, <span className="text-sky-400 font-extrabold">Hayırlı İşler!</span>
                </h2>
                <div className="flex items-center gap-2">
                    <span className="flex h-2.5 w-2.5 rounded-full bg-sky-500 animate-pulse"></span>
                    <p className="text-slate-400 font-medium uppercase tracking-wider text-sm">{selectedBranch} - Cnetmobil Personel Terminali</p>
                </div>
            </div>

            <button onClick={() => setAppMode('alim')} className="relative z-10 bg-sky-500 hover:bg-sky-400 text-white px-8 py-4 rounded-xl font-bold uppercase text-sm tracking-wide shadow-lg shadow-sky-500/25 transition-all flex items-center gap-3 transform hover:scale-[1.02] active:scale-95">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                Cihaz Alıma Başla
            </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Sabit Duyurular */}
            <div className="bg-slate-900/60 backdrop-blur-sm p-7 rounded-3xl border border-slate-800/80 shadow-md h-full flex flex-col hover:border-slate-700 transition-colors">
                <div className="flex items-center gap-3 mb-5 border-b border-slate-800 pb-4 shrink-0">
                    <div className="w-10 h-10 rounded-lg bg-sky-500/10 text-sky-400 flex items-center justify-center">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>
                    </div>
                    <h3 className="text-lg font-bold text-white tracking-wide">GÜNCEL DUYURULAR</h3>
                </div>
                <div className="text-slate-300 font-normal leading-relaxed flex-1 text-sm md:text-base whitespace-pre-wrap">
                    {config.Duyuru_Metni || "Şu an için aktif bir mağaza duyurusu bulunmamaktadır."}
                </div>
            </div>

            {/* Kayar Kampanyalar */}
            <div className="bg-slate-900/60 backdrop-blur-sm p-7 rounded-3xl border border-slate-800/80 shadow-md h-full flex flex-col overflow-hidden hover:border-slate-700 transition-colors">
                <div className="flex items-center gap-3 mb-5 border-b border-slate-800 pb-4 shrink-0">
                    <div className="w-10 h-10 rounded-lg bg-orange-500/10 text-orange-400 flex items-center justify-center">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" /></svg>
                    </div>
                    <h3 className="text-lg font-bold text-white tracking-wide">AKTİF KAMPANYALAR</h3>
                </div>
                <div className="flex-1 flex items-center bg-gradient-to-r from-orange-500/5 to-transparent rounded-2xl border border-orange-500/10 overflow-hidden py-8 relative">
                    <div className="whitespace-nowrap animate-marquee font-bold text-2xl tracking-wide text-orange-400">
                        🔥 {config.Kampanya_Metni || "GÜNCEL KAMPANYA BULUNMAMAKTADIR"} 🔥
                    </div>
                </div>
            </div>
        </div>
    </div>
  );
}
