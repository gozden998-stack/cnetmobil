"use client";
import React, { useState, useEffect, useRef } from 'react';
import AnaSayfa from './AnaSayfa';
import YoneticiPaneli from './components/YoneticiPaneli';
import CepTablet from './components/screens/CepTablet';
import YNAList from './components/screens/YNAList';
import DisKanal from './components/screens/DisKanal';
import KampanyaliSifir from './components/screens/KampanyaliSifir';
import IkinciElApple from './components/screens/IkinciElApple';
import IkinciElAndroid from './components/screens/IkinciElAndroid';
import TeknikServis from './components/screens/TeknikServis';
import CihazAlim from './components/screens/CihazAlim';
import CihazTalep from './components/screens/CihazTalep/CihazTalep';

const TABLO_ISMI = 'Google Sheets ile Kurumsal Alım Sistemi'; 

// ======================================================
// POSTGRESQL - TARAYICI SADECE KENDİ NEXT.JS API'MİZE BAĞLANIR
// PostgreSQL bilgileri yalnızca sunucudaki DATABASE_URL içinde kalır.
// ======================================================
type SheetRow = {
  id?: number;
  sheet_name: string;
  row_number: number;
  data: any[];
  updated_at?: string;
};

function trimTrailingEmptyCells(row: any[]): any[] {
  const result = [...row];
  while (
    result.length > 0 &&
    (result[result.length - 1] === '' ||
      result[result.length - 1] === null ||
      result[result.length - 1] === undefined)
  ) {
    result.pop();
  }
  return result;
}

function getRangeFromSheetRows(
  rows: SheetRow[],
  startRow: number,
  endRow: number,
  startCol: number,
  endColExclusive: number
): any[][] {
  const result = rows
    .filter((item) => item.row_number >= startRow && item.row_number <= endRow)
    .sort((a, b) => a.row_number - b.row_number)
    .map((item) => {
      const rowData = Array.isArray(item.data) ? item.data : [];
      return trimTrailingEmptyCells(rowData.slice(startCol, endColExclusive));
    });

  while (result.length > 0 && result[result.length - 1].length === 0) {
    result.pop();
  }

  return result;
}

function buildPanelData(rows: SheetRow[]) {
  const sheets: Record<string, SheetRow[]> = {};

  rows.forEach((row) => {
    if (!sheets[row.sheet_name]) sheets[row.sheet_name] = [];
    sheets[row.sheet_name].push(row);
  });

  return {
    Devices: getRangeFromSheetRows(sheets['Google Sheets ile Kurumsal Alım Sistemi'] || [], 2, 1000, 0, 6),
    Ayarlar: getRangeFromSheetRows(sheets['Ayarlar'] || [], 1, 25, 0, 2),
    Alimlar: getRangeFromSheetRows(sheets['Alimlar'] || [], 2, 500, 0, 8),
    Markalar: getRangeFromSheetRows(sheets['Markalar'] || [], 2, 50, 0, 2),
    CepTablet: getRangeFromSheetRows(sheets['CEP + TABLET+IOT SAAT LIST'] || [], 1, 1000, 0, 12),
    YNA: getRangeFromSheetRows(sheets['YNA LİST'] || [], 1, 1000, 0, 6),
    DisKanal: getRangeFromSheetRows(sheets['DIŞ KANAL SATIN ALMA'] || [], 1, 1000, 0, 3),
    Servis: getRangeFromSheetRows(sheets['Servis_Fiyatlari'] || [], 2, 1000, 0, 7),
    IkinciEl: getRangeFromSheetRows(sheets['2.EL FİYAT LİSTESİ'] || [], 1, 1000, 0, 10),
    Depo: getRangeFromSheetRows(sheets['DEPO'] || [], 1, 1000, 0, 3),
    Hedefler: getRangeFromSheetRows(sheets['HEDEFLER'] || [], 3, 100, 0, 13),
    MagazaGidisat: getRangeFromSheetRows(sheets['MagazaGidisat'] || [], 1, 100, 0, 5),
    PersonelGidisat: getRangeFromSheetRows(sheets['PersonelGidisat'] || [], 2, 100, 0, 12),
    THH: getRangeFromSheetRows(sheets['THH'] || [], 1, 1000, 0, 18),
    CihazTalep: getRangeFromSheetRows(sheets['CihazTalep'] || [], 1, 1000, 0, 15),
    CustomerDevices: getRangeFromSheetRows(sheets['CİHAZ SAT'] || [], 2, 1000, 0, 6),
    CustomerConfig: getRangeFromSheetRows(sheets['CİHAZ SAT'] || [], 2, 50, 13, 15),
  };
}

// ======================================================
// V6 - EKRAN BAZLI CACHE + SEÇİLİ EKRANLARDA REALTIME
// Anlık: Cihaz Talep, Cep + Tablet / Kampanyalı, YNA, Dış Kanal
// Diğer ekranlar: 20 dakika cache
// ======================================================
const SHEET_CACHE_KEY = 'cnet_pg_sheet_rows_cache_v7';
const SHEET_CACHE_META_KEY = 'cnet_pg_sheet_rows_cache_meta_v7';
const NORMAL_SCREEN_CACHE_MS = 20 * 60 * 1000;

const REALTIME_SHEETS = [
  'CihazTalep',
  'CEP + TABLET+IOT SAAT LIST',
  'YNA LİST',
  'DIŞ KANAL SATIN ALMA',
] as const;

const MODE_SHEETS: Record<string, string[]> = {
  ana_sayfa: ['Ayarlar', 'HEDEFLER', 'MagazaGidisat', 'PersonelGidisat'],
  alim: ['Google Sheets ile Kurumsal Alım Sistemi', 'Ayarlar', 'Alimlar', 'Markalar'],
  servis: ['Google Sheets ile Kurumsal Alım Sistemi', 'Ayarlar', 'Markalar', 'Servis_Fiyatlari'],
  cep_tablet: ['CEP + TABLET+IOT SAAT LIST'],
  kampanya_sifir: ['CEP + TABLET+IOT SAAT LIST'],
  yna_list: ['YNA LİST'],
  dis_kanal: ['DIŞ KANAL SATIN ALMA'],
  ikinci_el_apple: ['2.EL FİYAT LİSTESİ'],
  ikinci_el_android: ['2.EL FİYAT LİSTESİ'],
  imei_list: ['DEPO'],
  thh: ['THH'],
  cihaz_talep: ['CihazTalep'],
};

function replaceSheetsInRows(
  base: SheetRow[],
  incoming: SheetRow[],
  sheetNames: string[]
) {
  const names = new Set(sheetNames);
  return [
    ...base.filter((row) => !names.has(row.sheet_name)),
    ...incoming,
  ].sort((a, b) => {
    const sc = a.sheet_name.localeCompare(b.sheet_name, 'tr');
    return sc !== 0 ? sc : a.row_number - b.row_number;
  });
}

function saveSheetCache(rows: SheetRow[], sheetFetchedAt?: Record<string, number>) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SHEET_CACHE_KEY, JSON.stringify(rows));
    if (sheetFetchedAt) {
      localStorage.setItem(
        SHEET_CACHE_META_KEY,
        JSON.stringify({ sheetFetchedAt })
      );
    }
  } catch (e) {
    console.warn('Panel cache yazılamadı:', e);
  }
}

async function fetchSheetsDirect(sheetNames: string[]): Promise<SheetRow[]> {
  if (!sheetNames.length) return [];

  const startedAt = performance.now();
  const params = new URLSearchParams();
  sheetNames.forEach((name) => params.append('sheet', name));

  const response = await fetch(`/api/sheet-rows?${params.toString()}`, {
    method: 'GET',
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(result?.error || `PostgreSQL API hatası (${response.status})`);
  }

  const allRows = Array.isArray(result?.rows) ? (result.rows as SheetRow[]) : [];

  try {
    const approxBytes = new Blob([JSON.stringify(allRows)]).size;
    console.info(
      `[POSTGRES V7] ${sheetNames.join(' + ')}: ${allRows.length} satır, ${(approxBytes / 1024).toFixed(1)} KB, ${(performance.now() - startedAt).toFixed(0)} ms`
    );
  } catch (_) {}

  return allRows;
}


type AdminEditableSheetTarget = {
  title: string;
  sheetName: string;
};

const ADMIN_EDITABLE_SHEETS: Record<string, AdminEditableSheetTarget> = {
  cep_tablet: {
    title: 'Cep + Tablet',
    sheetName: 'CEP + TABLET+IOT SAAT LIST',
  },
  yna_list: {
    title: 'YNA List',
    sheetName: 'YNA LİST',
  },
  dis_kanal: {
    title: 'Dış Kanal',
    sheetName: 'DIŞ KANAL SATIN ALMA',
  },
  ikinci_el_apple: {
    title: '2. El Listesi',
    sheetName: '2.EL FİYAT LİSTESİ',
  },
  ikinci_el_android: {
    title: '2. El Listesi',
    sheetName: '2.EL FİYAT LİSTESİ',
  },
};

function excelColumnName(indexZeroBased: number) {
  let n = indexZeroBased + 1;
  let result = '';

  while (n > 0) {
    const mod = (n - 1) % 26;
    result = String.fromCharCode(65 + mod) + result;
    n = Math.floor((n - 1) / 26);
  }

  return result;
}

function AdminDynamicSheetEditor({
  target,
  onClose,
  onSaved,
}: {
  target: AdminEditableSheetTarget;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}) {
  const [rows, setRows] = useState<SheetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editingRow, setEditingRow] = useState<number | null>(null);
  const [draft, setDraft] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const loadRows = async () => {
    setLoading(true);
    setMessage('');

    try {
      const freshRows = await fetchSheetsDirect([target.sheetName]);

      setRows(
        freshRows
          .filter((row) => row.sheet_name === target.sheetName)
          .sort((a, b) => a.row_number - b.row_number)
      );
    } catch (error: any) {
      setMessage(error?.message || 'Liste alınamadı.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setEditingRow(null);
    setDraft([]);
    setSearch('');
    loadRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target.sheetName]);

  const headerRow =
    rows.find((row) => row.row_number === 1) ||
    rows[0];

  const maxColumns = Math.max(
    headerRow && Array.isArray(headerRow.data)
      ? headerRow.data.length
      : 0,
    ...rows.map((row) =>
      Array.isArray(row.data) ? row.data.length : 0
    ),
    1
  );

  const headers = Array.from(
    { length: maxColumns },
    (_, index) => {
      const value =
        headerRow && Array.isArray(headerRow.data)
          ? headerRow.data[index]
          : '';

      const text = String(value ?? '').trim();

      return text || `SÜTUN ${excelColumnName(index)}`;
    }
  );

  const dataRows = rows
    .filter((row) => row.row_number > 1)
    .filter((row) => {
      const values = Array.isArray(row.data) ? row.data : [];

      if (
        values.every(
          (value) => String(value ?? '').trim() === ''
        )
      ) {
        return false;
      }

      const q = search.trim().toLocaleLowerCase('tr-TR');
      if (!q) return true;

      return values.some((value) =>
        String(value ?? '')
          .toLocaleLowerCase('tr-TR')
          .includes(q)
      );
    });

  const startEdit = (row: SheetRow) => {
    const values = Array.isArray(row.data) ? row.data : [];

    setDraft(
      Array.from(
        { length: maxColumns },
        (_, index) => String(values[index] ?? '')
      )
    );

    setEditingRow(row.row_number);
    setMessage('');
  };

  const saveRow = async () => {
    if (editingRow === null) return;

    const row = rows.find(
      (item) => item.row_number === editingRow
    );

    if (!row) return;

    const original = Array.isArray(row.data) ? row.data : [];

    const changes = Array.from(
      { length: maxColumns },
      (_, index) => {
        const oldValue = String(original[index] ?? '');
        const newValue = String(draft[index] ?? '');

        if (oldValue === newValue) return null;

        return {
          columnNumber: index + 1,
          value: newValue,
        };
      }
    ).filter(
      (
        item
      ): item is { columnNumber: number; value: string } =>
        item !== null
    );

    if (!changes.length) {
      setEditingRow(null);
      setDraft([]);
      return;
    }

    setSaving(true);
    setMessage('');

    try {
      const response = await fetch('/api/panel-action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'UPDATE_LIST_CELLS',
          sheetName: target.sheetName,
          rowNumber: editingRow,
          changes,
        }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok || result?.result !== 'success') {
        throw new Error(
          result?.message || 'Kayıt yapılamadı.'
        );
      }

      setRows((current) =>
        current.map((item) => {
          if (item.row_number !== editingRow) return item;

          return {
            ...item,
            data: Array.from(
              { length: maxColumns },
              (_, index) => String(draft[index] ?? '')
            ),
            updated_at: new Date().toISOString(),
          };
        })
      );

      setEditingRow(null);
      setDraft([]);
      setMessage('Kaydedildi.');

      await onSaved();

      window.setTimeout(() => setMessage(''), 2200);
    } catch (error: any) {
      setMessage(error?.message || 'Kayıt yapılamadı.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[250] overflow-hidden bg-slate-950/65 backdrop-blur-sm p-2 sm:p-4 print:hidden">
      <div className="mx-auto flex h-full w-full max-w-[1800px] flex-col overflow-hidden rounded-[22px] bg-white shadow-2xl">
        <div className="flex shrink-0 flex-col gap-4 border-b border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600">
              SUPER ADMIN DÜZENLE
            </div>
            <h2 className="mt-1 text-2xl font-black text-slate-900">
              {target.title}
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Listede ara..."
              className="h-10 min-w-[220px] rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold outline-none focus:border-blue-500"
            />

            <button
              type="button"
              onClick={loadRows}
              disabled={loading || saving}
              className="h-10 rounded-xl border border-slate-200 px-4 text-xs font-black text-slate-600 disabled:opacity-50"
            >
              YENİLE
            </button>

            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="h-10 rounded-xl bg-slate-900 px-4 text-xs font-black text-white disabled:opacity-50"
            >
              KAPAT
            </button>
          </div>
        </div>

        {message && (
          <div className={`mx-5 mt-4 rounded-xl border px-4 py-3 text-sm font-black ${
            message === 'Kaydedildi.'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-rose-200 bg-rose-50 text-rose-700'
          }`}>
            {message}
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4 custom-scrollbar">
          {loading ? (
            <div className="flex h-full items-center justify-center text-sm font-black text-slate-400">
              Liste yükleniyor...
            </div>
          ) : (
            <table className="w-full table-fixed border-separate border-spacing-0 text-[10px] sm:text-[11px]">
              <thead className="sticky top-0 z-20">
                <tr>
                  <th className="w-[52px] border-b border-r border-slate-700 bg-slate-900 px-2 py-2 text-left text-[9px] font-black text-white">
                    SATIR
                  </th>

                  {headers.map((header, index) => (
                    <th
                      key={`${header}-${index}`}
                      className="border-b border-r border-slate-700 bg-slate-900 px-2 py-2 text-left text-[9px] font-black text-white break-words"
                    >
                      <div className="truncate" title={header}>
                        {header}
                      </div>
                      <div className="mt-1 text-[9px] text-slate-400">
                        {excelColumnName(index)}
                      </div>
                    </th>
                  ))}

                  <th className="w-[118px] border-b border-l border-slate-700 bg-slate-900 px-2 py-2 text-right text-[9px] font-black text-white">
                    İŞLEM
                  </th>
                </tr>
              </thead>

              <tbody>
                {dataRows.map((row) => {
                  const isEditing = editingRow === row.row_number;
                  const rowData = Array.isArray(row.data) ? row.data : [];

                  return (
                    <tr key={row.row_number}>
                      <td className="border-b border-r border-slate-200 bg-slate-50 px-2 py-2 text-center font-black text-slate-500">
                        {row.row_number}
                      </td>

                      {headers.map((_, index) => (
                        <td
                          key={`${row.row_number}-${index}`}
                          className="border-b border-r border-slate-200 bg-white p-1.5 align-top break-words"
                        >
                          {isEditing ? (
                            <input
                              value={draft[index] ?? ''}
                              onChange={(e) =>
                                setDraft((current) => {
                                  const next = [...current];
                                  next[index] = e.target.value;
                                  return next;
                                })
                              }
                              className="h-9 w-full min-w-0 rounded-lg border border-blue-200 px-2 text-[10px] font-bold outline-none focus:border-blue-500"
                            />
                          ) : (
                            <div className="w-full whitespace-pre-wrap break-words font-semibold leading-4 text-slate-700">
                              {String(rowData[index] ?? '') || '-'}
                            </div>
                          )}
                        </td>
                      ))}

                      <td className="border-b border-l border-slate-200 bg-white p-1.5 text-right">
                        {isEditing ? (
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                if (!saving) {
                                  setEditingRow(null);
                                  setDraft([]);
                                }
                              }}
                              disabled={saving}
                              className="h-8 rounded-lg border border-slate-200 px-2 text-[9px] font-black"
                            >
                              İPTAL
                            </button>

                            <button
                              type="button"
                              onClick={saveRow}
                              disabled={saving}
                              className="h-8 rounded-lg bg-emerald-600 px-2 text-[9px] font-black text-white disabled:opacity-50"
                            >
                              {saving ? 'KAYDEDİLİYOR...' : 'KAYDET'}
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => startEdit(row)}
                            disabled={editingRow !== null}
                            className="h-8 w-full rounded-lg bg-blue-600 px-2 text-[9px] font-black text-white disabled:opacity-30"
                          >
                            DÜZENLE
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="shrink-0 border-t border-slate-200 bg-slate-50 px-5 py-3 text-[10px] font-bold text-slate-500">
          Yeni başlıklı sütun Google Sheets'ten PostgreSQL'e senkronlandıktan sonra burada otomatik çıkar.
        </div>
      </div>
    </div>
  );
}

const IP_HARITASI: any = {
  "78.188.91.172": "CMR SARAY",
  "46.196.12.101": "CMR KAPAKLI",
  "31.155.79.145": "CMR MERKEZ",
  "149.0.18.162": "CMR CADDE"
};

const MASTER_IPLER = [
  "95.70.226.118",
  "148.0.18.162"
];

export default function CnetmobilCmrFinalUltimate() {
  const [authLoading, setAuthLoading] = useState(true); 
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [entryPass, setEntryPass] = useState('');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [authView, setAuthView] = useState<'login' | 'forgot' | 'reset'>('login');
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotMessage, setForgotMessage] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordAgain, setNewPasswordAgain] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState('');
  const [resetSuccess, setResetSuccess] = useState(false);
  
  const [isMasterAccess, setIsMasterAccess] = useState(false);
  const [isSuperAdminUser, setIsSuperAdminUser] = useState(false);
  const [topQuickSearch, setTopQuickSearch] = useState('');
  const [adminSheetEditor, setAdminSheetEditor] = useState<AdminEditableSheetTarget | null>(null);
  
  const [appMode, setAppMode] = useState<'ana_sayfa' | 'alim' | 'servis' | 'cep_tablet' | 'yna_list' | 'dis_kanal' | 'ikinci_el_apple' | 'ikinci_el_android' | 'imei_list' | 'kampanya_sifir' | 'thh' | 'cihaz_talep'>('ana_sayfa');

  // Super Admin panelinden normal panelde belirli ekrana direkt geçiş:
  // /?view=normal&mode=dis_kanal
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const requestedMode =
      new URLSearchParams(window.location.search).get('mode');

    const allowedModes = [
      'ana_sayfa',
      'alim',
      'servis',
      'cep_tablet',
      'yna_list',
      'dis_kanal',
      'ikinci_el_apple',
      'ikinci_el_android',
      'imei_list',
      'kampanya_sifir',
      'thh',
      'cihaz_talep',
    ];

    if (requestedMode && allowedModes.includes(requestedMode)) {
      setAppMode(requestedMode as any);
      setStep(1);
    }
  }, []);

  const currentAdminEditableSheet = ADMIN_EDITABLE_SHEETS[appMode] || null;

  // --- THH MODÜLÜ STATE'LERİ ---
  const [thhData, setThhData] = useState<any[][]>([]);
  const initialThhForm = {
    rowIndex: null as number | null,
    adSoyad: '', musteriTelefon: '', basvuruTarihi: '', sayi: '', konu: '', kepAdresi: '',
    markaModel: '', imeiNo: '', faturaNo: '', faturaTutari: '', alisBilgileri: '',
    durumu: '', durumu2: '', durumu3: '', durumu4: '', sonuc: '',
    ucretIadesi: '', sonuc2: ''
  };
  const [thhForm, setThhForm] = useState(initialThhForm);
  const [thhSaving, setThhSaving] = useState(false);

  // --- CİHAZ TALEP STATE'LERİ ---
  // --- CİHAZ TALEP ---
  // Veri + üst navbar hızlı arama köprüsü parent'ta kalır.
  const [cihazTalepData, setCihazTalepData] = useState<any[][]>([]);
  const [cihazTalepSearch, setCihazTalepSearch] = useState('');
  const [cihazTalepPage, setCihazTalepPage] = useState(1);
  const [cihazTalepOpenActiveSignal, setCihazTalepOpenActiveSignal] = useState(0);

  const [cepTabletData, setCepTabletData] = useState<any[][]>([]);
  const [ynaData, setYnaData] = useState<any[][]>([]);
  const [disKanalData, setDisKanalData] = useState<any[][]>([]);
  const [ikinciElData, setIkinciElData] = useState<any[][]>([]); 
  const [imeiData, setImeiData] = useState<any[][]>([]);
  
  const [magazaGidisatData, setMagazaGidisatData] = useState<any[][]>([]);
  const [personelData, setPersonelData] = useState<any[][]>([]);
  const [hedeflerData, setHedeflerData] = useState<any[][]>([]);
  const servisFiyatlariRef = useRef<any>({});
  const [servisFiyatlari, setServisFiyatlari] = useState<Record<string, {ekran?: string, ekranOrj?: string, ekranOled?: string, ekranCipli?: string, batarya?: string, arkaCam?: string, kasa?: string}>>({});

  const [db, setDb] = useState<any[]>([]);
  const [brandDb, setBrandDb] = useState<any[]>([]);
  const [config, setConfig] = useState<any>({});
  const [alimlar, setAlimlar] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(1);
  const [selectedBrand, setSelectedBrand] = useState('');
  const [selectedModelName, setSelectedModelName] = useState('');
  const [selectedCapacity, setSelectedCapacity] = useState<any>(null);
  const [selectedBranch, setSelectedBranch] = useState('CMR MERKEZ');
  const [selectedColor, setSelectedColor] = useState('Diğer'); 
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileSubMenuOpen, setMobileSubMenuOpen] = useState(false);
  const secondHandMenuButtonRef = useRef<HTMLButtonElement | null>(null);
  const [secondHandMenuPos, setSecondHandMenuPos] = useState({
    left: 0,
    top: 0,
    width: 220,
  });

  // CİHAZ TALEP MAĞAZA DROPDOWN
  // Sadece üst menü seçimi için kullanılır.
  // Cihaz Talep ekranının mevcut görseli / modalları / çalışma yapısı değişmez.
  const [cihazTalepMenuOpen, setCihazTalepMenuOpen] = useState(false);
  const cihazTalepMenuButtonRef = useRef<HTMLButtonElement | null>(null);
  const [cihazTalepMenuPos, setCihazTalepMenuPos] = useState({
    left: 0,
    top: 0,
    width: 240,
  });
  const [cihazTalepSourceBranch, setCihazTalepSourceBranch] = useState<
    'CNET' | 'CMR' | 'CADDE' | 'KAPAKLI' | 'SARAY'
  >('CMR');
  const [customer, setCustomer] = useState({ name: '', phone: '', imei: '' });
  const [status, setStatus] = useState<any>({ power: null, screen: null, cosmetic: null, faceId: null, battery: null, sim: null, warranty: null, speaker: null });
  const [prices, setPrices] = useState({ cash: 0, trade: 0 });
  const [isCustomOfferActive, setIsCustomOfferActive] = useState(false);
  const [customOffer, setCustomOffer] = useState<string>('');
  
  const [isCustomTradeOfferActive, setIsCustomTradeOfferActive] = useState(false);
  const [customTradeOffer, setCustomTradeOffer] = useState<string>('');
  
  const [purchaseType, setPurchaseType] = useState<'NAKİT' | 'TAKAS' | 'ALINMADI' | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminPass, setAdminPass] = useState('');
  const [newDevice, setNewDevice] = useState({ brand: 'Apple', name: '', cap: '', base: '', img: '', minPrice: '0' });
  const [isInstallmentModalOpen, setIsInstallmentModalOpen] = useState(false);
  const [installmentAmount, setInstallmentAmount] = useState('');
  
  // --- KASKO EKLENTİSİ ---
  const [isKaskoModalOpen, setIsKaskoModalOpen] = useState(false);
  const [kaskoAmount, setKaskoAmount] = useState('');

  const [adminSelectedBranch, setAdminSelectedBranch] = useState<string>('TÜM ŞUBELER');
  const [dateFilterType, setDateFilterType] = useState<string>('TÜM ZAMANLAR');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');

  const [ekspertizModalData, setEkspertizModalData] = useState<{customer: string, device: string, data: string} | null>(null);

  const [toastMessages, setToastMessages] = useState<{id: number, text: string, type: 'new' | 'price'}[]>([]);
  const prevDbRef = useRef<any[]>([]);
  const prevCepTabletRef = useRef<any[][]>([]);
  const toastIdCounter = useRef(0);
  const sheetRowsRef = useRef<SheetRow[]>([]);

  const branches = [
    { name: "CMR CADDE", phone: "905443214534" },
    { name: "CMR MERKEZ", phone: "905416801905" },
    { name: "CMR KAPAKLI", phone: "905327005959" },
    { name: "CMR SARAY", phone: "905416801905" },
    { name: "VODAFONE KANALI", phone: "905425420000" },
    { name: "ZUMAY KANALI", phone: "905000000000" }
  ];

  const brandAssets: any = {
    "Apple": { logo: "https://upload.wikimedia.org/wikipedia/commons/f/fa/Apple_logo_black.svg" },
    "Samsung": { logo: "https://upload.wikimedia.org/wikipedia/commons/2/24/Samsung_Logo.svg" },
    "Huawei": { logo: "https://upload.wikimedia.org/wikipedia/commons/e/e8/Huawei_logo.svg" },
    "Xiaomi": { logo: "https://upload.wikimedia.org/wikipedia/commons/a/ae/Xiaomi_logo_%282021-%29.svg" },
    "Oppo": { logo: "https://upload.wikimedia.org/wikipedia/commons/0/0d/Oppo_Logo.svg" },
    "Realme": { logo: "https://upload.wikimedia.org/wikipedia/commons/1/1a/Realme-Logo.png" },
    "Vivo": { logo: "https://upload.wikimedia.org/wikipedia/commons/e/e5/Vivo_logo.svg" },
    "Macbook": { logo: "https://www.freeiconspng.com/thumbs/laptop-icon/apple-laptop-icon-14.png" }
  };

  const isZumay = selectedBranch === 'ZUMAY KANALI';

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const token = new URLSearchParams(window.location.search).get('reset_token');
    if (token) {
      setResetToken(token);
      setAuthView('reset');
    }
  }, []);

  useEffect(() => {
    const verifySession = async () => {
      try {
        const res = await fetch('/api/auth', {
          method: 'GET',
          cache: 'no-store',
        });

        if (!res.ok) {
          setIsLoggedIn(false);
          setIsMasterAccess(false);
          setIsAdmin(false);
          setAuthLoading(false);
          return;
        }

        const session = await res.json();

        if (!session?.success) {
          setIsLoggedIn(false);
          setIsMasterAccess(false);
          setIsAdmin(false);
          setAuthLoading(false);
          return;
        }

        if (session.role === 'yonetici') {
          setIsMasterAccess(true);
          setIsAdmin(true);
          setSelectedBranch(session.branch || 'CMR MERKEZ');
          setIsLoggedIn(true);

          try {
            const meRes = await fetch('/api/me', {
              method: 'GET',
              cache: 'no-store',
            });
            const meData = await meRes.json().catch(() => ({}));
            const superAdmin = Boolean(meRes.ok && meData?.isSuperAdmin);
            setIsSuperAdminUser(superAdmin);
          } catch (error) {
            console.error('Super Admin kontrol hatası:', error);
            setIsSuperAdminUser(false);
          }

          setAuthLoading(false);
          return;
        }

        if (session.role === 'personel') {
          const branch = String(session.branch || '');

          if (branch === 'VODAFONE KANALI' || branch === 'ZUMAY KANALI') {
            setSelectedBranch(branch);
            setIsMasterAccess(false);
            setIsAdmin(false);
            setIsSuperAdminUser(false);
            setIsLoggedIn(true);
            setAuthLoading(false);
            return;
          }

          const ipRes = await fetch('https://api.ipify.org?format=json');
          const ipData = await ipRes.json();
          const currentIp = ipData.ip;

          if (MASTER_IPLER.includes(currentIp) || IP_HARITASI[currentIp] === branch) {
            setSelectedBranch(branch);
            setIsMasterAccess(false);
            setIsAdmin(false);
            setIsSuperAdminUser(false);
            setIsLoggedIn(true);
            setAuthLoading(false);
            return;
          }

          // Yetkisiz mağaza ağı: sunucu tarafındaki HttpOnly oturumu da kapat.
          await fetch('/api/auth', { method: 'DELETE' });
          setIsLoggedIn(false);
          setIsMasterAccess(false);
          setIsAdmin(false);
        }
      } catch (error) {
        console.error('Session kontrol hatası:', error);
        setIsLoggedIn(false);
        setIsMasterAccess(false);
        setIsAdmin(false);
      }

      setAuthLoading(false);
    };

    verifySession();
  }, []);

  const handleLogin = async () => {
    if (!loginEmail.trim()) {
      alert('Lütfen e-posta adresinizi girin.');
      return;
    }

    if (!entryPass) {
      alert('Lütfen şifrenizi girin.');
      return;
    }

    setLoginLoading(true);

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: loginEmail.trim().toLowerCase(),
          password: entryPass,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.success) {
        alert(data.message || 'E-posta veya şifre hatalı.');
        setLoginLoading(false);
        return;
      }

      const matchedBranch = String(data.branch || '');

      if (data.role === 'yonetici') {
        setIsMasterAccess(true);
        setIsAdmin(true);
        setSelectedBranch(matchedBranch || 'CMR MERKEZ');
        setIsLoggedIn(true);
        setEntryPass('');

        try {
          const meRes = await fetch('/api/me', {
            method: 'GET',
            cache: 'no-store',
          });
          const meData = await meRes.json().catch(() => ({}));
          const superAdmin = Boolean(meRes.ok && meData?.isSuperAdmin);
          setIsSuperAdminUser(superAdmin);
        } catch (error) {
          console.error('Super Admin kontrol hatası:', error);
          setIsSuperAdminUser(false);
        }

        setLoginLoading(false);
        return;
      }

      if (data.role !== 'personel' || !matchedBranch) {
        await fetch('/api/auth', { method: 'DELETE' });
        alert('Kullanıcı yetkisi doğrulanamadı.');
        setLoginLoading(false);
        return;
      }

      if (
        matchedBranch === 'VODAFONE KANALI' ||
        matchedBranch === 'ZUMAY KANALI'
      ) {
        setSelectedBranch(matchedBranch);
        setIsMasterAccess(false);
        setIsAdmin(false);
        setIsSuperAdminUser(false);
        setIsLoggedIn(true);
        setEntryPass('');
        setLoginLoading(false);
        return;
      }

      const ipRes = await fetch('https://api.ipify.org?format=json');
      const ipData = await ipRes.json();
      const currentIp = ipData.ip;

      if (
        MASTER_IPLER.includes(currentIp) ||
        IP_HARITASI[currentIp] === matchedBranch
      ) {
        setSelectedBranch(matchedBranch);
        setIsMasterAccess(false);
        setIsAdmin(false);
        setIsSuperAdminUser(false);
        setIsLoggedIn(true);
        setEntryPass('');
      } else {
        await fetch('/api/auth', { method: 'DELETE' });
        alert(
          `GÜVENLİK UYARISI: Bu mağazanın Wi-Fi ağına bağlanın! (IP: ${currentIp})`
        );
      }
    } catch (error) {
      console.error('Login hatası:', error);
      alert('Bağlantı Hatası: Lütfen internetinizi kontrol edin.');
    }

    setLoginLoading(false);
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth', { method: 'DELETE' });
    } catch (error) {
      console.error('Çıkış hatası:', error);
    }

    setIsLoggedIn(false);
    setEntryPass('');
    setLoginEmail('');
    setIsMasterAccess(false);
    setIsAdmin(false);
    setIsSuperAdminUser(false);
    setAuthView('login');
  };

  const handleForgotPassword = async () => {
    const email = forgotEmail.trim().toLowerCase();
    if (!email) {
      setForgotMessage('Lütfen e-posta adresinizi girin.');
      return;
    }

    setForgotLoading(true);
    setForgotMessage('');

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await res.json().catch(() => ({}));
      setForgotMessage(
        data.message ||
          'E-posta adresi sistemde kayıtlıysa şifre sıfırlama bağlantısı gönderildi.'
      );
    } catch (error) {
      console.error('Şifre sıfırlama maili hatası:', error);
      setForgotMessage('İstek alınamadı. Lütfen kısa süre sonra tekrar deneyin.');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResetPassword = async () => {
    setResetMessage('');
    setResetSuccess(false);

    if (!resetToken) {
      setResetMessage('Şifre sıfırlama bağlantısı geçersiz.');
      return;
    }

    if (newPassword.length < 8) {
      setResetMessage('Yeni şifre en az 8 karakter olmalıdır.');
      return;
    }

    if (!/[A-ZÇĞİÖŞÜ]/.test(newPassword)) {
      setResetMessage('Yeni şifre en az bir büyük harf içermelidir.');
      return;
    }

    if (!/[a-zçğıöşü]/.test(newPassword)) {
      setResetMessage('Yeni şifre en az bir küçük harf içermelidir.');
      return;
    }

    if (!/[0-9]/.test(newPassword)) {
      setResetMessage('Yeni şifre en az bir rakam içermelidir.');
      return;
    }

    if (newPassword !== newPasswordAgain) {
      setResetMessage('Yeni şifreler birbiriyle aynı değil.');
      return;
    }

    setResetLoading(true);

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: resetToken, password: newPassword }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.success) {
        setResetMessage(data.message || 'Şifre değiştirilemedi.');
        return;
      }

      setResetSuccess(true);
      setResetMessage(data.message || 'Şifreniz başarıyla değiştirildi.');
      setEntryPass('');

      if (typeof window !== 'undefined') {
        window.history.replaceState({}, '', window.location.pathname);
      }
    } catch (error) {
      console.error('Yeni şifre oluşturma hatası:', error);
      setResetMessage('Bağlantı hatası oluştu. Lütfen tekrar deneyin.');
    } finally {
      setResetLoading(false);
    }
  };

  const resetAll = () => {
    setStep(1);
    setSelectedBrand('');
    setSelectedModelName('');
    setSelectedCapacity(null);
    setSelectedColor('Diğer');
    setSearchQuery(''); 
    setCustomer({ name: '', phone: '', imei: '' });
    setStatus({ power: null, screen: null, cosmetic: null, faceId: null, battery: null, sim: null, warranty: null, speaker: null });
    setIsCustomOfferActive(false);
    setCustomOffer('');
    setIsCustomTradeOfferActive(false);
    setCustomTradeOffer('');
    setPurchaseType(null);
    if(typeof window !== 'undefined') window.scrollTo(0,0);
  };

  const resetSelection = () => {
    setSelectedCapacity(null);
    setSelectedColor('Diğer');
    setSearchQuery(''); 
    setStatus({ power: null, screen: null, cosmetic: null, faceId: null, battery: null, sim: null, warranty: null, speaker: null });
    setIsCustomOfferActive(false);
    setCustomOffer('');
    setIsCustomTradeOfferActive(false);
    setCustomTradeOffer('');
    setPurchaseType(null);
    if(typeof window !== 'undefined') window.scrollTo(0,0);
  };

  const applySheetRowsToPanel = (directRows: SheetRow[]) => {
    try {
      const allData = buildPanelData(directRows);

      let newNotifications: {id: number, text: string, type: 'new' | 'price'}[] = [];
      const isInitialLoad = prevDbRef.current.length === 0;

      if (!isInitialLoad && !loading) { 
          if (allData.Devices) {
              const currentDeviceNames = prevDbRef.current.map(d => d.name);
              const newDevices = allData.Devices.filter((d: any) => d[1] && !currentDeviceNames.includes(d[1]));
              
              const uniqueNewDevices = Array.from(new Set(newDevices.map((d: any) => d[1])));
              uniqueNewDevices.forEach(deviceName => {
                  toastIdCounter.current += 1;
                  newNotifications.push({ id: toastIdCounter.current, text: `🎉 STOĞA YENİ CİHAZ GELDİ: ${deviceName}`, type: 'new' });
              });
          }

          if (allData.CepTablet && prevCepTabletRef.current.length > 0) {
              const prevTabletMap = new Map();
              prevCepTabletRef.current.forEach(row => {
                  if (row[0]) prevTabletMap.set(row[0], { k: row[1], s: row[2] }); 
                  if (row[5]) prevTabletMap.set(row[5], { k: row[6], s: row[7] }); 
              });

              const changedPrices: string[] = [];
              allData.CepTablet.forEach((row: any) => {
                  if (row[0]) {
                      const prev = prevTabletMap.get(row[0]);
                      if (prev && (prev.k !== row[1] || prev.s !== row[2])) {
                          if(!changedPrices.includes(row[0])) changedPrices.push(row[0]);
                      }
                  }
                  if (row[5]) {
                      const prev = prevTabletMap.get(row[5]);
                      if (prev && (prev.k !== row[6] || prev.s !== row[7])) {
                          if(!changedPrices.includes(row[5])) changedPrices.push(row[5]);
                      }
                  }
              });

              if (changedPrices.length > 0) {
                  toastIdCounter.current += 1;
                  if (changedPrices.length > 3) {
                      newNotifications.push({ id: toastIdCounter.current, text: `🔄 SİSTEMDE FİYATLAR GÜNCELLENDİ (${changedPrices.length} cihaz)`, type: 'price' });
                  } else {
                      newNotifications.push({ id: toastIdCounter.current, text: `💰 FİYAT GÜNCELLENDİ: ${changedPrices.join(', ')}`, type: 'price' });
                  }
              }
          }
      }

      if (newNotifications.length > 0) {
          setToastMessages(prev => [...prev, ...newNotifications]);
          newNotifications.forEach(notification => {
              setTimeout(() => {
                  setToastMessages(prev => prev.filter(m => m.id !== notification.id));
              }, 8000);
          });
      }

      if (allData.Devices) {
          prevDbRef.current = allData.Devices.map((row: any) => ({
              brand: row[0] || '', name: row[1] || '', cap: row[2] || '',
              base: parseInt(row[3]) || 0, img: row[4]?.trim() || '', minPrice: parseInt(row[5]) || 0
          }));
      }
      if (allData.CepTablet) {
          prevCepTabletRef.current = allData.CepTablet;
      }

      if (allData.Devices) {
        setDb(allData.Devices.map((row: any) => ({
          brand: row[0] || '', name: row[1] || '', cap: row[2] || '',
          base: parseInt(row[3]) || 0, img: row[4]?.trim() || '', minPrice: parseInt(row[5]) || 0
        })));
      }

      if (allData.Ayarlar) {
        const m: any = {};
        allData.Ayarlar.forEach((row: any) => { 
          m[row[0]] = isNaN(Number(row[1])) ? row[1] : parseFloat(row[1]); 
        });
        if (m.Ekran_Kirik_Android === undefined && m.Ekran_Kirik !== undefined) m.Ekran_Kirik_Android = m.Ekran_Kirik;
        if (m.Kasa_Kotu_Android === undefined && m.Kasa_Kotu !== undefined) m.Kasa_Kotu_Android = m.Kasa_Kotu;
        setConfig(m);
      }

      if (allData.Alimlar) {
        setAlimlar(allData.Alimlar.map((val: any, index: number) => ({ data: val, sheetIndex: index + 2 })));
      }

      if (allData.Markalar) {
        setBrandDb(allData.Markalar.map((row: any) => ({ name: row[0], logo: row[1] })));
      }

      if (allData.CepTablet) setCepTabletData(allData.CepTablet);
      if (allData.YNA) setYnaData(allData.YNA);
      if (allData.DisKanal) setDisKanalData(allData.DisKanal);
      if (allData.IkinciEl) setIkinciElData(allData.IkinciEl);
      if (allData.THH) setThhData(allData.THH);
      if (allData.CihazTalep) setCihazTalepData(allData.CihazTalep);
      
      if (allData.Depo) setImeiData(allData.Depo);
      
      if (allData.MagazaGidisat) setMagazaGidisatData(allData.MagazaGidisat);
      if (allData.PersonelGidisat) setPersonelData(allData.PersonelGidisat);
      if (allData.Hedefler) setHedeflerData(allData.Hedefler);
      if (allData.Servis) {
        const loadedServis: any = {};
        allData.Servis.forEach((row: any) => {
          loadedServis[row[0]] = {
            ekranOrj: row[1] || '',
            ekranOled: row[2] || '',
            ekranCipli: row[3] || '',
            batarya: row[4] || '',
            arkaCam: row[5] || '',
            kasa: row[6] || ''
          };
        });
        setServisFiyatlari(loadedServis);
      }

      setLoading(false);
    } catch (e) {
      console.error("Panel state güncelleme hatası:", e);
      setLoading(false);
    }
  };

  const sheetFetchedAtRef = useRef<Record<string, number>>({});
  const cacheBootstrappedRef = useRef(false);

  const getSheetsForCurrentScreen = () => {
    // Yönetici paneli mevcut istatistik/config yapısını kullanıyor.
    if (step === 99) {
      return ['Ayarlar', 'Alimlar'];
    }
    return MODE_SHEETS[appMode] || [];
  };

  const loadSheetsForCurrentScreen = async (force = false) => {
    try {
      // İlk çalışmada V6 local cache'i anında ekrana uygula.
      if (!cacheBootstrappedRef.current && typeof window !== 'undefined') {
        cacheBootstrappedRef.current = true;
        try {
          const cachedRows = JSON.parse(localStorage.getItem(SHEET_CACHE_KEY) || '[]') as SheetRow[];
          const meta = JSON.parse(localStorage.getItem(SHEET_CACHE_META_KEY) || '{}');
          sheetFetchedAtRef.current = meta?.sheetFetchedAt || {};

          if (cachedRows.length) {
            sheetRowsRef.current = cachedRows;
            applySheetRowsToPanel(cachedRows);
          }
        } catch (e) {
          console.warn('V6 cache okunamadı:', e);
        }
      }

      const neededSheets = getSheetsForCurrentScreen();
      if (!neededSheets.length) {
        setLoading(false);
        return;
      }

      const now = Date.now();
      const realtimeSet = new Set<string>(REALTIME_SHEETS as readonly string[]);

      // Anlık ekranlar ekrana girildiğinde güncel sheet bir kez çekilir ve
      // ekran açıkken Realtime ile devam eder. Normal ekranlar 20 dk cache kullanır.
      const sheetsToFetch = neededSheets.filter((sheetName) => {
        if (force) return true;
        if (realtimeSet.has(sheetName)) return true;
        const lastFetched = Number(sheetFetchedAtRef.current[sheetName] || 0);
        return !lastFetched || now - lastFetched >= NORMAL_SCREEN_CACHE_MS;
      });

      if (!sheetsToFetch.length) {
        setLoading(false);
        return;
      }

      const freshRows = await fetchSheetsDirect(sheetsToFetch);
      const nextRows = replaceSheetsInRows(
        sheetRowsRef.current,
        freshRows,
        sheetsToFetch
      );

      sheetsToFetch.forEach((sheetName) => {
        sheetFetchedAtRef.current[sheetName] = now;
      });

      sheetRowsRef.current = nextRows;
      applySheetRowsToPanel(nextRows);
      saveSheetCache(nextRows, sheetFetchedAtRef.current);
    } catch (e) {
      console.error('PostgreSQL ekran veri yükleme hatası:', e);
      setLoading(false);
    }
  };

 const refreshDataCache = async () => {
  try {
    // Apps Script → Sheets → PostgreSQL senkronunun tamamlanması için kısa bekleme
    await new Promise((resolve) => setTimeout(resolve, 800));

    // Açık ekranın verisini PostgreSQL'den ZORLA yeniden çek
    await loadSheetsForCurrentScreen(true);
  } catch (e) {
    console.error('Yazma sonrası PostgreSQL yenileme hatası:', e);
  }
};

  // Ekran değiştiğinde yalnızca o ekranın ihtiyaç duyduğu sheet(ler)i kontrol et.
  useEffect(() => {
    loadSheetsForCurrentScreen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appMode, step]);

  // V7: Supabase Realtime yerine kendi sunucumuzdan hafif polling.
  // Yalnızca kullanıcı anlık ekranlardan birindeyken çalışır.
  // Şimdilik 3 saniye; daha sonra WebSocket/SSE'ye çevrilebilir.
  useEffect(() => {
    if (step === 99) return;

    const activeRealtimeSheets = (MODE_SHEETS[appMode] || []).filter((sheetName) =>
      (REALTIME_SHEETS as readonly string[]).includes(sheetName)
    );

    if (!activeRealtimeSheets.length) return;

    let cancelled = false;
    let busy = false;

    const poll = async () => {
      if (cancelled || busy || document.visibilityState === 'hidden') return;
      busy = true;

      try {
        const freshRows = await fetchSheetsDirect(activeRealtimeSheets);
        if (cancelled) return;

        const nextRows = replaceSheetsInRows(
          sheetRowsRef.current,
          freshRows,
          activeRealtimeSheets
        );

        const now = Date.now();
        activeRealtimeSheets.forEach((sheetName) => {
          sheetFetchedAtRef.current[sheetName] = now;
        });

        sheetRowsRef.current = nextRows;
        saveSheetCache(nextRows, sheetFetchedAtRef.current);
        applySheetRowsToPanel(nextRows);
      } catch (e) {
        console.error('PostgreSQL anlık veri yenileme hatası:', e);
      } finally {
        busy = false;
      }
    };

    const timer = window.setInterval(poll, 3000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appMode, step]);

  useEffect(() => {
    if (selectedCapacity && config.Guc_Yok !== undefined) {
      let price = selectedCapacity.base;
      if (status.power === 'Hayır') price *= (1 - ((config.Guc_Yok || 0) / 100));

      let ekranKirikYuzdesi = config.Ekran_Kirik || 0;
      if (selectedBrand?.toLowerCase() !== 'apple') {
          ekranKirikYuzdesi = config.Ekran_Kirik_Android !== undefined ? config.Ekran_Kirik_Android : (config.Ekran_Kirik || 0);
      }
      
      if (status.screen === 'Kırık') {
          price *= (1 - (ekranKirikYuzdesi / 100));
      } 
      else if (status.screen === 'Bilinmeyen Parça') {
          let bilinmeyenParcaYuzdesi = config.Bilinmeyen_Parca || 0;
          price *= (1 - (bilinmeyenParcaYuzdesi / 100));
      }

      if (status.screen === 'Çizikler var') price *= (1 - ((config.Ekran_Cizik || 0) / 100));
      if (status.cosmetic === 'İyi') price *= (1 - ((config.Kasa_Iyi || 0) / 100));

      let kasaKotuYuzdesi = config.Kasa_Kotu || 0;
      if (selectedBrand?.toLowerCase() !== 'apple') {
          kasaKotuYuzdesi = config.Kasa_Kotu_Android !== undefined ? config.Kasa_Kotu_Android : (config.Kasa_Kotu || 0);
      }
      if (status.cosmetic === 'Kötü') price *= (1 - (kasaKotuYuzdesi / 100));

      if (status.faceId === 'Hayır') price *= (1 - ((config.FaceID_Bozuk || 0) / 100));
      if (status.battery === '0-85') price *= (1 - ((config.Pil_Dusuk || 0) / 100));
      if (status.battery === 'Bilinmeyen Parça') price *= (1 - ((config.Bilinmeyen_Batarya || 15) / 100));
      if (status.sim === 'Fiziksel + eSIM (YD)') price *= (1 - ((config.Yurt_Disi || 0) / 100));
      if (status.warranty === 'Yenilenmiş Cihaz') price *= (1 - ((config.Yenilenmis || 0) / 100));
      if (status.warranty === 'Garanti Yok') price *= (1 - ((config.Garanti_Yok || 0) / 100));

      if (status.speaker === 'Cızırtı var') price -= 500;
      if (status.speaker === 'Arızalı') price -= 1000;

      let colorBonus = 1;
      
      const isPerfectCondition = 
        status.cosmetic === 'Mükemmel' && 
        status.screen === 'Sağlam' && 
        (status.battery === '95-100' || status.battery === '85-95');

      if (selectedModelName === "iPhone 13" && selectedColor === 'Beyaz' && isPerfectCondition) {
        colorBonus = 1.05; 
      }

      let finalCash = Math.max(Math.round(price * colorBonus), selectedCapacity.minPrice || 0);

      if (selectedBranch === 'VODAFONE KANALI' || selectedBranch === 'ZUMAY KANALI') {
          finalCash = Math.round(finalCash * 0.92);
      }

      let baremKesintisiYuzdesi = 0;

      if (finalCash > 50000) {
          baremKesintisiYuzdesi = config.Barem_50k_Uzeri !== undefined ? Number(config.Barem_50k_Uzeri) : 3;
      } else if (finalCash >= 25000 && finalCash <= 50000) {
          baremKesintisiYuzdesi = config.Barem_25k_50k !== undefined ? Number(config.Barem_25k_50k) : 7.5;
      } else if (finalCash >= 1000 && finalCash < 25000) {
          baremKesintisiYuzdesi = config.Barem_1k_25k !== undefined ? Number(config.Barem_1k_25k) : 12.5;
      }

      if (baremKesintisiYuzdesi > 0) {
          const kesilecekTutar = finalCash * (baremKesintisiYuzdesi / 100);
          finalCash = Math.round(finalCash - kesilecekTutar);
      }

      let takasDestekYuzdesi = 0;
      
      if (finalCash > 50000) {
          takasDestekYuzdesi = config.Takas_Barem_50k_Uzeri !== undefined ? Number(config.Takas_Barem_50k_Uzeri) : 3;
      } else if (finalCash >= 25000 && finalCash <= 50000) {
          takasDestekYuzdesi = config.Takas_Barem_25k_50k !== undefined ? Number(config.Takas_Barem_25k_50k) : 7.5;
      } else if (finalCash >= 1000 && finalCash < 25000) {
          takasDestekYuzdesi = config.Takas_Barem_1k_25k !== undefined ? Number(config.Takas_Barem_1k_25k) : 12.5;
      }

      const finalTrade = Math.round(finalCash * (1 + (takasDestekYuzdesi / 100)));
      setPrices({ cash: finalTrade > 0 ? finalCash : 0, trade: finalTrade > 0 ? finalTrade : 0 });
      
      if (customOffer && parseInt(customOffer) > finalCash) {
          setCustomOffer(finalCash.toString());
      }
      
      if (customTradeOffer && parseInt(customTradeOffer) > finalTrade) {
          setCustomTradeOffer(finalTrade.toString());
      }
    }
  }, [status, selectedCapacity, config, selectedColor, selectedModelName, selectedBranch, selectedBrand]); 

  const finalCashPrice = isCustomOfferActive && customOffer ? Math.min(parseInt(customOffer) || 0, prices.cash) : prices.cash;

  let disTakasYuzdesi = 0;
  if (finalCashPrice > 50000) {
      disTakasYuzdesi = config.Takas_Barem_50k_Uzeri !== undefined ? Number(config.Takas_Barem_50k_Uzeri) : 3;
  } else if (finalCashPrice >= 25000 && finalCashPrice <= 50000) {
      disTakasYuzdesi = config.Takas_Barem_25k_50k !== undefined ? Number(config.Takas_Barem_25k_50k) : 7.5;
  } else if (finalCashPrice >= 1000 && finalCashPrice < 25000) {
      disTakasYuzdesi = config.Takas_Barem_1k_25k !== undefined ? Number(config.Takas_Barem_1k_25k) : 12.5;
  }

  const calculatedTradePrice = Math.round(finalCashPrice * (1 + (disTakasYuzdesi / 100)));
  const finalTradePrice = isCustomTradeOfferActive && customTradeOffer ? Math.min(parseInt(customTradeOffer) || 0, calculatedTradePrice) : calculatedTradePrice;

  const handleFinalProcess = async (actionType: 'print' | 'whatsapp' | 'NAKİT ALINDI' | 'TAKAS ALINDI' | 'ALINMADI') => {
    const now = new Date();
    const dateFormatter = new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit' });
    const timeFormatter = new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    const dateStr = dateFormatter.format(now);
    const timeStr = timeFormatter.format(now).replace(',', '');
    const dateTime = `${dateStr} ${timeStr}`;
    
    let actionLabel = actionType;
    if (actionType === 'print' || actionType === 'whatsapp') {
        actionLabel = purchaseType === 'NAKİT' ? 'NAKİT ALINDI' : 'TAKAS ALINDI';
    }

    const statusLabel = ` [${actionLabel}]`;
    const colorLabel = selectedModelName === "iPhone 13" ? ` - Renk: ${selectedColor}` : "";

    const ekspertizStr = [
      status.power ? `Güç:${status.power}` : '',
      status.screen ? `Ekran:${status.screen}` : '',
      status.cosmetic ? `Kasa:${status.cosmetic}` : '',
      status.battery ? `Pil:${status.battery}` : '',
      status.faceId ? `FaceID:${status.faceId}` : '',
      status.speaker ? `Ahize:${status.speaker}` : '',
      status.sim ? `Kayıt:${status.sim}` : '',
      status.warranty ? `Garanti:${status.warranty}` : ''
    ].filter(Boolean).join(' | ');

    const devicePayload = `${selectedModelName} (${selectedCapacity?.cap})${colorLabel}${statusLabel} #EKSPERTİZ# ${ekspertizStr}`;

    if (actionType === 'NAKİT ALINDI' || actionType === 'TAKAS ALINDI' || actionType === 'ALINMADI') {
        try {
          await fetch('/api/panel-action', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: "SAVE_ALIM",
              branch: selectedBranch,
              customer: customer.name,
              device: devicePayload,
              imei: customer.imei,
              cash: finalCashPrice,
              trade: finalTradePrice,
              date: dateTime
            })
          });

          alert("Yönetici paneline gönderildi");
          setTimeout(() => { refreshDataCache(); }, 2500);

        } catch (e) { console.error(e); }
    }

    if (actionType === 'print') {
      window.print();
    } else if (actionType === 'whatsapp') {
      const branch = branches.find(b => b.name === selectedBranch) || branches[0];
      const priceText = purchaseType === 'NAKİT' 
          ? `💰 *NAKİT ALIM:* ${finalCashPrice.toLocaleString()} TL` 
          : `🔄 *TAKAS ALIM:* ${finalTradePrice.toLocaleString()} TL`;
          
      const message = `📱 *${isZumay ? 'ZUMAY' : 'CMR'} CİHAZ ALIM FORMU*%0A👤 *Müşteri:* ${customer.name}%0A🆔 *IMEI:* ${customer.imei}%0A📦 *Cihaz:* ${selectedModelName} (${selectedCapacity?.cap})${colorLabel}%0A${priceText}`;
      
      window.open(`https://wa.me/${branch?.phone}?text=${message}`, '_blank');
    }
  };

  const handleClearThhForm = () => setThhForm(initialThhForm);

  const handleSaveThh = async () => {
    if (!thhForm.adSoyad || !thhForm.basvuruTarihi) return alert("Tüketici Ad-Soyad ve Başvuru Tarihi zorunludur!");
    setThhSaving(true);
    try {
      await fetch('/api/panel-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: "SAVE_THH", data: thhForm })
      });
      alert("THH Kaydı Başarıyla Eklendi!");
      handleClearThhForm();
      setTimeout(refreshDataCache, 1500);
    } catch (e) { alert("Kaydedilirken hata oluştu."); }
    setThhSaving(false);
  };

  const handleUpdateThh = async () => {
    if (!thhForm.rowIndex) return;
    setThhSaving(true);
    try {
      await fetch('/api/panel-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: "UPDATE_THH", row: thhForm.rowIndex, data: thhForm })
      });
      alert("Kayıt Başarıyla Güncellendi!");
      handleClearThhForm();
      setTimeout(refreshDataCache, 1500);
    } catch (e) { alert("Güncellenirken hata oluştu."); }
    setThhSaving(false);
  };

  const handleDeleteThh = async () => {
    if (!thhForm.rowIndex) return;
    if (!confirm("Bu kaydı silmek istediğinize emin misiniz? Bu işlem geri alınamaz!")) return;
    setThhSaving(true);
    try {
      await fetch('/api/panel-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: "DELETE_THH", row: thhForm.rowIndex })
      });
      alert("Kayıt Başarıyla Silindi!");
      handleClearThhForm();
      setTimeout(refreshDataCache, 1500);
    } catch (e) { alert("Silinirken hata oluştu."); }
    setThhSaving(false);
  };

  const deleteAlim = async (sheetIdx: number) => {
    if(!confirm("Bu işlemi silmek istiyor musunuz?")) return;
    setAlimlar(prev => prev.filter(item => item.sheetIndex !== sheetIdx));
    try {
      await fetch('/api/panel-action', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ type: "DELETE_ALIM", index: sheetIdx }) 
      });
      setTimeout(refreshDataCache, 2000);
    } catch (e) { console.error(e); }
  };

  const deleteAllAlimlar = async () => {
    if(!confirm("DİKKAT! Tüm alım geçmişi silinecek. Onaylıyor musunuz?")) return;
    try {
      await fetch('/api/panel-action', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ type: "DELETE_ALL_ALIM" }) 
      });
      alert("Tüm geçmiş temizlendi.");
      refreshDataCache();
    } catch (e) { console.error(e); }
  };

  const updateConfig = async (key: string, val: string) => {
    try {
      await fetch('/api/panel-action', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ type: "UPDATE_CONFIG", key, val }) 
      });
      alert(`${key === 'Duyuru_Metni' ? 'Duyuru' : key === 'Kampanya_Metni' ? 'Kampanya' : key} başarıyla güncellendi!`);
      
      setConfig((prev: any) => {
          const newVal = isNaN(Number(val)) ? val : parseFloat(val);
          return {...prev, [key]: newVal};
      });
    } catch (e) { console.error(e); }
  };

  const adminAddDevice = async () => {
    if(!newDevice.name || !newDevice.base) return alert("Eksik bilgi!");
    try {
      await fetch('/api/panel-action', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ type: "ADD_DEVICE", ...newDevice }) 
      });
      alert("Cihaz başarıyla eklendi!");
      setNewDevice({ brand: 'Apple', name: '', cap: '', base: '', img: '', minPrice: '0' });
      setTimeout(refreshDataCache, 1500);
    } catch (e) { console.error(e); }
  };

  const handleImeiKullan = async (imei: string) => {
    const personelName = window.prompt("Lütfen isminizi giriniz:");
    if (!personelName || personelName.trim() === "") return;

    const durumText = `KULLANILDI - ${personelName.toUpperCase()}`;

    if (typeof window !== 'undefined') {
      const kayitVerisi = { durum: durumText, timestamp: new Date().getTime() };
      localStorage.setItem('kullanilan_imei_' + imei, JSON.stringify(kayitVerisi));
    }

    setImeiData(prev => {
        const newData = [...prev];
        const rowIndex = newData.findIndex(r => r[1] === imei);
        if (rowIndex !== -1) {
            newData[rowIndex][2] = durumText;
        }
        return newData;
    });

    try {
      await fetch('/api/panel-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          type: "USE_IMEI", 
          imei: imei, 
          personel: personelName.toUpperCase() 
        })
      });
    } catch (e) {
      console.error("IMEI kaydedilirken hata:", e);
      alert("Bağlantı hatası! Lütfen internetinizi kontrol edin.");
    }
  };

  const handleSendInstallmentToWhatsApp = (month: number, totalAmount: number) => {
    if (!customer.name || !customer.phone) {
      alert("Lütfen önce yukarıdaki Müşteri Adı Soyadı ve Telefon Numarası alanlarını doldurunuz.");
      return;
    }
    const formatliTutar = totalAmount.toLocaleString('tr-TR', { maximumFractionDigits: 0 });
    const message = `Müşteri: ${customer.name}\nTel: ${customer.phone}\nTaksit: ${month} Taksit ${formatliTutar} TL`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
  };

  const handleServisWhatsApp = () => {
    const sFiyat = servisFiyatlari[selectedModelName];
    if (!sFiyat) return alert("Bu cihaz için fiyat girilmemiş.");
    const branch = branches.find(b => b.name === selectedBranch) || branches[0];
    
    const orjinalEkran = sFiyat.ekranOrj || sFiyat.ekran || '-';
    
    let ekranText = `📱 Ekran (Orijinal): ${orjinalEkran !== '-' ? orjinalEkran + ' TL' : '-'}%0A📱 Ekran (OLED): ${sFiyat.ekranOled ? sFiyat.ekranOled + ' TL' : '-'}`;
    
    if (selectedBrand?.toLowerCase() === 'apple') {
        ekranText += `%0A📱 Ekran (Çipli): ${sFiyat.ekranCipli ? sFiyat.ekranCipli + ' TL' : '-'}`;
    }

    const message = `🔧 *CMR TEKNİK SERVİS TEKLİFİ*%0A📱 *Cihaz:* ${selectedModelName}%0A%0A*Onarım Fiyatları:*%0A${ekranText}%0A🔋 Batarya Değişimi: ${sFiyat.batarya || '-'} TL%0A💠 Arka Cam Değişimi: ${sFiyat.arkaCam || '-'} TL%0A🛠 Kasa Değişimi: ${sFiyat.kasa || '-'} TL%0A%0A🕒 _Fiyatlarımız anlık olup değişkenlik gösterebilir._`;
    window.open(`https://wa.me/${branch?.phone}?text=${message}`, '_blank');
  };

  const menuGroups = [
    {
      title: "ANA MODÜLLER",
      items: [
        { id: 'ana_sayfa', label: 'Ana Sayfa', visible: true },
        { id: 'alim', label: 'Cihaz Alım', visible: true },
        { id: 'servis', label: 'Teknik Servis', visible: selectedBranch !== 'VODAFONE KANALI' && !isZumay },
        { id: 'thh', label: 'THH Takip', visible: isMasterAccess }
      ]
    },
    {
      title: "FİYAT LİSTELERİ",
      items: [
        { id: 'cep_tablet', label: 'Cep + Tablet', visible: !isZumay },
        { id: 'yna_list', label: 'YNA List', visible: !isZumay },
        { id: 'dis_kanal', label: 'Dış Kanal', visible: true },
        { 
          id: 'kampanya_sifir', 
          label: (
            <div className="flex flex-col items-center justify-center -space-y-0.5">
              <span className="font-black tracking-widest">KAMPANYALI</span>
              <span className="text-[9px] font-bold opacity-75">SIFIR LİSTE</span>
            </div>
          ), 
          visible: selectedBranch !== 'VODAFONE KANALI' && !isZumay 
        },
        { 
          id: 'ikinci_el', 
          label: '2. El Listesi', 
          visible: selectedBranch !== 'VODAFONE KANALI' && !isZumay,
          subItems: [
            { id: 'ikinci_el_apple', label: 'Apple Liste' },
            { id: 'ikinci_el_android', label: 'Android Liste' }
          ]
        },
        {
          id: 'cihaz_talep',
          label: 'Cihaz Talep',
          visible: selectedBranch !== 'VODAFONE KANALI' && !isZumay,
          branchItems: [
            { code: 'CNET', label: 'CNET', detail: 'Merkez Depo' },
            { code: 'CMR', label: 'CMR', detail: 'CMR Mağaza' },
            { code: 'CADDE', label: 'CADDE', detail: 'Cadde Mağaza' },
            { code: 'KAPAKLI', label: 'KAPAKLI', detail: 'Kapaklı Mağaza' },
            { code: 'SARAY', label: 'SARAY', detail: 'Saray Mağaza' }
          ]
        },
        { id: 'imei_list', label: 'Depo', visible: selectedBranch === 'VODAFONE KANALI' && !isZumay }
      ]
    }
  ];

  const topActiveRequestCount = cihazTalepData
    .slice(1)
    .filter((row: any[]) => {
      const branch = String(row?.[9] || '').trim();
      const statusText = String(row?.[11] || '')
        .trim()
        .toLocaleUpperCase('tr-TR');

      return (
        branch !== '' &&
        statusText !== 'GÖNDERİLDİ' &&
        statusText !== 'GONDERILDI' &&
        statusText !== 'RED EDİLDİ' &&
        statusText !== 'REDDEDİLDİ'
      );
    }).length;

  const branchInitials = String(selectedBranch || 'CMR')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')
    .toLocaleUpperCase('tr-TR')
    .slice(0, 2);

  const handleTopQuickSearch = () => {
    const q = topQuickSearch.trim();
    if (!q) return;

    if (appMode === 'cihaz_talep') {
      setCihazTalepSearch(q);
      setCihazTalepPage(1);
      return;
    }

    setSearchQuery(q);
  };

  const navIcon = (id: string) => {
    const common = "h-4 w-4";

    switch (id) {
      case 'ana_sayfa':
        return (
          <svg className={common} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 11l9-8 9 8v9a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1v-9z" />
          </svg>
        );
      case 'alim':
        return (
          <svg className={common} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7h16v12H4zM8 3h8v4H8zM8 11h8" />
          </svg>
        );
      case 'servis':
        return (
          <svg className={common} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.7 6.3a4 4 0 01-5 5L4 17l3 3 5.7-5.7a4 4 0 005-5l-3 3-3-3 3-3z" />
          </svg>
        );
      case 'thh':
        return (
          <svg className={common} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 4h12v16H6zM9 8h6M9 12h6M9 16h4" />
          </svg>
        );
      case 'cep_tablet':
        return (
          <svg className={common} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <rect x="7" y="2" width="10" height="20" rx="2" strokeWidth="2" />
            <path strokeLinecap="round" strokeWidth="2" d="M11 18h2" />
          </svg>
        );
      case 'yna_list':
        return (
          <svg className={common} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h5" />
          </svg>
        );
      case 'dis_kanal':
        return (
          <svg className={common} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7h18l-2 12H5L3 7zM8 7V5a4 4 0 018 0v2" />
          </svg>
        );
      case 'kampanya_sifir':
        return (
          <svg className={common} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3l2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 15.4 7.2 18l.9-5.4-3.9-3.8 5.4-.8L12 3z" />
          </svg>
        );
      case 'ikinci_el':
        return (
          <svg className={common} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12a8 8 0 0114-5M20 12a8 8 0 01-14 5M18 3v4h-4M6 21v-4h4" />
          </svg>
        );
      case 'cihaz_talep':
        return (
          <svg className={common} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
        );
      case 'imei_list':
        return (
          <svg className={common} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h8" />
          </svg>
        );
      default:
        return (
          <svg className={common} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="7" strokeWidth="2" />
          </svg>
        );
    }
  };

  const isYd = status.sim === 'Fiziksel + eSIM (YD)';
  const allSelected = Object.values(status).every(v => v !== null) && selectedCapacity;
  const canProceed = allSelected;
  const showDocs = purchaseType === 'NAKİT' || purchaseType === 'TAKAS';

  const baseBrands = ["Apple", "Samsung", "Xiaomi"];
  const displayBrands = Array.from(new Set([...baseBrands, ...brandDb.map(b => b.name), ...db.map(i => i.brand)]))
      .filter(brand => brand && brand.trim() !== "" && brand.toLowerCase() !== "marka");

  const getOffsetDate = (offsetDays: number) => {
    const d = new Date();
    d.setDate(d.getDate() - offsetDays);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const todayStr = getOffsetDate(0);
  const yesterdayStr = getOffsetDate(1);
  const dayBeforeYesterdayStr = getOffsetDate(2);

  const filteredAlimlar = [...alimlar].reverse().filter(item => {
      if (adminSelectedBranch !== 'TÜM ŞUBELER') {
          let foundBranch = null;
          for (let i = 0; i < item.data.length; i++) {
              if (typeof item.data[i] === 'string' && (item.data[i].includes("CMR ") || item.data[i].includes("VODAFONE ") || item.data[i].includes("ZUMAY "))) {
                  foundBranch = item.data[i];
                  break;
              }
          }
          if (foundBranch !== adminSelectedBranch) return false;
      }

      if (dateFilterType !== 'TÜM ZAMANLAR') {
          let rawDate = String(item.data[6] || item.data[7] || '');
          for (let j = item.data.length - 1; j >= 0; j--) {
              const val = String(item.data[j] || '');
              if (val.includes('.') && val.includes(':') && val.length > 10 && /\d/.test(val)) {
                  rawDate = val; break;
              }
          }
          
          const datePart = rawDate.split(' ')[0];
          let itemDateFormatted = '';
          
          if (datePart && datePart.includes('.')) {
              const [d, m, y] = datePart.split('.');
              if(y && m && d) itemDateFormatted = `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
          } else if (datePart && datePart.includes('/')) {
              const parts = datePart.split('/');
              if (parts.length === 3) {
                  const [m, d, y] = parts;
                  itemDateFormatted = `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
              }
          }

          if (!itemDateFormatted) return false;

          if (dateFilterType === 'BUGÜN' && itemDateFormatted !== todayStr) return false;
          if (dateFilterType === 'DÜN' && itemDateFormatted !== yesterdayStr) return false;
          if (dateFilterType === 'ÖNCEKİ GÜN' && itemDateFormatted !== dayBeforeYesterdayStr) return false;
          if (dateFilterType === 'ÖZEL') {
              if (customStartDate && itemDateFormatted < customStartDate) return false;
              if (customEndDate && itemDateFormatted > customEndDate) return false;
          }
      }
      return true;
  });

  let dashboardStats = { alindi: 0, alinmadi: 0, diger: 0, total: 0 };
  filteredAlimlar.forEach(item => {
      dashboardStats.total += 1;
      const rowDataString = item.data.join(" ");
      if (rowDataString.includes('[NAKİT ALINDI]') || rowDataString.includes('[TAKAS ALINDI]') || rowDataString.includes('[ALINDI]')) {
          dashboardStats.alindi += 1;
      } else if (rowDataString.includes('[ALINMADI]')) {
          dashboardStats.alinmadi += 1;
      } else {
          dashboardStats.diger += 1;
      }
  });

  if (authLoading) return (
    <div className="h-screen flex flex-col items-center justify-center bg-slate-900 space-y-4">
      <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      <div className="font-black text-white italic uppercase tracking-[0.3em]">OTURUM KONTROL EDİLİYOR...</div>
    </div>
  );

  if (loading && isLoggedIn) return (
    <div className="h-screen flex flex-col items-center justify-center bg-white space-y-4">
      <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      <div className="font-black text-slate-900 italic uppercase tracking-[0.3em]">SİSTEM YÜKLENİYOR...</div>
    </div>
  );

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-[#edf2f7] px-4 py-6 sm:px-6 lg:px-8 flex items-center justify-center font-sans">
        <div className="w-full max-w-[1180px] min-h-[690px] overflow-hidden rounded-[28px] bg-white shadow-[0_30px_80px_rgba(15,23,42,0.18)] border border-slate-200 grid lg:grid-cols-[0.9fr_1.1fr]">
          {/* SOL MARKA ALANI */}
          <aside className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-[#07192d] px-12 py-12 text-white">
            <div className="absolute inset-0 opacity-100" style={{ background: 'radial-gradient(circle at 18% 18%, rgba(59,130,246,0.24), transparent 34%), radial-gradient(circle at 80% 72%, rgba(30,64,175,0.22), transparent 38%), linear-gradient(145deg, #07192d 0%, #0b223d 55%, #061426 100%)' }} />
            <div className="absolute -right-20 top-16 h-80 w-44 rotate-[22deg] rounded-[42px] border border-white/10 bg-white/[0.035] shadow-2xl" />
            <div className="absolute right-20 top-48 h-72 w-40 -rotate-[17deg] rounded-[38px] border border-white/10 bg-white/[0.025]" />
            <div className="absolute -left-16 bottom-28 h-64 w-36 rotate-[20deg] rounded-[34px] border border-white/10 bg-white/[0.025]" />

            <div className="relative z-10">
              <img
                src={'/cnet.png' as string}
                alt="CNETMOBİL"
                className="h-[48px] w-auto object-contain brightness-0 invert"
              />
              <div className="mt-3 text-[15px] tracking-[0.02em] text-white/75">Partner Yönetim Sistemi</div>
            </div>

            <div className="relative z-10 max-w-[340px] pb-3">
              <div className="mb-6 h-px w-16 bg-blue-400/80" />
              <h2 className="text-[34px] font-semibold leading-[1.5] tracking-[-0.02em]">
                Daha Güçlü<br />
                Daha Kârlı<br />
                Birlikte Büyüyoruz
              </h2>
              <p className="mt-5 text-sm leading-6 text-white/55">
                CNETMOBİL operasyonlarını güvenli ve merkezi bir panelden yönetin.
              </p>
            </div>
          </aside>

          {/* SAĞ GİRİŞ ALANI */}
          <main className="flex items-center justify-center bg-white px-6 py-10 sm:px-10 lg:px-16">
            <div className="w-full max-w-[500px]">
              <div className="mb-9 lg:hidden">
                <img
                  src={'/cnet.png' as string}
                  alt="CNETMOBİL"
                  className="h-[40px] w-auto object-contain"
                />
                <div className="mt-2 text-xs font-medium tracking-wide text-slate-500">Partner Yönetim Sistemi</div>
              </div>

              {authView === 'login' ? (
                <>
                  <div className="mb-8">
                    <h1 className="text-[30px] font-bold tracking-[-0.03em] text-slate-950">Hoş Geldiniz</h1>
                    <p className="mt-2 text-[14px] text-slate-500">
                      CNETMOBİL hesabınızın e-posta ve şifresiyle güvenli giriş yapın.
                    </p>
                  </div>

                  <div className="mb-5">
                    <label className="mb-2 block text-[12px] font-medium text-slate-500">E-posta adresiniz</label>
                    <div className="relative">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex w-12 items-center justify-center text-slate-400">
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 6.75A2.75 2.75 0 015.75 4h12.5A2.75 2.75 0 0121 6.75v10.5A2.75 2.75 0 0118.25 20H5.75A2.75 2.75 0 013 17.25V6.75z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 7l8 6 8-6" />
                        </svg>
                      </div>
                      <input
                        type="email"
                        autoComplete="email"
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                        disabled={loginLoading}
                        placeholder="ornek@cnetmobil.com.tr"
                        className="h-[52px] w-full rounded-xl border border-slate-200 bg-white pl-12 pr-4 text-[14px] text-slate-900 outline-none transition placeholder:text-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 disabled:opacity-60"
                      />
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="mb-2 block text-[12px] font-medium text-slate-500">
                      Şifreniz
                    </label>
                    <div className="relative">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex w-12 items-center justify-center text-slate-400">
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                          <rect x="5" y="10" width="14" height="10" rx="2" />
                          <path strokeLinecap="round" d="M8 10V7a4 4 0 018 0v3" />
                        </svg>
                      </div>
                      <input
                        type={showLoginPassword ? 'text' : 'password'}
                        autoComplete="current-password"
                        value={entryPass}
                        onChange={(e) => setEntryPass(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                        disabled={loginLoading}
                        placeholder="••••••••••"
                        className="h-[52px] w-full rounded-xl border border-slate-200 bg-white pl-12 pr-12 text-[15px] text-slate-900 outline-none transition placeholder:tracking-[0.18em] placeholder:text-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 disabled:opacity-60"
                      />
                      <button
                        type="button"
                        onClick={() => setShowLoginPassword((v) => !v)}
                        className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-slate-400 transition hover:text-blue-600"
                        aria-label={showLoginPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
                      >
                        {showLoginPassword ? (
                          <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18M10.6 10.7A2 2 0 0013.3 13.4M9.9 4.2A10.6 10.6 0 0112 4c5.2 0 8.7 4.1 9 8a10.6 10.6 0 01-2.2 4.8M6.1 6.1C4.2 7.5 3.2 9.6 3 12c.3 3.9 3.8 8 9 8 1.3 0 2.5-.3 3.5-.7" />
                          </svg>
                        ) : (
                          <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 12s3-7 9-7 9 7 9 7-3 7-9 7-9-7-9-7z" />
                            <circle cx="12" cy="12" r="2.5" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="mb-6 flex min-h-7 items-center justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setForgotEmail(loginEmail);
                        setForgotMessage('');
                        setAuthView('forgot');
                      }}
                      className="text-[13px] font-medium text-blue-600 hover:text-blue-700 hover:underline"
                    >
                      Şifremi Unuttum?
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleLogin}
                    disabled={loginLoading || !entryPass || !loginEmail.trim()}
                    className="flex h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-blue-600 text-[14px] font-semibold text-white shadow-[0_12px_28px_rgba(37,99,235,0.24)] transition hover:bg-blue-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {loginLoading ? (
                      <>
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                        Kontrol Ediliyor...
                      </>
                    ) : (
                      <>
                        GİRİŞ YAP
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14m-5-5l5 5-5 5" />
                        </svg>
                      </>
                    )}
                  </button>

                  <div className="mt-10 flex items-center gap-4 text-[11px] text-slate-300">
                    <div className="h-px flex-1 bg-slate-100" />
                    <span>güvenli bağlantı</span>
                    <div className="h-px flex-1 bg-slate-100" />
                  </div>

                  <div className="mt-7 text-center text-[11px] font-medium tracking-wide text-slate-400">
                    CNETMOBİL Partner Yönetim Sistemi
                  </div>
                </>
              ) : authView === 'forgot' ? (
                <>
                  <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                    <svg className="h-9 w-9" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 6.75A2.75 2.75 0 015.75 4h12.5A2.75 2.75 0 0121 6.75v10.5A2.75 2.75 0 0118.25 20H5.75A2.75 2.75 0 013 17.25V6.75z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 7l8 6 8-6" />
                    </svg>
                  </div>

                  <div className="mb-8 text-center">
                    <h1 className="text-[30px] font-bold tracking-[-0.03em] text-slate-950">Şifremi Unuttum</h1>
                    <p className="mx-auto mt-3 max-w-[390px] text-[14px] leading-6 text-slate-500">
                      Hesabınıza ait e-posta adresini girin. Şifre sıfırlama bağlantısı e-posta adresinize gönderilecek.
                    </p>
                  </div>

                  <div className="mb-5">
                    <label className="mb-2 block text-[12px] font-medium text-slate-500">E-posta adresiniz</label>
                    <div className="relative">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex w-12 items-center justify-center text-slate-400">
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 6.75A2.75 2.75 0 015.75 4h12.5A2.75 2.75 0 0121 6.75v10.5A2.75 2.75 0 0118.25 20H5.75A2.75 2.75 0 013 17.25V6.75z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 7l8 6 8-6" />
                        </svg>
                      </div>
                      <input
                        type="email"
                        value={forgotEmail}
                        onChange={(e) => {
                          setForgotEmail(e.target.value);
                          setForgotMessage('');
                        }}
                        onKeyDown={(e) => e.key === 'Enter' && handleForgotPassword()}
                        placeholder="ornek@cnetmobil.com.tr"
                        className="h-[52px] w-full rounded-xl border border-slate-200 bg-white pl-12 pr-4 text-[14px] text-slate-900 outline-none transition placeholder:text-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                      />
                    </div>
                  </div>

                  {forgotMessage && (
                    <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] leading-5 text-amber-800">
                      {forgotMessage}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    disabled={!forgotEmail.trim() || forgotLoading}
                    className="flex h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-blue-600 text-[14px] font-semibold text-white shadow-[0_12px_28px_rgba(37,99,235,0.24)] transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {forgotLoading ? (
                      <>
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                        GÖNDERİLİYOR...
                      </>
                    ) : (
                      'SIFIRLAMA LİNKİ GÖNDER'
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setAuthView('login');
                      setForgotMessage('');
                    }}
                    className="mt-7 flex items-center gap-2 text-[13px] font-medium text-blue-600 hover:text-blue-700"
                  >
                    <span>←</span> Giriş sayfasına dön
                  </button>

                  <div className="mt-12 text-center text-[11px] font-medium tracking-wide text-slate-400">
                    CNETMOBİL Partner Yönetim Sistemi
                  </div>
                </>
              ) : (
                <>
                  <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                    <svg className="h-9 w-9" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                      <rect x="5" y="10" width="14" height="10" rx="2" />
                      <path strokeLinecap="round" d="M8 10V7a4 4 0 018 0v3" />
                    </svg>
                  </div>

                  <div className="mb-7 text-center">
                    <h1 className="text-[30px] font-bold tracking-[-0.03em] text-slate-950">Yeni Şifre Belirle</h1>
                    <p className="mx-auto mt-3 max-w-[390px] text-[14px] leading-6 text-slate-500">
                      Lütfen yeni şifrenizi belirleyin.
                    </p>
                  </div>

                  {!resetSuccess && (
                    <>
                      <div className="mb-4">
                        <label className="mb-2 block text-[12px] font-medium text-slate-500">Yeni Şifre</label>
                        <div className="relative">
                          <input
                            type={showNewPassword ? 'text' : 'password'}
                            value={newPassword}
                            onChange={(e) => {
                              setNewPassword(e.target.value);
                              setResetMessage('');
                            }}
                            autoComplete="new-password"
                            placeholder="••••••••••"
                            className="h-[52px] w-full rounded-xl border border-slate-200 bg-white px-4 pr-12 text-[15px] text-slate-900 outline-none transition placeholder:tracking-[0.18em] placeholder:text-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                          />
                          <button
                            type="button"
                            onClick={() => setShowNewPassword((v) => !v)}
                            className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-slate-400 transition hover:text-blue-600"
                          >
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3 12s3-7 9-7 9 7 9 7-3 7-9 7-9-7-9-7z" />
                              <circle cx="12" cy="12" r="2.5" />
                            </svg>
                          </button>
                        </div>
                      </div>

                      <div className="mb-5">
                        <label className="mb-2 block text-[12px] font-medium text-slate-500">Yeni Şifre Tekrar</label>
                        <input
                          type={showNewPassword ? 'text' : 'password'}
                          value={newPasswordAgain}
                          onChange={(e) => {
                            setNewPasswordAgain(e.target.value);
                            setResetMessage('');
                          }}
                          onKeyDown={(e) => e.key === 'Enter' && handleResetPassword()}
                          autoComplete="new-password"
                          placeholder="••••••••••"
                          className="h-[52px] w-full rounded-xl border border-slate-200 bg-white px-4 text-[15px] text-slate-900 outline-none transition placeholder:tracking-[0.18em] placeholder:text-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                        />
                      </div>

                      <div className="mb-5 space-y-2 text-[12px]">
                        <div className={newPassword.length >= 8 ? 'text-emerald-600' : 'text-slate-400'}>✓ En az 8 karakter olmalı</div>
                        <div className={/[A-ZÇĞİÖŞÜ]/.test(newPassword) ? 'text-emerald-600' : 'text-slate-400'}>✓ Büyük harf içermeli</div>
                        <div className={/[a-zçğıöşü]/.test(newPassword) ? 'text-emerald-600' : 'text-slate-400'}>✓ Küçük harf içermeli</div>
                        <div className={/[0-9]/.test(newPassword) ? 'text-emerald-600' : 'text-slate-400'}>✓ Rakam içermeli</div>
                      </div>
                    </>
                  )}

                  {resetMessage && (
                    <div className={`mb-5 rounded-xl border px-4 py-3 text-[13px] leading-5 ${resetSuccess ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
                      {resetMessage}
                    </div>
                  )}

                  {!resetSuccess ? (
                    <button
                      type="button"
                      onClick={handleResetPassword}
                      disabled={resetLoading || !newPassword || !newPasswordAgain}
                      className="flex h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-blue-600 text-[14px] font-semibold text-white shadow-[0_12px_28px_rgba(37,99,235,0.24)] transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {resetLoading ? (
                        <>
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                          DEĞİŞTİRİLİYOR...
                        </>
                      ) : (
                        'ŞİFREYİ DEĞİŞTİR'
                      )}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setAuthView('login');
                        setNewPassword('');
                        setNewPasswordAgain('');
                        setResetMessage('');
                        setResetSuccess(false);
                      }}
                      className="h-[52px] w-full rounded-xl bg-blue-600 text-[14px] font-semibold text-white shadow-[0_12px_28px_rgba(37,99,235,0.24)] transition hover:bg-blue-700"
                    >
                      GİRİŞ SAYFASINA DÖN
                    </button>
                  )}

                  <div className="mt-10 text-center text-[11px] font-medium tracking-wide text-slate-400">
                    CNETMOBİL Partner Yönetim Sistemi
                  </div>
                </>
              )}
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen font-sans selection:bg-blue-100 transition-colors duration-500 bg-[#F8FAFC] text-slate-900">
      <style>{`
        #print-area { display: none !important; }
        @media print {
          header, nav, main, footer, .print\\:hidden { display: none !important; }
          #print-area { display: block !important; visibility: visible !important; position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; background: white !important; color: black !important; margin: 0 !important; padding: 40px !important; }
          #print-area * { visibility: visible !important; }
        }
        .btn-click { transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); cursor: pointer; }
        .btn-click:active { transform: scale(0.96); }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94A3B8; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      {/* TOPBAR V2 */}
      <header
        className={`sticky top-0 z-[100] w-full print:hidden ${
          isZumay
            ? 'bg-gradient-to-r from-[#241719] via-[#301c20] to-[#241719]'
            : 'bg-gradient-to-r from-[#10233f] via-[#15345d] to-[#10233f]'
        } shadow-[0_10px_30px_rgba(15,23,42,0.22)]`}
      >
        {/* ÜST SATIR */}
        <div className="border-b border-white/10">
          <div className="mx-auto flex min-h-[64px] max-w-[1920px] items-center justify-between gap-4 px-4 lg:px-6">
            <button
              type="button"
              onClick={() => {
                resetAll();
                setAppMode('ana_sayfa');
              }}
              className="group flex shrink-0 items-center gap-3 text-left"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/10 transition group-hover:bg-white/15">
                <span className="text-sm font-black text-white">
                  {isZumay ? 'Z' : 'CM'}
                </span>
              </div>

              <div className="hidden sm:block">
                <div className="text-[22px] font-black leading-none tracking-tight text-white">
                  {isZumay ? (
                    'ZUMAY'
                  ) : (
                    <>
                      Cnet
                      <span className="text-blue-400">mobil</span>
                    </>
                  )}
                </div>

                <div className="mt-1 text-[7px] font-black uppercase tracking-[0.38em] text-blue-200/70">
                  Teknoloji Her Yerde
                </div>
              </div>
            </button>

            {!isZumay && step < 99 && (
              <div className="hidden min-w-0 flex-1 justify-center xl:flex">
                <div className="flex h-10 w-full max-w-[330px] items-center rounded-full border border-white/10 bg-white/10 px-4 shadow-inner transition focus-within:border-blue-300/40 focus-within:bg-white/15">
                  <svg
                    className="h-4 w-4 shrink-0 text-blue-100/70"
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
                    value={topQuickSearch}
                    onChange={(e) => setTopQuickSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleTopQuickSearch();
                      }
                    }}
                    placeholder="Hızlı ara..."
                    className="min-w-0 flex-1 bg-transparent px-3 text-[11px] font-bold text-white outline-none placeholder:text-blue-100/50"
                  />

                  <button
                    type="button"
                    onClick={handleTopQuickSearch}
                    className="rounded-full bg-white/10 px-2.5 py-1 text-[8px] font-black text-blue-100 hover:bg-white/20"
                  >
                    ARA
                  </button>
                </div>
              </div>
            )}

            <div className="flex shrink-0 items-center gap-2">
              {!isZumay && step < 99 && (
                <>
                  <button
                    onClick={() => setIsInstallmentModalOpen(true)}
                    className="hidden h-10 items-center gap-2 rounded-xl bg-amber-500 px-4 text-[9px] font-black uppercase tracking-wide text-white shadow-lg shadow-amber-950/10 transition hover:bg-amber-400 md:flex"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                    </svg>
                    Taksit Hesapla
                  </button>

                  <button
                    onClick={() => setIsKaskoModalOpen(true)}
                    className="hidden h-10 items-center gap-2 rounded-xl bg-violet-600 px-4 text-[9px] font-black uppercase tracking-wide text-white shadow-lg shadow-violet-950/10 transition hover:bg-violet-500 md:flex"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    Kasko Hesapla
                  </button>

                  <div className="relative hidden sm:block">
                    <button
                      type="button"
                      title="Aktif Talepler"
                      onClick={() => {
                        if (isMasterAccess || isAdmin || isSuperAdminUser) {
                          setAppMode('cihaz_talep');
                          setStep(1);
                          setCihazTalepOpenActiveSignal((value) => value + 1);
                        }
                      }}
                      className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/75 transition hover:bg-white/10 hover:text-white"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2a2 2 0 01-.6 1.4L4 17h5m2 0v1a1 1 0 002 0v-1" />
                      </svg>
                    </button>

                    {topActiveRequestCount > 0 && (
                      <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full border-2 border-[#15345d] bg-rose-500 px-1 text-[8px] font-black text-white">
                        {topActiveRequestCount > 99 ? '99+' : topActiveRequestCount}
                      </span>
                    )}
                  </div>
                </>
              )}

              <div className="hidden h-8 w-px bg-white/10 lg:block" />

              <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-1.5 pr-2">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-[10px] font-black text-white shadow-lg shadow-blue-950/20">
                  {branchInitials || 'CM'}
                </div>

                <div className="hidden min-w-[120px] md:block">
                  {isMasterAccess ? (
                    <select
                      value={selectedBranch}
                      onChange={(e) => setSelectedBranch(e.target.value)}
                      className="w-full cursor-pointer bg-transparent text-[10px] font-black text-white outline-none"
                    >
                      {branches.map((b) => (
                        <option key={b.name} value={b.name} className="text-slate-900">
                          {b.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="truncate text-[10px] font-black text-white">
                      {selectedBranch}
                    </div>
                  )}

                  <div className="mt-0.5 text-[8px] font-bold uppercase tracking-wider text-blue-200/60">
                    {isSuperAdminUser
                      ? 'Super Admin'
                      : isMasterAccess
                      ? 'CnetMobil Yönetici'
                      : 'Bayi Personeli'}
                  </div>
                </div>

                <svg className="hidden h-3 w-3 text-white/50 md:block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>

              {isSuperAdminUser && (
                <button
                  onClick={() => {
                    window.location.href = '/admin/users';
                  }}
                  title="Kullanıcılar & Yetkiler"
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-violet-200 transition hover:bg-violet-500/20 hover:text-white"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a4 4 0 00-4-4h-1M9 20H2v-2a4 4 0 014-4h3m6-4a4 4 0 11-8 0 4 4 0 018 0zm6 1a3 3 0 10-4.5-2.6" />
                  </svg>
                </button>
              )}

              {isAdmin && step < 99 && (
                <button
                  onClick={() => setStep(99)}
                  title="Yönetici Paneli"
                  className="hidden h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/60 transition hover:bg-white/10 hover:text-white sm:flex"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.3 4.3a1.7 1.7 0 013.4 0 1.7 1.7 0 002.6 1.1 1.7 1.7 0 012.4 2.4 1.7 1.7 0 001.1 2.6 1.7 1.7 0 010 3.4 1.7 1.7 0 00-1.1 2.6 1.7 1.7 0 01-2.4 2.4 1.7 1.7 0 00-2.6 1.1 1.7 1.7 0 01-3.4 0 1.7 1.7 0 00-2.6-1.1 1.7 1.7 0 01-2.4-2.4 1.7 1.7 0 00-1.1-2.6 1.7 1.7 0 010-3.4 1.7 1.7 0 001.1-2.6 1.7 1.7 0 012.4-2.4 1.7 1.7 0 002.6-1.1zM15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </button>
              )}

              <button
                onClick={handleLogout}
                title="Çıkış Yap"
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/55 transition hover:bg-rose-500/20 hover:text-rose-200"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* MODÜL NAVBAR */}
        <div className="border-b border-white/5 bg-black/5">
          <div className="mx-auto flex max-w-[1920px] items-stretch justify-start overflow-x-auto px-2 no-scrollbar lg:justify-center lg:px-5">
            {step < 99 &&
              menuGroups
                .flatMap((g) => g.items)
                .filter((i) => i.visible)
                .map((item) => {
                  const isActive =
                    appMode === item.id ||
                    (item.subItems &&
                      item.subItems.some((sub) => sub.id === appMode));

                  const openSecondHandMenu = () => {
                    const rect =
                      secondHandMenuButtonRef.current?.getBoundingClientRect();

                    if (rect) {
                      const width = 220;

                      setSecondHandMenuPos({
                        left: Math.max(
                          12,
                          Math.min(
                            window.innerWidth - width - 12,
                            rect.left + rect.width / 2 - width / 2
                          )
                        ),
                        top: rect.bottom + 3,
                        width,
                      });
                    }

                    setMobileSubMenuOpen(true);
                  };

                  const openCihazTalepMenu = () => {
                    const rect =
                      cihazTalepMenuButtonRef.current?.getBoundingClientRect();

                    if (rect) {
                      const width = 240;

                      setCihazTalepMenuPos({
                        left: Math.max(
                          12,
                          Math.min(
                            window.innerWidth - width - 12,
                            rect.left + rect.width / 2 - width / 2
                          )
                        ),
                        top: rect.bottom + 3,
                        width,
                      });
                    }

                    setCihazTalepMenuOpen(true);
                  };

                  return (
                    <div
                      key={item.id}
                      className="group relative flex min-w-fit items-stretch"
                      onMouseEnter={() => {
                        if (typeof window === 'undefined' || window.innerWidth < 1024) {
                          return;
                        }

                        if (item.subItems) {
                          openSecondHandMenu();
                        }

                        if (item.branchItems) {
                          openCihazTalepMenu();
                        }
                      }}
                      onMouseLeave={() => {
                        if (typeof window === 'undefined' || window.innerWidth < 1024) {
                          return;
                        }

                        if (item.subItems) {
                          setMobileSubMenuOpen(false);
                        }

                        if (item.branchItems) {
                          setCihazTalepMenuOpen(false);
                        }
                      }}
                    >
                      {item.branchItems ? (
                        <>
                          <button
                            ref={cihazTalepMenuButtonRef}
                            type="button"
                            onClick={() => {
                              if (typeof window !== 'undefined' && window.innerWidth < 1024) {
                                setCihazTalepMenuOpen((open) => !open);
                                return;
                              }

                              openCihazTalepMenu();
                            }}
                            className={`relative flex min-w-[92px] flex-col items-center justify-center gap-1 px-3 py-2.5 text-[8px] font-black uppercase tracking-wide transition lg:min-w-[108px] lg:px-4 ${
                              isActive
                                ? 'bg-blue-500/20 text-white'
                                : 'text-blue-100/65 hover:bg-white/5 hover:text-white'
                            }`}
                          >
                            <span
                              className={`flex h-7 w-7 items-center justify-center rounded-lg transition ${
                                isActive ? 'bg-blue-500 text-white' : 'bg-white/5'
                              }`}
                            >
                              {navIcon(item.id)}
                            </span>

                            <span className="flex items-center gap-1 whitespace-nowrap">
                              Cihaz Talep
                              <svg
                                className={`h-2.5 w-2.5 opacity-60 transition-transform ${
                                  cihazTalepMenuOpen ? 'rotate-180' : ''
                                }`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M19 9l-7 7-7-7"
                                />
                              </svg>
                            </span>

                            {isActive && (
                              <span className="absolute inset-x-2 bottom-0 h-[3px] rounded-t-full bg-gradient-to-r from-blue-400 via-cyan-300 to-fuchsia-400" />
                            )}
                          </button>

                          {cihazTalepMenuOpen && (
                            <div
                              className="fixed z-[99999] hidden overflow-hidden rounded-xl border border-white/10 bg-[#10233f] py-1.5 shadow-2xl ring-1 ring-black/15 lg:flex lg:flex-col"
                              style={{
                                left: cihazTalepMenuPos.left,
                                top: cihazTalepMenuPos.top,
                                width: cihazTalepMenuPos.width,
                              }}
                            >
                              <div className="border-b border-white/10 px-4 py-2.5">
                                <div className="text-[8px] font-black uppercase tracking-[0.18em] text-blue-200/55">
                                  Cihaz Talep
                                </div>
                                <div className="mt-0.5 text-[10px] font-black text-white">
                                  Mağaza Seç
                                </div>
                              </div>

                              {item.branchItems.map((branchItem) => {
                                const branchActive =
                                  appMode === 'cihaz_talep' &&
                                  cihazTalepSourceBranch === branchItem.code;

                                return (
                                  <button
                                    type="button"
                                    key={branchItem.code}
                                    onClick={() => {
                                      setCihazTalepSourceBranch(
                                        branchItem.code as
                                          | 'CNET'
                                          | 'CMR'
                                          | 'CADDE'
                                          | 'KAPAKLI'
                                          | 'SARAY'
                                      );
                                      setAppMode('cihaz_talep');
                                      setStep(1);
                                      resetSelection();
                                      setCihazTalepMenuOpen(false);
                                    }}
                                    className={`group/sub flex items-center justify-between gap-3 px-4 py-3 text-left transition ${
                                      branchActive
                                        ? 'bg-blue-500/20'
                                        : 'hover:bg-white/10'
                                    }`}
                                  >
                                    <div className="min-w-0">
                                      <div
                                        className={`text-[10px] font-black uppercase tracking-wide ${
                                          branchActive
                                            ? 'text-blue-200'
                                            : 'text-white/90 group-hover/sub:text-white'
                                        }`}
                                      >
                                        {branchItem.label}
                                      </div>

                                      <div className="mt-0.5 text-[8px] font-bold text-blue-100/45">
                                        {branchItem.detail}
                                      </div>
                                    </div>

                                    <div
                                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[10px] font-black transition ${
                                        branchActive
                                          ? 'bg-blue-500 text-white'
                                          : 'bg-white/5 text-blue-200 group-hover/sub:bg-blue-500 group-hover/sub:text-white'
                                      }`}
                                    >
                                      {branchActive ? '✓' : '→'}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          )}

                          {cihazTalepMenuOpen && (
                            <div className="fixed left-4 right-4 top-[132px] z-[9999] flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#10233f] shadow-2xl lg:hidden">
                              <div className="border-b border-white/10 px-5 py-3 text-[9px] font-black uppercase tracking-[0.18em] text-blue-200/70">
                                Cihaz Talep · Mağaza Seç
                              </div>

                              {item.branchItems.map((branchItem) => (
                                <button
                                  key={branchItem.code}
                                  type="button"
                                  onClick={() => {
                                    setCihazTalepSourceBranch(
                                      branchItem.code as
                                        | 'CNET'
                                        | 'CMR'
                                        | 'CADDE'
                                        | 'KAPAKLI'
                                        | 'SARAY'
                                    );
                                    setAppMode('cihaz_talep');
                                    setStep(1);
                                    resetSelection();
                                    setCihazTalepMenuOpen(false);
                                  }}
                                  className={`border-b border-white/5 px-5 py-4 text-left last:border-0 ${
                                    cihazTalepSourceBranch === branchItem.code &&
                                    appMode === 'cihaz_talep'
                                      ? 'bg-blue-500/20'
                                      : ''
                                  }`}
                                >
                                  <div className="text-[11px] font-black uppercase tracking-wide text-white">
                                    {branchItem.label}
                                  </div>
                                  <div className="mt-1 text-[9px] font-bold text-blue-100/55">
                                    {branchItem.detail}
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}
                        </>
                      ) : item.subItems ? (
                        <>
                          <button
                            ref={secondHandMenuButtonRef}
                            type="button"
                            onClick={() => {
                              if (typeof window !== 'undefined' && window.innerWidth < 1024) {
                                setMobileSubMenuOpen((open) => !open);
                                return;
                              }

                              openSecondHandMenu();
                            }}
                            className={`relative flex min-w-[92px] flex-col items-center justify-center gap-1 px-3 py-2.5 text-[8px] font-black uppercase tracking-wide transition lg:min-w-[108px] lg:px-4 ${
                              isActive
                                ? 'bg-blue-500/20 text-white'
                                : 'text-blue-100/65 hover:bg-white/5 hover:text-white'
                            }`}
                          >
                            <span
                              className={`flex h-7 w-7 items-center justify-center rounded-lg transition ${
                                isActive ? 'bg-blue-500 text-white' : 'bg-white/5'
                              }`}
                            >
                              {navIcon(item.id)}
                            </span>

                            <span className="flex items-center gap-1 whitespace-nowrap">
                              2. El Listesi
                              <svg
                                className={`h-2.5 w-2.5 opacity-60 transition-transform ${
                                  mobileSubMenuOpen ? 'rotate-180' : ''
                                }`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M19 9l-7 7-7-7"
                                />
                              </svg>
                            </span>

                            {isActive && (
                              <span className="absolute inset-x-2 bottom-0 h-[3px] rounded-t-full bg-gradient-to-r from-blue-400 via-cyan-300 to-fuchsia-400" />
                            )}
                          </button>

                          {mobileSubMenuOpen && (
                            <div
                              className="fixed z-[99999] hidden overflow-hidden rounded-xl border border-white/10 bg-[#10233f] py-1.5 shadow-2xl ring-1 ring-black/15 lg:flex lg:flex-col"
                              style={{
                                left: secondHandMenuPos.left,
                                top: secondHandMenuPos.top,
                                width: secondHandMenuPos.width,
                              }}
                            >
                              <div className="border-b border-white/10 px-4 py-2.5">
                                <div className="text-[8px] font-black uppercase tracking-[0.18em] text-blue-200/55">
                                  2. El Fiyat Listesi
                                </div>
                                <div className="mt-0.5 text-[10px] font-black text-white">
                                  Liste Seç
                                </div>
                              </div>

                              {item.subItems.map((sub) => (
                                <button
                                  type="button"
                                  key={sub.id}
                                  onClick={() => {
                                    setAppMode(sub.id as any);
                                    setStep(1);
                                    resetSelection();
                                    setMobileSubMenuOpen(false);
                                  }}
                                  className={`flex items-center justify-between px-4 py-3 text-left text-[10px] font-black uppercase tracking-wide transition ${
                                    appMode === sub.id
                                      ? 'bg-blue-500/20 text-blue-200'
                                      : 'text-white/80 hover:bg-white/10 hover:text-white'
                                  }`}
                                >
                                  <span>{sub.label}</span>
                                  <span className="text-blue-300">
                                    {appMode === sub.id ? '✓' : '→'}
                                  </span>
                                </button>
                              ))}
                            </div>
                          )}

                          {mobileSubMenuOpen && (
                            <div className="fixed left-4 right-4 top-[132px] z-[9999] flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#10233f] shadow-2xl lg:hidden">
                              {item.subItems.map((sub) => (
                                <button
                                  key={sub.id}
                                  onClick={() => {
                                    setAppMode(sub.id as any);
                                    setStep(1);
                                    resetSelection();
                                    setMobileSubMenuOpen(false);
                                  }}
                                  className={`border-b border-white/5 px-5 py-4 text-left text-[11px] font-black uppercase tracking-wider last:border-0 ${
                                    appMode === sub.id
                                      ? 'bg-blue-500/20 text-blue-200'
                                      : 'text-white'
                                  }`}
                                >
                                  {sub.label}
                                </button>
                              ))}
                            </div>
                          )}
                        </>
                      ) : (
                        <button
                          onClick={() => {
                            setAppMode(item.id as any);
                            setStep(1);
                            resetSelection();
                          }}
                          className={`relative flex min-w-[92px] flex-col items-center justify-center gap-1 px-3 py-2.5 text-[8px] font-black uppercase tracking-wide transition lg:min-w-[108px] lg:px-4 ${
                            isActive
                              ? 'bg-blue-500/20 text-white'
                              : 'text-blue-100/65 hover:bg-white/5 hover:text-white'
                          }`}
                        >
                          <span
                            className={`flex h-7 w-7 items-center justify-center rounded-lg transition ${
                              isActive ? 'bg-blue-500 text-white' : 'bg-white/5'
                            }`}
                          >
                            {navIcon(item.id)}
                          </span>

                          <span className="whitespace-nowrap">{item.label}</span>

                          {isActive && (
                            <span className="absolute inset-x-2 bottom-0 h-[3px] rounded-t-full bg-gradient-to-r from-blue-400 via-cyan-300 to-fuchsia-400" />
                          )}
                        </button>
                      )}
                    </div>
                  );
                })}

            {step === 99 && (
              <div className="flex min-h-[52px] items-center px-4 text-[9px] font-black uppercase tracking-[0.18em] text-blue-200">
                Yönetici Paneli
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ANA İÇERİK ALANI */}
      <div className="flex-1 w-full min-w-0 flex flex-col relative">
        <main
          className={`mx-auto w-full print:hidden ${
            appMode === 'cihaz_talep' && step < 99
              ? 'max-w-[1900px] p-3 sm:p-4 lg:p-5'
              : 'max-w-[1600px] p-4 sm:p-6 lg:p-10'
          }`}
        >
 
          {appMode === 'ana_sayfa' && step < 99 ? (
              isZumay ? (
                 <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-8 animate-in fade-in zoom-in duration-500 px-4">
                    <div className="w-24 h-24 bg-red-600 rounded-3xl flex items-center justify-center shadow-xl shadow-red-500/20 text-white text-5xl font-black italic">Z</div>
                    <h2 className="text-4xl md:text-5xl font-black italic tracking-tighter text-slate-800 uppercase text-center">
                       ZUMAY <span className="text-red-600">BAYİ PORTALI</span>
                    </h2>
                    <p className="text-slate-500 font-bold tracking-widest uppercase text-xs text-center max-w-md">
                       Cihaz alım ve dış kanal satın alma işlemlerinizi üst menüden yönetebilirsiniz.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 mt-8 w-full sm:w-auto">
                       <button onClick={() => {setAppMode('alim'); setStep(1);}} className="bg-red-600 hover:bg-red-700 text-white px-8 py-5 rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-red-600/20 transition-all active:scale-95 text-xs sm:text-sm border border-red-500">
                          CİHAZ ALIMI YAP
                       </button>
                       <button onClick={() => {setAppMode('dis_kanal'); setStep(1);}} className="bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 px-8 py-5 rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-slate-200/50 transition-all active:scale-95 text-xs sm:text-sm">
                          DIŞ KANAL LİSTESİ
                       </button>
                    </div>
                 </div>
              ) : (
                 <AnaSayfa selectedBranch={selectedBranch} setAppMode={setAppMode} config={config} gidisatData={magazaGidisatData} personelData={personelData} hedeflerData={hedeflerData} />
              )
          ) : appMode === 'imei_list' && step < 99 ? (
            <div className="bg-white p-6 sm:p-10 rounded-[48px] shadow-sm border border-slate-200 text-slate-900 animate-in fade-in duration-500">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 border-b border-slate-100 pb-6 gap-4">
                  <div>
                    <h2 className="text-3xl font-black italic tracking-tighter text-orange-600">DEPO LİSTESİ</h2>
                    <p className="text-[10px] text-slate-500 font-bold tracking-widest mt-1 uppercase">Vodafone Kanalı İmei Kayıtları</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 p-3 rounded-2xl flex items-center w-full md:w-80 focus-within:border-orange-400 focus-within:bg-white transition-all shadow-sm">
                    <svg className="w-5 h-5 text-slate-400 mr-2 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    <input type="text" placeholder="İmei veya Cihaz Arama..." className="bg-transparent border-none outline-none text-sm text-slate-900 w-full placeholder-slate-400" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                  </div>
              </div>
              
              <div className="max-w-5xl mx-auto overflow-x-auto custom-scrollbar pb-2">
                <div className="min-w-[500px]">
                  <div className="bg-orange-500 px-4 py-3 rounded-t-2xl flex font-black text-[10px] tracking-widest text-white items-center shadow-md">
                    <div className="flex-[3]">CİHAZ BİLGİSİ</div>
                    <div className="flex-[2] text-center border-l border-orange-400 pl-2">İMEİ BİLGİSİ</div>
                    <div className="flex-[1] text-right border-l border-orange-400 pl-2">DURUM</div>
                  </div>
                  <div className="bg-white rounded-b-2xl overflow-hidden border-x border-b border-slate-200">
                    {imeiData.slice(1).filter(r => (r[0] && r[0].toLowerCase().includes(searchQuery.toLowerCase())) || (r[1] && r[1].toLowerCase().includes(searchQuery.toLowerCase()))).map((row, i) => {
                        const imeiNo = row[1];
                        let localDurum = null;
                        
                        if (typeof window !== 'undefined') {
                            const kayitStr = localStorage.getItem('kullanilan_imei_' + imeiNo);
                            if (kayitStr) {
                                try {
                                    const kayit = JSON.parse(kayitStr);
                                    const onDakika = 10 * 60 * 1000;
                                    
                                    if (new Date().getTime() - kayit.timestamp < onDakika) {
                                        localDurum = kayit.durum;
                                    } else {
                                        localStorage.removeItem('kullanilan_imei_' + imeiNo);
                                    }
                                } catch (e) {
                                    localStorage.removeItem('kullanilan_imei_' + imeiNo);
                                }
                            }
                        }
                        
                        const guncelDurum = localDurum || row[2]; 
                        const isUsed = guncelDurum && guncelDurum.toString().toUpperCase().includes('KULLANILDI');
                        
                        return (
                        <div key={i} className={`flex px-4 py-3 border-b border-slate-200 transition-colors text-[11px] sm:text-xs font-bold items-center group ${isUsed ? 'bg-red-50' : (i % 2 === 0 ? 'bg-slate-50' : 'bg-white hover:bg-slate-100')}`}>
                          
                          <div className={`flex-[3] flex items-center ${isUsed ? 'text-red-700 line-through opacity-70' : 'text-slate-700 group-hover:text-slate-900'} transition-colors pr-4`}>
                              {row[0] || '-'}
                          </div>
                          
                          <div className={`flex-[2] text-center font-black text-sm whitespace-nowrap border-l border-slate-200 pl-4 ${isUsed ? 'text-red-500 line-through opacity-70' : 'text-green-600'}`}>
                              {row[1] || '-'}
                          </div>

                          <div className="flex-[1] flex justify-end border-l border-slate-200 pl-4">
                              {isUsed ? (
                                  <div className="flex flex-col items-end">
                                      <span className="text-[9px] text-red-600 font-black tracking-widest bg-red-100 px-2 py-1 rounded-md">{guncelDurum}</span>
                                  </div>
                              ) : (
                                  <button onClick={() => handleImeiKullan(row[1])} className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-1.5 rounded-lg text-[10px] font-black tracking-widest uppercase transition-all btn-click shadow-sm">
                                      KULLAN
                                  </button>
                              )}
                          </div>

                        </div>
                    )})}
                  </div>
                </div>
              </div>
            </div>
          ) :

          appMode === 'kampanya_sifir' && step < 99 ? (
            <KampanyaliSifir data={cepTabletData} />
          ) :

          appMode === 'thh' && step < 99 && isMasterAccess ? (
            <div className="w-full max-w-[1500px] mx-auto space-y-6 animate-in fade-in duration-500">
              
              <div className="bg-white rounded-[24px] shadow-sm border border-slate-200 overflow-hidden">
                <div className="flex items-center justify-between px-8 py-5 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    </div>
                    <div>
                      <h2 className="text-base font-black text-slate-800 uppercase tracking-widest">{thhForm.rowIndex ? 'DOSYAYI DÜZENLE' : 'YENİ DOSYA EKLE'}</h2>
                      <p className="text-[10px] text-slate-400 font-bold tracking-widest uppercase">Tüketici başvurusu bilgilerini eksiksiz doldurunuz.</p>
                    </div>
                  </div>
                  {thhForm.rowIndex && (
                    <button onClick={handleClearThhForm} className="text-slate-400 hover:text-red-500 transition-colors btn-click flex items-center gap-2 text-xs font-black bg-slate-50 px-4 py-2 rounded-lg">
                      İPTAL ET
                    </button>
                  )}
                </div>

                <div className="p-8 pb-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {[
                      { key: 'adSoyad', label: 'TÜKETİCİ AD-SOYAD', holder: 'Ad soyad giriniz' },
                      { key: 'musteriTelefon', label: 'MÜŞTERİ TELEFONU', holder: '5XX XXX XX XX' },
                      { key: 'basvuruTarihi', label: 'BAŞVURU TARİHİ', holder: 'gg.aa.yyyy', type: 'date' },
                      { key: 'sayi', label: 'SAYI', holder: 'Sayı giriniz' },
                      { key: 'konu', label: 'KONU', holder: 'Konu giriniz' },
                      { key: 'kepAdresi', label: 'KEP ADRESİ', holder: 'ornek@hs01.kep.tr' },
                      { key: 'markaModel', label: 'MARKA-MODEL', holder: 'Marka - Model' },
                      { key: 'imeiNo', label: 'İMEİ NO', holder: 'İmei numarasını giriniz' },
                      { key: 'faturaNo', label: 'FATURA NO', holder: 'Fatura numarası' },
                      { key: 'faturaTutari', label: 'FATURA TUTARI', holder: '0,00 ₺' },
                      { key: 'alisBilgileri', label: 'ALIŞ BİLGİLERİ', holder: 'Alış bilgilerini giriniz' },
                      { key: 'durumu', label: 'DURUMU', type: 'select', opts: ['Evraklar Yüklendi'] },
                      { key: 'durumu2', label: 'DURUMU 2', type: 'select', opts: ['Savunma Bekliyor'] },
                      { key: 'durumu3', label: 'DURUMU 3', type: 'select', opts: ['Savunma Geldi'] },
                      { key: 'durumu4', label: 'DURUMU 4', type: 'select', opts: ['Savunma Yüklendi'] },
                      { key: 'sonuc', label: 'SONUÇ', type: 'select', opts: ['Tüketici Talebinin Kabulüne', 'Tüketici Talebinin Reddine'] },
                      { key: 'ucretIadesi', label: 'İADE/DEĞİŞİM/ONARIM/RED', type: 'select', opts: ['Ücret İadesi', 'Değişim', 'Onarım', 'RED'] },
                      { key: 'sonuc2', label: 'SONUÇ 2', type: 'select', opts: ['Ödeme Yapıldı', 'Değişim Yapıldı', 'Ödeme Reddedildi'] }
                    ].map((field) => (
                      <div key={field.key} className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-black text-slate-700 tracking-wider ml-1">{field.label}</label>
                        {field.type === 'select' ? (
                          <select 
                            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl outline-none text-xs font-bold text-slate-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-50 transition-all cursor-pointer shadow-sm"
                            value={(thhForm as any)[field.key]} 
                            onChange={(e) => setThhForm({...thhForm, [field.key]: e.target.value})}
                          >
                            <option value="">Seçiniz...</option>
                            {field.opts?.map(o => <option key={o} value={o}>{o}</option>)}
                          </select>
                        ) : (
                          <input 
                            type={field.type || 'text'}
                            placeholder={field.holder}
                            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl outline-none text-xs font-bold text-slate-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-50 transition-all placeholder-slate-300 shadow-sm"
                            value={(thhForm as any)[field.key]} 
                            onChange={(e) => setThhForm({...thhForm, [field.key]: e.target.value})}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-4 bg-white border-t border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
                  <div className="flex items-center gap-3 bg-indigo-50 text-indigo-800 px-4 py-3 rounded-xl flex-1 max-w-2xl border border-indigo-100">
                     <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center font-black text-xs shrink-0">i</div>
                     <div>
                       <p className="text-[10px] font-black tracking-widest uppercase mb-0.5">BİLGİLENDİRME</p>
                       <p className="text-xs font-medium opacity-90">Tüm alanların doğru ve eksiksiz doldurulması sürecin takibi açısından önemlidir.</p>
                     </div>
                  </div>
                  
                  <div className="flex gap-2 w-full md:w-auto">
                    {thhForm.rowIndex && (
                      <button onClick={handleDeleteThh} disabled={thhSaving} className="bg-red-50 text-red-600 hover:bg-red-500 hover:text-white px-6 py-3 rounded-xl font-black text-[11px] tracking-widest uppercase transition-all shadow-sm btn-click disabled:opacity-50">
                         SİL
                      </button>
                    )}
                    <button onClick={thhForm.rowIndex ? handleUpdateThh : handleSaveThh} disabled={thhSaving} className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-xl font-black text-[11px] tracking-widest uppercase transition-all shadow-md btn-click flex items-center justify-center gap-2 w-full md:w-auto disabled:opacity-50">
                       <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
                       {thhSaving ? 'İŞLENİYOR...' : (thhForm.rowIndex ? 'GÜNCELLE' : 'SİSTEME KAYDET')}
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-[24px] shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between px-8 py-5 border-b border-slate-100 gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
                    </div>
                    <div>
                      <h2 className="text-base font-black text-slate-800 uppercase tracking-widest">DOSYA KAYITLARI</h2>
                      <p className="text-[10px] text-slate-400 font-bold tracking-widest uppercase">Sisteme kayıtlı tüm dosyalar listelenmektedir.</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl flex items-center w-full md:w-64 focus-within:bg-white focus-within:border-indigo-400 transition-all">
                      <svg className="w-4 h-4 text-slate-400 mr-2 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                      <input type="text" placeholder="Ara..." className="bg-transparent border-none outline-none text-xs font-bold text-slate-700 w-full placeholder-slate-400" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto custom-scrollbar flex-1 min-h-[300px]">
                  <div className="min-w-max flex flex-col">
                    <div className="flex items-center bg-[#4338ca] text-white text-[9px] font-black tracking-widest uppercase px-4 py-3 shrink-0">
                      <div className="w-[160px] shrink-0 pl-2">TÜKETİCİ AD-SOYAD</div>
                      <div className="w-[120px] shrink-0">MÜŞTERİ TEL</div>
                      <div className="w-[110px] shrink-0">BAŞVURU TRH.</div>
                      <div className="w-[140px] shrink-0">SAYI</div>
                      <div className="w-[160px] shrink-0">KONU</div>
                      <div className="w-[160px] shrink-0">KEP ADRESİ</div>
                      <div className="w-[140px] shrink-0">MARKA-MODEL</div>
                      <div className="w-[130px] shrink-0">İMEİ NO</div>
                      <div className="w-[120px] shrink-0">FATURA NO</div>
                      <div className="w-[100px] shrink-0">FAT. TUTARI</div>
                      <div className="w-[120px] shrink-0">ALIŞ BİLGİSİ</div>
                      <div className="w-[140px] shrink-0">DURUMU</div>
                      <div className="w-[140px] shrink-0">DURUMU 2</div>
                      <div className="w-[140px] shrink-0">DURUMU 3</div>
                      <div className="w-[140px] shrink-0">DURUMU 4</div>
                      <div className="w-[180px] shrink-0">SONUÇ</div>
                      <div className="w-[140px] shrink-0">İADE/DEĞİŞİM</div>
                      <div className="w-[140px] shrink-0 text-center">SONUÇ 2</div>
                    </div>
                    
                    <div className="flex flex-col flex-1 pb-4">
                      {thhData.slice(1).filter(r => {
                         if (!searchQuery) return true;
                         const s = searchQuery.toLowerCase();
                         return (r[0]||'').toLowerCase().includes(s) || (r[17]||'').toLowerCase().includes(s) || (r[5]||'').toLowerCase().includes(s);
                      }).map((row, i) => {
                        const getBadge = (val: string) => {
                           if (!val) return null;
                           let bg = 'bg-slate-100 text-slate-700';
                           if (['Ücret İadesi', 'Ödeme Yapıldı', 'Değişim Yapıldı', 'RED VERİLDİ'].includes(val)) bg = 'bg-emerald-100 text-emerald-700';
                           if (['Ödeme Reddedildi'].includes(val)) bg = 'bg-red-100 text-red-700';
                           return <span className={`px-2.5 py-1 rounded-md shadow-sm whitespace-nowrap ${bg}`}>{val}</span>;
                        };

                        const isEditing = thhForm.rowIndex === i + 2;

                        return (
                          <div 
                            key={i} 
                            onClick={() => setThhForm({
                              rowIndex: i + 2, adSoyad: row[0]||'', musteriTelefon: row[17]||'', basvuruTarihi: row[1]||'', 
                              sayi: row[2]||'', konu: row[3]||'', kepAdresi: row[4]||'', markaModel: row[5]||'', 
                              imeiNo: row[6]||'', faturaNo: row[7]||'', faturaTutari: row[8]||'', alisBilgileri: row[9]||'', 
                              durumu: row[10]||'', durumu2: row[11]||'', durumu3: row[12]||'', durumu4: row[13]||'', 
                              sonuc: row[14]||'', ucretIadesi: row[15]||'', sonuc2: row[16]||''
                            })}
                            className={`flex items-center px-4 py-3 border-b border-slate-100 text-[10px] font-bold text-slate-700 cursor-pointer transition-colors hover:bg-indigo-50/50 ${isEditing ? 'bg-indigo-50 border-l-4 border-l-indigo-500' : 'bg-white hover:border-slate-200'}`}
                          >
                            <div className="w-[160px] shrink-0 pl-2 truncate font-black text-indigo-700">{row[0] || '-'}</div>
                            <div className="w-[120px] shrink-0 truncate font-black text-slate-900 tracking-widest">{row[17] || '-'}</div>
                            <div className="w-[110px] shrink-0 truncate">{row[1] || '-'}</div>
                            <div className="w-[140px] shrink-0 truncate">{row[2] || '-'}</div>
                            <div className="w-[160px] shrink-0 truncate pr-2" title={row[3]}>{row[3] || '-'}</div>
                            <div className="w-[160px] shrink-0 truncate text-blue-500">{row[4] || '-'}</div>
                            <div className="w-[140px] shrink-0 truncate pr-2">{row[5] || '-'}</div>
                            <div className="w-[130px] shrink-0 truncate">{row[6] || '-'}</div>
                            <div className="w-[120px] shrink-0 truncate">{row[7] || '-'}</div>
                            <div className="w-[100px] shrink-0 truncate">{row[8] || '-'}</div>
                            <div className="w-[120px] shrink-0 truncate">{row[9] || '-'}</div>
                            <div className="w-[140px] shrink-0 truncate pr-2">{getBadge(row[10]) || '-'}</div>
                            <div className="w-[140px] shrink-0 truncate pr-2">{getBadge(row[11]) || '-'}</div>
                            <div className="w-[140px] shrink-0 truncate pr-2">{getBadge(row[12]) || '-'}</div>
                            <div className="w-[140px] shrink-0 truncate pr-2">{getBadge(row[13]) || '-'}</div>
                            <div className="w-[180px] shrink-0 truncate pr-2">{getBadge(row[14]) || '-'}</div>
                            <div className="w-[140px] shrink-0 truncate pr-2">{getBadge(row[15]) || '-'}</div>
                            <div className="w-[140px] shrink-0 truncate text-center">{getBadge(row[16]) || '-'}</div>
                          </div>
                        )
                      })}

                      {thhData.length <= 1 && (
                        <div className="flex flex-col items-center justify-center p-12 text-slate-300">
                           <svg className="w-16 h-16 mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
                           <p className="font-black text-sm uppercase tracking-widest text-slate-400">Henüz Kayıt Bulunmuyor</p>
                           <p className="text-[10px] font-bold tracking-widest uppercase mt-2">Yeni bir dosya ekleyerek başlayabilirsiniz.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) :

          appMode === 'ikinci_el_apple' && step < 99 ? (
            <IkinciElApple
              data={ikinciElData}
              canEdit={Boolean(isSuperAdminUser && currentAdminEditableSheet)}
              onEdit={() => {
                if (currentAdminEditableSheet) {
                  setAdminSheetEditor(currentAdminEditableSheet);
                }
              }}
            />
          ) :

          appMode === 'ikinci_el_android' && step < 99 ? (
            <IkinciElAndroid
              data={ikinciElData}
              canEdit={Boolean(isSuperAdminUser && currentAdminEditableSheet)}
              onEdit={() => {
                if (currentAdminEditableSheet) {
                  setAdminSheetEditor(currentAdminEditableSheet);
                }
              }}
            />
          ) :

          appMode === 'dis_kanal' && step < 99 ? (
            <DisKanal
              data={disKanalData}
              selectedBranch={selectedBranch}
              isZumay={isZumay}
              canEdit={Boolean(isSuperAdminUser && currentAdminEditableSheet)}
              onEdit={() => {
                if (currentAdminEditableSheet) {
                  setAdminSheetEditor(currentAdminEditableSheet);
                }
              }}
            />
          ) :

          appMode === 'cep_tablet' && step < 99 ? (
            <CepTablet
              data={cepTabletData}
              canEdit={Boolean(isSuperAdminUser && currentAdminEditableSheet)}
              onEdit={() => {
                if (currentAdminEditableSheet) {
                  setAdminSheetEditor(currentAdminEditableSheet);
                }
              }}
            />
          ) :

          appMode === 'yna_list' && step < 99 ? (
            <YNAList
              data={ynaData}
              canEdit={Boolean(isSuperAdminUser && currentAdminEditableSheet)}
              onEdit={() => {
                if (currentAdminEditableSheet) {
                  setAdminSheetEditor(currentAdminEditableSheet);
                }
              }}
            />
          ) :

          appMode === 'cihaz_talep' && step < 99 ? (
            <CihazTalep
              cihazTalepData={cihazTalepData}
              setCihazTalepData={setCihazTalepData}
              cihazTalepSearch={cihazTalepSearch}
              setCihazTalepSearch={setCihazTalepSearch}
              cihazTalepPage={cihazTalepPage}
              setCihazTalepPage={setCihazTalepPage}
              openActiveRequestsSignal={cihazTalepOpenActiveSignal}
              selectedBranch={selectedBranch}
              stockBranchCode={cihazTalepSourceBranch}
              isAdmin={isAdmin}
              isMasterAccess={isMasterAccess}
              isSuperAdminUser={isSuperAdminUser}
              refreshDataCache={refreshDataCache}
              sheetFetchedAtRef={sheetFetchedAtRef}
              loadSheetsForCurrentScreen={loadSheetsForCurrentScreen}
            />
          ) :

          appMode === 'servis' && step < 99 ? (
            <TeknikServis
              brands={displayBrands}
              brandDb={brandDb}
              brandAssets={brandAssets}
              devices={db}
              prices={servisFiyatlari}
              branches={branches}
              selectedBranch={selectedBranch}
            />
          ) :

          step === 99 ? (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              {isAdmin && (
                <div className="mb-6 bg-white border border-slate-200 p-4 rounded-[28px] shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
                   <div className="flex items-center gap-3 w-full md:w-auto overflow-x-auto no-scrollbar">
                      <select value={adminSelectedBranch} onChange={(e) => setAdminSelectedBranch(e.target.value)} className="bg-slate-50 text-slate-800 text-[10px] uppercase font-black tracking-widest p-3 rounded-xl outline-none border border-slate-200 min-w-[150px]">
                        <option value="TÜM ŞUBELER">TÜM ŞUBELER</option>
                        {branches.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
                      </select>
                      <select value={dateFilterType} onChange={(e) => setDateFilterType(e.target.value)} className="bg-slate-50 text-slate-800 text-[10px] uppercase font-black tracking-widest p-3 rounded-xl outline-none border border-slate-200 min-w-[150px]">
                         <option value="TÜM ZAMANLAR">TÜM ZAMANLAR</option>
                         <option value="BUGÜN">BUGÜN</option>
                         <option value="DÜN">DÜN</option>
                         <option value="ÖNCEKİ GÜN">ÖNCEKİ GÜN</option>
                         <option value="ÖZEL">ÖZEL</option>
                      </select>

                      {dateFilterType === 'ÖZEL' && (
                        <div className="flex items-center gap-2">
                           <input type="date" value={customStartDate} onChange={(e) => setCustomStartDate(e.target.value)} className="bg-slate-50 text-slate-800 text-xs p-3 rounded-xl border border-slate-200 outline-none focus:border-blue-500" />
                           <input type="date" value={customEndDate} onChange={(e) => setCustomEndDate(e.target.value)} className="bg-slate-50 text-slate-800 text-xs p-3 rounded-xl border border-slate-200 outline-none focus:border-blue-500" />
                        </div>
                      )}
                   </div>

                   <div className="flex items-center gap-3 w-full md:w-auto shrink-0">
                      <button onClick={() => {setStep(1); setIsAdmin(false); if(isMasterAccess) handleLogout();}} className="bg-red-50 text-red-600 hover:bg-red-600 hover:text-white px-6 py-3 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all border border-red-100 whitespace-nowrap flex items-center justify-center gap-2 btn-click">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        PANELİ KAPAT
                      </button>
                   </div>
                </div>
              )}

              <YoneticiPaneli
                isAdmin={isAdmin}
                setAdminPass={setAdminPass}
                handleLogin={handleLogin}
                adminSelectedBranch={adminSelectedBranch}
                dateFilterType={dateFilterType}
                dashboardStats={dashboardStats}
                config={config}
                updateConfig={updateConfig}
                filteredAlimlar={filteredAlimlar}
                deleteAllAlimlar={deleteAllAlimlar}
                deleteAlim={deleteAlim}
                setEkspertizModalData={setEkspertizModalData}
              />
            </div>
          ) : appMode === 'alim' && step < 99 ? (
            <CihazAlim
              step={step}
              setStep={setStep}
              appMode={appMode}
              isZumay={isZumay}
              displayBrands={displayBrands}
              brandDb={brandDb}
              brandAssets={brandAssets}
              db={db}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              selectedBrand={selectedBrand}
              setSelectedBrand={setSelectedBrand}
              selectedModelName={selectedModelName}
              setSelectedModelName={setSelectedModelName}
              selectedCapacity={selectedCapacity}
              setSelectedCapacity={setSelectedCapacity}
              selectedColor={selectedColor}
              setSelectedColor={setSelectedColor}
              customer={customer}
              setCustomer={setCustomer}
              status={status}
              setStatus={setStatus}
              prices={prices}
              purchaseType={purchaseType}
              setPurchaseType={setPurchaseType}
              isCustomOfferActive={isCustomOfferActive}
              setIsCustomOfferActive={setIsCustomOfferActive}
              customOffer={customOffer}
              setCustomOffer={setCustomOffer}
              isCustomTradeOfferActive={isCustomTradeOfferActive}
              setIsCustomTradeOfferActive={setIsCustomTradeOfferActive}
              customTradeOffer={customTradeOffer}
              setCustomTradeOffer={setCustomTradeOffer}
              resetSelection={resetSelection}
              allSelected={allSelected}
              calculatedTradePrice={calculatedTradePrice}
              finalCashPrice={finalCashPrice}
              finalTradePrice={finalTradePrice}
              canProceed={canProceed}
              showDocs={showDocs}
              isYd={isYd}
              handleFinalProcess={handleFinalProcess}
              servisFiyatlari={servisFiyatlari}
              handleServisWhatsApp={handleServisWhatsApp}
            />
          ) : null}
        </main>
      </div>

      <footer className="mt-auto w-full border-t border-slate-200 py-6 text-center print:hidden bg-transparent">
         <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.5em]">{isZumay ? 'ZUMAY BAYİ PORTALI v6.0.0' : 'CNETMOBIL • CMR ENTERPRISE DASHBOARD v6.0.0 (PARTNER SAAS)'}</p>
      </footer>

      {/* TOAST BİLDİRİMLERİ */}
      <div className="fixed top-24 right-6 z-[200] flex flex-col gap-3 pointer-events-none print:hidden">
        {toastMessages.map((toast) => (
          <div key={toast.id} className={`animate-in slide-in-from-right-8 fade-in duration-500 rounded-2xl shadow-2xl p-4 border flex items-center gap-3 backdrop-blur-md ${toast.type === 'new' ? 'bg-emerald-500/90 border-emerald-400 text-white' : 'bg-blue-600/90 border-blue-500 text-white'}`}>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${toast.type === 'new' ? 'bg-emerald-400' : 'bg-blue-500'}`}>
              {toast.type === 'new' ? (
                <span className="text-lg">📦</span>
              ) : (
                <span className="text-lg">💵</span>
              )}
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest opacity-80">{toast.type === 'new' ? 'SİSTEM BİLDİRİMİ' : 'FİYAT GÜNCELLEMESİ'}</p>
              <p className="font-bold text-sm leading-tight mt-0.5 max-w-[250px]">{toast.text}</p>
            </div>
          </div>
        ))}
      </div>

      {/* TAKSİT MODALI */}
      {isInstallmentModalOpen && !isZumay && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/80 backdrop-blur-md print:hidden p-4">
          <div className="bg-white rounded-[40px] shadow-2xl p-8 w-full max-w-4xl relative animate-in fade-in zoom-in duration-300 border border-slate-100 flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center mb-8 border-b border-slate-100 pb-6 shrink-0">
              <div className="flex items-center gap-4">
                <div className="bg-emerald-50 text-emerald-600 w-12 h-12 rounded-2xl flex items-center justify-center">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
                </div>
                <div>
                  <h2 className="text-2xl font-black italic text-slate-900 uppercase tracking-tighter">Taksit Hesaplama</h2>
                </div>
              </div>
              <button onClick={() => { setIsInstallmentModalOpen(false); setInstallmentAmount(''); }} className="bg-slate-100 p-3 rounded-2xl text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all btn-click">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <div className="mb-6 shrink-0 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-50 p-4 rounded-3xl border border-slate-100 focus-within:border-emerald-500 focus-within:bg-white transition-all">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Müşteri Adı Soyadı</label>
                  <input type="text" placeholder="Ad Soyad" value={customer.name} onChange={(e) => setCustomer({...customer, name: e.target.value})} className="w-full mt-2 bg-transparent text-sm font-black outline-none text-slate-800 placeholder-slate-300 uppercase" />
                </div>
                <div className="bg-slate-50 p-4 rounded-3xl border border-slate-100 focus-within:border-emerald-500 focus-within:bg-white transition-all">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Telefon Numarası</label>
                  <input type="text" placeholder="Telefon" value={customer.phone} onChange={(e) => setCustomer({...customer, phone: e.target.value})} className="w-full mt-2 bg-transparent text-sm font-black outline-none text-slate-800 placeholder-slate-300" />
                </div>
              </div>

              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none">
                  <span className="text-slate-400 font-black text-xl">₺</span>
                </div>
                <input type="number" placeholder="İşlem Tutarını Giriniz..." value={installmentAmount} onChange={(e) => setInstallmentAmount(e.target.value)} className="w-full py-6 pl-12 pr-6 bg-slate-50 rounded-3xl text-2xl font-black border border-slate-200 outline-none focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-50 transition-all text-slate-800" />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 pb-4">
              {installmentAmount && Number(installmentAmount) > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { month: 2, rate: 7.83 }, { month: 3, rate: 10.05 }, { month: 4, rate: 12.36 }, { month: 5, rate: 14.76 },
                    { month: 6, rate: 17.55 }, { month: 7, rate: 20.19 }, { month: 8, rate: 22.96 }, { month: 9, rate: 25.85 },
                    { month: 10, rate: 28.88 }, { month: 11, rate: 32.07 }, { month: 12, rate: 35.41 },
                  ].map((inst) => {
                    const multiplier = 1 + (inst.rate / 100);
                    const total = Number(installmentAmount) * multiplier;
                    const monthly = total / inst.month;
                    
                    return (
                      <div key={inst.month} className="flex justify-between items-center bg-white p-5 rounded-[28px] border border-slate-200 shadow-sm hover:border-emerald-400 hover:shadow-lg transition-all group cursor-default">
                        <div className="flex items-center gap-4">
                          <div className="bg-slate-900 group-hover:bg-emerald-600 transition-colors text-white w-14 h-14 flex flex-col items-center justify-center rounded-[20px] shadow-md shrink-0">
                            <span className="font-black text-xl leading-none">{inst.month}</span>
                            <span className="text-[9px] font-bold uppercase tracking-widest mt-0.5 opacity-80">Taksit</span>
                          </div>
                          <div>
                            <div className="text-xl font-black italic text-slate-900 tracking-tighter">
                              {monthly.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 border-l border-slate-100 pl-4">
                          <div className="text-right hidden sm:block">
                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Toplam</div>
                            <div className="text-base font-black text-slate-700">{total.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL</div>
                          </div>
                          <button onClick={() => handleSendInstallmentToWhatsApp(inst.month, total)} className="bg-[#25D366] hover:bg-[#128C7E] text-white w-12 h-12 rounded-[18px] flex items-center justify-center transition-all shadow-md shadow-green-200 btn-click shrink-0" title="WhatsApp'a Gönder">
                            <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center opacity-40 py-10 text-slate-900">
                  <svg className="w-20 h-20 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0-2.08-.402-2.599-1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <p className="text-lg font-black uppercase tracking-widest text-center">Hesaplama için<br/>tutar giriniz</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* KASKO MODALI */}
      {isKaskoModalOpen && !isZumay && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/80 backdrop-blur-md print:hidden p-4">
          <div className="bg-white rounded-[40px] shadow-2xl p-8 w-full max-w-4xl relative animate-in fade-in zoom-in duration-300 border border-slate-100 flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center mb-8 border-b border-slate-100 pb-6 shrink-0">
              <div className="flex items-center gap-4">
                <div className="bg-purple-50 text-purple-600 w-12 h-12 rounded-2xl flex items-center justify-center">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                </div>
                <div>
                  <h2 className="text-2xl font-black italic text-slate-900 uppercase tracking-tighter">Kasko Hesaplama</h2>
                </div>
              </div>
              <button onClick={() => { setIsKaskoModalOpen(false); setKaskoAmount(''); }} className="bg-slate-100 p-3 rounded-2xl text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all btn-click">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="mb-6 shrink-0 space-y-4">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none">
                  <span className="text-slate-400 font-black text-xl">₺</span>
                </div>
                <input type="number" placeholder="Cihaz Tutarını Giriniz..." value={kaskoAmount} onChange={(e) => setKaskoAmount(e.target.value)} className="w-full py-6 pl-12 pr-6 bg-slate-50 rounded-3xl text-2xl font-black border border-slate-200 outline-none focus:bg-white focus:border-purple-500 focus:ring-4 focus:ring-purple-50 transition-all text-slate-800" />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 pb-4">
              {kaskoAmount && Number(kaskoAmount) > 0 ? (
                <div className="flex flex-col gap-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {(() => {
                      const val = Number(kaskoAmount);
                      
                      const isSilver = val > 0 && val <= 25000;
                      const isGold = val > 25000 && val <= 60000;
                      const isPlatin = val > 60000 && val <= 170000;

                      // KASKO KADEMELİ FİYAT KORUMASI
                      // Paket yükselirken kasko fiyatı bir önceki paketin ulaştığı
                      // maksimum tutarın altına düşemez.
                      const SILVER_MIN = 2750;
                      const GOLD_MIN = 3750;
                      const PLATIN_MIN = 7500;

                      const SILVER_ORAN = 0.175;
                      const GOLD_ORAN = 0.135;
                      const PLATIN_ORAN = 0.11;

                      // Silver 25.000 TL'de 4.375 TL'ye ulaşır.
                      const silverUstSinirFiyati = Math.max(25000 * SILVER_ORAN, SILVER_MIN); // 4.375 TL

                      // Gold 60.000 TL'de 8.100 TL'ye ulaşır.
                      const goldUstSinirFiyati = Math.max(60000 * GOLD_ORAN, GOLD_MIN, silverUstSinirFiyati); // 8.100 TL

                      const silverPrice = Math.max(val * SILVER_ORAN, SILVER_MIN);

                      // 25.001 TL'den sonra Gold hesabı 4.375 TL'nin altına inemez.
                      // Gold oranı 4.375 TL'yi geçtiği anda normal oran hesabı devam eder.
                      const goldPrice = Math.max(
                        val * GOLD_ORAN,
                        GOLD_MIN,
                        silverUstSinirFiyati
                      );

                      // 60.001 TL'den sonra Platin hesabı 8.100 TL'nin altına inemez.
                      // Platin oranı 8.100 TL'yi geçtiği anda normal oran hesabı devam eder.
                      const platinPrice = Math.max(
                        val * PLATIN_ORAN,
                        PLATIN_MIN,
                        goldUstSinirFiyati
                      );

                      return (
                        <>
                          <div className={`p-6 rounded-[28px] border-2 transition-all duration-300 ${isSilver ? 'bg-white border-slate-300 shadow-xl scale-[1.02]' : 'bg-slate-50 border-slate-100 opacity-40 grayscale-[50%]'}`}>
                            <div className="flex justify-between items-center mb-4">
                              <div className="text-sm font-black text-slate-600 uppercase tracking-widest">Silver Paket</div>
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${isSilver ? 'bg-slate-200 text-slate-700' : 'bg-slate-200 text-slate-400'}`}>S</div>
                            </div>
                            {isSilver ? (
                              <div className="animate-in fade-in duration-300">
                                <div className="text-3xl font-black italic text-slate-900 tracking-tighter mb-3">
                                  {silverPrice.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} TL
                                </div>
                                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-slate-100 inline-block px-2.5 py-1.5 rounded-lg border border-slate-200">
                                  MİNİMUM BAREM: 2.750 TL
                                </div>
                              </div>
                            ) : (
                              <div className="text-[11px] font-black text-slate-400 uppercase mt-4 leading-relaxed">
                                Bu paket <br/><span className="text-slate-500 text-sm">0 - 25.000 TL</span><br/>arası içindir.
                              </div>
                            )}
                          </div>

                          <div className={`p-6 rounded-[28px] border-2 transition-all duration-300 ${isGold ? 'bg-amber-50/50 border-amber-300 shadow-xl scale-[1.02]' : 'bg-slate-50 border-slate-100 opacity-40 grayscale-[50%]'}`}>
                            <div className="flex justify-between items-center mb-4">
                              <div className="text-sm font-black text-amber-600 uppercase tracking-widest">Gold Paket</div>
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${isGold ? 'bg-amber-200 text-amber-700' : 'bg-slate-200 text-slate-400'}`}>G</div>
                            </div>
                            {isGold ? (
                              <div className="animate-in fade-in duration-300">
                                <div className="text-3xl font-black italic text-slate-900 tracking-tighter mb-3">
                                  {goldPrice.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} TL
                                </div>
                                <div className="text-[10px] font-bold text-amber-700 uppercase tracking-widest bg-amber-100 inline-block px-2.5 py-1.5 rounded-lg border border-amber-200">
                                  MİNİMUM BAREM: 3.750 TL
                                </div>
                              </div>
                            ) : (
                              <div className="text-[11px] font-black text-slate-400 uppercase mt-4 leading-relaxed">
                                Bu paket <br/><span className="text-slate-500 text-sm">25.001 - 60.000 TL</span><br/>arası içindir.
                              </div>
                            )}
                          </div>

                          <div className={`p-6 rounded-[28px] border-2 transition-all duration-300 ${isPlatin ? 'bg-indigo-50/50 border-indigo-300 shadow-xl scale-[1.02]' : 'bg-slate-50 border-slate-100 opacity-40 grayscale-[50%]'}`}>
                            <div className="flex justify-between items-center mb-4">
                              <div className="text-sm font-black text-indigo-600 uppercase tracking-widest">Platin Paket</div>
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${isPlatin ? 'bg-indigo-200 text-indigo-700' : 'bg-slate-200 text-slate-400'}`}>P</div>
                            </div>
                            {isPlatin ? (
                              <div className="animate-in fade-in duration-300">
                                <div className="text-3xl font-black italic text-slate-900 tracking-tighter mb-3">
                                  {platinPrice.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} TL
                                </div>
                                <div className="text-[10px] font-bold text-indigo-700 uppercase tracking-widest bg-indigo-100 inline-block px-2.5 py-1.5 rounded-lg border border-indigo-200">
                                  MİNİMUM BAREM: 7.500 TL
                                </div>
                              </div>
                            ) : (
                              <div className="text-[11px] font-black text-slate-400 uppercase mt-4 leading-relaxed">
                                Bu paket <br/><span className="text-slate-500 text-sm">60.001 - 170.000 TL</span><br/>arası içindir.
                              </div>
                            )}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                  
                  {Number(kaskoAmount) > 170000 && (
                    <div className="bg-red-50 border-2 border-red-200 text-red-600 p-4 rounded-2xl text-center font-black uppercase tracking-widest text-xs animate-in fade-in">
                      Maksimum sistem kasko bedeli (170.000 TL) aşıldı!
                    </div>
                  )}
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center opacity-40 py-10 text-slate-900">
                  <svg className="w-20 h-20 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                  <p className="text-lg font-black uppercase tracking-widest text-center">Hesaplama için<br/>cihaz tutarı giriniz</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {ekspertizModalData && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 print:hidden">
          <div className="bg-white rounded-[32px] shadow-2xl p-8 w-full max-w-2xl border border-slate-200 flex flex-col animate-in fade-in zoom-in duration-300">
             <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-6 shrink-0">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-500">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                  </div>
                  <div>
                    <h3 className="text-xl font-black italic text-slate-900 uppercase tracking-tighter">Personel Seçimleri</h3>
                    <p className="text-[10px] text-slate-500 font-bold tracking-widest mt-1 uppercase truncate max-w-sm">{ekspertizModalData.customer} - {ekspertizModalData.device}</p>
                  </div>
                </div>
                <button onClick={() => setEkspertizModalData(null)} className="text-slate-400 hover:text-red-500 hover:bg-red-50 bg-slate-50 border border-slate-200 p-3 rounded-xl transition-colors btn-click">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
             </div>
             
             <div className="grid grid-cols-2 md:grid-cols-3 gap-4 overflow-y-auto custom-scrollbar pr-2 max-h-[60vh]">
                {ekspertizModalData.data.split(' | ').map((detail, idx) => {
                    if(!detail.includes(':')) return null;
                    const [key, val] = detail.split(':');
                    
                    let valColor = "text-slate-700";
                    if (['Mükemmel', 'Sağlam', 'Evet', '95-100', 'Fiziksel SIM (TR)', 'Üretici Garantili'].includes(val)) valColor = "text-emerald-600";
                    else if (['Kötü', 'Kırık', 'Bilinmeyen Parça', 'Hayır', 'Arızalı', 'Garanti Yok'].includes(val)) valColor = "text-rose-600";
                    else if (['İyi', 'Çizikler var', 'Cızırtı var', 'Bilinmeyen Parça'].includes(val)) valColor = "text-amber-600";

                    return (
                        <div key={idx} className="bg-slate-50 border border-slate-200 p-4 rounded-2xl flex flex-col gap-1.5 hover:border-slate-400 transition-colors">
                            <span className="text-[9px] text-slate-500 font-black uppercase tracking-widest">{key}</span>
                            <span className={`text-sm font-black uppercase tracking-tight ${valColor}`}>{val}</span>
                        </div>
                    )
                })}
             </div>
          </div>
        </div>
      )}

      {appMode === 'alim' && (
        <div id="print-area">
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'20px'}}>
              <div>
                <h1 style={{fontSize:'36px', fontWeight:'900', fontStyle:'italic', margin:0, letterSpacing:'-2px'}}>
                  {isZumay ? <span style={{color:'#dc2626'}}>ZUMAY</span> : <>CNETMOBIL <span style={{color:'#2563eb'}}>CMR</span></>}
                </h1>
                <p style={{fontSize:'10px', fontWeight:'bold', textTransform:'uppercase', margin:0, color:'#666', letterSpacing:'1px'}}>
                  {isZumay ? 'Zumay Cihaz Alım Formu' : 'Kurumsal Cihaz Alim Merkezi'}
                </p>
              </div>
              <div style={{textAlign:'right', fontSize:'10px', fontWeight:'bold'}}>
                <p style={{fontSize:'16px', fontWeight:'900', textTransform:'uppercase', margin:0}}>{selectedBranch}</p>
                <p style={{color:'#666'}}>{new Date().toLocaleDateString('tr-TR')} - {new Date().toLocaleTimeString('tr-TR', {hour:'2-digit', minute:'2-digit'})}</p>
              </div>
            </div>
            <div style={{borderTop:'4px solid black', marginBottom:'25px'}}></div>
            
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'30px', marginBottom:'20px'}}>
              <div style={{border:'2px solid black', padding:'15px', borderRadius:'15px'}}>
                <h3 style={{fontSize:'12px', fontWeight:'900', textTransform:'uppercase', fontStyle:'italic', marginBottom:'10px', borderBottom:'1px solid #ddd', paddingBottom:'5px'}}>👤 Satıcı Bilgileri</h3>
                <div style={{fontSize:'11px', fontWeight:'bold', lineHeight:'1.8'}}>
                  <p>Ad Soyad: <span style={{textTransform:'uppercase', fontWeight:'900', fontSize:'13px'}}>{customer.name || '________________'}</span></p>
                  <p>Telefon: {customer.phone || '________________'}</p>
                  <p>T.C. Kimlik No: ___________________________</p>
                </div>
              </div>
              <div style={{border:'2px solid black', padding:'15px', borderRadius:'15px'}}>
                <h3 style={{fontSize:'12px', fontWeight:'900', textTransform:'uppercase', fontStyle:'italic', marginBottom:'10px', borderBottom:'1px solid #ddd', paddingBottom:'5px'}}>📱 Cihaz Bilgileri</h3>
                <div style={{fontSize:'11px', fontWeight:'bold', lineHeight:'1.8'}}>
                  <p>Model: <span style={{fontWeight:'900', fontSize:'13px'}}>{selectedModelName} {selectedCapacity?.cap} {selectedModelName === "iPhone 13" ? `(${selectedColor})` : ''}</span></p>
                  <p>IMEI: <span style={{fontWeight:'900', fontSize:'12px'}}>{customer.imei || '________________'}</span></p>
                </div>
              </div>
            </div>

            <div style={{border:'2px solid black', padding:'15px', borderRadius:'15px', marginBottom:'20px'}}>
              <h3 style={{fontSize:'12px', fontWeight:'900', textTransform:'uppercase', fontStyle:'italic', marginBottom:'10px', borderBottom:'1px solid #ddd', paddingBottom:'5px'}}>🛠️ Teknik Ekspertiz Raporu</h3>
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px 40px', fontSize:'10px', fontWeight:'bold'}}>
                 <p>Cihaz Açılıyor mu: <span style={{fontWeight:'900'}}>{status.power}</span></p>
                 <p>Ekran Durumu: <span style={{fontWeight:'900'}}>{status.screen}</span></p>
                 <p>Kozmetik Durum: <span style={{fontWeight:'900'}}>{status.cosmetic}</span></p>
                 <p>Face ID / Touch ID: <span style={{fontWeight:'900'}}>{status.faceId}</span></p>
                 <p>Ahize / Buzzer: <span style={{fontWeight:'900'}}>{status.speaker}</span></p>
                 <p>Batarya Sağlığı: <span style={{fontWeight:'900'}}>{status.battery}</span></p>
                 <p>Kayıt Durumu: <span style={{fontWeight:'900'}}>{status.sim}</span></p>
                 <p>Garanti ve Durum: <span style={{fontWeight:'900'}}>{status.warranty}</span></p>
              </div>
            </div>

            <div style={{display:'grid', gridTemplateColumns: purchaseType ? '1fr' : '1fr 1fr', gap:'20px', marginBottom:'30px', textAlign:'center'}}>
                {purchaseType === 'NAKİT' && (
                  <div style={{border:'3px solid black', padding:'15px', borderRadius:'15px'}}>
                    <p style={{fontSize:'10px', fontWeight:'900', textTransform:'uppercase', marginBottom:'3px', color:'#666'}}>Ödenecek Nakit Tutarı</p>
                    <p style={{fontSize:'28px', fontWeight:'900', fontStyle:'italic', margin:0}}>{finalCashPrice.toLocaleString()} TL</p>
                  </div>
                )}
                {purchaseType === 'TAKAS' && (
                  <div style={{border:'3px solid black', padding:'15px', borderRadius:'15px', backgroundColor:'#f8f8f8'}}>
                    <p style={{fontSize:'10px', fontWeight:'900', textTransform:'uppercase', marginBottom:'3px', color:'#666'}}>Takas Bedeli</p>
                    <p style={{fontSize:'28px', fontWeight:'900', fontStyle:'italic', margin:0}}>{finalTradePrice.toLocaleString()} TL</p>
                  </div>
                )}
            </div>

            <div style={{fontSize:'9px', fontWeight:'900', fontStyle:'italic', lineHeight:'1.5', marginBottom:'60px', backgroundColor:'#fdfdfd', padding:'15px', border:'1px solid #eee', borderRadius:'10px'}}>
              BEYAN VE TAAHHÜT: Cihaz mülkiyeti şahsıma ait olup, yukarıda belirtilen teknik durumun doğruluğunu ve tüm yasal sorumluluğu kabul ederim. Cihazdaki verilerin silinmesinden satıcı sorumlu tutulamaz.
            </div>
            
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'100px', textAlign:'center'}}>
              <div style={{borderTop:'2px solid black', paddingTop:'10px', fontWeight:'900', fontSize:'12px', textTransform:'uppercase', fontStyle:'italic'}}>Müşteri İmza</div>
              <div style={{borderTop:'2px solid black', paddingTop:'10px', fontWeight:'900', fontSize:'12px', textTransform:'uppercase', fontStyle:'italic'}}>{isZumay ? 'ZUMAY YETKİLİ' : 'CNETMOBIL YETKİLİ'}</div>
            </div>
        </div>
      )}

      {adminSheetEditor && (
        <AdminDynamicSheetEditor
          target={adminSheetEditor}
          onClose={() => setAdminSheetEditor(null)}
          onSaved={async () => {
            await refreshDataCache();
          }}
        />
      )}
    </div>
  );
}
