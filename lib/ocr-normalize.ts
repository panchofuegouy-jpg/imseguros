/**
 * Normalizadores para lo que devuelve el OCR (/api/ocr/extract).
 *
 * El modelo lee el documento y contesta con texto libre ("AUTOMOTORES",
 * "PAGO CONTADO") y con importes en formato uruguayo ("53.790,00"). Los
 * formularios, en cambio, guardan valores de una lista cerrada —los <Select>—
 * y números. Sin traducir un valor al otro el <Select> se queda vacío y parece
 * que el OCR no actualizó nada, y la prima se guarda con el monto equivocado.
 */

/** Tipos de póliza que aceptan los formularios. */
export const POLICY_TYPE_OPTIONS = [
  "Auto",
  "Vida",
  "Hogar",
  "Salud",
  "Empresarial",
  "Camiones",
  "Taxi",
  "Agricola",
  "Motos",
  "Lancha",
  "Otro",
] as const;

/** Formas de pago que aceptan los formularios. */
export const PAYMENT_FREQUENCY_OPTIONS = [
  "Contado",
  "Mensual",
  "Bimestral",
  "Trimestral",
  "Semestral",
  "Anual",
] as const;

// Sinónimos con los que las aseguradoras nombran cada tipo. Se comparan contra
// el texto normalizado (sin tildes, en minúsculas) permitiendo sufijos, de modo
// que "vehiculo" también matchee "vehiculos".
const POLICY_TYPE_ALIASES: Record<string, string[]> = {
  Auto: ["auto", "automotor", "automovil", "vehiculo", "coche", "camioneta", "rc vehicular"],
  Motos: ["moto", "motocicleta", "ciclomotor", "scooter"],
  Camiones: ["camion", "carga", "transporte", "flota"],
  Taxi: ["taxi", "remise", "remis"],
  Lancha: ["lancha", "embarcacion", "nautico", "nautica", "yate"],
  Agricola: ["agricola", "agro", "tractor", "cosechadora", "maquinaria"],
  Vida: ["vida", "sepelio", "accidentes personales"],
  Hogar: ["hogar", "vivienda", "casa", "combinado familiar", "incendio"],
  Salud: ["salud", "medico", "medica", "asistencia medica", "emergencia"],
  Empresarial: ["empresarial", "empresa", "comercio", "comercial", "industria", "negocio", "integral"],
  Otro: ["otro", "otros", "varios"],
};

const PAYMENT_FREQUENCY_ALIASES: Record<string, string[]> = {
  Bimestral: ["bimestral", "bimensual"],
  Trimestral: ["trimestral"],
  Semestral: ["semestral"],
  Mensual: ["mensual", "mes", "cuota mensual"],
  Anual: ["anual", "ano", "anio"],
  Contado: ["contado", "unico", "efectivo", "cash", "1 cuota", "una cuota"],
};

const CURRENCY_ALIASES: Record<string, string[]> = {
  USD: ["usd", "u\\$s", "uss", "dolar", "dolares", "us\\$"],
  UYU: ["uyu", "\\$u", "peso", "pesos", "nacional", "\\$"],
  EUR: ["eur", "euro", "euros"],
};

/** Minúsculas, sin tildes y con los espacios colapsados. */
function normalizeText(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Busca la primera opción cuyos sinónimos aparezcan en el texto. Los alias se
 * anclan al comienzo de palabra para que "automotor" no matchee "moto".
 */
function matchByAliases(
  value: unknown,
  options: readonly string[],
  aliases: Record<string, string[]>,
  fallback: string,
): string {
  const text = normalizeText(value);
  if (!text) return fallback;

  const exact = options.find((option) => normalizeText(option) === text);
  if (exact) return exact;

  for (const option of options) {
    const matched = (aliases[option] ?? []).some((alias) =>
      new RegExp(`\\b${alias}\\w*`, "i").test(text),
    );
    if (matched) return option;
  }

  return fallback;
}

/** Traduce el tipo que leyó el OCR a una de las opciones del formulario. */
export function matchPolicyType(value: unknown, fallback = ""): string {
  return matchByAliases(value, POLICY_TYPE_OPTIONS, POLICY_TYPE_ALIASES, fallback);
}

/** Traduce la forma de pago que leyó el OCR a una opción del formulario. */
export function matchPaymentFrequency(value: unknown, fallback = ""): string {
  return matchByAliases(value, PAYMENT_FREQUENCY_OPTIONS, PAYMENT_FREQUENCY_ALIASES, fallback);
}

/** Traduce la moneda que leyó el OCR ("U$S", "$", "dólares") a UYU/USD/EUR. */
export function matchCurrency(value: unknown, fallback = ""): string {
  const text = normalizeText(value);
  if (!text) return fallback;

  for (const [code, aliases] of Object.entries(CURRENCY_ALIASES)) {
    if (aliases.some((alias) => new RegExp(alias, "i").test(text))) return code;
  }

  return fallback;
}

/**
 * Convierte un importe del OCR en número.
 *
 * Contempla las dos convenciones que aparecen en los documentos: la uruguaya
 * ("53.790,00" = 53790) y la inglesa ("53,790.00"). Cuando hay un único
 * separador se decide por la forma del número: "53.790" son miles, "53.79" son
 * decimales. Devuelve null si no hay ningún importe reconocible.
 */
export function parseOcrAmount(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;

  const raw = String(value).trim();
  const negative = /^\(.*\)$/.test(raw) || raw.includes("-");
  const cleaned = raw.replace(/[^\d.,]/g, "");
  if (!cleaned) return null;

  const hasComma = cleaned.includes(",");
  const hasDot = cleaned.includes(".");

  let normalized = cleaned;
  if (hasComma && hasDot) {
    // El separador decimal es el último que aparece.
    normalized =
      cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".")
        ? cleaned.replace(/\./g, "").replace(",", ".")
        : cleaned.replace(/,/g, "");
  } else if (hasComma) {
    normalized = /^\d{1,3}(,\d{3})+$/.test(cleaned)
      ? cleaned.replace(/,/g, "")
      : cleaned.replace(",", ".");
  } else if (hasDot) {
    // "53.790" son miles; "53.79" son decimales.
    if (/^\d{1,3}(\.\d{3})+$/.test(cleaned)) normalized = cleaned.replace(/\./g, "");
  }

  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed)) return null;

  return negative ? -Math.abs(parsed) : parsed;
}

/** Toma el primer importe no nulo entre los alias que devuelve el modelo. */
export function pickOcrAmount(extracted: any, keys: string[]): number | null {
  for (const key of keys) {
    const parsed = parseOcrAmount(extracted?.[key]);
    if (parsed !== null) return parsed;
  }
  return null;
}

/**
 * Compara dos nombres de persona tolerando tildes, mayúsculas, espacios de más
 * y el orden de apellido/nombre ("PEREZ JUAN" ≡ "Juan Pérez").
 */
export function isSameName(a: unknown, b: unknown): boolean {
  const words = (value: unknown) =>
    normalizeText(value)
      .replace(/[^a-z0-9 ]/g, " ")
      .split(" ")
      .filter(Boolean)
      .sort();

  const left = words(a);
  const right = words(b);
  if (!left.length || !right.length) return false;

  return left.join(" ") === right.join(" ");
}

/**
 * Resuelve la aseguradora del documento contra las cargadas en la base. El
 * modelo suele devolver el UUID, pero también puede contestar con el nombre.
 */
export function matchCompanyId(
  extracted: any,
  companies: Array<{ id: string; name: string }>,
  fallback = "",
): string {
  const raw =
    extracted?.company_id ??
    extracted?.aseguradora ??
    extracted?.compania ??
    extracted?.company ??
    extracted?.nombre_aseguradora;
  if (!raw) return fallback;

  if (companies.some((company) => company.id === raw)) return String(raw);

  const text = normalizeText(raw);
  if (!text) return fallback;

  const exact = companies.find((company) => normalizeText(company.name) === text);
  if (exact) return exact.id;

  const partial = companies.find((company) => {
    const name = normalizeText(company.name);
    return name.length > 2 && (text.includes(name) || name.includes(text));
  });

  return partial ? partial.id : fallback;
}
