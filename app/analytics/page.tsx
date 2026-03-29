import { ApplicationFlowSankey } from "@/components/application-flow-sankey";
import { AppShell } from "@/components/app-shell";
import { getApplicationFlowSankeyData } from "@/lib/db/repository";

export default async function AnalyticsPage() {
  const data = await getApplicationFlowSankeyData();

  return (
    <AppShell currentPath="/analytics">
      <ApplicationFlowSankey data={data} />
    </AppShell>
  );
}
