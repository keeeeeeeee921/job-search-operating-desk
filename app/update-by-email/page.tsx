import { hasActiveJobs } from "@/lib/db/repository";
import { AppShell } from "@/components/app-shell";
import { EmailMatchPanel } from "@/components/email-match-panel";
import { getRejectionEmailExamplesForEnvironment } from "@/lib/seed";

export default async function UpdateByEmailPage() {
  const activeJobsExist = await hasActiveJobs();
  const examples = getRejectionEmailExamplesForEnvironment();

  return (
    <AppShell currentPath="/update-by-email">
      <EmailMatchPanel examples={examples} hasActiveJobs={activeJobsExist} />
    </AppShell>
  );
}
