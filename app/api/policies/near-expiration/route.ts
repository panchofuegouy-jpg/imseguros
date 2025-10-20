import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// Función auxiliar para actualizar pólizas renovadas a pendiente
// Cuando una póliza renovada está próxima a vencer nuevamente (15 días antes)
async function updateRenewedPoliciesToPending(supabase: any) {
  try {
    // Calcular fecha: 15 días después de hoy (pólizas que vencen en 15 días)
    const today = new Date();
    const fifteenDaysFromNow = new Date();
    fifteenDaysFromNow.setDate(today.getDate() + 15);
    
    // Buscar pólizas renovadas que vencen en los próximos 15 días
    const { data: policiesToUpdate, error: fetchError } = await supabase
      .from("policies")
      .select("id")
      .eq("status", "Renovada")
      .gte("vigencia_fin", today.toISOString().split('T')[0])
      .lte("vigencia_fin", fifteenDaysFromNow.toISOString().split('T')[0]);
    
    if (fetchError) {
      console.error("Error fetching renewed policies:", fetchError);
      return;
    }
    
    if (policiesToUpdate && policiesToUpdate.length > 0) {
      const ids = policiesToUpdate.map((p: any) => p.id);
      
      // Actualizar a Pendiente
      const { error: updateError } = await supabase
        .from("policies")
        .update({ status: "Pendiente" })
        .in("id", ids);
      
      if (updateError) {
        console.error("Error updating policies to pending:", updateError);
      } else {
        console.log(`Updated ${ids.length} renewed policies to pending status`);
      }
    }
  } catch (error) {
    console.error("Error in updateRenewedPoliciesToPending:", error);
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // NO ejecutar actualización si estamos solicitando historial de renovadas
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    
    if (status !== "Renovada") {
      // Solo ejecutar actualización cuando NO estamos mostrando el historial
      updateRenewedPoliciesToPending(supabase).catch(console.error);
    }
    
    // Parámetros de filtrado
    const month = searchParams.get('month');
    const company = searchParams.get('company');
    const type = searchParams.get('type');
    
    let query = supabase
      .from("policies")
      .select(`
        *,
        clients(id, nombre, email, telefono),
        companies(id, name)
      `)
      .order("vigencia_fin", { ascending: true });

    // Obtener el parámetro status primero para decidir filtros de fecha
    const showRenewed = status === "Renovada";
    
    // Filtro por fecha
    if (month) {
      // Filtrar por mes específico (formato: 2024-01)
      const [year, monthNum] = month.split('-');
      const startDate = new Date(parseInt(year), parseInt(monthNum) - 1, 1);
      const endDate = new Date(parseInt(year), parseInt(monthNum), 0);
      
      query = query
        .gte("vigencia_fin", startDate.toISOString().split('T')[0])
        .lte("vigencia_fin", endDate.toISOString().split('T')[0]);
    } else if (!showRenewed) {
      // Por defecto, mostrar pólizas que vencen en los próximos 60 días
      // Solo aplica cuando NO estamos buscando renovadas
      const today = new Date();
      const futureDate = new Date();
      futureDate.setDate(today.getDate() + 60);
      
      query = query
        .gte("vigencia_fin", today.toISOString().split('T')[0])
        .lte("vigencia_fin", futureDate.toISOString().split('T')[0]);
    }
    
    // Excluir pólizas renovadas del listado por defecto
    // Las pólizas renovadas deben mostrarse solo en el historial
    if (!showRenewed) {
      query = query.neq("status", "Renovada");
    }
    
    // Filtros adicionales
    if (company) {
      query = query.eq("company_id", company);
    }
    
    if (type) {
      query = query.eq("tipo", type);
    }
    
    if (status) {
      query = query.eq("status", status);
    } else if (showRenewed) {
      // Si no hay status explícito pero estamos en historial, mostrar solo Renovada
      query = query.eq("status", "Renovada");
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching policies near expiration:", error);
      return NextResponse.json(
        { error: "Error al obtener las pólizas" },
        { status: 500 }
      );
    }

    return NextResponse.json(data || []);
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
