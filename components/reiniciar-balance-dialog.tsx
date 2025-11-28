"use client"

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
import { Button } from "@/components/ui/button"
import { RefreshCw } from "lucide-react"

interface ReiniciarBalanceDialogProps {
  onConfirm: () => Promise<void> | void
  disabled?: boolean
}

export function ReiniciarBalanceDialog({
  onConfirm,
  disabled,
}: ReiniciarBalanceDialogProps) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" disabled={disabled}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Reiniciar Balance
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Reiniciar balance</AlertDialogTitle>
          <AlertDialogDescription>
            ¿Seguro que deseas reiniciar el balance de este paciente? Esta acción
            eliminará todos los eventos de ingresos y egresos registrados y no se
            puede deshacer.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              void onConfirm()
            }}
          >
            Sí, reiniciar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
