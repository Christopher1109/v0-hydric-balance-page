"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { UserPlus } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import type { Dispositivo } from "@/lib/types"

interface NuevoPacienteDialogProps {
  onPacienteCreado: () => void
}

export function NuevoPacienteDialog({ onPacienteCreado }: NuevoPacienteDialogProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [dispositivos, setDispositivos] = useState<Dispositivo[]>([])
  const [formData, setFormData] = useState({
    nombre: "",
    edad: "",
    peso: "",
    talla: "",
    genero: "",
    dispositivo_id: "",
  })

  const supabase = createClient()

  useEffect(() => {
    if (open) {
      cargarDispositivos()
    }
  }, [open])

  const cargarDispositivos = async () => {
    console.log("[v0] Cargando dispositivos...")
    const { data, error } = await supabase.from("dispositivos").select("*").eq("activo", true).order("id")

    if (error) {
      console.error("[v0] Error al cargar dispositivos:", error)
      return
    }

    console.log("[v0] Dispositivos cargados:", data)
    setDispositivos(data || [])
  }

  const calcularIMC = (peso: number, talla: number) => {
    const tallaMetros = talla / 100
    return peso / (tallaMetros * tallaMetros)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const peso = Number.parseFloat(formData.peso)
      const talla = Number.parseFloat(formData.talla)

      console.log("[v0] Intentando crear paciente con dispositivo_id:", formData.dispositivo_id)

      const { data, error } = await supabase
        .from("pacientes")
        .insert({
          nombre: formData.nombre,
          edad: Number.parseInt(formData.edad),
          peso: peso,
          talla: talla,
          genero: formData.genero,
          dispositivo_id: Number.parseInt(formData.dispositivo_id),
        })
        .select()

      if (error) {
        console.error("[v0] Error al crear paciente:", error)
        throw error
      }

      console.log("[v0] Paciente creado exitosamente:", data)

      setFormData({ nombre: "", edad: "", peso: "", talla: "", genero: "", dispositivo_id: "" })
      setOpen(false)

      // Esperar un momento para que el diálogo se cierre visualmente antes de recargar
      setTimeout(() => {
        onPacienteCreado()
      }, 100)
    } catch (error) {
      console.error("[v0] Error en handleSubmit:", error)
      alert("Error al crear el paciente. Por favor intenta de nuevo.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg" className="gap-2">
          <UserPlus className="h-5 w-5" />
          Nuevo Paciente
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Registrar Nuevo Paciente</DialogTitle>
            <DialogDescription>Ingresa los datos del paciente para crear su registro de monitoreo.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="nombre">Nombre del paciente</Label>
              <Input
                id="nombre"
                value={formData.nombre}
                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                placeholder="Ej: Juan Pérez"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edad">Edad (años)</Label>
              <Input
                id="edad"
                type="number"
                value={formData.edad}
                onChange={(e) => setFormData({ ...formData, edad: e.target.value })}
                placeholder="Ej: 45"
                min="0"
                max="150"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="peso">Peso (kg)</Label>
                <Input
                  id="peso"
                  type="number"
                  step="0.1"
                  value={formData.peso}
                  onChange={(e) => setFormData({ ...formData, peso: e.target.value })}
                  placeholder="Ej: 70.5"
                  min="0"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="talla">Talla (cm)</Label>
                <Input
                  id="talla"
                  type="number"
                  step="0.1"
                  value={formData.talla}
                  onChange={(e) => setFormData({ ...formData, talla: e.target.value })}
                  placeholder="Ej: 170"
                  min="0"
                  required
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="genero">Sexo</Label>
              <Select
                value={formData.genero}
                onValueChange={(value) => setFormData({ ...formData, genero: value })}
                required
              >
                <SelectTrigger id="genero">
                  <SelectValue placeholder="Selecciona sexo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="M">Masculino</SelectItem>
                  <SelectItem value="F">Femenino</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="dispositivo">Dispositivo de Monitoreo</Label>
              <Select
                value={formData.dispositivo_id}
                onValueChange={(value) => setFormData({ ...formData, dispositivo_id: value })}
                required
              >
                <SelectTrigger id="dispositivo">
                  <SelectValue placeholder="Selecciona un dispositivo" />
                </SelectTrigger>
                <SelectContent>
                  {dispositivos.map((dispositivo) => (
                    <SelectItem key={dispositivo.id} value={dispositivo.id.toString()}>
                      {dispositivo.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {formData.peso && formData.talla && (
              <div className="rounded-lg bg-muted p-3">
                <p className="text-sm text-muted-foreground">
                  IMC calculado:{" "}
                  <span className="font-semibold text-foreground">
                    {calcularIMC(Number.parseFloat(formData.peso), Number.parseFloat(formData.talla)).toFixed(2)}
                  </span>
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Guardando..." : "Registrar Paciente"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
