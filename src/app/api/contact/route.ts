import { NextResponse } from "next/server";
import { submitContact } from "@/lib/services/contact";

export const dynamic = "force-dynamic";

function json(body: object, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body." }, 400);
  }

  const result = await submitContact(body);
  if (!result.ok) {
    return json(
      {
        error: result.message ?? "Please check the form and try again.",
        errors: result.errors,
      },
      422,
    );
  }
  return json({ ok: true });
}
