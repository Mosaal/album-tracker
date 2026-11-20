/**
 * Reads a year from a file: a whole number from 1000 to 9999, or text that
 * starts with one, like "1959" or "1959-08-17". Anything else isn't a year.
 */
export function toYear(value: unknown): number | undefined {
  const year =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(/^\s*(\d{4})(?!\d)/.exec(value)?.[1])
        : NaN;
  return Number.isInteger(year) && year >= 1000 && year <= 9999
    ? year
    : undefined;
}

/** The decade a year is in, by its first year: 1950 for 1959. */
export const decadeOf = (year: number) => Math.floor(year / 10) * 10;
