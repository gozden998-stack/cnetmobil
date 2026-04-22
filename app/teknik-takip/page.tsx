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
  islemAsamasi: 'Giris' | 'Cikis'; // Yeni: Cihazın hangi aşamada olduğu
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
    if (kaydedilmis) {
      setSatirlar(JSON.parse(kaydedilmis));
    }
  }, []);

  useEffect(() => {
    if (satirlar.length > 0) {
      localStorage.setItem('cnet_teknik_kayitlar', JSON.stringify(satirlar));
    }
  }, [satirlar]);

  // IMEI ARAMA MANTIĞI
  const handleImeiSorgula = () => {
    const cihaz = satirlar.find(s => s.imei === aramaImei && s.kaydedildi);
    if (cihaz) {
      setBulunanCihaz(cihaz);
    } else {
      alert("Bu IMEI ile kayıtlı bir giriş testi bulunamadı.");
      setBulunanCihaz(null);
    }
  };

  const satirKaydet = (yeniVeri: Satir) => {
    if (!yeniVeri.tamirPersoneli || !yeniVeri.markaModel) {
      alert("Hata: Tamir Personeli ve Marka/Model boş bırakılamaz!");
      return;
    }
    setSatirlar(prev => [{ ...yeniVeri, kaydedildi: true }, ...prev]);
    setBulunanCihaz(null);
    setAramaImei('');
  };

  return (
    <div className={`bg-slate-950 text-slate-200 font-sans selection:bg-blue-500/30 ${!isAdmin ? 'min-h-screen p-4 md:p-8' : 'p-2'}`}>
      
      {/* ÜST PANEL: ARAMA VE SORGULAMA */}
      <div className="max-w-[1400px] mx-auto mb-8 space-y-6 animate-in fade-in slide-in-from-top-4 duration-500">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6 border-b border-slate-800/80 pb-6">
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="w-2 h-8 bg-blue-600 rounded-full"></div>
            CNET TEKNİK TAKİP {isAdmin && "(YÖNETİCİ)"}
          </h1>
          
          <div className="flex w-full md:w-auto gap-2 bg-slate-900 p-2 rounded-2xl border border-slate-800 shadow-xl">
            <input 
              type="text" 
              placeholder="Sorgulanacak IMEI..." 
              className="bg-transparent border-none outline-none px-4 text-sm w-full md:w-64 text-white"
              value={aramaImei}
              onChange={(e) => setAramaImei(e.target.value)}
            />
            <button 
              onClick={handleImeiSorgula}
              className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-xl text-xs font-bold transition-all"
            >
              CİHAZI SORGULA
            </button>
          </div>
        </div>

        {/* 2. KAYIT FORMU (YALNIZCA SORGULAMA SONUCU ÇIKAR) */}
        {bulunanCihaz && (
          <div className="bg-indigo-600/10 border border-indigo-500/30 p-6 rounded-3xl animate-in zoom-in-95 duration-300">
            <div className="flex items-center gap-3 mb-4 text-indigo-400 font-bold text-sm">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
              TAMİR SONRASI (2. KONTROL) KAYDI YAPILIYOR
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-7 gap-3">
              <div className="opacity-50 pointer-events-none">
                <label className="text-[10px] block mb-1">IMEI (Kilitli)</label>
                <input type="text" value={bulunanCihaz.imei} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs" />
              </div>
              <div className="opacity-50 pointer-events-none">
                <label className="text-[10px] block mb-1">Model (Kilitli)</label>
                <input type="text" value={bulunanCihaz.markaModel} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs" />
              </div>
              <div>
                <label className="text-[10px] block mb-1">Tamir Personeli</label>
                <select id="tPers" className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs outline-none focus:border-indigo-500">
                  <option value="">Seçiniz...</option>
                  {TAMIR_PERSONELI_LISTESI.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] block mb-1">Yapılan İşlem</label>
                <input id="tIslem" type="text" placeholder="Ne yapıldı?" className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs outline-none focus:border-indigo-500" />
              </div>
              <div>
                <label className="text-[10px] block mb-1">Tamir Durumu</label>
                <select id="tDurum" className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs outline-none focus:border-emerald-500 font-bold">
                  <option value="Evet">✅ SORUNSUZ</option>
                  <option value="Hayır">❌ HATALI</option>
                  <option value="İade">🔄 İADE</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] block mb-1">Son Test Eden</label>
                <select id="tTest" className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs outline-none focus:border-indigo-500">
                  <option value="">Seçiniz...</option>
                  {TEST_PERSONELI.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="flex items-end">
                <button 
                  onClick={() => satirKaydet({
                    id: Date.now(),
                    tamirPersoneli: (document.getElementById('tPers') as HTMLSelectElement).value,
                    markaModel: bulunanCihaz.markaModel,
                    imei: bulunanCihaz.imei,
                    ariza: (document.getElementById('tIslem') as HTMLInputElement).value,
                    tamirDurumu: (document.getElementById('tDurum') as HTMLSelectElement).value,
                    neden: '2. Kontrol Kaydı',
                    testYapan: (document.getElementById('tTest') as HTMLSelectElement).value,
                    kaydedildi: true,
                    islemAsamasi: 'Cikis'
                  })}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 rounded-lg text-xs"
                >
                  2. KAYDI TAMAMLA
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 1. KAYIT FORMU (YALNIZCA PERSONEL MODUNDA VE SORGULAMA YOKKEN ÇIKAR) */}
        {!isAdmin && !bulunanCihaz && (
          <div className="bg-blue-600/5 border border-blue-500/20 p-6 rounded-3xl">
            <div className="flex items-center gap-3 mb-4 text-blue-400 font-bold text-sm uppercase tracking-widest">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
              Giriş Ekspertiz Kaydı (Tamir Öncesi)
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-7 gap-3">
              <input id="gModel" type="text" placeholder="Cihaz Model" className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs outline-none focus:border-blue-500" />
              <input id="gImei" type="text" placeholder="IMEI No" className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs font-mono outline-none focus:border-blue-500" />
              <input id="gAriza" type="text" placeholder="Müşteri Şikayeti" className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs outline-none focus:border-blue-500" />
              <select id="gUsta" className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs outline-none focus:border-blue-500">
                 <option value="">Teslim Alan...</option>
                 {TAMIR_PERSONELI_LISTESI.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
              <select id="gTest" className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs outline-none focus:border-blue-500">
                 <option value="">Test Eden...</option>
                 {TEST_PERSONELI.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <div className="lg:col-span-2">
                <button 
                  onClick={() => satirKaydet({
                    id: Date.now(),
                    tamirPersoneli: (document.getElementById('gUsta') as HTMLSelectElement).value,
                    markaModel: (document.getElementById('gModel') as HTMLInputElement).value,
                    imei: (document.getElementById('gImei') as HTMLInputElement).value,
                    ariza: (document.getElementById('gAriza') as HTMLInputElement).value,
                    tamirDurumu: 'Giriş Kaydı',
                    neden: 'Giriş Ekspertizi',
                    testYapan: (document.getElementById('gTest') as HTMLSelectElement).value,
                    kaydedildi: true,
                    islemAsamasi: 'Giris'
                  })}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-3 rounded-xl text-xs"
                >
                  1. GİRİŞ TESTİNİ KAYDET
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* TABLO ALANI */}
      <div className="max-w-[1400px] mx-auto bg-slate-900/40 border border-slate-800/80 rounded-3xl overflow-hidden shadow-2xl backdrop-blur-md">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[1250px]">
            <thead className="bg-slate-950 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-800">
              <tr>
                <th className="p-4">AŞAMA</th>
                <th className="p-4">Tamir Personeli</th>
                <th className="p-4">Cihaz Model / IMEI</th>
                <th className="p-4">İşlem / Arıza</th>
                <th className="p-4 text-center">Durum</th>
                <th className="p-4">Test Yapan</th>
                {isAdmin && <th className="p-4 text-center">Aksiyon</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {satirlar.map((satir) => (
                <tr key={satir.id} className={`${satir.islemAsamasi === 'Giris' ? 'bg-slate-900/10' : 'bg-indigo-900/5'} transition-all`}>
                  <td className="p-4">
                    <span className={`text-[9px] font-black px-2 py-1 rounded-md border ${
                      satir.islemAsamasi === 'Giris' ? 'text-blue-400 border-blue-500/20 bg-blue-500/5' : 'text-indigo-400 border-indigo-500/20 bg-indigo-500/5'
                    }`}>
                      {satir.islemAsamasi === 'Giris' ? '1. GİRİŞ' : '2. ÇIKIŞ'}
                    </span>
                  </td>
                  <td className="p-4 text-sm font-semibold text-slate-300">{satir.tamirPersoneli}</td>
                  <td className="p-4">
                    <div className="text-sm font-bold text-white">{satir.markaModel}</div>
                    <div className="text-[10px] font-mono text-slate-500 uppercase">{satir.imei}</div>
                  </td>
                  <td className="p-4 text-sm text-slate-400">{satir.ariza}</td>
                  <td className="p-4 text-center">
                    <span className={`text-[10px] font-bold px-3 py-1 rounded-full border ${
                      satir.tamirDurumu === 'Evet' ? 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5' : 
                      satir.tamirDurumu === 'Hayır' ? 'text-rose-400 border-rose-500/20 bg-rose-500/5' : 'text-purple-400 border-purple-500/20 bg-purple-500/5'
                    }`}>
                      {satir.tamirDurumu}
                    </span>
                  </td>
                  <td className="p-4 text-sm text-slate-300 font-medium">{satir.testYapan}</td>
                  {isAdmin && (
                    <td className="p-4 text-center">
                      <button 
                        onClick={() => {
                          if(confirm("Bu işlemi silmek istiyor musunuz?")) {
                            setSatirlar(prev => prev.filter(s => s.id !== satir.id));
                          }
                        }}
                        className="p-2 hover:bg-rose-500/10 text-slate-600 hover:text-rose-500 rounded-lg transition-all"
                      >
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
  );
};

export default TeknikTakipTablosu;
