// components/ResumenFlujoCard.tsx

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import type { ResumenFlujo } from "@/types/balance" // o ajusta la ruta

interface ResumenFlujoCardProps {
  titulo: string;              // "Ingresos" o "Egresos"
  colorClase?: string;         // ej. "text-blue-600" para ingresos
  unidad?: string;             // "mL"
  resumen: ResumenFlujo;
}

const formatMl = (valor: number) => `${valor.toFixed(1)} mL`;

export function ResumenFlujoCard({
  titulo,
  colorClase = "text-blue-600",
  unidad = "mL",
  resumen,
}: ResumenFlujoCardProps) {
  const totalAcumulado =
    resumen.sensor.total +
    resumen.manual.total +
    resumen.despreciables.acumulado;

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{titulo}</span>
        </CardTitle>
        <CardDescription>Total acumulado</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Número grande de total */}
        <div className="text-4xl font-bold tracking-tight tabular-nums">
          <span className={colorClase}>{totalAcumulado.toFixed(1)}</span>
        </div>
        <p className="text-sm text-muted-foreground">
          {unidad === "mL" ? "mililitros (mL)" : unidad}
        </p>

        <div className="h-px w-full bg-border my-1" />

        {/* Información del sensor */}
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Información del sensor
          </p>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Último / Total</span>
            <span className="font-medium tabular-nums">
              {formatMl(resumen.sensor.ultimo)}{" "}
              <span className="mx-1">/</span>
              {formatMl(resumen.sensor.total)}
            </span>
          </div>
        </div>

        {/* Ingreso / egreso manual */}
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Ingreso manual
          </p>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Último / Acumulado</span>
            <span className="font-medium tabular-nums">
              {formatMl(resumen.manual.ultimo)}{" "}
              <span className="mx-1">/</span>
              {formatMl(resumen.manual.total)}
            </span>
          </div>
        </div>

        {/* Despreciables */}
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Cálculo de despreciables
          </p>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Por hora / Acumulado</span>
            <span className="font-medium tabular-nums">
              {formatMl(resumen.despreciables.porHora)}{" "}
              <span className="mx-1">/</span>
              {formatMl(resumen.despreciables.acumulado)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
