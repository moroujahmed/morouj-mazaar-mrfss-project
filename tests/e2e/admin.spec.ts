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

// Checkout is rate limited per IP; local `next start` sees every browser as
// `unknown`. Give each case its own forwarded address the way a proxy would.
const IP_PREFIX = `198.51.${160 + Math.floor(Math.random() * 90)}`;
let clientCounter = 0;
let nameCounter = 0;
let phoneCounter = 0;

function unique(prefix: string): string {
  nameCounter += 1;
  return `${prefix} ${Date.now().toString(36)}-${nameCounter}`;
}

function uniquePhone(): string {
  phoneCounter += 1;
  return `0772 555 ${String(100 + phoneCounter).slice(-3)}`;
}

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

const ADMIN = { phone: "0700 111 000", pin: "246810" } as const;

/** Admin Kasule's fixture session, mirroring `src/lib/auth/fixture-staff.ts`. */
const ADMIN_SESSION = {
  userId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb01",
  fullName: "Admin Kasule",
  phone: "+256700111000",
  role: "ADMIN",
  mustChangePin: false,
} as const;

/** Chef Musa's session is a valid staff session with the wrong portal role. */
const CHEF_SESSION = {
  userId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb02",
  fullName: "Chef Musa",
  phone: "+256700111001",
  role: "KITCHEN",
  mustChangePin: false,
} as const;

type FixtureSession = typeof ADMIN_SESSION | typeof CHEF_SESSION;

/**
 * The staff login limiter allows five attempts per phone per fifteen minutes,
 * so full runs sign the documented fixture cookie instead of signing in for
 * every case. The login form is covered by its own test below.
 */
function fixtureStaffCookie(session: FixtureSession): string {
  const payload = Buffer.from(
    JSON.stringify({
      ...session,
      exp: Math.floor(Date.now() / 1_000) + 60 * 60,
    }),
    "utf8",
  ).toString("base64url");

  // The server signs with Web Crypto and base64url-encodes the digest bytes as
  // a string (TextEncoder UTF-8 encodes bytes above 0x7f). Mirror that exactly.
  const digest = createHmac("sha256", "mrfss-playwright-staff-fixture-secret")
    .update(payload)
    .digest();
  const binary = [...digest]
    .map((byte) => String.fromCharCode(byte))
    .join("");
  const signature = Buffer.from(binary, "utf8").toString("base64url");

  return `${payload}.${signature}`;
}

async function setStaffCookie(
  context: BrowserContext,
  session: FixtureSession,
) {
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

async function startAdmin(context: BrowserContext, page: Page) {
  await setStaffCookie(context, ADMIN_SESSION);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin$/);
  await expect(
    page.getByRole("heading", { name: "Operations hub", level: 1 }),
  ).toBeVisible();
}

async function signInAdmin(
  page: Page,
  staff: { phone: string; pin: string } = ADMIN,
  pinOverride?: string,
) {
  await page.goto("/admin/login");
  await page.getByLabel("Phone number").fill(staff.phone);
  await page.getByLabel("6-digit PIN").fill(pinOverride ?? staff.pin);
  await page.getByRole("button", { name: "Sign in" }).click();
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

/** Places a COD order so the admin live monitor has a real row to act on. */
async function placeCashOrder(page: Page, customer: string) {
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
  await page.getByLabel("Phone number").fill(uniquePhone());
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
    .getByRole("button", { name: /Place order .* USh 35,000/ })
    .click();

  await expect(page).toHaveURL(/\/orders\/[0-9a-f-]{36}$/);
  await expect(
    page.getByRole("heading", { name: "Order received" }),
  ).toBeVisible();
}

function auditRow(page: Page, action: string) {
  return page
    .getByTestId("admin-audit-row")
    .filter({ hasText: action })
    .first();
}

test.describe("admin hub", () => {
  test("guards the hub, rejects a wrong PIN, and redirects the wrong role", async ({
    page,
    context,
  }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login$/);
    await expect(
      page.getByRole("heading", { name: "Admin hub", level: 1 }),
    ).toBeVisible();
    await assertNoBlockingViolations(page, "admin login");

    await signInAdmin(page, ADMIN, "000000");
    await expect(
      page.getByText("That phone number or PIN is not correct."),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/login$/);

    await page.getByLabel("6-digit PIN").fill(ADMIN.pin);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/admin$/);
    await expect(
      page.getByRole("heading", { name: "Operations hub", level: 1 }),
    ).toBeVisible();
    await expect(page.getByText("Admin Kasule")).toBeVisible();

    // A valid staff session with a non-admin role is sent to its own portal.
    await setStaffCookie(context, CHEF_SESSION);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/kitchen$/);
  });

  test("renders every section with working tabs and no blocking a11y issues", async ({
    page,
    context,
  }) => {
    await startAdmin(context, page);

    const sections: Array<[string, string]> = [
      ["orders", "Live orders"],
      ["menu", "Menu catalogue"],
      ["settings", "Settings"],
      ["ledger", "Cash ledger"],
      ["analytics", "Analytics"],
      ["audit", "Audit feed"],
      ["staff", "Staff & roles"],
      ["tables", "Dine-in tables"],
    ];

    for (const [id, heading] of sections) {
      const tab = page.getByTestId(`admin-tab-${id}`);
      await expect(tab).toBeVisible();
      await tab.click();
      await expect(tab).toHaveAttribute("aria-current", "page");
      await expect(page.getByTestId("admin-panel")).toBeVisible();
      await expect(
        page.getByRole("heading", { name: heading, level: 2 }),
      ).toBeVisible();
    }

    await page.getByTestId("admin-tab-orders").click();
    await assertNoBlockingViolations(page, "admin orders panel");
    await page.getByTestId("admin-tab-settings").click();
    await assertNoBlockingViolations(page, "admin settings panel");
    await page.getByTestId("admin-tab-staff").click();
    await assertNoBlockingViolations(page, "admin staff panel");
    await page.getByTestId("admin-tab-tables").click();
    await assertNoBlockingViolations(page, "admin tables panel");
  });

  test("requires a typed reason before cancelling an order and audits it", async ({
    page,
    context,
  }) => {
    const customer = unique("Admin E2E");
    await placeCashOrder(page, customer);
    await startAdmin(context, page);

    await page.getByLabel("Search orders").fill(customer);
    const row = page
      .locator('[data-testid^="admin-order-row-"]')
      .filter({ hasText: customer });
    await expect(row).toHaveCount(1);
    await row.getByRole("button", { name: "Open" }).click();
    await expect(page.getByTestId("admin-order-drawer")).toBeVisible();
    await expect(row).toContainText("CONFIRMED UNPAID");

    // A one-character reason is rejected before any mutation is attempted.
    await page.getByTestId("admin-action-reason").fill("no");
    await page.getByRole("button", { name: "Cancel order" }).click();
    await expect(page.getByText("Reason required")).toBeVisible();
    await expect(row).toContainText("CONFIRMED UNPAID");

    const reason = unique("Duplicate test order");
    await page.getByTestId("admin-action-reason").fill(reason);
    await page.getByRole("button", { name: "Cancel order" }).click();
    await expect(page.getByText("Order cancelled")).toBeVisible();
    await expect(row).toContainText("CANCELLED");

    await page.getByRole("button", { name: "Close dialog" }).click();
    await page.getByTestId("admin-tab-audit").click();
    const event = auditRow(page, "ADMIN_CANCEL_ORDER");
    await expect(event).toContainText(reason);
    await expect(event).toContainText("Admin Kasule");
  });

  test("saves settings with a reason, reaches the storefront, and audits the change", async ({
    page,
    context,
  }) => {
    await startAdmin(context, page);
    await page.getByTestId("admin-tab-settings").click();

    const nameField = page.getByLabel("Restaurant name");
    const original = await nameField.inputValue();
    const testName = unique("Bazaar E2E");
    const reason = unique("Settings review");

    try {
      await nameField.fill(testName);
      await page.getByLabel("Reason for change").fill(reason);
      await page.getByTestId("admin-save-settings").click();
      await expect(page.getByText("Settings saved")).toBeVisible();

      // Admin fixture edits are applied to the storefront fixture as well.
      await page.goto("/");
      await expect(page.getByText(testName, { exact: true }).first()).toBeVisible();

      await page.goto("/admin");
      await page.getByTestId("admin-tab-audit").click();
      await expect(auditRow(page, "ADMIN_UPDATE_SETTINGS")).toContainText(
        reason,
      );
    } finally {
      // Never leak a renamed restaurant into the other browser suites.
      await page.goto("/admin");
      await page.getByTestId("admin-tab-settings").click();
      await page.getByLabel("Restaurant name").fill(original);
      await page
        .getByLabel("Reason for change")
        .fill("Restore storefront fixture name");
      await page.getByTestId("admin-save-settings").click();
      await expect(page.getByText("Settings saved")).toBeVisible();
    }
  });

  test("creates, archives, and audits menu entries with typed reasons", async ({
    page,
    context,
  }) => {
    await startAdmin(context, page);
    await page.getByTestId("admin-tab-menu").click();

    const reason = unique("Menu catalogue update");
    const categoryName = unique("E2E Category");
    const categorySlug = `e2e-cat-${nameCounter}`;
    const itemName = unique("E2E Item");
    const itemSlug = `e2e-item-${nameCounter}`;

    await page.getByLabel("Reason for menu change").fill(reason);
    await page.getByLabel("Name").fill(categoryName);
    await page.getByLabel("Slug").fill(categorySlug);
    await page.getByTestId("admin-add-category").click();
    await expect(page.getByText("Category saved")).toBeVisible();
    await expect(page.getByText(categoryName)).toBeVisible();

    await page.getByLabel("Reason for menu change").fill(reason);
    await page.getByTestId(`admin-add-item-${categorySlug}`).click();
    const sheet = page.getByRole("dialog", { name: "New menu item" });
    await expect(sheet).toBeVisible();
    await sheet.getByLabel("Name").fill(itemName);
    await sheet.getByLabel("Slug").fill(itemSlug);
    await sheet.getByLabel("Base price").fill("9000");
    await page.getByTestId("admin-save-menu-item").click();
    await expect(page.getByText("Menu item saved")).toBeVisible();
    await expect(page.getByText(itemName)).toBeVisible();

    await page.getByLabel("Reason for menu change").fill(reason);
    const card = page.locator("li").filter({ hasText: itemName });
    await card.getByRole("button", { name: "Archive" }).click();
    await expect(page.getByText("Item archived")).toBeVisible();
    await expect(card).toContainText("Archived");

    await page.getByTestId("admin-tab-audit").click();
    for (const action of [
      "ADMIN_UPSERT_CATEGORY",
      "ADMIN_UPSERT_MENU_ITEM",
      "ADMIN_ARCHIVE_MENU_ITEM",
    ]) {
      await expect(auditRow(page, action)).toContainText(reason);
    }
    await assertNoBlockingViolations(page, "admin audit after menu changes");
  });

  test("creates and edits a table with a reason while keeping its QR token", async ({
    page,
    context,
  }) => {
    await startAdmin(context, page);
    await page.getByTestId("admin-tab-tables").click();

    const tableNumber = `E${String(nameCounter).padStart(2, "0")}`;
    const originalLabel = unique("Patio");
    const updatedLabel = unique("Patio Window");
    const createReason = unique("Add a test table");
    const editReason = unique("Relabel the test table");

    await page.getByTestId("admin-add-table").click();
    let form = page.getByTestId("admin-table-form");
    await form.getByLabel("Table number").fill(tableNumber);
    await form.getByLabel("Label").fill(originalLabel);
    await form.getByLabel("Reason for change").fill(createReason);
    await page.getByTestId("admin-save-table").click();
    await expect(page.getByText("Table created")).toBeVisible();

    const qr = page.getByTestId(`admin-table-qr-${tableNumber}`);
    await expect(qr).toContainText("/?table=");
    const token = await qr.textContent();

    const row = page.getByTestId(`admin-table-row-${tableNumber}`);
    await row.getByRole("button", { name: "Edit" }).click();
    form = page.getByTestId("admin-table-form");
    await form.getByLabel("Label").fill(updatedLabel);
    await form.getByLabel("Reason for change").fill(editReason);
    await page.getByTestId("admin-save-table").click();
    await expect(page.getByText("Table updated")).toBeVisible();
    await expect(page.getByTestId(`admin-table-qr-${tableNumber}`)).toHaveText(
      token ?? "",
    );

    await page.getByTestId("admin-tab-audit").click();
    for (const reason of [createReason, editReason]) {
      await expect(
        page
          .getByTestId("admin-audit-row")
          .filter({ hasText: "ADMIN_UPSERT_TABLE" })
          .filter({ hasText: reason }),
      ).toBeVisible();
    }
  });

  test("protects the last admin and audits a staff plate change", async ({
    page,
    context,
  }) => {
    await startAdmin(context, page);
    await page.getByTestId("admin-tab-staff").click();

    const adminRow = page.getByTestId("admin-staff-row-Admin Kasule");
    const adminSave = adminRow.getByTestId("admin-staff-save-Admin Kasule");
    await expect(adminSave).toBeEnabled();
    await adminRow.getByLabel("Role").selectOption("KITCHEN");
    await expect(adminSave).toBeDisabled();
    await adminRow.getByLabel("Active").uncheck();
    await expect(adminSave).toBeDisabled();
    await adminRow.getByLabel("Role").selectOption("ADMIN");
    await adminRow.getByLabel("Active").check();
    await expect(adminSave).toBeEnabled();

    const riderRow = page.getByTestId("admin-staff-row-Rider Juma");
    const plateField = riderRow.getByLabel("Plate");
    const originalPlate = await plateField.inputValue();
    const reason = unique("Temporary E2E plate");

    try {
      await plateField.fill(`UFD E${nameCounter}`);
      await riderRow
        .getByTestId("admin-staff-reason-Rider Juma")
        .fill(reason);
      await riderRow.getByTestId("admin-staff-save-Rider Juma").click();
      await expect(page.getByText("Staff member updated")).toBeVisible();

      await page.getByTestId("admin-tab-audit").click();
      await expect(auditRow(page, "ADMIN_UPDATE_STAFF")).toContainText(reason);
    } finally {
      await page.goto("/admin");
      await page.getByTestId("admin-tab-staff").click();
      const restoreRow = page.getByTestId("admin-staff-row-Rider Juma");
      await restoreRow.getByLabel("Plate").fill(originalPlate);
      await restoreRow
        .getByTestId("admin-staff-reason-Rider Juma")
        .fill("Restore rider plate fixture");
      await restoreRow.getByTestId("admin-staff-save-Rider Juma").click();
      await expect(page.getByText("Staff member updated")).toBeVisible();
    }
  });
});
