import React from 'react';

export default function AnaSayfa({ selectedBranch, setAppMode, config }: any) {
  // Sadece CMR şubelerinde gidişat bölümleri görünür
  const isCmr = selectedBranch.includes('CMR');

  return (
    <div className="space-y-8 w-full animate-in fade-in duration-700">
        
        {/* --- PREMIUM CNETMOBİL AI ASİSTAN BANNER (GÖRSELDEKİ ÜST ALAN) --- */}
        <div className="relative overflow-hidden bg-[#0A1128] rounded-[2.5rem] p-10 shadow-2xl border border-blue-500/20 flex flex-col lg:flex-row items-center justify-between gap-10">
            {/* Arka Plan Glow Efektleri */}
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-indigo-600/10 rounded-full blur-[100px] pointer-events-none"></div>
            
            <div className="relative z-10 flex flex-col gap-6 max-w-3xl">
                <div className="inline-flex items-center gap-3 px-4 py-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-black tracking-widest uppercase backdrop-blur-md">
                    <span className="flex h-2 w-2 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                    </span>
                    {selectedBranch} AKILLI TERMİNAL V2.0
                </div>

                <div className="flex items-start gap-6">
                    <div className="bg-gradient-to-br from-blue-400 to-indigo-600 p-4 rounded-2xl shadow-lg shadow-blue-500/20 shrink-0">
                        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                    </div>
                    <div>
                        <h2 className="text-3xl md:text-5xl font-black tracking-tighter text-white mb-3 italic">
                            CNETMOBİL AI <span className="text-blue-500">ASİSTAN</span>
                        </h2>
                        <p className="text-slate-400 font-medium text-sm md:text-lg leading-relaxed">
                            Cnetmobil AI ile cihaz alımı, fiyatlandırma ve tüm şube süreçlerini 
                            akıllı asistanınızla saniyeler içinde yönetin.
                        </p>
                    </div>
                </div>
            </div>

            {/* BUTON: BOT'A YÖNLENDİRİR */}
            <button 
                onClick={() => setAppMode('bot')} 
                className="relative z-10 group bg-white hover:bg-blue-50 text-[#0A1128] px-12 py-7 rounded-[2rem] font-black text-sm tracking-tight shadow-2xl transition-all duration-300 flex items-center gap-4 shrink-0 transform hover:-translate-y-1 active:scale-95"
            >
                <div className="bg-blue-100 p-2 rounded-xl text-blue-600 group-hover:rotate-12 transition-transform">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    </svg>
                </div>
                CNETMOBİL AI'A SORU SOR
            </button>
        </div>

        {/* --- GİDİŞAT BÖLÜMLERİ (GÖRSELDEKİ ÇOK YAKINDA ALANLARI) --- */}
        {isCmr && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                
                {/* Mağaza Gidişat */}
                <div className="group relative overflow-hidden bg-white rounded-[2.5rem] p-10 border border-slate-100 shadow-sm">
                    <div className="absolute inset-0 bg-slate-50/50 backdrop-blur-[2px] z-10 flex flex-col items-center justify-center">
                        <div className="bg-blue-600 text-white px-6 py-2 rounded-2xl text-xs font-black tracking-[0.2em] uppercase shadow-xl shadow-blue-600/30 animate-bounce">
                            Çok Yakında
                        </div>
                        <p className="mt-4 text-slate-400 font-bold text-sm tracking-tight italic">Mağaza Verileri Hazırlanıyor</p>
                    </div>

                    <div className="flex justify-between items-center mb-8">
                        <h3 className="text-xl font-black text-slate-800 tracking-tight uppercase">Mağaza Gidişat</h3>
                        <div className="w-12 h-12 rounded-2xl bg-slate-100 animate-pulse"></div>
                    </div>
                    <div className="space-y-4">
                        <div className="h-2 w-full bg-slate-100 rounded-full"></div>
                        <div className="h-2 w-2/3 bg-slate-100 rounded-full"></div>
                    </div>
                </div>

                {/* Personel Gidişat */}
                <div className="group relative overflow-hidden bg-white rounded-[2.5rem] p-10 border border-slate-100 shadow-sm">
                    <div className="absolute inset-0 bg-slate-50/50 backdrop-blur-[2px] z-10 flex flex-col items-center justify-center">
                        <div className="bg-emerald-600 text-white px-6 py-2 rounded-2xl text-xs font-black tracking-[0.2em] uppercase shadow-xl shadow-emerald-600/30 animate-bounce">
                            Çok Yakında
                        </div>
                        <p className="mt-4 text-slate-400 font-bold text-sm tracking-tight italic">Takım Sıralaması Hazırlanıyor</p>
                    </div>

                    <div className="flex justify-between items-center mb-8">
                        <h3 className="text-xl font-black text-slate-800 tracking-tight uppercase">Personel Gidişat</h3>
                        <div className="w-12 h-12 rounded-2xl bg-slate-100 animate-pulse"></div>
                    </div>
                    <div className="flex gap-2">
                        <div className="w-10 h-10 rounded-full bg-slate-100 animate-pulse"></div>
                        <div className="w-10 h-10 rounded-full bg-slate-100 animate-pulse delay-75"></div>
                    </div>
                </div>

            </div>
        )}

        {/* Alt Bilgi Panelleri (Duyuru & Kampanya) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white rounded-[2.5rem] p-10 border border-slate-200 shadow-sm">
                <div className="flex items-center gap-4 mb-8">
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-500 flex items-center justify-center shrink-0">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>
                    </div>
                    <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Merkez Duyuruları</h3>
                </div>
                <div className="bg-slate-50 rounded-3xl p-8 border border-slate-100 min-h-[120px]">
                    <p className="text-slate-700 font-semibold text-base leading-relaxed">
                        {config.Duyuru_Metni || "Aktif bir merkez duyurusu bulunmamaktadır."}
                    </p>
                </div>
            </div>

            <div className="bg-white rounded-[2.5rem] p-10 border border-slate-200 shadow-sm overflow-hidden relative">
                <div className="flex items-center gap-4 mb-8 relative z-10">
                    <div className="w-12 h-12 rounded-2xl bg-orange-50 text-orange-500 flex items-center justify-center shrink-0">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" /></svg>
                    </div>
                    <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Aktif Kampanyalar</h3>
                </div>
                <div className="flex items-center justify-center bg-gradient-to-r from-orange-500/5 via-orange-500/10 to-transparent rounded-3xl border border-orange-500/10 py-12 relative z-10 overflow-hidden">
                    <div className="whitespace-nowrap animate-marquee font-black text-3xl tracking-tighter text-orange-600">
                         {config.Kampanya_Metni || "GÜNCEL KAMPANYA BULUNMAMAKTADIR"}
                    </div>
                </div>
            </div>
        </div>
        
    </div>
  );
}
