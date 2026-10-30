import { formatDate } from "@/lib/format"

export function generateWhatsAppPolicyLink(
  clientPhone: string | undefined,
  clientName: string,
  policyNumber: string,
  policyType: string,
  endDate: string,
  policyFileUrl: string | undefined
): string | null {
  if (!clientPhone) return null;

  const digits = clientPhone.replace(/\D/g, "");
  if (!digits) return null;

  const local = digits.startsWith("598")
    ? digits
    : digits.startsWith("0")
      ? "598" + digits.slice(1)
      : "598" + digits;

  const phone = local;
  const expirationFormatted = formatDate(endDate);

  let message = `Hola ${clientName},\n\nAdjunto póliza N° ${policyNumber}\nTipo: ${policyType}\nVigente hasta: ${expirationFormatted}`;

  if (policyFileUrl) {
    message += `\n\nDescargar: ${policyFileUrl}`;
  }

  message += "\n\nSaludos, Isgleas Seguros.";

  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

export function generateWhatsAppBirthdayLink(
  clientPhone: string | undefined | null,
  clientName: string,
  brokerName = "Isgleas Seguros"
): string | null {
  if (!clientPhone) return null;

  const digits = clientPhone.replace(/\D/g, "");
  if (!digits) return null;

  const phone = digits.startsWith("598")
    ? digits
    : digits.startsWith("0")
      ? "598" + digits.slice(1)
      : "598" + digits;

  const firstName = clientName.trim().split(/\s+/)[0];
  const message = `¡Feliz cumpleaños, ${firstName}! 🎉\n\nQue tengas un día espectacular. Te mandamos un saludo muy especial de parte de todo el equipo.\n\nUn abrazo, ${brokerName}.`;

  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

/** Número en formato internacional de Uruguay para wa.me (sin + ni espacios). */
export function toWhatsAppPhone(clientPhone: string | undefined | null): string | null {
  const digits = clientPhone?.replace(/\D/g, "")
  if (!digits) return null
  return digits.startsWith("598") ? digits : digits.startsWith("0") ? "598" + digits.slice(1) : "598" + digits
}

/** Aviso de vencimiento para pedirle al cliente que renueve. */
export function generateWhatsAppRenewalLink(params: {
  phone: string | undefined | null
  clientName: string
  policyNumber: string
  policyType?: string | null
  companyName?: string | null
  daysLeft: number
  expirationLabel: string
}): string | null {
  const phone = toWhatsAppPhone(params.phone)
  if (!phone) return null

  const detail = [params.policyType, params.companyName].filter(Boolean).join(" - ")
  const when =
    params.daysLeft > 0
      ? `vence en ${params.daysLeft} días (${params.expirationLabel})`
      : `venció el ${params.expirationLabel}`
  const message = `Estimado/a ${params.clientName}, le informamos que su póliza N° ${params.policyNumber}${
    detail ? ` (${detail})` : ""
  } ${when}. Por favor contáctenos para proceder con la renovación. Gracias, Isgleas Seguros.`

  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
}

/** Todas las pólizas vigentes del cliente en un solo mensaje, cada una con su PDF. */
export function generateWhatsAppPoliciesLink(params: {
  phone: string | undefined | null
  clientName: string
  policies: {
    numero_poliza: string
    notas?: string | null
    companyName?: string | null
    vigencia_fin: string
    fileUrl?: string | null
  }[]
}): string {
  const lines = params.policies.map((p) => {
    // Las notas cargadas desde el BSE traen «vehículo · cobertura · póliza anterior»: alcanza con lo primero.
    const detail = [p.notas?.split(" · ")[0], p.companyName].filter(Boolean).join(" - ")
    let line = `• Póliza ${p.numero_poliza}${detail ? ` (${detail})` : ""}, vigente hasta ${formatDate(p.vigencia_fin)}`
    if (p.fileUrl) line += `\n  ${p.fileUrl}`
    return line
  })
  const message = `Hola ${params.clientName.trim()},\n\nTe enviamos tus pólizas vigentes:\n\n${lines.join("\n\n")}\n\nSaludos, Isgleas Seguros.`

  // Sin teléfono, wa.me deja elegir el contacto.
  const phone = toWhatsAppPhone(params.phone)
  return `https://wa.me/${phone ?? ""}?text=${encodeURIComponent(message)}`
}
