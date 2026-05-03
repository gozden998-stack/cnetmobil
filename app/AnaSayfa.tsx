import React, { useEffect, useState } from 'react';

export default function AnaSayfa({ selectedBranch, setAppMode, config, gidisatData = [], personelData = [] }: any) {
    // --- MODAL KONTROLLERİ ---
    const [activeModal, setActiveModal] = useState<'tahmin' | 'departman' | 'personel_detay' | null>(null);
    const [selectedPersonel, setSelectedPersonel] = useState<any>(null);

    const isCmr = selectedBranch.includes('CMR');

    // --- TÜRKİYE FORMATINA UYGUN GELİŞMİŞ SAYI OKUMA MOTORU ---
    const parseNum = (val: any) => {
        if (val === null || val === undefined || val === "") return 0;
        if (typeof val === 'number') return val;
        let strVal = String(val).trim();
        if (strVal.includes('.') && strVal.includes(',')) {
            strVal = strVal.replace(/\./g, '').replace(',', '.');
        } else if (strVal.includes(',')) {
            strVal = strVal.replace(',', '.');
        }
        const parsed = parseFloat(strVal);
        return isNaN(parsed) ? 0 : parsed;
    };

    // --- İSİM EŞLEŞTİRME MOTORUNU GÜÇLENDİR ---
    const cleanKey = (s: string) => {
        return String(s || "")
            .replace(/[\s\.\-\+]/g, "") // Boşluk, nokta, tire ve artıları tamamen siler
            .toLocaleUpperCase('tr-TR'); // Türkçe karakter uyumlu büyütür
    };

    // --- TARİH DEDEKTİFİ (Merkezi Veri Çekimi) ---
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

    // --- GÜN VE AY HESAPLAMALARI ---
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

    // --- HASSAS PUAN HESAPLAMA MOTORU ---
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
    
    // --- 1. MAĞAZA VERİSİNİ AYIKLA (Gidişat) ---
    const branchIndex = (gidisatData || []).findIndex((row: any) => 
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
    
    const anaSatis = metrics?.ikinciElAdet?.satilan || 0;
    const anaHedef = metrics?.ikinciElAdet?.hedef || 0;
    const anaProjeksiyon = Math.round((anaSatis / currentDay) * daysInMonth);
    const anaBasarili = anaProjeksiyon >= anaHedef;
    const subePuani = anaHedef > 0 ? Math.min(10, ((anaSatis / currentDay) * daysInMonth / anaHedef) * 10).toFixed(1) : "0.0";

    // --- 2. %100 DİNAMİK PERSONEL VERİSİ MOTORU ---
    let aktifPersoneller: any[] = [];
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
            // --- SIRALAMA PUANA GÖRE ---
            .sort((a: any, b: any) => parseFloat(b.toplamPuan) - parseFloat(a.toplamPuan));
    }

    // --- PROGRESS BAR BİLEŞENİ ---
    const DepartmanProgressBar = ({ title, data, colorClass, puan, isRiskliBarem }: any) => {
        if (!data) return null;
        const kalan = Math.max(0, data.hedef - data.satilan);
        const yuzde = data.hedef > 0 ? Math.min(100, Math.round((data.satilan / data.hedef) * 100)) : 0;
        const projeksiyon = Math.round((data.satilan / currentDay) * daysInMonth);
        const isBasarili = projeksiyon >= data.hedef;
        
        const formatVal = (v: number) => data.isCurrency 
            ? `${v.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ₺` 
            : `${v.toLocaleString('tr-TR')}`;

        return (
            <div className={`bg-[#1E293B] border ${isRiskliBarem ? 'border-rose-500/50 shadow-[0_0_15px_rgba(244,63,94,0.1)]' : 'border-slate-700/50'} rounded-2xl p-4 flex flex-col justify-between relative overflow-hidden transition-all hover:bg-slate-800`}>
                {data.hedef > 0 && (
                    <div className={`absolute top-0 right-4 text-white text-[8px] font-black px-2 py-0.5 rounded-b-md tracking-widest shadow-sm ${isBasarili ? 'bg-emerald-500' : 'bg-rose-500'}`}>
                        {isBasarili ? 'BAŞARILI' : 'RİSKLİ'}
                    </div>
                )}
                
                <div className="flex justify-between items-start mb-3 mt-1">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{title}</h4>
                    {puan !== undefined && (
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded ${isRiskliBarem ? 'bg-rose-500/20 text-rose-400' : 'bg-sky-500/20 text-sky-400'}`}>
                            Puan: {puan}
                        </span>
                    )}
                </div>

                <div className="flex justify-between items-end mb-2">
                    <p className="text-xl font-black text-white">{formatVal(data.satilan)} <span className="text-xs font-medium text-slate-500">/ {formatVal(data.hedef)}</span></p>
                    <div className="text-right">
                        <p className={`text-[9px] font-black uppercase tracking-wider ${kalan > 0 ? 'text-[#E11D48]' : 'text-emerald-500'}`}>
                            {data.hedef > 0 ? (kalan > 0 ? `Kalan: ${formatVal(kalan)}` : 'TAMAMLANDI') : 'HEDEF YOK'}
                        </p>
                    </div>
                </div>

                {isRiskliBarem && (
                   <div className="bg-rose-500/10 border border-rose-500/20 rounded-lg py-1 px-2 mb-2 animate-pulse">
                        <p className="text-[8px] font-black text-rose-500 text-center uppercase tracking-tighter">
                            ⚠️ Riskli Barem Altındasın (Puan Alınamıyor)
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
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl md:text-2xl font-extrabold text-slate-800 dark:text-white flex items-center gap-2 tracking-tight">
                                    CnetMobil <span className="font-medium text-slate-500 dark:text-slate-400">- {selectedBranch}</span>
                                </h3>
                                <button onClick={() => setActiveModal('departman')} className="bg-[#4CAF50] hover:bg-[#43A047] text-white px-4 py-2 rounded-xl font-black text-lg flex items-center gap-1 transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5">
                                    {subePuani} <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
                                </button>
                            </div>
                            {metrics ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 cursor-pointer">
                                    <div className="bg-[#FDF8F3] border border-[#F2E5D5] rounded-3xl p-5 relative overflow-hidden transition-all hover:shadow-md">
                                        <p className="text-slate-700 font-bold text-sm mb-3">Bu Ay Toplam 2. El Satış</p>
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
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">LİDERLİK TABLOSU</p>
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
                                            index === 0 ? 'bg-gradient-to-r from-amber-50 to-white dark:from-amber-900/20 dark:to-slate-800/50 border-amber-200 dark:border-amber-700/50 hover:shadow-md hover:border-amber-300' :
                                            index === 1 ? 'bg-gradient-to-r from-slate-100 to-white dark:from-slate-700/30 dark:to-slate-800/50 border-slate-200 dark:border-slate-600 hover:shadow-md hover:border-slate-300' :
                                            index === 2 ? 'bg-gradient-to-r from-orange-50 to-white dark:from-orange-900/20 dark:to-slate-800/50 border-orange-200 dark:border-orange-700/50 hover:shadow-md hover:border-orange-300' :
                                            'bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-700 hover:bg-sky-50 hover:border-sky-200'
                                        }`}>
                                        
                                        <div className="flex items-center gap-4">
                                            <div className="relative">
                                                <div className={`w-11 h-11 rounded-full flex items-center justify-center font-black text-sm border-2 border-white dark:border-slate-800 ${
                                                    index === 0 ? 'bg-gradient-to-br from-yellow-300 to-amber-500 text-white shadow-lg shadow-amber-500/40' : 
                                                    index === 1 ? 'bg-gradient-to-br from-slate-300 to-slate-500 text-white shadow-lg shadow-slate-500/40' : 
                                                    index === 2 ? 'bg-gradient-to-br from-orange-300 to-rose-400 text-white shadow-lg shadow-orange-500/40' : 
                                                    'bg-slate-200 text-slate-500'
                                                }`}>
                                                    {index + 1}
                                                </div>
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-slate-800 dark:text-white text-sm flex items-center gap-1.5 group-hover:text-sky-700 transition-colors">
                                                    {p.isim}
                                                    <span className={trendUp ? 'text-emerald-500' : 'text-rose-500'}>
                                                        {trendUp ? '↗' : '↘'}
                                                    </span>
                                                </h4>
                                                <div className="flex gap-2 mt-1">
                                                    <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded shadow-sm">Puan: {p.toplamPuan}</span>
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter opacity-70">Tahmin: {p.puanTahmin}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* --- YENİ EKLENEN ÖZEL ROZETLER --- */}
                                        <div className="text-right flex items-center gap-4">
                                            <div className="flex flex-col items-end">
                                                {index === 0 ? (
                                                    <div className="px-3.5 py-1.5 rounded-xl text-[10px] font-black tracking-widest bg-gradient-to-r from-yellow-400 to-amber-500 text-white shadow-[0_0_15px_rgba(245,158,11,0.5)] border border-yellow-300/50 flex items-center gap-2 transform group-hover:scale-105 transition-all">
                                                        <span className="text-[14px]">🏆</span> LİDER SATICI
                                                    </div>
                                                ) : index === 1 ? (
                                                    <div className="px-3.5 py-1.5 rounded-xl text-[10px] font-black tracking-widest bg-gradient-to-r from-slate-400 to-slate-500 text-white shadow-[0_0_12px_rgba(148,163,184,0.5)] border border-slate-300/50 flex items-center gap-2 transform group-hover:scale-105 transition-all">
                                                        <span className="text-[14px]">🥈</span> ÜSTÜN PERFORMANS
                                                    </div>
                                                ) : index === 2 ? (
                                                    <div className="px-3.5 py-1.5 rounded-xl text-[10px] font-black tracking-widest bg-gradient-to-r from-orange-400 to-rose-500 text-white shadow-[0_0_12px_rgba(249,115,22,0.4)] border border-orange-300/50 flex items-center gap-2 transform group-hover:scale-105 transition-all">
                                                        <span className="text-[14px]">🥉</span> YÜKSELEN YILDIZ
                                                    </div>
                                                ) : (
                                                    <div className={`px-3 py-1 rounded-xl text-[9px] font-black tracking-widest border transition-all ${rank.bg} ${rank.color} ${rank.border} group-hover:scale-105`}>
                                                        {rank.label}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="text-slate-300 group-hover:text-sky-500 transition-all transform group-hover:translate-x-1">
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

            {activeModal && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center px-4">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={() => setActiveModal(null)}></div>
                    {activeModal === 'tahmin' && (
                        <div className="relative bg-white rounded-3xl w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden flex flex-col">
                            <div className="flex justify-between items-center p-5 border-b border-slate-100">
                                <h3 className="text-lg font-bold text-slate-800">2. El Ay Sonu Tahmini</h3>
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
                    {activeModal === 'departman' && metrics && (
                        <div className="relative bg-[#0F172A] rounded-[2rem] w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden border border-slate-700/50">
                            <div className="flex justify-between items-start p-6 border-b border-slate-800">
                                <div>
                                    <h3 className="text-xl font-black text-white">{selectedBranch} Departman Hedefleri</h3>
                                    <p className="text-[10px] text-sky-400 font-black tracking-widest uppercase mt-1">GÜNCEL HIZ VE AY SONU PROJEKSİYONLARI</p>
                                </div>
                                <button onClick={() => setActiveModal(null)} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-800 text-slate-400 hover:bg-slate-700 transition-colors">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>
                            <div className="p-6 grid grid-cols-2 gap-4">
                                <DepartmanProgressBar title="2. EL CİHAZ SATIŞ" data={metrics.ikinciElAdet} colorClass="bg-sky-500" />
                                <DepartmanProgressBar title="1. EL CİHAZ SATIŞ" data={metrics.birinciElTablet} colorClass="bg-purple-500" />
                                <DepartmanProgressBar title="2. EL KAZANÇ" data={metrics.ikinciElKazanc} colorClass="bg-emerald-500" />
                                <DepartmanProgressBar title="SERVİS KAZANÇ" data={metrics.teknikServis} colorClass="bg-fuchsia-500" />
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
