# Changelog

## Unreleased — Performance and practical limits

- Emit typed timings for representative source-validation and annotation paths.
- Bound concurrent local-file signature reads and stop scheduling them when a load is superseded.
- Reuse annotation serialization, compare summaries by field, and document practical dataset limits.

## Unreleased — Authenticated remote loading

- Add typed headers, cookie credentials, and request batching for remote DICOM URL loads.
- Validate and isolate options per load, preserve them safely for retry, and clear them on reset or teardown.
- Reject browser-controlled, duplicated, malformed, oversized, and excessive request headers.
- Document CORS, credentialed-server configuration, cancellation, and token-handling responsibilities.

## Unreleased — Configurable worker deployment

- Add a validated same-origin `workerBasePath` for root and subpath deployments.
- Redirect only packaged DWV workers while preserving unrelated application workers and multiple-viewer references.
- Emit `worker-error` with the resolved missing-worker URL and document compressed-image deployment.

## Unreleased — Touch and responsive controls

- Adapt settings, navigation, and editing controls at compact and narrow viewer widths.
- Increase coarse-pointer targets and keep the settings panel independently touch-scrollable.
- Add active-tool touch guidance and clear tracked gestures after pointer release, cancellation, or lost capture.

## Unreleased — Keyboard accessibility

- Make the ready viewer focusable and add scoped navigation, zoom, fit, reset, and tool shortcuts.
- Preserve form, link, editable-content, and browser-modified keyboard behavior.
- Add visible shortcut help, focus styling, and live announcements for completed actions.

## Unreleased — Viewport controls

- Expose typed zoom and pan state with absolute setters, reset, and change events.
- Add zoom-out, zoom-in, reset-view, and fit actions with a live zoom percentage.
- Keep image and annotation layers aligned through shared transforms and resize fitting.

## Unreleased — Window and level controls

- Expose typed window/level state, preset selection, manual adjustment, reset, and change events.
- Add image-specific preset, center, width, and reset controls for monochrome images.
- Validate manual input and keep state synchronized with DWV's drag tool and per-slice presets.

## Unreleased — Annotation list

- Expose typed annotation summaries and emit `annotation-list-change` as marks change.
- Add a collapsible mark list that selects annotations and navigates to referenced slices and frames.
- Keep list selection and deletion synchronized with canvas changes, undo/redo, and snapshot restoration.

## Unreleased — Annotation review

- Add a Show marks control and reactive `annotationsVisible` prop without changing saved snapshots.
- Add a reactive `readOnly` prop that blocks viewer annotation mutations while keeping navigation and incoming snapshot updates available.
- Apply review settings to annotation layers after load and restore.

## Unreleased — Additional drawing shapes

- Add configurable circle, three-point angle, and multi-point polygon/ROI tools.
- Show concise interaction guidance for each drawing shape.
- Verify circle, protractor, and ROI geometry through annotation export and restoration.

## Unreleased — Annotation selection and editing

- Track the selected mark through a typed event and exposed component API.
- Add undoable color, label, and delete controls for the selected mark.
- Persist edits and deletion through annotation export and restoration.

## Unreleased — Slice and frame navigation

- Model DWV's spatial scroll dimension separately from the optional temporal frame dimension.
- Add direct slice jumps and frame controls that preserve the other navigation coordinate.
- Emit typed navigation state and expose imperative slice/frame navigation with bounds coverage.

## Unreleased — Annotation history

- Centralize annotation replacement and start a fresh undo/redo boundary after restore or clear.
- Emit typed change reasons and history state for drawing, undo, redo, imperative, and reactive prop changes.
- Expose `getHistoryState()` and add coverage for create, replace, clear, history traversal, and prop loop prevention.

## Unreleased — Annotation validation

- Validate annotation snapshot structure and resource limits before DWV parsing.
- Reject study, image, frame, appearance, and shape references that do not match the loaded data.
- Preserve current marks when a requested annotation restore fails validation.

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
