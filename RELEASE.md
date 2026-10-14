# Reviewed release preparation

This repository has completed its queued feature batches for release review. The maintainer has authorized publication of version 2.0.0 to npm and licensing the wrapper. Registry publication will be recorded only after npm confirms success.

## Automated checks

From a clean checkout with dependencies installed:

```sh
npm ci
npm run audit
npm run check
npm run build:example
npm run verify:package
npx playwright install chromium
npm run test:browser
```

`verify:package` requires built `dist` files. It packs the current checkout with lifecycle scripts disabled to avoid recursive prepack checks, verifies required files and excluded artifacts, installs that exact tarball into a temporary consumer with pinned versions from the checkout, and checks ESM/CJS imports, SSR rendering, public TypeScript declarations, CSS and worker exports, and a Vite production build. It needs registry access and removes its temporary consumer and tarball afterward. This supplements the prepack hook, which continues to run `npm run check`.

CI runs the package verification and browser suite in separate jobs. Review both jobs on the final commit; a passing local run does not establish that remote CI passed. Browser coverage currently targets Chromium and the uncompressed synthetic series. Other browsers, compressed decoding, and visual comparisons remain outside the current coverage.

## Release decisions and remaining setup

| Decision | Current repository state | Required owner action |
| --- | --- | --- |
| Wrapper license and distribution terms | `GPL-3.0-only`, full text in LICENSE | Preserve the bundled GPL-3.0 DWV worker license and notices. |
| Registry destination and access | Package name is `@saqif/vue-dicom-canvas` | Confirm scope ownership, package access, and who may publish. |
| First release version | `2.0.0`, release candidate recorded in CHANGELOG.md | Confirm the registry upload before marking the release published. |
| Security reporting | SECURITY.md requests private maintainer contact but no dedicated contact is recorded | Configure a monitored contact or repository private vulnerability reporting. |
| Release credentials and provenance | No publishing workflow is configured | Approve the publication mechanism and credentials/provenance policy. |

Keep all decisions explicit in release review. npm credentials stay in the user's npm configuration; no token or publishing secret is included in this repository.

## Final review record

Local preparation checks on 2026-10-13 passed: 93 unit tests, four built-package integration tests, four Chromium scenarios, library and demo builds, worker checksums, and a fresh consumer installation of a 64-file tarball. The live npm audit reported zero vulnerabilities. Vite still reports its existing large DWV chunk warning. These results cover the installed dependency versions on macOS; review the Linux CI jobs and rerun the checks for the final release commit.

Record the reviewed commit, the CI results, dependency audit result, chosen version, license decision, registry access, and security contact before publication. Package snapshots may contain patient/study metadata; verify application data handling against the boundaries documented in SECURITY.md.
