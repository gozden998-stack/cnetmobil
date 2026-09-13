"use client";

import React, { FormEvent, useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";

type Model = "iPhone 18 Pro" | "iPhone 18 Pro Max" | "iPhone Duo";
type Storage = "256 GB" | "512 GB" | "1 TB" | "2 TB";
type PaymentType = "deposit" | "full";
type ModalStep = "config" | "payment" | "done";
type ColorItem = { name: string; value: string };

const MODELS: Model[] = ["iPhone 18 Pro", "iPhone 18 Pro Max", "iPhone Duo"];
const STORAGES: Storage[] = ["256 GB", "512 GB", "1 TB", "2 TB"];

const PRICES: Record<Model, Record<Storage, number>> = {
  "iPhone 18 Pro": { "256 GB": 137999, "512 GB": 154999, "1 TB": 188999, "2 TB": 243999 },
  "iPhone 18 Pro Max": { "256 GB": 149999, "512 GB": 166999, "1 TB": 200999, "2 TB": 255999 },
  "iPhone Duo": { "256 GB": 229999, "512 GB": 246999, "1 TB": 280999, "2 TB": 335999 },
};

const COLORS: Record<Model, ColorItem[]> = {
  "iPhone 18 Pro": [
    { name: "Siyah", value: "#15171b" },
    { name: "Buzul Rengi", value: "#94bdf0" },
    { name: "Burgonya", value: "#722c50" },
    { name: "Gümüş Rengi", value: "#d8d9dc" },
  ],
  "iPhone 18 Pro Max": [
    { name: "Siyah", value: "#15171b" },
    { name: "Buzul Rengi", value: "#94bdf0" },
    { name: "Burgonya", value: "#722c50" },
    { name: "Gümüş Rengi", value: "#d8d9dc" },
  ],
  "iPhone Duo": [
    { name: "Gece Rengi", value: "#10151d" },
    { name: "Yıldız Rengi", value: "#e0d9cc" },
  ],
};

const STORES = ["CMR / Çerkezköy", "Cadde / Çerkezköy", "Saray", "Kapaklı"];

const COMPANY_NAME = "CENNET ELEKTRONİK İLETİŞİM HİZMETLERİ SANAYİ VE TİCARET LİMİTED ŞİRKETİ";
const IBAN_RAW = "TR030004600563888000239559";
const IBAN_DISPLAY = "TR03 0004 6005 6388 8000 2395 59";

function money(value: number) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export default function Iphone18PreorderPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalStep, setModalStep] = useState<ModalStep>("config");
  const [model, setModel] = useState<Model>("iPhone 18 Pro");
  const [storage, setStorage] = useState<Storage>("256 GB");
  const [color, setColor] = useState("Siyah");
  const [store, setStore] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [paymentType, setPaymentType] = useState<PaymentType>("deposit");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [copied, setCopied] = useState(false);

  const colors = COLORS[model];
  const price = PRICES[model][storage];
  const isDuo = model === "iPhone Duo";
  const selectedColor = colors.find((item) => item.name === color) || colors[0];
  const paymentAmount = paymentType === "deposit" ? roundMoney(price * 0.1) : price;

  const description = useMemo(() => {
    if (model === "iPhone 18 Pro Max") return "Daha büyük. Daha güçlü.";
    if (model === "iPhone Duo") return "Yeni bir dönemin başlangıcı.";
    return "Profesyoneller için.";
  }, [model]);

  const paymentDescription = useMemo(() => {
    const safeName = name.trim().toLocaleUpperCase("tr-TR") || "MUSTERI";
    const safePhone = phone.replace(/\s/g, "") || "TELEFON";
    return `IPH18 - ${safeName} - ${safePhone}`;
  }, [name, phone]);

  const qrValue = useMemo(() => {
    return [
      "CNETMOBIL IPHONE 18 ODEME",
      `ALICI: ${COMPANY_NAME}`,
      `IBAN: ${IBAN_RAW}`,
      `TUTAR: ${paymentAmount.toFixed(2)} TL`,
      `ACIKLAMA: ${paymentDescription}`,
    ].join("\n");
  }, [paymentAmount, paymentDescription]);

  useEffect(() => {
    document.body.style.overflow = modalOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [modalOpen]);

  function resetFeedback() {
    setError("");
    setSuccess("");
  }

  function selectModel(value: Model) {
    setModel(value);
    setColor(COLORS[value][0].name);
    setPaymentType("deposit");
    resetFeedback();
  }

  function openModal(selectedModel?: Model) {
    if (selectedModel) {
      setModel(selectedModel);
      setColor(COLORS[selectedModel][0].name);
    }
    setModalStep("config");
    setPaymentType("deposit");
    setCopied(false);
    resetFeedback();
    setModalOpen(true);
  }

  function closeModal() {
    if (loading) return;
    setModalOpen(false);
    setModalStep("config");
    setCopied(false);
    resetFeedback();
  }

  function validateCustomer() {
    if (!store) {
      setError("Teslim mağazasını seçin.");
      return false;
    }
    if (name.trim().length < 3) {
      setError("Ad soyad bilginizi girin.");
      return false;
    }
    if (phone.replace(/\D/g, "").length < 10) {
      setError("Geçerli bir telefon numarası girin.");
      return false;
    }
    return true;
  }

  async function sendTelegram(action: "REQUEST_ONLY" | "PAYMENT_REPORTED") {
    const response = await fetch("/api/iphone18-preorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        model,
        storage,
        color,
        store,
        customerName: name,
        phone,
        note,
        ...(action === "PAYMENT_REPORTED" ? { paymentType } : {}),
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data?.success) {
      throw new Error(data?.error || "Talep gönderilemedi.");
    }
    return data;
  }

  async function continueOrder(event: FormEvent) {
    event.preventDefault();
    resetFeedback();
    if (!validateCustomer()) return;

    if (isDuo) {
      try {
        setLoading(true);
        await sendTelegram("REQUEST_ONLY");
        setSuccess("iPhone Duo talebiniz başarıyla alındı.");
        setModalStep("done");
      } catch (err: any) {
        setError(err?.message || "Talep gönderilemedi.");
      } finally {
        setLoading(false);
      }
      return;
    }

    setPaymentType("deposit");
    setModalStep("payment");
  }

  async function reportPayment() {
    resetFeedback();
    try {
      setLoading(true);
      await sendTelegram("PAYMENT_REPORTED");
      setSuccess("Ödeme bildiriminiz alındı. Banka hesabı kontrol edildikten sonra siparişiniz kesinleştirilecektir.");
      setModalStep("done");
    } catch (err: any) {
      setError(err?.message || "Ödeme bildirimi gönderilemedi.");
    } finally {
      setLoading(false);
    }
  }

  async function copyIban() {
    try {
      await navigator.clipboard.writeText(IBAN_RAW);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#02060d] text-white">
      <header className="relative z-50 border-b border-white/[0.07] bg-[#02060d]/95 backdrop-blur-xl">
        <div className="mx-auto flex h-[72px] max-w-[1500px] items-center justify-between px-5 lg:px-8">
          <a href="/cihaz-sat" className="text-[26px] font-black tracking-[-1.6px]">
            CNET<span className="font-medium text-[#4ea7ff]">MOBİL</span>
          </a>

          <nav className="hidden items-center gap-10 text-[12px] font-bold text-slate-400 lg:flex">
            <a href="/cihaz-sat" className="transition hover:text-white">Cihaz Sat</a>
            <a href="#modeller" className="transition hover:text-white">Modeller</a>
            <button type="button" onClick={() => openModal()} className="transition hover:text-white">Ön Sipariş</button>
          </nav>

          <button
            type="button"
            onClick={() => openModal()}
            className="rounded-[13px] border border-blue-400/25 bg-blue-500/[0.08] px-5 py-3 text-[11px] font-black text-blue-100 transition hover:border-blue-400/50 hover:bg-blue-500/15"
          >
            Ön Sipariş Ver
          </button>
        </div>
      </header>

      <section className="relative min-h-[760px] overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_73%_28%,rgba(31,105,255,.38),transparent_30%),radial-gradient(circle_at_24%_88%,rgba(89,50,190,.18),transparent_32%),linear-gradient(115deg,#02060d_0%,#071328_54%,#02060d_100%)]" />
        <div className="absolute -right-[290px] -top-[590px] h-[1190px] w-[1190px] rounded-full border-[2px] border-blue-300/25 shadow-[0_0_100px_rgba(58,128,255,.42)]" />
        <div className="absolute right-[8%] top-[15%] h-[400px] w-[740px] bg-blue-500/15 blur-[135px]" />

        <div className="relative mx-auto grid min-h-[690px] max-w-[1500px] items-center gap-8 px-5 py-16 lg:grid-cols-[0.90fr_1.10fr] lg:px-8">
          <div className="relative z-20">
            <div className="text-[11px] font-black uppercase tracking-[0.42em] text-blue-200/75">DAHA FAZLASI SENİN ELİNDE</div>
            <h1 className="mt-5 max-w-[700px] text-[55px] font-black leading-[0.94] tracking-[-3px] sm:text-[70px] xl:text-[80px]">
              Yeni Seri
              <span className="block bg-gradient-to-r from-[#6bbcff] via-[#8b9fff] to-[#ba7aff] bg-clip-text text-transparent">Ön Siparişe Açıldı</span>
            </h1>
            <h2 className="mt-7 text-[27px] font-black tracking-[-0.8px]">iPhone 18 Pro & Pro Max</h2>
            <p className="mt-3 max-w-[570px] text-[15px] font-medium leading-7 text-slate-400">Yeni renkler, güçlü performans ve CNETMOBİL ön sipariş deneyimi.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <button type="button" onClick={() => openModal()} className="group flex h-[56px] items-center gap-5 rounded-full bg-white px-8 text-[13px] font-black text-[#07101c] transition hover:-translate-y-1">Ön Sipariş Ver <span className="text-xl">→</span></button>
              <a href="#modeller" className="flex h-[56px] items-center rounded-full border border-white/20 bg-white/[0.035] px-8 text-[13px] font-black transition hover:bg-white/[0.08]">Modelleri İncele</a>
            </div>
          </div>

          <div className="relative hidden h-[570px] items-center justify-center lg:flex">
            <img src="/iphone18-hero.webp" alt="iPhone 18 Pro" className="relative z-10 max-h-[535px] w-full max-w-[800px] object-contain drop-shadow-[0_45px_70px_rgba(0,0,0,.78)]" />
          </div>
        </div>
      </section>

      <section id="modeller" className="relative z-20 mx-auto max-w-[1450px] px-5 pb-24 pt-10">
        <div className="mb-9">
          <div className="text-[10px] font-black uppercase tracking-[0.28em] text-blue-400">iPHONE 18 SERİSİ</div>
          <h2 className="mt-2 text-[33px] font-black tracking-[-1px]">Modelini Seç</h2>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {MODELS.map((item) => (
            <button key={item} type="button" onClick={() => openModal(item)} className="group relative min-h-[260px] overflow-hidden rounded-[30px] border border-white/[0.09] bg-gradient-to-br from-white/[0.055] to-white/[0.015] p-7 text-left transition hover:-translate-y-1.5 hover:border-blue-400/35">
              <div className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-600">Başlangıç</div>
              <div className="mt-1 text-[20px] font-black">{money(PRICES[item]["256 GB"])}</div>
              <h3 className="mt-10 text-[27px] font-black">{item}</h3>
              <p className="mt-2 text-[11px] font-semibold text-slate-500">{item === "iPhone 18 Pro" ? "Profesyoneller için tasarlandı." : item === "iPhone 18 Pro Max" ? "Daha büyük. Daha güçlü." : "Yeni bir dönemin başlangıcı."}</p>
              <div className="mt-6 flex items-center gap-2">
                {COLORS[item].map((c) => <span key={c.name} title={c.name} className="h-7 w-7 rounded-full border-2 border-white/[0.12]" style={{ backgroundColor: c.value }} />)}
              </div>
              <div className="mt-8 text-[11px] font-black text-blue-300">{item === "iPhone Duo" ? "Talep Ver" : "Ön Sipariş Ver"}</div>
            </button>
          ))}
        </div>
      </section>

      {modalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#01040a]/90 p-3 backdrop-blur-xl md:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) closeModal(); }}>
          <div className="relative max-h-[95vh] w-full max-w-[1220px] overflow-y-auto rounded-[34px] border border-white/[0.10] bg-[#07101e] shadow-[0_50px_180px_rgba(0,0,0,.85)]">
            <div className="sticky top-0 z-30 flex items-center justify-between border-b border-white/[0.08] bg-[#07101e]/95 px-6 py-5 backdrop-blur-xl md:px-8">
              <div>
                <div className="text-[9px] font-black uppercase tracking-[0.32em] text-blue-400">{modalStep === "payment" ? "ÖDEME ADIMI" : isDuo ? "iPHONE DUO" : "iPHONE 18"}</div>
                <h2 className="mt-1 text-[23px] font-black">{modalStep === "payment" ? "Ödeme Bilgileri" : modalStep === "done" ? "İşleminiz Alındı" : isDuo ? "Talebini Oluştur" : "Ön Siparişini Oluştur"}</h2>
              </div>
              <button type="button" onClick={closeModal} className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/[0.035] text-slate-400 hover:bg-white/[0.08]">✕</button>
            </div>

            {modalStep === "config" && (
              <form onSubmit={continueOrder} className="grid lg:grid-cols-[1fr_390px]">
                <div className="p-6 md:p-8 lg:p-9">
                  <SectionTitle n="01" title="Model" subtitle="Hangi modeli istiyorsunuz?" />
                  <div className="grid gap-3 md:grid-cols-3">
                    {MODELS.map((item) => {
                      const active = model === item;
                      return <button key={item} type="button" onClick={() => selectModel(item)} className={`rounded-[19px] border p-4 text-left transition ${active ? "border-[#2ca7ff] bg-blue-500/10" : "border-white/[0.08] bg-white/[0.025]"}`}>
                        <div className="text-[13px] font-black">{item}</div>
                        <div className="mt-2 text-[9px] font-semibold text-slate-500">{item === "iPhone 18 Pro" ? "Profesyoneller için." : item === "iPhone 18 Pro Max" ? "Daha büyük. Daha güçlü." : "Yeni bir dönem."}</div>
                      </button>;
                    })}
                  </div>

                  <div className="mt-8"><SectionTitle n="02" title="Depolama" subtitle="Size uygun kapasiteyi seçin" /></div>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    {STORAGES.map((item) => <button key={item} type="button" onClick={() => setStorage(item)} className={`rounded-[17px] border p-4 text-left ${storage === item ? "border-[#2ca7ff] bg-blue-500/10" : "border-white/[0.08] bg-white/[0.025]"}`}><div className="text-[15px] font-black">{item}</div><div className="mt-2 text-[10px] text-slate-500">{money(PRICES[model][item])}</div></button>)}
                  </div>

                  <div className="mt-8"><SectionTitle n="03" title="Renk" subtitle="Renginizi seçin" /></div>
                  <div className="flex flex-wrap gap-3">
                    {colors.map((item) => <button key={item.name} type="button" onClick={() => setColor(item.name)} className={`flex min-w-[125px] items-center gap-3 rounded-[15px] border px-3.5 py-3 ${color === item.name ? "border-[#2ca7ff] bg-blue-500/10" : "border-white/[0.08] bg-white/[0.025]"}`}><span className="h-9 w-9 rounded-full border-2 border-white/10" style={{ backgroundColor: item.value }} /><span className="text-[10px] font-black">{item.name}</span></button>)}
                  </div>

                  <div className="mt-8"><SectionTitle n="04" title="Teslimat" subtitle="Teslim mağazasını seçin" /></div>
                  <select value={store} onChange={(e) => setStore(e.target.value)} className="h-[58px] w-full rounded-[16px] border border-white/[0.09] bg-[#0c1626] px-4 text-[11px] font-bold text-white outline-none focus:border-[#2ca7ff]">
                    <option value="">Teslim mağazasını seçin</option>
                    {STORES.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>

                  <div className="mt-8"><SectionTitle n="05" title="İletişim" subtitle="Size ulaşabilmemiz için bilgilerinizi girin" /></div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Adınız Soyadınız" className="h-[54px] rounded-[15px] border border-white/[0.08] bg-white/[0.025] px-4 text-[11px] outline-none focus:border-[#2ca7ff]" />
                    <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="05xx xxx xx xx" className="h-[54px] rounded-[15px] border border-white/[0.08] bg-white/[0.025] px-4 text-[11px] outline-none focus:border-[#2ca7ff]" />
                    <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="Varsa eklemek istediğiniz not..." className="md:col-span-2 resize-none rounded-[15px] border border-white/[0.08] bg-white/[0.025] p-4 text-[11px] outline-none focus:border-[#2ca7ff]" />
                  </div>

                  {error && <div className="mt-5 rounded-[15px] border border-rose-400/20 bg-rose-500/[0.08] px-4 py-3 text-[11px] font-bold text-rose-300">{error}</div>}
                </div>

                <aside className="border-t border-white/[0.08] bg-[#040b15]/75 p-6 lg:border-l lg:border-t-0 md:p-8">
                  <div className="text-[9px] font-black uppercase tracking-[0.30em] text-blue-400">SEÇİMİNİZ</div>
                  <div className="mt-6 rounded-[24px] border border-white/[0.08] bg-white/[0.025] p-5 text-center">
                    <img src="/iphone18-hero.webp" alt={model} className="mx-auto h-[150px] w-full object-contain" />
                    <div className="mt-3 text-[21px] font-black">{model}</div>
                    <div className="mt-1 text-[10px] text-slate-500">{description}</div>
                  </div>
                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <SummaryBox label="Depolama" value={storage} />
                    <SummaryBox label="Renk" value={color} dot={selectedColor.value} />
                  </div>
                  <div className="mt-6 border-t border-white/[0.08] pt-6"><div className="text-[9px] uppercase text-slate-600">Cihaz Fiyatı</div><div className="mt-1 text-[38px] font-black">{money(price)}</div></div>
                  <button type="submit" disabled={loading} className="mt-6 flex h-[60px] w-full items-center justify-center rounded-[16px] bg-gradient-to-r from-[#5abfff] via-[#8295ff] to-[#ad64ff] text-[13px] font-black text-[#04101d] disabled:opacity-50">{loading ? "Gönderiliyor..." : isDuo ? "Talep Ver" : "Ön Sipariş Ver"}</button>
                </aside>
              </form>
            )}

            {modalStep === "payment" && (
              <div className="grid lg:grid-cols-[1fr_410px]">
                <div className="p-6 md:p-8 lg:p-9">
                  <div className="rounded-[22px] border border-amber-400/20 bg-amber-500/[0.06] p-5">
                    <div className="text-[11px] font-black text-amber-200">Ödeme tercihinizi seçin</div>
                    <p className="mt-1 text-[10px] leading-5 text-slate-400">Ön sipariş için cihaz bedelinin %10'unu kapora olarak veya cihaz bedelinin tamamını yatırabilirsiniz.</p>
                  </div>

                  <div className="mt-6 grid gap-3 md:grid-cols-2">
                    <PaymentChoice active={paymentType === "deposit"} title="%10 Kapora" amount={roundMoney(price * 0.1)} subtitle="Cihaz bedelinin %10'u" onClick={() => setPaymentType("deposit")} />
                    <PaymentChoice active={paymentType === "full"} title="Tam Ödeme" amount={price} subtitle="Cihaz bedelinin tamamı" onClick={() => setPaymentType("full")} />
                  </div>

                  <div className="mt-6 overflow-hidden rounded-[26px] border border-white/[0.09] bg-gradient-to-br from-[#0d192b] to-[#07101b]">
                    <div className="border-b border-white/[0.07] px-6 py-5">
                      <div className="text-[9px] font-black uppercase tracking-[0.22em] text-blue-400">ALICI / HESAP ÜNVANI</div>
                      <div className="mt-2 text-[13px] font-black leading-6">{COMPANY_NAME}</div>
                    </div>

                    <div className="grid md:grid-cols-[1fr_230px]">
                      <div className="p-6">
                        <div className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">IBAN</div>
                        <div className="mt-2 break-words text-[18px] font-black tracking-[0.06em] md:text-[21px]">{IBAN_DISPLAY}</div>
                        <button type="button" onClick={copyIban} className="mt-4 h-10 rounded-xl border border-blue-400/20 bg-blue-500/10 px-4 text-[10px] font-black text-blue-300">{copied ? "✓ Kopyalandı" : "IBAN'ı Kopyala"}</button>

                        <div className="mt-6 grid gap-3 sm:grid-cols-2">
                          <SummaryBox label="Yatırılacak Tutar" value={money(paymentAmount)} />
                          <SummaryBox label="Ödeme Türü" value={paymentType === "deposit" ? "%10 Kapora" : "Tam Ödeme"} />
                        </div>

                        <div className="mt-4 rounded-[16px] border border-white/[0.07] bg-white/[0.025] p-4">
                          <div className="text-[8px] font-black uppercase tracking-[0.15em] text-slate-600">Havale Açıklaması</div>
                          <div className="mt-2 break-words text-[11px] font-black">{paymentDescription}</div>
                        </div>
                      </div>

                      <div className="flex flex-col items-center justify-center border-t border-white/[0.07] bg-white/[0.025] p-6 md:border-l md:border-t-0">
                        <div className="rounded-[20px] bg-white p-4"><QRCodeSVG value={qrValue} size={170} level="M" /></div>
                        <div className="mt-4 text-center text-[9px] font-black uppercase tracking-[0.16em] text-slate-500">Ödeme Bilgileri QR</div>
                        <p className="mt-2 text-center text-[8px] leading-4 text-slate-600">QR kod; alıcı, IBAN, tutar ve açıklama bilgilerini içerir.</p>
                      </div>
                    </div>
                  </div>

                  {error && <div className="mt-5 rounded-[15px] border border-rose-400/20 bg-rose-500/[0.08] px-4 py-3 text-[11px] font-bold text-rose-300">{error}</div>}

                  <div className="mt-6 rounded-[18px] border border-white/[0.07] bg-white/[0.025] p-4 text-[9px] leading-5 text-slate-500">“Ödemeyi Yaptım” butonu ödemenin bankadan otomatik doğrulandığı anlamına gelmez. Bildirim CNETMOBİL ekibine iletilir ve ödeme banka hesabından kontrol edilir.</div>
                </div>

                <aside className="border-t border-white/[0.08] bg-[#040b15]/75 p-6 lg:border-l lg:border-t-0 md:p-8">
                  <div className="lg:sticky lg:top-[100px]">
                    <div className="text-[9px] font-black uppercase tracking-[0.30em] text-blue-400">SİPARİŞ ÖZETİ</div>
                    <div className="mt-6 rounded-[22px] border border-white/[0.08] bg-white/[0.025] p-5"><div className="text-[20px] font-black">{model}</div><div className="mt-2 text-[10px] text-slate-400">{storage} · {color}</div><div className="mt-1 text-[10px] text-slate-500">{store}</div></div>
                    <div className="mt-5 rounded-[22px] border border-blue-400/15 bg-blue-500/[0.06] p-5"><div className="text-[9px] font-black uppercase tracking-[0.18em] text-blue-300">ÖDENECEK TUTAR</div><div className="mt-2 text-[36px] font-black">{money(paymentAmount)}</div><div className="mt-2 text-[9px] text-slate-500">{paymentType === "deposit" ? "%10 Kapora" : "Tam Ödeme"}</div></div>
                    <button type="button" disabled={loading} onClick={reportPayment} className="mt-6 flex h-[60px] w-full items-center justify-center rounded-[16px] bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-500 text-[13px] font-black text-[#031017] disabled:opacity-50">{loading ? "Bildiriliyor..." : "✓ Ödemeyi Yaptım"}</button>
                    <button type="button" disabled={loading} onClick={() => { resetFeedback(); setModalStep("config"); }} className="mt-3 h-[50px] w-full rounded-[14px] border border-white/[0.09] bg-white/[0.025] text-[11px] font-black text-slate-400 hover:bg-white/[0.06]">Vazgeç / Geri Dön</button>
                  </div>
                </aside>
              </div>
            )}

            {modalStep === "done" && (
              <div className="p-8 md:p-12">
                <div className="mx-auto max-w-[620px] text-center">
                  <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-emerald-400/20 bg-emerald-500/10 text-[34px] text-emerald-300">✓</div>
                  <div className="mt-6 text-[10px] font-black uppercase tracking-[0.25em] text-emerald-400">BİLDİRİM ALINDI</div>
                  <h3 className="mt-2 text-[30px] font-black">{isDuo ? "Talebiniz Alındı" : "Ödeme Bildiriminiz Alındı"}</h3>
                  <p className="mt-4 text-[12px] leading-6 text-slate-400">{success}</p>
                  {!isDuo && <div className="mt-6 rounded-[20px] border border-white/[0.08] bg-white/[0.025] p-5 text-left"><div className="flex justify-between py-2 text-[10px]"><span className="text-slate-500">Model</span><span className="font-black">{model}</span></div><div className="flex justify-between border-t border-white/[0.06] py-2 text-[10px]"><span className="text-slate-500">Bildirilen Ödeme</span><span className="font-black">{money(paymentAmount)}</span></div><div className="flex justify-between border-t border-white/[0.06] py-2 text-[10px]"><span className="text-slate-500">Ödeme Türü</span><span className="font-black">{paymentType === "deposit" ? "%10 Kapora" : "Tam Ödeme"}</span></div></div>}
                  <button type="button" onClick={closeModal} className="mt-7 h-[54px] min-w-[210px] rounded-[15px] bg-white px-7 text-[12px] font-black text-[#07101c]">Kapat</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

function SectionTitle({ n, title, subtitle }: { n: string; title: string; subtitle: string }) {
  return <div className="mb-4 flex items-center gap-3"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/10 text-[10px] font-black text-blue-400">{n}</span><div><div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">{title}</div><div className="mt-0.5 text-[12px] font-semibold text-slate-300">{subtitle}</div></div></div>;
}

function SummaryBox({ label, value, dot }: { label: string; value: string; dot?: string }) {
  return <div className="rounded-[16px] border border-white/[0.07] bg-white/[0.025] p-4"><div className="text-[8px] font-black uppercase tracking-[0.12em] text-slate-600">{label}</div><div className="mt-1 flex items-center gap-2 text-[12px] font-black">{dot && <span className="h-4 w-4 rounded-full border border-white/20" style={{ backgroundColor: dot }} />}{value}</div></div>;
}

function PaymentChoice({ active, title, amount, subtitle, onClick }: { active: boolean; title: string; amount: number; subtitle: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`rounded-[20px] border p-5 text-left transition ${active ? "border-[#2ca7ff] bg-blue-500/10" : "border-white/[0.08] bg-white/[0.025] hover:border-white/[0.18]"}`}><div className="flex items-center justify-between"><div className="text-[12px] font-black">{title}</div><span className={`flex h-5 w-5 items-center justify-center rounded-full border ${active ? "border-blue-400 bg-blue-500" : "border-white/20"}`}>{active ? "✓" : ""}</span></div><div className="mt-4 text-[28px] font-black">{money(amount)}</div><div className="mt-1 text-[9px] font-semibold text-slate-500">{subtitle}</div></button>;
}
