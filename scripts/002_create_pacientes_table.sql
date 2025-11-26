-- Tabla de pacientes con información demográfica
CREATE TABLE IF NOT EXISTS pacientes (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  edad_anios INTEGER NOT NULL,
  peso_kg NUMERIC(5,2) NOT NULL,
  talla_cm NUMERIC(5,2) NOT NULL,
  imc NUMERIC(5,2) NOT NULL,
  fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índice para mejorar consultas
CREATE INDEX IF NOT EXISTS idx_pacientes_id ON pacientes(id);
