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
    const { nombre, email, telefono, documento, direccion } = body

    if (!nombre || !email || !documento) {
      return NextResponse.json(
        { error: "Nombre, email y documento son requeridos" },
        { status: 400 }
      )
    }

    const { client, tempPassword } = await createClientUser({
      nombre,
      email,
      telefono,
      documento,
      direccion,
    })

    if (!client || !tempPassword) {
      return NextResponse.json(
        { error: "Error al crear el cliente o la contraseña temporal" },
        { status: 500 }
      )
    }

    let emailSent = false
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false,
          },
        }
      )

      const { data, error } = await supabase.functions.invoke('send-welcome-email', {
        body: { email, nombre, tempPassword },
      })

      if (error) {
        console.error("Error invoking Supabase function:", error)
        emailSent = false
      } else {
        console.log("Supabase function invoked successfully:", data)
        emailSent = data.success
      }
    } catch (emailError) {
      console.error("Error sending welcome email:", emailError)
      emailSent = false
    }

    return NextResponse.json({
      client,
      tempPassword,
      emailSent,
    })
  } catch (error: any) {
    console.error("Error creating client:", error)
    return NextResponse.json(
      { error: error.message || "Error interno del servidor" },
      { status: 500 }
    )
  }
}
