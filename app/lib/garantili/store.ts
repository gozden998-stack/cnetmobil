// app/lib/garantili/store.ts
//
// CNETMOBIL - Garantili tabloları
//   garantili_devices   : WingSM/Merkez IMEI'sinin Garantili'de açılma durumu (IMEI başına tek satır)
//   garantili_model_map : (marka|model|hafıza|renk) -> Garantili id eşlemesi (bir kez seçilince hatırlanır)

import type { Pool } from "pg";

import { norm, normMemory } from "./catalog";

let ready = false;

export async function ensureGarantiliTables(pool: Pool) {
  if (ready) return;

  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.garantili_devices (
      imei TEXT PRIMARY KEY,
      status TEXT NOT NULL DEFAULT 'OPENING',
      min_fiyat NUMERIC(12,2),
      on_kutulama INTEGER,
      marka_id INTEGER,
      model_id INTEGER,
      hafiza_id INTEGER,
      renk_id INTEGER,
      garantili_response JSONB,
      error TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT garantili_devices_status_chk
        CHECK (status IN ('OPENING', 'OPEN', 'FAILED', 'REMOVE_REQUESTED', 'CLOSED', 'SOLD'))
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.garantili_model_map (
      map_key TEXT PRIMARY KEY,
      marka_id INTEGER,
      model_id INTEGER,
      hafiza_id INTEGER,
      renk_id INTEGER,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  ready = true;
}

export function mapKey(device: { brand: string; model: string; memory: string; color: string }) {
  return [norm(device.brand), norm(device.model), normMemory(device.memory), norm(device.color)].join("|");
}
