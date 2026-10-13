# Reviewed release preparation

This repository has completed its queued feature batches for release review. Preparing or merging this PR does not publish a package, create a release tag, or resolve the decisions below.

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

## Decisions remaining before publication

| Decision | Current repository state | Required owner action |
| --- | --- | --- |
| Wrapper license and distribution terms | `UNLICENSED` | Select and approve a project license and review distribution obligations for the bundled GPL-3.0 DWV workers. |
| Registry destination and access | Package name is `@ys-reading/vue-dicom-canvas` | Confirm scope ownership, package access, and who may publish. |
| First release version | Manifest retains inherited `2.0.0`; changelog contains Unreleased entries | Choose the release version and consolidate the approved changes into a dated release entry. |
| Security reporting | SECURITY.md requests private maintainer contact but no dedicated contact is recorded | Configure a monitored contact or repository private vulnerability reporting. |
| Release credentials and provenance | No publishing workflow is configured | Approve the publication mechanism and credentials/provenance policy. |

Keep all decisions explicit in release review. No publish credential, automated publishing step, version bump, or license replacement is introduced by this preparation batch.

## Final review record

Record the reviewed commit, the CI results, dependency audit result, chosen version, license decision, registry access, and security contact before publication. Package snapshots may contain patient/study metadata; verify application data handling against the boundaries documented in SECURITY.md.
