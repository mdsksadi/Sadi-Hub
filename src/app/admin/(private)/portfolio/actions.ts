"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth/owner";
import { createClient } from "@/lib/supabase/server";
import {
  formBoolean,
  formId,
  formInteger,
  formList,
  formText,
} from "@/lib/validation/forms";
import {
  certificationSchema,
  educationSchema,
  experienceSchema,
  projectSchema,
  skillSchema,
  socialLinkSchema,
  type FormState,
} from "@/lib/validation/schemas";

const PUBLIC_PATHS = [
  "/",
  "/about",
  "/experience",
  "/education",
  "/skills",
  "/projects",
  "/resume",
  "/sitemap.xml",
];

function refresh() {
  revalidatePath("/admin/portfolio");
  for (const path of PUBLIC_PATHS) revalidatePath(path);
}

function refreshProjectPaths(slugs: Array<string | null | undefined>) {
  refresh();
  for (const slug of new Set(
    slugs.filter((value): value is string => !!value),
  )) {
    revalidatePath(`/projects/${slug}`, "page");
  }
}

function failure(message: string): FormState {
  return { status: "error", message };
}

function success(message: string): FormState {
  refresh();
  return { status: "success", message };
}

function conflictMessage(code: string | undefined, fallback: string): string {
  return code === "23505" ? "That slug or value is already in use." : fallback;
}

export async function saveProject(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  const owner = await requireOwner();
  const parsed = projectSchema.safeParse({
    id: formId(formData),
    title: formText(formData, "title"),
    slug: formText(formData, "slug"),
    shortDescription: formText(formData, "shortDescription"),
    descriptionMd: formText(formData, "descriptionMd"),
    techStack: formList(formData, "techStack"),
    githubUrl: formText(formData, "githubUrl"),
    demoUrl: formText(formData, "demoUrl"),
    imagePath: formText(formData, "imagePath"),
    startDate: formText(formData, "startDate"),
    completionDate: formText(formData, "completionDate"),
    sortOrder: formInteger(formData, "sortOrder"),
    isFeatured: formBoolean(formData, "isFeatured"),
    isPublished: formBoolean(formData, "isPublished"),
  });
  if (!parsed.success)
    return failure("Check the project fields, especially the slug.");

  const supabase = await createClient(true);
  if (!supabase) return failure("Supabase is not configured.");
  const d = parsed.data;
  const row = {
    title: d.title,
    slug: d.slug,
    short_description: d.shortDescription || null,
    description_md: d.descriptionMd || null,
    tech_stack: d.techStack,
    github_url: d.githubUrl || null,
    demo_url: d.demoUrl || null,
    image_path: d.imagePath || null,
    start_date: d.startDate || null,
    completion_date: d.completionDate || null,
    sort_order: d.sortOrder,
    is_featured: d.isFeatured,
    is_published: d.isPublished,
  };

  let oldSlug: string | null = null;
  if (d.id) {
    const { data: existing } = await supabase
      .from("portfolio_projects")
      .select("slug")
      .eq("id", d.id)
      .eq("owner_id", owner.userId)
      .maybeSingle();
    oldSlug = existing?.slug ?? null;
  }

  const result = d.id
    ? await supabase
        .from("portfolio_projects")
        .update(row)
        .eq("id", d.id)
        .eq("owner_id", owner.userId)
    : await supabase
        .from("portfolio_projects")
        .insert({ ...row, owner_id: owner.userId });
  if (result.error) {
    return failure(
      conflictMessage(result.error.code, "Could not save the project."),
    );
  }

  refreshProjectPaths([oldSlug, d.slug]);
  return { status: "success", message: "Project saved." };
}

export async function saveExperience(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  const owner = await requireOwner();
  const parsed = experienceSchema.safeParse({
    id: formId(formData),
    company: formText(formData, "company"),
    position: formText(formData, "position"),
    startDate: formText(formData, "startDate"),
    endDate: formText(formData, "endDate"),
    isCurrent: formBoolean(formData, "isCurrent"),
    responsibilities: formList(formData, "responsibilities"),
    technologies: formList(formData, "technologies"),
    sortOrder: formInteger(formData, "sortOrder"),
    isPublished: formBoolean(formData, "isPublished"),
  });
  if (!parsed.success) return failure("Check the experience fields.");

  const supabase = await createClient(true);
  if (!supabase) return failure("Supabase is not configured.");
  const d = parsed.data;
  const row = {
    company: d.company,
    position: d.position,
    start_date: d.startDate || null,
    end_date: d.endDate || null,
    is_current: d.isCurrent,
    responsibilities: d.responsibilities,
    technologies: d.technologies,
    sort_order: d.sortOrder,
    is_published: d.isPublished,
  };
  const result = d.id
    ? await supabase
        .from("experiences")
        .update(row)
        .eq("id", d.id)
        .eq("owner_id", owner.userId)
    : await supabase
        .from("experiences")
        .insert({ ...row, owner_id: owner.userId });
  return result.error
    ? failure("Could not save the experience.")
    : success("Experience saved.");
}

export async function saveEducation(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  const owner = await requireOwner();
  const parsed = educationSchema.safeParse({
    id: formId(formData),
    institution: formText(formData, "institution"),
    degree: formText(formData, "degree"),
    fieldOfStudy: formText(formData, "fieldOfStudy"),
    startDate: formText(formData, "startDate"),
    endDate: formText(formData, "endDate"),
    descriptionMd: formText(formData, "descriptionMd"),
    sortOrder: formInteger(formData, "sortOrder"),
    isPublished: formBoolean(formData, "isPublished"),
  });
  if (!parsed.success) return failure("Check the education fields.");

  const supabase = await createClient(true);
  if (!supabase) return failure("Supabase is not configured.");
  const d = parsed.data;
  const row = {
    institution: d.institution,
    degree: d.degree,
    field_of_study: d.fieldOfStudy || null,
    start_date: d.startDate || null,
    end_date: d.endDate || null,
    description_md: d.descriptionMd || null,
    sort_order: d.sortOrder,
    is_published: d.isPublished,
  };
  const result = d.id
    ? await supabase
        .from("education")
        .update(row)
        .eq("id", d.id)
        .eq("owner_id", owner.userId)
    : await supabase
        .from("education")
        .insert({ ...row, owner_id: owner.userId });
  return result.error
    ? failure("Could not save the education entry.")
    : success("Education saved.");
}

export async function saveSkill(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  const owner = await requireOwner();
  const parsed = skillSchema.safeParse({
    id: formId(formData),
    name: formText(formData, "name"),
    category: formText(formData, "category"),
    proficiency: formInteger(formData, "proficiency"),
    icon: formText(formData, "icon"),
    sortOrder: formInteger(formData, "sortOrder"),
    isPublished: formBoolean(formData, "isPublished"),
  });
  if (!parsed.success) return failure("Check the skill fields.");

  const supabase = await createClient(true);
  if (!supabase) return failure("Supabase is not configured.");
  const d = parsed.data;
  const row = {
    name: d.name,
    category: d.category,
    proficiency: d.proficiency === 0 ? null : d.proficiency,
    icon: d.icon || null,
    sort_order: d.sortOrder,
    is_published: d.isPublished,
  };
  const result = d.id
    ? await supabase
        .from("skills")
        .update(row)
        .eq("id", d.id)
        .eq("owner_id", owner.userId)
    : await supabase.from("skills").insert({ ...row, owner_id: owner.userId });
  return result.error
    ? failure("Could not save the skill.")
    : success("Skill saved.");
}

export async function saveCertification(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  const owner = await requireOwner();
  const parsed = certificationSchema.safeParse({
    id: formId(formData),
    name: formText(formData, "name"),
    issuer: formText(formData, "issuer"),
    issuedOn: formText(formData, "issuedOn"),
    expiresOn: formText(formData, "expiresOn"),
    credentialUrl: formText(formData, "credentialUrl"),
    sortOrder: formInteger(formData, "sortOrder"),
    isPublished: formBoolean(formData, "isPublished"),
  });
  if (!parsed.success) return failure("Check the certification fields.");

  const supabase = await createClient(true);
  if (!supabase) return failure("Supabase is not configured.");
  const d = parsed.data;
  const row = {
    name: d.name,
    issuer: d.issuer,
    issued_on: d.issuedOn || null,
    expires_on: d.expiresOn || null,
    credential_url: d.credentialUrl || null,
    sort_order: d.sortOrder,
    is_published: d.isPublished,
  };
  const result = d.id
    ? await supabase
        .from("certifications")
        .update(row)
        .eq("id", d.id)
        .eq("owner_id", owner.userId)
    : await supabase
        .from("certifications")
        .insert({ ...row, owner_id: owner.userId });
  return result.error
    ? failure("Could not save the certification.")
    : success("Certification saved.");
}

export async function saveSocialLink(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  const owner = await requireOwner();
  const parsed = socialLinkSchema.safeParse({
    id: formId(formData),
    platform: formText(formData, "platform").toLowerCase(),
    url: formText(formData, "url"),
    sortOrder: formInteger(formData, "sortOrder"),
    isPublished: formBoolean(formData, "isPublished"),
  });
  if (!parsed.success) return failure("Check the social link fields.");

  const supabase = await createClient(true);
  if (!supabase) return failure("Supabase is not configured.");
  const d = parsed.data;
  const row = {
    platform: d.platform,
    url: d.url,
    sort_order: d.sortOrder,
    is_published: d.isPublished,
  };
  const result = d.id
    ? await supabase
        .from("social_links")
        .update(row)
        .eq("id", d.id)
        .eq("owner_id", owner.userId)
    : await supabase
        .from("social_links")
        .insert({ ...row, owner_id: owner.userId });
  return result.error
    ? failure(conflictMessage(result.error.code, "Could not save the link."))
    : success("Link saved.");
}

type SoftDeleteTable =
  | "portfolio_projects"
  | "experiences"
  | "education"
  | "skills"
  | "certifications";

async function softDelete(
  table: SoftDeleteTable,
  formData: FormData,
  isProject = false,
): Promise<void> {
  const owner = await requireOwner();
  const id = formId(formData);
  if (!id) return;
  const supabase = await createClient(true);
  if (!supabase) return;

  let slug: string | null = null;
  if (isProject) {
    const { data: existing } = await supabase
      .from("portfolio_projects")
      .select("slug")
      .eq("id", id)
      .eq("owner_id", owner.userId)
      .maybeSingle();
    slug = existing?.slug ?? null;
  }

  await supabase
    .from(table)
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("owner_id", owner.userId);

  if (isProject) refreshProjectPaths([slug]);
  else refresh();
}

export async function deleteProject(formData: FormData): Promise<void> {
  await softDelete("portfolio_projects", formData, true);
}
export async function deleteExperience(formData: FormData): Promise<void> {
  await softDelete("experiences", formData);
}
export async function deleteEducation(formData: FormData): Promise<void> {
  await softDelete("education", formData);
}
export async function deleteSkill(formData: FormData): Promise<void> {
  await softDelete("skills", formData);
}
export async function deleteCertification(formData: FormData): Promise<void> {
  await softDelete("certifications", formData);
}

export async function deleteSocialLink(formData: FormData): Promise<void> {
  const owner = await requireOwner();
  const id = formId(formData);
  if (!id) return;
  const supabase = await createClient(true);
  if (!supabase) return;
  await supabase
    .from("social_links")
    .delete()
    .eq("id", id)
    .eq("owner_id", owner.userId);
  refresh();
}
