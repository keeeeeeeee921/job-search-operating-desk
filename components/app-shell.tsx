import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const navigation = [
  { href: "/active", label: "Active" },
  { href: "/rejected", label: "Rejected" },
  { href: "/search-log", label: "Search Log" },
  { href: "/update-by-email", label: "Email Match" }
];

export function AppShell({
  currentPath,
  children
}: {
  currentPath: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto grid max-w-[1400px] gap-4 px-4 py-3 sm:px-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <Link
            className="group flex w-fit max-w-full min-w-0 origin-left items-center gap-3 rounded-2xl py-1 outline-none transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] active:scale-[0.985] active:duration-100 motion-reduce:transform-none motion-reduce:transition-none"
            href="/"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-foreground text-sm font-semibold text-background transition-[transform,background-color,box-shadow] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-translate-y-0.5 group-hover:bg-accent group-hover:shadow-[0_10px_22px_-14px_hsl(var(--accent)/0.75)] group-focus-visible:ring-2 group-focus-visible:ring-accent/50 group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-surface group-active:translate-y-0 group-active:scale-[0.94] group-active:duration-100 motion-reduce:transform-none motion-reduce:transition-none">
              JD
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-foreground sm:text-base">
                Job Search Operating Desk
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                A focused workspace for a truthful job search
              </span>
            </span>
          </Link>
          <nav className="grid grid-cols-2 gap-1 rounded-2xl border border-border bg-muted p-1 sm:flex sm:w-fit sm:flex-wrap sm:items-center lg:flex-nowrap lg:rounded-full" aria-label="Primary navigation">
            {navigation.map((item) => {
              const active = currentPath === item.href;
              return (
                <Link
                  className={cn(
                    "rounded-xl px-3 py-2 text-center text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45 focus-visible:ring-offset-2 focus-visible:ring-offset-surface sm:rounded-full",
                    active
                      ? "bg-foreground text-background"
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
        </div>
      </header>
      <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  );
}
