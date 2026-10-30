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

  // ImageResponse no lee webp: el logo de Isgleas va en una copia png.
  const toDataUrl = async (file: string) =>
    `data:image/png;base64,${(await readFile(path.join(process.cwd(), "public", file))).toString("base64")}`
  const [imLogo, isgleasLogo] = await Promise.all([
    toDataUrl("IM_IDEINTIDAD-LOGO.png"),
    toDataUrl("nuevo-logo-isgleas-seguros.png"),
  ])

  // WhatsApp recorta los costados de la vista previa: todo va centrado en el medio de la imagen.
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#102a2c",
          color: "#ffffff",
          fontFamily: "sans-serif",
          textAlign: "center",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 36 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imLogo} alt="" width={170} height={80} />
          <div style={{ width: 2, height: 72, background: "#3c5a5c" }} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={isgleasLogo} alt="" width={219} height={80} />
        </div>
        <div style={{ width: 80, height: 4, background: "#a8844a", marginTop: 36, marginBottom: 28 }} />
        <div style={{ fontSize: 32, color: "#b9cfcf" }}>
          {cantidad === 1 ? "Tu póliza vigente" : cantidad > 1 ? `Tus ${cantidad} pólizas vigentes` : "Tus pólizas"}
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            maxWidth: 640,
            fontSize: nombre.length > 18 ? 52 : 64,
            lineHeight: 1.15,
            marginTop: 10,
          }}
        >
          {nombre || "IM Seguros"}
        </div>
      </div>
    ),
    size,
  )
}
