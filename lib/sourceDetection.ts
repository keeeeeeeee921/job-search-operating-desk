import type { SourceConfidence, SourceType } from "@/lib/types";

export function detectSource(url: string): {
  sourceType: SourceType;
  sourceConfidence: SourceConfidence;
} {
  let hostname = "";
  let pathname = "";

  try {
    const parsed = new URL(url);
    hostname = parsed.hostname.toLowerCase();
    pathname = parsed.pathname.toLowerCase();
  } catch {
    return { sourceType: "unknown", sourceConfidence: "unknown" };
  }

  if (hostname.includes("linkedin.com")) {
    return { sourceType: "linkedin", sourceConfidence: "high" };
  }

  if (hostname.includes("greenhouse.io")) {
    return { sourceType: "greenhouse", sourceConfidence: "high" };
  }

  if (hostname.includes("lever.co")) {
    return { sourceType: "lever", sourceConfidence: "high" };
  }

  if (hostname.includes("myworkdayjobs.com") || pathname.includes("workday")) {
    return { sourceType: "workday", sourceConfidence: "high" };
  }

  if (
    pathname.includes("career") ||
    pathname.includes("jobs") ||
    pathname.includes("job") ||
    pathname.includes("apply")
  ) {
    return { sourceType: "company", sourceConfidence: "low" };
  }

  return { sourceType: "unknown", sourceConfidence: "unknown" };
}
