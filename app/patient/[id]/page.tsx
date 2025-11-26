"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Activity, Droplets, TrendingDown, TrendingUp, ArrowLeft, User } from "lucide-react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { AgregarIngresoDialog } from "@/components/agregar-ingreso-dialog"
import { AgregarEgresoDialog } from "@/components/agregar-egreso-dialog"
import { EliminarPacienteDialog } from "@/components/eliminar-paciente-dialog"
import type { Paciente, BalanceResumen } from "@/lib/types"
import { getBalanceStatus } from "@/lib/types"

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

  const cargarDatosPaciente = async () => {
    const { data, error } = await supabase
      .from("pacientes")
      .select(`
        *,
        dispositivo:dispositivos(*)
      `)
      .eq("id", patienteId)
      .single()

    if (error) {
      console.error("Error al cargar paciente:", error)
      return
    }

    setPaciente(data)
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
      .reduce((sum, e) => sum + e.volumen_ml, 0)

    const ingresos_manual_total = data
      .filter((e) => e.tipo_movimiento === "ingreso" && e.origen_dato === "manual")
      .reduce((sum, e) => sum + e.volumen_ml, 0)

    const egresos_sensor_total = data
      .filter((e) => e.tipo_movimiento === "egreso" && e.origen_dato === "sensor")
      .reduce((sum, e) => sum + e.volumen_ml, 0)

    const egresos_manual_total = data
      .filter((e) => e.tipo_movimiento === "egreso" && e.origen_dato === "manual")
      .reduce((sum, e) => sum + e.volumen_ml, 0)

    const ultimoIngresoSensor = data.find((e) => e.tipo_movimiento === "ingreso" && e.origen_dato === "sensor")
    const ultimoIngresoManual = data.find((e) => e.tipo_movimiento === "ingreso" && e.origen_dato === "manual")
    const ultimoEgresoSensor = data.find((e) => e.tipo_movimiento === "egreso" && e.origen_dato === "sensor")
    const ultimoEgresoManual = data.find((e) => e.tipo_movimiento === "egreso" && e.origen_dato === "manual")

    const total_ingresos = ingresos_sensor_total + ingresos_manual_total
    const total_egresos = egresos_sensor_total + egresos_manual_total

    console.log("[v0] Total Ingresos:", total_ingresos, "Total Egresos:", total_egresos)
    console.log("[v0] Último Ingreso Sensor:", ultimoIngresoSensor?.volumen_ml || 0)
    console.log("[v0] Último Ingreso Manual:", ultimoIngresoManual?.volumen_ml || 0)
    console.log("[v0] Último Egreso Sensor:", ultimoEgresoSensor?.volumen_ml || 0)
    console.log("[v0] Último Egreso Manual:", ultimoEgresoManual?.volumen_ml || 0)

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
      setChartDataIngresos([])
      setChartDataEgresos([])
      setChartDataBalance([])
      return
    }

    console.log("[v0] Total eventos obtenidos:", data.length)

    const datosIngresos: ChartData[] = []
    const datosEgresos: ChartData[] = []
    const datosBalance: ChartData[] = []

    let balanceAcumulado = 0

    // Procesar cada evento individualmente
    data.forEach((evento) => {
      const fecha = new Date(evento.timestamp)
      const timeKey = fecha.toLocaleTimeString("es-ES", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })

      if (evento.tipo_movimiento === "ingreso") {
        datosIngresos.push({ time: timeKey, volumen: evento.volumen_ml })
        balanceAcumulado += evento.volumen_ml
        console.log("[v0] Ingreso:", evento.volumen_ml, "Balance acumulado:", balanceAcumulado)
      } else {
        datosEgresos.push({ time: timeKey, volumen: -evento.volumen_ml })
        balanceAcumulado -= evento.volumen_ml
        console.log("[v0] Egreso:", evento.volumen_ml, "Balance acumulado:", balanceAcumulado)
      }

      datosBalance.push({ time: timeKey, volumen: balanceAcumulado })
    })

    setChartDataIngresos(datosIngresos.slice(-5))
    setChartDataEgresos(datosEgresos.slice(-5))
    setChartDataBalance(datosBalance.slice(-20))
  }

  const sincronizarThingSpeak = async () => {
    try {
      const response = await fetch("/api/sync-thingspeak")

      if (!response.ok) {
        console.error("[v0] Error en sincronización ThingSpeak:", response.status)
        return
      }

      const contentType = response.headers.get("content-type")
      if (contentType && contentType.includes("application/json")) {
        const data = await response.json()
        console.log("[v0] Sincronización completada:", data)
      } else {
        console.error("[v0] Respuesta no-JSON recibida de la API")
      }
    } catch (error) {
      console.error("[v0] Error al sincronizar ThingSpeak:", error)
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
    if (
      !confirm(
        "¿Estás seguro de que quieres reiniciar el balance? Esto eliminará todos los eventos registrados para este paciente.",
      )
    ) {
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase.from("eventos_balance").delete().eq("paciente_id", patienteId)

      if (error) throw error

      await actualizarTodo()
      alert("Balance reiniciado correctamente")
    } catch (error) {
      console.error("Error al reiniciar balance:", error)
      alert("Error al reiniciar el balance")
    } finally {
      setLoading(false)
    }
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

  const balanceStatus = getBalanceStatus(balance24h.balance_ml)
  const BalanceIcon = balance24h.balance_ml > 500 ? TrendingUp : balance24h.balance_ml < -500 ? TrendingDown : Activity

  const pageBgColor = balanceStatus.color === "neutro" ? "bg-green-50/50" : "bg-red-50/50"

  // UI COMPLETA
  return (
    <div className={`min-h-screen bg-background p-4 md:p-8 ${pageBgColor}`}>
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-center justify-between">
          <Link href="/">
            <Button variant="outline" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver al Lobby
            </Button>
          </Link>
          {paciente && <EliminarPacienteDialog pacienteId={patienteId} nombrePaciente={paciente.nombre} />}
        </div>

        {paciente && (
          <Card className={`border-2 ${balanceStatus.cardBgColor}`}>
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
                  <p className="text-2xl font-bold">{paciente.imc.toFixed(2)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* TARJETAS DE RESUMEN */}
        <div className="space-y-2">
          <h2 className="text-2xl font-bold">Balance Hídrico Total Acumulado</h2>
          {lastUpdate && (
            <p className="text-sm text-muted-foreground">
              Última actualización: {lastUpdate.toLocaleTimeString("es-ES")}
            </p>
          )}
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {/* INGRESOS CON DESGLOSE */}
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
            <CardContent className="space-y-3">
              <div>
                <p className="text-4xl font-bold text-blue-600">{balance24h.total_ingresos_ml}</p>
                <p className="text-sm text-muted-foreground">mililitros (mL)</p>
              </div>
              <div className="space-y-1 border-t pt-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Del sensor API:</span>
                  <span className="font-semibold">{balance24h.ingresos_sensor} mL</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Cálculo manual:</span>
                  <span className="font-semibold">{balance24h.ingresos_manual} mL</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* EGRESOS CON DESGLOSE */}
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
            <CardContent className="space-y-3">
              <div>
                <p className="text-4xl font-bold text-orange-600">{balance24h.total_egresos_ml}</p>
                <p className="text-sm text-muted-foreground">mililitros (mL)</p>
              </div>
              <div className="space-y-1 border-t pt-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Del sensor API:</span>
                  <span className="font-semibold">{balance24h.egresos_sensor} mL</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Cálculo manual:</span>
                  <span className="font-semibold">{balance24h.egresos_manual} mL</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* BALANCE (SIN CAMBIOS) */}
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
            <CardContent>
              <p className={`text-4xl font-bold ${balanceStatus.textColor}`}>{balance24h.balance_ml}</p>
              <p className="text-sm text-muted-foreground">mililitros (mL)</p>
              <Badge className="mt-2" variant="secondary">
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

        {/* G1 INGRESOS */}
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

          {/* G2 EGRESOS */}
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

        {/* G3 BALANCE HIDRICO (ACUMULADO) */}
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
                  stroke="#22c55e" // ← ← ← COLOR ARREGLADO
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
