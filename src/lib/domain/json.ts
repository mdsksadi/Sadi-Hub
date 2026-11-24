/**
 * Serializes data for `<script type="application/ld+json">`.
 * Escaping `<` prevents an owner-edited string from closing the script tag and
 * injecting markup; U+2028/U+2029 are escaped for older JavaScript parsers.
 */
export function jsonLd(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}
