import { getResumeObjectPath } from "@/lib/data/portfolio";
import { createClient } from "@/lib/supabase/server";
import { PRIVATE_BUCKET } from "@/lib/supabase/storage";

export const dynamic = "force-dynamic";

export async function GET() {
  const resumePath = await getResumeObjectPath();
  if (!resumePath) {
    return new Response("Resume not available", { status: 404 });
  }

  const supabase = await createClient();
  if (!supabase) return new Response("Storage unavailable", { status: 503 });

  const { data, error } = await supabase.storage
    .from(PRIVATE_BUCKET)
    .download(resumePath);
  if (error || !data) {
    return new Response("Resume not available", { status: 404 });
  }

  return new Response(data, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="resume.pdf"',
      "Cache-Control": "public, max-age=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
