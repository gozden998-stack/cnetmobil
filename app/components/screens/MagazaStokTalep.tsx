"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

type BranchCode = "CNET" | "CMR" | "CADDE" | "KAPAKLI" | "SARAY";

type StockDevice = {
  id: number;
  imei: string;
  brand: string | null;
  model: string | null;
  memory: string | null;
  color: string | null;
  battery_percent: number | null;
  grade: string | null;
  warranty: string | null;
  changed_parts: string | null;
  box_invoice: string | null;
  current_branch_code: BranchCode;
  status:
    | "DETAILS_PENDING"
    | "AVAILABLE"
    | "REQUESTED"
    | "TRANSFER_WAITING"
    | "SOLD"
    | "PASSIVE"
    | "MISSING";
  source: "MANUAL" | "WINGSM" | "MIXED";
  created_at: string;
  updated_at: string;
};

type Capacity = {
  branch_code: BranchCode;
  branch_name: string;
  max_stock: number | null;
  current_stock: number;
  incoming_waiting: number;
  used_capacity: number;
  remaining_capacity: number | null;
  can_request: boolean;
};

type RequestRow = {
  request_id: number;
  request_status:
    | "PENDING"
    | "REJECTED"
    | "SENT"
    | "TRANSFER_WAITING"
    | "COMPLETED"
    | "CANCELLED";
  requester_branch_code: BranchCode;
  owner_branch_code: BranchCode;
  requested_by: string | null;
  requested_at: string;
  decision_by: string | null;
  decision_at: string | null;
  reject_reason: string | null;
  sent_by: string | null;
  sent_at: string | null;
  completed_at: string | null;

  device_id: number;
  imei: string;
  brand: string | null;
  model: string | null;
  memory: string | null;
  color: string | null;
  battery_percent: number | null;
  grade: string | null;
  warranty: string | null;
  changed_parts: string | null;
  box_invoice: string | null;
  current_branch_code: BranchCode;
  device_status: StockDevice["status"];
};

type StockApiResponse = {
  success: boolean;
  error?: string;
  branch?: {
    code: BranchCode;
    name: string;
  };
  canManage?: boolean;
  currentUser?: {
    id: number;
    username: string;
    stockBranchCode: BranchCode | null;
    isSuperAdmin: boolean;
  };
  capacity?: Capacity | null;
  devices?: StockDevice[];
  count?: number;
};

type RequestsApiResponse = {
  success: boolean;
  error?: string;
  currentUser?: {
    id: number;
    username: string;
    stockBranchCode: BranchCode | null;
    isSuperAdmin: boolean;
  };
  requests?: RequestRow[];
  count?: number;
};

type DeviceForm = {
  imei: string;
  brand: string;
  model: string;
  memory: string;
  color: string;
  batteryPercent: string;
  grade: string;
  warranty: string;
  changedParts: string;
  boxInvoice: string;
};

const BRANCHES: Array<{ code: BranchCode; label: string; description: string }> = [
  { code: "CNET", label: "CNET", description: "Merkez Depo" },
  { code: "CMR", label: "CMR", description: "CMR Stok" },
  { code: "CADDE", label: "CADDE", description: "Cadde Stok" },
  { code: "KAPAKLI", label: "KAPAKLI", description: "Kapaklı Stok" },
  { code: "SARAY", label: "SARAY", description: "Saray Stok" },
];

const EMPTY_FORM: DeviceForm = {
  imei: "",
  brand: "",
  model: "",
  memory: "",
  color: "",
  batteryPercent: "",
  grade: "",
  warranty: "",
  changedParts: "",
  boxInvoice: "",
};

function getStatusLabel(status: StockDevice["status"]) {
  switch (status) {
    case "DETAILS_PENDING":
      return "DETAY BEKLİYOR";
    case "AVAILABLE":
      return "STOKTA";
    case "REQUESTED":
      return "TALEPTE";
    case "TRANSFER_WAITING":
      return "TRANSFER BEKLİYOR";
    case "SOLD":
      return "SATILDI";
    case "PASSIVE":
      return "PASİF";
    case "MISSING":
      return "EKSİK";
    default:
      return status;
  }
}

function getStatusClass(status: StockDevice["status"]) {
  switch (status) {
    case "AVAILABLE":
      return "bg-emerald-50 text-emerald-700 ring-emerald-200";
    case "REQUESTED":
      return "bg-blue-50 text-blue-700 ring-blue-200";
    case "TRANSFER_WAITING":
      return "bg-violet-50 text-violet-700 ring-violet-200";
    case "DETAILS_PENDING":
      return "bg-amber-50 text-amber-700 ring-amber-200";
    case "SOLD":
      return "bg-slate-100 text-slate-600 ring-slate-200";
    default:
      return "bg-slate-50 text-slate-600 ring-slate-200";
  }
}

function safeDate(value: string | null | undefined) {
  if (!value) return "-";

  try {
    return new Intl.DateTimeFormat("tr-TR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function fieldValue(value: unknown) {
  const text = String(value ?? "").trim();
  return text || "-";
}

function normalizeSearchText(value: unknown) {
  return String(value ?? "").toLocaleLowerCase("tr-TR");
}

export default function MagazaStokTalep() {
  const [selectedBranch, setSelectedBranch] = useState<BranchCode>("CMR");

  const [devices, setDevices] = useState<StockDevice[]>([]);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [capacity, setCapacity] = useState<Capacity | null>(null);

  const [canManage, setCanManage] = useState(false);
  const [currentUser, setCurrentUser] = useState<{
    id: number;
    username: string;
    stockBranchCode: BranchCode | null;
    isSuperAdmin: boolean;
  } | null>(null);

  const [loading, setLoading] = useState(true);
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [form, setForm] = useState<DeviceForm>(EMPTY_FORM);
  const [savingDevice, setSavingDevice] = useState(false);

  const [actionDeviceId, setActionDeviceId] = useState<number | null>(null);
  const [rejectRequest, setRejectRequest] = useState<RequestRow | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const showMessage = (type: "success" | "error", text: string) => {
    setMessage({ type, text });
    window.setTimeout(() => {
      setMessage((current) =>
        current?.text === text ? null : current
      );
    }, 4500);
  };

  const loadDevices = useCallback(async (branch: BranchCode) => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `/api/stock/devices?branch=${encodeURIComponent(branch)}`,
        {
          method: "GET",
          credentials: "same-origin",
          cache: "no-store",
        }
      );

      const data = (await response.json().catch(() => null)) as
        | StockApiResponse
        | null;

      if (!response.ok || !data?.success) {
        throw new Error(data?.error || "Stok listesi alınamadı.");
      }

      setDevices(Array.isArray(data.devices) ? data.devices : []);
      setCapacity(data.capacity || null);
      setCanManage(Boolean(data.canManage));

      if (data.currentUser) {
        setCurrentUser(data.currentUser);
      }
    } catch (loadError) {
      setDevices([]);
      setCapacity(null);
      setCanManage(false);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Stok listesi alınamadı."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const loadRequests = useCallback(async () => {
    setRequestsLoading(true);

    try {
      const response = await fetch("/api/stock/requests", {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
      });

      const data = (await response.json().catch(() => null)) as
        | RequestsApiResponse
        | null;

      if (!response.ok || !data?.success) {
        throw new Error(data?.error || "Talepler alınamadı.");
      }

      setRequests(Array.isArray(data.requests) ? data.requests : []);

      if (data.currentUser) {
        setCurrentUser(data.currentUser);
      }
    } catch (loadError) {
      console.error("TALEPLER YÜKLENEMEDİ:", loadError);
      setRequests([]);
    } finally {
      setRequestsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDevices(selectedBranch);
  }, [loadDevices, selectedBranch]);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  const refreshAll = useCallback(async () => {
    await Promise.all([
      loadDevices(selectedBranch),
      loadRequests(),
    ]);
  }, [loadDevices, loadRequests, selectedBranch]);

  const myBranch = currentUser?.stockBranchCode || null;

  const incomingRequests = useMemo(() => {
    if (!myBranch && !currentUser?.isSuperAdmin) return [];

    return requests.filter((request) => {
      if (currentUser?.isSuperAdmin) {
        return request.owner_branch_code === selectedBranch;
      }

      return request.owner_branch_code === myBranch;
    });
  }, [currentUser?.isSuperAdmin, myBranch, requests, selectedBranch]);

  const outgoingRequests = useMemo(() => {
    if (!myBranch && !currentUser?.isSuperAdmin) return [];

    return requests.filter((request) => {
      if (currentUser?.isSuperAdmin) {
        return request.requester_branch_code === selectedBranch;
      }

      return request.requester_branch_code === myBranch;
    });
  }, [currentUser?.isSuperAdmin, myBranch, requests, selectedBranch]);

  const activeIncomingByDevice = useMemo(() => {
    const map = new Map<number, RequestRow>();

    for (const request of incomingRequests) {
      if (
        ["PENDING", "SENT", "TRANSFER_WAITING"].includes(
          request.request_status
        )
      ) {
        map.set(request.device_id, request);
      }
    }

    return map;
  }, [incomingRequests]);

  const activeOutgoingByDevice = useMemo(() => {
    const map = new Map<number, RequestRow>();

    for (const request of outgoingRequests) {
      if (
        ["PENDING", "SENT", "TRANSFER_WAITING"].includes(
          request.request_status
        )
      ) {
        map.set(request.device_id, request);
      }
    }

    return map;
  }, [outgoingRequests]);

  const filteredDevices = useMemo(() => {
    const query = normalizeSearchText(search);

    return devices.filter((device) => {
      if (
        statusFilter !== "ALL" &&
        device.status !== statusFilter
      ) {
        return false;
      }

      if (!query) return true;

      const haystack = [
        device.imei,
        device.brand,
        device.model,
        device.memory,
        device.color,
        device.grade,
        device.warranty,
        device.changed_parts,
        device.box_invoice,
      ]
        .map(normalizeSearchText)
        .join(" ");

      return haystack.includes(query);
    });
  }, [devices, search, statusFilter]);

  async function handleAddDevice(event: React.FormEvent) {
    event.preventDefault();

    if (savingDevice) return;

    setSavingDevice(true);

    try {
      const response = await fetch("/api/stock/devices", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify({
          branchCode: selectedBranch,
          imei: form.imei,
          brand: form.brand,
          model: form.model,
          memory: form.memory,
          color: form.color,
          batteryPercent: form.batteryPercent,
          grade: form.grade,
          warranty: form.warranty,
          changedParts: form.changedParts,
          boxInvoice: form.boxInvoice,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.success) {
        throw new Error(data?.error || "Cihaz eklenemedi.");
      }

      setForm(EMPTY_FORM);
      setAddModalOpen(false);
      showMessage("success", "Cihaz stoğa eklendi.");
      await refreshAll();
    } catch (saveError) {
      showMessage(
        "error",
        saveError instanceof Error
          ? saveError.message
          : "Cihaz eklenemedi."
      );
    } finally {
      setSavingDevice(false);
    }
  }

  async function handleRequest(device: StockDevice) {
    if (actionDeviceId) return;

    setActionDeviceId(device.id);

    try {
      const response = await fetch("/api/stock/requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify({
          deviceId: device.id,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.success) {
        throw new Error(data?.error || "Talep oluşturulamadı.");
      }

      showMessage(
        "success",
        `${fieldValue(device.brand)} ${fieldValue(device.model)} talep edildi.`
      );

      await refreshAll();
    } catch (requestError) {
      showMessage(
        "error",
        requestError instanceof Error
          ? requestError.message
          : "Talep oluşturulamadı."
      );
    } finally {
      setActionDeviceId(null);
    }
  }

  async function handleRequestAction(
    requestRow: RequestRow,
    action: "SEND" | "REJECT",
    reason = ""
  ) {
    if (actionDeviceId) return;

    setActionDeviceId(requestRow.device_id);

    try {
      const response = await fetch("/api/stock/requests", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify({
          requestId: requestRow.request_id,
          action,
          reason,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.success) {
        throw new Error(
          data?.error || "Talep işlemi tamamlanamadı."
        );
      }

      if (action === "REJECT") {
        setRejectRequest(null);
        setRejectReason("");
        showMessage("success", "Talep reddedildi.");
      } else {
        showMessage(
          "success",
          "Cihaz gönderildi. WingSM transferi bekleniyor."
        );
      }

      await refreshAll();
    } catch (actionError) {
      showMessage(
        "error",
        actionError instanceof Error
          ? actionError.message
          : "Talep işlemi tamamlanamadı."
      );
    } finally {
      setActionDeviceId(null);
    }
  }

  const selectedBranchMeta =
    BRANCHES.find((branch) => branch.code === selectedBranch) ||
    BRANCHES[0];

  const isOwnBranch =
    currentUser?.isSuperAdmin ||
    currentUser?.stockBranchCode === selectedBranch;

  return (
    <div className="min-h-screen bg-slate-50/70">
      {message && (
        <div
          className={`fixed right-5 top-5 z-[99999] max-w-sm rounded-2xl border px-5 py-4 text-sm font-bold shadow-2xl ${
            message.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-rose-200 bg-rose-50 text-rose-800"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="mx-auto max-w-[1900px] px-4 py-5 lg:px-6">
        {/* HERO */}
        <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
          <div className="grid gap-6 bg-[radial-gradient(circle_at_top_right,#dbeafe_0%,#ffffff_38%,#f8fafc_100%)] px-6 py-7 lg:grid-cols-[1fr_auto] lg:px-8">
            <div>
              <div className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-blue-600">
                <span className="h-2 w-2 rounded-full bg-blue-500 shadow-[0_0_0_5px_rgba(59,130,246,0.12)]" />
                CNETMOBİL V2
              </div>

              <h1 className="text-2xl font-black tracking-tight text-slate-900 lg:text-3xl">
                Cihaz Talep & Mağaza Stok Merkezi
              </h1>

              <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-slate-500">
                IMEI bazlı canlı stok, mağazalar arası talep, gönderim ve
                transfer sürecini tek ekrandan yönetin.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 self-center">
              <button
                type="button"
                onClick={() => void refreshAll()}
                className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-[10px] font-black uppercase tracking-wide text-slate-600 shadow-sm transition hover:bg-slate-50"
              >
                Yenile
              </button>

              {canManage && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setForm(EMPTY_FORM);
                      setAddModalOpen(true);
                    }}
                    className="h-11 rounded-2xl bg-blue-600 px-5 text-[10px] font-black uppercase tracking-wide text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-500"
                  >
                    + Tekli Cihaz Ekle
                  </button>

                  <button
                    type="button"
                    disabled
                    title="Mevcut toplu Excel ekranı bir sonraki adımda buraya bağlanacak."
                    className="h-11 cursor-not-allowed rounded-2xl bg-slate-900 px-5 text-[10px] font-black uppercase tracking-wide text-white opacity-45"
                  >
                    Toplu Cihaz Ekle
                  </button>
                </>
              )}
            </div>
          </div>

          {/* BRANCH TABS */}
          <div className="border-t border-slate-100 px-3 py-3 lg:px-5">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              {BRANCHES.map((branch) => {
                const active = selectedBranch === branch.code;

                return (
                  <button
                    key={branch.code}
                    type="button"
                    onClick={() => {
                      setSelectedBranch(branch.code);
                      setSearch("");
                      setStatusFilter("ALL");
                    }}
                    className={`rounded-2xl border px-4 py-3 text-left transition ${
                      active
                        ? "border-blue-200 bg-blue-50 shadow-sm"
                        : "border-slate-200 bg-white hover:border-blue-200 hover:bg-slate-50"
                    }`}
                  >
                    <div
                      className={`text-[12px] font-black ${
                        active ? "text-blue-700" : "text-slate-800"
                      }`}
                    >
                      {branch.label}
                    </div>

                    <div
                      className={`mt-1 text-[9px] font-bold uppercase tracking-wide ${
                        active ? "text-blue-500" : "text-slate-400"
                      }`}
                    >
                      {branch.description}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* STATS */}
        <section className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard
            title="Aktif Stok"
            value={capacity?.current_stock ?? devices.length}
            subtitle={selectedBranchMeta.label}
          />

          <StatCard
            title="Stok Limiti"
            value={
              capacity?.max_stock === null ||
              typeof capacity?.max_stock === "undefined"
                ? "SINIRSIZ"
                : capacity.max_stock
            }
            subtitle="Mağaza kapasitesi"
          />

          <StatCard
            title="Boş Kapasite"
            value={
              capacity?.remaining_capacity === null ||
              typeof capacity?.remaining_capacity === "undefined"
                ? "SINIRSIZ"
                : capacity.remaining_capacity
            }
            subtitle={
              capacity?.can_request === false
                ? "Talep kapalı"
                : "Talebe açık"
            }
          />

          <StatCard
            title="Bana Gelen"
            value={
              incomingRequests.filter(
                (request) => request.request_status === "PENDING"
              ).length
            }
            subtitle="Bekleyen talepler"
          />

          <StatCard
            title="Benim Taleplerim"
            value={
              outgoingRequests.filter((request) =>
                ["PENDING", "SENT", "TRANSFER_WAITING"].includes(
                  request.request_status
                )
              ).length
            }
            subtitle="Aktif talepler"
          />
        </section>

        {/* FILTER */}
        <section className="mt-4 rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 lg:grid-cols-[1fr_220px_auto]">
            <div className="relative">
              <svg
                className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-5-5m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>

              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="IMEI, marka, model, hafıza, renk, grade ara..."
                className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm font-semibold text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-50"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-xs font-black text-slate-600 outline-none focus:border-blue-300"
            >
              <option value="ALL">Tüm Durumlar</option>
              <option value="AVAILABLE">Stokta</option>
              <option value="DETAILS_PENDING">Detay Bekliyor</option>
              <option value="REQUESTED">Talepte</option>
              <option value="TRANSFER_WAITING">Transfer Bekliyor</option>
            </select>

            <div className="flex min-w-[160px] items-center justify-center rounded-2xl bg-slate-900 px-4 text-[10px] font-black uppercase tracking-wide text-white">
              {filteredDevices.length} Cihaz
            </div>
          </div>
        </section>

        {/* TABLE */}
        <section className="mt-4 overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
            <div>
              <div className="text-sm font-black text-slate-900">
                {selectedBranchMeta.label} Stok Listesi
              </div>

              <div className="mt-1 text-[10px] font-bold text-slate-400">
                {isOwnBranch
                  ? "Bu mağazanın stok yönetim yetkisi sizde."
                  : "Bu mağazayı görüntüleyebilir ve uygun cihazlara talep oluşturabilirsiniz."}
              </div>
            </div>

            {loading || requestsLoading ? (
              <div className="rounded-full bg-blue-50 px-3 py-1.5 text-[9px] font-black uppercase tracking-wide text-blue-600">
                Güncelleniyor...
              </div>
            ) : null}
          </div>

          {error ? (
            <div className="p-8 text-center">
              <div className="text-sm font-black text-rose-600">
                {error}
              </div>
              <button
                type="button"
                onClick={() => void refreshAll()}
                className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-[10px] font-black uppercase text-white"
              >
                Tekrar Dene
              </button>
            </div>
          ) : loading ? (
            <div className="p-12 text-center text-sm font-bold text-slate-400">
              Stoklar yükleniyor...
            </div>
          ) : filteredDevices.length === 0 ? (
            <div className="p-14 text-center">
              <div className="text-base font-black text-slate-700">
                Bu filtrede cihaz bulunamadı.
              </div>
              <div className="mt-2 text-xs font-semibold text-slate-400">
                {devices.length === 0
                  ? `${selectedBranchMeta.label} stoğunda henüz cihaz yok.`
                  : "Arama veya durum filtresini değiştirin."}
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[1620px] w-full border-collapse">
                <thead>
                  <tr className="bg-slate-50/90">
                    {[
                      "Marka / Model",
                      "Hafıza",
                      "Renk",
                      "Pil",
                      "Grade",
                      "Garanti",
                      "Değişen Parça",
                      "Kutu / Fatura",
                      "IMEI",
                      "Durum",
                      "İşlem",
                    ].map((title) => (
                      <th
                        key={title}
                        className="border-b border-slate-200 px-4 py-3 text-center text-[9px] font-black uppercase tracking-[0.08em] text-slate-500"
                      >
                        {title}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {filteredDevices.map((device) => {
                    const incoming =
                      activeIncomingByDevice.get(device.id) || null;
                    const outgoing =
                      activeOutgoingByDevice.get(device.id) || null;

                    const actionBusy = actionDeviceId === device.id;

                    return (
                      <tr
                        key={device.id}
                        className="border-b border-slate-100 transition last:border-0 hover:bg-slate-50/70"
                      >
                        <td className="px-4 py-4 text-center">
                          <div className="font-black text-slate-800">
                            {fieldValue(device.brand)}
                          </div>
                          <div className="mt-1 text-[11px] font-bold text-slate-500">
                            {fieldValue(device.model)}
                          </div>
                        </td>

                        <td className="px-4 py-4 text-center text-xs font-black text-slate-700">
                          {fieldValue(device.memory)}
                        </td>

                        <td className="px-4 py-4 text-center text-xs font-bold text-slate-600">
                          {fieldValue(device.color)}
                        </td>

                        <td className="px-4 py-4 text-center text-xs font-black text-slate-700">
                          {device.battery_percent === null
                            ? "-"
                            : `%${device.battery_percent}`}
                        </td>

                        <td className="px-4 py-4 text-center">
                          <span className="rounded-full bg-slate-100 px-3 py-1.5 text-[9px] font-black uppercase text-slate-600">
                            {fieldValue(device.grade)}
                          </span>
                        </td>

                        <td className="px-4 py-4 text-center text-[11px] font-bold text-slate-600">
                          {fieldValue(device.warranty)}
                        </td>

                        <td className="max-w-[180px] px-4 py-4 text-center text-[11px] font-bold text-slate-600">
                          <div className="truncate">
                            {fieldValue(device.changed_parts)}
                          </div>
                        </td>

                        <td className="px-4 py-4 text-center text-[11px] font-bold text-slate-600">
                          {fieldValue(device.box_invoice)}
                        </td>

                        <td className="px-4 py-4 text-center">
                          <div className="font-mono text-[11px] font-black tracking-wide text-slate-700">
                            {device.imei}
                          </div>
                          <div className="mt-1 text-[8px] font-bold uppercase text-slate-400">
                            {device.source}
                          </div>
                        </td>

                        <td className="px-4 py-4 text-center">
                          <span
                            className={`inline-flex rounded-full px-3 py-1.5 text-[8px] font-black uppercase tracking-wide ring-1 ring-inset ${getStatusClass(
                              device.status
                            )}`}
                          >
                            {getStatusLabel(device.status)}
                          </span>
                        </td>

                        <td className="min-w-[230px] px-4 py-4 text-center">
                          {canManage && incoming?.request_status === "PENDING" ? (
                            <div>
                              <div className="mb-2 text-[9px] font-black uppercase text-blue-600">
                                {incoming.requester_branch_code} TALEP ETTİ
                              </div>

                              <div className="flex justify-center gap-2">
                                <button
                                  type="button"
                                  disabled={actionBusy}
                                  onClick={() =>
                                    void handleRequestAction(
                                      incoming,
                                      "SEND"
                                    )
                                  }
                                  className="rounded-xl bg-emerald-600 px-3 py-2 text-[8px] font-black uppercase tracking-wide text-white transition hover:bg-emerald-500 disabled:opacity-40"
                                >
                                  {actionBusy
                                    ? "İşleniyor"
                                    : "Gönderildi"}
                                </button>

                                <button
                                  type="button"
                                  disabled={actionBusy}
                                  onClick={() => {
                                    setRejectRequest(incoming);
                                    setRejectReason("");
                                  }}
                                  className="rounded-xl bg-rose-600 px-3 py-2 text-[8px] font-black uppercase tracking-wide text-white transition hover:bg-rose-500 disabled:opacity-40"
                                >
                                  Red
                                </button>
                              </div>
                            </div>
                          ) : outgoing ? (
                            <div>
                              <div className="text-[9px] font-black uppercase text-blue-600">
                                {outgoing.owner_branch_code} →{" "}
                                {outgoing.requester_branch_code}
                              </div>
                              <div className="mt-1 text-[8px] font-bold uppercase text-slate-400">
                                {outgoing.request_status === "PENDING"
                                  ? "Talebiniz bekliyor"
                                  : outgoing.request_status ===
                                    "TRANSFER_WAITING"
                                  ? "WingSM transferi bekleniyor"
                                  : outgoing.request_status}
                              </div>
                            </div>
                          ) : !canManage &&
                            device.status === "AVAILABLE" ? (
                            <button
                              type="button"
                              disabled={actionBusy}
                              onClick={() => void handleRequest(device)}
                              className="rounded-xl bg-blue-600 px-5 py-2.5 text-[9px] font-black uppercase tracking-wide text-white shadow-lg shadow-blue-600/15 transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              {actionBusy ? "Talep Ediliyor" : "Talep Ol"}
                            </button>
                          ) : device.status === "DETAILS_PENDING" ? (
                            <span className="text-[9px] font-black uppercase text-amber-600">
                              Bilgiler Tamamlanmalı
                            </span>
                          ) : device.status === "TRANSFER_WAITING" ? (
                            <span className="text-[9px] font-black uppercase text-violet-600">
                              WingSM TR Bekleniyor
                            </span>
                          ) : device.status === "REQUESTED" ? (
                            <span className="text-[9px] font-black uppercase text-blue-600">
                              Talepte
                            </span>
                          ) : canManage ? (
                            <span className="text-[9px] font-black uppercase text-slate-400">
                              Kendi Stoğunuz
                            </span>
                          ) : (
                            <span className="text-[9px] font-black uppercase text-slate-400">
                              İşlem Yok
                            </span>
                          )}

                          {incoming?.requested_at && (
                            <div className="mt-2 text-[8px] font-semibold text-slate-400">
                              {safeDate(incoming.requested_at)}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {/* TEKLİ CIHAZ EKLE */}
      {addModalOpen && (
        <div className="fixed inset-0 z-[99990] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-[28px] bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white/95 px-6 py-5 backdrop-blur">
              <div>
                <div className="text-lg font-black text-slate-900">
                  Tekli Cihaz Ekle
                </div>
                <div className="mt-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                  {selectedBranch} STOĞUNA EKLENECEK
                </div>
              </div>

              <button
                type="button"
                onClick={() => setAddModalOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-lg font-black text-slate-500 hover:bg-slate-200"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleAddDevice} className="p-6">
              <div className="grid gap-4 md:grid-cols-2">
                <InputField
                  label="IMEI *"
                  value={form.imei}
                  onChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      imei: value.replace(/\D/g, "").slice(0, 16),
                    }))
                  }
                  placeholder="35XXXXXXXXXXXXX"
                />

                <InputField
                  label="Marka *"
                  value={form.brand}
                  onChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      brand: value,
                    }))
                  }
                  placeholder="Apple"
                />

                <InputField
                  label="Model *"
                  value={form.model}
                  onChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      model: value,
                    }))
                  }
                  placeholder="iPhone 15 Pro"
                />

                <InputField
                  label="Hafıza *"
                  value={form.memory}
                  onChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      memory: value,
                    }))
                  }
                  placeholder="256 GB"
                />

                <InputField
                  label="Renk"
                  value={form.color}
                  onChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      color: value,
                    }))
                  }
                  placeholder="Natural Titanium"
                />

                <InputField
                  label="Pil %"
                  value={form.batteryPercent}
                  onChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      batteryPercent: value
                        .replace(/\D/g, "")
                        .slice(0, 3),
                    }))
                  }
                  placeholder="94"
                />

                <SelectField
                  label="Grade"
                  value={form.grade}
                  onChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      grade: value,
                    }))
                  }
                  options={[
                    "",
                    "MÜKEMMEL",
                    "ÇOK İYİ",
                    "İYİ",
                    "OUTLET",
                  ]}
                />

                <InputField
                  label="Garanti"
                  value={form.warranty}
                  onChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      warranty: value,
                    }))
                  }
                  placeholder="6 Ay"
                />

                <InputField
                  label="Değişen Parça"
                  value={form.changedParts}
                  onChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      changedParts: value,
                    }))
                  }
                  placeholder="YOK / Ekran / Batarya..."
                />

                <SelectField
                  label="Kutu / Fatura"
                  value={form.boxInvoice}
                  onChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      boxInvoice: value,
                    }))
                  }
                  options={["", "VAR", "YOK"]}
                />
              </div>

              <div className="mt-6 rounded-2xl bg-blue-50 px-4 py-3 text-[10px] font-bold leading-5 text-blue-700">
                Bu kayıt doğrudan PostgreSQL&apos;e yazılır. IMEI daha önce
                kayıtlıysa sistem ikinci kez eklenmesine izin vermez.
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  className="h-11 rounded-2xl border border-slate-200 bg-white px-5 text-[10px] font-black uppercase text-slate-600"
                >
                  Vazgeç
                </button>

                <button
                  type="submit"
                  disabled={savingDevice}
                  className="h-11 rounded-2xl bg-blue-600 px-6 text-[10px] font-black uppercase text-white shadow-lg shadow-blue-600/20 disabled:opacity-50"
                >
                  {savingDevice ? "Kaydediliyor..." : "Cihazı Stoğa Ekle"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RED MODAL */}
      {rejectRequest && (
        <div className="fixed inset-0 z-[99995] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-[26px] bg-white p-6 shadow-2xl">
            <div className="text-lg font-black text-slate-900">
              Talebi Reddet
            </div>

            <div className="mt-2 text-sm font-semibold text-slate-500">
              {rejectRequest.requester_branch_code} tarafından talep edilen{" "}
              <span className="font-black text-slate-800">
                {fieldValue(rejectRequest.brand)}{" "}
                {fieldValue(rejectRequest.model)}
              </span>
            </div>

            <textarea
              value={rejectReason}
              onChange={(event) =>
                setRejectReason(event.target.value.slice(0, 500))
              }
              placeholder="Red nedenini yazın..."
              className="mt-5 min-h-[120px] w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-700 outline-none focus:border-rose-300 focus:bg-white focus:ring-4 focus:ring-rose-50"
            />

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setRejectRequest(null);
                  setRejectReason("");
                }}
                className="h-11 rounded-2xl border border-slate-200 px-5 text-[10px] font-black uppercase text-slate-600"
              >
                Vazgeç
              </button>

              <button
                type="button"
                disabled={
                  !rejectReason.trim() ||
                  actionDeviceId === rejectRequest.device_id
                }
                onClick={() =>
                  void handleRequestAction(
                    rejectRequest,
                    "REJECT",
                    rejectReason.trim()
                  )
                }
                className="h-11 rounded-2xl bg-rose-600 px-6 text-[10px] font-black uppercase text-white disabled:opacity-40"
              >
                Red Et
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  title,
  value,
  subtitle,
}: {
  title: string;
  value: string | number;
  subtitle: string;
}) {
  return (
    <div className="rounded-[22px] border border-slate-200 bg-white px-5 py-4 shadow-sm">
      <div className="text-[9px] font-black uppercase tracking-[0.1em] text-slate-400">
        {title}
      </div>
      <div className="mt-2 text-2xl font-black tracking-tight text-slate-900">
        {value}
      </div>
      <div className="mt-1 text-[10px] font-bold text-slate-400">
        {subtitle}
      </div>
    </div>
  );
}

function InputField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-[9px] font-black uppercase tracking-[0.08em] text-slate-500">
        {label}
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-700 outline-none transition placeholder:text-slate-300 focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-50"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-[9px] font-black uppercase tracking-[0.08em] text-slate-500">
        {label}
      </span>

      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-700 outline-none transition focus:border-blue-300 focus:bg-white"
      >
        {options.map((option) => (
          <option key={option || "__EMPTY__"} value={option}>
            {option || "Seçiniz"}
          </option>
        ))}
      </select>
    </label>
  );
}
