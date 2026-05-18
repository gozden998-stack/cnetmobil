"use client";
import React, { useState, useEffect, useRef } from 'react';
import AnaSayfa from './AnaSayfa';
import YoneticiPaneli from './components/YoneticiPaneli';

const TABLO_ISMI = 'Google Sheets ile Kurumsal Alım Sistemi'; 
const SCRIPT_URL = process.env.NEXT_PUBLIC_SCRIPT_URL as string;

const IP_HARITASI: any = {
  "78.188.91.172": "CMR SARAY",
  "46.196.12.101": "CMR KAPAKLI",
  "31.155.79.145": "CMR MERKEZ",
  "149.0.18.162": "CMR CADDE"
};

const MASTER_IPLER = [
  "95.70.226.118",
  "148.0.18.162"
];

export default function CnetmobilCmrFinalUltimate() {
  const [authLoading, setAuthLoading] = useState(true); 
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [entryPass, setEntryPass] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  
  const [loginMode, setLoginMode] = useState<'personel' | 'yonetici'>('personel');
  const [isMasterAccess, setIsMasterAccess] = useState(false);
  
  const [appMode, setAppMode] = useState<'ana_sayfa' | 'alim' | 'servis' | 'cep_tablet' | 'yna_list' | 'dis_kanal' | 'ikinci_el' | 'imei_list' | 'kampanya_sifir'>('ana_sayfa');

  const [cepTabletData, setCepTabletData] = useState<any[][]>([]);
  const [ynaData, setYnaData] = useState<any[][]>([]);
  const [disKanalData, setDisKanalData] = useState<any[][]>([]);
  const [ikinciElData, setIkinciElData] = useState<any[][]>([]); 
  const [imeiData, setImeiData] = useState<any[][]>([]);
  
  const [magazaGidisatData, setMagazaGidisatData] = useState<any[][]>([]);
  const [personelData, setPersonelData] = useState<any[][]>([]);

  const servisFiyatlariRef = useRef<any>({});
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

  const [ekspertizModalData, setEkspertizModalData] = useState<{customer: string, device: string, data: string} | null>(null);

  const [toastMessages, setToastMessages] = useState<{id: number, text: string, type: 'new' | 'price'}[]>([]);
  const prevDbRef = useRef<any[]>([]);
  const prevCepTabletRef = useRef<any[][]>([]);
  const toastIdCounter = useRef(0);

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

  const isZumay = selectedBranch === 'ZUMAY KANALI';

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
          if (session.branch === 'VODAFONE KANALI' || session.branch === 'ZUMAY KANALI') {
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
            setAuthLoading(false);
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
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: entryPass, mode: loginMode })
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        alert(data.message || "Hatalı Şifre!");
        setLoginLoading(false);
        return;
      }

      const matchedBranch = data.branch;

      if (loginMode === 'yonetici') {
          setIsMasterAccess(true);
          setIsAdmin(true);
          setSelectedBranch('CMR MERKEZ'); 
          setIsLoggedIn(true);
          localStorage.setItem('cnet_session', JSON.stringify({ mode: 'yonetici', branch: 'CMR MERKEZ' }));
          setLoginLoading(false);
          return;
      }

      if (matchedBranch === 'VODAFONE KANALI' || matchedBranch === 'ZUMAY KANALI') {
        setSelectedBranch(matchedBranch);
        setIsMasterAccess(false);
        setIsLoggedIn(true);
        localStorage.setItem('cnet_session', JSON.stringify({ mode: 'personel', branch: matchedBranch }));
        setLoginLoading(false);
        return;
      }

      const ipRes = await fetch('https://api.ipify.org?format=json');
      const ipData = await ipRes.json();
      const currentIp = ipData.ip;

      if (MASTER_IPLER.includes(currentIp) || IP_HARITASI[currentIp] === matchedBranch) {
        setSelectedBranch(matchedBranch);
        setIsMasterAccess(false);
        setIsLoggedIn(true);
        localStorage.setItem('cnet_session', JSON.stringify({ mode: 'personel', branch: matchedBranch }));
      } else {
        alert(`GÜVENLİK UYARISI: Bu mağazanın Wi-Fi ağına bağlanın! (IP: ${currentIp})`);
      }

    } catch (error) {
      alert("Bağlantı Hatası: Lütfen internetinizi kontrol edin.");
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

  const loadData = async (bypassClientCache = false) => {
    try {
      const fetchOptions: RequestInit = bypassClientCache 
        ? { cache: 'no-store', headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate', 'Pragma': 'no-cache' } } 
        : {};

      const res = await fetch('/api/sheets', fetchOptions); 
      const responseData = await res.json();
      const decodedString = decodeURIComponent(escape(window.atob(responseData.payload)));
      const allData = JSON.parse(decodedString);

      let newNotifications: {id: number, text: string, type: 'new' | 'price'}[] = [];
      const isInitialLoad = prevDbRef.current.length === 0;

      if (!isInitialLoad && !loading) { 
          if (allData.Devices) {
              const currentDeviceNames = prevDbRef.current.map(d => d.name);
              const newDevices = allData.Devices.filter((d: any) => d[1] && !currentDeviceNames.includes(d[1]));
              
              const uniqueNewDevices = Array.from(new Set(newDevices.map((d: any) => d[1])));
              uniqueNewDevices.forEach(deviceName => {
                  toastIdCounter.current += 1;
                  newNotifications.push({ id: toastIdCounter.current, text: `🎉 STOĞA YENİ CİHAZ GELDİ: ${deviceName}`, type: 'new' });
              });
          }

          if (allData.CepTablet && prevCepTabletRef.current.length > 0) {
              const prevTabletMap = new Map();
              prevCepTabletRef.current.forEach(row => {
                  if (row[0]) prevTabletMap.set(row[0], { k: row[1], s: row[2] }); 
                  if (row[5]) prevTabletMap.set(row[5], { k: row[6], s: row[7] }); 
              });

              const changedPrices: string[] = [];
              allData.CepTablet.forEach((row: any) => {
                  if (row[0]) {
                      const prev = prevTabletMap.get(row[0]);
                      if (prev && (prev.k !== row[1] || prev.s !== row[2])) {
                          if(!changedPrices.includes(row[0])) changedPrices.push(row[0]);
                      }
                  }
                  if (row[5]) {
                      const prev = prevTabletMap.get(row[5]);
                      if (prev && (prev.k !== row[6] || prev.s !== row[7])) {
                          if(!changedPrices.includes(row[5])) changedPrices.push(row[5]);
                      }
                  }
              });

              if (changedPrices.length > 0) {
                  toastIdCounter.current += 1;
                  if (changedPrices.length > 3) {
                      newNotifications.push({ id: toastIdCounter.current, text: `🔄 SİSTEMDE FİYATLAR GÜNCELLENDİ (${changedPrices.length} cihaz)`, type: 'price' });
                  } else {
                      newNotifications.push({ id: toastIdCounter.current, text: `💰 FİYAT GÜNCELLENDİ: ${changedPrices.join(', ')}`, type: 'price' });
                  }
              }
          }
      }

      if (newNotifications.length > 0) {
          setToastMessages(prev => [...prev, ...newNotifications]);
          newNotifications.forEach(notification => {
              setTimeout(() => {
                  setToastMessages(prev => prev.filter(m => m.id !== notification.id));
              }, 8000);
          });
      }

      if (allData.Devices) {
          prevDbRef.current = allData.Devices.map((row: any) => ({
              brand: row[0] || '', name: row[1] || '', cap: row[2] || '',
              base: parseInt(row[3]) || 0, img: row[4]?.trim() || '', minPrice: parseInt(row[5]) || 0
          }));
      }
      if (allData.CepTablet) {
          prevCepTabletRef.current = allData.CepTablet;
      }

      if (allData.Devices) {
        setDb(allData.Devices.map((row: any) => ({
          brand: row[0] || '', name: row[1] || '', cap: row[2] || '',
          base: parseInt(row[3]) || 0, img: row[4]?.trim() || '', minPrice: parseInt(row[5]) || 0
        })));
      }

      if (allData.Ayarlar) {
        const m: any = {};
        allData.Ayarlar.forEach((row: any) => { 
          m[row[0]] = isNaN(Number(row[1])) ? row[1] : parseFloat(row[1]); 
        });
        if (m.Ekran_Kirik_Android === undefined && m.Ekran_Kirik !== undefined) m.Ekran_Kirik_Android = m.Ekran_Kirik;
        if (m.Kasa_Kotu_Android === undefined && m.Kasa_Kotu !== undefined) m.Kasa_Kotu_Android = m.Kasa_Kotu;
        setConfig(m);
      }

      if (allData.Alimlar) {
        setAlimlar(allData.Alimlar.map((val: any, index: number) => ({ data: val, sheetIndex: index + 2 })));
      }

      if (allData.Markalar) {
        setBrandDb(allData.Markalar.map((row: any) => ({ name: row[0], logo: row[1] })));
      }

      if (allData.CepTablet) setCepTabletData(allData.CepTablet);
      if (allData.YNA) setYnaData(allData.YNA);
      if (allData.DisKanal) setDisKanalData(allData.DisKanal);
      if (allData.IkinciEl) setIkinciElData(allData.IkinciEl);
      
      if (allData.Depo) setImeiData(allData.Depo);
      
      if (allData.MagazaGidisat) setMagazaGidisatData(allData.MagazaGidisat);
      if (allData.PersonelGidisat) setPersonelData(allData.PersonelGidisat);

      if (allData.Servis) {
        const loadedServis: any = {};
        allData.Servis.forEach((row: any) => {
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

      setLoading(false);
    } catch (e) {
      console.error("Veri tünelinde hata:", e);
      setLoading(false);
    }
  };

  const refreshDataCache = async () => {
    try {
      await loadData(true); 
    } catch (e) {
      console.error("Önbellek temizlenirken hata oluştu", e);
    }
  };

  useEffect(() => {
    loadData();
    
    const intervalId = setInterval(() => { 
      loadData(); 
    }, 300000);

    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (selectedCapacity && config.Guc_Yok !== undefined) {
      let price = selectedCapacity.base;
      if (status.power === 'Hayır') price *= (1 - ((config.Guc_Yok || 0) / 100));

      let ekranKirikYuzdesi = config.Ekran_Kirik || 0;
      if (selectedBrand?.toLowerCase() !== 'apple') {
          ekranKirikYuzdesi = config.Ekran_Kirik_Android !== undefined ? config.Ekran_Kirik_Android : (config.Ekran_Kirik || 0);
      }
      
      if (status.screen === 'Kırık') {
          price *= (1 - (ekranKirikYuzdesi / 100));
      } 
      else if (status.screen === 'Bilinmeyen Parça') {
          let bilinmeyenParcaYuzdesi = config.Bilinmeyen_Parca || 0;
          price *= (1 - (bilinmeyenParcaYuzdesi / 100));
      }

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

      if (selectedBranch === 'VODAFONE KANALI' || selectedBranch === 'ZUMAY KANALI') {
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
    const dateFormatter = new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit' });
    const timeFormatter = new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    const dateStr = dateFormatter.format(now);
    const timeStr = timeFormatter.format(now).replace(',', '');
    const dateTime = `${dateStr} ${timeStr}`;
    
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
          setTimeout(() => { refreshDataCache(); }, 2500);

        } catch (e) { console.error(e); }
    }

    if (actionType === 'print') {
      window.print();
    } else if (actionType === 'whatsapp') {
      const branch = branches.find(b => b.name === selectedBranch) || branches[0];
      const priceText = purchaseType === 'NAKİT' 
          ? `💰 *NAKİT ALIM:* ${finalCashPrice.toLocaleString()} TL` 
          : `🔄 *TAKAS ALIM:* ${finalTradePrice.toLocaleString()} TL`;
          
      const message = `📱 *${isZumay ? 'ZUMAY' : 'CMR'} CİHAZ ALIM FORMU*%0A👤 *Müşteri:* ${customer.name}%0A🆔 *IMEI:* ${customer.imei}%0A📦 *Cihaz:* ${selectedModelName} (${selectedCapacity?.cap})${colorLabel}%0A${priceText}`;
      
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
      setTimeout(refreshDataCache, 2000);
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
      refreshDataCache();
    } catch (e) { console.error(e); }
  };

  const updateConfig = async (key: string, val: string) => {
    try {
      await fetch(SCRIPT_URL, { 
        method: 'POST', 
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }, 
        body: JSON.stringify({ type: "UPDATE_CONFIG", key, val }) 
      });
      alert(`${key === 'Duyuru_Metni' ? 'Duyuru' : key === 'Kampanya_Metni' ? 'Kampanya' : key} başarıyla güncellendi!`);
      
      setConfig((prev: any) => {
          const newVal = isNaN(Number(val)) ? val : parseFloat(val);
          return {...prev, [key]: newVal};
      });
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
      setTimeout(refreshDataCache, 1500);
    } catch (e) { console.error(e); }
  };

  const handleImeiKullan = async (imei: string) => {
    const personelName = window.prompt("Lütfen isminizi giriniz:");
    if (!personelName || personelName.trim() === "") return;

    const durumText = `KULLANILDI - ${personelName.toUpperCase()}`;

    if (typeof window !== 'undefined') {
      const kayitVerisi = { durum: durumText, timestamp: new Date().getTime() };
      localStorage.setItem('kullanilan_imei_' + imei, JSON.stringify(kayitVerisi));
    }

    setImeiData(prev => {
        const newData = [...prev];
        const rowIndex = newData.findIndex(r => r[1] === imei);
        if (rowIndex !== -1) {
            newData[rowIndex][2] = durumText;
        }
        return newData;
    });

    try {
      await fetch(SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ 
          type: "USE_IMEI", 
          imei: imei, 
          personel: personelName.toUpperCase() 
        })
      });
    } catch (e) {
      console.error("IMEI kaydedilirken hata:", e);
      alert("Bağlantı hatası! Lütfen internetinizi kontrol edin.");
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

  const menuGroups = [
    {
      title: "ANA MODÜLLER",
      items: [
        { id: 'ana_sayfa', label: 'Ana Sayfa', visible: true },
        { id: 'alim', label: 'Cihaz Alım', visible: true },
        { id: 'servis', label: 'Teknik Servis', visible: selectedBranch !== 'VODAFONE KANALI' && !isZumay }
      ]
    },
    {
      title: "FİYAT LİSTELERİ",
      items: [
        { id: 'cep_tablet', label: 'Cep + Tablet', visible: !isZumay },
        { id: 'yna_list', label: 'YNA List', visible: !isZumay },
        { id: 'dis_kanal', label: 'Dış Kanal', visible: true },
        { 
          id: 'kampanya_sifir', 
          label: (
            <div className="flex flex-col items-center justify-center -space-y-0.5">
              <span className="font-black tracking-widest">KAMPANYALI</span>
              <span className="text-[9px] font-bold opacity-75">SIFIR LİSTE</span>
            </div>
          ), 
          visible: selectedBranch !== 'VODAFONE KANALI' && !isZumay 
        },
        { id: 'ikinci_el', label: '2. El Listesi', visible: selectedBranch !== 'VODAFONE KANALI' && !isZumay },
        { id: 'imei_list', label: 'Depo', visible: selectedBranch === 'VODAFONE KANALI' && !isZumay }
      ]
    }
  ];

  const isYd = status.sim === 'Fiziksel + eSIM (YD)';
  const allSelected = Object.values(status).every(v => v !== null) && selectedCapacity;
  const canProceed = allSelected;
  const showDocs = purchaseType === 'NAKİT' || purchaseType === 'TAKAS';

  const baseBrands = ["Apple", "Samsung", "Xiaomi"];
  const displayBrands = Array.from(new Set([...baseBrands, ...brandDb.map(b => b.name), ...db.map(i => i.brand)]))
      .filter(brand => brand && brand.trim() !== "" && brand.toLowerCase() !== "marka");

  const getOffsetDate = (offsetDays: number) => {
    const d = new Date();
    d.setDate(d.getDate() - offsetDays);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const todayStr = getOffsetDate(0);
  const yesterdayStr = getOffsetDate(1);
  const dayBeforeYesterdayStr = getOffsetDate(2);

  const filteredAlimlar = [...alimlar].reverse().filter(item => {
      if (adminSelectedBranch !== 'TÜM ŞUBELER') {
          let foundBranch = null;
          for (let i = 0; i < item.data.length; i++) {
              if (typeof item.data[i] === 'string' && (item.data[i].includes("CMR ") || item.data[i].includes("VODAFONE ") || item.data[i].includes("ZUMAY "))) {
                  foundBranch = item.data[i];
                  break;
              }
          }
          if (foundBranch !== adminSelectedBranch) return false;
      }

      if (dateFilterType !== 'TÜM ZAMANLAR') {
          let rawDate = String(item.data[6] || item.data[7] || '');
          for (let j = item.data.length - 1; j >= 0; j--) {
              const val = String(item.data[j] || '');
              if (val.includes('.') && val.includes(':') && val.length > 10 && /\d/.test(val)) {
                  rawDate = val; break;
              }
          }
          
          const datePart = rawDate.split(' ')[0];
          let itemDateFormatted = '';
          
          if (datePart && datePart.includes('.')) {
              const [d, m, y] = datePart.split('.');
              if(y && m && d) itemDateFormatted = `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
          } else if (datePart && datePart.includes('/')) {
              const parts = datePart.split('/');
              if (parts.length === 3) {
                  const [m, d, y] = parts;
                  itemDateFormatted = `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
              }
          }

          if (!itemDateFormatted) return false;

          if (dateFilterType === 'BUGÜN' && itemDateFormatted !== todayStr) return false;
          if (dateFilterType === 'DÜN' && itemDateFormatted !== yesterdayStr) return false;
          if (dateFilterType === 'ÖNCEKİ GÜN' && itemDateFormatted !== dayBeforeYesterdayStr) return false;
          if (dateFilterType === 'ÖZEL') {
              if (customStartDate && itemDateFormatted < customStartDate) return false;
              if (customEndDate && itemDateFormatted > customEndDate) return false;
          }
      }
      return true;
  });

  let dashboardStats = { alindi: 0, alinmadi: 0, diger: 0, total: 0 };
  filteredAlimlar.forEach(item => {
      dashboardStats.total += 1;
      const rowDataString = item.data.join(" ");
      if (rowDataString.includes('[NAKİT ALINDI]') || rowDataString.includes('[TAKAS ALINDI]') || rowDataString.includes('[ALINDI]')) {
          dashboardStats.alindi += 1;
      } else if (rowDataString.includes('[ALINMADI]')) {
          dashboardStats.alinmadi += 1;
      } else {
          dashboardStats.diger += 1;
      }
  });

  if (authLoading) return (
    <div className="h-screen flex flex-col items-center justify-center bg-[#0B0F19] space-y-4">
      <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      <div className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em]">Güvenli Oturum Kontrolü</div>
    </div>
  );

  if (loading && isLoggedIn) return (
    <div className="h-screen flex flex-col items-center justify-center bg-[#0B0F19] space-y-4">
      <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      <div className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em]">Merkezi Altyapı Bağlanıyor</div>
    </div>
  );

  /* HIGH-FIDELITY AUTH PANEL MATCHED TO THE MOCKUP EXACTLY */
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-[#070A13] text-slate-100 flex flex-col lg:flex-row font-sans antialiased selection:bg-blue-500/30 relative overflow-hidden">
        
        {/* Mockup'taki o dumanlı premium radial mesh efektleri */}
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-[radial-gradient(circle,rgba(37,99,235,0.08)_0%,transparent_70%)] pointer-events-none blur-3xl" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[60%] bg-[radial-gradient(circle,rgba(99,102,241,0.05)_0%,transparent_70%)] pointer-events-none blur-3xl" />
        <div className="absolute right-[10%] top-[-10%] w-[40%] h-[50%] bg-[radial-gradient(circle,rgba(29,78,216,0.04)_0%,transparent_60%)] pointer-events-none blur-3xl" />

        {/* SOL BÖLÜM: Formun etrafında çerçeve olan o şık alan */}
        <div className="w-full lg:w-[45%] flex flex-col justify-between p-6 sm:p-12 lg:p-16 z-10 border-b lg:border-b-0 lg:border-r border-white/[0.04] bg-[#070A13]/40 backdrop-blur-md">
          
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/20">
              <span className="font-black text-white text-xs tracking-tighter">C</span>
            </div>
            <span className="text-base font-bold tracking-tight text-white uppercase">
              CNET<span className="text-blue-500 font-light">MOBIL</span>
            </span>
          </div>

          {/* Form Çerçevesi (Görseldeki gibi kutu içine alıyoruz) */}
          <div className="w-full max-w-[420px] mx-auto my-auto py-8 lg:py-0 border border-white/[0.05] bg-white/[0.01] p-8 rounded-2xl backdrop-blur-xl shadow-2xl shadow-black/40">
            <div className="mb-6">
              <h1 className="text-xl font-bold tracking-tight text-white mb-1.5">B2B Ortaklık Portalı</h1>
              <p className="text-[11px] text-slate-400 leading-relaxed font-normal opacity-80">Şube ve yönetim paneli operasyonlarını yetkilendirmek için lütfen parolanızı doğrulayın.</p>
            </div>

            {/* Segmented Control */}
            <div className="bg-[#111622] p-1 rounded-lg border border-white/[0.03] flex gap-1 mb-5">
              <button
                onClick={() => { setLoginMode('personel'); setEntryPass(''); }}
                disabled={loginLoading}
                className={`flex-1 py-1.5 text-[10px] font-bold rounded transition-all duration-150 uppercase tracking-wider ${
                  loginMode === 'personel'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/10'
                    : 'text-slate-400 hover:text-slate-200 disabled:opacity-50'
                }`}
              >
                Mağaza / Personel
              </button>
              <button
                onClick={() => { setLoginMode('yonetici'); setEntryPass(''); }}
                disabled={loginLoading}
                className={`flex-1 py-1.5 text-[10px] font-bold rounded transition-all duration-150 uppercase tracking-wider ${
                  loginMode === 'yonetici'
                    ? 'bg-white/[0.04] text-white border border-white/[0.05]'
                    : 'text-slate-400 hover:text-slate-200 disabled:opacity-50'
                }`}
              >
                Yönetici Girişi
              </button>
            </div>

            {/* Input Form */}
            <div className="space-y-4">
              <div>
                <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 pl-0.5">
                  {loginMode === 'personel' ? 'Sistem Erişim Şifresi' : 'Master Yönetici Şifresi'}
                </label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={entryPass}
                  onChange={(e) => setEntryPass(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                  disabled={loginLoading}
                  className="w-full bg-[#0d111a] border border-white/[0.06] rounded-xl px-4 py-2.5 text-white tracking-widest placeholder:tracking-normal focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all text-center text-base disabled:opacity-50 shadow-inner"
                />
              </div>

              <button
                onClick={handleLogin}
                disabled={loginLoading}
                className="w-full bg-blue-600 hover:bg-blue-500 active:scale-[0.99] disabled:opacity-50 text-white font-bold py-2.5 rounded-xl transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2 text-xs tracking-wider uppercase"
              >
                {loginLoading ? (
                  <>
                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Doğrulanıyor...
                  </>
                ) : (
                  'Sistemi Başlat'
                )}
              </button>
            </div>
          </div>

          <div className="text-[9px] font-semibold text-slate-500 tracking-wider uppercase opacity-60">
            © 2026 CNETMOBIL CLOUD INFRASTRUCTURE.
          </div>
        </div>

        {/* SAĞ BÖLÜM: Metinler ve Kartlar */}
        <div className="w-full lg:w-[55%] flex flex-col justify-center p-6 sm:p-12 lg:p-16 bg-[#04060b] relative border-t lg:border-t-0 border-white/[0.03]">
          <div className="max-w-[580px] mx-auto w-full space-y-10">
            
            <div className="space-y-3 text-center lg:text-left">
              <div className="inline-block">
                <span className="text-[9px] font-bold text-blue-400 uppercase tracking-widest bg-blue-500/10 px-2.5 py-0.5 rounded border border-blue-500/20">
                  Merkezi Dağıtık Ağ
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight leading-snug">
                Tüm şubeler, anlık stok ve fiyat havuzu <br className="hidden sm:inline" />
                <span className="text-blue-500 font-light">tek bir merkezi panelde birleşti.</span>
              </h2>
            </div>

            {/* Grid Kartlar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              <div className="p-4 rounded-xl bg-white/[0.01] border border-white/[0.03] hover:border-white/[0.08] hover:bg-white/[0.02] transition-all duration-300 flex flex-col justify-between min-h-[130px]">
                <div>
                  <div className="w-7 h-7 rounded bg-blue-500/5 border border-blue-500/10 flex items-center justify-center text-blue-400 mb-3">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>
                  </div>
                  <h3 className="text-[11px] font-bold text-white uppercase tracking-wider mb-1">Anlık Cihaz Değerleme</h3>
                  <p className="text-[11px] text-slate-400 leading-normal font-light opacity-75">Gelişmiş buyback algoritmalarıyla şubelerinizde hatasız, kayıpsız ve hızlı takas-alım süreçleri işletin.</p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-white/[0.01] border border-white/[0.03] hover:border-white/[0.08] hover:bg-white/[0.02] transition-all duration-300 flex flex-col justify-between min-h-[130px]">
                <div>
                  <div className="w-7 h-7 rounded bg-blue-500/5 border border-blue-500/10 flex items-center justify-center text-blue-400 mb-3">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" /><path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3" /></svg>
                  </div>
                  <h3 className="text-[11px] font-bold text-white uppercase tracking-wider mb-1">Merkezi Liste Senkronizasyonu</h3>
                  <p className="text-[11px] text-slate-400 leading-normal font-light opacity-75">Cep, Tablet, Sıfır Kampanya, YNA ve Dış Kanal verilerini tüm şube personellerine eşzamanlı dağıtın.</p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-white/[0.01] border border-white/[0.03] hover:border-white/[0.08] hover:bg-white/[0.02] transition-all duration-300 flex flex-col justify-between min-h-[130px]">
                <div>
                  <div className="w-7 h-7 rounded bg-blue-500/5 border border-blue-500/10 flex items-center justify-center text-blue-400 mb-3">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" /></svg>
                  </div>
                  <h3 className="text-[11px] font-bold text-white uppercase tracking-wider mb-1">Teknik Servis Altyapısı</h3>
                  <p className="text-[11px] text-slate-400 leading-normal font-light opacity-75">Yedek parça takipleri, anlık onarım maliyet matrisleri ve kurumsal dijital ekspertiz çıktı sistemini yönetin.</p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-white/[0.01] border border-white/[0.03] hover:border-white/[0.08] hover:bg-white/[0.02] transition-all duration-300 flex flex-col justify-between min-h-[130px]">
                <div>
                  <div className="w-7 h-7 rounded bg-blue-500/5 border border-blue-500/10 flex items-center justify-center text-blue-400 mb-3">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><rect x="8" y="2" width="8" height="4" rx="1" ry="1" /></svg>
                  </div>
                  <h3 className="text-[11px] font-bold text-white uppercase tracking-wider mb-1">Raporlama ve Mağaza Verisi</h3>
                  <p className="text-[11px] text-slate-400 leading-normal font-light opacity-75">Mağaza hakediş durumlarını, personel izin çizelgelerini ve şube performans metriklerini üst merkezden izleyin.</p>
                </div>
              </div>

            </div>

            {/* İstatistik Satırı */}
            <div className="pt-5 border-t border-white/[0.04] grid grid-cols-3 gap-4 text-center lg:text-left">
              <div>
                <div className="text-xl font-bold text-white tracking-tight">8+</div>
                <div className="text-[8px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">Aktif Şube / Kanal</div>
              </div>
              <div>
                <div className="text-xl font-bold text-white tracking-tight">100%</div>
                <div className="text-[8px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">Canlı Senkron Veri</div>
              </div>
              <div>
                <div className="text-xl font-bold text-blue-500 tracking-tight">Secure</div>
                <div className="text-[8px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">Google Sheets API</div>
              </div>
            </div>

          </div>
        </div>

      </div>
    );
  }

  /* WORKSPACE LAYER */
  return (
    <div className="flex flex-col min-h-screen font-sans selection:bg-blue-100 transition-colors duration-500 bg-[#F4F6F9] text-slate-900">
      <style>{`
        #print-area { display: none !important; }
        @media print {
          header, nav, main, footer, .print\\:hidden { display: none !important; }
          #print-area { display: block !important; visibility: visible !important; position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; background: white !important; color: black !important; margin: 0 !important; padding: 40px !important; }
          #print-area * { visibility: visible !important; }
        }
        .btn-click { transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); cursor: pointer; }
        .btn-click:active { transform: scale(0.97); }
        .custom-scrollbar::-webkit-scrollbar { width: 5px; height: 5px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94A3B8; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      {/* TOPBAR */}
      <header className={`sticky top-0 z-[100] w-full shadow-md print:hidden flex flex-col ${isZumay ? 'bg-[#191111]' : 'bg-[#1E2022]'}`}>
        <div className="flex items-center justify-between px-6 py-3 border-b border-white/[0.08]">
          <div onClick={() => { resetAll(); setAppMode('ana_sayfa'); }} className="flex items-center gap-2 cursor-pointer shrink-0">
            <h1 className="text-xl font-black tracking-tight text-white uppercase">
              {isZumay ? 'ZUMAY' : <>Cnet<span className="text-[#3b82f6] font-light">mobil</span></>}
            </h1>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            {!isZumay && step < 99 && (
              <button onClick={() => setIsInstallmentModalOpen(true)} className="bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-bold px-4 py-2 rounded uppercase shadow-sm transition-colors tracking-wider flex items-center gap-2">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
                Taksit Hesapla
              </button>
            )}

            <div className="flex items-center gap-3 pl-4 border-l border-white/[0.08]">
              <div className="w-8 h-8 rounded bg-white/10 flex items-center justify-center font-bold text-white text-xs shrink-0">
                {isMasterAccess ? 'M' : 'B'}
              </div>
              <div className="hidden md:flex flex-col text-white">
                {isMasterAccess ? (
                  <select value={selectedBranch} onChange={(e) => setSelectedBranch(e.target.value)} className="bg-transparent text-xs font-bold outline-none cursor-pointer text-white hover:text-blue-400 transition-colors">
                    {branches.map(b => <option key={b.name} value={b.name} className="text-slate-900">{b.name}</option>)}
                  </select>
                ) : (
                  <span className="text-xs font-bold leading-none truncate max-w-[150px]">{selectedBranch}</span>
                )}
                <span className="text-[9px] text-white/40 tracking-wider mt-1 uppercase">{isMasterAccess ? 'CnetMobil Executive' : 'Bayi Ağı'}</span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 pl-2">
              {isAdmin && step < 99 && (
                <button onClick={() => setStep(99)} title="Yönetici Portalı" className="text-white/40 hover:text-white p-2 transition-colors rounded hover:bg-white/5">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                </button>
              )}
              <button onClick={handleLogout} title="Güvenli Çıkış" className="text-white/40 hover:text-red-400 p-2 transition-colors rounded hover:bg-white/5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center overflow-x-auto no-scrollbar px-6 text-[10px] font-bold text-white/60 h-10 tracking-wider uppercase">
          {step < 99 && menuGroups.flatMap(g => g.items).filter(i => i.visible).map((item, idx, arr) => {
            const isActive = appMode === item.id;
            const isLast = idx === arr.length - 1;
            return (
              <div key={item.id} className={`flex items-center h-full ${!isLast ? 'border-r border-white/5' : ''}`}>
                <button
                  onClick={() => { setAppMode(item.id as any); setStep(1); resetSelection(); }}
                  className={`relative h-full px-5 whitespace-nowrap hover:text-white transition-all duration-150 flex items-center ${isActive ? 'text-white bg-white/5' : ''}`}
                >
                  {item.label}
                  {isActive && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-500"></div>}
                </button>
              </div>
            );
          })}
          {step === 99 && (
              <div className="flex items-center h-full px-5 text-amber-500 font-extrabold tracking-widest border-l border-white/5 bg-white/5">
                 Yönetim Masası
              </div>
          )}
        </div>
      </header>

      {/* CORE FRAME CONTAINER */}
      <div className="flex-1 w-full min-w-0 flex flex-col relative">
        <main className="max-w-[1500px] mx-auto w-full p-4 sm:p-6 lg:p-8 print:hidden">
 
          {appMode === 'ana_sayfa' && step < 99 ? (
              isZumay ? (
                 <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-6 animate-in fade-in duration-300 px-4">
                    <div className="w-16 h-16 bg-red-600 rounded-xl flex items-center justify-center text-white text-3xl font-black">Z</div>
                    <h2 className="text-2xl font-bold tracking-tight text-slate-800 uppercase text-center">
                       ZUMAY <span className="text-red-600 font-light">BAYİ PORTALI</span>
                    </h2>
                    <p className="text-slate-400 font-medium text-xs text-center max-w-sm">
                       Cihaz alım ve dağıtık kanal satın alma işlemlerinizi üst konsol üzerinden gerçekleştirebilirsiniz.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3 mt-4 w-full sm:w-auto">
                       <button onClick={() => {setAppMode('alim'); setStep(1);}} className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-bold uppercase tracking-wider text-xs transition-all btn-click">
                          Cihaz Alımı Başlat
                       </button>
                       <button onClick={() => {setAppMode('dis_kanal'); setStep(1);}} className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-6 py-3 rounded-lg font-bold uppercase tracking-wider text-xs transition-all btn-click">
                          Dış Kanal Listesi
                       </button>
                    </div>
                 </div>
              ) : (
                 <AnaSayfa selectedBranch={selectedBranch} setAppMode={setAppMode} config={config} gidisatData={magazaGidisatData} personelData={personelData} />
              )
          ) : appMode === 'imei_list' && step < 99 ? (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 text-slate-900 shadow-sm animate-in fade-in duration-200">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 border-b border-slate-100 pb-4 gap-4">
                  <div>
                    <h2 className="text-xl font-bold tracking-tight text-slate-800">DEPO STOK LİSTESİ</h2>
                    <p className="text-[10px] text-slate-400 font-semibold tracking-wider mt-0.5 uppercase">Vodafone Kanalı IMEI Atamaları</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg flex items-center w-full md:w-72 focus-within:border-blue-500 focus-within:bg-white transition-all">
                    <svg className="w-4 h-4 text-slate-400 mr-2 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    <input type="text" placeholder="IMEI veya Cihaz Ara..." className="bg-transparent border-none outline-none text-xs text-slate-800 w-full" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                  </div>
              </div>
              
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left border-collapse min-w-[600px]">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 text-[9px] font-bold tracking-wider uppercase border-b border-slate-200">
                      <th className="p-3">Cihaz Tanımı</th>
                      <th className="p-3 text-center">IMEI Referans</th>
                      <th className="p-3 text-right">Eylem / Durum</th>
                    </tr>
                  </thead>
                  <tbody className="text-xs font-medium text-slate-700">
                    {imeiData.slice(1).filter(r => (r[0] && r[0].toLowerCase().includes(searchQuery.toLowerCase())) || (r[1] && r[1].toLowerCase().includes(searchQuery.toLowerCase()))).map((row, i) => {
                        const imeiNo = row[1];
                        let localDurum = null;
                        
                        if (typeof window !== 'undefined') {
                            const kayitStr = localStorage.getItem('kullanilan_imei_' + imeiNo);
                            if (kayitStr) {
                                try {
                                    const kayit = JSON.parse(kayitStr);
                                    if (new Date().getTime() - kayit.timestamp < 600000) {
                                        localDurum = kayit.durum;
                                    } else {
                                        localStorage.removeItem('kullanilan_imei_' + imeiNo);
                                    }
                                } catch (e) { localStorage.removeItem('kullanilan_imei_' + imeiNo); }
                            }
                        }
                        
                        const guncelDurum = localDurum || row[2]; 
                        const isUsed = guncelDurum && guncelDurum.toString().toUpperCase().includes('KULLANILDI');
                        
                        return (
                        <tr key={i} className={`border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors ${isUsed ? 'bg-red-50/40' : ''}`}>
                          <td className={`p-3 font-semibold ${isUsed ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{row[0] || '-'}</td>
                          <td className={`p-3 text-center font-mono font-bold text-sm ${isUsed ? 'text-slate-400 line-through' : 'text-blue-600'}`}>{row[1] || '-'}</td>
                          <td className="p-3 text-right">
                              {isUsed ? (
                                  <span className="text-[9px] bg-red-100 text-red-700 px-2 py-0.5 rounded font-bold tracking-wider uppercase">{guncelDurum}</span>
                              ) : (
                                  <button onClick={() => handleImeiKullan(row[1])} className="bg-slate-800 hover:bg-slate-900 text-white px-3 py-1 rounded text-[10px] font-bold tracking-wider uppercase transition-all btn-click">
                                      Kullan
                                  </button>
                              )}
                          </td>
                        </tr>
                    )})}
                  </tbody>
                </table>
              </div>
            </div>
          ) :

          appMode === 'kampanya_sifir' && step < 99 ? (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 text-slate-900 shadow-sm animate-in fade-in duration-200">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 border-b border-slate-100 pb-4 gap-4">
                  <div>
                    <h2 className="text-xl font-bold tracking-tight text-slate-800">KAMPANYALI SIFIR LİSTE</h2>
                    <p className="text-[10px] text-slate-400 font-semibold tracking-wider mt-0.5 uppercase">Anlık Güncellenen Kampanyalı Ürün Dağıtımı</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 p-2 rounded-lg flex items-center w-full md:w-72 focus-within:border-blue-500 focus-within:bg-white transition-all">
                    <svg className="w-4 h-4 text-slate-400 mr-2 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    <input type="text" placeholder="Ürün Tanımı Ara..." className="bg-transparent border-none outline-none text-xs text-slate-800 w-full" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                  </div>
              </div>

              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left border-collapse min-w-[500px]">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 text-[9px] font-bold tracking-wider uppercase border-b border-slate-200">
                      <th className="p-3">Ürün Açıklaması</th>
                      <th className="p-3 text-right">Merkez Dağıtım Fiyatı</th>
                    </tr>
                  </thead>
                  <tbody className="text-xs font-medium text-slate-700">
                    {cepTabletData.slice(1).filter(r => r[10] && r[10].trim() !== '' && r[10].toLowerCase().includes(searchQuery.toLowerCase())).map((row, i) => {
                        const cellName = (row[10] || '').toUpperCase();
                        const isHighlighted = cellName.includes('BOMBA') || cellName.includes('KAMPANYA');
                        return (
                        <tr key={i} className={`border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors ${isHighlighted ? 'bg-amber-50/50' : ''}`}>
                          <td className={`p-3 font-semibold ${isHighlighted ? 'text-amber-800' : 'text-slate-800'}`}>{row[10]}</td>
                          <td className={`p-3 text-right font-bold text-sm ${isHighlighted ? 'text-amber-600' : 'text-slate-900'}`}>{row[11] || '-'}</td>
                        </tr>
                    )})}
                  </tbody>
                </table>
              </div>
            </div>
          ) :

          appMode === 'ikinci_el' && step < 99 ? (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 text-slate-900 shadow-sm animate-in fade-in duration-200">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 border-b border-slate-100 pb-4 gap-4">
                  <div>
                    <h2 className="text-xl font-bold tracking-tight text-slate-800">2. EL FİYAT LİSTESİ</h2>
                    <p className="text-[10px] text-slate-400 font-semibold tracking-wider mt-0.5 uppercase">Şubeler Arası Havuz Fiyat Matrisi</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 p-2 rounded-lg flex items-center w-full md:w-72 focus-within:border-blue-500 focus-within:bg-white transition-all">
                    <svg className="w-4 h-4 text-slate-400 mr-2 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    <input type="text" placeholder="Model Varyantı Ara..." className="bg-transparent border-none outline-none text-xs text-slate-800 w-full" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                  </div>
              </div>
              
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left border-collapse min-w-[650px]">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 text-[9px] font-bold tracking-wider uppercase border-b border-slate-200">
                      <th className="p-3">Cihaz / Model</th>
                      <th className="p-3 text-center">Kondisyon</th>
                      <th className="p-3 text-center">Konsol Fiyatı</th>
                      <th className="p-3 text-right">Dahili Notlar</th>
                    </tr>
                  </thead>
                  <tbody className="text-xs font-medium text-slate-700">
                    {ikinciElData.slice(1).filter(r => r[0] && r[0].toLowerCase().includes(searchQuery.toLowerCase())).map((row, i) => (
                      <tr key={i} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors">
                        <td className="p-3 font-semibold text-slate-800">{row[0]}</td>
                        <td className="p-3 text-center text-slate-500 font-medium">{row[1] || '-'}</td>
                        <td className="p-3 text-center font-bold text-slate-900 text-sm">{row[2] || '-'}</td>
                        <td className="p-3 text-right text-slate-400 text-[11px] max-w-[200px] truncate">{row[3] || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) :

          appMode === 'dis_kanal' && step < 99 ? (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 text-slate-900 shadow-sm animate-in fade-in duration-200">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 border-b border-slate-100 pb-4 gap-4">
                  <div>
                    <h2 className="text-xl font-bold tracking-tight text-slate-800">DIŞ KANAL SATIN ALMA LİSTESİ</h2>
                    <p className="text-[10px] text-slate-400 font-semibold tracking-wider mt-0.5 uppercase">B2B Dış Tedarik Satın Alım Baremleri</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 p-2 rounded-lg flex items-center w-full md:w-72 focus-within:border-blue-500 focus-within:bg-white transition-all">
                    <svg className="w-4 h-4 text-slate-400 mr-2 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    <input type="text" placeholder="Tedarik Ürünü Ara..." className="bg-transparent border-none outline-none text-xs text-slate-800 w-full" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                  </div>
              </div>
              
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left border-collapse min-w-[600px]">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 text-[9px] font-bold tracking-wider uppercase border-b border-slate-200">
                      <th className="p-3">Grup / Model Varyantı</th>
                      <th className="p-3 text-center">B2B Alım Baremi</th>
                      <th className="p-3 text-right">Tedarik Statüsü</th>
                    </tr>
                  </thead>
                  <tbody className="text-xs font-medium text-slate-700">
                    {disKanalData.slice(1).filter(r => r[0] && r[0].toLowerCase().includes(searchQuery.toLowerCase())).map((row, i) => (
                      <tr key={i} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors">
                        <td className="p-3 font-semibold text-slate-800">{row[0]}</td>
                        <td className="p-3 text-center font-bold text-sm text-slate-900">{row[1] || '-'}</td>
                        <td className="p-3 text-right text-slate-400 font-light text-[11px]">{row[2] || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) :

          appMode === 'cep_tablet' && step < 99 ? (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 text-slate-900 shadow-sm animate-in fade-in duration-200">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 border-b border-slate-100 pb-4 gap-4">
                  <div>
                    <h2 className="text-xl font-bold tracking-tight text-slate-800">MERKEZİ MATRİS FİYATLARI</h2>
                    <p className="text-[10px] text-slate-400 font-semibold tracking-wider mt-0.5 uppercase">Cep Telefonu, Tablet ve Akıllı Saat Güncel Listesi</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 p-2 rounded-lg flex items-center w-full md:w-72 focus-within:border-blue-500 focus-within:bg-white transition-all">
                    <svg className="w-4 h-4 text-slate-400 mr-2 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    <input type="text" placeholder="Model Hızlı Ara..." className="bg-transparent border-none outline-none text-xs text-slate-800 w-full" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                  </div>
              </div>
              
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-[10px] font-bold tracking-wider text-slate-400 uppercase mb-3 px-1">Apple Cihaz Segmentasyonu</h3>
                  <div className="overflow-x-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 text-[9px] font-bold uppercase border-b border-slate-200 tracking-wider">
                          <th className="p-2.5">Model</th>
                          <th className="p-2.5 text-center">Kampanya</th>
                          <th className="p-2.5 text-center">Satış</th>
                          <th className="p-2.5 text-right">Resmi</th>
                        </tr>
                      </thead>
                      <tbody className="text-xs font-medium text-slate-700">
                        {cepTabletData.slice(1).filter(r => r[0] && r[0].toLowerCase().includes(searchQuery.toLowerCase())).map((row, i) => (
                          <tr key={i} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                            <td className="p-2.5 font-semibold text-slate-800">{row[0]}</td>
                            <td className="p-2.5 text-center font-bold text-red-600">{row[1] || '-'}</td>
                            <td className="p-2.5 text-center text-slate-900">{row[2] || '-'}</td>
                            <td className="p-2.5 text-right text-slate-400 font-mono text-[11px]">{row[3] || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div>
                  <h3 className="text-[10px] font-bold tracking-wider text-slate-400 uppercase mb-3 px-1">Android & Çoklu Marka Segmentasyonu</h3>
                  <div className="overflow-x-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 text-[9px] font-bold uppercase border-b border-slate-200 tracking-wider">
                          <th className="p-2.5">Model</th>
                          <th className="p-2.5 text-center">Kampanya</th>
                          <th className="p-2.5 text-center">Satış</th>
                          <th className="p-2.5 text-right">Resmi</th>
                        </tr>
                      </thead>
                      <tbody className="text-xs font-medium text-slate-700">
                        {cepTabletData.slice(1).filter(r => r[5] && r[5].toLowerCase().includes(searchQuery.toLowerCase())).map((row, i) => (
                          <tr key={i} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                            <td className="p-2.5 font-semibold text-slate-800">{row[5]}</td>
                            <td className="p-2.5 text-center font-bold text-red-600">{row[6] || '-'}</td>
                            <td className="p-2.5 text-center text-slate-900">{row[7] || '-'}</td>
                            <td className="p-2.5 text-right text-slate-400 font-mono text-[11px]">{row[8] || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          ) : 
          
          appMode === 'yna_list' && step < 99 ? (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 text-slate-900 shadow-sm animate-in fade-in duration-200">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 border-b border-slate-100 pb-4 gap-4">
                  <div>
                    <h2 className="text-xl font-bold tracking-tight text-slate-800">YENİ NESİL AKSESUAR (YNA LIST)</h2>
                    <p className="text-[10px] text-slate-400 font-semibold tracking-wider mt-0.5 uppercase">Premium Kulaklık, Watch ve Ekosistem Ürün Baremleri</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 p-2 rounded-lg flex items-center w-full md:w-72 focus-within:border-blue-500 focus-within:bg-white transition-all">
                    <svg className="w-4 h-4 text-slate-400 mr-2 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    <input type="text" placeholder="Aksesuar Varyantı Ara..." className="bg-transparent border-none outline-none text-xs text-slate-800 w-full" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                  </div>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 text-[9px] font-bold uppercase border-b border-slate-200 tracking-wider">
                        <th className="p-2.5">Aksesuar / Modül</th>
                        <th className="p-2.5 text-right">Fiyat</th>
                      </tr>
                    </thead>
                    <tbody className="text-xs font-medium text-slate-700">
                      {ynaData.slice(1).filter(r => r[0] && r[0].toLowerCase().includes(searchQuery.toLowerCase())).map((row, i) => (
                        <tr key={i} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                          <td className="p-2.5 font-semibold text-slate-800">{row[0]}</td>
                          <td className="p-2.5 text-right font-bold text-slate-900">{row[1] || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 text-[9px] font-bold uppercase border-b border-slate-200 tracking-wider">
                        <th className="p-2.5">Aksesuar / Modül</th>
                        <th className="p-2.5 text-right">Fiyat</th>
                      </tr>
                    </thead>
                    <tbody className="text-xs font-medium text-slate-700">
                      {ynaData.slice(1).filter(r => r[3] && r[3].toLowerCase().includes(searchQuery.toLowerCase())).map((row, i) => {
                          return (
                          <tr key={i} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                            <td className="p-2.5 font-semibold text-slate-800">{row[3]}</td>
                            <td className="p-2.5 text-right font-bold text-slate-900">{row[4] || '-'}</td>
                          </tr>
                      )})}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) :
          
          /* ADMINISTRATIVE MASKS LAYER */
          step === 99 ? (
            <div className="animate-in fade-in duration-300">
              {isAdmin && (
                <div className="mb-4 bg-white border border-slate-200 p-3 rounded-xl shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
                   <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto no-scrollbar">
                      <select value={adminSelectedBranch} onChange={(e) => setAdminSelectedBranch(e.target.value)} className="bg-slate-50 text-slate-700 text-[10px] font-bold tracking-wider p-2 rounded border border-slate-200 outline-none uppercase">
                        <option value="TÜM ŞUBELER">TÜM ŞUBELER</option>
                        {branches.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
                      </select>
                      <select value={dateFilterType} onChange={(e) => setDateFilterType(e.target.value)} className="bg-slate-50 text-slate-700 text-[10px] font-bold tracking-wider p-2 rounded border border-slate-200 outline-none uppercase">
                         <option value="TÜM ZAMANLAR">TÜM ZAMANLAR</option>
                         <option value="BUGÜN">BUGÜN</option>
                         <option value="DÜN">DÜN</option>
                         <option value="ÖNCEKİ GÜN">ÖNCEKİ GÜN</option>
                         <option value="ÖZEL">ÖZEL</option>
                      </select>

                      {dateFilterType === 'ÖZEL' && (
                        <div className="flex items-center gap-1">
                           <input type="date" value={customStartDate} onChange={(e) => setCustomStartDate(e.target.value)} className="bg-slate-50 text-slate-700 text-xs p-2 rounded border border-slate-200 outline-none" />
                           <input type="date" value={customEndDate} onChange={(e) => setCustomEndDate(e.target.value)} className="bg-slate-50 text-slate-700 text-xs p-2 rounded border border-slate-200 outline-none" />
                        </div>
                      )}
                   </div>

                   <div className="flex items-center gap-2 w-full md:w-auto shrink-0">
                      <button onClick={() => {setStep(1); setIsAdmin(false); if(isMasterAccess) handleLogout();}} className="bg-slate-900 text-white hover:bg-black px-4 py-2 rounded text-[10px] font-bold tracking-wider uppercase transition-all flex items-center justify-center gap-1.5 btn-click">
                        Kapat
                      </button>
                   </div>
                </div>
              )}

              <YoneticiPaneli
                isAdmin={isAdmin}
                setAdminPass={setAdminPass}
                handleLogin={handleLogin}
                adminSelectedBranch={adminSelectedBranch}
                dateFilterType={dateFilterType}
                dashboardStats={dashboardStats}
                config={config}
                updateConfig={updateConfig}
                filteredAlimlar={filteredAlimlar}
                deleteAllAlimlar={deleteAllAlimlar}
                deleteAlim={deleteAlim}
                setEkspertizModalData={setEkspertizModalData}
              />
            </div>
          ) : step === 1 ? (
            <div className="space-y-8 text-slate-900 max-w-[1100px] mx-auto">
              <div className="text-center space-y-1.5 mt-8">
                  <h2 className="text-2xl font-bold tracking-tight uppercase text-slate-800">
                    {appMode === 'alim' ? 'KONSOL CİHAZ SATIN ALMA' : 'TEKNİK SERVİS MODÜLÜ'}
                  </h2>
                  <p className="font-semibold text-[10px] tracking-widest text-slate-400 uppercase">İşlem yapılacak üretici segmentini seçin</p>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {displayBrands.map(brand => {
                  const brandInfo = brandDb.find(b => b.name === brand);
                  const finalLogo = brandInfo?.logo || brandAssets[brand]?.logo || "";

                  return (
                    <div key={brand} 
                         onClick={() => { setSelectedBrand(brand); setStep(2); resetSelection(); }} 
                         className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center text-center h-48 group transition-all duration-200 hover:shadow-md hover:border-slate-300 cursor-pointer btn-click">
                      <div className="h-16 w-full flex items-center justify-center mb-4 transition-all transform group-hover:scale-105">
                        <img src={finalLogo} className="max-h-full max-w-[100px] object-contain" alt={brand} />
                      </div>
                      <h2 className="font-bold text-sm uppercase tracking-wider text-slate-700">{brand}</h2>
                      <p className="text-[8px] font-bold tracking-widest text-slate-400 uppercase mt-1">
                          {appMode === 'servis' ? 'Onarım Kataloğu' : 'Satın Alım'}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : step === 2 ? (
            <div className="animate-in fade-in duration-200 text-slate-900 max-w-[1300px] mx-auto">
              <div className="flex items-center justify-between mb-6">
                  <button onClick={() => {setStep(1); resetSelection();}} className="bg-white border border-slate-200 shadow-sm px-4 py-2 rounded-lg text-[10px] font-bold uppercase transition-all btn-click flex items-center gap-1.5">
                    Geri
                  </button>
                  <div className="text-right">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-blue-600">{selectedBrand}</span>
                    <h2 className="text-lg font-bold tracking-tight text-slate-800">Model Matrisi</h2>
                  </div>
              </div>

              <div className="flex justify-center mb-6">
                <div className="relative w-full max-w-md">
                  <input
                    type="text"
                    placeholder="Model kırılımını filtrele..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full p-3 pl-10 bg-white rounded-lg text-xs font-semibold border border-slate-200 outline-none focus:border-blue-500 transition-all text-slate-800"
                  />
                  <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {Array.from(new Set(db.filter(i => i.brand === selectedBrand).map(i => i.name)))
                  .filter(name => name.toLowerCase().includes(searchQuery.toLowerCase()))
                  .map(name => (
                    <div key={name} onClick={() => {setSelectedModelName(name); setStep(3); resetSelection();}} className="bg-white p-4 rounded-xl shadow-sm cursor-pointer border border-slate-200 transition-all text-center btn-click group flex flex-col items-center justify-between min-h-[160px] hover:border-slate-400 hover:shadow-md">
                      <div className="h-20 flex items-center justify-center mb-3 transform transition-transform group-hover:scale-105">
                          <img src={db.find(i => i.name === name)?.img} className="max-h-full object-contain" />
                      </div>
                      <div className="w-full border-t border-slate-100 pt-2">
                        <p className="font-bold text-xs uppercase text-slate-700 truncate">{name}</p>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col lg:flex-row gap-6 animate-in fade-in duration-200 text-slate-900 max-w-[1300px] mx-auto">
              
              <div className="flex-1 space-y-4">
                <button onClick={() => {setStep(2); resetSelection();}} className="bg-white border border-slate-200 shadow-sm px-4 py-2 rounded-lg text-[10px] font-bold uppercase transition-all btn-click flex items-center gap-1.5 w-max">
                  Modellere Dön
                </button>

                {appMode === 'servis' ? (
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 relative overflow-hidden">
                    <div className="flex flex-col sm:flex-row items-center gap-6 mb-6">
                        <div className="w-24 h-24 shrink-0 bg-slate-50 rounded-xl p-2 flex items-center justify-center border border-slate-100">
                          <img src={db.find(i => i.name === selectedModelName)?.img} className="max-h-full object-contain" alt="Device" />
                        </div>
                        <div className="text-center sm:text-left">
                          <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider">{selectedBrand}</span>
                          <h2 className="text-xl font-bold mt-1 text-slate-800 uppercase">{selectedModelName}</h2>
                          <p className="text-slate-400 font-semibold tracking-wider text-[9px] mt-0.5 uppercase">Teknik Onarım Matris Kalibrasyonu</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60 flex flex-col justify-between">
                          <div>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Ekran Grubu Onarımı</p>
                          </div>
                          <div className="flex flex-col gap-1.5 text-left bg-white p-3 rounded-lg border border-slate-100 text-[11px]">
                              <div className="flex justify-between items-center border-b border-slate-100 pb-1">
                                <span className="font-semibold text-slate-500">Orijinal:</span> 
                                <span className="font-bold text-slate-800">{servisFiyatlari[selectedModelName]?.ekranOrj || servisFiyatlari[selectedModelName]?.ekran ? `${Number(servisFiyatlari[selectedModelName]?.ekranOrj || servisFiyatlari[selectedModelName]?.ekran).toLocaleString()} ₺` : '-'}</span>
                              </div>
                              <div className="flex justify-between items-center border-b border-slate-100 pb-1">
                                <span className="font-semibold text-slate-500">OLED:</span> 
                                <span className="font-bold text-slate-800">{servisFiyatlari[selectedModelName]?.ekranOled ? `${Number(servisFiyatlari[selectedModelName]?.ekranOled).toLocaleString()} ₺` : '-'}</span>
                              </div>
                              {selectedBrand?.toLowerCase() === 'apple' && (
                              <div className="flex justify-between items-center">
                                <span className="font-semibold text-slate-500">Entegreli:</span> 
                                <span className="font-bold text-slate-800">{servisFiyatlari[selectedModelName]?.ekranCipli ? `${Number(servisFiyatlari[selectedModelName]?.ekranCipli).toLocaleString()} ₺` : '-'}</span>
                              </div>
                              )}
                          </div>
                        </div>

                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60 flex flex-col justify-between min-h-[110px]">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Batarya Grubu</p>
                          <div className="text-base font-bold tracking-tight text-slate-800 mt-2">
                              {servisFiyatlari[selectedModelName]?.batarya ? `${Number(servisFiyatlari[selectedModelName]?.batarya).toLocaleString()} ₺` : 'Barem Yok'}
                          </div>
                        </div>

                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60 flex flex-col justify-between">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Arka Cam Katmanı</p>
                          <div className="text-base font-bold tracking-tight text-slate-800 mt-2">
                              {servisFiyatlari[selectedModelName]?.arkaCam ? `${Number(servisFiyatlari[selectedModelName]?.arkaCam).toLocaleString()} ₺` : 'Barem Yok'}
                          </div>
                        </div>

                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60 flex flex-col justify-between">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Kasa Gövde Değişimi</p>
                          <div className="text-base font-bold tracking-tight text-slate-800 mt-2">
                              {servisFiyatlari[selectedModelName]?.kasa ? `${Number(servisFiyatlari[selectedModelName]?.kasa).toLocaleString()} ₺` : 'Barem Yok'}
                          </div>
                        </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 relative overflow-hidden">
                      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4 border-b border-slate-100 pb-3">
                        <div>
                          <h3 className="text-sm font-bold tracking-wider text-slate-800 uppercase">EKSPERTİZ MÜŞTERİ REFERANS KARTI</h3>
                        </div>
                        {customer.imei.length === 15 && (
                          <button type="button" onClick={() => window.open(`https://www.turkiye.gov.tr/imei-sorgulama`, '_blank')} className="bg-slate-800 hover:bg-black text-white px-4 py-2 rounded-lg text-[9px] font-bold tracking-wider transition-all shadow-sm uppercase">
                            BTK Referans Sorgu
                          </button>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-3">
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider ml-1">Müşteri Beyan Ad Soyad</label>
                            <input placeholder="İsim Giriniz" className={`w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none font-bold uppercase transition-all ${isZumay ? 'focus:border-red-500' : 'focus:border-blue-500'}`} value={customer.name} onChange={(e)=>setCustomer({...customer, name: e.target.value})} />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider ml-1">İletişim Mobil Hattı</label>
                            <input placeholder="05XX XXX XX XX" className={`w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none font-bold transition-all ${isZumay ? 'focus:border-red-500' : 'focus:border-blue-500'}`} value={customer.phone} onChange={(e)=>setCustomer({...customer, phone: e.target.value})} />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider ml-1">Donanım IMEI Ataması (15 Hane)</label>
                            <input placeholder="IMEI Giriniz" className={`w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none font-bold transition-all ${isZumay ? 'focus:border-red-500' : 'focus:border-blue-500'}`} value={customer.imei} maxLength={15} onChange={(e) => setCustomer({...customer, imei: e.target.value.replace(/\D/g, '')})} />
                          </div>
                        </div>

                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3 flex flex-col justify-center">
                          <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 mb-1">
                            Güvenlik Adımları Protokolü
                          </p>
                          {[
                            "Bul (Find My) servisleri kapatıldı",
                            "Kurumsal ve bireysel hesaplardan çıkış yapıldı",
                            "Sistem fabrika ayarlarına döndürüldü",
                            "Kayıtlı ağ ve operatör kilitleri doğrulandı"
                          ].map((item, idx) => (
                            <label key={idx} className="flex items-center gap-2 cursor-pointer select-none">
                              <input type="checkbox" className="w-4 h-4 accent-slate-800 rounded cursor-pointer" />
                              <span className="text-xs font-semibold text-slate-600 uppercase tracking-tight text-[11px]">{item}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="bg-white p-5 rounded-2xl border border-slate-200">
                        <p className="text-[9px] font-bold mb-3 text-slate-400 uppercase tracking-wider">Hafıza Katmanı Varyantı</p>
                        <div className="flex flex-wrap gap-2">
                          {db.filter(i => i.name === selectedModelName).map(c => (
                            <button key={c.cap} onClick={() => setSelectedCapacity(c)} className={`px-5 py-2.5 rounded-lg font-bold text-xs transition-all border ${selectedCapacity?.cap === c.cap ? (isZumay ? 'bg-red-600 text-white border-red-600 shadow-sm' : 'bg-blue-600 text-white border-blue-600 shadow-sm') : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}>{c.cap}</button>
                          ))}
                        </div>
                      </div>

                      {selectedModelName === "iPhone 13" && (
                        <div className="bg-white p-5 rounded-2xl border border-slate-200">
                          <p className="text-[9px] font-bold mb-3 text-slate-400 uppercase tracking-wider">Renk Kırılımı (Beyaz Katmanı +%5)</p>
                          <div className="flex flex-wrap gap-2">
                            {['Diğer', 'Beyaz'].map(color => (
                              <button key={color} onClick={() => setSelectedColor(color)} className={`px-5 py-2.5 rounded-lg font-bold text-xs transition-all border ${selectedColor === color ? 'bg-slate-800 text-white border-slate-800 shadow-sm' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}>{color}</button>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {[
                          { label: "Gövde Güç Durumu", field: "power", opts: ['Evet', 'Hayır'] },
                          { label: "Panel / Ekran Kondisyonu", field: "screen", opts: selectedBrand?.toLowerCase() === 'apple' ? ['Sağlam', 'Çizikler var', 'Kırık', 'Bilinmeyen Parça'] : ['Sağlam', 'Çizikler var', 'Kırık'] },
                          { label: "Kasa / Kozmetik Aşınma", field: "cosmetic", opts: ['Mükemmel', 'İyi', 'Kötü'] },
                          { label: "Biyometrik Sensör (Face ID / Touch ID)", field: "faceId", opts: ['Evet', 'Hayır'] },
                          { label: "Batarya Barem Sağlığı", field: "battery", opts: ['95-100', '85-95', '0-85', 'Bilinmeyen Parça'] },
                          { label: "Ses Akustik (Ahize / Buzzer)", field: "speaker", opts: ['Sağlam', 'Cızırtı var', 'Arızalı'] },
                          { label: "Şebeke Kayıt Modülü", field: "sim", opts: ['Fiziksel SIM (TR)', 'Fiziksel + eSIM (YD)'] },
                          { label: "Distribütör Garanti Durumu", field: "warranty", opts: ['Üretici Garantili', 'Yenilenmiş Cihaz', 'Garanti Yok'] }
                        ].map(q => (
                          <div key={q.field} className="bg-white p-4 rounded-xl border border-slate-200">
                            <p className="text-[9px] font-bold mb-2.5 text-slate-400 uppercase tracking-wider">{q.label}</p>
                            <div className="flex flex-wrap gap-1.5">
                              {q.opts.map((opt) => (
                                <button key={opt} onClick={() => setStatus({...status, [q.field]: opt})} className={`py-1.5 px-3 rounded text-xs font-bold border transition-all ${status[q.field] === opt ? 'bg-slate-800 text-white border-slate-800 shadow-sm' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}>{opt}</button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
              
              {/* ASYNC VALUE PRICING SYSTEM (RIGHT PANEL) */}
              <div className="lg:w-[320px] space-y-4 sticky top-28 h-fit">
                
                {appMode === 'servis' ? (
                  <div className="bg-white border border-slate-200 p-6 rounded-2xl space-y-4 shadow-sm text-center">
                      <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Müşteri Teklif Entegrasyonu</h3>
                      <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider leading-relaxed">Hesaplanan onarım matris verilerini direkt olarak şube mobil hattı üzerinden aboneye iletin.</p>
                      <button onClick={handleServisWhatsApp} className="w-full py-3 rounded-lg font-bold uppercase text-[10px] tracking-wider transition-all bg-[#25D366] text-white hover:bg-[#1CBA54] btn-click shadow-sm">
                          WhatsApp ile İlet
                      </button>
                  </div>
                ) : (
                  <>
                    <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-col items-center">
                       <img src={db.find(i => i.name === selectedModelName)?.img} className="h-24 object-contain mb-2" />
                       <h3 className="font-bold text-sm text-center text-slate-700 uppercase leading-tight">
                         {selectedModelName} {selectedCapacity?.cap} {selectedModelName === "iPhone 13" && selectedColor !== 'Diğer' ? `(${selectedColor})` : ''}
                       </h3>
                    </div>

                    {isYd ? (
                      <div className="bg-red-50 p-6 rounded-2xl border border-red-200 text-center">
                        <p className="text-xs font-bold uppercase tracking-wider text-red-700">Yurt Dışı Donanım Kısıtı</p>
                        <p className="text-[9px] mt-1.5 uppercase tracking-wider font-semibold text-red-500">Mevzuat gereği bu cihaz için yönetici onayı alınmalıdır.</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        
                        <div className="bg-white p-5 rounded-2xl border border-slate-200 text-center">
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-2">Net Nakit Alım Baremi</p>
                          <div className="text-2xl font-bold text-slate-800 font-mono tracking-tight">
                            {selectedCapacity && allSelected ? `${finalCashPrice.toLocaleString()} ₺` : '---'}
                          </div>
                          
                          {selectedCapacity && allSelected && !purchaseType && (
                            <div className="mt-2.5">
                              {!isCustomOfferActive ? (
                                <button onClick={() => setIsCustomOfferActive(true)} className="text-[9px] font-bold uppercase tracking-wider px-3 py-1 rounded border border-slate-200 text-slate-500 hover:bg-slate-50">
                                  Barem Revize
                                </button>
                              ) : (
                                <div className="flex items-center justify-center gap-1.5 animate-in fade-in duration-150">
                                    <input 
                                      type="number" 
                                      value={customOffer} 
                                      onChange={(e) => {
                                        const valStr = e.target.value;
                                        if (valStr === '') { setCustomOffer(''); return; }
                                        const val = parseInt(valStr) || 0;
                                        if (val > prices.cash) {
                                          alert(`Algoritma üst bareminden (${prices.cash} ₺) yüksek giriş yapılamaz!`);
                                          setCustomOffer(prices.cash.toString());
                                        } else { setCustomOffer(valStr); }
                                      }} 
                                      placeholder="Tutar" 
                                      className="w-24 p-1.5 bg-slate-50 border border-slate-200 rounded text-xs font-bold text-center outline-none"
                                    />
                                    <button onClick={() => {setIsCustomOfferActive(false); setCustomOffer('');}} className="bg-red-50 text-red-600 p-1.5 rounded hover:bg-red-100 transition-colors">
                                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        
                        <div className="bg-white p-5 rounded-2xl border border-slate-200 text-center border-l-4 border-l-blue-600">
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-2">Destekli Takas Baremi</p>
                          <div className="text-2xl font-bold text-blue-600 font-mono tracking-tight">
                            {selectedCapacity && allSelected ? `${finalTradePrice.toLocaleString()} ₺` : '---'}
                          </div>
                          
                          {selectedCapacity && allSelected && !purchaseType && (
                            <div className="mt-2.5">
                              {!isCustomTradeOfferActive ? (
                                <button onClick={() => setIsCustomTradeOfferActive(true)} className="text-[9px] font-bold uppercase tracking-wider px-3 py-1 rounded border border-slate-200 text-slate-500 hover:bg-slate-50">
                                  Takas Revize
                                </button>
                              ) : (
                                <div className="flex items-center justify-center gap-1.5 animate-in fade-in duration-150">
                                    <input 
                                      type="number" 
                                      value={customTradeOffer} 
                                      onChange={(e) => {
                                        const valStr = e.target.value;
                                        if (valStr === '') { setCustomTradeOffer(''); return; }
                                        const val = parseInt(valStr) || 0;
                                        if (val > calculatedTradePrice) {
                                          alert(`Takas havuz üst limitinden (${calculatedTradePrice} ₺) yüksek giriş yapılamaz!`);
                                          setCustomTradeOffer(calculatedTradePrice.toString());
                                        } else { setCustomTradeOffer(valStr); }
                                      }} 
                                      placeholder="Takas" 
                                      className="w-24 p-1.5 bg-slate-50 border border-slate-200 rounded text-xs font-bold text-center outline-none"
                                    />
                                    <button onClick={() => {setIsCustomTradeOfferActive(false); setCustomTradeOffer('');}} className="bg-red-50 text-red-600 p-1.5 rounded hover:bg-red-100 transition-colors">
                                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="bg-[#1E2022] p-5 rounded-2xl space-y-3 shadow-md">
                      <p className="text-[8px] font-bold text-white/40 uppercase tracking-widest text-center mb-1">Operasyonel Kayıt Onayı</p>
                      
                      <div className="flex gap-2">
                          <button 
                              disabled={!canProceed || purchaseType !== null} 
                              onClick={() => { setPurchaseType('NAKİT'); handleFinalProcess('NAKİT ALINDI'); }} 
                              className={`flex-1 py-2.5 rounded font-bold uppercase text-[10px] tracking-wider transition-all 
                              ${!canProceed || (purchaseType && purchaseType !== 'NAKİT') ? 'opacity-20 cursor-not-allowed bg-slate-800 text-slate-500' : ''} 
                              ${purchaseType === 'NAKİT' ? 'bg-emerald-600 text-white cursor-default' : 'bg-slate-800 text-slate-300 hover:bg-emerald-600 hover:text-white btn-click'}`}>
                              Nakit Onay
                          </button>
                          <button 
                              disabled={!canProceed || purchaseType !== null} 
                              onClick={() => { setPurchaseType('TAKAS'); handleFinalProcess('TAKAS ALINDI'); }} 
                              className={`flex-1 py-2.5 rounded font-bold uppercase text-[10px] tracking-wider transition-all 
                              ${!canProceed || (purchaseType && purchaseType !== 'TAKAS') ? 'opacity-20 cursor-not-allowed bg-slate-800 text-slate-500' : ''} 
                              ${purchaseType === 'TAKAS' ? 'bg-blue-600 text-white cursor-default' : 'bg-slate-800 text-slate-300 hover:bg-blue-600 hover:text-white btn-click'}`}>
                              Takas Onay
                          </button>
                      </div>
                      
                      <button 
                          disabled={!canProceed || purchaseType !== null} 
                          onClick={() => { setPurchaseType('ALINMADI'); handleFinalProcess('ALINMADI'); }} 
                          className={`w-full py-2 rounded font-bold uppercase text-[10px] tracking-wider transition-all 
                          ${!canProceed || (purchaseType && purchaseType !== 'ALINMADI') ? 'opacity-20 cursor-not-allowed bg-slate-800 text-slate-500' : ''} 
                          ${purchaseType === 'ALINMADI' ? 'bg-rose-600 text-white cursor-default' : 'bg-slate-800 text-rose-400 hover:bg-rose-600 hover:text-white btn-click'}`}>
                          Müşteri İptal / Alınmadı
                      </button>

                      <div className={`pt-4 mt-3 border-t border-white/5 space-y-2 transition-all duration-300 ${showDocs ? 'opacity-100' : 'opacity-10 pointer-events-none'}`}>
                          <p className="text-[8px] font-bold text-white/40 uppercase tracking-widest text-center">Entegrasyon Çıktıları</p>
                          <div className="flex gap-2">
                            <button disabled={!showDocs} onClick={() => handleFinalProcess('print')} className="flex-1 py-2.5 rounded font-bold uppercase text-[10px] bg-white text-slate-900 hover:bg-slate-200 btn-click shadow-sm">
                              Yazdır
                            </button>
                            <button disabled={!showDocs} onClick={() => handleFinalProcess('whatsapp')} className="flex-1 py-2.5 rounded font-bold uppercase text-[10px] bg-[#25D366] text-white hover:bg-[#1CBA54] btn-click shadow-sm">
                              WhatsApp
                            </button>
                          </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
              
            </div>
          )}
        </main>
      </div>

      <footer className="mt-auto w-full border-t border-slate-200 py-4 text-center print:hidden bg-white/40">
         <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{isZumay ? 'ZUMAY BANK NODE INTEGRATION v6.0.0' : 'CNETMOBIL • HARDWARE CORE ENGINE v6.0.0'}</p>
      </footer>

      {/* TOAST SYSTEM CONTAINER */}
      <div className="fixed top-20 right-4 z-[200] flex flex-col gap-2 pointer-events-none print:hidden">
        {toastMessages.map((toast) => (
          <div key={toast.id} className={`animate-in slide-in-from-right-4 duration-200 rounded-lg shadow-md p-3 border flex items-center gap-2.5 backdrop-blur-md text-white ${toast.type === 'new' ? 'bg-emerald-600/95 border-emerald-500' : 'bg-blue-600/95 border-blue-500'}`}>
            <div>
              <p className="text-[8px] font-bold uppercase tracking-wider opacity-75">{toast.type === 'new' ? 'Altyapı Akışı' : 'Barem Güncelleme'}</p>
              <p className="font-semibold text-xs mt-0.5 max-w-[220px]">{toast.text}</p>
            </div>
          </div>
        ))}
      </div>

      {/* RE-ENGINEERED TAILORED INSTALLMENT MATRIX MODAL */}
      {isInstallmentModalOpen && !isZumay && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm print:hidden p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-3xl relative animate-in zoom-in-95 duration-150 border border-slate-200 flex flex-col max-h-[85vh]">
            <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-3 shrink-0">
              <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Mevzuat Taksit Matris Dağılımı</h2>
              <button onClick={() => { setIsInstallmentModalOpen(false); setInstallmentAmount(''); }} className="bg-slate-100 p-2 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all btn-click">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <div className="mb-4 shrink-0 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 focus-within:border-blue-500 transition-all">
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider ml-1">Müşteri Tanımı</label>
                  <input type="text" placeholder="Ad Soyad" value={customer.name} onChange={(e) => setCustomer({...customer, name: e.target.value})} className="w-full mt-1 bg-transparent text-xs font-bold outline-none text-slate-800 uppercase" />
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 focus-within:border-blue-500 transition-all">
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider ml-1">Mobil İletişim Numarası</label>
                  <input type="text" placeholder="Telefon" value={customer.phone} onChange={(e) => setCustomer({...customer, phone: e.target.value})} className="w-full mt-1 bg-transparent text-xs font-bold outline-none text-slate-800" />
                </div>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <span className="text-slate-400 font-bold text-base">₺</span>
                </div>
                <input type="number" placeholder="Matris İşlem Tutarını Giriniz..." value={installmentAmount} onChange={(e) => setInstallmentAmount(e.target.value)} className="w-full py-3.5 pl-9 pr-4 bg-slate-50 rounded-xl text-lg font-bold border border-slate-200 outline-none focus:bg-white focus:border-blue-500 transition-all text-slate-800" />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 pb-2">
              {installmentAmount && Number(installmentAmount) > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {[
                    { month: 2, rate: 7.83 }, { month: 3, rate: 10.05 }, { month: 4, rate: 12.36 }, { month: 5, rate: 14.76 },
                    { month: 6, rate: 17.55 }, { month: 7, rate: 20.19 }, { month: 8, rate: 22.96 }, { month: 9, rate: 25.85 },
                    { month: 10, rate: 28.88 }, { month: 11, rate: 32.07 }, { month: 12, rate: 35.41 },
                  ].map((inst) => {
                    const multiplier = 1 + (inst.rate / 100);
                    const total = Number(installmentAmount) * multiplier;
                    const monthly = total / inst.month;
                    
                    return (
                      <div key={inst.month} className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm group">
                        <div className="flex items-center gap-3">
                          <div className="bg-slate-900 group-hover:bg-blue-600 transition-colors text-white w-10 h-10 flex flex-col items-center justify-center rounded font-mono shrink-0">
                            <span className="font-bold text-base leading-none">{inst.month}</span>
                            <span className="text-[7px] font-bold uppercase mt-0.5 opacity-60">Ayk</span>
                          </div>
                          <div>
                            <div className="text-base font-bold text-slate-800 font-mono tracking-tight">
                              {monthly.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 border-l border-slate-100 pl-3">
                          <div className="text-right hidden sm:block">
                            <div className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Toplam</div>
                            <div className="text-xs font-bold text-slate-600 font-mono">{total.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺</div>
                          </div>
                          <button onClick={() => handleSendInstallmentToWhatsApp(inst.month, total)} className="bg-[#25D366] hover:bg-[#1CBA54] text-white w-8 h-8 rounded flex items-center justify-center transition-all btn-click shrink-0">
                            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-8 text-center text-slate-400 font-semibold uppercase tracking-wider text-xs">
                  Hesaplama için yukarıya geçerli bir barem tutarı giriniz
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ADMINISTRATIVE DIAGNOSTIC LOOKUP MODAL */}
      {ekspertizModalData && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 print:hidden">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-xl border border-slate-200 flex flex-col animate-in zoom-in-95 duration-150">
             <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-3 shrink-0">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Kayıtlı Ekspertiz Parametreleri</h3>
                  <p className="text-[10px] text-slate-400 font-semibold tracking-wider mt-0.5 uppercase truncate max-w-md">{ekspertizModalData.customer} - {ekspertizModalData.device}</p>
                </div>
                <button onClick={() => setEkspertizModalData(null)} className="text-slate-400 hover:text-red-500 hover:bg-red-50 bg-slate-50 border border-slate-200 p-2 rounded transition-colors btn-click">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
             </div>
             
             <div className="grid grid-cols-2 gap-3 overflow-y-auto custom-scrollbar pr-1 max-h-[50vh]">
                {ekspertizModalData.data.split(' | ').map((detail, idx) => {
                    if(!detail.includes(':')) return null;
                    const [key, val] = detail.split(':');
                    
                    let valColor = "text-slate-700";
                    if (['Mükemmel', 'Sağlam', 'Evet', '95-100', 'Fiziksel SIM (TR)', 'Üretici Garantili'].includes(val)) valColor = "text-emerald-600";
                    else if (['Kötü', 'Kırık', 'Bilinmeyen Parça', 'Hayır', 'Arızalı', 'Garanti Yok'].includes(val)) valColor = "text-rose-600";
                    else if (['İyi', 'Çizikler var', 'Cızırtı var'].includes(val)) valColor = "text-amber-600";

                    return (
                        <div key={idx} className="bg-slate-50 border border-slate-200 p-3 rounded-lg flex flex-col gap-1">
                            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">{key}</span>
                            <span className={`text-xs font-bold uppercase tracking-tight ${valColor}`}>{val}</span>
                        </div>
                    )
                })}
             </div>
          </div>
        </div>
      )}

      {/* HARD COPY PRINT LAYER */}
      {appMode === 'alim' && (
        <div id="print-area">
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'20px'}}>
              <div>
                <h1 style={{fontSize:'36px', fontWeight:'900', fontStyle:'italic', margin:0, letterSpacing:'-2px'}}>
                  {isZumay ? <span style={{color:'#dc2626'}}>ZUMAY</span> : <>CNETMOBIL <span style={{color:'#2563eb'}}>CMR</span></>}
                </h1>
                <p style={{fontSize:'10px', fontWeight:'bold', textTransform:'uppercase', margin:0, color:'#666', letterSpacing:'1px'}}>
                  {isZumay ? 'Zumay Cihaz Alım Formu' : 'Kurumsal Cihaz Alim Merkezi'}
                </p>
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
              <div style={{borderTop:'2px solid black', paddingTop:'10px', fontWeight:'900', fontSize:'12px', textTransform:'uppercase', fontStyle:'italic'}}>{isZumay ? 'ZUMAY YETKİLİ' : 'CNETMOBIL YETKİLİ'}</div>
            </div>
        </div>
      )}
    </div>
  );
}
