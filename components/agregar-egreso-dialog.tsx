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
import { TrendingDown } from 'lucide-react'
import { createClient } from "@/lib/supabase/client"
import type { CategoriaEgreso, OrigenDato } from "@/lib/types"

interface AgregarEgresoDialogProps {
  pacienteId: number
  onEventoAgregado: () => void
}

const CATEGORIAS_EGRESO: { value: CategoriaEgreso; label: string }[] = [
  { value: "orina", label: "Orina" },
  { value: "heces_liquidas", label: "Heces líquidas / diarrea" },
  { value: "vomito", label: "Vómito" },
  { value: "drenaje_quirurgico", label: "Drenaje quirúrgico" },
  { value: "aspirado_gastrico", label: "Aspirado gástrico / sonda nasogástrica" },
  { value: "sangrado", label: "Sangrado" },
  { value: "otros_egresos", label: "Otros egresos" },
]

export function AgregarEgresoDialog({ pacienteId, onEventoAgregado }: AgregarEgresoDialogProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    categoria: "" as CategoriaEgreso,
    volumen: "",
    peso: "",
    origen: "manual" as OrigenDato,
    notas: "",
  })

  const volumenCalculado = formData.peso ? parseFloat(formData.peso) : formData.volumen ? parseFloat(formData.volumen) : 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const supabase = createClient()
      const { error } = await supabase.from("eventos_balance").insert({
        paciente_id: pacienteId,
        tipo_movimiento: "egreso",
        categoria: formData.categoria,
        volumen_ml: volumenCalculado,
        peso_g: formData.peso ? parseFloat(formData.peso) : null,
        origen_dato: formData.origen,
        notas: formData.notas || null,
      })

      if (error) throw error

      setFormData({ categoria: "" as CategoriaEgreso, volumen: "", peso: "", origen: "manual", notas: "" })
      setOpen(false)
      onEventoAgregado()
    } catch (error) {
      console.error("Error al agregar egreso:", error)
      alert("Error al agregar el egreso. Por favor intenta de nuevo.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" className="gap-2">
          <TrendingDown className="h-4 w-4" />
          Agregar Egreso
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Registrar Egreso de Líquidos</DialogTitle>
            <DialogDescription>Registra la eliminación de líquidos del paciente.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="categoria-egreso">Tipo de egreso</Label>
              <Select
                value={formData.categoria}
                onValueChange={(value) => setFormData({ ...formData, categoria: value as CategoriaEgreso })}
                required
              >
                <SelectTrigger id="categoria-egreso">
                  <SelectValue placeholder="Selecciona el tipo de egreso" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIAS_EGRESO.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="volumen-egreso">Volumen medido (mL)</Label>
                <Input
                  id="volumen-egreso"
                  type="number"
                  step="0.1"
                  value={formData.volumen}
                  onChange={(e) => setFormData({ ...formData, volumen: e.target.value, peso: "" })}
                  placeholder="Ej: 250"
                  min="0"
                  disabled={!!formData.peso}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="peso-egreso">Peso medido (g)</Label>
                <Input
                  id="peso-egreso"
                  type="number"
                  step="0.1"
                  value={formData.peso}
                  onChange={(e) => setFormData({ ...formData, peso: e.target.value, volumen: "" })}
                  placeholder="Ej: 250"
                  min="0"
                  disabled={!!formData.volumen}
                />
              </div>
            </div>
            {formData.peso && (
              <div className="rounded-lg bg-muted p-3">
                <p className="text-sm text-muted-foreground">
                  Volumen calculado (1g ≈ 1mL):{" "}
                  <span className="font-semibold text-foreground">{volumenCalculado.toFixed(1)} mL</span>
                </p>
              </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor="origen-egreso">Origen del dato</Label>
              <Select
                value={formData.origen}
                onValueChange={(value) => setFormData({ ...formData, origen: value as OrigenDato })}
              >
                <SelectTrigger id="origen-egreso">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Registrado manualmente</SelectItem>
                  <SelectItem value="sensor">Provenir de sensor de egreso (orina)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="notas-egreso">Notas (opcional)</Label>
              <Textarea
                id="notas-egreso"
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
            <Button type="submit" disabled={loading || (!formData.volumen && !formData.peso)}>
              {loading ? "Guardando..." : "Registrar Egreso"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
