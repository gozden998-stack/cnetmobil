// app/api/wingsm/deger-puanim/route.ts
//
// CNETMOBIL - WingSM "Değer Puanım" (personel-facing kişisel rapor)
//
// AMAÇ:
// Artık CANLI hesaplama YAPMAZ. Admin, app/api/wingsm/deger-puan-report/
// route.ts'teki "HESAPLA" ile raporu hesapladığında, o uç TAM cevabını
// public.wingsm_deger_puan_snapshots tablosuna (period başına bir satır)
// kaydeder. Bu uç sadece EN SON kaydedilen snapshot'ı okur, kendi
// mağazasına indirger ve admin-only alanları (detailRows/unmatched*)
// ATARAK döner. Hiçbir WingSM çağrısı, hiçbir puan/hedef hesaplaması
// burada YAPILMAZ — hepsi admin'in hesaplama anında zaten yapıldı.
//
// GÜVENLİK / KAPSAM (bkz. eski POST sürümünün AYNI yorumu — sınır DEĞİŞMEDİ):
// - Hem admin hem personel oturumuna açık (requireValidSession) — ama
//   personel oturumu için hedef mağaza HER ZAMAN session.branch'tir,
//   query'de gelebilecek herhangi bir branchLabel YOK SAYILIR. Sadece admin
//   oturumu isteğe bağlı ?branchLabel= (önizleme) gönderebilir.
// - Cevapta detailRows / unmatchedSample / unmatchedCount YOK — bunlar
//   admin-only, satış başına kâr içeren tanılama verisi.
// - Cevaptaki personnel dizisi SADECE hedef mağazaya aittir (diğer 3
//   mağazanın personel listesi asla dönmez).
// - stores dizisi 4 mağazanın TOPLAM (agregat) rakamlarını içerebilir —
//   bu mağaza-seviyesi veridir, kişi bazlı değildir (genel lider tablosu
//   için gerekli).

import { NextRequest } from "next/server";

import { getPool, json, requireValidSession } from "../score-rules/_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

// ======================================================
// SABİT: deger-puan-report/route.ts ile AYNI (bu özellik SADECE CMR için).
// ======================================================

const CMR_BRANCH_LABELS = new Set(["CMR MERKEZ", "CMR CADDE", "CMR SARAY", "CMR KAPAKLI"]);

// ======================================================
// TİPLER — deger-puan-report/route.ts'in cevap şeklinden (snapshot'a
// olduğu gibi kaydedilen payload) sadece burada ihtiyaç duyulan alanlar.
// ======================================================

type StoreRow = {
  branchLabel: string;
  depotCode: string;
  saleCount: number;
  totalScore: number;
  multiplier: number;
  carpanliPuan: number;
  hedef: number | null;
  projeksiyon: number;
  hedefYuzdesi: number | null;
  siralamaPuani: number;
};

type PersonnelRow = {
  branchLabel: string;
  saticiKod: string;
  saticiAdi: string;
  saleCount: number;
  totalScore: number;
  carpanliPuan: number;
  hedef: number | null;
  isManager: boolean;
  hedefYuzdesi: number | null;
  projeksiyon: number;
  siralama: number | null;
  siralamaPuani: number;
};

type SnapshotPayload = {
  success: boolean;
  hedefPeriodu: string;
  gunBilgisi: { gecenGun: number; ayToplamGun: number; kalanGun: number };
  period: { tarih: string; tarih2: string };
  stores: StoreRow[];
  personnel: PersonnelRow[];
  totalSaleCount: number;
  totalScore: number;
  totalCarpanliPuan: number;
};

export async function GET(request: NextRequest) {
  const auth = requireValidSession(request);

  if (!auth.ok) {
    return auth.response;
  }

  try {
    // --------------------------------------------------
    // GÜVENLİK SINIRI: personel oturumu için hedef mağaza HER ZAMAN
    // session.branch'tir — query'deki ?branchLabel= HERHANGİ bir değer
    // YOK SAYILIR. Sadece admin oturumu isteğe bağlı branchLabel gönderebilir
    // (önizleme amaçlı), o da yoksa "CMR MERKEZ"e düşer.
    // --------------------------------------------------

    const url = new URL(request.url);
    const queryBranchLabel = url.searchParams.get("branchLabel");

    const myBranch =
      auth.session.role === "personel"
        ? auth.session.branch
        : queryBranchLabel && queryBranchLabel.trim()
        ? queryBranchLabel.trim()
        : "CMR MERKEZ";

    if (!CMR_BRANCH_LABELS.has(myBranch)) {
      return json(
        { success: false, error: `Geçersiz veya desteklenmeyen mağaza: "${myBranch}".` },
        403
      );
    }

    // --------------------------------------------------
    // EN SON SNAPSHOT'I OKU — tablo henüz yoksa (admin hiç HESAPLA
    // demediyse) ya da boşsa, hata DEĞİL, "henüz hesaplanmadı" durumu
    // döneriz (bkz. görev açıklaması).
    // --------------------------------------------------

    const pool = getPool();

    let snapshotRow: { payload: SnapshotPayload; computed_at: string } | null = null;

    try {
      const result = await pool.query(
        `SELECT payload, computed_at FROM public.wingsm_deger_puan_snapshots ORDER BY computed_at DESC LIMIT 1`
      );
      snapshotRow = result.rows[0] ?? null;
    } catch {
      // Tablo yok (admin hiç hesaplamadı) — hasSnapshot: false ile devam.
      snapshotRow = null;
    }

    if (!snapshotRow) {
      return json({
        success: true,
        hasSnapshot: false,
        computedAt: null,
        myBranch,
        hedefPeriodu: null,
        gunBilgisi: null,
        stores: [],
        personnel: [],
        genelLider: null,
        totalSaleCount: 0,
        totalScore: 0,
        totalCarpanliPuan: 0,
      });
    }

    const payload = snapshotRow.payload;

    // payload sürücüsü (pg) JSONB'yi zaten obje olarak döner, ama savunmacı
    // olmak için string gelirse de (bazı sürücü/ayar kombinasyonlarında
    // olabiliyor) parse ediyoruz.
    const snapshot: SnapshotPayload =
      typeof payload === "string" ? JSON.parse(payload) : payload;

    const allPersonnel = Array.isArray(snapshot.personnel) ? snapshot.personnel : [];
    const stores = Array.isArray(snapshot.stores) ? snapshot.stores : [];

    // --------------------------------------------------
    // GÜVENLİK: NİHAİ CEVABIN personnel dizisi SADECE myBranch'e ait —
    // diğer mağazaların personel listesi burada FİLTRELENİR, client'a hiç
    // ulaşmaz. detailRows/unmatched* zaten bu tipte YOK (asla kopyalanmadı).
    // --------------------------------------------------
    const personnel = allPersonnel.filter((p) => p.branchLabel === myBranch);

    // Genel Lider: TÜM 4 mağaza arasında, sıralanabilir (müdür değil, hedef
    // yüzdesi null değil) personelin en yüksek hedef yüzdesine sahip olanı —
    // deger-puan-report/route.ts'in personnel[] sıralamasından (hedefi
    // olanlar önce, yüzdeye göre azalan) TÜREYEBİLİR, ama burada bağımsız ve
    // net biçimde yeniden hesaplanır (eski POST sürümüyle BİREBİR AYNI mantık).
    const rankableEverywhere = allPersonnel.filter((p) => !p.isManager && p.hedefYuzdesi !== null);
    let genelLider: { saticiAdi: string; branchLabel: string; carpanliPuan: number; hedefYuzdesi: number } | null =
      null;
    for (const p of rankableEverywhere) {
      if (!genelLider || (p.hedefYuzdesi ?? 0) > genelLider.hedefYuzdesi) {
        genelLider = {
          saticiAdi: p.saticiAdi,
          branchLabel: p.branchLabel,
          carpanliPuan: p.carpanliPuan,
          hedefYuzdesi: p.hedefYuzdesi ?? 0,
        };
      }
    }

    const totalSaleCount = stores.reduce((sum, s) => sum + s.saleCount, 0);
    const totalScore = stores.reduce((sum, s) => sum + s.totalScore, 0);
    const totalCarpanliPuan = stores.reduce((sum, s) => sum + s.carpanliPuan, 0);

    return json({
      success: true,
      hasSnapshot: true,
      computedAt: new Date(snapshotRow.computed_at).toISOString(),
      myBranch,
      hedefPeriodu: snapshot.hedefPeriodu,
      gunBilgisi: snapshot.gunBilgisi,
      stores,
      personnel,
      genelLider,
      totalSaleCount,
      totalScore,
      totalCarpanliPuan,
    });
  } catch (error) {
    console.error("WINGSM_DEGER_PUANIM_ERROR:", error);

    return json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Değer Puanım raporu alınamadı.",
      },
      500
    );
  }
}
