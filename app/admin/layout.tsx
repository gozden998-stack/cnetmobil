// app/admin/layout.tsx
import Sidebar from '@/components/admin/Sidebar';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar /> {/* 16 menünün olduğu yer */}
      <main className="flex-1 p-8">
        {children} {/* İçerik buraya gelecek */}
      </main>
    </div>
  );
}
