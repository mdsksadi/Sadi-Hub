/** Converts Supabase's TOTP QR SVG into an inert data URL for `<img src>`. */
export function qrSvgToDataUrl(svg: string): string {
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
