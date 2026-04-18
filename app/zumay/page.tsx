"use client";
import React, { useState, useEffect } from 'react';

// --- AYARLAR ---
const VATSAP_NUMARASI = "905423423759"; 
const SHEET_ID = process.env.NEXT_PUBLIC_SHEET_ID as string;
const API_KEY = process.env.NEXT_PUBLIC_API_KEY as string;

// TABLO İSİMLERİ
const TABLO_STANDART = 'Cihaz Sat'; 
const TABLO_DIS_KANAL = 'DIŞ KANAL SATIN ALMA';

export default function ZumayTradeIn() {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  
  // İki farklı veri kaynağı için stateler
  const [dbStandard, setDbStandard] = useState<any[]>([]);
  const [dbExternal, setDbExternal] = useState<any[]>([]);
  const [config, setConfig] = useState<any>({});
  
  // Hangi akışta olduğumuzu tutan state (standart vs dis_kanal)
  const [flowType, setFlowType] = useState<'standart' | 'dis_kanal' | null>(null);
  
  const [infoModal, setInfoModal] = useState<'how' | 'security' | null>(null);

  const [selectedBrand, setSelectedBrand] = useState('');
  const [selectedModel, setSelectedModel] = useState<any>(null);
  const [selectedCapacity, setSelectedCapacity] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // KATEGORİLER
  const [answers, setAnswers] = useState({ power: null, screen: null, cosmetic: null, faceId: null, battery: null });
  
  const [customerInfo, setCustomerInfo] = useState({ name: '', phone: '' });
  const [estimatedPrice, setEstimatedPrice] = useState(0);

  const baseBrands = ["Apple", "Samsung", "Xiaomi", "Huawei", "Oppo"];

  // Aktif veritabanını seçme (Akışa göre)
  const activeDb = flowType === 'dis_kanal' ? dbExternal : dbStandard;

  useEffect(() => {
    const loadData = async () => {
      try {
        const t = new Date().getTime();
        
        // 1. Standart Cihaz Verileri
        const stdUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(TABLO_STANDART)}!A2:F1000?key=${API_KEY}&t=${t}`;
        
        // 2. Dış Kanal (Kurumsal Alım) Cihaz Verileri
        const extUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(TABLO_DIS_KANAL)}!A2:F1000?key=${API_KEY}&t=${t}`;
        
        // 3. Kesinti Ayarları
        const configUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(TABLO_STANDART)}!N2:O50?key=${API_KEY}&t=${t}`;

        const [stdRes, extRes, confRes] = await Promise.all([
          fetch(stdUrl, { cache: 'no-store' }),
          fetch(extUrl, { cache: 'no-store' }),
          fetch(configUrl, { cache: 'no-store' })
        ]);

        const stdData = await stdRes.json();
        const extData = await extRes.json();
        const confData = await confRes.json();

        const parseRow = (row: any) => ({
          brand: row[0] ? String(row[0]).trim() : '', 
          name: row[1] ? String(row[1]).trim() : '', 
          cap: row[2] ? String(row[2]).trim() : '',
          base: parseInt(row[3]) || 0, 
          img: row[4] ? String(row[4]).trim() : '', 
          minPrice: parseInt(row[5]) || 0
        });

        if (stdData.values) setDbStandard(stdData.values.map(parseRow));
        if (extData.values) setDbExternal(extData.values.map(parseRow));

        if (confData.values) {
          const m: any = {};
          confData.values.forEach((row: any) => {
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
      
      // KESİNTİ MANTIĞI (Sadece standart akışta kullanılıyor)
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

  const handleStatusSubmit = async (status: 'ALINDI' | 'ALINMADI') => {
    
    try {
      await fetch('/api/alimlari-kaydet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          musteriAdi: customerInfo.name,
          telefon: customerInfo.phone,
          cihaz: `${selectedBrand} ${selectedModel} ${selectedCapacity.cap}`,
          fiyat: estimatedPrice,
          durum: status,
          kanal: 'Standart'
        })
      });
    } catch (error) {
      console.error("Sheets'e yazılırken hata oluştu", error);
    }

    const mesaj = `*YENİ İŞLEM BİLDİRİMİ - ZUMAY*%0A%0A` +
                  `*İşlem Durumu:* ${status}%0A` +
                  `*Kanal:* Standart Cihaz Değerleme%0A%0A` +
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
    
    setStep(0);
    setAnswers({ power: null, screen: null, cosmetic: null, faceId: null, battery: null });
    setCustomerInfo({ name: '', phone: '' });
  };

  if (loading) return (
    <div className="h-screen flex flex-col items-center justify-center bg-white">
      <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin mb-4"></div>
      <p className="text-slate-500 font-medium animate-pulse">ZUMAY Hazırlanıyor...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans text-slate-900 overflow-x-hidden">
      
      {/* Bilgi Modalları */}
      {infoModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
           <div className="bg-white rounded-[32px] p-8 max-w-md w-full shadow-2xl relative">
              <button onClick={() => setInfoModal(null)} className="absolute top-6 right-6 text-slate-400 hover:text-slate-900 text-xl font-bold">✕</button>
              {infoModal === 'how' ? (
                <>
                  <h3 className="text-2xl font-black mb-4 text-red-600 text-center">Nasıl Çalışır?</h3>
                  <div className="space-y-4 text-slate-600">
                    <p><strong>1. Kanal Seçin:</strong> Standart veya Dış Kanal üzerinden işleme başlayın.</p>
                    <p><strong>2. Durumunu Belirt:</strong> Cihazınızın kozmetik ve teknik durumunu işaretleyin.</p>
                    <p><strong>3. Teklif Al:</strong> Algoritmamız size en doğru piyasa değerini saniyeler içinde sunsun.</p>
                    <p><strong>4. İşlemi Tamamla:</strong> Fiyatı gördükten sonra Alındı veya Alınmadı olarak durumu onaylayın.</p>
                  </div>
                </>
              ) : (
                <>
                  <h3 className="text-2xl font-black mb-4 text-red-600 text-center">Güvenlik Politikamız</h3>
                  <div className="space-y-4 text-slate-600">
                    <p><strong>Veri Sıfırlama:</strong> Cihazınızdaki tüm kişisel veriler profesyonel standartlarda kalıcı olarak silinir.</p>
                    <p><strong>Şeffaf Fiyatlandırma:</strong> Size verilen teklif, güncel piyasa koşullarına göre hesaplanan en adil tutardır.</p>
                    <p><strong>Güvence:</strong> ZUMAY güvencesiyle hızlı ve güvenilir hizmet alırsınız.</p>
                  </div>
                </>
              )}
              <button onClick={() => setInfoModal(null)} className="w-full mt-8 py-4 bg-slate-900 text-white rounded-2xl font-bold">Anladım</button>
           </div>
        </div>
      )}

      {/* Header */}
      <nav className="bg-white/80 backdrop-blur-md sticky top-0 z-50 border-b border-slate-100 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
          <div onClick={() => setStep(0)} className="flex items-center gap-2 cursor-pointer group">
            <div className="w-10 h-10 bg-red-600 rounded-xl flex items-center justify-center shadow-lg shadow-red-200 group-hover:scale-105 transition-transform">
              <span className="text-white font-black text-xl">Z</span>
            </div>
            <span className="text-xl font-bold tracking-tight text-slate-900">ZUMAY</span>
          </div>

          <div className="flex items-center gap-4 md:gap-8">
            <div className="hidden lg:flex items-center gap-6 text-sm font-semibold text-slate-500">
              <button onClick={() => setInfoModal('how')} className="hover:text-red-600 transition-colors">Nasıl Çalışır?</button>
              <button onClick={() => setInfoModal('security')} className="hover:text-red-600 transition-colors">Güvenlik</button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section - Koyu Temada Hero'yu Gizle (Daha Şık Olur) */}
      {step !== 10 && (
        <div className="bg-gradient-to-b from-red-700 to-red-900 pt-16 pb-32 px-6">
          <div className="max-w-4xl mx-auto text-center">
            {step === 0 ? (
              <>
                <h1 className="text-4xl md:text-6xl font-black text-white mb-6 leading-tight">Eski Telefonun <br/><span className="text-red-300">Nakit Paraya</span> Dönüşsün.</h1>
                <p className="text-red-100 text-lg md:text-xl max-w-2xl mx-auto mb-10">ZUMAY güvencesiyle 5 dakikada fiyat teklifi al, doğru fiyat ile cihazını sat</p>
              </>
            ) : (
              <div className="mb-10">
                 <div className="flex justify-between items-center max-w-xs mx-auto mb-4">
                   {[1,2,3,4,5,6].map((s) => (
                      <div key={s} className={`h-1.5 flex-1 mx-1 rounded-full transition-all duration-500 ${step >= s ? 'bg-red-500' : 'bg-red-900/50'}`} />
                   ))}
                 </div>
                 <p className="text-red-200 text-sm font-medium uppercase tracking-widest">Aşama {step} / 6</p>
              </div>
            )}
          </div>
        </div>
      )}

      <main className={`max-w-5xl mx-auto px-4 ${step === 10 ? 'pt-10' : '-mt-24'} pb-20 relative z-10`}>
        <div className={`rounded-[40px] shadow-[0_20px_50px_rgba(0,0,0,0.1)] ${step === 10 ? 'bg-[#181A25] p-6 md:p-10 border-0' : 'bg-white p-6 md:p-12 border border-slate-100'} transition-all duration-500`}>
          
          {step === 0 && (
            <div className="flex flex-col items-center animate-in fade-in zoom-in-95 duration-500">
              
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-50 border border-red-100 text-red-600 text-[10px] sm:text-xs font-black uppercase tracking-widest mb-8 shadow-sm">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-600"></span>
                </span>
                ESKİYİ GETİR YENİYİ GÖTÜR
              </div>

              {/* İKİ BUTON YAN YANA */}
              <div className="flex flex-col sm:flex-row gap-6 w-full max-w-3xl mt-4">
                 
                 {/* STANDART DEĞERLEME BUTONU */}
                 <div className="w-full relative group">
                   <div className="absolute -inset-1 bg-gradient-to-r from-red-500 to-red-600 rounded-[28px] blur opacity-40 group-hover:opacity-100 transition duration-1000"></div>
                   <button onClick={() => { setFlowType('standart'); setStep(1); }} className="relative w-full bg-slate-900 hover:bg-red-600 text-white font-black py-6 px-6 rounded-[24px] shadow-2xl transition-all duration-300 flex flex-col items-center justify-center gap-3 overflow-hidden">
                      <span className="text-3xl">📱</span>
                      <span className="relative z-10 text-lg sm:text-xl tracking-wide text-center">
                         CİHAZINI DEĞERLE
                      </span>
                   </button>
                 </div>

                 {/* DIŞ KANAL SATIN ALMA BUTONU (STEP 10'A YÖNLENDİRİR) */}
                 <div className="w-full relative group">
                   <div className="absolute -inset-1 bg-gradient-to-r from-[#2ec4b6] to-emerald-500 rounded-[28px] blur opacity-40 group-hover:opacity-100 transition duration-1000"></div>
                   <button onClick={() => { setSearchQuery(''); setStep(10); }} className="relative w-full bg-white border-4 border-slate-900 hover:border-[#2ec4b6] text-slate-900 hover:text-[#2ec4b6] font-black py-6 px-6 rounded-[24px] shadow-xl transition-all duration-300 flex flex-col items-center justify-center gap-3 overflow-hidden">
                      <span className="text-3xl">🤝</span>
                      <span className="relative z-10 text-lg sm:text-xl tracking-wide text-center">
                         DIŞ KANAL SATIN ALMA
                      </span>
                   </button>
                 </div>

              </div>
              
              <div className="mt-16 flex flex-wrap justify-center gap-x-6 gap-y-3 text-[10px] sm:text-xs font-black uppercase tracking-widest text-slate-400 border-t border-slate-100 pt-8 w-full">
                 <span className="flex items-center gap-2"><svg className="w-4 h-4 text-emerald-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path></svg> Ücretsiz Ekspertiz</span>
                 <span className="flex items-center gap-2"><svg className="w-4 h-4 text-emerald-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path></svg> Güvenilir Hizmet</span>
                 <span className="flex items-center gap-2"><svg className="w-4 h-4 text-emerald-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path></svg> Anında Nakit Ödeme</span>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* DIŞ KANAL LİSTE GÖRÜNÜMÜ (GÖRSELDEKİ GİBİ KOYU TEMA) */}
          {/* ========================================================= */}
          {step === 10 && (
            <div className="animate-in fade-in zoom-in-95 duration-500 w-full">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                 <div>
                   <h2 className="text-3xl md:text-4xl font-black text-[#32D296] italic tracking-tight">DIŞ KANAL SATIN ALMA</h2>
                   <p className="text-slate-400 text-[10px] md:text-xs tracking-widest uppercase mt-1">DIŞ KANAL ÜRÜN VE FİYAT LİSTESİ</p>
                 </div>
                 <div className="relative w-full md:w-80">
                   <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
                   <input 
                     type="text" 
                     placeholder="Ürün Arama..." 
                     className="w-full p-3.5 pl-12 bg-[#212433] border border-[#2B2F42] rounded-2xl outline-none focus:border-[#32D296] text-slate-200 transition-all placeholder:text-slate-500 text-sm" 
                     onChange={(e) => setSearchQuery(e.target.value)} 
                   />
                 </div>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-[#2B2F42] bg-[#1C1E2A]">
                 <table className="w-full text-left border-collapse min-w-max">
                    <thead>
                       <tr className="bg-[#32D296] text-[#0F111A] text-[11px] md:text-xs uppercase tracking-widest">
                          <th className="p-4 md:p-5 font-black w-1/2">ÜRÜN / CİHAZ ADI</th>
                          <th className="p-4 md:p-5 font-black w-1/4">FİYATI (TL)</th>
                          <th className="p-4 md:p-5 font-black text-right w-1/4">DURUM / BİLGİ</th>
                       </tr>
                    </thead>
                    <tbody className="text-slate-300 text-xs md:text-sm font-semibold">
                       {dbExternal
                         .filter(item => `${item.brand} ${item.name} ${item.cap}`.toLowerCase().includes(searchQuery.toLowerCase()))
                         .map((item, idx) => (
                           <tr key={idx} className="border-b border-[#2B2F42] hover:bg-[#252838] transition-colors">
                              <td className="p-4 md:p-5 uppercase tracking-wide">{item.brand} {item.name} {item.cap}</td>
                              {/* HİÇBİR İNDİRİM YOK - DİREKT BASE FİYAT */}
                              <td className="p-4 md:p-5 font-black text-white text-base">{item.base.toLocaleString()}</td>
                              <td className="p-4 md:p-5 text-right text-slate-500">-</td>
                           </tr>
                       ))}
                       {dbExternal.filter(item => `${item.brand} ${item.name} ${item.cap}`.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
                          <tr>
                             <td colSpan={3} className="p-8 text-center text-slate-500 font-medium">
                               Aramanıza uygun cihaz bulunamadı. Lütfen kontrol edip tekrar deneyin.
                             </td>
                          </tr>
                       )}
                    </tbody>
                 </table>
              </div>

              <div className="mt-10 flex justify-center">
                 <button onClick={() => setStep(0)} className="px-8 py-3.5 border-2 border-[#2B2F42] text-slate-400 hover:text-white hover:bg-[#252838] hover:border-[#32D296] rounded-2xl font-bold transition-all text-sm flex items-center gap-2">
                   ← Ana Menüye Dön
                 </button>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* STANDART DEĞERLEME AKIŞI (AŞAĞIDAKİ ADIMLAR DEĞİŞMEDİ)    */}
          {/* ========================================================= */}
          {step === 1 && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex justify-between items-center mb-10">
                 <button onClick={() => setStep(0)} className="text-slate-400 hover:text-red-600 font-semibold text-sm">← İptal</button>
                 <span className="px-3 py-1 bg-slate-100 rounded-full text-xs font-bold text-slate-500 uppercase tracking-wider">
                   STANDART İŞLEM
                 </span>
              </div>
              <h2 className="text-2xl md:text-3xl font-black text-center mb-10 text-slate-800">Cihazınızın Markası Nedir?</h2>
              
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
                {baseBrands.map(brand => (
                  <button key={brand} onClick={() => { setSelectedBrand(brand); setStep(2); }} 
                    className="p-8 border-2 border-slate-100 rounded-[32px] hover:border-red-500 hover:shadow-xl hover:shadow-red-50 transition-all font-bold text-xl bg-white flex flex-col items-center gap-4 group text-slate-900">
                    <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">📱</div>
                    {brand}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="max-w-4xl mx-auto animate-in fade-in duration-500">
              <button onClick={() => setStep(1)} className="mb-6 text-slate-400 hover:text-red-600 flex items-center gap-2 font-semibold">← Geri Dön</button>
              <h2 className="text-3xl font-black mb-8 text-slate-800">{selectedBrand} <span className="text-red-600">Hangi Model?</span></h2>
              <div className="relative mb-8 text-slate-400">
                <span className="absolute left-4 top-1/2 -translate-y-1/2">🔍</span>
                <input type="text" placeholder="Model ismini buraya yazın..." className="w-full p-5 pl-12 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-red-500 focus:bg-white transition-all shadow-inner text-slate-900" onChange={(e) => setSearchQuery(e.target.value)} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[450px] overflow-y-auto pr-2 custom-scrollbar text-slate-900">
                {Array.from(new Set(
                  dbStandard // SADECE STANDART TABLODAN ÇEKİYOR
                    .filter(i => i.brand.toLowerCase() === selectedBrand.toLowerCase())
                    .map(i => i.name)
                ))
                  .filter((name: any) => name.toLowerCase().includes(searchQuery.toLowerCase()))
                  .map((name: any) => (
                    <div key={name} onClick={() => { setSelectedModel(name); setStep(3); }} 
                      className="group flex items-center gap-5 p-5 border-2 border-slate-100 rounded-2xl hover:border-red-500 hover:bg-red-50/30 cursor-pointer transition-all">
                      <div className="w-20 h-20 bg-white rounded-xl shadow-sm p-2 flex items-center justify-center">
                        <img src={dbStandard.find(i => i.name === name)?.img} className="max-h-full object-contain group-hover:scale-110 transition-transform" alt={name} />
                      </div>
                      <span className="font-bold text-lg text-slate-700">{name}</span>
                    </div>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="text-center max-w-3xl mx-auto animate-in zoom-in-95 duration-500">
              <h2 className="text-3xl font-black mb-10 text-slate-800">Depolama Kapasitesi?</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                {dbStandard.filter(i => i.name === selectedModel).map(c => (
                  <button key={c.cap} onClick={() => { setSelectedCapacity(c); setStep(4); }} 
                    className="p-10 border-2 border-slate-100 rounded-[32px] hover:border-red-500 hover:bg-red-50 transition-all font-black text-3xl text-slate-700 shadow-sm">
                    {c.cap}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="max-w-5xl mx-auto animate-in fade-in duration-500">
              <h2 className="text-3xl font-black mb-8 text-slate-800 text-center">Cihaz Kondisyonu</h2>
              
              <div className="flex flex-col lg:flex-row gap-8 items-start">
                
                {/* SOL TARAF - SORULAR FORMU */}
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
                          <button key={opt} onClick={() => setAnswers({...answers, [q.id]: opt})} 
                            className={`px-4 py-3.5 rounded-xl font-semibold text-[13px] transition-all border-2 ${
                              (answers as any)[q.id] === opt 
                              ? 'bg-red-600 border-red-600 text-white shadow-md scale-[1.02]' 
                              : 'bg-white border-slate-200 text-slate-600 hover:border-red-300 hover:bg-red-50/50'}`}>
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                  
                  <div className="pt-4">
                    <button disabled={!Object.values(answers).every(a => a !== null)} onClick={() => setStep(5)} 
                      className="w-full py-6 bg-slate-900 hover:bg-slate-800 text-white rounded-[24px] font-black text-xl shadow-xl shadow-slate-200 disabled:opacity-30 disabled:shadow-none transition-all">
                      Devam Et
                    </button>
                  </div>
                </div>

                {/* SAĞ TARAF - SEÇİLEN CİHAZ ÖZETİ */}
                <div className="w-full lg:w-80 shrink-0 bg-white border-2 border-red-50 rounded-[32px] p-6 shadow-xl shadow-red-100/50 lg:sticky top-28">
                  <div className="text-center mb-6">
                     <h4 className="text-xs font-black text-red-500 uppercase tracking-widest mb-1">Seçilen Cihaz</h4>
                     <div className="w-32 h-32 mx-auto bg-slate-50 rounded-2xl p-4 mb-4 flex items-center justify-center">
                       <img src={dbStandard.find(i => i.name === selectedModel)?.img} alt={selectedModel} className="max-h-full object-contain drop-shadow-md" />
                     </div>
                     <h3 className="font-black text-xl text-slate-800 leading-tight">{selectedBrand} {selectedModel}</h3>
                     <div className="mt-3 inline-block px-4 py-1.5 bg-slate-100 rounded-full text-slate-600 font-bold text-sm">
                       {selectedCapacity?.cap} Hafıza
                     </div>
                  </div>
                  
                  <button onClick={() => setStep(1)} className="w-full mt-6 py-3 border-2 border-slate-100 text-slate-500 hover:text-red-600 hover:border-red-100 hover:bg-red-50 rounded-xl font-bold transition-all text-sm">
                    Cihazı Değiştir
                  </button>
                </div>

              </div>
            </div>
          )}

          {step === 5 && (
            <div className="max-w-xl mx-auto animate-in zoom-in-95 duration-500">
               <div className="bg-red-50 rounded-[32px] p-8 md:p-10 border-2 border-red-100 text-center">
                 <div className="w-16 h-16 bg-white text-red-500 rounded-full flex items-center justify-center text-3xl mx-auto mb-6 shadow-sm">👤</div>
                 <h2 className="text-2xl font-black text-slate-800 mb-2">Müşteri Bilgisi Gerekli</h2>
                 <p className="text-slate-500 mb-8 text-sm">Değerleme sonucunu görebilmek ve işlemi tamamlayabilmek için lütfen müşteri bilgilerini giriniz.</p>
                 
                 <div className="space-y-4 text-left">
                   <div>
                     <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 ml-2">Ad Soyad (Zorunlu)</label>
                     <input type="text" value={customerInfo.name} onChange={(e)=>setCustomerInfo({...customerInfo, name: e.target.value})} className="w-full p-5 bg-white border-2 border-slate-200 rounded-2xl outline-none focus:border-red-500 shadow-sm text-slate-900 font-bold" placeholder="Müşteri Adı Soyadı" />
                   </div>
                   <div>
                     <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 ml-2">Telefon</label>
                     <input type="tel" value={customerInfo.phone} onChange={(e)=>setCustomerInfo({...customerInfo, phone: e.target.value})} className="w-full p-5 bg-white border-2 border-slate-200 rounded-2xl outline-none focus:border-red-500 shadow-sm text-slate-900 font-bold" placeholder="Telefon Numarası" />
                   </div>
                 </div>

                 <button 
                    disabled={!customerInfo.name} 
                    onClick={() => setStep(6)} 
                    className="w-full mt-8 py-5 bg-red-600 hover:bg-red-700 text-white rounded-[20px] font-black text-lg shadow-xl shadow-red-200 disabled:opacity-40 disabled:shadow-none transition-all">
                   Fiyatı Göster ve İşlemi Tamamla
                 </button>
               </div>
            </div>
          )}

          {step === 6 && (
            <div className="text-center max-w-3xl mx-auto animate-in zoom-in-95 duration-700">
               <h2 className="text-2xl font-bold text-slate-500 mb-2">Tahmini Değer:</h2>
               
               <div className="mb-10 bg-gradient-to-br from-red-600 to-red-800 rounded-[40px] p-12 shadow-2xl relative overflow-hidden text-white">
                 <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl"></div>
                 <p className="text-red-200 font-bold mb-2 uppercase tracking-widest text-sm">{selectedBrand} {selectedModel} ({customerInfo.name})</p>
                 <div className="text-7xl font-black mb-2">{estimatedPrice.toLocaleString()} <span className="text-2xl font-light opacity-70">TL</span></div>
                 <p className="text-red-100/60 text-xs italic">*Bu tutar üzerinden işlem yapılacaktır.</p>
               </div>

               <div className="bg-slate-50 border-2 border-slate-200 rounded-[32px] p-8">
                 <h3 className="font-black text-xl mb-2 text-slate-800">İşlem Sonucunu Kaydet</h3>
                 <p className="text-red-500 font-bold text-sm mb-8">DİKKAT: Aşağıdaki butonlardan birine basılması zorunludur!</p>
                 
                 <div className="flex flex-col sm:flex-row gap-4">
                   <button onClick={() => handleStatusSubmit('ALINDI')} className="flex-1 py-6 bg-[#25D366] hover:bg-[#1ebd5b] text-white rounded-[20px] font-black text-xl shadow-xl shadow-green-200 transition-all flex flex-col items-center justify-center gap-2">
                     <span className="text-3xl">✅</span> CİHAZ ALINDI
                   </button>
                   <button onClick={() => handleStatusSubmit('ALINMADI')} className="flex-1 py-6 bg-slate-800 hover:bg-slate-900 text-white rounded-[20px] font-black text-xl shadow-xl shadow-slate-300 transition-all flex flex-col items-center justify-center gap-2">
                     <span className="text-3xl">❌</span> CİHAZ ALINMADI
                   </button>
                 </div>
               </div>
               
               <button onClick={() => setStep(0)} className="mt-8 text-slate-400 font-semibold hover:text-red-600 transition-colors underline">İptal Et ve Başa Dön</button>
            </div>
          )}

        </div>
      </main>

      <footer className="text-center py-10 text-slate-400 text-sm">
        © 2026 ZUMAY - Tüm Hakları Saklıdır.
      </footer>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #f1f1f1; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
      `}</style>
    </div>
  );
}
