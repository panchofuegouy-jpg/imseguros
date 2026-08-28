import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth-server"

/**
 * Equivalente single-tenant de `requireBrokerMember` en segu. Acá no hay tenant
 * que resolver: o el usuario es el admin del corredor, o no entra.
 */
export type AdminSession = {
  userId: string
  email: string | undefined
  profile: any
}

export function isNextResponse(value: unknown): value is NextResponse {
  return value instanceof NextResponse
}

export async function requireAdmin(): Promise<AdminSession | NextResponse> {
  const current = await getCurrentUser()
  if (!current) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  if (current.profile?.role !== "admin") return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  return { userId: current.user.id, email: current.user.email, profile: current.profile }
}
