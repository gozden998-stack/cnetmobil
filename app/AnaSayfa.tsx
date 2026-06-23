"use client";

import React, { useEffect, useState } from 'react';
import { Users, Trophy, Target, ArrowRight, TrendingUp } from "lucide-react";

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
    
    // Donut SVG Offset hesabı (Çevre=408)
    const donutOffset = Math.round(408 - ((tamamlananYuzde / 100) * 408));

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
        <div className="min-h-screen bg-[#F8F9FB] p-4 md:p-8 font-sans text-slate-800 overflow-x-hidden space-y-8 animate-in fade-in duration-500 selection:bg-blue-600 selection:text-white">
            
            {/* ========================================================= */}
            {/* 1. KATMAN: KOKPİT KOMUTA BARI */}
            {/* ========================================================= */}
            <div className="bg-white rounded-[2.5rem] p-6 shadow-sm border border-slate-200/80 flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-4 w-full md:w-auto">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-500 flex items-center justify-center shrink-0">
                        <div className="w-3.5 h-3.5 rounded-full bg-emerald-500 animate-pulse"></div>
                    </div>
                    <div>
                        <div className="flex items-center gap-2.5">
                            <h1 className="text-xl font-black text-slate-800 uppercase tracking-tight">{selectedBranch} ŞUBESİ</h1>
                            <span className="text-[10px] font-black bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full">AKTİF</span>
                        </div>
                        <p className="text-xs text-slate-400 font-medium mt-0.5">Son Güncelleme: <span className="text-slate-600 font-bold">{lastUpdatedDate || "Sistem Saati"}</span></p>
                    </div>
                </div>

                <div className="hidden xl:flex items-center gap-3 bg-slate-50 px-5 py-3 rounded-2xl border border-slate-100">
                    <div className="w-1.5 h-8 bg-blue-600 rounded-full"></div>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">MAĞAZA GENEL PUAN</p>
                        <p className="text-xl font-black text-slate-800 leading-none mt-1">{magazaAnlikPuan.toFixed(1)} <span className="text-xs font-bold text-slate-400">/ 100</span></p>
                    </div>
                </div>

                <button 
                    onClick={() => setAppMode('alim')} 
                    className="w-full md:w-auto bg-[#1D4ED8] hover:bg-blue-700 active:scale-95 text-white px-8 py-4 rounded-2xl font-bold text-sm tracking-wide shadow-md shadow-blue-500/20 transition-all flex items-center justify-center gap-3 cursor-pointer"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                    <span>Yeni Cihaz Alımı Başlat</span>
                </button>
            </div>

            {/* ========================================================= */}
            {/* 2. KATMAN: KULLANICININ TASARLADIĞI PASTEL KART DECK */}
            {/* ========================================================= */}
            <div className="grid xl:grid-cols-4 md:grid-cols-2 gap-6">

                {/* Personel */}
                <div className="bg-[#F4F8FF] rounded-[32px] p-7 shadow-sm border flex flex-col justify-between">
                    <div>
                        <div className="flex items-center gap-2 text-blue-600 font-semibold text-sm">
                            <Users size={18} />
                            PERSONEL METRİKLERİ
                        </div>

                        <h2 className="mt-5 text-3xl font-bold text-[#1E3A8A] leading-tight">
                            Güçlü Ekip,
                            <br />
                            Büyük Başarı!
                        </h2>

                        <div className="flex justify-center py-10">
                            <div className="h-36 w-36 rounded-full bg-blue-100 flex items-center justify-center shadow-inner">
                                <Users size={60} className="text-blue-600" />
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                            <div className="bg-white rounded-2xl p-4 text-center shadow-xs">
                                <div className="text-2xl font-bold text-blue-700">{tumSirketPersonelleri.length || 24}</div>
                                <div className="text-xs text-gray-500 mt-0.5">Toplam</div>
                            </div>

                            <div className="bg-white rounded-2xl p-4 text-center shadow-xs">
                                <div className="text-2xl font-bold text-blue-700">{aktifPersoneller.length || 21}</div>
                                <div className="text-xs text-gray-500 mt-0.5">Aktif</div>
                            </div>

                            <div className="bg-white rounded-2xl p-4 text-center shadow-xs">
                                <div className="text-2xl font-bold text-blue-700">{ortalamaPerformans}</div>
                                <div className="text-xs text-gray-500 mt-0.5">Performans</div>
                            </div>
                        </div>
                    </div>

                    <button 
                        onClick={() => setActiveDrawer('personel')}
                        className="w-full mt-6 bg-white rounded-2xl py-4 flex justify-center items-center gap-2 text-blue-700 font-semibold hover:bg-blue-50 transition-colors cursor-pointer shadow-xs"
                    >
                        <span>Detayları İncele</span>
                        <ArrowRight size={18} />
                    </button>
                </div>

                {/* Mağaza Performansı */}
                <div className="bg-[#FCF5FF] rounded-[32px] p-7 shadow-sm border flex flex-col justify-between">
                    <div>
                        <div className="flex items-center gap-2 text-purple-700 font-semibold text-sm">
                            <TrendingUp size={18} />
                            MAĞAZA PERFORMANSI
                        </div>

                        <h2 className="mt-5 text-3xl font-bold text-purple-700 leading-tight">
                            Hedefe Doğru
                            <br />
                            İlerliyoruz!
                        </h2>

                        <div className="flex justify-center mt-10">
                            <div className="relative h-40 w-40">
                                <svg className="rotate-[-90deg] w-full h-full" viewBox="0 0 160 160">
                                    <circle cx="80" cy="80" r="65" stroke="#E5E7EB" strokeWidth="12" fill="none" />
                                    <circle
                                        cx="80" cy="80" r="65"
                                        stroke="#3B82F6" strokeWidth="12"
                                        fill="none" strokeLinecap="round"
                                        strokeDasharray="408"
                                        strokeDashoffset={donutOffset}
                                        className="transition-all duration-1000 ease-out"
                                    />
                                </svg>
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                    <div className="text-4xl font-bold">%{tamamlananYuzde}</div>
                                    <div className="text-gray-500 text-sm">Tamamlandı</div>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-between mt-8 px-2">
                            <div>
                                <div className="text-4xl font-bold text-blue-700">{anaHedef}</div>
                                <div className="text-sm text-gray-500 mt-0.5">Aylık Hedef</div>
                            </div>
                            <div className="text-right">
                                <div className="text-4xl font-bold text-purple-700">{anaSatis}</div>
                                <div className="text-sm text-gray-500 mt-0.5">Gerçekleşen</div>
                            </div>
                        </div>
                    </div>

                    <button 
                        onClick={() => setActiveModal('hedefler')}
                        className="w-full mt-8 bg-white rounded-2xl py-4 text-purple-700 font-semibold hover:bg-purple-50 transition-colors cursor-pointer shadow-xs text-center"
                    >
                        Performansı Gör
                    </button>
                </div>

                {/* Mağaza Vizyonu */}
                <div className="bg-[#EDFFF5] rounded-[32px] p-7 shadow-sm border flex flex-col justify-between">
                    <div>
                        <div className="flex items-center gap-2 text-green-700 font-semibold text-sm">
                            <Target size={18} />
                            MAĞAZA VİZYONU
                        </div>

                        <h2 className="mt-5 text-3xl font-bold text-green-700 leading-tight">
                            Birlikte Daha
                            <br />
                            Güçlüyüz!
                        </h2>

                        <div className="flex justify-center gap-6 mt-12">
                            <div className="text-center">
                                <div className="w-16 h-16 rounded-full border-[6px] border-green-400 bg-white flex items-center justify-center font-bold text-xs text-green-700">
                                    %{tamamlananYuzde}
                                </div>
                                <div className="mt-2 text-sm text-gray-500">Memnuniyet</div>
                            </div>

                            <div className="text-center">
                                <div className="w-16 h-16 rounded-full border-[6px] border-green-500 bg-white flex items-center justify-center font-black text-sm text-green-900 shadow-sm">
                                    {magazaAnlikPuan.toFixed(0)}
                                </div>
                                <div className="mt-2 text-sm text-gray-500 font-bold text-green-800">Canlı Puan</div>
                            </div>

                            <div className="text-center">
                                <div className="w-16 h-16 rounded-full border-[6px] border-green-400 bg-white flex items-center justify-center font-bold text-xs text-green-700">
                                    {aktifPersoneller.length}
                                </div>
                                <div className="mt-2 text-sm text-gray-500">Ekip</div>
                            </div>
                        </div>

                        <div className="mt-10 text-center text-lg font-semibold text-green-700 px-2">
                            "Müşteri geri çevirmek yok, mağazada yok yok!"
                        </div>
                    </div>

                    <button 
                        onClick={() => setActiveModal('departman')}
                        className="w-full mt-8 bg-white rounded-2xl py-4 text-green-700 font-semibold hover:bg-green-50 transition-colors cursor-pointer shadow-xs text-center"
                    >
                        Vizyonu Gör
                    </button>
                </div>

                {/* Motivasyon */}
                <div className="bg-[#FFF8E7] rounded-[32px] p-7 shadow-sm border flex flex-col justify-between">
                    <div>
                        <div className="flex items-center gap-2 text-yellow-700 font-semibold text-sm">
                            <Trophy size={18} />
                            MOTİVASYON KÖŞESİ
                        </div>

                        <div className="text-7xl text-yellow-500 mt-8 font-serif leading-none -mb-4">
                            "
                        </div>

                        <h2 className="text-3xl font-bold text-slate-800 leading-tight">
                            Bugün attığın adım, yarın liderliğini getirir!
                        </h2>

                        <p className="mt-6 text-gray-500 font-medium">
                            Odaklan, Hedefe Ulaş, Kazan.
                        </p>
                    </div>

                    <button 
                        onClick={() => setActiveDrawer('personel')}
                        className="w-full mt-12 rounded-2xl bg-[#FFE7A5] py-4 text-center font-semibold text-yellow-950 hover:bg-[#ffd97d] transition-colors cursor-pointer block"
                    >
                        İlham Al & Lider Tablosu →
                    </button>
                </div>

            </div>

            {/* ========================================================= */}
            {/* 3. KATMAN: HIZLI ERİŞİM KISAYOLLARI */}
            {/* ========================================================= */}
            <div>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 pl-1">Hızlı Erişim & Raporlar</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {izinlerAktifMi && (
                        <div onClick={() => setActiveModal('izinler')} className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm flex items-center justify-between cursor-pointer hover:shadow-md hover:border-blue-300 transition-all group">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-500 flex items-center justify-center group-hover:scale-110 transition-transform"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg></div>
                                <div><h4 className="text-xs font-black text-slate-800 uppercase">İZİNLER</h4><p className="text-[10px] text-slate-500 font-medium mt-0.5">Personel izin takvimi</p></div>
                            </div>
                            <svg className="w-4 h-4 text-slate-300 group-hover:text-blue-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
                        </div>
                    )}
                    {hedeflerAktifMi && (
                        <div onClick={() => setActiveModal('hedefler')} className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm flex items-center justify-between cursor-pointer hover:shadow-md hover:border-emerald-300 transition-all group">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-500 flex items-center justify-center group-hover:scale-110 transition-transform"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg></div>
                                <div><h4 className="text-xs font-black text-slate-800 uppercase">HEDEFLER</h4><p className="text-[10px] text-slate-500 font-medium mt-0.5">Mağaza hedef tablosu</p></div>
                            </div>
                            <svg className="w-4 h-4 text-slate-300 group-hover:text-emerald-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
                        </div>
                    )}
                    <div onClick={() => setActiveModal('departman')} className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm flex items-center justify-between cursor-pointer hover:shadow-md hover:border-purple-300 transition-all group">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-500 flex items-center justify-center group-hover:scale-110 transition-transform"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg></div>
                            <div><h4 className="text-xs font-black text-slate-800 uppercase">RAPORLAR</h4><p className="text-[10px] text-slate-500 font-medium mt-0.5">Detaylı puan raporları</p></div>
                        </div>
                        <svg className="w-4 h-4 text-slate-300 group-hover:text-purple-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
                    </div>
                </div>
            </div>

            {/* ========================================================= */}
            {/* SAĞDAN KAYAN ÇEKMECE (DRAWER) YAPISI */}
            {/* ========================================================= */}
            <div 
                className={`fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[9998] transition-opacity duration-300 ${activeDrawer ? 'opacity-100 visible' : 'opacity-0 invisible'}`}
                onClick={() => setActiveDrawer(null)}
            ></div>

            <div className={`fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-[9999] transform transition-transform duration-300 ease-in-out flex flex-col ${activeDrawer ? 'translate-x-0' : 'translate-x-full'}`}>
                
                {activeDrawer === 'personel' && (
                    <>
                        <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
                            <h3 className="text-lg font-black text-slate-800">Personel Gidişat Sıralaması</h3>
                            <button onClick={() => setActiveDrawer(null)} className="text-slate-400 hover:text-slate-700 transition-colors cursor-pointer">
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

                {activeDrawer === 'magaza' && (
                    <>
                        <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
                            <h3 className="text-lg font-black text-slate-800">Mağaza Gidişat Metrikleri</h3>
                            <button onClick={() => setActiveDrawer(null)} className="text-slate-400 hover:text-slate-700 transition-colors cursor-pointer">
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

                <div className="p-4 bg-white border-t border-slate-100 shrink-0">
                    <button 
                        onClick={() => setActiveDrawer(null)} 
                        className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-3 rounded-xl transition-colors shadow-sm cursor-pointer"
                    >
                        Paneli Kapat
                    </button>
                </div>
            </div>

            {/* ========================================================= */}
            {/* ALT MODALLAR */}
            {/* ========================================================= */}
            {activeModal && (
                <div className="fixed inset-0 z-[10000] flex items-center justify-center px-4">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={() => setActiveModal(null)}></div>
                    
                    {activeModal === 'izinler' && (
                        <div className="relative bg-white rounded-3xl w-[98vw] max-w-[1600px] shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden flex flex-col max-h-[90vh]">
                            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                                <h3 className="text-xl font-black text-slate-800 flex items-center gap-3">Personel İzin Takvimi</h3>
                                <button onClick={() => setActiveModal(null)} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-200 text-slate-600 hover:bg-rose-500 hover:text-white transition-colors cursor-pointer"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg></button>
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
                                <button onClick={() => setActiveModal(null)} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-200 text-slate-600 hover:bg-rose-500 hover:text-white transition-colors cursor-pointer"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg></button>
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
                                <button onClick={() => setActiveModal(null)} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-200 text-slate-600 hover:bg-slate-300 transition-colors mt-1 cursor-pointer"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
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
                                <button onClick={() => setActiveModal(null)} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-200 text-slate-600 hover:bg-slate-300 transition-colors cursor-pointer"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" /></svg></button>
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
