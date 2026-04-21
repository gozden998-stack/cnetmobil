"use client";

import React, { useState } from 'react';

// İstatistik Kartı Bileşeni
const StatKart = ({ baslik, deger, degisim, renk }: any) => (
  <div className="bg-slate-900 border border-slate-800 p-6 rounded-[2rem] shadow-xl">
    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{baslik}</p>
    <div className="flex items-end justify-between mt-2">
      <h3 className={`text-3xl font-black ${renk}`}>{deger}</h3>
      <span className="text-emerald-500 text-[10px] font-bold bg-emerald-500/10 px-2 py-1 rounded-lg">
        {degisim}
      </span>
    </div>
  </div>
);

const AdminDashboard = () => {
  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 p-4 md:p-10">
      
      {/* ÜST HEADER */}
      <div className="max-w-7xl mx-auto flex flex-col md:row justify-between items-start md:items-center mb-10 gap-4">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tighter uppercase">
            Cnetmobil <span className="text-blue-600">Admin</span>
          </h1>
          <p className="text-slate-500 text-xs font-bold mt-1 tracking-[0.3em]">GENEL OPERASYON MERKEZİ</p>
        </div>
        
        <div className="flex gap-3">
          <button className="bg-slate-800 p-3 rounded-xl hover:bg-slate-700 transition-all text-xs font-bold border border-slate-700">
            ⚙️ Sistem Ayarları
          </button>
          <button className="bg-blue-600 p-3 rounded-xl hover:bg-blue-500 text-white text-xs font-black transition-all shadow-lg shadow-blue-900/40">
            📊 Rapor Oluştur
          </button>
        </div>
      </div>

      {/* ANA İSTATİSTİKLER */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        <StatKart baslik="Aylık Toplam Tamir" deger="1,284" degisim="+12%" renk="text-white" />
        <StatKart baslik="Teknik Başarı Oranı" deger="%94.2" degisim="+2.4" renk="text-emerald-500" />
        <StatKart baslik="Zumay Kanal Girişi" deger="452" degisim="+18%" renk="text-red-500" />
        <StatKart baslik="Aktif Mağaza" deger="8" degisim="Stabil" renk="text-blue-500" />
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* SOL: KANAL PERFORMANSI */}
        <div className="lg:col-span-2 bg-slate-900/50 border border-slate-800 rounded-[2.5rem] p-8 shadow-2xl">
          <h3 className="text-lg font-black text-white mb-6 uppercase tracking-tight">Kanal Bazlı İş Hacmi</h3>
          <div className="space-y-6">
            {/* Örnek Bar Grafik Yapısı */}
            {[
              { isim: "Cnetmobil Merkez", adet: 540, renk: "bg-blue-600", yuzde: "w-[75%]" },
              { isim: "Zumay Kanalı", adet: 310, renk: "bg-red-600", yuzde: "w-[45%]" },
              { isim: "Vodafone Bayi", adet: 220, renk: "bg-emerald-600", yuzde: "w-[30%]" }
            ].map((item, i) => (
              <div key={i} className="space-y-2">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-slate-400">{item.isim}</span>
                  <span className="text-white">{item.adet} Cihaz</span>
                </div>
                <div className="h-3 bg-slate-800 rounded-full overflow-hidden">
                  <div className={`h-full ${item.renk} ${item.yuzde} transition-all duration-1000`}></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* SAĞ: USTA LİDERLİK TABLOSU */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-[2.5rem] p-8 shadow-2xl">
          <h3 className="text-lg font-black text-white mb-6 uppercase tracking-tight">Usta Skorları</h3>
          <div className="divide-y divide-slate-800">
            {[
              { usta: "Hakan Usta", skor: "%98", is: 145 },
              { usta: "Murat Usta", skor: "%92", is: 132 },
              { usta: "Veli Usta", skor: "%88", is: 98 },
              { usta: "Zeki Usta", skor: "%85", is: 110 }
            ].map((u, i) => (
              <div key={i} className="py-4 flex justify-between items-center">
                <div>
                  <p className="text-sm font-black text-white">{u.usta}</p>
                  <p className="text-[10px] text-slate-500 font-bold">{u.is} Tamir Bitti</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-emerald-500">{u.skor}</p>
                  <p className="text-[9px] text-slate-600 uppercase font-bold tracking-tighter">Başarı</p>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* ALT: HIZLI ERİŞİM MENÜSÜ */}
      <div className="max-w-7xl mx-auto mt-10 grid grid-cols-2 md:grid-cols-4 gap-4">
        <button className="p-6 bg-blue-600/10 border border-blue-600/20 rounded-3xl text-blue-500 hover:bg-blue-600/20 transition-all font-black text-xs uppercase tracking-widest">
           📱 Teknik Takip Paneli
        </button>
        <button className="p-6 bg-emerald-600/10 border border-emerald-600/20 rounded-3xl text-emerald-500 hover:bg-emerald-600/20 transition-all font-black text-xs uppercase tracking-widest">
           💰 Cihaz Satış (Buyback)
        </button>
        <button className="p-6 bg-red-600/10 border border-red-600/20 rounded-3xl text-red-500 hover:bg-red-600/20 transition-all font-black text-xs uppercase tracking-widest">
           🌐 Zumay Kanalı Yönetimi
        </button>
        <button className="p-6 bg-purple-600/10 border border-purple-600/20 rounded-3xl text-purple-500 hover:bg-purple-600/20 transition-all font-black text-xs uppercase tracking-widest">
           👥 Personel & Prim
        </button>
      </div>

    </div>
  );
};

export default AdminDashboard;
