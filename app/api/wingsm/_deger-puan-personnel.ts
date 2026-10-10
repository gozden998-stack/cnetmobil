// app/api/wingsm/_deger-puan-personnel.ts
//
// CNETMOBIL - WingSM Değer Puan - PERSONEL KİMLİĞİ ve MAĞAZA BİRLEŞTİRME
//
// Excel'deki gibi bir personel İSMİYLE tek satırdır: farklı bir mağazaya gidip
// satış yaparsa o satışın puanı yine KENDİ adına yazılır (mağaza fark etmez).
// Puan çarpanı ise satışın YAPILDIĞI mağazaya göre uygulanır (Excel makrosu da
// her satış satırını o satırın mağaza çarpanıyla çarpıyor).
//
// Kişinin tabloda görünen "mağazası" = en çok puan topladığı mağaza (eşitlikte
// en çok satış yaptığı, o da eşitse ilk görülen).
//
// Bu dosya "_" ile başladığı için Next.js tarafından route sayılmaz; hiçbir
// dış bağımlılığı yoktur (ayrı test edilebilsin diye).

// Kişi/mağaza adlarını büyük/küçük harf ve boşluk farkına duyarsız karşılaştırır.
export function normalizeName(value: string): string {
  return value.trim().toLocaleUpperCase("tr-TR").replace(/\s+/g, " ");
}

// Kişinin kimliği: önce ad (mağazalar arası aynı), ad yoksa satıcı kodu.
export function personnelIdentityKey(saticiAdi: string, saticiKod: string): string {
  const name = normalizeName(saticiAdi);

  return name ? name : `KOD:${saticiKod.trim()}`;
}

export type BranchStat = { score: number; count: number };

// Bir kişinin mağaza bazlı toplamlarına bir satış ekler.
export function addBranchSale(stats: Map<string, BranchStat>, branchLabel: string, score: number) {
  const current = stats.get(branchLabel);

  if (current) {
    current.score += score;
    current.count += 1;
  } else {
    stats.set(branchLabel, { score, count: 1 });
  }
}

// En çok puan topladığı mağaza (eşitlikte satış adedi, sonra ilk görülen).
export function pickPrimaryBranch(stats: Map<string, BranchStat>): string {
  let best: string | null = null;
  let bestStat: BranchStat | null = null;

  for (const [branch, stat] of stats) {
    if (
      bestStat === null ||
      stat.score > bestStat.score ||
      (stat.score === bestStat.score && stat.count > bestStat.count)
    ) {
      best = branch;
      bestStat = stat;
    }
  }

  return best ?? "";
}

export type PersonnelTargetEntry = { branchLabel: string; hedef: number; isManager: boolean };

// Hedef tablosunda aynı isim birden fazla mağazada kayıtlıysa, kişinin ana
// mağazasındakini seç; yoksa ilkini. Hiç kayıt yoksa null.
export function pickTarget(
  entries: PersonnelTargetEntry[] | undefined,
  primaryBranch: string
): PersonnelTargetEntry | null {
  if (!entries || entries.length === 0) return null;

  return entries.find((entry) => entry.branchLabel === primaryBranch) ?? entries[0];
}
