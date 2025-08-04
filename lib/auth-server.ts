import { createClient as createServerClient, createAdminClient } from "@/lib/supabase/server"

export async function getCurrentUser() {
  const supabase = await createServerClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) return null

  const { data: profile } = await supabase.from("user_profiles").select("*, client:clients(*)").eq("id", user.id).single()

  return { user, profile }
}

export async function createClientUser(clientData: {
  nombre: string
  email: string
  telefono?: string
  documento: string
  direccion?: string
  numero_cliente?: number
  departamento?: string
}) {
  console.log('Iniciando creación de cliente:', clientData.email)
  
  // Usar cliente admin para operaciones que requieren Service Role
  const adminSupabase = createAdminClient()
  const regularSupabase = await createServerClient()
  
  try {
    // Primero crear el cliente en la tabla clients
    console.log('Creando registro de cliente...')
    const { data: client, error: clientError } = await adminSupabase
      .from("clients")
      .insert(clientData)
      .select()
      .single()

    if (clientError) {
      console.error('Error creando cliente:', clientError)
      throw clientError
    }
    console.log('Cliente creado exitosamente:', client.id)

    // Crear usuario en Supabase Auth con contraseña temporal
    const tempPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-4).toUpperCase() + '1!'
    console.log('Creando usuario en Auth con email:', clientData.email)
    
    const { data: authData, error: authError } = await adminSupabase.auth.admin.createUser({
      email: clientData.email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        full_name: clientData.nombre
      }
    })

    if (authError) {
      console.error('Error creando usuario en Auth:', authError)
      throw new Error(`Error creando usuario: ${authError.message}`)
    }
    console.log('Usuario creado en Auth exitosamente:', authData.user.id)

    // Crear perfil de usuario vinculando al cliente
    console.log('Creando perfil de usuario...')
    const { error: profileError } = await adminSupabase
      .from("user_profiles")
      .insert({
        id: authData.user.id,
        client_id: client.id,
        role: "client",
        first_login: true, // Marcar que necesita cambiar contraseña en primer login
      })

    if (profileError) {
      console.error('Error creando perfil:', profileError)
      throw new Error(`Error creando perfil: ${profileError.message}`)
    }
    console.log('Perfil de usuario creado exitosamente')

    // Enviar email de bienvenida usando Supabase Edge Function
    let emailSent = false
    console.log('Enviando email usando Supabase Edge Function...')
    
    try {
      const { data: functionData, error: functionError } = await adminSupabase.functions.invoke('send-welcome-email', {
        body: {
          email: clientData.email,
          nombre: clientData.nombre,
          tempPassword: tempPassword
        }
      })

      if (functionError) {
        console.error('Error llamando a Edge Function:', functionError)
        emailSent = false
      } else if (functionData?.success) {
        console.log('Email enviado exitosamente:', functionData)
        emailSent = true
      } else {
        console.error('Edge Function retornó error:', functionData)
        emailSent = false
      }
    } catch (error) {
      console.error('Error invocando Edge Function:', error)
      emailSent = false
    }

    console.log('Proceso completado exitosamente')
    return { client, tempPassword }
  } catch (error) {
    console.error("Error creating client user:", error)
    return { client: null, tempPassword: null }
  }
}
