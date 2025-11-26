"use client"

import { useState } from "react"
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
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { TrendingUp } from 'lucide-react'
import { createClient } from "@/lib/supabase/client"
import type { CategoriaIngreso, OrigenDato } from "@/lib/types"

interface AgregarIngresoDialogProps {
  pacienteId: number
  onEventoAgregado: () => void
}

const CATEGORIAS_INGRESO: { value: CategoriaIngreso; label: string }[] = [
  { value: "oral", label: "Líquido oral (agua, jugos, sopas)" },
  { value: "iv", label: "Intravenoso (IV)" },
  { value: "enteral", label: "Nutrición enteral (sonda)" },
  { value: "parenteral", label: "Nutrición parenteral" },
  { value: "sangre_hemoderivados", label: "Sangre / hemoderivados" },
  { value: "otros_ingresos", label: "Otros ingresos" },
]

export function AgregarIngresoDialog({ pacienteId, onEventoAgregado }: AgregarIngresoDialogProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    categoria: "" as CategoriaIngreso,
    volumen: "",
    origen: "manual" as OrigenDato,
    notas: "",
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const supabase = createClient()
      const { error } = await supabase.from("eventos_balance").insert({
        paciente_id: pacienteId,
        tipo_movimiento: "ingreso",
        categoria: formData.categoria,
        volumen_ml: parseFloat(formData.volumen),
        origen_dato: formData.origen,
        notas: formData.notas || null,
      })

      if (error) throw error

      setFormData({ categoria: "" as CategoriaIngreso, volumen: "", origen: "manual", notas: "" })
      setOpen(false)
      onEventoAgregado()
    } catch (error) {
      console.error("Error al agregar ingreso:", error)
      alert("Error al agregar el ingreso. Por favor intenta de nuevo.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <TrendingUp className="h-4 w-4" />
          Agregar Ingreso
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Registrar Ingreso de Líquidos</DialogTitle>
            <DialogDescription>Registra la administración de líquidos al paciente.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="categoria">Tipo de ingreso</Label>
              <Select
                value={formData.categoria}
                onValueChange={(value) => setFormData({ ...formData, categoria: value as CategoriaIngreso })}
                required
              >
                <SelectTrigger id="categoria">
                  <SelectValue placeholder="Selecciona el tipo de ingreso" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIAS_INGRESO.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="volumen">Volumen administrado (mL)</Label>
              <Input
                id="volumen"
                type="number"
                step="0.1"
                value={formData.volumen}
                onChange={(e) => setFormData({ ...formData, volumen: e.target.value })}
                placeholder="Ej: 500"
                min="0"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="origen">Origen del dato</Label>
              <Select
                value={formData.origen}
                onValueChange={(value) => setFormData({ ...formData, origen: value as OrigenDato })}
              >
                <SelectTrigger id="origen">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Registrado manualmente</SelectItem>
                  <SelectItem value="sensor">Provenir de sensor de ingreso</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="notas">Notas (opcional)</Label>
              <Textarea
                id="notas"
                value={formData.notas}
                onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
                placeholder="Observaciones adicionales..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Guardando..." : "Registrar Ingreso"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
