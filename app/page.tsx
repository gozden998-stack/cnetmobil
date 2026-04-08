"use client";
import React, { useState, useEffect } from 'react';

const SHEET_ID = '1GvagcuTfR_e66A1yxTPqaIgh4YEmYl4M7-E2oRzZhyg';
const API_KEY = 'AIzaSyD4zJB-fvZdAR5WucfwITuqpIuHgbpK2gc';
// DİKKAT: Orijinal tablo ismindeki boşluk yapısı korundu. Değiştirmeyin.
const TABLO_ISMI = 'Google Sheets ile Kurumsal Alım Sistemi'; 
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwvlMvSs-i-wEn197eeBEMLRpiUcW_A7z0nO0oA0seXzcvZ86xsNBfTzZVRmnaEwwrJ/exec';

// ŞUBE IP ADRESLERİ - TAM KİLİTLİ LİSTE
const IP_HARITASI: any = {
  "78.188.91.172": "CMR SARAY",
  "46.197.252.143": "CMR KAPAKLI",
  "31.155.79.145": "CMR MERKEZ",
  "149.0.18.162": "CMR CADDE"
};

// PATRON / YÖNETİCİ IP ADRESLERİ
const MASTER_IPLER = [
  "95.70.226.118",
  "148.0.18.162"
];

// GÜNCEL ŞUBE ŞİFRELERİ
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

  // UYGULAMA MODU
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
        const ctRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent('CEP + TABLET+IOT SAAT LIST')}!A1:I1000?key=${API_KEY}`;
        const ctData = await ctRes.json();
        if (ctData.values) setCepTabletData(ctData.values);
      } catch(e) { console.warn("CEP+TABLET tablosu çekilemedi.", e); }

      try {
        const ynaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent('YNA LİST')}!A1:F1000?key=${API_KEY}`;
        const ynaData = await ynaRes.json();
        if (ynaData.values) setYnaData(ynaData.values);
      } catch(e) { console.warn("YNA LIST tablosu çekilemedi.", e); }

      try {
        const dkRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent('DIŞ KANAL SATIN ALMA')}!A1:C1000?key=${API_KEY}`;
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
        const ieRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent('2.EL FİYAT LİSTESİ')}!A1:D1000?key=${API_KEY}`;
        const ieData = await ieRes.json();
        if (ieData.values) setIkinciElData(ieData.values);
      } catch(e) { console.warn("2.EL FİYAT LİSTESİ tablosu çekilemedi.", e); }

      try {
        const imeiRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent('İMEİ LİSTESİ')}!A1:B1000?key=${API_KEY}`;
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
    const now = new Date();
    const dateTime = `${now.toLocaleDateString('tr-TR')} ${now.toLocaleTimeString('tr-TR', {hour:'2-digit', minute:'2-digit'})}`;
    
    let actionLabel = actionType;
    if (actionType === 'print' || actionType === 'whatsapp') {
        actionLabel = purchaseType === 'NAKİT' ? 'NAKİT ALINDI' : 'TAKAS ALINDI';
    }

    const statusLabel = ` [${actionLabel}]`;
    const colorLabel = selectedModelName === "iPhone 13" ? ` - Renk: ${selectedColor}` : "";

    if (actionType === 'NAKİT ALINDI' || actionType === 'TAKAS ALINDI' || actionType === 'ALINMADI') {
        try {
          await fetch(SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
              type: "SAVE_ALIM",
              branch: selectedBranch,
              customer: customer.name,
              device: `${selectedModelName} (${selectedCapacity?.cap})${colorLabel}${statusLabel}`,
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

  const isYd = status.sim === 'Fiziksel + eSIM (YD)';
  const allSelected = Object.values(status).every(v => v !== null) && selectedCapacity;
  const canProceed = allSelected;
  const showDocs = purchaseType === 'NAKİT' || purchaseType === 'TAKAS';

  const isDarkAppMode = appMode === 'cep_tablet' || appMode === 'yna_list' || appMode === 'dis_kanal' || appMode === 'ikinci_el' || appMode === 'imei_list';

  // Vivo, Huawei, Oppo, Realme baseBrands'den çıkarıldı ama db'de varsa gelir.
  const baseBrands = ["Apple", "Samsung", "Xiaomi"];
  const displayBrands = Array.from(new Set([...baseBrands, ...brandDb.map(b => b.name), ...db.map(i => i.brand)]))
      .filter(brand => brand && brand.trim() !== "" && brand.toLowerCase() !== "marka");

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

  // Helper için başlık metni (Header'da göstermek için)
  const getHeaderTitle = () => {
     if (step === 99) return "Yönetim Paneli";
     switch (appMode) {
        case 'alim': return step === 1 ? "Cihaz Alım" : (step === 2 ? "Model Seçimi" : "Ekspertiz");
        case 'servis': return step === 1 ? "Teknik Servis" : (step === 2 ? "Servis Modeli" : "Onarım İşlemi");
        case 'cep_tablet': return "Cep + Tablet Listesi";
        case 'yna_list': return "YNA Listesi";
        case 'dis_kanal': return "Dış Kanal Ürünleri";
        case 'ikinci_el': return "2.El Fiyat Listesi";
        case 'imei_list': return "İmei Listesi";
        default: return "Cnetmobil CMR";
     }
  }

  return (
    // TÜM EKRAN YÜKSEKLİĞİNİ KAPLAYAN ANA CONTAINER
    <div className={`flex h-screen w-full overflow-hidden font-sans selection:bg-blue-100 transition-colors duration-500 ${isDarkAppMode ? 'bg-[#111111] text-white' : appMode === 'servis' ? 'bg-[#FFF8F1] text-orange-950' : 'bg-[#F8FAFC] text-slate-900'}`}>
      <style>{`
        #print-area { display: none !important; }
        @media print {
          aside, header, main, .print\\:hidden { display: none !important; }
          #print-area { display: block !important; visibility: visible !important; position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; background: white !important; color: black !important; margin: 0 !important; padding: 40px !important; }
          #print-area * { visibility: visible !important; }
        }
        .btn-click { transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); cursor: pointer; }
        .btn-click:active { transform: scale(0.96); }
        .btn-disabled { opacity: 0.2; cursor: not-allowed !important; pointer-events: none; filter: grayscale(100%); }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        .dark-scrollbar::-webkit-scrollbar-thumb { background: #334155; }
      `}</style>

      {/* --- SOL MENÜ (SIDEBAR) (Masaüstü için Görünür) --- */}
      <aside className={`hidden md:flex w-[260px] flex-shrink-0 flex-col shadow-2xl z-20 transition-colors print:hidden ${isDarkAppMode ? 'bg-[#151521] border-r border-[#2a2a3d]' : 'bg-[#1e293b]'}`}>
        
        {/* Logo Bölümü */}
        <div onClick={resetAll} className="h-[72px] px-6 flex items-center gap-3 group cursor-pointer border-b border-white/5 shrink-0">
          <div className="bg-blue-600 p-2 rounded-xl group-hover:rotate-12 transition-transform shadow-lg shadow-blue-600/20">
             <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
          </div>
          <div>
             <h1 className="text-lg font-black italic uppercase tracking-tighter text-white leading-tight">
               CNET<span className="text-blue-500">MOBIL</span>
             </h1>
             <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em]">CMR Terminal</p>
          </div>
        </div>

        {/* Menü Linkleri */}
        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto custom-scrollbar dark-scrollbar">
            <button onClick={() => {setAppMode('alim'); setStep(1); resetSelection();}} 
                    className={`w-full flex items-center px-4 py-3.5 rounded-xl text-xs font-black uppercase transition-all duration-300 ${appMode === 'alim' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>
                <span className="mr-3 text-lg">📱</span> CİHAZ ALIM
            </button>
            
            {selectedBranch !== 'VODAFONE KANALI' && (
              <button onClick={() => {setAppMode('servis'); setStep(1); resetSelection();}} 
                      className={`w-full flex items-center px-4 py-3.5 rounded-xl text-xs font-black uppercase transition-all duration-300 ${appMode === 'servis' ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>
                  <span className="mr-3 text-lg">🔧</span> TEKNİK SERVİS
              </button>
            )}

            <button onClick={() => {setAppMode('cep_tablet'); setStep(1); resetSelection();}} 
                    className={`w-full flex items-center px-4 py-3.5 rounded-xl text-xs font-black uppercase transition-all duration-300 ${appMode === 'cep_tablet' ? 'bg-[#3498db] text-white shadow-lg shadow-[#3498db]/20' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>
                <span className="mr-3 text-lg">🗂️</span> CEP+TABLET
            </button>

            <button onClick={() => {setAppMode('yna_list'); setStep(1); resetSelection();}} 
                    className={`w-full flex items-center px-4 py-3.5 rounded-xl text-xs font-black uppercase transition-all duration-300 ${appMode === 'yna_list' ? 'bg-[#9b59b6] text-white shadow-lg shadow-[#9b59b6]/20' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>
                <span className="mr-3 text-lg">📋</span> YNA LİST
            </button>

            <button onClick={() => {setAppMode('dis_kanal'); setStep(1); resetSelection();}} 
                    className={`w-full flex items-center px-4 py-3.5 rounded-xl text-xs font-black uppercase transition-all duration-300 ${appMode === 'dis_kanal' ? 'bg-[#1abc9c] text-white shadow-lg shadow-[#1abc9c]/20' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>
                <span className="mr-3 text-lg">🌐</span> DIŞ KANAL
            </button>

            {selectedBranch !== 'VODAFONE KANALI' && (
              <button onClick={() => {setAppMode('ikinci_el'); setStep(1); resetSelection();}} 
                      className={`w-full flex items-center px-4 py-3.5 rounded-xl text-xs font-black uppercase transition-all duration-300 ${appMode === 'ikinci_el' ? 'bg-[#e67e22] text-white shadow-lg shadow-[#e67e22]/20' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>
                  <span className="mr-3 text-lg">🔄</span> 2.EL LİSTESİ
              </button>
            )}

            {selectedBranch === 'VODAFONE KANALI' && (
              <button onClick={() => {setAppMode('imei_list'); setStep(1); resetSelection();}} 
                      className={`w-full flex items-center px-4 py-3.5 rounded-xl text-xs font-black uppercase transition-all duration-300 ${appMode === 'imei_list' ? 'bg-[#f39c12] text-white shadow-lg shadow-[#f39c12]/20' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>
                  <span className="mr-3 text-lg">🔍</span> İMEİ LİSTESİ
              </button>
            )}
        </nav>

        {/* Profil ve Alt Bilgi */}
        <div className="p-4 border-t border-white/5 shrink-0">
            <button onClick={() => setStep(99)} className="w-full flex items-center px-4 py-3 mb-2 rounded-xl text-[10px] font-black uppercase transition-all text-slate-400 hover:bg-white/5 hover:text-white">
                <span className="mr-3">⚙️</span> YÖNETİCİ PANELİ
            </button>
            <div className="flex items-center justify-between px-4 py-2 bg-black/20 rounded-xl">
               <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Aktif Şube</span>
                  <span className="text-xs font-black text-white">{selectedBranch}</span>
               </div>
               <button onClick={handleLogout} className="text-slate-500 hover:text-red-500 transition-colors p-2" title="Çıkış Yap">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
               </button>
            </div>
        </div>
      </aside>

      {/* --- SAĞ TARAF: ANA İÇERİK ALANI --- */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        
        {/* ÜST BAR (HEADER) */}
        <header className={`h-[72px] px-6 flex items-center justify-between shrink-0 z-10 transition-colors border-b print:hidden ${isDarkAppMode ? 'bg-[#1a1a2e] border-[#2a2a3d]' : 'bg-white border-slate-200'}`}>
           
           {/* Mobil İçin Menü Toggle & Logo (Masaüstünde Gizli) */}
           <div className="md:hidden flex items-center gap-2">
              <div className={`${appMode === 'servis' ? 'bg-orange-600' : isDarkAppMode ? 'bg-[#3498db]' : 'bg-blue-600'} p-1.5 rounded-lg`}>
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
              </div>
              <h1 className={`text-lg font-black italic uppercase tracking-tighter ${isDarkAppMode ? 'text-white' : 'text-slate-900'}`}>
                CNETMOBIL
              </h1>
           </div>

           {/* Breadcrumb / Başlık (Masaüstü) */}
           <div className="hidden md:flex items-center text-xs font-bold uppercase tracking-widest text-slate-400">
              Ana Sayfa <span className="mx-2">/</span> 
              <span className={appMode === 'servis' ? 'text-orange-500' : 'text-blue-500'}>{getHeaderTitle()}</span>
           </div>

           {/* Orta Arama Barı (Masaüstü) */}
           {step === 1 && (appMode === 'alim' || appMode === 'servis') && (
             <div className="hidden lg:flex flex-1 max-w-md mx-8 relative">
               <svg className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
               <input 
                  type="text" 
                  disabled
                  placeholder="Cihaz veya Seri No Ara (Çok Yakında)" 
                  className={`w-full py-2.5 pl-10 pr-4 rounded-xl text-xs font-bold outline-none border transition-all opacity-50 cursor-not-allowed ${isDarkAppMode ? 'bg-[#2a2a3d] border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`} 
                />
             </div>
           )}

           {/* Sağ Taraf Aksiyonlar */}
           <div className="flex items-center gap-3">
              <button 
                onClick={() => setIsInstallmentModalOpen(true)} 
                className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl transition-colors btn-click ${appMode === 'servis' ? 'bg-orange-100 text-orange-700 hover:bg-orange-200' : isDarkAppMode ? 'bg-[#2ecc71] hover:bg-green-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
              >
                <span className="font-black text-lg leading-none">₺</span>
                <span className="text-[10px] font-black uppercase tracking-widest hidden sm:block">TAKSİT</span>
              </button>

              {/* Sadece Yönetici Şube Değiştirebilir */}
              {isMasterAccess ? (
                <div className="relative hidden sm:block">
                  <select value={selectedBranch} onChange={(e) => setSelectedBranch(e.target.value)} className={`appearance-none px-4 py-2.5 pr-8 rounded-xl text-[10px] font-black outline-none border transition-colors cursor-pointer uppercase ${appMode === 'servis' ? 'bg-orange-50 text-orange-700 border-orange-200' : isDarkAppMode ? 'bg-[#2a2a3d] text-[#3498db] border-[#4472c4]' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                    {branches.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
                  </select>
                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-50">
                     <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7" strokeWidth={3} /></svg>
                  </div>
                </div>
              ) : (
                <div className={`hidden sm:flex px-4 py-2.5 rounded-xl text-[10px] font-black uppercase border items-center gap-2 ${appMode === 'servis' ? 'bg-orange-50 text-orange-700 border-orange-100' : isDarkAppMode ? 'bg-[#2a2a3d] text-[#3498db] border-[#4472c4]' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                   <span className={`w-2 h-2 rounded-full animate-pulse ${appMode === 'servis' ? 'bg-orange-600' : isDarkAppMode ? 'bg-[#2ecc71]' : 'bg-blue-600'}`}></span>
                   {selectedBranch}
                </div>
              )}
           </div>
        </header>

        {/* MOBİL ALT NAVİGASYON (Sadece Mobilde Görünür) */}
        {step < 99 && (
          <div className={`md:hidden flex overflow-x-auto whitespace-nowrap p-3 gap-2 border-b print:hidden custom-scrollbar ${isDarkAppMode ? 'bg-[#151521] border-[#2a2a3d]' : 'bg-slate-50 border-slate-200'}`}>
              <button onClick={() => {setAppMode('alim'); setStep(1); resetSelection();}} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${appMode === 'alim' ? 'bg-blue-600 text-white' : isDarkAppMode ? 'bg-[#2a2a3d] text-slate-400' : 'bg-white text-slate-500 border border-slate-200'}`}>CİHAZ ALIM</button>
              {selectedBranch !== 'VODAFONE KANALI' && (
                  <button onClick={() => {setAppMode('servis'); setStep(1); resetSelection();}} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${appMode === 'servis' ? 'bg-orange-600 text-white' : isDarkAppMode ? 'bg-[#2a2a3d] text-slate-400' : 'bg-white text-slate-500 border border-slate-200'}`}>TEKNİK SERVİS</button>
              )}
              <button onClick={() => {setAppMode('cep_tablet'); setStep(1); resetSelection();}} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${appMode === 'cep_tablet' ? 'bg-[#3498db] text-white' : isDarkAppMode ? 'bg-[#2a2a3d] text-slate-400' : 'bg-white text-slate-500 border border-slate-200'}`}>CEP+TABLET</button>
              <button onClick={() => {setAppMode('yna_list'); setStep(1); resetSelection();}} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${appMode === 'yna_list' ? 'bg-[#9b59b6] text-white' : isDarkAppMode ? 'bg-[#2a2a3d] text-slate-400' : 'bg-white text-slate-500 border border-slate-200'}`}>YNA LİST</button>
              <button onClick={() => {setAppMode('dis_kanal'); setStep(1); resetSelection();}} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${appMode === 'dis_kanal' ? 'bg-[#1abc9c] text-white' : isDarkAppMode ? 'bg-[#2a2a3d] text-slate-400' : 'bg-white text-slate-500 border border-slate-200'}`}>DIŞ KANAL</button>
              {selectedBranch !== 'VODAFONE KANALI' && (
                  <button onClick={() => {setAppMode('ikinci_el'); setStep(1); resetSelection();}} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${appMode === 'ikinci_el' ? 'bg-[#e67e22] text-white' : isDarkAppMode ? 'bg-[#2a2a3d] text-slate-400' : 'bg-white text-slate-500 border border-slate-200'}`}>2.EL LİSTESİ</button>
              )}
              {selectedBranch === 'VODAFONE KANALI' && (
                  <button onClick={() => {setAppMode('imei_list'); setStep(1); resetSelection();}} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${appMode === 'imei_list' ? 'bg-[#f39c12] text-white' : isDarkAppMode ? 'bg-[#2a2a3d] text-slate-400' : 'bg-white text-slate-500 border border-slate-200'}`}>İMEİ LİSTESİ</button>
              )}
          </div>
        )}

        {/* --- İÇERİK SCROLL ALANI --- */}
        <main className={`flex-1 overflow-y-auto p-6 md:p-10 ${isDarkAppMode ? 'dark-scrollbar' : 'custom-scrollbar'} print:p-0`}>
          <div className="max-w-[1400px] mx-auto pb-20">
        
        {/* ------------ İMEİ LİSTESİ EKRANI ------------ */}
        {appMode === 'imei_list' && step < 99 ? (
           <div className="bg-[#1e1e2d] p-6 sm:p-10 rounded-[40px] shadow-sm border border-[#2a2a3d] text-white animate-in fade-in duration-500">
             <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 border-b border-slate-700/50 pb-6 gap-4">
                <div>
                  <h2 className="text-3xl font-black italic tracking-tighter text-[#f39c12]">İMEİ LİSTESİ</h2>
                  <p className="text-[10px] text-slate-400 font-bold tracking-widest mt-1 uppercase">Vodafone Kanalı İmei Kayıtları</p>
                </div>
                <div className="bg-[#151521] border border-[#2a2a3d] p-3 rounded-2xl flex items-center w-full md:w-80">
                   <svg className="w-5 h-5 text-slate-500 mr-2 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                   <input type="text" placeholder="İmei veya Cihaz Arama..." className="bg-transparent border-none outline-none text-sm text-white w-full" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                </div>
             </div>
             
             <div className="max-w-5xl mx-auto">
                <div className="bg-[#d35400] px-6 py-4 rounded-t-[24px] flex font-black text-[10px] tracking-widest text-white items-center shadow-lg">
                   <div className="flex-[3]">CİHAZ BİLGİSİ</div>
                   <div className="flex-[2] text-right">İMEİ BİLGİSİ</div>
                </div>
                <div className="bg-[#151521] rounded-b-[24px] overflow-hidden border-x border-b border-[#2a2a3d]">
                   {imeiData.slice(1).filter(r => (r[0] && r[0].toLowerCase().includes(searchQuery.toLowerCase())) || (r[1] && r[1].toLowerCase().includes(searchQuery.toLowerCase()))).map((row, i) => {
                      return (
                      <div key={i} className={`flex px-6 py-4 border-b border-white/5 hover:bg-white/5 transition-colors text-[11px] sm:text-xs font-bold items-center group ${i % 2 === 0 ? 'bg-white/[0.02]' : ''}`}>
                         <div className={`flex-[3] flex items-center text-slate-300 group-hover:text-white transition-colors pr-4`}>
                            {row[0] || '-'}
                         </div>
                         <div className={`flex-[2] text-right font-black text-sm whitespace-nowrap text-[#f39c12]`}>{row[1] || '-'}</div>
                      </div>
                   )})}
                   {imeiData.length <= 1 && (
                     <div className="p-10 text-center text-slate-500 text-xs font-bold uppercase tracking-widest">Henüz veri çekilmedi.</div>
                   )}
                </div>
             </div>
           </div>
        ) :

        /* ------------ 2.EL LİSTESİ EKRANI ------------ */
        appMode === 'ikinci_el' && step < 99 ? (
           <div className="bg-[#1e1e2d] p-6 sm:p-10 rounded-[40px] shadow-sm border border-[#2a2a3d] text-white animate-in fade-in duration-500">
             <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 border-b border-slate-700/50 pb-6 gap-4">
                <div>
                  <h2 className="text-3xl font-black italic tracking-tighter text-[#e67e22]">2.EL FİYAT LİSTESİ</h2>
                  <p className="text-[10px] text-slate-400 font-bold tracking-widest mt-1 uppercase">Güncel İkinci El Cihaz Fiyatları</p>
                </div>
                <div className="bg-[#151521] border border-[#2a2a3d] p-3 rounded-2xl flex items-center w-full md:w-80">
                   <svg className="w-5 h-5 text-slate-500 mr-2 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                   <input type="text" placeholder="Cihaz Arama..." className="bg-transparent border-none outline-none text-sm text-white w-full" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                </div>
             </div>
             
             <div className="max-w-6xl mx-auto">
                <div className="bg-[#d35400] px-6 py-4 rounded-t-[24px] flex font-black text-[10px] tracking-widest text-white items-center shadow-lg">
                   <div className="flex-[3]">CİHAZ BİLGİSİ</div>
                   <div className="flex-1 text-center">ÖZELLİK/DURUM</div>
                   <div className="flex-1 text-center">FİYATI (TL)</div>
                   <div className="flex-[2] text-right">AÇIKLAMA</div>
                </div>
                <div className="bg-[#151521] rounded-b-[24px] overflow-hidden border-x border-b border-[#2a2a3d]">
                   {ikinciElData.slice(1).filter(r => r[0] && r[0].toLowerCase().includes(searchQuery.toLowerCase())).map((row, i) => {
                      const cellName = (row[0] || '').toUpperCase();
                      const isHighlighted = cellName.includes('BOMBA') || cellName.includes('KAMPANYA') || cellName.includes('İNDİRİM') || cellName.includes('FIRSAT');
                      return (
                      <div key={i} className={`flex px-6 py-4 border-b border-white/5 hover:bg-white/5 transition-colors text-[11px] sm:text-xs font-bold items-center group ${isHighlighted ? 'bg-yellow-500/10' : i % 2 === 0 ? 'bg-white/[0.02]' : ''}`}>
                         <div className={`flex-[3] flex items-center ${isHighlighted ? 'text-yellow-400' : 'text-slate-300'} group-hover:text-white transition-colors pr-4`}>
                            {isHighlighted && <span className="w-1.5 h-1.5 bg-yellow-400 rounded-full animate-ping mr-2 shrink-0"></span>}
                            {row[0]}
                         </div>
                         <div className={`flex-1 text-center font-bold text-slate-400 group-hover:text-white`}>{row[1] || '-'}</div>
                         <div className={`flex-1 text-center font-black text-sm whitespace-nowrap ${isHighlighted ? 'text-yellow-400' : 'text-[#e67e22]'}`}>{row[2] || '-'}</div>
                         <div className={`flex-[2] text-right text-slate-500`}>{row[3] || '-'}</div>
                      </div>
                   )})}
                   {ikinciElData.length <= 1 && (
                     <div className="p-10 text-center text-slate-500 text-xs font-bold uppercase tracking-widest">Henüz veri çekilmedi.</div>
                   )}
                </div>
             </div>
           </div>
        ) :

        /* ------------ DIŞ KANAL EKRANI ------------ */
        appMode === 'dis_kanal' && step < 99 ? (
           <div className="bg-[#1e1e2d] p-6 sm:p-10 rounded-[40px] shadow-sm border border-[#2a2a3d] text-white animate-in fade-in duration-500">
             <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 border-b border-slate-700/50 pb-6 gap-4">
                <div>
                  <h2 className="text-3xl font-black italic tracking-tighter text-[#1abc9c]">DIŞ KANAL SATIN ALMA</h2>
                  <p className="text-[10px] text-slate-400 font-bold tracking-widest mt-1 uppercase">Dış Kanal Ürün ve Fiyat Listesi</p>
                </div>
                <div className="bg-[#151521] border border-[#2a2a3d] p-3 rounded-2xl flex items-center w-full md:w-80">
                   <svg className="w-5 h-5 text-slate-500 mr-2 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                   <input type="text" placeholder="Ürün Arama..." className="bg-transparent border-none outline-none text-sm text-white w-full" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                </div>
             </div>
             
             <div className="max-w-5xl mx-auto">
                <div className="bg-[#16a085] px-6 py-4 rounded-t-[24px] flex font-black text-[10px] tracking-widest text-white items-center shadow-lg">
                   <div className="flex-[3]">ÜRÜN / CİHAZ ADI</div>
                   {selectedBranch === 'VODAFONE KANALI' && <div className="flex-1 text-center">FİYATI (TL)</div>}
                   <div className="flex-1 text-right">DURUM / BİLGİ</div>
                </div>
                <div className="bg-[#151521] rounded-b-[24px] overflow-hidden border-x border-b border-[#2a2a3d]">
                   {disKanalData.slice(1).filter(r => r[0] && r[0].toLowerCase().includes(searchQuery.toLowerCase())).map((row, i) => {
                      const cellName = (row[0] || '').toUpperCase();
                      const isHighlighted = cellName.includes('BOMBA') || cellName.includes('KAMPANYA') || cellName.includes('İNDİRİM') || cellName.includes('FIRSAT');
                      return (
                      <div key={i} className={`flex px-6 py-4 border-b border-white/5 hover:bg-white/5 transition-colors text-[11px] sm:text-xs font-bold items-center group ${isHighlighted ? 'bg-yellow-500/10' : i % 2 === 0 ? 'bg-white/[0.02]' : ''}`}>
                         <div className={`flex-[3] flex items-center ${isHighlighted ? 'text-yellow-400' : 'text-slate-300'} group-hover:text-white transition-colors pr-4`}>
                            {isHighlighted && <span className="w-1.5 h-1.5 bg-yellow-400 rounded-full animate-ping mr-2 shrink-0"></span>}
                            {row[0]}
                         </div>
                         {selectedBranch === 'VODAFONE KANALI' && (
                            <div className={`flex-1 text-center font-black text-sm whitespace-nowrap ${isHighlighted ? 'text-yellow-400' : 'text-white'}`}>{row[1] || '-'}</div>
                         )}
                         <div className={`flex-1 text-right text-slate-500`}>{row[2] || '-'}</div>
                      </div>
                   )})}
                   {disKanalData.length <= 1 && (
                     <div className="p-10 text-center text-slate-500 text-xs font-bold uppercase tracking-widest">Henüz veri çekilmedi.</div>
                   )}
                </div>
             </div>
           </div>
        ) :

        /* ------------ CEP + TABLET EKRANI ------------ */
        appMode === 'cep_tablet' && step < 99 ? (
           <div className="bg-[#1e1e2d] p-6 sm:p-10 rounded-[40px] shadow-sm border border-[#2a2a3d] text-white animate-in fade-in duration-500">
             <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 border-b border-slate-700/50 pb-6 gap-4">
                <div>
                  <h2 className="text-3xl font-black italic tracking-tighter text-[#3498db]">GÜNCEL FİYATLAR</h2>
                  <p className="text-[10px] text-slate-400 font-bold tracking-widest mt-1 uppercase">Cep + Tablet + IOT Saat Fiyat Listesi</p>
                </div>
                <div className="bg-[#151521] border border-[#2a2a3d] p-3 rounded-2xl flex items-center w-full md:w-80">
                   <svg className="w-5 h-5 text-slate-500 mr-2 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                   <input type="text" placeholder="Model Hızlı Arama..." className="bg-transparent border-none outline-none text-sm text-white w-full" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                </div>
             </div>
             
             <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
               {/* SOL SÜTUN - APPLE */}
               <div>
                  <div className="bg-[#4472c4] px-4 py-3 rounded-t-[20px] flex font-black text-[9px] sm:text-[10px] tracking-widest text-white items-center shadow-lg">
                     <div className="flex-[3]">CEP TELEFONU (APPLE)</div>
                     <div className="flex-1 text-center">KAMPANYA</div>
                     <div className="flex-1 text-center">SATIŞ</div>
                     <div className="flex-1 text-right">RESMİ FİYAT</div>
                  </div>
                  <div className="bg-[#151521] rounded-b-[20px] overflow-hidden border-x border-b border-[#2a2a3d]">
                     {cepTabletData.slice(1).filter(r => r[0] && r[0].toLowerCase().includes(searchQuery.toLowerCase())).map((row, i) => {
                        const cellName = (row[0] || '').toUpperCase();
                        const isHighlighted = cellName.includes('BOMBA') || cellName.includes('KAMPANYA') || cellName.includes('İNDİRİM') || cellName.includes('FIRSAT');
                        return (
                           <div key={i} className={`flex px-4 py-3 border-b border-white/5 hover:bg-white/5 transition-colors text-[11px] sm:text-xs font-bold items-center group ${isHighlighted ? 'bg-yellow-500/10' : i % 2 === 0 ? 'bg-white/[0.02]' : ''}`}>
                              <div className={`flex-[3] flex items-center ${isHighlighted ? 'text-yellow-400' : 'text-slate-300'} group-hover:text-white transition-colors pr-2`}>
                                {isHighlighted && <span className="w-1.5 h-1.5 bg-yellow-400 rounded-full animate-ping mr-2 shrink-0"></span>}
                                {row[0]}
                              </div>
                              <div className={`flex-1 text-center font-black ${isHighlighted ? 'text-yellow-400 text-sm' : 'text-[#ff7675]'}`}>{row[1] || '-'}</div>
                              <div className="flex-1 text-center text-[#dfe6e9]">{row[2] || '-'}</div>
                              <div className="flex-1 text-right text-slate-500">{row[3] || '-'}</div>
                           </div>
                        )
                     })}
                     {cepTabletData.length === 0 && (
                       <div className="p-10 text-center text-slate-500 text-xs font-bold uppercase tracking-widest">Henüz veri çekilmedi.</div>
                     )}
                  </div>
               </div>
               
               {/* SAĞ SÜTUN - ANDROID */}
               <div>
                  <div className="bg-[#2ecc71] px-4 py-3 rounded-t-[20px] flex font-black text-[9px] sm:text-[10px] tracking-widest text-white items-center shadow-lg">
                     <div className="flex-[3]">MODEL (ANDROID / DİĞER)</div>
                     <div className="flex-1 text-center">KAMPANYA</div>
                     <div className="flex-1 text-center">SATIŞ</div>
                     <div className="flex-1 text-right">RESMİ FİYAT</div>
                  </div>
                  <div className="bg-[#151521] rounded-b-[20px] overflow-hidden border-x border-b border-[#2a2a3d]">
                     {cepTabletData.slice(1).filter(r => r[5] && r[5].toLowerCase().includes(searchQuery.toLowerCase())).map((row, i) => {
                        const cellName = (row[5] || '').toUpperCase();
                        const isHighlighted = cellName.includes('BOMBA') || cellName.includes('KAMPANYA') || cellName.includes('İNDİRİM') || cellName.includes('FIRSAT');
                        return (
                           <div key={i} className={`flex px-4 py-3 border-b border-white/5 hover:bg-white/5 transition-colors text-[11px] sm:text-xs font-bold items-center group ${isHighlighted ? 'bg-yellow-500/10' : i % 2 === 0 ? 'bg-white/[0.02]' : ''}`}>
                              <div className={`flex-[3] flex items-center ${isHighlighted ? 'text-yellow-400' : 'text-slate-300'} group-hover:text-white transition-colors pr-2`}>
                                {isHighlighted && <span className="w-1.5 h-1.5 bg-yellow-400 rounded-full animate-ping mr-2 shrink-0"></span>}
                                {row[5]}
                              </div>
                              <div className={`flex-1 text-center font-black ${isHighlighted ? 'text-yellow-400 text-sm' : 'text-[#ff7675]'}`}>{row[6] || '-'}</div>
                              <div className="flex-1 text-center text-[#dfe6e9]">{row[7] || '-'}</div>
                              <div className="flex-1 text-right text-slate-500">{row[8] || '-'}</div>
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
        ) : 
        
        /* ------------ YNA LİST EKRANI ------------ */
        appMode === 'yna_list' && step < 99 ? (
           <div className="bg-[#1e1e2d] p-6 sm:p-10 rounded-[40px] shadow-sm border border-[#2a2a3d] text-white animate-in fade-in duration-500">
             <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 border-b border-slate-700/50 pb-6 gap-4">
                <div>
                  <h2 className="text-3xl font-black italic tracking-tighter text-[#9b59b6]">YENİ NESİL AKSESUAR</h2>
                  <p className="text-[10px] text-slate-400 font-bold tracking-widest mt-1 uppercase">Watch, Kulaklık ve Diğer Aksesuarlar (YNA List)</p>
                </div>
                <div className="bg-[#151521] border border-[#2a2a3d] p-3 rounded-2xl flex items-center w-full md:w-80">
                   <svg className="w-5 h-5 text-slate-500 mr-2 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                   <input type="text" placeholder="Aksesuar Arama..." className="bg-transparent border-none outline-none text-sm text-white w-full" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                </div>
             </div>
             
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
               {/* SOL SÜTUN YNA */}
               <div>
                  <div className="bg-[#8e44ad] px-6 py-4 rounded-t-[24px] flex font-black text-[10px] tracking-widest text-white items-center shadow-lg">
                     <div className="flex-[3]">ÜRÜN ADI</div>
                     <div className="flex-1 text-right">FİYATI (TL)</div>
                  </div>
                  <div className="bg-[#151521] rounded-b-[24px] overflow-hidden border-x border-b border-[#2a2a3d]">
                     {ynaData.slice(1).filter(r => r[0] && r[0].toLowerCase().includes(searchQuery.toLowerCase())).map((row, i) => {
                        const cellName = (row[0] || '').toUpperCase();
                        const isHighlighted = cellName.includes('BOMBA') || cellName.includes('KAMPANYA') || cellName.includes('İNDİRİM') || cellName.includes('FIRSAT');
                        return (
                        <div key={i} className={`flex px-6 py-3 border-b border-white/5 hover:bg-white/5 transition-colors text-[11px] sm:text-xs font-bold items-center group ${isHighlighted ? 'bg-yellow-500/10' : i % 2 === 0 ? 'bg-white/[0.02]' : ''}`}>
                           <div className={`flex-[3] flex items-center ${isHighlighted ? 'text-yellow-400' : 'text-slate-300'} group-hover:text-white transition-colors pr-4`}>
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
               
               {/* SAĞ SÜTUN YNA */}
               <div>
                  <div className="bg-[#8e44ad] px-6 py-4 rounded-t-[24px] flex font-black text-[10px] tracking-widest text-white items-center shadow-lg">
                     <div className="flex-[3]">ÜRÜN ADI</div>
                     <div className="flex-1 text-right">FİYATI (TL)</div>
                  </div>
                  <div className="bg-[#151521] rounded-b-[24px] overflow-hidden border-x border-b border-[#2a2a3d]">
                     {ynaData.slice(1).filter(r => r[3] && r[3].toLowerCase().includes(searchQuery.toLowerCase())).map((row, i) => {
                        const cellName = (row[3] || '').toUpperCase();
                        const isHighlighted = cellName.includes('BOMBA') || cellName.includes('KAMPANYA') || cellName.includes('İNDİRİM') || cellName.includes('FIRSAT');
                        return (
                        <div key={i} className={`flex px-6 py-3 border-b border-white/5 hover:bg-white/5 transition-colors text-[11px] sm:text-xs font-bold items-center group ${isHighlighted ? 'bg-yellow-500/10' : i % 2 === 0 ? 'bg-white/[0.02]' : ''}`}>
                           <div className={`flex-[3] flex items-center ${isHighlighted ? 'text-yellow-400' : 'text-slate-300'} group-hover:text-white transition-colors pr-4`}>
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
        ) :
        
        /* ---------------- MEVCUT ALIM VE SERVİS VE YÖNETİCİ GÖRÜNÜMLERİ ---------------- */
        step === 99 ? (
           <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 text-slate-900">
             {!isAdmin ? (
               <div className="max-w-md mx-auto bg-white p-12 rounded-[40px] shadow-sm text-center border border-slate-200 mt-10">
                 <div className="w-16 h-16 bg-slate-100 rounded-3xl flex items-center justify-center mx-auto mb-6">
                    <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 00-2 2v6a2 2 0 00-2 2zM9 11V7a3 3 0 016 0v4" /></svg>
                 </div>
                 <h2 className="text-xl font-black italic mb-8 uppercase tracking-widest text-slate-900">Admin Girişi</h2>
                 <input type="password" placeholder="••••••••" className="w-full p-5 bg-slate-50 rounded-2xl mb-4 text-center font-black outline-none border border-slate-200 focus:border-blue-500 transition-all text-slate-900" onChange={(e) => setAdminPass(e.target.value)} />
                 <button onClick={() => adminPass === 'cnet1905.*' ? setIsAdmin(true) : alert("Hatalı!")} className="bg-slate-900 text-white px-10 py-5 rounded-2xl font-black uppercase w-full btn-click shadow-xl shadow-slate-200">SİSTEME GİRİŞ YAP</button>
               </div>
             ) : (
               <div className="space-y-10">
                 
                 {/* TEKNİK SERVİS FİYAT YÖNETİMİ */}
                 <div className="bg-gradient-to-br from-orange-50 to-red-50 p-10 rounded-[32px] shadow-sm border border-orange-100 text-slate-900">
                    <h2 className="text-xl font-black italic text-orange-800 mb-2 uppercase tracking-tighter flex items-center gap-2">
                       <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                       TEKNİK SERVİS FİYAT YÖNETİMİ
                    </h2>
                    <p className="text-[10px] font-bold text-orange-600/60 uppercase tracking-widest mb-8">Buradaki işlemler doğrudan Google Sheets veritabanına kaydedilir!</p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      <div className="lg:col-span-1">
                        <label className="text-[10px] font-black text-orange-900 uppercase tracking-widest ml-2">Cihaz Modeli</label>
                        <select value={servisForm.model} onChange={(e) => {
                             const selModel = e.target.value;
                             const existing = servisFiyatlari[selModel] || {ekran: '', ekranOrj: '', ekranOled: '', ekranCipli: '', batarya: '', arkaCam: '', kasa: ''};
                             setServisForm({
                                model: selModel, 
                                ekran: existing.ekran||'', 
                                ekranOrj: existing.ekranOrj||'', 
                                ekranOled: existing.ekranOled||'', 
                                ekranCipli: existing.ekranCipli||'', 
                                batarya: existing.batarya||'', 
                                arkaCam: existing.arkaCam||'', 
                                kasa: existing.kasa||''
                             });
                          }} className="w-full mt-2 p-4 bg-white rounded-2xl text-xs font-black border border-orange-200 outline-none uppercase shadow-sm text-slate-800">
                          <option value="">Model Seçiniz</option>
                          {Array.from(new Set(db.map(i => i.name))).sort().map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                      </div>
                      
                      {db.find(i => i.name === servisForm.model)?.brand?.toLowerCase() === 'apple' ? (
                        <>
                           <div>
                             <label className="text-[10px] font-black text-blue-800 uppercase tracking-widest ml-2">Ekran (Orjinal) (TL)</label>
                             <input type="number" placeholder="Örn: 3500" value={servisForm.ekranOrj} onChange={e => setServisForm({...servisForm, ekranOrj: e.target.value})} className="w-full mt-2 p-4 bg-blue-50/50 rounded-2xl text-xs font-black border border-blue-200 outline-none shadow-sm text-blue-900" />
                           </div>
                           <div>
                             <label className="text-[10px] font-black text-green-800 uppercase tracking-widest ml-2">Ekran (OLED) (TL)</label>
                             <input type="number" placeholder="Örn: 2200" value={servisForm.ekranOled} onChange={e => setServisForm({...servisForm, ekranOled: e.target.value})} className="w-full mt-2 p-4 bg-green-50/50 rounded-2xl text-xs font-black border border-green-200 outline-none shadow-sm text-green-900" />
                           </div>
                           <div>
                             <label className="text-[10px] font-black text-red-800 uppercase tracking-widest ml-2">Ekran (Çipli) (TL)</label>
                             <input type="number" placeholder="Örn: 1500" value={servisForm.ekranCipli} onChange={e => setServisForm({...servisForm, ekranCipli: e.target.value})} className="w-full mt-2 p-4 bg-red-50/50 rounded-2xl text-xs font-black border border-red-200 outline-none shadow-sm text-red-900" />
                           </div>
                        </>
                      ) : (
                        <>
                           <div>
                             <label className="text-[10px] font-black text-blue-800 uppercase tracking-widest ml-2">Ekran (Orjinal) (TL)</label>
                             <input type="number" placeholder="Örn: 2500" value={servisForm.ekranOrj} onChange={e => setServisForm({...servisForm, ekranOrj: e.target.value})} className="w-full mt-2 p-4 bg-blue-50/50 rounded-2xl text-xs font-black border border-blue-200 outline-none shadow-sm text-blue-900" />
                           </div>
                           <div>
                             <label className="text-[10px] font-black text-green-800 uppercase tracking-widest ml-2">Ekran (OLED) (TL)</label>
                             <input type="number" placeholder="Örn: 1500" value={servisForm.ekranOled} onChange={e => setServisForm({...servisForm, ekranOled: e.target.value})} className="w-full mt-2 p-4 bg-green-50/50 rounded-2xl text-xs font-black border border-green-200 outline-none shadow-sm text-green-900" />
                           </div>
                        </>
                      )}

                      <div>
                        <label className="text-[10px] font-black text-orange-900 uppercase tracking-widest ml-2">Batarya Fiyatı (TL)</label>
                        <input type="number" placeholder="Örn: 1200" value={servisForm.batarya} onChange={e => setServisForm({...servisForm, batarya: e.target.value})} className="w-full mt-2 p-4 bg-white rounded-2xl text-xs font-black border border-orange-200 outline-none shadow-sm text-slate-800" />
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-orange-900 uppercase tracking-widest ml-2">Arka Cam (TL)</label>
                        <input type="number" placeholder="Örn: 1800" value={servisForm.arkaCam} onChange={e => setServisForm({...servisForm, arkaCam: e.target.value})} className="w-full mt-2 p-4 bg-white rounded-2xl text-xs font-black border border-orange-200 outline-none shadow-sm text-slate-800" />
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-orange-900 uppercase tracking-widest ml-2">Kasa (TL)</label>
                        <input type="number" placeholder="Örn: 2500" value={servisForm.kasa} onChange={e => setServisForm({...servisForm, kasa: e.target.value})} className="w-full mt-2 p-4 bg-white rounded-2xl text-xs font-black border border-orange-200 outline-none shadow-sm text-slate-800" />
                      </div>
                    </div>
                    <button onClick={saveServisFiyat} className="w-full py-5 bg-orange-600 hover:bg-orange-700 text-white rounded-2xl font-black uppercase text-xs btn-click shadow-lg mt-6 transition-colors">FİYATLARI KAYDET</button>
                 </div>

                 <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 text-slate-900">
                    <div className="bg-white p-10 rounded-[32px] shadow-sm border border-slate-200">
                      <h2 className="text-xs font-black italic text-slate-800 mb-6 uppercase tracking-widest flex items-center gap-2">
                        <span className="w-2 h-2 bg-slate-800 rounded-full"></span>
                        Alım - Fiyat Kesinti Oranları (%)
                      </h2>
                      <div className="space-y-4 max-h-[400px] overflow-y-auto pr-4 custom-scrollbar">
                        {Object.keys(config).map(key => (
                          <div key={key} className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl border border-slate-100 gap-4">
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

                    <div className="bg-white p-10 rounded-[32px] shadow-sm border border-slate-200">
                      <h2 className="text-xs font-black italic text-blue-600 mb-6 uppercase tracking-widest flex items-center gap-2">
                         <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
                         Sisteme Yeni Cihaz Tanımla
                      </h2>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-3">
                          <input placeholder="Marka (Örn: Apple)" className="w-full p-4 bg-slate-50 rounded-2xl text-xs font-black border border-slate-200 outline-none" value={newDevice.brand} onChange={(e)=>setNewDevice({...newDevice, brand: e.target.value})} />
                          <input placeholder="Model (Örn: iPhone 15 Pro)" className="w-full p-4 bg-slate-50 rounded-2xl text-xs font-black border border-slate-200 outline-none" value={newDevice.name} onChange={(e)=>setNewDevice({...newDevice, name: e.target.value})} />
                          <input placeholder="Hafıza (Örn: 128 GB)" className="w-full p-4 bg-slate-50 rounded-2xl text-xs font-black border border-slate-200 outline-none" value={newDevice.cap} onChange={(e)=>setNewDevice({...newDevice, cap: e.target.value})} />
                        </div>
                        <div className="space-y-3">
                          <input placeholder="Max Alış Fiyatı (TL)" className="w-full p-4 bg-slate-50 rounded-2xl text-xs font-black border border-slate-200 outline-none" value={newDevice.base} onChange={(e)=>setNewDevice({...newDevice, base: e.target.value})} />
                          <input placeholder="Minimum Alış Fiyatı (TL)" className="w-full p-4 bg-slate-50 rounded-2xl text-xs font-black border border-slate-200 outline-none" value={newDevice.minPrice} onChange={(e)=>setNewDevice({...newDevice, minPrice: e.target.value})} />
                          <input placeholder="Cihaz Görsel Linki (URL)" className="w-full p-4 bg-slate-50 rounded-2xl text-xs font-black border border-slate-200 outline-none" value={newDevice.img} onChange={(e)=>setNewDevice({...newDevice, img: e.target.value})} />
                        </div>
                      </div>
                      <button onClick={adminAddDevice} className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black uppercase text-xs btn-click shadow-lg mt-6">CİHAZI VERİTABANINA EKLE</button>
                    </div>
                 </div>

                 <div className="bg-white p-10 rounded-[32px] shadow-sm border border-slate-200 text-slate-900">
                    <h2 className="text-xl font-black italic uppercase tracking-tighter mb-8 border-b-2 border-slate-100 pb-4">
                       📊 ŞUBE İŞLEM İSTATİSTİKLERİ
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                      {Object.entries(getBranchStats()).map(([branchName, stat]: any) => (
                         <div key={branchName} className="bg-slate-50 p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                           <h3 className="font-black text-slate-800 uppercase tracking-widest text-sm mb-5 text-center bg-white py-2 rounded-xl border border-slate-100">{branchName}</h3>
                           
                           <div className="space-y-3">
                             <div className="flex justify-between items-center text-xs">
                               <span className="text-slate-500 font-bold">ALINDI</span>
                               <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-lg font-black">{stat.alindi}</span>
                             </div>
                             <div className="flex justify-between items-center text-xs">
                               <span className="text-slate-500 font-bold">ALINMADI</span>
                               <span className="bg-rose-100 text-rose-700 px-3 py-1 rounded-lg font-black">{stat.alinmadi}</span>
                             </div>
                             <div className="flex justify-between items-center text-xs">
                               <span className="text-slate-500 font-bold">BEKLEYEN/DİĞER</span>
                               <span className="bg-slate-200 text-slate-700 px-3 py-1 rounded-lg font-black">{stat.diger}</span>
                             </div>
                           </div>
                           
                           <div className="mt-5 pt-4 border-t border-slate-200 flex justify-between items-center">
                               <span className="text-[10px] font-black text-slate-400 uppercase">Toplam İşlem</span>
                               <span className="text-blue-600 font-black text-xl">{stat.total}</span>
                           </div>
                         </div>
                      ))}
                    </div>
                 </div>

                 <div className="bg-white p-10 rounded-[32px] shadow-sm border border-slate-200 text-slate-900">
                   <div className="flex justify-between items-center border-b-2 border-slate-100 pb-4 mb-8">
                      <h2 className="text-xl font-black italic uppercase tracking-tighter">GÜNCEL ALIM KAYITLARI</h2>
                      <button onClick={deleteAllAlimlar} className="bg-red-50 text-red-600 px-6 py-2 rounded-xl text-[10px] font-black hover:bg-red-600 hover:text-white transition-all uppercase border border-red-100">Tüm Geçmişi Temizle</button>
                   </div>
                   <div className="space-y-4 max-h-[600px] overflow-y-auto pr-4 custom-scrollbar">
                      {[...alimlar].reverse().map((item, i) => (
                        <div key={i} className="bg-slate-50 p-6 rounded-2xl border border-slate-200 flex justify-between items-center text-xs hover:bg-white hover:shadow-md transition-all">
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
                 
                 <div className="pb-10">
                    <button onClick={() => {setStep(1); setIsAdmin(false); if(isMasterAccess) handleLogout();}} className="w-full py-6 bg-slate-900 text-white rounded-[32px] font-black uppercase text-sm btn-click shadow-2xl">YÖNETİCİ MODUNDAN ÇIK VE OTURUMU KAPAT</button>
                 </div>
               </div>
             )}
           </div>
        ) : step === 1 ? (
           <div className="space-y-10 text-slate-900 pt-6">
             <div className="space-y-2 mb-10 animate-in fade-in slide-in-from-top-4 duration-700">
                <h2 className="text-3xl md:text-5xl font-black italic tracking-tighter uppercase">
                  {appMode === 'alim' ? (
                    <span className="text-slate-800">CİHAZ <span className="text-blue-600">ALIM SİSTEMİ</span></span>
                  ) : (
                    <span className="text-orange-900">TEKNİK <span className="text-orange-600">SERVİS MERKEZİ</span></span>
                  )}
                </h2>
                <p className="font-bold text-slate-500 text-sm">İşlem yapmak istediğiniz markayı seçin.</p>
             </div>
             
             {/* MARKA KARTLARI (GÖRSELDEKİ BİREBİR YAPI) */}
             <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 animate-in fade-in zoom-in duration-700 delay-200">
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
                        className={`bg-white rounded-3xl p-8 flex flex-col items-center justify-center text-center h-64 group transition-all duration-300 border ${hasModels ? 'border-slate-200 shadow-sm hover:shadow-lg hover:-translate-y-1 cursor-pointer' : 'border-slate-100 bg-slate-50/50 opacity-60 cursor-not-allowed'}`}>
                     
                     <div className="h-16 w-full flex items-center justify-center mb-6">
                       <img src={finalLogo} className={`max-h-full max-w-[120px] object-contain ${hasModels ? 'opacity-80 group-hover:opacity-100 transition-opacity' : 'grayscale opacity-50'}`} alt={brand} />
                     </div>
                     
                     <h3 className="font-black text-slate-800 text-lg mb-1">{brand}</h3>
                     <span className="text-xs text-slate-500 mb-4">{hasModels ? (appMode === 'servis' ? 'Servis İşlemi' : `${brand} Cihaz`) : 'Çok Yakında'}</span>
                     
                     <button className={`px-8 py-2 rounded-full font-black text-[11px] uppercase transition-all ${hasModels ? 'bg-slate-100 text-slate-700 group-hover:bg-slate-200' : 'bg-slate-200/50 text-slate-400'}`}>
                        GİR
                     </button>
                   </div>
                 );
               })}
             </div>
           </div>
        ) : step === 2 ? (
           <div className="animate-in slide-in-from-right-8 duration-500 text-slate-900 pt-4">
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
                   className={`w-full p-5 pl-14 bg-white rounded-3xl text-sm font-black border outline-none shadow-sm transition-all placeholder-opacity-50 ${appMode === 'servis' ? 'border-orange-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-100 text-orange-950 placeholder-orange-300' : 'border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-50 text-slate-700 placeholder-slate-400'}`}
                 />
                 <svg className={`w-6 h-6 absolute left-5 top-1/2 -translate-y-1/2 ${appMode === 'servis' ? 'text-orange-300' : 'text-slate-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
               </div>
             </div>

             <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
               {Array.from(new Set(db.filter(i => i.brand === selectedBrand).map(i => i.name)))
                 .filter(name => name.toLowerCase().includes(searchQuery.toLowerCase()))
                 .map(name => (
                   <div key={name} onClick={() => {setSelectedModelName(name); setStep(3); resetSelection();}} className={`bg-white p-8 rounded-[32px] shadow-sm cursor-pointer border-2 border-transparent transition-all text-center btn-click group flex flex-col items-center justify-between min-h-[220px] ${appMode === 'servis' ? 'hover:shadow-xl hover:shadow-orange-100 hover:border-orange-400/50' : 'hover:shadow-xl hover:border-blue-500/50'}`}>
                     <div className="h-32 flex items-center justify-center mb-4 transform group-hover:scale-110 transition-transform duration-500">
                        <img src={db.find(i => i.name === name)?.img} className="max-h-full object-contain drop-shadow-xl" />
                     </div>
                     
                     <div className="w-full">
                       <p className={`font-black text-[12px] uppercase tracking-tighter leading-tight ${appMode === 'servis' ? 'text-orange-950' : 'text-slate-800'}`}>{name}</p>
                       <p className={`text-[9px] font-bold mt-2 uppercase tracking-widest ${appMode === 'servis' ? 'text-orange-400' : 'text-slate-400'}`}>
                          {appMode === 'servis' ? 'SERVİS SEÇENEKLERİ' : 'SEÇ'}
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
          <div className="flex flex-col xl:flex-row gap-10 animate-in fade-in duration-700 text-slate-900 pt-4">
            {/* SOL KISIM */}
            <div className="flex-1 space-y-6">
              <button onClick={() => {setStep(2); resetSelection();}} className={`bg-white shadow-sm border px-6 py-3 rounded-2xl text-[10px] font-black uppercase transition-all btn-click flex items-center gap-2 ${appMode === 'servis' ? 'border-orange-200 text-orange-500 hover:text-orange-700' : 'border-slate-200 text-slate-500 hover:text-blue-600'}`}>
                 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg>
                 Modellere Dön
              </button>

              {appMode === 'servis' ? (
                /* ---------------- TEKNİK SERVİS EKRANI ---------------- */
                <div className="bg-white p-8 md:p-10 rounded-[40px] shadow-sm border border-orange-200 relative overflow-hidden">
                   <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none">
                      <svg className="w-40 h-40 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                   </div>
                   
                   <div className="flex flex-col md:flex-row items-center gap-8 mb-10">
                      <div className="w-32 h-32 shrink-0 bg-orange-50 rounded-3xl p-4 flex items-center justify-center border border-orange-100">
                         <img src={db.find(i => i.name === selectedModelName)?.img} className="max-h-full object-contain drop-shadow-xl" alt="Device" />
                      </div>
                      <div>
                         <span className="bg-orange-100 text-orange-700 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest">{selectedBrand}</span>
                         <h2 className="text-3xl font-black italic mt-3 uppercase tracking-tighter text-orange-950">{selectedModelName}</h2>
                         <p className="text-orange-500/80 font-bold uppercase tracking-widest text-[10px] mt-2">Teknik Servis Onarım Fiyatları</p>
                      </div>
                   </div>

                   <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      {/* EKRAN KARTI */}
                      <div className="bg-orange-50 p-6 rounded-[24px] border border-orange-100 text-center hover:bg-orange-100/50 transition-all group flex flex-col justify-between">
                         <div>
                            <div className="text-3xl mb-4 grayscale group-hover:grayscale-0 transition-all">📱</div>
                            <p className="text-[11px] font-black text-orange-800/60 uppercase tracking-widest mb-2">Ekran Değişimi</p>
                         </div>
                         <div className="flex flex-col gap-2 mt-4 text-left bg-white/60 p-4 rounded-xl border border-orange-200/50">
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

                      {/* BATARYA KARTI */}
                      <div className="bg-orange-50 p-6 rounded-[24px] border border-orange-100 text-center hover:bg-orange-100/50 transition-all group flex flex-col justify-between">
                         <div>
                            <div className="text-3xl mb-4 grayscale group-hover:grayscale-0 transition-all">🔋</div>
                            <p className="text-[11px] font-black text-orange-800/60 uppercase tracking-widest mb-2">Batarya</p>
                         </div>
                         <div className="text-xl font-black italic tracking-tighter text-orange-900 mt-4">
                            {servisFiyatlari[selectedModelName]?.batarya ? `${Number(servisFiyatlari[selectedModelName]?.batarya).toLocaleString()} TL` : 'Fiyat Yok'}
                         </div>
                      </div>

                      {/* ARKA CAM KARTI */}
                      <div className="bg-orange-50 p-6 rounded-[24px] border border-orange-100 text-center hover:bg-orange-100/50 transition-all group flex flex-col justify-between">
                         <div>
                            <div className="text-3xl mb-4 grayscale group-hover:grayscale-0 transition-all">💠</div>
                            <p className="text-[11px] font-black text-orange-800/60 uppercase tracking-widest mb-2">Arka Cam</p>
                         </div>
                         <div className="text-xl font-black italic tracking-tighter text-orange-900 mt-4">
                            {servisFiyatlari[selectedModelName]?.arkaCam ? `${Number(servisFiyatlari[selectedModelName]?.arkaCam).toLocaleString()} TL` : 'Fiyat Yok'}
                         </div>
                      </div>

                      {/* KASA KARTI */}
                      <div className="bg-orange-50 p-6 rounded-[24px] border border-orange-100 text-center hover:bg-orange-100/50 transition-all group flex flex-col justify-between">
                         <div>
                            <div className="text-3xl mb-4 grayscale group-hover:grayscale-0 transition-all">🛠</div>
                            <p className="text-[11px] font-black text-orange-800/60 uppercase tracking-widest mb-2">Kasa</p>
                         </div>
                         <div className="text-xl font-black italic tracking-tighter text-orange-900 mt-4">
                            {servisFiyatlari[selectedModelName]?.kasa ? `${Number(servisFiyatlari[selectedModelName]?.kasa).toLocaleString()} TL` : 'Fiyat Yok'}
                         </div>
                      </div>
                   </div>
                </div>
              ) : (
                /* ---------------- EKSPERTİZ EKRANI (CİHAZ ALIM) ---------------- */
                <>
                  <div className="bg-white p-8 md:p-10 rounded-[40px] shadow-sm border border-slate-200 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none group-hover:scale-150 transition-transform duration-1000">
                       <svg className="w-40 h-40 text-blue-600" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L1 21h22L12 2zm0 3.45L19.53 19H4.47L12 5.45zM11 16h2v2h-2v-2zm0-7h2v5h-2V9z"/></svg>
                    </div>
                    
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                      <div>
                        <h3 className="text-xl font-black italic tracking-tighter text-slate-900 uppercase">EKSPERTİZ & GÜVENLİK</h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Lütfen tüm bilgileri eksiksiz doldurun</p>
                      </div>
                      {customer.imei.length === 15 && (
                        <button type="button" onClick={() => window.open(`https://www.turkiye.gov.tr/imei-sorgulama`, '_blank')} className="bg-slate-900 text-white px-6 py-3 rounded-2xl text-[10px] font-black animate-pulse hover:bg-slate-800 transition-all flex items-center gap-2">
                          BTK IMEI SORGULA
                        </button>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-4">
                        <div className="space-y-1">
                          <label className="text-[9px] font-black text-slate-500 ml-4 uppercase">Müşteri Adı Soyadı</label>
                          <input placeholder="Ad Soyad" className="w-full p-4 bg-slate-50 rounded-2xl text-xs outline-none border border-slate-200 font-black uppercase focus:bg-white focus:border-blue-500 transition-all" value={customer.name} onChange={(e)=>setCustomer({...customer, name: e.target.value})} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-black text-slate-500 ml-4 uppercase">İletişim Numarası</label>
                          <input placeholder="05XX XXX XX XX" className="w-full p-4 bg-slate-50 rounded-2xl text-xs outline-none border border-slate-200 font-black focus:bg-white focus:border-blue-500 transition-all" value={customer.phone} onChange={(e)=>setCustomer({...customer, phone: e.target.value})} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-black text-slate-500 ml-4 uppercase">IMEI Numarası (15 Hane)</label>
                          <input placeholder="IMEI Giriniz" className="w-full p-4 bg-slate-50 rounded-2xl text-xs outline-none border border-slate-200 font-black uppercase focus:bg-white focus:border-blue-500 transition-all" value={customer.imei} maxLength={15} onChange={(e) => setCustomer({...customer, imei: e.target.value.replace(/\D/g, '')})} />
                        </div>
                      </div>

                      <div className="bg-red-50 p-6 rounded-[24px] border border-red-100 space-y-4">
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
                            <input type="checkbox" className="w-4 h-4 accent-red-600 rounded-sm cursor-pointer" />
                            <span className="text-[11px] font-black text-slate-600 group-hover:text-red-700 transition-colors uppercase italic">{item}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-200">
                      <p className="text-[10px] font-black mb-6 text-slate-500 uppercase tracking-widest flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-blue-100 flex items-center justify-center"><span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span></span>
                        Hafıza Kapasitesi
                      </p>
                      <div className="flex flex-wrap gap-3">
                        {db.filter(i => i.name === selectedModelName).map(c => (
                          <button key={c.cap} onClick={() => setSelectedCapacity(c)} className={`px-8 py-4 rounded-xl font-black text-[11px] transition-all btn-click border ${selectedCapacity?.cap === c.cap ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-600/20' : 'bg-white text-slate-600 border-slate-200 hover:border-blue-400'}`}>{c.cap}</button>
                        ))}
                      </div>
                    </div>

                    {selectedModelName === "iPhone 13" && (
                      <div className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-200">
                        <p className="text-[10px] font-black mb-6 text-slate-500 uppercase tracking-widest flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full bg-blue-100 flex items-center justify-center"><span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span></span>
                          Renk Seçimi (Beyaz +%5)
                        </p>
                        <div className="flex flex-wrap gap-3">
                          {['Diğer', 'Beyaz'].map(color => (
                            <button key={color} onClick={() => setSelectedColor(color)} className={`px-8 py-4 rounded-xl font-black text-[11px] transition-all btn-click border ${selectedColor === color ? 'bg-slate-800 text-white border-slate-800 shadow-lg' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'}`}>{color}</button>
                          ))}
                        </div>
                        <p className="text-[9px] text-orange-600 font-bold mt-3">* %5 prim sadece mükemmel durumdaki cihazlar için geçerlidir.</p>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {[
                        { label: "Cihaz Açılıyor mu?", field: "power", opts: ['Evet', 'Hayır'] },
                        { label: "Face ID / Touch ID", field: "faceId", opts: ['Evet', 'Hayır'] },
                        { label: "Ekran Durumu", field: "screen", opts: ['Sağlam', 'Çizikler var', 'Kırık / Orijinal Değil'] },
                        { label: "Kozmetik Durum", field: "cosmetic", opts: ['Mükemmel', 'İyi', 'Kötü'] },
                        { label: "Ahize / Buzzer", field: "speaker", opts: ['Sağlam', 'Cızırtı var', 'Arızalı'] },
                        { label: "Kayıt Durumu", field: "sim", opts: ['Fiziksel SIM (TR)', 'Fiziksel + eSIM (YD)'] },
                        { label: "Garanti Durumu", field: "warranty", opts: ['Üretici Garantili', 'Yenilenmiş Cihaz', 'Garanti Yok'] },
                        { label: "Batarya Sağlığı", field: "battery", opts: ['95-100', '85-95', '0-85', 'Bilinmeyen Parça'] }
                      ].map(q => (
                        <div key={q.field} className="bg-white p-6 rounded-[24px] shadow-sm border border-slate-200 flex flex-col justify-between">
                          <p className="text-[10px] font-black mb-4 text-slate-500 uppercase tracking-widest">{q.label}</p>
                          <div className="flex flex-wrap gap-2">
                            {q.opts.map((opt) => (
                              <button key={opt} onClick={() => setStatus({...status, [q.field]: opt})} className={`py-2 px-4 rounded-lg text-[10px] font-black border transition-all btn-click flex-1 min-w-fit ${status[q.field] === opt ? 'bg-blue-50 text-blue-700 border-blue-600' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}>{opt}</button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* SAĞ KISIM (FİYAT VE BUTONLAR) */}
            <div className="xl:w-80 2xl:w-96 space-y-6 sticky top-6 h-fit">
              
              {appMode === 'servis' ? (
                 /* SERVİS MODU SAĞ MENÜ */
                 <div className="bg-[#1e293b] p-8 rounded-[32px] space-y-4 shadow-xl border border-slate-800">
                    <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-6">
                        <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                    </div>
                    <h3 className="text-lg font-black italic text-white uppercase text-center mb-2">Müşteriye İlet</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center mb-8">Fiyat teklifini direkt WhatsApp üzerinden gönderebilirsiniz.</p>
                    
                    <button onClick={handleServisWhatsApp} className="w-full py-4 rounded-xl font-black uppercase text-[11px] tracking-widest transition-all btn-click flex items-center justify-center gap-2 shadow-lg bg-[#25D366] text-white hover:bg-[#128C7E]">
                        WHATSAPP'TAN GÖNDER
                    </button>
                 </div>
              ) : (
                /* ALIM MODU SAĞ MENÜ */
                <>
                  {isYd ? (
                    <div className="bg-red-600 p-8 rounded-[32px] shadow-xl text-white text-center border-b-[8px] border-red-800 animate-pulse">
                      <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">⚠️</div>
                      <p className="text-xl font-black uppercase italic leading-none tracking-tighter">YURT DIŞI CIHAZ</p>
                      <p className="text-[9px] mt-3 uppercase tracking-[0.2em] font-black opacity-80">YONETICI ONAYI GEREKLIDIR</p>
                    </div>
                  ) : (
                    <div className="space-y-6 animate-in zoom-in-95 duration-500">
                      
                      {/* NAKİT FİYAT KARTI */}
                      <div className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-200 text-center">
                        <p className="text-[10px] font-black text-slate-400 uppercase mb-3 tracking-widest italic">Nakit Alış Teklifi</p>
                        <div className="text-3xl font-black italic tracking-tighter text-slate-900">
                          {selectedCapacity && allSelected ? `${finalCashPrice.toLocaleString()} TL` : '---'}
                        </div>
                        
                        {selectedCapacity && allSelected && !purchaseType && (
                          <div className="mt-4">
                            {!isCustomOfferActive ? (
                              <button onClick={() => setIsCustomOfferActive(true)} className="text-[10px] font-black text-slate-500 hover:text-slate-800 uppercase tracking-widest bg-slate-50 border border-slate-200 px-4 py-2 rounded-lg transition-colors w-full">
                                Fiyatı Revize Et
                              </button>
                            ) : (
                              <div className="flex flex-col items-center gap-2 animate-in fade-in duration-300">
                                <div className="flex items-center gap-2 w-full">
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
                                    placeholder="Tutar" 
                                    className="flex-1 p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-black text-center outline-none focus:border-blue-500"
                                  />
                                  <button onClick={() => {setIsCustomOfferActive(false); setCustomOffer('');}} className="bg-slate-200 text-slate-600 p-2.5 rounded-lg hover:bg-slate-300 transition-colors">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      
                      {/* TAKAS FİYAT KARTI */}
                      <div className="bg-blue-600 p-8 rounded-[32px] shadow-lg text-center text-white relative overflow-hidden">
                        <p className="text-[10px] font-black text-blue-200 uppercase mb-3 tracking-widest italic">Takas Desteği İle</p>
                        <div className="text-3xl font-black italic tracking-tighter">
                          {selectedCapacity && allSelected ? `${finalTradePrice.toLocaleString()} TL` : '---'}
                        </div>
                        
                        {selectedCapacity && allSelected && !purchaseType && (
                          <div className="mt-4 relative z-10">
                            {!isCustomTradeOfferActive ? (
                              <button onClick={() => setIsCustomTradeOfferActive(true)} className="text-[10px] font-black text-white hover:text-blue-100 uppercase tracking-widest bg-blue-700 px-4 py-2 rounded-lg transition-colors w-full border border-blue-500">
                                Fiyatı Revize Et
                              </button>
                            ) : (
                              <div className="flex flex-col items-center gap-2 animate-in fade-in duration-300">
                                <div className="flex items-center gap-2 w-full">
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
                                    placeholder="Tutar" 
                                    className="flex-1 p-2.5 bg-blue-700 border border-blue-500 rounded-lg text-sm font-black text-center outline-none text-white placeholder-blue-300"
                                  />
                                  <button onClick={() => {setIsCustomTradeOfferActive(false); setCustomTradeOffer('');}} className="bg-blue-800 text-white p-2.5 rounded-lg hover:bg-blue-900 transition-colors">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* İŞLEM BUTONLARI */}
                  <div className="bg-slate-50 p-6 rounded-[32px] border border-slate-200 mt-6">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest text-center mb-4">İŞLEMİ TAMAMLA</p>
                    
                    <div className="flex flex-col gap-3">
                        <button 
                            disabled={!canProceed || purchaseType !== null} 
                            onClick={() => { setPurchaseType('NAKİT'); handleFinalProcess('NAKİT ALINDI'); }} 
                            className={`w-full py-3.5 rounded-xl font-black uppercase text-[10px] transition-all 
                            ${!canProceed || (purchaseType && purchaseType !== 'NAKİT') ? 'opacity-40 cursor-not-allowed bg-slate-200 text-slate-400 border border-slate-300' : ''} 
                            ${purchaseType === 'NAKİT' ? 'bg-emerald-500 text-white shadow-lg' : ''} 
                            ${canProceed && !purchaseType ? 'btn-click bg-white border border-slate-300 text-slate-600 hover:border-emerald-500 hover:text-emerald-600' : ''}`}>
                            ✓ NAKİT ALINDI
                        </button>
                        <button 
                            disabled={!canProceed || purchaseType !== null} 
                            onClick={() => { setPurchaseType('TAKAS'); handleFinalProcess('TAKAS ALINDI'); }} 
                            className={`w-full py-3.5 rounded-xl font-black uppercase text-[10px] transition-all 
                            ${!canProceed || (purchaseType && purchaseType !== 'TAKAS') ? 'opacity-40 cursor-not-allowed bg-slate-200 text-slate-400 border border-slate-300' : ''} 
                            ${purchaseType === 'TAKAS' ? 'bg-purple-500 text-white shadow-lg' : ''} 
                            ${canProceed && !purchaseType ? 'btn-click bg-white border border-slate-300 text-slate-600 hover:border-purple-500 hover:text-purple-600' : ''}`}>
                            🔄 TAKAS ALINDI
                        </button>
                        <button 
                            disabled={!canProceed || purchaseType !== null} 
                            onClick={() => { setPurchaseType('ALINMADI'); handleFinalProcess('ALINMADI'); }} 
                            className={`w-full py-3.5 rounded-xl font-black uppercase text-[10px] transition-all 
                            ${!canProceed || (purchaseType && purchaseType !== 'ALINMADI') ? 'opacity-40 cursor-not-allowed bg-slate-200 text-slate-400 border border-slate-300' : ''} 
                            ${purchaseType === 'ALINMADI' ? 'bg-rose-500 text-white shadow-lg' : ''} 
                            ${canProceed && !purchaseType ? 'btn-click bg-white border border-slate-300 text-rose-500 hover:bg-rose-50' : ''}`}>
                            ✕ ALINMADI
                        </button>
                    </div>

                    <div className={`mt-6 pt-6 border-t border-slate-200 space-y-3 transition-all duration-500 ${showDocs ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>
                        <button disabled={!showDocs} onClick={() => handleFinalProcess('print')} className={`w-full py-3.5 rounded-xl font-black uppercase text-[10px] transition-all btn-click flex items-center justify-center gap-2 border ${showDocs ? 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100' : 'bg-slate-100 border-transparent text-slate-400'}`}>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                          YAZDIR {purchaseType && purchaseType !== 'ALINMADI' ? `(${purchaseType})` : ''}
                        </button>
                        <button disabled={!showDocs} onClick={() => handleFinalProcess('whatsapp')} className={`w-full py-3.5 rounded-xl font-black uppercase text-[10px] transition-all btn-click flex items-center justify-center gap-2 ${showDocs ? 'bg-[#25D366] text-white hover:bg-[#128C7E] shadow-sm' : 'bg-slate-200 text-slate-400'}`}>
                          WHATSAPP GÖNDER
                        </button>
                    </div>
                  </div>
                </>
              )}
            </div>
            
          </div>
        )}
        
        {/* Alt Bilgi (Sadece scrollun en altında) */}
        <footer className="mt-10 py-6 border-t border-slate-200 text-center print:hidden">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em]">CNETMOBIL • CMR TERMINAL v1.0.0 (YENİ ARAYÜZ)</p>
        </footer>

        </div>
        </main>
      </div>

      {/* TAKSİT MODALI */}
      {isInstallmentModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm print:hidden p-4">
          <div className="bg-white rounded-[32px] shadow-2xl p-6 md:p-8 w-full max-w-4xl relative animate-in zoom-in-95 duration-200 border border-slate-100 flex flex-col max-h-[90vh]">
            
            <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4 shrink-0">
              <div className="flex items-center gap-3">
                <div className="bg-blue-50 text-blue-600 w-10 h-10 rounded-xl flex items-center justify-center">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
                </div>
                <h2 className="text-xl font-black italic text-slate-900 uppercase tracking-tighter">Taksit Hesaplama</h2>
              </div>
              <button onClick={() => { setIsInstallmentModalOpen(false); setInstallmentAmount(''); }} className="bg-slate-100 p-2 rounded-xl text-slate-500 hover:text-red-500 hover:bg-red-50 transition-all btn-click">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <div className="mb-6 shrink-0 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Müşteri Adı Soyadı</label>
                  <input type="text" placeholder="Gökhan Özden" value={customer.name} onChange={(e) => setCustomer({...customer, name: e.target.value})} className="w-full mt-1 bg-transparent text-sm font-bold outline-none text-slate-900 uppercase" />
                </div>
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Telefon Numarası</label>
                  <input type="text" placeholder="05XX XXX XX XX" value={customer.phone} onChange={(e) => setCustomer({...customer, phone: e.target.value})} className="w-full mt-1 bg-transparent text-sm font-bold outline-none text-slate-900" />
                </div>
              </div>

              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                  <span className="text-slate-400 font-black text-lg">₺</span>
                </div>
                <input type="number" placeholder="İşlem Tutarını Giriniz..." value={installmentAmount} onChange={(e) => setInstallmentAmount(e.target.value)} className="w-full py-4 pl-10 pr-4 bg-white rounded-2xl text-xl font-black border border-slate-200 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-50 transition-all text-slate-900 shadow-sm" />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 pb-2">
              {installmentAmount && Number(installmentAmount) > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { month: 2, rate: 7.83 }, { month: 3, rate: 10.05 }, { month: 4, rate: 12.36 },
                    { month: 5, rate: 14.76 }, { month: 6, rate: 17.55 }, { month: 7, rate: 20.19 },
                    { month: 8, rate: 22.96 }, { month: 9, rate: 25.85 }, { month: 10, rate: 28.88 },
                    { month: 11, rate: 32.07 }, { month: 12, rate: 35.41 },
                  ].map((inst) => {
                    const multiplier = 1 + (inst.rate / 100);
                    const total = Number(installmentAmount) * multiplier;
                    const monthly = total / inst.month;
                    return (
                      <div key={inst.month} className="flex justify-between items-center bg-white p-4 rounded-[20px] border border-slate-200 shadow-sm hover:border-blue-300 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="bg-slate-100 text-slate-700 w-12 h-12 flex flex-col items-center justify-center rounded-[14px]">
                            <span className="font-black text-lg leading-none">{inst.month}</span>
                          </div>
                          <div>
                            <div className="text-base font-black italic text-slate-900 tracking-tighter">
                              {monthly.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL
                            </div>
                            <div className="text-[10px] font-bold text-slate-400">
                              Top: {total.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} TL
                            </div>
                          </div>
                        </div>
                        <button onClick={() => handleSendInstallmentToWhatsApp(inst.month, total)} className="bg-[#25D366] text-white w-10 h-10 rounded-[12px] flex items-center justify-center transition-all hover:bg-[#128C7E] btn-click shrink-0">
                          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center opacity-30 py-10">
                  <svg className="w-16 h-16 mb-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0-2.08-.402-2.599-1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <p className="text-sm font-black uppercase tracking-widest text-slate-600">Tutar Giriniz</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* YAZDIRMA ALANI */}
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
