import React from 'react';

// Ana sayfanın çalışması için dışarıdan alması gereken bilgileri (props) tanımlıyoruz
export default function AnaSayfa({ selectedBranch, setAppMode, config }: any) {
  return (
    <div className="space-y-8 animate-in fade-in zoom-in duration-500 w-full">
        {/* Karşılama Ekranı */}
        <div className="bg-gradient-to-r from-blue-900 to-[#1e1e2d] p-10 rounded-[48px] shadow-2xl border border-blue-800/50 relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="absolute -right-10 -top-10 opacity-10 pointer-events-none">
                <svg className="w-64 h-64 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </div>
            <div className="relative z-10 text-white">
                <h2 className="text-4xl md:text-5xl font-black italic tracking-tighter mb-2">Hoş Geldiniz, <span className="text-blue-500">Hayırlı İşler!</span></h2>
                <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">{selectedBranch} - CMR Personel Terminali</p>
            </div>
            <button onClick={() => setAppMode('alim')} className="relative z-10 bg-blue-600 text-white px-8 py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-blue-600/30 hover:bg-blue-500 transition-all btn-click flex items-center gap-2">
                Cihaz Alıma Başla
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
            </button>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            {/* Sabit Duyurular */}
            <div className="bg-[#1e1e2d] p-8 rounded-[40px] border border-slate-800 shadow-xl h-full flex flex-col">
                <div className="flex items-center gap-3 mb-6 border-b border-slate-700/50 pb-4 shrink-0">
                    <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>
                    </div>
                    <h3 className="text-xl font-black italic text-white uppercase tracking-tighter">GÜNCEL DUYURULAR</h3>
                </div>
                <div className="text-slate-300 font-bold leading-relaxed whitespace-pre-wrap flex-1">
                    {config.Duyuru_Metni || "Şu an için aktif bir mağaza duyurusu bulunmamaktadır."}
                </div>
            </div>

            {/* Kayar Kampanyalar */}
            <div className="bg-[#1e1e2d] p-8 rounded-[40px] border border-slate-800 shadow-xl h-full flex flex-col overflow-hidden">
                <div className="flex items-center gap-3 mb-6 border-b border-slate-700/50 pb-4 shrink-0">
                    <div className="w-10 h-10 rounded-xl bg-orange-500/20 text-orange-400 flex items-center justify-center">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" /></svg>
                    </div>
                    <h3 className="text-xl font-black italic text-white uppercase tracking-tighter">AKTİF KAMPANYALAR</h3>
                </div>
                <div className="flex-1 flex items-center bg-orange-500/5 rounded-3xl border border-orange-500/20 overflow-hidden py-10 relative">
    <div className="whitespace-nowrap animate-marquee font-black text-3xl uppercase tracking-widest text-orange-400 drop-shadow-[0_0_10px_rgba(249,115,22,0.4)]">
        🔥 {config.Kampanya_Metni || "GÜNCEL KAMPANYA BULUNMAMAKTADIR"} 🔥
    </div>
</div>

            </div>
        </div>
    </div>
  );
}
