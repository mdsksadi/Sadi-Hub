import { NextResponse } from "next/server";
import { getOwnerContext } from "@/lib/auth/owner";
import { getDocument } from "@/lib/data/documents";
import { PRIVATE_BUCKET, signedObjectUrl } from "@/lib/supabase/storage";

export const dynamic = "force-dynamic";

const NO_STORE = "private, no-store, max-age=0, must-revalidate";

function json(body: object, status: number) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": NO_STORE },
  });
}

type Context = { params: Promise<{ id: string }> };

/** Owner-checked redirect to a short-lived signed URL for a private object. */
export async function GET(_request: Request, { params }: Context) {
  const owner = await getOwnerContext();
  if (!owner) return json({ error: "Unauthorized." }, 401);

  const { id } = await params;
  const document = await getDocument(owner.userId, id);
  if (!document) return json({ error: "Document not found." }, 404);

  const url = await signedObjectUrl(PRIVATE_BUCKET, document.storage_path, 120);
  if (!url) {
    return json({ error: "The download link is unavailable. Try again." }, 503);
  }

  const response = NextResponse.redirect(url, 302);
  response.headers.set("Cache-Control", NO_STORE);
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
