"use client";

import React, { useState } from 'react';

// Satır yapısını TypeScript'e tanıtıyoruz
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

const TeknikTakipTablosu = () => {
  const USTALAR = ["Hakan Usta", "Murat Usta", "Zeki Usta", "Veli Usta"];
  const TEST_PERSONELI = ["Ahmet", "Mehmet", "Can", "Elif"];

  const [satirlar, setSatirlar] = useState<Satir[]>([
    { id: Date.now(), usta: '', markaModel: '', imei: '', ariza: '', tamirDurumu: 'Evet', neden: '', testYapan: '', kaydedildi: false }
  ]);

  const yeniSatirEkle = () => {
    setSatirlar([...satirlar, { id: Date.now(), usta: '', markaModel: '', imei: '', ariza: '', tamirDurumu: 'Evet', neden: '', testYapan: '', kaydedildi: false }]);
  };

  // id'nin bir 'number' olduğunu belirterek hatayı çözüyoruz
  const satirSil = (id: number) => {
    setSatirlar(satirlar.filter(s => s.id !== id));
  };

  const veriGuncelle = (id: number, alan: keyof Satir, deger: string | boolean) => {
    setSatirlar(satirlar.map(s => s.id === id ? { ...s, [alan]: deger } : s));
  };

  const satirKaydet = (id: number) => {
    setSatirlar(satirlar.map(s => s.id === id ? { ...s, kaydedildi: true } : s));
    alert("Kayıt Başarıyla Sisteme İşlendi!");
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200 p-2 md:p-6 font-sans">
      <div className="max-w-[1400px] mx-auto flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-tighter text-white">
            ✅ TEKNİK SERVİS KALİTE KONTROL
          </h1>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Cnetmobil Servis Takip</p>
        </div>
        <button 
          onClick={yeniSatirEkle}
          className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-2xl text-xs font-black transition-all shadow-xl shadow-blue-900/20"
        >
          ➕ YENİ SATIR EKLE
        </button>
      </div>

      <div className="max-w-[1400px] mx-auto bg-slate-900/50 border border-slate-800 rounded-3xl overflow-x-auto shadow-2xl">
        <table className="w-full text-left border-collapse min-w-[1000px]">
          <thead className="bg-slate-800/80 text-[10px] uppercase font-black tracking-widest text-slate-400">
            <tr>
              <th className="p-4 border-b border-slate-700">Tamir Yapan Usta</th>
              <th className="p-4 border-b border-slate-700">Marka / Model</th>
              <th className="p-4 border-b border-slate-700">IMEI</th>
              <th className="p-4 border-b border-slate-700">Arıza</th>
              <th className="p-4 border-b border-slate-700">Tamir Sorunsuz mu?</th>
              <th className="p-4 border-b border-slate-700">Değilse Neden?</th>
              <th className="p-4 border-b border-slate-700">Test Yapan</th>
              <th className="p-4 border-b border-slate-700 text-center">İşlem</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {satirlar.map((satir) => (
              <tr key={satir.id} className={`transition-all ${satir.kaydedildi ? 'bg-emerald-900/10 opacity-70' : 'hover:bg-slate-800/30'}`}>
                <td className="p-2">
                  <select value={satir.usta} onChange={(e) => veriGuncelle(satir.id, 'usta', e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs outline-none">
                    <option value="">Seçiniz...</option>
                    {USTALAR.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </td>
                <td className="p-2">
                  <input type="text" value={satir.markaModel} placeholder="Örn: iPhone 11" className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs outline-none" onChange={(e) => veriGuncelle(satir.id, 'markaModel', e.target.value)} />
                </td>
                <td className="p-2">
                  <input type="text" value={satir.imei} placeholder="15 Hane" className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-[10px] font-mono outline-none" onChange={(e) => veriGuncelle(satir.id, 'imei', e.target.value)} />
                </td>
                <td className="p-2">
                  <input type="text" value={satir.ariza} placeholder="Arıza detayı" className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs outline-none" onChange={(e) => veriGuncelle(satir.id, 'ariza', e.target.value)} />
                </td>
                <td className="p-2">
                  <select value={satir.tamirDurumu} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs outline-none" onChange={(e) => veriGuncelle(satir.id, 'tamirDurumu', e.target.value)}>
                    <option value="Evet">Evet</option>
                    <option value="Hayır">Hayır</option>
                  </select>
                </td>
                <td className="p-2">
                  <input type="text" value={satir.neden} placeholder="Sorun varsa yazın" className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs outline-none" onChange={(e) => veriGuncelle(satir.id, 'neden', e.target.value)} />
                </td>
                <td className="p-2">
                  <select value={satir.testYapan} onChange={(e) => veriGuncelle(satir.id, 'testYapan', e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs outline-none">
                    <option value="">Seçiniz...</option>
                    {TEST_PERSONELI.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </td>
                <td className="p-2 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <button onClick={() => satirKaydet(satir.id)} className={`px-3 py-2 rounded-lg transition-all font-bold text-[10px] ${satir.kaydedildi ? 'bg-emerald-600 text-white' : 'bg-blue-600 hover:bg-blue-500 text-white'}`}>
                      💾 KAYDET
                    </button>
                    <button onClick={() => satirSil(satir.id)} className="px-3 py-2 bg-slate-700 hover:bg-red-900 text-slate-400 hover:text-white rounded-lg transition-all font-bold text-[10px]">
                      🗑️ SİL
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TeknikTakipTablosu;
