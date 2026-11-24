import type { Metadata } from "next";
import { ModelForm, type FieldConfig } from "@/components/admin/model-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireOwner } from "@/lib/auth/owner";
import { getOwnerPortfolio } from "@/lib/data/portfolio";
import {
  deleteCertification,
  deleteEducation,
  deleteExperience,
  deleteProject,
  deleteSkill,
  deleteSocialLink,
  saveCertification,
  saveEducation,
  saveExperience,
  saveProject,
  saveSkill,
  saveSocialLink,
} from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Portfolio",
  robots: { index: false },
};

const common: FieldConfig[] = [
  { name: "sortOrder", label: "Sort order", type: "number" },
  { name: "isPublished", label: "Published", type: "checkbox" },
];

const projectFields: FieldConfig[] = [
  { name: "title", label: "Title", required: true },
  {
    name: "slug",
    label: "Slug",
    hint: "Lowercase letters, numbers and hyphens",
    required: true,
  },
  {
    name: "shortDescription",
    label: "Short description",
    type: "textarea",
    rows: 2,
  },
  {
    name: "descriptionMd",
    label: "Description (Markdown)",
    type: "textarea",
    rows: 5,
  },
  { name: "techStack", label: "Tech stack", hint: "Comma-separated" },
  { name: "githubUrl", label: "GitHub URL", type: "url" },
  { name: "demoUrl", label: "Demo URL", type: "url" },
  {
    name: "imagePath",
    label: "Image storage path",
    hint: "portfolio bucket path",
  },
  { name: "startDate", label: "Start date", type: "date" },
  { name: "completionDate", label: "Completion date", type: "date" },
  { name: "isFeatured", label: "Featured", type: "checkbox" },
  ...common,
];

const experienceFields: FieldConfig[] = [
  { name: "company", label: "Company", required: true },
  { name: "position", label: "Position", required: true },
  { name: "startDate", label: "Start date", type: "date" },
  { name: "endDate", label: "End date", type: "date" },
  {
    name: "responsibilities",
    label: "Responsibilities",
    type: "textarea",
    hint: "Comma-separated",
  },
  { name: "technologies", label: "Technologies", hint: "Comma-separated" },
  { name: "isCurrent", label: "Current role", type: "checkbox" },
  ...common,
];

const educationFields: FieldConfig[] = [
  { name: "institution", label: "Institution", required: true },
  { name: "degree", label: "Degree", required: true },
  { name: "fieldOfStudy", label: "Field of study" },
  { name: "startDate", label: "Start date", type: "date" },
  { name: "endDate", label: "End date", type: "date" },
  { name: "descriptionMd", label: "Description (Markdown)", type: "textarea" },
  ...common,
];

const skillFields: FieldConfig[] = [
  { name: "name", label: "Name", required: true },
  { name: "category", label: "Category", required: true },
  { name: "proficiency", label: "Proficiency (1-5)", type: "number" },
  { name: "icon", label: "Icon" },
  ...common,
];

const certificationFields: FieldConfig[] = [
  { name: "name", label: "Name", required: true },
  { name: "issuer", label: "Issuer", required: true },
  { name: "issuedOn", label: "Issued on", type: "date" },
  { name: "expiresOn", label: "Expires on", type: "date" },
  { name: "credentialUrl", label: "Credential URL", type: "url" },
  ...common,
];

const socialFields: FieldConfig[] = [
  { name: "platform", label: "Platform", required: true },
  { name: "url", label: "URL", type: "url", required: true },
  ...common,
];

const dateOnly = (value: string | null) => value?.slice(0, 10) ?? "";
const listText = (values: string[]) => values.join(", ");

function Editor<T extends { id: string; is_published: boolean }>({
  title,
  label,
  fields,
  action,
  deleteAction,
  items,
  toInitial,
}: {
  title: string;
  label: (item: T) => string;
  fields: FieldConfig[];
  action: (
    state: import("@/lib/validation/schemas").FormState,
    formData: FormData,
  ) => Promise<import("@/lib/validation/schemas").FormState>;
  deleteAction: (formData: FormData) => Promise<void>;
  items: T[];
  toInitial: (item: T) => Record<string, string | number | boolean>;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle>
          {title}{" "}
          <span className="text-muted-foreground text-sm font-normal">
            ({items.length})
          </span>
        </CardTitle>
        <Badge>Published rows are public</Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        {items.length === 0 && (
          <p className="text-muted-foreground text-sm">Nothing added yet.</p>
        )}
        {items.map((item) => (
          <details key={item.id} className="rounded-lg border p-3">
            <summary className="flex cursor-pointer items-center justify-between text-sm font-medium">
              <span>{label(item)}</span>
              <span
                className={
                  item.is_published ? "text-primary" : "text-muted-foreground"
                }
              >
                {item.is_published ? "Published" : "Draft"}
              </span>
            </summary>
            <div className="pt-4">
              <ModelForm
                action={action}
                fields={fields}
                initial={toInitial(item)}
                submitLabel="Save changes"
              />
              <form action={deleteAction} className="mt-3">
                <input type="hidden" name="id" value={item.id} />
                <Button type="submit" variant="danger" size="sm">
                  {title === "Social links" ? "Delete" : "Archive"}
                </Button>
              </form>
            </div>
          </details>
        ))}
        <details className="rounded-lg border border-dashed p-3">
          <summary className="cursor-pointer text-sm font-medium">
            + Add {title.toLowerCase().replace(/s$/, "")}
          </summary>
          <div className="pt-4">
            <ModelForm action={action} fields={fields} submitLabel="Create" />
          </div>
        </details>
      </CardContent>
    </Card>
  );
}

export default async function AdminPortfolioPage() {
  const owner = await requireOwner();
  const data = await getOwnerPortfolio(owner.userId);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Portfolio</h1>
        <p className="text-muted-foreground mt-2">
          Manage public content. Drafts and archived rows stay invisible to
          visitors.
        </p>
      </header>

      <Editor
        title="Projects"
        label={(item) => item.title}
        fields={projectFields}
        action={saveProject}
        deleteAction={deleteProject}
        items={data.projects}
        toInitial={(item) => ({
          id: item.id,
          title: item.title,
          slug: item.slug,
          shortDescription: item.short_description ?? "",
          descriptionMd: item.description_md ?? "",
          techStack: listText(item.tech_stack),
          githubUrl: item.github_url ?? "",
          demoUrl: item.demo_url ?? "",
          imagePath: item.image_path ?? "",
          startDate: dateOnly(item.start_date),
          completionDate: dateOnly(item.completion_date),
          sortOrder: item.sort_order,
          isFeatured: item.is_featured,
          isPublished: item.is_published,
        })}
      />

      <Editor
        title="Experience"
        label={(item) => `${item.position} — ${item.company}`}
        fields={experienceFields}
        action={saveExperience}
        deleteAction={deleteExperience}
        items={data.experiences}
        toInitial={(item) => ({
          id: item.id,
          company: item.company,
          position: item.position,
          startDate: dateOnly(item.start_date),
          endDate: dateOnly(item.end_date),
          responsibilities: listText(item.responsibilities),
          technologies: listText(item.technologies),
          sortOrder: item.sort_order,
          isCurrent: item.is_current,
          isPublished: item.is_published,
        })}
      />

      <Editor
        title="Education"
        label={(item) => `${item.degree} — ${item.institution}`}
        fields={educationFields}
        action={saveEducation}
        deleteAction={deleteEducation}
        items={data.education}
        toInitial={(item) => ({
          id: item.id,
          institution: item.institution,
          degree: item.degree,
          fieldOfStudy: item.field_of_study ?? "",
          startDate: dateOnly(item.start_date),
          endDate: dateOnly(item.end_date),
          descriptionMd: item.description_md ?? "",
          sortOrder: item.sort_order,
          isPublished: item.is_published,
        })}
      />

      <Editor
        title="Skills"
        label={(item) => `${item.name} (${item.category})`}
        fields={skillFields}
        action={saveSkill}
        deleteAction={deleteSkill}
        items={data.skills}
        toInitial={(item) => ({
          id: item.id,
          name: item.name,
          category: item.category,
          proficiency: item.proficiency ?? 0,
          icon: item.icon ?? "",
          sortOrder: item.sort_order,
          isPublished: item.is_published,
        })}
      />

      <Editor
        title="Certifications"
        label={(item) => item.name}
        fields={certificationFields}
        action={saveCertification}
        deleteAction={deleteCertification}
        items={data.certifications}
        toInitial={(item) => ({
          id: item.id,
          name: item.name,
          issuer: item.issuer,
          issuedOn: dateOnly(item.issued_on),
          expiresOn: dateOnly(item.expires_on),
          credentialUrl: item.credential_url ?? "",
          sortOrder: item.sort_order,
          isPublished: item.is_published,
        })}
      />

      <Editor
        title="Social links"
        label={(item) => item.platform}
        fields={socialFields}
        action={saveSocialLink}
        deleteAction={deleteSocialLink}
        items={data.socialLinks}
        toInitial={(item) => ({
          id: item.id,
          platform: item.platform,
          url: item.url,
          sortOrder: item.sort_order,
          isPublished: item.is_published,
        })}
      />
    </div>
  );
}
