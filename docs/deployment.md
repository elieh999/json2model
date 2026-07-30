# Deployment

## Static hosting

Run:

```bash
npm ci
npm run build:static
```

Publish `dist-static`. Its asset paths are relative, so it can be served from a domain root or a repository path.

GitHub Pages uses `.github/workflows/deploy-pages.yml`. Enable Pages with GitHub Actions as the source, then run the workflow or push to `main`.

Cloudflare Pages, Netlify, and Vercel can use `npm run build:static` as the build command and `dist-static` as the output directory.

## Sites and Cloudflare Worker hosting

Run:

```bash
npm ci
npm run build
```

The Sites build uses the vinext and Cloudflare compatible application shell. JSON conversion still runs in the browser. The Worker serves application files and does not receive pasted JSON.
