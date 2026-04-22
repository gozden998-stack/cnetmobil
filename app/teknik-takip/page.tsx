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
  // GÜNCELLENEN PERSONEL LİSTELERİ
  const USTALAR = [
    "ABOBAKR KAMAL", 
    "AHMET MERT GÖKÇE", 
    "ANIL AYDIN", 
    "M.OMAR NAWID KAMAL", 
    "MURAT BEKTAŞ", 
    "MEHMET ŞERİF DEMİRKIRAN"
  ];
  
  const TEST_PERSONELI = [
    "ALİ ERÇİN", 
    "YUSUF GENCAY", 
    "ESAT AYDIN", 
    "SEMİH AYVA"
  ];

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

  // İSTATİSTİK HESAPLAMA (İADE EKLENDİ)
  const toplamBiten = satirlar.filter(s => s.kaydedildi).length;
  const basarili = satirlar.filter(s => s.kaydedildi && s.tamirDurumu === 'Evet').length;
  const hatali = satirlar.filter(s => s.kaydedildi && s.tamirDurumu === 'Hayır').length;
  const iadeDurumu = satirlar.filter(s => s.kaydedildi && s.tamirDurumu === 'İade').length;
  const basariOrani = toplamBiten > 0 ? Math.round((basarili / toplamBiten) * 100) : 0;

  // DURUM RENKLENDİRME YARDIMCISI
  const getDurumRenk = (durum: string) => {
    if (durum === 'Evet') return 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 focus:border-emerald-500';
    if (durum === 'Hayır') return 'bg-rose-500/10 border-rose-500/30 text-rose-400 focus:border-rose-500';
    if (durum === 'İade') return 'bg-purple-500/10 border-purple-500/30 text-purple-400 focus:border-purple-500';
    return 'bg-slate-900 border-slate-700 text-slate-300';
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-4 md:p-8 font-sans selection:bg-blue-500/30">
      
      {/* PROFESYONEL DASHBOARD ÜST KISIM */}
      <div className="max-w-[1400px] mx-auto mb-8 animate-in fade-in slide-in-from-top-4 duration-500">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-slate-800/80 pb-6">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-white flex items-center gap-4">
              <div className="w-2 h-8 bg-blue-600 rounded-full shadow-[0_0_15px_rgba(37,99,235,0.5)]"></div>
              CNET TEKNİK SERVİS
            </h1>
            <p className="text-sm text-slate-400 font-medium mt-2 flex items-center gap-2">
               <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
               Kalite Kontrol & Performans Takip Paneli
            </p>
          </div>
          
          <div className="flex gap-3">
            <button onClick={raporIndir} className="bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-white px-6 py-3 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-lg shadow-black/20 group">
              <svg className="w-4 h-4 text-blue-400 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              RAPORU İNDİR (CSV)
            </button>
            {/* LİSTEYİ SIFIRLA BUTONU İPTAL EDİLDİ */}
          </div>
        </div>

        {/* ÖZET KARTLARI (5 KARTA ÇIKARILDI) */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mt-6">
          {[
            { t: "TOPLAM İŞLEM", v: toplamBiten, c: "text-blue-400", b: "border-blue-500/20", bg: "bg-blue-500/5" },
            { t: "SORUNSUZ (OK)", v: basarili, c: "text-emerald-400", b: "border-emerald-500/20", bg: "bg-emerald-500/5" },
            { t: "HATALI DÖNÜŞ", v: hatali, c: "text-rose-400", b: "border-rose-500/20", bg: "bg-rose-500/5" },
            { t: "İADE CİHAZ", v: iadeDurumu, c: "text-purple-400", b: "border-purple-500/20", bg: "bg-purple-500/5" },
            { t: "BAŞARI PUANI", v: `%${basariOrani}`, c: "text-amber-400", b: "border-amber-500/20", bg: "bg-amber-500/5" }
          ].map((k, i) => (
            <div key={i} className={`bg-gradient-to-br from-slate-900 to-slate-950 border ${k.b} p-5 rounded-2xl relative overflow-hidden group hover:-translate-y-0.5 transition-transform`}>
              <div className={`absolute -right-4 -top-4 w-16 h-16 rounded-full ${k.bg} blur-xl group-hover:scale-150 transition-transform duration-500`}></div>
              <p className="text-[11px] font-bold text-slate-400 tracking-wider uppercase mb-1 relative z-10">{k.t}</p>
              <p className={`text-3xl font-black relative z-10 tracking-tight ${k.c}`}>{k.v}</p>
            </div>
          ))}
        </div>
      </div>

      {/* TABLO KONTEYNER */}
      <div className="max-w-[1400px] mx-auto bg-slate-900/40 border border-slate-800/80 rounded-3xl overflow-hidden shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[1250px]">
            <thead className="bg-slate-950/80 text-[10px] uppercase font-bold tracking-wider text-slate-400 border-b border-slate-800/80">
              <tr>
                <th className="p-4 w-[160px]">Usta</th>
                <th className="p-4 w-[200px]">Cihaz Marka / Model</th>
                <th className="p-4 w-[180px]">IMEI Kaydı</th>
                <th className="p-4 w-[180px]">Arıza Tanımı</th>
                <th className="p-4 w-[160px] text-center">Tamir Durumu</th>
                <th className="p-4 min-w-[160px]">Hata Detayı</th>
                <th className="p-4 w-[150px]">Test Personeli</th>
                <th className="p-4 w-[120px] text-center">Aksiyon</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40">
              {satirlar.map((satir, i) => (
                <tr 
                  key={satir.id} 
                  className={`transition-colors duration-200 ${
                    satir.kaydedildi 
                      ? 'bg-slate-900/20 hover:bg-slate-900/40' 
                      : 'bg-blue-950/20 hover:bg-blue-900/30'
                  }`}
                >
                  <td className="p-3">
                    <select 
                      disabled={satir.kaydedildi} 
                      value={satir.usta} 
                      onChange={(e) => veriGuncelle(satir.id, 'usta', e.target.value)} 
                      className="w-full bg-slate-950/50 border border-slate-700/80 rounded-xl p-2.5 text-xs outline-none focus:border-blue-500 disabled:bg-transparent disabled:border-transparent disabled:text-slate-300 disabled:font-medium disabled:appearance-none transition-all text-slate-200"
                    >
                      <option value="">Seçiniz...</option>
                      {USTALAR.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </td>
                  
                  <td className="p-3">
                    <input 
                      disabled={satir.kaydedildi} 
                      type="text" 
                      value={satir.markaModel} 
                      placeholder="Örn: iPhone 15 Pro" 
                      className="w-full bg-slate-950/50 border border-slate-700/80 rounded-xl p-2.5 text-xs outline-none focus:border-blue-500 disabled:bg-transparent disabled:border-transparent disabled:text-white disabled:font-bold disabled:px-0 transition-all text-slate-200 placeholder-slate-600" 
                      onChange={(e) => veriGuncelle(satir.id, 'markaModel', e.target.value)} 
                    />
                  </td>
                  
                  <td className="p-3">
                    <input 
                      disabled={satir.kaydedildi} 
                      type="text" 
                      value={satir.imei} 
                      placeholder="35XXXXXXXXXXXXX" 
                      className="w-full bg-slate-950/50 border border-slate-700/80 rounded-xl p-2.5 text-[11px] font-mono outline-none focus:border-blue-500 disabled:bg-transparent disabled:border-transparent disabled:text-slate-400 disabled:px-0 transition-all text-slate-200 placeholder-slate-600" 
                      onChange={(e) => veriGuncelle(satir.id, 'imei', e.target.value)} 
                    />
                  </td>
                  
                  <td className="p-3">
                    <input 
                      disabled={satir.kaydedildi} 
                      type="text" 
                      value={satir.ariza} 
                      placeholder="Ekran, Soket vs." 
                      className="w-full bg-slate-950/50 border border-slate-700/80 rounded-xl p-2.5 text-xs outline-none focus:border-blue-500 disabled:bg-transparent disabled:border-transparent disabled:text-slate-300 disabled:px-0 transition-all text-slate-200 placeholder-slate-600" 
                      onChange={(e) => veriGuncelle(satir.id, 'ariza', e.target.value)} 
                    />
                  </td>
                  
                  <td className="p-3">
                    <select 
                      disabled={satir.kaydedildi} 
                      value={satir.tamirDurumu} 
                      className={`w-full border rounded-xl p-2.5 text-[11px] font-bold outline-none transition-all text-center disabled:appearance-none ${getDurumRenk(satir.tamirDurumu)}`} 
                      onChange={(e) => veriGuncelle(satir.id, 'tamirDurumu', e.target.value)}
                    >
                      <option value="Evet" className="text-emerald-500 bg-slate-900">✅ SORUNSUZ</option>
                      <option value="Hayır" className="text-rose-500 bg-slate-900">❌ SORUNLU</option>
                      <option value="İade" className="text-purple-500 bg-slate-900">🔄 İADE</option>
                    </select>
                  </td>
                  
                  <td className="p-3">
                    <input 
                      disabled={satir.kaydedildi} 
                      type="text" 
                      value={satir.neden} 
                      placeholder="Hata/İade Notu..." 
                      className="w-full bg-slate-950/50 border border-slate-700/80 rounded-xl p-2.5 text-xs outline-none focus:border-blue-500 disabled:bg-transparent disabled:border-transparent disabled:text-rose-300 disabled:font-medium disabled:px-0 transition-all text-slate-200 placeholder-slate-600" 
                      onChange={(e) => veriGuncelle(satir.id, 'neden', e.target.value)} 
                    />
                  </td>
                  
                  <td className="p-3">
                    <select 
                      disabled={satir.kaydedildi} 
                      value={satir.testYapan} 
                      onChange={(e) => veriGuncelle(satir.id, 'testYapan', e.target.value)} 
                      className="w-full bg-slate-950/50 border border-slate-700/80 rounded-xl p-2.5 text-xs outline-none focus:border-blue-500 disabled:bg-transparent disabled:border-transparent disabled:text-slate-400 disabled:px-0 disabled:appearance-none transition-all text-slate-200"
                    >
                      <option value="">Seçiniz...</option>
                      {TEST_PERSONELI.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </td>
                  
                  <td className="p-3 text-center">
                    {!satir.kaydedildi ? (
                      <div className="flex items-center justify-center">
                        <button 
                          onClick={() => satirKaydet(satir.id)} 
                          className="bg-blue-600 hover:bg-blue-500 text-white w-full py-2.5 px-3 rounded-lg transition-all font-bold text-[10px] shadow-lg shadow-blue-600/20 flex items-center justify-center gap-1.5"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                          KAYDET
                        </button>
                        {/* PERSONEL SİLME BUTONU İPTAL EDİLDİ */}
                      </div>
                    ) : (
                      <div className="flex flex-col gap-1.5 items-center justify-center h-full">
                        <span className="text-slate-400 font-bold text-[9px] tracking-widest bg-slate-800/50 border border-slate-700 px-3 py-1.5 rounded-md uppercase flex items-center gap-1">
                          <svg className="w-3 h-3 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          KAYDEDİLDİ
                        </span>
                        {satir.tamirDurumu === 'Evet' && (
                          <a 
                            href={`https://wa.me/?text=${encodeURIComponent(satir.markaModel + " cihazınızın tamiri bitmiştir, teslim alabilirsiniz.")}`} 
                            target="_blank" 
                            rel="noreferrer"
                            className="text-emerald-400/80 text-[9px] font-bold hover:text-emerald-400 flex items-center gap-1 transition-colors"
                          >
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.89-4.443 9.893-9.896.002-5.466-4.415-9.898-9.881-9.9-5.466-.003-9.892 4.438-9.896 9.895-.002 2.105.575 4.158 1.671 5.977l-1.144 4.181 4.265-1.149zm8.851-6.111c-.493-.247-2.918-1.441-3.369-1.606-.451-.165-.78-.247-1.109.247-.329.494-1.272 1.606-1.56 1.936-.288.33-.576.371-1.07.124-.494-.247-2.083-.769-3.97-2.456-1.464-1.31-2.453-2.928-2.741-3.422-.288-.494-.03-.761.217-1.008.221-.221.493-.576.74-.864.247-.288.329-.494.494-.823.164-.329.082-.617-.041-.864-.124-.247-1.109-2.675-1.521-3.663-.399-.957-.803-.827-1.109-.843-.288-.015-.617-.015-.946-.015-.329 0-.864.124-1.316.617-.452.494-1.727 1.688-1.727 4.118s1.768 4.777 2.015 5.106c.247.329 3.484 5.319 8.441 7.458 1.18.51 2.1.815 2.818 1.043 1.183.376 2.261.323 3.111.196.953-.142 2.918-1.193 3.329-2.345.411-1.152.411-2.14.288-2.345-.124-.205-.452-.329-.946-.576z"/></svg>
                            Müşteriye Bildir
                          </a>
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
