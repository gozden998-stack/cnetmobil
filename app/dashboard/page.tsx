'use client';

import React, { useState } from 'react';

// TypeScript ile Cihaz Yapısı
interface Device {
  id: number;
  sku: string;
  brand: string;
  model: string;
  storage: string;
  color: string;
  condition: string;
  branch_name: string;
  purchase_price: number;
  sale_price: number;
  status: 'available' | 'sold' | 'in_repair';
}

export default function PartnerDashboard() {
  const [activeTab, setActiveTab] = useState<'anasayfa' | 'firsat_cihazlari' | 'siparisler' | 'finansallar'>('firsat_cihazlari');
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [searchSku, setSearchSku] = useState<string>('');

  // Dandik durmasın diye içi dolu gerçekçi test dataları ekledim
  const [devices, setDevices] = useState<Device[]>([
    { id: 1, sku: '358921104857211', brand: 'Apple', model: 'iPhone 14 Pro Max', storage: '256GB', color: 'Derin Mor', condition: 'Yenilenmiş A+', branch_name: 'Kadıköy Şube', purchase_price: 32000, sale_price: 48500, status: 'available' },
    { id: 2, sku: '357412209481125', brand: 'Apple', model: 'iPhone 13', storage: '128GB', color: 'Yıldız Işığı', condition: 'A Kalite', branch_name: 'Beşiktaş Şube', purchase_price: 21000, sale_price: 29900, status: 'available' },
    { id: 3, sku: '354112209845112', brand: 'Samsung', model: 'Galaxy S23 Ultra', storage: '512GB', color: 'Botanik Yeşil', condition: 'Yenilenmiş A+', branch_name: 'Merkez Depo', purchase_price: 28000, sale_price: 39000, status: 'available' },
  ]);

  const [formData, setFormData] = useState({
    sku: '', brand: 'Apple', model: '', storage: '128GB', color: '', condition: 'Yenilenmiş A+', branch_name: 'Merkez Depo', purchase_price: '', sale_price: ''
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const newDevice: Device = {
      id: Date.now(),
      sku: formData.sku,
      brand: formData.brand,
      model: formData.model,
      storage: formData.storage,
      color: formData.color,
      condition: formData.condition,
      branch_name: formData.branch_name,
      purchase_price: parseFloat(formData.purchase_price) || 0,
      sale_price: parseFloat(formData.sale_price) || 0,
      status: 'available'
    };
    setDevices([newDevice, ...devices]);
    setIsModalOpen(false);
    setFormData({ sku: '', brand: 'Apple', model: '', storage: '128GB', color: '', condition: 'Yenilenmiş A+', branch_name: 'Merkez Depo', purchase_price: '', sale_price: '' });
  };

  const filteredDevices = devices.filter(d => 
    d.model.toLowerCase().includes(searchSku.toLowerCase()) || d.sku.includes(searchSku)
  );

  return (
    <div className="flex h-screen bg-[#f8fafc] text-[#334155] font-sans antialiased text-xs">
      
      {/* ================= 1. SOL SIDEBAR (KOYU PREMIUM TASARIM) ================= */}
      <aside className="w-64 bg-[#0f172a] text-[#94a3b8] flex flex-col justify-between border-r border-[#1e293b]">
        <div>
          {/* Üst Logo ve Durum */}
          <div className="flex items-center gap-3 px-6 py-5 border-b border-[#1e293b] mb-4">
            <div className="w-8 h-8 bg-[#38bdf8] rounded-xl flex items-center justify-center text-[#0f172a] font-extrabold text-sm shadow-lg shadow-sky-500/20">C</div>
            <div>
              <span className="font-bold text-sm text-white block tracking-tight">Cnetmobil</span>
              <span className="text-[10px] text-[#38bdf8] font-medium block">B2B Yönetim Paneli</span>
            </div>
          </div>

          {/* Navigasyon Linkleri */}
          <nav className="px-3 space-y-1">
            <button onClick={() => setActiveTab('anasayfa')} className={`w-full text-left px-4 py-3 rounded-xl transition-all flex items-center gap-2.5 ${activeTab === 'anasayfa' ? 'bg-[#1e293b] text-[#38bdf8] font-bold border-l-4 border-[#38bdf8]' : 'hover:bg-[#1e293b] hover:text-white'}`}>
              <span>📊</span> Anasayfa Özet
            </button>

            {/* Envanter Grubu */}
            <div className="relative group">
              <button onClick={() => setActiveTab('firsat_cihazlari')} className={`w-full text-left px-4 py-3 rounded-xl transition-all flex items-center justify-between ${activeTab === 'firsat_cihazlari' ? 'bg-[#1e293b] text-[#38bdf8] font-bold border-l-4 border-[#38bdf8]' : 'hover:bg-[#1e293b] hover:text-white'}`}>
                <div className="flex items-center gap-2.5"><span>📦</span> Envanter Yönetimi</div>
                <span className="text-[9px] opacity-40">▶</span>
              </button>
              {/* Hover Menü */}
              <div className="absolute left-full top-0 ml-1 w-52 bg-[#0f172a] border border-[#1e293b] rounded-xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-50 p-1.5 space-y-0.5">
                <button onClick={() => setActiveTab('firsat_cihazlari')} className="w-full text-left px-3 py-2 text-white bg-[#1e293b] rounded-lg font-medium">📱 Cihazlarım</button>
                <button className="w-full text-left px-3 py-2 text-[#94a3b8] hover:bg-[#1e293b] hover:text-white rounded-lg">🎧 Aksesuarlar</button>
                <button className="w-full text-left px-3 py-2 text-[#94a3b8] hover:bg-[#1e293b] hover:text-white rounded-lg">➕ Aksesuar Ekle</button>
              </div>
            </div>

            {/* Sipariş Yönetimi */}
            <div className="relative group">
              <button onClick={() => setActiveTab('siparisler')} className={`w-full text-left px-4 py-3 rounded-xl transition-all flex items-center justify-between ${activeTab === 'siparisler' ? 'bg-[#1e293b] text-[#38bdf8] font-bold' : 'hover:bg-[#1e293b] hover:text-white'}`}>
                <div className="flex items-center gap-2.5"><span>🛒</span> Sipariş Yönetimi</div>
                <span className="text-[9px] opacity-40">▶</span>
              </button>
              <div className="absolute left-full top-0 ml-1 w-52 bg-[#0f172a] border border-[#1e293b] rounded-xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-50 p-1.5 space-y-0.5">
                <button onClick={() => setActiveTab('siparisler')} className="w-full text-left px-3 py-2 text-[#94a3b8] hover:bg-[#1e293b] hover:text-white rounded-lg">📋 Siparişler</button>
                <button className="w-full text-left px-3 py-2 text-[#94a3b8] hover:bg-[#1e293b] hover:text-white rounded-lg">🏪 Mağazada Sattıklarım</button>
              </div>
            </div>

            <button onClick={() => setActiveTab('finansallar')} className={`w-full text-left px-4 py-3 rounded-xl transition-all flex items-center gap-2.5 ${activeTab === 'finansallar' ? 'bg-[#1e293b] text-[#38bdf8] font-bold' : 'hover:bg-[#1e293b] hover:text-white'}`}>
              <span>💰</span> Finansallar
            </button>
          </nav>
        </div>
        <div className="text-[10px] text-[#475569] text-center border-t border-[#1e293b] py-4 font-mono">System Live: 2026 v2.5</div>
      </aside>

      {/* ================= 2. SAĞ PANEL İÇERİK ALANI ================= */}
      <main className="flex-1 flex flex-col overflow-hidden">
        
        {/* Üst Header */}
        <header className="h-16 bg-white border-b border-[#e2e8f0] flex items-center justify-between px-8 shadow-sm z-10">
          <div className="font-bold text-sm text-[#1e293b] tracking-tight">Merkezi Entegrasyon Havuzu</div>
          <div className="flex items-center gap-3">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
            <span className="text-[#64748b] font-medium text-[11px] bg-[#f1f5f9] px-2.5 py-1 rounded-md border border-[#e2e8f0]">Ikas Sunucu Bağlantısı: Aktif</span>
          </div>
        </header>

        {/* Dinamik İçerik Alanı */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* DANDİKLİĞİ YOK EDEN ÜST İSTATİSTİK KARTLARI (Kusursuz Görünüm) */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-white border border-[#e2e8f0] rounded-xl p-4 shadow-sm relative overflow-hidden">
              <span className="text-[#64748b] font-bold text-[10px] uppercase tracking-wider block">Bugünkü Ikas Siparişi</span>
              <span className="text-xl font-extrabold text-[#0f172a] block mt-1">14 Adet</span>
              <span className="text-[10px] text-emerald-600 font-semibold mt-1 inline-block">↑ %12 düne göre artış</span>
              <div className="absolute right-3 top-4 text-2xl opacity-20">🛒</div>
            </div>
            <div className="bg-white border border-[#e2e8f0] rounded-xl p-4 shadow-sm relative overflow-hidden">
              <span className="text-[#64748b] font-bold text-[10px] uppercase tracking-wider block">Toplam Canlı Stok (IMEI)</span>
              <span className="text-xl font-extrabold text-[#0f172a] block mt-1">{devices.length} Cihaz</span>
              <span className="text-[10px] text-[#64748b] font-medium mt-1 inline-block">8 aktif şube toplamı</span>
              <div className="absolute right-3 top-4 text-2xl opacity-20">📱</div>
            </div>
            <div className="bg-white border border-[#e2e8f0] rounded-xl p-4 shadow-sm relative overflow-hidden">
              <span className="text-[#64748b] font-bold text-[10px] uppercase tracking-wider block">Anlık Brüt Ciro</span>
              <span className="text-xl font-extrabold text-emerald-600 block mt-1">117,400 TL</span>
              <span className="text-[10px] text-[#64748b] font-medium mt-1 inline-block">Online + Şube satışları</span>
              <div className="absolute right-3 top-4 text-2xl opacity-20">💰</div>
            </div>
            <div className="bg-white border border-[#e2e8f0] rounded-xl p-4 shadow-sm relative overflow-hidden">
              <span className="text-[#64748b] font-bold text-[10px] uppercase tracking-wider block">Bekleyen İade / Talep</span>
              <span className="text-xl font-extrabold text-amber-600 block mt-1">2 Talep</span>
              <span className="text-[10px] text-amber-600 font-semibold mt-1 inline-block">Aksiyon bekleniyor</span>
              <div className="absolute right-3 top-4 text-2xl opacity-20">🔄</div>
            </div>
          </div>

          {/* CİHAZLARIM SEKMESİ SEÇİLİYSE */}
          {activeTab === 'firsat_cihazlari' && (
            <div className="space-y-4">
              
              {/* GÖNDERDİĞİNİZ 4. GÖRSELDEKİ ÖZEL FİLTRE VE YEŞİL BUTON BARBARI */}
              <div className="bg-white border border-[#e2e8f0] rounded-xl p-4 shadow-sm space-y-4">
                <div className="flex items-center justify-between gap-4">
                  
                  {/* Arama Kutusu */}
                  <div className="flex items-center bg-white border border-[#cbd5e1] rounded-lg overflow-hidden w-80 shadow-sm focus-within:border-[#38bdf8] transition-all">
                    <select className="bg-[#f8fafc] border-r border-[#cbd5e1] px-3 py-2 font-bold text-[#475569] outline-none cursor-pointer">
                      <option>SKU</option>
                      <option>IMEI</option>
                    </select>
                    <input 
                      type="text" 
                      placeholder="Model veya SKU yazıp canlı filtreleyin..." 
                      className="px-3 py-2 outline-none w-full text-xs placeholder-[#94a3b8]" 
                      value={searchSku}
                      onChange={(e) => setSearchSku(e.target.value)}
                    />
                  </div>

                  {/* Yüklediğiniz Görseldeki Tam Yeşil Aksiyon Butonları */}
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setIsModalOpen(true)}
                      className="bg-[#22c55e] hover:bg-[#16a34a] text-white font-extrabold px-4 py-2.5 rounded-lg shadow-sm shadow-green-500/10 transition-all active:scale-95"
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

                {/* Filtre Rozetleri Satırı */}
                <div className="border-t border-[#f1f5f9] pt-3 flex items-center justify-between">
                  <div className="flex items-center gap-4 text-[#64748b] font-bold text-[11px]">
                    <div className="cursor-pointer hover:text-[#0f172a]">Ürün Grubu <span className="inline-flex items-center justify-center bg-[#ffedd5] text-[#ea580c] w-4 h-4 rounded-full text-[9px] font-extrabold ml-0.5">0</span></div>
                    <div className="cursor-pointer hover:text-[#0f172a]">Marka <span className="inline-flex items-center justify-center bg-[#ffedd5] text-[#ea580c] w-4 h-4 rounded-full text-[9px] font-extrabold ml-0.5">0</span></div>
                    <div className="cursor-pointer hover:text-[#0f172a]">Model <span className="inline-flex items-center justify-center bg-[#ffedd5] text-[#ea580c] w-4 h-4 rounded-full text-[9px] font-extrabold ml-0.5">0</span></div>
                    <div className="cursor-pointer hover:text-[#0f172a]">Kozmetik Durum <span className="inline-flex items-center justify-center bg-[#ffedd5] text-[#ea580c] w-4 h-4 rounded-full text-[9px] font-extrabold ml-0.5">0</span></div>
                    <div className="cursor-pointer hover:text-[#0f172a]">Buybox Kazanım <span className="inline-flex items-center justify-center bg-[#ffedd5] text-[#ea580c] w-4 h-4 rounded-full text-[9px] font-extrabold ml-0.5">0</span></div>
                    <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-[#334155]">
                      <input type="checkbox" className="rounded border-[#cbd5e1] text-[#38bdf8] focus:ring-0 w-3.5 h-3.5" /> Stoğu Azalanlar
                    </label>
                  </div>
                  
                  {searchSku && (
                    <button onClick={() => setSearchSku('')} className="text-[#ef4444] font-extrabold hover:underline text-[11px]">
                      Filtreleri Temizle ↻
                    </button>
                  )}
                </div>
              </div>

              {/* GÖRKEMLİ CİHAZ LİSTELEME TABLOSU */}
              <div className="bg-white border border-[#e2e8f0] rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-[#f8fafc] border-b border-[#e2e8f0] text-[10px] font-bold text-[#64748b] uppercase tracking-wider">
                    <tr>
                      <th className="p-4">Cihaz Tanımı</th>
                      <th className="p-4">IMEI / SKU</th>
                      <th className="p-4">Kondisyon</th>
                      <th className="p-4">Bulunduğu Yer</th>
                      <th className="p-4">Maliyet (Alış)</th>
                      <th className="p-4">Satış Fiyatı</th>
                      <th className="p-4">Ikas Canlı Durum</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f1f5f9] text-[#334155] font-medium">
                    {filteredDevices.map((device) => (
                      <tr key={device.id} className="hover:bg-[#f8fafc]/90 transition-all duration-100">
                        <td className="p-4 font-bold text-[#0f172a] text-sm">
                          {device.brand} {device.model} 
                          <span className="text-[#94a3b8] font-normal text-xs ml-1.5">({device.storage} / {device.color})</span>
                        </td>
                        <td className="p-4 font-mono text-[#64748b] tracking-tight">{device.sku}</td>
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
                            Ikas Mağazada Canlıda
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* ================= 3. MODAL (CİHAZ GİRİŞİ YAPINCA POP-UP AÇILIR) ================= */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-[#0f172a]/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-[#e2e8f0] overflow-hidden animate-in fade-in zoom-in-95 duration-100">
            <div className="px-5 py-4 bg-[#f8fafc] border-b border-[#e2e8f0] flex justify-between items-center">
              <h3 className="font-bold text-[#0f172a] text-sm tracking-tight">Yeni Stok Tanımla & Sitede Yayınla</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-[#94a3b8] hover:text-[#334155] font-bold text-sm">✕</button>
            </div>
            <form onSubmit={handleFormSubmit} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-[#475569] mb-1">IMEI Numarası (Unique SKU)</label>
                <input type="text" name="sku" maxLength={15} required className="w-full bg-[#f8fafc] border border-[#cbd5e1] rounded-xl p-2.5 outline-none focus:border-[#38bdf8] font-mono text-sm shadow-inner" placeholder="15 haneli benzersiz numarayı girin" value={formData.sku} onChange={handleInputChange} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#475569] mb-1">Marka</label>
                  <select name="brand" className="w-full bg-[#f8fafc] border border-[#cbd5e1] rounded-xl p-2.5 outline-none text-[#334155] font-semibold" value={formData.brand} onChange={handleInputChange}>
                    <option value="Apple">Apple</option>
                    <option value="Samsung">Samsung</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-[#475569] mb-1">Model Tanımı</label>
                  <input type="text" name="model" required className="w-full bg-[#f8fafc] border border-[#cbd5e1] rounded-xl p-2.5 outline-none" placeholder="örn: iPhone 14 Pro Max" value={formData.model} onChange={handleInputChange} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#475569] mb-1">Maliyet (Alış)</label>
                  <input type="number" name="purchase_price" required className="w-full bg-[#f8fafc] border border-[#cbd5e1] rounded-xl p-2.5 outline-none font-mono" placeholder="0.00 TL" value={formData.purchase_price} onChange={handleInputChange} />
                </div>
                <div>
                  <label className="block font-bold text-[#475569] mb-1">Sitedeki Satış Fiyatı</label>
                  <input type="number" name="sale_price" required className="w-full bg-[#f8fafc] border border-[#cbd5e1] rounded-xl p-2.5 outline-none font-bold text-emerald-600 shadow-sm" placeholder="0.00 TL" value={formData.sale_price} onChange={handleInputChange} />
                </div>
              </div>
              <div className="pt-4 border-t border-[#f1f5f9] flex justify-end gap-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="bg-[#f1f5f9] text-[#475569] font-bold px-4 py-2.5 rounded-xl hover:bg-[#e2e8f0]">İptal</button>
                <button type="submit" className="bg-[#22c55e] hover:bg-[#16a34a] text-white font-bold px-4 py-2.5 rounded-xl shadow-md">Kaydet ve Ikas'a Fırlat</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
