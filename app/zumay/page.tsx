
"use client";
import React, { useState, useEffect } from 'react';

// F12 KORUMASI AKTİF: Burada hiçbir gizli API anahtarı veya Google linki yoktur!
const ZUMAY_PASS = "ZUMAY123"; 

export default function ZumayPortal() {
  const [authLoading, setAuthLoading] = useState(true); 
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [entryPass, setEntryPass] = useState('');
  
  const selectedBranch = 'ZUMAY KANALI';
  const [appMode, setAppMode] = useState<'ana_sayfa' | 'alim' | 'dis_kanal'>('ana_sayfa');

  const [disKanalData, setDisKanalData] = useState<any[][]>([]);
  const [db, setDb] = useState<any[]>([]);
  const [brandDb, setBrandDb] = useState<any[]>([]);
  const [config, setConfig] = useState<any>({});
  const [loading, setLoading] = useState(true);
  
  const [step, setStep] = useState(1);
  const [selectedBrand, setSelectedBrand] = useState('');
  const [selectedModelName, setSelectedModelName] = useState('');
  const [selectedCapacity, setSelectedCapacity] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [customer, setCustomer] = useState({ name: '', phone: '', imei: '' });
  const [status, setStatus] = useState<any>({ power: null, screen: null, cosmetic: null, faceId: null, battery: null, sim: null, warranty: null, speaker: null });
  const [prices, setPrices] = useState({ cash: 0, trade: 0 });
  const [purchaseType, setPurchaseType] = useState<'NAKİT' | 'TAKAS' | 'ALINMADI' | null>(null);

  useEffect(() => {
    const sessionStr = localStorage.getItem('zumay_session');
    if (sessionStr === 'true') {
        setIsLoggedIn(true);
    }
    setAuthLoading(false);
  }, []);

  const handleLogin = () => {
    if (entryPass === ZUMAY_PASS) {
        setIsLoggedIn(true);
        localStorage.setItem('zumay_session', 'true');
    } else {
        alert("Hatalı Şifre!");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('zumay_session');
    setIsLoggedIn(false); 
    setEntryPass(''); 
  };

  const resetAll = () => {
    setStep(1); setSelectedBrand(''); setSelectedModelName(''); setSelectedCapacity(null);
    setSearchQuery(''); setCustomer({ name: '', phone: '', imei: '' });
    setStatus({ power: null, screen: null, cosmetic: null, faceId: null, battery: null, sim: null, warranty: null, speaker: null });
    setPurchaseType(null);
    if(typeof window !== 'undefined') window.scrollTo(0,0);
  };

  const resetSelection = () => {
    setSelectedCapacity(null);
    setSearchQuery(''); 
    setStatus({ power: null, screen: null, cosmetic: null, faceId: null, battery: null, sim: null, warranty: null, speaker: null });
    setPurchaseType(null);
    if(typeof window !== 'undefined') window.scrollTo(0,0);
  };

  // GÜNCELLENEN VERİ ÇEKME MANTIĞI
  const loadData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/zumay'); 
      const data = await res.json();
      
      // 1. Cihaz Verilerini İşle (data.devices.values)
      const deviceValues = data.devices?.values;
      if (deviceValues && Array.isArray(deviceValues)) {
        setDb(deviceValues.map((row: any) => ({
          brand: row[0] || '', 
          name: row[1] || '', 
          cap: row[2] || '',
          base: parseInt(row[3]) || 0, 
          img: row[4]?.trim() || '', 
          minPrice: parseInt(row[5]) || 0
        })));
      }

      // 2. Ayarları İşle (data.config.values)
      const configValues = data.config?.values;
      if (configValues && Array.isArray(configValues)) {
        const m: any = {};
        configValues.forEach((row: any) => { 
            m[row[0]] = isNaN(Number(row[1])) ? row[1] : parseFloat(row[1]); 
        });
        setConfig(m);
      }

      // 3. Markaları İşle (data.brands.values)
      const brandValues = data.brands?.values;
      if (brandValues && Array.isArray(brandValues)) {
        setBrandDb(brandValues.map((row: any) => ({ name: row[0], logo: row[1] })));
      }

      // 4. Dış Kanal Verilerini İşle (data.disKanal.values)
      if (data.disKanal?.values) {
        setDisKanalData(data.disKanal.values);
      }

      setLoading(false);
    } catch (e) { 
        setLoading(false); 
        console.error("Zumay veri yükleme hatası:", e);
    }
  };

  useEffect(() => { if(isLoggedIn) loadData(); }, [isLoggedIn]);

  useEffect(() => {
    if (selectedCapacity && config.Guc_Yok !== undefined) {
      let price = selectedCapacity.base;
      if (status.power === 'Hayır') price *= (1 - ((config.Guc_Yok || 0) / 100));
      if (status.screen === 'Kırık') price *= (1 - ((config.Ekran_Kirik || 0) / 100));
      if (status.screen === 'Çizikler var') price *= (1 - ((config.Ekran_Cizik || 0) / 100));
      if (status.cosmetic === 'İyi') price *= (1 - ((config.Kasa_Iyi || 0) / 100));
      if (status.cosmetic === 'Kötü') price *= (1 - ((config.Kasa_Kotu || 0) / 100));
      if (status.faceId === 'Hayır') price *= (1 - ((config.FaceID_Bozuk || 0) / 100));
      if (status.battery === '0-85') price *= (1 - ((config.Pil_Dusuk || 0) / 100));
      if (status.sim === 'Fiziksel + eSIM (YD)') price *= (1 - ((config.Yurt_Disi || 0) / 100));
      if (status.warranty === 'Yenilenmiş Cihaz') price *= (1 - ((config.Yenilenmis || 0) / 100));
      if (status.warranty === 'Garanti Yok') price *= (1 - ((config.Garanti_Yok || 0) / 100));

      let finalCash = Math.max(Math.round(price), selectedCapacity.minPrice || 0);
      finalCash = Math.round(finalCash * 0.92); // ZUMAY %8 İNDİRİMİ

      const finalTrade = Math.round(finalCash * (1 + ((config.Takas_Destegi || 0) / 100)));
      setPrices({ cash: finalCash, trade: finalTrade });
    }
  }, [status, selectedCapacity, config]); 

  const handleFinalProcess = async (actionType: 'NAKİT ALINDI' | 'TAKAS ALINDI' | 'ALINMADI') => {
    const dateTime = new Date().toLocaleString('tr-TR');
    const devicePayload = `${selectedModelName} (${selectedCapacity?.cap}) [${actionType}]`;

    try {
      await fetch('/api/zumay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: "SAVE_ALIM",
          branch: selectedBranch,
          customer: customer.name,
          device: devicePayload,
          imei: customer.imei,
          cash: prices.cash,
          trade: prices.trade,
          date: dateTime
        })
      });
      alert("İşlem başarıyla merkeze iletildi.");
      setTimeout(() => { resetAll(); }, 2000);
    } catch (e) { alert("Bağlantı hatası!"); }
  };

  const allSelected = Object.values(status).every(v => v !== null) && selectedCapacity;
  const canProceed = allSelected;

  const displayBrands = Array.from(new Set(["Apple", "Samsung", "Xiaomi", ...brandDb.map(b => b.name), ...db.map(i => i.brand)])).filter(brand => brand && brand.trim() !== "");

  if (authLoading) return <div className="h-screen bg-[#111111]"></div>;

  if (!isLoggedIn) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-[#111111] text-white p-6">
        <div className="w-full max-w-sm bg-[#1a1a24] p-10 rounded-[48px] border border-red-500/20 text-center">
           <div className="w-20 h-20 bg-red-600 rounded-3xl flex items-center justify-center mx-auto mb-8 text-4xl font-black italic shadow-lg shadow-red-500/20">Z</div>
           <h1 className="text-2xl font-black italic mb-8">ZUMAY <span className="text-red-500">GİRİŞİ</span></h1>
           <input type="password" placeholder="Şifreniz" value={entryPass} onChange={(e) => setEntryPass(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleLogin()} className="w-full p-6 bg-black/50 rounded-2xl mb-6 text-center font-black text-2xl outline-none border border-slate-800 focus:border-red-500 text-white" />
           <button onClick={handleLogin} className="w-full py-6 bg-red-600 text-white rounded-2xl font-black uppercase text-sm tracking-widest hover:bg-red-500">SİSTEMİ AÇ</button>
        </div>
      </div>
    );
  }

  if (loading) return <div className="h-screen flex items-center justify-center bg-[#111111] text-white font-black tracking-widest uppercase">Veriler Çekiliyor...</div>;

  return (
    <div className="flex flex-col md:flex-row min-h-screen font-sans bg-[#111111] text-white">
      <nav className="w-full md:w-[280px] bg-[#0a0a0f] border-r border-white/5 flex flex-col shrink-0">
        <div className="p-8 pb-4">
          <div onClick={resetAll} className="flex items-center gap-4 cursor-pointer">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center shadow-lg"><span className="font-black italic text-xl">Z</span></div>
            <div><h1 className="text-xl font-black text-red-500">ZUMAY</h1><p className="text-[9px] text-slate-500 mt-1">BAYİ PORTALI</p></div>
          </div>
        </div>
        <div className="flex-1 px-4 mt-8 space-y-2">
            <button onClick={() => {setAppMode('ana_sayfa'); resetAll();}} className={`w-full flex items-center px-4 py-4 rounded-xl text-xs font-bold uppercase transition-all ${appMode === 'ana_sayfa' ? 'bg-red-600/10 text-red-500 border-l-2 border-red-500' : 'text-slate-400 hover:bg-white/5'}`}>Ana Sayfa</button>
            <button onClick={() => {setAppMode('alim'); resetAll();}} className={`w-full flex items-center px-4 py-4 rounded-xl text-xs font-bold uppercase transition-all ${appMode === 'alim' ? 'bg-red-600/10 text-red-500 border-l-2 border-red-500' : 'text-slate-400 hover:bg-white/5'}`}>Cihaz Alımı</button>
            <button onClick={() => {setAppMode('dis_kanal'); resetAll();}} className={`w-full flex items-center px-4 py-4 rounded-xl text-xs font-bold uppercase transition-all ${appMode === 'dis_kanal' ? 'bg-red-600/10 text-red-500 border-l-2 border-red-500' : 'text-slate-400 hover:bg-white/5'}`}>Dış Kanal Listesi</button>
        </div>
        <div className="p-6 border-t border-white/5">
            <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10">
                <span className="text-[10px] font-black text-slate-400">ZUMAY KANALI</span>
                <button onClick={handleLogout} className="text-red-500 hover:text-red-400 text-[10px] font-black uppercase">Çıkış</button>
            </div>
        </div>
      </nav>

      <main className="flex-1 p-6 md:p-10 h-screen overflow-y-auto">
        {appMode === 'ana_sayfa' ? (
             <div className="flex flex-col items-center justify-center min-h-[70vh] space-y-8 animate-in fade-in duration-500">
                <div className="w-24 h-24 bg-red-600 rounded-3xl flex items-center justify-center text-white text-5xl font-black italic">Z</div>
                <h2 className="text-4xl font-black italic uppercase text-center">ZUMAY <span className="text-red-600">BAYİ PORTALI</span></h2>
                <button onClick={() => {setAppMode('alim'); setStep(1);}} className="bg-red-600 text-white px-8 py-5 rounded-2xl font-black uppercase tracking-widest mt-8 hover:bg-red-500 transition-all">CİHAZ ALIMI YAP</button>
             </div>
        ) : appMode === 'dis_kanal' ? (
            <div className="bg-[#1e1e2d] p-6 md:p-10 rounded-[48px] border border-slate-800 animate-in fade-in duration-500">
                <h2 className="text-3xl font-black italic text-red-500 mb-8 uppercase">DIŞ KANAL LİSTESİ</h2>
                <div className="bg-red-700 px-4 py-3 rounded-t-2xl flex font-black text-[10px] uppercase">
                    <div className="flex-[3]">ÜRÜN ADI</div><div className="flex-1 text-center">FİYAT</div>
                </div>
                <div className="bg-[#2a2a3d] rounded-b-2xl border border-slate-700 max-h-[60vh] overflow-y-auto custom-scrollbar">
                    {disKanalData.slice(1).map((row, i) => (
                        <div key={i} className="flex px-4 py-3 border-b border-slate-700 text-sm font-bold">
                            <div className="flex-[3]">{row[0]}</div><div className="flex-1 text-center text-red-400">{row[1] || '-'}</div>
                        </div>
                    ))}
                </div>
            </div>
        ) : (
            step === 1 ? (
                <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
                    <h2 className="text-5xl font-black italic text-center mb-10 uppercase">CİHAZ <span className="text-red-600">ALIM</span></h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                        {displayBrands.map(brand => {
                            const hasModels = db.some(i => i.brand === brand);
                            return (
                                <div key={brand} onClick={() => { if(hasModels) { setSelectedBrand(brand); setStep(2); } }} className={`bg-[#1e1e2d] p-8 rounded-[40px] border flex flex-col items-center justify-center text-center h-64 transition-all ${hasModels ? 'border-slate-700 hover:border-red-500 cursor-pointer hover:scale-105' : 'opacity-50 border-slate-800'}`}>
                                    <h2 className="font-black text-xl mb-2 uppercase italic">{brand}</h2>
                                    <p className="text-[10px] text-slate-500 font-black uppercase">{hasModels ? 'SEÇ' : 'YAKINDA'}</p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            ) : step === 2 ? (
                <div className="space-y-8 animate-in slide-in-from-right-4 duration-500">
                    <button onClick={() => setStep(1)} className="text-slate-400 text-[10px] font-black uppercase hover:text-white transition-all">← Markalara Dön</button>
                    <h2 className="text-3xl font-black italic uppercase">{selectedBrand} Modelleri</h2>
                    <input type="text" placeholder="Model Ara..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full p-4 bg-[#1e1e2d] border border-slate-700 rounded-2xl outline-none focus:border-red-500 text-white font-black" />
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {Array.from(new Set(db.filter(i => i.brand === selectedBrand).map(i => i.name)))
                        .filter(name => name.toLowerCase().includes(searchQuery.toLowerCase()))
                        .map(name => (
                            <div key={name} onClick={() => {setSelectedModelName(name); setStep(3);}} className="bg-[#1e1e2d] p-6 rounded-[24px] border border-slate-700 hover:border-red-500 cursor-pointer text-center transition-all hover:bg-slate-800">
                                <p className="font-black text-xs uppercase italic">{name}</p>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="flex flex-col lg:flex-row gap-8 animate-in fade-in duration-500">
                    <div className="flex-1 space-y-6">
                        <button onClick={() => setStep(2)} className="text-slate-400 text-[10px] font-black uppercase hover:text-white mb-4">← Modellere Dön</button>
                        <div className="bg-[#1e1e2d] p-6 md:p-8 rounded-[40px] border border-slate-700 space-y-6">
                            <h3 className="text-xl font-black italic text-red-500 uppercase">Müşteri Bilgileri</h3>
                            <input placeholder="Ad Soyad" value={customer.name} onChange={(e)=>setCustomer({...customer, name: e.target.value})} className="w-full p-4 bg-[#131722] rounded-xl outline-none focus:border-red-500 border border-slate-700 text-white font-black uppercase" />
                            <input placeholder="Telefon" value={customer.phone} onChange={(e)=>setCustomer({...customer, phone: e.target.value})} className="w-full p-4 bg-[#131722] rounded-xl outline-none focus:border-red-500 border border-slate-700 text-white font-black" />
                            <input placeholder="IMEI" maxLength={15} value={customer.imei} onChange={(e)=>setCustomer({...customer, imei: e.target.value.replace(/\D/g, '')})} className="w-full p-4 bg-[#131722] rounded-xl outline-none focus:border-red-500 border border-slate-700 text-white font-black" />
                        </div>
                        <div className="bg-[#1e1e2d] p-6 rounded-[40px] border border-slate-700">
                            <p className="text-[10px] font-black mb-4 text-slate-400 uppercase">Hafıza Kapasitesi</p>
                            <div className="flex flex-wrap gap-3">
                                {db.filter(i => i.name === selectedModelName).map(c => (
                                    <button key={c.cap} onClick={() => setSelectedCapacity(c)} className={`px-6 py-3 rounded-xl font-black text-[10px] transition-all ${selectedCapacity?.cap === c.cap ? 'bg-red-600 text-white' : 'bg-[#131722] text-slate-400 hover:text-white'}`}>{c.cap}</button>
                                ))}
                            </div>
                        </div>
                        {[
                            { label: "Cihaz Açılıyor mu?", field: "power", opts: ['Evet', 'Hayır'] },
                            { label: "Garanti", field: "warranty", opts: ['Üretici Garantili', 'Yenilenmiş Cihaz', 'Garanti Yok'] },
                            { label: "Ekran Durumu", field: "screen", opts: ['Sağlam', 'Çizikler var', 'Kırık'] },
                            { label: "Kozmetik Durum", field: "cosmetic", opts: ['Mükemmel', 'İyi', 'Kötü'] },
                            { label: "Face ID", field: "faceId", opts: ['Evet', 'Hayır'] },
                            { label: "Batarya", field: "battery", opts: ['95-100', '85-95', '0-85'] },
                            { label: "Kayıt", field: "sim", opts: ['Fiziksel SIM (TR)', 'Fiziksel + eSIM (YD)'] }
                        ].map(q => (
                            <div key={q.field} className="bg-[#1e1e2d] p-6 rounded-[32px] border border-slate-700">
                                <p className="text-[10px] font-black mb-4 text-slate-400 uppercase tracking-widest">{q.label}</p>
                                <div className="flex flex-wrap gap-3">
                                    {q.opts.map((opt) => (
                                        <button key={opt} onClick={() => setStatus({...status, [q.field]: opt})} className={`py-3 px-5 rounded-xl text-[10px] font-black border-2 transition-all ${status[q.field] === opt ? 'bg-white text-black border-white' : 'bg-transparent text-slate-400 border-slate-700 hover:border-slate-400'}`}>{opt}</button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="lg:w-96 space-y-6 sticky top-10 h-fit">
                        <div className="bg-[#1e1e2d] p-8 rounded-[40px] border border-slate-700 text-center shadow-2xl">
                            <p className="text-[10px] text-slate-400 font-black uppercase mb-2">Nakit Teklifi</p>
                            <p className="text-4xl font-black italic">{allSelected ? `${prices.cash.toLocaleString()} TL` : '---'}</p>
                        </div>
                        <div className="bg-red-600 p-8 rounded-[40px] text-center text-white shadow-2xl shadow-red-600/20">
                            <p className="text-[10px] text-red-200 font-black uppercase mb-2">Takas Teklifi</p>
                            <p className="text-4xl font-black italic">{allSelected ? `${prices.trade.toLocaleString()} TL` : '---'}</p>
                        </div>
                        <div className="bg-[#1a1a24] p-8 rounded-[40px] space-y-4 shadow-2xl">
                            <button disabled={!canProceed || purchaseType !== null} onClick={() => { setPurchaseType('NAKİT'); handleFinalProcess('NAKİT ALINDI'); }} className={`w-full py-4 rounded-xl font-black uppercase text-[11px] transition-all ${!canProceed ? 'opacity-30 bg-slate-800' : 'bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-600/20'}`}>✓ Nakit Alındı</button>
                            <button disabled={!canProceed || purchaseType !== null} onClick={() => { setPurchaseType('TAKAS'); handleFinalProcess('TAKAS ALINDI'); }} className={`w-full py-4 rounded-xl font-black uppercase text-[11px] transition-all ${!canProceed ? 'opacity-30 bg-slate-800' : 'bg-purple-600 hover:bg-purple-500 shadow-lg shadow-purple-600/20'}`}>🔄 Takas Alındı</button>
                            <button disabled={!canProceed || purchaseType !== null} onClick={() => { setPurchaseType('ALINMADI'); handleFinalProcess('ALINMADI'); }} className={`w-full py-4 rounded-xl font-black uppercase text-[11px] transition-all ${!canProceed ? 'opacity-30 bg-slate-800' : 'bg-slate-800 text-red-400 hover:bg-red-600 hover:text-white'}`}>✕ Alınmadı</button>
                        </div>
                    </div>
                </div>
            )
        )}
      </main>
    </div>
  );
}
