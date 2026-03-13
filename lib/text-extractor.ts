import { validateJobDraft } from "@/lib/recordValidation";
import type {
  ExtractionResult,
  FieldOrigin,
  JobDraft,
  JobField,
  SourceConfidence,
  SourceType
} from "@/lib/types";
import { uniqueValues } from "@/lib/utils";

const sectionHeaders = new Set([
  "about the job",
  "description",
  "responsibilities",
  "responsibilities:",
  "required skills",
  "required skills:",
  "preferred qualifications",
  "preferred qualifications:",
  "minimum education",
  "minimum experience",
  "knowledge, skills and abilities",
  "essential functions",
  "additional details",
  "pay",
  "know your rights",
  "pay transparency"
]);

const metadataLabels = new Set([
  "company",
  "category",
  "employment type",
  "worker sub-type",
  "worker sub type",
  "workplace type",
  "remote",
  "location",
  "req id"
]);

const linkedinNoisePatterns = [
  /^show more options$/i,
  /^show match details$/i,
  /^tailor my resume$/i,
  /^create cover letter$/i,
  /^help me stand out$/i,
  /^people you can reach out to$/i,
  /^promoted by /i,
  /^save$/i,
  /^message$/i,
  /^share$/i,
  /^simplify$/i,
  /^v\d+$/i,
  /^\d+%$/,
  /^resume match$/i,
  /^easy apply$/i,
  /^show more$/i,
  /^show less$/i,
  /^starting at /i,
  /^matches your job preferences/i,
  /^no response insights/i,
  /^over \d+ applicants$/i,
  /^.+ logo$/i,
  /^.+ profile photo$/i,
  /^.+ is verified$/i,
  /^school alum /i
];

const pastedTextFormStopPatterns = [
  /^create a job alert$/i,
  /^interested in building your career/i,
  /^apply for this job$/i,
  /^autofill with mygreenhouse$/i,
  /^first name\*?$/i,
  /^last name\*?$/i,
  /^preferred first name$/i,
  /^email\*?$/i,
  /^phone\*?$/i,
  /^country\*?$/i,
  /^resume\/cv\*?$/i,
  /^attach$/i,
  /^dropbox$/i,
  /^google drive$/i,
  /^enter manually$/i,
  /^accepted file types:/i,
  /^voluntary self-identification/i,
  /^public burden statement:/i,
  /^submit application$/i
];

function cleanLine(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

type LocationCandidateSource = "label" | "summary" | "postingMeta" | "top";

type LocationCandidateSeed = {
  value: string;
  source: LocationCandidateSource;
  raw: string;
  index: number;
};

function normalizeLocationCandidate(value: string): string {
  const cleaned = cleanLine(
    value.replace(/^(location|remote|workplace type)\s*:\s*/i, "")
  );

  if (!cleaned) {
    return "";
  }

  if (/^(yes|no)$/i.test(cleaned)) {
    return "";
  }

  const addressWithZip = cleaned.match(
    /,\s*([A-Za-z.'\- ]+),\s*([A-Z]{2})\s*\d{5}(?:-\d{4})?,\s*(United States of America|United States|USA|US)\b/i
  );
  if (addressWithZip) {
    const city = cleanLine(addressWithZip[1] ?? "");
    const state = cleanLine(addressWithZip[2] ?? "");
    return `${city}, ${state}, United States`;
  }

  const remotePrefixed = cleaned.match(/^remote:\s*(.+)$/i);
  if (remotePrefixed) {
    const base = normalizeLocationCandidate(remotePrefixed[1]);
    return base ? `${base} (Remote)` : "Remote";
  }

  const remoteWrapped = cleaned.match(/^(.+?)\s*\((remote)\)$/i);
  if (remoteWrapped) {
    const base = normalizeLocationCandidate(remoteWrapped[1]);
    return base ? `${base} (Remote)` : "Remote";
  }

  const nonRemoteWrapped = cleaned.match(/^(.+?)\s*\((on-site|hybrid)\)$/i);
  if (nonRemoteWrapped) {
    return normalizeLocationCandidate(nonRemoteWrapped[1]);
  }

  if (/^(usa|us|united states)$/i.test(cleaned)) {
    return "United States";
  }

  return cleaned
    .replace(/\bUnited States of America\b/gi, "United States")
    .replace(/\bUSA\b/gi, "United States")
    .replace(/,\s*\d{5}(?:-\d{4})?(?=,\s*(United States|US)\b)/i, "")
    .replace(/, United States$/i, ", US");
}

function looksLikeLocationShape(value: string) {
  const normalized = cleanLine(value);
  if (!normalized || normalized.length > 80) {
    return false;
  }

  if (
    /(promoted by|response insights|clicked apply|applicants|resume match|easy apply|hiring|logo|profile photo)/i.test(
      normalized
    )
  ) {
    return false;
  }

  if (
    /\b(remote|on-site|hybrid|united states|usa|us|canada|uk|united kingdom|australia|germany|france|japan|india)\b/i.test(
      normalized
    )
  ) {
    return true;
  }

  if (/^[A-Za-z.'\- ]+,\s*[A-Z]{2}(?:\b|,)/.test(normalized)) {
    return true;
  }

  return /^[A-Za-z.'\- ]+,\s*[A-Za-z.'\- ]+$/.test(normalized);
}

function looksLikePostingMetaSegment(value: string) {
  return /(minutes? ago|hours? ago|days? ago|weeks? ago|months? ago|reposted|clicked apply|applicants|people clicked apply)/i.test(
    cleanLine(value)
  );
}

function extractLocationFromPostingMetaLine(line: string) {
  if (!line.includes("·")) {
    return "";
  }

  const segments = line.split("·").map((segment) => cleanLine(segment));
  if (segments.length < 2) {
    return "";
  }

  const hasPostingMeta = segments
    .slice(1)
    .some((segment) => looksLikePostingMetaSegment(segment));

  if (!hasPostingMeta) {
    return "";
  }

  const firstSegment = normalizeLocationCandidate(segments[0] ?? "");
  if (!looksLikeLocationShape(firstSegment)) {
    return "";
  }

  return firstSegment;
}

const locationSourceWeight: Record<LocationCandidateSource, number> = {
  label: 52,
  summary: 40,
  postingMeta: 34,
  top: 18
};

function scoreLocationCandidate(seed: LocationCandidateSeed) {
  const value = cleanLine(seed.value);
  const raw = cleanLine(seed.raw);
  const lowerRaw = raw.toLowerCase();
  let score = locationSourceWeight[seed.source];

  if (/^[A-Za-z.'\- ]+,\s*[A-Z]{2}(?:\b|,)/.test(value)) {
    score += 18;
  }

  if (
    /\b(united states|us|canada|uk|united kingdom|australia|germany|france|japan|india)\b/i.test(
      value
    )
  ) {
    score += 8;
  }

  if (/\(remote\)$/i.test(value) || /^remote$/i.test(value)) {
    score += 20;
  } else if (/\bremote\b/i.test(raw)) {
    score += 6;
  }

  if (/^\d+/.test(raw)) {
    score -= 20;
  }

  if (
    /(applicants|promoted|resume match|save|easy apply|profile photo|logo|response insights)/i.test(
      lowerRaw
    )
  ) {
    if (seed.source === "top") {
      score -= 40;
    } else if (seed.source === "postingMeta") {
      score -= 6;
    } else {
      score -= 18;
    }
  }

  if (!looksLikeLocationShape(value)) {
    if (seed.source === "top") {
      score -= 50;
    } else if (seed.source === "summary") {
      score -= 12;
    } else if (seed.source === "postingMeta") {
      score -= 8;
    } else {
      score -= 6;
    }
  }

  if (value.length > 70) {
    score -= seed.source === "top" ? 10 : 2;
  }

  return score;
}

function rankLocationCandidates(seeds: LocationCandidateSeed[]) {
  const bestByValue = new Map<
    string,
    { score: number; firstIndex: number }
  >();

  for (const seed of seeds) {
    const value = cleanLine(seed.value);
    if (!value) {
      continue;
    }

    const score = scoreLocationCandidate(seed);
    const current = bestByValue.get(value);
    if (
      !current ||
      score > current.score ||
      (score === current.score && seed.index < current.firstIndex)
    ) {
      bestByValue.set(value, {
        score,
        firstIndex: seed.index
      });
    }
  }

  const accepted = Array.from(bestByValue.entries())
    .filter(([, ranked]) => ranked.score >= 35)
    .sort((left, right) => {
      if (right[1].score !== left[1].score) {
        return right[1].score - left[1].score;
      }

      return left[1].firstIndex - right[1].firstIndex;
    })
    .map(([value]) => value);

  return accepted.slice(0, 3);
}

function collectLabelLocationSeeds(lines: string[]): LocationCandidateSeed[] {
  const seeds: LocationCandidateSeed[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const lower = line.toLowerCase();
    if (!lower.startsWith("location:")) {
      continue;
    }

    const inlineValue = normalizeLocationCandidate(line.slice("Location:".length));
    if (inlineValue) {
      seeds.push({
        value: inlineValue,
        source: "label",
        raw: line,
        index
      });
    }

    for (let nextIndex = index + 1; nextIndex < lines.length; nextIndex += 1) {
      const next = lines[nextIndex];
      const nextLower = next.toLowerCase();
      const labeledMatch = next.match(/^([^:]+):\s*(.*)$/);

      if (isSectionHeader(next)) {
        break;
      }

      if (labeledMatch) {
        const label = cleanLine(labeledMatch[1] ?? "").toLowerCase();
        if (!["remote", "location", "workplace type"].includes(label)) {
          break;
        }

        const normalized = normalizeLocationCandidate(next);
        if (normalized) {
          seeds.push({
            value: normalized,
            source: "label",
            raw: next,
            index: nextIndex
          });
        }
        continue;
      }

      if (nextLower === "yes" || nextLower === "no" || /^req id\b/i.test(next)) {
        break;
      }

      const normalized = normalizeLocationCandidate(next);
      if (normalized) {
        seeds.push({
          value: normalized,
          source: "label",
          raw: next,
          index: nextIndex
        });
      }
    }
  }

  lines.forEach((line, index) => {
    if (!/^(remote|workplace type)\s*:/i.test(line)) {
      return;
    }

    const normalized = normalizeLocationCandidate(line);
    if (!normalized) {
      return;
    }

    seeds.push({
      value: normalized,
      source: "label",
      raw: line,
      index
    });
  });

  return seeds;
}

function collectSummaryLocationSeeds(lines: string[]) {
  const summary = extractSummaryLine(lines);
  if (!summary) {
    return [];
  }

  const summaryIndex = lines.findIndex((line) => line === summary);
  const summaryCandidates = parseCompanyAndLocationFromSummary(summary).locationCandidates;

  return summaryCandidates.map((candidate) => ({
    value: candidate,
    source: "summary" as const,
    raw: summary,
    index: summaryIndex >= 0 ? summaryIndex : 0
  }));
}

function collectPostingMetaLocationSeeds(lines: string[]) {
  const seeds: LocationCandidateSeed[] = [];

  lines.forEach((line, index) => {
    const candidate = extractLocationFromPostingMetaLine(line);
    if (!candidate) {
      return;
    }

    seeds.push({
      value: candidate,
      source: "postingMeta",
      raw: line,
      index
    });
  });

  return seeds;
}

function collectTopLocationSeeds(lines: string[]) {
  const seeds: LocationCandidateSeed[] = [];
  const maxIndex = Math.min(lines.length, 18);

  for (let index = 0; index < maxIndex; index += 1) {
    const line = lines[index];
    if (
      /^(location|remote|workplace type|company|employment type|worker sub-type|worker sub type|category|req id)\s*:/i.test(
        line
      )
    ) {
      continue;
    }

    const normalized = normalizeLocationCandidate(line);
    if (!normalized || !looksLikeLocationShape(normalized)) {
      continue;
    }

    seeds.push({
      value: normalized,
      source: "top",
      raw: line,
      index
    });
  }

  return seeds;
}

function isNoiseLine(line: string) {
  const trimmed = cleanLine(line);

  if (!trimmed) {
    return true;
  }

  if (linkedinNoisePatterns.some((pattern) => pattern.test(trimmed))) {
    return true;
  }

  return false;
}

function normalizeLines(rawText: string) {
  return rawText
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => cleanLine(line))
    .filter((line) => !isNoiseLine(line));
}

function emptyFieldOrigins(): Partial<Record<JobField, FieldOrigin>> {
  return {
    roleTitle: "missing",
    company: "missing",
    location: "missing",
    link: "missing",
    jobDescription: "missing"
  };
}

function detectTextSource(rawText: string): {
  sourceType: SourceType;
  sourceConfidence: SourceConfidence;
} {
  const joined = rawText.toLowerCase();

  if (
    joined.includes("easy apply") ||
    joined.includes("resume match") ||
    joined.includes("promoted by hirer") ||
    joined.includes("linkedin")
  ) {
    return {
      sourceType: "linkedin",
      sourceConfidence: "low"
    };
  }

  return {
    sourceType: "unknown",
    sourceConfidence: "unknown"
  };
}

function isSectionHeader(line: string) {
  return sectionHeaders.has(line.toLowerCase());
}

function isMetadataLine(line: string) {
  const lower = line.toLowerCase();

  if (isSectionHeader(line)) {
    return true;
  }

  if (
    lower === "student programs" ||
    lower === "full time" ||
    lower === "contract" ||
    lower === "remote" ||
    lower === "on-site" ||
    lower === "hybrid" ||
    lower === "yes"
  ) {
    return true;
  }

  return Array.from(metadataLabels).some((label) =>
    lower.startsWith(`${label}:`)
  );
}

function extractLabeledValue(lines: string[], label: string) {
  const lowerLabel = label.toLowerCase();

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const lower = line.toLowerCase();

    if (!lower.startsWith(`${lowerLabel}:`)) {
      continue;
    }

    const inlineValue = cleanLine(line.slice(label.length + 1));

    if (inlineValue) {
      return {
        value: inlineValue,
        startIndex: index
      };
    }

    const next = lines[index + 1] ?? "";
    if (next && !isMetadataLine(next)) {
      return {
        value: next,
        startIndex: index + 1
      };
    }
  }

  return null;
}

function extractSummaryLine(lines: string[]) {
  return (
    lines.find((line) => {
      const normalized = line.toLowerCase();

      if (
        normalized.includes("applicants") ||
        normalized.includes("hours ago") ||
        normalized.includes("minutes ago") ||
        normalized.includes("days ago")
      ) {
        return false;
      }

      return /^[^·]+ · [^(]+(?: \((?:On-site|Remote|Hybrid)\))?$/i.test(line);
    }) ?? ""
  );
}

function parseCompanyAndLocationFromSummary(summaryLine: string) {
  if (!summaryLine) {
    return {
      company: "",
      locationCandidates: []
    };
  }

  const [companyPart, locationPart] = summaryLine.split(" · ");
  const company = cleanLine(companyPart ?? "");
  const rawLocation = cleanLine(locationPart ?? "");
  const primaryLocation = normalizeLocationCandidate(
    rawLocation.replace(/\((?:On-site|Remote|Hybrid)\)/gi, "")
  );
  const normalizedFullLocation = normalizeLocationCandidate(rawLocation);

  return {
    company,
    locationCandidates: uniqueValues(
      [normalizedFullLocation, primaryLocation].filter(Boolean)
    )
  };
}

function looksLikeRoleTitle(line: string) {
  if (line.length < 4 || line.length > 120) {
    return false;
  }

  if (isMetadataLine(line)) {
    return false;
  }

  if (/^Req ID\b/i.test(line)) {
    return false;
  }

  if (
    /^(Agility Partners|Save|Easy Apply|Contract|On-site|Remote|Hybrid)$/i.test(
      line
    )
  ) {
    return false;
  }

  if (/[·]/.test(line)) {
    return false;
  }

  if (/applicants/i.test(line)) {
    return false;
  }

  return /(engineer|analyst|scientist|manager|intern|developer|specialist|consultant|associate|administrator|architect|lead|director)/i.test(
    line
  );
}

function extractRoleTitle(lines: string[]) {
  for (const line of lines.slice(0, 14)) {
    if (looksLikeRoleTitle(line)) {
      return line;
    }
  }

  return "";
}

function looksLikeCompanyName(line: string, roleTitle: string) {
  if (!line || line === roleTitle) {
    return false;
  }

  if (isMetadataLine(line)) {
    return false;
  }

  if (line.includes("·") || line.includes("|") || line.includes(":")) {
    return false;
  }

  if (
    /(minutes ago|hours ago|days ago|clicked apply|applicants|remote|on-site|hybrid|full-time|part-time|contract|easy apply|resume match|show match details|tailor my resume)/i.test(
      line
    )
  ) {
    return false;
  }

  return /^[A-Za-z0-9&.,'()\-\/\s]+$/.test(line);
}

function extractCompanyName(lines: string[], roleTitle: string) {
  const companyResult = extractLabeledValue(lines, "Company");
  if (companyResult?.value) {
    return companyResult.value;
  }

  const summaryLine = extractSummaryLine(lines);
  const summaryCompany = parseCompanyAndLocationFromSummary(summaryLine).company;
  if (summaryCompany) {
    return summaryCompany;
  }

  const saveLine = lines.find((line) =>
    new RegExp(`^Save\\s+${escapeRegExp(roleTitle)}\\s+at\\s+(.+)$`, "i").test(line)
  );
  if (saveLine) {
    const match = saveLine.match(
      new RegExp(`^Save\\s+${escapeRegExp(roleTitle)}\\s+at\\s+(.+)$`, "i")
    );
    const extracted = cleanLine(match?.[1] ?? "");
    if (extracted) {
      return extracted;
    }
  }

  const topLines = lines.slice(0, 8);
  for (let index = 0; index < topLines.length; index += 1) {
    const line = topLines[index];
    if (!looksLikeCompanyName(line, roleTitle)) {
      continue;
    }

    const next = topLines[index + 1] ?? "";
    const previous = topLines[index - 1] ?? "";
    if (
      next === roleTitle ||
      looksLikeRoleTitle(next) ||
      /(minutes ago|hours ago|days ago|clicked apply|applicants)/i.test(next) ||
      /^location:?$/i.test(next) ||
      previous === roleTitle ||
      looksLikeRoleTitle(previous)
    ) {
      return line;
    }
  }

  return "";
}

function extractLocationCandidates(lines: string[]) {
  const seeds = [
    ...collectLabelLocationSeeds(lines),
    ...collectSummaryLocationSeeds(lines),
    ...collectPostingMetaLocationSeeds(lines),
    ...collectTopLocationSeeds(lines)
  ];

  return rankLocationCandidates(seeds);
}

function extractDescription(lines: string[]) {
  const aboutIndex = lines.findIndex(
    (line) =>
      line.toLowerCase() === "about the job" ||
      line.toLowerCase() === "description"
  );

  if (aboutIndex === -1) {
    return "";
  }

  const collected: string[] = [];

  for (let index = aboutIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];

    if (
      /^people you can reach out to$/i.test(line) ||
      /^about the company$/i.test(line) ||
      pastedTextFormStopPatterns.some((pattern) => pattern.test(line))
    ) {
      break;
    }

    collected.push(line);
  }

  return collected.join("\n\n").trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function cleanDescriptionText(
  description: string,
  context: {
    roleTitle: string;
    company: string;
    location: string;
  }
) {
  let next = description.trim();

  const removablePrefixes = [
    context.roleTitle ? `Position: ${context.roleTitle}` : "",
    context.roleTitle ? `Job Title: ${context.roleTitle}` : "",
    context.company ? `Company: ${context.company}` : "",
    context.location ? `Location: ${context.location}` : ""
  ].filter(Boolean);
  const genericLeadingMetadata = [
    /^Position:\s*.+?(?=\s+(?:Job Title:|Company:|Location:|Summary:)|$)/i,
    /^Job Title:\s*.+?(?=\s+(?:Position:|Company:|Location:|Summary:)|$)/i,
    /^Company:\s*.+?(?=\s+(?:Position:|Job Title:|Location:|Summary:)|$)/i,
    /^Location:\s*.+?(?=\s+(?:Position:|Job Title:|Company:|Summary:)|$)/i
  ];

  let changed = true;
  while (changed) {
    changed = false;

    for (const prefix of removablePrefixes) {
      const regex = new RegExp(`^${escapeRegExp(prefix)}\\s*`, "i");
      if (regex.test(next)) {
        next = next.replace(regex, "").trim();
        changed = true;
      }
    }

    const summaryRegex = /^Summary:\s*/i;
    if (summaryRegex.test(next)) {
      next = next.replace(summaryRegex, "").trim();
      changed = true;
    }

    for (const regex of genericLeadingMetadata) {
      if (regex.test(next)) {
        next = next.replace(regex, "").trim();
        changed = true;
      }
    }
  }

  return next;
}

function buildDraft(result: ExtractionResult): JobDraft {
  return {
    inputMode: "text",
    roleTitle: result.fields.roleTitle ?? "",
    company: result.fields.company ?? "",
    location: result.fields.location ?? "",
    link: "",
    jobDescription: result.fields.jobDescription ?? "",
    sourceType: result.sourceType,
    sourceConfidence: result.sourceConfidence,
    extractionStatus: result.extractionStatus,
    fieldOrigins: result.fieldOrigins,
    candidateValues: result.candidateValues,
    issues: []
  };
}

export function extractJobFromText(rawText: string): ExtractionResult {
  const trimmedText = rawText.trim();

  if (!trimmedText) {
    return {
      normalizedUrl: "",
      inputMode: "text",
      sourceType: "unknown",
      sourceConfidence: "unknown",
      extractionStatus: "needs_review",
      supported: true,
      fields: {
        link: ""
      },
      fieldOrigins: {
        link: "missing"
      },
      candidateValues: {},
      issues: [
        {
          field: "jobDescription",
          type: "missing",
          message: "Paste the job text before saving."
        }
      ],
      notes: ["Manual text input was empty."]
    };
  }

  const lines = normalizeLines(trimmedText);
  const source = detectTextSource(trimmedText);
  const roleTitle = extractRoleTitle(lines);
  const summaryLine = extractSummaryLine(lines);
  const summary = parseCompanyAndLocationFromSummary(summaryLine);
  const company = extractCompanyName(lines, roleTitle) || summary.company;
  const locationCandidates = extractLocationCandidates(lines);
  const description = cleanDescriptionText(extractDescription(lines), {
    roleTitle,
    company,
    location: locationCandidates[0] ?? ""
  });
  const fieldOrigins = emptyFieldOrigins();

  if (roleTitle) {
    fieldOrigins.roleTitle = "confirmed";
  }
  if (company) {
    fieldOrigins.company = "confirmed";
  }
  if (locationCandidates.length) {
    fieldOrigins.location = "confirmed";
  }
  if (description) {
    fieldOrigins.jobDescription = "confirmed";
  }

  const result: ExtractionResult = {
    normalizedUrl: "",
    inputMode: "text",
    sourceType: source.sourceType,
    sourceConfidence: source.sourceConfidence,
    extractionStatus: "needs_review",
    supported: true,
    fields: {
      roleTitle,
      company,
      location: locationCandidates[0] ?? "",
      link: "",
      jobDescription: description
    },
    fieldOrigins,
    candidateValues: {
      roleTitle: roleTitle ? [roleTitle] : [],
      company: company ? [company] : [],
      location: locationCandidates,
      jobDescription: description ? [description] : []
    },
    issues: [],
    notes: [
      source.sourceType === "linkedin"
        ? "LinkedIn pasted text was cleaned before parsing."
        : "Job text was parsed locally and may still need review."
    ]
  };

  const draft = buildDraft(result);
  const issues = validateJobDraft(draft);

  return {
    ...result,
    issues,
    extractionStatus: issues.length > 0 ? "needs_review" : "confirmed"
  };
}
