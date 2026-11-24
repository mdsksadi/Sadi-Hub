import type { FormState } from "@/lib/validation/schemas";

export type EnrollmentFormState = FormState & {
  qrCode?: string;
  secret?: string;
  factorId?: string;
  challengeId?: string;
};
