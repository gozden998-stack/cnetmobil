"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation'; // Yönlendirme eklendi

export default function PartnerDashboard() {
  const router = useRouter();
  
  // Form durum (state) yönetimi
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Şimdilik şifre kontrolü yapmadan DİREKT değerleme ekranına atıyoruz
    alert("Giriş başarılı! Değerleme ekranına yönlendiriliyorsunuz...");
    router.push('/partner/degerleme'); 
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      
      {/* Üst Koyu Alan */}
      <div className="bg-[#2b2b36] w-full pt-10 pb-32 px-4 text-center">
        <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
          İşinizi <span className="text-orange-500">Cnetmobil</span> ile Dijitalleştirin
        </h1>
      </div>

      {/* Form ve İçerik Alanı (Koyu alanın üzerine taşmış görünüm) */}
      <div className="max-w-3xl w-full mx-auto px-4 -mt-20">
        
        {/* Giriş Kutusu */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="flex border-b mb-6">
            <button className="flex-1 pb-3 text-center font-bold text-orange-500 border-b-2 border-orange-500">
              Giriş Yap
            </button>
            <button className="flex-1 pb-3 text-center font-medium text-gray-400 hover:text-gray-600 transition-colors">
              Kayıt Ol
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="mail@mail.com" 
                className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all" 
                required 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Şifre</label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••" 
                className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all" 
                required 
              />
              <div className="text-right mt-2">
                <a href="#" className="text-xs text-orange-500 hover:underline">Şifremi unuttum</a>
              </div>
            </div>
            
            <button type="submit" className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 rounded-lg transition-colors mt-4">
              Giriş Yap
            </button>
          </form>
        </div>

        {/* 4'lü Hızlı Menü */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { icon: "📦", title: "Akıllı Sipariş Takibi" },
            { icon: "💳", title: "Şeffaf Ödeme Altyapısı" },
            { icon: "📱", title: "Cihaz Değerleme" },
            { icon: "📊", title: "Raporlama ve Analiz" }
          ].map((item, index) => (
            <div key={index} onClick={() => router.push('/partner/degerleme')} className="bg-white p-6 rounded-xl shadow-sm text-center flex flex-col items-center justify-center cursor-pointer hover:shadow-md transition-all border border-gray-100">
              <span className="text-3xl mb-3">{item.icon}</span>
              <span className="text-sm font-medium text-gray-700">{item.title}</span>
            </div>
          ))}
        </div>

        {/* İstatistikler */}
        <div className="bg-orange-500 rounded-xl shadow-md p-6 flex flex-wrap justify-between text-white mb-8">
          <div className="text-center w-1/3 border-r border-orange-400">
            <div className="text-2xl font-bold">8+</div>
            <div className="text-xs md:text-sm mt-1">Aktif Şube</div>
          </div>
          <div className="text-center w-1/3 border-r border-orange-400">
            <div className="text-2xl font-bold">5 Dk</div>
            <div className="text-xs md:text-sm mt-1">Hızlı Veri Senkronu</div>
          </div>
          <div className="text-center w-1/3">
            <div className="text-2xl font-bold">%100</div>
            <div className="text-xs md:text-sm mt-1">Güvenli Altyapı</div>
          </div>
        </div>

      </div>
    </div>
  );
}
