import Link from "next/link";
import type { ReactNode } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { requireOwner } from "@/lib/auth/owner";
import { signOut } from "../login/actions";

export const dynamic = "force-dynamic";

const links = [
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/profile", label: "Profile" },
  { href: "/admin/portfolio", label: "Portfolio" },
  { href: "/admin/blog", label: "Blog" },
];

const financeLinks = [
  { href: "/admin/finance", label: "Overview" },
  { href: "/admin/finance/accounts", label: "Accounts" },
  { href: "/admin/finance/categories", label: "Categories" },
  { href: "/admin/finance/transactions", label: "Transactions" },
  { href: "/admin/finance/transfers", label: "Transfers" },
  { href: "/admin/finance/contacts", label: "Contacts" },
  { href: "/admin/finance/lending", label: "Lending" },
  { href: "/admin/finance/borrowing", label: "Borrowing" },
  { href: "/admin/finance/donations", label: "Donations" },
  { href: "/admin/finance/reports", label: "Reports" },
  { href: "/admin/finance/rates", label: "Exchange rates" },
];

const recordLinks = [
  { href: "/admin/property", label: "Property" },
  { href: "/admin/documents", label: "Documents" },
  { href: "/admin/audit-logs", label: "Audit logs" },
];

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const owner = await requireOwner();

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <aside className="no-print bg-card border-b p-4 lg:w-64 lg:border-r lg:border-b-0">
        <div className="mb-6">
          <Link href="/" className="text-lg font-semibold">
            Sadi Hub
          </Link>
          <p className="text-muted-foreground text-xs">Private admin</p>
        </div>
        <nav aria-label="Admin navigation">
          <ul className="space-y-1 text-sm">
            {links.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="text-muted-foreground hover:bg-muted hover:text-foreground block rounded-md px-3 py-2"
                >
                  {link.label}
                </Link>
              </li>
            ))}
            <li className="pt-2">
              <Link
                href="/admin/finance"
                className="hover:bg-muted block rounded-md px-3 py-2 font-medium"
              >
                Finance
              </Link>
              <ul className="ml-3 space-y-1 border-l pl-3">
                {financeLinks.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-muted-foreground hover:bg-muted hover:text-foreground block rounded-md px-2 py-1.5 text-xs"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </li>
            <li>
              <Link
                href="/admin/settings"
                className="text-muted-foreground hover:bg-muted hover:text-foreground block rounded-md px-3 py-2"
              >
                Settings &amp; MFA
              </Link>
            </li>
            {recordLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="text-muted-foreground hover:bg-muted hover:text-foreground block rounded-md px-3 py-2"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print bg-card flex items-center gap-3 border-b px-4 py-3">
          <div className="ml-auto text-right text-xs">
            <p className="font-medium">{owner.displayName}</p>
            <p className="text-muted-foreground">{owner.email}</p>
          </div>
          <ThemeToggle />
          <form action={signOut}>
            <Button type="submit" variant="outline" size="sm">
              Sign out
            </Button>
          </form>
        </header>
        <main className="flex-1 p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
