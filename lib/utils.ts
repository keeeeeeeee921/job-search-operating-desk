import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function createId() {
  return crypto.randomUUID();
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(value));
}

export function getDateKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export function getEasternDateKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

export function normalizeText(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

export function tokenize(value: string) {
  return normalizeText(value)
    .split(/[^a-z0-9]+/i)
    .map((token) => token.trim())
    .filter(Boolean);
}

export function uniqueValues(values: string[]) {
  return Array.from(
    new Set(
      values
        .map((value) => value.trim())
        .filter(Boolean)
    )
  );
}

export function truncate(value: string, length = 140) {
  if (value.length <= length) {
    return value;
  }

  return `${value.slice(0, length).trimEnd()}…`;
}

export function normalizeUrl(rawUrl: string) {
  const value = rawUrl.trim();

  try {
    const parsed = value.startsWith("http")
      ? new URL(value)
      : new URL(`https://${value}`);

    parsed.hash = "";
    const hostname = parsed.hostname.toLowerCase();
    const pathname = parsed.pathname.toLowerCase();

    if (hostname.includes("linkedin.com") && pathname.includes("/jobs/view/")) {
      parsed.search = "";
      return parsed.toString();
    }

    if (hostname.includes("lifeattiktok.com")) {
      parsed.searchParams.delete("token");
    }

    const trackedKeys = Array.from(parsed.searchParams.keys()).filter(
      (key) =>
        key.startsWith("utm_") ||
        [
          "alternatechannel",
          "ebp",
          "refid",
          "trackingid",
          "trk"
        ].includes(key.toLowerCase())
    );

    for (const key of trackedKeys) {
      parsed.searchParams.delete(key);
    }

    return parsed.toString();
  } catch {
    return null;
  }
}

export function hostToCompany(hostname: string) {
  if (hostname.toLowerCase().includes("lifeattiktok.com")) {
    return "TikTok";
  }

  const parts = hostname.split(".").filter(Boolean);
  const base = parts.length > 2 ? parts[parts.length - 2] : parts[0] ?? "";
  return capitalizeWords(base.replace(/[-_]/g, " "));
}

export function capitalizeWords(input: string) {
  const tokenMap: Record<string, string> = {
    ai: "AI",
    api: "API",
    csv: "CSV",
    fedex: "FedEx",
    llm: "LLM",
    ml: "ML",
    oa: "OA",
    qa: "QA",
    tiktok: "TikTok",
    linkedin: "LinkedIn",
    github: "GitHub"
  };

  return input
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => {
      const normalized = part.toLowerCase();
      const mapped = tokenMap[normalized];
      if (mapped) {
        return mapped;
      }

      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join(" ");
}

export function tokenOverlapScore(a: string, b: string) {
  const aTokens = new Set(tokenize(a));
  const bTokens = new Set(tokenize(b));

  if (aTokens.size === 0 || bTokens.size === 0) {
    return 0;
  }

  let matches = 0;
  aTokens.forEach((token) => {
    if (bTokens.has(token)) {
      matches += 1;
    }
  });

  return matches / Math.max(aTokens.size, bTokens.size);
}

export function containsAny(haystack: string, needles: string[]) {
  const normalized = normalizeText(haystack);
  return needles.some((needle) => normalized.includes(normalizeText(needle)));
}
