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
    if (parsed.searchParams.has("utm_source")) {
      parsed.searchParams.delete("utm_source");
    }

    return parsed.toString();
  } catch {
    return null;
  }
}

export function hostToCompany(hostname: string) {
  const parts = hostname.split(".").filter(Boolean);
  const base = parts.length > 2 ? parts[parts.length - 2] : parts[0] ?? "";
  return capitalizeWords(base.replace(/[-_]/g, " "));
}

export function capitalizeWords(input: string) {
  return input
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
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
