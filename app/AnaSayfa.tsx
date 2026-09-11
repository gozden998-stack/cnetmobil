import React, { useEffect, useRef, useState } from 'react';


type PriceNotificationItem = {
    id: string;
    key: string;
    category: string;
    name: string;
    direction: 'up' | 'down' | 'new';
    oldPrice: number;
    newPrice: number;
    diff: number;
    changedAt: number;
    expiresAt: number;
};

type NotificationSheetRow = {
    sheet_name: string;
    row_number: number;
    data: any[];
    updated_at?: string;
};

type NotificationPricePoint = {
    price: number;
    category: string;
    name: string;
    updatedAt: number;
};

const PRICE_NOTIFICATION_STORAGE_KEY = 'cnetmobil_price_notifications_v3';
const PRICE_SNAPSHOT_STORAGE_KEY = 'cnetmobil_price_snapshot_v3';
const PRICE_SPOKEN_STORAGE_KEY = 'cnetmobil_price_spoken_ids_v1';
const PRICE_POLL_MS = 3000;
const MAX_PRICE_NOTIFICATIONS = 50;

const PRICE_TRACKED_SHEETS = [
    'CEP + TABLET+IOT SAAT LIST',
    'YNA LİST',
    '2.EL FİYAT LİSTESİ'
] as const;

function parseNotificationPrice(value: any) {
    if (value === null || value === undefined || value === '') return 0;
    if (typeof value === 'number') return Math.floor(value);

    let str = String(value).trim();
    if (str.includes(',')) str = str.split(',')[0];

    const digits = str.replace(/\D/g, '');
    return digits ? parseInt(digits, 10) : 0;
}

function parseNotificationUpdatedAt(value: unknown) {
    const ms = Date.parse(String(value || ''));
    return Number.isFinite(ms) ? ms : Date.now();
}

function buildNotificationPriceMap(rows: NotificationSheetRow[]) {
    const map = new Map<string, NotificationPricePoint>();

    rows.forEach((row) => {
        const cells = Array.isArray(row.data) ? row.data : [];
        const updatedAt = parseNotificationUpdatedAt(row.updated_at);

        if (row.sheet_name === 'CEP + TABLET+IOT SAAT LIST') {
            const appleName = String(cells[0] || '').trim();

            if (appleName) {
                const p1 = parseNotificationPrice(cells[1]);
                const p2 = parseNotificationPrice(cells[2]);

                if (p1 > 0) {
                    map.set(`APPLE_${appleName}_v1`, {
                        price: p1,
                        category: 'Apple',
                        name: appleName,
                        updatedAt
                    });
                }

                if (p2 > 0) {
                    map.set(`APPLE_${appleName}_v2`, {
                        price: p2,
                        category: 'Apple',
                        name: appleName,
                        updatedAt
                    });
                }
            }

            const androidName = String(cells[5] || '').trim();

            if (androidName) {
                const p1 = parseNotificationPrice(cells[6]);
                const p2 = parseNotificationPrice(cells[7]);

                if (p1 > 0) {
                    map.set(`ANDROID_${androidName}_v1`, {
                        price: p1,
                        category: 'Android',
                        name: androidName,
                        updatedAt
                    });
                }

                if (p2 > 0) {
                    map.set(`ANDROID_${androidName}_v2`, {
                        price: p2,
                        category: 'Android',
                        name: androidName,
                        updatedAt
                    });
                }
            }

            const campaignName = String(cells[10] || '').trim();
            const campaignPrice = parseNotificationPrice(cells[11]);

            if (campaignName && campaignPrice > 0) {
                map.set(`KAMPANYA_${campaignName}`, {
                    price: campaignPrice,
                    category: 'Kampanya',
                    name: campaignName,
                    updatedAt
                });
            }

            return;
        }

        if (row.sheet_name === 'YNA LİST') {
            const name1 = String(cells[0] || '').trim();
            const price1 = parseNotificationPrice(cells[1]);

            if (name1 && price1 > 0) {
                map.set(`YNA1_${name1}`, {
                    price: price1,
                    category: 'Aksesuar',
                    name: name1,
                    updatedAt
                });
            }

            const name2 = String(cells[3] || '').trim();
            const price2 = parseNotificationPrice(cells[4]);

            if (name2 && price2 > 0) {
                map.set(`YNA2_${name2}`, {
                    price: price2,
                    category: 'Aksesuar',
                    name: name2,
                    updatedAt
                });
            }

            return;
        }

        if (row.sheet_name === '2.EL FİYAT LİSTESİ') {
            const name = `${cells[0] || ''} ${cells[1] || ''}`.trim();
            const price = parseNotificationPrice(cells[2]);

            if (name && price > 0) {
                map.set(`IKINCI_${name}`, {
                    price,
                    category: '2. El',
                    name,
                    updatedAt
                });
            }
        }
    });

    return map;
}

function notificationPriceOnlyMap(map: Map<string, NotificationPricePoint>) {
    const result = new Map<string, number>();

    map.forEach((point, key) => {
        result.set(key, point.price);
    });

    return result;
}

function readNotificationSnapshot() {
    try {
        const raw = window.localStorage.getItem(PRICE_SNAPSHOT_STORAGE_KEY);
        if (!raw) return null;

        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return null;

        const map = new Map<string, number>();

        Object.entries(parsed).forEach(([key, value]) => {
            const price = Number(value);
            if (key && Number.isFinite(price) && price > 0) {
                map.set(key, price);
            }
        });

        return map.size > 0 ? map : null;
    } catch {
        return null;
    }
}

function writeNotificationSnapshot(map: Map<string, NotificationPricePoint>) {
    try {
        const plain = Object.fromEntries(
            Array.from(map.entries()).map(([key, point]) => [key, point.price])
        );

        window.localStorage.setItem(
            PRICE_SNAPSHOT_STORAGE_KEY,
            JSON.stringify(plain)
        );
    } catch {}
}


function readSpokenNotificationIds() {
    try {
        const raw = window.localStorage.getItem(PRICE_SPOKEN_STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return new Set<string>(Array.isArray(parsed) ? parsed : []);
    } catch {
        return new Set<string>();
    }
}

function saveSpokenNotificationIds(ids: Set<string>) {
    try {
        const compact = Array.from(ids).slice(-150);
        window.localStorage.setItem(
            PRICE_SPOKEN_STORAGE_KEY,
            JSON.stringify(compact)
        );
    } catch {}
}

function speakPriceNotificationItems(items: PriceNotificationItem[]) {
    if (
        typeof window === 'undefined' ||
        !('speechSynthesis' in window) ||
        document.visibilityState === 'hidden'
    ) {
        return;
    }

    const spokenIds = readSpokenNotificationIds();
    const seenInBatch = new Set<string>();

    const speakable = items.filter((item) => {
        if (item.direction !== 'new' && item.direction !== 'down') {
            return false;
        }

        if (spokenIds.has(item.id)) {
            return false;
        }

        // Aynı ürün aynı anda iki fiyat kolonundan değiştiyse adını iki kere okumaz.
        const batchKey = `${item.direction}:${item.category}:${item.name}`;
        if (seenInBatch.has(batchKey)) {
            spokenIds.add(item.id);
            return false;
        }

        seenInBatch.add(batchKey);
        return true;
    });

    if (speakable.length === 0) {
        saveSpokenNotificationIds(spokenIds);
        return;
    }

    const voices = window.speechSynthesis.getVoices();
    const turkishVoice =
        voices.find((voice) => voice.lang?.toLocaleLowerCase('tr-TR').startsWith('tr-tr')) ||
        voices.find((voice) => voice.lang?.toLocaleLowerCase('tr-TR').startsWith('tr'));

    speakable.forEach((item) => {
        const sentence =
            item.direction === 'new'
                ? `${item.name}. Yeni ürün eklendi.`
                : `${item.name}. Fiyatı düştü.`;

        const utterance = new SpeechSynthesisUtterance(sentence);
        utterance.lang = 'tr-TR';
        utterance.rate = 0.92;
        utterance.pitch = 1;
        utterance.volume = 1;

        if (turkishVoice) {
            utterance.voice = turkishVoice;
        }

        window.speechSynthesis.speak(utterance);
        spokenIds.add(item.id);
    });

    saveSpokenNotificationIds(spokenIds);
}

async function fetchPriceNotificationRows(): Promise<NotificationSheetRow[]> {
    const params = new URLSearchParams();

    PRICE_TRACKED_SHEETS.forEach((sheetName) => {
        params.append('sheet', sheetName);
    });

    const response = await fetch(`/api/sheet-rows?${params.toString()}`, {
        method: 'GET',
        cache: 'no-store',
        headers: { Accept: 'application/json' }
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(
            result?.error || `PostgreSQL API hatası (${response.status})`
        );
    }

    return Array.isArray(result?.rows)
        ? result.rows as NotificationSheetRow[]
        : [];
}

export default function AnaSayfa({ selectedBranch, setAppMode, config, gidisatData = [], personelData = [], hedeflerData = [], izinlerData = [] }: any) {
    // --- KONTROLLER ---
    const [activeModal, setActiveModal] = useState<'tahmin' | 'departman' | 'personel_detay' | 'hedefler' | 'izinler' | null>(null);
    const [activeDrawer, setActiveDrawer] = useState<'personel' | 'magaza' | null>(null);
    const [selectedPersonel, setSelectedPersonel] = useState<any>(null);


    // --- SABİT DUYURULAR / FİYAT BİLDİRİMLERİ ---
    const [homeInfoTab, setHomeInfoTab] = useState<'duyurular' | 'bildirimler'>('bildirimler');
    const [priceNotifications, setPriceNotifications] = useState<PriceNotificationItem[]>([]);
    const [selectedPriceNotification, setSelectedPriceNotification] = useState<PriceNotificationItem | null>(null);
    const [notificationNow, setNotificationNow] = useState(Date.now());

    const previousNotificationPricesRef = useRef<Map<string, number> | null>(null);
    const notificationEngineReadyRef = useRef(false);

    const notificationBranchLower = String(selectedBranch || '').toLocaleLowerCase('tr-TR');
    const bildirimlerAktifMi =
        !notificationBranchLower.includes('zumay') &&
        !notificationBranchLower.includes('partner');

    useEffect(() => {
        if (!bildirimlerAktifMi) return;

        let cancelled = false;
        let busy = false;

        const loadStoredNotifications = () => {
            try {
                const raw = window.localStorage.getItem(PRICE_NOTIFICATION_STORAGE_KEY);
                const parsed = raw ? JSON.parse(raw) : [];

                setPriceNotifications(
                    Array.isArray(parsed)
                        ? parsed
                            .filter(
                                (item: any) =>
                                    item &&
                                    typeof item.id === 'string' &&
                                    typeof item.changedAt === 'number'
                            )
                            .sort(
                                (a: PriceNotificationItem, b: PriceNotificationItem) =>
                                    b.changedAt - a.changedAt
                            )
                            .slice(0, MAX_PRICE_NOTIFICATIONS)
                        : []
                );
            } catch {
                setPriceNotifications([]);
            }
        };

        const saveNotifications = (items: PriceNotificationItem[]) => {
            const clean = [...items]
                .sort((a, b) => b.changedAt - a.changedAt)
                .slice(0, MAX_PRICE_NOTIFICATIONS);

            try {
                window.localStorage.setItem(
                    PRICE_NOTIFICATION_STORAGE_KEY,
                    JSON.stringify(clean)
                );
            } catch {}

            setPriceNotifications(clean);
        };

        const publishDetected = (
            detected: PriceNotificationItem[],
            speakLive = false
        ) => {
            if (detected.length === 0) return;

            let existing: PriceNotificationItem[] = [];

            try {
                const raw = window.localStorage.getItem(PRICE_NOTIFICATION_STORAGE_KEY);
                const parsed = raw ? JSON.parse(raw) : [];
                existing = Array.isArray(parsed) ? parsed : [];
            } catch {}

            const merged = [...detected, ...existing].filter(
                (item, index, array) =>
                    array.findIndex((other) => other.id === item.id) === index
            );

            saveNotifications(merged);
            setHomeInfoTab('bildirimler');

            // Sadece canlı yakalanan YENİ ÜRÜN ve FİYAT DÜŞÜŞÜ sesli okunur.
            // Sayfa açılışında geçmiş bildirimler tekrar konuşturulmaz.
            if (speakLive) {
                speakPriceNotificationItems(detected);
            }
        };

        const detectChanges = (
            previous: Map<string, number>,
            current: Map<string, NotificationPricePoint>,
            onlyRecent: boolean
        ) => {
            const now = Date.now();
            const detected: PriceNotificationItem[] = [];

            current.forEach((point, key) => {
                const oldPrice = previous.get(key);
                const changedAt = Number(point.updatedAt || now);
                const expiresAt = getDayEndExpiry(changedAt);

                if (expiresAt <= now) return;

                // Saat kısıtı kaldırıldı. Aynı gün içindeki hareketler geçerlidir.
                if (onlyRecent && expiresAt <= now) return;

                // Önceki listede olmayan kayıt = yeni ürün.
                if (oldPrice === undefined) {
                    detected.push({
                        id: `NEW_${key}-${point.price}-${changedAt}`,
                        key,
                        category: point.category,
                        name: point.name,
                        direction: 'new',
                        oldPrice: 0,
                        newPrice: point.price,
                        diff: point.price,
                        changedAt,
                        expiresAt
                    });
                    return;
                }

                if (oldPrice === point.price) return;

                const diff = point.price - oldPrice;

                detected.push({
                    id: `${key}-${oldPrice}-${point.price}-${changedAt}`,
                    key,
                    category: point.category,
                    name: point.name,
                    direction: diff > 0 ? 'up' : 'down',
                    oldPrice,
                    newPrice: point.price,
                    diff,
                    changedAt,
                    expiresAt
                });
            });

            return detected;
        };

        const checkPrices = async () => {
            if (
                cancelled ||
                busy ||
                document.visibilityState === 'hidden'
            ) {
                return;
            }

            busy = true;

            try {
                const rows = await fetchPriceNotificationRows();
                if (cancelled) return;

                const current = buildNotificationPriceMap(rows);

                if (!notificationEngineReadyRef.current) {
                    const storedSnapshot = readNotificationSnapshot();

                    if (storedSnapshot && storedSnapshot.size > 0) {
                        publishDetected(
                            detectChanges(storedSnapshot, current, true),
                            false
                        );
                    }

                    previousNotificationPricesRef.current =
                        notificationPriceOnlyMap(current);

                    writeNotificationSnapshot(current);
                    notificationEngineReadyRef.current = true;
                    return;
                }

                const previous = previousNotificationPricesRef.current;

                if (previous && previous.size > 0) {
                    publishDetected(
                        detectChanges(previous, current, false),
                        true
                    );
                }

                previousNotificationPricesRef.current =
                    notificationPriceOnlyMap(current);

                writeNotificationSnapshot(current);
            } catch (error) {
                console.error('Ana sayfa fiyat bildirim kontrol hatası:', error);
            } finally {
                busy = false;
            }
        };

        loadStoredNotifications();
        void checkPrices();

        const priceTimer = window.setInterval(checkPrices, PRICE_POLL_MS);
        const clockTimer = window.setInterval(() => {
            setNotificationNow(Date.now());
        }, 30_000);

        return () => {
            cancelled = true;
            window.clearInterval(priceTimer);
            window.clearInterval(clockTimer);
        };
    }, [bildirimlerAktifMi]);

    const formatPriceTl = (value: number) =>
        `${Math.round(Number(value) || 0).toLocaleString('tr-TR')} TL`;

    const getPriceDateTimeLabel = (changedAt: number) =>
        new Date(changedAt).toLocaleString('tr-TR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

    // Fiyat bildirimleri yalnızca mağaza çalışma saatlerinde tutulur: 09:00 - 20:00.
    const getDayEndExpiry = (changedAt: number) => {
        const expiry = new Date(changedAt);
        expiry.setHours(23, 59, 59, 999);
        return expiry.getTime();
    };

    // Saat kısıtı yok. Gün içinde oluşan bildirimler gün sonuna kadar görünür.
    // En yeni fiyat / ürün hareketi her zaman en üst sıradadır.
    const visiblePriceNotifications = priceNotifications
        .filter((item) => Number(item.expiresAt || 0) > notificationNow)
        .sort((a, b) => b.changedAt - a.changedAt);

    const activeNewPriceCount = visiblePriceNotifications.filter(
        (item) => Number(item.expiresAt || 0) > notificationNow
    ).length;

    const announcementItems = [
        config?.Duyuru_Metni,
        config?.Kampanya_Metni
    ]
        .map((item: any) => String(item || '').trim())
        .filter(Boolean);

    // --- HAVA DURUMU (Open-Meteo / API key gerektirmez) ---
    const [weather, setWeather] = useState<{
        city: string;
        temperature: number | null;
        apparentTemperature: number | null;
        weatherCode: number | null;
        windSpeed: number | null;
        loading: boolean;
    }>({
        city: '',
        temperature: null,
        apparentTemperature: null,
        weatherCode: null,
        windSpeed: null,
        loading: true,
    });

    const weatherLocationForBranch = (branch: string) => {
        const b = String(branch || '').toLocaleUpperCase('tr-TR');

        if (b.includes('SARAY')) {
            return { city: 'Saray', latitude: 41.4420, longitude: 27.9210 };
        }

        if (b.includes('KAPAKLI')) {
            return { city: 'Kapaklı', latitude: 41.3291, longitude: 27.9785 };
        }

        // CMR Merkez, CMR Cadde, CNET ve Vodafone/ZUMAY kanalları
        // için Çerkezköy merkez hava durumu gösterilir.
        return { city: 'Çerkezköy', latitude: 41.2850, longitude: 27.9990 };
    };

    const weatherDescription = (code: number | null) => {
        if (code === null || code === undefined) return 'Bilinmiyor';
        if (code === 0) return 'Açık';
        if ([1, 2].includes(code)) return 'Az Bulutlu';
        if (code === 3) return 'Kapalı';
        if ([45, 48].includes(code)) return 'Sisli';
        if ([51, 53, 55, 56, 57].includes(code)) return 'Çisenti';
        if ([61, 63, 65, 66, 67].includes(code)) return 'Yağmurlu';
        if ([71, 73, 75, 77].includes(code)) return 'Karlı';
        if ([80, 81, 82].includes(code)) return 'Sağanak';
        if ([85, 86].includes(code)) return 'Kar Sağanağı';
        if ([95, 96, 99].includes(code)) return 'Gök Gürültülü';
        return 'Değişken';
    };

    const weatherIcon = (code: number | null) => {
        if (code === null || code === undefined) return '☁️';
        if (code === 0) return '☀️';
        if ([1, 2].includes(code)) return '🌤️';
        if (code === 3) return '☁️';
        if ([45, 48].includes(code)) return '🌫️';
        if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return '🌧️';
        if ([71, 73, 75, 77, 85, 86].includes(code)) return '❄️';
        if ([95, 96, 99].includes(code)) return '⛈️';
        return '🌤️';
    };

    useEffect(() => {
        let cancelled = false;

        const loadWeather = async () => {
            const location = weatherLocationForBranch(selectedBranch);
            const cacheKey = `cnet_weather_${location.city}`;

            try {
                const cachedRaw =
                    typeof window !== 'undefined'
                        ? sessionStorage.getItem(cacheKey)
                        : null;

                if (cachedRaw) {
                    const cached = JSON.parse(cachedRaw);

                    // 20 dakika boyunca tekrar API çağrısı yapma.
                    if (
                        cached?.savedAt &&
                        Date.now() - cached.savedAt < 20 * 60 * 1000
                    ) {
                        if (!cancelled) {
                            setWeather({ ...cached.data, loading: false });
                        }
                        return;
                    }
                }
            } catch (_) {}

            if (!cancelled) {
                setWeather((prev) => ({
                    ...prev,
                    city: location.city,
                    loading: true,
                }));
            }

            try {
                const weatherRes = await fetch(
                    `https://api.open-meteo.com/v1/forecast?latitude=${location.latitude}&longitude=${location.longitude}&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m&timezone=Europe%2FIstanbul`,
                    {
                        method: 'GET',
                        cache: 'no-store',
                        headers: { Accept: 'application/json' },
                    }
                );

                if (!weatherRes.ok) {
                    throw new Error(`Hava servisi hatası (${weatherRes.status})`);
                }

                const weatherJson = await weatherRes.json();
                const current = weatherJson?.current;

                if (!current) {
                    throw new Error('Hava durumu verisi boş geldi.');
                }

                const nextWeather = {
                    city: location.city,
                    temperature:
                        typeof current?.temperature_2m === 'number'
                            ? current.temperature_2m
                            : null,
                    apparentTemperature:
                        typeof current?.apparent_temperature === 'number'
                            ? current.apparent_temperature
                            : null,
                    weatherCode:
                        typeof current?.weather_code === 'number'
                            ? current.weather_code
                            : null,
                    windSpeed:
                        typeof current?.wind_speed_10m === 'number'
                            ? current.wind_speed_10m
                            : null,
                    loading: false,
                };

                if (!cancelled) {
                    setWeather(nextWeather);
                }

                try {
                    if (typeof window !== 'undefined') {
                        sessionStorage.setItem(
                            cacheKey,
                            JSON.stringify({
                                savedAt: Date.now(),
                                data: nextWeather,
                            })
                        );
                    }
                } catch (_) {}
            } catch (error) {
                console.error('Hava durumu alınamadı:', error);

                if (!cancelled) {
                    setWeather({
                        city: location.city,
                        temperature: null,
                        apparentTemperature: null,
                        weatherCode: null,
                        windSpeed: null,
                        loading: false,
                    });
                }
            }
        };

        loadWeather();

        return () => {
            cancelled = true;
        };
    }, [selectedBranch]);

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

    const bugun = new Date();
    const saat = bugun.getHours();
    const selamlama = saat < 12 ? 'Günaydın' : saat < 18 ? 'İyi Günler' : 'İyi Akşamlar';
    const tarihMetni = bugun.toLocaleDateString('tr-TR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });
    const gunMetni = bugun.toLocaleDateString('tr-TR', { weekday: 'long' });

    const chartDayCount = Math.max(1, daysInMonth || 31);
    const chartCurrentDay = Math.max(1, Math.min(currentDay || 1, chartDayCount));
    const chartMaxValue = Math.max(1, anaHedef || 0, anaProjeksiyon || 0, anaSatis || 0);
    const chartLeft = 44;
    const chartTop = 22;
    const chartWidth = 680;
    const chartHeight = 180;

    const chartX = (day: number) =>
        chartLeft + ((Math.max(1, day) - 1) / Math.max(1, chartDayCount - 1)) * chartWidth;

    const chartY = (value: number) =>
        chartTop + chartHeight - (Math.max(0, value) / chartMaxValue) * chartHeight;

    const dailyAverage = chartCurrentDay > 0 ? anaSatis / chartCurrentDay : 0;

    const actualPoints = Array.from({ length: chartCurrentDay }, (_, index) => {
        const day = index + 1;
        const value = dailyAverage * day;
        return `${chartX(day)},${chartY(value)}`;
    }).join(' ');

    const goalPoints = [
        `${chartX(1)},${chartY((anaHedef || 0) / chartDayCount)}`,
        `${chartX(chartDayCount)},${chartY(anaHedef || 0)}`
    ].join(' ');

    const projectionPoints = [
        `${chartX(chartCurrentDay)},${chartY(anaSatis || 0)}`,
        `${chartX(chartDayCount)},${chartY(anaProjeksiyon || 0)}`
    ].join(' ');

    const chartBars = Array.from({ length: chartCurrentDay }, (_, index) => {
        const day = index + 1;
        const value = dailyAverage * day;
        const prev = index === 0 ? 0 : dailyAverage * index;
        const dailyValue = Math.max(0, value - prev);
        return { day, dailyValue };
    });

    const topMagazalar = tumMagazalarSiralama.slice(0, 5);
    // En iyi personeller seçili mağazaya göre gösterilir.
    // Böylece CMR MERKEZ, CMR KAPAKLI, CMR CADDE, CMR SARAY hangi mağaza seçilirse
    // sadece o mağazanın personelleri sıralanır.
    const topPersoneller = aktifPersoneller.slice(0, 5);

    return (
        <div className="min-h-screen overflow-x-hidden bg-[#F5F8FC] font-sans text-slate-800 animate-in fade-in duration-500">

            {/* ========================================================= */}
            {/* ANA SAYFA V2 - COMMAND CENTER                              */}
            {/* Veri hesapları / modallar / mevcut çekimler korunmuştur. */}
            {/* ========================================================= */}
            <div className="mx-auto w-full max-w-[1760px] px-3 py-4 sm:px-5 lg:px-7">

                {/* ÜST KARŞILAMA */}
                <section className="mb-4 overflow-hidden rounded-[24px] border border-slate-200/80 bg-white shadow-[0_10px_32px_rgba(15,23,42,0.055)]">
                    <div className="grid grid-cols-1 xl:grid-cols-[0.70fr_1.30fr]">
                        <div className="relative overflow-hidden px-6 py-5 sm:px-7">
                            <div className="pointer-events-none absolute -bottom-16 left-24 h-40 w-40 rounded-full bg-blue-100/50 blur-3xl" />
                            <div className="pointer-events-none absolute -right-8 -top-12 h-44 w-44 rounded-full bg-violet-100/60 blur-3xl" />

                            <div className="relative z-10 flex min-h-[104px] items-center">
                                <div>
                                    <div className="mb-1 flex items-center gap-2">
                                        <span className="text-[13px] font-bold text-slate-500">{selamlama} 👋</span>
                                        <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[8px] font-black uppercase tracking-wider text-emerald-700">
                                            Aktif
                                        </span>
                                    </div>

                                    <h1 className="text-2xl font-black uppercase tracking-[-0.03em] text-[#102A56] sm:text-3xl">
                                        {selectedBranch}
                                    </h1>

                                    <p className="mt-1 text-[11px] font-semibold text-slate-400">
                                        Bugün de hedefe birlikte ilerliyoruz.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-2 border-t border-slate-100 bg-slate-50/60 p-3 sm:grid-cols-2 xl:grid-cols-4 xl:border-l xl:border-t-0">
                            <div className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white px-4 py-3">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                </div>
                                <div>
                                    <div className="text-[9px] font-black uppercase tracking-wider text-slate-400">Bugün</div>
                                    <div className="text-[12px] font-black capitalize leading-tight text-slate-800">{tarihMetni}</div>
                                    <div className="text-[9px] font-bold capitalize text-slate-400">{gunMetni}</div>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50 to-white px-4 py-3">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-xl">
                                    {weatherIcon(weather.weatherCode)}
                                </div>
                                <div className="min-w-0">
                                    <div className="truncate text-[9px] font-black uppercase tracking-wider text-slate-400">
                                        {weather.city || weatherLocationForBranch(selectedBranch).city}
                                    </div>
                                    {weather.loading ? (
                                        <div className="mt-1 text-[10px] font-black text-slate-400">Hava alınıyor...</div>
                                    ) : weather.temperature !== null ? (
                                        <>
                                            <div className="text-[18px] font-black leading-none text-slate-900">
                                                {Math.round(weather.temperature)}°C
                                            </div>
                                            <div className="mt-1 text-[9px] font-bold text-slate-500">
                                                {weatherDescription(weather.weatherCode)}
                                                {weather.apparentTemperature !== null
                                                    ? ` · Hissedilen ${Math.round(weather.apparentTemperature)}°`
                                                    : ''}
                                            </div>
                                        </>
                                    ) : (
                                        <div className="mt-1 text-[9px] font-bold text-slate-400">Hava bilgisi alınamadı</div>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white px-4 py-3">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9M4.582 9H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2M19.419 15H15" />
                                    </svg>
                                </div>
                                <div className="min-w-0">
                                    <div className="text-[9px] font-black uppercase tracking-wider text-slate-400">Son Güncelleme</div>
                                    <div className="truncate text-[11px] font-black leading-tight text-slate-800">{lastUpdatedDate || 'Bilinmiyor'}</div>
                                    <div className="mt-0.5 flex items-center gap-1.5 text-[9px] font-bold text-emerald-600">
                                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                        Veriler güncel
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50 to-white px-4 py-3">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-xl text-violet-600">“</div>
                                <div>
                                    <div className="text-[11px] font-black leading-snug text-slate-800">
                                        Küçük adımlar, büyük başarılar getirir.
                                    </div>
                                    <div className="mt-1 text-[9px] font-black text-violet-600">Cnetmobil</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>


                {/* DUYURULAR / BİLDİRİMLER - ANA SAYFADA SABİT */}
                {bildirimlerAktifMi && (
                    <section className="mb-4 overflow-hidden rounded-[22px] border border-slate-200/80 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.045)]">
                        <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <div className="flex items-center gap-2">
                                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
                                        <svg className="h-4.5 w-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                                        </svg>
                                    </div>
                                    <div>
                                        <h2 className="text-[15px] font-black tracking-tight text-[#102A56]">
                                            Duyurular & Bildirimler
                                        </h2>
                                        <p className="mt-0.5 text-[9px] font-semibold text-slate-400">
                                            Fiyat ve yeni ürün hareketleri • Gün sonuna kadar görünür
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="inline-flex w-fit items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
                                <button
                                    type="button"
                                    onClick={() => setHomeInfoTab('duyurular')}
                                    className={`rounded-lg px-4 py-2 text-[10px] font-black transition-all ${
                                        homeInfoTab === 'duyurular'
                                            ? 'bg-white text-[#102A56] shadow-sm ring-1 ring-slate-200'
                                            : 'text-slate-400 hover:text-slate-700'
                                    }`}
                                >
                                    Duyurular
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setHomeInfoTab('bildirimler')}
                                    className={`relative rounded-lg px-4 py-2 text-[10px] font-black transition-all ${
                                        homeInfoTab === 'bildirimler'
                                            ? 'bg-white text-orange-600 shadow-sm ring-1 ring-orange-200'
                                            : 'text-slate-400 hover:text-slate-700'
                                    }`}
                                >
                                    Bildirimler
                                    {activeNewPriceCount > 0 && (
                                        <span className="absolute -right-2 -top-2 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-500 px-1 text-[8px] font-black text-white shadow-md">
                                            {activeNewPriceCount}
                                        </span>
                                    )}
                                </button>
                            </div>
                        </div>

                        <div className="px-5 py-4">
                            {homeInfoTab === 'duyurular' ? (
                                <div className="max-h-[220px] overflow-y-auto pr-1">
                                    {announcementItems.length > 0 ? (
                                        <div className="divide-y divide-slate-100">
                                            {announcementItems.map((announcement, index) => (
                                                <div key={`${announcement}-${index}`} className="py-3.5 first:pt-0 last:pb-0">
                                                    <div className="flex items-start gap-3">
                                                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-amber-100 bg-amber-50 text-amber-600">
                                                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19a1 1 0 001.447.894l4-2A1 1 0 0017 17V6.118a1 1 0 00-.553-.894l-4-2A1 1 0 0011 4.118v1.764zM4 8v8a2 2 0 002 2h2V6H6a2 2 0 00-2 2z" />
                                                            </svg>
                                                        </div>
                                                        <div className="min-w-0">
                                                            <div className="text-[10px] font-black text-slate-800">
                                                                {index === 0 ? 'Güncel Duyuru' : 'Kampanya / Bilgilendirme'}
                                                            </div>
                                                            <p className="mt-1 text-[11px] leading-5 text-slate-600">
                                                                {announcement}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="flex min-h-[105px] flex-col items-center justify-center text-center">
                                            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-slate-50 text-slate-400">
                                                📢
                                            </div>
                                            <p className="text-[11px] font-black text-slate-700">Aktif duyuru bulunmuyor</p>
                                            <p className="mt-1 text-[9px] text-slate-400">Yeni duyurular burada görünecek.</p>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="max-h-[300px] overflow-y-auto pr-1">
                                    {visiblePriceNotifications.length > 0 ? (
                                        <div className="divide-y divide-slate-100">
                                            {visiblePriceNotifications.slice(0, 12).map((item) => {
                                                const isFresh = Number(item.expiresAt || 0) > notificationNow;
                                                const isDown = item.direction === 'down';

                                                return (
                                                    <button
                                                        type="button"
                                                        key={item.id}
                                                        onClick={() => setSelectedPriceNotification(item)}
                                                        className={`group w-full rounded-xl py-2.5 text-left transition-all ${
                                                            isFresh
                                                                ? 'bg-rose-50/55 px-3 ring-1 ring-rose-100'
                                                                : 'px-1 hover:bg-slate-50'
                                                        }`}
                                                    >
                                                        <div className="flex items-start gap-3">
                                                            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${
                                                                item.direction === 'new'
                                                                    ? 'border-blue-100 bg-blue-50 text-blue-600'
                                                                    : isDown
                                                                        ? 'border-emerald-100 bg-emerald-50 text-emerald-600'
                                                                        : 'border-rose-100 bg-rose-50 text-rose-600'
                                                            }`}>
                                                                <svg className="h-4.5 w-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M7 7h.01M3 11l8.586-8.586A2 2 0 0113 2h5a2 2 0 012 2v5a2 2 0 01-.586 1.414L10.828 19a2 2 0 01-2.828 0l-5-5a2 2 0 010-2.828z" />
                                                                </svg>
                                                            </div>

                                                            <div className="min-w-0 flex-1">
                                                                <div className="flex items-start justify-between gap-3">
                                                                    <div className="min-w-0">
                                                                        <div className="flex flex-wrap items-center gap-2">
                                                                            <span className={`text-[9px] font-semibold uppercase tracking-wide ${
                                                                                item.direction === 'new'
                                                                                    ? 'text-blue-600'
                                                                                    : 'text-rose-600'
                                                                            }`}>
                                                                                {item.direction === 'new' ? 'Yeni Ürün Eklendi' : 'Fiyat Değişti'}
                                                                            </span>
                                                                            {isFresh && (
                                                                                <span className="inline-flex items-center gap-1 rounded-full bg-rose-500 px-2 py-0.5 text-[7px] font-black uppercase tracking-wider text-white">
                                                                                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                                                                                    Yeni
                                                                                </span>
                                                                            )}
                                                                            <span className="text-[8px] font-medium text-slate-400">
                                                                                {item.category}
                                                                            </span>
                                                                        </div>

                                                                        <h3 className="mt-1 truncate text-[12px] font-semibold text-slate-900 sm:text-[13px]">
                                                                            {item.name}
                                                                        </h3>

                                                                        <div className="mt-1.5 flex flex-wrap items-center gap-2">
                                                                            {item.direction === 'new' ? (
                                                                                <>
                                                                                    <span className="text-[10px] font-normal text-slate-400">
                                                                                        Fiyat
                                                                                    </span>
                                                                                    <span className="text-[11px] font-medium text-slate-900">
                                                                                        {formatPriceTl(item.newPrice)}
                                                                                    </span>
                                                                                </>
                                                                            ) : (
                                                                                <>
                                                                                    <span className="text-[10px] font-normal text-slate-400 line-through">
                                                                                        {formatPriceTl(item.oldPrice)}
                                                                                    </span>
                                                                                    <span className="text-slate-300">→</span>
                                                                                    <span className="text-[11px] font-medium text-slate-900">
                                                                                        {formatPriceTl(item.newPrice)}
                                                                                    </span>
                                                                                    <span className={`text-[9px] font-medium ${
                                                                                        isDown ? 'text-emerald-600' : 'text-rose-600'
                                                                                    }`}>
                                                                                        {item.diff > 0 ? '+' : ''}{formatPriceTl(item.diff)}
                                                                                    </span>
                                                                                </>
                                                                            )}
                                                                        </div>
                                                                    </div>

                                                                    <div className="flex shrink-0 items-center gap-2">
                                                                        <span className="whitespace-nowrap text-[8px] font-medium text-slate-400">
                                                                            {getPriceDateTimeLabel(item.changedAt)}
                                                                        </span>
                                                                        <svg className="h-4 w-4 text-slate-300 transition-colors group-hover:text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                                        <div className="flex min-h-[120px] flex-col items-center justify-center text-center">
                                            <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-full border border-blue-100 bg-blue-50 text-blue-500">
                                                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                                                </svg>
                                            </div>
                                            <p className="text-[11px] font-black text-slate-700">Henüz fiyat değişikliği yok</p>
                                            <p className="mt-1 text-[9px] text-slate-400">
                                                Sheets'te fiyat değiştiğinde otomatik burada görünecek.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </section>
                )}

                {/* FİYAT BİLDİRİM DETAYI */}
                {bildirimlerAktifMi && selectedPriceNotification && (
                    <div
                        className="fixed inset-0 z-[10020] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm"
                        onClick={() => setSelectedPriceNotification(null)}
                    >
                        <div
                            className="w-full max-w-lg overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-2xl"
                            onClick={(event) => event.stopPropagation()}
                        >
                            <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
                                <div>
                                    <div className={`text-[9px] font-black uppercase tracking-[0.16em] ${
                                        selectedPriceNotification.direction === 'new'
                                            ? 'text-blue-500'
                                            : 'text-rose-500'
                                    }`}>
                                        {selectedPriceNotification.direction === 'new'
                                            ? 'Yeni Ürün Detayı'
                                            : 'Fiyat Değişikliği Detayı'}
                                    </div>
                                    <h3 className="mt-1 text-lg font-black leading-tight text-[#102A56]">
                                        {selectedPriceNotification.name}
                                    </h3>
                                    <div className="mt-1 text-[9px] font-bold text-slate-400">
                                        {selectedPriceNotification.category} · {getPriceDateTimeLabel(selectedPriceNotification.changedAt)}
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => setSelectedPriceNotification(null)}
                                    className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-50 text-slate-500 transition-colors hover:bg-slate-100"
                                >
                                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            <div className="p-6">
                                {selectedPriceNotification.direction === 'new' ? (
                                    <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
                                        <span className="text-[8px] font-black uppercase tracking-wider text-blue-500">
                                            Ürün Fiyatı
                                        </span>
                                        <div className="mt-1 text-xl font-black text-blue-700">
                                            {formatPriceTl(selectedPriceNotification.newPrice)}
                                        </div>
                                        <div className="mt-2 text-[10px] font-semibold text-blue-600">
                                            Yeni ürün listeye eklendi.
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                                                <span className="text-[8px] font-black uppercase tracking-wider text-slate-400">Eski Fiyat</span>
                                                <div className="mt-1 text-xl font-black text-slate-700">
                                                    {formatPriceTl(selectedPriceNotification.oldPrice)}
                                                </div>
                                            </div>

                                            <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
                                                <span className="text-[8px] font-black uppercase tracking-wider text-blue-500">Yeni Fiyat</span>
                                                <div className="mt-1 text-xl font-black text-blue-700">
                                                    {formatPriceTl(selectedPriceNotification.newPrice)}
                                                </div>
                                            </div>
                                        </div>

                                        <div className={`mt-3 rounded-2xl border p-4 ${
                                            selectedPriceNotification.direction === 'down'
                                                ? 'border-emerald-100 bg-emerald-50'
                                                : 'border-rose-100 bg-rose-50'
                                        }`}>
                                            <div className="flex items-center justify-between gap-4">
                                                <div>
                                                    <span className="text-[8px] font-black uppercase tracking-wider text-slate-500">Değişim</span>
                                                    <div className={`mt-1 text-lg font-black ${
                                                        selectedPriceNotification.direction === 'down'
                                                            ? 'text-emerald-700'
                                                            : 'text-rose-700'
                                                    }`}>
                                                        {selectedPriceNotification.diff > 0 ? '+' : ''}
                                                        {formatPriceTl(selectedPriceNotification.diff)}
                                                    </div>
                                                </div>

                                                <div className="text-right">
                                                    <span className="text-[8px] font-black uppercase tracking-wider text-slate-500">Durum</span>
                                                    <div className={`mt-1 text-[11px] font-black ${
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
                                    </>
                                )}

                                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4 text-[9px]">
                                    <span className="font-bold text-slate-400">Değişiklik zamanı</span>
                                    <span className="font-black text-slate-700">
                                        {new Date(selectedPriceNotification.changedAt).toLocaleString('tr-TR')}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* KPI KARTLARI - SADECE CMR */}
                {isCmr && (
                <section className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-[20px] border border-slate-200/80 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.045)]">
                        <div className="flex items-start justify-between">
                            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 19V9m5 10V5m5 14v-7m5 7V3" />
                                </svg>
                            </div>
                            <div className="rounded-full bg-blue-50 px-2.5 py-1 text-[9px] font-black text-blue-600">
                                %{tamamlananYuzde}
                            </div>
                        </div>
                        <div className="mt-3 text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">Toplam Satış</div>
                        <div className="mt-1 flex items-end gap-2">
                            <span className="text-3xl font-black tracking-tight text-[#102A56]">{anaSatis}</span>
                            <span className="pb-1 text-[12px] font-black text-slate-400">/ {anaHedef}</span>
                        </div>
                        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                            <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${tamamlananYuzde}%` }} />
                        </div>
                    </div>

                    <div className="rounded-[20px] border border-slate-200/80 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.045)]">
                        <div className="flex items-start justify-between">
                            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 20V10m0 0l-4 4m4-4 4 4M5 4h14" />
                                </svg>
                            </div>
                            <div className="text-[9px] font-black text-emerald-600">AY SONU</div>
                        </div>
                        <div className="mt-3 text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">Tahmini Ay Sonu</div>
                        <div className="mt-1 text-3xl font-black tracking-tight text-[#102A56]">{anaProjeksiyon}</div>
                        <div className="mt-3 text-[10px] font-bold text-slate-400">
                            Güncel tempoya göre projeksiyon
                        </div>
                    </div>

                    <div className="rounded-[20px] border border-slate-200/80 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.045)]">
                        <div className="flex items-start justify-between">
                            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118L2.98 10.1c-.783-.57-.38-1.81.588-1.81h4.915a1 1 0 00.95-.69l1.616-4.674z" />
                                </svg>
                            </div>
                            <div className="rounded-full bg-violet-50 px-2.5 py-1 text-[9px] font-black text-violet-600">PUAN</div>
                        </div>
                        <div className="mt-3 text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">Toplam Puan</div>
                        <div className="mt-1 text-3xl font-black tracking-tight text-[#102A56]">{magazaAnlikPuan.toFixed(1)}</div>
                        <div className="mt-3 text-[10px] font-bold text-slate-400">
                            Tahmini: <span className="font-black text-violet-600">{magazaTahminPuan.toFixed(1)}</span>
                        </div>
                    </div>

                    <div className="rounded-[20px] border border-slate-200/80 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.045)]">
                        <div className="flex items-start justify-between">
                            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-50 text-orange-500">
                                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3a8 8 0 108 8h-8V3zM15 3.5A8 8 0 0120.5 9H15V3.5z" />
                                </svg>
                            </div>
                            <div className="rounded-full bg-orange-50 px-2.5 py-1 text-[9px] font-black text-orange-600">KALAN</div>
                        </div>
                        <div className="mt-3 text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">Kalan Hedef</div>
                        <div className="mt-1 text-3xl font-black tracking-tight text-[#102A56]">{kalanHedef}</div>
                        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                            <div className="h-full rounded-full bg-orange-500" style={{ width: `${Math.max(0, 100 - tamamlananYuzde)}%` }} />
                        </div>
                    </div>
                </section>
                )}

                {/* PERFORMANS + SIRALAMALAR - SADECE CMR */}
                {isCmr && (
                <section className="mb-4 grid grid-cols-1 gap-4 2xl:grid-cols-[minmax(0,1.65fr)_minmax(300px,0.7fr)_minmax(300px,0.7fr)]">

                    {/* AYLIK PERFORMANS */}
                    <div className="overflow-hidden rounded-[22px] border border-slate-200/80 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.045)]">
                        <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <h2 className="text-lg font-black tracking-tight text-[#102A56]">Aylık Performans</h2>
                                <p className="mt-0.5 text-[10px] font-semibold text-slate-400">
                                    Günlük gerçekleşen satış ve hedef projeksiyonu
                                </p>
                            </div>

                            <div className="flex items-center gap-2 rounded-xl bg-slate-50 p-1">
                                <span className="rounded-lg bg-blue-600 px-4 py-1.5 text-[9px] font-black text-white">Adet</span>
                                <span className="px-4 py-1.5 text-[9px] font-black text-slate-400">Ciro</span>
                                <span className="px-4 py-1.5 text-[9px] font-black text-slate-400">Puan</span>
                            </div>
                        </div>

                        <div className="p-4 sm:p-5">
                            <div className="mb-3 flex flex-wrap items-center gap-4 text-[9px] font-bold text-slate-400">
                                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-blue-500" /> Günlük Satış</span>
                                <span className="flex items-center gap-1.5"><span className="h-[2px] w-5 border-t-2 border-dashed border-slate-400" /> Hedef</span>
                                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Kümülatif</span>
                            </div>

                            <div className="overflow-x-auto">
                                <svg viewBox="0 0 760 240" className="h-[245px] min-w-[720px] w-full">
                                    {[0, 1, 2, 3, 4].map((i) => {
                                        const y = chartTop + (chartHeight / 4) * i;
                                        return (
                                            <line
                                                key={`grid-${i}`}
                                                x1={chartLeft}
                                                x2={chartLeft + chartWidth}
                                                y1={y}
                                                y2={y}
                                                stroke="#E8EEF6"
                                                strokeWidth="1"
                                            />
                                        );
                                    })}

                                    {chartBars.map((bar) => {
                                        const x = chartX(bar.day);
                                        const maxDaily = Math.max(1, chartMaxValue / chartDayCount);
                                        const barH = Math.min(38, Math.max(5, (bar.dailyValue / maxDaily) * 28));
                                        return (
                                            <rect
                                                key={`bar-${bar.day}`}
                                                x={x - 5}
                                                y={chartTop + chartHeight - barH}
                                                width="9"
                                                height={barH}
                                                rx="3"
                                                fill="#60A5FA"
                                                opacity="0.85"
                                            />
                                        );
                                    })}

                                    <polyline points={goalPoints} fill="none" stroke="#94A3B8" strokeWidth="2" strokeDasharray="6 6" />
                                    <polyline points={actualPoints} fill="none" stroke="#10B981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                                    {chartCurrentDay < chartDayCount && (
                                        <polyline points={projectionPoints} fill="none" stroke="#2563EB" strokeWidth="2.5" strokeDasharray="5 5" strokeLinecap="round" />
                                    )}

                                    {Array.from({ length: chartDayCount }, (_, index) => index + 1)
                                        .filter((d) => d === 1 || d === chartDayCount || d % 3 === 0)
                                        .map((day) => (
                                            <text
                                                key={`day-${day}`}
                                                x={chartX(day)}
                                                y="226"
                                                textAnchor="middle"
                                                fontSize="8"
                                                fontWeight="700"
                                                fill="#94A3B8"
                                            >
                                                {day}
                                            </text>
                                        ))}

                                    <circle cx={chartX(chartCurrentDay)} cy={chartY(anaSatis || 0)} r="5" fill="#2563EB" stroke="white" strokeWidth="3" />
                                </svg>
                            </div>

                            <div className="mt-1 grid grid-cols-3 gap-2 rounded-2xl bg-slate-50 p-3">
                                <div>
                                    <div className="text-[8px] font-black uppercase tracking-wider text-slate-400">Hedef</div>
                                    <div className="mt-1 text-lg font-black text-slate-800">{anaHedef}</div>
                                </div>
                                <div>
                                    <div className="text-[8px] font-black uppercase tracking-wider text-slate-400">Mevcut</div>
                                    <div className="mt-1 text-lg font-black text-blue-600">{anaSatis}</div>
                                </div>
                                <div>
                                    <div className="text-[8px] font-black uppercase tracking-wider text-slate-400">Tahmin</div>
                                    <div className="mt-1 text-lg font-black text-emerald-600">{anaProjeksiyon}</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* MAĞAZA SIRALAMASI */}
                    <div className="rounded-[22px] border border-slate-200/80 bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.045)]">
                        <div className="mb-3 flex items-center justify-between">
                            <div>
                                <h3 className="text-[15px] font-black text-[#102A56]">Mağaza Sıralaması</h3>
                                <p className="mt-0.5 text-[8px] font-bold uppercase tracking-wider text-slate-400">Adet Tamamlama</p>
                            </div>
                            <button type="button" onClick={() => setActiveDrawer('magaza')} className="text-[9px] font-black text-blue-600 hover:text-blue-700">
                                Tümünü Gör →
                            </button>
                        </div>

                        <div className="divide-y divide-slate-100">
                            {topMagazalar.length > 0 ? topMagazalar.map((magaza: any, index: number) => (
                                <div key={`${magaza.name}-${index}`} className="py-3">
                                    <div className="flex items-center gap-2">
                                        <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-black ${
                                            index === 0 ? 'bg-amber-400 text-amber-950' :
                                            index === 1 ? 'bg-slate-200 text-slate-700' :
                                            index === 2 ? 'bg-orange-200 text-orange-800' :
                                            'bg-slate-100 text-slate-500'
                                        }`}>
                                            {index + 1}
                                        </div>

                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="truncate text-[10px] font-black uppercase text-slate-800">{magaza.name}</span>
                                                <span className="text-[9px] font-black text-slate-500">%{magaza.tamamlama}</span>
                                            </div>
                                            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                                                <div
                                                    className={`h-full rounded-full ${index === 0 ? 'bg-amber-400' : 'bg-blue-500'}`}
                                                    style={{ width: `${Math.min(100, Number(magaza.tamamlama) || 0)}%` }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )) : (
                                <div className="py-10 text-center text-[10px] font-bold text-slate-400">Sıralama verisi bulunamadı.</div>
                            )}
                        </div>
                    </div>

                    {/* PERSONEL SIRALAMASI */}
                    <div className="rounded-[22px] border border-slate-200/80 bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.045)]">
                        <div className="mb-3 flex items-center justify-between">
                            <div>
                                <h3 className="text-[15px] font-black text-[#102A56]">En İyi Personeller</h3>
                                <p className="mt-0.5 text-[8px] font-bold uppercase tracking-wider text-slate-400">Tahmini Puan</p>
                            </div>
                            <button type="button" onClick={() => setActiveDrawer('personel')} className="text-[9px] font-black text-blue-600 hover:text-blue-700">
                                Tümünü Gör →
                            </button>
                        </div>

                        <div className="divide-y divide-slate-100">
                            {topPersoneller.length > 0 ? topPersoneller.map((personel: any, index: number) => (
                                <button
                                    type="button"
                                    key={`${personel.isim}-${index}`}
                                    onClick={() => {
                                        setSelectedPersonel(personel);
                                        setActiveModal('personel_detay');
                                    }}
                                    className="flex w-full items-center gap-2 py-3 text-left transition hover:bg-slate-50"
                                >
                                    <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-black ${
                                        index === 0 ? 'bg-amber-400 text-amber-950' : 'bg-slate-100 text-slate-500'
                                    }`}>
                                        {index + 1}
                                    </div>
                                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-100 to-violet-100 text-[10px] font-black text-blue-700">
                                        {String(personel.isim || '?').trim().charAt(0).toUpperCase()}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="truncate text-[10px] font-black text-slate-800">{personel.isim}</div>
                                        <div className="truncate text-[8px] font-bold uppercase text-slate-400">{personel.magaza}</div>
                                    </div>
                                    <div className="text-[10px] font-black text-[#102A56]">{personel.puanTahmin} Puan</div>
                                </button>
                            )) : (
                                <div className="py-10 text-center text-[10px] font-bold text-slate-400">Personel verisi bulunamadı.</div>
                            )}
                        </div>
                    </div>
                </section>
                )}

                {/* OPERASYON ÖZETİ */}
                {isCmr && (
                    <section className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                        <button
                            type="button"
                            onClick={() => setActiveDrawer('personel')}
                            className="group flex min-h-[128px] items-center gap-4 rounded-[20px] border border-slate-200/80 bg-white p-4 text-left shadow-[0_8px_24px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
                        >
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5-2.83M17 20H7m10 0v-2a5 5 0 00-10 0v2m10 0H7m0 0H2v-2a3 3 0 015-2.83M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="text-[13px] font-black text-slate-800">Personel Durumu</div>
                                <div className="mt-0.5 text-[9px] font-bold text-slate-400">Aktif mağaza personelleri</div>
                                <div className="mt-2 flex items-end gap-2">
                                    <span className="text-2xl font-black text-[#102A56]">{aktifPersonelSayisi}</span>
                                    <span className="pb-1 text-[9px] font-black text-blue-600">/ {toplamPersonelSayisi} toplam</span>
                                </div>
                            </div>
                            <span className="text-blue-500 transition group-hover:translate-x-1">→</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setActiveModal('hedefler')}
                            className="group flex min-h-[128px] items-center gap-4 rounded-[20px] border border-slate-200/80 bg-white p-4 text-left shadow-[0_8px_24px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md"
                        >
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2l3 6 7 .9-5 4.8 1.2 6.8L12 17.3 5.8 20.5 7 13.7 2 8.9 9 8l3-6z" />
                                </svg>
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="text-[13px] font-black text-slate-800">Mağaza Hedefleri</div>
                                <div className="mt-0.5 text-[9px] font-bold text-slate-400">Aylık gerçekleşme</div>
                                <div className="mt-2 text-2xl font-black text-[#102A56]">%{tamamlananYuzde}</div>
                            </div>
                            <span className="text-emerald-500 transition group-hover:translate-x-1">→</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setActiveModal('izinler')}
                            className="group flex min-h-[128px] items-center gap-4 rounded-[20px] border border-slate-200/80 bg-white p-4 text-left shadow-[0_8px_24px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-md"
                        >
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="text-[13px] font-black text-slate-800">İzinler</div>
                                <div className="mt-0.5 text-[9px] font-bold text-slate-400">Personel izin takvimi</div>
                                <div className="mt-2 text-[10px] font-black text-violet-600">Takvimi Gör</div>
                            </div>
                            <span className="text-violet-500 transition group-hover:translate-x-1">→</span>
                        </button>

                        <div className="relative min-h-[128px] overflow-hidden rounded-[20px] border border-violet-500/30 bg-gradient-to-br from-[#23104F] via-[#3B168A] to-[#5928D7] p-5 text-white shadow-[0_14px_32px_rgba(76,29,149,0.22)]">
                            <div className="pointer-events-none absolute -right-10 -top-12 h-32 w-32 rounded-full bg-white/10" />
                            <div className="relative z-10 flex h-full items-center gap-4">
                                <div className="text-4xl">🏆</div>
                                <div className="min-w-0">
                                    <div className="text-[10px] font-black uppercase tracking-wider text-violet-200">Bu Ayın En İyi Mağazası</div>
                                    <div className="mt-1 truncate text-xl font-black">{birinciMagaza.name}</div>
                                    <div className="mt-1 text-[10px] font-bold text-violet-200">
                                        {birinciMagaza.puan} Puan · %{birinciMagaza.tamamlama}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>
                )}

                {/* HIZLI ERİŞİM - SADECE CMR */}
                {isCmr && (
                <section className="mb-6 rounded-[22px] border border-slate-200/80 bg-white p-4 shadow-[0_8px_26px_rgba(15,23,42,0.04)]">
                    <div className="mb-3">
                        <h3 className="text-[14px] font-black text-[#102A56]">Hızlı Erişim</h3>
                        <p className="text-[9px] font-bold text-slate-400">Sık kullandığınız işlemlere hızlıca ulaşın</p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-9">
                        {[
                            { label: 'Cihaz Alım', mode: 'alim', tone: 'emerald', icon: '▣' },
                            { label: 'Teknik Servis', mode: 'servis', tone: 'blue', icon: '⌁' },
                            { label: 'Cihaz Talep', mode: 'cihaz_talep', tone: 'violet', icon: '◇' },
                            { label: '2. El Liste', mode: 'ikinci_el_apple', tone: 'orange', icon: '▯' },
                            { label: 'YNA Liste', mode: 'yna_list', tone: 'pink', icon: '▤' },
                            { label: 'Dış Kanal', mode: 'dis_kanal', tone: 'cyan', icon: '↗' },
                        ].map((item: any) => {
                            const toneClasses: Record<string, string> = {
                                emerald: 'border-emerald-100 bg-emerald-50 text-emerald-700 hover:border-emerald-300',
                                blue: 'border-blue-100 bg-blue-50 text-blue-700 hover:border-blue-300',
                                violet: 'border-violet-100 bg-violet-50 text-violet-700 hover:border-violet-300',
                                orange: 'border-orange-100 bg-orange-50 text-orange-700 hover:border-orange-300',
                                pink: 'border-pink-100 bg-pink-50 text-pink-700 hover:border-pink-300',
                                cyan: 'border-cyan-100 bg-cyan-50 text-cyan-700 hover:border-cyan-300',
                            };

                            return (
                                <button
                                    type="button"
                                    key={item.label}
                                    onClick={() => setAppMode(item.mode)}
                                    className={`flex min-h-[52px] items-center justify-center gap-2 rounded-xl border px-3 text-[9px] font-black transition hover:-translate-y-0.5 ${toneClasses[item.tone]}`}
                                >
                                    <span className="text-base">{item.icon}</span>
                                    {item.label}
                                </button>
                            );
                        })}

                        <button type="button" onClick={() => setActiveModal('hedefler')} className="flex min-h-[52px] items-center justify-center gap-2 rounded-xl border border-rose-100 bg-rose-50 px-3 text-[9px] font-black text-rose-700 transition hover:-translate-y-0.5 hover:border-rose-300">
                            <span className="text-base">◎</span> Hedefler
                        </button>

                        {isCmr && (
                            <button type="button" onClick={() => setActiveModal('izinler')} className="flex min-h-[52px] items-center justify-center gap-2 rounded-xl border border-purple-100 bg-purple-50 px-3 text-[9px] font-black text-purple-700 transition hover:-translate-y-0.5 hover:border-purple-300">
                                <span className="text-base">▦</span> İzinler
                            </button>
                        )}

                        <button type="button" onClick={() => setActiveModal('departman')} className="flex min-h-[52px] items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-[9px] font-black text-slate-700 transition hover:-translate-y-0.5 hover:border-slate-400">
                            <span className="text-base">▥</span> Raporlar
                        </button>
                    </div>
                </section>
                )}
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
