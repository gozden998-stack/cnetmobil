"use client";

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// --- MERKEZİ SİSTEM BAĞLANTISI ---
const supabaseUrl = 'https://zmbkijsznzumwvyvfhaq.supabase.co'; 
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InptYmtpanN6bnp1bXd2eXZmaGFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4NjI0NTYsImV4cCI6MjA5MjQzODQ1Nn0.dI-GaahBzUveysgyyY--5a5OVS5M64qxbfFTfbuN5qw';
const supabase = createClient(supabaseUrl, supabaseKey);

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
  tarih: string;
}

const TeknikTakipTablosu = ({ isAdmin = false }) => {
  const TAMIR_PERSONELI_LISTESI = ["ABOBAKR KAMAL", "AHMET MERT GÖKÇE", "ANIL AYDIN", "M.OMAR NAWID KAMAL", "MURAT BEKTAŞ", "MEHMET ŞERİF DEMİRKIRAN"];
  const TEST_PERSONELI = ["ALİ ERÇİN", "YUSUF GENCAY", "ESAT AYDIN", "SEMİH AYVA"];

  const [satirlar, setSatirlar] = useState<Satir[]>([]);
  const [aramaImei, setAramaImei] = useState('');
  const [bulunanCihaz, setBulunanCihaz] = useState<Satir | null>(null);
  const [filtrePersonel, setFiltrePersonel] = useState('Tümü');
  const [filtreDurum, setFiltreDurum] = useState('Tümü');

  // MERKEZİ VERİLERİ GETİR
  const verileriGetir = async () => {
    const { data, error } = await supabase
      .from('teknik_takip')
      .select('*')
      .order('id', { ascending: false });
    if (!error && data) setSatirlar(data);
  };

  useEffect(() => {
    verileriGetir();
    // CANLI TAKİP: Bir mağaza kayıt girince senin ekranın anında güncellenir
    const channel = supabase
      .channel('teknik_canli')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'teknik_takip' }, () => verileriGetir())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // İSTATİSTİKLER
  const tamamlananlar = satirlar.filter(s => s.islemTamam).length;
  const basarili = satirlar.filter(s => s.tamirDurumu === 'Evet').length;
  const bekleyen = satirlar.filter(s => !s.islemTamam).length;
  const iadeler = satirlar.filter(s => s.tamirDurumu === 'İade').length;
  const basariOrani = tamamlananlar > 0 ? Math.round((basarili / tamamlananlar) * 100) : 0;

  const filtrelenmisSatirlar = satirlar.filter(s => {
    const pUygun = filtrePersonel === 'Tümü' || s.tamirPersoneli === filtrePersonel;
    const dUygun = filtreDurum === 'Tümü' || (filtreDurum === 'Beklemede' && !s.islemTamam) || (filtreDurum === 'Tamamlandı' && s.islemTamam) || (s.tamirDurumu === filtreDurum);
    return pUygun && dUygun;
  });

  const handleImeiSorgula = () => {
    const cihaz = satirlar.find(s => s.imei === aramaImei);
    if (cihaz) setBulunanCihaz(cihaz);
    else alert("Bu IMEI ile kayıtlı bir cihaz bulunamadı.");
  };

  const yeniGirisKaydet = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const yeni = {
      tamirPersoneli: fd.get('tPers') as string,
      markaModel: fd.get('model') as string,
      imei: fd.get('imei') as string,
      ariza: fd.get('ariza') as string,
      tamirDurumu: 'Beklemede',
      neden: '',
      testYapanGiris: fd.get('test1') as string,
      testYapanCikis: '',
      kaydedildi: true,
      islemTamam: false,
      tarih: new Date().toLocaleString('tr-TR')
    };

    // İyimser Güncelleme: Beklemeden tabloya ekle
    setSatirlar(prev => [yeni as any, ...prev]);
    e.currentTarget.reset();
    await supabase.from('teknik_takip').insert([yeni]);
  };

  const cikisKaydet = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!bulunanCihaz) return;
    const fd = new FormData(e.currentTarget);
    const guncelle = {
      tamirDurumu: fd.get('durum') as string,
      neden: fd.get('not') as string,
      testYapanCikis: fd.get('test2') as string,
      islemTamam: true
    };

    setSatirlar(prev => prev.map(s => s.id === bulunanCihaz.id ? { ...s, ...guncelle } : s));
    setBulunanCihaz(null);
    setAramaImei('');
    await supabase.from('teknik_takip').update(guncelle).eq('id', bulunanCihaz.id);
  };

  const kayitSil = async (id: number) => {
    if (!confirm("Kayıt silinsin mi?")) return;
    setSatirlar(prev => prev.filter(s => s.id !== id));
    await supabase.from('teknik_takip').delete().eq('id', id);
  };

  const getDurumRenk = (durum: string) => {
    if (durum === 'Evet') return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    if (durum === 'Hayır') return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
    if (durum === 'İade') return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
    return 'bg-slate-800 text-slate-400 border-slate-700';
  };

  return (
    <div className={`bg-slate-950 text-slate-200 font-sans selection:bg-blue-500/30 ${!isAdmin ? 'min-h-screen p-4 md:p-8' : 'p-2'}`}>
      
      {isAdmin && (
        <div className="max-w-[1400px] mx-auto mb-10">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-3xl">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Toplam</p>
              <p className="text-3xl font-black text-white mt-1">{satirlar.length}</p>
            </div>
            <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-3xl border-l-4 border-l-emerald-500">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Başarı</p>
              <p className="text-3xl font-black text-emerald-400 mt-1">%{basariOrani}</p>
            </div>
            <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-3xl border-l-4 border-l-amber-500">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Bekleyen</p>
              <p className="text-3xl font-black text-amber-400 mt-1">{bekleyen}</p>
            </div>
            <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-3xl border-l-4 border-l-purple-500">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">İade</p>
              <p className="text-3xl font-black text-purple-400 mt-1">{iadeler}</p>
            </div>
          </div>

          <div className="flex gap-4 bg-slate-900/30 p-4 rounded-2xl border border-slate-800/50 mb-6">
             <select value={filtrePersonel} onChange={(e) => setFiltrePersonel(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs outline-none cursor-pointer">
                <option value="Tümü">Tüm Personeller</option>
                {TAMIR_PERSONELI_LISTESI.map(p => <option key={p} value={p}>{p}</option>)}
             </select>
             <select value={filtreDurum} onChange={(e) => setFiltreDurum(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs outline-none cursor-pointer">
                <option value="Tümü">Tüm Durumlar</option>
                <option value="Beklemede">⏳ Beklemede</option>
                <option value="Tamamlandı">✔️ Tamamlananlar</option>
                <option value="Evet">✅ Sorunsuz</option>
                <option value="Hayır">❌ Sorunlu</option>
                <option value="İade">🔄 İade</option>
             </select>
          </div>
        </div>
      )}

      <div className="max-w-[1400px] mx-auto mb-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6 border-b border-slate-800/80 pb-6">
          <h1 className="text-3xl font-bold text-white flex items-center gap-4 italic">
            <div className="w-2 h-8 bg-blue-600 rounded-full shadow-[0_0_15px_#2563eb]"></div>
            CNET TEKNİK TAKİP
          </h1>
          <div className="flex w-full md:w-auto gap-2 bg-slate-900/50 p-2 rounded-2xl border border-slate-800 shadow-xl focus-within:ring-1 focus-within:ring-blue-500 transition-all">
            <input type="text" placeholder="IMEI Ara..." className="bg-transparent px-4 text-sm w-full md:w-64 text-white font-mono outline-none" value={aramaImei} onChange={(e) => setAramaImei(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleImeiSorgula()} />
            <button onClick={handleImeiSorgula} className="bg-blue-600 hover:bg-blue-500 px-6 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer">SORGULA</button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
          {/* GİRİŞ FORMU */}
          <div className="bg-slate-900/40 border border-slate-800 rounded-[2rem] p-8 shadow-xl">
            <h3 className="text-sm font-black text-blue-400 uppercase tracking-widest mb-6 flex items-center gap-2">
              <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
              GİRİŞ EKSPERTİZİ
            </h3>
            <form onSubmit={yeniGirisKaydet} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <select name="tPers" required className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-slate-200 cursor-pointer">
                <option value="">Personel Seç...</option>
                {TAMIR_PERSONELI_LISTESI.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
              <select name="test1" required className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-slate-200 cursor-pointer">
                <option value="">Testçi Seç...</option>
                {TEST_PERSONELI.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <input name="model" required type="text" placeholder="Marka / Model" className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white" />
              <input name="imei" required type="text" placeholder="IMEI" className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm font-mono text-white" />
              <textarea name="ariza" required placeholder="Arıza Detayı..." className="md:col-span-2 bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm h-20 text-white resize-none"></textarea>
              <button type="submit" className="md:col-span-2 bg-blue-600 hover:bg-blue-500 font-black py-4 rounded-2xl text-xs uppercase tracking-widest transition-all shadow-lg cursor-pointer">KAYDET</button>
            </form>
          </div>

          {/* ÇIKIŞ FORMU */}
          <div className={`border rounded-[2rem] p-8 shadow-xl transition-all duration-500 ${bulunanCihaz ? 'bg-indigo-900/10 border-indigo-500/30 shadow-indigo-500/10' : 'bg-slate-900/20 border-slate-800 opacity-40'}`}>
            <h3 className="text-sm font-black text-indigo-400 uppercase tracking-widest mb-6">ÇIKIŞ KONTROLÜ</h3>
            {bulunanCihaz ? (
              <form onSubmit={cikisKaydet} className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in slide-in-from-right-4">
                <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800 md:col-span-2 flex justify-between items-center">
                  <p className="text-sm font-bold text-white uppercase">{bulunanCihaz.markaModel} <span className="text-slate-500 font-mono text-xs ml-2">[{bulunanCihaz.imei}]</span></p>
                  <button type="button" onClick={() => setBulunanCihaz(null)} className="text-xs text-rose-400 underline cursor-pointer">Vazgeç</button>
                </div>
                <select name="durum" required className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm font-bold text-emerald-400 outline-none cursor-pointer">
                  <option value="Evet">✅ SORUNSUZ</option>
                  <option value="Hayır">❌ SORUNLU</option>
                  <option value="İade">🔄 İADE</option>
                </select>
                <select name="test2" required className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm outline-none text-slate-200 cursor-pointer">
                  <option value="">2. Test Personeli Seç...</option>
                  {TEST_PERSONELI.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                <textarea name="not" placeholder="Yapılan İşlem..." className="md:col-span-2 bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm h-20 text-white outline-none resize-none"></textarea>
                <button type="submit" className="md:col-span-2 bg-indigo-600 hover:bg-indigo-500 font-black py-4 rounded-2xl text-xs uppercase tracking-widest transition-all shadow-lg cursor-pointer">TAMAMLA</button>
              </form>
            ) : (
              <div className="flex items-center justify-center h-[260px] text-slate-600 italic text-sm text-center px-10">Lütfen sorgulama yapın.</div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto bg-slate-900 border border-slate-800 rounded-[2.5rem] overflow-hidden shadow-2xl">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left min-w-[1300px]">
            <thead className="bg-slate-950 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-800">
              <tr>
                <th className="p-6">PERSONEL / TARİH</th>
                <th className="p-6">CİHAZ BİLGİSİ</th>
                <th className="p-6 text-center">İŞLEM DURUMU</th>
                <th className="p-6">TEST SÜRECİ</th>
                {isAdmin && <th className="p-6 text-center">YÖNETİM</th>}
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
                  <td className="p-6 text-center">
                    <span className={`px-4 py-2 rounded-xl text-[10px] font-black border uppercase tracking-widest ${getDurumRenk(satir.tamirDurumu)}`}>
                      {satir.islemTamam ? satir.tamirDurumu : '⏳ BEKLEMEDE'}
                    </span>
                  </td>
                  <td className="p-6 text-[10px] font-bold text-slate-400 uppercase">
                    {satir.testYapanGiris} <span className="mx-2 text-slate-700">➔</span> {satir.testYapanCikis || '---'}
                  </td>
                  {isAdmin && (
                    <td className="p-6 text-center">
                      <button onClick={() => kayitSil(satir.id)} className="p-2.5 bg-rose-500/10 text-rose-500 rounded-xl hover:bg-rose-500 hover:text-white transition-all cursor-pointer shadow-lg">SİL</button>
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
