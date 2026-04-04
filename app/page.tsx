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

  // LOGOLAR DÜZELTİLDİ: Wikipedia'nın en stabil PNG kaynakları eklendi
  const brandAssets: any = {
    "Apple": { logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/fa/Apple_logo_black.svg/1024px-Apple_logo_black.svg.png" },
    "Samsung": { logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/24/Samsung_Logo.svg/1024px-Samsung_Logo.svg.png" },
    "Huawei": { logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e8/Huawei_logo.svg/1024px-Huawei_logo.svg.png" },
    "Xiaomi": { logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ae/Xiaomi_logo_%282021-%29.svg/1024px-Xiaomi_logo_%282021-%29.svg.png" },
    "Oppo": { logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0d/Oppo_Logo.svg/1024px-Oppo_Logo.svg.png" },
    "Realme": { logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/Realme-Logo.png/1024px-Realme-Logo.png" },
    "Vivo": { logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e5/Vivo_logo.svg/1024px-Vivo_logo.svg.png" },
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
    // Anında UI'dan siliyoruz (Kullanıcı beklemesin)
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
    // Anında UI'ı temizliyoruz (Kullanıcı çalışmadığını düşünmesin)
    setAlimlar([]); 
    try {
      await fetch(SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify({ type: "DELETE_ALL_ALIM" }) });
      alert("Tüm geçmiş temizlendi.");
      loadData();
    } catch (e) { console.error(e); }
  };

  const updateConfig = async (key: string, val: string) => {
    try {
      await fetch(SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify({ type: "UPDATE_CONFIG", key, val }) });
      alert("Güncellendi: " + key);
      setConfig((prev: any) => ({...prev, [key]: parseFloat(val)}));
    } catch (e) { console.error(e); }
  };

  const adminAddDevice = async () => {
    if(!newDevice.name || !newDevice.base) return alert("Eksik bilgi!");
    try {
      await fetch(SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify({ type: "ADD_DEVICE", ...newDevice }) });
      alert("Cihaz Eklendi!");
      setNewDevice({ brand: 'Apple', name: '', cap: '', base: '', img: '', minPrice: '0' });
      setTimeout(loadData, 1500);
    } catch (e) { console.error(e); }
  };

  const isYd = status.sim === 'Fiziksel + eSIM (YD)';
  const allSelected = Object.values(status).every(v => v !== null) && selectedCapacity;
  const canProceed = allSelected;

  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-slate-50">
       <div className="font-bold text-slate-500 uppercase tracking-widest text-sm animate-pulse">Sistem Yükleniyor...</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 pb-20 font-sans text-slate-900">
      <style>{`
        #print-area { display: none !important; }
        @media print {
          header, main, footer, .print\\:hidden { display: none !important; }
          body { background: white !important; }
          #print-area { display: block !important; visibility: visible !important; position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; background: white !important; color: black !important; margin: 0 !important; padding: 20px !important; }
          #print-area * { visibility: visible !important; }
        }
        .btn-click { transition: all 0.15s ease; cursor: pointer; }
        .btn-click:active { transform: scale(0.97); }
        .btn-disabled { opacity: 0.4; cursor: not-allowed !important; pointer-events: none; }
      `}</style>

      {/* HEADER - KURUMSAL VE SADE */}
      <header className="px-6 py-4 bg-white border-b border-slate-200 flex justify-between items-center sticky top-0 z-50 print:hidden shadow-sm">
        <h1 className="text-lg font-black text-blue-700 tracking-tight cursor-pointer" onClick={resetAll}>
          CNETMOBIL <span className="text-slate-800">CMR</span>
        </h1>
        <div className="flex items-center gap-4">
          <button onClick={() => setStep(99)} className="text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors">Yönetim Paneli</button>
          <select value={selectedBranch} onChange={(e) => setSelectedBranch(e.target.value)} className="bg-slate-100 px-3 py-2 rounded-lg text-xs font-bold outline-none border border-slate-200 cursor-pointer">
            {branches.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
          </select>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6 mt-4 print:hidden">
        {step === 99 ? (
           <div className="animate-in fade-in duration-300">
             {!isAdmin ? (
               <div className="max-w-sm mx-auto bg-white p-8 rounded-2xl shadow-lg border border-slate-200 mt-20">
                 <h2 className="text-xl font-bold mb-6 text-center text-slate-800">Yönetici Girişi</h2>
                 <input type="password" placeholder="Şifrenizi Girin" className="w-full p-4 bg-slate-50 rounded-xl mb-4 text-center font-bold outline-none border border-slate-200 focus:border-blue-500" onChange={(e) => setAdminPass(e.target.value)} />
                 <button onClick={() => adminPass === 'cnet1905' ? setIsAdmin(true) : alert("Hatalı Şifre!")} className="bg-slate-900 text-white px-6 py-4 rounded-xl font-bold w-full btn-click">Sisteme Gir</button>
               </div>
             ) : (
               <div className="space-y-6">
                 <div className="flex justify-between items-center bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <div>
                        <h2 className="text-2xl font-black text-slate-800 tracking-tight">Kontrol Paneli</h2>
                        <p className="text-sm text-slate-500">Sistem ayarları ve geçmiş kayıtlar</p>
                    </div>
                    <button onClick={() => {setStep(1); setIsAdmin(false);}} className="text-sm bg-slate-100 text-slate-600 px-6 py-3 rounded-xl font-bold hover:bg-slate-200 btn-click">Çıkış Yap</button>
                 </div>
                 
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* FİYAT YÜZDELERİ */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                      <h3 className="text-sm font-bold text-slate-800 mb-4 border-b pb-2">Fiyat Kesinti Oranları (%)</h3>
                      <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                        {Object.keys(config).map(key => (
                          <div key={key} className="flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-100">
                            <span className="text-xs font-bold text-slate-600 uppercase">{key.replace(/_/g,' ')}</span>
                            <div className="flex gap-2">
                                <input type="number" className="w-20 p-2 bg-white rounded border border-slate-200 text-right font-bold text-sm" value={config[key]} 
                                    onChange={(e) => setConfig({...config, [key]: e.target.value})} />
                                <button onClick={() => updateConfig(key, config[key])} className="bg-blue-600 text-white p-2 rounded hover:bg-blue-700 btn-click">
                                    Kaydet
                                </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* YENİ CİHAZ EKLE */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                      <h3 className="text-sm font-bold text-slate-800 mb-4 border-b pb-2">Yeni Cihaz Tanımla</h3>
                      <div className="space-y-3">
                        <input placeholder="Marka (Örn: Apple)" className="w-full p-3 bg-slate-50 rounded-lg text-sm font-semibold border border-slate-200 outline-none" value={newDevice.brand} onChange={(e)=>setNewDevice({...newDevice, brand: e.target.value})} />
                        <input placeholder="Model (Örn: iPhone 13 Pro)" className="w-full p-3 bg-slate-50 rounded-lg text-sm font-semibold border border-slate-200 outline-none" value={newDevice.name} onChange={(e)=>setNewDevice({...newDevice, name: e.target.value})} />
                        <input placeholder="Hafıza (Örn: 128 GB)" className="w-full p-3 bg-slate-50 rounded-lg text-sm font-semibold border border-slate-200 outline-none" value={newDevice.cap} onChange={(e)=>setNewDevice({...newDevice, cap: e.target.value})} />
                        <input placeholder="Max Alış Fiyatı (TL)" className="w-full p-3 bg-slate-50 rounded-lg text-sm font-semibold border border-slate-200 outline-none" value={newDevice.base} onChange={(e)=>setNewDevice({...newDevice, base: e.target.value})} />
                        <input placeholder="Minimum Alış Fiyatı (TL)" className="w-full p-3 bg-slate-50 rounded-lg text-sm font-semibold border border-slate-200 outline-none" value={newDevice.minPrice} onChange={(e)=>setNewDevice({...newDevice, minPrice: e.target.value})} />
                        <input placeholder="Görsel URL (Link)" className="w-full p-3 bg-slate-50 rounded-lg text-sm font-semibold border border-slate-200 outline-none" value={newDevice.img} onChange={(e)=>setNewDevice({...newDevice, img: e.target.value})} />
                        <button onClick={adminAddDevice} className="w-full py-4 bg-slate-900 text-white rounded-lg font-bold text-sm btn-click mt-2">Veritabanına Ekle</button>
                      </div>
                    </div>
                 </div>

                 {/* ALIM GEÇMİŞİ */}
                 <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <div className="flex justify-between items-center mb-4 border-b pb-2">
                        <h3 className="text-sm font-bold text-slate-800">Son İşlem Kayıtları</h3>
                        <button onClick={deleteAllAlimlar} className="text-xs bg-red-100 text-red-600 px-4 py-2 rounded font-bold hover:bg-red-600 hover:text-white transition-colors btn-click">Tüm Geçmişi Temizle</button>
                    </div>
                    <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                        {[...alimlar].reverse().map((item, i) => (
                           <div key={i} className="flex justify-between items-center p-4 bg-slate-50 rounded-xl border border-slate-100">
                              <div>
                                 <p className="text-xs text-slate-500 font-semibold">{item.data[7]}</p>
                                 <p className="text-slate-900 font-bold text-sm">{item.data[1]}</p>
                                 <p className="text-slate-600 text-xs">{item.data[3]} - {item.data[2]}</p>
                              </div>
                              <div className="flex items-center gap-6">
                                 <div className="text-right">
                                    <p className="text-[10px] text-slate-400 uppercase font-bold">Ödenen Fiyat</p>
                                    <p className="font-black text-lg text-slate-900">{parseInt(item.data[5]||0).toLocaleString()} TL</p>
                                 </div>
                                 <button onClick={() => deleteAlim(item.sheetIndex)} className="text-slate-400 hover:text-red-600 p-2 transition-colors">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
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
           // GİRİŞ EKRANI - SADE VE KURUMSAL
           <div className="space-y-10 py-10">
             <div className="text-center space-y-2">
                <h2 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight">Cihaz Alım Sistemi</h2>
                <p className="text-slate-500 font-medium text-sm">İşlem yapmak istediğiniz markayı seçiniz</p>
             </div>
             <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto">
               {Array.from(new Set(db.map(i => i.brand))).map(brand => (
                 <div key={brand} onClick={() => {setSelectedBrand(brand); setStep(2); resetSelection();}} className="bg-white p-6 rounded-2xl shadow-sm hover:shadow-md transition-shadow cursor-pointer border border-slate-200 flex flex-col items-center justify-center text-center h-48 btn-click">
                   <div className="h-20 w-full flex items-center justify-center mb-4">
                     <img src={brandAssets[brand]?.logo || ""} className="max-h-full max-w-[100px] object-contain opacity-80" alt={brand} />
                   </div>
                   <h2 className="font-bold text-lg text-slate-700">{brand}</h2>
                 </div>
               ))}
             </div>
           </div>
        ) : step === 2 ? (
           // MODEL SEÇİM EKRANI
           <div className="animate-in slide-in-from-right-4 duration-300">
             <div className="flex items-center justify-between mb-8 border-b border-slate-200 pb-4">
                <button onClick={() => {setStep(1); resetSelection();}} className="text-blue-600 font-bold text-sm flex items-center gap-2 hover:text-blue-800 transition-colors btn-click">
                  ← Markalara Dön
                </button>
                <div className="text-right">
                  <span className="text-xs font-bold text-slate-500 uppercase">{selectedBrand}</span>
                  <h2 className="text-2xl font-black text-slate-900">Model Seçimi</h2>
                </div>
             </div>
             <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
               {Array.from(new Set(db.filter(i => i.brand === selectedBrand).map(i => i.name))).map(name => (
                 <div key={name} onClick={() => {setSelectedModelName(name); setStep(3); resetSelection();}} className="bg-white p-6 rounded-2xl shadow-sm cursor-pointer hover:border-blue-500 border border-slate-200 transition-colors text-center btn-click">
                   <img src={db.find(i => i.name === name)?.img} className="h-24 mx-auto mb-4 object-contain" />
                   <p className="font-bold text-xs text-slate-800 leading-snug">{name}</p>
                 </div>
               ))}
             </div>
           </div>
        ) : (
          // FİYAT VE EKSPERTİZ EKRANI
          <div className="flex flex-col lg:flex-row gap-8 animate-in fade-in duration-300">
            <div className="flex-1 space-y-6">
              <button onClick={() => {setStep(2); resetSelection();}} className="text-blue-600 font-bold text-sm flex items-center gap-2 hover:text-blue-800 transition-colors btn-click mb-2">
                 ← Modellere Dön
              </button>

              {/* GÜVENLİK BİLGİLERİ KUTUSU */}
              <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
                <h3 className="text-lg font-black text-slate-800 mb-6">Müşteri ve Cihaz Bilgileri</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div className="space-y-4">
                        <input placeholder="Müşteri Ad Soyad" className="w-full p-4 bg-slate-50 rounded-xl text-sm font-semibold border border-slate-200 outline-none focus:border-blue-500" value={customer.name} onChange={(e)=>setCustomer({...customer, name: e.target.value})} />
                        <input placeholder="Telefon Numarası" className="w-full p-4 bg-slate-50 rounded-xl text-sm font-semibold border border-slate-200 outline-none focus:border-blue-500" value={customer.phone} onChange={(e)=>setCustomer({...customer, phone: e.target.value})} />
                        <div className="flex gap-2">
                           <input placeholder="IMEI Numarası (15 Hane)" className="w-full p-4 bg-slate-50 rounded-xl text-sm font-semibold border border-slate-200 outline-none focus:border-blue-500" value={customer.imei} maxLength={15} onChange={(e) => setCustomer({...customer, imei: e.target.value.replace(/\D/g, '')})} />
                           {customer.imei.length === 15 && (
                             <button onClick={() => window.open(`https://www.turkiye.gov.tr/imei-sorgulama`, '_blank')} className="bg-slate-900 text-white px-4 rounded-xl text-xs font-bold whitespace-nowrap btn-click">BTK Sorgula</button>
                           )}
                        </div>
                   </div>
                   <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 space-y-3">
                      <p className="text-xs font-bold text-slate-500 uppercase border-b pb-2 mb-4">Ekspertiz Onay Listesi</p>
                      {["iCloud / Google Çıkış Yapıldı", "Bul Özelliği Kapatıldı", "Kayıt Kontrolü Yapıldı", "Cihaz Sıfırlandı"].map(item => (
                         <label key={item} className="flex items-center gap-3 text-sm font-semibold text-slate-700 cursor-pointer">
                            <input type="checkbox" className="w-5 h-5 accent-blue-600 rounded border-slate-300" /> {item}
                         </label>
                      ))}
                   </div>
                </div>
              </div>

              {/* SEÇİM KUTULARI */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <p className="text-xs font-bold mb-3 text-slate-500 uppercase">Hafıza Kapasitesi</p>
                <div className="flex flex-wrap gap-3">
                  {db.filter(i => i.name === selectedModelName).map(c => (
                    <button key={c.cap} onClick={() => setSelectedCapacity(c)} className={`px-6 py-3 rounded-lg font-bold text-sm transition-colors btn-click ${selectedCapacity?.cap === c.cap ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{c.cap}</button>
                  ))}
                </div>
              </div>

              {[
                { label: "Cihaz Açılıyor mu?", field: "power", opts: ['Evet', 'Hayır'] },
                { label: "Garanti Durumu", field: "warranty", opts: ['Üretici Garantili', 'Yenilenmiş Cihaz', 'Garanti Yok'] },
                { label: "Ekran Durumu", field: "screen", opts: ['Sağlam', 'Çizikler var', 'Kırık / Orijinal Değil'] },
                { label: "Kasa Kozmetik Durumu", field: "cosmetic", opts: ['Mükemmel', 'İyi', 'Kötü'] },
                { label: "Biyometrik (Face ID / Touch ID)", field: "faceId", opts: ['Evet', 'Hayır'] },
                { label: "Pil Sağlığı", field: "battery", opts: ['95-100', '85-95', '0-85', 'Bilinmeyen Parça'] },
                { label: "Cihaz Kayıt Durumu", field: "sim", opts: ['Fiziksel SIM (TR)', 'Fiziksel + eSIM (YD)'] }
              ].map(q => (
                <div key={q.field} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                  <p className="text-xs font-bold mb-3 text-slate-500 uppercase">{q.label}</p>
                  <div className="flex flex-wrap gap-3">
                    {q.opts.map((opt) => (
                      <button key={opt} onClick={() => setStatus({...status, [q.field]: opt})} className={`py-3 px-5 rounded-lg text-sm font-bold border transition-colors btn-click ${status[q.field] === opt ? 'bg-blue-50 text-blue-700 border-blue-500' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}>{opt}</button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* SAĞ PANEL: OKUNAKLI VE DÜZGÜN FİYATLAMA */}
            <div className="lg:w-80 space-y-6 sticky top-24 h-fit">
              {isYd ? (
                <div className="bg-red-50 p-6 rounded-2xl border border-red-200 text-center">
                  <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4 font-bold text-xl">!</div>
                  <p className="text-lg font-black text-red-700 uppercase">Yurtdışı Cihaz</p>
                  <p className="text-xs font-bold text-red-500 mt-2">Alım işlemi için yönetici onayı gereklidir.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* NAKİT KUTUSU */}
                  <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 text-center">
                    <p className="text-xs font-bold text-slate-500 uppercase mb-2">Nakit Ödeme Tutarı</p>
                    <div className="text-4xl font-black text-slate-900 tracking-tight">
                       {selectedCapacity && allSelected ? `${prices.cash.toLocaleString()} TL` : '---'}
                    </div>
                  </div>
                  {/* TAKAS KUTUSU */}
                  <div className="bg-blue-600 p-8 rounded-2xl shadow-sm border border-blue-700 text-center text-white">
                    <p className="text-xs font-bold text-blue-200 uppercase mb-2">Takas / Hediye Çeki Değeri</p>
                    <div className="text-4xl font-black tracking-tight">
                       {selectedCapacity && allSelected ? `${prices.trade.toLocaleString()} TL` : '---'}
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-3">
                <button disabled={!canProceed} onClick={() => handleFinalProcess('print')} className={`w-full py-4 rounded-xl font-bold text-sm transition-colors btn-click ${canProceed ? 'bg-slate-900 text-white hover:bg-slate-800' : 'btn-disabled bg-slate-300 text-slate-500'}`}>Sözleşme Yazdır</button>
                <button disabled={!canProceed} onClick={() => handleFinalProcess('whatsapp')} className={`w-full py-4 rounded-xl font-bold text-sm transition-colors btn-click ${canProceed ? 'bg-green-600 text-white hover:bg-green-700' : 'btn-disabled bg-slate-300 text-slate-500'}`}>Sisteme Kaydet & WhatsApp</button>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="max-w-6xl mx-auto px-6 py-12 text-center print:hidden border-t border-slate-200 mt-12">
        <p className="text-xs font-bold text-slate-400">CNETMOBIL CMR Bilişim Sistemleri</p>
      </footer>

      {/* SÖZLEŞME ÇIKTISI - RESMİ VE DETAYLI */}
      <div id="print-area">
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', borderBottom:'2px solid black', paddingBottom:'15px', marginBottom:'20px'}}>
            <div>
              <h1 style={{fontSize:'28px', fontWeight:'900', margin:0}}>CNETMOBIL BİLİŞİM</h1>
              <p style={{fontSize:'12px', fontWeight:'bold', textTransform:'uppercase', margin:0, color:'#333'}}>İkinci El Cihaz Alım - Satım ve Teslim Tesellüm Tutanağı</p>
            </div>
            <div style={{textAlign:'right', fontSize:'11px', fontWeight:'bold'}}>
              <p style={{fontSize:'14px', fontWeight:'900', textTransform:'uppercase', margin:0}}>{selectedBranch}</p>
              <p>Tarih: {new Date().toLocaleDateString('tr-TR')}</p>
              <p>Saat: {new Date().toLocaleTimeString('tr-TR', {hour:'2-digit', minute:'2-digit'})}</p>
            </div>
          </div>
          
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'30px', marginBottom:'20px'}}>
            <div style={{border:'1px solid black', padding:'15px', borderRadius:'8px'}}>
              <h3 style={{fontSize:'14px', fontWeight:'900', textTransform:'uppercase', marginBottom:'10px', borderBottom:'1px solid #ccc', paddingBottom:'5px'}}>SATICI (MÜŞTERİ) BİLGİLERİ</h3>
              <div style={{fontSize:'12px', fontWeight:'bold', lineHeight:'1.8'}}>
                <p>Ad Soyad: <span style={{textTransform:'uppercase'}}>{customer.name || '___________________________'}</span></p>
                <p>İrtibat No: {customer.phone || '___________________________'}</p>
                <p>T.C. Kimlik No: ___________________________</p>
                <p>İmza: </p>
              </div>
            </div>
            
            <div style={{border:'1px solid black', padding:'15px', borderRadius:'8px'}}>
              <h3 style={{fontSize:'14px', fontWeight:'900', textTransform:'uppercase', marginBottom:'10px', borderBottom:'1px solid #ccc', paddingBottom:'5px'}}>CİHAZ VE EKSPERTİZ BİLGİLERİ</h3>
              <div style={{fontSize:'11px', fontWeight:'bold', lineHeight:'1.6'}}>
                <p>Cihaz Modeli: <span style={{fontSize:'13px', fontWeight:'900'}}>{selectedModelName} {selectedCapacity?.cap}</span></p>
                <p>IMEI Numarası: <span style={{fontSize:'13px', fontWeight:'900'}}>{customer.imei || '___________________________'}</span></p>
                <div style={{marginTop:'10px', borderTop:'1px dashed #999', paddingTop:'10px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:'5px'}}>
                   <p>Güç Durumu: <span>{status.power || '___'}</span></p>
                   <p>Ekran: <span>{status.screen || '___'}</span></p>
                   <p>Kasa Kozmetik: <span>{status.cosmetic || '___'}</span></p>
                   <p>Face/Touch ID: <span>{status.faceId || '___'}</span></p>
                   <p>Pil Sağlığı: <span>{status.battery || '___'}</span></p>
                   <p>Garanti: <span>{status.warranty || '___'}</span></p>
                   <p>Kayıt: <span>{status.sim || '___'}</span></p>
                </div>
              </div>
            </div>
          </div>

          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'20px', marginBottom:'30px', textAlign:'center'}}>
              <div style={{border:'2px solid black', padding:'15px', borderRadius:'8px'}}>
                <p style={{fontSize:'11px', fontWeight:'900', textTransform:'uppercase', margin:'0 0 5px 0'}}>Ödenecek Nakit Tutarı</p>
                <p style={{fontSize:'24px', fontWeight:'900', margin:0}}>{prices.cash.toLocaleString()} TL</p>
              </div>
              <div style={{border:'2px solid black', padding:'15px', borderRadius:'8px', backgroundColor:'#f5f5f5'}}>
                <p style={{fontSize:'11px', fontWeight:'900', textTransform:'uppercase', margin:'0 0 5px 0'}}>Takas Bedeli</p>
                <p style={{fontSize:'24px', fontWeight:'900', margin:0}}>{prices.trade.toLocaleString()} TL</p>
              </div>
          </div>

          <div style={{fontSize:'10px', fontWeight:'bold', textAlign:'justify', lineHeight:'1.5', border:'1px solid black', padding:'15px', borderRadius:'8px', marginBottom:'40px'}}>
            <p style={{fontWeight:'900', marginBottom:'5px', fontSize:'11px', textTransform:'uppercase'}}>HUKUKİ BEYAN VE TAAHHÜTNAME</p>
            Yukarıda marka, model ve IMEI/Seri numarası belirtilen cihazı CNETMOBIL yetkilisine kendi rızamla, belirtilen bedel mukabilinde sattığımı/teslim ettiğimi beyan ederim. 
            Cihazın mülkiyetinin tamamen şahsıma ait olduğunu, üzerinde herhangi bir haciz, rehin veya hukuki kısıtlama bulunmadığını, çalıntı veya suç unsuru taşımadığını kabul ve taahhüt ederim. 
            Cihazın daha önce veya tarafımdan kullanıldığı süre zarfında herhangi bir yasadışı işleme (Bilişim suçları, dolandırıcılık, terör vb.) karışmış olması durumunda tüm cezai ve hukuki sorumluluğun şahsıma ait olduğunu, firmanın bu tür durumlardan doğacak maddi/manevi zararlarını karşılayacağımı beyan ederim. 
            Cihaz içerisinde bulunan tüm kişisel verilerimin, hesaplarımın ve şifrelerimin yedeğini aldığımı, cihazın sıfırlanmasına onay verdiğimi ve veri kaybından dolayı firmadan hiçbir hak talep etmeyeceğimi kabul ve beyan ederim.
          </div>

          <div style={{display:'flex', justifyContent:'space-between', padding:'0 50px', textAlign:'center'}}>
            <div>
              <p style={{fontWeight:'900', fontSize:'14px', textTransform:'uppercase'}}>CİHAZI SATAN (MÜŞTERİ)</p>
              <p style={{fontSize:'11px', marginTop:'5px'}}>Ad Soyad / İmza</p>
            </div>
            <div>
              <p style={{fontWeight:'900', fontSize:'14px', textTransform:'uppercase'}}>TESLİM ALAN YETKİLİ</p>
              <p style={{fontSize:'11px', marginTop:'5px'}}>Kaşe / İmza</p>
            </div>
          </div>
      </div>
    </div>
  );
}
