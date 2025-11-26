-- ==============================================
-- SCRIPT COMPLETO DE CONFIGURACIÓN
-- Base de Datos: Balance Hídrico
-- Proyecto: gyndbleotjqbznhtvirf
-- ==============================================

-- 1. TABLA DE DISPOSITIVOS IoT
-- ==============================================
CREATE TABLE IF NOT EXISTS dispositivos (
  id BIGSERIAL PRIMARY KEY,
  nombre VARCHAR(255) NOT NULL,
  channel_id VARCHAR(50) NOT NULL UNIQUE,
  read_api_key VARCHAR(50) NOT NULL,
  write_api_key VARCHAR(50),
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insertar dispositivo por defecto con tus credenciales de ThingSpeak
INSERT INTO dispositivos (nombre, channel_id, read_api_key, write_api_key)
VALUES ('Dispositivo 1', '2802062', '9XZYHNNZS2PSCL87', 'C9I40L51U2XZHSYZ')
ON CONFLICT (channel_id) DO NOTHING;

-- 2. TABLA DE PACIENTES
-- ==============================================
CREATE TABLE IF NOT EXISTS pacientes (
  id BIGSERIAL PRIMARY KEY,
  nombre VARCHAR(255) NOT NULL,
  edad INTEGER NOT NULL CHECK (edad >= 0),
  peso NUMERIC(5,2) NOT NULL CHECK (peso > 0),
  talla NUMERIC(5,2) NOT NULL CHECK (talla > 0),
  sexo VARCHAR(1) NOT NULL CHECK (sexo IN ('M', 'F')),
  dispositivo_id BIGINT REFERENCES dispositivos(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índice para buscar pacientes por dispositivo
CREATE INDEX IF NOT EXISTS idx_pacientes_dispositivo ON pacientes(dispositivo_id);

-- 3. TABLA DE EVENTOS DE BALANCE HÍDRICO
-- ==============================================
CREATE TABLE IF NOT EXISTS eventos_balance (
  id BIGSERIAL PRIMARY KEY,
  paciente_id BIGINT NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
  tipo_movimiento VARCHAR(20) NOT NULL CHECK (tipo_movimiento IN ('ingreso', 'egreso')),
  volumen_ml NUMERIC(10,2) NOT NULL CHECK (volumen_ml >= 0),
  descripcion TEXT,
  origen_dato VARCHAR(20) NOT NULL CHECK (origen_dato IN ('manual', 'sensor')),
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  thingspeak_entry_id INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_eventos_paciente ON eventos_balance(paciente_id);
CREATE INDEX IF NOT EXISTS idx_eventos_timestamp ON eventos_balance(timestamp);
CREATE INDEX IF NOT EXISTS idx_eventos_tipo ON eventos_balance(tipo_movimiento);
CREATE INDEX IF NOT EXISTS idx_eventos_origen ON eventos_balance(origen_dato);
CREATE INDEX IF NOT EXISTS idx_eventos_thingspeak ON eventos_balance(thingspeak_entry_id);

-- ==============================================
-- VERIFICACIÓN DE TABLAS CREADAS
-- ==============================================
SELECT 'Tablas creadas correctamente:' as status;
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
