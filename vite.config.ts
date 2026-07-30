import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

/**
 * The production page declares a strict Content Security Policy. It is injected
 * at build time only, because the dev server needs a websocket for hot reload and
 * `connect-src 'none'` would block it.
 *
 * `frame-ancestors` is deliberately absent: browsers ignore it in a `<meta>`
 * element and log a console error. A host that wants it has to send it as a
 * response header, which docs/deployment.md explains.
 */
const PRODUCTION_CSP = [
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

function contentSecurityPolicy(): Plugin {
  return {
    name: "json2model-csp",
    apply: "build",
    transformIndexHtml: {
      order: "post",
      handler(html: string) {
        return html.replace(
          "<head>",
          `<head>\n    <meta http-equiv="Content-Security-Policy" content="${PRODUCTION_CSP}" />`,
        );
      },
    },
  };
}

export default defineConfig({
  // Relative asset paths let the same build run from a domain root, from a
  // GitHub Pages repository subpath, and from the packaged desktop shell.
  base: "./",
  plugins: [react(), contentSecurityPolicy()],
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
    outDir: "dist",
    emptyOutDir: true,
    // Source maps would publish the readable component tree next to the app.
    sourcemap: false,
    target: "es2022",
  },
});
