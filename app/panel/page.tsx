'use client';

import React, { useState, useEffect } from 'react';

// TypeScript Tipleri
type Branch = 'Merkez Şube' | 'Şube 2' | 'Şube 3' | 'Şube 4' | 'Şube 5' | 'Şube 6' | 'Şube 7' | 'Şube 8';

export default function CnetmobilDashboard() {
  const [activeBranch, setActiveBranch] = useState<Branch>('Merkez Şube');

  useEffect(() => {
    const fetchDashboardData = async () => {
      console.log('Veriler güncelleniyor...', new Date().toLocaleTimeString());
    };

    fetchDashboardData();
    const intervalId = setInterval(fetchDashboardData, 300000); 

    return () => clearInterval(intervalId);
  }, []);

  const playAlertSound = () => {
    let playCount = 0;
    const alertSound = new Audio('/sounds/notification-alert.mp3');
    
    alertSound.addEventListener('ended', () => {
      playCount++;
      if (playCount < 3) {
        alertSound.play().catch(error => console.error("Ses oynatılamadı:", error));
      }
    });
    
    alertSound.play().catch(error => console.error("Ses oynatılamadı:", error));
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-300 flex font-sans">
      
      {/* Sol Menü (Sidebar) */}
      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col">
        <div className="p-6 border-b border-slate-800 flex justify-center">
          <img 
            src="/cnetmobil-logo-transparent.png" 
            alt="Cnetmobil" 
            className="h-10 w-auto object-contain"
          />
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          <button className="w-full flex items-center gap-3 px-4 py-3 bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-900/20 transition-all font-medium">
            <span>🛒</span> Hızlı Satış (POS)
          </button>
          <button className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-800 rounded-xl transition-all">
            <span>🔄</span> Cihaz Alım (Buyback)
          </button>
          <button className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-800 rounded-xl transition-all">
            <span>🔧</span> Teknik Servis
          </button>
          <button className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-800 rounded-xl transition-all">
            <span>📱</span> Stok & Transfer
          </button>
          <button className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-800 rounded-xl transition-all">
            <span>👥</span> Cari & Personel
          </button>
        </nav>
      </aside>

      {/* Ana İçerik Alanı */}
      <main className="flex-1 flex flex-col">
        
        <header className="h-20 px-8 flex items-center justify-between border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-semibold text-slate-100">Hızlı Satış Noktası</h1>
            <span className="px-3 py-1 bg-slate-800 text-slate-400 rounded-full text-sm border border-slate-700">
              V 2.0
            </span>
          </div>
          
          <div className="flex items-center gap-6">
            <select 
              value={activeBranch}
              onChange={(e) => setActiveBranch(e.target.value as Branch)}
              className="bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 outline-none cursor-pointer"
            >
              <option value="Merkez Şube">Merkez Şube (Kasa 1)</option>
              <option value="Şube 2">Şube 2</option>
              <option value="Şube 3">Şube 3</option>
              <option value="Şube 4">Şube 4</option>
              <option value="Şube 5">Şube 5</option>
              <option value="Şube 6">Şube 6</option>
              <option value="Şube 7">Şube 7</option>
              <option value="Şube 8">Şube 8</option>
            </select>

            <button 
              onClick={playAlertSound} 
              className="relative p-2 text-slate-400 hover:text-slate-100 transition-colors"
              title="Test Bildirimi"
            >
              <span className="text-xl">🔔</span>
              <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 border-2 border-slate-900 rounded-full"></span>
            </button>
            
            <div className="w-10 h-10 bg-slate-700 rounded-full border-2 border-slate-600"></div>
          </div>
        </header>

        <div className="p-8 flex-1 overflow-y-auto">
          <div className="grid grid-cols-12 gap-6 h-full">
            
            <div className="col-span-8 bg-slate-900 rounded-2xl border border-slate-800 p-6 shadow-sm">
              <h2 className="text-lg font-medium mb-4">Ürün veya Barkod Okutun</h2>
              <div className="w-full h-12 bg-slate-800 rounded-xl border border-slate-700 mb-6 flex items-center px-4">
                <span className="text-slate-500">IMEI / Barkod...</span>
              </div>
              <div className="h-64 border-2 border-dashed border-slate-800 rounded-xl flex items-center justify-center text-slate-500">
                Ürün listesi buraya yüklenecek
              </div>
            </div>

            <div className="col-span-4 bg-slate-900 rounded-2xl border border-slate-800 p-6 flex flex-col shadow-sm">
              <h2 className="text-lg font-medium mb-4 border-b border-slate-800 pb-4">Satış Özeti</h2>
              <div className="flex-1">
                {/* Sepet Kalemleri */}
              </div>
              <div className="mt-auto pt-6 border-t border-slate-800 space-y-4">
                <div className="flex justify-between text-lg font-semibold text-slate-100">
                  <span>Toplam</span>
                  <span>0.00 TL</span>
                </div>
                <button className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-medium text-lg transition-colors shadow-lg shadow-emerald-900/20">
                  Ödeme Al
                </button>
              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}
