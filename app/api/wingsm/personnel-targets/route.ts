// app/api/wingsm/personnel-targets/route.ts
//
// CNETMOBIL - WingSM Değer Puan - PERSONEL HEDEFİ
//
// Excel kaynağındaki personel bazlı "HEDEF" listesinin karşılığı — her ay,
// her personel için admin'in girdiği bir hedef sayısı, artı "mağaza müdürü
// mü" işareti (Excel'de müdürler sıralamaya hiç girmiyor). Bu veri henüz
// projeksiyon/sıralama motoruna BAĞLANMADI (hangi metriğin hedeflendiği
// netleşince eklenecek); bu uç şimdilik SADECE hedef + müdür bilgisini
// girip saklamak için.
//
// GÜVENLİK: score-rules ile AYNI admin-gate (requireAdminSession).

import { NextRequest } from "next/server";

import { getPool, json, requireAdminSession } from "../score-rules/_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const BRANCH_LABELS = ["CMR MERKEZ", "CMR CADDE", "CMR SARAY", "CMR KAPAKLI"];

function currentPeriod() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

async function ensureTable() {
  const pool = getPool();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.wingsm_personnel_targets (
      id SERIAL PRIMARY KEY,
      branch_label TEXT NOT NULL,
      satici_adi TEXT NOT NULL,
      period TEXT NOT NULL,
      target_value NUMERIC NOT NULL DEFAULT 0,
      is_manager BOOLEAN NOT NULL DEFAULT false,
      active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT wingsm_personnel_targets_unique UNIQUE (branch_label, satici_adi, period),
      CONSTRAINT wingsm_personnel_targets_nonneg_chk CHECK (target_value >= 0)
    )
  `);

  return pool;
}

export async function GET(request: NextRequest) {
  const auth = requireAdminSession(request);

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const pool = await ensureTable();
    const period = request.nextUrl.searchParams.get("period") || currentPeriod();

    const result = await pool.query(
      `
        SELECT id, branch_label, satici_adi, period, target_value, is_manager, active, updated_at
        FROM public.wingsm_personnel_targets
        WHERE period = $1
        ORDER BY branch_label, satici_adi
      `,
      [period]
    );

    return json({ success: true, period, targets: result.rows });
  } catch (error) {
    console.error("WINGSM_PERSONNEL_TARGETS_GET_ERROR:", error);

    return json(
      { success: false, error: error instanceof Error ? error.message : "Personel hedefleri okunamadı." },
      500
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = requireAdminSession(request);

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const body = await request.json().catch(() => null);

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return json({ success: false, error: "Geçersiz istek gövdesi." }, 400);
    }

    const data = body as Record<string, unknown>;
    const branchLabel = String(data.branchLabel ?? "").trim();
    const saticiAdi = String(data.saticiAdi ?? "").trim();
    const period = String(data.period ?? "").trim();
    const targetValue = Number(data.targetValue ?? 0);
    const isManager = Boolean(data.isManager);

    if (!BRANCH_LABELS.includes(branchLabel)) {
      return json({ success: false, error: `Geçersiz mağaza: "${branchLabel}".` }, 400);
    }

    if (!saticiAdi) {
      return json({ success: false, error: "saticiAdi zorunludur." }, 400);
    }

    if (!/^\d{4}-\d{2}$/.test(period)) {
      return json({ success: false, error: 'period "YYYY-AA" biçiminde olmalıdır.' }, 400);
    }

    if (!Number.isFinite(targetValue) || targetValue < 0) {
      return json({ success: false, error: "targetValue sıfır ya da pozitif bir sayı olmalıdır." }, 400);
    }

    const pool = await ensureTable();

    const result = await pool.query(
      `
        INSERT INTO public.wingsm_personnel_targets
          (branch_label, satici_adi, period, target_value, is_manager, active, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, true, now(), now())
        ON CONFLICT (branch_label, satici_adi, period)
        DO UPDATE SET target_value = EXCLUDED.target_value, is_manager = EXCLUDED.is_manager, active = true, updated_at = now()
        WHERE public.wingsm_personnel_targets.active = false
        RETURNING id, branch_label, satici_adi, period, target_value, is_manager, active, updated_at
      `,
      [branchLabel, saticiAdi, period, targetValue, isManager]
    );

    // Satır pasife alınmışsa yukarıdaki DO UPDATE onu yeniden açar; aktif bir satır varsa hiçbir şey dönmez.
    if (result.rows.length === 0) {
      return json({ success: false, error: "Bu personel için bu dönemde zaten bir hedef var." }, 409);
    }

    return json({ success: true, target: result.rows[0] }, 201);
  } catch (error: any) {
    if (error?.code === "23505") {
      return json({ success: false, error: "Bu personel için bu dönemde zaten bir hedef var." }, 409);
    }

    console.error("WINGSM_PERSONNEL_TARGETS_POST_ERROR:", error);

    return json(
      { success: false, error: error instanceof Error ? error.message : "Personel hedefi oluşturulamadı." },
      500
    );
  }
}

// ======================================================
// TOPLU İŞLEM (PUT)
//   { period, rows: [{ branchLabel, saticiAdi, targetValue, isManager? }] }
//     Excel'den yapıştırılan satırları TEK işlemde yazar: dönemde olan kişinin hedefi
//     güncellenir (silinmişse yeniden aktif olur), olmayan eklenir. Bir satır geçersizse
//     hiçbiri yazılmaz. isManager verilmezse (null/yok) mevcut müdür işareti korunur.
//   { period, copyFrom }
//     copyFrom dönemindeki aktif kişileri (müdür işaretiyle, hedef 0) bu döneme kopyalar;
//     bu dönemde zaten olanlara dokunmaz.
// ======================================================

const MAX_BULK_ROWS = 300;

const nameKey = (value: string) => value.trim().replace(/\s+/g, " ").toLocaleUpperCase("tr-TR");

export async function PUT(request: NextRequest) {
  const auth = requireAdminSession(request);

  if (!auth.ok) {
    return auth.response;
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return json({ success: false, error: "Geçersiz istek gövdesi." }, 400);
  }

  const period = String(body.period ?? "").trim();

  if (!/^\d{4}-\d{2}$/.test(period)) {
    return json({ success: false, error: 'period "YYYY-AA" biçiminde olmalıdır.' }, 400);
  }

  try {
    const pool = await ensureTable();

    if (body.copyFrom !== undefined) {
      const copyFrom = String(body.copyFrom ?? "").trim();

      if (!/^\d{4}-\d{2}$/.test(copyFrom) || copyFrom === period) {
        return json({ success: false, error: "Kopyalanacak dönem geçersiz." }, 400);
      }

      const copied = await pool.query(
        `
          INSERT INTO public.wingsm_personnel_targets
            (branch_label, satici_adi, period, target_value, is_manager, active, created_at, updated_at)
          SELECT s.branch_label, s.satici_adi, $1, 0, s.is_manager, true, now(), now()
          FROM public.wingsm_personnel_targets s
          WHERE s.period = $2
            AND s.active
            AND NOT EXISTS (
              SELECT 1 FROM public.wingsm_personnel_targets t
              WHERE t.period = $1
                AND t.branch_label = s.branch_label
                AND upper(t.satici_adi) = upper(s.satici_adi)
            )
          ON CONFLICT (branch_label, satici_adi, period) DO NOTHING
        `,
        [period, copyFrom]
      );

      return json({ success: true, period, copied: copied.rowCount || 0 });
    }

    const rawRows = Array.isArray(body.rows) ? (body.rows as Array<Record<string, unknown>>) : [];

    if (rawRows.length === 0) {
      return json({ success: false, error: "Eklenecek satır yok." }, 400);
    }

    if (rawRows.length > MAX_BULK_ROWS) {
      return json({ success: false, error: `Tek seferde en fazla ${MAX_BULK_ROWS} satır eklenebilir.` }, 400);
    }

    const rows: Array<{ branchLabel: string; saticiAdi: string; targetValue: number; isManager: boolean | null }> = [];
    const seen = new Set<string>();

    for (const item of rawRows) {
      const branchLabel = String(item?.branchLabel ?? "").trim();
      const saticiAdi = String(item?.saticiAdi ?? "").trim().replace(/\s+/g, " ");
      const targetValue = Number(item?.targetValue ?? 0);

      if (!BRANCH_LABELS.includes(branchLabel)) {
        return json({ success: false, error: `Geçersiz mağaza: "${branchLabel}".` }, 400);
      }

      if (!saticiAdi || saticiAdi.length > 80) {
        return json({ success: false, error: `Personel adı geçersiz: "${saticiAdi}".` }, 400);
      }

      if (!Number.isFinite(targetValue) || targetValue < 0 || targetValue > 1_000_000_000) {
        return json({ success: false, error: `${saticiAdi} için hedef geçersiz.` }, 400);
      }

      const key = `${branchLabel}|${nameKey(saticiAdi)}`;

      if (seen.has(key)) {
        return json({ success: false, error: `${saticiAdi} (${branchLabel}) listede iki kez yazılmış.` }, 400);
      }

      seen.add(key);

      rows.push({
        branchLabel,
        saticiAdi,
        targetValue,
        isManager: typeof item?.isManager === "boolean" ? item.isManager : null,
      });
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const existing = await client.query(
        `SELECT id, branch_label, satici_adi FROM public.wingsm_personnel_targets WHERE period = $1`,
        [period]
      );
      const idByKey = new Map<string, number>();

      for (const row of existing.rows) {
        idByKey.set(`${row.branch_label}|${nameKey(String(row.satici_adi))}`, Number(row.id));
      }

      let added = 0;
      let updated = 0;

      for (const row of rows) {
        const id = idByKey.get(`${row.branchLabel}|${nameKey(row.saticiAdi)}`);

        if (id) {
          await client.query(
            `
              UPDATE public.wingsm_personnel_targets
              SET target_value = $2,
                  is_manager = COALESCE($3::boolean, is_manager),
                  active = true,
                  updated_at = now()
              WHERE id = $1
            `,
            [id, row.targetValue, row.isManager]
          );
          updated += 1;
        } else {
          await client.query(
            `
              INSERT INTO public.wingsm_personnel_targets
                (branch_label, satici_adi, period, target_value, is_manager, active, created_at, updated_at)
              VALUES ($1, $2, $3, $4, COALESCE($5::boolean, false), true, now(), now())
            `,
            [row.branchLabel, row.saticiAdi, period, row.targetValue, row.isManager]
          );
          added += 1;
        }
      }

      await client.query("COMMIT");

      return json({ success: true, period, added, updated });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("WINGSM_PERSONNEL_TARGETS_PUT_ERROR:", error);

    return json(
      { success: false, error: error instanceof Error ? error.message : "Toplu işlem yapılamadı." },
      500
    );
  }
}
