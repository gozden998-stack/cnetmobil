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
    // 🚀 TABLO KESİCİ VE VERİ İŞLEME MOTORU (DEĞİŞTİRİLMEDİ)
    // =========================================================================
    const veriKaynagi = izinlerData && izinlerData.length > 0 ? izinlerData : hedeflerData;
    const izinIdx = veriKaynagi.findIndex((row: any) => Array.isArray(row) && row.join("").toUpperCase().includes("İZİN ÇİZELGESİ"));

    const ustTabloData = izinIdx !== -1 ? hedeflerData.slice(0, izinIdx) : hedeflerData;
    const seciliSubeHedefleri = ustTabloData.filter((row: any) => Array.isArray(row) && String(row[0] || "").toUpperCase() === selectedBranch.toUpperCase().trim());
    const hedeflerBasliklar = ustTabloData[0] || [];

    const altTabloData = izinIdx !== -1 ? veriKaynagi.slice(izinIdx) : [];
    const izinTarihBasliklari = altTabloData.length > 1 ? altTabloData[1] : [];
    const izinGunBasliklari = altTabloData.length > 2 ? altTabloData[2] : [];
    const tumIzinler = altTabloData.length > 3 ? altTabloData.slice(3).filter((row:any) => row.length > 1 && (row[0] || row[1])) : [];

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
                
                const calcStorePts = (act: number, tgt: number, hp: number, mp: number, isP: boolean) => {
                    if (!tgt || tgt === 0 || !hp) return 0;
                    const v = isP ? (act / currentDay) * daysInMonth : act;
                    return Math.min(mp || hp, (v / tgt) * hp);
                };

                const anlikPts = calcStorePts(sVal, hVal, hpVal, mpVal, false);
                const tahminPts = calcStorePts(sVal, hVal, hpVal, mpVal, true);

                magazaAnlikPuan += anlikPts;
                magazaTahminPuan += tahminPts;

                dinamikMagazaMetrikleri.push({ name: hName, color: colorPalette[colorIndex % colorPalette.length], data: { hedef: hVal, satilan: sVal, isCurrency: isCurr } });
                if (colorIndex === 0) { anaSatis = sVal; anaHedef = hVal; anaMetrikAdi = hName; }
                colorIndex++;
            }
        });
    }

    let aktifPersoneller: any[] = [];
    if (personelData && personelData.length > 0) {
        const gerceklesenIndex = personelData.findIndex((row: any) => Array.isArray(row) && row.some((cell: any) => typeof cell === 'string' && cell.toLowerCase().includes('gerçekleşen')));
        let dinamikBaremler: any[] = [];
        
        const baslikSatiri = personelData[0] || [];
        baslikSatiri.forEach((cell: any, index: number) => {
            if (index >= 2) {
                const baslikAdi = String(cell || "").trim();
                if (baslikAdi && !baslikAdi.toLowerCase().includes('gerçekleşen') && !baslikAdi.toLowerCase().includes('isim')) {
                    dinamikBaremler.push({ indexOffset: index - 2, orijinalIndex: index, name: baslikAdi });
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

        aktifPersoneller = Object.values(personelDict)
            .filter((p: any) => p.magaza.includes(selectedBranch.trim().toUpperCase()))
            .map((p: any) => {
                let pAnlik = 0;
                dinamikBaremler.forEach(b => { pAnlik += calculatePoint(p.gerceklesen[b.name] || 0, p.hedefler[b.name] || 0, b.name, false); });
                return { ...p, toplamPuan: pAnlik.toFixed(1), basariYuzdesi: p.anaHedef > 0 ? Math.min(100, Math.round((p.anaSatilan / p.anaHedef) * 100)) : 0 };
            })
            .sort((a: any, b: any) => parseFloat(b.toplamPuan) - parseFloat(a.toplamPuan));
    }

    const anaYuzde = anaHedef > 0 ? Math.round((anaSatis / anaHedef) * 100) : 0;
    const kalanAdet = Math.max(0, anaHedef - anaSatis);

    // =========================================================================
    // 🎨 YENİ GÖRSEL YAPI (FOTOĞRAFTAKİ BİREBİR ARAYÜZ)
    // =========================================================================
    return (
        <div className="min-h-screen bg-[#F8F9FB] p-4 md:p-8 font-sans text-slate-800">
            
            {/* --- ÜST BÖLÜM: ANA BİLGİ VE KPI KARTLARI (TEK BEYAZ KUTU İÇİNDE) --- */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex flex-col xl:flex-row justify-between items-center gap-6 mb-6">
                
                {/* 1. Şube Bilgisi */}
                <div className="flex flex-col xl:border-r border-slate-100 pr-6 min-w-max">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                        <h2 className="font-extrabold text-slate-800 uppercase tracking-tight">{selectedBranch} ŞUBESİ</h2>
                    </div>
                    <span className="text-emerald-500 font-bold text-sm mb-4">Aktif</span>
                    <div className="flex items-center gap-2 text-slate-400 text-xs font-medium">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                        Son Güncelleme <br/> {lastUpdatedDate || "Bilinmiyor"}
                    </div>
                </div>

                {/* 2. Bugünkü Satış (Placeholder, fotoğrafa uymak için) */}
                <div className="flex items-center gap-4 xl:border-r border-slate-100 pr-6">
                    <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-500 flex items-center justify-center shrink-0">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-500 uppercase mb-1">BUGÜNKÜ SATIŞ</p>
                        <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-black">{Math.round(anaSatis / currentDay) || 0}</span>
                            <span className="text-xs font-bold text-slate-400">Adet</span>
                        </div>
                    </div>
                </div>

                {/* 3. Bu Ay Toplam Satış */}
                <div className="flex items-center gap-4 xl:border-r border-slate-100 pr-6">
                    <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-500 flex items-center justify-center shrink-0">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-500 uppercase mb-1">BU AY TOPLAM SATIŞ</p>
                        <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-black">{anaSatis}</span>
                            <span className="text-xs font-bold text-slate-400">Adet</span>
                        </div>
                        <p className="text-xs font-bold text-blue-500 mt-1">Hedefe göre %{anaYuzde}</p>
                    </div>
                </div>

                {/* 4. Bu Ay Puan */}
                <div className="flex items-center gap-4 xl:border-r border-slate-100 pr-6">
                    <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-500 flex items-center justify-center shrink-0">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-500 uppercase mb-1">BU AY PUAN</p>
                        <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-black">{magazaAnlikPuan.toFixed(1)}</span>
                            <span className="text-xs font-bold text-slate-400">Puan</span>
                        </div>
                    </div>
                </div>

                {/* 5. Bu Ay Hedef */}
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-500 flex items-center justify-center shrink-0">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-500 uppercase mb-1">BU AY HEDEF</p>
                        <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-black">{anaHedef}</span>
                            <span className="text-xs font-bold text-slate-400">Adet</span>
                        </div>
                        <div className="flex items-center gap-1 mt-1">
                            <span className="text-xs font-bold text-emerald-500">▲ %{anaYuzde}</span>
                            <span className="text-[10px] text-slate-400">gerçekleşme</span>
                        </div>
                    </div>
                </div>

                {/* 6. Aksiyon Butonu */}
                <div className="ml-auto">
                    <button onClick={() => setAppMode('alim')} className="bg-[#1D4ED8] hover:bg-blue-700 text-white px-6 py-4 rounded-xl font-bold text-sm tracking-wide shadow-md transition-all flex items-center gap-2 whitespace-nowrap">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                        Cihaz Alımı Başlat
                    </button>
                </div>
            </div>

            {/* --- ORTA BÖLÜM: GRAFİK VE LİDERLİK TABLOSU --- */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                
                {/* Sol: Performans Grafiği (Placeholder / Görsel Benzerlik) */}
                <div className="lg:col-span-2 bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex flex-col">
                    <div className="flex justify-between items-start mb-6">
                        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">SATIŞ PERFORMANS GRAFİĞİ</h3>
                        <select className="bg-slate-50 border border-slate-200 text-slate-600 text-xs font-semibold rounded-lg px-3 py-1.5 outline-none">
                            <option>Bu Ay</option>
                        </select>
                    </div>
                    <div className="flex gap-10 mb-6">
                        <div>
                            <p className="text-xs font-bold text-slate-500">Toplam Satış</p>
                            <p className="text-lg font-black text-blue-600">{anaSatis} <span className="text-xs font-semibold text-slate-400">Adet</span></p>
                        </div>
                        <div>
                            <p className="text-xs font-bold text-slate-500">Ortalama Günlük</p>
                            <p className="text-lg font-black text-blue-600">{Math.round(anaSatis / currentDay) || 0} <span className="text-xs font-semibold text-slate-400">Adet</span></p>
                        </div>
                    </div>
                    <div className="flex-1 relative w-full h-48 bg-slate-50/50 rounded-xl border border-slate-100 overflow-hidden flex items-end">
                        {/* Görseldeki gibi basit bir SVG dalga animasyonu/placeholder */}
                        <svg viewBox="0 0 1000 200" className="w-full h-full preserve-3d" preserveAspectRatio="none">
                            <defs>
                                <linearGradient id="blueGradient" x1="0" x2="0" y1="0" y2="1">
                                    <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.4" />
                                    <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.0" />
                                </linearGradient>
                            </defs>
                            <path d="M0,150 C100,140 200,60 300,100 C400,140 500,40 600,120 C700,200 800,20 1000,80 L1000,200 L0,200 Z" fill="url(#blueGradient)" />
                            <path d="M0,150 C100,140 200,60 300,100 C400,140 500,40 600,120 C700,200 800,20 1000,80" fill="none" stroke="#2563EB" strokeWidth="3" />
                            <circle cx="1000" cy="80" r="6" fill="#2563EB" />
                        </svg>
                        <div className="absolute right-0 top-[20%] bg-blue-600 text-white text-[10px] font-bold px-2 py-1 rounded-md transform -translate-y-full -translate-x-2">
                            {anaSatis}
                        </div>
                    </div>
                </div>

                {/* Sağ: Personel Liderlik Tablosu */}
                <div className="lg:col-span-1 bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex flex-col">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">PERSONEL LİDERLİK TABLOSU</h3>
                        <button onClick={() => setActiveModal('departman')} className="text-xs font-semibold text-slate-500 border border-slate-200 px-3 py-1 rounded-lg hover:bg-slate-50">Tümünü Gör</button>
                    </div>
                    
                    <div className="flex flex-col gap-5">
                        {aktifPersoneller.slice(0, 3).map((p, i) => {
                            let badgeStyle = "bg-amber-100 text-amber-700";
                            let badgeIcon = "🏆";
                            let badgeText = "Satış Lideri";
                            let barColor = "bg-amber-400";
                            let medalSrc = "https://cdn-icons-png.flaticon.com/512/2583/2583344.png"; // 1st

                            if (i === 1) {
                                badgeStyle = "bg-slate-100 text-slate-600";
                                badgeIcon = "🥈";
                                badgeText = "Elit Satıcı";
                                barColor = "bg-blue-500";
                                medalSrc = "https://cdn-icons-png.flaticon.com/512/2583/2583315.png"; // 2nd
                            } else if (i === 2) {
                                badgeStyle = "bg-orange-100 text-orange-700";
                                badgeIcon = "🥉";
                                badgeText = "Uzman Satıcı";
                                barColor = "bg-emerald-500";
                                medalSrc = "https://cdn-icons-png.flaticon.com/512/2583/2583434.png"; // 3rd
                            }

                            return (
                                <div key={i} className="flex items-center justify-between" onClick={() => { setSelectedPersonel(p); setActiveModal('personel_detay'); }}>
                                    <div className="flex items-center gap-3 w-1/2">
                                        <div className="w-10 h-10 relative flex-shrink-0">
                                            <img src={medalSrc} alt="rank" className="w-full h-full object-contain" />
                                        </div>
                                        <div className="w-10 h-10 bg-slate-200 rounded-full flex-shrink-0 overflow-hidden border border-slate-300">
                                            <svg className="w-full h-full text-slate-400 mt-2" fill="currentColor" viewBox="0 0 24 24"><path d="M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                                        </div>
                                        <div>
                                            <p className="text-xs font-black text-slate-800 whitespace-nowrap">{p.isim} <span className="text-emerald-500 text-[10px]">↗</span></p>
                                            <div className="flex items-center gap-1.5 mt-1">
                                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 ${badgeStyle}`}>
                                                    <span>{badgeIcon}</span> {badgeText}
                                                </span>
                                                <span className="text-[10px] font-bold text-slate-800">{p.toplamPuan} <span className="text-slate-400 font-medium">Puan</span></span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="w-1/2 flex items-center gap-3 pl-4">
                                        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                            <div className={`h-full ${barColor}`} style={{ width: `${p.basariYuzdesi}%` }}></div>
                                        </div>
                                        <span className="text-xs font-black text-slate-800">%{p.basariYuzdesi}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* --- ALT BÖLÜM 1: KATEGORİLER VE HEDEF ÖZETİ --- */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                
                {/* Kategori Performansları */}
                <div className="lg:col-span-2 flex flex-col gap-4">
                    <div className="flex justify-between items-center">
                        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">KATEGORİLERE GÖRE PERFORMANS</h3>
                        <select className="bg-white border border-slate-200 text-slate-600 text-xs font-semibold rounded-lg px-3 py-1.5 outline-none shadow-sm">
                            <option>Bu Ay</option>
                        </select>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 flex-1">
                        {dinamikMagazaMetrikleri.slice(0, 4).map((m, idx) => {
                            const yuzde = m.data.hedef > 0 ? Math.round((m.data.satilan / m.data.hedef) * 100) : 0;
                            // Görseldeki gibi farklı ikonlar
                            const icons = [
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>,
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" /></svg>,
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                            ];
                            const colors = ['text-blue-500 bg-blue-50', 'text-emerald-500 bg-emerald-50', 'text-purple-500 bg-purple-50', 'text-amber-500 bg-amber-50'];
                            const strokeColors = ['#3B82F6', '#10B981', '#A855F7', '#F59E0B'];

                            return (
                                <div key={idx} className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
                                    <div className="flex items-center gap-2 mb-4">
                                        <div className={`p-1.5 rounded-lg ${colors[idx % 4]}`}>{icons[idx % 4]}</div>
                                        <p className="text-xs font-bold text-slate-800">{m.name}</p>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-2xl font-black text-slate-800">%{yuzde}</p>
                                            <p className="text-[10px] font-bold text-blue-500 mt-2">{m.data.satilan} / {m.data.hedef}</p>
                                        </div>
                                        {/* Basit dairesel progress bar (SVG) */}
                                        <div className="relative w-12 h-12">
                                            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                                                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#F1F5F9" strokeWidth="4" />
                                                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke={strokeColors[idx % 4]} strokeWidth="4" strokeDasharray={`${yuzde}, 100`} />
                                            </svg>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Hedef Özeti */}
                <div className="lg:col-span-1 bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex flex-col">
                    <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide mb-6">HEDEF ÖZETİ</h3>
                    <div className="flex items-center justify-center relative mb-6">
                        <svg className="w-40 h-40 transform -rotate-90" viewBox="0 0 36 36">
                            <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#F1F5F9" strokeWidth="4" />
                            <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#10B981" strokeWidth="4" strokeDasharray={`${anaYuzde}, 100`} />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-2xl font-black text-slate-800">%{anaYuzde}</span>
                            <span className="text-[10px] text-slate-500 font-bold">Gerçekleşme</span>
                        </div>
                    </div>
                    <div className="space-y-3 mt-auto">
                        <div className="flex justify-between items-center text-sm">
                            <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div><span className="text-slate-600 font-medium">Gerçekleşen</span></div>
                            <span className="font-bold text-emerald-500">{anaSatis} <span className="text-xs text-slate-400">Adet</span></span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                            <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-amber-500"></div><span className="text-slate-600 font-medium">Kalan</span></div>
                            <span className="font-bold text-amber-500">{kalanAdet} <span className="text-xs text-slate-400">Adet</span></span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                            <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-blue-500"></div><span className="text-slate-600 font-medium">Hedef</span></div>
                            <span className="font-bold text-blue-500">{anaHedef} <span className="text-xs text-slate-400">Adet</span></span>
                        </div>
                    </div>
                </div>
            </div>

            {/* --- ALT BÖLÜM 2: HIZLI ERİŞİM (SİSTEM MODALLARINIZ BURAYA BAĞLANDI) --- */}
            <div>
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide mb-4">HIZLI ERİŞİM</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    
                    {/* İzinler Butonu */}
                    <div onClick={() => setActiveModal('izinler')} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm flex items-center justify-between cursor-pointer hover:shadow-md hover:border-blue-200 transition-all group">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-500 flex items-center justify-center group-hover:scale-105 transition-transform">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                            </div>
                            <div>
                                <h4 className="text-xs font-bold text-slate-800 uppercase">İZİNLER</h4>
                                <p className="text-[10px] text-slate-500 font-medium leading-tight mt-0.5">İzin taleplerini görüntüle<br/>ve yönet</p>
                            </div>
                        </div>
                        <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
                    </div>

                    {/* Hedefler Butonu */}
                    <div onClick={() => setActiveModal('hedefler')} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm flex items-center justify-between cursor-pointer hover:shadow-md hover:border-emerald-200 transition-all group">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-500 flex items-center justify-center group-hover:scale-105 transition-transform">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                            </div>
                            <div>
                                <h4 className="text-xs font-bold text-slate-800 uppercase">HEDEFLER</h4>
                                <p className="text-[10px] text-slate-500 font-medium leading-tight mt-0.5">Hedef tanımla, düzenle<br/>ve takibini yap</p>
                            </div>
                        </div>
                        <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
                    </div>

                    {/* Departman/Raporlar Butonu */}
                    <div onClick={() => setActiveModal('departman')} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm flex items-center justify-between cursor-pointer hover:shadow-md hover:border-purple-200 transition-all group">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-500 flex items-center justify-center group-hover:scale-105 transition-transform">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                            </div>
                            <div>
                                <h4 className="text-xs font-bold text-slate-800 uppercase">RAPORLAR</h4>
                                <p className="text-[10px] text-slate-500 font-medium leading-tight mt-0.5">Detaylı satış ve performans<br/>raporlarına eriş</p>
                            </div>
                        </div>
                        <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
                    </div>

                    {/* Duyurular Butonu (Tıklanınca alert verebilir veya yeni modal açılabilir, şimdilik placeholder) */}
                    <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm flex items-center justify-between cursor-pointer hover:shadow-md hover:border-blue-200 transition-all group">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-500 flex items-center justify-center group-hover:scale-105 transition-transform">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>
                            </div>
                            <div>
                                <h4 className="text-xs font-bold text-slate-800 uppercase">DUYURULAR</h4>
                                <p className="text-[10px] text-slate-500 font-medium leading-tight mt-0.5">Tüm duyuru ve bildirimleri<br/>görüntüle</p>
                            </div>
                        </div>
                        <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
                    </div>

                </div>
            </div>

            {/* MODALLARINIZ (ESKİ IŞIK/BEYAZ TEMALI HALİYLE EKLENEBİLİR, BURADA YER TUTUCU OLARAK KISALTTIM) */}
            {activeModal && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center px-4">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={() => setActiveModal(null)}></div>
                    <div className="relative bg-white rounded-3xl p-8 shadow-2xl z-10 w-full max-w-2xl text-center">
                        <h2 className="text-2xl font-black text-slate-800 mb-4">{activeModal.toUpperCase()} DETAYLARI</h2>
                        <p className="text-slate-500 mb-6">Bu bölüm mevcut tablo/veri yapınızla render edilecek.</p>
                        <button onClick={() => setActiveModal(null)} className="bg-blue-600 text-white px-6 py-2 rounded-xl font-bold">KAPAT</button>
                    </div>
                </div>
            )}
        </div>
    );
}
