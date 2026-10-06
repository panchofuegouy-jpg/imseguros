import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth-server";

function generateTemporaryPassword() {
  return Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-4).toUpperCase() + '1!';
}

function normalizeEmail(email: string | null | undefined) {
  return email?.trim().toLowerCase() ?? '';
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
    const effectiveEmail = normalizeEmail(newEmail || currentEmail);
    const emailChanged = Boolean(newEmail && effectiveEmail !== normalizeEmail(currentEmail));

    if (!effectiveEmail) {
      return NextResponse.json(
        { error: "El cliente no tiene email registrado" },
        { status: 400 }
      );
    }

    // 3. Si el email cambió, actualizar en la DB
    if (emailChanged) {
      // Verificar que el nuevo email no esté en uso por otro cliente
      const { data: existingClient } = await adminSupabase
        .from("clients")
        .select("id")
        .eq("email", effectiveEmail)
        .neq("id", clientId)
        .single();

      if (existingClient) {
        return NextResponse.json(
          { error: "Ya existe otro cliente con ese email" },
          { status: 409 }
        );
      }

    }

    // 4. Generar nueva contraseña temporal
    const tempPassword = generateTemporaryPassword();

    // 5. Actualizar email y contraseña en Supabase Auth
    // Keep Auth aligned with the address where we are sending the credentials.
    // The client row may have been edited without updating its Auth user.
    const { data: authUserResult, error: authUserLookupError } = await adminSupabase.auth.admin.getUserById(userId);
    if (authUserLookupError || !authUserResult.user) {
      return NextResponse.json(
        { error: "No se pudo verificar la cuenta de acceso del cliente" },
        { status: 500 }
      );
    }

    const previousAuthEmail = authUserResult.user.email;
    let authEmailWasUpdated = false;
    if (normalizeEmail(authUserResult.user.email) !== effectiveEmail) {
      const { error: authEmailError } = await adminSupabase.auth.admin.updateUserById(userId, {
        email: effectiveEmail,
        email_confirm: true,
      });

      if (authEmailError) {
        return NextResponse.json(
          { error: "Error al actualizar email en Auth" },
          { status: 500 }
        );
      }
      authEmailWasUpdated = true;
    }

    if (emailChanged) {
      const { error: updateClientError } = await adminSupabase
        .from("clients")
        .update({ email: effectiveEmail })
        .eq("id", clientId);

      if (updateClientError) {
        if (authEmailWasUpdated && previousAuthEmail) {
          const { error: rollbackError } = await adminSupabase.auth.admin.updateUserById(userId, {
            email: previousAuthEmail,
            email_confirm: true,
          });
          if (rollbackError) {
            console.error("Failed to restore Auth email after client update error:", rollbackError.code);
          }
        }
        return NextResponse.json(
          { error: "No se pudo actualizar el email del cliente; no se modificó la contraseña ni se enviaron las credenciales." },
          { status: 500 }
        );
      }
    }

    const { error: authPasswordError } = await adminSupabase.auth.admin.updateUserById(userId, {
      password: tempPassword,
      email_confirm: true,
    });

    if (authPasswordError) {
      return NextResponse.json(
        { error: "Error al actualizar contraseña en Auth" },
        { status: 500 }
      );
    }

    // Verify the generated credentials against the same public Auth endpoint
    // used by the login screen before sending them to the client.
    const authCheck = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    const { data: checkedCredentials, error: credentialCheckError } = await authCheck.auth.signInWithPassword({
      email: effectiveEmail,
      password: tempPassword,
    });

    if (credentialCheckError || checkedCredentials.user?.id !== userId) {
      console.error("Temporary credentials failed Auth verification", credentialCheckError?.code ?? "user_mismatch");
      return NextResponse.json(
        { error: "Supabase no aceptó la contraseña temporal; no se enviaron las credenciales. Volvé a intentarlo." },
        { status: 502 }
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
