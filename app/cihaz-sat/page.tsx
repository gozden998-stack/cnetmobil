"use client";
import React, { useState, useEffect } from 'react';

// --- AYARLAR ---
const VATSAP_NUMARASI = "905XXXXXXXXX"; // Buraya numaranızı 905... şeklinde yazın
const SHEET_ID = '1GvagcuTfR_e66A1yxTPqaIgh4YEmYl4M7-E2oRzZhyg';
const API_KEY = 'AIzaSyD4zJB-fvZdAR5WucfwITuqpIuHgbpK2gc';
const TABLO_ISMI = 'Google Sheets ile Kurumsal Alım Sistemi';

export default function CnetmobilMusteriTradeIn() {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [db, setDb] = useState<any[]>([]);
  const [config, setConfig] = useState<any>({});
  
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
    if(!customerInfo.name || !customerInfo.phone) return alert("Lütfen iletişim bilgilerinizi eksiksiz doldurun.");
    
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

  const Progress = () => (
    <div className="flex items-center justify-between mb-8 max-w-xs mx-auto">
      {[1, 2, 3, 4, 5].map((s) => (
        <div key={s} className="flex items-center">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-all ${step >= s ? 'bg-[#5a5af9] text-white' : 'bg-slate-100 text-slate-400'}`}>
            {step > s ? '✓' : s}
          </div>
          {s < 5 && <div className={`w-6 md:w-10 h-[2px] ${step > s ? 'bg-[#5a5af9]' : 'bg-slate-100'}`} />}
        </div>
      ))}
    </div>
  );

  if (loading) return (
    <div className="h-screen flex flex-col items-center justify-center bg-white">
      <div className="w-12 h-12 border-4 border-[#5a5af9] border-t-transparent rounded-full animate-spin mb-4"></div>
      <p className="text-slate-500 font-medium">Fiyatlar Güncelleniyor...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans text-slate-900">
      {/* Header */}
      <nav className="bg-white border-b sticky top-0 z-50 px-6 py-4">
        <div className="max-w-5xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setStep(0)}>
            <div className="bg-[#5a5af9] text-white p-2 rounded-lg font-bold">C</div>
            <span className="font-black text-xl tracking-tight">CNETMOBİL</span>
          </div>
          <div className="hidden md:flex gap-4 text-xs font-bold text-slate-400 uppercase tracking-widest">
            <span>Güvenli Alım</span>
            <span>•</span>
            <span>Anında Nakit</span>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 py-8 md:py-12">
        {step > 0 && <Progress />}

        <div className="bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/50 p-6 md:p-12 border border-slate-100 transition-all">
          
          {/* STEP 0: HERO */}
          {step === 0 && (
            <div className="text-center space-y-8 py-4">
              <div className="inline-block bg-indigo-50 text-[#5a5af9] px-4 py-2 rounded-full text-sm font-bold">
                🚀 Eski Telefonun Nakit Olsun
              </div>
              <h1 className="text-4xl md:text-6xl font-black leading-[1.1] tracking-tight text-slate-900">
                Cihazını <span className="text-[#5a5af9]">Saniyeler İçinde</span> Değerine Sat.
              </h1>
              <p className="text-slate-500 text-lg md:text-xl max-w-2xl mx-auto font-medium">
                2003'ten beri güvenin adresi Cnetmobil'de cihazının değerini anında hesapla, en yüksek teklifle bugün nakit ödemeni al.
              </p>
              <div className="pt-4">
                <button onClick={() => setStep(1)} className="group bg-[#5a5af9] hover:bg-indigo-600 text-white font-black py-5 px-12 rounded-2xl shadow-2xl shadow-indigo-200 transition-all hover:scale-105 active:scale-95 text-xl flex items-center gap-3 mx-auto">
                  Hemen Fiyat Al 
                  <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
                </button>
              </div>
              <div className="flex flex-wrap justify-center gap-6 pt-8 text-slate-400 font-bold text-sm">
                <span className="flex items-center gap-2">✓ Ücretsiz Ekspertiz</span>
                <span className="flex items-center gap-2">✓ Aynı Gün Ödeme</span>
                <span className="flex items-center gap-2">✓ En İyi Fiyat</span>
              </div>
            </div>
          )}

          {/* STEP 1: BRAND */}
          {step === 1 && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h2 className="text-2xl md:text-3xl font-black text-center mb-8">Marka Seçiniz</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {baseBrands.map(brand => (
                  <button key={brand} onClick={() => { setSelectedBrand(brand); setStep(2); }} className="group p-8 border-2 border-slate-50 rounded-3xl hover:border-[#5a5af9] hover:bg-indigo-50/30 transition-all bg-white shadow-sm flex flex-col items-center">
                    <span className="text-xl font-bold text-slate-700 group-hover:text-[#5a5af9]">{brand}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* STEP 2: MODEL */}
          {step === 2 && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <button onClick={() => setStep(1)} className="text-sm font-bold text-[#5a5af9] mb-4 flex items-center gap-1">← Geri Dön</button>
              <h2 className="text-2xl md:text-3xl font-black mb-6">{selectedBrand} Modelini Seçin</h2>
              <div className="relative mb-6">
                <input type="text" placeholder="Cihaz ismini yazın..." className="w-full p-5 bg-slate-50 border-none rounded-2xl outline-none ring-2 ring-transparent focus:ring-[#5a5af9]/20 font-medium" onChange={(e) => setSearchQuery(e.target.value)} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {Array.from(new Set(db.filter(i => i.brand === selectedBrand).map(i => i.name)))
                  .filter(name => name.toLowerCase().includes(searchQuery.toLowerCase()))
                  .map(name => (
                    <div key={name} onClick={() => { setSelectedModel(name); setStep(3); }} className="flex items-center gap-4 p-4 border rounded-2xl hover:border-[#5a5af9] hover:bg-indigo-50/20 cursor-pointer transition-all bg-white group">
                      <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center group-hover:bg-white transition-colors">
                        <img src={db.find(i => i.name === name)?.img} className="h-10 object-contain" alt={name} />
                      </div>
                      <span className="font-bold text-slate-700">{name}</span>
                    </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 3: CAPACITY */}
          {step === 3 && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 text-center">
              <button onClick={() => setStep(2)} className="text-sm font-bold text-[#5a5af9] mb-4 flex items-center gap-1 mx-auto">← Model Değiştir</button>
              <h2 className="text-2xl md:text-3xl font-black mb-8">Kapasite Seçiniz</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {db.filter(i => i.name === selectedModel).map(c => (
                  <button key={c.cap} onClick={() => { setSelectedCapacity(c); setStep(4); }} className="p-6 border-2 border-slate-50 rounded-3xl hover:border-[#5a5af9] hover:bg-indigo-50 transition-all font-black text-xl shadow-sm">
                    {c.cap}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* STEP 4: ASSESSMENT */}
          {step === 4 && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h2 className="text-2xl md:text-3xl font-black mb-2 text-center">Cihaz Durumu</h2>
              <p className="text-slate-400 text-center mb-10 font-medium">Lütfen cihazınızın mevcut durumunu belirtin.</p>
              <div className="space-y-6 max-w-2xl mx-auto">
                {[
                  { id: 'power', question: 'Cihaz Sorunsuz Açılıyor mu?', opts: ['Evet', 'Hayır'] },
                  { id: 'screen', question: 'Ekranın Kozmetik Durumu?', opts: ['Kusursuz', 'Çizik', 'Kırık'] },
                  { id: 'cosmetic', question: 'Kasa ve Arka Cam Durumu?', opts: ['Kusursuz', 'Çizik', 'Kötü'] },
                  { id: 'battery', question: 'Pil Sağlığı Uyarı Veriyor mu?', opts: ['İyi', 'Servis'] },
                  { id: 'repair', question: 'Daha Önce Tamir Gördü mü?', opts: ['Hayır', 'Evet'] },
                ].map(q => (
                  <div key={q.id} className="bg-slate-50/50 p-6 rounded-3xl border border-slate-100">
                    <h3 className="font-bold text-slate-800 mb-4">{q.question}</h3>
                    <div className="flex gap-2 md:gap-3">
                      {q.opts.map(opt => (
                        <button key={opt} onClick={() => setAnswers({...answers, [q.id]: opt})} className={`flex-1 py-3 rounded-xl font-bold border-2 transition-all ${ (answers as any)[q.id] === opt ? 'bg-[#5a5af9] border-[#5a5af9] text-white' : 'bg-white border-slate-200 text-slate-500 hover:border-indigo-200'}`}>
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                <button 
                  disabled={!Object.values(answers).every(a => a !== null)} 
                  onClick={() => setStep(5)} 
                  className="w-full py-6 bg-[#2ecc71] text-white rounded-2xl font-black text-xl shadow-xl shadow-green-100 disabled:opacity-30 transition-all hover:bg-[#27ae60] mt-8"
                >
                  Teklifi Görüntüle
                </button>
              </div>
            </div>
          )}

          {/* STEP 5: FINAL OFFER */}
          {step === 5 && (
            <div className="animate-in zoom-in-95 duration-500 text-center max-w-xl mx-auto">
               <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6 text-green-500">
                 <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>
               </div>
               <h2 className="text-xl font-bold text-slate-400 uppercase tracking-widest mb-2">Sizin İçin Hazırlanan Teklif</h2>
               
               <div className="my-8 bg-indigo-50/50 border-2 border-dashed border-indigo-200 rounded-[3rem] p-10">
                 <p className="font-black text-slate-900 text-lg mb-2">{selectedBrand} {selectedModel}</p>
                 <div className="text-6xl md:text-7xl font-black text-[#5a5af9] tracking-tighter">
                   {estimatedPrice.toLocaleString()} <span className="text-2xl text-indigo-300">TL</span>
                 </div>
                 <p className="text-xs text-slate-400 mt-6">* Mağaza kontrolü sonrası son fiyat netleşecektir.</p>
               </div>

               <div className="space-y-4 mb-8">
                 <input type="text" value={customerInfo.name} onChange={(e)=>setCustomerInfo({...customerInfo, name: e.target.value})} className="w-full p-5 bg-slate-50 border-none rounded-2xl outline-none focus:ring-2 focus:ring-[#5a5af9]/20 font-bold" placeholder="Adınız Soyadınız" />
                 <input type="tel" value={customerInfo.phone} onChange={(e)=>setCustomerInfo({...customerInfo, phone: e.target.value})} className="w-full p-5 bg-slate-50 border-none rounded-2xl outline-none focus:ring-2 focus:ring-[#5a5af9]/20 font-bold" placeholder="Telefon Numaranız" />
               </div>

               <button onClick={submitLead} className="w-full py-6 bg-[#5a5af9] text-white rounded-2xl font-black text-xl shadow-2xl shadow-indigo-200 hover:scale-[1.02] transition-all flex items-center justify-center gap-3">
                 <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.414 0 .004 5.412 0 12.048c0 2.123.554 4.197 1.607 6.037L0 24l6.105-1.602a11.834 11.834 0 005.937 1.606h.005c6.637 0 12.048-5.414 12.053-12.052a11.85 11.85 0 00-3.536-8.503z"/></svg>
                 Talebi WhatsApp'a Gönder
               </button>
               
               <p className="mt-8 text-slate-400 text-sm font-medium">
                 Tıklayarak iletişim izni vermiş olursunuz.
               </p>
            </div>
          )}

        </div>
      </main>
      
      <footer className="text-center pb-10">
        <p className="text-slate-400 font-bold text-xs uppercase tracking-widest italic">
          Since 2003 • Cnetmobil Güvencesiyle
        </p>
      </footer>
    </div>
  );
}
