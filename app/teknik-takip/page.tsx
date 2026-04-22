"use client";

import React, { useState, useEffect } from 'react';

interface Satir {
  id: number;
  tamirPersoneli: string;
  markaModel: string;
  imei: string;
  ariza: string;
  tamirDurumu: string;
  neden: string;
  testYapan: string;
  kaydedildi: boolean;
}

// YENİ: isAdmin prop'u eklendi. Varsayılan olarak false (personel).
interface Props {
  isAdmin?: boolean;
}

const TeknikTakipTablosu = ({ isAdmin = false }: Props) => {
  const TAMIR_PERSONELI_LISTESI = [
    "ABOBAKR KAMAL", "AHMET MERT GÖKÇE", "ANIL AYDIN", 
    "M.OMAR NAWID KAMAL", "MURAT BEKTAŞ", "MEHMET ŞERİF DEMİRKIRAN"
  ];
  
  const TEST_PERSONELI = [
    "ALİ ERÇİN", "YUSUF GENCAY", "ESAT AYDIN", "SEMİH AYVA"
  ];

  const [satirlar, setSatirlar] = useState<Satir[]>([]);
  
  // YÖNETİCİ FİLTRE DURUMLARI
  const [filtreUsta, setFiltreUsta] = useState('');
  const [filtreTest, setFiltreTest] = useState('');
  const [filtreDurum, setFiltreDurum] = useState('');

  useEffect(() => {
    const kaydedilmis = localStorage.getItem('cnet_teknik_kayitlar');
    if (kaydedilmis) {
      setSatirlar(JSON.parse(kaydedilmis));
    } else {
      setSatirlar([{ id: Date.now(), tamirPersoneli: '', markaModel: '', imei: '', ariza: '', tamirDurumu: 'Evet', neden: '', testYapan: '', kaydedildi: false }]);
    }
  }, []);

  useEffect(() => {
    if (satirlar.length > 0) {
      localStorage.setItem('cnet_teknik_kayitlar', JSON.stringify(satirlar));
    }
  }, [satirlar]);

  const yeniSatirOlustur = () => ({
    id: Date.now(), tamirPersoneli: '', markaModel: '', imei: '', ariza: '', tamirDurumu: 'Evet', neden: '', testYapan: '', kaydedildi: false
  });

  const veriGuncelle = (id: number, alan: keyof Satir, deger: string | boolean) => {
    setSatirlar(satirlar.map(s => s.id === id ? { ...s, [alan]: deger } : s));
  };

  const satirKaydet = (id: number) => {
    const suanki = satirlar.find(s => s.id === id);
    if (!suanki?.tamirPersoneli || !suanki?.markaModel) {
      alert("Hata: Tamir Personeli ve Marka/Model boş bırakılamaz!");
      return;
    }

    setSatirlar(prev => {
      const yeniListe = prev.map(s => s.id === id ? { ...s, kaydedildi: true } : s);
      return [yeniSatirOlustur(), ...yeniListe];
    });
  };

  // YALNIZCA YÖNETİCİ İÇİN SİLME İŞLEMİ
  const satirSil = (id: number) => {
    if (confirm("Bu kaydı kalıcı olarak silmek istediğinize emin misiniz?")) {
      const yeniListe = satirlar.filter(s => s.id !== id);
      setSatirlar(yeniListe);
      if(yeniListe.length === 0) {
        localStorage.removeItem('cnet_teknik_kayitlar');
        setSatirlar([yeniSatirOlustur()]);
      }
    }
  };

  // AKILLI FİLTRELEME MANTIĞI
  const gercekKayitlar = satirlar.filter(s => s.kaydedildi);
  const taslakSatir = satirlar.filter(s => !s.kaydedildi);

  const filtrelenmisKayitlar = gercekKayitlar.filter(s => {
    const matchUsta = filtreUsta ? s.tamirPersoneli === filtreUsta : true;
    const matchTest = filtreTest ? s.testYapan === filtreTest : true;
    const matchDurum = filtreDurum ? s.tamirDurumu === filtreDurum : true;
    return matchUsta && matchTest && matchDurum;
  });

  // Ekrana basılacak son liste (Taslak her zaman en üstte kalır)
  const gosterilecekTabloVerisi = [...taslakSatir, ...filtrelenmisKayitlar];

  // DİNAMİK İSTATİSTİKLER (Filtrelere Göre Değişir)
  const toplamBiten = filtrelenmisKayitlar.length;
  const basarili = filtrelenmisKayitlar.filter(s => s.tamirDurumu === 'Evet').length;
  const hatali = filtrelenmisKayitlar.filter(s => s.tamirDurumu === 'Hayır').length;
  const iadeDurumu = filtrelenmisKayitlar.filter(s => s.tamirDurumu === 'İade').length;
  const basariOrani = toplamBiten > 0 ? Math.round((basarili / toplamBiten) * 100) : 0;

  const raporIndir = () => {
    const headers = ["Tamir Personeli,Marka Model,IMEI,Ariza,Durum,Hata Nedeni,Test Eden\n"];
    const rows = filtrelenmisKayitlar.map(s => 
      `${s.tamirPersoneli},${s.markaModel},${s.imei},${s.ariza},${s.tamirDurumu},${s.neden},${s.testYapan}\n`
    );
    const blob = new Blob([headers + rows.join("")], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `Cnetmobil_Teknik_Rapor_${new Date().toLocaleDateString()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getDurumRenk = (durum: string) => {
    if (durum === 'Evet') return 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 focus:border-emerald-500';
    if (durum === 'Hayır') return 'bg-rose-500/10 border-rose-500/30 text-rose-400 focus:border-rose-500';
    if (durum === 'İade') return 'bg-purple-500/10 border-purple-500/30 text-purple-400 focus:border-purple-500';
    return 'bg-slate-900 border-slate-700 text-slate-300';
  };

  return (
    <div className={`bg-slate-950 text-slate-200 font-sans selection:bg-blue-500/30 ${!isAdmin ? 'min-h-screen p-4 md:p-8' : 'p-2'}`}>
      
      {/* ÜST BİLGİ VE BUTONLAR */}
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
            {isAdmin && (
              <button onClick={() => { if(confirm("Tüm kayıtları kalıcı olarak silmek istediğinize emin misiniz?")) { localStorage.removeItem('cnet_teknik_kayitlar'); window.location.reload(); } }} className="bg-rose-500/10 hover:bg-rose-500 border border-rose-500/20 hover:border-rose-500 text-rose-500 hover:text-white px-6 py-3 rounded-xl text-xs font-bold transition-all flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                SİSTEMİ SIFIRLA
              </button>
            )}
          </div>
        </div>

        {/* YÖNETİCİYE ÖZEL GELİŞMİŞ FİLTRELEME ALANI */}
        {isAdmin && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 bg-slate-900/60 p-5 rounded-2xl border border-slate-800/80 shadow-inner">
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span> Personel Performansı
              </label>
              <select value={filtreUsta} onChange={(e) => setFiltreUsta(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs outline-none focus:border-blue-500 text-slate-200">
                <option value="">Tüm Tamir Personelleri</option>
                {TAMIR_PERSONELI_LISTESI.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span> Test Analizi
              </label>
              <select value={filtreTest} onChange={(e) => setFiltreTest(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs outline-none focus:border-indigo-500 text-slate-200">
                <option value="">Tüm Test Personelleri</option>
                {TEST_PERSONELI.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> İşlem Durumu
              </label>
              <select value={filtreDurum} onChange={(e) => setFiltreDurum(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs outline-none focus:border-emerald-500 text-slate-200">
                <option value="">Tüm Durumlar</option>
                <option value="Evet">✅ Sorunsuz Tamamlananlar</option>
                <option value="Hayır">❌ Hatalı Dönüşler</option>
                <option value="İade">🔄 İade Edilenler</option>
              </select>
            </div>
          </div>
        )}

        {/* DİNAMİK ÖZET KARTLARI */}
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
                <th className="p-4 w-[160px]">Tamir Personeli</th>
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
              {gosterilecekTabloVerisi.map((satir, i) => (
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
                      value={satir.tamirPersoneli} 
                      onChange={(e) => veriGuncelle(satir.id, 'tamirPersoneli', e.target.value)} 
                      className="w-full bg-slate-950/50 border border-slate-700/80 rounded-xl p-2.5 text-xs outline-none focus:border-blue-500 disabled:bg-transparent disabled:border-transparent disabled:text-slate-300 disabled:font-medium disabled:appearance-none transition-all text-slate-200"
                    >
                      <option value="">Seçiniz...</option>
                      {TAMIR_PERSONELI_LISTESI.map(u => <option key={u} value={u}>{u}</option>)}
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
                      <button onClick={() => satirKaydet(satir.id)} className="bg-blue-600 hover:bg-blue-500 text-white w-full py-2.5 px-3 rounded-lg transition-all font-bold text-[10px] shadow-lg shadow-blue-600/20 flex items-center justify-center gap-1.5">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                        KAYDET
                      </button>
                    ) : (
                      <div className="flex items-center justify-center gap-2">
                        <span className="text-slate-400 font-bold text-[9px] tracking-widest bg-slate-800/50 border border-slate-700 px-3 py-1.5 rounded-md uppercase flex items-center gap-1">
                          <svg className="w-3 h-3 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          KAYDEDİLDİ
                        </span>
                        {/* YALNIZCA YÖNETİCİYE GÖZÜKEN SİL BUTONU */}
                        {isAdmin && (
                          <button onClick={() => satirSil(satir.id)} className="text-slate-500 hover:text-white hover:bg-rose-500 p-1.5 rounded-lg transition-colors border border-transparent hover:border-rose-400" title="Yönetici Silme Yetkisi">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
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
