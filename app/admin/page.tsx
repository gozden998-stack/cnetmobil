"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type MeResponse = {
  success: boolean;
  isSuperAdmin?: boolean;
  user?: { email?: string | null };
  permissions?: string[];
};

const modules = [
  { title: "Kullanıcılar & Yetkiler", description: "Personel, yönetici, Super Admin, şube ve işlem yetkileri.", href: "/admin/users", permission: "users.view", icon: "👥", ready: true },
  { title: "Fiyat Yönetimi", description: "Cihaz fiyatlarını panelden görüntüle, değiştir ve logla.", href: "/admin/prices", permission: "prices.view", icon: "₺", ready: false },
  { title: "Stok Yönetimi", description: "Merkez ve mağaza stoklarını yönet, transfer oluştur.", href: "/admin/stock", permission: "stock.view", icon: "📦", ready: false },
  { title: "Cihaz Yönetimi", description: "Cihaz ekle, düzenle ve ürün bilgilerini yönet.", href: "/admin/devices", permission: "devices.view", icon: "📱", ready: false },
  { title: "Cihaz Talepleri", description: "Mağaza taleplerini onayla, reddet ve gönderildi yap.", href: "/admin/requests", permission: "requests.view", icon: "🚚", ready: false },
  { title: "Alımlar", description: "Cihaz alım kayıtlarını ve geçmiş işlemleri yönet.", href: "/admin/purchases", permission: "purchases.view", icon: "🧾", ready: false },
  { title: "THH", description: "THH kayıtlarını görüntüle, düzenle ve takip et.", href: "/admin/thh", permission: "thh.view", icon: "⚖️", ready: false },
  { title: "Raporlar", description: "Mağaza, personel, satış, stok ve performans raporları.", href: "/admin/reports", permission: "reports.view", icon: "📊", ready: false },
  { title: "İşlem Geçmişi", description: "Kim, neyi, ne zaman değiştirdi? Audit kayıtları.", href: "/admin/audit", permission: "audit.view", icon: "🕘", ready: false },
  { title: "Sistem Ayarları", description: "Panel kuralları, baremler ve genel sistem ayarları.", href: "/admin/settings", permission: "settings.view", icon: "⚙️", ready: false },
];

export default function SuperAdminDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [permissions, setPermissions] = useState<string[]>([]);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const boot = async () => {
      try {
        const res = await fetch("/api/me", { method: "GET", cache: "no-store" });
        const data: MeResponse = await res.json();

        if (!res.ok || !data.success || !data.isSuperAdmin) {
          router.replace("/");
          return;
        }

        setEmail(data.user?.email || "");
        setPermissions(Array.isArray(data.permissions) ? data.permissions : []);
      } catch {
        router.replace("/");
        return;
      } finally {
        setLoading(false);
      }
    };

    boot();
  }, [router]);

  const visibleModules = useMemo(
    () => modules.filter((item) => permissions.includes(item.permission) || permissions.length === 0),
    [permissions]
  );

  const logout = async () => {
    try { await fetch("/api/auth", { method: "DELETE" }); } catch {}
    window.location.href = "/";
  };

  const openModule = (item: (typeof modules)[number]) => {
    if (item.ready) {
      router.push(item.href);
      return;
    }

    setNotice(`${item.title} sıradaki aşamada aktif olacak. İlk olarak Fiyat Yönetimi'ni bağlayacağız.`);
    window.setTimeout(() => setNotice(""), 4000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f5f7fb] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-11 h-11 rounded-full border-4 border-slate-200 border-t-blue-600 animate-spin" />
          <div className="text-sm font-bold text-slate-500">Super Admin paneli hazırlanıyor...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4f7fb] text-slate-900">
      <header className="sticky top-0 z-40 bg-[#172033] text-white shadow-lg">
        <div className="max-w-[1500px] mx-auto min-h-[72px] px-5 lg:px-8 flex items-center justify-between gap-5">
          <div>
            <div className="text-[22px] font-black tracking-tight">CNETMOBİL</div>
            <div className="text-[11px] text-slate-300">Super Admin Yönetim Merkezi</div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden md:block text-right">
              <div className="text-[11px] text-slate-400">Super Admin</div>
              <div className="text-sm font-semibold">{email}</div>
            </div>
            <button onClick={logout} className="h-10 px-4 rounded-xl bg-white/10 hover:bg-white/20 text-sm font-bold transition">
              Çıkış
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1500px] mx-auto p-5 lg:p-8">
        <section className="rounded-[30px] bg-gradient-to-br from-[#172033] via-[#22304b] to-[#0f62d7] text-white p-7 lg:p-10 shadow-xl mb-7">
          <div className="max-w-4xl">
            <div className="inline-flex rounded-full bg-white/10 border border-white/10 px-3 py-1.5 text-xs font-black uppercase tracking-wider">
              CNETMOBİL PANEL V2
            </div>
            <h1 className="mt-5 text-3xl lg:text-5xl font-black tracking-tight">Yönetim tek merkezde.</h1>
            <p className="mt-4 text-slate-200 max-w-3xl leading-relaxed">
              Kullanıcı, yetki, fiyat, stok, cihaz, talep ve rapor işlemlerini bu panelden yöneteceğiz.
            </p>
          </div>
        </section>

        {notice && (
          <div className="mb-6 rounded-2xl border border-blue-200 bg-blue-50 px-5 py-4 text-blue-800 font-semibold">
            {notice}
          </div>
        )}

        <div className="mb-5">
          <div className="text-xs font-black uppercase tracking-[0.18em] text-blue-600">Modüller</div>
          <h2 className="mt-1 text-2xl font-black">Super Admin İşlemleri</h2>
        </div>

        <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {visibleModules.map((item) => (
            <button
              key={item.title}
              type="button"
              onClick={() => openModule(item)}
              className="text-left rounded-3xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all group"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-2xl group-hover:bg-blue-50 transition">
                  {item.icon}
                </div>
                <div className={`text-[10px] font-black uppercase tracking-wider rounded-full px-2.5 py-1 ${
                  item.ready ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                }`}>
                  {item.ready ? "Aktif" : "Sırada"}
                </div>
              </div>

              <div className="mt-5 text-lg font-black">{item.title}</div>
              <div className="mt-2 text-sm text-slate-500 leading-relaxed">{item.description}</div>
              <div className="mt-5 text-sm font-black text-blue-600">
                {item.ready ? "Modülü Aç →" : "Yakında aktif →"}
              </div>
            </button>
          ))}
        </section>
      </main>
    </div>
  );
}
