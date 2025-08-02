import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

interface EmailRequest {
  email: string
  nombre: string
  tempPassword: string
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { email, nombre, tempPassword }: EmailRequest = await req.json()

    if (!RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY no está configurada')
    }

    if (!email || !nombre || !tempPassword) {
      throw new Error('Faltan parámetros requeridos: email, nombre, tempPassword')
    }

    // Enviar email usando Resend
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'IM Seguros <oficina@imseguros.uy>',
        to: [email],
        subject: 'Bienvenido a IM Seguros - Credenciales de Acceso',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #2563eb; text-align: center; margin-bottom: 30px;">¡Bienvenido a IM Seguros!</h1>
            
            <p style="font-size: 16px; color: #374151;">
              Estimado/a <strong>${nombre}</strong>,
            </p>
            
            <p style="font-size: 16px; color: #374151; line-height: 1.6;">
              Se ha creado una cuenta para ti en nuestro portal de clientes. 
              Ahora puedes acceder a tu información y gestionar tus pólizas de seguro 
              de manera fácil y segura.
            </p>
            
            <div style="background-color: #f8fafc; border: 2px solid #e2e8f0; padding: 24px; border-radius: 12px; margin: 30px 0;">
              <h3 style="color: #1e40af; margin-top: 0; margin-bottom: 16px;">🔑 Credenciales de Acceso</h3>
              <p style="margin: 8px 0;">
                <strong style="color: #374151;">Email:</strong> 
                <span style="color: #059669;">${email}</span>
              </p>
              <p style="margin: 8px 0;">
                <strong style="color: #374151;">Contraseña temporal:</strong> 
                <code style="background-color: #fef3c7; color: #92400e; padding: 6px 12px; border-radius: 6px; font-family: 'Courier New', monospace; font-weight: bold;">${tempPassword}</code>
              </p>
            </div>
            
            <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 16px; margin: 24px 0;">
              <p style="margin: 0; color: #991b1b;">
                <strong>⚠️ Importante:</strong> Por seguridad, se te pedirá que cambies 
                tu contraseña después de iniciar sesión por primera vez.
              </p>
            </div>
            
            <p style="font-size: 16px; color: #374151; line-height: 1.6;">
              Si tienes alguna pregunta o necesitas ayuda, no dudes en contactarnos.
            </p>
            
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
            
            <p style="font-size: 14px; color: #6b7280;">
              Saludos cordiales,<br>
              <strong style="color: #2563eb;">Equipo de IM Seguros</strong>
            </p>
          </div>
        `,
      }),
    })

    if (!res.ok) {
      const error = await res.text()
      throw new Error(`Error de Resend: ${error}`)
    }

    const data = await res.json()
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Email enviado exitosamente',
        id: data.id 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Error enviando email:', error)
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})
