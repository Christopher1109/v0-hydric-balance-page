-- Script completo para recrear todas las tablas del sistema de balance hídrico
-- Ejecutar este script si se borraron las tablas de la base de datos

-- Eliminar tablas existentes (si existen)
DROP TABLE IF EXISTS eventos_balance CASCADE;
DROP TABLE IF EXISTS pacientes CASCADE;
DROP TABLE IF EXISTS dispositivos CASCADE;
DROP TABLE IF EXISTS hydric_balance_readings CASCADE;

-- 1. TABLA DE DISPOSITIVOS (Sensores ThingSpeak pre-configurados)
CREATE TABLE IF NOT EXISTS dispositivos (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL UNIQUE,
  descripcion TEXT,
  channel_id VARCHAR(50) NOT NULL,
  api_key VARCHAR(100) NOT NULL,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insertar Dispositivo 1 con los datos proporcionados
INSERT INTO dispositivos (nombre, descripcion, channel_id, api_key, activo)
VALUES (
  'Dispositivo 1',
  'Monitor de balance hídrico principal',
  '2134108',
  'WUJJWM73A2AE1589',
  true
) ON CONFLICT (nombre) DO NOTHING;

-- 2. TABLA DE PACIENTES
CREATE TABLE IF NOT EXISTS pacientes (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(200) NOT NULL,
  edad INTEGER NOT NULL CHECK (edad > 0 AND edad < 150),
  genero VARCHAR(20),
  peso DECIMAL(5,2) NOT NULL CHECK (peso > 0),
  talla INTEGER NOT NULL CHECK (talla > 0),
  imc DECIMAL(5,2),
  dispositivo_id INTEGER REFERENCES dispositivos(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. TABLA DE EVENTOS DE BALANCE
CREATE TABLE IF NOT EXISTS eventos_balance (
  id SERIAL PRIMARY KEY,
  paciente_id INTEGER NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
  tipo_movimiento VARCHAR(20) NOT NULL CHECK (tipo_movimiento IN ('ingreso', 'egreso')),
  volumen_ml INTEGER NOT NULL CHECK (volumen_ml >= 0),
  categoria VARCHAR(100),
  descripcion TEXT,
  origen_dato VARCHAR(20) DEFAULT 'manual' CHECK (origen_dato IN ('manual', 'sensor')),
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_eventos_paciente ON eventos_balance(paciente_id);
CREATE INDEX IF NOT EXISTS idx_eventos_timestamp ON eventos_balance(timestamp);
CREATE INDEX IF NOT EXISTS idx_eventos_tipo ON eventos_balance(tipo_movimiento);
CREATE INDEX IF NOT EXISTS idx_eventos_origen ON eventos_balance(origen_dato);
CREATE INDEX IF NOT EXISTS idx_pacientes_dispositivo ON pacientes(dispositivo_id);

-- Comentarios para documentación
COMMENT ON TABLE dispositivos IS 'Dispositivos ThingSpeak pre-configurados para monitoreo automático';
COMMENT ON TABLE pacientes IS 'Información demográfica y clínica de pacientes monitoreados';
COMMENT ON TABLE eventos_balance IS 'Registro de todos los eventos de ingreso y egreso de líquidos';

COMMENT ON COLUMN eventos_balance.origen_dato IS 'Indica si el dato proviene del sensor (ThingSpeak) o fue registrado manualmente';
COMMENT ON COLUMN eventos_balance.tipo_movimiento IS 'Tipo de evento: ingreso (entrada de líquidos) o egreso (salida de líquidos)';
