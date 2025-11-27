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

interface AgregarEgresoDialogProps {
  pacienteId: number
  onEventoAgregado: () => void | Promise<void>
}

export function AgregarEgresoDialog({ pacienteId, onEventoAgregado }: AgregarEgresoDialogProps) {
  const supabase = createClient()

  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const [tipoEgreso, setTipoEgreso] = useState<string>("Diuresis (orina)")
  const [volumen, setVolumen] = useState<string>("")
  const [origenDato, setOrigenDato] = useState<string>("manual")
  const [notas, setNotas] = useState<string>("")

  const resetForm = () => {
    setTipoEgreso("Diuresis (orina)")
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
        tipo_movimiento: "egreso",
        volumen_ml: volumenNumber,
        origen_dato: origenDato,
        descripcion: `${tipoEgreso} - ${notas}`.trim(),
      })

      if (error) {
        console.error("[AgregarEgresoDialog] Error al insertar:", error)
        alert("Error al agregar el egreso. Por favor intenta de nuevo.")
        return
      }

      await onEventoAgregado()
      resetForm()
      setOpen(false)
    } catch (e) {
      console.error("[AgregarEgresoDialog] Error inesperado:", e)
      alert("Error inesperado al agregar el egreso.")
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
        <Button variant="success" className="bg-green-600 hover:bg-green-700 text-white">
          Agregar Egreso
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar Egreso de Líquidos</DialogTitle>
          <DialogDescription>Registra la eliminación de líquidos del paciente.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label>Tipo de egreso</Label>
            <Select value={tipoEgreso} onValueChange={setTipoEgreso}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona el tipo de egreso" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Diuresis (orina)">Diuresis (orina)</SelectItem>
                <SelectItem value="Drenaje">Drenaje</SelectItem>
                <SelectItem value="Sangrado">Sangrado</SelectItem>
                <SelectItem value="Vómito">Vómito</SelectItem>
                <SelectItem value="Deposiciones líquidas">Deposiciones líquidas</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label>Volumen registrado (mL)</Label>
            <Input
              type="number"
              min={0}
              step="0.1"
              value={volumen}
              onChange={(e) => setVolumen(e.target.value)}
              placeholder="Ej. 80"
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
