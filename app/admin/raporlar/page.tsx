// app/admin/raporlar/page.tsx
import React from 'react';

// 1. TypeScript için Veri Şemasını (Interface) tanımlıyoruz
interface BranchData {
  id: number;
  name: string;
  dailyRevenue: number;
  monthlyTarget: number;
  sales: number;
  repairs: number;
  status: string;
  bg: string;
}

// 2. Fonksiyonun bu şemaya uygun bir liste döneceğini (Promise<BranchData[]>) belirtiyoruz
async function getLiveBranchData(): Promise<BranchData[]> {
  const apiKey = process.env.GOOGLE_SHEETS_API_KEY;
  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
  
  const range = 'Sayfa1!A2:E9'; 

  try {
    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?key=${apiKey}`,
      { cache: 'no-store' }
    );
    
    if (!res.ok) throw new Error('Google Sheets bağlantı hatası');
    
    const data = await res.json();
    const rows = data.values || [];

    return rows.map((row: any, index: number): BranchData => {
      const target = row[2] ? Number(row[2]) : 0; 
      
      return {
        id: index + 1,
        name: row[0] || `Şube ${index + 1}`,
        dailyRevenue: row[1] ? Number(row[1]) : 0, 
        monthlyTarget: target,
        sales: row[3] ? Number(row[3]) : 0, 
        repairs: row[4] ? Number(row[4]) : 0, 
        status: target >= 75 ? 'text-emerald-500' : target >= 50 ? 'text-amber-500' : 'text-red-500',
        bg: target >= 75 ? 'bg-emerald-500' : target >= 50 ? 'bg-amber-500' : 'bg-red-500'
      };
    });
  } catch (error) {
    console.error('Veri çekilirken hata oluştu:', error);
    return []; 
  }
}

export default async function RaporlarPage() {
  const branchData = await getLiveBranchData();

  // 3. Tip tanımlamaları eklendiği için reduce fonksiyonu artık hata vermeyecek
  const totalRevenue = branchData.reduce((acc: number, curr: BranchData) => acc + curr.dailyRevenue, 0);
  const totalSales = branchData.reduce((acc: number, curr: BranchData) => acc + curr.sales, 0);
  const totalRepairs = branchData.reduce((acc: number, curr: BranchData) => acc + curr.repairs, 0);
  const avgTarget = branchData.length 
    ? Math.round(branchData.reduce((acc: number, curr: BranchData) => acc + curr.monthlyTarget, 0) / branchData.length) 
    : 0;

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Şube Performans Raporları</h1>
          <p className="text-slate-500 mt-1">Google Sheets üzerinden 8 şubenin anlık çekilen canlı verileri</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <p className="text-sm font-medium text-slate-500 mb-1">Toplam Günlük Ciro</p>
          <p className="text-2xl font-bold text-slate-800">{totalRevenue.toLocaleString('tr-TR')} ₺</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <p className="text-sm font-medium text-slate-500 mb-1">Satılan Toplam Cihaz</p>
          <p className="text-2xl font-bold text-slate-800">{totalSales} Adet</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <p className="text-sm font-medium text-slate-500 mb-1">Tamamlanan Servis</p>
          <p className="text-2xl font-bold text-slate-800">{totalRepairs} İşlem</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <p className="text-sm font-medium text-slate-500 mb-1">Ortalama Aylık Hedef</p>
          <p className="text-2xl font-bold text-blue-600">%{avgTarget}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-sm text-slate-600">
                <th className="py-4 px-6 font-semibold">Mağaza Adı</th>
                <th className="py-4 px-6 font-semibold">Günlük Ciro</th>
                <th className="py-4 px-6 font-semibold">Satış / Servis</th>
                <th className="py-4 px-6 font-semibold">Aylık Hedef Gerçekleşme</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {branchData.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-500 font-medium">
                    Veriler yüklenemedi. Lütfen .env dosyasındaki bilgileri kontrol edin.
                  </td>
                </tr>
              ) : (
                branchData.map((branch) => (
                  <tr key={branch.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-4 px-6 font-medium text-slate-800 flex items-center gap-3">
                      <div className="w-8 h-8 rounded bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                        {branch.id}
                      </div>
                      {branch.name}
                    </td>
                    <td className="py-4 px-6 font-semibold text-slate-700">
                      {branch.dailyRevenue.toLocaleString('tr-TR')} ₺
                    </td>
                    <td className="py-4 px-6 text-slate-500">
                      <span className="inline-flex items-center gap-1 bg-slate-100 px-2 py-1 rounded text-xs mr-2">
                        📱 {branch.sales}
                      </span>
                      <span className="inline-flex items-center gap-1 bg-slate-100 px-2 py-1 rounded text-xs">
                        🛠️ {branch.repairs}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${branch.bg}`} 
                            style={{ width: `${branch.monthlyTarget}%` }}
                          ></div>
                        </div>
                        <span className={`font-semibold w-9 text-right ${branch.status}`}>
                          %{branch.monthlyTarget}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
