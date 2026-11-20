"use client";

// CNETMOBIL - Şampiyonlar Ligi: STOK CİHAZ IMEI LİSTESİ
// Stok cihaz bonusu (+125) YALNIZ bu listedeki IMEI'ler için verilir. Liste boşsa bonus verilmez.

import React, { useMemo, useState } from "react";

function parse(text: string) {
  const seen = new Set<string>();
  const valid: string[] = [];
  const invalid: string[] = [];

  for (const token of text.split(/[\s,;]+/)) {
    if (!token.trim()) continue;

    const clean = token.replace(/\D/g, "");

    if (/^\d{15}$/.test(clean)) {
      if (!seen.has(clean)) {
        seen.add(clean);
        valid.push(clean);
      }
    } else {
      invalid.push(token.trim());
    }
  }

  return { valid, invalid };
}

export default function YarismaStokListesi({ imeiler, onSaved }: { imeiler: string[]; onSaved: () => void }) {
  const [text, setText] = useState(() => imeiler.join("\n"));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [dirty, setDirty] = useState(false);

  const parsed = useMemo(() => parse(text), [text]);

  const save = async () => {
    if (parsed.valid.length === 0 && !window.confirm("Liste BOŞALTILACAK: stok cihaz bonusu kimseye verilmeyecek. Devam edilsin mi?")) return;

    setBusy(true);
    setMessage("");

    try {
      const response = await fetch("/api/wingsm/yarisma", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "stokImeiKaydet", metin: text }),
      });
      const payload = await response.json().catch(() => null);

      if (!payload?.success) throw new Error(payload?.error || `HTTP ${response.status}`);

      setDirty(false);
      setMessage(`${payload.count} IMEI kaydedildi. Test için Yönetim'de Hesapla'ya bas; mağazalar bir sonraki 12:30 otomatik yayınında yeni listeyle hesaplanmış sıralamayı görür.`);
      onSaved();
    } catch (e: any) {
      setMessage(e?.message || "Kaydedilemedi.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[12px] font-bold leading-5 text-amber-800">
        <b>Stok cihaz IMEI listesi.</b> Stok cihaz bonusu (+puan) <b>yalnız bu listedeki IMEI&apos;lerin</b> satışında verilir; başka hiçbir cihaz bonus almaz. Liste boşsa bonus verilmez. Kayıt, listeyi <b>tamamen değiştirir</b>. IMEI&apos;leri alt alta, boşlukla ya
        da virgülle ayırarak yapıştırabilirsin (15 haneli). Geçersiz satır varsa kaydedilmez, düzeltmen istenir.
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="text-[13px] font-bold text-slate-700">
          {parsed.valid.length} geçerli IMEI
          {parsed.invalid.length > 0 && <span className="ml-2 text-rose-600">· {parsed.invalid.length} geçersiz satır</span>}
          {dirty && <span className="ml-2 text-slate-400">· kaydedilmemiş değişiklik var</span>}
        </div>
        <button type="button" onClick={() => void save()} disabled={busy || !dirty || parsed.invalid.length > 0} className="ml-auto rounded-xl bg-violet-600 px-6 py-2.5 text-[14px] font-black text-white hover:bg-violet-700 disabled:opacity-50">
          {busy ? "Kaydediliyor..." : "Kaydet"}
        </button>
      </div>

      {message && <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-[13px] font-bold text-slate-700">{message}</div>}
      {parsed.invalid.length > 0 && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-[12px] font-bold text-rose-700">Geçersiz (15 hane değil): {parsed.invalid.slice(0, 8).join(", ")}{parsed.invalid.length > 8 ? " ..." : ""}</div>
      )}

      <textarea
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          setDirty(true);
        }}
        rows={16}
        spellCheck={false}
        className="w-full rounded-2xl border border-slate-200 bg-white p-4 font-mono text-[13px] font-semibold text-slate-800 outline-none focus:border-violet-400"
        placeholder={"357540100759814\n352925287177358\n..."}
      />
    </div>
  );
}
