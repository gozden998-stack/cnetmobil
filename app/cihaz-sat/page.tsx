"use client";
import React, { useState, useEffect } from 'react';

// --- AYARLAR ---
const VATSAP_NUMARASI = "905423423759"; 
const SHEET_ID = '1GvagcuTfR_e66A1yxTPqaIgh4YEmYl4M7-E2oRzZhyg';
const API_KEY = 'AIzaSyD4zJB-fvZdAR5WucfwITuqpIuHgbpK2gc';
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

  if (loading) return <div className="h-screen flex items-center justify-center bg-white text-slate-500 font-medium">Cnetmobil Hazırlanıyor...</div>;

  return (
    <div className="min-h-screen bg-[#F4F6F8] font-sans text-slate-900 overflow-x-hidden">
      
      {/* Modallar ve Navbar aynı kalıyor, sadece stil güncellendi */}
      <nav className="bg-white/95 backdrop-blur-md sticky top-0 z-50 border-b border-slate-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
          <div onClick={() => setStep(0)} className="flex items-center gap-2 cursor-pointer">
            <span className="text-xl font-black tracking-tight text-slate-900">CNET<span className="text-[#5a5af9]">MOBİL</span></span>
          </div>
          
          <div className="flex items-center gap-8">
            <div className="hidden md:flex items-center gap-6 text-sm font-bold text-slate-500">
               <button onClick={() => setInfoModal('how')} className="hover:text-[#5a5af9]">Nasıl Çalışır?</button>
               <button onClick={() => setInfoModal('security')} className="hover:text-[#5a5af9]">Güvenlik</button>
            </div>
            
            {/* GÖRSELDEKİ BİZE ULAŞIN ALANI */}
            <div className="flex items-center gap-3">
               <div className="w-8 h-8 flex items-center justify-center bg-slate-100 rounded-full">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
               </div>
               <div className="flex flex-col">
                  <span className="text-[11px] font-bold text-slate-400 uppercase leading-none mb-1">Bize Ulaşın</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black text-slate-800 leading-none">+90 542 342 37 59</span>
                    <a href={`https://wa.me/${VATSAP_NUMARASI}`} target="_blank" className="hover:scale-110 transition-transform">
                       <svg width="18" height="18" viewBox="0 0 24 24" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.72.937 3.659 1.432 5.631 1.433h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                    </a>
                  </div>
               </div>
            </div>
          </div>
        </div>
      </nav>

      {/* GÖRSEL 1'DEKİ MOR BANNER ALANI */}
      <div className="bg-[#5a5af9] pt-12 pb-32 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col gap-2">
            <span className="text-white/80 font-bold text-xs tracking-widest uppercase">Cnetmobil</span>
            <h2 className="text-white text-3xl md:text-4xl font-black">BuyBack Nedir?</h2>
          </div>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 -mt-20 pb-20 relative z-10">
        <div className="bg-white rounded-[32px] shadow-2xl p-8 md:p-16 border border-slate-100">
          
          {step === 0 && (
            <div className="flex flex-col lg:flex-row items-center justify-between gap-12">
              <div className="flex-1">
                <h3 className="text-3xl md:text-[42px] font-black text-slate-900 mb-6 leading-tight">Kullandığın Cep Telefonu eskidiyse Eskiyi Getir, Yeniyi Götür!</h3>
                <p className="text-slate-500 text-lg mb-10 max-w-xl leading-relaxed">2003'ten bu yana güvenin adresi Cnetmobil'de cihazınızı doğru fiyatla anında nakde dönüştürün.</p>
                <button onClick={() => setStep(1)} className="bg-[#2ecc71] hover:bg-[#27ae60] text-white font-bold py-5 px-14 rounded-[20px] shadow-lg transition-all text-xl">Cihazını Hemen Sat</button>
              </div>
            </div>
          )}

          {/* DİĞER ADIMLAR (Step 1-5) AYNI MANTIKLA DEVAM EDER */}
          {step === 1 && (
            <div className="animate-in fade-in duration-500">
              <h2 className="text-2xl md:text-3xl font-black text-center mb-10 text-slate-800">Cihazınızın Markası Nedir?</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                {baseBrands.map(brand => (
                  <button key={brand} onClick={() => { setSelectedBrand(brand); setStep(2); }} className="p-10 border-2 border-slate-100 rounded-[32px] hover:border-[#5a5af9] hover:bg-slate-50 transition-all font-bold text-xl bg-white flex flex-col items-center gap-4">{brand}</button>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="max-w-4xl mx-auto animate-in fade-in duration-500">
              <h2 className="text-3xl font-black mb-8 text-slate-800">{selectedBrand} <span className="text-[#5a5af9]">Hangi Model?</span></h2>
              <input type="text" placeholder="Model ara..." className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-[#5a5af9] mb-8" onChange={(e) => setSearchQuery(e.target.value)} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[450px] overflow-y-auto pr-2 custom-scrollbar">
                {Array.from(new Set(db.filter(i => i.brand === selectedBrand).map(i => i.name)))
                  .filter(name => name.toLowerCase().includes(searchQuery.toLowerCase()))
                  .map(name => (
                    <div key={name} onClick={() => { setSelectedModel(name); setStep(3); }} className="flex items-center gap-5 p-5 border-2 border-slate-100 rounded-2xl hover:border-[#5a5af9] cursor-pointer bg-white transition-all">
                      <img src={db.find(i => i.name === name)?.img} className="h-16 w-16 object-contain" alt={name} />
                      <span className="font-bold text-lg">{name}</span>
                    </div>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="text-center max-w-3xl mx-auto animate-in zoom-in-95 duration-500">
              <h2 className="text-3xl font-black mb-10 text-slate-800">Depolama Kapasitesi?</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                {db.filter(i => i.name === selectedModel).map(c => (
                  <button key={c.cap} onClick={() => { setSelectedCapacity(c); setStep(4); }} className="p-10 border-2 border-slate-100 rounded-[32px] hover:border-[#5a5af9] font-black text-2xl text-slate-700">{c.cap}</button>
                ))}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="max-w-3xl mx-auto animate-in fade-in duration-500">
              <h2 className="text-3xl font-black mb-8 text-slate-800 text-center">Cihaz Kondisyonu</h2>
              <div className="space-y-4">
                {[
                  { id: 'power', question: 'Cihazınız sorunsuz açılıyor mu?', opts: ['Evet', 'Hayır'] },
                  { id: 'screen', question: 'Ekran durumu nasıl?', opts: ['Kusursuz', 'Çizik', 'Kırık'] },
                  { id: 'cosmetic', question: 'Kasa (Yan ve Arka) durumu?', opts: ['Kusursuz', 'Çizik', 'Kötü'] },
                  { id: 'battery', question: 'Pil sağlığı uyarısı var mı?', opts: ['İyi', 'Servis'] },
                  { id: 'repair', question: 'Daha önce tamir gördü mü?', opts: ['Hayır', 'Evet'] },
                ].map(q => (
                  <div key={q.id} className="bg-slate-50 p-6 rounded-[24px] border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <h3 className="font-bold text-slate-700">{q.question}</h3>
                    <div className="flex gap-2">
                      {q.opts.map(opt => (
                        <button key={opt} onClick={() => setAnswers({...answers, [q.id]: opt})} className={`px-6 py-3 rounded-xl font-bold text-sm transition-all border-2 ${(answers as any)[q.id] === opt ? 'bg-[#5a5af9] border-[#5a5af9] text-white shadow-lg' : 'bg-white border-slate-200 text-slate-500'}`}>{opt}</button>
                      ))}
                    </div>
                  </div>
                ))}
                <button disabled={!Object.values(answers).every(a => a !== null)} onClick={() => setStep(5)} className="w-full mt-6 py-6 bg-[#2ecc71] text-white rounded-[24px] font-black text-xl shadow-xl disabled:opacity-30">Teklifi Gör</button>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="text-center max-w-2xl mx-auto animate-in zoom-in-95 duration-700">
               <div className="mb-10 bg-gradient-to-br from-[#5a5af9] to-[#3f3fcc] rounded-[40px] p-12 shadow-2xl relative overflow-hidden text-white">
                 <p className="text-white/70 font-bold mb-2 uppercase tracking-widest text-sm">{selectedBrand} {selectedModel}</p>
                 <div className="text-7xl font-black mb-2">{estimatedPrice.toLocaleString()} <span className="text-2xl font-light">TL</span></div>
                 <p className="text-white/50 text-xs italic">*Cihaz kontrolünden sonra nihai fiyat verilir.</p>
               </div>
               <div className="space-y-4 mb-8">
                  <input type="text" value={customerInfo.name} onChange={(e)=>setCustomerInfo({...customerInfo, name: e.target.value})} className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-[#5a5af9]" placeholder="Adınız Soyadınız" />
                  <input type="tel" value={customerInfo.phone} onChange={(e)=>setCustomerInfo({...customerInfo, phone: e.target.value})} className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-[#5a5af9]" placeholder="Telefon Numaranız" />
               </div>
               <button onClick={submitLead} className="w-full py-6 bg-[#25D366] hover:bg-[#1ebd5b] text-white rounded-[24px] font-black text-xl flex items-center justify-center gap-3 shadow-xl">WhatsApp ile Talebi Gönder</button>
               <button onClick={() => setStep(0)} className="mt-6 text-slate-400 font-semibold hover:text-[#5a5af9]">Yeniden Başla</button>
            </div>
          )}

        </div>
      </main>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #f1f1f1; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
      `}</style>
    </div>
  );
}
