import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth-server";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { clientId: string } }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.profile?.role !== "admin") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const { clientId } = params;
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
