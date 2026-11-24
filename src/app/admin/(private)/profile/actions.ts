"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth/owner";
import { createClient } from "@/lib/supabase/server";
import {
  PUBLIC_BUCKET,
  PRIVATE_BUCKET,
  storagePathFor,
} from "@/lib/supabase/storage";
import { formText } from "@/lib/validation/forms";
import { profileSchema, type FormState } from "@/lib/validation/schemas";

const MAX_PDF = 10 * 1024 * 1024;
const MAX_IMAGE = 5 * 1024 * 1024;

function refreshPublicPages() {
  for (const path of [
    "/",
    "/about",
    "/resume",
    "/projects",
    "/experience",
    "/education",
    "/skills",
  ]) {
    revalidatePath(path);
  }
}

export async function updateProfile(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  const owner = await requireOwner();
  const parsed = profileSchema.safeParse({
    displayName: formText(formData, "displayName"),
    headline: formText(formData, "headline"),
    bioMd: formText(formData, "bioMd"),
    location: formText(formData, "location"),
    timezone: formText(formData, "timezone"),
  });
  if (!parsed.success)
    return { status: "error", message: "Check the profile fields." };

  const supabase = await createClient(true);
  if (!supabase)
    return { status: "error", message: "Storage is not configured." };

  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: parsed.data.displayName,
      headline: parsed.data.headline || null,
      bio_md: parsed.data.bioMd || null,
      location: parsed.data.location || null,
      timezone: parsed.data.timezone,
    })
    .eq("id", owner.userId);

  if (error) return { status: "error", message: "Could not save the profile." };
  refreshPublicPages();
  revalidatePath("/admin/profile");
  return { status: "success", message: "Profile saved." };
}

export async function uploadResume(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  const owner = await requireOwner();
  const file = formData.get("resume");
  if (!(file instanceof File) || file.size === 0) {
    return { status: "error", message: "Choose a PDF file." };
  }
  if (file.type !== "application/pdf" || file.size > MAX_PDF) {
    return {
      status: "error",
      message: "The resume must be a PDF under 10 MiB.",
    };
  }

  const supabase = await createClient(true);
  if (!supabase)
    return { status: "error", message: "Storage is not configured." };

  const { data: current } = await supabase
    .from("profiles")
    .select("resume_path")
    .eq("id", owner.userId)
    .maybeSingle();

  const path = storagePathFor(owner.userId, `resume-${file.name}`);
  const { error: uploadError } = await supabase.storage
    .from(PRIVATE_BUCKET)
    .upload(path, file, { contentType: "application/pdf", upsert: false });
  if (uploadError)
    return { status: "error", message: "Could not upload the resume." };

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ resume_path: path, resume_updated_at: new Date().toISOString() })
    .eq("id", owner.userId);

  if (updateError) {
    await supabase.storage.from(PRIVATE_BUCKET).remove([path]);
    return { status: "error", message: "Could not link the uploaded resume." };
  }

  if (current?.resume_path) {
    await supabase.storage.from(PRIVATE_BUCKET).remove([current.resume_path]);
  }
  refreshPublicPages();
  revalidatePath("/admin/profile");
  return { status: "success", message: "Resume uploaded." };
}

export async function uploadAvatar(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  const owner = await requireOwner();
  const file = formData.get("avatar");
  if (!(file instanceof File) || file.size === 0) {
    return { status: "error", message: "Choose an image." };
  }
  if (!file.type.startsWith("image/") || file.size > MAX_IMAGE) {
    return {
      status: "error",
      message: "The avatar must be an image under 5 MiB.",
    };
  }

  const supabase = await createClient(true);
  if (!supabase)
    return { status: "error", message: "Storage is not configured." };

  const path = storagePathFor(owner.userId, `avatar-${file.name}`);
  const { error: uploadError } = await supabase.storage
    .from(PUBLIC_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError)
    return { status: "error", message: "Could not upload the avatar." };

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ avatar_path: path })
    .eq("id", owner.userId);
  if (updateError) {
    await supabase.storage.from(PUBLIC_BUCKET).remove([path]);
    return { status: "error", message: "Could not link the uploaded avatar." };
  }
  refreshPublicPages();
  revalidatePath("/admin/profile");
  return { status: "success", message: "Avatar uploaded." };
}
