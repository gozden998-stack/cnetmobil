'use client';

import React, { useState, useEffect } from 'react';

// ================= 1. TYPESCRIPT VERİ YAPILARI (TIPIFLEME) =================
interface IkasMasterProduct {
  ikas_id: string;
  brand: string;
  model: string;
  storage: string;
}

interface Device {
  id: number;
  sku: string; // IMEI numarası direkt stok kodu (SKU) olacak
  brand: string;
  model: string;
  storage: string;
  color: string;
  condition: string;
  branch_name: string;
  purchase_price: number;
  sale_price: number;
  ikas_product_id: string;
  status: 'available' | 'sold';
}

export default function PartnerDashboard() {
  // Aktif Sekme Yönetimi
  const [activeTab, setActiveTab] = useState<'anasayfa' | 'firsat_cihazlari' | 'siparisler' | 'finansallar'>('firsat_cihazlari');
  
  // Arama ve Popup Modalı Yönetimi
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [searchSku, setSearchSku] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  // 1. IKAS'TAN GELECEK HAZIR ANA MODELLERİN LİSTESİ (Örnek Havuz)
  const [ikasProducts, setIkasProducts] = useState<IkasMasterProduct[]>([
    { ikas_id: 'prod_apple_13_128', brand: 'Apple', model: 'iPhone 13', storage: '128GB' },
    { ikas_id: 'prod_apple_14pm_256', brand: 'Apple', model: 'iPhone 14 Pro Max', storage: '256GB' },
    { ikas_id: 'prod_samsung_s23u_512', brand: 'Samsung', model: 'Galaxy S23 Ultra', storage: '512GB' },
  ]);

  // 2. PANELDE VE SİTEDE CANLI DURAN BENZERSİZ IMEI STOKLARI
  const [devices, setDevices] = useState<Device[]>([
    {
      id: 1,
      sku: '358921104857211', // IMEI
      brand: 'Apple',
      model: 'iPhone 14 Pro Max',
      storage: '256GB',
      color: 'Derin Mor',
      condition: 'Yenilenmiş A+',
      branch_name: 'Kadıköy Şube',
      purchase_price: 32000,
      sale_price: 48500,
      ikas_product_id: 'prod_apple_14pm_256',
      status: 'available'
    },
    {
      id: 2,
      sku: '357412209481125', // IMEI
      brand: 'Samsung',
      model: 'Galaxy S23 Ultra',
      storage: '512GB',
      color: 'Botanik Yeşil',
      condition: 'A Kalite',
      branch_name: 'Beşiktaş Şube',
      purchase_price: 28000,
      sale_price: 39000,
      ikas_product_id: 'prod_samsung_s23u_512',
      status: 'available'
    }
  ]);

  // 3. YENİ CİHAZ EKLEME FORUM STATE YAPISI
  const [formData, setFormData] = useState({
    sku: '', // IMEI buraya yazılacak
    brand: '',
    model: '',
    storage: '',
    color: '',
    condition: 'Yenilenmiş A+',
    branch_name: 'Merkez Depo',
    purchase_price: '',
    sale_price: '',
    ikas_product_id: ''
  });

  // Giriş Yapıldığında Alanları Senkronize Eden Fonksiyon
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Listeden Ana Model Seçildiğinde Marka/Hafıza Bilgisini Otomatik Atayan Fonksiyon
  const handleMasterProductSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const productId = e.target.value;
    const selectedMaster = ikasProducts.find(p => p.ikas_id === productId);
    
    if (selectedMaster) {
      setFormData(prev => ({
        ...prev,
        ikas_product_id: productId,
        brand: selectedMaster.brand,
        model: selectedMaster.model,
        storage: selectedMaster.storage
      }));
    } else {
      setFormData(prev => ({ ...prev, ikas_product_id: '', brand: '', model: '', storage: '' }));
    }
  };

  // Formu Onaylayıp Gerçek Zamanlı Arayüze ve Sitede Yayına Gönderme Fonksiyonu
  const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    // İLERİDE BURAYA IKAS API ENTEGRASYONUNUN KÖPRÜSÜ ATILACAK
    const newDevice: Device = {
      id: Date.now(),
      sku: formData.sku, // Giriş yapılan IMEI stok kodu oluyor
      brand: formData.brand,
      model: formData.model,
      storage: formData.storage,
      color: formData.color,
      condition: formData.condition,
      branch_name: formData.branch_name,
      purchase_price: parseFloat(formData.purchase_price) || 0,
      sale_price: parseFloat(formData.sale_price) || 0,
      ikas_product_id: formData.ikas_product_id,
      status: 'available'
    };

    // Arayüz listesini anlık güncelle
    setDevices([newDevice, ...devices]);
    setLoading(false);
    setIsModalOpen(false);
    
    // Formu Bir Sonraki Cihaz Girişi İçin Sıfırla
    setFormData({
      sku: '', brand: '', model: '', storage: '', color: '',
      condition: 'Yenilenmiş A+', branch_name: 'Merkez Depo', purchase_price: '', sale_price: '', ikas_product_id: ''
    });
  };

  // Filtreleme Algoritması (Arama çubuğuna yazılan IMEI veya Model anında elenir)
  const filteredDevices = devices.filter(d => 
    d.model.toLowerCase().includes(searchSku.toLowerCase()) || d.sku.includes(searchSku)
  );

  return (
    <div className="flex h-screen bg-[#f8fafc] text-[#334155] font-sans antialiased text-xs select-none">
      
      {/* ================= SOL SIDEBAR PANELİ ================= */}
      <aside className="w-64 bg-[#0f172a] text-[#94a3b8] flex flex-col justify-between border-r border-[#1e293b] z-20">
        <div>
          {/* Üst Marka Alanı */}
          <div className="flex items-center gap-3 px-6 py-5 border-b border-[#1e293b] mb-4">
            <div className="w-8 h-8 bg-[#38bdf8] rounded-xl flex items-center justify-center text-[#0f172a] font-extrabold text-sm shadow-lg shadow-sky-500/20">C</div>
            <div>
              <span className="font-bold text-sm text-white block tracking-tight">Cnetmobil</span>
              <span className="text-[10px] text-[#38bdf8] font-medium block">Merkezi B2B Paneli</span>
            </div>
          </div>

          {/* Navigasyon Elemanları */}
          <nav className="px-3 space-y-1">
            <button onClick={() => setActiveTab('anasayfa')} className={`w-full text-left px-4 py-3 rounded-xl transition-all flex items-center gap-2.5 ${activeTab === 'anasayfa' ? 'bg-[#1e293b] text-[#38bdf8] font-bold border-l-4 border-[#38bdf8]' : 'hover:bg-[#1e293b] hover:text-white'}`}>
              <span>📊</span> Anasayfa Özet
            </button>

            {/* Envanter Açılır Grubu */}
            <div className="relative group">
              <button onClick={() => setActiveTab('firsat_cihazlari')} className={`w-full text-left px-4 py-3 rounded-xl transition-all flex items-center justify-between ${activeTab === 'firsat_cihazlari' ? 'bg-[#1e293b] text-[#38bdf8] font-bold border-l-4 border-[#38bdf8]' : 'hover:bg-[#1e293b] hover:text-white'}`}>
                <div className="flex items-center gap-2.5"><span>📦</span> Envanter Yönetimi</div>
                <span className="text-[9px] opacity-40">▶</span>
              </button>
              {/* Sağa Fırlayan Menü Kırılımı */}
              <div className="absolute left-full top-0 ml-1 w-52 bg-[#0f172a] border border-[#1e293b] rounded-xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-50 p-1.5 space-y-0.5">
                <button onClick={() => setActiveTab('firsat_cihazlari')} className="w-full text-left px-3 py-2 text-white bg-[#1e293b] rounded-lg font-medium">📱 Fırsat Cihazları</button>
                <button className="w-full text-left px-3 py-2 text-[#94a3b8] hover:bg-[#1e293b] rounded-lg opacity-40 cursor-not-allowed">🎧 Aksesuarlar</button>
              </div>
            </div>

            {/* Sipariş Yönetimi */}
            <button onClick={() => setActiveTab('siparisler')} className={`w-full text-left px-4 py-3 rounded-xl transition-all flex items-center gap-2.5 ${activeTab === 'siparisler' ? 'bg-[#1e293b] text-[#38bdf8] font-bold' : 'hover:bg-[#1e293b] hover:text-white'}`}>
              <span>🛒</span> Sipariş Yönetimi
            </button>

            {/* Finansallar */}
            <button onClick={() => setActiveTab('finansallar')} className={`w-full text-left px-4 py-3 rounded-xl transition-all flex items-center gap-2.5 ${activeTab === 'finansallar' ? 'bg-[#1e293b] text-[#38bdf8] font-bold' : 'hover:bg-[#1e293b] hover:text-white'}`}>
              <span>💰</span> Finansallar
            </button>
          </nav>
        </div>
        <div className="text-[10px] text-[#475569] text-center border-t border-[#1e293b] py-4 font-mono"> partner.cnetmobil.com.tr </div>
      </aside>

      {/* ================= SAĞ İÇERİK ALANI ================= */}
      <main className="flex-1 flex flex-col overflow-hidden">
        
        {/* Üst Durum Çubuğu */}
        <header className="h-16 bg-white border-b border-[#e2e8f0] flex items-center justify-between px-8 shadow-sm z-10">
          <div className="font-bold text-sm text-[#0f172a] tracking-tight">Merkez Otomasyon Ağı</div>
          <div className="flex items-center gap-3">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
            <span className="text-[#64748b] font-bold text-[10px] bg-[#f1f5f9] px-2.5 py-1 rounded-md border border-[#e2e8f0]">Ikas API Senkronizasyonu: Hazır</span>
          </div>
        </header>

        {/* İçerik Havuzu */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* KURUMSAL GÖRÜNÜM İSTATİSTİK KARTLARI */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-white border border-[#e2e8f0] rounded-xl p-4 shadow-sm relative">
              <span className="text-[#64748b] font-bold text-[10px] uppercase tracking-wider block">Canlı Sipariş Adedi</span>
              <span className="text-xl font-extrabold text-[#0f172a] block mt-1">12 Sipariş</span>
              <span className="text-[10px] text-emerald-600 font-bold mt-1 inline-block">↑ %8 İvme Artışı</span>
            </div>
            <div className="bg-white border border-[#e2e8f0] rounded-xl p-4 shadow-sm">
              <span className="text-[#64748b] font-bold text-[10px] uppercase tracking-wider block">Havuzdaki IMEI Sayısı</span>
              <span className="text-xl font-extrabold text-[#0f172a] block mt-1">{devices.length} Tekil Cihaz</span>
              <span className="text-[10px] text-[#64748b] font-medium mt-1 inline-block">8 şube canlı entegre</span>
            </div>
            <div className="bg-white border border-[#e2e8f0] rounded-xl p-4 shadow-sm">
              <span className="text-[#64748b] font-bold text-[10px] uppercase tracking-wider block">Günlük Brüt Hacim</span>
              <span className="text-xl font-extrabold text-emerald-600 block mt-1">87,500 TL</span>
              <span className="text-[10px] text-[#64748b] font-medium mt-1 inline-block">Kasa ciroları dahil</span>
            </div>
            <div className="bg-white border border-[#e2e8f0] rounded-xl p-4 shadow-sm">
              <span className="text-[#64748b] font-bold text-[10px] uppercase tracking-wider block">Şube Parça Talepleri</span>
              <span className="text-xl font-extrabold text-amber-600 block mt-1">3 Bekleyen</span>
              <span className="text-[10px] text-amber-600 font-bold mt-1 inline-block">Merkez onay bekliyor</span>
            </div>
          </div>

          {/* FIRSAT CİHAZLARIM SEKMESİ SEÇİLİYSE */}
          {activeTab === 'firsat_cihazlari' && (
            <div className="space-y-4">
              
              {/* AKSİYON VE FİLTRE BAR TASARIMI */}
              <div className="bg-white border border-[#e2e8f0] rounded-xl p-4 shadow-sm space-y-4">
                <div className="flex items-center justify-between gap-4">
                  
                  {/* Sol Giriş ve Arama Çubuğu */}
                  <div className="flex items-center bg-white border border-[#cbd5e1] rounded-lg overflow-hidden w-80 shadow-sm focus-within:border-[#38bdf8] transition-all">
                    <select className="bg-[#f8fafc] border-r border-[#cbd5e1] px-3 py-2 font-bold text-[#475569] outline-none">
                      <option>IMEI / SKU</option>
                    </select>
                    <input 
                      type="text" 
                      placeholder="Filtrelemek için yazınız..." 
                      className="px-3 py-2 outline-none w-full text-xs" 
                      value={searchSku}
                      onChange={(e) => setSearchSku(e.target.value)}
                    />
                  </div>

                  {/* Tam İstediğiniz Yeşil Buton Grupları */}
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setIsModalOpen(true)}
                      className="bg-[#22c55e] hover:bg-[#16a34a] text-white font-extrabold px-4 py-2.5 rounded-lg shadow-sm transition-all active:scale-95"
                    >
                      + Cihaz Ekle
                    </button>
                    <button className="bg-white border border-[#cbd5e1] text-[#334155] font-bold px-4 py-2.5 rounded-lg hover:bg-[#f8fafc] transition-all">
                      Toplu Cep Telefonu Ekle
                    </button>
                    <button className="bg-white border border-[#cbd5e1] text-[#334155] font-bold px-4 py-2.5 rounded-lg hover:bg-[#f8fafc] transition-all">
                      Aksiyonlar
                    </button>
                  </div>
                </div>

                {/* Rozet Filtre Göstergeleri */}
                <div className="border-t border-[#f1f5f9] pt-3 flex items-center justify-between text-[#64748b] font-bold text-[11px]">
                  <div className="flex items-center gap-4">
                    <div>Ürün Grubu <span className="inline-flex items-center justify-center bg-[#ffedd5] text-[#ea580c] w-4 h-4 rounded-full text-[9px] font-extrabold ml-0.5">0</span></div>
                    <div>Marka <span className="inline-flex items-center justify-center bg-[#ffedd5] text-[#ea580c] w-4 h-4 rounded-full text-[9px] font-extrabold ml-0.5">0</span></div>
                    <div>Model <span className="inline-flex items-center justify-center bg-[#ffedd5] text-[#ea580c] w-4 h-4 rounded-full text-[9px] font-extrabold ml-0.5">0</span></div>
                    <div>Kozmetik Durum <span className="inline-flex items-center justify-center bg-[#ffedd5] text-[#ea580c] w-4 h-4 rounded-full text-[9px] font-extrabold ml-0.5">0</span></div>
                    <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-[#334155] ml-2">
                      <input type="checkbox" className="rounded border-[#cbd5e1] text-[#38bdf8] focus:ring-0 w-3.5 h-3.5" /> Stoğu Azalanlar
                    </label>
                  </div>
                  {searchSku && <button onClick={() => setSearchSku('')} className="text-[#ef4444] font-extrabold hover:underline">Temizle ↻</button>}
                </div>
              </div>

              {/* STOK TABLO LİSTESİ */}
              <div className="bg-white border border-[#e2e8f0] rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-[#f8fafc] border-b border-[#e2e8f0] text-[10px] font-bold text-[#64748b] uppercase">
                    <tr>
                      <th className="p-4">Cihaz Model Adı</th>
                      <th className="p-4">IMEI / Tekil SKU</th>
                      <th className="p-4">Kondisyon</th>
                      <th className="p-4">Şube Lokasyonu</th>
                      <th className="p-4">Maliyet (Alış)</th>
                      <th className="p-4">Satış Fiyatı</th>
                      <th className="p-4">Entegrasyon</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f1f5f9] text-[#334155] font-medium">
                    {filteredDevices.map((device) => (
                      <tr key={device.id} className="hover:bg-[#f8fafc]/90 transition-all">
                        <td className="p-4 font-bold text-[#0f172a] text-sm">
                          {device.brand} {device.model} 
                          <span className="text-[#94a3b8] font-normal text-xs ml-2">({device.storage} / {device.color})</span>
                        </td>
                        <td className="p-4 font-mono text-[#64748b]">{device.sku}</td>
                        <td className="p-4">
                          <span className="bg-[#f0fdf4] text-[#166534] font-extrabold px-2.5 py-1 rounded-md border border-[#bbf7d0] text-[10px]">
                            {device.condition}
                          </span>
                        </td>
                        <td className="p-4 text-[#475569] font-semibold">{device.branch_name}</td>
                        <td className="p-4 font-mono text-[#94a3b8]">{device.purchase_price.toLocaleString('tr-TR')} TL</td>
                        <td className="p-4 font-extrabold text-[#0f172a] text-sm">{device.sale_price.toLocaleString('tr-TR')} TL</td>
                        <td className="p-4">
                          <span className="inline-flex items-center gap-1.5 bg-[#e0f2fe] text-[#0369a1] font-bold px-3 py-1 rounded-full text-[10px] border border-[#bae6fd]">
                            <span className="w-1.5 h-1.5 bg-[#38bdf8] rounded-full"></span>
                            Ikas Sitede Canlıda
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Diğer Boş Bölümler */}
          {activeTab === 'anasayfa' && <div className="bg-white p-6 rounded-xl border text-[#64748b]">Cnetmobil şubeleri günlük ciro grafikleri raporlama alanı.</div>}
          {activeTab === 'siparisler' && <div className="bg-white p-6 rounded-xl border text-[#64748b]">Ikas e-ticaret sitenizden gelen canlı müşteri sipariş akışı.</div>}
          {activeTab === 'finansallar' && <div className="bg-white p-6 rounded-xl border text-[#64748b]">Şube kasaları nakit ve hakediş muhasebe dökümleri.</div>}

        </div>
      </main>

      {/* ================= 3. POP-UP VERİ GİRİŞ FORMU (MODAL) ================= */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-[#0f172a]/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-[#e2e8f0] overflow-hidden animate-in fade-in zoom-in-95 duration-100">
            
            <div className="px-5 py-4 bg-[#f8fafc] border-b border-[#e2e8f0] flex justify-between items-center">
              <h3 className="font-bold text-[#0f172a] text-sm tracking-tight">Ikas Sitenize Tek Tıkla Cihaz Gönderin</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-[#94a3b8] hover:text-[#334155] font-bold">✕</button>
            </div>

            <form onSubmit={handleFormSubmit} className="p-5 space-y-4 text-xs">
              
              {/* 1. ADIM: IKAS'TAN ÇEKİLEN ANA MODELİ SEÇ */}
              <div>
                <label className="block font-bold text-[#475569] mb-1">1. Sitedeki Ana Telefon Modelini Seçin</label>
                <select 
                  required
                  name="ikas_product_id" 
                  className="w-full bg-[#f8fafc] border border-[#cbd5e1] rounded-xl p-2.5 outline-none font-bold text-[#334155] cursor-pointer"
                  onChange={handleMasterProductSelect}
                >
                  <option value="">-- Sitedeki Ürünler Çekildi, Seçiniz --</option>
                  {ikasProducts.map(p => (
                    <option key={p.ikas_id} value={p.ikas_id}>{p.brand} {p.model} ({p.storage})</option>
                  ))}
                </select>
              </div>

              {/* 2. ADIM: IMEI YAZ (SKU OLACAK) */}
              <div>
                <label className="block font-bold text-[#475569] mb-1">2. Cihazın 15 Haneli IMEI Numarasını Girin (SKU)</label>
                <input 
                  type="text" 
                  name="sku" 
                  maxLength={15} 
                  required 
                  className="w-full bg-[#f8fafc] border border-[#cbd5e1] rounded-xl p-2.5 outline-none font-mono text-sm shadow-inner focus:border-[#38bdf8]" 
                  placeholder="IMEI barkodunu okutun veya yazın" 
                  value={formData.sku} 
                  onChange={handleInputChange} 
                />
              </div>

              {/* RENK GİRİŞİ */}
              <div>
                <label className="block font-bold text-[#475569] mb-1">Cihazın Rengi</label>
                <input type="text" name="color" required className="w-full bg-[#f8fafc] border border-[#cbd5e1] rounded-xl p-2.5 outline-none" placeholder="örn: Sierra Mavisi, Uzay Grisi" value={formData.color} onChange={handleInputChange} />
              </div>

              {/* KONDİSYON VE FİYAT */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#475569] mb-1">Kozmetik Kondisyon</label>
                  <select name="condition" className="w-full bg-[#f8fafc] border border-[#cbd5e1] rounded-xl p-2.5 outline-none" value={formData.condition} onChange={handleInputChange}>
                    <option value="Yenilenmiş A+">Yenilenmiş A+</option>
                    <option value="A Kalite">A Kalite</option>
                    <option value="B Kalite">B Kalite</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-[#475569] mb-1">Ikas Satış Fiyatı (TL)</label>
                  <input type="number" name="sale_price" required className="w-full bg-[#f8fafc] border border-[#cbd5e1] rounded-xl p-2.5 outline-none font-bold text-emerald-600 shadow-sm" placeholder="0.00 TL" value={formData.sale_price} onChange={handleInputChange} />
                </div>
              </div>

              {/* MALİYET VE ŞUBE */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#475569] mb-1">Alış Fiyatı (Maliyet)</label>
                  <input type="number" name="purchase_price" required className="w-full bg-[#f8fafc] border border-[#cbd5e1] rounded-xl p-2.5 outline-none font-mono" placeholder="0.00" value={formData.purchase_price} onChange={handleInputChange} />
                </div>
                <div>
                  <label className="block font-bold text-[#475569] mb-1">Bulunduğu Şube</label>
                  <select name="branch_name" className="w-full bg-[#f8fafc] border border-[#cbd5e1] rounded-xl p-2.5 outline-none" value={formData.branch_name} onChange={handleInputChange}>
                    <option value="Kadıköy Şube">Kadıköy Şube</option>
                    <option value="Beşiktaş Şube">Beşiktaş Şube</option>
                    <option value="Merkez Depo">Merkez Depo</option>
                  </select>
                </div>
              </div>

              {/* AKSİYON BUTONLARI */}
              <div className="pt-4 border-t border-[#f1f5f9] flex justify-end gap-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="bg-[#f1f5f9] text-[#475569] font-bold px-4 py-2.5 rounded-xl hover:bg-[#e2e8f0]">İptal</button>
                <button type="submit" disabled={loading} className="bg-[#22c55e] hover:bg-[#16a34a] text-white font-bold px-4 py-2.5 rounded-xl shadow-md transition-all">
                  {loading ? 'Sitede Yayınlanıyor...' : 'Kaydet ve Canlıya Al'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
