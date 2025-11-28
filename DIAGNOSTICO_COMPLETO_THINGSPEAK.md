# 🔍 DIAGNÓSTICO COMPLETO - INTEGRACIÓN THINGSPEAK

## 📊 RESUMEN EJECUTIVO

**PROBLEMA IDENTIFICADO:** El paciente ID 8 NO está marcado como `activo: true` en la base de datos.

**IMPACTO:** La sincronización automática con ThingSpeak NO procesa datos porque el código busca pacientes con `activo = true` y asociados al dispositivo.

**SOLUCIÓN:** Ejecutar script SQL de corrección + verificación del flujo completo.

---

## 🚨 PROBLEMA PRINCIPAL

### Evidencia en los logs:
\`\`\`
[v0] No hay paciente ACTIVO asignado al dispositivo Dispositivo 1
[v0] Sincronización completada. Total eventos procesados: 0
\`\`\`

Esto se repite en cada ciclo de sincronización (cada 15 segundos).

### Causa raíz:
El código en `/app/api/sync-thingspeak/route.ts` línea 43-46:
\`\`\`typescript
.eq("dispositivo_id", dispositivo.id)
.eq("activo", true)  // ⚠️ FILTRO QUE EXCLUYE AL PACIENTE
\`\`\`

---

## 🔧 SOLUCIÓN PASO A PASO

### 1️⃣ VERIFICAR ESTADO ACTUAL

Ejecuta estas queries en el SQL Editor de Supabase:

#### A. Verificar dispositivos activos:
\`\`\`sql
SELECT id, nombre, channel_id, api_key, activo 
FROM dispositivos 
WHERE channel_id = '2134108';
\`\`\`

**Resultado esperado:**
- `activo` debe ser `true`
- `channel_id` debe ser `2134108`
- `api_key` debe ser `WUJJWM73A2AE1589`

#### B. Verificar paciente ID 8:
\`\`\`sql
SELECT id, nombre, activo, dispositivo_id, edad_anios, peso_kg, talla_cm
FROM pacientes 
WHERE id = 8;
\`\`\`

**Problema esperado:**
- `activo` es `NULL` o `false` ❌
- `dispositivo_id` debe estar asignado (ej. 1)

#### C. Verificar eventos actuales:
\`\`\`sql
SELECT COUNT(*) as total_eventos,
       SUM(CASE WHEN origen_dato = 'sensor' THEN 1 ELSE 0 END) as eventos_sensor,
       SUM(CASE WHEN origen_dato = 'manual' THEN 1 ELSE 0 END) as eventos_manual
FROM eventos_balance
WHERE paciente_id = 8;
\`\`\`

---

### 2️⃣ APLICAR FIX - SCRIPT SQL

Ejecuta este script en Supabase SQL Editor:

\`\`\`sql
-- ====================================
-- FIX: ACTIVAR PACIENTE PARA SINCRONIZACIÓN
-- ====================================

-- 1. Activar el paciente ID 8
UPDATE pacientes 
SET activo = true 
WHERE id = 8;

-- 2. Verificar el resultado
SELECT id, nombre, activo, dispositivo_id 
FROM pacientes 
WHERE id = 8;

-- 3. Verificar dispositivo asociado
SELECT d.id, d.nombre, d.channel_id, d.api_key, d.activo,
       COUNT(p.id) as pacientes_activos
FROM dispositivos d
LEFT JOIN pacientes p ON p.dispositivo_id = d.id AND p.activo = true
WHERE d.channel_id = '2134108'
GROUP BY d.id, d.nombre, d.channel_id, d.api_key, d.activo;
\`\`\`

**Resultado esperado:**
\`\`\`
id | nombre | activo | dispositivo_id
8  | [nombre] | true | 1
\`\`\`

---

### 3️⃣ VERIFICAR DATOS DE THINGSPEAK

Abre esta URL en tu navegador:
\`\`\`
https://api.thingspeak.com/channels/2134108/feeds.json?api_key=WUJJWM73A2AE1589&results=5
\`\`\`

**Verifica:**
1. ✅ Que devuelva feeds (no error 401/403)
2. ✅ Que `channel.last_entry_id` tenga un valor
3. ✅ Que cada feed tenga `entry_id`, `field1` (volumen en mL), `created_at`
4. ✅ Que los valores de `field1` sean números positivos válidos

**Ejemplo de respuesta esperada:**
\`\`\`json
{
  "channel": {
    "id": 2134108,
    "last_entry_id": 190
  },
  "feeds": [
    {
      "created_at": "2025-01-27T10:30:00Z",
      "entry_id": 186,
      "field1": "12.5"
    },
    {
      "created_at": "2025-01-27T10:35:00Z",
      "entry_id": 187,
      "field1": "8.3"
    }
  ]
}
\`\`\`

---

### 4️⃣ FORZAR SINCRONIZACIÓN MANUAL

Después de ejecutar el script SQL, prueba la API manualmente:

#### Opción A: Desde el navegador
\`\`\`
https://tu-app.vercel.app/api/sync-thingspeak
\`\`\`

#### Opción B: Desde la consola del navegador en tu app:
\`\`\`javascript
fetch('/api/sync-thingspeak')
  .then(r => r.json())
  .then(data => console.log('Resultado:', data))
\`\`\`

**Respuesta esperada (éxito):**
\`\`\`json
{
  "message": "Sincronización completada",
  "procesados": 5
}
\`\`\`

---

### 5️⃣ REVISAR LOGS DETALLADOS

Después de ejecutar la sincronización, los logs en la consola del servidor deben mostrar:

✅ **LOGS EXITOSOS:**
\`\`\`
[v0] Iniciando sincronización con ThingSpeak...
[v0] Dispositivos activos encontrados: 1
[v0] - Dispositivo: Dispositivo 1, Channel: 2134108, API Key: WUJJWM73...
[v0] Procesando dispositivo Dispositivo 1 (Channel: 2134108)
[v0] Total pacientes asociados al dispositivo 1: 1
[v0] - Paciente ID 8: Christopher Moreno, activo=true, dispositivo_id=1
[v0] Procesando paciente 8 - Christopher Moreno
[v0] Último entry_id procesado para paciente Christopher Moreno: 0
[v0] URL ThingSpeak: https://api.thingspeak.com/channels/2134108/feeds.json?api_key=WUJJWM73A2AE1589&results=100
[v0] Feeds recibidos de ThingSpeak: 10
[v0] Last_entry_id del canal: 190
[v0] Feeds nuevos a procesar (entry_id > 0): 10
[v0] Procesando entry_id=181, field1=12.5, volumen_ml=12.5
[v0] ✅ Insertado evento entry_id=181: 12.5 mL (2025-01-27T10:30:00Z)
[v0] Sincronización completada. Total eventos procesados: 10
\`\`\`

❌ **LOGS DE ERROR (problemas):**
\`\`\`
[v0] ⚠️ No hay paciente ACTIVO asignado al dispositivo
→ SOLUCIÓN: Verificar query SQL del paso 2

[v0] ❌ Error al obtener datos de ThingSpeak: 401
→ SOLUCIÓN: Verificar API key en tabla dispositivos

[v0] ⚠️ Saltando entry 181 - volumen inválido o cero: null
→ SOLUCIÓN: Verificar que field1 tenga datos en ThingSpeak
\`\`\`

---

### 6️⃣ VERIFICAR BASE DE DATOS DESPUÉS DE SINCRONIZACIÓN

\`\`\`sql
-- Ver eventos insertados del sensor
SELECT id, paciente_id, tipo_movimiento, volumen_ml, 
       categoria, origen_dato, thingspeak_entry_id, timestamp
FROM eventos_balance
WHERE paciente_id = 8 
  AND origen_dato = 'sensor'
ORDER BY thingspeak_entry_id DESC
LIMIT 10;
\`\`\`

**Verifica que:**
- ✅ Aparezcan nuevos registros con `origen_dato = 'sensor'`
- ✅ Los `thingspeak_entry_id` coincidan con los entry_id de ThingSpeak
- ✅ Los `volumen_ml` sean los mismos que `field1` del feed
- ✅ Las `timestamp` coincidan con `created_at` del feed
- ✅ La `categoria` sea "Diuresis (orina)"

---

### 7️⃣ VERIFICAR FRONTEND

Navega a `/patient/8` y verifica:

1. ✅ El card "Egresos" muestra:
   - "Del sensor API:" con valor > 0
   - "Cálculo manual:" con valor (si hay eventos manuales)
   - "Total acumulado:" suma correcta

2. ✅ La gráfica "Egresos Recientes" muestra puntos en el tiempo
3. ✅ El "Balance Hídrico" calcula correctamente: ingresos - egresos
4. ✅ La alerta (verde/amarillo/rojo) refleja el estado correcto

---

## 📋 CHECKLIST DE VALIDACIÓN COMPLETA

| # | Item | Verificado |
|---|------|------------|
| 1 | Dispositivo activo en BD (activo=true) | ⬜ |
| 2 | Paciente ID 8 activo en BD (activo=true) | ⬜ |
| 3 | Paciente asociado al dispositivo (dispositivo_id=1) | ⬜ |
| 4 | URL ThingSpeak responde con feeds válidos | ⬜ |
| 5 | API /api/sync-thingspeak devuelve procesados > 0 | ⬜ |
| 6 | Logs muestran "✅ Insertado evento entry_id=X" | ⬜ |
| 7 | Nuevos eventos aparecen en eventos_balance | ⬜ |
| 8 | Frontend muestra "Del sensor API: X mL" | ⬜ |
| 9 | Gráficas se actualizan automáticamente cada 15s | ⬜ |
| 10 | Balance total calcula correctamente | ⬜ |

---

## 🔄 FLUJO COMPLETO (REFERENCIA)

\`\`\`
ThingSpeak Sensor
    ↓ (envía datos a field1)
ThingSpeak Cloud API
    ↓ (lee cada 15s)
/api/sync-thingspeak (Next.js API Route)
    ↓ (inserta en BD)
Supabase: eventos_balance
    ↓ (query por paciente)
Frontend: PatientDetailPage
    ↓ (calcula totales)
Muestra en UI: Egresos del sensor
\`\`\`

---

## 🛠️ SCRIPTS DE EMERGENCIA

### Resetear sincronización (empezar de cero):
\`\`\`sql
-- ⚠️ CUIDADO: Esto borra TODOS los eventos del sensor para el paciente 8
DELETE FROM eventos_balance 
WHERE paciente_id = 8 
  AND origen_dato = 'sensor';

-- Ahora la próxima sincronización traerá todos los feeds desde el inicio
\`\`\`

### Ver último entry_id procesado:
\`\`\`sql
SELECT MAX(thingspeak_entry_id) as ultimo_entry_procesado
FROM eventos_balance
WHERE paciente_id = 8 
  AND origen_dato = 'sensor';
\`\`\`

### Activar TODOS los pacientes de una vez:
\`\`\`sql
UPDATE pacientes 
SET activo = true 
WHERE dispositivo_id IS NOT NULL;
\`\`\`

---

## 📞 INFORMACIÓN QUE NECESITO PARA SEGUIR AYUDANDO

Por favor pégame los resultados de estas queries:

1. **Estado del paciente:**
\`\`\`sql
SELECT * FROM pacientes WHERE id = 8;
\`\`\`

2. **Estado del dispositivo:**
\`\`\`sql
SELECT * FROM dispositivos WHERE channel_id = '2134108';
\`\`\`

3. **Últimos 5 feeds de ThingSpeak:**
Abre en navegador: `https://api.thingspeak.com/channels/2134108/feeds.json?api_key=WUJJWM73A2AE1589&results=5`

4. **Eventos actuales en BD:**
\`\`\`sql
SELECT * FROM eventos_balance 
WHERE paciente_id = 8 
ORDER BY created_at DESC 
LIMIT 10;
\`\`\`

5. **Logs de la próxima sincronización:**
Ejecuta `/api/sync-thingspeak` y pega los logs completos de la consola.

---

## ✅ RESUMEN DE CAMBIOS REALIZADOS

### Código actualizado:
1. `/app/api/sync-thingspeak/route.ts` - Logs detallados agregados
2. `/components/nuevo-paciente-dialog.tsx` - Ya configuraba `activo: true` ✅

### Próximos pasos:
1. Ejecutar script SQL para activar paciente ID 8
2. Verificar sincronización manual
3. Confirmar que los datos llegan al frontend
4. Validar ciclo automático de 15 segundos

---

## 🎯 ÉXITO ESPERADO

Después de aplicar el fix, deberías ver:

1. En los logs del servidor:
\`\`\`
[v0] ✅ Insertado evento entry_id=181: 12.5 mL
[v0] Sincronización completada. Total eventos procesados: 10
\`\`\`

2. En el frontend (paciente/8):
\`\`\`
Egresos
Del sensor API: 125.5 mL
Cálculo manual: 0 mL
Total acumulado: 125.5 mL
\`\`\`

3. En la gráfica:
Puntos conectados mostrando el flujo de egresos en el tiempo.

---

**Última actualización:** 2025-01-28
**Estado:** Pendiente validación del usuario
