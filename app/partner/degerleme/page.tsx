"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function DegerlemePage() {
  const router = useRouter();
  
  // Seçim durumları (State) - Resetleme hatasını önlemek için baştan temiz kurgulandı
  const [step, setStep] = useState<number>(1); // 1: Marka, 2: Model, 3: Durum
  const [secilenMarka, setSecilenMarka] = useState<string>('');
  const [secilenModel, setSecilenModel] = useState<string>('');

  const markalar = ["Apple", "Samsung", "Xiaomi", "Huawei", "Tecno"];
  const modeller: { [key: string]: string[] } = {
    "Apple": ["iPhone 13", "iPhone 14", "iPhone 15", "iPhone 15 Pro Max"],
    "Samsung": ["Galaxy S23", "Galaxy S24", "Galaxy A54"],
    "Xiaomi": ["Redmi Note 12", "Mi 13 Ultra"]
  };

  const handleMarkaSec = (marka: string) => {
    setSecilenMarka(marka);
    setStep(2); // Modeller adımına geç
  };

  const handleModelSec = (model: string) => {
    setSecilenModel(model);
    setStep(3); // Cihaz durum adımına geç
  };

  const handleGeriDon = () => {
    if (step === 3) {
      setStep(2);
    } else if (step === 2) {
      // Bir önceki menüye dönerken eski seçimleri sıfırlıyoruz ki butonlar takılı kalmasın!
      setSecilenMarka('');
      setStep(1);
    } else {
      router.push('/partner'); // En başa panele dön
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      {/* Üst Bar */}
      <div className="bg-[#2b2b36] text-white p-4 flex items-center justify-between shadow-md">
        <button onClick={handleGeriDon} className="text-orange-500 font-bold text-sm">
          ← Geri Dön
        </button>
        <span className="font-bold text-lg">Cihaz Değerleme</span>
        <div className="w-10"></div> {/* Dengelesin diye boşluk */}
      </div>

      <div className="max-w-md w-full mx-auto p-4 mt-4">
        
        {/* Adım 1: Marka Seçimi */}
        {step === 1 && (
          <div className="space-y-3">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Cihazın Markasını Seçin</h2>
            {markalar.map((marka) => (
              <button 
                key={marka}
                onClick={() => handleMarkaSec(marka)}
                className="w-full bg-white p-4 rounded-xl shadow-sm border border-gray-100 hover:border-orange-500 hover:shadow-md text-left font-semibold text-gray-700 transition-all flex justify-between items-center"
              >
                {marka} <span className="text-gray-400">→</span>
              </button>
            ))}
          </div>
        )}

        {/* Adım 2: Model Seçimi */}
        {step === 2 && (
          <div className="space-y-3">
            <h2 className="text-xl font-bold text-gray-800 mb-2">{secilenMarka} Modeli Seçin</h2>
            <p className="text-xs text-gray-400 mb-4">Seçilen Marka: {secilenMarka}</p>
            {(modeller[secilenMarka] || ["Diğer Modeller"]).map((model) => (
              <button 
                key={model}
                onClick={() => handleModelSec(model)}
                className="w-full bg-white p-4 rounded-xl shadow-sm border border-gray-100 hover:border-orange-500 hover:shadow-md text-left font-semibold text-gray-700 transition-all flex justify-between items-center"
              >
                {model} <span className="text-gray-400">→</span>
              </button>
            ))}
          </div>
        )}

        {/* Adım 3: Özet ve Fiyat Hesaplama Aşaması */}
        {step === 3 && (
          <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100 text-center">
            <div className="text-5xl mb-4">📱</div>
            <h2 className="text-2xl font-bold text-gray-800 mb-1">{secilenModel}</h2>
            <p className="text-sm text-gray-500 mb-6">{secilenMarka} Türkiye Garantili</p>
            
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-6">
              <div className="text-xs text-gray-500 uppercase tracking-wider">Tahmini Alım Fiyatı</div>
              <div className="text-3xl font-extrabold text-orange-600 mt-1">24.500 TL</div>
              <div className="text-[10px] text-gray-400 mt-1">*Net fiyat teknik testten sonra belirlenir.</div>
            </div>

            <button 
              onClick={() => {
                alert("Alım talebi başarıyla oluşturuldu! Google Sheets'e kaydediliyor...");
                router.push('/partner');
              }}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 rounded-lg transition-colors"
            >
              Cihazı Teslim Al (Süreci Başlat)
            </button>
          </div>
        )}

      </div>
    </div>
  );
}

