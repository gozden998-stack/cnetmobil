"use client";

import React, { useState, useEffect } from 'react';

// 1. Arayüz Tanımı (Tüm özellikler eksiksiz)
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
  kayitTarihi: string;
  islemAsamasi: 'Giris' | 'Cikis';
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

  // Filtre State'leri
  const [filtreUsta, setFiltreUsta] = useState('');
  const [filtreTestci, setFiltreTestci] = useState('');
  const [filtreSonuc, setFiltreSonuc] = useState('');

  useEffect(() => {
    const kaydedilmis = localStorage.getItem('cnet_teknik_kayitlar');
    if (kaydedilmis) setSatirlar(JSON.parse(kaydedilmis));
  }, []);

  useEffect(() => {
    if (satirlar.length > 0) localStorage.setItem('cnet_teknik_kayitlar', JSON.stringify(satirlar));
  }, [satirlar]);

  // Filtreleme Mantığı
  const filtrelenmisSatirlar = satirlar.filter(s => {
    const ustaMatch = filtreUsta ? s.tamirPersoneli === filtreUsta : true;
    const testMatch = filtreTestci ? (s.testYapanGiris === filtreTestci || s.testYapanCikis === filtreTestci) : true;
    const sonucMatch = filtreSonuc ? s.tamirDurumu === filtreSonuc : true;
    return ustaMatch && testMatch && sonucMatch;
  });

  // İstatistik Kartları Verileri
  const toplam = filtrelenmisSatirlar.length;
  const sorunsuz = filtrelenmisSatirlar.filter(s => s.tamirDurumu === 'Evet').length;
  const sorunlu = filtrelenmisSatirlar.filter(s => s.tamirDurumu === 'Hayır').length;
  const iade = filtrelenmisSatirlar.filter(s => s.tamirDurumu === 'İade').length;
  const basariPuani = toplam > 0 ? Math.round((sorunsuz / toplam) * 100) : 0;

  // Yeni Kayıt Fonksiyonu (Hatalar Giderildi)
  const satirKaydet = (yeniVeri: Partial<Satir>) => {
    const tamVeri: Satir = {
      tamirPersoneli: '', 
      markaModel: '', 
      imei: '', 
      ariza: '', 
      tamirDurumu: 'Beklemede', 
      neden: '', 
      testYapanGiris: '', 
      testYapanCikis: '', 
      islemTamam: false,
      islemAsamasi: 'Giris',
      ...yeniVeri as Satir, // Gelen verileri yay
      id: Date.now(), // id'yi en sona yazarak TS çakışmasını önlüyoruz
      kayitTarihi: new Date().toLocaleString('tr-TR'),
      kaydedildi: true
    };
    setSatirlar(prev => [tamVeri, ...prev]);
    setBulunanCihaz(null);
    setAramaImei('');
  };

  return (
    <div className={`font-sans ${!isAdmin ? 'bg-slate-950 min-h-screen p-4 md:p-8' : 'bg-transparent p-0'}`}>
      <div className="max-w-[1400px] mx-auto space-y-8">
        
        {/* --- YÖNETİCİ PANELİ: İSTATİSTİK VE FİLTRE (Giriş Ekranı Yok) --- */}
        {isAdmin && (
          <div className="animate-in fade-in slide-in-from-top-4 duration-700">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
              {[
                { t: "TOPLAM İŞLEM", v: toplam, c: "text-blue-400" },
                { t: "SORUNSUZ (OK)", v: sorunsuz, c: "text-emerald-400" },
                { t: "SORUNLU / HATA", v: sorunlu, c: "text-rose-400" },
                { t: "İADE EDİLEN", v: iade, c: "text-purple-400" },
                { t: "BAŞARI PUANI", v: `%${basariPuani}`, c: "text-amber-400" }
              ].map((k, i) => (
                <div key={i} className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl backdrop-blur-sm">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">{k.t}</p>
                  <p className={`text-3xl font-black ${k.c}`}>{k.v}</p>
                </div>
              ))}
            </div>

            <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-[2rem] flex flex-wrap gap-4 items-end shadow-2xl mb-8">
              <div className="flex-1 min-w-[200px]">
                <label className="text-[10px] font-bold text-slate-400 uppercase mb-2 block ml-2">Tamir Personeli Filtre</label>
                <select value={filtreUsta} onChange={e => setFiltreUsta(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm outline-none focus:border-blue-500 text-white">
                  <option value="">Tüm Ustalar</option>
                  {TAMIR_PERSONELI_LISTESI.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div className="flex-1 min-w-[200px]">
                <label className="text-[10px] font-bold text-slate-400 uppercase mb-2 block ml-2">Test Personeli Filtre</label>
                <select value={filtreTestci} onChange={e => setFiltreTestci(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm outline-none focus:border-blue-500 text-white">
                  <option value="">Tüm Test Personelleri</option>
                  {TEST_PERSONELI.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="flex-1 min-w-[200px]">
                <label className="text-[10px] font-bold text-slate-400 uppercase mb-2 block ml-2">İşlem Durumu</label>
                <select value={filtreSonuc} onChange={e => setFiltreSonuc(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm outline-none focus:border-emerald-500 text-white">
                  <option value="">Tüm Durumlar</option>
                  <option value="Evet">✅ Sorunsuz</option>
                  <option value="Hayır">❌ Sorunlu</option>
                  <option value="İade">🔄 İade</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* --- PERSONEL PANELİ: VERİ GİRİŞİ (Sadece Personel Modunda Görünür) --- */}
        {!isAdmin && (
          <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex w-full md:w-fit gap-2 bg-slate-900/80 p-2 rounded-2xl border border-slate-800 shadow-xl mx-auto">
              <input 
                type="text" 
                placeholder="Çıkış Kaydı İçin IMEI..." 
                className="bg-transparent border-none outline-none px-4 text-sm w-64 text-white font-mono"
                value={aramaImei}
                onChange={(e) => setAramaImei(e.target.value)}
              />
              <button onClick={() => {
                const cihaz = satirlar.find(s => s.imei === aramaImei && s.kaydedildi && !s.islemTamam);
                if (cihaz) setBulunanCihaz(cihaz); else alert("Kayıt bulunamadı veya işlem tamamlanmış.");
              }} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-xl text-xs font-bold transition-all">SORGULA</button>
            </div>

            {bulunanCihaz ? (
              <div className="bg-indigo-900/10 border border-indigo-500/30 p-8 rounded-[2.5rem] animate-in zoom-in-95">
                <h3 className="text-indigo-400 font-black text-sm mb-6 uppercase tracking-widest">2. PERSONEL: TAMİR SONRASI ÇIKIŞ KONTROLÜ</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800 opacity-60">
                    <p className="text-[10px] font-bold text-slate-500 uppercase">Cihaz</p>
                    <p className="text-sm font-bold text-white uppercase">{bulunanCihaz.markaModel}</p>
                  </div>
                  <select id="cDurum" className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-sm outline-none focus:border-indigo-500 font-bold text-emerald-400">
                    <option value="Evet">✅ SORUNSUZ</option>
                    <option value="Hayır">❌ SORUNLU</option>
                    <option value="İade">🔄 İADE</option>
                  </select>
                  <input id="cHata" type="text" placeholder="Yapılan İşlem..." className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-sm outline-none focus:border-indigo-500 text-white" />
                  <select id="cTest" className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-sm outline-none focus:border-indigo-500 text-white">
                    <option value="">Çıkış Test Personeli...</option>
                    {TEST_PERSONELI.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                  <button 
                    onClick={() => {
                      setSatirlar(prev => prev.map(s => s.id === bulunanCihaz.id ? {
                        ...s,
                        tamirDurumu: (document.getElementById('cDurum') as HTMLSelectElement).value,
                        neden: (document.getElementById('cHata') as HTMLInputElement).value,
                        testYapanCikis: (document.getElementById('cTest') as HTMLSelectElement).value,
                        islemTamam: true,
                        islemAsamasi: 'Cikis'
                      } : s));
                      setBulunanCihaz(null); setAramaImei('');
                    }}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-xl text-xs uppercase tracking-widest shadow-lg shadow-indigo-600/20 transition-all active:scale-95"
                  >
                    KAYDI BİTİR
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-blue-900/10 border border-blue-500/20 p-8 rounded-[2.5rem]">
                <h3 className="text-blue-400 font-black text-sm mb-6 uppercase tracking-widest">1. PERSONEL: GİRİŞ EKSPERTİZİ</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  <select id="gPers" className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm outline-none focus:border-blue-500 text-slate-200">
                    <option value="">Tamir Personeli...</option>
                    {TAMIR_PERSONELI_LISTESI.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                  <select id="gTest" className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm outline-none focus:border-blue-500 text-slate-200">
                    <option value="">1. Test Personeli...</option>
                    {TEST_PERSONELI.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                  <input id="gModel" type="text" placeholder="Marka / Model" className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm outline-none focus:border-blue-500 text-white" />
                  <input id="gImei" type="text" placeholder="IMEI No" className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm outline-none focus:border-blue-500 font-mono text-white uppercase" />
                  <input id="gAriza" type="text" placeholder="Müşteri Şikayeti..." className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm outline-none focus:border-blue-500 text-white" />
                  <button 
                    onClick={() => satirKaydet({
                      tamirPersoneli: (document.getElementById('gPers') as HTMLSelectElement).value,
                      testYapanGiris: (document.getElementById('gTest') as HTMLSelectElement).value,
                      markaModel: (document.getElementById('gModel') as HTMLInputElement).value,
                      imei: (document.getElementById('gImei') as HTMLInputElement).value,
                      ariza: (document.getElementById('gAriza') as HTMLInputElement).value,
                      islemAsamasi: 'Giris'
                    })}
                    className="bg-blue-600 hover:bg-blue-500 text-white font-black rounded-xl text-xs uppercase tracking-widest shadow-lg shadow-blue-600/20 transition-all active:scale-95"
                  >
                    GİRİŞİ KAYDET
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TABLO LİSTESİ (Yönetici ve Personel Ortak Görünüm) */}
        <div className="bg-slate-900/40 border border-slate-800 rounded-[2.5rem] overflow-hidden backdrop-blur-sm shadow-2xl">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse min-w-[1250px]">
              <thead className="bg-slate-950 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-800/80">
                <tr>
                  <th className="p-6">TAMİR PERSONELİ</th>
                  <th className="p-6">CİHAZ & IMEI</th>
                  <th className="p-6">DURUM / NOT</th>
                  <th className="p-6 text-center">İŞLEM TARİHİ</th>
                  <th className="p-6">TESTLER (GİRİŞ ➔ ÇIKIŞ)</th>
                  {isAdmin && <th className="p-6 text-center">AKSİYON</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40">
                {filtrelenmisSatirlar.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-20 text-center text-slate-600 italic uppercase tracking-widest">Kayıt Bulunmamaktadır</td>
                  </tr>
                ) : (
                  filtrelenmisSatirlar.map((satir) => (
                    <tr key={satir.id} className="group hover:bg-white/[0.02] transition-colors">
                      <td className="p-6">
                        <div className="text-sm font-bold text-slate-200 uppercase tracking-tight">{satir.tamirPersoneli}</div>
                      </td>
                      <td className="p-6">
                        <div className="text-sm font-black text-white uppercase">{satir.markaModel}</div>
                        <div className="text-[11px] font-mono text-slate-500 mt-1 uppercase tracking-tighter">{satir.imei}</div>
                      </td>
                      <td className="p-6">
                        <div className="flex flex-col gap-1.5">
                          <span className={`w-fit px-3 py-1 rounded-lg text-[9px] font-black border uppercase tracking-wider ${
                            satir.tamirDurumu === 'Evet' ? 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5' : 
                            satir.tamirDurumu === 'Hayır' ? 'text-rose-400 border-rose-500/20 bg-rose-500/5' : 
                            satir.tamirDurumu === 'İade' ? 'text-purple-400 border-purple-500/20 bg-purple-500/5' : 'text-blue-400 border-blue-500/20 bg-blue-500/5'
                          }`}>
                            {satir.islemTamam ? satir.tamirDurumu : '⏳ BEKLEMEDE'}
                          </span>
                          <span className="text-xs text-slate-400 italic">"{satir.neden || satir.ariza}"</span>
                        </div>
                      </td>
                      <td className="p-6 text-center text-[10px] text-slate-500 font-mono uppercase italic">{satir.kayitTarihi}</td>
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
                            onClick={() => { if(confirm("Silmek istiyor musunuz?")) setSatirlar(prev => prev.filter(s => s.id !== satir.id)) }}
                            className="p-3 bg-rose-500/10 text-rose-500 rounded-xl hover:bg-rose-500 hover:text-white transition-all opacity-0 group-hover:opacity-100 shadow-lg shadow-rose-900/20"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeknikTakipTablosu;
