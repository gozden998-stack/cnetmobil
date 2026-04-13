"use client";
import React, { useState, useEffect } from 'react';

const SHEET_ID = '1GvagcuTfR_e66A1yxTPqaIgh4YEmYl4M7-E2oRzZhyg';
const API_KEY = 'AIzaSyD4zJB-fvZdAR5WucfwITuqpIuHgbpK2gc';
const TABLO_ISMI = 'Google Sheets ile Kurumsal Alım Sistemi'; 
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwvlMvSs-i-wEn197eeBEMLRpiUcW_A7z0nO0oA0seXzcvZ86xsNBfTzZVRmnaEwwrJ/exec';

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

const BRANCH_PASSWORDS: Record<string, string> = {
  "1905": "CMR MERKEZ",
  "2003": "CMR CADDE",
  "1071": "CMR KAPAKLI",
  "1453": "CMR SARAY",
  "542542": "VODAFONE KANALI"
};

export default function CnetmobilCmrFinalUltimate() {
  const [authLoading, setAuthLoading] = useState(true); 
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [entryPass, setEntryPass] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  
  const [loginMode, setLoginMode] = useState<'personel' | 'yonetici'>('personel');
  const [isMasterAccess, setIsMasterAccess] = useState(false);
  
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [appMode, setAppMode] = useState<'alim' | 'servis' | 'cep_tablet' | 'yna_list' | 'dis_kanal' | 'ikinci_el' | 'imei_list'>('alim');
  
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
  
  // YENİ: Yönetici Dashboard'u için seçili şube state'i
  const [adminSelectedBranch, setAdminSelectedBranch] = useState<string>('TÜM ŞUBELER');

  const branches = [
    { name: "CMR CADDE", phone: "905443214534" },
    { name: "CMR MERKEZ", phone: "905416801905" },
    { name: "CMR KAPAKLI", phone: "905327005959" },
    { name: "CMR SARAY", phone: "905416801905" },
    { name: "VODAFONE KANALI", phone: "905425420000" }
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
      if (!sessionStr) {
        setAuthLoading(false);
        return;
      }

      try {
        const session = JSON.parse(sessionStr);

        if (session.mode === 'yonetici') {
          setIsMasterAccess(true);
          setIsAdmin(true); 
          setSelectedBranch(session.branch || 'CMR MERKEZ');
          setIsLoggedIn(true);
          setAuthLoading(false);
          return;
        }

        if (session.mode === 'personel') {
          if (session.branch === 'VODAFONE KANALI') {
            setSelectedBranch(session.branch);
            setIsLoggedIn(true);
            setAuthLoading(false);
            return;
          }

          const res = await fetch('https://api.ipify.org?format=json');
          const data = await res.json();
          const currentIp = data.ip;

          if (MASTER_IPLER.includes(currentIp) || IP_HARITASI[currentIp] === session.branch) {
            setSelectedBranch(session.branch);
            setIsLoggedIn(true);
          } else {
            localStorage.removeItem('cnet_session');
          }
        }
      } catch (e) {
         localStorage.removeItem('cnet_session');
      }
      setAuthLoading(false);
    };

    verifySession();
  }, []);

  const handleLogin = async () => {
    if(!entryPass) return;
    setLoginLoading(true);

    try {
      if (loginMode === 'yonetici') {
        if (entryPass === 'cnet1905.*') {
           setIsMasterAccess(true);
           setIsAdmin(true);
           setSelectedBranch('CMR MERKEZ'); 
           setIsLoggedIn(true);
           localStorage.setItem('cnet_session', JSON.stringify({ mode: 'yonetici', branch: 'CMR MERKEZ' }));
        } else {
           alert("Hatalı Yönetici Şifresi!");
        }
        setLoginLoading(false);
        return;
      }

      const matchedBranch = BRANCH_PASSWORDS[entryPass];
      
      if (!matchedBranch) {
        alert("Hatalı Şube Şifresi!");
        setLoginLoading(false);
        return;
      }

      if (matchedBranch === 'VODAFONE KANALI') {
        setSelectedBranch(matchedBranch);
        setIsMasterAccess(false);
        setIsLoggedIn(true);
        localStorage.setItem('cnet_session', JSON.stringify({ mode: 'personel', branch: matchedBranch }));
        setLoginLoading(false);
        return;
      }

      const res = await fetch('https://api.ipify.org?format=json');
      const data = await res.json();
      const currentIp = data.ip;

      if (MASTER_IPLER.includes(currentIp)) {
        setSelectedBranch(matchedBranch);
        setIsMasterAccess(false);
        setIsLoggedIn(true);
        localStorage.setItem('cnet_session', JSON.stringify({ mode: 'personel', branch: matchedBranch }));
        setLoginLoading(false);
        return;
      }

      const expectedBranchForThisIp = IP_HARITASI[currentIp];

      if (expectedBranchForThisIp === matchedBranch) {
        setSelectedBranch(matchedBranch);
        setIsMasterAccess(false);
        setIsLoggedIn(true);
        localStorage.setItem('cnet_session', JSON.stringify({ mode: 'personel', branch: matchedBranch }));
      } else {
        alert(`GÜVENLİK UYARISI: Bu şifreyi (${matchedBranch}) bu mağazanın interneti dışında kullanamazsınız! Lütfen şube Wi-Fi ağına bağlanın. (Mevcut IP'niz: ${currentIp})`);
      }
    } catch (error) {
      alert("Bağlantı Hatası: Güvenlik IP kontrolü yapılamadı. İnternet bağlantınızı kontrol edin.");
    }
    
    setLoginLoading(false);
  };

  const handleLogout = () => {
    localStorage.removeItem('cnet_session');
    setIsLoggedIn(false); 
    setEntryPass(''); 
    setIsMasterAccess(false); 
    setIsAdmin(false); 
    setLoginMode('personel');
  };

  const resetAll = () => {
    setStep(1);
    setSelectedBrand('');
    setSelectedModelName('');
    setSelectedCapacity(null);
    setSelectedColor('Diğer');
    setSearchQuery(''); 
    setCustomer({ name: '', phone: '', imei: '' });
    setStatus({ power: null, screen: null, cosmetic: null, faceId: null, battery: null, sim: null, warranty: null, speaker: null });
    setIsCustomOfferActive(false);
    setCustomOffer('');
    setIsCustomTradeOfferActive(false);
    setCustomTradeOffer('');
    setPurchaseType(null);
    if(typeof window !== 'undefined') window.scrollTo(0,0);
  };

  const resetSelection = () => {
    setSelectedCapacity(null);
    setSelectedColor('Diğer');
    setSearchQuery(''); 
    setStatus({ power: null, screen: null, cosmetic: null, faceId: null, battery: null, sim: null, warranty: null, speaker: null });
    setIsCustomOfferActive(false);
    setCustomOffer('');
    setIsCustomTradeOfferActive(false);
    setCustomTradeOffer('');
    setPurchaseType(null);
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

      try {
        const ctRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent('CEP + TABLET+IOT SAAT LIST')}!A1:I1000?key=${API_KEY}`);
        const ctData = await ctRes.json();
        if (ctData.values) setCepTabletData(ctData.values);
      } catch(e) { console.warn("CEP+TABLET tablosu çekilemedi.", e); }

      try {
        const ynaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent('YNA LİST')}!A1:F1000?key=${API_KEY}`);
        const ynaData = await ynaRes.json();
        if (ynaData.values) setYnaData(ynaData.values);
      } catch(e) { console.warn("YNA LIST tablosu çekilemedi.", e); }

      try {
        const dkRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent('DIŞ KANAL SATIN ALMA')}!A1:C1000?key=${API_KEY}`);
        const dkData = await dkRes.json();
        if (dkData.values) setDisKanalData(dkData.values);
      } catch(e) { console.warn("DIŞ KANAL SATIN ALMA tablosu çekilemedi.", e); }

      try {
        const servisRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Servis_Fiyatlari!A2:G1000?key=${API_KEY}`);
        const servisData = await servisRes.json();
        if (servisData.values) {
          const loadedServis: any = {};
          servisData.values.forEach((row: any) => {
             loadedServis[row[0]] = {
                ekranOrj: row[1] || '',
                ekranOled: row[2] || '',
                ekranCipli: row[3] || '',
                batarya: row[4] || '',
                arkaCam: row[5] || '',
                kasa: row[6] || ''
             };
          });
          setServisFiyatlari(loadedServis);
        }
      } catch (e) { console.warn("Servis_Fiyatlari tablosu çekilemedi."); }

      try {
        const ieRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent('2.EL FİYAT LİSTESİ')}!A1:D1000?key=${API_KEY}`);
        const ieData = await ieRes.json();
        if (ieData.values) setIkinciElData(ieData.values);
      } catch(e) { console.warn("2.EL FİYAT LİSTESİ tablosu çekilemedi.", e); }

      try {
        const imeiRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent('İMEİ LİSTESİ')}!A1:B1000?key=${API_KEY}`);
        const imeiDataResp = await imeiRes.json();
        if (imeiDataResp.values) setImeiData(imeiDataResp.values);
      } catch(e) { console.warn("İMEİ LİSTESİ tablosu çekilemedi.", e); }


      if (devData.values) {
        setDb(devData.values.map((row: any) => ({
          brand: row[0] || '', name: row[1] || '', cap: row[2] || '',
          base: parseInt(row[3]) || 0, img: row[4]?.trim() || '', minPrice: parseInt(row[5]) || 0
        })));
      }
      if (confData.values) {
        const m: any = {};
        confData.values.forEach((row: any) => { m[row[0]] = parseFloat(row[1]); });
        
        if (m.Ekran_Kirik_Android === undefined && m.Ekran_Kirik !== undefined) {
           m.Ekran_Kirik_Android = m.Ekran_Kirik;
        }
        if (m.Kasa_Kotu_Android === undefined && m.Kasa_Kotu !== undefined) {
           m.Kasa_Kotu_Android = m.Kasa_Kotu;
        }

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

      let ekranKirikYuzdesi = config.Ekran_Kirik || 0;
      if (selectedBrand?.toLowerCase() !== 'apple') {
          ekranKirikYuzdesi = config.Ekran_Kirik_Android !== undefined ? config.Ekran_Kirik_Android : (config.Ekran_Kirik || 0);
      }
      if (status.screen === 'Kırık / Orijinal Değil') price *= (1 - (ekranKirikYuzdesi / 100));

      if (status.screen === 'Çizikler var') price *= (1 - ((config.Ekran_Cizik || 0) / 100));
      if (status.cosmetic === 'İyi') price *= (1 - ((config.Kasa_Iyi || 0) / 100));

      let kasaKotuYuzdesi = config.Kasa_Kotu || 0;
      if (selectedBrand?.toLowerCase() !== 'apple') {
          kasaKotuYuzdesi = config.Kasa_Kotu_Android !== undefined ? config.Kasa_Kotu_Android : (config.Kasa_Kotu || 0);
      }
      if (status.cosmetic === 'Kötü') price *= (1 - (kasaKotuYuzdesi / 100));

      if (status.faceId === 'Hayır') price *= (1 - ((config.FaceID_Bozuk || 0) / 100));
      if (status.battery === '0-85') price *= (1 - ((config.Pil_Dusuk || 0) / 100));
      if (status.battery === 'Bilinmeyen Parça') price *= (1 - ((config.Bilinmeyen_Batarya || 15) / 100));
      if (status.sim === 'Fiziksel + eSIM (YD)') price *= (1 - ((config.Yurt_Disi || 0) / 100));
      if (status.warranty === 'Yenilenmiş Cihaz') price *= (1 - ((config.Yenilenmis || 0) / 100));
      if (status.warranty === 'Garanti Yok') price *= (1 - ((config.Garanti_Yok || 0) / 100));

      if (status.speaker === 'Cızırtı var') price -= 500;
      if (status.speaker === 'Arızalı') price -= 1000;

      let colorBonus = 1;
      
      const isPerfectCondition = 
        status.cosmetic === 'Mükemmel' && 
        status.screen === 'Sağlam' && 
        (status.battery === '95-100' || status.battery === '85-95');

      if (selectedModelName === "iPhone 13" && selectedColor === 'Beyaz' && isPerfectCondition) {
        colorBonus = 1.05; 
      }

      let finalCash = Math.max(Math.round(price * colorBonus), selectedCapacity.minPrice || 0);

      if (selectedBranch === 'VODAFONE KANALI') {
         finalCash = Math.round(finalCash * 0.92);
      }

      const finalTrade = Math.round(finalCash * (1 + ((config.Takas_Destegi || 0) / 100)));
      setPrices({ cash: finalCash, trade: finalTrade });
      
      if (customOffer && parseInt(customOffer) > finalCash) {
         setCustomOffer(finalCash.toString());
      }
      
      if (customTradeOffer && parseInt(customTradeOffer) > finalTrade) {
         setCustomTradeOffer(finalTrade.toString());
      }
    }
  }, [status, selectedCapacity, config, selectedColor, selectedModelName, selectedBranch, selectedBrand]); 


  const finalCashPrice = isCustomOfferActive && customOffer ? Math.min(parseInt(customOffer) || 0, prices.cash) : prices.cash;
  const calculatedTradePrice = Math.round(finalCashPrice * (1 + ((config.Takas_Destegi || 0) / 100)));
  const finalTradePrice = isCustomTradeOfferActive && customTradeOffer ? Math.min(parseInt(customTradeOffer) || 0, calculatedTradePrice) : calculatedTradePrice;

  const handleFinalProcess = async (actionType: 'print' | 'whatsapp' | 'NAKİT ALINDI' | 'TAKAS ALINDI' | 'ALINMADI') => {
    
    const istanbulTime = new Date().toLocaleString("en-US", { timeZone: "Europe/Istanbul" });
    const now = new Date(istanbulTime);
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const dateTime = `${day}.${month}.${year} ${hours}:${minutes}:${seconds}`;
    
    let actionLabel = actionType;
    if (actionType === 'print' || actionType === 'whatsapp') {
        actionLabel = purchaseType === 'NAKİT' ? 'NAKİT ALINDI' : 'TAKAS ALINDI';
    }

    const statusLabel = ` [${actionLabel}]`;
    const colorLabel = selectedModelName === "iPhone 13" ? ` - Renk: ${selectedColor}` : "";

    const ekspertizStr = [
      status.power ? `Güç:${status.power}` : '',
      status.screen ? `Ekran:${status.screen}` : '',
      status.cosmetic ? `Kasa:${status.cosmetic}` : '',
      status.battery ? `Pil:${status.battery}` : '',
      status.faceId ? `FaceID:${status.faceId}` : '',
      status.speaker ? `Ahize:${status.speaker}` : '',
      status.sim ? `Kayıt:${status.sim}` : '',
      status.warranty ? `Garanti:${status.warranty}` : ''
    ].filter(Boolean).join(' | ');

    const devicePayload = `${selectedModelName} (${selectedCapacity?.cap})${colorLabel}${statusLabel} #EKSPERTİZ# ${ekspertizStr}`;

    if (actionType === 'NAKİT ALINDI' || actionType === 'TAKAS ALINDI' || actionType === 'ALINMADI') {
        try {
          await fetch(SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
              type: "SAVE_ALIM",
              branch: selectedBranch,
              customer: customer.name,
              device: devicePayload,
              imei: customer.imei,
              cash: finalCashPrice,
              trade: finalTradePrice,
              date: dateTime
            })
          });

          alert("Yönetici paneline gönderildi");
          setTimeout(() => { loadData(); }, 2500);

        } catch (e) { console.error(e); }
    }

    if (actionType === 'print') {
      window.print();
    } else if (actionType === 'whatsapp') {
      const branch = branches.find(b => b.name === selectedBranch) || branches[0];
      const priceText = purchaseType === 'NAKİT' 
          ? `💰 *NAKİT ALIM:* ${finalCashPrice.toLocaleString()} TL` 
          : `🔄 *TAKAS ALIM:* ${finalTradePrice.toLocaleString()} TL`;
          
      const message = `📱 *CMR CİHAZ ALIM FORMU*%0A👤 *Müşteri:* ${customer.name}%0A🆔 *IMEI:* ${customer.imei}%0A📦 *Cihaz:* ${selectedModelName} (${selectedCapacity?.cap})${colorLabel}%0A${priceText}`;
      
      window.open(`https://wa.me/${branch?.phone}?text=${message}`, '_blank');
    }
  };

  const deleteAlim = async (sheetIdx: number) => {
    if(!confirm("Bu işlemi silmek istiyor musunuz?")) return;
    setAlimlar(prev => prev.filter(item => item.sheetIndex !== sheetIdx));
    try {
      await fetch(SCRIPT_URL, { 
        method: 'POST', 
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }, 
        body: JSON.stringify({ type: "DELETE_ALIM", index: sheetIdx }) 
      });
      setTimeout(loadData, 2000);
    } catch (e) { console.error(e); }
  };

  const deleteAllAlimlar = async () => {
    if(!confirm("DİKKAT! Tüm alım geçmişi silinecek. Onaylıyor musunuz?")) return;
    try {
      await fetch(SCRIPT_URL, { 
        method: 'POST', 
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }, 
        body: JSON.stringify({ type: "DELETE_ALL_ALIM" }) 
      });
      alert("Tüm geçmiş temizlendi.");
      loadData();
    } catch (e) { console.error(e); }
  };

  const updateConfig = async (key: string, val: string) => {
    try {
      await fetch(SCRIPT_URL, { 
        method: 'POST', 
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }, 
        body: JSON.stringify({ type: "UPDATE_CONFIG", key, val }) 
      });
      alert(`${key} Güncellendi!`);
      setConfig((prev: any) => ({...prev, [key]: parseFloat(val)}));
    } catch (e) { console.error(e); }
  };

  const adminAddDevice = async () => {
    if(!newDevice.name || !newDevice.base) return alert("Eksik bilgi!");
    try {
      await fetch(SCRIPT_URL, { 
        method: 'POST', 
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }, 
        body: JSON.stringify({ type: "ADD_DEVICE", ...newDevice }) 
      });
      alert("Cihaz başarıyla eklendi!");
      setNewDevice({ brand: 'Apple', name: '', cap: '', base: '', img: '', minPrice: '0' });
      setTimeout(loadData, 1500);
    } catch (e) { console.error(e); }
  };

  const saveServisFiyat = async () => {
    if(!servisForm.model) return alert("Lütfen bir model seçin!");
    
    const existing = servisFiyatlari[servisForm.model] || {};
    const yeniFiyatlar = {
       ...servisFiyatlari, 
       [servisForm.model]: {
         ...existing,
         ekran: servisForm.ekran, 
         ekranOrj: servisForm.ekranOrj,
         ekranOled: servisForm.ekranOled,
         ekranCipli: servisForm.ekranCipli,
         batarya: servisForm.batarya, 
         arkaCam: servisForm.arkaCam,
         kasa: servisForm.kasa
       }
    };
    
    setServisFiyatlari(yeniFiyatlar);
    
    try {
      await fetch(SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
           type: "SAVE_SERVIS",
           model: servisForm.model,
           ekranOrj: servisForm.ekranOrj || servisForm.ekran, 
           ekranOled: servisForm.ekranOled,
           ekranCipli: servisForm.ekranCipli,
           batarya: servisForm.batarya,
           arkaCam: servisForm.arkaCam,
           kasa: servisForm.kasa
        })
      });
      alert(`${servisForm.model} teknik servis fiyatları doğrudan Google Sheets'e kaydedildi!`);
      setServisForm({model: '', ekran: '', ekranOrj: '', ekranOled: '', ekranCipli: '', batarya: '', arkaCam: '', kasa: ''});
    } catch (e) {
      alert("Fiyatlar kaydedilirken bir hata oluştu. İnternet bağlantınızı kontrol edin.");
    }
  };

  const handleSendInstallmentToWhatsApp = (month: number, totalAmount: number) => {
    if (!customer.name || !customer.phone) {
      alert("Lütfen önce yukarıdaki Müşteri Adı Soyadı ve Telefon Numarası alanlarını doldurunuz.");
      return;
    }
    const formatliTutar = totalAmount.toLocaleString('tr-TR', { maximumFractionDigits: 0 });
    const message = `Müşteri: ${customer.name}\nTel: ${customer.phone}\nTaksit: ${month} Taksit ${formatliTutar} TL`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
  };

  const handleServisWhatsApp = () => {
    const sFiyat = servisFiyatlari[selectedModelName];
    if (!sFiyat) return alert("Bu cihaz için fiyat girilmemiş.");
    const branch = branches.find(b => b.name === selectedBranch) || branches[0];
    
    const orjinalEkran = sFiyat.ekranOrj || sFiyat.ekran || '-';
    
    let ekranText = `📱 Ekran (Orijinal): ${orjinalEkran !== '-' ? orjinalEkran + ' TL' : '-'}%0A📱 Ekran (OLED): ${sFiyat.ekranOled ? sFiyat.ekranOled + ' TL' : '-'}`;
    
    if (selectedBrand?.toLowerCase() === 'apple') {
        ekranText += `%0A📱 Ekran (Çipli): ${sFiyat.ekranCipli ? sFiyat.ekranCipli + ' TL' : '-'}`;
    }

    const message = `🔧 *CMR TEKNİK SERVİS TEKLİFİ*%0A📱 *Cihaz:* ${selectedModelName}%0A%0A*Onarım Fiyatları:*%0A${ekranText}%0A🔋 Batarya Değişimi: ${sFiyat.batarya || '-'} TL%0A💠 Arka Cam Değişimi: ${sFiyat.arkaCam || '-'} TL%0A🛠 Kasa Değişimi: ${sFiyat.kasa || '-'} TL%0A%0A🕒 _Fiyatlarımız anlık olup değişkenlik gösterebilir._`;
    window.open(`https://wa.me/${branch?.phone}?text=${message}`, '_blank');
  };

  const getBranchStats = () => {
    const stats: any = {};
    branches.forEach(b => { stats[b.name] = { alindi: 0, alinmadi: 0, diger: 0, total: 0 }; });
    alimlar.forEach(item => {
      let foundBranch = null;
      for (let i = 0; i < item.data.length; i++) {
        if (typeof item.data[i] === 'string' && item.data[i].includes("CMR ")) { foundBranch = item.data[i]; break; }
        if (typeof item.data[i] === 'string' && item.data[i].includes("VODAFONE ")) { foundBranch = item.data[i]; break; } 
      }
      if (foundBranch && stats[foundBranch]) {
         stats[foundBranch].total += 1;
         const rowDataString = item.data.join(" ");
         if (rowDataString.includes('[NAKİT ALINDI]') || rowDataString.includes('[TAKAS ALINDI]') || rowDataString.includes('[ALINDI]')) {
            stats[foundBranch].alindi += 1;
         } else if (rowDataString.includes('[ALINMADI]')) {
            stats[foundBranch].alinmadi += 1;
         } else { stats[foundBranch].diger += 1; }
      }
    });
    return stats;
  };

  const menuGroups = [
    {
      title: "ANA MODÜLLER",
      items: [
        { id: 'alim', label: 'Cihaz Alım', icon: "M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z", visible: true },
        { id: 'servis', label: 'Teknik Servis', icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM15 12a3 3 0 11-6 0 3 3 0 016 0z", visible: selectedBranch !== 'VODAFONE KANALI' }
      ]
    },
    {
      title: "FİYAT LİSTELERİ",
      items: [
        { id: 'cep_tablet', label: 'Cep + Tablet', icon: "M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h-2m-6 0H9", visible: true },
        { id: 'yna_list', label: 'YNA List', icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z", visible: true },
        { id: 'dis_kanal', label: 'Dış Kanal', icon: "M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z", visible: true },
        { id: 'ikinci_el', label: '2. El Listesi', icon: "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15", visible: selectedBranch !== 'VODAFONE KANALI' },
        { id: 'imei_list', label: 'İMEİ Listesi', icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z", visible: selectedBranch === 'VODAFONE KANALI' }
      ]
    }
  ];

  const isYd = status.sim === 'Fiziksel + eSIM (YD)';
  const allSelected = Object.values(status).every(v => v !== null) && selectedCapacity;
  const canProceed = allSelected;
  const showDocs = purchaseType === 'NAKİT' || purchaseType === 'TAKAS';

  const isDarkAppMode = appMode === 'cep_tablet' || appMode === 'yna_list' || appMode === 'dis_kanal' || appMode === 'ikinci_el' || appMode === 'imei_list' || step === 99;

  const baseBrands = ["Apple", "Samsung", "Xiaomi"];
  const displayBrands = Array.from(new Set([...baseBrands, ...brandDb.map(b => b.name), ...db.map(i => i.brand)]))
      .filter(brand => brand && brand.trim() !== "" && brand.toLowerCase() !== "marka");

  // DASHBOARD İSTATİSTİKLERİNİ HAZIRLAMA
  const rawStats = getBranchStats();
  let dashboardStats = { alindi: 0, alinmadi: 0, diger: 0, total: 0 };
  
  if (adminSelectedBranch === 'TÜM ŞUBELER') {
      Object.values(rawStats).forEach((s: any) => {
          dashboardStats.alindi += s.alindi;
          dashboardStats.alinmadi += s.alinmadi;
          dashboardStats.diger += s.diger;
          dashboardStats.total += s.total;
      });
  } else {
      dashboardStats = rawStats[adminSelectedBranch] || dashboardStats;
  }

  // FİLTRELENMİŞ ALIM LİSTESİ
  const filteredAlimlar = [...alimlar].reverse().filter(item => {
      if (adminSelectedBranch === 'TÜM ŞUBELER') return true;
      let foundBranch = null;
      for (let i = 0; i < item.data.length; i++) {
          if (typeof item.data[i] === 'string' && (item.data[i].includes("CMR ") || item.data[i].includes("VODAFONE "))) {
              foundBranch = item.data[i];
              break;
          }
      }
      return foundBranch === adminSelectedBranch;
  });

  if (authLoading) return (
    <div className="h-screen flex flex-col items-center justify-center bg-slate-900 space-y-4">
      <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      <div className="font-black text-white italic uppercase tracking-[0.3em]">OTURUM KONTROL EDİLİYOR...</div>
    </div>
  );

  if (loading && isLoggedIn) return (
    <div className="h-screen flex flex-col items-center justify-center bg-white space-y-4">
      <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      <div className="font-black text-slate-900 italic uppercase tracking-[0.3em]">CMR SISTEMI YUKLENIYOR</div>
    </div>
  );

  if (!isLoggedIn) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-slate-900 text-white font-sans p-6">
        <div className="w-full max-w-sm bg-slate-800 p-10 rounded-[48px] shadow-2xl border border-slate-700 text-center animate-in fade-in zoom-in duration-500">
           <div className="bg-blue-600 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-xl shadow-blue-500/20">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 00-2 2v6a2 2 0 00-2 2zM9 11V7a3 3 0 016 0v4" /></svg>
           </div>
           <h1 className="text-2xl font-black italic uppercase mb-8">CNETMOBIL <span className="text-blue-500">CMR</span></h1>
           
           <div className="flex bg-slate-700 rounded-2xl p-1 mb-8">
               <button onClick={() => {setLoginMode('personel'); setEntryPass('');}} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${loginMode === 'personel' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}>Mağaza / Personel</button>
               <button onClick={() => {setLoginMode('yonetici'); setEntryPass('');}} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${loginMode === 'yonetici' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}>Yönetici Girişi</button>
           </div>
           
           <input 
              type="password" 
              placeholder={loginMode === 'personel' ? "Mağaza Şifresi" : "Yönetici Şifresi"} 
              value={entryPass}
              onChange={(e) => setEntryPass(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              disabled={loginLoading}
              className="w-full p-6 bg-slate-700 rounded-2xl mb-6 text-center font-black text-2xl outline-none border border-slate-600 focus:border-blue-500 transition-all text-white disabled:opacity-50" 
           />
           <button 
             onClick={handleLogin} 
             disabled={loginLoading}
             className="w-full py-6 bg-blue-600 text-white rounded-2xl font-black uppercase text-sm shadow-xl shadow-blue-600/20 hover:bg-blue-500 active:scale-95 transition-all disabled:opacity-50 tracking-widest"
           >
             {loginLoading ? 'KONTROL EDİLİYOR...' : 'SİSTEMİ AÇ'}
           </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col md:flex-row min-h-screen font-sans selection:bg-blue-100 transition-colors duration-500 ${isDarkAppMode ? 'bg-[#111111] text-white' : appMode === 'servis' ? 'bg-[#FFF8F1] text-orange-950' : 'bg-[#F8FAFC] text-slate-900'}`}>
      <style>{`
        #print-area { display: none !important; }
        @media print {
          header, nav, main, footer, .print\\:hidden { display: none !important; }
          #print-area { display: block !important; visibility: visible !important; position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; background: white !important; color: black !important; margin: 0 !important; padding: 40px !important; }
          #print-area * { visibility: visible !important; }
        }
        .btn-click { transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); cursor: pointer; }
        .btn-click:active { transform: scale(0.96); }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #475569; border-radius: 10px; }
      `}</style>

      {/* 1. MOBİL İÇİN ÜST BAR */}
      <div className="md:hidden flex items-center justify-between p-4 bg-[#0B0F19] text-white shadow-md z-40 sticky top-0 border-b border-white/5 print:hidden">
        <div className="flex items-center gap-3">
           <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center ring-1 ring-blue-500/50 shadow-lg">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
           </div>
           <h1 className="text-lg font-black tracking-tight leading-none">
             CNET<span className="text-blue-500">MOBIL</span>
           </h1>
        </div>
        <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 active:scale-95 transition-all">
          <svg className="w-6 h-6 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
      </div>

      {/* 2. MOBİL OVERLAY */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] md:hidden transition-opacity print:hidden" onClick={() => setIsMobileMenuOpen(false)}></div>
      )}

      {/* 3. PREMIUM SAAS DASHBOARD SIDEBAR */}
      <nav className={`fixed md:sticky top-0 inset-y-0 left-0 z-[70] flex flex-col w-[280px] md:w-[260px] lg:w-[300px] h-full md:h-screen border-r border-white/5 print:hidden transition-transform duration-300 ease-in-out bg-[#0B0F19] shadow-2xl 
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        
        <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden absolute top-6 right-4 p-2 text-slate-400 hover:text-white bg-white/5 rounded-lg border border-white/10 z-50">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>

        <div className="p-8 flex flex-col gap-6 relative overflow-hidden mt-2 md:mt-0 shrink-0">
          <div className="absolute top-0 left-0 w-full h-32 bg-blue-600/10 blur-[40px] rounded-full pointer-events-none"></div>
          
          <div onClick={() => { resetAll(); setIsMobileMenuOpen(false); }} className="flex items-center gap-4 cursor-pointer group relative z-10 w-fit">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-2xl ring-1 transition-all duration-300 group-hover:scale-105 ${appMode === 'servis' ? 'bg-gradient-to-br from-orange-500 to-orange-700 ring-orange-500/50' : 'bg-gradient-to-br from-blue-500 to-blue-700 ring-blue-500/50'}`}>
               <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight leading-none text-white">
                CNET<span className={appMode === 'servis' ? 'text-orange-500' : 'text-blue-500'}>MOBIL</span> <span className="font-light text-slate-300">CMR</span>
              </h1>
              <p className="text-[9px] font-medium tracking-[0.25em] text-slate-500 mt-1.5 uppercase">Enterprise Workspace</p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 space-y-8 py-2 custom-scrollbar">
          {step < 99 && menuGroups.map((group, gIdx) => (
            <div key={gIdx} className="space-y-1">
              <h3 className="px-4 text-[10px] font-bold text-slate-500 tracking-[0.2em] uppercase mb-3">{group.title}</h3>
              {group.items.filter(i => i.visible).map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setAppMode(item.id as any); 
                    setStep(1); 
                    resetSelection();
                    setIsMobileMenuOpen(false); 
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[13px] transition-all duration-300
                    ${appMode === item.id 
                      ? 'bg-gradient-to-r from-blue-600/20 to-transparent border-l-2 border-blue-500 text-white font-semibold' 
                      : 'text-slate-400 hover:text-white hover:bg-white/5 border-l-2 border-transparent font-medium'
                    }`}
                >
                  <svg className={`w-5 h-5 ${appMode === item.id ? 'text-blue-500' : 'text-slate-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={item.icon} />
                  </svg>
                  <span className="tracking-wide">{item.label}</span>
                </button>
              ))}
            </div>
          ))}
        </div>

        <div className="p-6 border-t border-white/5 bg-gradient-to-b from-transparent to-black/20 pb-8 md:pb-6 shrink-0">
          <button onClick={() => { setIsInstallmentModalOpen(true); setIsMobileMenuOpen(false); }} className="w-full flex items-center justify-center gap-2 px-4 py-3.5 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white rounded-xl shadow-[0_0_20px_rgba(16,185,129,0.15)] transition-all active:scale-95 mb-6 ring-1 ring-emerald-500/50">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
            <span className="text-[11px] font-bold uppercase tracking-widest">Taksit Hesapla</span>
          </button>
          
          <div className="flex items-center gap-3 p-3.5 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm group hover:bg-white/10 transition-all">
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400 shrink-0 font-bold border border-blue-500/20">C</div>
            <div className="min-w-0 flex-1">
              <p className="text-[8px] font-medium text-slate-500 uppercase tracking-widest">Terminal</p>
              {isMasterAccess ? (
                <select value={selectedBranch} onChange={(e) => setSelectedBranch(e.target.value)} className="w-full bg-transparent text-[11px] font-semibold text-white tracking-wide outline-none appearance-none cursor-pointer uppercase">
                  {branches.map(b => <option key={b.name} value={b.name} className="text-slate-900">{b.name}</option>)}
                </select>
              ) : (
                <p className="text-[11px] font-semibold truncate text-white tracking-wide uppercase">{selectedBranch}</p>
              )}
            </div>
            <button onClick={handleLogout} className="text-slate-500 hover:text-red-400 transition-colors p-1" title="Sistemden Çık">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            </button>
          </div>
          
          <button onClick={() => { setStep(99); setIsMobileMenuOpen(false); }} className="w-full text-center mt-5 text-[9px] font-semibold text-slate-600 uppercase tracking-[0.2em] hover:text-white transition-colors">Yönetici Paneli</button>
        </div>
      </nav>

      {/* 4. ANA İÇERİK ALANI */}
      <div className="flex-1 w-full min-w-0 flex flex-col relative md:h-screen md:overflow-y-auto custom-scrollbar">
        <main className="max-w-[1400px] mx-auto w-full p-4 sm:p-6 lg:p-10 print:hidden">
          
          {appMode === 'imei_list' && step < 99 ? (
            <div className="bg-[#1e1e2d] p-6 sm:p-10 rounded-[48px] shadow-2xl border border-slate-800 text-white animate-in fade-in duration-500">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 border-b border-slate-700 pb-6 gap-4">
                  <div>
                    <h2 className="text-3xl font-black italic tracking-tighter text-[#f39c12]">İMEİ LİSTESİ</h2>
                    <p className="text-[10px] text-slate-400 font-bold tracking-widest mt-1 uppercase">Vodafone Kanalı İmei Kayıtları</p>
                  </div>
                  <div className="bg-[#2a2a3d] border border-slate-700 p-3 rounded-2xl flex items-center w-full md:w-80">
                    <svg className="w-5 h-5 text-slate-400 mr-2 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    <input type="text" placeholder="İmei veya Cihaz Arama..." className="bg-transparent border-none outline-none text-sm text-white w-full" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                  </div>
              </div>
              
              <div className="max-w-5xl mx-auto overflow-x-auto custom-scrollbar pb-2">
                <div className="min-w-[400px]">
                  <div className="bg-[#d35400] px-4 py-3 rounded-t-2xl flex font-black text-[10px] tracking-widest text-white items-center shadow-lg">
                    <div className="flex-[3]">CİHAZ BİLGİSİ</div>
                    <div className="flex-[2] text-right">İMEİ BİLGİSİ</div>
                  </div>
                  <div className="bg-[#2a2a3d] rounded-b-2xl overflow-hidden shadow-inner border-x border-b border-slate-700">
                    {imeiData.slice(1).filter(r => (r[0] && r[0].toLowerCase().includes(searchQuery.toLowerCase())) || (r[1] && r[1].toLowerCase().includes(searchQuery.toLowerCase()))).map((row, i) => {
                        return (
                        <div key={i} className={`flex px-4 py-3 border-b border-slate-600/60 hover:bg-white/10 transition-colors text-[11px] sm:text-xs font-bold items-center group ${i % 2 === 0 ? 'bg-white/[0.02]' : ''}`}>
                          <div className={`flex-[3] flex items-center text-slate-300 group-hover:text-white transition-colors pr-4`}>
                              {row[0] || '-'}
                          </div>
                          <div className={`flex-[2] text-right font-black text-sm whitespace-nowrap text-[#2ecc71]`}>{row[1] || '-'}</div>
                        </div>
                    )})}
                    {imeiData.length <= 1 && (
                      <div className="p-10 text-center text-slate-500 text-xs font-bold uppercase tracking-widest">Henüz veri çekilmedi. Google Sheets'i kontrol edin.</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) :

          appMode === 'ikinci_el' && step < 99 ? (
            <div className="bg-[#1e1e2d] p-6 sm:p-10 rounded-[48px] shadow-2xl border border-slate-800 text-white animate-in fade-in duration-500">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 border-b border-slate-700 pb-6 gap-4">
                  <div>
                    <h2 className="text-3xl font-black italic tracking-tighter text-[#e67e22]">2.EL FİYAT LİSTESİ</h2>
                    <p className="text-[10px] text-slate-400 font-bold tracking-widest mt-1 uppercase">Güncel İkinci El Cihaz Fiyatları</p>
                  </div>
                  <div className="bg-[#2a2a3d] border border-slate-700 p-3 rounded-2xl flex items-center w-full md:w-80">
                    <svg className="w-5 h-5 text-slate-400 mr-2 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    <input type="text" placeholder="Cihaz Arama..." className="bg-transparent border-none outline-none text-sm text-white w-full" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                  </div>
              </div>
              
              <div className="max-w-6xl mx-auto overflow-x-auto custom-scrollbar pb-2">
                <div className="min-w-[650px]">
                  <div className="bg-[#d35400] px-4 py-3 rounded-t-2xl flex font-black text-[10px] tracking-widest text-white items-center shadow-lg">
                    <div className="flex-[3]">CİHAZ BİLGİSİ</div>
                    <div className="flex-1 text-center">ÖZELLİK/DURUM</div>
                    <div className="flex-1 text-center">FİYATI (TL)</div>
                    <div className="flex-[2] text-right">AÇIKLAMA</div>
                  </div>
                  <div className="bg-[#2a2a3d] rounded-b-2xl overflow-hidden shadow-inner border-x border-b border-slate-700">
                    {ikinciElData.slice(1).filter(r => r[0] && r[0].toLowerCase().includes(searchQuery.toLowerCase())).map((row, i) => {
                        const cellName = (row[0] || '').toUpperCase();
                        const isHighlighted = cellName.includes('BOMBA') || cellName.includes('KAMPANYA') || cellName.includes('İNDİRİM') || cellName.includes('FIRSAT');
                        return (
                        <div key={i} className={`flex px-4 py-3 border-b border-slate-600/60 hover:bg-white/10 transition-colors text-[11px] sm:text-xs font-bold items-center group ${isHighlighted ? 'bg-yellow-500/10' : i % 2 === 0 ? 'bg-white/[0.02]' : ''}`}>
                          <div className={`flex-[3] flex items-center ${isHighlighted ? 'text-yellow-400' : 'text-slate-300'} group-hover:text-white transition-colors pr-4`}>
                              {isHighlighted && <span className="w-1.5 h-1.5 bg-yellow-400 rounded-full animate-ping mr-2 shrink-0"></span>}
                              {row[0]}
                          </div>
                          <div className={`flex-1 text-center font-bold text-slate-300 group-hover:text-white`}>{row[1] || '-'}</div>
                          <div className={`flex-1 text-center font-black text-sm whitespace-nowrap ${isHighlighted ? 'text-yellow-400' : 'text-[#2ecc71]'}`}>{row[2] || '-'}</div>
                          <div className={`flex-[2] text-right text-slate-400 break-words pl-2`}>{row[3] || '-'}</div>
                        </div>
                    )})}
                    {ikinciElData.length <= 1 && (
                      <div className="p-10 text-center text-slate-500 text-xs font-bold uppercase tracking-widest">Henüz veri çekilmedi. Google Sheets'i kontrol edin.</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) :

          appMode === 'dis_kanal' && step < 99 ? (
            <div className="bg-[#1e1e2d] p-6 sm:p-10 rounded-[48px] shadow-2xl border border-slate-800 text-white animate-in fade-in duration-500">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 border-b border-slate-700 pb-6 gap-4">
                  <div>
                    <h2 className="text-3xl font-black italic tracking-tighter text-[#1abc9c]">DIŞ KANAL SATIN ALMA</h2>
                    <p className="text-[10px] text-slate-400 font-bold tracking-widest mt-1 uppercase">Dış Kanal Ürün ve Fiyat Listesi</p>
                  </div>
                  <div className="bg-[#2a2a3d] border border-slate-700 p-3 rounded-2xl flex items-center w-full md:w-80">
                    <svg className="w-5 h-5 text-slate-400 mr-2 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    <input type="text" placeholder="Ürün Arama..." className="bg-transparent border-none outline-none text-sm text-white w-full" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                  </div>
              </div>
              
              <div className="max-w-5xl mx-auto overflow-x-auto custom-scrollbar pb-2">
                <div className="min-w-[500px]">
                  <div className="bg-[#16a085] px-4 py-3 rounded-t-2xl flex font-black text-[10px] tracking-widest text-white items-center shadow-lg">
                    <div className="flex-[3]">ÜRÜN / CİHAZ ADI</div>
                    {selectedBranch === 'VODAFONE KANALI' && <div className="flex-1 text-center">FİYATI (TL)</div>}
                    <div className="flex-[2] text-right">DURUM / BİLGİ</div>
                  </div>
                  <div className="bg-[#2a2a3d] rounded-b-2xl overflow-hidden shadow-inner border-x border-b border-slate-700">
                    {disKanalData.slice(1).filter(r => r[0] && r[0].toLowerCase().includes(searchQuery.toLowerCase())).map((row, i) => {
                        const cellName = (row[0] || '').toUpperCase();
                        const isHighlighted = cellName.includes('BOMBA') || cellName.includes('KAMPANYA') || cellName.includes('İNDİRİM') || cellName.includes('FIRSAT');
                        return (
                        <div key={i} className={`flex px-4 py-3 border-b border-slate-600/60 hover:bg-white/10 transition-colors text-[11px] sm:text-xs font-bold items-center group ${isHighlighted ? 'bg-yellow-500/10' : i % 2 === 0 ? 'bg-white/[0.02]' : ''}`}>
                          <div className={`flex-[3] flex items-center ${isHighlighted ? 'text-yellow-400' : 'text-slate-300'} group-hover:text-white transition-colors pr-4 break-words`}>
                              {isHighlighted && <span className="w-1.5 h-1.5 bg-yellow-400 rounded-full animate-ping mr-2 shrink-0"></span>}
                              {row[0]}
                          </div>
                          {selectedBranch === 'VODAFONE KANALI' && (
                              <div className={`flex-1 text-center font-black text-sm whitespace-nowrap ${isHighlighted ? 'text-yellow-400' : 'text-white'}`}>{row[1] || '-'}</div>
                          )}
                          <div className={`flex-[2] text-right text-slate-400 break-words pl-2`}>{row[2] || '-'}</div>
                        </div>
                    )})}
                    {disKanalData.length <= 1 && (
                      <div className="p-10 text-center text-slate-500 text-xs font-bold uppercase tracking-widest">Henüz veri çekilmedi. Google Sheets'i kontrol edin.</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) :

          appMode === 'cep_tablet' && step < 99 ? (
            <div className="bg-[#1e1e2d] p-4 sm:p-10 rounded-[48px] shadow-2xl border border-slate-800 text-white animate-in fade-in duration-500">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 border-b border-slate-700 pb-6 gap-4">
                  <div>
                    <h2 className="text-3xl font-black italic tracking-tighter text-[#3498db]">GÜNCEL FİYATLAR</h2>
                    <p className="text-[10px] text-slate-400 font-bold tracking-widest mt-1 uppercase">Cep + Tablet + IOT Saat Fiyat Listesi</p>
                  </div>
                  <div className="bg-[#2a2a3d] border border-slate-700 p-3 rounded-2xl flex items-center w-full md:w-80">
                    <svg className="w-5 h-5 text-slate-400 mr-2 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    <input type="text" placeholder="Model Hızlı Arama..." className="bg-transparent border-none outline-none text-sm text-white w-full" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                  </div>
              </div>
              
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                {/* SOL SÜTUN - APPLE */}
                <div className="overflow-x-auto custom-scrollbar pb-2">
                  <div className="min-w-[450px]">
                    <div className="bg-[#4472c4] px-4 py-3 rounded-t-2xl flex font-black text-[9px] sm:text-[10px] tracking-widest text-white items-center shadow-lg">
                      <div className="flex-[3]">CEP TELEFONU (APPLE)</div>
                      <div className="flex-1 text-center">KAMPANYA</div>
                      <div className="flex-1 text-center">SATIŞ</div>
                      <div className="flex-1 text-right">RESMİ FİYAT</div>
                    </div>
                    <div className="bg-[#2a2a3d] rounded-b-2xl overflow-hidden shadow-inner border-x border-b border-slate-700">
                      {cepTabletData.slice(1).filter(r => r[0] && r[0].toLowerCase().includes(searchQuery.toLowerCase())).map((row, i) => {
                          const cellName = (row[0] || '').toUpperCase();
                          const isHighlighted = cellName.includes('BOMBA') || cellName.includes('KAMPANYA') || cellName.includes('İNDİRİM') || cellName.includes('FIRSAT');
                          return (
                            <div key={i} className={`flex px-4 py-2.5 border-b border-slate-600/60 hover:bg-white/10 transition-colors text-[11px] sm:text-xs font-bold items-center group ${isHighlighted ? 'bg-yellow-500/10' : i % 2 === 0 ? 'bg-white/[0.02]' : ''}`}>
                                <div className={`flex-[3] flex items-center ${isHighlighted ? 'text-yellow-400' : 'text-slate-300'} group-hover:text-white transition-colors pr-2 break-words`}>
                                  {isHighlighted && <span className="w-1.5 h-1.5 bg-yellow-400 rounded-full animate-ping mr-2 shrink-0"></span>}
                                  {row[0]}
                                </div>
                                <div className={`flex-1 text-center font-black ${isHighlighted ? 'text-yellow-400 text-sm' : 'text-[#ff7675]'}`}>{row[1] || '-'}</div>
                                <div className="flex-1 text-center text-[#dfe6e9] whitespace-nowrap">{row[2] || '-'}</div>
                                <div className="flex-1 text-right text-slate-400 whitespace-nowrap pl-2">{row[3] || '-'}</div>
                            </div>
                          )
                      })}
                      {cepTabletData.length === 0 && (
                        <div className="p-10 text-center text-slate-500 text-xs font-bold uppercase tracking-widest">Henüz veri çekilmedi.</div>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* SAĞ SÜTUN - ANDROID */}
                <div className="overflow-x-auto custom-scrollbar pb-2">
                  <div className="min-w-[450px]">
                    <div className="bg-[#2ecc71] px-4 py-3 rounded-t-2xl flex font-black text-[9px] sm:text-[10px] tracking-widest text-white items-center shadow-lg">
                      <div className="flex-[3]">MODEL (ANDROID / DİĞER)</div>
                      <div className="flex-1 text-center">KAMPANYA</div>
                      <div className="flex-1 text-center">SATIŞ</div>
                      <div className="flex-1 text-right">RESMİ FİYAT</div>
                    </div>
                    <div className="bg-[#2a2a3d] rounded-b-2xl overflow-hidden shadow-inner border-x border-b border-slate-700">
                      {cepTabletData.slice(1).filter(r => r[5] && r[5].toLowerCase().includes(searchQuery.toLowerCase())).map((row, i) => {
                          const cellName = (row[5] || '').toUpperCase();
                          const isHighlighted = cellName.includes('BOMBA') || cellName.includes('KAMPANYA') || cellName.includes('İNDİRİM') || cellName.includes('FIRSAT');
                          return (
                            <div key={i} className={`flex px-4 py-2.5 border-b border-slate-600/60 hover:bg-white/10 transition-colors text-[11px] sm:text-xs font-bold items-center group ${isHighlighted ? 'bg-yellow-500/10' : i % 2 === 0 ? 'bg-white/[0.02]' : ''}`}>
                                <div className={`flex-[3] flex items-center ${isHighlighted ? 'text-yellow-400' : 'text-slate-300'} group-hover:text-white transition-colors pr-2 break-words`}>
                                  {isHighlighted && <span className="w-1.5 h-1.5 bg-yellow-400 rounded-full animate-ping mr-2 shrink-0"></span>}
                                  {row[5]}
                                </div>
                                <div className={`flex-1 text-center font-black ${isHighlighted ? 'text-yellow-400 text-sm' : 'text-[#ff7675]'}`}>{row[6] || '-'}</div>
                                <div className="flex-1 text-center text-[#dfe6e9] whitespace-nowrap">{row[7] || '-'}</div>
                                <div className="flex-1 text-right text-slate-400 whitespace-nowrap pl-2">{row[8] || '-'}</div>
                            </div>
                          )
                      })}
                      {cepTabletData.length === 0 && (
                        <div className="p-10 text-center text-slate-500 text-xs font-bold uppercase tracking-widest">Henüz veri çekilmedi.</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : 
          
          appMode === 'yna_list' && step < 99 ? (
            <div className="bg-[#1e1e2d] p-6 sm:p-10 rounded-[48px] shadow-2xl border border-slate-800 text-white animate-in fade-in duration-500">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 border-b border-slate-700 pb-6 gap-4">
                  <div>
                    <h2 className="text-3xl font-black italic tracking-tighter text-[#9b59b6]">YENİ NESİL AKSESUAR</h2>
                    <p className="text-[10px] text-slate-400 font-bold tracking-widest mt-1 uppercase">Watch, Kulaklık ve Diğer Aksesuarlar (YNA List)</p>
                  </div>
                  <div className="bg-[#2a2a3d] border border-slate-700 p-3 rounded-2xl flex items-center w-full md:w-80">
                    <svg className="w-5 h-5 text-slate-400 mr-2 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    <input type="text" placeholder="Aksesuar Arama..." className="bg-transparent border-none outline-none text-sm text-white w-full" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                  </div>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* SOL SÜTUN YNA */}
                <div className="overflow-x-auto custom-scrollbar pb-2">
                  <div className="min-w-[350px]">
                    <div className="bg-[#8e44ad] px-4 py-3 rounded-t-2xl flex font-black text-[10px] tracking-widest text-white items-center shadow-lg">
                      <div className="flex-[3]">ÜRÜN ADI</div>
                      <div className="flex-1 text-right">FİYATI (TL)</div>
                    </div>
                    <div className="bg-[#2a2a3d] rounded-b-2xl overflow-hidden shadow-inner border-x border-b border-slate-700">
                      {ynaData.slice(1).filter(r => r[0] && r[0].toLowerCase().includes(searchQuery.toLowerCase())).map((row, i) => {
                          const cellName = (row[0] || '').toUpperCase();
                          const isHighlighted = cellName.includes('BOMBA') || cellName.includes('KAMPANYA') || cellName.includes('İNDİRİM') || cellName.includes('FIRSAT');
                          return (
                          <div key={i} className={`flex px-4 py-2 border-b border-slate-600/60 hover:bg-white/10 transition-colors text-[11px] sm:text-xs font-bold items-center group ${isHighlighted ? 'bg-yellow-500/10' : i % 2 === 0 ? 'bg-white/[0.02]' : ''}`}>
                            <div className={`flex-[3] flex items-center ${isHighlighted ? 'text-yellow-400' : 'text-slate-300'} group-hover:text-white transition-colors pr-4 break-words`}>
                                {isHighlighted && <span className="w-1.5 h-1.5 bg-yellow-400 rounded-full animate-ping mr-2 shrink-0"></span>}
                                {row[0]}
                            </div>
                            <div className={`flex-1 text-right font-black text-sm whitespace-nowrap ${isHighlighted ? 'text-yellow-400' : 'text-white'}`}>{row[1] || '-'}</div>
                          </div>
                      )})}
                      {ynaData.length === 0 && (
                        <div className="p-10 text-center text-slate-500 text-xs font-bold uppercase tracking-widest">Henüz veri çekilmedi.</div>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* SAĞ SÜTUN YNA */}
                <div className="overflow-x-auto custom-scrollbar pb-2">
                  <div className="min-w-[350px]">
                    <div className="bg-[#8e44ad] px-4 py-3 rounded-t-2xl flex font-black text-[10px] tracking-widest text-white items-center shadow-lg">
                      <div className="flex-[3]">ÜRÜN ADI</div>
                      <div className="flex-1 text-right">FİYATI (TL)</div>
                    </div>
                    <div className="bg-[#2a2a3d] rounded-b-2xl overflow-hidden shadow-inner border-x border-b border-slate-700">
                      {ynaData.slice(1).filter(r => r[3] && r[3].toLowerCase().includes(searchQuery.toLowerCase())).map((row, i) => {
                          const cellName = (row[3] || '').toUpperCase();
                          const isHighlighted = cellName.includes('BOMBA') || cellName.includes('KAMPANYA') || cellName.includes('İNDİRİM') || cellName.includes('FIRSAT');
                          return (
                          <div key={i} className={`flex px-4 py-2 border-b border-slate-600/60 hover:bg-white/10 transition-colors text-[11px] sm:text-xs font-bold items-center group ${isHighlighted ? 'bg-yellow-500/10' : i % 2 === 0 ? 'bg-white/[0.02]' : ''}`}>
                            <div className={`flex-[3] flex items-center ${isHighlighted ? 'text-yellow-400' : 'text-slate-300'} group-hover:text-white transition-colors pr-4 break-words`}>
                                {isHighlighted && <span className="w-1.5 h-1.5 bg-yellow-400 rounded-full animate-ping mr-2 shrink-0"></span>}
                                {row[3]}
                            </div>
                            <div className={`flex-1 text-right font-black text-sm whitespace-nowrap ${isHighlighted ? 'text-yellow-400' : 'text-white'}`}>{row[4] || '-'}</div>
                          </div>
                      )})}
                      {ynaData.length === 0 && (
                        <div className="p-10 text-center text-slate-500 text-xs font-bold uppercase tracking-widest">Henüz veri çekilmedi.</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) :
          
          /* ---------------- YÖNETİCİ GÖRÜNÜMÜ ---------------- */
          step === 99 ? (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              {!isAdmin ? (
                <div className="max-w-md mx-auto bg-[#1e1e2d] p-12 rounded-[48px] shadow-2xl text-center border border-slate-800 mt-20">
                  <div className="w-16 h-16 bg-blue-600/20 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-blue-500/30">
                      <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 00-2 2v6a2 2 0 00-2 2zM9 11V7a3 3 0 016 0v4" /></svg>
                  </div>
                  <h2 className="text-xl font-black italic mb-8 uppercase tracking-widest text-white">Yönetici Terminali</h2>
                  <input type="password" placeholder="••••••••" className="w-full p-5 bg-[#2a2a3d] rounded-2xl mb-4 text-center font-black outline-none border border-slate-700 focus:border-blue-500 transition-all text-white placeholder-slate-500" onChange={(e) => setAdminPass(e.target.value)} />
                  <button onClick={() => adminPass === 'cnet1905.*' ? setIsAdmin(true) : alert("Hatalı!")} className="bg-blue-600 text-white px-10 py-5 rounded-2xl font-black uppercase w-full btn-click shadow-xl shadow-blue-600/20 hover:bg-blue-500">SİSTEME GİRİŞ YAP</button>
                </div>
              ) : (
                <div className="flex flex-col xl:flex-row gap-8">
                  
                  {/* SOL MENÜ - ŞUBE SEÇİCİ */}
                  <div className="w-full xl:w-72 shrink-0">
                     <div className="bg-[#1e1e2d] p-6 rounded-[40px] shadow-2xl border border-slate-800 xl:sticky xl:top-24">
                        <div className="flex items-center gap-3 mb-6 pb-6 border-b border-slate-700/50">
                           <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center text-blue-400 border border-blue-500/20 shrink-0">
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                           </div>
                           <div>
                              <h3 className="text-sm font-black text-white uppercase tracking-widest">Şube Filtresi</h3>
                              <p className="text-[10px] text-slate-400 mt-1">İstatistik & Kayıtlar</p>
                           </div>
                        </div>

                        <div className="flex flex-col gap-2">
                           {['TÜM ŞUBELER', ...branches.map(b => b.name)].map(bName => {
                              const isActive = adminSelectedBranch === bName;
                              return (
                                 <button 
                                    key={bName}
                                    onClick={() => setAdminSelectedBranch(bName)}
                                    className={`px-4 py-3.5 rounded-2xl text-left text-[11px] font-black uppercase tracking-widest transition-all btn-click flex justify-between items-center group
                                      ${isActive ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50 ring-2 ring-blue-500/50' : 'bg-[#2a2a3d] text-slate-400 hover:text-white hover:bg-[#383852] border border-slate-700/50'}`}
                                 >
                                    <span>{bName}</span>
                                    {isActive && <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span>}
                                 </button>
                              );
                           })}
                        </div>
                        
                        <div className="mt-8 pt-6 border-t border-slate-700/50">
                           <button onClick={() => {setStep(1); setIsAdmin(false); if(isMasterAccess) handleLogout();}} className="w-full py-4 bg-red-500/10 text-red-500 hover:text-white hover:bg-red-600 rounded-2xl font-black uppercase text-[10px] tracking-widest btn-click border border-red-500/20 transition-all flex justify-center items-center gap-2">
                             <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                             Paneli Kapat
                           </button>
                        </div>
                     </div>
                  </div>

                  {/* SAĞ İÇERİK - DASHBOARD */}
                  <div className="flex-1 space-y-8 min-w-0">
                    
                    {/* STATS HEADER */}
                    <div className="bg-[#1e1e2d] p-8 rounded-[40px] shadow-2xl border border-slate-800 relative overflow-hidden">
                       <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
                          <svg className="w-48 h-48 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                       </div>
                       
                       <div className="relative z-10">
                          <h2 className="text-2xl font-black italic uppercase tracking-tighter text-white mb-2">
                            {adminSelectedBranch} İSTATİSTİKLERİ
                          </h2>
                          <p className="text-[11px] text-slate-400 font-bold tracking-widest uppercase mb-8">
                            Seçili şubeye ait güncel işlem özeti
                          </p>

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                             {/* TOPLAM */}
                             <div className="bg-blue-500/10 border border-blue-500/20 p-5 rounded-[24px]">
                                <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Toplam İşlem</p>
                                <p className="text-3xl font-black text-white">{dashboardStats.total}</p>
                             </div>
                             {/* BAŞARILI */}
                             <div className="bg-emerald-500/10 border border-emerald-500/20 p-5 rounded-[24px]">
                                <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1">Başarılı Alım</p>
                                <p className="text-3xl font-black text-white">{dashboardStats.alindi}</p>
                             </div>
                             {/* İPTAL */}
                             <div className="bg-rose-500/10 border border-rose-500/20 p-5 rounded-[24px]">
                                <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-1">İptal / Alınmadı</p>
                                <p className="text-3xl font-black text-white">{dashboardStats.alinmadi}</p>
                             </div>
                             {/* BEKLEYEN */}
                             <div className="bg-slate-700/30 border border-slate-600/50 p-5 rounded-[24px]">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Bekleyen/Diğer</p>
                                <p className="text-3xl font-black text-white">{dashboardStats.diger}</p>
                             </div>
                          </div>
                       </div>
                    </div>

                    {/* ALIM TABLOSU */}
                    <div className="bg-[#1e1e2d] p-6 sm:p-8 rounded-[40px] shadow-2xl border border-slate-800">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-700/50 pb-6 mb-6">
                          <div>
                              <h3 className="text-xl font-black italic uppercase tracking-tighter text-white">SON İŞLEMLER</h3>
                              <p className="text-[10px] text-slate-400 font-bold tracking-widest mt-1 uppercase">Sistemdeki cihaz kayıt geçmişi</p>
                          </div>
                          {adminSelectedBranch === 'TÜM ŞUBELER' && (
                             <button onClick={deleteAllAlimlar} className="bg-red-500/10 text-red-500 px-5 py-2.5 rounded-xl text-[10px] font-black hover:bg-red-600 hover:text-white transition-all uppercase border border-red-500/20 flex items-center gap-2">
                                 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                 Geçmişi Temizle
                             </button>
                          )}
                      </div>

                      {filteredAlimlar.length === 0 ? (
                        <div className="text-center py-20 text-slate-500">
                           <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                           <p className="text-xs font-black uppercase tracking-widest">Bu şubeye ait işlem kaydı bulunamadı.</p>
                        </div>
                      ) : (
                        <div className="overflow-x-auto custom-scrollbar pb-4">
                           <table className="w-full text-left border-collapse min-w-[900px]">
                              <thead>
                                 <tr className="border-b border-slate-700/50">
                                    <th className="py-4 px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest w-40">Tarih / Şube</th>
                                    <th className="py-4 px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest w-48">Müşteri</th>
                                    <th className="py-4 px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Cihaz & Durum</th>
                                    <th className="py-4 px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right w-32">Tutar</th>
                                    <th className="py-4 px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center w-24">İşlem</th>
                                 </tr>
                              </thead>
                              <tbody>
                                 {filteredAlimlar.map((item, i) => {
                                    const rawDevice = item.data[2] || '';
                                    const parts = rawDevice.split(' #EKSPERTİZ# ');
                                    const mainDevice = parts[0];
                                    const ekspertizData = parts.length > 1 ? parts[1] : '';

                                    // Tarih Bulma
                                    let rawDate = item.data[6] || item.data[7] || '';
                                    for (let j = item.data.length - 1; j >= 0; j--) {
                                        const val = String(item.data[j] || '');
                                        if (val.includes('.') && val.includes(':') && val.length > 10 && /\d/.test(val)) {
                                            rawDate = val; break;
                                        }
                                    }
                                    let datePart = rawDate || 'Tarih Yok';
                                    let timePart = '';
                                    if (rawDate && rawDate.includes(' ')) {
                                       const dateParts = rawDate.split(' ');
                                       datePart = dateParts[0];
                                       timePart = dateParts[1];
                                    }

                                    // Status Badge Rengi
                                    const rowDataString = item.data.join(" ");
                                    let statusColor = "bg-slate-800 text-slate-400 border-slate-700";
                                    let statusText = "BEKLEMEDE";
                                    if (rowDataString.includes('[NAKİT ALINDI]')) { statusColor = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"; statusText = "NAKİT"; }
                                    else if (rowDataString.includes('[TAKAS ALINDI]')) { statusColor = "bg-purple-500/10 text-purple-400 border-purple-500/20"; statusText = "TAKAS"; }
                                    else if (rowDataString.includes('[ALINMADI]')) { statusColor = "bg-rose-500/10 text-rose-400 border-rose-500/20"; statusText = "İPTAL"; }

                                    return (
                                       <tr key={i} className={`border-b border-slate-800 hover:bg-white/[0.02] transition-colors group ${i % 2 === 0 ? 'bg-transparent' : 'bg-[#2a2a3d]/20'}`}>
                                          <td className="py-4 px-4 align-top">
                                             <div className="text-[11px] font-bold text-slate-300">{datePart}</div>
                                             {timePart && <div className="text-[10px] text-slate-500">{timePart}</div>}
                                             {adminSelectedBranch === 'TÜM ŞUBELER' && (
                                                <div className="mt-1.5 inline-block px-2 py-0.5 rounded text-[9px] font-black uppercase bg-[#2a2a3d] text-slate-400 border border-slate-700/50">{item.data[0]}</div>
                                             )}
                                          </td>
                                          <td className="py-4 px-4 align-top">
                                             <div className="text-[11px] font-black text-white uppercase">{item.data[1]}</div>
                                             <div className="text-[10px] font-mono text-slate-500 mt-1">{item.data[3] || 'IMEI YOK'}</div>
                                          </td>
                                          <td className="py-4 px-4 align-top">
                                             <div className="flex items-center gap-2 mb-2">
                                                <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase border ${statusColor}`}>
                                                   {statusText}
                                                </span>
                                                <span className="text-[12px] font-black text-blue-100">{mainDevice}</span>
                                             </div>
                                             {ekspertizData && (
                                                <div className="flex flex-wrap gap-1">
                                                   {ekspertizData.split(' | ').map((detail: string, idx: number) => {
                                                      const [key, val] = detail.split(':');
                                                      return (
                                                         <span key={idx} className="bg-[#111111] border border-slate-800 text-slate-400 px-1.5 py-0.5 rounded text-[9px] uppercase">
                                                            {key}: <span className="text-slate-200 font-bold">{val}</span>
                                                         </span>
                                                      );
                                                   })}
                                                </div>
                                             )}
                                          </td>
                                          <td className="py-4 px-4 align-top text-right">
                                             <div className="text-sm font-black italic text-emerald-400">{parseInt(item.data[5]||item.data[4]||0).toLocaleString()} ₺</div>
                                          </td>
                                          <td className="py-4 px-4 align-top text-center">
                                             <button onClick={() => deleteAlim(item.sheetIndex)} className="text-slate-500 hover:text-red-400 p-2 rounded-lg hover:bg-red-500/10 transition-all border border-transparent hover:border-red-500/20 inline-flex items-center justify-center">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                             </button>
                                          </td>
                                       </tr>
                                    );
                                 })}
                              </tbody>
                           </table>
                        </div>
                      )}
                    </div>

                  </div>
                </div>
              )}
            </div>
          ) : step === 1 ? (
            <div className="space-y-12 text-slate-900">
              <div className="text-center space-y-4 mb-16 animate-in fade-in slide-in-from-top-4 duration-700">
                  <h2 className="text-5xl md:text-7xl font-black italic tracking-tighter uppercase">
                    {appMode === 'alim' ? (
                      <span className="text-slate-900">CIHAZ <span className="text-blue-600">ALIM</span> SISTEMI</span>
                    ) : (
                      <span className="text-orange-950">TEKNIK <span className="text-orange-600">SERVIS</span> MERKEZI</span>
                    )}
                  </h2>
                  <p className={`font-bold uppercase tracking-[0.2em] text-xs ${appMode === 'servis' ? 'text-orange-800/60' : 'text-slate-400'}`}>Lütfen işlem yapılacak markayı seçin</p>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-8 animate-in fade-in zoom-in duration-700 delay-200">
                {displayBrands.map(brand => {
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
                          className={`bg-white p-10 rounded-[48px] shadow-sm border flex flex-col items-center justify-center text-center h-72 group transition-all ${appMode === 'servis' ? 'border-orange-100/50 hover:shadow-orange-200/50' : 'border-slate-100/50 hover:shadow-2xl'} ${hasModels ? 'hover:scale-[1.05] cursor-pointer btn-click' : 'opacity-60 cursor-not-allowed grayscale'}`}>
                      <div className="h-24 w-full flex items-center justify-center mb-8 transition-all duration-500 transform group-hover:scale-110">
                        <img src={finalLogo} className="max-h-full max-w-[140px] object-contain" alt={brand} />
                      </div>
                      <h2 className={`font-black text-xl mb-1 uppercase italic tracking-tighter ${appMode === 'servis' ? 'text-orange-950' : 'text-slate-800'}`}>{brand}</h2>
                      <p className={`text-[10px] font-black uppercase tracking-widest ${hasModels ? (appMode==='servis'?'text-orange-400':'text-slate-400') : 'text-red-500 animate-pulse'}`}>
                          {hasModels ? (appMode === 'servis' ? 'SERVIS ISLEMLERI' : `${brand} CİHAZINI SAT`) : 'ÇOK YAKINDA'}
                      </p>
                      
                      <div className={`w-10 h-1 transition-all rounded-full mt-3 ${hasModels ? (appMode === 'servis' ? 'bg-orange-100 group-hover:w-20 group-hover:bg-orange-500' : 'bg-slate-100 group-hover:w-20 group-hover:bg-blue-600') : 'bg-slate-200'}`}></div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : step === 2 ? (
            <div className="animate-in slide-in-from-right-8 duration-500 text-slate-900">
              <div className="flex items-center justify-between mb-8">
                  <button onClick={() => {setStep(1); resetSelection();}} className={`bg-white shadow-sm border px-6 py-3 rounded-2xl text-[10px] font-black uppercase transition-all btn-click flex items-center gap-2 ${appMode === 'servis' ? 'border-orange-200 text-orange-600 hover:text-orange-800' : 'border-slate-200 text-slate-500 hover:text-blue-600'}`}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg>
                    Geri Dön
                  </button>
                  <div className="text-right">
                    <span className={`text-[10px] font-black uppercase tracking-widest ${appMode === 'servis' ? 'text-orange-600' : 'text-blue-600'}`}>{selectedBrand}</span>
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
                    className={`w-full p-5 pl-14 bg-white rounded-3xl text-sm font-black border outline-none focus:ring-4 shadow-sm transition-all placeholder-opacity-50 ${appMode === 'servis' ? 'border-orange-200 focus:border-orange-500 focus:ring-orange-50 text-orange-950 placeholder-orange-300' : 'border-slate-200 focus:border-blue-500 focus:ring-blue-50 text-slate-700 placeholder-slate-400'}`}
                  />
                  <svg className={`w-6 h-6 absolute left-5 top-1/2 -translate-y-1/2 ${appMode === 'servis' ? 'text-orange-300' : 'text-slate-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
                {Array.from(new Set(db.filter(i => i.brand === selectedBrand).map(i => i.name)))
                  .filter(name => name.toLowerCase().includes(searchQuery.toLowerCase()))
                  .map(name => (
                    <div key={name} onClick={() => {setSelectedModelName(name); setStep(3); resetSelection();}} className={`bg-white p-8 rounded-[40px] shadow-sm cursor-pointer border-2 border-transparent transition-all text-center btn-click group flex flex-col items-center justify-between min-h-[220px] ${appMode === 'servis' ? 'hover:shadow-xl hover:shadow-orange-100 hover:border-orange-400/50' : 'hover:shadow-xl hover:border-blue-500/50'}`}>
                      <div className="h-32 flex items-center justify-center mb-4 transform group-hover:scale-110 transition-transform duration-500">
                          <img src={db.find(i => i.name === name)?.img} className="max-h-full object-contain drop-shadow-2xl" />
                      </div>
                      
                      <div className="w-full">
                        <p className={`font-black text-[12px] uppercase tracking-tighter leading-tight ${appMode === 'servis' ? 'text-orange-950' : 'text-slate-800'}`}>{name}</p>
                        <p className={`text-[9px] font-bold mt-2 uppercase tracking-widest ${appMode === 'servis' ? 'text-orange-400' : 'text-slate-400'}`}>
                            {appMode === 'servis' ? 'SERVİS SEÇENEKLERİ' : 'TELEFONUNU SAT'}
                        </p>
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
            <div className="flex flex-col lg:flex-row gap-10 animate-in fade-in duration-700 text-slate-900">
              {/* SOL KISIM */}
              <div className="flex-1 space-y-6">
                <button onClick={() => {setStep(2); resetSelection();}} className={`bg-white shadow-sm border px-6 py-3 rounded-2xl text-[10px] font-black uppercase transition-all btn-click flex items-center gap-2 ${appMode === 'servis' ? 'border-orange-200 text-orange-500 hover:text-orange-700' : 'border-slate-200 text-slate-500 hover:text-blue-600'}`}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg>
                  Modellere Dön
                </button>

                {appMode === 'servis' ? (
                  <div className="bg-white p-10 rounded-[48px] shadow-xl border border-orange-100 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none">
                        <svg className="w-40 h-40 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    </div>
                    
                    <div className="flex flex-col md:flex-row items-center gap-8 mb-10">
                        <div className="w-40 h-40 shrink-0 bg-orange-50 rounded-3xl p-4 flex items-center justify-center border border-orange-100">
                          <img src={db.find(i => i.name === selectedModelName)?.img} className="max-h-full object-contain drop-shadow-xl" alt="Device" />
                        </div>
                        <div>
                          <span className="bg-orange-100 text-orange-700 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest">{selectedBrand}</span>
                          <h2 className="text-4xl font-black italic mt-3 uppercase tracking-tighter text-orange-950">{selectedModelName}</h2>
                          <p className="text-orange-500/80 font-bold uppercase tracking-widest text-[10px] mt-2">Teknik Servis Onarım Fiyatları</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        
                        <div className="bg-orange-50/50 p-6 rounded-[32px] border border-orange-100 text-center hover:bg-orange-50 hover:shadow-lg transition-all group flex flex-col justify-between">
                          <div>
                              <div className="text-3xl mb-4 grayscale group-hover:grayscale-0 transition-all">📱</div>
                              <p className="text-[11px] font-black text-orange-800/60 uppercase tracking-widest mb-2">Ekran Değişimi</p>
                          </div>
                          
                          <div className="flex flex-col gap-2 mt-4 text-left bg-white/60 p-4 rounded-2xl border border-orange-200/50">
                              <div className="flex justify-between items-center border-b border-orange-100 pb-1">
                                <span className="text-[10px] font-black text-orange-900 uppercase">Orjinal:</span> 
                                <span className="font-black text-sm italic">{servisFiyatlari[selectedModelName]?.ekranOrj || servisFiyatlari[selectedModelName]?.ekran ? `${Number(servisFiyatlari[selectedModelName]?.ekranOrj || servisFiyatlari[selectedModelName]?.ekran).toLocaleString()} TL` : '-'}</span>
                              </div>
                              <div className="flex justify-between items-center border-b border-orange-100 pb-1">
                                <span className="text-[10px] font-black text-orange-900 uppercase">OLED:</span> 
                                <span className="font-black text-sm italic">{servisFiyatlari[selectedModelName]?.ekranOled ? `${Number(servisFiyatlari[selectedModelName]?.ekranOled).toLocaleString()} TL` : '-'}</span>
                              </div>
                              {selectedBrand?.toLowerCase() === 'apple' && (
                              <div className="flex justify-between items-center">
                                <span className="text-[10px] font-black text-orange-900 uppercase">Çipli:</span> 
                                <span className="font-black text-sm italic">{servisFiyatlari[selectedModelName]?.ekranCipli ? `${Number(servisFiyatlari[selectedModelName]?.ekranCipli).toLocaleString()} TL` : '-'}</span>
                              </div>
                              )}
                          </div>
                        </div>

                        <div className="bg-orange-50/50 p-6 rounded-[32px] border border-orange-100 text-center hover:bg-orange-50 hover:shadow-lg transition-all group flex flex-col justify-between">
                          <div>
                              <div className="text-3xl mb-4 grayscale group-hover:grayscale-0 transition-all">🔋</div>
                              <p className="text-[11px] font-black text-orange-800/60 uppercase tracking-widest mb-2">Batarya Değişimi</p>
                          </div>
                          <div className="text-2xl font-black italic tracking-tighter text-orange-900 mt-4">
                              {servisFiyatlari[selectedModelName]?.batarya ? `${Number(servisFiyatlari[selectedModelName]?.batarya).toLocaleString()} TL` : 'Fiyat Yok'}
                          </div>
                        </div>

                        <div className="bg-orange-50/50 p-6 rounded-[32px] border border-orange-100 text-center hover:bg-orange-50 hover:shadow-lg transition-all group flex flex-col justify-between">
                          <div>
                              <div className="text-3xl mb-4 grayscale group-hover:grayscale-0 transition-all">💠</div>
                              <p className="text-[11px] font-black text-orange-800/60 uppercase tracking-widest mb-2">Arka Cam</p>
                          </div>
                          <div className="text-2xl font-black italic tracking-tighter text-orange-900 mt-4">
                              {servisFiyatlari[selectedModelName]?.arkaCam ? `${Number(servisFiyatlari[selectedModelName]?.arkaCam).toLocaleString()} TL` : 'Fiyat Yok'}
                          </div>
                        </div>

                        <div className="bg-orange-50/50 p-6 rounded-[32px] border border-orange-100 text-center hover:bg-orange-50 hover:shadow-lg transition-all group flex flex-col justify-between">
                          <div>
                              <div className="text-3xl mb-4 grayscale group-hover:grayscale-0 transition-all">🛠</div>
                              <p className="text-[11px] font-black text-orange-800/60 uppercase tracking-widest mb-2">Kasa Değişimi</p>
                          </div>
                          <div className="text-2xl font-black italic tracking-tighter text-orange-900 mt-4">
                              {servisFiyatlari[selectedModelName]?.kasa ? `${Number(servisFiyatlari[selectedModelName]?.kasa).toLocaleString()} TL` : 'Fiyat Yok'}
                          </div>
                        </div>

                    </div>
                  </div>
                ) : (
                  <>
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
                        { label: "Ahize / Buzzer", field: "speaker", opts: ['Sağlam', 'Cızırtı var', 'Arızalı'] },
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
                  </>
                )}
              </div>

              {/* SAĞ KISIM (FİYAT VE BUTONLAR) */}
              <div className="lg:w-96 space-y-6 sticky top-28 h-fit">
                
                {appMode === 'servis' ? (
                  <div className="bg-orange-950 p-10 rounded-[48px] space-y-4 shadow-2xl">
                      <div className="w-16 h-16 bg-orange-800 rounded-3xl flex items-center justify-center mx-auto mb-6">
                          <svg className="w-8 h-8 text-orange-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                      </div>
                      <h3 className="text-xl font-black italic text-white uppercase text-center mb-6">Müşteriye İlet</h3>
                      <p className="text-[10px] font-black text-orange-500/80 uppercase tracking-widest text-center mb-8">Fiyat teklifini direkt WhatsApp üzerinden müşteriye gönderebilirsiniz.</p>
                      
                      <button onClick={handleServisWhatsApp} className="w-full py-6 rounded-2xl font-black uppercase text-[11px] tracking-widest transition-all btn-click flex items-center justify-center gap-3 shadow-lg bg-[#25D366] text-white hover:bg-[#128C7E] shadow-green-900/40">
                          WHATSAPP'TAN TEKLİF GÖNDER
                      </button>
                  </div>
                ) : (
                  <>
                    {isYd ? (
                      <div className="bg-red-600 p-10 rounded-[48px] shadow-2xl text-white text-center border-b-[12px] border-red-800 animate-pulse">
                        <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-6 text-3xl">⚠️</div>
                        <p className="text-2xl font-black uppercase italic leading-none tracking-tighter">YURT DIŞI CIHAZ</p>
                        <p className="text-[10px] mt-4 uppercase tracking-[0.2em] font-black opacity-80">BU CIHAZ ICIN YONETICI ONAYI GEREKLIDIR</p>
                      </div>
                    ) : (
                      <div className="space-y-6 animate-in zoom-in-95 duration-500">
                        
                        {/* NAKİT FİYAT KARTI */}
                        <div className="bg-white p-10 rounded-[48px] shadow-xl border border-slate-100 text-center group transition-all hover:scale-[1.02]">
                          <p className="text-[11px] font-black text-slate-400 uppercase mb-4 tracking-widest italic">Nakit Alış Teklifi</p>
                          <div className="text-4xl font-black italic tracking-tighter text-slate-950">
                            {selectedCapacity && allSelected ? `${finalCashPrice.toLocaleString()} TL` : '---'}
                          </div>
                          
                          {selectedCapacity && allSelected && !purchaseType && (
                            <div className="mt-4">
                              {!isCustomOfferActive ? (
                                <button onClick={() => setIsCustomOfferActive(true)} className="text-[10px] font-black text-blue-600 hover:text-blue-800 uppercase tracking-widest bg-blue-50 px-4 py-2 rounded-xl transition-colors">
                                  Teklifi Revize Et (Düşür)
                                </button>
                              ) : (
                                <div className="flex flex-col items-center gap-2 animate-in fade-in duration-300">
                                  <div className="flex items-center gap-2">
                                    <input 
                                      type="number" 
                                      value={customOffer} 
                                      onChange={(e) => {
                                        const valStr = e.target.value;
                                        if (valStr === '') { setCustomOffer(''); return; }
                                        const val = parseInt(valStr) || 0;
                                        if (val > prices.cash) {
                                          alert(`Sistem teklifinden (${prices.cash} TL) yüksek bir fiyat giremezsiniz!`);
                                          setCustomOffer(prices.cash.toString());
                                        } else {
                                          setCustomOffer(valStr);
                                        }
                                      }} 
                                      placeholder="Yeni Tutar" 
                                      className="w-28 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-black text-center outline-none focus:border-blue-500"
                                    />
                                    <button onClick={() => {setIsCustomOfferActive(false); setCustomOffer('');}} className="bg-red-50 text-red-600 p-3 rounded-xl hover:bg-red-100 transition-colors" title="İptal">
                                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                  </div>
                                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">* Sadece sistem fiyatından düşük girilebilir</p>
                                </div>
                              )}
                            </div>
                          )}

                          <div className="h-1.5 w-16 bg-blue-600 mx-auto mt-6 rounded-full opacity-20 group-hover:opacity-100 transition-opacity"></div>
                        </div>
                        
                        {/* TAKAS FİYAT KARTI */}
                        <div className="bg-blue-600 p-10 rounded-[48px] shadow-2xl text-center text-white relative overflow-hidden group hover:scale-[1.02] transition-all">
                          <p className="text-[11px] font-black text-blue-200 uppercase mb-4 tracking-widest italic">Takas Desteği İle</p>
                          <div className="text-4xl font-black italic tracking-tighter">
                            {selectedCapacity && allSelected ? `${finalTradePrice.toLocaleString()} TL` : '---'}
                          </div>
                          
                          {selectedCapacity && allSelected && !purchaseType && (
                            <div className="mt-4 relative z-10">
                              {!isCustomTradeOfferActive ? (
                                <button onClick={() => setIsCustomTradeOfferActive(true)} className="text-[10px] font-black text-white hover:text-blue-100 uppercase tracking-widest bg-blue-700 px-4 py-2 rounded-xl transition-colors shadow-inner">
                                  Teklifi Revize Et (Düşür)
                                </button>
                              ) : (
                                <div className="flex flex-col items-center gap-2 animate-in fade-in duration-300">
                                  <div className="flex items-center gap-2">
                                    <input 
                                      type="number" 
                                      value={customTradeOffer} 
                                      onChange={(e) => {
                                        const valStr = e.target.value;
                                        if (valStr === '') { setCustomTradeOffer(''); return; }
                                        const val = parseInt(valStr) || 0;
                                        if (val > calculatedTradePrice) {
                                          alert(`Sistem teklifinden (${calculatedTradePrice} TL) yüksek bir fiyat giremezsiniz!`);
                                          setCustomTradeOffer(calculatedTradePrice.toString());
                                        } else {
                                          setCustomTradeOffer(valStr);
                                        }
                                      }} 
                                      placeholder="Yeni Tutar" 
                                      className="w-28 p-3 bg-blue-700 border border-blue-500 rounded-xl text-sm font-black text-center outline-none focus:border-white text-white placeholder-blue-300"
                                    />
                                    <button onClick={() => {setIsCustomTradeOfferActive(false); setCustomTradeOffer('');}} className="bg-red-500 text-white p-3 rounded-xl hover:bg-red-600 transition-colors" title="İptal">
                                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                  </div>
                                  <p className="text-[9px] font-bold text-blue-300 uppercase tracking-widest">* Sadece sistem fiyatından düşük girilebilir</p>
                                </div>
                              )}
                            </div>
                          )}
                          
                        </div>
                      </div>
                    )}

                    <div className="bg-slate-900 p-10 rounded-[48px] space-y-4 shadow-2xl">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center mb-2">1. İŞLEM TÜRÜN SEÇİN</p>
                      
                      <div className="flex gap-3">
                          <button 
                              disabled={!canProceed || purchaseType !== null} 
                              onClick={() => { setPurchaseType('NAKİT'); handleFinalProcess('NAKİT ALINDI'); }} 
                              className={`flex-1 py-4 rounded-xl font-black uppercase text-[10px] transition-all 
                              ${!canProceed || (purchaseType && purchaseType !== 'NAKİT') ? 'opacity-30 cursor-not-allowed bg-slate-800 text-slate-600' : ''} 
                              ${purchaseType === 'NAKİT' ? 'bg-emerald-500 text-white ring-4 ring-emerald-500/30 cursor-default' : ''} 
                              ${canProceed && !purchaseType ? 'btn-click bg-slate-800 text-slate-300 hover:bg-emerald-500 hover:text-white' : ''}`}>
                              ✓ NAKİT ALINDI
                          </button>
                          <button 
                              disabled={!canProceed || purchaseType !== null} 
                              onClick={() => { setPurchaseType('TAKAS'); handleFinalProcess('TAKAS ALINDI'); }} 
                              className={`flex-1 py-4 rounded-xl font-black uppercase text-[10px] transition-all 
                              ${!canProceed || (purchaseType && purchaseType !== 'TAKAS') ? 'opacity-30 cursor-not-allowed bg-slate-800 text-slate-600' : ''} 
                              ${purchaseType === 'TAKAS' ? 'bg-purple-500 text-white ring-4 ring-purple-500/30 cursor-default' : ''} 
                              ${canProceed && !purchaseType ? 'btn-click bg-slate-800 text-slate-300 hover:bg-purple-500 hover:text-white' : ''}`}>
                              🔄 TAKAS ALINDI
                          </button>
                      </div>
                      
                      <button 
                          disabled={!canProceed || purchaseType !== null} 
                          onClick={() => { setPurchaseType('ALINMADI'); handleFinalProcess('ALINMADI'); }} 
                          className={`w-full py-3 rounded-xl font-black uppercase text-[10px] transition-all 
                          ${!canProceed || (purchaseType && purchaseType !== 'ALINMADI') ? 'opacity-30 cursor-not-allowed bg-slate-800 text-slate-600' : ''} 
                          ${purchaseType === 'ALINMADI' ? 'bg-rose-500 text-white ring-4 ring-rose-500/30 cursor-default' : ''} 
                          ${canProceed && !purchaseType ? 'btn-click bg-slate-800 text-rose-400 hover:bg-rose-500 hover:text-white' : ''}`}>
                          ✕ ALINMADI
                      </button>

                      <div className={`pt-6 mt-6 border-t border-slate-800 space-y-4 transition-all duration-500 ${showDocs ? 'opacity-100 translate-y-0' : 'opacity-20 pointer-events-none translate-y-2'}`}>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">2. BELGE VE BİLDİRİM</p>
                          <button disabled={!showDocs} onClick={() => handleFinalProcess('print')} className={`w-full py-6 rounded-2xl font-black uppercase text-[11px] tracking-widest transition-all btn-click flex items-center justify-center gap-3 shadow-lg ${showDocs ? 'bg-white text-slate-950 hover:bg-slate-50' : 'bg-slate-800 text-slate-600'}`}>
                            SÖZLEŞMEYİ YAZDIR {purchaseType && purchaseType !== 'ALINMADI' ? `(${purchaseType})` : ''}
                          </button>
                          <button disabled={!showDocs} onClick={() => handleFinalProcess('whatsapp')} className={`w-full py-6 rounded-2xl font-black uppercase text-[11px] tracking-widest transition-all btn-click flex items-center justify-center gap-3 shadow-lg ${showDocs ? 'bg-[#25D366] text-white hover:bg-[#128C7E] shadow-green-900/40' : 'bg-slate-800 text-slate-600'}`}>
                            WHATSAPP'A GÖNDER
                          </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
              
            </div>
          )}
        </main>
        
        <footer className="mt-auto max-w-[1400px] w-full mx-auto px-6 py-10 text-center print:hidden">
          <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.5em]">CNETMOBIL • CMR ENTERPRISE DASHBOARD v6.0.0 (ADMIN SAAS)</p>
        </footer>
      </div>

      {/* TAKSİT MODALI */}
      {isInstallmentModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/80 backdrop-blur-md print:hidden p-4">
          <div className="bg-white rounded-[40px] shadow-2xl p-8 w-full max-w-4xl relative animate-in fade-in zoom-in duration-300 border border-slate-100 flex flex-col max-h-[90vh]">
            
            <div className="flex justify-between items-center mb-8 border-b border-slate-100 pb-6 shrink-0">
              <div className="flex items-center gap-4">
                <div className="bg-emerald-50 text-emerald-600 w-12 h-12 rounded-2xl flex items-center justify-center">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
                </div>
                <div>
                  <h2 className="text-2xl font-black italic text-slate-900 uppercase tracking-tighter">Taksit Hesaplama</h2>
                </div>
              </div>
              <button 
                onClick={() => { setIsInstallmentModalOpen(false); setInstallmentAmount(''); }} 
                className="bg-slate-100 p-3 rounded-2xl text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all btn-click"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <div className="mb-6 shrink-0 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-50 p-4 rounded-3xl border border-slate-100 focus-within:border-emerald-500 focus-within:bg-white transition-all">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Müşteri Adı Soyadı</label>
                  <input
                    type="text"
                    placeholder="Örn: Gökhan Özden"
                    value={customer.name}
                    onChange={(e) => setCustomer({...customer, name: e.target.value})}
                    className="w-full mt-2 bg-transparent text-sm font-black outline-none text-slate-800 placeholder-slate-300 uppercase"
                  />
                </div>
                <div className="bg-slate-50 p-4 rounded-3xl border border-slate-100 focus-within:border-emerald-500 focus-within:bg-white transition-all">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Telefon Numarası</label>
                  <input
                    type="text"
                    placeholder="Örn: 0535 893 04 51"
                    value={customer.phone}
                    onChange={(e) => setCustomer({...customer, phone: e.target.value})}
                    className="w-full mt-2 bg-transparent text-sm font-black outline-none text-slate-800 placeholder-slate-300"
                  />
                </div>
              </div>

              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none">
                  <span className="text-slate-400 font-black text-xl">₺</span>
                </div>
                <input
                  type="number"
                  placeholder="İşlem Tutarını Giriniz..."
                  value={installmentAmount}
                  onChange={(e) => setInstallmentAmount(e.target.value)}
                  className="w-full py-6 pl-12 pr-6 bg-slate-50 rounded-3xl text-2xl font-black border border-slate-200 outline-none focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-50 transition-all text-slate-800"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 pb-4">
              {installmentAmount && Number(installmentAmount) > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { month: 2, rate: 7.83 },
                    { month: 3, rate: 10.05 },
                    { month: 4, rate: 12.36 },
                    { month: 5, rate: 14.76 },
                    { month: 6, rate: 17.55 },
                    { month: 7, rate: 20.19 },
                    { month: 8, rate: 22.96 },
                    { month: 9, rate: 25.85 },
                    { month: 10, rate: 28.88 },
                    { month: 11, rate: 32.07 },
                    { month: 12, rate: 35.41 },
                  ].map((inst) => {
                    const multiplier = 1 + (inst.rate / 100);
                    const total = Number(installmentAmount) * multiplier;
                    const monthly = total / inst.month;
                    
                    return (
                      <div key={inst.month} className="flex justify-between items-center bg-white p-5 rounded-[28px] border border-slate-200 shadow-sm hover:border-emerald-400 hover:shadow-lg transition-all group cursor-default">
                        <div className="flex items-center gap-4">
                          <div className="bg-slate-900 group-hover:bg-emerald-600 transition-colors text-white w-14 h-14 flex flex-col items-center justify-center rounded-[20px] shadow-md shrink-0">
                            <span className="font-black text-xl leading-none">{inst.month}</span>
                            <span className="text-[9px] font-bold uppercase tracking-widest mt-0.5 opacity-80">Taksit</span>
                          </div>
                          <div>
                            <div className="text-xl font-black italic text-slate-900 tracking-tighter">
                              {monthly.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 border-l border-slate-100 pl-4">
                          <div className="text-right hidden sm:block">
                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                              Toplam
                            </div>
                            <div className="text-base font-black text-slate-700">
                              {total.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL
                            </div>
                          </div>
                          <button
                            onClick={() => handleSendInstallmentToWhatsApp(inst.month, total)}
                            className="bg-[#25D366] hover:bg-[#128C7E] text-white w-12 h-12 rounded-[18px] flex items-center justify-center transition-all shadow-md shadow-green-200 btn-click shrink-0"
                            title="Müşteri Bilgileriyle WhatsApp'a Gönder"
                          >
                            <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
                              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                            </svg>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center opacity-40 py-10 text-slate-900">
                  <svg className="w-20 h-20 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0-2.08-.402-2.599-1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <p className="text-lg font-black uppercase tracking-widest text-center">Hesaplama için<br/>tutar giriniz</p>
                </div>
              )}
            </div>
            
          </div>
        </div>
      )}

      {/* YAZDIRMA EKRANI */}
      {appMode === 'alim' && (
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
            
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'30px', marginBottom:'20px'}}>
              <div style={{border:'2px solid black', padding:'15px', borderRadius:'15px'}}>
                <h3 style={{fontSize:'12px', fontWeight:'900', textTransform:'uppercase', fontStyle:'italic', marginBottom:'10px', borderBottom:'1px solid #ddd', paddingBottom:'5px'}}>👤 Satıcı Bilgileri</h3>
                <div style={{fontSize:'11px', fontWeight:'bold', lineHeight:'1.8'}}>
                  <p>Ad Soyad: <span style={{textTransform:'uppercase', fontWeight:'900', fontSize:'13px'}}>{customer.name || '________________'}</span></p>
                  <p>Telefon: {customer.phone || '________________'}</p>
                  <p>T.C. Kimlik No: ___________________________</p>
                </div>
              </div>
              <div style={{border:'2px solid black', padding:'15px', borderRadius:'15px'}}>
                <h3 style={{fontSize:'12px', fontWeight:'900', textTransform:'uppercase', fontStyle:'italic', marginBottom:'10px', borderBottom:'1px solid #ddd', paddingBottom:'5px'}}>📱 Cihaz Bilgileri</h3>
                <div style={{fontSize:'11px', fontWeight:'bold', lineHeight:'1.8'}}>
                  <p>Model: <span style={{fontWeight:'900', fontSize:'13px'}}>{selectedModelName} {selectedCapacity?.cap} {selectedModelName === "iPhone 13" ? `(${selectedColor})` : ''}</span></p>
                  <p>IMEI: <span style={{fontWeight:'900', fontSize:'12px'}}>{customer.imei || '________________'}</span></p>
                </div>
              </div>
            </div>

            <div style={{border:'2px solid black', padding:'15px', borderRadius:'15px', marginBottom:'20px'}}>
              <h3 style={{fontSize:'12px', fontWeight:'900', textTransform:'uppercase', fontStyle:'italic', marginBottom:'10px', borderBottom:'1px solid #ddd', paddingBottom:'5px'}}>🛠️ Teknik Ekspertiz Raporu</h3>
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px 40px', fontSize:'10px', fontWeight:'bold'}}>
                 <p>Cihaz Açılıyor mu: <span style={{fontWeight:'900'}}>{status.power}</span></p>
                 <p>Ekran Durumu: <span style={{fontWeight:'900'}}>{status.screen}</span></p>
                 <p>Kozmetik Durum: <span style={{fontWeight:'900'}}>{status.cosmetic}</span></p>
                 <p>Face ID / Touch ID: <span style={{fontWeight:'900'}}>{status.faceId}</span></p>
                 <p>Ahize / Buzzer: <span style={{fontWeight:'900'}}>{status.speaker}</span></p>
                 <p>Batarya Sağlığı: <span style={{fontWeight:'900'}}>{status.battery}</span></p>
                 <p>Kayıt Durumu: <span style={{fontWeight:'900'}}>{status.sim}</span></p>
                 <p>Garanti ve Durum: <span style={{fontWeight:'900'}}>{status.warranty}</span></p>
              </div>
            </div>

            <div style={{display:'grid', gridTemplateColumns: purchaseType ? '1fr' : '1fr 1fr', gap:'20px', marginBottom:'30px', textAlign:'center'}}>
                {purchaseType === 'NAKİT' && (
                  <div style={{border:'3px solid black', padding:'15px', borderRadius:'15px'}}>
                    <p style={{fontSize:'10px', fontWeight:'900', textTransform:'uppercase', marginBottom:'3px', color:'#666'}}>Ödenecek Nakit Tutarı</p>
                    <p style={{fontSize:'28px', fontWeight:'900', fontStyle:'italic', margin:0}}>{finalCashPrice.toLocaleString()} TL</p>
                  </div>
                )}
                {purchaseType === 'TAKAS' && (
                  <div style={{border:'3px solid black', padding:'15px', borderRadius:'15px', backgroundColor:'#f8f8f8'}}>
                    <p style={{fontSize:'10px', fontWeight:'900', textTransform:'uppercase', marginBottom:'3px', color:'#666'}}>Takas Bedeli</p>
                    <p style={{fontSize:'28px', fontWeight:'900', fontStyle:'italic', margin:0}}>{finalTradePrice.toLocaleString()} TL</p>
                  </div>
                )}
            </div>

            <div style={{fontSize:'9px', fontWeight:'900', fontStyle:'italic', lineHeight:'1.5', marginBottom:'60px', backgroundColor:'#fdfdfd', padding:'15px', border:'1px solid #eee', borderRadius:'10px'}}>
              BEYAN VE TAAHHÜT: Cihaz mülkiyeti şahsıma ait olup, yukarıda belirtilen teknik durumun doğruluğunu ve tüm yasal sorumluluğu kabul ederim. Cihazdaki verilerin silinmesinden satıcı sorumlu tutulamaz.
            </div>
            
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'100px', textAlign:'center'}}>
              <div style={{borderTop:'2px solid black', paddingTop:'10px', fontWeight:'900', fontSize:'12px', textTransform:'uppercase', fontStyle:'italic'}}>Müşteri İmza</div>
              <div style={{borderTop:'2px solid black', paddingTop:'10px', fontWeight:'900', fontSize:'12px', textTransform:'uppercase', fontStyle:'italic'}}>CNETMOBIL YETKİLİ</div>
            </div>
        </div>
      )}
    </div>
  );
}
