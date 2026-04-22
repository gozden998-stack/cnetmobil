"use client";
import React, { useState } from 'react';
// YENİ: Senin klasör yapına (app/teknik-takip/page.tsx) uygun import yolu
import TeknikTakipTablosu from '../teknik-takip/page';

interface YoneticiPaneliProps {
  isAdmin: boolean;
  setAdminPass: (pass: string) => void;
  handleLogin: () => void;
  adminSelectedBranch: string;
  dateFilterType: string;
  dashboardStats: { alindi: number; alinmadi: number; diger: number; total: number };
  config: any;
  updateConfig: (key: string, val: string) => void;
  filteredAlimlar: any[];
  deleteAllAlimlar: () => void;
  deleteAlim: (sheetIdx: number) => void;
  setEkspertizModalData: (data: any) => void;
}

export default function YoneticiPaneli({
  isAdmin,
  setAdminPass,
  handleLogin,
  adminSelectedBranch,
  dateFilterType,
  dashboardStats,
  config,
  updateConfig,
  filteredAlimlar,
  deleteAllAlimlar,
  deleteAlim,
  setEkspertizModalData
}: YoneticiPaneliProps) {
  
  // Yönetici panelindeki aktif sekmeyi takip eden state
  const [activeTab, setActiveTab] = useState<'buyback' | 'teknik'>('buyback');

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 font-sans">
      {!isAdmin ? (
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
        <div className="w-full min-w-0">

          {/* MERKEZİ SEKME (TAB) MENÜSÜ */}
          <div className="flex flex-col sm:flex-row justify-center items-center gap-4 mb-10 bg-slate-900/50 p-2.5 rounded-2xl border border-slate-800/80 w-fit mx-auto shadow-2xl backdrop-blur-md">
            <button
              onClick={() => setActiveTab('buyback')}
              className={`px-8 py-3.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${
                activeTab === 'buyback'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
              BUYBACK (CİHAZ ALIM) PANELİ
            </button>
            <button
              onClick={() => setActiveTab('teknik')}
              className={`px-8 py-3.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${
                activeTab === 'teknik'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              TEKNİK SERVİS PANELİ
            </button>
          </div>

          {/* İÇERİK ALANI: SEÇİLİ SEKMEYE GÖRE GÖSTERİM */}
          {activeTab === 'buyback' ? (
            <div className="space-y-8 animate-in fade-in duration-500">
              {/* BAŞLIK VE FİLTRE BİLGİSİ */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-slate-800 pb-4">
                <div>
                  <h2 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
                    <div className="w-2 h-8 bg-blue-500 rounded-full"></div>
                    {adminSelectedBranch} İSTATİSTİKLERİ
                  </h2>
                  <p className="text-sm text-slate-400 mt-2 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    Aktif Tarih Filtresi: <span className="font-semibold text-slate-200">{dateFilterType}</span>
                  </p>
                </div>
              </div>

              {/* İSTATİSTİK KARTLARI */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800/80 rounded-2xl p-6 relative overflow-hidden group hover:-translate-y-1 hover:border-blue-500/30 hover:shadow-[0_8px_30px_rgba(37,99,235,0.1)] transition-all duration-300">
                  <div className="absolute right-0 top-0 w-24 h-24 bg-blue-500/5 rounded-bl-full -z-10 group-hover:bg-blue-500/10 transition-colors"></div>
                  <div className="flex justify-between items-start mb-4">
                    <p className="text-sm font-medium text-slate-400">Toplam İşlem</p>
                    <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg></div>
                  </div>
                  <p className="text-4xl font-bold text-white tracking-tight">{dashboardStats.total}</p>
                </div>

                <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800/80 rounded-2xl p-6 relative overflow-hidden group hover:-translate-y-1 hover:border-emerald-500/30 hover:shadow-[0_8px_30px_rgba(16,185,129,0.1)] transition-all duration-300">
                  <div className="absolute right-0 top-0 w-24 h-24 bg-emerald-500/5 rounded-bl-full -z-10 group-hover:bg-emerald-500/10 transition-colors"></div>
                  <div className="flex justify-between items-start mb-4">
                    <p className="text-sm font-medium text-slate-400">Başarılı Alım</p>
                    <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div>
                  </div>
                  <p className="text-4xl font-bold text-emerald-400 tracking-tight">{dashboardStats.alindi}</p>
                </div>

                <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800/80 rounded-2xl p-6 relative overflow-hidden group hover:-translate-y-1 hover:border-rose-500/30 hover:shadow-[0_8px_30px_rgba(244,63,94,0.1)] transition-all duration-300">
                  <div className="absolute right-0 top-0 w-24 h-24 bg-rose-500/5 rounded-bl-full -z-10 group-hover:bg-rose-500/10 transition-colors"></div>
                  <div className="flex justify-between items-start mb-4">
                    <p className="text-sm font-medium text-slate-400">İptal / Reddedilen</p>
                    <div className="p-2 bg-rose-500/10 rounded-lg text-rose-400"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div>
                  </div>
                  <p className="text-4xl font-bold text-rose-400 tracking-tight">{dashboardStats.alinmadi}</p>
                </div>

                <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800/80 rounded-2xl p-6 relative overflow-hidden group hover:-translate-y-1 hover:border-amber-500/30 hover:shadow-[0_8px_30px_rgba(245,158,11,0.1)] transition-all duration-300">
                  <div className="absolute right-0 top-0 w-24 h-24 bg-amber-500/5 rounded-bl-full -z-10 group-hover:bg-amber-500/10 transition-colors"></div>
                  <div className="flex justify-between items-start mb-4">
                    <p className="text-sm font-medium text-slate-400">Bekleyen / Diğer</p>
                    <div className="p-2 bg-amber-500/10 rounded-lg text-amber-400"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div>
                  </div>
                  <p className="text-4xl font-bold text-amber-400 tracking-tight">{dashboardStats.diger}</p>
                </div>
              </div>

              {/* DUYURU VE KAMPANYA YÖNETİMİ */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-8">
                <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-6 shadow-sm">
                  <h3 className="text-sm font-semibold text-slate-200 mb-4 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.8)] animate-pulse"></span> 
                    Mağaza Personeli Sabit Duyurusu
                  </h3>
                  <textarea
                    className="w-full bg-slate-950/50 border border-slate-800 rounded-xl p-4 text-slate-300 outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 mb-4 h-24 text-sm resize-none custom-scrollbar transition-all"
                    placeholder="Personelinizin göreceği sabit duyuru metnini buraya yazın..."
                    defaultValue={config.Duyuru_Metni || ""}
                    id="duyuruInput"
                  ></textarea>
                  <button onClick={() => updateConfig('Duyuru_Metni', (document.getElementById('duyuruInput') as HTMLTextAreaElement).value)} className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-2.5 rounded-lg text-sm font-semibold w-full transition-all shadow-md shadow-purple-900/20">
                    Duyuruyu Güncelle
                  </button>
                </div>

                <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-6 shadow-sm">
                  <h3 className="text-sm font-semibold text-slate-200 mb-4 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.8)] animate-pulse"></span> 
                    Müşteri Ekranı Kayar Kampanya Yazısı
                  </h3>
                  <textarea
                    className="w-full bg-slate-950/50 border border-slate-800 rounded-xl p-4 text-slate-300 outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/50 mb-4 h-24 text-sm resize-none custom-scrollbar transition-all"
                    placeholder="Ana sayfada kayarak geçecek kampanya metnini yazın..."
                    defaultValue={config.Kampanya_Metni || ""}
                    id="kampanyaInput"
                  ></textarea>
                  <button onClick={() => updateConfig('Kampanya_Metni', (document.getElementById('kampanyaInput') as HTMLTextAreaElement).value)} className="bg-orange-600 hover:bg-orange-500 text-white px-6 py-2.5 rounded-lg text-sm font-semibold w-full transition-all shadow-md shadow-orange-900/20">
                    Kampanyayı Güncelle
                  </button>
                </div>
              </div>

              {/* TABLO BÖLÜMÜ */}
              <div className="bg-slate-900/60 p-6 rounded-3xl shadow-lg border border-slate-800/80">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-5 mb-5">
                  <div>
                    <h3 className="text-lg font-bold text-white tracking-tight">Son İşlemler Kaydı</h3>
                    <p className="text-xs text-slate-400 mt-1">Sistemdeki tüm cihaz alım/iptal geçmişi</p>
                  </div>
                  {adminSelectedBranch === 'TÜM ŞUBELER' && (
                    <button onClick={deleteAllAlimlar} className="bg-red-500/10 text-red-400 px-4 py-2 rounded-lg text-xs font-semibold hover:bg-red-500 hover:text-white transition-all border border-red-500/20 flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      TÜM GEÇMİŞİ TEMİZLE
                    </button>
                  )}
                </div>

                {filteredAlimlar.length === 0 ? (
                  <div className="text-center py-16 text-slate-500">
                    <p className="text-sm font-medium">Bu kriterlere uygun kayıt bulunmuyor.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto custom-scrollbar pb-2">
                    <div className="min-w-[1100px] flex flex-col">
                      <div className="grid grid-cols-[140px_200px_140px_1fr_120px_60px] gap-4 px-6 py-3 bg-slate-950/50 border border-slate-800/80 rounded-xl font-semibold text-xs text-slate-400 mb-2">
                        <div>TARİH / ŞUBE</div>
                        <div>MÜŞTERİ BİLGİSİ</div>
                        <div>DURUM</div>
                        <div>CİHAZ VE EKSPERTİZ</div>
                        <div className="text-right pr-2">TUTAR</div>
                        <div className="text-center">SİL</div>
                      </div>

                      <div className="flex flex-col gap-2">
                        {filteredAlimlar.map((item, i) => {
                          const rawDevice = item.data[2] || '';
                          const parts = rawDevice.split(' #EKSPERTİZ# ');
                          const mainDevice = parts[0];
                          const cleanDevice = mainDevice.replace(/\[NAKİT ALINDI\]/g, '').replace(/\[TAKAS ALINDI\]/g, '').replace(/\[ALINMADI\]/g, '').trim();
                          const ekspertizData = parts.length > 1 ? parts[1] : '';

                          let rawDate = item.data[6] || item.data[7] || '---';
                          let datePart = rawDate.split(' ')[0] || '---';
                          let timePart = rawDate.split(' ')[1] || '';

                          const rowStr = item.data.join(" ");
                          let statusBadge = "bg-slate-800/50 text-slate-400 border-slate-700/50";
                          let statusText = "BEKLEMEDE";
                          let dotColor = "bg-slate-500";

                          if (rowStr.includes('[NAKİT ALINDI]')) {
                            statusBadge = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
                            statusText = "NAKİT ALIM";
                            dotColor = "bg-emerald-400";
                          } else if (rowStr.includes('[TAKAS ALINDI]')) {
                            statusBadge = "bg-blue-500/10 text-blue-400 border-blue-500/20";
                            statusText = "TAKAS ALIM";
                            dotColor = "bg-blue-400";
                          } else if (rowStr.includes('[ALINMADI]')) {
                            statusBadge = "bg-rose-500/10 text-rose-400 border-rose-500/20";
                            statusText = "İPTAL";
                            dotColor = "bg-rose-400";
                          }

                          return (
                            <div key={i} className="grid grid-cols-[140px_200px_140px_1fr_120px_60px] gap-4 px-6 py-4 bg-slate-900/30 hover:bg-slate-800/40 border border-slate-800/50 rounded-xl items-center transition-colors">
                              <div className="flex flex-col gap-1">
                                <span className="text-xs font-semibold text-slate-300">{datePart}</span>
                                <span className="text-[11px] text-slate-500">{timePart}</span>
                                <span className="mt-1 text-[10px] font-bold text-indigo-400 uppercase tracking-wider">{item.data[0]}</span>
                              </div>

                              <div className="flex flex-col gap-1 pr-2">
                                <span className="text-sm font-semibold text-slate-200 truncate" title={item.data[1]}>{item.data[1] || 'Bilinmiyor'}</span>
                                <span className="text-[11px] font-mono text-slate-500 flex items-center gap-1">{item.data[3] || 'IMEI YOK'}</span>
                              </div>

                              <div>
                                <div className={`px-2.5 py-1.5 rounded-md text-[11px] font-semibold uppercase border inline-flex items-center gap-1.5 ${statusBadge}`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`}></span>
                                  {statusText}
                                </div>
                              </div>

                              <div className="flex flex-col items-start gap-2">
                                <span className="text-sm font-medium text-slate-200">{cleanDevice}</span>
                                {ekspertizData && (
                                  <button onClick={() => setEkspertizModalData({ customer: item.data[1], device: cleanDevice, data: ekspertizData })} className="text-[11px] font-medium text-blue-400 hover:text-blue-300 flex items-center gap-1.5 transition-colors">
                                    Ekspertiz Formunu Gör
                                  </button>
                                )}
                              </div>

                              <div className="text-right pr-2 flex flex-col justify-center">
                                {statusText === 'İPTAL' ? (
                                  <span className="font-semibold text-slate-600 text-sm">---</span>
                                ) : (
                                  <span className="font-bold text-white text-base">
                                    {parseInt(item.data[5] || item.data[4] || 0).toLocaleString()} <span className="text-slate-400 text-sm font-normal">₺</span>
                                  </span>
                                )}
                              </div>

                              <div className="flex justify-center">
                                <button onClick={() => deleteAlim(item.sheetIndex)} className="text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 p-2 rounded-lg transition-all" title="Kaydı Sil">
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            // TEKNİK SERVİS SEKME İÇERİĞİ 
            <div className="animate-in fade-in zoom-in-95 duration-500 rounded-[2rem] overflow-hidden border border-slate-800 shadow-2xl bg-slate-950">
              <TeknikTakipTablosu />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
