import { lookup } from "node:dns/promises";
import net from "node:net";
import { load } from "cheerio";
import { isPublicDemo } from "@/lib/demo";
import { buildFallbackExtraction } from "@/lib/extractor";
import { getMockJobBySlug } from "@/lib/mock-jobs";
import { validateJobDraft } from "@/lib/recordValidation";
import { detectSource } from "@/lib/sourceDetection";
import type { ExtractionResult, JobField } from "@/lib/types";
import {
  capitalizeWords,
  hostToCompany,
  normalizeUrl,
  uniqueValues
} from "@/lib/utils";

type ExtractionCandidates = {
  roleTitle: string[];
  company: string[];
  location: string[];
  jobDescription: string[];
  notes?: string[];
};

type DayforcePostingLocation = {
  cityName?: string;
  stateCode?: string;
  isoCountryCode?: string;
  formattedAddress?: string;
};

type DayforceJobData = {
  jobPostingId?: number;
  jobTitle?: string;
  hasVirtualLocation?: boolean;
  postingLocations?: DayforcePostingLocation[];
  jobPostingContent?: {
    jobDescription?: string;
  };
};

const demoRateLimitState: {
  windowStart: number;
  count: number;
} = {
  windowStart: 0,
  count: 0
};

const DEMO_EXTRACTION_WINDOW_MS = 60_000;
const DEMO_EXTRACTION_MAX_REQUESTS = Number(
  process.env.JOB_DESK_DEMO_EXTRACT_LIMIT_PER_MINUTE ?? "40"
);
const MAX_REDIRECTS = 3;
const EXTRACTION_MAX_BYTES = Number(
  process.env.JOB_DESK_EXTRACT_MAX_BYTES ?? "1048576"
);

class UnsafeTargetError extends Error {}

function normalizeWhitespace(input: string) {
  return input.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function isPrivateOrLocalIpv4(ip: string) {
  const parts = ip.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) {
    return true;
  }

  const [a, b] = parts;
  return (
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}

function isPrivateOrLocalIpv6(ip: string) {
  const normalized = ip.toLowerCase();
  return (
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80:") ||
    normalized.startsWith("::ffff:127.")
  );
}

function isUnsafeIpAddress(ip: string) {
  const family = net.isIP(ip);
  if (family === 4) {
    return isPrivateOrLocalIpv4(ip);
  }

  if (family === 6) {
    return isPrivateOrLocalIpv6(ip);
  }

  return true;
}

async function assertPublicNetworkTarget(url: string) {
  const parsed = new URL(url);
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new UnsafeTargetError("Only http/https job links are supported.");
  }

  const hostname = parsed.hostname.toLowerCase();
  if (
    hostname === "localhost" ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    hostname.endsWith(".lan")
  ) {
    throw new UnsafeTargetError("Private or local hostnames are blocked.");
  }

  if (net.isIP(hostname) && isUnsafeIpAddress(hostname)) {
    throw new UnsafeTargetError("Private or local IP targets are blocked.");
  }

  const records = await lookup(hostname, { all: true, verbatim: false }).catch(
    () => []
  );
  if (records.length === 0) {
    throw new UnsafeTargetError("The job link hostname could not be resolved.");
  }

  if (records.some((record) => isUnsafeIpAddress(record.address))) {
    throw new UnsafeTargetError("Private or local network targets are blocked.");
  }
}

function isDemoRateLimited() {
  if (!isPublicDemo()) {
    return false;
  }

  const now = Date.now();
  if (now - demoRateLimitState.windowStart >= DEMO_EXTRACTION_WINDOW_MS) {
    demoRateLimitState.windowStart = now;
    demoRateLimitState.count = 0;
  }

  demoRateLimitState.count += 1;
  return demoRateLimitState.count > DEMO_EXTRACTION_MAX_REQUESTS;
}

function buildGuardrailFallback(normalizedUrl: string, reason: string) {
  const fallback = buildFallbackExtraction(normalizedUrl);
  return {
    ...fallback,
    supported: false,
    unsupportedReason: reason,
    notes: uniqueValues([
      ...fallback.notes,
      "Server safety guardrails blocked this extraction request."
    ])
  } satisfies ExtractionResult;
}

function isHtmlLikeContentType(contentType: string | null) {
  if (!contentType) {
    return true;
  }

  const normalized = contentType.toLowerCase();
  return (
    normalized.includes("text/html") ||
    normalized.includes("application/xhtml+xml")
  );
}

function parseContentLength(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function assertExtractionResponseHeaders(response: Response) {
  if (!isHtmlLikeContentType(response.headers.get("content-type"))) {
    throw new UnsafeTargetError(
      "The job link did not return an HTML page that can be parsed."
    );
  }

  const contentLength = parseContentLength(response.headers.get("content-length"));
  if (contentLength !== null && contentLength > EXTRACTION_MAX_BYTES) {
    throw new UnsafeTargetError(
      "The job page is too large to process automatically. Please continue with manual review."
    );
  }
}

async function readResponseTextWithLimit(response: Response) {
  if (!response.body) {
    return "";
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    if (!value) {
      continue;
    }

    totalBytes += value.byteLength;
    if (totalBytes > EXTRACTION_MAX_BYTES) {
      throw new UnsafeTargetError(
        "The job page is too large to process automatically. Please continue with manual review."
      );
    }

    chunks.push(value);
  }

  if (chunks.length === 0) {
    return "";
  }

  const buffer = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new TextDecoder().decode(buffer);
}

async function fetchWithSafeRedirects(startUrl: string) {
  let currentUrl = startUrl;

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    await assertPublicNetworkTarget(currentUrl);
    const response = await fetch(currentUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36"
      },
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
      redirect: "manual"
    });

    if (response.status < 300 || response.status >= 400) {
      return response;
    }

    const location = response.headers.get("location");
    if (!location) {
      return response;
    }

    currentUrl = new URL(location, currentUrl).toString();
  }

  throw new UnsafeTargetError("The job link redirected too many times.");
}

function normalizeCountryName(value: string) {
  return normalizeWhitespace(
    value
      .replace(/\bUnited States of America\b/gi, "United States")
      .replace(/\bUSA\b/gi, "United States")
  );
}

function decodeHtmlEntities(input: string) {
  return normalizeWhitespace(load(`<body>${input}</body>`).text());
}

function stripHtml(input: string) {
  return normalizeWhitespace(
    load(`<body>${decodeHtmlEntities(input)}</body>`).text()
  );
}

function stripHtmlFromElement($: ReturnType<typeof load>, element: Parameters<ReturnType<typeof load>>[0]) {
  const clone = $(element).clone();
  clone.find("script, style, noscript, template").remove();
  return stripHtml(clone.html() ?? clone.text());
}

function pickField(
  candidates: Partial<Record<JobField, string[]>>,
  field: JobField
) {
  return (candidates[field] ?? [])[0] ?? "";
}

function parseJsonLd(raw: string) {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return [];
  }
}

function cleanTitle(value: string) {
  return capitalizeWords(
    value
      .replace(/\|.*$/, "")
      .replace(/- careers?.*$/i, "")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function isUsefulTitleCandidate(value: string) {
  if (!value || value.length > 120) {
    return false;
  }

  return !/^(join the team\.?|job\.?|job details\.?|careers?\.?|open roles?\.?)$/i.test(value);
}

function cleanCompany(value: string) {
  return normalizeWhitespace(
    normalizeCountryName(
      value
        .replace(/[®™]/g, "")
        .replace(/^\d+\s+/, "")
        .replace(/\bMSO LLC\b/gi, "")
        .replace(/\bLLC\b$/gi, "")
        .replace(/\bL\.L\.C\.\b$/gi, "")
        .replace(/\s{2,}/g, " ")
    )
      .replace(/\|\s*careers?.*$/i, "")
      .replace(/\s{2,}/g, " ")
  );
}

function cleanLocation(value: string) {
  return normalizeCountryName(
    value
      .replace(/^location\s*:?\s*/i, "")
      .replace(/,\s*\d{5}(?:-\d{4})?(?=,\s*(United States|United States of America|USA)\b)/i, "")
      .replace(/\s*\|\s*.*$/, "")
      .replace(/\s*›\s*/g, " ")
      .replace(/\s*\(united states of america\)$/i, " (United States)")
  );
}

function looksLikeInternalCompanyCandidate(value: string) {
  return (
    /^\d+\s+/.test(value) ||
    /\b(MSO LLC|LLC|L\.L\.C\.|Holdings?|Corporation|Incorporated)\b/i.test(value)
  );
}

function looksLikeInternalLocationCandidate(value: string) {
  return /^(treehouse|headquarters|hq|support center)(,\s*(united states|canada))?$/i.test(
    value.trim()
  );
}

function isUsefulCompanyCandidate(value: string) {
  return Boolean(value) && value.length <= 80 && !/^(job|careers?)$/i.test(value);
}

function isUsefulLocationCandidate(value: string) {
  if (!value || value.length > 100) {
    return false;
  }

  if (looksLikeInternalLocationCandidate(value)) {
    return false;
  }

  return !/(req id|position type|join the team|jobs\s*[>›]|who are we hiring|customer insights analyst|analyst business intelligence)/i.test(
    value
  );
}

function isUsefulDescriptionCandidate(value: string) {
  if (!value || value.length < 40) {
    return false;
  }

  return !/(\$\s*\(\s*function|\bvar\s+\w+\s*=|new\s+US\.Opportunity|CandidateOpportunityDetail|ko\.applyBindings|twitter-wjs|Recruiting\.TenantFeatureToggle|siteBundle|bootstrapBundle|descriptionteaser|save job|apply now|recently viewed jobs|profile recommendations|search-results|jobcart|window\.__|document\.createElement)/i.test(
    value
  );
}

function parseLocationFromJobLocation(
  jobLocation:
    | { address?: Record<string, string> }
    | Array<{ address?: Record<string, string> }>
    | undefined,
  options?: {
    applicantLocationRequirements?: string[];
    jobLocationType?: string;
  }
) {
  const applicantLocations =
    options?.applicantLocationRequirements
      ?.map((value) => normalizeCountryName(value))
      .filter(Boolean) ?? [];
  const remote = /telecommute|remote/i.test(options?.jobLocationType ?? "");

  if (remote && applicantLocations.length > 0) {
    return applicantLocations.map((value) => `${value} (Remote)`);
  }

  const locations = Array.isArray(jobLocation)
    ? jobLocation
    : jobLocation
      ? [jobLocation]
      : [];

  return locations.flatMap((entry) => {
    const address = entry.address;
    if (!address) {
      return [];
    }

    const parts = [
      address.addressLocality,
      address.addressRegion,
      address.addressCountry
    ]
      .filter(Boolean)
      .map((value) => normalizeCountryName(value));

    return parts.length ? [parts.join(", ")] : [];
  });
}

function parseApplicantLocationRequirements(
  requirements:
    | { name?: string }
    | Array<{ name?: string }>
    | undefined
) {
  const entries = Array.isArray(requirements)
    ? requirements
    : requirements
      ? [requirements]
      : [];

  return entries
    .map((entry) => normalizeCountryName(entry.name ?? ""))
    .filter(Boolean);
}

function extractCompanyFromDescriptions(values: string[]) {
  const candidates: string[] = [];

  for (const value of values) {
    const matchWith = value.match(/job with\s+(.+?)\s+in\s+/i);
    if (matchWith?.[1]) {
      candidates.push(matchWith[1]);
    }

    const matchSeeking = value.match(/^(.+?)\s+is seeking\b/i);
    if (matchSeeking?.[1]) {
      candidates.push(matchSeeking[1]);
    }

    const matchAt = value.match(
      /\bAt\s+([A-Z][A-Za-z0-9&.'’\-/ ]{2,80}?)(?:[®,]|,|\s+(?:we|you|our)\b)/i
    );
    if (matchAt?.[1]) {
      candidates.push(matchAt[1]);
    }

    const matchWhy = value.match(
      /\bWhy\s+([A-Z][A-Za-z0-9&.'’\-/ ]{2,80}?)(?:\?| is\b)/i
    );
    if (matchWhy?.[1]) {
      candidates.push(matchWhy[1]);
    }

    const matchIs = value.match(
      /\b((?:The\s+)?[A-Z][A-Za-z0-9&.'’\-/]+(?:\s+[A-Z][A-Za-z0-9&.'’\-/]+){0,6})\s+is\b/
    );
    if (matchIs?.[1]) {
      const rawCandidate = matchIs[1].trim();
      const embeddedTheIndex = rawCandidate.lastIndexOf(" The ");
      candidates.push(
        embeddedTheIndex > 0
          ? rawCandidate.slice(embeddedTheIndex + 1)
          : rawCandidate
      );
    }
  }

  return candidates;
}

function prioritizeCompanyCandidates(values: string[]) {
  const deduped = uniqueValues(
    values
      .map((value) => cleanCompany(value))
      .filter(isUsefulCompanyCandidate)
  );
  const publicFacing = deduped.filter(
    (value) => !looksLikeInternalCompanyCandidate(value)
  );
  const internalOnly = deduped.filter((value) =>
    looksLikeInternalCompanyCandidate(value)
  );

  return publicFacing.length > 0 ? [...publicFacing, ...internalOnly] : deduped;
}

function extractLabeledValues(
  $: ReturnType<typeof load>,
  label: string
) {
  const matcher = new RegExp(`^${label}\\s*:?\\s*`, "i");

  return uniqueValues(
    $("p, li, div, span")
      .map((_, element) => {
        const text = normalizeWhitespace($(element).text());
        if (!matcher.test(text)) {
          return "";
        }

        return text.replace(matcher, "").trim();
      })
      .get()
  );
}

function extractStructuredDescriptionCandidates($: ReturnType<typeof load>) {
  const selectors = [
    '[itemprop="description"]',
    '[data-job-description]',
    '[data-automation-id="jobDescriptionText"]',
    "article",
    "main",
    ".content-intro",
    '[class*="job-description"]',
    '[class*="jobDescription"]',
  ];

  return uniqueValues(
    selectors.flatMap((selector) =>
      $(selector)
        .map((_, element) => stripHtmlFromElement($, element))
        .get()
    )
  );
}

function extractBalancedCallArgument(scriptText: string, signature: string) {
  const startIndex = scriptText.indexOf(signature);
  if (startIndex === -1) {
    return null;
  }

  const start = startIndex + signature.length;
  let depth = 1;
  let inString = false;
  let stringQuote = "";
  let escaped = false;

  for (let index = start; index < scriptText.length; index += 1) {
    const char = scriptText[index];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === "\\") {
        escaped = true;
        continue;
      }

      if (char === stringQuote) {
        inString = false;
      }

      continue;
    }

    if (char === '"' || char === "'" || char === "`") {
      inString = true;
      stringQuote = char;
      continue;
    }

    if (char === "(") {
      depth += 1;
      continue;
    }

    if (char === ")") {
      depth -= 1;
      if (depth === 0) {
        return scriptText.slice(start, index).trim();
      }
    }
  }

  return null;
}

function parseUkgPayload(scriptText: string) {
  const payloadText = extractBalancedCallArgument(
    scriptText,
    "new US.Opportunity.CandidateOpportunityDetail("
  );

  if (!payloadText || !payloadText.startsWith("{")) {
    return null;
  }

  try {
    return JSON.parse(payloadText) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function parseUkgLocations(locations: unknown) {
  const entries = Array.isArray(locations)
    ? locations
    : locations
      ? [locations]
      : [];

  return entries.flatMap((entry) => {
    if (!entry || typeof entry !== "object") {
      return [];
    }

    const value = entry as {
      Address?: {
        City?: string;
        State?: { Code?: string; Name?: string };
        Country?: { Name?: string };
      };
      LocalizedDescription?: string | null;
    };

    const address = value.Address;
    if (address) {
      const parts = [
        address.City,
        address.State?.Code || address.State?.Name,
        address.Country?.Name
      ]
        .filter(Boolean)
        .map((part) => cleanLocation(String(part)));

      if (parts.length) {
        return [parts.join(", ")];
      }
    }

    if (
      typeof value.LocalizedDescription === "string" &&
      isUsefulLocationCandidate(cleanLocation(value.LocalizedDescription))
    ) {
      return [cleanLocation(value.LocalizedDescription)];
    }

    return [];
  });
}

function mapCountryCodeToName(code: string | undefined) {
  if (!code) {
    return "";
  }

  const normalized = code.trim().toUpperCase();
  if (normalized === "US" || normalized === "USA") {
    return "United States";
  }

  if (normalized === "CA" || normalized === "CAN") {
    return "Canada";
  }

  return normalized;
}

function parseDayforceNextDataPayload(scriptText: string) {
  if (!scriptText.includes('"jobData"') && !scriptText.includes('"dehydratedState"')) {
    return null;
  }

  try {
    const parsed = JSON.parse(scriptText) as {
      props?: {
        pageProps?: {
          jobData?: DayforceJobData;
          dehydratedState?: {
            queries?: Array<{
              queryKey?: unknown;
              state?: {
                data?: Record<string, unknown>;
              };
            }>;
          };
        };
      };
    };

    const pageProps = parsed.props?.pageProps;
    if (!pageProps) {
      return null;
    }

    const queries = pageProps.dehydratedState?.queries ?? [];
    const jobQueryData = queries
      .map((entry) => entry.state?.data)
      .find((value) => typeof value?.jobTitle === "string");

    const siteInfoData = queries
      .map((entry) => entry.state?.data)
      .find((value) => typeof value?.candidateCorrespondenceClientName === "string");

    const jobData = pageProps.jobData ?? (jobQueryData as DayforceJobData | undefined);

    if (
      !jobData ||
      (!jobData.jobPostingId &&
        !jobData.jobTitle &&
        !jobData.jobPostingContent?.jobDescription)
    ) {
      return null;
    }

    return {
      jobData,
      siteInfoData
    };
  } catch {
    return null;
  }
}

function parseDayforceLocations(
  locations: DayforcePostingLocation[] | undefined,
  hasVirtualLocation: boolean | undefined
) {
  const entries = Array.isArray(locations) ? locations : [];
  const formatted = uniqueValues(
    entries
      .map((entry) => {
        const city = normalizeWhitespace(entry.cityName ?? "");
        const state = normalizeWhitespace(entry.stateCode ?? "");
        const country = mapCountryCodeToName(entry.isoCountryCode);

        if (city && state && country) {
          return `${city}, ${state}, ${country}`;
        }

        if (city && state) {
          return `${city}, ${state}`;
        }

        return cleanLocation(entry.formattedAddress ?? "");
      })
      .map((value) => cleanLocation(value))
      .filter(Boolean)
      .filter(isUsefulLocationCandidate)
  );

  const countries = uniqueValues(
    entries
      .map((entry) => mapCountryCodeToName(entry.isoCountryCode))
      .filter(Boolean)
  );
  const primaryCountry = countries[0] ?? "";

  if (hasVirtualLocation && primaryCountry) {
    return uniqueValues([
      `${primaryCountry} (Remote)`,
      ...formatted.slice(0, 2)
    ]);
  }

  if (formatted.length <= 1) {
    return formatted;
  }

  const multiLocationLabel = primaryCountry
    ? `${primaryCountry} (Multiple locations)`
    : "Multiple locations";

  return uniqueValues([multiLocationLabel, ...formatted.slice(0, 2)]);
}

function parseDayforceCompany(siteInfoData: Record<string, unknown> | undefined) {
  if (!siteInfoData) {
    return "";
  }

  const direct = siteInfoData.candidateCorrespondenceClientName;
  if (typeof direct === "string") {
    return cleanCompany(direct);
  }

  const largeLogo = siteInfoData.largeLogo;
  if (largeLogo && typeof largeLogo === "object") {
    const logo = largeLogo as Record<string, unknown>;
    if (typeof logo.description === "string") {
      return cleanCompany(logo.description);
    }
    if (typeof logo.imageName === "string") {
      return cleanCompany(logo.imageName);
    }
  }

  return "";
}

function collectScriptPayloadCandidates(
  $: ReturnType<typeof load>,
  normalizedUrl: string
): ExtractionCandidates {
  const parsedUrl = new URL(normalizedUrl);
  const roleTitle: string[] = [];
  const company: string[] = [];
  const location: string[] = [];
  const jobDescription: string[] = [];
  const notes: string[] = [];

  const nextDataText = $('script#__NEXT_DATA__[type="application/json"]').first().text();
  if (nextDataText) {
    const dayforcePayload = parseDayforceNextDataPayload(nextDataText);
    if (dayforcePayload) {
      if (typeof dayforcePayload.jobData.jobTitle === "string") {
        roleTitle.push(cleanTitle(dayforcePayload.jobData.jobTitle));
      }

      location.push(
        ...parseDayforceLocations(
          dayforcePayload.jobData.postingLocations,
          dayforcePayload.jobData.hasVirtualLocation
        )
      );

      if (typeof dayforcePayload.jobData.jobPostingContent?.jobDescription === "string") {
        jobDescription.push(stripHtml(dayforcePayload.jobData.jobPostingContent.jobDescription));
      }

      const parsedCompany = parseDayforceCompany(dayforcePayload.siteInfoData);
      if (parsedCompany) {
        company.push(parsedCompany);
      }

      notes.push("Dayforce job payload was parsed from __NEXT_DATA__.");
    }
  }

  $('script:not([type="application/ld+json"])').each((_, element) => {
    const scriptText = $(element).text();
    const ukgPayload = parseUkgPayload(scriptText);
    if (!ukgPayload) {
      return;
    }

    if (typeof ukgPayload.Title === "string") {
      roleTitle.push(ukgPayload.Title);
    }

    location.push(...parseUkgLocations(ukgPayload.Locations));

    if (typeof ukgPayload.Description === "string") {
      jobDescription.push(stripHtml(ukgPayload.Description));
    }

    notes.push("Inline job payload was parsed from the page script.");
  });

  if (jobDescription.length > 0) {
    company.push(
      ...extractCompanyFromDescriptions(jobDescription),
      $('meta[property="og:site_name"]').attr("content") ?? "",
      $('meta[name="author"]').attr("content") ?? "",
      ...(
        parsedUrl.hostname.includes("rec.pro.ukg.net")
          ? [capitalizeWords(parsedUrl.hostname.split(".")[0] ?? "")]
          : []
      )
    );
  }

  return {
    roleTitle,
    company,
    location,
    jobDescription,
    notes
  };
}

function collectJsonLdCandidates($: ReturnType<typeof load>) {
  const roleTitle: string[] = [];
  const company: string[] = [];
  const location: string[] = [];
  const jobDescription: string[] = [];

  $('script[type="application/ld+json"]').each((_, element) => {
    const text = $(element).text();
    parseJsonLd(text).forEach((item: Record<string, unknown>) => {
      const typeValue = String(item["@type"] ?? "");
      if (!/(JobPosting|Posting|Job)/.test(typeValue)) {
        return;
      }

      if (typeof item.title === "string") {
        roleTitle.push(item.title);
      }

      const org = item.hiringOrganization as { name?: string } | undefined;
      if (typeof org?.name === "string") {
        company.push(cleanCompany(org.name));
      }

      if (typeof item.description === "string") {
        jobDescription.push(stripHtml(item.description));
      }

      location.push(
        ...parseLocationFromJobLocation(item.jobLocation as never, {
          applicantLocationRequirements: parseApplicantLocationRequirements(
            item.applicantLocationRequirements as never
          ),
          jobLocationType: String(item.jobLocationType ?? "")
        })
      );
    });
  });

  return { roleTitle, company, location, jobDescription };
}

export function extractCandidatesFromHtml(html: string, normalizedUrl: string) {
  const $ = load(html);
  const parsedUrl = new URL(normalizedUrl);
  const scriptPayload = collectScriptPayloadCandidates($, normalizedUrl);
  const jsonLd = collectJsonLdCandidates($);
  const metaDescriptions = uniqueValues([
    $('meta[name="description"]').attr("content") ?? "",
    $('meta[property="og:description"]').attr("content") ?? ""
  ]).map((value) => normalizeWhitespace(value));
  const structuredDescriptionCandidates = extractStructuredDescriptionCandidates($);
  const companyDescriptionSeeds = uniqueValues([
    ...scriptPayload.jobDescription.slice(0, 2),
    ...metaDescriptions,
    ...structuredDescriptionCandidates.slice(0, 2)
  ]);
  const titleCandidates = uniqueValues([
    ...scriptPayload.roleTitle,
    ...jsonLd.roleTitle,
    $("h1").first().text(),
    $("h2").first().text(),
    $('meta[property="og:title"]').attr("content") ?? "",
    $("title").text()
  ])
    .map((value) => cleanTitle(value))
    .filter(isUsefulTitleCandidate);
  const companyCandidates = prioritizeCompanyCandidates([
    ...scriptPayload.company,
    ...jsonLd.company,
    ...extractCompanyFromDescriptions(companyDescriptionSeeds),
    $('meta[property="og:site_name"]').attr("content") ?? "",
    $('meta[name="author"]').attr("content") ?? "",
    ...(
      parsedUrl.hostname.includes("myworkdayjobs.com") ||
      parsedUrl.hostname.includes("rec.pro.ukg.net")
        ? []
        : [hostToCompany(parsedUrl.hostname)]
    )
  ]);
  const locationCandidates = uniqueValues([
    ...scriptPayload.location,
    ...jsonLd.location,
    ...extractLabeledValues($, "location"),
    $('[data-qa="job-location"]').text(),
    $('[class*="location"]').first().text()
  ])
    .map((value) => cleanLocation(value))
    .filter(isUsefulLocationCandidate);
  const descriptionCandidates = uniqueValues([
    ...scriptPayload.jobDescription,
    ...jsonLd.jobDescription,
    ...structuredDescriptionCandidates,
    ...metaDescriptions
  ])
    .map((value) => stripHtml(value))
    .filter(isUsefulDescriptionCandidate);

  const result: ExtractionResult = {
    normalizedUrl,
    inputMode: "link",
    sourceType: detectSource(normalizedUrl).sourceType,
    sourceConfidence: detectSource(normalizedUrl).sourceConfidence,
    extractionStatus: "needs_review",
    supported: true,
    fields: {
      roleTitle: pickField({ roleTitle: titleCandidates }, "roleTitle"),
      company: pickField({ company: companyCandidates }, "company"),
      location: pickField({ location: locationCandidates }, "location"),
      link: normalizedUrl,
      jobDescription: pickField(
        {
          jobDescription: descriptionCandidates
        },
        "jobDescription"
      )
    },
    fieldOrigins: {
      roleTitle: titleCandidates.length ? "confirmed" : "missing",
      company: companyCandidates.length ? "confirmed" : "missing",
      location: locationCandidates.length ? "confirmed" : "missing",
      link: "confirmed",
      jobDescription: descriptionCandidates.length ? "confirmed" : "missing"
    },
    candidateValues: {
      roleTitle: titleCandidates,
      company: companyCandidates,
      location: locationCandidates,
      jobDescription: uniqueValues(descriptionCandidates).slice(0, 3)
    },
    issues: [],
    notes: uniqueValues([
      "Public page metadata was parsed on the server.",
      ...(scriptPayload.notes ?? [])
    ])
  };

  const draft = {
    inputMode: "link" as const,
    roleTitle: result.fields.roleTitle ?? "",
    company: result.fields.company ?? "",
    location: result.fields.location ?? "",
    link: result.fields.link ?? normalizedUrl,
    jobDescription: result.fields.jobDescription ?? "",
    sourceType: result.sourceType,
    sourceConfidence: result.sourceConfidence,
    extractionStatus: result.extractionStatus,
    fieldOrigins: result.fieldOrigins,
    candidateValues: result.candidateValues,
    issues: []
  };

  const issues = validateJobDraft(draft);
  return {
    ...result,
    issues,
    extractionStatus: issues.length > 0 ? "needs_review" : "confirmed"
  } satisfies ExtractionResult;
}

function extractMockJob(url: string) {
  const parsed = new URL(url);
  const slug = parsed.pathname.split("/").filter(Boolean).at(-1);
  if (!slug) {
    return null;
  }

  const job = getMockJobBySlug(slug);
  if (!job) {
    return null;
  }

  return {
    normalizedUrl: url,
    inputMode: "link",
    sourceType: "company" as const,
    sourceConfidence: "low" as const,
    extractionStatus: "confirmed" as const,
    supported: true,
    fields: {
      roleTitle: job.title,
      company: job.company,
      location: job.location,
      link: url,
      jobDescription: job.description
    },
    fieldOrigins: {
      roleTitle: "confirmed" as const,
      company: "confirmed" as const,
      location: "confirmed" as const,
      link: "confirmed" as const,
      jobDescription: "confirmed" as const
    },
    candidateValues: {
      roleTitle: [job.title],
      company: [job.company],
      location: [job.location],
      jobDescription: [job.description]
    },
    issues: [],
    notes: ["Local mock job page resolved without remote fetching."]
  } satisfies ExtractionResult;
}

export async function extractJobOnServer(rawUrl: string) {
  const normalizedUrl = normalizeUrl(rawUrl);
  if (!normalizedUrl) {
    return buildFallbackExtraction(rawUrl);
  }

  const source = detectSource(normalizedUrl);
  if (source.sourceType === "linkedin") {
    return buildFallbackExtraction(normalizedUrl);
  }

  if (isDemoRateLimited()) {
    return buildGuardrailFallback(
      normalizedUrl,
      "Public demo extraction is rate-limited. Please wait a minute and try again."
    );
  }

  const parsedUrl = new URL(normalizedUrl);
  if (
    ["localhost", "127.0.0.1"].includes(parsedUrl.hostname) &&
    parsedUrl.pathname.startsWith("/mock-jobs/")
  ) {
    const mock = extractMockJob(normalizedUrl);
    if (mock) {
      return mock;
    }
  }

  try {
    const response = await fetchWithSafeRedirects(normalizedUrl);

    if (!response.ok) {
      return buildFallbackExtraction(normalizedUrl);
    }

    assertExtractionResponseHeaders(response);
    const html = await readResponseTextWithLimit(response);
    return extractCandidatesFromHtml(html, normalizedUrl);
  } catch (error) {
    if (error instanceof UnsafeTargetError) {
      return buildGuardrailFallback(normalizedUrl, error.message);
    }

    return buildFallbackExtraction(normalizedUrl);
  }
}
