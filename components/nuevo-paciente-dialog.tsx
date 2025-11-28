"use client"

import { useEffect, useState, type FormEvent } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { createClient } from "@/lib/supabase/client"

interface NuevoPacienteDialogProps {
  onPacienteCreado?: () => void | Promise<void>
}

interface DispositivoOption {
  id: number
  nombre: string
}

export function NuevoPacienteDialog({ onPacienteCreado }: NuevoPacienteDialogProps) {
  const supabase = createClient()

  const [open, setOpen] = useState(false)
  const [nombre, setNombre] = useState("")
  const [edad, setEdad] = useState("")
  const [peso, setPeso] = useState("")
  const [talla, setTalla] = useState("")
  const [sexo, setSexo] = useState<"M" | "F" | "">("")
  const [dispositivoId, setDispositivoId] = useState<string>("")
  const [dispositivos, setDispositivos] = useState<DispositivoOption[]>([])
  const [guardando, setGuardando] = useState(false)

  // IMC calculado en vivo
  const pesoNum = Number(peso) || 0
  const tallaNum = Number(talla) || 0
  const imc = pesoNum > 0 && tallaNum > 0 ? Number((pesoNum / Math.pow(tallaNum / 100, 2)).toFixed(2)) : 0

  // Cargar dispositivos activos para el select
  useEffect(() => {
    const cargarDispositivos = async () => {
      const { data, error } = await supabase
        .from("dispositivos")
        .select("id, nombre")
        .eq("activo", true)
        .order("id", { ascending: true })

      if (error) {
        console.error("[v0] Error al cargar dispositivos:", error)
        return
      }

      setDispositivos(data ?? [])
    }

    cargarDispositivos()
  }, [supabase])

  const resetForm = () => {
    setNombre("")
    setEdad("")
    setPeso("")
    setTalla("")
    setSexo("")
    setDispositivoId("")
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!nombre || !edad || !peso || !talla) {
      alert("Por favor completa nombre, edad, peso y talla.")
      return
    }

    try {
      setGuardando(true)

      const edadNum = Number(edad) || 0

      const { error } = await supabase.from("pacientes").insert({
        nombre,
        edad_anios: edadNum,
        peso_kg: pesoNum,
        talla_cm: tallaNum,
        imc,
        sexo,
        genero: sexo, // También agregar genero para compatibilidad
        dispositivo_id: dispositivoId ? Number(dispositivoId) : null,
        activo: true, // ⚡ IMPORTANTE: Marcar como activo para sincronización automática
      })

      if (error) {
        console.error("[v0] Error al crear paciente:", error)
        alert("Error al crear el paciente. Por favor intenta de nuevo.")
        return
      }

      if (onPacienteCreado) {
        await onPacienteCreado()
      }

      resetForm()
      setOpen(false)
    } catch (err) {
      console.error("[v0] Error en handleSubmit:", err)
      alert("Error al crear el paciente. Por favor intenta de nuevo.")
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">Nuevo Paciente</Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Registrar Nuevo Paciente</DialogTitle>
            <DialogDescription>Ingresa los datos del paciente para crear su registro de monitoreo.</DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label>Nombre del paciente</Label>
              <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre completo" />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Edad (años)</Label>
                <Input
                  type="number"
                  min={0}
                  value={edad}
                  onChange={(e) => setEdad(e.target.value)}
                  placeholder="Ej. 45"
                />
              </div>
              <div className="space-y-2">
                <Label>Sexo</Label>
                <Select value={sexo} onValueChange={(v: "M" | "F") => setSexo(v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona sexo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="M">Masculino</SelectItem>
                    <SelectItem value="F">Femenino</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Peso (kg)</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.1"
                  value={peso}
                  onChange={(e) => setPeso(e.target.value)}
                  placeholder="Ej. 70"
                />
              </div>
              <div className="space-y-2">
                <Label>Talla (cm)</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.1"
                  value={talla}
                  onChange={(e) => setTalla(e.target.value)}
                  placeholder="Ej. 170"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Dispositivo de Monitoreo</Label>
              <Select value={dispositivoId} onValueChange={(v) => setDispositivoId(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un dispositivo (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  {dispositivos.map((d) => (
                    <SelectItem key={d.id} value={String(d.id)}>
                      {d.nombre || `Dispositivo ${d.id}`}
                    </SelectItem>
                  ))}
                  {dispositivos.length === 0 && (
                    <SelectItem value="none" disabled>
                      No hay dispositivos configurados
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-md bg-muted px-3 py-2 text-sm">
              IMC calculado: <span className="font-semibold">{imc > 0 ? imc.toFixed(2) : "—"}</span>
            </div>
          </div>

          <DialogFooter className="mt-4">
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={guardando}>
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" disabled={guardando}>
              {guardando ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
