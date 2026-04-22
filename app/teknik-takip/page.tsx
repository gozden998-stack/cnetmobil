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
  testYapanGiris: string; // 1. Test
  testYapanCikis: string; // 2. Test
  kaydedildi: boolean;
  islemAsamasi: 'Giris' | 'Cikis';
  kayitTarihi: string;
}

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
  const [aramaImei, setAramaImei] = useState('');
  const [bulunanCihaz, setBulunanCihaz] = useState<Satir | null>(null);

  useEffect(() => {
    const kaydedilmis = localStorage.getItem('cnet_teknik_kayitlar');
    if (kaydedilmis) setSatirlar(JSON.parse(kaydedilmis));
  }, []);

  useEffect(() => {
    if (satirlar.length > 0) {
      localStorage.setItem('cnet_teknik_kayitlar', JSON.stringify(satirlar));
    }
  }, [satirlar]);

  // IMEI Sorgulama: Giriş yapılmış ama çıkışı yapılmamış cihazı bulur
  const handleImeiSorgula = () => {
    const cihaz = satirlar.find(s => s.imei === aramaImei && s.islemAsamasi === 'Giris');
    if (cihaz) {
      setBulunanCihaz(cihaz);
    } else {
      alert("Bu IMEI ile kayıtlı bir giriş işlemi bulunamadı.");
      setBulunanCihaz(null);
    }
  };

  const satirKaydet = (yeniVeri: Partial<Satir>) => {
    const tamVeri: Satir = {
      id: Date.now(),
      kayitTarihi: new Date().toLocaleString('tr-TR'),
      kaydedildi: true,
      tamirPersoneli: '',
      markaModel: '',
      imei: '',
      ariza: '',
      tamirDurumu: '',
      neden: '',
      testYapanGiris: '',
      testYapanCikis: '',
      islemAsamasi: 'Giris',
      ...yeniVeri
    };

    setSatirlar(prev => [tamVeri, ...prev]);
    setBulunanCihaz(null);
    setAramaImei('');
  };

  return (
    <div className={`bg-slate-950 text-slate-200 font-sans selection:bg-blue-500/30 ${!isAdmin ? 'min-h-screen p-4 md:p-8' : 'p-2'}`}>
      
      {/* ÜST PANEL: SORGULAMA VE BAŞLIK */}
      <div className="max-w-[1400px] mx-auto mb-8 animate-in fade-in slide-in-from-top-4 duration-500">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6 border-b border-slate-800/80 pb-6">
          <h1 className="text-2xl font-bold text-white flex items-center gap-4">
            <div className="w-2 h-8 bg-blue-600 rounded-full shadow-[0_0_15px_rgba(37,99,235,0.5)]"></div>
            CNET TEKNİK TAKİP
          </h1>
          
          <div className="flex w-full md:w-auto gap-2 bg-slate-900/50 p-2 rounded-2xl border border-slate-800 shadow-xl focus-within:border-blue-500/50 transition-all">
            <input 
              type="text" 
              placeholder="IMEI ile Cihaz Bul (2. Test İçin)..." 
              className="bg-transparent border-none outline-none px-4 text-sm w-full md:w-64 text-white font-mono"
              value={aramaImei}
              onChange={(e) => setAramaImei(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleImeiSorgula()}
            />
            <button 
              onClick={handleImeiSorgula}
              className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-xl text-xs font-bold transition-all"
            >
              SORGULA
            </button>
          </div>
        </div>

        {/* 2. PERSONEL: ÇIKIŞ TESTİ KARTI (SORGULAMA SONUCU ÇIKAR) */}
        {bulunanCihaz && (
          <div className="mt-8 bg-indigo-900/10 border border-indigo-500/30 p-8 rounded-[2.5rem] shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="flex items-center gap-3 mb-6 text-indigo-400 font-black text-sm uppercase tracking-widest">
              <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
              2. PERSONEL: TAMİR SONRASI ÇIKIŞ KONTROLÜ
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="bg-slate-950/50 p-4 rounded-2xl border border-slate-800 opacity-60">
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Cihaz (Kilitli)</label>
                <div className="text-sm font-bold text-white">{bulunanCihaz.markaModel}</div>
                <div className="text-[10px] font-mono text-slate-400">{bulunanCihaz.imei}</div>
              </div>
              <select id="cDurum" className="bg-slate-950 border border-slate-800 rounded-2xl p-4 text-sm outline-none focus:border-indigo-500 font-bold text-emerald-400">
                <option value="Evet">✅ SORUNSUZ / TAMAM</option>
                <option value="Hayır">❌ SORUNLU / HATALI</option>
                <option value="İade">🔄 İADE EDİLDİ</option>
              </select>
              <input id="cHata" type="text" placeholder="Hata Detayı / Not..." className="bg-slate-950 border border-slate-800 rounded-2xl p-4 text-sm outline-none focus:border-indigo-500 text-white" />
              <select id="cTest" className="bg-slate-950 border border-slate-800 rounded-2xl p-4 text-sm outline-none focus:border-indigo-500 text-slate-200">
                <option value="">Son Testi Yapan Personel...</option>
                {TEST_PERSONELI.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <button 
                onClick={() => satirKaydet({
                  tamirPersoneli: bulunanCihaz.tamirPersoneli,
                  markaModel: bulunanCihaz.markaModel,
                  imei: bulunanCihaz.imei,
                  ariza: bulunanCihaz.ariza,
                  tamirDurumu: (document.getElementById('cDurum') as HTMLSelectElement).value,
                  neden: (document.getElementById('cHata') as HTMLInputElement).value,
                  testYapanGiris: bulunanCihaz.testYapanGiris,
                  testYapanCikis: (document.getElementById('cTest') as HTMLSelectElement).value,
                  islemAsamasi: 'Cikis'
                })}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-2xl text-xs uppercase tracking-widest shadow-lg shadow-indigo-600/20 transition-all"
              >
                ÇIKIŞI KAYDET
              </button>
            </div>
          </div>
        )}

        {/* 1. PERSONEL: GİRİŞ TESTİ FORMU (ANA EKRAN) */}
        {!bulunanCihaz && (
          <div className="mt-8 bg-blue-900/10 border border-blue-500/20 p-8 rounded-[2.5rem] shadow-xl">
            <div className="flex items-center gap-3 mb-6 text-blue-400 font-black text-sm uppercase tracking-widest">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
              1. PERSONEL: CİHAZ KABUL & GİRİŞ TESTİ
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <select id="gPers" className="bg-slate-950 border border-slate-800 rounded-2xl p-4 text-sm outline-none focus:border-blue-500 text-slate-200">
                <option value="">Tamir Personeli...</option>
                {TAMIR_PERSONELI_LISTESI.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
              <select id="gTest" className="bg-slate-950 border border-slate-800 rounded-2xl p-4 text-sm outline-none focus:border-blue-500 text-slate-200">
                <option value="">Giriş Testini Yapan...</option>
                {TEST_PERSONELI.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <input id="gModel" type="text" placeholder="Cihaz Marka / Model" className="bg-slate-950 border border-slate-800 rounded-2xl p-4 text-sm outline-none focus:border-blue-500 text-white" />
              <input id="gImei" type="text" placeholder="IMEI Kaydı" className="bg-slate-950 border border-slate-800 rounded-2xl p-4 text-sm outline-none focus:border-blue-500 text-white font-mono" />
              <input id="gAriza" type="text" placeholder="Cihaz Arızaları..." className="bg-slate-950 border border-slate-800 rounded-2xl p-4 text-sm outline-none focus:border-blue-500 text-white" />
              <button 
                onClick={() => satirKaydet({
                  tamirPersoneli: (document.getElementById('gPers') as HTMLSelectElement).value,
                  testYapanGiris: (document.getElementById('gTest') as HTMLSelectElement).value,
                  markaModel: (document.getElementById('gModel') as HTMLInputElement).value,
                  imei: (document.getElementById('gImei') as HTMLInputElement).value,
                  ariza: (document.getElementById('gAriza') as HTMLInputElement).value,
                  tamirDurumu: 'Beklemede',
                  islemAsamasi: 'Giris'
                })}
                className="bg-blue-600 hover:bg-blue-500 text-white font-black rounded-2xl text-xs uppercase tracking-widest shadow-lg shadow-blue-600/20 transition-all"
              >
                GİRİŞİ KAYDET
              </button>
            </div>
          </div>
        )}
      </div>

      {/* TABLO LİSTESİ */}
      <div className="max-w-[1400px] mx-auto bg-slate-900/40 border border-slate-800/80 rounded-[2.5rem] overflow-hidden backdrop-blur-md">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[1250px]">
            <thead className="bg-slate-950/80 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-800/80">
              <tr>
                <th className="p-6">AŞAMA</th>
                <th className="p-6">PERSONEL BİLGİSİ</th>
                <th className="p-6">CİHAZ & IMEI</th>
                <th className="p-6">İŞLEM / DURUM</th>
                <th className="p-6">TARİH</th>
                {isAdmin && <th className="p-6 text-center">AKSİYON</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40">
              {satirlar.map((satir) => (
                <tr key={satir.id} className={`group hover:bg-white/[0.02] transition-colors ${satir.islemAsamasi === 'Cikis' ? 'bg-indigo-600/[0.03]' : ''}`}>
                  <td className="p-6">
                    <span className={`px-3 py-1 rounded-lg text-[9px] font-black border ${
                      satir.islemAsamasi === 'Giris' ? 'text-blue-400 border-blue-500/20 bg-blue-500/5' : 'text-indigo-400 border-indigo-500/20 bg-indigo-500/5'
                    }`}>
                      {satir.islemAsamasi === 'Giris' ? '1. GİRİŞ' : '2. ÇIKIŞ'}
                    </span>
                  </td>
                  <td className="p-6">
                    <div className="text-xs font-bold text-slate-200 uppercase">{satir.tamirPersoneli}</div>
                    <div className="text-[10px] text-slate-500 mt-1 uppercase font-medium">
                      Test: {satir.islemAsamasi === 'Giris' ? satir.testYapanGiris : `${satir.testYapanGiris} ➔ ${satir.testYapanCikis}`}
                    </div>
                  </td>
                  <td className="p-6">
                    <div className="text-sm font-black text-white uppercase tracking-tighter">{satir.markaModel}</div>
                    <div className="text-[11px] font-mono text-slate-500 mt-1 uppercase">{satir.imei}</div>
                  </td>
                  <td className="p-6">
                    <div className={`text-[10px] font-black uppercase tracking-widest mb-1 ${
                      satir.tamirDurumu === 'Evet' ? 'text-emerald-400' : satir.tamirDurumu === 'Hayır' ? 'text-rose-400' : 'text-blue-400'
                    }`}>
                      {satir.tamirDurumu}
                    </div>
                    <div className="text-xs text-slate-400 italic">"{satir.neden || satir.ariza}"</div>
                  </td>
                  <td className="p-6 text-[10px] text-slate-500 font-mono italic">{satir.kayitTarihi}</td>
                  {isAdmin && (
                    <td className="p-6 text-center">
                      <button onClick={() => { if(confirm("Silmek istiyor musunuz?")) setSatirlar(prev => prev.filter(s => s.id !== satir.id)) }} className="p-3 bg-rose-500/10 text-rose-500 rounded-xl hover:bg-rose-500 hover:text-white transition-all opacity-0 group-hover:opacity-100">
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
