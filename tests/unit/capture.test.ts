import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildCaptureBookmarklet,
  buildCaptureScript,
  CAPTURE_MAX_TEXT_CHARS,
  CAPTURE_MESSAGE_TYPE,
  parseCapturePayload
} from "@/lib/capture";
import {
  buildCaptureDraft,
  locatePostingBody,
  normalizeCapturedText
} from "@/lib/server/capture-service";
import { extractCandidatesFromHtml } from "@/lib/server/extraction-service";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn()
}));

const cookieJar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      cookieJar.has(name) ? { name, value: cookieJar.get(name) } : undefined
  })
}));

delete process.env.DATABASE_URL;
delete process.env.DATABASE_URL_UNPOOLED;
delete process.env.VERCEL;
process.env.JOB_DESK_DB_DIR = ".data/job-desk-vitest";

function readFixture(name: string) {
  return readFileSync(
    `${process.cwd()}/tests/fixtures/company-pages/${name}`,
    "utf8"
  );
}

const workdayUrl =
  "https://cvshealth.wd1.myworkdayjobs.com/en-US/CVS_Health_Careers/job/IL--Chicago/Analyst--Development-Program_R0834053";

const renderedText = `Analyst, Development Program

Why Oak Street Health?
We are rebuilding healthcare as it should be.

Responsibilities
- Build weekly reporting for the development team.
- Partner with finance on the site pipeline.

Qualifications
- 1+ years of analytical experience.`;

describe("capture bookmarklet", () => {
  it("is a javascript: URL that carries only the desk's origin", () => {
    const origin = "https://desk.example.test";
    const bookmarklet = buildCaptureBookmarklet(origin);

    expect(bookmarklet.startsWith("javascript:")).toBe(true);
    const script = decodeURIComponent(bookmarklet.slice("javascript:".length));
    expect(script).toBe(buildCaptureScript(origin));
    expect(script).toContain(JSON.stringify(origin));
    // No credential of any kind is baked in, and the page is opened without
    // query parameters.
    expect(script).not.toMatch(/token|cookie|password|secret/i);
    expect(script).toContain('window.open(T+"/",');
    // The payload is only ever addressed to the desk's origin.
    expect(script).toContain("w.postMessage(p,T)");
    expect(script).toContain("e.origin!==T");
  });

  it("parses as JavaScript", () => {
    expect(
      () => new Function(buildCaptureScript("https://desk.example.test"))
    ).not.toThrow();
  });
});

describe("parseCapturePayload", () => {
  it("accepts a well-formed capture", () => {
    expect(
      parseCapturePayload({
        type: CAPTURE_MESSAGE_TYPE,
        url: workdayUrl,
        title: "Analyst",
        text: "Body",
        html: "<html></html>"
      })
    ).toEqual({ url: workdayUrl, title: "Analyst", text: "Body", html: "<html></html>" });
  });

  it("ignores anything else a window might post", () => {
    expect(parseCapturePayload(null)).toBeNull();
    expect(parseCapturePayload("job-desk-capture-ready")).toBeNull();
    expect(parseCapturePayload({ type: "other", url: workdayUrl, text: "x" })).toBeNull();
    expect(parseCapturePayload({ type: CAPTURE_MESSAGE_TYPE, url: 1, text: "x" })).toBeNull();
    expect(parseCapturePayload({ type: CAPTURE_MESSAGE_TYPE, url: workdayUrl })).toBeNull();
  });
});

describe("buildCaptureDraft", () => {
  it("keeps the page text verbatim and reads identity fields from the captured DOM", () => {
    const result = buildCaptureDraft({
      url: `${workdayUrl}?source=Linkedin#apply`,
      title: "Analyst, Development Program",
      text: renderedText,
      html: readFixture("cvs-workday.html")
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    const { draft } = result;
    expect(draft.jobDescription).toBe(renderedText);
    expect(draft.fieldOrigins.jobDescription).toBe("confirmed");
    expect(draft.roleTitle).toBe("Analyst, Development Program");
    expect(draft.company).toBe("Oak Street Health");
    expect(draft.location).toBe("United States (Remote)");
    expect(draft.fieldOrigins.roleTitle).toBe("confirmed");
    expect(draft.inputMode).toBe("link");
    expect(draft.sourceType).toBe("workday");
    // Same normalization as the Paste link path, so duplicate matching on
    // the link compares like with like.
    expect(draft.link).not.toContain("#apply");
    expect(draft.issues).toEqual([]);
  });

  it("falls back to URL hints that still need a person to confirm them", () => {
    const result = buildCaptureDraft({
      url: workdayUrl,
      title: "",
      text: renderedText,
      html: ""
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    const { draft } = result;
    expect(draft.jobDescription).toBe(renderedText);
    expect(draft.fieldOrigins.roleTitle).toBe("derived");
    expect(draft.fieldOrigins.company).toBe("derived");
    expect(draft.fieldOrigins.location).toBe("missing");
    expect(draft.issues.map((issue) => issue.field)).toEqual(
      expect.arrayContaining(["roleTitle", "company", "location"])
    );
    expect(draft.issues.map((issue) => issue.field)).not.toContain("jobDescription");
  });

  it("reports a missing description when the page gave no text", () => {
    const result = buildCaptureDraft({ url: workdayUrl, title: "", text: "  ", html: "" });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.draft.fieldOrigins.jobDescription).toBe("missing");
      expect(result.draft.issues.map((issue) => issue.field)).toContain("jobDescription");
    }
  });

  it("rejects non-web URLs and oversized text", () => {
    expect(
      buildCaptureDraft({ url: "javascript:alert(1)", title: "", text: "x", html: "" })
    ).toMatchObject({ ok: false, status: 400 });
    expect(
      buildCaptureDraft({ url: "file:///etc/passwd", title: "", text: "x", html: "" })
    ).toMatchObject({ ok: false, status: 400 });
    expect(
      buildCaptureDraft({
        url: workdayUrl,
        title: "",
        text: "x".repeat(CAPTURE_MAX_TEXT_CHARS + 1),
        html: ""
      })
    ).toMatchObject({ ok: false, status: 413 });
  });

  it("tidies whitespace without changing the wording", () => {
    expect(
      normalizeCapturedText("  Line one \r\n\r\n\r\n\r\n\u200bLine\u00a0two\t\n")
    ).toBe("Line one\n\nLine two");
  });
});

// A posting as a Workday-style page renders it: navigation above, the body in
// the middle, the footer below. The structured data carries the same body on
// one line and an internal site code as the locality.
const bodyParagraphs = [
  "About the team",
  "The Missouri analytics group turns meter, outage and billing data into the weekly operating read for regional leadership.",
  "Key responsibilities",
  "Build and maintain the weekly performance reporting for the regional operations leads.",
  "Investigate week-over-week movements and explain what drove them in plain language.",
  "Qualifications",
  "Bachelor's degree and two or more years of analytical experience with SQL and a BI tool.",
  "All qualified applicants will receive consideration for employment without regard to any status protected by law."
];
const renderedBody = bodyParagraphs.join("\n\n");
const flattenedBody = bodyParagraphs.join(" ");
const pageWithChrome = `Skip to main content
Sign In
Search for Jobs
Data Analyst (Regional Analytics)
Apply
locations
St. Louis, MO
time type
Full time
job requisition id
034518

${renderedBody}

Follow Us
© 2026 Example ATS, Inc. All rights reserved.`;

function postingHtml(description: string, locality: string) {
  const jsonLd = {
    "@context": "http://schema.org",
    "@type": "JobPosting",
    title: "Data Analyst (Regional Analytics)",
    description,
    hiringOrganization: { "@type": "Organization", name: "Example Utility" },
    jobLocation: {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        addressCountry: "United States of America",
        addressLocality: locality
      }
    }
  };

  return `<html><head><title>Data Analyst (Regional Analytics)</title>
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script></head>
<body><div id="root"></div></body></html>`;
}

const exampleWorkdayUrl =
  "https://example.wd1.myworkdayjobs.com/en-US/External/job/St-Louis-MO/Data-Analyst_034518";

describe("locatePostingBody", () => {
  it("returns the rendered body between the description's first and last words", () => {
    expect(locatePostingBody(pageWithChrome, flattenedBody)).toBe(renderedBody);
  });

  it("matches regardless of case and spacing differences in the rendering", () => {
    const shouting = pageWithChrome.replace("About the team", "ABOUT THE TEAM");
    expect(locatePostingBody(shouting, flattenedBody)).toBe(
      renderedBody.replace("About the team", "ABOUT THE TEAM")
    );
  });

  it("leaves the page alone for a teaser", () => {
    expect(locatePostingBody(pageWithChrome, flattenedBody.slice(0, 160))).toBeNull();
  });

  it("leaves the page alone when the described body is under half of the page", () => {
    // Most of this page is something the description does not cover, so the
    // description may be partial; nothing is cut.
    const longPage = `${pageWithChrome}\n\n${"More about working here. ".repeat(40)}`;
    expect(locatePostingBody(longPage, flattenedBody)).toBeNull();
  });

  it("leaves the page alone when either end cannot be found", () => {
    expect(
      locatePostingBody(pageWithChrome, `${flattenedBody} Apply before the closing date shown above.`)
    ).toBeNull();
    expect(
      locatePostingBody(pageWithChrome, `Posted by the talent team this week. ${flattenedBody}`)
    ).toBeNull();
  });

  it("leaves the page alone when the two ends are much further apart than the description", () => {
    const padded = pageWithChrome.replace(
      "Qualifications",
      `${"An unrelated block the description does not contain. ".repeat(12)}\n\nQualifications`
    );
    expect(locatePostingBody(padded, flattenedBody)).toBeNull();
  });
});

describe("capture of a page with navigation and an internal site code", () => {
  it("drops the internal location label in the shared parser", () => {
    const result = extractCandidatesFromHtml(
      postingHtml(flattenedBody, "001X HQ (St_Louis_MO)"),
      exampleWorkdayUrl
    );

    expect(result.candidateValues.location ?? []).toEqual([]);
    expect(result.fieldOrigins.location).toBe("missing");
  });

  it("keeps an ordinary locality in the shared parser", () => {
    const result = extractCandidatesFromHtml(
      postingHtml(flattenedBody, "St. Louis"),
      exampleWorkdayUrl
    );

    expect(result.fields.location).toBe("St. Louis, United States");
  });

  it("saves the body without the page chrome and reads the location off the page", () => {
    const built = buildCaptureDraft({
      url: exampleWorkdayUrl,
      title: "Data Analyst (Regional Analytics)",
      text: pageWithChrome,
      html: postingHtml(flattenedBody, "001X HQ (St_Louis_MO)")
    });

    expect(built.ok).toBe(true);
    if (!built.ok) {
      return;
    }

    const { draft } = built;
    expect(draft.jobDescription).toBe(renderedBody);
    expect(draft.jobDescription).not.toContain("Skip to main content");
    expect(draft.jobDescription).not.toContain("All rights reserved");
    expect(draft.location).toBe("St. Louis, MO");
    expect(draft.fieldOrigins.location).toBe("confirmed");
    expect(draft.location).not.toContain("_");
    expect(draft.roleTitle).toBe("Data Analyst (Regional Analytics)");
    expect(draft.company).toBe("Example Utility");
  });

  it("keeps the whole page text when the page publishes only a teaser", () => {
    const built = buildCaptureDraft({
      url: exampleWorkdayUrl,
      title: "Data Analyst (Regional Analytics)",
      text: pageWithChrome,
      html: postingHtml(flattenedBody.slice(0, 160), "St. Louis")
    });

    expect(built.ok).toBe(true);
    if (built.ok) {
      expect(built.draft.jobDescription).toBe(pageWithChrome);
    }
  });
});

describe("POST /api/capture", () => {
  const body = JSON.stringify({
    type: CAPTURE_MESSAGE_TYPE,
    url: workdayUrl,
    title: "Analyst, Development Program",
    text: renderedText,
    html: ""
  });

  function captureRequest(payload = body) {
    return new Request("http://localhost:3000/api/capture", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload
    });
  }

  beforeEach(() => {
    process.env.JOB_DESK_ACCESS_TOKEN = "unit-test-token";
  });

  afterEach(() => {
    cookieJar.clear();
    delete process.env.JOB_DESK_ACCESS_TOKEN;
    delete process.env.JOB_DESK_PUBLIC_DEMO;
  });

  it("refuses a caller without the access cookie", async () => {
    const { POST } = await import("@/app/api/capture/route");
    const response = await POST(captureRequest());

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: expect.stringContaining("access token")
    });
  });

  it("refuses a caller with the wrong cookie", async () => {
    cookieJar.set("job_desk_token", "not-the-token");
    const { POST } = await import("@/app/api/capture/route");

    expect((await POST(captureRequest())).status).toBe(401);
  });

  it("refuses the read-only demo", async () => {
    process.env.JOB_DESK_PUBLIC_DEMO = "true";
    const { POST } = await import("@/app/api/capture/route");

    expect((await POST(captureRequest())).status).toBe(403);
  });

  it("answers a signed-in caller with a review draft and saves nothing", async () => {
    cookieJar.set("job_desk_token", "unit-test-token");
    const { resetDatabaseForTests, getRecentActiveJobs } = await import(
      "@/lib/db/repository"
    );
    await resetDatabaseForTests();
    const before = await getRecentActiveJobs(50, "all");

    const { POST } = await import("@/app/api/capture/route");
    const response = await POST(captureRequest());
    const payload = (await response.json()) as {
      status: string;
      draft: { jobDescription: string };
    };

    expect(response.status).toBe(200);
    expect(payload.status).toBe("review");
    expect(payload.draft.jobDescription).toBe(renderedText);
    expect(await getRecentActiveJobs(50, "all")).toEqual(before);
  });

  it("rejects a body that is not a capture", async () => {
    cookieJar.set("job_desk_token", "unit-test-token");
    const { POST } = await import("@/app/api/capture/route");

    expect((await POST(captureRequest("not json"))).status).toBe(400);
    expect((await POST(captureRequest(JSON.stringify({ url: workdayUrl })))).status).toBe(400);
  });
});

describe("saving a reviewed capture", () => {
  beforeEach(async () => {
    delete process.env.JOB_DESK_ACCESS_TOKEN;
    const { resetDatabaseForTests } = await import("@/lib/db/repository");
    await resetDatabaseForTests();
  });

  it("stores the page text as the description and the notes as comments", async () => {
    const built = buildCaptureDraft({
      url: workdayUrl,
      title: "Analyst, Development Program",
      text: renderedText,
      html: readFixture("cvs-workday.html")
    });
    expect(built.ok).toBe(true);
    if (!built.ok) {
      return;
    }

    const { saveReviewedJob } = await import("@/app/actions");
    const notes = "Applied 2026-11-18 with resume resume_v7.pdf. Confirmation email received.";
    const saved = await saveReviewedJob({ ...built.draft, notes: `  ${notes}\n` });

    expect(saved.status).toBe("saved");
    if (saved.status !== "saved") {
      return;
    }

    expect(saved.record.jobDescription).toBe(renderedText);
    expect(saved.record.jobDescription).not.toContain("Applied 2026-11-18");
    expect(saved.record.comments).toBe(notes);
    expect(saved.record.pool).toBe("active");

    // Submitting the same posting again is caught by the existing duplicate
    // check instead of creating a second record.
    const again = await saveReviewedJob({ ...built.draft });
    expect(again.status).toBe("duplicate");
  });

  it("leaves comments empty when no notes were typed", async () => {
    const built = buildCaptureDraft({
      url: workdayUrl,
      title: "",
      text: renderedText,
      html: readFixture("cvs-workday.html")
    });
    if (!built.ok) {
      throw new Error("expected a draft");
    }

    const { saveReviewedJob } = await import("@/app/actions");
    const saved = await saveReviewedJob(built.draft);

    expect(saved.status).toBe("saved");
    if (saved.status === "saved") {
      expect(saved.record.comments).toBe("");
    }
  });
});
