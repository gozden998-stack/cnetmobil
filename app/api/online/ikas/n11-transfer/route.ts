-- CNETMOBIL / ONLINE ADIM 8.0 REVIZE
-- KANAL BAZLI IMEI UYELIGI
--
-- Amaç:
-- Aynı fiziksel IMEI N11 ve İkas'ta ayrı ayrı LISTED olabilir.
-- Bir kanalda ürün açılması diğer kanalda otomatik ürün açmaz.
-- Her kanalın fiyatı ayrıdır.
--
-- Örnek:
-- IMEI 35...
--   N11  -> LISTED, 22.999 TL
--   IKAS -> LISTED, 21.999 TL
--
-- Sipariş motoru sonraki adımda aynı stock_device_id üzerinden
-- diğer kanal üyeliğini bulup stok düşürecek.
--
-- Mevcut N11 / IKAS listing kayıtlarına ve canlı API'lere dokunmaz.

BEGIN;

CREATE TABLE IF NOT EXISTS public.online_channel_devices (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

  stock_device_id BIGINT NOT NULL
    REFERENCES public.stock_devices(id)
    ON DELETE CASCADE,

  imei TEXT NOT NULL,

  channel TEXT NOT NULL,
  online_listing_id BIGINT NULL
    REFERENCES public.online_listings(id)
    ON DELETE SET NULL,

  membership_status TEXT NOT NULL DEFAULT 'PENDING_CREATE',

  channel_sale_price NUMERIC(14,2) NULL,
  channel_list_price NUMERIC(14,2) NULL,

  source_channel TEXT NULL,
  source_listing_id BIGINT NULL
    REFERENCES public.online_listings(id)
    ON DELETE SET NULL,

  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  listed_at TIMESTAMPTZ NULL,
  reserved_at TIMESTAMPTZ NULL,
  sold_at TIMESTAMPTZ NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_online_channel_device
    UNIQUE (channel, stock_device_id),

  CONSTRAINT uq_online_channel_imei
    UNIQUE (channel, imei)
);

CREATE INDEX IF NOT EXISTS
  idx_online_channel_devices_stock_device
ON public.online_channel_devices(stock_device_id);

CREATE INDEX IF NOT EXISTS
  idx_online_channel_devices_channel_status
ON public.online_channel_devices(channel, membership_status);

CREATE INDEX IF NOT EXISTS
  idx_online_channel_devices_listing
ON public.online_channel_devices(online_listing_id);

CREATE INDEX IF NOT EXISTS
  idx_online_channel_devices_source_listing
ON public.online_channel_devices(source_listing_id);

COMMIT;
