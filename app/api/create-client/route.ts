import { NextRequest, NextResponse } from "next/server"
import { createClientUser, getCurrentUser } from "@/lib/auth-server"
import { createClient } from "@supabase/supabase-js"

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
    const { nombre, email, telefono, documento, direccion, numero_cliente, departamento } = body

    if (!nombre || !email || !documento) {
      return NextResponse.json(
        { error: "Nombre, email y documento son requeridos" },
        { status: 400 }
      )
    }

    const { client, tempPassword, emailSent } = await createClientUser({
      nombre,
      email,
      telefono,
      documento,
      direccion,
      numero_cliente,
      departamento,
    })

    if (!client || !tempPassword) {
      return NextResponse.json(
        { error: "Error al crear el cliente o la contraseña temporal" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      client,
      tempPassword,
      emailSent, // Estado real del envío del email desde createClientUser
    })
  } catch (error: any) {
    console.error("Error creating client:", error)
    return NextResponse.json(
      { error: error.message || "Error interno del servidor" },
      { status: 500 }
    )
  }
}
