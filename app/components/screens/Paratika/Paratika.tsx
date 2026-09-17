// app/components/screens/Paratika/Paratika.tsx
'use client';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
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

  wingsmPersonnelCode: string | null;
  wingsmPersonnelName: string | null;

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

type WingsmPersonnel = {
  code: string;
  name: string;
};

type WingsmPersonnelResponse = {
  success: boolean;
  count?: number;
  personnel?: WingsmPersonnel[];
  message?: string;
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
  personnelCode?: string;
  personnelName?: string;
};

const INSTALLMENTS = Array.from(
  { length: 12 },
  (_, index) => index + 1
);

// Oranlar personel arayüzünde GÖSTERİLMEZ.
// Sadece hesaplama amacıyla kullanılır.
type InstallmentCalculatorItem = {
  month: number;
  rate: number;
  label?: string;
};

const INSTALLMENT_CALCULATOR: InstallmentCalculatorItem[] = [
  { month: 1, rate: 4, label: 'Tek Çekim' },
  { month: 2, rate: 7.83 },
  { month: 3, rate: 10.05 },
  { month: 4, rate: 12.36 },
  { month: 5, rate: 14.76 },
  { month: 6, rate: 17.55, label: 'Avantajlı' },
  { month: 7, rate: 20.19 },
  { month: 8, rate: 22.96 },
  { month: 9, rate: 25.85 },
  { month: 10, rate: 28.88 },
  { month: 11, rate: 32.07 },
  { month: 12, rate: 35.41, label: 'En Popüler' },
];

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

function dealerReturnAmount(
  amount: number,
  installmentCount: number
) {
  const installment =
    INSTALLMENT_CALCULATOR.find(
      (item) =>
        item.month === installmentCount
    );

  if (!installment) {
    return Number(amount || 0);
  }

  const multiplier =
    1 + installment.rate / 100;

  if (
    !Number.isFinite(multiplier) ||
    multiplier <= 0
  ) {
    return Number(amount || 0);
  }

  return (
    Number(amount || 0) /
    multiplier
  );
}

function escapeExcelHtml(
  value: unknown
) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
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


function merchantPaymentDate(
  value?: string | null
) {
  if (!value) return '-';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  const parts =
    new Intl.DateTimeFormat(
      'tr-TR',
      {
        timeZone:
          'Europe/Istanbul',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }
    ).formatToParts(date);

  const day =
    parts.find(
      (part) =>
        part.type === 'day'
    )?.value || '';

  const month =
    parts.find(
      (part) =>
        part.type === 'month'
    )?.value || '';

  const year =
    parts.find(
      (part) =>
        part.type === 'year'
    )?.value || '';

  const cleanMonth =
    month
      .replace('.', '')
      .replace(
        /^./,
        (char) =>
          char.toLocaleUpperCase(
            'tr-TR'
          )
      );

  return `${day}-${cleanMonth}-${year}`;
}


function istanbulDateKey(value = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(value);
}

function shiftDateKey(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T12:00:00+03:00`);
  date.setUTCDate(date.getUTCDate() + days);
  return istanbulDateKey(date);
}

function dateKeyLabel(dateKey: string, todayKey: string) {
  const yesterdayKey = shiftDateKey(todayKey, -1);

  if (dateKey === todayKey) {
    return 'BUGÜN';
  }

  if (dateKey === yesterdayKey) {
    return 'DÜN';
  }

  const selected = new Date(`${dateKey}T12:00:00+03:00`);
  const today = new Date(`${todayKey}T12:00:00+03:00`);

  const diff = Math.round(
    (today.getTime() - selected.getTime()) / 86_400_000
  );

  if (diff > 1 && diff <= 30) {
    return `${diff} GÜN ÖNCE`;
  }

  if (diff < 0 && diff >= -90) {
    return `${Math.abs(diff)} GÜN SONRA`;
  }

  return new Intl.DateTimeFormat('tr-TR', {
    dateStyle: 'medium',
    timeZone: 'Europe/Istanbul',
  }).format(selected);
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

  const initialTodayKey = istanbulDateKey();
  const [todayKey, setTodayKey] =
    useState(initialTodayKey);
  const [selectedDate, setSelectedDate] =
    useState(initialTodayKey);
  const previousTodayRef =
    useRef(initialTodayKey);

  const [form, setForm] = useState({
    amount: '',
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    installmentCount: '2',
    personnelCode: '',
  });

  const [calculatorOpen, setCalculatorOpen] =
    useState(false);
  const [calculatorAmount, setCalculatorAmount] =
    useState('');
  const paymentFormRef =
    useRef<HTMLElement | null>(null);

  const [personnel, setPersonnel] = useState<
    WingsmPersonnel[]
  >([]);
  const [personnelLoading, setPersonnelLoading] =
    useState(true);
  const [personnelError, setPersonnelError] =
    useState('');

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

  const [deletingId, setDeletingId] =
    useState<number | null>(null);
  const [exportingExcel, setExportingExcel] =
    useState(false);

  const [
    copiedField,
    setCopiedField,
  ] = useState('');

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

  const loadPersonnel = useCallback(
    async () => {
      setPersonnelLoading(true);

      try {
        setPersonnelError('');

        const response = await fetch(
          '/api/wingsm/personnel',
          {
            method: 'GET',
            cache: 'no-store',
            credentials: 'include',
          }
        );

        const data =
          (await response.json()) as WingsmPersonnelResponse;

        if (!response.ok || !data.success) {
          throw new Error(
            data.error ||
              data.message ||
              'WingSM personel listesi alınamadı.'
          );
        }

        const list = Array.isArray(data.personnel)
          ? data.personnel
              .filter(
                (item) =>
                  item &&
                  String(item.code || '').trim() &&
                  String(item.name || '').trim()
              )
              .map((item) => ({
                code: String(item.code).trim(),
                name: String(item.name).trim(),
              }))
          : [];

        setPersonnel(list);
      } catch (error) {
        setPersonnel([]);
        setPersonnelError(
          error instanceof Error
            ? error.message
            : 'WingSM personel listesi alınamadı.'
        );
      } finally {
        setPersonnelLoading(false);
      }
    },
    []
  );

  const loadPayments = useCallback(
    async (silent = false) => {
      if (!silent) {
        setLoading(true);
      }

      try {
        setListError('');

        const params = new URLSearchParams();

        params.set('limit', '100');
        params.set('date', selectedDate);

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
    [branchFilter, statusFilter, search, selectedDate]
  );

  useEffect(() => {
    void loadPersonnel();
  }, [loadPersonnel]);

  useEffect(() => {
    void loadPayments();
  }, [loadPayments]);

  // Gün değişince kullanıcı BUGÜN ekranındaysa otomatik yeni güne geç.
  // Böylece dünün kayıtları dünde kalır; yeni gün temiz başlar.
  useEffect(() => {
    const intervalId = window.setInterval(() => {
      const nextTodayKey = istanbulDateKey();
      const previousToday = previousTodayRef.current;

      if (nextTodayKey === previousToday) {
        return;
      }

      setSelectedDate((current) =>
        current === previousToday
          ? nextTodayKey
          : current
      );

      previousTodayRef.current = nextTodayKey;
      setTodayKey(nextTodayKey);
    }, 60_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  // PARATIKA_AUTO_SYNC_UOT
  // Açık işlemler ve ONAYLANDI olup ÜÖT henüz gelmemiş kayıtlar
  // Paratika'dan periyodik doğrulanır.
  useEffect(() => {
    if (selectedDate !== todayKey) {
      return;
    }

    let running = false;

    const run = async () => {
      if (running) {
        return;
      }

      running = true;

      try {
        await fetch(
          '/api/paratika/status-sync',
          {
            method: 'POST',
            credentials: 'include',
            cache: 'no-store',
            headers: {
              'Content-Type':
                'application/json',
            },
            body: JSON.stringify({
              syncAll: true,
            }),
          }
        );

        await loadPayments(true);
      } catch {
        // Sessiz otomatik sync:
        // ekranı hata popup'larıyla rahatsız etmiyoruz.
      } finally {
        running = false;
      }
    };

    void run();

    const intervalId =
      window.setInterval(
        () => {
          void run();
        },
        30_000
      );

    return () => {
      window.clearInterval(
        intervalId
      );
    };
  }, [
    loadPayments,
    selectedDate,
    todayKey,
  ]);

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

  function applyCalculatedInstallment(
    month: number,
    total: number
  ) {
    setForm((current) => ({
      ...current,
      amount: total.toFixed(2),
      installmentCount: String(month),
    }));

    setCreateError('');
    setCreated(null);
    setCalculatorOpen(false);
    setCalculatorAmount('');

    window.requestAnimationFrame(() => {
      paymentFormRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });
  }

  async function createPayment(
    event: React.FormEvent
  ) {
    event.preventDefault();

    if (creating) {
      return;
    }

    if (!form.personnelCode) {
      setCreateError(
        'İşlemi yapan personeli seçin.'
      );
      setCreated(null);
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
            personnelCode:
              form.personnelCode,
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
        personnelCode: '',
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

  async function deletePayment(
    payment: Payment
  ) {
    if (
      permissions?.role !== 'admin' ||
      deletingId !== null
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        `#${payment.id} numaralı işlem panelden silinsin mi?\n\nBu işlem sadece CNETMOBİL panel/PostgreSQL kaydını siler. Paratika tarafındaki gerçek ödeme veya işlem iptal edilmez.`
      );

    if (!confirmed) {
      return;
    }

    setDeletingId(payment.id);

    try {
      const response = await fetch(
        `/api/paratika/payments?id=${payment.id}`,
        {
          method: 'DELETE',
          credentials: 'include',
          cache: 'no-store',
        }
      );

      const data = await response.json();

      if (!response.ok || !data?.success) {
        throw new Error(
          data?.error ||
            'İşlem silinemedi.'
        );
      }

      await loadPayments(true);
    } catch (error) {
      window.alert(
        error instanceof Error
          ? error.message
          : 'İşlem silinemedi.'
      );
    } finally {
      setDeletingId(null);
    }
  }

  async function exportApprovedExcel() {
    if (exportingExcel) {
      return;
    }

    setExportingExcel(true);

    try {
      const params =
        new URLSearchParams();

      params.set('limit', '1000');
      params.set('date', selectedDate);
      params.set('status', 'APPROVED');

      if (
        permissions?.canViewAllBranches &&
        branchFilter !== 'ALL'
      ) {
        params.set(
          'branch',
          branchFilter
        );
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
            'Onaylanan işlemler alınamadı.'
        );
      }

      const approvedPayments =
        (data.payments || []).filter(
          (payment) =>
            payment.status === 'APPROVED'
        );

      if (!approvedPayments.length) {
        window.alert(
          'Seçili gün için onaylanmış işlem bulunamadı.'
        );
        return;
      }

      const rows =
        approvedPayments
          .map((payment) => {
            const installments =
              payment.numberOfInstallments ||
              payment.installmentCount ||
              1;

            const returnAmount =
              dealerReturnAmount(
                payment.amount,
                installments
              );

            const paymentDate =
              merchantPaymentDate(
                payment.paratikaPaymentDate ||
                  payment.approvedAt
              );

            const osn =
              payment.pgOrderId ||
              payment.merchantPaymentId ||
              '-';

            return `
              <tr>
                <td style="mso-number-format:'\\@';">
                  ${escapeExcelHtml(paymentDate)}
                </td>
                <td style="mso-number-format:'\\@';">
                  ${escapeExcelHtml(osn)}
                </td>
                <td style="mso-number-format:'#,##0.00';">
                  ${returnAmount.toFixed(2)}
                </td>
              </tr>
            `;
          })
          .join('');

      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8" />
            <style>
              table {
                border-collapse: collapse;
                font-family: Arial, sans-serif;
              }
              th, td {
                border: 1px solid #d1d5db;
                padding: 8px 10px;
              }
              th {
                background: #f3f4f6;
                font-weight: 700;
              }
            </style>
          </head>
          <body>
            <table>
              <thead>
                <tr>
                  <th>Ödeme Tarihi</th>
                  <th>ÖSN</th>
                  <th>Bayiye Geri Dönüş Tutarı</th>
                </tr>
              </thead>
              <tbody>
                ${rows}
              </tbody>
            </table>
          </body>
        </html>
      `;

      const blob =
        new Blob(
          ['\ufeff', html],
          {
            type:
              'application/vnd.ms-excel;charset=utf-8;',
          }
        );

      const url =
        URL.createObjectURL(blob);

      const anchor =
        document.createElement('a');

      anchor.href = url;
      anchor.download =
        `paratika_onaylanan_${selectedDate}.xls`;

      document.body.appendChild(
        anchor
      );
      anchor.click();
      anchor.remove();

      window.setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 1000);
    } catch (error) {
      window.alert(
        error instanceof Error
          ? error.message
          : 'Excel dosyası hazırlanamadı.'
      );
    } finally {
      setExportingExcel(false);
    }
  }

  async function copyInfo(
    key: string,
    value: string
  ) {
    if (
      !value ||
      value === '-'
    ) {
      return;
    }

    try {
      await navigator.clipboard.writeText(
        value
      );

      setCopiedField(key);

      window.setTimeout(() => {
        setCopiedField(
          (current) =>
            current === key
              ? ''
              : current
        );
      }, 1400);
    } catch {
      window.alert(
        'Bilgi kopyalanamadı.'
      );
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
              onClick={() => {
                setCalculatorAmount('');
                setCalculatorOpen(true);
              }}
              className="rounded-xl bg-amber-500 px-4 py-2.5 text-xs font-black text-white shadow-sm transition hover:bg-amber-600"
            >
              TAKSİT HESAPLA
            </button>

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

      {/* TAKSİT HESAPLAMA MODALI */}
      {calculatorOpen ? (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-sm sm:p-5">
          <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-6">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-600">
                  PARATİKA
                </div>

                <h3 className="mt-1 text-xl font-black text-slate-950 sm:text-2xl">
                  Taksit Hesapla
                </h3>

                <p className="mt-1 text-xs font-semibold text-slate-500">
                  İşlem tutarını girin, uygun taksiti seçip Paratika formuna aktarın.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setCalculatorOpen(false);
                  setCalculatorAmount('');
                }}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-xl font-black text-slate-500 transition hover:bg-rose-50 hover:text-rose-600"
                aria-label="Taksit hesaplama penceresini kapat"
              >
                ×
              </button>
            </div>

            <div className="border-b border-slate-100 bg-slate-50/70 p-4 sm:p-6">
              <FieldLabel>İşlem Tutarı</FieldLabel>

              <div className="relative">
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  autoFocus
                  value={calculatorAmount}
                  onChange={(event) =>
                    setCalculatorAmount(
                      event.target.value
                    )
                  }
                  placeholder="Örn. 45.000"
                  className="w-full rounded-2xl border-2 border-amber-200 bg-white px-4 py-4 pr-14 text-xl font-black text-slate-950 outline-none transition focus:border-amber-500 focus:ring-4 focus:ring-amber-100"
                />

                <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm font-black text-slate-400">
                  TL
                </div>
              </div>

              <div className="mt-2 text-[10px] font-bold text-slate-400">
                Komisyon oranları personel ekranında gösterilmez.
              </div>
            </div>

            <div className="custom-scrollbar flex-1 overflow-y-auto p-4 sm:p-6">
              {calculatorAmount &&
              Number(calculatorAmount) > 0 ? (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {INSTALLMENT_CALCULATOR.map(
                    (item) => {
                      const baseAmount =
                        Number(calculatorAmount);

                      const total =
                        baseAmount *
                        (1 + item.rate / 100);

                      const monthly =
                        total / item.month;

                      return (
                        <div
                          key={item.month}
                          className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-3">
                              <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-slate-900 text-white">
                                <span className="text-lg font-black leading-none">
                                  {item.month}
                                </span>
                                <span className="mt-0.5 text-[7px] font-black uppercase tracking-wide text-slate-300">
                                  {item.month === 1
                                    ? 'Çekim'
                                    : 'Taksit'}
                                </span>
                              </div>

                              <div className="min-w-0">
                                <div className="text-lg font-black text-slate-950">
                                  {monthly.toLocaleString(
                                    'tr-TR',
                                    {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    }
                                  )}{' '}
                                  TL
                                </div>

                                <div className="mt-0.5 text-[10px] font-bold text-slate-400">
                                  Aylık ödeme
                                </div>

                                {item.label ? (
                                  <div className="mt-1 inline-flex rounded-lg bg-amber-50 px-2 py-1 text-[9px] font-black uppercase tracking-wide text-amber-700">
                                    {item.label}
                                  </div>
                                ) : null}
                              </div>
                            </div>

                            <div className="text-right">
                              <div className="text-[9px] font-black uppercase tracking-wide text-slate-400">
                                Toplam
                              </div>

                              <div className="mt-1 text-sm font-black text-slate-700">
                                {total.toLocaleString(
                                  'tr-TR',
                                  {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  }
                                )}{' '}
                                TL
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              applyCalculatedInstallment(
                                item.month,
                                total
                              )
                            }
                            className="mt-4 w-full rounded-xl bg-blue-600 px-4 py-3 text-xs font-black text-white transition hover:bg-blue-700"
                          >
                            {item.month === 1
                              ? 'TEK ÇEKİM YAP'
                              : `${item.month} TAKSİT YAP`}
                          </button>
                        </div>
                      );
                    }
                  )}
                </div>
              ) : (
                <div className="flex min-h-[220px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-center">
                  <div className="text-3xl">₺</div>
                  <div className="mt-3 text-sm font-black text-slate-700">
                    Hesaplama için tutar girin
                  </div>
                  <div className="mt-1 text-xs font-semibold text-slate-400">
                    Sonuçlar burada görünecek.
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

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
        <section
          ref={paymentFormRef}
          className="h-fit scroll-mt-5 rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div className="mb-5 border-b border-slate-100 pb-4">
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-600">
              YENİ PARATİKA İŞLEMİ
            </div>

            <h3 className="mt-1 text-xl font-black text-slate-950">
              Link Oluştur ve SMS Gönder
            </h3>
          </div>

          <form
            onSubmit={createPayment}
            className="space-y-4"
          >
            <div>
              <FieldLabel>
                İşlemi Yapan Personel
              </FieldLabel>

              <select
                value={form.personnelCode}
                onChange={(event) => {
                  setForm((old) => ({
                    ...old,
                    personnelCode:
                      event.target.value,
                  }));
                  setCreateError('');
                }}
                required
                disabled={
                  personnelLoading ||
                  personnel.length === 0
                }
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm font-black text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <option value="">
                  {personnelLoading
                    ? 'PERSONELLER YÜKLENİYOR...'
                    : personnel.length > 0
                    ? 'PERSONEL SEÇİN'
                    : 'PERSONEL BULUNAMADI'}
                </option>

                {personnel.map((item) => (
                  <option
                    key={item.code}
                    value={item.code}
                  >
                    {item.name} • {item.code}
                  </option>
                ))}
              </select>

              {personnelError ? (
                <div className="mt-2 flex items-center justify-between gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2">
                  <span className="text-[10px] font-bold leading-4 text-rose-700">
                    {personnelError}
                  </span>

                  <button
                    type="button"
                    onClick={() =>
                      void loadPersonnel()
                    }
                    className="shrink-0 rounded-lg bg-white px-2.5 py-1.5 text-[9px] font-black text-rose-700 shadow-sm"
                  >
                    TEKRAR DENE
                  </button>
                </div>
              ) : (
                <div className="mt-1.5 text-[10px] font-bold text-slate-400">
                  WingSM personel listesi • mağaza filtresi yok
                </div>
              )}
            </div>

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
                  ÖDEME LİNKİ OLUŞTU • SMS TALEBİ GÖNDERİLDİ
                </div>

                {created.personnelName ? (
                  <div className="mt-2 rounded-xl border border-emerald-200 bg-white/80 px-3 py-2 text-[10px] font-black text-emerald-800">
                    YAPAN PERSONEL: {created.personnelName}
                    {created.personnelCode
                      ? ` • ${created.personnelCode}`
                      : ''}
                  </div>
                ) : null}

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
              disabled={
                creating ||
                personnelLoading ||
                !form.personnelCode
              }
              className="w-full rounded-2xl bg-blue-600 px-4 py-4 text-sm font-black tracking-wide text-white shadow-lg shadow-blue-100 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {creating
                ? 'OLUŞTURULUYOR...'
                : personnelLoading
                ? 'PERSONELLER YÜKLENİYOR...'
                : !form.personnelCode
                ? 'ÖNCE PERSONEL SEÇİN'
                : 'LİNK OLUŞTUR VE SMS GÖNDER'}
            </button>

            <div className="text-center text-[10px] font-bold leading-4 text-slate-400">
              Link Paratika&apos;da oluşturulur,
              SMS bildirim talebi müşterinin telefonuna
              iletilmek üzere Paratika&apos;ya gönderilir
              ve işlem mağaza bilgisiyle PostgreSQL&apos;e kaydedilir.
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

                <div className="mt-1 text-[11px] font-black text-slate-400">
                  {dateKeyLabel(selectedDate, todayKey)} •{' '}
                  {new Intl.DateTimeFormat('tr-TR', {
                    dateStyle: 'long',
                    timeZone: 'Europe/Istanbul',
                  }).format(
                    new Date(
                      `${selectedDate}T12:00:00+03:00`
                    )
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() =>
                      void exportApprovedExcel()
                    }
                    disabled={exportingExcel}
                    className="rounded-xl bg-emerald-600 px-4 py-2.5 text-[10px] font-black text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                    title="Seçili gün için sadece ONAYLANDI işlemlerini Excel'e indir"
                  >
                    {exportingExcel
                      ? 'EXCEL HAZIRLANIYOR...'
                      : 'EXCEL İNDİR'}
                  </button>
                </div>

                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                <div className="flex min-w-[260px] items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedDate((current) =>
                        shiftDateKey(current, -1)
                      )
                    }
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-sm font-black text-slate-700 shadow-sm"
                    title="Önceki gün"
                  >
                    ‹
                  </button>

                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(event) => {
                      const value =
                        event.target.value;

                      if (value) {
                        setSelectedDate(value);
                      }
                    }}
                    className="min-w-0 flex-1 bg-transparent px-1 text-[11px] font-black text-slate-700 outline-none"
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setSelectedDate(todayKey)
                    }
                    className="h-8 shrink-0 rounded-lg bg-white px-2 text-[10px] font-black text-blue-600 shadow-sm"
                  >
                    BUGÜN
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setSelectedDate((current) =>
                        shiftDateKey(current, 1)
                      )
                    }
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-sm font-black text-slate-700 shadow-sm"
                    title="Sonraki gün"
                  >
                    ›
                  </button>
                </div>

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
                  placeholder="Müşteri / telefon / ÖSN / personel"
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-bold text-slate-700 outline-none focus:border-blue-400"
                />
                </div>
              </div>
            </div>

            {listError ? (
              <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-700">
                {listError}
              </div>
            ) : null}
          </div>

          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full min-w-[1320px] border-collapse text-left">
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
                    Yapan Personel
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
                      colSpan={9}
                      className="px-4 py-14 text-center text-xs font-black text-slate-400"
                    >
                      İŞLEMLER YÜKLENİYOR...
                    </td>
                  </tr>
                ) : payments.length === 0 ? (
                  <tr>
                    <td
                      colSpan={9}
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
                        <div className="max-w-[180px] text-xs font-black text-slate-800">
                          {payment.wingsmPersonnelName ||
                            '-'}
                        </div>

                        {payment.wingsmPersonnelCode ? (
                          <div className="mt-1 text-[10px] font-bold text-slate-400">
                            Kod:{' '}
                            {
                              payment.wingsmPersonnelCode
                            }
                          </div>
                        ) : null}
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
                          <div className="flex min-w-[340px] items-start gap-3">
                            <div className="min-w-[112px]">
                              <div className="text-[9px] font-black uppercase tracking-[0.14em] text-emerald-600">
                                ÜÖT
                              </div>

                              <div className="mt-1 whitespace-nowrap text-[11px] font-black text-slate-900">
                                {merchantPaymentDate(
                                  payment.paratikaPaymentDate
                                )}
                              </div>
                            </div>

                            <div className="mt-1 h-8 w-px bg-slate-200" />

                            <div className="min-w-0 flex-1">
                              <div className="text-[9px] font-black uppercase tracking-[0.14em] text-blue-600">
                                ÖSN
                              </div>

                              <div className="mt-1 flex items-center gap-2">
                                <span
                                  title={
                                    payment.pgOrderId ||
                                    payment.merchantPaymentId
                                  }
                                  className="max-w-[180px] truncate text-[11px] font-black text-slate-950"
                                >
                                  {payment.pgOrderId ||
                                    payment.merchantPaymentId ||
                                    '-'}
                                </span>

                                {payment.paratikaPaymentDate &&
                                (payment.pgOrderId ||
                                  payment.merchantPaymentId) ? (
                                  <button
                                    type="button"
                                    title="ÜÖT + ÖSN kopyala"
                                    onClick={() =>
                                      void copyInfo(
                                        `uot-osn-${payment.id}`,
                                        `${merchantPaymentDate(
                                          payment.paratikaPaymentDate
                                        )} ${
                                          payment.pgOrderId ||
                                          payment.merchantPaymentId
                                        }`
                                      )
                                    }
                                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition hover:border-blue-300 hover:text-blue-600"
                                  >
                                    {copiedField ===
                                    `uot-osn-${payment.id}` ? (
                                      <span className="text-[10px] font-black">
                                        ✓
                                      </span>
                                    ) : (
                                      <svg
                                        viewBox="0 0 24 24"
                                        className="h-3.5 w-3.5"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                      >
                                        <rect
                                          x="9"
                                          y="9"
                                          width="11"
                                          height="11"
                                          rx="2"
                                        />
                                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                      </svg>
                                    )}
                                  </button>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        ) : payment.status ===
                          'FAILED' ? (
                          <div className="max-w-[260px] rounded-xl border border-red-200 bg-red-50 px-3 py-2">
                            <div className="text-[9px] font-black uppercase tracking-[0.12em] text-red-500">
                              HATA NEDENİ
                            </div>

                            <div className="mt-1 text-[11px] font-bold leading-5 text-red-700">
                              {payment.responseMsg ||
                                'Ödeme banka/ödeme sistemi tarafından reddedildi.'}
                            </div>

                            {payment.responseCode ? (
                              <div className="mt-1 text-[9px] font-black text-red-400">
                                KOD:{' '}
                                {payment.responseCode}
                              </div>
                            ) : null}
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

                          {permissions?.role ===
                          'admin' ? (
                            <button
                              type="button"
                              onClick={() =>
                                void deletePayment(
                                  payment
                                )
                              }
                              disabled={
                                deletingId ===
                                payment.id
                              }
                              title="İşlemi panel kayıtlarından sil"
                              aria-label={`#${payment.id} işlemini sil`}
                              className="flex h-8 w-8 items-center justify-center self-end rounded-lg border border-rose-200 bg-rose-50 text-base font-black leading-none text-rose-600 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {deletingId ===
                              payment.id
                                ? '…'
                                : '×'}
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
