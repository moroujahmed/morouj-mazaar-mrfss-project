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

// Checkout is limited to 5 attempts/minute/IP. Local `next start` sees every
// test as `unknown`, so give each case its own forwarded address the way a
// proxy would. The random prefix keeps repeated runs on one server isolated.
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

/** Places a cash-on-delivery order and returns its order id. */
async function placeCashOrder(
  page: Page,
  {
    customer,
    phone,
  }: {
    customer: string;
    phone: string;
  },
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

const CHEF = { phone: "0700 111 001", pin: "135790" } as const;

/** Chef Musa's fixture session, mirroring `src/lib/auth/fixture-staff.ts`. */
const CHEF_SESSION = {
  userId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb02",
  fullName: "Chef Musa",
  phone: "+256700111001",
  role: "KITCHEN",
  mustChangePin: false,
} as const;

const RIDER_SESSION = {
  userId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb03",
  fullName: "Rider Juma",
  phone: "+256700111002",
  role: "RIDER",
  mustChangePin: false,
} as const;

const T4_TOKEN = "88888888-8888-4888-8888-888888888804";

/**
 * The staff login limiter allows five attempts per phone per fifteen minutes,
 * and a full run signs in more often than that. Signing the documented fixture
 * cookie gives each case a session without spending the shared budget; the
 * login form itself is still covered by its own test.
 */
function fixtureStaffCookie(session: { userId: string; fullName: string; phone: string; role: string; mustChangePin: boolean } = CHEF_SESSION): string {
  const payload = Buffer.from(
    JSON.stringify({
      ...session,
      exp: Math.floor(Date.now() / 1_000) + 60 * 60,
    }),
    "utf8",
  ).toString("base64url");

  // The server signs with Web Crypto, then base64url-encodes the digest bytes
  // as a string (TextEncoder UTF-8 encodes bytes above 0x7f). Mirror that so
  // the forged test session verifies exactly like a minted one.
  const digest = createHmac("sha256", "mrfss-playwright-staff-fixture-secret")
    .update(payload)
    .digest();
  const binary = [...digest]
    .map((byte) => String.fromCharCode(byte))
    .join("");
  const signature = Buffer.from(binary, "utf8").toString("base64url");

  return `${payload}.${signature}`;
}

async function startKitchenShift(context: BrowserContext, page: Page) {
  await context.addCookies([
    {
      name: "mrfss_staff_fixture",
      value: fixtureStaffCookie(),
      domain: "127.0.0.1",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  await page.goto("/kitchen");
  await expect(page).toHaveURL(/\/kitchen$/);
}

async function signInKitchen(
  page: Page,
  staff: { phone: string; pin: string } = CHEF,
  pinOverride?: string,
) {
  await page.goto("/kitchen/login");
  await page.getByLabel("Phone number").fill(staff.phone);
  await page.getByLabel("6-digit PIN").fill(pinOverride ?? staff.pin);
  await page.getByRole("button", { name: "Sign in" }).click();
}

/** Leaves busy mode off, intake open, and an empty 86 list behind. */
async function restoreKitchenDefaults(page: Page) {
  await page.goto("/kitchen");
  // Signed-out cases are redirected to the login screen; nothing to restore.
  if (!/\/kitchen$/.test(new URL(page.url()).pathname)) return;

  const busy = page.getByTestId("busy-toggle");
  if ((await busy.getAttribute("aria-pressed")) === "true") {
    await busy.click();
    await expect(page.getByTestId("busy-banner")).toHaveCount(0);
  }

  const pause = page.getByTestId("pause-toggle");
  if ((await pause.getAttribute("aria-pressed")) === "true") {
    await pause.click();
    await expect(page.getByTestId("paused-banner")).toHaveCount(0);
  }

  await page.getByTestId("open-stock").click();
  const sheet = page.getByRole("dialog", { name: "86'd items" });
  await expect(sheet).toBeVisible();
  const tilapia = sheet.getByRole("switch", {
    name: "Whole Tilapia Flame Combo",
  });
  if (await tilapia.isChecked()) {
    await tilapia.uncheck();
    await expect(tilapia).not.toBeChecked();
  }
  await page.getByRole("button", { name: "Close dialog" }).click();
}

function ticketCard(page: Page, customer: string) {
  return page
    .locator('[data-testid^="kitchen-ticket-"]')
    .filter({ hasText: customer });
}

type BoardPayload = {
  ok: boolean;
  data: {
    tickets: Array<{
      orderId: string;
      orderNumber: number;
      customerName: string;
      status: string;
    }>;
  };
};

/** Reads the board API to prove the wire contract and resolve the order id. */
async function fetchBoardTicket(page: Page, customer: string) {
  const response = await page.request.get("/api/kitchen/board");
  expect(response.status()).toBe(200);
  const body = (await response.json()) as BoardPayload;
  expect(body.ok).toBe(true);

  const ticket = body.data.tickets.find(
    (entry) => entry.customerName === customer,
  );
  expect(ticket, `ticket for ${customer}`).toBeTruthy();
  // The polling contract never carries private customer data.
  expect(ticket).not.toHaveProperty("customerPhone");
  expect(ticket).not.toHaveProperty("handoverPin");
  expect(ticket).not.toHaveProperty("paymentReference");
  return ticket!;
}

test.describe("kitchen board", () => {
  test.afterEach(async ({ page }) => {
    // Fixture kitchen settings are process-global, so never leak them.
    try {
      await restoreKitchenDefaults(page);
    } catch {
      // The page may not hold a staff session; nothing was changed in that case.
    }
  });

  test("guards the board and rejects a wrong PIN", async ({ page, request }) => {
    await page.goto("/kitchen");
    await expect(page).toHaveURL(/\/kitchen\/login/);
    await expect(
      page.getByRole("heading", { name: "Kitchen board", level: 1 }),
    ).toBeVisible();
    await assertNoBlockingViolations(page, "kitchen login");

    // The board API and the docket route fail closed without a session.
    expect((await request.get("/api/kitchen/board")).status()).toBe(401);
    expect(
      (
        await request.get(
          "/api/print/receipt/00000000-0000-4000-8000-000000000000",
        )
      ).status(),
    ).toBe(401);

    await signInKitchen(page, CHEF, "000000");
    await expect(
      page.getByText("That phone number or PIN is not correct."),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/kitchen\/login/);

    await page.getByLabel("6-digit PIN").fill("135790");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/kitchen$/);
    await expect(
      page.getByRole("heading", { name: "Kitchen board", level: 1 }),
    ).toBeVisible();
    await expect(page.getByTestId("shift-status")).toContainText(
      "Chime off — start your shift",
    );
  });

  test("carries a cash order from the pass to ready and prints it without private data", async ({
    page,
  }) => {
    const customer = uniqueCustomer("Kitchen COD");
    const phone = "0772 555 010";
    await placeCashOrder(page, { customer, phone });

    await startKitchenShift(page.context(), page);

    const ticket = await fetchBoardTicket(page, customer);
    const orderId = ticket.orderId;
    const card = ticketCard(page, customer);
    await expect(card).toBeVisible();
    await expect(card).toContainText("waiting for the kitchen to accept");
    await expect(card).toContainText("Cash on delivery");
    await expect(card).toContainText("Change due: USh 15,000");
    await expect(card).toContainText("USh 35,000");

    // The shift gesture dismisses the prompt (audio itself may be unavailable).
    await expect(
      page.getByRole("heading", { name: "Start your shift" }),
    ).toBeVisible();
    await page.getByTestId("shift-start").click();
    await expect(
      page.getByRole("heading", { name: "Start your shift" }),
    ).toHaveCount(0);
    await assertNoBlockingViolations(page, "kitchen board with a waiting ticket");

    await card.getByRole("button", { name: /^Accept order #\d+$/ }).click();
    await expect(card.getByText("Preparing", { exact: true })).toBeVisible();
    await expect(
      page.getByText(`Order #${ticket.orderNumber} accepted`),
    ).toBeVisible();
    await expect(
      card.getByRole("button", { name: /^Bump order #\d+ to ready$/ }),
    ).toBeVisible();

    // The docket is authorized, audited, and free of PIN and phone data.
    const docket = await page.request.get(`/api/print/receipt/${orderId}`);
    expect(docket.status()).toBe(200);
    expect(docket.headers()["content-type"]).toContain("text/html");
    const html = await docket.text();
    expect(html).toContain("Kitchen copy. No handover PIN or customer phone is printed.");
    expect(html).toContain(customer);
    expect(html).toContain("Whole Tilapia Flame Combo");
    expect(html).toContain("Cash on delivery");
    expect(html).not.toContain("Handover PIN");
    expect(html).not.toMatch(/0772/);

    await card
      .getByRole("button", { name: /^Bump order #\d+ to ready$/ })
      .click();
    await expect(
      page.getByText(`Order #${ticket.orderNumber} ready for pickup`),
    ).toBeVisible();
    await expect(card).toContainText("Ready — waiting for a rider");
  });

  test("applies busy mode and intake pause to the storefront", async ({
    page,
  }) => {
    await startKitchenShift(page.context(), page);

    await page.getByTestId("busy-toggle").click();
    await expect(page.getByTestId("busy-banner")).toContainText(
      "New orders receive 20 extra minutes.",
    );
    await expect(page.getByTestId("busy-toggle")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    // Wait for the server action, not just the optimistic patch.
    await expect(page.getByText("Busy mode on")).toBeVisible();
    await assertNoBlockingViolations(page, "kitchen board in busy mode");

    // Settings are persisted server-side, not just in the optimistic client.
    await page.reload();
    await expect(page.getByTestId("busy-banner")).toBeVisible();

    await page.goto("/");
    await expect(
      page.getByText(
        "The kitchen is busy. Prep times may run about 20 minutes longer than shown.",
      ),
    ).toBeVisible();

    await page.goto("/kitchen");
    await page.getByTestId("busy-toggle").click();
    await expect(page.getByText("Busy mode off")).toBeVisible();
    await expect(page.getByTestId("busy-banner")).toHaveCount(0);

    await page.getByTestId("pause-toggle").click();
    await expect(page.getByTestId("paused-banner")).toBeVisible();
    await expect(page.getByTestId("pause-toggle")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.getByText("New orders paused")).toBeVisible();
    await assertNoBlockingViolations(page, "kitchen board with intake paused");

    await page.goto("/");
    await expect(
      page.getByText("The kitchen is paused", { exact: true }),
    ).toBeVisible();

    await page.goto("/kitchen");
    await page.getByTestId("pause-toggle").click();
    await expect(page.getByText("New orders resumed")).toBeVisible();
    await expect(page.getByTestId("paused-banner")).toHaveCount(0);

    await page.goto("/");
    await expect(
      page.getByText("The kitchen is paused", { exact: true }),
    ).toHaveCount(0);
  });

  test("86 hides an item on the storefront and restores it", async ({ page }) => {
    await startKitchenShift(page.context(), page);

    await page.getByTestId("open-stock").click();
    const sheet = page.getByRole("dialog", { name: "86'd items" });
    await expect(sheet).toBeVisible();
    await assertNoBlockingViolations(page, "86 sheet");

    const tilapia = sheet.getByRole("switch", {
      name: "Whole Tilapia Flame Combo",
    });
    await expect(tilapia).not.toBeChecked();
    await tilapia.check();
    await expect(page.getByTestId("stock-count")).toHaveText("1");
    await expect(
      page.getByText("Whole Tilapia Flame Combo marked sold out"),
    ).toBeVisible();
    await expect(
      sheet.getByText("Sold out — hidden on the storefront"),
    ).toBeVisible();

    await page.getByRole("button", { name: "Close dialog" }).click();
    await page.goto("/");
    await expect(
      page.getByRole("button", {
        name: "Sold out: Whole Tilapia Flame Combo",
      }),
    ).toBeDisabled();
    await assertNoBlockingViolations(page, "storefront with a sold-out item");

    await page.goto("/kitchen");
    await page.getByTestId("open-stock").click();
    const reopened = page.getByRole("dialog", { name: "86'd items" });
    const restore = reopened.getByRole("switch", {
      name: "Whole Tilapia Flame Combo",
    });
    await expect(restore).toBeChecked();
    await restore.uncheck();
    await expect(
      page.getByText("Whole Tilapia Flame Combo is available again"),
    ).toBeVisible();
    await expect(page.getByTestId("stock-count")).toHaveText("0");
    await page.getByRole("button", { name: "Close dialog" }).click();

    await page.goto("/");
    await expect(
      page.getByRole("button", { name: "Customize Whole Tilapia Flame Combo" }),
    ).toBeEnabled();
  });

  test("completes a dine-in ticket as served and keeps it out of the rider pool", async ({
    page,
    context,
    browser,
  }) => {
    const phone = `0772 555 ${String(300 + clientCounter).slice(-3)}`;

    await page.goto(`/?table=${T4_TOKEN}`);
    await expect(page.getByText("Dine-in · Table T4").first()).toBeVisible();
    await page
      .getByRole("button", { name: "Customize Special Bazaar Rolex" })
      .click();
    const rolexDialog = page.getByRole("dialog", { name: "Special Bazaar Rolex" });
    await expect(rolexDialog).toBeVisible();
    await rolexDialog
      .getByRole("button", { name: /Add to cart · USh 8,000/ })
      .click();
    await expect(rolexDialog).toBeHidden();

    await page.getByRole("button", { name: /View cart:/ }).click();
    const cart = page.getByRole("dialog", { name: "Your cart" });
    await cart.getByRole("button", { name: "Continue to checkout" }).click();
    await expect(page).toHaveURL(new RegExp(`table=${T4_TOKEN}`));

    await page.getByLabel("Full name").fill("Alex Dine In");
    await page.getByLabel("Phone number").fill(phone);
    await page.getByRole("radio", { name: /Cash on delivery/ }).check();
    await page
      .getByRole("button", { name: /Place order · USh 8,000/ })
      .click();

    await expect(page).toHaveURL(/\/orders\/[0-9a-f-]{36}$/);
    await expect(page.getByText("Table T4")).toBeVisible();
    await expect(page.getByText("Handover PIN")).toHaveCount(0);

    await startKitchenShift(context, page);
    const ticket = page
      .locator('[data-testid^="kitchen-ticket-"]')
      .filter({ hasText: "Table T4" })
      .first();
    await expect(ticket).toBeVisible();
    await expect(ticket).toContainText("Dine-in · Table T4");
    const heading = await ticket.getByRole("heading", { level: 2 }).textContent();
    const orderNumber = Number(heading?.match(/#(\d+)/)?.[1]);
    expect(orderNumber).toBeGreaterThan(0);

    await ticket.getByRole("button", { name: /Accept order/ }).click();
    await expect(
      ticket.getByRole("button", { name: /Mark order .* served/ }),
    ).toBeVisible();
    await ticket.getByRole("button", { name: /Mark order .* served/ }).click();
    await expect(
      page.getByText(/The dine-in ticket has left the board/),
    ).toBeVisible();
    await expect(ticket).toHaveCount(0);

    // Phase 11 gate: dine-in orders never enter the rider pool.
    const riderContext = await browser.newContext();
    await riderContext.addCookies([
      {
        name: "mrfss_staff_fixture",
        value: fixtureStaffCookie(RIDER_SESSION),
        domain: "127.0.0.1",
        path: "/",
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);
    const snapshot = await riderContext.request.get("/api/rider/snapshot");
    expect(snapshot.status()).toBe(200);
    const body = (await snapshot.json()) as {
      ok: boolean;
      data?: {
        pool: Array<{ orderId: string; orderNumber: number }>;
        active: { orderId: string; orderNumber: number } | null;
      };
    };
    expect(body.ok).toBe(true);
    expect(
      body.data?.pool.some((order) => order.orderNumber === orderNumber),
    ).toBe(false);
    expect(body.data?.active?.orderNumber === orderNumber).toBe(false);
    await riderContext.close();
  });
});
