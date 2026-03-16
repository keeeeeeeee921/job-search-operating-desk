import Link from "next/link";
import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { cn } from "@/lib/utils";

const sections = [
  { href: "/design-lab/home", label: "Home" },
  { href: "/design-lab/active", label: "Active" }
];

export function DesignLabShell({
  currentSection,
  title,
  description,
  children
}: {
  currentSection: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <AppShell currentPath="">
      <div className="space-y-6">
        <div className="rounded-[30px] border border-border/80 bg-white/75 px-6 py-5 shadow-soft backdrop-blur">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                Design Lab
              </p>
              <h1 className="mt-2 text-3xl font-semibold text-foreground">{title}</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
                {description}
              </p>
            </div>
            <nav className="inline-flex items-center gap-2 rounded-full border border-border bg-background/90 px-2 py-2 shadow-soft">
              {sections.map((section) => (
                <Link
                  className={cn(
                    "rounded-full px-4 py-2 text-sm transition",
                    currentSection === section.href
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-white hover:text-foreground"
                  )}
                  href={section.href}
                  key={section.href}
                >
                  {section.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
        {children}
      </div>
    </AppShell>
  );
}
