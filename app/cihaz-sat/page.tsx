"use client";
import React, { useState, useEffect } from 'react';

// --- AYARLAR ---
const VATSAP_NUMARASI = "905358930451"; // Buraya kendi numaranızı başında 90 olacak şekilde birleşik yazın (Örn: 905321234567)
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

  // WHATSAPP GÖNDERİM FONKSİYONU
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

  if (loading) return <div className="h-screen flex items-center justify-center bg-slate-50">Yükleniyor...</div>;

  return (
    <div className="min-h-screen bg-[#F4F6F8] font-sans pb-20">
      <div className="bg-[#5a5af9] pt-12 pb-32 px-6">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-2xl font-black text-white mb-10">CNET<span className="text-blue-200">MOBİL</span></h1>
          <h2 className="text-white text-4xl font-black tracking-tight">BuyBack Nedir?</h2>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 -mt-20 relative z-10">
        <div className="bg-white rounded-[32px] shadow-2xl p-8 md:p-14 border border-slate-100 min-h-[450px]">
          
          {step === 0 && (
            <div className="flex flex-col lg:flex-row items-center justify-between gap-12">
              <div className="flex-1">
                <h3 className="text-3xl md:text-[42px] font-black text-slate-900 mb-6 leading-tight">Kullandığın Cep Telefonu eskidiyse Eskiyi Getir, Yeniyi Götür!</h3>
                <p className="text-slate-500 text-lg mb-8">2003'ten bu yana güvenin adresi Cnetmobil'de cihazınızı anında değere dönüştürün.</p>
                <button onClick={() => setStep(1)} className="bg-[#2ecc71] hover:bg-[#27ae60] text-white font-bold py-5 px-12 rounded-full shadow-lg transition-all text-xl">Cihazını Hemen Sat</button>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="text-center max-w-3xl mx-auto">
              <h2 className="text-3xl font-black mb-10">Hangi cihazı satmak istiyorsunuz?</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                {baseBrands.map(brand => (
                  <button key={brand} onClick={() => { setSelectedBrand(brand); setStep(2); }} className="p-8 border-2 rounded-3xl hover:border-[#5a5af9] font-bold text-xl bg-white">{brand}</button>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="max-w-4xl mx-auto">
              <h2 className="text-3xl font-black mb-6">{selectedBrand} modelinizi seçin</h2>
              <input type="text" placeholder="Model ara..." className="w-full p-4 mb-6 bg-slate-50 border rounded-2xl outline-none focus:border-[#5a5af9]" onChange={(e) => setSearchQuery(e.target.value)} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[400px] overflow-y-auto">
                {Array.from(new Set(db.filter(i => i.brand === selectedBrand).map(i => i.name)))
                  .filter(name => name.toLowerCase().includes(searchQuery.toLowerCase()))
                  .map(name => (
                    <div key={name} onClick={() => { setSelectedModel(name); setStep(3); }} className="flex items-center gap-4 p-4 border rounded-2xl hover:border-[#5a5af9] cursor-pointer bg-white">
                      <img src={db.find(i => i.name === name)?.img} className="h-16 w-16 object-contain" alt={name} />
                      <span className="font-bold">{name}</span>
                    </div>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="text-center max-w-3xl mx-auto">
              <h2 className="text-3xl font-black mb-10">Hafıza kapasitesi nedir?</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {db.filter(i => i.name === selectedModel).map(c => (
                  <button key={c.cap} onClick={() => { setSelectedCapacity(c); setStep(4); }} className="p-6 border-2 rounded-3xl hover:border-[#5a5af9] font-black text-2xl">{c.cap}</button>
                ))}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="max-w-3xl mx-auto">
              <h2 className="text-3xl font-black mb-8">Cihazınızın durumunu değerlendirelim</h2>
              <div className="space-y-6">
                {[
                  { id: 'power', question: 'Cihazınız sorunsuz açılıyor mu?', opts: ['Evet', 'Hayır'] },
                  { id: 'screen', question: 'Ekran durumu?', opts: ['Kusursuz', 'Çizik', 'Kırık'] },
                  { id: 'cosmetic', question: 'Kasa durumu?', opts: ['Kusursuz', 'Çizik', 'Kötü'] },
                  { id: 'battery', question: 'Pil uyarısı var mı?', opts: ['İyi', 'Servis'] },
                  { id: 'repair', question: 'Tamir gördü mü?', opts: ['Hayır', 'Evet'] },
                ].map(q => (
                  <div key={q.id} className="bg-slate-50 p-6 rounded-3xl border">
                    <h3 className="font-bold mb-4">{q.question}</h3>
                    <div className="flex gap-3">
                      {q.opts.map(opt => (
                        <button key={opt} onClick={() => setAnswers({...answers, [q.id]: opt})} className={`px-6 py-2 rounded-xl font-bold border-2 ${(answers as any)[q.id] === opt ? 'bg-[#5a5af9] text-white' : 'bg-white text-slate-600'}`}>{opt}</button>
                      ))}
                    </div>
                  </div>
                ))}
                <button disabled={!Object.values(answers).every(a => a !== null)} onClick={() => setStep(5)} className="w-full py-6 bg-[#2ecc71] text-white rounded-2xl font-black text-xl shadow-lg disabled:opacity-50">Teklifimi Gör</button>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="text-center max-w-2xl mx-auto">
               <div className="my-8 bg-slate-50 border-2 border-indigo-100 rounded-[40px] p-10 shadow-sm">
                 <p className="text-sm font-bold text-slate-400 mb-2 uppercase">{selectedBrand} {selectedModel} ({selectedCapacity?.cap})</p>
                 <div className="text-6xl font-black text-slate-900">{estimatedPrice.toLocaleString()} <span className="text-3xl text-slate-400">TL</span></div>
               </div>
               <div className="text-left bg-white border rounded-[32px] p-8 shadow-sm mb-8">
                 <h3 className="font-black text-xl mb-6">İletişim Bilgileriniz</h3>
                 <input type="text" value={customerInfo.name} onChange={(e)=>setCustomerInfo({...customerInfo, name: e.target.value})} className="w-full p-4 mb-4 bg-slate-50 border rounded-2xl outline-none" placeholder="Adınız Soyadınız" />
                 <input type="tel" value={customerInfo.phone} onChange={(e)=>setCustomerInfo({...customerInfo, phone: e.target.value})} className="w-full p-4 bg-slate-50 border rounded-2xl outline-none" placeholder="Telefon Numaranız" />
               </div>
               <button onClick={submitLead} className="w-full py-5 bg-[#5a5af9] text-white rounded-2xl font-black text-lg shadow-xl">WhatsApp ile Talebi Gönder</button>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
