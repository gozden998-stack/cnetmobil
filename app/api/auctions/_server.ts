export function apiError(error: any) {
  const status = Number(error?.status || 500);

  console.error("IHALE_API_ERROR:", {
    message: error?.message,
    stack: error?.stack,
    code: error?.code,
    detail: error?.detail,
  });

  return Response.json(
    {
      ok: false,
      error:
        error?.message ||
        "İhale işlemi sırasında sunucu hatası oluştu.",

      debug:
        status >= 500
          ? {
              code: error?.code || null,
              detail: error?.detail || null,
            }
          : undefined,
    },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
