import React, { useEffect, useState } from 'react';

export default function AnaSayfa({ selectedBranch, setAppMode, config, gidisatData = [], personelData = [], hedeflerData = [] }: any) {
    // --- MODAL KONTROLLERİ ---
    const [activeModal, setActiveModal] = useState<'tahmin' | 'departman' | 'personel_detay' | 'hedefler' | null>(null);
    const [selectedPersonel, setSelectedPersonel] = useState<any>(null);

    const isCmr = selectedBranch.includes('CMR');

    // Vodofone ve Zumay kanallarında butonu gizleme mantığı
    const branchLower = selectedBranch.toLowerCase();
    const hedeflerAktifMi = !branchLower.includes('vodofone') && !branchLower.includes('vodafone') && !branchLower.includes('zumay');

    // --- TÜRKİYE FORMATINA UYGUN GELİŞMİŞ SAYI OKUMA MOTORU (150.000 DÜZELTMESİ) ---
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

    // --- İSİM EŞLEŞTİRME MOTORUNU GÜÇLENDİR ---
    const cleanKey = (s: string) => {
        return String(s || "")
            .replace(/[\s\.\-\+]/g, "") 
            .toLocaleUpperCase('tr-TR'); 
    };

    // --- TARİH DEDEKTİFİ (E-TABLODAKİ GÜNCELLENEN TARİHİ ÇEKER) ---
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

    // --- E-TABLODAKİ TARİHE GÖRE GÜN VE AY HESAPLAMALARI (GİDİŞAT İÇİN KRİTİK) ---
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

    // --- HASSAS PUAN HESAPLAMA MOTORU (PERSONEL İÇİN) ---
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
    
    // =========================================================================
    // 🚀 1. %100 DİNAMİK MAĞAZA (GİDİŞAT) VERİSİNİ AYIKLA
    // =========================================================================
    let dinamikMagazaMetrikleri: any[] = [];
    let magazaAnlikPuan = 0;
    let magazaTahminPuan = 0;
    
    let anaSatis = 0;
    let anaHedef = 0;
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

        for (let i = hIdx + 1; i < gIdx; i++) {
            if (String(gidisatData[i]?.[0] || "").trim().toUpperCase() === brUpper) { hedefRow = gidisatData[i]; break; }
        }
        for (let i = gIdx + 1; i < pIdx; i++) {
            if (String(gidisatData[i]?.[0] || "").trim().toUpperCase() === brUpper || String(gidisatData[i]?.[1] || "").trim().toUpperCase() === brUpper) { 
                gerceklesenRow = gidisatData[i]; break; 
            }
        }

        const puanRow = gidisatData[pIdx + 1];
        const maxPuanRow = gidisatData[pIdx + 2];
        const colorPalette = ["bg-sky-500", "bg-purple-500", "bg-orange-500", "bg-emerald-500", "bg-blue-500", "bg-rose-500", "bg-amber-500", "bg-indigo-500", "bg-fuchsia-500"];
        let colorIndex = 0;

        const calcStorePts = (actual: number, target: number, hp: number, mp: number, isProj: boolean) => {
            if (!target || target === 0 || !hp) return 0;
            const val = isProj ? (actual / currentDay) * daysInMonth : actual;
            const perf = val / target;
            let calculated = perf * hp;
            return Math.min(mp || hp, calculated);
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

                dinamikMagazaMetrikleri.push({
                    name: hName,
                    color: colorPalette[colorIndex % colorPalette.length],
                    data: {
                        hedef: hVal,
                        satilan: sVal,
                        isCurrency: isCurr,
                        hedefPuan: hpVal,
                        maxPuan: mpVal,
                        anlikPuan: anlikPts,
                        tahminPuan: tahminPts
                    }
                });

                if (colorIndex === 0) {
                    anaSatis = sVal; anaHedef = hVal; anaMetrikAdi = hName;
                }
                colorIndex++;
            }
        });
    }

    const anaProjeksiyon = Math.round((anaSatis / currentDay) * daysInMonth);
    const anaBasarili = anaProjeksiyon >= anaHedef;

    // --- 2. %100 DİNAMİK PERSONEL VERİSİ MOTORU ---
    let aktifPersoneller: any[] = [];
    let sirketSampiyonlari: any[] = [];
    let dinamikBaremler: any[] = [];
    
    if (personelData && personelData.length > 0) {
        const colorPalette = ["bg-sky-500", "bg-emerald-500", "bg-purple-500", "bg-indigo-500", "bg-orange-500", "bg-rose-500", "bg-amber-500", "bg-blue-500", "bg-fuchsia-500"];

        const gerceklesenIndex = personelData.findIndex((row: any) => 
            Array.isArray(row) && row.some((cell: any) => typeof cell === 'string' && cell.toLowerCase().includes('gerçekleşen'))
        );

        const baslikSatiri = personelData[0] || [];
        baslikSatiri.forEach((cell: any, index: number) => {
            if (index >= 2) {
                const baslikAdi = String(cell || "").trim();
                if (baslikAdi && !baslikAdi.toLowerCase().includes('gerçekleşen') && !baslikAdi.toLowerCase().includes('isim')) {
                    const isCurrency = ['KAZANÇ', 'CİRO', 'TL', 'SERVİS', '₺'].some(keyword => baslikAdi.toUpperCase().includes(keyword));
                    dinamikBaremler.push({
                        indexOffset: index - 2,
                        orijinalIndex: index,
                        name: baslikAdi,
                        isCurrency: isCurrency,
                        color: colorPalette[dinamikBaremler.length % colorPalette.length]
                    });
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
                    personelDict[isim] = {
                        isim: isim,
                        magaza: magaza.toUpperCase(),
                        hedefler: {},
                        gerceklesen: {},
                        anaHedef: 0,
                        anaSatilan: 0
                    };
                }
                
                dinamikBaremler.forEach(barem => {
                    const deger = parseNum(row[barem.orijinalIndex]);
                    personelDict[isim].hedefler[barem.name] = (personelDict[isim].hedefler[barem.name] || 0) + deger;
                    if (barem.indexOffset === 0) personelDict[isim].anaHedef += deger;
                });
            }
        });

        gerceklesenRows.forEach((row: any) => {
            if (!Array.isArray(row)) return;
            const isimA = row[0]?.trim() || "";
            const isimB = row[1]?.trim() || "";
            
            let matchedName = "";
            let dataStartOffset = 0;

            if (personelDict[isimA]) {
                matchedName = isimA; dataStartOffset = 1; 
            } else if (personelDict[isimB]) {
                matchedName = isimB; dataStartOffset = 2; 
            }

            if (matchedName) {
                dinamikBaremler.forEach(barem => {
                    const deger = parseNum(row[dataStartOffset + barem.indexOffset]);
                    personelDict[matchedName].gerceklesen[barem.name] = (personelDict[matchedName].gerceklesen[barem.name] || 0) + deger;
                    if (barem.indexOffset === 0) personelDict[matchedName].anaSatilan += deger;
                });
            }
        });

        aktifPersoneller = Object.values(personelDict)
            .filter((p: any) => p.magaza.includes(selectedBranch.trim().toUpperCase()))
            .map((p: any) => {
                let pAnlik = 0, pTahmin = 0;
                dinamikBaremler.forEach(barem => {
                    const bn = barem.name;
                    const hVal = p.hedefler[bn] || 0;
                    const gVal = p.gerceklesen[bn] || 0;
                    pAnlik += calculatePoint(gVal, hVal, bn, false);
                    pTahmin += calculatePoint(gVal, hVal, bn, true);
                });

                const projeksiyon = Math.round((p.anaSatilan / currentDay) * daysInMonth);
                return {
                    ...p,
                    projeksiyon,
                    toplamPuan: pAnlik.toFixed(1),
                    puanTahmin: pTahmin.toFixed(1),
                    basariYuzdesi: p.anaHedef > 0 ? Math.min(100, Math.round((p.anaSatilan / p.anaHedef) * 100)) : 0,
                    isBasarili: projeksiyon >= p.anaHedef
                };
            })
            .sort((a: any, b: any) => parseFloat(b.puanTahmin) - parseFloat(a.puanTahmin));

        sirketSampiyonlari = Object.values(personelDict)
            .filter((p: any) => p.magaza.includes('CMR')) 
            .map((p: any) => {
                let pAnlik = 0, pTahmin = 0;
                dinamikBaremler.forEach(barem => {
                    const bn = barem.name;
                    const hVal = p.hedefler[bn] || 0;
                    const gVal = p.gerceklesen[bn] || 0;
                    pAnlik += calculatePoint(gVal, hVal, bn, false);
                    pTahmin += calculatePoint(gVal, hVal, bn, true);
                });
                return {
                    ...p,
                    toplamPuan: pAnlik.toFixed(1),
                    puanTahmin: pTahmin.toFixed(1),
                };
            })
            .sort((a: any, b: any) => parseFloat(b.puanTahmin) - parseFloat(a.puanTahmin))
            .slice(0, 3); 
    }

    // Sadece bu şubeye ait Hedefler Datasını ayıklama
    const seciliSubeHedefleri = (hedeflerData || []).filter((row: any) => 
        Array.isArray(row) && String(row[0] || "").toUpperCase() === selectedBranch.toUpperCase().trim()
    );
    const hedeflerBasliklar = hedeflerData[0] || [];

    // --- PROGRESS BAR BİLEŞENİ ---
    const DepartmanProgressBar = ({ title, data, colorClass, puan, isRiskliBarem }: any) => {
        if (!data || data.hedef === 0) return null;
        const kalan = Math.max(0, data.hedef - data.satilan);
        const yuzde = data.hedef > 0 ? Math.min(100, Math.round((data.satilan / data.hedef) * 100)) : 0;
        const projeksiyon = Math.round((data.satilan / currentDay) * daysInMonth);
        const isBasarili = projeksiyon >= data.hedef;
        
        const isRisky = (data.hedef > 0 && !isBasarili) || isRiskliBarem;

        const formatVal = (v: number) => data.isCurrency 
            ? `${v.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ₺` 
            : `${v.toLocaleString('tr-TR')}`;

        return (
            <div className={`bg-[#1E293B] border ${isRisky ? 'border-rose-500/50 shadow-[0_0_15px_rgba(244,63,94,0.1)]' : 'border-slate-700/50'} rounded-2xl p-4 flex flex-col justify-between relative overflow-hidden transition-all hover:bg-slate-800`}>
                {data.hedef > 0 && (
                    <div className={`absolute top-0 right-4 text-white text-[8px] font-black px-2 py-0.5 rounded-b-md tracking-widest shadow-sm ${isBasarili ? 'bg-emerald-500' : 'bg-rose-500'}`}>
                        {isBasarili ? 'BAŞARILI' : 'RİSKLİ'}
                    </div>
                )}

                {data.hedefPuan > 0 && (
                     <div className="absolute top-0 left-0 bg-sky-500/20 border-b border-r border-sky-500/30 text-sky-400 text-[10px] font-black px-3 py-1.5 rounded-br-xl tracking-widest shadow-sm flex items-center gap-1.5">
                        <span className="text-[12px] animate-pulse">⚡</span>
                        ANLIK PUAN: {data.anlikPuan?.toFixed(1)}
                    </div>
                )}
                
                <div className="flex justify-between items-start mb-3 mt-4">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{title}</h4>
                    {puan !== undefined && !data.hedefPuan && (
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded ${isRiskliBarem ? 'bg-rose-500/20 text-rose-400' : 'bg-sky-500/20 text-sky-400'}`}>
                            Puan: {puan}
                        </span>
                    )}
                </div>

                <div className="flex justify-between items-end mb-2">
                    <p className="text-xl font-black text-white">{formatVal(data.satilan)} <span className="text-xs font-medium text-slate-500">/ {formatVal(data.hedef)}</span></p>
                    <div className="text-right">
                        <p className={`text-[9px] font-black uppercase tracking-wider ${kalan > 0 ? (isRisky ? 'text-rose-500' : 'text-[#E11D48]') : 'text-emerald-500'}`}>
                            {data.hedef > 0 ? (kalan > 0 ? `Kalan: ${formatVal(kalan)}` : 'TAMAMLANDI') : 'HEDEF YOK'}
                        </p>
                    </div>
                </div>

                {isRiskliBarem && (
                   <div className="bg-rose-500/10 border border-rose-500/20 rounded-lg py-1 px-2 mb-2 animate-pulse">
                        <p className="text-[8px] font-black text-rose-500 text-center uppercase tracking-tighter">
                            ⚠️ BARAJ ALTINDA (Puan Alınamıyor)
                        </p>
                   </div>
                )}

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
                            Cnetmobil Terminal Sistemi V2.5
                        </p>
                    </div>
                </div>
                <button onClick={() => setAppMode('alim')} className="relative z-10 group bg-white text-sky-600 px-7 py-4 rounded-2xl font-bold text-sm tracking-wide shadow-xl hover:shadow-2xl hover:bg-slate-50 transition-all duration-300 flex items-center gap-3 transform hover:-translate-y-1">
                    <div className="bg-sky-50 p-2 rounded-xl group-hover:bg-sky-100 transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                    </div>
                    Cihaz Alımını Başlat
                </button>
            </div>

            {isCmr && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
                    <div className="w-full h-full">
                        <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-6 sm:p-8 border border-slate-100 dark:border-slate-800 shadow-sm h-full flex flex-col justify-center min-h-[320px]">
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <h3 className="text-xl md:text-2xl font-extrabold text-slate-800 dark:text-white flex items-center gap-2 tracking-tight">
                                        CnetMobil <span className="font-medium text-slate-500 dark:text-slate-400">- {selectedBranch}</span>
                                    </h3>
                                    {lastUpdatedDate && (
                                        <div className="mt-2 inline-flex items-center gap-1.5 bg-sky-50 dark:bg-sky-900/20 border border-sky-100 dark:border-sky-800 text-sky-600 dark:text-sky-400 text-[10px] font-black px-2.5 py-1 rounded-lg uppercase tracking-widest shadow-sm">
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                            SON GÜNCELLEME: {lastUpdatedDate}
                                        </div>
                                    )}
                                </div>
                                <button onClick={() => setActiveModal('departman')} className="bg-[#4CAF50] hover:bg-[#43A047] text-white px-5 py-2.5 rounded-xl font-black text-lg flex items-center gap-2 transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5 border-b-4 border-green-700 active:border-b-0 active:translate-y-1">
                                    {magazaAnlikPuan.toFixed(1)} Puan <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
                                </button>
                            </div>
                            {dinamikMagazaMetrikleri.length > 0 ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 cursor-pointer">
                                    <div className="bg-[#FDF8F3] border border-[#F2E5D5] rounded-3xl p-5 relative overflow-hidden transition-all hover:shadow-md">
                                        <p className="text-slate-700 font-bold text-sm mb-3">Bu Ay Toplam {anaMetrikAdi}</p>
                                        <div className="flex items-baseline gap-1.5">
                                            <span className="text-4xl font-black text-slate-900">{anaSatis}</span>
                                            <span className="text-sm font-bold text-slate-500">Adet</span>
                                        </div>
                                    </div>
                                    <div onClick={() => setActiveModal('tahmin')} className="bg-[#FEF2F2] border border-[#FEE2E2] rounded-3xl p-5 relative overflow-hidden transition-all hover:shadow-md hover:border-rose-300 group">
                                        {!anaBasarili && (
                                            <div className="absolute top-4 right-4 bg-[#FB7185] text-white text-[9px] px-2.5 py-1 rounded-md font-black tracking-widest uppercase shadow-sm z-10 flex items-center gap-1">
                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                                RİSKLİ GİDİŞAT
                                            </div>
                                        )}
                                        <p className="text-rose-600 font-bold text-sm mb-3 flex items-center gap-2">
                                            <span className="text-lg">⏳</span> Ay Sonu {anaMetrikAdi} Tahmini
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
                            ) : (
                                <div className="h-24 flex flex-col items-center justify-center text-center opacity-50 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">VERİ BEKLENİYOR</p>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-6 border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col h-full min-h-[320px] max-h-[380px]">
                        <div className="flex items-center justify-between mb-4 shrink-0">
                            <div>
                                <h3 className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-tight">Personel Gidişat</h3>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">ŞUBE LİDERLİK TABLOSU</p>
                            </div>
                            <div className="text-right">
                                <span className="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[9px] px-2.5 py-1.5 rounded-xl font-black border border-slate-200 dark:border-slate-700 shadow-sm">
                                    GÜNCELLEME: {lastUpdatedDate || "---"}
                                </span>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
                            {aktifPersoneller.length > 0 ? aktifPersoneller.map((p: any, index: number) => {
                                const getRank = (puan: number) => {
                                    const pVal = parseFloat(puan.toString());
                                    if (pVal >= 9.0) return { label: 'PRO', color: 'text-sky-500', bg: 'bg-sky-500/10', border: 'border-sky-500/20' };
                                    return { label: 'STANDART', color: 'text-slate-400', bg: 'bg-slate-400/10', border: 'border-slate-400/20' };
                                };
                                const rank = getRank(p.toplamPuan);
                                const trendUp = parseFloat(p.puanTahmin) >= parseFloat(p.toplamPuan);

                                return (
                                    <div key={index} onClick={() => { setSelectedPersonel(p); setActiveModal('personel_detay'); }} 
                                        className={`p-4 rounded-3xl border flex items-center justify-between cursor-pointer transition-all group relative overflow-hidden ${
                                            index === 0 ? 'bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-amber-900/40 dark:to-yellow-900/20 border-amber-400 dark:border-amber-500 shadow-[0_0_20px_rgba(251,191,36,0.3)] transform hover:-translate-y-1 hover:shadow-[0_0_25px_rgba(251,191,36,0.5)] z-10' :
                                            index === 1 ? 'bg-gradient-to-r from-slate-100 to-white dark:from-slate-700/30 dark:to-slate-800/50 border-slate-200 dark:border-slate-600 hover:shadow-md hover:border-slate-300' :
                                            index === 2 ? 'bg-gradient-to-r from-orange-50 to-white dark:from-orange-900/20 dark:to-slate-800/50 border-orange-200 dark:border-orange-700/50 hover:shadow-md hover:border-orange-300' :
                                            'bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-700 hover:bg-sky-50 hover:border-sky-200'
                                        }`}>
                                        
                                        {index === 0 && (
                                            <>
                                                <div className="absolute -top-10 -left-10 w-32 h-32 bg-yellow-300/30 rounded-full blur-2xl animate-pulse"></div>
                                                <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-amber-400/20 rounded-full blur-2xl animate-pulse delay-75"></div>
                                                <div className="absolute top-2 left-1/4 text-[10px] animate-ping opacity-70">✨</div>
                                                <div className="absolute bottom-2 right-1/3 text-[12px] animate-bounce opacity-50">🌟</div>
                                                <div className="absolute top-4 right-1/4 text-[8px] animate-ping delay-150 opacity-60">✨</div>
                                            </>
                                        )}

                                        <div className="flex items-center gap-4 relative z-10">
                                            <div className="relative">
                                                {index === 0 && (
                                                    <span className="absolute inset-0 rounded-full bg-amber-400 animate-ping opacity-50"></span>
                                                )}
                                                <div className={`relative w-11 h-11 rounded-full flex items-center justify-center font-black text-sm border-2 border-white dark:border-slate-800 ${
                                                    index === 0 ? 'bg-gradient-to-br from-yellow-300 to-amber-500 text-white shadow-lg shadow-amber-500/40' : 
                                                    index === 1 ? 'bg-gradient-to-br from-slate-300 to-slate-500 text-white shadow-lg shadow-slate-500/40' : 
                                                    index === 2 ? 'bg-gradient-to-br from-orange-300 to-rose-400 text-white shadow-lg shadow-orange-500/40' : 
                                                    'bg-slate-200 text-slate-500'
                                                }`}>
                                                    {index + 1}
                                                </div>
                                            </div>
                                            <div>
                                                <h4 className={`font-bold text-sm flex items-center gap-1.5 transition-colors ${index === 0 ? 'text-amber-700 dark:text-amber-400 text-base' : 'text-slate-800 dark:text-white group-hover:text-sky-700'}`}>
                                                    {p.isim}
                                                    <span className={trendUp ? 'text-emerald-500' : 'text-rose-500'}>
                                                        {trendUp ? '↗' : '↘'}
                                                    </span>
                                                </h4>
                                                <div className="flex gap-2 mt-1">
                                                    <span className={`text-[10px] font-black px-2 py-0.5 rounded shadow-sm ${index === 0 ? 'text-amber-800 bg-amber-200/50' : 'text-emerald-600 bg-emerald-50'}`}>Puan: {p.toplamPuan}</span>
                                                    <span className={`text-[10px] font-bold uppercase tracking-tighter opacity-70 ${index === 0 ? 'text-amber-600' : 'text-slate-400'}`}>Tahmin: {p.puanTahmin}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="text-right flex items-center gap-4 relative z-10">
                                            <div className="flex flex-col items-end">
                                                {index === 0 ? (
                                                    <div className="px-3.5 py-1.5 rounded-xl text-[11px] font-black tracking-widest bg-gradient-to-r from-yellow-400 via-amber-500 to-yellow-600 text-white shadow-[0_0_15px_rgba(245,158,11,0.6)] border border-yellow-300 flex items-center gap-2 transform group-hover:scale-105 transition-all">
                                                        <span className="text-[16px] animate-bounce inline-block">🏆</span> SATIŞ LİDERİ
                                                    </div>
                                                ) : index === 1 ? (
                                                    <div className="px-3.5 py-1.5 rounded-xl text-[10px] font-black tracking-widest bg-gradient-to-r from-slate-400 to-slate-500 text-white shadow-[0_0_12px_rgba(148,163,184,0.5)] border border-slate-300/50 flex items-center gap-2 transform group-hover:scale-105 transition-all">
                                                        <span className="text-[14px]">🥈</span> ELİT SATICI
                                                    </div>
                                                ) : index === 2 ? (
                                                    <div className="px-3.5 py-1.5 rounded-xl text-[10px] font-black tracking-widest bg-gradient-to-r from-orange-400 to-rose-500 text-white shadow-[0_0_12px_rgba(249,115,22,0.4)] border border-orange-300/50 flex items-center gap-2 transform group-hover:scale-105 transition-all">
                                                        <span className="text-[14px]">🥉</span> UZMAN SATICI
                                                    </div>
                                                ) : (
                                                    <div className={`px-3 py-1 rounded-xl text-[9px] font-black tracking-widest border transition-all ${rank.bg} ${rank.color} ${rank.border} group-hover:scale-105`}>
                                                        {rank.label}
                                                    </div>
                                                )}
                                            </div>
                                            <div className={`transition-all transform group-hover:translate-x-1 ${index === 0 ? 'text-amber-500' : 'text-slate-300 group-hover:text-sky-500'}`}>
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
                                            </div>
                                        </div>
                                    </div>
                                );
                            }) : (
                                <div className="h-full flex flex-col items-center justify-center opacity-50">
                                    <p className="font-bold text-slate-400 uppercase text-xs tracking-widest text-center">Şubeye ait personel<br/>verisi bekleniyor</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {!isCmr ? (
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
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" /></svg>
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
            ) : (
                <div className="bg-white dark:bg-[#1e293b] rounded-[2rem] p-8 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-900/30 text-amber-500 flex items-center justify-center shrink-0 shadow-inner">
                                <span className="text-3xl animate-bounce">🏆</span>
                            </div>
                            <div>
                                <h3 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Şirket Şampiyonları</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Tüm CMR Şubeleri Arası Liderlik Tablosu (İlk 3)</p>
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800/50 p-2 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm">
                            <div className="flex items-center gap-2 px-3 border-r border-slate-200 dark:border-slate-700">
                                <span className="text-lg">🥇</span>
                                <div className="flex flex-col">
                                    <span className="text-[9px] font-bold text-slate-400 uppercase">1. Ödülü</span>
                                    <span className="text-sm font-black text-amber-500">+5 Puan</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 px-3 border-r border-slate-200 dark:border-slate-700">
                                <span className="text-lg">🥈</span>
                                <div className="flex flex-col">
                                    <span className="text-[9px] font-bold text-slate-400 uppercase">2. Ödülü</span>
                                    <span className="text-sm font-black text-slate-500">+3 Puan</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 px-3">
                                <span className="text-lg">🥉</span>
                                <div className="flex flex-col">
                                    <span className="text-[9px] font-bold text-slate-400 uppercase">3. Ödülü</span>
                                    <span className="text-sm font-black text-orange-500">+1 Puan</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {sirketSampiyonlari.map((sampiyon, idx) => {
                            const isFirst = idx === 0;
                            const isSecond = idx === 1;
                            const isThird = idx === 2;

                            return (
                                <div key={idx} className={`relative rounded-3xl p-6 border flex flex-col items-center text-center transition-all transform hover:-translate-y-2 ${
                                    isFirst ? 'bg-gradient-to-b from-amber-100 to-amber-50 dark:from-amber-900/40 dark:to-yellow-900/20 border-amber-300 dark:border-amber-500/50 shadow-[0_10px_25px_rgba(251,191,36,0.2)]' :
                                    isSecond ? 'bg-gradient-to-b from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-900 border-slate-300 dark:border-slate-600 shadow-lg' :
                                    'bg-gradient-to-b from-orange-50 to-white dark:from-orange-900/20 dark:to-slate-900 border-orange-200 dark:border-orange-700/30 shadow-md'
                                }`}>
                                    {isFirst && <div className="absolute -top-3 bg-amber-500 text-white text-[11px] font-black px-4 py-1 rounded-full shadow-md uppercase tracking-widest">Lider</div>}
                                    
                                    <div className={`absolute top-4 right-4 flex flex-col items-center justify-center w-11 h-11 rounded-full shadow-sm border ${
                                        isFirst ? 'bg-amber-100 text-amber-600 border-amber-200 shadow-amber-500/20' :
                                        isSecond ? 'bg-slate-100 text-slate-600 border-slate-200 shadow-slate-500/20' :
                                        'bg-orange-100 text-orange-600 border-orange-200 shadow-orange-500/20'
                                    }`}>
                                        <span className="text-sm font-black leading-none">+{isFirst ? '5' : isSecond ? '3' : '1'}</span>
                                        <span className="text-[7px] font-black uppercase leading-none mt-0.5">PUAN</span>
                                    </div>

                                    <div className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl font-black mb-4 shadow-inner border-2 border-white/50 ${
                                        isFirst ? 'bg-gradient-to-br from-yellow-300 to-amber-500 text-white' :
                                        isSecond ? 'bg-gradient-to-br from-slate-300 to-slate-500 text-white' :
                                        'bg-gradient-to-br from-orange-300 to-rose-400 text-white'
                                    }`}>
                                        {idx + 1}
                                    </div>
                                    
                                    <h4 className={`font-black text-xl mb-1 ${isFirst ? 'text-amber-700 dark:text-amber-400' : isSecond ? 'text-slate-700 dark:text-slate-300' : 'text-orange-700 dark:text-orange-400'}`}>
                                        {sampiyon.isim}
                                    </h4>
                                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-6">{sampiyon.magaza}</p>

                                    <div className="w-full space-y-3">
                                        <div className="flex justify-between items-center bg-white/60 dark:bg-black/20 rounded-xl px-4 py-3">
                                            <span className="text-[11px] font-black text-slate-500 uppercase">Anlık Puan</span>
                                            <span className="font-black text-lg text-slate-800 dark:text-white">{sampiyon.toplamPuan}</span>
                                        </div>
                                        <div className="flex justify-between items-center bg-white/60 dark:bg-black/20 rounded-xl px-4 py-3">
                                            <span className="text-[11px] font-black text-slate-500 uppercase">Ay Sonu Tahmin</span>
                                            <span className="font-black text-lg text-emerald-600 dark:text-emerald-400">{sampiyon.puanTahmin}</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* YUVARLAK BÜYÜYEN KÜÇÜLEN HEDEFLER BUTONU */}
            {hedeflerAktifMi && (
                <div 
                    className="fixed bottom-50 right-8 z-40 group cursor-pointer" 
                    onClick={() => setActiveModal('hedefler')}
                >
                    <div className="absolute inset-0 bg-sky-400 rounded-full animate-pulse opacity-30"></div>
                    
                    <button className="relative w-20 h-20 bg-gradient-to-tr from-blue-600 to-sky-400 rounded-full flex flex-col items-center justify-center text-white font-black shadow-lg shadow-sky-500/40 border-4 border-white dark:border-slate-800 transition-transform transform group-hover:scale-110">
                        <span className="text-2xl mb-0.5">🎯</span>
                        <span className="text-[9px] uppercase tracking-widest">Hedefler</span>
                    </button>
                </div>
            )}

            {/* MODALLAR */}
            {activeModal && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center px-4">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={() => setActiveModal(null)}></div>
                    
                    {/* YENİ: KAYDIRMASIZ (NO-SCROLL) HEDEFLER MODALI */}
                    {activeModal === 'hedefler' && (
                        <div className="relative bg-white dark:bg-slate-900 rounded-[2rem] w-[98vw] max-w-[1600px] shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden flex flex-col max-h-[90vh]">

                            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                                <h3 className="text-lg md:text-xl font-black text-slate-800 dark:text-white flex items-center gap-3">
                                    <span className="text-2xl">🎯</span>
                                    {selectedBranch} Personel Hedefleri
                                    <span className="text-sky-500 text-[10px] uppercase tracking-widest bg-sky-50 dark:bg-sky-900/20 px-2 py-1 rounded-md ml-2 border border-sky-100 dark:border-sky-800">
                                        {hedeflerData[0]?.[0] || "DÖNEM BELİRTİLMEDİ"}
                                    </span>
                                </h3>

                                <button
                                    onClick={() => setActiveModal(null)}
                                    className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-rose-500 hover:text-white transition-colors"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                                                            
                            <div className="flex-1 overflow-hidden p-2 sm:p-4 flex flex-col">
                                {seciliSubeHedefleri.length > 0 ? (
                                    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm w-full flex-1 overflow-y-auto custom-scrollbar">
                                        <table className="w-full text-center">
                                            <thead className="sticky top-0 z-20 bg-yellow-300 text-slate-900">
                                                <tr>
                                                    {hedeflerBasliklar.map((baslik: any, idx: number) => (
                                                        <th
                                                            key={idx}
                                                            className="px-1 py-2 border border-yellow-400 text-[9px] sm:text-[10px] font-black uppercase break-words leading-tight align-middle"
                                                            style={{ minWidth: idx === 1 ? '90px' : 'auto' }}
                                                        >
                                                            {baslik}
                                                        </th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {seciliSubeHedefleri.map((row: any, rowIndex: number) => (
                                                    <tr
                                                        key={rowIndex}
                                                        className="hover:bg-sky-50 dark:hover:bg-slate-700 transition-colors"
                                                    >
                                                        {hedeflerBasliklar.map((_: any, cellIndex: number) => (
                                                            <td
                                                                key={cellIndex}
                                                                className={`px-1 py-2 border border-slate-200 dark:border-slate-700 text-[10px] sm:text-xs align-middle leading-tight break-words ${
                                                                    cellIndex === 1
                                                                        ? 'font-black text-sky-600 dark:text-sky-400'
                                                                        : 'text-slate-700 dark:text-slate-200 font-medium'
                                                                }`}
                                                            >
                                                                {row[cellIndex] || 0}
                                                            </td>
                                                        ))}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-16 opacity-60">
                                        <span className="text-6xl mb-4">📭</span>
                                        <h4 className="text-lg font-black text-slate-800 dark:text-white mb-1">
                                            Hedef Verisi Bulunamadı
                                        </h4>
                                        <p className="font-bold uppercase tracking-widest text-xs text-slate-500">
                                            Bu şubeye ait personel hedefi bulunamadı.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {activeModal === 'tahmin' && (
                        <div className="relative bg-white rounded-3xl w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden flex flex-col">
                            <div className="flex justify-between items-center p-5 border-b border-slate-100">
                                <h3 className="text-lg font-bold text-slate-800">Ay Sonu {anaMetrikAdi} Tahmini</h3>
                                <button onClick={() => setActiveModal(null)} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>
                            <div className="p-6 space-y-5">
                                {!anaBasarili ? (
                                    <div className="bg-[#FEF2F2] border border-[#FECDD3] rounded-xl p-4 flex gap-3">
                                        <div className="text-[#E11D48] mt-0.5"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg></div>
                                        <div>
                                            <h4 className="text-[#E11D48] font-bold text-sm mb-1">Hedefin Gerisindesiniz!</h4>
                                            <p className="text-rose-900/70 text-[11px] leading-relaxed">Mevcut satış hızınıza göre ay sonu tahmini {anaProjeksiyon} adet, hedefinizin ({anaHedef}) altında kalıyor.</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex gap-3">
                                        <div className="text-emerald-500 mt-0.5"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div>
                                        <div>
                                            <h4 className="text-emerald-700 font-bold text-sm mb-1">Harika Gidiyorsunuz!</h4>
                                            <p className="text-emerald-600/80 text-[11px] leading-relaxed">Mevcut hızınızla hedefi aşarak ay sonunu {anaProjeksiyon} adetle kapatmanız öngörülüyor.</p>
                                        </div>
                                    </div>
                                )}
                                <div className="flex justify-between items-center bg-slate-50 border border-slate-100 rounded-xl p-5">
                                    <div><p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-1">Gidişata Göre Ay Sonu</p></div>
                                    <div className="flex items-baseline gap-1">
                                        <span className={`text-3xl font-black ${anaBasarili ? 'text-emerald-600' : 'text-[#E11D48]'}`}>{anaProjeksiyon}</span>
                                        <span className="text-slate-500 text-sm font-medium">Adet</span>
                                    </div>
                                </div>
                            </div>
                            <div className="p-4 bg-slate-50 border-t border-slate-100">
                                <button onClick={() => setActiveModal(null)} className="w-full py-3 bg-[#1E293B] hover:bg-slate-800 text-white font-bold rounded-xl text-sm">Kapat</button>
                            </div>
                        </div>
                    )}
                    
                    {activeModal === 'departman' && dinamikMagazaMetrikleri.length > 0 && (
                        <div className="relative bg-[#0F172A] rounded-[2rem] w-full max-w-4xl shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden border border-slate-700/50">
                            <div className="flex justify-between items-start p-6 border-b border-slate-800">
                                <div>
                                    <h3 className="text-xl font-black text-white">{selectedBranch} Departman Hedefleri</h3>
                                    <div className="flex flex-wrap items-center gap-3 mt-4">
                                        {/* SOL: ANLIK PUAN (ÖN PLANDA) */}
                                        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-2 flex items-center gap-3 shadow-[0_0_15px_rgba(16,185,129,0.15)]">
                                            <div className="text-emerald-500 text-2xl">⚡</div>
                                            <div className="flex flex-col">
                                                <span className="text-[10px] text-emerald-500 font-bold uppercase tracking-widest">Şu Anki Toplanan Puan</span>
                                                <span className="text-2xl font-black text-emerald-400 leading-none mt-1">{magazaAnlikPuan.toFixed(1)} Puan</span>
                                            </div>
                                        </div>
                                        {/* SAĞ: AY SONU TAHMİN PUANI (İKİNCİL) */}
                                        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl px-4 py-2 flex items-center gap-3 opacity-80">
                                            <div className="text-sky-500 text-2xl">🎯</div>
                                            <div className="flex flex-col">
                                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Mağaza Ay Sonu Tahmin Puanı</span>
                                                <span className="text-lg font-black text-sky-400 leading-none mt-1">{magazaTahminPuan.toFixed(1)} Puan</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <button onClick={() => setActiveModal(null)} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-800 text-slate-400 hover:bg-slate-700 transition-colors mt-1">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>
                            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto max-h-[70vh] custom-scrollbar">
                                {dinamikMagazaMetrikleri.map((metrik, idx) => (
                                    <DepartmanProgressBar 
                                        key={idx}
                                        title={metrik.name} 
                                        data={metrik.data} 
                                        colorClass={metrik.color} 
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                    
                    {activeModal === 'personel_detay' && selectedPersonel && (
                        <div className="relative bg-[#0F172A] rounded-[2rem] w-full max-w-5xl shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden flex flex-col max-h-[90vh]">
                            <div className="flex justify-between items-start p-6 border-b border-slate-800 shrink-0 bg-slate-900/50">
                                <div>
                                    <h3 className="text-2xl font-black text-white flex items-center gap-3">
                                        {selectedPersonel.isim} 
                                        <span className="bg-sky-500/20 text-sky-400 text-[10px] px-2.5 py-1 rounded-lg tracking-widest shadow-sm">Genel Puan: {selectedPersonel.toplamPuan}</span>
                                    </h3>
                                    <p className="text-[10px] text-sky-400 font-black tracking-widest uppercase mt-1">
                                        TÜM ŞUBELERDEKİ TOPLAM VERİLER
                                    </p>
                                </div>
                                <button onClick={() => setActiveModal(null)} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" /></svg>
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
