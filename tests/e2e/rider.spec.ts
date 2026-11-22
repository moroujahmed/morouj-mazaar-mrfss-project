import { createHmac } from "node:crypto";

import AxeBuilder from "@axe-core/playwright";
import {
  expect,
  test,
  type BrowserContext,
  type Page,
} from "@playwright/test";

const TAGS = [
  "wcag2a",
  "wcag2aa",
  "wcag21a",
  "wcag21aa",
  "wcag22a",
  "wcag22aa",
];

test.describe.configure({ timeout: 120_000 });

// Checkout and staff sign-in are rate limited per IP. Local `next start` sees
// every case as `unknown`, so give each case its own forwarded address.
const IP_PREFIX = `198.51.${150 + Math.floor(Math.random() * 100)}`;
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

let nameCounter = 0;
function uniqueCustomer(prefix: string): string {
  nameCounter += 1;
  return `${prefix} ${Date.now().toString(36)}-${nameCounter}`;
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

/** Places the canonical USh 35,000 cash order and returns its tracker token. */
async function placeCashOrder(
  page: Page,
  { customer, phone }: { customer: string; phone: string },
): Promise<string> {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Add Mineral Water (500 ml) to cart" }),
  ).toBeEnabled();
  await addTilapiaWithDip(page);

  await page.getByRole("button", { name: /View cart:/ }).click();
  const cart = page.getByRole("dialog", { name: "Your cart" });
  await cart.getByRole("button", { name: "Continue to checkout" }).click();
  await expect(page).toHaveURL(/\/checkout(\?|$)/);

  await page.getByLabel("Latitude").fill("0.3245");
  await page.getByLabel("Longitude").fill("32.5782");
  await page.getByRole("button", { name: "Use these coordinates" }).click();
  await expect(
    page.getByText("1.562 km · about 4 min drive", { exact: true }),
  ).toBeVisible();

  await page.getByLabel("Full name").fill(customer);
  await page.getByLabel("Phone number").fill(phone);
  await page
    .getByLabel("Building, floor, or landmark")
    .fill("Nakasero, Plot 12, ground floor");

  await page.getByRole("radio", { name: /Cash on delivery/ }).check();
  await page.getByLabel("Cash amount").selectOption("50000");
  await page.getByRole("button", { name: "Send code" }).click();
  await expect(
    page.getByText("Code sent. It expires in 10 minutes."),
  ).toBeVisible();
  await page.getByLabel("Verification code").fill("123456");
  await page
    .getByRole("button", { name: /Place order · USh 35,000/ })
    .click();

  await expect(page).toHaveURL(/\/orders\/[0-9a-f-]{36}$/);
  await expect(
    page.getByRole("heading", { name: "Order received" }),
  ).toBeVisible();

  return new URL(page.url()).pathname.split("/").pop() as string;
}

type StaffSession = {
  userId: string;
  fullName: string;
  phone: string;
  role: "ADMIN" | "KITCHEN" | "RIDER";
  mustChangePin: boolean;
};

const KITCHEN_SESSION: StaffSession = {
  userId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb02",
  fullName: "Chef Musa",
  phone: "+256700111001",
  role: "KITCHEN",
  mustChangePin: false,
};

const JUMA_SESSION: StaffSession = {
  userId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb03",
  fullName: "Rider Juma",
  phone: "+256700111002",
  role: "RIDER",
  mustChangePin: false,
};

const DAVID_SESSION: StaffSession = {
  userId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb04",
  fullName: "Rider David",
  phone: "+256700111003",
  role: "RIDER",
  mustChangePin: false,
};

/** Mirrors the Web Crypto HMAC signature used by `fixture-token.ts`. */
function fixtureStaffCookie(session: StaffSession): string {
  const payload = Buffer.from(
    JSON.stringify({
      ...session,
      exp: Math.floor(Date.now() / 1_000) + 60 * 60,
    }),
    "utf8",
  ).toString("base64url");

  const digest = createHmac("sha256", "mrfss-playwright-staff-fixture-secret")
    .update(payload)
    .digest();
  const binary = [...digest]
    .map((byte) => String.fromCharCode(byte))
    .join("");
  const signature = Buffer.from(binary, "utf8").toString("base64url");

  return `${payload}.${signature}`;
}

async function signInAs(context: BrowserContext, session: StaffSession) {
  await context.addCookies([
    {
      name: "mrfss_staff_fixture",
      value: fixtureStaffCookie(session),
      domain: "127.0.0.1",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}

type BoardTicket = {
  orderId: string;
  orderNumber: number;
  customerName: string;
  status: string;
};

/** Readies a paid/cash order through the real kitchen board. */
async function markOrderReady(
  context: BrowserContext,
  page: Page,
  customer: string,
): Promise<BoardTicket> {
  await signInAs(context, KITCHEN_SESSION);
  await page.goto("/kitchen");
  await expect(page).toHaveURL(/\/kitchen$/);

  const card = page
    .locator('[data-testid^="kitchen-ticket-"]')
    .filter({ hasText: customer });
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: /^Accept order #\d+$/ }).click();
  await expect(card.getByText("Preparing", { exact: true })).toBeVisible();
  await card
    .getByRole("button", { name: /^Bump order #\d+ to ready$/ })
    .click();
  await expect(card).toContainText("Ready — waiting for a rider");

  const response = await page.request.get("/api/kitchen/board");
  expect(response.status()).toBe(200);
  const body = (await response.json()) as {
    ok: boolean;
    data: { tickets: BoardTicket[] };
  };
  expect(body.ok).toBe(true);
  const ticket = body.data.tickets.find(
    (entry) => entry.customerName === customer,
  );
  expect(ticket, `kitchen ticket for ${customer}`).toBeTruthy();
  return ticket!;
}

async function startShiftIfNeeded(page: Page) {
  const start = page.getByTestId("rider-shift-start");
  if (await start.isVisible().catch(() => false)) {
    await start.click();
    await expect(page.getByTestId("rider-shift-end")).toBeVisible();
  }
}

async function readHandoverPin(
  context: BrowserContext,
  token: string,
): Promise<string> {
  const tracker = await context.newPage();
  try {
    await tracker.goto(`/orders/${token}`);
    const pin = tracker.getByTestId("handover-pin");
    await expect(pin).toBeVisible();
    const value = (await pin.textContent())?.trim() ?? "";
    expect(value).toMatch(/^[0-9]{4}$/);
    return value;
  } finally {
    await tracker.close();
  }
}

test.describe("rider portal", () => {
  test("guards the portal and rejects a wrong staff PIN", async ({
    page,
    request,
    context,
  }) => {
    await page.goto("/rider");
    await expect(page).toHaveURL(/\/rider\/login/);
    await expect(
      page.getByRole("heading", { name: "Rider portal", level: 1 }),
    ).toBeVisible();
    await assertNoBlockingViolations(page, "rider login");

    expect((await request.get("/api/rider/snapshot")).status()).toBe(401);
    expect(
      (
        await request.post("/api/rider/telemetry", {
          data: {
            orderId: "00000000-0000-4000-8000-000000000000",
            latitude: 0.3,
            longitude: 32.5,
          },
        })
      ).status(),
    ).toBe(401);

    await page.getByLabel("Phone number").fill("0700 111 003");
    await page.getByLabel("6-digit PIN").fill("000000");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(
      page.getByText("That phone number or PIN is not correct."),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/rider\/login/);

    await page.getByLabel("6-digit PIN").fill("445566");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/rider$/);
    await expect(
      page.getByRole("heading", { name: "Today's deliveries", level: 1 }),
    ).toBeVisible();
    await expect(
      page.getByText("Rider David", { exact: true }),
    ).toBeVisible();
    await assertNoBlockingViolations(page, "rider board");

    // A kitchen session cannot use the rider portal; the guard sends it back
    // to that role's own home rather than the rider sign-in page.
    await signInAs(context, KITCHEN_SESSION);
    await page.goto("/rider");
    await expect(page).toHaveURL(/\/kitchen$/);
  });

  test("claims, starts, locks a wrong PIN, delivers the cash order, and ends the shift", async ({
    page,
    context,
  }) => {
    const customer = uniqueCustomer("Rider COD");
    const token = await placeCashOrder(page, {
      customer,
      phone: "0772 555 020",
    });
    const ticket = await markOrderReady(context, page, customer);

    await signInAs(context, JUMA_SESSION);
    await page.goto("/rider");
    await expect(page).toHaveURL(/\/rider$/);
    await startShiftIfNeeded(page);

    const poolItem = page.getByTestId(
      `rider-pool-item-${ticket.orderNumber}`,
    );
    await expect(poolItem).toBeVisible();
    await expect(poolItem).toContainText("Cash on delivery");
    await expect(poolItem).toContainText("USh 35,000");
    // The pool is a safe summary: no customer phone or handover PIN.
    await expect(poolItem).not.toContainText("0772");
    await expect(poolItem).not.toContainText("Handover PIN");

    await poolItem.getByTestId("rider-claim").click();

    const active = page.getByTestId("rider-active");
    await expect(active).toBeVisible();
    await expect(active).toContainText(customer);
    await expect(active).toContainText("Nakasero, Plot 12");
    await expect(active).toContainText("Collect USh 35,000 in cash");
    await expect(active).toContainText("Change due at the door: USh 15,000");
    await expect(active).toContainText("+256 772 555 020");

    await active.getByTestId("rider-start").click();
    await expect(active).toContainText("On the way");
    await expect(page.getByTestId("rider-pin-open")).toBeVisible();

    // A wrong PIN is rejected online and consumes one of the three attempts.
    await page.getByTestId("rider-pin-open").click();
    const pinSheet = page.getByRole("dialog", { name: "Handover PIN" });
    await expect(pinSheet).toBeVisible();
    await pinSheet
      .getByLabel("Customer handover PIN")
      .fill("0000");
    await pinSheet.getByTestId("rider-pin-submit").click();
    await expect(
      pinSheet.getByText(/That PIN does not match\. 2 attempts left\./),
    ).toBeVisible();

    const pin = await readHandoverPin(context, token);
    await pinSheet.getByLabel("Customer handover PIN").fill(pin);
    await pinSheet.getByTestId("rider-pin-submit").click();

    await expect(active).toHaveCount(0);
    await expect(
      page.getByText(/cash to hand over USh 35,000/),
    ).toBeVisible();

    const snapshotResponse = await page.request.get("/api/rider/snapshot");
    expect(snapshotResponse.status()).toBe(200);
    const snapshot = (await snapshotResponse.json()) as {
      ok: boolean;
      data: {
        active: unknown;
        shift: { isOpen: boolean };
        cash: { outstandingCash: number };
        pool: Array<Record<string, unknown>>;
      };
    };
    expect(snapshot.ok).toBe(true);
    expect(snapshot.data.active).toBeNull();
    expect(snapshot.data.shift.isOpen).toBe(true);
    expect(snapshot.data.cash.outstandingCash).toBe(35_000);
    for (const item of snapshot.data.pool) {
      expect(item).not.toHaveProperty("customerPhone");
      expect(item).not.toHaveProperty("customerName");
      expect(item).not.toHaveProperty("handoverPin");
      expect(item).not.toHaveProperty("deliveryAddressText");
    }

    // Completion is online-only: the delivered order no longer shows a PIN.
    const tracker = await context.newPage();
    await tracker.goto(`/orders/${token}`);
    await expect(
      tracker.getByRole("heading", { name: "Order received" }),
    ).toHaveCount(0);
    await expect(tracker.getByTestId("handover-pin")).toHaveCount(0);
    await tracker.close();

    await page.getByTestId("rider-shift-end").click();
    const endSheet = page.getByRole("dialog", { name: "End your shift?" });
    await expect(endSheet).toContainText("Expected cash: USh 35,000");
    await endSheet.getByRole("button", { name: "End shift" }).click();
    await expect(page.getByText("Shift ended")).toBeVisible();
    await expect(page.getByTestId("rider-shift-start")).toBeVisible();
  });

  test("releases a claim and records a failed delivery with a reason", async ({
    page,
    context,
  }) => {
    const customer = uniqueCustomer("Rider Failed");
    await placeCashOrder(page, { customer, phone: "0772 555 021" });
    const ticket = await markOrderReady(context, page, customer);

    await signInAs(context, DAVID_SESSION);
    await page.goto("/rider");
    await expect(page).toHaveURL(/\/rider$/);
    await startShiftIfNeeded(page);

    const poolItem = page.getByTestId(
      `rider-pool-item-${ticket.orderNumber}`,
    );
    await expect(poolItem).toBeVisible();
    await poolItem.getByTestId("rider-claim").click();
    await expect(page.getByTestId("rider-active")).toBeVisible();

    await page.getByRole("button", { name: "Release", exact: true }).click();
    const releaseSheet = page.getByRole("dialog", {
      name: "Release this delivery?",
    });
    await releaseSheet.getByLabel("Reason").fill("Bike would not start");
    await releaseSheet
      .getByRole("button", { name: "Release delivery" })
      .click();
    await expect(page.getByText("Delivery released")).toBeVisible();
    await expect(page.getByTestId("rider-active")).toHaveCount(0);
    await expect(poolItem).toBeVisible();

    await poolItem.getByTestId("rider-claim").click();
    await page.getByTestId("rider-start").click();
    await page
      .getByRole("button", { name: "Report failed delivery" })
      .click();
    const failedSheet = page.getByRole("dialog", {
      name: "Report failed delivery",
    });
    await failedSheet
      .getByLabel("What happened?")
      .selectOption("CUSTOMER_UNREACHABLE");
    await failedSheet
      .getByLabel("Reason")
      .fill("Customer did not answer the gate phone");
    await failedSheet
      .getByRole("button", { name: "Record failed delivery" })
      .click();

    await expect(page.getByText("Failed delivery recorded")).toBeVisible();
    await expect(page.getByTestId("rider-active")).toHaveCount(0);
    await expect(
      page.getByText(/cash to hand over USh 0/),
    ).toBeVisible();

    await page.getByTestId("rider-shift-end").click();
    const endSheet = page.getByRole("dialog", { name: "End your shift?" });
    await expect(endSheet).toContainText("Expected cash: USh 0");
    await endSheet.getByRole("button", { name: "End shift" }).click();
    await expect(page.getByTestId("rider-shift-start")).toBeVisible();
  });
});
