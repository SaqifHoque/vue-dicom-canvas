# Minimal vue-dicom-canvas consumer

This independent Vite app installs `vue-dicom-canvas`. It imports the published component and CSS, with no aliases to the library source. The component is rendered inside `div#component-container` on a plain white page.

The dependency uses an npm alias for the existing scoped release until the first unscoped release is available.

```sh
cd examples/minimal
npm ci
npm run dev
```

Run `npm run build` for the static site. The demo and its dependencies are not included in the library npm archive.
