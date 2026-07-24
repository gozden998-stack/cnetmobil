"use client";

import { useState } from 'react';

// Oranlar listesi (Görseldeki gibi 12'den geriye doğru sıralandı)
const TAKSIT_ORANLARI = [
  { month: 12, rate: 35.41 },
  { month: 11, rate: 32.07 },
  { month: 10, rate: 28.88 },
  { month: 9, rate: 25.85 },
  { month: 8, rate: 22.96 },
  { month: 7, rate: 20.19 },
  { month: 6, rate: 17.55 },
  { month: 5, rate: 14.76 },
  { month: 4, rate: 12.36 },
  { month: 3, rate: 10.05 },
  { month: 2, rate: 7.83 },
  { month: 1, rate: 4 }
];

export default function TaksitEkrani() {
  const [tutar, setTutar] = useState<string>('100000');
  const asilTutar: number = Number(tutar) || 0;

  // Para birimi formatlayıcı (Sadece sayı ve virgül, ₺ işaretini dışarıda ekleyeceğiz)
  const formatPara = (deger: number) => {
    return new Intl.NumberFormat('tr-TR', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    }).format(deger);
  };

  return (
    <div className="min-h-screen bg-[#f4f6f9] py-10 px-4 flex justify-center items-start font-sans">
      <div className="bg-white rounded-3xl shadow-xl w-full max-w-3xl overflow-hidden">
        
        {/* Başlık ve Logo Alanı */}
        <div className="pt-10 pb-6 text-center">
          <h1 className="text-5xl font-extrabold text-[#1e40af] tracking-tight">
            CNET<span className="text-[#3b82f6]">mobil</span>
          </h1>
          <h2 className="text-2xl font-bold text-[#1e40af] mt-4">
            Taksit & Komisyon
          </h2>
        </div>

        {/* Tutar Giriş Alanı */}
        <div className="px-8 pb-8">
          <div className="text-center mb-2">
            <span className="text-[#1e40af] font-semibold text-lg">Hesaba Geçecek Tutar</span>
          </div>
          <div className="max-w-sm mx-auto relative">
            <span className="absolute inset-y-0 left-4 flex items-center text-[#ea580c] font-bold text-2xl">
              ₺
            </span>
            <input
              type="number"
              value={tutar}
              onChange={(e) => setTutar(e.target.value)}
              className="w-full pl-12 pr-4 py-3 text-center text-3xl font-bold text-[#1e40af] border-2 border-[#ea580c] rounded-xl focus:ring-4 focus:ring-orange-200 outline-none transition-all"
              placeholder="0"
            />
          </div>
        </div>

        {/* Tablo Alanı */}
        <div className="w-full overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[500px]">
            <thead>
              <tr>
                <th className="bg-[#1e40af] text-white py-4 px-6 font-semibold w-1/3 text-left">
                  Taksit
                </th>
                <th className="bg-[#1e40af] text-white py-4 px-6 font-semibold w-1/3 text-center">
                  Aylık Ödeme
                </th>
                {/* Turuncu vurgulu sağ üst köşe */}
                <th className="bg-[#ea580c] text-white py-4 px-6 font-semibold w-1/3 text-right">
                  Karttan Çekilecek
                </th>
              </tr>
            </thead>
            <tbody>
              {TAKSIT_ORANLARI.map((item, index) => {
                const vadeFarkiTutari = (asilTutar * item.rate) / 100;
                const toplamOdenecek = asilTutar + vadeFarkiTutari;
                const aylikTaksit = asilTutar > 0 ? (toplamOdenecek / item.month) : 0;
                
                // Satırları bir beyaz, bir hafif gri yapmak için
                const isEven = index % 2 === 0;

                return (
                  <tr 
                    key={item.month} 
                    className={`${isEven ? 'bg-white' : 'bg-slate-50'} border-b border-gray-200 hover:bg-blue-50 transition-colors`}
                  >
                    <td className="py-4 px-6 font-bold text-[#1e40af] text-lg">
                      {item.month === 1 ? 'Tek Çekim' : `${item.month} Ay`}
                    </td>
                    <td className="py-4 px-6 font-medium text-gray-800 text-center text-lg">
                      ₺{formatPara(aylikTaksit)}
                    </td>
                    <td className="py-4 px-6 font-bold text-[#ea580c] text-right text-lg">
                      ₺{formatPara(toplamOdenecek)}
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
