import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { isNextResponse, requireAdmin } from "@/lib/admin-guard"

type Context = { params: Promise<{ importId: string }> }

export async function GET(_request: NextRequest, { params }: Context) {
  const session = await requireAdmin(); if (isNextResponse(session)) return session
  const { importId } = await params
  const supabase = await createClient()
  const { data: rows, error } = await supabase.from("collection_import_rows").select("*").eq("batch_id", importId).order("row_number").limit(50)
  if (error) return NextResponse.json({ error: "No se pudo generar la vista previa" }, { status: 500 })
  return NextResponse.json({ data: rows || [], limit: 50 })
}
