/**
 * Captures the screenshots used in the README from the real application.
 *
 * Serve a build first, then run this against it:
 *   npm run build
 *   npm run preview -- --port 4173 --strictPort
 *   node scripts/capture-screenshots.mjs
 */
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const baseUrl = process.env.SCREENSHOT_BASE_URL ?? "http://127.0.0.1:4173/";
const output = path.resolve("docs/screenshots");
await mkdir(output, { recursive: true });

const EXAMPLE = JSON.stringify(
  {
    "request-id": "req_01J93Y6M",
    created_at: "2026-07-30T08:30:00Z",
    "user profile": {
      id: 42,
      display_name: "Maya Chen",
      "2fa_enabled": true,
      email: null,
    },
    items: [
      { sku: "DEV-001", quantity: 2, unit_price: 19.95 },
      { sku: "DEV-002", quantity: 1, unit_price: 8, note: "Backordered" },
    ],
    metadata: {},
  },
  null,
  2,
);

const browser = await chromium.launch();

// A flat interface stays readable at 1x, and the README stays small.
async function shot({ name, width, height, theme, language, scale = 1 }) {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: scale,
    colorScheme: theme === "dark" ? "dark" : "light",
  });
  const page = await context.newPage();
  await page.goto(baseUrl);
  await page.evaluate(() => {
    localStorage.clear();
  });
  await page.reload();

  await page
    .getByRole("button", { name: theme === "dark" ? "Dark" : "Light" })
    .click();
  if (language) {
    await page.getByRole("button", { name: new RegExp(language, "i") }).click();
  }
  await page.getByLabel("Paste JSON").fill(EXAMPLE);
  await page.getByLabel(/^Generated .* code$/).waitFor();
  // Let the deferred generation settle before the frame is captured.
  await page.waitForTimeout(400);

  const file = path.join(output, `${name}.png`);
  await page.screenshot({ path: file });
  console.log(`wrote ${file}`);
  await context.close();
}

await shot({ name: "desktop-light", width: 1440, height: 900, theme: "light" });
await shot({ name: "desktop-dark", width: 1440, height: 900, theme: "dark" });
await shot({
  name: "output-dart",
  width: 1280,
  height: 820,
  theme: "dark",
  language: "Dart",
});
await shot({
  name: "output-typescript",
  width: 1280,
  height: 820,
  theme: "dark",
  language: "TypeScript",
});
await shot({
  name: "output-python",
  width: 1280,
  height: 820,
  theme: "light",
  language: "Python",
});
await shot({
  name: "mobile-light",
  width: 390,
  height: 900,
  theme: "light",
  scale: 2,
});
await shot({
  name: "mobile-dark",
  width: 390,
  height: 900,
  theme: "dark",
  scale: 2,
});

await browser.close();
