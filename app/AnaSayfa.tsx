import React, { useEffect, useState } from 'react';

type PriceNotificationItem = {
    id: string;
    key: string;
    category: string;
    name: string;
    direction: 'up' | 'down';
    oldPrice: number;
    newPrice: number;
    diff: number;
    changedAt: number;
    expiresAt: number;
};

const PRICE_NOTIFICATION_STORAGE_KEY = 'cnetmobil_price_notifications_v2';
const PRICE_NOTIFICATION_EVENT = 'cnetmobil:price-notifications';
const TEN_MINUTES = 10 * 60 * 1000;

export default function AnaSayfa({ selectedBranch, setAppMode, config, gidisatData = [], personelData = [], hedeflerData = [], izinlerData = [] }: any) {
    // --- KONTROLLER ---
    const [activeModal, setActiveModal] = useState<'tahmin' | 'departman' | 'personel_detay' | 'hedefler' | 'izinler' | null>(null);
    const [activeDrawer, setActiveDrawer] = useState<'personel' | 'magaza' | null>(null);
    const [selectedPersonel, setSelectedPersonel] = useState<any>(null);

    // --- ANA SAYFA DUYURU / FIYAT BILDIRIM MERKEZI ---
    const [homeInfoTab, setHomeInfoTab] = useState<'duyurular' | 'bildirimler'>('bildirimler');
    const [priceNotifications, setPriceNotifications] = useState<PriceNotificationItem[]>([]);
    const [selectedPriceNotification, setSelectedPriceNotification] = useState<PriceNotificationItem | null>(null);
    const [notificationNow, setNotificationNow] = useState(Date.now());

    useEffect(() => {
        const loadStoredNotifications = () => {
            try {
                const raw = window.localStorage.getItem(PRICE_NOTIFICATION_STORAGE_KEY);
                const parsed = raw ? JSON.parse(raw) : [];
                setPriceNotifications(
                    Array.isArray(parsed)
                        ? parsed
                            .filter((item: any) => item && typeof item.id === 'string')
                            .sort((a: PriceNotificationItem, b: PriceNotificationItem) => b.changedAt - a.changedAt)
                            .slice(0, 50)
                        : []
                );
            } catch {
                setPriceNotifications([]);
            }
        };

        const handlePriceNotifications = (event: Event) => {
            const customEvent = event as CustomEvent<PriceNotificationItem[]>;
            const detail = Array.isArray(customEvent.detail) ? customEvent.detail : [];
            setPriceNotifications(
                [...detail]
                    .sort((a, b) => b.changedAt - a.changedAt)
                    .slice(0, 50)
            );
            setHomeInfoTab('bildirimler');
        };

        loadStoredNotifications();

        window.addEventListener(
            PRICE_NOTIFICATION_EVENT,
            handlePriceNotifications as EventListener
        );

        const timer = window.setInterval(() => {
            setNotificationNow(Date.now());
        }, 30_000);

        return () => {
            window.removeEventListener(
                PRICE_NOTIFICATION_EVENT,
                handlePriceNotifications as EventListener
            );
            window.clearInterval(timer);
        };
    }, []);

    const formatPriceTl = (value: number) =>
        `${Math.round(Number(value) || 0).toLocaleString('tr-TR')} TL`;

    const getPriceTimeLabel = (changedAt: number) => {
        const diffMs = Math.max(0, notificationNow - Number(changedAt || 0));
        const diffMin = Math.floor(diffMs / 60_000);

        if (diffMin < 1) return 'Az önce';
        if (diffMin < 60) return `${diffMin} dk önce`;

        const diffHour = Math.floor(diffMin / 60);
        if (diffHour < 24) return `${diffHour} sa önce`;

        return new Date(changedAt).toLocaleString('tr-TR', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const activeNewPriceCount = priceNotifications.filter(
        (item) => Number(item.expiresAt || 0) > notificationNow
    ).length;

    const announcementItems = [
        config?.Duyuru_Metni,
        config?.Kampanya_Metni
    ]
        .map((item: any) => String(item || '').trim())
        .filter(Boolean);

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

    let tumMagazalarSiralama: any[] = [];
    if (hIdx !== -1 && gIdx !== -1 && pIdx !== -1) {
        const hHeaders = gidisatData[hIdx];
        const gHeaders = gidisatData[gIdx];
        const pHeaders = gidisatData[pIdx];
        const puanRow = gidisatData[pIdx + 1];
        const maxPuanRow = gidisatData[pIdx + 2];

        for (let i = hIdx + 1; i < gIdx; i++) {
            const hRow = gidisatData[i];
            if (!Array.isArray(hRow) || !hRow[0]) continue;
            const mName = String(hRow[0]).trim();
            if (!mName || mName.toUpperCase().includes("TOPLAM") || mName.toUpperCase().includes("GENEL")) continue;

            const mUpper = mName.toUpperCase();
            let gRow: any = null;
            for (let j = gIdx + 1; j < pIdx; j++) {
                if (String(gidisatData[j]?.[0] || "").trim().toUpperCase() === mUpper ||
                    String(gidisatData[j]?.[1] || "").trim().toUpperCase() === mUpper) {
                    gRow = gidisatData[j];
                    break;
                }
            }

            let mTPuan = 0;
            let mSatis = 0, mHedef = 0;

            hHeaders.forEach((hNameRaw: any, colIdx: number) => {
                const hName = String(hNameRaw || "").trim();
                if (colIdx > 0 && hName && !hName.toUpperCase().includes('TOPLAM') && !hName.toUpperCase().includes('PUAN')) {
                    const cKey = cleanKey(hName);
                    const gCol = gHeaders.findIndex((gh: any) => cleanKey(gh) === cKey);
                    const pCol = pHeaders.findIndex((ph: any) => cleanKey(ph) === cKey);

                    const hVal = parseNum(hRow?.[colIdx]);
                    const sVal = gCol > -1 ? parseNum(gRow?.[gCol]) : 0;
                    const hpVal = pCol > -1 ? parseNum(puanRow?.[pCol]) : 0;
                    const mpVal = pCol > -1 ? parseNum(maxPuanRow?.[pCol]) : hpVal;

                    mTPuan += calcStorePts(sVal, hVal, hpVal, mpVal, true);
                    if (colIdx === 1) { mSatis = sVal; mHedef = hVal; }
                }
            });

            const proj = Math.round((mSatis / currentDay) * daysInMonth);
            const yuzde = mHedef > 0 ? Math.min(100, Math.round((proj / mHedef) * 100)) : 0;

            tumMagazalarSiralama.push({
                name: mUpper,
                puan: mTPuan.toFixed(1),
                tamamlama: yuzde
            });
        }
        tumMagazalarSiralama.sort((a, b) => parseFloat(b.puan) - parseFloat(a.puan));
    }

    const birinciMagaza = tumMagazalarSiralama[0] || { name: selectedBranch.toUpperCase(), puan: magazaTahminPuan.toFixed(1), tamamlama: anaHedef > 0 ? Math.min(100, Math.round((anaSatis/anaHedef)*100)) : 0 };

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

    const toplamPersonelSayisi = tumSirketPersonelleri.length;
    const aktifPersonelSayisi = aktifPersoneller.length;
    const ortalamaSubePerformans = aktifPersoneller.length > 0 
        ? (aktifPersoneller.reduce((acc, p) => acc + (Number(p.puanTahmin) || 0), 0) / aktifPersoneller.length).toFixed(1)
        : "0.0";

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
            
            {/* YENİ EKLENEN: EN ÜST MODERN ŞUBE BİLGİ ŞERİDİ */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-white px-6 py-4 rounded-3xl border border-slate-100 shadow-sm mb-6 gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-3.5 h-3.5 rounded-full bg-emerald-500 animate-pulse"></div>
                    <div>
                        <h1 className="font-black text-slate-800 uppercase tracking-tight text-xl">{selectedBranch} ŞUBESİ</h1>
                        <span className="text-emerald-600 font-bold text-xs bg-emerald-50 px-2 py-0.5 rounded-md inline-block mt-0.5 border border-emerald-200/60">Aktif Durumda</span>
                    </div>
                </div>
                <div className="flex items-center gap-2 text-slate-400 text-xs font-semibold bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-100 self-stretch sm:self-auto">
                    <svg className="w-4 h-4 text-slate-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                    <span>Veri Güncelleme: <strong className="text-slate-700 font-bold ml-1">{lastUpdatedDate || "Bilinmiyor"}</strong></span>
                </div>
            </div>

            {/* DUYURULAR / BILDIRIMLER - SABIT ANA SAYFA MERKEZI */}
            <section className="bg-white rounded-[2rem] border border-slate-200 shadow-sm mb-8 overflow-hidden">
                <div className="px-5 md:px-6 pt-5">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 border-b border-slate-100 pb-4">
                        <div>
                            <h2 className="text-base md:text-lg font-black text-slate-900 tracking-tight">
                                Duyurular ve Bildirimler
                            </h2>
                            <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                                Güncel duyurular ve son fiyat değişiklikleri
                            </p>
                        </div>

                        <div className="inline-flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl p-1 self-start md:self-auto">
                            <button
                                type="button"
                                onClick={() => setHomeInfoTab('duyurular')}
                                className={`px-4 py-2 rounded-lg text-[11px] font-black transition-all ${
                                    homeInfoTab === 'duyurular'
                                        ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200'
                                        : 'text-slate-500 hover:text-slate-800'
                                }`}
                            >
                                Duyurular
                            </button>

                            <button
                                type="button"
                                onClick={() => setHomeInfoTab('bildirimler')}
                                className={`relative px-4 py-2 rounded-lg text-[11px] font-black transition-all ${
                                    homeInfoTab === 'bildirimler'
                                        ? 'bg-white text-orange-600 shadow-sm ring-1 ring-orange-200'
                                        : 'text-slate-500 hover:text-slate-800'
                                }`}
                            >
                                Bildirimler
                                {activeNewPriceCount > 0 && (
                                    <span className="absolute -right-2 -top-2 min-w-[20px] h-5 px-1 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center shadow-md">
                                        {activeNewPriceCount}
                                    </span>
                                )}
                            </button>
                        </div>
                    </div>
                </div>

                <div className="px-5 md:px-6 py-4">
                    {homeInfoTab === 'duyurular' ? (
                        <div className="max-h-[250px] overflow-y-auto pr-1">
                            {announcementItems.length > 0 ? (
                                <div className="divide-y divide-slate-100">
                                    {announcementItems.map((announcement, index) => (
                                        <div key={`${announcement}-${index}`} className="py-4 first:pt-1 last:pb-1">
                                            <div className="flex items-start gap-3">
                                                <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-100">
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19a1 1 0 001.447.894l4-2A1 1 0 0017 17V6.118a1 1 0 00-.553-.894l-4-2A1 1 0 0011 4.118v1.764zM4 8v8a2 2 0 002 2h2V6H6a2 2 0 00-2 2z" />
                                                    </svg>
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="text-[11px] font-black text-slate-800">
                                                        {index === 0 ? 'Güncel Duyuru' : 'Kampanya / Bilgilendirme'}
                                                    </div>
                                                    <p className="text-[12px] leading-5 text-slate-600 mt-1">
                                                        {announcement}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="min-h-[120px] flex flex-col items-center justify-center text-center">
                                    <div className="w-10 h-10 rounded-full bg-slate-50 text-slate-400 flex items-center justify-center mb-2">
                                        <span className="text-lg">📢</span>
                                    </div>
                                    <p className="text-xs font-black text-slate-700">Aktif duyuru bulunmuyor</p>
                                    <p className="text-[10px] text-slate-400 mt-1">Yeni duyurular burada görünecek.</p>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="max-h-[310px] overflow-y-auto pr-1">
                            {priceNotifications.length > 0 ? (
                                <div className="divide-y divide-slate-100">
                                    {priceNotifications.slice(0, 12).map((item) => {
                                        const isFresh = Number(item.expiresAt || 0) > notificationNow;
                                        const isDown = item.direction === 'down';

                                        return (
                                            <button
                                                type="button"
                                                key={item.id}
                                                onClick={() => setSelectedPriceNotification(item)}
                                                className={`w-full text-left py-3.5 first:pt-1 last:pb-1 group transition-all ${
                                                    isFresh ? 'bg-rose-50/40 -mx-2 px-2 rounded-xl' : ''
                                                }`}
                                            >
                                                <div className="flex items-start gap-3">
                                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                                                        isDown
                                                            ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                                                            : 'bg-rose-50 text-rose-600 border-rose-100'
                                                    }`}>
                                                        <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M7 7h.01M3 11l8.586-8.586A2 2 0 0113 2h5a2 2 0 012 2v5a2 2 0 01-.586 1.414L10.828 19a2 2 0 01-2.828 0l-5-5a2 2 0 010-2.828z" />
                                                        </svg>
                                                    </div>

                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-start justify-between gap-3">
                                                            <div className="min-w-0">
                                                                <div className="flex flex-wrap items-center gap-2">
                                                                    <span className="text-[10px] font-black uppercase tracking-wide text-rose-600">
                                                                        Fiyat Değişti
                                                                    </span>
                                                                    {isFresh && (
                                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500 text-white text-[8px] font-black uppercase tracking-wider">
                                                                            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
                                                                            Yeni
                                                                        </span>
                                                                    )}
                                                                    <span className="text-[9px] font-bold text-slate-400">
                                                                        {item.category}
                                                                    </span>
                                                                </div>

                                                                <h3 className="text-[12px] md:text-[13px] font-black text-slate-900 mt-1 truncate">
                                                                    {item.name}
                                                                </h3>

                                                                <div className="flex flex-wrap items-center gap-2 mt-1.5">
                                                                    <span className="text-[11px] font-bold text-slate-400 line-through">
                                                                        {formatPriceTl(item.oldPrice)}
                                                                    </span>
                                                                    <span className="text-slate-300">→</span>
                                                                    <span className="text-[12px] font-black text-slate-900">
                                                                        {formatPriceTl(item.newPrice)}
                                                                    </span>
                                                                    <span className={`text-[10px] font-black ${
                                                                        isDown ? 'text-emerald-600' : 'text-rose-600'
                                                                    }`}>
                                                                        {item.diff > 0 ? '+' : ''}
                                                                        {formatPriceTl(item.diff)}
                                                                    </span>
                                                                </div>
                                                            </div>

                                                            <div className="flex items-center gap-2 shrink-0">
                                                                <span className="text-[9px] font-bold text-slate-400">
                                                                    {getPriceTimeLabel(item.changedAt)}
                                                                </span>
                                                                <svg className="w-4 h-4 text-slate-300 group-hover:text-blue-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                                                                </svg>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="min-h-[135px] flex flex-col items-center justify-center text-center">
                                    <div className="w-11 h-11 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center mb-2 border border-blue-100">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                                        </svg>
                                    </div>
                                    <p className="text-xs font-black text-slate-700">Henüz fiyat değişikliği yok</p>
                                    <p className="text-[10px] text-slate-400 mt-1">
                                        Sheets'te fiyat değiştiğinde ürün burada otomatik görünecek.
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </section>

            {/* FIYAT BILDIRIM DETAY MODALI */}
            {selectedPriceNotification && (
                <div
                    className="fixed inset-0 z-[10020] bg-slate-950/45 backdrop-blur-sm flex items-center justify-center p-4"
                    onClick={() => setSelectedPriceNotification(null)}
                >
                    <div
                        className="w-full max-w-lg bg-white rounded-[2rem] border border-slate-200 shadow-2xl overflow-hidden"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="px-6 py-5 border-b border-slate-100 flex items-start justify-between gap-4">
                            <div>
                                <div className="text-[10px] font-black uppercase tracking-[0.16em] text-rose-500">
                                    Fiyat Değişikliği Detayı
                                </div>
                                <h3 className="text-lg font-black text-slate-900 mt-1 leading-tight">
                                    {selectedPriceNotification.name}
                                </h3>
                                <div className="text-[10px] font-bold text-slate-400 mt-1">
                                    {selectedPriceNotification.category} • {getPriceTimeLabel(selectedPriceNotification.changedAt)}
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={() => setSelectedPriceNotification(null)}
                                className="w-9 h-9 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-500 flex items-center justify-center transition-colors"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <div className="p-6">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4">
                                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">Eski Fiyat</span>
                                    <div className="text-xl font-black text-slate-700 mt-1">
                                        {formatPriceTl(selectedPriceNotification.oldPrice)}
                                    </div>
                                </div>

                                <div className="rounded-2xl bg-blue-50 border border-blue-100 p-4">
                                    <span className="text-[9px] font-black uppercase tracking-wider text-blue-500">Yeni Fiyat</span>
                                    <div className="text-xl font-black text-blue-700 mt-1">
                                        {formatPriceTl(selectedPriceNotification.newPrice)}
                                    </div>
                                </div>
                            </div>

                            <div className={`mt-3 rounded-2xl p-4 border ${
                                selectedPriceNotification.direction === 'down'
                                    ? 'bg-emerald-50 border-emerald-100'
                                    : 'bg-rose-50 border-rose-100'
                            }`}>
                                <div className="flex items-center justify-between gap-4">
                                    <div>
                                        <span className="text-[9px] font-black uppercase tracking-wider text-slate-500">
                                            Toplam Değişim
                                        </span>
                                        <div className={`text-lg font-black mt-1 ${
                                            selectedPriceNotification.direction === 'down'
                                                ? 'text-emerald-700'
                                                : 'text-rose-700'
                                        }`}>
                                            {selectedPriceNotification.diff > 0 ? '+' : ''}
                                            {formatPriceTl(selectedPriceNotification.diff)}
                                        </div>
                                    </div>

                                    <div className="text-right">
                                        <span className="text-[9px] font-black uppercase tracking-wider text-slate-500">
                                            Yön
                                        </span>
                                        <div className={`text-xs font-black mt-1 ${
                                            selectedPriceNotification.direction === 'down'
                                                ? 'text-emerald-700'
                                                : 'text-rose-700'
                                        }`}>
                                            {selectedPriceNotification.direction === 'down'
                                                ? 'Fiyat Düştü'
                                                : 'Fiyat Yükseldi'}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-[10px]">
                                <span className="font-bold text-slate-400">
                                    Değişiklik zamanı
                                </span>
                                <span className="font-black text-slate-700">
                                    {new Date(selectedPriceNotification.changedAt).toLocaleString('tr-TR')}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* 1. BÖLÜM: ÜST KPI KARTLARI */}
            <div className="bg-white rounded-[2.5rem] p-6 shadow-sm border border-slate-100 mb-8 flex flex-col xl:flex-row gap-6 justify-between">
                
                {/* ORTA KISIM: 4 DETAYLI KPI KARTI */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
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
                        <div className="mt-auto">
                            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden mb-2">
                                <div className="h-full bg-blue-600 rounded-full transition-all duration-1000" style={{ width: `${tamamlananYuzde}%` }}></div>
                            </div>
                            <div className="flex justify-between items-center text-[10px] font-bold">
                                <span className="text-slate-600">%{tamamlananYuzde} Tamamlandı</span>
                                <span className="text-slate-400">Kalan <span className="text-slate-700">{kalanHedef}</span></span>
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

                {/* SAĞ KISIM: REVİZE EDİLMİŞ "AYIN EN İYİ MAĞAZASI" PODYUMU */}
                <div className="flex flex-col items-center gap-4 xl:border-l border-slate-100 xl:pl-6 shrink-0 w-full xl:w-[460px] 2xl:w-[500px]">
                    {!isBlocked && (
                        <div className="relative overflow-hidden bg-gradient-to-br from-[#2c0f59] via-[#210947] to-[#12032b] p-6 rounded-[2rem] border border-purple-500/30 w-full flex-1 flex flex-col justify-between shadow-2xl text-white min-h-[300px]">
                            
                            <div className="absolute top-6 right-16 w-2 h-2 rounded-full bg-yellow-400 opacity-80 animate-pulse"></div>
                            <div className="absolute top-12 right-32 w-2.5 h-1.5 bg-emerald-400 opacity-70 rotate-12"></div>
                            <div className="absolute top-8 right-44 w-1.5 h-1.5 rounded-full bg-pink-500 opacity-80"></div>
                            <div className="absolute top-24 right-10 w-2 h-2 rounded bg-purple-400 opacity-60 -rotate-45"></div>
                            <div className="absolute top-16 right-28 w-1.5 h-2 bg-sky-400 opacity-75 rotate-45"></div>

                            <div className="relative z-10 flex items-center gap-2 mb-4">
                                <span className="text-amber-400 text-sm">🏆</span>
                                <h3 className="text-[11px] font-black tracking-widest text-purple-100 uppercase">AYIN EN İYİ MAĞAZASI</h3>
                            </div>

                            <div className="relative z-10 flex flex-col sm:flex-row justify-between items-center gap-4 flex-1 my-1">
                                
                                <div className="flex flex-col justify-center w-full sm:w-[52%]">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-300 via-yellow-400 to-amber-600 text-slate-950 flex items-center justify-center font-black text-base shadow-lg shadow-amber-500/30 shrink-0 border border-yellow-200">
                                            1
                                        </div>
                                        <span className="text-lg sm:text-xl font-black tracking-wide text-white truncate">
                                            {birinciMagaza.name}
                                        </span>
                                    </div>

                                    <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-4 backdrop-blur-md">
                                        <div className="grid grid-cols-2 divide-x divide-white/10">
                                            <div className="pr-2">
                                                <span className="text-[9px] font-bold text-purple-300 block mb-0.5">Hedef Puan</span>
                                                <span className="text-xl font-black text-amber-400 tracking-tight">{birinciMagaza.puan}</span>
                                            </div>
                                            <div className="pl-3">
                                                <span className="text-[9px] font-bold text-purple-300 block mb-0.5">Gerçekleşme</span>
                                                <span className="text-xl font-black text-emerald-400 tracking-tight">%{birinciMagaza.tamamlama}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-gradient-to-r from-amber-500/15 to-purple-500/5 border border-amber-500/25 rounded-xl p-3 flex flex-col">
                                        <span className="text-amber-400 font-black text-xs">Tebrikler!</span>
                                        <span className="text-[11px] font-medium text-purple-200 mt-0.5">Harika bir performans gösteriyorsunuz.</span>
                                    </div>
                                </div>

                                <div className="flex flex-col items-center justify-end w-full sm:w-[48%] self-stretch pt-4 sm:pt-0 pb-1">
                                    
                                    <div className="mb-2 animate-bounce duration-1000">
                                        <span className="text-4xl drop-shadow-[0_10px_10px_rgba(234,179,8,0.4)]">🏆</span>
                                    </div>

                                    <div className="flex items-end justify-center gap-2 w-full px-1">
                                        
                                        {/* 2. SIRA */}
                                        {tumMagazalarSiralama[1] && (
                                            <div className="flex flex-col items-center flex-1 max-w-[75px]">
                                                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-slate-200 to-slate-400 text-slate-800 font-black text-[10px] flex items-center justify-center shadow z-10 -mb-2.5 border border-white">2</div>
                                                <div className="w-full bg-gradient-to-b from-slate-100 to-white rounded-t-xl p-2 pt-4 h-20 flex flex-col justify-center items-center text-center shadow-lg">
                                                    <span className="text-[10px] font-black text-slate-800 line-clamp-2 leading-tight">{tumMagazalarSiralama[1].name}</span>
                                                </div>
                                            </div>
                                        )}

                                        {/* 1. SIRA */}
                                        {tumMagazalarSiralama[0] && (
                                            <div className="flex flex-col items-center flex-1 max-w-[85px] z-10">
                                                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-yellow-300 via-amber-400 to-yellow-600 text-slate-950 font-black text-xs flex items-center justify-center shadow-md shadow-amber-500/50 z-10 -mb-3 ring-2 ring-yellow-200">1</div>
                                                <div className="w-full bg-gradient-to-b from-[#FDE047] via-[#EAB308] to-[#CA8A04] rounded-t-xl p-2 pt-5 h-28 flex flex-col justify-center items-center text-center shadow-xl relative">
                                                    <span className="text-[11px] font-black text-slate-950 line-clamp-2 leading-tight">{tumMagazalarSiralama[0].name}</span>
                                                    <span className="text-amber-950/40 text-[12px] font-bold absolute bottom-1">★</span>
                                                </div>
                                            </div>
                                        )}

                                        {/* 3. SIRA */}
                                        {tumMagazalarSiralama[2] && (
                                            <div className="flex flex-col items-center flex-1 max-w-[75px]">
                                                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-orange-300 to-amber-700 text-white font-black text-[10px] flex items-center justify-center shadow z-10 -mb-2.5 border border-orange-200">3</div>
                                                <div className="w-full bg-gradient-to-b from-orange-50 to-white rounded-t-xl p-2 pt-4 h-16 flex flex-col justify-center items-center text-center shadow-lg">
                                                    <span className="text-[10px] font-black text-slate-800 line-clamp-2 leading-tight">{tumMagazalarSiralama[2].name}</span>
                                                </div>
                                            </div>
                                        )}

                                    </div>
                                    <div className="w-full h-1.5 bg-gradient-to-r from-purple-900/40 via-purple-500/30 to-purple-900/40 rounded-full mt-1"></div>

                                </div>
                            </div>

                        </div>
                    )}
                    <button onClick={() => setAppMode('alim')} className="w-full bg-[#1D4ED8] hover:bg-blue-700 text-white px-6 py-4 rounded-2xl font-bold text-sm tracking-wide shadow-md shadow-blue-500/20 transition-all flex items-center justify-center gap-2 whitespace-nowrap mt-auto">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                        Cihaz Alımı Başlat
                    </button>
                </div>
            </div>

            {/* 2. BÖLÜM: YENİ 4'LÜ GRİD */}
            <div className={`grid grid-cols-1 md:grid-cols-2 ${!isBlocked ? 'lg:grid-cols-4' : 'lg:grid-cols-1'} gap-5 mb-8`}>
                
                {/* 1. KART (LACİVERT): Personel Metrikleri */}
                {!isBlocked && (
                    <div className="relative overflow-hidden bg-[#0A1128] rounded-[2rem] p-6 shadow-xl flex flex-col justify-between min-h-[220px] border border-blue-900/40">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <p className="text-blue-400 text-[10px] font-extrabold uppercase tracking-widest">PERSONEL METRİKLERİ</p>
                                <h2 className="text-white text-2xl font-black tracking-tight italic mt-0.5">Güncel Durumunuz</h2>
                            </div>
                            <div className="w-10 h-10 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                            </div>
                        </div>

                        <div className="grid grid-cols-3 divide-x divide-blue-900/50 my-2">
                            <div className="pr-2">
                                <span className="text-[9px] text-slate-400 block font-medium">Toplam Personel</span>
                                <span className="text-white font-black text-xl">{toplamPersonelSayisi}</span>
                            </div>
                            <div className="px-2">
                                <span className="text-[9px] text-slate-400 block font-medium">Aktif Personel</span>
                                <span className="text-white font-black text-xl">{aktifPersonelSayisi}</span>
                            </div>
                            <div className="pl-2">
                                <span className="text-[9px] text-slate-400 block font-medium">Ortalama Perf.</span>
                                <span className="text-white font-black text-lg">{ortalamaSubePerformans} <span className="text-[10px] font-normal text-blue-400">Puan</span></span>
                            </div>
                        </div>

                        <div className="mt-4 pt-4 border-t border-blue-900/40">
                            <button onClick={() => setActiveDrawer('personel')} className="w-full bg-[#1D4ED8] hover:bg-blue-600 text-white py-3 rounded-xl text-xs font-black uppercase transition-colors tracking-wider shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2">
                                <span>İNCELE</span>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
                            </button>
                        </div>
                    </div>
                )}

                {/* 2. KART (MOR): Mağaza Skor Metrikleri */}
                {!isBlocked && (
                    <div className="relative overflow-hidden bg-gradient-to-br from-[#2D124D] to-[#1C0A35] rounded-[2rem] p-6 shadow-xl flex flex-col justify-between min-h-[220px] border border-purple-800/40">
                        <div className="flex justify-between items-start mb-3">
                            <div>
                                <p className="text-purple-300 text-[10px] font-extrabold uppercase tracking-widest">MAĞAZA SKOR METRİKLERİ</p>
                                <h2 className="text-white text-2xl font-black tracking-tight italic mt-0.5">Mağaza Performansı</h2>
                            </div>
                            <div className="w-10 h-10 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-300 shrink-0">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                            </div>
                        </div>

                        <div className="grid grid-cols-3 divide-x divide-purple-800/50 my-1">
                            <div className="pr-2">
                                <span className="text-[9px] text-purple-200/60 block font-medium">Aylık Hedef</span>
                                <span className="text-white font-black text-xl">{anaHedef}</span>
                            </div>
                            <div className="px-2">
                                <span className="text-[9px] text-purple-200/60 block font-medium">Gerçekleşen</span>
                                <span className="text-white font-black text-xl">{anaSatis}</span>
                            </div>
                            <div className="pl-2">
                                <span className="text-[9px] text-purple-200/60 block font-medium">Kalan Adet</span>
                                <span className="text-white font-black text-xl">{kalanHedef}</span>
                            </div>
                        </div>

                        <div className="my-2">
                            <div className="h-2 w-full bg-purple-950 rounded-full overflow-hidden p-0.5">
                                <div className="h-full bg-gradient-to-r from-blue-500 to-purple-400 rounded-full" style={{ width: `${tamamlananYuzde}%` }}></div>
                            </div>
                            <span className="text-[9px] font-bold text-purple-300/80 float-right mt-1">%{tamamlananYuzde} Tamamlandı</span>
                        </div>

                        <div className="mt-2 pt-3 border-t border-purple-800/40 clear-both">
                            <button onClick={() => setActiveDrawer('magaza')} className="w-full bg-[#8B5CF6] hover:bg-purple-500 text-white py-3 rounded-xl text-xs font-black uppercase transition-colors tracking-wider shadow-lg shadow-purple-600/30 flex items-center justify-center gap-2">
                                <span>DETAYLAR</span>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
                            </button>
                        </div>
                    </div>
                )}

                {/* 3. KART (TURKUAZ): Mağaza Vizyonu */}
                {!isBlocked && (
                    <div className="relative overflow-hidden bg-gradient-to-br from-[#0C6967] to-[#064e4c] rounded-[2rem] p-6 shadow-xl flex flex-col justify-between min-h-[220px] text-white">
                        <div className="absolute top-4 right-20 w-2 h-2 bg-yellow-400 rotate-45"></div>
                        <div className="absolute bottom-12 left-6 w-1.5 h-1.5 rounded-full bg-amber-300"></div>
                        <div className="absolute top-1/2 right-4 w-2 h-2 rounded-full bg-emerald-300 opacity-40"></div>

                        <div className="flex justify-between items-start relative z-10">
                            <div>
                                <p className="text-emerald-200 text-[10px] font-extrabold uppercase tracking-widest">MAĞAZA VİZYONU</p>
                                <h3 className="text-lg font-black leading-snug mt-4 max-w-[210px]">"Müşteri geri çevirmek yok, mağazada yok yok!"</h3>
                            </div>
                            
                            <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-3 text-center shrink-0 ml-2">
                                <span className="text-[8px] text-emerald-100 font-bold uppercase block">AYLIK HEDEF</span>
                                <span className="text-xl font-black text-white block my-0.5">100+</span>
                                <span className="text-[8px] text-emerald-200 font-bold tracking-widest">PUAN</span>
                            </div>
                        </div>

                        <div className="relative z-10 mt-auto pt-4 border-t border-white/10">
                            <p className="text-xs text-emerald-100 font-semibold flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                                Bu vizyonla bu ay hedefi patlatıyoruz! 🚀
                            </p>
                        </div>
                    </div>
                )}

                {/* 4. KART (BEYAZ): Motivasyon Köşesi */}
                {!isBlocked && (
                    <div className="relative overflow-hidden bg-white rounded-[2rem] p-6 shadow-xl flex flex-col justify-between min-h-[220px] border border-slate-200/80">
                        <div>
                            <p className="text-slate-800 text-[10px] font-black uppercase tracking-widest">MOTİVASYON KÖŞESİ</p>
                            <span className="text-amber-500 font-serif text-4xl leading-none block mt-2 font-bold">“</span>
                            <p className="text-slate-800 font-black text-sm leading-snug -mt-2 relative z-10">
                                Bugün attığın adım, yarın liderliğini getirir!
                            </p>
                            <p className="text-[11px] font-bold text-indigo-600 mt-2">
                                Odaklan, Hedefe Ulaş, Kazan!
                            </p>
                        </div>

                        <div className="absolute right-[-10px] bottom-[-10px] w-36 h-36 pointer-events-none opacity-90 flex items-end justify-end">
                            <svg viewBox="0 0 100 100" className="w-full h-full">
                                <path d="M20 100 L60 40 L100 100 Z" fill="#1E3A8A" opacity="0.15" />
                                <path d="M40 100 L75 30 L110 100 Z" fill="#3B82F6" opacity="0.2" />
                                <path d="M0 100 L45 50 L90 100 Z" fill="#93C5FD" opacity="0.3" />
                                <circle cx="75" cy="25" r="4" fill="#F59E0B" />
                                <path d="M75 25 L75 10 L85 13 L75 16" fill="#F59E0B" stroke="#D97706" strokeWidth="0.5" />
                            </svg>
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
            {/* SAĞDAN KAYAN ÇEKMECE (DRAWER) YAPISI                       */}
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
