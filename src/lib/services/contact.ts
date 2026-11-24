import { contactSchema } from "@/lib/validation/schemas";

export type ContactResult =
  | { ok: true }
  | { ok: false; errors: Record<string, string[]>; message?: string };

/**
 * No email provider or message table exists in the plan yet. Validated messages
 * are forwarded to an optional webhook; when no webhook is configured only
 * redacted delivery metadata is logged, never the sender's PII or message body.
 */
export async function submitContact(input: unknown): Promise<ContactResult> {
  const parsed = contactSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const payload = {
    name: parsed.data.name,
    email: parsed.data.email,
    subject: parsed.data.subject,
    message: parsed.data.message,
    receivedAt: new Date().toISOString(),
  };

  const webhook = process.env.CONTACT_WEBHOOK_URL;
  if (webhook) {
    const response = await fetch(webhook, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      console.error(
        JSON.stringify({
          level: "error",
          scope: "contact_webhook",
          status: response.status,
        }),
      );
      return {
        ok: false,
        errors: {},
        message: "Could not deliver your message.",
      };
    }
  } else {
    console.info(
      JSON.stringify({
        level: "info",
        scope: "contact",
        status: "logged",
        receivedAt: payload.receivedAt,
        subjectLength: payload.subject.length,
        messageLength: payload.message.length,
      }),
    );
  }

  return { ok: true };
}
