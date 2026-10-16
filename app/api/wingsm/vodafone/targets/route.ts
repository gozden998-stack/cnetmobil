// app/api/wingsm/vodafone/targets/route.ts
//
// CNETMOBIL - Vodafone Değer Puan - HEDEFLER (sadece yönetici).
//   GET  ?period=YYYY-MM   -> o ayın mağaza + personel hedefleri
//   PUT  { period, stores, personnel } -> o ayın hedeflerini TOPLU değiştirir
//        (Excel'deki gibi tek tablo; tek işlemde sil + yaz).

import { NextRequest } from "next/server";

import { getPool, json, requireAdminSession } from "../../score-rules/_shared";
import { ensureVodafoneTables, loadTargets, VODAFONE_BRANCH_LABELS } from "../_vodafone";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const PERIOD_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const MAX_PERSONNEL = 300;

function currentPeriod(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit" })
    .format(new Date())
    .slice(0, 7);
}

export async function GET(request: NextRequest) {
  const auth = requireAdminSession(request);

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const periodParam = String(new URL(request.url).searchParams.get("period") || "").trim();
    const period = PERIOD_PATTERN.test(periodParam) ? periodParam : currentPeriod();

    const targets = await loadTargets(getPool(), period);

    return json({ success: true, ...targets, branchLabels: VODAFONE_BRANCH_LABELS });
  } catch (error) {
    console.error("VODAFONE_TARGETS_GET_ERROR:", error);
    return json({ success: false, error: error instanceof Error ? error.message : "Hedefler alınamadı." }, 500);
  }
}

export async function PUT(request: NextRequest) {
  const auth = requireAdminSession(request);

  if (!auth.ok) {
    return auth.response;
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;

  if (!body || typeof body !== "object") {
    return json({ success: false, error: "Geçersiz istek." }, 400);
  }

  const period = String(body.period ?? "").trim();

  if (!PERIOD_PATTERN.test(period)) {
    return json({ success: false, error: "Dönem YYYY-AA biçiminde olmalıdır." }, 400);
  }

  const rawStores = Array.isArray(body.stores) ? body.stores : [];
  const rawPersonnel = Array.isArray(body.personnel) ? body.personnel : [];

  if (rawPersonnel.length > MAX_PERSONNEL) {
    return json({ success: false, error: `En fazla ${MAX_PERSONNEL} personel girilebilir.` }, 400);
  }

  const stores: Array<{ branchLabel: string; hedef: number }> = [];

  for (const item of rawStores as Array<Record<string, unknown>>) {
    const branchLabel = String(item?.branchLabel ?? "").trim();
    const hedef = Number(item?.hedef);

    if (!VODAFONE_BRANCH_LABELS.includes(branchLabel)) {
      return json({ success: false, error: `Geçersiz mağaza: "${branchLabel}".` }, 400);
    }

    if (!Number.isFinite(hedef) || hedef < 0 || hedef > 1_000_000_000) {
      return json({ success: false, error: `${branchLabel} için hedef geçersiz.` }, 400);
    }

    stores.push({ branchLabel, hedef });
  }

  const personnel: Array<{ branchLabel: string; saticiAdi: string; hedef: number; isManager: boolean }> = [];

  for (const item of rawPersonnel as Array<Record<string, unknown>>) {
    const branchLabel = String(item?.branchLabel ?? "").trim();
    const saticiAdi = String(item?.saticiAdi ?? "").trim().replace(/\s+/g, " ");
    const hedef = Number(item?.hedef);

    if (!VODAFONE_BRANCH_LABELS.includes(branchLabel)) {
      return json({ success: false, error: `Geçersiz mağaza: "${branchLabel}".` }, 400);
    }

    if (!saticiAdi || saticiAdi.length > 80) {
      return json({ success: false, error: "Personel adı boş olamaz ve 80 karakteri geçemez." }, 400);
    }

    if (!Number.isFinite(hedef) || hedef < 0 || hedef > 1_000_000_000) {
      return json({ success: false, error: `${saticiAdi} için hedef geçersiz.` }, 400);
    }

    personnel.push({ branchLabel, saticiAdi, hedef, isManager: Boolean(item?.isManager) });
  }

  const pool = getPool();
  const client = await pool.connect();

  try {
    await ensureVodafoneTables(pool);
    await client.query("BEGIN");

    await client.query(`DELETE FROM public.vdf_deger_puan_store_targets WHERE period = $1`, [period]);
    await client.query(`DELETE FROM public.vdf_deger_puan_personnel_targets WHERE period = $1`, [period]);

    for (const store of stores) {
      await client.query(
        `INSERT INTO public.vdf_deger_puan_store_targets (period, branch_label, target_value) VALUES ($1, $2, $3)`,
        [period, store.branchLabel, store.hedef]
      );
    }

    for (let index = 0; index < personnel.length; index += 1) {
      const person = personnel[index];

      await client.query(
        `INSERT INTO public.vdf_deger_puan_personnel_targets
           (period, branch_label, satici_adi, target_value, is_manager, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [period, person.branchLabel, person.saticiAdi, person.hedef, person.isManager, index]
      );
    }

    await client.query("COMMIT");

    return json({ success: true, period, storeCount: stores.length, personnelCount: personnel.length });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    console.error("VODAFONE_TARGETS_PUT_ERROR:", error);

    return json({ success: false, error: error instanceof Error ? error.message : "Hedefler kaydedilemedi." }, 500);
  } finally {
    client.release();
  }
}
