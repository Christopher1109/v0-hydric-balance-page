"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { User, Settings } from "lucide-react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { NuevoPacienteDialog } from "@/components/nuevo-paciente-dialog"
import { LogoutButton } from "@/components/logout-button"
import { Button } from "@/components/ui/button"
import type { Paciente } from "@/lib/types"
import { getBalanceStatus, calcularIngresosInsensibles, calcularEgresosInsensibles } from "@/lib/types"

interface PatientCardData extends Paciente {
  balance_total_real: number // ESTE es el mismo "resultado neto acumulado"
  loading: boolean
}

export default function LobbyPage() {
  const [pacientes, setPacientes] = useState<PatientCardData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [userEmail, setUserEmail] = useState<string>("")

  const supabase = createClient()

  const normalizarPaciente = (p: any): Paciente => {
    const peso = p.peso_kg ?? p.peso ?? 0
    const talla = p.talla_cm ?? p.talla ?? 0
    const edad = p.edad_anios ?? p.edad ?? 0

    const imcCalculado = peso > 0 && talla > 0 ? peso / Math.pow(talla / 100, 2) : 0

    return {
      id: p.id,
      nombre: p.nombre,
      edad_anios: edad,
      peso_kg: peso,
      talla_cm: talla,
      imc: Number(imcCalculado.toFixed(2)),
      fecha_creacion: p.created_at ?? "",
      dispositivo_id: p.dispositivo_id ?? null,
      ultimo_timestamp_leido: p.ultimo_timestamp_leido ?? null,
      dispositivo: p.dispositivo ?? null,
    }
  }

  const calcularBalanceTotalReal = async (paciente: Paciente): Promise<number> => {
    const { data, error } = await supabase
      .from("eventos_balance")
      .select("tipo_movimiento, volumen_ml, origen_dato, timestamp")
      .eq("paciente_id", paciente.id)
      .order("timestamp", { ascending: false })

    if (error) {
      console.error("[Lobby] Error al calcular balance:", error)
      return 0
    }

    if (!data || data.length === 0) {
      return 0
    }

    const ingresosSensorEventos = data.filter((e) => e.tipo_movimiento === "ingreso" && e.origen_dato === "sensor")
    const ingresosManualEventos = data.filter((e) => e.tipo_movimiento === "ingreso" && e.origen_dato === "manual")
    const egresosSensorEventos = data.filter((e) => e.tipo_movimiento === "egreso" && e.origen_dato === "sensor")
    const egresosManualEventos = data.filter((e) => e.tipo_movimiento === "egreso" && e.origen_dato === "manual")

    const ingresos_sensor_total = ingresosSensorEventos.reduce((s, e) => s + e.volumen_ml, 0)
    const ingresos_manual_total = ingresosManualEventos.reduce((s, e) => s + e.volumen_ml, 0)

    const ultimoEgresoSensor = egresosSensorEventos[0]
    const egresos_sensor_total = ultimoEgresoSensor ? ultimoEgresoSensor.volumen_ml : 0

    const egresos_manual_total = egresosManualEventos.reduce((s, e) => s + e.volumen_ml, 0)

    const total_ingresos_ml = ingresos_sensor_total + ingresos_manual_total
    const total_egresos_ml = egresos_sensor_total + egresos_manual_total

    const hayEventos = total_ingresos_ml !== 0 || total_egresos_ml !== 0
    const horas = hayEventos ? 1 : 0
    const peso = paciente.peso_kg || 0

    const ingresosIns = calcularIngresosInsensibles(peso, horas)
    const egresosIns = calcularEgresosInsensibles(peso, horas)

    const totalIngresosMostrado = total_ingresos_ml + ingresosIns.acumulado
    const totalEgresosMostrado = total_egresos_ml + egresosIns.acumulado

    const balanceMostrado = totalIngresosMostrado - totalEgresosMostrado

    console.log("[Lobby DEBUG BH]", {
      paciente: paciente.nombre,
      ingresos_sensor_total,
      ingresos_manual_total,
      egresos_sensor_total,
      egresos_manual_total,
      horas,
      ingresosIns: ingresosIns.acumulado,
      egresosIns: egresosIns.acumulado,
      totalIngresosMostrado,
      totalEgresosMostrado,
      balanceMostrado,
    })

    return balanceMostrado
  }

  const cargarPacientes = async () => {
    setError(null)
    setLoading(true)

    const { data, error: queryError } = await supabase
      .from("pacientes")
      .select("*")
      .order("created_at", { ascending: false })

    if (queryError) {
      console.error("[Lobby] Error al cargar pacientes:", queryError)
      setError(queryError.message)
      setLoading(false)
      return
    }

    if (!data || data.length === 0) {
      setPacientes([])
      setLoading(false)
      return
    }

    const normalizados: Paciente[] = data.map(normalizarPaciente)

    const inicial: PatientCardData[] = normalizados.map((p) => ({
      ...p,
      balance_total_real: 0,
      loading: true,
    }))
    setPacientes(inicial)
    setLoading(false)

    const conBalance: PatientCardData[] = await Promise.all(
      normalizados.map(async (p) => {
        const balanceReal = await calcularBalanceTotalReal(p)
        return {
          ...p,
          balance_total_real: balanceReal,
          loading: false,
        }
      }),
    )

    setPacientes(conBalance)
  }

  useEffect(() => {
    cargarPacientes()
    const interval = setInterval(cargarPacientes, 15000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const checkUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) {
        setUserEmail(user.email || "")
        setIsAdmin(user.email?.includes("admin") || user.user_metadata?.role === "admin")
      }
    }
    checkUser()
  }, [])

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Lobby de Pacientes</h1>
            <p className="text-muted-foreground">Monitoreo de balance hídrico de múltiples pacientes</p>
            {userEmail && (
              <p className="text-sm text-muted-foreground">
                Usuario: <span className="font-medium">{userEmail}</span>
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <Link href="/admin/users">
                <Button variant="outline" size="sm">
                  <Settings className="mr-2 h-4 w-4" />
                  Gestionar Usuarios
                </Button>
              </Link>
            )}
            <NuevoPacienteDialog onPacienteCreado={cargarPacientes} />
            <LogoutButton />
          </div>
        </div>

        {error && (
          <Card className="border-destructive bg-destructive/10">
            <CardContent className="pt-6 text-destructive">{error}</CardContent>
          </Card>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : pacientes.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <User className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
              <p className="mb-4 text-sm text-muted-foreground">No hay pacientes registrados.</p>
              <NuevoPacienteDialog onPacienteCreado={cargarPacientes} />
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {pacientes.map((paciente) => {
              const balanceStatus = getBalanceStatus(paciente.balance_total_real)

              return (
                <Link key={paciente.id} href={`/patient/${paciente.id}`}>
                  <Card
                    className={`border-2 transition-all duration-300 hover:shadow-lg ${balanceStatus.cardBgColor} ${balanceStatus.borderColor}`}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle>{paciente.nombre}</CardTitle>
                        <div className="rounded-full bg-primary/10 p-2">
                          <User className="h-5 w-5 text-primary" />
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent>
                      <div className="text-sm text-muted-foreground">
                        <p>
                          Edad: <span className="font-medium text-foreground">{paciente.edad_anios}</span> años
                        </p>

                        <p>
                          Peso: <span className="font-medium text-foreground">{paciente.peso_kg}</span> kg
                        </p>

                        <p>
                          Talla: <span className="font-medium text-foreground">{paciente.talla_cm}</span> cm
                        </p>

                        <p>
                          IMC: <span className="font-medium text-foreground">{paciente.imc}</span>
                        </p>
                      </div>

                      <div className="mt-4 border-t pt-2">
                        <p className="text-sm text-muted-foreground">
                          Balance total acumulado (mismo de la tarjeta del paciente)
                        </p>

                        <p className={`text-4xl font-bold ${balanceStatus.textColor}`}>
                          {paciente.balance_total_real.toFixed(1)}
                        </p>

                        <Badge className="mt-1" variant="secondary">
                          {balanceStatus.label}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
