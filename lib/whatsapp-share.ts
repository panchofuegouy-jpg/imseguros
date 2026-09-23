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
