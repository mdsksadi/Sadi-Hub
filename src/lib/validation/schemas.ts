import { z } from "zod";
import { isValidSlug } from "@/lib/domain/slug";
import { safeExternalUrl } from "@/lib/utils";

const url = z
  .string()
  .max(500)
  .refine(
    (value) => value === "" || safeExternalUrl(value) !== null,
    "Enter a valid URL",
  );

const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .or(z.literal(""));

export const loginSchema = z.object({
  email: z.string().trim().email().max(200),
  password: z.string().min(12).max(200),
});

export const mfaSchema = z.object({
  factorId: z.string().uuid(),
  challengeId: z.string().uuid(),
  code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code"),
});

export const mfaEnrollSchema = z.object({
  factorId: z.string().uuid(),
  code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code"),
});

export const contactSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(200),
  subject: z.string().trim().min(2).max(150),
  message: z.string().trim().min(10).max(5000),
  website: z.string().max(0), // honeypot: must stay empty
});

export const profileSchema = z.object({
  displayName: z.string().trim().min(1).max(100),
  headline: z.string().trim().max(200),
  bioMd: z.string().trim().max(20000),
  location: z.string().trim().max(120),
  timezone: z.string().trim().min(1).max(80),
});

export const projectSchema = z.object({
  id: z.string().uuid().nullable(),
  title: z.string().trim().min(1).max(150),
  slug: z
    .string()
    .trim()
    .min(1)
    .refine(isValidSlug, "Use lowercase letters, numbers and single hyphens"),
  shortDescription: z.string().trim().max(300),
  descriptionMd: z.string().trim().max(20000),
  techStack: z.array(z.string().trim().min(1).max(60)).max(30),
  githubUrl: url,
  demoUrl: url,
  imagePath: z.string().trim().max(300),
  startDate: date,
  completionDate: date,
  sortOrder: z.number().int().min(-1000).max(1000),
  isFeatured: z.boolean(),
  isPublished: z.boolean(),
});

export const experienceSchema = z.object({
  id: z.string().uuid().nullable(),
  company: z.string().trim().min(1).max(150),
  position: z.string().trim().min(1).max(150),
  startDate: date,
  endDate: date,
  isCurrent: z.boolean(),
  responsibilities: z.array(z.string().trim().min(1).max(500)).max(30),
  technologies: z.array(z.string().trim().min(1).max(60)).max(30),
  sortOrder: z.number().int().min(-1000).max(1000),
  isPublished: z.boolean(),
});

export const educationSchema = z.object({
  id: z.string().uuid().nullable(),
  institution: z.string().trim().min(1).max(150),
  degree: z.string().trim().min(1).max(150),
  fieldOfStudy: z.string().trim().max(150),
  startDate: date,
  endDate: date,
  descriptionMd: z.string().trim().max(10000),
  sortOrder: z.number().int().min(-1000).max(1000),
  isPublished: z.boolean(),
});

export const skillSchema = z.object({
  id: z.string().uuid().nullable(),
  name: z.string().trim().min(1).max(100),
  category: z.string().trim().min(1).max(100),
  proficiency: z.number().int().min(0).max(5),
  icon: z.string().trim().max(100),
  sortOrder: z.number().int().min(-1000).max(1000),
  isPublished: z.boolean(),
});

export const certificationSchema = z.object({
  id: z.string().uuid().nullable(),
  name: z.string().trim().min(1).max(150),
  issuer: z.string().trim().min(1).max(150),
  issuedOn: date,
  expiresOn: date,
  credentialUrl: url,
  sortOrder: z.number().int().min(-1000).max(1000),
  isPublished: z.boolean(),
});

export const socialLinkSchema = z.object({
  id: z.string().uuid().nullable(),
  platform: z.string().trim().min(1).max(50),
  url: url.refine((value) => value.length > 0, "Enter a URL"),
  sortOrder: z.number().int().min(-1000).max(1000),
  isPublished: z.boolean(),
});

const localDateTime = z
  .string()
  .trim()
  .refine(
    (value) =>
      value === "" ||
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})?$/.test(
        value,
      ),
    "Use a valid date and time",
  );

export const postSchema = z
  .object({
    id: z.string().uuid().nullable(),
    title: z.string().trim().min(1).max(200),
    slug: z
      .string()
      .trim()
      .min(1)
      .refine(isValidSlug, "Use lowercase letters, numbers and single hyphens"),
    excerpt: z.string().trim().max(300),
    contentMd: z.string().max(100000),
    titleEn: z.string().trim().max(200).optional(),
    excerptEn: z.string().trim().max(300).optional(),
    contentMdEn: z.string().max(100000).optional(),
    coverPath: z.string().trim().max(300),
    status: z.enum(["draft", "scheduled", "published", "archived"]),
    publishedAt: localDateTime,
    scheduledFor: localDateTime,
    seoTitle: z.string().trim().max(200),
    seoDescription: z.string().trim().max(300),
    isFeatured: z.boolean(),
    categoryId: z.union([z.string().uuid(), z.literal("")]),
    tagIds: z.array(z.string().uuid()).max(12),
  })
  .superRefine((value, ctx) => {
    if (value.status === "scheduled" && !value.scheduledFor) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["scheduledFor"],
        message: "Scheduled posts need a date and time",
      });
    }
    if (value.status === "published" && !value.publishedAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["publishedAt"],
        message: "Published posts need a date and time",
      });
    }
  });

export const blogCategorySchema = z.object({
  id: z.string().uuid().nullable(),
  name: z.string().trim().min(1).max(100),
  slug: z
    .string()
    .trim()
    .min(1)
    .refine(isValidSlug, "Use lowercase letters, numbers and single hyphens"),
  description: z.string().trim().max(300),
});

export const blogTagSchema = z.object({
  id: z.string().uuid().nullable(),
  name: z.string().trim().min(1).max(60),
  slug: z
    .string()
    .trim()
    .min(1)
    .refine(isValidSlug, "Use lowercase letters, numbers and single hyphens"),
});

export type PostInput = z.infer<typeof postSchema>;
export type BlogCategoryInput = z.infer<typeof blogCategorySchema>;
export type BlogTagInput = z.infer<typeof blogTagSchema>;

export type FormState = {
  status: "idle" | "success" | "error";
  message?: string;
};
