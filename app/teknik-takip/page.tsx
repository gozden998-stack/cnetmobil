"use client";

import React, { useState, useEffect } from 'react';

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

  // Sayfa ilk açıldığında varsa eski verileri yükle
  const [satirlar, setSatirlar] = useState<Satir[]>([]);

  useEffect(() => {
    const kaydedilmis = localStorage.getItem('cnet_teknik_kayitlar');
    if (kaydedilmis) {
      setSatirlar(JSON.parse(kaydedilmis));
    } else {
      setSatirlar([{ id: Date.now(), usta: '', markaModel: '', imei: '', ariza: '', tamirDurumu: 'Evet', neden: '', testYapan: '', kaydedildi: false }]);
    }
  }, []);

  // Her değişiklikte veriyi tarayıcıya yedekle
  useEffect(() => {
    if (satirlar.length > 0) {
      localStorage.setItem('cnet_teknik_kayitlar', JSON.stringify(satirlar));
    }
  }, [satirlar]);

  const yeniSatirOlustur = () => ({
    id: Date.now(), usta: '', markaModel: '', imei: '', ariza: '', tamirDurumu: 'Evet', neden: '', testYapan: '', kaydedildi: false
  });

  const satirSil = (id: number) => {
    if (confirm("Bu kaydı silmek istediğinize emin misiniz?")) {
      setSatirlar(satirlar.filter(s => s.id !== id));
    }
  };

  const veriGuncelle = (id: number, alan: keyof Satir, deger: string | boolean) => {
    setSatirlar(satirlar.map(s => s.id === id ? { ...s, [alan]: deger } : s));
  };

  const satirKaydet = (id: number) => {
    const suanki = satirlar.find(s => s.id === id);
    if (!suanki?.usta || !suanki?.markaModel) {
      alert("Hata: Usta ve Marka/Model boş bırakılamaz!");
      return;
    }

    setSatirlar(prev => {
      const yeniListe = prev.map(s => s.id === id ? { ...s, kaydedildi: true } : s);
      return [...yeniListe, yeniSatirOlustur()];
    });
  };

  // EXCEL / CSV OLARAK İNDİR
  const raporIndir = () => {
    const headers = ["Usta,Marka Model,IMEI,Ariza,Durum,Hata Nedeni,Test Eden\n"];
    const rows = satirlar.filter(s => s.kaydedildi).map(s => 
      `${s.usta},${s.markaModel},${s.imei},${s.ariza},${s.tamirDurumu},${s.neden},${s.testYapan}\n`
    );
    const blob = new Blob([headers + rows.join("")], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `Cnetmobil_Teknik_Rapor_${new Date().toLocaleDateString()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // İSTATİSTİK HESAPLAMA
  const toplamBiten = satirlar.filter(s => s.kaydedildi).length;
  const basarili = satirlar.filter(s => s.kaydedildi && s.tamirDurumu === 'Evet').length;
  const hatali = satirlar.filter(s => s.kaydedildi && s.tamirDurumu === 'Hayır').length;
  const basariOrani = toplamBiten > 0 ? Math.round((basarili / toplamBiten) * 100) : 0;

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 p-3 md:p-8 font-sans">
      
      {/* PROFESYONEL DASHBOARD ÜST KISIM */}
      <div className="max-w-[1400px] mx-auto mb-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tighter text-white flex items-center gap-3">
              <span className="bg-blue-600 p-2 rounded-lg text-xl">CNET</span> 
              TEKNİK SERVİS PANELİ
            </h1>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-[0.2em] mt-2">Kalite Kontrol & Performans Takibi</p>
          </div>
          
          <div className="flex gap-3">
            <button onClick={raporIndir} className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white px-5 py-3 rounded-2xl text-xs font-black transition-all flex items-center gap-2">
              📊 RAPORU İNDİR (CSV)
            </button>
            <button onClick={() => { localStorage.clear(); window.location.reload(); }} className="bg-red-900/20 hover:bg-red-900/40 border border-red-900/50 text-red-500 px-5 py-3 rounded-2xl text-xs font-black transition-all">
              🗑️ LİSTEYİ SIFIRLA
            </button>
          </div>
        </div>

        {/* ÖZET KARTLARI */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
          {[
            { t: "TOPLAM CİHAZ", v: toplamBiten, c: "text-blue-500" },
            { t: "SORUNSUZ (OK)", v: basarili, c: "text-emerald-500" },
            { t: "HATALI DÖNÜŞ", v: hatali, c: "text-rose-500" },
            { t: "BAŞARI PUANI", v: `%${basariOrani}`, c: "text-amber-500" }
          ].map((k, i) => (
            <div key={i} className="bg-slate-900/50 border border-slate-800 p-5 rounded-3xl">
              <p className="text-[10px] font-black text-slate-500 tracking-widest uppercase">{k.t}</p>
              <p className={`text-3xl font-black mt-2 ${k.c}`}>{k.v}</p>
            </div>
          ))}
        </div>
      </div>

      {/* TABLO KONTEYNER */}
      <div className="max-w-[1400px] mx-auto bg-slate-900/40 border border-slate-800 rounded-[2rem] overflow-hidden shadow-2xl backdrop-blur-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1200px]">
            <thead className="bg-slate-800/50 text-[10px] uppercase font-black tracking-[0.15em] text-slate-400">
              <tr>
                <th className="p-5 border-b border-slate-800">Usta</th>
                <th className="p-5 border-b border-slate-800">Cihaz Marka / Model</th>
                <th className="p-5 border-b border-slate-800">IMEI Kaydı</th>
                <th className="p-5 border-b border-slate-800">Arıza Tanımı</th>
                <th className="p-5 border-b border-slate-800">Tamir Durumu</th>
                <th className="p-5 border-b border-slate-800">Hata Detayı</th>
                <th className="p-5 border-b border-slate-800">Test Personeli</th>
                <th className="p-5 border-b border-slate-800 text-center">Aksiyon</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {satirlar.map((satir) => (
                <tr key={satir.id} className={`transition-all ${satir.kaydedildi ? 'bg-slate-900/20 opacity-50' : 'hover:bg-slate-800/20'} ${satir.tamirDurumu === 'Hayır' && !satir.kaydedildi ? 'bg-rose-900/5' : ''}`}>
                  <td className="p-3">
                    <select disabled={satir.kaydedildi} value={satir.usta} onChange={(e) => veriGuncelle(satir.id, 'usta', e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-xs outline-none focus:ring-2 focus:ring-blue-600 transition-all">
                      <option value="">Seçiniz...</option>
                      {USTALAR.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </td>
                  <td className="p-3 text-white">
                    <input disabled={satir.kaydedildi} type="text" value={satir.markaModel} placeholder="Örn: iPhone 15 Pro" className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-xs outline-none focus:ring-2 focus:ring-blue-600" onChange={(e) => veriGuncelle(satir.id, 'markaModel', e.target.value)} />
                  </td>
                  <td className="p-3">
                    <input disabled={satir.kaydedildi} type="text" value={satir.imei} placeholder="35XXXXXXXXXXXXX" className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-[11px] font-mono outline-none focus:ring-2 focus:ring-blue-600" onChange={(e) => veriGuncelle(satir.id, 'imei', e.target.value)} />
                  </td>
                  <td className="p-3">
                    <input disabled={satir.kaydedildi} type="text" value={satir.ariza} placeholder="Ekran, Soket vs." className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-xs outline-none focus:ring-2 focus:ring-blue-600" onChange={(e) => veriGuncelle(satir.id, 'ariza', e.target.value)} />
                  </td>
                  <td className="p-3">
                    <select disabled={satir.kaydedildi} value={satir.tamirDurumu} className={`w-full border rounded-xl p-3 text-xs font-bold outline-none transition-all ${satir.tamirDurumu === 'Evet' ? 'bg-emerald-900/20 border-emerald-800 text-emerald-500' : 'bg-rose-900/20 border-rose-800 text-rose-500'}`} onChange={(e) => veriGuncelle(satir.id, 'tamirDurumu', e.target.value)}>
                      <option value="Evet">✅ SORUNSUZ</option>
                      <option value="Hayır">❌ SORUNLU</option>
                    </select>
                  </td>
                  <td className="p-3">
                    <input disabled={satir.kaydedildi} type="text" value={satir.neden} placeholder="Hata varsa not al..." className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-xs outline-none" onChange={(e) => veriGuncelle(satir.id, 'neden', e.target.value)} />
                  </td>
                  <td className="p-3">
                    <select disabled={satir.kaydedildi} value={satir.testYapan} onChange={(e) => veriGuncelle(satir.id, 'testYapan', e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-xs outline-none">
                      <option value="">Seçiniz...</option>
                      {TEST_PERSONELI.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </td>
                  <td className="p-3 text-center">
                    {!satir.kaydedildi ? (
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => satirKaydet(satir.id)} className="bg-blue-600 hover:bg-blue-500 text-white w-full py-3 rounded-xl transition-all font-black text-[10px] shadow-lg shadow-blue-900/20">
                          💾 KAYDET
                        </button>
                        <button onClick={() => satirSil(satir.id)} className="bg-slate-800 hover:bg-red-900/40 text-slate-500 hover:text-white p-3 rounded-xl transition-all border border-slate-700">
                          🗑️
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-1 items-center">
                        <span className="text-emerald-500 font-black text-[9px] tracking-widest bg-emerald-500/10 px-3 py-1 rounded-full uppercase">KAYIT TAMAM</span>
                        {satir.tamirDurumu === 'Evet' && (
                          <a href={`https://wa.me/?text=${encodeURIComponent(satir.markaModel + " cihazınızın tamiri bitmiştir, teslim alabilirsiniz.")}`} target="_blank" className="text-blue-400 text-[8px] font-bold underline hover:text-white">WHATSAPP BİLDİR</a>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default TeknikTakipTablosu;
