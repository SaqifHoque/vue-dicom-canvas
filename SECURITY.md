# Security policy

## Supported versions

Only the latest released version of this package receives security fixes.

## Reporting a vulnerability

Do not open a public issue for a suspected vulnerability involving patient data, arbitrary code execution, data disclosure, or denial of service. Report it privately to the package maintainer and include a minimal reproduction that contains no protected health information (PHI).

Until a dedicated security contact is configured, do not publish sensitive details. Package maintainers should add a monitored security email or enable private vulnerability reporting on the source repository before public release.

## Security boundaries

- This component renders untrusted DICOM input through DWV and its Web Workers. It is not a sandbox or a certified medical device.
- Remote DICOM access follows browser same-origin and CORS rules. Never place access tokens, credentials, or PHI in public URLs.
- Decoder workers must be served from the application's own trusted origin. Do not accept worker locations from end users.
- ZIP input is disabled by default to reduce decompression-bomb risk. Enabling it is appropriate only for trusted, size-limited archives.
- Annotation JSON is treated as untrusted input. Snapshot size, group, mark, and text limits are enforced before DWV parsing, and references must match the loaded study before existing marks are changed.
- Consumers should set a restrictive Content Security Policy and keep `vue`, `dwv`, and this package updated.
- Applications handling PHI remain responsible for authentication, authorization, audit logging, retention, transport encryption, and applicable regulatory requirements.

## Maintainer checks

Run these before every release:

```sh
npm ci
npm audit --audit-level=high
npm run check
npm pack --dry-run
npm run verify:workers
```

CI repeats these checks for pushes and pull requests. Dependency upgrades are reviewed and prepared manually.

The worker files in this release come from `dwv@0.36.4` under DWV's GPL-3.0 license. Their checksums are recorded in `workers/SHA256SUMS`; verification also compares them byte-for-byte with the installed DWV release so dependency updates cannot silently leave stale workers behind.
