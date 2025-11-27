"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { User } from "lucide-react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { NuevoPacienteDialog } from "@/components/nuevo-paciente-dialog"
import type { Paciente, BalanceResumen } from "@/lib/types"
import { getBalanceStatus } from "@/lib/types"

interface PatientCardData extends Paciente {
  balance: BalanceResumen
  loading: boolean
}

export default function LobbyPage() {
  const [pacientes, setPacientes] = useState<PatientCardData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

  const calcularBalance = async (pacienteId: number): Promise<BalanceResumen> => {
    try {
      const { data, error } = await supabase
        .from("eventos_balance")
        .select("tipo_movimiento, volumen_ml")
        .eq("paciente_id", pacienteId)

      if (error) {
        console.error("[v0] Error al calcular balance:", error)
        return { total_ingresos_ml: 0, total_egresos_ml: 0, balance_ml: 0 }
      }

      if (!data) {
        return { total_ingresos_ml: 0, total_egresos_ml: 0, balance_ml: 0 }
      }

      const ingresos = data
        .filter((e) => e.tipo_movimiento === "ingreso")
        .reduce((sum, e) => sum + e.volumen_ml, 0)

      const egresos = data
        .filter((e) => e.tipo_movimiento === "egreso")
        .reduce((sum, e) => sum + e.volumen_ml, 0)

      return {
        total_ingresos_ml: ingresos,
        total_egresos_ml: egresos,
        balance_ml: ingresos - egresos,
      }
    } catch (error) {
      console.error("[v0] Error inesperado al calcular balance:", error)
      return { total_ingresos_ml: 0, total_egresos_ml: 0, balance_ml: 0 }
    }
  }

  const cargarPacientes = async () => {
    try {
      setError(null)
      console.log("[v0] Cargando pacientes...")

      const { data, error: queryError } = await supabase
        .from("pacientes")
        .select("*")
        .order("created_at", { ascending: false })

      if (queryError) {
        console.error("[v0] Error al cargar pacientes:", queryError)
        setError(`Error al cargar pacientes: ${queryError.message}`)
        setLoading(false)
        return
      }

      console.log("[v0] Pacientes obtenidos:", data?.length || 0)

      if (data && data.length > 0) {
        // Normalizar campos de la BD a la interfaz Paciente
        const pacientesNormalizados: Paciente[] = data.map((p: any) => {
          const peso = p.peso_kg ?? p.peso ?? 0
          const talla = p.talla_cm ?? p.talla ?? 0
          const imcCalculado =
            talla > 0 ? peso / Math.pow(talla / 100, 2) : 0

          return {
            id: p.id,
            nombre: p.nombre,
            edad_anios: p.edad_anios ?? p.edad ?? 0,
            peso_kg: peso,
            talla_cm: talla,
            imc: p.imc ?? imcCalculado,
            fecha_creacion: p.fecha_creacion ?? p.created_at ?? "",
            dispositivo_id: p.dispositivo_id ?? null,
            ultimo_timestamp_leido: p.ultimo_timestamp_leido ?? null,
            dispositivo: p.dispositivo ?? null,
          }
        })

        // Mostrar pacientes inmediatamente con balance en 0
        const pacientesIniciales: PatientCardData[] = pacientesNormalizados.map(
          (paciente) => ({
            ...paciente,
            balance: {
              total_ingresos_ml: 0,
              total_egresos_ml: 0,
              balance_ml: 0,
            },
            loading: true,
          }),
        )
        setPacientes(pacientesIniciales)
        setLoading(false)

        // Calcular balances en segundo plano
        const pacientesConBalance: PatientCardData[] = await Promise.all(
          pacientesNormalizados.map(async (paciente) => {
            const balance = await calcularBalance(paciente.id)
            return {
              ...paciente,
              balance,
              loading: false,
            }
          }),
        )
        setPacientes(pacientesConBalance)
      } else {
        setPacientes([])
        setLoading(false)
      }
    } catch (error) {
      console.error("[v0] Error inesperado al cargar pacientes:", error)
      setError(`Error inesperado: ${error}`)
      setLoading(false)
    }
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

        {error && (
          <Card className="border-destructive bg-destructive/10">
            <CardContent className="pt-6">
              <p className="text-sm text-destructive">{error}</p>
            </CardContent>
          </Card>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : pacientes.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <User className="mb-4 h-12 w-12 text-muted-foreground" />
              <h3 className="mb-2 text-lg font-semibold">
                No hay pacientes registrados
              </h3>
              <p className="mb-4 text-sm text-muted-foreground">
                Comienza registrando un nuevo paciente
              </p>
              <NuevoPacienteDialog onPacienteCreado={cargarPacientes} />
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {pacientes.map((paciente) => {
              const balanceStatus = getBalanceStatus(paciente.balance.balance_ml)
              return (
                <Link key={paciente.id} href={`/patient/${paciente.id}`}>
                  <Card
                    className={`border-2 transition-all duration-300 hover:shadow-lg ${balanceStatus.cardBgColor} ${balanceStatus.borderColor}`}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-xl font-semibold">
                          {paciente.nombre}
                        </CardTitle>
                        <div className="rounded-full bg-primary/10 p-2">
                          <User className="h-5 w-5 text-primary" />
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="space-y-1 text-sm text-muted-foreground">
                          <p>
                            Edad:{" "}
                            <span className="font-medium text-foreground">
                              {paciente.edad_anios} años
                            </span>{" "}
                            | Peso:{" "}
                            <span className="font-medium text-foreground">
                              {paciente.peso_kg} kg
                            </span>
                          </p>
                          <p>
                            Talla:{" "}
                            <span className="font-medium text-foreground">
                              {paciente.talla_cm} cm
                            </span>{" "}
                            | IMC:{" "}
                            <span className="font-medium text-foreground">
                              {paciente.imc?.toFixed(2) || "N/A"}
                            </span>
                          </p>
                        </div>

                        <div className="space-y-2 border-t pt-3">
                          <p className="text-sm font-medium text-muted-foreground">
                            Balance Hídrico Total Acumulado
                          </p>
                          <p
                            className={`text-4xl font-bold ${balanceStatus.textColor}`}
                          >
                            {paciente.balance?.balance_ml?.toFixed(0) || 0}
                          </p>
                          <div className="flex items-center justify-between">
                            <p className="text-sm text-muted-foreground">
                              mililitros (mL)
                            </p>
                            <Badge
                              variant={
                                balanceStatus.color === "desbalance"
                                  ? "destructive"
                                  : "secondary"
                              }
                            >
                              {balanceStatus.label}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>
        )}

        <Card className="bg-muted/30">
          <CardHeader>
            <CardTitle className="text-base">Información del Sistema</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <div className="flex items-center justify-between">
              <span>Frecuencia de actualización:</span>
              <span className="font-medium text-foreground">15 segundos</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Pacientes registrados:</span>
              <span className="font-medium text-foreground">
                {pacientes.length}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Período de balance mostrado:</span>
              <span className="font-medium text-foreground">
                Total acumulado
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
