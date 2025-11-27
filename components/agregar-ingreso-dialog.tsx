"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface AgregarIngresoDialogProps {
  pacienteId: number
  onEventoAgregado: () => void | Promise<void>
}

export function AgregarIngresoDialog({ pacienteId, onEventoAgregado }: AgregarIngresoDialogProps) {
  const supabase = createClient()

  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const [tipoIngreso, setTipoIngreso] = useState<string>("Vía oral")
  const [volumen, setVolumen] = useState<string>("")
  const [origenDato, setOrigenDato] = useState<string>("manual")
  const [notas, setNotas] = useState<string>("")

  const resetForm = () => {
    setTipoIngreso("Vía oral")
    setVolumen("")
    setOrigenDato("manual")
    setNotas("")
  }

  const handleSubmit = async () => {
    const volumenNumber = Number.parseFloat(volumen)

    if (!volumen || Number.isNaN(volumenNumber) || volumenNumber <= 0) {
      alert("Por favor ingresa un volumen válido mayor a 0.")
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase.from("eventos_balance").insert({
        paciente_id: pacienteId,
        tipo_movimiento: "ingreso",
        volumen_ml: volumenNumber,
        origen_dato: origenDato,
        descripcion: `${tipoIngreso} - ${notas}`.trim(),
      })

      if (error) {
        console.error("[AgregarIngresoDialog] Error al insertar:", error)
        alert("Error al agregar el ingreso. Por favor intenta de nuevo.")
        return
      }

      await onEventoAgregado()
      resetForm()
      setOpen(false)
    } catch (e) {
      console.error("[AgregarIngresoDialog] Error inesperado:", e)
      alert("Error inesperado al agregar el ingreso.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!loading) setOpen(o)
      }}
    >
      <DialogTrigger asChild>
        <Button variant="default" className="bg-blue-600 hover:bg-blue-700 text-white">
          Agregar Ingreso
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar Ingreso de Líquidos</DialogTitle>
          <DialogDescription>Registra la administración de líquidos al paciente.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label>Tipo de ingreso</Label>
            <Select value={tipoIngreso} onValueChange={setTipoIngreso}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona el tipo de ingreso" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Vía oral">Vía oral</SelectItem>
                <SelectItem value="Soluciones Intravenosas (IV)">Soluciones Intravenosas (IV)</SelectItem>
                <SelectItem value="Sonda Nasogástrica">Sonda Nasogástrica</SelectItem>
                <SelectItem value="Nutrición Enteral (NG)">Nutrición Enteral (NG)</SelectItem>
                <SelectItem value="Nutrición parenteral total (TPN)">Nutrición parenteral total (TPN)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label>Volumen administrado (mL)</Label>
            <Input
              type="number"
              min={0}
              step="0.1"
              value={volumen}
              onChange={(e) => setVolumen(e.target.value)}
              placeholder="Ej. 120"
            />
          </div>

          <div className="space-y-1">
            <Label>Origen del dato</Label>
            <Select value={origenDato} onValueChange={setOrigenDato}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Registrado manualmente</SelectItem>
                <SelectItem value="sensor">Desde sensor / API</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label>Notas (opcional)</Label>
            <Textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Observaciones adicionales..."
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (!loading) {
                  resetForm()
                  setOpen(false)
                }
              }}
            >
              Cancelar
            </Button>
            <Button type="button" onClick={handleSubmit} disabled={loading}>
              {loading ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
