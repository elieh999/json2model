import { execFileSync } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";

/**
 * The single file build is what people are handed to run offline, and it has
 * failure modes the hosted build does not: a module script will not load from the
 * file protocol, an inline classic script runs before the body exists, and the
 * minified React bundle contains `$'` and `$&`, which a string replacement expands
 * as patterns and splices the document into the script.
 *
 * These tests open the built file directly, the same way a person would.
 */
const projectRoot = path.resolve(import.meta.dirname, "..", "..");
const builtFile = path.join(projectRoot, "dist-standalone", "JSON2Model.html");
const fileUrl = `file://${builtFile.replaceAll("\\", "/")}`;

test.beforeAll(() => {
  // Built here rather than assumed, so the tests always describe current code.
  execFileSync("npm", ["run", "build:standalone"], {
    cwd: projectRoot,
    stdio: "pipe",
    shell: process.platform === "win32",
  });
});

test("is one file with nothing beside it", async () => {
  const size = (await stat(builtFile)).size;
  expect(size).toBeGreaterThan(50_000);
  // A bundled browser runtime would be hundreds of megabytes. Guard the point of
  // this build.
  expect(size).toBeLessThan(2_000_000);

  const html = await readFile(builtFile, "utf8");
  expect(html).not.toMatch(/<script[^>]+src=/);
  expect(html).not.toMatch(/<link[^>]+rel="stylesheet"/);
  // The document must appear exactly once. It was previously duplicated into the
  // middle of the inlined script by a replacement pattern.
  expect(html.match(/<!doctype html>/gi)).toHaveLength(1);
});

test("converts JSON when opened straight from disk", async ({ page }) => {
  const problems: string[] = [];
  const requests: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") {
      problems.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));
  page.on("request", (request) => requests.push(request.url()));

  await page.goto(fileUrl);
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
    "BaseModel",
  );

  expect(problems).toEqual([]);
  // The only thing fetched may be the document itself.
  expect(requests).toEqual([expect.stringContaining("JSON2Model.html")]);
});

test("keeps its styling and settings when opened from disk", async ({
  page,
}) => {
  await page.goto(fileUrl);
  await page.getByRole("button", { name: "Example" }).click();
  await page.getByLabel("Generated dart code").waitFor();

  const font = await page.evaluate(() => {
    const code = document.querySelector(".code-output");
    return code ? getComputedStyle(code).fontFamily : "";
  });
  expect(font).toContain("monospace");

  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByLabel("Detect dates").check();
  await expect(page.getByLabel("Generated dart code")).toContainText(
    "DateTime",
  );

  await page.getByRole("button", { name: "Dark" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});
