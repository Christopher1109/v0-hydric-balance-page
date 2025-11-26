import { NextResponse } from "next/server"

export async function GET() {
  console.log("[v0] API sync-thingspeak llamada (deshabilitada temporalmente)")
  return NextResponse.json({
    message: "Sincronización ThingSpeak deshabilitada temporalmente",
    procesados: 0,
  })
}
