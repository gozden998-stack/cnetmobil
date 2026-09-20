-- scripts/wingsm_score_rules.sql
--
-- CNETMOBIL - WingSM "Değer Puan" kural tablosu
--
-- Bu script MANUEL olarak orkestrasyon oturumu tarafından production
-- veritabanına çalıştırılır. Bu ajan hiçbir canlı veritabanına bağlanmadı
-- ve bu dosyayı hiçbir yere uygulamadı.
--
-- AMAÇ
-- ----
-- Bugüne kadar "cmr değer puan HAZİRAN2026 (2).xlsm" Excel makrosunda elle
-- tutulan (Mal Sınıfı, Kâr aralığı) -> Puan eşleme tablosunu buraya taşımak.
-- Bu tablo salt bir kural deposu — hesap motoru bu görevin kapsamı DIŞINDA;
-- sadece admin ekranından CRUD ile yönetilebilecek kaynak veri burada durur.
--
-- SÜTUN ANLAMLARI
-- ----------------
-- class_code   : WingSM "MalSinif" alanının normalize edilmiş hâli.
--                Sayısal kodlarda baştaki sıfırlar atılır ("0006" -> "6").
--                Alfanumerik kodlar ("1el","2el","8el","6el") aynen kalır.
-- class_label  : İnsan-okunur sınıf adı (ör. "AKSESUAR").
-- profit_min   : Kâr (KarlilikI) aralığının DAHİL alt sınırı.
-- profit_max   : Kâr (KarlilikI) aralığının DAHİL üst sınırı.
-- score        : Bu (sınıf, aralık) çifti için "Değer Puan".
--
-- AÇIK UÇLU ARALIK KURALI
-- ------------------------
-- İlk aralık (<= -3000) ve son aralık (> 12000) açık uçludur. Bunlar için
-- sentinel olarak -999999999 / 999999999 kullanılıyor (NULL değil) — böylece
-- "WHERE profit_min <= :kar AND :kar <= profit_max" gibi basit bir aralık
-- sorgusu NULL kontrolüne gerek kalmadan her zaman çalışır.
--
-- ARALIK SINIRLARININ ÇAKIŞMAMASI (ÖNEMLİ - YARGI KARARI)
-- ----------------------------------------------------------
-- Excel'deki 12 sınır ("<=-3000, -3000..-100, -100..0, 0..100, 100..300,
-- 300..750, 750..1500, 1500..3000, 3000..5000, 5000..8000, 8000..12000,
-- >12000") "üst sınır dahil" olarak tarif edildi. Bu sınırları hem alt hem
-- üst sınırı DAHİL olan bir şemaya (profit_min/profit_max ikisi de dahil)
-- birebir aktarırsak, ardışık aralıklar tam sınır değerinde (ör. -3000)
-- ÇAKIŞIR ve hangi aralığın geçerli olacağı belirsizleşir.
--
-- Bunu önlemek için: bir üst aralığın ALT sınırı, bir önceki aralığın ÜST
-- sınırına 0.01 eklenerek belirlendi (KarlilikI ondalıklı TL değeri taşıdığı
-- için - örnek veride "-113.25" görülüyor - kuruş hassasiyeti yeterli).
-- Böylece her aralık birbirinden ayrık ve her ikisi de dahil sınırlarla
-- tam olarak tanımlı: [-999999999, -3000], [-2999.99, -100], [-99.99, 0],
-- [0.01, 100], [100.01, 300], [300.01, 750], [750.01, 1500],
-- [1500.01, 3000], [3000.01, 5000], [5000.01, 8000], [8000.01, 12000],
-- [12000.01, 999999999].
--
-- İLK ARALIK (<= -3000) İÇİN PUAN - DÜZELTME
-- ---------------------------------------------
-- Bu script'i üreten ajana verilen görev talimatında "ilk aralığın hiçbir
-- sınıf için Excel'de değeri yok" diye HATALI bir not vardı; bu, orkestrasyon
-- oturumunun kendi hatasıydı. Gerçek Excel kaynağında ("cmr değer puan
-- HAZİRAN2026 (2).xlsm") AKSESUAR HARİÇ her sınıfın ilk aralığı için de
-- gerçek, sıfır olmayan bir değer var: SIFIR CİHAZ=20, 2. EL CİHAZ=10,
-- SABİT TELEFONLAR=5, TEMLİK AKSESUAR=5 (AKSESUAR zaten gerçekten 0).
-- Ajan bu hatalı notu olduğu gibi uygulayıp 4 sınıfın ilk aralığını 0'a
-- indirmişti; bu dosya, ilk yayından SONRA bu 4 satır düzeltilerek
-- güncellenmiştir. Aşağıdaki INSERT'ler artık doğru (Excel'le birebir
-- eşleşen) değerleri içeriyor.
--
-- ======================================================

CREATE TABLE IF NOT EXISTS public.wingsm_score_rules (
  id SERIAL PRIMARY KEY,
  class_code TEXT NOT NULL,
  class_label TEXT NOT NULL,
  profit_min NUMERIC NOT NULL,   -- dahil alt sınır; açık uç için -999999999
  profit_max NUMERIC NOT NULL,   -- dahil üst sınır; açık uç için 999999999
  score NUMERIC NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT wingsm_score_rules_range_chk CHECK (profit_min < profit_max),
  CONSTRAINT wingsm_score_rules_score_chk CHECK (score >= 0)
);

CREATE INDEX IF NOT EXISTS idx_wingsm_score_rules_class_code
  ON public.wingsm_score_rules (class_code)
  WHERE active;

-- Bir sınıfın aralıkları çakışmasın diye ekstra bir UNIQUE constraint
-- BİLEREK eklenmedi (Postgres'te sıradan bir UNIQUE ile aralık çakışması
-- engellenemez, EXCLUDE USING gist + btree_gist gerekir ve bu, admin'in
-- geçici olarak çakışan bir taslak aralık girip düzeltmesini de
-- engelleyebilir). Çakışma kontrolü CRUD API katmanında yapılabilir;
-- bu script sadece şema + seed verisidir.

-- ======================================================
-- SEED VERİSİ - 5 sınıf x 12 aralık = 60 satır
-- ======================================================

-- ------------------------------------------------------
-- SINIF: 6 (AKSESUAR)
-- Excel değerleri: 0, 0, 3, 8, 12, 18, 20, 25, 30, 35, 40, 40
-- ------------------------------------------------------
INSERT INTO public.wingsm_score_rules (class_code, class_label, profit_min, profit_max, score) VALUES
  ('6', 'AKSESUAR', -999999999, -3000,        0),
  ('6', 'AKSESUAR', -2999.99,   -100,         0),
  ('6', 'AKSESUAR', -99.99,     0,            3),
  ('6', 'AKSESUAR', 0.01,       100,          8),
  ('6', 'AKSESUAR', 100.01,     300,          12),
  ('6', 'AKSESUAR', 300.01,     750,          18),
  ('6', 'AKSESUAR', 750.01,     1500,         20),
  ('6', 'AKSESUAR', 1500.01,    3000,         25),
  ('6', 'AKSESUAR', 3000.01,    5000,         30),
  ('6', 'AKSESUAR', 5000.01,    8000,         35),
  ('6', 'AKSESUAR', 8000.01,    12000,        40),
  ('6', 'AKSESUAR', 12000.01,   999999999,    40);

-- ------------------------------------------------------
-- SINIF: 1el (SIFIR CİHAZ)
-- Excel değerleri: 20, 20, 20, 20, 20, 22, 25, 30, 30, 35, 40, 50
-- ------------------------------------------------------
INSERT INTO public.wingsm_score_rules (class_code, class_label, profit_min, profit_max, score) VALUES
  ('1el', 'SIFIR CİHAZ', -999999999, -3000,     20),
  ('1el', 'SIFIR CİHAZ', -2999.99,   -100,      20),
  ('1el', 'SIFIR CİHAZ', -99.99,     0,         20),
  ('1el', 'SIFIR CİHAZ', 0.01,       100,       20),
  ('1el', 'SIFIR CİHAZ', 100.01,     300,       20),
  ('1el', 'SIFIR CİHAZ', 300.01,     750,       22),
  ('1el', 'SIFIR CİHAZ', 750.01,     1500,      25),
  ('1el', 'SIFIR CİHAZ', 1500.01,    3000,      30),
  ('1el', 'SIFIR CİHAZ', 3000.01,    5000,      30),
  ('1el', 'SIFIR CİHAZ', 5000.01,    8000,      35),
  ('1el', 'SIFIR CİHAZ', 8000.01,    12000,     40),
  ('1el', 'SIFIR CİHAZ', 12000.01,   999999999, 50);

-- ------------------------------------------------------
-- SINIF: 2el (2. EL CİHAZ)
-- Excel değerleri: 10, 10, 10, 12, 14, 16, 20, 30, 60, 75, 90, 110
-- ------------------------------------------------------
INSERT INTO public.wingsm_score_rules (class_code, class_label, profit_min, profit_max, score) VALUES
  ('2el', '2. EL CİHAZ', -999999999, -3000,     10),
  ('2el', '2. EL CİHAZ', -2999.99,   -100,      10),
  ('2el', '2. EL CİHAZ', -99.99,     0,         10),
  ('2el', '2. EL CİHAZ', 0.01,       100,       12),
  ('2el', '2. EL CİHAZ', 100.01,     300,       14),
  ('2el', '2. EL CİHAZ', 300.01,     750,       16),
  ('2el', '2. EL CİHAZ', 750.01,     1500,      20),
  ('2el', '2. EL CİHAZ', 1500.01,    3000,      30),
  ('2el', '2. EL CİHAZ', 3000.01,    5000,      60),
  ('2el', '2. EL CİHAZ', 5000.01,    8000,      75),
  ('2el', '2. EL CİHAZ', 8000.01,    12000,     90),
  ('2el', '2. EL CİHAZ', 12000.01,   999999999, 110);

-- ------------------------------------------------------
-- SINIF: 8el (SABİT TELEFONLAR)
-- Excel değerleri: 5, 3, 5, 7, 10, 15, 20, 20, 20, 20, 20, 20
-- ------------------------------------------------------
INSERT INTO public.wingsm_score_rules (class_code, class_label, profit_min, profit_max, score) VALUES
  ('8el', 'SABİT TELEFONLAR', -999999999, -3000,     5),
  ('8el', 'SABİT TELEFONLAR', -2999.99,   -100,      3),
  ('8el', 'SABİT TELEFONLAR', -99.99,     0,         5),
  ('8el', 'SABİT TELEFONLAR', 0.01,       100,       7),
  ('8el', 'SABİT TELEFONLAR', 100.01,     300,       10),
  ('8el', 'SABİT TELEFONLAR', 300.01,     750,       15),
  ('8el', 'SABİT TELEFONLAR', 750.01,     1500,      20),
  ('8el', 'SABİT TELEFONLAR', 1500.01,    3000,      20),
  ('8el', 'SABİT TELEFONLAR', 3000.01,    5000,      20),
  ('8el', 'SABİT TELEFONLAR', 5000.01,    8000,      20),
  ('8el', 'SABİT TELEFONLAR', 8000.01,    12000,     20),
  ('8el', 'SABİT TELEFONLAR', 12000.01,   999999999, 20);

-- ------------------------------------------------------
-- SINIF: 6el (TEMLİK AKSESUAR)
-- Excel değerleri: 5, 5, 10, 12, 14, 18, 20, 20, 25, 30, 35, 40
-- ------------------------------------------------------
INSERT INTO public.wingsm_score_rules (class_code, class_label, profit_min, profit_max, score) VALUES
  ('6el', 'TEMLİK AKSESUAR', -999999999, -3000,     5),
  ('6el', 'TEMLİK AKSESUAR', -2999.99,   -100,      5),
  ('6el', 'TEMLİK AKSESUAR', -99.99,     0,         10),
  ('6el', 'TEMLİK AKSESUAR', 0.01,       100,       12),
  ('6el', 'TEMLİK AKSESUAR', 100.01,     300,       14),
  ('6el', 'TEMLİK AKSESUAR', 300.01,     750,       18),
  ('6el', 'TEMLİK AKSESUAR', 750.01,     1500,      20),
  ('6el', 'TEMLİK AKSESUAR', 1500.01,    3000,      20),
  ('6el', 'TEMLİK AKSESUAR', 3000.01,    5000,      25),
  ('6el', 'TEMLİK AKSESUAR', 5000.01,    8000,      30),
  ('6el', 'TEMLİK AKSESUAR', 8000.01,    12000,     35),
  ('6el', 'TEMLİK AKSESUAR', 12000.01,   999999999, 40);
