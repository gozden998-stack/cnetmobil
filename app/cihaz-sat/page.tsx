"use client";
import React, { useState, useEffect } from 'react';

// --- AYARLAR ---
const VATSAP_NUMARASI = "905423423759"; // WhatsApp yönlendirme numarası
const SHEET_ID = process.env.NEXT_PUBLIC_SHEET_ID as string;
const API_KEY = process.env.NEXT_PUBLIC_API_KEY as string;
const TABLO_ISMI = 'Google Sheets ile Kurumsal Alım Sistemi';

export default function CnetmobilMusteriTradeIn() {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [db, setDb] = useState<any[]>([]);
  const [config, setConfig] = useState<any>({});
  
  const [infoModal, setInfoModal] = useState<'how' | 'security' | null>(null);

  const [selectedBrand, setSelectedBrand] = useState('');
  const [selectedModel, setSelectedModel] = useState<any>(null);
  const [selectedCapacity, setSelectedCapacity] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [answers, setAnswers] = useState({ power: null, screen: null, cosmetic: null, battery: null, repair: null });
  const [customerInfo, setCustomerInfo] = useState({ name: '', phone: '' });
  const [estimatedPrice, setEstimatedPrice] = useState(0);

  const baseBrands = ["Apple", "Samsung", "Xiaomi", "Huawei", "Oppo"];

  useEffect(() => {
    const loadData = async () => {
      try {
        const deviceUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(TABLO_ISMI)}!A2:F1000?key=${API_KEY}`;
        const devRes = await fetch(deviceUrl);
        const devData = await devRes.json();
        const configUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Ayarlar!A1:B25?key=${API_KEY}`;
        const confRes = await fetch(configUrl);
        const confData = await confRes.json();
        if (devData.values) {
          setDb(devData.values.map((row: any) => ({
            brand: row[0] || '', name: row[1] || '', cap: row[2] || '',
            base: parseInt(row[3]) || 0, img: row[4]?.trim() || '', minPrice: parseInt(row[5]) || 0
          })));
        }
        if (confData.values) {
          const m: any = {};
          confData.values.forEach((row: any) => m[row[0]] = parseFloat(row[1]) || 0);
          setConfig(m);
        }
        setLoading(false);
      } catch (error) { console.error("Veri yüklenemedi", error); setLoading(false); }
    };
    loadData();
  }, []);

  useEffect(() => {
    if (selectedCapacity && Object.values(answers).every(a => a !== null)) {
      let price = selectedCapacity.base;
      if (answers.power === 'Hayır') price *= (1 - (config.Guc_Yok / 100 || 0.5));
      if (answers.screen === 'Çizik') price *= (1 - (config.Ekran_Cizik / 100 || 0.1));
      if (answers.screen === 'Kırık') price *= (1 - ((selectedBrand === 'Apple' ? config.Ekran_Kirik : config.Ekran_Kirik_Android) / 100 || 0.3));
      if (answers.cosmetic === 'Çizik') price *= (1 - (config.Kasa_Iyi / 100 || 0.05));
      if (answers.cosmetic === 'Kötü') price *= (1 - ((selectedBrand === 'Apple' ? config.Kasa_Kotu : config.Kasa_Kotu_Android) / 100 || 0.15));
      if (answers.battery === 'Servis') price *= (1 - (config.Pil_Dusuk / 100 || 0.05));
      if (answers.repair === 'Evet') price *= (1 - (config.Bilinmeyen_Parca / 100 || 0.15));
      setEstimatedPrice(Math.max(Math.round(price), selectedCapacity.minPrice || 0));
    }
  }, [answers, selectedCapacity, config, selectedBrand]);

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
                  `- Kasa: ${answers.cosmetic}%0A` +
                  `- Pil: ${answers.battery}%0A` +
                  `- Tamir: ${answers.repair}`;
    window.open(`https://wa.me/${VATSAP_NUMARASI}?text=${mesaj}`, '_blank');
  };

  if (loading) return (
    <div className="h-screen flex flex-col items-center justify-center bg-[#F8FAFC]">
      <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
      <p className="text-slate-500 font-bold tracking-widest uppercase text-xs animate-pulse">Sistem Başlatılıyor...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans text-slate-900 overflow-x-hidden selection:bg-blue-100">
      
      {/* Bilgi Modalları */}
      {infoModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
           <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl relative border border-slate-200">
              <button onClick={() => setInfoModal(null)} className="absolute top-6 right-6 text-slate-400 hover:text-slate-900 text-xl font-bold">✕</button>
              {infoModal === 'how' ? (
                <>
                  <h3 className="text-xl font-black mb-6 text-slate-900 uppercase tracking-wide border-b border-slate-100 pb-4">İşlem Adımları</h3>
                  <div className="space-y-5 text-sm text-slate-600 font-medium">
                    <p className="flex gap-3"><span className="text-blue-600 font-black">01.</span> <span><strong>Cihaz Seçimi:</strong> Marka, model ve kapasite bilgilerini sisteme girin.</span></p>
                    <p className="flex gap-3"><span className="text-blue-600 font-black">02.</span> <span><strong>Ekspertiz Formu:</strong> Cihazınızın güncel fiziksel ve donanımsal durumunu işaretleyin.</span></p>
                    <p className="flex gap-3"><span className="text-blue-600 font-black">03.</span> <span><strong>Sistem Değerlemesi:</strong> Algoritmamız güncel piyasa verileriyle reel bir teklif sunsun.</span></p>
                    <p className="flex gap-3"><span className="text-blue-600 font-black">04.</span> <span><strong>Kurumsal Onay:</strong> Talebinizi iletin, cihaz kontrolü sonrası anında ödemenizi alın.</span></p>
                  </div>
                </>
              ) : (
                <>
                  <h3 className="text-xl font-black mb-6 text-slate-900 uppercase tracking-wide border-b border-slate-100 pb-4">Kurumsal Güvenlik Politikası</h3>
                  <div className="space-y-5 text-sm text-slate-600 font-medium">
                    <p className="flex gap-3"><span className="text-blue-600">🛡️</span> <span><strong>KVKK Uyumlu İmha:</strong> Cihazınızdaki tüm kişisel veriler, uluslararası standartlarda ve kalıcı olarak sıfırlanır.</span></p>
                    <p className="flex gap-3"><span className="text-blue-600">⚖️</span> <span><strong>Şeffaf Değerleme:</strong> Tekliflerimiz yapay zeka destekli piyasa analizleriyle şeffaf bir şekilde belirlenir.</span></p>
                    <p className="flex gap-3"><span className="text-blue-600">🏛️</span> <span><strong>Kurumsal Güvence:</strong> 2003'ten bugüne sektördeki tecrübemizle Cnetmobil güvencesi altındasınız.</span></p>
                  </div>
                </>
              )}
              <button onClick={() => setInfoModal(null)} className="w-full mt-8 py-4 bg-slate-900 hover:bg-blue-700 text-white rounded-xl font-black uppercase tracking-widest text-xs transition-colors">Pencereyi Kapat</button>
           </div>
        </div>
      )}

      {/* Header - Kurumsal Sürüm */}
      <nav className="bg-white sticky top-0 z-50 border-b border-slate-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
          {/* Logo */}
          <div onClick={() => setStep(0)} className="flex items-center gap-3 cursor-pointer group">
            <div className="w-10 h-10 bg-slate-900 rounded-lg flex items-center justify-center transition-colors group-hover:bg-blue-700">
              <span className="text-white font-black text-xl">C</span>
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-black tracking-tight text-slate-900 leading-none">CNET<span className="text-blue-600">MOBİL</span></span>
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-0.5">Kurumsal Alım Merkezi</span>
            </div>
          </div>

          <div className="flex items-center gap-4 md:gap-8">
            <div className="hidden lg:flex items-center gap-8 text-[11px] font-black uppercase tracking-widest text-slate-500 mr-4">
              <button onClick={() => setInfoModal('how')} className="hover:text-blue-600 transition-colors">İşleyiş</button>
              <button onClick={() => setInfoModal('security')} className="hover:text-blue-600 transition-colors">Güvenlik Politikası</button>
            </div>
            
            {/* İletişim */}
            <a 
              href={`https://wa.me/${VATSAP_NUMARASI}`} 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-5 py-2.5 rounded-xl transition-all"
            >
               <svg className="w-5 h-5 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
               <div className="flex flex-col hidden sm:flex">
                 <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest leading-none mb-1">Müşteri Hizmetleri</span>
                 <span className="text-sm font-black text-slate-900 leading-none">0542 342 37 59</span>
               </div>
            </a>
          </div>
        </div>
      </nav>

      {/* Kurumsal Hero Section */}
      <div className="bg-[#0B1120] border-b border-slate-800 pt-20 pb-32 px-6">
        <div className="max-w-4xl mx-auto text-center">
          {step === 0 ? (
            <>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-white mb-6 leading-tight tracking-tight">
                Kurumsal Cihaz <br/>
                <span className="text-blue-500">Değerleme & Alım</span> Merkezi
              </h1>
              <p className="text-slate-400 text-base md:text-lg max-w-2xl mx-auto mb-10 font-medium">
                Cnetmobil güvencesiyle şirket veya bireysel cihazlarınızı şeffaf ekspertiz süreciyle değerlendirin, anında nakit çözümlerimizden yararlanın.
              </p>
            </>
          ) : (
            <div className="mb-10">
               <div className="flex justify-between items-center max-w-sm mx-auto mb-5">
                  {[1,2,3,4,5].map((s) => (
                    <div key={s} className={`h-1.5 flex-1 mx-1 rounded-sm transition-all duration-500 ${step >= s ? 'bg-blue-600' : 'bg-slate-800'}`} />
                  ))}
               </div>
               <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.3em]">Değerleme Aşaması {step} / 5</p>
            </div>
          )}
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 -mt-20 pb-20 relative z-10">
        <div className="bg-white rounded-3xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] p-6 md:p-12 border border-slate-200">
          
          {/* STEP 0 - ULTRA KURUMSAL TASARIM */}
          {step === 0 && (
            <div className="flex flex-col items-center animate-in fade-in duration-700">
              
              {/* Kurumsal Sertifika Rozeti */}
              <div className="flex items-center gap-3 px-5 py-2.5 rounded-full border border-slate-200 bg-slate-50 shadow-sm mb-12">
                <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-[0.2em] text-slate-800">Cnetmobil Kurumsal Güvencesi</span>
              </div>

              {/* Kurumsal Kartlar */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full mb-12">
                {[
                  {
                    title: 'Sertifikalı Ekspertiz',
                    desc: 'Algoritmik değerleme altyapımız ile cihazınızın reel piyasa rayiç bedeli saniyeler içinde hesaplanır.',
                    icon: <svg className="w-6 h-6 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  },
                  {
                    title: 'Güvenceli Ödeme',
                    desc: 'Cihaz teslimi ve fiziksel onay sürecinin hemen ardından ödemeniz kurumsal hesabımızdan anında aktarılır.',
                    icon: <svg className="w-6 h-6 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
                  },
                  {
                    title: 'KVKK Uyumlu İmha',
                    desc: 'Cihaz belleğindeki tüm kurumsal ve kişisel veriler, yasal prosedürlere uygun olarak geri dönülemez şekilde silinir.',
                    icon: <svg className="w-6 h-6 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 00-2 2v6a2 2 0 00-2 2zM9 11V7a3 3 0 016 0v4" /></svg>
                  }
                ].map((item, i) => (
                  <div key={i} className="bg-white p-8 rounded-2xl border border-slate-200 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:border-blue-600 transition-colors duration-300 group flex flex-col items-start text-left">
                    <div className="w-12 h-12 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-center mb-6 group-hover:bg-blue-50 transition-colors">
                      {item.icon}
                    </div>
                    <h4 className="font-black text-[15px] text-slate-900 mb-3 uppercase tracking-wider">{item.title}</h4>
                    <p className="text-slate-500 text-[13px] font-medium leading-relaxed">{item.desc}</p>
                  </div>
                ))}
              </div>

              {/* Kurumsal Aksiyon Butonu */}
              <div className="w-full max-w-md mt-4">
                 <button onClick={() => setStep(1)} className="w-full bg-[#0B1120] hover:bg-blue-700 text-white font-black py-5 px-8 rounded-xl shadow-xl transition-all duration-300 flex items-center justify-between group border border-slate-800 hover:border-blue-600">
                    <span className="text-sm sm:text-base tracking-[0.1em] uppercase">Sisteme Giriş & Değerleme</span>
                    <svg className="w-5 h-5 text-slate-400 group-hover:text-white transform group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                 </button>
              </div>
              
              {/* Alt Güven Barı (Finansal/Kurumsal Uyarılar) */}
              <div className="mt-14 flex flex-col sm:flex-row justify-center items-center gap-6 text-[10px] font-bold uppercase tracking-widest text-slate-400 border-t border-slate-100 pt-8 w-full">
                 <span className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-slate-300"></div> Bankacılık Standartlarında Güvenlik</span>
                 <span className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-slate-300"></div> ISO Standartlarında Veri Yönetimi</span>
                 <span className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-slate-300"></div> %100 Müşteri Gizliliği</span>
              </div>
            </div>
          )}

          {/* DİĞER ADIMLAR DA KURUMSAL DİLE UYARLANDI */}
          {step === 1 && (
            <div className="animate-in fade-in slide-in-from-right-8 duration-500">
              <h2 className="text-xl md:text-2xl font-black text-center mb-10 text-slate-900 uppercase tracking-wide">Cihaz Markasını Seçiniz</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
                {baseBrands.map(brand => (
                  <button key={brand} onClick={() => { setSelectedBrand(brand); setStep(2); }} 
                    className="p-8 border border-slate-200 rounded-2xl hover:border-blue-600 hover:shadow-lg transition-all font-black text-lg bg-white flex flex-col items-center gap-4 text-slate-800 uppercase tracking-widest">
                    {brand}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="max-w-4xl mx-auto animate-in fade-in duration-500">
              <button onClick={() => setStep(1)} className="mb-8 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-blue-600 flex items-center gap-2 border border-slate-200 px-4 py-2 rounded-lg bg-slate-50 transition-colors">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg> Markalara Dön
              </button>
              <h2 className="text-2xl font-black mb-8 text-slate-900 uppercase tracking-wide">{selectedBrand} <span className="text-blue-600">Model Seçimi</span></h2>
              <div className="relative mb-8 text-slate-400">
                <svg className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                <input type="text" placeholder="Model ismini buraya yazın..." className="w-full p-5 pl-14 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-600 focus:bg-white transition-all text-sm font-bold text-slate-900" onChange={(e) => setSearchQuery(e.target.value)} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[450px] overflow-y-auto pr-2 custom-scrollbar text-slate-900">
                {Array.from(new Set(db.filter(i => i.brand === selectedBrand).map(i => i.name)))
                  .filter(name => name.toLowerCase().includes(searchQuery.toLowerCase()))
                  .map(name => (
                    <div key={name} onClick={() => { setSelectedModel(name); setStep(3); }} 
                      className="flex items-center gap-5 p-5 border border-slate-200 rounded-xl hover:border-blue-600 hover:shadow-md cursor-pointer transition-all bg-white">
                      <div className="w-16 h-16 bg-slate-50 rounded-lg border border-slate-100 p-2 flex items-center justify-center">
                        <img src={db.find(i => i.name === name)?.img} className="max-h-full object-contain mix-blend-multiply" alt={name} />
                      </div>
                      <span className="font-black text-[13px] uppercase tracking-wide text-slate-800">{name}</span>
                    </div>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="text-center max-w-3xl mx-auto animate-in zoom-in-95 duration-500">
              <h2 className="text-2xl font-black mb-10 text-slate-900 uppercase tracking-wide">Depolama Kapasitesi</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                {db.filter(i => i.name === selectedModel).map(c => (
                  <button key={c.cap} onClick={() => { setSelectedCapacity(c); setStep(4); }} 
                    className="py-8 px-4 border border-slate-200 rounded-2xl hover:border-blue-600 hover:bg-slate-50 transition-all font-black text-xl text-slate-800 shadow-sm uppercase tracking-widest">
                    {c.cap}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="max-w-3xl mx-auto animate-in fade-in duration-500">
              <h2 className="text-2xl font-black mb-8 text-slate-900 text-center uppercase tracking-wide">Fiziksel & Donanımsal Durum</h2>
              <div className="space-y-4">
                {[
                  { id: 'power', question: 'Cihazınız sorunsuz açılıyor mu?', opts: ['Evet', 'Hayır'] },
                  { id: 'screen', question: 'Ekran durumu nasıl?', opts: ['Kusursuz', 'Çizik', 'Kırık'] },
                  { id: 'cosmetic', question: 'Kasa (Yan ve Arka) durumu?', opts: ['Kusursuz', 'Çizik', 'Kötü'] },
                  { id: 'battery', question: 'Pil sağlığı uyarısı var mı?', opts: ['İyi', 'Servis'] },
                  { id: 'repair', question: 'Daha önce tamir gördü mü?', opts: ['Hayır', 'Evet'] },
                ].map(q => (
                  <div key={q.id} className="bg-white p-6 rounded-xl border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
                    <h3 className="font-black text-[13px] text-slate-800 uppercase tracking-wide">{q.question}</h3>
                    <div className="flex gap-2">
                      {q.opts.map(opt => (
                        <button key={opt} onClick={() => setAnswers({...answers, [q.id]: opt})} 
                          className={`px-6 py-2.5 rounded-lg font-black text-[11px] uppercase tracking-widest transition-all border ${
                            (answers as any)[q.id] === opt 
                            ? 'bg-slate-900 border-slate-900 text-white shadow-md' 
                            : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-400'}`}>
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                <div className="pt-8">
                  <button disabled={!Object.values(answers).every(a => a !== null)} onClick={() => setStep(5)} 
                    className="w-full py-5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black text-sm uppercase tracking-[0.2em] shadow-lg disabled:opacity-30 disabled:shadow-none transition-all">
                    Sistem Değerlemesini Gör
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="text-center max-w-2xl mx-auto animate-in zoom-in-95 duration-700">
               <div className="inline-flex items-center justify-center px-6 py-2 border border-emerald-200 bg-emerald-50 text-emerald-700 rounded-full font-black text-[10px] uppercase tracking-[0.2em] mb-8">
                  Değerleme Tamamlandı
               </div>
               
               <div className="mb-10 bg-[#0B1120] rounded-2xl p-10 shadow-2xl relative overflow-hidden text-white border border-slate-800">
                 <p className="text-slate-400 font-bold mb-3 uppercase tracking-[0.3em] text-[10px]">{selectedBrand} {selectedModel}</p>
                 <div className="text-5xl md:text-6xl font-black mb-3 tracking-tighter">{estimatedPrice.toLocaleString()} <span className="text-2xl font-medium opacity-50">TL</span></div>
                 <p className="text-slate-500 text-[10px] uppercase tracking-widest font-bold">* Belirtilen tutar, fiziki ekspertiz sonrası kesinleşecektir.</p>
               </div>

               <div className="text-left bg-white border border-slate-200 rounded-2xl p-8 mb-8 shadow-sm">
                 <h3 className="font-black text-sm mb-6 text-slate-800 uppercase tracking-widest border-b border-slate-100 pb-4">Kurumsal İletişim Formu</h3>
                 <div className="space-y-4">
                   <div>
                     <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 mb-1 block">Adınız Soyadınız</label>
                     <input type="text" value={customerInfo.name} onChange={(e)=>setCustomerInfo({...customerInfo, name: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-600 text-sm font-bold text-slate-900 transition-colors uppercase" placeholder="Zorunlu Alan" />
                   </div>
                   <div>
                     <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 mb-1 block">İletişim Numaranız</label>
                     <input type="tel" value={customerInfo.phone} onChange={(e)=>setCustomerInfo({...customerInfo, phone: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-600 text-sm font-bold text-slate-900 transition-colors" placeholder="05XX XXX XX XX" />
                   </div>
                 </div>
               </div>
               
               <button onClick={submitLead} className="w-full py-5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-black text-xs uppercase tracking-[0.1em] shadow-xl transition-all flex items-center justify-center gap-3 border border-slate-700">
                 Talebi Müşteri Temsilcisine İlet
                 <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
               </button>
               <button onClick={() => setStep(0)} className="mt-8 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-blue-600 transition-colors">Ana Ekrana Dön</button>
            </div>
          )}

        </div>
      </main>

      <footer className="text-center py-10 text-slate-400 text-[10px] font-bold uppercase tracking-widest border-t border-slate-200 bg-white">
        © 2026 Cnetmobil Kurumsal Geri Alım Merkezi - Tüm Hakları Saklıdır.
      </footer>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #f8fafc; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
      `}</style>
    </div>
  );
}
