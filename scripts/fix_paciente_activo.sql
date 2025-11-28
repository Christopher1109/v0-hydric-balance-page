-- ====================================
-- SCRIPT DE CORRECCIÓN
-- Activar paciente para sincronización ThingSpeak
-- ====================================

-- Paso 1: Ver estado actual del paciente ID 8
SELECT id, nombre, activo, dispositivo_id, edad_anios, peso_kg
FROM pacientes 
WHERE id = 8;

-- Paso 2: Activar el paciente
UPDATE pacientes 
SET activo = true 
WHERE id = 8;

-- Paso 3: Verificar que se aplicó el cambio
SELECT id, nombre, activo, dispositivo_id
FROM pacientes 
WHERE id = 8;

-- Paso 4: Ver dispositivo asociado
SELECT d.id, d.nombre, d.channel_id, d.api_key, d.activo,
       p.id as paciente_id, p.nombre as paciente_nombre, p.activo as paciente_activo
FROM dispositivos d
LEFT JOIN pacientes p ON p.dispositivo_id = d.id
WHERE d.channel_id = '2134108';

-- Paso 5: Ver eventos actuales del paciente
SELECT 
    COUNT(*) as total_eventos,
    SUM(CASE WHEN origen_dato = 'sensor' THEN 1 ELSE 0 END) as eventos_sensor,
    SUM(CASE WHEN origen_dato = 'manual' THEN 1 ELSE 0 END) as eventos_manual,
    MAX(thingspeak_entry_id) as ultimo_entry_id_procesado
FROM eventos_balance
WHERE paciente_id = 8;

-- Paso 6: Ver últimos eventos del sensor (si existen)
SELECT id, volumen_ml, categoria, thingspeak_entry_id, timestamp
FROM eventos_balance
WHERE paciente_id = 8 
  AND origen_dato = 'sensor'
ORDER BY thingspeak_entry_id DESC
LIMIT 10;

-- ====================================
-- OPCIONAL: Activar TODOS los pacientes con dispositivo
-- ====================================
-- Descomenta las siguientes líneas si quieres activar todos los pacientes que tengan dispositivo asignado:

-- UPDATE pacientes 
-- SET activo = true 
-- WHERE dispositivo_id IS NOT NULL;

-- SELECT id, nombre, activo, dispositivo_id 
-- FROM pacientes 
-- WHERE dispositivo_id IS NOT NULL;
