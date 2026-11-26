import { getOwnerContext } from "@/lib/auth/owner";
import {
  ExportError,
  exportOwnerCsv,
  parseCsvRange,
  parseCsvResource,
} from "@/lib/services/exports";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE = "private, no-store, max-age=0";

function json(body: object, status: number) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": NO_STORE },
  });
}

export async function GET(request: Request) {
  const owner = await getOwnerContext();
  if (!owner) return json({ error: "Unauthorized" }, 401);

  try {
    const params = new URL(request.url).searchParams;
    const resource = parseCsvResource(params.get("resource"));
    const range = parseCsvRange(params);
    const result = await exportOwnerCsv(owner.userId, resource, range);

    return new Response(result.body, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${result.filename}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof ExportError) {
      return json({ error: error.message }, error.status);
    }
    return json({ error: "Export failed." }, 500);
  }
}
