import { expect, test } from "@playwright/test";

test("signed-out Sales Scout route is protected", async ({ page }) => {
  await page.goto("/admin/marketing/sales-scout");
  await expect(page).toHaveURL(/\/admin\/login/);
});

const fixtureReady = process.env.SALES_SCOUT_BROWSER_FIXTURE === "true";
test.describe("guarded Sales Scout admin fixture", () => {
  test.skip(!fixtureReady, "Requires a local authenticated Supabase admin fixture; production data is never used.");

  test("enabled Shields admin sees guided review workspace without outreach controls", async ({ page }) => {
    await page.goto("/admin/marketing/sales-scout");
    await expect(page.getByRole("heading", { name: "Sales Scout" })).toBeVisible();
    await expect(page.getByText(/No social message is sent automatically/)).toBeVisible();
    await page.getByRole("link", { name: "Add candidate" }).click();
    await expect(page.getByLabel("Business name")).toBeVisible();
    await expect(page.locator("textarea[name='candidate']")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Preview candidate" })).toBeVisible();
    await expect(page.getByRole("button", { name: /capture|send outreach/i })).toHaveCount(0);
    await expect(page.locator("input[name=city], input[name=state], input[name=country]")).toHaveCount(3);
    await expect(page.getByText("Preview before capture")).toBeVisible();
    const observedAt=page.locator('input[name="observedAt"]');
    await expect(observedAt).not.toHaveValue("");
    await page.getByLabel("Business name").fill("Browser Fixture Kitchen");
    await page.locator('input[name="sourceUrl"]').fill("https://instagram.com/browser_fixture_kitchen");
    await page.getByLabel("Channel 1 handle or value").fill("@browser_fixture_kitchen");
    await page.getByRole("button",{name:"Preview candidate"}).click();
    await expect(page.getByRole("heading",{name:"Candidate summary"})).toBeVisible();
    await expect(page.getByRole("heading",{name:"Channels"})).toBeVisible();
    await expect(page.getByRole("heading",{name:"Qualification"})).toBeVisible();
    await expect(page.locator("aside pre")).toHaveCount(0);
    const attachmentButtons=page.getByRole("button",{name:/^Attach to /});
    for(let index=0;index<await attachmentButtons.count();index++){
      await expect(attachmentButtons.nth(index)).not.toHaveText(/^Attach to [0-9a-f-]{36}$/i);
    }
    await page.getByLabel("Business name").fill("Browser Fixture Kitchen Edited");
    await expect(page.getByRole("button",{name:/^(Create new prospect|Attach to )/})).toHaveCount(0);
    await expect(page.getByRole("button",{name:/send outreach/i})).toHaveCount(0);
  });
});

test("feature-disabled or non-Shields deployment does not expose Sales Scout", async ({ page }) => {
  test.skip(process.env.SALES_SCOUT_EXPECT_UNAVAILABLE !== "true", "Set only for a local disabled or Noble deployment fixture.");
  await page.goto("/admin/marketing/sales-scout");
  await expect(page).toHaveURL(/\/admin\/login|\/admin\/marketing\/sales-scout/);
  await expect(page.getByRole("heading", { name: "Sales Scout" })).toHaveCount(0);
});
