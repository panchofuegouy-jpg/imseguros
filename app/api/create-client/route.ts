import { NextRequest, NextResponse } from "next/server"
import { createClientUser, getCurrentUser } from "@/lib/auth-server"
import { createClient as createServerClient } from "@/lib/supabase/server"

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
    const { nombre, email, telefono, documento, direccion, numero_cliente, departamento, createUserAccount } = body

    if (!nombre || !documento) {
      return NextResponse.json(
        { error: "Nombre y documento son requeridos" },
        { status: 400 }
      )
    }

    if (createUserAccount && !email) {
      return NextResponse.json(
        { error: "Email es requerido para crear cuenta de usuario" },
        { status: 400 }
      )
    }

    // Verificar si el número de cliente ya existe (solo si se proporciona)
    if (numero_cliente) {
      const { data: existingClientByNumber } = await (await createServerClient())
        .from("clients")
        .select("id")
        .eq("numero_cliente", parseInt(numero_cliente, 10))
        .single();
        
      if (existingClientByNumber) {
        return NextResponse.json(
          { error: "Ya existe un cliente con ese número. Elige un número diferente." },
          { status: 409 }
        )
      }
    }

    // Verificar si el documento ya existe
    if (documento) {
      const { data: existingClientByDoc } = await (await createServerClient())
        .from("clients")
        .select("id")
        .eq("documento", documento)
        .single();
        
      if (existingClientByDoc) {
        return NextResponse.json(
          { error: "Ya existe un cliente con ese documento de identidad." },
          { status: 409 }
        )
      }
    }

    // Verificar si el email ya existe (solo si se va a crear cuenta)
    if (createUserAccount && email) {
      const { data: existingClientByEmail } = await (await createServerClient())
        .from("clients")
        .select("id")
        .eq("email", email)
        .single();
        
      if (existingClientByEmail) {
        return NextResponse.json(
          { error: "Ya existe un cliente con ese email. Usa un email diferente o no crees cuenta de acceso." },
          { status: 409 }
        )
      }
    }

    const result = await createClientUser({
      nombre,
      email,
      telefono,
      documento,
      direccion,
      numero_cliente,
      departamento,
      createUserAccount: createUserAccount || false,
    })
    
    const { client, tempPassword, emailSent, userCreated } = result

    if (!client) {
      return NextResponse.json(
        { error: "Error al crear el cliente" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      client,
      tempPassword: tempPassword || null,
      emailSent: emailSent || false,
      userCreated: userCreated || false,
    })
  } catch (error: any) {
    console.error("Error creating client:", error)
    return NextResponse.json(
      { error: error.message || "Error interno del servidor" },
      { status: 500 }
    )
  }
}
