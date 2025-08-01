import { createClient as createServerClient } from "@/lib/supabase/server"
import sgMail from "@sendgrid/mail"

if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY)
}

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
}) {
  const supabase = await createServerClient()
  // First create the client
  const { data: client, error: clientError } = await supabase.from("clients").insert(clientData).select().single()

  if (clientError) throw clientError

  // Create auth user with temporary password
  const tempPassword = Math.random().toString(36).slice(-8)
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: clientData.email,
    password: tempPassword,
    email_confirm: true,
  })

  if (authError) throw authError

  // Create user profile linking to client
  const { error: profileError } = await supabase.from("user_profiles").insert({
    id: authData.user.id,
    client_id: client.id,
    role: "client",
  })

  if (profileError) throw profileError

  // Send welcome email with temporary password
  if (process.env.SENDGRID_API_KEY) {
    const msg = {
      to: clientData.email,
      from: "noreply@example.com", // Change to your verified sender
      subject: "Bienvenido a nuestro portal de clientes",
      html: `
        <h1>Bienvenido, ${clientData.nombre}</h1>
        <p>Se ha creado una cuenta para ti en nuestro portal de clientes.</p>
        <p>Puedes iniciar sesión con las siguientes credenciales:</p>
        <ul>
          <li><strong>Email:</strong> ${clientData.email}</li>
          <li><strong>Contraseña temporal:</strong> ${tempPassword}</li>
        </ul>
        <p>Se te pedirá que cambies tu contraseña después de iniciar sesión por primera vez.</p>
      `,
    }
    try {
      await sgMail.send(msg)
    } catch (error) {
      console.error("Error sending email:", error)
      // We don't want to throw an error here, as the user has been created.
      // We can add more robust error handling later.
    }
  }

  return { client, tempPassword }
}
