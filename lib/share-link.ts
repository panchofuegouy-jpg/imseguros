import { createHmac, timingSafeEqual } from "crypto"

// Link público de las pólizas de un cliente: /p/<id del cliente en base64url>.<firma>.
// La firma (HMAC con un secreto del servidor) hace que el link no se pueda adivinar
// ni armar a mano para otro cliente, sin necesidad de guardar nada en la base.

function secret() {
  const value = process.env.SHARE_LINK_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!value) throw new Error("Falta SHARE_LINK_SECRET para firmar los links")
  return value
}

const sign = (id: string) => createHmac("sha256", secret()).update(`polizas:${id}`).digest("base64url").slice(0, 12)

export function createPoliciesShareToken(clientId: string) {
  const id = Buffer.from(clientId.replace(/-/g, ""), "hex").toString("base64url")
  return `${id}.${sign(clientId)}`
}

/** Devuelve el id del cliente si el token es válido; si no, null. */
export function readPoliciesShareToken(token: string): string | null {
  const [id, signature] = token.split(".")
  if (!id || !signature) return null
  const hex = Buffer.from(id, "base64url").toString("hex")
  if (hex.length !== 32) return null
  const clientId = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
  const expected = Buffer.from(sign(clientId))
  const given = Buffer.from(signature)
  return expected.length === given.length && timingSafeEqual(expected, given) ? clientId : null
}
