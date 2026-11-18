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

// Each case drives a full checkout, fixture status changes, and axe scans.
// The polling case also waits one 10 s interval.
test.describe.configure({ timeout: 90_000 });

// Checkout is limited to 5 attempts/minute/IP. Local `next start` sees every
// test as `unknown`, so give each case its own forwarded address the way a
// proxy would. The random prefix keeps repeated runs on one server isolated.
const IP_PREFIX = `198.51.${100 + Math.floor(Math.random() * 100)}`;
let clientCounter = 0;

test.beforeEach(async ({ context }) => {
  clientCounter += 1;
  const address = `${IP_PREFIX}.${clientCounter}`;
  await context.setExtraHTTPHeaders({
    "x-forwarded-for": address,
    "x-real-ip": address,
  });
});

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
    .getByRole("button", { name: /Add to cart .* USh 34,000/ })
    .click();
  await expect(dialog).toBeHidden();
}

async function createPaidOrder(page: Page, phone: string): Promise<string> {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Add Mineral Water (500 ml) to cart" }),
  ).toBeEnabled();
  await addTilapiaWithDip(page);

  await page.getByRole("button", { name: /View cart:/ }).click();
  const cart = page.getByRole("dialog", { name: "Your cart" });
  await cart.getByRole("button", { name: "Continue to checkout" }).click();
  await expect(page).toHaveURL(/\/checkout$/);

  await page.getByLabel("Latitude").fill("0.3245");
  await page.getByLabel("Longitude").fill("32.5782");
  await page.getByRole("button", { name: "Use these coordinates" }).click();
  await page.getByLabel("Full name").fill("Sarah Nakato");
  await page.getByLabel("Phone number").fill(phone);
  await page
    .getByLabel("Building, floor, or landmark")
    .fill("Nakasero, Plot 12, ground floor");

  await page.getByRole("button", { name: /Place order .* USh 35,000/ }).click();
  await expect(page).toHaveURL(/\/checkout\/mock-payment\?tx_ref=/);
  await page.getByRole("button", { name: "Approve test payment" }).click();
  await expect(page).toHaveURL(/\/orders\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { name: "Preparing" })).toBeVisible();

  return new URL(page.url()).pathname.split("/").pop() as string;
}

async function driveOrder(
  page: Page,
  token: string,
  body: Record<string, unknown>,
) {
  const response = await page.request.post(
    `/api/test/fixture/orders/${token}`,
    { data: body },
  );
  expect(response.ok(), JSON.stringify(await response.json())).toBeTruthy();
}

async function trackingPayload(page: Page, token: string) {
  const response = await page.request.get(`/api/orders/${token}/tracking`);
  expect(response.status()).toBe(200);
  const body = (await response.json()) as {
    ok: boolean;
    data: Record<string, unknown>;
  };
  expect(body.ok).toBe(true);
  return body.data;
}

async function advanceToOutForDelivery(
  page: Page,
  token: string,
  telemetry: { latitude: number; longitude: number; updatedAt?: string },
) {
  await driveOrder(page, token, { status: "READY_FOR_PICKUP" });
  await driveOrder(page, token, { status: "CLAIMED" });
  await driveOrder(page, token, { status: "OUT_FOR_DELIVERY", telemetry });
}

test.describe("customer order tracker", () => {
  test("renders the safety seal before the PIN and never exposes it to polling", async ({
    page,
  }) => {
    const token = await createPaidOrder(page, "0772 555 101");

    const seal = page.getByTestId("safety-seal");
    const pin = page.getByTestId("handover-pin");
    await expect(seal).toBeVisible();
    await expect(pin).toBeVisible();
    await expect(pin).toHaveText(/^[0-9]{4}$/);
    await expect(
      seal.getByText("Check the safety seal first."),
    ).toBeVisible();

    const sealBox = await seal.boundingBox();
    const pinBox = await pin.boundingBox();
    expect(sealBox).not.toBeNull();
    expect(pinBox).not.toBeNull();
    expect(sealBox!.y).toBeLessThan(pinBox!.y);

    const payload = await trackingPayload(page, token);
    expect(payload).not.toHaveProperty("handoverPin");
    expect(payload).not.toHaveProperty("customerPhone");
    expect(payload).not.toHaveProperty("customerNotes");
    expect(payload).not.toHaveProperty("paymentReference");
    expect(payload.timeline).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: "PENDING_PAYMENT" }),
        expect.objectContaining({ status: "PREPARING" }),
      ]),
    );

    await assertNoBlockingViolations(page, "active tracker");
  });

  test("status updates arrive by polling without a reload", async ({ page }) => {
    const token = await createPaidOrder(page, "0772 555 102");

    await page.evaluate(() => {
      (window as unknown as { __trackerMarker: number }).__trackerMarker = 1;
    });

    await driveOrder(page, token, { status: "READY_FOR_PICKUP" });

    await expect(page.getByRole("heading", { name: "Ready" })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByTestId("tracker-announcement")).toContainText(
      "Order status updated to Ready.",
    );
    expect(
      await page.evaluate(
        () =>
          (window as unknown as { __trackerMarker?: number }).__trackerMarker,
      ),
    ).toBe(1);
    await expect(page.getByTestId("handover-pin")).toBeVisible();
  });

  test("out for delivery shows the live map, rider position, and stale telemetry", async ({
    page,
  }) => {
    const token = await createPaidOrder(page, "0772 555 103");
    await advanceToOutForDelivery(page, token, {
      latitude: 0.3251,
      longitude: 32.5791,
    });

    await page.getByRole("button", { name: "Refresh status" }).click();
    await expect(
      page.getByRole("heading", { name: "On the way" }),
    ).toBeVisible();
    await expect(
      page.getByRole("region", {
        name: "Map showing the rider and delivery pin",
      }),
    ).toBeVisible();
    await expect(page.getByText("Live", { exact: true })).toBeVisible();
    await expect(page.getByText(/Live position updated just now/)).toBeVisible();
    await expect(page.getByText("Juma Okello")).toBeVisible();
    await expect(page.getByTestId("handover-pin")).toBeVisible();
    await assertNoBlockingViolations(page, "dispatched tracker");

    await driveOrder(page, token, {
      telemetry: {
        latitude: 0.3251,
        longitude: 32.5791,
        updatedAt: new Date(Date.now() - 5 * 60_000).toISOString(),
      },
    });

    await page.getByRole("button", { name: "Refresh status" }).click();
    await expect(page.getByText("Position may be stale")).toBeVisible();
    await expect(
      page.getByText("Last seen 5 minutes ago. SMS updates continue if the map pauses."),
    ).toBeVisible();
  });

  test("a delivered order hides the PIN and accepts feedback once", async ({
    page,
  }) => {
    const token = await createPaidOrder(page, "0772 555 104");
    await advanceToOutForDelivery(page, token, {
      latitude: 0.3251,
      longitude: 32.5791,
    });
    await driveOrder(page, token, {
      status: "DELIVERED",
      reason: "PIN_VERIFIED",
    });

    await page.getByRole("button", { name: "Refresh status" }).click();
    await expect(
      page.getByRole("heading", { name: "Delivered" }),
    ).toBeVisible();
    await expect(page.getByTestId("handover-pin")).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "How was your order?" }),
    ).toBeVisible();
    await assertNoBlockingViolations(page, "delivered tracker");

    await page
      .getByLabel("Add a note (optional)")
      .fill("Still warm and sealed.");
    await page.getByRole("button", { name: "Great", exact: true }).click();

    await expect(
      page.getByRole("heading", { name: "Thanks for your feedback" }),
    ).toBeVisible();
    await expect(page.getByText(/You rated this order/)).toBeVisible();

    // The note comes from the next polled snapshot, not the optimistic state.
    await page.getByRole("button", { name: "Refresh status" }).click();
    await expect(
      page.getByText("Your note: Still warm and sealed."),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Great", exact: true }),
    ).toHaveCount(0);

    const payload = await trackingPayload(page, token);
    expect(payload.canRate).toBe(false);
    expect(payload.feedback).toEqual({
      rating: "GREAT",
      notes: "Still warm and sealed.",
    });
    expect(payload).not.toHaveProperty("handoverPin");
  });

  test("a cancelled order explains the reason and hides the PIN", async ({
    page,
  }) => {
    const token = await createPaidOrder(page, "0772 555 105");
    await driveOrder(page, token, {
      status: "CANCELLED",
      reason: "CANCELLED_BY_STAFF",
    });

    await page.getByRole("button", { name: "Refresh status" }).click();
    await expect(
      page.getByRole("heading", { name: "Order cancelled" }),
    ).toBeVisible();
    await expect(
      page.getByText("The restaurant cancelled this order."),
    ).toBeVisible();
    await expect(page.getByTestId("handover-pin")).toHaveCount(0);
    await expect(
      page.getByText(/Any payment taken is being refunded/),
    ).toBeVisible();
    await assertNoBlockingViolations(page, "cancelled tracker");
  });
});
