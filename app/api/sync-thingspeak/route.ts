// app/api/sync-thingspeak/route.ts
import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  try {
    console.log("[sync-thingspeak] ========================================")
    console.log("[sync-thingspeak] Iniciando sincronización con ThingSpeak...")
    console.log("[sync-thingspeak] ========================================")

    const supabase = await createClient()

    // 1. Dispositivos activos
    const { data: dispositivos, error: dispositivosError } = await supabase
      .from("dispositivos")
      .select("*")
      .eq("activo", true)

    if (dispositivosError) {
      console.error("[sync-thingspeak] Error al cargar dispositivos:", dispositivosError)
      return NextResponse.json({ error: "Error al cargar dispositivos" }, { status: 500 })
    }

    if (!dispositivos || dispositivos.length === 0) {
      console.log("[sync-thingspeak] No hay dispositivos activos configurados")
      return NextResponse.json({
        message: "No hay dispositivos activos",
        procesados: 0,
      })
    }

    let totalProcesados = 0

    for (const dispositivo of dispositivos) {
      console.log(`[sync-thingspeak] Procesando dispositivo ${dispositivo.nombre} (Channel: ${dispositivo.channel_id})`)

      // 2. Pacientes activos ligados a este dispositivo
      const { data: pacientes, error: pacientesError } = await supabase
        .from("pacientes")
        .select("*")
        .eq("dispositivo_id", dispositivo.id)
        .eq("activo", true)

      if (pacientesError) {
        console.error(
          `[sync-thingspeak] Error al cargar pacientes del dispositivo ${dispositivo.nombre}:`,
          pacientesError,
        )
        continue
      }

      if (!pacientes || pacientes.length === 0) {
        console.log(`[sync-thingspeak] No hay pacientes activos asignados al dispositivo ${dispositivo.nombre}`)
        continue
      }

      for (const paciente of pacientes) {
        console.log(`[sync-thingspeak] Paciente asignado: ${paciente.nombre} (id=${paciente.id})`)

        // 3. Último entry_id procesado para este paciente
        const { data: ultimoEvento, error: ultimoError } = await supabase
          .from("eventos_balance")
          .select("thingspeak_entry_id")
          .eq("paciente_id", paciente.id)
          .eq("origen_dato", "sensor")
          .order("thingspeak_entry_id", { ascending: false })
          .limit(1)

        if (ultimoError) {
          console.error("[sync-thingspeak] Error al obtener último entry_id:", ultimoError)
        }

        const ultimoEntryId = ultimoEvento?.[0]?.thingspeak_entry_id ?? 0
        console.log(`[sync-thingspeak] Último entry_id procesado para paciente ${paciente.nombre}: ${ultimoEntryId}`)

        // 4. Pedir los últimos feeds a ThingSpeak
        const thingspeakUrl = `https://api.thingspeak.com/channels/${dispositivo.channel_id}/feeds.json?api_key=${dispositivo.api_key}&results=100`
        console.log("[sync-thingspeak] URL:", thingspeakUrl)

        const response = await fetch(thingspeakUrl)

        if (!response.ok) {
          console.error(
            `[sync-thingspeak] Error HTTP ${response.status} al obtener datos de ThingSpeak:`,
            response.statusText,
          )

          // Intentar leer el cuerpo como texto para diagnosticar
          const errorBody = await response.text()
          console.error(`[sync-thingspeak] Respuesta de error: ${errorBody}`)

          // Si es un error 429 (Too Many Requests), esperar y continuar
          if (response.status === 429) {
            console.warn("[sync-thingspeak] ⚠ Rate limit alcanzado en ThingSpeak. Se omite esta sincronización.")
          }

          continue
        }

        // Intentar parsear JSON de forma segura
        let json
        try {
          const text = await response.text()
          json = JSON.parse(text)
        } catch (parseError) {
          console.error("[sync-thingspeak] Error al parsear respuesta JSON:", parseError)
          console.error("[sync-thingspeak] Respuesta recibida:", await response.text())
          continue
        }

        const feeds = json.feeds || []
        console.log(`[sync-thingspeak] Obtenidos ${feeds.length} registros de ThingSpeak`)

        // 5. Solo procesar los feeds nuevos (entry_id mayor al último guardado)
        const nuevosFeeds = feeds.filter((feed: any) => Number(feed.entry_id) > Number(ultimoEntryId))
        console.log(`[sync-thingspeak] Nuevos registros a procesar: ${nuevosFeeds.length}`)

        for (const feed of nuevosFeeds) {
          const entryId = Number(feed.entry_id)
          console.log(`\n[sync-thingspeak] --- Procesando Entry ID: ${entryId} ---`)
          console.log(`[sync-thingspeak] Timestamp: ${feed.created_at}`)

          const { data: pacienteExiste } = await supabase
            .from("pacientes")
            .select("id")
            .eq("id", paciente.id)
            .maybeSingle()

          if (!pacienteExiste) {
            console.warn(`[sync-thingspeak] ⚠ Paciente ${paciente.id} ya no existe. Se detiene procesamiento de feeds.`)
            break // Salir del loop de feeds
          }

          // --- FIELD1 = ENTRADA (INGRESO) ---
          const ingresoRaw = feed.field1
          console.log(`[sync-thingspeak] Lectura field1 (RAW) → "${ingresoRaw}"`)

          const ingresoMl = ingresoRaw != null ? Number.parseFloat(ingresoRaw) : Number.NaN
          console.log(`[sync-thingspeak] Lectura field1 (PARSEADO) → ${ingresoMl}`)

          if (!Number.isNaN(ingresoMl) && ingresoMl > 0) {
            console.log(`[sync-thingspeak] ✓ Clasificación: INGRESO (field1 > 0)`)
            console.log(`[sync-thingspeak] Categoría asignada: "Fluido (sensor - entrada)"`)
            console.log(`[sync-thingspeak] Volumen a insertar: ${ingresoMl} mL`)

            const { error: insertIngresoError } = await supabase.from("eventos_balance").insert({
              paciente_id: paciente.id,
              tipo_movimiento: "ingreso",
              volumen_ml: ingresoMl,
              categoria: "Fluido (sensor - entrada)",
              descripcion: `Lectura automática del sensor (entrada) - Entry ID: ${entryId}`,
              origen_dato: "sensor",
              timestamp: feed.created_at,
              thingspeak_entry_id: entryId,
            })

            if (insertIngresoError) {
              console.error(
                `[sync-thingspeak] ✗ Error al insertar ingreso (entry ${entryId}):`,
                insertIngresoError.message,
              )
            } else {
              console.log(`[sync-thingspeak] ✅ Ingreso insertado en Supabase (entry ${entryId}): ${ingresoMl} mL`)
              totalProcesados++
            }
          } else {
            const razon = Number.isNaN(ingresoMl) ? "NaN (inválido)" : ingresoMl <= 0 ? "≤ 0 (ignorado)" : "desconocido"
            console.log(`[sync-thingspeak] ✗ Field1 NO procesado: ${razon}`)
          }

          // --- FIELD2 = SALIDA (EGRESO) ---
          const egresoRaw = feed.field2
          console.log(`[sync-thingspeak] Lectura field2 (RAW) → "${egresoRaw}"`)

          const egresoMl = egresoRaw != null ? Number.parseFloat(egresoRaw) : Number.NaN
          console.log(`[sync-thingspeak] Lectura field2 (PARSEADO) → ${egresoMl}`)

          if (!Number.isNaN(egresoMl) && egresoMl > 0) {
            console.log(`[sync-thingspeak] ✓ Clasificación: EGRESO (field2 > 0)`)
            console.log(`[sync-thingspeak] Categoría asignada: "Diuresis (orina)"`)
            console.log(`[sync-thingspeak] Volumen a insertar: ${egresoMl} mL`)

            const { error: insertEgresoError } = await supabase.from("eventos_balance").insert({
              paciente_id: paciente.id,
              tipo_movimiento: "egreso",
              volumen_ml: egresoMl,
              categoria: "Diuresis (orina)",
              descripcion: `Lectura automática del sensor (salida) - Entry ID: ${entryId}`,
              origen_dato: "sensor",
              timestamp: feed.created_at,
              thingspeak_entry_id: entryId,
            })

            if (insertEgresoError) {
              console.error(
                `[sync-thingspeak] ✗ Error al insertar egreso (entry ${entryId}):`,
                insertEgresoError.message,
              )
            } else {
              console.log(`[sync-thingspeak] ✅ Egreso insertado en Supabase (entry ${entryId}): ${egresoMl} mL`)
              totalProcesados++
            }
          } else {
            const razon = Number.isNaN(egresoMl) ? "NaN (inválido)" : egresoMl <= 0 ? "≤ 0 (ignorado)" : "desconocido"
            console.log(`[sync-thingspeak] ✗ Field2 NO procesado: ${razon}`)
          }

          if ((Number.isNaN(ingresoMl) || ingresoMl <= 0) && (Number.isNaN(egresoMl) || egresoMl <= 0)) {
            console.log(`[sync-thingspeak] ⚠ Entry ${entryId} ignorado completamente (ambos fields inválidos o ≤ 0)`)
          }
        }
      }
    }

    console.log("\n[sync-thingspeak] ========================================")
    console.log(`[sync-thingspeak] Sincronización completada. Total eventos procesados: ${totalProcesados}`)
    console.log("[sync-thingspeak] ========================================")

    return NextResponse.json({
      message: "Sincronización completada",
      procesados: totalProcesados,
    })
  } catch (error) {
    console.error("[sync-thingspeak] Error en sincronización ThingSpeak:", error)
    return NextResponse.json({ error: "Error en sincronización" }, { status: 500 })
  }
}
