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
  testYapanGiris: string; 
  testYapanCikis: string; 
  kaydedildi: boolean;
  islemTamam: boolean;    
}

interface Props {
  isAdmin?: boolean;
}

// CANLI VERİTABANI BAĞLANTISI
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbybLbJ9qHJ9XoXU83efBz8WL1unOOhcbj0gitxJQgy96BXZRIiBr99QOIkTYTVznNO81Q/exec";

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
  const [yukleniyor, setYukleniyor] = useState(true);

  const [filtrePersonel, setFiltrePersonel] = useState('Tümü');
  const [filtreDurum, setFiltreDurum] = useState('Tümü');

  const verileriGetir = async () => {
    try {
      const response = await fetch(SCRIPT_URL);
      const data = await response.json();
      setSatirlar(data.reverse()); 
    } catch (error) {
      console.error("Sistem bağlantı hatası:", error);
    } finally {
      setYukleniyor(false);
    }
  };

  useEffect(() => {
    verileriGetir();
  }, []);

  // İSTATİSTİKLER
  const toplamIslem = satirlar.length;
  const tamamlananlar = satirlar.filter(s => s.islemTamam).length;
  const basarili = satirlar.filter(s => s.tamirDurumu === 'Evet').length;
  const bekleyen = satirlar.filter(s => !s.islemTamam).length;
  const iadeler = satirlar.filter(s => s.tamirDurumu === 'İade').length;
  const sorunlu = satirlar.filter(s => s.tamirDurumu === 'Hayır').length;
  const basariOrani = tamamlananlar > 0 ? Math.round((basarili / tamamlananlar) * 100) : 0;

  const filtrelenmisSatirlar = satirlar.filter(s => {
    const personelUygun = filtrePersonel === 'Tümü' || s.tamirPersoneli === filtrePersonel;
    const durumUygun = filtreDurum === 'Tümü' || 
                      (filtreDurum === 'Beklemede' && !s.islemTamam) || 
                      (filtreDurum === 'Tamamlandı' && s.islemTamam) ||
                      (s.tamirDurumu === filtreDurum);
    return personelUygun && durumUygun;
  });

  const handleImeiSorgula = () => {
    // TİP UYUŞMAZLIĞI VE BOŞLUKLARI ÇÖZEN YENİ KOD
    const cihaz = satirlar.find(s => String(s.imei).trim() === String(aramaImei).trim());
    
    if (cihaz) {
      setBulunanCihaz(cihaz);
    } else {
      alert("Sistemde bu IMEI numarasına ait kayıt bulunamadı.");
      setBulunanCihaz(null);
    }
  };

  const yeniGirisKaydet = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const yeni: Satir = {
      id: Date.now(),
      tamirPersoneli: formData.get('tPers') as string,
      markaModel: formData.get('model') as string,
      imei: formData.get('imei') as string,
      ariza: formData.get('ariza') as string,
      tamirDurumu: 'Beklemede',
      neden: '',
      testYapanGiris: formData.get('test1') as string,
      testYapanCikis: '',
      kaydedildi: true,
      islemTamam: false
    };

    setSatirlar(prev => [yeni, ...prev]);
    e.currentTarget.reset();

    try {
      await fetch(SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify({ action: "yeniGiris", ...yeni }),
        mode: 'no-cors' 
      });
      alert("Sistem kaydı başarıyla oluşturuldu.");
    } catch (error) {
      console.error("Kayıt işlemi sırasında hata:", error);
    }
  };

  const cikisKaydet = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!bulunanCihaz) return;
    const formData = new FormData(e.currentTarget);
    
    const guncelVeri = {
      action: "cikisGuncelle",
      id: bulunanCihaz.id,
      tamirDurumu: formData.get('durum') as string,
      neden: formData.get('not') as string,
      testYapanCikis: formData.get('test2') as string
    };

    setSatirlar(prev => prev.map(s => s.id === bulunanCihaz.id ? {
      ...s,
      tamirDurumu: guncelVeri.tamirDurumu,
      neden: guncelVeri.neden,
      testYapanCikis: guncelVeri.testYapanCikis,
      islemTamam: true
    } : s));

    setBulunanCihaz(null);
    setAramaImei('');

    try {
      await fetch(SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify(guncelVeri),
        mode: 'no-cors'
      });
      alert("Cihaz çıkış işlemi başarıyla tamamlandı ve sisteme işlendi.");
    } catch (error) {
      console.error("Güncelleme sırasında hata:", error);
    }
  };

  const getDurumRenk = (durum: string) => {
    if (durum === 'Evet') return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    if (durum === 'Hayır') return 'bg-rose-500/10 text-rose-400 border-rose-500/20 shadow-[0_0_15px_rgba(244,63,94,0.2)]';
    if (durum === 'İade') return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
    return 'bg-slate-800 text-slate-400 border-slate-700';
  };

  return (
    <div className={`bg-slate-950 text-slate-200 font-sans selection:bg-blue-500/30 ${!isAdmin ? 'min-h-screen p-4 md:p-8' : 'p-2'}`}>
      
      {isAdmin && (
        <div className="max-w-[1400px] mx-auto mb-10 animate-in fade-in duration-700">
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
            <div onClick={() => setFiltreDurum('Tümü')} className="bg-slate-900/60 border border-slate-800 p-6 rounded-3xl cursor-pointer hover:bg-slate-800 transition-colors">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Toplam Kayıt</p>
              <p className="text-3xl font-black text-white mt-1">{toplamIslem}</p>
            </div>
            <div onClick={() => setFiltreDurum('Evet')} className="bg-slate-900/60 border border-slate-800 p-6 rounded-3xl border-l-4 border-l-emerald-500 cursor-pointer hover:bg-emerald-900/20 transition-colors">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Başarılı</p>
              <p className="text-3xl font-black text-emerald-400 mt-1">{basarili}</p>
            </div>
            <div onClick={() => setFiltreDurum('Hayır')} className="bg-rose-950/30 border border-rose-900/50 p-6 rounded-3xl border-l-4 border-l-rose-500 cursor-pointer hover:bg-rose-900/40 transition-colors relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <svg className="w-12 h-12 text-rose-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
              </div>
              <p className="text-xs font-bold text-rose-400 uppercase tracking-widest relative z-10">Sorunlu Cihaz</p>
              <p className="text-3xl font-black text-rose-500 mt-1 relative z-10">{sorunlu}</p>
            </div>
            <div onClick={() => setFiltreDurum('Beklemede')} className="bg-slate-900/60 border border-slate-800 p-6 rounded-3xl border-l-4 border-l-amber-500 cursor-pointer hover:bg-amber-900/20 transition-colors">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Bekleyen</p>
              <p className="text-3xl font-black text-amber-400 mt-1">{bekleyen}</p>
            </div>
            <div onClick={() => setFiltreDurum('İade')} className="bg-slate-900/60 border border-slate-800 p-6 rounded-3xl border-l-4 border-l-purple-500 cursor-pointer hover:bg-purple-900/20 transition-colors">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Toplam İade</p>
              <p className="text-3xl font-black text-purple-400 mt-1">{iadeler}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 bg-slate-900/30 p-4 rounded-2xl border border-slate-800/50">
             <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500 uppercase">Tamirci:</span>
                <select 
                  value={filtrePersonel} 
                  onChange={(e) => setFiltrePersonel(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-blue-500"
                >
                  <option value="Tümü">Tüm Personeller</option>
                  {TAMIR_PERSONELI_LISTESI.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
             </div>
             <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500 uppercase">Durum:</span>
                <select 
                  value={filtreDurum} 
                  onChange={(e) => setFiltreDurum(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-blue-500"
                >
                  <option value="Tümü">Tüm Durumlar</option>
                  <option value="Beklemede">⏳ Beklemede</option>
                  <option value="Tamamlandı">✔️ Tamamlananlar</option>
                  <option value="Evet">✅ Sorunsuz</option>
                  <option value="Hayır">❌ Sorunlu</option>
                  <option value="İade">🔄 İade</option>
                </select>
             </div>
          </div>
        </div>
      )}

      <div className="max-w-[1400px] mx-auto mb-8 animate-in fade-in slide-in-from-top-4 duration-500">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6 border-b border-slate-800/80 pb-6">
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-4">
            <div className="w-2 h-8 bg-blue-600 rounded-full shadow-[0_0_15px_rgba(37,99,235,0.5)]"></div>
            CNET TEKNİK TAKİP 
            {isAdmin && <span className="ml-2 text-[10px] bg-blue-900/40 text-blue-400 px-3 py-1 rounded-full border border-blue-800/50 uppercase tracking-widest">Yönetici Paneli</span>}
          </h1>
          
          {!isAdmin && (
            <div className="flex w-full md:w-auto gap-2 bg-slate-900/50 p-2 rounded-2xl border border-slate-800 shadow-xl focus-within:border-blue-500/50 transition-all">
              <input 
                type="text" 
                placeholder="Çıkış Kontrolü İçin IMEI Ara..." 
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
          )}
        </div>

        {!isAdmin && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
            <div className="bg-slate-900/40 border border-slate-800 rounded-[2rem] p-8 shadow-xl backdrop-blur-md">
              <h3 className="text-sm font-black text-blue-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
                1. PERSONEL: GİRİŞ EKSPERTİZİ
              </h3>
              <form onSubmit={yeniGirisKaydet} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <select name="tPers" required className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm outline-none focus:border-blue-500 text-slate-200">
                  <option value="">Tamir Personeli Seçiniz...</option>
                  {TAMIR_PERSONELI_LISTESI.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
                <select name="test1" required className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm outline-none focus:border-blue-500 text-slate-200">
                  <option value="">1. Test Personeli Seçiniz...</option>
                  {TEST_PERSONELI.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                <input name="model" required type="text" placeholder="Marka / Model" className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm outline-none focus:border-blue-500 text-white" />
                <input name="imei" required type="text" placeholder="IMEI Kaydı" className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm outline-none focus:border-blue-500 font-mono text-white" />
                <textarea name="ariza" required placeholder="Cihaz Arızaları..." className="md:col-span-2 bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm outline-none focus:border-blue-500 h-20 text-white"></textarea>
                <button type="submit" className="md:col-span-2 bg-blue-600 hover:bg-blue-500 text-white font-black py-4 rounded-2xl text-xs uppercase tracking-widest transition-all shadow-lg shadow-blue-600/20">SİSTEME KAYDET</button>
              </form>
            </div>

            <div className={`border rounded-[2rem] p-8 shadow-xl backdrop-blur-md transition-all duration-500 ${bulunanCihaz ? 'bg-indigo-900/10 border-indigo-500/30' : 'bg-slate-900/20 border-slate-800 opacity-40'}`}>
              <h3 className="text-sm font-black text-indigo-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${bulunanCihaz ? 'bg-indigo-500 animate-pulse' : 'bg-slate-600'}`}></span>
                2. PERSONEL: ÇIKIŞ KONTROLÜ
              </h3>
              {bulunanCihaz ? (
                <form onSubmit={cikisKaydet} className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in slide-in-from-right-4">
                  <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800 md:col-span-2">
                    <p className="text-[10px] text-slate-500 font-bold uppercase mb-1 tracking-tighter">Sorgulanan Cihaz</p>
                    <p className="text-sm font-bold text-white uppercase">{bulunanCihaz.markaModel} <span className="text-slate-500 font-mono text-xs ml-2">[{bulunanCihaz.imei}]</span></p>
                  </div>
                  <select name="durum" required className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm outline-none focus:border-indigo-500 font-bold text-emerald-400">
                    <option value="Evet">✅ SORUNSUZ</option>
                    <option value="Hayır">❌ SORUNLU</option>
                    <option value="İade">🔄 İADE</option>
                  </select>
                  <select name="test2" required className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm outline-none focus:border-indigo-500 text-slate-200">
                    <option value="">2. Test Personeli Seçiniz...</option>
                    {TEST_PERSONELI.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                  <textarea name="not" placeholder="Hata Detayı / Yapılan İşlem..." className="md:col-span-2 bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm outline-none focus:border-indigo-500 h-20 text-white"></textarea>
                  <button type="submit" className="md:col-span-2 bg-indigo-600 hover:bg-indigo-500 text-white font-black py-4 rounded-2xl text-xs uppercase tracking-widest transition-all shadow-lg shadow-indigo-600/20">ÇIKIŞI TAMAMLA</button>
                </form>
              ) : (
                <div className="flex items-center justify-center h-[260px] text-slate-600 italic text-sm text-center px-10">
                  IMEI sorguladıktan sonra çıkış kontrolü burada aktifleşir.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="max-w-[1400px] mx-auto bg-slate-900/40 border border-slate-800 rounded-[2.5rem] overflow-hidden shadow-2xl backdrop-blur-md">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[1250px]">
            <thead className="bg-slate-950/80 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-800/80">
              <tr>
                <th className="p-6">TAMİR PERSONELİ</th>
                <th className="p-6">CİHAZ BİLGİSİ</th>
                <th className="p-6 w-[400px]">ARIZA / NOT KONTROLÜ</th>
                <th className="p-6 text-center">İŞLEM DURUMU</th>
                <th className="p-6">TESTLER (GİRİŞ ➔ ÇIKIŞ)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {yukleniyor ? (
                <tr><td colSpan={5} className="p-10 text-center text-slate-500 font-bold animate-pulse">Sistem Verileri Yükleniyor...</td></tr>
              ) : filtrelenmisSatirlar.map((satir) => (
                <tr key={satir.id} className="group hover:bg-white/[0.02] transition-colors">
                  <td className="p-6">
                    <div className="text-sm font-bold text-slate-200 uppercase tracking-tight">{satir.tamirPersoneli}</div>
                  </td>
                  <td className="p-6">
                    <div className="text-sm font-black text-white uppercase">{satir.markaModel}</div>
                    <div className="text-[11px] font-mono text-slate-500 mt-1">{satir.imei}</div>
                  </td>
                  <td className="p-6">
                    <div className="text-xs text-slate-400">
                      <span className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Geliş Şikayeti:</span>
                      <span className="italic">"{satir.ariza}"</span>
                    </div>
                    
                    {satir.neden && (
                      <div className={`mt-3 p-3 rounded-xl border ${satir.tamirDurumu === 'Hayır' ? 'bg-rose-500/10 border-rose-500/30 text-rose-300' : 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300'}`}>
                        <span className={`font-black uppercase text-[10px] mb-1 flex items-center gap-1 ${satir.tamirDurumu === 'Hayır' ? 'text-rose-500' : 'text-indigo-400'}`}>
                          {satir.tamirDurumu === 'Hayır' ? '⚠️ DİKKAT - ARIZA NEDENİ:' : '📌 TEST ÇIKIŞ NOTU:'}
                        </span>
                        <span className="text-xs font-medium">{satir.neden}</span>
                      </div>
                    )}
                  </td>
                  <td className="p-6 text-center">
                    <span className={`px-4 py-2 rounded-xl text-[10px] font-black border uppercase tracking-widest ${getDurumRenk(satir.tamirDurumu)}`}>
                      {satir.islemTamam ? satir.tamirDurumu : '⏳ BEKLEMEDE'}
                    </span>
                  </td>
                  <td className="p-6">
                    <div className="flex items-center gap-2 text-[10px] font-bold">
                      <span className="text-blue-400 uppercase">{satir.testYapanGiris || '---'}</span>
                      <span className="text-slate-700">➔</span>
                      <span className="text-indigo-400 uppercase">{satir.testYapanCikis || '---'}</span>
                    </div>
                  </td>
                </tr>
              ))}
              {!yukleniyor && filtrelenmisSatirlar.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-10 text-center text-slate-500">
                    Bu filtrelere uygun cihaz bulunamadı.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default TeknikTakipTablosu;
