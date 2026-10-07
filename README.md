# Vue DICOM Canvas

A Vue 3 DICOM viewer with built-in slice navigation, customizable drawing tools, collapsible controls, and annotation export and restore for database integration.

Vue DICOM Canvas wraps [DWV](https://github.com/ivmartel/dwv) in a typed Vue component. Controls sit inside the image, and a gear icon shows or hides the settings panel. It supports local files, image series, and remote DICOM URLs.

> **Development status:** this repository contains the initial package implementation. Build and test it locally using the instructions below; no npm publication is implied.

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

## Run locally

Clone the repository and install its locked dependencies:

```sh
git clone https://github.com/SaqifHoque/vue-dicom-canvas.git
cd vue-dicom-canvas
npm ci
npm run dev
```

Open the URL printed by Vite. Use the gear icon to expand the image controls, select a shape and color, and drag to mark. Open **Try annotation save and restore** below the viewer to capture JSON, clear marks, and restore the saved snapshot. Demo snapshots are held in memory and are lost on refresh.

For a static demo build:

```sh
npm run build:example
npm run preview:example
```

The output is written to `example-dist/`. Regenerate the synthetic DICOM fixtures with `python3 scripts/generate-sample.py`.

## Use in another Vue application

The package name is `@ys-reading/vue-dicom-canvas`. Until a registry release is available, build a local tarball:

```sh
# From this repository
npm ci
npm pack

# From your Vue application; replace the tarball path as needed
npm install /path/to/ys-reading-vue-dicom-canvas-2.0.0.tgz vue "dwv@~0.36.4"
```

Import both the named component and its stylesheet:

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { DicomViewer, type DicomSource, type DicomAnnotations } from '@ys-reading/vue-dicom-canvas'
import '@ys-reading/vue-dicom-canvas/style.css'

const source = ref<DicomSource>(null)
const annotations = ref<DicomAnnotations | null>(null)

function openFiles(event: Event) {
    const input = event.target as HTMLInputElement
    annotations.value = null
    source.value = Array.from(input.files ?? [])
}
</script>

<template>
    <input type="file" multiple @change="openFiles" />
    <DicomViewer :source="source" v-model:annotations="annotations" height="600px" />
</template>
```

`source` accepts a `File`, URL string, array of files, array of URLs, or `null`. Arrays must contain only one source kind. Supply a new array to change a series. Remote requests follow browser CORS rules; local files are processed in the browser and are not uploaded by this package.

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

The package targets DWV `>=0.36.4 <0.37.0` and Vue `>=3.4.0 <4.0.0`. Copy the packaged worker files to your application's public assets during setup or build. For a Vite consumer:

```sh
mkdir -p public/assets/workers
cp node_modules/@ys-reading/vue-dicom-canvas/workers/*.min.js public/assets/workers/
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

`getApp()` exposes DWV for advanced integrations. DWV requires browser APIs; use a client-only viewer in SSR applications.

## Development and checks

```sh
npm run check           # Tests, type checking, library build, worker verification
npm run build:example   # Type-check and build the demo
npm run audit           # Check the live npm advisory database
npm pack --dry-run      # Inspect the package contents
```

Vue and DWV remain peer dependencies. The imaging engine is loaded when the viewer mounts and remains the largest runtime dependency. Generated builds, dependencies, local settings, and real study files are excluded from Git; only the synthetic demo DICOM files are included.

## Constraints and licensing

This is a viewer building block, not a certified medical device. Validate it for your intended use. Local inputs have count and size limits; enforce remote download limits and access controls in your backend. Filename and MIME checks are convenience filters, not DICOM validation. Rapid source replacement and decoder behavior also depend on DWV.

The wrapper is currently marked `UNLICENSED`; a project license must be selected before third-party reuse is offered. The bundled DWV workers originate from DWV 0.36.4 and carry GPL-3.0 licensing. Bundling them does not change the wrapper's declared license. Review both before redistribution.

See [SECURITY.md](SECURITY.md) for input and deployment boundaries, [CHANGELOG.md](CHANGELOG.md) for implementation history, and [workers/NOTICE.md](workers/NOTICE.md) for worker provenance.
