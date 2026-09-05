"use client";

import React from "react";

/**
 * CNETMOBİL - Cihaz Alım ekranı
 *
 * Mevcut çalışan cihaz alım akışı page.tsx içinden ayrılmıştır.
 * Bu aşamada hesaplama/kayıt iş mantığı değiştirilmemiştir.
 */
export default function CihazAlim(props: any) {
  const {
    step,
    setStep,
    appMode,
    isZumay,
    displayBrands,
    brandDb,
    brandAssets,
    db,
    searchQuery,
    setSearchQuery,
    selectedBrand,
    setSelectedBrand,
    selectedModelName,
    setSelectedModelName,
    selectedCapacity,
    setSelectedCapacity,
    selectedColor,
    setSelectedColor,
    customer,
    setCustomer,
    status,
    setStatus,
    prices,
    purchaseType,
    setPurchaseType,
    isCustomOfferActive,
    setIsCustomOfferActive,
    customOffer,
    setCustomOffer,
    isCustomTradeOfferActive,
    setIsCustomTradeOfferActive,
    customTradeOffer,
    setCustomTradeOffer,
    resetSelection,
    allSelected,
    calculatedTradePrice,
    finalCashPrice,
    finalTradePrice,
    canProceed,
    showDocs,
    isYd,
    handleFinalProcess,
    servisFiyatlari,
    handleServisWhatsApp,
  } = props;

  return (
    step === 1 ? (
                <div className="space-y-12 text-slate-900 max-w-[1200px] mx-auto">
                  <div className="text-center space-y-4 mb-16 animate-in fade-in slide-in-from-top-4 duration-700 mt-10">
                      <h2 className="text-4xl md:text-6xl font-black italic tracking-tighter uppercase">
                        {appMode === 'alim' ? (
                          <span className="text-slate-900">CIHAZ <span className={isZumay ? 'text-red-600' : 'text-[#0052D4]'}>ALIM</span> SISTEMI</span>
                        ) : (
                          <span className="text-orange-950">TEKNIK <span className="text-orange-600">SERVIS</span> MERKEZI</span>
                        )}
                      </h2>
                      <p className="font-bold uppercase tracking-[0.2em] text-xs text-slate-400">Lütfen işlem yapılacak markayı seçin</p>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6 animate-in fade-in zoom-in duration-700 delay-200">
                    {displayBrands.map((brand: string) => {
                      const brandInfo = brandDb.find((b: any) => b.name === brand);
                      const finalLogo = brandInfo?.logo || brandAssets[brand]?.logo || "";
    
                      return (
                        <div key={brand} 
                             onClick={() => {
                               setSelectedBrand(brand); 
                               setStep(2); 
                               resetSelection();
                             }} 
                             className={`bg-white p-8 rounded-[40px] shadow-sm border flex flex-col items-center justify-center text-center h-64 group transition-all hover:-translate-y-2 hover:shadow-xl cursor-pointer btn-click ${appMode === 'servis' ? 'border-orange-100/50 hover:shadow-orange-200/50' : 'border-slate-100 hover:border-slate-200'}`}>
                          <div className="h-24 w-full flex items-center justify-center mb-6 transition-all duration-500 transform group-hover:scale-110">
                            <img src={finalLogo} className="max-h-full max-w-[120px] object-contain" alt={brand} />
                          </div>
                          <h2 className={`font-black text-xl mb-1 uppercase italic tracking-tighter ${appMode === 'servis' ? 'text-orange-950' : 'text-slate-800'}`}>{brand}</h2>
                          <p className={`text-[9px] font-black uppercase tracking-widest ${appMode === 'servis' ? 'text-orange-400' : 'text-slate-400'}`}>
                              {appMode === 'servis' ? 'SERVİS İŞLEMLERİ' : `${brand} CİHAZINI SAT`}
                          </p>
                          
                          <div className={`w-10 h-1 transition-all rounded-full mt-4 ${appMode === 'servis' ? 'bg-orange-100 group-hover:w-16 group-hover:bg-orange-500' : (isZumay ? 'bg-slate-100 group-hover:w-16 group-hover:bg-red-600' : 'bg-slate-100 group-hover:w-16 group-hover:bg-[#0052D4]')}`}></div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : step === 2 ? (
                <div className="animate-in slide-in-from-right-8 duration-500 text-slate-900 max-w-[1400px] mx-auto">
                  <div className="flex items-center justify-between mb-8 mt-4">
                      <button onClick={() => {setStep(1); resetSelection();}} className={`bg-white shadow-sm border px-6 py-3 rounded-2xl text-[10px] font-black uppercase transition-all btn-click flex items-center gap-2 ${appMode === 'servis' ? 'border-orange-200 text-orange-600 hover:text-orange-800 hover:bg-orange-50' : (isZumay ? 'border-slate-200 text-slate-500 hover:text-red-600 hover:bg-slate-50' : 'border-slate-200 text-slate-500 hover:text-[#0052D4 hover:bg-slate-50')}`}>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg>
                        Geri Dön
                      </button>
                      <div className="text-right">
                        <span className={`text-[10px] font-black uppercase tracking-widest ${appMode === 'servis' ? 'text-orange-600' : (isZumay ? 'text-red-600' : 'text-[#0052D4]')}`}>{selectedBrand}</span>
                        <h2 className="text-2xl font-black italic uppercase tracking-tighter">Model Seçimi</h2>
                      </div>
                  </div>
    
                  <div className="flex justify-center mb-10">
                    <div className="relative w-full max-w-xl">
                      <input
                        type="text"
                        placeholder="Modellerde ara..."
                        value={searchQuery}
                        onChange={(e: any) => setSearchQuery(e.target.value)}
                        className={`w-full p-5 pl-14 bg-white rounded-full text-sm font-black border outline-none focus:ring-4 shadow-sm transition-all placeholder-opacity-50 ${appMode === 'servis' ? 'border-orange-200 focus:border-orange-500 focus:ring-orange-50 text-orange-950 placeholder-orange-300' : (isZumay ? 'border-slate-200 focus:border-red-500 focus:ring-red-50 text-slate-700 placeholder-slate-400' : 'border-slate-200 focus:border-[#0052D4] focus:ring-blue-50 text-slate-700 placeholder-slate-400')}`}
                      />
                      <svg className={`w-6 h-6 absolute left-5 top-1/2 -translate-y-1/2 ${appMode === 'servis' ? 'text-orange-300' : 'text-slate-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    </div>
                  </div>
    
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
                    {Array.from(new Set<string>(db.filter((i: any) => i.brand === selectedBrand).map((i: any) => String(i.name || ''))))
                      .filter((name: string) => name.toLowerCase().includes(searchQuery.toLowerCase()))
                      .map((name: string) => (
                        <div key={name} onClick={() => {setSelectedModelName(name); setStep(3); resetSelection();}} className={`bg-white p-6 rounded-[32px] shadow-sm cursor-pointer border-2 border-transparent transition-all text-center btn-click group flex flex-col items-center justify-between min-h-[220px] ${appMode === 'servis' ? 'hover:shadow-xl hover:shadow-orange-100 hover:border-orange-400/50' : (isZumay ? 'hover:shadow-xl hover:border-red-500/50' : 'hover:shadow-xl hover:border-[#0052D4]/50')}`}>
                          <div className="h-32 flex items-center justify-center mb-4 transform group-hover:scale-110 transition-transform duration-500">
                              <img src={db.find((i: any) => i.name === name)?.img} className="max-h-full object-contain drop-shadow-xl" />
                          </div>
                          
                          <div className="w-full">
                            <p className={`font-black text-[12px] uppercase tracking-tighter leading-tight ${appMode === 'servis' ? 'text-orange-950' : 'text-slate-800'}`}>{name}</p>
                            <p className={`text-[9px] font-bold mt-2 uppercase tracking-widest ${appMode === 'servis' ? 'text-orange-400' : 'text-slate-400'}`}>
                                {appMode === 'servis' ? 'SERVİS SEÇENEKLERİ' : 'TELEFONUNU SAT'}
                            </p>
                          </div>
                        </div>
                      ))}
                  </div>
                  
                </div>
              ) : (
                <div className="flex flex-col lg:flex-row gap-8 animate-in fade-in duration-700 text-slate-900 max-w-[1400px] mx-auto mt-4">
                  
                  <div className="flex-1 space-y-6">
                    <button onClick={() => {setStep(2); resetSelection();}} className={`bg-white shadow-sm border px-6 py-3 rounded-2xl text-[10px] font-black uppercase transition-all btn-click flex items-center gap-2 w-max ${appMode === 'servis' ? 'border-orange-200 text-orange-500 hover:text-orange-700 hover:bg-orange-50' : (isZumay ? 'border-slate-200 text-slate-500 hover:text-red-600 hover:bg-slate-50' : 'border-slate-200 text-slate-500 hover:text-[#0052D4] hover:bg-slate-50')}`}>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg>
                      Modellere Dön
                    </button>
    
                    {appMode === 'servis' ? (
                      <div className="bg-white p-10 rounded-[48px] shadow-sm border border-orange-200 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none">
                            <svg className="w-40 h-40 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        </div>
                        
                        <div className="flex flex-col md:flex-row items-center gap-8 mb-10">
                            <div className="w-40 h-40 shrink-0 bg-orange-50 rounded-3xl p-4 flex items-center justify-center border border-orange-100">
                              <img src={db.find((i: any) => i.name === selectedModelName)?.img} className="max-h-full object-contain drop-shadow-xl" alt="Device" />
                            </div>
                            <div>
                              <span className="bg-orange-100 text-orange-700 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest">{selectedBrand}</span>
                              <h2 className="text-4xl font-black italic mt-3 uppercase tracking-tighter text-orange-950">{selectedModelName}</h2>
                              <p className="text-orange-500/80 font-bold uppercase tracking-widest text-[10px] mt-2">Teknik Servis Onarım Fiyatları</p>
                            </div>
                        </div>
    
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                            <div className="bg-orange-50/50 p-6 rounded-[32px] border border-orange-100 text-center hover:bg-orange-50 hover:shadow-lg transition-all group flex flex-col justify-between">
                              <div>
                                  <div className="text-3xl mb-4 grayscale group-hover:grayscale-0 transition-all">📱</div>
                                  <p className="text-[11px] font-black text-orange-800/60 uppercase tracking-widest mb-2">Ekran Değişimi</p>
                              </div>
                              
                              <div className="flex flex-col gap-2 mt-4 text-left bg-white/60 p-4 rounded-2xl border border-orange-200/50 shadow-sm">
                                  <div className="flex justify-between items-center border-b border-orange-100 pb-1">
                                    <span className="text-[10px] font-black text-orange-900 uppercase">Orjinal:</span> 
                                    <span className="font-black text-sm italic text-orange-950">{servisFiyatlari[selectedModelName]?.ekranOrj || servisFiyatlari[selectedModelName]?.ekran ? `${Number(servisFiyatlari[selectedModelName]?.ekranOrj || servisFiyatlari[selectedModelName]?.ekran).toLocaleString()} TL` : '-'}</span>
                                  </div>
                                  <div className="flex justify-between items-center border-b border-orange-100 pb-1">
                                    <span className="text-[10px] font-black text-orange-900 uppercase">OLED:</span> 
                                    <span className="font-black text-sm italic text-orange-950">{servisFiyatlari[selectedModelName]?.ekranOled ? `${Number(servisFiyatlari[selectedModelName]?.ekranOled).toLocaleString()} TL` : '-'}</span>
                                  </div>
                                  {selectedBrand?.toLowerCase() === 'apple' && (
                                  <div className="flex justify-between items-center">
                                    <span className="text-[10px] font-black text-orange-900 uppercase">Çipli:</span> 
                                    <span className="font-black text-sm italic text-orange-950">{servisFiyatlari[selectedModelName]?.ekranCipli ? `${Number(servisFiyatlari[selectedModelName]?.ekranCipli).toLocaleString()} TL` : '-'}</span>
                                  </div>
                                  )}
                              </div>
                            </div>
    
                            <div className="bg-orange-50/50 p-6 rounded-[32px] border border-orange-100 text-center hover:bg-orange-50 hover:shadow-lg transition-all group flex flex-col justify-between">
                              <div>
                                  <div className="text-3xl mb-4 grayscale group-hover:grayscale-0 transition-all">🔋</div>
                                  <p className="text-[11px] font-black text-orange-800/60 uppercase tracking-widest mb-2">Batarya Değişimi</p>
                              </div>
                              <div className="text-2xl font-black italic tracking-tighter text-orange-900 mt-4">
                                  {servisFiyatlari[selectedModelName]?.batarya ? `${Number(servisFiyatlari[selectedModelName]?.batarya).toLocaleString()} TL` : 'Fiyat Yok'}
                              </div>
                            </div>
    
                            <div className="bg-orange-50/50 p-6 rounded-[32px] border border-orange-100 text-center hover:bg-orange-50 hover:shadow-lg transition-all group flex flex-col justify-between">
                              <div>
                                  <div className="text-3xl mb-4 grayscale group-hover:grayscale-0 transition-all">💠</div>
                                  <p className="text-[11px] font-black text-orange-800/60 uppercase tracking-widest mb-2">Arka Cam</p>
                              </div>
                              <div className="text-2xl font-black italic tracking-tighter text-orange-900 mt-4">
                                  {servisFiyatlari[selectedModelName]?.arkaCam ? `${Number(servisFiyatlari[selectedModelName]?.arkaCam).toLocaleString()} TL` : 'Fiyat Yok'}
                              </div>
                            </div>
    
                            <div className="bg-orange-50/50 p-6 rounded-[32px] border border-orange-100 text-center hover:bg-orange-50 hover:shadow-lg transition-all group flex flex-col justify-between">
                              <div>
                                  <div className="text-3xl mb-4 grayscale group-hover:grayscale-0 transition-all">🛠</div>
                                  <p className="text-[11px] font-black text-orange-800/60 uppercase tracking-widest mb-2">Kasa Değişimi</p>
                              </div>
                              <div className="text-2xl font-black italic tracking-tighter text-orange-900 mt-4">
                                  {servisFiyatlari[selectedModelName]?.kasa ? `${Number(servisFiyatlari[selectedModelName]?.kasa).toLocaleString()} TL` : 'Fiyat Yok'}
                              </div>
                            </div>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-100 relative overflow-hidden group">
                          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                            <div>
                              <h3 className="text-lg font-black italic tracking-tighter text-slate-900 uppercase">EKSPERTİZ & GÜVENLİK</h3>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Lütfen tüm bilgileri eksiksiz doldurun</p>
                            </div>
                            {customer.imei.length === 15 && (
                              <button type="button" onClick={() => window.open(`https://www.turkiye.gov.tr/imei-sorgulama`, '_blank')} className={`text-white px-5 py-2.5 rounded-xl text-[10px] font-black animate-pulse transition-all flex items-center gap-2 shadow-md ${isZumay ? 'bg-red-600 hover:bg-red-700' : 'bg-[#0052D4] hover:bg-blue-700'}`}>
                                BTK IMEI SORGULA
                              </button>
                            )}
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-4">
                              <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 ml-4 uppercase tracking-widest">Müşteri Adı Soyadı</label>
                                <input placeholder="Ad Soyad" className={`w-full p-4 bg-slate-50 rounded-2xl text-xs outline-none border border-slate-100 font-black uppercase focus:bg-white transition-all shadow-sm ${isZumay ? 'focus:border-red-500' : 'focus:border-[#0052D4]'}`} value={customer.name} onChange={(e: any)=>setCustomer({...customer, name: e.target.value})} />
                              </div>
                              <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 ml-4 uppercase tracking-widest">İletişim Numarası</label>
                                <input placeholder="05XX XXX XX XX" className={`w-full p-4 bg-slate-50 rounded-2xl text-xs outline-none border border-slate-100 font-black focus:bg-white transition-all shadow-sm ${isZumay ? 'focus:border-red-500' : 'focus:border-[#0052D4]'}`} value={customer.phone} onChange={(e: any)=>setCustomer({...customer, phone: e.target.value})} />
                              </div>
                              <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 ml-4 uppercase tracking-widest">IMEI Numarası (15 Hane)</label>
                                <input placeholder="IMEI Giriniz" className={`w-full p-4 bg-slate-50 rounded-2xl text-xs outline-none border border-slate-100 font-black uppercase focus:bg-white transition-all shadow-sm ${isZumay ? 'focus:border-red-500' : 'focus:border-[#0052D4]'}`} value={customer.imei} maxLength={15} onChange={(e: any) => setCustomer({...customer, imei: e.target.value.replace(/\D/g, '')})} />
                              </div>
                            </div>
    
                            <div className="bg-red-50/50 p-6 rounded-[24px] border border-red-100/50 space-y-4 flex flex-col justify-center shadow-inner">
                              <p className="text-[11px] font-black text-red-700 uppercase italic tracking-widest flex items-center gap-2 mb-2">
                                <span className="w-2 h-2 bg-red-600 rounded-full animate-ping"></span>
                                Personel Onay Listesi
                              </p>
                              {[
                                "Hesaplardan çıkış yapıldı",
                                "Bul (Find My) kapatıldı",
                                "Kayıt durumu kontrol edildi",
                                "Şifreler tamamen silindi"
                              ].map((item, idx) => (
                                <label key={idx} className="flex items-center gap-3 cursor-pointer group select-none">
                                  <input type="checkbox" className="w-5 h-5 accent-red-600 rounded-lg cursor-pointer" />
                                  <span className="text-[12px] font-black text-slate-600 group-hover:text-red-700 transition-colors uppercase italic">{item}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        </div>
    
                        <div className="space-y-4">
                          <div className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-100">
                            <p className="text-[11px] font-black mb-4 text-slate-400 uppercase tracking-widest flex items-center gap-2">
                              <span className={`w-4 h-[3px] ${isZumay ? 'bg-red-600' : 'bg-[#0052D4]'}`}></span>
                              Hafıza Kapasitesi
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {db.filter((i: any) => i.name === selectedModelName).map((c: any) => (
                                <button key={c.cap} onClick={() => setSelectedCapacity(c)} className={`px-8 py-4 rounded-xl font-black text-[12px] transition-all btn-click ${selectedCapacity?.cap === c.cap ? (isZumay ? 'bg-red-600 text-white shadow-xl shadow-red-200 ring-4 ring-red-50' : 'bg-[#0052D4] text-white shadow-xl shadow-blue-200 ring-4 ring-blue-50') : 'bg-slate-50 text-slate-500 border border-slate-200 hover:bg-slate-100'}`}>{c.cap}</button>
                              ))}
                            </div>
                          </div>
    
                          {selectedModelName === "iPhone 13" && (
                            <div className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-100">
                              <p className="text-[11px] font-black mb-4 text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <span className={`w-4 h-[3px] ${isZumay ? 'bg-red-600' : 'bg-[#0052D4]'}`}></span>
                                Renk Seçimi (Beyaz +%5)
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {['Diğer', 'Beyaz'].map((color: string) => (
                                  <button key={color} onClick={() => setSelectedColor(color)} className={`px-8 py-4 rounded-xl font-black text-[12px] transition-all btn-click ${selectedColor === color ? 'bg-slate-900 text-white shadow-xl ring-4 ring-slate-100' : 'bg-slate-50 text-slate-500 border border-slate-200 hover:bg-slate-100'}`}>{color}</button>
                                ))}
                              </div>
                            </div>
                          )}
    
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {[
                              { label: "Cihaz Açılıyor mu?", field: "power", opts: ['Evet', 'Hayır'] },
                              { label: "Ekran Durumu", field: "screen", opts: selectedBrand?.toLowerCase() === 'apple' ? ['Sağlam', 'Çizikler var', 'Kırık', 'Bilinmeyen Parça'] : ['Sağlam', 'Çizikler var', 'Kırık'] },
                              { label: "Kozmetik Durum", field: "cosmetic", opts: ['Mükemmel', 'İyi', 'Kötü'] },
                              { label: "Face ID / Touch ID", field: "faceId", opts: ['Evet', 'Hayır'] },
                              { label: "Batarya Sağlığı", field: "battery", opts: ['95-100', '85-95', '0-85', 'Bilinmeyen Parça'] },
                              { label: "Ahize / Buzzer", field: "speaker", opts: ['Sağlam', 'Cızırtı var', 'Arızalı'] },
                              { label: "Kayıt Durumu", field: "sim", opts: ['Fiziksel SIM (TR)', 'Fiziksel + eSIM (YD)'] },
                              { label: "Garanti ve Durum", field: "warranty", opts: ['Üretici Garantili', 'Yenilenmiş Cihaz', 'Garanti Yok'] }
                            ].map((q: { label: string; field: string; opts: string[] }) => (
                              <div key={q.field} className="bg-white p-6 rounded-[28px] shadow-sm border border-slate-100">
                                <p className="text-[10px] font-black mb-3 text-slate-400 uppercase tracking-widest">{q.label}</p>
                                <div className="flex flex-wrap gap-2">
                                  {q.opts.map((opt: string) => (
                                    <button key={opt} onClick={() => setStatus({...status, [q.field]: opt})} className={`py-2.5 px-4 rounded-xl text-[11px] font-black border-2 transition-all btn-click ${status[q.field] === opt ? 'bg-slate-900 text-white border-slate-900 shadow-md' : 'bg-white text-slate-500 border-slate-100 hover:border-slate-300 hover:text-slate-700'}`}>{opt}</button>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                  
                  <div className="lg:w-[350px] space-y-6 sticky top-32 h-fit">
                    {appMode === 'servis' ? (
                      <div className="bg-white border border-orange-200 p-8 rounded-[32px] space-y-4 shadow-xl">
                          <div className="w-16 h-16 bg-orange-50 border border-orange-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                              <svg className="w-8 h-8 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2-2v14a2 2 0 002 2z" /></svg>
                          </div>
                          <h3 className="text-xl font-black italic text-orange-950 uppercase text-center mb-4">Müşteriye İlet</h3>
                          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest text-center mb-6">Fiyat teklifini direkt WhatsApp üzerinden müşteriye gönderebilirsiniz.</p>
                          
                          <button onClick={handleServisWhatsApp} className="w-full py-4 rounded-xl font-black uppercase text-[11px] tracking-widest transition-all btn-click flex items-center justify-center gap-2 shadow-lg bg-[#25D366] text-white hover:bg-[#128C7E] shadow-green-900/20">
                              WHATSAPP'TAN GÖNDER
                          </button>
                      </div>
                    ) : (
                      <>
                        <div className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-100 flex flex-col items-center">
                           <img src={db.find((i: any) => i.name === selectedModelName)?.img} className="h-32 object-contain drop-shadow-xl mb-4" />
                           <h3 className="font-black italic text-center text-slate-800 text-lg uppercase leading-tight">
                             {selectedModelName} {selectedCapacity?.cap} {selectedModelName === "iPhone 13" && selectedColor !== 'Diğer' ? `(${selectedColor})` : ''}
                           </h3>
                        </div>
    
                        {isYd ? (
                          <div className="bg-red-50 p-8 rounded-[32px] shadow-md border-2 border-red-500 text-center animate-pulse">
                            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">⚠️</div>
                            <p className="text-xl font-black uppercase italic leading-none tracking-tighter text-red-700">YURT DIŞI CIHAZ</p>
                            <p className="text-[9px] mt-3 uppercase tracking-[0.2em] font-black opacity-80 text-red-600">BU CIHAZ ICIN YONETICI ONAYI GEREKLIDIR</p>
                          </div>
                        ) : (
                          <div className="space-y-6 animate-in zoom-in-95 duration-500">
                            
                            <div className="bg-white p-8 rounded-[32px] shadow-xl border border-slate-100 text-center transition-all hover:-translate-y-1">
                              <p className="text-[11px] font-black text-slate-400 uppercase mb-4 tracking-widest italic">Nakit Alış Teklifi</p>
                              <div className="text-4xl font-black italic tracking-tighter text-slate-900">
                                {selectedCapacity && allSelected ? `${finalCashPrice.toLocaleString()} TL` : '---'}
                              </div>
                              
                              {selectedCapacity && allSelected && !purchaseType && (
                                <div className="mt-4">
                                  {!isCustomOfferActive ? (
                                    <button onClick={() => setIsCustomOfferActive(true)} className={`text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl transition-colors border ${isZumay ? 'text-red-600 hover:text-red-800 hover:bg-red-50 border-red-200' : 'text-[#0052D4] hover:text-blue-800 hover:bg-blue-50 border-blue-200'}`}>
                                      Teklifi Revize Et
                                    </button>
                                  ) : (
                                    <div className="flex flex-col items-center gap-2 animate-in fade-in duration-300">
                                      <div className="flex items-center gap-2">
                                        <input 
                                          type="number" 
                                          value={customOffer} 
                                          onChange={(e: any) => {
                                            const valStr = e.target.value;
                                            if (valStr === '') { setCustomOffer(''); return; }
                                            const val = parseInt(valStr) || 0;
                                            if (val > prices.cash) {
                                              alert(`Sistem teklifinden (${prices.cash} TL) yüksek bir fiyat giremezsiniz!`);
                                              setCustomOffer(prices.cash.toString());
                                            } else {
                                              setCustomOffer(valStr);
                                            }
                                          }} 
                                          placeholder="Yeni Tutar" 
                                          className={`w-28 p-3 bg-slate-50 border rounded-xl text-sm font-black text-center outline-none ${isZumay ? 'focus:border-red-500 border-slate-200' : 'focus:border-[#0052D4] border-slate-200'}`}
                                        />
                                        <button onClick={() => {setIsCustomOfferActive(false); setCustomOffer('');}} className="bg-red-50 text-red-600 p-3 rounded-xl hover:bg-red-100 transition-colors" title="İptal">
                                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                            
                            <div className={`${isZumay ? 'bg-red-600' : 'bg-[#0052D4]'} p-8 rounded-[32px] shadow-2xl text-center text-white relative overflow-hidden hover:-translate-y-1 transition-all`}>
                              <p className={`text-[11px] font-black uppercase mb-4 tracking-widest italic ${isZumay ? 'text-red-200' : 'text-blue-200'}`}>Takas Desteği İle</p>
                              <div className="text-4xl font-black italic tracking-tighter">
                                {selectedCapacity && allSelected ? `${finalTradePrice.toLocaleString()} TL` : '---'}
                              </div>
                              
                              {selectedCapacity && allSelected && !purchaseType && (
                                <div className="mt-4 relative z-10">
                                  {!isCustomTradeOfferActive ? (
                                    <button onClick={() => setIsCustomTradeOfferActive(true)} className={`text-[10px] font-black text-white uppercase tracking-widest px-4 py-2 rounded-xl transition-colors border shadow-inner ${isZumay ? 'hover:text-red-100 bg-red-700 border-red-500' : 'hover:text-blue-100 bg-blue-700 border-blue-500'}`}>
                                      Teklifi Revize Et
                                    </button>
                                  ) : (
                                    <div className="flex flex-col items-center gap-2 animate-in fade-in duration-300">
                                      <div className="flex items-center gap-2">
                                        <input 
                                          type="number" 
                                          value={customTradeOffer} 
                                          onChange={(e: any) => {
                                            const valStr = e.target.value;
                                            if (valStr === '') { setCustomTradeOffer(''); return; }
                                            const val = parseInt(valStr) || 0;
                                            if (val > calculatedTradePrice) {
                                              alert(`Sistem teklifinden (${calculatedTradePrice} TL) yüksek bir fiyat giremezsiniz!`);
                                              setCustomTradeOffer(calculatedTradePrice.toString());
                                            } else {
                                              setCustomTradeOffer(valStr);
                                            }
                                          }} 
                                          placeholder="Yeni Tutar" 
                                          className={`w-28 p-3 border rounded-xl text-sm font-black text-center outline-none focus:border-white text-white ${isZumay ? 'bg-red-700 border-red-500 placeholder-red-300' : 'bg-blue-700 border-blue-500 placeholder-blue-300'}`}
                                        />
                                        <button onClick={() => {setIsCustomTradeOfferActive(false); setCustomTradeOffer('');}} className="bg-slate-900 text-white p-3 rounded-xl hover:bg-black transition-colors" title="İptal">
                                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
    
                        <div className="bg-slate-900 p-8 rounded-[32px] space-y-4 shadow-2xl">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center mb-2">1. İŞLEM TÜRÜN SEÇİN</p>
                          
                          <div className="flex gap-3">
                              <button 
                                  disabled={!canProceed || purchaseType !== null} 
                                  onClick={() => { setPurchaseType('NAKİT'); handleFinalProcess('NAKİT ALINDI'); }} 
                                  className={`flex-1 py-4 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all 
                                  ${!canProceed || (purchaseType && purchaseType !== 'NAKİT') ? 'opacity-30 cursor-not-allowed bg-slate-800 text-slate-600' : ''} 
                                  ${purchaseType === 'NAKİT' ? 'bg-[#2ecc71] text-white shadow-lg shadow-green-900/50 cursor-default' : ''} 
                                  ${canProceed && !purchaseType ? 'btn-click bg-slate-800 text-slate-300 hover:bg-[#2ecc71] hover:text-white' : ''}`}>
                                  NAKİT
                              </button>
                              <button 
                                  disabled={!canProceed || purchaseType !== null} 
                                  onClick={() => { setPurchaseType('TAKAS'); handleFinalProcess('TAKAS ALINDI'); }} 
                                  className={`flex-1 py-4 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all 
                                  ${!canProceed || (purchaseType && purchaseType !== 'TAKAS') ? 'opacity-30 cursor-not-allowed bg-slate-800 text-slate-600' : ''} 
                                  ${purchaseType === 'TAKAS' ? 'bg-[#0052D4] text-white shadow-lg shadow-blue-900/50 cursor-default' : ''} 
                                  ${canProceed && !purchaseType ? 'btn-click bg-slate-800 text-slate-300 hover:bg-[#0052D4] hover:text-white' : ''}`}>
                                  TAKAS
                              </button>
                          </div>
                          
                          <button 
                              disabled={!canProceed || purchaseType !== null} 
                              onClick={() => { setPurchaseType('ALINMADI'); handleFinalProcess('ALINMADI'); }} 
                              className={`w-full py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all 
                              ${!canProceed || (purchaseType && purchaseType !== 'ALINMADI') ? 'opacity-30 cursor-not-allowed bg-slate-800 text-slate-600' : ''} 
                              ${purchaseType === 'ALINMADI' ? 'bg-red-500 text-white shadow-lg shadow-red-900/50 cursor-default' : ''} 
                              ${canProceed && !purchaseType ? 'btn-click bg-slate-800 text-red-400 hover:bg-red-500 hover:text-white' : ''}`}>
                              ALINMADI
                          </button>
    
                          <div className={`pt-6 mt-6 border-t border-slate-800 space-y-3 transition-all duration-500 ${showDocs ? 'opacity-100 translate-y-0' : 'opacity-20 pointer-events-none translate-y-2'}`}>
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">2. BELGE VE BİLDİRİM</p>
                              <div className="flex gap-3">
                                <button disabled={!showDocs} onClick={() => handleFinalProcess('print')} className={`flex-1 py-4 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all btn-click shadow-lg ${showDocs ? 'bg-white text-slate-950 hover:bg-slate-200' : 'bg-slate-800 text-slate-600'}`}>
                                  YAZDIR
                                </button>
                                <button disabled={!showDocs} onClick={() => handleFinalProcess('whatsapp')} className={`flex-1 py-4 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all btn-click shadow-lg ${showDocs ? 'bg-[#25D366] text-white hover:bg-[#128C7E] shadow-green-900/40' : 'bg-slate-800 text-slate-600'}`}>
                                  WHATSAPP
                                </button>
                              </div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                  
                </div>
              )
  );
}
