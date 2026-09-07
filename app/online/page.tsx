"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function OnlinePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const checkAccess = async () => {
      try {
        const response = await fetch("/api/me", {
          method: "GET",
          cache: "no-store",
          credentials: "same-origin",
        });

        const data = await response.json().catch(() => ({}));

        if (cancelled) return;

        if (!response.ok || !data?.success || !data?.isSuperAdmin) {
          router.replace("/");
          return;
        }

        setAllowed(true);
      } catch {
        if (!cancelled) router.replace("/");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void checkAccess();

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-sm font-black text-slate-500">
          ONLINE modülü açılıyor...
        </div>
      </div>
    );
  }

  if (!allowed) return null;

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-slate-900">
      <header className="sticky top-0 z-30 bg-[#172033] text-white shadow-lg">
        <div className="mx-auto flex h-[68px] max-w-[1600px] items-center justify-between px-5 lg:px-8">
          <div>
            <div className="text-xl font-black tracking-tight">CNETMOBİL</div>
            <div className="text-[11px] font-bold text-slate-300">
              Online Kanal Yönetimi
            </div>
          </div>

          <button
            type="button"
            onClick={() => router.push("/")}
            className="h-10 rounded-xl border border-white/10 bg-white/10 px-4 text-xs font-black transition hover:bg-white/15"
          >
            PANELE DÖN
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-[1500px] p-5 lg:p-8">
        <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-6 lg:p-8">
            <div className="text-xs font-black uppercase tracking-[0.18em] text-blue-600">
              SUPER ADMIN
            </div>
            <h1 className="mt-2 text-3xl font-black tracking-tight">ONLINE</h1>
            <p className="mt-2 max-w-3xl text-sm font-semibold text-slate-500">
              N11 ürün, stok ve fiyat entegrasyonu bu ekrandan yönetilecek.
            </p>
          </div>

          <div className="grid gap-4 p-6 md:grid-cols-3 lg:p-8">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <div className="text-xs font-black uppercase tracking-wider text-slate-400">
                Kanal
              </div>
              <div className="mt-2 text-xl font-black">N11</div>
              <div className="mt-2 text-sm font-semibold text-amber-600">
                API bağlantısı sıradaki adım
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <div className="text-xs font-black uppercase tracking-wider text-slate-400">
                Stok
              </div>
              <div className="mt-2 text-xl font-black">—</div>
              <div className="mt-2 text-sm font-semibold text-slate-500">
                N11 stokları burada listelenecek
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <div className="text-xs font-black uppercase tracking-wider text-slate-400">
                Test
              </div>
              <div className="mt-2 text-xl font-black">Hazır</div>
              <div className="mt-2 text-sm font-semibold text-slate-500">
                Ürün açma ve stok düşürme eklenecek
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
