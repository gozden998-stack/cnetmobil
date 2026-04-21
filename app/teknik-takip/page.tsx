import React, { useState } from 'react';
import { Save, Plus, Smartphone, User, CheckCircle, XCircle, Trash2 } from 'lucide-react';

const TeknikTakipTablosu = () => {
  // Manuel olarak güncelleyebileceğin isim listeleri
  const USTALAR = ["Hakan Usta", "Murat Usta", "Zeki Usta", "Veli Usta"];
  const TEST_PERSONELI = ["Ahmet", "Mehmet", "Can", "Elif"];

  // Tablo satırlarını yöneten state
  const [satirlar, setSatirlar] = useState([
    { id: Date.now(), usta: '', markaModel: '', imei: '', ariza: '', tamirDurumu: 'Evet', neden: '', testYapan: '', kaydedildi: false }
  ]);

  // Yeni boş satır ekleme
  const yeniSatirEkle = () => {
    setSatirlar([...satirlar, { id: Date.now(), usta: '', markaModel: '', imei: '', ariza: '', tamirDurumu: 'Evet', neden: '', testYapan: '', kaydedildi: false }]);
  };

  // Satır silme
  const satirSil = (id) => {
    setSatirlar(satirlar.filter(s => s.id !== id));
  };

  // Veri değişimi
  const veriGuncelle = (id, alan, deger) => {
    setSatirlar(satirlar.map(s => s.id === id ? { ...s, [alan]: deger } : s));
  };

  // Kaydetme işlemi
  const satirKaydet = (id) => {
    setSatirlar(satirlar.map(s => s.id === id ? { ...s, kaydedildi: true } : s));
    alert("Kayıt Başarıyla Sisteme İşlendi!");
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200 p-2 md:p-6 font-sans">
      
      {/* ÜST BAŞLIK */}
      <div className="max-w-[1400px] mx-auto flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-tighter text-white flex items-center gap-2">
            <CheckCircle className="text-emerald-500" /> TEKNİK SERVİS KALİTE KONTROL
          </h1>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Hata Payını Sıfıra İndirir</p>
        </div>
        <button 
          onClick={yeniSatirEkle}
          className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-2xl text-xs font-black flex items-center gap-2 transition-all shadow-xl shadow-blue-900/20"
        >
          <Plus size={18} /> YENİ SATIR EKLE
        </button>
      </div>

      {/* TABLO ALANI */}
      <div className="max-w-[1400px] mx-auto bg-slate-900/50 border border-slate-800 rounded-3xl overflow-x-auto shadow-2xl">
        <table className="w-full text-left border-collapse min-w-[1000px]">
          <thead className="bg-slate-800/80 text-[10px] uppercase font-black tracking-widest text-slate-400">
            <tr>
              <th className="p-4 border-b border-slate-700">Tamir Yapan Usta</th>
              <th className="p-4 border-b border-slate-700">Marka / Model</th>
              <th className="p-4 border-b border-slate-700">IMEI</th>
              <th className="p-4 border-b border-slate-700">Arıza</th>
              <th className="p-4 border-b border-slate-700">Tamir Sorunsuz mu?</th>
              <th className="p-4 border-b border-slate-700">Değilse Neden?</th>
              <th className="p-4 border-b border-slate-700">Test Yapan</th>
              <th className="p-4 border-b border-slate-700 text-center">İşlem</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {satirlar.map((satir) => (
              <tr key={satir.id} className={`transition-all ${satir.kaydedildi ? 'bg-emerald-900/10 opacity-70' : 'hover:bg-slate-800/30'}`}>
                
                {/* Usta Seçimi */}
                <td className="p-2">
                  <select 
                    value={satir.usta} 
                    onChange={(e) => veriGuncelle(satir.id, 'usta', e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs outline-none focus:border-blue-500"
                  >
                    <option value="">Seçiniz...</option>
                    {USTALAR.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </td>

                {/* Marka Model */}
                <td className="p-2">
                  <input 
                    type="text" 
                    placeholder="Örn: iPhone 11" 
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs outline-none focus:border-blue-500"
                    onChange={(e) => veriGuncelle(satir.id, 'markaModel', e.target.value)}
                  />
                </td>

                {/* IMEI */}
                <td className="p-2">
                  <input 
                    type="text" 
                    placeholder="15 Hane" 
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-[10px] font-mono outline-none focus:border-blue-500"
                    onChange={(e) => veriGuncelle(satir.id, 'imei', e.target.value)}
                  />
                </td>

                {/* Arıza */}
                <td className="p-2">
                  <input 
                    type="text" 
                    placeholder="Arıza detayı" 
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs outline-none focus:border-blue-500"
                    onChange={(e) => veriGuncelle(satir.id, 'ariza', e.target.value)}
                  />
                </td>

                {/* Tamir Durumu */}
                <td className="p-2">
                  <select 
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs outline-none"
                    onChange={(e) => veriGuncelle(satir.id, 'tamirDurumu', e.target.value)}
                  >
                    <option value="Evet">Evet (Sorunsuz)</option>
                    <option value="Hayır">Hayır (Sorunlu)</option>
                  </select>
                </td>

                {/* Neden? */}
                <td className="p-2">
                  <input 
                    type="text" 
                    placeholder="Sorun varsa yazın" 
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs outline-none focus:border-red-500"
                    onChange={(e) => veriGuncelle(satir.id, 'neden', e.target.value)}
                  />
                </td>

                {/* Test Yapan Personel */}
                <td className="p-2">
                  <select 
                    value={satir.testYapan} 
                    onChange={(e) => veriGuncelle(satir.id, 'testYapan', e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs outline-none focus:border-blue-500"
                  >
                    <option value="">Seçiniz...</option>
                    {TEST_PERSONELI.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </td>

                {/* Kaydet ve Sil Butonları */}
                <td className="p-2 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <button 
                      onClick={() => satirKaydet(satir.id)}
                      className={`p-2 rounded-lg transition-all ${satir.kaydedildi ? 'bg-emerald-600 text-white' : 'bg-blue-600 hover:bg-blue-500 text-white'}`}
                    >
                      <Save size={16} />
                    </button>
                    <button 
                      onClick={() => satirSil(satir.id)}
                      className="p-2 bg-slate-700 hover:bg-red-900 text-slate-400 hover:text-white rounded-lg transition-all"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TeknikTakipTablosu;
