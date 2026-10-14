# Vue DICOM Canvas

A typed Vue 3 component for viewing DICOM images, navigating series, drawing annotations, and saving annotation snapshots in your own application.

Vue DICOM Canvas wraps [DWV](https://github.com/ivmartel/dwv) in a typed Vue component. Controls sit inside the image, and a gear icon shows or hides the settings panel. It supports local files, image series, and remote DICOM URLs.

[npm package](https://www.npmjs.com/package/@saqif/vue-dicom-canvas) · [Source code](https://github.com/SaqifHoque/vue-dicom-canvas) · [API reference](#component-api) · [Migration guide](MIGRATION.md) · [Security policy](SECURITY.md)

## Installation

```sh
npm install @saqif/vue-dicom-canvas "vue@^3.5.0" "dwv@~0.36.4"
```

Vue `>=3.5.0 <4.0.0` and DWV `>=0.36.4 <0.37.0` are peer dependencies. Import the package stylesheet and copy its workers into your application's public assets:

```sh
mkdir -p public/assets/workers
cp node_modules/@saqif/vue-dicom-canvas/workers/*.min.js public/assets/workers/
```

The worker files must be served from the application's own origin. Configure the directory with `worker-base-path`, as in the quick start below.

## Features

- Slice slider and previous/next navigation.
- Ruler, rectangle, ellipse, circle, arrow, angle, and polygon/ROI annotations with a color picker.
- Undo/redo, synchronized zoom/pan controls, window/level presets and numeric adjustment, and fit-to-container.
- Settings overlay with an accessible gear toggle.
- Focus-scoped keyboard navigation, viewport actions, tool selection, and live announcements.
- Responsive controls with coarse-pointer touch targets and active-tool gesture guidance.
- Annotation snapshots that retain image/frame references, geometry, colors, and labels.
- A collapsible annotation list that selects marks and jumps to their referenced slice and frame.
- Vue `v-model:annotations` and imperative export/restore methods.
- Lazy-loaded imaging engine, typed exports, and ESM/CommonJS builds.
- Independent slice and temporal-frame navigation with sliders, number inputs, and imperative controls.
- A generated 12-slice demo with fictional metadata.
- Authenticated URL loading with isolated headers, credentials, retry, and cancellation.
- Read-only review, annotation visibility, and optional JSON file import/download.
- SSR-safe imports, hydration-stable IDs, and independent viewer instances.

## Contents

- [Quick start](#quick-start)
- [Remote and authenticated sources](#remote-and-authenticated-sources)
- [Worker deployment](#worker-assets)
- [Database persistence](#save-annotations-in-your-database)
- [Annotation JSON files](#annotation-json-files)
- [Component API](#component-api)
- [SSR and multiple viewers](#ssr-and-multiple-viewers)
- [Troubleshooting](#troubleshooting)
- [Development](#development-and-checks)
- [Licensing](#constraints-and-licensing)

## Quick start

Import both the named component and its stylesheet:

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { DicomViewer, type DicomSource, type DicomAnnotations } from '@saqif/vue-dicom-canvas'
import '@saqif/vue-dicom-canvas/style.css'

const source = ref<DicomSource>(null)
const annotations = ref<DicomAnnotations | null>(null)
const message = ref('')

function openFiles(event: Event) {
    const input = event.target as HTMLInputElement
    annotations.value = null
    source.value = Array.from(input.files ?? [])
    input.value = ''
}
</script>

<template>
    <label>Open DICOM files
        <input type="file" multiple accept=".dcm,application/dicom" @change="openFiles" />
    </label>
    <DicomViewer
        :source="source"
        v-model:annotations="annotations"
        height="600px"
        worker-base-path="./assets/workers/"
        show-annotation-file-controls
        @error="message = $event.message"
        @annotation-error="message = $event.message"
        @worker-error="message = $event.message"
    />
    <p role="status">{{ message }}</p>
</template>
```

`source` accepts a `File`, URL string, array of files, array of URLs, or `null`. Arrays must contain only one source kind. Supply a new array to change a series. Remote requests follow browser CORS rules; local files are processed in the browser and are not uploaded by this package.

## Remote and authenticated sources

For a remote image or series, supply a URL or URL array through `source`:

```vue
<DicomViewer :source="['https://your-server.example/series/slice-01.dcm']" />
```

Authenticated URL loading uses `remoteRequestOptions`. Pass an `Authorization` header for token authentication, enable `withCredentials` for browser-managed cookies, and optionally limit concurrent URL requests with `batchSize`:

```vue
<DicomViewer
    :source="protectedSeries"
    :remote-request-options="{
        headers: [{ name: 'Authorization', value: `Bearer ${accessToken}` }],
        withCredentials: true,
        batchSize: 4
    }"
/>
```

Options are validated and copied when each URL load starts. A replacement load aborts the active DWV requests before applying its own snapshot; retry receives an isolated copy, and reset or teardown removes retained credentials. The imperative `load(source, remoteRequestOptions?)` method supports per-load options. Local `File` sources never receive remote request options.

Cross-origin servers must allow the application origin, requested methods, and custom headers such as `Authorization`. Credentialed cookie requests also require `Access-Control-Allow-Credentials: true` and an explicit allowed origin rather than `*`. Keep tokens out of URLs, logs, persisted annotation data, and source-control files. Browser-controlled headers such as `Cookie`, `Host`, `Origin`, `Referer`, and `Sec-*` cannot be forwarded; use `withCredentials` for cookies.

## Worker assets

The package targets DWV `>=0.36.4 <0.37.0` and Vue `>=3.5.0 <4.0.0`. Copy the packaged worker files to your application's public assets during setup or build. For a Vite consumer:

```sh
mkdir -p public/assets/workers
cp node_modules/@saqif/vue-dicom-canvas/workers/*.min.js public/assets/workers/
```

Then configure the same directory on the viewer:

```vue
<DicomViewer
    :source="source"
    worker-base-path="/assets/workers/"
    @worker-error="reportWorkerError"
/>
```

Use a document-relative path for an application deployed below the origin root, such as `worker-base-path="./assets/workers/"` at `/radiology/index.html`. The path resolves against `document.baseURI`, must remain on the application's HTTP(S) origin, and is read when the component mounts. Only the six names in the exported `dicomWorkerFiles` list are redirected; other application workers keep their original URLs. All mounted viewers must use the same path.

The `worker-error` event receives a `DicomWorkerLoadError` containing the resolved `workerUrl` when a decoder cannot load. A worker request returning an HTML fallback, a missing copied file, or an incorrect subpath will therefore identify the exact URL to fix. The included demo copies the packaged directory and configures its relative path automatically. Uncompressed DICOM images do not require a decoder worker.

## Save annotations in your database

The viewer provides data; your application owns persistence.

1. Bind a `DicomAnnotations | null` value through `v-model:annotations`.
2. Save that value as JSON through your backend, together with the study/series identifier.
3. Retrieve the JSON and supply it with the matching DICOM source to restore the marks.

The viewer emits `update:annotations` for viewer-originated drawing, editing, deletion, undo, redo, and imperative replacement changes. Every successful state change emits `annotations-change` with the snapshot and `{ reason, history }`; reasons are `draw`, `edit`, `delete`, `undo`, `redo`, `replace`, `clear`, or `prop`. Reactive prop restores use the `prop` reason without echoing `update:annotations`. The separate `history-change` event reports `{ index, floor, ceiling, canUndo, canRedo }` whenever availability changes.

Select an existing mark while a drawing tool is active to edit its color or label, or delete it, from the built-in controls. Selection emits `annotation-selection-change` with `{ uid, dataId, colour, label }`. The same operations are available through `getSelectedAnnotation()`, `updateSelectedAnnotation(edit)`, and `deleteSelectedAnnotation()`. Edits and deletion use DWV's undo stack and are reflected in exported annotation snapshots.

Use **Show marks** or `v-model:annotations-visible` to hide or show annotation layers without changing the saved snapshot. Set `read-only` for review: drawing choices, undo/redo, editing, deletion, and imperative `setAnnotations()` are blocked, while slice navigation, zoom/pan, window/level, and incoming `annotations` prop updates still work. Switching `read-only` or visibility at runtime moves an active drawing tool back to Scroll. `getApp()` exposes the underlying DWV instance; callers using it directly must enforce their own review policy.

A template ref exposes `getAnnotations()`, `setAnnotations(snapshot)`, and `getHistoryState()`. Pass `null` to the setter to clear marks. Call the setter after `loaded`; the prop may be supplied before loading and is applied when the image is ready.

`getAnnotationSummaries()` returns lightweight entries with the mark ID, data ID, label, color, shape, image UID, and optional frame number. `selectAnnotation(uid)` selects that mark and navigates to its referenced image and frame. The built-in **Marks** list uses the same state and stays synchronized with drawing, editing, deletion, undo/redo, and restored snapshots. List selection remains available in read-only mode; hidden annotations must be shown before selection.

For monochrome images, the **Contrast** controls list the presets supplied by the current DICOM image and allow direct center and width entry. DWV bounds manual values to the image's rescaled data range. **Reset** restores that image's first preset. `getWindowLevelState()` returns `{ center, width, preset, presets }`; `setWindowLevel({ center, width })`, `setWindowLevelPreset(name)`, and `resetWindowLevel()` provide the same operations to consuming applications. Changes made through these methods, the built-in controls, or DWV's Window / level drag tool emit `window-level-change`. Invalid control input emits `window-level-error`; imperative methods throw.

The **View** controls show zoom relative to the fitted image size and provide bounded zoom-out, zoom-in, reset, and fit actions. `getViewportState()` returns `{ zoom, pan: { x, y }, isDefault }`. Use `setViewportZoom(factor)` for 0.1× through 10× zoom, `setViewportPan({ x, y })` for an absolute offset, and `resetViewport()` to restore 1× with no pan. `viewport-change` also tracks mouse and touch changes from DWV's Zoom / pan tool. Image and annotation layers share the same DWV layer-group transform, including after container resize.

When an image is ready, tab to the viewer to use its keyboard shortcuts. Left/right arrows or Page Up/Page Down move between slices; up/down arrows move between frames when temporal frames exist. Plus and minus change zoom, `0` resets the view, `F` fits the image, and `S`, `Z`, and `W` select the scroll, zoom/pan, and window/level tools. These unmodified keys act only while the viewer region itself has focus, so controls, links, editable content, and browser modifier shortcuts keep their normal behavior. The settings panel lists the same shortcuts, and `viewerKeyboardShortcuts` exports that list for custom interfaces.

The controls adapt at 720px and 480px viewer widths rather than relying on the page viewport, so the component also works in narrow dashboard columns. Coarse pointers receive 44px targets. The canvas owns imaging gestures while the settings panel keeps vertical scrolling: the active tool's help text explains whether one-finger drags navigate, pan, adjust contrast, or draw, and the Zoom / pan tool documents its two-finger zoom and slice gesture. Pointer capture keeps an active touch associated with the canvas and clears interaction state after release, cancellation, lost capture, or component teardown.

Restoring or clearing annotations starts a new undo/redo boundary. Edits made before that replacement cannot be reached with the built-in Undo button, while new drawings can be undone and redone normally. Before changing any marks, the viewer validates the snapshot structure and size, then checks its study, image, frame, and shape references against the loaded DICOM data. A failed restore leaves the current marks and history boundary intact. Invalid prop-based restores emit `annotation-error`; invalid imperative restores throw. Resetting the viewer does not erase the parent's saved annotation value.

Snapshots use this package's versioned JSON format, containing DWV DICOM SR elements and appearance information. They are limited to 10 MiB, 100 groups, 1,000 annotations, and 4,096 characters per annotation text. They are not Annotorious JSON. They can include patient/study metadata copied from the DICOM source, so store and protect them as study data. The package does not connect to a database or autosave.

## Annotation JSON files

Enable `show-annotation-file-controls` to add **Import JSON** and **Download JSON** to the ready viewer's settings panel:

```vue
<DicomViewer
    v-model:annotations="annotations"
    :source="source"
    show-annotation-file-controls
    @annotation-error="reportAnnotationError"
/>
```

Downloads use the filename `annotations.json` and the same versioned snapshot used for database persistence. Import replaces the current marks only after snapshot and loaded-image reference validation succeeds, creates a new history boundary, and emits the normal `update:annotations` and `annotations-change` events with reason `replace`. An empty snapshot clears the marks. Failed imports preserve current marks and show feedback in the panel while emitting `annotation-error`. Import is disabled in read-only mode; download remains available. Reset, source changes, and unmount discard pending file reads before they can apply to another study.

Files are limited to 10 MiB before reading and must contain valid UTF-8 JSON snapshots; MIME types and extensions are picker hints rather than validation. Files include the same patient/study metadata as database snapshots. Use your application's storage and access policy for either workflow.

For custom interfaces, `createAnnotationFile(snapshot)` returns an `application/json` Blob, `readAnnotationFile(file)` asynchronously parses and validates a Blob, and `encodeAnnotationSnapshot(snapshot)` / `decodeAnnotationSnapshot(json)` handle strings. These helpers validate the snapshot envelope; apply the result through `setAnnotations()` after the matching image loads to validate study, image, frame, and shape references. The package continues to leave database persistence to your application.

## Performance and practical limits

The default source ceiling is 2,000 files or URLs. Local inputs are also limited to 512 MiB per file and 2 GiB in total. When archive input is disabled, the viewer reads file signatures through a bounded pool of eight operations; set `validationConcurrency` to a smaller positive integer for memory-constrained clients. A superseded load stops scheduling further signature reads.

These values are input guards rather than a promise that every browser can render a dataset at the ceiling. Pixel dimensions, transfer syntax, frame count, device memory, and decoder cost all affect the practical limit. Exercise representative studies on the lowest-specification supported client and lower `maxSources`, file-size limits, or validation concurrency when needed.

The `performance-measure` event reports `{ operation, durationMs, itemCount }` for source validation, annotation export, annotation restoration, and annotation-summary construction. Use it to collect application-specific timings without exposing patient or annotation content. Annotation exports reuse their serialized representation for prop-loop detection, and annotation-summary comparison avoids serializing unchanged lists.

## Component API

### Props

| Prop | Default | Purpose |
| --- | --- | --- |
| `source` | `null` | Local file(s) or remote URL(s). |
| `annotations` | `null` | Saved snapshot; supports `v-model:annotations`. |
| `annotationsVisible` | `true` | Show annotation layers; supports `v-model:annotations-visible`. |
| `readOnly` | `false` | Block viewer-originated annotation changes during review. |
| `showControls` | `true` | Display the built-in controls. |
| `showAnnotationFileControls` | `false` | Show annotation JSON import and download actions in the settings panel. |
| `settingsOpen` | `true` | Expand the settings panel; supports `v-model:settings-open`. |
| `width` / `height` | `100%` / `400px` | CSS dimensions; numbers are pixels. |
| `autoFit` | `true` | Fit after load and container resize. |
| `background` | `#000` | Viewer background. |
| `ariaLabel` | `DICOM image viewer` | Accessible viewer label. |
| `viewerId` | generated | Unique DOM identifier; keep stable after mount. |
| `tools` | built-in tools | DWV tool configuration overrides, read at mount. |
| `drawingShapes` | all supported shapes | Built-in drawing shapes shown in the selector, read at mount. |
| `workerBasePath` | `''` | Same-origin directory for packaged DWV workers, read at mount; empty preserves DWV's native resolution. |
| `remoteRequestOptions` | `undefined` | Validated headers, cookie credentials, and batch size for subsequent URL loads. |
| `maxSources` | `2000` | Maximum files or URLs per load. |
| `maxFileSizeBytes` | `536870912` | Maximum individual local file size. |
| `maxTotalFileSizeBytes` | `2147483648` | Maximum combined local file size. |
| `allowInsecureHttp` | `false` | Allow non-localhost HTTP URLs. |
| `allowArchives` | `false` | Allow trusted local ZIP input. |
| `validationConcurrency` | `8` | Maximum simultaneous local-file signature reads. |

### Events, slots, and methods

- **Events:** `load-start`, `load-progress`, `loaded`, `error`, `load-abort`, `load-timeout`, `performance-measure`, `worker-error`, `annotation-error`, `annotation-list-change`, `annotation-selection-change`, `window-level-change`, `window-level-error`, `viewport-change`, `viewport-error`, `update:annotations`, `update:annotationsVisible`, `annotations-change`, `history-change`, `navigation-change`, and `update:settingsOpen`.
- **Slots:** `loading`, `empty`, and `error`. The error slot receives `{ error, retry }`. The default error display includes a Retry button.
- **Methods:** `load(source?, remoteRequestOptions?)`, `retry()`, `reset()`, `fitToContainer()`, `getViewportState()`, `setViewportZoom(factor)`, `setViewportPan(point)`, `resetViewport()`, `setSlice(oneBasedIndex)`, `setFrame(oneBasedIndex)`, `getNavigationState()`, `getWindowLevelState()`, `setWindowLevel(value)`, `setWindowLevelPreset(name)`, `resetWindowLevel()`, `getAnnotations()`, `setAnnotations(snapshot)`, `getAnnotationSummaries()`, `selectAnnotation(uid)`, `getSelectedAnnotation()`, `updateSelectedAnnotation(edit)`, `deleteSelectedAnnotation()`, `getHistoryState()`, `getStatus()`, and `getApp()`.

Slice and frame positions are 1-based. For 4D data, `setSlice()` changes DWV's spatial scroll dimension without changing the temporal frame, while `setFrame()` changes the fourth dimension without changing the spatial slice. Invalid and out-of-range positions are ignored. `navigation-change` and `getNavigationState()` provide `{ slice, sliceCount, frame, frameCount }`; single-frame data always reports frame 1 of 1 and hides the frame controls.

The angle tool uses DWV's `Protractor` factory and completes after three points. **Polygon / freehand ROI** uses DWV's multi-point `ROI` factory: add boundary points and double-click to finish. DWV 0.36 does not provide a separate continuous freehand factory, so the viewer does not claim one. Circle, angle, and ROI geometry round-trip through the same versioned annotation snapshot format as the original shapes. Use the `drawingShapes` prop to limit the selector to an ordered subset of `Ruler`, `Rectangle`, `Ellipse`, `Circle`, `Arrow`, `Protractor`, and `ROI`.

`load()` now resolves when that specific request reaches a terminal state. Its `DicomLoadResult` status is `loaded`, `error`, `aborted`, `timeout`, `empty`, or `superseded`. Starting another load resolves the earlier promise as `superseded`; late events from the earlier DWV data ID are ignored. Results resolve rather than reject, so event-driven consumers do not also need an unhandled-rejection path.

`reset()` aborts an active request and emits `load-abort` with the `reset` reason. A DWV-originated abort emits the same event with the `dwv` reason. Timeouts set the error state, emit both `load-timeout` and `error`, and can be retried with the default button, the error slot's `retry` callback, or the exposed `retry()` method. Component teardown settles an outstanding `load()` result without emitting after unmount.

`getApp()` exposes DWV for advanced integrations. It returns `null` before initialization and after unmount.

## SSR and multiple viewers

The package can be imported and the viewer's initial shell rendered on the server. DWV is imported only after the viewer mounts in the browser; concurrent mounts share that import, and a later mount can retry a failed import. Keep the initial props consistent between server rendering and hydration. Image loading and canvas rendering require browser APIs.

Generated viewer IDs use Vue 3.5's `useId()` so separate SSR requests and hydration do not depend on a process-global counter. Within one Vue app, every viewer gets its own canvas and control IDs. For multiple Vue roots on the same document, configure a distinct `app.config.idPrefix` for each root, using the same prefix on server and client, or provide unique, stable `viewerId` values.

Each viewer owns its DWV app, source, annotations, history, controls, request credentials, and load sessions. Resetting or unmounting one viewer does not reset the others. Unmount settles pending loads, removes listeners, disconnects the resize observer, and releases its worker resolver reference; late initialization results are ignored. Worker deployment is shared at browser scope, so mounted viewers must use the same nonempty `workerBasePath` when configuring packaged workers.

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| Viewer controls are unstyled | Import `@saqif/vue-dicom-canvas/style.css`. |
| A compressed image fails to load | Copy all packaged worker files and verify that `workerBasePath` serves JavaScript from the same origin; inspect `worker-error` for the resolved URL. |
| A remote load is blocked | Check the server's CORS response and the allowed origin, headers, and credential settings. |
| Annotation restore is rejected | Load the matching study/image first and supply a version 1 package snapshot; inspect `annotation-error` or the imperative setter's thrown error. |
| Two viewers share DOM IDs | Give explicit IDs unique values; separate Vue roots need distinct `app.config.idPrefix` values. |
| A large study exceeds limits | Check `maxSources`, local file-size limits, and available client memory. |

## Development and checks

Run the synthetic 12-slice demo locally:

```sh
git clone https://github.com/SaqifHoque/vue-dicom-canvas.git
cd vue-dicom-canvas
npm ci
npm run dev
```

Open the URL printed by Vite. Use the gear icon to toggle settings, choose a shape, and draw on the image. The demo includes read-only review, file import/download, and in-memory save/restore. Its fictional study and snapshots contain no real patient data, and captured snapshots are lost on refresh.

Build a static demo with `npm run build:example`, then serve it with `npm run preview:example`. Output is written to `example-dist/`. To test the package before registry publication, run `npm pack` and install the resulting `.tgz` in your application. Regenerate fixtures with `python3 scripts/generate-sample.py`.

```sh
npm run check           # Tests, type checking, library build, worker verification
npm run test:integration # Built-package SSR and multiple-viewer tests (run build first)
npx playwright install chromium # One-time browser installation
npm run test:browser     # Build and serve the demo, then run Chromium regressions
npm run build:example   # Type-check and build the demo
npm run audit           # Check the live npm advisory database
npm pack --dry-run      # Inspect the package contents
npm run verify:package  # Verify actual tarball and fresh consumer (run check first)
```

Vue and DWV remain peer dependencies. The imaging engine is loaded when the viewer mounts and remains the largest runtime dependency. Generated builds, dependencies, local settings, and real study files are excluded from Git; only the synthetic demo DICOM files are included.

The browser suite uses the generated 12-slice series already shipped with the demo. It exercises actual canvas drawing, undo/redo, captured snapshot restoration, slice controls and keyboard navigation, settings visibility, JSON download/import, and malformed-file feedback. Playwright starts an isolated preview server on `127.0.0.1:4173` and waits for the viewer to be ready; stop other servers on that port before running it. Browser checks run separately from `npm run check` and packaging, so library checks do not require a browser download.

CI installs Chromium and its system dependencies, runs the suite in a separate job, and retains HTML reports, screenshots, and traces for seven days on failure. Inspect a local failure with `npx playwright show-report` or `npx playwright show-trace test-results/<test-folder>/trace.zip`. The current suite targets Chromium; Firefox, WebKit, compressed study decoding, and visual comparisons are not yet covered.

## Constraints and licensing

This is a viewer building block, not a certified medical device. Validate it for your intended use. Local inputs have count and size limits; enforce remote download limits and access controls in your backend. Filename and MIME checks are convenience filters, not DICOM validation. Rapid source replacement and decoder behavior also depend on DWV.

Vue DICOM Canvas is licensed under **GPL-3.0-only**. See [LICENSE](LICENSE) for the full license text. The bundled DWV workers originate from DWV 0.36.4 and retain their GPL-3.0 license, notices, and integrity manifest in `workers/`.

See [MIGRATION.md](MIGRATION.md) for API migration and compatibility notes, and [RELEASE.md](RELEASE.md) for the release checks and publication decisions still requiring review. See [SECURITY.md](SECURITY.md) for input and deployment boundaries, [CHANGELOG.md](CHANGELOG.md) for implementation history, and [workers/NOTICE.md](workers/NOTICE.md) for worker provenance.
