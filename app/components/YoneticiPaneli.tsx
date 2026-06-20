"use client";
import React from 'react';

// ----------------------------------------------------------------------
// 1. TİP TANIMLAMALARI (Ana bileşeni bozmamak için hepsi korundu)
// ----------------------------------------------------------------------
export interface DashboardStats {
  alindi: number;
  alinmadi: number;
  diger: number;
  total: number;
}

export interface ConfigData {
  Duyuru_Metni?: string;
  Kampanya_Metni?: string;
  [key: string]: string | undefined;
}

export interface BuybackItem {
  sheetIndex: number;
  data: string[];
}

export interface EkspertizModalData {
  customer: string;
  device: string;
  data: string;
}

interface YoneticiPaneliProps {
  isAdmin: boolean;
  setAdminPass: (pass: string) => void;
  handleLogin: () => void;
  adminSelectedBranch: string;
  dateFilterType: string;
  dashboardStats: DashboardStats;
  config: ConfigData;
  updateConfig: (key: string, val: string) => void;
  filteredAlimlar: BuybackItem[];
  deleteAllAlimlar: () => void;
  deleteAlim: (sheetIdx: number) => void;
  setEkspertizModalData: (data: EkspertizModalData) => void;
}

// ----------------------------------------------------------------------
// 2. ANA BİLEŞEN - TEMİZLENMİŞ DASHBOARD VERSİYONU
// ----------------------------------------------------------------------
export default function YoneticiPaneli({
  isAdmin,
  setAdminPass,
  handleLogin,
  dashboardStats,
}: YoneticiPaneliProps) {
  
  // Sizin karanlık temanıza uygun geçici ciro istatistiği (İleride Excel'den gelecek)
  const ciroStat = {
    bugun: "128.500",
    dun: "94.200",
    artis: "+%36"
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 font-sans">
      {!isAdmin ? (
        /* ------------------------------------------------------------------
           GİRİŞ EKRANI (Orjinal tasarımınız korundu)
        ------------------------------------------------------------------- */
        <div className="max-w-md mx-auto bg-slate-900/80 backdrop-blur-md p-10 rounded-3xl shadow-[0_0_40px_rgba(37,99,235,0.1)] text-center border border-slate-800 mt-20 relative overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-32 bg-blue-600/20 rounded-full blur-[50px] -z-10"></div>
          
          <div className="w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-blue-500/20">
            <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 00-2 2v6a2 2 0 00-2 2v6a2 2 0 00-2 2zM9 11V7a3 3 0 016 0v4" /></svg>
          </div>
          <h2 className="text-2xl font-bold text-slate-100 mb-2 tracking-tight">Merkezi Yönetim</h2>
          <p className="text-slate-400 text-sm mb-8">Devam etmek için yönetici şifresini girin.</p>
          
          <input 
            type="password" 
            placeholder="••••••••" 
            className="w-full p-4 bg-slate-950/50 rounded-xl mb-6 text-center font-bold outline-none border border-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-white placeholder-slate-600" 
            onChange={(e) => setAdminPass(e.target.value)} 
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
          />
          <button
            onClick={handleLogin}
            className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 rounded-xl font-bold w-full transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2"
          >
            SİSTEME GİRİŞ YAP
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
          </button>
        </div>
      ) : (
        /* ------------------------------------------------------------------
           YÖNETİCİ PANELİ - TEMİZ DASHBOARD (Karanlık Temaya Uygun)
        ------------------------------------------------------------------- */
        <div className="w-full min-w-0 space-y-8 animate-in fade-in duration-500 pt-4">
          
          {/* ÜST BAŞLIK ALANI */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-slate-800 pb-6 mb-8">
            <div>
              <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
                <div className="w-2 h-8 bg-blue-500 rounded-full shadow-[0_0_15px_rgba(59,130,246,0.5)]"></div>
                CNET MOBİL MERKEZİ EKRAN
              </h1>
              <p className="text-sm text-slate-400 mt-2 flex items-center gap-2 font-medium">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                </span>
                8 Mağazanın Canlı Veri Akışı Bekleniyor...
              </p>
            </div>
            
            <div className="bg-slate-900/80 px-5 py-3 rounded-xl border border-slate-800 text-right backdrop-blur-md">
              <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">Bugünkü Toplam Ciro</p>
              <p className="text-2xl font-bold text-white">{ciroStat.bugun} ₺</p>
              <p className="text-xs font-bold text-emerald-400 mt-1 bg-emerald-500/10 inline-block px-2 py-0.5 rounded-full border border-emerald-500/20">
                {ciroStat.artis} (Düne Göre)
              </p>
            </div>
          </div>

          {/* İSTATİSTİK KARTLARI */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* Toplam İşlem */}
            <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800/80 rounded-2xl p-6 relative overflow-hidden group hover:-translate-y-1 hover:border-blue-500/30 transition-all duration-300">
              <div className="flex justify-between items-start mb-4">
                <p className="text-sm font-medium text-slate-400 uppercase tracking-wider">Bugünkü İşlem</p>
                <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg></div>
              </div>
              <p className="text-4xl font-bold text-white tracking-tight">{dashboardStats.total}</p>
            </div>

            {/* Başarılı Alım */}
            <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800/80 rounded-2xl p-6 relative overflow-hidden group hover:-translate-y-1 hover:border-emerald-500/30 transition-all duration-300">
              <div className="flex justify-between items-start mb-4">
                <p className="text-sm font-medium text-slate-400 uppercase tracking-wider">Cihaz Alım</p>
                <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div>
              </div>
              <p className="text-4xl font-bold text-emerald-400 tracking-tight">{dashboardStats.alindi}</p>
            </div>

            {/* Bekleyen Teknik Servis */}
            <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800/80 rounded-2xl p-6 relative overflow-hidden group hover:-translate-y-1 hover:border-amber-500/30 transition-all duration-300">
              <div className="flex justify-between items-start mb-4">
                <p className="text-sm font-medium text-slate-400 uppercase tracking-wider">Teknik Servis</p>
                <div className="p-2 bg-amber-500/10 rounded-lg text-amber-400"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div>
              </div>
              <p className="text-4xl font-bold text-amber-400 tracking-tight">{dashboardStats.diger}</p>
            </div>

            {/* İptal / İade */}
            <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800/80 rounded-2xl p-6 relative overflow-hidden group hover:-translate-y-1 hover:border-rose-500/30 transition-all duration-300">
              <div className="flex justify-between items-start mb-4">
                <p className="text-sm font-medium text-slate-400 uppercase tracking-wider">İptal & İade</p>
                <div className="p-2 bg-rose-500/10 rounded-lg text-rose-400"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div>
              </div>
              <p className="text-4xl font-bold text-rose-400 tracking-tight">{dashboardStats.alinmadi}</p>
            </div>
          </div>

          {/* 3. MAĞAZA ÖZET DURUMU (HIZLI BAKIŞ) */}
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl shadow-lg overflow-hidden backdrop-blur-sm mt-8">
            <div className="px-6 py-5 border-b border-slate-800 bg-slate-900/80 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-white">Şube Aktiflik Durumu</h3>
                <p className="text-sm text-slate-500">Sistem senkronizasyon aralığı: 5 Dakika</p>
              </div>
              <button className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg transition-colors border border-slate-700">
                Tümünü Yenile
              </button>
            </div>
            
            <div className="p-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((sube) => (
                  <div key={sube} className="flex items-center p-4 border border-slate-800/50 rounded-xl bg-slate-950/50 hover:bg-slate-800/50 transition-colors cursor-pointer group">
                    <div className="w-3 h-3 rounded-full bg-emerald-500 mr-3 shadow-[0_0_8px_rgba(16,185,129,0.5)] group-hover:animate-pulse"></div>
                    <div>
                      <p className="text-sm font-bold text-slate-200">{sube === 1 ? "Merkez Mağaza" : `Şube ${sube}`}</p>
                      <p className="text-xs text-slate-500">Sistem Bağlı</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
