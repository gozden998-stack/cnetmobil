"use client";

import React, { useState, useEffect } from 'react';

// Teknik takipteki veri yapısı ile aynı olmalı
interface Satir {
  id: number;
  usta: string;
  markaModel: string;
  imei: string;
  ariza: string;
  tamirDurumu: string;
  neden: string;
  testYapan: string;
  kaydedildi: boolean;
}

const AdminDashboard = () => {
  const [veriler, setVeriler] = useState<Satir[]>([]);

  // 1. ADIM: Teknik takip verilerini hafızadan çek
  useEffect(() => {
    const kaydedilmis = localStorage.getItem('cnet_teknik_kayitlar');
    if (kaydedilmis) {
      setVeriler(JSON.parse(kaydedilmis).filter((s: Satir) => s.kaydedildi));
    }
  }, []);

  // 2. ADIM: İstatistikleri Gerçek Verilerle Hesapla
  const toplamIs = veriler.length;
  const basariliIs = veriler.filter(s => s.tamirDurumu === 'Evet').length;
  const hataliIs = veriler.filter(s => s.tamirDurumu === 'Hayır').length;
  const basariOrani = toplamIs > 0 ? Math.round((basariliIs / toplamIs) * 100) : 0;

  // Usta bazlı performans hesaplama (Otomatik)
  const ustaPerformansi = Array.from(new Set(veriler.map(s => s.usta))).map(ustaAd => {
    const ustaIsleri = veriler.filter(s => s.usta === ustaAd);
    const ustaBasari = Math.round((ustaIsleri.filter(s => s.tamirDurumu === 'Evet').length / ustaIsleri.length) * 100);
    return { isim: ustaAd, adet: ustaIsleri.length, oran: ustaBasari };
  });

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 p-6 md:p-10">
      <div className="max-w-7xl mx-auto mb-10">
        <h1 className="text-4xl font-black text-white uppercase tracking-tighter">
          Cnetmobil <span className="text-blue-600">Canlı Analiz</span>
        </h1>
        <p className="text-slate-500 text-[10px] font-bold tracking-[0.4em] mt-2">TEKNİK SERVİS VERİLERİYLE SENKRONİZE</p>
      </div>

      {/* CANLI İSTATİSTİK KARTLARI */}
      <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 mb-10">
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-[2rem]">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Toplam Tamir</p>
          <h3 className="text-3xl font-black text-white mt-2">{toplamIs}</h3>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-[2rem]">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Başarı Oranı</p>
          <h3 className="text-3xl font-black text-emerald-500 mt-2">%{basariOrani}</h3>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-[2rem]">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Hatalı Dönüş</p>
          <h3 className="text-3xl font-black text-rose-500 mt-2">{hataliIs}</h3>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-[2rem]">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Kanal Girişi</p>
          <h3 className="text-3xl font-black text-blue-500 mt-2">Aktif</h3>
        </div>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* GERÇEK USTA SKORLARI */}
        <div className="lg:col-span-2 bg-slate-900/50 border border-slate-800 rounded-[2.5rem] p-8 shadow-2xl">
          <h3 className="text-lg font-black text-white mb-6 uppercase">Usta Performans Analizi</h3>
          <div className="space-y-6">
            {ustaPerformansi.map((u, i) => (
              <div key={i} className="space-y-2">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-slate-400">{u.isim}</span>
                  <span className="text-white">{u.adet} Cihaz / %{u.oran} Başarı</span>
                </div>
                <div className="h-3 bg-slate-800 rounded-full overflow-hidden">
                  <div className={`h-full bg-blue-600 transition-all duration-1000`} style={{ width: `${u.oran}%` }}></div>
                </div>
              </div>
            ))}
            {ustaPerformansi.length === 0 && <p className="text-slate-600 italic">Henüz kaydedilmiş veri bulunmuyor...</p>}
          </div>
        </div>

        {/* SON İŞLEMLER */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-[2.5rem] p-8">
          <h3 className="text-lg font-black text-white mb-6 uppercase">Son Kayıtlar</h3>
          <div className="space-y-4">
            {veriler.slice(-5).reverse().map((s, i) => (
              <div key={i} className="flex justify-between items-center border-b border-slate-800 pb-3">
                <div>
                  <p className="text-xs font-bold text-white uppercase">{s.markaModel}</p>
                  <p className="text-[9px] text-slate-500 font-bold tracking-tighter">{s.ariza}</p>
                </div>
                <span className={`text-[9px] font-black px-2 py-1 rounded ${s.tamirDurumu === 'Evet' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                  {s.tamirDurumu === 'Evet' ? 'OK' : 'HATA'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;

