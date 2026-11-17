import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const T4_TOKEN = "88888888-8888-4888-8888-888888888804";
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

async function addTilapiaWithDip(page: Page) {
  await page
    .getByRole("button", { name: "Customize Whole Tilapia Flame Combo" })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Whole Tilapia Flame Combo",
  });
  await expect(dialog).toBeVisible();
  await dialog
    .getByRole("checkbox", { name: /Extra Garlic Pepper Dip/ })
    .check();
  await dialog
    .getByRole("button", { name: /Add to cart · USh 34,000/ })
    .click();
  await expect(dialog).toBeHidden();
}

async function addRolex(page: Page) {
  await page
    .getByRole("button", { name: "Customize Special Bazaar Rolex" })
    .click();
  const dialog = page.getByRole("dialog", { name: "Special Bazaar Rolex" });
  await expect(dialog).toBeVisible();
  await dialog
    .getByRole("button", { name: /Add to cart · USh 8,000/ })
    .click();
  await expect(dialog).toBeHidden();
}

async function setPin(page: Page, lat: string, lng: string) {
  await page.getByLabel("Latitude").fill(lat);
  await page.getByLabel("Longitude").fill(lng);
  await page.getByRole("button", { name: "Use these coordinates" }).click();
}

async function fillContact(page: Page, phone = "0772 123 456") {
  await page.getByLabel("Full name").fill("Sarah Nakato");
  await page.getByLabel("Phone number").fill(phone);
}

async function goToCheckout(page: Page) {
  await page.getByRole("button", { name: /View cart:/ }).click();
  const cart = page.getByRole("dialog", { name: "Your cart" });
  await cart.getByRole("button", { name: "Continue to checkout" }).click();
  await expect(page).toHaveURL(/\/checkout(\?|$)/);
}

async function prepareNakaseroDelivery(page: Page, phone?: string) {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Add Mineral Water (500 ml) to cart" }),
  ).toBeEnabled();
  await addTilapiaWithDip(page);
  await goToCheckout(page);

  await setPin(page, "0.3245", "32.5782");
  await expect(
    page.getByText("1.562 km · about 4 min drive", { exact: true }),
  ).toBeVisible();
  await fillContact(page, phone);
  await page
    .getByLabel("Building, floor, or landmark")
    .fill("Nakasero, Plot 12, ground floor");
}

test.describe("order pipeline", () => {
  test("a prepaid mobile-money order completes mock checkout and shows the tracker", async ({
    page,
  }) => {
    await prepareNakaseroDelivery(page, "0772 555 001");

    await page
      .getByRole("button", { name: /Place order · USh 35,000/ })
      .click();

    await expect(page).toHaveURL(/\/checkout\/mock-payment\?tx_ref=/);
    await expect(
      page.getByRole("heading", { name: "Simulate the hosted checkout" }),
    ).toBeVisible();
    await assertNoBlockingViolations(page, "mock payment");

    await page.getByRole("button", { name: "Approve test payment" }).click();

    await expect(page).toHaveURL(/\/orders\/[0-9a-f-]{36}$/);
    await expect(
      page.getByRole("heading", { name: "Preparing" }),
    ).toBeVisible();
    await expect(page.getByText("Paid", { exact: true })).toBeVisible();
    await expect(page.getByText("Handover PIN")).toBeVisible();
    await expect(page.getByText("USh 35,000").first()).toBeVisible();
    await assertNoBlockingViolations(page, "order tracker");

    // The tracker refreshes without mutating a paid order.
    await page.getByRole("button", { name: "Refresh status" }).click();
    await expect(
      page.getByRole("heading", { name: "Preparing" }),
    ).toBeVisible();
  });

  test("cash on delivery requires the one-time code and shows change due", async ({
    page,
  }) => {
    await prepareNakaseroDelivery(page, "0772 555 002");

    await page.getByRole("radio", { name: /Cash on delivery/ }).check();
    await expect(page.getByText(/Have USh 35,000 ready/)).toBeVisible();

    await page.getByLabel("Cash amount").selectOption("50000");
    await page.getByRole("button", { name: "Send code" }).click();
    await expect(page.getByText("Code sent. It expires in 10 minutes.")).toBeVisible();

    await page.getByLabel("Verification code").fill("123456");
    await page
      .getByRole("button", { name: /Place order · USh 35,000/ })
      .click();

    await expect(page).toHaveURL(/\/orders\/[0-9a-f-]{36}$/);
    await expect(
      page.getByRole("heading", { name: "Order received" }),
    ).toBeVisible();
    await expect(
      page.getByText("USh 15,000 from USh 50,000"),
    ).toBeVisible();
    await expect(page.getByText("Handover PIN")).toBeVisible();
    await expect(page.getByText("Payment pending")).toBeVisible();
    await assertNoBlockingViolations(page, "cash order tracker");
  });

  test("a dine-in table order skips delivery and packaging", async ({ page }) => {
    await page.goto(`/?table=${T4_TOKEN}`);
    await expect(page.getByText("Dine-in · Table T4").first()).toBeVisible();
    await addRolex(page);
    await goToCheckout(page);

    await expect(page).toHaveURL(new RegExp(`table=${T4_TOKEN}`));
    await expect(page.getByText("Dine-in · Table T4").first()).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Delivery pin" }),
    ).toHaveCount(0);

    await fillContact(page, "0772 555 003");
    await page.getByRole("radio", { name: /Cash on delivery/ }).check();
    await page
      .getByRole("button", { name: /Place order · USh 8,000/ })
      .click();

    await expect(page).toHaveURL(/\/orders\/[0-9a-f-]{36}$/);
    await expect(
      page.getByRole("heading", { name: "Order received" }),
    ).toBeVisible();
    await expect(page.getByText("Table T4")).toBeVisible();
    await expect(page.getByText("USh 8,000").first()).toBeVisible();
    await expect(page.getByText("Handover PIN")).toHaveCount(0);
    await assertNoBlockingViolations(page, "dine-in tracker");
  });

  test("a declined mock payment leaves the order awaiting payment", async ({
    page,
  }) => {
    await prepareNakaseroDelivery(page, "0772 555 004");

    await page
      .getByRole("button", { name: /Place order · USh 35,000/ })
      .click();
    await expect(page).toHaveURL(/\/checkout\/mock-payment\?tx_ref=/);

    await page.getByRole("button", { name: "Decline test payment" }).click();
    await expect(
      page.getByText(/The test payment was declined/),
    ).toBeVisible();

    // The order exists and stays pending; the tracker can retry checkout.
    await page.getByRole("link", { name: "Return to checkout" }).click();
    await expect(page).toHaveURL(/\/checkout$/);
  });

  test("an unknown order link returns not found", async ({ page }) => {
    const response = await page.goto(
      "/orders/00000000-0000-4000-8000-000000000000",
    );
    expect(response?.status()).toBe(404);
  });
});
