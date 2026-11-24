/** Structured data-layer logging. Never log row contents or PII. */
export function logDataError(scope: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  console.error(JSON.stringify({ level: "error", scope, message }));
}
