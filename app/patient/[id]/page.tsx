"use client"

import { useEffect, useState } from "react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Droplets, TrendingDown, TrendingUp, ArrowLeft, User } from "lucide-react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { AgregarIngresoDialog } from "@/components/agregar-ingreso-dialog"
import { AgregarEgresoDialog } from "@/components/agregar-egreso-dialog"
import { EliminarPacienteDialog } from "@/components/eliminar-paciente-dialog"
import type { Paciente, BalanceResumen, ResumenFlujo } from "@/lib/types"
import {
  calcularIngresosInsensibles,
  calcularEgresosInsensibles,
} from "@/lib/types"

interface ChartData {
  time: string
  volumen: number
}

interface BalanceDesglosado extends BalanceResumen {
  ingresos_sensor: number
  ingresos_manual: number
  egresos_sensor: number
  egresos_manual: number
}

// Helper para evitar errores de toFixed
const formatNumber = (value: number | null | undefined, decimals = 2) => {
  if (typeof value === "number" && !Number.isNaN(value)) return value.toFixed(decimals)
  return "0.00"
}

// -------- KDIGO TYPES & LOGIC ---------

interface KdigoStatus {
  stage: 0 | 1 | 2 | 3 | null
  label: string
  descripcion: string
  textColor: string
  badgeClass: string
  diuresisMlKgH: number
}

/**
 * Calcula el estadio KDIGO basado en:
 * - egresosTotalesMl: solo egresos (sensor + manual + insensibles)
 * - pesoKg
 * - horasObs: horas de observación desde el inicio
 */
function calcularKdigo(
  egresosTotalesMl: number,
  pesoKg: number,
  horasObs: number,
): KdigoStatus {
  if (!pesoKg || horasObs <= 0) {
    return {
      stage: null,
      label: "No evaluable",
      descripcion: "Se requiere peso del paciente y tiempo de observación mayor a 0 h.",
      textColor: "text-muted-foreground",
      badgeClass: "bg-gray-200 text-gray-800",
      diuresisMlKgH: 0,
    }
  }

  const diuresis = egresosTotalesMl / (pesoKg * horasObs) // mL/kg/h

  if (horasObs < 6) {
    return {
      stage: null,
      label: "En observación",
      descripcion:
        "Menos de 6 horas de observación. Aún no se puede clasificar según KDIGO por diuresis.",
      textColor: "text-slate-600",
      badgeClass: "bg-slate-200 text-slate-800",
      diuresisMlKgH: diuresis,
    }
  }

  let stage: 0 | 1 | 2 | 3 = 0
  let label = "Sin LRA por diuresis"
  let descripcion = "La diuresis estimada es adecuada de acuerdo con los criterios KDIGO."
  let textColor = "text-emerald-600"
  let badgeClass = "bg-emerald-100 text-emerald-800"

  if (egresosTotalesMl <= 1 && horasObs >= 12) {
    stage = 3
    label = "Estadio 3 (anuria)"
    descripcion =
      "Diuresis prácticamente nula (anuria) durante al menos 12 horas. Alto riesgo de LRA severa."
    textColor = "text-red-600"
    badgeClass = "bg-red-100 text-red-800"
  } else if (diuresis < 0.3 && horasObs >= 24) {
    stage = 3
    label = "Estadio 3"
    descripcion =
      "Diuresis < 0.3 mL/kg/h durante al menos 24 horas. Criterio KDIGO de LRA estadio 3."
    textColor = "text-red-600"
    badgeClass = "bg-red-100 text-red-800"
  } else if (diuresis < 0.5 && horasObs >= 12) {
    stage = 2
    label = "Estadio 2"
    descripcion =
      "Diuresis < 0.5 mL/kg/h durante al menos 12 horas. Criterio KDIGO de LRA estadio 2."
    textColor = "text-amber-600"
    badgeClass = "bg-amber-100 text-amber-800"
  } else if (diuresis < 0.5 && horasObs >= 6) {
    stage = 1
    label = "Estadio 1"
    descripcion =
      "Diuresis < 0.5 mL/kg/h entre 6 y 12 horas. Criterio KDIGO de LRA estadio 1."
    textColor = "text-yellow-600"
    badgeClass = "bg-yellow-100 text-yellow-800"
  }

  return {
    stage,
    label,
    descripcion,
    textColor,
    badgeClass,
    diuresisMlKgH: diuresis,
  }
}

// -------- BALANCE HIDRICO: CLASIFICACIÓN POR mL/kg ---------

interface BalanceAlertStatus {
  label: string
  textColor: string
  badgeClass: string
}

/**
 * Clasifica el balance hídrico ajustado por peso (mL/kg):
 * - Neutro: entre -10 y +10 mL/kg
 * - Riesgo medio: entre ±10 y ±40 mL/kg
 * - Riesgo alto: ≥ ±40 mL/kg
 */
function getBalanceAlertStatus(balanceMlKg: number, hasPeso: boolean): BalanceAlertStatus {
  if (!hasPeso) {
    return {
      label: "No evaluable (sin peso)",
      textColor: "text-muted-foreground",
      badgeClass: "bg-gray-200 text-gray-800",
    }
  }

  const absVal = Math.abs(balanceMlKg)

  if (absVal <= 10) {
    return {
      label: "Balance neutro",
      textColor: "text-emerald-600",
      badgeClass: "bg-emerald-100 text-emerald-800",
    }
  }

  if (absVal < 40) {
    return {
      label: "Riesgo medio",
      textColor: "text-amber-600",
      badgeClass: "bg-amber-100 text-amber-800",
    }
  }

  return {
    label: "Riesgo alto",
    textColor: "text-red-600",
    badgeClass: "bg-red-100 text-red-800",
  }
}

export default function PatientDetailPage() {
  const params = useParams()
  const patienteId = Number.parseInt(params.id as string)

  const [paciente, setPaciente] = useState<Paciente | null>(null)
  const [balance24h, setBalance24h] = useState<BalanceDesglosado>({
    total_ingresos_ml: 0,
    total_egresos_ml: 0,
    balance_ml: 0,
    ingresos_sensor: 0,
    ingresos_manual: 0,
    egresos_sensor: 0,
    egresos_manual: 0,
  })
  const [chartDataIngresos, setChartDataIngresos] = useState<ChartData[]>([])
  const [chartDataEgresos, setChartDataEgresos] = useState<ChartData[]>([])
  const [chartDataBalance, setChartDataBalance] = useState<ChartData[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  const supabase = createClient()

  // --------- CARGAR PACIENTE ---------
  const cargarDatosPaciente = async () => {
    try {
      const { data, error } = await supabase
        .from("pacientes")
        .select(`*, dispositivo:dispositivos(*)`)
        .eq("id", patienteId)
        .single()

      if (error) {
        console.error("[patient] Error Supabase al cargar paciente:", error)
        return
      }

      if (!data) {
        console.warn("[patient] No se encontró datos de paciente en Supabase")
        return
      }

      const peso = data.peso_kg ?? data.peso ?? 0
      const talla = data.talla_cm ?? data.talla ?? 0
      const edad = data.edad_anios ?? data.edad ?? 0
      const imc =
        peso > 0 && talla > 0 ? Number((peso / Math.pow(talla / 100, 2)).toFixed(2)) : 0

      const pacienteNormalizado: Paciente = {
        id: data.id,
        nombre: data.nombre,
        edad_anios: edad,
        peso_kg: peso,
        talla_cm: talla,
        imc,
        fecha_creacion: data.created_at ?? "",
        dispositivo_id: data.dispositivo_id ?? null,
        ultimo_timestamp_leido: data.ultimo_timestamp_leido ?? null,
        dispositivo: data.dispositivo ?? null,
      }

      setPaciente(pacienteNormalizado)
    } catch (err) {
      console.error(
        "[patient] Error inesperado al cargar paciente (no JSON válido):",
        err,
      )
    }
  }

  // --------- CALCULAR BALANCE (solo eventos) ---------
  const calcularBalance = async () => {
    try {
      const { data, error } = await supabase
        .from("eventos_balance")
        .select("tipo_movimiento, volumen_ml, origen_dato, timestamp")
        .eq("paciente_id", patienteId)
        .order("timestamp", { ascending: false })

      if (error || !data) {
        console.error("Error al calcular balance:", error)
        return
      }

      const ingresosSensorEventos = data.filter(
        (e) => e.tipo_movimiento === "ingreso" && e.origen_dato === "sensor",
      )
      const ingresosManualEventos = data.filter(
        (e) => e.tipo_movimiento === "ingreso" && e.origen_dato === "manual",
      )
      const egresosSensorEventos = data.filter(
        (e) => e.tipo_movimiento === "egreso" && e.origen_dato === "sensor",
      )
      const egresosManualEventos = data.filter(
        (e) => e.tipo_movimiento === "egreso" && e.origen_dato === "manual",
      )

      // 🔵 Ingresos: se siguen acumulando (sensor + manual)
      const ingresos_sensor_total = ingresosSensorEventos.reduce(
        (s, e) => s + e.volumen_ml,
        0,
      )
      const ingresos_manual_total = ingresosManualEventos.reduce(
        (s, e) => s + e.volumen_ml,
        0,
      )

      // 🟠 EGRESOS SENSOR: SOLO TOMAMOS EL ÚLTIMO VALOR (NO SUMAMOS TODO)
      const ultimoEgresoSensor = egresosSensorEventos[0]
      const egresos_sensor_total = ultimoEgresoSensor ? ultimoEgresoSensor.volumen_ml : 0

      // 🟠 EGRESOS MANUAL: estos sí se acumulan (bolos, etc.)
      const egresos_manual_total = egresosManualEventos.reduce(
        (s, e) => s + e.volumen_ml,
        0,
      )

      const ultimoIngresoSensor = ingresosSensorEventos[0]
      const ultimoIngresoManual = ingresosManualEventos[0]
      const ultimoEgresoManual = egresosManualEventos[0]

      const total_ingresos = ingresos_sensor_total + ingresos_manual_total
      const total_egresos = egresos_sensor_total + egresos_manual_total

      setBalance24h({
        total_ingresos_ml: total_ingresos,
        total_egresos_ml: total_egresos,
        balance_ml: total_ingresos - total_egresos,
        ingresos_sensor: ultimoIngresoSensor?.volumen_ml || 0,
        ingresos_manual: ultimoIngresoManual?.volumen_ml || 0,
        egresos_sensor: ultimoEgresoSensor?.volumen_ml || 0,
        egresos_manual: ultimoEgresoManual?.volumen_ml || 0,
      })

      console.log("[patient] Totales sensor:", {
        ingresos_sensor_total,
        egresos_sensor_total,
      })
    } catch (err) {
      console.error("[patient] Error inesperado al calcular balance:", err)
    }
  }

  // --------- DATOS PARA GRÁFICAS ---------
  const cargarDatosGrafica = async () => {
    try {
      const { data, error } = await supabase
        .from("eventos_balance")
        .select("tipo_movimiento, volumen_ml, timestamp")
        .eq("paciente_id", patienteId)
        .order("timestamp", { ascending: true })

      if (error || !data) {
        console.error("Error al cargar datos de gráfica:", error)
        return
      }

      const datosIngresos: ChartData[] = []
      const datosEgresos: ChartData[] = []
      const datosBalance: ChartData[] = []

      let balanceAcumulado = 0

      data.forEach((e) => {
        const fecha = new Date(e.timestamp)
        const timeKey = fecha.toLocaleTimeString("es-ES", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })

        if (e.tipo_movimiento === "ingreso") {
          datosIngresos.push({ time: timeKey, volumen: e.volumen_ml })
          balanceAcumulado += e.volumen_ml
        } else {
          datosEgresos.push({ time: timeKey, volumen: -e.volumen_ml })
          balanceAcumulado -= e.volumen_ml
        }

        datosBalance.push({ time: timeKey, volumen: balanceAcumulado })
      })

      setChartDataIngresos(datosIngresos.slice(-5))
      setChartDataEgresos(datosEgresos.slice(-5))
      setChartDataBalance(datosBalance.slice(-20))
    } catch (err) {
      console.error("[patient] Error inesperado al cargar datos de gráfica:", err)
    }
  }

  // --------- THINGSPEAK ---------
  const sincronizarThingSpeak = async () => {
    try {
      const res = await fetch("/api/sync-thingspeak")
      console.log("[patient] Llamando /api/sync-thingspeak, status:", res.status)
      if (!res.ok) return
      await res.json().catch(() => null)
    } catch (e) {
      console.error("[patient] Error llamando a /api/sync-thingspeak:", e)
    }
  }

  const actualizarTodo = async () => {
    setLoading(true)

    try {
      await sincronizarThingSpeak()
    } catch (err) {
      console.error("[patient] Error al sincronizar ThingSpeak:", err)
    }

    try {
      await Promise.all([cargarDatosPaciente(), calcularBalance(), cargarDatosGrafica()])
    } catch (err) {
      console.error("[patient] Error al actualizar datos del paciente:", err)
    }

    setLastUpdate(new Date())
    setLoading(false)
  }

  // 🔴 REINICIAR BALANCE: BORRA EVENTOS + ESTADO KDIGO PARA ESTE PACIENTE
  const reiniciarBalance = async () => {
    if (
      !confirm(
        "¿Seguro que deseas reiniciar el balance? Esto borrará los datos actuales.",
      )
    ) {
      return
    }

    try {
      await supabase.from("eventos_balance").delete().eq("paciente_id", patienteId)
      await supabase.from("kdigo_estado_actual").delete().eq("paciente_id", patienteId)
      await actualizarTodo()
    } catch (err) {
      console.error("[patient] Error al reiniciar balance:", err)
    }
  }

  useEffect(() => {
    actualizarTodo()
    const interval = setInterval(actualizarTodo, 30000) // 30 segundos
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patienteId])

  if (!paciente && !loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Card>
          <CardHeader>
            <CardTitle>Paciente no encontrado</CardTitle>
          </CardHeader>
          <CardContent>
            <Link href="/">
              <Button>Volver al Lobby</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ========= CÁLCULO DE DESPRECIABLES Y RESÚMENES =========
  const hayEventos =
    balance24h.total_ingresos_ml !== 0 || balance24h.total_egresos_ml !== 0

  let ingresosDespreciables = { porHora: 0, acumulado: 0 }
  let egresosDespreciables = { porHora: 0, acumulado: 0 }

  if (hayEventos && paciente) {
    const horas = 1
    ingresosDespreciables = calcularIngresosInsensibles(paciente.peso_kg, horas)
    egresosDespreciables = calcularEgresosInsensibles(paciente.peso_kg, horas)
  }

  const ingresos_sensor_total_real =
    balance24h.total_ingresos_ml - (balance24h.ingresos_manual || 0)
  const egresos_sensor_total_real =
    balance24h.total_egresos_ml - (balance24h.egresos_manual || 0)

  const ingresosResumen: ResumenFlujo = {
    sensor: {
      ultimo: balance24h.ingresos_sensor,
      total: ingresos_sensor_total_real,
    },
    manual: {
      ultimo: balance24h.ingresos_manual,
      total: balance24h.total_ingresos_ml - ingresos_sensor_total_real,
    },
    despreciables: ingresosDespreciables,
  }

  const egresosResumen: ResumenFlujo = {
    sensor: {
      ultimo: balance24h.egresos_sensor,
      total: egresos_sensor_total_real,
    },
    manual: {
      ultimo: balance24h.egresos_manual,
      total: balance24h.total_egresos_ml - egresos_sensor_total_real,
    },
    despreciables: egresosDespreciables,
  }

  const totalIngresosMostrado =
    balance24h.total_ingresos_ml + ingresosResumen.despreciables.acumulado
  const totalEgresosMostrado =
    balance24h.total_egresos_ml + egresosResumen.despreciables.acumulado

  const balanceMostrado = totalIngresosMostrado - totalEgresosMostrado

  // ========= BALANCE mL/kg Y RANGO CLÍNICO =========
  const pesoKg = paciente?.peso_kg ?? 0
  const balanceMlKg = pesoKg > 0 ? balanceMostrado / pesoKg : 0
  const balanceStatus = getBalanceAlertStatus(balanceMlKg, !!pesoKg)

  // ========= KDIGO =========
  let horasObsKdigo = 0
  if (paciente?.fecha_creacion) {
    const t0 = new Date(paciente.fecha_creacion).getTime()
    const now = Date.now()
    if (!Number.isNaN(t0) && now > t0) {
      horasObsKdigo = (now - t0) / (1000 * 60 * 60)
    }
  }

  const kdigo = paciente
    ? calcularKdigo(totalEgresosMostrado, paciente.peso_kg, horasObsKdigo)
    : calcularKdigo(0, 0, 0)

  useEffect(() => {
    const guardarKdigo = async () => {
      if (!paciente) return
      try {
        await supabase.from("kdigo_estado_actual").upsert({
          paciente_id: paciente.id,
          updated_at: new Date().toISOString(),
          horas_observadas: horasObsKdigo,
          egresos_totales_ml: totalEgresosMostrado,
          diuresis_ml_kg_h: kdigo.diuresisMlKgH,
          estadio: kdigo.stage,
          etiqueta: kdigo.label,
        })
      } catch (err) {
        console.error("[patient] Error al guardar KDIGO:", err)
      }
    }

    if (paciente) {
      void guardarKdigo()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paciente?.id, horasObsKdigo, totalEgresosMostrado, kdigo.stage])

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* HEADER */}
        <div className="flex items-center justify-between">
          <Link href="/">
            <Button variant="outline" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver al Lobby
            </Button>
          </Link>
          {paciente && (
            <EliminarPacienteDialog
              pacienteId={patienteId}
              nombrePaciente={paciente.nombre}
            />
          )}
        </div>

        {/* PACIENTE */}
        {paciente && (
          <Card className="border-2">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-primary/10 p-3">
                  <User className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-2xl">{paciente.nombre}</CardTitle>
                  <CardDescription>Información del Paciente</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-4">
                <div>
                  <p className="text-sm text-muted-foreground">Edad</p>
                  <p className="text-2xl font-bold">{paciente.edad_anios} años</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Peso</p>
                  <p className="text-2xl font-bold">{paciente.peso_kg} kg</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Talla</p>
                  <p className="text-2xl font-bold">{paciente.talla_cm} cm</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">IMC</p>
                  <p className="text-2xl font-bold">
                    {formatNumber(paciente.imc, 2)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* BALANCE HIDRICO */}
        <div className="space-y-2">
          <h2 className="text-2xl font-bold">Balance Hídrico Total Acumulado</h2>
          {lastUpdate && (
            <p className="text-sm text-muted-foreground">
              Última actualización: {lastUpdate.toLocaleTimeString("es-ES")}
            </p>
          )}
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {/* INGRESOS */}
          <Card className="border-2">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Ingresos</CardTitle>
                <div className="rounded-full bg-blue-500/10 p-2">
                  <TrendingUp className="h-5 w-5 text-blue-600" />
                </div>
              </div>
              <CardDescription>Total acumulado</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-4xl font-bold text-blue-600">
                  {totalIngresosMostrado.toFixed(1)}
                </p>
                <p className="text-sm text-muted-foreground">mililitros (mL)</p>
              </div>

              <div className="space-y-2 border-t pt-3 text-sm">
                <p className="font-semibold text-muted-foreground">
                  SENSOR (total)
                </p>
                <div className="flex justify-between">
                  <span>Último / Volumen acumulado</span>
                  <span className="font-bold">
                    {ingresosResumen.sensor.ultimo.toFixed(1)} mL /{" "}
                    {ingresosResumen.sensor.total.toFixed(1)} mL
                  </span>
                </div>

                <p className="pt-2 font-semibold text-muted-foreground">
                  MANUAL (total)
                </p>
                <div className="flex justify-between">
                  <span>Último / Volumen acumulado</span>
                  <span className="font-bold">
                    {ingresosResumen.manual.ultimo.toFixed(1)} mL /{" "}
                    {ingresosResumen.manual.total.toFixed(1)} mL
                  </span>
                </div>

                <p className="pt-2 font-semibold text-muted-foreground">
                  DESPRECIABLES
                </p>
                <div className="flex justify-between">
                  <span>Por hora / Acumulado</span>
                  <span className="font-bold">
                    {ingresosResumen.despreciables.porHora.toFixed(1)} mL /{" "}
                    {ingresosResumen.despreciables.acumulado.toFixed(1)} mL
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* EGRESOS */}
          <Card className="border-2">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Egresos</CardTitle>
                <div className="rounded-full bg-orange-500/10 p-2">
                  <TrendingDown className="h-5 w-5 text-orange-600" />
                </div>
              </div>
              <CardDescription>Total acumulado</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-4xl font-bold text-orange-600">
                  {totalEgresosMostrado.toFixed(1)}
                </p>
                <p className="text-sm text-muted-foreground">mililitros (mL)</p>
              </div>

              <div className="space-y-2 border-t pt-3 text-sm">
                <p className="font-semibold text-muted-foreground">
                  SENSOR (último valor)
                </p>
                <div className="flex justify-between">
                  <span>Último / Volumen tomado</span>
                  <span className="font-bold">
                    {egresosResumen.sensor.ultimo.toFixed(1)} mL /{" "}
                    {egresosResumen.sensor.total.toFixed(1)} mL
                  </span>
                </div>

                <p className="pt-2 font-semibold text-muted-foreground">
                  MANUAL (total)
                </p>
                <div className="flex justify-between">
                  <span>Último / Volumen acumulado</span>
                  <span className="font-bold">
                    {egresosResumen.manual.ultimo.toFixed(1)} mL /{" "}
                    {egresosResumen.manual.total.toFixed(1)} mL
                  </span>
                </div>

                <p className="pt-2 font-semibold text-muted-foreground">
                  DESPRECIABLES
                </p>
                <div className="flex justify-between">
                  <span>Por hora / Acumulado</span>
                  <span className="font-bold">
                    {egresosResumen.despreciables.porHora.toFixed(1)} mL /{" "}
                    {egresosResumen.despreciables.acumulado.toFixed(1)} mL
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* BALANCE HIDRICO */}
          <Card className="border-2">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Balance Hídrico</CardTitle>
                <div className="rounded-full bg-accent p-2">
                  <Droplets className="h-5 w-5 text-accent-foreground" />
                </div>
              </div>
              <CardDescription>Resultado neto acumulado</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center space-y-2 text-center">
              <p className={`text-5xl font-extrabold ${balanceStatus.textColor}`}>
                {balanceMostrado.toFixed(1)}
              </p>
              <p className="text-sm text-muted-foreground">mililitros (mL)</p>
              <p className="text-xs text-muted-foreground">
                {pesoKg > 0
                  ? `Balance ajustado: ${balanceMlKg.toFixed(1)} mL/kg`
                  : "Balance ajustado no disponible (sin peso registrado)"}
              </p>
              <Badge
                className={`mt-1 px-4 py-1 text-sm ${balanceStatus.badgeClass}`}
              >
                {balanceStatus.label}
              </Badge>
            </CardContent>
          </Card>
        </div>

        {/* KDIGO */}
        {paciente && (
          <Card className="border-2">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Criterios KDIGO (diuresis)</CardTitle>
                <Badge className={kdigo.badgeClass}>{kdigo.label}</Badge>
              </div>
              <CardDescription>
                Basado únicamente en egresos (sensor, manual e insensibles), expresados como
                mL/kg/h.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>
                Diuresis estimada:{" "}
                <span className={`font-semibold ${kdigo.textColor}`}>
                  {kdigo.diuresisMlKgH.toFixed(2)} mL/kg/h
                </span>
              </p>
              <p>
                Horas de observación desde el inicio:{" "}
                <span className="font-semibold">
                  {horasObsKdigo.toFixed(1)} h
                </span>
              </p>
              <p className="text-muted-foreground">{kdigo.descripcion}</p>
            </CardContent>
          </Card>
        )}

        {/* BOTONES */}
        <div className="flex gap-3">
          <AgregarIngresoDialog pacienteId={patienteId} onEventoAgregado={actualizarTodo} />
          <AgregarEgresoDialog pacienteId={patienteId} onEventoAgregado={actualizarTodo} />
          <Button variant="destructive" onClick={reiniciarBalance} disabled={loading}>
            Reiniciar Balance
          </Button>
        </div>

        {/* GRÁFICAS */}
        <h2 className="text-2xl font-bold">Historial de Balance Hídrico</h2>

        <div className="grid gap-6 md:grid-cols-2">
          <Card className="border-2">
            <CardHeader>
              <CardTitle>Ingresos Recientes</CardTitle>
              <CardDescription>Últimos 5</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={chartDataIngresos}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" />
                  <YAxis />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="volumen"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardHeader>
              <CardTitle>Egresos Recientes</CardTitle>
              <CardDescription>Últimos 5</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={chartDataEgresos}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" />
                  <YAxis />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="volumen"
                    stroke="#f97316"
                    strokeWidth={2}
                    dot
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <Card className="border-2">
          <CardHeader>
            <CardTitle>Balance Hídrico Reciente</CardTitle>
            <CardDescription>Últimos 20 registros</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={chartDataBalance}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis />
                <Tooltip formatter={(v: number) => `${v} mL`} />
                <Line
                  type="monotone"
                  dataKey="volumen"
                  stroke="#22c55e"
                  strokeWidth={3}
                  dot={{ fill: "#22c55e", r: 4 }}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
