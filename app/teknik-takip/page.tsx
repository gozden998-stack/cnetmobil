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
  testYapan: string;      // 1. Test Personeli
  testYapanCikis: string; // 2. Test Personeli
  kaydedildi: boolean;
  islemAsamasi: 'Giris' | 'Cikis';
  kayitTarihi: string;
}

interface Props {
  isAdmin?: boolean;
}

const TeknikTakipTablosu = ({ isAdmin = false }: Props) => {
  const TAMIR_PERSONELI_LISTESI = ["ABOBAKR KAMAL", "AHMET MERT GÖKÇE", "ANIL AYDIN", "M.OMAR NAWID KAMAL", "MURAT BEKTAŞ", "MEHMET ŞERİF DEMİRKIRAN"];
  const TEST_PERSONELI = ["ALİ ERÇİN", "YUSUF GENCAY", "ESAT AYDIN", "SEMİH AYVA"];

  const [satirlar, setSatirlar] = useState<Satir[]>([]);
  const [aramaImei, setAramaImei] = useState('');
  const [bulunanCihaz, setBulunanCihaz] = useState<Satir | null>(null);

  useEffect(() => {
    const kaydedilmis = localStorage.getItem('cnet_teknik_kayitlar');
    if (kaydedilmis) setSatirlar(JSON.parse(kaydedilmis));
  }, []);

  useEffect(() => {
    if (satirlar.length > 0) localStorage.setItem('cnet_teknik_kayitlar', JSON.stringify(satirlar));
  }, [satirlar]);

  // IMEI Sorgulama: Mevcut kaydı bulur
  const handleImeiSorgula = () => {
    const cihaz = satirlar.find(s => s.imei === aramaImei);
    if (cihaz) {
      setBulunanCihaz(cihaz);
    } else {
      alert("Bu IMEI ile bir kayıt bulunamadı.");
      setBulunanCihaz(null);
    }
  };

  const satirKaydet = (yeniVeri: Partial<Satir>) => {
    if (bulunanCihaz) {
      // GÜNCELLEME MODU: Mevcut satırı bul ve üzerine yaz (Tek sütun mantığı)
      setSatirlar(prev => prev.map(s => s.id === bulunanCihaz.id ? { 
        ...s, 
        ...yeniVeri, 
        islemAsamasi: 'Cikis',
        kayitTarihi: `${s.kayitTarihi} (Güncellendi: ${new Date().toLocaleTimeString('tr-TR')})` 
      } : s));
    } else {
      // YENİ KAYIT MODU
      const tamVeri: Satir = {
        id: Date.now(),
        kayitTarihi: new Date().toLocaleString('tr-TR'),
        kaydedildi: true,
        tamirPersoneli: '',
        markaModel: '',
        imei: '',
        ariza: '',
        tamirDurumu: 'Beklemede',
        neden: '',
        testYapan: '',
        testYapanCikis: '',
        islemAsamasi: 'Giris',
        ...yeniVeri as Satir
      };
      setSatirlar(prev => [tamVeri, ...prev]);
    }
    setBulunanCihaz(null);
    setAramaImei('');
  };

  return (
    <div className={`bg-slate-950 text-slate-200 font-sans ${!isAdmin ? 'min-h-screen p-4 md:p-8' : 'p-2'}`}>
      <div className="max-w-[1400px] mx-auto space-y-6">
        
        {/* ÜST SORGULAMA PANELİ */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-slate-900/40 p-5 rounded-[2rem] border border-slate-800 shadow-2xl">
          <h2 className="text-xl font-black text-white tracking-tighter">CNET TEKNİK SERVİS</h2>
          <div className="flex gap-2 w-full md:w-auto">
            <input 
              type="text" 
              placeholder="IMEI ile Kaydı Güncelle..." 
              className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm w-full md:w-64 outline-none focus:border-blue-600 font-mono text-white"
              value={aramaImei}
              onChange={(e) => setAramaImei(e.target.value)}
            />
            <button onClick={handleImeiSorgula} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-xl text-xs font-black transition-all">SORGULA</button>
          </div>
        </div>

        {/* DİNAMİK FORM (Giriş veya Güncelleme) */}
        <div className={`p-8 rounded-[2.5rem] border transition-all duration-500 ${bulunanCihaz ? 'bg-indigo-900/10 border-indigo-500/30' : 'bg-slate-900/30 border-slate-800'}`}>
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${bulunanCihaz ? 'bg-indigo-500 animate-pulse' : 'bg-blue-500'}`}></span>
            {bulunanCihaz ? 'CİHAZ ÇIKIŞ / TAMİR GÜNCELLEME' : 'YENİ CİHAZ GİRİŞ KAYDI'}
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <select id="fPers" disabled={!!bulunanCihaz} defaultValue={bulunanCihaz?.tamirPersoneli || ""} className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-sm outline-none focus:border-blue-500 disabled:opacity-50">
              <option value="">Tamir Personeli...</option>
              {TAMIR_PERSONELI_LISTESI.map(u => <option key={u} value={u}>{u}</option>)}
            </select>

            <select id="fTest1" disabled={!!bulunanCihaz} defaultValue={bulunanCihaz?.testYapan || ""} className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-sm outline-none focus:border-blue-500 disabled:opacity-50">
              <option value="">1. Test Yapan...</option>
              {TEST_PERSONELI.map(p => <option key={p} value={p}>{p}</option>)}
            </select>

            <input id="fModel" disabled={!!bulunanCihaz} defaultValue={bulunanCihaz?.markaModel || ""} type="text" placeholder="Marka / Model" className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-sm outline-none focus:border-blue-500 disabled:opacity-50" />
            
            <input id="fImei" disabled={!!bulunanCihaz} defaultValue={bulunanCihaz?.imei || ""} type="text" placeholder="IMEI No" className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-sm outline-none focus:border-blue-500 font-mono disabled:opacity-50" />

            {/* SADECE GİRİŞTE GÖRÜNEN ARIZA / SADECE ÇIKIŞTA GÖRÜNEN DURUM */}
            {!bulunanCihaz ? (
              <input id="fAriza" type="text" placeholder="Cihaz Arızaları..." className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-sm outline-none focus:border-blue-500" />
            ) : (
              <select id="fDurum" className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-sm outline-none focus:border-emerald-500 font-bold text-emerald-400">
                <option value="Evet">✅ SORUNSUZ</option>
                <option value="Hayır">❌ SORUNLU</option>
                <option value="İade">🔄 İADE</option>
              </select>
            )}

            <button 
              onClick={() => {
                if (bulunanCihaz) {
                  satirKaydet({
                    tamirDurumu: (document.getElementById('fDurum') as HTMLSelectElement).value,
                    neden: (document.getElementById('fHata') ? (document.getElementById('fHata') as HTMLInputElement).value : 'İşlem Tamam'),
                    testYapanCikis: (document.getElementById('fTest2') as HTMLSelectElement).value,
                  });
                } else {
                  satirKaydet({
                    tamirPersoneli: (document.getElementById('fPers') as HTMLSelectElement).value,
                    testYapan: (document.getElementById('fTest1') as HTMLSelectElement).value,
                    markaModel: (document.getElementById('fModel') as HTMLInputElement).value,
                    imei: (document.getElementById('fImei') as HTMLInputElement).value,
                    ariza: (document.getElementById('fAriza') as HTMLInputElement).value,
                  });
                }
              }}
              className={`font-black rounded-xl text-xs uppercase tracking-widest transition-all ${bulunanCihaz ? 'bg-indigo-600 hover:bg-indigo-500' : 'bg-blue-600 hover:bg-blue-500'} text-white`}
            >
              {bulunanCihaz ? 'KAYDI GÜNCELLE' : 'GİRİŞİ KAYDET'}
            </button>
          </div>

          {/* ÇIKIŞA ÖZEL EK ALANLAR (Sorgulama yapıldığında açılır) */}
          {bulunanCihaz && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 animate-in slide-in-from-left-2">
              <input id="fHata" type="text" placeholder="Hata Detayı / Yapılan İşlem Notu..." className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-sm outline-none focus:border-indigo-500" />
              <select id="fTest2" className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-sm outline-none focus:border-indigo-500">
                <option value="">2. Test (Çıkış) Yapan Personel...</option>
                {TEST_PERSONELI.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          )}
        </div>

        {/* TABLO LİSTESİ */}
        <div className="bg-slate-900/40 border border-slate-800 rounded-[2.5rem] overflow-hidden backdrop-blur-md">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[1200px]">
              <thead className="bg-slate-950 text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] border-b border-slate-800">
                <tr>
                  <th className="p-6">DURUM</th>
                  <th className="p-6">TAMİR PERSONELİ</th>
                  <th className="p-6">CİHAZ & IMEI</th>
                  <th className="p-6">ARIZA / İŞLEM NOTU</th>
                  <th className="p-6">TESTLER (1 ➔ 2)</th>
                  <th className="p-6">SON İŞLEM TARİHİ</th>
                  {isAdmin && <th className="p-6 text-center">AKSİYON</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {satirlar.map((satir) => (
                  <tr key={satir.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="p-6">
                      <span className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase border tracking-widest ${
                        satir.tamirDurumu === 'Evet' ? 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5' : 
                        satir.tamirDurumu === 'Hayır' ? 'text-rose-400 border-rose-500/20 bg-rose-500/5' : 
                        satir.tamirDurumu === 'İade' ? 'text-purple-400 border-purple-500/20 bg-purple-500/5' : 'text-blue-400 border-blue-500/20 bg-blue-500/5'
                      }`}>
                        {satir.tamirDurumu === 'Beklemede' ? '📥 GİRİŞ YAPILDI' : satir.tamirDurumu}
                      </span>
                    </td>
                    <td className="p-6 text-sm font-bold text-slate-200 uppercase tracking-tighter">{satir.tamirPersoneli}</td>
                    <td className="p-6">
                      <div className="text-sm font-black text-white uppercase">{satir.markaModel}</div>
                      <div className="text-[11px] font-mono text-slate-500 mt-1">{satir.imei}</div>
                    </td>
                    <td className="p-6">
                      <div className="text-xs text-slate-400 italic">Arıza: {satir.ariza}</div>
                      {satir.neden && <div className="text-xs text-indigo-400 mt-1 font-bold">İşlem: {satir.neden}</div>}
                    </td>
                    <td className="p-6">
                      <div className="text-[10px] font-bold text-slate-300 uppercase">
                        {satir.testYapan} {satir.testYapanCikis && <span className="text-indigo-500 mx-2">➔</span>} {satir.testYapanCikis}
                      </div>
                    </td>
                    <td className="p-6 text-[10px] text-slate-500 font-mono">{satir.kayitTarihi}</td>
                    {isAdmin && (
                      <td className="p-6 text-center">
                        <button onClick={() => setSatirlar(prev => prev.filter(s => s.id !== satir.id))} className="text-slate-600 hover:text-rose-500 p-2 rounded-lg transition-colors">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeknikTakipTablosu;
