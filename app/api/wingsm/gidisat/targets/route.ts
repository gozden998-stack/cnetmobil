// app/api/wingsm/gidisat/targets/route.ts
//
// CNETMOBIL - Personel Gidişat - KİŞİ BAŞI AYLIK HEDEFLER (sadece yönetici).
//   GET ?period=YYYY-MM -> o ayın hedefleri (kişi satırları, 9 kategori hedefi)
//   PUT { period, kisiler: [{ branchLabel, saticiAdi, hedefler: { cihaz_adet: 60, ... } }] }
//       -> o ayın TÜM hedeflerini değiştirir (tek işlemde sil + yaz)

import { NextRequest } from "next/server";

import { getPool, json, requireAdminSession } from "../../score-rules/_shared";
import { CMR_BRANCH_LABELS, DEFAULT_CONFIG, ensureGidisatTables, loadTargets } from "../_gidisat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const PERIOD_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const MAX_PEOPLE = 300;
const CATEGORY_KEYS = DEFAULT_CONFIG.categories.map((category) => category.key);

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

    return json({ success: true, period, kisiler: await loadTargets(getPool(), period), branchLabels: CMR_BRANCH_LABELS });
  } catch (error) {
    console.error("GIDISAT_TARGETS_GET_ERROR:", error);
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

  const rawPeople = Array.isArray(body.kisiler) ? (body.kisiler as Array<Record<string, unknown>>) : [];

  if (rawPeople.length > MAX_PEOPLE) {
    return json({ success: false, error: `En fazla ${MAX_PEOPLE} kişi girilebilir.` }, 400);
  }

  const people: Array<{ branchLabel: string; saticiAdi: string; hedefler: Record<string, number> }> = [];
  const seen = new Set<string>();

  for (const item of rawPeople) {
    const branchLabel = String(item?.branchLabel ?? "").trim();
    const saticiAdi = String(item?.saticiAdi ?? "").trim().replace(/\s+/g, " ");

    if (!saticiAdi) continue;

    if (!CMR_BRANCH_LABELS.includes(branchLabel)) {
      return json({ success: false, error: `${saticiAdi} için mağaza geçersiz: "${branchLabel}".` }, 400);
    }

    if (saticiAdi.length > 80) {
      return json({ success: false, error: "Personel adı 80 karakteri geçemez." }, 400);
    }

    const dedupeKey = saticiAdi.toLocaleUpperCase("tr-TR");

    if (seen.has(dedupeKey)) {
      return json({ success: false, error: `${saticiAdi} listede iki kez yazılmış.` }, 400);
    }

    seen.add(dedupeKey);

    const hedefler: Record<string, number> = {};
    const rawTargets = (item?.hedefler && typeof item.hedefler === "object" ? item.hedefler : {}) as Record<string, unknown>;

    for (const key of CATEGORY_KEYS) {
      const raw = rawTargets[key];

      if (raw === undefined || raw === null || String(raw).trim() === "") continue;

      const n = Number(raw);

      if (!Number.isFinite(n) || n < 0 || n > 1_000_000_000) {
        return json({ success: false, error: `${saticiAdi} için "${key}" hedefi geçersiz.` }, 400);
      }

      hedefler[key] = n;
    }

    people.push({ branchLabel, saticiAdi, hedefler });
  }

  const pool = getPool();
  const client = await pool.connect();

  try {
    await ensureGidisatTables(pool);
    await client.query("BEGIN");
    await client.query(`DELETE FROM public.gidisat_targets WHERE period = $1`, [period]);

    for (let index = 0; index < people.length; index += 1) {
      const person = people[index];

      await client.query(
        `INSERT INTO public.gidisat_targets (period, sort_order, branch_label, person_name, targets)
         VALUES ($1, $2, $3, $4, $5)`,
        [period, index, person.branchLabel, person.saticiAdi, JSON.stringify(person.hedefler)]
      );
    }

    await client.query("COMMIT");

    return json({ success: true, period, personCount: people.length });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    console.error("GIDISAT_TARGETS_PUT_ERROR:", error);

    return json({ success: false, error: error instanceof Error ? error.message : "Hedefler kaydedilemedi." }, 500);
  } finally {
    client.release();
  }
}
