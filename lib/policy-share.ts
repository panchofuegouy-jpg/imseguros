import { createAdminClient } from "@/lib/supabase/server"
import { readPoliciesShareToken } from "@/lib/share-link"

// Un link puede ser de todas las pólizas vigentes del cliente (token firmado) o de
// una selección de pólizas (token «l-…», guardado en policy_share_links).
export async function resolvePoliciesShare(token: string): Promise<{ clientId: string; policyIds?: string[] } | null> {
  if (!token.startsWith("l-")) {
    const clientId = readPoliciesShareToken(token)
    return clientId ? { clientId } : null
  }
  const { data } = await createAdminClient()
    .from("policy_share_links")
    .select("client_id, policy_ids")
    .eq("token", token)
    .maybeSingle()
  return data ? { clientId: data.client_id, policyIds: data.policy_ids } : null
}
