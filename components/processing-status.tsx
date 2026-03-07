import { LoaderCircle } from "lucide-react";

export function ProcessingStatus({
  status
}: {
  status: string | null;
}) {
  if (!status) {
    return null;
  }

  return (
    <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
      <LoaderCircle className="size-4 animate-spin text-accent" />
      <span>{status}</span>
    </div>
  );
}
