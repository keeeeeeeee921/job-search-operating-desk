import { expect, test } from "@playwright/test";

test("saves a fully extracted job into Active", async ({ page, baseURL }) => {
  await page.goto("/");
  await expect(page.getByText("0 / 50").first()).toBeVisible();
  await page.getByPlaceholder("Paste a job link and press Enter").fill(
    `${baseURL}/mock-jobs/aurora-data-analyst`
  );
  await page.keyboard.press("Enter");

  await expect(page.getByText("Added to Active").first()).toBeVisible();
  await expect(page.getByText("1 / 50").first()).toBeVisible();
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
    page.getByRole("heading", { name: "Missing fields need review" })
  ).toBeVisible();
  await expect(page.getByText("numeric job ID").first()).toBeVisible();
});

test("saves pasted job text without requiring a link", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Paste job text" }).click();
  const textarea = page.getByPlaceholder(
    "Paste the copied job text here. Press Enter to process, or Shift + Enter for a new line."
  );
  await textarea.fill(`Req ID: P25-321635-2
Data Science Intern (Summer 2026)
Company: Federal Express Corporation
Location:
Remote
Description
As a FedEx Intern, you will be working on projects gaining valuable, real-world experience.`);
  await textarea.press("Enter");

  await expect(page.getByText("Added to Active").first()).toBeVisible();
  await page.goto("/active");
  await expect(
    page.getByRole("link", { name: "Data Science Intern (Summer 2026)" }).first()
  ).toBeVisible();
  await expect(page.getByText("Link not saved").first()).toBeVisible();
});

test("shows duplicate modal and respects cancel or continue", async ({ page, baseURL }) => {
  await page.goto("/");
  await page.getByPlaceholder("Paste a job link and press Enter").fill(
    `${baseURL}/mock-jobs/tiktok-data-analyst-duplicate`
  );
  await page.keyboard.press("Enter");

  await expect(
    page.getByRole("heading", { name: "Possible duplicate found" })
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await page.goto("/active");
  await expect(page.getByText("TikTok").first()).toBeVisible();
});

test("search scans only active records", async ({ page }) => {
  await page.goto("/search");
  await page.getByPlaceholder("Search Active by company, role title, or both").fill("Canva");
  await expect(page.getByText("No matching Active records")).toBeVisible();
});

test("comments persist after blur", async ({ page }) => {
  await page.goto("/active");
  await page.getByRole("link", { name: "Logistics Planning Engineer" }).click();
  const textarea = page.getByPlaceholder("Add a progress note...");
  await textarea.fill("Second round interview");
  await textarea.evaluate((element) => {
    (element as HTMLTextAreaElement).blur();
  });
  await page.reload();
  await expect(page.getByPlaceholder("Add a progress note...")).toHaveValue(
    "Second round interview"
  );
});

test("active records can be deleted from the detail page", async ({ page }) => {
  await page.goto("/active");
  await page.getByRole("link", { name: "Logistics Planning Engineer" }).click();
  page.on("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete record" }).click();
  await page.waitForURL("**/active");
  await expect(
    page.getByRole("link", { name: "Logistics Planning Engineer" })
  ).toHaveCount(0);
});

test("update by email archives manually", async ({ page }) => {
  await page.goto("/update-by-email");
  await page.getByRole("button", { name: "Tesla rejection demo" }).click();
  await expect(
    page.getByRole("button", { name: "Archive to Rejected" }).first()
  ).toBeVisible();
  await page.getByRole("button", { name: "Archive to Rejected" }).first().click();
  await page.goto("/rejected");
  await expect(page.getByText("Tesla", { exact: true })).toBeVisible();
});
