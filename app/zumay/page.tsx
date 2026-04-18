"use client";
import React, { useState, useEffect } from 'react';
import AnaSayfa from './AnaSayfa';

const SHEET_ID = process.env.NEXT_PUBLIC_SHEET_ID as string;
const API_KEY = process.env.NEXT_PUBLIC_API_KEY as string;
const TABLO_ISMI = 'Google Sheets ile Kurumsal Alım Sistemi'; 
const SCRIPT_URL = process.env.NEXT_PUBLIC_SCRIPT_URL as string;
const MASTER_ADMIN_PASS = process.env.NEXT_PUBLIC_ADMIN_PASS as string;

const IP_HARITASI: any = {
  "78.188.91.172": "CMR SARAY",
  "46.197.252.143": "CMR KAPAKLI",
  "31.155.79.145": "CMR MERKEZ",
  "149.0.18.162": "CMR CADDE"
};

const MASTER_IPLER = [
  "95.70.226.118",
  "148.0.18.162"
];

// .env ve manuel eklenen şifreler
let BRANCH_PASSWORDS: Record<string, string> = {
  "5959": "ZUMAY KANALI" // Manuel eklenen Zumay şifresi
};

try {
  if (process.env.NEXT_PUBLIC_BRANCH_PASSWORDS) {
    const envPass = JSON.parse(process.env.NEXT_PUBLIC_BRANCH_PASSWORDS);
    BRANCH_PASSWORDS = { ...BRANCH_PASSWORDS, ...envPass };
  }
} catch (error) {
  console.error("Şube şifreleri yüklenirken hata oluştu:", error);
}

export default function CnetmobilCmrFinalUltimate() {
  const [authLoading, setAuthLoading] = useState(true); 
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [entryPass, setEntryPass] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  
  const [loginMode, setLoginMode] = useState<'personel' | 'yonetici'>('personel');
  const [isMasterAccess, setIsMasterAccess] = useState(false);
  
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [appMode, setAppMode] = useState<'ana_sayfa' | 'alim' | 'servis' | 'cep_tablet' | 'yna_list' | 'dis_kanal' | 'ikinci_el' | 'imei_list' | 'kampanya_sifir'>('ana_sayfa');

  const [cepTabletData, setCepTabletData] = useState<any[][]>([]);
  const [ynaData, setYnaData] = useState<any[][]>([]);
  const [disKanalData, setDisKanalData] = useState<any[][]>([]);
  const [ikinciElData, setIkinciElData] = useState<any[][]>([]); 
  const [imeiData, setImeiData] = useState<any[][]>([]);

  const [servisFiyatlari, setServisFiyatlari] = useState<Record<string, {ekran?: string, ekranOrj?: string, ekranOled?: string, ekranCipli?: string, batarya?: string, arkaCam?: string, kasa?: string}>>({});
  const [servisForm, setServisForm] = useState({model: '', ekran: '', ekranOrj: '', ekranOled: '', ekranCipli: '', batarya: '', arkaCam: '', kasa: ''});

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
  const [status, setStatus] = useState<any>({ power: null, screen: null, cosmetic: null, faceId: null, battery: null, sim: null, warranty: null, speaker: null });
  const [prices, setPrices] = useState({ cash: 0, trade: 0 });
  const [isCustomOfferActive, setIsCustomOfferActive] = useState(false);
  const [customOffer, setCustomOffer] = useState<string>('');
  
  const [isCustomTradeOfferActive, setIsCustomTradeOfferActive] = useState(false);
  const [customTradeOffer, setCustomTradeOffer] = useState<string>('');
  
  const [purchaseType, setPurchaseType] = useState<'NAKİT' | 'TAKAS' | 'ALINMADI' | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminPass, setAdminPass] = useState('');
  const [newDevice, setNewDevice] = useState({ brand: 'Apple', name: '', cap: '', base: '', img: '', minPrice: '0' });
  const [isInstallmentModalOpen, setIsInstallmentModalOpen] = useState(false);
  const [installmentAmount, setInstallmentAmount] = useState('');
  
  const [adminSelectedBranch, setAdminSelectedBranch] = useState<string>('TÜM ŞUBELER');
  const [dateFilterType, setDateFilterType] = useState<string>('TÜM ZAMANLAR');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [isDateDropdownOpen, setIsDateDropdownOpen] = useState(false);

  const [ekspertizModalData, setEkspertizModalData] = useState<{customer: string, device: string, data: string} | null>(null);

  // ZUMAY KONTROLÜ
  const isZumay = selectedBranch === "ZUMAY KANALI";

  const branches = [
    { name: "CMR CADDE", phone: "905443214534" },
    { name: "CMR MERKEZ", phone: "905416801905" },
    { name: "CMR KAPAKLI", phone: "905327005959" },
    { name: "CMR SARAY", phone: "905416801905" },
    { name: "VODAFONE KANALI", phone: "905425420000" },
    { name: "ZUMAY KANALI", phone: "905000000000" }
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

  useEffect(() => {
    const verifySession = async () => {
      if (typeof window === 'undefined') return;
      const sessionStr = localStorage.getItem('cnet_session');
      if (!sessionStr) { setAuthLoading(false); return; }

      try {
        const session = JSON.parse(sessionStr);
        if (session.mode === 'yonetici') {
          setIsMasterAccess(true); setIsAdmin(true); 
          setSelectedBranch(session.branch || 'CMR MERKEZ');
          setIsLoggedIn(true); setAuthLoading(false); return;
        }

        if (session.mode === 'personel') {
          if (session.branch === 'VODAFONE KANALI' || session.branch === 'ZUMAY KANALI') {
            setSelectedBranch(session.branch);
            setIsLoggedIn(true); setAuthLoading(false); return;
          }

          const res = await fetch('https://api.ipify.org?format=json');
          const data = await res.json();
          const currentIp = data.ip;

          if (MASTER_IPLER.includes(currentIp) || IP_HARITASI[currentIp] === session.branch) {
            setSelectedBranch(session.branch); setIsLoggedIn(true);
          } else {
            localStorage.removeItem('cnet_session');
          }
        }
      } catch (e) { localStorage.removeItem('cnet_session'); }
      setAuthLoading(false);
    };
    verifySession();
  }, []);

  const handleLogin = async () => {
    if(!entryPass) return;
    setLoginLoading(true);

    try {
      if (loginMode === 'yonetici') {
        if (entryPass === MASTER_ADMIN_PASS) {
           setIsMasterAccess(true); setIsAdmin(true);
           setSelectedBranch('CMR MERKEZ'); setIsLoggedIn(true);
           localStorage.setItem('cnet_session', JSON.stringify({ mode: 'yonetici', branch: 'CMR MERKEZ' }));
        } else { alert("Hatalı Yönetici Şifresi!"); }
        setLoginLoading(false); return;
      }

      const matchedBranch = BRANCH_PASSWORDS[entryPass];
      if (!matchedBranch) { alert("Hatalı Şube Şifresi!"); setLoginLoading(false); return; }

      if (matchedBranch === 'VODAFONE KANALI' || matchedBranch === 'ZUMAY KANALI') {
        setSelectedBranch(matchedBranch); setIsMasterAccess(false); setIsLoggedIn(true);
        localStorage.setItem('cnet_session', JSON.stringify({ mode: 'personel', branch: matchedBranch }));
        setLoginLoading(false); return;
      }

      const res = await fetch('https://api.ipify.org?format=json');
      const data = await res.json();
      const currentIp = data.ip;

      if (MASTER_IPLER.includes(currentIp)) {
        setSelectedBranch(matchedBranch); setIsMasterAccess(false); setIsLoggedIn(true);
        localStorage.setItem('cnet_session', JSON.stringify({ mode: 'personel', branch: matchedBranch }));
        setLoginLoading(false); return;
      }

      if (IP_HARITASI[currentIp] === matchedBranch) {
        setSelectedBranch(matchedBranch); setIsMasterAccess(false); setIsLoggedIn(true);
        localStorage.setItem('cnet_session', JSON.stringify({ mode: 'personel', branch: matchedBranch }));
      } else {
        alert(`GÜVENLİK UYARISI: Lütfen şube Wi-Fi ağına bağlanın.`);
      }
    } catch (error) { alert("Bağlantı Hatası."); }
    setLoginLoading(false);
  };

  const handleLogout = () => {
    localStorage.removeItem('cnet_session');
    setIsLoggedIn(false); setEntryPass(''); setIsMasterAccess(false); setIsAdmin(false); setLoginMode('personel');
  };

  const resetAll = () => {
    setStep(1); setSelectedBrand(''); setSelectedModelName(''); setSelectedCapacity(null);
    setSelectedColor('Diğer'); setSearchQuery(''); setCustomer({ name: '', phone: '', imei: '' });
    setStatus({ power: null, screen: null, cosmetic: null, faceId: null, battery: null, sim: null, warranty: null, speaker: null });
    setIsCustomOfferActive(false); setCustomOffer(''); setIsCustomTradeOfferActive(false); setCustomTradeOffer(''); setPurchaseType(null);
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

      try {
        const ctRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent('CEP + TABLET+IOT SAAT LIST')}!A1:L1000?key=${API_KEY}`);
        const ctData = await ctRes.json();
        if (ctData.values) setCepTabletData(ctData.values);
      } catch(e) {}

      try {
        const dkRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent('DIŞ KANAL SATIN ALMA')}!A1:C1000?key=${API_KEY}`);
        const dkData = await dkRes.json();
        if (dkData.values) setDisKanalData(dkData.values);
      } catch(e) {}

      if (devData.values) {
        setDb(devData.values.map((row: any) => ({
          brand: row[0] || '', name: row[1] || '', cap: row[2] || '',
          base: parseInt(row[3]) || 0, img: row[4]?.trim() || '', minPrice: parseInt(row[5]) || 0
        })));
      }
      if (confData.values) {
        const m: any = {};
        confData.values.forEach((row: any) => { m[row[0]] = isNaN(Number(row[1])) ? row[1] : parseFloat(row[1]); });
        setConfig(m);
      }
      if (alimData.values) { setAlimlar(alimData.values.map((val: any, index: number) => ({ data: val, sheetIndex: index + 2 }))); }
      setLoading(false);
    } catch (e) { setLoading(false); }
  };

  useEffect(() => { loadData(); }, [step]);

  useEffect(() => {
    if (selectedCapacity && config.Guc_Yok !== undefined) {
      let price = selectedCapacity.base;
      if (status.power === 'Hayır') price *= (1 - ((config.Guc_Yok || 0) / 100));
      if (status.screen === 'Kırık') price *= (1 - ((config.Ekran_Kirik || 0) / 100));
      else if (status.screen === 'Bilinmeyen Parça') price *= (1 - ((config.Bilinmeyen_Parca || 0) / 100));
      if (status.screen === 'Çizikler var') price *= (1 - ((config.Ekran_Cizik || 0) / 100));
      if (status.cosmetic === 'İyi') price *= (1 - ((config.Kasa_Iyi || 0) / 100));
      if (status.cosmetic === 'Kötü') price *= (1 - ((config.Kasa_Kotu || 0) / 100));
      if (status.faceId === 'Hayır') price *= (1 - ((config.FaceID_Bozuk || 0) / 100));
      if (status.battery === '0-85') price *= (1 - ((config.Pil_Dusuk || 0) / 100));
      if (status.sim === 'Fiziksel + eSIM (YD)') price *= (1 - ((config.Yurt_Disi || 0) / 100));
      if (status.warranty === 'Garanti Yok') price *= (1 - ((config.Garanti_Yok || 0) / 100));

      let finalCash = Math.max(Math.round(price), selectedCapacity.minPrice || 0);

      // ZUMAY VE VODAFONE KANALI ÖZEL İNDİRİMİ %8
      if (selectedBranch === 'VODAFONE KANALI' || selectedBranch === 'ZUMAY KANALI') {
          finalCash = Math.round(finalCash * 0.92);
      }

      const finalTrade = Math.round(finalCash * (1 + ((config.Takas_Destegi || 0) / 100)));
      setPrices({ cash: finalCash, trade: finalTrade });
    }
  }, [status, selectedCapacity, config, selectedBranch]);

  const handleFinalProcess = async (actionType: 'print' | 'whatsapp' | 'NAKİT ALINDI' | 'TAKAS ALINDI' | 'ALINMADI') => {
    const now = new Date();
    const dateStr = now.toLocaleDateString('tr-TR');
    const timeStr = now.toLocaleTimeString('tr-TR');
    const dateTime = `${dateStr} ${timeStr}`;
    
    let actionLabel = actionType;
    if (actionType === 'print' || actionType === 'whatsapp') {
        actionLabel = purchaseType === 'NAKİT' ? 'NAKİT ALINDI' : 'TAKAS ALINDI';
    }

    const ekspertizStr = [
      status.power ? `Güç:${status.power}` : '',
      status.screen ? `Ekran:${status.screen}` : '',
      status.cosmetic ? `Kasa:${status.cosmetic}` : '',
      status.battery ? `Pil:${status.battery}` : '',
      status.faceId ? `FaceID:${status.faceId}` : '',
      status.sim ? `Kayıt:${status.sim}` : ''
    ].filter(Boolean).join(' | ');

    const devicePayload = `${selectedModelName} (${selectedCapacity?.cap}) [${actionLabel}] #EKSPERTİZ# ${ekspertizStr}`;

    if (['NAKİT ALINDI', 'TAKAS ALINDI', 'ALINMADI'].includes(actionType)) {
        try {
          await fetch(SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
              type: "SAVE_ALIM", branch: selectedBranch, customer: customer.name,
              device: devicePayload, imei: customer.imei, cash: prices.cash,
              trade: prices.trade, date: dateTime
            })
          });
          alert("Yönetici paneline gönderildi");
          setTimeout(loadData, 2000);
        } catch (e) { console.error(e); }
    }

    if (actionType === 'print') window.print();
    if (actionType === 'whatsapp') {
      const branch = branches.find(b => b.name === selectedBranch) || branches[0];
      const message = `📱 *${isZumay ? 'ZUMAY' : 'CMR'} CIHAZ ALIM FORMU*%0A👤 *Müşteri:* ${customer.name}%0A🆔 *IMEI:* ${customer.imei}%0A📦 *Cihaz:* ${selectedModelName}%0A💰 *Tutar:* ${purchaseType === 'NAKİT' ? prices.cash : prices.trade} TL`;
      window.open(`https://wa.me/${branch?.phone}?text=${message}`, '_blank');
    }
  };

  const deleteAlim = async (sheetIdx: number) => {
    if(!confirm("Bu işlemi silmek istiyor musunuz?")) return;
    try {
      await fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify({ type: "DELETE_ALIM", index: sheetIdx }) });
      setTimeout(loadData, 1500);
    } catch (e) {}
  };

  const menuGroups = [
    {
      title: "ANA MODÜLLER",
      items: [
        { id: 'ana_sayfa', label: 'Ana Sayfa', icon: "M3 12l2-2m0 0l7-7 7 7", visible: true },
        { id: 'alim', label: 'Cihaz Alım', icon: "M12 18h.01", visible: true },
        { id: 'dis_kanal', label: 'Dış Kanal', icon: "M3 3h2", visible: true },
        { id: 'servis', label: 'Teknik Servis', icon: "M10 20l4", visible: !isZumay },
        { id: 'cep_tablet', label: 'Fiyat Listesi', icon: "M12 4v1", visible: !isZumay }
      ]
    }
  ];

  const canProceed = Object.values(status).every(v => v !== null) && selectedCapacity && customer.name;
  const isDarkAppMode = appMode === 'dis_kanal' || appMode === 'cep_tablet' || step === 99;

  return (
    <div className={`flex flex-col md:flex-row min-h-screen font-sans ${isDarkAppMode ? 'bg-[#111] text-white' : 'bg-[#F8FAFC] text-slate-900'}`}>
      <style>{`
        #print-area { display: none !important; }
        @media print {
          header, nav, main, footer, .print\\:hidden { display: none !important; }
          #print-area { display: block !important; visibility: visible !important; position: absolute; left: 0; top: 0; width: 100%; background: white; color: black; padding: 40px; }
        }
        .btn-click:active { transform: scale(0.96); transition: 0.1s; }
      `}</style>

      {/* SIDEBAR */}
      <nav className={`fixed md:sticky top-0 left-0 z-[70] flex flex-col w-[280px] h-screen bg-[#0B0F19] border-r border-white/5 transition-transform ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className="p-8">
          <h1 className="text-xl font-black italic text-white uppercase tracking-tighter">
            {isZumay ? <span className="text-rose-600">ZUMAY</span> : <>CNET<span className="text-blue-500">MOBIL</span></>}
          </h1>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">
            {isZumay ? 'Bayi Kanalı' : 'Kurumsal Panel'}
          </p>
        </div>

        <div className="flex-1 px-4 space-y-2 overflow-y-auto">
          {menuGroups[0].items.filter(i => i.visible).map(item => (
            <button key={item.id} onClick={() => { setAppMode(item.id as any); setStep(1); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${appMode === item.id ? (isZumay ? 'bg-rose-600/20 text-white border-l-4 border-rose-600' : 'bg-blue-600/20 text-white border-l-4 border-blue-500') : 'text-slate-400 hover:text-white'}`}>
              {item.label}
            </button>
          ))}
        </div>

        <div className="p-6 border-t border-white/5">
          <div className={`p-4 rounded-2xl border ${isZumay ? 'bg-rose-600/10 border-rose-600/20' : 'bg-blue-600/10 border-blue-600/20'}`}>
            <p className="text-[9px] font-black text-slate-500 uppercase">Aktif Şube</p>
            <p className="text-xs font-black text-white">{selectedBranch}</p>
          </div>
          <button onClick={handleLogout} className="w-full mt-4 py-3 text-[10px] font-black text-slate-500 hover:text-rose-500 uppercase transition-all">Sistemden Çık</button>
        </div>
      </nav>

      {/* MAIN CONTENT */}
      <main className="flex-1 p-4 md:p-10">
        {appMode === 'ana_sayfa' ? (
          <div className="max-w-4xl mx-auto space-y-8">
            <div className="text-center py-10">
               <h2 className="text-4xl font-black italic tracking-tighter uppercase">HOŞGELDİNİZ</h2>
               <p className="text-slate-400 font-bold">Lütfen yapmak istediğiniz işlemi seçin.</p>
            </div>
            
            {!isZumay && <AnaSayfa selectedBranch={selectedBranch} setAppMode={setAppMode} config={config} />}
            
            {isZumay && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div onClick={() => setAppMode('alim')} className="bg-white p-10 rounded-[40px] shadow-sm border-2 border-transparent hover:border-rose-600 cursor-pointer transition-all group">
                   <h3 className="text-2xl font-black italic uppercase group-hover:text-rose-600">CIHAZ ALIMI</h3>
                   <p className="text-slate-400 text-sm mt-2">Güncel %8 indirimli fiyatlarla cihaz alımı gerçekleştirin.</p>
                </div>
                <div onClick={() => setAppMode('dis_kanal')} className="bg-slate-900 p-10 rounded-[40px] shadow-sm cursor-pointer hover:bg-rose-950 transition-all group">
                   <h3 className="text-2xl font-black italic uppercase text-white">DIŞ KANAL LİSTESİ</h3>
                   <p className="text-slate-400 text-sm mt-2">Dış kanal özel satın alma listesini görüntüleyin.</p>
                </div>
              </div>
            )}
          </div>
        ) : appMode === 'alim' ? (
          <div className="animate-in fade-in duration-500">
            {step === 1 ? (
               <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                 {Array.from(new Set(db.map(i => i.brand))).map(brand => (
                   <div key={brand} onClick={() => { setSelectedBrand(brand); setStep(2); }} className={`bg-white p-10 rounded-[40px] shadow-sm border flex flex-col items-center justify-center cursor-pointer hover:scale-105 transition-all ${isZumay ? 'hover:border-rose-600' : 'hover:border-blue-500'}`}>
                      <h2 className="font-black text-xl italic uppercase">{brand}</h2>
                   </div>
                 ))}
               </div>
            ) : step === 2 ? (
              <div className="space-y-6">
                <button onClick={() => setStep(1)} className="text-xs font-black text-slate-400 uppercase">← Geri Dön</button>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  {db.filter(i => i.brand === selectedBrand).reduce((acc: string[], curr) => acc.includes(curr.name) ? acc : [...acc, curr.name], []).map(name => (
                    <div key={name} onClick={() => { setSelectedModelName(name); setStep(3); }} className="bg-white p-6 rounded-3xl border shadow-sm cursor-pointer hover:border-rose-500 text-center">
                       <p className="text-xs font-black uppercase tracking-tighter">{name}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col lg:flex-row gap-8">
                <div className="flex-1 space-y-6">
                  <div className="bg-white p-8 rounded-[40px] shadow-sm border space-y-6">
                    <h3 className="text-xl font-black italic uppercase tracking-tighter">Müşteri & Cihaz Bilgileri</h3>
                    <input placeholder="Müşteri Ad Soyad" className="w-full p-4 bg-slate-50 rounded-2xl border outline-none font-bold" value={customer.name} onChange={e => setCustomer({...customer, name: e.target.value})} />
                    <input placeholder="IMEI (15 Hane)" className="w-full p-4 bg-slate-50 rounded-2xl border outline-none font-bold" value={customer.imei} maxLength={15} onChange={e => setCustomer({...customer, imei: e.target.value.replace(/\D/g,'')})} />
                    
                    <div className="pt-4 border-t">
                      <p className="text-[10px] font-black text-slate-400 uppercase mb-4">Hafıza Seçimi</p>
                      <div className="flex gap-2">
                        {db.filter(i => i.name === selectedModelName).map(c => (
                          <button key={c.cap} onClick={() => setSelectedCapacity(c)} className={`px-6 py-3 rounded-xl font-black text-xs ${selectedCapacity?.cap === c.cap ? (isZumay ? 'bg-rose-600 text-white' : 'bg-blue-600 text-white') : 'bg-slate-100'}`}>{c.cap}</button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {[{l:"Güç", f:"power", o:["Evet", "Hayır"]}, {l:"Ekran", f:"screen", o:["Sağlam", "Kırık"]}, {l:"Kasa", f:"cosmetic", o:["Mükemmel", "İyi", "Kötü"]}, {l:"Pil", f:"battery", o:["95-100", "85-95", "0-85"]}].map(q => (
                          <div key={q.f} className="space-y-2">
                             <p className="text-[10px] font-black text-slate-400 uppercase">{q.l}</p>
                             <div className="flex gap-2">
                               {q.o.map(opt => (
                                 <button key={opt} onClick={() => setStatus({...status, [q.f]: opt})} className={`px-4 py-2 rounded-lg text-[10px] font-black ${status[q.f] === opt ? (isZumay ? 'bg-rose-600 text-white' : 'bg-slate-900 text-white') : 'bg-slate-100'}`}>{opt}</button>
                               ))}
                             </div>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>

                <div className="lg:w-80 space-y-4">
                   <div className={`p-8 rounded-[40px] text-center text-white ${isZumay ? 'bg-rose-600 shadow-rose-200 shadow-2xl' : 'bg-blue-600 shadow-blue-200 shadow-2xl'}`}>
                      <p className="text-[10px] font-black uppercase opacity-60 italic">Nakit Alım Teklifi</p>
                      <p className="text-3xl font-black italic mt-2">{selectedCapacity && status.power ? `${prices.cash.toLocaleString()} TL` : '---'}</p>
                   </div>
                   <div className="bg-slate-900 p-8 rounded-[40px] text-center text-white">
                      <p className="text-[10px] font-black uppercase opacity-60 italic">Takas Desteği İle</p>
                      <p className="text-3xl font-black italic mt-2">{selectedCapacity && status.power ? `${prices.trade.toLocaleString()} TL` : '---'}</p>
                   </div>
                   
                   <button disabled={!canProceed} onClick={() => {setPurchaseType('NAKİT'); handleFinalProcess('NAKİT ALINDI');}} className={`w-full py-5 rounded-2xl font-black uppercase text-xs btn-click ${canProceed ? (isZumay ? 'bg-rose-600 text-white' : 'bg-emerald-500 text-white') : 'bg-slate-200 text-slate-400'}`}>NAKİT ALINDI</button>
                   <button disabled={!canProceed} onClick={() => {setPurchaseType('TAKAS'); handleFinalProcess('TAKAS ALINDI');}} className={`w-full py-5 rounded-2xl font-black uppercase text-xs btn-click ${canProceed ? 'bg-purple-600 text-white' : 'bg-slate-200 text-slate-400'}`}>TAKAS ALINDI</button>
                   <button onClick={() => resetAll()} className="w-full py-4 text-[10px] font-black text-slate-400 uppercase">İşlemi İptal Et</button>
                </div>
              </div>
            )}
          </div>
        ) : appMode === 'dis_kanal' ? (
          <div className="bg-[#1e1e2d] p-8 rounded-[40px] shadow-2xl border border-slate-800 text-white">
             <div className="flex justify-between items-center mb-8 border-b border-slate-700 pb-6">
                <h2 className={`text-3xl font-black italic ${isZumay ? 'text-rose-500' : 'text-emerald-500'}`}>DIŞ KANAL SATIN ALMA</h2>
                <input placeholder="Hızlı Ara..." className="bg-slate-800 p-3 rounded-xl text-xs outline-none border border-slate-700 w-64" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
             </div>
             <div className="grid grid-cols-1 gap-4">
                {disKanalData.slice(1).filter(r => r[0]?.toLowerCase().includes(searchQuery.toLowerCase())).map((row, i) => (
                  <div key={i} className="flex justify-between items-center p-5 bg-white/5 rounded-2xl hover:bg-white/10 transition-all border border-transparent hover:border-slate-700">
                     <span className="font-black text-sm uppercase">{row[0]}</span>
                     <span className={`font-black text-lg ${isZumay ? 'text-rose-400' : 'text-emerald-400'}`}>{row[1]} TL</span>
                  </div>
                ))}
             </div>
          </div>
        ) : null}
      </main>

      {/* YAZDIRMA ALANI */}
      <div id="print-area">
          <div style={{textAlign:'center', marginBottom:'40px'}}>
             <h1 style={{fontSize:'40px', fontWeight:'900', fontStyle:'italic', color: isZumay ? '#e11d48' : '#2563eb'}}>
               {isZumay ? 'ZUMAY' : 'CNETMOBIL'}
             </h1>
             <p style={{fontWeight:'bold', textTransform:'uppercase', letterSpacing:'2px'}}>Cihaz Alim Sözleşmesi</p>
          </div>
          <div style={{border:'2px solid black', padding:'20px', borderRadius:'20px', marginBottom:'20px'}}>
             <p><b>Müşteri:</b> {customer.name}</p>
             <p><b>Cihaz:</b> {selectedModelName} ({selectedCapacity?.cap})</p>
             <p><b>IMEI:</b> {customer.imei}</p>
             <p><b>Tutar:</b> {purchaseType === 'NAKİT' ? prices.cash : prices.trade} TL</p>
             <p><b>Tarih:</b> {new Date().toLocaleString('tr-TR')}</p>
          </div>
          <p style={{fontSize:'10px', fontStyle:'italic'}}>Bu belge cihazın teknik durumu ve mülkiyet beyanı üzerine düzenlenmiştir.</p>
          <div style={{marginTop:'100px', display:'flex', justifyContent:'space-between'}}>
             <p>Müşteri İmza</p>
             <p>Yetkili İmza</p>
          </div>
      </div>
    </div>
  );
}
