export function formText(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export function formOptionalText(
  formData: FormData,
  key: string,
): string | null {
  const value = formText(formData, key);
  return value.length > 0 ? value : null;
}

export function formInteger(
  formData: FormData,
  key: string,
  fallback = 0,
): number {
  const value = formText(formData, key);
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function formBoolean(formData: FormData, key: string): boolean {
  const value = formData.get(key);
  return value === "on" || value === "true" || value === "1";
}

export function formList(formData: FormData, key: string): string[] {
  return formText(formData, key)
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function formId(formData: FormData): string | null {
  const value = formText(formData, "id");
  return /^[0-9a-f-]{36}$/i.test(value) ? value : null;
}

/** All values from repeated checkboxes with the same name. */
export function formIds(formData: FormData, key: string): string[] {
  return formData
    .getAll(key)
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter((value) => /^[0-9a-f-]{36}$/i.test(value));
}

/** HTML datetime-local values are already validated by the Zod schema. */
export function formDateTime(formData: FormData, key: string): string {
  return formText(formData, key);
}
