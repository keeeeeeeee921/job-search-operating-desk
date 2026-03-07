import { getJobsByPool } from "@/lib/db/repository";
import { AppShell } from "@/components/app-shell";
import { EmailMatchPanel } from "@/components/email-match-panel";

export default async function UpdateByEmailPage() {
  const activeJobs = await getJobsByPool("active");

  return (
    <AppShell currentPath="/update-by-email">
      <EmailMatchPanel hasActiveJobs={activeJobs.length > 0} />
    </AppShell>
  );
}
