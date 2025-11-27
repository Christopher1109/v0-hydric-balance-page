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
  getBalanceStatus,
  calcularIngresosInsensibles,
  calcularEgresosInsensibles,
} from "@/lib/types"

interface PatientCardData extends Paciente {
  balance_total_real: number   // ESTE es el mismo "resultado neto acumulado"
  loading: boolean
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
      .select("tipo_movimiento, volumen_ml")
      .eq("paciente_id", paciente.id)

    if (error) {
      console.error("[Lobby] Error al calcular balance:", error)
      return 0
    }

    if (!data || data.length === 0) {
      return 0
    }

    const ingresosEventos = data
      .filter((e) => e.tipo_movimiento === "ingreso")
      .reduce((sum, e) => sum + e.volumen_ml, 0)

    const egresosEventos = data
      .filter((e) => e.tipo_movimiento === "egreso")
      .reduce((sum, e) => sum + e.volumen_ml, 0)

    const hayEventos = ingresosEventos !== 0 || egresosEventos !== 0
    const horas = hayEventos ? 1 : 0   // 🔁 mismo supuesto simple que en patient/[id]
    const peso = paciente.peso_kg || 0

    const ingresosIns = calcularIngresosInsensibles(peso, horas)
    const egresosIns = calcularEgresosInsensibles(peso, horas)

    const totalIngresosMostrado =
      ingresosEventos + ingresosIns.acumulado
    const totalEgresosMostrado =
      egresosEventos + egresosIns.acumulado

    const balanceMostrado = totalIngresosMostrado - totalEgresosMostrado

    // Para depurar si algo se ve raro
    console.log("[Lobby DEBUG BH]", {
      paciente: paciente.nombre,
      ingresosEventos,
      egresosEventos,
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
