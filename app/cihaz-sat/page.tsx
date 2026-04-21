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

  // Seçimleri Sıfırlama Fonksiyonu (Geri dönüşlerde temizlik için)
  const resetSelection = () => {
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
                  `*Kapasite:* ${selectedCapacity.cap}%0A` +
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
    <div className="min-h-screen bg-[#F8FAFC] font-sans text-slate-900 overflow-x-hidden">
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

      <nav className="bg-white/80 backdrop-blur-md sticky top-0 z-50 border-b border-slate-100 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
          <div onClick={() => { setStep(0); resetSelection(); }} className="flex items-center cursor-pointer group">
            <img src="/logo.png" alt="Cnetmobil Logo" className="h-14 w-auto object-contain transition-transform group-hover:scale-110" />
          </div>
          <div className="flex items-center gap-4 md:gap-8">
            <div className="hidden lg:flex items-center gap-6 text-sm font-semibold text-slate-500 mr-4">
              <button onClick={() => setInfoModal('how')} className="hover:text-indigo-600 transition-colors">Nasıl Çalışır?</button>
              <button onClick={() => setInfoModal('security')} className="hover:text-indigo-600 transition-colors">Güvenlik</button>
            </div>
            <div className="flex items-center gap-3 bg-white border border-slate-200 px-4 py-2 rounded-2xl shadow-sm">
               <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-indigo-50 rounded-full flex items-center justify-center">
                    <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter leading-none mb-1">Bize Ulaşın</span>
                    <span className="text-sm font-black text-slate-800 leading-none">0542 342 3759</span>
                  </div>
               </div>
               <div className="w-px h-6 bg-slate-200 mx-1"></div>
               <a href="https://wa.me/905423423759" target="_blank" rel="noopener noreferrer" className="hover:scale-110 transition-transform duration-300">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.72.937 3.659 1.432 5.631 1.433h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" fill="#25D366"/></svg>
               </a>
            </div>
          </div>
        </div>
      </nav>

      <div className="bg-gradient-to-b from-slate-900 to-slate-800 pt-16 pb-32 px-6">
        <div className="max-w-4xl mx-auto text-center">
          {step === 0 ? (
            <>
              <h1 className="text-4xl md:text-6xl font-black text-white mb-6 leading-tight">Eski Telefonun <br/><span className="text-indigo-400">Nakit Paraya</span> Dönüşsün.</h1>
              <p className="text-slate-400 text-lg md:text-xl max-w-2xl mx-auto mb-10">Cnetmobil güvencesiyle 5 dakikada fiyat teklifi al, doğru fiyat ile cihazını sat</p>
            </>
          ) : (
            <div className="mb-10">
               <div className="flex justify-between items-center max-w-xs mx-auto mb-4">
                 {[1,2,3,4,5].map((s) => (
                    <div key={s} className={`h-1.5 flex-1 mx-1 rounded-full transition-all duration-500 ${step >= s ? 'bg-indigo-500' : 'bg-slate-700'}`} />
                 ))}
               </div>
               <p className="text-slate-400 text-sm font-medium uppercase tracking-widest">Aşama {step} / 5</p>
            </div>
          )}
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 -mt-24 pb-20 relative z-10">
        <div className="bg-white rounded-[40px] shadow-[0_20px_50px_rgba(0,0,0,0.1)] p-6 md:p-12 border border-slate-100">
          {step === 0 && (
            <div className="flex flex-col items-center animate-in fade-in zoom-in-95 duration-500">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 text-[10px] sm:text-xs font-black uppercase tracking-widest mb-8 shadow-sm">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-600"></span>
                </span>
                ESKİYİ GETİR YENİYİ GÖTÜR
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 w-full mb-12">
                {[
                  { title: 'Hızlı Ekspertiz', desc: 'Formumuzu doldurarak saniyeler içinde cihazınız için en güncel piyasa teklifini alın.', icon: <svg className="w-8 h-8 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>, bg: 'bg-indigo-50/40', border: 'hover:border-indigo-300' },
                  { title: 'Güvenli Ödeme', desc: 'Cihaz kontrolü tamamlandığı an paranız IBAN veya nakit olarak elinizde.', icon: <svg className="w-8 h-8 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>, bg: 'bg-emerald-50/40', border: 'hover:border-emerald-300' },
                  { title: '100% Veri Güvenliği', desc: 'Eski cihazınızdaki tüm kişisel verileriniz geri döndürülemez şekilde sıfırlanır.', icon: <svg className="w-8 h-8 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 00-2 2v6a2 2 0 00-2 2v6a2 2 0 00-2 2v6a2 2 0 00-2 2v6a2 2 0 00-2 2v6a2 2 0 00-2 2zM9 11V7a3 3 0 016 0v4" /></svg>, bg: 'bg-rose-50/40', border: 'hover:border-rose-300' }
                ].map((item, i) => (
                  <div key={i} className={`p-8 rounded-[32px] border-2 border-slate-100 ${item.bg} ${item.border} transition-all duration-300 hover:shadow-xl hover:-translate-y-1 group cursor-default`}>
                    <div className="w-16 h-16 rounded-2xl bg-white shadow-sm flex items-center justify-center mb-6">{item.icon}</div>
                    <h4 className="font-black text-xl text-slate-800 mb-3">{item.title}</h4>
                    <p className="text-slate-500 text-sm font-medium leading-relaxed">{item.desc}</p>
                  </div>
                ))}
              </div>
              <button onClick={() => setStep(1)} className="group bg-slate-900 hover:bg-indigo-600 text-white font-black py-5 px-8 rounded-[24px] shadow-2xl transition-all flex items-center justify-between w-full max-w-sm overflow-hidden">
                <span className="text-lg tracking-wide flex items-center gap-3"><svg className="w-6 h-6 text-indigo-400 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>CİHAZINI DEĞERLE</span>
                <span className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center group-hover:bg-white group-hover:text-indigo-600 transition-colors"><svg className="w-6 h-6 transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg></span>
              </button>
            </div>
          )}

          {step === 1 && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h2 className="text-2xl md:text-3xl font-black text-center mb-10 text-slate-800">Cihazınızın Markası Nedir?</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
                {baseBrands.map(brand => (
                  <button key={brand} onClick={() => { setSelectedBrand(brand); resetSelection(); setStep(2); }} className="p-8 border-2 border-slate-100 rounded-[32px] hover:border-indigo-500 hover:shadow-xl transition-all font-bold text-xl bg-white flex flex-col items-center gap-4 group text-slate-900">
                    <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">📱</div>{brand}
                  </button>
                ))}
              </div>
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
                  <div key={name} onClick={() => { setSelectedModel(name); setSelectedCapacity(null); setStep(3); }} className="group flex items-center gap-5 p-5 border-2 border-slate-100 rounded-2xl hover:border-indigo-500 hover:bg-indigo-50/30 cursor-pointer transition-all">
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
                {/* 16 PRO MAX VE DİĞERLERİNDE ÇİFT GÖZÜKMEMESİ İÇİN UNIQUE FİLTRELEME */}
                {db.filter(i => i.name === selectedModel)
                   .filter((v, i, a) => a.findIndex(t => (t.cap === v.cap)) === i) // Aynı kapasiteyi 1 kez göster
                   .map(c => (
                  <button key={c.cap} onClick={() => { setSelectedCapacity(c); setStep(4); }} className="p-10 border-2 border-slate-100 rounded-[32px] hover:border-indigo-500 hover:bg-indigo-50 transition-all font-black text-3xl text-slate-700">{c.cap}</button>
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
                <div className="w-full lg:w-80 shrink-0 bg-white border-2 border-indigo-50 rounded-[32px] p-6 shadow-xl lg:sticky top-28">
                  <div className="text-center mb-6">
                     <h4 className="text-xs font-black text-indigo-400 uppercase tracking-widest mb-1">Seçilen Cihaz</h4>
                     <div className="w-32 h-32 mx-auto bg-slate-50 rounded-2xl p-4 mb-4 flex items-center justify-center"><img src={db.find(i => i.name === selectedModel)?.img} alt={selectedModel} className="max-h-full object-contain" /></div>
                     <h3 className="font-black text-xl text-slate-800">{selectedBrand} {selectedModel}</h3>
                     <div className="mt-3 inline-block px-4 py-1.5 bg-slate-100 rounded-full text-slate-600 font-bold text-sm">{selectedCapacity?.cap} Hafıza</div>
                  </div>
                  <button onClick={() => setStep(1)} className="w-full mt-6 py-3 border-2 border-slate-100 text-slate-500 hover:text-indigo-600 rounded-xl font-bold transition-all text-sm">Cihazı Değiştir</button>
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
                     {/* Arka plan dekoratif daire */}
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

      <footer className="text-center py-10 text-slate-400 text-sm">© 2026 Cnetmobil Kurumsal Geri Alım Merkezi - Tüm Hakları Saklıdır.</footer>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #f1f1f1; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
      `}</style>
    </div>
  );
}
