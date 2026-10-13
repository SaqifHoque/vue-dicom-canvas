# Introducing Vue DICOM Canvas: DICOM Viewing and Annotations in Vue 3

Medical images need more than an image tag. A viewer has to understand the study, navigate its slices, draw measurements in the correct image space, and preserve those measurements when a user returns later.

I built **Vue DICOM Canvas** to bring those interactions into a Vue application through one typed component. It wraps DWV's imaging engine with Vue bindings, built-in controls, and a versioned annotation snapshot format.

The package is called `@ys-reading/vue-dicom-canvas`. Its source is available on [GitHub](https://github.com/SaqifHoque/vue-dicom-canvas), alongside a synthetic 12-slice demo that you can run without using real patient data.

## Start with one component

The package supports Vue 3.5 and DWV 0.36.4. Install it with its peer dependencies:

```sh
npm install @ys-reading/vue-dicom-canvas "vue@^3.5.0" "dwv@~0.36.4"
```

For a Vite application, copy the packaged workers into the public directory:

```sh
mkdir -p public/assets/workers
cp node_modules/@ys-reading/vue-dicom-canvas/workers/*.min.js public/assets/workers/
```

Then import the component and its stylesheet:

```vue
<script setup lang="ts">
import { ref } from 'vue'
import {
    DicomViewer,
    type DicomSource,
    type DicomAnnotations
} from '@ys-reading/vue-dicom-canvas'
import '@ys-reading/vue-dicom-canvas/style.css'

const source = ref<DicomSource>(null)
const annotations = ref<DicomAnnotations | null>(null)

function openFiles(event: Event) {
    const input = event.target as HTMLInputElement
    annotations.value = null
    source.value = Array.from(input.files ?? [])
    input.value = ''
}
</script>

<template>
    <label>Open DICOM files
        <input type="file" multiple @change="openFiles" />
    </label>
    <DicomViewer
        :source="source"
        v-model:annotations="annotations"
        worker-base-path="./assets/workers/"
        height="600px"
        show-annotation-file-controls
    />
</template>
```

Local files are processed in the browser; the component does not upload them. You can also pass a remote URL or an array of URLs. Remote requests follow the browser's CORS rules, and authenticated loading supports bounded headers, cookie credentials, and request batching.

## Make the common interactions available

The viewer keeps its controls inside the image area. A gear button opens or closes the settings panel, so the same component can fit into a focused review page or a narrow dashboard column.

Navigation includes a slice slider, direct slice entry, previous and next buttons, and separate frame controls when temporal frames are available. A focused viewer also supports keyboard navigation. Form fields keep their own keyboard behavior.

For monochrome images, the contrast controls expose image presets and numeric window/level adjustment. Zoom, pan, reset, and fit actions use the shared image and annotation transforms, so marks stay aligned with the image.

Drawing tools include a ruler, rectangle, ellipse, circle, arrow, three-point angle, and multi-point polygon/ROI. You can set colors, select a mark, edit its label, delete it, and use undo or redo. The mark list stays synchronized with the canvas and can navigate to a mark's referenced slice and frame.

## Keep persistence in the application

Annotation persistence was a central part of this package. The viewer emits snapshots; your application decides where to store them and who may access them.

With `v-model:annotations`, drawing and editing update a `DicomAnnotations` value. Save that value as JSON through your backend, together with the study or series identity. When the user returns, load the matching images and supply the saved snapshot.

The snapshot preserves geometry, image and frame references, colors, and labels. It uses a versioned package format with DWV DICOM SR elements and appearance information. It is not a DICOM file, and it is not interchangeable with arbitrary annotation JSON.

Before replacing marks, the viewer validates the snapshot and checks its references against the loaded study. A failed restore leaves the current marks intact. A successful replacement starts a new undo boundary, preventing the user from undoing into marks from a previous snapshot.

For workflows that use files, the optional settings controls import and download the same JSON format. Custom interfaces can use the exported encode, decode, Blob creation, and file-reading helpers.

## Separate review from editing

Sometimes a user should inspect annotations without changing them. Set `read-only` to disable drawing, editing, deletion, undo/redo, and imperative annotation replacement. Navigation, contrast, viewport controls, and annotation download remain available.

The application can still supply a snapshot through the annotations prop. That makes read-only review useful when the application owns the approved set of marks.

You can also hide annotations without deleting them. Visibility affects the layers rather than the saved snapshot, so a user can inspect the underlying image and bring the marks back.

## Treat loading and cleanup as part of the API

Fast source changes can be as important as drawing. A user may select a new series before the first one has finished loading.

Each imperative `load()` call resolves with its own terminal result: loaded, error, aborted, timeout, empty, or superseded. Starting a new request supersedes the earlier one, and late events from the earlier load cannot overwrite the active viewer state. Retry preserves an isolated copy of the remote request options.

DWV loads lazily after browser mount. The package supports importing and rendering an initial shell during SSR, and generated IDs stay stable for hydration. Each viewer owns its state and cleanup; multiple viewers can share the engine import while maintaining separate controls, sources, and annotations.

## Test the package that consumers install

The current validation includes 93 unit tests, four built-package integration tests, and four Chromium scenarios. The browser suite draws on the actual canvas, traverses history, restores snapshots, changes slices, and downloads and imports annotation files. It also checks read-only review behavior.

Release verification goes a step further: it creates a tarball, installs that tarball into a fresh consumer project, checks ESM and CommonJS imports, validates public declarations, resolves CSS and worker exports, and builds a Vite application. That helps catch packaging mistakes that a workspace build can miss.

These checks do not cover every device or dataset. The browser suite currently uses Chromium and the uncompressed synthetic series. Compressed studies, other browsers, and application-specific workloads still need validation in the consuming application.

## Try it with the synthetic demo

The repository includes an example with fictional metadata, annotation file controls, a read-only toggle, and in-memory save/restore buttons:

```sh
git clone https://github.com/SaqifHoque/vue-dicom-canvas.git
cd vue-dicom-canvas
npm ci
npm run dev
```

If you are building a Vue interface around DICOM images, the [README](https://github.com/SaqifHoque/vue-dicom-canvas#readme) covers setup, worker deployment, API methods, persistence, and troubleshooting.

The package is a viewer building block rather than a certified medical device. Applications remain responsible for access control, storage, and handling study data. The wrapper currently declares `UNLICENSED`, while the bundled DWV workers include their GPL-3.0 licensing and notices; review those terms before reuse or redistribution.

**Links:** [Source and documentation](https://github.com/SaqifHoque/vue-dicom-canvas) · [Package page](https://www.npmjs.com/package/@ys-reading/vue-dicom-canvas)
