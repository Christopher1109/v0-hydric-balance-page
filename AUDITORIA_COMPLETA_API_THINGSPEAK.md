# AUDITORÍA COMPLETA - API /api/sync-thingspeak

## ANÁLISIS DETALLADO DEL PROCESAMIENTO DE DATOS

---

## 1️⃣ ¿CÓMO ESTÁS LEYENDO LOS FIELDS DE THINGSPEAK?

### Lectura actual:

\`\`\`javascript
const ingresoRaw = feed.field1  // LEE FIELD1
const egresoRaw = feed.field2   // LEE FIELD2
\`\`\`

### Respuesta específica:

- **field1**: Se lee como `feed.field1` y representa ENTRADA/INGRESO
- **field2**: Se lee como `feed.field2` y representa SALIDA/EGRESO
- **field3, field4, etc.**: NO SE LEEN. Solo procesa field1 y field2.

---

## 2️⃣ ¿CÓMO DECIDES QUÉ FIELD CORRESPONDE A INGRESO Y CUÁL A EGRESO?

### Condición actual:

\`\`\`javascript
// FIELD1 SIEMPRE ES INGRESO
if (!Number.isNaN(ingresoMl) && ingresoMl > 0) {
  tipo_movimiento: "ingreso"
}

// FIELD2 SIEMPRE ES EGRESO
if (!Number.isNaN(egresoMl) && egresoMl > 0) {
  tipo_movimiento: "egreso"
}
\`\`\`

### Respuesta específica:

**NO HAY LÓGICA DE DECISIÓN DINÁMICA**. La asignación es FIJA:

- **field1** → SIEMPRE tipo_movimiento = "ingreso"
- **field2** → SIEMPRE tipo_movimiento = "egreso"

---

## 3️⃣ ¿QUÉ CATEGORÍA ESTÁS ASIGNANDO AL EVENTO?

### Categorías actuales:

\`\`\`javascript
// Para FIELD1 (ingreso):
categoria: "Fluido (sensor - entrada)"

// Para FIELD2 (egreso):
categoria: "Diuresis (orina - sensor)"
\`\`\`

### Respuesta específica:

Las categorías son FIJAS y HARDCODEADAS:

- **Ingreso (field1)**: `"Fluido (sensor - entrada)"`
- **Egreso (field2)**: `"Diuresis (orina - sensor)"`

**PROBLEMA IDENTIFICADO**: La categoría para egresos dice "Diuresis (orina - sensor)" pero según tus especificaciones de componentes de egresos, debería ser simplemente "Diuresis (orina)".

---

## 4️⃣ ¿QUÉ VOLUMEN ESTÁS GUARDANDO EN SUPABASE PARA CADA FIELD?

### Procesamiento actual:

\`\`\`javascript
// FIELD1 → INGRESO
const ingresoRaw = feed.field1              // Ejemplo: "150.5"
const ingresoMl = parseFloat(ingresoRaw)    // Convierte a: 150.5
// Inserta: volumen_ml: 150.5

// FIELD2 → EGRESO
const egresoRaw = feed.field2               // Ejemplo: "200.3"
const egresoMl = parseFloat(egresoRaw)      // Convierte a: 200.3
// Inserta: volumen_ml: 200.3
\`\`\`

### Ejemplo real de inserción:

**ENTRADA DE THINGSPEAK:**
\`\`\`json
{
  "entry_id": 12345,
  "field1": "150.5",
  "field2": "200.3",
  "created_at": "2025-01-15T10:30:00Z"
}
\`\`\`

**SALIDA EN SUPABASE (tabla eventos_balance):**

**Registro 1 (ingreso):**
\`\`\`sql
INSERT INTO eventos_balance (
  paciente_id: 8,
  tipo_movimiento: "ingreso",
  volumen_ml: 150.5,
  categoria: "Fluido (sensor - entrada)",
  descripcion: "Lectura automática del sensor (entrada) - Entry ID: 12345",
  origen_dato: "sensor",
  timestamp: "2025-01-15T10:30:00Z",
  thingspeak_entry_id: 12345
)
\`\`\`

**Registro 2 (egreso):**
\`\`\`sql
INSERT INTO eventos_balance (
  paciente_id: 8,
  tipo_movimiento: "egreso",
  volumen_ml: 200.3,
  categoria: "Diuresis (orina - sensor)",
  descripcion: "Lectura automática del sensor (salida) - Entry ID: 12345",
  origen_dato: "sensor",
  timestamp: "2025-01-15T10:30:00Z",
  thingspeak_entry_id: 12345
)
\`\`\`

**NOTA IMPORTANTE**: Si ambos fields tienen valores, se crean DOS registros separados en eventos_balance.

---

## 5️⃣ ¿QUÉ HACE SI UN FIELD VIENE VACÍO, NULL O INVÁLIDO?

### Lógica actual:

\`\`\`javascript
const ingresoMl = ingresoRaw != null ? parseFloat(ingresoRaw) : NaN

if (!Number.isNaN(ingresoMl) && ingresoMl > 0) {
  // SOLO INSERTA SI:
  // 1. No es NaN
  // 2. Es mayor a 0
}
\`\`\`

### Respuesta específica:

**SI EL FIELD VIENE:**

1. **`null`**: Se convierte a `NaN` → SE IGNORA, NO SE INSERTA
2. **`undefined`**: Se convierte a `NaN` → SE IGNORA, NO SE INSERTA
3. **`""`** (string vacío): `parseFloat("")` = `NaN` → SE IGNORA, NO SE INSERTA
4. **`"0"`**: Se convierte a `0` → SE IGNORA (condición `> 0` no cumple)
5. **`"-50"`**: Se convierte a `-50` → SE IGNORA (condición `> 0` no cumple)
6. **`"abc"`**: `parseFloat("abc")` = `NaN` → SE IGNORA, NO SE INSERTA

**COMPORTAMIENTO**: Solo inserta valores NUMÉRICOS POSITIVOS mayores a 0. Todo lo demás se IGNORA silenciosamente.

---

## 6️⃣ ¿CÓMO GUARDAS thingspeak_entry_id Y CÓMO EVITAS DUPLICADOS?

### Lógica de prevención de duplicados:

\`\`\`javascript
// 1. Consulta el último entry_id procesado
const { data: ultimoEvento } = await supabase
  .from("eventos_balance")
  .select("thingspeak_entry_id")
  .eq("paciente_id", paciente.id)
  .eq("origen_dato", "sensor")
  .order("thingspeak_entry_id", { ascending: false })
  .limit(1)

const ultimoEntryId = ultimoEvento?.[0]?.thingspeak_entry_id ?? 0
// Ejemplo: ultimoEntryId = 12340

// 2. Solicita 100 registros recientes de ThingSpeak
const feeds = json.feeds // Ejemplo: entry_ids [12338, 12339, 12340, 12341, 12342, ...]

// 3. Filtra solo los NUEVOS
const nuevosFeeds = feeds.filter(
  (feed) => Number(feed.entry_id) > Number(ultimoEntryId)
)
// Resultado: [12341, 12342, ...]

// 4. Procesa solo los nuevos
for (const feed of nuevosFeeds) {
  // Inserta con thingspeak_entry_id: feed.entry_id
}
\`\`\`

### Respuesta específica:

**MÉTODO DE PREVENCIÓN DE DUPLICADOS:**

1. **Busca el entry_id más alto** ya guardado en la base de datos para ese paciente
2. **Solicita los últimos 100 feeds** de ThingSpeak
3. **Filtra solo los feeds** con `entry_id > ultimoEntryId`
4. **Inserta solo los nuevos** con su `thingspeak_entry_id`

**LIMITACIONES IDENTIFICADAS:**

- Si el API se ejecuta y falla DESPUÉS de insertar algunos registros pero ANTES de terminar todos, podría perder algunos entry_ids intermedios en la próxima ejecución.
- **NO HAY CONSTRAINT UNIQUE** en la base de datos para `thingspeak_entry_id + paciente_id`, por lo que si el código se ejecuta dos veces manualmente, PODRÍA duplicar registros.

**RECOMENDACIÓN**: Agregar constraint UNIQUE en la base de datos:
\`\`\`sql
ALTER TABLE eventos_balance 
ADD CONSTRAINT unique_entry_per_patient 
UNIQUE (thingspeak_entry_id, paciente_id, tipo_movimiento);
\`\`\`

---

## 7️⃣ LOGS COMPLETOS GENERADOS

### Logs actuales en el código:

\`\`\`
[sync-thingspeak] Iniciando sincronización con ThingSpeak...
[sync-thingspeak] Procesando dispositivo {nombre} (Channel: {channel_id})
[sync-thingspeak] Paciente asignado: {nombre} (id={id})
[sync-thingspeak] Último entry_id procesado para paciente {nombre}: {entry_id}
[sync-thingspeak] URL: https://api.thingspeak.com/channels/...
[sync-thingspeak] Obtenidos {N} registros de ThingSpeak
[sync-thingspeak] Nuevos registros a procesar: {N}
[sync-thingspeak] ✅ Ingreso sensor insertado (entry {id}): {volumen} mL
[sync-thingspeak] ✅ Egreso sensor insertado (entry {id}): {volumen} mL
[sync-thingspeak] Sincronización completada. Total eventos procesados: {N}
\`\`\`

### Logs FALTANTES que necesitas:

**NO IMPRIME:**
- "Lectura field1 → X"
- "Lectura field2 → Y"
- "Clasificación: ingreso/egreso"
- Valores RAW antes de parsear
- Por qué se ignora un field (si es 0, null, NaN, etc.)

---

## PROBLEMAS IDENTIFICADOS

### 1. Falta visibilidad completa en logs
No se imprimen los valores RAW de field1 y field2 antes de procesarlos.

### 2. Categoría inconsistente
La categoría para egresos dice "Diuresis (orina - sensor)" pero debería ser "Diuresis (orina)" según tus componentes.

### 3. Sin protección contra duplicados a nivel BD
Si el API se ejecuta dos veces, podría duplicar registros.

### 4. No procesa field3, field4, etc.
Solo lee field1 y field2. Si ThingSpeak tiene más datos, se ignoran.

### 5. No distingue tipos de ingreso/egreso
Todos los ingresos son "Fluido (sensor - entrada)" y todos los egresos son "Diuresis (orina - sensor)", sin diferenciar entre tipos.

---

## RECOMENDACIONES

1. **Agregar logs detallados** para cada field antes de procesarlo
2. **Corregir la categoría** de egresos a "Diuresis (orina)"
3. **Agregar constraint UNIQUE** en la BD para evitar duplicados
4. **Considerar procesar fields adicionales** si ThingSpeak los tiene
5. **Permitir diferentes categorías** según el tipo de sensor o configuración del dispositivo

---

## FLUJO COMPLETO RESUMIDO

\`\`\`
1. API recibe GET request
   ↓
2. Busca dispositivos activos (activo=true)
   ↓
3. Para cada dispositivo:
   - Busca pacientes activos (activo=true, dispositivo_id=X)
   ↓
4. Para cada paciente:
   - Busca último entry_id procesado
   - Llama a ThingSpeak API (últimos 100 feeds)
   - Filtra feeds nuevos (entry_id > último)
   ↓
5. Para cada feed nuevo:
   - Lee field1 → Si > 0: Inserta INGRESO
   - Lee field2 → Si > 0: Inserta EGRESO
   - Ambos con mismo entry_id pero diferentes tipo_movimiento
   ↓
6. Retorna total de eventos procesados
\`\`\`

---

**FIN DE AUDITORÍA**
