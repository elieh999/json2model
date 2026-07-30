import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect } from "@playwright/test";
import { _electron as electron } from "playwright";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const executablePath = path.join(
  projectRoot,
  "release",
  "win-unpacked",
  "JSON2Model.exe",
);

/*
 * `ELECTRON_RUN_AS_NODE` makes an Electron binary behave as plain Node, so the
 * window never opens and every command line flag is rejected. Some shells and
 * tool harnesses export it, so it is removed from the environment the packaged
 * application inherits.
 */
const environment = { ...process.env };
delete environment.ELECTRON_RUN_AS_NODE;

const errors = [];
let desktopApp;

try {
  desktopApp = await electron.launch({ executablePath, env: environment });
  const window = await desktopApp.firstWindow();

  window.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(message.text());
    }
  });
  window.on("pageerror", (error) => {
    errors.push(error.message);
  });

  await window.waitForLoadState("domcontentloaded");
  await expect(window).toHaveTitle(/JSON2Model/);
  const brand = window.getByText("JSON2Model", { exact: true }).first();
  if ((await brand.count()) === 0) {
    throw new Error(
      `Desktop renderer did not start. URL: ${window.url()}. Body: ${await window.locator("body").innerText()}. Errors: ${errors.join(" | ")}`,
    );
  }
  await expect(brand).toBeVisible();
  await expect(window.getByLabel("Paste JSON")).toBeVisible();

  // The packaged application keeps its own storage between runs, so settings a
  // previous run left behind are cleared before anything is asserted.
  await window.evaluate(() => {
    localStorage.clear();
  });
  await window.reload();
  await expect(window.getByLabel("Paste JSON")).toBeVisible();

  await window
    .getByLabel("Paste JSON")
    .fill('{"id":1,"profile":{"display-name":"Ada"}}');
  await expect(window.getByLabel("Generated dart code")).toContainText(
    "class RootModel",
  );
  await expect(window.getByLabel("Generated dart code")).toContainText(
    "display-name",
  );

  const bridgeAvailable = await window.evaluate(
    () => typeof window.json2ModelDesktop?.writeClipboard === "function",
  );
  expect(bridgeAvailable).toBe(true);

  await window.getByRole("button", { name: "Copy code" }).click();
  const clipboardText = await desktopApp.evaluate(({ clipboard }) =>
    clipboard.readText(),
  );
  expect(clipboardText).toContain("class RootModel");
  expect(errors).toEqual([]);

  console.log("Desktop smoke test passed.");
} finally {
  await desktopApp?.close();
}
