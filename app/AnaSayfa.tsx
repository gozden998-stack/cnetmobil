import React, { useEffect, useState } from 'react';

export default function AnaSayfa({ selectedBranch, setAppMode, config, gidisatData = [], personelData = [], hedeflerData = [], izinlerData = [] }: any) {
    // --- MODAL KONTROLLERİ ---
    const [activeModal, setActiveModal] = useState<'tahmin' | 'departman' | 'personel_detay' | 'hedefler' | 'izinler' | null>(null);
    const [selectedPersonel, setSelectedPersonel] = useState<any>(null);

    const isCmr = selectedBranch.includes('CMR');

    // --- KANAL KISITLAMA MANTIĞI ---
    const branchLower = selectedBranch.toLowerCase();
    const isBlocked = branchLower.includes('vodofone') || branchLower.includes('vodafone') || branchLower.includes('zumay');
    
    const hedeflerAktifMi = !isBlocked;
    const izinlerAktifMi = !isBlocked;

    // =========================================================================
    // 🚀 TABLO KESİCİ: HEDEFLER VE İZİNLERİ KARIŞTIRMADAN AYIR
    // =========================================================================
    const veriKaynagi = izinlerData && izinlerData.length > 0 ? izinlerData : hedeflerData;
    const izinIdx = veriKaynagi.findIndex((row: any) => 
        Array.isArray(row) && row.join("").toUpperCase().includes("İZİN ÇİZELGESİ")
    );

    // 1. HEDEFLER TABLOSUNU AYIKLA
    const ustTabloData = izinIdx !== -1 ? hedeflerData.slice(0, izinIdx) : hedeflerData;
    const seciliSubeHedefleri = ustTabloData.filter((row: any) => 
        Array.isArray(row) && String(row[0] || "").toUpperCase() === selectedBranch.toUpperCase().trim()
    );
    const hedeflerBasliklar = ustTabloData[0] || [];

    // 2. İZİNLER TABLOSUNU AYIKLA
    const altTabloData = izinIdx !== -1 ? veriKaynagi.slice(izinIdx) : [];
    const izinTarihBasliklari = altTabloData.length > 1 ? altTabloData[1] : [];
    const izinGunBasliklari = altTabloData.length > 2 ? altTabloData[2] : [];
    const tumIzinler = altTabloData.length > 3 ? altTabloData.slice(3).filter((row:any) => row.length > 1 && (row[0] || row[1])) : [];

    // --- İZİNLER İÇİN DİNAMİK RENK PALETİ ---
    const izinRenkleri = [
        { bg: 'bg-sky-900/40', text: 'text-sky-300', badge: 'bg-sky-600/80 text-white' },
        { bg: 'bg-emerald-900/40', text: 'text-emerald-300', badge: 'bg-emerald-600/80 text-white' },
        { bg: 'bg-purple-900/40', text: 'text-purple-300', badge: 'bg-purple-600/80 text-white' },
        { bg: 'bg-rose-900/40', text: 'text-rose-300', badge: 'bg-rose-600/80 text-white' },
        { bg: 'bg-amber-900/40', text: 'text-amber-300', badge: 'bg-amber-600/80 text-white' },
        { bg: 'bg-indigo-900/40', text: 'text-indigo-300', badge: 'bg-indigo-600/80 text-white' },
    ];
    let aktifSubeRenkIndex = -1;

    // --- SAYI OKUMA MOTORU ---
    const parseNum = (val: any) => {
        if (val === null || val === undefined || val === "") return 0;
        if (typeof val === 'number') return val;
        let strVal = String(val).trim();
        if (strVal.includes('.') && strVal.includes(',')) {
            strVal = strVal.replace(/\./g, '').replace(',', '.');
        } else if (strVal.includes(',')) {
            strVal = strVal.replace(',', '.');
        } else if (strVal.includes('.')) {
            strVal = strVal.replace(/\./g, '');
        }
        const parsed = parseFloat(strVal);
        return isNaN(parsed) ? 0 : parsed;
    };

    const cleanKey = (s: string) => String(s || "").replace(/[\s\.\-\+]/g, "").toLocaleUpperCase('tr-TR'); 

    // --- TARİH DEDEKTİFİ ---
    let lastUpdatedDate = config?.Guncellenen_Tarih || config?.GÜNCELLENEN || "";
    if (!lastUpdatedDate && personelData) {
        const tarihSatiri = (personelData as any[]).find((row: any) => 
            Array.isArray(row) && row.some((cell: any) => String(cell || "").toUpperCase().includes("GÜNCELLENEN"))
        );
        if (tarihSatiri) {
            const hucresiIdx = (tarihSatiri as any[]).findIndex((cell: any) => String(cell || "").toUpperCase().includes("GÜNCELLENEN"));
            lastUpdatedDate = String(tarihSatiri[hucresiIdx + 1] || "").trim();
        }
    }

    const getTargetDay = () => {
        try {
            const separator = lastUpdatedDate.includes('.') ? '.' : (lastUpdatedDate.includes('/') ? '/' : null);
            if (separator) {
                const gun = parseInt(lastUpdatedDate.split(separator)[0]);
                if (!isNaN(gun) && gun > 0) return gun;
            }
        } catch (e) {}
        return new Date().getDate(); 
    };

    const getDaysInMonth = () => {
        try {
            const separator = lastUpdatedDate.includes('.') ? '.' : (lastUpdatedDate.includes('/') ? '/' : null);
            if (separator) {
                const parcalar = lastUpdatedDate.split(separator);
                return new Date(parseInt(parcalar[2]), parseInt(parcalar[1]), 0).getDate();
            }
        } catch (e) {}
        return 31; 
    };

    const currentDay = getTargetDay(); 
    const daysInMonth = getDaysInMonth();

    // --- DİNAMİK PUAN AYAR DEDEKTÖRÜ ---
    const dinamikPuanKurallari: Record<string, any> = {};
    const hedefPuaniBaslikIdx = (personelData as any[]).findIndex(row => 
        Array.isArray(row) && String(row[0] || "").toUpperCase().includes("HEDEF PUANI")
    );

    if (hedefPuaniBaslikIdx !== -1) {
        const baslikSatiri = personelData[hedefPuaniBaslikIdx];
        const puanSatiri = personelData[hedefPuaniBaslikIdx + 1];
        const maxPuanSatiri = personelData[hedefPuaniBaslikIdx + 2];
        const kuralSatirlari = personelData.slice(hedefPuaniBaslikIdx + 3, hedefPuaniBaslikIdx + 7);

        baslikSatiri.forEach((cell: any, idx: number) => {
            if (idx >= 1) {
                const bKey = cleanKey(cell);
                if (bKey && !bKey.includes("TOPLAM")) {
                    dinamikPuanKurallari[bKey] = {
                        hedefPuan: parseNum(puanSatiri[idx]),
                        maxPuan: parseNum(maxPuanSatiri[idx]),
                        kural70: kuralSatirlari.some((row: any) => String(row[idx] || "").includes("%70"))
                    };
                }
            }
        });
    }

    const calculatePoint = (actual: number, target: number, baremName: string, isProj = false) => {
        if (!target || target === 0) return 0;
        const val = isProj ? (actual / currentDay) * daysInMonth : actual;
        const cleanedBaremName = cleanKey(baremName);
        const rule = dinamikPuanKurallari[cleanedBaremName];
        if (!rule) return 0;
        const perf = val / target;
        if (rule.kural70 && perf < 0.7) return 0;
        let calculated = perf * rule.hedefPuan;
        return Math.min(rule.maxPuan, calculated);
    };
    
    // --- MAĞAZA GİDİŞAT ---
    let dinamikMagazaMetrikleri: any[] = [];
    let magazaAnlikPuan = 0, magazaTahminPuan = 0, anaSatis = 0, anaHedef = 0;
    let anaMetrikAdi = "VERİ YOK"; 

    const hIdx = (gidisatData || []).findIndex((r: any) => r && String(r[0] || "").trim().toUpperCase() === "HEDEF");
    const gIdx = (gidisatData || []).findIndex((r: any) => r && String(r[0] || "").trim().toUpperCase() === "GERÇEKLEŞEN");
    const pIdx = (gidisatData || []).findIndex((r: any) => r && String(r[0] || "").trim().toUpperCase() === "HEDEF PUANI");

    if (hIdx !== -1 && gIdx !== -1 && pIdx !== -1) {
        const hHeaders = gidisatData[hIdx];
        const gHeaders = gidisatData[gIdx];
        const pHeaders = gidisatData[pIdx];

        let hedefRow: any = null, gerceklesenRow: any = null;
        const brUpper = selectedBranch.toUpperCase().trim();

        for (let i = hIdx + 1; i < gIdx; i++) { if (String(gidisatData[i]?.[0] || "").trim().toUpperCase() === brUpper) { hedefRow = gidisatData[i]; break; } }
        for (let i = gIdx + 1; i < pIdx; i++) { if (String(gidisatData[i]?.[0] || "").trim().toUpperCase() === brUpper || String(gidisatData[i]?.[1] || "").trim().toUpperCase() === brUpper) { gerceklesenRow = gidisatData[i]; break; } }

        const puanRow = gidisatData[pIdx + 1];
        const maxPuanRow = gidisatData[pIdx + 2];
        const colorPalette = ["bg-sky-500", "bg-purple-500", "bg-orange-500", "bg-emerald-500", "bg-blue-500", "bg-rose-500", "bg-amber-500", "bg-indigo-500", "bg-fuchsia-500"];
        let colorIndex = 0;

        const calcStorePts = (actual: number, target: number, hp: number, mp: number, isProj: boolean) => {
            if (!target || target === 0 || !hp) return 0;
            const val = isProj ? (actual / currentDay) * daysInMonth : actual;
            return Math.min(mp || hp, (val / target) * hp);
        };

        hHeaders.forEach((hNameRaw: any, colIdx: number) => {
            const hName = String(hNameRaw || "").trim();
            if (colIdx > 0 && hName && !hName.toUpperCase().includes('TOPLAM') && !hName.toUpperCase().includes('PUAN')) {
                const cKey = cleanKey(hName);
                const gCol = gHeaders.findIndex((gh: any) => cleanKey(gh) === cKey);
                const pCol = pHeaders.findIndex((ph: any) => cleanKey(ph) === cKey);
                
                const hVal = parseNum(hedefRow?.[colIdx]);
                const sVal = gCol > -1 ? parseNum(gerceklesenRow?.[gCol]) : 0;
                const hpVal = pCol > -1 ? parseNum(puanRow?.[pCol]) : 0;
                const mpVal = pCol > -1 ? parseNum(maxPuanRow?.[pCol]) : hpVal; 
                const isCurr = ['KAZANÇ', 'CİRO', 'TL', 'SERVİS', '₺'].some(k => hName.toUpperCase().includes(k));
                
                const anlikPts = calcStorePts(sVal, hVal, hpVal, mpVal, false);
                const tahminPts = calcStorePts(sVal, hVal, hpVal, mpVal, true);

                magazaAnlikPuan += anlikPts;
                magazaTahminPuan += tahminPts;

                dinamikMagazaMetrikleri.push({ name: hName, color: colorPalette[colorIndex % colorPalette.length], data: { hedef: hVal, satilan: sVal, isCurrency: isCurr, hedefPuan: hpVal, maxPuan: mpVal, anlikPuan: anlikPts, tahminPuan: tahminPts } });
                if (colorIndex === 0) { anaSatis = sVal; anaHedef = hVal; anaMetrikAdi = hName; }
                colorIndex++;
            }
        });
    }

    const anaProjeksiyon = Math.round((anaSatis / currentDay) * daysInMonth);
    const anaBasarili = anaProjeksiyon >= anaHedef;

    // --- PERSONEL VERİSİ ---
    let aktifPersoneller: any[] = [];
    let dinamikBaremler: any[] = [];
    
    if (personelData && personelData.length > 0) {
        const gerceklesenIndex = personelData.findIndex((row: any) => Array.isArray(row) && row.some((cell: any) => typeof cell === 'string' && cell.toLowerCase().includes('gerçekleşen')));
        
        const baslikSatiri = personelData[0] || [];
        baslikSatiri.forEach((cell: any, index: number) => {
            if (index >= 2) {
                const baslikAdi = String(cell || "").trim();
                if (baslikAdi && !baslikAdi.toLowerCase().includes('gerçekleşen') && !baslikAdi.toLowerCase().includes('isim')) {
                    dinamikBaremler.push({ indexOffset: index - 2, orijinalIndex: index, name: baslikAdi, isCurrency: ['KAZANÇ', 'CİRO', 'TL', 'SERVİS', '₺'].some(k => baslikAdi.toUpperCase().includes(k)) });
                }
            }
        });

        const hedefRows = gerceklesenIndex > -1 ? personelData.slice(1, gerceklesenIndex) : personelData.slice(1);
        const gerceklesenRows = gerceklesenIndex > -1 ? personelData.slice(gerceklesenIndex + 1, hedefPuaniBaslikIdx) : [];

        const personelDict: Record<string, any> = {};
        
        hedefRows.forEach((row: any) => {
            if (!Array.isArray(row)) return;
            const magaza = row[0]?.trim() || "";
            const isim = row[1]?.trim() || "";
            if (magaza && isim) {
                if (!personelDict[isim]) {
                    personelDict[isim] = { isim: isim, magaza: magaza.toUpperCase(), hedefler: {}, gerceklesen: {}, anaHedef: 0, anaSatilan: 0 };
                }
                dinamikBaremler.forEach(b => {
                    const d = parseNum(row[b.orijinalIndex]);
                    personelDict[isim].hedefler[b.name] = (personelDict[isim].hedefler[b.name] || 0) + d;
                    if (b.indexOffset === 0) personelDict[isim].anaHedef += d;
                });
            }
        });

        gerceklesenRows.forEach((row: any) => {
            if (!Array.isArray(row)) return;
            const isimA = row[0]?.trim() || "";
            const isimB = row[1]?.trim() || "";
            let matchedName = personelDict[isimA] ? isimA : (personelDict[isimB] ? isimB : "");
            let offset = personelDict[isimA] ? 1 : 2;

            if (matchedName) {
                dinamikBaremler.forEach(b => {
                    const d = parseNum(row[offset + b.indexOffset]);
                    personelDict[matchedName].gerceklesen[b.name] = (personelDict[matchedName].gerceklesen[b.name] || 0) + d;
                    if (b.indexOffset === 0) personelDict[matchedName].anaSatilan += d;
                });
            }
        });

        aktifPersoneller = Object.values(personelDict)
            .filter((p: any) => p.magaza.includes(selectedBranch.trim().toUpperCase()))
            .map((p: any) => {
                let pAnlik = 0, pTahmin = 0;
                dinamikBaremler.forEach(b => {
                    pAnlik += calculatePoint(p.gerceklesen[b.name] || 0, p.hedefler[b.name] || 0, b.name, false);
                    pTahmin += calculatePoint(p.gerceklesen[b.name] || 0, p.hedefler[b.name] || 0, b.name, true);
                });
                const projeksiyon = Math.round((p.anaSatilan / currentDay) * daysInMonth);
                return { ...p, projeksiyon, toplamPuan: pAnlik.toFixed(1), puanTahmin: pTahmin.toFixed(1), basariYuzdesi: p.anaHedef > 0 ? Math.min(100, Math.round((p.anaSatilan / p.anaHedef) * 100)) : 0, isBasarili: projeksiyon >= p.anaHedef };
            })
            .sort((a: any, b: any) => parseFloat(b.puanTahmin) - parseFloat(a.puanTahmin));
    }

    const DepartmanProgressBar = ({ title, data, colorClass, puan, isRiskliBarem }: any) => {
        if (!data || data.hedef === 0) return null;
        const kalan = Math.max(0, data.hedef - data.satilan);
        const yuzde = data.hedef > 0 ? Math.min(100, Math.round((data.satilan / data.hedef) * 100)) : 0;
        const projeksiyon = Math.round((data.satilan / currentDay) * daysInMonth);
        const isBasarili = projeksiyon >= data.hedef;
        const isRisky = (data.hedef > 0 && !isBasarili) || isRiskliBarem;

        const formatVal = (v: number) => data.isCurrency ? `${v.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ₺` : `${v.toLocaleString('tr-TR')}`;

        return (
            <div className={`bg-[#0F172A] border ${isRisky ? 'border-rose-500/30' : 'border-slate-800'} rounded-2xl p-4 flex flex-col justify-between relative overflow-hidden transition-all hover:border-slate-600`}>
                {data.hedef > 0 && <div className={`absolute top-0 right-4 text-white text-[9px] font-bold px-2 py-1 rounded-b-md tracking-wider shadow-sm ${isBasarili ? 'bg-emerald-600/90' : 'bg-rose-600/90'}`}>{isBasarili ? 'BAŞARILI' : 'RİSKLİ'}</div>}
                {data.hedefPuan > 0 && <div className="absolute top-0 left-0 bg-sky-900/40 border-b border-r border-sky-800/50 text-sky-400 text-[10px] font-bold px-3 py-1.5 rounded-br-xl tracking-wider flex items-center gap-1.5"><svg className="w-3 h-3 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>ANLIK: {data.anlikPuan?.toFixed(1)}</div>}
                <div className="flex justify-between items-start mb-3 mt-5">
                    <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{title}</h4>
                    {puan !== undefined && !data.hedefPuan && <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${isRiskliBarem ? 'bg-rose-900/30 text-rose-400' : 'bg-sky-900/30 text-sky-400'}`}>Puan: {puan}</span>}
                </div>
                <div className="flex justify-between items-end mb-2">
                    <p className="text-xl font-bold text-white">{formatVal(data.satilan)} <span className="text-xs font-medium text-slate-500">/ {formatVal(data.hedef)}</span></p>
                    <div className="text-right"><p className={`text-[10px] font-bold uppercase tracking-wider ${kalan > 0 ? (isRisky ? 'text-rose-400' : 'text-slate-400') : 'text-emerald-400'}`}>{data.hedef > 0 ? (kalan > 0 ? `Kalan: ${formatVal(kalan)}` : 'TAMAMLANDI') : 'HEDEF YOK'}</p></div>
                </div>
                {isRiskliBarem && <div className="bg-rose-900/20 border border-rose-800/50 rounded-lg py-1 px-2 mb-2"><p className="text-[9px] font-bold text-rose-400 text-center uppercase tracking-wider flex items-center justify-center gap-1"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>BARAJ ALTINDA</p></div>}
                <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden mb-3"><div className={`h-full ${colorClass} rounded-full transition-all duration-1000`} style={{ width: `${yuzde}%` }}></div></div>
                {data.hedef > 0 && <div className="flex justify-between items-center text-[10px] font-medium border-t border-slate-800 pt-2.5"><span className="text-slate-500 uppercase tracking-wider">TAHMİN</span><span className={isBasarili ? 'text-emerald-400' : 'text-rose-400'}>{formatVal(projeksiyon)}</span></div>}
            </div>
        );
    };

    // =========================================================================
    // 🔗 JSX BLOKLARI İÇİN DİNAMİK DEĞİŞKEN BAĞLAMALARI
    // =========================================================================
    const toplamSatis = anaSatis;
    const toplamPuan = magazaAnlikPuan.toFixed(1);
    const ortalamaPuan = aktifPersoneller.length > 0 ? (magazaAnlikPuan / aktifPersoneller.length).toFixed(1) : "0.0";
    const toplamHedef = anaHedef;

    return (
        <div className="space-y-6 w-full animate-in fade-in duration-500 relative bg-[#0F172A] text-slate-200">
            
            {/* SİZİN EKLEDİĞİNİZ 1. BÖLÜM: DASHBOARD */}
            <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-3xl p-8 border border-slate-700 shadow-xl mb-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-4xl font-black text-white mb-2">
                            {selectedBranch}
                        </h1>
                        <p className="text-slate-400 text-sm tracking-wider uppercase">
                            Dashboard
                        </p>
                    </div>
                    <button
                        onClick={() => setAppMode("alim")}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-2xl font-bold transition-all"
                    >
                        Cihaz Alımı Başlat
                    </button>
                </div>
            </div>

            {/* SİZİN EKLEDİĞİNİZ 2. BÖLÜM: KPI KARTLARI */}
            <div className="grid lg:grid-cols-4 gap-5 mb-8">
                <div className="bg-slate-900 rounded-3xl p-6 border border-slate-800">
                    <div className="text-slate-400 text-sm">
                        Bu Ay Satış
                    </div>
                    <div className="text-4xl font-black text-white mt-2">
                        {toplamSatis}
                    </div>
                </div>

                <div className="bg-slate-900 rounded-3xl p-6 border border-slate-800">
                    <div className="text-slate-400 text-sm">
                        Toplam Puan
                    </div>
                    <div className="text-4xl font-black text-green-400 mt-2">
                        {toplamPuan}
                    </div>
                </div>

                <div className="bg-slate-900 rounded-3xl p-6 border border-slate-800">
                    <div className="text-slate-400 text-sm">
                        Ortalama Puan
                    </div>
                    <div className="text-4xl font-black text-yellow-400 mt-2">
                        {ortalamaPuan}
                    </div>
                </div>

                <div className="bg-slate-900 rounded-3xl p-6 border border-slate-800">
                    <div className="text-slate-400 text-sm">
                        Hedef
                    </div>
                    <div className="text-4xl font-black text-blue-400 mt-2">
                        {toplamHedef}
                    </div>
                </div>
            </div>

             {/* GERİ KALAN PANELLER VE TABLOLAR (SaaS Tasarımına Uyarlanmış Haliyle) */}
             {isCmr && (
                 <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 items-stretch">
                     {/* SOL KOLON - DEPARTMAN GİDİŞAT */}
                     <div className="xl:col-span-2 w-full h-full flex flex-col gap-6">
                        <div className="bg-[#1E293B] rounded-3xl p-6 sm:p-8 border border-slate-700/50 shadow-inner flex-1">
                             <div className="flex justify-between items-start mb-6">
                                <div>
                                    <h3 className="text-xl md:text-2xl font-black text-white flex items-center gap-2 tracking-tight">
                                        Şube Performans Özeti
                                    </h3>
                                    {lastUpdatedDate && (
                                        <p className="text-[11px] text-slate-500 font-bold tracking-widest uppercase mt-1">
                                            Güncelleme: {lastUpdatedDate}
                                        </p>
                                    )}
                                </div>
                                <div className="text-right flex gap-3">
                                    <button onClick={() => setActiveModal('departman')} className="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-600 px-4 py-2 rounded-xl font-bold text-sm transition-all shadow-sm">
                                        Detaylı Puanlar 📊
                                    </button>
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {dinamikMagazaMetrikleri.map((m, idx) => {
                                    const yuzde = m.data.hedef > 0 ? Math.min(100, Math.round((m.data.satilan / m.data.hedef) * 100)) : 0;
                                    return (
                                        <div key={idx} className="bg-[#0F172A] border border-slate-700/50 rounded-xl p-5 flex flex-col gap-3 hover:border-slate-500 transition-colors cursor-pointer" onClick={() => setActiveModal('tahmin')}>
                                            <div className="flex justify-between items-center gap-2">
                                                <p className="text-xs font-bold text-slate-300 uppercase tracking-wider">{m.name}</p>
                                                <span className="text-[11px] font-bold text-slate-500 whitespace-nowrap">{m.data.satilan} / {m.data.hedef}</span>
                                            </div>
                                            <div className="h-2.5 w-full bg-slate-800 rounded-full overflow-hidden">
                                                <div className={`h-full ${m.color} rounded-full`} style={{ width: `${yuzde}%` }}></div>
                                            </div>
                                            <div className="flex justify-between items-center text-[10px] font-bold text-slate-500">
                                                <span>Tahmin: {Math.round((m.data.satilan / currentDay) * daysInMonth)}</span>
                                                <span className={yuzde >= 100 ? 'text-emerald-400' : 'text-slate-400'}>{yuzde}%</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                     </div>

                    {/* SAĞ KOLON - LİDERLİK TABLOSU */}
                    <div className="xl:col-span-1 bg-[#1E293B] rounded-3xl p-6 border border-slate-700/50 shadow-inner flex flex-col h-full min-h-[400px]">
                        <div className="flex items-center justify-between mb-6 shrink-0 border-b border-slate-700/50 pb-5">
                            <div>
                                <h3 className="text-xl font-black text-white tracking-tight">Personel Gidişat</h3>
                                <p className="text-[11px] text-slate-500 font-black tracking-widest uppercase mt-1">Şube Liderlik Tablosu</p>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
                            {aktifPersoneller.length > 0 ? aktifPersoneller.map((p: any, index: number) => {
                                let cardStyle = "bg-[#0F172A] border-slate-800 hover:border-slate-700";
                                let avatarStyle = "bg-slate-800 text-slate-400 border-slate-700";
                                let badgeStyle = "bg-slate-800 text-slate-400 border-slate-700";
                                let badgeText = "STANDART";

                                if (index === 0) {
                                    cardStyle = "bg-amber-900/20 border-amber-800 shadow-[0_0_15px_rgba(245,158,11,0.05)] hover:border-amber-600";
                                    avatarStyle = "bg-amber-800/30 text-amber-400 border-amber-800";
                                    badgeStyle = "bg-amber-800/30 text-amber-400 border-amber-800";
                                    badgeText = "🏆 1. LİDER";
                                } else if (index === 1) {
                                    cardStyle = "bg-slate-700/20 border-slate-600 hover:border-slate-500";
                                    avatarStyle = "bg-slate-600/30 text-slate-300 border-slate-600";
                                    badgeStyle = "bg-slate-600/30 text-slate-300 border-slate-600";
                                    badgeText = "🥈 2. UZMAN";
                                } else if (index === 2) {
                                    cardStyle = "bg-orange-900/20 border-orange-800 hover:border-orange-600";
                                    avatarStyle = "bg-orange-800/30 text-orange-400 border-orange-800";
                                    badgeStyle = "bg-orange-800/30 text-orange-400 border-orange-800";
                                    badgeText = "🥉 3. UZMAN";
                                }

                                return (
                                    <div key={index} onClick={() => { setSelectedPersonel(p); setActiveModal('personel_detay'); }} 
                                        className={`p-4 rounded-2xl border flex items-center justify-between cursor-pointer transition-all group ${cardStyle}`}>
                                        <div className="flex items-center gap-4">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm border-2 ${avatarStyle}`}>
                                                {index + 1}
                                            </div>
                                            <div>
                                                <h4 className={`font-semibold text-sm flex items-center gap-1.5 transition-colors text-slate-200 group-hover:text-white`}>
                                                    {p.isim}
                                                </h4>
                                                <div className="flex gap-3 mt-1.5 border-t border-slate-800 group-hover:border-slate-700 pt-1.5">
                                                    <span className="text-[10px] font-medium text-slate-400 bg-slate-800/50 border border-slate-700/50 px-1.5 py-0.5 rounded-sm">Puan: {p.toplamPuan}</span>
                                                    <span className="text-[10px] font-bold text-emerald-400 bg-emerald-900/30 px-1.5 py-0.5 rounded-sm">Tahmin: {p.puanTahmin}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right flex items-center gap-4">
                                            <div className={`px-2 py-1 rounded-lg text-[9px] font-bold tracking-widest border transition-all ${badgeStyle}`}>
                                                {badgeText}
                                            </div>
                                        </div>
                                    </div>
                                );
                            }) : (
                                <div className="h-full flex flex-col items-center justify-center opacity-50">
                                    <p className="font-medium text-slate-500 uppercase text-xs tracking-widest text-center">Şubeye ait personel<br/>verisi bekleniyor</p>
                                </div>
                            )}
                        </div>
                    </div>
                 </div>
             )}

            {!isCmr && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-[#1E293B] rounded-3xl p-8 border border-slate-700/50 shadow-sm flex flex-col">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-12 h-12 rounded-xl bg-sky-900/30 text-sky-400 flex items-center justify-center shrink-0 border border-sky-800/50">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-white tracking-tight">Merkez Duyuruları</h3>
                            </div>
                        </div>
                        <div className="bg-[#0F172A] rounded-xl p-6 flex-1 border border-slate-800 shadow-inner">
                            <p className="text-slate-300 font-medium leading-relaxed whitespace-pre-wrap text-sm md:text-base">
                                {config.Duyuru_Metni || "Şu an için aktif bir mağaza duyurusu bulunmamaktadır."}
                            </p>
                        </div>
                    </div>

                    <div className="bg-[#1E293B] rounded-3xl p-8 border border-slate-700/50 shadow-sm flex flex-col overflow-hidden relative">
                        <div className="flex items-center gap-4 mb-6 relative z-10">
                            <div className="w-12 h-12 rounded-xl bg-orange-900/30 text-orange-400 flex items-center justify-center shrink-0 border border-orange-800/50">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" /></svg>
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-white tracking-tight">Aktif Kampanyalar</h3>
                            </div>
                        </div>
                        <div className="flex-1 flex items-center justify-center bg-[#0F172A] rounded-xl border border-slate-800 shadow-inner py-8 relative z-10 overflow-hidden">
                            <div className="whitespace-nowrap animate-marquee font-bold text-lg md:text-xl tracking-wide text-orange-400 px-4">
                                 {config.Kampanya_Metni || "GÜNCEL KAMPANYA BULUNMAMAKTADIR"}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* SAĞ ALT YÜZEN BUTONLAR */}
            <div className="fixed bottom-10 right-8 z-40 flex flex-col gap-4 items-end">
                {izinlerAktifMi && (
                    <button onClick={() => setActiveModal('izinler')} className="w-14 h-14 bg-[#1E293B] hover:bg-slate-700 border border-slate-700/50 rounded-2xl flex items-center justify-center text-purple-400 shadow-xl shadow-slate-950/20 hover:shadow-2xl transition-all group relative">
                        <svg className="w-6 h-6 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        <span className="absolute bottom-full right-0 mb-3 px-3 py-1 bg-[#0F172A] text-white text-[10px] rounded-lg font-bold shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">İzinler 🏝️</span>
                    </button>
                )}

                {hedeflerAktifMi && (
                    <button onClick={() => setActiveModal('hedefler')} className="w-14 h-14 bg-[#1E293B] hover:bg-slate-700 border border-slate-700/50 rounded-2xl flex items-center justify-center text-sky-400 shadow-xl shadow-slate-950/20 hover:shadow-2xl transition-all group relative">
                        <svg className="w-6 h-6 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                        <span className="absolute bottom-full right-0 mb-3 px-3 py-1 bg-[#0F172A] text-white text-[10px] rounded-lg font-bold shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">Hedefler 🎯</span>
                    </button>
                )}
            </div>

            {/* MODALLAR */}
            {activeModal && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center px-4">
                    <div className="absolute inset-0 bg-[#0B1120]/80 backdrop-blur-sm transition-opacity" onClick={() => setActiveModal(null)}></div>
                    
                    {/* İZİNLER MODALI */}
                    {activeModal === 'izinler' && (
                        <div className="relative bg-[#0F172A] border border-slate-800 rounded-[2rem] w-[98vw] max-w-[1600px] shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden flex flex-col max-h-[90vh]">
                            <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-[#1E293B]/50">
                                <h3 className="text-lg md:text-xl font-bold text-white flex items-center gap-3">
                                    <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                    Personel İzin Takvimi
                                </h3>
                                <button onClick={() => setActiveModal(null)} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-800 text-slate-400 hover:bg-rose-500/20 hover:text-rose-400 transition-colors">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>
                                                                        
                            <div className="flex-1 overflow-hidden p-4 flex flex-col">
                                {tumIzinler.length > 0 ? (
                                    <div className="bg-[#1E293B] rounded-xl border border-slate-700/50 shadow-sm w-full flex-1 overflow-y-auto custom-scrollbar">
                                        <table className="w-full text-center border-collapse">
                                            <thead className="sticky top-0 z-20">
                                                <tr className="bg-slate-800 text-slate-300">
                                                    {izinTarihBasliklari.map((cell: any, idx: number) => (
                                                        <th key={`tarih-${idx}`} className="px-2 py-3 border border-slate-700/50 text-[10px] font-bold uppercase">
                                                            {idx === 0 && (!cell || cell === "") ? "ŞUBE" : cell}
                                                        </th>
                                                    ))}
                                                </tr>
                                                <tr className="bg-[#0F172A] text-slate-400 border-b-2 border-slate-700/80">
                                                    {izinGunBasliklari.map((cell: any, idx: number) => (
                                                        <th key={`gun-${idx}`} className="px-2 py-2 border border-slate-700/50 text-[10px] font-medium uppercase">
                                                            {cell}
                                                        </th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {tumIzinler.map((row: any, rowIndex: number) => {
                                                    const isNewBranch = row[0] && String(row[0]).trim() !== "";
                                                    if (isNewBranch) aktifSubeRenkIndex++;
                                                    
                                                    const currentColors = izinRenkleri[Math.max(0, aktifSubeRenkIndex) % izinRenkleri.length];
                                                    const maxColCount = Math.max(izinTarihBasliklari.length, izinGunBasliklari.length, 7);
                                                    
                                                    return (
                                                        <tr key={rowIndex} className={`bg-[#0F172A] ${isNewBranch ? 'border-t-2 border-slate-700' : ''}`}>
                                                            {Array.from({ length: maxColCount }).map((_, cellIndex) => {
                                                                const cellValue = row[cellIndex] || "";
                                                                const isIzin = String(cellValue).toUpperCase().includes("İZİN");
                                                                let cellClasses = "px-2 py-2 border border-slate-800/80 text-[11px] align-middle ";
                                                                
                                                                if (cellIndex === 0) {
                                                                    cellClasses += isNewBranch ? `${currentColors.bg} ${currentColors.text} font-bold` : "font-medium text-slate-400 bg-slate-900/50";
                                                                } else if (cellIndex === 1) {
                                                                    cellClasses += "font-medium text-slate-300";
                                                                } else if (isIzin) {
                                                                    cellClasses += `${currentColors.badge} font-bold rounded-sm`;
                                                                } else {
                                                                    cellClasses += "text-slate-500";
                                                                }

                                                                return <td key={cellIndex} className={cellClasses}>{cellValue}</td>;
                                                            })}
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-16 opacity-50">
                                        <h4 className="text-lg font-bold text-slate-400 mb-1">İzin Kaydı Bulunamadı</h4>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* HEDEFLER MODALI */}
                    {activeModal === 'hedefler' && (
                        <div className="relative bg-[#0F172A] border border-slate-800 rounded-[2rem] w-[98vw] max-w-[1600px] shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden flex flex-col max-h-[90vh]">
                            <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-[#1E293B]/50">
                                <h3 className="text-lg md:text-xl font-bold text-white flex items-center gap-3">
                                    <svg className="w-6 h-6 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                    {selectedBranch} Personel Hedefleri
                                </h3>
                                <button onClick={() => setActiveModal(null)} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-800 text-slate-400 hover:bg-rose-500/20 hover:text-rose-400 transition-colors">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>
                                                                        
                            <div className="flex-1 overflow-hidden p-4 flex flex-col">
                                {seciliSubeHedefleri.length > 0 ? (
                                    <div className="bg-[#1E293B] rounded-xl border border-slate-700/50 shadow-sm w-full flex-1 overflow-y-auto custom-scrollbar">
                                        <table className="w-full text-center">
                                            <thead className="sticky top-0 z-20 bg-slate-800 text-slate-300">
                                                <tr>
                                                    {hedeflerBasliklar.map((baslik: any, idx: number) => (
                                                        <th key={idx} className="px-2 py-3 border border-slate-700/50 text-[10px] font-bold uppercase">{baslik}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {seciliSubeHedefleri.map((row: any, rowIndex: number) => (
                                                    <tr key={rowIndex} className="hover:bg-slate-800/50 transition-colors bg-[#0F172A]">
                                                        {hedeflerBasliklar.map((_: any, cellIndex: number) => (
                                                            <td key={cellIndex} className={`px-2 py-2.5 border border-slate-800/80 text-[11px] ${cellIndex === 1 ? 'font-medium text-sky-400' : 'text-slate-400'}`}>
                                                                {row[cellIndex] || 0}
                                                            </td>
                                                        ))}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-16 opacity-50">
                                        <h4 className="text-lg font-bold text-slate-400 mb-1">Hedef Verisi Bulunamadı</h4>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* TAHMİN MODALI */}
                    {activeModal === 'tahmin' && (
                        <div className="relative bg-[#0F172A] border border-slate-800 rounded-3xl w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden flex flex-col">
                            <div className="flex justify-between items-center p-5 border-b border-slate-800">
                                <h3 className="text-lg font-bold text-white">Ay Sonu {anaMetrikAdi} Tahmini</h3>
                                <button onClick={() => setActiveModal(null)} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-800 text-slate-400 hover:bg-slate-700 transition-colors">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>
                            <div className="p-6 space-y-5">
                                {!anaBasarili ? (
                                    <div className="bg-rose-900/10 border border-rose-800/50 rounded-xl p-4 flex gap-3">
                                        <div>
                                            <h4 className="text-rose-400 font-bold text-sm mb-1">Hedefin Gerisindesiniz!</h4>
                                            <p className="text-rose-500/70 text-[11px] leading-relaxed">Mevcut satış hızınıza göre ay sonu tahmini {anaProjeksiyon} adet, hedefinizin ({anaHedef}) altında kalıyor.</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-emerald-900/10 border border-emerald-800/50 rounded-xl p-4 flex gap-3">
                                        <div>
                                            <h4 className="text-emerald-400 font-bold text-sm mb-1">Harika Gidiyorsunuz!</h4>
                                            <p className="text-emerald-500/70 text-[11px] leading-relaxed">Mevcut hızınızla hedefi aşarak ay sonunu {anaProjeksiyon} adetle kapatmanız öngörülüyor.</p>
                                        </div>
                                    </div>
                                )}
                                <div className="flex justify-between items-center bg-[#1E293B] border border-slate-700/50 rounded-xl p-5">
                                    <div><p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">Gidişata Göre Ay Sonu</p></div>
                                    <div className="flex items-baseline gap-1">
                                        <span className={`text-3xl font-bold ${anaBasarili ? 'text-emerald-400' : 'text-rose-400'}`}>{anaProjeksiyon}</span>
                                        <span className="text-slate-500 text-sm font-medium">Adet</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                    
                    {/* DEPARTMAN MODALI */}
                    {activeModal === 'departman' && dinamikMagazaMetrikleri.length > 0 && (
                        <div className="relative bg-[#0F172A] border border-slate-800 rounded-[2rem] w-full max-w-4xl shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden">
                            <div className="flex justify-between items-start p-6 border-b border-slate-800 bg-[#1E293B]/30">
                                <div>
                                    <h3 className="text-xl font-bold text-white">{selectedBranch} Departman Hedefleri</h3>
                                </div>
                                <button onClick={() => setActiveModal(null)} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-800 text-slate-400 hover:bg-slate-700 transition-colors mt-1">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>
                            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto max-h-[70vh] custom-scrollbar">
                                {dinamikMagazaMetrikleri.map((metrik, idx) => (
                                    <DepartmanProgressBar key={idx} title={metrik.name} data={metrik.data} colorClass={metrik.color} />
                                ))}
                            </div>
                        </div>
                    )}
                    
                    {/* PERSONEL DETAY MODALI */}
                    {activeModal === 'personel_detay' && selectedPersonel && (
                        <div className="relative bg-[#0F172A] border border-slate-800 rounded-[2rem] w-full max-w-5xl shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden flex flex-col max-h-[90vh]">
                            <div className="flex justify-between items-start p-6 border-b border-slate-800 shrink-0 bg-[#1E293B]/30">
                                <div>
                                    <h3 className="text-xl font-bold text-white flex items-center gap-3">
                                        {selectedPersonel.isim} 
                                        <span className="bg-sky-900/30 border border-sky-800/50 text-sky-400 text-[10px] px-2.5 py-1 rounded-lg tracking-widest shadow-sm font-medium">Genel Puan: {selectedPersonel.toplamPuan}</span>
                                    </h3>
                                </div>
                                <button onClick={() => setActiveModal(null)} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-800 text-slate-400 hover:bg-slate-700 transition-colors">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>
                            <div className="p-6 overflow-y-auto custom-scrollbar">
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {dinamikBaremler.map((barem, i) => {
                                        const hedef = selectedPersonel.hedefler[barem.name] || 0;
                                        const satilan = selectedPersonel.gerceklesen[barem.name] || 0;
                                        const baremRule = dinamikPuanKurallari[cleanKey(barem.name)];
                                        const isBelowBaraj = baremRule?.kural70 && (hedef > 0 ? (satilan / hedef < 0.7) : false);
                                        const baremPuanVal = calculatePoint(satilan, hedef, barem.name, false);

                                        if (hedef === 0 && satilan === 0) return null;
                                        return (
                                            <DepartmanProgressBar 
                                                key={i} 
                                                title={barem.name} 
                                                data={{ hedef, satilan, isCurrency: barem.isCurrency }} 
                                                colorClass={barem.color} 
                                                puan={baremPuanVal.toFixed(1)}
                                                isRiskliBarem={isBelowBaraj}
                                            />
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
