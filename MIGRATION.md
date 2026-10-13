# Migration to Vue DICOM Canvas

These notes describe the reviewed implementation under `@ys-reading/vue-dicom-canvas`. The inherited `2.0.0` manifest version does not establish that this renamed package has been published.

## Imports and compatibility

Use the named `DicomViewer` export and explicitly import the stylesheet:

```ts
import { DicomViewer, type DicomAnnotations, type DicomSource } from '@ys-reading/vue-dicom-canvas'
import '@ys-reading/vue-dicom-canvas/style.css'
```

Install Vue `>=3.5.0 <4.0.0` and DWV `>=0.36.4 <0.37.0` as peers. Vue 3.5 is required for hydration-stable viewer IDs. Test the versions your application installs; the fresh-consumer check pins the versions installed in this checkout and does not establish compatibility with every version in the peer range.

Copy the six packaged workers to your application's public directory and configure `workerBasePath` from trusted application code. All viewers sharing a browser scope must use the same configured path. See the README for root and subpath deployments.

## Sources and loading

`source` accepts a local File, a URL, an array of either kind, or `null`. Keep source values stable until a new load is intended. `load()` returns a promise for that request's terminal `DicomLoadResult`; it resolves with a status rather than rejecting. Handle `loaded`, `error`, `aborted`, `timeout`, `empty`, and `superseded`. A new load supersedes the previous request.

Remote headers, cookie credentials, and batching belong in `remoteRequestOptions`, rather than URLs or global DWV configuration. ZIP input is disabled by default. Set resource limits appropriate to your dataset and client devices.

## Annotation persistence and review

The package uses version 1 `DicomAnnotations` snapshots containing DWV DICOM SR elements and appearance data. Annotorious data and arbitrary annotation JSON are not accepted. Bind `v-model:annotations` for viewer edits; persist that snapshot with its study/series identity through your own backend.

`setAnnotations(snapshot)` applies only after a matching image is ready, validates references before mutation, and begins a new history boundary. `null` clears marks. Invalid imperative restores throw; invalid prop restores emit `annotation-error`. The parent snapshot is retained when the viewer resets.

`annotationsVisible` hides layers without deleting saved marks. `readOnly` prevents viewer-originated mutation and imperative setters, while allowing incoming prop restores and navigation. Applications calling `getApp()` directly must enforce their own review policy.

File workflows use the same format. Enable `showAnnotationFileControls` or use `createAnnotationFile`, `readAnnotationFile`, `encodeAnnotationSnapshot`, and `decodeAnnotationSnapshot`. Helper validation checks the snapshot envelope; `setAnnotations()` additionally validates references against the loaded image.

## Controls and integration

Slice and frame setters use 1-based positions. Zoom is relative to the fitted image, and pan uses absolute layer offsets. Use the public methods and change events listed in the README instead of reaching into DOM controls or relying on generated IDs.

The package can be imported and its initial shell rendered during SSR. DWV initializes after browser mount. Keep initial props identical during hydration; multiple Vue roots need distinct, consistent `app.config.idPrefix` values or explicit unique `viewerId` values.

The demo combines a synthetic series, navigation and drawing tools, annotation file transfer, and in-memory database-style save/restore. It deliberately uses no real study files or persistent credentials.
