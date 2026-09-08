"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

type CenterState = {
  loading: boolean;
  success: boolean;
  error: string;
  data: any;
};

type ChannelCode =
  | "N11"
  | "IKAS"
  | "IDEFIX";

function formatDateTime(
  value: unknown
) {
  if (!value) {
    return "-";
  }

  const date =
    new Date(
      String(value)
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "-";
  }

  return new Intl.DateTimeFormat(
    "tr-TR",
    {
      dateStyle: "short",
      timeStyle: "medium",
    }
  ).format(date);
}

function normalize(
  value: unknown
) {
  return String(
    value ?? ""
  )
    .trim()
    .toLocaleLowerCase(
      "tr-TR"
    );
}

function channelStatusMeta(
  rawStatus: unknown
) {
  const status =
    String(
      rawStatus ?? ""
    )
      .trim()
      .toUpperCase();

  if (
    status === "LISTED"
  ) {
    return {
      label: "Gönderildi",
      className:
        "border-emerald-200 bg-emerald-50 text-emerald-700",
      mark: "✓",
    };
  }

  if (
    status ===
    "PENDING_CREATE"
  ) {
    return {
      label:
        "Hazırlanıyor",
      className:
        "border-amber-200 bg-amber-50 text-amber-700",
      mark: "•",
    };
  }

  if (
    status ===
    "RESERVED"
  ) {
    return {
      label: "Rezerve",
      className:
        "border-blue-200 bg-blue-50 text-blue-700",
      mark: "●",
    };
  }

  if (
    status === "SOLD"
  ) {
    return {
      label: "Satıldı",
      className:
        "border-slate-300 bg-slate-100 text-slate-700",
      mark: "✓",
    };
  }

  if (
    status === "ERROR"
  ) {
    return {
      label: "Hata",
      className:
        "border-rose-200 bg-rose-50 text-rose-700",
      mark: "!",
    };
  }

  return {
    label:
      "Gönderilebilir",
    className:
      "border-slate-200 bg-white text-slate-500",
    mark: "+",
  };
}

function deviceStatusMeta(
  rawStatus: unknown
) {
  const status =
    String(
      rawStatus ?? ""
    )
      .trim()
      .toUpperCase();

  if (
    status ===
    "AVAILABLE"
  ) {
    return {
      label: "Stokta",
      className:
        "bg-emerald-100 text-emerald-700",
    };
  }

  if (
    status ===
    "DETAILS_PENDING"
  ) {
    return {
      label:
        "Detay Bekliyor",
      className:
        "bg-amber-100 text-amber-700",
    };
  }

  if (
    status ===
    "REQUESTED"
  ) {
    return {
      label: "Talepte",
      className:
        "bg-violet-100 text-violet-700",
    };
  }

  if (
    status ===
    "TRANSFER_WAITING"
  ) {
    return {
      label:
        "Transfer Bekliyor",
      className:
        "bg-blue-100 text-blue-700",
    };
  }

  if (
    status === "SOLD"
  ) {
    return {
      label: "Satıldı",
      className:
        "bg-slate-200 text-slate-700",
    };
  }

  return {
    label:
      status || "-",
    className:
      "bg-slate-100 text-slate-600",
  };
}

function ChannelBadge({
  channel,
  status,
}: {
  channel: ChannelCode;
  status: unknown;
}) {
  const meta =
    channelStatusMeta(
      status
    );

  return (
    <div
      className={`inline-flex min-w-[104px] items-center justify-center gap-1.5 rounded-lg border px-2.5 py-2 text-[7px] font-black uppercase tracking-wide ${meta.className}`}
      title={`${channel}: ${meta.label}`}
    >
      <span>
        {meta.mark}
      </span>
      <span>
        {meta.label}
      </span>
    </div>
  );
}

export default function Merkez() {
  const [
    center,
    setCenter,
  ] = useState<CenterState>({
    loading: true,
    success: false,
    error: "",
    data: null,
  });

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    onlyAvailable,
    setOnlyAvailable,
  ] = useState(true);

  const [
    expandedKey,
    setExpandedKey,
  ] = useState<
    string | null
  >(null);

  const loadCenter =
    useCallback(
      async (
        silent = false
      ) => {
        if (!silent) {
          setCenter(
            (current) => ({
              ...current,
              loading: true,
              error: "",
            })
          );
        }

        try {
          const response =
            await fetch(
              "/api/online/center/devices",
              {
                method: "GET",
                cache:
                  "no-store",
              }
            );

          const raw =
            await response.text();

          let payload:
            any = null;

          try {
            payload =
              raw
                ? JSON.parse(
                    raw
                  )
                : null;
          } catch {
            throw new Error(
              `Merkez API JSON dönmedi. HTTP ${response.status}. Route deploy edilmiş mi kontrol et.`
            );
          }

          if (
            !response.ok ||
            !payload?.success
          ) {
            throw new Error(
              payload?.error ||
                "Merkez stoğu okunamadı."
            );
          }

          setCenter({
            loading: false,
            success: true,
            error: "",
            data: payload,
          });
        } catch (error) {
          setCenter(
            (current) => ({
              ...current,
              loading: false,
              error:
                error instanceof
                  Error
                  ? error.message
                  : "Merkez stoğu okunamadı.",
            })
          );
        }
      },
      []
    );

  useEffect(() => {
    void loadCenter();
  }, [loadCenter]);

  const groups =
    useMemo(
      () =>
        Array.isArray(
          center.data?.groups
        )
          ? center.data
              .groups
          : [],
      [center.data]
    );

  const visibleGroups =
    useMemo(() => {
      const q =
        normalize(search);

      return groups
        .map(
          (group: any) => {
            const devices =
              (
                Array.isArray(
                  group?.devices
                )
                  ? group.devices
                  : []
              ).filter(
                (
                  device: any
                ) => {
                  if (
                    onlyAvailable &&
                    device
                      ?.status !==
                      "AVAILABLE"
                  ) {
                    return false;
                  }

                  if (!q) {
                    return true;
                  }

                  const channelText =
                    [
                      device
                        ?.channels
                        ?.N11
                        ?.status,
                      device
                        ?.channels
                        ?.IKAS
                        ?.status,
                      device
                        ?.channels
                        ?.IDEFIX
                        ?.status,
                    ].join(" ");

                  const haystack =
                    [
                      device?.imei,
                      device?.brand,
                      device?.model,
                      device?.memory,
                      device?.color,
                      device?.grade,
                      device?.warranty,
                      device
                        ?.current_branch_code,
                      device?.status,
                      channelText,
                    ]
                      .join(" ")
                      .toLocaleLowerCase(
                        "tr-TR"
                      );

                  return haystack.includes(
                    q
                  );
                }
              );

            const groupText =
              [
                group?.brand,
                group?.model,
                group?.memory,
                group?.color,
                group?.grade,
                group?.warranty,
              ]
                .join(" ")
                .toLocaleLowerCase(
                  "tr-TR"
                );

            if (
              q &&
              devices.length ===
                0 &&
              !groupText.includes(
                q
              )
            ) {
              return null;
            }

            const finalDevices =
              q &&
              groupText.includes(
                q
              )
                ? (
                    Array.isArray(
                      group?.devices
                    )
                      ? group.devices
                      : []
                  ).filter(
                    (
                      device: any
                    ) =>
                      !onlyAvailable ||
                      device
                        ?.status ===
                        "AVAILABLE"
                  )
                : devices;

            if (
              finalDevices
                .length === 0
            ) {
              return null;
            }

            const sentCount = (
              channel: ChannelCode
            ) =>
              finalDevices.filter(
                (
                  device: any
                ) =>
                  [
                    "LISTED",
                    "RESERVED",
                    "SOLD",
                    "PENDING_CREATE",
                  ].includes(
                    String(
                      device
                        ?.channels?.[
                        channel
                      ]?.status ||
                        ""
                    ).toUpperCase()
                  )
              ).length;

            return {
              ...group,
              devices:
                finalDevices,
              visibleTotal:
                finalDevices.length,
              visibleChannelSummary:
                {
                  N11:
                    sentCount(
                      "N11"
                    ),
                  IKAS:
                    sentCount(
                      "IKAS"
                    ),
                  IDEFIX:
                    sentCount(
                      "IDEFIX"
                    ),
                },
            };
          }
        )
        .filter(Boolean);
    }, [
      groups,
      search,
      onlyAvailable,
    ]);

  const summary =
    center.data?.summary ||
    {};

  const cards = [
    {
      label:
        "Fiziksel Stok",
      value:
        summary
          ?.activePhysicalStock ??
        0,
      detail:
        "Merkez aktif IMEI",
    },
    {
      label:
        "Gönderilebilir",
      value:
        summary
          ?.availableDevices ??
        0,
      detail:
        "AVAILABLE cihaz",
    },
    {
      label: "N11",
      value:
        summary?.n11 ?? 0,
      detail:
        "Kanala bağlı IMEI",
    },
    {
      label: "İkas",
      value:
        summary?.ikas ?? 0,
      detail:
        "Gönderildi / hazırlanıyor",
    },
    {
      label: "İdefix",
      value:
        summary?.idefix ??
        0,
      detail:
        "Kanala bağlı IMEI",
    },
  ];

  return (
    <div className="animate-in fade-in duration-300">
      <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-gradient-to-r from-slate-950 via-blue-950 to-cyan-950 px-6 py-7 text-white sm:px-8">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="text-[9px] font-black uppercase tracking-[0.22em] text-cyan-200/70">
                Entegrasyonlar / Merkez
              </div>

              <div className="mt-1 flex flex-wrap items-center gap-3">
                <h2 className="text-2xl font-black tracking-tight sm:text-3xl">
                  Merkezi IMEI Stok
                </h2>

                <span className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-2.5 py-1 text-[8px] font-black uppercase text-cyan-100">
                  ADIM 1
                </span>
              </div>

              <p className="mt-2 max-w-3xl text-[10px] font-semibold leading-5 text-slate-300">
                Fiziksel cihaz tek merkezde tutulur. Her IMEI'nin N11, İkas ve İdefix kanal durumu ayrı izlenir.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                <div className="text-[7px] font-black uppercase tracking-wide text-slate-400">
                  Son Okuma
                </div>
                <div className="mt-0.5 text-[9px] font-black text-white">
                  {formatDateTime(
                    center.data
                      ?.checkedAt
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  void loadCenter();
                }}
                disabled={
                  center.loading
                }
                className="h-10 rounded-xl bg-cyan-500 px-4 text-[8px] font-black uppercase tracking-wide text-slate-950 transition hover:bg-cyan-400 disabled:cursor-wait disabled:opacity-50"
              >
                {center.loading
                  ? "Yenileniyor..."
                  : "Merkezi Yenile"}
              </button>
            </div>
          </div>
        </div>

        {center.error && (
          <div className="border-b border-rose-200 bg-rose-50 px-5 py-3 text-[9px] font-black text-rose-700 sm:px-6">
            {center.error}
          </div>
        )}

        {!center.data
          ?.channelMembershipTableReady &&
          center.success && (
            <div className="border-b border-amber-200 bg-amber-50 px-5 py-3 text-[8px] font-bold text-amber-800 sm:px-6">
              Kanal IMEI üyelik tablosu bulunamadı. N11 durumları eski availableImeis kayıtlarından okunuyor; İkas/İdefix üyelikleri için ADIM 8 migration gerekir.
            </div>
          )}

        <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-5 sm:p-6">
          {cards.map(
            (
              card,
              index
            ) => (
              <div
                key={
                  card.label
                }
                className={`rounded-2xl border p-5 ${
                  index === 0
                    ? "border-cyan-200 bg-cyan-50/60"
                    : "border-slate-200 bg-white"
                }`}
              >
                <div className="text-[8px] font-black uppercase tracking-[0.16em] text-slate-400">
                  {card.label}
                </div>

                <div className="mt-2 text-2xl font-black text-slate-950">
                  {card.value}
                </div>

                <div className="mt-1 text-[8px] font-semibold text-slate-400">
                  {card.detail}
                </div>
              </div>
            )
          )}
        </div>

        <div className="border-t border-slate-200">
          <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50/70 px-5 py-4 xl:flex-row xl:items-center xl:justify-between sm:px-6">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setOnlyAvailable(
                    true
                  )
                }
                className={`rounded-xl px-3 py-2 text-[8px] font-black uppercase tracking-wide ${
                  onlyAvailable
                    ? "bg-slate-950 text-white"
                    : "border border-slate-200 bg-white text-slate-500"
                }`}
              >
                Sadece AVAILABLE
              </button>

              <button
                type="button"
                onClick={() =>
                  setOnlyAvailable(
                    false
                  )
                }
                className={`rounded-xl px-3 py-2 text-[8px] font-black uppercase tracking-wide ${
                  !onlyAvailable
                    ? "bg-slate-950 text-white"
                    : "border border-slate-200 bg-white text-slate-500"
                }`}
              >
                Tüm Durumlar
              </button>

              <span className="rounded-full bg-white px-2.5 py-1.5 text-[8px] font-black text-slate-500 ring-1 ring-slate-200">
                Ürün Grubu:{" "}
                {
                  visibleGroups.length
                }
              </span>
            </div>

            <div className="relative">
              <svg
                className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="m21 21-4.35-4.35m1.35-5.65a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z"
                />
              </svg>

              <input
                value={search}
                onChange={(
                  event
                ) =>
                  setSearch(
                    event.target
                      .value
                  )
                }
                placeholder="IMEI, ürün, renk, mağaza ara..."
                className="h-10 w-[320px] max-w-[75vw] rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-[9px] font-semibold text-slate-700 outline-none transition focus:border-cyan-400"
              />
            </div>
          </div>

          {center.loading &&
          !center.success ? (
            <div className="px-6 py-20 text-center">
              <div className="text-[11px] font-black text-slate-700">
                Merkezi IMEI stoğu okunuyor...
              </div>

              <div className="mt-2 text-[9px] font-semibold text-slate-400">
                stock_devices ve kanal üyelikleri birleştiriliyor.
              </div>
            </div>
          ) : visibleGroups.length ===
            0 ? (
            <div className="px-6 py-20 text-center">
              <div className="text-[11px] font-black text-slate-700">
                Cihaz bulunamadı
              </div>

              <div className="mt-2 text-[9px] font-semibold text-slate-400">
                Filtreyi veya aramayı değiştir.
              </div>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {visibleGroups.map(
                (
                  group: any
                ) => {
                  const open =
                    expandedKey ===
                    group.key;

                  return (
                    <div
                      key={
                        group.key
                      }
                      className="px-5 py-4 sm:px-6"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedKey(
                            open
                              ? null
                              : group.key
                          )
                        }
                        className="grid w-full gap-4 text-left xl:grid-cols-[minmax(280px,1.5fr)_85px_115px_115px_115px_34px] xl:items-center"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-[12px] font-black text-slate-900">
                            {group.brand}{" "}
                            {group.model}
                          </div>

                          <div className="mt-1 flex flex-wrap gap-1.5">
                            <span className="rounded-full bg-slate-100 px-2 py-1 text-[7px] font-black text-slate-600">
                              {group.memory}
                            </span>

                            <span className="rounded-full bg-slate-100 px-2 py-1 text-[7px] font-black text-slate-600">
                              {group.color}
                            </span>

                            <span className="rounded-full bg-violet-100 px-2 py-1 text-[7px] font-black text-violet-700">
                              Grade {group.grade}
                            </span>

                            <span className="rounded-full bg-blue-100 px-2 py-1 text-[7px] font-black text-blue-700">
                              {group.warranty}
                            </span>
                          </div>
                        </div>

                        <div>
                          <div className="text-[7px] font-black uppercase text-slate-400">
                            IMEI
                          </div>
                          <div className="mt-1 text-[13px] font-black text-slate-900">
                            {
                              group.visibleTotal
                            }
                          </div>
                        </div>

                        {(
                          [
                            "N11",
                            "IKAS",
                            "IDEFIX",
                          ] as ChannelCode[]
                        ).map(
                          (
                            channel
                          ) => (
                            <div
                              key={
                                channel
                              }
                            >
                              <div className="text-[7px] font-black uppercase text-slate-400">
                                {
                                  channel ===
                                  "IKAS"
                                    ? "İkas"
                                    : channel ===
                                      "IDEFIX"
                                    ? "İdefix"
                                    : "N11"
                                }
                              </div>

                              <div className="mt-1 text-[11px] font-black text-slate-800">
                                {
                                  group
                                    .visibleChannelSummary?.[
                                    channel
                                  ] ??
                                  0
                                }{" "}
                                /{" "}
                                {
                                  group.visibleTotal
                                }
                              </div>
                            </div>
                          )
                        )}

                        <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-500">
                          <svg
                            className={`h-3.5 w-3.5 transition ${
                              open
                                ? "rotate-180"
                                : ""
                            }`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="m19 9-7 7-7-7"
                            />
                          </svg>
                        </div>
                      </button>

                      {open && (
                        <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
                          <div className="min-w-[980px]">
                            <div className="grid grid-cols-[170px_120px_minmax(170px,1fr)_120px_120px_120px_120px] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-[7px] font-black uppercase tracking-wide text-slate-400">
                              <div>
                                IMEI
                              </div>
                              <div>
                                Mağaza
                              </div>
                              <div>
                                Cihaz
                              </div>
                              <div>
                                Durum
                              </div>
                              <div>
                                N11
                              </div>
                              <div>
                                İkas
                              </div>
                              <div>
                                İdefix
                              </div>
                            </div>

                            {(
                              Array.isArray(
                                group
                                  ?.devices
                              )
                                ? group.devices
                                : []
                            ).map(
                              (
                                device: any
                              ) => {
                                const deviceMeta =
                                  deviceStatusMeta(
                                    device
                                      ?.status
                                  );

                                return (
                                  <div
                                    key={
                                      device.id
                                    }
                                    className="grid grid-cols-[170px_120px_minmax(170px,1fr)_120px_120px_120px_120px] items-center gap-3 border-b border-slate-100 px-4 py-3 text-[8px] last:border-0"
                                  >
                                    <div className="font-black text-slate-900">
                                      {
                                        device.imei
                                      }
                                    </div>

                                    <div className="font-bold text-slate-500">
                                      {device
                                        ?.current_branch_code ||
                                        "-"}
                                    </div>

                                    <div>
                                      <div className="font-black text-slate-800">
                                        {device
                                          ?.brand ||
                                          "-"}{" "}
                                        {device
                                          ?.model ||
                                          "-"}
                                      </div>

                                      <div className="mt-1 text-[7px] font-bold text-slate-400">
                                        {device
                                          ?.memory ||
                                          "-"}{" "}
                                        ·{" "}
                                        {device
                                          ?.color ||
                                          "-"}{" "}
                                        · Grade{" "}
                                        {device
                                          ?.grade ||
                                          "-"}
                                      </div>
                                    </div>

                                    <div>
                                      <span
                                        className={`inline-flex rounded-full px-2 py-1 text-[7px] font-black uppercase ${deviceMeta.className}`}
                                      >
                                        {
                                          deviceMeta.label
                                        }
                                      </span>
                                    </div>

                                    <ChannelBadge
                                      channel="N11"
                                      status={
                                        device
                                          ?.channels
                                          ?.N11
                                          ?.status
                                      }
                                    />

                                    <ChannelBadge
                                      channel="IKAS"
                                      status={
                                        device
                                          ?.channels
                                          ?.IKAS
                                          ?.status
                                      }
                                    />

                                    <ChannelBadge
                                      channel="IDEFIX"
                                      status={
                                        device
                                          ?.channels
                                          ?.IDEFIX
                                          ?.status
                                      }
                                    />
                                  </div>
                                );
                              }
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                }
              )}
            </div>
          )}
        </div>

        <div className="border-t border-slate-200 bg-slate-50 px-5 py-3 text-[8px] font-bold text-slate-400 sm:px-6">
          MERKEZ ADIM 1 · Salt okunur · Sonraki adım: IMEI seçimi + kanal bazlı gönderim ve fiyat ekranı
        </div>
      </div>
    </div>
  );
}
