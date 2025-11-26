-- Tabla de eventos de balance hídrico
CREATE TABLE IF NOT EXISTS eventos_balance (
  id SERIAL PRIMARY KEY,
  paciente_id INTEGER NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
  tipo_movimiento TEXT NOT NULL CHECK (tipo_movimiento IN ('ingreso', 'egreso')),
  categoria TEXT NOT NULL,
  volumen_ml NUMERIC(10,2) NOT NULL,
  peso_g NUMERIC(10,2),
  origen_dato TEXT NOT NULL CHECK (origen_dato IN ('sensor', 'manual')),
  notas TEXT,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para mejorar consultas
CREATE INDEX IF NOT EXISTS idx_eventos_paciente ON eventos_balance(paciente_id);
CREATE INDEX IF NOT EXISTS idx_eventos_timestamp ON eventos_balance(timestamp);
CREATE INDEX IF NOT EXISTS idx_eventos_tipo ON eventos_balance(tipo_movimiento);
