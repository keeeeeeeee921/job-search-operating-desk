/**
 * Shared cleanup for the three scraped identity fields (company, role title,
 * location). Used at extraction time (server HTML extractor and pasted-text
 * extractor), as a last safety net before a record is saved, and by
 * scripts/repair-extraction-noise.ts for records that are already stored.
 *
 * Kept free of DOM / cheerio imports so it can run in the browser bundle too.
 */

/** Acronyms that title-casing must not turn into "Ii", "Usa", "Fp&a". */
export const TITLE_ACRONYMS = [
  "II",
  "III",
  "IV",
  "USA",
  "AI",
  "BI",
  "SQL",
  "FP&A",
  "HR",
  "IT",
  "QA",
  "UX",
  "ML",
  "NLP",
  "ETL",
  "SaaS",
  "B2B",
  "MS",
  "BS",
  "PhD"
] as const;

const acronymByLowercase = new Map<string, string>(
  TITLE_ACRONYMS.map((acronym) => [acronym.toLowerCase(), acronym])
);

/**
 * Acronyms that are also ordinary English words ("Do it Best", "Hit It Rich").
 * They are only restored where the context reads as an acronym: at the start
 * of the value, right after a separator, or before a typical IT/HR noun.
 */
const AMBIGUOUS_ACRONYMS = new Set(["it", "ms", "bs"]);

const ACRONYM_CONTEXT_NOUNS =
  /^(analyst|analytics|data|infrastructure|operations|ops|support|systems?|security|services?|business|manager|specialist|intern|project|program|product|help\s*desk|service\s*desk|engineer|technician|director|lead|audit|governance|risk|compliance|strategy|consultant|coordinator|administrator|architect|team|department|degree|student)\b/i;

/** Returns the canonical spelling when `token` is a known acronym. */
export function canonicalAcronym(token: string) {
  return acronymByLowercase.get(token.toLowerCase()) ?? null;
}

function trimSeparators(value: string) {
  return value.replace(/^[\s·•|]+/, "").replace(/[\s·•|]+$/, "");
}

const namedEntities: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  trade: "™",
  reg: "®",
  copy: "©"
};

/**
 * Decodes HTML entities (&amp; &#39; &#x27; &quot; ...) that survived
 * extraction, repeating until stable so double-encoded "&amp;amp;" resolves.
 */
export function decodeHtmlEntities(value: string) {
  let current = value;

  for (let pass = 0; pass < 3; pass += 1) {
    const next = current.replace(
      /&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,
      (match, body: string) => {
        if (body.startsWith("#x") || body.startsWith("#X")) {
          const codePoint = Number.parseInt(body.slice(2), 16);
          return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
        }

        if (body.startsWith("#")) {
          const codePoint = Number.parseInt(body.slice(1), 10);
          return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
        }

        return namedEntities[body.toLowerCase()] ?? match;
      }
    );

    if (next === current) {
      break;
    }

    current = next;
  }

  return current;
}

function collapseWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

/**
 * Posting metadata that career sites glue onto the location cell, often with
 * no separator: "San JoseEmployment Type:RegularJob Code:A107949".
 */
const LOCATION_SUFFIX_NOISE =
  /\s*(?:employment\s*type|job\s*code|job\s*type|job\s*id|job\s*number|req(?:uisition)?\s*(?:id|number)?|posting\s*date|date\s*posted|time\s*type|schedule|shift|category|job\s*category|job\s*family|position\s*type|work\s*type|job\s*req\s*id)\s*:.*$/i;

/** Aggregator chrome such as "Amazon.jobs · s" is not a location at all. */
const LOCATION_AGGREGATOR_PREFIX = /^(?:amazon\.jobs|linkedin|indeed|glassdoor)\b\s*(?:[·•|-]\s*)?/i;

/**
 * Cuts posting metadata off the end of a location and drops aggregator
 * chrome. Returns "" when nothing location-like is left (the caller decides
 * whether an empty location is acceptable).
 */
export function stripLocationNoise(value: string) {
  let cleaned = collapseWhitespace(decodeHtmlEntities(value));

  cleaned = cleaned.replace(LOCATION_SUFFIX_NOISE, "");
  cleaned = cleaned.replace(LOCATION_AGGREGATOR_PREFIX, "");
  cleaned = cleaned.replace(/[\s,·•|-]+$/g, "").replace(/^[\s,·•|-]+/g, "");
  cleaned = collapseWhitespace(cleaned);

  // A single leftover letter ("s") is a fragment, not a place.
  if (/^[a-z]$/i.test(cleaned)) {
    return "";
  }

  return cleaned;
}

/**
 * Restores whitelisted acronyms that an earlier title-case pass flattened:
 * "Data Analyst Ii" -> "Data Analyst II", "(usa) Senior" -> "(USA) Senior",
 * "Fp&a Analyst" -> "FP&A Analyst". Other words are left untouched, so this
 * is safe to run over manually edited values.
 */
export function restoreAcronymCasing(value: string) {
  const parts = value.split(/(\s+)/);
  const words = parts.filter((part) => part.trim());

  return parts
    .map((part) => {
      if (!part.trim()) {
        return part;
      }

      const match = part.match(/^([^A-Za-z0-9&]*)([A-Za-z0-9&]+)([^A-Za-z0-9&]*)$/);
      if (!match) {
        return part;
      }

      const [, leading, core, trailing] = match;
      const canonical = canonicalAcronym(core);
      if (!canonical) {
        return part;
      }

      if (AMBIGUOUS_ACRONYMS.has(core.toLowerCase())) {
        const index = words.indexOf(part);
        const previous = index > 0 ? words[index - 1] ?? "" : "";
        const next = words[index + 1] ?? "";
        const afterSeparator =
          index === 0 || Boolean(leading) || /[,\-–—(/&:|·•]$/.test(previous);
        const beforeContextNoun = ACRONYM_CONTEXT_NOUNS.test(next.replace(/^[^A-Za-z]+/, ""));

        if (!afterSeparator && !beforeContextNoun) {
          return part;
        }
      }

      return `${leading}${canonical}${trailing}`;
    })
    .join("");
}

export function cleanRoleTitleNoise(value: string) {
  return restoreAcronymCasing(
    trimSeparators(collapseWhitespace(decodeHtmlEntities(value)))
  );
}

export function cleanCompanyNoise(value: string) {
  return restoreAcronymCasing(
    trimSeparators(collapseWhitespace(decodeHtmlEntities(value)))
  );
}

export function cleanLocationNoise(value: string) {
  return restoreAcronymCasing(stripLocationNoise(value));
}

export type JobIdentityFields = {
  company: string;
  roleTitle: string;
  location: string;
};

export function cleanJobIdentityFields(fields: JobIdentityFields): JobIdentityFields {
  return {
    company: cleanCompanyNoise(fields.company),
    roleTitle: cleanRoleTitleNoise(fields.roleTitle),
    location: cleanLocationNoise(fields.location)
  };
}
