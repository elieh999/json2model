import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test("complete conversion flow across all languages", async ({ page }) => {
  await page.getByRole("button", { name: "Example" }).click();
  await expect(page.getByLabel("Generated dart code")).toContainText(
    "class RootModel",
  );

  await page.getByRole("button", { name: /TypeScript/ }).click();
  await expect(page.getByLabel("Generated typescript code")).toContainText(
    "export interface RootModel",
  );

  await page.getByRole("button", { name: /Python/ }).click();
  await expect(page.getByLabel("Generated python code")).toContainText(
    "class RootModel(BaseModel)",
  );
});

test("invalid JSON recovers without losing the interface", async ({ page }) => {
  const input = page.getByLabel("Paste JSON");
  await input.fill('{"name": }');
  await expect(page.getByRole("alert")).toContainText("Invalid JSON");
  await expect(page.getByRole("heading", { name: "JSON input" })).toBeVisible();

  await input.fill('{"name":"Ada"}');
  await expect(page.getByLabel("Generated dart code")).toContainText(
    "final String name",
  );
});

test("mobile layout stacks the panels", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Example" }).click();
  const panels = page.locator(".editor-panel");
  await expect(panels).toHaveCount(2);
  const first = await panels.nth(0).boundingBox();
  const second = await panels.nth(1).boundingBox();
  expect(first).not.toBeNull();
  expect(second).not.toBeNull();
  expect(second!.y).toBeGreaterThan(first!.y + first!.height - 2);
});

test("dark mode is selectable and keyboard focus remains visible", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Dark" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  await page.keyboard.press("Tab");
  const focusOutline = await page.evaluate(() => {
    const element = document.activeElement;
    return element ? getComputedStyle(element).outlineStyle : "none";
  });
  expect(focusOutline).not.toBe("none");
});

test("copy output works when clipboard permission is available", async ({
  context,
  page,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.getByRole("button", { name: "Example" }).click();
  await page.getByRole("button", { name: "Copy code" }).click();
  await expect(page.getByRole("status")).toContainText("Generated code copied");
  const clipboard = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboard).toContain("class RootModel");
});

test("large JSON regenerates within the supported limit", async ({ page }) => {
  const largeObject = Object.fromEntries(
    Array.from({ length: 2_500 }, (_, index) => [`field_${index}`, index]),
  );
  await page.getByLabel("Paste JSON").fill(JSON.stringify(largeObject));
  await expect(page.getByLabel("Generated dart code")).toContainText(
    "'field_2499'",
    { timeout: 20_000 },
  );
});

test("refresh persists settings but not JSON by default", async ({ page }) => {
  await page.getByRole("button", { name: "Example" }).click();
  await page.getByRole("button", { name: "Dark" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.getByLabel("Paste JSON")).toHaveValue("");
});

test("conversion does not upload JSON", async ({ page }) => {
  const unexpected: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (
      request.method() !== "GET" ||
      (url.hostname !== "127.0.0.1" && url.hostname !== "localhost")
    ) {
      unexpected.push(`${request.method()} ${request.url()}`);
    }
  });

  await page.getByLabel("Paste JSON").fill(
    JSON.stringify({
      private_value: "never-upload-this-marker",
      active: true,
    }),
  );
  await expect(page.getByLabel("Generated dart code")).toContainText(
    "privateValue",
  );
  expect(unexpected).toEqual([]);
});
