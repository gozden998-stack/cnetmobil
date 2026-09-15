// scripts/wingsm-sync-cron.mjs
//
// CNETMOBIL - WingSM stok otomatik senkron tetikleyici
//
// WingSM'e direkt baglanmaz.
// Mevcut:
//   POST /api/wingsm/sync-stock
// endpointini guvenli secret ile tetikler.
//
// WingSM tarafinda sadece GET islemleri yapilir.

const appUrl = String(
  process.env.APP_URL || ""
)
  .trim()
  .replace(/\/+$/, "");

const secret = String(
  process.env.WINGSM_SYNC_SECRET || ""
).trim();

if (!appUrl) {
  console.error(
    "[WINGSM CRON] APP_URL bulunamadı."
  );
  process.exit(1);
}

if (!secret) {
  console.error(
    "[WINGSM CRON] WINGSM_SYNC_SECRET bulunamadı."
  );
  process.exit(1);
}

const url =
  `${appUrl}/api/wingsm/sync-stock`;

const startedAt =
  Date.now();

console.log(
  `[WINGSM CRON] Başladı: ${new Date().toISOString()}`
);

try {
  const controller =
    new AbortController();

  const timeout =
    setTimeout(
      () => controller.abort(),
      4 * 60 * 1000
    );

  let response;

  try {
    response =
      await fetch(
        url,
        {
          method: "POST",

          headers: {
            Accept:
              "application/json",

            Authorization:
              `Bearer ${secret}`,
          },

          signal:
            controller.signal,
        }
      );
  } finally {
    clearTimeout(
      timeout
    );
  }

  const raw =
    await response.text();

  let result = {};

  try {
    result =
      JSON.parse(
        raw
      );
  } catch {
    throw new Error(
      `Geçersiz JSON cevabı. HTTP ${response.status}`
    );
  }

  if (
    !response.ok ||
    result?.success !==
      true
  ) {
    console.error(
      "[WINGSM CRON] Senkron başarısız."
    );

    console.error(
      JSON.stringify(
        {
          httpStatus:
            response.status,

          error:
            result?.error ||
            result?.message ||
            "Bilinmeyen hata",

          summary:
            result?.summary ||
            null,
        },
        null,
        2
      )
    );

    process.exit(1);
  }

  const durationMs =
    Date.now() -
    startedAt;

  console.log(
    "[WINGSM CRON] Senkron başarılı."
  );

  console.log(
    JSON.stringify(
      {
        mode:
          result?.mode,

        wingSMWrite:
          result?.wingSMWrite,

        postgresWrite:
          result?.postgresWrite,

        products:
          result?.summary
            ?.products,

        imeis:
          result?.summary
            ?.imeis,

        branches:
          result?.summary
            ?.branches,

        inserted:
          result?.summary
            ?.inserted,

        updated:
          result?.summary
            ?.updated,

        branchMoved:
          result?.summary
            ?.branchMoved,

        completedTransfers:
          result?.summary
            ?.completedTransfers,

        missingMarked:
          result?.summary
            ?.missingMarked,

        mismatchCount:
          result?.summary
            ?.mismatchCount,

        conflictCount:
          result?.summary
            ?.conflictCount,

        durationSeconds:
          Math.round(
            durationMs /
              1000
          ),
      },
      null,
      2
    )
  );

  process.exit(0);
} catch (error) {
  const durationMs =
    Date.now() -
    startedAt;

  if (
    error?.name ===
    "AbortError"
  ) {
    console.error(
      `[WINGSM CRON] Zaman aşımı. Süre: ${Math.round(
        durationMs / 1000
      )} saniye`
    );

    process.exit(1);
  }

  console.error(
    "[WINGSM CRON] Hata:",
    error instanceof Error
      ? error.message
      : error
  );

  process.exit(1);
}
