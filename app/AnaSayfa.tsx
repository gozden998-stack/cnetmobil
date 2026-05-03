import React, { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation'; // Sayfa kontrolü için eklendi

export default function AnaSayfa({ selectedBranch, setAppMode, config, gidisatData = [], personelData = [] }: any) {
    const pathname = usePathname(); // Mevcut yolu alıyoruz
    
    // --- MODAL KONTROLLERİ ---
    const [activeModal, setActiveModal] = useState<'tahmin' | 'departman' | 'personel_detay' | null>(null);
    const [selectedPersonel, setSelectedPersonel] = useState<any>(null);

    const isCmr = selectedBranch.includes('CMR');

    const parseNum = (val: any) => {
        if (!val) return 0;
        const cleanVal = String(val).replace(/\./g, '').replace(/,/g, '');
        return parseInt(cleanVal, 10) || 0;
    };

    // --- 1. MAĞAZA VERİSİNİ AYIKLA ---
    const branchIndex = gidisatData.findIndex((row: any) => 
        row[0] && typeof row[0] === 'string' && row[0].trim().toUpperCase() === selectedBranch.trim().toUpperCase()
    );

    let metrics = null;
    if (branchIndex !== -1 && gidisatData[branchIndex + 1] && gidisatData[branchIndex + 2]) {
        const hedefRow = gidisatData[branchIndex + 1];
        const satilanRow = gidisatData[branchIndex + 2];
        metrics = {
            ikinciElAdet: { hedef: parseNum(hedefRow[1]), satilan: parseNum(satilanRow[1]), isCurrency: false },
            ikinciElKazanc: { hedef: parseNum(hedefRow[2]), satilan: parseNum(satilanRow[2]), isCurrency: true },
            birinciElTablet: { hedef: parseNum(hedefRow[3]), satilan: parseNum(satilanRow[3]), isCurrency: false },
            teknikServis: { hedef: parseNum(hedefRow[4]), satilan: parseNum(satilanRow[4]), isCurrency: true }
        };
    }

    // --- TARİH VE PROJEKSİYON HESAPLAMALARI ---
    const today = new Date();
    const currentDay = today.getDate() || 1; 
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate(); 
    
    const anaSatis = metrics?.ikinciElAdet?.satilan || 0;
    const anaHedef = metrics?.ikinciElAdet?.hedef || 0;
    const anaProjeksiyon = Math.round((anaSatis / currentDay) * daysInMonth);
    const anaBasarili = anaProjeksiyon >= anaHedef;
    const subePuani = anaHedef > 0 ? Math.min(10, ((anaSatis / currentDay) * daysInMonth / anaHedef) * 10).toFixed(1) : "0.0";

    // --- 2. FULL BAREM PERSONEL VERİSİ EŞLEŞTİRME ---
    let aktifPersoneller: any[] = [];
    
    if (personelData && personelData.length > 0) {
        const gerceklesenIndex = personelData.findIndex((row: any) => 
            row.some((cell: any) => typeof cell === 'string' && cell.toLowerCase().includes('gerçekleşen'))
        );

        const hedefRows = gerceklesenIndex > -1 ? personelData.slice(0, gerceklesenIndex) : personelData;
        const gerceklesenRows = gerceklesenIndex > -1 ? personelData.slice(gerceklesenIndex + 1) : [];

        const personelDict: Record<string, any> = {};
        
        hedefRows.forEach((row: any) => {
            const magaza = row[0]?.trim() || "";
            const isim = row[1]?.trim() || "";
            if (magaza && isim && magaza.toUpperCase().includes('CMR')) {
                personelDict[isim] = {
                    isim: isim,
                    magaza: magaza.toUpperCase(),
                    hedefler: {
                        ikinciEl: parseNum(row[2]),
                        ikinciElKazanc: parseNum(row[3]),
                        birinciElTablet: parseNum(row[4]),
                        ikinciElSaat: parseNum(row[5]),
                        stokCihaz: parseNum(row[6]),
                        ynaSaat: parseNum(row[7]),
                        aksesuarCiro: parseNum(row[8]),
                        degerPuan: parseNum(row[9]),
                        servisKazanc: parseNum(row[10])
                    },
                    gerceklesen: { ikinciEl: 0, ikinciElKazanc: 0, birinciElTablet: 0, ikinciElSaat: 0, stokCihaz: 0, ynaSaat: 0, aksesuarCiro: 0, degerPuan: 0, servisKazanc: 0 }
                };
            }
        });

        gerceklesenRows.forEach((row: any) => {
            const isimA = row[0]?.trim() || "";
            const isimB = row[1]?.trim() || "";
            let matchedName = "";
            let offset = 0;
            if (personelDict[isimA]) { matchedName = isimA; offset = 1; } 
            else if (personelDict[isimB]) { matchedName = isimB; offset = 2; }

            if (matchedName) {
                personelDict[matchedName].gerceklesen = {
                    ikinciEl: parseNum(row[offset]),
                    ikinciElKazanc: parseNum(row[offset + 1]),
                    birinciElTablet: parseNum(row[offset + 2]),
                    ikinciElSaat: parseNum(row[offset + 3]),
                    stokCihaz: parseNum(row[offset + 4]),
                    ynaSaat: parseNum(row[offset + 5]),
                    aksesuarCiro: parseNum(row[offset + 6]),
                    degerPuan: parseNum(row[offset + 7]),
                    servisKazanc: parseNum(row[offset + 8])
                };
            }
        });

        aktifPersoneller = Object.values(personelDict)
            .filter((p: any) => p.magaza === selectedBranch.trim().toUpperCase())
            .map((p: any) => {
                const anaHedef = p.hedefler.ikinciEl;
                const anaSatilan = p.gerceklesen.ikinciEl;
                const projeksiyon = Math.round((anaSatilan / currentDay) * daysInMonth);
                return {
                    ...p,
                    anaHedef,
                    anaSatilan,
                    projeksiyon,
                    basariYuzdesi: anaHedef > 0 ? Math.min(100, Math.round((anaSatilan / anaHedef) * 100)) : 0,
                    isBasarili: projeksiyon >= anaHedef
                };
            })
            .sort((a: any, b: any) => b.anaSatilan - a.anaSatilan);
    }

    const DepartmanProgressBar = ({ title, data, colorClass }: any) => {
        if (!data) return null;
        const kalan = Math.max(0, data.hedef - data.satilan);
        const yuzde = data.hedef > 0 ? Math.min(100, Math.round((data.satilan / data.hedef) * 100)) : 0;
        const projeksiyon = Math.round((data.satilan / currentDay) * daysInMonth);
        const isBasarili = projeksiyon >= data.hedef;
        const formatVal = (v: number) => data.isCurrency ? `${v.toLocaleString('tr-TR')} ₺` : `${v.toLocaleString('tr-TR')}`;

        return (
            <div className="bg-[#1E293B] border border-slate-700/50 rounded-2xl p-4 flex flex-col justify-between relative overflow-hidden transition-all hover:bg-slate-800">
                {data.hedef > 0 && (
                    <div className={`absolute top-0 right-4 text-white text-[8px] font-black px-2 py-0.5 rounded-b-md tracking-widest shadow-sm ${isBasarili ? 'bg-emerald-500' : 'bg-rose-500'}`}>
                        {isBasarili ? 'BAŞARILI' : 'RİSKLİ'}
                    </div>
                )}
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3 mt-1">{title}</h4>
                <div className="flex justify-between items-end mb-2">
                    <p className="text-xl font-black text-white">{formatVal(data.satilan)} <span className="text-xs font-medium text-slate-500">/ {formatVal(data.hedef)}</span></p>
                    <div className="text-right">
                        <p className={`text-[9px] font-black uppercase tracking-wider ${kalan > 0 ? 'text-[#E11D48]' : 'text-emerald-500'}`}>
                            {data.hedef > 0 ? (kalan > 0 ? `Kalan: ${formatVal(kalan)}` : 'TAMAMLANDI') : 'HEDEF YOK'}
                        </p>
                    </div>
                </div>
                <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden mb-3">
                    <div className={`h-full ${colorClass} rounded-full transition-all duration-1000`} style={{ width: `${yuzde}%` }}></div>
                </div>
                {data.hedef > 0 && (
                    <div className="flex justify-between items-center text-[9px] font-bold border-t border-slate-700/50 pt-2.5">
                        <span className="text-slate-500 uppercase">AY SONU TAHMİN:</span>
                        <span className={isBasarili ? 'text-emerald-400' : 'text-rose-400'}>{formatVal(projeksiyon)}</span>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="space-y-6 w-full animate-in fade-in duration-500 relative">
            {/* Karşılama Ekranı */}
            <div className="relative overflow-hidden bg-gradient-to-br from-sky-500 to-blue-700 rounded-[2rem] p-8 md:p-10 shadow-lg shadow-sky-900/10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-white/20 rounded-full blur-3xl pointer-events-none"></div>
                <div className="relative z-10 flex flex-col gap-3">
                    <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-white/10 border border-white/20 text-white text-xs font-semibold tracking-wider uppercase w-max backdrop-blur-sm shadow-inner">
                        <span className="relative flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500 shadow-[0_0_8px_rgba(34,197,94,1)]"></span>
                        </span>
                        {selectedBranch} Şubesi Aktif
                    </div>
                    <div>
                        <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-white mb-1">
                            İyi Çalışmalar, <span className="font-light opacity-90">Hayırlı İşler</span>
                        </h2>
                        <p className="text-sky-100 font-medium text-sm md:text-base opacity-90">
                            Cnetmobil Terminal Sistemi V2.0
                        </p>
                    </div>
                </div>
                <button 
                    onClick={() => setAppMode('alim')} 
                    className="relative z-10 group bg-white text-sky-600 px-7 py-4 rounded-2xl font-bold text-sm tracking-wide shadow-xl hover:shadow-2xl hover:bg-slate-50 transition-all duration-300 flex items-center gap-3 transform hover:-translate-y-1"
                >
                    <div className="bg-sky-50 p-2 rounded-xl group-hover:bg-sky-100 transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                    </div>
                    Cihaz Alımını Başlat
                </button>
            </div>

            {isCmr && (
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                    <div className="xl:col-span-2">
                        <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-6 sm:p-8 border border-slate-100 dark:border-slate-800 shadow-sm">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl md:text-2xl font-extrabold text-slate-800 dark:text-white flex items-center gap-2 tracking-tight">
                                    CnetMobil <span className="font-medium text-slate-500 dark:text-slate-400">- {selectedBranch}</span>
                                </h3>
                                <button 
                                    onClick={() => setActiveModal('departman')}
                                    className="bg-[#4CAF50] hover:bg-[#43A047] text-white px-4 py-2 rounded-xl font-black text-lg flex items-center gap-1 transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                                >
                                    {subePuani} <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
                                </button>
                            </div>
                            {metrics && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 cursor-pointer">
                                    <div className="bg-[#FDF8F3] border border-[#F2E5D5] rounded-3xl p-5 relative overflow-hidden transition-all hover:shadow-md">
                                        <p className="text-slate-700 font-bold text-sm mb-3">Bu Ay Toplam 2. El Satış</p>
                                        <div className="flex items-baseline gap-1.5">
                                            <span className="text-4xl font-black text-slate-900">{anaSatis}</span>
                                            <span className="text-sm font-bold text-slate-500">Adet</span>
                                        </div>
                                    </div>
                                    <div 
                                        onClick={() => setActiveModal('tahmin')}
                                        className="bg-[#FEF2F2] border border-[#FEE2E2] rounded-3xl p-5 relative overflow-hidden transition-all hover:shadow-md hover:border-rose-300 group"
                                    >
                                        {!anaBasarili && (
                                            <div className="absolute top-4 right-4 bg-[#FB7185] text-white text-[9px] px-2.5 py-1 rounded-md font-black tracking-widest uppercase shadow-sm z-10 flex items-center gap-1">
                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                                RİSKLİ GİDİŞAT
                                            </div>
                                        )}
                                        <p className="text-rose-600 font-bold text-sm mb-3 flex items-center gap-2">
                                            <span className="text-lg">⏳</span> Ay Sonu 2. El Tahmini
                                        </p>
                                        <div className="flex justify-between items-end">
                                            <div className="flex items-baseline gap-1.5">
                                                <span className={`text-4xl font-black ${anaBasarili ? 'text-emerald-600' : 'text-[#E11D48]'}`}>{anaProjeksiyon}</span>
                                                <span className={`text-sm font-bold ${anaBasarili ? 'text-emerald-500' : 'text-rose-500'}`}>Adet</span>
                                            </div>
                                            <div className="text-rose-400 group-hover:text-rose-600 transition-colors group-hover:translate-x-1 transform duration-300">
                                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-6 border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col h-[320px]">
                        <div className="flex items-center gap-3 mb-4 shrink-0">
                            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-500 flex items-center justify-center">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-tight">Personel Gidişat</h3>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">TÜM DETAYLAR İÇİN TIKLAYIN</p>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
                            {aktifPersoneller.length > 0 ? aktifPersoneller.map((p: any, index: number) => (
                                <div key={index} onClick={() => { setSelectedPersonel(p); setActiveModal('personel_detay'); }} className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl border border-slate-100 dark:border-slate-700 flex items-center justify-between cursor-pointer hover:bg-sky-50 hover:border-sky-200 transition-all group relative">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs ${index === 0 ? 'bg-amber-400 text-white shadow-md' : 'bg-slate-200 text-slate-500'}`}>
                                            {index + 1}
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-slate-800 dark:text-white text-sm flex items-center gap-1 group-hover:text-sky-700">
                                                {p.isim.split(' ')[0]} {p.isim.split(' ')[1] ? p.isim.split(' ')[1].charAt(0) + '.' : ''}
                                                {index === 0 && <span className="text-amber-500 text-sm">🏆</span>}
                                            </h4>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <div className="w-16 h-1 bg-slate-200 rounded-full overflow-hidden">
                                                    <div className={`h-full ${p.isBasarili ? 'bg-emerald-500' : 'bg-sky-500'}`} style={{ width: `${p.basariYuzdesi}%` }}></div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right flex items-center gap-3">
                                        <div className="group-hover:-translate-x-2 transition-transform">
                                            <p className="text-lg font-black text-slate-800 dark:text-white leading-none">{p.anaSatilan} <span className="text-[10px] font-medium text-slate-400">/ {p.anaHedef}</span></p>
                                            <p className={`text-[8px] font-black uppercase tracking-widest mt-1 ${p.isBasarili ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                {p.isBasarili ? 'BAŞARILI' : 'RİSKLİ'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )) : null}
                        </div>
                    </div>
                </div>
            )}

            {/* Alt Bilgi Panelleri */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-[#1e293b] rounded-[2rem] p-8 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="w-12 h-12 rounded-2xl bg-sky-50 dark:bg-sky-900/30 text-sky-500 flex items-center justify-center shrink-0">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Merkez Duyuruları</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Yönetimden gelen son bildirimler</p>
                        </div>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-6 flex-1 border border-slate-100 dark:border-slate-800/50">
                        <p className="text-slate-700 dark:text-slate-300 font-medium leading-relaxed whitespace-pre-wrap text-sm md:text-base">
                            {config.Duyuru_Metni || "Şu an için aktif bir mağaza duyurusu bulunmamaktadır."}
                        </p>
                    </div>
                </div>

                <div className="bg-white dark:bg-[#1e293b] rounded-[2rem] p-8 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col overflow-hidden relative">
                    <div className="flex items-center gap-4 mb-6 relative z-10">
                        <div className="w-12 h-12 rounded-2xl bg-orange-50 dark:bg-orange-900/20 text-orange-500 flex items-center justify-center shrink-0">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" /></svg>
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Aktif Kampanyalar</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Müşteriye sunulacak fırsatlar</p>
                        </div>
                    </div>
                    <div className="flex-1 flex items-center justify-center bg-gradient-to-r from-orange-500/10 via-orange-500/5 to-transparent rounded-2xl border border-orange-500/20 py-8 relative z-10 overflow-hidden">
                        <div className="whitespace-nowrap animate-marquee font-bold text-xl md:text-2xl tracking-wide text-orange-600 dark:text-orange-400">
                             {config.Kampanya_Metni || "GÜNCEL KAMPANYA BULUNMAMAKTADIR"}
                        </div>
                    </div>
                </div>
            </div>

            {/* MODALLAR (AYNI KALDI) */}
            {activeModal && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center px-4">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={() => setActiveModal(null)}></div>
                    {/* Tahmin, Departman ve Personel Detay Modalları buraya gelecek (Kodunu bozmadım) */}
                </div>
            )}

            {/* --- C-BOT PRO ENTEGRASYONU --- */}
            {isCmr && <CBot portalData={aktifPersoneller} />}
        </div>
    );
}

// --- C-BOT PRO BİLEŞENİ (Ana Sayfa İçinde) ---
function CBot({ portalData }: { portalData: any[] }) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [chatHistory, setChatHistory] = useState<any[]>([
    { sender: 'bot', text: "Selam abi! Cnetmobil gidişat verilerini anlık süzüyorum. Kimin barem durumuna bakalım?" }
  ]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Sadece ana sayfada (link "/") görünecek kuralı
  if (pathname !== '/') return null;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, isTyping]);

  const veriyiSuz = (input: string) => {
    const msg = input.toLowerCase().trim();
    const personel = portalData.find(p => 
      msg.includes(p.isim.toLowerCase()) || msg.includes(p.isim.split(' ')[0].toLowerCase())
    );

    if (personel) {
      const yuzde = personel.basariYuzdesi;
      const hedef = personel.anaHedef;
      const gerceklesen = personel.anaSatilan;
      const fark = hedef - gerceklesen;

      if (personel.isBasarili) {
        return `🌟 **Tebrikler ${personel.isim}!** \n\n**Durum:** Başarılı \n**Gidişat:** ${gerceklesen} / ${hedef} (%${yuzde}) \n**Analiz:** Baremi doldurmuşsun, ay sonu hedefin garantide abi. Primin hayırlı olsun!`;
      } else {
        return `⚠️ **${personel.isim}**, barem gidişatın şu an RİSKLİ görünüyor abi. \n\n**Gidişat:** ${gerceklesen} / ${hedef} (%${yuzde}) \n**Analiz:** Hedefi yakalamak için ${fark} adet daha 2. El cihaz alman lazım. Tempoyu süzdüğüm kadarıyla %15 artırman gerekiyor!`;
      }
    }
    return "Bu ismi personel listesinde süzemedim abi. İsmi tam yazar mısın?";
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;
    const userMsg = inputValue;
    setChatHistory(prev => [...prev, { sender: 'user', text: userMsg }]);
    setInputValue("");
    setIsTyping(true);
    setTimeout(() => {
      setChatHistory(prev => [...prev, { sender: 'bot', text: veriyiSuz(userMsg) }]);
      setIsTyping(false);
    }, 800);
  };

  return (
    <>
      {isOpen && (
        <div className="fixed bottom-24 right-6 w-[350px] md:w-[420px] h-[550px] bg-white rounded-[2.5rem] shadow-[0_20px_80px_rgba(0,0,0,0.3)] flex flex-col z-[100000] overflow-hidden border border-slate-100 animate-in fade-in zoom-in duration-300">
          <div className="bg-[#0052D4] p-6 text-white flex flex-col relative shadow-lg">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-md"><span className="text-[#0052D4] font-black text-2xl">C</span></div>
                <div className="flex flex-col"><span className="font-bold text-lg uppercase tracking-tight leading-none">C-BOT PRO</span><div className="text-[10px] text-green-100 font-bold mt-2 uppercase bg-white/10 px-2 py-0.5 rounded-full w-fit">Veriler Süzülüyor</div></div>
              </div>
              <button onClick={() => setIsOpen(false)} className="bg-white/10 hover:bg-white/20 p-2 rounded-full text-white font-bold transition-all text-xl">✕</button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-white">
            {chatHistory.map((msg, index) => (
              <div key={index} className={`flex ${msg.sender === 'bot' ? 'justify-start' : 'justify-end'}`}>
                <div className={`px-5 py-3 rounded-[1.6rem] text-[14px] max-w-[85%] leading-relaxed shadow-sm ${msg.sender === 'bot' ? 'bg-slate-50 text-slate-700 rounded-tl-none border border-slate-100' : 'bg-[#0052D4] text-white rounded-tr-none shadow-lg shadow-blue-200'}`}>{msg.text}</div>
              </div>
            ))}
            {isTyping && <div className="text-[11px] text-blue-500 animate-pulse font-bold ml-2">Baremler süzülüyor...</div>}
            <div ref={messagesEndRef} />
          </div>
          <div className="p-6 bg-white border-t border-slate-50">
            <form onSubmit={handleSendMessage} className="flex gap-3">
              <input type="text" value={inputValue} onChange={(e) => setInputValue(e.target.value)} placeholder="İsim yazın (Örn: Mustafa)..." className="flex-1 bg-slate-50 border-2 border-blue-50 rounded-2xl px-5 py-3.5 text-sm focus:border-[#0052D4] outline-none transition-all placeholder:text-slate-400" />
              <button type="submit" className="bg-[#0052D4] text-white p-4 rounded-2xl shadow-lg hover:scale-105 active:scale-95 transition-all">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
              </button>
            </form>
          </div>
        </div>
      )}
      <button onClick={() => setIsOpen(!isOpen)} className="fixed bottom-8 right-8 z-[100000] group flex flex-col items-center">
        <div className="bg-[#0052D4] text-white text-[9px] font-black px-3 py-1 rounded-full shadow-lg mb-[-4px] z-10 uppercase tracking-widest border border-white/20 transition-transform group-hover:scale-110">C-BOT</div>
        <div className="w-16 h-16 rounded-full bg-white border-2 border-[#0052D4] shadow-[0_12px_40px_rgba(0,82,212,0.4)] flex items-center justify-center group-hover:scale-110 active:scale-90 transition-all duration-300"><span className="text-[#0052D4] font-black text-2xl relative z-10">C</span></div>
      </button>
    </>
  );
}
