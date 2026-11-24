export type Money = { amount: number; currency: string };

/**
 * Format a single amount in its own currency. Never sum values from different
 * currencies: consolidated reporting uses snapshotted exchange rates instead.
 */
export function formatMoney(
  amount: number,
  currency: string,
  locale = "en-US",
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currency.toUpperCase(),
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatMoneyRange(
  values: Money[],
  locale = "en-US",
): string | null {
  if (values.length === 0) return null;
  const [first] = values;
  const sameCurrency = values.every((v) => v.currency === first.currency);
  if (!sameCurrency) {
    // Intentionally no conversion here: rates must be snapshotted by the
    // financial module before any cross-currency total is presented.
    return values
      .map((v) => formatMoney(v.amount, v.currency, locale))
      .join(" + ");
  }
  return formatMoney(
    values.reduce((sum, v) => sum + v.amount, 0),
    first.currency,
    locale,
  );
}
