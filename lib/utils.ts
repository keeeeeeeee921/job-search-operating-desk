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

const US_STATE_CODE_TO_NAME: Record<string, string> = {
  AL: "Alabama",
  AK: "Alaska",
  AZ: "Arizona",
  AR: "Arkansas",
  CA: "California",
  CO: "Colorado",
  CT: "Connecticut",
  DE: "Delaware",
  FL: "Florida",
  GA: "Georgia",
  HI: "Hawaii",
  ID: "Idaho",
  IL: "Illinois",
  IN: "Indiana",
  IA: "Iowa",
  KS: "Kansas",
  KY: "Kentucky",
  LA: "Louisiana",
  ME: "Maine",
  MD: "Maryland",
  MA: "Massachusetts",
  MI: "Michigan",
  MN: "Minnesota",
  MS: "Mississippi",
  MO: "Missouri",
  MT: "Montana",
  NE: "Nebraska",
  NV: "Nevada",
  NH: "New Hampshire",
  NJ: "New Jersey",
  NM: "New Mexico",
  NY: "New York",
  NC: "North Carolina",
  ND: "North Dakota",
  OH: "Ohio",
  OK: "Oklahoma",
  OR: "Oregon",
  PA: "Pennsylvania",
  RI: "Rhode Island",
  SC: "South Carolina",
  SD: "South Dakota",
  TN: "Tennessee",
  TX: "Texas",
  UT: "Utah",
  VT: "Vermont",
  VA: "Virginia",
  WA: "Washington",
  WV: "West Virginia",
  WI: "Wisconsin",
  WY: "Wyoming",
  DC: "District of Columbia"
};

const CANADA_PROVINCE_CODE_TO_NAME: Record<string, string> = {
  AB: "Alberta",
  BC: "British Columbia",
  MB: "Manitoba",
  NB: "New Brunswick",
  NL: "Newfoundland and Labrador",
  NS: "Nova Scotia",
  NT: "Northwest Territories",
  NU: "Nunavut",
  ON: "Ontario",
  PE: "Prince Edward Island",
  QC: "Quebec",
  SK: "Saskatchewan",
  YT: "Yukon"
};

const US_STATE_NAME_LOOKUP = new Map(
  Object.values(US_STATE_CODE_TO_NAME).map((value) => [
    value.toLowerCase(),
    value
  ])
);
const CANADA_PROVINCE_NAME_LOOKUP = new Map(
  Object.values(CANADA_PROVINCE_CODE_TO_NAME).map((value) => [
    value.toLowerCase(),
    value
  ])
);

function normalizeCountryToken(value: string) {
  const normalized = value
    .toLowerCase()
    .replace(/[.]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) {
    return null;
  }

  if (
    [
      "us",
      "usa",
      "united states",
      "united states of america",
      "u s",
      "u s a"
    ].includes(normalized)
  ) {
    return "United States";
  }

  if (
    ["canada", "ca", "can", "canada (ca)"].includes(normalized)
  ) {
    return "Canada";
  }

  return null;
}

function normalizeAdministrativeRegion(value: string): {
  region: string;
  country: "United States" | "Canada";
} | null {
  const normalized = value
    .replace(/[.]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) {
    return null;
  }

  const code = normalized.toUpperCase();
  if (US_STATE_CODE_TO_NAME[code]) {
    return {
      region: US_STATE_CODE_TO_NAME[code],
      country: "United States"
    };
  }

  if (CANADA_PROVINCE_CODE_TO_NAME[code]) {
    return {
      region: CANADA_PROVINCE_CODE_TO_NAME[code],
      country: "Canada"
    };
  }

  const lowerName = normalized.toLowerCase();
  if (US_STATE_NAME_LOOKUP.has(lowerName)) {
    return {
      region: US_STATE_NAME_LOOKUP.get(lowerName) ?? normalized,
      country: "United States"
    };
  }

  if (CANADA_PROVINCE_NAME_LOOKUP.has(lowerName)) {
    return {
      region: CANADA_PROVINCE_NAME_LOOKUP.get(lowerName) ?? normalized,
      country: "Canada"
    };
  }

  return null;
}

export function normalizeLocationForStorage(rawLocation: string) {
  const trimmed = rawLocation.trim();
  if (!trimmed) {
    return "";
  }

  const remoteFromPrefix = /^(remote|workplace type)\s*:/i.test(trimmed);
  const hasRemoteToken = remoteFromPrefix || /\bremote\b/i.test(trimmed);

  let base = trimmed
    .replace(/^(location|remote|workplace type)\s*:\s*/i, "")
    .replace(/\s+/g, " ")
    .replace(/\s*,\s*/g, ", ")
    .replace(/\s*[-/|]\s*(on-site|onsite|hybrid)\b/gi, "")
    .replace(/\((on-site|onsite|hybrid)\)/gi, "")
    .replace(/\(remote\)/gi, "")
    .replace(/\bremote\b/gi, "")
    .replace(/\bUnited States of America\b/gi, "United States")
    .replace(/\s+,/g, ",")
    .replace(/,\s*$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  if (/^(yes|no)$/i.test(base)) {
    return hasRemoteToken ? "Remote" : "";
  }

  if (!base) {
    return hasRemoteToken ? "Remote" : "";
  }

  const countryOnly = normalizeCountryToken(base);
  if (countryOnly) {
    return hasRemoteToken ? `${countryOnly} (Remote)` : countryOnly;
  }

  const parts = base.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const city = parts[0] ?? "";
    const administrativeRegion = normalizeAdministrativeRegion(parts[1] ?? "");
    if (city && administrativeRegion) {
      const explicitCountry = normalizeCountryToken(parts[2] ?? "");
      const country = explicitCountry ?? administrativeRegion.country;
      const normalizedLocation = `${city}, ${administrativeRegion.region}, ${country}`;
      return hasRemoteToken ? `${normalizedLocation} (Remote)` : normalizedLocation;
    }

    if (parts.length === 2) {
      const secondPartCountry = normalizeCountryToken(parts[1] ?? "");
      if (city && secondPartCountry) {
        const normalizedLocation = `${city}, ${secondPartCountry}`;
        return hasRemoteToken ? `${normalizedLocation} (Remote)` : normalizedLocation;
      }
    }
  }

  if (hasRemoteToken) {
    return `${base} (Remote)`;
  }

  return base;
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
