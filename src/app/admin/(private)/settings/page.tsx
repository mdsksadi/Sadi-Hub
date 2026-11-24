import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requireOwner } from "@/lib/auth/owner";
import { getOwnerSettings } from "@/lib/data/settings";
import { MfaPanel } from "./mfa-panel";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Settings",
  robots: { index: false },
};

export default async function AdminSettingsPage() {
  const owner = await requireOwner();
  const settings = await getOwnerSettings(owner.userId);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-2">
          Account preferences and MFA enforcement.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Reporting preferences</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3 text-sm">
          <Badge>
            Reporting currency: {settings?.reporting_currency ?? "EUR"}
          </Badge>
          <Badge>Locale: {settings?.locale ?? "en-US"}</Badge>
          <Badge>Date format: {settings?.date_format ?? "YYYY-MM-DD"}</Badge>
          <Badge>MFA enforced: {settings?.mfa_enforced ? "Yes" : "No"}</Badge>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Multi-factor authentication</CardTitle>
        </CardHeader>
        <CardContent>
          <MfaPanel />
        </CardContent>
      </Card>
    </div>
  );
}
