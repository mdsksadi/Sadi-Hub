import { describe, expect, it } from "vitest";
import { contactSchema, projectSchema } from "@/lib/validation/schemas";

describe("contact validation", () => {
  it("accepts a valid message", () => {
    expect(
      contactSchema.safeParse({
        name: "Jane Doe",
        email: "jane@example.com",
        subject: "Hello",
        message: "This is a sufficiently long message.",
        website: "",
      }).success,
    ).toBe(true);
  });

  it("rejects a filled honeypot", () => {
    expect(
      contactSchema.safeParse({
        name: "Jane Doe",
        email: "jane@example.com",
        subject: "Hello",
        message: "This is a sufficiently long message.",
        website: "https://spam.example",
      }).success,
    ).toBe(false);
  });
});

describe("project validation", () => {
  const base = {
    id: null,
    title: "Example",
    slug: "example",
    shortDescription: "Short",
    descriptionMd: "Body",
    techStack: ["TypeScript"],
    githubUrl: "https://github.com/example",
    demoUrl: "",
    imagePath: "",
    startDate: "",
    completionDate: "",
    sortOrder: 0,
    isFeatured: false,
    isPublished: true,
  };

  it("accepts a valid project", () => {
    expect(projectSchema.safeParse(base).success).toBe(true);
  });

  it("rejects malformed slugs and javascript URLs", () => {
    expect(projectSchema.safeParse({ ...base, slug: "Bad Slug" }).success).toBe(
      false,
    );
    expect(
      projectSchema.safeParse({ ...base, demoUrl: "javascript:alert(1)" })
        .success,
    ).toBe(false);
  });
});
