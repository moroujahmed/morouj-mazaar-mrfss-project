import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const TAGS = [
  "wcag2a",
  "wcag2aa",
  "wcag21a",
  "wcag21aa",
  "wcag22a",
  "wcag22aa",
];

async function assertNoBlockingViolations(page: Page, label: string) {
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const blocking = results.violations.filter(
    (violation) =>
      violation.impact === "critical" || violation.impact === "serious",
  );

  expect(
    blocking.map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      help: violation.help,
      nodes: violation.nodes.map((node) => node.target),
    })),
    `${label} has blocking axe violations`,
  ).toEqual([]);
}

test.describe("accessibility", () => {
  test("home page has no critical or serious violations", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await assertNoBlockingViolations(page, "home");
  });

  test("design system has no critical or serious violations", async ({ page }) => {
    await page.goto("/design-system", { waitUntil: "networkidle" });
    await expect(
      page.getByRole("heading", { level: 1, name: "Design system v2" }),
    ).toBeVisible();
    await assertNoBlockingViolations(page, "design system");
  });

  test("open sheet is labelled and Escape closes it", async ({ page }) => {
    await page.goto("/design-system", { waitUntil: "networkidle" });

    const trigger = page.getByRole("button", { name: "Open sheet" });
    await trigger.click();

    const dialog = page.getByRole("dialog", { name: "Confirm handover" });
    await expect(dialog).toBeVisible();
    await assertNoBlockingViolations(page, "open sheet");

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("toasts are announced and dismissible", async ({ page }) => {
    await page.goto("/design-system", { waitUntil: "networkidle" });

    await page.getByRole("button", { name: "Show error toast" }).click();
    const notifications = page.getByRole("region", { name: "Notifications" });
    const alert = notifications.getByRole("alert");
    await expect(alert).toBeVisible();
    await expect(alert).toContainText("Connection required");

    await notifications
      .getByRole("button", { name: /Dismiss notification: Connection required/ })
      .click();
    await expect(alert).toBeHidden();
  });
});
