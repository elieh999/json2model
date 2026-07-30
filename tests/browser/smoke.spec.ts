import { expect, test } from "@playwright/test";

test("converts JSON without console errors or page errors", async ({
  page,
}) => {
  const problems: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") {
      problems.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => {
    problems.push(`pageerror: ${error.message}`);
  });

  await page.goto("/");
  await expect(page).toHaveTitle(/JSON2Model/);
  await page.getByLabel("Paste JSON").fill('{"id":1,"name":"Ada"}');
  await expect(page.getByLabel("Generated dart code")).toContainText(
    "class RootModel",
  );
  expect(problems).toEqual([]);
});

test("the page declares one landmark of each kind", async ({ page }) => {
  await page.goto("/");
  // A header and a footer only become banner and contentinfo landmarks while
  // they sit outside main, so the shell must not wrap them in it.
  await expect(page.getByRole("banner")).toHaveCount(1);
  await expect(page.getByRole("main")).toHaveCount(1);
  await expect(page.getByRole("contentinfo")).toHaveCount(1);
  await expect(page.locator("main header, main footer")).toHaveCount(0);
});

test("the privacy statement is visible without scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  const strip = page.getByText("Your JSON stays in your browser.");
  await expect(strip).toBeInViewport();
  // The converter itself must be usable without scrolling on a normal screen.
  await expect(page.getByLabel("Paste JSON")).toBeInViewport();
});
