'use client';

import React, { useState } from 'react';

// Cihaz Durum Tipleri
interface Secimler {
  marka: string;
  model: string;
  hafiza: string;
  renk: string;
  kozmetik: string;
  calisma: string;
  imei: string;
}

export default function GarantiliStilDashboard() {
  // Videodaki Adım Mantığı (1: Marka, 2: Model, 3: Detaylar, 4: Sonuç)
  const [adim, setAdim] = useState<number>(1);
  
  const [secim, setSecim] = useState<Secimler>({
    marka: '', model: '', hafiza: '', renk: '', kozmetik: '', calisma: '', imei: ''
  });

  // Örnek Hesaplanan Fiyat (Videodaki robot mantığı)
  const [hesaplananFiyat, setHesaplananFiyat] = useState<number>(0);

  // Markalar
  const markalar = ['Apple', 'Samsung', 'Xiaomi', 'Tecno'];

  // Modellere göre hafıza ve renk havuzu (Ikas simülasyonu)
  const modeller: Record<string, string[]> = {
    Apple: ['iPhone 13', 'iPhone 14 Pro Max', 'iPhone 15 Pro'],
    Samsung: ['Galaxy S23 Ultra', 'Galaxy S24', 'Galaxy A54'],
    Xiaomi: ['Redmi Note 12', 'Xiaomi 13 Pro'],
    Tecno: ['Camon 20', 'Spark 10']
  };

  const hafizalar = ['64GB', '128GB', '256GB', '512GB'];
  const renkler = ['Uzay Grisi', 'Gümüş', 'Gece Yarısı', 'Derin Mor'];

  // Videodaki tık tık seçim yapıldığında fiyatı uçuran akıllı fonksiyon
  const fiyatHesapla = (yeniSecim: Secimler) => {
    let bazFiyat = 30000;
    if (yeniSecim.model.includes('14 Pro Max')) bazFiyat = 45000;
    if (yeniSecim.model.includes('15 Pro')) bazFiyat = 55000;
    if (yeniSecim.model.includes('S23 Ultra')) bazFiyat = 38000;

    // Kozmetik ve çalışma durumuna göre fiyat kırma adımları
    if (yeniSecim.kozmetik === 'Çizikli / Yıpranmış') bazFiyat -= 4000;
    if (yeniSecim.calisma === 'Kamera veya FaceID Arızalı') bazFiyat -= 6000;
    
    setHesaplananFiyat(bazFiyat);
  };

  const sifirla = () => {
    setSecim({ marka: '', model: '', hafiza: '', renk: '', kozmetik: '', calisma: '', imei: '' });
    setHesaplananFiyat(0);
    setAdim(1);
  };

  return (
    <div className="flex h-screen bg-[#f3f4f6] text-[#374151] font-sans text-xs antialiased">
      
      {/* SOL SABİT MENÜ */}
      <aside className="w-60 bg-[#111827] text-[#9ca3af] p-4 flex flex-col justify-between border-r border-[#1f2937]">
        <div>
          <div className="flex items-center gap-2.5 px-2 py-4 border-b border-[#1f2937] mb-6">
            <div className="w-7 h-7 bg-[#22c55e] rounded-lg flex items-center justify-center text-white font-black">C</div>
            <span className="font-bold text-sm text-white tracking-tight">Cnetmobil Partner</span>
          </div>
          <nav className="space-y-1">
            <button className="w-full text-left px-3 py-2.5 rounded-xl bg-[#1f2937] text-white font-bold">📱 Cihaz Alım / Satış</button>
            <button className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-[#1f2937] opacity-50 cursor-not-allowed">📦 Envanter Havuzu</button>
            <button className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-[#1f2937] opacity-50 cursor-not-allowed">🛒 Siparişler</button>
            <button className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-[#1f2937] opacity-50 cursor-not-allowed">💰 Finansallar</button>
          </nav>
        </div>
        <div className="text-[10px] text-[#4b5563] text-center font-mono">partner.cnetmobil.com.tr</div>
      </aside>

      {/* SAĞ İÇERİK ALANI (VİDEODAKİ SİHİRBAZ EKRANI) */}
      <main className="flex-1 flex flex-col overflow-hidden">
        
        {/* Üst Bar */}
        <header className="h-14 bg-white border-b border-[#e5e7eb] flex items-center justify-between px-6 shadow-sm">
          <span className="font-bold text-[#111827]">Garantili Tarzı Akıllı Cihaz Değerleme Otomasyonu</span>
          <span className="bg-[#f3f4f6] text-[#1f2937] px-3 py-1 rounded-md font-bold text-[10px]">Şube Yetkisi: Merkez</span>
        </header>

        {/* Adım İlerleme Çubuğu */}
        <div className="bg-white border-b border-[#e5e7eb] px-12 py-3 flex items-center justify-between text-[#9ca3af] font-bold">
          <div className={`${adim >= 1 ? 'text-[#22c55e]' : ''}`}>1. Marka Seçimi</div>
          <div>➔</div>
          <div className={`${adim >= 2 ? 'text-[#22c55e]' : ''}`}>2. Model & Kapasite</div>
          <div>➔</div>
          <div className={`${adim >= 3 ? 'text-[#22c55e]' : ''}`}>3. Ekspertiz / Durum</div>
          <div>➔</div>
          <div className={`${adim >= 4 ? 'text-[#22c55e]' : ''}`}>4. Fiyat ve İlan</div>
        </div>

        {/* Dinamik Adım İçerikleri */}
        <div className="flex-1 p-8 overflow-y-auto max-w-4xl mx-auto w-full">
          
          {/* ADIM 1: MARKA SEÇİMİ (Büyük Butonlar) */}
          {adim === 1 && (
            <div className="space-y-4">
              <h2 className="text-sm font-bold text-[#111827]">Lütfen Cihazın Markasını Seçin:</h2>
              <div className="grid grid-cols-4 gap-4">
                {markalar.map((m) => (
                  <button
                    key={m}
                    onClick={() => {
                      setSecim({ ...secim, marka: m });
                      setAdim(2);
                    }}
                    className="p-6 bg-white border border-[#e5e7eb] rounded-2xl shadow-sm hover:border-[#22c55e] hover:bg-[#f0fdf4] text-center font-bold text-sm text-[#111827] transition-all"
                  >
                    {m === 'Apple' ? '🍎' : m === 'Samsung' ? '📱' : '⚙️'} <div className="mt-2">{m}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ADIM 2: MODEL VE HAFIZA SEÇİMİ */}
          {adim === 2 && (
            <div className="bg-white border border-[#e5e7eb] rounded-2xl p-6 shadow-sm space-y-6">
              <div className="flex items-center justify-between border-b pb-3">
                <h2 className="text-sm font-bold text-[#111827]">Cihaz Model ve Donanım Seçimi ({secim.marka})</h2>
                <button onClick={() => setAdim(1)} className="text-[#6b7280] hover:underline font-bold">← Geri Dön</button>
              </div>

              {/* Model Seçimi */}
              <div className="space-y-2">
                <span className="block font-bold text-[#4b5563]">Cihazın Modeli:</span>
                <div className="flex flex-wrap gap-2">
                  {modeller[secim.marka]?.map((mod) => (
                    <button
                      key={mod}
                      onClick={() => setSecim({ ...secim, model: mod })}
                      className={`px-4 py-2.5 rounded-xl font-bold border transition-all ${secim.model === mod ? 'bg-[#22c55e] text-white border-[#22c55e]' : 'bg-[#f9fafb] border-[#e5e7eb] hover:bg-[#f3f4f6]'}`}
                    >
                      {mod}
                    </button>
                  ))}
                </div>
              </div>

              {/* Hafıza Seçimi */}
              {secim.model && (
                <div className="space-y-2 pt-2 border-t">
                  <span className="block font-bold text-[#4b5563]">Hafıza Kapasitesi:</span>
                  <div className="flex gap-2">
                    {hafizalar.map((h) => (
                      <button
                        key={h}
                        onClick={() => setSecim({ ...secim, hafiza: h })}
                        className={`px-4 py-2.5 rounded-xl font-bold border transition-all ${secim.hafiza === h ? 'bg-[#22c55e] text-white border-[#22c55e]' : 'bg-[#f9fafb] border-[#e5e7eb] hover:bg-[#f3f4f6]'}`}
                      >
                        {h}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Renk Seçimi */}
              {secim.hafiza && (
                <div className="space-y-2 pt-2 border-t">
                  <span className="block font-bold text-[#4b5563]">Cihazın Rengi:</span>
                  <div className="flex gap-2">
                    {renkler.map((r) => (
                      <button
                        key={r}
                        onClick={() => setSecim({ ...secim, renk: r })}
                        className={`px-4 py-2.5 rounded-xl font-bold border transition-all ${secim.renk === r ? 'bg-[#22c55e] text-white border-[#22c55e]' : 'bg-[#f9fafb] border-[#e5e7eb] hover:bg-[#f3f4f6]'}`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {secim.renk && (
                <div className="pt-4 flex justify-end">
                  <button
                    onClick={() => setAdim(3)}
                    className="bg-[#22c55e] hover:bg-[#16a34a] text-white font-bold px-6 py-2.5 rounded-xl shadow-sm transition-all"
                  >
                    Ekspertiz Adımına Geç ➔
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ADIM 3: EKSPERTİZ / DURUM SEÇİMİ (VİDEODAKİ KRİTİK ADIM) */}
          {adim === 3 && (
            <div className="bg-white border border-[#e5e7eb] rounded-2xl p-6 shadow-sm space-y-6">
              <div className="flex items-center justify-between border-b pb-3">
                <h2 className="text-sm font-bold text-[#111827]">Cihaz Kondisyon Soruları ({secim.model})</h2>
                <button onClick={() => setAdim(2)} className="text-[#6b7280] hover:underline font-bold">← Geri Dön</button>
              </div>

              {/* Soru 1: Kozmetik */}
              <div className="space-y-2">
                <span className="block font-bold text-[#4b5563]">1. Cihazın Kozmetik / Kasa Durumu Nedir?</span>
                <div className="grid grid-cols-2 gap-3">
                  {['Sıfır Gibi / Temiz', 'Çizikli / Yıpranmış'].map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => {
                        const s = { ...secim, kozmetik: k };
                        setSecim(s);
                        fiyatHesapla(s);
                      }}
                      className={`p-3 rounded-xl font-bold border text-left transition-all ${secim.kozmetik === k ? 'bg-[#f0fdf4] border-[#22c55e] text-[#166534]' : 'bg-[#f9fafb] border-[#e5e7eb]'}`}
                    >
                      {k}
                    </button>
                  ))}
                </div>
              </div>

              {/* Soru 2: Çalışma Durumu */}
              {secim.kozmetik && (
                <div className="space-y-2 pt-4 border-t">
                  <span className="block font-bold text-[#4b5563]">2. Cihazda Herhangi Bir Donanım Arızası Var mı?</span>
                  <div className="grid grid-cols-2 gap-3">
                    {['Her Şey Sağlam / Çalışıyor', 'Kamera veya FaceID Arızalı'].map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => {
                          const s = { ...secim, calisma: c };
                          setSecim(s);
                          fiyatHesapla(s);
                        }}
                        className={`p-3 rounded-xl font-bold border text-left transition-all ${secim.calisma === c ? 'bg-[#f0fdf4] border-[#22c55e] text-[#166534]' : 'bg-[#f9fafb] border-[#e5e7eb]'}`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* IMEI Barkod Girişi */}
              {secim.calisma && (
                <div className="space-y-2 pt-4 border-t">
                  <label className="block font-bold text-[#4b5563]">3. Cihazın 15 Haneli IMEI Numarasını Okutun (SKU):</label>
                  <input
                    type="text"
                    maxLength={15}
                    placeholder="Barkod okuyucu ile okutun veya yazın"
                    className="w-full bg-[#f9fafb] border border-[#cbd5e1] rounded-xl p-3 outline-none font-mono text-sm focus:border-[#22c55e]"
                    value={secim.imei}
                    onChange={(e) => setSecim({ ...secim, imei: e.target.value })}
                  />
                </div>
              )}

              {secim.imei.length === 15 && (
                <div className="pt-2 flex justify-end">
                  <button
                    onClick={() => setAdim(4)}
                    className="bg-[#22c55e] hover:bg-[#16a34a] text-white font-bold px-6 py-3 rounded-xl shadow-md transition-all"
                  >
                    Fiyatı Gör ve Canlıya Al ➔
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ADIM 4: ROBOTUN HESAPLADIĞI FİYAT VE IKAS ONAYI */}
          {adim === 4 && (
            <div className="bg-white border border-[#e5e7eb] rounded-2xl p-8 shadow-sm text-center space-y-6">
              <div className="w-16 h-16 bg-[#hn-f0fdf4] text-[#22c55e] rounded-full flex items-center justify-center text-2xl mx-auto font-bold">✓</div>
              
              <div>
                <h2 className="text-base font-black text-[#111827]">Otomatik Cihaz Değerlemesi Tamamlandı</h2>
                <p className="text-[#6b7280] mt-1">Sistem, girdiğiniz verilere göre cihazın online satış değerini çıkarttı.</p>
              </div>

              {/* ÖZET KART */}
              <div className="bg-[#f8fafc] border border-[#e5e7eb] rounded-xl p-4 text-left max-w-sm mx-auto space-y-2 font-medium">
                <div> Marka / Model: <span className="font-bold text-[#111827]">{secim.marka} {secim.model}</span></div>
                <div> Kapasite / Renk: <span className="font-bold text-[#111827]">{secim.hafiza} / {secim.renk}</span></div>
                <div> IMEI (SKU Code): <span className="font-mono font-bold text-[#111827]">{secim.imei}</span></div>
                <div className="pt-2 border-t border-dashed text-sm flex justify-between items-center">
                  <span>Önerilen Satış Fiyatı:</span>
                  <span className="font-black text-[#22c55e] text-base">{hesaplananFiyat.toLocaleString('tr-TR')} TL</span>
                </div>
              </div>

              <div className="flex justify-center gap-3 pt-4">
                <button
                  onClick={sifirla}
                  className="bg-white border border-[#cbd5e1] hover:bg-[#f9fafb] text-[#374151] font-bold px-5 py-2.5 rounded-xl"
                >
                  Yeni Cihaz Al ↻
                </button>
                <button
                  onClick={() => {
                    alert(`IMEI-${secim.imei} koduyla cihaz Ikas sitenize başarıyla fırlatıldı!`);
                    sifirla();
                  }}
                  className="bg-[#22c55e] hover:bg-[#16a34a] text-white font-black px-6 py-2.5 rounded-xl shadow-md shadow-green-500/20"
                >
                  Onayla ve Ikas Sitede Yayınla
                </button>
              </div>
            </div>
          )}

        </div>
      </main>

    </div>
  );
}
