-- Agregar relación con dispositivos a la tabla pacientes
ALTER TABLE pacientes 
  DROP COLUMN IF EXISTS thingspeak_channel_id,
  DROP COLUMN IF EXISTS thingspeak_api_key,
  ADD COLUMN IF NOT EXISTS dispositivo_id INTEGER REFERENCES dispositivos(id);
