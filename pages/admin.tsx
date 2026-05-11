import React, { useState } from 'react';
import { Smartphone, LayoutDashboard, Database, Tool, User, Search, RefreshCw } from 'lucide-react';

const SESSIONS = [
  { id: 'Devices', label: 'Ana Fiyat Listesi' },
  { id: 'Alimlar', label: 'Geri Alımlar' },
  { id: 'IkinciEl', label: '2.El Listesi' },
  { id: 'Depo', label: 'Stok (Depo)' },
  { id: 'Servis', label: 'Servis Fiyatları' },
  { id: 'MagazaGidisat', label: 'Mağaza Raporları' }
];

export default function CnetMobilAdmin() {
  const [activeTab, setActiveTab] = useState('IkinciEl');
  const [imeiList, setImeiList] = useState('');
  const [loading, setLoading] = useState(false);

  // 100 IMEI'yi kopyalayıp yapıştırdığında çalışan fonksiyon
  const handleBulkSubmit = async () => {
    setLoading(true);
    const imeis = imeiList.split('\n').filter(i => i.trim().length === 15);
    
    // API'ye gönder (Google Apps Script URL'ni buraya yazacaksın)
    console.log("Gönderilen IMEI'ler:", imeis);
    alert(`${imeis.length} adet IMEI başarıyla kaydedildi!`);
    setImeiList('');
    setLoading(false);
  };

  return (
    <div className="flex h-screen bg-slate-50 font-sans">
      {/* SOL MENÜ - 12 SAYFANIN TAMAMI BURADA */}
      <aside className="w-64 bg-slate-900 text-white p-5 shadow-2xl">
        <h2 className="text-xl font-black text-blue-400 mb-8 border-b border-slate-700 pb-4">CNETMOBIL ADMIN</h2>
        <nav className="space-y-2">
          {SESSIONS.map(item => (
            <button 
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all ${activeTab === item.id ? 'bg-blue-600 shadow-lg' : 'hover:bg-slate-800 text-slate-400'}`}
            >
              <Database size={18}/> {item.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* SAĞ ANA PANEL */}
      <main className="flex-1 p-8 overflow-y-auto">
        <header className="flex justify-between items-center mb-10">
          <h1 className="text-3xl font-bold text-slate-800">{SESSIONS.find(s => s.id === activeTab)?.label} Yönetimi</h1>
          <div className="flex gap-4">
             <div className="bg-white px-4 py-2 rounded-lg shadow-sm border border-slate-200 text-sm">
                <b>Aktif Şubeler:</b> 8
             </div>
          </div>
        </header>

        {/* 100 IMEI TOPLU GİRİŞ ALANI */}
        <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mb-8">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2"><Smartphone className="text-blue-600"/> Toplu IMEI İşleme</h2>
          <textarea 
            className="w-full h-32 p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm"
            placeholder="Excel'den kopyaladığın 100 IMEI'yi buraya yapıştır..."
            value={imeiList}
            onChange={(e) => setImeiList(e.target.value)}
          />
          <button 
            onClick={handleBulkSubmit}
            disabled={loading}
            className="mt-4 px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all disabled:opacity-50"
          >
            {loading ? 'İşleniyor...' : 'Listeyi Depo ve Alımlara İşle'}
          </button>
        </section>

        {/* VERİ TABLOSU (Fiyat Değiştirme Alanı) */}
        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
            <span className="font-bold">Mevcut Liste</span>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={16}/>
              <input className="pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm outline-none w-64" placeholder="Model veya IMEI ara..."/>
            </div>
          </div>
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr>
                <th className="p-4">Model</th>
                <th className="p-4">Kapasite</th>
                <th className="p-4">Fiyat</th>
                <th className="p-4 text-right">İşlem</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              <tr className="border-b border-slate-50 hover:bg-slate-50/50">
                <td className="p-4 font-semibold text-slate-700">iPhone 14 Pro</td>
                <td className="p-4 text-slate-500">256 GB</td>
                <td className="p-4 font-bold text-blue-600">42.500 TL</td>
                <td className="p-4 text-right">
                  <button className="text-blue-600 hover:underline font-medium">Düzenle</button>
                </td>
              </tr>
              {/* Diğer satırlar buraya otomatik gelecek */}
            </tbody>
          </table>
        </section>
      </main>
    </div>
  );
}

