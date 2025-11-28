import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import LobbyPage from "@/components/lobby-page"

export default async function Page() {
  const supabase = await createClient()

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  // Si NO hay usuario autenticado, mandamos a la pantalla de login
  if (error || !user) {
    redirect("/auth/login")
  }

  // Si SÍ hay usuario, mostramos el Lobby normalmente
  return <LobbyPage />
}
