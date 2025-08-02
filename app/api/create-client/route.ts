import { NextRequest, NextResponse } from "next/server"
import { createClientUser, getCurrentUser } from "@/lib/auth-server"

export async function POST(request: NextRequest) {
  try {
    // Verificar que el usuario esté autenticado y tenga rol de admin
    const currentUser = await getCurrentUser()
    
    if (!currentUser || !currentUser.profile) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      )
    }

    if (currentUser.profile.role !== "admin") {
      return NextResponse.json(
        { error: "Solo los administradores pueden crear clientes" },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { nombre, email, telefono, documento, direccion } = body

    if (!nombre || !email || !documento) {
      return NextResponse.json(
        { error: "Nombre, email y documento son requeridos" },
        { status: 400 }
      )
    }

    const result = await createClientUser({
      nombre,
      email,
      telefono,
      documento,
      direccion,
    })

    return NextResponse.json({
      client: result.client,
      tempPassword: result.tempPassword,
      emailSent: result.emailSent
    })
  } catch (error: any) {
    console.error("Error creating client:", error)
    return NextResponse.json(
      { error: error.message || "Error interno del servidor" },
      { status: 500 }
    )
  }
}
