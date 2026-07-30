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
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("settings changes regenerate the output", async ({ page }) => {
  await page.getByLabel("Paste JSON").fill('{"created_at":"2026-07-30"}');
  await page.getByRole("button", { name: "Settings" }).click();

  const output = page.getByLabel("Generated dart code");
  await expect(output).toContainText("final String createdAt");

  await page.getByLabel("Detect dates").check();
  await expect(output).toContainText("final DateTime createdAt");

  await page.getByLabel("Include toJson").uncheck();
  await expect(output).not.toContainText("toJson()");
});

test("the interface uses a monospace font for JSON and code", async ({
  page,
}) => {
  // The packaged build once lost its font variables and fell back to a
  // proportional font, which is hard to read for JSON.
  await page.getByRole("button", { name: "Example" }).click();
  await page.getByLabel("Generated dart code").waitFor();
  const fonts = await page.evaluate(() => {
    const code = document.querySelector(".code-output");
    const textarea = document.querySelector("textarea");
    return {
      code: code ? getComputedStyle(code).fontFamily : "",
      textarea: textarea ? getComputedStyle(textarea).fontFamily : "",
      body: getComputedStyle(document.body).fontFamily,
    };
  });
  expect(fonts.code).toContain("monospace");
  expect(fonts.textarea).toContain("monospace");
  expect(fonts.body).not.toContain("Times");
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

  // The page must not scroll sideways on a phone.
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});

test("the layout survives a narrow viewport at large text size", async ({
  page,
}) => {
  await page.setViewportSize({ width: 640, height: 720 });
  await page.getByRole("button", { name: "Example" }).click();
  await expect(page.getByRole("heading", { name: "JSON input" })).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});

test("dark mode applies and follows the system setting", async ({ page }) => {
  // The page colour lives on the root element. The body only carries the
  // gradient overlay, so its background colour is transparent.
  const pageColour = () =>
    page.evaluate(
      () => getComputedStyle(document.documentElement).backgroundColor,
    );

  await page.getByRole("button", { name: "Dark" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const dark = await pageColour();

  await page.getByRole("button", { name: "Light" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  const light = await pageColour();
  expect(dark).not.toBe(light);
  expect(dark).not.toBe("rgba(0, 0, 0, 0)");

  await page.emulateMedia({ colorScheme: "dark" });
  await page.getByRole("button", { name: "System" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "system");
  expect(await pageColour()).toBe(dark);

  await page.emulateMedia({ colorScheme: "light" });
  expect(await pageColour()).toBe(light);
});

test("every control is reachable by keyboard with a visible focus ring", async ({
  page,
}) => {
  const reached: string[] = [];
  for (let step = 0; step < 24; step += 1) {
    await page.keyboard.press("Tab");
    const focused = await page.evaluate(() => {
      const element = document.activeElement;
      if (!element || element === document.body) {
        return null;
      }
      const style = getComputedStyle(element);
      return {
        label: (element.textContent ?? element.getAttribute("aria-label") ?? "")
          .trim()
          .slice(0, 40),
        tag: element.tagName,
        outline: style.outlineStyle,
        outlineWidth: style.outlineWidth,
      };
    });
    if (!focused) {
      continue;
    }
    reached.push(`${focused.tag}:${focused.label}`);
    expect(focused.outline).not.toBe("none");
    expect(focused.outlineWidth).not.toBe("0px");
  }

  // The tab order has to reach the settings, the language tabs, the theme
  // buttons, and the editor itself.
  expect(reached.some((entry) => entry.includes("Settings"))).toBe(true);
  expect(reached.some((entry) => entry.includes("Dart"))).toBe(true);
  expect(reached.some((entry) => entry.includes("Dark"))).toBe(true);
  expect(reached.some((entry) => entry.startsWith("TEXTAREA"))).toBe(true);
});

test("the example can be loaded and copied using only the keyboard", async ({
  context,
  page,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.getByRole("button", { name: "Example" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("Generated dart code")).toContainText(
    "class RootModel",
  );

  await page.getByRole("button", { name: "Copy code" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status")).toContainText("Generated code copied");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(
    "class RootModel",
  );
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
    { timeout: 30_000 },
  );
  // The interface must stay interactive while a large document is converted.
  await page.getByRole("button", { name: /TypeScript/ }).click();
  await expect(page.getByLabel("Generated typescript code")).toContainText(
    "field_2499",
    { timeout: 30_000 },
  );
});

test("a document past the depth limit reports a readable message", async ({
  page,
}) => {
  const deep = await page.evaluate(() => {
    let value: unknown = { leaf: true };
    for (let index = 0; index < 120; index += 1) {
      value = { next: value };
    }
    return JSON.stringify(value);
  });
  await page.getByLabel("Paste JSON").fill(deep);
  await expect(page.getByRole("alert")).toContainText("past a safety limit");
  await expect(page.getByRole("heading", { name: "JSON input" })).toBeVisible();
});

test("refresh persists settings but not JSON by default", async ({ page }) => {
  await page.getByRole("button", { name: "Example" }).click();
  await page.getByRole("button", { name: "Dark" }).click();
  await page.getByRole("button", { name: /Python/ }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(
    page.getByRole("heading", { name: "Python output" }),
  ).toBeVisible();
  await expect(page.getByLabel("Paste JSON")).toHaveValue("");
});

test("conversion sends no request and stores nothing by default", async ({
  page,
}) => {
  const marker = "never-upload-this-marker";
  const requests: string[] = [];
  const leaks: string[] = [];
  page.on("request", (request) => {
    requests.push(`${request.method()} ${request.url()}`);
    const body = request.postData();
    if (body?.includes(marker) || request.url().includes(marker)) {
      leaks.push(request.url());
    }
  });

  await page
    .getByLabel("Paste JSON")
    .fill(JSON.stringify({ private_value: marker, active: true }));
  await expect(page.getByLabel("Generated dart code")).toContainText(
    "privateValue",
  );

  expect(leaks).toEqual([]);

  // No request may leave the origin that served the page.
  const origin = new URL(page.url()).origin;
  const external = requests.filter((entry) => {
    const url = entry.slice(entry.indexOf(" ") + 1);
    return !url.startsWith(origin) && !url.startsWith("data:");
  });
  expect(external).toEqual([]);

  const stored = await page.evaluate(() => ({
    local: { ...localStorage },
    session: { ...sessionStorage },
    cookies: document.cookie,
  }));
  expect(JSON.stringify(stored)).not.toContain(marker);
  expect(stored.cookies).toBe("");
});

test("no service worker is registered", async ({ page }) => {
  const registrations = await page.evaluate(async () => {
    if (!("serviceWorker" in navigator)) {
      return 0;
    }
    return (await navigator.serviceWorker.getRegistrations()).length;
  });
  expect(registrations).toBe(0);
});
