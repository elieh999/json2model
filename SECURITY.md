# Security policy

## Supported version

Security fixes are applied to the latest version on the default branch.

## Reporting a vulnerability

Use the private security advisory feature in the repository Security tab. Include the affected input, the observed behavior, the expected behavior, and a minimal reproduction when possible.

Do not include real secrets, private JSON, credentials, or personal data in a report.

## Security model

JSON2Model performs parsing and generation in the browser. It has no application backend and makes no conversion requests. Browser preferences can be stored locally. Pasted input is stored only when the user explicitly enables the remember input setting.

The interface renders JSON and generated code as React text. It does not use raw HTML for user content. Resource limits guard input size, nesting depth, and visited node count.
