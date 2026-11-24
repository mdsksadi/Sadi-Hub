"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";
import type { EnrollmentFormState } from "@/lib/auth/mfa-state";

type Props = {
  startAction: (state: EnrollmentFormState) => Promise<EnrollmentFormState>;
  confirmAction: (
    state: EnrollmentFormState,
    formData: FormData,
  ) => Promise<EnrollmentFormState>;
};

const initial: EnrollmentFormState = { status: "idle" };

export function MfaEnrollForm({ startAction, confirmAction }: Props) {
  const [enrollment, start, startPending] = useActionState(
    startAction,
    initial,
  );
  const [confirmation, confirm, confirmPending] = useActionState(
    confirmAction,
    initial,
  );
  const state = confirmation.status === "error" ? confirmation : enrollment;

  return (
    <div className="space-y-4">
      {state.message && (
        <p
          role={state.status === "error" ? "alert" : "status"}
          className={
            state.status === "error"
              ? "text-danger text-sm"
              : "text-primary text-sm"
          }
        >
          {state.message}
        </p>
      )}

      {!enrollment.qrCode && (
        <form action={start}>
          <Button type="submit" disabled={startPending}>
            {startPending ? "Preparing…" : "Enroll an authenticator app"}
          </Button>
        </form>
      )}

      {enrollment.qrCode && (
        <div className="space-y-4">
          {/* QR SVG is encoded as a data URL by the server action. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={enrollment.qrCode}
            alt="Authenticator app QR code"
            width={180}
            height={180}
            className="w-fit rounded-lg border bg-white p-3"
          />
          {enrollment.secret && (
            <p className="text-muted-foreground text-xs break-all">
              Manual setup key: <code>{enrollment.secret}</code>
            </p>
          )}
          <form action={confirm} className="max-w-xs space-y-3">
            <input type="hidden" name="factorId" value={enrollment.factorId} />
            <input
              type="hidden"
              name="challengeId"
              value={enrollment.challengeId}
            />
            <div>
              <Label htmlFor="mfa-code">Code from app</Label>
              <Input
                id="mfa-code"
                name="code"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                required
              />
            </div>
            <Button type="submit" disabled={confirmPending}>
              {confirmPending ? "Verifying…" : "Verify enrollment"}
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}
