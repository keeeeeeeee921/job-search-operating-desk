import type { ReactNode } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

const navigation = [
  { href: "/active", label: "Active" },
  { href: "/rejected", label: "Rejected" },
  { href: "/search", label: "Search" },
  { href: "/update-by-email", label: "Update by Email" }
];

export function AppShell({
  currentPath,
  children
}: {
  currentPath: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-white/70 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-5">
          <Link
            className="rounded-2xl px-2 py-1 transition hover:bg-white/70"
            href="/"
          >
            <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
              Job Search Operating Desk
            </p>
            <p className="mt-1 text-lg font-semibold text-foreground">
              Personal job search workspace
            </p>
          </Link>
          <nav className="flex items-center gap-2 rounded-full border border-border bg-white/70 px-2 py-2 shadow-soft">
            {navigation.map((item) => {
              const active = currentPath === item.href;
              return (
                <Link
                  className={cn(
                    "rounded-full px-4 py-2 text-sm transition",
                    active
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-surface hover:text-foreground"
                  )}
                  href={item.href}
                  key={item.href}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="hidden items-center gap-2 rounded-full border border-border bg-white/80 px-3 py-2 text-sm text-muted-foreground shadow-soft lg:flex">
            <Search className="size-4" />
            Search only scans Active records
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1400px] px-6 py-8">{children}</main>
    </div>
  );
}
