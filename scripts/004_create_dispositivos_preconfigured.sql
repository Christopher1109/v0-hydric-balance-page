-- Eliminar tabla existente si hay conflictos
DROP TABLE IF EXISTS dispositivos CASCADE;

-- Crear tabla de dispositivos pre-configurados
CREATE TABLE dispositivos (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL UNIQUE,
  channel_id TEXT NOT NULL,
  api_key TEXT NOT NULL,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insertar el Dispositivo 1 con tus datos de ThingSpeak
INSERT INTO dispositivos (id, nombre, channel_id, api_key, activo)
VALUES (1, 'Dispositivo 1', '2134108', 'WUJJWM73A2AE1589', true);

-- Reiniciar la secuencia del ID para futuros inserts
SELECT setval('dispositivos_id_seq', (SELECT MAX(id) FROM dispositivos));
