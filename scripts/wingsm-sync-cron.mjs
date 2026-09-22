// scripts/wingsm-sync-cron.mjs
//
// CNETMOBIL - WingSM otomatik stok + transfer tamamlama
//
// AKIS:
//
// 1) /api/wingsm/sync-stock
//    - WingSM stoklarini SADECE GET ile okur.
//    - PostgreSQL stock_devices gunceller.
//    - wingsm_device_locations gunceller.
//    - wingsm_sync_runs SUCCESS kaydi olusturur.
//
// 2) /api/wingsm/transfers/complete
//    - WingSM'e baglanip transfer YAPMAZ.
//    - PostgreSQL'deki WingSM dogrulama kayitlarini kontrol eder.
//    - Gercek transfer hedef magazada gorulduyse:
//        stock_devices -> hedef magaza / AVAILABLE
//        device_requests -> COMPLETED
//        device_transfers -> COMPLETED
//        stock_events -> TRANSFER_COMPLETED_WINGSM
//
// KESIN KURAL:
// WINGSM'E IS VERISI YAZILMAZ.

const appUrl = String(
  process.env.APP_URL || ""
)
  .trim()
  .replace(/\/+$/, "");

const secret = String(
  process.env.WINGSM_SYNC_SECRET || ""
).trim();

// ======================================================
// ENV KONTROL
// ======================================================

if (!appUrl) {
  console.error(
    "[WINGSM CRON] ❌ APP_URL bulunamadı."
  );

  process.exit(1);
}

if (!secret) {
  console.error(
    "[WINGSM CRON] ❌ WINGSM_SYNC_SECRET bulunamadı."
  );

  process.exit(1);
}

// ======================================================
// URL
// ======================================================

const syncUrl =
  `${appUrl}/api/wingsm/sync-stock`;

const transferUrl =
  `${appUrl}/api/wingsm/transfers/complete`;

// ======================================================
// REQUEST HELPER
// ======================================================

async function postJson(
  url,
  timeoutMs
) {
  const controller =
    new AbortController();

  const timeout =
    setTimeout(
      () => {
        controller.abort();
      },
      timeoutMs
    );

  try {
    const response =
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

          cache:
            "no-store",

          signal:
            controller.signal,
        }
      );

    const raw =
      await response.text();

    let data = null;

    try {
      data =
        raw
          ? JSON.parse(raw)
          : {};
    } catch {
      throw new Error(
        `Geçersiz JSON cevabı. HTTP ${response.status}`
      );
    }

    return {
      ok:
        response.ok,

      status:
        response.status,

      data,
    };
  } finally {
    clearTimeout(
      timeout
    );
  }
}

// ======================================================
// LOG HELPERS
// ======================================================

function printSyncSummary(
  result
) {
  const summary =
    result?.summary || {};

  console.log(
    JSON.stringify(
      {
        mode:
          result?.mode,

        wingSMWrite:
          result?.wingSMWrite,

        postgresWrite:
          result?.postgresWrite,

        transferCompletion:
          result?.transferCompletion,

        products:
          summary.products,

        stockRows:
          summary.stockRows,

        imeis:
          summary.imeis,

        branches:
          summary.branches,

        inserted:
          summary.inserted,

        updated:
          summary.updated,

        branchMoved:
          summary.branchMoved,

        wingLocationsUpdated:
          summary.wingLocationsUpdated,

        syncRunsWritten:
          summary.syncRunsWritten,

        missingMarked:
          summary.missingMarked,

        safeForMissing:
          summary.safeForMissing,

        safeBranches:
          summary.safeBranches,

        unsafeProductCodes:
          summary.unsafeProductCodes,

        unsafeProductBranchPairs:
          summary.unsafeProductBranchPairs,

        stockReadErrorCount:
          summary.stockReadErrorCount,

        detailErrorCount:
          summary.detailErrorCount,

        mismatchCount:
          summary.mismatchCount,

        conflictCount:
          summary.conflictCount,

        syncedAt:
          summary.syncedAt,
      },
      null,
      2
    )
  );

  // mismatchCount/conflictCount/detailErrorCount sifirdan buyukse,
  // HANGI urun/depo oldugunu da logla - eskiden bu bilgi sadece HTTP
  // cevabinda vardi, cron logunda gorunmuyordu.
  const warnings =
    result?.warnings || {};

  if (
    Array.isArray(warnings.mismatches) &&
    warnings.mismatches.length
  ) {
    console.warn(
      "[WINGSM CRON] ⚠️ Mismatch detayları:"
    );
    console.warn(
      JSON.stringify(warnings.mismatches, null, 2)
    );
  }

  if (
    Array.isArray(warnings.serialConflicts) &&
    warnings.serialConflicts.length
  ) {
    console.warn(
      "[WINGSM CRON] ⚠️ Seri çakışması detayları:"
    );
    console.warn(
      JSON.stringify(warnings.serialConflicts, null, 2)
    );
  }

  if (
    Array.isArray(warnings.detailErrors) &&
    warnings.detailErrors.length
  ) {
    console.warn(
      "[WINGSM CRON] ⚠️ Detay hatası detayları:"
    );
    console.warn(
      JSON.stringify(warnings.detailErrors, null, 2)
    );
  }
}

function printTransferSummary(
  result
) {
  console.log(
    JSON.stringify(
      {
        mode:
          result?.mode,

        status:
          result?.status,

        configured:
          result?.configured,

        requestedBy:
          result?.requestedBy,

        candidates:
          result?.counts
            ?.candidates ??
          0,

        completed:
          result?.counts
            ?.completed ??
          result?.completed ??
          0,

        skipped:
          result?.counts
            ?.skipped ??
          0,

        completedTransfers:
          result
            ?.completedTransfers ||
          [],

        skippedTransfers:
          result
            ?.skippedTransfers ||
          [],
      },
      null,
      2
    )
  );
}

// ======================================================
// MAIN
// ======================================================

async function main() {
  const startedAt =
    Date.now();

  console.log("");
  console.log(
    "======================================================"
  );

  console.log(
    `[WINGSM CRON] Başladı: ${new Date().toISOString()}`
  );

  console.log(
    "======================================================"
  );

  // ====================================================
  // ADIM 1 - WINGSM STOK SYNC
  // ====================================================

  console.log("");
  console.log(
    "[WINGSM CRON] 1/2 WingSM stok senkronu başlıyor..."
  );

  const syncStartedAt =
    Date.now();

  let syncResponse;

  try {
    syncResponse =
      await postJson(
        syncUrl,

        // WingSM'de yuzlerce urun detay GET'i yapiliyor.
        4 * 60 * 1000
      );
  } catch (error) {
    if (
      error?.name ===
      "AbortError"
    ) {
      console.error(
        "[WINGSM CRON] ❌ Stok senkronu zaman aşımına uğradı."
      );
    } else {
      console.error(
        "[WINGSM CRON] ❌ Stok senkron isteği başarısız:",
        error instanceof Error
          ? error.message
          : error
      );
    }

    process.exit(1);
  }

  const syncResult =
    syncResponse.data;

  if (
    !syncResponse.ok ||
    syncResult?.success !==
      true
  ) {
    console.error(
      "[WINGSM CRON] ❌ Stok senkronu başarısız."
    );

    console.error(
      JSON.stringify(
        {
          httpStatus:
            syncResponse.status,

          error:
            syncResult?.error ||
            syncResult?.message ||
            "Bilinmeyen stok senkron hatası",

          diagnostics:
            syncResult?.diagnostics ||
            null,
        },
        null,
        2
      )
    );

    // Stok sync basarisizsa
    // transfer tamamlamaya GECME.
    process.exit(1);
  }

  const syncDuration =
    Math.round(
      (
        Date.now() -
        syncStartedAt
      ) / 1000
    );

  console.log(
    `[WINGSM CRON] ✅ Stok senkronu başarılı. (${syncDuration} sn)`
  );

  printSyncSummary(
    syncResult
  );

  // ====================================================
  // GUVENLIK UYARISI
  // ====================================================

  const syncSummary =
    syncResult?.summary ||
    {};

  const unsafeSnapshot =
    syncSummary
      .stockReadErrorCount >
      0 ||
    syncSummary
      .detailErrorCount >
      0 ||
    syncSummary
      .mismatchCount >
      0 ||
    syncSummary
      .conflictCount >
      0;

  if (
    unsafeSnapshot
  ) {
    console.warn("");
    console.warn(
      "[WINGSM CRON] ⚠️ WingSM snapshot tamamen temiz değil."
    );

    console.warn(
      "[WINGSM CRON] Transfer kontrolü çalışacak ancak SUCCESS sync şartı nedeniyle güvensiz kayıtlar tamamlanmayacaktır."
    );
  }

  // ====================================================
  // ADIM 2 - TRANSFER COMPLETE
  // ====================================================

  console.log("");
  console.log(
    "[WINGSM CRON] 2/2 Bekleyen transfer kontrolü başlıyor..."
  );

  const transferStartedAt =
    Date.now();

  let transferResponse;

  try {
    transferResponse =
      await postJson(
        transferUrl,

        // Bu endpoint sadece PostgreSQL kontrolü yapar.
        60 * 1000
      );
  } catch (error) {
    if (
      error?.name ===
      "AbortError"
    ) {
      console.error(
        "[WINGSM CRON] ❌ Transfer kontrolü zaman aşımına uğradı."
      );
    } else {
      console.error(
        "[WINGSM CRON] ❌ Transfer kontrol isteği başarısız:",
        error instanceof Error
          ? error.message
          : error
      );
    }

    process.exit(1);
  }

  const transferResult =
    transferResponse.data;

  if (
    !transferResponse.ok ||
    transferResult?.success !==
      true
  ) {
    console.error(
      "[WINGSM CRON] ❌ Transfer kontrolü başarısız."
    );

    console.error(
      JSON.stringify(
        {
          httpStatus:
            transferResponse.status,

          error:
            transferResult?.error ||
            transferResult?.message ||
            "Bilinmeyen transfer hatası",
        },
        null,
        2
      )
    );

    process.exit(1);
  }

  const transferDuration =
    Math.round(
      (
        Date.now() -
        transferStartedAt
      ) / 1000
    );

  // ====================================================
  // TRANSFER SONUCU
  // ====================================================

  if (
    transferResult?.status ===
    "NO_READY_TRANSFER"
  ) {
    console.log(
      `[WINGSM CRON] ✅ Transfer kontrolü tamamlandı. Hazır transfer yok. (${transferDuration} sn)`
    );
  } else if (
    transferResult?.status ===
    "ALREADY_RUNNING"
  ) {
    console.log(
      `[WINGSM CRON] ℹ️ Transfer kontrolü başka bir görev tarafından çalıştırılıyor.`
    );
  } else {
    const completed =
      Number(
        transferResult
          ?.counts
          ?.completed ||
        transferResult
          ?.completed ||
        0
      );

    if (
      completed >
      0
    ) {
      console.log(
        `[WINGSM CRON] ✅ ${completed} gerçek WingSM transferi tamamlandı. (${transferDuration} sn)`
      );
    } else {
      console.log(
        `[WINGSM CRON] ✅ Transfer kontrolü tamamlandı. (${transferDuration} sn)`
      );
    }
  }

  printTransferSummary(
    transferResult
  );

  // ====================================================
  // FINAL
  // ====================================================

  const totalDuration =
    Math.round(
      (
        Date.now() -
        startedAt
      ) / 1000
    );

  const completedTransfers =
    Number(
      transferResult
        ?.counts
        ?.completed ||
      transferResult
        ?.completed ||
      0
    );

  console.log("");
  console.log(
    "======================================================"
  );

  console.log(
    "[WINGSM CRON] ✅ TÜM İŞLEMLER TAMAMLANDI"
  );

  console.log(
    JSON.stringify(
      {
        stockSync:
          "SUCCESS",

        transferCheck:
          transferResult
            ?.status ||
          "SUCCESS",

        imeis:
          syncSummary
            .imeis ||
          0,

        completedTransfers,

        totalDurationSeconds:
          totalDuration,

        finishedAt:
          new Date()
            .toISOString(),
      },
      null,
      2
    )
  );

  console.log(
    "======================================================"
  );

  console.log("");

  process.exit(0);
}

// ======================================================
// RUN
// ======================================================

main().catch(
  (
    error
  ) => {
    console.error(
      "[WINGSM CRON] ❌ Beklenmeyen hata:",
      error instanceof Error
        ? error.message
        : error
    );

    process.exit(1);
  }
);
