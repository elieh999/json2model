# Deployment

The build is a folder of static files. There is no server side component, so any
static host works.

```bash
npm ci
npm run build
```

Publish `dist`. Asset paths are relative, so the same output serves correctly from a
domain root and from a repository subpath.

## GitHub Pages

`.github/workflows/deploy-pages.yml` publishes `dist` after the CI workflow succeeds
on `main`. Enable Pages first:

1. Open Settings, then Pages.
2. Set the source to GitHub Actions.
3. Push to `main`, or run the workflow manually from the Actions tab.

The workflow runs on `workflow_run` rather than `push`, so a branch with failing
tests is never published. `workflow_dispatch` is available for a manual deploy.

## Other hosts

| Host             | Build command   | Output directory |
| ---------------- | --------------- | ---------------- |
| Cloudflare Pages | `npm run build` | `dist`           |
| Netlify          | `npm run build` | `dist`           |
| Vercel           | `npm run build` | `dist`           |

## Response headers

The page carries its own Content Security Policy in a `<meta>` element, injected at
build time:

```text
default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:;
font-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none';
form-action 'none'
```

`connect-src 'none'` means the published page cannot make a network request at all.

Some directives only work as a response header. If your host lets you set headers,
add:

```text
Content-Security-Policy: frame-ancestors 'none'
Referrer-Policy: no-referrer
X-Content-Type-Options: nosniff
Cross-Origin-Opener-Policy: same-origin
```

`frame-ancestors` is deliberately not in the meta element, because browsers ignore it
there and log a console error.

## Windows desktop application

```bash
npm run desktop:build
npm run desktop:smoke
```

The first command builds the static site and wraps it with Electron, writing
`release/win-unpacked`. The second launches the packaged executable, converts a
document in it, and checks the clipboard bridge.

To hand the folder to someone, ship the whole `win-unpacked` directory. The DLL and
resource files beside `JSON2Model.exe` are part of the application. The executable is
not code signed, so SmartScreen shows an unknown publisher warning.
