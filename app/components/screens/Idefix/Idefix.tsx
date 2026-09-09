"use client";

import React from "react";

export default function Idefix() {
  return (
    <div className="animate-in fade-in duration-300">
      <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-gradient-to-r from-slate-950 via-blue-950 to-cyan-950 px-6 py-7 text-white sm:px-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-[9px] font-black uppercase tracking-[0.22em] text-cyan-200/75">
                Entegrasyonlar / İdefix
              </div>

              <div className="mt-1 flex flex-wrap items-center gap-3">
                <h2 className="text-2xl font-black tracking-tight sm:text-3xl">
                  İdefix Entegrasyonu
                </h2>

                <span className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-2.5 py-1 text-[8px] font-black uppercase tracking-wide text-emerald-200">
                  API Aktif
                </span>
              </div>

              <p className="mt-2 max-w-2xl text-[10px] font-semibold leading-5 text-slate-300">
                İdefix API bağlantısı hazır. Ürün, stok ve sipariş entegrasyonu aynı ekran yapısı üzerinden geliştirilecek.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
