/**
 * Builds the folder that gets handed to someone who just wants to use the tool.
 *
 * It contains one HTML file. Opening it runs the converter in the browser that is
 * already installed, with no runtime to install and no network access. Bundling a
 * private copy of Chromium instead would make the same application about 350 MB.
 *
 *   npm run deliverable
 */
import { cp, mkdir, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const source = path.join(projectRoot, "dist-standalone", "JSON2Model.html");

// Kept inside the project and ignored by git. An earlier version wrote to a
// sibling directory, which on a case insensitive file system resolved to the
// project itself and tried to delete it.
const outputRoot = path.join(projectRoot, "deliverable");

/** Refuses to clear anything that looks like a real project or a repository. */
async function clearOutput(target) {
  let entries;
  try {
    entries = await readdir(target);
  } catch {
    return; // Nothing there yet.
  }
  const protectedEntries = [".git", "package.json", "src", "node_modules"];
  const found = entries.filter((entry) => protectedEntries.includes(entry));
  if (found.length > 0) {
    throw new Error(
      `Refusing to clear ${target}: it contains ${found.join(", ")}. ` +
        "That is not a generated deliverable folder.",
    );
  }
  await rm(target, { recursive: true, force: true, maxRetries: 5 });
}

await stat(source).catch(() => {
  throw new Error(
    `${source} is missing. Run \`npm run build:standalone\` first.`,
  );
});

await clearOutput(outputRoot);
await mkdir(outputRoot, { recursive: true });
await cp(source, path.join(outputRoot, "JSON2Model.html"));

await writeFile(
  path.join(outputRoot, "START HERE.txt"),
  [
    "JSON2Model",
    "==========",
    "",
    "Double-click JSON2Model.html.",
    "",
    "It opens in the browser you already have. Nothing to install, no account, and",
    "no internet connection needed. Everything runs on this computer, and the JSON",
    "you paste never leaves it.",
    "",
    "How to use it:",
    "  1. Paste JSON on the left, or press Example to load a sample.",
    "  2. Pick Dart, TypeScript, or Python at the top.",
    "  3. Press Copy code.",
    "",
    "Settings lets you change the root model name, turn on date detection, and",
    "adjust the output for each language.",
    "",
    "This is a single file. Copy it anywhere, email it, or put it on a USB stick,",
    "and it still works on its own.",
    "",
    "License: MIT.",
    "",
  ].join("\n"),
  "utf8",
);

// Also drop a copy at the top of the project, so the thing you double-click is
// visible as soon as the folder is opened rather than inside a subfolder.
const shortcut = path.join(projectRoot, "JSON2Model.html");
await cp(source, shortcut);

const size = (await stat(shortcut)).size;
console.log(`double-click this:  ${shortcut}`);
console.log(`shareable folder:   ${outputRoot}`);
console.log(`size: ${Math.round(size / 1024)} KB`);
