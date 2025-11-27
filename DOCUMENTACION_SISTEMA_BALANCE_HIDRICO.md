# DOCUMENTACIÓN TÉCNICA COMPLETA
## Sistema de Balance Hídrico - Procesamiento Interno de Datos

---

## 1. RECEPCIÓN DE DATOS DE INGRESO (Contador Óptico de Gotas)

### Estado Actual: **DESHABILITADO TEMPORALMENTE**

La sincronización con ThingSpeak está actualmente deshabilitada en el código (`app/api/sync-thingspeak/route.ts`):

\`\`\`typescript
export async function GET() {
  console.log("[v0] API sync-thingspeak llamada (deshabilitada temporalmente)")
  return NextResponse.json({
    message: "Sincronización ThingSpeak deshabilitada temporalmente",
    procesados: 0,
  })
}
\`\`\`

### Configuración Cuando Está Activa:

**Origen de datos:**
- Canal ThingSpeak ID: `2134108`
- API Key: `WUJJWM73A2AE1589`
- Campo de ThingSpeak: `field1` (ingresos del contador óptico de gotas)

**Campos que llegan de ThingSpeak:**
\`\`\`javascript
{
  entry_id: número entero único (ej: 181, 182, 183...),
  created_at: timestamp ISO (ej: "2025-01-15T10:30:45Z"),
  field1: volumen en mL del contador óptico (ingresos),
  field2: volumen en mL/g de la celda de carga (egresos)
}
\`\`\`

**Frecuencia de sincronización:**
- Intervalo automático: **cada 15 segundos**
- Se ejecuta desde `app/patient/[id]/page.tsx` línea 216:
\`\`\`typescript
useEffect(() => {
  actualizarTodo()
  const interval = setInterval(actualizarTodo, 15000) // 15 segundos
  return () => clearInterval(interval)
}, [patienteId])
\`\`\`

**Proceso de conversión a valores almacenables:**

1. La API `/api/sync-thingspeak` solicita los últimos 10 feeds del canal
2. Verifica el último `thingspeak_entry_id` procesado en la BD para evitar duplicados
3. Filtra solo los nuevos entry_id mayores al último procesado
4. Para cada feed nuevo con `field1` > 0:
   - Crea un registro en `eventos_balance` con:
     - `tipo_movimiento`: "ingreso"
     - `volumen_ml`: valor de `field1` (sin conversión, ya viene en mL)
     - `origen_dato`: "sensor"
     - `thingspeak_entry_id`: el entry_id del feed
     - `timestamp`: la fecha de `created_at` del feed
     - `paciente_id`: ID del paciente asociado al dispositivo

**Sin transformaciones:** El valor de `field1` se almacena directamente como mL.

---

## 2. RECEPCIÓN DE DATOS DE EGRESO (Celda de Carga)

### Estado Actual: **DESHABILITADO TEMPORALMENTE**

**Origen de datos:**
- Mismo canal ThingSpeak: `2134108`
- Campo de ThingSpeak: `field2` (egresos de la celda de carga en g/mL)

**Variable que se lee:** `field2` de cada feed de ThingSpeak

**Frecuencia:** Cada 15 segundos (mismo intervalo que ingresos)

**Transformación antes de guardar:**
- **NO se realiza conversión de gramos a mL**
- El valor de `field2` se asume que ya viene en mL o que la celda de carga envía directamente mL
- Se almacena directamente como: `volumen_ml = field2`

**Proceso de almacenamiento:**

Para cada feed nuevo con `field2` > 0:
- Crea un registro en `eventos_balance` con:
  - `tipo_movimiento`: "egreso"
  - `volumen_ml`: valor de `field2`
  - `origen_dato`: "sensor"
  - `thingspeak_entry_id`: el entry_id del feed
  - `timestamp`: la fecha de `created_at` del feed
  - `paciente_id`: ID del paciente asociado al dispositivo

---

## 3. CÁLCULO DEL BALANCE HÍDRICO TOTAL

### Fórmula Exacta:

\`\`\`
Balance Hídrico (BH) = Total Ingresos - Total Egresos + Despreciables
\`\`\`

Donde:
- **Total Ingresos** = Ingresos del Sensor + Ingresos Manuales + Despreciables Ingresos
- **Total Egresos** = Egresos del Sensor + Egresos Manuales + Despreciables Egresos

### Cálculo de Despreciables:

\`\`\`
Despreciables por hora = 0.2 mL/kg/hora × Peso del paciente (kg)
Despreciables acumulados = Despreciables por hora × Horas transcurridas
\`\`\`

**Nota actual:** El sistema asume **1 hora** de forma fija (línea 259 de `app/patient/[id]/page.tsx`):
\`\`\`typescript
const horas = 1
despreciables = calcularDespreciables(paciente?.peso_kg ?? 70, horas)
\`\`\`

### Proceso de Suma de Ingresos Acumulados:

\`\`\`typescript
// Desde app/patient/[id]/page.tsx línea 127-130
const ingresos_sensor_total = data
  .filter((e) => e.tipo_movimiento === "ingreso" && e.origen_dato === "sensor")
  .reduce((s, e) => s + e.volumen_ml, 0)

const ingresos_manual_total = data
  .filter((e) => e.tipo_movimiento === "ingreso" && e.origen_dato === "manual")
  .reduce((s, e) => s + e.volumen_ml, 0)
\`\`\`

### Proceso de Suma de Egresos Acumulados:

\`\`\`typescript
// línea 136-143
const egresos_sensor_total = data
  .filter((e) => e.tipo_movimiento === "egreso" && e.origen_dato === "sensor")
  .reduce((s, e) => s + e.volumen_ml, 0)

const egresos_manual_total = data
  .filter((e) => e.tipo_movimiento === "egreso" && e.origen_dato === "manual")
  .reduce((s, e) => s + e.volumen_ml, 0)
\`\`\`

### Cálculo Final del Balance:

\`\`\`typescript
// línea 158-160
const total_ingresos = ingresos_sensor_total + ingresos_manual_total
const total_egresos = egresos_sensor_total + egresos_manual_total

// línea 294-298
const totalIngresosMostrado = balance24h.total_ingresos_ml + ingresosResumen.despreciables.acumulado
const totalEgresosMostrado = balance24h.total_egresos_ml + egresosResumen.despreciables.acumulado
const balanceMostrado = totalIngresosMostrado - totalEgresosMostrado
\`\`\`

### NO se realizan:
- ✗ Promedios
- ✗ Cálculos por ventanas de tiempo (todo es acumulado desde el inicio)
- ✗ El reseteo manual borra TODOS los eventos de la base de datos

---

## 4. PONDERACIÓN DE DATOS CON EL TIEMPO

### Smoothing / Filtrado: **NO SE APLICA**
- Los datos se muestran tal cual llegan sin suavizado

### Debounce: **NO SE APLICA**
- No hay espera antes de considerar un valor válido

### Promedios Móviles: **NO SE APLICAN**
- Cada valor se suma directamente al acumulado

### Validación Temporal: **NO EXISTE**
- No se esperan X segundos para validar
- Cada dato se procesa inmediatamente al llegar

### Actualización del Balance:
- **Tiempo real:** Cada 15 segundos se actualiza automáticamente
- **Sin buffers:** Los datos se procesan inmediatamente al recibirlos

---

## 5. TIEMPOS DE PROCESAMIENTO Y VISUALIZACIÓN

### Flujo de Tiempo (Sensor → Pantalla):

\`\`\`
1. ESP32 envía dato a ThingSpeak: 0 ms (punto de partida)
   ↓
2. ThingSpeak almacena el feed: ~100-500 ms
   ↓
3. Sistema espera próximo ciclo de sincronización: 0-15,000 ms (máximo 15 seg)
   ↓
4. API /api/sync-thingspeak solicita feeds: ~200-500 ms
   ↓
5. Se verifica último entry_id procesado: ~50-100 ms
   ↓
6. Se insertan nuevos eventos en Supabase: ~100-300 ms
   ↓
7. Frontend carga nuevos datos: ~200-400 ms
   ↓
8. Se recalcula balance: ~50-100 ms (en memoria)
   ↓
9. Se actualizan gráficas: ~50-150 ms (renderizado React)
   ↓
10. Usuario ve dato en pantalla: TOTAL = 0.75 - 16.9 segundos
\`\`\`

**Tiempo mínimo:** ~750 ms (si el ciclo acaba de iniciar)
**Tiempo máximo:** ~16.9 segundos (si acaba de perder un ciclo)
**Tiempo promedio:** ~8.5 segundos

### Frecuencia de Actualización:

- **Gráficos:** Se actualizan cada 15 segundos con los últimos datos
- **Tarjetas de balance:** Se actualizan cada 15 segundos
- **NO hay actualizaciones en tiempo real** entre ciclos de 15 segundos

### Retrasos o Buffers:
- **Sin buffers internos:** Los datos se procesan síncronamente
- **Único retraso:** El intervalo de 15 segundos entre sincronizaciones

---

## 6. IMPACTO DE DATOS ANTIGUOS EN CÁLCULO ACTUAL

### Mantenimiento de Historial:
- **SÍ mantiene historial completo** en la tabla `eventos_balance`
- **NO hay límite** de antigüedad de datos
- **NO se borran** datos automáticamente con el tiempo

### Ponderación de Valores Pasados:
- **NO se ponderan:** Todos los eventos tienen el mismo peso
- **NO se calculan promedios:** Solo sumas acumuladas
- Los eventos de hace 1 hora pesan igual que los de hace 1 minuto

### Limpieza de Datos:
- **Única forma de limpiar:** Botón manual "Reiniciar Balance"
- **Efecto del reseteo:**
  \`\`\`typescript
  await supabase.from("eventos_balance").delete().eq("paciente_id", patienteId)
  \`\`\`
  Borra TODOS los eventos del paciente, no hay reseteo parcial

### Cálculo del Balance:
\`\`\`typescript
// línea 123-160 de app/patient/[id]/page.tsx
// Se traen TODOS los eventos del paciente sin límite de fecha
const { data, error } = await supabase
  .from("eventos_balance")
  .select("tipo_movimiento, volumen_ml, origen_dato, timestamp")
  .eq("paciente_id", patienteId)
  .order("timestamp", { ascending: false })
\`\`\`

**El balance SIEMPRE es la suma de TODOS los eventos desde el inicio o el último reseteo.**

---

## 7. DIAGRAMA PASO A PASO: SENSOR → PANTALLA

\`\`\`
┌─────────────────────────────────────────────────────────────────────┐
│                    FLUJO COMPLETO DE DATOS                          │
└─────────────────────────────────────────────────────────────────────┘

[ETAPA 1: CAPTURA EN HARDWARE]
ESP32 con sensores (Contador óptico + Celda de carga)
  │
  ├─ Contador óptico: detecta gotas → calcula mL
  └─ Celda de carga: mide peso → convierte a mL
  │
  ↓
Envía a ThingSpeak cada X segundos
  - field1 = ingresos (mL)
  - field2 = egresos (mL)
  │
  ↓
[ETAPA 2: ALMACENAMIENTO EN LA NUBE]
ThingSpeak recibe y almacena en canal 2134108
  - Asigna entry_id único (autoincremental)
  - Registra timestamp automático
  - Almacena field1 y field2
  │
  ↓
[ETAPA 3: SINCRONIZACIÓN - cada 15 segundos]
useEffect en app/patient/[id]/page.tsx (línea 216)
  │
  ├─ Llama a: sincronizarThingSpeak()
  │    │
  │    └─ Hace fetch a: /api/sync-thingspeak
  │         │
  │         └─ [ACTUALMENTE DESHABILITADA]
  │             Cuando esté activa:
  │             1. GET a ThingSpeak API:
  │                https://api.thingspeak.com/channels/2134108/feeds.json
  │                ?api_key=WUJJWM73A2AE1589&results=10
  │             2. Busca último entry_id procesado en Supabase
  │             3. Filtra feeds nuevos (entry_id > último)
  │             4. Por cada feed nuevo:
  │                - Si field1 > 0: inserta evento tipo "ingreso"
  │                - Si field2 > 0: inserta evento tipo "egreso"
  │             5. Inserta en tabla eventos_balance:
  │                {
  │                  paciente_id: X,
  │                  tipo_movimiento: "ingreso" | "egreso",
  │                  volumen_ml: field1 o field2,
  │                  origen_dato: "sensor",
  │                  thingspeak_entry_id: entry_id,
  │                  timestamp: created_at
  │                }
  │
  ↓
[ETAPA 4: CARGA DE DATOS DESDE SUPABASE]
cargarDatosPaciente() - línea 107
  │
  ├─ SELECT * FROM pacientes WHERE id = X
  └─ Carga info del paciente (nombre, peso, talla, etc.)
  │
  ↓
calcularBalance() - línea 114
  │
  ├─ SELECT * FROM eventos_balance WHERE paciente_id = X
  │    ORDER BY timestamp DESC
  │
  ├─ Filtra y suma por tipo_movimiento y origen_dato:
  │    - ingresos_sensor_total
  │    - ingresos_manual_total
  │    - egresos_sensor_total
  │    - egresos_manual_total
  │
  └─ Calcula despreciables: 0.2 mL/kg/h × peso × 1 hora
  │
  ↓
cargarDatosGrafica() - línea 168
  │
  ├─ SELECT * FROM eventos_balance WHERE paciente_id = X
  │    ORDER BY timestamp ASC
  │
  ├─ Procesa eventos cronológicamente:
  │    - Ingresos → array de últimos 5 puntos
  │    - Egresos → array de últimos 5 puntos (valores negativos)
  │    - Balance acumulado → array de últimos 20 puntos
  │
  └─ Formatea tiempo: HH:MM:SS
  │
  ↓
[ETAPA 5: CÁLCULO EN MEMORIA - COMPONENTE REACT]
Estado local se actualiza (líneas 258-300)
  │
  ├─ Balance mostrado = 
  │    (Ingresos sensor + Ingresos manual + Despreciables ingresos) -
  │    (Egresos sensor + Egresos manual + Despreciables egresos)
  │
  ├─ Se calcula estado del balance:
  │    getBalanceStatus(balanceMostrado, peso)
  │      │
  │      └─ mL por kg = balance / peso
  │         - Si |mL/kg| ≤ 5: Normal (verde)
  │         - Si 5 < |mL/kg| ≤ 10: Alerta moderada (amarillo)
  │         - Si |mL/kg| > 10: Alerta crítica (rojo)
  │
  └─ setLastUpdate(new Date())
  │
  ↓
[ETAPA 6: RENDERIZADO EN INTERFAZ]
JSX renderiza 3 tarjetas principales:
  │
  ├─ TARJETA INGRESOS (azul)
  │    - Total: ingresos sensor + manual + despreciables
  │    - Último sensor / Total sensor
  │    - Último manual / Total manual
  │    - Despreciables por hora / acumulado
  │
  ├─ TARJETA EGRESOS (naranja)
  │    - Total: egresos sensor + manual + despreciables
  │    - Último sensor / Total sensor
  │    - Último manual / Total manual
  │    - Despreciables por hora / acumulado
  │
  └─ TARJETA BALANCE (verde/amarillo/rojo según estado)
       - Balance neto en mL
       - Badge con estado (Normal/Alerta moderada/Crítica)
  │
  ↓
Gráficas Recharts (líneas 431-518)
  │
  ├─ Gráfica Ingresos Recientes: últimos 5 eventos de ingreso
  ├─ Gráfica Egresos Recientes: últimos 5 eventos de egreso (negativo)
  └─ Gráfica Balance Acumulado: últimos 20 puntos (tendencia)
  │
  ↓
[ETAPA 7: USUARIO VE DATOS EN PANTALLA]
✓ Balance actualizado visualmente
✓ Gráficas renderizadas
✓ Timestamp de última actualización mostrado
  │
  ↓
[CICLO SE REPITE CADA 15 SEGUNDOS]
\`\`\`

---

## RESUMEN EJECUTIVO

### Estado Actual del Sistema:
- ✗ Sincronización con ThingSpeak: **DESHABILITADA**
- ✓ Registro manual de ingresos/egresos: **FUNCIONAL**
- ✓ Cálculo de balance acumulado: **FUNCIONAL**
- ✓ Visualización de gráficas: **FUNCIONAL**

### Frecuencias de Actualización:
- Sincronización ThingSpeak (cuando activa): **15 segundos**
- Actualización de interfaz: **15 segundos**
- Latencia total sensor→pantalla: **0.75 - 16.9 segundos** (promedio ~8.5s)

### Procesamiento de Datos:
- **Sin filtrado ni suavizado**
- **Sin promedios móviles**
- **Sin validación temporal**
- **Acumulación simple de todos los eventos**

### Almacenamiento:
- **Historial completo** sin límite de antigüedad
- **Sin limpieza automática**
- **Reseteo manual** borra todo el historial del paciente

### Fórmulas Clave:
\`\`\`
Balance Hídrico = Ingresos Total - Egresos Total
Ingresos Total = Sensor + Manual + Despreciables (0.2 mL/kg/h × peso × 1h)
Egresos Total = Sensor + Manual + Despreciables (0.2 mL/kg/h × peso × 1h)
\`\`\`

### Sistema de Alertas:
- **Normal (verde):** |Balance/Peso| ≤ 5 mL/kg
- **Alerta moderada (amarillo):** 5 < |Balance/Peso| ≤ 10 mL/kg
- **Alerta crítica (rojo):** |Balance/Peso| > 10 mL/kg

---

## ARCHIVOS CLAVE DEL SISTEMA

1. **app/api/sync-thingspeak/route.ts** - API de sincronización (deshabilitada)
2. **app/patient/[id]/page.tsx** - Página principal del paciente con toda la lógica
3. **components/agregar-ingreso-dialog.tsx** - Formulario de ingreso manual
4. **components/agregar-egreso-dialog.tsx** - Formulario de egreso manual
5. **lib/types.ts** - Definición de tipos y función getBalanceStatus()

---

FIN DE LA DOCUMENTACIÓN TÉCNICA
