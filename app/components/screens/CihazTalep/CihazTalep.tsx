"use client";

import React, { useState } from "react";
import {
  downloadCihazTalepTemplate,
  parseCihazTalepBulkXlsx,
  type CihazTalepBulkRow,
} from "./cihazTalepExcel";

type CihazTalepProps = {
  cihazTalepData: any[][];
  setCihazTalepData: React.Dispatch<React.SetStateAction<any[][]>>;
  selectedBranch: string;
  isAdmin: boolean;
  isMasterAccess: boolean;
  isSuperAdminUser: boolean;
  refreshDataCache: () => Promise<void>;
  sheetFetchedAtRef: React.MutableRefObject<Record<string, number>>;
  loadSheetsForCurrentScreen: (force?: boolean) => Promise<void>;
};

export default function CihazTalep({
  cihazTalepData,
  setCihazTalepData,
  selectedBranch,
  isAdmin,
  isMasterAccess,
  isSuperAdminUser,
  refreshDataCache,
  sheetFetchedAtRef,
  loadSheetsForCurrentScreen,
}: CihazTalepProps) {
const [talepSaving, setTalepSaving] = useState(false);
const [gonderildiLoadingIndex, setGonderildiLoadingIndex] = useState<number | null>(null);
const [redLoadingIndex, setRedLoadingIndex] = useState<number | null>(null);
const [deleteTalepLoadingIndex, setDeleteTalepLoadingIndex] = useState<number | null>(null);
const [aktifTaleplerModalOpen, setAktifTaleplerModalOpen] = useState(false);
// --- CİHAZ TALEP V2 GÖRÜNÜM STATE'LERİ ---
const [cihazTalepSearch, setCihazTalepSearch] = useState('');
const [cihazTalepMarkaFilter, setCihazTalepMarkaFilter] = useState('TÜMÜ');
const [cihazTalepHafizaFilter, setCihazTalepHafizaFilter] = useState('TÜMÜ');
const [cihazTalepRenkFilter, setCihazTalepRenkFilter] = useState('TÜMÜ');
const [cihazTalepDurumFilter, setCihazTalepDurumFilter] = useState('TÜMÜ');
const [cihazTalepPage, setCihazTalepPage] = useState(1);
const [cihazTalepPerPage, setCihazTalepPerPage] = useState(10);

type CihazTalepDialog =
  | null
  | { type: 'adet'; rowIndex: number; modelName: string; stokAdedi: number }
  | { type: 'gonder'; rowIndex: number; cihazAdi: string; magaza: string }
  | { type: 'red'; rowIndex: number; cihazAdi: string; magaza: string }
  | { type: 'cihaz_ekle' }
  | { type: 'cihaz_toplu_ekle' }
  | { type: 'message'; title: string; message: string; tone?: 'success' | 'error' | 'info' };

const [cihazTalepDialog, setCihazTalepDialog] = useState<CihazTalepDialog>(null);
const [talepAdetInput, setTalepAdetInput] = useState('1');
const [redNedeniInput, setRedNedeniInput] = useState('');
const [cihazEkleSaving, setCihazEkleSaving] = useState(false);
const [bulkCihazFileName, setBulkCihazFileName] = useState('');
const [bulkCihazRows, setBulkCihazRows] = useState<CihazTalepBulkRow[]>([]);
const [bulkCihazError, setBulkCihazError] = useState('');
const [bulkCihazParsing, setBulkCihazParsing] = useState(false);
const [bulkCihazSaving, setBulkCihazSaving] = useState(false);
const [cihazEkleForm, setCihazEkleForm] = useState({
  markaModel: '', hafiza: '', renk: '', renkDiger: '', pil: '', grade: 'MÜKEMMEL',
  garanti: '', degisenParca: 'Orijinal / Yok', kutuFatura: '', stokAdet: '1'
});

const showTalepMessage = (title: string, message: string, tone: 'success' | 'error' | 'info' = 'info') => {
  setCihazTalepDialog({ type: 'message', title, message, tone });
};


const openCihazEkleModal = () => {
  if (!isAdmin && !isMasterAccess) {
    showTalepMessage('YETKİ GEREKLİ', 'Cihaz ekleme işlemi yalnızca yönetici girişi ile yapılabilir.', 'error');
    return;
  }
  setCihazEkleForm({
    markaModel: '', hafiza: '', renk: '', renkDiger: '', pil: '', grade: 'MÜKEMMEL',
    garanti: '', degisenParca: 'Orijinal / Yok', kutuFatura: '', stokAdet: '1'
  });
  setCihazTalepDialog({ type: 'cihaz_ekle' });
};


const openTopluCihazEkleModal = () => {
  if (!isAdmin && !isMasterAccess && !isSuperAdminUser) {
    showTalepMessage(
      'YETKİ GEREKLİ',
      'Toplu cihaz ekleme işlemi yalnızca yetkili yönetici tarafından yapılabilir.',
      'error'
    );
    return;
  }

  setBulkCihazFileName('');
  setBulkCihazRows([]);
  setBulkCihazError('');
  setBulkCihazParsing(false);
  setBulkCihazSaving(false);
  setCihazTalepDialog({
    type: 'cihaz_toplu_ekle',
  });
};

const handleTopluCihazExcelSec = async (
  file: File | null
) => {
  setBulkCihazRows([]);
  setBulkCihazError('');
  setBulkCihazFileName(
    file?.name || ''
  );

  if (!file) return;

  setBulkCihazParsing(true);

  try {
    const rows =
      await parseCihazTalepBulkXlsx(file);

    setBulkCihazRows(rows);
  } catch (error: any) {
    setBulkCihazError(
      error?.message ||
      'Excel dosyası okunamadı.'
    );
  } finally {
    setBulkCihazParsing(false);
  }
};

const submitTopluCihazEkle = async () => {
  if (
    !isAdmin &&
    !isMasterAccess &&
    !isSuperAdminUser
  ) {
    return;
  }

  if (!bulkCihazRows.length) {
    setBulkCihazError(
      'Önce doldurulmuş Excel şablonunu seçin.'
    );
    return;
  }

  if (
    !confirm(
      `${bulkCihazRows.length} cihaz Cihaz Talep listesine toplu eklenecek. Onaylıyor musunuz?`
    )
  ) {
    return;
  }

  setBulkCihazSaving(true);
  setBulkCihazError('');

  try {
    const response = await fetch(
      '/api/panel-action',
      {
        method: 'POST',
        headers: {
          'Content-Type':
            'application/json',
        },
        body: JSON.stringify({
          type: 'ADD_CIHAZ_TALEP_BULK',
          devices: bulkCihazRows,
        }),
      }
    );

    const result =
      await response.json().catch(
        () => ({})
      );

    if (
      !response.ok ||
      result?.result !== 'success'
    ) {
      throw new Error(
        result?.message ||
        'Toplu cihaz yükleme başarısız.'
      );
    }

    setCihazTalepDialog(null);
    setBulkCihazFileName('');
    setBulkCihazRows([]);
    setBulkCihazError('');

    await refreshDataCache();

    showTalepMessage(
      'TOPLU YÜKLEME TAMAMLANDI',
      `${Number(result?.addedCount || 0) || bulkCihazRows.length} cihaz başarıyla eklendi.`,
      'success'
    );
  } catch (error: any) {
    setBulkCihazError(
      error?.message ||
      'Toplu cihaz yükleme sırasında hata oluştu.'
    );
  } finally {
    setBulkCihazSaving(false);
  }
};

const submitCihazEkle = async () => {
  if (!isAdmin && !isMasterAccess) return;
  const markaModel = cihazEkleForm.markaModel.trim();
  const hafiza = cihazEkleForm.hafiza.trim();
  const renk = (cihazEkleForm.renk === 'DİĞER' ? cihazEkleForm.renkDiger : cihazEkleForm.renk).trim();
  const stokAdet = Number(cihazEkleForm.stokAdet);

  if (!markaModel || !hafiza || !renk) {
    return showTalepMessage('EKSİK BİLGİ', 'Marka / Model, Hafıza ve Renk alanları zorunludur.', 'error');
  }
  if (!Number.isInteger(stokAdet) || stokAdet < 1) {
    return showTalepMessage('GEÇERSİZ STOK', 'Stok adedi 1 veya daha büyük tam sayı olmalıdır.', 'error');
  }

  setCihazEkleSaving(true);
  try {
    const response = await fetch('/api/panel-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'ADD_CIHAZ_TALEP_DEVICE',
        markaModel,
        hafiza,
        renk,
        pil: cihazEkleForm.pil.trim(),
        grade: cihazEkleForm.grade.trim(),
        garanti: cihazEkleForm.garanti.trim(),
        degisenParca: cihazEkleForm.degisenParca.trim(),
        kutuFatura: cihazEkleForm.kutuFatura.trim(),
        stokAdet
      })
    });
    const result = await response.json();
    if (result.result !== 'success') {
      showTalepMessage('CİHAZ EKLENEMEDİ', result.message || 'Cihaz eklenemedi.', 'error');
      return;
    }
    setCihazTalepDialog(null);
    showTalepMessage('CİHAZ EKLENDİ', `${markaModel} (${hafiza} - ${renk}) ${stokAdet} adet stok ile eklendi.`, 'success');
  } catch (e) {
    console.error('Cihaz ekleme hatası:', e);
    showTalepMessage('BAĞLANTI HATASI', 'Cihaz eklenirken bağlantı hatası oluştu.', 'error');
  } finally {
    setCihazEkleSaving(false);
  }
};

const aktifTalepleriExcelIndir = () => {
  const rows = cihazTalepData.slice(1).filter((row) => {
    const magaza = String(row[9] || '').trim();
    const durum = String(row[11] || '').trim().toUpperCase();
    return magaza && !['RED EDİLDİ', 'REDDEDİLDİ', 'GÖNDERİLDİ', 'GONDERILDI'].includes(durum);
  });

  const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [
    ['Tarih','Mağaza','Marka Model','Hafıza','Renk','Grade','Stok','Talep Adet','Durum'].map(esc).join(';'),
    ...rows.map((row) => [row[10],row[9],row[0],row[1],row[2],row[4],row[8],row[14] || 1,row[11] || 'BEKLİYOR'].map(esc).join(';'))
  ];
  const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `aktif_talepler_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

const handleTalepGonder = (rowIndex: number, modelName: string, stokAdedi: number) => {
  const guvenliStok = Math.max(0, Number(stokAdedi) || 0);

  if (guvenliStok <= 0) {
    showTalepMessage('STOK YOK', 'Bu cihazın mevcut stoğu 0. Talep oluşturulamaz.', 'error');
    return;
  }

  setTalepAdetInput('1');
  setCihazTalepDialog({ type: 'adet', rowIndex, modelName, stokAdedi: guvenliStok });
};

const submitTalep = async () => {
  if (!cihazTalepDialog || cihazTalepDialog.type !== 'adet') return;

  const { rowIndex, modelName, stokAdedi } = cihazTalepDialog;
  const talepAdedi = Number(talepAdetInput);

  if (!Number.isInteger(talepAdedi) || talepAdedi < 1) {
    showTalepMessage('GEÇERSİZ ADET', 'Talep adedi 1 veya daha büyük tam sayı olmalıdır.', 'error');
    return;
  }

  if (talepAdedi > stokAdedi) {
    showTalepMessage('STOK YETERSİZ', `En fazla ${stokAdedi} adet talep edebilirsiniz.`, 'error');
    return;
  }

  setTalepSaving(true);

  try {
    const response = await fetch('/api/panel-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'SAVE_TALEP',
        rowIndex,
        branch: selectedBranch,
        adet: talepAdedi
      })
    });

    const result = await response.json();

    if (result.result !== 'success') {
      showTalepMessage('TALEP OLUŞTURULAMADI', result.message || 'Talep oluşturulamadı.', 'error');
      return;
    }

    await refreshDataCache();
    showTalepMessage('TALEP OLUŞTURULDU', `${modelName} için ${talepAdedi} adet talebiniz merkeze iletildi.`, 'success');
  } catch (e) {
    console.error('Talep gönderme hatası:', e);
    showTalepMessage('BAĞLANTI HATASI', 'Talep gönderilirken hata oluştu.', 'error');
  } finally {
    setTalepSaving(false);
  }
};

const handleGonderildi = (rowIndex: number, cihazAdi: string, magaza: string) => {
  if (!isAdmin && !isMasterAccess) {
    showTalepMessage('YETKİ GEREKLİ', 'Bu işlemi yalnızca yöneticiler gerçekleştirebilir.', 'error');
    return;
  }

  setCihazTalepDialog({ type: 'gonder', rowIndex, cihazAdi, magaza });
};

const submitGonderildi = async () => {
  if (!cihazTalepDialog || cihazTalepDialog.type !== 'gonder') return;

  const { rowIndex, magaza } = cihazTalepDialog;
  setGonderildiLoadingIndex(rowIndex);

  try {
    const response = await fetch('/api/panel-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'GONDER_TALEP', rowIndex })
    });

    const result = await response.json();

    if (result.result !== 'success') {
      showTalepMessage('İŞLEM BAŞARISIZ', result.message || 'İşlem gerçekleştirilemedi.', 'error');
      return;
    }

    await refreshDataCache();
    showTalepMessage('GÖNDERİLDİ', `${magaza} mağazasının talebi gönderildi olarak işaretlendi. Mağaza durumu anlık görecek.`, 'success');
  } catch (e) {
    console.error(e);
    showTalepMessage('İŞLEM HATASI', 'Gönderildi işlemi sırasında bir hata oluştu.', 'error');
  } finally {
    setGonderildiLoadingIndex(null);
  }
};

const handleTalepReddet = (rowIndex: number, cihazAdi: string, magaza: string) => {
  if (!isAdmin && !isMasterAccess) {
    showTalepMessage('YETKİ GEREKLİ', 'Bu işlemi yalnızca yöneticiler gerçekleştirebilir.', 'error');
    return;
  }

  setRedNedeniInput('');
  setCihazTalepDialog({ type: 'red', rowIndex, cihazAdi, magaza });
};

const submitTalepRed = async () => {
  if (!cihazTalepDialog || cihazTalepDialog.type !== 'red') return;

  const { rowIndex, magaza } = cihazTalepDialog;
  const temizNeden = redNedeniInput.trim();

  if (!temizNeden) {
    showTalepMessage('RED NEDENİ GEREKLİ', 'Lütfen mağazanın göreceği red nedenini yazın.', 'error');
    return;
  }

  setRedLoadingIndex(rowIndex);

  try {
    const response = await fetch('/api/panel-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'RED_TALEP',
        rowIndex,
        reason: temizNeden
      })
    });

    const result = await response.json();

    if (result.result !== 'success') {
      showTalepMessage('TALEP REDDEDİLEMEDİ', result.message || 'Talep reddedilemedi.', 'error');
      return;
    }

    await refreshDataCache();
    showTalepMessage('TALEP REDDEDİLDİ', `${magaza} mağazasına red nedeni ile birlikte iletildi.`, 'success');
  } catch (e) {
    console.error('Talep reddetme hatası:', e);
    showTalepMessage('İŞLEM HATASI', 'Talep reddedilirken hata oluştu.', 'error');
  } finally {
    setRedLoadingIndex(null);
  }
};

const handleTalepKaydiSil = async (rowIndex: number, cihazAdi: string, magaza: string) => {
  if (!isAdmin && !isMasterAccess) {
    alert("Bu kaydı yalnızca yönetici silebilir!");
    return;
  }

  if (!confirm(`${magaza} - ${cihazAdi} cihaz satırı TAMAMEN SİLİNECEK.\n\nGoogle Sheets'te bu satır silinecek ve alttaki satırlar otomatik yukarı kayacak. Yeni sunucu veritabanı ve tüm paneller de güncellenecek. Bu işlem geri alınamaz. Onaylıyor musunuz?`)) return;

  setDeleteTalepLoadingIndex(rowIndex);

  try {
    const response = await fetch('/api/panel-action', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        type: "DELETE_CIHAZ_ROW_FULL_V5",
        rowIndex: rowIndex
      })
    });

    const result = await response.json();

    if (result.result !== "success") {
      alert(result.message || "Talep kaydı silinemedi.");
      return;
    }

    // Satırı ekrandan da anında kaldır.
    setCihazTalepData(prev => prev.filter((_, i) => i !== rowIndex - 1));

    // V6: bütün panel cache'ini silme. Sadece CihazTalep sheet'ini zorla yenile.
    // Böylece diğer ekranlar gereksiz yere PostgreSQL'den tekrar çekilmez.
    sheetFetchedAtRef.current['CihazTalep'] = 0;
    await loadSheetsForCurrentScreen(true);

    alert("Cihaz satırı tamamen silindi. Alt satırlar güvenli şekilde yukarı kaydırıldı.");
  } catch (e) {
    console.error("Talep kaydı silme hatası:", e);
    alert("Talep kaydı silinirken hata oluştu.");
  } finally {
    setDeleteTalepLoadingIndex(null);
  }
};

  return (
    <>
      {screen_true}

{/* CİHAZ TALEP PROFESYONEL İŞLEM MODALI */}
{cihazTalepDialog && (
  <div className="fixed inset-0 z-[260] flex items-center justify-center bg-slate-950/65 backdrop-blur-md p-4 print:hidden">
    <div className={`w-full overflow-hidden rounded-[32px] border border-white/20 bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-200 ${
      cihazTalepDialog.type === 'cihaz_toplu_ekle'
        ? 'max-w-5xl'
        : 'max-w-md'
    }`}>
      {cihazTalepDialog.type === 'adet' && (
        <>
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-7 py-6 text-white">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/20">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
              </div>
              <div>
                <h3 className="text-xl font-black tracking-tight">CİHAZ TALEBİ</h3>
                <p className="mt-1 text-xs font-bold text-blue-100">Talep etmek istediğiniz adedi seçin</p>
              </div>
            </div>
          </div>
          <div className="p-7">
            <div className="mb-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">CİHAZ</p>
              <p className="mt-1 font-black text-slate-900">{cihazTalepDialog.modelName}</p>
              <div className="mt-3 flex items-center justify-between rounded-xl bg-white px-4 py-3 border border-slate-200">
                <span className="text-xs font-bold text-slate-500">Mevcut stok</span>
                <span className="text-lg font-black text-emerald-600">{cihazTalepDialog.stokAdedi} ADET</span>
              </div>
            </div>
            <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-500">TALEP ADEDİ</label>
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setTalepAdetInput(String(Math.max(1, (Number(talepAdetInput) || 1) - 1)))} className="h-14 w-14 rounded-2xl border border-slate-200 bg-slate-50 text-2xl font-black text-slate-700 hover:bg-slate-100">−</button>
              <input autoFocus type="number" min={1} max={cihazTalepDialog.stokAdedi} value={talepAdetInput} onChange={(e) => setTalepAdetInput(e.target.value)} className="h-14 flex-1 rounded-2xl border-2 border-slate-200 bg-white text-center text-2xl font-black text-slate-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50" />
              <button type="button" onClick={() => setTalepAdetInput(String(Math.min(cihazTalepDialog.stokAdedi, (Number(talepAdetInput) || 0) + 1)))} className="h-14 w-14 rounded-2xl border border-slate-200 bg-slate-50 text-2xl font-black text-slate-700 hover:bg-slate-100">+</button>
            </div>
            <div className="mt-6 flex gap-3">
              <button onClick={() => setCihazTalepDialog(null)} disabled={talepSaving} className="flex-1 rounded-2xl border border-slate-200 bg-white py-3.5 text-xs font-black uppercase tracking-widest text-slate-500 hover:bg-slate-50 disabled:opacity-50">İPTAL</button>
              <button onClick={submitTalep} disabled={talepSaving} className="flex-[1.4] rounded-2xl bg-blue-600 py-3.5 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-blue-200 hover:bg-blue-700 disabled:opacity-50">{talepSaving ? 'GÖNDERİLİYOR...' : 'TALEBİ OLUŞTUR'}</button>
            </div>
          </div>
        </>
      )}

      {cihazTalepDialog.type === 'gonder' && (
        <>
          <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-7 py-6 text-white">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/20">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              </div>
              <div><h3 className="text-xl font-black">GÖNDERİLDİ ONAYI</h3><p className="mt-1 text-xs font-bold text-emerald-100">İşlemi onaylamadan önce kontrol edin</p></div>
            </div>
          </div>
          <div className="p-7">
            <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <div className="flex justify-between gap-4"><span className="text-xs font-bold text-slate-400">MAĞAZA</span><span className="text-right text-sm font-black text-slate-900">{cihazTalepDialog.magaza}</span></div>
              <div className="flex justify-between gap-4"><span className="text-xs font-bold text-slate-400">CİHAZ</span><span className="text-right text-sm font-black text-slate-900">{cihazTalepDialog.cihazAdi}</span></div>
            </div>
            <p className="mt-4 text-sm font-semibold leading-relaxed text-slate-600">Talep <b>GÖNDERİLDİ</b> olarak işaretlenecek ve mağaza bu durumu anlık görecek.</p>
            <div className="mt-6 flex gap-3">
              <button onClick={() => setCihazTalepDialog(null)} disabled={gonderildiLoadingIndex !== null} className="flex-1 rounded-2xl border border-slate-200 py-3.5 text-xs font-black uppercase tracking-widest text-slate-500 hover:bg-slate-50 disabled:opacity-50">VAZGEÇ</button>
              <button onClick={submitGonderildi} disabled={gonderildiLoadingIndex !== null} className="flex-[1.4] rounded-2xl bg-emerald-600 py-3.5 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-emerald-200 hover:bg-emerald-700 disabled:opacity-50">{gonderildiLoadingIndex !== null ? 'İŞLENİYOR...' : 'GÖNDERİLDİ YAP'}</button>
            </div>
          </div>
        </>
      )}

      {cihazTalepDialog.type === 'red' && (
        <>
          <div className="bg-gradient-to-r from-red-600 to-rose-600 px-7 py-6 text-white">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/20">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </div>
              <div><h3 className="text-xl font-black">TALEBİ REDDET</h3><p className="mt-1 text-xs font-bold text-red-100">Red nedeni mağaza ekranında görünecek</p></div>
            </div>
          </div>
          <div className="p-7">
            <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
              <p><span className="font-bold text-slate-400">Mağaza:</span> <span className="font-black text-slate-900">{cihazTalepDialog.magaza}</span></p>
              <p className="mt-1"><span className="font-bold text-slate-400">Cihaz:</span> <span className="font-black text-slate-900">{cihazTalepDialog.cihazAdi}</span></p>
            </div>
            <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-500">RED NEDENİ</label>
            <textarea autoFocus value={redNedeniInput} onChange={(e) => setRedNedeniInput(e.target.value)} rows={4} maxLength={250} placeholder="Örn: Stok fazlası mevcut, cihaz başka işlem için ayrıldı..." className="w-full resize-none rounded-2xl border-2 border-slate-200 bg-white p-4 text-sm font-bold text-slate-800 outline-none placeholder:text-slate-300 focus:border-red-500 focus:ring-4 focus:ring-red-50" />
            <div className="mt-2 text-right text-[10px] font-bold text-slate-400">{redNedeniInput.length}/250</div>
            <div className="mt-5 flex gap-3">
              <button onClick={() => setCihazTalepDialog(null)} disabled={redLoadingIndex !== null} className="flex-1 rounded-2xl border border-slate-200 py-3.5 text-xs font-black uppercase tracking-widest text-slate-500 hover:bg-slate-50 disabled:opacity-50">VAZGEÇ</button>
              <button onClick={submitTalepRed} disabled={redLoadingIndex !== null || !redNedeniInput.trim()} className="flex-[1.4] rounded-2xl bg-red-600 py-3.5 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-red-200 hover:bg-red-700 disabled:opacity-40">{redLoadingIndex !== null ? 'REDDEDİLİYOR...' : 'REDDET'}</button>
            </div>
          </div>
        </>
      )}

      {cihazTalepDialog.type === 'cihaz_ekle' && (
        <>
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-7 py-6 text-white">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/20">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
              </div>
              <div><h3 className="text-xl font-black">YENİ CİHAZ EKLE</h3><p className="mt-1 text-xs font-bold text-blue-100">Cihaz Talep listesine tekli stok kaydı oluştur</p></div>
            </div>
          </div>
          <div className="p-6 max-h-[72vh] overflow-y-auto custom-scrollbar">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2"><label className="mb-1.5 block text-[9px] font-black uppercase tracking-widest text-slate-400">MARKA / MODEL *</label><input autoFocus value={cihazEkleForm.markaModel} onChange={e=>setCihazEkleForm(p=>({...p,markaModel:e.target.value}))} placeholder="Örn: iPhone 15 Pro" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black outline-none focus:border-blue-500 focus:bg-white" /></div>
              <div>
                <label className="mb-1.5 block text-[9px] font-black uppercase tracking-widest text-slate-400">HAFIZA *</label>
                <select value={cihazEkleForm.hafiza} onChange={e=>setCihazEkleForm(p=>({...p,hafiza:e.target.value}))} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black outline-none focus:border-blue-500 focus:bg-white">
                  <option value="">Hafıza seçin</option>
                  <option value="16GB">16GB</option><option value="32GB">32GB</option><option value="64GB">64GB</option><option value="128GB">128GB</option>
                  <option value="256GB">256GB</option><option value="512GB">512GB</option><option value="1TB">1TB</option><option value="2TB">2TB</option>
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-[9px] font-black uppercase tracking-widest text-slate-400">RENK *</label>
                <div className="relative">
                  {cihazEkleForm.renk && cihazEkleForm.renk !== 'DİĞER' && (
                    <span className="pointer-events-none absolute left-4 top-1/2 z-10 h-3.5 w-3.5 -translate-y-1/2 rounded-full border border-slate-300 shadow-sm" style={{ backgroundColor: ({
                      'SİYAH':'#111827','BEYAZ':'#ffffff','MAVİ':'#3b82f6','LACİVERT':'#1e3a8a','GRİ':'#6b7280','GÜMÜŞ':'#cbd5e1','ALTIN':'#d4af37','YEŞİL':'#22c55e','KIRMIZI':'#ef4444','MOR':'#8b5cf6','PEMBE':'#ec4899','SARI':'#eab308','TURUNCU':'#f97316','KAHVERENGİ':'#92400e','BEJ':'#d6c6a5','TİTANYUM':'#8c8c89','NATURAL TİTANYUM':'#a59f91','SİYAH TİTANYUM':'#4a4a47','BEYAZ TİTANYUM':'#e7e5df','MAVİ TİTANYUM':'#536878'
                    } as Record<string,string>)[cihazEkleForm.renk] || '#cbd5e1' }} />
                  )}
                  <select value={cihazEkleForm.renk} onChange={e=>setCihazEkleForm(p=>({...p,renk:e.target.value,renkDiger:e.target.value==='DİĞER'?p.renkDiger:''}))} className={`w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pr-4 text-sm font-black outline-none focus:border-blue-500 focus:bg-white ${cihazEkleForm.renk && cihazEkleForm.renk !== 'DİĞER' ? 'pl-10' : 'px-4'}`}>
                    <option value="">Renk seçin</option>
                    <option value="SİYAH">SİYAH</option><option value="BEYAZ">BEYAZ</option><option value="MAVİ">MAVİ</option><option value="LACİVERT">LACİVERT</option>
                    <option value="GRİ">GRİ</option><option value="GÜMÜŞ">GÜMÜŞ</option><option value="ALTIN">ALTIN</option><option value="YEŞİL">YEŞİL</option>
                    <option value="KIRMIZI">KIRMIZI</option><option value="MOR">MOR</option><option value="PEMBE">PEMBE</option><option value="SARI">SARI</option>
                    <option value="TURUNCU">TURUNCU</option><option value="KAHVERENGİ">KAHVERENGİ</option><option value="BEJ">BEJ</option><option value="TİTANYUM">TİTANYUM</option>
                    <option value="NATURAL TİTANYUM">NATURAL TİTANYUM</option><option value="SİYAH TİTANYUM">SİYAH TİTANYUM</option><option value="BEYAZ TİTANYUM">BEYAZ TİTANYUM</option><option value="MAVİ TİTANYUM">MAVİ TİTANYUM</option>
                    <option value="DİĞER">DİĞER / ÖZEL RENK</option>
                  </select>
                </div>
                {cihazEkleForm.renk === 'DİĞER' && (
                  <input autoFocus value={cihazEkleForm.renkDiger} onChange={e=>setCihazEkleForm(p=>({...p,renkDiger:e.target.value.toUpperCase()}))} placeholder="Özel rengi yazın" className="mt-2 w-full rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-black uppercase outline-none focus:border-blue-500 focus:bg-white" />
                )}
              </div>
              <div><label className="mb-1.5 block text-[9px] font-black uppercase tracking-widest text-slate-400">PİL</label><input value={cihazEkleForm.pil} onChange={e=>setCihazEkleForm(p=>({...p,pil:e.target.value}))} placeholder="%100" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-blue-500 focus:bg-white" /></div>
              <div><label className="mb-1.5 block text-[9px] font-black uppercase tracking-widest text-slate-400">GRADE</label><select value={cihazEkleForm.grade} onChange={e=>setCihazEkleForm(p=>({...p,grade:e.target.value}))} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black outline-none focus:border-blue-500"><option>OUTLET</option><option>İYİ</option><option>ÇOK İYİ</option><option>MÜKEMMEL</option></select></div>
              <div><label className="mb-1.5 block text-[9px] font-black uppercase tracking-widest text-slate-400">GARANTİ</label><input value={cihazEkleForm.garanti} onChange={e=>setCihazEkleForm(p=>({...p,garanti:e.target.value}))} placeholder="1 YIL" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-blue-500 focus:bg-white" /></div>
              <div><label className="mb-1.5 block text-[9px] font-black uppercase tracking-widest text-slate-400">STOK ADET *</label><input type="number" min={1} value={cihazEkleForm.stokAdet} onChange={e=>setCihazEkleForm(p=>({...p,stokAdet:e.target.value}))} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black outline-none focus:border-blue-500 focus:bg-white" /></div>
              <div className="sm:col-span-2"><label className="mb-1.5 block text-[9px] font-black uppercase tracking-widest text-slate-400">DEĞİŞEN PARÇA</label><input value={cihazEkleForm.degisenParca} onChange={e=>setCihazEkleForm(p=>({...p,degisenParca:e.target.value}))} placeholder="Orijinal / Yok" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-blue-500 focus:bg-white" /></div>
              <div className="sm:col-span-2"><label className="mb-1.5 block text-[9px] font-black uppercase tracking-widest text-slate-400">KUTU / FATURA</label><input value={cihazEkleForm.kutuFatura} onChange={e=>setCihazEkleForm(p=>({...p,kutuFatura:e.target.value}))} placeholder="Kutu Var / Fatura Yok" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-blue-500 focus:bg-white" /></div>
            </div>
            <div className="mt-6 flex gap-3">
              <button onClick={()=>setCihazTalepDialog(null)} disabled={cihazEkleSaving} className="flex-1 rounded-2xl border border-slate-200 py-3.5 text-xs font-black uppercase tracking-widest text-slate-500 hover:bg-slate-50 disabled:opacity-50">VAZGEÇ</button>
              <button onClick={submitCihazEkle} disabled={cihazEkleSaving} className="flex-[1.4] rounded-2xl bg-blue-600 py-3.5 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-blue-200 hover:bg-blue-700 disabled:opacity-50">{cihazEkleSaving ? 'EKLENİYOR...' : 'CİHAZI EKLE'}</button>
            </div>
          </div>
        </>
      )}


      {cihazTalepDialog.type === 'cihaz_toplu_ekle' && (
        <>
          <div className="bg-gradient-to-r from-[#15345d] via-blue-700 to-indigo-700 px-6 py-5 text-white sm:px-8 sm:py-6">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/20">
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.3} d="M4 5h16v14H4zM8 9h8M8 13h8M8 17h5" />
                  </svg>
                </div>

                <div>
                  <h3 className="text-xl font-black sm:text-2xl">
                    TOPLU CİHAZ EKLE
                  </h3>
                  <p className="mt-1 text-xs font-bold text-blue-100">
                    Excel şablonunu indir, doldur ve tek seferde yükle
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (!bulkCihazSaving) {
                    setCihazTalepDialog(null);
                  }
                }}
                disabled={bulkCihazSaving}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-lg font-black text-white transition hover:bg-white/20 disabled:opacity-50"
              >
                ×
              </button>
            </div>
          </div>

          <div className="max-h-[76vh] overflow-y-auto p-5 custom-scrollbar sm:p-7">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <section className="rounded-[24px] border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white">
                  <span className="text-sm font-black">1</span>
                </div>

                <h4 className="mt-4 text-base font-black text-slate-900">
                  Excel Şablonunu İndir
                </h4>

                <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">
                  Başlıkları değiştirmeden cihazları satır satır doldurun.
                  Marka / Model, Hafıza, Renk ve Stok Adet zorunludur.
                </p>

                <button
                  type="button"
                  onClick={downloadCihazTalepTemplate}
                  className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 text-xs font-black uppercase tracking-wider text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-700"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" />
                  </svg>
                  Şablonu İndir
                </button>
              </section>

              <section className="rounded-[24px] border border-violet-100 bg-gradient-to-br from-violet-50 to-white p-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600 text-white">
                  <span className="text-sm font-black">2</span>
                </div>

                <h4 className="mt-4 text-base font-black text-slate-900">
                  Doldurulmuş Excel'i Yükle
                </h4>

                <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">
                  Dosyanızı .xlsx olarak kaydedin. Sistem satırları kontrol eder,
                  hata varsa yüklemeden önce size gösterir.
                </p>

                <label className="mt-5 flex min-h-[48px] cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-violet-200 bg-white px-5 text-xs font-black text-violet-700 transition hover:border-violet-400 hover:bg-violet-50">
                  <input
                    type="file"
                    accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    className="hidden"
                    disabled={bulkCihazSaving || bulkCihazParsing}
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      handleTopluCihazExcelSec(file);
                      e.currentTarget.value = '';
                    }}
                  />

                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M12 16V4m0 0L8 8m4-4l4 4M5 20h14" />
                  </svg>

                  {bulkCihazParsing
                    ? 'EXCEL OKUNUYOR...'
                    : 'EXCEL DOSYASI SEÇ'}
                </label>

                {bulkCihazFileName && (
                  <div className="mt-3 truncate rounded-xl bg-white px-3 py-2 text-[10px] font-bold text-slate-500 ring-1 ring-slate-100">
                    {bulkCihazFileName}
                  </div>
                )}
              </section>
            </div>

            {bulkCihazError && (
              <div className="mt-4 whitespace-pre-line rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-bold leading-5 text-red-700">
                {bulkCihazError}
              </div>
            )}

            {bulkCihazRows.length > 0 && !bulkCihazError && (
              <section className="mt-5 overflow-hidden rounded-[24px] border border-emerald-100 bg-white">
                <div className="flex flex-col gap-3 border-b border-slate-100 bg-emerald-50/60 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-sm font-black text-emerald-800">
                      Excel Hazır
                    </div>
                    <div className="mt-0.5 text-[10px] font-bold text-emerald-600">
                      {bulkCihazRows.length} cihaz doğrulandı ve yüklemeye hazır.
                    </div>
                  </div>

                  <span className="w-fit rounded-full bg-emerald-600 px-3 py-1.5 text-[9px] font-black uppercase tracking-wider text-white">
                    {bulkCihazRows.length} KAYIT
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[900px] text-left text-[10px]">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50">
                        <th className="px-4 py-3 font-black text-slate-500">#</th>
                        <th className="px-4 py-3 font-black text-slate-500">MARKA / MODEL</th>
                        <th className="px-4 py-3 font-black text-slate-500">HAFIZA</th>
                        <th className="px-4 py-3 font-black text-slate-500">RENK</th>
                        <th className="px-4 py-3 font-black text-slate-500">PİL</th>
                        <th className="px-4 py-3 font-black text-slate-500">GRADE</th>
                        <th className="px-4 py-3 font-black text-slate-500">GARANTİ</th>
                        <th className="px-4 py-3 font-black text-slate-500">STOK</th>
                      </tr>
                    </thead>

                    <tbody>
                      {bulkCihazRows.slice(0, 8).map((item, index) => (
                        <tr
                          key={`${item.markaModel}-${index}`}
                          className="border-b border-slate-50"
                        >
                          <td className="px-4 py-3 font-black text-slate-400">
                            {index + 1}
                          </td>
                          <td className="px-4 py-3 font-black text-slate-900">
                            {item.markaModel}
                          </td>
                          <td className="px-4 py-3 font-bold text-slate-600">
                            {item.hafiza}
                          </td>
                          <td className="px-4 py-3 font-bold text-slate-600">
                            {item.renk}
                          </td>
                          <td className="px-4 py-3 font-bold text-slate-600">
                            {item.pil || '-'}
                          </td>
                          <td className="px-4 py-3 font-bold text-slate-600">
                            {item.grade || '-'}
                          </td>
                          <td className="px-4 py-3 font-bold text-slate-600">
                            {item.garanti || '-'}
                          </td>
                          <td className="px-4 py-3">
                            <span className="rounded-lg bg-blue-50 px-2 py-1 font-black text-blue-700">
                              {item.stokAdet} ADET
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {bulkCihazRows.length > 8 && (
                  <div className="border-t border-slate-100 bg-slate-50 px-5 py-3 text-center text-[9px] font-bold text-slate-400">
                    Önizlemede ilk 8 kayıt gösteriliyor. Toplam {bulkCihazRows.length} cihaz yüklenecek.
                  </div>
                )}
              </section>
            )}

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setCihazTalepDialog(null)}
                disabled={bulkCihazSaving}
                className="h-12 rounded-2xl border border-slate-200 px-6 text-xs font-black uppercase tracking-wider text-slate-500 transition hover:bg-slate-50 disabled:opacity-50"
              >
                Vazgeç
              </button>

              <button
                type="button"
                onClick={submitTopluCihazEkle}
                disabled={
                  bulkCihazSaving ||
                  bulkCihazParsing ||
                  !bulkCihazRows.length ||
                  !!bulkCihazError
                }
                className="h-12 rounded-2xl bg-emerald-600 px-7 text-xs font-black uppercase tracking-wider text-white shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {bulkCihazSaving
                  ? `${bulkCihazRows.length} CİHAZ YÜKLENİYOR...`
                  : `${bulkCihazRows.length || 0} CİHAZI TOPLU YÜKLE`}
              </button>
            </div>
          </div>
        </>
      )}

      {cihazTalepDialog.type === 'message' && (() => {
        const isError = cihazTalepDialog.tone === 'error';
        const isSuccess = cihazTalepDialog.tone === 'success';
        return (
          <div className="p-8 text-center">
            <div className={`mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-3xl ${isError ? 'bg-red-50 text-red-600' : isSuccess ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}>
              {isError ? <span className="text-3xl font-black">!</span> : isSuccess ? <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg> : <span className="text-2xl font-black">i</span>}
            </div>
            <h3 className="text-xl font-black text-slate-900">{cihazTalepDialog.title}</h3>
            <p className="mx-auto mt-3 max-w-sm text-sm font-semibold leading-relaxed text-slate-500">{cihazTalepDialog.message}</p>
            <button onClick={() => setCihazTalepDialog(null)} className={`mt-7 w-full rounded-2xl py-3.5 text-xs font-black uppercase tracking-widest text-white ${isError ? 'bg-red-600 hover:bg-red-700' : isSuccess ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-blue-600 hover:bg-blue-700'}`}>TAMAM</button>
          </div>
        );
      })()}
    </div>
  </div>
)}

{/* AKTİF TALEPLER DETAY MODALI (YÖNETİCİYE ÖZEL - GÖNDERİLDİ İŞLEMLİ) */}
{aktifTaleplerModalOpen && (
  <div className="fixed inset-0 z-[140] flex items-center justify-center bg-slate-900/80 backdrop-blur-md p-4 print:hidden">
    <div className="bg-white rounded-[40px] shadow-2xl p-8 w-full max-w-5xl relative animate-in fade-in zoom-in duration-300 border border-slate-100 flex flex-col max-h-[85vh]">
      <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-5 shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
          </div>
          <div>
            <h3 className="text-2xl font-black italic text-slate-900 uppercase tracking-tighter">AKTİF TALEPLER LİSTESİ</h3>
            <p className="text-[10px] text-slate-500 font-bold tracking-widest mt-1 uppercase">Şubeler tarafından oluşturulan aktif cihaz talepleri</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={aktifTalepleriExcelIndir} className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors">EXCEL İNDİR</button>
          <button onClick={() => setAktifTaleplerModalOpen(false)} className="text-slate-400 hover:text-red-500 hover:bg-red-50 bg-slate-50 border border-slate-200 p-3 rounded-2xl transition-all btn-click">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      </div>

      <div className="overflow-x-auto custom-scrollbar flex-1 pb-2">
        <div className="min-w-[950px]">
          <div className="bg-emerald-600 text-white grid grid-cols-7 px-5 py-3 rounded-2xl text-[10px] font-black tracking-widest uppercase shadow-md items-center">
            <div>TARİH / SAAT</div>
            <div>MAĞAZA</div>
            <div>MARKA / MODEL</div>
            <div>HAFIZA</div>
            <div>RENK</div>
            <div className="text-center">ADET</div>
            <div className="text-right pr-2">İŞLEM</div>
          </div>

          <div className="flex flex-col mt-2">
            {cihazTalepData.map((row, originalIndex) => {
              if (originalIndex === 0) return null; // Header atla
              const magazaAdi = (row[9] || '').toString().trim();
              const talepDurumu = (row[11] || '').toString().trim().toUpperCase();
              const isRejected = talepDurumu === 'RED EDİLDİ' || talepDurumu === 'REDDEDİLDİ';
              const isSent = talepDurumu === 'GÖNDERİLDİ' || talepDurumu === 'GONDERILDI';
              if (!magazaAdi || isRejected || isSent) return null; // Sadece bekleyen aktif talepler

              const rowIndex = originalIndex + 1; // Sheets satır numarası
              const markaModel = row[0] || '-';
              const hafiza = row[1] || '-';
              const renk = row[2] || '-';
              const tarihSaat = row[10] || new Date().toLocaleString('tr-TR');
              const talepAdedi = Math.max(1, Number(row[14]) || 1);
              const isProcessing = gonderildiLoadingIndex === rowIndex || redLoadingIndex === rowIndex;

              return (
                <div key={originalIndex} className="grid grid-cols-7 items-center px-5 py-3.5 border-b border-slate-100 hover:bg-slate-50 text-xs font-bold text-slate-700">
                  <div className="text-slate-500 font-medium">{tarihSaat}</div>
                  <div className="font-black text-slate-900">{magazaAdi}</div>
                  <div className="font-black text-slate-800">{markaModel}</div>
                  <div>{hafiza}</div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-slate-600">{renk}</span>
                  </div>
                  <div className="text-center">
                    <span className="inline-flex px-2.5 py-1 rounded-lg bg-white/80 border border-emerald-200 text-emerald-700 font-black">{talepAdedi} ADET</span>
                  </div>
                  <div className="flex items-center justify-end gap-2 pr-2">
                    <button
                      disabled={isProcessing}
                      onClick={() => handleGonderildi(rowIndex, `${markaModel} (${hafiza})`, magazaAdi)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-xl text-[9px] font-black tracking-widest uppercase transition-all btn-click shadow-sm disabled:opacity-50 whitespace-nowrap"
                    >
                      {gonderildiLoadingIndex === rowIndex ? 'GÖNDERİLİYOR...' : 'GÖNDERİLDİ'}
                    </button>
                    <button
                      disabled={isProcessing}
                      onClick={() => handleTalepReddet(rowIndex, `${markaModel} (${hafiza})`, magazaAdi)}
                      className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-xl text-[9px] font-black tracking-widest uppercase transition-all btn-click shadow-sm disabled:opacity-50 whitespace-nowrap"
                    >
                      {redLoadingIndex === rowIndex ? 'REDDEDİLİYOR...' : 'RED'}
                    </button>
                  </div>
                </div>
              );
            })}

            {cihazTalepData.slice(1).filter(r => { const b=(r[9] || '').toString().trim(); const d=(r[11] || '').toString().trim().toUpperCase(); return b !== '' && d !== 'RED EDİLDİ' && d !== 'REDDEDİLDİ' && d !== 'GÖNDERİLDİ' && d !== 'GONDERILDI'; }).length === 0 && (
              <div className="text-center py-16 text-slate-400 font-bold uppercase tracking-widest text-xs">
                Aktif talep bulunmuyor.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  </div>
)}
    </>
  );
}
