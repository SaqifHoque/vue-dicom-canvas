# Reviewed release preparation

Version **2.0.0** was published publicly on **2026-10-14** as [`@saqif/vue-dicom-canvas`](https://www.npmjs.com/package/@saqif/vue-dicom-canvas), under GPL-3.0-only. The public registry confirms version 2.0.0 and the `latest` tag.

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
| Registry destination and access | Published publicly under the maintainer's `@saqif` scope | Keep npm account and token permissions limited to the intended packages. |
| First release version | `2.0.0`, public registry and `latest` tag confirmed | Choose a new version for subsequent releases. |
| Security reporting | SECURITY.md requests private maintainer contact but no dedicated contact is recorded | Configure a monitored contact or repository private vulnerability reporting. |
| Release credentials and provenance | No publishing workflow is configured | Approve the publication mechanism and credentials/provenance policy. |

Keep all decisions explicit in release review. npm credentials stay in the user's npm configuration; no token or publishing secret is included in this repository.

## Final review record

The published tarball contains 65 files. Its SHA-1 is `002331ea3114e098c231096408d7a2c7d333a01a`. The package was packed through the local npm MCP and published through npm's browser-authenticated CLI after the saved token required interactive 2FA. The earlier `@ys-reading` upload failed because that scope was unavailable to the account; no release was published under that name.

Local preparation checks on 2026-10-13 passed: 93 unit tests, four built-package integration tests, four Chromium scenarios, library and demo builds, worker checksums, and a fresh consumer installation of a 64-file tarball. The live npm audit reported zero vulnerabilities. Vite still reports its existing large DWV chunk warning. These results cover the installed dependency versions on macOS; review the Linux CI jobs and rerun the checks for the final release commit.

Record the reviewed commit, the CI results, dependency audit result, chosen version, license decision, registry access, and security contact before publication. Package snapshots may contain patient/study metadata; verify application data handling against the boundaries documented in SECURITY.md.
