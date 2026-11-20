"use client";

// CNETMOBIL - "Şampiyonlar Ligi Mağaza Müdürleri Yarışması" sekmesi (ana sayfada, tüm CMR girişlerinde görünür)
// Sıralamayı görmek için yöneticinin belirlediği ŞİFRE girilir (sunucu doğrular; şifresiz hiçbir veri gelmez).
// Şifre girildikten 20 SANİYE sonra ekran kendiliğinden yeniden KİLİTLENİR (sunucudaki anahtar da 20 sn'de geçersiz olur).
// Her gün 12:30'da yayınlanır; yeni güne geçince "Rapor bekleniyor"; GÜN SEÇİCİ ile geçmiş günler; ayın 28'inde yayın durur.

import React, { useCallback, useEffect, useState } from "react";

import { DayPicker, dayPickLabel, dayPickToGun, formatIsoDate, istanbulToday, type DayPick } from "./degerPuanGunSecici";
import { MudurKarti } from "./SampiyonlarLigiSonuc";

type Row = Record<string, any>;

const STORAGE_KEY = "cnet_mudur_token";

function readToken(): string {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;

    return parsed && Number(parsed.expiresAt) > Date.now() / 1000 ? String(parsed.token) : "";
  } catch {
    return "";
  }
}

// Saklanan anahtarın bitiş zamanı (ms); yoksa 0
function readExpiryMs(): number {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;

    return parsed ? Number(parsed.expiresAt) * 1000 : 0;
  } catch {
    return 0;
  }
}

function writeToken(token: string, expiresAt: number) {
  try {
    if (token) window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ token, expiresAt }));
    else window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // sessionStorage yoksa (gizli pencere vb.) şifre her açılışta istenir
  }
}

const dateTr = (iso: unknown) => (iso ? String(iso).split("-").reverse().join(".") : "-");

// kaynak "yayin": mağazaların gördüğü. "test": yalnız yönetici önizlemesi (şifre gerekmez, Hesapla sonucu).
export default function SampiyonlarLigiMudur({ kaynak = "yayin" }: { kaynak?: "yayin" | "test" }) {
  const [data, setData] = useState<Row | null>(null);
  const [error, setError] = useState("");
  const [pick, setPick] = useState<DayPick>({ kind: "bugun" });
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [lockLeft, setLockLeft] = useState<number | null>(null); // kilitlenmeye kalan saniye (yönetici hariç)

  const load = useCallback(async () => {
    try {
      const gun = kaynak === "test" ? null : dayPickToGun(pick);
      const query = kaynak === "test" ? "?kaynak=test" : gun ? `?gun=${gun}` : "";
      const token = readToken();
      const response = await fetch(`/api/wingsm/yarisma/mudur${query}`, {
        cache: "no-store",
        credentials: "same-origin",
        headers: token ? { "x-mudur-token": token } : undefined,
      });
      const payload = await response.json().catch(() => null);

      if (!payload?.success) throw new Error(payload?.error || `HTTP ${response.status}`);

      // Süresi dolmuş/geçersiz anahtar sunucuda "locked" döner: saklanan anahtar silinir
      if (payload.locked) {
        writeToken("", 0);
        setLockLeft(null);
      }

      setData(payload);
      setError("");
    } catch (e: any) {
      setError(e?.message || "Yarışma bilgisi alınamadı.");
    } finally {
      setLoading(false);
    }
  }, [kaynak, pick]);

  // 20 SANİYE GERİ SAYIM: süre dolunca ekran kilitlenir, veri ve anahtar silinir (yönetici ve test önizlemesi hariç)
  useEffect(() => {
    if (!data || data.locked || data.admin || kaynak === "test") {
      setLockLeft(null);

      return;
    }

    const tick = () => {
      const left = Math.ceil((readExpiryMs() - Date.now()) / 1000);

      if (left <= 0) {
        writeToken("", 0);
        setLockLeft(null);
        setData((current) => (current ? { success: true, locked: true, passwordSet: true, config: current.config } : current));

        return;
      }

      setLockLeft(left);
    };

    tick();

    const timer = window.setInterval(tick, 1000);

    return () => window.clearInterval(timer);
  }, [data, kaynak]);

  useEffect(() => {
    setLoading(true);
    void load();

    // 12:30 yayınında ekran kendiliğinden yenilensin (2 dakikada bir, sessiz)
    const timer = window.setInterval(() => void load(), 120_000);

    return () => window.clearInterval(timer);
  }, [load]);

  const login = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setLoginError("");

    try {
      const response = await fetch("/api/wingsm/yarisma/mudur/giris", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sifre: password }),
      });
      const payload = await response.json().catch(() => null);

      if (!payload?.success) throw new Error(payload?.error || `HTTP ${response.status}`);

      writeToken(String(payload.token), Number(payload.expiresAt));
      setPassword("");
      await load();
    } catch (e: any) {
      setLoginError(e?.message || "Giriş yapılamadı.");
    } finally {
      setBusy(false);
    }
  };

  if (error) return <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-[13px] font-bold text-rose-700">{error}</div>;
  if (!data) return <div className="p-6 text-center text-[13px] font-semibold text-slate-400">Yükleniyor...</div>;

  const config: Row = data.config ?? {};

  // KİLİTLİ: şifre istenir
  if (data.locked) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-amber-200 bg-gradient-to-b from-amber-50 to-white p-8 text-center shadow-sm">
        <div className="text-5xl">🔒</div>
        <div className="mt-3 text-[18px] font-black text-slate-900">{config.title || "Şampiyonlar Ligi Mağaza Müdürleri Yarışması"}</div>
        <p className="mt-2 text-[13px] font-semibold text-slate-500">Bu yarışmanın sıralamasını görmek için şifreyi girin.</p>
        <p className="mt-1 text-[11px] font-semibold text-slate-400">Giriş yaptıktan 20 saniye sonra ekran tekrar kilitlenir.</p>

        {data.passwordSet === false ? (
          <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3 text-[13px] font-bold text-slate-500">Şifre henüz belirlenmedi. Lütfen yöneticiyle görüşün.</div>
        ) : (
          <form onSubmit={login} className="mt-4 space-y-3">
            <input
              type="password"
              autoComplete="off"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Şifre"
              className="h-12 w-full rounded-xl border border-slate-200 px-4 text-center text-[15px] font-semibold outline-none focus:border-amber-400"
            />
            {loginError && <div className="rounded-lg border border-rose-200 bg-rose-50 p-2 text-[12px] font-bold text-rose-700">{loginError}</div>}
            <button type="submit" disabled={busy || !password} className="h-12 w-full rounded-xl bg-amber-500 text-[14px] font-black text-white hover:bg-amber-600 disabled:opacity-50">
              {busy ? "Kontrol ediliyor..." : "Giriş"}
            </button>
          </form>
        )}
      </div>
    );
  }

  const today = istanbulToday();
  const remaining = config.endDate ? Math.max(0, Math.round((Date.parse(`${config.endDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000) + 1) : 0;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 via-white to-amber-50 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[20px] font-black text-slate-900">🏆 {config.title || "Şampiyonlar Ligi Mağaza Müdürleri Yarışması"}</div>
            <div className="mt-1 text-[13px] font-semibold text-slate-600">
              {dateTr(config.startDate)} - {dateTr(config.endDate)} · <b>{remaining} gün kaldı</b>
              {data.mudur?.computedAt && !data.bekleniyor ? ` · Yayın: ${new Date(data.mudur.computedAt).toLocaleString("tr-TR")}` : ""}
            </div>
          </div>
          {lockLeft !== null && (
            <div className={`rounded-full px-3 py-1 text-[12px] font-black ${lockLeft <= 5 ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-800"}`}>🔒 {lockLeft} sn sonra kilitlenecek</div>
          )}
          {kaynak !== "test" && (
            <div>
              <div className="mb-1 text-[10px] font-bold text-slate-500">Gün</div>
              <DayPicker label={dayPickLabel(pick)} disabled={loading} minDate={data.minGun} maxDate={today} onSelect={setPick} />
            </div>
          )}
        </div>
      </div>

      {data.donemSonu ? (
        <div className="flex min-h-[220px] flex-col items-center justify-center rounded-2xl bg-white px-6 py-10 text-center shadow-sm">
          <div className="text-5xl">📢</div>
          <div className="mt-3 text-2xl font-black text-[#1b2559]">Yayın sona erdi</div>
          <p className="mt-2 max-w-md text-sm font-semibold text-slate-500">
            Sıralama {data.sonYayinGunu ? formatIsoDate(data.sonYayinGunu) : "ayın 28'i"} tarihine kadar yayınlandı. Nihai sonuç yarışma bitince yönetici tarafından paylaşılacaktır.
          </p>
          <p className="mt-3 text-xs font-semibold text-slate-400">Son yayınlanan raporu görmek için sağ üstteki seçiciden günü seçebilirsiniz.</p>
        </div>
      ) : data.bekleniyor ? (
        <div className="flex min-h-[220px] flex-col items-center justify-center rounded-2xl bg-white px-6 py-10 text-center shadow-sm">
          <div className="text-5xl">⏳</div>
          <div className="mt-3 text-2xl font-black text-[#1b2559]">Rapor bekleniyor</div>
          <p className="mt-2 max-w-md text-sm font-semibold text-slate-500">Sıralama her gün saat 12:30&apos;da otomatik yayınlanır; yayınlanınca burada görünecek.</p>
          <p className="mt-3 text-xs font-semibold text-slate-400">Önceki günün raporunu görmek için sağ üstteki seçiciden &quot;Dün&quot;ü seçebilirsiniz.</p>
        </div>
      ) : data.bulunamadi ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-8 text-center text-sm font-bold text-slate-500">
          {data.gun ? `${formatIsoDate(data.gun)} tarihi için` : "Bu tarih için"} kayıtlı rapor bulunamadı.
        </div>
      ) : !data.mudur ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-[13px] font-semibold text-slate-500">Sıralama ilk hesaplandığında burada görünecek. Rapor her gün 12:30&apos;da yayınlanır.</div>
      ) : (
        <>
          {data.gun && data.today && data.gun !== data.today && data.mudur.range && (
            <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-bold text-blue-900">
              {formatIsoDate(data.gun)} tarihli rapor: {dateTr(data.mudur.range.from)} - {dateTr(data.mudur.range.to)} arası
            </div>
          )}
          <MudurKarti mudur={data.mudur} myBranch={data.myBranch} />
        </>
      )}
    </div>
  );
}
