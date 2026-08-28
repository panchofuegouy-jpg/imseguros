import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { isNextResponse, requireAdmin } from "@/lib/admin-guard"
import { mappingPayloadSchema } from "@/lib/collection-import-server"

export async function GET(request: NextRequest) {
  const session = await requireAdmin(); if (isNextResponse(session)) return session
  const companyId = request.nextUrl.searchParams.get("company_id")
  const supabase = await createClient()
  let query = supabase.from("company_import_mappings")
    .select("id, company_id, version, mapping, normalizers, created_by, created_at")
    .order("version", { ascending: false })
  if (companyId) query = query.eq("company_id", companyId)
  const { data, error } = await query
  if (error) return NextResponse.json({ error: "No se pudieron cargar los perfiles" }, { status: 500 })
  return NextResponse.json({ data: data || [] })
}

export async function POST(request: NextRequest) {
  const session = await requireAdmin(); if (isNextResponse(session)) return session
  const parsed = mappingPayloadSchema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: "Perfil inválido", details: parsed.error.flatten() }, { status: 422 })
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("create_company_import_mapping", {
    p_company_id: parsed.data.company_id, p_actor_id: session.userId,
    p_mapping: parsed.data.mapping, p_normalizers: parsed.data.normalizers,
  })
  if (error) return NextResponse.json({ error: "No se pudo crear el perfil" }, { status: error.code === "23505" ? 409 : 500 })
  return NextResponse.json(data, { status: 201 })
}
