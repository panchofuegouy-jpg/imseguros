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
  email?: string | null
  telefono?: string
  documento: string
  direccion?: string
  numero_cliente?: number
  departamento?: string
  createUserAccount?: boolean
}) {
  const logPrefix = `[ClientCreation][${Date.now()}]`
  console.log(`${logPrefix} Iniciando creación de cliente:`, clientData.email || 'sin email')
  
  // Usar cliente admin para operaciones que requieren Service Role
  const adminSupabase = createAdminClient()
  
  try {
    // Preparar datos del cliente para inserción
    const { createUserAccount, ...clientInsertData } = clientData
    
    // 1. Crear el cliente en la tabla clients
    console.log(`${logPrefix}[Step:Client] Creando registro de cliente...`)
    const { data: client, error: clientError } = await adminSupabase
      .from("clients")
      .insert(clientInsertData)
      .select()
      .single()

    if (clientError) {
      console.error(`${logPrefix}[Step:Client] Error creando cliente:`, clientError)
      
      // Manejar errores de duplicados con mensajes específicos
      if (clientError.code === '23505') { // Unique violation
        if (clientError.message.includes('email')) {
          throw new Error('Ya existe un cliente con ese email.')
        } else if (clientError.message.includes('documento')) {
          throw new Error('Ya existe un cliente con ese documento de identidad.')
        } else if (clientError.message.includes('numero_cliente')) {
          throw new Error('Ya existe un cliente con ese número.')
        }
      }
      
      throw new Error(clientError.message || 'Error al crear el cliente')
    }
    console.log(`${logPrefix}[Step:Client] Cliente creado exitosamente:`, client.id)
    
    // Si no se debe crear usuario, retornar solo el cliente
    if (!createUserAccount || !clientData.email) {
      console.log(`${logPrefix} No se creará usuario de acceso`)
      return { 
        client, 
        tempPassword: null, 
        emailSent: false, 
        userCreated: false 
      }
    }

    // 2. Crear usuario en Supabase Auth con contraseña temporal
    const tempPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-4).toUpperCase() + '1!'
    console.log(`${logPrefix}[Step:Auth] Creando usuario en Auth con email:`, clientData.email)
    
    const { data: authData, error: authError } = await adminSupabase.auth.admin.createUser({
      email: clientData.email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        full_name: clientData.nombre
      }
    })

    if (authError) {
      console.error(`${logPrefix}[Step:Auth] Error creando usuario en Auth:`, authError)
      
      // ROLLBACK: Eliminar el cliente creado
      console.log(`${logPrefix}[Rollback] Iniciando eliminación de cliente ${client.id}...`)
      const { error: deleteError } = await adminSupabase
        .from("clients")
        .delete()
        .eq("id", client.id)
      
      if (deleteError) {
        console.error(`${logPrefix}[Rollback] FALLÓ al eliminar cliente:`, deleteError)
      } else {
        console.log(`${logPrefix}[Rollback] Cliente eliminado exitosamente`)
      }

      if (authError.message.includes('already has been registered') || authError.message.includes('already registered')) {
         throw new Error('Ya existe un usuario registrado con ese email.')
      }

      throw new Error(`Error creando usuario: ${authError.message}`)
    }
    console.log(`${logPrefix}[Step:Auth] Usuario creado en Auth exitosamente:`, authData.user.id)

    // 3. Crear perfil de usuario vinculando al cliente
    console.log(`${logPrefix}[Step:Profile] Creando perfil de usuario...`)
    const { error: profileError } = await adminSupabase
      .from("user_profiles")
      .insert({
        id: authData.user.id,
        client_id: client.id,
        role: "client",
        first_login: true, // Marcar que necesita cambiar contraseña en primer login
      })

    if (profileError) {
      console.error(`${logPrefix}[Step:Profile] Error creando perfil:`, profileError)
      
      // ROLLBACK: Eliminar usuario de Auth y Cliente
      console.log(`${logPrefix}[Rollback] Iniciando rollback completo...`)
      
      // Borrar usuario Auth
      const { error: deleteAuthError } = await adminSupabase.auth.admin.deleteUser(authData.user.id)
      if (deleteAuthError) console.error(`${logPrefix}[Rollback] Error borrando usuario Auth:`, deleteAuthError)
      else console.log(`${logPrefix}[Rollback] Usuario Auth borrado`)

      // Borrar cliente
      const { error: deleteClientError } = await adminSupabase
        .from("clients")
        .delete()
        .eq("id", client.id)
      if (deleteClientError) console.error(`${logPrefix}[Rollback] Error borrando cliente:`, deleteClientError)
      else console.log(`${logPrefix}[Rollback] Cliente borrado`)

      throw new Error(`Error creando perfil: ${profileError.message}`)
    }
    console.log(`${logPrefix}[Step:Profile] Perfil de usuario creado exitosamente`)

    // 4. Enviar email de bienvenida usando Supabase Edge Function
    let emailSent = false
    console.log(`${logPrefix}[Step:Email] Enviando email usando Supabase Edge Function...`)
    
    try {
      const { data: functionData, error: functionError } = await adminSupabase.functions.invoke('send-welcome-email', {
        body: {
          email: clientData.email,
          nombre: clientData.nombre,
          tempPassword: tempPassword
        }
      })

      if (functionError) {
        console.error(`${logPrefix}[Step:Email] Error llamando a Edge Function:`, functionError)
        emailSent = false
      } else if (functionData?.success) {
        console.log(`${logPrefix}[Step:Email] Email enviado exitosamente:`, functionData)
        emailSent = true
      } else {
        console.error(`${logPrefix}[Step:Email] Edge Function retornó error:`, functionData)
        emailSent = false
      }
    } catch (error) {
      console.error(`${logPrefix}[Step:Email] Error invocando Edge Function:`, error)
      emailSent = false
    }

    console.log(`${logPrefix] Proceso completado exitosamente`)
    return { client, tempPassword, emailSent, userCreated: true }
  } catch (error) {
    console.error("Error creating client user:", error)
    // Re-throw para que el controlador de ruta pueda devolver el código de estado correcto
    throw error
  }
}
