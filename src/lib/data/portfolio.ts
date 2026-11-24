import { bySortOrder } from "@/lib/domain/portfolio";
import { createClient } from "@/lib/supabase/server";
import type {
  Certification,
  Education,
  Experience,
  PortfolioProject,
  PublicProfile,
  Skill,
  SocialLink,
} from "../../../types/supabase";

async function logDataError(scope: string, message: string): Promise<void> {
  console.error(JSON.stringify({ level: "error", scope, message }));
}

export async function getPublicProfile(): Promise<PublicProfile | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("public_profiles_v")
    .select("*")
    .limit(1)
    .maybeSingle();
  if (error) await logDataError("public_profile", error.message);
  return data ?? null;
}

/**
 * Resolves the current resume object path through a narrow SECURITY DEFINER RPC.
 * The path stays out of public_profiles_v and out of rendered HTML.
 */
export async function getResumeObjectPath(): Promise<string | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("get_resume_path");
  if (error) await logDataError("resume_path", error.message);
  return typeof data === "string" && data.length > 0 ? data : null;
}

export async function getPublicProjects(
  featuredOnly = false,
): Promise<PortfolioProject[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  let query = supabase
    .from("portfolio_projects")
    .select("*")
    .is("deleted_at", null)
    .eq("is_published", true)
    .order("sort_order", { ascending: true });
  if (featuredOnly) query = query.eq("is_featured", true);
  const { data, error } = await query;
  if (error) {
    await logDataError("public_projects", error.message);
    return [];
  }
  return bySortOrder(data ?? []);
}

export async function getPublicProjectBySlug(
  slug: string,
): Promise<PortfolioProject | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("portfolio_projects")
    .select("*")
    .eq("slug", slug)
    .eq("is_published", true)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) await logDataError("public_project", error.message);
  return data ?? null;
}

export async function getPublicExperiences(): Promise<Experience[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("experiences")
    .select("*")
    .eq("is_published", true)
    .is("deleted_at", null)
    .order("sort_order", { ascending: false });
  if (error) await logDataError("public_experiences", error.message);
  return bySortOrder(data ?? []);
}

export async function getPublicEducation(): Promise<Education[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("education")
    .select("*")
    .eq("is_published", true)
    .is("deleted_at", null)
    .order("sort_order", { ascending: false });
  if (error) await logDataError("public_education", error.message);
  return bySortOrder(data ?? []);
}

export async function getPublicSkills(): Promise<Skill[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("skills")
    .select("*")
    .eq("is_published", true)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true });
  if (error) await logDataError("public_skills", error.message);
  return bySortOrder(data ?? []);
}

export async function getPublicCertifications(): Promise<Certification[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("certifications")
    .select("*")
    .eq("is_published", true)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true });
  if (error) await logDataError("public_certifications", error.message);
  return bySortOrder(data ?? []);
}

export async function getPublicSocialLinks(): Promise<SocialLink[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("social_links")
    .select("*")
    .eq("is_published", true)
    .order("sort_order", { ascending: true });
  if (error) await logDataError("public_social_links", error.message);
  return bySortOrder(data ?? []);
}

export async function getOwnerProfile(userId: string) {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (error) await logDataError("owner_profile", error.message);
  return data ?? null;
}

export type OwnerPortfolio = {
  projects: PortfolioProject[];
  experiences: Experience[];
  education: Education[];
  skills: Skill[];
  certifications: Certification[];
  socialLinks: SocialLink[];
};

/** Full (including drafts) portfolio for the authenticated owner. */
export async function getOwnerPortfolio(
  ownerId: string,
): Promise<OwnerPortfolio> {
  const supabase = await createClient();
  const empty: OwnerPortfolio = {
    projects: [],
    experiences: [],
    education: [],
    skills: [],
    certifications: [],
    socialLinks: [],
  };
  if (!supabase) return empty;

  const [
    projects,
    experiences,
    education,
    skills,
    certifications,
    socialLinks,
  ] = await Promise.all([
    supabase
      .from("portfolio_projects")
      .select("*")
      .eq("owner_id", ownerId)
      .is("deleted_at", null),
    supabase
      .from("experiences")
      .select("*")
      .eq("owner_id", ownerId)
      .is("deleted_at", null),
    supabase
      .from("education")
      .select("*")
      .eq("owner_id", ownerId)
      .is("deleted_at", null),
    supabase
      .from("skills")
      .select("*")
      .eq("owner_id", ownerId)
      .is("deleted_at", null),
    supabase
      .from("certifications")
      .select("*")
      .eq("owner_id", ownerId)
      .is("deleted_at", null),
    supabase.from("social_links").select("*").eq("owner_id", ownerId),
  ]);

  for (const result of [
    projects,
    experiences,
    education,
    skills,
    certifications,
    socialLinks,
  ]) {
    if (result.error)
      await logDataError("owner_portfolio", result.error.message);
  }

  return {
    projects: bySortOrder(projects.data ?? []),
    experiences: bySortOrder(experiences.data ?? []),
    education: bySortOrder(education.data ?? []),
    skills: bySortOrder(skills.data ?? []),
    certifications: bySortOrder(certifications.data ?? []),
    socialLinks: bySortOrder(socialLinks.data ?? []),
  };
}
