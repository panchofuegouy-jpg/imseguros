import type { SupabaseClient } from "@supabase/supabase-js"
import { computeProposalItem, proposalTotals, type BseRow, type ProposalItem } from "@/lib/renewal-proposals"

export const RENEWAL_PROPOSALS_BUCKET = "renewal-proposals"
export const DEFAULT_AUMENTO_PCT = 3

/** % de aumento de cada cliente (tabla solo para admins). Sin fila = 3 %. */
export async function aumentoPorCliente(supabase: SupabaseClient, clientIds: string[]) {
  const map = new Map<string, number>()
  for (let start = 0; start < clientIds.length; start += 200) {
    const { data, error } = await supabase
      .from("client_renewal_settings")
      .select("client_id, aumento_renovacion_pct")
      .in("client_id", clientIds.slice(start, start + 200))
    if (error) throw new Error("No se pudo leer el aumento de los clientes")
    for (const row of data || []) map.set(row.client_id as string, Number(row.aumento_renovacion_pct))
  }
  return map
}

export type MatchedClient = {
  id: string
  nombre: string
  documento: string | null
  telefono: string | null
  aumento_renovacion_pct: number
}

export type MatchedItem = ProposalItem & { policy_id: string; tipo: string | null }

export type ClientGroup = {
  client: MatchedClient
  items: MatchedItem[]
  totals: ReturnType<typeof proposalTotals>
}

export type UnmatchedGroup = { cliente_bse: string; polizas: string[]; cotizaciones: number }

type PolicyRow = {
  id: string
  numero_poliza: string
  tipo: string | null
  vigencia_fin: string | null
  company_id: string | null
  client: Omit<MatchedClient, "aumento_renovacion_pct"> | null
}

async function bseCompanyIds(supabase: SupabaseClient) {
  const { data, error } = await supabase.from("companies").select("id, name")
  if (error) throw new Error("No se pudieron leer las aseguradoras")
  return (data || []).filter((company) => /^\s*(bse|banco de seguros)/i.test(company.name)).map((company) => company.id as string)
}

/**
 * Cruza las filas del export con las pólizas de la plataforma por número de póliza
 * (de BSE, o sin aseguradora cargada) y calcula cada ítem con el % del cliente.
 */
export async function matchBseRows(supabase: SupabaseClient, rows: BseRow[]) {
  const companyIds = await bseCompanyIds(supabase)
  const numbers = [...new Set(rows.map((row) => row.poliza).filter(Boolean))]
  const policies: PolicyRow[] = []
  for (let start = 0; start < numbers.length; start += 200) {
    const chunk = numbers.slice(start, start + 200)
    const { data, error } = await supabase
      .from("policies")
      .select("id, numero_poliza, tipo, vigencia_fin, company_id, client:clients(id, nombre, documento, telefono)")
      .in("numero_poliza", chunk)
    if (error) throw new Error("No se pudieron leer las pólizas")
    policies.push(...((data || []) as unknown as PolicyRow[]))
  }

  // Una misma póliza de BSE conserva el número al renovarse: si hay varias filas,
  // nos quedamos con la de vigencia más reciente. Si apuntan a clientes distintos, es conflicto.
  const byNumber = new Map<string, PolicyRow>()
  const conflicts = new Set<string>()
  for (const policy of policies) {
    if (!policy.client) continue
    // Solo pólizas de BSE o sin aseguradora cargada. Si no encontramos BSE en el catálogo,
    // solo las sin aseguradora (nunca mezclar con otra compañía que repita el número).
    if (policy.company_id && !companyIds.includes(policy.company_id)) continue
    const current = byNumber.get(policy.numero_poliza)
    if (current && current.client?.id !== policy.client.id) conflicts.add(policy.numero_poliza)
    if (!current || (policy.vigencia_fin || "") > (current.vigencia_fin || "")) byNumber.set(policy.numero_poliza, policy)
  }

  const clientIds = [...new Set([...byNumber.values()].map((policy) => policy.client!.id))]
  const aumentos = await aumentoPorCliente(supabase, clientIds)

  // Si el export trae varias cotizaciones de la misma póliza, usamos la más nueva
  // (número de cotización más alto) para no sumar dos veces.
  const latestByPolicy = new Map<string, BseRow>()
  const deduped: BseRow[] = []
  for (const row of rows) {
    if (!row.poliza) { deduped.push(row); continue }
    const current = latestByPolicy.get(row.poliza)
    if (!current || Number(row.cotizacion) > Number(current.cotizacion)) latestByPolicy.set(row.poliza, row)
  }
  deduped.push(...latestByPolicy.values())
  const duplicated = rows.length - deduped.length

  const groups = new Map<string, ClientGroup>()
  const unmatched = new Map<string, UnmatchedGroup>()
  for (const row of deduped) {
    const policy = row.poliza && !conflicts.has(row.poliza) ? byNumber.get(row.poliza) : undefined
    if (!policy?.client) {
      const key = row.cliente || "Sin nombre"
      const group = unmatched.get(key) || { cliente_bse: key, polizas: [], cotizaciones: 0 }
      group.cotizaciones += 1
      if (row.poliza) group.polizas.push(row.poliza)
      unmatched.set(key, group)
      continue
    }
    const client = { ...policy.client, aumento_renovacion_pct: aumentos.get(policy.client.id) ?? DEFAULT_AUMENTO_PCT }
    const group = groups.get(client.id) || { client, items: [], totals: { actual: 0, propuesto: 0, variacion_pct: null } }
    group.items.push({ ...computeProposalItem(row, client.aumento_renovacion_pct), policy_id: policy.id, tipo: policy.tipo })
    groups.set(client.id, group)
  }
  for (const group of groups.values()) group.totals = proposalTotals(group.items)

  return {
    groups: [...groups.values()].sort((a, b) => a.client.nombre.localeCompare(b.client.nombre, "es")),
    unmatched: [...unmatched.values()].sort((a, b) => a.cliente_bse.localeCompare(b.cliente_bse, "es")),
    conflicts: [...conflicts],
    duplicated,
  }
}
