const BUCKET = 'policy-documents';

/**
 * Devuelve una URL abrible para un adjunto de póliza.
 *
 * Los adjuntos se guardaron históricamente de dos formas según el flujo que los
 * creó: la carga manual guarda la URL pública completa, mientras que la carga
 * masiva con OCR guardaba sólo la ruta dentro del bucket ("<clientId>/x.pdf").
 * Una ruta suelta puesta en un href se resuelve relativa a la página actual y
 * termina en un 404, así que acá la completamos.
 *
 * Es equivalente a supabase.storage.from(BUCKET).getPublicUrl(path), pero sin
 * necesitar una instancia del cliente, para poder usarla también en componentes
 * que no la tienen.
 */
export function resolvePolicyFileUrl(value: string): string {
  if (!value) return value;
  if (/^https?:\/\//i.test(value)) return value;

  const path = value.replace(/^\/+/, '');
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, '');

  // Sin la URL base no podemos armar nada mejor que el valor original.
  if (!base) return value;

  return `${base}/storage/v1/object/public/${BUCKET}/${path}`;
}
