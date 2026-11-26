/** Converts a TOTP QR payload into an inert data URL for `<img src>`. */
export function qrSvgToDataUrl(svg: string): string {
  const value = svg.trim();

  // Supabase GoTrue already returns `qr_code` as an SVG data URL. Wrapping that
  // in another data URL produces an unusable nested URL, so pass it through.
  if (/^data:image\/svg\+xml[;,]/i.test(value)) {
    return value;
  }

  return `data:image/svg+xml,${encodeURIComponent(value)}`;
}
