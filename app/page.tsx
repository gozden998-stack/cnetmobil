"use client";
import React, { useState, useEffect } from 'react';

const SHEET_ID = '1GvagcuTfR_e66A1yxTPqaIgh4YEmYl4M7-E2oRzZhyg';
const API_KEY = 'AIzaSyD4zJB-fvZdAR5WucfwITuqpIuHgbpK2gc';
const TABLO_ISMI = 'Google Sheets ile Kurumsal Alım Sistemi'; 
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwvlMvSs-i-wEn197eeBEMLRpiUcW_A7z0nO0oA0seXzcvZ86xsNBfTzZVRmnaEwwrJ/exec';

export default function CnetmobilCmrFinalUltimate() {
  const [db, setDb] = useState<any[]>([]);
  const [brandDb, setBrandDb] = useState<any[]>([]);
  const [config, setConfig] = useState<any>({});
  const [alimlar, setAlimlar] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(1);
  const [selectedBrand, setSelectedBrand] = useState('');
  const [selectedModelName, setSelectedModelName] = useState('');
  const [selectedCapacity, setSelectedCapacity] = useState<any>(null);
  const [selectedBranch, setSelectedBranch] = useState('CMR MERKEZ');
  const [selectedColor, setSelectedColor] = useState('Diğer'); 
  
  const [searchQuery, setSearchQuery] = useState('');

  const [customer, setCustomer] = useState({ name: '', phone: '', imei: '' });
  const [status, setStatus] = useState<any>({ 
    power: null, screen: null, cosmetic: null, faceId: null, 
    battery: null, sim: null, warranty: null  
  });
  const [prices, setPrices] = useState({ cash: 0, trade: 0 });

  const [isAdmin, setIsAdmin] = useState(false);
  const [adminPass, setAdminPass] = useState('');
  const [newDevice, setNewDevice] = useState({ brand: 'Apple', name: '', cap: '', base: '', img: '', minPrice: '0' });

  // TAKSİT EKRANI STATELERİ
  const [isInstallmentModalOpen, setIsInstallmentModalOpen] = useState(false);
  const [installmentAmount, setInstallmentAmount] = useState('');

  const branches = [
    { name: "CMR CADDE", phone: "905443214534" },
    { name: "CMR MERKEZ", phone: "905416801905" },
    { name: "CMR KAPAKLI", phone: "905327005959" },
    { name: "CMR SARAY", phone: "905416801905" }
  ];

  const brandAssets: any = {
    "Apple": { logo: "https://upload.wikimedia.org/wikipedia/commons/f/fa/Apple_logo_black.svg" },
    "Samsung": { logo: "https://upload.wikimedia.org/wikipedia/commons/2/24/Samsung_Logo.svg" },
    "Huawei": { logo: "https://upload.wikimedia.org/wikipedia/commons/e/e8/Huawei_logo.svg" },
    "Xiaomi": { logo: "https://upload.wikimedia.org/wikipedia/commons/a/ae/Xiaomi_logo_%282021-%29.svg" },
    "Oppo": { logo: "https://upload.wikimedia.org/wikipedia/commons/0/0d/Oppo_Logo.svg" },
    "Realme": { logo: "https://upload.wikimedia.org/wikipedia/commons/1/1a/Realme-Logo.png" },
    "Vivo": { logo: "https://upload.wikimedia.org/wikipedia/commons/e/e5/Vivo_logo.svg" },
    "Macbook": { logo: "https://www.freeiconspng.com/thumbs/laptop-icon/apple-laptop-icon-14.png" }
  };

  const resetAll = () => {
    setStep(1);
    setSelectedBrand('');
    setSelectedModelName('');
    setSelectedCapacity(null);
    setSelectedColor('Diğer');
    setSearchQuery(''); 
    setCustomer({ name: '', phone: '', imei: '' });
    setStatus({ power: null, screen: null, cosmetic: null, faceId: null, battery: null, sim: null, warranty: null });
    setIsAdmin(false);
    if(typeof window !== 'undefined') window.scrollTo(0,0);
  };

  const resetSelection = () => {
    setSelectedCapacity(null);
    setSelectedColor('Diğer');
    setSearchQuery(''); 
    setStatus({ power: null, screen: null, cosmetic: null, faceId: null, battery: null, sim: null, warranty: null });
    if(typeof window !== 'undefined') window.scrollTo(0,0);
  };

  const loadData = async () => {
    try {
      const deviceUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(TABLO_ISMI)}!A2:F1000?key=${API_KEY}`;
      const devRes = await fetch(deviceUrl);
      const devData = await devRes.json();
      
      const configUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Ayarlar!A1:B25?key=${API_KEY}`;
      const confRes = await fetch(configUrl);
      const confData = await confRes.json();
      
      const alimRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Alimlar!A2:H500?key=${API_KEY}`);
      const alimData = await alimRes.json();

      let brandData: any = {};
      try {
        const brandRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Markalar!A2:B50?key=${API_KEY}`);
        brandData = await brandRes.json();
      } catch (e) { console.warn("Markalar tablosu henüz oluşturulmamış olabilir."); }

      if (devData.values) {
        setDb(devData.values.map((row: any) => ({
          brand: row[0] || '', name: row[1] || '', cap: row[2] || '',
          base: parseInt(row[3]) || 0, img: row[4]?.trim() || '', minPrice: parseInt(row[5]) || 0
        })));
      }
      if (confData.values) {
        const m: any = {};
        confData.values.forEach((row: any) => { m[row[0]] = parseFloat(row[1]); });
        setConfig(m);
      }
      if (alimData.values) {
        setAlimlar(alimData.values.map((val: any, index: number) => ({ data: val, sheetIndex: index + 2 })));
      }
      if (brandData.values) {
        setBrandDb(brandData.values.map((row: any) => ({ name: row[0], logo: row[1] })));
      }
      setLoading(false);
    } catch (e) { setLoading(false); }
  };

  useEffect(() => { loadData(); }, [step]);

  useEffect(() => {
    if (selectedCapacity && config.Guc_Yok !== undefined) {
      let price = selectedCapacity.base;
      if (status.power === 'Hayır') price *= (1 - ((config.Guc_Yok || 0) / 100));
      if (status.screen === 'Kırık / Orijinal Değil') price *= (1 - ((config.Ekran_Kirik || 0) / 100));
      if (status.screen === 'Çizikler var') price *= (1 - ((config.Ekran_Cizik || 0) / 100));
      if (status.cosmetic === 'İyi') price *= (1 - ((config.Kasa_Iyi || 0) / 100));
      if (status.cosmetic === 'Kötü') price *= (1 - ((config.Kasa_Kotu || 0) / 100));
      if (status.faceId === 'Hayır') price *= (1 - ((config.FaceID_Bozuk || 0) / 100));
      if (status.battery === '0-85') price *= (1 - ((config.Pil_Dusuk || 0) / 100));
      if (status.battery === 'Bilinmeyen Parça') price *= (1 - ((config.Bilinmeyen_Batarya || 15) / 100));
      if (status.sim === 'Fiziksel + eSIM (YD)') price *= (1 - ((config.Yurt_Disi || 0) / 100));
      if (status.warranty === 'Yenilenmiş Cihaz') price *= (1 - ((config.Yenilenmis || 0) / 100));
      if (status.warranty === 'Garanti Yok') price *= (1 - ((config.Garanti_Yok || 0) / 100));

      let colorBonus = 1;
      
      const isPerfectCondition = 
        status.cosmetic === 'Mükemmel' && 
        status.screen === 'Sağlam' && 
        (status.battery === '95-100' || status.battery === '85-95');

      if (selectedModelName === "iPhone 13" && selectedColor === 'Beyaz' && isPerfectCondition) {
        colorBonus = 1.05; 
      }

      const finalCash = Math.max(Math.round(price * colorBonus), selectedCapacity.minPrice || 0);
      const finalTrade = Math.round(finalCash * (1 + ((config.Takas_Destegi || 0) / 100)));
      setPrices({ cash: finalCash, trade: finalTrade });
    }
  }, [status, selectedCapacity, config, selectedColor, selectedModelName]);

  const handleFinalProcess = async (actionType: 'print' | 'whatsapp' | 'ALINDI' | 'ALINMADI') => {
    const now = new Date();
    const dateTime = `${now.toLocaleDateString('tr-TR')} ${now.toLocaleTimeString('tr-TR', {hour:'2-digit', minute:'2-digit'})}`;
    
    const statusLabel = (actionType === 'ALINDI' || actionType === 'ALINMADI') ? ` [${actionType}]` : "";
    const colorLabel = selectedModelName === "iPhone 13" ? ` - Renk: ${selectedColor}` : "";

    try {
      await fetch(SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        body: JSON.stringify({
          type: "SAVE_ALIM",
          branch: selectedBranch,
          customer: customer.name,
          device: `${selectedModelName} (${selectedCapacity?.cap})${colorLabel}${statusLabel}`,
          imei: customer.imei,
          cash: prices.cash,
          trade: prices.trade,
          date: dateTime
        })
      });

      if(actionType === 'ALINDI' || actionType === 'ALINMADI') {
         alert(`İşlem Yönetim Paneline Bildirildi: ${actionType}`);
      }
      loadData();
    } catch (e) { console.error(e); }

    if (actionType === 'print') {
      window.print();
    } else if (actionType === 'whatsapp') {
      const branch = branches.find(b => b.name === selectedBranch);
      const message = `📱 *CMR CİHAZ ALIM FORMU*%0A👤 *Müşteri:* ${customer.name}%0A🆔 *IMEI:* ${customer.imei}%0A📦 *Cihaz:* ${selectedModelName} (${selectedCapacity?.cap})${colorLabel}%0A💰 *NAKİT:* ${prices.cash.toLocaleString()} TL%0A🔄 *TAKAS:* ${prices.trade.toLocaleString()} TL`;
      window.open(`https://wa.me/${branch?.phone}?text=${message}`, '_blank');
    }
  };

  const deleteAlim = async (sheetIdx: number) => {
    if(!confirm("Bu işlemi silmek istiyor musunuz?")) return;
    setAlimlar(prev => prev.filter(item => item.sheetIndex !== sheetIdx));
    try {
      await fetch(SCRIPT_URL, { 
        method: 'POST', 
        mode: 'no-cors', 
        body: JSON.stringify({ type: "DELETE_ALIM", index: sheetIdx }) 
      });
      setTimeout(loadData, 2000);
    } catch (e) { console.error(e); }
  };

  const deleteAllAlimlar = async () => {
    if(!confirm("DİKKAT! Tüm alım geçmişi silinecek. Onaylıyor musunuz?")) return;
    try {
      await fetch(SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify({ type: "DELETE_ALL_ALIM" }) });
      alert("Tüm geçmiş temizlendi.");
      loadData();
    } catch (e) { console.error(e); }
  };

  const updateConfig = async (key: string, val: string) => {
    try {
      await fetch(SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify({ type: "UPDATE_CONFIG", key, val }) });
      alert(`${key} Güncellendi!`);
      setConfig((prev: any) => ({...prev, [key]: parseFloat(val)}));
    } catch (e) { console.error(e); }
  };

  const adminAddDevice = async () => {
    if(!newDevice.name || !newDevice.base) return alert("Eksik bilgi!");
    try {
      await fetch(SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify({ type: "ADD_DEVICE", ...newDevice }) });
      alert("Cihaz başarıyla eklendi!");
      setNewDevice({ brand: 'Apple', name: '', cap: '', base: '', img: '', minPrice: '0' });
      setTimeout(loadData, 1500);
    } catch (e) { console.error(e); }
  };

  const isYd = status.sim === 'Fiziksel + eSIM (YD)';
  const allSelected = Object.values(status).every(v => v !== null) && selectedCapacity;
  const canProceed = allSelected;

  if (loading) return (
    <div className="h-screen flex flex-col items-center justify-center bg-white space-y-4">
      <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      <div className="font-black text-slate-900 italic uppercase tracking-[0.3em]">CMR SISTEMI YUKLENIYOR</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-20 font-sans text-slate-900 selection:bg-blue-100 relative">
      <style>{`
        #print-area { display: none !important; }
        @media print {
          header, main, footer, .print\\:hidden { display: none !important; }
          #print-area { display: block !important; visibility: visible !important; position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; background: white !important; color: black !important; margin: 0 !important; padding: 40px !important; }
          #print-area * { visibility: visible !important; }
        }
        .btn-click { transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); cursor: pointer; }
        .btn-click:active { transform: scale(0.96); }
        .btn-disabled { opacity: 0.2; cursor: not-allowed !important; pointer-events: none; grayscale: 100%; }
        .card-shadow { box-shadow: 0 10px 25px -5px rgba(0,0,0,0.05), 0 8px 10px -6px rgba(0,0,0,0.05); }
        .glass { background: rgba(255, 255, 255, 0.8); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
      `}</style>

      {/* HEADER */}
      <header className="px-6 py-4 glass border-b border-slate-200/60 flex justify-between items-center sticky top-0 z-50 print:hidden card-shadow">
        <div onClick={resetAll} className="flex items-center gap-2 group cursor-pointer">
          <div className="bg-blue-600 p-1.5 rounded-lg group-hover:rotate-12 transition-transform">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
          </div>
          <h1 className="text-xl font-black italic text-slate-900 uppercase tracking-tighter">
            CNET<span className="text-blue-600">MOBIL</span> <span className="font-light text-slate-400 not-italic ml-1">CMR</span>
          </h1>
        </div>
        
        <div className="flex items-center gap-3 md:gap-4">
          <div className="hidden md:flex items-center gap-1.5 bg-green-50 px-3 py-1.5 rounded-full border border-green-200 shadow-sm">
            <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            <span className="text-[10px] font-black text-green-700 uppercase tracking-widest">CNETMOBİL'DE GÜVENDESİNİZ</span>
          </div>

          <button 
            onClick={() => setIsInstallmentModalOpen(true)} 
            className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-xl shadow-lg shadow-slate-200 transition-colors btn-click"
          >
            <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
            <span className="text-[10px] font-black uppercase tracking-widest hidden sm:block">TAKSİT HESAPLA</span>
          </button>

          <button onClick={() => setStep(99)} className="text-[10px] font-bold uppercase text-slate-400 hover:text-blue-600 transition-colors">YÖNETİCİ</button>
          <div className="relative">
            <select value={selectedBranch} onChange={(e) => setSelectedBranch(e.target.value)} className="appearance-none bg-slate-100 hover:bg-slate-200 px-4 py-2.5 pr-8 rounded-xl text-[10px] font-black outline-none border-none transition-colors">
              {branches.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
            </select>
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
               <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7" strokeWidth={3} /></svg>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 mt-4 print:hidden">
        {step === 99 ? (
           <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
             {!isAdmin ? (
               <div className="max-w-md mx-auto bg-white p-12 rounded-[48px] shadow-2xl text-center border border-slate-100">
                 <div className="w-16 h-16 bg-slate-100 rounded-3xl flex items-center justify-center mx-auto mb-6">
                    <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 00-2 2zM9 11V7a3 3 0 016 0v4" /></svg>
                 </div>
                 <h2 className="text-xl font-black italic mb-8 uppercase tracking-widest text-slate-900">Admin Girişi</h2>
                 <input type="password" placeholder="••••••••" className="w-full p-5 bg-slate-50 rounded-2xl mb-4 text-center font-black outline-none border border-slate-200 focus:border-blue-500 transition-all" onChange={(e) => setAdminPass(e.target.value)} />
                 <button onClick={() => adminPass === 'cnet1905' ? setIsAdmin(true) : alert("Hatalı!")} className="bg-slate-900 text-white px-10 py-5 rounded-2xl font-black uppercase w-full btn-click shadow-xl shadow-slate-200">SISTEME GIRIS YAP</button>
               </div>
             ) : (
               <div className="space-y-10">
                 <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                    <div className="bg-white p-10 rounded-[40px] shadow-sm border border-slate-100">
                      <h2 className="text-xs font-black italic text-orange-600 mb-6 uppercase tracking-widest flex items-center gap-2">
                        <span className="w-2 h-2 bg-orange-600 rounded-full animate-pulse"></span>
                        Fiyat Kesinti Oranları (%)
                      </h2>
                      <div className="space-y-4 max-h-[500px] overflow-y-auto pr-4 custom-scrollbar">
                        {Object.keys(config).map(key => (
                          <div key={key} className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl gap-4">
                            <span className="text-[11px] font-bold text-slate-500 uppercase flex-1">{key.replace(/_/g,' ')}</span>
                            <div className="flex items-center gap-2">
                              <div className="relative">
                                <input type="number" className="w-20 p-3 bg-white border border-slate-200 rounded-xl text-right font-black text-blue-600 outline-none" 
                                  value={config[key]} 
                                  onChange={(e) => setConfig({...config, [key]: e.target.value})}
                                />
                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[9px] font-black text-slate-300">%</span>
                              </div>
                              <button onClick={() => updateConfig(key, config[key])} className="bg-green-500 text-white p-3 rounded-xl hover:bg-green-600 transition-colors shadow-sm">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="bg-white p-10 rounded-[40px] shadow-sm border border-slate-100">
                      <h2 className="text-xs font-black italic text-blue-600 mb-6 uppercase tracking-widest flex items-center gap-2">
                         <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
                         Sisteme Cihaz Tanımla
                      </h2>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-3">
                          <input placeholder="Marka (Örn: Apple)" className="w-full p-4 bg-slate-50 rounded-2xl text-xs font-black border border-slate-100 outline-none" value={newDevice.brand} onChange={(e)=>setNewDevice({...newDevice, brand: e.target.value})} />
                          <input placeholder="Model (Örn: iPhone 15 Pro)" className="w-full p-4 bg-slate-50 rounded-2xl text-xs font-black border border-slate-100 outline-none" value={newDevice.name} onChange={(e)=>setNewDevice({...newDevice, name: e.target.value})} />
                          <input placeholder="Hafıza (Örn: 128 GB)" className="w-full p-4 bg-slate-50 rounded-2xl text-xs font-black border border-slate-100 outline-none" value={newDevice.cap} onChange={(e)=>setNewDevice({...newDevice, cap: e.target.value})} />
                        </div>
                        <div className="space-y-3">
                          <input placeholder="Max Alış Fiyatı (TL)" className="w-full p-4 bg-slate-50 rounded-2xl text-xs font-black border border-slate-100 outline-none" value={newDevice.base} onChange={(e)=>setNewDevice({...newDevice, base: e.target.value})} />
                          <input placeholder="Minimum Alış Fiyatı (TL)" className="w-full p-4 bg-slate-50 rounded-2xl text-xs font-black border border-slate-100 outline-none" value={newDevice.minPrice} onChange={(e)=>setNewDevice({...newDevice, minPrice: e.target.value})} />
                          <input placeholder="Cihaz Görsel Linki (URL)" className="w-full p-4 bg-slate-50 rounded-2xl text-xs font-black border border-slate-100 outline-none" value={newDevice.img} onChange={(e)=>setNewDevice({...newDevice, img: e.target.value})} />
                        </div>
                      </div>
                      <button onClick={adminAddDevice} className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black uppercase text-xs btn-click shadow-lg shadow-blue-100 mt-6">CİHAZI VERİTABANINA EKLE</button>
                    </div>
                 </div>

                 <div className="bg-white p-10 rounded-[40px] shadow-sm border border-slate-100">
                   <div className="flex justify-between items-center border-b-2 border-slate-900 pb-4 mb-8">
                      <h2 className="text-xl font-black italic uppercase tracking-tighter">GÜNCEL ALIM KAYITLARI</h2>
                      <button onClick={deleteAllAlimlar} className="bg-red-50 text-red-600 px-6 py-2 rounded-xl text-[10px] font-black hover:bg-red-600 hover:text-white transition-all uppercase border border-red-100">Tüm Geçmişi Temizle</button>
                   </div>
                   <div className="space-y-4 max-h-[600px] overflow-y-auto pr-4 custom-scrollbar">
                     {[...alimlar].reverse().map((item, i) => (
                       <div key={i} className="bg-slate-50 p-6 rounded-3xl border border-slate-100 flex justify-between items-center text-xs hover:bg-white hover:shadow-md transition-all">
                         <div className="flex flex-col gap-1">
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{item.data[7] || 'Tarih Yok'}</span>
                            <p className="font-black text-slate-900 text-sm uppercase">{item.data[1]}</p>
                            <p className="text-slate-500 font-medium">{item.data[3]} - {item.data[2]}</p>
                            <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded-md text-[9px] font-black w-fit mt-1 uppercase">{item.data[0]}</span>
                         </div>
                         <div className="flex items-center gap-6">
                            <div className="text-right">
                               <p className="text-[10px] text-slate-400 font-black uppercase">Fiyat</p>
                               <p className="font-black text-lg italic text-slate-900">{parseInt(item.data[5]||0).toLocaleString()} TL</p>
                            </div>
                            <button onClick={() => deleteAlim(item.sheetIndex)} className="text-red-500 hover:bg-red-50 p-3 rounded-2xl transition-all">
                               <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                         </div>
                       </div>
                     ))}
                   </div>
                 </div>
                 <button onClick={() => {setStep(1); setIsAdmin(false);}} className="w-full py-6 bg-slate-900 text-white rounded-[32px] font-black uppercase text-sm btn-click shadow-2xl">YÖNETİCİ MODUNDAN ÇIK</button>
               </div>
             )}
           </div>
        ) : step === 1 ? (
           <div className="space-y-12">
             <div className="text-center space-y-4 mb-16 animate-in fade-in slide-in-from-top-4 duration-700">
                <h2 className="text-5xl md:text-7xl font-black italic tracking-tighter text-slate-900 uppercase">
                  CIHAZ <span className="text-blue-600">ALIM</span> SISTEMI
                </h2>
                <p className="text-slate-400 font-bold uppercase tracking-[0.2em] text-xs">Lütfen işlem yapılacak markayı seçin</p>
             </div>
             <div className="grid grid-cols-2 md:grid-cols-4 gap-8 animate-in fade-in zoom-in duration-700 delay-200">
               {Array.from(new Set([...brandDb.map(b => b.name), ...db.map(i => i.brand)]))
                 .filter(brand => brand && brand.trim() !== "" && brand.toLowerCase() !== "marka")
                 .map(brand => {
                 const brandInfo = brandDb.find(b => b.name === brand);
                 const hasModels = db.some(i => i.brand === brand);
                 const finalLogo = brandInfo?.logo || brandAssets[brand]?.logo || "";

                 return (
                   <div key={brand} 
                        onClick={() => {
                          if(hasModels) {
                            setSelectedBrand(brand); 
                            setStep(2); 
                            resetSelection();
                          }
                        }} 
                        className={`bg-white p-10 rounded-[48px] shadow-sm border border-slate-100/50 flex flex-col items-center justify-center text-center h-72 group transition-all ${hasModels ? 'hover:shadow-2xl hover:scale-[1.05] cursor-pointer btn-click' : 'opacity-60 cursor-not-allowed grayscale'}`}>
                     <div className="h-24 w-full flex items-center justify-center mb-8 transition-all duration-500 transform group-hover:scale-110">
                       <img src={finalLogo} className="max-h-full max-w-[140px] object-contain" alt={brand} />
                     </div>
                     <h2 className="font-black text-xl mb-1 uppercase italic tracking-tighter text-slate-800">{brand}</h2>
                     <p className={`text-[10px] font-black uppercase tracking-widest ${hasModels ? 'text-slate-400' : 'text-orange-600 animate-pulse'}`}>
                        {hasModels ? `${brand} CİHAZINI SAT` : 'ÇOK YAKINDA'}
                     </p>
                     
                     <div className={`w-10 h-1 transition-all rounded-full mt-3 ${hasModels ? 'bg-slate-100 group-hover:w-20 group-hover:bg-blue-600' : 'bg-slate-200'}`}></div>
                   </div>
                 );
               })}
             </div>
           </div>
        ) : step === 2 ? (
           <div className="animate-in slide-in-from-right-8 duration-500">
             <div className="flex items-center justify-between mb-8">
                <button onClick={() => {setStep(1); resetSelection();}} className="bg-white shadow-sm border border-slate-200 px-6 py-3 rounded-2xl text-[10px] font-black uppercase text-slate-500 hover:text-blue-600 transition-all btn-click flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg>
                  Geri Dön
                </button>
                <div className="text-right">
                  <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">{selectedBrand}</span>
                  <h2 className="text-2xl font-black italic uppercase tracking-tighter">Model Seçimi</h2>
                </div>
             </div>

             <div className="flex justify-center mb-10">
               <div className="relative w-full max-w-xl">
                 <input
                   type="text"
                   placeholder="Modellerde ara..."
                   value={searchQuery}
                   onChange={(e) => setSearchQuery(e.target.value)}
                   className="w-full p-5 pl-14 bg-white rounded-3xl text-sm font-black border border-slate-200 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50 shadow-sm transition-all text-slate-700 placeholder-slate-400"
                 />
                 <svg className="w-6 h-6 absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
               </div>
             </div>

             <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
               {Array.from(new Set(db.filter(i => i.brand === selectedBrand).map(i => i.name)))
                 .filter(name => name.toLowerCase().includes(searchQuery.toLowerCase()))
                 .map(name => (
                   <div key={name} onClick={() => {setSelectedModelName(name); setStep(3); resetSelection();}} className="bg-white p-8 rounded-[40px] shadow-sm cursor-pointer hover:shadow-xl hover:border-blue-500/50 border-2 border-transparent transition-all text-center btn-click group flex flex-col items-center justify-between min-h-[220px]">
                     <div className="h-32 flex items-center justify-center mb-4 transform group-hover:scale-110 transition-transform duration-500">
                        <img src={db.find(i => i.name === name)?.img} className="max-h-full object-contain drop-shadow-2xl" />
                     </div>
                     
                     <div className="w-full">
                       <p className="font-black text-[12px] uppercase text-slate-800 tracking-tighter leading-tight">{name}</p>
                       <p className="text-[9px] font-bold text-slate-400 mt-2 uppercase tracking-widest">TELEFONUNU SAT</p>
                     </div>
                   </div>
                 ))}
             </div>
             
             {Array.from(new Set(db.filter(i => i.brand === selectedBrand).map(i => i.name))).filter(name => name.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
               <div className="text-center py-20">
                 <p className="text-slate-400 font-bold uppercase tracking-widest">Aradığınız model bulunamadı</p>
               </div>
             )}
           </div>
        ) : (
          <div className="flex flex-col lg:flex-row gap-10 animate-in fade-in duration-700">
            <div className="flex-1 space-y-6">
              <button onClick={() => {setStep(2); resetSelection();}} className="bg-white shadow-sm border border-slate-200 px-6 py-3 rounded-2xl text-[10px] font-black uppercase text-slate-500 hover:text-blue-600 transition-all btn-click flex items-center gap-2">
                 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg>
                 Modellere Dön
              </button>

              <div className="bg-white p-10 rounded-[48px] shadow-sm border border-slate-100 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none group-hover:scale-150 transition-transform duration-1000">
                   <svg className="w-40 h-40 text-red-600" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L1 21h22L12 2zm0 3.45L19.53 19H4.47L12 5.45zM11 16h2v2h-2v-2zm0-7h2v5h-2V9z"/></svg>
                </div>
                
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-10">
                  <div>
                    <h3 className="text-xl font-black italic tracking-tighter text-slate-900 uppercase">EKSPERTİZ & GÜVENLİK</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Lütfen tüm bilgileri eksiksiz doldurun</p>
                  </div>
                  {customer.imei.length === 15 && (
                    <button type="button" onClick={() => window.open(`https://www.turkiye.gov.tr/imei-sorgulama`, '_blank')} className="bg-blue-600 text-white px-6 py-3 rounded-2xl text-[10px] font-black animate-pulse hover:bg-blue-700 transition-all flex items-center gap-2 shadow-lg shadow-blue-200">
                      BTK IMEI SORGULA
                    </button>
                  )}
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-400 ml-4 uppercase">Müşteri Adı Soyadı</label>
                      <input placeholder="Ad Soyad" className="w-full p-5 bg-slate-50 rounded-2xl text-xs outline-none border border-slate-100 font-black uppercase focus:bg-white focus:border-blue-500 transition-all" value={customer.name} onChange={(e)=>setCustomer({...customer, name: e.target.value})} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-400 ml-4 uppercase">İletişim Numarası</label>
                      <input placeholder="05XX XXX XX XX" className="w-full p-5 bg-slate-50 rounded-2xl text-xs outline-none border border-slate-100 font-black focus:bg-white focus:border-blue-500 transition-all" value={customer.phone} onChange={(e)=>setCustomer({...customer, phone: e.target.value})} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-400 ml-4 uppercase">IMEI Numarası (15 Hane)</label>
                      <input placeholder="IMEI Giriniz" className="w-full p-5 bg-slate-50 rounded-2xl text-xs outline-none border border-slate-100 font-black uppercase focus:bg-white focus:border-blue-500 transition-all" value={customer.imei} maxLength={15} onChange={(e) => setCustomer({...customer, imei: e.target.value.replace(/\D/g, '')})} />
                    </div>
                  </div>

                  <div className="bg-red-50/50 p-8 rounded-[32px] border border-red-100/50 space-y-4">
                    <p className="text-[10px] font-black text-red-700 uppercase italic tracking-widest flex items-center gap-2">
                       <span className="w-2 h-2 bg-red-600 rounded-full animate-ping"></span>
                       Personel Onay Listesi
                    </p>
                    {[
                      "Hesaplardan çıkış yapıldı",
                      "Bul (Find My) kapatıldı",
                      "Kayıt durumu kontrol edildi",
                      "Şifreler tamamen silindi"
                    ].map((item, idx) => (
                      <label key={idx} className="flex items-center gap-4 cursor-pointer group select-none">
                        <input type="checkbox" className="w-5 h-5 accent-red-600 rounded-lg cursor-pointer" />
                        <span className="text-[11px] font-black text-slate-600 group-hover:text-red-700 transition-colors uppercase italic">{item}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-100">
                  <p className="text-[10px] font-black mb-6 text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <span className="w-4 h-[2px] bg-blue-600"></span>
                    Hafıza Kapasitesi
                  </p>
                  <div className="flex flex-wrap gap-3">
                    {db.filter(i => i.name === selectedModelName).map(c => (
                      <button key={c.cap} onClick={() => setSelectedCapacity(c)} className={`px-10 py-5 rounded-2xl font-black text-[11px] transition-all btn-click ${selectedCapacity?.cap === c.cap ? 'bg-blue-600 text-white shadow-xl shadow-blue-100 ring-4 ring-blue-50' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}>{c.cap}</button>
                    ))}
                  </div>
                </div>

                {selectedModelName === "iPhone 13" && (
                  <div className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-100">
                    <p className="text-[10px] font-black mb-6 text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <span className="w-4 h-[2px] bg-blue-600"></span>
                      Renk Seçimi (Beyaz +%5)
                    </p>
                    <div className="flex flex-wrap gap-3">
                      {['Diğer', 'Beyaz'].map(color => (
                        <button key={color} onClick={() => setSelectedColor(color)} className={`px-10 py-5 rounded-2xl font-black text-[11px] transition-all btn-click ${selectedColor === color ? 'bg-slate-900 text-white shadow-xl ring-4 ring-slate-100' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}>{color}</button>
                      ))}
                    </div>
                    <p className="text-[9px] text-orange-600 font-bold mt-3">* %5 prim sadece mükemmel durumdaki (Kozmetik: Mükemmel, Ekran: Sağlam, Pil: 85+) cihazlar için geçerlidir.</p>
                  </div>
                )}

                {[
                  { label: "Cihaz Açılıyor mu?", field: "power", opts: ['Evet', 'Hayır'] },
                  { label: "Garanti ve Durum", field: "warranty", opts: ['Üretici Garantili', 'Yenilenmiş Cihaz', 'Garanti Yok'] },
                  { label: "Ekran Durumu", field: "screen", opts: ['Sağlam', 'Çizikler var', 'Kırık / Orijinal Değil'] },
                  { label: "Kozmetik Durum", field: "cosmetic", opts: ['Mükemmel', 'İyi', 'Kötü'] },
                  { label: "Face ID / Touch ID", field: "faceId", opts: ['Evet', 'Hayır'] },
                  { label: "Batarya Sağlığı", field: "battery", opts: ['95-100', '85-95', '0-85', 'Bilinmeyen Parça'] },
                  { label: "Kayıt Durumu", field: "sim", opts: ['Fiziksel SIM (TR)', 'Fiziksel + eSIM (YD)'] }
                ].map(q => (
                  <div key={q.field} className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-100">
                    <p className="text-[10px] font-black mb-4 text-slate-400 uppercase tracking-widest">{q.label}</p>
                    <div className="flex flex-wrap gap-3">
                      {q.opts.map((opt) => (
                        <button key={opt} onClick={() => setStatus({...status, [q.field]: opt})} className={`py-4 px-6 rounded-2xl text-[10px] font-black border-2 transition-all btn-click ${status[q.field] === opt ? 'bg-slate-900 text-white border-slate-900 shadow-xl' : 'bg-white text-slate-400 border-slate-100 hover:border-slate-200 hover:text-slate-600'}`}>{opt}</button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:w-96 space-y-6 sticky top-28 h-fit">
              {isYd ? (
                <div className="bg-red-600 p-10 rounded-[48px] shadow-2xl text-white text-center border-b-[12px] border-red-800 animate-pulse">
                  <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-6 text-3xl">⚠️</div>
                  <p className="text-2xl font-black uppercase italic leading-none tracking-tighter">YURT DIŞI CIHAZ</p>
                  <p className="text-[10px] mt-4 uppercase tracking-[0.2em] font-black opacity-80">BU CIHAZ ICIN YONETICI ONAYI GEREKLIDIR</p>
                </div>
              ) : (
                <div className="space-y-6 animate-in zoom-in-95 duration-500">
                  <div className="bg-white p-10 rounded-[48px] shadow-xl border border-slate-100 text-center group transition-all hover:scale-[1.02]">
                    <p className="text-[11px] font-black text-slate-400 uppercase mb-4 tracking-widest italic">Nakit Alış Teklifi</p>
                    <div className="text-4xl font-black italic tracking-tighter text-slate-950">
                       {selectedCapacity && allSelected ? `${prices.cash.toLocaleString()} TL` : '---'}
                    </div>
                    <div className="h-1.5 w-16 bg-blue-600 mx-auto mt-6 rounded-full opacity-20 group-hover:opacity-100 transition-opacity"></div>
                  </div>
                  
                  <div className="bg-blue-600 p-10 rounded-[48px] shadow-2xl text-center text-white relative overflow-hidden group hover:scale-[1.02] transition-all">
                    <p className="text-[11px] font-black text-blue-200 uppercase mb-4 tracking-widest italic">Takas Desteği İle</p>
                    <div className="text-4xl font-black italic tracking-tighter">
                       {selectedCapacity && allSelected ? `${prices.trade.toLocaleString()} TL` : '---'}
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-slate-900 p-10 rounded-[48px] space-y-4 shadow-2xl">
                <button disabled={!canProceed} onClick={() => handleFinalProcess('print')} className={`w-full py-6 rounded-2xl font-black uppercase text-[11px] tracking-widest transition-all btn-click flex items-center justify-center gap-3 shadow-lg ${canProceed ? 'bg-white text-slate-950 hover:bg-slate-50' : 'btn-disabled bg-slate-800 text-slate-600'}`}>
                   SÖZLEŞMEYİ YAZDIR
                </button>
                <button disabled={!canProceed} onClick={() => handleFinalProcess('whatsapp')} className={`w-full py-6 rounded-2xl font-black uppercase text-[11px] tracking-widest transition-all btn-click flex items-center justify-center gap-3 shadow-lg ${canProceed ? 'bg-green-600 text-white hover:bg-green-700 shadow-green-900/40' : 'btn-disabled bg-slate-800 text-slate-600'}`}>
                   WHATSAPP & KAYDET
                </button>

                <div className="pt-4 mt-2 border-t border-slate-800 flex gap-3">
                    <button 
                        disabled={!canProceed} 
                        onClick={() => handleFinalProcess('ALINDI')} 
                        className={`flex-1 py-4 rounded-xl font-black uppercase text-[10px] transition-all btn-click ${canProceed ? 'bg-emerald-500 text-white hover:bg-emerald-600' : 'btn-disabled bg-slate-800 text-slate-600'}`}>
                        ✓ ALINDI
                    </button>
                    <button 
                        disabled={!canProceed} 
                        onClick={() => handleFinalProcess('ALINMADI')} 
                        className={`flex-1 py-4 rounded-xl font-black uppercase text-[10px] transition-all btn-click ${canProceed ? 'bg-rose-500 text-white hover:bg-rose-600' : 'btn-disabled bg-slate-800 text-slate-600'}`}>
                        ✕ ALINMADI
                    </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* YENİ VE DAHA PROFESYONEL TAKSİT HESAPLAYICI MODAL'I */}
      {isInstallmentModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/80 backdrop-blur-md print:hidden p-4">
          <div className="bg-white rounded-[40px] shadow-2xl p-8 w-full max-w-4xl relative animate-in fade-in zoom-in duration-300 border border-slate-100 flex flex-col max-h-[90vh]">
            
            {/* Modal Başlık Bölümü */}
            <div className="flex justify-between items-center mb-8 border-b border-slate-100 pb-6 shrink-0">
              <div className="flex items-center gap-4">
                <div className="bg-blue-50 text-blue-600 w-12 h-12 rounded-2xl flex items-center justify-center">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
                </div>
                <div>
                  <h2 className="text-2xl font-black italic text-slate-900 uppercase tracking-tighter">Taksit Hesaplama</h2>
                  <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mt-1">Özel Oranlar (+%2 Komisyon Dahil)</p>
                </div>
              </div>
              <button 
                onClick={() => { setIsInstallmentModalOpen(false); setInstallmentAmount(''); }} 
                className="bg-slate-100 p-3 rounded-2xl text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all btn-click"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            {/* Tutar Giriş Bölümü */}
            <div className="mb-8 shrink-0">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none">
                  <span className="text-slate-400 font-black text-xl">₺</span>
                </div>
                <input
                  type="number"
                  placeholder="İşlem Tutarını Giriniz..."
                  value={installmentAmount}
                  onChange={(e) => setInstallmentAmount(e.target.value)}
                  className="w-full py-6 pl-12 pr-6 bg-slate-50 rounded-3xl text-2xl font-black border border-slate-200 outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all text-slate-800"
                />
              </div>
            </div>

            {/* Taksit Listesi (İki Sütunlu Izgara Yapısı) */}
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 pb-4">
              {installmentAmount && Number(installmentAmount) > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    // GÖRSELDEN ALINAN ORANLAR (İçeride %2 eklenecek)
                    { month: 2, baseRate: 3.23 },
                    { month: 3, baseRate: 5.00 },
                    { month: 4, baseRate: 6.97 },
                    { month: 5, baseRate: 8.83 },
                    { month: 6, baseRate: 10.60 },
                    { month: 7, baseRate: 12.57 },
                    { month: 8, baseRate: 14.44 },
                    { month: 9, baseRate: 16.31 },
                    { month: 10, baseRate: 18.18 },
                    { month: 11, baseRate: 20.05 },
                    { month: 12, baseRate: 21.92 },
                  ].map((inst) => {
                    const totalPercentage = inst.baseRate + 2; // Gelen orana %2 kâr eklemesi
                    const multiplier = 1 + (totalPercentage / 100);
                    const total = Number(installmentAmount) * multiplier;
                    const monthly = total / inst.month;
                    
                    return (
                      <div key={inst.month} className="flex justify-between items-center bg-white p-6 rounded-[28px] border border-slate-200 shadow-sm hover:border-blue-400 hover:shadow-lg transition-all group cursor-default">
                        <div className="flex items-center gap-5">
                          <div className="bg-slate-900 group-hover:bg-blue-600 transition-colors text-white w-14 h-14 flex flex-col items-center justify-center rounded-[20px] shadow-md">
                            <span className="font-black text-xl leading-none">{inst.month}</span>
                            <span className="text-[9px] font-bold uppercase tracking-widest mt-0.5 opacity-80">Taksit</span>
                          </div>
                          <div>
                            <div className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              Maliyet: %{totalPercentage.toFixed(2)}
                            </div>
                            <div className="text-xl font-black italic text-slate-900 tracking-tighter">
                              {monthly.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL
                            </div>
                          </div>
                        </div>
                        <div className="text-right border-l border-slate-100 pl-5">
                          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                            Toplam
                          </div>
                          <div className="text-lg font-black text-slate-700">
                            {total.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center opacity-40 py-10">
                  <svg className="w-20 h-20 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <p className="text-lg font-black uppercase tracking-widest text-center">Hesaplama için<br/>tutar giriniz</p>
                </div>
              )}
            </div>
            
          </div>
        </div>
      )}

      <footer className="max-w-6xl mx-auto px-6 py-10 text-center print:hidden">
        <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.5em]">CNETMOBIL • CMR TERMINAL v4.0.0</p>
      </footer>

      <div id="print-area">
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'20px'}}>
            <div>
              <h1 style={{fontSize:'36px', fontWeight:'900', fontStyle:'italic', margin:0, letterSpacing:'-2px'}}>CNETMOBIL <span style={{color:'#2563eb'}}>CMR</span></h1>
              <p style={{fontSize:'10px', fontWeight:'bold', textTransform:'uppercase', margin:0, color:'#666', letterSpacing:'1px'}}>Kurumsal Cihaz Alim Merkezi</p>
            </div>
            <div style={{textAlign:'right', fontSize:'10px', fontWeight:'bold'}}>
              <p style={{fontSize:'16px', fontWeight:'900', textTransform:'uppercase', margin:0}}>{selectedBranch}</p>
              <p style={{color:'#666'}}>{new Date().toLocaleDateString('tr-TR')} - {new Date().toLocaleTimeString('tr-TR', {hour:'2-digit', minute:'2-digit'})}</p>
            </div>
          </div>
          <div style={{borderTop:'4px solid black', marginBottom:'25px'}}></div>
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'40px', marginBottom:'30px'}}>
            <div style={{border:'2px solid black', padding:'20px', borderRadius:'15px'}}>
              <h3 style={{fontSize:'14px', fontWeight:'900', textTransform:'uppercase', fontStyle:'italic', marginBottom:'15px', borderBottom:'1px solid #ddd', paddingBottom:'5px'}}>👤 Satıcı Bilgileri</h3>
              <div style={{fontSize:'12px', fontWeight:'bold', lineHeight:'2'}}>
                <p>Ad Soyad: <span style={{textTransform:'uppercase', fontWeight:'900', fontSize:'14px'}}>{customer.name || '________________'}</span></p>
                <p>Telefon: {customer.phone || '________________'}</p>
                <p>T.C. Kimlik No: ___________________________</p>
              </div>
            </div>
            <div style={{border:'2px solid black', padding:'20px', borderRadius:'15px'}}>
              <h3 style={{fontSize:'14px', fontWeight:'900', textTransform:'uppercase', fontStyle:'italic', marginBottom:'15px', borderBottom:'1px solid #ddd', paddingBottom:'5px'}}>📱 Cihaz Ekspertiz</h3>
              <div style={{fontSize:'12px', fontWeight:'bold', lineHeight:'1.8'}}>
                <p>Model: <span style={{fontWeight:'900', fontSize:'14px'}}>{selectedModelName} {selectedCapacity?.cap} {selectedModelName === "iPhone 13" ? `(${selectedColor})` : ''}</span></p>
                <p>IMEI: <span style={{fontWeight:'900', fontSize:'13px'}}>{customer.imei || '________________'}</span></p>
              </div>
            </div>
          </div>
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'20px', marginBottom:'40px', textAlign:'center'}}>
              <div style={{border:'4px solid black', padding:'25px', borderRadius:'20px'}}>
                <p style={{fontSize:'11px', fontWeight:'900', textTransform:'uppercase', marginBottom:'5px', color:'#666'}}>Ödenecek Nakit Tutarı</p>
                <p style={{fontSize:'38px', fontWeight:'900', fontStyle:'italic', margin:0}}>{prices.cash.toLocaleString()} TL</p>
              </div>
              <div style={{border:'4px solid black', padding:'25px', borderRadius:'20px', backgroundColor:'#f8f8f8'}}>
                <p style={{fontSize:'11px', fontWeight:'900', textTransform:'uppercase', marginBottom:'5px', color:'#666'}}>Takas Bedeli</p>
                <p style={{fontSize:'38px', fontWeight:'900', fontStyle:'italic', margin:0}}>{prices.trade.toLocaleString()} TL</p>
              </div>
          </div>
          <div style={{fontSize:'10px', fontWeight:'900', fontStyle:'italic', lineHeight:'1.6', marginBottom:'80px', backgroundColor:'#fdfdfd', padding:'20px', border:'1px solid #eee', borderRadius:'10px'}}>
            BEYAN VE TAAHHÜT: Cihaz mülkiyeti şahsıma ait olup, tüm yasal sorumluluğu kabul ederim. Cihazdaki verilerin silinmesinden satıcı sorumlu tutulamaz.
          </div>
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'100px', textAlign:'center'}}>
            <div style={{borderTop:'2px solid black', paddingTop:'10px', fontWeight:'900', fontSize:'14px', textTransform:'uppercase', fontStyle:'italic'}}>Müşteri İmza</div>
            <div style={{borderTop:'2px solid black', paddingTop:'10px', fontWeight:'900', fontSize:'14px', textTransform:'uppercase', fontStyle:'italic'}}>CNETMOBIL YETKİLİ</div>
          </div>
      </div>
    </div>
  );
}
