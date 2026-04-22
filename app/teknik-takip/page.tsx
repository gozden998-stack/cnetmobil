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
  islemTamam: boolean;    
  tarih: string;
}

interface Props {
  isAdmin?: boolean;
}

const TeknikTakipTablosu = ({ isAdmin = false }: Props) => {
  const TEKNIK_API_URL = "https://script.google.com/macros/s/AKfycbzcxFQ66zQc2jYse7fLpCvPqQDZ7NHxY0liU6T7MxwAzov_UxTYGogD4P_YcgJjxuOcoA/exec"; 

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
  const [loading, setLoading] = useState(false);

  const [filtrePersonel, setFiltrePersonel] = useState('Tümü');
  const [filtreDurum, setFiltreDurum] = useState('Tümü');

  const verileriGetir = async () => {
    setLoading(true);
    try {
      const res = await fetch(TEKNIK_API_URL);
      const data = await res.json();
      setSatirlar(data);
    } catch (error) {
      console.error("Veri çekme hatası:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    verileriGetir();
  }, []);

  const tamamlananlar = satirlar.filter(s => s.islemTamam).length;
  const basarili = satirlar.filter(s => s.tamirDurumu === 'Evet').length;
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
    const cihaz = satirlar.find(s => s.imei.toString() === aramaImei);
    if (cihaz) {
      setBulunanCihaz(cihaz);
    } else {
      alert("Bu IMEI ile kayıtlı bir cihaz bulunamadı.");
      setBulunanCihaz(null);
    }
  };

  const yeniGirisKaydet = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (loading) return; // Çift tıklama koruması
    
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    
    const yeni = {
      action: "add",
      id: Date.now(),
      tamirPersoneli: formData.get('tPers'),
      markaModel: formData.get('model'),
      imei: formData.get('imei'),
      ariza: formData.get('ariza'),
      tamirDurumu: 'Beklemede',
      testYapanGiris: formData.get('test1'),
      islemTamam: false,
      tarih: new Date().toLocaleString('tr-TR')
    };

    try {
      await fetch(TEKNIK_API_URL, { method: 'POST', body: JSON.stringify(yeni) });
      await verileriGetir();
      e.currentTarget.reset();
      alert("Giriş kaydı merkezi sisteme eklendi.");
    } catch (err) {
      alert("Kayıt sırasında hata oluştu.");
    } finally {
      setLoading(false);
    }
  };

  const cikisKaydet = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!bulunanCihaz || loading) return;
    
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    
    const guncelle = {
      action: "update",
      imei: bulunanCihaz.imei,
      tamirDurumu: formData.get('durum'),
      neden: formData.get('not'),
      testYapanCikis: formData.get('test2')
    };

    try {
      await fetch(TEKNIK_API_URL, { method: 'POST', body: JSON.stringify(guncelle) });
      setBulunanCihaz(null);
      setAramaImei('');
      await verileriGetir();
      alert("Cihaz çıkış kaydı tamamlandı.");
    } catch (err) {
      alert("Güncelleme sırasında hata oluştu.");
    } finally {
      setLoading(false);
    }
  };

  // YÖNETİCİ SİLME FONKSİYONU
  const kayitSil = async (imei: string) => {
    if (!confirm("Bu kaydı kalıcı olarak silmek istediğinize emin misiniz?")) return;
    
    setLoading(true);
    try {
      await fetch(TEKNIK_API_URL, { 
        method: 'POST', 
        body: JSON.stringify({ action: "delete", imei: imei }) 
      });
      await verileriGetir();
      alert("Kayıt başarıyla silindi.");
    } catch (err) {
      alert("Silme işlemi sırasında hata oluştu.");
    } finally {
      setLoading(false);
    }
  };

  const getDurumRenk = (durum: string) => {
    if (durum === 'Evet') return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    if (durum === 'Hayır') return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
    if (durum === 'İade') return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
    return 'bg-slate-800 text-slate-400 border-slate-700';
  };

  return (
    <div className={`bg-slate-950 text-slate-200 font-sans ${!isAdmin ? 'min-h-screen p-4 md:p-8' : 'p-2'}`}>
      
      {isAdmin && (
        <div className="max-w-[1400px] mx-auto mb-10 animate-in fade-in duration-700">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-3xl">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Toplam Kayıt</p>
              <p className="text-3xl font-black text-white mt-1">{satirlar.length}</p>
            </div>
            <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-3xl border-l-4 border-l-emerald-500">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Başarı Oranı</p>
              <p className="text-3xl font-black text-emerald-400 mt-1">%{basariOrani}</p>
            </div>
            <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-3xl border-l-4 border-l-amber-500">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Bekleyen</p>
              <p className="text-3xl font-black text-amber-400 mt-1">{satirlar.filter(s => !s.islemTamam).length}</p>
            </div>
            <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-3xl border-l-4 border-l-purple-500">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">İade</p>
              <p className="text-3xl font-black text-purple-400 mt-1">{satirlar.filter(s => s.tamirDurumu === 'İade').length}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 bg-slate-900/30 p-4 rounded-2xl border border-slate-800/50 mb-6">
             <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500">Personel:</span>
                <select value={filtrePersonel} onChange={(e) => setFiltrePersonel(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-blue-500 cursor-pointer">
                  <option value="Tümü">Tüm Personeller</option>
                  {TAMIR_PERSONELI_LISTESI.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
             </div>
             <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500">Durum:</span>
                <select value={filtreDurum} onChange={(e) => setFiltreDurum(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-blue-500 cursor-pointer">
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

      <div className="max-w-[1400px] mx-auto mb-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6 border-b border-slate-800/80 pb-6">
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-4">
            <div className="w-2 h-8 bg-blue-600 rounded-full"></div>
            CNET TEKNİK TAKİP
          </h1>
          <div className="flex w-full md:w-auto gap-2 bg-slate-900/50 p-2 rounded-2xl border border-slate-800 shadow-xl focus-within:ring-1 focus-within:ring-blue-500 transition-all">
            <input 
              type="text" 
              placeholder="Çıkış İçin IMEI Ara..." 
              className="bg-transparent px-4 text-sm w-full md:w-64 text-white font-mono outline-none"
              value={aramaImei}
              onChange={(e) => setAramaImei(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleImeiSorgula()}
            />
            <button 
              onClick={handleImeiSorgula} 
              className="bg-blue-600 hover:bg-blue-500 hover:scale-105 active:scale-95 text-white px-6 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-lg shadow-blue-600/20"
            >
              SORGULA
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
          <div className="bg-slate-900/40 border border-slate-800 rounded-[2rem] p-8 shadow-xl backdrop-blur-md">
            <h3 className="text-sm font-black text-blue-400 uppercase tracking-widest mb-6">1. PERSONEL: GİRİŞ EKSPERTİZİ</h3>
            <form onSubmit={yeniGirisKaydet} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <select name="tPers" required className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-slate-200 cursor-pointer outline-none focus:border-blue-500">
                <option value="">Tamir Personeli Seçiniz...</option>
                {TAMIR_PERSONELI_LISTESI.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
              <select name="test1" required className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-slate-200 cursor-pointer outline-none focus:border-blue-500">
                <option value="">1. Test Personeli Seçiniz...</option>
                {TEST_PERSONELI.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <input name="model" required type="text" placeholder="Marka / Model" className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white outline-none focus:border-blue-500" />
              <input name="imei" required type="text" placeholder="IMEI" className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm font-mono text-white outline-none focus:border-blue-500" />
              <textarea name="ariza" required placeholder="Arıza Detayları..." className="md:col-span-2 bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm h-20 text-white outline-none focus:border-blue-500 resize-none"></textarea>
              <button 
                type="submit" 
                disabled={loading}
                className={`md:col-span-2 font-black py-4 rounded-2xl text-xs uppercase transition-all shadow-lg flex items-center justify-center gap-2
                  ${loading ? 'bg-slate-700 cursor-not-allowed opacity-50' : 'bg-blue-600 hover:bg-blue-500 hover:scale-[1.02] active:scale-95 cursor-pointer shadow-blue-600/20'}`}
              >
                {loading ? 'KAYDEDİLİYOR...' : 'GİRİŞİ KAYDET'}
              </button>
            </form>
          </div>

          <div className={`border rounded-[2rem] p-8 shadow-xl backdrop-blur-md transition-all duration-500 ${bulunanCihaz ? 'bg-indigo-900/10 border-indigo-500/30' : 'bg-slate-900/20 border-slate-800 opacity-40'}`}>
            <h3 className="text-sm font-black text-indigo-400 uppercase mb-6">2. PERSONEL: ÇIKIŞ KONTROLÜ</h3>
            {bulunanCihaz ? (
              <form onSubmit={cikisKaydet} className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in slide-in-from-right-4">
                <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800 md:col-span-2 flex justify-between items-center">
                  <p className="text-sm font-bold text-white uppercase">{bulunanCihaz.markaModel} <span className="text-slate-500 font-mono text-xs ml-2">[{bulunanCihaz.imei}]</span></p>
                  <button type="button" onClick={() => setBulunanCihaz(null)} className="text-xs text-rose-400 underline cursor-pointer hover:text-rose-300 transition-colors">Vazgeç</button>
                </div>
                <select name="durum" required className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm font-bold text-emerald-400 cursor-pointer outline-none focus:border-indigo-500">
                  <option value="Evet">✅ SORUNSUZ</option>
                  <option value="Hayır">❌ SORUNLU</option>
                  <option value="İade">🔄 İADE</option>
                </select>
                <select name="test2" required className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-slate-200 cursor-pointer outline-none focus:border-indigo-500">
                  <option value="">2. Test Personeli Seçiniz...</option>
                  {TEST_PERSONELI.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                <textarea name="not" placeholder="Yapılan İşlem / Not..." className="md:col-span-2 bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm h-20 text-white outline-none focus:border-indigo-500 resize-none"></textarea>
                <button 
                  type="submit" 
                  disabled={loading}
                  className={`md:col-span-2 font-black py-4 rounded-2xl text-xs uppercase transition-all shadow-lg flex items-center justify-center gap-2
                    ${loading ? 'bg-slate-700 cursor-not-allowed opacity-50' : 'bg-indigo-600 hover:bg-indigo-500 hover:scale-[1.02] active:scale-95 cursor-pointer shadow-indigo-600/20'}`}
                >
                  {loading ? 'GÜNCELLENİYOR...' : 'ÇIKIŞI TAMAMLA'}
                </button>
              </form>
            ) : (
              <div className="flex items-center justify-center h-[260px] text-slate-600 italic text-sm text-center px-10">Lütfen çıkış işlemi için IMEI sorgulayın.</div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto bg-slate-900/40 border border-slate-800 rounded-[2.5rem] overflow-hidden shadow-2xl backdrop-blur-md">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left min-w-[1350px]">
            <thead className="bg-slate-950/80 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-800/80">
              <tr>
                <th className="p-6">PERSONEL / TARİH</th>
                <th className="p-6">CİHAZ BİLGİSİ</th>
                <th className="p-6">ARIZA / NOT</th>
                <th className="p-6 text-center">DURUM</th>
                <th className="p-6">TESTLER (GİRİŞ ➔ ÇIKIŞ)</th>
                {isAdmin && <th className="p-6 text-center">İŞLEM</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {filtrelenmisSatirlar.map((satir) => (
                <tr key={satir.id} className="group hover:bg-white/[0.02] transition-colors">
                  <td className="p-6">
                    <div className="text-sm font-bold text-slate-200 uppercase">{satir.tamirPersoneli}</div>
                    <div className="text-[10px] text-slate-500 mt-1">{satir.tarih}</div>
                  </td>
                  <td className="p-6">
                    <div className="text-sm font-black text-white uppercase">{satir.markaModel}</div>
                    <div className="text-[11px] font-mono text-slate-500">{satir.imei}</div>
                  </td>
                  <td className="p-6">
                    <div className="text-xs text-slate-400 italic">"{satir.ariza}"</div>
                    {satir.neden && <div className="text-[10px] text-indigo-400 mt-2 font-bold uppercase">Not: {satir.neden}</div>}
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
                  {isAdmin && (
                    <td className="p-6 text-center">
                      <button 
                        onClick={() => kayitSil(satir.imei)}
                        disabled={loading}
                        className="p-2.5 bg-rose-500/10 text-rose-500 rounded-xl hover:bg-rose-500 hover:text-white transition-all hover:scale-110 active:scale-90 cursor-pointer border border-rose-500/20"
                        title="Kaydı Sil"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
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
