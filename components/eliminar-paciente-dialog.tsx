"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Trash2 } from 'lucide-react'
import { createClient } from "@/lib/supabase/client"
import { useRouter } from 'next/navigation'
import { toast } from "@/hooks/use-toast"

interface EliminarPacienteDialogProps {
  pacienteId: number
  nombrePaciente: string
}

export function EliminarPacienteDialog({ pacienteId, nombrePaciente }: EliminarPacienteDialogProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleEliminar = async () => {
    setLoading(true)
    const supabase = createClient()

    try {
      await supabase.from("eventos_balance").delete().eq("paciente_id", pacienteId)

      await supabase.from("dispositivos").update({ paciente_id: null }).eq("paciente_id", pacienteId)

      const { error } = await supabase.from("pacientes").delete().eq("id", pacienteId)

      if (error) throw error

      toast({
        title: "Paciente eliminado",
        description: `${nombrePaciente} y todos sus registros han sido eliminados correctamente.`,
      })

      router.push("/")
    } catch (error) {
      console.error("Error al eliminar paciente:", error)
      toast({
        title: "Error",
        description: "No se pudo eliminar el paciente.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
      setOpen(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" size="sm">
          <Trash2 className="mr-2 h-4 w-4" />
          Eliminar Paciente
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div>
              <p className="text-muted-foreground text-sm">Esta acción no se puede deshacer. Se eliminarán permanentemente:</p>
              <ul className="mt-2 list-inside list-disc space-y-1 text-muted-foreground text-sm">
                <li>El paciente: <strong>{nombrePaciente}</strong></li>
                <li>Todos los registros de balance hídrico asociados</li>
                <li>Las asignaciones de dispositivos (los dispositivos no se eliminarán)</li>
              </ul>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={handleEliminar} disabled={loading} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            {loading ? "Eliminando..." : "Sí, eliminar paciente"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
