# Security policy

## Supported version

Fixes go to the latest commit on the default branch. There is no maintained older
release.

## Reporting a vulnerability

Open a private security advisory from the repository Security tab. Please include the
input that triggers it, what happened, what you expected, and the smallest
reproduction you can manage.

Do not put real secrets, private JSON, credentials, or personal data in a report. A
minimal synthetic document is enough.

## Security model

Conversion happens in the browser. There is no backend, no analytics, no error
reporting service, and no AI API, so pasted JSON has nowhere to go. The production
build carries a Content Security Policy with `connect-src 'none'`, which blocks
network requests from the page outright. A browser test asserts that no request
leaves the page origin during a conversion and that the pasted text never appears in
local storage, session storage, or a cookie.

Browser preferences such as the theme and the selected language are stored locally.
Pasted input is stored only after the user turns on the remember input setting, which
is off by default, and the stored value is removed as soon as the setting is turned
off again. Stored preferences are validated field by field when read, so a value that
has been edited or left behind by an older version cannot reach the generators.

JSON and generated code are rendered as React text nodes. The project does not use
`dangerouslySetInnerHTML`, `eval`, `new Function`, or any file path derived from
input. The download file name is reduced to letters, digits, `_`, and `-`, so a
model name cannot introduce a path separator or a leading dot.

Resource limits keep a hostile document from hanging the page: 2,000,000 input
characters, 80 levels of nesting, and 50,000 visited values. Each limit produces a
readable message rather than unbounded work.

## Single file build

`npm run deliverable` produces one HTML file that runs from disk. It carries its own
Content Security Policy with `default-src 'none'` and `connect-src 'none'`, so it
cannot reach the network at all. The script and stylesheet are inlined, which is why
that policy allows `'unsafe-inline'` for those two directives and nothing else.

There is no bundled runtime and no executable, so nothing has to be trusted beyond
the browser already installed on the machine.
