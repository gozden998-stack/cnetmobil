"use client";
import React, { useState, useEffect } from 'react';

// --- AYARLAR ---
const VATSAP_NUMARASI = "905423423759"; 
const SHEET_ID = process.env.NEXT_PUBLIC_SHEET_ID as string;
const API_KEY = process.env.NEXT_PUBLIC_API_KEY as string;
const TABLO_ISMI = 'Cihaz Sat'; 

export default function CnetmobilMusteriTradeIn() {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [db, setDb] = useState<any[]>([]);
  const [config, setConfig] = useState<any>({});
  const [estimatedPriceVisible, setEstimatedPriceVisible] = useState(false);
  
  const [infoModal, setInfoModal] = useState<'how' | 'security' | null>(null);

  const [selectedBrand, setSelectedBrand] = useState('');
  const [selectedModel, setSelectedModel] = useState<any>(null);
  const [selectedCapacity, setSelectedCapacity] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // KATEGORİLER
  const [answers, setAnswers] = useState<any>({ power: null, screen: null, cosmetic: null, faceId: null, battery: null });
  
  const [customerInfo, setCustomerInfo] = useState({ name: '', phone: '' });
  const [estimatedPrice, setEstimatedPrice] = useState(0);

  const baseBrands = ["Apple", "Samsung", "Xiaomi", "Huawei", "Oppo"];

  // Seçimleri Sıfırlama Fonksiyonu
  const resetSelection = () => {
    setSelectedBrand('');
    setSelectedModel(null);
    setSelectedCapacity(null);
    setAnswers({ power: null, screen: null, cosmetic: null, faceId: null, battery: null });
    setEstimatedPriceVisible(false);
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/sheets', { cache: 'no-store' });
        const responseData = await res.json();

        const decodedString = decodeURIComponent(escape(window.atob(responseData.payload)));
        const allData = JSON.parse(decodedString);

        if (allData.CustomerDevices) {
          setDb(allData.CustomerDevices.map((row: any) => ({
            brand: row[0] ? String(row[0]).trim() : '', 
            name: row[1] ? String(row[1]).trim() : '', 
            cap: row[2] ? String(row[2]).trim() : '',
            base: parseInt(row[3]) || 0, 
            img: row[4] ? String(row[4]).trim() : '', 
            minPrice: parseInt(row[5]) || 0
          })));
        }

        if (allData.CustomerConfig) {
          const m: any = {};
          allData.CustomerConfig.forEach((row: any) => {
            if(row[0]) m[row[0].trim()] = parseFloat(row[1]) || 0;
          });
          setConfig(m);
        }
        setLoading(false);
      } catch (error) { 
        console.error("Veri yüklenemedi", error); 
        setLoading(false); 
      }
    };
    loadData();
  }, []);

  useEffect(() => {
    if (selectedCapacity && Object.values(answers).every(a => a !== null)) {
      let price = selectedCapacity.base;
      
      if (answers.power === 'Hayır') price *= (1 - (config.Guc_Yok / 100 || 0.5));
      if (answers.screen === 'Çizikler Var') price *= (1 - (config.Ekran_Cizik / 100 || 0.1));
      if (answers.screen === 'Kırık') price *= (1 - (config.Ekran_Kirik / 100 || 0.3));
      if (answers.cosmetic === 'İyi') price *= (1 - (config.Kozmetik_Iyi / 100 || 0.05));
      if (answers.cosmetic === 'Kötü') price *= (1 - (config.Kozmetik_Kotu / 100 || 0.15));
      if (answers.faceId === 'Hayır') price *= (1 - (config.Face_Id_Bozuk / 100 || 0.15));
      if (answers.battery === '90-85') price *= (1 - (config.Pil_90_85 / 100 || 0.05));
      if (answers.battery === '85-0') price *= (1 - (config.Pil_85_0 / 100 || 0.15));
      
      setEstimatedPrice(Math.max(Math.round(price), selectedCapacity.minPrice || 0));
    }
  }, [answers, selectedCapacity, config]);

  const submitLead = () => {
    if(!customerInfo.name || !customerInfo.phone) return alert("Lütfen adınızı ve telefonunuzu girin.");
    const mesaj = `*YENİ SATIŞ TALEBİ - CNETMOBİL*%0A%0A` +
                  `*Müşteri:* ${customerInfo.name}%0A` +
                  `*Telefon:* ${customerInfo.phone}%0A%0A` +
                  `*Cihaz:* ${selectedBrand} ${selectedModel}%0A` +
                  `*Kapasite:* ${selectedCapacity?.cap}%0A` +
                  `*Teklif Edilen Fiyat:* ${estimatedPrice.toLocaleString()} TL%0A%0A` +
                  `*Cihaz Durumu:*%0A` +
                  `- Güç: ${answers.power}%0A` +
                  `- Ekran: ${answers.screen}%0A` +
                  `- Kozmetik: ${answers.cosmetic}%0A` +
                  `- Face/Touch ID: ${answers.faceId}%0A` +
                  `- Batarya: ${answers.battery}`;
    window.open(`https://wa.me/${VATSAP_NUMARASI}?text=${mesaj}`, '_blank');
  };

  if (loading) return (
    <div className="h-screen flex flex-col items-center justify-center bg-white">
      <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4"></div>
      <p className="text-slate-500 font-medium animate-pulse">Cnetmobil Hazırlanıyor...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-white font-sans text-slate-900 overflow-x-hidden">
      
      {/* HEADER (Birebir Tasarım) */}
      <nav className="bg-white sticky top-0 z-50 border-b border-slate-100 shadow-sm">
        <div className="max-w-[1200px] mx-auto px-4 h-20 flex items-center justify-between">
          <div onClick={() => { setStep(0); resetSelection(); }} className="flex items-center cursor-pointer">
            <img src="/logo.png" alt="Cnetmobil Logo" className="h-12 w-auto object-contain" />
          </div>
          
          <div className="hidden lg:flex items-center gap-8 text-[14px] font-semibold text-slate-700">
            <button onClick={() => setInfoModal('how')} className="hover:text-indigo-600 transition-colors">Nasıl Çalışır?</button>
            <button className="hover:text-indigo-600 transition-colors">Neden Cnetmobil?</button>
            <button onClick={() => setInfoModal('security')} className="hover:text-indigo-600 transition-colors">Güvenlik</button>
            <button className="hover:text-indigo-600 transition-colors">SSS</button>
            <button className="hover:text-indigo-600 transition-colors">İletişim</button>
          </div>

          <div className="flex items-center gap-6">
            <a href={`https://wa.me/${VATSAP_NUMARASI}`} target="_blank" rel="noopener noreferrer" className="hidden md:flex items-center gap-2 text-slate-800 font-bold hover:text-[#25D366] transition-colors">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884" fill="#25D366"/></svg>
              0542 342 3759
            </a>
            <button onClick={() => setStep(1)} className="bg-[#4f46e5] hover:bg-[#4338ca] text-white px-6 py-2.5 rounded-lg font-semibold transition-colors shadow-lg shadow-indigo-200">
              Telefonunu Sat
            </button>
          </div>
        </div>
      </nav>

      {/* AÇILIŞ SAYFASI (LANDING PAGE - Görseldeki Yapı) */}
      {step === 0 && (
        <main className="animate-in fade-in duration-500 bg-[#fbfbfe]">
          
          <div className="max-w-[1200px] mx-auto px-4 pt-16 pb-12 relative">
            <div className="flex flex-col lg:flex-row items-center justify-between gap-12">
              
              {/* Sol Taraf Metinler */}
              <div className="flex-1 z-10">
                <h1 className="text-5xl lg:text-[64px] font-extrabold text-slate-800 leading-[1.1] mb-6">
                  Eski Telefonun <br/>
                  <span className="text-[#4f46e5]">Nakit Paraya</span> <br/>
                  Dönüşsün.
                </h1>
                <p className="text-slate-600 text-lg max-w-md mb-8 leading-relaxed font-medium">
                  5 dakikada ücretsiz teklif al, cihazını güvenle sat, nakit paran anında hesabında olsun.
                </p>
                
                <div className="flex items-center gap-6 mb-10 text-sm font-bold text-slate-700">
                  <span className="flex items-center gap-2"><svg className="w-4 h-4 text-[#4f46e5]" fill="currentColor" viewBox="0 0 24 24"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg> 5 Dakikada Teklif</span>
                  <span className="flex items-center gap-2"><svg className="w-4 h-4 text-[#4f46e5]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg> Güvenli Ödeme</span>
                  <span className="flex items-center gap-2"><svg className="w-4 h-4 text-[#4f46e5]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 00-2 2v6a2 2 0 00-2 2v6a2 2 0 00-2 2v6a2 2 0 00-2 2v6a2 2 0 00-2 2v6a2 2 0 00-2 2v6a2 2 0 00-2 2zM9 11V7a3 3 0 016 0v4"/></svg> %100 Veri Güvenliği</span>
                </div>

                <div className="flex items-center gap-4">
                  <button onClick={() => setStep(1)} className="bg-[#4f46e5] hover:bg-[#4338ca] text-white font-semibold py-4 px-8 rounded-xl shadow-xl shadow-indigo-200 transition-all flex items-center gap-3">
                    Telefonunu Değerle <span className="text-xl leading-none">→</span>
                  </button>
                  <button onClick={() => setInfoModal('how')} className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-semibold py-4 px-6 rounded-xl transition-all flex items-center gap-2 shadow-sm">
                    <div className="w-5 h-5 rounded-full border border-slate-700 flex items-center justify-center pl-0.5 text-[10px]">▶</div> Nasıl Çalışır?
                  </button>
                </div>
              </div>

              {/* Sağ Taraf - Görseller (Koyu Temalı Telefon Görseli İçin) */}
              <div className="flex-1 relative w-full h-[450px] hidden lg:block">
                <div className="absolute top-10 right-0 w-[450px] h-[450px] bg-indigo-500/20 rounded-full blur-3xl -z-10"></div>
                <div className="w-full h-full rounded-[40px] shadow-2xl relative overflow-hidden border-4 border-white/50 bg-[#0f0a1c]">
                   <img src="/phones-mockup.png" alt="Telefonlar" className="w-full h-full object-cover scale-105" />
                   
                   <div className="absolute bottom-8 left-8 bg-white/90 backdrop-blur-md px-5 py-3 rounded-2xl shadow-xl flex items-center gap-3 animate-bounce">
                     <svg className="w-6 h-6 text-[#4f46e5]" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" /></svg>
                     <span className="font-black text-slate-800">Ücretsiz Kargo</span>
                   </div>
                </div>
              </div>

            </div> {/* Bu flex-col kapsayıcısını kapatan </div> buydu, yüksek ihtimalle bu silindiği için hata aldın! */}

            {/* YATAY FORM MODÜLÜ */}
            <div className="mt-16 bg-white rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 flex flex-col xl:flex-row items-center gap-6 relative z-30">
              
              <div className="flex items-center gap-4 min-w-max">
                <div className="w-14 h-14 bg-[#4f46e5] text-white rounded-2xl flex items-center justify-center shadow-lg">📱</div>
                <div>
                  <h3 className="font-bold text-slate-800 text-lg">Fiyatını Hemen Öğren</h3>
                  <p className="text-slate-500 text-sm leading-snug">Cihaz bilgilerini seç,<br/>anında fiyat teklifini al.</p>
                </div>
              </div>
              
              <div className="h-16 w-px bg-slate-100 hidden xl:block"></div>

              <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4 w-full">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-600">Marka</label>
                  <select 
                    value={selectedBrand} 
                    onChange={(e) => { setSelectedBrand(e.target.value); setSelectedModel(null); setSelectedCapacity(null); }}
                    className="p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-medium text-slate-700"
                  >
                    <option value="">Seçiniz</option>
                    {baseBrands.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-600">Model</label>
                  <select 
                    value={selectedModel || ''}
                    onChange={(e) => { setSelectedModel(e.target.value); setSelectedCapacity(null); }}
                    disabled={!selectedBrand}
                    className="p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-medium text-slate-700 disabled:opacity-50"
                  >
                    <option value="">Seçiniz</option>
                    {selectedBrand && Array.from(new Set(db.filter(i => i.brand.toLowerCase() === selectedBrand.toLowerCase()).map(i => i.name))).map((m: any) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-600">Hafıza</label>
                  <select 
                    value={selectedCapacity?.cap || ''}
                    onChange={(e) => { 
                      const cap = db.find(i => i.name === selectedModel && i.cap === e.target.value);
                      setSelectedCapacity(cap); 
                    }}
                    disabled={!selectedModel}
                    className="p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-medium text-slate-700 disabled:opacity-50"
                  >
                    <option value="">Seçiniz</option>
                    {selectedModel && db.filter(i => i.name === selectedModel)
                      .filter((v, i, a) => a.findIndex(t => (t.cap === v.cap)) === i)
                      .map(c => <option key={c.cap} value={c.cap}>{c.cap}</option>)}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-600">Cihazın Durumu</label>
                  <select 
                    disabled={!selectedCapacity}
                    className="p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-medium text-slate-700 disabled:opacity-50"
                  >
                    <option>Soruları Yanıtla</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1 min-w-max">
                <button 
                  onClick={() => {
                    if(selectedCapacity) { setStep(4); } // Direkt 4. adıma (sorulara) atla
                    else { setStep(1); } // Boşsa 1. adımdan başlat
                  }}
                  className="bg-[#1e1b4b] hover:bg-[#312e81] text-white font-semibold py-3.5 px-6 rounded-xl transition-colors"
                >
                  Fiyatımı Öğren
                </button>
                <span className="text-[11px] text-center font-medium text-slate-500">Ücretsiz Teklif Al</span>
              </div>
            </div>

            {/* AVANTAJ KARTLARI (Grid) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-16">
              {[
                { title: 'Hızlı ve Kolay', desc: 'Sadece 5 dakikada teklifini al, zaman kaybetme.', icon: '⚡', color: 'text-purple-500', bg: 'bg-purple-50' },
                { title: 'Güvenli Ödeme', desc: 'Ödemeniz anında hesabınıza geçer, güvenle satarsınız.', icon: '🛡️', color: 'text-emerald-500', bg: 'bg-emerald-50' },
                { title: 'Ücretsiz Kargo', desc: 'Kargo ücretini biz karşılıyoruz, sen sadece gönder.', icon: '🚚', color: 'text-blue-500', bg: 'bg-blue-50' },
                { title: '%100 Veri Güvenliği', desc: 'Tüm kişisel verileriniz güvenle korunur.', icon: '🔒', color: 'text-rose-500', bg: 'bg-rose-50' }
              ].map((item, i) => (
                <div key={i} className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm text-center flex flex-col items-center hover:shadow-md transition-shadow">
                  <div className={`w-14 h-14 rounded-2xl ${item.bg} ${item.color} flex items-center justify-center text-2xl mb-4`}>{item.icon}</div>
                  <h4 className="font-bold text-slate-800 text-[17px] mb-2">{item.title}</h4>
                  <p className="text-slate-500 text-sm leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>

            {/* 4 ADIMDA STEPPER */}
            <div className="mt-24 text-center">
              <h2 className="text-3xl font-bold text-slate-800 mb-16">4 Adımda Telefonunu Sat</h2>
              
              <div className="relative flex flex-col md:flex-row justify-between items-start max-w-4xl mx-auto gap-8">
                {/* Kesik Çizgi */}
                <div className="hidden md:block absolute top-6 left-[10%] right-[10%] h-[2px] border-t-2 border-dashed border-slate-200 -z-10"></div>
                
                {[
                  { num: 1, title: 'Bilgileri Gir', desc: 'Cihaz bilgilerini seç ve teklifini anında al.', icon: '📱' },
                  { num: 2, title: 'Teklifini Onayla', desc: 'Teklifi onayla ve ücretsiz kargo kodunu al.', icon: '💬' },
                  { num: 3, title: 'Cihazını Gönder', desc: 'Cihazını güvenle paketle ve kargoya teslim et.', icon: '📦' },
                  { num: 4, title: 'Paranı Al', desc: 'Cihazın bize ulaştıktan sonra ödemen anında hesabında!', icon: '💳' }
                ].map(s => (
                  <div key={s.num} className="flex-1 flex flex-col items-center bg-white relative z-10 px-4">
                    <div className="w-12 h-12 bg-[#4f46e5] text-white rounded-full flex items-center justify-center font-bold text-lg mb-4 shadow-lg border-4 border-white">{s.num}</div>
                    <div className="text-2xl mb-3">{s.icon}</div>
                    <h4 className="font-bold text-slate-800 mb-2 whitespace-nowrap">{s.title}</h4>
                    <p className="text-slate-500 text-xs leading-relaxed max-w-[150px]">{s.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* ALT GÜVEN ROZETLERİ */}
            <div className="mt-24 py-8 border-t border-b border-slate-200 flex flex-wrap justify-between items-center gap-6 px-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl opacity-70">🔒</span>
                <div>
                  <div className="font-bold text-sm text-slate-700">256 Bit SSL</div>
                  <div className="text-xs text-slate-400">Güvenli Bağlantı</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-2xl opacity-70">☑️</span>
                <div>
                  <div className="font-bold text-sm text-slate-700">KVKK Uyumlu</div>
                  <div className="text-xs text-slate-400">Verileriniz Koruma Altında</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-2xl opacity-70">💠</span>
                <div>
                  <div className="font-bold text-sm text-slate-700">TSE Hizmet Yeri</div>
                  <div className="text-xs text-slate-400">Standartlara Uygun Hizmet</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-2xl opacity-70">🚚</span>
                <div>
                  <div className="font-bold text-sm text-slate-700">Ücretsiz Kargo</div>
                  <div className="text-xs text-slate-400">Tüm Türkiye'ye</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-2xl opacity-70">😊</span>
                <div>
                  <div className="font-bold text-sm text-slate-700">2003'ten Beri</div>
                  <div className="text-xs text-slate-400">Güvenilir Hizmet</div>
                </div>
              </div>
            </div>

          </div>
        </main>
      )}

      {/* --- İÇ SAYFALAR (WIZARD: MARKA, MODEL, KAPASİTE, DURUM HESAPLAMALARI) --- */}
      {step > 0 && (
        <div className="bg-[#f8fafc] min-h-screen pt-12 pb-32 px-4">
          <div className="max-w-4xl mx-auto text-center mb-10">
             <div className="flex justify-between items-center max-w-xs mx-auto mb-4">
                {[1,2,3,4,5].map((s) => (
                   <div key={s} className={`h-1.5 flex-1 mx-1 rounded-full transition-all duration-500 ${step >= s ? 'bg-[#4f46e5]' : 'bg-slate-200'}`} />
                ))}
             </div>
             <p className="text-slate-400 text-sm font-medium uppercase tracking-widest">Aşama {step} / 5</p>
          </div>

          <main className="max-w-5xl mx-auto relative z-10">
            <div className="bg-white rounded-[40px] shadow-xl p-6 md:p-12 border border-slate-100">
              
              {step === 1 && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <h2 className="text-2xl md:text-3xl font-black text-center mb-10 text-slate-800">Cihazınızın Markası Nedir?</h2>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
                    {baseBrands.map(brand => (
                      <button key={brand} onClick={() => { setSelectedBrand(brand); resetSelection(); setSelectedBrand(brand); setStep(2); }} className="p-8 border-2 border-slate-100 rounded-[32px] hover:border-indigo-500 hover:shadow-xl transition-all font-bold text-xl bg-white flex flex-col items-center gap-4 group text-slate-900">
                        <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">📱</div>{brand}
                      </button>
                    ))}
                  </div>
                  <button onClick={() => setStep(0)} className="mt-8 mx-auto flex text-slate-400 hover:text-indigo-600 font-semibold transition-colors">Ana Sayfaya Dön</button>
                </div>
              )}

              {step === 2 && (
                <div className="max-w-4xl mx-auto animate-in fade-in duration-500">
                  <button onClick={() => setStep(1)} className="mb-6 text-slate-400 hover:text-indigo-600 flex items-center gap-2 font-semibold transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7"/></svg> Geri Dön
                  </button>
                  <h2 className="text-3xl font-black mb-8 text-slate-800">{selectedBrand} <span className="text-indigo-600">Hangi Model?</span></h2>
                  <div className="relative mb-8"><span className="absolute left-4 top-1/2 -translate-y-1/2">🔍</span><input type="text" placeholder="Model ismini buraya yazın..." className="w-full p-5 pl-12 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-indigo-500 transition-all text-slate-900" onChange={(e) => setSearchQuery(e.target.value)} /></div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[450px] overflow-y-auto pr-2 custom-scrollbar">
                    {Array.from(new Set(db.filter(i => i.brand.toLowerCase() === selectedBrand.toLowerCase()).map(i => i.name))).filter((name: any) => name.toLowerCase().includes(searchQuery.toLowerCase())).map((name: any) => (
                      <div key={name} onClick={() => { 
                          setSelectedModel(name); 
                          setSelectedCapacity(null); 
                          setAnswers({ power: null, screen: null, cosmetic: null, faceId: null, battery: null });
                          setStep(3); 
                        }} className="group flex items-center gap-5 p-5 border-2 border-slate-100 rounded-2xl hover:border-indigo-500 hover:bg-indigo-50/30 cursor-pointer transition-all">
                        <div className="w-20 h-20 bg-white rounded-xl shadow-sm p-2 flex items-center justify-center"><img src={db.find(i => i.name === name)?.img} className="max-h-full object-contain group-hover:scale-110 transition-transform" alt={name} /></div>
                        <span className="font-bold text-lg text-slate-700">{name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="text-center max-w-3xl mx-auto animate-in zoom-in-95 duration-500">
                   <button onClick={() => setStep(2)} className="mb-6 text-slate-400 hover:text-indigo-600 flex items-center gap-2 font-semibold transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7"/></svg> Geri Dön
                  </button>
                  <h2 className="text-3xl font-black mb-10 text-slate-800">Depolama Kapasitesi?</h2>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                    {db.filter(i => i.name === selectedModel)
                       .filter((v, i, a) => a.findIndex(t => (t.cap === v.cap)) === i)
                       .map(c => (
                      <button key={c.cap} onClick={() => { 
                          setSelectedCapacity(c); 
                          setAnswers({ power: null, screen: null, cosmetic: null, faceId: null, battery: null });
                          setStep(4); 
                        }} className="p-10 border-2 border-slate-100 rounded-[32px] hover:border-indigo-500 hover:bg-indigo-50 transition-all font-black text-3xl text-slate-700">{c.cap}</button>
                    ))}
                  </div>
                </div>
              )}

              {step === 4 && (
                <div className="max-w-5xl mx-auto animate-in fade-in duration-500">
                   <button onClick={() => setStep(3)} className="mb-6 text-slate-400 hover:text-indigo-600 flex items-center gap-2 font-semibold transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7"/></svg> Geri Dön
                  </button>
                  <h2 className="text-3xl font-black mb-8 text-slate-800 text-center">Cihaz Kondisyonu</h2>
                  <div className="flex flex-col lg:flex-row gap-8 items-start">
                    <div className="flex-1 space-y-6 w-full">
                      {[
                        { id: 'power', question: 'Cihaz Açılıyor mu?', opts: ['Evet', 'Hayır'] },
                        { id: 'screen', question: 'Ekran Durumu', opts: ['Sağlam', 'Çizikler Var', 'Kırık'] },
                        { id: 'cosmetic', question: 'Kozmetik Durumu', opts: ['Mükemmel', 'İyi', 'Kötü'] },
                        { id: 'faceId', question: 'Face ID / Touch ID Çalışıyor mu?', opts: ['Evet', 'Hayır'] },
                        { id: 'battery', question: 'Batarya Sağlığı', opts: ['100-90', '90-85', '85-0'] },
                      ].map(q => (
                        <div key={q.id} className="bg-slate-50/50 p-6 rounded-[24px] border border-slate-100 flex flex-col gap-4 shadow-sm">
                          <h3 className="font-bold text-slate-700 text-lg">{q.question}</h3>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {q.opts.map(opt => (
                              <button key={opt} onClick={() => setAnswers({...answers, [q.id]: opt})} className={`px-4 py-3.5 rounded-xl font-semibold text-[13px] transition-all border-2 ${answers[q.id] === opt ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300'}`}>{opt}</button>
                            ))}
                          </div>
                        </div>
                      ))}
                      <button disabled={!Object.values(answers).every(a => a !== null)} onClick={() => setStep(5)} className="w-full py-6 bg-emerald-500 hover:bg-emerald-600 text-white rounded-[24px] font-black text-xl shadow-xl disabled:opacity-30 transition-all mt-4">Sonucu Göster</button>
                    </div>
                    
                    {/* Sağ Taraf Özet Kartı */}
                    <div className="w-full lg:w-80 shrink-0 bg-white border-2 border-indigo-50 rounded-[32px] p-6 shadow-xl lg:sticky top-28">
                      <div className="text-center mb-6">
                         <h4 className="text-xs font-black text-indigo-400 uppercase tracking-widest mb-1">Seçilen Cihaz</h4>
                         <div className="w-32 h-32 mx-auto bg-slate-50 rounded-2xl p-4 mb-4 flex items-center justify-center"><img src={db.find(i => i.name === selectedModel)?.img} alt={selectedModel} className="max-h-full object-contain" /></div>
                         <h3 className="font-black text-xl text-slate-800">{selectedBrand} {selectedModel}</h3>
                         <div className="mt-3 inline-block px-4 py-1.5 bg-slate-100 rounded-full text-slate-600 font-bold text-sm">{selectedCapacity?.cap} Hafıza</div>
                      </div>
                      <button onClick={() => { 
                          setStep(1); 
                          resetSelection(); 
                        }} className="w-full mt-6 py-3 border-2 border-slate-100 text-slate-500 hover:text-indigo-600 rounded-xl font-bold transition-all text-sm">Cihazı Değiştir</button>
                    </div>
                  </div>
                </div>
              )}

              {step === 5 && (
                <div className="text-center max-w-2xl mx-auto animate-in zoom-in-95 duration-700">
                  {!estimatedPriceVisible ? (
                    <div className="bg-white border-2 border-slate-100 rounded-[32px] p-8 shadow-xl">
                       <button onClick={() => setStep(4)} className="mb-6 text-slate-400 hover:text-indigo-600 flex items-center gap-2 font-semibold transition-colors mx-auto">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7"/></svg> Kondisyonu Düzenle
                      </button>
                      <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-2xl mx-auto mb-4">💰</div>
                      <h3 className="font-black text-2xl mb-2 text-slate-800">Fiyat Teklifini Gör</h3>
                      <p className="text-slate-500 mb-6 text-sm">Cihazınız için hazırlanan özel teklifi görmek için bilgilerinizi doğrulayın.</p>
                      <div className="space-y-4 text-left">
                        <input type="text" value={customerInfo.name} onChange={(e) => setCustomerInfo({ ...customerInfo, name: e.target.value })} className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-indigo-500 text-slate-900" placeholder="Adınız Soyadınız" />
                        <input type="tel" value={customerInfo.phone} onChange={(e) => setCustomerInfo({ ...customerInfo, phone: e.target.value })} className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-indigo-500 text-slate-900" placeholder="Telefon Numaranız" />
                        <p className="text-[10px] text-slate-400 text-center px-4 leading-relaxed">* "Fiyatı Gör" butonuna basarak iletişim bilgilerinizin fiyat teklifi sunulması amacıyla işlenmesini kabul etmiş olursunuz.</p>
                        <button onClick={async () => {
                            if (customerInfo.name.length < 3 || customerInfo.phone.length < 10) return alert("Lütfen bilgileri tam girin.");
                            fetch('/api/leads', { method: 'POST', body: JSON.stringify({ name: customerInfo.name, phone: customerInfo.phone, brand: selectedBrand, model: selectedModel, cap: selectedCapacity.cap, price: estimatedPrice }) });
                            setEstimatedPriceVisible(true);
                          }} className="w-full py-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-xl shadow-lg transition-all">HESAPLA VE FİYATI GÖR</button>
                      </div>
                    </div>
                  ) : (
                    <div className="animate-in fade-in zoom-in-95 duration-500">
                      <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-4xl mx-auto mb-6">✓</div>
                      <h2 className="text-2xl font-bold text-slate-500 mb-2">Hazır! İşte Tahmini Değer:</h2>
                      <div className="mb-10 bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-[40px] p-12 shadow-2xl text-white relative overflow-hidden">
                        <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
                        <p className="text-indigo-200 font-bold mb-2 uppercase tracking-widest text-sm">{selectedBrand} {selectedModel}</p>
                        <div className="text-7xl font-black mb-2">{estimatedPrice.toLocaleString()} <span className="text-2xl font-light opacity-70">TL</span></div>
                        <p className="text-indigo-100/60 text-xs italic">*Fiyat nihai kontrolden sonra kesinleşecektir.</p>
                      </div>
                      <button onClick={submitLead} className="w-full py-6 bg-[#25D366] hover:bg-[#1ebd5b] text-white rounded-[24px] font-black text-xl shadow-xl flex items-center justify-center gap-3 transition-transform active:scale-95"><span className="text-2xl">💬</span> WhatsApp'tan Satışı Onayla</button>
                      <button onClick={() => { setStep(0); resetSelection(); }} className="mt-6 text-slate-400 font-semibold hover:text-indigo-600 transition-colors">Yeniden Hesapla</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </main>
        </div>
      )}

      {/* FOOTER */}
      <footer className="text-center py-8 text-slate-400 text-sm bg-white border-t border-slate-100">
        © 2026 Cnetmobil Kurumsal Geri Alım Merkezi - Tüm Hakları Saklıdır.
      </footer>

      {/* MODALLAR (Nasıl Çalışır, Güvenlik) */}
      {infoModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
           <div className="bg-white rounded-[32px] p-8 max-w-md w-full shadow-2xl relative">
              <button onClick={() => setInfoModal(null)} className="absolute top-6 right-6 text-slate-400 hover:text-slate-900 text-xl font-bold">✕</button>
              {infoModal === 'how' ? (
                <>
                  <h3 className="text-2xl font-black mb-4 text-indigo-600 text-center">Nasıl Çalışır?</h3>
                  <div className="space-y-4 text-slate-600">
                    <p><strong>1. Cihazını Seç:</strong> Marka, model ve kapasite bilgilerini girin.</p>
                    <p><strong>2. Durumunu Belirt:</strong> Cihazınızın kozmetik ve teknik durumunu işaretleyin.</p>
                    <p><strong>3. Teklif Al:</strong> Algoritmamız size en doğru piyasa değerini saniyeler içinde sunsun.</p>
                    <p><strong>4. Satışı Onayla:</strong> Talebinizi gönderin, uzman ekibimiz cihazınızı kontrol edip ödemenizi yapsın.</p>
                  </div>
                </>
              ) : (
                <>
                  <h3 className="text-2xl font-black mb-4 text-emerald-600 text-center">Güvenlik Politikamız</h3>
                  <div className="space-y-4 text-slate-600">
                    <p><strong>Veri Sıfırlama:</strong> Cihazınızdaki tüm kişisel veriler profesyonel standartlarda kalıcı olarak silinir.</p>
                    <p><strong>Şeffaf Fiyatlandırma:</strong> Size verilen teklif, güncel piyasa koşullarına göre hesaplanan en adil tutardır.</p>
                    <p><strong>Kurumsal Güvence:</strong> 2003'ten beri binlerce mutlu müşteriyle Cnetmobil güvencesindesiniz.</p>
                  </div>
                </>
              )}
              <button onClick={() => setInfoModal(null)} className="w-full mt-8 py-4 bg-slate-900 text-white rounded-2xl font-bold">Anladım</button>
           </div>
        </div>
      )}

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #f1f1f1; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
      `}</style>
    </div>
  );
}
