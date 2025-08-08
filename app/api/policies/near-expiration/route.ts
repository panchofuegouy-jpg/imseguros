import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    
    // Parámetros de filtrado
    const month = searchParams.get('month');
    const company = searchParams.get('company');
    const type = searchParams.get('type');
    const status = searchParams.get('status');
    
    let query = supabase
      .from("policies")
      .select(`
        *,
        clients(id, nombre, email, telefono),
        companies(id, name)
      `)
      .order("vigencia_fin", { ascending: true });

    // Filtro por fecha
    if (month) {
      // Filtrar por mes específico (formato: 2024-01)
      const [year, monthNum] = month.split('-');
      const startDate = new Date(parseInt(year), parseInt(monthNum) - 1, 1);
      const endDate = new Date(parseInt(year), parseInt(monthNum), 0);
      
      query = query
        .gte("vigencia_fin", startDate.toISOString().split('T')[0])
        .lte("vigencia_fin", endDate.toISOString().split('T')[0]);
    } else {
      // Por defecto, mostrar pólizas que vencen en los próximos 60 días
      const today = new Date();
      const futureDate = new Date();
      futureDate.setDate(today.getDate() + 60);
      
      query = query
        .gte("vigencia_fin", today.toISOString().split('T')[0])
        .lte("vigencia_fin", futureDate.toISOString().split('T')[0]);
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
