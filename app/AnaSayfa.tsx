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

    // 1. HEDEFLER TABLOSUNU AYIKLA (Üst Tablo)
    const ustTabloData = izinIdx !== -1 ? hedeflerData.slice(0, izinIdx) : hedeflerData;
    const seciliSubeHedefleri = ustTabloData.filter((row: any) => 
        Array.isArray(row) && String(row[0] || "").toUpperCase() === selectedBranch.toUpperCase().trim()
    );
    const hedeflerBasliklar = ustTabloData[0] || [];

    // 2. İZİNLER TABLOSUNU AYIKLA (Alt Tablo - Birebir E-Tablo Görünümü)
    const altTabloData = izinIdx !== -1 ? veriKaynagi.slice(izinIdx) : [];
    
    const izinTarihBasliklari = altTabloData.length > 1 ? altTabloData[1] : [];
    const izinGunBasliklari = altTabloData.length > 2 ? altTabloData[2] : [];
    
    const tumIzinler = altTabloData.length > 3 ? altTabloData.slice(3).filter((row:any) => row.length > 1 && (row[0] || row[1])) : [];

    // --- YENİ: İZİNLER İÇİN DİNAMİK RENK PALETİ (Koyu Tema Uyumlu) ---
    const izinRenkleri = [
        { bg: 'bg-sky-900/40', text: 'text-sky-300', badge: 'bg-sky-600/80 text-white' },
        { bg: 'bg-emerald-900/40', text: 'text-emerald-300', badge: 'bg-emerald-600/80 text-white' },
        { bg: 'bg-purple-900/40', text: 'text-purple-300', badge: 'bg-purple-600/80 text-white' },
        { bg: 'bg-rose-900/40', text: 'text-rose-300', badge: 'bg-rose-600/80 text-white' },
        { bg: 'bg-amber-900/40', text: 'text-amber-300', badge: 'bg-amber-600/80 text-white' },
        { bg: 'bg-indigo-900/40', text: 'text-indigo-300', badge: 'bg-indigo-600/80 text-white' },
    ];
    let aktifSubeRenkIndex = -1;

    // --- TÜRKİYE FORMATINA UYGUN GELİŞMİŞ SAYI OKUMA MOTORU ---
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
        const colorPalette = ["bg-sky-500", "bg-emerald-500", "bg-purple-500", "bg-indigo-500", "bg-orange-500", "bg-rose-500", "bg-amber-500", "bg-blue-500", "bg-fuchsia-500"];
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

        const formatVal = (v: number) => data.isCurrency 
            ? `${v.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ₺` 
            : `${v.toLocaleString('tr-TR')}`;

        return (
            <div className={`bg-[#0F172A] border ${isRisky ? 'border-rose-500/30' : 'border-slate-800'} rounded-2xl p-4 flex flex-col justify-between relative overflow-hidden transition-all hover:border-slate-600`}>
                {data.hedef > 0 && (
                    <div className={`absolute top-0 right-4 text-white text-[9px] font-bold px-2 py-1 rounded-b-md tracking-wider shadow-sm ${isBasarili ? 'bg-emerald-600/90' : 'bg-rose-600/90'}`}>
                        {isBasarili ? 'BAŞARILI' : 'RİSKLİ'}
                    </div>
                )}
                {data.hedefPuan > 0 && (
                     <div className="absolute top-0 left-0 bg-sky-900/40 border-b border-r border-sky-800/50 text-sky-400 text-[10px] font-bold px-3 py-1.5 rounded-br-xl tracking-wider flex items-center gap-1.5">
                        <svg className="w-3 h-3 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                        ANLIK: {data.anlikPuan?.toFixed(1)}
                    </div>
                )}
                <div className="flex justify-between items-start mb-3 mt-5">
                    <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{title}</h4>
                    {puan !== undefined && !data.hedefPuan && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${isRiskliBarem ? 'bg-rose-900/30 text-rose-400' : 'bg-sky-900/30 text-sky-400'}`}>Puan: {puan}</span>
                    )}
                </div>
                <div className="flex justify-between items-end mb-2">
                    <p className="text-xl font-bold text-white">{formatVal(data.satilan)} <span className="text-xs font-medium text-slate-500">/ {formatVal(data.hedef)}</span></p>
                    <div className="text-right">
                        <p className={`text-[10px] font-bold uppercase tracking-wider ${kalan > 0 ? (isRisky ? 'text-rose-400' : 'text-slate-400') : 'text-emerald-400'}`}>
                            {data.hedef > 0 ? (kalan > 0 ? `Kalan: ${formatVal(kalan)}` : 'TAMAMLANDI') : 'HEDEF YOK'}
                        </p>
                    </div>
                </div>
                {isRiskliBarem && (
                   <div className="bg-rose-900/20 border border-rose-800/50 rounded-lg py-1 px-2 mb-2">
                        <p className="text-[9px] font-bold text-rose-400 text-center uppercase tracking-wider flex items-center justify-center gap-1">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                            BARAJ ALTINDA
                        </p>
                   </div>
                )}
                <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden mb-3">
                    <div className={`h-full ${colorClass} rounded-full transition-all duration-1000`} style={{ width: `${yuzde}%` }}></div>
                </div>
                {data.hedef > 0 && (
                    <div className="flex justify-between items-center text-[10px] font-medium border-t border-slate-800 pt-2.5">
                        <span className="text-slate-500 uppercase tracking-wider">TAHMİN</span>
                        <span className={isBasarili ? 'text-emerald-400' : 'text-rose-400'}>{formatVal(projeksiyon)}</span>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="space-y-6 w-full animate-in fade-in duration-500 text-slate-200">
            {/* ÜST HEADER (Mavi Banner Yerine Kurumsal SaaS Header) */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-[#0F172A] p-6 rounded-[2rem] border border-slate-800 shadow-sm">
                <div>
                    <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-white flex items-center gap-2">
                        CNETMOBİL <span className="font-normal text-slate-500">/ {selectedBranch}</span>
                    </h2>
                    <p className="text-slate-400 text-sm mt-1">Sisteme hoş geldiniz. Veriler başarıyla yüklendi.</p>
                </div>
                <button onClick={() => setAppMode('alim')} className="bg-sky-600 hover:bg-sky-500 text-white px-6 py-3 rounded-xl font-medium text-sm tracking-wide shadow-[0_0_15px_rgba(2,132,199,0.3)] hover:shadow-[0_0_20px_rgba(2,132,199,0.5)] transition-all duration-300 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                    Cihaz Alımını Başlat
                </button>
            </div>

            {isCmr && (
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-stretch">
                    {/* SOL KOLON: ŞUBE KARTI */}
                    <div className="xl:col-span-2 w-full h-full flex flex-col gap-6">
                        <div className="bg-[#0F172A] rounded-[2rem] p-6 sm:p-8 border border-slate-800 shadow-sm flex flex-col justify-center">
                            <div className="flex justify-between items-start mb-8">
                                <div>
                                    <h3 className="text-xl font-bold text-white flex items-center gap-2 tracking-tight">
                                        Şube Performansı
                                    </h3>
                                    {lastUpdatedDate && (
                                        <div className="mt-2 inline-flex items-center gap-1.5 bg-slate-800/50 border border-slate-700/50 text-slate-400 text-[10px] font-semibold px-2.5 py-1 rounded-lg uppercase tracking-widest">
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                            GÜNCELLEME: {lastUpdatedDate}
                                        </div>
                                    )}
                                </div>
                                <button onClick={() => setActiveModal('departman')} className="bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 transition-all shadow-sm">
                                    {magazaAnlikPuan.toFixed(1)} Puan <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
                                </button>
                            </div>

                            {dinamikMagazaMetrikleri.length > 0 ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 cursor-pointer">
                                    <div className="bg-[#1E293B] border border-slate-700/50 rounded-2xl p-6 relative overflow-hidden transition-all hover:border-slate-500">
                                        <p className="text-slate-400 font-medium text-sm mb-3">Bu Ay Toplam {anaMetrikAdi}</p>
                                        <div className="flex items-baseline gap-1.5">
                                            <span className="text-4xl font-bold text-white">{anaSatis}</span>
                                            <span className="text-sm font-medium text-slate-500">Adet</span>
                                        </div>
                                    </div>
                                    <div onClick={() => setActiveModal('tahmin')} className="bg-[#1E293B] border border-slate-700/50 rounded-2xl p-6 relative overflow-hidden transition-all hover:border-slate-500 group">
                                        {!anaBasarili && (
                                            <div className="absolute top-4 right-4 bg-rose-500/20 text-rose-400 text-[10px] px-2.5 py-1 rounded-md font-bold tracking-wider uppercase border border-rose-500/20 flex items-center gap-1">
                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                                RİSKLİ
                                            </div>
                                        )}
                                        <p className="text-slate-400 font-medium text-sm mb-3 flex items-center gap-2">
                                           Ay Sonu {anaMetrikAdi} Tahmini
                                        </p>
                                        <div className="flex justify-between items-end">
                                            <div className="flex items-baseline gap-1.5">
                                                <span className={`text-4xl font-bold ${anaBasarili ? 'text-emerald-400' : 'text-rose-400'}`}>{anaProjeksiyon}</span>
                                                <span className={`text-sm font-medium ${anaBasarili ? 'text-emerald-500/70' : 'text-rose-500/70'}`}>Adet</span>
                                            </div>
                                            <div className="text-slate-500 group-hover:text-slate-300 transition-colors group-hover:translate-x-1 transform duration-300">
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="h-24 flex flex-col items-center justify-center text-center opacity-50 bg-slate-800/30 rounded-2xl border border-dashed border-slate-700">
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">VERİ BEKLENİYOR</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* SAĞ KOLON: LİDERLİK TABLOSU */}
                    <div className="xl:col-span-1 bg-[#0F172A] rounded-[2rem] p-6 border border-slate-800 shadow-sm flex flex-col h-full min-h-[400px]">
                        <div className="flex items-center justify-between mb-6 shrink-0">
                            <div>
                                <h3 className="text-lg font-bold text-white tracking-tight">Şube Liderlik Tablosu</h3>
                                <p className="text-[11px] text-slate-500 font-medium uppercase tracking-wider mt-1">Personel Gidişat</p>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
                            {aktifPersoneller.length > 0 ? aktifPersoneller.map((p: any, index: number) => {
                                const trendUp = parseFloat(p.puanTahmin) >= parseFloat(p.toplamPuan);
                                
                                // Kurumsal Sıralama Stilleri
                                let cardStyle = "bg-[#1E293B] border-slate-800 hover:border-slate-600";
                                let avatarStyle = "bg-slate-800 text-slate-400 border-slate-700";
                                let badgeStyle = "bg-slate-800 text-slate-400 border-slate-700";
                                let badgeText = "STANDART";

                                if (index === 0) {
                                    cardStyle = "bg-amber-500/5 border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.05)] hover:border-amber-500/50";
                                    avatarStyle = "bg-amber-500/20 text-amber-400 border-amber-500/30";
                                    badgeStyle = "bg-amber-500/20 text-amber-400 border-amber-500/30";
                                    badgeText = "1. LİDER";
                                } else if (index === 1) {
                                    cardStyle = "bg-slate-300/5 border-slate-400/30 hover:border-slate-400/50";
                                    avatarStyle = "bg-slate-500/20 text-slate-300 border-slate-500/30";
                                    badgeStyle = "bg-slate-500/20 text-slate-300 border-slate-500/30";
                                    badgeText = "2. UZMAN";
                                } else if (index === 2) {
                                    cardStyle = "bg-orange-500/5 border-orange-500/30 hover:border-orange-500/50";
                                    avatarStyle = "bg-orange-500/20 text-orange-400 border-orange-500/30";
                                    badgeStyle = "bg-orange-500/20 text-orange-400 border-orange-500/30";
                                    badgeText = "3. UZMAN";
                                }

                                return (
                                    <div key={index} onClick={() => { setSelectedPersonel(p); setActiveModal('personel_detay'); }} 
                                        className={`p-4 rounded-2xl border flex items-center justify-between cursor-pointer transition-all group ${cardStyle}`}>
                                        
                                        <div className="flex items-center gap-4">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm border ${avatarStyle}`}>
                                                {index + 1}
                                            </div>
                                            <div>
                                                <h4 className={`font-semibold text-sm flex items-center gap-1.5 transition-colors text-slate-200 group-hover:text-white`}>
                                                    {p.isim}
                                                    <span className={trendUp ? 'text-emerald-500' : 'text-rose-500'}>
                                                        <svg className={`w-3 h-3 ${trendUp ? '' : 'rotate-180'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
                                                    </span>
                                                </h4>
                                                <div className="flex gap-3 mt-1.5">
                                                    <span className="text-[10px] font-medium text-slate-400">Puan: {p.toplamPuan}</span>
                                                    <span className="text-[10px] font-medium text-slate-500">Tahmin: {p.puanTahmin}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="text-right flex items-center gap-4">
                                            <div className={`px-2.5 py-1 rounded-lg text-[9px] font-bold tracking-widest border ${badgeStyle}`}>
                                                {badgeText}
                                            </div>
                                            <div className="text-slate-600 group-hover:text-slate-400 transition-colors">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                            </div>
                                        </div>
                                    </div>
                                );
                            }) : (
                                <div className="h-full flex flex-col items-center justify-center opacity-50">
                                    <p className="font-medium text-slate-500 uppercase text-xs tracking-widest text-center">Veri bekleniyor</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {!isCmr && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-[#0F172A] rounded-[2rem] p-8 border border-slate-800 shadow-sm flex flex-col">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-12 h-12 rounded-xl bg-sky-900/30 text-sky-400 flex items-center justify-center shrink-0 border border-sky-800/50">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-white">Merkez Duyuruları</h3>
                                <p className="text-sm text-slate-400">Yönetimden gelen son bildirimler</p>
                            </div>
                        </div>
                        <div className="bg-[#1E293B] rounded-xl p-6 flex-1 border border-slate-700/50">
                            <p className="text-slate-300 font-medium leading-relaxed whitespace-pre-wrap text-sm">
                                {config.Duyuru_Metni || "Şu an için aktif bir mağaza duyurusu bulunmamaktadır."}
                            </p>
                        </div>
                    </div>

                    <div className="bg-[#0F172A] rounded-[2rem] p-8 border border-slate-800 shadow-sm flex flex-col overflow-hidden relative">
                        <div className="flex items-center gap-4 mb-6 relative z-10">
                            <div className="w-12 h-12 rounded-xl bg-orange-900/30 text-orange-400 flex items-center justify-center shrink-0 border border-orange-800/50">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" /></svg>
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-white">Aktif Kampanyalar</h3>
                                <p className="text-sm text-slate-400">Müşteriye sunulacak fırsatlar</p>
                            </div>
                        </div>
                        <div className="flex-1 flex items-center justify-center bg-[#1E293B] rounded-xl border border-slate-700/50 py-8 relative z-10 overflow-hidden">
                            <div className="whitespace-nowrap animate-marquee font-bold text-lg md:text-xl tracking-wide text-orange-400">
                                 {config.Kampanya_Metni || "GÜNCEL KAMPANYA BULUNMAMAKTADIR"}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* SAĞ ALT YÜZEN BUTONLAR (Sadeleştirilmiş Kurumsal Görünüm) */}
            <div className="fixed bottom-10 right-8 z-40 flex flex-col gap-4 items-end">
                {izinlerAktifMi && (
                    <button onClick={() => setActiveModal('izinler')} className="w-14 h-14 bg-[#1E293B] hover:bg-slate-700 border border-slate-700 rounded-2xl flex items-center justify-center text-purple-400 shadow-lg hover:shadow-xl transition-all group">
                        <svg className="w-6 h-6 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    </button>
                )}

                {hedeflerAktifMi && (
                    <button onClick={() => setActiveModal('hedefler')} className="w-14 h-14 bg-[#1E293B] hover:bg-slate-700 border border-slate-700 rounded-2xl flex items-center justify-center text-sky-400 shadow-lg hover:shadow-xl transition-all group">
                        <svg className="w-6 h-6 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                    </button>
                )}
            </div>

            {/* MODALLAR (Koyu Temaya Uyarlandı) */}
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
                                    <span className="text-purple-300 text-[10px] uppercase tracking-widest bg-purple-900/30 px-2 py-1 rounded-md ml-2 border border-purple-800/50">
                                        TÜM ŞUBELER
                                    </span>
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
                                        <svg className="w-16 h-16 text-slate-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>
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
                                        <svg className="w-16 h-16 text-slate-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>
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
                                        <div className="text-rose-500 mt-0.5"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg></div>
                                        <div>
                                            <h4 className="text-rose-400 font-bold text-sm mb-1">Hedefin Gerisindesiniz!</h4>
                                            <p className="text-rose-500/70 text-[11px] leading-relaxed">Mevcut satış hızınıza göre ay sonu tahmini {anaProjeksiyon} adet, hedefinizin ({anaHedef}) altında kalıyor.</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-emerald-900/10 border border-emerald-800/50 rounded-xl p-4 flex gap-3">
                                        <div className="text-emerald-500 mt-0.5"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div>
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
                            <div className="p-4 border-t border-slate-800">
                                <button onClick={() => setActiveModal(null)} className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white font-medium rounded-xl text-sm transition-colors">Kapat</button>
                            </div>
                        </div>
                    )}
                    
                    {/* DEPARTMAN MODALI */}
                    {activeModal === 'departman' && dinamikMagazaMetrikleri.length > 0 && (
                        <div className="relative bg-[#0F172A] border border-slate-800 rounded-[2rem] w-full max-w-4xl shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden">
                            <div className="flex justify-between items-start p-6 border-b border-slate-800 bg-[#1E293B]/30">
                                <div>
                                    <h3 className="text-xl font-bold text-white">{selectedBranch} Departman Hedefleri</h3>
                                    <div className="flex flex-wrap items-center gap-3 mt-4">
                                        <div className="bg-emerald-900/20 border border-emerald-800/50 rounded-xl px-4 py-2 flex items-center gap-3">
                                            <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                            <div className="flex flex-col">
                                                <span className="text-[10px] text-emerald-500 font-medium uppercase tracking-wider">Toplanan Puan</span>
                                                <span className="text-lg font-bold text-emerald-400 leading-none mt-1">{magazaAnlikPuan.toFixed(1)}</span>
                                            </div>
                                        </div>
                                        <div className="bg-sky-900/20 border border-sky-800/50 rounded-xl px-4 py-2 flex items-center gap-3">
                                            <svg className="w-5 h-5 text-sky-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                                            <div className="flex flex-col">
                                                <span className="text-[10px] text-sky-500 font-medium uppercase tracking-wider">Tahmin Puan</span>
                                                <span className="text-lg font-bold text-sky-400 leading-none mt-1">{magazaTahminPuan.toFixed(1)}</span>
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
                                    <p className="text-[10px] text-slate-400 font-medium tracking-widest uppercase mt-2">
                                        TÜM ŞUBELERDEKİ TOPLAM VERİLER
                                    </p>
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
