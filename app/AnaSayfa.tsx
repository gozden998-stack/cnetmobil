import React, { useEffect, useState } from 'react';

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

    // Personel kartı için dinamik ortalama başarı puanı
    const ortalamaPerformans = aktifPersoneller.length > 0 
        ? (aktifPersoneller.reduce((acc, p) => acc + (Number(p.puanTahmin) || 0), 0) / aktifPersoneller.length).toFixed(1)
        : "0";

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

    return (
        <div className="min-h-screen bg-[#070B14] p-4 md:p-8 font-sans text-slate-100 animate-in fade-in duration-500 overflow-x-hidden selection:bg-blue-600 selection:text-white">
            
            {/* ========================================================= */}
            {/* ÜST KOKPİT BARI (HEADER & CTA) */}
            {/* ========================================================= */}
            <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-5 mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-2xl">
                <div className="flex items-center gap-3">
                    <div className="w-3.5 h-3.5 rounded-full bg-emerald-400 animate-pulse ring-4 ring-emerald-400/20"></div>
                    <div>
                        <h1 className="font-black text-white text-xl md:text-2xl tracking-tight uppercase">{selectedBranch} <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">KOKPİT</span></h1>
                        <p className="text-xs text-slate-400 font-medium mt-0.5">Son Senkronizasyon: <span className="text-slate-300 font-bold">{lastUpdatedDate || "Sistem Saati"}</span></p>
                    </div>
                </div>

                <button 
                    onClick={() => setAppMode('alim')} 
                    className="w-full md:w-auto bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-8 py-4 rounded-2xl font-black text-sm tracking-wide shadow-lg shadow-blue-600/30 transition-all transform hover:-translate-y-0.5 flex items-center justify-center gap-2.5 whitespace-nowrap"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                    Cihaz Alımı Başlat
                </button>
            </div>

            {/* ========================================================= */}
            {/* HERO DECK: 4 BÜYÜK PREMİUM KART (Görsel Kodlarının Bağlandığı Yer) */}
            {/* ========================================================= */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">

                {/* 1. KART: Güncel Durumunuz (Personel) */}
                <div className="bg-gradient-to-br from-[#041534] to-[#081f4f] rounded-3xl p-7 text-white shadow-2xl border border-white/5 flex flex-col justify-between relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-all pointer-events-none"></div>
                    <div>
                        <div className="text-blue-400 text-xs font-extrabold uppercase tracking-widest">
                            Personel Metrikleri
                        </div>
                        <h2 className="text-3xl xl:text-4xl italic font-black mt-3 tracking-tight leading-tight">
                            Güncel Durumunuz
                        </h2>

                        <div className="bg-[#0b214d]/80 backdrop-blur-md rounded-2xl mt-6 p-4 grid grid-cols-3 gap-2 border border-white/5">
                            <div className="text-center border-r border-white/5">
                                <div className="text-slate-400 text-[11px] font-medium">Sistemdeki</div>
                                <div className="text-2xl font-black text-white mt-0.5">{tumSirketPersonelleri.length}</div>
                            </div>
                            <div className="text-center border-r border-white/5">
                                <div className="text-slate-400 text-[11px] font-medium">Şube Aktif</div>
                                <div className="text-2xl font-black text-sky-400 mt-0.5">{aktifPersoneller.length}</div>
                            </div>
                            <div className="text-center">
                                <div className="text-slate-400 text-[11px] font-medium">Ort. Puan</div>
                                <div className="text-2xl font-black text-emerald-400 mt-0.5">{ortalamaPerformans}</div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 mt-6 pt-4 border-t border-white/5">
                        <button onClick={() => setActiveDrawer('personel')} className="bg-[#13294f] hover:bg-[#1c3b73] transition-colors py-2.5 rounded-xl font-bold text-xs text-slate-200">
                            Sıralama
                        </button>
                        <button onClick={() => setActiveModal('departman')} className="bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 border border-emerald-500/30 transition-colors py-2.5 rounded-xl font-bold text-xs">
                            Puanlar
                        </button>
                        <button onClick={() => setActiveDrawer('personel')} className="bg-blue-600 hover:bg-blue-500 transition-colors py-2.5 rounded-xl font-bold text-xs shadow-lg shadow-blue-900/50">
                            İncele
                        </button>
                    </div>
                </div>

                {/* 2. KART: Mağaza Performansı */}
                <div className="bg-gradient-to-r from-purple-800 to-violet-600 rounded-3xl p-7 text-white shadow-2xl border border-white/5 flex flex-col justify-between relative overflow-hidden group">
                    <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-white/10 rounded-full blur-2xl group-hover:scale-125 transition-transform pointer-events-none"></div>
                    <div>
                        <div className="uppercase text-xs font-extrabold tracking-widest text-purple-200">
                            Mağaza Skor Metrikleri
                        </div>
                        <h2 className="text-3xl xl:text-4xl italic font-black mt-3 tracking-tight leading-tight">
                            Mağaza Performansı
                        </h2>

                        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 mt-6 grid grid-cols-3 gap-2 text-center border border-white/10">
                            <div className="border-r border-white/10">
                                <div className="text-purple-200 text-[11px] font-medium">Aylık Hedef</div>
                                <div className="text-2xl font-black mt-0.5">{anaHedef}</div>
                            </div>
                            <div className="border-r border-white/10">
                                <div className="text-purple-200 text-[11px] font-medium">Gerçekleşen</div>
                                <div className="text-2xl font-black text-emerald-300 mt-0.5">{anaSatis}</div>
                            </div>
                            <div>
                                <div className="text-purple-200 text-[11px] font-medium">Kalan</div>
                                <div className="text-2xl font-black text-amber-300 mt-0.5">{kalanHedef}</div>
                            </div>
                        </div>

                        <div className="mt-5">
                            <div className="w-full bg-black/25 h-3 rounded-full overflow-hidden p-0.5 border border-white/10">
                                <div className="bg-gradient-to-r from-cyan-400 to-emerald-400 h-full rounded-full transition-all duration-1000" style={{ width: `${tamamlananYuzde}%` }}></div>
                            </div>
                            <div className="text-right mt-1.5 text-[11px] font-bold text-purple-200 tracking-wider">
                                %{tamamlananYuzde} Tamamlandı
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 mt-6 pt-4 border-t border-white/5">
                        <button onClick={() => setActiveModal('hedefler')} className="bg-white/10 hover:bg-white/20 transition-colors py-2.5 rounded-xl font-bold text-xs text-purple-100">
                            Hedefler
                        </button>
                        <button onClick={() => setActiveDrawer('magaza')} className="bg-white/10 hover:bg-white/20 transition-colors py-2.5 rounded-xl font-bold text-xs text-purple-100">
                            Kalan Adet
                        </button>
                        <button onClick={() => setActiveDrawer('magaza')} className="bg-fuchsia-600 hover:bg-fuchsia-500 transition-colors py-2.5 rounded-xl font-bold text-xs shadow-lg shadow-fuchsia-950/50">
                            Detaylar
                        </button>
                    </div>
                </div>

                {/* 3. KART: Mağaza Vizyonu */}
                <div className="bg-gradient-to-r from-cyan-700 to-teal-600 rounded-3xl p-7 text-white shadow-2xl border border-white/5 relative flex flex-col justify-between overflow-hidden">
                    <div className="absolute top-[-20%] right-[-10%] w-40 h-40 bg-white/15 rounded-full blur-3xl pointer-events-none"></div>

                    <div>
                        <div className="uppercase text-xs font-extrabold tracking-widest text-cyan-200">
                            Mağaza Vizyonu
                        </div>
                        <h3 className="text-2xl xl:text-3xl font-black italic mt-4 leading-snug">
                            "Müşteri geri çevirmek yok, mağazada yok yok!"
                        </h3>
                        <p className="mt-3 text-cyan-100 text-xs font-medium">Bu vizyonla bu ay hedefi patlatıyoruz 🚀</p>
                    </div>

                    <div className="bg-black/20 backdrop-blur-md border border-white/15 p-4 rounded-2xl flex items-center justify-between mt-6">
                        <div>
                            <div className="text-[10px] font-bold uppercase tracking-widest text-cyan-200">Projeksiyon Puan</div>
                            <div className="text-3xl font-black text-white">{magazaTahminPuan.toFixed(1)}</div>
                        </div>
                        <div className="text-right">
                            <span className="text-[9px] font-bold block text-cyan-300">ANLIK DURUM</span>
                            <span className="text-lg font-black text-emerald-300">{magazaAnlikPuan.toFixed(1)} Pts</span>
                        </div>
                    </div>
                </div>

                {/* 4. KART: Motivasyon Köşesi (Yüksek Kontrast Beyaz Kart) */}
                <div className="bg-white rounded-3xl p-7 shadow-2xl text-slate-900 flex flex-col justify-between relative overflow-hidden">
                    <div>
                        <div className="font-black text-xs tracking-widest text-slate-400 uppercase">
                            MOTİVASYON KÖŞESİ
                        </div>
                        <div className="text-7xl text-amber-500 font-serif font-black leading-none -mb-6 mt-1 opacity-40">
                            “
                        </div>
                        <h3 className="text-2xl xl:text-3xl font-black text-slate-800 leading-tight relative z-10">
                            Bugün attığın adım, yarın liderliğini getirir!
                        </h3>
                        <p className="text-slate-500 mt-3 text-xs font-bold tracking-wide">
                            Odaklan • Hedefe Ulaş • Kazan!
                        </p>
                    </div>

                    <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-[11px] font-black tracking-widest text-indigo-600 uppercase">Zirveye Oyna</span>
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping"></span>
                    </div>
                </div>

            </div>

            {/* ========================================================= */}
            {/* ALT GÜVERTE: HIZLI ERİŞİM & LİDERLİK PODYUMI */}
            {/* ========================================================= */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                
                {/* SOL KISIM: Hızlı Erişim Butonları (8 Kolon) */}
                <div className="lg:col-span-8 space-y-6">
                    <div>
                        <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest mb-4 pl-1">Sistem Kısayolları</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            {izinlerAktifMi && (
                                <div onClick={() => setActiveModal('izinler')} className="bg-white/5 hover:bg-white/10 backdrop-blur-md border border-white/10 hover:border-blue-500/50 rounded-2xl p-4 shadow-xl flex items-center justify-between cursor-pointer transition-all group">
                                    <div className="flex items-center gap-3">
                                        <div className="w-11 h-11 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                        </div>
                                        <div>
                                            <h4 className="text-xs font-black text-white uppercase tracking-wider">İZİNLER</h4>
                                            <p className="text-[10px] text-slate-400 font-medium mt-0.5">Personel Çizelgesi</p>
                                        </div>
                                    </div>
                                    <svg className="w-4 h-4 text-slate-600 group-hover:text-blue-400 group-hover:translate-x-0.5 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
                                </div>
                            )}
                            {hedeflerAktifMi && (
                                <div onClick={() => setActiveModal('hedefler')} className="bg-white/5 hover:bg-white/10 backdrop-blur-md border border-white/10 hover:border-emerald-500/50 rounded-2xl p-4 shadow-xl flex items-center justify-between cursor-pointer transition-all group">
                                    <div className="flex items-center gap-3">
                                        <div className="w-11 h-11 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                        </div>
                                        <div>
                                            <h4 className="text-xs font-black text-white uppercase tracking-wider">HEDEFLER</h4>
                                            <p className="text-[10px] text-slate-400 font-medium mt-0.5">Mağaza Tablosu</p>
                                        </div>
                                    </div>
                                    <svg className="w-4 h-4 text-slate-600 group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
                                </div>
                            )}
                            <div onClick={() => setActiveModal('departman')} className="bg-white/5 hover:bg-white/10 backdrop-blur-md border border-white/10 hover:border-purple-500/50 rounded-2xl p-4 shadow-xl flex items-center justify-between cursor-pointer transition-all group">
                                <div className="flex items-center gap-3">
                                    <div className="w-11 h-11 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                                    </div>
                                    <div>
                                        <h4 className="text-xs font-black text-white uppercase tracking-wider">RAPORLAR</h4>
                                        <p className="text-[10px] text-slate-400 font-medium mt-0.5">Barem Analizi</p>
                                    </div>
                                </div>
                                <svg className="w-4 h-4 text-slate-600 group-hover:text-purple-400 group-hover:translate-x-0.5 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
                            </div>
                        </div>
                    </div>
                </div>

                {/* SAĞ KISIM: Podyum (4 Kolon) */}
                <div className="lg:col-span-4">
                    {!isBlocked && (
                        <div className="relative overflow-hidden bg-gradient-to-b from-[#1e1b4b] to-[#0f172a] p-6 rounded-3xl border border-indigo-500/20 shadow-2xl flex flex-col">
                            <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-30" style={{ backgroundImage: 'radial-gradient(circle at 50% 0%, #6d28d9 0%, transparent 70%)' }}></div>

                            <div className="relative z-10 flex items-center justify-center gap-2.5 mb-8">
                                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-yellow-400 to-amber-600 text-white flex items-center justify-center shadow-lg shadow-yellow-500/20">
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 2a1 1 0 011 1v1.323l3.954 1.582 1.599-.8a1 1 0 01.894 1.79l-1.233.616 1.738 5.42a1 1 0 01-.285 1.05A3.989 3.989 0 0115 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.715-5.349L11 6.477V16h2a1 1 0 110 2H7a1 1 0 110-2h2V6.477L6.237 7.582l1.715 5.349a1 1 0 01-.285 1.05A3.989 3.989 0 015 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.738-5.42-1.233-.617a1 1 0 01.894-1.788l1.599.799L9 4.323V3a1 1 0 011-1zm-5 8.274l-.818 2.552c.25.112.526.174.818.174.292 0 .569-.062.818-.174L5 10.274zm10 0l-.818 2.552c.25.112.526.174.818.174.292 0 .569-.062.818-.174L15 10.274z" clipRule="evenodd" /></svg>
                                </div>
                                <h3 className="text-xs font-black text-white uppercase tracking-widest text-center">Bu Ayın En İyileri</h3>
                            </div>

                            <div className="relative z-10 flex-1 flex items-end justify-center gap-2 pt-4 pb-1">
                                {tumSirketPersonelleri.length > 0 ? (
                                    <>
                                        {/* 2. SIRA (GÜMÜŞ) */}
                                        {tumSirketPersonelleri[1] && (
                                            <div className="flex flex-col items-center justify-end w-[31%] z-10">
                                                <div className="relative w-full bg-gradient-to-b from-slate-200 to-white rounded-t-2xl rounded-b-xl shadow-xl border-b-[4px] border-slate-400 p-2 pt-6 h-28 flex flex-col items-center text-center justify-between text-slate-900">
                                                    <div className="absolute -top-4 w-8 h-8 rounded-full bg-gradient-to-br from-slate-400 to-slate-600 border-2 border-white flex items-center justify-center font-black text-white shadow-md text-xs">2</div>
                                                    <p className="text-[11px] font-black leading-tight line-clamp-2 mt-1">{tumSirketPersonelleri[1].isim}</p>
                                                    <p className="text-[8px] font-extrabold text-slate-500 truncate w-full">{tumSirketPersonelleri[1].magaza}</p>
                                                    <div className="w-full bg-slate-100 py-1 rounded mt-1 border border-slate-200"><p className="text-[10px] font-black text-slate-700">{tumSirketPersonelleri[1].puanTahmin} Pts</p></div>
                                                </div>
                                            </div>
                                        )}

                                        {/* 1. SIRA (ALTIN) */}
                                        {tumSirketPersonelleri[0] && (
                                            <div className="flex flex-col items-center justify-end w-[38%] z-20">
                                                <div className="relative w-full bg-gradient-to-b from-amber-100 via-yellow-50 to-white rounded-t-2xl rounded-b-xl shadow-2xl shadow-amber-500/20 border-b-[6px] border-amber-500 p-2 pt-7 h-36 flex flex-col items-center text-center justify-between text-slate-900 transform -translate-y-2">
                                                    <div className="absolute -top-5 w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 border-2 border-white flex items-center justify-center font-black text-white shadow-lg text-sm ring-4 ring-amber-400/20">1</div>
                                                    <p className="text-[12px] font-black leading-tight line-clamp-2 mt-1">{tumSirketPersonelleri[0].isim}</p>
                                                    <p className="text-[9px] font-extrabold text-slate-500 truncate w-full">{tumSirketPersonelleri[0].magaza}</p>
                                                    <div className="w-full bg-amber-200/60 py-1.5 rounded mt-1 border border-amber-300"><p className="text-[11px] font-black text-amber-900">{tumSirketPersonelleri[0].puanTahmin} Pts</p></div>
                                                </div>
                                            </div>
                                        )}

                                        {/* 3. SIRA (BRONZ) */}
                                        {tumSirketPersonelleri[2] && (
                                            <div className="flex flex-col items-center justify-end w-[31%] z-10">
                                                <div className="relative w-full bg-gradient-to-b from-orange-100 to-white rounded-t-2xl rounded-b-xl shadow-xl border-b-[4px] border-orange-400 p-2 pt-5 h-24 flex flex-col items-center text-center justify-between text-slate-900">
                                                    <div className="absolute -top-3 w-7 h-7 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 border-2 border-white flex items-center justify-center font-black text-white shadow-md text-xs">3</div>
                                                    <p className="text-[10px] font-black leading-tight line-clamp-2 mt-1">{tumSirketPersonelleri[2].isim}</p>
                                                    <p className="text-[8px] font-extrabold text-slate-500 truncate w-full">{tumSirketPersonelleri[2].magaza}</p>
                                                    <div className="w-full bg-orange-100 py-1 rounded mt-1 border border-orange-200"><p className="text-[9px] font-black text-orange-800">{tumSirketPersonelleri[2].puanTahmin} Pts</p></div>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div className="w-full text-center py-8">
                                        <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Veri Bekleniyor</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

            </div>

            {/* ========================================================= */}
            {/* ÇEKMECELER (DRAWERS) - Değiştirilmedi, Sadece Dark Zemin Uyarlandı */}
            {/* ========================================================= */}
            <div className={`fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[9998] transition-opacity duration-300 ${activeDrawer ? 'opacity-100 visible' : 'opacity-0 invisible'}`} onClick={() => setActiveDrawer(null)}></div>

            <div className={`fixed top-0 right-0 h-full w-full max-w-md bg-[#0f172a] text-slate-100 shadow-2xl border-l border-white/10 z-[9999] transform transition-transform duration-300 ease-in-out flex flex-col ${activeDrawer ? 'translate-x-0' : 'translate-x-full'}`}>
                {activeDrawer === 'personel' && (
                    <>
                        <div className="px-6 py-5 border-b border-white/10 flex justify-between items-center bg-[#0f172a] shrink-0">
                            <h3 className="text-lg font-black text-white">Personel Sıralaması</h3>
                            <button onClick={() => setActiveDrawer(null)} className="text-slate-400 hover:text-white transition-colors"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-3">
                            {aktifPersoneller.map((p, i) => {
                                const barWidthPercent = Math.min(100, ((Number(p.puanTahmin) || 0) / maxListePuani) * 100);
                                return (
                                    <div key={i} onClick={() => { setSelectedPersonel(p); setActiveModal('personel_detay'); }} className="bg-white/5 p-4 rounded-2xl border border-white/5 hover:border-blue-500/50 transition-all cursor-pointer">
                                        <div className="flex items-center justify-between mb-2.5">
                                            <div className="flex items-center gap-3">
                                                <div className="w-7 h-7 flex items-center justify-center rounded-full text-[11px] font-black bg-blue-500/20 text-blue-400">#{i + 1}</div>
                                                <span className="text-sm font-bold text-white">{p.isim}</span>
                                            </div>
                                            <span className="text-xs font-black text-emerald-400">{p.puanTahmin} Puan</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                                                <div className="h-full bg-gradient-to-r from-blue-500 to-emerald-400 rounded-full" style={{ width: `${barWidthPercent}%` }}></div>
                                            </div>
                                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider shrink-0 text-right">TAHMİN</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}

                {activeDrawer === 'magaza' && (
                    <>
                        <div className="px-6 py-5 border-b border-white/10 flex justify-between items-center bg-[#0f172a] shrink-0">
                            <h3 className="text-lg font-black text-white">Mağaza Metrik Detayları</h3>
                            <button onClick={() => setActiveDrawer(null)} className="text-slate-400 hover:text-white transition-colors"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-4">
                            {dinamikMagazaMetrikleri.map((m, idx) => {
                                const kalanAdet = Math.max(0, m.data.hedef - m.data.satilan);
                                return (
                                    <div key={idx} className="bg-white/5 border border-white/10 rounded-2xl p-5">
                                        <div className="flex justify-between items-start mb-4">
                                            <p className="text-xs font-black text-purple-300 uppercase">{m.name}</p>
                                            <div className="text-right">
                                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">AY SONU</p>
                                                <p className="text-lg font-black text-emerald-400">{m.data.tahminPuan.toFixed(1)} <span className="text-[10px] font-bold text-emerald-500">Pts</span></p>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-3 gap-2 bg-black/30 p-3 rounded-xl border border-white/5">
                                            <div className="text-center border-r border-white/5">
                                                <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">Anlık</p>
                                                <p className="text-xs font-black text-white">{m.data.anlikPuan.toFixed(1)}</p>
                                            </div>
                                            <div className="text-center border-r border-white/5">
                                                <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">Hedef Pts</p>
                                                <p className="text-xs font-black text-white">{m.data.hedefPuan.toFixed(1)}</p>
                                            </div>
                                            <div className="text-center">
                                                <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">Kalan</p>
                                                <p className="text-xs font-black text-rose-400">{kalanAdet}</p>
                                            </div>
                                        </div>
                                        <div className="mt-3 flex justify-between text-[11px] font-bold text-slate-400 px-1">
                                            <span>Satış: <span className="text-white">{m.data.satilan}</span></span>
                                            <span>Hedef: <span className="text-white">{m.data.hedef}</span></span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}

                <div className="p-4 bg-[#0f172a] border-t border-white/10 shrink-0">
                    <button onClick={() => setActiveDrawer(null)} className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 rounded-xl transition-colors text-xs uppercase tracking-wider">Kapat</button>
                </div>
            </div>

            {/* ========================================================= */}
            {/* MODALLAR (Beyaz Pop-uplar korunarak şık kontrast sağlandı) */}
            {/* ========================================================= */}
            {activeModal && (
                <div className="fixed inset-0 z-[10000] flex items-center justify-center px-4">
                    <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-md transition-opacity" onClick={() => setActiveModal(null)}></div>
                    
                    {activeModal === 'izinler' && (
                        <div className="relative bg-white text-slate-900 rounded-3xl w-[98vw] max-w-[1500px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                                <h3 className="text-lg font-black text-slate-800">Personel İzin Takvimi</h3>
                                <button onClick={() => setActiveModal(null)} className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 hover:bg-rose-500 hover:text-white transition-colors"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
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
                                ) : (<div className="py-16 text-center text-slate-500 font-bold">İzin Kaydı Bulunamadı</div>)}
                            </div>
                        </div>
                    )}

                    {activeModal === 'hedefler' && (
                        <div className="relative bg-white text-slate-900 rounded-3xl w-[98vw] max-w-[1500px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                                <h3 className="text-lg font-black text-slate-800">{selectedBranch} Hedef Tablosu</h3>
                                <button onClick={() => setActiveModal(null)} className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 hover:bg-rose-500 hover:text-white transition-colors"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
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
                                ) : (<div className="py-16 text-center text-slate-500 font-bold">Hedef Verisi Bulunamadı</div>)}
                            </div>
                        </div>
                    )}

                    {activeModal === 'departman' && dinamikMagazaMetrikleri.length > 0 && (
                        <div className="relative bg-white text-slate-900 rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden border border-slate-200">
                            <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50">
                                <h3 className="text-lg font-black text-slate-800">{selectedBranch} Departman Hedef Raporu</h3>
                                <button onClick={() => setActiveModal(null)} className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 hover:bg-rose-500 hover:text-white transition-colors"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                            </div>
                            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto max-h-[70vh] custom-scrollbar">
                                {dinamikMagazaMetrikleri.map((metrik, idx) => (<DepartmanProgressBar key={idx} title={metrik.name} data={metrik.data} colorClass={metrik.color} tahminiPuan={metrik.data.tahminPuan.toFixed(1)} />))}
                            </div>
                        </div>
                    )}
                    
                    {activeModal === 'personel_detay' && selectedPersonel && (
                        <div className="relative bg-white text-slate-900 rounded-3xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                            <div className="flex justify-between items-center p-6 border-b border-slate-100 shrink-0 bg-slate-50">
                                <h3 className="text-2xl font-black text-slate-800 flex items-center gap-3">{selectedPersonel.isim} <span className="bg-blue-100 text-blue-600 text-xs px-3 py-1 rounded-xl">Genel Puan: {selectedPersonel.toplamPuan}</span></h3>
                                <button onClick={() => setActiveModal(null)} className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 hover:bg-rose-500 hover:text-white transition-colors"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" /></svg></button>
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
