import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth-server";

// Helper para generar una contraseña aleatoria
function generateTemporaryPassword() {
  return Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-4).toUpperCase() + '1!';
}

export async function PATCH(
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

    const { id, created_at, updated_at, createUserAccount, ...updateData } = body;

    if (updateData.numero_cliente) {
      updateData.numero_cliente = parseInt(updateData.numero_cliente, 10);
      if (isNaN(updateData.numero_cliente)) {
        updateData.numero_cliente = null;
      }
    } else {
      updateData.numero_cliente = null;
    }

    if (!clientId) {
      return NextResponse.json(
        { error: "Client ID es requerido" },
        { status: 400 }
      );
    }

    const adminSupabase = createAdminClient();

    // 1. Obtener el estado actual del cliente
    const { data: currentClient, error: fetchError } = await adminSupabase
      .from("clients")
      .select("email, numero_cliente, documento")
      .eq("id", clientId)
      .single();

    if (fetchError) {
      console.error("Error fetching client for update:", fetchError);
      return NextResponse.json(
        { error: "No se pudo encontrar el cliente para actualizar" },
        { status: 404 }
      );
    }

    // Verificar si el número de cliente ya existe (solo si cambió)
    if (updateData.numero_cliente && updateData.numero_cliente !== currentClient.numero_cliente) {
      const { data: existingClientByNumber } = await adminSupabase
        .from("clients")
        .select("id")
        .eq("numero_cliente", updateData.numero_cliente)
        .neq("id", clientId)
        .single();
        
      if (existingClientByNumber) {
        return NextResponse.json(
          { error: "Ya existe otro cliente con ese número. Elige un número diferente." },
          { status: 409 }
        )
      }
    }

    // Verificar si el documento ya existe (solo si cambió)
    if (updateData.documento && updateData.documento !== currentClient.documento) {
      const { data: existingClientByDoc } = await adminSupabase
        .from("clients")
        .select("id")
        .eq("documento", updateData.documento)
        .neq("id", clientId)
        .single();
        
      if (existingClientByDoc) {
        return NextResponse.json(
          { error: "Ya existe otro cliente con ese documento de identidad." },
          { status: 409 }
        )
      }
    }

    // Verificar si el email ya existe (solo si se va a crear cuenta y cambió)
    if (createUserAccount && updateData.email && updateData.email !== currentClient.email) {
      const { data: existingClientByEmail } = await adminSupabase
        .from("clients")
        .select("id")
        .eq("email", updateData.email)
        .neq("id", clientId)
        .single();
        
      if (existingClientByEmail) {
        return NextResponse.json(
          { error: "Ya existe otro cliente con ese email. Usa un email diferente o no crees cuenta de acceso." },
          { status: 409 }
        )
      }
    }

    // 2. Verificar si se está añadiendo un email por primera vez y se solicita crear usuario
    const isCreatingUser = !currentClient.email && updateData.email && createUserAccount;
    let newAuthUser = null;
    let tempPassword = null;
    let emailSent = false;

    if (isCreatingUser) {
      const logPrefix = `[ClientUpdate][${clientId}][${Date.now()}]`
      console.log(`${logPrefix} Iniciando creación de usuario para cliente existente`)
      
      const temporaryPassword = generateTemporaryPassword();
      
      // 3. Crear el usuario en Supabase Auth
      console.log(`${logPrefix}[Step:Auth] Creando usuario en Auth...`)
      const { data: authUser, error: authError } = await adminSupabase.auth.admin.createUser({
        email: updateData.email,
        password: temporaryPassword,
        email_confirm: true, // El email se considera verificado
      });

      if (authError) {
        console.error(`${logPrefix}[Step:Auth] Error creando usuario en Auth:`, authError)
        // Manejar el caso en que el email ya exista en Auth
        if (authError.message.includes("already exists") || authError.message.includes("already registered")) {
          return NextResponse.json(
            { error: "Este email ya está registrado por otro usuario." },
            { status: 409 } // 409 Conflict
          );
        }
        return NextResponse.json(
          { error: "Error al crear las credenciales del usuario" },
          { status: 500 }
        );
      }
      
      newAuthUser = authUser.user;
      tempPassword = temporaryPassword; // Guardar para devolver al frontend
      console.log(`${logPrefix}[Step:Auth] Usuario creado en Auth:`, newAuthUser.id)

      // 4. Crear perfil de usuario vinculando al cliente
      console.log(`${logPrefix}[Step:Profile] Creando perfil de usuario...`)
      const { error: profileError } = await adminSupabase
        .from("user_profiles")
        .insert({
          id: newAuthUser.id,
          client_id: clientId,
          role: "client",
          first_login: true, // Marcar que necesita cambiar contraseña en primer login
        });

      if (profileError) {
        console.error(`${logPrefix}[Step:Profile] Error creando perfil:`, profileError)
        
        // ROLLBACK: Revertir la creación del usuario de Auth
        console.log(`${logPrefix}[Rollback] Borrando usuario Auth...`)
        const { error: deleteAuthError } = await adminSupabase.auth.admin.deleteUser(newAuthUser.id);
        if (deleteAuthError) console.error(`${logPrefix}[Rollback] Error borrando usuario Auth:`, deleteAuthError)
        else console.log(`${logPrefix}[Rollback] Usuario Auth borrado`)

        return NextResponse.json(
          { error: "Error al crear el perfil de usuario" },
          { status: 500 }
        );
      }
      console.log(`${logPrefix}[Step:Profile] Perfil creado exitosamente`)

      // 5. Invocar la Edge Function para enviar el email de bienvenida
      console.log(`${logPrefix}[Step:Email] Enviando email...`)
      
      try {
        const { data: functionData, error: functionError } = await adminSupabase.functions.invoke('send-welcome-email', {
          body: {
            email: updateData.email,
            nombre: updateData.nombre || currentClient.nombre, // Usar nombre nuevo o existente
            tempPassword: temporaryPassword
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
    }

    // 6. Actualizar la información del cliente en la tabla 'clients'
    const { data, error } = await adminSupabase
      .from("clients")
      .update(updateData)
      .eq("id", clientId)
      .select()
      .single();

    if (error) {
      console.error("Error updating client:", error);
      // Si la creación del usuario de Auth funcionó, deberíamos intentar revertirla
      if (newAuthUser) {
        await adminSupabase.auth.admin.deleteUser(newAuthUser.id);
      }
      return NextResponse.json(
        { error: "Error al actualizar el cliente" },
        { status: 500 }
      );
    }

    // Si se creó usuario, incluir información adicional
    if (isCreatingUser && newAuthUser) {
      return NextResponse.json({
        ...data,
        tempPassword,
        emailSent,
        userCreated: true
      });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error en PATCH /api/clients/[clientId]:", error);
    return NextResponse.json(
      { error: error.message || "Error interno del servidor" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.profile?.role !== "admin") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const { clientId } = await params;

    if (!clientId) {
      return NextResponse.json(
        { error: "Client ID es requerido" },
        { status: 400 }
      );
    }

    const adminSupabase = createAdminClient();

    // Obtener información del cliente para encontrar el usuario asociado
    const { data: userProfile, error: profileError } = await adminSupabase
      .from("user_profiles")
      .select("id")
      .eq("client_id", clientId)
      .single();

    if (profileError && profileError.code !== 'PGRST116') {
      console.error("Error finding user profile:", profileError);
      return NextResponse.json(
        { error: "Error al buscar el perfil del usuario" },
        { status: 500 }
      );
    }

    // Eliminar las pólizas asociadas y sus archivos
    const { data: policies, error: policiesError } = await adminSupabase
      .from("policies")
      .select("id, archivo_url, archivo_urls")
      .eq("client_id", clientId);

    if (policiesError) {
      console.error("Error fetching policies:", policiesError);
      return NextResponse.json(
        { error: "Error al obtener las pólizas del cliente" },
        { status: 500 }
      );
    }

    // Eliminar archivos de pólizas del storage
    if (policies && policies.length > 0) {
      const filesToDelete: string[] = [];
      for (const policy of policies) {
        if (policy.archivo_urls && Array.isArray(policy.archivo_urls)) {
          filesToDelete.push(...policy.archivo_urls);
        }
        if (policy.archivo_url) {
          filesToDelete.push(policy.archivo_url);
        }
      }

      const uniqueFilesToDelete = [...new Set(filesToDelete)];

      for (const fileUrl of uniqueFilesToDelete) {
        try {
          const urlParts = fileUrl.split('/');
          const bucketIndex = urlParts.findIndex(part => part === 'policy-documents');
          if (bucketIndex === -1) {
            console.warn("Could not find bucket in URL:", fileUrl);
            continue;
          }
          const filePath = urlParts.slice(bucketIndex + 1).join('/');
          if (filePath) {
            const { error: storageError } = await adminSupabase.storage
              .from("policy-documents")
              .remove([filePath]);
            
            if (storageError) {
              console.error(`Error deleting policy file ${filePath}:`, storageError);
            }
          }
        } catch (err) {
          console.error(`Error processing policy file URL:`, err);
        }
      }

      // Eliminar las pólizas de la base de datos
      const { error: deletePoliciesError } = await adminSupabase
        .from("policies")
        .delete()
        .eq("client_id", clientId);

      if (deletePoliciesError) {
        console.error("Error deleting policies:", deletePoliciesError);
        return NextResponse.json(
          { error: "Error al eliminar las pólizas del cliente" },
          { status: 500 }
        );
      }
    }

    // Eliminar el perfil de usuario
    if (userProfile) {
      const { error: deleteProfileError } = await adminSupabase
        .from("user_profiles")
        .delete()
        .eq("client_id", clientId);

      if (deleteProfileError) {
        console.error("Error deleting user profile:", deleteProfileError);
        return NextResponse.json(
          { error: "Error al eliminar el perfil de usuario" },
          { status: 500 }
        );
      }

      // Eliminar el usuario de Supabase Auth
      const { error: authDeleteError } = await adminSupabase.auth.admin.deleteUser(
        userProfile.id
      );

      if (authDeleteError) {
        console.error("Error deleting auth user:", authDeleteError);
        return NextResponse.json(
          { error: "Error al eliminar el usuario de autenticación" },
          { status: 500 }
        );
      }
    }

    // Finalmente, eliminar el cliente
    const { error: deleteClientError } = await adminSupabase
      .from("clients")
      .delete()
      .eq("id", clientId);

    if (deleteClientError) {
      console.error("Error deleting client:", deleteClientError);
      return NextResponse.json(
        { error: "Error al eliminar el cliente" },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true, 
      message: "Cliente eliminado exitosamente" 
    });
  } catch (error: any) {
    console.error("Error en DELETE /api/clients/[clientId]:", error);
    return NextResponse.json(
      { error: error.message || "Error interno del servidor" },
      { status: 500 }
    );
  }
}
