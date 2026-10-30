import { expect, test } from "@playwright/test";

// The production server under test requires JOB_DESK_ACCESS_TOKEN
// (see config/playwright.config.ts); present it as the session cookie.
test.beforeEach(async ({ context, baseURL }) => {
  await context.addCookies([
    {
      name: "job_desk_token",
      value: "e2e-access-token",
      url: baseURL ?? "http://127.0.0.1:3000"
    }
  ]);
});

test("saves a fully extracted job into Active", async ({ page, baseURL }) => {
  await page.goto("/");
  await expect(page.getByText("0 / 10").first()).toBeVisible();
  await page.getByPlaceholder("Paste a job link and press Enter").fill(
    `${baseURL}/mock-jobs/aurora-data-analyst`
  );
  await page.keyboard.press("Enter");

  await expect(page.getByText("Saved to Active").first()).toBeVisible();
  await expect(page.getByText("1 / 10").first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Data Analyst" }).first()).toBeVisible();
  await page.goto("/active");
  await expect(page.getByText("Aurora Labs")).toBeVisible();
});

test("requires review when extraction is incomplete", async ({ page }) => {
  await page.goto("/");
  await page.getByPlaceholder("Paste a job link and press Enter").fill(
    "https://www.linkedin.com/jobs/view/123456"
  );
  await page.keyboard.press("Enter");

  await expect(
    page.getByRole("heading", { name: "Review before saving" })
  ).toBeVisible();
  await expect(page.getByText("numeric job ID").first()).toBeVisible();
});

test("saves pasted job text without requiring a link", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Paste job text" }).click();
  const textarea = page.getByPlaceholder(
    "Paste job text. Enter to review, Shift+Enter for a new line."
  );
  await textarea.fill(`Req ID: P25-321635-2
Data Science Intern (Summer 2026)
Company: Federal Express Corporation
Location:
Remote
Description
As a FedEx Intern, you will be working on projects gaining valuable, real-world experience.`);
  await textarea.press("Enter");

  await expect(page.getByText("Saved to Active").first()).toBeVisible();
  await page.goto("/active");
  await expect(
    page.getByRole("link", { name: "Data Science Intern (Summer 2026)" }).first()
  ).toBeVisible();
  await expect(
    page.getByRole("img", {
      name: "No saved posting link for Data Science Intern (Summer 2026)"
    })
  ).toBeVisible();
});

test("shows duplicate modal and respects cancel or continue", async ({ page, baseURL }) => {
  await page.goto("/");
  await page.getByPlaceholder("Paste a job link and press Enter").fill(
    `${baseURL}/mock-jobs/ibm-canada-associate-business-analyst-duplicate`
  );
  await page.keyboard.press("Enter");

  await expect(
    page.getByRole("heading", { name: "Possible duplicate" })
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await page.goto("/active?cycle=older");
  await expect(page.getByText("IBM Canada").first()).toBeVisible();
});

test("Active shows the current cycle by default and keeps older cycles one click away", async ({
  page
}) => {
  await page.goto("/active");
  await expect(page.getByRole("link", { name: /^Search 02 \(\d+\)$/ })).toHaveAttribute(
    "aria-current",
    "page"
  );
  await expect(page.getByText("IBM Canada")).toHaveCount(0);

  const olderLink = page.getByRole("link", { name: /^Older cycles \(\d+\)$/ });
  await expect(olderLink).toBeVisible();
  await olderLink.click();
  await expect(page).toHaveURL(/\/active\?cycle=older/);
  await expect(page.getByText("IBM Canada").first()).toBeVisible();

  await page.getByPlaceholder("Search Active by company or role").fill("IBM");
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page).toHaveURL(/cycle=older/);
  await expect(page).toHaveURL(/q=IBM/);
  await expect(page.getByText("IBM Canada").first()).toBeVisible();

  await page.getByRole("link", { name: /^Search 02 \(\d+\)$/ }).click();
  await expect(page).toHaveURL(/\/active\?q=IBM$/);
  await expect(page.getByText("No matches in Active")).toBeVisible();
});

test("search scans only active records", async ({ page }) => {
  await page.goto("/active");
  await page.getByPlaceholder("Search Active by company or role").fill("Canva");
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page).toHaveURL(/\/active\?q=Canva/);
  await expect(page.getByText("No matches in Active")).toBeVisible();
});

test("unknown Active record shows the not-found page with a 404", async ({ page }) => {
  const response = await page.goto("/active/does-not-exist");
  expect(response?.status()).toBe(404);
  await expect(page.getByText("Active record not found")).toBeVisible();
  await page.getByRole("link", { name: "Back to Active" }).click();
  await expect(page).toHaveURL(/\/active$/);
});

test("unknown routes show the desk's own not-found page", async ({ page }) => {
  const response = await page.goto("/nowhere");
  expect(response?.status()).toBe(404);
  await expect(page.getByText("There is no page at this address")).toBeVisible();
  await expect(page.getByRole("link", { name: "Go to Active" })).toBeVisible();
});

test("comments persist after blur", async ({ page }) => {
  await page.goto("/active?cycle=older");
  await page.getByRole("link", { name: "Business Analyst", exact: true }).click();
  const textarea = page.getByPlaceholder("Add a note...");
  await textarea.fill("Second round interview");
  await textarea.evaluate((element) => {
    (element as HTMLTextAreaElement).blur();
  });
  await page.reload();
  await expect(page.getByPlaceholder("Add a note...")).toHaveValue(
    "Second round interview"
  );
});

test("update by email archives manually", async ({ page }) => {
  await page.goto("/update-by-email");
  const rejectionText = `Hello,\n\nWe appreciate your interest in the Associate Business Analyst - Entry Level role with IBM Canada. After reviewing your background, we have chosen to move forward with other candidates.\n\nThank you again for applying.\n\nIBM Canada Recruiting`;
  const emailInput = page.getByLabel("Email text or job title and company");
  await emailInput.fill(rejectionText);
  await emailInput.press("Enter");
  await expect(
    page.getByRole("button", { name: "Archive to Rejected" }).first()
  ).toBeVisible();
  await expect(emailInput).toHaveValue("");
  await page.getByRole("button", { name: "Archive to Rejected" }).first().click();
  await expect(page.getByText("Moved to Rejected").first()).toBeVisible();
  await page.goto("/rejected");
  await expect(page.getByText("IBM Canada").first()).toBeVisible();
});

test("active records can be deleted from the detail page", async ({ page }) => {
  await page.goto("/active?cycle=older");
  await page.getByRole("link", { name: "Ops Research Scientist I", exact: true }).click();
  page.on("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete record" }).click();
  // Deleting returns to the list view the record was opened from.
  await page.waitForURL("**/active?cycle=older");
  await expect(
    page.getByRole("link", { name: "Ops Research Scientist I", exact: true })
  ).toHaveCount(0);
});

test("Search Log drills into the interviewed subset of a cycle", async ({ page }) => {
  await page.goto("/search-log");
  const row = page.getByRole("region", { name: "Search 01" });
  const all = row.getByRole("button", { name: /^All [\d,]+$/ });
  const interviewed = row.getByRole("button", { name: /^Interviewed [\d,]+$/ });

  await expect(all).toHaveAttribute("aria-pressed", "true");
  await expect(interviewed).toHaveAttribute("aria-pressed", "false");
  await expect(interviewed).toBeEnabled();

  await interviewed.click();

  await expect(interviewed).toHaveAttribute("aria-pressed", "true");
  await expect(all).toHaveAttribute("aria-pressed", "false");
  await expect(
    row.locator('[data-node-label="round_1"]').getByText("Round 1")
  ).toBeVisible();
});

test("editing a cycle's saved story shows the new title", async ({ page }) => {
  await page.goto("/search-log");
  const story = page.getByTestId("search-cycle-story-search-02");
  await expect(story.getByText("No story written for Search 02 yet")).toBeVisible();

  await story.getByRole("button", { name: "Edit Search 02 story" }).click();
  const dialog = page.getByRole("dialog", { name: "Edit Search 02" });
  await dialog.getByLabel("Title").fill("Second search, narrower scope");
  await dialog.getByLabel("Main goals").fill("Senior analyst role\nStay in retail analytics");
  await dialog.getByLabel("Approach").fill("Fewer, better-targeted applications.");
  await dialog.getByRole("button", { name: "Save story" }).click();

  await expect(dialog).toBeHidden();
  await expect(
    story.getByRole("heading", { name: "Search 02: Second search, narrower scope" })
  ).toBeVisible();
  await expect(story.getByText("Senior analyst role")).toBeVisible();
  await expect(story.getByText("Fewer, better-targeted applications.")).toBeVisible();

  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Search 02: Second search, narrower scope" })
  ).toBeVisible();
});

// Keep this test last: it moves the working set to a new cycle for the rest
// of the run (the e2e store is wiped before the next `pnpm test:e2e`).
test("starting a new search cycle routes new records to it", async ({ page }) => {
  await page.goto("/search-log");
  await page.getByRole("button", { name: "Start a new search cycle" }).click();
  const dialog = page.getByRole("dialog", { name: "Start a new search cycle" });
  await expect(dialog.getByLabel("Label")).toHaveValue("Search 03");
  await dialog.getByRole("button", { name: "Start cycle" }).click();

  await expect(dialog).toBeHidden();
  await expect(page.getByTestId("search-cycle-story-search-03")).toBeVisible();
  // The previous cycle is closed the day before the new one starts.
  await expect(
    page.getByTestId("search-cycle-story-search-02").getByText(/^Apr 3, 2026 to /)
  ).toBeVisible();

  await page.goto("/active");
  await expect(page.getByRole("link", { name: /^Search 03 \(\d+\)$/ })).toBeVisible();
  await expect(page.getByText("No Active records in Search 03 yet")).toBeVisible();

  await page.goto("/");
  await page.getByRole("button", { name: "Paste job text" }).click();
  await page
    .getByPlaceholder(
      "Paste job text. Enter to review, Shift+Enter for a new line."
    )
    .fill(`Req ID: HM-2026-07
Growth Analyst
Company: Harbor Metrics
Location:
Remote
Description
As a Growth Analyst at Harbor Metrics, you will own the weekly funnel read, build experiment readouts, and brief the growth team.
Preferred Qualifications
SQL`);
  await page.keyboard.press("Enter");
  await expect(page.getByText("Saved to Active").first()).toBeVisible();

  await page.goto("/active");
  await expect(page.getByRole("link", { name: "Search 03 (1)" })).toHaveAttribute(
    "aria-current",
    "page"
  );
  await expect(page.getByText("Harbor Metrics")).toBeVisible();
  await expect(page.getByText("IBM Canada")).toHaveCount(0);

  await page.goto("/search-log");
  await expect(page.getByRole("region", { name: "Search 03" })).toBeVisible();
});
