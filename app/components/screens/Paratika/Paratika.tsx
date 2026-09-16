// app/components/screens/Paratika/Paratika.tsx
'use client';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

type PaymentStatus =
  | 'LINK_CREATED'
  | 'SENT'
  | 'PENDING'
  | 'APPROVED'
  | 'FAILED'
  | 'CANCELLED'
  | 'EXPIRED';

type Payment = {
  id: number;
  merchantPaymentId: string;
  paymentUrl: string | null;

  branchCode: string;
  createdByUserId: number | null;
  createdByEmail: string | null;

  customerName: string;
  customerEmail: string;
  customerPhone: string;

  amount: number;
  currency: string;
  installmentCount: number;

  status: PaymentStatus;
  paratikaStatus: string | null;
  responseCode: string | null;
  responseMsg: string | null;

  pgTranId: string | null;
  pgTranRefId: string | null;
  pgOrderId: string | null;
  approvalCode: string | null;
  issuer: string | null;
  numberOfInstallments: number | null;

  linkCreatedAt: string | null;
  sentAt: string | null;
  approvedAt: string | null;
  cancelledAt: string | null;
  expiredAt: string | null;

  paratikaCreatedAt: string | null;
  paratikaDueDate: string | null;
  paratikaPaymentDate: string | null;

  lastSyncedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type PaymentsResponse = {
  success: boolean;

  permissions?: {
    canViewAllBranches: boolean;
    ownBranch: string;
    role: string;
  };

  summary?: {
    total: number;
    linkCreated: number;
    sent: number;
    pending: number;
    approved: number;
    failed: number;
    cancelled: number;
    expired: number;
    approvedAmount: number;
    waitingAmount: number;
  };

  payments?: Payment[];

  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };

  error?: string;
};

type CreateResult = {
  success: boolean;
  databaseSaved?: boolean;
  message?: string;
  error?: string;

  id?: number;
  merchantPaymentId?: string;
  paymentUrl?: string;

  amount?: number;
  installmentCount?: number;
  branch?: string;
  status?: string;
};

const INSTALLMENTS = Array.from(
  { length: 17 },
  (_, index) => index + 2
);

const STATUS_TEXT: Record<PaymentStatus, string> = {
  LINK_CREATED: 'LİNK OLUŞTU',
  SENT: 'GÖNDERİLDİ',
  PENDING: 'ÖDEME BEKLENİYOR',
  APPROVED: 'ONAYLANDI',
  FAILED: 'BAŞARISIZ',
  CANCELLED: 'İPTAL',
  EXPIRED: 'SÜRESİ DOLDU',
};

const STATUS_CLASS: Record<PaymentStatus, string> = {
  LINK_CREATED:
    'border-blue-200 bg-blue-50 text-blue-700',
  SENT:
    'border-violet-200 bg-violet-50 text-violet-700',
  PENDING:
    'border-amber-200 bg-amber-50 text-amber-700',
  APPROVED:
    'border-emerald-200 bg-emerald-50 text-emerald-700',
  FAILED:
    'border-rose-200 bg-rose-50 text-rose-700',
  CANCELLED:
    'border-slate-200 bg-slate-100 text-slate-700',
  EXPIRED:
    'border-zinc-200 bg-zinc-100 text-zinc-700',
};

function money(value: number) {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function dateTime(value?: string | null) {
  if (!value) return '-';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  return new Intl.DateTimeFormat('tr-TR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

function displayPhone(value?: string | null) {
  const digits = String(value || '').replace(/\D/g, '');

  if (
    digits.length === 12 &&
    digits.startsWith('90')
  ) {
    return `0${digits.slice(2, 5)} ${digits.slice(
      5,
      8
    )} ${digits.slice(8, 10)} ${digits.slice(
      10,
      12
    )}`;
  }

  return value || '-';
}

function StatCard({
  title,
  value,
  detail,
}: {
  title: string;
  value: React.ReactNode;
  detail?: string;
}) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
        {title}
      </div>

      <div className="mt-2 text-2xl font-black tracking-tight text-slate-950">
        {value}
      </div>

      {detail ? (
        <div className="mt-1 text-[11px] font-bold text-slate-400">
          {detail}
        </div>
      ) : null}
    </div>
  );
}

function FieldLabel({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <label className="mb-1.5 block text-[11px] font-black uppercase tracking-wide text-slate-500">
      {children}
    </label>
  );
}

export default function Paratika() {
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState('');

  const [permissions, setPermissions] =
    useState<PaymentsResponse['permissions']>();

  const [summary, setSummary] =
    useState<PaymentsResponse['summary']>();

  const [payments, setPayments] = useState<
    Payment[]
  >([]);

  const [branchFilter, setBranchFilter] =
    useState('ALL');

  const [statusFilter, setStatusFilter] =
    useState('ALL');

  const [search, setSearch] = useState('');

  const [form, setForm] = useState({
    amount: '',
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    installmentCount: '2',
  });

  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] =
    useState('');
  const [created, setCreated] =
    useState<CreateResult | null>(null);

  const [syncingAll, setSyncingAll] =
    useState(false);

  const [syncingId, setSyncingId] = useState<
    number | null
  >(null);

  const branchOptions = useMemo(() => {
    const branches = new Set<string>();

    for (const payment of payments) {
      if (payment.branchCode) {
        branches.add(payment.branchCode);
      }
    }

    if (permissions?.ownBranch) {
      branches.add(permissions.ownBranch);
    }

    return [...branches].sort((a, b) =>
      a.localeCompare(b, 'tr')
    );
  }, [payments, permissions?.ownBranch]);

  const loadPayments = useCallback(
    async (silent = false) => {
      if (!silent) {
        setLoading(true);
      }

      try {
        setListError('');

        const params = new URLSearchParams();

        params.set('limit', '100');

        if (branchFilter !== 'ALL') {
          params.set('branch', branchFilter);
        }

        if (statusFilter !== 'ALL') {
          params.set('status', statusFilter);
        }

        if (search.trim()) {
          params.set('q', search.trim());
        }

        const response = await fetch(
          `/api/paratika/payments?${params.toString()}`,
          {
            method: 'GET',
            cache: 'no-store',
            credentials: 'include',
          }
        );

        const data =
          (await response.json()) as PaymentsResponse;

        if (!response.ok || !data.success) {
          throw new Error(
            data.error ||
              'Paratika işlemleri alınamadı.'
          );
        }

        setPermissions(data.permissions);
        setSummary(data.summary);
        setPayments(data.payments || []);
      } catch (error) {
        setListError(
          error instanceof Error
            ? error.message
            : 'Paratika işlemleri alınamadı.'
        );
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [branchFilter, statusFilter, search]
  );

  useEffect(() => {
    void loadPayments();
  }, [loadPayments]);

  // Listeyi hafif biçimde güncel tutuyoruz.
  // Gerçek Paratika sorgusu burada yapılmaz;
  // sadece PostgreSQL listesi yenilenir.
  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void loadPayments(true);
    }, 15000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [loadPayments]);

  async function createPayment(
    event: React.FormEvent
  ) {
    event.preventDefault();

    if (creating) {
      return;
    }

    setCreating(true);
    setCreateError('');
    setCreated(null);

    try {
      const response = await fetch(
        '/api/paratika/payment-link',
        {
          method: 'POST',
          credentials: 'include',
          cache: 'no-store',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            amount: form.amount,
            customerName: form.customerName,
            customerEmail: form.customerEmail,
            customerPhone: form.customerPhone,
            installmentCount: Number(
              form.installmentCount
            ),
          }),
        }
      );

      const data =
        (await response.json()) as CreateResult;

      if (!response.ok || !data.success) {
        throw new Error(
          data.error ||
            data.message ||
            'Ödeme linki oluşturulamadı.'
        );
      }

      setCreated(data);

      setForm((current) => ({
        amount: '',
        customerName: '',
        customerEmail: '',
        customerPhone: '',
        installmentCount:
          current.installmentCount,
      }));

      await loadPayments(true);
    } catch (error) {
      setCreateError(
        error instanceof Error
          ? error.message
          : 'Ödeme linki oluşturulamadı.'
      );
    } finally {
      setCreating(false);
    }
  }

  async function syncOne(paymentId: number) {
    if (syncingId || syncingAll) {
      return;
    }

    setSyncingId(paymentId);

    try {
      const response = await fetch(
        '/api/paratika/status-sync',
        {
          method: 'POST',
          credentials: 'include',
          cache: 'no-store',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            paymentId,
          }),
        }
      );

      const data = await response.json();

      if (
        !response.ok ||
        data?.success === false
      ) {
        throw new Error(
          data?.error ||
            'Ödeme durumu güncellenemedi.'
        );
      }

      await loadPayments(true);
    } catch (error) {
      window.alert(
        error instanceof Error
          ? error.message
          : 'Ödeme durumu güncellenemedi.'
      );
    } finally {
      setSyncingId(null);
    }
  }

  async function syncAll() {
    if (syncingAll || syncingId) {
      return;
    }

    setSyncingAll(true);

    try {
      const response = await fetch(
        '/api/paratika/status-sync',
        {
          method: 'POST',
          credentials: 'include',
          cache: 'no-store',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            syncAll: true,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            'Paratika durumları güncellenemedi.'
        );
      }

      await loadPayments(true);
    } catch (error) {
      window.alert(
        error instanceof Error
          ? error.message
          : 'Paratika durumları güncellenemedi.'
      );
    } finally {
      setSyncingAll(false);
    }
  }

  async function copyPaymentLink(
    paymentUrl: string
  ) {
    try {
      await navigator.clipboard.writeText(
        paymentUrl
      );

      window.alert(
        'Ödeme linki kopyalandı.'
      );
    } catch {
      window.alert(
        'Link kopyalanamadı.'
      );
    }
  }

  const waitingCount =
    (summary?.linkCreated || 0) +
    (summary?.sent || 0) +
    (summary?.pending || 0);

  return (
    <div className="w-full min-w-0 animate-in fade-in duration-300">
      {/* HEADER */}
      <div className="mb-5 rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-600">
              CNETMOBİL • PARATİKA
            </div>

            <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
              Taksitli Ödeme Yönetimi
            </h2>

            <p className="mt-1 max-w-3xl text-xs font-semibold leading-5 text-slate-500 sm:text-sm">
              Müşteri bilgilerini girerek ödeme
              linki oluşturabilir, mağaza
              işlemlerini takip edebilir ve
              Paratika ödeme sonucunu
              doğrulayabilirsiniz.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {permissions?.ownBranch ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-black text-slate-700">
                {permissions.canViewAllBranches
                  ? 'YÖNETİCİ • TÜM MAĞAZALAR'
                  : permissions.ownBranch}
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => void syncAll()}
              disabled={syncingAll}
              className="rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-black text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {syncingAll
                ? 'KONTROL EDİLİYOR...'
                : 'PARATİKA DURUMLARINI YENİLE'}
            </button>
          </div>
        </div>
      </div>

      {/* SUMMARY */}
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard
          title="Toplam İşlem"
          value={summary?.total || 0}
        />

        <StatCard
          title="Bekleyen"
          value={waitingCount}
          detail={money(
            summary?.waitingAmount || 0
          )}
        />

        <StatCard
          title="Onaylandı"
          value={summary?.approved || 0}
        />

        <StatCard
          title="Onaylanan Tutar"
          value={money(
            summary?.approvedAmount || 0
          )}
        />

        <StatCard
          title="Başarısız"
          value={summary?.failed || 0}
        />

        <StatCard
          title="İptal / Süresi Doldu"
          value={
            (summary?.cancelled || 0) +
            (summary?.expired || 0)
          }
        />
      </div>

      <div className="grid min-w-0 gap-5 xl:grid-cols-[390px_minmax(0,1fr)]">
        {/* FORM */}
        <section className="h-fit rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 border-b border-slate-100 pb-4">
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-600">
              YENİ PARATİKA İŞLEMİ
            </div>

            <h3 className="mt-1 text-xl font-black text-slate-950">
              Ödeme Linki Oluştur
            </h3>
          </div>

          <form
            onSubmit={createPayment}
            className="space-y-4"
          >
            <div>
              <FieldLabel>Tutar</FieldLabel>

              <div className="relative">
                <input
                  value={form.amount}
                  onChange={(event) =>
                    setForm((old) => ({
                      ...old,
                      amount: event.target.value,
                    }))
                  }
                  inputMode="decimal"
                  placeholder="45.000"
                  required
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 pr-12 text-base font-black text-slate-950 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50"
                />

                <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm font-black text-slate-400">
                  TL
                </div>
              </div>
            </div>

            <div>
              <FieldLabel>
                Müşteri Ad Soyad
              </FieldLabel>

              <input
                value={form.customerName}
                onChange={(event) =>
                  setForm((old) => ({
                    ...old,
                    customerName:
                      event.target.value,
                  }))
                }
                placeholder="Ad Soyad"
                required
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm font-bold text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50"
              />
            </div>

            <div>
              <FieldLabel>
                Mail Adresi
              </FieldLabel>

              <input
                type="email"
                value={form.customerEmail}
                onChange={(event) =>
                  setForm((old) => ({
                    ...old,
                    customerEmail:
                      event.target.value,
                  }))
                }
                placeholder="musteri@email.com"
                required
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm font-bold text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50"
              />
            </div>

            <div>
              <FieldLabel>
                Telefon No
              </FieldLabel>

              <input
                value={form.customerPhone}
                onChange={(event) =>
                  setForm((old) => ({
                    ...old,
                    customerPhone:
                      event.target.value,
                  }))
                }
                inputMode="tel"
                placeholder="05xx xxx xx xx"
                required
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm font-bold text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50"
              />
            </div>

            <div>
              <FieldLabel>
                Taksit Sayısı
              </FieldLabel>

              <select
                value={form.installmentCount}
                onChange={(event) =>
                  setForm((old) => ({
                    ...old,
                    installmentCount:
                      event.target.value,
                  }))
                }
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm font-black text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50"
              >
                {INSTALLMENTS.map((count) => (
                  <option
                    key={count}
                    value={count}
                  >
                    {count} TAKSİT
                  </option>
                ))}
              </select>
            </div>

            {createError ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold leading-5 text-rose-700">
                {createError}
              </div>
            ) : null}

            {created?.success &&
            created.paymentUrl ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <div className="flex items-center gap-2 text-sm font-black text-emerald-800">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-xs text-white">
                    ✓
                  </span>
                  ÖDEME LİNKİ OLUŞTU
                </div>

                <div className="mt-2 break-all rounded-xl bg-white/80 p-2.5 text-[10px] font-bold leading-4 text-emerald-700">
                  {created.paymentUrl}
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      void copyPaymentLink(
                        created.paymentUrl!
                      )
                    }
                    className="rounded-xl border border-emerald-300 bg-white px-3 py-2.5 text-xs font-black text-emerald-700"
                  >
                    LİNKİ KOPYALA
                  </button>

                  <a
                    href={created.paymentUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-xl bg-emerald-600 px-3 py-2.5 text-center text-xs font-black text-white"
                  >
                    LİNKİ AÇ
                  </a>
                </div>
              </div>
            ) : null}

            <button
              type="submit"
              disabled={creating}
              className="w-full rounded-2xl bg-blue-600 px-4 py-4 text-sm font-black tracking-wide text-white shadow-lg shadow-blue-100 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {creating
                ? 'OLUŞTURULUYOR...'
                : 'ÖDEME LİNKİ OLUŞTUR'}
            </button>

            <div className="text-center text-[10px] font-bold leading-4 text-slate-400">
              Bu aşamada link oluşturulur ve
              işlem mağaza bilgisiyle
              PostgreSQL&apos;e kaydedilir.
            </div>
          </form>
        </section>

        {/* LIST */}
        <section className="min-w-0 overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-5">
            <div className="flex flex-col gap-4 2xl:flex-row 2xl:items-end 2xl:justify-between">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-600">
                  İŞLEM TAKİBİ
                </div>

                <h3 className="mt-1 text-xl font-black text-slate-950">
                  Paratika İşlemleri
                </h3>
              </div>

              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {permissions?.canViewAllBranches ? (
                  <select
                    value={branchFilter}
                    onChange={(event) =>
                      setBranchFilter(
                        event.target.value
                      )
                    }
                    className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-black text-slate-700 outline-none focus:border-blue-400"
                  >
                    <option value="ALL">
                      TÜM MAĞAZALAR
                    </option>

                    {branchOptions.map(
                      (branch) => (
                        <option
                          key={branch}
                          value={branch}
                        >
                          {branch}
                        </option>
                      )
                    )}
                  </select>
                ) : null}

                <select
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(
                      event.target.value
                    )
                  }
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-black text-slate-700 outline-none focus:border-blue-400"
                >
                  <option value="ALL">
                    TÜM DURUMLAR
                  </option>
                  <option value="LINK_CREATED">
                    LİNK OLUŞTU
                  </option>
                  <option value="SENT">
                    GÖNDERİLDİ
                  </option>
                  <option value="PENDING">
                    ÖDEME BEKLENİYOR
                  </option>
                  <option value="APPROVED">
                    ONAYLANDI
                  </option>
                  <option value="FAILED">
                    BAŞARISIZ
                  </option>
                  <option value="CANCELLED">
                    İPTAL
                  </option>
                  <option value="EXPIRED">
                    SÜRESİ DOLDU
                  </option>
                </select>

                <input
                  value={search}
                  onChange={(event) =>
                    setSearch(event.target.value)
                  }
                  placeholder="Müşteri / telefon / işlem no"
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-bold text-slate-700 outline-none focus:border-blue-400"
                />
              </div>
            </div>

            {listError ? (
              <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-700">
                {listError}
              </div>
            ) : null}
          </div>

          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full min-w-[1180px] border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80 text-[10px] font-black uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-3">
                    Durum
                  </th>
                  <th className="px-4 py-3">
                    Müşteri
                  </th>
                  <th className="px-4 py-3">
                    Mağaza
                  </th>
                  <th className="px-4 py-3">
                    Tutar
                  </th>
                  <th className="px-4 py-3">
                    Taksit
                  </th>
                  <th className="px-4 py-3">
                    Tarih
                  </th>
                  <th className="px-4 py-3">
                    Paratika
                  </th>
                  <th className="px-4 py-3">
                    İşlem
                  </th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-14 text-center text-xs font-black text-slate-400"
                    >
                      İŞLEMLER YÜKLENİYOR...
                    </td>
                  </tr>
                ) : payments.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-14 text-center text-xs font-black text-slate-400"
                    >
                      KAYIT BULUNAMADI
                    </td>
                  </tr>
                ) : (
                  payments.map((payment) => (
                    <tr
                      key={payment.id}
                      className="border-b border-slate-100 align-top transition hover:bg-slate-50/70"
                    >
                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-[10px] font-black ${
                            STATUS_CLASS[
                              payment.status
                            ]
                          }`}
                        >
                          {
                            STATUS_TEXT[
                              payment.status
                            ]
                          }
                        </span>
                      </td>

                      <td className="px-4 py-4">
                        <div className="text-sm font-black text-slate-900">
                          {payment.customerName}
                        </div>

                        <div className="mt-1 text-[11px] font-bold text-slate-500">
                          {displayPhone(
                            payment.customerPhone
                          )}
                        </div>

                        <div className="mt-0.5 max-w-[220px] truncate text-[10px] font-semibold text-slate-400">
                          {
                            payment.customerEmail
                          }
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        <div className="text-xs font-black text-slate-800">
                          {payment.branchCode}
                        </div>

                        <div className="mt-1 text-[10px] font-bold text-slate-400">
                          #{payment.id}
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        <div className="whitespace-nowrap text-sm font-black text-slate-950">
                          {money(payment.amount)}
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        <div className="whitespace-nowrap text-xs font-black text-slate-800">
                          {payment.numberOfInstallments ||
                            payment.installmentCount}{' '}
                          TAKSİT
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        <div className="text-[10px] font-black uppercase text-slate-400">
                          Oluşturma
                        </div>

                        <div className="mt-0.5 whitespace-nowrap text-[11px] font-bold text-slate-600">
                          {dateTime(
                            payment.paratikaCreatedAt ||
                              payment.linkCreatedAt ||
                              payment.createdAt
                          )}
                        </div>

                        {payment.status ===
                        'APPROVED' ? (
                          <>
                            <div className="mt-2 text-[10px] font-black uppercase text-emerald-600">
                              Ödeme
                            </div>

                            <div className="mt-0.5 whitespace-nowrap text-[11px] font-bold text-slate-600">
                              {dateTime(
                                payment.paratikaPaymentDate ||
                                  payment.approvedAt
                              )}
                            </div>
                          </>
                        ) : payment.paratikaDueDate ? (
                          <>
                            <div className="mt-2 text-[10px] font-black uppercase text-slate-400">
                              Son Tarih
                            </div>

                            <div className="mt-0.5 whitespace-nowrap text-[11px] font-bold text-slate-600">
                              {dateTime(
                                payment.paratikaDueDate
                              )}
                            </div>
                          </>
                        ) : null}
                      </td>

                      <td className="px-4 py-4">
                        {payment.status ===
                        'APPROVED' ? (
                          <div className="space-y-1 text-[10px]">
                            <div>
                              <span className="font-black uppercase text-slate-400">
                                İşlem No:
                              </span>{' '}
                              <span className="font-black text-slate-800">
                                {payment.pgTranId ||
                                  '-'}
                              </span>
                            </div>

                            <div>
                              <span className="font-black uppercase text-slate-400">
                                Onay:
                              </span>{' '}
                              <span className="font-black text-slate-800">
                                {payment.approvalCode ||
                                  '-'}
                              </span>
                            </div>

                            <div>
                              <span className="font-black uppercase text-slate-400">
                                Banka:
                              </span>{' '}
                              <span className="font-black text-slate-800">
                                {payment.issuer ||
                                  '-'}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="max-w-[220px] text-[11px] font-semibold leading-5 text-slate-500">
                            {payment.responseMsg ||
                              'Ödeme bekleniyor'}
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-4">
                        <div className="flex min-w-[145px] flex-col gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              void syncOne(
                                payment.id
                              )
                            }
                            disabled={
                              syncingId ===
                              payment.id
                            }
                            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[10px] font-black text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                          >
                            {syncingId ===
                            payment.id
                              ? 'KONTROL...'
                              : 'DURUMU KONTROL ET'}
                          </button>

                          {payment.paymentUrl &&
                          ![
                            'APPROVED',
                            'CANCELLED',
                            'EXPIRED',
                          ].includes(
                            payment.status
                          ) ? (
                            <button
                              type="button"
                              onClick={() =>
                                void copyPaymentLink(
                                  payment.paymentUrl!
                                )
                              }
                              className="rounded-xl bg-blue-50 px-3 py-2 text-[10px] font-black text-blue-700 transition hover:bg-blue-100"
                            >
                              LİNKİ KOPYALA
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
