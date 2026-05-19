'use client';

import React, { useState } from 'react';

// TypeScript Veri Tipleri (Güvenli Stok Yapısı İçin)
interface Device {
  id: number;
  sku: string;
  brand: string;
  model: string;
  storage: string;
  color: string;
  condition: string;
  branch_name: string;
  sale_price: number;
  status: 'available' | 'sold';
}

export default function PartnerDashboard() {
  // Aktif Sekme Yönetimi
  const [activeTab, setActiveTab] = useState<'anasayfa' | 'firsat_cihazlari' | 'siparisler' | 'finansallar'>('firsat_cihazlari');
  
  // Modal Pop-up ve Arama State'leri
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [searchSku, setSearchSku] = useState<string>('');

  // Örnek Başlangıç Verileri (Görsel Test İçin)
  const [devices, setDevices] = useState<Device[]>([
    {
      id: 1,
      sku: '358921104857211',
      brand: 'Apple',
      model: 'iPhone 13 Pro Max',
      storage: '256GB',
      color: 'Sierra Blue',
      condition: 'Yenilenmiş A+',
      branch_name: 'Kadıköy Şube',
      sale_price: 42500,
      status: 'available'
    }
  ]);

  // Cihaz Ekleme Form State'i
  const [formData, setFormData] = useState({
    sku: '', brand: 'Apple', model: '', storage: '128GB', color: '',
    condition: 'Yenilenmiş A+', branch_name: 'Merkez Depo', sale_price: ''
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
      sale_price: parseFloat(formData.sale_price) || 0,
      status: 'available'
    };
    setDevices([newDevice, ...devices]);
    setIsModalOpen(false);
    setFormData({ sku: '', brand: 'Apple', model: '', storage: '128GB', color: '', condition: 'Yenilenmiş A+', branch_name: 'Merkez Depo', sale_price: '' });
  };

  // SKU veya Model Filtreleme Mantığı
  const filteredDevices = devices.filter(d => 
    d.model.toLowerCase().includes(searchSku.toLowerCase()) || d.sku.includes(searchSku)
  );

  return (
    <div className="flex h-screen bg-[#f3f4f6] text-[#374151] font-sans antialiased text-xs">
      
      {/* ================= 1. SOL SIDEBAR (ÜSTÜNE GELİNCE AÇILAN GRUPLAR) ================= */}
      <aside className="w-64 bg-[#1f2937] text-[#d1d5db] flex flex-col justify-between border-r border-[#374151]">
        <div>
          {/* Logo */}
          <div className="flex items-center gap-3 px-6 py-5 border-b border-[#374151] mb-4">
            <div className="w-8 h-8 bg-[#0284c7] rounded-xl flex items-center justify-center text-white font-extrabold text-sm shadow-md">C</div>
            <span className="font-bold text-base text-white tracking-tight">Cnetmobil Partner</span>
          </div>

          {/* Navigasyon Linkleri */}
          <nav className="px-3 space-y-1">
            {/* Anasayfa */}
            <button 
              onClick={() => setActiveTab('anasayfa')}
              className={`w-full text-left px-4 py-3 rounded-xl transition-all ${activeTab === 'anasayfa' ? 'bg-[#0284c7] text-white font-bold shadow-md' : 'hover:bg-[#374151] hover:text-white'}`}
            >
              🏠 Anasayfa
            </button>

            {/* Envanter Grubu (Hover Yapınca Sağa Menü Fırlayan Yapı) */}
            <div className="relative group">
              <button 
                onClick={() => setActiveTab('firsat_cihazlari')}
                className={`w-full text-left px-4 py-3 rounded-xl transition-all flex items-center justify-between ${activeTab === 'firsat_cihazlari' ? 'bg-[#0284c7] text-white font-bold shadow-md' : 'hover:bg-[#374151] hover:text-white'}`}
              >
                <span>📦 Enventory / Envanter</span>
                <span className="text-[10px] opacity-50">▲</span>
              </button>
              {/* Hover Menü */}
              <div className="absolute left-full top-0 ml-1 w-52 bg-[#1f2937] border border-[#374151] rounded-xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-50 p-1.5 space-y-0.5">
                <div className="px-3 py-1 text-[10px] uppercase font-bold text-[#9ca3af] tracking-wider border-b border-[#374151] mb-1">Fırsat Cihazları</div>
                <button onClick={() => setActiveTab('firsat_cihazlari')} className="w-full text-left px-3 py-2 text-[#e5e7eb] hover:bg-[#374151] hover:text-[#38bdf8] rounded-lg">📱 Cihazlarım</button>
                <button className="w-full text-left px-3 py-2 text-[#e5e7eb] hover:bg-[#374151] rounded-lg opacity-50 cursor-not-allowed">🎧 Aksesuarlar</button>
                <button className="w-full text-left px-3 py-2 text-[#e5e7eb] hover:bg-[#374151] rounded-lg opacity-50 cursor-not-allowed">➕ Aksesuar Ekle</button>
              </div>
            </div>

            {/* Sipariş Yönetimi Grubu */}
            <div className="relative group">
              <button 
                onClick={() => setActiveTab('siparisler')}
                className={`w-full text-left px-4 py-3 rounded-xl transition-all flex items-center justify-between ${activeTab === 'siparisler' ? 'bg-[#0284c7] text-white font-bold shadow-md' : 'hover:bg-[#374151] hover:text-white'}`}
              >
                <span>🛒 Sipariş Yönetimi</span>
                <span className="text-[10px] opacity-50">▲</span>
              </button>
              {/* Hover Menü */}
              <div className="absolute left-full top-0 ml-1 w-52 bg-[#1f2937] border border-[#374151] rounded-xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-50 p-1.5 space-y-0.5">
                <button onClick={() => setActiveTab('siparisler')} className="w-full text-left px-3 py-2 text-[#e5e7eb] hover:bg-[#374151] hover:text-[#38bdf8] rounded-lg">📋 Siparişler</button>
                <button className="w-full text-left px-3 py-2 text-[#e5e7eb] hover:bg-[#374151] rounded-lg opacity-50">🏪 Mağazada Sattıklarım</button>
                <button className="w-full text-left px-3 py-2 text-[#e5e7eb] hover:bg-[#374151] rounded-lg opacity-50">📥 Aldıklarım</button>
                <button className="w-full text-left px-3 py-2 text-[#e5e7eb] hover:bg-[#374151] rounded-lg opacity-50">🔄 İade Yönetimi</button>
              </div>
            </div>

            {/* Finansallar Grubu */}
            <div className="relative group">
              <button 
                onClick={() => setActiveTab('finansallar')}
                className={`w-full text-left px-4 py-3 rounded-xl transition-all flex items-center justify-between ${activeTab === 'finansallar' ? 'bg-[#0284c7] text-white font-bold shadow-md' : 'hover:bg-[#374151] hover:text-white'}`}
              >
                <span>💰 Finansallar</span>
                <span className="text-[10px] opacity-50">▲</span>
              </button>
              {/* Hover Menü */}
              <div className="absolute left-full top-0 ml-1 w-52 bg-[#1f2937] border border-[#374151] rounded-xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-50 p-1.5 space-y-0.5">
                <button onClick={() => setActiveTab('finansallar')} className="w-full text-left px-3 py-2 text-[#e5e7eb] hover:bg-[#374151] hover:text-[#38bdf8] rounded-lg">💳 Hakediş</button>
                <button className="w-full text-left px-3 py-2 text-[#e5e7eb] hover:bg-[#374151] rounded-lg opacity-50">🧾 Faturalar</button>
              </div>
            </div>
          </nav>
        </div>
        <div className="text-[10px] text-[#6b7280] text-center border-t border-[#374151] py-4">Cnetmobil Partner OS v2.5</div>
      </aside>

      {/* ================= 2. SAĞ PANEL (GÖNDERDİĞİNİZ AKSİYON VE FİLTRE BAR BARBARI) ================= */}
      <main className="flex-1 flex flex-col overflow-hidden">
        
        {/* Üst Header */}
        <header className="h-16 bg-white border-b border-[#e5e7eb] flex items-center justify-between px-8 shadow-sm">
          <div className="font-bold text-sm text-[#111827]">Yönetici Dashboard Paneli</div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-[#e5e7eb] flex items-center justify-center font-bold text-[#4b5563]">A</div>
            <span className="font-bold text-[#1f2937]">Merkez</span>
          </div>
        </header>

        {/* Dinamik İçerik Alanı */}
        <div className="flex-1 overflow-y-auto p-6">
          
          {activeTab === 'firsat_cihazlari' && (
            <div className="space-y-4">
              
              {/* GÖNDERDİĞİNİZ 4. GÖRSELDEKİ ÖZEL AKSİYON VE FİLTRE PANELİ BARBARI */}
              <div className="bg-white border border-[#e5e7eb] rounded-xl p-4 shadow-sm space-y-4">
                
                {/* Üst Satır: Arama ve Yeşil Cihaz Ekleme Buton Grubu */}
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center bg-white border border-[#d1d5db] rounded-lg overflow-hidden w-80 shadow-inner">
                    <select className="bg-[#f9fafb] border-r border-[#d1d5db] px-3 py-2 font-semibold text-[#4b5563] outline-none">
                      <option>SKU</option>
                      <option>IMEI</option>
                    </select>
                    <input 
                      type="text" 
                      placeholder="Yazınız..." 
                      className="px-3 py-2 outline-none w-full text-xs" 
                      value={searchSku}
                      onChange={(e) => setSearchSku(e.target.value)}
                    />
                  </div>

                  {/* Tam İstediğiniz Yeşil Renkli Butonlar */}
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setIsModalOpen(true)}
                      className="bg-[#22c55e] hover:bg-[#16a34a] text-white font-bold px-4 py-2.5 rounded-lg shadow-sm transition-all"
                    >
                      + Cihaz Ekle
                    </button>
                    <button className="bg-white border border-[#d1d5db] text-[#374151] font-semibold px-4 py-2.5 rounded-lg hover:bg-[#f9fafb]">
                      Toplu Cep Telefonu Ekle
                    </button>
                    <button className="bg-white border border-[#d1d5db] text-[#374151] font-semibold px-4 py-2.5 rounded-lg hover:bg-[#f9fafb]">
                      Aksiyonlar
                    </button>
                  </div>
                </div>

                {/* Alt Satır: Filtre Dropdown Kutucukları */}
                <div className="border-t border-[#f3f4f6] pt-3 flex items-center justify-between">
                  <div className="flex items-center gap-4 text-[#4b5563] font-medium">
                    <div>Ürün Grubu <span className="inline-flex items-center justify-center bg-[#ffedd5] text-[#ea580c] w-4 h-4 rounded-full text-[9px] font-bold ml-1">0</span></div>
                    <div>Marka <span className="inline-flex items-center justify-center bg-[#ffedd5] text-[#ea580c] w-4 h-4 rounded-full text-[9px] font-bold ml-1">0</span></div>
                    <div>Model <span className="inline-flex items-center justify-center bg-[#ffedd5] text-[#ea580c] w-4 h-4 rounded-full text-[9px] font-bold ml-1">0</span></div>
                    <div>Kozmetik Durum <span className="inline-flex items-center justify-center bg-[#ffedd5] text-[#ea580c] w-4 h-4 rounded-full text-[9px] font-bold ml-1">0</span></div>
                    <div>Buybox Kazanım Durumu <span className="inline-flex items-center justify-center bg-[#ffedd5] text-[#ea580c] w-4 h-4 rounded-full text-[9px] font-bold ml-1">0</span></div>
                    <label className="flex items-center gap-1.5 cursor-pointer font-normal">
                      <input type="checkbox" className="rounded text-[#0284c7] focus:ring-0 w-3.5 h-3.5 border-[#d1d5db]" /> Stoğu Azalanlar
                    </label>
                  </div>
                  
                  {searchSku && (
                    <button onClick={() => setSearchSku('')} className="text-[#ef4444] font-bold hover:underline">
                      Filtreleri Temizle ↻
                    </button>
                  )}
                </div>
              </div>

              {/* ANA TABLO LİSTESİ */}
              <div className="bg-white border border-[#e5e7eb] rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-[#f9fafb] border-b border-[#e5e7eb] text-[10px] font-bold text-[#6b7280] uppercase tracking-wider">
                    <tr>
                      <th className="p-3.5">Cihaz / Model Tanımı</th>
                      <th className="p-3.5">IMEI / SKU</th>
                      <th className="p-3.5">Kondisyon Seviyesi</th>
                      <th className="p-3.5">Mevcut Şube</th>
                      <th className="p-3.5">Belirlenen Fiyat</th>
                      <th className="p-3.5">Ikas Entegrasyon Durumu</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f3f4f6] text-[#4b5563]">
                    {filteredDevices.map((device) => (
                      <tr key={device.id} className="hover:bg-[#f9fafb]/80 transition-all">
                        <td className="p-3.5 font-bold text-[#111827]">{device.brand} {device.model} <span className="text-[#9ca3af] font-normal">({device.storage} / {device.color})</span></td>
                        <td className="p-3.5 font-mono text-[#6b7280]">{device.sku}</td>
                        <td className="p-3.5"><span className="bg-[#ecfdf5] text-[#065f46] font-bold px-2 py-0.5 rounded text-[10px]">{device.condition}</span></td>
                        <td className="p-3.5 font-semibold">{device.branch_name}</td>
                        <td className="p-3.5 font-extrabold text-[#111827]">{device.sale_price.toLocaleString('tr-TR')} TL</td>
                        <td className="p-3.5">
                          <span className={`font-bold px-2.5 py-0.5 rounded-full text-[10px] ${device.status === 'available' ? 'bg-[#e0f2fe] text-[#0369a1]' : 'bg-[#f3f4f6] text-[#6b7280]'}`}>
                            {device.status === 'available' ? 'Online Sitede Canlıda' : 'Satıldı / Gizli'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Diğer Boş Sekme Yapıları */}
          {activeTab === 'anasayfa' && <div className="bg-white p-6 rounded-xl border text-[#6b7280]">Cnetmobil genel ciro istatistikleri ve şube kârlılık grafikleri.</div>}
          {activeTab === 'siparisler' && <div className="bg-white p-6 rounded-xl border text-[#6b7280]">Online ikas sitenizden düşen siparişlerin canlı paneli.</div>}
          {activeTab === 'finansallar' && <div className="bg-white p-6 rounded-xl border text-[#6b7280]">Şubelerin hakediş ve faturalandırma geçmişi ekranı.</div>}

        </div>
      </main>

      {/* ================= 3. POP-UP VERİ GİRİŞ FORMU (MODAL) ================= */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-[#111827]/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-[#e5e7eb] overflow-hidden">
            <div className="px-5 py-4 bg-[#f9fafb] border-b border-[#e5e7eb] flex justify-between items-center">
              <h3 className="font-bold text-[#111827] text-sm">Yeni Telefon Stok Girişi</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-[#9ca3af] hover:text-[#4b5563] font-bold text-sm">✕</button>
            </div>
            <form onSubmit={handleFormSubmit} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-[#374151] mb-1">IMEI Numarası (Unique SKU)</label>
                <input type="text" name="sku" maxLength={15} required className="w-full bg-[#f9fafb] border border-[#d1d5db] rounded-xl p-2.5 outline-none focus:border-[#0284c7] font-mono text-sm" placeholder="15 haneli IMEI numarasını yazın" value={formData.sku} onChange={handleInputChange} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#374151] mb-1">Marka</label>
                  <select name="brand" className="w-full bg-[#f9fafb] border border-[#d1d5db] rounded-xl p-2.5 outline-none text-[#4b5563]" value={formData.brand} onChange={handleInputChange}>
                    <option value="Apple">Apple</option>
                    <option value="Samsung">Samsung</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-[#374151] mb-1">Model</label>
                  <input type="text" name="model" required className="w-full bg-[#f9fafb] border border-[#d1d5db] rounded-xl p-2.5 outline-none" placeholder="örn: iPhone 14 Pro" value={formData.model} onChange={handleInputChange} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#374151] mb-1">Kondisyon</label>
                  <select name="condition" className="w-full bg-[#f9fafb] border border-[#d1d5db] rounded-xl p-2.5 outline-none text-[#4b5563]" value={formData.condition} onChange={handleInputChange}>
                    <option value="Yenilenmiş A+">Yenilenmiş A+</option>
                    <option value="A Kalite">A Kalite</option>
                    <option value="B Kalite">B Kalite</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-[#374151] mb-1">Fiyat (TL)</label>
                  <input type="number" name="sale_price" required className="w-full bg-[#f9fafb] border border-[#d1d5db] rounded-xl p-2.5 outline-none font-bold" placeholder="0.00" value={formData.sale_price} onChange={handleInputChange} />
                </div>
              </div>
              <div className="pt-4 border-t border-[#f3f4f6] flex justify-end gap-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="bg-[#f3f4f6] text-[#4b5563] font-bold px-4 py-2.5 rounded-xl">İptal</button>
                <button type="submit" className="bg-[#22c55e] text-white font-bold px-4 py-2.5 rounded-xl shadow-sm">Arayüze Stok Ekle</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
