"use client";
import React, { useState, useEffect } from 'react';

const SHEET_ID = '1GvagcuTfR_e66A1yxTPqaIgh4YEmYl4M7-E2oRzZhyg';
const API_KEY = 'AIzaSyD4zJB-fvZdAR5WucfwITuqpIuHgbpK2gc';
const TABLO_ISMI = 'Google Sheets ile Kurumsal Alım Sistemi'; 
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwvlMvSs-i-wEn197eeBEMLRpiUcW_A7z0nO0oA0seXzcvZ86xsNBfTzZVRmnaEwwrJ/exec';

export default function CnetmobilCmrFinalUltimate() {
  const [db, setDb] = useState<any[]>([]);
  const [config, setConfig] = useState<any>({});
  const [alimlar, setAlimlar] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(1);
  const [selectedBrand, setSelectedBrand] = useState('');
  const [selectedModelName, setSelectedModelName] = useState('');
  const [selectedCapacity, setSelectedCapacity] = useState<any>(null);
  const [selectedBranch, setSelectedBranch] = useState('CMR MERKEZ');

  const [customer, setCustomer] = useState({ name: '', phone: '', imei: '' });
  const [status, setStatus] = useState<any>({ 
    power: null, screen: null, cosmetic: null, faceId: null, 
    battery: null, sim: null, warranty: null  
  });
  const [prices, setPrices] = useState({ cash: 0, trade: 0 });

  const [isAdmin, setIsAdmin] = useState(false);
  const [adminPass, setAdminPass] = useState('');
  const [newDevice, setNewDevice] = useState({ brand: 'Apple', name: '', cap: '', base: '', img: '', minPrice: '0' });

  const branches = [
    { name: "CMR ÇERKEZKÖY", phone: "905443214534" },
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
    setCustomer({ name: '', phone: '', imei: '' });
    setStatus({ power: null, screen: null, cosmetic: null, faceId: null, battery: null, sim: null, warranty: null });
    setIsAdmin(false);
    if(typeof window !== 'undefined') window.scrollTo(0,0);
  };

  const resetSelection = () => {
    setSelectedCapacity(null);
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
      setLoading(false);
    } catch (e) { setLoading(false); }
  };

  useEffect(() => { loadData(); }, [step]);

  useEffect(() => {
    if (selectedCapacity && config.Guc_Yok !== undefined) {
      let price = selectedCapacity.base;
      if (status.power === 'Hayır') price *= (1 - (config.Guc_Yok / 100));
      if (status.screen === 'Kırık / Orijinal Değil') price *= (1 - (config.Ekran_Kirik / 100));
      if (status.screen === 'Çizikler var') price *= (1 - (config.Ekran_Cizik / 100));
      if (status.cosmetic === 'İyi') price *= (1 - (config.Kasa_lyi / 100));
      if (status.cosmetic === 'Kötü') price *= (1 - (config.Kasa_Kotu / 100));
      if (status.faceId === 'Hayır') price *= (1 - (config.FaceID_Bozuk / 100));
      if (status.battery === '0-85') price *= (1 - (config.Pil_Dusuk / 100));
      if (status.battery === 'Bilinmeyen Parça') price *= (1 - ((config.Bilinmeyen_Batarya || 15) / 100));
      if (status.sim === 'Fiziksel + eSIM (YD)') price *= (1 - (config.Yurt_Disi / 100));
      if (status.warranty === 'Yenilenmiş Cihaz') price *= (1 - ((config.Yenilenmis || 0) / 100));
      if (status.warranty === 'Garanti Yok') price *= (1 - ((config.Garanti_Yok || 0) / 100));

      const finalCash = Math.max(Math.round(price), selectedCapacity.minPrice || 0);
      const finalTrade = Math.round(finalCash * (1 + (config.Takas_Destegi / 100)));
      setPrices({ cash: finalCash, trade: finalTrade });
    }
  }, [status, selectedCapacity, config]);

  const handleFinalProcess = async (actionType: 'print' | 'whatsapp') => {
    const now = new Date();
    const dateTime = `${now.toLocaleDateString('tr-TR')} ${now.toLocaleTimeString('tr-TR', {hour:'2-digit', minute:'2-digit'})}`;
    
    try {
      await fetch(SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        body: JSON.stringify({
          type: "SAVE_ALIM",
          branch: selectedBranch,
          customer: customer.name,
          device: `${selectedModelName} (${selectedCapacity?.cap})`,
          imei: customer.imei,
          cash: prices.cash,
          trade: prices.trade,
          date: dateTime
        })
      });
      loadData();
    } catch (e) { console.error(e); }

    if (actionType === 'print') {
      window.print();
    } else {
      const branch = branches.find(b => b.name === selectedBranch);
      const message = `📱 *CMR CİHAZ ALIM FORMU*%0A👤 *Müşteri:* ${customer.name}%0A🆔 *IMEI:* ${customer.imei}%0A📦 *Cihaz:* ${selectedModelName} (${selectedCapacity?.cap})%0A💰 *NAKİT:* ${prices.cash.toLocaleString()} TL%0A🔄 *TAKAS:* ${prices.trade.toLocaleString()} TL`;
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
    if(!confirm("DİKKAT! Tüm alım geçmişi kalıcı olarak silinecek. Emin misiniz?")) return;
    try {
      await fetch(SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify({ type: "DELETE_ALL_ALIM" }) });
      alert("Geçmiş temizlendi.");
      loadData();
    } catch (e) { console.error(e); }
  };

  const updateConfig = async (key: string, val: string) => {
    try {
      await fetch(SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify({ type: "UPDATE_CONFIG", key, val }) });
      alert(`${key} oranı %${val} olarak güncellendi.`);
      setConfig((prev: any) => ({...prev, [key]: parseFloat(val)}));
    } catch (e) { console.error(e); }
  };

  const adminAddDevice = async () => {
    if(!newDevice.name || !newDevice.base) return alert("Hata: Model adı ve baz fiyat zorunludur.");
    try {
      await fetch(SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify({ type: "ADD_DEVICE", ...newDevice }) });
      alert("Cihaz veritabanına başarıyla eklendi.");
      setNewDevice({ brand: 'Apple', name: '', cap: '', base: '', img: '', minPrice: '0' });
      setTimeout(loadData, 1500);
    } catch (e) { console.error(e); }
  };

  const isYd = status.sim === 'Fiziksel + eSIM (YD)';
  const allSelected = Object.values(status).every(v => v !== null) && selectedCapacity;
  const canProceed = allSelected;

  if (loading) return (
    <div className="h-screen flex flex-col items-center justify-center bg-white space-y-4">
      <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      <div className="font-black text-slate-900 italic uppercase tracking-[0.3em] animate-pulse">SİSTEM HAZIRLANIYOR</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F1F5F9] pb-20 font-sans text-slate-900 selection:bg-blue-200 selection:text-blue-900">
      <style>{`
        #print-area { display: none !important; }
        @media print {
          header, main, footer, .print\\:hidden { display: none !important; }
          #print-area { display: block !important; visibility: visible !important; position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; background: white !important; color: black !important; margin: 0 !important; padding: 40px !important; }
          #print-area * { visibility: visible !important; }
        }
        .btn-click { transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); cursor: pointer; }
        .btn-click:active { transform: scale(0.96); }
        .btn-disabled { opacity: 0.15; cursor: not-allowed !important; pointer-events: none; filter: grayscale(1); }
        .card-shadow { box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1); }
        .glass-header { background: rgba(255, 255, 255, 0.95); backdrop-filter: blur(8px); }
        .admin-card { background: white; border-radius: 24px; padding: 2rem; border: 1px solid #e2e8f0; }
      `}</style>

      {/* HEADER */}
      <header className="px-8 py-5 glass-header border-b border-slate-200 flex justify-between items-center sticky top-0 z-50 print:hidden card-shadow">
        <div onClick={resetAll} className="flex items-center gap-3 group cursor-pointer">
          <div className="bg-blue-600 p-2 rounded-xl group-hover:rotate-12 transition-transform shadow-lg shadow-blue-200">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
          </div>
          <h1 className="text-2xl font-black italic text-slate-950 uppercase tracking-tighter">
            CNET<span className="text-blue-600">MOBIL</span> <span className="font-light text-slate-400 not-italic ml-1">CMR</span>
          </h1>
        </div>
        
        <div className="flex items-center gap-6">
          <button onClick={() => setStep(99)} className="text-xs font-black uppercase text-slate-400 hover:text-blue-600 tracking-widest transition-colors">YÖNETİCİ PANELİ</button>
          <div className="relative">
            <select value={selectedBranch} onChange={(e) => setSelectedBranch(e.target.value)} className="appearance-none bg-slate-100 hover:bg-slate-200 px-5 py-3 pr-10 rounded-2xl text-[11px] font-black outline-none border-none transition-all cursor-pointer">
              {branches.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
               <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7" strokeWidth={3} /></svg>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-8 mt-4 print:hidden">
        {step === 99 ? (
           <div className="animate-in fade-in slide-in-from-bottom-6 duration-500">
             {!isAdmin ? (
               <div className="max-w-md mx-auto bg-white p-16 rounded-[56px] shadow-2xl text-center border border-slate-100 mt-20">
                 <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-8">
                    <svg className="w-10 h-10 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 00-2 2zM9 11V7a3 3 0 016 0v4" /></svg>
                 </div>
                 <h2 className="text-2xl font-black italic mb-10 uppercase tracking-widest text-slate-900 leading-tight">YÖNETİCİ<br/>KİMLİK DOĞRULAMA</h2>
                 <input type="password" placeholder="Giriş Şifresi" className="w-full p-6 bg-slate-50 rounded-2xl mb-6 text-center font-black outline-none border-2 border-transparent focus:border-blue-500 transition-all text-xl" onChange={(e) => setAdminPass(e.target.value)} />
                 <button onClick={() => adminPass === 'cnet1905' ? setIsAdmin(true) : alert("Hatalı!")} className="bg-slate-900 text-white px-10 py-6 rounded-2xl font-black uppercase w-full btn-click shadow-2xl shadow-slate-300 tracking-widest">SİSTEME ERİŞİM SAĞLA</button>
               </div>
             ) : (
               <div className="space-y-12">
                 {/* ADMIN DASHBOARD TOP HEADER */}
                 <div className="flex flex-col md:flex-row justify-between items-end gap-4">
                    <div>
                        <h2 className="text-4xl font-black italic tracking-tighter uppercase">CMR DASHBOARD</h2>
                        <p className="text-slate-400 font-bold uppercase tracking-widest text-xs mt-1">Sistem Parametreleri ve Veritabanı Yönetimi</p>
                    </div>
                    <button onClick={() => {setStep(1); setIsAdmin(false);}} className="bg-red-500 text-white px-8 py-4 rounded-2xl font-black uppercase text-xs btn-click shadow-lg shadow-red-200">GÜVENLİ ÇIKIŞ YAP</button>
                 </div>

                 <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 items-start">
                    {/* SOL PANEL: FİYAT AYARLARI */}
                    <div className="admin-card xl:col-span-1 shadow-sm">
                        <div className="flex items-center gap-3 mb-8">
                            <div className="w-10 h-10 bg-orange-100 text-orange-600 rounded-xl flex items-center justify-center">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                            </div>
                            <h3 className="text-sm font-black uppercase tracking-widest text-slate-800">Fiyat Kesinti Oranları</h3>
                        </div>
                        <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                            {Object.keys(config).map(key => (
                            <div key={key} className="group bg-slate-50 p-4 rounded-2xl flex flex-col gap-3 border border-transparent hover:border-orange-200 transition-all">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter leading-none">{key.replace(/_/g,' ')}</span>
                                <div className="flex items-center gap-2">
                                    <div className="relative flex-1">
                                        <input type="number" className="w-full p-3 pl-8 bg-white border border-slate-200 rounded-xl font-black text-slate-900 outline-none focus:ring-2 focus:ring-orange-500/20 transition-all" 
                                            value={config[key]} 
                                            onChange={(e) => setConfig({...config, [key]: e.target.value})}
                                        />
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-black text-slate-300">%</span>
                                    </div>
                                    <button onClick={() => updateConfig(key, config[key])} className="bg-white border border-slate-200 text-orange-600 p-3 rounded-xl hover:bg-orange-600 hover:text-white transition-all shadow-sm">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                                    </button>
                                </div>
                            </div>
                            ))}
                        </div>
                    </div>

                    {/* ORTA PANEL: CİHAZ EKLEME */}
                    <div className="admin-card xl:col-span-2 shadow-sm h-full">
                        <div className="flex items-center gap-3 mb-8">
                            <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                            </div>
                            <h3 className="text-sm font-black uppercase tracking-widest text-slate-800">Veritabanına Cihaz Ekle</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <div>
                                    <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Marka</label>
                                    <input placeholder="Apple, Samsung..." className="w-full p-4 bg-slate-50 rounded-2xl text-xs font-black border border-slate-100 outline-none focus:bg-white transition-all" value={newDevice.brand} onChange={(e)=>setNewDevice({...newDevice, brand: e.target.value})} />
                                </div>
                                <div>
                                    <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Model Adı</label>
                                    <input placeholder="iPhone 15 Pro Max" className="w-full p-4 bg-slate-50 rounded-2xl text-xs font-black border border-slate-100 outline-none focus:bg-white transition-all" value={newDevice.name} onChange={(e)=>setNewDevice({...newDevice, name: e.target.value})} />
                                </div>
                                <div>
                                    <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Hafıza</label>
                                    <input placeholder="256 GB, 512 GB..." className="w-full p-4 bg-slate-50 rounded-2xl text-xs font-black border border-slate-100 outline-none focus:bg-white transition-all" value={newDevice.cap} onChange={(e)=>setNewDevice({...newDevice, cap: e.target.value})} />
                                </div>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Baz Alış Fiyatı (TL)</label>
                                    <input placeholder="Örn: 45000" className="w-full p-4 bg-slate-50 rounded-2xl text-xs font-black border border-slate-100 outline-none focus:bg-white transition-all" value={newDevice.base} onChange={(e)=>setNewDevice({...newDevice, base: e.target.value})} />
                                </div>
                                <div>
                                    <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Minimum Alış (TL)</label>
                                    <input placeholder="Örn: 15000" className="w-full p-4 bg-slate-50 rounded-2xl text-xs font-black border border-slate-100 outline-none focus:bg-white transition-all" value={newDevice.minPrice} onChange={(e)=>setNewDevice({...newDevice, minPrice: e.target.value})} />
                                </div>
                                <div>
                                    <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Görsel URL Linki</label>
                                    <input placeholder="https://image-link.com/photo.png" className="w-full p-4 bg-slate-50 rounded-2xl text-xs font-black border border-slate-100 outline-none focus:bg-white transition-all" value={newDevice.img} onChange={(e)=>setNewDevice({...newDevice, img: e.target.value})} />
                                </div>
                            </div>
                        </div>
                        <button onClick={adminAddDevice} className="w-full py-6 bg-blue-600 text-white rounded-2xl font-black uppercase text-sm btn-click shadow-xl shadow-blue-100 mt-8 tracking-widest">YENİ CİHAZI KAYDET</button>
                    </div>
                 </div>

                 {/* ALT PANEL: ALIM GEÇMİŞİ */}
                 <div className="admin-card shadow-sm">
                   <div className="flex flex-col md:flex-row justify-between items-center gap-4 border-b border-slate-100 pb-6 mb-8">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-green-100 text-green-600 rounded-xl flex items-center justify-center">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </div>
                        <h2 className="text-xl font-black italic uppercase tracking-tighter leading-none">İŞLEM GEÇMİŞİ</h2>
                      </div>
                      <button onClick={deleteAllAlimlar} className="bg-red-50 text-red-600 px-8 py-3 rounded-2xl text-[10px] font-black hover:bg-red-600 hover:text-white transition-all uppercase border border-red-100 tracking-widest">TÜM KAYITLARI SIFIRLA</button>
                   </div>
                   <div className="space-y-4 max-h-[800px] overflow-y-auto pr-4 custom-scrollbar">
                     {[...alimlar].reverse().map((item, i) => (
                       <div key={i} className="group bg-slate-50 p-6 rounded-[32px] border border-slate-100 flex flex-col md:flex-row justify-between items-center gap-6 hover:bg-white hover:shadow-xl hover:border-blue-100 transition-all">
                         <div className="flex flex-col md:flex-row items-center gap-6 flex-1">
                            <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-sm font-black text-blue-600 italic">#{item.sheetIndex}</div>
                            <div className="text-center md:text-left space-y-1">
                                <div className="flex items-center gap-2 justify-center md:justify-start">
                                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{item.data[7] || 'Tarih Bilgisi Yok'}</span>
                                    <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-[9px] font-black uppercase">{item.data[0]}</span>
                                </div>
                                <p className="font-black text-slate-900 text-lg uppercase tracking-tight leading-none">{item.data[1]}</p>
                                <p className="text-slate-500 font-bold text-xs uppercase italic">{item.data[3]} | <span className="text-blue-500">{item.data[2]}</span></p>
                            </div>
                         </div>
                         <div className="flex items-center gap-8 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 border-slate-200 pt-4 md:pt-0">
                            <div className="text-center md:text-right">
                               <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Net Ödeme</p>
                               <p className="font-black text-2xl italic text-slate-950 tracking-tighter">{parseInt(item.data[5]||0).toLocaleString()} TL</p>
                            </div>
                            <button onClick={() => deleteAlim(item.sheetIndex)} className="bg-white text-red-500 hover:bg-red-500 hover:text-white p-4 rounded-2xl shadow-sm transition-all border border-slate-100">
                               <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                         </div>
                       </div>
                     ))}
                   </div>
                 </div>
               </div>
             )}
           </div>
        ) : step === 1 ? (
           <div className="space-y-16 py-12">
             <div className="text-center space-y-4 animate-in fade-in slide-in-from-top-10 duration-1000">
                <h2 className="text-6xl md:text-8xl font-black italic tracking-[ -0.05em] text-slate-950 uppercase leading-none">
                  TEKNOLOJİ <br/> <span className="text-blue-600">ALIM</span> MERKEZİ
                </h2>
                <p className="text-slate-400 font-bold uppercase tracking-[0.4em] text-[10px]">İşlem yapmak istediğiniz markayı seçin</p>
             </div>
             <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 animate-in fade-in zoom-in duration-1000 delay-300">
               {Array.from(new Set(db.map(i => i.brand))).map(brand => (
                 <div key={brand} onClick={() => {setSelectedBrand(brand); setStep(2); resetSelection();}} className="bg-white p-12 rounded-[56px] shadow-sm hover:shadow-2xl hover:scale-[1.05] transition-all cursor-pointer border border-slate-100 flex flex-col items-center justify-center text-center h-80 group btn-click">
                   <div className="h-28 w-full flex items-center justify-center mb-10 grayscale group-hover:grayscale-0 transition-all duration-700 transform group-hover:scale-110">
                     <img src={brandAssets[brand]?.logo || ""} className="max-h-full max-w-[160px] object-contain" alt={brand} />
                   </div>
                   <h2 className="font-black text-2xl mb-1 uppercase italic tracking-tighter text-slate-900 leading-none">{brand}</h2>
                   <div className="w-8 h-1.5 bg-slate-100 group-hover:w-24 group-hover:bg-blue-600 transition-all rounded-full mt-4"></div>
                 </div>
               ))}
             </div>
           </div>
        ) : step === 2 ? (
           <div className="animate-in slide-in-from-right-10 duration-500">
             <div className="flex items-center justify-between mb-12">
                <button onClick={() => {setStep(1); resetSelection();}} className="bg-white shadow-sm border border-slate-200 px-8 py-4 rounded-[20px] text-[11px] font-black uppercase text-slate-500 hover:text-blue-600 transition-all btn-click flex items-center gap-3">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg>
                  ANA MENÜ
                </button>
                <div className="text-right">
                  <span className="text-[11px] font-black text-blue-600 uppercase tracking-[0.2em]">{selectedBrand}</span>
                  <h2 className="text-4xl font-black italic uppercase tracking-tighter leading-none mt-1">MODEL KATALOĞU</h2>
                </div>
             </div>
             <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8">
               {Array.from(new Set(db.filter(i => i.brand === selectedBrand).map(i => i.name))).map(name => (
                 <div key={name} onClick={() => {setSelectedModelName(name); setStep(3); resetSelection();}} className="bg-white p-10 rounded-[48px] shadow-sm cursor-pointer hover:shadow-2xl hover:border-blue-500/30 border-2 border-transparent transition-all text-center btn-click group flex flex-col items-center">
                   <div className="h-40 flex items-center justify-center mb-8 transform group-hover:scale-110 transition-transform duration-700">
                      <img src={db.find(i => i.name === name)?.img} className="max-h-full object-contain drop-shadow-2xl" />
                   </div>
                   <p className="font-black text-sm uppercase text-slate-900 tracking-tighter leading-tight">{name}</p>
                 </div>
               ))}
             </div>
           </div>
        ) : (
          <div className="flex flex-col lg:flex-row gap-12 animate-in fade-in duration-700">
            <div className="flex-1 space-y-8">
              <button onClick={() => {setStep(2); resetSelection();}} className="bg-white shadow-sm border border-slate-200 px-8 py-4 rounded-[20px] text-[11px] font-black uppercase text-slate-500 hover:text-blue-600 transition-all btn-click flex items-center gap-3">
                 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg>
                 KATALOĞA DÖN
              </button>

              {/* EKSPERTİZ PANELİ */}
              <div className="bg-white p-12 rounded-[56px] shadow-sm border border-slate-100 relative overflow-hidden">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12 border-b border-slate-100 pb-8">
                  <div>
                    <h3 className="text-3xl font-black italic tracking-tighter text-slate-950 uppercase leading-none">EKSPERTİZ RAPORU</h3>
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-2 italic">Cihaz durumunu işaretleyin ve IMEI kontrolü yapın</p>
                  </div>
                  {customer.imei.length === 15 && (
                    <button type="button" onClick={() => window.open(`https://www.turkiye.gov.tr/imei-sorgulama`, '_blank')} className="bg-blue-600 text-white px-8 py-4 rounded-2xl text-xs font-black animate-pulse hover:bg-blue-700 transition-all flex items-center gap-3 shadow-xl shadow-blue-200">
                      BTK IMEI SORGULA
                    </button>
                  )}
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 ml-4 uppercase tracking-widest leading-none">Müşteri Adı Soyadı</label>
                      <input placeholder="Yazınız..." className="w-full p-5 bg-slate-50 rounded-2xl text-sm outline-none border-2 border-transparent font-black uppercase focus:bg-white focus:border-blue-500 transition-all" value={customer.name} onChange={(e)=>setCustomer({...customer, name: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 ml-4 uppercase tracking-widest leading-none">İrtibat Numarası</label>
                      <input placeholder="05XX XXX XX XX" className="w-full p-5 bg-slate-50 rounded-2xl text-sm outline-none border-2 border-transparent font-black focus:bg-white focus:border-blue-500 transition-all" value={customer.phone} onChange={(e)=>setCustomer({...customer, phone: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 ml-4 uppercase tracking-widest leading-none">Cihaz IMEI (15 Hane)</label>
                      <input placeholder="Sorgula..." className="w-full p-5 bg-slate-50 rounded-2xl text-sm outline-none border-2 border-transparent font-black uppercase focus:bg-white focus:border-blue-500 transition-all" value={customer.imei} maxLength={15} onChange={(e) => setCustomer({...customer, imei: e.target.value.replace(/\D/g, '')})} />
                    </div>
                  </div>

                  <div className="bg-slate-900 p-10 rounded-[40px] space-y-5 shadow-2xl">
                    <p className="text-[11px] font-black text-blue-400 uppercase italic tracking-widest flex items-center gap-3 mb-2">
                       <span className="w-2.5 h-2.5 bg-blue-500 rounded-full animate-ping"></span>
                       PERSONEL GÜVENLİK ADIMLARI
                    </p>
                    {[
                      "ICLOUD / GOOGLE HESABI ÇIKIŞI",
                      "BUL (FIND MY) ÖZELLİĞİ KAPALI",
                      "KAYIT DURUMU VE BTK KONTROLÜ",
                      "TÜM VERİLER VE ŞİFRELER SİLİNDİ"
                    ].map((item, idx) => (
                      <label key={idx} className="flex items-center gap-4 cursor-pointer group select-none py-1 border-b border-white/5 hover:border-white/20 transition-all">
                        <input type="checkbox" className="w-6 h-6 accent-blue-600 rounded-lg cursor-pointer bg-white/10 border-none" />
                        <span className="text-[11px] font-black text-slate-300 group-hover:text-white transition-colors uppercase italic">{item}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* SEÇENEKLER KONTEYNERI */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-10 rounded-[48px] shadow-sm border border-slate-100 col-span-1 md:col-span-2">
                  <p className="text-[11px] font-black mb-6 text-slate-400 uppercase tracking-widest flex items-center gap-3">
                    <span className="w-6 h-1 bg-blue-600 rounded-full"></span>
                    Hafıza Kapasite Seçimi
                  </p>
                  <div className="flex flex-wrap gap-4">
                    {db.filter(i => i.name === selectedModelName).map(c => (
                      <button key={c.cap} onClick={() => setSelectedCapacity(c)} className={`px-12 py-6 rounded-2xl font-black text-sm transition-all btn-click ${selectedCapacity?.cap === c.cap ? 'bg-blue-600 text-white shadow-xl shadow-blue-200 ring-8 ring-blue-50' : 'bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600'}`}>{c.cap}</button>
                    ))}
                  </div>
                </div>

                {[
                  { label: "Cihaz Açılıyor mu?", field: "power", opts: ['Evet', 'Hayır'] },
                  { label: "Garanti Durumu", field: "warranty", opts: ['Üretici Garantili', 'Yenilenmiş Cihaz', 'Garanti Yok'] },
                  { label: "Ekran / Cam Durumu", field: "screen", opts: ['Sağlam', 'Çizikler var', 'Kırık / Yan Sanayi'] },
                  { label: "Kozmetik (Kasa) Durumu", field: "cosmetic", opts: ['Mükemmel', 'İyi', 'Kötü'] },
                  { label: "Face ID / Touch ID", field: "faceId", opts: ['Evet', 'Hayır'] },
                  { label: "Batarya (Pil) Sağlığı", field: "battery", opts: ['95-100', '85-95', '0-85', 'Bilinmeyen Parça'] },
                  { label: "Pasaport Kayıt", field: "sim", opts: ['Fiziksel SIM (TR)', 'Fiziksel + eSIM (YD)'] }
                ].map(q => (
                  <div key={q.field} className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-100">
                    <p className="text-[10px] font-black mb-5 text-slate-400 uppercase tracking-widest italic">{q.label}</p>
                    <div className="flex flex-wrap gap-3">
                      {q.opts.map((opt) => (
                        <button key={opt} onClick={() => setStatus({...status, [q.field]: opt})} className={`py-4 px-6 rounded-2xl text-[11px] font-black border-2 transition-all btn-click ${status[q.field] === opt ? 'bg-slate-900 text-white border-slate-900 shadow-xl' : 'bg-white text-slate-400 border-slate-100 hover:border-slate-300'}`}>{opt}</button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* SAĞ PANEL: FİYAT VE AKSİYON */}
            <div className="lg:w-[400px] space-y-8 sticky top-32 h-fit">
              {isYd ? (
                <div className="bg-red-600 p-12 rounded-[56px] shadow-2xl text-white text-center border-b-[16px] border-red-800 animate-pulse ring-8 ring-red-50">
                  <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-8 text-4xl">!</div>
                  <p className="text-3xl font-black uppercase italic leading-none tracking-tighter">YURT DIŞI</p>
                  <p className="text-[12px] mt-6 uppercase tracking-[0.3em] font-black opacity-90 leading-tight">BU İŞLEM SADECE <br/> YÖNETİCİ ONAYI İLE YAPILABİLİR</p>
                </div>
              ) : (
                <div className="space-y-8 animate-in zoom-in-95 duration-500">
                  <div className="bg-white p-12 rounded-[56px] shadow-xl border border-slate-100 text-center group transition-all hover:scale-[1.02]">
                    <p className="text-[12px] font-black text-slate-400 uppercase mb-5 tracking-[0.2em] italic">Net Nakit Ödeme</p>
                    <div className="text-6xl font-black italic tracking-tighter text-slate-950">
                       {selectedCapacity && allSelected ? `${prices.cash.toLocaleString()} TL` : '---'}
                    </div>
                    <div className="h-2 w-20 bg-blue-600 mx-auto mt-8 rounded-full opacity-10 group-hover:opacity-100 group-hover:w-32 transition-all duration-500"></div>
                  </div>
                  
                  <div className="bg-blue-600 p-12 rounded-[56px] shadow-2xl text-center text-white relative overflow-hidden group hover:scale-[1.02] transition-all">
                    <div className="absolute -right-6 -top-6 opacity-10 rotate-12 transition-transform group-hover:rotate-45 duration-1000 scale-150">
                       <svg className="w-40 h-40" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L1 21h22L12 2zm0 3.45L19.53 19H4.47L12 5.45zM11 16h2v2h-2v-2zm0-7h2v5h-2V9z"/></svg>
                    </div>
                    <p className="text-[12px] font-black text-blue-100 uppercase mb-5 tracking-[0.2em] italic opacity-80">Takas Değişim Değeri</p>
                    <div className="text-6xl font-black italic tracking-tighter leading-none">
                       {selectedCapacity && allSelected ? `${prices.trade.toLocaleString()} TL` : '---'}
                    </div>
                    <p className="text-[10px] font-bold mt-6 uppercase tracking-widest text-blue-200 opacity-60">MAĞAZA İÇİ ALIŞVERİŞLERDE GEÇERLİ</p>
                  </div>
                </div>
              )}

              <div className="bg-slate-950 p-12 rounded-[56px] space-y-5 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.4)]">
                <div className="flex items-center gap-4 mb-8 px-2 border-l-4 border-blue-600 pl-4 py-1">
                   <p className="text-[11px] text-slate-400 font-bold leading-tight uppercase italic tracking-wider">
                      VERİLERİ DOĞRULADIKTAN <br/> SONRA İŞLEMİ TAMAMLAYIN
                   </p>
                </div>
                <button disabled={!canProceed} onClick={() => handleFinalProcess('print')} className={`w-full py-7 rounded-3xl font-black uppercase text-xs tracking-[0.2em] transition-all btn-click flex items-center justify-center gap-4 shadow-xl ${canProceed ? 'bg-white text-slate-950 hover:bg-slate-100' : 'btn-disabled bg-slate-800 text-slate-600'}`}>
                   SÖZLEŞMEYİ OLUŞTUR
                </button>
                <button disabled={!canProceed} onClick={() => handleFinalProcess('whatsapp')} className={`w-full py-7 rounded-3xl font-black uppercase text-xs tracking-[0.2em] transition-all btn-click flex items-center justify-center gap-4 shadow-xl ${canProceed ? 'bg-green-600 text-white hover:bg-green-700 shadow-green-900/30' : 'btn-disabled bg-slate-800 text-slate-600'}`}>
                   BULUTA KAYDET & WA
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* FOOTER */}
      <footer className="max-w-7xl mx-auto px-8 py-16 text-center print:hidden border-t border-slate-200 mt-20">
        <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.6em]">CNETMOBIL • CMR TERMINAL v5.0.0</p>
        <p className="text-[9px] text-slate-300 font-bold mt-2 uppercase">Google Sheets Entegrasyonlu Kurumsal Alım Arayüzü</p>
      </footer>

      {/* PRINT AREA - BOZMADIM, OLDUĞU GİBİ DURUYOR */}
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
                <p>Model: <span style={{fontWeight:'900', fontSize:'14px'}}>{selectedModelName} {selectedCapacity?.cap}</span></p>
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
