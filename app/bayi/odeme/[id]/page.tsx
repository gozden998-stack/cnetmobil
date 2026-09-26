"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type OrderItem = { itemName: string; salePrice: number; quantity: number };

type OrderDetail = {
  id: number;
  status: string;
  totalSaleAmount: number;
  createdAt: string;
  items: OrderItem[];
  companyName: string;
  email: string;
  paymentUrl: string | null;
};

function formatTry(value: number) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 2,
  }).format(value);
}

function ShieldCheckIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.5 12.2l1.8 1.8 3.2-3.6" />
    </svg>
  );
}

export default function DealerCheckoutPage() {
  const params = useParams();
  const orderId = params?.id;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    if (!orderId) return;

    (async () => {
      try {
        const response = await fetch(`/api/dealer/orders/${orderId}`, {
          method: "GET",
          cache: "no-store",
          credentials: "same-origin",
        });

        const result = await response.json().catch(() => ({}));

        if (response.status === 401) {
          window.location.href = "/";
          return;
        }

        if (!response.ok || !result?.ok) {
          throw new Error(result?.error || "Sipariş alınamadı.");
        }

        setOrder(result.order);
      } catch (err: any) {
        setError(err?.message || "Sipariş alınamadı.");
      } finally {
        setLoading(false);
      }
    })();
  }, [orderId]);

  const goToPayment = () => {
    if (!order?.paymentUrl || redirecting) return;
    setRedirecting(true);
    window.location.href = order.paymentUrl;
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f5f7fb] text-sm font-bold text-slate-400">
        Yükleniyor...
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f5f7fb] px-4">
        <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-4 text-sm font-bold text-red-600">
          {error || "Sipariş bulunamadı."}
        </div>
      </div>
    );
  }

  if (!order.paymentUrl) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f5f7fb] px-4">
        <div className="max-w-sm rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="text-sm font-black text-slate-900">
            Bu sipariş için ödeme sayfası artık geçerli değil.
          </div>
          <p className="mt-2 text-xs font-semibold text-slate-400">
            Sipariş durumu: {order.status}. Siparişlerim sayfasından güncel durumu
            kontrol edebilirsiniz.
          </p>
          <a
            href="/bayi"
            className="mt-4 inline-block rounded-xl bg-blue-600 px-4 py-2 text-xs font-black uppercase tracking-wide text-white"
          >
            Siparişlerime Dön
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f7fb] pb-16">
      <header className="border-b border-slate-200 bg-white px-4 py-4 sm:px-8">
        <div className="mx-auto flex max-w-[1100px] items-center justify-between">
          <div className="text-xl font-black italic tracking-tight text-slate-950">
            Cnet<span className="text-blue-600">mobil</span>
          </div>
          <div className="text-right">
            <div className="text-sm font-black text-slate-900">{order.companyName}</div>
            <div className="text-xs font-semibold text-slate-400">{order.email}</div>
          </div>
        </div>
      </header>

      <main className="mx-auto mt-8 max-w-[1100px] px-4 sm:px-8">
        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
          <section className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
            <h1 className="text-lg font-black text-slate-900">Ödeme</h1>
            <p className="mt-1 text-xs font-semibold text-slate-400">
              Siparişinizi onaylayınca, kart bilgilerinizi güvenle gireceğiniz Paratika
              ödeme sayfasına yönlendirileceksiniz.
            </p>

            <div className="mt-6 rounded-2xl border border-blue-100 bg-blue-50/60 p-5">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-blue-600 px-2 py-1 text-[10px] font-black text-white">
                  PARATİKA
                </div>
                <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-600">
                  <ShieldCheckIcon className="h-3.5 w-3.5" /> 3D Secure
                </div>
              </div>
              <p className="mt-2 text-[11px] font-semibold leading-relaxed text-slate-500">
                Kart bilgileriniz Paratika&apos;nın güvenli ödeme sayfasında istenir,
                CnetMobil sunucularına hiç uğramaz. 3D Secure ile onayladıktan sonra
                bu sayfaya dönüp siparişinizin durumunu görebilirsiniz.
              </p>
            </div>

            <button
              type="button"
              onClick={goToPayment}
              disabled={redirecting}
              className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-500 disabled:opacity-50 disabled:shadow-none"
            >
              <ShieldCheckIcon className="h-4 w-4" />
              {redirecting ? "Yönlendiriliyor..." : `${formatTry(order.totalSaleAmount)} - Ödemeye Geç`}
            </button>

            <div className="mt-4 flex flex-wrap items-center gap-1.5">
              {["PARATİKA", "3D Secure", "SSL", "PCI DSS"].map((badge) => (
                <span
                  key={badge}
                  className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[9px] font-black uppercase text-slate-500"
                >
                  <ShieldCheckIcon className="h-3 w-3 text-emerald-500" />
                  {badge}
                </span>
              ))}
            </div>
          </section>

          <aside className="h-fit rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-black text-slate-900">Sipariş Özeti</h2>
            <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
              {order.items.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between gap-2 text-xs">
                  <div className="min-w-0">
                    <div className="truncate font-bold text-slate-800">{item.itemName}</div>
                    <div className="font-semibold text-slate-400">{item.quantity} adet</div>
                  </div>
                  <div className="shrink-0 font-black text-slate-900">
                    {formatTry(item.salePrice * item.quantity)}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-sm font-black text-slate-950">
              <span>Toplam</span>
              <span>{formatTry(order.totalSaleAmount)}</span>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
