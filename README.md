# Vue DICOM Canvas

A Vue 3 DICOM viewer with built-in slice navigation, customizable drawing tools, collapsible controls, and annotation export and restore for database integration.

Vue DICOM Canvas wraps [DWV](https://github.com/ivmartel/dwv) in a typed Vue component. Controls sit inside the image, and a gear icon shows or hides the settings panel. It supports local files, image series, and remote DICOM URLs.

> **Development status:** this repository contains the initial package implementation. Build and test it locally using the instructions below; no npm publication is implied.

## Features

- Slice slider and previous/next navigation.
- Ruler, rectangle, ellipse, circle, arrow, angle, and polygon/ROI annotations with a color picker.
- Undo/redo, zoom/pan, window/level adjustment, and fit-to-container.
- Settings overlay with an accessible gear toggle.
- Annotation snapshots that retain image/frame references, geometry, colors, and labels.
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

## Worker assets

The package targets DWV `>=0.36.4 <0.37.0` and Vue `>=3.4.0 <4.0.0`. DWV loads decoding workers from `assets/workers` relative to the application page. For a Vite consumer:

```sh
mkdir -p public/assets/workers
cp node_modules/@ys-reading/vue-dicom-canvas/workers/*.min.js public/assets/workers/
```

Automate this copy during application setup or build. Worker requests must return JavaScript rather than an HTML fallback. The included demo copies workers automatically. Uncompressed DICOM images do not require a decoder worker.

## Save annotations in your database

The viewer provides data; your application owns persistence.

1. Bind a `DicomAnnotations | null` value through `v-model:annotations`.
2. Save that value as JSON through your backend, together with the study/series identifier.
3. Retrieve the JSON and supply it with the matching DICOM source to restore the marks.

The viewer emits `update:annotations` for viewer-originated drawing, editing, deletion, undo, redo, and imperative replacement changes. Every successful state change emits `annotations-change` with the snapshot and `{ reason, history }`; reasons are `draw`, `edit`, `delete`, `undo`, `redo`, `replace`, `clear`, or `prop`. Reactive prop restores use the `prop` reason without echoing `update:annotations`. The separate `history-change` event reports `{ index, floor, ceiling, canUndo, canRedo }` whenever availability changes.

Select an existing mark while a drawing tool is active to edit its color or label, or delete it, from the built-in controls. Selection emits `annotation-selection-change` with `{ uid, dataId, colour, label }`. The same operations are available through `getSelectedAnnotation()`, `updateSelectedAnnotation(edit)`, and `deleteSelectedAnnotation()`. Edits and deletion use DWV's undo stack and are reflected in exported annotation snapshots.

Use **Show marks** or `v-model:annotations-visible` to hide or show annotation layers without changing the saved snapshot. Set `read-only` for review: drawing choices, undo/redo, editing, deletion, and imperative `setAnnotations()` are blocked, while slice navigation, zoom/pan, window/level, and incoming `annotations` prop updates still work. Switching `read-only` or visibility at runtime moves an active drawing tool back to Scroll. `getApp()` exposes the underlying DWV instance; callers using it directly must enforce their own review policy.

A template ref exposes `getAnnotations()`, `setAnnotations(snapshot)`, and `getHistoryState()`. Pass `null` to the setter to clear marks. Call the setter after `loaded`; the prop may be supplied before loading and is applied when the image is ready.

Restoring or clearing annotations starts a new undo/redo boundary. Edits made before that replacement cannot be reached with the built-in Undo button, while new drawings can be undone and redone normally. Before changing any marks, the viewer validates the snapshot structure and size, then checks its study, image, frame, and shape references against the loaded DICOM data. A failed restore leaves the current marks and history boundary intact. Invalid prop-based restores emit `annotation-error`; invalid imperative restores throw. Resetting the viewer does not erase the parent's saved annotation value.

Snapshots use this package's versioned JSON format, containing DWV DICOM SR elements and appearance information. They are limited to 10 MiB, 100 groups, 1,000 annotations, and 4,096 characters per annotation text. They are not Annotorious JSON. They can include patient/study metadata copied from the DICOM source, so store and protect them as study data. The package does not connect to a database or autosave.

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
| `maxSources` | `2000` | Maximum files or URLs per load. |
| `maxFileSizeBytes` | `536870912` | Maximum individual local file size. |
| `maxTotalFileSizeBytes` | `2147483648` | Maximum combined local file size. |
| `allowInsecureHttp` | `false` | Allow non-localhost HTTP URLs. |
| `allowArchives` | `false` | Allow trusted local ZIP input. |

### Events, slots, and methods

- **Events:** `load-start`, `load-progress`, `loaded`, `error`, `load-abort`, `load-timeout`, `annotation-error`, `annotation-selection-change`, `update:annotations`, `update:annotationsVisible`, `annotations-change`, `history-change`, `navigation-change`, and `update:settingsOpen`.
- **Slots:** `loading`, `empty`, and `error`. The error slot receives `{ error, retry }`. The default error display includes a Retry button.
- **Methods:** `load(source?)`, `retry()`, `reset()`, `fitToContainer()`, `setSlice(oneBasedIndex)`, `setFrame(oneBasedIndex)`, `getNavigationState()`, `getAnnotations()`, `setAnnotations(snapshot)`, `getSelectedAnnotation()`, `updateSelectedAnnotation(edit)`, `deleteSelectedAnnotation()`, `getHistoryState()`, `getStatus()`, and `getApp()`.

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
