import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Markdown } from "@/components/markdown";
import { jsonLd } from "@/lib/domain/json";
import { qrSvgToDataUrl } from "@/lib/security/mfa";

describe("structured data", () => {
  it("escapes script-breaking characters in JSON-LD", () => {
    const output = jsonLd({ name: "</script><img onerror=alert(1)>" });
    expect(output).not.toContain("</script>");
    expect(output).toContain("\\u003c");
  });
});

describe("markdown rendering", () => {
  it("sanitizes HTML and unsafe links", () => {
    const { container } = render(
      <Markdown
        source={
          'Hello\n\n<script>alert("x")</script>\n\n[bad](javascript:alert(1))'
        }
      />,
    );
    expect(container.querySelector("script")).toBeNull();
    expect(
      screen.getByText("bad").closest("a")?.getAttribute("href"),
    ).toBeNull();
  });

  it("renders GFM tables", () => {
    render(<Markdown source={"| A | B |\n| - | - |\n| 1 | 2 |"} />);
    expect(screen.getByRole("table")).toBeTruthy();
  });
});

describe("MFA QR rendering", () => {
  it("encodes SVG as an inert data URL", () => {
    const dataUrl = qrSvgToDataUrl('<svg onload="alert(1)"></svg>');
    expect(dataUrl.startsWith("data:image/svg+xml,")).toBe(true);
    expect(dataUrl).not.toContain("<svg");
  });
});
