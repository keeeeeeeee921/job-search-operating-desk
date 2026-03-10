import { hasActiveJobs } from "@/lib/db/repository";
import { AppShell } from "@/components/app-shell";
import { EmailMatchPanel } from "@/components/email-match-panel";

export default async function UpdateByEmailPage() {
  const activeJobsExist = await hasActiveJobs();

  return (
    <AppShell currentPath="/update-by-email">
      <EmailMatchPanel hasActiveJobs={activeJobsExist} />
    </AppShell>
  );
}
