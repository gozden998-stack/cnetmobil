"use client";

// app/components/screens/degerPuanGunSecici.tsx
//
// Değer Puan ekranlarında "Bugün / Dün / Önceki Gün + takvim" gün seçicisi ve
// tarih yardımcıları. WingsmDegerPuanim (CMR) içindeki seçicinin AYNISI; CMR
// ekranına dokunmamak için Vodafone ekranı bu dosyayı kullanır.

import React, { useEffect, useRef, useState } from "react";

// Gün seçicideki seçim: Bugün / Dün / Önceki Gün ya da takvimden bir tarih.
export type DayPick = { kind: "bugun" | "dun" | "onceki" | "tarih"; date?: string };

// Türkiye saatine göre bugünün tarihi ("YYYY-MM-DD").
export function istanbulToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

// "YYYY-MM-DD" tarihine gün ekler/çıkarır.
export function shiftDay(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

// "2026-10-09" -> "09.10.2026"
export function formatIsoDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

// "09/10/2026" -> "2026-10-09" (biçim bozuksa null)
export function slashToIso(value: string): string | null {
  const match = String(value || "").match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : null;
}

export function dayPickLabel(pick: DayPick): string {
  if (pick.kind === "bugun") return "Bugün";
  if (pick.kind === "dun") return "Dün";
  if (pick.kind === "onceki") return "Önceki Gün";
  return pick.date ? formatIsoDate(pick.date) : "Tarih";
}

// API'ye gidecek "yayın günü" (Bugün için null = en güncel rapor).
export function dayPickToGun(pick: DayPick): string | null {
  const today = istanbulToday();
  if (pick.kind === "dun") return shiftDay(today, -1);
  if (pick.kind === "onceki") return shiftDay(today, -2);
  if (pick.kind === "tarih" && pick.date && pick.date < today) return pick.date;
  return null;
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 3v3M16 3v3M4 9h16M5 5h14a1 1 0 011 1v13a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1z"
      />
    </svg>
  );
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 9l6 6 6-6" />
    </svg>
  );
}

// Bugün / Dün / Önceki Gün seçici + takvim düğmesi (bölünmüş düğme).
export function DayPicker({
  label,
  disabled,
  minDate,
  maxDate,
  onSelect,
}: {
  label: string;
  disabled: boolean;
  minDate?: string;
  maxDate: string;
  onSelect: (pick: DayPick) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;

    const close = (event: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const choose = (pick: DayPick) => {
    setOpen(false);
    onSelect(pick);
  };

  const openCalendar = () => {
    const input = dateInputRef.current;
    if (!input) return;

    if (typeof input.showPicker === "function") {
      input.showPicker();
    } else {
      input.focus();
      input.click();
    }
  };

  const items: Array<{ label: string; pick: DayPick }> = [
    { label: "Bugün", pick: { kind: "bugun" } },
    { label: "Dün", pick: { kind: "dun" } },
    { label: "Önceki Gün", pick: { kind: "onceki" } },
  ];

  return (
    <div ref={wrapRef} className="relative inline-flex">
      <div className="inline-flex h-11 overflow-hidden rounded-lg border border-blue-600 bg-white shadow-sm">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen((value) => !value)}
          className="bg-blue-600 px-4 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {label}
        </button>
        <button
          type="button"
          disabled={disabled}
          aria-label="Gün seç"
          onClick={() => setOpen((value) => !value)}
          className="flex w-9 items-center justify-center border-l border-blue-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          <ChevronDownIcon className="h-4 w-4" />
        </button>
        <button
          type="button"
          disabled={disabled}
          aria-label="Takvimden tarih seç"
          onClick={openCalendar}
          className="flex w-11 items-center justify-center border-l border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          <CalendarIcon className="h-5 w-5" />
        </button>
        <input
          ref={dateInputRef}
          type="date"
          min={minDate}
          max={maxDate}
          tabIndex={-1}
          aria-hidden="true"
          onChange={(event) => {
            if (event.target.value) {
              onSelect({ kind: "tarih", date: event.target.value });
              event.target.value = "";
            }
          }}
          className="pointer-events-none absolute left-0 top-full h-0 w-0 opacity-0"
        />
      </div>

      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 min-w-[160px] overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => choose(item.pick)}
              className={`block w-full px-4 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-100 ${
                item.label === label ? "bg-slate-100" : ""
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
