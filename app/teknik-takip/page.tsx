"use client";

import React, { useState } from 'react';

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
  // Buradaki isimleri dilediğin gibi düzenle
  const USTALAR = ["Hakan Usta", "Murat Usta", "Zeki Usta", "Veli Usta"];
  const TEST_PERSONELI = ["Ahmet", "Mehmet", "Can", "Elif"];

  const [satirlar, setSatirlar] = useState<Satir[]>([
    { id: Date.now(), usta: '', markaModel: '', imei: '', ariza: '', tamirDurumu: 'Evet', neden: '', testYapan: '', kaydedildi: false }
  ]);

  // Yeni satır oluşturma fonksiyonu (İçeride kullanacağız)
  const yeniSatirOlustur = () => {
    return { 
      id: Date.now(), 
      usta: '', 
      markaModel: '', 
      imei: '', 
      ariza: '', 
      tamirDurumu: 'Evet', 
      neden: '', 
      testYapan: '', 
      kaydedildi: false 
    };
  };

  const satirSil = (id: number) => {
    if (satirlar.length > 1) {
      setSatirlar(satirlar.filter(s => s.id !== id));
    }
  };

  const veriGuncelle = (id: number, alan: keyof Satir, deger: string | boolean) => {
    setSatirlar(satirlar.map(s => s.id === id ? { ...s, [alan]: deger } : s));
  };

  // --- KRİTİK NOKTA: KAYDET VE ALT SATIRA GEÇ ---
  const satirKaydet = (id: number) => {
    // 1. Mevcut satırı bul ve kontrol et
    const suankiSatir = satirlar.find(s => s.id === id);
    if (!suankiSatir?.usta || !suankiSatir?.markaModel) {
      alert("Lütfen en azından Usta ve Model bilgilerini doldurun!");
      return;
    }

    // 2. Mevcut satırı kaydet ve hemen altına yeni bir boş satır ekle
    setSatirlar((prev) => {
      const guncelListe = prev.map(s => s.id === id ? { ...s, kaydedildi: true } : s);
      return [...guncelListe, yeniSatirOlustur()];
    });
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200 p-2 md:p-6 font-sans">
      <div className="max-w-[1400px] mx-auto mb-8">
        <h1 className="text-2xl font-black uppercase tracking-tighter text-white">
          ✅ KALİTE KONTROL TAKİP SİSTEMİ
        </h1>
        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">
          Kaydet butonuna basınca otomatik alt satıra geçer
        </p>
      </div>

      <div className="max-w-[1400px] mx-auto bg-slate-900/50 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1100px]">
            <thead className="bg-slate-800/80 text-[10px] uppercase font-black tracking-widest text-slate-400">
              <tr>
                <th className="p-4 border-b border-slate-700">Usta</th>
                <th className="p-4 border-b border-slate-700">Marka / Model</th>
                <th className="p-4 border-b border-slate-700">IMEI</th>
                <th className="p-4 border-b border-slate-700">Arıza</th>
                <th className="p-4 border-b border-slate-700">Durum</th>
                <th className="p-4 border-b border-slate-700">Hata Nedeni</th>
                <th className="p-4 border-b border-slate-700">Test Eden</th>
                <th className="p-4 border-b border-slate-700 text-center">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {satirlar.map((satir) => (
                <tr key={satir.id} className={`transition-all ${satir.kaydedildi ? 'bg-emerald-900/10 opacity-60 pointer-events-none' : 'hover:bg-slate-800/30'}`}>
                  <td className="p-2">
                    <select value={satir.usta} onChange={(e) => veriGuncelle(satir.id, 'usta', e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs outline-none focus:border-blue-500">
                      <option value="">Seçiniz...</option>
                      {USTALAR.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </td>
                  <td className="p-2">
                    <input type="text" value={satir.markaModel} placeholder="iPhone 13..." className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs outline-none focus:border-blue-500" onChange={(e) => veriGuncelle(satir.id, 'markaModel', e.target.value)} />
                  </td>
                  <td className="p-2">
                    <input type="text" value={satir.imei} placeholder="IMEI" className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-[10px] font-mono outline-none focus:border-blue-500" onChange={(e) => veriGuncelle(satir.id, 'imei', e.target.value)} />
                  </td>
                  <td className="p-2">
                    <input type="text" value={satir.ariza} placeholder="Ekran..." className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs outline-none focus:border-blue-500" onChange={(e) => veriGuncelle(satir.id, 'ariza', e.target.value)} />
                  </td>
                  <td className="p-2">
                    <select value={satir.tamirDurumu} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs outline-none" onChange={(e) => veriGuncelle(satir.id, 'tamirDurumu', e.target.value)}>
                      <option value="Evet">Sorunsuz</option>
                      <option value="Hayır">Sorunlu</option>
                    </select>
                  </td>
                  <td className="p-2">
                    <input type="text" value={satir.neden} placeholder="Hata varsa..." className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs outline-none" onChange={(e) => veriGuncelle(satir.id, 'neden', e.target.value)} />
                  </td>
                  <td className="p-2">
                    <select value={satir.testYapan} onChange={(e) => veriGuncelle(satir.id, 'testYapan', e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs outline-none">
                      <option value="">Seçiniz...</option>
                      {TEST_PERSONELI.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </td>
                  <td className="p-2 text-center">
                    {!satir.kaydedildi ? (
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => satirKaydet(satir.id)} className="bg-blue-600 hover:bg-emerald-600 text-white px-3 py-2 rounded-lg transition-all font-black text-[10px]">
                          💾 KAYDET
                        </button>
                        <button onClick={() => satirSil(satir.id)} className="bg-slate-700 hover:bg-red-900 text-slate-400 hover:text-white px-3 py-2 rounded-lg transition-all font-black text-[10px]">
                          🗑️ SİL
                        </button>
                      </div>
                    ) : (
                      <span className="text-emerald-500 font-black text-[10px]">LİSTEYE EKLENDİ</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="max-w-[1400px] mx-auto mt-4 text-[10px] text-slate-500 italic">
        * Not: Sayfa yenilenirse bu liste sıfırlanır. Verilerin kalıcı olması için veritabanı bağlantısı gereklidir.
      </p>
    </div>
  );
};

export default TeknikTakipTablosu;
