import { readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

/**
 * A single file build inlines the script and the stylesheet into the HTML, so the
 * result runs by opening it from disk. Set STANDALONE=1 to produce it.
 */
const standalone = process.env.STANDALONE === "1";

/**
 * The hosted page declares a strict Content Security Policy, injected at build
 * time only, because the dev server needs a websocket for hot reload and
 * `connect-src 'none'` would block it.
 *
 * `frame-ancestors` is deliberately absent: browsers ignore it in a `<meta>`
 * element and log a console error. A host that wants it has to send it as a
 * response header, which docs/deployment.md explains.
 */
const HOSTED_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join("; ");

/**
 * The single file build has no separate assets to allow, so everything is denied
 * except the inlined script and style. `connect-src 'none'` is the directive that
 * matters here: it is what makes uploading a pasted document impossible.
 */
const STANDALONE_CSP = [
  "default-src 'none'",
  "script-src 'unsafe-inline'",
  "style-src 'unsafe-inline'",
  "img-src data:",
  "connect-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join("; ");

function contentSecurityPolicy(): Plugin {
  return {
    name: "json2model-csp",
    apply: "build",
    transformIndexHtml: {
      order: "post",
      handler(html: string) {
        const policy = standalone ? STANDALONE_CSP : HOSTED_CSP;
        return html.replace(
          "<head>",
          `<head>\n    <meta http-equiv="Content-Security-Policy" content="${policy}" />`,
        );
      },
    },
  };
}

/**
 * Folds the built script and stylesheet into index.html and removes the separate
 * asset files, leaving one file that can be copied anywhere and opened directly.
 *
 * The bundle is emitted as an IIFE rather than a module, because a browser refuses
 * to load a module script over the file protocol.
 */
function inlineEverything(outDir: string): Plugin {
  return {
    name: "json2model-single-file",
    apply: "build",
    enforce: "post",
    async closeBundle() {
      const root = path.resolve(outDir);
      const htmlPath = path.join(root, "index.html");
      let html = await readFile(htmlPath, "utf8");

      const scriptMatch = /<script[^>]*src="([^"]+)"[^>]*><\/script>/.exec(
        html,
      );
      const styleMatch =
        /<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/.exec(html);

      if (scriptMatch?.[1]) {
        const assetPath = path.join(root, scriptMatch[1].replace(/^\.\//, ""));
        const code = await readFile(assetPath, "utf8");
        // A closing tag inside a string literal would end the script element.
        const safe = code.replaceAll("</script", "<\\/script");
        // The script moves to the end of the body. Vite emits it in the head as a
        // module, which a browser defers, but an inline classic script runs where
        // it sits and would not find the root element yet.
        //
        // Both replacements take a function. Minified React contains `$'` and
        // `$&`, which a string replacement would expand as patterns and splice the
        // rest of the document into the script.
        html = html.replace(scriptMatch[0], () => "");
        html = html.replace(
          "</body>",
          () => `  <script>\n${safe}\n  </script>\n  </body>`,
        );
        await rm(assetPath, { force: true });
      }
      if (styleMatch?.[1]) {
        const assetPath = path.join(root, styleMatch[1].replace(/^\.\//, ""));
        const css = await readFile(assetPath, "utf8");
        html = html.replace(styleMatch[0], () => `<style>\n${css}\n</style>`);
        await rm(assetPath, { force: true });
      }

      // The favicon and preview image are separate files that would not travel
      // with a single HTML document.
      html = html
        .replace(/<link rel="icon"[^>]*>\s*/, "")
        .replace(/<meta property="og:image"[^>]*>\s*/, "")
        .replace(/<meta name="twitter:card"[^>]*>\s*/, "");

      await writeFile(path.join(root, "JSON2Model.html"), html, "utf8");
      await rm(htmlPath, { force: true });
      await rm(path.join(root, "assets"), { recursive: true, force: true });
    },
  };
}

const outDir = standalone ? "dist-standalone" : "dist";

export default defineConfig({
  // Relative asset paths let the same build run from a domain root and from a
  // GitHub Pages repository subpath.
  base: "./",
  // A single file carries no companion assets, so the public folder is skipped.
  publicDir: standalone ? false : "public",
  plugins: [
    react(),
    contentSecurityPolicy(),
    ...(standalone ? [inlineEverything(outDir)] : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname),
    },
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
  },
  preview: {
    host: "127.0.0.1",
    port: 4173,
  },
  build: {
    outDir,
    emptyOutDir: true,
    // Source maps would publish the readable component tree next to the app.
    sourcemap: false,
    target: "es2022",
    ...(standalone
      ? {
          cssCodeSplit: false,
          assetsInlineLimit: Number.MAX_SAFE_INTEGER,
          modulePreload: { polyfill: false },
          rollupOptions: {
            output: {
              format: "iife" as const,
              inlineDynamicImports: true,
              entryFileNames: "assets/app.js",
              assetFileNames: "assets/app[extname]",
            },
          },
        }
      : {}),
  },
});
