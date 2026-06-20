mport React, { useEffect, useState } from 'react';

export default function AnaSayfa({ selectedBranch, setAppMode, config, gidisatData = [], personelData = [], hedeflerData = [], izinlerData = [] }: any) {
    // --- KONTROLLER ---
    const [activeModal, setActiveModal] = useState<'tahmin' | 'departman' | 'personel_detay' | 'hedefler' | 'izinler' | null>(null);
    const [activeDrawer, setActiveDrawer] = useState<'personel' | 'magaza' | null>(null);
    const [selectedPersonel, setSelectedPersonel] = useState<any>(null);

    const isCmr = selectedBranch.includes('CMR');
    const branchLower = selectedBranch.toLowerCase();
    const isBlocked = branchLower.includes('vodofone') || branchLower.includes('vodafone') || branchLower.includes('zumay');
    
    const hedeflerAktifMi = !isBlocked;
    const izinlerAktifMi = !isBlocked;

    // --- VERİ HAZIRLIĞI ---
    const veriKaynagi = izinlerData && izinlerData.length > 0 ? izinlerData : hedeflerData;
    const izinIdx = veriKaynagi.findIndex((row: any) => Array.isArray(row) && row.join("").toUpperCase().includes("İZİN ÇİZELGESİ"));

    const ustTabloData = izinIdx !== -1 ? hedeflerData.slice(0, izinIdx) : hedeflerData;
    const seciliSubeHedefleri = ustTabloData.filter((row: any) => Array.isArray(row) && String(row[0] || "").toUpperCase() === selectedBranch.toUpperCase().trim());
    const hedeflerBasliklar = ustTabloData[0] || [];

    const altTabloData = izinIdx !== -1 ? veriKaynagi.slice(izinIdx) : [];
    const izinTarihBasliklari = altTabloData.length > 1 ? altTabloData[1] : [];
    const izinGunBasliklari = altTabloData.length > 2 ? altTabloData[2] : [];
    const tumIzinler = altTabloData.length > 3 ? altTabloData.slice(3).filter((row:any) => row.length > 1 && (row[0] || row[1])) : [];

    const izinRenkleri = [
        { bg: 'bg-sky-100', text: 'text-sky-800', badge: 'bg-sky-500 text-white' },
        { bg: 'bg-emerald-100', text: 'text-emerald-800', badge: 'bg-emerald-500 text-white' },
        { bg: 'bg-purple-100', text: 'text-purple-800', badge: 'bg-purple-500 text-white' },
        { bg: 'bg-rose-100', text: 'text-rose-800', badge: 'bg-rose-500 text-white' },
        { bg: 'bg-amber-100', text: 'text-amber-800', badge: 'bg-amber-500 text-white' },
        { bg: 'bg-indigo-100', text: 'text-indigo-800', badge: 'bg-indigo-500 text-white' },
    ];
    let aktifSubeRenkIndex = -1;

    const parseNum = (val: any) => {
        if (val === null || val === undefined || val === "") return 0;
        if (typeof val === 'number') return val;
        let strVal = String(val).trim();
        if (strVal.includes('.') && strVal.includes(',')) strVal = strVal.replace(/\./g, '').replace(',', '.');
        else if (strVal.includes(',')) strVal = strVal.replace(',', '.');
        else if (strVal.includes('.')) strVal = strVal.replace(/\./g, '');
        const parsed = parseFloat(strVal);
        return isNaN(parsed) ? 0 : parsed;
    };

    const cleanKey = (s: string) => String(s || "").replace(/[\s\.\-\+]/g, "").toLocaleUpperCase('tr-TR'); 

    let lastUpdatedDate = config?.Guncellenen_Tarih || config?.GÜNCELLENEN || "";
    if (!lastUpdatedDate && personelData) {
        const tarihSatiri = (personelData as any[]).find((row: any) => Array.isArray(row) && row.some((cell: any) => String(cell || "").toUpperCase().includes("GÜNCELLENEN")));
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

    const dinamikPuanKurallari: Record<string, any> = {};
    const hedefPuaniBaslikIdx = (personelData as any[]).findIndex(row => Array.isArray(row) && String(row[0] || "").toUpperCase().includes("HEDEF PUANI"));

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
        return Math.min(rule.maxPuan, perf * rule.hedefPuan);
    };
    
    let dinamikMagazaMetrikleri: any[] = [];
    let magazaAnlikPuan = 0, magazaTahminPuan = 0, anaSatis = 0, anaHedef = 0;

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
        const colorPalette = ["bg-blue-500", "bg-emerald-500", "bg-purple-500", "bg-amber-500", "bg-sky-500"];
        let colorIndex = 0;

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
                if (colorIndex === 0) { anaSatis = sVal; anaHedef = hVal; }
                colorIndex++;
            }
        });
    }

    function calcStorePts(act: number, tgt: number, hp: number, mp: number, isP: boolean) {
        if (!tgt || tgt === 0 || !hp) return 0;
        const v = isP ? (act / currentDay) * daysInMonth : act;
        return Math.min(mp || hp, (v / tgt) * hp);
    }

    const anaProjeksiyon = Math.round((anaSatis / currentDay) * daysInMonth);
    const tamamlananYuzde = anaHedef > 0 ? Math.min(100, Math.round((anaSatis / anaHedef) * 100)) : 0;
    const kalanHedef = Math.max(0, anaHedef - anaSatis);

    let tumSirketPersonelleri: any[] = [];
    let aktifPersoneller: any[] = [];
    let dinamikBaremler: any[] = [];
    
    if (personelData && personelData.length > 0) {
        const colorPalette = ["bg-sky-500", "bg-emerald-500", "bg-purple-500", "bg-indigo-500", "bg-orange-500"];
        const gerceklesenIndex = personelData.findIndex((row: any) => Array.isArray(row) && row.some((cell: any) => typeof cell === 'string' && cell.toLowerCase().includes('gerçekleşen')));
        
        const baslikSatiri = personelData[0] || [];
        baslikSatiri.forEach((cell: any, index: number) => {
            if (index >= 2) {
                const baslikAdi = String(cell || "").trim();
                if (baslikAdi && !baslikAdi.toLowerCase().includes('gerçekleşen') && !baslikAdi.toLowerCase().includes('isim')) {
                    dinamikBaremler.push({ indexOffset: index - 2, orijinalIndex: index, name: baslikAdi, isCurrency: ['KAZANÇ', 'CİRO', 'TL', 'SERVİS', '₺'].some(k => baslikAdi.toUpperCase().includes(k)), color: colorPalette[dinamikBaremler.length % colorPalette.length] });
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
                if (!personelDict[isim]) personelDict[isim] = { isim: isim, magaza: magaza.toUpperCase(), hedefler: {}, gerceklesen: {}, anaHedef: 0, anaSatilan: 0 };
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

        tumSirketPersonelleri = Object.values(personelDict)
            .map((p: any) => {
                let pAnlik = 0, pTahmin = 0;
                dinamikBaremler.forEach(b => {
                    pAnlik += calculatePoint(p.gerceklesen[b.name] || 0, p.hedefler[b.name] || 0, b.name, false);
                    pTahmin += calculatePoint(p.gerceklesen[b.name] || 0, p.hedefler[b.name] || 0, b.name, true);
                });
                const projeksiyon = Math.round((p.anaSatilan / currentDay) * daysInMonth);
                const basariYuzdesi = p.anaHedef > 0 ? Math.min(100, Math.round((projeksiyon / p.anaHedef) * 100)) : 0;
                return { ...p, projeksiyon, toplamPuan: pAnlik.toFixed(1), puanTahmin: pTahmin.toFixed(1), basariYuzdesi, isBasarili: projeksiyon >= p.anaHedef };
            })
            .sort((a: any, b: any) => parseFloat(b.puanTahmin) - parseFloat(a.puanTahmin));

        aktifPersoneller = tumSirketPersonelleri.filter((p: any) => p.magaza.includes(selectedBranch.trim().toUpperCase()));
    }

    const maxListePuani = Math.max(100, ...(aktifPersoneller.map(p => Number(p.puanTahmin) || 0)));

    const DepartmanProgressBar = ({ title, data, colorClass, puan, tahminiPuan, kural70, isRiskli }: any) => {
        if (!data || data.hedef === 0) return null;
        const projeksiyon = Math.round((data.satilan / currentDay) * daysInMonth);
        const tahminYuzde = data.hedef > 0 ? Math.min(100, Math.round((projeksiyon / data.hedef) * 100)) : 0;
        const isBasarili = projeksiyon >= data.hedef;
        const formatVal = (v: number) => data.isCurrency ? `${v.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ₺` : `${v.toLocaleString('tr-TR')}`;

        return (
            <div className={`bg-white border ${isRiskli ? 'border-rose-300 bg-rose-50/40' : 'border-slate-200'} rounded-2xl p-4 shadow-sm flex flex-col justify-between relative overflow-hidden transition-all`}>
                <div className="flex justify-between items-start mb-3 mt-1">
                    <div className="flex flex-col gap-1.5">
                        <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{title}</h4>
                        {kural70 && (
                            isRiskli ? 
                            <span className="text-[9px] font-bold text-rose-600 bg-rose-100 px-1.5 py-0.5 rounded w-max border border-rose-200">%70 Altı (Riskli)</span> :
                            <span className="text-[9px] font-bold text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded w-max border border-emerald-200">Baraj Geçildi</span>
                        )}
                    </div>
                    {puan !== undefined && <span className="text-[10px] font-bold text-sky-600 bg-sky-50 px-2 py-0.5 rounded">Puan: {puan}</span>}
                </div>
                <div className="flex justify-between items-end mb-2">
                    <p className="text-xl font-black text-slate-800">{formatVal(data.satilan)} <span className="text-xs font-medium text-slate-400">/ {formatVal(data.hedef)}</span></p>
                </div>
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden mb-1">
                    <div className={`h-full ${colorClass} rounded-full`} style={{ width: `${tahminYuzde}%` }}></div>
                </div>
                <div className="flex justify-between text-[10px] font-bold text-slate-500 mb-3">
                    <span>Ay Sonu Gerçekleşme: %{tahminYuzde}</span>
                    {tahminiPuan !== undefined && <span className="text-blue-600">Tahmini Puan: {tahminiPuan}</span>}
                </div>
                {data.hedef > 0 && (
                    <div className="flex justify-between items-center text-[10px] font-bold border-t border-slate-100 pt-2.5">
                        <span className="text-slate-400 uppercase">Tahmini Kapanış</span>
                        <span className={isBasarili ? 'text-emerald-500' : 'text-rose-500'}>{formatVal(projeksiyon)}</span>
                    </div>
                )}
            </div>
        );
    };

    const Sparkline = ({ colorCode, pathD, stopColor }: any) => (
        <svg className="w-20 h-10" viewBox="0 0 100 30" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d={pathD} stroke={colorCode} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d={`${pathD} L 100 30 L 0 30 Z`} fill={`url(#grad-${stopColor})`} opacity="0.15"/>
            <defs>
                <linearGradient id={`grad-${stopColor}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={colorCode} stopOpacity="1"/>
                    <stop offset="100%" stopColor={colorCode} stopOpacity="0"/>
                </linearGradient>
            </defs>
        </svg>
    );

    return (
        <div className="min-h-screen bg-[#F8F9FB] p-4 md:p-8 font-sans text-slate-800 animate-in fade-in duration-500 overflow-x-hidden">
            
            {/* 1. BÖLÜM: ÜST KPI KARTLARI (YAYVAN TASARIM) */}
            <div className="bg-white rounded-[2.5rem] p-6 shadow-sm border border-slate-100 mb-8 flex flex-col xl:flex-row gap-6 justify-between">
                
                {/* SOL KISIM: ŞUBE BİLGİSİ */}
                <div className="flex flex-col xl:border-r border-slate-100 pr-6 min-w-max self-stretch justify-center">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                        <h2 className="font-extrabold text-slate-800 uppercase tracking-tight text-lg">{selectedBranch} ŞUBESİ</h2>
                    </div>
                    <span className="text-emerald-500 font-bold text-sm mb-4">Aktif</span>
                    <div className="flex items-center gap-2 text-slate-400 text-xs font-medium">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                        Son Güncelleme <br/> {lastUpdatedDate || "Bilinmiyor"}
                    </div>
                </div>

                {/* ORTA KISIM: 4 DETAYLI KPI KARTI */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
                    
                    {/* ===== CİHAZ ADET HEDEF (YENİ GAUGE TASARIM) ===== */}
                    <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm flex flex-col justify-between transition-all hover:shadow-md">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                            </div>
                            <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Cihaz Adet Hedef</p>
                        </div>
                        <div className="mb-4">
                            <div className="flex items-baseline gap-1">
                                <span className="text-4xl font-black text-slate-800 tracking-tight">{anaHedef}</span>
                                <span className="text-xs font-bold text-slate-400">Adet</span>
                            </div>
                        </div>
                        
                        {/* YENİ YARIM DAİRE (GAUGE) TASARIMI */}
                        <div className="mt-auto pt-3 border-t border-slate-50">
                            <div className="flex items-center justify-between gap-2">
                                
                                {/* SVG Grafik Alanı */}
                                <div className="relative w-24 h-12 flex-shrink-0">
                                    <svg className="w-full h-full overflow-visible" viewBox="0 0 100 50">
                                        {/* Arka plan (Boş Kısım) */}
                                        <path 
                                            d="M 15 45 A 35 35 0 0 1 85 45" 
                                            fill="none" 
                                            stroke="#DBEAFE" 
                                            strokeWidth="12" 
                                            strokeLinecap="round" 
                                        />
                                        {/* Ön plan (Dolan Kısım) */}
                                        <path 
                                            d="M 15 45 A 35 35 0 0 1 85 45" 
                                            fill="none" 
                                            stroke="#2563EB" 
                                            strokeWidth="12" 
                                            strokeLinecap="round" 
                                            strokeDasharray="100" 
                                            strokeDashoffset={Math.max(0, 100 - tamamlananYuzde)} 
                                            pathLength={100} 
                                            className="transition-all duration-1000 ease-out" 
                                        />
                                    </svg>
                                    
                                    {/* Grafiğin İçindeki Yüzde Değeri */}
                                    <div className="absolute inset-x-0 bottom-0 flex items-end justify-center pb-0.5">
                                        <span className="text-sm font-black text-slate-800">%{tamamlananYuzde}</span>
                                    </div>
                                </div>
                                
                                {/* Yan Bilgiler (Gerçekleşen / Hedef) */}
                                <div className="flex flex-col items-end">
                                    <span className="text-xs font-black text-slate-700">
                                        {anaSatis} <span className="text-[10px] font-bold text-slate-400">/ {anaHedef}</span>
                                    </span>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Tamamlandı</span>
                                    <span className="text-[10px] font-bold text-blue-500 mt-1">Kalan {kalanHedef}</span>
                                </div>
                                
                            </div>
                        </div>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm flex flex-col justify-between transition-all hover:shadow-md">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            </div>
                            <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Toplam Cihaz Satış</p>
                        </div>
                        <div className="flex items-end justify-between mb-2">
                            <div className="flex items-baseline gap-1">
                                <span className="text-4xl font-black text-slate-800 tracking-tight">{anaSatis}</span>
                                <span className="text-xs font-bold text-slate-400">Adet</span>
                            </div>
                            <Sparkline colorCode="#10b981" stopColor="emerald" pathD="M0 25 C 20 15, 30 25, 50 10 C 70 -5, 80 15, 100 5" />
                        </div>
                        <div className="mt-auto pt-3 border-t border-slate-100">
                            <span className="text-[10px] font-bold text-slate-400">Gerçekleşen Toplam Adet</span>
                        </div>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm flex flex-col justify-between transition-all hover:shadow-md">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
                            </div>
                            <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Aylık Proj. Cihaz</p>
                        </div>
                        <div className="flex items-end justify-between mb-2">
                            <div className="flex items-baseline gap-1">
                                <span className="text-4xl font-black text-slate-800 tracking-tight">{anaProjeksiyon}</span>
                                <span className="text-xs font-bold text-slate-400">Adet</span>
                            </div>
                            <Sparkline colorCode="#a855f7" stopColor="purple" pathD="M0 20 C 15 25, 30 5, 50 15 C 70 25, 85 0, 100 10" />
                        </div>
                        <div className="mt-auto pt-3 border-t border-slate-100">
                            <span className="text-[10px] font-bold text-slate-400">Tahmini Ay Sonu Sonucu</span>
                        </div>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm flex flex-col justify-between transition-all hover:shadow-md">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 rounded-full bg-orange-50 text-orange-500 flex items-center justify-center shrink-0">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
                            </div>
                            <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Mağaza Genel Puan</p>
                        </div>
                        <div className="flex items-end justify-between mb-2">
                            <div className="flex items-baseline gap-1">
                                <span className="text-4xl font-black text-slate-800 tracking-tight">{magazaAnlikPuan.toFixed(1)}</span>
                                <span className="text-xs font-bold text-slate-400">Puan</span>
                            </div>
                            <Sparkline colorCode="#f59e0b" stopColor="amber" pathD="M0 15 C 20 15, 35 5, 50 20 C 65 35, 80 5, 100 15" />
                        </div>
                        <div className="mt-auto pt-3 border-t border-slate-100">
                            <span className="text-[10px] font-bold text-slate-400">Güncel Performans Puanı</span>
                        </div>
                    </div>
                </div>

                {/* SAĞ KISIM: YENİ "BU AYIN EN İYİLERİ" LİDERLİK TABLOSU (PODYUM) */}
                <div className="flex flex-col items-center gap-4 xl:border-l border-slate-100 xl:pl-6 shrink-0 w-full xl:w-auto min-w-[340px]">
                    {!isBlocked && (
                        <div className="relative overflow-hidden bg-gradient-to-b from-[#1e1b4b] to-[#0f172a] p-6 rounded-[2rem] border border-[#2e2b5e] w-full flex-1 flex flex-col shadow-2xl">
                            {/* Dekoratif Arka Plan Işıkları */}
                            <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-40" style={{ backgroundImage: 'radial-gradient(circle at 50% 0%, #4c1d95 0%, transparent 70%)' }}></div>

                            {/* Başlık ve Kupa */}
                            <div className="relative z-10 flex items-center justify-center gap-3 mb-8">
                                <div className="w-8 h-8 rounded bg-gradient-to-br from-yellow-400 to-yellow-600 text-white flex items-center justify-center shadow-lg shadow-yellow-500/30">
                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 2a1 1 0 011 1v1.323l3.954 1.582 1.599-.8a1 1 0 01.894 1.79l-1.233.616 1.738 5.42a1 1 0 01-.285 1.05A3.989 3.989 0 0115 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.715-5.349L11 6.477V16h2a1 1 0 110 2H7a1 1 0 110-2h2V6.477L6.237 7.582l1.715 5.349a1 1 0 01-.285 1.05A3.989 3.989 0 015 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.738-5.42-1.233-.617a1 1 0 01.894-1.788l1.599.799L9 4.323V3a1 1 0 011-1zm-5 8.274l-.818 2.552c.25.112.526.174.818.174.292 0 .569-.062.818-.174L5 10.274zm10 0l-.818 2.552c.25.112.526.174.818.174.292 0 .569-.062.818-.174L15 10.274z" clipRule="evenodd" /></svg>
                                </div>
                                <h3 className="text-sm font-black text-white uppercase tracking-widest text-center">Bu Ayın En İyileri</h3>
                            </div>

                            {/* Podyum Görselleştirme */}
                            <div className="relative z-10 flex-1 flex items-end justify-center gap-1.5 mt-2 pb-2">
                                {tumSirketPersonelleri.length > 0 ? (
                                    <>
                                        {/* 2. SIRA (GÜMÜŞ) */}
                                        {tumSirketPersonelleri[1] && (
                                            <div className="flex flex-col items-center justify-end w-[31%] z-10">
                                                <div className="relative w-full bg-gradient-to-b from-slate-100 to-white rounded-t-xl rounded-b-lg shadow-lg border-b-[4px] border-slate-300 p-2 pt-6 h-28 flex flex-col items-center text-center justify-between">
                                                    <div className="absolute -top-4 w-9 h-9 rounded-full bg-gradient-to-br from-slate-300 to-slate-400 border-2 border-white flex items-center justify-center font-black text-white shadow-md text-sm">2</div>
                                                    <p className="text-[10px] font-black text-slate-800 leading-tight line-clamp-2 mt-1">{tumSirketPersonelleri[1].isim}</p>
                                                    <p className="text-[8px] font-bold text-slate-500 truncate w-full">{tumSirketPersonelleri[1].magaza}</p>
                                                    <div className="w-full bg-slate-100 py-1 rounded mt-1 border border-slate-200"><p className="text-[10px] font-black text-slate-700">{tumSirketPersonelleri[1].puanTahmin} Puan</p></div>
                                                </div>
                                            </div>
                                        )}

                                        {/* 1. SIRA (ALTIN) */}
                                        {tumSirketPersonelleri[0] && (
                                            <div className="flex flex-col items-center justify-end w-[38%] z-20">
                                                <div className="relative w-full bg-gradient-to-b from-yellow-50 to-white rounded-t-xl rounded-b-lg shadow-2xl shadow-yellow-500/30 border-b-[6px] border-yellow-400 p-2 pt-8 h-36 flex flex-col items-center text-center justify-between transform -translate-y-2">
                                                    <div className="absolute -top-5 w-12 h-12 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 border-2 border-white flex items-center justify-center font-black text-white shadow-lg text-lg ring-4 ring-yellow-400/20">1</div>
                                                    <p className="text-[11px] font-black text-slate-800 leading-tight line-clamp-2 mt-2">{tumSirketPersonelleri[0].isim}</p>
                                                    <p className="text-[9px] font-bold text-slate-500 truncate w-full">{tumSirketPersonelleri[0].magaza}</p>
                                                    <div className="w-full bg-yellow-100 py-1.5 rounded mt-1 border border-yellow-200"><p className="text-[11px] font-black text-yellow-700">{tumSirketPersonelleri[0].puanTahmin} Puan</p></div>
                                                </div>
                                            </div>
                                        )}

                                        {/* 3. SIRA (BRONZ) */}
                                        {tumSirketPersonelleri[2] && (
                                            <div className="flex flex-col items-center justify-end w-[31%] z-10">
                                                <div className="relative w-full bg-gradient-to-b from-orange-50 to-white rounded-t-xl rounded-b-lg shadow-lg border-b-[4px] border-orange-400 p-2 pt-5 h-24 flex flex-col items-center text-center justify-between">
                                                    <div className="absolute -top-3 w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 border-2 border-white flex items-center justify-center font-black text-white shadow-md text-xs">3</div>
                                                    <p className="text-[9px] font-black text-slate-800 leading-tight line-clamp-2 mt-1">{tumSirketPersonelleri[2].isim}</p>
                                                    <p className="text-[8px] font-bold text-slate-500 truncate w-full">{tumSirketPersonelleri[2].magaza}</p>
                                                    <div className="w-full bg-orange-100 py-1 rounded mt-1 border border-orange-200"><p className="text-[9px] font-black text-orange-700">{tumSirketPersonelleri[2].puanTahmin} Puan</p></div>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div className="w-full text-center py-6">
                                        <span className="text-[10px] text-white/50 font-bold uppercase tracking-wider">Henüz Personel Verisi Yok</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                    <button onClick={() => setAppMode('alim')} className="w-full bg-[#1D4ED8] hover:bg-blue-700 text-white px-6 py-4 rounded-2xl font-bold text-sm tracking-wide shadow-md shadow-blue-500/20 transition-all flex items-center justify-center gap-2 whitespace-nowrap mt-auto">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                        Cihaz Alımı Başlat
                    </button>
                </div>
            </div>

            {/* 2. BÖLÜM: TETİKLEYİCİ KARTLAR & YÖNETİCİ NOTU */}
            <div className={`grid grid-cols-1 ${!isBlocked ? 'lg:grid-cols-3' : 'lg:grid-cols-1'} gap-6 mb-8`}>
                
                {/* Personel Metrikleri - Vodafone'da Gizli */}
                {!isBlocked && (
                    <div 
                        onClick={() => setActiveDrawer('personel')}
                        className="relative overflow-hidden cursor-pointer group h-40 bg-[#0F172A] rounded-[2rem] p-8 shadow-lg transition-all hover:shadow-blue-900/20 flex justify-between items-center"
                    >
                        <div className="relative z-10">
                            <p className="text-blue-400 text-xs font-bold uppercase tracking-widest mb-2">Personel Metrikleri</p>
                            <h2 className="text-white text-3xl font-black italic">Güncel Durumunuz</h2>
                            <div className="flex gap-3 mt-3">
                                <span className="bg-white/10 text-white/90 text-[10px] px-3 py-1 rounded border border-white/5 font-bold uppercase">Sıralamalar</span>
                                <span className="bg-emerald-500/20 text-emerald-300 text-[10px] px-3 py-1 rounded border border-emerald-500/20 font-bold uppercase">Puanlar</span>
                            </div>
                        </div>
                        <div className="relative z-10 flex flex-col items-end">
                            <div className="w-12 h-12 rounded-full bg-blue-600/20 flex items-center justify-center text-blue-400 mb-2 group-hover:scale-110 transition-transform">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                            </div>
                            <span className="bg-blue-600 text-white text-[10px] px-4 py-2 rounded-lg font-bold uppercase group-hover:bg-blue-500 transition-colors shadow-lg shadow-blue-900/50">İncele</span>
                        </div>
                    </div>
                )}

                {/* Mağaza Skor Metrikleri - Vodafone'da Gizli */}
                {!isBlocked && (
                    <div 
                        onClick={() => setActiveDrawer('magaza')}
                        className="relative overflow-hidden cursor-pointer group h-40 bg-gradient-to-r from-purple-900 to-indigo-800 rounded-[2rem] p-8 shadow-lg transition-all hover:shadow-purple-900/20 flex justify-between items-center"
                    >
                        <div className="relative z-10">
                            <p className="text-purple-300 text-xs font-bold uppercase tracking-widest mb-2">Mağaza Skor Metrikleri</p>
                            <h2 className="text-white text-3xl font-black italic">Mağaza Performansı</h2>
                            <div className="flex gap-3 mt-3">
                                <span className="bg-white/10 text-white/90 text-[10px] px-3 py-1 rounded border border-white/5 font-bold uppercase">Hedefler</span>
                                <span className="bg-purple-500/30 text-purple-200 text-[10px] px-3 py-1 rounded border border-purple-500/30 font-bold uppercase">Kalan Adet</span>
                            </div>
                        </div>
                        <div className="relative z-10 flex flex-col items-end">
                            <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-300 mb-2 group-hover:scale-110 transition-transform">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                            </div>
                            <span className="bg-purple-600 text-white text-[10px] px-4 py-2 rounded-lg font-bold uppercase group-hover:bg-purple-500 transition-colors shadow-lg shadow-purple-900/50">Detaylar</span>
                        </div>
                    </div>
                )}

             {/* YENİ EKLENEN: HAFTANIN ODAĞI / YÖNETİCİ NOTU */}
                {/* Vodafone'da gizli, diğerlerinde görünür. */}
                {!isBlocked && (
                    <div className="relative overflow-hidden group h-40 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-[2rem] p-8 shadow-lg transition-all w-full">
                        {/* Dekoratif Arka Plan Halkaları */}
                        <div className="absolute top-[-20%] right-[-10%] w-32 h-32 bg-white opacity-10 rounded-full blur-2xl"></div>
                        
                        <div className="relative z-10 flex h-full justify-between items-center">
                            <div className="flex flex-col justify-center max-w-[70%]">
                                <div className="flex items-center gap-2 mb-2">
                                    <svg className="w-4 h-4 text-yellow-300" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                                    <p className="text-indigo-100 text-[10px] font-bold uppercase tracking-widest">Mağaza Vizyonu</p>
                                </div>
                                <h2 className="text-white text-xl font-black mb-1 leading-tight">"Müşteri geri çevirmek yok, mağazada yok yok!"</h2>
                                <p className="text-white/80 text-xs font-medium">Bu vizyonla bu ay hedefi patlatıyoruz! 🚀</p>
                            </div>
                            
                            {/* Sağ taraftaki Puan Kutusu */}
                            <div className="hidden sm:flex relative z-10 flex-col items-center justify-center bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-4 shrink-0 ml-4">
                                <span className="text-white/70 text-[9px] font-bold uppercase mb-1">Aylık Hedef</span>
                                <span className="text-white text-2xl font-black">100+</span>
                                <span className="text-white/90 text-[10px] font-bold">PUAN</span>
                            </div>
                        </div>
                    </div>
                )}  
             </div>
            {/* 3. BÖLÜM: HIZLI ERİŞİM */}
            <div>
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide mb-4 pl-1">Hızlı Erişim</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {izinlerAktifMi && (
                        <div onClick={() => setActiveModal('izinler')} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex items-center justify-between cursor-pointer hover:shadow-md hover:border-blue-300 transition-all group">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-500 flex items-center justify-center group-hover:scale-110 transition-transform"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg></div>
                                <div><h4 className="text-xs font-black text-slate-800 uppercase">İZİNLER</h4><p className="text-[10px] text-slate-500 font-medium mt-0.5">Personel izin takvimi</p></div>
                            </div>
                            <svg className="w-4 h-4 text-slate-300 group-hover:text-blue-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
                        </div>
                    )}
                    {hedeflerAktifMi && (
                        <div onClick={() => setActiveModal('hedefler')} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex items-center justify-between cursor-pointer hover:shadow-md hover:border-emerald-300 transition-all group">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-500 flex items-center justify-center group-hover:scale-110 transition-transform"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg></div>
                                <div><h4 className="text-xs font-black text-slate-800 uppercase">HEDEFLER</h4><p className="text-[10px] text-slate-500 font-medium mt-0.5">Mağaza hedef tablosu</p></div>
                            </div>
                            <svg className="w-4 h-4 text-slate-300 group-hover:text-emerald-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
                        </div>
                    )}
                    <div onClick={() => setActiveModal('departman')} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex items-center justify-between cursor-pointer hover:shadow-md hover:border-purple-300 transition-all group">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-500 flex items-center justify-center group-hover:scale-110 transition-transform"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg></div>
                            <div><h4 className="text-xs font-black text-slate-800 uppercase">RAPORLAR</h4><p className="text-[10px] text-slate-500 font-medium mt-0.5">Detaylı puan raporları</p></div>
                        </div>
                        <svg className="w-4 h-4 text-slate-300 group-hover:text-purple-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
                    </div>
                </div>
            </div>

            {/* ========================================================= */}
            {/* SAĞDAN KAYAN ÇEKMECE (DRAWER) YAPISI                     */}
            {/* ========================================================= */}
            <div 
                className={`fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[9998] transition-opacity duration-300 ${activeDrawer ? 'opacity-100 visible' : 'opacity-0 invisible'}`}
                onClick={() => setActiveDrawer(null)}
            ></div>

            <div className={`fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-[9999] transform transition-transform duration-300 ease-in-out flex flex-col ${activeDrawer ? 'translate-x-0' : 'translate-x-full'}`}>
                
                {/* DRAWER İÇERİĞİ: PERSONEL */}
                {activeDrawer === 'personel' && (
                    <>
                        <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
                            <h3 className="text-lg font-black text-slate-800">Personel Gidişat Sıralaması</h3>
                            <button onClick={() => setActiveDrawer(null)} className="text-slate-400 hover:text-slate-700 transition-colors">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-slate-50/50 space-y-3">
                            {aktifPersoneller.map((p, i) => {
                                let rankClass = "bg-white text-slate-500 border border-slate-200";
                                if (i === 0) rankClass = "bg-amber-100 text-amber-700 border border-amber-200";
                                else if (i === 1) rankClass = "bg-slate-200 text-slate-700 border border-slate-300";
                                else if (i === 2) rankClass = "bg-orange-100 text-orange-700 border border-orange-200";

                                const barWidthPercent = Math.min(100, ((Number(p.puanTahmin) || 0) / maxListePuani) * 100);

                                return (
                                    <div 
                                        key={i} 
                                        onClick={() => { setSelectedPersonel(p); setActiveModal('personel_detay'); }}
                                        className="group bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:border-blue-300 transition-all cursor-pointer"
                                    >
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 flex items-center justify-center rounded-full text-[10px] font-black ${rankClass}`}>
                                                    #{i + 1}
                                                </div>
                                                <span className="text-[13px] font-bold text-slate-800">{p.isim}</span>
                                            </div>
                                            <span className="text-[13px] font-black text-blue-600">{p.puanTahmin} Puan</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                <div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{ width: `${barWidthPercent}%` }}></div>
                                            </div>
                                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider shrink-0 w-24 text-right">
                                                AY SONU TAHMİN
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}

                {/* DRAWER İÇERİĞİ: MAĞAZA */}
                {activeDrawer === 'magaza' && (
                    <>
                        <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
                            <h3 className="text-lg font-black text-slate-800">Mağaza Gidişat Metrikleri</h3>
                            <button onClick={() => setActiveDrawer(null)} className="text-slate-400 hover:text-slate-700 transition-colors">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-slate-50/50 grid grid-cols-1 gap-4 h-max">
                            {dinamikMagazaMetrikleri.map((m, idx) => {
                                const kalanAdet = Math.max(0, m.data.hedef - m.data.satilan);

                                return (
                                    <div key={idx} className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
                                        
                                        <div className="flex justify-between items-start mb-4">
                                            <p className="text-sm font-black text-slate-700 uppercase">{m.name}</p>
                                            <div className="text-right">
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">AY SONU</p>
                                                <p className="text-xl font-black text-purple-600">{m.data.tahminPuan.toFixed(1)} <span className="text-xs font-bold text-purple-400">Puan</span></p>
                                            </div>
                                        </div>
                                        
                                        {/* Metrik Bilgi Panosu */}
                                        <div className="grid grid-cols-3 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
                                            <div className="text-center border-r border-slate-200">
                                                <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">Anlık Puan</p>
                                                <p className="text-sm font-black text-slate-800">{m.data.anlikPuan.toFixed(1)}</p>
                                            </div>
                                            <div className="text-center border-r border-slate-200">
                                                <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">Toplam Puan</p>
                                                <p className="text-sm font-black text-slate-800">{m.data.hedefPuan.toFixed(1)}</p>
                                            </div>
                                            <div className="text-center">
                                                <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">Kalan Adet</p>
                                                <p className="text-sm font-black text-rose-500">{kalanAdet}</p>
                                            </div>
                                        </div>

                                        <div className="mt-4 flex justify-between items-center text-[10px] font-bold text-slate-500 px-1">
                                            <span>Gerçekleşen: <span className="text-slate-800">{m.data.satilan}</span></span>
                                            <span>Hedef: <span className="text-slate-800">{m.data.hedef}</span></span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}

                {/* ORTAK SABİT ALT BUTON (KAPAT) */}
                <div className="p-4 bg-white border-t border-slate-100 shrink-0">
                    <button 
                        onClick={() => setActiveDrawer(null)} 
                        className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-3 rounded-xl transition-colors shadow-sm"
                    >
                        Paneli Kapat
                    </button>
                </div>
            </div>

            {/* ========================================================= */}
            {/* ALT MODALLAR                                              */}
            {/* ========================================================= */}
            {activeModal && (
                <div className="fixed inset-0 z-[10000] flex items-center justify-center px-4">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={() => setActiveModal(null)}></div>
                    
                    {activeModal === 'izinler' && (
                        <div className="relative bg-white rounded-3xl w-[98vw] max-w-[1600px] shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden flex flex-col max-h-[90vh]">
                            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                                <h3 className="text-xl font-black text-slate-800 flex items-center gap-3">Personel İzin Takvimi</h3>
                                <button onClick={() => setActiveModal(null)} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-200 text-slate-600 hover:bg-rose-500 hover:text-white transition-colors"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg></button>
                            </div>
                            <div className="flex-1 overflow-hidden p-4 flex flex-col">
                                {tumIzinler.length > 0 ? (
                                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm w-full flex-1 overflow-y-auto custom-scrollbar">
                                        <table className="w-full text-center border-collapse">
                                            <thead className="sticky top-0 z-20 shadow-sm">
                                                <tr className="bg-slate-100 text-slate-900">
                                                    {izinTarihBasliklari.map((cell: any, idx: number) => (<th key={`tarih-${idx}`} className="px-2 py-2 border border-slate-200 text-[10px] font-black uppercase">{idx === 0 && (!cell || cell === "") ? "ŞUBE" : cell}</th>))}
                                                </tr>
                                                <tr className="bg-white text-slate-600 border-b-2 border-slate-200">
                                                    {izinGunBasliklari.map((cell: any, idx: number) => (<th key={`gun-${idx}`} className="px-2 py-2 border border-slate-200 text-[10px] font-bold uppercase">{cell}</th>))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {tumIzinler.map((row: any, rowIndex: number) => {
                                                    const isNewBranch = row[0] && String(row[0]).trim() !== "";
                                                    if (isNewBranch) aktifSubeRenkIndex++;
                                                    const currentColors = izinRenkleri[Math.max(0, aktifSubeRenkIndex) % izinRenkleri.length];
                                                    const maxColCount = Math.max(izinTarihBasliklari.length, izinGunBasliklari.length, 7);
                                                    return (
                                                        <tr key={rowIndex} className={`bg-white transition-colors ${isNewBranch ? 'border-t-[3px] border-slate-200' : ''}`}>
                                                            {Array.from({ length: maxColCount }).map((_, cellIndex) => {
                                                                const cellValue = row[cellIndex] || "";
                                                                const isIzin = String(cellValue).toUpperCase().includes("İZİN");
                                                                let cellClasses = "px-2 py-1.5 border border-slate-100 text-xs align-middle ";
                                                                if (cellIndex === 0) cellClasses += isNewBranch ? `${currentColors.bg} ${currentColors.text} font-black` : "font-black text-slate-800 bg-slate-50";
                                                                else if (cellIndex === 1) cellClasses += "font-bold text-slate-700";
                                                                else if (isIzin) cellClasses += `${currentColors.badge} font-black rounded-sm shadow-sm`;
                                                                else cellClasses += "text-slate-500 font-medium";
                                                                return <td key={cellIndex} className={cellClasses}>{cellValue}</td>;
                                                            })}
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (<div className="flex flex-col items-center justify-center py-16 opacity-60"><h4 className="text-lg font-black text-slate-800 mb-1">İzin Kaydı Bulunamadı</h4></div>)}
                            </div>
                        </div>
                    )}

                    {activeModal === 'hedefler' && (
                        <div className="relative bg-white rounded-[2rem] w-[98vw] max-w-[1600px] shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden flex flex-col max-h-[90vh]">
                            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                                <h3 className="text-xl font-black text-slate-800 flex items-center gap-3">{selectedBranch} Personel Hedefleri</h3>
                                <button onClick={() => setActiveModal(null)} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-200 text-slate-600 hover:bg-rose-500 hover:text-white transition-colors"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg></button>
                            </div>
                            <div className="flex-1 overflow-hidden p-4 flex flex-col">
                                {seciliSubeHedefleri.length > 0 ? (
                                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm w-full flex-1 overflow-y-auto custom-scrollbar">
                                        <table className="w-full text-center">
                                            <thead className="sticky top-0 z-20 bg-slate-100 text-slate-900">
                                                <tr>{hedeflerBasliklar.map((baslik: any, idx: number) => (<th key={idx} className="px-1 py-2 border border-slate-200 text-[10px] font-black uppercase">{baslik}</th>))}</tr>
                                            </thead>
                                            <tbody>
                                                {seciliSubeHedefleri.map((row: any, rowIndex: number) => (
                                                    <tr key={rowIndex} className="hover:bg-slate-50 transition-colors">
                                                        {hedeflerBasliklar.map((_: any, cellIndex: number) => (
                                                            <td key={cellIndex} className={`px-1 py-2 border border-slate-100 text-xs align-middle ${cellIndex === 1 ? 'font-black text-sky-600' : 'text-slate-700 font-medium'}`}>{row[cellIndex] || 0}</td>
                                                        ))}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (<div className="flex flex-col items-center justify-center py-16 opacity-60"><h4 className="text-lg font-black text-slate-800 mb-1">Hedef Verisi Bulunamadı</h4></div>)}
                            </div>
                        </div>
                    )}

                    {activeModal === 'departman' && dinamikMagazaMetrikleri.length > 0 && (
                        <div className="relative bg-white rounded-[2rem] w-full max-w-4xl shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden border border-slate-200">
                            <div className="flex justify-between items-start p-6 border-b border-slate-100 bg-slate-50">
                                <div><h3 className="text-xl font-black text-slate-800">{selectedBranch} Departman Hedefleri</h3></div>
                                <button onClick={() => setActiveModal(null)} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-200 text-slate-600 hover:bg-slate-300 transition-colors mt-1"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                            </div>
                            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto max-h-[70vh] custom-scrollbar">
                                {dinamikMagazaMetrikleri.map((metrik, idx) => (<DepartmanProgressBar key={idx} title={metrik.name} data={metrik.data} colorClass={metrik.color} tahminiPuan={metrik.data.tahminPuan.toFixed(1)} />))}
                            </div>
                        </div>
                    )}
                    
                    {activeModal === 'personel_detay' && selectedPersonel && (
                        <div className="relative bg-white rounded-[2rem] w-full max-w-5xl shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden flex flex-col max-h-[90vh]">
                            <div className="flex justify-between items-start p-6 border-b border-slate-100 shrink-0 bg-slate-50">
                                <div>
                                    <h3 className="text-2xl font-black text-slate-800 flex items-center gap-3">{selectedPersonel.isim} <span className="bg-sky-100 text-sky-600 text-[10px] px-2.5 py-1 rounded-lg tracking-widest shadow-sm">Genel Puan: {selectedPersonel.toplamPuan}</span></h3>
                                </div>
                                <button onClick={() => setActiveModal(null)} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-200 text-slate-600 hover:bg-slate-300 transition-colors"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" /></svg></button>
                            </div>
                            <div className="p-6 overflow-y-auto custom-scrollbar bg-slate-50/50">
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {dinamikBaremler.map((barem, i) => {
                                        const hedef = selectedPersonel.hedefler[barem.name] || 0; 
                                        const satilan = selectedPersonel.gerceklesen[barem.name] || 0;
                                        const baremRule = dinamikPuanKurallari[cleanKey(barem.name)];
                                        const isRiskli = baremRule?.kural70 && (hedef > 0 ? (satilan / hedef < 0.7) : false);
                                        const baremPuanVal = calculatePoint(satilan, hedef, barem.name, false);
                                        const tahminiBaremPuan = calculatePoint(satilan, hedef, barem.name, true);
                                        if (hedef === 0 && satilan === 0) return null;
                                        return <DepartmanProgressBar key={i} title={barem.name} data={{ hedef, satilan, isCurrency: barem.isCurrency }} colorClass={barem.color} puan={baremPuanVal.toFixed(1)} tahminiPuan={tahminiBaremPuan.toFixed(1)} kural70={baremRule?.kural70} isRiskli={isRiskli} />;
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
