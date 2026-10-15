import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Surface } from "@/components/ui/surface";

export default function ActiveRecordNotFound() {
  return (
    <AppShell currentPath="/active">
      <Surface className="mx-auto max-w-xl p-8 text-center">
        <p className="text-xl font-semibold text-foreground">
          Active record not found
        </p>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          It may have been archived, rejected or deleted since this link was
          made. Rejected records live on the Rejected page.
        </p>
        <div className="mt-5">
          <Link
            className="inline-flex items-center justify-center rounded-2xl border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground transition hover:border-accent/20 hover:bg-white"
            href="/active"
          >
            Back to Active
          </Link>
        </div>
      </Surface>
    </AppShell>
  );
}
