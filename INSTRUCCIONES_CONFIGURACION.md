# Instrucciones de Configuración - Nueva Base de Datos

## ✅ Proyecto Supabase Creado

- **Nombre**: Balance Hidrico App
- **Project ID**: `gyndbleotjqbznhtvirf`
- **Región**: us-east-1 (Norte de Virginia)
- **Costo**: $0/mes (Plan Gratuito)
- **Estado**: Activo y listo para usar

## 📋 Pasos para Completar la Configuración

### 1. Ejecutar el Script SQL

1. Ve a tu panel de Supabase: https://supabase.com/dashboard
2. Selecciona el proyecto "Balance Hidrico App" (ID: gyndbleotjqbznhtvirf)
3. En el menú lateral, click en **"SQL Editor"**
4. Haz click en **"New Query"**
5. Copia TODO el contenido del archivo `scripts/001_setup_complete_database.sql`
6. Pégalo en el editor SQL
7. Haz click en **"Run"** (botón verde en la esquina inferior derecha)
8. Verifica que veas el mensaje "Tablas creadas correctamente" y la lista de 3 tablas:
   - dispositivos
   - eventos_balance
   - pacientes

### 2. Obtener las Credenciales

1. En el mismo proyecto de Supabase, ve a **Settings** → **API**
2. Copia los siguientes valores:

   **Project URL**:
   \`\`\`
   https://gyndbleotjqbznhtvirf.supabase.co
   \`\`\`

   **anon/public key** (empieza con "eyJ..."):
   \`\`\`
   [Cópialo desde el panel de Supabase]
   \`\`\`

### 3. Actualizar Variables de Entorno en v0

1. En v0, abre el panel lateral izquierdo
2. Click en **"Vars"** (Variables de Entorno)
3. Actualiza o agrega estas variables:

   \`\`\`
   NEXT_PUBLIC_SUPABASE_URL=https://gyndbleotjqbznhtvirf.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=[Tu anon key copiada]
   \`\`\`

4. Guarda los cambios

### 4. Verificar que Todo Funciona

1. Recarga tu aplicación en v0
2. Deberías ver el lobby vacío (sin errores en consola)
3. Haz click en "Nuevo Paciente" y crea un paciente de prueba
4. Verifica que puedas agregar ingresos y egresos

## 🎯 ¿Qué se Creó?

### Tabla: `dispositivos`
- Almacena la configuración de ThingSpeak
- Ya incluye el Dispositivo 1 con tus credenciales:
  - Channel ID: 2802062
  - Read API Key: 9XZYHNNZS2PSCL87
  - Write API Key: C9I40L51U2XZHSYZ

### Tabla: `pacientes`
- Información demográfica (nombre, edad, peso, talla, sexo)
- Relación con dispositivos IoT
- Cálculo automático de IMC

### Tabla: `eventos_balance`
- Registro de todos los ingresos y egresos
- Diferencia entre datos manuales y de sensores
- Timestamps para gráficas temporales
- Relación con ThingSpeak (entry_id)

## ⚠️ Importante

- La tabla `dispositivos` YA tiene el Dispositivo 1 configurado
- La sincronización con ThingSpeak está habilitada cada 15 segundos
- Los datos se procesan automáticamente cuando lleguen del sensor
- El cálculo de balance es: Ingresos - Egresos
- Las alertas son: Verde (neutro: -500 a +500 ml), Rojo (desbalance: fuera de rango)

## 🐛 Si hay problemas

1. Verifica en la consola del navegador si hay errores
2. Asegúrate que las variables de entorno estén correctas
3. Verifica que el script SQL se ejecutó sin errores
4. Revisa que el proyecto de Supabase esté activo (no pausado)
