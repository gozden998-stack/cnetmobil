// app/admin/layout.tsx
import Sidebar from '@/components/admin/Sidebar';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      {/* Sol taraftaki sabit menü */}
      <Sidebar /> 
      
      {/* Sağ taraftaki dinamik içerik alanı */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* İsterseniz buraya ileride bir Top Navbar (Üst Menü) eklenebilir */}
        <div className="flex-1 overflow-y-auto p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
