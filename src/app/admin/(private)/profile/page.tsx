import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireOwner } from "@/lib/auth/owner";
import { getOwnerProfile } from "@/lib/data/portfolio";
import { ProfileForms } from "./profile-forms";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Profile",
  robots: { index: false },
};

export default async function AdminProfilePage() {
  const owner = await requireOwner();
  const profile = await getOwnerProfile(owner.userId);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Profile</h1>
        <p className="text-muted-foreground mt-2">
          Public biographical information and files.
        </p>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>Edit profile</CardTitle>
        </CardHeader>
        <CardContent>
          <ProfileForms profile={profile} />
        </CardContent>
      </Card>
    </div>
  );
}
