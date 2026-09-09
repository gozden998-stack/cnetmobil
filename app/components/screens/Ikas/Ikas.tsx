"use client";

import React, {
  useState,
} from "react";
import IkasStock from "./IkasStock";
import IkasOrders from "./IkasOrders";

type MainTab =
  | "stock"
  | "orders";

export default function Ikas() {
  const [
    tab,
    setTab,
  ] = useState<MainTab>(
    "stock"
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-[22px] border border-slate-200 bg-white p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() =>
              setTab("stock")
            }
            className={`rounded-xl px-5 py-3 text-[9px] font-black uppercase tracking-wide transition ${
              tab === "stock"
                ? "bg-slate-950 text-white shadow-sm"
                : "bg-slate-50 text-slate-600 hover:bg-slate-100"
            }`}
          >
            Ürün & Stok
          </button>

          <button
            type="button"
            onClick={() =>
              setTab("orders")
            }
            className={`rounded-xl px-5 py-3 text-[9px] font-black uppercase tracking-wide transition ${
              tab === "orders"
                ? "bg-violet-600 text-white shadow-sm"
                : "bg-slate-50 text-slate-600 hover:bg-slate-100"
            }`}
          >
            Siparişler
          </button>
        </div>

        <div className="px-2 text-[8px] font-bold text-slate-400">
          İkas ürün, fiyat, stok ve sipariş yönetimi
        </div>
      </div>

      {tab === "stock" ? (
        <IkasStock />
      ) : (
        <IkasOrders />
      )}
    </div>
  );
}
