"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type MeResponse = {
  success: boolean;
  isSuperAdmin?: boolean;
  user?: { email?: string | null };
};

type AdminItem = {
  title: string;
  href?: string;
  active: boolean;
};

const items: AdminItem[] = [
  { title: "Ana Sayfa", active: true },
  { title: "Cihaz Alım", href: "/admin/prices", active: true },
  { title: "Teknik Servis", active: false },
  { title: "THH Takip", active: false },
  { title: "Cep + Tablet", href: "/?view=normal&mode=cep_tablet", active: true },
  { title: "YNA List", href: "/?view=normal&mode=yna_list", active: true },
  { title: "Dış Kanal", href: "/?view=normal&mode=dis_kanal", active: true },
  { title: "Kampanyalı Sıfır Liste", active: false },
  { title: "2. El Listesi", href: "/?view=normal&mode=ikinci_el_apple", active: true },
  { title: "Cihaz Talep", active: false },
];

export default function SuperAdminDashboardPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const boot = async () => {
      try {
        const res = await fetch("/api/me", {
          method: "GET",
          cache: "no-store",
        });

        const data: MeResponse = await res.json();

        if (!res.ok || !data.success || !data.isSuperAdmin) {
          router.replace("/");
          return;
        }

        setEmail(data.user?.email || "");
      } catch {
        router.replace("/");
        return;
      } finally {
        setLoading(false);
      }
    };

    boot();
  }, [router]);

  const openNormalPanel = () => {
    window.open("/?view=normal", "_blank", "noopener,noreferrer");
  };

  const openItem = (item: AdminItem) => {
    if (item.title === "Ana Sayfa") {
      openNormalPanel();
      return;
    }

    if (item.active && item.href) {
      if (item.href.startsWith('/?view=normal')) {
        window.open(item.href, '_blank', 'noopener,noreferrer');
      } else {
        router.push(item.href);
      }
      return;
    }

    setNotice(`${item.title} için yönetim alanı henüz eklenmedi.`);
    window.setTimeout(() => setNotice(""), 3000);
  };

  const logout = async () => {
    try {
      await fetch("/api/auth", { method: "DELETE" });
    } catch {}

    window.location.href = "/";
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-sm font-bold text-slate-500">
          Yönetim paneli açılıyor...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f3f6fa] text-slate-900">
      <header className="bg-[#2d3035] text-white shadow-sm">
        <div className="max-w-[1450px] mx-auto min-h-[70px] px-5 lg:px-8 flex items-center justify-between gap-4">
          <div>
            <div className="text-xl font-black">CNETMOBİL</div>
            <div className="text-[11px] text-slate-300">Super Admin</div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={openNormalPanel}
              className="h-10 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-sm font-black"
            >
              Normal Paneli Aç
            </button>

            <button
              onClick={() => router.push("/admin/users")}
              className="h-10 px-4 rounded-lg bg-white/10 hover:bg-white/20 text-sm font-bold"
            >
              Kullanıcı & Yetki
            </button>

            <button
              onClick={logout}
              className="h-10 px-4 rounded-lg bg-white/10 hover:bg-white/20 text-sm font-bold"
            >
              Çıkış
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1450px] mx-auto px-5 lg:px-8 py-7">
        <div className="mb-6 flex flex-col md:flex-row md:items-end md:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black">Yönetim İşlemleri</h1>
            <p className="mt-1 text-sm text-slate-500">
              Sadece değiştirmek istediğin ekranları burada yöneteceğiz.
            </p>
          </div>

          <div className="text-xs text-slate-400">{email}</div>
        </div>

        {notice && (
          <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
            {notice}
          </div>
        )}

        <section className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
          {items.map((item) => (
            <button
              key={item.title}
              type="button"
              onClick={() => openItem(item)}
              className={`min-h-[112px] rounded-2xl border bg-white p-4 text-left shadow-sm transition ${
                item.active
                  ? "border-slate-200 hover:border-blue-300 hover:shadow-md"
                  : "border-slate-200 opacity-65"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                  {item.active ? "Aktif" : "Sırada"}
                </span>

                {item.active && (
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                )}
              </div>

              <div className="mt-5 text-[16px] font-black">{item.title}</div>

              <div className="mt-2 text-xs font-bold text-blue-600">
                {item.active
                  ? item.title === "Ana Sayfa"
                    ? "Normal paneli aç →"
                    : "Düzenle →"
                  : "Henüz aktif değil"}
              </div>
            </button>
          ))}
        </section>
      </main>
    </div>
  );
}
