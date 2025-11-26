-- Agregar foreign key constraint entre pacientes y dispositivos
ALTER TABLE pacientes 
  DROP CONSTRAINT IF EXISTS pacientes_dispositivo_id_fkey;

ALTER TABLE pacientes 
  ADD CONSTRAINT pacientes_dispositivo_id_fkey 
  FOREIGN KEY (dispositivo_id) 
  REFERENCES dispositivos(id) 
  ON DELETE SET NULL;
