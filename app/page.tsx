"use client";
import React, { useState, useEffect } from 'react';
import AnaSayfa from './AnaSayfa';
import YoneticiPaneli from './components/YoneticiPaneli';

const TABLO_ISMI = 'Google Sheets ile Kurumsal Alım Sistemi'; 
const SCRIPT_URL = process.env.NEXT_PUBLIC_SCRIPT_URL as string;

const IP_HARITASI: any = {
  "78.188.91.172": "CMR SARAY",
  "46.197.253.131": "CMR KAPAKLI",
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

const loadData = async () => {
    try {
      const res = await fetch('/api/sheets', { cache: 'no-store' });
      const responseData = await res.json();
      const decodedString = decodeURIComponent(escape(window.atob(responseData.payload)));
      const allData = JSON.parse(decodedString);

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
      console.error("Veri tünelinde veya maske çözmede hata oluştu:", e);
      setLoading(false);
    }
  };

 useEffect(() => { 
  loadData(); 
  const intervalId = setInterval(() => { loadData(); }, 45000); 
  const handleFocus = () => { loadData(); };
  window.addEventListener('focus', handleFocus);
  return () => { clearInterval(intervalId); window.removeEventListener('focus', handleFocus); };
}, [step]);

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
      setTimeout(loadData, 1500);
    } catch (e) { console.error(e); }
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
        { id: 'kampanya_sifir', label: 'Sıfır Liste', visible: selectedBranch !== 'VODAFONE KANALI' && !isZumay },
        { id: 'ikinci_el', label: '2. El Listesi', visible: selectedBranch !== 'VODAFONE KANALI' && !isZumay },
        { id: 'imei_list', label: 'Depo', visible: selectedBranch === 'VODAFONE KANALI' && !isZumay }
      ]
    }
  ];

  const isYd = status.sim === 'Fiziksel + eSIM (YD)';
  const allSelected = Object.values(status).every(v => v !== null) && selectedCapacity;
  const canProceed = allSelected;
  const showDocs = purchaseType === 'NAKİT' || purchaseType === 'TAKAS';

  const isDarkAppMode = appMode === 'cep_tablet' || appMode === 'yna_list' || appMode === 'dis_kanal' || appMode === 'ikinci_el' || appMode === 'imei_list' || appMode === 'kampanya_sifir' || step === 99;

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
    <div className="h-screen flex flex-col items-center justify-center bg-slate-900 space-y-4">
      <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      <div className="font-black text-white italic uppercase tracking-[0.3em]">OTURUM KONTROL EDİLİYOR...</div>
    </div>
  );

  if (loading && isLoggedIn) return (
    <div className="h-screen flex flex-col items-center justify-center bg-white space-y-4">
      <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      <div className="font-black text-slate-900 italic uppercase tracking-[0.3em]">SİSTEM YÜKLENİYOR...</div>
    </div>
  );

  if (!isLoggedIn) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-slate-900 text-white font-sans p-6">
        <div className="w-full max-w-sm bg-slate-800 p-10 rounded-[48px] shadow-2xl border border-slate-700 text-center animate-in fade-in zoom-in duration-500">
           <div className="bg-slate-700 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-xl">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 00-2 2v6a2 2 0 00-2 2v6a2 2 0 00-2 2zM9 11V7a3 3 0 016 0v4" /></svg>
           </div>
           <h1 className="text-2xl font-black italic uppercase mb-8">BAYİ <span className="text-blue-500">GİRİŞİ</span></h1>
           
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
             className="w-full py-6 bg-blue-600 text-white rounded-2xl font-black uppercase text-sm shadow-xl hover:bg-blue-500 active:scale-95 transition-all disabled:opacity-50 tracking-widest"
           >
             {loginLoading ? 'KONTROL EDİLİYOR...' : 'SİSTEMİ AÇ'}
           </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col min-h-screen font-sans selection:bg-blue-100 transition-colors duration-500 ${isDarkAppMode ? 'bg-[#111111] text-white' : appMode === 'servis' ? 'bg-[#FFF8F1] text-orange-950' : 'bg-[#F8FAFC] text-slate-900'}`}>
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
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      {/* YENİ ÜST MENÜ (PARTNER TOPBAR) */}
      <nav className={`sticky top-0 z-[100] w-full border-b shadow-lg backdrop-blur-md print:hidden transition-all duration-300 ${isZumay ? 'bg-red-950 border-red-900/50' : 'bg-white/95 border-slate-200'}`}>
        <div className="max-w-[1600px] mx-auto px-4 lg:px-6 h-20 flex items-center justify-between">
          
          {/* LOGO BÖLÜMÜ */}
          <div onClick={() => { resetAll(); setAppMode('ana_sayfa'); }} className="flex items-center gap-3 cursor-pointer shrink-0">
             <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-white shadow-lg ${isZumay ? 'bg-red-600' : 'bg-[#0052D4]'}`}>
               C
             </div>
             <div className="hidden lg:block">
               <h1 className={`text-xl font-black italic tracking-tighter uppercase leading-none ${isZumay ? 'text-white' : 'text-slate-900'}`}>
                 {isZumay ? 'ZUMAY' : <>CNET<span className="text-[#0052D4]">MOBIL</span></>}
               </h1>
               <p className={`text-[9px] font-bold tracking-[0.3em] uppercase ${isZumay ? 'text-white/50' : 'text-slate-500'}`}>Partner Portal</p>
             </div>
          </div>

          {/* MENÜ (Yatay Kaydırılabilir) */}
          <div className="flex-1 flex items-center justify-start lg:justify-center overflow-x-auto no-scrollbar px-4 lg:px-10 gap-2">
             {step < 99 && menuGroups.flatMap(g => g.items).filter(i => i.visible).map((item) => (
               <button
                 key={item.id}
                 onClick={() => { setAppMode(item.id as any); setStep(1); resetSelection(); }}
                 className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-[11px] lg:text-[12px] font-black transition-all whitespace-nowrap border
                   ${appMode === item.id 
                     ? (isZumay ? 'bg-red-600 border-red-500 text-white shadow-lg shadow-red-900/40' : 'bg-[#0052D4] border-[#0052D4] text-white shadow-lg shadow-blue-900/40') 
                     : (isZumay ? 'text-slate-300 border-transparent hover:text-white hover:bg-white/10' : 'text-slate-500 border-transparent hover:text-slate-900 hover:bg-slate-100')
                   }`}
               >
                 {item.label}
               </button>
             ))}
             {step === 99 && <span className="text-emerald-500 font-black italic text-xs animate-pulse">YÖNETİCİ PANELİ AKTİF</span>}
          </div>

          {/* SAĞ TARAF (KULLANICI VE BUTONLAR) */}
          <div className="flex items-center gap-3 shrink-0">
             {!isZumay && step < 99 && (
               <button onClick={() => setIsInstallmentModalOpen(true)} className="hidden xl:flex items-center gap-2 px-4 py-2.5 bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 rounded-xl hover:bg-emerald-500 hover:text-white transition-all text-[10px] font-bold uppercase">
                  TAKSİT
               </button>
             )}
             
             <div className={`hidden md:flex flex-col items-end border-r pr-4 ${isZumay ? 'border-white/10' : 'border-slate-200'}`}>
               <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Aktif Terminal</span>
               {isMasterAccess ? (
                  <select value={selectedBranch} onChange={(e) => setSelectedBranch(e.target.value)} className={`bg-transparent text-[11px] font-black outline-none cursor-pointer text-right appearance-none ${isZumay ? 'text-white' : 'text-slate-900'}`}>
                    {branches.map(b => <option key={b.name} value={b.name} className="text-slate-900">{b.name}</option>)}
                  </select>
               ) : (
                  <span className={`text-[11px] font-black uppercase italic truncate max-w-[120px] ${isZumay ? 'text-white' : 'text-slate-900'}`}>{selectedBranch}</span>
               )}
             </div>
             
             <div className="flex items-center gap-2">
               {isAdmin && step < 99 && (
                 <button onClick={() => setStep(99)} title="Yönetici Paneli" className="p-2.5 bg-slate-100 text-slate-500 rounded-xl hover:bg-emerald-500 hover:text-white transition-all">
                   <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                 </button>
               )}
               <button onClick={handleLogout} title="Çıkış Yap" className="p-2.5 bg-red-50 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all">
                 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
               </button>
             </div>
          </div>
        </div>
      </nav>

      {/* ANA İÇERİK ALANI */}
      <div className="flex-1 w-full min-w-0 flex flex-col relative">
        <main className="max-w-[1600px] mx-auto w-full p-4 sm:p-6 lg:p-10 print:hidden">
  
          {appMode === 'ana_sayfa' && step < 99 ? (
              isZumay ? (
                 <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-8 animate-in fade-in zoom-in duration-500 px-4">
                    <div className="w-24 h-24 bg-red-600 rounded-3xl flex items-center justify-center shadow-2xl shadow-red-500/30 text-white text-5xl font-black italic">Z</div>
                    <h2 className="text-4xl md:text-5xl font-black italic tracking-tighter text-white uppercase text-center">
                       ZUMAY <span className="text-red-600">BAYİ PORTALI</span>
                    </h2>
                    <p className="text-slate-400 font-bold tracking-widest uppercase text-xs text-center max-w-md">
                       Cihaz alım ve dış kanal satın alma işlemlerinizi üst menüden yönetebilirsiniz.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 mt-8 w-full sm:w-auto">
                       <button onClick={() => {setAppMode('alim'); setStep(1);}} className="bg-red-600 hover:bg-red-700 text-white px-8 py-5 rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-red-600/20 transition-all active:scale-95 text-xs sm:text-sm">
                          CİHAZ ALIMI YAP
                       </button>
                       <button onClick={() => {setAppMode('dis_kanal'); setStep(1);}} className="bg-slate-800 hover:bg-slate-700 text-white px-8 py-5 rounded-2xl font-black uppercase tracking-widest shadow-lg transition-all active:scale-95 text-xs sm:text-sm">
                          DIŞ KANAL LİSTESİ
                       </button>
                    </div>
                 </div>
              ) : (
                 <AnaSayfa selectedBranch={selectedBranch} setAppMode={setAppMode} config={config} />
              )
          ) : appMode === 'imei_list' && step < 99 ? (
            <div className="bg-[#1e1e2d] p-6 sm:p-10 rounded-[48px] shadow-2xl border border-slate-800 text-white animate-in fade-in duration-500">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 border-b border-slate-700 pb-6 gap-4">
                  <div>
                    <h2 className="text-3xl font-black italic tracking-tighter text-[#f39c12]">DEPO</h2>
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
                  </div>
                </div>
              </div>
            </div>
          ) :

          appMode === 'kampanya_sifir' && step < 99 ? (
            <div className="bg-[#1e1e2d] p-6 sm:p-10 rounded-[48px] shadow-2xl border border-slate-800 text-white animate-in fade-in duration-500">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 border-b border-slate-700 pb-6 gap-4">
                  <div>
                    <h2 className="text-3xl font-black italic tracking-tighter text-[#e74c3c]">KAMPANYALI SIFIR LİSTE</h2>
                    <p className="text-[10px] text-slate-400 font-bold tracking-widest mt-1 uppercase">Sıfır Kampanyalı Cihaz Fiyatları</p>
                  </div>
                  <div className="bg-[#2a2a3d] border border-slate-700 p-3 rounded-2xl flex items-center w-full md:w-80">
                    <svg className="w-5 h-5 text-slate-400 mr-2 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    <input type="text" placeholder="Ürün Arama..." className="bg-transparent border-none outline-none text-sm text-white w-full" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                  </div>
              </div>

              <div className="max-w-5xl mx-auto overflow-x-auto custom-scrollbar pb-2">
                <div className="min-w-[500px]">
                  <div className="bg-[#c0392b] px-4 py-3 rounded-t-2xl flex font-black text-[10px] tracking-widest text-white items-center shadow-lg">
                    <div className="flex-[3]">ÜRÜN ADI</div>
                    <div className="flex-1 text-right">FİYATI (TL)</div>
                  </div>
                  <div className="bg-[#2a2a3d] rounded-b-2xl overflow-hidden shadow-inner border-x border-b border-slate-700">
                    {cepTabletData.slice(1).filter(r => r[10] && r[10].trim() !== '' && r[10].toLowerCase().includes(searchQuery.toLowerCase())).map((row, i) => {
                        const cellName = (row[10] || '').toUpperCase();
                        const isHighlighted = cellName.includes('BOMBA') || cellName.includes('KAMPANYA') || cellName.includes('İNDİRİM');
                        return (
                        <div key={i} className={`flex px-4 py-3 border-b border-slate-600/60 hover:bg-white/10 transition-colors text-[11px] sm:text-xs font-bold items-center group ${isHighlighted ? 'bg-yellow-500/10' : i % 2 === 0 ? 'bg-white/[0.02]' : ''}`}>
                          <div className={`flex-[3] flex items-center ${isHighlighted ? 'text-yellow-400' : 'text-slate-300'} group-hover:text-white transition-colors pr-4 break-words`}>
                              {isHighlighted && <span className="w-1.5 h-1.5 bg-yellow-400 rounded-full animate-ping mr-2 shrink-0"></span>}
                              {row[10]}
                          </div>
                          <div className={`flex-1 text-right font-black text-sm whitespace-nowrap ${isHighlighted ? 'text-yellow-400' : 'text-white'}`}>{row[11] || '-'}</div>
                        </div>
                    )})}
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
                        const isHighlighted = cellName.includes('BOMBA') || cellName.includes('KAMPANYA');
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
                  </div>
                </div>
              </div>
            </div>
          ) :

          appMode === 'dis_kanal' && step < 99 ? (
            <div className="bg-[#1e1e2d] p-6 sm:p-10 rounded-[48px] shadow-2xl border border-slate-800 text-white animate-in fade-in duration-500">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 border-b border-slate-700 pb-6 gap-4">
                  <div>
                    <h2 className={`text-3xl font-black italic tracking-tighter ${isZumay ? 'text-red-500' : 'text-[#1abc9c]'}`}>DIŞ KANAL SATIN ALMA</h2>
                    <p className="text-[10px] text-slate-400 font-bold tracking-widest mt-1 uppercase">Dış Kanal Ürün ve Fiyat Listesi</p>
                  </div>
                  <div className="bg-[#2a2a3d] border border-slate-700 p-3 rounded-2xl flex items-center w-full md:w-80">
                    <svg className="w-5 h-5 text-slate-400 mr-2 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    <input type="text" placeholder="Ürün Arama..." className="bg-transparent border-none outline-none text-sm text-white w-full" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                  </div>
              </div>
              
              <div className="max-w-5xl mx-auto overflow-x-auto custom-scrollbar pb-2">
                <div className="min-w-[500px]">
                  <div className={`${isZumay ? 'bg-red-700' : 'bg-[#16a085]'} px-4 py-3 rounded-t-2xl flex font-black text-[10px] tracking-widest text-white items-center shadow-lg`}>
                    <div className="flex-[3]">ÜRÜN / CİHAZ ADI</div>
                    <div className="flex-1 text-center">FİYATI (TL)</div>
                    <div className="flex-[2] text-right">DURUM / BİLGİ</div>
                  </div>
                  <div className="bg-[#2a2a3d] rounded-b-2xl overflow-hidden shadow-inner border-x border-b border-slate-700">
                    {disKanalData.slice(1).filter(r => r[0] && r[0].toLowerCase().includes(searchQuery.toLowerCase())).map((row, i) => {
                        const cellName = (row[0] || '').toUpperCase();
                        const isHighlighted = cellName.includes('BOMBA') || cellName.includes('KAMPANYA');
                        return (
                        <div key={i} className={`flex px-4 py-3 border-b border-slate-600/60 hover:bg-white/10 transition-colors text-[11px] sm:text-xs font-bold items-center group ${isHighlighted ? (isZumay ? 'bg-red-500/10' : 'bg-yellow-500/10') : i % 2 === 0 ? 'bg-white/[0.02]' : ''}`}>
                          <div className={`flex-[3] flex items-center ${isHighlighted ? (isZumay ? 'text-red-400' : 'text-yellow-400') : 'text-slate-300'} group-hover:text-white transition-colors pr-4 break-words`}>
                              {isHighlighted && <span className={`w-1.5 h-1.5 rounded-full animate-ping mr-2 shrink-0 ${isZumay ? 'bg-red-400' : 'bg-yellow-400'}`}></span>}
                              {row[0]}
                          </div>
                          <div className={`flex-1 text-center font-black text-sm whitespace-nowrap ${isHighlighted ? (isZumay ? 'text-red-400' : 'text-yellow-400') : 'text-white'}`}>{row[1] || '-'}</div>
                          <div className={`flex-[2] text-right text-slate-400 break-words pl-2`}>{row[2] || '-'}</div>
                        </div>
                    )})}
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
                          const isHighlighted = cellName.includes('BOMBA') || cellName.includes('KAMPANYA');
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
                    </div>
                  </div>
                </div>
                
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
                          const isHighlighted = cellName.includes('BOMBA') || cellName.includes('KAMPANYA');
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
                <div className="overflow-x-auto custom-scrollbar pb-2">
                  <div className="min-w-[350px]">
                    <div className="bg-[#8e44ad] px-4 py-3 rounded-t-2xl flex font-black text-[10px] tracking-widest text-white items-center shadow-lg">
                      <div className="flex-[3]">ÜRÜN ADI</div>
                      <div className="flex-1 text-right">FİYATI (TL)</div>
                    </div>
                    <div className="bg-[#2a2a3d] rounded-b-2xl overflow-hidden shadow-inner border-x border-b border-slate-700">
                      {ynaData.slice(1).filter(r => r[0] && r[0].toLowerCase().includes(searchQuery.toLowerCase())).map((row, i) => {
                          const cellName = (row[0] || '').toUpperCase();
                          const isHighlighted = cellName.includes('BOMBA');
                          return (
                          <div key={i} className={`flex px-4 py-2 border-b border-slate-600/60 hover:bg-white/10 transition-colors text-[11px] sm:text-xs font-bold items-center group ${isHighlighted ? 'bg-yellow-500/10' : i % 2 === 0 ? 'bg-white/[0.02]' : ''}`}>
                            <div className={`flex-[3] flex items-center ${isHighlighted ? 'text-yellow-400' : 'text-slate-300'} group-hover:text-white transition-colors pr-4 break-words`}>
                                {isHighlighted && <span className="w-1.5 h-1.5 bg-yellow-400 rounded-full animate-ping mr-2 shrink-0"></span>}
                                {row[0]}
                            </div>
                            <div className={`flex-1 text-right font-black text-sm whitespace-nowrap ${isHighlighted ? 'text-yellow-400' : 'text-white'}`}>{row[1] || '-'}</div>
                          </div>
                      )})}
                    </div>
                  </div>
                </div>
                
                <div className="overflow-x-auto custom-scrollbar pb-2">
                  <div className="min-w-[350px]">
                    <div className="bg-[#8e44ad] px-4 py-3 rounded-t-2xl flex font-black text-[10px] tracking-widest text-white items-center shadow-lg">
                      <div className="flex-[3]">ÜRÜN ADI</div>
                      <div className="flex-1 text-right">FİYATI (TL)</div>
                    </div>
                    <div className="bg-[#2a2a3d] rounded-b-2xl overflow-hidden shadow-inner border-x border-b border-slate-700">
                      {ynaData.slice(1).filter(r => r[3] && r[3].toLowerCase().includes(searchQuery.toLowerCase())).map((row, i) => {
                          const cellName = (row[3] || '').toUpperCase();
                          const isHighlighted = cellName.includes('BOMBA');
                          return (
                          <div key={i} className={`flex px-4 py-2 border-b border-slate-600/60 hover:bg-white/10 transition-colors text-[11px] sm:text-xs font-bold items-center group ${isHighlighted ? 'bg-yellow-500/10' : i % 2 === 0 ? 'bg-white/[0.02]' : ''}`}>
                            <div className={`flex-[3] flex items-center ${isHighlighted ? 'text-yellow-400' : 'text-slate-300'} group-hover:text-white transition-colors pr-4 break-words`}>
                                {isHighlighted && <span className="w-1.5 h-1.5 bg-yellow-400 rounded-full animate-ping mr-2 shrink-0"></span>}
                                {row[3]}
                            </div>
                            <div className={`flex-1 text-right font-black text-sm whitespace-nowrap ${isHighlighted ? 'text-yellow-400' : 'text-white'}`}>{row[4] || '-'}</div>
                          </div>
                      )})}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) :
          
          /* YÖNETİCİ GÖRÜNÜMÜ - ÜST KONTROL BAR EKLENDİ */
          step === 99 ? (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              
              {/* YENİ YATAY FİLTRE BARI (Sidebar'dan alınan kontroller) */}
              {isAdmin && (
                <div className="mb-6 bg-[#1e1e2d] border border-slate-700/50 p-4 rounded-[28px] shadow-2xl flex flex-col md:flex-row gap-4 items-center justify-between">
                   <div className="flex items-center gap-3 w-full md:w-auto overflow-x-auto no-scrollbar">
                      {/* ŞUBE FİLTRESİ */}
                      <select value={adminSelectedBranch} onChange={(e) => setAdminSelectedBranch(e.target.value)} className="bg-[#2a2a3d] text-white text-[10px] uppercase font-black tracking-widest p-3 rounded-xl outline-none border border-slate-600 min-w-[150px]">
                        <option value="TÜM ŞUBELER">TÜM ŞUBELER</option>
                        {branches.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
                      </select>
                      {/* TARİH FİLTRESİ */}
                      <select value={dateFilterType} onChange={(e) => setDateFilterType(e.target.value)} className="bg-[#2a2a3d] text-white text-[10px] uppercase font-black tracking-widest p-3 rounded-xl outline-none border border-slate-600 min-w-[150px]">
                         <option value="TÜM ZAMANLAR">TÜM ZAMANLAR</option>
                         <option value="BUGÜN">BUGÜN</option>
                         <option value="DÜN">DÜN</option>
                         <option value="ÖNCEKİ GÜN">ÖNCEKİ GÜN</option>
                         <option value="ÖZEL">ÖZEL</option>
                      </select>

                      {/* ÖZEL TARİH SEÇİMİ */}
                      {dateFilterType === 'ÖZEL' && (
                        <div className="flex items-center gap-2">
                           <input type="date" value={customStartDate} onChange={(e) => setCustomStartDate(e.target.value)} className="bg-[#2a2a3d] text-slate-300 text-xs p-3 rounded-xl border border-slate-600 outline-none focus:border-emerald-500" />
                           <input type="date" value={customEndDate} onChange={(e) => setCustomEndDate(e.target.value)} className="bg-[#2a2a3d] text-slate-300 text-xs p-3 rounded-xl border border-slate-600 outline-none focus:border-emerald-500" />
                        </div>
                      )}
                   </div>

                   <button onClick={() => {setStep(1); setIsAdmin(false); if(isMasterAccess) handleLogout();}} className="bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white px-6 py-3 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all border border-red-500/20 whitespace-nowrap w-full md:w-auto shrink-0 flex items-center justify-center gap-2 btn-click">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      PANELİ KAPAT
                   </button>
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
            <div className="space-y-12 text-slate-900 max-w-[1200px] mx-auto">
              <div className="text-center space-y-4 mb-16 animate-in fade-in slide-in-from-top-4 duration-700 mt-10">
                  <h2 className="text-4xl md:text-6xl font-black italic tracking-tighter uppercase">
                    {appMode === 'alim' ? (
                      <span className="text-slate-900">CIHAZ <span className={isZumay ? 'text-red-600' : 'text-[#0052D4]'}>ALIM</span> SISTEMI</span>
                    ) : (
                      <span className="text-orange-950">TEKNIK <span className="text-orange-600">SERVIS</span> MERKEZI</span>
                    )}
                  </h2>
                  <p className={`font-bold uppercase tracking-[0.2em] text-xs ${appMode === 'servis' ? 'text-orange-800/60' : 'text-slate-400'}`}>Lütfen işlem yapılacak markayı seçin</p>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 animate-in fade-in zoom-in duration-700 delay-200">
                {displayBrands.map(brand => {
                  const brandInfo = brandDb.find(b => b.name === brand);
                  const finalLogo = brandInfo?.logo || brandAssets[brand]?.logo || "";

                  return (
                    <div key={brand} 
                          onClick={() => {
                            setSelectedBrand(brand); 
                            setStep(2); 
                            resetSelection();
                          }} 
                          className={`bg-white p-8 rounded-[40px] shadow-sm border flex flex-col items-center justify-center text-center h-64 group transition-all hover:-translate-y-2 hover:shadow-xl cursor-pointer btn-click ${appMode === 'servis' ? 'border-orange-100/50 hover:shadow-orange-200/50' : 'border-slate-100 hover:border-slate-200'}`}>
                      <div className="h-24 w-full flex items-center justify-center mb-6 transition-all duration-500 transform group-hover:scale-110">
                        <img src={finalLogo} className="max-h-full max-w-[120px] object-contain" alt={brand} />
                      </div>
                      <h2 className={`font-black text-xl mb-1 uppercase italic tracking-tighter ${appMode === 'servis' ? 'text-orange-950' : 'text-slate-800'}`}>{brand}</h2>
                      <p className={`text-[9px] font-black uppercase tracking-widest ${appMode === 'servis' ? 'text-orange-400' : 'text-slate-400'}`}>
                          {appMode === 'servis' ? 'SERVİS İŞLEMLERİ' : `${brand} CİHAZINI SAT`}
                      </p>
                      
                      <div className={`w-10 h-1 transition-all rounded-full mt-4 ${appMode === 'servis' ? 'bg-orange-100 group-hover:w-16 group-hover:bg-orange-500' : (isZumay ? 'bg-slate-100 group-hover:w-16 group-hover:bg-red-600' : 'bg-slate-100 group-hover:w-16 group-hover:bg-[#0052D4]')}`}></div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : step === 2 ? (
            <div className="animate-in slide-in-from-right-8 duration-500 text-slate-900 max-w-[1400px] mx-auto">
              <div className="flex items-center justify-between mb-8 mt-4">
                  <button onClick={() => {setStep(1); resetSelection();}} className={`bg-white shadow-sm border px-6 py-3 rounded-2xl text-[10px] font-black uppercase transition-all btn-click flex items-center gap-2 ${appMode === 'servis' ? 'border-orange-200 text-orange-600 hover:text-orange-800' : (isZumay ? 'border-slate-200 text-slate-500 hover:text-red-600' : 'border-slate-200 text-slate-500 hover:text-[#0052D4]')}`}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg>
                    Geri Dön
                  </button>
                  <div className="text-right">
                    <span className={`text-[10px] font-black uppercase tracking-widest ${appMode === 'servis' ? 'text-orange-600' : (isZumay ? 'text-red-600' : 'text-[#0052D4]')}`}>{selectedBrand}</span>
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
                    className={`w-full p-5 pl-14 bg-white rounded-full text-sm font-black border outline-none focus:ring-4 shadow-sm transition-all placeholder-opacity-50 ${appMode === 'servis' ? 'border-orange-200 focus:border-orange-500 focus:ring-orange-50 text-orange-950 placeholder-orange-300' : (isZumay ? 'border-slate-200 focus:border-red-500 focus:ring-red-50 text-slate-700 placeholder-slate-400' : 'border-slate-200 focus:border-[#0052D4] focus:ring-blue-50 text-slate-700 placeholder-slate-400')}`}
                  />
                  <svg className={`w-6 h-6 absolute left-5 top-1/2 -translate-y-1/2 ${appMode === 'servis' ? 'text-orange-300' : 'text-slate-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
                {Array.from(new Set(db.filter(i => i.brand === selectedBrand).map(i => i.name)))
                  .filter(name => name.toLowerCase().includes(searchQuery.toLowerCase()))
                  .map(name => (
                    <div key={name} onClick={() => {setSelectedModelName(name); setStep(3); resetSelection();}} className={`bg-white p-6 rounded-[32px] shadow-sm cursor-pointer border-2 border-transparent transition-all text-center btn-click group flex flex-col items-center justify-between min-h-[220px] ${appMode === 'servis' ? 'hover:shadow-xl hover:shadow-orange-100 hover:border-orange-400/50' : (isZumay ? 'hover:shadow-xl hover:border-red-500/50' : 'hover:shadow-xl hover:border-[#0052D4]/50')}`}>
                      <div className="h-32 flex items-center justify-center mb-4 transform group-hover:scale-110 transition-transform duration-500">
                          <img src={db.find(i => i.name === name)?.img} className="max-h-full object-contain drop-shadow-xl" />
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
              
            </div>
          ) : (
            <div className="flex flex-col lg:flex-row gap-8 animate-in fade-in duration-700 text-slate-900 max-w-[1400px] mx-auto mt-4">
              
              <div className="flex-1 space-y-6">
                <button onClick={() => {setStep(2); resetSelection();}} className={`bg-white shadow-sm border px-6 py-3 rounded-2xl text-[10px] font-black uppercase transition-all btn-click flex items-center gap-2 w-max ${appMode === 'servis' ? 'border-orange-200 text-orange-500 hover:text-orange-700' : (isZumay ? 'border-slate-200 text-slate-500 hover:text-red-600' : 'border-slate-200 text-slate-500 hover:text-[#0052D4]')}`}>
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
                    <div className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-100 relative overflow-hidden group">
                      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                        <div>
                          <h3 className="text-lg font-black italic tracking-tighter text-slate-900 uppercase">EKSPERTİZ & GÜVENLİK</h3>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Lütfen tüm bilgileri eksiksiz doldurun</p>
                        </div>
                        {customer.imei.length === 15 && (
                          <button type="button" onClick={() => window.open(`https://www.turkiye.gov.tr/imei-sorgulama`, '_blank')} className={`text-white px-5 py-2.5 rounded-xl text-[10px] font-black animate-pulse transition-all flex items-center gap-2 shadow-md ${isZumay ? 'bg-red-600 hover:bg-red-700' : 'bg-[#0052D4] hover:bg-blue-700'}`}>
                            BTK IMEI SORGULA
                          </button>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-4">
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 ml-4 uppercase tracking-widest">Müşteri Adı Soyadı</label>
                            <input placeholder="Ad Soyad" className={`w-full p-4 bg-slate-50 rounded-2xl text-xs outline-none border border-slate-100 font-black uppercase focus:bg-white transition-all ${isZumay ? 'focus:border-red-500' : 'focus:border-[#0052D4]'}`} value={customer.name} onChange={(e)=>setCustomer({...customer, name: e.target.value})} />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 ml-4 uppercase tracking-widest">İletişim Numarası</label>
                            <input placeholder="05XX XXX XX XX" className={`w-full p-4 bg-slate-50 rounded-2xl text-xs outline-none border border-slate-100 font-black focus:bg-white transition-all ${isZumay ? 'focus:border-red-500' : 'focus:border-[#0052D4]'}`} value={customer.phone} onChange={(e)=>setCustomer({...customer, phone: e.target.value})} />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 ml-4 uppercase tracking-widest">IMEI Numarası (15 Hane)</label>
                            <input placeholder="IMEI Giriniz" className={`w-full p-4 bg-slate-50 rounded-2xl text-xs outline-none border border-slate-100 font-black uppercase focus:bg-white transition-all ${isZumay ? 'focus:border-red-500' : 'focus:border-[#0052D4]'}`} value={customer.imei} maxLength={15} onChange={(e) => setCustomer({...customer, imei: e.target.value.replace(/\D/g, '')})} />
                          </div>
                        </div>

                        <div className="bg-red-50/50 p-6 rounded-[24px] border border-red-100/50 space-y-4 flex flex-col justify-center">
                          <p className="text-[11px] font-black text-red-700 uppercase italic tracking-widest flex items-center gap-2 mb-2">
                            <span className="w-2 h-2 bg-red-600 rounded-full animate-ping"></span>
                            Personel Onay Listesi
                          </p>
                          {[
                            "Hesaplardan çıkış yapıldı",
                            "Bul (Find My) kapatıldı",
                            "Kayıt durumu kontrol edildi",
                            "Şifreler tamamen silindi"
                          ].map((item, idx) => (
                            <label key={idx} className="flex items-center gap-3 cursor-pointer group select-none">
                              <input type="checkbox" className="w-5 h-5 accent-red-600 rounded-lg cursor-pointer" />
                              <span className="text-[12px] font-black text-slate-600 group-hover:text-red-700 transition-colors uppercase italic">{item}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-100">
                        <p className="text-[11px] font-black mb-4 text-slate-400 uppercase tracking-widest flex items-center gap-2">
                          <span className={`w-4 h-[3px] ${isZumay ? 'bg-red-600' : 'bg-[#0052D4]'}`}></span>
                          Hafıza Kapasitesi
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {db.filter(i => i.name === selectedModelName).map(c => (
                            <button key={c.cap} onClick={() => setSelectedCapacity(c)} className={`px-8 py-4 rounded-xl font-black text-[12px] transition-all btn-click ${selectedCapacity?.cap === c.cap ? (isZumay ? 'bg-red-600 text-white shadow-xl shadow-red-200 ring-4 ring-red-50' : 'bg-[#0052D4] text-white shadow-xl shadow-blue-200 ring-4 ring-blue-50') : 'bg-slate-50 text-slate-500 border border-slate-200 hover:bg-slate-100'}`}>{c.cap}</button>
                          ))}
                        </div>
                      </div>

                      {selectedModelName === "iPhone 13" && (
                        <div className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-100">
                          <p className="text-[11px] font-black mb-4 text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            <span className={`w-4 h-[3px] ${isZumay ? 'bg-red-600' : 'bg-[#0052D4]'}`}></span>
                            Renk Seçimi (Beyaz +%5)
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {['Diğer', 'Beyaz'].map(color => (
                              <button key={color} onClick={() => setSelectedColor(color)} className={`px-8 py-4 rounded-xl font-black text-[12px] transition-all btn-click ${selectedColor === color ? 'bg-slate-900 text-white shadow-xl ring-4 ring-slate-100' : 'bg-slate-50 text-slate-500 border border-slate-200 hover:bg-slate-100'}`}>{color}</button>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {[
                          { label: "Cihaz Açılıyor mu?", field: "power", opts: ['Evet', 'Hayır'] },
                          { label: "Ekran Durumu", field: "screen", opts: selectedBrand?.toLowerCase() === 'apple' ? ['Sağlam', 'Çizikler var', 'Kırık', 'Bilinmeyen Parça'] : ['Sağlam', 'Çizikler var', 'Kırık'] },
                          { label: "Kozmetik Durum", field: "cosmetic", opts: ['Mükemmel', 'İyi', 'Kötü'] },
                          { label: "Face ID / Touch ID", field: "faceId", opts: ['Evet', 'Hayır'] },
                          { label: "Batarya Sağlığı", field: "battery", opts: ['95-100', '85-95', '0-85', 'Bilinmeyen Parça'] },
                          { label: "Ahize / Buzzer", field: "speaker", opts: ['Sağlam', 'Cızırtı var', 'Arızalı'] },
                          { label: "Kayıt Durumu", field: "sim", opts: ['Fiziksel SIM (TR)', 'Fiziksel + eSIM (YD)'] },
                          { label: "Garanti ve Durum", field: "warranty", opts: ['Üretici Garantili', 'Yenilenmiş Cihaz', 'Garanti Yok'] }
                        ].map(q => (
                          <div key={q.field} className="bg-white p-6 rounded-[28px] shadow-sm border border-slate-100">
                            <p className="text-[10px] font-black mb-3 text-slate-400 uppercase tracking-widest">{q.label}</p>
                            <div className="flex flex-wrap gap-2">
                              {q.opts.map((opt) => (
                                <button key={opt} onClick={() => setStatus({...status, [q.field]: opt})} className={`py-2.5 px-4 rounded-xl text-[11px] font-black border-2 transition-all btn-click ${status[q.field] === opt ? 'bg-slate-900 text-white border-slate-900 shadow-md' : 'bg-white text-slate-500 border-slate-100 hover:border-slate-300 hover:text-slate-700'}`}>{opt}</button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* SAĞ KISIM (FİYATLAR) */}
              <div className="lg:w-[350px] space-y-6 sticky top-28 h-fit">
                
                {appMode === 'servis' ? (
                  <div className="bg-orange-950 p-8 rounded-[32px] space-y-4 shadow-2xl">
                      <div className="w-16 h-16 bg-orange-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
                          <svg className="w-8 h-8 text-orange-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                      </div>
                      <h3 className="text-xl font-black italic text-white uppercase text-center mb-4">Müşteriye İlet</h3>
                      <p className="text-[10px] font-black text-orange-500/80 uppercase tracking-widest text-center mb-6">Fiyat teklifini direkt WhatsApp üzerinden müşteriye gönderebilirsiniz.</p>
                      
                      <button onClick={handleServisWhatsApp} className="w-full py-4 rounded-xl font-black uppercase text-[11px] tracking-widest transition-all btn-click flex items-center justify-center gap-2 shadow-lg bg-[#25D366] text-white hover:bg-[#128C7E] shadow-green-900/40">
                          WHATSAPP'TAN GÖNDER
                      </button>
                  </div>
                ) : (
                  <>
                    <div className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-100 flex flex-col items-center">
                       <img src={db.find(i => i.name === selectedModelName)?.img} className="h-32 object-contain drop-shadow-xl mb-4" />
                       <h3 className="font-black italic text-center text-slate-800 text-lg uppercase leading-tight">
                         {selectedModelName} {selectedCapacity?.cap} {selectedModelName === "iPhone 13" && selectedColor !== 'Diğer' ? `(${selectedColor})` : ''}
                       </h3>
                    </div>

                    {isYd ? (
                      <div className="bg-red-600 p-8 rounded-[32px] shadow-2xl text-white text-center border-b-[8px] border-red-800 animate-pulse">
                        <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">⚠️</div>
                        <p className="text-xl font-black uppercase italic leading-none tracking-tighter">YURT DIŞI CIHAZ</p>
                        <p className="text-[9px] mt-3 uppercase tracking-[0.2em] font-black opacity-80">BU CIHAZ ICIN YONETICI ONAYI GEREKLIDIR</p>
                      </div>
                    ) : (
                      <div className="space-y-6 animate-in zoom-in-95 duration-500">
                        
                        <div className="bg-white p-8 rounded-[32px] shadow-xl border border-slate-100 text-center transition-all hover:-translate-y-1">
                          <p className="text-[11px] font-black text-slate-400 uppercase mb-4 tracking-widest italic">Nakit Alış Teklifi</p>
                          <div className="text-4xl font-black italic tracking-tighter text-slate-900">
                            {selectedCapacity && allSelected ? `${finalCashPrice.toLocaleString()} TL` : '---'}
                          </div>
                          
                          {selectedCapacity && allSelected && !purchaseType && (
                            <div className="mt-4">
                              {!isCustomOfferActive ? (
                                <button onClick={() => setIsCustomOfferActive(true)} className={`text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl transition-colors border ${isZumay ? 'text-red-600 hover:text-red-800 hover:bg-red-50 border-red-200' : 'text-[#0052D4] hover:text-blue-800 hover:bg-blue-50 border-blue-200'}`}>
                                  Teklifi Revize Et
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
                                      className={`w-28 p-3 bg-slate-50 border rounded-xl text-sm font-black text-center outline-none ${isZumay ? 'focus:border-red-500 border-slate-200' : 'focus:border-[#0052D4] border-slate-200'}`}
                                    />
                                    <button onClick={() => {setIsCustomOfferActive(false); setCustomOffer('');}} className="bg-red-50 text-red-600 p-3 rounded-xl hover:bg-red-100 transition-colors" title="İptal">
                                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        
                        <div className={`${isZumay ? 'bg-red-600' : 'bg-[#0052D4]'} p-8 rounded-[32px] shadow-2xl text-center text-white relative overflow-hidden hover:-translate-y-1 transition-all`}>
                          <p className={`text-[11px] font-black uppercase mb-4 tracking-widest italic ${isZumay ? 'text-red-200' : 'text-blue-200'}`}>Takas Desteği İle</p>
                          <div className="text-4xl font-black italic tracking-tighter">
                            {selectedCapacity && allSelected ? `${finalTradePrice.toLocaleString()} TL` : '---'}
                          </div>
                          
                          {selectedCapacity && allSelected && !purchaseType && (
                            <div className="mt-4 relative z-10">
                              {!isCustomTradeOfferActive ? (
                                <button onClick={() => setIsCustomTradeOfferActive(true)} className={`text-[10px] font-black text-white uppercase tracking-widest px-4 py-2 rounded-xl transition-colors border shadow-inner ${isZumay ? 'hover:text-red-100 bg-red-700 border-red-500' : 'hover:text-blue-100 bg-blue-700 border-blue-500'}`}>
                                  Teklifi Revize Et
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
                                      className={`w-28 p-3 border rounded-xl text-sm font-black text-center outline-none focus:border-white text-white ${isZumay ? 'bg-red-700 border-red-500 placeholder-red-300' : 'bg-blue-700 border-blue-500 placeholder-blue-300'}`}
                                    />
                                    <button onClick={() => {setIsCustomTradeOfferActive(false); setCustomTradeOffer('');}} className="bg-slate-900 text-white p-3 rounded-xl hover:bg-black transition-colors" title="İptal">
                                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="bg-slate-900 p-8 rounded-[32px] space-y-4 shadow-2xl">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center mb-2">1. İŞLEM TÜRÜNÜ SEÇİN</p>
                      
                      <div className="flex gap-3">
                          <button 
                              disabled={!canProceed || purchaseType !== null} 
                              onClick={() => { setPurchaseType('NAKİT'); handleFinalProcess('NAKİT ALINDI'); }} 
                              className={`flex-1 py-4 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all 
                              ${!canProceed || (purchaseType && purchaseType !== 'NAKİT') ? 'opacity-30 cursor-not-allowed bg-slate-800 text-slate-600' : ''} 
                              ${purchaseType === 'NAKİT' ? 'bg-[#2ecc71] text-white shadow-lg shadow-green-900/50 cursor-default' : ''} 
                              ${canProceed && !purchaseType ? 'btn-click bg-slate-800 text-slate-300 hover:bg-[#2ecc71] hover:text-white' : ''}`}>
                              NAKİT
                          </button>
                          <button 
                              disabled={!canProceed || purchaseType !== null} 
                              onClick={() => { setPurchaseType('TAKAS'); handleFinalProcess('TAKAS ALINDI'); }} 
                              className={`flex-1 py-4 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all 
                              ${!canProceed || (purchaseType && purchaseType !== 'TAKAS') ? 'opacity-30 cursor-not-allowed bg-slate-800 text-slate-600' : ''} 
                              ${purchaseType === 'TAKAS' ? 'bg-[#0052D4] text-white shadow-lg shadow-blue-900/50 cursor-default' : ''} 
                              ${canProceed && !purchaseType ? 'btn-click bg-slate-800 text-slate-300 hover:bg-[#0052D4] hover:text-white' : ''}`}>
                              TAKAS
                          </button>
                      </div>
                      
                      <button 
                          disabled={!canProceed || purchaseType !== null} 
                          onClick={() => { setPurchaseType('ALINMADI'); handleFinalProcess('ALINMADI'); }} 
                          className={`w-full py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all 
                          ${!canProceed || (purchaseType && purchaseType !== 'ALINMADI') ? 'opacity-30 cursor-not-allowed bg-slate-800 text-slate-600' : ''} 
                          ${purchaseType === 'ALINMADI' ? 'bg-red-500 text-white shadow-lg shadow-red-900/50 cursor-default' : ''} 
                          ${canProceed && !purchaseType ? 'btn-click bg-slate-800 text-red-400 hover:bg-red-500 hover:text-white' : ''}`}>
                          ALINMADI
                      </button>

                      <div className={`pt-6 mt-6 border-t border-slate-800 space-y-3 transition-all duration-500 ${showDocs ? 'opacity-100 translate-y-0' : 'opacity-20 pointer-events-none translate-y-2'}`}>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">2. BELGE VE BİLDİRİM</p>
                          <div className="flex gap-3">
                            <button disabled={!showDocs} onClick={() => handleFinalProcess('print')} className={`flex-1 py-4 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all btn-click shadow-lg ${showDocs ? 'bg-white text-slate-950 hover:bg-slate-200' : 'bg-slate-800 text-slate-600'}`}>
                              YAZDIR
                            </button>
                            <button disabled={!showDocs} onClick={() => handleFinalProcess('whatsapp')} className={`flex-1 py-4 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all btn-click shadow-lg ${showDocs ? 'bg-[#25D366] text-white hover:bg-[#128C7E] shadow-green-900/40' : 'bg-slate-800 text-slate-600'}`}>
                              WHATSAPP
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

      <footer className="mt-auto w-full border-t border-slate-200/50 py-6 text-center print:hidden bg-transparent">
         <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.5em]">{isZumay ? 'ZUMAY BAYİ PORTALI v6.0.0' : 'CNETMOBIL • CMR ENTERPRISE DASHBOARD v6.0.0 (PARTNER SAAS)'}</p>
      </footer>

      {/* TAKSİT MODALI (Değiştirilmedi) */}
      {isInstallmentModalOpen && !isZumay && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/80 backdrop-blur-md print:hidden p-4">
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
              <button onClick={() => { setIsInstallmentModalOpen(false); setInstallmentAmount(''); }} className="bg-slate-100 p-3 rounded-2xl text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all btn-click">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <div className="mb-6 shrink-0 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-50 p-4 rounded-3xl border border-slate-100 focus-within:border-emerald-500 focus-within:bg-white transition-all">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Müşteri Adı Soyadı</label>
                  <input type="text" placeholder="Örn: Gökhan Özden" value={customer.name} onChange={(e) => setCustomer({...customer, name: e.target.value})} className="w-full mt-2 bg-transparent text-sm font-black outline-none text-slate-800 placeholder-slate-300 uppercase" />
                </div>
                <div className="bg-slate-50 p-4 rounded-3xl border border-slate-100 focus-within:border-emerald-500 focus-within:bg-white transition-all">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Telefon Numarası</label>
                  <input type="text" placeholder="Örn: 0535 893 04 51" value={customer.phone} onChange={(e) => setCustomer({...customer, phone: e.target.value})} className="w-full mt-2 bg-transparent text-sm font-black outline-none text-slate-800 placeholder-slate-300" />
                </div>
              </div>

              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none">
                  <span className="text-slate-400 font-black text-xl">₺</span>
                </div>
                <input type="number" placeholder="İşlem Tutarını Giriniz..." value={installmentAmount} onChange={(e) => setInstallmentAmount(e.target.value)} className="w-full py-6 pl-12 pr-6 bg-slate-50 rounded-3xl text-2xl font-black border border-slate-200 outline-none focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-50 transition-all text-slate-800" />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 pb-4">
              {installmentAmount && Number(installmentAmount) > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { month: 2, rate: 7.83 }, { month: 3, rate: 10.05 }, { month: 4, rate: 12.36 }, { month: 5, rate: 14.76 },
                    { month: 6, rate: 17.55 }, { month: 7, rate: 20.19 }, { month: 8, rate: 22.96 }, { month: 9, rate: 25.85 },
                    { month: 10, rate: 28.88 }, { month: 11, rate: 32.07 }, { month: 12, rate: 35.41 },
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
                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Toplam</div>
                            <div className="text-base font-black text-slate-700">{total.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL</div>
                          </div>
                          <button onClick={() => handleSendInstallmentToWhatsApp(inst.month, total)} className="bg-[#25D366] hover:bg-[#128C7E] text-white w-12 h-12 rounded-[18px] flex items-center justify-center transition-all shadow-md shadow-green-200 btn-click shrink-0" title="WhatsApp'a Gönder">
                            <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
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

      {/* EKSPERTİZ DETAY MODALI (Değiştirilmedi) */}
      {ekspertizModalData && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 print:hidden">
          <div className="bg-[#1e1e2d] rounded-[32px] shadow-2xl p-8 w-full max-w-2xl border border-slate-700 flex flex-col animate-in fade-in zoom-in duration-300">
             <div className="flex justify-between items-center mb-6 border-b border-slate-700/50 pb-6 shrink-0">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                  </div>
                  <div>
                    <h3 className="text-xl font-black italic text-white uppercase tracking-tighter">Personel Seçimleri</h3>
                    <p className="text-[10px] text-slate-400 font-bold tracking-widest mt-1 uppercase truncate max-w-sm">{ekspertizModalData.customer} - {ekspertizModalData.device}</p>
                  </div>
                </div>
                <button onClick={() => setEkspertizModalData(null)} className="text-slate-400 hover:text-white hover:bg-red-500/20 bg-slate-800 p-3 rounded-xl transition-colors btn-click">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
             </div>
             
             <div className="grid grid-cols-2 md:grid-cols-3 gap-4 overflow-y-auto custom-scrollbar pr-2 max-h-[60vh]">
                {ekspertizModalData.data.split(' | ').map((detail, idx) => {
                    if(!detail.includes(':')) return null;
                    const [key, val] = detail.split(':');
                    
                    let valColor = "text-slate-200";
                    if (['Mükemmel', 'Sağlam', 'Evet', '95-100', 'Fiziksel SIM (TR)', 'Üretici Garantili'].includes(val)) valColor = "text-emerald-400";
                    else if (['Kötü', 'Kırık', 'Bilinmeyen Parça', 'Hayır', 'Arızalı', 'Garanti Yok'].includes(val)) valColor = "text-rose-400";
                    else if (['İyi', 'Çizikler var', 'Cızırtı var', 'Bilinmeyen Parça'].includes(val)) valColor = "text-amber-400";

                    return (
                        <div key={idx} className="bg-[#2a2a3d] border border-slate-700/50 p-4 rounded-2xl flex flex-col gap-1.5 hover:border-slate-500 transition-colors">
                            <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest">{key}</span>
                            <span className={`text-sm font-black uppercase tracking-tight ${valColor}`}>{val}</span>
                        </div>
                    )
                })}
             </div>
          </div>
        </div>
      )}

      {/* YAZDIRMA EKRANI */}
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
