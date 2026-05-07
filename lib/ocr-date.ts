const pad2 = (value: number) => String(value).padStart(2, "0");

const normalizeYear = (value: string) => {
  const year = Number(value);
  if (value.length === 2) return year >= 70 ? 1900 + year : 2000 + year;
  return year;
};

const isValidDateParts = (year: number, month: number, day: number) => {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  if (year < 1900 || year > 2200 || month < 1 || month > 12 || day < 1 || day > 31) return false;

  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
};

const toIsoDate = (year: number, month: number, day: number) => {
  if (!isValidDateParts(year, month, day)) return null;
  return `${year}-${pad2(month)}-${pad2(day)}`;
};

export function normalizeOcrDate(value: unknown, fallback = "") {
  if (value === null || value === undefined || value === "") return fallback;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return toIsoDate(value.getFullYear(), value.getMonth() + 1, value.getDate()) ?? fallback;
  }

  const raw = String(value).trim();
  if (!raw) return fallback;

  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    return toIsoDate(Number(iso[1]), Number(iso[2]), Number(iso[3])) ?? fallback;
  }

  const yearFirst = raw.match(/^(\d{4})[/.](\d{1,2})[/.](\d{1,2})$/);
  if (yearFirst) {
    return toIsoDate(Number(yearFirst[1]), Number(yearFirst[2]), Number(yearFirst[3])) ?? fallback;
  }

  const dayFirst = raw.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2}|\d{4})$/);
  if (dayFirst) {
    const day = Number(dayFirst[1]);
    const month = Number(dayFirst[2]);
    const year = normalizeYear(dayFirst[3]);

    return toIsoDate(year, month, day) ?? fallback;
  }

  return fallback;
}
