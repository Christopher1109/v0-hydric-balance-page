-- Agregar campos de ThingSpeak directamente a la tabla pacientes
ALTER TABLE pacientes 
ADD COLUMN IF NOT EXISTS thingspeak_channel_id TEXT,
ADD COLUMN IF NOT EXISTS thingspeak_api_key TEXT,
ADD COLUMN IF NOT EXISTS ultimo_timestamp_leido TIMESTAMP WITH TIME ZONE;

-- Índice para consultas de sincronización
CREATE INDEX IF NOT EXISTS idx_pacientes_thingspeak ON pacientes(thingspeak_channel_id) 
WHERE thingspeak_channel_id IS NOT NULL;
