import React, { useState } from 'react';

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

  const handleBulkSubmit = async () => {
    if (!imeiList.trim()) return;
    setLoading(true);
    const imeis = imeiList.split('\n').filter(i => i.trim().length === 15);
    alert(`${imeis.length} adet IMEI işlenmeye hazır!`);
    setImeiList('');
    setLoading(false);
  };

  return (
    <div style={{ display: 'flex', height: '100vh', backgroundColor: '#f8fafc', fontFamily: 'sans-serif' }}>
      {/* SOL MENÜ */}
      <aside style={{ width: '260px', backgroundColor: '#0f172a', color: 'white', padding: '20px' }}>
        <h2 style={{ color: '#60a5fa', marginBottom: '30px', borderBottom: '1px solid #334155', paddingBottom: '15px' }}>CNETMOBIL ADMIN</h2>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {SESSIONS.map(item => (
            <button 
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              style={{ 
                textAlign: 'left', padding: '12px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                backgroundColor: activeTab === item.id ? '#2563eb' : 'transparent',
                color: activeTab === item.id ? 'white' : '#94a3b8'
              }}
            >
              📂 {item.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* SAĞ ANA PANEL */}
      <main style={{ flex: 1, padding: '40px', overflowY: 'auto' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '30px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: 'bold', color: '#1e293b' }}>{SESSIONS.find(s => s.id === activeTab)?.label}</h1>
          <div style={{ backgroundColor: 'white', padding: '10px 20px', borderRadius: '10px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <b>Aktif Şubeler:</b> 8
          </div>
        </header>

        {/* 100 IMEI TOPLU GİRİŞ ALANI */}
        <section style={{ backgroundColor: 'white', padding: '25px', borderRadius: '15px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', marginBottom: '30px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '15px' }}>📱 Toplu IMEI Girişi (Excel'den Yapıştır)</h2>
          <textarea 
            style={{ width: '100%', height: '120px', padding: '15px', backgroundColor: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '12px', outline: 'none' }}
            placeholder="Excel'den kopyaladığın IMEI'leri buraya yapıştır..."
            value={imeiList}
            onChange={(e) => setImeiList(e.target.value)}
          />
          <button 
            onClick={handleBulkSubmit}
            disabled={loading}
            style={{ marginTop: '15px', padding: '15px 30px', backgroundColor: '#2563eb', color: 'white', borderRadius: '12px', fontWeight: 'bold', border: 'none', cursor: 'pointer' }}
          >
            {loading ? 'İşleniyor...' : 'Listeyi Depo ve Alımlara İşle'}
          </button>
        </section>

        {/* VERİ TABLOSU */}
        <section style={{ backgroundColor: 'white', borderRadius: '15px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
          <div style={{ padding: '15px', backgroundColor: '#f8fafc', borderBottom: '1px solid #f1f5f9', fontWeight: 'bold' }}>Mevcut Liste</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead style={{ backgroundColor: '#f8fafc', fontSize: '12px', color: '#64748b' }}>
              <tr>
                <th style={{ padding: '15px' }}>MODEL</th>
                <th style={{ padding: '15px' }}>KAPASİTE</th>
                <th style={{ padding: '15px' }}>FİYAT</th>
                <th style={{ padding: '15px', textAlign: 'right' }}>İŞLEM</th>
              </tr>
            </thead>
            <tbody style={{ fontSize: '14px' }}>
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '15px' }}>iPhone 14 Pro</td>
                <td style={{ padding: '15px' }}>256 GB</td>
                <td style={{ padding: '15px', color: '#2563eb', fontWeight: 'bold' }}>42.500 TL</td>
                <td style={{ padding: '15px', textAlign: 'right' }}>
                  <button style={{ color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>Düzenle</button>
                </td>
              </tr>
            </tbody>
          </table>
        </section>
      </main>
    </div>
  );
}
