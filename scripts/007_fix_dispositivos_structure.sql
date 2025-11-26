-- Limpiar la estructura incorrecta y crear la correcta

-- Eliminar relación incorrecta en dispositivos
ALTER TABLE dispositivos DROP COLUMN IF EXISTS paciente_id;

-- Eliminar columnas incorrectas de dispositivos
ALTER TABLE dispositivos 
  DROP COLUMN IF EXISTS tipo,
  DROP COLUMN IF EXISTS ubicacion,
  DROP COLUMN IF EXISTS ultimo_timestamp_leido,
  DROP COLUMN IF EXISTS fecha_creacion;

-- Renombrar columnas en dispositivos para usar nombres correctos
ALTER TABLE dispositivos 
  RENAME COLUMN thingspeak_channel_id TO channel_id;

ALTER TABLE dispositivos 
  RENAME COLUMN thingspeak_read_api_key TO api_key;

-- Asegurar que dispositivos tenga las columnas correctas
ALTER TABLE dispositivos 
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- Actualizar datos existentes con la configuración correcta
UPDATE dispositivos SET 
  channel_id = '2134108',
  api_key = 'WUJJWM73A2AE1589',
  activo = true
WHERE id IN (1, 2, 3);

-- Asegurar que nombre tenga valores correctos
UPDATE dispositivos SET nombre = 'Dispositivo ' || id WHERE nombre IS NULL OR nombre = '';
