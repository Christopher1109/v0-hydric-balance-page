"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { User } from "lucide-react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { NuevoPacienteDialog } from "@/components/nuevo-paciente-dialog"
import type { Paciente } from "@/lib/types"
import {
  calcularIngresosInsensibles,
  calcularEgresosInsensibles,
} from "@/lib/types"

interface PatientCardData extends Paciente {
  balance_total_real: number // Resultado neto acumulado (mismo que en patient/[id])
  loading: boolean
}

// Estado visual para el Lobby (neutro, medio, alto) basado en mL/kg
interface BalanceAlertStatusLobby {
  label: string
  textColor: string
  cardBgColor: string
  borderColor: string
}

// MISMOS RANGOS QUE EN EL EXPEDIENTE (mL/kg):
// - Neutro: |balance| ≤ 10 mL/kg
// - Medio: 10 < |balance| < 40 mL/kg
// - Alto: ≥ 40 mL/kg
function getBalanceAlertStatusLobby(
  balanceMlKg: number,
  hasPeso: boolean,
): BalanceAlertStatusLobby {
  if (!hasPeso) {
    return {
      label: "No evaluable (sin peso)",
      textColor: "text-muted-foreground",
      cardBgColor: "bg-muted",
      borderColor: "border-muted",
    }
  }

  const absVal = Math.abs(balanceMlKg)

  if (absVal <= 10) {
    // NEUTRO → VERDE
    return {
      label: "Balance neutro",
      textColor: "text-emerald-600",
      cardBgColor: "bg-emerald-50",
      borderColor: "border-emerald-300",
    }
  }

  if (absVal < 40) {
    // RIESGO MEDIO → AMARILLO
    return {
      label: "Riesgo medio",
      textColor: "text-amber-600",
      cardBgColor: "bg-amber-50",
      borderColor: "border-amber-300",
    }
  }

  // RIESGO ALTO → ROJO
  return {
    label: "Riesgo alto",
    textColor: "text-red-600",
    cardBgColor: "bg-red-50",
    borderColor: "border-red-300",
  }
}

export default function LobbyPage() {
  const [pacientes, setPacientes] = useState<PatientCardData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

  // ------------------------------------------
  // 1. NORMALIZAR PACIENTES DESDE SUPABASE
  // ------------------------------------------
  const normalizarPaciente = (p: any): Paciente => {
    const peso = p.peso_kg ?? p.peso ?? 0
    const talla = p.talla_cm ?? p.talla ?? 0
    const edad = p.edad_anios ?? p.edad ?? 0

    const imcCalculado =
      peso > 0 && talla > 0 ? peso / Math.pow(talla / 100, 2) : 0

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

  // ------------------------------------------
  // 2. CALCULAR EL MISMO BALANCE QUE EN patient/[id]
  //    (resultado neto acumulado)
  // ------------------------------------------
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

    // Misma lógica que en PatientDetailPage:
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

    // Ingresos: sumamos todo (sensor + manual)
    const ingresos_sensor_total = ingresosSensorEventos.reduce(
      (s, e) => s + e.volumen_ml,
      0,
    )
    const ingresos_manual_total = ingresosManualEventos.reduce(
      (s, e) => s + e.volumen_ml,
      0,
    )

    // EGRESOS SENSOR: solo el ÚLTIMO valor (no suma de todos)
    const ultimoEgresoSensor = egresosSensorEventos[0]
    const egresos_sensor_total = ultimoEgresoSensor ? ultimoEgresoSensor.volumen_ml : 0

    // EGRESOS MANUAL: estos sí se acumulan
    const egresos_manual_total = egresosManualEventos.reduce(
      (s, e) => s + e.volumen_ml,
      0,
    )

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

    // Para depurar si algo se ve raro
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

  // ------------------------------------------
  // 3. CARGAR LISTA DE PACIENTES
  // ------------------------------------------
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

    // Normalizar pacientes
    const normalizados: Paciente[] = data.map(normalizarPaciente)

    // Mostrar de inmediato con balance = 0 mientras calculamos
    const inicial: PatientCardData[] = normalizados.map((p) => ({
      ...p,
      balance_total_real: 0,
      loading: true,
    }))
    setPacientes(inicial)
    setLoading(false)

    // Calcular balances reales (mismo neto acumulado que en patient/[id])
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

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Lobby de Pacientes
            </h1>
            <p className="text-muted-foreground">
              Monitoreo de balance hídrico de múltiples pacientes
            </p>
          </div>
          <NuevoPacienteDialog onPacienteCreado={cargarPacientes} />
        </div>

        {/* Errores */}
        {error && (
          <Card className="border-destructive bg-destructive/10">
            <CardContent className="pt-6 text-destructive">
              {error}
            </CardContent>
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
              <p className="mb-4 text-sm text-muted-foreground">
                No hay pacientes registrados.
              </p>
              <NuevoPacienteDialog onPacienteCreado={cargarPacientes} />
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {pacientes.map((paciente) => {
              const peso = paciente.peso_kg || 0
              const balanceMlKg =
                peso > 0 ? paciente.balance_total_real / peso : 0

              const balanceStatus = getBalanceAlertStatusLobby(
                balanceMlKg,
                peso > 0,
              )

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
                          Edad:{" "}
                          <span className="font-medium text-foreground">
                            {paciente.edad_anios}
                          </span>{" "}
                          años
                        </p>

                        <p>
                          Peso:{" "}
                          <span className="font-medium text-foreground">
                            {paciente.peso_kg}
                          </span>{" "}
                          kg
                        </p>

                        <p>
                          Talla:{" "}
                          <span className="font-medium text-foreground">
                            {paciente.talla_cm}
                          </span>{" "}
                          cm
                        </p>

                        <p>
                          IMC:{" "}
                          <span className="font-medium text-foreground">
                            {paciente.imc}
                          </span>
                        </p>
                      </div>

                      <div className="mt-4 border-t pt-2">
                        <p className="text-sm text-muted-foreground">
                          Balance total acumulado (mismo de la tarjeta del paciente)
                        </p>

                        <p
                          className={`text-4xl font-bold ${balanceStatus.textColor}`}
                        >
                          {paciente.balance_total_real.toFixed(1)}
                        </p>

                        <p className="text-xs text-muted-foreground">
                          {peso > 0
                            ? `Balance ajustado: ${balanceMlKg.toFixed(1)} mL/kg`
                            : "Balance ajustado no disponible (sin peso registrado)"}
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
