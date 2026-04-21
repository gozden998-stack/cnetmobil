"use client";
import React, { useState, useEffect } from 'react';

// Ana dosyadan gelen verileri karşılıyoruz
interface AdminPanelProps {
  isAdmin: boolean;
  adminPass: string;
  setAdminPass: (val: string) => void;
  handleLogin: () => void;
  adminSelectedBranch: string;
  dateFilterType: string;
  dashboardStats: any;
  config: any;
  updateConfig: (key: string, val: string) => void;
  deleteAllAlimlar: () => void;
  filteredAlimlar: any[];
  setEkspertizModalData: (data: any) => void;
  deleteAlim: (idx: number) => void;
}

export default function AdminPanel({
  isAdmin, adminPass, setAdminPass, handleLogin,
  adminSelectedBranch, dateFilterType, dashboardStats,
  config, updateConfig, deleteAllAlimlar, filteredAlimlar,
  setEkspertizModalData, deleteAlim
}: AdminPanelProps) {

  // TEKNİK SERVİS VERİLERİNİ ÇEKME (LocalStorage'dan)
  const [servisVerileri, setServisVerileri] = useState<any[]>([]);
  useEffect(() => {
      const sVeri = localStorage.getItem('cnet_teknik_kayitlar');
      if (sVeri) setServisVerileri(JSON.parse(sVeri).filter((s: any) => s.kaydedildi));
  }, []);

  const servisStats = {
      toplam: servisVerileri.length,
      basari: servisVerileri.filter(s => s.tamirDurumu === 'Evet').length,
      hata: servisVerileri.filter(s => s.tamirDurumu === 'Hayır').length,
      oran: servisVerileri.length > 0 ? Math.round((servisVerileri.filter(s => s.tamirDurumu === 'Evet').length / servisVerileri.length) * 100) : 0
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      {!isAdmin ? (
        <div className="max-w-md mx-auto bg-[#1e1e2d] p-12 rounded-[48px] shadow-2xl text-center border border-slate-800 mt-20">
          <div className="w-16 h-16 bg-blue-600/20 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-blue-500/30">
              <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 00-2 2v6a2 2 0 00-2 2v6a2 2 0 00-2 2v6a2 2 0 00-2 2zM9 11V7a3 3 0 016 0v4" /></svg>
          </div>
          <h2 className="text-xl font-black italic mb-8 uppercase tracking-widest text-white">Yönetici Terminali</h2>
          <input type="password" placeholder="••••••••" value={adminPass} onChange={(e) => setAdminPass(e.target.value)} className="w-full p-5 bg-[#2a2a3d] rounded-2xl mb-4 text-center font-black outline-none border border-slate-700 focus:border-blue-500 transition-all text-white placeholder-slate-500" />
          <button onClick={handleLogin} className="bg-blue-600 text-white px-10 py-5 rounded-2xl font-black uppercase w-full btn-click shadow-xl shadow-blue-600/20 hover:bg-blue-500">
            SİSTEME GİRİŞ YAP
          </button>
        </div>
      ) : (
        <div className="w-full space-y-10 min-w-0">
          {/* STATS HEADER */}
          <div className="mb-6">
             <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                   <h2 className="text-3xl md:text-4xl font-black italic uppercase tracking-tighter text-white">
                      {adminSelectedBranch} İSTATİSTİKLERİ
                   </h2>
                   <p className="text-[11px] text-slate-400 font-bold tracking-widest mt-1 uppercase">
                      Tarih Filtresi: <span className="text-white">{dateFilterType}</span>
                   </p>
                </div>
             </div>

             {/* ANA CİHAZ ALIM İSTATİSTİKLERİ */}
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* TOPLAM */}
                <div className="bg-[#131722] border border-slate-800 rounded-[32px] p-8 relative overflow-hidden shadow-2xl flex flex-col justify-between group hover:border-blue-500/50 transition-all cursor-default">
                   <div className="absolute -right-6 -top-6 text-blue-500/5 group-hover:text-blue-500/20 transition-colors">
                      <svg className="w-32 h-32" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                   </div>
                   <div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 relative z-10">Toplam İşlem</p>
                      <p className="text-6xl font-black text-white relative z-10 tracking-tighter">{dashboardStats.total}</p>
                   </div>
                   <div className="mt-8 pt-4 border-t border-slate-800/50 relative z-10">
                      <span className="text-[10px] text-blue-400 font-bold uppercase tracking-widest flex items-center gap-2">
                         <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span> Tüm Kayıtlar
                      </span>
                   </div>
                </div>

                {/* BAŞARILI ALIM */}
                <div className="bg-[#131722] border border-slate-800 rounded-[32px] p-8 relative overflow-hidden shadow-2xl flex flex-col justify-between group hover:border-emerald-500/50 transition-all cursor-default">
                   <div className="absolute -right-6 -top-6 text-emerald-500/5 group-hover:text-emerald-500/20 transition-colors">
                      <svg className="w-32 h-32" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                   </div>
                   <div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 relative z-10">Başarılı Alım</p>
                      <p className="text-6xl font-black text-emerald-400 relative z-10 tracking-tighter">{dashboardStats.alindi}</p>
                   </div>
                   <div className="mt-8 pt-4 border-t border-slate-800/50 relative z-10">
                      <span className="text-[10px] text-emerald-500 font-bold uppercase tracking-widest flex items-center gap-2">
                         <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]"></span> Nakit + Takas
                      </span>
                   </div>
                </div>

                {/* İPTAL */}
                <div className="bg-[#131722] border border-slate-800 rounded-[32px] p-8 relative overflow-hidden shadow-2xl flex flex-col justify-between group hover:border-rose-500/50 transition-all cursor-default">
                   <div className="absolute -right-6 -top-6 text-rose-500/5 group-hover:text-rose-500/20 transition-colors">
                      <svg className="w-32 h-32" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                   </div>
                   <div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 relative z-10">İptal / Alınmadı</p>
                      <p className="text-6xl font-black text-rose-400 relative z-10 tracking-tighter">{dashboardStats.alinmadi}</p>
                   </div>
                   <div className="mt-8 pt-4 border-t border-slate-800/50 relative z-10">
                      <span className="text-[10px] text-rose-500 font-bold uppercase tracking-widest flex items-center gap-2">
                         <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span> Reddedilenler
                      </span>
                   </div>
                </div>

                {/* TEKNİK SERVİS (YENİ KART) */}
                <div className="bg-[#131722] border border-orange-800/50 rounded-[32px] p-8 relative overflow-hidden shadow-2xl flex flex-col justify-between group hover:border-orange-500/50 transition-all cursor-default">
                   <div className="absolute -right-6 -top-6 text-orange-500/5 group-hover:text-orange-500/20 transition-colors">
                      <svg className="w-32 h-32" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /></svg>
                   </div>
                   <div>
                      <p className="text-xs font-bold text-orange-400/80 uppercase tracking-widest mb-2 relative z-10">Biten Teknik Servis</p>
                      <div className="flex items-end gap-3">
                         <p className="text-6xl font-black text-orange-400 relative z-10 tracking-tighter">{servisStats.toplam}</p>
                         <p className="text-sm font-bold text-emerald-400 pb-2">% {servisStats.oran} OK</p>
                      </div>
                   </div>
                   <div className="mt-8 pt-4 border-t border-orange-800/50 relative z-10">
                      <span className="text-[10px] text-orange-500 font-bold uppercase tracking-widest flex items-center gap-2">
                         <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span> Servis Performansı
                      </span>
                   </div>
                </div>
             </div>
          </div>

          {/* YÖNETİCİ DUYURU VE KAMPANYA YÖNETİMİ */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
             <div className="bg-[#131722] border border-slate-800 rounded-[32px] p-8 shadow-xl">
                <h3 className="text-[11px] font-black text-purple-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse"></span> Sabit Duyuru Yönetimi
                </h3>
                <textarea 
                   className="w-full bg-[#1e1e2d] border border-slate-700 rounded-2xl p-5 text-white outline-none focus:border-purple-500 mb-4 h-28 text-sm font-bold resize-none custom-scrollbar transition-all"
                   placeholder="Personelinizin göreceği sabit duyuru metnini buraya yazın..."
                   defaultValue={config?.Duyuru_Metni || ""}
                   id="duyuruInput"
                ></textarea>
                <button onClick={() => updateConfig('Duyuru_Metni', (document.getElementById('duyuruInput') as HTMLTextAreaElement).value)} className="bg-purple-600/20 text-purple-400 hover:bg-purple-600 hover:text-white px-6 py-4 rounded-xl font-black uppercase text-[10px] w-full transition-all tracking-widest btn-click border border-purple-500/20">Duyuruyu Yayınla</button>
             </div>
             
             <div className="bg-[#131722] border border-slate-800 rounded-[32px] p-8 shadow-xl">
                <h3 className="text-[11px] font-black text-orange-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></span> Kayar Yazı Kampanya Yönetimi
                </h3>
                <textarea 
                   className="w-full bg-[#1e1e2d] border border-slate-700 rounded-2xl p-5 text-white outline-none focus:border-orange-500 mb-4 h-28 text-sm font-bold resize-none custom-scrollbar transition-all"
                   placeholder="Ana sayfada kayarak geçecek kampanya metnini yazın..."
                   defaultValue={config?.Kampanya_Metni || ""}
                   id="kampanyaInput"
                ></textarea>
                <button onClick={() => updateConfig('Kampanya_Metni', (document.getElementById('kampanyaInput') as HTMLTextAreaElement).value)} className="bg-orange-600/20 text-orange-400 hover:bg-orange-600 hover:text-white px-6 py-4 rounded-xl font-black uppercase text-[10px] w-full transition-all tracking-widest btn-click border border-orange-500/20">Kampanyayı Yayınla</button>
             </div>
          </div>

          {/* ALIM TABLOSU */}
          <div className="bg-[#1e1e2d] p-6 sm:p-8 rounded-[40px] shadow-2xl border border-slate-800">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-700/50 pb-6 mb-6">
              <div>
                <h3 className="text-xl font-black italic uppercase tracking-tighter text-white">SON İŞLEMLER</h3>
                <p className="text-[10px] text-slate-400 font-bold tracking-widest mt-1 uppercase">Sistemdeki Cihaz Kayıt Geçmişi</p>
              </div>
              {adminSelectedBranch === 'TÜM ŞUBELER' && (
                <button onClick={deleteAllAlimlar} className="bg-red-500/10 text-red-500 px-5 py-2.5 rounded-xl text-[10px] font-black hover:bg-red-600 hover:text-white transition-all uppercase border border-red-500/20 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  GEÇMİŞİ TEMİZLE
                </button>
              )}
            </div>

            {filteredAlimlar.length === 0 ? (
              <div className="text-center py-20 text-slate-500">
                <p className="text-xs font-black uppercase tracking-widest">Kayıt Bulunmuyor</p>
              </div>
            ) : (
              <div className="overflow-x-auto custom-scrollbar pb-4">
                <div className="min-w-[1100px] flex flex-col">
                  {/* TABLO BAŞLIĞI */}
                  <div className="grid grid-cols-[140px_220px_140px_1fr_120px_80px] gap-4 px-6 py-4 border-b border-slate-700/50 bg-[#131722]/40 rounded-t-2xl font-black text-[10px] text-slate-500 uppercase tracking-widest items-center">
                    <div>TARİH / ŞUBE</div>
                    <div>MÜŞTERİ ADI SOYADI</div>
                    <div>İŞLEM TÜRÜ</div>
                    <div>CİHAZ BİLGİSİ</div>
                    <div className="text-right pr-4">TUTAR</div>
                    <div className="text-center">İŞLEM</div>
                  </div>
                  
                  {/* TABLO SATIRLARI */}
                  <div className="flex flex-col">
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
                      let statusBadge = "bg-slate-800 text-slate-400 border-slate-700";
                      let statusText = "BEKLEMEDE";
                      
                      if (rowStr.includes('[NAKİT ALINDI]')) {
                        statusBadge = "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
                        statusText = "NAKİT ALIM";
                      } else if (rowStr.includes('[TAKAS ALINDI]')) {
                        statusBadge = "bg-purple-500/10 text-purple-400 border-purple-500/30";
                        statusText = "TAKAS ALIM";
                      } else if (rowStr.includes('[ALINMADI]')) {
                        statusBadge = "bg-rose-500/10 text-rose-400 border-rose-500/30";
                        statusText = "İPTAL / ALINMADI";
                      }

                      return (
                        <div key={i} className={`grid grid-cols-[140px_220px_140px_1fr_120px_80px] gap-4 px-6 py-5 border-b border-slate-800/50 items-center hover:bg-white/[0.03] transition-all ${i % 2 === 0 ? '' : 'bg-[#2a2a3d]/10'}`}>
                          {/* 1. ŞUBE & TARİH */}
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[12px] font-bold text-slate-200">{datePart}</span>
                            <span className="text-[10px] text-slate-500">{timePart}</span>
                            <span className="mt-1 text-[10px] font-black text-blue-500 uppercase tracking-tighter">{item.data[0]}</span>
                          </div>

                          {/* 2. MÜŞTERİ BİLGİSİ */}
                          <div className="flex flex-col gap-1 pr-2">
                            <span className="text-[13px] font-black text-white uppercase truncate" title={item.data[1]}>
                              {item.data[1] || 'Bilinmiyor'}
                            </span>
                            <span className="text-[11px] font-mono text-slate-500">
                              {item.data[3] || 'IMEI YOK'}
                            </span>
                          </div>

                          {/* 3. İŞLEM TÜRÜ */}
                          <div>
                            <span className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase border tracking-widest inline-block ${statusBadge}`}>
                              {statusText}
                            </span>
                          </div>

                          {/* 4. CİHAZ MARKA MODEL & EKSPERTİZ BUTONU */}
                          <div className="flex flex-col items-start gap-2">
                            <span className="text-[13px] font-black text-slate-100 tracking-tight leading-snug">{cleanDevice}</span>
                            {ekspertizData && (
                              <button 
                                onClick={() => setEkspertizModalData({customer: item.data[1], device: cleanDevice, data: ekspertizData})}
                                className="text-[10px] font-black text-blue-400 bg-blue-500/10 hover:bg-blue-500 hover:text-white px-3 py-1.5 rounded-lg transition-all border border-blue-500/20 flex items-center gap-2 group/btn"
                              >
                                <svg className="w-4 h-4 group-hover/btn:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                                PERSONEL SEÇİMLERİ (EKSPERTİZ)
                              </button>
                            )}
                          </div>

                          {/* 5. TUTAR */}
                          <div className="text-right pr-4 flex flex-col justify-center">
                            {statusText === 'İPTAL / ALINMADI' ? (
                                <span className="font-black italic text-slate-500 text-sm">---</span>
                            ) : (
                                <span className="font-black italic text-emerald-400 text-sm">
                                  {parseInt(item.data[5] || item.data[4] || 0).toLocaleString()} ₺
                                </span>
                            )}
                          </div>

                          {/* 6. SİLME BUTONU */}
                          <div className="flex justify-center">
                            <button onClick={() => deleteAlim(item.sheetIndex)} className="text-slate-500 hover:text-red-500 hover:bg-red-500/10 p-2 rounded-xl transition-all" title="Kaydı Sil">
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
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
      )}
    </div>
  );
}
