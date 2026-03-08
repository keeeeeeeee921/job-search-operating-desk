import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import * as XLSX from "xlsx";
import {
  cleanCompanyCell,
  collapseImportText,
  historicalImportSheets,
  isBlankHistoricalRow,
  isImportableHistoricalDraft,
  mapHistoricalRowToDraft,
  type HistoricalImportSheetName,
  type HistoricalWorkbookInputRow
} from "../lib/historical-import";

type CorpusSelector = {
  id: string;
  label: string;
  sheetName: HistoricalImportSheetName;
  match: RegExp;
};

type CorpusEntry = {
  id: string;
  label: string;
  sourceFamily: string;
  sheetName: HistoricalImportSheetName;
  input: string;
  expected: {
    roleTitle: string;
    company: string;
    location: string;
    jobDescriptionExcerpt: string;
  };
};

const selectors: CorpusSelector[] = [
  { id: "tesla-us", label: "Tesla careers", sheetName: "进行中", match: /tesla\.com/i },
  { id: "tiktok-us", label: "TikTok careers", sheetName: "进行中", match: /lifeattiktok/i },
  { id: "stripe-us", label: "Stripe listing (US)", sheetName: "进行中", match: /stripe\.com/i },
  { id: "stripe-ca", label: "Stripe listing (Canada)", sheetName: "已结束-加拿大", match: /stripe\.com/i },
  { id: "rippling-us", label: "Rippling ATS (US)", sheetName: "进行中", match: /rippling\.com/i },
  { id: "rippling-ca", label: "Rippling ATS (Canada)", sheetName: "已结束-加拿大", match: /rippling\.com/i },
  { id: "greenhouse-us", label: "Greenhouse board (US)", sheetName: "进行中", match: /greenhouse\.io/i },
  { id: "greenhouse-ca", label: "Greenhouse board (Canada)", sheetName: "已结束-加拿大", match: /greenhouse\.io/i },
  { id: "lever-us", label: "Lever board", sheetName: "进行中", match: /lever\.co/i },
  { id: "workday-us", label: "Workday listing (US)", sheetName: "进行中", match: /workday|myworkdayjobs/i },
  { id: "workday-ca", label: "Workday listing (Canada)", sheetName: "进行中-加拿大", match: /myworkdayjobs/i },
  { id: "oracle-us", label: "Oracle Cloud listing (US)", sheetName: "进行中", match: /oraclecloud/i },
  { id: "oracle-ca", label: "Oracle Cloud listing (Canada)", sheetName: "已结束-加拿大", match: /oraclecloud/i },
  { id: "ashby-us", label: "Ashby listing", sheetName: "进行中", match: /ashbyhq/i },
  { id: "linkedin-us", label: "LinkedIn listing", sheetName: "进行中", match: /linkedin\.com/i },
  { id: "smartrecruiters-us", label: "SmartRecruiters listing", sheetName: "进行中", match: /smartrecruiters/i },
  { id: "avature-us", label: "Avature listing", sheetName: "进行中", match: /avature/i },
  { id: "dayforce-us", label: "Dayforce listing", sheetName: "进行中", match: /dayforce/i },
  { id: "adp-us", label: "ADP listing", sheetName: "进行中", match: /adp\.com/i },
  { id: "bamboohr-us", label: "BambooHR listing", sheetName: "进行中", match: /bamboohr/i },
  { id: "careerpuck-ca", label: "Careerpuck listing", sheetName: "进行中-加拿大", match: /careerpuck/i },
  { id: "mastercard-ca", label: "Canada corporate careers", sheetName: "已结束-加拿大", match: /mastercard/i },
  { id: "canadalife-ca", label: "Canada Life listing", sheetName: "进行中-加拿大", match: /canadalife/i },
  { id: "capitalone-ca", label: "Capital One Canada listing", sheetName: "进行中-加拿大", match: /capitalonecareers/i },
  { id: "citi-ca", label: "Citi Canada listing", sheetName: "进行中-加拿大", match: /jobs\.citi\.com/i },
  { id: "no-link-us", label: "No-link pasted text (US)", sheetName: "进行中", match: /^$/ },
  { id: "no-link-ca", label: "No-link pasted text (Canada)", sheetName: "已结束-加拿大", match: /^$/ }
];

function trimDescription(value: string) {
  return collapseImportText(value).slice(0, 420).trim();
}

function descriptionExcerpt(value: string) {
  return trimDescription(value).slice(0, 96).trim();
}

function normalizeExpectedLocation(value: unknown) {
  return collapseImportText(value).replace(/, United States$/i, ", US");
}

function inferSourceFamily(link: string) {
  if (!link) {
    return "pasted-text";
  }

  try {
    const host = new URL(link).hostname.toLowerCase();
    if (host.includes("tesla")) return "tesla";
    if (host.includes("tiktok")) return "tiktok";
    if (host.includes("stripe")) return "stripe";
    if (host.includes("rippling")) return "rippling";
    if (host.includes("greenhouse")) return "greenhouse";
    if (host.includes("lever")) return "lever";
    if (host.includes("workday")) return "workday";
    if (host.includes("oraclecloud")) return "oracle";
    if (host.includes("ashby")) return "ashby";
    if (host.includes("linkedin")) return "linkedin";
    if (host.includes("smartrecruiters")) return "smartrecruiters";
    if (host.includes("avature")) return "avature";
    if (host.includes("dayforce")) return "dayforce";
    if (host.includes("adp")) return "adp";
    if (host.includes("bamboohr")) return "bamboohr";
    if (host.includes("careerpuck")) return "careerpuck";
    return host.replace(/^www\./, "");
  } catch {
    return "pasted-text";
  }
}

function buildInput(index: number, row: {
  roleTitle: string;
  company: string;
  location: string;
  jobDescription: string;
}) {
  const description = trimDescription(row.jobDescription);

  switch (index % 4) {
    case 0:
      return `${row.roleTitle}
${row.company} · ${row.location}
About the job
${description}`;
    case 1:
      return `Req ID: SAMPLE-${index + 1}
${row.roleTitle}
Company: ${row.company}
Location:
${row.location}
Description
${description}`;
    case 2:
      return `${row.company}
${row.roleTitle}
Location:
${row.location}
About the job
${description}`;
    default:
      return `${row.roleTitle}
${row.company}
Location:
${row.location}
Preferred Qualifications
SQL
Communication
About the job
${description}`;
  }
}

async function main() {
  const workbook = XLSX.readFile("/Users/keshi/Downloads/北美秋招.xlsx");
  const entries: CorpusEntry[] = [];

  for (const [index, selector] of selectors.entries()) {
    const sheet = historicalImportSheets.find((item) => item.name === selector.sheetName);
    if (!sheet) {
      throw new Error(`Unknown sheet mapping for ${selector.id}`);
    }

    const rows = XLSX.utils.sheet_to_json<HistoricalWorkbookInputRow>(
      workbook.Sheets[selector.sheetName],
      { defval: "" }
    );

    const match = rows.find((row, rowIndex) => {
      if (isBlankHistoricalRow(row)) {
        return false;
      }

      const draft = mapHistoricalRowToDraft({
        row,
        rowNumber: rowIndex + 2,
        sheetName: selector.sheetName,
        pool: sheet.pool
      });

      if (!isImportableHistoricalDraft(draft)) {
        return false;
      }

      return selector.match.test(draft.link);
    });

    if (!match) {
      throw new Error(`No workbook match found for selector: ${selector.id}`);
    }

    const roleTitle = collapseImportText(match["岗位"]);
    const company = cleanCompanyCell(match["公司-项目"]);
    const location = normalizeExpectedLocation(match["地点"]);
    const jobDescription = collapseImportText(match["JD"]);
    const link = collapseImportText(match["链接"]);

    entries.push({
      id: selector.id,
      label: selector.label,
      sourceFamily: inferSourceFamily(link),
      sheetName: selector.sheetName,
      input: buildInput(index, {
        roleTitle,
        company,
        location,
        jobDescription
      }),
      expected: {
        roleTitle,
        company,
        location,
        jobDescriptionExcerpt: descriptionExcerpt(jobDescription)
      }
    });
  }

  const outputDir = path.join(process.cwd(), "tests", "fixtures");
  await mkdir(outputDir, { recursive: true });
  await writeFile(
    path.join(outputDir, "extraction-corpus.json"),
    `${JSON.stringify(entries, null, 2)}\n`,
    "utf8"
  );

  console.log(`Wrote ${entries.length} extraction corpus samples.`);
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
