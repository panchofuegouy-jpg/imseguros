export function generateWhatsAppPolicyLink(
  clientPhone: string | undefined,
  clientName: string,
  policyNumber: string,
  policyType: string,
  endDate: string,
  policyId: string | undefined
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
  const expirationFormatted = new Date(endDate).toLocaleDateString("es-ES");

  let message = `Hola ${clientName},\n\nAdjunto póliza N° ${policyNumber}\nTipo: ${policyType}\nVigente hasta: ${expirationFormatted}`;

  if (policyId) {
    const baseUrl = typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_APP_URL || "https://app.imseguros.com";
    const shortLink = `${baseUrl}/p/${policyId}`;
    message += `\n\nDescargar: ${shortLink}`;
  }

  message += "\n\nSaludos, IM Seguros.";

  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}
