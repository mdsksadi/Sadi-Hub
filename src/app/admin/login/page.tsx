import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Admin sign in",
  robots: { index: false },
};

type Props = { searchParams: Promise<{ reason?: string }> };

export default async function LoginPage({ searchParams }: Props) {
  const { reason } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Admin sign in</CardTitle>
          <p className="text-muted-foreground text-sm">
            Single-owner access. MFA is required.
          </p>
        </CardHeader>
        <CardContent>
          <LoginForm reason={reason} />
        </CardContent>
      </Card>
    </main>
  );
}
