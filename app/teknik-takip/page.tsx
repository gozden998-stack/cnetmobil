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

  const handleImeiSorgula = () => {
    const cihaz = satirlar.find(s => s.imei === aramaImei && s.kaydedildi && s.islemAsamasi === 'Giris');
    if (cihaz) {
      setBulunanCihaz(cihaz);
    } else {
      alert("Bu IMEI için 'Giriş Testi' bulunamadı. Lütfen önce Giriş Ekspertizi yapın.");
      setBulunanCihaz(null);
    }
  };

  const satirKaydet = (yeniVeri: Partial<Satir>) => {
    if (!yeniVeri.tamirPersoneli || !yeniVeri.markaModel) {
      alert("Hata: Eksik alanları doldurun!");
      return;
    }
    const tamVeri: Satir = {
      id: Date.now(),
      kayitTarihi: new Date().toLocaleString('tr-TR'),
      kaydedildi: true,
      ...yeniVeri as Satir
    };
    setSatirlar(prev => [tamVeri, ...prev]);
    setBulunanCihaz(null);
    setAramaImei('');
  };

  return (
    <div className={`bg-slate-950 text-slate-200 font-sans selection:bg-blue-500/30 ${!isAdmin ? 'min-h-screen p-4 md:p-8' : 'p-0'}`}>
      
      {/* ÜST DASHBOARD PANELİ */}
      <div className="max-w-[1400px] mx-auto mb-8 space-y-8 animate-in fade-in slide-in-from-top-4 duration-700">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 border-b border-slate-800/60 pb-8">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3 tracking-tight">
              <div className="w-3 h-10 bg-gradient-to-b from-blue-500 to-indigo-600 rounded-full shadow-lg shadow-blue-500/20"></div>
              CNET TEKNİK TAKİP
              {isAdmin && <span className="text-xs bg-indigo-500/10 text-indigo-400 px-3 py-1 rounded-full border border-indigo-500/20 ml-2">ADMİN MODU</span>}
            </h1>
            <p className="text-sm text-slate-500 mt-2 font-medium">Giriş/Çıkış Kontrolü ve Teknisyen Performans İzleme</p>
          </div>
          
          {/* IMEI SORGULAMA ÇUBUĞU */}
          <div className="flex w-full lg:w-auto p-1.5 bg-slate-900/80 backdrop-blur-xl rounded-2xl border border-slate-800 shadow-2xl focus-within:border-blue-500/50 transition-all">
            <div className="flex items-center px-4 text-slate-500">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </div>
            <input 
              type="text" 
              placeholder="Çıkış Testi İçin IMEI Sorgula..." 
              className="bg-transparent border-none outline-none py-3 text-sm w-full lg:w-72 text-white font-mono placeholder-slate-600"
              value={aramaImei}
              onChange={(e) => setAramaImei(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleImeiSorgula()}
            />
            <button 
              onClick={handleImeiSorgula}
              className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-xl text-xs font-black transition-all shadow-lg shadow-blue-600/20 active:scale-95"
            >
              SORGULA
            </button>
          </div>
        </div>

        {/* 2. AŞAMA: ÇIKIŞ KONTROL KARTI (SORGULAMA SONUCU) */}
        {bulunanCihaz && (
          <div className="bg-gradient-to-r from-indigo-900/20 to-blue-900/20 border border-indigo-500/30 p-8 rounded-[2.5rem] shadow-2xl animate-in zoom-in-95 duration-500 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8">
              <button onClick={() => setBulunanCihaz(null)} className="text-slate-500 hover:text-white transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <div className="flex items-center gap-3 mb-8">
              <div className="p-3 bg-indigo-500/10 rounded-2xl text-indigo-400 border border-indigo-500/20">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-white uppercase tracking-tight">TAMİR SONRASI ÇIKIŞ KONTROLÜ</h3>
                <p className="text-xs text-indigo-400/80 font-bold uppercase tracking-widest mt-1">Cihaz Giriş Kaydı Bulundu: {bulunanCihaz.markaModel}</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="space-y-4 lg:col-span-2">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-950/50 p-4 rounded-2xl border border-slate-800">
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Cihaz / IMEI</label>
                    <div className="text-sm font-bold text-white uppercase">{bulunanCihaz.markaModel}</div>
                    <div className="text-[11px] font-mono text-slate-400 mt-1">{bulunanCihaz.imei}</div>
                  </div>
                  <div className="bg-slate-950/50 p-4 rounded-2xl border border-slate-800">
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">İlk Şikayet</label>
                    <div className="text-sm font-medium text-slate-300 italic">"{bulunanCihaz.ariza}"</div>
                  </div>
                </div>
                <input id="tIslem" type="text" placeholder="Yapılan Tamir İşlemleri..." className="w-full bg-slate-950 border border-slate-700 rounded-2xl p-4 text-sm outline-none focus:border-indigo-500 transition-all text-white placeholder-slate-600 shadow-inner" />
              </div>

              <div className="space-y-4">
                <select id="tPers" className="w-full bg-slate-950 border border-slate-700 rounded-2xl p-4 text-sm outline-none focus:border-indigo-500 text-slate-200 cursor-pointer">
                  <option value="">Tamir Personeli Seç...</option>
                  {TAMIR_PERSONELI_LISTESI.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
                <select id="tDurum" className="w-full bg-slate-950 border border-slate-700 rounded-2xl p-4 text-sm outline-none focus:border-emerald-500 font-bold text-emerald-400 cursor-pointer">
                  <option value="Evet">✅ SORUNSUZ / TESLİME HAZIR</option>
                  <option value="Hayır">❌ HATALI / TEKRAR BAKILMALI</option>
                  <option value="İade">🔄 İADE / YAPILAMADI</option>
                </select>
              </div>

              <div className="space-y-4">
                <select id="tTest" className="w-full bg-slate-950 border border-slate-700 rounded-2xl p-4 text-sm outline-none focus:border-indigo-500 text-slate-200 cursor-pointer">
                  <option value="">Çıkış Test Personeli...</option>
                  {TEST_PERSONELI.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                <button 
                  onClick={() => satirKaydet({
                    tamirPersoneli: (document.getElementById('tPers') as HTMLSelectElement).value,
                    markaModel: bulunanCihaz.markaModel,
                    imei: bulunanCihaz.imei,
                    ariza: (document.getElementById('tIslem') as HTMLInputElement).value,
                    tamirDurumu: (document.getElementById('tDurum') as HTMLSelectElement).value,
                    neden: 'Çıkış Kontrolü',
                    testYapan: (document.getElementById('tTest') as HTMLSelectElement).value,
                    islemAsamasi: 'Cikis'
                  })}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black py-4 rounded-2xl text-xs uppercase tracking-widest shadow-xl shadow-indigo-600/30 transition-all active:scale-95"
                >
                  ÇIKIŞ KAYDINI TAMAMLA
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 1. AŞAMA: GİRİŞ FORMU (DİNAMİK OKUNABİLİR FORM) */}
        {!isAdmin && !bulunanCihaz && (
          <div className="bg-slate-900/40 border border-slate-800/80 p-8 rounded-[2.5rem] shadow-xl backdrop-blur-md">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-2 h-6 bg-blue-500 rounded-full"></div>
              <h3 className="text-sm font-black text-slate-200 uppercase tracking-widest">Giriş Ekspertiz Kaydı</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-5">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 ml-2 uppercase">Cihaz Model</label>
                <input id="gModel" type="text" placeholder="Örn: S24 Ultra" className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl p-4 text-sm outline-none focus:border-blue-500 text-white" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 ml-2 uppercase">IMEI Numarası</label>
                <input id="gImei" type="text" placeholder="35xxxxxxxxxxxxx" className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl p-4 text-sm font-mono outline-none focus:border-blue-500 text-white uppercase" />
              </div>
              <div className="space-y-1.5 lg:col-span-2">
                <label className="text-[10px] font-bold text-slate-500 ml-2 uppercase">Müşteri Şikayeti / Arıza</label>
                <input id="gAriza" type="text" placeholder="Hangi arıza ile geldi?" className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl p-4 text-sm outline-none focus:border-blue-500 text-white" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 ml-2 uppercase">Teslim Alan</label>
                <select id="gUsta" className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl p-4 text-sm outline-none focus:border-blue-500 text-slate-300">
                   <option value="">Seçiniz...</option>
                   {TAMIR_PERSONELI_LISTESI.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div className="flex items-end">
                <button 
                  onClick={() => satirKaydet({
                    tamirPersoneli: (document.getElementById('gUsta') as HTMLSelectElement).value,
                    markaModel: (document.getElementById('gModel') as HTMLInputElement).value,
                    imei: (document.getElementById('gImei') as HTMLInputElement).value,
                    ariza: (document.getElementById('gAriza') as HTMLInputElement).value,
                    tamirDurumu: 'Giriş Kaydı',
                    neden: 'İnceleme Bekliyor',
                    testYapan: 'İlk Kabul',
                    islemAsamasi: 'Giris'
                  })}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-4 rounded-2xl text-xs uppercase tracking-widest shadow-lg shadow-blue-600/20 transition-all active:scale-95"
                >
                  GİRİŞİ KAYDET
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* TABLO ALANI (MODERN LİSTE GÖRÜNÜMÜ) */}
      <div className="max-w-[1400px] mx-auto bg-slate-900/30 border border-slate-800/60 rounded-[2.5rem] overflow-hidden backdrop-blur-sm shadow-2xl">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[1250px]">
            <thead className="bg-slate-950/80 text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] border-b border-slate-800/80">
              <tr>
                <th className="p-6">AŞAMA / TARİH</th>
                <th className="p-6">Tamir Personeli</th>
                <th className="p-6">Cihaz Bilgisi</th>
                <th className="p-6">İşlem Detayı</th>
                <th className="p-6 text-center">Sonuç</th>
                <th className="p-6">Test Eden</th>
                {isAdmin && <th className="p-6 text-center">Aksiyon</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/30">
              {satirlar.map((satir) => (
                <tr key={satir.id} className={`group hover:bg-white/[0.02] transition-colors ${satir.islemAsamasi === 'Cikis' ? 'bg-indigo-600/[0.03]' : ''}`}>
                  <td className="p-6">
                    <div className="flex flex-col gap-2">
                      <span className={`w-fit px-3 py-1 rounded-lg text-[10px] font-black border ${
                        satir.islemAsamasi === 'Giris' ? 'text-blue-400 border-blue-500/30 bg-blue-500/5' : 'text-indigo-400 border-indigo-500/30 bg-indigo-500/5'
                      }`}>
                        {satir.islemAsamasi === 'Giris' ? '📱 1. GİRİŞ' : '⚙️ 2. ÇIKIŞ'}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">{satir.kayitTarihi}</span>
                    </div>
                  </td>
                  <td className="p-6">
                    <span className="text-sm font-bold text-slate-200 uppercase tracking-tight">{satir.tamirPersoneli}</span>
                  </td>
                  <td className="p-6">
                    <div className="text-sm font-black text-white uppercase">{satir.markaModel}</div>
                    <div className="text-[11px] font-mono text-slate-500 mt-1 uppercase tracking-tighter">{satir.imei}</div>
                  </td>
                  <td className="p-6">
                    <div className="text-sm text-slate-400 leading-relaxed max-w-[250px] italic">"{satir.ariza}"</div>
                  </td>
                  <td className="p-6 text-center">
                    <span className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase border tracking-widest ${
                      satir.tamirDurumu === 'Evet' ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' : 
                      satir.tamirDurumu === 'Hayır' ? 'text-rose-400 border-rose-500/30 bg-rose-500/10' : 
                      satir.tamirDurumu === 'İade' ? 'text-purple-400 border-purple-500/30 bg-purple-500/10' : 'text-blue-400 border-blue-500/30 bg-blue-500/10'
                    }`}>
                      {satir.tamirDurumu}
                    </span>
                  </td>
                  <td className="p-6 font-semibold text-xs text-slate-400">{satir.testYapan}</td>
                  {isAdmin && (
                    <td className="p-6 text-center">
                      <button 
                        onClick={() => {
                          if(confirm("Bu kaydı silmek üzeresiniz. Emin misiniz?")) {
                            setSatirlar(prev => prev.filter(s => s.id !== satir.id));
                          }
                        }}
                        className="p-3 bg-rose-500/10 text-rose-500 rounded-xl hover:bg-rose-500 hover:text-white transition-all opacity-0 group-hover:opacity-100 shadow-lg shadow-rose-900/20"
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
