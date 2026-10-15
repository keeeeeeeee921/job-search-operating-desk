import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Surface } from "@/components/ui/surface";

const linkClassName =
  "inline-flex items-center justify-center rounded-2xl border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground transition hover:border-accent/20 hover:bg-white";

export default function NotFound() {
  return (
    <AppShell currentPath="">
      <Surface className="mx-auto max-w-xl p-8 text-center">
        <p className="text-sm font-semibold text-accent">404</p>
        <h1 className="mt-2 text-xl font-semibold text-foreground">
          There is no page at this address
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          The link may be old, or the page may have moved. Everything you are
          working on is still in Active.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Link className={linkClassName} href="/active">
            Go to Active
          </Link>
          <Link className={linkClassName} href="/">
            Back to the desk
          </Link>
        </div>
      </Surface>
    </AppShell>
  );
}
