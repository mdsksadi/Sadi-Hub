/**
 * Convert database/RPC errors into short, non-sensitive UI messages. Raw
 * SQLSTATE text and stack details are never returned to the browser.
 */
export function friendlyRpcError(error: unknown, fallback: string): string {
  const raw = error instanceof Error ? error.message : String(error);

  if (/not authorized|insufficient privileges/i.test(raw)) {
    return "You are not authorized to perform this action.";
  }
  if (/insufficient balance/i.test(raw)) {
    return "Insufficient balance in the selected account.";
  }
  if (/exchange rate/i.test(raw)) {
    return "No snapshotted exchange rate covers that date. Add one under Finance → Exchange rates.";
  }
  if (/overpayment|exceeds/i.test(raw)) {
    return "The amount exceeds the outstanding balance.";
  }
  if (/cancelled/i.test(raw)) {
    return "Cancelled records cannot be changed.";
  }
  if (/immutable|cannot be (updated|deleted)/i.test(raw)) {
    return "This record is immutable; use a correction instead.";
  }
  if (/not found/i.test(raw)) {
    return "The selected record no longer exists. Refresh and try again.";
  }
  return fallback;
}
