import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ policyId: string }> }
) {
  try {
    const supabase = await createClient();
    const { policyId } = await params;
    const body = await request.json();

    // Actualizar la póliza
    const { data, error } = await supabase
      .from("policies")
      .update(body)
      .eq("id", policyId)
      .select()
      .single();

    if (error) {
      console.error("Error updating policy:", error);
      return NextResponse.json(
        { error: "Error al actualizar la póliza" },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: "Póliza no encontrada" },
        { status: 404 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ policyId: string }> }
) {
  try {
    const supabase = await createClient();
    const { policyId } = await params;

    const { data, error } = await supabase
      .from("policies")
      .select(`
        *,
        clients(id, nombre, email, telefono),
        companies(id, name)
      `)
      .eq("id", policyId)
      .single();

    if (error) {
      console.error("Error fetching policy:", error);
      return NextResponse.json(
        { error: "Error al obtener la póliza" },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: "Póliza no encontrada" },
        { status: 404 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
