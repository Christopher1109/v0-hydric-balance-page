// app/api/sync-thingspeak/route.ts
import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  try {
    console.log("[sync-thingspeak] Iniciando sincronización con ThingSpeak…")
    const supabase = await createClient()

    // 1. Cargar dispositivos activos
    const { data: dispositivos, error: dispositivosError } = await supabase
      .from("dispositivos")
      .select("*")
      .eq("activo", true)

    if (dispositivosError) {
      console.error("[sync-thingspeak] Error al cargar dispositivos:", dispositivosError)
      return NextResponse.json(
        { error: "Error al cargar dispositivos" },
        { status: 500 },
      )
    }

    if (!dispositivos || dispositivos.length === 0) {
      console.log("[sync-thingspeak] No hay dispositivos activos configurados")
      return NextResponse.json({
        message: "No hay dispositivos activos",
        procesados: 0,
      })
    }

    let totalProcesados = 0

    // 2. Recorrer cada dispositivo
    for (const dispositivo of dispositivos) {
      console.log(
        `[sync-thingspeak] Procesando dispositivo ${dispositivo.nombre} (channel_id=${dispositivo.channel_id})`,
      )

      // Pacientes activos asociados a ese dispositivo
      const { data: pacientes, error: pacientesError } = await supabase
        .from("pacientes")
        .select("*")
        .eq("dispositivo_id", dispositivo.id)
        .eq("activo", true)

      if (pacientesError) {
        console.error(
          `[sync-thingspeak] Error al cargar pacientes para dispositivo ${dispositivo.nombre}:`,
          pacientesError,
        )
        continue
      }

      if (!pacientes || pacientes.length === 0) {
        console.log(
          `[sync-thingspeak] No hay pacientes activos para el dispositivo ${dispositivo.nombre}`,
        )
        continue
      }

      // Por ahora asumimos 1 paciente por dispositivo
      for (const paciente of pacientes) {
        // 3. Buscar último entry procesado para ese paciente
        const { data: ultimoEvento, error: ultimoError } = await supabase
          .from("eventos_balance")
          .select("thingspeak_entry_id")
          .eq("paciente_id", paciente.id)
          .eq("origen_dato", "sensor")
          .order("thingspeak_entry_id", { ascending: false })
          .limit(1)

        if (ultimoError) {
          console.error(
            `[sync-thingspeak] Error al obtener último entry para paciente ${paciente.id}:`,
            ultimoError,
          )
        }

        const ultimoEntryId = ultimoEvento?.[0]?.thingspeak_entry_id ?? 0
        console.log(
          `[sync-thingspeak] Último entry_id procesado para paciente ${paciente.nombre}: ${ultimoEntryId}`,
        )

        // 4. Pedir los últimos feeds a ThingSpeak
        const thingspeakUrl = `https://api.thingspeak.com/channels/${dispositivo.channel_id}/feeds.json?api_key=${dispositivo.api_key}&results=100`
        console.log("[sync-thingspeak] URL:", thingspeakUrl)

        const response = await fetch(thingspeakUrl)
        if (!response.ok) {
          console.error(
            "[sync-thingspeak] Error al obtener datos de ThingSpeak:",
            response.status,
            response.statusText,
          )
          continue
        }

        const json = await response.json()
        const feeds: any[] = json.feeds ?? []

        console.log(
          `[sync-thingspeak] Feeds recibidos: ${feeds.length}. Last_entry_id canal: ${json.channel?.last_entry_id}`,
        )

        // 5. Filtrar solo los feeds nuevos
        const nuevosFeeds = feeds.filter(
          (f) => Number(f.entry_id) > Number(ultimoEntryId),
        )

        console.log(
          `[sync-thingspeak] Feeds nuevos a procesar para paciente ${paciente.nombre}: ${nuevosFeeds.length}`,
        )

        // 6. Insertar cada feed como egreso del sensor
        for (const feed of nuevosFeeds) {
          const entryId = Number(feed.entry_id)
          const createdAt = feed.created_at

          // ⚠️ IMPORTANTE:
          // Usamos field2 (SALIDA) como egreso en mL.
          // Si quisieras usar field1 como ingreso, aquí se podría agregar.
          const volumenStr = feed.field2 ?? feed.field1
          const volumenMl = Number.parseFloat(volumenStr)

          if (!Number.isFinite(volumenMl) || volumenMl <= 0) {
            console.log(
              `[sync-thingspeak] Saltando entry ${entryId} - volumen inválido: ${volumenStr}`,
            )
            continue
          }

          const { error: insertError } = await supabase.from("eventos_balance").insert({
            paciente_id: paciente.id,
            tipo_movimiento: "egreso",
            volumen_ml: volumenMl,
            categoria: "Diuresis (orina)",
            descripcion: `Lectura automática del sensor - Entry ID: ${entryId}`,
            origen_dato: "sensor",
            timestamp: createdAt,
            thingspeak_entry_id: entryId,
          })

          if (insertError) {
            console.error(
              `[sync-thingspeak] Error al insertar evento entry_id=${entryId}:`,
              insertError,
            )
          } else {
            console.log(
              `[sync-thingspeak] ✅ Insertado evento entry_id=${entryId}: ${volumenMl} mL`,
            )
            totalProcesados++
          }
        }
      }
    }

    console.log(
      `[sync-thingspeak] Sincronización completada. Total eventos nuevos: ${totalProcesados}`,
    )

    return NextResponse.json({
      message: "Sincronización completada",
      procesados: totalProcesados,
    })
  } catch (error) {
    console.error("[sync-thingspeak] Error general:", error)
    return NextResponse.json({ error: "Error en sincronización" }, { status: 500 })
  }
}
