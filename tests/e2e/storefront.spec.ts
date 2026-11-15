import { expect, test } from "@playwright/test";

test.describe("storefront", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { level: 1, name: "Bazaar Flame & Grill" }),
    ).toBeVisible();
    // Hydration must finish before cart actions are enabled.
    await expect(
      page.getByRole("button", { name: "Add Mineral Water (500 ml) to cart" }),
    ).toBeEnabled();
  });

  test("renders canonical categories, dishes, and prices", async ({ page }) => {
    await expect(page.getByText("12 dishes", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("heading", {
        level: 3,
        name: "Combos & Bazaar Deals",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", {
        level: 3,
        name: "Whole Tilapia Flame Combo",
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 3, name: "Special Bazaar Rolex" }),
    ).toBeVisible();

    const tilapiaCard = page
      .locator("article")
      .filter({ hasText: "Whole Tilapia Flame Combo" });
    await expect(tilapiaCard.getByText("USh 32,000")).toBeVisible();
    await expect(tilapiaCard.getByText("Ready in about 25 min")).toBeVisible();

    const rolexCard = page
      .locator("article")
      .filter({ hasText: "Special Bazaar Rolex" });
    await expect(rolexCard.getByText("USh 8,000")).toBeVisible();
  });

  test("search and category pills filter without a broken grid", async ({
    page,
  }) => {
    const search = page.getByRole("searchbox", { name: "Search the menu" });

    await search.fill("rolex");
    await expect(page.getByText("1 dish matching")).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 3, name: "Special Bazaar Rolex" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 3, name: "Whole Tilapia Flame Combo" }),
    ).toBeHidden();

    await page
      .getByRole("button", { name: "Clear search and filters" })
      .first()
      .click();
    await expect(page.getByText("12 dishes", { exact: true })).toBeVisible();

    const drinks = page.getByRole("button", {
      name: "Fresh Juices & Drinks",
    });
    await drinks.click();
    await expect(drinks).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText("4 dishes", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 3, name: "African Coffee" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 3, name: "Whole Tilapia Flame Combo" }),
    ).toBeHidden();

    await search.fill("no such dish");
    await expect(page.getByText("No dishes match your search")).toBeVisible();
  });

  test("keyboard-only combo customization reaches USh 34,000", async ({
    page,
  }) => {
    const customize = page.getByRole("button", {
      name: "Customize Whole Tilapia Flame Combo",
    });
    await customize.focus();
    await page.keyboard.press("Enter");

    const dialog = page.getByRole("dialog", {
      name: "Whole Tilapia Flame Combo",
    });
    await expect(dialog).toBeVisible();

    // Combo defaults are preselected: Golden Chips and Mineral Water.
    await expect(
      dialog.getByRole("radio", { name: /Golden Chips/ }),
    ).toBeChecked();
    await expect(
      dialog.getByRole("radio", { name: /Mineral Water/ }),
    ).toBeChecked();

    const matoke = dialog.getByRole("radio", { name: /Matoke & Groundnut/ });
    await matoke.focus();
    await page.keyboard.press("Space");
    await expect(matoke).toBeChecked();

    const dip = dialog.getByRole("checkbox", {
      name: /Extra Garlic Pepper Dip/,
    });
    await dip.focus();
    await page.keyboard.press("Space");
    await expect(dip).toBeChecked();

    const add = dialog.getByRole("button", {
      name: /Add to cart · USh 34,000/,
    });
    await add.focus();
    await page.keyboard.press("Enter");
    await expect(dialog).toBeHidden();

    const dock = page.getByRole("button", {
      name: /View cart: 1 item, subtotal USh 34,000/,
    });
    await expect(dock).toBeVisible();
    await dock.focus();
    await page.keyboard.press("Enter");

    const cart = page.getByRole("dialog", { name: "Your cart" });
    await expect(cart).toBeVisible();
    await expect(cart.locator("#cart-subtotal")).toHaveText("USh 34,000");
    await expect(cart.getByText("Extra Garlic Pepper Dip")).toBeVisible();
    await expect(cart.getByText("Matoke & Groundnut")).toBeVisible();

    const increase = cart.getByRole("button", {
      name: /Increase quantity of Whole Tilapia Flame Combo/,
    });
    await increase.focus();
    await page.keyboard.press("Enter");
    await expect(cart.locator("#cart-subtotal")).toHaveText("USh 68,000");

    await page.keyboard.press("Escape");
    await expect(cart).toBeHidden();
  });

  test("Escape closes the item sheet and restores focus", async ({ page }) => {
    const customize = page.getByRole("button", {
      name: "Customize Smoked Beef Luwombo",
    });
    await customize.click();

    const dialog = page.getByRole("dialog", {
      name: "Smoked Beef Luwombo",
    });
    await expect(dialog).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(customize).toBeFocused();
  });

  test("persists the cart across a reload", async ({ page }) => {
    const addWater = page.getByRole("button", {
      name: "Add Mineral Water (500 ml) to cart",
    });
    await addWater.click();
    await addWater.click();

    const dock = page.getByRole("button", {
      name: /View cart: 2 items, subtotal USh 4,000/,
    });
    await expect(dock).toBeVisible();

    await page.reload();
    await expect(
      page.getByRole("button", {
        name: /View cart: 2 items, subtotal USh 4,000/,
      }),
    ).toBeVisible();
  });
});
