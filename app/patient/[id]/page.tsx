"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Droplets, TrendingDown, TrendingUp, ArrowLeft, User } from "lucide-react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { AgregarIngresoDialog } from "@/components/agregar-ingreso-dialog"
import { AgregarEgresoDialog } from "@/components/agregar-egreso-dialog"
import { EliminarPacienteDialog } from "@/components/eliminar-paciente-dialog"
import type {
  Paciente,
  BalanceResumen,
  ResumenFlujo,
  DespreciablesInfo,
} from "@/lib/types"
import {
  getBalanceStatus,
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
  const [horasTranscurridas, setHorasTranscurridas] = useState<number>(0)

  const supabase = createClient()

  const cargarDatosPaciente = async () => {
    const { data, error } = await supabase
      .from("pacientes")
      .select(`*, dispositivo:dispositivos(*)`)
      .eq("id", patienteId)
      .single()

    if (error) console.error("Error al cargar paciente:", error)
    setPaciente(data as Paciente | null)
  }

  const calcularBalance = async () => {
    const { data, error } = await supabase
      .from("eventos_balance")
      .select("tipo_movimiento, volumen_ml, origen_dato, timestamp")
      .eq("paciente_id", patienteId)
      .order("timestamp", { ascending: false })

    if (error || !data) {
      console.error("Error al calcular balance:", error)
      return
    }

    const ingresos_sensor_total = data
      .filter((e) => e.tipo_movimiento === "ingreso" && e.origen_dato === "sensor")
      .reduce((s, e) => s + e.volumen_ml, 0)

    const ingresos_manual_total = data
      .filter((e) => e.tipo_movimiento === "ingreso" && e.origen_dato === "manual")
      .reduce((s, e) => s + e.volumen_ml, 0)

    const egresos_sensor_total = data
      .filter((e) => e.tipo_movimiento === "egreso" && e.origen_dato === "sensor")
      .reduce((s, e) => s + e.volumen_ml, 0)

    const egresos_manual_total = data
      .filter((e) => e.tipo_movimiento === "egreso" && e.origen_dato === "manual")
      .reduce((s, e) => s + e.volumen_ml, 0)

    const ultimoIngresoSensor = data.find((e) => e.tipo_movimiento === "ingreso" && e.origen_dato === "sensor")
    const ultimoIngresoManual = data.find((e) => e.tipo_movimiento === "ingreso" && e.origen_dato === "manual")
    const ultimoEgresoSensor = data.find((e) => e.tipo_movimiento === "egreso" && e.origen_dato === "sensor")
    const ultimoEgresoManual = data.find((e) => e.tipo_movimiento === "egreso" && e.origen_dato === "manual")

    const total_ingresos = ingresos_sensor_total + ingresos_manual_total
    const total_egresos = egresos_sensor_total + egresos_manual_total

    // calcular horas transcurridas desde el primer evento
    if (data.length > 0) {
      const timestamps = data.map((e) => new Date(e.timestamp).getTime())
      const minTs = Math.min(...timestamps)
      const diffMs = Date.now() - minTs
      const horas = Math.max(1, Math.round(diffMs / (1000 * 60 * 60)))
      setHorasTranscurridas(horas)
    } else {
      setHorasTranscurridas(0)
    }

    setBalance24h({
      total_ingresos_ml: total_ingresos,
      total_egresos_ml: total_egresos,
      balance_ml: total_ingresos - total_egresos,
      ingresos_sensor: ultimoIngresoSensor?.volumen_ml || 0,
      ingresos_manual: ultimoIngresoManual?.volumen_ml || 0,
      egresos_sensor: ultimoEgresoSensor?.volumen_ml || 0,
      egresos_manual: ultimoEgresoManual?.volumen_ml || 0,
    })
  }

  const cargarDatosGrafica = async () => {
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
  }

  const sincronizarThingSpeak = async () => {
    try {
      const res = await fetch("/api/sync-thingspeak")
      if (!res.ok) return
      await res.json().catch(() => null)
    } catch (e) {
      console.error(e)
    }
  }

  const actualizarTodo = async () => {
    setLoading(true)
    await sincronizarThingSpeak()
    await Promise.all([cargarDatosPaciente(), calcularBalance(), cargarDatosGrafica()])
    setLastUpdate(new Date())
    setLoading(false)
  }

  const reiniciarBalance = async () => {
    if (!confirm("¿Seguro que deseas reiniciar el balance?")) return
    await supabase.from("eventos_balance").delete().eq("paciente_id", patienteId)
    await actualizarTodo()
  }

  useEffect(() => {
    actualizarTodo()
    const interval = setInterval(actualizarTodo, 15000)
    return () => clearInterval(interval)
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

  // ========= CÁLCULO DE DESPRECIABLES (INGRESOS / EGRESOS) =========
  const hayEventos =
    balance24h.total_ingresos_ml !== 0 || balance24h.total_egresos_ml !== 0

  let ingresosDespreciables: DespreciablesInfo = { porHora: 0, acumulado: 0 }
  let egresosDespreciables: DespreciablesInfo = { porHora: 0, acumulado: 0 }

  if (hayEventos && paciente) {
    const horas = Math.max(horasTranscurridas, 1)
    ingresosDespreciables = calcularIngresosInsensibles(paciente.peso_kg, horas)
    egresosDespreciables = calcularEgresosInsensibles(paciente.peso_kg, horas)
  }

  const ingresosResumen: ResumenFlujo = {
    sensor: {
      ultimo: balance24h.ingresos_sensor,
      total: balance24h.ingresos_sensor,
    },
    manual: {
      ultimo: balance24h.ingresos_manual,
      total: balance24h.total_ingresos_ml - balance24h.ingresos_sensor,
    },
    despreciables: ingresosDespreciables,
  }

  const egresosResumen: ResumenFlujo = {
    sensor: {
      ultimo: balance24h.egresos_sensor,
      total: balance24h.egresos_sensor,
    },
    manual: {
      ultimo: balance24h.egresos_manual,
      total: balance24h.total_egresos_ml - balance24h.egresos_sensor,
    },
    despreciables: egresosDespreciables,
  }

  // Totales mostrados en las tarjetas de Ingresos/Egresos (incluyen despreciables)
  const totalIngresosMostrado =
    balance24h.total_ingresos_ml + ingresosResumen.despreciables.acumulado
  const totalEgresosMostrado =
    balance24h.total_egresos_ml + egresosResumen.despreciables.acumulado

  // Balance principal: SOLO ingresos - egresos (igual que en el Lobby)
  const balanceMostrado = balance24h.balance_ml
  const balanceStatus = getBalanceStatus(balanceMostrado)

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* HEADER: volver y eliminar */}
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

        {/* TARJETA DE INFORMACIÓN DEL PACIENTE */}
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

        {/* SECCIÓN DE BALANCE HIDRICO */}
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
                  INFORMACIÓN DEL SENSOR
                </p>
                <div className="flex justify-between">
                  <span>Último / Total</span>
                  <span className="font-bold">
                    {ingresosResumen.sensor.ultimo} mL /{" "}
                    {ingresosResumen.sensor.total} mL
                  </span>
                </div>

                <p className="pt-2 font-semibold text-muted-foreground">
                  INGRESO MANUAL
                </p>
                <div className="flex justify-between">
                  <span>Último / Acumulado</span>
                  <span className="font-bold">
                    {ingresosResumen.manual.ultimo} mL /{" "}
                    {ingresosResumen.manual.total} mL
                  </span>
                </div>

                <p className="pt-2 font-semibold text-muted-foreground">
                  CÁLCULO DE DESPRECIABLES (INSENSIBLES)
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
                  INFORMACIÓN DEL SENSOR
                </p>
                <div className="flex justify-between">
                  <span>Último / Total</span>
                  <span className="font-bold">
                    {egresosResumen.sensor.ultimo} mL /{" "}
                    {egresosResumen.sensor.total} mL
                  </span>
                </div>

                <p className="pt-2 font-semibold text-muted-foreground">
                  EGRESO MANUAL
                </p>
                <div className="flex justify-between">
                  <span>Último / Acumulado</span>
                  <span className="font-bold">
                    {egresosResumen.manual.ultimo} mL /{" "}
                    {egresosResumen.manual.total} mL
                  </span>
                </div>

                <p className="pt-2 font-semibold text-muted-foreground">
                  CÁLCULO DE DESPRECIABLES (INSENSIBLES)
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
              <Badge className="mt-1 px-4 py-1 text-sm" variant="secondary">
                {balanceStatus.label}
              </Badge>
            </CardContent>
          </Card>
        </div>

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
                  <Line type="monotone" dataKey="volumen" stroke="#3b82f6" strokeWidth={2} dot />
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
                  <Line type="monotone" dataKey="volumen" stroke="#f97316" strokeWidth={2} dot />
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
