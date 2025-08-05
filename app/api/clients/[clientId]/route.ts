import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth-server";

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

    // Remove id and other non-updatable fields from body
    const { id, created_at, updated_at, ...updateData } = body;

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

    const { data, error } = await adminSupabase
      .from("clients")
      .update(updateData)
      .eq("id", clientId)
      .select()
      .single();

    if (error) {
      console.error("Error updating client:", error);
      return NextResponse.json(
        { error: "Error al actualizar el cliente" },
        { status: 500 }
      );
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
      .select("id, archivo_url")
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
      for (const policy of policies) {
        if (policy.archivo_url) {
          try {
            const filePath = new URL(policy.archivo_url).pathname.split('/public/policy-documents/')[1];
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
