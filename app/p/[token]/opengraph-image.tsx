import { ImageResponse } from "next/og"
import { readFile } from "fs/promises"
import path from "path"
import { createAdminClient } from "@/lib/supabase/server"
import { readPoliciesShareToken } from "@/lib/share-link"

// Vista previa del link (WhatsApp, etc.): logo de IM Seguros y nombre del cliente.

export const runtime = "nodejs"
export const alt = "Tus pólizas · IM Seguros"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default async function Image({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const clientId = readPoliciesShareToken(token)

  let nombre = ""
  let cantidad = 0
  if (clientId) {
    const supabase = createAdminClient()
    const today = new Date().toISOString().slice(0, 10)
    const [{ data: client }, { count }] = await Promise.all([
      supabase.from("clients").select("nombre").eq("id", clientId).single(),
      supabase.from("policies").select("id", { count: "exact", head: true }).eq("client_id", clientId).gte("vigencia_fin", today),
    ])
    nombre = client?.nombre ?? ""
    cantidad = count ?? 0
  }

  const logo = await readFile(path.join(process.cwd(), "public", "IM_IDEINTIDAD-LOGO.png"))
  const logoSrc = `data:image/png;base64,${logo.toString("base64")}`

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#102a2c",
          padding: "64px 72px",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoSrc} alt="" width={234} height={110} />
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ width: 96, height: 4, background: "#a8844a", marginBottom: 28 }} />
          <div style={{ fontSize: 34, color: "#b9cfcf" }}>
            {cantidad === 1 ? "Tu póliza vigente" : cantidad > 1 ? `Tus ${cantidad} pólizas vigentes` : "Tus pólizas"}
          </div>
          <div style={{ fontSize: nombre.length > 28 ? 60 : 76, fontWeight: 700, lineHeight: 1.1, marginTop: 8 }}>
            {nombre || "IM Seguros"}
          </div>
        </div>
        <div style={{ fontSize: 26, color: "#b9cfcf" }}>Tocá para ver y descargar los PDF · Paysandú, Uruguay</div>
      </div>
    ),
    size,
  )
}
