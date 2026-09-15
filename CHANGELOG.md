# Changelog

## Unreleased — Load lifecycle

- Remove Dependabot configuration; dependency upgrades are now prepared manually.
- Associate DWV events with the active data ID so replaced loads cannot overwrite current state.
- Make `load()` resolve with a typed terminal result, including superseded and empty requests.
- Handle reset and DWV aborts, timeouts, initialization failures, and component teardown consistently.
- Add an exposed `retry()` method, retry slot callback, and default retry control.
- Add lifecycle tests for stale events, cancellation, timeouts, and one-time settlement.

## Unreleased — Vue DICOM Canvas foundation

- Rename the package to `@ys-reading/vue-dicom-canvas` and add repository metadata.
- Add image-overlay controls with an accessible settings gear, slice navigation, drawing shapes and colors, undo/redo, zoom/pan, and window/level tools.
- Add versioned annotation JSON export and restore through Vue bindings and component methods.
- Include a synthetic 12-slice demo, persistence regression tests, and worker license notices.

The 2.0.0 notes below describe the inherited local implementation; they do not imply a registry release of the renamed package.

## 2.0.0

### Security

- Upgrade the supported imaging engine to `dwv@0.36.4`.
- Replace legacy decoder sources with current, checksummed DWV workers.
- Reject unsafe URL protocols and embedded URL credentials.
- Add configurable source-count and local-file size limits.
- Reject ZIP archives by default, including archives disguised with another extension or MIME type.
- Abort all active DWV loads during source replacement and teardown.
- Add malformed-DICOM tests, worker integrity verification, and a release security checklist.

### Breaking changes

- Require DWV `>=0.36.4 <0.37.0`.
- Remove `decoderBasePath`, `decoderPaths`, `createDecoderPaths()`, and `configureDicomDecoders()` because current DWV manages workers under `assets/workers`.
- Consumer applications must copy files from this package's `workers` directory to their public `assets/workers` directory.
- ZIP loading now requires the explicit `allowArchives` prop.
