import { load } from "cheerio";
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

function normalizeWhitespace(input: string) {
  return input.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
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

  return !/^(join the team\.?|job\.?|careers?\.?|open roles?\.?)$/i.test(value);
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

  return !/(city state|jobid|descriptionteaser|save job|apply now|recently viewed jobs|profile recommendations|search-results|jobcart)/i.test(
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
        .map((_, element) => stripHtml($(element).html() ?? $(element).text()))
        .get()
    )
  );
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
  const jsonLd = collectJsonLdCandidates($);
  const metaDescriptions = uniqueValues([
    $('meta[name="description"]').attr("content") ?? "",
    $('meta[property="og:description"]').attr("content") ?? ""
  ]).map((value) => normalizeWhitespace(value));
  const structuredDescriptionCandidates = extractStructuredDescriptionCandidates($);
  const companyDescriptionSeeds = uniqueValues([
    ...metaDescriptions,
    ...structuredDescriptionCandidates.slice(0, 2)
  ]);
  const titleCandidates = uniqueValues([
    ...jsonLd.roleTitle,
    $("h1").first().text(),
    $("h2").first().text(),
    $('meta[property="og:title"]').attr("content") ?? "",
    $("title").text()
  ])
    .map((value) => cleanTitle(value))
    .filter(isUsefulTitleCandidate);
  const companyCandidates = prioritizeCompanyCandidates([
    ...jsonLd.company,
    ...extractCompanyFromDescriptions(companyDescriptionSeeds),
    $('meta[property="og:site_name"]').attr("content") ?? "",
    $('meta[name="author"]').attr("content") ?? "",
    ...(
      parsedUrl.hostname.includes("myworkdayjobs.com")
        ? []
        : [hostToCompany(parsedUrl.hostname)]
    )
  ]);
  const locationCandidates = uniqueValues([
    ...jsonLd.location,
    ...extractLabeledValues($, "location"),
    $('[data-qa="job-location"]').text(),
    $('[class*="location"]').first().text()
  ])
    .map((value) => cleanLocation(value))
    .filter(isUsefulLocationCandidate);
  const descriptionCandidates = uniqueValues([
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
    notes: ["Public page metadata was parsed on the server."]
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
    const response = await fetch(normalizedUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36"
      },
      signal: AbortSignal.timeout(10000),
      cache: "no-store"
    });

    if (!response.ok) {
      return buildFallbackExtraction(normalizedUrl);
    }

    const html = await response.text();
    return extractCandidatesFromHtml(html, normalizedUrl);
  } catch {
    return buildFallbackExtraction(normalizedUrl);
  }
}
