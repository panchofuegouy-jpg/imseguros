import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth-server";

function generateTemporaryPassword() {
  return Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-4).toUpperCase() + '1!';
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.profile?.role !== "admin") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const { clientId } = await params;
    const body = await request.json();
    const { newEmail } = body;

    if (!clientId) {
      return NextResponse.json(
        { error: "Client ID es requerido" },
        { status: 400 }
      );
    }

    const adminSupabase = createAdminClient();

    // 1. Buscar el perfil del usuario (para obtener su userId en Auth)
    const { data: userProfile, error: profileError } = await adminSupabase
      .from("user_profiles")
      .select("id")
      .eq("client_id", clientId)
      .single();

    if (profileError || !userProfile) {
      return NextResponse.json(
        { error: "Este cliente no tiene cuenta de acceso" },
        { status: 404 }
      );
    }

    const userId = userProfile.id;

    // 2. Obtener información del cliente
    const { data: client, error: clientError } = await adminSupabase
      .from("clients")
      .select("nombre, email")
      .eq("id", clientId)
      .single();

    if (clientError || !client) {
      return NextResponse.json(
        { error: "Cliente no encontrado" },
        { status: 404 }
      );
    }

    const currentEmail = client.email;
    const effectiveEmail = newEmail || currentEmail;

    if (!effectiveEmail) {
      return NextResponse.json(
        { error: "El cliente no tiene email registrado" },
        { status: 400 }
      );
    }

    // 3. Si el email cambió, actualizar en la DB
    if (newEmail && newEmail !== currentEmail) {
      // Verificar que el nuevo email no esté en uso por otro cliente
      const { data: existingClient } = await adminSupabase
        .from("clients")
        .select("id")
        .eq("email", newEmail)
        .neq("id", clientId)
        .single();

      if (existingClient) {
        return NextResponse.json(
          { error: "Ya existe otro cliente con ese email" },
          { status: 409 }
        );
      }

      // Actualizar email en clients table
      const { error: updateClientError } = await adminSupabase
        .from("clients")
        .update({ email: newEmail })
        .eq("id", clientId);

      if (updateClientError) {
        return NextResponse.json(
          { error: "Error al actualizar email del cliente" },
          { status: 500 }
        );
      }
    }

    // 4. Generar nueva contraseña temporal
    const tempPassword = generateTemporaryPassword();

    // 5. Actualizar email y contraseña en Supabase Auth
    if (newEmail && newEmail !== currentEmail) {
      const { error: authEmailError } = await adminSupabase.auth.admin.updateUserById(userId, {
        email: newEmail,
      });

      if (authEmailError) {
        return NextResponse.json(
          { error: "Error al actualizar email en Auth" },
          { status: 500 }
        );
      }
    }

    const { error: authPasswordError } = await adminSupabase.auth.admin.updateUserById(userId, {
      password: tempPassword,
    });

    if (authPasswordError) {
      return NextResponse.json(
        { error: "Error al actualizar contraseña en Auth" },
        { status: 500 }
      );
    }

    // 6. Resetear first_login flag
    const { error: updateProfileError } = await adminSupabase
      .from("user_profiles")
      .update({ first_login: true })
      .eq("id", userId);

    if (updateProfileError) {
      return NextResponse.json(
        { error: "Error al actualizar perfil de usuario" },
        { status: 500 }
      );
    }

    // 7. Enviar email usando Supabase Edge Function
    let emailSent = false;
    try {
      const { data: functionData, error: functionError } = await adminSupabase.functions.invoke('send-welcome-email', {
        body: {
          email: effectiveEmail,
          nombre: client.nombre,
          tempPassword: tempPassword
        }
      });

      if (functionError) {
        console.error("Error calling send-welcome-email function:", functionError);
        emailSent = false;
      } else if (functionData?.success) {
        emailSent = true;
      }
    } catch (error) {
      console.error("Error invoking send-welcome-email:", error);
      emailSent = false;
    }

    return NextResponse.json({
      success: true,
      emailSent,
      tempPassword
    });

  } catch (error) {
    console.error("Error in resend-credentials:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
