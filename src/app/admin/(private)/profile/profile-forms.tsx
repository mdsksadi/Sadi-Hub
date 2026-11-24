"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/field";
import type { Profile } from "../../../../../types/supabase";
import type { FormState } from "@/lib/validation/schemas";
import { updateProfile, uploadAvatar, uploadResume } from "./actions";

const initial: FormState = { status: "idle" };

function Result({ state }: { state: FormState }) {
  if (!state.message) return null;
  return (
    <p
      role="status"
      className={
        state.status === "error"
          ? "text-danger text-sm"
          : "text-primary text-sm"
      }
    >
      {state.message}
    </p>
  );
}

export function ProfileForms({ profile }: { profile: Profile | null }) {
  const [details, detailsAction, detailsPending] = useActionState(
    updateProfile,
    initial,
  );
  const [resume, resumeAction, resumePending] = useActionState(
    uploadResume,
    initial,
  );
  const [avatar, avatarAction, avatarPending] = useActionState(
    uploadAvatar,
    initial,
  );

  return (
    <div className="space-y-8">
      <form action={detailsAction} className="max-w-2xl space-y-4">
        <div>
          <Label htmlFor="displayName">Display name</Label>
          <Input
            id="displayName"
            name="displayName"
            defaultValue={profile?.display_name}
            required
          />
        </div>
        <div>
          <Label htmlFor="headline">Headline</Label>
          <Input
            id="headline"
            name="headline"
            defaultValue={profile?.headline ?? ""}
          />
        </div>
        <div>
          <Label htmlFor="location">Location</Label>
          <Input
            id="location"
            name="location"
            defaultValue={profile?.location ?? ""}
          />
        </div>
        <div>
          <Label htmlFor="timezone">Timezone</Label>
          <Input
            id="timezone"
            name="timezone"
            defaultValue={profile?.timezone ?? "UTC"}
            required
          />
        </div>
        <div>
          <Label htmlFor="bioMd">Bio (Markdown)</Label>
          <Textarea
            id="bioMd"
            name="bioMd"
            rows={10}
            defaultValue={profile?.bio_md ?? ""}
          />
        </div>
        <Button type="submit" disabled={detailsPending}>
          {detailsPending ? "Saving…" : "Save profile"}
        </Button>
        <Result state={details} />
      </form>

      <div className="grid gap-6 md:grid-cols-2">
        <form action={resumeAction} className="space-y-3">
          <Label htmlFor="resume">Resume PDF</Label>
          <p className="text-muted-foreground text-xs">
            {profile?.resume_path
              ? "A resume is currently published."
              : "No resume uploaded yet."}
          </p>
          <Input
            id="resume"
            name="resume"
            type="file"
            accept="application/pdf"
            required
          />
          <Button type="submit" disabled={resumePending}>
            {resumePending ? "Uploading…" : "Upload resume"}
          </Button>
          <Result state={resume} />
        </form>

        <form action={avatarAction} className="space-y-3">
          <Label htmlFor="avatar">Avatar image</Label>
          <Input
            id="avatar"
            name="avatar"
            type="file"
            accept="image/*"
            required
          />
          <Button type="submit" disabled={avatarPending}>
            {avatarPending ? "Uploading…" : "Upload avatar"}
          </Button>
          <Result state={avatar} />
        </form>
      </div>
    </div>
  );
}
