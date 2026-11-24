"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";
import { signIn, verifyMfa, type LoginState } from "./actions";

const initial: LoginState = { status: "idle" };

const reasonMessages: Record<string, string> = {
  unauthorized: "Please sign in to continue.",
  mfa: "Authenticator verification is required.",
  setup: "Enroll an authenticator app to finish first-time setup.",
  config: "Supabase environment variables are missing.",
};

export function LoginForm({ reason }: { reason?: string }) {
  const [passwordState, passwordAction, passwordPending] = useActionState(
    signIn,
    initial,
  );
  const [mfaState, mfaAction, mfaPending] = useActionState(verifyMfa, initial);

  const challenge = passwordState.factorId && passwordState.challengeId;
  const error =
    mfaState.status === "error" ? mfaState.message : passwordState.message;
  const notice = reason ? reasonMessages[reason] : undefined;

  return (
    <div className="space-y-6">
      {notice && <p className="bg-muted rounded-md p-3 text-sm">{notice}</p>}
      {!challenge ? (
        <form action={passwordAction} className="space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="username"
            />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              minLength={12}
              autoComplete="current-password"
            />
          </div>
          <Button type="submit" className="w-full" disabled={passwordPending}>
            {passwordPending ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      ) : (
        <form action={mfaAction} className="space-y-4">
          <input type="hidden" name="factorId" value={passwordState.factorId} />
          <input
            type="hidden"
            name="challengeId"
            value={passwordState.challengeId}
          />
          <p className="text-muted-foreground text-sm">
            Enter the current 6-digit code from your authenticator app.
          </p>
          <div>
            <Label htmlFor="code">Authenticator code</Label>
            <Input
              id="code"
              name="code"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              autoComplete="one-time-code"
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={mfaPending}>
            {mfaPending ? "Verifying…" : "Verify and continue"}
          </Button>
        </form>
      )}
      {error && (
        <p role="alert" className="text-danger text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
