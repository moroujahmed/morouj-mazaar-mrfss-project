import { expect, test, type Page } from "@playwright/test";

const T4_TOKEN = "88888888-8888-4888-8888-888888888804";

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

async function fillContact(page: Page) {
  await page.getByLabel("Full name").fill("Sarah Nakato");
  await page.getByLabel("Phone number").fill("0772 123 456");
}

test.describe("checkout and delivery quote", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("button", { name: "Add Mineral Water (500 ml) to cart" }),
    ).toBeEnabled();
  });

  test("cart CTA opens checkout and the canonical order totals USh 35,000", async ({
    page,
  }) => {
    await addTilapiaWithDip(page);

    await page
      .getByRole("button", { name: /View cart: 1 item, subtotal USh 34,000/ })
      .click();
    const cart = page.getByRole("dialog", { name: "Your cart" });
    await expect(cart.locator("#cart-subtotal")).toHaveText("USh 34,000");
    await cart.getByRole("button", { name: "Continue to checkout" }).click();

    await expect(page).toHaveURL(/\/checkout$/);
    await expect(
      page.getByRole("heading", { name: "Delivery pin" }),
    ).toBeVisible();

    const summary = page.getByRole("region", { name: "Order summary" });
    await expect(
      summary.getByText("1 × Whole Tilapia Flame Combo"),
    ).toBeVisible();
    await expect(
      summary.getByText("Golden Chips · Mineral Water (500 ml) · Extra Garlic Pepper Dip"),
    ).toBeVisible();

    await setPin(page, "0.3245", "32.5782");
    await expect(
      page.getByText("1.562 km · about 4 min drive", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText(/Free delivery · 1\.562 km/)).toBeVisible();

    await fillContact(page);
    await page
      .getByLabel("Building, floor, or landmark")
      .fill("Nakasero, Plot 12, ground floor");

    await expect(
      page.getByRole("button", { name: /Place order · USh 35,000/ }),
    ).toBeEnabled();
    const totals = summary.locator("dl");
    await expect(
      totals.getByText("USh 34,000", { exact: true }),
    ).toBeVisible();
    await expect(totals.getByText("USh 1,000", { exact: true })).toBeVisible();
    await expect(totals.getByText("USh 0", { exact: true })).toBeVisible();
  });

  test("Ntinda totals USh 38,000 with a USh 6,000 delivery fee and COD", async ({
    page,
  }) => {
    await page
      .getByRole("button", { name: "Customize Smoked Beef Luwombo" })
      .click();
    const luwombo = page.getByRole("dialog", { name: "Smoked Beef Luwombo" });
    await luwombo
      .getByRole("button", { name: /Add to cart · USh 26,000/ })
      .click();
    await expect(luwombo).toBeHidden();

    await page
      .getByRole("button", {
        name: "Add Cold-Pressed Passion Juice (500 ml) to cart",
      })
      .click();

    await page.goto("/checkout");
    const summary = page.getByRole("region", { name: "Order summary" });
    await expect(
      summary.getByText("1 × Smoked Beef Luwombo"),
    ).toBeVisible();

    await setPin(page, "0.3542", "32.6120");
    await expect(
      page.getByText("8.093 km · about 9 min drive", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText(/8\.093 km total · 4 billable km/),
    ).toBeVisible();

    await fillContact(page);
    await page
      .getByLabel("Building, floor, or landmark")
      .fill("Ntinda, Plot 8, second floor");

    const cod = page.getByRole("radio", { name: /Cash on delivery/ });
    await expect(cod).toBeEnabled();
    await cod.check();
    await expect(
      page.getByText(/Have USh 38,000 ready/),
    ).toBeVisible();

    await expect(
      page.getByRole("button", { name: /Place order · USh 38,000/ }),
    ).toBeEnabled();
    await expect(
      summary.locator("dl").getByText("USh 6,000", { exact: true }),
    ).toBeVisible();
  });

  test("an out-of-area pin blocks checkout", async ({ page }) => {
    await page
      .getByRole("button", { name: "Add Mineral Water (500 ml) to cart" })
      .click();
    await page.goto("/checkout");

    await setPin(page, "0.0512", "32.4637");
    await expect(
      page.getByText(/outside our 15 km delivery area/i).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Place order" }),
    ).toBeDisabled();
  });

  test("a failed route blocks checkout and offers a retry", async ({ page }) => {
    await page
      .getByRole("button", { name: "Add Mineral Water (500 ml) to cart" })
      .click();
    await page.goto("/checkout");

    await setPin(page, "0.4000", "32.7000");
    await expect(
      page.getByText(/We cannot calculate the route right now/i).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Retry distance" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Place order" }),
    ).toBeDisabled();
  });

  test("the minimum order value reports the exact remaining amount", async ({
    page,
  }) => {
    await page
      .getByRole("button", { name: "Add Mineral Water (500 ml) to cart" })
      .click();
    await page.goto("/checkout");

    await setPin(page, "0.3245", "32.5782");
    await expect(
      page.getByText("Add USh 18,000 more to continue."),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Place order · USh 3,000/ }),
    ).toBeDisabled();
  });

  test("the COD radius is enforced beyond 8.1 km", async ({ page }) => {
    await page
      .getByRole("button", { name: "Add Mineral Water (500 ml) to cart" })
      .click();
    await page.goto("/checkout");

    // 9.4 km fixture point: inside the 15 km delivery area but outside COD.
    await setPin(page, "0.3600", "32.6200");
    await expect(
      page.getByText("9.400 km · about 10 min drive", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("radio", { name: /Cash on delivery/ }),
    ).toBeDisabled();
  });

  test("dine-in removes delivery and packaging and bypasses the MOV", async ({
    page,
  }) => {
    await page.goto(`/?table=${T4_TOKEN}`);
    await expect(page.getByText("Dine-in · Table T4").first()).toBeVisible();
    await addRolex(page);

    await page.getByRole("button", { name: /View cart:/ }).click();
    const cart = page.getByRole("dialog", { name: "Your cart" });
    await cart.getByRole("button", { name: "Continue to checkout" }).click();

    await expect(page).toHaveURL(new RegExp(`table=${T4_TOKEN}`));
    await expect(page.getByText("Dine-in · Table T4").first()).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Delivery pin" }),
    ).toHaveCount(0);

    const summary = page.getByRole("region", { name: "Order summary" });
    await expect(summary.getByText("1 × Special Bazaar Rolex")).toBeVisible();

    await fillContact(page);
    await expect(
      page.getByRole("button", { name: /Place order · USh 8,000/ }),
    ).toBeEnabled();
  });

  test("a forged table token does not enable dine-in", async ({ page }) => {
    await page.goto("/?table=forged-token");
    await expect(page.getByText("This table link is not active")).toBeVisible();

    await page
      .getByRole("button", { name: "Add Mineral Water (500 ml) to cart" })
      .click();
    await page.goto("/checkout?table=forged-token");
    await expect(page.getByText("This table link is not active")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Delivery pin" }),
    ).toBeVisible();
  });
});
