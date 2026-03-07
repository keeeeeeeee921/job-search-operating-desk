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

function stripHtml(input: string) {
  return input
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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
        company.push(org.name);
      }

      if (typeof item.description === "string") {
        jobDescription.push(stripHtml(item.description));
      }

      const jobLocation = item.jobLocation as
        | { address?: Record<string, string> }
        | Array<{ address?: Record<string, string> }>
        | undefined;
      const locations = Array.isArray(jobLocation)
        ? jobLocation
        : jobLocation
          ? [jobLocation]
          : [];

      locations.forEach((entry) => {
        const address = entry.address;
        if (!address) {
          return;
        }
        const parts = [
          address.addressLocality,
          address.addressRegion,
          address.addressCountry
        ].filter(Boolean);
        if (parts.length) {
          location.push(parts.join(", "));
        }
      });
    });
  });

  return { roleTitle, company, location, jobDescription };
}

function extractCandidates(html: string, normalizedUrl: string) {
  const $ = load(html);
  const parsedUrl = new URL(normalizedUrl);
  const jsonLd = collectJsonLdCandidates($);
  const titleCandidates = uniqueValues([
    ...jsonLd.roleTitle,
    $('meta[property="og:title"]').attr("content") ?? "",
    $("title").text()
  ]);
  const companyCandidates = uniqueValues([
    ...jsonLd.company,
    $('meta[name="author"]').attr("content") ?? "",
    hostToCompany(parsedUrl.hostname)
  ]);
  const locationCandidates = uniqueValues([
    ...jsonLd.location,
    $('[data-qa="job-location"]').text(),
    $('[class*="location"]').first().text()
  ]);
  const descriptionCandidates = uniqueValues([
    ...jsonLd.jobDescription,
    $('meta[name="description"]').attr("content") ?? "",
    $('meta[property="og:description"]').attr("content") ?? "",
    $("article").text(),
    $("main").text()
  ]).map((value) => stripHtml(value));

  const result: ExtractionResult = {
    normalizedUrl,
    sourceType: detectSource(normalizedUrl).sourceType,
    sourceConfidence: detectSource(normalizedUrl).sourceConfidence,
    extractionStatus: "needs_review",
    supported: true,
    fields: {
      roleTitle: pickField(
        { roleTitle: titleCandidates.map((value) => cleanTitle(value)) },
        "roleTitle"
      ),
      company: pickField({ company: companyCandidates }, "company"),
      location: pickField({ location: locationCandidates }, "location"),
      link: normalizedUrl,
      jobDescription: pickField(
        {
          jobDescription: descriptionCandidates
            .map((value) => value.slice(0, 320))
            .filter((value) => value.length > 20)
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
      roleTitle: uniqueValues(titleCandidates.map((value) => cleanTitle(value))),
      company: companyCandidates,
      location: locationCandidates,
      jobDescription: uniqueValues(descriptionCandidates).slice(0, 3)
    },
    issues: [],
    notes: ["Public page metadata was parsed on the server."]
  };

  const draft = {
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
    return extractCandidates(html, normalizedUrl);
  } catch {
    return buildFallbackExtraction(normalizedUrl);
  }
}
