// app/admin/page.tsx
export default function AdminDashboard() {
  return (
    <div>
      <h1 className="text-3xl font-bold text-slate-800 mb-6">Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Örnek Bilgi Kartları */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <h3 className="text-slate-500 text-sm font-medium mb-2">Toplam Mağaza</h3>
          <p className="text-3xl font-bold text-slate-800">8</p>
        </div>
        
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <h3 className="text-slate-500 text-sm font-medium mb-2">Bekleyen Teknik Servis</h3>
          <p className="text-3xl font-bold text-blue-600">12</p>
        </div>
        
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <h3 className="text-slate-500 text-sm font-medium mb-2">Günlük Sistem Yenilemesi</h3>
          <p className="text-3xl font-bold text-emerald-600">5 Dk</p>
        </div>
      </div>
    </div>
  );
}
