// app/api/wingsm/personnel-sync/inspect/route.ts
//
// CNETMOBIL - WingSM personel listesi KARŞILAŞTIRMA (sadece yönetici, SADECE OKUR).
//
// Amaç: Paratika "İşlemi yapan personel" listesi (public.wingsm_personnel, active=true) ile
// WingSM'in B2B personel kaydı (carikart/list/P) arasındaki farkı ve "gerçek satıcıyı"
// ayıran bir alan olup olmadığını görmek.
//   - WingSM'e sadece GET yapılır; veritabanına HİÇBİR şey yazılmaz.
//   - Hassas alanların (TC, telefon, e-posta, adres, IBAN...) değerleri cevapta YOK;
//     sadece alan adları ve düşük çeşitlilikli (<= 12 farklı değer) alanların dağılımı verilir.

import { NextRequest } from "next/server";

import { getPool, json, requireAdminSession } from "../../score-rules/_shared";
import { wingSMRequest } from "@/app/lib/wingsm/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const SENSITIVE_KEY = /tc|kimlik|tel|gsm|mail|adres|iban|sifre|pass|dogum|maas|ucret|banka|plaka|ehliyet/i;

function istanbulDateNumber() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  return parts.replace(/-/g, "");
}

function text(value: unknown) {
  return String(value ?? "").trim();
}

export async function GET(request: NextRequest) {
  const auth = requireAdminSession(request);

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const tarih = istanbulDateNumber();

    const payload = await wingSMRequest<{ success?: boolean; data?: Array<Record<string, unknown>> }>(
      `/api/b2b/carikart/list/P/${tarih}/${tarih}`,
      { method: "GET", query: { filter: "*" } }
    );

    if (payload?.success !== true || !Array.isArray(payload.data)) {
      return json({ success: false, error: "WingSM personel cevabı beklenen biçimde değil.", tarih }, 502);
    }

    const rows = payload.data;

    const pool = getPool();
    const dbResult = await pool.query(
      `SELECT code, name, active FROM public.wingsm_personnel ORDER BY name ASC`
    );

    const dbByCode = new Map<string, { name: string; active: boolean }>();

    for (const item of dbResult.rows) {
      dbByCode.set(text(item.code), { name: text(item.name), active: Boolean(item.active) });
    }

    const wingByCode = new Map<string, Record<string, unknown>>();

    for (const row of rows) {
      const code = text(row?.Kod);

      if (code) wingByCode.set(code, row);
    }

    // Alan adları + düşük çeşitlilikli alanların dağılımı (aktif / aktif değil ayrı sayılır).
    const keys = Array.from(new Set(rows.flatMap((row) => Object.keys(row ?? {})))).sort();

    const fields = keys.map((key) => {
      if (SENSITIVE_KEY.test(key)) {
        return { key, sensitive: true as const };
      }

      const distinct = new Map<string, { aktif: number; aktifDegil: number }>();

      for (const row of rows) {
        const code = text(row?.Kod);
        const isActive = dbByCode.get(code)?.active === true;
        const value = text(row?.[key]).slice(0, 40) || "(boş)";
        const entry = distinct.get(value) ?? { aktif: 0, aktifDegil: 0 };

        if (isActive) entry.aktif += 1;
        else entry.aktifDegil += 1;

        distinct.set(value, entry);
      }

      return {
        key,
        sensitive: false as const,
        distinctCount: distinct.size,
        values: distinct.size <= 12 ? Object.fromEntries(distinct) : undefined,
      };
    });

    const pick = (row: Record<string, unknown>) => ({
      code: text(row.Kod),
      name: text(row.Ad),
      sube: text(row.CalistigiSubeAdI) || text(row.CalistigiSube) || null,
      pozisyon: text(row.Pozisyon) || null,
      tarihCikis: text(row.TarihCikis) || null,
    });

    // WingSM'de var, Paratika listesinde aktif değil.
    const wingdeVarListedeYok = Array.from(wingByCode.entries())
      .filter(([code]) => dbByCode.get(code)?.active !== true)
      .map(([, row]) => pick(row))
      .sort((a, b) => a.name.localeCompare(b.name, "tr"));

    // Paratika listesinde aktif, WingSM B2B kaydında yok.
    const listedeVarWingdeYok = Array.from(dbByCode.entries())
      .filter(([code, item]) => item.active && !wingByCode.has(code))
      .map(([code, item]) => ({ code, name: item.name }))
      .sort((a, b) => a.name.localeCompare(b.name, "tr"));

    // Aynı kod, farklı yazılış.
    const adFarki = Array.from(dbByCode.entries())
      .filter(([code, item]) => item.active && wingByCode.has(code))
      .map(([code, item]) => ({
        code,
        paratika: item.name,
        wingsm: text(wingByCode.get(code)?.Ad),
      }))
      .filter((item) => item.paratika !== item.wingsm);

    return json({
      success: true,
      tarih,
      wingsmKayitSayisi: rows.length,
      paratikaAktifSayisi: Array.from(dbByCode.values()).filter((item) => item.active).length,
      alanlar: fields,
      wingdeVarListedeYok,
      listedeVarWingdeYok,
      adFarki,
    });
  } catch (error) {
    console.error("PERSONEL_INSPECT_ERROR:", error);

    return json({ success: false, error: error instanceof Error ? error.message : "Karşılaştırma yapılamadı." }, 500);
  }
}
