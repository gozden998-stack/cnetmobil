"use client";
import React, { useState, useEffect } from 'react';

// Google Sheets Bilgileriniz
const SHEET_ID = '1GvagcuTfR_e66A1yxTPqaIgh4YEmYl4M7-E2oRzZhyg';
const API_KEY = 'AIzaSyD4zJB-fvZdAR5WucfwITuqpIuHgbpK2gc';
const TABLO_ISMI = 'Google Sheets ile Kurumsal Alım Sistemi';

export default function CnetmobilMusteriTradeIn() {
  const [step, setStep] = useState(0); // 0 = Yeni Karşılama Ekranı
  const [loading, setLoading] = useState(true);
  
  // Veritabanı State'leri
  const [db, setDb] = useState<any[]>([]);
  const [config, setConfig] = useState<any>({});
  
  // Müşteri Seçimleri
  const [selectedBrand, setSelectedBrand] = useState('');
  const [selectedModel, setSelectedModel] = useState<any>(null);
  const [selectedCapacity, setSelectedCapacity] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Müşteriye Sorulacak Sorular
  const [answers, setAnswers] = useState({
    power: null,
    screen: null,
    cosmetic: null,
    battery: null,
    repair: null
  });

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
      if (answers.screen === 'Çizik') price *= (1 - (config.Ekran_Cizik / 100 || 0.1));
      if (answers.screen === 'Kırık') price *= (1 - ((selectedBrand === 'Apple' ? config.Ekran_Kirik : config.Ekran_Kirik_Android) / 100 || 0.3));
      if (answers.cosmetic === 'Çizik') price *= (1 - (config.Kasa_Iyi / 100 || 0.05));
      if (answers.cosmetic === 'Kötü') price *= (1 - ((selectedBrand === 'Apple' ? config.Kasa_Kotu : config.Kasa_Kotu_Android) / 100 || 0.15));
      if (answers.battery === 'Servis') price *= (1 - (config.Pil_Dusuk / 100 || 0.05));
      if (answers.repair === 'Evet') price *= (1 - (config.Bilinmeyen_Parca / 100 || 0.15));

      let finalPrice = Math.max(Math.round(price), selectedCapacity.minPrice || 0);
      setEstimatedPrice(finalPrice);
    }
  }, [answers, selectedCapacity, config, selectedBrand]);

  const handleNextStep = () => {
    if(typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
    setStep(step + 1);
  };

  const submitLead = () => {
    if(!customerInfo.name || !customerInfo.phone) return alert("Lütfen adınızı ve telefon numaranızı girin.");
    alert(`Teşekkürler ${customerInfo.name}! Talebiniz alındı. Müşteri temsilcimiz sizi en kısa sürede ${customerInfo.phone} numarasından arayacaktır.`);
    setStep(0); // Başa, açılış ekranına dön
    setCustomerInfo({name: '', phone: ''});
    setSelectedCapacity(null);
    setSelectedModel(null);
    setAnswers({ power: null, screen: null, cosmetic: null, battery: null, repair: null });
  };

  if (loading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-slate-50">
        <div className="w-12 h-12 border-4 border-[#5a5af9] border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-slate-500 font-medium animate-pulse">Sistem Yükleniyor...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4F6F8] font-sans selection:bg-[#5a5af9]/20 text-slate-900 pb-20">
      
      {/* ÜST MAVİ ALAN (Görseldeki BuyBack Nedir? kısmı) */}
      <div className="bg-[#5a5af9] pt-12 pb-32 px-6">
        <div className="max-w-6xl mx-auto">
          {/* Logo / Header Alanı */}
          <div className="flex items-center justify-between mb-16">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => setStep(0)}>
              <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-lg">
                <svg className="w-6 h-6 text-[#5a5af9]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
              </div>
              <h1 className="text-2xl font-black tracking-tighter text-white">CNET<span className="text-blue-200">MOBİL</span></h1>
            </div>
          </div>

          <h2 className="text-white text-3xl md:text-5xl font-black tracking-tight">BuyBack Nedir?</h2>
        </div>
      </div>

      {/* ANA İÇERİK KARTI (Görseldeki beyaz overlapping alan) */}
      <main className="max-w-6xl mx-auto px-4 -mt-20 relative z-10">
        <div className="bg-white rounded-[32px] shadow-2xl p-8 md:p-14 border border-slate-100 min-h-[450px]">
          
          {/* ADIM 0: AÇILIŞ EKRANI (Görseldeki Tasarım) */}
          {step === 0 && (
            <div className="flex flex-col lg:flex-row items-center justify-between gap-12 animate-in fade-in duration-700">
              <div className="flex-1">
                <h3 className="text-3xl md:text-[42px] font-black text-slate-900 mb-6 leading-[1.1] tracking-tight">
                  Kullandığın Cep Telefonu eskidiyse<br/>
                  Eskiyi Getir,<br/>
                  Yeniyi Götür!
                </h3>
                <p className="text-slate-500 text-lg leading-relaxed mb-2 max-w-2xl font-medium">
                  En iyi fiyatlarla cihazını satmak istiyorsan 2003'ten bu yana güvenin adresi olan Cnetmobil'e gel, marka ve model seçimini yaptıktan sonra cihazının kapasitesini, kozmetik ve donanımsal durumunu en doğru şekilde cevapla, cihazını anında değere dönüştürelim.
                </p>
              </div>
              <div className="shrink-0 w-full lg:w-auto flex justify-center">
                <button 
                  onClick={() => setStep(1)} 
                  className="w-full lg:w-auto bg-[#2ecc71] hover:bg-[#27ae60] text-white font-bold py-5 px-12 rounded-full shadow-lg shadow-green-500/30 transition-all active:scale-95 text-lg md:text-xl tracking-wide"
                >
                  Cihazını Hemen Sat
                </button>
              </div>
            </div>
          )}

          {/* İLERLEME ÇUBUĞU (Adım 1 ve sonrası için) */}
          {step > 0 && (
            <div className="mb-10 animate-in fade-in duration-500">
              <div className="flex items-center justify-between relative max-w-3xl mx-auto">
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1.5 bg-slate-100 rounded-full -z-10"></div>
                <div className="absolute left-0 top-1/2 -translate-y-1/2 h-1.5 bg-[#5a5af9] rounded-full -z-10 transition-all duration-500" style={{ width: `${((step - 1) / 4) * 100}%` }}></div>
                
                {[1, 2, 3, 4, 5].map((s) => (
                  <div key={s} className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300 shadow-sm ${step >= s ? 'bg-[#5a5af9] text-white ring-4 ring-indigo-100' : 'bg-white border-2 border-slate-200 text-slate-400'}`}>
                    {step > s ? '✓' : s}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ADIM 1: MARKA SEÇİMİ */}
          {step === 1 && (
            <div className="text-center animate-in slide-in-from-right-8 duration-500 max-w-3xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-black tracking-tight mb-3 text-slate-900">Hangi cihazı satmak istiyorsunuz?</h2>
              <p className="text-slate-500 mb-10 text-lg">Cihazınızın markasını seçerek işleminize başlayın.</p>
              
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                {baseBrands.map(brand => (
                  <button key={brand} onClick={() => { setSelectedBrand(brand); handleNextStep(); }} className="p-8 border-2 border-slate-100 rounded-3xl hover:border-[#5a5af9] hover:bg-indigo-50/50 transition-all flex flex-col items-center gap-4 group bg-white shadow-sm hover:shadow-md">
                    <span className="text-xl font-bold text-slate-700 group-hover:text-[#5a5af9]">{brand}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ADIM 2: MODEL SEÇİMİ */}
          {step === 2 && (
            <div className="animate-in slide-in-from-right-8 duration-500 max-w-4xl mx-auto">
              <button onClick={() => setStep(1)} className="text-sm font-bold text-[#5a5af9] flex items-center gap-2 mb-6 hover:underline">
                ← Marka Seçimine Dön
              </button>
              <h2 className="text-3xl font-black tracking-tight mb-6 text-slate-900">{selectedBrand} modelinizi seçin</h2>
              
              <div className="relative mb-8">
                <input type="text" placeholder="Model ara (Örn: iPhone 13)..." className="w-full p-5 pl-14 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-[#5a5af9] focus:ring-4 focus:ring-indigo-50 transition-all font-medium text-lg" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                <svg className="w-6 h-6 absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
                {Array.from(new Set(db.filter(i => i.brand === selectedBrand).map(i => i.name)))
                  .filter(name => name.toLowerCase().includes(searchQuery.toLowerCase()))
                  .map(name => (
                    <div key={name} onClick={() => { setSelectedModel(name); handleNextStep(); }} className="flex items-center gap-5 p-4 border-2 border-slate-100 rounded-2xl hover:border-[#5a5af9] cursor-pointer transition-all hover:shadow-md bg-white">
                      <div className="h-20 w-20 bg-slate-50 rounded-xl p-2 shrink-0 flex items-center justify-center border border-slate-100">
                        <img src={db.find(i => i.name === name)?.img} className="max-h-full object-contain" alt={name} />
                      </div>
                      <span className="font-bold text-lg text-slate-800">{name}</span>
                    </div>
                ))}
              </div>
            </div>
          )}

          {/* ADIM 3: HAFIZA SEÇİMİ */}
          {step === 3 && (
            <div className="text-center animate-in slide-in-from-right-8 duration-500 max-w-3xl mx-auto">
              <button onClick={() => setStep(2)} className="text-sm font-bold text-[#5a5af9] flex items-center gap-2 mb-6 hover:underline justify-center mx-auto">
                ← Modelleri Değiştir
              </button>
              <h2 className="text-3xl md:text-4xl font-black tracking-tight mb-3 text-slate-900">Hafıza kapasitesi nedir?</h2>
              <p className="text-slate-500 mb-10 text-lg">{selectedModel} cihazınızın depolama alanını seçin.</p>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {db.filter(i => i.name === selectedModel).map(c => (
                  <button key={c.cap} onClick={() => { setSelectedCapacity(c); handleNextStep(); }} className="p-6 border-2 border-slate-100 rounded-3xl hover:border-[#5a5af9] hover:bg-indigo-50/50 hover:text-[#5a5af9] transition-all font-black text-2xl text-slate-700 bg-white shadow-sm hover:shadow-md">
                    {c.cap}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ADIM 4: DURUM BİLDİRİMİ */}
          {step === 4 && (
            <div className="animate-in slide-in-from-right-8 duration-500 max-w-3xl mx-auto">
               <button onClick={() => setStep(3)} className="text-sm font-bold text-[#5a5af9] flex items-center gap-2 mb-6 hover:underline">
                ← Hafıza Seçimine Dön
              </button>
              <h2 className="text-3xl md:text-4xl font-black tracking-tight mb-3 text-slate-900">Cihazınızın durumunu değerlendirelim</h2>
              <p className="text-slate-500 mb-10 text-lg">Size en doğru teklifi verebilmemiz için lütfen soruları dürüstçe yanıtlayın.</p>

              <div className="space-y-6">
                {[
                  { id: 'power', question: 'Cihazınız sorunsuz açılıp kapanıyor mu?', opts: ['Evet', 'Hayır'] },
                  { id: 'screen', question: 'Ekranınızın durumu nasıl?', opts: ['Kusursuz', 'Çizik', 'Kırık'] },
                  { id: 'cosmetic', question: 'Kasanın (arka ve yanlar) durumu nasıl?', opts: ['Kusursuz', 'Çizik', 'Kötü'] },
                  { id: 'battery', question: 'Pil sağlığı uyarısı veriyor mu?', opts: ['İyi', 'Servis'] },
                  { id: 'repair', question: 'Daha önce yetkisiz bir serviste tamir gördü mü?', opts: ['Hayır', 'Evet'] },
                ].map(q => (
                  <div key={q.id} className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                    <h3 className="font-bold text-slate-800 mb-4 text-lg">{q.question}</h3>
                    <div className="flex flex-wrap gap-3">
                      {q.opts.map(opt => (
                        <button key={opt} onClick={() => setAnswers({...answers, [q.id]: opt})} className={`px-8 py-3.5 rounded-xl font-bold transition-all border-2 text-base ${(answers as any)[q.id] === opt ? 'border-[#5a5af9] bg-[#5a5af9] text-white shadow-md' : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-300'}`}>
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}

                <button 
                  disabled={!Object.values(answers).every(a => a !== null)} 
                  onClick={handleNextStep}
                  className="w-full py-6 mt-4 bg-[#2ecc71] text-white rounded-2xl font-black text-xl disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#27ae60] transition-all shadow-xl shadow-green-500/30"
                >
                  Teklifimi Gör
                </button>
              </div>
            </div>
          )}

          {/* ADIM 5: FİYAT TEKLİFİ VE İLETİŞİM */}
          {step === 5 && (
            <div className="text-center animate-in zoom-in-95 duration-500 max-w-2xl mx-auto pt-4">
               <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                 <svg className="w-12 h-12 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
               </div>
               <h2 className="text-2xl font-bold text-slate-500 mb-2">Cihazınız için Tahmini Teklifimiz</h2>
               
               <div className="my-8 bg-slate-50 border-2 border-indigo-100 rounded-[40px] p-10 shadow-sm relative overflow-hidden">
                 <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-full -mr-16 -mt-16"></div>
                 <p className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-3 relative z-10">{selectedBrand} {selectedModel} ({selectedCapacity?.cap})</p>
                 <div className="text-6xl md:text-7xl font-black tracking-tighter text-slate-900 mb-2 relative z-10">
                   {estimatedPrice.toLocaleString()} <span className="text-3xl text-slate-400">TL</span>
                 </div>
                 <p className="text-xs text-slate-500 mt-6 relative z-10">* Cihazınız mağazamızda uzmanlarımız tarafından incelendikten sonra nihai fiyat belirlenecektir.</p>
               </div>

               <div className="text-left bg-white border-2 border-slate-100 rounded-[32px] p-8 shadow-sm mb-8">
                 <h3 className="font-black text-xl mb-6 text-slate-800">Bu fiyata hemen satın!</h3>
                 <div className="space-y-5">
                   <div>
                     <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-2">Adınız Soyadınız</label>
                     <input type="text" value={customerInfo.name} onChange={(e)=>setCustomerInfo({...customerInfo, name: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-[#5a5af9] focus:ring-4 focus:ring-indigo-50 transition-all font-bold mt-2" placeholder="Örn: Gökhan Özden" />
                   </div>
                   <div>
                     <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-2">Telefon Numaranız</label>
                     <input type="tel" value={customerInfo.phone} onChange={(e)=>setCustomerInfo({...customerInfo, phone: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-[#5a5af9] focus:ring-4 focus:ring-indigo-50 transition-all font-bold mt-2" placeholder="05XX XXX XX XX" />
                   </div>
                 </div>
               </div>

               <div className="flex flex-col sm:flex-row gap-4">
                 <button onClick={() => {
                    setStep(1); 
                    setSelectedCapacity(null);
                    setSelectedModel(null);
                    setAnswers({ power: null, screen: null, cosmetic: null, battery: null, repair: null });
                 }} className="px-8 py-5 rounded-2xl font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 transition-all">Baştan Başla</button>
                 <button onClick={submitLead} className="flex-1 py-5 bg-[#5a5af9] text-white rounded-2xl font-black text-lg hover:bg-indigo-600 transition-all shadow-xl shadow-indigo-500/30">
                   Satış Talebi Oluştur
                 </button>
               </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
