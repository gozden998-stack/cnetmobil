import React, { useEffect, useState } from 'react';

export default function AnaSayfa({ selectedBranch, setAppMode, config, gidisatData = [], personelData = [], hedeflerData = [], izinlerData = [] }: any) {
    const [activeModal, setActiveModal] = useState<'tahmin' | 'departman' | 'personel_detay' | 'hedefler' | 'izinler' | null>(null);
    const [selectedPersonel, setSelectedPersonel] = useState<any>(null);

    const isCmr = selectedBranch.includes('CMR');
    const branchLower = selectedBranch.toLowerCase();
    const isBlocked = branchLower.includes('vodofone') || branchLower.includes('vodafone') || branchLower.includes('zumay');
    
    const hedeflerAktifMi = !isBlocked;
    const izinlerAktifMi = !isBlocked;

    // --- VERİ AYIKLAMA ---
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
        if (!val) return 0;
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

    const currentDay = new Date().getDate(); 
    const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();

    // --- PUAN HESAPLAMALARI ---
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
        const colorPalette = ["bg-blue-500", "bg-emerald-500", "bg-purple-500", "bg-amber-500"];
        let colorIndex = 0;

        hHeaders.forEach((hNameRaw: any, colIdx: number) => {
            const hName = String(hNameRaw || "").trim();
            if (colIdx > 0 && hName && !hName.toUpperCase().includes('TOPLAM') && hName.toUpperCase() !== 'HEDEF PUANI') {
                const cKey = cleanKey(hName);
                const gCol = gHeaders.findIndex((gh: any) => cleanKey(gh) === cKey);
                const pCol = pHeaders.findIndex((ph: any) => cleanKey(ph) === cKey);
                
                const hVal = parseNum(hedefRow?.[colIdx]);
                const sVal = gCol > -1 ? parseNum(gerceklesenRow?.[gCol]) : parseNum(gerceklesenRow?.[colIdx]);
                const hpVal = pCol > -1 ? parseNum(puanRow?.[pCol]) : parseNum(puanRow?.[colIdx]);
                const mpValRaw = pCol > -1 ? parseNum(maxPuanRow?.[pCol]) : parseNum(maxPuanRow?.[colIdx]);
                const mpVal = mpValRaw > 0 ? mpValRaw : hpVal; 
                const isCurr = ['KAZANÇ', 'CİRO', 'TL', 'SERVİS', '₺'].some(k => hName.toUpperCase().includes(k));
                
                const anlikPts = hVal > 0 ? Math.min(mpVal || hpVal, (sVal / hVal) * hpVal) : 0;
                const tahminPts = hVal > 0 ? Math.min(mpVal || hpVal, (((sVal / currentDay) * daysInMonth) / hVal) * hpVal) : 0;

                magazaAnlikPuan += anlikPts;
                magazaTahminPuan += tahminPts;

                dinamikMagazaMetrikleri.push({ name: hName, color: colorPalette[colorIndex % colorPalette.length], data: { hedef: hVal, satilan: sVal, isCurrency: isCurr, hedefPuan: hpVal, maxPuan: mpVal, anlikPuan: anlikPts, tahminPuan: tahminPts } });
                if (colorIndex === 0) { anaSatis = sVal; anaHedef = hVal; anaMetrikAdi = hName; }
                colorIndex++;
            }
        });
    }

    const anaProjeksiyon = Math.round((anaSatis / currentDay) * daysInMonth);
    const anaBasariYuzdesi = anaHedef > 0 ? Math.min(100, Math.round((anaSatis / anaHedef) * 100)) : 0;

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
                    dinamikBaremler.push({ indexOffset: index - 2, orijinalIndex: index, name: baslikAdi, isCurrency: ['KAZANÇ', 'CİRO', 'TL', 'SERVİS', '₺'].some(k => baslikAdi.toUpperCase().includes(k))});
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
                let pAnlik = 0, pTahmin = 0;
                dinamikBaremler.forEach(b => {
                    pAnlik += calculatePoint(p.gerceklesen[b.name] || 0, p.hedefler[b.name] || 0, b.name, false);
                    pTahmin += calculatePoint(p.gerceklesen[b.name] || 0, p.hedefler[b.name] || 0, b.name, true);
                });
                return { ...p, toplamPuan: pAnlik.toFixed(1), puanTahmin: pTahmin.toFixed(1), basariYuzdesi: p.anaHedef > 0 ? Math.min(100, Math.round((p.anaSatilan / p.anaHedef) * 100)) : 0 };
            })
            .sort((a: any, b: any) => parseFloat(b.toplamPuan) - parseFloat(a.toplamPuan));
    }

    const todayDateStr = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' }).format(new Date());

    return (
        <div className="bg-[#F8FAFC] min-h-screen text-slate-800 font-sans px-4 md:px-8 py-6 max-w-[1600px] mx-auto animate-in fade-in duration-500">
            
            {/* 1. ÜST HEADER */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                        Hoş geldiniz, {selectedBranch} <span className="text-2xl">👋</span>
                    </h1>
                    <p className="text-slate-500 text-sm font-medium mt-1">Bugün {todayDateStr}</p>
                </div>
                
                <div className="flex items-center gap-4 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                        <input type="text" placeholder="Ara..." className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" />
                    </div>
                    <button className="relative w-10 h-10 bg-white border border-slate-200 rounded-full flex items-center justify-center text-slate-600 hover:bg-slate-50">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                        <span className="absolute top-0 right-0 w-4 h-4 bg-blue-600 text-white text-[9px] font-bold rounded-full flex items-center justify-center border-2 border-white">3</span>
                    </button>
                    <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
                        <div className="w-9 h-9 bg-slate-800 rounded-full flex items-center justify-center text-white font-bold text-sm">
                            {selectedBranch.charAt(0)}
                        </div>
                        <div className="hidden sm:block text-sm">
                            <p className="font-bold text-slate-900 leading-none">{selectedBranch}</p>
                            <p className="text-[10px] text-slate-500 font-medium">CnetMobil</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* 2. KPI KARTLARI & AKSİYON BUTONU */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
                {/* Şube Durum Kartı */}
                <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)] flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center text-slate-400">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                    </div>
                    <div>
                        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{selectedBranch} ŞUBESİ</p>
                        <div className="flex items-center gap-1.5 mt-1">
                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                            <span className="text-sm font-semibold text-emerald-600">Aktif</span>
                        </div>
                    </div>
                </div>

                {/* Satış Kartı */}
                <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)] flex items-center justify-between group cursor-pointer" onClick={() => setActiveModal('departman')}>
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-500 group-hover:bg-blue-500 group-hover:text-white transition-colors">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">BU AY TOPLAM SATIŞ</p>
                            <div className="flex items-baseline gap-1">
                                <span className="text-2xl font-black text-slate-800">{anaSatis}</span>
                                <span className="text-xs font-semibold text-slate-400">Adet</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Puan Kartı */}
                <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)] flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-purple-50 flex items-center justify-center text-purple-500">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">BU AY PUAN</p>
                            <div className="flex items-baseline gap-1">
                                <span className="text-2xl font-black text-slate-800">{magazaAnlikPuan.toFixed(1)}</span>
                                <span className="text-xs font-semibold text-slate-400">Puan</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Hedef Kartı */}
                <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)] flex items-center justify-between cursor-pointer" onClick={() => setActiveModal('tahmin')}>
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-500">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">BU AY HEDEF</p>
                            <div className="flex items-baseline gap-1">
                                <span className="text-2xl font-black text-slate-800">{anaHedef}</span>
                                <span className="text-xs font-semibold text-slate-400">Adet</span>
                            </div>
                        </div>
                    </div>
                    <div className="text-right">
                        <span className={`text-[10px] font-bold ${anaBasariYuzdesi >= 100 ? 'text-emerald-500' : 'text-emerald-600 bg-emerald-50'} px-2 py-1 rounded`}>%{anaBasariYuzdesi}</span>
                    </div>
                </div>

                {/* Aksiyon Butonu */}
                <button onClick={() => setAppMode('alim')} className="bg-blue-600 hover:bg-blue-700 text-white rounded-2xl p-5 flex flex-col items-center justify-center gap-2 shadow-lg shadow-blue-500/30 transition-all hover:-translate-y-1 group">
                    <div className="bg-white/20 p-2 rounded-full group-hover:scale-110 transition-transform">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    </div>
                    <span className="font-bold text-sm tracking-wide">Cihaz Alımı Başlat</span>
                </button>
            </div>

            {/* 3. ORTA ALAN: GRAFİK & PERSONEL */}
            {isCmr && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                    {/* Placeholder Grafik Alanı */}
                    <div className="lg:col-span-2 bg-white border border-slate-100 rounded-2xl p-6 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)] flex flex-col">
                        <div className="flex justify-between items-center mb-8">
                            <h3 className="font-bold text-slate-800 text-lg">Mağaza Genel Gidişatı</h3>
                            <div className="flex gap-2">
                                <span className="text-xs text-slate-400 font-medium bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">Son Güncelleme: {lastUpdatedDate}</span>
                            </div>
                        </div>
                        {/* CSS tabanlı basit bir trend görseli (Grafik kütüphanesi olmadığı için) */}
                        <div className="flex-1 flex flex-col justify-end relative mt-10">
                             <div className="absolute inset-0 flex items-end opacity-20">
                                <svg viewBox="0 0 100 40" className="w-full h-full preserve-3d" preserveAspectRatio="none">
                                    <path d="M0,40 L0,30 L20,25 L40,28 L60,15 L80,18 L100,5 L100,40 Z" fill="#3B82F6" />
                                </svg>
                            </div>
                            <div className="absolute inset-0 flex items-end">
                                <svg viewBox="0 0 100 40" className="w-full h-full preserve-3d overflow-visible" preserveAspectRatio="none">
                                    <path d="M0,30 L20,25 L40,28 L60,15 L80,18 L100,5" fill="none" stroke="#2563EB" strokeWidth="0.5" strokeLinecap="round" strokeLinejoin="round"/>
                                    {/* Data Points */}
                                    <circle cx="20" cy="25" r="1.5" fill="white" stroke="#2563EB" strokeWidth="0.5"/>
                                    <circle cx="40" cy="28" r="1.5" fill="white" stroke="#2563EB" strokeWidth="0.5"/>
                                    <circle cx="60" cy="15" r="1.5" fill="white" stroke="#2563EB" strokeWidth="0.5"/>
                                    <circle cx="80" cy="18" r="1.5" fill="white" stroke="#2563EB" strokeWidth="0.5"/>
                                    <circle cx="100" cy="5" r="1.5" fill="white" stroke="#2563EB" strokeWidth="0.5"/>
                                </svg>
                            </div>
                            {/* X Axis Labels */}
                            <div className="flex justify-between text-[10px] font-bold text-slate-400 mt-4 border-t border-slate-100 pt-3 relative z-10">
                                <span>1. Hafta</span>
                                <span>2. Hafta</span>
                                <span>3. Hafta</span>
                                <span>4. Hafta</span>
                                <span className="text-blue-600">Bugün</span>
                            </div>
                        </div>
                    </div>

                    {/* Personel Gidişat Tablosu */}
                    <div className="lg:col-span-1 bg-white border border-slate-100 rounded-2xl p-6 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)] flex flex-col h-[400px]">
                        <div className="flex justify-between items-center mb-6 border-b border-slate-50 pb-4">
                            <h3 className="font-bold text-slate-800 text-lg">Personel Gidişat Tablosu</h3>
                        </div>
                        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-4">
                            {aktifPersoneller.map((p, i) => (
                                <div key={i} onClick={() => { setSelectedPersonel(p); setActiveModal('personel_detay'); }} className="flex flex-col gap-2 group cursor-pointer">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${i === 0 ? 'bg-amber-400 text-white' : i === 1 ? 'bg-slate-300 text-slate-700' : i === 2 ? 'bg-orange-300 text-white' : 'bg-slate-100 text-slate-400'}`}>
                                                {i + 1}
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-slate-800 text-sm group-hover:text-blue-600 transition-colors flex items-center gap-1">
                                                    {p.isim}
                                                    <span className="text-emerald-500 text-xs">↗</span>
                                                </h4>
                                                <p className="text-[10px] text-slate-500 font-medium">{p.toplamPuan} Puan</p>
                                            </div>
                                        </div>
                                        <div>
                                            {i === 0 ? <span className="bg-amber-50 text-amber-600 border border-amber-200 px-2.5 py-1 rounded-md text-[10px] font-bold flex items-center gap-1"><span className="text-sm">🏆</span> Satış Lideri</span> :
                                             i === 1 ? <span className="bg-slate-50 text-slate-600 border border-slate-200 px-2.5 py-1 rounded-md text-[10px] font-bold flex items-center gap-1"><span className="text-sm">🥈</span> Elit Satıcı</span> :
                                             i === 2 ? <span className="bg-orange-50 text-orange-600 border border-orange-200 px-2.5 py-1 rounded-md text-[10px] font-bold flex items-center gap-1"><span className="text-sm">🥉</span> Uzman Satıcı</span> :
                                             <span className="text-slate-400 text-[10px] font-bold">%{p.basariYuzdesi}</span>}
                                        </div>
                                    </div>
                                    {/* Lineer Progress Bar */}
                                    <div className="flex items-center gap-3">
                                        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                            <div className={`h-full rounded-full ${i === 0 ? 'bg-amber-400' : i === 1 ? 'bg-blue-500' : i === 2 ? 'bg-emerald-500' : 'bg-slate-300'}`} style={{ width: `${p.basariYuzdesi}%` }}></div>
                                        </div>
                                        {i < 3 && <span className="text-[10px] font-bold text-slate-500 w-6 text-right">%{p.basariYuzdesi}</span>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* 4. ALT ALAN: KATEGORİLER & DUYURULAR */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Kategorilere Göre Performans */}
                <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)]">
                    <h3 className="font-bold text-slate-800 text-base mb-6">Kategorilere Göre Performans</h3>
                    <div className="space-y-5">
                        {dinamikMagazaMetrikleri.slice(0,4).map((metrik, idx) => {
                            const pct = metrik.data.hedef > 0 ? Math.min(100, Math.round((metrik.data.satilan / metrik.data.hedef) * 100)) : 0;
                            return (
                                <div key={idx} className="flex items-center justify-between gap-4 cursor-pointer group" onClick={() => setActiveModal('departman')}>
                                    <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-500 shrink-0 border border-slate-100">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex justify-between items-end mb-1.5">
                                            <p className="text-xs font-bold text-slate-700">{metrik.name}</p>
                                            <div className="text-[10px] text-slate-500 font-medium">
                                                <span className="font-bold text-slate-800">%{pct}</span> &nbsp;&nbsp; {metrik.data.isCurrency ? '' : `${metrik.data.satilan} / ${metrik.data.hedef}`}
                                            </div>
                                        </div>
                                        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                            <div className={`h-full ${metrik.color} rounded-full`} style={{ width: `${pct}%` }}></div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Duyurular */}
                <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)] lg:col-span-2">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-bold text-slate-800 text-base">Merkez Duyuru & Kampanyaları</h3>
                        <button className="text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors">Tümünü Gör →</button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex gap-4 p-4 rounded-xl border border-orange-100 bg-orange-50/50">
                            <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-500 shrink-0">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>
                            </div>
                            <div>
                                <h4 className="font-bold text-sm text-slate-800 mb-1">Güncel Duyuru</h4>
                                <p className="text-xs text-slate-600 leading-relaxed">{config.Duyuru_Metni || "Aktif duyuru bulunmuyor."}</p>
                            </div>
                        </div>
                        <div className="flex gap-4 p-4 rounded-xl border border-blue-100 bg-blue-50/50">
                            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-500 shrink-0">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" /></svg>
                            </div>
                            <div>
                                <h4 className="font-bold text-sm text-slate-800 mb-1">Aktif Kampanya</h4>
                                <p className="text-xs text-slate-600 leading-relaxed">{config.Kampanya_Metni || "Güncel kampanya bulunmuyor."}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* MODALLAR (Eski kodlarındaki mantıkla aynı) */}
            {/* Hızlı erişim butonları - Sağ alt */}
            <div className="fixed bottom-8 right-8 z-40 flex flex-col gap-3">
                {izinlerAktifMi && (
                    <button onClick={() => setActiveModal('izinler')} className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-slate-600 shadow-[0_4px_15px_rgba(0,0,0,0.1)] border border-slate-100 hover:scale-105 transition-transform">
                        <span className="text-xl">🏖️</span>
                    </button>
                )}
                {hedeflerAktifMi && (
                    <button onClick={() => setActiveModal('hedefler')} className="w-12 h-12 bg-slate-800 rounded-full flex items-center justify-center text-white shadow-[0_4px_15px_rgba(0,0,0,0.2)] hover:scale-105 transition-transform">
                        <span className="text-xl">🎯</span>
                    </button>
                )}
            </div>

            {/* Sadece Personel Detay Modal Örneği (Diğerleri eski yapıyla aynı şekilde buraya eklenebilir) */}
            {activeModal === 'personel_detay' && selectedPersonel && (
                 <div className="fixed inset-0 z-[9999] flex items-center justify-center px-4">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setActiveModal(null)}></div>
                    <div className="relative bg-white rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-lg">
                                    {selectedPersonel.isim.charAt(0)}
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-slate-900">{selectedPersonel.isim}</h3>
                                    <p className="text-xs text-slate-500 font-medium mt-0.5">Toplam Toplanan: <span className="font-bold text-blue-600">{selectedPersonel.toplamPuan} Puan</span></p>
                                </div>
                            </div>
                            <button onClick={() => setActiveModal(null)} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                        </div>
                        <div className="p-6 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-4 bg-[#F8FAFC]">
                            {dinamikBaremler.map((barem, i) => {
                                const hedef = selectedPersonel.hedefler[barem.name] || 0;
                                const satilan = selectedPersonel.gerceklesen[barem.name] || 0;
                                if (hedef === 0 && satilan === 0) return null;
                                const yuzde = hedef > 0 ? Math.min(100, Math.round((satilan / hedef) * 100)) : 0;
                                
                                return (
                                    <div key={i} className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm">
                                        <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-4">{barem.name}</h4>
                                        <div className="flex justify-between items-end mb-2">
                                            <p className="text-xl font-black text-slate-800">{barem.isCurrency ? `${satilan.toLocaleString('tr-TR')} ₺` : satilan} <span className="text-sm font-medium text-slate-400">/ {hedef}</span></p>
                                            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded">%{yuzde}</span>
                                        </div>
                                        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden mt-3">
                                            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${yuzde}%` }}></div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
