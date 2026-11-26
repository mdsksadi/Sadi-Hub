import { getOwnerContext } from "@/lib/auth/owner";
import { exportFilename, sanitizePdfText } from "@/lib/domain/exports";
import {
  ExportError,
  getOwnerReportData,
  resolveReport,
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

  let kind: "monthly" | "yearly";
  let range: { from: string | null; to: string | null };
  try {
    ({ kind, range } = resolveReport(new URL(request.url).searchParams));
  } catch (error) {
    if (error instanceof ExportError) {
      return json({ error: error.message }, error.status);
    }
    return json({ error: "Invalid report request." }, 400);
  }

  try {
    const data = await getOwnerReportData(owner.userId, kind, range);

    // pdf-lib is deliberately imported here: it stays out of the initial
    // Worker chunk and is only loaded when a report is requested.
    const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
    const pdf = await PDFDocument.create();
    const regular = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

    let page = pdf.addPage([595, 842]); // A4 in points
    let y = 794;
    const ink = rgb(0.1, 0.1, 0.1);

    function line(text: string, size = 11, isBold = false) {
      const safe = sanitizePdfText(text, 130);
      if (!safe) return;
      if (y < 56) {
        page = pdf.addPage([595, 842]);
        y = 794;
      }
      page.drawText(safe, {
        x: 48,
        y,
        size,
        font: isBold ? bold : regular,
        color: ink,
        maxWidth: 500,
      });
      y -= size + 8;
    }

    line(`Sadi Hub - ${kind} cashflow report`, 18, true);
    line(`Range: ${range.from ?? "start"} to ${range.to ?? "today"}`);
    line(`Generated: ${new Date().toISOString().slice(0, 10)}`, 9);
    line("Amounts are grouped by original currency", 12, true);

    if (data.summary.length === 0) {
      line("No cashflow or donations recorded in this range.");
    } else {
      for (const row of data.summary) {
        line(
          `${row.currency}: income ${row.income.toFixed(2)} | expense ${row.expense.toFixed(2)} | net ${row.net.toFixed(2)} | donations ${row.donations.toFixed(2)}`,
        );
      }
    }

    line(
      `${data.cashflowMonths} cashflow rows and ${data.donationCount} donations included.`,
      9,
    );
    line("Disclosure", 12, true);
    line(
      "EUR and BDT are never summed. Each currency is reported separately.",
      9,
    );
    line(
      "Translated values use snapshotted exchange rates recorded with each transaction; they are not converted again here.",
      9,
    );
    line(
      "Donations are already expenses in the cashflow view, so they are shown separately and are not added to totals.",
      9,
    );

    const bytes = await pdf.save();
    const filename = exportFilename(
      kind,
      range.to ?? new Date().toISOString().slice(0, 10),
      "pdf",
    );

    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return json({ error: "Could not generate the report." }, 500);
  }
}
