'use client';

import React, { useState } from 'react';
// Material Tailwind bileşenlerini çağırıyoruz
import {
  Card,
  CardHeader,
  CardBody,
  Typography,
  Button,
  Input,
  Select,
  Option,
  Dialog,
  DialogHeader,
  DialogBody,
  DialogFooter,
} from "@material-tailwind/react";

// Türk Perakende Sektörüne Uygun Veri Tipleri
interface Cihaz {
  id: number;
  sku: string; // IMEI numarası
  marka: string;
  model: string;
  hafiza: string;
  renk: string;
  kondisyon: string;
  sube_adi: string;
  alis_fiyati: number;
  satis_fiyati: number;
  durum: 'satis_bekliyor' | 'satildi';
}

export default function CnetmobilMaterialDashboard() {
  const [activeTab, setActiveTab] = useState('envanter');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [aramaKelimesi, setAramaKelimesi] = useState('');

  // Ikas Sitenizden Otomatik Gelecek Olan Telefon Modelleri
  const [ikasModelleri] = useState([
    { id: "ikas_1", marka: "Apple", model: "iPhone 14 Pro Max", hafiza: "256GB" },
    { id: "ikas_2", marka: "Apple", model: "iPhone 13", hafiza: "128GB" },
    { id: "ikas_3", marka: "Samsung", model: "Galaxy S23 Ultra", hafiza: "512GB" }
  ]);

  // Şubelerinizdeki Canlı Stok Listesi
  const [cihazlar, setCihazlar] = useState<Cihaz[]>([
    { id: 1, sku: '358921104857211', marka: 'Apple', model: 'iPhone 14 Pro Max', hafiza: '256GB', renk: 'Derin Mor', kondisyon: 'Yenilenmiş A+', sube_adi: 'Kadıköy Şube', alis_fiyati: 32000, satis_fiyati: 48500, durum: 'satis_bekliyor' },
    { id: 2, sku: '357412209481125', marka: 'Apple', model: 'iPhone 13', hafiza: '128GB', renk: 'Yıldız Işığı', kondisyon: 'A Kalite', sube_adi: 'Beşiktaş Şube', alis_fiyati: 21000, satis_fiyati: 29900, durum: 'satis_bekliyor' }
  ]);

  const [formData, setFormData] = useState({
    sku: '', marka: '', model: '', hafiza: '', renk: '', kondisyon: 'Yenilenmiş A+', sube_adi: 'Merkez Depo', alis_fiyati: '', satis_fiyati: '', ikas_id: ''
  });

  // Ikas'tan model seçildiğinde diğer alanları otomatik dolduran akıllı sistem
  const handleModelSecim = (value: string | undefined) => {
    const secilen = ikasModelleri.find(m => m.id === value);
    if (secilen) {
      setFormData(prev => ({ ...prev, ikas_id: value || '', marka: secilen.marka, model: secilen.model, hafiza: secilen.hafiza }));
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const yeniCihaz: Cihaz = {
      id: Date.now(),
      sku: formData.sku,
      marka: formData.marka,
      model: formData.model,
      hafiza: formData.hafiza,
      renk: formData.renk,
      kondisyon: formData.kondisyon,
      sube_adi: formData.sube_adi,
      alis_fiyati: parseFloat(formData.alis_fiyati) || 0,
      satis_fiyati: parseFloat(formData.satis_fiyati) || 0,
      durum: 'satis_bekliyor'
    };

    setCihazlar([yengiCihaz, ...cihazlar]);
    setIsModalOpen(false);
    setFormData({ sku: '', marka: '', model: '', hafiza: '', renk: '', kondisyon: 'Yenilenmiş A+', sube_adi: 'Merkez Depo', alis_fiyati: '', satis_fiyati: '', ikas_id: '' });
  };

  const filtrelenmişCihazlar = cihazlar.filter(c => 
    c.model.toLowerCase().includes(aramaKelimesi.toLowerCase()) || c.sku.includes(aramaKelimesi)
  );

  return (
    <div className="flex h-screen bg-[#f8fafc] text-[#334155] font-sans text-xs">
      
      {/* ================= 1. TÜRKÇE SOL SIDEBAR MENÜ ================= */}
      <aside className="w-64 bg-[#0f172a] p-4 flex flex-col justify-between border-r border-[#1e293b]">
        <div>
          <div className="flex items-center gap-3 px-2 py-4 border-b border-[#1e293b] mb-6">
            <div className="w-8 h-8 bg-sky-500 rounded-xl flex items-center justify-center text-white font-black text-sm shadow-md shadow-sky-500/20">C</div>
            <div>
              <span className="font-bold text-sm text-white block">Cnetmobil</span>
              <span className="text-[10px] text-sky-400 font-bold block">Partner Entegrasyon</span>
            </div>
          </div>

          <nav className="space-y-1">
            <button onClick={() => setActiveTab('anasayfa')} className={`w-full text-left px-4 py-3 rounded-xl flex items-center gap-2.5 font-bold transition-all ${activeTab === 'anasayfa' ? 'bg-[#1e293b] text-sky-400' : 'text-[#94a3b8] hover:bg-[#1e293b] hover:text-white'}`}>📊 Anasayfa Özet</button>
            <button onClick={() => setActiveTab('envanter')} className={`w-full text-left px-4 py-3 rounded-xl flex items-center gap-2.5 font-bold transition-all ${activeTab === 'envanter' ? 'bg-[#1e293b] text-sky-400' : 'text-[#94a3b8] hover:bg-[#1e293b] hover:text-white'}`}>📦 Fırsat Cihazları</button>
            <button onClick={() => setActiveTab('siparisler')} className={`w-full text-left px-4 py-3 rounded-xl flex items-center gap-2.5 font-bold transition-all ${activeTab === 'siparisler' ? 'bg-[#1e293b] text-sky-400' : 'text-[#94a3b8] hover:bg-[#1e293b] hover:text-white'}`}>🛒 Sipariş Yönetimi</button>
            <button onClick={() => setActiveTab('finansallar')} className={`w-full text-left px-4 py-3 rounded-xl flex items-center gap-2.5 font-bold transition-all ${activeTab === 'finansallar' ? 'bg-[#1e293b] text-sky-400' : 'text-[#94a3b8] hover:bg-[#1e293b] hover:text-white'}`}>💰 Finansallar</button>
          </nav>
        </div>
        <div className="text-[10px] text-[#475569] text-center border-t border-[#1e293b] pt-4 font-mono">partner.cnetmobil.com.tr</div>
      </aside>

      {/* ================= 2. SAĞ İÇERİK ALANI ================= */}
      <main className="flex-1 flex flex-col overflow-hidden">
        
        {/* Üst Bar */}
        <header className="h-16 bg-white border-b border-[#e2e8f0] flex items-center justify-between px-8 shadow-sm">
          <Typography variant="small" className="font-bold text-[#0f172a]">Cnetmobil Merkez Otomasyon Havuzu</Typography>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
            <span className="text-[#64748b] font-bold text-[10px] bg-[#f1f5f9] px-2.5 py-1 rounded-md border border-[#e2e8f0]">Ikas Türkiye Bağlantısı: Canlı</span>
          </div>
        </header>

        {/* Dinamik Alan */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* TÜRK LİRASI BAZLI PREMIUM İSTATİSTİK KARTLARI */}
          <div className="grid grid-cols-4 gap-4">
            <Card className="border border-[#e2e8f0] shadow-sm">
              <CardBody className="p-4">
                <Typography className="text-[#64748b] font-bold text-[10px] uppercase tracking-wider">Bugünkü Ikas Siparişi</Typography>
                <Typography className="text-xl font-black text-[#0f172a] mt-1">12 Adet</Typography>
              </CardBody>
            </Card>
            <Card className="border border-[#e2e8f0] shadow-sm">
              <CardBody className="p-4">
                <Typography className="text-[#64748b] font-bold text-[10px] uppercase tracking-wider">Havuzdaki Toplam IMEI</Typography>
                <Typography className="text-xl font-black text-[#0f172a] mt-1">{cihazlar.length} Cihaz</Typography>
              </CardBody>
            </Card>
            <Card className="border border-[#e2e8f0] shadow-sm">
              <CardBody className="p-4">
                <Typography className="text-[#64748b] font-bold text-[10px] uppercase tracking-wider">Anlık Toplam Ciro</Typography>
                <Typography className="text-xl font-black text-emerald-600 mt-1">94.800 TL</Typography>
              </CardBody>
            </Card>
            <Card className="border border-[#e2e8f0] shadow-sm">
              <CardBody className="p-4">
                <Typography className="text-[#64748b] font-bold text-[10px] uppercase tracking-wider">Bekleyen Parça Talebi</Typography>
                <Typography className="text-xl font-black text-amber-600 mt-1">3 Adet</Typography>
              </CardBody>
            </Card>
          </div>

          {/* FIRSAT CİHAZLARI / ENVANTER SEKMESİ */}
          {activeTab === 'envanter' && (
            <div className="space-y-4">
              
              {/* TÜRKÇE FİLTRE VE YEŞİL AKSİYON BUTON BARBARI */}
              <div className="bg-white border border-[#e2e8f0] rounded-xl p-4 shadow-sm flex items-center justify-between gap-4">
                <div className="w-80">
                  <Input 
                    type="text" 
                    label="IMEI veya Model adına göre canlı süzün..." 
                    className="text-xs"
                    value={aramaKelimesi}
                    onChange={(e) => setAramaKelimesi(e.target.value)}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Button 
                    color="green" 
                    size="sm" 
                    className="font-black tracking-wide rounded-lg normal-case"
                    onClick={() => setIsModalOpen(true)}
                  >
                    + Cihaz Ekle
                  </Button>
                  <Button variant="outlined" color="blue-gray" size="sm" className="font-bold rounded-lg normal-case bg-white">Toplu Telefon Ekle</Button>
                  <Button variant="outlined" color="blue-gray" size="sm" className="font-bold rounded-lg normal-case bg-white">Aksiyonlar</Button>
                </div>
              </div>

              {/* MATERIAL PREMIUM STOK TABLOSU */}
              <Card className="h-full w-full border border-[#e2e8f0] shadow-sm overflow-hidden">
                <table className="w-full min-w-max table-auto text-left">
                  <thead>
                    <tr className="bg-[#f8fafc] border-b border-[#e2e8f0]">
                      <th className="p-4 text-[10px] font-bold uppercase text-[#64748b]">Cihaz / Model Tanımı</th>
                      <th className="p-4 text-[10px] font-bold uppercase text-[#64748b]">IMEI Numarası (SKU)</th>
                      <th className="p-4 text-[10px] font-bold uppercase text-[#64748b]">Kondisyon</th>
                      <th className="p-4 text-[10px] font-bold uppercase text-[#64748b]">Bulunduğu Lokasyon</th>
                      <th className="p-4 text-[10px] font-bold uppercase text-[#64748b]">Maliyet (Alış)</th>
                      <th className="p-4 text-[10px] font-bold uppercase text-[#64748b]">Sitedeki Satış Fiyatı</th>
                      <th className="p-4 text-[10px] font-bold uppercase text-[#64748b]">Ikas Durumu</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f1f5f9] text-[#334155] font-medium">
                    {filtrelenmişCihazlar.map((cihaz) => (
                      <tr key={cihaz.id} className="hover:bg-[#f8fafc]/90 transition-all">
                        <td className="p-4 font-bold text-[#0f172a] text-sm">{cihaz.marka} {cihaz.model} <span className="text-[#94a3b8] font-normal text-xs ml-1">({cihaz.hafiza} / {cihaz.renk})</span></td>
                        <td className="p-4 font-mono text-[#64748b]">{cihaz.sku}</td>
                        <td className="p-4"><span className="bg-[#f0fdf4] text-[#166534] font-extrabold px-2 py-0.5 rounded border border-[#bbf7d0] text-[10px]">{cihaz.kondisyon}</span></td>
                        <td className="p-4 font-semibold text-[#475569]">{cihaz.sube_adi}</td>
                        <td className="p-4 font-mono text-[#94a3b8]">{cihaz.alis_fiyati.toLocaleString('tr-TR')} TL</td>
                        <td className="p-4 font-black text-[#0f172a] text-sm">{cihaz.satis_fiyati.toLocaleString('tr-TR')} TL</td>
                        <td className="p-4"><span className="bg-[#e0f2fe] text-[#0369a1] font-bold px-2.5 py-0.5 rounded-full text-[10px] border border-[#bae6fd]">● Ikas Sitesinde Canlıda</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </div>
          )}

        </div>
      </main>

      {/* ================= 3. MATERIAL POP-UP FORUM PANELİ ================= */}
      <Dialog open={isModalOpen} handler={() => setIsModalOpen(false)} size="xs" className="rounded-2xl">
        <DialogHeader className="text-sm font-bold border-b text-[#0f172a]">Ikas Sitenize Tek Tıkla Cihaz Gönderin</DialogHeader>
        <DialogBody className="space-y-4">
          
          <div>
            <label className="block text-[11px] font-bold text-[#475569] mb-1">1. Sitedeki Telefon Modelini Seçin</label>
            <select className="w-full bg-[#f8fafc] border border-[#cbd5e1] rounded-lg p-2.5 outline-none font-bold text-[#334155]" onChange={(e) => handleModelSecim(e.target.value)}>
              <option value="">-- Listeden Seçiniz --</option>
              {ikasModelleri.map(m => (
                <option key={m.id} value={m.id}>{m.marka} {m.model} ({m.hafiza})</option>
              ))}
            </select>
          </div>

          <Input type="text" label="2. Cihazın 15 Haneli IMEI Numarasını Yazın" maxLength={15} className="font-mono text-sm" value={formData.sku} onChange={(e) => setFormData({...formData, sku: e.target.value})} />
          <Input type="text" label="Cihazın Rengi" value={formData.renk} onChange={(e) => setFormData({...formData, renk: e.target.value})} />
          
          <div className="grid grid-cols-2 gap-3">
            <Input type="number" label="Maliyet (Alış Fiyatı)" value={formData.alis_fiyati} onChange={(e) => setFormData({...formData, alis_fiyati: e.target.value})} />
            <Input type="number" label="Ikas Satış Fiyatı" className="font-bold text-emerald-600" value={formData.satis_fiyati} onChange={(e) => setFormData({...formData, satis_fiyati: e.target.value})} />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-[#475569] mb-1">Cihazın Fiziksel Olarak Bulunduğu Şube</label>
            <select className="w-full bg-[#f8fafc] border border-[#cbd5e1] rounded-lg p-2.5 outline-none font-semibold" value={formData.sube_adi} onChange={(e) => setFormData({...formData, sube_adi: e.target.value})}>
              <option value="Kadıköy Şube">Kadıköy Şube</option>
              <option value="Beşiktaş Şube">Beşiktaş Şube</option>
              <option value="Merkez Depo">Merkez Depo</option>
            </select>
          </div>

        </DialogBody>
        <DialogFooter className="gap-2 border-t">
          <Button variant="text" color="red" size="sm" onClick={() => setIsModalOpen(false)} className="normal-case font-bold">İptal</Button>
          <Button color="green" size="sm" onClick={handleFormSubmit} className="normal-case font-black">Sitede Canlıya Al</Button>
        </DialogFooter>
      </Dialog>

    </div>
  );
}
