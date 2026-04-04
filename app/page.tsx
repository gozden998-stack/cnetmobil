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
    "Huawei": { logo: "https://upload.wikimedia.org/wikipedia/commons/0/00/Huawei_Logo.svg" },
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

  const updateConfig = async (key: string, val: string) => {
    try {
      await fetch(SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify({ type: "UPDATE_CONFIG", key, val }) });
      setConfig((prev: any) => ({...prev, [key]: parseFloat(val)}));
    } catch (e) { console.error(e); }
  };

  const adminAddDevice = async () => {
    if(!newDevice.name || !newDevice.base) return alert("Eksik bilgi!");
    try {
      await fetch(SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify({ type: "ADD_DEVICE", ...newDevice }) });
      alert("Cihaz eklendi!");
      setNewDevice({ brand: 'Apple', name: '', cap: '', base: '', img: '', minPrice: '0' });
      setTimeout(loadData, 1500);
    } catch (e) { console.error(e); }
  };

  const isYd = status.sim === 'Fiziksel + eSIM (YD)';
  const allSelected = Object.values(status).every(v => v !== null) && selectedCapacity;
  const canProceed = allSelected;

  if (loading) return <div className="h-screen flex items-center justify-center font-bold text-blue-600 animate-pulse italic uppercase tracking-widest font-black">CMR SİSTEMİ YÜKLENİYOR...</div>;

  return (
    <div className="min-h-screen bg-[#f5f5f7] pb-20 font-sans text-slate-900">
      <style>{`
        #print-area { display: none !important; }
        @media print {
          header, main, footer, .print\\:hidden { display: none !important; }
          #print-area { display: block !important; visibility: visible !important; position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; background: white !important; color: black !important; margin: 0 !important; padding: 40px !important; }
          #print-area * { visibility: visible !important; }
        }
        .btn-click { transition: all 0.1s ease; cursor: pointer; }
        .btn-click:active { transform: scale(0.95); opacity: 0.7; }
        .btn-disabled { opacity: 0.3; cursor: not-allowed !important; pointer-events: none; }
      `}</style>

      <header className="p-4 bg-white border-b flex justify-between items-center sticky top-0 z-50 print:hidden shadow-sm">
        <h1 className="text-sm font-black italic text-blue-700 uppercase cursor-pointer btn-click" onClick={resetAll}>
          CNETMOBIL CMR
        </h1>
        <div className="flex items-center gap-4">
          <button onClick={() => setStep(99)} className="text-[10px] font-black uppercase text-slate-400 hover:text-black">Yönetici Paneli</button>
          <select value={selectedBranch} onChange={(e) => setSelectedBranch(e.target.value)} className="bg-slate-100 p-2 rounded-xl text-[9px] font-black outline-none border-none">
            {branches.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
          </select>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 mt-6 print:hidden">
        {step === 99 ? (
           <div className="animate-in fade-in duration-500">
             {!isAdmin ? (
               <div className="max-w-md mx-auto bg-white p-10 rounded-[40px] shadow-2xl text-center border">
                 <h2 className="text-2xl font-black italic mb-6 uppercase tracking-tighter text-slate-400">Admin Girişi</h2>
                 <input type="password" placeholder="Şifre" className="w-full p-4 bg-slate-100 rounded-2xl mb-4 text-center font-black outline-none border" onChange={(e) => setAdminPass(e.target.value)} />
                 <button onClick={() => adminPass === 'cnet1905' ? setIsAdmin(true) : alert("Hatalı!")} className="bg-black text-white px-10 py-4 rounded-2xl font-black uppercase w-full btn-click">Giriş</button>
               </div>
             ) : (
               <div className="space-y-8">
                 <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="bg-white p-8 rounded-[35px] shadow-xl border">
                      <h2 className="text-sm font-black italic text-orange-600 mb-4 uppercase">Fiyat Yüzdeleri (%)</h2>
                      <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                        {Object.keys(config).map(key => (
                          <div key={key} className="flex justify-between items-center border-b pb-2">
                            <span className="text-[10px] font-black text-slate-500 uppercase">{key.replace(/_/g,' ')}</span>
                            <input type="number" className="w-20 p-2 bg-slate-50 rounded-lg text-right font-black" value={config[key]} 
                              onChange={(e) => setConfig({...config, [key]: e.target.value})}
                              onBlur={(e) => updateConfig(key, e.target.value)} />
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="bg-white p-8 rounded-[35px] shadow-xl border">
                      <h2 className="text-sm font-black italic text-blue-600 mb-4 uppercase">Cihaz Ekleme</h2>
                      <div className="space-y-2">
                        <input placeholder="Marka" className="w-full p-3 bg-slate-50 rounded-xl text-xs font-black border outline-none" value={newDevice.brand} onChange={(e)=>setNewDevice({...newDevice, brand: e.target.value})} />
                        <input placeholder="Model" className="w-full p-3 bg-slate-50 rounded-xl text-xs font-black border outline-none" value={newDevice.name} onChange={(e)=>setNewDevice({...newDevice, name: e.target.value})} />
                        <input placeholder="Hafıza" className="w-full p-3 bg-slate-50 rounded-xl text-xs font-black border outline-none" value={newDevice.cap} onChange={(e)=>setNewDevice({...newDevice, cap: e.target.value})} />
                        <input placeholder="Alış Fiyatı" className="w-full p-3 bg-slate-50 rounded-xl text-xs font-black border outline-none" value={newDevice.base} onChange={(e)=>setNewDevice({...newDevice, base: e.target.value})} />
                        <button onClick={adminAddDevice} className="w-full py-4 bg-blue-600 text-white rounded-xl font-black uppercase text-[10px]">Veritabanına Gönder</button>
                      </div>
                    </div>
                 </div>

                 <div className="bg-white p-8 rounded-[35px] shadow-xl border">
                   <h2 className="text-xl font-black italic border-b-2 border-green-600 pb-2 mb-6 uppercase tracking-tighter">ALIM GEÇMİŞİ</h2>
                   <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 font-bold">
                     {[...alimlar].reverse().map((item, i) => (
                       <div key={i} className="bg-slate-50 p-4 rounded-2xl border flex justify-between items-center text-xs group transition-all hover:bg-white">
                         <div className="flex flex-col">
                            <span className="text-[9px] text-slate-400 font-black">{item.data[7] || 'Tarih Yok'}</span>
                            <p className="font-black text-blue-600 uppercase">{item.data[1]}</p>
                            <p>{item.data[3]}</p>
                         </div>
                         <div className="flex items-center gap-4">
                            <p className="font-black italic">{parseInt(item.data[5]||0).toLocaleString()} TL</p>
                            <button onClick={() => deleteAlim(item.sheetIndex)} className="text-red-500 hover:text-white hover:bg-red-600 font-black uppercase text-[10px] px-3 py-2 rounded-lg border border-red-100 transition-all">Sil</button>
                         </div>
                       </div>
                     ))}
                   </div>
                 </div>
                 <button onClick={() => {setStep(1); setIsAdmin(false);}} className="w-full py-5 bg-black text-white rounded-3xl font-black uppercase text-xs btn-click shadow-lg">Personel Ekranına Dön</button>
               </div>
             )}
           </div>
        ) : step === 1 ? (
           <div className="grid grid-cols-2 md:grid-cols-4 gap-6 animate-in fade-in zoom-in duration-500">
             {Array.from(new Set(db.map(i => i.brand))).map(brand => (
               <div key={brand} onClick={() => {setSelectedBrand(brand); setStep(2); resetSelection();}} className="bg-white p-8 rounded-[30px] shadow-sm hover:shadow-xl hover:scale-[1.03] transition-all cursor-pointer border border-slate-100 flex flex-col items-center justify-center text-center h-64 group btn-click">
                 <div className="h-20 w-full flex items-center justify-center mb-6 grayscale group-hover:grayscale-0 transition-all">
                   <img src={brandAssets[brand]?.logo || ""} className="max-h-full max-w-[120px] object-contain" alt={brand} />
                 </div>
                 <h2 className="font-black text-lg mb-1 uppercase italic tracking-tighter">{brand}</h2>
               </div>
             ))}
           </div>
        ) : step === 2 ? (
           <div className="animate-in slide-in-from-bottom-10">
             <button onClick={() => {setStep(1); resetSelection();}} className="mb-6 text-blue-600 font-black text-xs uppercase flex items-center gap-2 hover:bg-blue-50 p-2 rounded-lg transition-all btn-click">← MARKALARA DÖN</button>
             <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
               {Array.from(new Set(db.filter(i => i.brand === selectedBrand).map(i => i.name))).map(name => (
                 <div key={name} onClick={() => {setSelectedModelName(name); setStep(3); resetSelection();}} className="bg-white p-6 rounded-[25px] shadow-sm cursor-pointer hover:border-blue-500 border border-transparent transition-all text-center btn-click">
                   <img src={db.find(i => i.name === name)?.img} className="h-24 mx-auto mb-3 object-contain" />
                   <p className="font-black text-[10px] uppercase text-slate-700 tracking-tighter">{name}</p>
                 </div>
               ))}
             </div>
           </div>
        ) : (
          <div className="flex flex-col lg:flex-row gap-8 animate-in fade-in duration-500">
            <div className="flex-1 space-y-3">
              <button onClick={() => {setStep(2); resetSelection();}} className="mb-2 text-blue-600 font-black text-xs uppercase flex items-center gap-2 hover:bg-blue-50 p-2 rounded-lg transition-all btn-click">← MODELLERE DÖN</button>

              {/* GÜVENLİK VE MÜŞTERİ BİLGİLERİ PANELİ */}
              <div className="bg-white p-6 rounded-[25px] shadow-sm border border-red-50">
                <div className="flex justify-between items-center mb-4">
                  <p className="text-[10px] font-black text-red-600 uppercase italic underline tracking-widest flex items-center gap-2">
                    ⚠️ GÜVENLİK VE IMEI KONTROLÜ
                  </p>
                  {customer.imei.length === 15 && (
                    <button 
                      type="button"
                      onClick={() => window.open(`https://www.turkiye.gov.tr/imei-sorgulama`, '_blank')}
                      className="bg-blue-600 text-white px-4 py-2 rounded-xl text-[9px] font-black animate-pulse hover:bg-blue-700 transition-all"
                    >
                      E-DEVLET BTK SORGULA 🔍
                    </button>
                  )}
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* SOL SÜTUN: VERİ GİRİŞİ */}
                  <div className="space-y-3">
                    <input 
                      placeholder="Ad Soyad" 
                      className="w-full p-4 bg-slate-50 rounded-xl text-[11px] outline-none border border-slate-100 font-black uppercase focus:ring-2 focus:ring-blue-500" 
                      value={customer.name} 
                      onChange={(e)=>setCustomer({...customer, name: e.target.value})} 
                    />
                    <input 
                      placeholder="Telefon No" 
                      className="w-full p-4 bg-slate-50 rounded-xl text-[11px] outline-none border border-slate-100 font-black focus:ring-2 focus:ring-blue-500" 
                      value={customer.phone} 
                      onChange={(e)=>setCustomer({...customer, phone: e.target.value})} 
                    />
                    <input 
                      placeholder="15 Haneli IMEI Numarası" 
                      className="w-full p-4 bg-slate-50 rounded-xl text-[11px] outline-none border border-slate-100 font-black uppercase focus:ring-2 focus:ring-blue-500" 
                      value={customer.imei} 
                      maxLength={15}
                      onChange={(e) => setCustomer({...customer, imei: e.target.value.replace(/\D/g, '')})} 
                    />
                  </div>

                  {/* SAĞ SÜTUN: PERSONEL CHECK-LIST */}
                  <div className="bg-red-50 p-4 rounded-2xl border border-red-100 space-y-2">
                    <p className="text-[9px] font-black text-red-800 uppercase mb-2 italic">Zorunlu Güvenlik Adımları:</p>
                    {[
                      "iCloud / Google Hesabı Çıkışı Yapıldı",
                      "Bul (Find My) Özelliği Kapatıldı",
                      "BTK Sorgusu: Kayıtlı / İthalat Yoluyla",
                      "Ekran Şifresi ve Biyometrik Veriler Silindi"
                    ].map((item, idx) => (
                      <label key={idx} className="flex items-center gap-3 cursor-pointer group p-1">
                        <input type="checkbox" className="w-4 h-4 accent-red-600 rounded cursor-pointer shadow-sm" />
                        <span className="text-[10px] font-black text-slate-600 group-hover:text-red-700 transition-colors uppercase">{item}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-[30px] shadow-sm border border-slate-100 font-black">
                <p className="text-[10px] font-black mb-4 text-slate-400 uppercase tracking-widest">Hafıza</p>
                <div className="flex flex-wrap gap-2">
                  {db.filter(i => i.name === selectedModelName).map(c => (
                    <button key={c.cap} onClick={() => setSelectedCapacity(c)} className={`px-8 py-4 rounded-xl font-black text-[11px] transition-all btn-click ${selectedCapacity?.cap === c.cap ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-100 text-slate-400'}`}>{c.cap}</button>
                  ))}
                </div>
              </div>

              {[
                { label: "Cihaz Açılıyor mu?", field: "power", opts: ['Evet', 'Hayır'] },
                { label: "Garanti ve Durum", field: "warranty", opts: ['Üretici Garantili', 'Yenilenmiş Cihaz', 'Garanti Yok'] },
                { label: "Ekran Durumu", field: "screen", opts: ['Sağlam', 'Çizikler var', 'Kırık / Orijinal Değil'] },
                { label: "Kozmetik Durum", field: "cosmetic", opts: ['Mükemmel', 'İyi', 'Kötü'] },
                { label: "Face ID / Touch ID", field: "faceId", opts: ['Evet', 'Hayır'] },
                { label: "Batarya Durumu", field: "battery", opts: ['95-100', '85-95', '0-85', 'Bilinmeyen Parça'] },
                { label: "SIM Durumu", field: "sim", opts: ['Fiziksel SIM (TR)', 'Fiziksel + eSIM (YD)'] }
              ].map(q => (
                <div key={q.field} className="bg-white p-4 rounded-[20px] shadow-sm border border-slate-50">
                  <p className="text-[9px] font-black mb-3 text-slate-400 uppercase tracking-widest">{q.label}</p>
                  <div className="flex flex-wrap gap-2">
                    {q.opts.map((opt) => (
                      <button key={opt} onClick={() => setStatus({...status, [q.field]: opt})} className={`py-3 px-5 rounded-xl text-[10px] font-black border-2 transition-all btn-click ${status[q.field] === opt ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-white text-slate-400 border-slate-50'}`}>{opt}</button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="lg:w-80 space-y-4 sticky top-24 h-fit">
              {isYd ? (
                <div className="bg-red-600 p-8 rounded-[35px] shadow-2xl text-white text-center border-b-8 border-red-800 animate-pulse">
                  <p className="text-xl font-black uppercase italic leading-tight tracking-tighter">⚠️ YURT DIŞI CİHAZ (eSIM)</p>
                  <p className="text-xs mt-2 uppercase tracking-widest font-black">Yönetici Onayı Gerekli</p>
                </div>
              ) : (
                <>
                  <div className="bg-white p-8 rounded-[35px] shadow-xl border border-slate-100 text-center">
                    <p className="text-[10px] font-black text-slate-400 uppercase mb-2">Nakit Bedeli</p>
                    <div className="text-4xl font-black italic tracking-tighter">{selectedCapacity && allSelected ? `${prices.cash.toLocaleString()} TL` : '---'}</div>
                  </div>
                  <div className="bg-blue-700 p-8 rounded-[35px] shadow-xl text-center text-white">
                    <p className="text-[10px] font-black text-blue-200 uppercase mb-2 italic">Takas Değeri</p>
                    <div className="text-4xl font-black italic tracking-tighter">{selectedCapacity && allSelected ? `${prices.trade.toLocaleString()} TL` : '---'}</div>
                  </div>
                </>
              )}
              <div className="bg-slate-900 p-8 rounded-[35px] space-y-3 shadow-2xl border-t-4 border-blue-600">
                <button disabled={!canProceed} onClick={() => handleFinalProcess('print')} className={`w-full py-5 rounded-2xl font-black uppercase text-[10px] transition-all btn-click ${canProceed ? 'bg-white text-black hover:bg-slate-50' : 'btn-disabled bg-slate-800 text-slate-600'}`}>Sözleşme Yazdır</button>
                <button disabled={!canProceed} onClick={() => handleFinalProcess('whatsapp')} className={`w-full py-4 rounded-2xl font-black uppercase text-[10px] transition-all btn-click ${canProceed ? 'bg-green-600 text-white hover:bg-green-700' : 'btn-disabled bg-slate-800 text-slate-600'}`}>WhatsApp & Kaydet</button>
              </div>
            </div>
          </div>
        )}
      </main>

      <div id="print-area">
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'15px'}}>
            <div>
              <h1 style={{fontSize:'32px', fontWeight:'900', fontStyle:'italic', margin:0}}>CNETMOBIL CMR</h1>
              <p style={{fontSize:'10px', fontWeight:'bold', textTransform:'uppercase', margin:0}}>Kurumsal Teknik Servis ve Alim Merkezi</p>
            </div>
            <div style={{textAlign:'right', fontSize:'10px', fontWeight:'bold'}}>
              <p style={{fontSize:'14px', fontWeight:'900', textTransform:'uppercase', margin:0}}>{selectedBranch}</p>
              <p>{new Date().toLocaleDateString('tr-TR')} {new Date().toLocaleTimeString('tr-TR', {hour:'2-digit', minute:'2-digit'})}</p>
            </div>
          </div>
          <div style={{borderTop:'3px solid black', marginBottom:'20px'}}></div>
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'40px', marginBottom:'20px'}}>
            <div style={{borderBottom:'2px solid black', paddingBottom:'15px'}}>
              <h3 style={{fontSize:'16px', fontWeight:'900', textTransform:'uppercase', fontStyle:'italic', marginBottom:'10px'}}>Müşteri Bilgileri</h3>
              <div style={{fontSize:'12px', fontWeight:'bold', lineHeight:'1.8'}}>
                <p>Ad Soyad: <span style={{textTransform:'uppercase', fontWeight:'900'}}>{customer.name || '________________'}</span></p>
                <p>Telefon: {customer.phone || '________________'}</p>
                <p>T.C. No: ___________________________</p>
              </div>
            </div>
            <div style={{borderBottom:'2px solid black', paddingBottom:'15px'}}>
              <h3 style={{fontSize:'16px', fontWeight:'900', textTransform:'uppercase', fontStyle:'italic', marginBottom:'10px'}}>Cihaz Ekspertiz</h3>
              <div style={{fontSize:'12px', fontWeight:'bold', lineHeight:'1.8'}}>
                <p>Model: <span style={{fontWeight:'900'}}>{selectedModelName} {selectedCapacity?.cap}</span></p>
                <p>IMEI: <span style={{fontWeight:'900'}}>{customer.imei || '________________'}</span></p>
                {/* YENİ EKLENEN ÖZELLİK LİSTESİ */}
                <div style={{marginTop:'10px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:'5px 20px'}}>
                  {[
                    { label: "Cihaz Açılıyor mu?", field: "power" },
                    { label: "Garanti ve Durum", field: "warranty" },
                    { label: "Ekran Durumu", field: "screen" },
                    { label: "Kozmetik Durum", field: "cosmetic" },
                    { label: "Face ID / Touch ID", field: "faceId" },
                    { label: "Batarya Durumu", field: "battery" },
                    { label: "SIM Durumu", field: "sim" },
                  ].map((soru) => (
                    <p key={soru.field} style={{fontSize:'11px'}}>
                      {soru.label}: <span style={{fontWeight:'900'}}>{status[soru.field] || '____'}</span>
                    </p>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'20px', marginBottom:'40px', textAlign:'center'}}>
              <div style={{border:'3px solid black', padding:'20px', borderRadius:'20px'}}>
                <p style={{fontSize:'10px', fontWeight:'900', textTransform:'uppercase', marginBottom:'5px'}}>Nakit Alim</p>
                <p style={{fontSize:'32px', fontWeight:'900', fontStyle:'italic', margin:0}}>{prices.cash.toLocaleString()} TL</p>
              </div>
              <div style={{border:'3px solid black', padding:'20px', borderRadius:'20px', backgroundColor:'#f0f0f0'}}>
                <p style={{fontSize:'10px', fontWeight:'900', textTransform:'uppercase', marginBottom:'5px'}}>Takas Değeri</p>
                <p style={{fontSize:'32px', fontWeight:'900', fontStyle:'italic', margin:0}}>{prices.trade.toLocaleString()} TL</p>
              </div>
          </div>
          <div style={{fontSize:'10px', fontWeight:'900', fontStyle:'italic', lineHeight:'1.5', marginBottom:'80px', borderLeft:'5px solid black', paddingLeft:'20px'}}>
            BEYAN: İşbu formda belirtilen cihazın mülkiyeti şahsıma ait olup, cihazın yasal bir kısıtı olmadığını kabul ve beyan ederim. Cihazdaki verilerin silinmesinden ve hukuki süreçlerden satıcı sorumlu tutulamaz.
          </div>
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'100px', textAlign:'center'}}>
            <div style={{borderTop:'2px solid black', paddingTop:'10px', fontWeight:'900', fontSize:'14px', textTransform:'uppercase', fontStyle:'italic'}}>Müşteri İmza</div>
            <div style={{borderTop:'2px solid black', paddingTop:'10px', fontWeight:'900', fontSize:'14px', textTransform:'uppercase', fontStyle:'italic'}}>CNETMOBIL - {selectedBranch}</div>
          </div>
      </div>
    </div>
  );
}
