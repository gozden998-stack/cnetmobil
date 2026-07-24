"use client";

import { useState } from 'react';

// Oranlar listesi
const TAKSIT_ORANLARI = [
  { month: 1, rate: 4 },
  { month: 2, rate: 7.83 },
  { month: 3, rate: 10.05 },
  { month: 4, rate: 12.36 },
  { month: 5, rate: 14.76 },
  { month: 6, rate: 17.55 },
  { month: 7, rate: 20.19 },
  { month: 8, rate: 22.96 },
  { month: 9, rate: 25.85 },
  { month: 10, rate: 28.88 },
  { month: 11, rate: 32.07 },
  { month: 12, rate: 35.41 }
];

export default function TaksitEkrani() {
  // TypeScript için tip tanımlamaları eklendi
  const [tutar, setTutar] = useState<string>('');
  const asilTutar: number = Number(tutar) || 0;

  const formatPara = (deger: number) => {
    return new Intl.NumberFormat('tr-TR', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    }).format(deger) + ' ₺';
  };

  return (
    <div className="min-h-screen bg-gray-100 py-10 px-4 flex justify-center items-start">
      <div className="bg-white p-6 md:p-8 rounded-2xl shadow-xl w-full max-w-4xl">
        
        <h1 className="text-3xl font-bold text-gray-800 mb-2 text-center">
          Taksit Seçenekleri
        </h1>
        <p className="text-gray-500 text-center mb-8">
          Ürün tutarını girerek tüm vade seçeneklerini görebilirsiniz.
        </p>

        <div className="max-w-md mx-auto mb-8">
          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-gray-500 font-semibold">
              ₺
            </span>
            <input
              type="number"
              value={tutar}
              onChange={(e) => setTutar(e.target.value)}
              className="w-full pl-10 pr-4 py-4 text-2xl font-bold text-gray-800 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all"
              placeholder="0,00"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-600 border-b-2 border-gray-200">
                <th className="py-4 px-4 font-semibold">Taksit</th>
                <th className="py-4 px-4 font-semibold hidden md:table-cell">Komisyon Oranı</th>
                <th className="py-4 px-4 font-semibold text-right">Aylık Taksit</th>
                <th className="py-4 px-4 font-semibold text-right">Toplam Tutar</th>
              </tr>
            </thead>
            <tbody>
              {TAKSIT_ORANLARI.map((item, index) => {
                const vadeFarkiTutari = (asilTutar * item.rate) / 100;
                const toplamOdenecek = asilTutar + vadeFarkiTutari;
                const aylikTaksit = asilTutar > 0 ? (toplamOdenecek / item.month) : 0;

                return (
                  <tr 
                    key={item.month} 
                    className={`border-b border-gray-100 hover:bg-blue-50 transition-colors ${index === 0 ? 'bg-green-50/30' : ''}`}
                  >
                    <td className="py-4 px-4 font-bold text-gray-800">
                      {item.month === 1 ? 'Tek Çekim' : `${item.month} Taksit`}
                    </td>
                    <td className="py-4 px-4 text-gray-500 hidden md:table-cell">
                      %{item.rate}
                    </td>
                    <td className="py-4 px-4 font-bold text-blue-600 text-right text-lg">
                      {formatPara(aylikTaksit)}
                    </td>
                    <td className="py-4 px-4 font-semibold text-gray-700 text-right">
                      {formatPara(toplamOdenecek)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
}
