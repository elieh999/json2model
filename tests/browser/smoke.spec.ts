import { expect, test } from "@playwright/test";

test("production build converts JSON without console errors", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(message.text());
    }
  });

  await page.goto("/");
  await expect(page).toHaveTitle(/JSON2Model/);
  await page.getByLabel("Paste JSON").fill('{"id":1,"name":"Ada"}');
  await expect(page.getByLabel("Generated dart code")).toContainText(
    "class RootModel",
  );
  expect(errors).toEqual([]);
});
