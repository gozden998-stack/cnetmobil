// components/admin/Sidebar.tsx
import Link from 'next/link';

const menuItems = [
  // ANA EKRAN
  { name: 'Dashboard', href: '/admin', icon: '📊' },
  
  // OPERASYON
  { name: 'Cihaz Alım (Buyback)', href: '/admin/cihaz-alim', icon: '📱' },
  { name: 'Teknik Servis', href: '/admin/teknik-servis', icon: '🛠️' },
  
  // STOK VE ENVANTER
  { name: 'Sıfır Stok', href: '/admin/sifir-stok', icon: '📦' },
  { name: 'İkinci El Stok', href: '/admin/ikinci-el-stok', icon: '♻️' },
  { name: 'Şubeler Arası Transfer', href: '/admin/transferler', icon: '🚚' },
  
  // YÖNETİM
  { name: 'Mağazalar', href: '/admin/magazalar', icon: '🏪' },
  { name: 'Personel Yönetimi', href: '/admin/personel', icon: '👥' },
  { name: 'Yetki Yönetimi (RBAC)', href: '/admin/yetkiler', icon: '🔐' },
  
  // FİNANS & RAPOR
  { name: 'Şube Performansı', href: '/admin/raporlar', icon: '📈' },
  { name: 'Kasa & Finans', href: '/admin/finans', icon: '💰' },
  
  // SİSTEM
  { name: 'Müşteriler', href: '/admin/musteriler', icon: '🤝' },
  { name: 'İşlem Logları', href: '/admin/loglar', icon: '📋' },
  { name: 'Sistem Ayarları', href: '/admin/ayarlar', icon: '⚙️' },
];

export default function Sidebar() {
  return (
    <aside className="w-64 bg-slate-900 text-white min-h-screen p-4 flex flex-col justify-between">
      <div>
        <div className="mb-8 p-2">
          <h2 className="text-2xl font-bold text-blue-500 tracking-wider">CNET MOBİL</h2>
          <p className="text-xs text-slate-400 mt-1">Yönetim Paneli v1.0</p>
        </div>
        
        <nav className="flex flex-col gap-1 text-sm font-medium">
          {menuItems.map((item) => (
            <Link 
              key={item.name} 
              href={item.href} 
              className="flex items-center p-3 hover:bg-slate-800 hover:text-blue-400 rounded-lg transition-colors duration-200"
            >
              <span className="mr-3 text-lg">{item.icon}</span> 
              {item.name}
            </Link>
          ))}
        </nav>
      </div>

      {/* Alt Kısım - Çıkış Butonu */}
      <div className="pt-4 border-t border-slate-700">
        <button className="flex items-center w-full p-3 hover:bg-red-900/50 text-red-400 rounded-lg transition-colors duration-200">
          <span className="mr-3 text-lg">🚪</span> Çıkış Yap
        </button>
      </div>
    </aside>
  );
}
