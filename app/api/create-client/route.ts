import { NextRequest, NextResponse } from "next/server"
import { createClientUser } from "@/lib/auth-server"

export async function POST(request: NextRequest) {
  try {
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
    })
  } catch (error: any) {
    console.error("Error creating client:", error)
    return NextResponse.json(
      { error: error.message || "Error interno del servidor" },
      { status: 500 }
    )
  }
}
