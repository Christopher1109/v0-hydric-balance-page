export interface Paciente {
  id: number
  nombre: string
  edad_anios: number
  peso_kg: number
  talla_cm: number
  imc: number
  fecha_creacion: string
  fecha_ultimo_reset?: string | null   // 👈 AGREGA ESTO
  dispositivo_id: number | null
  ultimo_timestamp_leido?: string | null
  dispositivo?: any | null
}


export type TipoMovimiento = "ingreso" | "egreso"

export type CategoriaIngreso =
  | "oral"
  | "iv"
  | "enteral"
  | "parenteral"
  | "sangre_hemoderivados"
  | "otros_ingresos"

export type CategoriaEgreso =
  | "orina"
  | "heces_liquidas"
  | "vomito"
  | "drenaje_quirurgico"
  | "aspirado_gastrico"
  | "sangrado"
  | "otros_egresos"

export type OrigenDato = "sensor" | "manual"

export interface EventoBalance {
  id: number
  paciente_id: number
  tipo_movimiento: TipoMovimiento
  categoria: CategoriaIngreso | CategoriaEgreso
  volumen_ml: number
  peso_g?: number
  origen_dato: OrigenDato
  notas?: string
  timestamp: string
}

export interface BalanceResumen {
  total_ingresos_ml: number
  total_egresos_ml: number
  balance_ml: number
}

export interface Dispositivo {
  id: number
  nombre: string
  channel_id: string
  api_key: string
  activo: boolean
  created_at: string
}

export type TipoDispositivo = "ingreso" | "egreso" | "mixto"

export function getBalanceStatus(balanceMl: number): {
  label: string
  color: string
  bgColor: string
  borderColor: string
  textColor: string
  cardBgColor: string
} {
  // Neutro: balance entre -500 y +500 (VERDE)
  if (balanceMl >= -500 && balanceMl <= 500) {
    return {
      label: "Neutro",
      color: "neutro",
      bgColor: "bg-green-500/10",
      borderColor: "border-green-500",
      textColor: "text-green-600 dark:text-green-400",
      cardBgColor: "bg-green-50/50 dark:bg-green-950/20",
    }
  }
  // Desbalance: cualquier valor fuera del rango (ROJO)
  return {
    label: balanceMl > 500 ? "Positivo" : "Negativo",
    color: "desbalance",
    bgColor: "bg-red-500/10",
    borderColor: "border-red-500",
    textColor: "text-red-600 dark:text-red-400",
    cardBgColor: "bg-red-50/50 dark:bg-red-950/20",
  }
}

// ---------------------------
// MODELOS NUEVOS DE FLUJO
// ---------------------------

export interface FuenteDato {
  ultimo: number; // último valor (mL)
  total: number;  // total acumulado (mL)
}

export interface DespreciablesInfo {
  porHora: number;   // mL que corresponden a esta hora
  acumulado: number; // mL acumulados hasta esta hora
}

export interface ResumenFlujo {
  sensor: FuenteDato;
  manual: FuenteDato;
  despreciables: DespreciablesInfo;
}


// ----------------------------------------------------
// NUEVA FUNCIÓN PARA INGRESOS INSENSIBLES (0.2 × kg)
// ----------------------------------------------------
export function calcularIngresosInsensibles(
  pesoKg: number,
  horasTranscurridas: number
): DespreciablesInfo {
  const porHora = 0.2 * pesoKg;
  const acumulado = porHora * horasTranscurridas;
  return { porHora, acumulado };
}

// ----------------------------------------------------
// NUEVA FUNCIÓN PARA EGRESOS INSENSIBLES (0.5 × kg)
// ----------------------------------------------------
export function calcularEgresosInsensibles(
  pesoKg: number,
  horasTranscurridas: number
): DespreciablesInfo {
  const porHora = 0.5 * pesoKg;
  const acumulado = porHora * horasTranscurridas;
  return { porHora, acumulado };
}


// ------------------------------------------------------------------
// TU FUNCIÓN ORIGINAL (NO SE TOCA → POR COMPATIBILIDAD)
// Actualmente esta representa ingresos insensibles. La dejo igual.
// ------------------------------------------------------------------
export function calcularDespreciables(
  pesoKg: number,
  horasTranscurridas: number
): DespreciablesInfo {
  const porHora = 0.2 * pesoKg;      // mL/h
  const acumulado = porHora * horasTranscurridas;
  return { porHora, acumulado };
}
