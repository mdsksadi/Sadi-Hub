"use client";

import { MfaEnrollForm } from "@/components/mfa-enroll-form";
import { confirmEnrollment, startEnrollment } from "./actions";

export function MfaPanel() {
  return (
    <MfaEnrollForm
      startAction={startEnrollment}
      confirmAction={confirmEnrollment}
    />
  );
}
