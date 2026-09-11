"use client";

import React, { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type AuctionStatus = "DRAFT" | "LIVE" | "PAUSED" | "ENDED" | "CANCELLED";

type Auction = {
  id: number;
  title: string;
  item_name: string;
  item_description?: string | null;
  item_image_url?: string | null;
  channel_scope: "CMR" | "VODAFONE" | "BOTH";
  starting_price: string | number;
  min_increment: string | number;
  duration_minutes?: number;
  status: AuctionStatus;
  starts_at?: string | null;
  ends_at?: string | null;
  paused_at?: string | null;
  current_price: string | number;
  bid_count: number;
  winner_bid_id?: number | null;
  winner_branch?: string | null;
  winning_amount?: string | number | null;
  created_at: string;
};

type Bid = {
  id: number;
  anonymous_code: string;
  amount: string | number;
  created_at: string;
  is_mine?: boolean;
  bidder_user_id?: string;
  bidder_name?: string;
  bidder_branch?: string;
};

type DetailResponse = {
  ok: boolean;
  auction: Auction;
  bids: Bid[];
  session?: {
    isAdmin?: boolean;
    isSuperAdmin?: boolean;
    isManager?: boolean;
    roleCode?: string;
    branch: string;
    channel: string | null;
  };
};

type AuctionSessionInfo = {
  isAdmin?: boolean;
  isSuperAdmin?: boolean;
  isManager?: boolean;
  roleCode?: string;
  branch: string;
  channel: string | null;
};

type Props = {
  isAdmin: boolean;
  selectedBranch: string;
};

const STATUS_LABEL: Record<AuctionStatus, string> = {
  DRAFT: "Taslak",
  LIVE: "Canlı",
  PAUSED: "Duraklatıldı",
  ENDED: "Bitti",
  CANCELLED: "İptal",
};

const STATUS_STYLE: Record<AuctionStatus, string> = {
  DRAFT: "border-slate-200 bg-slate-100 text-slate-600",
  LIVE: "border-emerald-200 bg-emerald-50 text-emerald-700",
  PAUSED: "border-amber-200 bg-amber-50 text-amber-700",
  ENDED: "border-blue-200 bg-blue-50 text-blue-700",
  CANCELLED: "border-rose-200 bg-rose-50 text-rose-700",
};

function tl(value: unknown) {
  const number = Number(value || 0);
  return `${number.toLocaleString("tr-TR", {
    maximumFractionDigits: 0,
  })} TL`;
}

function dateTime(value?: string | null) {
  if (!value) return "-";

  return new Date(value).toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function remainingText(endsAt?: string | null, now = Date.now()) {
  if (!endsAt) return "--:--";

  const diff = Math.max(0, new Date(endsAt).getTime() - now);
  const totalSeconds = Math.floor(diff / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const restMinutes = minutes % 60;
    return `${hours}s ${String(restMinutes).padStart(2, "0")}dk`;
  }

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function scopeLabel(scope: Auction["channel_scope"]) {
  if (scope === "CMR") return "Sadece CMR";
  if (scope === "VODAFONE") return "Sadece Vodafone";
  return "CMR + Vodafone";
}

function durationLabel(minutes?: number) {
  const total = Number(minutes || 0);
  if (!total) return "-";
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  if (hours && rest) return `${hours} saat ${rest} dk`;
  if (hours) return `${hours} saat`;
  return `${rest} dk`;
}

export default function Ihale({ isAdmin: _legacyAdmin, selectedBranch }: Props) {
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<DetailResponse | null>(null);

  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [accessError, setAccessError] = useState("");

  const [now, setNow] = useState(Date.now());
  const [bidAmount, setBidAmount] = useState("");
  const [bidderName, setBidderName] = useState("");
  const [listSession, setListSession] = useState<AuctionSessionInfo | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [durationPreset, setDurationPreset] = useState("720");
  const [customHours, setCustomHours] = useState("");
  const [customMinutes, setCustomMinutes] = useState("");
  const [createForm, setCreateForm] = useState({
    title: "",
    itemName: "",
    itemDescription: "",
    itemImageUrl: "",
    channelScope: "BOTH",
    startingPrice: "",
    minIncrement: "50",
    durationMinutes: "720",
  });

  const selectedIdRef = useRef<number | null>(null);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  const loadDetail = async (auctionId: number, silent = false) => {
    if (!silent) setDetailLoading(true);

    try {
      const response = await fetch(`/api/auctions/${auctionId}`, {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || "İhale detayı alınamadı.");
      }

      setDetail(data);
      if (data?.session) setListSession(data.session);
      setAccessError("");
    } catch (error: any) {
      if (!silent) {
        setMessage(error?.message || "İhale detayı alınamadı.");
      }
    } finally {
      if (!silent) setDetailLoading(false);
    }
  };

  const loadAuctions = async (silent = false) => {
    if (!silent) setLoading(true);

    try {
      const response = await fetch("/api/auctions", {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data?.ok) {
        if (response.status === 403) {
          setAccessError(
            data?.error ||
              "İhale sadece CMR ve Vodafone kullanıcılarına açıktır."
          );
          setAuctions([]);
          setDetail(null);
          return;
        }

        throw new Error(data?.error || "İhaleler alınamadı.");
      }

      const rows = Array.isArray(data.auctions) ? data.auctions : [];
      setAuctions(rows);
      if (data?.session) setListSession(data.session);
      setAccessError("");

      const currentSelected = selectedIdRef.current;
      const nextSelected =
        currentSelected && rows.some((item: Auction) => item.id === currentSelected)
          ? currentSelected
          : rows[0]?.id || null;

      if (nextSelected !== currentSelected) {
        setSelectedId(nextSelected);
        selectedIdRef.current = nextSelected;
      }

      if (nextSelected) {
        await loadDetail(nextSelected, true);
      } else {
        setDetail(null);
      }
    } catch (error: any) {
      if (!silent) setMessage(error?.message || "İhaleler alınamadı.");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadAuctions();

    const poll = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        loadAuctions(true);
      }
    }, 2000);

    return () => window.clearInterval(poll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const selectedAuction = detail?.auction || null;
  const bids = detail?.bids || [];
  const activeSession = detail?.session || listSession;
  const isSuperAdmin = Boolean(activeSession?.isSuperAdmin);

  const currentPrice = Number(
    selectedAuction?.current_price ||
      selectedAuction?.starting_price ||
      0
  );

  const minIncrement = Number(selectedAuction?.min_increment || 50);

  const minimumBid = useMemo(() => {
    if (!selectedAuction) return 0;
    if (Number(selectedAuction.bid_count || 0) === 0) {
      return Number(selectedAuction.starting_price || 0);
    }
    return currentPrice + minIncrement;
  }, [selectedAuction, currentPrice, minIncrement]);

  useEffect(() => {
    if (selectedAuction?.status === "LIVE") {
      setBidAmount(String(Math.max(0, minimumBid)));
    }
  }, [selectedAuction?.id, selectedAuction?.status, minimumBid]);

  const selectAuction = async (id: number) => {
    setSelectedId(id);
    selectedIdRef.current = id;
    setMessage("");
    await loadDetail(id);
  };

  const createAuction = async (event: FormEvent) => {
    event.preventDefault();

    setBusy(true);
    setMessage("");

    try {
      const response = await fetch("/api/auctions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createForm),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || "İhale oluşturulamadı.");
      }

      setCreateOpen(false);
      setCreateForm({
        title: "",
        itemName: "",
        itemDescription: "",
        itemImageUrl: "",
        channelScope: "BOTH",
        startingPrice: "",
        minIncrement: "50",
        durationMinutes: "720",
      });
      setDurationPreset("720");
      setCustomHours("");
      setCustomMinutes("");

      setSelectedId(Number(data.auction.id));
      selectedIdRef.current = Number(data.auction.id);
      setMessage("İhale taslak olarak oluşturuldu.");
      await loadAuctions(true);
    } catch (error: any) {
      setMessage(error?.message || "İhale oluşturulamadı.");
    } finally {
      setBusy(false);
    }
  };

  const adminAction = async (
    action: string,
    extra: Record<string, any> = {}
  ) => {
    if (!selectedAuction) return;

    if (
      ["END", "CANCEL", "SELECT_WINNER"].includes(action) &&
      !window.confirm("Bu işlemi onaylıyor musunuz?")
    ) {
      return;
    }

    setBusy(true);
    setMessage("");

    try {
      const response = await fetch(`/api/auctions/${selectedAuction.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || "İşlem yapılamadı.");
      }

      setMessage("İşlem tamamlandı.");
      await loadAuctions(true);
    } catch (error: any) {
      setMessage(error?.message || "İşlem yapılamadı.");
    } finally {
      setBusy(false);
    }
  };

  const placeBid = async () => {
    if (!selectedAuction) return;

    if (bidderName.trim().length < 3) {
      setMessage("Teklif vermek için Ad Soyad girin.");
      return;
    }

    setBusy(true);
    setMessage("");

    try {
      const response = await fetch(
        `/api/auctions/${selectedAuction.id}/bid`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: Number(bidAmount),
            bidderName: bidderName.trim(),
          }),
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data?.ok) {
        if (data?.minimumAllowed) {
          setBidAmount(String(data.minimumAllowed));
        }
        throw new Error(data?.error || "Teklif verilemedi.");
      }

      setMessage("Teklifiniz alındı.");
      await loadAuctions(true);
    } catch (error: any) {
      setMessage(error?.message || "Teklif verilemedi.");
    } finally {
      setBusy(false);
    }
  };

  const deleteAuction = async () => {
    if (!selectedAuction || !isSuperAdmin) return;

    if (
      !window.confirm(
        "Bu ihale ve tüm teklif geçmişi kalıcı olarak silinecek. Emin misiniz?"
      )
    ) {
      return;
    }

    setBusy(true);
    setMessage("");

    try {
      const response = await fetch(`/api/auctions/${selectedAuction.id}`, {
        method: "DELETE",
        headers: { Accept: "application/json" },
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || "İhale silinemedi.");
      }

      setSelectedId(null);
      selectedIdRef.current = null;
      setDetail(null);
      setMessage("İhale kalıcı olarak silindi.");
      await loadAuctions(true);
    } catch (error: any) {
      setMessage(error?.message || "İhale silinemedi.");
    } finally {
      setBusy(false);
    }
  };

  if (accessError) {
    return (
      <div className="mx-auto max-w-3xl rounded-[28px] border border-rose-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
          <GavelIcon className="h-7 w-7" />
        </div>
        <h2 className="mt-4 text-2xl font-black text-slate-900">
          İhale Erişimi Kapalı
        </h2>
        <p className="mt-2 text-sm font-semibold text-slate-500">
          {accessError}
        </p>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-300">
      <section className="overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-sm">
        <div className="relative overflow-hidden bg-[linear-gradient(135deg,#071426_0%,#123b68_55%,#0c2340_100%)] px-5 py-5 text-white sm:px-7 sm:py-6">
          <div className="pointer-events-none absolute -right-10 -top-20 h-60 w-60 rounded-full bg-blue-400/20 blur-3xl" />

          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/10">
                <GavelIcon className="h-6 w-6" />
              </div>

              <div className="min-w-0">
                <div className="text-[9px] font-black uppercase tracking-[0.24em] text-blue-200/70">
                  CNETMOBIL LIVE
                </div>
                <h1 className="mt-1 truncate text-2xl font-black tracking-tight sm:text-3xl">
                  Mağazalar Arası İhale
                </h1>
                <p className="mt-1 text-[10px] font-semibold text-blue-100/60 sm:text-xs">
                  CMR ve Vodafone • Teklif verenler anonim • Super Admin kontrollü
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[10px] font-black text-blue-100">
                {selectedBranch}
              </div>

              {isSuperAdmin && (
                <button
                  type="button"
                  onClick={() => setCreateOpen(true)}
                  className="rounded-xl bg-white px-4 py-2.5 text-[10px] font-black text-[#0d3157] transition hover:bg-blue-50"
                >
                  + YENİ İHALE
                </button>
              )}
            </div>
          </div>
        </div>

        {message && (
          <div
            className={`mx-4 mt-4 rounded-xl border px-4 py-3 text-xs font-bold sm:mx-6 ${
              /tamamlandı|alındı|oluşturuldu/i.test(message)
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-amber-200 bg-amber-50 text-amber-700"
            }`}
          >
            {message}
          </div>
        )}

        <div className="grid min-h-[650px] lg:grid-cols-[330px_minmax(0,1fr)]">
          <aside className="border-b border-slate-200 bg-slate-50/70 p-4 lg:border-b-0 lg:border-r">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">
                  İhaleler
                </div>
                <div className="mt-0.5 text-xs font-black text-slate-700">
                  {auctions.length} kayıt
                </div>
              </div>

              <button
                type="button"
                onClick={() => loadAuctions()}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[9px] font-black text-slate-500"
              >
                YENİLE
              </button>
            </div>

            <div className="custom-scrollbar max-h-[560px] space-y-2 overflow-y-auto pr-1">
              {loading ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-5 text-center text-xs font-bold text-slate-400">
                  İhaleler yükleniyor...
                </div>
              ) : auctions.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-7 text-center">
                  <GavelIcon className="mx-auto h-7 w-7 text-slate-300" />
                  <p className="mt-3 text-xs font-black text-slate-500">
                    Aktif ihale yok
                  </p>
                  <p className="mt-1 text-[10px] font-semibold text-slate-400">
                    {isSuperAdmin
                      ? "Yeni ihale oluşturarak başlayın."
                      : "Super Admin ihale açtığında burada görünecek."}
                  </p>
                </div>
              ) : (
                auctions.map((auction) => (
                  <button
                    key={auction.id}
                    type="button"
                    onClick={() => selectAuction(auction.id)}
                    className={`w-full rounded-2xl border p-4 text-left transition ${
                      selectedId === auction.id
                        ? "border-blue-300 bg-white shadow-md ring-2 ring-blue-100"
                        : "border-slate-200 bg-white hover:border-blue-200"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span
                        className={`rounded-full border px-2 py-1 text-[8px] font-black uppercase tracking-wide ${
                          STATUS_STYLE[auction.status]
                        }`}
                      >
                        {STATUS_LABEL[auction.status]}
                      </span>
                      <span className="text-[8px] font-bold text-slate-400">
                        #{auction.id}
                      </span>
                    </div>

                    <div className="mt-3 truncate text-sm font-black text-slate-900">
                      {auction.item_name}
                    </div>
                    <div className="mt-1 truncate text-[10px] font-semibold text-slate-500">
                      {auction.title}
                    </div>

                    <div className="mt-4 flex items-end justify-between gap-3">
                      <div>
                        <div className="text-[8px] font-black uppercase tracking-wide text-slate-400">
                          Güncel
                        </div>
                        <div className="mt-0.5 text-base font-black text-blue-700">
                          {tl(auction.current_price)}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-[8px] font-black uppercase tracking-wide text-slate-400">
                          Teklif
                        </div>
                        <div className="mt-0.5 text-xs font-black text-slate-700">
                          {auction.bid_count || 0}
                        </div>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </aside>

          <div className="min-w-0 p-4 sm:p-6">
            {!selectedAuction ? (
              <div className="flex min-h-[500px] flex-col items-center justify-center text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-100 text-slate-300">
                  <GavelIcon className="h-8 w-8" />
                </div>
                <h3 className="mt-4 text-lg font-black text-slate-700">
                  Bir ihale seçin
                </h3>
              </div>
            ) : detailLoading ? (
              <div className="flex min-h-[500px] items-center justify-center text-sm font-black text-slate-400">
                İhale yükleniyor...
              </div>
            ) : (
              <div className="space-y-5">
                <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_310px]">
                  <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white">
                    <div className="grid gap-5 p-5 sm:grid-cols-[160px_minmax(0,1fr)] sm:p-6">
                      <div className="flex h-[160px] items-center justify-center overflow-hidden rounded-2xl border border-slate-100 bg-slate-50">
                        {selectedAuction.item_image_url ? (
                          <img
                            src={selectedAuction.item_image_url}
                            alt={selectedAuction.item_name}
                            className="h-full w-full object-contain"
                          />
                        ) : (
                          <div className="text-center text-slate-300">
                            <GavelIcon className="mx-auto h-10 w-10" />
                            <div className="mt-2 text-[9px] font-black uppercase tracking-wider">
                              Ürün Görseli
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-wide ${
                              STATUS_STYLE[selectedAuction.status]
                            }`}
                          >
                            {STATUS_LABEL[selectedAuction.status]}
                          </span>
                          <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[9px] font-black text-slate-500">
                            {scopeLabel(selectedAuction.channel_scope)}
                          </span>
                        </div>

                        <h2 className="mt-4 text-2xl font-black tracking-tight text-slate-900">
                          {selectedAuction.item_name}
                        </h2>
                        <p className="mt-1 text-xs font-bold text-slate-500">
                          {selectedAuction.title}
                        </p>

                        {selectedAuction.item_description && (
                          <p className="mt-4 text-xs font-medium leading-5 text-slate-500">
                            {selectedAuction.item_description}
                          </p>
                        )}

                        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
                          <Metric
                            label="Başlangıç"
                            value={tl(selectedAuction.starting_price)}
                          />
                          <Metric
                            label="Min. Artış"
                            value={tl(selectedAuction.min_increment)}
                          />
                          <Metric
                            label="Teklif"
                            value={String(selectedAuction.bid_count || 0)}
                          />
                          <Metric
                            label="Süre"
                            value={durationLabel(selectedAuction.duration_minutes)}
                          />
                          <Metric
                            label="Bitiş"
                            value={
                              selectedAuction.ends_at
                                ? new Date(
                                    selectedAuction.ends_at
                                  ).toLocaleTimeString("tr-TR", {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })
                                : "-"
                            }
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div
                    className={`rounded-[24px] border p-5 ${
                      selectedAuction.status === "LIVE"
                        ? "border-blue-200 bg-[linear-gradient(145deg,#eff6ff,#ffffff)]"
                        : "border-slate-200 bg-slate-50"
                    }`}
                  >
                    <div className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">
                      Güncel Teklif
                    </div>
                    <div className="mt-2 text-4xl font-black tracking-tight text-slate-900">
                      {tl(currentPrice)}
                    </div>

                    <div className="mt-5 rounded-2xl border border-white bg-white/80 p-4 shadow-sm">
                      <div className="text-[8px] font-black uppercase tracking-[0.18em] text-slate-400">
                        Kalan Süre
                      </div>
                      <div
                        className={`mt-1 font-mono text-3xl font-black ${
                          selectedAuction.status === "LIVE"
                            ? "text-blue-700"
                            : "text-slate-500"
                        }`}
                      >
                        {selectedAuction.status === "PAUSED"
                          ? "DURDU"
                          : selectedAuction.status === "LIVE"
                          ? remainingText(selectedAuction.ends_at, now)
                          : "--:--"}
                      </div>
                    </div>

                    {selectedAuction.winner_bid_id && (
                      <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                        <div className="text-[8px] font-black uppercase tracking-wider text-emerald-600">
                          Kazanan
                        </div>
                        <div className="mt-1 text-sm font-black text-emerald-800">
                          {isSuperAdmin
                            ? selectedAuction.winner_branch || "Seçildi"
                            : "Kazanan teklif seçildi"}
                        </div>
                        <div className="mt-1 text-xl font-black text-emerald-700">
                          {tl(selectedAuction.winning_amount)}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-[24px] border border-blue-200 bg-white p-5 shadow-sm sm:p-6">
                  <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
                    <div>
                      <div className="text-[9px] font-black uppercase tracking-[0.2em] text-blue-600">
                        Teklif Ver
                      </div>
                      <h3 className="mt-1 text-xl font-black text-slate-900">
                        Minimum {tl(minimumBid)}
                      </h3>
                      <p className="mt-1 text-[10px] font-semibold text-slate-400">
                        Ad Soyad yalnızca Super Admin kayıtlarında görünür. Diğer katılımcılar anonim kod görür.
                      </p>
                    </div>

                    <div className="grid w-full gap-2 sm:grid-cols-[minmax(180px,1fr)_minmax(170px,1fr)_auto] xl:w-auto">
                      <input
                        type="text"
                        value={bidderName}
                        onChange={(e) => setBidderName(e.target.value)}
                        disabled={selectedAuction.status !== "LIVE" || busy}
                        placeholder="Ad Soyad"
                        maxLength={160}
                        className="h-12 min-w-[190px] rounded-xl border-2 border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-900 outline-none transition focus:border-blue-500 disabled:bg-slate-100 disabled:text-slate-400"
                      />

                      <div className="relative min-w-[180px]">
                        <input
                          type="number"
                          inputMode="numeric"
                          value={bidAmount}
                          onChange={(e) => setBidAmount(e.target.value)}
                          disabled={selectedAuction.status !== "LIVE" || busy}
                          className="h-12 w-full rounded-xl border-2 border-blue-200 bg-blue-50/40 px-4 pr-12 text-lg font-black text-slate-900 outline-none transition focus:border-blue-500 disabled:bg-slate-100 disabled:text-slate-400"
                        />
                        <span className="absolute inset-y-0 right-4 flex items-center text-xs font-black text-slate-400">
                          TL
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={placeBid}
                        disabled={
                          busy ||
                          selectedAuction.status !== "LIVE" ||
                          bidderName.trim().length < 3 ||
                          Number(bidAmount) < minimumBid
                        }
                        className="h-12 rounded-xl bg-blue-600 px-6 text-xs font-black text-white shadow-lg shadow-blue-100 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
                      >
                        {busy ? "İŞLENİYOR..." : "TEKLİFİ VER"}
                      </button>
                    </div>
                  </div>

                  {selectedAuction.status !== "LIVE" && (
                    <div className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-[10px] font-bold text-slate-500">
                      Bu ihale şu anda teklif almıyor.
                    </div>
                  )}
                </div>

                {isSuperAdmin && (
                  <div className="rounded-[24px] border border-violet-200 bg-violet-50/40 p-5 sm:p-6">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                      <div>
                        <div className="text-[9px] font-black uppercase tracking-[0.2em] text-violet-600">
                          Super Admin Kontrolü
                        </div>
                        <p className="mt-1 text-xs font-semibold text-slate-500">
                          Başlat, duraklat, uzat, bitir veya tamamlanan ihaleyi sil.
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {selectedAuction.status === "DRAFT" && (
                          <AdminButton
                            onClick={() => adminAction("START")}
                            disabled={busy}
                            primary
                          >
                            BAŞLAT
                          </AdminButton>
                        )}

                        {selectedAuction.status === "LIVE" && (
                          <AdminButton
                            onClick={() => adminAction("PAUSE")}
                            disabled={busy}
                          >
                            DURAKLAT
                          </AdminButton>
                        )}

                        {selectedAuction.status === "PAUSED" && (
                          <AdminButton
                            onClick={() => adminAction("RESUME")}
                            disabled={busy}
                            primary
                          >
                            DEVAM ET
                          </AdminButton>
                        )}

                        {["LIVE", "PAUSED"].includes(
                          selectedAuction.status
                        ) && (
                          <>
                            <AdminButton
                              onClick={() => adminAction("EXTEND", { minutes: 30 })}
                              disabled={busy}
                            >
                              +30 DK
                            </AdminButton>
                            <AdminButton
                              onClick={() => adminAction("EXTEND", { minutes: 60 })}
                              disabled={busy}
                            >
                              +1 SAAT
                            </AdminButton>
                            <AdminButton
                              onClick={() => adminAction("EXTEND", { minutes: 720 })}
                              disabled={busy}
                            >
                              +12 SAAT
                            </AdminButton>
                            <AdminButton
                              onClick={() => adminAction("END")}
                              disabled={busy}
                              danger
                            >
                              BİTİR
                            </AdminButton>
                          </>
                        )}

                        {!["ENDED", "CANCELLED"].includes(
                          selectedAuction.status
                        ) && (
                          <AdminButton
                            onClick={() => adminAction("CANCEL")}
                            disabled={busy}
                            danger
                          >
                            İPTAL
                          </AdminButton>
                        )}

                        {["ENDED", "CANCELLED"].includes(
                          selectedAuction.status
                        ) && (
                          <AdminButton
                            onClick={deleteAuction}
                            disabled={busy}
                            danger
                          >
                            İHALEYİ SİL
                          </AdminButton>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
                  <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white">
                    <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                      <div>
                        <div className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">
                          Teklif Akışı
                        </div>
                        <h3 className="mt-0.5 text-base font-black text-slate-900">
                          {bids.length} teklif
                        </h3>
                      </div>
                      <div className="text-[9px] font-bold text-slate-400">
                        2 sn canlı yenilenir
                      </div>
                    </div>

                    <div className="custom-scrollbar max-h-[430px] overflow-y-auto">
                      {bids.length === 0 ? (
                        <div className="p-10 text-center text-xs font-bold text-slate-400">
                          Henüz teklif verilmedi.
                        </div>
                      ) : (
                        bids.map((bid, index) => {
                          const isWinner =
                            Number(selectedAuction.winner_bid_id || 0) ===
                            Number(bid.id);

                          return (
                            <div
                              key={bid.id}
                              className={`flex items-center justify-between gap-4 border-b border-slate-100 px-5 py-4 last:border-0 ${
                                index === 0
                                  ? "bg-blue-50/50"
                                  : "bg-white"
                              }`}
                            >
                              <div className="flex min-w-0 items-center gap-3">
                                <div
                                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[10px] font-black ${
                                    index === 0
                                      ? "bg-blue-600 text-white"
                                      : "bg-slate-100 text-slate-500"
                                  }`}
                                >
                                  {index + 1}
                                </div>

                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-xs font-black text-slate-900">
                                      {bid.anonymous_code}
                                    </span>

                                    {bid.is_mine && (
                                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[8px] font-black text-blue-700">
                                        SEN
                                      </span>
                                    )}

                                    {isWinner && (
                                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[8px] font-black text-emerald-700">
                                        KAZANAN
                                      </span>
                                    )}
                                  </div>

                                  {isSuperAdmin && (
                                    <div className="mt-0.5 truncate text-[9px] font-semibold text-violet-600">
                                      {bid.bidder_branch || "-"}
                                      {bid.bidder_name &&
                                      bid.bidder_name !== bid.bidder_branch
                                        ? ` • ${bid.bidder_name}`
                                        : ""}
                                    </div>
                                  )}

                                  <div className="mt-0.5 text-[8px] font-semibold text-slate-400">
                                    {dateTime(bid.created_at)}
                                  </div>
                                </div>
                              </div>

                              <div className="flex shrink-0 items-center gap-3">
                                <div className="text-right">
                                  <div className="text-base font-black text-slate-900">
                                    {tl(bid.amount)}
                                  </div>
                                  {index === 0 && (
                                    <div className="text-[8px] font-black uppercase tracking-wide text-blue-600">
                                      En Yüksek
                                    </div>
                                  )}
                                </div>

                                {isSuperAdmin &&
                                  selectedAuction.status === "ENDED" &&
                                  !selectedAuction.winner_bid_id && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        adminAction("SELECT_WINNER", {
                                          bidId: bid.id,
                                        })
                                      }
                                      disabled={busy}
                                      className="rounded-lg bg-emerald-600 px-3 py-2 text-[8px] font-black text-white disabled:opacity-50"
                                    >
                                      KAZANAN SEÇ
                                    </button>
                                  )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                    <div className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">
                      İhale Kuralları
                    </div>

                    <div className="mt-4 space-y-3">
                      {[
                        `Minimum teklif artışı ${tl(
                          selectedAuction.min_increment
                        )}.`,
                        "Katılımcılar birbirinin mağaza veya personel adını göremez.",
                        "Gerçek Ad Soyad ve mağaza bilgilerini yalnızca Super Admin görebilir.",
                        "Duraklatılan ihalede süre de durdurulur.",
                        "İhale yönetimi ve silme işlemleri yalnızca Super Admin tarafından yapılır.",
                        "Kazanan teklif ihale bittikten sonra Super Admin tarafından onaylanır.",
                      ].map((rule, index) => (
                        <div
                          key={rule}
                          className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3"
                        >
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-[8px] font-black text-white">
                            {index + 1}
                          </span>
                          <p className="text-[10px] font-semibold leading-5 text-slate-600">
                            {rule}
                          </p>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3">
                      <div className="text-[8px] font-black uppercase tracking-wide text-slate-400">
                        Başlangıç
                      </div>
                      <div className="mt-1 text-[10px] font-bold text-slate-700">
                        {dateTime(selectedAuction.starts_at)}
                      </div>

                      <div className="mt-3 text-[8px] font-black uppercase tracking-wide text-slate-400">
                        Planlanan Bitiş
                      </div>
                      <div className="mt-1 text-[10px] font-bold text-slate-700">
                        {dateTime(selectedAuction.ends_at)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {createOpen && isSuperAdmin && (
        <div className="fixed inset-0 z-[120000] flex items-stretch justify-center bg-slate-950/70 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <form
            onSubmit={createAuction}
            className="custom-scrollbar h-[100dvh] w-full max-w-2xl overflow-y-auto bg-white p-5 shadow-2xl sm:h-auto sm:max-h-[92vh] sm:rounded-[28px] sm:p-7"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[9px] font-black uppercase tracking-[0.2em] text-blue-600">
                  SUPER ADMIN
                </div>
                <h2 className="mt-1 text-2xl font-black text-slate-900">
                  Yeni İhale Oluştur
                </h2>
                <p className="mt-1 text-xs font-semibold text-slate-400">
                  İlk olarak taslak oluşur. Hazır olduğunda BAŞLAT dersiniz.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-500"
              >
                ✕
              </button>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <CreateField
                label="İhale Başlığı"
                value={createForm.title}
                onChange={(value) =>
                  setCreateForm((prev) => ({ ...prev, title: value }))
                }
                placeholder="Örn: CMR & Vodafone Özel İhale"
                required
              />

              <CreateField
                label="Ürün / Cihaz"
                value={createForm.itemName}
                onChange={(value) =>
                  setCreateForm((prev) => ({ ...prev, itemName: value }))
                }
                placeholder="Örn: iPhone 15 Pro Max 256 GB"
                required
              />

              <CreateField
                label="Başlangıç Fiyatı"
                type="number"
                value={createForm.startingPrice}
                onChange={(value) =>
                  setCreateForm((prev) => ({
                    ...prev,
                    startingPrice: value,
                  }))
                }
                placeholder="0"
                required
              />

              <CreateField
                label="Minimum Artış"
                type="number"
                value={createForm.minIncrement}
                onChange={(value) =>
                  setCreateForm((prev) => ({
                    ...prev,
                    minIncrement: value,
                  }))
                }
                placeholder="50"
                required
              />

              <label className="block">
                <span className="mb-2 block text-[9px] font-black uppercase tracking-wider text-slate-500">
                  Kanal
                </span>
                <select
                  value={createForm.channelScope}
                  onChange={(e) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      channelScope: e.target.value,
                    }))
                  }
                  className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-800 outline-none focus:border-blue-500"
                >
                  <option value="BOTH">CMR + Vodafone</option>
                  <option value="CMR">Sadece CMR</option>
                  <option value="VODAFONE">Sadece Vodafone</option>
                </select>
              </label>

              <div className="block sm:col-span-2">
                <span className="mb-2 block text-[9px] font-black uppercase tracking-wider text-slate-500">
                  İhale Süresi
                </span>

                <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                  {[
                    ["720", "12 Saat"],
                    ["1440", "24 Saat"],
                    ["2160", "36 Saat"],
                    ["2880", "48 Saat"],
                    ["4320", "72 Saat"],
                    ["CUSTOM", "Özel"],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => {
                        setDurationPreset(value);
                        if (value !== "CUSTOM") {
                          setCreateForm((prev) => ({
                            ...prev,
                            durationMinutes: value,
                          }));
                        }
                      }}
                      className={`h-11 rounded-xl border text-[10px] font-black transition ${
                        durationPreset === value
                          ? "border-blue-600 bg-blue-600 text-white"
                          : "border-slate-200 bg-slate-50 text-slate-600 hover:border-blue-300"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {durationPreset === "CUSTOM" && (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <CreateField
                      label="Saat"
                      type="number"
                      value={customHours}
                      onChange={(value) => {
                        setCustomHours(value);
                        const hours = Math.max(0, Number(value || 0));
                        const minutes = Math.max(0, Number(customMinutes || 0));
                        setCreateForm((prev) => ({
                          ...prev,
                          durationMinutes: String(Math.floor(hours * 60 + minutes)),
                        }));
                      }}
                      placeholder="Örn: 6"
                    />

                    <CreateField
                      label="Ek Dakika"
                      type="number"
                      value={customMinutes}
                      onChange={(value) => {
                        setCustomMinutes(value);
                        const hours = Math.max(0, Number(customHours || 0));
                        const minutes = Math.max(0, Number(value || 0));
                        setCreateForm((prev) => ({
                          ...prev,
                          durationMinutes: String(Math.floor(hours * 60 + minutes)),
                        }));
                      }}
                      placeholder="Örn: 30"
                    />

                    <div className="sm:col-span-2 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-[10px] font-bold text-blue-700">
                      Toplam süre: {durationLabel(Number(createForm.durationMinutes))} • En fazla 72 saat
                    </div>
                  </div>
                )}
              </div>

              <div className="sm:col-span-2">
                <CreateField
                  label="Görsel URL (opsiyonel)"
                  value={createForm.itemImageUrl}
                  onChange={(value) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      itemImageUrl: value,
                    }))
                  }
                  placeholder="https://..."
                />
              </div>

              <label className="block sm:col-span-2">
                <span className="mb-2 block text-[9px] font-black uppercase tracking-wider text-slate-500">
                  Açıklama
                </span>
                <textarea
                  rows={4}
                  value={createForm.itemDescription}
                  onChange={(e) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      itemDescription: e.target.value,
                    }))
                  }
                  placeholder="Cihaz durumu, hafıza, renk veya ihale notları..."
                  className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 outline-none focus:border-blue-500"
                />
              </label>
            </div>

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                disabled={busy}
                className="h-12 rounded-xl border border-slate-200 px-5 text-xs font-black text-slate-500"
              >
                VAZGEÇ
              </button>
              <button
                type="submit"
                disabled={busy}
                className="h-12 rounded-xl bg-blue-600 px-7 text-xs font-black text-white shadow-lg shadow-blue-100 disabled:opacity-50"
              >
                {busy ? "OLUŞTURULUYOR..." : "TASLAĞI OLUŞTUR"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3">
      <div className="text-[7px] font-black uppercase tracking-wider text-slate-400">
        {label}
      </div>
      <div className="mt-1 truncate text-[10px] font-black text-slate-700">
        {value}
      </div>
    </div>
  );
}

function AdminButton({
  children,
  onClick,
  disabled,
  primary = false,
  danger = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`h-10 rounded-xl border px-4 text-[9px] font-black transition disabled:opacity-40 ${
        danger
          ? "border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white"
          : primary
          ? "border-blue-600 bg-blue-600 text-white hover:bg-blue-700"
          : "border-violet-200 bg-white text-violet-700 hover:bg-violet-600 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

function CreateField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-[9px] font-black uppercase tracking-wider text-slate-500">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-800 outline-none transition placeholder:text-slate-300 focus:border-blue-500"
      />
    </label>
  );
}

function GavelIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M14.5 4.5l5 5m-9-1l5 5m-8.5 2L4 18.5 5.5 20 8.5 17M9 10l5.5-5.5 5 5L14 15l-5-5zm-5 10h10"
      />
    </svg>
  );
}
